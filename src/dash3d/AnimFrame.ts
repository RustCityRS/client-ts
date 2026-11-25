import PacketT from '#/io/PacketT';
import { arrayAtI16, arrayAtI32, arrayAtU8, arrayPutI16, arrayPutU8, requireNonNull } from '#/util/JavaArray';
import type AnimBase from './AnimBase';

// of in the revision 530 SD gamepack (NXT jag::oldscape::dash3d::AnimFrame, the rev 225 AnimFrame without the
// per-frame delay, which lives in SeqType): one keyframe of an AnimFrameSet. It lists the transforms of its AnimBase
// that the frame uses, with their x/y/z values, tween flags and the origin transform to apply before each one.
//
// The class is clean in the jar (no counters, dummy arguments or wrappers). Locals keep the decompiler's varN names.
// Stores into the Int16Array/Uint8Array fields perform Java's i2s/i2b truncation, and Int16Array reads sign-extend like
// saload. arrayAt/arrayPut guard every static scratch access because Java throws an NPE there after unload. The 500
// bound can't trip, since the used-transform index stays below the g1 count (at most 255). The base's type array is
// indexed by the frame's own transform count, which can overrun it (AIOOBE).
export default class AnimFrame {
    // Static fields in of.<clinit> store order.

    // of.a:[S
    private static tempTz: Int16Array | null = new Int16Array(500);
    // of.c:[S
    private static tempTi: Int16Array | null = new Int16Array(500);
    // of.d:[S
    private static tempTx: Int16Array | null = new Int16Array(500);
    // of.k:[B
    private static tempFlags: Uint8Array | null = new Uint8Array(500);
    // of.g:[S
    private static tempPrevOrigin: Int16Array | null = new Int16Array(500);
    // of.o:[S
    private static tempTy: Int16Array | null = new Int16Array(500);

    // of.b:I. Number of transforms used by this frame (-1 until decoded).
    size: number = -1;
    // of.e:[S. Per used transform, the origin transform to apply first, or -1.
    prevOrigin: Int16Array;
    // of.f:Z. The frame has an alpha (type 5) transform (NXT field_120, read by AnimFrameSet.GetAnimateTransparencies).
    animateTransparencies: boolean = false;
    // of.h:[S
    tx: Int16Array;
    // of.i:[S. Per used transform, its index in the base.
    ti: Int16Array;
    // of.j:[S
    ty: Int16Array;
    // of.l:Lok;
    base: AnimBase | null = null;
    // of.m:Z. The frame has a colour (type 7) transform (read by AnimFrameSet.getAnimateColours).
    animateColours: boolean = false;
    // of.n:[B. Per used transform, the tween flags (flags >>> 3) & 3.
    flags: Uint8Array;
    // of.p:[S
    tz: Int16Array;

    // of.a()V
    static unload(): void {
        AnimFrame.tempTi = null;
        AnimFrame.tempTx = null;
        AnimFrame.tempTy = null;
        AnimFrame.tempTz = null;
        AnimFrame.tempPrevOrigin = null;
        AnimFrame.tempFlags = null;
    }

    // of.<init>([BLok;)V
    constructor(var1: Uint8Array | null, var2: AnimBase | null) {
        this.base = var2;
        const var3 = new PacketT(var1);
        const var4 = new PacketT(var1);
        var3.m_pos = 2;
        const var5 = var3.g1();
        let var6 = 0;
        let var7 = -1;
        let var8 = -1;
        var4.m_pos = (var3.m_pos + var5) | 0;

        for (let var9 = 0; var9 < var5; var9++) {
            const var10 = arrayAtI32(requireNonNull(this.base).type, var9);
            if (var10 === 0) {
                var7 = var9;
            }

            const var11 = var3.g1();
            if (var11 > 0) {
                if (var10 === 0) {
                    var8 = var9;
                }

                arrayPutI16(AnimFrame.tempTi, var6, var9);
                let var12 = 0;
                if (var10 === 3) {
                    var12 = 128;
                }

                if ((var11 & 1) !== 0) {
                    arrayPutI16(AnimFrame.tempTx, var6, var4.gSmart1or2s());
                } else {
                    arrayPutI16(AnimFrame.tempTx, var6, var12);
                }

                if ((var11 & 2) !== 0) {
                    arrayPutI16(AnimFrame.tempTy, var6, var4.gSmart1or2s());
                } else {
                    arrayPutI16(AnimFrame.tempTy, var6, var12);
                }

                if ((var11 & 4) !== 0) {
                    arrayPutI16(AnimFrame.tempTz, var6, var4.gSmart1or2s());
                } else {
                    arrayPutI16(AnimFrame.tempTz, var6, var12);
                }

                arrayPutU8(AnimFrame.tempFlags, var6, (var11 >>> 3) & 3);
                if (var10 === 2) {
                    arrayPutI16(AnimFrame.tempTx, var6, ((arrayAtI16(AnimFrame.tempTx, var6) & 255) << 3) + ((arrayAtI16(AnimFrame.tempTx, var6) >> 8) & 7));
                    arrayPutI16(AnimFrame.tempTy, var6, ((arrayAtI16(AnimFrame.tempTy, var6) & 255) << 3) + ((arrayAtI16(AnimFrame.tempTy, var6) >> 8) & 7));
                    arrayPutI16(AnimFrame.tempTz, var6, ((arrayAtI16(AnimFrame.tempTz, var6) & 255) << 3) + ((arrayAtI16(AnimFrame.tempTz, var6) >> 8) & 7));
                }

                arrayPutI16(AnimFrame.tempPrevOrigin, var6, -1);
                if (var10 === 1 || var10 === 2 || var10 === 3) {
                    if (var7 > var8) {
                        arrayPutI16(AnimFrame.tempPrevOrigin, var6, var7);
                        var8 = var7;
                    }
                } else if (var10 === 5) {
                    this.animateTransparencies = true;
                } else if (var10 === 7) {
                    this.animateColours = true;
                }

                var6++;
            }
        }

        if (var4.m_pos !== requireNonNull(var1).length) {
            // java.lang.RuntimeException
            throw new Error();
        }

        this.size = var6;
        // All six arrays belong to this frame. Distinct nonoverlapping views retain
        // their Java lengths, identities and writes while sharing one backing store.
        const stride = var6 * Int16Array.BYTES_PER_ELEMENT;
        const storage = new ArrayBuffer(5 * stride + var6);
        this.ti = new Int16Array(storage, 0, var6);
        this.tx = new Int16Array(storage, stride, var6);
        this.ty = new Int16Array(storage, 2 * stride, var6);
        this.tz = new Int16Array(storage, 3 * stride, var6);
        this.prevOrigin = new Int16Array(storage, 4 * stride, var6);
        this.flags = new Uint8Array(storage, 5 * stride, var6);

        for (let var13 = 0; var13 < var6; var13++) {
            this.ti[var13] = arrayAtI16(AnimFrame.tempTi, var13);
            this.tx[var13] = arrayAtI16(AnimFrame.tempTx, var13);
            this.ty[var13] = arrayAtI16(AnimFrame.tempTy, var13);
            this.tz[var13] = arrayAtI16(AnimFrame.tempTz, var13);
            this.prevOrigin[var13] = arrayAtI16(AnimFrame.tempPrevOrigin, var13);
            this.flags[var13] = arrayAtU8(AnimFrame.tempFlags, var13);
        }
    }
}
