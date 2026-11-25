import { releaseReferences } from '#/util/StaticReferences';
import { intDivide } from '#/util/IntUtils';
import { isJavaRuntimeException } from '#/util/JavaException';
import WrappedException from '#/util/WrappedException';
import { loadLocalisedText, loadWorld } from '#/util/GamepackClasses';

export default class ActorSlotAnim {
    // HD ub.a(B)V
    static releaseHdStatics(guard: number): void {
        try {
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'loadingTextures', 'germanChatcol7');
            const world = loadWorld();
            releaseReferences(world, 'activeOccluders');
            releaseReferences(LocalisedText, 'englishLoadingTextures');
            if (guard <= 1) {
                ActorSlotAnim.unsignedByte(112, 44);
            }
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'ub.G(' + guard + ')');
        }
    }

    // HD ub.a(IB)I
    static unsignedByte(value: number, guard: number): number {
        try {
            intDivide(110, intDivide((guard - 34) | 0, 61));
            return value & 255;
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'ub.A(' + value + ',' + guard + ')');
        }
    }

    next = 0; // ci.a:I
    cycle = 0; // ci.d:I
    seq = 0; // ci.e:I
    delay = 0; // ci.f:I
    loops = 0; // ci.j:I
    frame = 0; // ci.n:I

    // ci.<init>()V
    constructor() {}
}
