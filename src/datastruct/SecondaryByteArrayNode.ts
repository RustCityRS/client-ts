import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import SecondaryNode from './SecondaryNode';
import { loadWorld, loadWorldMap } from '#/util/GamepackClasses';

export default class SecondaryByteArrayNode extends SecondaryNode {
    // HD hc.e(I)V
    static releaseSecondaryByteArrayNodeStatics(guard: number): void {
        try {
            if (guard !== -11346) {
                const WorldMap = loadWorldMap();
                WorldMap.flashTicks = -69;
            }
            const world = loadWorld();
            releaseReferences(world, 'occluders');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'hc.A(' + guard + ')');
        }
    }

    // ga.E:[B
    bytes: Uint8Array | null;

    // ga.<init>([B)V
    constructor(bytes: Uint8Array | null) {
        super();
        this.bytes = bytes;
    }
}
