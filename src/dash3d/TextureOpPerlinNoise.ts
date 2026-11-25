import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import type PacketT from '#/io/PacketT';
import { glJar } from '#/client/ClientVariant';
import { doubleToInt } from '#/util/IntUtils';
import { arrayAtI16, arrayAtI32, arrayAtU8, arrayPutI32, requireNonNull } from '#/util/JavaArray';
import TextureOp from './TextureOp';
import { loadClient, loadWorldMap } from '#/util/GamepackClasses';

// vk
export default class TextureOpPerlinNoise extends TextureOp {
    // HD bi.a(Z)V
    static releaseTextureOpPerlinNoiseStatics(guard: boolean): void {
        try {
            const Client = loadClient();
            releaseReferences(Client, 'sceneMapUnderwaterLocData');
            if (guard) {
                const WorldMap = loadWorldMap();
                releaseReferences(WorldMap, 'memSuffix');
            }
            const WorldMap = loadWorldMap();
            releaseReferences(WorldMap, 'memSuffix');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'bi.S(' + guard + ')');
        }
    }

    private bias = true; // vk.Q:Z
    private amplitudes: Int16Array | null = null; // vk.V:[S
    private octaves = 4; // vk.W:I
    private permutation: Uint8Array | null = new Uint8Array(512); // vk.Y:[B
    private seed = 0; // vk.Z:I
    private xScale = 4; // vk.cb:I
    private frequencies: Int16Array | null = null; // vk.eb:[S
    private persistence = 1638; // vk.nb:I
    private yScale = 4; // vk.ob:I

    // kj.W:[I, kj.<clinit>()V
    static fadeTable: Int32Array | null = Int32Array.from({ length: 4096 }, (_, i) => TextureOpPerlinNoise.fade(i));

    // vk.<init>()V
    constructor() {
        super(0, true);
    }

    // HD qk.a(ZIIIIFII)[I. The point-light waveform uses a single Perlin scanline.
    static generateLine(bias: boolean, yScale: number, width: number, octaves: number, persistence: number, xScale: number, seed: number): Int32Array {
        const output = new Int32Array(width);
        const op = new TextureOpPerlinNoise();
        op.xScale = xScale;
        op.octaves = octaves;
        op.seed = seed;
        op.yScale = yScale;
        op.persistence = Math.fround(Math.fround(persistence) * 4096) | 0;
        op.bias = bias;
        op.postDecode();
        TextureOp.setSize(width, 1);
        op.renderRow(output, 0);
        return output;
    }

    // ig.a(IB)I
    static fade(t: number): number {
        const cube = Math.imul(t, Math.imul(t, t) >> 12) >> 12;
        const polynomial = (Math.imul(6 * t - 61440, t) >> 12) + 40960;
        return Math.imul(polynomial, cube) >> 12;
    }

    // vk.a(Lgd;ZI)V
    override decode(packet: PacketT | null, code: number): void {
        switch (code) {
            case 0:
                this.bias = requireNonNull(packet).g1() === 1;
                break;
            case 1:
                this.octaves = requireNonNull(packet).g1();
                break;
            case 2:
                this.persistence = requireNonNull(packet).g2s();
                if (this.persistence < 0) {
                    this.amplitudes = new Int16Array(this.octaves);
                    for (let i = 0; i < this.octaves; i++) this.amplitudes[i] = requireNonNull(packet).g2s();
                }
                break;
            case 3:
                this.xScale = this.yScale = requireNonNull(packet).g1();
                break;
            case 4:
                this.seed = requireNonNull(packet).g1();
                break;
            case 5:
                this.xScale = requireNonNull(packet).g1();
                break;
            case 6:
                this.yScale = requireNonNull(packet).g1();
                break;
        }
    }

    // vk.b(I)V
    override postDecode(): void {
        this.permutation = TextureOp.getPermutation(this.seed);
        this.prepareOctaves();
        for (let i = this.octaves - 1; i >= 1; i--) {
            const a = arrayAtI16(this.amplitudes, i);
            if (a > 8 || a < -8) break;
            this.octaves--;
        }
    }

    // vk.e(B)V
    private prepareOctaves(): void {
        if (this.persistence > 0) {
            this.frequencies = new Int16Array(this.octaves);
            this.amplitudes = new Int16Array(this.octaves);
            for (let i = 0; i < this.octaves; i++) {
                this.amplitudes[i] = doubleToInt(4096 * Math.pow(Math.fround(this.persistence / 4096), i));
                this.frequencies[i] = doubleToInt(Math.pow(2, i));
            }
        } else if (this.amplitudes !== null && this.amplitudes.length === this.octaves) {
            this.frequencies = new Int16Array(this.octaves);
            for (let i = 0; i < this.octaves; i++) this.frequencies[i] = doubleToInt(Math.pow(2, i));
        }
    }

    // vk.a(IIIIIII)I
    private noise(yFade: number, periodX: number, nextHash: number, hash: number, x: number, y: number): number {
        const y1 = (y - 4096) | 0;
        let x0 = x >> 12;
        x &= 4095;
        let x1 = x0 + 1;
        if (x1 >= periodX) x1 = 0;
        x0 &= 255;
        let grad = arrayAtU8(this.permutation, hash + x0) & 3;
        const dx1 = x - 4096;
        let a = grad > 1 ? (grad === 2 ? x - y : -y - x) : grad === 0 ? y + x : y - x;
        x1 &= 255;
        grad = arrayAtU8(this.permutation, hash + x1) & 3;
        let b = grad > 1 ? (grad === 2 ? dx1 - y : -dx1 - y) : grad === 0 ? y + dx1 : y - dx1;
        grad = arrayAtU8(this.permutation, nextHash + x0) & 3;
        const xFade = arrayAtI32(TextureOpPerlinNoise.fadeTable, x);
        const top = (a + (Math.imul(b - a, xFade) >> 12)) | 0;
        a = grad > 1 ? (grad === 2 ? x - y1 : -x - y1) : grad === 0 ? x + y1 : y1 - x;
        grad = arrayAtU8(this.permutation, nextHash + x1) & 3;
        b = grad > 1 ? (grad === 2 ? dx1 - y1 : -dx1 - y1) : grad === 0 ? dx1 + y1 : y1 - dx1;
        const bottom = (a + (Math.imul(b - a, xFade) >> 12)) | 0;
        return (top + (Math.imul(bottom - top, yFade) >> 12)) | 0;
    }

    // HD bi.a(IIIIIII)I. a.b is read between the first and second permutation entries.
    private noiseHd(x: number, nextHash: number, hash: number, periodX: number, y: number, yFade: number): number {
        const y1 = (y - 4096) | 0;
        let x0 = x >> 12;
        let x1 = (x0 + 1) | 0;
        x0 &= 255;
        if (x1 >= periodX) x1 = 0;
        let grad = arrayAtU8(this.permutation, x0 + hash) & 3;
        x &= 4095;
        const xFade = arrayAtI32(TextureOpPerlinNoise.fadeTable, x);
        let a = grad > 1 ? (grad === 2 ? x - y : -x - y) : grad === 0 ? y + x : y - x;
        const dx1 = (x - 4096) | 0;
        x1 &= 255;
        grad = arrayAtU8(this.permutation, hash + x1) & 3;
        let b = grad <= 1 ? (grad === 0 ? y + dx1 : y - dx1) : grad === 2 ? dx1 - y : -dx1 - y;
        grad = arrayAtU8(this.permutation, x0 + nextHash) & 3;
        const top = (a + (Math.imul(b - a, xFade) >> 12)) | 0;
        a = grad > 1 ? (grad === 2 ? x - y1 : -x - y1) : grad === 0 ? x + y1 : y1 - x;
        grad = arrayAtU8(this.permutation, nextHash + x1) & 3;
        b = grad > 1 ? (grad === 2 ? dx1 - y1 : -y1 - dx1) : grad === 0 ? dx1 + y1 : y1 - dx1;
        const bottom = (a + (Math.imul(b - a, xFade) >> 12)) | 0;
        return (top + (Math.imul(yFade, bottom - top) >> 12)) | 0;
    }

    // bi.a(IIIIIII)I uses the same four gradients until the X lattice cell changes.
    // Across one octave, Y, the two permutation hashes and the X period are constant.
    // The checked Java loop below handles short arrays and the prefix it writes before failing.
    private renderLatticeRow(dst: Int32Array | null, frequency: number, amplitude: number, hash: number, nextHash: number, periodX: number, y: number, yFade: number, accumulate: boolean, bias: boolean): boolean {
        const xs = TextureOp.normalisedX;
        const fade = TextureOpPerlinNoise.fadeTable;
        const permutation = this.permutation;
        const width = TextureOp.width;
        if (xs === null || xs.length < width || dst === null || dst.length < width || fade === null || fade.length < 4096 || permutation === null || permutation.length < 511 || permutation.buffer === dst.buffer) return false;
        let lastCell = -2147483648;
        let topLeftX = 0,
            topRightX = 0,
            bottomLeftX = 0,
            bottomRightX = 0;
        let topLeftY = 0,
            topRightY = 0,
            bottomLeftY = 0,
            bottomRightY = 0;
        const y1 = y - 4096;
        for (let i = 0; i < width; i++) {
            const sampleX = Math.imul(frequency, Math.imul(this.xScale, xs[i])) >> 12;
            const cell = sampleX >> 12;
            if (cell !== lastCell) {
                lastCell = cell;
                const x0 = cell & 255;
                const x1 = cell + 1 >= periodX ? 0 : (cell + 1) & 255;
                const topLeft = permutation[x0 + hash];
                const topRight = permutation[x1 + hash];
                const bottomLeft = permutation[x0 + nextHash];
                const bottomRight = permutation[x1 + nextHash];
                topLeftX = (topLeft & 1) === 0 ? 1 : -1;
                topRightX = (topRight & 1) === 0 ? 1 : -1;
                bottomLeftX = (bottomLeft & 1) === 0 ? 1 : -1;
                bottomRightX = (bottomRight & 1) === 0 ? 1 : -1;
                topLeftY = (topLeft & 2) === 0 ? y : -y;
                topRightY = (topRight & 2) === 0 ? y : -y;
                bottomLeftY = (bottomLeft & 2) === 0 ? y1 : -y1;
                bottomRightY = (bottomRight & 2) === 0 ? y1 : -y1;
            }
            const x = sampleX & 4095;
            const x1 = x - 4096;
            const xFade = fade[x];
            const a = (Math.imul(topLeftX, x) + topLeftY) | 0;
            const b = (Math.imul(topRightX, x1) + topRightY) | 0;
            const c = (Math.imul(bottomLeftX, x) + bottomLeftY) | 0;
            const d = (Math.imul(bottomRightX, x1) + bottomRightY) | 0;
            const top = (a + (Math.imul(b - a, xFade) >> 12)) | 0;
            const bottom = (c + (Math.imul(d - c, xFade) >> 12)) | 0;
            const noise = (top + (Math.imul(yFade, bottom - top) >> 12)) | 0;
            const scaled = Math.imul(amplitude, noise) >> 12;
            const value = accumulate ? (scaled + dst[i]) | 0 : scaled;
            dst[i] = bias ? 2048 + (value >> 1) : value;
        }
        return true;
    }

    // HD bi.a(ZI[I)V. The bias and accumulation branches enclose the scanline loops.
    private renderRowHd(dst: Int32Array | null, row: number): void {
        const baseY = Math.imul(this.yScale, arrayAtI32(TextureOp.normalisedY, row));
        if (this.octaves === 1) {
            const amplitude = arrayAtI16(this.amplitudes, 0);
            const frequency = arrayAtI16(this.frequencies, 0) << 12;
            const y = Math.imul(baseY, frequency) >> 12;
            const periodX = Math.imul(this.xScale, frequency) >> 12;
            const periodY = Math.imul(frequency, this.yScale) >> 12;
            const cellY = y >> 12;
            const hash = arrayAtU8(this.permutation, cellY & 255);
            const fractionY = y & 4095;
            const yFade = arrayAtI32(TextureOpPerlinNoise.fadeTable, fractionY);
            let nextY = (cellY + 1) | 0;
            if (nextY >= periodY) nextY = 0;
            const nextHash = arrayAtU8(this.permutation, nextY & 255);
            if (this.renderLatticeRow(dst, frequency, amplitude, hash, nextHash, periodX, fractionY, yFade, false, this.bias)) return;
            if (this.bias) {
                for (let x = 0; x < TextureOp.width; x++) {
                    const baseX = Math.imul(this.xScale, arrayAtI32(TextureOp.normalisedX, x));
                    const noise = this.noiseHd(Math.imul(frequency, baseX) >> 12, nextHash, hash, periodX, fractionY, yFade);
                    const value = Math.imul(amplitude, noise) >> 12;
                    arrayPutI32(dst, x, 2048 + (value >> 1));
                }
            } else {
                for (let x = 0; x < TextureOp.width; x++) {
                    const baseX = Math.imul(this.xScale, arrayAtI32(TextureOp.normalisedX, x));
                    const noise = this.noiseHd(Math.imul(baseX, frequency) >> 12, nextHash, hash, periodX, fractionY, yFade);
                    arrayPutI32(dst, x, Math.imul(amplitude, noise) >> 12);
                }
            }
            return;
        }
        const firstAmplitude = arrayAtI16(this.amplitudes, 0);
        if (firstAmplitude > 8 || firstAmplitude < -8) {
            const frequency = arrayAtI16(this.frequencies, 0) << 12;
            const periodY = Math.imul(frequency, this.yScale) >> 12;
            const periodX = Math.imul(this.xScale, frequency) >> 12;
            const y = Math.imul(baseY, frequency) >> 12;
            const cellY = y >> 12;
            let nextY = (cellY + 1) | 0;
            const hash = arrayAtU8(this.permutation, cellY & 255);
            const fractionY = y & 4095;
            const yFade = arrayAtI32(TextureOpPerlinNoise.fadeTable, fractionY);
            if (nextY >= periodY) nextY = 0;
            const nextHash = arrayAtU8(this.permutation, nextY & 255);
            if (!this.renderLatticeRow(dst, frequency, firstAmplitude, hash, nextHash, periodX, fractionY, yFade, false, false)) {
                for (let x = 0; x < TextureOp.width; x++) {
                    const baseX = Math.imul(arrayAtI32(TextureOp.normalisedX, x), this.xScale);
                    const noise = this.noiseHd(Math.imul(baseX, frequency) >> 12, nextHash, hash, periodX, fractionY, yFade);
                    arrayPutI32(dst, x, Math.imul(noise, firstAmplitude) >> 12);
                }
            }
        }
        for (let octave = 1; octave < this.octaves; octave++) {
            const amplitude = arrayAtI16(this.amplitudes, octave);
            if (amplitude <= 8 && amplitude >= -8) continue;
            const frequency = arrayAtI16(this.frequencies, octave) << 12;
            const y = Math.imul(frequency, baseY) >> 12;
            const cellY = y >> 12;
            const hash = arrayAtU8(this.permutation, cellY & 255);
            const periodX = Math.imul(this.xScale, frequency) >> 12;
            let nextY = (cellY + 1) | 0;
            const fractionY = y & 4095;
            const yFade = arrayAtI32(TextureOpPerlinNoise.fadeTable, fractionY);
            const periodY = Math.imul(this.yScale, frequency) >> 12;
            if (nextY >= periodY) nextY = 0;
            const nextHash = arrayAtU8(this.permutation, nextY & 255);
            if (this.renderLatticeRow(dst, frequency, amplitude, hash, nextHash, periodX, fractionY, yFade, true, this.bias && octave === this.octaves - 1)) continue;
            if (this.bias && octave === this.octaves - 1) {
                for (let x = 0; x < TextureOp.width; x++) {
                    const baseX = Math.imul(arrayAtI32(TextureOp.normalisedX, x), this.xScale);
                    const noise = this.noiseHd(Math.imul(frequency, baseX) >> 12, nextHash, hash, periodX, fractionY, yFade);
                    const value = ((Math.imul(amplitude, noise) >> 12) + arrayAtI32(dst, x)) | 0;
                    arrayPutI32(dst, x, (value >> 1) + 2048);
                }
            } else {
                for (let x = 0; x < TextureOp.width; x++) {
                    const baseX = Math.imul(arrayAtI32(TextureOp.normalisedX, x), this.xScale);
                    const noise = this.noiseHd(Math.imul(baseX, frequency) >> 12, nextHash, hash, periodX, fractionY, yFade);
                    arrayPutI32(dst, x, arrayAtI32(dst, x) + (Math.imul(noise, amplitude) >> 12));
                }
            }
        }
    }

    // vk.a(I[II)V
    private renderRow(dst: Int32Array | null, row: number): void {
        if (glJar) return this.renderRowHd(dst, row);
        const baseY = Math.imul(arrayAtI32(TextureOp.normalisedY, row), this.yScale);
        let octave = 0;
        do {
            const amplitude = arrayAtI16(this.amplitudes, octave);
            if (this.octaves === 1 || amplitude < -8 || amplitude > 8) {
                const frequency = arrayAtI16(this.frequencies, octave) << 12;
                const periodX = Math.imul(frequency, this.xScale) >> 12;
                const y = Math.imul(frequency, baseY) >> 12;
                const cellY = y >> 12;
                const periodY = Math.imul(frequency, this.yScale) >> 12;
                const hash = arrayAtU8(this.permutation, cellY & 255) & 255;
                const nextY = cellY + 1 >= periodY ? 0 : cellY + 1;
                const fractionY = y & 4095;
                const yFade = arrayAtI32(TextureOpPerlinNoise.fadeTable, fractionY);
                const nextHash = arrayAtU8(this.permutation, nextY & 255) & 255;
                const biased = this.bias && octave === this.octaves - 1;
                for (let i = 0; i < TextureOp.width; i++) {
                    const baseX = Math.imul(arrayAtI32(TextureOp.normalisedX, i), this.xScale);
                    const sample = this.noise(yFade, periodX, nextHash, hash, Math.imul(baseX, frequency) >> 12, fractionY);
                    let value = Math.imul(sample, amplitude) >> 12;
                    if (octave > 0) value = (arrayAtI32(dst, i) + value) | 0;
                    arrayPutI32(dst, i, biased ? 2048 + (value >> 1) : value);
                }
            }
        } while (++octave < this.octaves);
    }

    // vk.a(IB)[I
    override getMonochromeOutput(row: number): Int32Array | null {
        const dst = requireNonNull(this.monochromeImageCache).get(row);
        if (requireNonNull(this.monochromeImageCache).invalid) this.renderRow(dst, row);
        return dst;
    }
}
