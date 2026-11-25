import Linkable from '#/datastruct/Linkable';
import PacketT from '#/io/PacketT';
import { requireNonNull } from '#/util/JavaArray';

// ok in the revision 530 SD gamepack (NXT jag::graphics::AnimBase, the rev 225 AnimBase): an animation skeleton. For
// each transform it holds the operation type, the shadow flag, the part mask and the label (vertex group) list that
// AnimFrame transforms index into. AnimFrameSet loads one per base id from the bases archive and shares it between the
// frames of a set. The NXT class only has accessors for these fields (GetBaseID, GetTransformCount, GetTransformType,
// GetTransformLabels); the Java reads the fields directly, so no method names carry over.
//
// Stripped: the od.a RuntimeException wrapper of the constructor and its client.wb opaque-predicate loop copies
// (each `if (wb != 0) { body; i++; }` before a loop is dead). The `~a < ~b` loop tests are written `b < a`.
// The int[] fields only take g1/g2 values, and every index below is below the array length (provably safe []).
//
// Not here, by the member map: ok.a(II)I (AnimBase.or) is the outlined helper a | b, inlined at its call sites, so it
// has no method. ok.c(B)V (AnimBase.unload) is an unload artifact: it nulls ok.s (ScriptRunner calendar), ok.t
// (Client objConfigArchive) and ok.G (LocalisedText), all homed in other classes. The other ok statics belong to
// other classes (see membermap.json).
export default class AnimBase extends Linkable {
    // ok.v:[[I. Per transform, the labels (vertex groups) it moves.
    labels: (Int32Array | null)[];
    // ok.w:[I. Per transform, the part mask ANDed with the animate mask in ModelLit (65535 = every part).
    partMasks: Int32Array;
    // ok.y:I. Transform count.
    size: number;
    // ok.B:I. Base id (the group or file it was read from).
    id: number;
    // ok.E:[I. Per transform, the operation: 0 origin, 1 translate, 2 rotate, 3 scale, 5 alpha, 7 colour.
    type: Int32Array;
    // ok.H:[Z. Per transform, whether ModelLit.a(Lhf;I)V applies it to the actor shadow model (kc.a getShadowModel).
    shadow: boolean[];

    // ok.<init>(I[B)V
    constructor(var1: number, var2: Uint8Array | null) {
        super();
        this.id = var1;
        const var3 = new PacketT(var2);
        this.size = var3.g1();
        this.labels = new Array<Int32Array | null>(this.size).fill(null);
        this.type = new Int32Array(this.size);
        this.shadow = new Array<boolean>(this.size).fill(false);
        this.partMasks = new Int32Array(this.size);
        let var4 = 0;

        while (var4 < this.size) {
            this.type[var4] = var3.g1();
            var4++;
        }

        let var5 = 0;
        while (var5 < this.size) {
            this.shadow[var5] = var3.g1() === 1;
            var5++;
        }

        let var6 = 0;

        while (this.size > var6) {
            this.partMasks[var6] = var3.g2();
            var6++;
        }

        let var7 = 0;
        while (var7 < this.size) {
            this.labels[var7] = new Int32Array(var3.g1());
            var7++;
        }

        let var8 = 0;
        while (var8 < this.size) {
            let var9 = 0;
            while (requireNonNull(this.labels[var8]).length > var9) {
                requireNonNull(this.labels[var8])[var9] = var3.g1();
                var9++;
            }
            var8++;
        }
    }
}
