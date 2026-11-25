import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import SecondaryNode from './SecondaryNode';
import { loadClient, loadTerrainBuilder, loadWorld } from '#/util/GamepackClasses';

export default abstract class ReferenceNode<T extends object> extends SecondaryNode {
    // HD gf.d(I)V
    static releaseReferenceNodeStatics(guard: number): void {
        try {
            const world = loadWorld();
            releaseReferences(world, 'underwaterHeightmap');
            const Client = loadClient();
            releaseReferences(Client, 'urlDomainSuffix');
            const TerrainBuilder = loadTerrainBuilder();
            releaseReferences(TerrainBuilder, 'blendVertexCounts');
            if (guard !== 3) {
                world.minZ = -108;
            }
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'gf.Q(' + guard + ')');
        }
    }

    // mk.<init>()V
    constructor() {
        super();
    }

    // mk.b(Z)Ljava/lang/Object;
    abstract get(): T | null;
    // mk.d(Z)Z
    abstract isSoft(): boolean;
}
