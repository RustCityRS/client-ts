import { arrayPutI8 } from '#/util/JavaArray';
import FractalNoise3D from './FractalNoise3D';

// sb in runescape_gl.jar (HD only): the second noise volume of NoiseTextures (lm.c), fractal noise with seed 12,
// 5 octaves, scales 16/2/2 and persistence 0.45. Each sample becomes one LUMINANCE_ALPHA texel with luminance and
// alpha both 127 + v/2. NXT has no GL 1.x classes, so the name is descriptive (HD_PLAN.md 1.3).
// Stripped obfuscator artifact: the constant dummy argument -95 that build passes to wf.a(IIII)V.
export default class FractalNoiseVolume extends FractalNoise3D {
    private volume: Int8Array | null = null; // sb.I:[B

    // sb.a(IB)V
    override writeSample(index: number, value: number): void {
        let at = Math.imul(index, 2);
        value = ((127 + ((value & 255) >> 1)) << 24) >> 24;
        arrayPutI8(this.volume, at++, value);
        arrayPutI8(this.volume, at, value);
    }

    // sb.<init>()V
    constructor() {
        super(12, 5, 16, 2, 2, Math.fround(0.45));
    }

    // sb.b(III)[B. Returns sizeX * sizeY * sizeZ two-byte texels.
    build(sizeX: number, sizeY: number, sizeZ: number): Int8Array | null {
        this.volume = new Int8Array(Math.imul(Math.imul(Math.imul(sizeX, sizeY), sizeZ), 2));
        this.generate(sizeX, sizeZ, sizeY, -95);
        return this.volume;
    }
}
