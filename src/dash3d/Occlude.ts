import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import { loadClient, loadLocalisedText, loadSpriteLoader } from '#/util/GamepackClasses';
// jg in the revision 530 SD gamepack (NXT jag::oldscape::dash3d::Occlude): an occluder box. world.SetOcclude fills
// the tile bounds, type and world-space bounds; world.CalcOcclude sets the mode and the per-256 slopes each frame.
// Field names follow the rev 225 Occlude.
//
// None of jg's statics belong here: B, l and x are invocation counters, and the rest (k, p, q, t, v, w, z, C,
// jg.a(IIZIBI)/a(IIBIII) and the unload jg.a(I)) are placed in other classes by the member map.
export default class Occlude {
    // HD pe.a(I)V
    static releaseHdStatics(guard: number): void {
        try {
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'germanMenuSeparator');
            if (guard !== 10967) {
                Occlude.releaseHdStatics(-117);
            }
            releaseReferences(LocalisedText, 'germanChateffect1');
            const Client = loadClient();
            releaseReferences(Client, 'hintMapmarkersName');
            const SpriteLoader = loadSpriteLoader();
            releaseReferences(SpriteLoader, 'mapdotsName');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'pe.A(' + guard + ')');
        }
    }

    // jg.a:I
    minY = 0;
    // jg.b:I
    maxDeltaY = 0;
    // jg.c:I
    minX = 0;
    // jg.d:I
    // 1 = x plane, 2 = z plane, 4 = horizontal (y) plane.
    type = 0;
    // jg.e:I
    minDeltaZ = 0;
    // jg.f:I
    minDeltaY = 0;
    // jg.g:I
    maxX = 0;
    // jg.h:I
    maxTileX = 0;
    // jg.i:I
    minZ = 0;
    // jg.j:I
    minDeltaX = 0;
    // jg.m:I
    minTileX = 0;
    // jg.n:I
    maxTileZ = 0;
    // jg.o:I
    maxZ = 0;
    // jg.r:I
    // 1..5, chosen by world.CalcOcclude from the type and the side the eye is on.
    mode = 0;
    // jg.s:I
    maxDeltaZ = 0;
    // jg.u:I
    maxY = 0;
    // jg.y:I
    maxDeltaX = 0;
    // jg.A:I
    minTileZ = 0;

    // jg.<init>()V
    constructor() {}
}
