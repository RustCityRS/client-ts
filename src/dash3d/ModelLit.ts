import { intDivide } from '#/util/IntUtils';
import { arrayAtI16, arrayAtI32, arrayAtObj, arrayAtU8, requireNonNull } from '#/util/JavaArray';
import type AnimBase from './AnimBase';
import type AnimFrame from './AnimFrame';
import type AnimFrameSet from './AnimFrameSet';
import ModelSource from './ModelSource';
import type ParticleSystem from './ParticleSystem';

// nd in the revision 530 SD gamepack (NXT jag::oldscape::dash3d::ModelLit): the abstract lit model. It declares the
// transform/copy/draw interface that the software model ModelLitImpl (fc) implements (the HD client has a GL
// implementation), and holds the four final animation drivers that turn AnimFrameSet frames into Animate2 calls:
// Animate (one sequence, tweened toward a second frame), animateMasked (the same with a part mask and a transform
// matrix), SplitAnimate (walk-merge of two sequences over the AnimBase parts) and animateShadow (only the transforms
// whose AnimBase.shadow flag is set, applied to the whole model), plus tiltToGround (fit to the terrain heightmap).
//
// The obfuscator left this class clean: no invocation counters, dummy parameters, od.a wrappers or client.wb
// predicates. Member names: NXT spelling where nxtnames.json has a member hint for the same routine (Animate,
// SplitAnimate, MaskAnimate, Animate2, CopyForAnim, Rotate90/180/270, RotateXAxis, Translate, Resize,
// GetRadiusCylinder, ObjRender). The three CopyForAnim methods are one NXT routine (CopyForAnim(bool, int slot)) and are
// suffixed by the scratch model they copy into (Spot = fc.V, Actor = fc.k, Loc = fc.cb), as world.ts does for
// ShareLightLoc/ShareLightGd. RotateYAxis/rotateZAxis follow ModelUnlit (cb.a(I)V/cb.c(I)V are the same routines).
// Methods with no NXT symbol are camelCase descriptions. Overrides of ModelSource keep the base names (draw = NXT
// WorldRender, getMinY, update).
//
// Statics placed here by the member map: dd.r (pickedCount), oc.m (checkHover), pf.W (pickedTypecodes), ud.d (mouseY)
// and nd.a([[III)I (getHeightAt). The scene draw (kk.a) sets the mouse fields and resets pickedCount; the menu
// builder (pg.a) reads the picked typecodes.
export default abstract class ModelLit extends ModelSource {
    // dd.r:I
    // The number of typecodes in pickedTypecodes this frame.
    static pickedCount: number = 0;
    // oc.m:Z
    // True while the mouse is inside the 3D viewport: draw tests models against mouseX/mouseY only then.
    static checkHover: boolean = false;
    // pf.W:[J
    static pickedTypecodes: BigInt64Array | null = new BigInt64Array(1000);
    // ud.d:I
    // The mouse y relative to the viewport centre (ModelLitImpl.mouseX is the x).
    static mouseY: number = 0;

    // nd.j:Z
    // Pick on the projected bounding box alone (record the typecode in draw) instead of per triangle (Render2).
    useAABBMouseCheck: boolean = false;

    // nd.<init>()V
    constructor() {
        super();
        this.useAABBMouseCheck = false;
    }

    // nd.a(I[IIIIZ)V
    // One AnimFrame transform over the vertex groups (labels) var2: type var1 (0 origin, 1 translate, 2 rotate,
    // 3 scale, 5 alpha, 7 HSL), operands var3..var5.
    abstract Animate2(var1: number, var2: Int32Array | null, var3: number, var4: number, var5: number, var6: boolean): void;

    // nd.c()V
    abstract Rotate180(): void;

    // nd.d()I
    abstract getMaxX(): number;

    // nd.e()I
    abstract getMinX(): number;

    // nd.a(IIIIIIIIJILue;)V (redeclares ug.a(IIIIIIIIJILue;)V)
    abstract override draw(var1: number, var2: number, var3: number, var4: number, var5: number, var6: number, var7: number, var8: number, var9: bigint, var11: number, var12: ParticleSystem | null): void;

