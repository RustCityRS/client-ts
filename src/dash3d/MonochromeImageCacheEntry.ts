import { intDivide } from '#/util/IntUtils';
import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import Linkable from '#/datastruct/Linkable';
import { loadMinimenu, loadPlayerModel, loadReflectionCheck } from '#/util/GamepackClasses';

// lc extends jf.
export default class MonochromeImageCacheEntry extends Linkable {
    // HD qi.d(B)V
    static releaseMonochromeImageCacheEntryStatics(guard: number): void {
        try {
            intDivide(-59, intDivide((guard - 67) | 0, 36));
            const Minimenu = loadMinimenu();
            releaseReferences(Minimenu, 'spriteBottomCorner');
            const PlayerModel = loadPlayerModel();
            releaseReferences(PlayerModel, 'maleKitBodyParts');
            releaseReferences(Minimenu, 'white');
            const ReflectionCheck = loadReflectionCheck();
            releaseReferences(ReflectionCheck, 'queue');
            // eslint-disable-next-line @typescript-eslint/no-require-imports -- AudioEngine stays deferred until qi.d(B)V in MonochromeImageCacheEntry.releaseMonochromeImageCacheEntryStatics.
            const AudioEngine = (require('#/sound/AudioEngine') as typeof import('#/sound/AudioEngine')).default;
            releaseReferences(AudioEngine, 'effects');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'qi.A(' + guard + ')');
        }
    }

    slot: number; // lc.s:I
    row: number; // lc.u:I

    // lc.<init>(II)V
    constructor(row: number, slot: number) {
        super();
        this.slot = slot;
        this.row = row;
    }
}
