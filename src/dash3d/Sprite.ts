import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import type ModelSource from './ModelSource';
import { loadLocalisedText, loadTerrainBuilder } from '#/util/GamepackClasses';

// ec in the revision 530 SD gamepack (NXT jag::oldscape::dash3d::Sprite): a scene-graph sprite, i.e. one model
// spanning one or more squares (scenery locs, actors, projectiles, spot anims). Not a 2D image. world.SetSprite
// creates it and fills every field; world.Fill sorts and draws it. Field names follow the rev 225 Sprite (530 drops
// typecode2: the typecode is a long).
//
// None of ec's statics belong here: d/k/p/v are invocation counters, and the rest (b, e, g, h, i, j, o, q, x,
// ec.a(IB)/a(II)/a([BZ)/a(ZIII) and the unload ec.a(I)) are placed in other classes by the member map.
export default class Sprite {
    // HD ec.a(I)V
    static releaseHdStatics(guard: number): void {
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD bf stays deferred until ec.a(I)V in Sprite.releaseHdStatics.
            const TextureOp = (require('./TextureOp') as typeof import('./TextureOp')).default;
            releaseReferences(TextureOp, 'permutationCache');
            const TerrainBuilder = loadTerrainBuilder();
            releaseReferences(TerrainBuilder, 'underlayShapes');
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'englishLoadingPleaseWait');
            if (guard !== 128) {
                Sprite.releaseHdStatics(113);
            }
            releaseReferences(LocalisedText, 'loadingPleaseWait');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'ec.A(' + guard + ')');
        }
    }

    // ec.a:I
    minTileX = 0;
    // ec.c:I
    x = 0;
    // ec.f:I
    yaw = 0;
    // ec.l:I
    // Draw-order key world.Fill computes: the farthest x tile extent from the eye plus the farthest z extent.
    distance = 0;
    // ec.m:I
    minTileZ = 0;
    // ec.n:I
    maxTileX = 0;
    // ec.r:I
    // The world.cycleNo the sprite was last drawn in.
    cycle = 0;
    // ec.s:I
    z = 0;
    // ec.t:I
    y = 0;
    // ec.u:J
    // Stored as 0 by ec.<init> (lconst_0).
    typecode = 0n;
    // ec.w:I
    level = 0;
    // ec.y:I
    maxTileZ = 0;
    // ec.z:Lug;
    model: ModelSource | null = null;

    // ec.<init>()V
    constructor() {}
}
