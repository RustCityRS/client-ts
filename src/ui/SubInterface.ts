import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import Linkable from '#/datastruct/Linkable';
import { loadClient, loadClientBuild, loadPlayerModel, loadSpotType, loadWorldList } from '#/util/GamepackClasses';

export default class SubInterface extends Linkable {
    // HD wk.c(I)V
    static releaseSubInterfaceStatics(guard: number): void {
        try {
            const SpotType = loadSpotType();
            releaseReferences(SpotType, 'm_recentUse');
            const ClientBuild = loadClientBuild();
            releaseReferences(ClientBuild, 'm_ligtot');
            const Client = loadClient();
            releaseReferences(Client, 'clientJs5DropCommand');
            const WorldList = loadWorldList();
            releaseReferences(WorldList, 'langParam');
            if (guard !== 26971) {
                const PlayerModel = loadPlayerModel();
                PlayerModel.cleanModelCaches(-51, -76);
            }
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'wk.B(' + guard + ')');
        }
    }

    // qd.q:I
    type = 0;
    // qd.v:I
    group = 0;

    // qd.<init>()V
    constructor() {
        super();
    }
}
