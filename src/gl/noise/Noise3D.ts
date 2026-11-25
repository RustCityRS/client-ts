import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import TextureOp from '#/dash3d/TextureOp';
import TextureOpPerlinNoise from '#/dash3d/TextureOpPerlinNoise';
import { doubleToInt, intDivide } from '#/util/IntUtils';
import { arrayAtI16, arrayAtI32, arrayPutI16, arrayPutI32 } from '#/util/JavaArray';
import JavaRandom from '#/util/JavaRandom';
import { loadClient, loadLocalisedText, loadLocType, loadScriptRunner, loadSpriteLoader } from '#/util/GamepackClasses';

// wf in runescape_gl.jar (HD only): the base of the two procedural noise volumes that NoiseTextures (lm) builds at
// load stage 150. It samples fixed-point 3D gradient noise (12 fractional bits) over a sizeX x sizeY x sizeZ grid,
// once per octave, and hands each octave value to the subclass. Wrapping each lattice axis at scale * frequency makes
// the volume tile. NXT has no GL 1.x classes, so the name is descriptive (HD_PLAN.md 1.3).
//
// Statics of wf that are not part of the noise generator were relocated here by the obfuscator and have their own
// membermap-hd.json homes (wf.b, wf.d, wf.f, wf.g, wf.h, wf.j, wf.o, wf.s, wf.a(II)I, wf.b(I)V, wf.<clinit>); they are
// not ported in this file. Stripped obfuscator artifacts: the invocation counters wf.e, wf.k and wf.n, the client.mb
// opaque predicate, and the constant dummy parameters of wf.b(B)V (-60) and wf.c(I)V (-190126388).
// The two wf.a(IIII)V callers use -98 and -95, below its alternate-branch threshold of -68.
export default abstract class Noise3D {
    // HD wf.b(I)V
    static releaseNoise3DStatics(guard: number): void {
        try {
            const SpriteLoader = loadSpriteLoader();
            releaseReferences(SpriteLoader, 'xOffsets');
            const Client = loadClient();
            releaseReferences(Client, 'configArchive');
            if (guard !== 4) {
                return;
            }
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'germanLoadedUpdateList');
            const LocType = loadLocType();
            releaseReferences(LocType, 'temp');
            releaseReferences(Client, 'tweenDisabled');
            const ScriptRunner = loadScriptRunner();
            releaseReferences(ScriptRunner, 'activeComponent2');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'wf.J(' + guard + ')');
        }
    }

    // Field initializers of wf.<init>(IIIII)V, in putfield order.
    private permutation: Int16Array | null = new Int16Array(512); // wf.a:[S
    private seed = 0; // wf.i:I
    private xScale = 4; // wf.m:I
    private yScale = 4; // wf.l:I
    private zScale = 4; // wf.r:I
    octaves = 4; // wf.t:I
    private frequencies: Int16Array | null = null; // wf.c:[S

    // wf.<init>(IIIII)V
    constructor(seed: number, octaves: number, xScale: number, yScale: number, zScale: number) {
        this.yScale = yScale;
        this.octaves = octaves;
        this.seed = seed;
        this.zScale = zScale;
        this.xScale = xScale;
        this.initFrequencies();
        this.initPermutation();
    }

    // wf.a(IIII)V. lm.a()V reaches it through RidgedNoiseVolume.build and FractalNoiseVolume.build. Samples are
    // emitted x fastest, then y, then z.
    generate(sizeX: number, sizeZ: number, sizeY: number, guard: -98 | -95 = -98): void {
        try {
            const xs = new Int32Array(sizeX);
            const ys = new Int32Array(sizeY);
            const zs = new Int32Array(sizeZ);
            for (let i = 0; i < sizeX; i++) {
                arrayPutI32(xs, i, intDivide(i << 12, sizeX));
            }
            for (let i = 0; i < sizeY; i++) {
                arrayPutI32(ys, i, intDivide(i << 12, sizeY));
            }
            for (let i = 0; i < sizeZ; i++) {
                arrayPutI32(zs, i, intDivide(i << 12, sizeZ));
            }
            this.reset();
            for (let z = 0; z < sizeZ; z++) {
                for (let y = 0; y < sizeY; y++) {
                    for (let x = 0; x < sizeX; x++) {
                        for (let octave = 0; octave < this.octaves; octave++) {
                            const frequency = arrayAtI16(this.frequencies, octave) << 12;
                            const periodX = Math.imul(this.xScale, frequency) >> 12;
                            let pz = Math.imul(frequency, arrayAtI32(zs, z)) >> 12;
                            const periodY = Math.imul(frequency, this.yScale) >> 12;
                            pz = Math.imul(pz, this.zScale);
                            const periodZ = Math.imul(frequency, this.zScale) >> 12;
                            let px = Math.imul(arrayAtI32(xs, x), frequency) >> 12;
                            px = Math.imul(px, this.xScale);
                            let cellX = px >> 12;
                            px &= 4095;
                            let cellZ = pz >> 12;
                            const px1 = (px - 4096) | 0;
                            let cellX1 = (cellX + 1) | 0;
                            let cellZ1 = (cellZ + 1) | 0;
                            let py = Math.imul(arrayAtI32(ys, y), frequency) >> 12;
                            const fadeX = arrayAtI32(TextureOpPerlinNoise.fadeTable, px); // a.b:[I
                            py = Math.imul(py, this.yScale);
                            cellZ &= 255;
                            cellX &= 255;
                            if (periodZ <= cellZ1) {
                                cellZ1 = 0;
                            } else {
                                cellZ1 &= 255;
                            }
                            let cellY = py >> 12;
                            const hashZ = arrayAtI16(this.permutation, cellZ);
                            const hashZ1 = arrayAtI16(this.permutation, cellZ1);
                            let cellY1 = (cellY + 1) | 0;
                            if (periodY > cellY1) {
                                cellY1 &= 255;
                            } else {
                                cellY1 = 0;
                            }
                            py &= 4095;
                            const hashZ1Y1 = arrayAtI16(this.permutation, cellY1 + hashZ1);
                            pz &= 4095;
                            cellY &= 255;
                            const fadeZ = arrayAtI32(TextureOpPerlinNoise.fadeTable, pz); // a.b:[I
                            const hashZ1Y = arrayAtI16(this.permutation, cellY + hashZ1);
                            const hashZY = arrayAtI16(this.permutation, hashZ + cellY);
                            if (periodX <= cellX1) {
                                cellX1 = 0;
                            } else {
                                cellX1 &= 255;
                            }
                            const py1 = (py - 4096) | 0;
                            const fadeY = arrayAtI32(TextureOpPerlinNoise.fadeTable, py); // a.b:[I
                            const pz1 = (pz - 4096) | 0;
                            const hashZY1 = arrayAtI16(this.permutation, hashZ + cellY1);
                            let g0 = Noise3D.gradient(px, pz, py, arrayAtI16(this.permutation, hashZY + cellX));
                            let g1 = Noise3D.gradient(px1, pz, py, arrayAtI16(this.permutation, cellX1 + hashZY));
                            let lerpX0 = (g0 + (Math.imul(fadeX, g1 - g0) >> 12)) | 0;
                            g0 = Noise3D.gradient(px, pz, py1, arrayAtI16(this.permutation, hashZY1 + cellX));
                            g1 = Noise3D.gradient(px1, pz, py1, arrayAtI16(this.permutation, cellX1 + hashZY1));
                            let lerpX1 = (g0 + (Math.imul(fadeX, g1 - g0) >> 12)) | 0;
                            const lerpY0 = ((Math.imul(lerpX1 - lerpX0, fadeY) >> 12) + lerpX0) | 0;
                            g0 = Noise3D.gradient(px, pz1, py, arrayAtI16(this.permutation, cellX + hashZ1Y));
                            g1 = Noise3D.gradient(px1, pz1, py, arrayAtI16(this.permutation, cellX1 + hashZ1Y));
                            lerpX0 = ((Math.imul(fadeX, g1 - g0) >> 12) + g0) | 0;
                            g0 = Noise3D.gradient(px, pz1, py1, arrayAtI16(this.permutation, cellX + hashZ1Y1));
                            g1 = Noise3D.gradient(px1, pz1, py1, arrayAtI16(this.permutation, cellX1 + hashZ1Y1));
                            lerpX1 = (g0 + (Math.imul(g1 - g0, fadeX) >> 12)) | 0;
                            const lerpY1 = (lerpX0 + (Math.imul(lerpX1 - lerpX0, fadeY) >> 12)) | 0;
                            this.addOctave(((Math.imul(lerpY1 - lerpY0, fadeZ) >> 12) + lerpY0) | 0, octave);
                        }
                        this.emitSample();
                    }
                }
            }
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'wf.M(' + guard + ',' + sizeX + ',' + sizeZ + ',' + sizeY + ')');
        }
    }

    // wf.a(B)V. Called once per sample, after its last octave.
    abstract emitSample(): void;

    // wf.b(B)V
    private initFrequencies(): void {
        this.frequencies = new Int16Array(this.octaves);
        for (let i = 0; i < this.octaves; i++) {
            arrayPutI16(this.frequencies, i, (doubleToInt(Math.pow(2.0, i)) << 16) >> 16);
        }
    }

    // wf.a(I)V. Called once per volume, before the first sample.
    abstract reset(): void;

    // wf.c(I)V. Entry 255 keeps its initial 0, as in the Java loop bounds.
    private initPermutation(): void {
        const random = new JavaRandom(BigInt(this.seed));
        for (let i = 0; i < 255; i++) {
            arrayPutI16(this.permutation, i, (i << 16) >> 16);
        }
        for (let i = 0; i < 255; i++) {
            const end = (255 - i) | 0;
            const other = TextureOp.nextInt(random, end); // ni.a(BILjava/util/Random;)I
            const value = arrayAtI16(this.permutation, other);
            arrayPutI16(this.permutation, other, arrayAtI16(this.permutation, end));
            arrayPutI16(this.permutation, (256 + end) | 0, value);
            arrayPutI16(this.permutation, end, value);
        }
    }

    // wf.a(III)V. Called once per octave of each sample, with the octave's fixed-point noise value.
    abstract addOctave(value: number, octave: number): void;

    // se.a(IIIIZ)I, relocated by the obfuscator into se (WorldMapLabels) and unassigned in membermap-hd.json. Its only
    // callers are the eight samples of wf.a(IIII)V, which all pass true, so the constant boolean and its
    // `return 127` guard are stripped (the one false call sits in a stripped dummy guard of se.c(II)Z). The se.w
    // invocation counter is stripped too. The parameters are named for their arguments in wf.a(IIII)V.
    static gradient(dx: number, dz: number, dy: number, hash: number): number {
        const h = hash & 15;
        const v = h < 4 ? dy : h === 12 || h === 14 ? dx : dz;
        const u = h < 8 ? dx : dy;
        return (((h & 1) === 0 ? u : -u | 0) + ((h & 2) === 0 ? v : -v | 0)) | 0;
    }
}
