// Four field samples per 530 tile. The smallest terrain shape vertex offset is a quarter tile.
const SCALE = 4;
const TILES = 104;
const SIZE = TILES * SCALE;
const POINTS = (SIZE + 1) * (SIZE + 1);

export default class Shoreline {
    static readonly size = SIZE;
    readonly pixels = new Uint8Array(SIZE * SIZE * 2);
    readonly bankTiles = new Uint8Array(TILES * TILES);
    private readonly edges = new Map<number, number>();
    private readonly xs = new Float32Array(16);
    private readonly zs = new Float32Array(16);

    constructor(
        private readonly surface: Int32Array[],
        private readonly bottom: Int32Array[]
    ) {
        for (let i = 0; i < this.pixels.length; i += 2) this.pixels[i] = 255;
    }

    addTile(x: number, z: number, vertices: DataView, stride: number, polygon: Int32Array, littleEndian: boolean): void {
        const n = polygon.length;
        if (n < 3 || n > this.xs.length) return;
        // Only a measured bed supplies a water elevation. The first dry corner can sit high on a bank.
        let nearest = Infinity,
            height = -1;
        for (let cz = Math.max(0, z - 1); cz <= Math.min(z + 2, TILES); cz++) {
            for (let cx = Math.max(0, x - 1); cx <= Math.min(x + 2, TILES); cx++) {
                const distance = (cx - x - 0.5) ** 2 + (cz - z - 0.5) ** 2;
                if (distance >= nearest || this.bottom[cx][cz] <= this.surface[cx][cz]) continue;
                nearest = distance;
                height = Math.min(255, Math.max(0, -this.surface[cx][cz] >> 3));
            }
        }
        for (let i = 0; i < n; i++) {
            const offset = polygon[i] * stride;
            this.xs[i] = vertices.getFloat32(offset, littleEndian) / 32;
            this.zs[i] = vertices.getFloat32(offset + 8, littleEndian) / 32;
        }
        for (let i = 0, j = n - 1; i < n; j = i++) {
            let ax = this.xs[j],
                az = this.zs[j];
            const dx = this.xs[i] - ax,
                dz = this.zs[i] - az;
            // Split shared tile edges where a neighbouring shaped tile can have an extra vertex.
            const steps = dx === 0 ? Math.abs(dz) : dz === 0 ? Math.abs(dx) : Math.abs(dx) === Math.abs(dz) ? Math.abs(dx) : 1;
            for (let part = 0; part < steps; part++) {
                const start = az * (SIZE + 1) + ax;
                ax += dx / steps;
                az += dz / steps;
                const end = az * (SIZE + 1) + ax;
                const key = Math.min(start, end) * POINTS + Math.max(start, end);
                if (!this.edges.delete(key)) this.edges.set(key, height);
            }
        }
        for (let pz = z * SCALE; pz < (z + 1) * SCALE; pz++) {
            for (let px = x * SCALE; px < (x + 1) * SCALE; px++) {
                let inside = false;
                for (let i = 0, j = n - 1; i < n; j = i++) {
                    const zi = this.zs[i],
                        zj = this.zs[j];
                    if (zi > pz + 0.5 !== zj > pz + 0.5 && px + 0.5 < this.xs[i] + ((pz + 0.5 - zi) * (this.xs[j] - this.xs[i])) / (zj - zi)) inside = !inside;
                }
                if (inside) this.pixels[(pz * SIZE + px) * 2] = 0;
            }
        }
    }

    finish(): void {
        const nearest = new Float32Array(SIZE * SIZE).fill(Infinity);
        for (const [key, height] of this.edges) {
            if (height < 0) continue;
            const a = Math.floor(key / POINTS),
                b = key % POINTS;
            const ax = a % (SIZE + 1),
                az = (a / (SIZE + 1)) | 0;
            const bx = b % (SIZE + 1),
                bz = (b / (SIZE + 1)) | 0;
            const dx = bx - ax,
                dz = bz - az,
                length = dx * dx + dz * dz;
            // Extrapolate the water plane past the signed-distance range for filtered height samples.
            for (let z = Math.max(0, Math.min(az, bz) - 3); z < Math.min(SIZE, Math.max(az, bz) + 3); z++) {
                for (let x = Math.max(0, Math.min(ax, bx) - 3); x < Math.min(SIZE, Math.max(ax, bx) + 3); x++) {
                    const t = Math.min(1, Math.max(0, ((x + 0.5 - ax) * dx + (z + 0.5 - az) * dz) / length));
                    const sq = (x + 0.5 - ax - dx * t) ** 2 + (z + 0.5 - az - dz * t) ** 2;
                    const i = z * SIZE + x;
                    if (sq >= nearest[i]) continue;
                    nearest[i] = sq;
                    const sign = this.pixels[i * 2] < 128 ? -1 : 1;
                    this.pixels[i * 2] = Math.round(255 * (0.5 + sign * Math.min(0.5, Math.sqrt(sq) / SCALE)));
                    this.pixels[i * 2 + 1] = height;
                    if (sq <= 4) this.bankTiles[(z >> 2) * TILES + (x >> 2)] = 1;
                }
            }
        }
    }
}
