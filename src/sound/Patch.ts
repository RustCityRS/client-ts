import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import type Js5 from '#/cache/Js5';
import Linkable from '#/datastruct/Linkable';
import PacketT from '#/io/PacketT';
import { byteAt } from '#/io/JavaByteArray';
import { arrayAtI32, arrayAtI8, arrayAtObj, arrayPutI32, arrayPutI8, arrayPutObj, requireNonNull } from '#/util/JavaArray';
import { intDivide } from '#/util/IntUtils';
import type Wave from './Wave';
import type WaveCache from './WaveCache';
import EnvelopeSet from './EnvelopeSet';
import { loadClient, loadIfType } from '#/util/GamepackClasses';

// f.a(BII)I
function divideFloor(value: number, divisor: number): number {
    const sign = value >>> 31;
    return (intDivide((value + sign) | 0, divisor) - sign) | 0;
}
export default class Patch extends Linkable {
    // HD jk.a(Z)V
    static releasePatchStatics(guard: boolean): void {
        try {
            const Client = loadClient();
            releaseReferences(Client, 'tweenCommand');
            if (!guard) {
                return;
            }
            const IfType = loadIfType();
            releaseReferences(IfType, 'm_modelCache');
            releaseReferences(Client, 'stream');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'jk.D(' + guard + ')');
        }
    }

    // vk.a(ILal;I)Ltg;
    static Load(id: number, archive: Js5 | null): Patch | null {
        const bytes = requireNonNull(archive).GetFile2(id);
        return bytes === null ? null : new Patch(bytes);
    }
    // tg.q:[Luf;
    params: (EnvelopeSet | null)[] | null = null;
    // tg.t:[B
    gains: Int8Array | null = null;
    // tg.w:[I
    sampleIds: Int32Array | null = null;
    // tg.A:[B
    groups: Int8Array | null = null;
    // tg.D:[Lji;
    sounds: (Wave | null)[] | null = null;
    // tg.F:[B
    pans: Int8Array | null = null;
    // tg.I:I
    volume = 0;
    // tg.K:[S
    pitches: Int16Array | null = null;
    // tg.a(Lll;[IB[B)Z
    LoadWaves(cache: WaveCache, budget: Int32Array | null, mask: Uint8Array | null): boolean {
        let complete = true,
            last = 0,
            sound: Wave | null = null;
        for (let i = 0; i < 128; i++) {
            if (mask !== null && byteAt(mask, i) === 0) continue;
            const id = arrayAtI32(this.sampleIds, i);
            if (id === 0) continue;
            if (id !== last) {
                last = id;
                const coded = (id - 1) | 0;
                sound = (coded & 1) === 0 ? cache.GetJagFx(coded >> 2, budget) : cache.GetJagVorbis(coded >> 2, budget);
                if (sound === null) complete = false;
            }
            if (sound !== null) {
                arrayPutObj(this.sounds, i, sound);
                arrayPutI32(this.sampleIds, i, 0);
            }
        }
        return complete;
    }
    // tg.a(I)V
    DropWaveIds(): void {
        this.sampleIds = null;
    }
    // tg.<init>()V and tg.<init>([B)V
    constructor(data?: Uint8Array | null) {
        super();
        if (data === undefined) return;
        this.pans = new Int8Array(128);
        this.pitches = new Int16Array(128);
        this.sounds = new Array(128).fill(null);
        this.params = new Array(128).fill(null);
        this.sampleIds = new Int32Array(128);
        this.gains = new Int8Array(128);
        this.groups = new Int8Array(128);
        const p = new PacketT(data);
        const readRuns = () => {
            let length = 0;
            while (byteAt(p.m_data, (p.m_pos + length) | 0) !== 0) length++;
            const bytes = new Int8Array(length);
            for (let i = 0; i < length; i++) bytes[i] = p.g1s();
            p.m_pos = (p.m_pos + 1) | 0;
            return bytes;
        };
        const groups = readRuns();
        let groupValues = p.m_pos;
        p.m_pos = (p.m_pos + groups.length + 1) | 0;
        const pans = readRuns();
        let panValues = p.m_pos;
        p.m_pos = (p.m_pos + pans.length + 1) | 0;
        const envelopes = readRuns(),
            mapping = new Int8Array(envelopes.length + 1);
        let count: number;
        if (mapping.length <= 1) count = mapping.length;
        else {
            count = 2;
            mapping[1] = 1;
            let prev = 1;
            for (let i = 2; i < mapping.length; i++) {
                let index = p.g1();
                if (index === 0) prev = count++;
                else {
                    if (index <= prev) index--;
                    prev = index;
                }
                mapping[i] = prev;
            }
        }
        const definitions = new Array<EnvelopeSet>(count);
        for (let i = 0; i < count; i++) {
            const def = (definitions[i] = new EnvelopeSet());
            let n = p.g1();
            if (n > 0) def.volumeEnvelope = new Int8Array(n * 2);
            n = p.g1();
            if (n > 0) {
                def.releaseEnvelope = new Int8Array(2 * n + 2);
                def.releaseEnvelope[1] = 64;
            }
        }
        let size = p.g1();
        const gainCurve = size > 0 ? new Int8Array(2 * size) : null;
        size = p.g1();
        const panCurve = size > 0 ? new Int8Array(2 * size) : null;
        const sampleRuns = readRuns();
        let value = 0;
        for (let i = 0; i < 128; i++) {
            value += p.g1();
            this.pitches[i] = value;
        }
        value = 0;
        for (let i = 0; i < 128; i++) {
            value += p.g1();
            this.pitches[i] += value << 8;
        }
        let run = 0,
            id = 0,
            idx = 0;
        for (let i = 0; i < 128; i++) {
            if (run === 0) {
                run = idx < sampleRuns.length ? sampleRuns[idx++] : -1;
                id = p.gMidiVarLen();
            }
            this.pitches[i] += ((id - 1) & 2) << 14;
            run--;
            this.sampleIds[i] = id;
        }
        run = 0;
        value = 0;
        idx = 0;
        for (let i = 0; i < 128; i++)
            if (this.sampleIds[i] !== 0) {
                if (run === 0) {
                    run = idx < groups.length ? groups[idx++] : -1;
                    value = ((byteAt(p.m_data, groupValues++) << 24) >> 24) - 1;
                }
                this.groups[i] = value;
                run--;
            }
        run = 0;
        value = 0;
        idx = 0;
        for (let i = 0; i < 128; i++)
            if (this.sampleIds[i] !== 0) {
                if (run === 0) {
                    value = (16 + ((byteAt(p.m_data, panValues++) << 24) >> 24)) << 2;
                    run = idx < pans.length ? pans[idx++] : -1;
                }
                run--;
                this.pans[i] = value;
            }
        let def: EnvelopeSet | null = null;
        run = 0;
        idx = 0;
        for (let i = 0; i < 128; i++)
            if (this.sampleIds[i] !== 0) {
                if (run === 0) {
                    def = arrayAtObj(definitions, arrayAtI8(mapping, idx));
                    run = idx < envelopes.length ? envelopes[idx++] : -1;
                }
                run--;
                this.params[i] = def;
            }
        run = 0;
        value = 0;
        idx = 0;
        for (let i = 0; i < 128; i++) {
            if (run === 0) {
                run = idx < sampleRuns.length ? sampleRuns[idx++] : -1;
                if (this.sampleIds[i] > 0) value = 1 + p.g1();
            }
            run--;
            this.gains[i] = value;
        }
        this.volume = 1 + p.g1();
        for (const def of definitions) {
            const v = def.volumeEnvelope,
                r = def.releaseEnvelope;
            if (v !== null) for (let j = 1; j < v.length; j += 2) v[j] = p.g1s();
            if (r !== null) for (let j = 3; j < r.length - 2; j += 2) r[j] = p.g1s();
        }
        if (gainCurve !== null) for (let j = 1; j < gainCurve.length; j += 2) gainCurve[j] = p.g1s();
        if (panCurve !== null) for (let j = 1; j < panCurve.length; j += 2) panCurve[j] = p.g1s();
        for (const def of definitions)
            if (def.releaseEnvelope !== null) {
                value = 0;
                for (let j = 2; j < def.releaseEnvelope.length; j += 2) {
                    value += 1 + p.g1();
                    def.releaseEnvelope[j] = value;
                }
            }
        for (const def of definitions)
            if (def.volumeEnvelope !== null) {
                value = 0;
                for (let j = 2; j < def.volumeEnvelope.length; j += 2) {
                    value += 1 + p.g1();
                    def.volumeEnvelope[j] = value;
                }
            }
        if (gainCurve !== null) {
            value = p.g1();
            gainCurve[0] = value;
            for (let i = 2; i < gainCurve.length; i += 2) {
                value += 1 + p.g1();
                gainCurve[i] = value;
            }
            let from = gainCurve[0],
                gain = gainCurve[1];
            for (let key = 0; key < from; key++) arrayPutI8(this.gains, key, (arrayAtI8(this.gains, key) * gain + 32) >> 6);
            for (let i = 2; i < gainCurve.length; i += 2) {
                const to = gainCurve[i],
                    next = gainCurve[i + 1];
                let sum = intDivide(to - from, 2) + gain * (to - from);
                for (let key = from; key < to; key++) {
                    const scale = divideFloor(sum, to - from);
                    arrayPutI8(this.gains, key, (arrayAtI8(this.gains, key) * scale + 32) >> 6);
                    sum += next - gain;
                }
                from = to;
                gain = next;
            }
            for (let key = from; key < 128; key++) arrayPutI8(this.gains, key, (gain * arrayAtI8(this.gains, key) + 32) >> 6);
        }
        if (panCurve !== null) {
            value = p.g1();
            panCurve[0] = value;
            for (let i = 2; i < panCurve.length; i += 2) {
                value += 1 + p.g1();
                panCurve[i] = value;
            }
            let from = panCurve[0],
                pan = panCurve[1] << 1;
            for (let key = 0; key < from; key++) arrayPutI8(this.pans, key, Math.min(128, Math.max(0, pan + (arrayAtI8(this.pans, key) & 255))));
            for (let i = 2; i < panCurve.length; i += 2) {
                const to = panCurve[i],
                    next = panCurve[i + 1] << 1;
                let sum = intDivide(to - from, 2) + (to - from) * pan;
                for (let key = from; key < to; key++) {
                    const offset = divideFloor(sum, to - from),
                        value = offset + (arrayAtI8(this.pans, key) & 255);
                    sum += next - pan;
                    arrayPutI8(this.pans, key, Math.min(128, Math.max(0, value)));
                }
                from = to;
                pan = next;
            }
            for (let key = from; key < 128; key++) arrayPutI8(this.pans, key, Math.min(128, Math.max(0, (arrayAtI8(this.pans, key) & 255) + pan)));
        }
        for (const def of definitions) def.decay = p.g1();
        for (const def of definitions) {
            if (def.volumeEnvelope !== null) def.volumeKeyScale = p.g1();
            if (def.releaseEnvelope !== null) def.releaseKeyScale = p.g1();
            if (def.decay > 0) def.decayKeyScale = p.g1();
        }
        for (const def of definitions) def.vibratoRate = p.g1();
        for (const def of definitions) if (def.vibratoRate > 0) def.vibratoDepth = p.g1();
        for (const def of definitions) if (def.vibratoDepth > 0) def.vibratoDelay = p.g1();
    }
}