    // nd.f()Z
    // False when the model has no vertex labels; otherwise resets the transform origin before an animation.
    abstract beginAnimate(): boolean;

    // nd.a(ZZZ)Lnd; (NXT CopyForAnim, scratch slot fc.V)
    abstract CopyForAnimSpot(var1: boolean, var2: boolean, var3: boolean): ModelLit;

    // nd.a([[IIIIII)V
    // Tilts and raises the model to the heightmap var1 under a var5 x var6 footprint centred on (var2, var4); var3 is
    // the model's base height. Same routine as ModelUnlit.tiltToGround (cb.a([[IIIIII)V).
    tiltToGround(var1: (Int32Array | null)[] | null, var2: number, var3: number, var4: number, var5: number, var6: number): void {
        let var7 = 0;
        let var8 = 0;
        let var9 = 0;
        const var10 = ((-var5 | 0) / 2) | 0;
        const var11 = ((-var6 | 0) / 2) | 0;
        const var12 = ModelLit.getHeightAt(var1, (var2 + var10) | 0, (var4 + var11) | 0);
        const var13 = (var5 / 2) | 0;
        const var14 = ((-var6 | 0) / 2) | 0;
        const var15 = ModelLit.getHeightAt(var1, (var2 + var13) | 0, (var4 + var14) | 0);
        const var16 = ((-var5 | 0) / 2) | 0;
        const var17 = (var6 / 2) | 0;
        const var18 = ModelLit.getHeightAt(var1, (var2 + var16) | 0, (var4 + var17) | 0);
        const var19 = (var5 / 2) | 0;
        const var20 = (var6 / 2) | 0;
        const var21 = ModelLit.getHeightAt(var1, (var2 + var19) | 0, (var4 + var20) | 0);
        const var22 = var12 < var15 ? var12 : var15;
        const var23 = var18 < var21 ? var18 : var21;
        const var24 = var15 < var21 ? var15 : var21;
        const var25 = var12 < var18 ? var12 : var18;
        if (var6 !== 0) {
            // atan2 is in [-pi, pi], so the product is within +-1025 and the d2i cannot saturate.
            var7 = ((Math.atan2((var22 - var23) | 0, var6) * 325.95) | 0) & 2047;
            if (var7 !== 0) {
                this.RotateXAxis(var7);
            }
        }

        if (var5 !== 0) {
            var8 = ((Math.atan2((var25 - var24) | 0, var5) * 325.95) | 0) & 2047;
            if (var8 !== 0) {
                this.rotateZAxis(var8);
            }
        }

        var9 = (var12 + var21) | 0;
        if (((var15 + var18) | 0) < var9) {
            var9 = (var15 + var18) | 0;
        }

        var9 = ((var9 >> 1) - var3) | 0;
        if (var9 !== 0) {
            this.Translate(0, var9, 0);
        }
    }

    // nd.a(I[IIIIZI[I)V
    // Animate2 restricted to the vertices/faces whose part mask (ModelUnlit.pointPartMask/facePartMask) meets var7,
    // with var8 = an optional 3x3 rotation (0..8) plus two translations (9..11, 12..14) in 1/32768 fixed point.
    abstract animate2Masked(var1: number, var2: Int32Array | null, var3: number, var4: number, var5: number, var6: boolean, var7: number, var8: Int32Array | null): void;

    // nd.a(IIIII)V (overrides ug.a(IIIII)V; empty and final: a lit model has no per-cycle update)
    override update(_var1: number, _var2: number, _var3: number, _var4: number, _var5: number): void {}

    // nd.a(I)V
    // Rotates in the x/y plane (roll).
    abstract rotateZAxis(var1: number): void;

    // nd.b(III)V
    abstract Translate(var1: number, var2: number, var3: number): void;

    // nd.g()I
    abstract GetRadiusCylinder(): number;

    // nd.h()V
    abstract Rotate90(): void;

