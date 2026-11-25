import { intDivide, intRemainder } from '#/util/IntUtils';
import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import Linkable from '#/datastruct/Linkable';
import { loadLocalisedText } from '#/util/GamepackClasses';

// jk
export default class PendingLocMerge extends Linkable {
    // HD cn.d(B)V
    static releasePendingLocMergeStatics(guard: number): void {
        try {
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'frenchSelfIgnore', 'germanChatcol1', 'englishStarting3dLibrary', 'starting3dLibrary', 'germanChatcol4');
            intRemainder(-100, intDivide((guard + 43) | 0, 46));
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'cn.D(' + guard + ')');
        }
    }

    offsetX2 = 0; // jk.q:I
    locId = 0; // jk.s:I
    endDelay = 0; // jk.t:I
    offsetZ2 = 0; // jk.u:I
    x = 0; // jk.v:I
    offsetZ1 = 0; // jk.x:I
    shape = 0; // jk.y:I
    z = 0; // jk.z:I
    actor = 0; // jk.B:I
    offsetX1 = 0; // jk.C:I
    angle = 0; // jk.D:I
    startDelay = 0; // jk.E:I

    // jk.<init>()V
    constructor() {
        super();
    }
}
