import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import { doubleToInt } from '#/util/IntUtils';
import { arrayPutI8 } from '#/util/JavaArray';
import Noise3D from './Noise3D';
import { loadClient, loadWorldMap } from '#/util/GamepackClasses';

// we in runescape_gl.jar (HD only): ridged multifractal 3D noise (fixed point, 12 fractional bits). Each octave's
// signal is (offset - |noise|)^2, weighted from octave 1 on by the previous signal times the gain (clamped to
// [0, 1]) and by an amplitude that grows by 2^H per octave. The sum >> 4, clamped to [0, 255], is emitted as a byte.
// RidgedNoiseVolume (ng) is the concrete volume. NXT has no GL 1.x classes, so the name is descriptive
// (HD_PLAN.md 1.3).
//
// Statics of we that are not part of the noise generator were relocated here by the obfuscator and have their own
// membermap-hd.json homes (we.v, we.w, we.H, we.a(BI)I -> TextureOpPerlinNoise.fade, we.a(BILbe;)I, we.b(II)Z,
// we.b(BI)V, we.c(B)V, we.<clinit>); they are not ported in this file. Stripped obfuscator artifacts: the invocation
// counters we.x, we.y, we.C and we.K, the client.mb opaque predicate, the gj.a catch/rethrow wrappers, and the
// constant dummy parameters of we.a(III)V (-20975), we.a(I)V (-949697716) and we.a(B)V (-92), each verified at its
// only call site in wf.a(IIII)V, with their guards.
export default class RidgedMultifractal3D extends Noise3D {
    // HD we.c(B)V
    static releaseRidgedMultifractal3DStatics(guard: number): void {
        try {
            const WorldMap = loadWorldMap();
            releaseReferences(WorldMap, 'font11');
            if (guard !== -74) {
                const Client = loadClient();
                releaseReferences(Client, 'sceneMapLandData');
            }
            const Client = loadClient();
            releaseReferences(Client, 'sceneMapLandData');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'we.I(' + guard + ')');
        }
    }

    private amplitude = 0; // we.u:I
    private amplitudeRatio = 0; // we.z:I
    private gain = 0; // we.A:I
    private weight = 0; // we.B:I
    private signal = 0; // we.D:I
    private output: Int8Array | null = null; // we.F:[B
    private offset = 0; // we.G:I
    private index = 0; // we.J:I
    private sum = 0; // we.L:I

    // we.<init>(IIIIIFFF)V. h, offset and gain are Java floats.
    constructor(seed: number, octaves: number, xScale: number, yScale: number, zScale: number, h: number, offset: number, gain: number) {
        super(seed, octaves, xScale, yScale, zScale);
        this.gain = doubleToInt(Math.fround(4096.0 * gain));
        this.offset = doubleToInt(Math.fround(offset * 4096.0));
        this.amplitude = this.amplitudeRatio = doubleToInt(Math.pow(0.5, -h) * 4096.0);
    }

    // we.a(IB)V. RidgedNoiseVolume overrides it, so the output array is never allocated here.
    writeSample(index: number, value: number): void {
        try {
            arrayPutI8(this.output, index, value);
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'we.G(' + index + ',' + value + ')');
        }
    }

    // we.a(B)V
    override emitSample(): void {
        this.amplitude = this.amplitudeRatio;
        this.sum >>= 4;
        if (0 > this.sum) {
            this.sum = 0;
        } else if (255 < this.sum) {
            this.sum = 255;
        }
        const at = this.index;
        this.index = (at + 1) | 0;
        this.writeSample(at, (this.sum << 24) >> 24);
        this.sum = 0;
    }

    // we.a(III)V
    override addOctave(value: number, octave: number): void {
        if (octave !== 0) {
            this.weight = Math.imul(this.gain, this.signal) >> 12;
            if (this.weight >= 0) {
                if (this.weight > 4096) {
                    this.weight = 4096;
                }
            } else {
                this.weight = 0;
            }
            this.signal = (-(value >= 0 ? value : -value | 0) + this.offset) | 0;
            this.signal = Math.imul(this.signal, this.signal) >> 12;
            this.signal = Math.imul(this.signal, this.weight) >> 12;
            this.sum = (this.sum + (Math.imul(this.amplitude, this.signal) >> 12)) | 0;
            this.amplitude = Math.imul(this.amplitudeRatio, this.amplitude) >> 12;
        } else {
            this.weight = 4096;
            this.signal = (-(value >= 0 ? value : -value | 0) + this.offset) | 0;
            this.sum = this.signal = Math.imul(this.signal, this.signal) >> 12;
        }
    }

    // we.a(I)V
    override reset(): void {
        this.index = 0;
        this.sum = 0;
    }
}
