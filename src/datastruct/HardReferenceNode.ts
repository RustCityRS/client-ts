import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import ReferenceNode from './ReferenceNode';
import { loadAreaSoundManager, loadClient, loadLocType, loadNpcType, loadSpotType, loadWorldMap } from '#/util/GamepackClasses';

export default class HardReferenceNode<T extends object> extends ReferenceNode<T> {
    // HD he.f(I)V
    static releaseHardReferenceNodeStatics(guard: number): void {
        try {
            const WorldMap = loadWorldMap();
            releaseReferences(WorldMap, 'empty');
            const Client = loadClient();
            releaseReferences(Client, 'activeMapFunctionZ');
            // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD uk stays deferred until he.f(I)V in HardReferenceNode.releaseHardReferenceNodeStatics.
            const ClientMouseListener = (require('#/client/ClientMouseListener') as typeof import('#/client/ClientMouseListener')).default;
            releaseReferences(ClientMouseListener, 'instance');
            const AreaSoundManager = loadAreaSoundManager();
            releaseReferences(AreaSoundManager, 'players');
            releaseReferences(Client, 'urlHostWww');
            const NpcType = loadNpcType();
            releaseReferences(NpcType, 'm_recentUse');
            const SpotType = loadSpotType();
            releaseReferences(SpotType, 'm_pModels');
            if (guard > -101) {
                HardReferenceNode.releaseHardReferenceNodeStatics(-94);
            }
            const LocType = loadLocType();
            releaseReferences(LocType, 'm_mc2');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'he.D(' + guard + ')');
        }
    }

    // ta.Q:Ljava/lang/Object;
    private readonly value: T | null;

    // ta.<init>(Ljava/lang/Object;)V
    constructor(value: T | null) {
        super();
        this.value = value;
    }
    // ta.b(Z)Ljava/lang/Object;
    override get(): T | null {
        return this.value;
    }
    // ta.d(Z)Z
    override isSoft(): boolean {
        return false;
    }
}
