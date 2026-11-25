import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import type ParticleSystem from './ParticleSystem';
import { loadChatHistory, loadClient, loadComponentDrag, loadIfType, loadPlayerModel, loadSpriteLoader, loadWorldMap } from '#/util/GamepackClasses';

// ug in the revision 530 SD gamepack: the base of everything the scene graph can draw (models, raw models,
// animated locs, projectiles, map spot anims, actors). Only the instance members live here; ug's scattered
// statics are placed by the member map.
export default abstract class ModelSource {
    // HD th.a(I)V
    static releaseModelSourceStatics(guard: number): void {
        try {
            const SpriteLoader = loadSpriteLoader();
            releaseReferences(SpriteLoader, 'scrollbars');
            const ComponentDrag = loadComponentDrag();
            releaseReferences(ComponentDrag, 'dragLayerComponents');
            const IfType = loadIfType();
            releaseReferences(IfType, 'm_list');
            if (guard !== 0) {
                ModelSource.releaseModelSourceStatics(-87);
            }
            const WorldMap = loadWorldMap();
            releaseReferences(WorldMap, 'mapFunctions');
            const ChatHistory = loadChatHistory();
            releaseReferences(ChatHistory, 'phrases');
            const Client = loadClient();
            releaseReferences(Client, 'setParticlesCommand');
            const PlayerModel = loadPlayerModel();
            releaseReferences(PlayerModel, 'layerFrameIds');
            // eslint-disable-next-line @typescript-eslint/no-require-imports -- TextureShapeRaster stays deferred until th.a(I)V in ModelSource.releaseModelSourceStatics.
            const TextureShapeRaster = (require('./TextureShapeRaster') as typeof import('./TextureShapeRaster')).default;
            releaseReferences(TextureShapeRaster, 'circleWidths');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'th.HC(' + guard + ')');
        }
    }

    // ug.<init>()V
    constructor() {}

    // ug.a(Lug;IIIZ)V. Shares vertex normals with a neighbouring scene model; only raw models override it.
    mergeNormals(_other: ModelSource, _x: number, _y: number, _z: number, _hide: boolean): void {}

    // ug.a(IIIIIIIIJILue;)V
    abstract draw(yaw: number, sinPitch: number, cosPitch: number, sinYaw: number, cosYaw: number, x: number, y: number, z: number, typecode: bigint, arg9: number, particles: ParticleSystem | null): void;

    // ug.a(III)Lug;. Raw models return a lit copy; everything else is already lit and returns itself.
    light(_x: number, _y: number, _z: number): ModelSource {
        return this;
    }

    // ug.a()Z. True only for raw (unlit) models.
    isUnlit(): boolean {
        return false;
    }

    // ug.b()I
    abstract getMinY(): number;

    // ug.a(IIIII)V. Per-cycle update; only animated locs advance their frame here.
    abstract update(arg0: number, arg1: number, arg2: number, arg3: number, arg4: number): void;
}
