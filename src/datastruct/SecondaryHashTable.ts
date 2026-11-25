import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import SecondaryNode from './SecondaryNode';
import { loadClient, loadLocalisedText } from '#/util/GamepackClasses';

export default class SecondaryHashTable {
    // HD rm.a(B)V
    static releaseHdStatics(guard: number): void {
        try {
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'chateffect3', 'englishChateffect3', 'defaultChateffect3');
            const Client = loadClient();
            releaseReferences(Client, 'infText');
            if (guard >= -46) {
                return;
            }
            // eslint-disable-next-line @typescript-eslint/no-require-imports -- HD ic stays deferred until rm.a(B)V in SecondaryHashTable.releaseHdStatics.
            const LightType = (require('#/config/LightType') as typeof import('#/config/LightType')).default;
            releaseReferences(LightType, 'cache');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'rm.C(' + guard + ')');
        }
    }

    // q.h:[Lei;
    private buckets: SecondaryNode[];

    // q.<init>(I)V
    constructor(capacity: number) {
        this.buckets = new Array<SecondaryNode>(capacity);
        for (let i = 0; i < capacity; i++) {
            const sentinel = (this.buckets[i] = new SecondaryNode());
            sentinel.secondaryNext = sentinel;
            sentinel.secondaryPrev = sentinel;
        }
    }
}
