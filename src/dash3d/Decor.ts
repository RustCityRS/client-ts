import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import type ModelSource from './ModelSource';
import { loadMinimenu, loadWorldMap } from '#/util/GamepackClasses';

// nf in the revision 530 SD gamepack (NXT jag::oldscape::dash3d::Decor): the wall decoration on a square. world.SetDecor
// creates it and fills every field; world.MoveDecor scales the two offsets. Field names follow the rev 225 Decor,
// which baked the offsets into x/z and had one model (the diagonal second model is 530's model2).
//
// nf.a(I)V is an unload artifact. f is an invocation counter; c, j, n, nf.a(II) and
// nf.a(Lal;Lal;Z) are placed in other classes by the member map.
export default class Decor {
    // HD df.a(B)V
    static releaseHdStatics(guard: number): void {
        try {
            const WorldMap = loadWorldMap();
            releaseReferences(WorldMap, 'loc');
            if (guard !== 112) {
                Decor.releaseHdStatics(-42);
            }
            const Minimenu = loadMinimenu();
            releaseReferences(Minimenu, 'green');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'df.A(' + guard + ')');
        }
    }

    // nf.a:J
    // Stored as 0 by nf.<init> (lconst_0).
    typecode = 0n;
    // nf.b:I
    z = 0;
    // nf.d:I
    x = 0;
    // nf.e:I
    y = 0;
    // nf.g:I
    angle = 0;
    // nf.h:I
    // Added to x - cx when drawn; world.MoveDecor scales it.
    offsetX = 0;
    // nf.i:Lug;
    model: ModelSource | null = null;
    // nf.k:Lug;
    // The second (diagonal, wshape 256) model, drawn when the eye is on its side.
    model2: ModelSource | null = null;
    // nf.l:I
    // Added to z - cz when drawn; world.MoveDecor scales it.
    offsetZ = 0;
    // nf.m:I
    // The wall-type mask the decor occupies (256 = diagonal).
    wshape = 0;

    // nf.<init>()V
    constructor() {}

    // nf.a(I)V artifact: applet-shutdown unload that only nulls statics homed in other classes (membermap kind
    // unload, like the other 117).
}