    // nd.a(Lok;Lof;Lof;II[ZZZI[I)V (NXT MaskAnimate, the AnimBase overload)
    // Applies frame var2 of base var1, tweened var4/var5 of the way toward frame var3 when var3 is non-null and var4 is
    // not 0. var6 (when non-null) selects the base parts to apply: a part runs when var6[part] == var7 or its type is 0.
    // var9 is the part mask (65535 = every part) and var10 the transform matrix for animate2Masked.
    private MaskAnimate(var1: AnimBase | null, var2: AnimFrame | null, var3: AnimFrame | null, var4: number, var5: number, var6: boolean[] | null, var7: boolean, var8: boolean, var9: number, var10: Int32Array | null): void {
        if (var3 === null || var4 === 0) {
            if (var2 === null) {
                // getfield of.b in the loop test, before anything else runs.
                throw new TypeError('Null reference');
            }

            for (let var11 = 0; var11 < var2.size; var11++) {
                const var12 = arrayAtI16(var2.ti, var11);
                if (var6 === null || arrayAtObj(var6, var12) === var7 || arrayAtI32(requireNonNull(var1).type, var12) === 0) {
                    const var13 = arrayAtI16(var2.prevOrigin, var11);
                    if (var13 !== -1) {
                        const var14 = var9 & arrayAtI32(requireNonNull(var1).partMasks, var13);
                        if (var14 !== 65535) {
                            this.animate2Masked(0, arrayAtObj(requireNonNull(var1).labels, var13), 0, 0, 0, var8, var14, var10);
                        } else {
                            this.Animate2(0, arrayAtObj(requireNonNull(var1).labels, var13), 0, 0, 0, var8);
                        }
                    }

                    const var37 = var9 & arrayAtI32(requireNonNull(var1).partMasks, var12);
                    if (var37 !== 65535) {
                        this.animate2Masked(arrayAtI32(requireNonNull(var1).type, var12), arrayAtObj(requireNonNull(var1).labels, var12), arrayAtI16(var2.tx, var11), arrayAtI16(var2.ty, var11), arrayAtI16(var2.tz, var11), var8, var37, var10);
                    } else {
                        this.Animate2(arrayAtI32(requireNonNull(var1).type, var12), arrayAtObj(requireNonNull(var1).labels, var12), arrayAtI16(var2.tx, var11), arrayAtI16(var2.ty, var11), arrayAtI16(var2.tz, var11), var8);
                    }
                }
            }

            return;
        }

        if (var1 === null) {
            // getfield ok.y in the loop test, before anything else runs.
            throw new TypeError('Null reference');
        }

        let var34 = 0;
        let var35 = 0;

        for (let var36 = 0; var36 < var1.size; var36++) {
            let var38 = false;
            if (var34 < requireNonNull(var2).size && arrayAtI16(requireNonNull(var2).ti, var34) === var36) {
                var38 = true;
            }

            let var15 = false;
            if (var35 < var3.size && arrayAtI16(var3.ti, var35) === var36) {
                var15 = true;
            }

            if (var38 || var15) {
                if (var6 !== null && arrayAtObj(var6, var36) !== var7 && arrayAtI32(var1.type, var36) !== 0) {
                    if (var38) {
                        var34++;
                    }

                    if (var15) {
                        var35++;
                    }
                } else {
                    let var16 = 0;
                    const var17 = arrayAtI32(var1.type, var36);
                    if (var17 === 3) {
                        var16 = 128;
                    }

                    let var18: number;
                    let var19: number;
                    let var20: number;
                    let var21: number;
                    let var22: number;
                    if (var38) {
                        const frame = requireNonNull(var2);
                        var18 = arrayAtI16(frame.tx, var34);
                        var19 = arrayAtI16(frame.ty, var34);
                        var20 = arrayAtI16(frame.tz, var34);
                        var21 = arrayAtI16(frame.prevOrigin, var34);
                        // baload: of.n is a byte[].
                        var22 = (arrayAtU8(frame.flags, var34) << 24) >> 24;
                        var34++;
                    } else {
                        var18 = var16;
                        var19 = var16;
                        var20 = var16;
                        var21 = -1;
                        var22 = 0;
                    }

                    let var23: number;
                    let var24: number;
                    let var25: number;
                    let var26: number;
                    let var27: number;
                    if (var15) {
                        var23 = arrayAtI16(var3.tx, var35);
                        var24 = arrayAtI16(var3.ty, var35);
                        var25 = arrayAtI16(var3.tz, var35);
                        var26 = arrayAtI16(var3.prevOrigin, var35);
                        var27 = (arrayAtU8(var3.flags, var35) << 24) >> 24;
                        var35++;
                    } else {
                        var23 = var16;
                        var24 = var16;
                        var25 = var16;
                        var26 = -1;
                        var27 = 0;
                    }

                    let var28: number;
                    let var29: number;
                    let var30: number;
                    if ((var22 & 2) !== 0 || (var27 & 1) !== 0) {
                        var28 = var18;
                        var29 = var19;
                        var30 = var20;
                    } else if (var17 === 2) {
                        let var31 = (var23 - var18) & 2047;
                        let var32 = (var24 - var19) & 2047;
                        let var33 = (var25 - var20) & 2047;
                        if (var31 >= 1024) {
                            var31 -= 2048;
                        }

                        if (var32 >= 1024) {
                            var32 -= 2048;
                        }

                        if (var33 >= 1024) {
                            var33 -= 2048;
                        }

                        var28 = (var18 + intDivide(Math.imul(var31, var4), var5)) & 2047;
                        var29 = (var19 + intDivide(Math.imul(var32, var4), var5)) & 2047;
                        var30 = (var20 + intDivide(Math.imul(var33, var4), var5)) & 2047;
                    } else if (var17 === 7) {
                        let var39 = (var23 - var18) & 63;
                        if (var39 >= 32) {
                            var39 -= 64;
                        }

                        var28 = (var18 + intDivide(Math.imul(var39, var4), var5)) & 63;
                        var29 = (var19 + intDivide(Math.imul((var24 - var19) | 0, var4), var5)) | 0;
                        var30 = (var20 + intDivide(Math.imul((var25 - var20) | 0, var4), var5)) | 0;
                    } else {
                        var28 = (var18 + intDivide(Math.imul((var23 - var18) | 0, var4), var5)) | 0;
                        var29 = (var19 + intDivide(Math.imul((var24 - var19) | 0, var4), var5)) | 0;
                        var30 = (var20 + intDivide(Math.imul((var25 - var20) | 0, var4), var5)) | 0;
                    }

                    if (var21 !== -1) {
                        const var40 = var9 & arrayAtI32(var1.partMasks, var21);
                        if (var40 !== 65535) {
                            this.animate2Masked(0, arrayAtObj(var1.labels, var21), 0, 0, 0, var8, var40, var10);
                        } else {
                            this.Animate2(0, arrayAtObj(var1.labels, var21), 0, 0, 0, var8);
                        }
                    } else if (var26 !== -1) {
                        const var41 = var9 & arrayAtI32(var1.partMasks, var26);
                        if (var41 !== 65535) {
                            this.animate2Masked(0, arrayAtObj(var1.labels, var26), 0, 0, 0, var8, var41, var10);
                        } else {
                            this.Animate2(0, arrayAtObj(var1.labels, var26), 0, 0, 0, var8);
                        }
                    }

                    const var42 = var9 & arrayAtI32(var1.partMasks, var36);
                    if (var42 !== 65535) {
                        this.animate2Masked(var17, arrayAtObj(var1.labels, var36), var28, var29, var30, var8, var42, var10);
                    } else {
                        this.Animate2(var17, arrayAtObj(var1.labels, var36), var28, var29, var30, var8);
                    }
                }
            }
        }
    }

