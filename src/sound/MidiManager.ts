import type Js5 from '#/cache/Js5';
import { JavaError } from '#/util/ClientError';
import { requireNonNull } from '#/util/JavaArray';
import type MidiPlayer from './MidiPlayer';
import MidiFile from './MidiFile';
import WaveCache from './WaveCache';

// The 530 manager has one sequencer and one pending request. The archive roles are
// the same as midi2::MidiManager::Init in libs/oldscape/jagex3/midi2/midimanager.cpp.
export default class MidiManager {
    static stream: MidiPlayer | null = null; // ve.f:Lng;
    static m_pPatches: Js5 | null = null; // rk.a:Lal;
    static m_pVorbis: Js5 | null = null; // g.o:Lal;
    static m_pJagFX: Js5 | null = null; // ab.U:Lal;
    static track: MidiFile | null = null; // qf.m:Lee;
    static cache: WaveCache | null = null; // al.z:Lll;
    static status = 0; // ng.B:I
    static trackArchive: Js5 | null = null; // nk.S:Lal;
    static trackGroupId = 0; // oa.i:I
    static trackFileId = 0; // cf.g:I
    static loop = false; // mf.b:Z
    static targetVolume = 0; // hj.i:I
    static fadeSpeed = 0; // ra.R:I

    // pe.a(Lng;Lal;ZLal;Lal;)Z
    static Init(stream: MidiPlayer | null, samples: Js5 | null, patches: Js5 | null, effects: Js5 | null): boolean {
        MidiManager.m_pJagFX = effects;
        MidiManager.m_pPatches = patches;
        MidiManager.m_pVorbis = samples;
        MidiManager.stream = stream;
        return true;
    }

    // ib.b(IB)V
    static Stop(fade: number): void {
        MidiManager.targetVolume = 0;
        MidiManager.trackArchive = null;
        MidiManager.trackGroupId = -1;
        MidiManager.trackFileId = -1;
        MidiManager.loop = false;
        MidiManager.status = 1;
        MidiManager.fadeSpeed = fade;
    }

    // fl.a(IILal;ZIII)V
    static Play(volume: number, fade: number, archive: Js5 | null, loop: boolean, group: number, file: number): void {
        MidiManager.status = 1;
        MidiManager.trackArchive = archive;
        MidiManager.trackFileId = file;
        MidiManager.loop = loop;
        MidiManager.trackGroupId = group;
        MidiManager.targetVolume = volume;
        MidiManager.fadeSpeed = fade;
    }

    // pf.c(II)V
    static SetVolume(volume: number): void {
        if (MidiManager.status !== 0) MidiManager.targetVolume = volume;
        else requireNonNull(MidiManager.stream).QueueSetGlobalVolume(volume);
    }

    // ll.a(B)V
    static stopImmediate(): void {
        requireNonNull(MidiManager.stream).QueueStopFile();
        MidiManager.status = 1;
        MidiManager.trackArchive = null;
    }

    // ph.a(IZILal;IB)V
    static queue(file: number, loop: boolean, group: number, archive: Js5 | null, volume: number): void {
        MidiManager.trackArchive = archive;
        MidiManager.status = 1;
        MidiManager.trackFileId = file;
        MidiManager.trackGroupId = group;
        MidiManager.targetVolume = volume;
        MidiManager.loop = loop;
        MidiManager.fadeSpeed = 10000;
    }

    // mj.a(I)Z
    static IsPlaying(): boolean {
        return MidiManager.status !== 0 || requireNonNull(MidiManager.stream).IsPlayingFile();
    }

    // sd.e(I)V
    static fade(): void {
        try {
            if (MidiManager.status === 1) {
                let volume = requireNonNull(MidiManager.stream).GetGlobalVolume();
                if (volume > 0 && requireNonNull(MidiManager.stream).IsPlayingFile()) {
                    volume = (volume - MidiManager.fadeSpeed) | 0;
                    if (volume < 0) volume = 0;
                    requireNonNull(MidiManager.stream).QueueSetGlobalVolume(volume);
                } else {
                    requireNonNull(MidiManager.stream).QueueStopFile();
                    requireNonNull(MidiManager.stream).QueueDropPatches();
                    MidiManager.track = null;
                    MidiManager.status = MidiManager.trackArchive === null ? 0 : 2;
                    MidiManager.cache = null;
                }
            }
        } catch (error) {
            if (!(error instanceof Error) || error instanceof JavaError) throw error;
            console.error(error);
            requireNonNull(MidiManager.stream).QueueStopFile();
            MidiManager.track = null;
            MidiManager.cache = null;
            MidiManager.trackArchive = null;
            MidiManager.status = 0;
        }
    }

    // a.a(Z)Z
    static load(): boolean {
        try {
            if (MidiManager.status === 2) {
                if (MidiManager.track === null) {
                    MidiManager.track = MidiFile.Load(MidiManager.trackArchive, MidiManager.trackGroupId, MidiManager.trackFileId);
                    if (MidiManager.track === null) return false;
                }
                if (MidiManager.cache === null) MidiManager.cache = new WaveCache(MidiManager.m_pJagFX, MidiManager.m_pVorbis);
                if (requireNonNull(MidiManager.stream).LoadAndQueuePatches(MidiManager.cache, 22050, MidiManager.m_pPatches, MidiManager.track)) {
                    requireNonNull(MidiManager.stream).QueueDropWaveIds();
                    requireNonNull(MidiManager.stream).QueueSetGlobalVolume(MidiManager.targetVolume);
                    requireNonNull(MidiManager.stream).QueuePlayFile(MidiManager.track, MidiManager.loop);
                    MidiManager.status = 0;
                    MidiManager.trackArchive = null;
                    MidiManager.track = null;
                    MidiManager.cache = null;
                    return true;
                }
            }
        } catch (error) {
            if (!(error instanceof Error) || error instanceof JavaError) throw error;
            console.error(error);
            requireNonNull(MidiManager.stream).QueueStopFile();
            MidiManager.cache = null;
            MidiManager.status = 0;
            MidiManager.track = null;
            MidiManager.trackArchive = null;
        }
        return false;
    }
}
