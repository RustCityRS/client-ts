import Preferences from '#/ui/Preferences';
import type Decimator from './Decimator';
import type MidiPlayer from './MidiPlayer';
import GameShell from '#/client/GameShell';
import PCMPlayer from './PCMPlayer';
import type Mixer from './Mixer';
import { glJar } from '#/client/ClientVariant';
import { isJavaRuntimeException } from '#/util/JavaException';
import WrappedException from '#/util/WrappedException';

export default class AudioEngine {
    // m.S:Ldg;
    static musicPlayer: PCMPlayer | null = null;
    // ld.k:Ldg;
    static effectsPlayer: PCMPlayer | null = null;
    // o.P:Lcj;
    static effects: Mixer | null = null;
    // qj.F:Lng;
    static music: MidiPlayer | null = null;
    // ba.f:Lhd;
    static decimator: Decimator | null = null;

    // SD rc.a(I)V, HD rc.d(I)V.
    static setStereo(channel: number): void {
        try {
            this.musicPlayer?.QueueQuit();
            this.effectsPlayer?.QueueQuit();
            PCMPlayer.Init(2, Preferences.stereo, 22050);
            this.musicPlayer = PCMPlayer.GetPlayer(22050, GameShell.signlink, 0, GameShell.canvas);
            this.musicPlayer.SetInput(this.music);
            this.effectsPlayer = PCMPlayer.GetPlayer(2048, GameShell.signlink, glJar ? 1 : channel, GameShell.canvas);
            this.effectsPlayer.SetInput(this.effects);
        } catch (error) {
            if (!glJar || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'rc.DA(-32589)');
        }
    }
    // uj.a(I)V
    static tick(): void {
        this.effectsPlayer?.Service();
        this.musicPlayer?.Service();
    }
}
