import type PacketT from '#/io/PacketT';
import ArrayUtils from '#/util/ArrayUtils';
import { arrayAtI32, arrayAtObj, arrayPutI32, requireNonNull } from '#/util/JavaArray';
import { doubleToInt, intDivide } from '#/util/IntUtils';
import JavaRandom from '#/util/JavaRandom';
import Envelope from './Envelope';
import Filter from './Filter';

// (int) ((long) a * b >> 16), retaining the low 32 bits.
function multiplyShift16(a: number, b: number): number {
    return (Math.imul(a >> 16, b) + Math.imul(a & 65535, b >> 16) + (((a & 65535) * (b & 65535)) >>> 16)) | 0;
}

export default class Tone {
    // fj.a:Leb;
    private attack: Envelope | null = null;
    // fj.b:Lub;
    private filter: Filter | null = null;
    // fj.c:[I
    private volumes: Int32Array;
    // fj.d:Leb;
    private volumeModAmount: Envelope | null = null;
    // fj.e:I
    private delay = 0;
    // fj.f:[I
    private static sine: Int32Array | null;
    // fj.g:I
    duration: number;
    // fj.h:Leb;
    private pitch: Envelope | null = null;
    // fj.i:I
    private decay: number;
    // fj.j:Leb;
    private release: Envelope | null = null;
    // fj.k:[I
    private static noise: Int32Array | null = new Int32Array(32768);
    // fj.l:Leb;
    private pitchModAmount: Envelope | null = null;
    // fj.m:I
    start: number;
    // fj.n:Leb;
    private filterEnvelope: Envelope | null = null;
    // fj.o:Leb;
    private volumeMod: Envelope | null = null;
    // fj.p:[I
    private delays: Int32Array;
    // fj.q:[I
    private pitches: Int32Array;
    // fj.r:Leb;
    private pitchMod: Envelope | null = null;
    // fj.s:Leb;
    private volume: Envelope | null = null;
    // fj.t:[I
    private static samples: Int32Array | null;
    // fj.u:[I
    private static pitchSteps: Int32Array | null;
    // fj.v:[I
    private static phases: Int32Array | null;
    // fj.w:[I
    private static offsets: Int32Array | null;
    // fj.x:[I
    private static pitchStarts: Int32Array | null;
    // fj.y:[I
    private static gains: Int32Array | null;

