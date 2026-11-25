import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import Linkable from './Linkable';
import { loadClient } from '#/util/GamepackClasses';

export default class LongNode extends Linkable {
    // HD eb.c(I)V
    static releaseLongNodeStatics(guard: number): void {
        try {
            const Client = loadClient();
            releaseReferences(Client, 'entityRemovalIds');
            if (guard !== 1000) {
                // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD uj stays deferred until eb.c(I)V in LongNode.releaseLongNodeStatics.
                const CinematicCamera = (require('#/client/CinematicCamera') as typeof import('#/client/CinematicCamera')).default;
                CinematicCamera.lookPath = 55;
            }
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'eb.B(' + guard + ')');
        }
    }

    // ui.B:J
    value = 0n;

    // ui.<init>()V
    constructor();
    // ui.<init>(J)V
    constructor(value: bigint);
    constructor(value?: bigint) {
        super();
        if (value !== undefined) this.value = value;
    }
}
