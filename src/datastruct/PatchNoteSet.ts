import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import Linkable from './Linkable';
import { loadClientPlayer, loadLocalisedText } from '#/util/GamepackClasses';
export default class PatchNoteSet extends Linkable {
    // HD ea.c(I)V
    static releasePatchNoteSetStatics(guard: number): void {
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD og stays deferred until ea.c(I)V in PatchNoteSet.releasePatchNoteSetStatics.
            const VarBitType = (require('#/config/VarBitType') as typeof import('#/config/VarBitType')).default;
            releaseReferences(VarBitType, 'm_maskLookUp');
            const ClientPlayer = loadClientPlayer();
            releaseReferences(ClientPlayer, 'debugBallast');
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'tradeRequest');
            if (guard !== 2) {
                // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD cc stays deferred until ea.c(I)V in PatchNoteSet.releasePatchNoteSetStatics.
                const ArrayUtils = (require('#/util/ArrayUtils') as typeof import('#/util/ArrayUtils')).default;
                ArrayUtils.copyOfFloats(null, 91);
            }
            releaseReferences(LocalisedText, 'englishTradeRequest');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'ea.A(' + guard + ')');
        }
    }

    // lk.w:[B
    data: Uint8Array | null;
    // lk.<init>([B)V
    constructor(data: Uint8Array | null) {
        super();
        this.data = data;
    }
}
