import Pix3D from '#/dash3d/Pix3D';
import type Square from '#/dash3d/Square';
import type { HdTextureProvider } from '#/dash3d/TextureProvider';
import { loadEnvironment, loadGlLighting, loadWorld } from '#/util/GamepackClasses';

const tilesPerCell = 4;
const size = 104 / tilesPerCell;
const finePerCell = 128 * tilesPerCell;
// FloType's default underwater RGB when the map supplies no override.
const defaultWater = 0x122b3d;

function gamutLimit(channel: number, delta: number): number {
    if (delta > 0) return (255 - channel) / delta;
    if (delta < 0) return -channel / delta;
    return Infinity;
}

function sampleSurface(square: Square, water: number, textures: HdTextureProvider | null, palette: Int32Array, sample: { rgb: number; waterFraction: number }): void {
    sample.waterFraction = 0;
    function colour(hsl: number, texture: number, fraction: number): number {
        if (texture >= 0 && textures) {
            // The water key also extends onto dry banks. Only the water material covers this area.
            if (textures.materialType(texture) === 4) {
                sample.waterFraction += fraction;
                return water !== 0 ? water & 0xffffff : defaultWater;
            }
            hsl = textures.getTextureColour(texture);
        }
        // The native tile renderer uses this sentinel for an invisible face.
        return hsl >= 0 && hsl < palette.length ? palette[hsl] : -1;
    }
    const plain = square.quickGround;
    if (plain) {
        sample.rgb = colour(plain.colourSW, plain.texture, 1);
        return;
    }
    const ground = square.ground;
    if (!ground) {
        sample.rgb = -1;
        return;
    }
    let r = 0,
        g = 0,
        b = 0,
        area = 0;
    for (let i = 0; i < ground.faceVertexA.length; i++) {
        const a = ground.faceVertexA[i],
            p = ground.faceVertexB[i],
            q = ground.faceVertexC[i];
        const x = ground.vertexX,
            z = ground.vertexZ;
        const weight = Math.abs((x[p] - x[a]) * (z[q] - z[a]) - (x[q] - x[a]) * (z[p] - z[a]));
        const rgb = colour(ground.faceColourA[i], ground.faceTexture?.[i] ?? -1, weight / (2 * 128 * 128));
        if (rgb < 0) continue;
        r += ((rgb >> 16) & 255) * weight;
        g += ((rgb >> 8) & 255) * weight;
        b += (rgb & 255) * weight;
        area += weight;
    }
    sample.rgb = area > 0 ? (Math.round(r / area) << 16) | (Math.round(g / area) << 8) | Math.round(b / area) : -1;
}

/** Surface atmosphere samples at four-tile cell centres. Alpha encodes Y in the scene's downward-positive coordinates. */
export default class TerrainAtmosphere {
    static readonly size = size;
    readonly pixels = new Uint8Array(size * size * 4);
    private readonly horizon = new Uint8Array(size * size * 3);
    baseY = 0;
    heightRange = 1;
    ready = false;
    private scene: (Square | null)[][] | null = null;
    private ground: Int32Array[] | null = null;
    private batches: object | null = null;
    private brightness = -1;

