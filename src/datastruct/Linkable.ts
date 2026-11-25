import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import { requireNonNull } from '#/util/JavaArray';
import { loadAreaSoundManager, loadClient, loadLocalisedText, loadScriptRunner, loadWorldMap } from '#/util/GamepackClasses';
export default class Linkable {
    // HD ab.a(B)V
    static releaseLinkableStatics(guard: number): void {
        try {
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'frenchMembersObject');
            const ScriptRunner = loadScriptRunner();
            releaseReferences(ScriptRunner, 'stringStack');
            if (guard !== 30) {
                const WorldMap = loadWorldMap();
                WorldMap.targetLabel(null, 89);
            }
            const AreaSoundManager = loadAreaSoundManager();
            releaseReferences(AreaSoundManager, 'locs');
            const Client = loadClient();
            releaseReferences(Client, 'friendSameGame');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'ab.H(' + guard + ')');
        }
    }

    // jf.g:Ljf;
    next: Linkable | null = null;
    // jf.k:J
    key = 0n;
    // jf.p:Ljf;
    prev: Linkable | null = null;

    // jf.<init>()V
    constructor() {}

    // jf.a(B)Z
    IsLinked(): boolean {
        return this.prev !== null;
    }

    // jf.b(B)V
    Unlink(): void {
        if (this.prev !== null) {
            requireNonNull(this.prev).next = this.next;
            requireNonNull(this.next).prev = this.prev;
            this.prev = null;
            this.next = null;
        }
    }
}
