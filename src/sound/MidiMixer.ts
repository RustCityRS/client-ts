import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import SharedPtrList from '#/datastruct/SharedPtrList';
import { arrayAtI16, arrayAtI32, requireNonNull } from '#/util/JavaArray';
import { intDivide } from '#/util/IntUtils';
import type MidiPlayer from './MidiPlayer';
import type MidiNote from './MidiNote';
import PCMPlayer from './PCMPlayer';
import PCMStream from './PCMStream';
import Mixer from './Mixer';
import WaveStream from './WaveStream';
import { loadClient, loadClientBuild, loadMaterialManager, loadQuickChatPhraseTypeList } from '#/util/GamepackClasses';

export default class MidiMixer extends PCMStream {
    // HD te.d(I)V
    static releaseMidiMixerStatics(guard: number): void {
        try {
            const QuickChatPhraseTypeList = loadQuickChatPhraseTypeList();
            releaseReferences(QuickChatPhraseTypeList, 'local');
            const ClientBuild = loadClientBuild();
            releaseReferences(ClientBuild, 'DECORZOF');
            const Client = loadClient();
            releaseReferences(Client, 'mapBuildIndex');
            if (guard !== -28918) {
                const MaterialManager = loadMaterialManager();
                MaterialManager.createMaterials(-39);
            }
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'te.C(' + guard + ')');
        }
    }

    // ef.x:Lgk;
    readonly voices = new SharedPtrList<MidiNote>();
    // ef.I:Lng;
    private readonly midi: MidiPlayer;
    // ef.L:Lcj;
    readonly mixer = new Mixer();
    // ef.b([III)V
    DoMix(out: Int32Array | null, offset: number, count: number): void {
        this.mixer.DoMix(out, offset, count);
        voices: for (let v = this.voices.head(); v !== null; v = this.voices.next()) {
            if (this.midi.UpdateStreamlessNote(v)) continue;
            let n = count,
                pos = offset;
            while (n > v.remaining) {
                this.DoMix2(v, (pos + n) | 0, v.remaining, out, pos);
                n = (n - v.remaining) | 0;
                pos = (pos + v.remaining) | 0;
                if (this.midi.UpdateNote(out, v, n, pos)) continue voices;
            }
            this.DoMix2(v, (pos + n) | 0, n, out, pos);
            v.remaining = (v.remaining - n) | 0;
        }
    }
    // ef.d()I
    SelfMixCost(): number {
        return 0;
    }
    // ef.b()Ljj;
    SubstreamNext(): PCMStream | null {
        let v: MidiNote | null;
        do {
            v = this.voices.next();
            if (v === null) return null;
        } while (v.stream === null);
        return v.stream;
    }
    // ef.a(ILt;I)V
    private PretendToMix2(count: number, v: MidiNote): void {
        if ((arrayAtI32(this.midi.flags, v.channel) & 4) !== 0 && v.releaseTime < 0) {
            const rate = intDivide(arrayAtI32(this.midi.retriggerSteps, v.channel), PCMPlayer.m_frequency);
            const until = intDivide((rate + 1048575 - v.retriggerPhase) | 0, rate);
            v.retriggerPhase = (Math.imul(count, rate) + v.retriggerPhase) & 1048575;
            if (until <= count) {
                const old = requireNonNull(v.stream),
                    sound = requireNonNull(v.sample);
                if (arrayAtI32(this.midi.sampleOffsets, v.channel) !== 0) {
                    v.stream = WaveStream.NewRateRawFineVolPan(sound, old.GetRateRaw(), 0, old.GetPanFine());
                    this.midi.SetSampleOffset(arrayAtI16(requireNonNull(v.patch).pitches, v.note) < 0, v);
                } else v.stream = WaveStream.NewRateRawFineVolPan(sound, old.GetRateRaw(), old.GetVolumeFine(), old.GetPanFine());
                if (arrayAtI16(requireNonNull(v.patch).pitches, v.note) < 0) requireNonNull(v.stream).SetLoopCount(-1);
                count = intDivide(v.retriggerPhase, rate);
            }
        }
        requireNonNull(v.stream).PretendToMix(count);
    }
    // ef.a(I)V
    PretendToMix(count: number): void {
        this.mixer.PretendToMix(count);
        voices: for (let v = this.voices.head(); v !== null; v = this.voices.next()) {
            if (this.midi.UpdateStreamlessNote(v)) continue;
            let n = count;
            while (n > v.remaining) {
                this.PretendToMix2(v.remaining, v);
                n = (n - v.remaining) | 0;
                if (this.midi.UpdateNote(null, v, n, 0)) continue voices;
            }
            this.PretendToMix2(n, v);
            v.remaining = (v.remaining - n) | 0;
        }
    }
    // ef.a(Lt;II[IBI)V
    private DoMix2(v: MidiNote, end: number, count: number, out: Int32Array | null, offset: number): void {
        if ((arrayAtI32(this.midi.flags, v.channel) & 4) !== 0 && v.releaseTime < 0) {
            const rate = intDivide(arrayAtI32(this.midi.retriggerSteps, v.channel), PCMPlayer.m_frequency);
            while (true) {
                const until = intDivide((1048575 - v.retriggerPhase + rate) | 0, rate);
                if (count < until) {
                    v.retriggerPhase = (v.retriggerPhase + Math.imul(count, rate)) | 0;
                    break;
                }
                requireNonNull(v.stream).DoMix(out, offset, until);
                const fade = Math.min(intDivide(PCMPlayer.m_frequency, 100), intDivide(262144, rate));
                offset = (offset + until) | 0;
                count = (count - until) | 0;
                const old = requireNonNull(v.stream);
                v.retriggerPhase = (v.retriggerPhase - 1048576 + Math.imul(rate, until)) | 0;
                const sound = requireNonNull(v.sample);
                if (arrayAtI32(this.midi.sampleOffsets, v.channel) === 0) v.stream = WaveStream.NewRateRawFineVolPan(sound, old.GetRateRaw(), old.GetVolumeFine(), old.GetPanFine());
                else {
                    v.stream = WaveStream.NewRateRawFineVolPan(sound, old.GetRateRaw(), 0, old.GetPanFine());
                    this.midi.SetSampleOffset(arrayAtI16(requireNonNull(v.patch).pitches, v.note) < 0, v);
                    requireNonNull(v.stream).RampVolumeFine(fade, old.GetVolumeFine());
                }
                if (arrayAtI16(requireNonNull(v.patch).pitches, v.note) < 0) requireNonNull(v.stream).SetLoopCount(-1);
                old.RampOut(fade);
                old.DoMix(out, offset, (end - offset) | 0);
                if (old.Isramping()) this.mixer.PlayStream(old);
            }
        }
        requireNonNull(v.stream).DoMix(out, offset, count);
    }
    // ef.a()Ljj;
    SubstreamStart(): PCMStream | null {
        const v = this.voices.head();
        return v === null ? null : (v.stream ?? this.SubstreamNext());
    }
    // ef.<init>(Lng;)V
    constructor(midi: MidiPlayer) {
        super();
        this.midi = midi;
    }
}