    // nd.a(IIIIIIIJ)V (NXT SoftwareModelLitRenderer::ObjRender)
    // Perspective draw for interface models: var1..var4 = pitch, yaw, roll and eye pitch angles, (var5, var6, var7) =
    // the eye offset, var8 = the pick typecode (negative: not pickable).
    abstract ObjRender(var1: number, var2: number, var3: number, var4: number, var5: number, var6: number, var7: number, var8: bigint): void;

    // nd.b()I (redeclares ug.b()I)
    abstract override getMinY(): number;

    // nd.a(Lhf;ILhf;IIIZ)V (NXT Animate)
    // Frame var2 of var1, tweened var5/var6 of the way toward frame var4 of var3 (dropped when its base differs).
    Animate(var1: AnimFrameSet | null, var2: number, var3: AnimFrameSet | null, var4: number, var5: number, var6: number, var7: boolean): void {
        if (var2 === -1) {
            return;
        }

        if (!this.beginAnimate()) {
            return;
        }

        const var8 = requireNonNull(arrayAtObj(requireNonNull(var1).frames, var2));
        const var9 = var8.base;
        let var10: AnimFrame | null = null;
        if (var3 !== null) {
            var10 = requireNonNull(arrayAtObj(var3.frames, var4));
            if (var10.base !== var9) {
                var10 = null;
            }
        }

        this.MaskAnimate(var9, var8, var10, var5, var6, null, false, var7, 65535, null);
        this.endAnimate();
    }

