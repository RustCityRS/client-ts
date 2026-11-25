import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import Signlink from '#/util/Signlink';
import ThreadUtils from '#/util/ThreadUtils';
import { requireNonNull } from '#/util/JavaArray';
import { reportClientError, JavaError } from '#/util/ClientError';
import type PCMPlayer from './PCMPlayer';
import { loadClient, loadLocalisedText, loadPlayerModel, loadPreferences } from '#/util/GamepackClasses';

export default class PlayerTask {
    // HD cj.b(I)V
    static releaseHdStatics(guard: number): void {
        try {
            const PlayerModel = loadPlayerModel();
            releaseReferences(PlayerModel, 'recolourDestinations');
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'frenchChatcol5');
            const Client = loadClient();
            releaseReferences(Client, 'openUrlRequest');
            if (guard <= 75) {
                const Preferences = loadPreferences();
                Preferences.steppedCameraKeys = false;
            }
            releaseReferences(Client, 'npcIds');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'cj.G(' + guard + ')');
        }
    }

    // ei.x:Lld;
    static active: PlayerTask | null = null;
    // ld.a:Lfb;
    signlink: Signlink | null = null;
    // ld.f:Z
    running = false;
    // ld.j:Z
    private stopping = false;
    // ld.l:[Ldg;
    readonly players: (PCMPlayer | null)[] = [null, null];
    // ld.<init>()V
    constructor() {}
    // ld.run()V
    async run(): Promise<void> {
        this.running = true;
        try {
            while (!this.stopping) {
                for (let i = 0; i < 2; i++) this.players[i]?.Service();
                await ThreadUtils.sleep(10n);
                await Signlink.flushEvents(null, requireNonNull(this.signlink));
            }
        } catch (error) {
            if (error instanceof JavaError) throw error;
            await reportClientError(error instanceof Error ? error : new Error(String(error)), null);
        } finally {
            this.running = false;
        }
    }
    // dg.d(I)V sets ld.j after unregistering the last PCM player.
    stop(): void {
        this.stopping = true;
    }
}
