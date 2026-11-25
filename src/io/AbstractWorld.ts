import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import { loadClient, loadWorld, loadWorldMap } from '#/util/GamepackClasses';
// ka
export default abstract class AbstractWorld {
    // HD gj.a(B)V
    static releaseAbstractWorldStatics(guard: number): void {
        try {
            const Client = loadClient();
            releaseReferences(Client, 'varpUpdates');
            // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD rj stays deferred until gj.a(B)V in AbstractWorld.releaseAbstractWorldStatics.
            const FluType = (require('#/config/FluType') as typeof import('#/config/FluType')).default;
            releaseReferences(FluType, 'm_list');
            const world = loadWorld();
            releaseReferences(world, 'levelHeightmaps');
            if (guard >= -82) {
                AbstractWorld.releaseAbstractWorldStatics(3);
            }
            const WorldMap = loadWorldMap();
            releaseReferences(WorldMap, 'locIds');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'gj.M(' + guard + ')');
        }
    }

    country = 0; // ka.j:I
    players = 0; // ka.q:I
    flags = 0; // ka.r:I

    // ka.<init>()V
    constructor() {}

    // ka.a(I)Z
    IsPVP(): boolean {
        return (this.flags & 4) !== 0;
    }

    // ka.a(B)Z
    IsLootShare(): boolean {
        return (this.flags & 8) !== 0;
    }

    // ka.a(Z)Z
    IsMembers(): boolean {
        return (this.flags & 1) !== 0;
    }

    // ka.b(Z)Z
    IsQuickChat(): boolean {
        return (this.flags & 2) !== 0;
    }
}
