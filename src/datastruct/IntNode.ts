import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import Linkable from './Linkable';
import { loadClientBuild, loadWorld } from '#/util/GamepackClasses';

export default class IntNode extends Linkable {
    // HD ka.c(I)V
    static releaseIntNodeStatics(guard: number): void {
        try {
            const ClientBuild = loadClientBuild();
            releaseReferences(ClientBuild, 'm_tot');
            // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD sg stays deferred until ka.c(I)V in IntNode.releaseIntNodeStatics.
            const LocMergeQueue = (require('#/client/LocMergeQueue') as typeof import('#/client/LocMergeQueue')).default;
            releaseReferences(LocMergeQueue, 'pending');
            if (guard !== 1) {
                return;
            }
            const world = loadWorld();
            releaseReferences(world, 'midDep16');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'ka.B(' + guard + ')');
        }
    }

    // oe.v:I
    value = 0;

    // oe.<init>()V
    constructor();
    // oe.<init>(I)V
    constructor(value: number);
    constructor(value?: number) {
        super();
        if (value !== undefined) this.value = value;
    }
}
