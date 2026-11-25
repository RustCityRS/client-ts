import { intDivide, intRemainder } from '#/util/IntUtils';
import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import SecondaryNode from '#/datastruct/SecondaryNode';
import type MapSpotAnim from './MapSpotAnim';
import { loadLocalisedText } from '#/util/GamepackClasses';

// qg
export default class MapSpotAnimNode extends SecondaryNode {
    // HD bk.d(I)V
    static releaseMapSpotAnimNodeStatics(guard: number): void {
        try {
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'loadingConfig', 'defaultChatcol0', 'englishLoadingConfig');
            intRemainder(101, intDivide((-29 - guard) | 0, 45));
            releaseReferences(LocalisedText, 'chatcol0', 'germanAllocatingMemory', 'englishChatcol0');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'bk.B(' + guard + ')');
        }
    }

    // qg.E:Lac;
    spot: MapSpotAnim;
    // qg.<init>(Lac;)V
    constructor(spot: MapSpotAnim) {
        super();
        this.spot = spot;
    }
}