    // nd.i()V
    // After an animation: re-lights the faces a type-7 (HSL) transform recoloured and invalidates the bounds.
    abstract endAnimate(): void;

    // nd.a(IIII)V
    // An Animate2 transform applied to every vertex (types 0..3) or face (5, 7), with no labels.
    abstract animateAll(var1: number, var2: number, var3: number, var4: number): void;

    // nd.c(III)V
    abstract Resize(var1: number, var2: number, var3: number): void;

    // nd.j()I
    abstract getMinZ(): number;

    // nd.b(I)V
    // Rotates in the y/z plane (pitch).
    abstract RotateXAxis(var1: number): void;

    // nd.k()V
    abstract Rotate270(): void;

    // nd.a([[III)I
    // The bilinear height of the heightmap var0 at (var1, var2) in 1/128 tile units; 0 outside the map. Same routine as
    // ModelUnlit.interpolateHeight (cb.a([[III)I).
    private static getHeightAt(var0: (Int32Array | null)[] | null, var1: number, var2: number): number {
        const var3 = var1 >> 7;
        const var4 = var2 >> 7;
        if (var3 < 0 || var4 < 0 || var3 >= requireNonNull(var0).length || var4 >= requireNonNull(arrayAtObj(var0, 0)).length) {
            return 0;
        }

        const var5 = var1 & 127;
        const var6 = var2 & 127;
        const var7 = (Math.imul(at2(var0, var3, var4), 128 - var5) + Math.imul(at2(var0, (var3 + 1) | 0, var4), var5)) >> 7;
        const var8 = (Math.imul(at2(var0, var3, (var4 + 1) | 0), 128 - var5) + Math.imul(at2(var0, (var3 + 1) | 0, (var4 + 1) | 0), var5)) >> 7;
        return (Math.imul(var7, 128 - var6) + Math.imul(var8, var6)) >> 7;
    }

