import { arrayPutI8 } from '#/util/JavaArray';
import RidgedMultifractal3D from './RidgedMultifractal3D';

// ng in runescape_gl.jar (HD only): the first noise volume of NoiseTextures (lm.d), ridged multifractal noise with
// seed 8, 5 octaves, scales 8/8/2, H 0.1, offset 0.55 and gain 3.0. Each sample becomes one LUMINANCE_ALPHA texel:
// luminance 3v/32 and alpha v/4. NXT has no GL 1.x classes, so the name is descriptive (HD_PLAN.md 1.3).
// Stripped obfuscator artifact: the constant dummy argument -98 that build passes to wf.a(IIII)V.
export default class RidgedNoiseVolume extends RidgedMultifractal3D {
    private volume: Int8Array | null = null; // ng.O:[B

    // ng.<init>()V
    constructor() {
        super(8, 5, 8, 8, 2, Math.fround(0.1), Math.fround(0.55), Math.fround(3.0));
    }

    // ng.b(III)[B. Returns sizeX * sizeY * sizeZ two-byte texels.
    build(sizeX: number, sizeY: number, sizeZ: number): Int8Array | null {
        this.volume = new Int8Array(Math.imul(Math.imul(Math.imul(sizeX, sizeY), sizeZ), 2));
        this.generate(sizeX, sizeZ, sizeY, -98);
        return this.volume;
    }

    // ng.a(IB)V
    override writeSample(index: number, value: number): void {
        let at = Math.imul(index, 2);
        const unsigned = value & 255;
        arrayPutI8(this.volume, at++, ((Math.imul(3, unsigned) >> 5) << 24) >> 24);
        arrayPutI8(this.volume, at, ((unsigned >> 2) << 24) >> 24);
    }
}
