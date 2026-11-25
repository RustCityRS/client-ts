import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import Linkable from '#/datastruct/Linkable';
import type Patch from './Patch';
import type EnvelopeSet from './EnvelopeSet';
import type WaveStream from './WaveStream';
import type Wave from './Wave';
import { loadClient, loadLocalisedText } from '#/util/GamepackClasses';

export default class MidiNote extends Linkable {
    // HD mf.c(I)V
    static releaseMidiNoteStatics(guard: number): void {
        try {
            if (guard !== 186) {
                const LocalisedText = loadLocalisedText();
                releaseReferences(LocalisedText, 'frenchDrop');
            }
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'englishRating');
            const Client = loadClient();
            releaseReferences(Client, 'sceneMapLocData');
            releaseReferences(LocalisedText, 'germanStarting3dLibrary');
            releaseReferences(Client, 'varBitArchive');
            releaseReferences(LocalisedText, 'rating', 'germanOk');
            // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD al stays deferred until mf.c(I)V in MidiNote.releaseMidiNoteStatics.
            const Js5 = (require('#/cache/Js5') as typeof import('#/cache/Js5')).default;
            releaseReferences(Js5, 'gzipDecompressor');
            releaseReferences(LocalisedText, 'frenchDrop');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'mf.E(' + guard + ')');
        }
    }

    // t.r:I
    glide = 0;
    // t.s:I
    volumeIndex = 0;
    // t.u:I
    vibratoPhase = 0;
    // t.v:I
    retriggerPhase = 0;
    // t.x:I
    decayTime = 0;
    // t.y:I
    pitch = 0;
    // t.A:I
    gain = 0;
    // t.B:Ljc;
    stream: WaveStream | null = null;
    // t.E:I
    group = 0;
    // t.F:I
    pitchDelta = 0;
    // t.J:I
    volumeTime = 0;
    // t.K:I
    releaseTime = 0;
    // t.N:Ltg;
    patch: Patch | null = null;
    // t.P:I
    remaining = 0;
    // t.Q:I
    channel = 0;
    // t.R:I
    age = 0;
    // t.S:I
    releaseIndex = 0;
    // t.T:I
    pan = 0;
    // t.U:I
    note = 0;
    // t.V:Luf;
    params: EnvelopeSet | null = null;
    // t.X:Lji;
    sample: Wave | null = null;
    // t.c(B)V
    DropData(): void {
        this.sample = null;
        this.patch = null;
        this.stream = null;
        this.params = null;
    }
    // t.<init>()V
    constructor() {
        super();
    }
}