    // nd.a(Lhf;ILhf;IIILhf;ILhf;III[ZZ)V (NXT SplitAnimate)
    // Walk-merge: the parts var13 selects (var13[part] == false) follow frame var2 of var1 (tweened toward var4 of var3
    // by var5/var6), the others frame var8 of var7 (tweened toward var10 of var9 by var11/var12). Without a mask or a
    // second frame it is Animate.
    SplitAnimate(
        var1: AnimFrameSet | null,
        var2: number,
        var3: AnimFrameSet | null,
        var4: number,
        var5: number,
        var6: number,
        var7: AnimFrameSet | null,
        var8: number,
        var9: AnimFrameSet | null,
        var10: number,
        var11: number,
        var12: number,
        var13: boolean[] | null,
        var14: boolean
    ): void {
        if (var2 === -1) {
            return;
        }

        if (var13 === null || var8 === -1) {
            this.Animate(var1, var2, var3, var4, var5, var6, var14);
            return;
        }

        if (!this.beginAnimate()) {
            return;
        }

        const var15 = requireNonNull(arrayAtObj(requireNonNull(var1).frames, var2));
        const var16 = var15.base;
        let var17: AnimFrame | null = null;
        if (var3 !== null) {
            var17 = requireNonNull(arrayAtObj(var3.frames, var4));
            if (var17.base !== var16) {
                var17 = null;
            }
        }

        const var18 = arrayAtObj(requireNonNull(var7).frames, var8);
        let var19: AnimFrame | null = null;
        if (var9 !== null) {
            var19 = requireNonNull(arrayAtObj(var9.frames, var10));
            if (var19.base !== var16) {
                var19 = null;
            }
        }

        this.MaskAnimate(var16, var15, var17, var5, var6, var13, false, var14, 65535, null);
        this.Animate2(0, new Int32Array(0), 0, 0, 0, var14);
        this.MaskAnimate(var16, var18, var19, var11, var12, var13, true, var14, 65535, null);
        this.endAnimate();
    }

    // nd.a(Lhf;ILhf;IIIIZ[I)V
    // Animate with a part mask (var7) and a transform matrix (var9) passed through to animate2Masked.
    animateMasked(var1: AnimFrameSet | null, var2: number, var3: AnimFrameSet | null, var4: number, var5: number, var6: number, var7: number, var8: boolean, var9: Int32Array | null): void {
        if (var2 === -1) {
            return;
        }

        if (!this.beginAnimate()) {
            return;
        }

        const var10 = requireNonNull(arrayAtObj(requireNonNull(var1).frames, var2));
        const var11 = var10.base;
        let var12: AnimFrame | null = null;
        if (var3 !== null) {
            var12 = requireNonNull(arrayAtObj(var3.frames, var4));
            if (var12.base !== var11) {
                var12 = null;
            }
        }

        this.MaskAnimate(var11, var10, var12, var5, var6, null, false, var8, var7, var9);
        this.endAnimate();
    }

    // nd.l()I
    abstract getMaxZ(): number;

    // nd.b(ZZZ)Lnd; (NXT CopyForAnim, scratch slot fc.k)
    abstract CopyForAnimActor(var1: boolean, var2: boolean, var3: boolean): ModelLit;

    // nd.a(Lhf;I)V
    // Frame var2 of var1 limited to the transforms whose AnimBase.shadow flag is set, applied to the whole model
    // (animateAll). Used for the actor shadow model.
    animateShadow(var1: AnimFrameSet | null, var2: number): void {
        if (var2 === -1) {
            return;
        }

        if (!this.beginAnimate()) {
            return;
        }

        const var3 = requireNonNull(arrayAtObj(requireNonNull(var1).frames, var2));
        const var4 = var3.base;

        for (let var5 = 0; var5 < var3.size; var5++) {
            const var6 = arrayAtI16(var3.ti, var5);
            if (arrayAtObj(requireNonNull(var4).shadow, var6)) {
                if (arrayAtI16(var3.prevOrigin, var5) !== -1) {
                    this.animateAll(0, 0, 0, 0);
                }

                this.animateAll(arrayAtI32(requireNonNull(var4).type, var6), arrayAtI16(var3.tx, var5), arrayAtI16(var3.ty, var5), arrayAtI16(var3.tz, var5));
            }
        }

        this.endAnimate();
    }

    // nd.c(I)V
    // Rotates in the x/z plane (yaw).
    abstract RotateYAxis(var1: number): void;

    // nd.c(ZZZ)Lnd; (NXT CopyForAnim, scratch slot fc.cb)
    abstract CopyForAnimLoc(var1: boolean, var2: boolean, var3: boolean): ModelLit;
}

// An int[][] element load (aaload, then iaload), each throwing where the JVM would.
function at2(array: (Int32Array | null)[] | null, i: number, j: number): number {
    return arrayAtI32(arrayAtObj(array, i), j);
}
