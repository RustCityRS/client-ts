// Camera motion for the optional uncapped HD renderer. The Java scene owns both
// poses. Only the extra GPU presentations can move beyond the latest pose.
function rotation(out: Float64Array, pitch: number, yaw: number): void {
    const radians = Math.PI / 180;
    const cp = Math.cos((180 + pitch) * radians);
    const sp = Math.sin((180 + pitch) * radians);
    const cy = Math.cos(yaw * radians);
    const sy = Math.sin(yaw * radians);
    out[0] = cy;
    out[1] = 0;
    out[2] = sy;
    out[3] = sp * sy;
    out[4] = cp;
    out[5] = -sp * cy;
    out[6] = -cp * sy;
    out[7] = sp;
    out[8] = cp * cy;
}

const identity = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

export default class PresentationCamera {
    readonly matrix = identity.slice();
    private readonly pose = new Float64Array(5);
    private readonly velocity = new Float64Array(5);
    private readonly currentRotation = new Float64Array(9);
    private readonly displayRotation = new Float64Array(9);
    private cycle = -1;
    private time = 0;
    private moving = false;

    get canAdvance(): boolean {
        return this.moving;
    }

    reset(): void {
        this.cycle = -1;
        this.moving = false;
        this.matrix.set(identity);
    }

    capture(x: number, y: number, z: number, pitch: number, yaw: number, cycle: number, time: number): void {
        this.matrix.set(identity);
        if (cycle === this.cycle && x === this.pose[0] && y === this.pose[1] && z === this.pose[2] && pitch === this.pose[3] && yaw === this.pose[4]) return;
        const ticks = cycle - this.cycle;
        const v = this.velocity;
        v[0] = x - this.pose[0];
        v[1] = y - this.pose[1];
        v[2] = z - this.pose[2];
        v[3] = pitch - this.pose[3];
        v[4] = (yaw - this.pose[4]) % 360;
        if (v[4] > 180) v[4] -= 360;
        if (v[4] < -180) v[4] += 360;
        // A jump or a suspended tab supplies no reliable inter-tick velocity.
        this.moving = this.cycle >= 0 && ticks > 0 && ticks <= 4 && time - this.time <= 100 && Math.max(Math.abs(v[0]), Math.abs(v[1]), Math.abs(v[2])) <= 512 && Math.max(Math.abs(v[3]), Math.abs(v[4])) <= 45 && v.some(delta => delta !== 0);
        if (this.moving) for (let i = 0; i < v.length; i++) v[i] /= ticks;
        this.pose[0] = x;
        this.pose[1] = y;
        this.pose[2] = z;
        this.pose[3] = pitch;
        this.pose[4] = yaw;
        rotation(this.currentRotation, pitch, yaw);
        this.cycle = cycle;
        this.time = time;
    }

    sample(time: number): Float32Array<ArrayBuffer> {
        const t = Math.min(1, Math.max(0, (time - this.time) / 20));
        if (!this.moving || t === 0) {
            this.matrix.set(identity);
            return this.matrix;
        }
        const v = this.velocity;
        const current = this.currentRotation;
        const next = this.displayRotation;
        rotation(next, this.pose[3] + v[3] * t, this.pose[4] + v[4] * t);
        // Convert the captured eye-space vertices to the new eye space:
        // R(next) * transpose(R(current)), plus R(next) * (currentPos - nextPos).
        for (let row = 0; row < 3; row++) {
            const i = row * 3;
            for (let col = 0; col < 3; col++) {
                const j = col * 3;
                this.matrix[col * 4 + row] = next[i] * current[j] + next[i + 1] * current[j + 1] + next[i + 2] * current[j + 2];
            }
            this.matrix[12 + row] = -t * (next[i] * v[0] + next[i + 1] * v[1] + next[i + 2] * v[2]);
        }
        return this.matrix;
    }
}
