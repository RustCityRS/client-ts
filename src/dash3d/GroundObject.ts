import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import type ModelSource from './ModelSource';
import { loadClient, loadMinimenu, loadObjType } from '#/util/GamepackClasses';

// mh in the revision 530 SD gamepack (NXT jag::oldscape::dash3d::GroundObject): the obj stack on a square, up to three
// models. world.SetObj creates it and fills every field. Field names follow the rev 225 GroundObject; the top, middle
// and bottom slots follow world.SetObj's caller (ng.b(III), which passes the most valuable obj as top, then the first
// two other ids). world.Fill draws them in the order middle, bottom, top.
//
// None of mh's statics belong here: m is an invocation counter, mh.a(B)V is a null-only unload, and c, g, h, j and
// n are placed in other classes by the member map.
export default class GroundObject {
    // HD jj.a(I)V
    static releaseHdStatics(guard: number): void {
        try {
            const ObjType = loadObjType();
            releaseReferences(ObjType, 'colourEndTag');
            if (guard !== 1) {
                return;
            }
            const Minimenu = loadMinimenu();
            releaseReferences(Minimenu, 'openParen');
            const Client = loadClient();
            releaseReferences(Client, 'headiconsPkName');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'jj.F(' + guard + ')');
        }
    }

    // mh.a:I
    z = 0;
    // mh.b:Lug;
    middleObj: ModelSource | null = null;
    // mh.d:I
    // How far the stack is raised (the negated lowest getMinY of the square's typecode-bit-22 sprites).
    height = 0;
    // mh.e:J
    typecode = 0n;
    // mh.f:Lug;
    bottomObj: ModelSource | null = null;
    // mh.i:I
    y = 0;
    // mh.k:Lug;
    topObj: ModelSource | null = null;
    // mh.l:I
    x = 0;

    // mh.<init>()V
    constructor() {}
}