    // fj.<clinit>()V
    static {
        const random = new JavaRandom(0n);
        for (let i = 0; i < 32768; i++) arrayPutI32(this.noise, i, (random.nextInt() & 2) - 1);
        this.sine = new Int32Array(32768);
        for (let i = 0; i < 32768; i++) this.sine[i] = doubleToInt(Math.sin(i / 5215.1903) * 16384);
        this.samples = new Int32Array(220500);
        this.offsets = new Int32Array(5);
        this.pitchSteps = new Int32Array(5);
        this.phases = new Int32Array(5);
        this.pitchStarts = new Int32Array(5);
        this.gains = new Int32Array(5);
    }
    // fj.<init>()V
    constructor() {
        this.volumes = new Int32Array(5);
        this.duration = 500;
        this.decay = 100;
        this.delays = new Int32Array(5);
        this.start = 0;
        this.pitches = new Int32Array(5);
    }
    // fj.a()V
    static clear(): void {
        this.samples = null;
        this.noise = null;
        this.sine = null;
        this.phases = null;
        this.offsets = null;
        this.gains = null;
        this.pitchSteps = null;
        this.pitchStarts = null;
    }
    // fj.a(III)I
    private wave(phase: number, amplitude: number, form: number): number {
        if (form === 1) return (phase & 32767) < 16384 ? amplitude : -amplitude | 0;
        if (form === 2) return Math.imul(arrayAtI32(Tone.sine, phase & 32767), amplitude) >> 14;
        if (form === 3) return ((Math.imul(phase & 32767, amplitude) >> 14) - amplitude) | 0;
        return form === 4 ? Math.imul(arrayAtI32(Tone.noise, intDivide(phase, 2607) & 32767), amplitude) : 0;
    }
    // fj.a(II)[I
    generate(count: number, ms: number): Int32Array | null {
        const buffer = Tone.samples;
        ArrayUtils.clearInts(buffer, 0, count);
        if (ms < 10) return buffer;
        const scale = count / ms,
            pitch = requireNonNull(this.pitch);
        pitch.GenInit();
        const volume = requireNonNull(this.volume);
        volume.GenInit();
        let pitchModStep = 0,
            pitchModStart = 0,
            pitchModPhase = 0;
        if (this.pitchMod !== null) {
            this.pitchMod.GenInit();
            requireNonNull(this.pitchModAmount).GenInit();
            pitchModStep = doubleToInt((((this.pitchMod.end - this.pitchMod.start) | 0) * 32.768) / scale);
            pitchModStart = doubleToInt((this.pitchMod.start * 32.768) / scale);
        }
        let volumeModStep = 0,
            volumeModStart = 0,
            volumeModPhase = 0;
        if (this.volumeMod !== null) {
            this.volumeMod.GenInit();
            requireNonNull(this.volumeModAmount).GenInit();
            volumeModStep = doubleToInt((((this.volumeMod.end - this.volumeMod.start) | 0) * 32.768) / scale);
            volumeModStart = doubleToInt((this.volumeMod.start * 32.768) / scale);
        }
        for (let j = 0; j < 5; j++)
            if (this.volumes[j] !== 0) {
                arrayPutI32(Tone.phases, j, 0);
                arrayPutI32(Tone.offsets, j, doubleToInt(this.delays[j] * scale));
                arrayPutI32(Tone.gains, j, intDivide(this.volumes[j] << 14, 100));
                arrayPutI32(Tone.pitchSteps, j, doubleToInt((((pitch.end - pitch.start) | 0) * 32.768 * Math.pow(1.0057929410678534, this.pitches[j])) / scale));
                arrayPutI32(Tone.pitchStarts, j, doubleToInt((pitch.start * 32.768) / scale));
            }
        for (let i = 0; i < count; i++) {
            let hz = pitch.GenNext(count),
                amp = volume.GenNext(count);
            if (this.pitchMod !== null) {
                const rate = this.pitchMod.GenNext(count),
                    depth = requireNonNull(this.pitchModAmount).GenNext(count);
                hz = (hz + (this.wave(pitchModPhase, depth, this.pitchMod.form) >> 1)) | 0;
                pitchModPhase = (pitchModPhase + (Math.imul(rate, pitchModStep) >> 16) + pitchModStart) | 0;
            }
            if (this.volumeMod !== null) {
                const rate = this.volumeMod.GenNext(count),
                    depth = requireNonNull(this.volumeModAmount).GenNext(count);
                amp = Math.imul(amp, (this.wave(volumeModPhase, depth, this.volumeMod.form) >> 1) + 32768) >> 15;
                volumeModPhase = (volumeModPhase + (Math.imul(rate, volumeModStep) >> 16) + volumeModStart) | 0;
            }
            for (let j = 0; j < 5; j++)
                if (this.volumes[j] !== 0) {
                    const out = (i + arrayAtI32(Tone.offsets, j)) | 0;
                    if (out < count) {
                        const phase = arrayAtI32(Tone.phases, j);
                        arrayPutI32(buffer, out, arrayAtI32(buffer, out) + this.wave(phase, Math.imul(amp, arrayAtI32(Tone.gains, j)) >> 15, pitch.form));
                        arrayPutI32(Tone.phases, j, phase + (Math.imul(hz, arrayAtI32(Tone.pitchSteps, j)) >> 16) + arrayAtI32(Tone.pitchStarts, j));
                    }
                }
        }
        if (this.release !== null) {
            this.release.GenInit();
            const attack = requireNonNull(this.attack);
            attack.GenInit();
            let ticks = 0,
                mute = true;
            for (let i = 0; i < count; i++) {
                const r = this.release.GenNext(count),
                    a = attack.GenNext(count);
                const threshold = (this.release.start + (Math.imul(this.release.end - this.release.start, mute ? r : a) >> 8)) | 0;
                ticks = (ticks + 256) | 0;
                if (ticks >= threshold) {
                    ticks = 0;
                    mute = !mute;
                }
                if (mute) arrayPutI32(buffer, i, 0);
            }
        }
        if (this.delay > 0 && this.decay > 0) {
            const delay = doubleToInt(this.delay * scale);
            for (let i = delay; i < count; i++) arrayPutI32(buffer, i, arrayAtI32(buffer, i) + intDivide(Math.imul(arrayAtI32(buffer, i - delay), this.decay), 100));
        }
        const filter = requireNonNull(this.filter);
        if (filter.pairs[0] > 0 || filter.pairs[1] > 0) {
            const envelope = requireNonNull(this.filterEnvelope);
            envelope.GenInit();
            let env = envelope.GenNext((count + 1) | 0),
                feed = filter.compute(0, Math.fround(env) / 65536),
                back = filter.compute(1, Math.fround(env) / 65536);
            if (count >= feed + back) {
                let i = 0,
                    stop = Math.min(back, count - feed);
                while (i < stop) {
                    let value = multiplyShift16(arrayAtI32(buffer, i + feed), Filter.gain);
                    for (let j = 0; j < feed; j++) value = (value + multiplyShift16(arrayAtI32(buffer, i + feed - 1 - j), arrayAtObj(Filter.coefficients, 0)[j])) | 0;
                    for (let j = 0; j < i; j++) value = (value - multiplyShift16(arrayAtI32(buffer, i - 1 - j), arrayAtObj(Filter.coefficients, 1)[j])) | 0;
                    arrayPutI32(buffer, i++, value);
                    env = envelope.GenNext((count + 1) | 0);
                }
                stop = 128;
                for (;;) {
                    stop = Math.min(stop, count - feed);
                    while (i < stop) {
                        let value = multiplyShift16(arrayAtI32(buffer, i + feed), Filter.gain);
                        for (let j = 0; j < feed; j++) value = (value + multiplyShift16(arrayAtI32(buffer, i + feed - 1 - j), arrayAtObj(Filter.coefficients, 0)[j])) | 0;
                        for (let j = 0; j < back; j++) value = (value - multiplyShift16(arrayAtI32(buffer, i - 1 - j), arrayAtObj(Filter.coefficients, 1)[j])) | 0;
                        arrayPutI32(buffer, i++, value);
                        env = envelope.GenNext((count + 1) | 0);
                    }
                    if (i >= count - feed) {
                        while (i < count) {
                            let value = 0;
                            for (let j = i + feed - count; j < feed; j++) value = (value + multiplyShift16(arrayAtI32(buffer, i + feed - 1 - j), arrayAtObj(Filter.coefficients, 0)[j])) | 0;
                            for (let j = 0; j < back; j++) value = (value - multiplyShift16(arrayAtI32(buffer, i - 1 - j), arrayAtObj(Filter.coefficients, 1)[j])) | 0;
                            arrayPutI32(buffer, i++, value);
                            env = envelope.GenNext((count + 1) | 0);
                        }
                        break;
                    }
                    feed = filter.compute(0, Math.fround(env) / 65536);
                    back = filter.compute(1, Math.fround(env) / 65536);
                    stop += 128;
                }
            }
        }
        for (let i = 0; i < count; i++) arrayPutI32(buffer, i, Math.max(-32768, Math.min(32767, arrayAtI32(buffer, i))));
        return buffer;
    }
    // fj.a(Lgd;)V
    decode(p: PacketT): void {
        this.pitch = new Envelope();
        this.pitch.Load(p);
        this.volume = new Envelope();
        this.volume.Load(p);
        if (p.g1() !== 0) {
            p.m_pos--;
            this.pitchMod = new Envelope();
            this.pitchMod.Load(p);
            this.pitchModAmount = new Envelope();
            this.pitchModAmount.Load(p);
        }
        if (p.g1() !== 0) {
            p.m_pos--;
            this.volumeMod = new Envelope();
            this.volumeMod.Load(p);
            this.volumeModAmount = new Envelope();
            this.volumeModAmount.Load(p);
        }
        if (p.g1() !== 0) {
            p.m_pos--;
            this.release = new Envelope();
            this.release.Load(p);
            this.attack = new Envelope();
            this.attack.Load(p);
        }
        for (let i = 0; i < 10; i++) {
            const v = p.gSmart1or2();
            if (v === 0) break;
            arrayPutI32(this.volumes, i, v);
            arrayPutI32(this.pitches, i, p.gSmart1or2s());
            arrayPutI32(this.delays, i, p.gSmart1or2());
        }
        this.delay = p.gSmart1or2();
        this.decay = p.gSmart1or2();
        this.duration = p.g2();
        this.start = p.g2();
        this.filter = new Filter();
        this.filterEnvelope = new Envelope();
        this.filter.decode(p, this.filterEnvelope);
    }
}
