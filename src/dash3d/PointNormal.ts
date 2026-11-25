import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import { requireNonNull } from '#/util/JavaArray';
import { loadClient, loadJagString, loadLocalisedText, loadMinimenu } from '#/util/GamepackClasses';

// fa in the revision 530 SD gamepack (NXT jag::oldscape::dash3d::PointNormal, the rev 225 PointNormal): a vertex normal
// accumulator. ModelUnlit.CalculateNormals sums the face normals (scaled to length 256) of every smooth-shaded face
// that uses a vertex into x/y/z and counts them in w; ModelUnlit.mergeNormals (ShareLight) copies them into
// sharedPointNormal and adds the neighbouring model's sums. ModelLitImpl lights each vertex from x/y/z/w. Field names
// follow rev 225 (h = x, m = y, d = z, o = w).
//
// Stripped: the od.a RuntimeException wrapper of the copy constructor.
//
// Not here, by the member map: fa.b(B)V (PointNormal.unload) is an unload artifact. It nulls fa.q (world
// minimapShape), fa.n (OrbitCamera shakeAmplitude), fa.b (ObjType types), fa.p (SoftwareFont cache), fa.a (Client
// memLabel) and fa.r (LocalisedText frenchLevel), all homed in other classes. Its only other statement is a
// fa.a(ZIII)Lid; call (JagString.formatInteger, result discarded) guarded by dummy byte <= 93; client.java passes 111,
// so it never runs. fa.c/e/f/g/i/j/k/l are invocation counters. Every other fa static belongs to another class (see
// membermap.json).
export default class PointNormal {
    // HD hd.a(B)V
    static releaseHdStatics(guard: number): void {
        try {
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'defaultChatcol4', 'loggedOut', 'englishChatcol4');
            const JagString = loadJagString();
            releaseReferences(JagString, 'nullString');
            if (guard !== 81) {
                releaseReferences(LocalisedText, 'defaultChatcol4');
            }
            releaseReferences(LocalisedText, 'englishLoggedOut', 'chatcol4');
            const Client = loadClient();
            releaseReferences(Client, 'friendName37');
            const Minimenu = loadMinimenu();
            releaseReferences(Minimenu, 'styleSideSprite');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'hd.C(' + guard + ')');
        }
    }

    // fa.d:I
    z = 0;
    // fa.h:I
    x = 0;
    // fa.m:I
    y = 0;
    // fa.o:I
    // The number of faces summed into x/y/z (0 = the vertex is used by no smooth-shaded face).
    w = 0;

    // fa.<init>()V
    constructor();
    // fa.<init>(Lfa;)V
    constructor(var1: PointNormal | null);
    constructor(...args: [] | [PointNormal | null]) {
        if (args.length === 0) {
            return;
        }

        // fa.<init>(Lfa;)V: field copies in the bytecode's order (h, o, m, d). A null source throws at the first getfield.
        const var1 = requireNonNull(args[0]);
        this.x = var1.x;
        this.w = var1.w;
        this.y = var1.y;
        this.z = var1.z;
    }
}