    update(): boolean {
        const world = loadWorld();
        const scene = world.mainLevelTiles?.[0] ?? null;
        const ground = world.mainGroundh?.[0] ?? null;
        const batches = world.mainTerrainBatches?.[0] ?? null;
        const brightness = Pix3D.legacyBrightness;
        if (this.scene === scene && this.ground === ground && this.batches === batches && this.brightness === brightness) return false;
        this.scene = scene;
        this.ground = ground;
        this.batches = batches;
        this.brightness = brightness;
        this.ready = false;
        const palette = Pix3D.colourTable;
        const environments = loadEnvironment().grid;
        if (!scene || !ground || !batches || !palette || !environments) return true;

        const defaultFog = loadGlLighting().defaultFogColour;
        const textures = Pix3D.textureProvider as HdTextureProvider | null;
        const field = new Float32Array(size * size * 4);
        const sample = { rgb: 0, waterFraction: 0 };
        let minY = Infinity,
            maxY = -Infinity,
            totalY = 0,
            totalTiles = 0;
        for (let cz = 0; cz < size; cz++) {
            for (let cx = 0; cx < size; cx++) {
                const index = (cz * size + cx) * 4;
                let r = 0,
                    g = 0,
                    b = 0,
                    y = 0,
                    waterArea = 0,
                    count = 0;
                for (let z = cz * tilesPerCell; z < (cz + 1) * tilesPerCell; z++) {
                    for (let x = cx * tilesPerCell; x < (cx + 1) * tilesPerCell; x++) {
                        const tile = scene[x][z];
                        if (!tile) continue;
                        // PushDown puts the original landscape below the bridge square.
                        const floor = tile.linkedSquare ?? tile;
                        sampleSurface(floor, world.waterSpriteKeys?.[x][z] ?? 0, textures, palette, sample);
                        const rgb = sample.rgb;
                        if (rgb < 0) continue;
                        waterArea += sample.waterFraction;
                        r += (rgb >> 16) & 255;
                        g += (rgb >> 8) & 255;
                        b += rgb & 255;
                        y += (ground[x][z] + ground[x + 1][z] + ground[x][z + 1] + ground[x + 1][z + 1]) * 0.25;
                        count++;
                    }
                }
                const fog = environments[cx >> 1]?.[cz >> 1]?.fogColour ?? defaultFog;
                const fr = (fog >> 16) & 255,
                    fg = (fog >> 8) & 255,
                    fb = fog & 255;
                // The surface lends its hue to the haze. Remove its luma so a dark floor does
                // not darken the sky, and scale all three channels together at the gamut limit.
                const grey = 0.2126 * r + 0.7152 * g + 0.0722 * b;
                const skyLuma = 0.2126 * fr + 0.7152 * fg + 0.0722 * fb;
                const coverage = waterArea / (tilesPerCell * tilesPerCell);
                const pigment = ((0.22 + 0.38 * coverage) * skyLuma) / (255 * (count || 1));
                // Broad water cools the regional haze while the authored water pigment still
                // distinguishes blue sea from green canals. Both contributions preserve luminance.
                const air = 0.8 * coverage;
                const dr = (r - grey) * pigment + air * (0.82 * skyLuma - fr);
                const db = (b - grey) * pigment + air * (1.27 * skyLuma - fb);
                const dg = -(0.2126 * dr + 0.0722 * db) / 0.7152;
                const tint = Math.min(1, gamutLimit(fr, dr), gamutLimit(fg, dg), gamutLimit(fb, db));
                field[index] = fr + dr * tint;
                field[index + 1] = fg + dg * tint;
                field[index + 2] = fb + db * tint;
                field[index + 3] = count ? y / count : NaN;
                if (count) {
                    minY = Math.min(minY, field[index + 3]);
                    maxY = Math.max(maxY, field[index + 3]);
                    totalY += y;
                    totalTiles += count;
                }
            }
        }
        if (!totalTiles) return true;
        this.baseY = minY;
        this.heightRange = Math.max(1, maxY - minY);
        for (let z = 0; z < size; z++) {
            for (let x = 0; x < size; x++) {
                let r = 0,
                    g = 0,
                    b = 0,
                    y = 0,
                    weights = 0,
                    heightWeights = 0;
                for (let nz = Math.max(0, z - 1); nz <= Math.min(size - 1, z + 1); nz++) {
                    for (let nx = Math.max(0, x - 1); nx <= Math.min(size - 1, x + 1); nx++) {
                        const w = (nx === x ? 2 : 1) * (nz === z ? 2 : 1);
                        const i = (nz * size + nx) * 4;
                        r += field[i] * w;
                        g += field[i + 1] * w;
                        b += field[i + 2] * w;
                        weights += w;
                        if (Number.isFinite(field[i + 3])) {
                            y += field[i + 3] * w;
                            heightWeights += w;
                        }
                    }
                }
                const i = (z * size + x) * 4;
                this.pixels[i] = Math.round(r / weights);
                this.pixels[i + 1] = Math.round(g / weights);
                this.pixels[i + 2] = Math.round(b / weights);
                const averageY = heightWeights ? y / heightWeights : totalY / totalTiles;
                this.pixels[i + 3] = Math.round(((averageY - this.baseY) * 255) / this.heightRange);
            }
        }
        // Sample the player's surroundings for the horizon, including water around an island
        // or jetty. Pre-filter once per terrain build so panning and walking only interpolate.
        for (let z = 0; z < size; z++) {
            for (let x = 0; x < size; x++) {
                let r = 0,
                    g = 0,
                    b = 0,
                    weight = 0;
                for (let nz = Math.max(0, z - 3); nz <= Math.min(size - 1, z + 3); nz++) {
                    for (let nx = Math.max(0, x - 3); nx <= Math.min(size - 1, x + 3); nx++) {
                        const w = (4 - Math.abs(nx - x)) * (4 - Math.abs(nz - z));
                        const i = (nz * size + nx) * 4;
                        r += this.pixels[i] * w;
                        g += this.pixels[i + 1] * w;
                        b += this.pixels[i + 2] * w;
                        weight += w;
                    }
                }
                const cell = z * size + x;
                const local = this.pixels;
                const luma = 0.2126 * local[cell * 4] + 0.7152 * local[cell * 4 + 1] + 0.0722 * local[cell * 4 + 2];
                const surroundingsLuma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / weight;
                const dr = r / weight - surroundingsLuma;
                const dg = g / weight - surroundingsLuma;
                const db = b / weight - surroundingsLuma;
                const tint = Math.min(1, gamutLimit(luma, dr), gamutLimit(luma, dg), gamutLimit(luma, db));
                this.horizon[cell * 3] = Math.round(luma + dr * tint);
                this.horizon[cell * 3 + 1] = Math.round(luma + dg * tint);
                this.horizon[cell * 3 + 2] = Math.round(luma + db * tint);
            }
        }
        this.ready = true;
        return true;
    }

    sampleColour(fineX: number, fineZ: number): number {
        const x = Math.max(0, Math.min(size - 1, fineX / finePerCell - 0.5));
        const z = Math.max(0, Math.min(size - 1, fineZ / finePerCell - 0.5));
        const x0 = x | 0,
            z0 = z | 0;
        const a = (z0 * size + x0) * 3;
        const b = a + (x0 < size - 1 ? 3 : 0);
        const below = z0 < size - 1 ? size * 3 : 0;
        const fx = x - x0,
            fz = z - z0;
        let colour = 0;
        for (let k = 0; k < 3; k++) {
            const top = this.horizon[a + k] * (1 - fx) + this.horizon[b + k] * fx;
            const bottom = this.horizon[a + below + k] * (1 - fx) + this.horizon[b + below + k] * fx;
            colour = (colour << 8) | Math.round(top * (1 - fz) + bottom * fz);
        }
        return colour;
    }
}
