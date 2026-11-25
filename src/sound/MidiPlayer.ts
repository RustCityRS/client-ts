import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import type Js5 from '#/cache/Js5';
import HashTable from '#/datastruct/HashTable';
import { arrayAtI16, arrayAtI32, arrayAtI8, arrayAtObj, arrayPutI32, arrayPutObj, requireNonNull } from '#/util/JavaArray';
import { intDivide, doubleToInt } from '#/util/IntUtils';
import MidiParser from './MidiParser';
import Patch from './Patch';
import MidiNote from './MidiNote';
import MidiMixer from './MidiMixer';
import type MidiFile from './MidiFile';
import PCMPlayer from './PCMPlayer';
import PCMStream from './PCMStream';
import WaveStream from './WaveStream';
import type WaveCache from './WaveCache';
import { loadLocalisedText, loadWorldMap } from '#/util/GamepackClasses';

export default class MidiPlayer extends PCMStream {
    // HD va.e(B)V
    static releaseMidiPlayerStatics(guard: number): void {
        try {
            const WorldMap = loadWorldMap();
            releaseReferences(WorldMap, 'disabled');
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'germanCreatedGameworld');
            intDivide(21, intDivide((guard + 51) | 0, 62));
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'va.C(' + guard + ')');
        }
    }

    // ng.v:[I
    private readonly programs = new Int32Array(16);
    // ng.x:[I
    private readonly volumes = new Int32Array(16);
    // ng.z:[I
    private readonly parameters = new Int32Array(16);
    // ng.D:[I
    private readonly bends = new Int32Array(16);
    // ng.K:[I
    readonly retriggerSteps = new Int32Array(16);
    // ng.O:Lel;
    private readonly midi = new MidiParser();
    // ng.Q:[I
    private readonly initialPrograms = new Int32Array(16);
    // ng.X:[I
    private readonly portamento = new Int32Array(16);
    // ng.Y:[I
    private readonly retriggers = new Int32Array(16);
    // ng.bb:[I
    private readonly sensitivity = new Int32Array(16);
    // ng.cb:[[Lt;
    private readonly keys: (MidiNote | null)[][] = Array.from({ length: 16 }, () => new Array(128).fill(null));
    // ng.mb:I
    private m_globalVolume = 256;
    // ng.ob:[I
    readonly flags = new Int32Array(16);
    // ng.rb:[I
    private readonly pans = new Int32Array(16);
    // ng.tb:I
    private timeScale = 1000000;
    // ng.xb:[I
    readonly sampleOffsets = new Int32Array(16);
    // ng.yb:[I
    private readonly modulation = new Int32Array(16);
    // ng.Ab:[[Lt;
    private readonly heldGroups: (MidiNote | null)[][] = Array.from({ length: 16 }, () => new Array(128).fill(null));
    // ng.Cb:[I
    private readonly gains = new Int32Array(16);
    // ng.Eb:[I
    private readonly expression = new Int32Array(16);
    // ng.Gb:[I
    private readonly banks = new Int32Array(16);
    // ng.Hb:Lnc;
    private readonly patches = new HashTable<Patch>(128);
    // ng.Ib:Z
    private loop = false;
    // ng.Jb:Lef;
    private readonly patchStream = new MidiMixer(this);
    // ng.Kb:I
    private track = 0;
    // ng.Lb:I
    private tick = 0;
    // ng.Mb:J
    private nextTime = 0n;
    // ng.Nb:J
    private time = 0n;
    // ng.Ob:I
    private changeTick = 0;
    // ng.Pb:Z
    private stopForChange = false;
    // ng.Qb:Lee;
    private queued: MidiFile | null = null;
    // ng.<init>()V
    constructor() {
        super();
        this.setGain(256, -1);
        this.Reset2(true);
    }
    // ng.a(ZZ)V
    private clear(stop: boolean): void {
        this.midi.DropMidi();
        this.queued = null;
        this.Reset2(stop);
    }
    // ng.d(B)V
    QueueDropWaveIds(): void {
        for (let p = this.patches.head(); p !== null; p = this.patches.next()) p.DropWaveIds();
    }
    // ng.a(IIII)V
    private PlayNote2(note: number, ch: number, velocity: number): void {
        this.StopNote2(64, ch, note);
        if ((arrayAtI32(this.flags, ch) & 2) !== 0) {
            for (let v = this.patchStream.voices.tail(); v !== null; v = this.patchStream.voices.prev()) {
                if (ch === v.channel && v.releaseTime < 0) {
                    const row = arrayAtObj(this.keys, ch);
                    arrayPutObj(row, v.note, null);
                    arrayPutObj(row, note, v);
                    const old = (v.pitch + (Math.imul(v.glide, v.pitchDelta) >> 12)) | 0;
                    v.glide = 4096;
                    v.pitch = (v.pitch + ((note - v.note) << 8)) | 0;
                    v.pitchDelta = (old - v.pitch) | 0;
                    v.note = note;
                    return;
                }
            }
        }
        const patch = this.patches.get(BigInt(arrayAtI32(this.programs, ch)));
        if (patch === null) return;
        const sample = arrayAtObj(patch.sounds, note);
        if (sample === null) return;
        const v = new MidiNote();
        v.channel = ch;
        v.patch = patch;
        v.sample = sample;
        v.params = arrayAtObj(patch.params, note);
        v.group = arrayAtI8(patch.groups, note);
        v.note = note;
        v.gain = (Math.imul(Math.imul(Math.imul(patch.volume, velocity), velocity), arrayAtI8(patch.gains, note)) + 1024) >> 11;
        v.pan = arrayAtI8(patch.pans, note) & 255;
        v.pitch = (note << 8) - (arrayAtI16(patch.pitches, note) & 32767);
        v.volumeTime = 0;
        v.decayTime = 0;
        v.releaseTime = -1;
        v.volumeIndex = 0;
        v.releaseIndex = 0;
        if (arrayAtI32(this.sampleOffsets, ch) === 0) v.stream = WaveStream.NewRateRawFineVolPan(sample, this.GetRateRaw(v), this.GetVolume(v), this.GetPan(v));
        else {
            v.stream = WaveStream.NewRateRawFineVolPan(sample, this.GetRateRaw(v), 0, this.GetPan(v));
            this.SetSampleOffset(arrayAtI16(patch.pitches, note) < 0, v);
        }
        if (arrayAtI16(patch.pitches, note) < 0) requireNonNull(v.stream).SetLoopCount(-1);
        if (v.group >= 0) {
            const row = arrayAtObj(this.heldGroups, ch),
                old = arrayAtObj(row, v.group);
            if (old !== null && old.releaseTime < 0) {
                arrayPutObj(arrayAtObj(this.keys, ch), old.note, null);
                old.releaseTime = 0;
            }
            arrayPutObj(row, v.group, v);
        }
        this.patchStream.voices.push_back(v);
        arrayPutObj(arrayAtObj(this.keys, ch), note, v);
    }
    // ng.a(II)V
    private AllNotesOff2(ch: number): void {
        for (let v = this.patchStream.voices.head(); v !== null; v = this.patchStream.voices.next()) {
            if ((ch < 0 || ch === v.channel) && v.releaseTime < 0) {
                arrayPutObj(arrayAtObj(this.keys, v.channel), v.note, null);
                v.releaseTime = 0;
            }
        }
    }
    // ng.b(I)V
    QueueStopFile(): void {
        this.clear(true);
    }
    // ng.a(IZ)V
    private Reset2(stop: boolean): void {
        if (stop) this.AllSoundOff2(-1);
        else this.AllNotesOff2(-1);
        this.AllControllersOff2(-1);
        for (let i = 0; i < 16; i++) this.programs[i] = this.initialPrograms[i];
        for (let i = 0; i < 16; i++) this.banks[i] = this.initialPrograms[i] & -128;
    }
    // ng.a(III)V
    private SetRetrigRate(ch: number, value: number): void {
        arrayPutI32(this.retriggers, ch, value);
        arrayPutI32(this.retriggerSteps, ch, doubleToInt(Math.pow(2, value * Math.fround(5.493164e-4)) * 2097152 + 0.5));
    }
    // ng.a()Ljj;
    SubstreamStart(): PCMStream {
        return this.patchStream;
    }
    // ng.e(B)I
    GetGlobalVolume(): number {
        return this.m_globalVolume;
    }
    // ng.b(IZ)V
    private AllSoundOff2(ch: number): void {
        for (let v = this.patchStream.voices.head(); v !== null; v = this.patchStream.voices.next()) {
            if (ch >= 0 && ch !== v.channel) continue;
            if (v.stream !== null) {
                v.stream.RampOut(intDivide(PCMPlayer.m_frequency, 100));
                if (v.stream.Isramping()) this.patchStream.mixer.PlayStream(v.stream);
                v.DropData();
            }
            if (v.releaseTime < 0) arrayPutObj(arrayAtObj(this.keys, v.channel), v.note, null);
            v.Unlink();
        }
    }
    // ng.c(III)V
    private setGain(value: number, ch: number): void {
        if (ch < 0) this.gains.fill(value);
        else arrayPutI32(this.gains, ch, value);
    }
    // ng.a(I)V
    PretendToMix(count: number): void {
        if (this.midi.GotMidi()) {
            const unit = BigInt(intDivide(Math.imul(this.timeScale, this.midi.division), PCMPlayer.m_frequency));
            do {
                const end = BigInt.asIntN(64, this.time + unit * BigInt(count));
                if (BigInt.asIntN(64, this.nextTime - end) >= 0n) {
                    this.time = end;
                    break;
                }
                const n = Number(BigInt.asIntN(32, BigInt.asIntN(64, unit - 1n + this.nextTime - this.time) / unit));
                count = (count - n) | 0;
                this.time = BigInt.asIntN(64, this.time + BigInt(n) * unit);
                this.patchStream.PretendToMix(n);
                this.UpdateMidi();
            } while (this.midi.GotMidi());
        }
        this.patchStream.PretendToMix(count);
    }
    // ng.f(B)V
    private UpdateMidi(): void {
        let time = this.nextTime,
            track = this.track,
            tick = this.tick;
        if (this.queued !== null && this.changeTick === tick) {
            this.start(this.loop, this.stopForChange, this.queued);
            this.UpdateMidi();
            return;
        }
        while (tick === this.tick) {
            while (arrayAtI32(this.midi.ticks, track) === tick) {
                this.midi.SetTrack(track);
                const msg = this.midi.GetEvent(track);
                if (msg === 1) {
                    this.midi.FinishTrack();
                    this.midi.UnsetTrack(track);
                    if (this.midi.AllTracksFinished()) {
                        if (this.queued !== null) {
                            this.QueuePlayFile(this.queued, this.loop);
                            this.UpdateMidi();
                            return;
                        }
                        if (!this.loop || tick === 0) {
                            this.Reset2(true);
                            this.midi.DropMidi();
                            return;
                        }
                        this.midi.Restart(time);
                    }
                    break;
                }
                if ((msg & 128) !== 0) this.ProcessMidi2(msg);
                this.midi.ProcessDeltaTime(track);
                this.midi.UnsetTrack(track);
            }
            track = this.midi.NextTrackToPlay();
            tick = arrayAtI32(this.midi.ticks, track);
            time = this.midi.TimeFromTick(tick);
        }
        this.track = track;
        this.tick = tick;
        this.nextTime = time;
        if (this.queued !== null && tick > this.changeTick) {
            this.track = -1;
            this.tick = this.changeTick;
            this.nextTime = this.midi.TimeFromTick(this.tick);
        }
    }
    // ng.a(IBII)V
    private StopNote2(_velocity: number, ch: number, note: number): void {
        const row = arrayAtObj(this.keys, ch),
            v = arrayAtObj(row, note);
        if (v === null) return;
        arrayPutObj(row, note, null);
        if ((arrayAtI32(this.flags, ch) & 2) !== 0) {
            for (let other = this.patchStream.voices.head(); other !== null; other = this.patchStream.voices.next()) {
                if (other.channel === v.channel && other.releaseTime < 0 && other !== v) {
                    v.releaseTime = 0;
                    return;
                }
            }
        } else v.releaseTime = 0;
    }
    // ng.a(ZLt;I)V
    SetSampleOffset(loop: boolean, v: MidiNote): void {
        const sample = requireNonNull(v.sample),
            length = requireNonNull(sample.samples).length;
        const offset = BigInt(arrayAtI32(this.sampleOffsets, v.channel));
        let pos: number;
        if (loop && sample.pingPong) {
            const span = (length + length - sample.loopStart) | 0,
                end = length << 8;
            pos = Number(BigInt.asIntN(32, (offset * BigInt(span)) >> 6n));
            if (pos >= end) {
                requireNonNull(v.stream).SetReverse(true);
                pos = (end + end - 1 - pos) | 0;
            }
        } else pos = Number(BigInt.asIntN(32, (offset * BigInt(length)) >> 6n));
        requireNonNull(v.stream).SetPositionFine(pos);
    }
    // ng.d()I
    SelfMixCost(): number {
        return 0;
    }
    // ng.c(Z)V
    QueueDropPatches(): void {
        for (let p = this.patches.head(); p !== null; p = this.patches.next()) p.Unlink();
    }
    // ng.b(II)V
    QueueSetGlobalVolume(value: number): void {
        this.m_globalVolume = value;
    }
    // ng.a(ILt;)Z
    UpdateStreamlessNote(v: MidiNote): boolean {
        if (v.stream !== null) return false;
        if (v.releaseTime >= 0) {
            v.Unlink();
            if (v.group > 0 && arrayAtObj(arrayAtObj(this.heldGroups, v.channel), v.group) === v) this.heldGroups[v.channel][v.group] = null;
        }
        return true;
    }
    // ng.b([III)V
    DoMix(out: Int32Array | null, offset: number, count: number): void {
        if (this.midi.GotMidi()) {
            const unit = BigInt(intDivide(Math.imul(this.midi.division, this.timeScale), PCMPlayer.m_frequency));
            do {
                const end = BigInt.asIntN(64, this.time + unit * BigInt(count));
                if (BigInt.asIntN(64, this.nextTime - end) >= 0n) {
                    this.time = end;
                    break;
                }
                const n = Number(BigInt.asIntN(32, BigInt.asIntN(64, unit - this.time + this.nextTime - 1n) / unit));
                this.time = BigInt.asIntN(64, this.time + BigInt(n) * unit);
                count = (count - n) | 0;
                this.patchStream.DoMix(out, offset, n);
                offset = (offset + n) | 0;
                this.UpdateMidi();
            } while (this.midi.GotMidi());
        }
        this.patchStream.DoMix(out, offset, count);
    }
    // ng.a(ILee;Z)V
    QueuePlayFile(track: MidiFile | null, loop: boolean): void {
        this.start(loop, true, track);
    }
    // ng.c(II)V
    private AllControllersOff2(ch: number): void {
        if (ch < 0) {
            for (let i = 0; i < 16; i++) this.AllControllersOff2(i);
            return;
        }
        arrayPutI32(this.volumes, ch, 12800);
        this.pans[ch] = 8192;
        this.expression[ch] = 16383;
        this.bends[ch] = 8192;
        this.modulation[ch] = 0;
        this.portamento[ch] = 8192;
        this.CleanPorta(ch);
        this.CleanRetrig(ch);
        this.flags[ch] = 0;
        this.parameters[ch] = 32767;
        this.sensitivity[ch] = 256;
        this.sampleOffsets[ch] = 0;
        this.SetRetrigRate(ch, 8192);
    }
    // ng.b()Ljj;
    SubstreamNext(): null {
        return null;
    }
    // ng.b(ILt;)I
    private GetRateRaw(v: MidiNote): number {
        let pitch = ((Math.imul(v.glide, v.pitchDelta) >> 12) + v.pitch) | 0;
        pitch = (pitch + (Math.imul(arrayAtI32(this.sensitivity, v.channel), arrayAtI32(this.bends, v.channel) - 8192) >> 12)) | 0;
        const p = requireNonNull(v.params);
        if (p.vibratoRate > 0 && (p.vibratoDepth > 0 || arrayAtI32(this.modulation, v.channel) > 0)) {
            const delay = p.vibratoDelay << 1;
            let depth = p.vibratoDepth << 2;
            if (v.age < delay) depth = intDivide(Math.imul(v.age, depth), delay);
            depth = (depth + (arrayAtI32(this.modulation, v.channel) >> 7)) | 0;
            pitch = (pitch + doubleToInt(depth * Math.sin(0.01227184630308513 * (511 & v.vibratoPhase)))) | 0;
        }
        return Math.max(1, doubleToInt(0.5 + (Math.imul(requireNonNull(v.sample).rate, 256) * Math.pow(2, 3.255208333333333e-4 * pitch)) / PCMPlayer.m_frequency));
    }
    // ng.g(B)Z
    IsPlayingFile(): boolean {
        return this.midi.GotMidi();
    }
    // ng.c(IZ)V
    private CleanPorta(ch: number): void {
        if ((arrayAtI32(this.flags, ch) & 2) !== 0)
            for (let v = this.patchStream.voices.head(); v !== null; v = this.patchStream.voices.next()) {
                if (v.channel === ch && arrayAtObj(arrayAtObj(this.keys, ch), v.note) === null && v.releaseTime < 0) v.releaseTime = 0;
            }
    }
    // ng.d(II)V
    private ProcessMidi2(packed: number): void {
        const ch = packed & 15,
            key = (packed >> 8) & 127,
            value = (packed >> 16) & 127;
        switch (packed & 240) {
            case 128:
                this.StopNote2(value, ch, key);
                break;
            case 144:
                if (value > 0) this.PlayNote2(key, ch, value);
                else this.StopNote2(64, ch, key);
                break;
            case 160:
                this.AfterTouch2(ch, key, value);
                break;
            case 176:
                switch (key) {
                    case 0:
                        this.banks[ch] = (this.banks[ch] & -2080769) | (value << 14);
                        break;
                    case 32:
                        this.banks[ch] = (this.banks[ch] & -16257) | (value << 7);
                        break;
                    case 1:
                        this.modulation[ch] = (this.modulation[ch] & -16257) | (value << 7);
                        break;
                    case 33:
                        this.modulation[ch] = (this.modulation[ch] & -128) | value;
                        break;
                    case 5:
                        this.portamento[ch] = (this.portamento[ch] & -16257) | (value << 7);
                        break;
                    case 37:
                        this.portamento[ch] = (this.portamento[ch] & -128) | value;
                        break;
                    case 7:
                        this.volumes[ch] = (this.volumes[ch] & -16257) | (value << 7);
                        break;
                    case 39:
                        this.volumes[ch] = (this.volumes[ch] & -128) | value;
                        break;
                    case 10:
                        this.pans[ch] = (this.pans[ch] & -16257) | (value << 7);
                        break;
                    case 42:
                        this.pans[ch] = (this.pans[ch] & -128) | value;
                        break;
                    case 11:
                        this.expression[ch] = (this.expression[ch] & -16257) | (value << 7);
                        break;
                    case 43:
                        this.expression[ch] = (this.expression[ch] & -128) | value;
                        break;
                    case 64:
                        if (value < 64) this.flags[ch] &= -2;
                        else this.flags[ch] |= 1;
                        break;
                    case 65:
                        if (value >= 64) this.flags[ch] |= 2;
                        else {
                            this.CleanPorta(ch);
                            this.flags[ch] &= -3;
                        }
                        break;
                    case 99:
                        this.parameters[ch] = (this.parameters[ch] & 127) | (value << 7);
                        break;
                    case 98:
                        this.parameters[ch] = (this.parameters[ch] & 16256) | value;
                        break;
                    case 101:
                        this.parameters[ch] = 16384 | (this.parameters[ch] & 127) | (value << 7);
                        break;
                    case 100:
                        this.parameters[ch] = 16384 | (this.parameters[ch] & 16256) | value;
                        break;
                    case 120:
                        this.AllSoundOff2(ch);
                        break;
                    case 121:
                        this.AllControllersOff2(ch);
                        break;
                    case 123:
                        this.AllNotesOff2(ch);
                        break;
                    case 6:
                        if (this.parameters[ch] === 16384) this.sensitivity[ch] = (this.sensitivity[ch] & -16257) | (value << 7);
                        break;
                    case 38:
                        if (this.parameters[ch] === 16384) this.sensitivity[ch] = (this.sensitivity[ch] & -128) | value;
                        break;
                    case 16:
                        this.sampleOffsets[ch] = (this.sampleOffsets[ch] & -16257) | (value << 7);
                        break;
                    case 48:
                        this.sampleOffsets[ch] = (this.sampleOffsets[ch] & -128) | value;
                        break;
                    case 81:
                        if (value >= 64) this.flags[ch] |= 4;
                        else {
                            this.CleanRetrig(ch);
                            this.flags[ch] &= -5;
                        }
                        break;
                    case 17:
                        this.SetRetrigRate(ch, (this.retriggers[ch] & -16257) | (value << 7));
                        break;
                    case 49:
                        this.SetRetrigRate(ch, (this.retriggers[ch] & -128) | value);
                        break;
                }
                break;
            case 192:
                this.SetInst2(ch, (this.banks[ch] + key) | 0);
                break;
            case 208:
                this.ChannelPressure2(key, ch);
                break;
            case 224:
                this.PitchWheel2(ch, key + (value << 7));
                break;
            default:
                if ((packed & 255) === 255) this.Reset2(true);
        }
    }
    // ng.a([ILt;IBI)Z
    UpdateNote(out: Int32Array | null, v: MidiNote, count: number, offset: number): boolean {
        v.remaining = intDivide(PCMPlayer.m_frequency, 100);
        if (v.releaseTime >= 0 && (v.stream === null || v.stream.Isfinished())) {
            v.DropData();
            v.Unlink();
            if (v.group > 0 && arrayAtObj(arrayAtObj(this.heldGroups, v.channel), v.group) === v) this.heldGroups[v.channel][v.group] = null;
            return true;
        }
        if (v.glide > 0) v.glide = Math.max(0, (v.glide - doubleToInt(16 * Math.pow(2, arrayAtI32(this.portamento, v.channel) * 4.921259842519685e-4) + 0.5)) | 0);
        const stream = requireNonNull(v.stream);
        stream.SetRateRaw(this.GetRateRaw(v));
        const exponent = 5.086263020833333e-6 * ((((v.note - 60) << 8) + (Math.imul(v.glide, v.pitchDelta) >> 12)) | 0);
        let end = false;
        v.age = (v.age + 1) | 0;
        const p = requireNonNull(v.params);
        v.vibratoPhase = (v.vibratoPhase + p.vibratoRate) | 0;
        if (p.decay > 0) {
            v.decayTime = (v.decayTime + (p.decayKeyScale <= 0 ? 128 : doubleToInt(128 * Math.pow(2, exponent * p.decayKeyScale) + 0.5))) | 0;
            if (Math.imul(v.decayTime, p.decay) >= 819200) end = true;
        }
        const vol = p.volumeEnvelope;
        if (vol !== null) {
            v.volumeTime = (v.volumeTime + (p.volumeKeyScale <= 0 ? 128 : doubleToInt(0.5 + 128 * Math.pow(2, p.volumeKeyScale * exponent)))) | 0;
            while (v.volumeIndex < vol.length - 2 && v.volumeTime > (arrayAtI8(vol, v.volumeIndex + 2) & 255) << 8) v.volumeIndex += 2;
            if (v.volumeIndex === vol.length - 2 && arrayAtI8(vol, v.volumeIndex + 1) === 0) end = true;
        }
        const rel = p.releaseEnvelope;
        if (v.releaseTime >= 0 && rel !== null && (arrayAtI32(this.flags, v.channel) & 1) === 0 && (v.group < 0 || arrayAtObj(arrayAtObj(this.heldGroups, v.channel), v.group) !== v)) {
            v.releaseTime = (v.releaseTime + (p.releaseKeyScale <= 0 ? 128 : doubleToInt(0.5 + Math.pow(2, p.releaseKeyScale * exponent) * 128))) | 0;
            while (v.releaseIndex < rel.length - 2 && v.releaseTime > (arrayAtI8(rel, v.releaseIndex + 2) & 255) << 8) v.releaseIndex += 2;
            if (v.releaseIndex === rel.length - 2) end = true;
        }
        if (end) {
            stream.RampOut(v.remaining);
            if (out !== null) stream.DoMix(out, offset, count);
            else stream.PretendToMix(count);
            if (stream.Isramping()) this.patchStream.mixer.PlayStream(stream);
            v.DropData();
            if (v.releaseTime >= 0) {
                v.Unlink();
                if (v.group > 0 && arrayAtObj(arrayAtObj(this.heldGroups, v.channel), v.group) === v) this.heldGroups[v.channel][v.group] = null;
            }
            return true;
        }
        stream.RampVolPanFine(v.remaining, this.GetVolume(v), this.GetPan(v));
        return false;
    }
    // ng.a(Lll;IILal;Lee;)Z
    LoadAndQueuePatches(cache: WaveCache, budget: number, archive: Js5 | null, track: MidiFile): boolean {
        track.prepare();
        const remaining = budget > 0 ? Int32Array.of(budget) : null,
            instruments = requireNonNull(track.instruments);
        let loaded = true;
        for (let mask = instruments.head(); mask !== null; mask = instruments.next()) {
            const key = BigInt.asIntN(32, mask.key);
            let patch = this.patches.get(key);
            if (patch === null) {
                patch = Patch.Load(Number(key), archive);
                if (patch === null) {
                    loaded = false;
                    continue;
                }
                this.patches.put(patch, key);
            }
            if (!patch.LoadWaves(cache, remaining, mask.data)) loaded = false;
        }
        if (loaded) track.clear();
        return loaded;
    }
    // ng.b(IIII)V
    private AfterTouch2(_channel: number, _key: number, _value: number): void {}
    // ng.a(IBI)V
    private SetDefInst2(ch: number, value: number): void {
        arrayPutI32(this.initialPrograms, ch, value);
        this.banks[ch] = value & -128;
        this.SetInst2(ch, value);
    }
    // ng.a(ZII)V
    private PitchWheel2(ch: number, value: number): void {
        arrayPutI32(this.bends, ch, value);
    }
    // ng.e(II)V
    private CleanRetrig(ch: number): void {
        if ((arrayAtI32(this.flags, ch) & 4) !== 0) for (let v = this.patchStream.voices.head(); v !== null; v = this.patchStream.voices.next()) if (v.channel === ch) v.retriggerPhase = 0;
    }
    // ng.d(III)V
    private SetInst2(ch: number, value: number): void {
        if (arrayAtI32(this.programs, ch) !== value) {
            this.programs[ch] = value;
            arrayAtObj(this.heldGroups, ch).fill(null);
        }
    }
    // ng.e(III)V
    private ChannelPressure2(_value: number, _channel: number): void {}
    // ng.c(ILt;)I
    private GetPan(v: MidiNote): number {
        const pan = arrayAtI32(this.pans, v.channel);
        return pan >= 8192 ? 16384 - ((Math.imul(16384 - pan, 128 - v.pan) + 32) >> 6) : (32 + Math.imul(pan, v.pan)) >> 6;
    }
    // ng.f(III)V
    QueueSetDefInst(value: number, channel: number): void {
        this.SetDefInst2(channel, value);
    }
    // ng.a(ZZBLee;)V
    private start(loop: boolean, stop: boolean, track: MidiFile | null): void {
        this.clear(stop);
        this.midi.SetMidi(requireNonNull(track).midi);
        this.loop = loop;
        this.time = 0n;
        for (let i = 0, count = this.midi.NumTracks(); i < count; i++) {
            this.midi.SetTrack(i);
            this.midi.ProcessDeltaTime(i);
            this.midi.UnsetTrack(i);
        }
        this.track = this.midi.NextTrackToPlay();
        this.tick = arrayAtI32(this.midi.ticks, this.track);
        this.nextTime = this.midi.TimeFromTick(this.tick);
    }
    // ng.a(BLt;)I
    private GetVolume(v: MidiNote): number {
        if (arrayAtI32(this.gains, v.channel) === 0) return 0;
        const p = requireNonNull(v.params);
        let volume = (4096 + Math.imul(arrayAtI32(this.expression, v.channel), arrayAtI32(this.volumes, v.channel))) >> 13;
        volume = (16384 + Math.imul(volume, volume)) >> 15;
        volume = (Math.imul(v.gain, volume) + 16384) >> 15;
        volume = (Math.imul(this.m_globalVolume, volume) + 128) >> 8;
        volume = (128 + Math.imul(volume, arrayAtI32(this.gains, v.channel))) >> 8;
        if (p.decay > 0) volume = doubleToInt(Math.pow(0.5, p.decay * (v.decayTime * 1.953125e-5)) * volume + 0.5);
        const vol = p.volumeEnvelope;
        if (vol !== null) {
            const i = v.volumeIndex;
            let amp = arrayAtI8(vol, i + 1);
            if (i < vol.length - 2) {
                const low = (arrayAtI8(vol, i) & 255) << 8,
                    high = (arrayAtI8(vol, i + 2) & 255) << 8;
                amp = (amp + intDivide(Math.imul(arrayAtI8(vol, i + 3) - amp, v.volumeTime - low), high - low)) | 0;
            }
            volume = (32 + Math.imul(volume, amp)) >> 6;
        }
        const rel = p.releaseEnvelope;
        if (v.releaseTime > 0 && rel !== null) {
            const i = v.releaseIndex;
            let amp = arrayAtI8(rel, i + 1);
            if (i < rel.length - 2) {
                const low = (arrayAtI8(rel, i) & 255) << 8,
                    high = (arrayAtI8(rel, i + 2) & 255) << 8;
                amp = (amp + intDivide(Math.imul(v.releaseTime - low, arrayAtI8(rel, i + 3) - amp), high - low)) | 0;
            }
            volume = (Math.imul(amp, volume) + 32) >> 6;
        }
        return volume;
    }
}
