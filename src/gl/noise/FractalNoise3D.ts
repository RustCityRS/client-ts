import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import { doubleToInt } from '#/util/IntUtils';
import { arrayAtI32, arrayPutI32, arrayPutI8 } from '#/util/JavaArray';
import Noise3D from './Noise3D';
import { loadGameShell, loadPlayerModel, loadSpriteLoader, loadWorldList } from '#/util/GamepackClasses';

// vd in runescape_gl.jar (HD only): fractal 3D noise. Each sample sums its octaves weighted by persistence^octave
// (fixed point, 12 fractional bits) and emits the absolute value of the sum, clamped to 4095, as a byte (>> 4).
// FractalNoiseVolume (sb) is the concrete volume. NXT has no GL 1.x classes, so the name is descriptive
// (HD_PLAN.md 1.3).
//
// Statics of vd that are not part of the noise generator were relocated here by the obfuscator and have their own
// membermap-hd.json homes (vd.v, vd.w, vd.B, vd.C, vd.F, vd.a(IIIIBI)V, vd.b(IIII)Z, vd.d(I)V, vd.a(BZ)V,
// vd.<clinit>); they are not ported in this file. Stripped obfuscator artifacts: the invocation counters vd.y, vd.z,
// vd.A and vd.E, the client.mb opaque predicate, the gj.a catch/rethrow wrappers, and the constant dummy parameters of
// vd.a(III)V (-20975), vd.a(I)V (-949697716) and vd.a(B)V (-92), each verified at its only call site in wf.a(IIII)V,
// with their guards.
export default class FractalNoise3D extends Noise3D {
    // HD vd.d(I)V
    static releaseFractalNoise3DStatics(guard: number): void {
        try {
            const SpriteLoader = loadSpriteLoader();
            releaseReferences(SpriteLoader, 'hitbarDefaultName');
            const PlayerModel = loadPlayerModel();
            releaseReferences(PlayerModel, 'recolourSourcesRs');
            const WorldList = loadWorldList();
            releaseReferences(WorldList, 'zero');
            if (guard !== 128) {
                return;
            }
            const GameShell = loadGameShell();
            releaseReferences(GameShell, 'drawArea');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'vd.I(' + guard + ')');
        }
    }

    private sum = 0; // vd.x:I
    private amplitudes: Int32Array | null = null; // vd.G:[I
    private output: Int8Array | null = null; // vd.H:[B
    private index = 0; // vd.J:I

    // vd.<init>(IIIIIF)V. persistence is a Java float.
    constructor(seed: number, octaves: number, xScale: number, yScale: number, zScale: number, persistence: number) {
        super(seed, octaves, xScale, yScale, zScale);
        this.amplitudes = new Int32Array(this.octaves);
        for (let i = 0; i < this.octaves; i++) {
            arrayPutI32(this.amplitudes, i, (doubleToInt(Math.pow(persistence, i) * 4096.0) << 16) >> 16);
        }
    }

    // vd.a(III)V
    override addOctave(value: number, octave: number): void {
        this.sum = (this.sum + (Math.imul(value, arrayAtI32(this.amplitudes, octave)) >> 12)) | 0;
    }

    // vd.a(I)V
    override reset(): void {
        this.index = 0;
        this.sum = 0;
    }

    // vd.a(IB)V. FractalNoiseVolume overrides it, so the output array is never allocated here. qc.c(II)I is the
    // outlined a & b helper, inlined.
    writeSample(index: number, value: number): void {
        try {
            const output = this.output;
            const at = this.index;
            this.index = (at + 1) | 0;
            arrayPutI8(output, at, ((127 + ((value & 255) >> 1)) << 24) >> 24);
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'vd.B(' + index + ',' + value + ')');
        }
    }

    // vd.a(B)V
    override emitSample(): void {
        this.sum = Math.abs(this.sum) | 0;
        if (this.sum >= 4096) {
            this.sum = 4095;
        }
        const at = this.index;
        this.index = (at + 1) | 0;
        this.writeSample(at, ((this.sum >> 4) << 24) >> 24);
        this.sum = 0;
    }
}
