import { glJar } from '#/client/ClientVariant';
import { isJavaRuntimeException } from '#/util/JavaException';
import WrappedException from '#/util/WrappedException';
import { byteAt, putByte } from '#/io/JavaByteArray';
import ArrayUtils from '#/util/ArrayUtils';
import { JavaError } from '#/util/ClientError';
import { doubleToInt, intDivide } from '#/util/IntUtils';
import { arrayAtI16, arrayAtI32, arrayAtObj, arrayPutB64, arrayPutI16, arrayPutI32, arrayPutObj, requireNonNull } from '#/util/JavaArray';
import ModelLit from './ModelLit';
import type ModelUnlit from './ModelUnlit';
import type ParticleSystem from './ParticleSystem';
import type PointNormal from './PointNormal';
import Pix3D from './Pix3D';

// Java baload sign-extends. The byte[] fields are Uint8Array here, so a signed read goes through this.
function sbyteAt(bytes: Uint8Array | null, index: number): number {
    return (byteAt(bytes, index) << 24) >> 24;
}

// Render indices are signed Java ints. A typed-array load returns undefined for an
// invalid index; replay that load through the checked JVM helper to raise its fault.
function renderInt(array: Int32Array | null, index: number): number {
    return array?.[index] ?? arrayAtI32(array, index);
}

// A depth/priority row can itself be null. Preserve that successful aaload and
// the later failing element store, which occurs after incrementing its row count.
function renderIntRow(rows: (Int32Array | null)[] | null, index: number): Int32Array | null {
    if (rows !== null && index >>> 0 < rows.length) return rows[index];
    return arrayAtObj(rows, index);
}

// An int[][] element load (aaload, then iaload), each throwing where the JVM would.
function at2(array: (Int32Array | null)[] | null, i: number, j: number): number {
    return arrayAtI32(arrayAtObj(array, i), j);
}

// fc clears both depth-count arrays for each model. A short array must retain
// the stores preceding the first invalid JVM index.
function clearDepthCounts(counts: Int32Array | null, length: number): void {
    if (counts !== null && counts.length >= length) {
        counts.fill(0, 0, length);
        return;
    }
    for (let index = 0; index < length; index++) arrayPutI32(counts, index, 0);
}

// multianewarray [[I: every row allocated.
function int2d(rows: number, columns: number): Int32Array[] {
    const result: Int32Array[] = [];
    for (let i = 0; i < rows; i++) {
        result.push(new Int32Array(columns));
    }
    return result;
}

// catch (RuntimeException) / catch (Exception): every Java exception the port throws is a JS Error; a java.lang.Error
// (JavaError) and anything that is not an Error escape.
function isJavaException(e: unknown): boolean {
    return e instanceof Error && !(e instanceof JavaError);
}

type ModelLitImplArgs = [] | [ModelUnlit | null, number, number, number, number, number] | [(ModelLitImpl | null)[] | null, number];

// fc in the revision 530 SD gamepack (NXT jag::oldscape::dash3d::ModelLitImpl, with the draw half in
// SoftwareModelLitRenderer): the lit software model and the only SD implementation of ModelLit (nd). The lighting
// constructor (NXT ModelUnlitImpl::Light) turns a ModelUnlit (cb) into per-face lit colours (faceColourA/B/C: the
// gouraud HSL+lightness per vertex, faceColourC = -1 for a flat face, -2 for a hidden one) and shares the unlit
// model's geometry arrays. Here are the animation transforms (Animate2 and its masked/matrix and whole-model
// variants), the rigid transforms, the three CopyForAnim scratch copies, HillSkewCopy, AppendModel (the merge
// constructor), the bounding cylinder, and the three draws (world, perspective object, orthographic object) with
// their shared projection scratch, the depth/priority sort (Render2), face draw (Render3) and near-plane clip
// (Render3ZClip), plus the mouse picking that records typecodes into ModelLit.pickedTypecodes.
//
// The obfuscator left this class clean: no invocation counters, dummy parameters, od.a wrappers or client.wb
// predicates. The three catch blocks are the jar's own: ObjRender and ObjRenderOrthog catch RuntimeException and the
// world draw catches Exception around Render2, so a model with more than 4096 vertices or a full depth bucket simply
// stops drawing. Block layout follows the bytecode where the decompiler restructured it: the face draws test the
// untextured case first, a(IIII)V tests its types in the order 0, 1, 2, 3, 5, 7, the three transform dispatchers
// (a(IIII)V, Animate2, animate2Masked) end every type arm (and the matrix arm of the masked types 2 and 3) with its own
// return instead of the decompiler's else-if chain, and the visible-face clip flag sets true in the first arm. The decompiler mislabelled the projected x/y locals in draw (fc.java 2127-2190 uses the x
// for both); draw names those locals after the bytecode slots.
//
// Int arithmetic is Java's: Math.imul for *, | 0 after + and -, (a / b) | 0 where the divisor is provably non-zero
// and intDivide where it can be 0. Every field and static array access goes through arrayAt/arrayPut/byteAt/putByte
// (the statics are nulled by unload), so a null array or a bad index throws at Java's load or store. Short fields hold
// the (short) value and byte fields the (byte) value.
//
// Statics placed here by the member map: every fc static, a.a(I[III[I)V (quicksort) and rg.g (mouseX).
// fc.m()V nulls only fc's own statics, so it is ported as unload(). HD only: w.m()V and w.o()V (allocateGlScratch,
// allocateSoftwareScratch), which swap the two sort modes' scratch on a window-mode switch.
export default class ModelLitImpl extends ModelLit {
    // Static fields in fc.<clinit> store order.

    // fc.k:Lfc;
    // NXT m_tempModel: the CopyForAnimActor scratch model.
    private static tempActorModel: ModelLitImpl | null = new ModelLitImpl();
    // fc.P:[S
    private static tempActorFaceColour: Int16Array | null = new Int16Array(1);
    // fc.O:[I
    private static tempActorFaceColourA: Int32Array | null = new Int32Array(1);
    // fc.W:[I
    private static tempActorFaceColourC: Int32Array | null = new Int32Array(1);
    // fc.X:[I
    private static tempActorFaceColourB: Int32Array | null = new Int32Array(1);
    // fc.T:[B
    private static tempActorFaceAlpha: Uint8Array | null = new Uint8Array(1);
    // fc.V:Lfc;
    // The CopyForAnimSpot scratch model.
    private static tempSpotModel: ModelLitImpl | null = new ModelLitImpl();
    // fc.ab:[I
    private static tempSpotFaceColourB: Int32Array | null = new Int32Array(1);
    // fc.bb:[I
    private static tempSpotFaceColourA: Int32Array | null = new Int32Array(1);
    // fc.eb:[S
    private static tempSpotFaceColour: Int16Array | null = new Int16Array(1);
    // fc.db:[B
    private static tempSpotFaceAlpha: Uint8Array | null = new Uint8Array(1);
    // fc.fb:[I
    private static tempSpotFaceColourC: Int32Array | null = new Int32Array(1);
    // fc.cb:Lfc;
    // NXT m_tempModel2: the CopyForAnimLoc scratch model.
    private static tempLocModel: ModelLitImpl | null = new ModelLitImpl();
    // fc.hb:[B
    private static tempLocFaceAlpha: Uint8Array | null = new Uint8Array(1);
    // fc.jb:[I
    private static tempLocFaceColourB: Int32Array | null = new Int32Array(1);
    // fc.pb:[Z
    // Per face: a projected vertex is outside [0, Pix3D.width] (copied to Pix3D.hclip by Render3).
    private static faceClippedX: boolean[] | null = new Array<boolean>(4096).fill(false);
    // fc.tb:[I
    private static tmpPriority10FaceDepth: Int32Array | null = new Int32Array(4096);
    // fc.mb:I
    // The next free overflow bucket of tmpExtendedDepthFaces (at most 512 overflow buckets per draw).
    private static extendedDepthBucketCount: number = 0;
    // fc.yb:[Z
    // Per face: a vertex is behind the near plane (screen x -5000), so Render3 sends it to Render3ZClip.
    private static faceNearClipped: boolean[] | null = new Array<boolean>(4096).fill(false);
    // fc.rb:[I
    private static vertexViewSpaceY: Int32Array | null = new Int32Array(4096);
    // fc.Bb:[I
    private static vertexScreenZ: Int32Array | null = new Int32Array(4096);
    // fc.wb:[I
    private static tmpPriority11FaceDepth: Int32Array | null = new Int32Array(4096);
    // fc.vb:[[I
    private static tmpPriorityFaces: Int32Array[] | null = int2d(12, 4096);
    // fc.Ab:[I
    // Receives the particle entries (>= 65536) of the depth buckets; never read in the SD client.
    private static deferredParticleIndices: Int32Array | null = new Int32Array(8192);
    // fc.Fb:[I
    private static vertexViewSpaceX: Int32Array | null = new Int32Array(4096);
    // SD fc.Gb:Z / HD w.Ob:Z
    // Render2 sorts the faces with the quicksort over sortFaceDepths instead of the 1600 depth buckets. Both
    // <clinit>s store false. SD never stores it again; HD sets it on entering a GL mode (allocateGlScratch, w.m()V)
    // and clears it on returning to software (allocateSoftwareScratch, w.o()V).
    private static useQuickSort: boolean = false;
    // fc.Hb:[I
    private static tmpPriorityDepthSum: Int32Array | null = new Int32Array(12);
    // fc.Ib:Z
    // Set when a masked type-0 transform computed a new origin; the next matrix transform moves it once and clears it.
    private static originTransformPending: boolean = false;
    // fc.Lb:[S
    private static tempLocFaceColour: Int16Array | null = new Int16Array(1);
    // fc.zb:[I
    private static tempLocFaceColourC: Int32Array | null = new Int32Array(1);
    // fc.Db:[I
    private static clippedX: Int32Array | null = new Int32Array(10);

    // The two sort modes' scratch. The HD identities are the arrays at the same positions in the paired Render2
    // bodies (SD fc.a(ZZJIILue;)V / HD w.a(ZZJIILga;)V): the bucket clear loops (ib/Sb over 1600, kb/Hb over 32), the
    // quicksort stores (gb/Db = the face depth (z0 + z1 + z2) / 3, sb/Bb = the face index) and the quicksort call
    // (SD a.a(I[III[I)V / HD nj.a(IIZ[I[I)V take gb/Db as the keys and sb/Bb as the values).

    // SD fc.gb:[I / HD w.Db:[I
    private static sortFaceDepths: Int32Array | null = null;
    // SD fc.sb:[I / HD w.Bb:[I
    private static sortFaceIndices: Int32Array | null = null;
    // SD fc.ib:[I / HD w.Sb:[I
    private static tmpDepthFaceCount: Int32Array | null = null;
    // SD fc.lb:[[I / HD w.yb:[[I
    private static tmpDepthFaces: Int32Array[] | null = null;
    // SD fc.kb:[I / HD w.Hb:[I
    private static tmpExtendedDepthFaceCount: Int32Array | null = null;
    // SD fc.ub:[[I / HD w.vb:[[I
    private static tmpExtendedDepthFaces: Int32Array[] | null = null;

    // The Gb-dependent part of fc.<clinit> (the Ob-dependent part of w.<clinit>, the same four arrays).
    static {
        if (ModelLitImpl.useQuickSort) {
            ModelLitImpl.sortFaceDepths = new Int32Array(4096);
            ModelLitImpl.sortFaceIndices = new Int32Array(4096);
        } else {
            ModelLitImpl.tmpDepthFaceCount = new Int32Array(1600);
            ModelLitImpl.tmpDepthFaces = int2d(1600, 64);
            ModelLitImpl.tmpExtendedDepthFaceCount = new Int32Array(32);
            ModelLitImpl.tmpExtendedDepthFaces = int2d(32, 512);
        }
    }

    // fc.nb:[I
    private static tmpPriorityFaceCount: Int32Array | null = new Int32Array(12);
    // fc.qb:[I
    private static clippedColour: Int32Array | null = new Int32Array(10);
    // fc.Eb:[I
    private static clippedY: Int32Array | null = new Int32Array(10);
    // fc.Mb:[I
    private static vertexViewSpaceZ: Int32Array | null = new Int32Array(4096);
    // fc.Jb:[I
    private static vertexScreenX: Int32Array | null = new Int32Array(4096);
    // fc.Cb:[I
    private static vertexScreenY: Int32Array | null = new Int32Array(4096);
    // fc.Nb:[I
    private static tempLocFaceColourA: Int32Array | null = new Int32Array(1);

    // Statics fc.<clinit> does not store (JVM default 0).

    // fc.ob:I
    // NXT m_oX: the animation transform origin.
    private static originX: number = 0;
    // fc.Kb:I
    // NXT m_oY.
    private static originY: number = 0;
    // fc.xb:I
    // NXT m_oZ.
    private static originZ: number = 0;
    // rg.g:I
    // The mouse x relative to the viewport centre (ModelLit.mouseY is the y), set by the scene draw.
    static mouseX: number = 0;

    // Instance fields in fc's declaration order. F, D, A, y, m and K are the six that every fc.<init> stores
    // explicitly (in that order); the rest keep the JVM defaults until a constructor or copy fills them.

    // fc.l:[I
    // Per face, the lit colour of vertex A (HSL with the lightness in the low 7 bits; bits 17+ keep the light level).
    private faceColourA: Int32Array | null = null;
    // fc.m:Z
    // A type-7 (HSL) transform changed faceColour: endAnimate re-lights.
    private relightPending: boolean = false;
    // fc.n:[I
    // Per kept texture axis, the vertex for texture-space M.
    private faceTextureM: Int32Array | null = null;
    // fc.o:S
    private maxZ: number = 0;
    // fc.p:S
    private minY: number = 0;
    // fc.q:[I
    pointY: Int32Array | null = null;
    // fc.r:[I
    private faceVertexA: Int32Array | null = null;
    // fc.s:S
    // The bounding sphere radius (CalcBoundingCylinder); ObjRender sorts faces within twice it.
    private radiusSphere: number = 0;
    // fc.t:[S
    // Per face, the HSL colour (shared with the source ModelUnlit's faceColour).
    private faceColour: Int16Array | null = null;
    // fc.u:[S
    // Per face, the part mask (ModelUnlit.facePartMask).
    private facePartMask: Int16Array | null = null;
    // fc.v:[I
    pointZ: Int32Array | null = null;
    // fc.w:S
    private maxY: number = 0;
    // fc.x:[B
    // Per face, the index into faceTextureP/M/N (-1 = the face's own vertices).
    private faceTextureAxis: Uint8Array | null = null;
    // fc.y:I
    private numFaces: number;
    // fc.z:[I
    // Per kept texture axis, the vertex for texture-space P.
    private faceTextureP: Int32Array | null = null;
    // fc.A:B
    // The model-wide face priority when facePriority is null (-1 in a merge of mixed priorities).
    private priority: number;
    // fc.B:S
    private maxX: number = 0;
    // fc.C:S
    // NXT m_radiusCylinder: the xz radius of the bounding cylinder.
    private radiusCylinder: number = 0;
    // fc.D:I
    numPoints: number;
    // fc.E:[S
    // Per face, the material id when the texture is available, else -1 (null = no textured faces).
    private faceMaterial: Int16Array | null = null;
    // fc.F:I
    // The number of texture axes kept (type 0 axes with at least one face).
    private numT: number;
    // fc.G:[S
    // Per vertex, the part mask (ModelUnlit.pointPartMask).
    private pointPartMask: Int16Array | null = null;
    // fc.H:[I
    // Per kept texture axis, the vertex for texture-space N.
    private faceTextureN: Int32Array | null = null;
    // fc.I:[B
    private facePriority: Uint8Array | null = null;
    // fc.J:[I
    private faceVertexC: Int32Array | null = null;
    // fc.K:Z
    // Set by CalcBoundingCylinder, cleared by every geometry change.
    boundsCalculated: boolean;
    // fc.L:[I
    // Per face, the lit colour of vertex C; -1 = flat (faceColourA only), -2 = not drawn.
    private faceColourC: Int32Array | null = null;
    // fc.M:[I
    private faceColourB: Int32Array | null = null;
    // fc.N:[I
    private faceVertexB: Int32Array | null = null;
    // fc.Q:S
    private minX: number = 0;
    // fc.R:[B
    private faceAlpha: Uint8Array | null = null;
    // fc.S:S
    private minZ: number = 0;
    // fc.U:[I
    pointX: Int32Array | null = null;
    // fc.Y:[[I
    private labelVertices: (Int32Array | null)[] | null = null;
    // fc.Z:[[I
    private labelFaces: (Int32Array | null)[] | null = null;

    // fc.<init>()V
    constructor();
    // fc.<init>(Lcb;IIIII)V (NXT ModelUnlitImpl::Light): var2 = ambient, var3 = contrast, (var4, var5, var6) = the
    // light direction.
    constructor(var1: ModelUnlit | null, var2: number, var3: number, var4: number, var5: number, var6: number);
    // fc.<init>([Lfc;I)V (private in Java; used by AppendModel)
    constructor(var1: (ModelLitImpl | null)[] | null, var2: number);
    constructor(...args: ModelLitImplArgs) {
        super();
        // The field initializers that every fc.<init> runs after nd.<init>.
        this.numT = 0;
        this.numPoints = 0;
        this.priority = 0;
        this.numFaces = 0;
        this.relightPending = false;
        this.boundsCalculated = false;

        if (args.length === 0) {
            // fc.<init>()V
            return;
        }

        if (args.length === 6) {
            // fc.<init>(Lcb;IIIII)V
            const [var1, var2, var3, var4, var5, var6] = args;
            if (var1 === null) {
                // invokevirtual cb.e()V on null.
                throw new TypeError('Null reference');
            }

            var1.CalculateNormals();
            var1.PrepareAnim();
            this.numPoints = var1.numPoints;
            this.pointX = var1.pointX;
            this.pointY = var1.pointY;
            this.pointZ = var1.pointZ;
            this.numFaces = var1.numFaces;
            this.faceVertexA = var1.faceVertexA;
            this.faceVertexB = var1.faceVertexB;
            this.faceVertexC = var1.faceVertexC;
            this.facePriority = var1.facePriority;
            this.faceAlpha = var1.faceAlpha;
            this.priority = var1.priority;
            this.faceColour = var1.faceColour;
            this.labelVertices = var1.labelVertices;
            this.labelFaces = var1.labelFaces;
            this.facePartMask = var1.facePartMask;
            this.pointPartMask = var1.pointPartMask;
            // The int sum can wrap negative: sqrt is then NaN and d2i gives 0.
            const var7 = doubleToInt(Math.sqrt((Math.imul(var4, var4) + Math.imul(var5, var5) + Math.imul(var6, var6)) | 0));
            const var8 = Math.imul(var3, var7) >> 8;
            this.faceColourA = new Int32Array(this.numFaces);
            this.faceColourB = new Int32Array(this.numFaces);
            this.faceColourC = new Int32Array(this.numFaces);
            if (var1.faceMaterial !== null) {
                this.faceMaterial = new Int16Array(this.numFaces);

                for (let var9 = 0; var9 < this.numFaces; var9++) {
                    const var10 = arrayAtI16(var1.faceMaterial, var9);
                    if (var10 !== -1 && requireNonNull(Pix3D.textureProvider).isAvailable(var10)) {
                        arrayPutI16(this.faceMaterial, var9, var10);
                    } else {
                        arrayPutI16(this.faceMaterial, var9, -1);
                    }
                }
            } else {
                this.faceMaterial = null;
            }

            if (var1.numT > 0 && var1.faceTextureAxis !== null) {
                const var16 = new Int32Array(var1.numT);

                for (let var18 = 0; var18 < this.numFaces; var18++) {
                    if (sbyteAt(var1.faceTextureAxis, var18) !== -1) {
                        const var19 = byteAt(var1.faceTextureAxis, var18) & 255;
                        arrayPutI32(var16, var19, (arrayAtI32(var16, var19) + 1) | 0);
                    }
                }

                this.numT = 0;

                for (let var11 = 0; var11 < var1.numT; var11++) {
                    if (var16[var11] > 0 && sbyteAt(var1.textureType, var11) === 0) {
                        this.numT = (this.numT + 1) | 0;
                    }
                }

                this.faceTextureP = new Int32Array(this.numT);
                this.faceTextureM = new Int32Array(this.numT);
                this.faceTextureN = new Int32Array(this.numT);
                let var12 = 0;

                for (let var13 = 0; var13 < var1.numT; var13++) {
                    if (var16[var13] > 0 && sbyteAt(var1.textureType, var13) === 0) {
                        arrayPutI32(this.faceTextureP, var12, arrayAtI16(var1.faceTextureP, var13) & 65535);
                        arrayPutI32(this.faceTextureM, var12, arrayAtI16(var1.faceTextureM, var13) & 65535);
                        arrayPutI32(this.faceTextureN, var12, arrayAtI16(var1.faceTextureN, var13) & 65535);
                        var16[var13] = var12++;
                    } else {
                        var16[var13] = -1;
                    }
                }

                this.faceTextureAxis = new Uint8Array(this.numFaces);

                for (let var14 = 0; var14 < this.numFaces; var14++) {
                    if (sbyteAt(var1.faceTextureAxis, var14) !== -1) {
                        putByte(this.faceTextureAxis, var14, arrayAtI32(var16, byteAt(var1.faceTextureAxis, var14) & 255));
                        if (sbyteAt(this.faceTextureAxis, var14) === -1 && this.faceMaterial !== null) {
                            arrayPutI16(this.faceMaterial, var14, -1);
                        }
                    } else {
                        putByte(this.faceTextureAxis, var14, -1);
                    }
                }
            }

            for (let var17 = 0; var17 < this.numFaces; var17++) {
                let var19: number;
                if (var1.faceRenderType === null) {
                    var19 = 0;
                } else {
                    var19 = sbyteAt(var1.faceRenderType, var17);
                }

                let var20: number;
                if (var1.faceAlpha === null) {
                    var20 = 0;
                } else {
                    var20 = sbyteAt(var1.faceAlpha, var17);
                }

                let var21: number;
                if (this.faceMaterial === null) {
                    var21 = -1;
                } else {
                    var21 = arrayAtI16(this.faceMaterial, var17);
                }

                if (var20 === -2) {
                    var19 = 3;
                }

                if (var20 === -1) {
                    var19 = 2;
                }

                if (var21 === -1) {
                    if (var19 === 0) {
                        const var15 = arrayAtI16(var1.faceColour, var17) & 65535;
                        let var22: PointNormal = requireNonNull(
                            var1.sharedPointNormal !== null && arrayAtObj(var1.sharedPointNormal, arrayAtI32(this.faceVertexA, var17)) !== null
                                ? arrayAtObj(var1.sharedPointNormal, arrayAtI32(this.faceVertexA, var17))
                                : arrayAtObj(var1.pointNormal, arrayAtI32(this.faceVertexA, var17))
                        );
                        let var30 = (var2 + intDivide((Math.imul(var4, var22.x) + Math.imul(var5, var22.y) + Math.imul(var6, var22.z)) | 0, Math.imul(var8, var22.w))) << 17;
                        arrayPutI32(this.faceColourA, var17, var30 | ModelLitImpl.GetColour(var15, var30 >> 17));
                        var22 = requireNonNull(
                            var1.sharedPointNormal !== null && arrayAtObj(var1.sharedPointNormal, arrayAtI32(this.faceVertexB, var17)) !== null
                                ? arrayAtObj(var1.sharedPointNormal, arrayAtI32(this.faceVertexB, var17))
                                : arrayAtObj(var1.pointNormal, arrayAtI32(this.faceVertexB, var17))
                        );
                        var30 = (var2 + intDivide((Math.imul(var4, var22.x) + Math.imul(var5, var22.y) + Math.imul(var6, var22.z)) | 0, Math.imul(var8, var22.w))) << 17;
                        arrayPutI32(this.faceColourB, var17, var30 | ModelLitImpl.GetColour(var15, var30 >> 17));
                        var22 = requireNonNull(
                            var1.sharedPointNormal !== null && arrayAtObj(var1.sharedPointNormal, arrayAtI32(this.faceVertexC, var17)) !== null
                                ? arrayAtObj(var1.sharedPointNormal, arrayAtI32(this.faceVertexC, var17))
                                : arrayAtObj(var1.pointNormal, arrayAtI32(this.faceVertexC, var17))
                        );
                        var30 = (var2 + intDivide((Math.imul(var4, var22.x) + Math.imul(var5, var22.y) + Math.imul(var6, var22.z)) | 0, Math.imul(var8, var22.w))) << 17;
                        arrayPutI32(this.faceColourC, var17, var30 | ModelLitImpl.GetColour(var15, var30 >> 17));
                    } else if (var19 === 1) {
                        const var25 = requireNonNull(arrayAtObj(var1.faceNormal, var17));
                        const var33 = (var2 + intDivide((Math.imul(var4, var25.x) + Math.imul(var5, var25.y) + Math.imul(var6, var25.z)) | 0, (var8 + ((var8 / 2) | 0)) | 0)) << 17;
                        arrayPutI32(this.faceColourA, var17, var33 | ModelLitImpl.GetColour(arrayAtI16(var1.faceColour, var17) & 65535, var33 >> 17));
                        arrayPutI32(this.faceColourC, var17, -1);
                    } else if (var19 === 3) {
                        arrayPutI32(this.faceColourA, var17, 128);
                        arrayPutI32(this.faceColourC, var17, -1);
                    } else {
                        arrayPutI32(this.faceColourC, var17, -2);
                    }
                } else if (var19 === 0) {
                    let var26: PointNormal = requireNonNull(
                        var1.sharedPointNormal !== null && arrayAtObj(var1.sharedPointNormal, arrayAtI32(this.faceVertexA, var17)) !== null
                            ? arrayAtObj(var1.sharedPointNormal, arrayAtI32(this.faceVertexA, var17))
                            : arrayAtObj(var1.pointNormal, arrayAtI32(this.faceVertexA, var17))
                    );
                    let var34 = (var2 + intDivide((Math.imul(var4, var26.x) + Math.imul(var5, var26.y) + Math.imul(var6, var26.z)) | 0, Math.imul(var8, var26.w))) | 0;
                    arrayPutI32(this.faceColourA, var17, ModelLitImpl.GetTexLight(var34));
                    var26 = requireNonNull(
                        var1.sharedPointNormal !== null && arrayAtObj(var1.sharedPointNormal, arrayAtI32(this.faceVertexB, var17)) !== null
                            ? arrayAtObj(var1.sharedPointNormal, arrayAtI32(this.faceVertexB, var17))
                            : arrayAtObj(var1.pointNormal, arrayAtI32(this.faceVertexB, var17))
                    );
                    var34 = (var2 + intDivide((Math.imul(var4, var26.x) + Math.imul(var5, var26.y) + Math.imul(var6, var26.z)) | 0, Math.imul(var8, var26.w))) | 0;
                    arrayPutI32(this.faceColourB, var17, ModelLitImpl.GetTexLight(var34));
                    var26 = requireNonNull(
                        var1.sharedPointNormal !== null && arrayAtObj(var1.sharedPointNormal, arrayAtI32(this.faceVertexC, var17)) !== null
                            ? arrayAtObj(var1.sharedPointNormal, arrayAtI32(this.faceVertexC, var17))
                            : arrayAtObj(var1.pointNormal, arrayAtI32(this.faceVertexC, var17))
                    );
                    var34 = (var2 + intDivide((Math.imul(var4, var26.x) + Math.imul(var5, var26.y) + Math.imul(var6, var26.z)) | 0, Math.imul(var8, var26.w))) | 0;
                    arrayPutI32(this.faceColourC, var17, ModelLitImpl.GetTexLight(var34));
                } else if (var19 === 1) {
                    const var29 = requireNonNull(arrayAtObj(var1.faceNormal, var17));
                    const var37 = (var2 + intDivide((Math.imul(var4, var29.x) + Math.imul(var5, var29.y) + Math.imul(var6, var29.z)) | 0, (var8 + ((var8 / 2) | 0)) | 0)) | 0;
                    arrayPutI32(this.faceColourA, var17, ModelLitImpl.GetTexLight(var37));
                    arrayPutI32(this.faceColourC, var17, -1);
                } else {
                    arrayPutI32(this.faceColourC, var17, -2);
                }
            }

            return;
        }

        // fc.<init>([Lfc;I)V
        const [var1, var2] = args;
        let var3 = false;
        let var4 = false;
        let var5 = false;
        let var6 = false;
        this.numPoints = 0;
        this.numFaces = 0;
        this.numT = 0;

        this.priority = -1;

        for (let var9 = 0; var9 < var2; var9++) {
            const var10 = arrayAtObj(var1, var9);
            if (var10 !== null) {
                this.numPoints = (this.numPoints + var10.numPoints) | 0;
                this.numFaces = (this.numFaces + var10.numFaces) | 0;
                this.numT = (this.numT + var10.numT) | 0;
                if (var10.facePriority !== null) {
                    var3 = true;
                } else {
                    if (this.priority === -1) {
                        this.priority = var10.priority;
                    }

                    if (this.priority !== var10.priority) {
                        var3 = true;
                    }
                }

                var4 = var4 || var10.faceAlpha !== null;
                var5 = var5 || var10.faceMaterial !== null;
                var6 = var6 || var10.faceTextureAxis !== null;
            }
        }

        this.pointX = new Int32Array(this.numPoints);
        this.pointY = new Int32Array(this.numPoints);
        this.pointZ = new Int32Array(this.numPoints);
        this.faceVertexA = new Int32Array(this.numFaces);
        this.faceVertexB = new Int32Array(this.numFaces);
        this.faceVertexC = new Int32Array(this.numFaces);
        this.faceColourA = new Int32Array(this.numFaces);
        this.faceColourB = new Int32Array(this.numFaces);
        this.faceColourC = new Int32Array(this.numFaces);
        if (var3) {
            this.facePriority = new Uint8Array(this.numFaces);
        }

        if (var4) {
            this.faceAlpha = new Uint8Array(this.numFaces);
        }

        if (var5) {
            this.faceMaterial = new Int16Array(this.numFaces);
        }

        if (var6) {
            this.faceTextureAxis = new Uint8Array(this.numFaces);
        }

        if (this.numT > 0) {
            this.faceTextureP = new Int32Array(this.numT);
            this.faceTextureM = new Int32Array(this.numT);
            this.faceTextureN = new Int32Array(this.numT);
        }

        this.faceColour = new Int16Array(this.numFaces);
        this.numPoints = 0;
        this.numFaces = 0;
        this.numT = 0;

        for (let var17 = 0; var17 < var2; var17++) {
            const var11 = arrayAtObj(var1, var17);
            if (var11 !== null) {
                for (let var12 = 0; var12 < var11.numFaces; var12++) {
                    arrayPutI32(this.faceVertexA, this.numFaces, (arrayAtI32(var11.faceVertexA, var12) + this.numPoints) | 0);
                    arrayPutI32(this.faceVertexB, this.numFaces, (arrayAtI32(var11.faceVertexB, var12) + this.numPoints) | 0);
                    arrayPutI32(this.faceVertexC, this.numFaces, (arrayAtI32(var11.faceVertexC, var12) + this.numPoints) | 0);
                    arrayPutI32(this.faceColourA, this.numFaces, arrayAtI32(var11.faceColourA, var12));
                    arrayPutI32(this.faceColourB, this.numFaces, arrayAtI32(var11.faceColourB, var12));
                    arrayPutI32(this.faceColourC, this.numFaces, arrayAtI32(var11.faceColourC, var12));
                    arrayPutI16(this.faceColour, this.numFaces, arrayAtI16(var11.faceColour, var12));
                    if (var3) {
                        if (var11.facePriority !== null) {
                            putByte(this.facePriority, this.numFaces, byteAt(var11.facePriority, var12));
                        } else {
                            putByte(this.facePriority, this.numFaces, var11.priority);
                        }
                    }

                    if (var4 && var11.faceAlpha !== null) {
                        putByte(this.faceAlpha, this.numFaces, byteAt(var11.faceAlpha, var12));
                    }

                    if (var5) {
                        if (var11.faceMaterial !== null) {
                            arrayPutI16(this.faceMaterial, this.numFaces, arrayAtI16(var11.faceMaterial, var12));
                        } else {
                            arrayPutI16(this.faceMaterial, this.numFaces, -1);
                        }
                    }

                    if (var6) {
                        if (var11.faceTextureAxis !== null && sbyteAt(var11.faceTextureAxis, var12) !== -1) {
                            putByte(this.faceTextureAxis, this.numFaces, (sbyteAt(var11.faceTextureAxis, var12) + this.numT) | 0);
                        } else {
                            putByte(this.faceTextureAxis, this.numFaces, -1);
                        }
                    }

                    this.numFaces = (this.numFaces + 1) | 0;
                }

                for (let var13 = 0; var13 < var11.numT; var13++) {
                    arrayPutI32(this.faceTextureP, this.numT, (arrayAtI32(var11.faceTextureP, var13) + this.numPoints) | 0);
                    arrayPutI32(this.faceTextureM, this.numT, (arrayAtI32(var11.faceTextureM, var13) + this.numPoints) | 0);
                    arrayPutI32(this.faceTextureN, this.numT, (arrayAtI32(var11.faceTextureN, var13) + this.numPoints) | 0);
                    this.numT = (this.numT + 1) | 0;
                }

                for (let var14 = 0; var14 < var11.numPoints; var14++) {
                    arrayPutI32(this.pointX, this.numPoints, arrayAtI32(var11.pointX, var14));
                    arrayPutI32(this.pointY, this.numPoints, arrayAtI32(var11.pointY, var14));
                    arrayPutI32(this.pointZ, this.numPoints, arrayAtI32(var11.pointZ, var14));
                    this.numPoints = (this.numPoints + 1) | 0;
                }
            }
        }
    }

    // fc.b(III)V
    override Translate(var1: number, var2: number, var3: number): void {
        for (let var4 = 0; var4 < this.numPoints; var4++) {
            arrayPutI32(this.pointX, var4, (arrayAtI32(this.pointX, var4) + var1) | 0);
            arrayPutI32(this.pointY, var4, (arrayAtI32(this.pointY, var4) + var2) | 0);
            arrayPutI32(this.pointZ, var4, (arrayAtI32(this.pointZ, var4) + var3) | 0);
        }

        this.boundsCalculated = false;
    }

    // fc.a(Lnd;)Lnd; (NXT AppendModel)
    AppendModel(var1: ModelLit | null): ModelLit {
        if (var1 !== null && !(var1 instanceof ModelLitImpl)) {
            // checkcast fc (a null passes the cast).
            throw new TypeError('ClassCastException: not a ModelLitImpl');
        }

        return new ModelLitImpl([this, var1], 2);
    }

    // fc.j()I
    override getMinZ(): number {
        if (!this.boundsCalculated) {
            this.CalcBoundingCylinder();
        }

        return this.minZ;
    }

    // fc.f()Z
    override beginAnimate(): boolean {
        if (this.labelVertices === null) {
            return false;
        }

        ModelLitImpl.originX = 0;
        ModelLitImpl.originY = 0;
        ModelLitImpl.originZ = 0;
        return true;
    }

    // fc.d(I)I. NXT ModelUnlit::GetTexLight (ModelUnlit.cpp:4850).
    // Clamps a lightness to [2, 126].
    private static GetTexLight(var0: number): number {
        if (var0 < 2) {
            var0 = 2;
        } else if (var0 > 126) {
            var0 = 126;
        }

        return var0;
    }

    // fc.a(II[[I[[IIIIZ)Lfc; (NXT HillSkewCopy)
    // Fits the model to the ground at (var5, var7) with base height var6: type var1 (1 = follow heightmap var3,
    // 2 = follow it below height var2 fading out, 3 = tilt to a footprint packed in var2, 4 = follow heightmap var4
    // plus the model height, 5 = stretch between var3 and var4). var8 = work on a copy (else in place). Returns this
    // unchanged when the footprint is off the map or (every type but 4 and 5) the ground under its corners is flat at
    // var6.
    HillSkewCopy(var1: number, var2: number, var3: (Int32Array | null)[] | null, var4: (Int32Array | null)[] | null, var5: number, var6: number, var7: number, var8: boolean): ModelLitImpl {
        if (!this.boundsCalculated) {
            this.CalcBoundingCylinder();
        }

        let var9 = (var5 + this.minX) | 0;
        let var10 = (var5 + this.maxX) | 0;
        let var11 = (var7 + this.minZ) | 0;
        let var12 = (var7 + this.maxZ) | 0;
        if ((var1 === 1 || var1 === 2 || var1 === 3 || var1 === 5) && (var9 < 0 || (var10 + 128) >> 7 >= requireNonNull(var3).length || var11 < 0 || (var12 + 128) >> 7 >= requireNonNull(arrayAtObj(var3, 0)).length)) {
            return this;
        }

        if (var1 === 4 || var1 === 5) {
            if (var4 === null) {
                return this;
            }

            if (var9 < 0 || (var10 + 128) >> 7 >= var4.length || var11 < 0 || (var12 + 128) >> 7 >= requireNonNull(arrayAtObj(var4, 0)).length) {
                return this;
            }
        } else {
            var9 >>= 7;
            var10 = (var10 + 127) >> 7;
            var11 >>= 7;
            var12 = (var12 + 127) >> 7;
            if (at2(var3, var9, var11) === var6 && at2(var3, var10, var11) === var6 && at2(var3, var9, var12) === var6 && at2(var3, var10, var12) === var6) {
                return this;
            }
        }

        const var13 = var8 ? new ModelLitImpl() : this;
        if (var8) {
            var13.numPoints = this.numPoints;
            var13.numFaces = this.numFaces;
            var13.numT = this.numT;
            var13.faceVertexA = this.faceVertexA;
            var13.faceVertexB = this.faceVertexB;
            var13.faceVertexC = this.faceVertexC;
            var13.faceColourA = this.faceColourA;
            var13.faceColourB = this.faceColourB;
            var13.faceColourC = this.faceColourC;
            var13.facePriority = this.facePriority;
            var13.faceTextureAxis = this.faceTextureAxis;
            var13.faceMaterial = this.faceMaterial;
            var13.faceColour = this.faceColour;
            var13.faceAlpha = this.faceAlpha;
            var13.priority = this.priority;
            var13.faceTextureP = this.faceTextureP;
            var13.faceTextureM = this.faceTextureM;
            var13.faceTextureN = this.faceTextureN;
            var13.labelVertices = this.labelVertices;
            var13.labelFaces = this.labelFaces;
            var13.pointPartMask = this.pointPartMask;
            var13.facePartMask = this.facePartMask;
            var13.useAABBMouseCheck = this.useAABBMouseCheck;
            if (var1 === 3) {
                var13.pointX = ArrayUtils.copyOf(this.pointX);
                var13.pointY = ArrayUtils.copyOf(this.pointY);
                var13.pointZ = ArrayUtils.copyOf(this.pointZ);
            } else {
                var13.pointX = this.pointX;
                var13.pointY = new Int32Array(var13.numPoints);
                var13.pointZ = this.pointZ;
            }
        }

        if (var1 === 1) {
            for (let var14 = 0; var14 < var13.numPoints; var14++) {
                const var15 = (arrayAtI32(this.pointX, var14) + var5) | 0;
                const var16 = (arrayAtI32(this.pointZ, var14) + var7) | 0;
                const var17 = var15 & 127;
                const var18 = var16 & 127;
                const var19 = var15 >> 7;
                const var20 = var16 >> 7;
                const var21 = (Math.imul(at2(var3, var19, var20), 128 - var17) + Math.imul(at2(var3, (var19 + 1) | 0, var20), var17)) >> 7;
                const var22 = (Math.imul(at2(var3, var19, (var20 + 1) | 0), 128 - var17) + Math.imul(at2(var3, (var19 + 1) | 0, (var20 + 1) | 0), var17)) >> 7;
                const var23 = (Math.imul(var21, 128 - var18) + Math.imul(var22, var18)) >> 7;
                arrayPutI32(var13.pointY, var14, (arrayAtI32(this.pointY, var14) + var23 - var6) | 0);
            }
        } else if (var1 === 2) {
            for (let var31 = 0; var31 < var13.numPoints; var31++) {
                const var35 = intDivide(arrayAtI32(this.pointY, var31) << 16, this.minY);
                if (var35 < var2) {
                    const var39 = (arrayAtI32(this.pointX, var31) + var5) | 0;
                    const var42 = (arrayAtI32(this.pointZ, var31) + var7) | 0;
                    const var45 = var39 & 127;
                    const var48 = var42 & 127;
                    const var51 = var39 >> 7;
                    const var54 = var42 >> 7;
                    const var57 = (Math.imul(at2(var3, var51, var54), 128 - var45) + Math.imul(at2(var3, (var51 + 1) | 0, var54), var45)) >> 7;
                    const var61 = (Math.imul(at2(var3, var51, (var54 + 1) | 0), 128 - var45) + Math.imul(at2(var3, (var51 + 1) | 0, (var54 + 1) | 0), var45)) >> 7;
                    const var24 = (Math.imul(var57, 128 - var48) + Math.imul(var61, var48)) >> 7;
                    arrayPutI32(var13.pointY, var31, (arrayAtI32(this.pointY, var31) + intDivide(Math.imul((var24 - var6) | 0, (var2 - var35) | 0), var2)) | 0);
                } else {
                    arrayPutI32(var13.pointY, var31, arrayAtI32(this.pointY, var31));
                }
            }
        } else if (var1 === 3) {
            const var32 = (var2 & 255) * 4;
            const var36 = ((var2 >> 8) & 255) * 4;
            var13.tiltToGround(var3, var5, var6, var7, var32, var36);
        } else if (var1 === 4) {
            const var33 = (this.maxY - this.minY) | 0;

            for (let var37 = 0; var37 < this.numPoints; var37++) {
                const var40 = (arrayAtI32(this.pointX, var37) + var5) | 0;
                const var43 = (arrayAtI32(this.pointZ, var37) + var7) | 0;
                const var46 = var40 & 127;
                const var49 = var43 & 127;
                const var52 = var40 >> 7;
                const var55 = var43 >> 7;
                const var58 = (Math.imul(at2(var4, var52, var55), 128 - var46) + Math.imul(at2(var4, (var52 + 1) | 0, var55), var46)) >> 7;
                const var62 = (Math.imul(at2(var4, var52, (var55 + 1) | 0), 128 - var46) + Math.imul(at2(var4, (var52 + 1) | 0, (var55 + 1) | 0), var46)) >> 7;
                const var65 = (Math.imul(var58, 128 - var49) + Math.imul(var62, var49)) >> 7;
                arrayPutI32(var13.pointY, var37, (arrayAtI32(this.pointY, var37) + (var65 - var6) + var33) | 0);
            }
        } else if (var1 === 5) {
            const var34 = (this.maxY - this.minY) | 0;

            for (let var38 = 0; var38 < this.numPoints; var38++) {
                const var41 = (arrayAtI32(this.pointX, var38) + var5) | 0;
                const var44 = (arrayAtI32(this.pointZ, var38) + var7) | 0;
                const var47 = var41 & 127;
                const var50 = var44 & 127;
                const var53 = var41 >> 7;
                const var56 = var44 >> 7;
                let var59 = (Math.imul(at2(var3, var53, var56), 128 - var47) + Math.imul(at2(var3, (var53 + 1) | 0, var56), var47)) >> 7;
                let var63 = (Math.imul(at2(var3, var53, (var56 + 1) | 0), 128 - var47) + Math.imul(at2(var3, (var53 + 1) | 0, (var56 + 1) | 0), var47)) >> 7;
                const var66 = (Math.imul(var59, 128 - var50) + Math.imul(var63, var50)) >> 7;
                var59 = (Math.imul(at2(var4, var53, var56), 128 - var47) + Math.imul(at2(var4, (var53 + 1) | 0, var56), var47)) >> 7;
                var63 = (Math.imul(at2(var4, var53, (var56 + 1) | 0), 128 - var47) + Math.imul(at2(var4, (var53 + 1) | 0, (var56 + 1) | 0), var47)) >> 7;
                const var25 = (Math.imul(var59, 128 - var50) + Math.imul(var63, var50)) >> 7;
                const var26 = (var66 - var25) | 0;
                arrayPutI32(var13.pointY, var38, ((Math.imul(intDivide(arrayAtI32(this.pointY, var38) << 8, var34), var26) >> 8) - ((var6 - var66) | 0)) | 0);
            }
        }

        var13.boundsCalculated = false;
        return var13;
    }

    // fc.a(IIII)V
    override animateAll(var1: number, var2: number, var3: number, var4: number): void {
        if (var1 === 0) {
            let var14 = 0;
            ModelLitImpl.originX = 0;
            ModelLitImpl.originY = 0;
            ModelLitImpl.originZ = 0;

            for (let var19 = 0; var19 < this.numPoints; var19++) {
                ModelLitImpl.originX = (ModelLitImpl.originX + arrayAtI32(this.pointX, var19)) | 0;
                ModelLitImpl.originY = (ModelLitImpl.originY + arrayAtI32(this.pointY, var19)) | 0;
                ModelLitImpl.originZ = (ModelLitImpl.originZ + arrayAtI32(this.pointZ, var19)) | 0;
                var14++;
            }

            if (var14 > 0) {
                ModelLitImpl.originX = (((ModelLitImpl.originX / var14) | 0) + var2) | 0;
                ModelLitImpl.originY = (((ModelLitImpl.originY / var14) | 0) + var3) | 0;
                ModelLitImpl.originZ = (((ModelLitImpl.originZ / var14) | 0) + var4) | 0;
                return;
            }

            ModelLitImpl.originX = var2;
            ModelLitImpl.originY = var3;
            ModelLitImpl.originZ = var4;
            return;
        }

        if (var1 === 1) {
            for (let var13 = 0; var13 < this.numPoints; var13++) {
                arrayPutI32(this.pointX, var13, (arrayAtI32(this.pointX, var13) + var2) | 0);
                arrayPutI32(this.pointY, var13, (arrayAtI32(this.pointY, var13) + var3) | 0);
                arrayPutI32(this.pointZ, var13, (arrayAtI32(this.pointZ, var13) + var4) | 0);
            }

            return;
        }

        if (var1 === 2) {
            for (let var12 = 0; var12 < this.numPoints; var12++) {
                arrayPutI32(this.pointX, var12, (arrayAtI32(this.pointX, var12) - ModelLitImpl.originX) | 0);
                arrayPutI32(this.pointY, var12, (arrayAtI32(this.pointY, var12) - ModelLitImpl.originY) | 0);
                arrayPutI32(this.pointZ, var12, (arrayAtI32(this.pointZ, var12) - ModelLitImpl.originZ) | 0);
                if (var4 !== 0) {
                    const var16 = arrayAtI32(Pix3D.sinTable, var4);
                    const var21 = arrayAtI32(Pix3D.cosTable, var4);
                    const var25 = (Math.imul(arrayAtI32(this.pointY, var12), var16) + Math.imul(arrayAtI32(this.pointX, var12), var21) + 32767) >> 16;
                    arrayPutI32(this.pointY, var12, (Math.imul(arrayAtI32(this.pointY, var12), var21) - Math.imul(arrayAtI32(this.pointX, var12), var16) + 32767) >> 16);
                    arrayPutI32(this.pointX, var12, var25);
                }

                if (var2 !== 0) {
                    const var17 = arrayAtI32(Pix3D.sinTable, var2);
                    const var22 = arrayAtI32(Pix3D.cosTable, var2);
                    const var26 = (Math.imul(arrayAtI32(this.pointY, var12), var22) - Math.imul(arrayAtI32(this.pointZ, var12), var17) + 32767) >> 16;
                    arrayPutI32(this.pointZ, var12, (Math.imul(arrayAtI32(this.pointY, var12), var17) + Math.imul(arrayAtI32(this.pointZ, var12), var22) + 32767) >> 16);
                    arrayPutI32(this.pointY, var12, var26);
                }

                if (var3 !== 0) {
                    const var18 = arrayAtI32(Pix3D.sinTable, var3);
                    const var23 = arrayAtI32(Pix3D.cosTable, var3);
                    const var27 = (Math.imul(arrayAtI32(this.pointZ, var12), var18) + Math.imul(arrayAtI32(this.pointX, var12), var23) + 32767) >> 16;
                    arrayPutI32(this.pointZ, var12, (Math.imul(arrayAtI32(this.pointZ, var12), var23) - Math.imul(arrayAtI32(this.pointX, var12), var18) + 32767) >> 16);
                    arrayPutI32(this.pointX, var12, var27);
                }

                arrayPutI32(this.pointX, var12, (arrayAtI32(this.pointX, var12) + ModelLitImpl.originX) | 0);
                arrayPutI32(this.pointY, var12, (arrayAtI32(this.pointY, var12) + ModelLitImpl.originY) | 0);
                arrayPutI32(this.pointZ, var12, (arrayAtI32(this.pointZ, var12) + ModelLitImpl.originZ) | 0);
            }

            return;
        }

        if (var1 === 3) {
            for (let var5 = 0; var5 < this.numPoints; var5++) {
                arrayPutI32(this.pointX, var5, (arrayAtI32(this.pointX, var5) - ModelLitImpl.originX) | 0);
                arrayPutI32(this.pointY, var5, (arrayAtI32(this.pointY, var5) - ModelLitImpl.originY) | 0);
                arrayPutI32(this.pointZ, var5, (arrayAtI32(this.pointZ, var5) - ModelLitImpl.originZ) | 0);
                arrayPutI32(this.pointX, var5, (Math.imul(arrayAtI32(this.pointX, var5), var2) / 128) | 0);
                arrayPutI32(this.pointY, var5, (Math.imul(arrayAtI32(this.pointY, var5), var3) / 128) | 0);
                arrayPutI32(this.pointZ, var5, (Math.imul(arrayAtI32(this.pointZ, var5), var4) / 128) | 0);
                arrayPutI32(this.pointX, var5, (arrayAtI32(this.pointX, var5) + ModelLitImpl.originX) | 0);
                arrayPutI32(this.pointY, var5, (arrayAtI32(this.pointY, var5) + ModelLitImpl.originY) | 0);
                arrayPutI32(this.pointZ, var5, (arrayAtI32(this.pointZ, var5) + ModelLitImpl.originZ) | 0);
            }

            return;
        }

        if (var1 === 5) {
            for (let var11 = 0; var11 < this.numFaces; var11++) {
                let var15 = ((byteAt(this.faceAlpha, var11) & 255) + Math.imul(var2, 8)) | 0;
                if (var15 < 0) {
                    var15 = 0;
                } else if (var15 > 255) {
                    var15 = 255;
                }

                putByte(this.faceAlpha, var11, var15);
            }

            return;
        }

        if (var1 === 7) {
            for (let var10 = 0; var10 < this.numFaces; var10++) {
                const var6 = arrayAtI16(this.faceColour, var10) & 65535;
                let var7 = (var6 >> 10) & 63;
                let var8 = (var6 >> 7) & 7;
                let var9 = var6 & 127;
                var7 = (var7 + var2) & 63;
                var8 = (var8 + var3) | 0;
                if (var8 < 0) {
                    var8 = 0;
                } else if (var8 > 7) {
                    var8 = 7;
                }

                var9 = (var9 + var4) | 0;
                if (var9 < 0) {
                    var9 = 0;
                } else if (var9 > 127) {
                    var9 = 127;
                }

                arrayPutI16(this.faceColour, var10, (var7 << 10) | (var8 << 7) | var9);
            }

            this.relightPending = true;
        }
    }

    // fc.b()I (overrides ug.b()I)
    override getMinY(): number {
        if (!this.boundsCalculated) {
            this.CalcBoundingCylinder();
        }

        return this.minY;
    }

    // fc.a(I)V
    override rotateZAxis(var1: number): void {
        const var2 = arrayAtI32(Pix3D.sinTable, var1);
        const var3 = arrayAtI32(Pix3D.cosTable, var1);

        for (let var4 = 0; var4 < this.numPoints; var4++) {
            const var5 = (Math.imul(arrayAtI32(this.pointY, var4), var2) + Math.imul(arrayAtI32(this.pointX, var4), var3)) >> 16;
            arrayPutI32(this.pointY, var4, (Math.imul(arrayAtI32(this.pointY, var4), var3) - Math.imul(arrayAtI32(this.pointX, var4), var2)) >> 16);
            arrayPutI32(this.pointX, var4, var5);
        }

        this.boundsCalculated = false;
    }

    // fc.a(IIIIIIII)Z (NXT SoftwareModelLitRenderer::FastInsideTriangle)
    // (var1, var2) = the mouse; var3..var5 = the triangle's screen y, var6..var8 its screen x. True unless the point is
    // beyond all three vertices on one side (a bounding-box reject, not an exact test).
    private FastInsideTriangle(var1: number, var2: number, var3: number, var4: number, var5: number, var6: number, var7: number, var8: number): boolean {
        if (var2 < var3 && var2 < var4 && var2 < var5) {
            return false;
        }

        if (var2 > var3 && var2 > var4 && var2 > var5) {
            return false;
        }

        if (var1 < var6 && var1 < var7 && var1 < var8) {
            return false;
        }

        if (var1 > var6 && var1 > var7 && var1 > var8) {
            return false;
        }

        return true;
    }

    // fc.c(I)V
    override RotateYAxis(var1: number): void {
        const var2 = arrayAtI32(Pix3D.sinTable, var1);
        const var3 = arrayAtI32(Pix3D.cosTable, var1);

        for (let var4 = 0; var4 < this.numPoints; var4++) {
            const var5 = (Math.imul(arrayAtI32(this.pointZ, var4), var2) + Math.imul(arrayAtI32(this.pointX, var4), var3)) >> 16;
            arrayPutI32(this.pointZ, var4, (Math.imul(arrayAtI32(this.pointZ, var4), var3) - Math.imul(arrayAtI32(this.pointX, var4), var2)) >> 16);
            arrayPutI32(this.pointX, var4, var5);
        }

        this.boundsCalculated = false;
    }

    // fc.c()V
    override Rotate180(): void {
        for (let var1 = 0; var1 < this.numPoints; var1++) {
            arrayPutI32(this.pointX, var1, -arrayAtI32(this.pointX, var1) | 0);
            arrayPutI32(this.pointZ, var1, -arrayAtI32(this.pointZ, var1) | 0);
        }

        this.boundsCalculated = false;
    }

    // fc.a(ZZJIILue;)V (NXT SoftwareModelLitRenderer::Render2)
    // Sorts and draws the projected faces. var1 = some vertex is behind the near plane, var2 = pick per triangle
    // (records var3 at the first triangle under the mouse), var5 = the depth offset of the model centre (bucket =
    // average vertex depth + var5), var6 = the depth range (no draw when >= 1600). var7 (particles) is unused in SD.
    private Render2(var1: boolean, var2: boolean, var3: bigint, var5: number, var6: number, _var7: ParticleSystem | null): void {
        if (var6 >= 1600) {
            return;
        }

        let var8 = 0;
        let var9 = 0;
        if (!ModelLitImpl.useQuickSort) {
            clearDepthCounts(ModelLitImpl.tmpDepthFaceCount, 1600);
            clearDepthCounts(ModelLitImpl.tmpExtendedDepthFaceCount, 32);

            ModelLitImpl.extendedDepthBucketCount = 0;
        }

        // The face classification pass precedes raster callbacks. Entries can alias and are
        // read in JVM order; the array references stay fixed for this pass.
        const faceColours = this.faceColourC,
            faceA = this.faceVertexA,
            faceB = this.faceVertexB,
            faceC = this.faceVertexC;
        const screenX = ModelLitImpl.vertexScreenX,
            screenY = ModelLitImpl.vertexScreenY,
            screenZ = ModelLitImpl.vertexScreenZ;
        const viewX = ModelLitImpl.vertexViewSpaceX,
            viewY = ModelLitImpl.vertexViewSpaceY,
            viewZ = ModelLitImpl.vertexViewSpaceZ;
        const nearClipped = ModelLitImpl.faceNearClipped,
            clippedX = ModelLitImpl.faceClippedX;
        const nearFits = nearClipped !== null && nearClipped.length >= this.numFaces;
        const xFits = clippedX !== null && clippedX.length >= this.numFaces;
        const clipWidth = Pix3D.width;
        const sortDepths = ModelLitImpl.sortFaceDepths,
            sortIndices = ModelLitImpl.sortFaceIndices;
        const counts = ModelLitImpl.tmpDepthFaceCount,
            depthRows = ModelLitImpl.tmpDepthFaces;
        const extendedCounts = ModelLitImpl.tmpExtendedDepthFaceCount,
            extendedRows = ModelLitImpl.tmpExtendedDepthFaces;
        // Bucket mode has already cleared counts above: a null count array faults before this pass.
        const useBuckets = !ModelLitImpl.useQuickSort && counts !== null;
        for (let var31 = 0; var31 < this.numFaces; var31++) {
            if ((faceColours?.[var31] ?? arrayAtI32(faceColours, var31)) === -2) {
                continue;
            }

            const var32 = faceA?.[var31] ?? arrayAtI32(faceA, var31);
            const var12 = faceB?.[var31] ?? arrayAtI32(faceB, var31);
            const var13 = faceC?.[var31] ?? arrayAtI32(faceC, var31);
            const var14 = screenX?.[var32] ?? arrayAtI32(screenX, var32);
            const var15 = screenX?.[var12] ?? arrayAtI32(screenX, var12);
            const var16 = screenX?.[var13] ?? arrayAtI32(screenX, var13);
            if (var1 && (var14 === -5000 || var15 === -5000 || var16 === -5000)) {
                let var65 = renderInt(viewX, var32);
                const var71 = renderInt(viewX, var12);
                let var19 = renderInt(viewX, var13);
                let var20 = renderInt(viewY, var32);
                const var21 = renderInt(viewY, var12);
                let var22 = renderInt(viewY, var13);
                let var23 = renderInt(viewZ, var32);
                const var24 = renderInt(viewZ, var12);
                let var25 = renderInt(viewZ, var13);
                var65 = (var65 - var71) | 0;
                var19 = (var19 - var71) | 0;
                var20 = (var20 - var21) | 0;
                var22 = (var22 - var21) | 0;
                var23 = (var23 - var24) | 0;
                var25 = (var25 - var24) | 0;
                const var26 = (Math.imul(var20, var25) - Math.imul(var23, var22)) | 0;
                const var27 = (Math.imul(var23, var19) - Math.imul(var65, var25)) | 0;
                const var28 = (Math.imul(var65, var22) - Math.imul(var20, var19)) | 0;
                if (((Math.imul(var71, var26) + Math.imul(var21, var27) + Math.imul(var24, var28)) | 0) > 0) {
                    if (nearFits) nearClipped[var31] = true;
                    else arrayPutObj(nearClipped, var31, true);
                    const zA = screenZ?.[var32] ?? arrayAtI32(screenZ, var32);
                    const zB = screenZ?.[var12] ?? arrayAtI32(screenZ, var12);
                    const zC = screenZ?.[var13] ?? arrayAtI32(screenZ, var13);
                    const depth = (((zA + zB + zC) | 0) / 3) | 0;
                    if (!useBuckets) {
                        arrayPutI32(sortDepths, var8, depth);
                        arrayPutI32(sortIndices, var8++, var31);
                    } else {
                        const var29 = (depth + var5) | 0;
                        const baseCount = counts[var29] ?? arrayAtI32(counts, var29);
                        if (baseCount < 64) {
                            // lb[var29][ib[var29]++] = var31: the row is loaded, then the count increments, then the store.
                            const row = renderIntRow(depthRows, var29);
                            counts[var29] = (baseCount + 1) | 0;
                            if (row !== null && baseCount >>> 0 < row.length) row[baseCount] = var31;
                            else arrayPutI32(row, baseCount, var31);
                        } else {
                            let var30 = baseCount;
                            if (var30 === 64) {
                                if (ModelLitImpl.extendedDepthBucketCount === 512) {
                                    continue;
                                }

                                const bucket = ModelLitImpl.extendedDepthBucketCount;
                                ModelLitImpl.extendedDepthBucketCount = (bucket + 1) | 0;
                                var30 = (65 + bucket) | 0;
                                arrayPutI32(counts, var29, var30);
                            }

                            var30 = (var30 - 65) | 0;
                            const row = renderIntRow(extendedRows, var30);
                            const count = renderInt(extendedCounts, var30);
                            arrayPutI32(extendedCounts, var30, (count + 1) | 0);
                            arrayPutI32(row, count, var31);
                        }
                    }
                }
            } else {
                if (
                    var2 &&
                    this.FastInsideTriangle(
                        (ModelLitImpl.mouseX + Pix3D.originX) | 0,
                        (ModelLit.mouseY + Pix3D.originY) | 0,
                        screenY?.[var32] ?? arrayAtI32(screenY, var32),
                        screenY?.[var12] ?? arrayAtI32(screenY, var12),
                        screenY?.[var13] ?? arrayAtI32(screenY, var13),
                        var14,
                        var15,
                        var16
                    )
                ) {
                    // pf.W[dd.r++] = var3: the count increments before the store can throw.
                    const picked = ModelLit.pickedCount;
                    ModelLit.pickedCount = (picked + 1) | 0;
                    arrayPutB64(ModelLit.pickedTypecodes, picked, var3);
                    var2 = false;
                }

                const yC = screenY?.[var13] ?? arrayAtI32(screenY, var13);
                const yB = screenY?.[var12] ?? arrayAtI32(screenY, var12);
                const left = Math.imul((var14 - var15) | 0, (yC - yB) | 0);
                const yA = screenY?.[var32] ?? arrayAtI32(screenY, var32);
                if (((left - Math.imul((yA - yB) | 0, (var16 - var15) | 0)) | 0) > 0) {
                    if (nearFits) nearClipped[var31] = false;
                    else arrayPutObj(nearClipped, var31, false);
                    const outsideX = var14 < 0 || var15 < 0 || var16 < 0 || var14 > clipWidth || var15 > clipWidth || var16 > clipWidth;
                    if (xFits) clippedX[var31] = outsideX;
                    else arrayPutObj(clippedX, var31, outsideX);

                    const zA = screenZ?.[var32] ?? arrayAtI32(screenZ, var32);
                    const zB = screenZ?.[var12] ?? arrayAtI32(screenZ, var12);
                    const zC = screenZ?.[var13] ?? arrayAtI32(screenZ, var13);
                    const depth = (((zA + zB + zC) | 0) / 3) | 0;
                    if (!useBuckets) {
                        arrayPutI32(sortDepths, var8, depth);
                        arrayPutI32(sortIndices, var8++, var31);
                    } else {
                        const var17 = (depth + var5) | 0;
                        const baseCount = counts[var17] ?? arrayAtI32(counts, var17);
                        if (baseCount < 64) {
                            const row = renderIntRow(depthRows, var17);
                            counts[var17] = (baseCount + 1) | 0;
                            if (row !== null && baseCount >>> 0 < row.length) row[baseCount] = var31;
                            else arrayPutI32(row, baseCount, var31);
                        } else {
                            let var18 = baseCount;
                            if (var18 === 64) {
                                if (ModelLitImpl.extendedDepthBucketCount === 512) {
                                    continue;
                                }

                                const bucket = ModelLitImpl.extendedDepthBucketCount;
                                ModelLitImpl.extendedDepthBucketCount = (bucket + 1) | 0;
                                var18 = (65 + bucket) | 0;
                                arrayPutI32(counts, var17, var18);
                            }

                            var18 = (var18 - 65) | 0;
                            const row = renderIntRow(extendedRows, var18);
                            const count = renderInt(extendedCounts, var18);
                            arrayPutI32(extendedCounts, var18, (count + 1) | 0);
                            arrayPutI32(row, count, var31);
                        }
                    }
                }
            }
        }

        if (ModelLitImpl.useQuickSort) {
            ModelLitImpl.quicksort(ModelLitImpl.sortFaceDepths, (var8 - 1) | 0, 0, ModelLitImpl.sortFaceIndices);
            if (this.facePriority === null) {
                for (let var34 = 0; var34 < var8; var34++) {
                    this.Render3(renderInt(ModelLitImpl.sortFaceIndices, var34));
                }

                return;
            }

            for (let var33 = 0; var33 < 12; var33++) {
                arrayPutI32(ModelLitImpl.tmpPriorityFaceCount, var33, 0);
                arrayPutI32(ModelLitImpl.tmpPriorityDepthSum, var33, 0);
            }

            for (let var38 = 0; var38 < var8; var38++) {
                const var42 = renderInt(ModelLitImpl.sortFaceIndices, var38);
                const var47 = renderInt(ModelLitImpl.sortFaceDepths, var38);
                const var53 = sbyteAt(this.facePriority, var42);
                const var59 = renderInt(ModelLitImpl.tmpPriorityFaceCount, var53);
                arrayPutI32(ModelLitImpl.tmpPriorityFaceCount, var53, (var59 + 1) | 0);
                arrayPutI32(renderIntRow(ModelLitImpl.tmpPriorityFaces, var53), var59, var42);
                if (var53 < 10) {
                    arrayPutI32(ModelLitImpl.tmpPriorityDepthSum, var53, (renderInt(ModelLitImpl.tmpPriorityDepthSum, var53) + var47) | 0);
                } else if (var53 === 10) {
                    arrayPutI32(ModelLitImpl.tmpPriority10FaceDepth, var59, var47);
                } else {
                    arrayPutI32(ModelLitImpl.tmpPriority11FaceDepth, var59, var47);
                }
            }
        } else {
            if (this.facePriority === null) {
                for (let var37 = (var6 - 1) | 0; var37 >= 0; var37--) {
                    const var41 = renderInt(ModelLitImpl.tmpDepthFaceCount, var37);
                    if (var41 > 0) {
                        const var45 = var41 > 64 ? 64 : var41;
                        const var51 = renderIntRow(ModelLitImpl.tmpDepthFaces, var37);

                        for (let var57 = 0; var57 < var45; var57++) {
                            const var63 = var51?.[var57] ?? arrayAtI32(var51, var57);
                            if (var63 < 65536) {
                                this.Render3(var51?.[var57] ?? arrayAtI32(var51, var57));
                            }
                        }
                    }

                    if (var41 > 64) {
                        const var46 = (renderInt(ModelLitImpl.tmpDepthFaceCount, var37) - 64 - 1) | 0;
                        const var52 = renderIntRow(ModelLitImpl.tmpExtendedDepthFaces, var46);

                        for (let var58 = 0; var58 < renderInt(ModelLitImpl.tmpExtendedDepthFaceCount, var46); var58++) {
                            const var64 = var52?.[var58] ?? arrayAtI32(var52, var58);
                            if (var64 < 65536) {
                                this.Render3(var52?.[var58] ?? arrayAtI32(var52, var58));
                            }
                        }
                    }
                }

                return;
            }

            for (let var35 = 0; var35 < 12; var35++) {
                arrayPutI32(ModelLitImpl.tmpPriorityFaceCount, var35, 0);
                arrayPutI32(ModelLitImpl.tmpPriorityDepthSum, var35, 0);
            }

            for (let var39 = (var6 - 1) | 0; var39 >= 0; var39--) {
                const var43 = renderInt(ModelLitImpl.tmpDepthFaceCount, var39);
                if (var43 > 0) {
                    let var48: number;
                    if (var43 > 64) {
                        var48 = 64;
                    } else {
                        var48 = var43;
                    }

                    const var54 = renderIntRow(ModelLitImpl.tmpDepthFaces, var39);

                    for (let var60 = 0; var60 < var48; var60++) {
                        const var67 = var54?.[var60] ?? arrayAtI32(var54, var60);
                        if (var67 < 65536) {
                            const var72 = sbyteAt(this.facePriority, var67);
                            const var76 = renderInt(ModelLitImpl.tmpPriorityFaceCount, var72);
                            arrayPutI32(ModelLitImpl.tmpPriorityFaceCount, var72, (var76 + 1) | 0);
                            arrayPutI32(renderIntRow(ModelLitImpl.tmpPriorityFaces, var72), var76, var67);
                            if (var72 < 10) {
                                arrayPutI32(ModelLitImpl.tmpPriorityDepthSum, var72, (renderInt(ModelLitImpl.tmpPriorityDepthSum, var72) + var39) | 0);
                            } else if (var72 === 10) {
                                arrayPutI32(ModelLitImpl.tmpPriority10FaceDepth, var76, var39);
                            } else {
                                arrayPutI32(ModelLitImpl.tmpPriority11FaceDepth, var76, var39);
                            }
                        } else {
                            arrayPutI32(ModelLitImpl.deferredParticleIndices, var9++, ((var67 >> 16) - 1) | 0);
                        }
                    }
                }

                if (var43 > 64) {
                    const var49 = (renderInt(ModelLitImpl.tmpDepthFaceCount, var39) - 64 - 1) | 0;
                    const var55 = renderIntRow(ModelLitImpl.tmpExtendedDepthFaces, var49);

                    for (let var61 = 0; var61 < renderInt(ModelLitImpl.tmpExtendedDepthFaceCount, var49); var61++) {
                        const var68 = var55?.[var61] ?? arrayAtI32(var55, var61);
                        if (var68 < 65536) {
                            const var73 = sbyteAt(this.facePriority, var68);
                            const var77 = renderInt(ModelLitImpl.tmpPriorityFaceCount, var73);
                            arrayPutI32(ModelLitImpl.tmpPriorityFaceCount, var73, (var77 + 1) | 0);
                            arrayPutI32(renderIntRow(ModelLitImpl.tmpPriorityFaces, var73), var77, var68);
                            if (var73 < 10) {
                                arrayPutI32(ModelLitImpl.tmpPriorityDepthSum, var73, (renderInt(ModelLitImpl.tmpPriorityDepthSum, var73) + var39) | 0);
                            } else if (var73 === 10) {
                                arrayPutI32(ModelLitImpl.tmpPriority10FaceDepth, var77, var39);
                            } else {
                                arrayPutI32(ModelLitImpl.tmpPriority11FaceDepth, var77, var39);
                            }
                        } else {
                            arrayPutI32(ModelLitImpl.deferredParticleIndices, var9++, ((var68 >> 16) - 1) | 0);
                        }
                    }
                }
            }
        }

        // Priorities 1-2, 3-4 and 6-8: the average depth below which the priority 10/11 faces draw before them.
        let var36 = 0;
        if (renderInt(ModelLitImpl.tmpPriorityFaceCount, 1) > 0 || renderInt(ModelLitImpl.tmpPriorityFaceCount, 2) > 0) {
            var36 = (((renderInt(ModelLitImpl.tmpPriorityDepthSum, 1) + renderInt(ModelLitImpl.tmpPriorityDepthSum, 2)) | 0) / ((renderInt(ModelLitImpl.tmpPriorityFaceCount, 1) + renderInt(ModelLitImpl.tmpPriorityFaceCount, 2)) | 0)) | 0;
        }

        let var40 = 0;
        if (renderInt(ModelLitImpl.tmpPriorityFaceCount, 3) > 0 || renderInt(ModelLitImpl.tmpPriorityFaceCount, 4) > 0) {
            var40 = (((renderInt(ModelLitImpl.tmpPriorityDepthSum, 3) + renderInt(ModelLitImpl.tmpPriorityDepthSum, 4)) | 0) / ((renderInt(ModelLitImpl.tmpPriorityFaceCount, 3) + renderInt(ModelLitImpl.tmpPriorityFaceCount, 4)) | 0)) | 0;
        }

        let var44 = 0;
        if (renderInt(ModelLitImpl.tmpPriorityFaceCount, 6) > 0 || renderInt(ModelLitImpl.tmpPriorityFaceCount, 8) > 0) {
            var44 = (((renderInt(ModelLitImpl.tmpPriorityDepthSum, 6) + renderInt(ModelLitImpl.tmpPriorityDepthSum, 8)) | 0) / ((renderInt(ModelLitImpl.tmpPriorityFaceCount, 6) + renderInt(ModelLitImpl.tmpPriorityFaceCount, 8)) | 0)) | 0;
        }

        let var56 = 0;
        let var62 = renderInt(ModelLitImpl.tmpPriorityFaceCount, 10);
        let var69: Int32Array | null = renderIntRow(ModelLitImpl.tmpPriorityFaces, 10);
        let var74 = ModelLitImpl.tmpPriority10FaceDepth;
        if (var56 === var62) {
            var56 = 0;
            var62 = renderInt(ModelLitImpl.tmpPriorityFaceCount, 11);
            var69 = renderIntRow(ModelLitImpl.tmpPriorityFaces, 11);
            var74 = ModelLitImpl.tmpPriority11FaceDepth;
        }

        let var50: number;
        if (var56 < var62) {
            var50 = var74?.[var56] ?? arrayAtI32(var74, var56);
        } else {
            var50 = -1000;
        }

        for (let var78 = 0; var78 < 10; var78++) {
            while (var78 === 0 && var50 > var36) {
                this.Render3(renderInt(var69, var56++));
                if (var56 === var62 && var69 !== renderIntRow(ModelLitImpl.tmpPriorityFaces, 11)) {
                    var56 = 0;
                    var62 = renderInt(ModelLitImpl.tmpPriorityFaceCount, 11);
                    var69 = renderIntRow(ModelLitImpl.tmpPriorityFaces, 11);
                    var74 = ModelLitImpl.tmpPriority11FaceDepth;
                }

                if (var56 < var62) {
                    var50 = var74?.[var56] ?? arrayAtI32(var74, var56);
                } else {
                    var50 = -1000;
                }
            }

            while (var78 === 3 && var50 > var40) {
                this.Render3(renderInt(var69, var56++));
                if (var56 === var62 && var69 !== renderIntRow(ModelLitImpl.tmpPriorityFaces, 11)) {
                    var56 = 0;
                    var62 = renderInt(ModelLitImpl.tmpPriorityFaceCount, 11);
                    var69 = renderIntRow(ModelLitImpl.tmpPriorityFaces, 11);
                    var74 = ModelLitImpl.tmpPriority11FaceDepth;
                }

                if (var56 < var62) {
                    var50 = var74?.[var56] ?? arrayAtI32(var74, var56);
                } else {
                    var50 = -1000;
                }
            }

            while (var78 === 5 && var50 > var44) {
                this.Render3(renderInt(var69, var56++));
                if (var56 === var62 && var69 !== renderIntRow(ModelLitImpl.tmpPriorityFaces, 11)) {
                    var56 = 0;
                    var62 = renderInt(ModelLitImpl.tmpPriorityFaceCount, 11);
                    var69 = renderIntRow(ModelLitImpl.tmpPriorityFaces, 11);
                    var74 = ModelLitImpl.tmpPriority11FaceDepth;
                }

                if (var56 < var62) {
                    var50 = var74?.[var56] ?? arrayAtI32(var74, var56);
                } else {
                    var50 = -1000;
                }
            }

            const var80 = renderInt(ModelLitImpl.tmpPriorityFaceCount, var78);
            const var81 = renderIntRow(ModelLitImpl.tmpPriorityFaces, var78);

            for (let var83 = 0; var83 < var80; var83++) {
                this.Render3(var81?.[var83] ?? arrayAtI32(var81, var83));
            }
        }

        while (var50 !== -1000) {
            this.Render3(renderInt(var69, var56++));
            if (var56 === var62 && var69 !== renderIntRow(ModelLitImpl.tmpPriorityFaces, 11)) {
                var56 = 0;
                var69 = renderIntRow(ModelLitImpl.tmpPriorityFaces, 11);
                var62 = renderInt(ModelLitImpl.tmpPriorityFaceCount, 11);
                var74 = ModelLitImpl.tmpPriority11FaceDepth;
            }

            if (var56 < var62) {
                var50 = var74?.[var56] ?? arrayAtI32(var74, var56);
            } else {
                var50 = -1000;
            }
        }
    }

    // fc.m()V
    static unload(): void {
        ModelLitImpl.tempActorModel = null;
        ModelLitImpl.tempActorFaceAlpha = null;
        ModelLitImpl.tempActorFaceColour = null;
        ModelLitImpl.tempActorFaceColourA = null;
        ModelLitImpl.tempActorFaceColourB = null;
        ModelLitImpl.tempActorFaceColourC = null;
        ModelLitImpl.tempSpotModel = null;
        ModelLitImpl.tempSpotFaceAlpha = null;
        ModelLitImpl.tempSpotFaceColour = null;
        ModelLitImpl.tempSpotFaceColourA = null;
        ModelLitImpl.tempSpotFaceColourB = null;
        ModelLitImpl.tempSpotFaceColourC = null;
        ModelLitImpl.tempLocModel = null;
        ModelLitImpl.tempLocFaceAlpha = null;
        ModelLitImpl.tempLocFaceColour = null;
        ModelLitImpl.tempLocFaceColourA = null;
        ModelLitImpl.tempLocFaceColourB = null;
        ModelLitImpl.tempLocFaceColourC = null;
        ModelLitImpl.faceClippedX = null;
        ModelLitImpl.faceNearClipped = null;
        ModelLitImpl.vertexScreenX = null;
        ModelLitImpl.vertexScreenY = null;
        ModelLitImpl.vertexScreenZ = null;
        ModelLitImpl.deferredParticleIndices = null;
        ModelLitImpl.vertexViewSpaceX = null;
        ModelLitImpl.vertexViewSpaceY = null;
        ModelLitImpl.vertexViewSpaceZ = null;
        ModelLitImpl.tmpDepthFaceCount = null;
        ModelLitImpl.tmpDepthFaces = null;
        ModelLitImpl.tmpExtendedDepthFaceCount = null;
        ModelLitImpl.tmpExtendedDepthFaces = null;
        ModelLitImpl.sortFaceDepths = null;
        ModelLitImpl.sortFaceIndices = null;
        ModelLitImpl.tmpPriorityFaceCount = null;
        ModelLitImpl.tmpPriorityFaces = null;
        ModelLitImpl.tmpPriority10FaceDepth = null;
        ModelLitImpl.tmpPriority11FaceDepth = null;
        ModelLitImpl.tmpPriorityDepthSum = null;
        ModelLitImpl.clippedX = null;
        ModelLitImpl.clippedY = null;
        ModelLitImpl.clippedColour = null;
    }

    // HD w.m()V. No SD counterpart (fc.Gb is stored only by fc.<clinit>). The HD window-mode switch
    // (pm.a(ZIZIZII)V) calls it on entering a GL mode from software: Render2 switches to the quicksort, whose two
    // 4096-entry arrays are allocated fresh, and the bucket arrays are released.
    static allocateGlScratch(): void {
        ModelLitImpl.useQuickSort = true;
        ModelLitImpl.sortFaceDepths = new Int32Array(4096);
        ModelLitImpl.sortFaceIndices = new Int32Array(4096);
        ModelLitImpl.tmpDepthFaceCount = null;
        ModelLitImpl.tmpDepthFaces = null;
        ModelLitImpl.tmpExtendedDepthFaceCount = null;
        ModelLitImpl.tmpExtendedDepthFaces = null;
    }

    // HD w.o()V. No SD counterpart. pm.a(ZIZIZII)V calls it on returning to software from a GL mode: the reverse of
    // allocateGlScratch, reallocating the bucket arrays with the sizes of the <clinit>'s bucket arm.
    static allocateSoftwareScratch(): void {
        ModelLitImpl.useQuickSort = false;
        ModelLitImpl.sortFaceDepths = null;
        ModelLitImpl.sortFaceIndices = null;
        ModelLitImpl.tmpDepthFaceCount = new Int32Array(1600);
        ModelLitImpl.tmpDepthFaces = int2d(1600, 64);
        ModelLitImpl.tmpExtendedDepthFaceCount = new Int32Array(32);
        ModelLitImpl.tmpExtendedDepthFaces = int2d(32, 512);
    }

    // fc.k()V
    override Rotate270(): void {
        for (let var1 = 0; var1 < this.numPoints; var1++) {
            const var2 = arrayAtI32(this.pointZ, var1);
            arrayPutI32(this.pointZ, var1, arrayAtI32(this.pointX, var1));
            arrayPutI32(this.pointX, var1, -var2 | 0);
        }

        this.boundsCalculated = false;
    }

    // fc.n()V (NXT CalcBoundingCylinder)
    // The axis-aligned bounds, the xz radius (radiusCylinder) and the 3D radius (radiusSphere).
    private CalcBoundingCylinder(): void {
        let var1 = 32767;
        let var2 = 32767;
        let var3 = 32767;
        let var4 = -32768;
        let var5 = -32768;
        let var6 = -32768;
        let var7 = 0;
        let var8 = 0;

        for (let var9 = 0; var9 < this.numPoints; var9++) {
            const var10 = arrayAtI32(this.pointX, var9);
            const var11 = arrayAtI32(this.pointY, var9);
            const var12 = arrayAtI32(this.pointZ, var9);
            if (var10 < var1) {
                var1 = var10;
            }

            if (var10 > var4) {
                var4 = var10;
            }

            if (var11 < var2) {
                var2 = var11;
            }

            if (var11 > var5) {
                var5 = var11;
            }

            if (var12 < var3) {
                var3 = var12;
            }

            if (var12 > var6) {
                var6 = var12;
            }

            let var13 = (Math.imul(var10, var10) + Math.imul(var12, var12)) | 0;
            if (var13 > var7) {
                var7 = var13;
            }

            var13 = (var13 + Math.imul(var11, var11)) | 0;
            if (var13 > var8) {
                var8 = var13;
            }
        }

        this.minX = (var1 << 16) >> 16;
        this.maxX = (var4 << 16) >> 16;
        this.minY = (var2 << 16) >> 16;
        this.maxY = (var5 << 16) >> 16;
        this.minZ = (var3 << 16) >> 16;
        this.maxZ = (var6 << 16) >> 16;
        // var7 and var8 are in [0, 2^31), so the sqrt + 0.99 is below 46342 and d2i cannot saturate.
        this.radiusCylinder = (((Math.sqrt(var7) + 0.99) | 0) << 16) >> 16;
        this.radiusSphere = (((Math.sqrt(var8) + 0.99) | 0) << 16) >> 16;
        this.boundsCalculated = true;
    }

    // fc.a(ZZLfc;[B[S[I[I[I)Lnd; (NXT CopyForAnim(bool, ModelLitImpl&, Array<signed char>&))
    // Copies this model into the scratch model var3: the vertices always; the face alpha shared (var1) or copied into
    // var4; the HSL and lit colours shared (var2) or copied into var5..var8; everything else shared. Named exactly as
    // the NXT routine: the three public overloads carry the Spot/Actor/Loc suffix, so this one needs none.
    private CopyForAnim(var1: boolean, var2: boolean, var3: ModelLitImpl | null, var4: Uint8Array | null, var5: Int16Array | null, var6: Int32Array | null, var7: Int32Array | null, var8: Int32Array | null): ModelLit {
        if (var3 === null) {
            // putfield fc.D on a null scratch model (after unload).
            throw new TypeError('Null reference');
        }

        var3.numPoints = this.numPoints;
        var3.numFaces = this.numFaces;
        var3.numT = this.numT;
        if (var3.pointX === null || var3.pointX.length < this.numPoints) {
            var3.pointX = new Int32Array((this.numPoints + 100) | 0);
            var3.pointY = new Int32Array((this.numPoints + 100) | 0);
            var3.pointZ = new Int32Array((this.numPoints + 100) | 0);
        }

        for (let var9 = 0; var9 < this.numPoints; var9++) {
            arrayPutI32(var3.pointX, var9, arrayAtI32(this.pointX, var9));
            arrayPutI32(var3.pointY, var9, arrayAtI32(this.pointY, var9));
            arrayPutI32(var3.pointZ, var9, arrayAtI32(this.pointZ, var9));
        }

        if (var1) {
            var3.faceAlpha = this.faceAlpha;
        } else {
            var3.faceAlpha = var4;
            if (this.faceAlpha === null) {
                for (let var10 = 0; var10 < this.numFaces; var10++) {
                    putByte(var3.faceAlpha, var10, 0);
                }
            } else {
                for (let var11 = 0; var11 < this.numFaces; var11++) {
                    putByte(var3.faceAlpha, var11, byteAt(this.faceAlpha, var11));
                }
            }
        }

        if (var2) {
            var3.faceColour = this.faceColour;
            var3.faceColourA = this.faceColourA;
            var3.faceColourB = this.faceColourB;
            var3.faceColourC = this.faceColourC;
        } else {
            var3.faceColour = var5;
            var3.faceColourA = var6;
            var3.faceColourB = var7;
            var3.faceColourC = var8;

            for (let var12 = 0; var12 < this.numFaces; var12++) {
                arrayPutI16(var3.faceColour, var12, arrayAtI16(this.faceColour, var12));
                arrayPutI32(var3.faceColourA, var12, arrayAtI32(this.faceColourA, var12));
                arrayPutI32(var3.faceColourB, var12, arrayAtI32(this.faceColourB, var12));
                arrayPutI32(var3.faceColourC, var12, arrayAtI32(this.faceColourC, var12));
            }
        }

        var3.faceVertexA = this.faceVertexA;
        var3.faceVertexB = this.faceVertexB;
        var3.faceVertexC = this.faceVertexC;
        var3.facePriority = this.facePriority;
        var3.faceTextureAxis = this.faceTextureAxis;
        var3.faceMaterial = this.faceMaterial;
        var3.priority = this.priority;
        var3.faceTextureP = this.faceTextureP;
        var3.faceTextureM = this.faceTextureM;
        var3.faceTextureN = this.faceTextureN;
        var3.labelVertices = this.labelVertices;
        var3.labelFaces = this.labelFaces;
        var3.pointPartMask = this.pointPartMask;
        var3.facePartMask = this.facePartMask;
        var3.useAABBMouseCheck = this.useAABBMouseCheck;
        var3.boundsCalculated = false;
        return var3;
    }

    // fc.e(I)V (NXT SoftwareModelLitRenderer::Render3ZClip)
    // Draws face var1 clipped against the near plane z = 50 (a triangle or, with one vertex behind, a quad as two
    // triangles).
    private Render3ZClip(var1: number): void {
        const var2 = Pix3D.originX;
        const var3 = Pix3D.originY;
        let var4 = 0;
        const var5 = arrayAtI32(this.faceVertexA, var1);
        const var6 = arrayAtI32(this.faceVertexB, var1);
        const var7 = arrayAtI32(this.faceVertexC, var1);
        const var8 = arrayAtI32(ModelLitImpl.vertexViewSpaceZ, var5);
        const var9 = arrayAtI32(ModelLitImpl.vertexViewSpaceZ, var6);
        const var10 = arrayAtI32(ModelLitImpl.vertexViewSpaceZ, var7);
        if (this.faceAlpha === null) {
            Pix3D.trans = 0;
        } else {
            Pix3D.trans = byteAt(this.faceAlpha, var1) & 255;
        }

        if (var8 >= 50) {
            arrayPutI32(ModelLitImpl.clippedX, var4, arrayAtI32(ModelLitImpl.vertexScreenX, var5));
            arrayPutI32(ModelLitImpl.clippedY, var4, arrayAtI32(ModelLitImpl.vertexScreenY, var5));
            arrayPutI32(ModelLitImpl.clippedColour, var4++, arrayAtI32(this.faceColourA, var1) & 65535);
        } else {
            const var11 = arrayAtI32(ModelLitImpl.vertexViewSpaceX, var5);
            const var12 = arrayAtI32(ModelLitImpl.vertexViewSpaceY, var5);
            const var13 = arrayAtI32(this.faceColourA, var1) & 65535;
            if (var10 >= 50) {
                const var14 = Math.imul((50 - var8) | 0, arrayAtI32(Pix3D.divTable2, (var10 - var8) | 0));
                arrayPutI32(ModelLitImpl.clippedX, var4, (var2 + ((((var11 + (Math.imul((arrayAtI32(ModelLitImpl.vertexViewSpaceX, var7) - var11) | 0, var14) >> 16)) << 9) / 50) | 0)) | 0);
                arrayPutI32(ModelLitImpl.clippedY, var4, (var3 + ((((var12 + (Math.imul((arrayAtI32(ModelLitImpl.vertexViewSpaceY, var7) - var12) | 0, var14) >> 16)) << 9) / 50) | 0)) | 0);
                arrayPutI32(ModelLitImpl.clippedColour, var4++, (var13 + (Math.imul(((arrayAtI32(this.faceColourC, var1) & 65535) - var13) | 0, var14) >> 16)) | 0);
            }

            if (var9 >= 50) {
                const var30 = Math.imul((50 - var8) | 0, arrayAtI32(Pix3D.divTable2, (var9 - var8) | 0));
                arrayPutI32(ModelLitImpl.clippedX, var4, (var2 + ((((var11 + (Math.imul((arrayAtI32(ModelLitImpl.vertexViewSpaceX, var6) - var11) | 0, var30) >> 16)) << 9) / 50) | 0)) | 0);
                arrayPutI32(ModelLitImpl.clippedY, var4, (var3 + ((((var12 + (Math.imul((arrayAtI32(ModelLitImpl.vertexViewSpaceY, var6) - var12) | 0, var30) >> 16)) << 9) / 50) | 0)) | 0);
                arrayPutI32(ModelLitImpl.clippedColour, var4++, (var13 + (Math.imul(((arrayAtI32(this.faceColourB, var1) & 65535) - var13) | 0, var30) >> 16)) | 0);
            }
        }

        if (var9 >= 50) {
            arrayPutI32(ModelLitImpl.clippedX, var4, arrayAtI32(ModelLitImpl.vertexScreenX, var6));
            arrayPutI32(ModelLitImpl.clippedY, var4, arrayAtI32(ModelLitImpl.vertexScreenY, var6));
            arrayPutI32(ModelLitImpl.clippedColour, var4++, arrayAtI32(this.faceColourB, var1) & 65535);
        } else {
            const var21 = arrayAtI32(ModelLitImpl.vertexViewSpaceX, var6);
            const var24 = arrayAtI32(ModelLitImpl.vertexViewSpaceY, var6);
            const var27 = arrayAtI32(this.faceColourB, var1) & 65535;
            if (var8 >= 50) {
                const var31 = Math.imul((50 - var9) | 0, arrayAtI32(Pix3D.divTable2, (var8 - var9) | 0));
                arrayPutI32(ModelLitImpl.clippedX, var4, (var2 + ((((var21 + (Math.imul((arrayAtI32(ModelLitImpl.vertexViewSpaceX, var5) - var21) | 0, var31) >> 16)) << 9) / 50) | 0)) | 0);
                arrayPutI32(ModelLitImpl.clippedY, var4, (var3 + ((((var24 + (Math.imul((arrayAtI32(ModelLitImpl.vertexViewSpaceY, var5) - var24) | 0, var31) >> 16)) << 9) / 50) | 0)) | 0);
                arrayPutI32(ModelLitImpl.clippedColour, var4++, (var27 + (Math.imul(((arrayAtI32(this.faceColourA, var1) & 65535) - var27) | 0, var31) >> 16)) | 0);
            }

            if (var10 >= 50) {
                const var32 = Math.imul((50 - var9) | 0, arrayAtI32(Pix3D.divTable2, (var10 - var9) | 0));
                arrayPutI32(ModelLitImpl.clippedX, var4, (var2 + ((((var21 + (Math.imul((arrayAtI32(ModelLitImpl.vertexViewSpaceX, var7) - var21) | 0, var32) >> 16)) << 9) / 50) | 0)) | 0);
                arrayPutI32(ModelLitImpl.clippedY, var4, (var3 + ((((var24 + (Math.imul((arrayAtI32(ModelLitImpl.vertexViewSpaceY, var7) - var24) | 0, var32) >> 16)) << 9) / 50) | 0)) | 0);
                arrayPutI32(ModelLitImpl.clippedColour, var4++, (var27 + (Math.imul(((arrayAtI32(this.faceColourC, var1) & 65535) - var27) | 0, var32) >> 16)) | 0);
            }
        }

        if (var10 >= 50) {
            arrayPutI32(ModelLitImpl.clippedX, var4, arrayAtI32(ModelLitImpl.vertexScreenX, var7));
            arrayPutI32(ModelLitImpl.clippedY, var4, arrayAtI32(ModelLitImpl.vertexScreenY, var7));
            arrayPutI32(ModelLitImpl.clippedColour, var4++, arrayAtI32(this.faceColourC, var1) & 65535);
        } else {
            const var22 = arrayAtI32(ModelLitImpl.vertexViewSpaceX, var7);
            const var25 = arrayAtI32(ModelLitImpl.vertexViewSpaceY, var7);
            const var28 = arrayAtI32(this.faceColourC, var1) & 65535;
            if (var9 >= 50) {
                const var33 = Math.imul((50 - var10) | 0, arrayAtI32(Pix3D.divTable2, (var9 - var10) | 0));
                arrayPutI32(ModelLitImpl.clippedX, var4, (var2 + ((((var22 + (Math.imul((arrayAtI32(ModelLitImpl.vertexViewSpaceX, var6) - var22) | 0, var33) >> 16)) << 9) / 50) | 0)) | 0);
                arrayPutI32(ModelLitImpl.clippedY, var4, (var3 + ((((var25 + (Math.imul((arrayAtI32(ModelLitImpl.vertexViewSpaceY, var6) - var25) | 0, var33) >> 16)) << 9) / 50) | 0)) | 0);
                arrayPutI32(ModelLitImpl.clippedColour, var4++, (var28 + (Math.imul(((arrayAtI32(this.faceColourB, var1) & 65535) - var28) | 0, var33) >> 16)) | 0);
            }

            if (var8 >= 50) {
                const var34 = Math.imul((50 - var10) | 0, arrayAtI32(Pix3D.divTable2, (var8 - var10) | 0));
                arrayPutI32(ModelLitImpl.clippedX, var4, (var2 + ((((var22 + (Math.imul((arrayAtI32(ModelLitImpl.vertexViewSpaceX, var5) - var22) | 0, var34) >> 16)) << 9) / 50) | 0)) | 0);
                arrayPutI32(ModelLitImpl.clippedY, var4, (var3 + ((((var25 + (Math.imul((arrayAtI32(ModelLitImpl.vertexViewSpaceY, var5) - var25) | 0, var34) >> 16)) << 9) / 50) | 0)) | 0);
                arrayPutI32(ModelLitImpl.clippedColour, var4++, (var28 + (Math.imul(((arrayAtI32(this.faceColourA, var1) & 65535) - var28) | 0, var34) >> 16)) | 0);
            }
        }

        const var23 = arrayAtI32(ModelLitImpl.clippedX, 0);
        const var26 = arrayAtI32(ModelLitImpl.clippedX, 1);
        const var29 = arrayAtI32(ModelLitImpl.clippedX, 2);
        const var35 = arrayAtI32(ModelLitImpl.clippedY, 0);
        const var15 = arrayAtI32(ModelLitImpl.clippedY, 1);
        const var16 = arrayAtI32(ModelLitImpl.clippedY, 2);
        Pix3D.hclip = false;
        if (var4 === 3) {
            if (var23 < 0 || var26 < 0 || var29 < 0 || var23 > Pix3D.width || var26 > Pix3D.width || var29 > Pix3D.width) {
                Pix3D.hclip = true;
            }

            if (this.faceMaterial === null || arrayAtI16(this.faceMaterial, var1) === -1) {
                if (arrayAtI32(this.faceColourC, var1) === -1) {
                    Pix3D.flatTriangle(var35, var15, var16, var23, var26, var29, arrayAtI32(Pix3D.colourTable, arrayAtI32(this.faceColourA, var1) & 65535));
                } else {
                    Pix3D.gouraudTriangle(var35, var15, var16, var23, var26, var29, arrayAtI32(ModelLitImpl.clippedColour, 0), arrayAtI32(ModelLitImpl.clippedColour, 1), arrayAtI32(ModelLitImpl.clippedColour, 2));
                }
            } else {
                let var17: number;
                let var18: number;
                let var19: number;
                if (this.faceTextureAxis !== null && sbyteAt(this.faceTextureAxis, var1) !== -1) {
                    const var20 = byteAt(this.faceTextureAxis, var1) & 255;
                    var17 = arrayAtI32(this.faceTextureP, var20);
                    var18 = arrayAtI32(this.faceTextureM, var20);
                    var19 = arrayAtI32(this.faceTextureN, var20);
                } else {
                    var17 = var5;
                    var18 = var6;
                    var19 = var7;
                }

                if (arrayAtI32(this.faceColourC, var1) === -1) {
                    Pix3D.textureTriangle(
                        var35,
                        var15,
                        var16,
                        var23,
                        var26,
                        var29,
                        arrayAtI32(this.faceColourA, var1),
                        arrayAtI32(this.faceColourA, var1),
                        arrayAtI32(this.faceColourA, var1),
                        arrayAtI32(ModelLitImpl.vertexViewSpaceX, var17),
                        arrayAtI32(ModelLitImpl.vertexViewSpaceX, var18),
                        arrayAtI32(ModelLitImpl.vertexViewSpaceX, var19),
                        arrayAtI32(ModelLitImpl.vertexViewSpaceY, var17),
                        arrayAtI32(ModelLitImpl.vertexViewSpaceY, var18),
                        arrayAtI32(ModelLitImpl.vertexViewSpaceY, var19),
                        arrayAtI32(ModelLitImpl.vertexViewSpaceZ, var17),
                        arrayAtI32(ModelLitImpl.vertexViewSpaceZ, var18),
                        arrayAtI32(ModelLitImpl.vertexViewSpaceZ, var19),
                        arrayAtI16(this.faceMaterial, var1)
                    );
                } else {
                    Pix3D.textureTriangle(
                        var35,
                        var15,
                        var16,
                        var23,
                        var26,
                        var29,
                        arrayAtI32(ModelLitImpl.clippedColour, 0),
                        arrayAtI32(ModelLitImpl.clippedColour, 1),
                        arrayAtI32(ModelLitImpl.clippedColour, 2),
                        arrayAtI32(ModelLitImpl.vertexViewSpaceX, var17),
                        arrayAtI32(ModelLitImpl.vertexViewSpaceX, var18),
                        arrayAtI32(ModelLitImpl.vertexViewSpaceX, var19),
                        arrayAtI32(ModelLitImpl.vertexViewSpaceY, var17),
                        arrayAtI32(ModelLitImpl.vertexViewSpaceY, var18),
                        arrayAtI32(ModelLitImpl.vertexViewSpaceY, var19),
                        arrayAtI32(ModelLitImpl.vertexViewSpaceZ, var17),
                        arrayAtI32(ModelLitImpl.vertexViewSpaceZ, var18),
                        arrayAtI32(ModelLitImpl.vertexViewSpaceZ, var19),
                        arrayAtI16(this.faceMaterial, var1)
                    );
                }
            }
        }

        if (var4 === 4) {
            if (var23 < 0 || var26 < 0 || var29 < 0 || var23 > Pix3D.width || var26 > Pix3D.width || var29 > Pix3D.width || arrayAtI32(ModelLitImpl.clippedX, 3) < 0 || arrayAtI32(ModelLitImpl.clippedX, 3) > Pix3D.width) {
                Pix3D.hclip = true;
            }

            if (this.faceMaterial === null || arrayAtI16(this.faceMaterial, var1) === -1) {
                if (arrayAtI32(this.faceColourC, var1) === -1) {
                    const var37 = arrayAtI32(Pix3D.colourTable, arrayAtI32(this.faceColourA, var1) & 65535);
                    Pix3D.flatTriangle(var35, var15, var16, var23, var26, var29, var37);
                    Pix3D.flatTriangle(var35, var16, arrayAtI32(ModelLitImpl.clippedY, 3), var23, var29, arrayAtI32(ModelLitImpl.clippedX, 3), var37);
                    return;
                }

                Pix3D.gouraudTriangle(var35, var15, var16, var23, var26, var29, arrayAtI32(ModelLitImpl.clippedColour, 0), arrayAtI32(ModelLitImpl.clippedColour, 1), arrayAtI32(ModelLitImpl.clippedColour, 2));
                Pix3D.gouraudTriangle(
                    var35,
                    var16,
                    arrayAtI32(ModelLitImpl.clippedY, 3),
                    var23,
                    var29,
                    arrayAtI32(ModelLitImpl.clippedX, 3),
                    arrayAtI32(ModelLitImpl.clippedColour, 0),
                    arrayAtI32(ModelLitImpl.clippedColour, 2),
                    arrayAtI32(ModelLitImpl.clippedColour, 3)
                );
                return;
            }

            let var36: number;
            let var38: number;
            let var39: number;
            if (this.faceTextureAxis !== null && sbyteAt(this.faceTextureAxis, var1) !== -1) {
                const var40 = byteAt(this.faceTextureAxis, var1) & 255;
                var36 = arrayAtI32(this.faceTextureP, var40);
                var38 = arrayAtI32(this.faceTextureM, var40);
                var39 = arrayAtI32(this.faceTextureN, var40);
            } else {
                var36 = var5;
                var38 = var6;
                var39 = var7;
            }

            const var41 = arrayAtI16(this.faceMaterial, var1);
            if (arrayAtI32(this.faceColourC, var1) === -1) {
                Pix3D.textureTriangle(
                    var35,
                    var15,
                    var16,
                    var23,
                    var26,
                    var29,
                    arrayAtI32(this.faceColourA, var1),
                    arrayAtI32(this.faceColourA, var1),
                    arrayAtI32(this.faceColourA, var1),
                    arrayAtI32(ModelLitImpl.vertexViewSpaceX, var36),
                    arrayAtI32(ModelLitImpl.vertexViewSpaceX, var38),
                    arrayAtI32(ModelLitImpl.vertexViewSpaceX, var39),
                    arrayAtI32(ModelLitImpl.vertexViewSpaceY, var36),
                    arrayAtI32(ModelLitImpl.vertexViewSpaceY, var38),
                    arrayAtI32(ModelLitImpl.vertexViewSpaceY, var39),
                    arrayAtI32(ModelLitImpl.vertexViewSpaceZ, var36),
                    arrayAtI32(ModelLitImpl.vertexViewSpaceZ, var38),
                    arrayAtI32(ModelLitImpl.vertexViewSpaceZ, var39),
                    var41
                );
                Pix3D.textureTriangle(
                    var35,
                    var16,
                    arrayAtI32(ModelLitImpl.clippedY, 3),
                    var23,
                    var29,
                    arrayAtI32(ModelLitImpl.clippedX, 3),
                    arrayAtI32(this.faceColourA, var1),
                    arrayAtI32(this.faceColourA, var1),
                    arrayAtI32(this.faceColourA, var1),
                    arrayAtI32(ModelLitImpl.vertexViewSpaceX, var36),
                    arrayAtI32(ModelLitImpl.vertexViewSpaceX, var38),
                    arrayAtI32(ModelLitImpl.vertexViewSpaceX, var39),
                    arrayAtI32(ModelLitImpl.vertexViewSpaceY, var36),
                    arrayAtI32(ModelLitImpl.vertexViewSpaceY, var38),
                    arrayAtI32(ModelLitImpl.vertexViewSpaceY, var39),
                    arrayAtI32(ModelLitImpl.vertexViewSpaceZ, var36),
                    arrayAtI32(ModelLitImpl.vertexViewSpaceZ, var38),
                    arrayAtI32(ModelLitImpl.vertexViewSpaceZ, var39),
                    var41
                );
                return;
            }

            Pix3D.textureTriangle(
                var35,
                var15,
                var16,
                var23,
                var26,
                var29,
                arrayAtI32(ModelLitImpl.clippedColour, 0),
                arrayAtI32(ModelLitImpl.clippedColour, 1),
                arrayAtI32(ModelLitImpl.clippedColour, 2),
                arrayAtI32(ModelLitImpl.vertexViewSpaceX, var36),
                arrayAtI32(ModelLitImpl.vertexViewSpaceX, var38),
                arrayAtI32(ModelLitImpl.vertexViewSpaceX, var39),
                arrayAtI32(ModelLitImpl.vertexViewSpaceY, var36),
                arrayAtI32(ModelLitImpl.vertexViewSpaceY, var38),
                arrayAtI32(ModelLitImpl.vertexViewSpaceY, var39),
                arrayAtI32(ModelLitImpl.vertexViewSpaceZ, var36),
                arrayAtI32(ModelLitImpl.vertexViewSpaceZ, var38),
                arrayAtI32(ModelLitImpl.vertexViewSpaceZ, var39),
                var41
            );
            Pix3D.textureTriangle(
                var35,
                var16,
                arrayAtI32(ModelLitImpl.clippedY, 3),
                var23,
                var29,
                arrayAtI32(ModelLitImpl.clippedX, 3),
                arrayAtI32(ModelLitImpl.clippedColour, 0),
                arrayAtI32(ModelLitImpl.clippedColour, 2),
                arrayAtI32(ModelLitImpl.clippedColour, 3),
                arrayAtI32(ModelLitImpl.vertexViewSpaceX, var36),
                arrayAtI32(ModelLitImpl.vertexViewSpaceX, var38),
                arrayAtI32(ModelLitImpl.vertexViewSpaceX, var39),
                arrayAtI32(ModelLitImpl.vertexViewSpaceY, var36),
                arrayAtI32(ModelLitImpl.vertexViewSpaceY, var38),
                arrayAtI32(ModelLitImpl.vertexViewSpaceY, var39),
                arrayAtI32(ModelLitImpl.vertexViewSpaceZ, var36),
                arrayAtI32(ModelLitImpl.vertexViewSpaceZ, var38),
                arrayAtI32(ModelLitImpl.vertexViewSpaceZ, var39),
                var41
            );
        }
    }

    // fc.c(ZZZ)Lnd; (NXT CopyForAnim into m_tempModel2)
    // var1 = share the face alpha, var2 = share the colours; var3 is unused by the software model (the vertices are
    // always copied).
    override CopyForAnimLoc(var1: boolean, var2: boolean, _var3: boolean): ModelLit {
        if (!var1 && requireNonNull(ModelLitImpl.tempLocFaceAlpha).length < this.numFaces) {
            ModelLitImpl.tempLocFaceAlpha = new Uint8Array((this.numFaces + 100) | 0);
        }

        if (!var2 && requireNonNull(ModelLitImpl.tempLocFaceColour).length < this.numFaces) {
            ModelLitImpl.tempLocFaceColourA = new Int32Array((this.numFaces + 100) | 0);
            ModelLitImpl.tempLocFaceColourB = new Int32Array((this.numFaces + 100) | 0);
            ModelLitImpl.tempLocFaceColourC = new Int32Array((this.numFaces + 100) | 0);
            ModelLitImpl.tempLocFaceColour = new Int16Array((this.numFaces + 100) | 0);
        }

        return this.CopyForAnim(var1, var2, ModelLitImpl.tempLocModel, ModelLitImpl.tempLocFaceAlpha, ModelLitImpl.tempLocFaceColour, ModelLitImpl.tempLocFaceColourA, ModelLitImpl.tempLocFaceColourB, ModelLitImpl.tempLocFaceColourC);
    }

    // fc.b(IIIIIIII)V (NXT SoftwareModelLitRenderer::ObjRenderOrthog)
    // ObjRender with an orthographic projection: screen = origin + (view << 9) / var8.
    ObjRenderOrthog(var1: number, var2: number, var3: number, var4: number, var5: number, var6: number, var7: number, var8: number): void {
        try {
            if (!this.boundsCalculated) {
                this.CalcBoundingCylinder();
            }

            const var9 = Pix3D.originX;
            const var10 = Pix3D.originY;
            const var11 = arrayAtI32(Pix3D.sinTable, var1);
            const var12 = arrayAtI32(Pix3D.cosTable, var1);
            const var13 = arrayAtI32(Pix3D.sinTable, var2);
            const var14 = arrayAtI32(Pix3D.cosTable, var2);
            const var15 = arrayAtI32(Pix3D.sinTable, var3);
            const var16 = arrayAtI32(Pix3D.cosTable, var3);
            const var17 = arrayAtI32(Pix3D.sinTable, var4);
            const var18 = arrayAtI32(Pix3D.cosTable, var4);
            const var19 = (Math.imul(var6, var17) + Math.imul(var7, var18)) >> 16;

            for (let var20 = 0; var20 < this.numPoints; var20++) {
                let var21 = arrayAtI32(this.pointX, var20);
                let var22 = arrayAtI32(this.pointY, var20);
                let var23 = arrayAtI32(this.pointZ, var20);
                if (var3 !== 0) {
                    const var24 = (Math.imul(var22, var15) + Math.imul(var21, var16)) >> 16;
                    var22 = (Math.imul(var22, var16) - Math.imul(var21, var15)) >> 16;
                    var21 = var24;
                }

                if (var1 !== 0) {
                    const var30 = (Math.imul(var22, var12) - Math.imul(var23, var11)) >> 16;
                    var23 = (Math.imul(var22, var11) + Math.imul(var23, var12)) >> 16;
                    var22 = var30;
                }

                if (var2 !== 0) {
                    const var31 = (Math.imul(var23, var13) + Math.imul(var21, var14)) >> 16;
                    var23 = (Math.imul(var23, var14) - Math.imul(var21, var13)) >> 16;
                    var21 = var31;
                }

                var21 = (var21 + var5) | 0;
                var22 = (var22 + var6) | 0;
                var23 = (var23 + var7) | 0;
                const var32 = (Math.imul(var22, var18) - Math.imul(var23, var17)) >> 16;
                var23 = (Math.imul(var22, var17) + Math.imul(var23, var18)) >> 16;
                arrayPutI32(ModelLitImpl.vertexScreenZ, var20, (var23 - var19) | 0);
                arrayPutI32(ModelLitImpl.vertexScreenX, var20, (var9 + intDivide(var21 << 9, var8)) | 0);
                arrayPutI32(ModelLitImpl.vertexScreenY, var20, (var10 + intDivide(var32 << 9, var8)) | 0);
                if (this.numT > 0) {
                    arrayPutI32(ModelLitImpl.vertexViewSpaceX, var20, var21);
                    arrayPutI32(ModelLitImpl.vertexViewSpaceY, var20, var32);
                    arrayPutI32(ModelLitImpl.vertexViewSpaceZ, var20, var23);
                }
            }

            this.Render2(false, false, 0n, this.radiusSphere, this.radiusSphere << 1, null);
        } catch (e) {
            // catch (RuntimeException)
            if (!isJavaException(e)) throw e;
        }
    }

    // fc.c(III)V
    override Resize(var1: number, var2: number, var3: number): void {
        for (let var4 = 0; var4 < this.numPoints; var4++) {
            arrayPutI32(this.pointX, var4, (Math.imul(arrayAtI32(this.pointX, var4), var1) / 128) | 0);
            arrayPutI32(this.pointY, var4, (Math.imul(arrayAtI32(this.pointY, var4), var2) / 128) | 0);
            arrayPutI32(this.pointZ, var4, (Math.imul(arrayAtI32(this.pointZ, var4), var3) / 128) | 0);
        }

        this.boundsCalculated = false;
    }

    // fc.b(ZZZ)Lnd; (NXT CopyForAnim into m_tempModel)
    // var3 is unused by the software model.
    override CopyForAnimActor(var1: boolean, var2: boolean, _var3: boolean): ModelLit {
        if (!var1 && requireNonNull(ModelLitImpl.tempActorFaceAlpha).length < this.numFaces) {
            ModelLitImpl.tempActorFaceAlpha = new Uint8Array((this.numFaces + 100) | 0);
        }

        if (!var2 && requireNonNull(ModelLitImpl.tempActorFaceColour).length < this.numFaces) {
            ModelLitImpl.tempActorFaceColourA = new Int32Array((this.numFaces + 100) | 0);
            ModelLitImpl.tempActorFaceColourB = new Int32Array((this.numFaces + 100) | 0);
            ModelLitImpl.tempActorFaceColourC = new Int32Array((this.numFaces + 100) | 0);
            ModelLitImpl.tempActorFaceColour = new Int16Array((this.numFaces + 100) | 0);
        }

        return this.CopyForAnim(var1, var2, ModelLitImpl.tempActorModel, ModelLitImpl.tempActorFaceAlpha, ModelLitImpl.tempActorFaceColour, ModelLitImpl.tempActorFaceColourA, ModelLitImpl.tempActorFaceColourB, ModelLitImpl.tempActorFaceColourC);
    }

    // fc.a(I[IIIIZI[I)V
    override animate2Masked(var1: number, var2: Int32Array | null, var3: number, var4: number, var5: number, _var6: boolean, var7: number, var8: Int32Array | null): void {
        const var9 = requireNonNull(var2).length;
        if (var1 === 0) {
            let var56 = 0;
            ModelLitImpl.originX = 0;
            ModelLitImpl.originY = 0;
            ModelLitImpl.originZ = 0;

            for (let var64 = 0; var64 < var9; var64++) {
                const var72 = arrayAtI32(var2, var64);
                if (var72 < requireNonNull(this.labelVertices).length) {
                    const var79 = requireNonNull(arrayAtObj(this.labelVertices, var72));

                    for (let var86 = 0; var86 < var79.length; var86++) {
                        const var93 = var79[var86];
                        if (this.pointPartMask === null || (var7 & arrayAtI16(this.pointPartMask, var93)) !== 0) {
                            ModelLitImpl.originX = (ModelLitImpl.originX + arrayAtI32(this.pointX, var93)) | 0;
                            ModelLitImpl.originY = (ModelLitImpl.originY + arrayAtI32(this.pointY, var93)) | 0;
                            ModelLitImpl.originZ = (ModelLitImpl.originZ + arrayAtI32(this.pointZ, var93)) | 0;
                            var56++;
                        }
                    }
                }
            }

            if (var56 > 0) {
                ModelLitImpl.originX = (((ModelLitImpl.originX / var56) | 0) + var3) | 0;
                ModelLitImpl.originY = (((ModelLitImpl.originY / var56) | 0) + var4) | 0;
                ModelLitImpl.originZ = (((ModelLitImpl.originZ / var56) | 0) + var5) | 0;
                ModelLitImpl.originTransformPending = true;
                return;
            }

            ModelLitImpl.originX = var3;
            ModelLitImpl.originY = var4;
            ModelLitImpl.originZ = var5;
            return;
        }

        if (var1 === 1) {
            if (var8 !== null) {
                const var54 = (Math.imul(arrayAtI32(var8, 0), var3) + Math.imul(arrayAtI32(var8, 1), var4) + Math.imul(arrayAtI32(var8, 2), var5) + 16384) >> 15;
                const var62 = (Math.imul(arrayAtI32(var8, 3), var3) + Math.imul(arrayAtI32(var8, 4), var4) + Math.imul(arrayAtI32(var8, 5), var5) + 16384) >> 15;
                const var70 = (Math.imul(arrayAtI32(var8, 6), var3) + Math.imul(arrayAtI32(var8, 7), var4) + Math.imul(arrayAtI32(var8, 8), var5) + 16384) >> 15;
                var3 = var54;
                var4 = var62;
                var5 = var70;
            }

            for (let var55 = 0; var55 < var9; var55++) {
                const var63 = arrayAtI32(var2, var55);
                if (var63 < requireNonNull(this.labelVertices).length) {
                    const var71 = requireNonNull(arrayAtObj(this.labelVertices, var63));

                    for (let var78 = 0; var78 < var71.length; var78++) {
                        const var85 = var71[var78];
                        if (this.pointPartMask === null || (var7 & arrayAtI16(this.pointPartMask, var85)) !== 0) {
                            arrayPutI32(this.pointX, var85, (arrayAtI32(this.pointX, var85) + var3) | 0);
                            arrayPutI32(this.pointY, var85, (arrayAtI32(this.pointY, var85) + var4) | 0);
                            arrayPutI32(this.pointZ, var85, (arrayAtI32(this.pointZ, var85) + var5) | 0);
                        }
                    }
                }
            }

            return;
        }

        if (var1 === 2) {
            if (var8 !== null) {
                const var53 = arrayAtI32(var8, 9);
                const var61 = arrayAtI32(var8, 10);
                const var69 = arrayAtI32(var8, 11);
                const var77 = arrayAtI32(var8, 12);
                const var84 = arrayAtI32(var8, 13);
                const var92 = arrayAtI32(var8, 14);
                if (ModelLitImpl.originTransformPending) {
                    let var101 = (Math.imul(arrayAtI32(var8, 0), ModelLitImpl.originX) + Math.imul(arrayAtI32(var8, 3), ModelLitImpl.originY) + Math.imul(arrayAtI32(var8, 6), ModelLitImpl.originZ) + 16384) >> 15;
                    let var111 = (Math.imul(arrayAtI32(var8, 1), ModelLitImpl.originX) + Math.imul(arrayAtI32(var8, 4), ModelLitImpl.originY) + Math.imul(arrayAtI32(var8, 7), ModelLitImpl.originZ) + 16384) >> 15;
                    let var118 = (Math.imul(arrayAtI32(var8, 2), ModelLitImpl.originX) + Math.imul(arrayAtI32(var8, 5), ModelLitImpl.originY) + Math.imul(arrayAtI32(var8, 8), ModelLitImpl.originZ) + 16384) >> 15;
                    var101 = (var101 + var77) | 0;
                    var111 = (var111 + var84) | 0;
                    var118 = (var118 + var92) | 0;
                    ModelLitImpl.originX = var101;
                    ModelLitImpl.originY = var111;
                    ModelLitImpl.originZ = var118;
                    ModelLitImpl.originTransformPending = false;
                }

                const var103 = new Int32Array(9);
                const var113 = arrayAtI32(Pix3D.cosTable, var3) >> 1;
                const var120 = arrayAtI32(Pix3D.sinTable, var3) >> 1;
                const var121 = arrayAtI32(Pix3D.cosTable, var4) >> 1;
                const var122 = arrayAtI32(Pix3D.sinTable, var4) >> 1;
                const var123 = arrayAtI32(Pix3D.cosTable, var5) >> 1;
                const var124 = arrayAtI32(Pix3D.sinTable, var5) >> 1;
                const var125 = (Math.imul(var120, var123) + 16384) >> 15;
                const var126 = (Math.imul(var120, var124) + 16384) >> 15;
                var103[0] = (Math.imul(var121, var123) + Math.imul(var122, var126) + 16384) >> 15;
                var103[1] = (Math.imul(-var121, var124) + Math.imul(var122, var125) + 16384) >> 15;
                var103[2] = (Math.imul(var122, var113) + 16384) >> 15;
                var103[3] = (Math.imul(var113, var124) + 16384) >> 15;
                var103[4] = (Math.imul(var113, var123) + 16384) >> 15;
                var103[5] = -var120;
                var103[6] = (Math.imul(-var122, var123) + Math.imul(var121, var126) + 16384) >> 15;
                var103[7] = (Math.imul(var122, var124) + Math.imul(var121, var125) + 16384) >> 15;
                var103[8] = (Math.imul(var121, var113) + 16384) >> 15;
                const var127 = (Math.imul(var103[0], -ModelLitImpl.originX) + Math.imul(var103[1], -ModelLitImpl.originY) + Math.imul(var103[2], -ModelLitImpl.originZ) + 16384) >> 15;
                const var129 = (Math.imul(var103[3], -ModelLitImpl.originX) + Math.imul(var103[4], -ModelLitImpl.originY) + Math.imul(var103[5], -ModelLitImpl.originZ) + 16384) >> 15;
                const var131 = (Math.imul(var103[6], -ModelLitImpl.originX) + Math.imul(var103[7], -ModelLitImpl.originY) + Math.imul(var103[8], -ModelLitImpl.originZ) + 16384) >> 15;
                const var133 = (var127 + ModelLitImpl.originX) | 0;
                const var134 = (var129 + ModelLitImpl.originY) | 0;
                const var135 = (var131 + ModelLitImpl.originZ) | 0;
                const var138 = new Int32Array(9);

                for (let var141 = 0; var141 < 3; var141++) {
                    for (let var144 = 0; var144 < 3; var144++) {
                        let var147 = 0;

                        for (let var150 = 0; var150 < 3; var150++) {
                            var147 = (var147 + Math.imul(var103[var141 * 3 + var150], arrayAtI32(var8, var144 * 3 + var150))) | 0;
                        }

                        var138[var141 * 3 + var144] = (var147 + 16384) >> 15;
                    }
                }

                let var145 = (Math.imul(var103[0], var77) + Math.imul(var103[1], var84) + Math.imul(var103[2], var92) + 16384) >> 15;
                let var148 = (Math.imul(var103[3], var77) + Math.imul(var103[4], var84) + Math.imul(var103[5], var92) + 16384) >> 15;
                let var151 = (Math.imul(var103[6], var77) + Math.imul(var103[7], var84) + Math.imul(var103[8], var92) + 16384) >> 15;
                var145 = (var145 + var133) | 0;
                var148 = (var148 + var134) | 0;
                var151 = (var151 + var135) | 0;
                const var153 = new Int32Array(9);

                for (let var154 = 0; var154 < 3; var154++) {
                    for (let var155 = 0; var155 < 3; var155++) {
                        let var159 = 0;

                        for (let var163 = 0; var163 < 3; var163++) {
                            var159 = (var159 + Math.imul(arrayAtI32(var8, var154 * 3 + var163), var138[var155 + var163 * 3])) | 0;
                        }

                        var153[var154 * 3 + var155] = (var159 + 16384) >> 15;
                    }
                }

                let var156 = (Math.imul(arrayAtI32(var8, 0), var145) + Math.imul(arrayAtI32(var8, 1), var148) + Math.imul(arrayAtI32(var8, 2), var151) + 16384) >> 15;
                let var160 = (Math.imul(arrayAtI32(var8, 3), var145) + Math.imul(arrayAtI32(var8, 4), var148) + Math.imul(arrayAtI32(var8, 5), var151) + 16384) >> 15;
                let var164 = (Math.imul(arrayAtI32(var8, 6), var145) + Math.imul(arrayAtI32(var8, 7), var148) + Math.imul(arrayAtI32(var8, 8), var151) + 16384) >> 15;
                var156 = (var156 + var53) | 0;
                var160 = (var160 + var61) | 0;
                var164 = (var164 + var69) | 0;

                for (let var167 = 0; var167 < var9; var167++) {
                    const var42 = arrayAtI32(var2, var167);
                    if (var42 < requireNonNull(this.labelVertices).length) {
                        const var43 = requireNonNull(arrayAtObj(this.labelVertices, var42));

                        for (let var44 = 0; var44 < var43.length; var44++) {
                            const var45 = var43[var44];
                            if (this.pointPartMask === null || (var7 & arrayAtI16(this.pointPartMask, var45)) !== 0) {
                                let var46 = (Math.imul(var153[0], arrayAtI32(this.pointX, var45)) + Math.imul(var153[1], arrayAtI32(this.pointY, var45)) + Math.imul(var153[2], arrayAtI32(this.pointZ, var45)) + 16384) >> 15;
                                let var47 = (Math.imul(var153[3], arrayAtI32(this.pointX, var45)) + Math.imul(var153[4], arrayAtI32(this.pointY, var45)) + Math.imul(var153[5], arrayAtI32(this.pointZ, var45)) + 16384) >> 15;
                                let var48 = (Math.imul(var153[6], arrayAtI32(this.pointX, var45)) + Math.imul(var153[7], arrayAtI32(this.pointY, var45)) + Math.imul(var153[8], arrayAtI32(this.pointZ, var45)) + 16384) >> 15;
                                var46 = (var46 + var156) | 0;
                                var47 = (var47 + var160) | 0;
                                var48 = (var48 + var164) | 0;
                                arrayPutI32(this.pointX, var45, var46);
                                arrayPutI32(this.pointY, var45, var47);
                                arrayPutI32(this.pointZ, var45, var48);
                            }
                        }
                    }
                }

                return;
            }

            for (let var52 = 0; var52 < var9; var52++) {
                const var60 = arrayAtI32(var2, var52);
                if (var60 < requireNonNull(this.labelVertices).length) {
                    const var68 = requireNonNull(arrayAtObj(this.labelVertices, var60));

                    for (let var76 = 0; var76 < var68.length; var76++) {
                        const var83 = var68[var76];
                        if (this.pointPartMask === null || (var7 & arrayAtI16(this.pointPartMask, var83)) !== 0) {
                            arrayPutI32(this.pointX, var83, (arrayAtI32(this.pointX, var83) - ModelLitImpl.originX) | 0);
                            arrayPutI32(this.pointY, var83, (arrayAtI32(this.pointY, var83) - ModelLitImpl.originY) | 0);
                            arrayPutI32(this.pointZ, var83, (arrayAtI32(this.pointZ, var83) - ModelLitImpl.originZ) | 0);
                            if (var5 !== 0) {
                                const var89 = arrayAtI32(Pix3D.sinTable, var5);
                                const var98 = arrayAtI32(Pix3D.cosTable, var5);
                                const var108 = (Math.imul(arrayAtI32(this.pointY, var83), var89) + Math.imul(arrayAtI32(this.pointX, var83), var98) + 32767) >> 16;
                                arrayPutI32(this.pointY, var83, (Math.imul(arrayAtI32(this.pointY, var83), var98) - Math.imul(arrayAtI32(this.pointX, var83), var89) + 32767) >> 16);
                                arrayPutI32(this.pointX, var83, var108);
                            }

                            if (var3 !== 0) {
                                const var90 = arrayAtI32(Pix3D.sinTable, var3);
                                const var99 = arrayAtI32(Pix3D.cosTable, var3);
                                const var109 = (Math.imul(arrayAtI32(this.pointY, var83), var99) - Math.imul(arrayAtI32(this.pointZ, var83), var90) + 32767) >> 16;
                                arrayPutI32(this.pointZ, var83, (Math.imul(arrayAtI32(this.pointY, var83), var90) + Math.imul(arrayAtI32(this.pointZ, var83), var99) + 32767) >> 16);
                                arrayPutI32(this.pointY, var83, var109);
                            }

                            if (var4 !== 0) {
                                const var91 = arrayAtI32(Pix3D.sinTable, var4);
                                const var100 = arrayAtI32(Pix3D.cosTable, var4);
                                const var110 = (Math.imul(arrayAtI32(this.pointZ, var83), var91) + Math.imul(arrayAtI32(this.pointX, var83), var100) + 32767) >> 16;
                                arrayPutI32(this.pointZ, var83, (Math.imul(arrayAtI32(this.pointZ, var83), var100) - Math.imul(arrayAtI32(this.pointX, var83), var91) + 32767) >> 16);
                                arrayPutI32(this.pointX, var83, var110);
                            }

                            arrayPutI32(this.pointX, var83, (arrayAtI32(this.pointX, var83) + ModelLitImpl.originX) | 0);
                            arrayPutI32(this.pointY, var83, (arrayAtI32(this.pointY, var83) + ModelLitImpl.originY) | 0);
                            arrayPutI32(this.pointZ, var83, (arrayAtI32(this.pointZ, var83) + ModelLitImpl.originZ) | 0);
                        }
                    }
                }
            }

            return;
        }

        if (var1 === 3) {
            if (var8 !== null) {
                const var51 = arrayAtI32(var8, 9);
                const var59 = arrayAtI32(var8, 10);
                const var67 = arrayAtI32(var8, 11);
                const var75 = arrayAtI32(var8, 12);
                const var82 = arrayAtI32(var8, 13);
                const var88 = arrayAtI32(var8, 14);
                if (ModelLitImpl.originTransformPending) {
                    let var95 = (Math.imul(arrayAtI32(var8, 0), ModelLitImpl.originX) + Math.imul(arrayAtI32(var8, 3), ModelLitImpl.originY) + Math.imul(arrayAtI32(var8, 6), ModelLitImpl.originZ) + 16384) >> 15;
                    let var105 = (Math.imul(arrayAtI32(var8, 1), ModelLitImpl.originX) + Math.imul(arrayAtI32(var8, 4), ModelLitImpl.originY) + Math.imul(arrayAtI32(var8, 7), ModelLitImpl.originZ) + 16384) >> 15;
                    let var115 = (Math.imul(arrayAtI32(var8, 2), ModelLitImpl.originX) + Math.imul(arrayAtI32(var8, 5), ModelLitImpl.originY) + Math.imul(arrayAtI32(var8, 8), ModelLitImpl.originZ) + 16384) >> 15;
                    var95 = (var95 + var75) | 0;
                    var105 = (var105 + var82) | 0;
                    var115 = (var115 + var88) | 0;
                    ModelLitImpl.originX = var95;
                    ModelLitImpl.originY = var105;
                    ModelLitImpl.originZ = var115;
                    ModelLitImpl.originTransformPending = false;
                }

                const var97 = (var3 << 15) >> 7;
                const var107 = (var4 << 15) >> 7;
                const var117 = (var5 << 15) >> 7;
                const var19 = (Math.imul(var97, -ModelLitImpl.originX) + 16384) >> 15;
                const var20 = (Math.imul(var107, -ModelLitImpl.originY) + 16384) >> 15;
                const var21 = (Math.imul(var117, -ModelLitImpl.originZ) + 16384) >> 15;
                const var22 = (var19 + ModelLitImpl.originX) | 0;
                const var23 = (var20 + ModelLitImpl.originY) | 0;
                const var24 = (var21 + ModelLitImpl.originZ) | 0;
                const var25 = Int32Array.of(
                    (Math.imul(var97, arrayAtI32(var8, 0)) + 16384) >> 15,
                    (Math.imul(var97, arrayAtI32(var8, 3)) + 16384) >> 15,
                    (Math.imul(var97, arrayAtI32(var8, 6)) + 16384) >> 15,
                    (Math.imul(var107, arrayAtI32(var8, 1)) + 16384) >> 15,
                    (Math.imul(var107, arrayAtI32(var8, 4)) + 16384) >> 15,
                    (Math.imul(var107, arrayAtI32(var8, 7)) + 16384) >> 15,
                    (Math.imul(var117, arrayAtI32(var8, 2)) + 16384) >> 15,
                    (Math.imul(var117, arrayAtI32(var8, 5)) + 16384) >> 15,
                    (Math.imul(var117, arrayAtI32(var8, 8)) + 16384) >> 15
                );
                let var26 = (Math.imul(var97, var75) + 16384) >> 15;
                let var27 = (Math.imul(var107, var82) + 16384) >> 15;
                let var28 = (Math.imul(var117, var88) + 16384) >> 15;
                var26 = (var26 + var22) | 0;
                var27 = (var27 + var23) | 0;
                var28 = (var28 + var24) | 0;
                const var29 = new Int32Array(9);

                for (let var30 = 0; var30 < 3; var30++) {
                    for (let var31 = 0; var31 < 3; var31++) {
                        let var32 = 0;

                        for (let var33 = 0; var33 < 3; var33++) {
                            var32 = (var32 + Math.imul(arrayAtI32(var8, var30 * 3 + var33), var25[var31 + var33 * 3])) | 0;
                        }

                        var29[var30 * 3 + var31] = (var32 + 16384) >> 15;
                    }
                }

                let var136 = (Math.imul(arrayAtI32(var8, 0), var26) + Math.imul(arrayAtI32(var8, 1), var27) + Math.imul(arrayAtI32(var8, 2), var28) + 16384) >> 15;
                let var139 = (Math.imul(arrayAtI32(var8, 3), var26) + Math.imul(arrayAtI32(var8, 4), var27) + Math.imul(arrayAtI32(var8, 5), var28) + 16384) >> 15;
                let var142 = (Math.imul(arrayAtI32(var8, 6), var26) + Math.imul(arrayAtI32(var8, 7), var27) + Math.imul(arrayAtI32(var8, 8), var28) + 16384) >> 15;
                var136 = (var136 + var51) | 0;
                var139 = (var139 + var59) | 0;
                var142 = (var142 + var67) | 0;

                for (let var34 = 0; var34 < var9; var34++) {
                    const var35 = arrayAtI32(var2, var34);
                    if (var35 < requireNonNull(this.labelVertices).length) {
                        const var36 = requireNonNull(arrayAtObj(this.labelVertices, var35));

                        for (let var37 = 0; var37 < var36.length; var37++) {
                            const var38 = var36[var37];
                            if (this.pointPartMask === null || (var7 & arrayAtI16(this.pointPartMask, var38)) !== 0) {
                                let var39 = (Math.imul(var29[0], arrayAtI32(this.pointX, var38)) + Math.imul(var29[1], arrayAtI32(this.pointY, var38)) + Math.imul(var29[2], arrayAtI32(this.pointZ, var38)) + 16384) >> 15;
                                let var40 = (Math.imul(var29[3], arrayAtI32(this.pointX, var38)) + Math.imul(var29[4], arrayAtI32(this.pointY, var38)) + Math.imul(var29[5], arrayAtI32(this.pointZ, var38)) + 16384) >> 15;
                                let var41 = (Math.imul(var29[6], arrayAtI32(this.pointX, var38)) + Math.imul(var29[7], arrayAtI32(this.pointY, var38)) + Math.imul(var29[8], arrayAtI32(this.pointZ, var38)) + 16384) >> 15;
                                var39 = (var39 + var136) | 0;
                                var40 = (var40 + var139) | 0;
                                var41 = (var41 + var142) | 0;
                                arrayPutI32(this.pointX, var38, var39);
                                arrayPutI32(this.pointY, var38, var40);
                                arrayPutI32(this.pointZ, var38, var41);
                            }
                        }
                    }
                }

                return;
            }

            for (let var50 = 0; var50 < var9; var50++) {
                const var58 = arrayAtI32(var2, var50);
                if (var58 < requireNonNull(this.labelVertices).length) {
                    const var66 = requireNonNull(arrayAtObj(this.labelVertices, var58));

                    for (let var74 = 0; var74 < var66.length; var74++) {
                        const var81 = var66[var74];
                        if (this.pointPartMask === null || (var7 & arrayAtI16(this.pointPartMask, var81)) !== 0) {
                            arrayPutI32(this.pointX, var81, (arrayAtI32(this.pointX, var81) - ModelLitImpl.originX) | 0);
                            arrayPutI32(this.pointY, var81, (arrayAtI32(this.pointY, var81) - ModelLitImpl.originY) | 0);
                            arrayPutI32(this.pointZ, var81, (arrayAtI32(this.pointZ, var81) - ModelLitImpl.originZ) | 0);
                            arrayPutI32(this.pointX, var81, (Math.imul(arrayAtI32(this.pointX, var81), var3) / 128) | 0);
                            arrayPutI32(this.pointY, var81, (Math.imul(arrayAtI32(this.pointY, var81), var4) / 128) | 0);
                            arrayPutI32(this.pointZ, var81, (Math.imul(arrayAtI32(this.pointZ, var81), var5) / 128) | 0);
                            arrayPutI32(this.pointX, var81, (arrayAtI32(this.pointX, var81) + ModelLitImpl.originX) | 0);
                            arrayPutI32(this.pointY, var81, (arrayAtI32(this.pointY, var81) + ModelLitImpl.originY) | 0);
                            arrayPutI32(this.pointZ, var81, (arrayAtI32(this.pointZ, var81) + ModelLitImpl.originZ) | 0);
                        }
                    }
                }
            }

            return;
        }

        if (var1 === 5) {
            if (this.labelFaces !== null && this.faceAlpha !== null) {
                for (let var49 = 0; var49 < var9; var49++) {
                    const var57 = arrayAtI32(var2, var49);
                    if (var57 < this.labelFaces.length) {
                        const var65 = requireNonNull(arrayAtObj(this.labelFaces, var57));

                        for (let var73 = 0; var73 < var65.length; var73++) {
                            const var80 = var65[var73];
                            if (this.facePartMask === null || (var7 & arrayAtI16(this.facePartMask, var80)) !== 0) {
                                let var87 = ((byteAt(this.faceAlpha, var80) & 255) + Math.imul(var3, 8)) | 0;
                                if (var87 < 0) {
                                    var87 = 0;
                                } else if (var87 > 255) {
                                    var87 = 255;
                                }

                                putByte(this.faceAlpha, var80, var87);
                            }
                        }
                    }
                }
            }

            return;
        }

        if (var1 === 7) {
            if (this.labelFaces !== null) {
                for (let var10 = 0; var10 < var9; var10++) {
                    const var11 = arrayAtI32(var2, var10);
                    if (var11 < this.labelFaces.length) {
                        const var12 = requireNonNull(arrayAtObj(this.labelFaces, var11));

                        for (let var13 = 0; var13 < var12.length; var13++) {
                            const var14 = var12[var13];
                            if (this.facePartMask === null || (var7 & arrayAtI16(this.facePartMask, var14)) !== 0) {
                                const var15 = arrayAtI16(this.faceColour, var14) & 65535;
                                let var16 = (var15 >> 10) & 63;
                                let var17 = (var15 >> 7) & 7;
                                let var18 = var15 & 127;
                                var16 = (var16 + var3) & 63;
                                var17 = (var17 + var4) | 0;
                                if (var17 < 0) {
                                    var17 = 0;
                                } else if (var17 > 7) {
                                    var17 = 7;
                                }

                                var18 = (var18 + var5) | 0;
                                if (var18 < 0) {
                                    var18 = 0;
                                } else if (var18 > 127) {
                                    var18 = 127;
                                }

                                arrayPutI16(this.faceColour, var14, (var16 << 10) | (var17 << 7) | var18);
                            }
                        }

                        this.relightPending = true;
                    }
                }
            }
        }
    }

    // fc.a(ZZZ)Lnd; (NXT CopyForAnim)
    // var3 is unused by the software model.
    override CopyForAnimSpot(var1: boolean, var2: boolean, _var3: boolean): ModelLit {
        if (!var1 && requireNonNull(ModelLitImpl.tempSpotFaceAlpha).length < this.numFaces) {
            ModelLitImpl.tempSpotFaceAlpha = new Uint8Array((this.numFaces + 100) | 0);
        }

        if (!var2 && requireNonNull(ModelLitImpl.tempSpotFaceColour).length < this.numFaces) {
            ModelLitImpl.tempSpotFaceColourA = new Int32Array((this.numFaces + 100) | 0);
            ModelLitImpl.tempSpotFaceColourB = new Int32Array((this.numFaces + 100) | 0);
            ModelLitImpl.tempSpotFaceColourC = new Int32Array((this.numFaces + 100) | 0);
            ModelLitImpl.tempSpotFaceColour = new Int16Array((this.numFaces + 100) | 0);
        }

        return this.CopyForAnim(var1, var2, ModelLitImpl.tempSpotModel, ModelLitImpl.tempSpotFaceAlpha, ModelLitImpl.tempSpotFaceColour, ModelLitImpl.tempSpotFaceColourA, ModelLitImpl.tempSpotFaceColourB, ModelLitImpl.tempSpotFaceColourC);
    }

    // fc.g()I (NXT GetRadiusCylinder)
    override GetRadiusCylinder(): number {
        if (!this.boundsCalculated) {
            this.CalcBoundingCylinder();
        }

        return this.radiusCylinder;
    }

    // fc.l()I
    override getMaxZ(): number {
        if (!this.boundsCalculated) {
            this.CalcBoundingCylinder();
        }

        return this.maxZ;
    }

    // fc.i()V
    override endAnimate(): void {
        if (this.relightPending) {
            this.relight();
            this.relightPending = false;
        }

        this.boundsCalculated = false;
    }

    // fc.d()I
    override getMaxX(): number {
        if (!this.boundsCalculated) {
            this.CalcBoundingCylinder();
        }

        return this.maxX;
    }

    // fc.e()I
    override getMinX(): number {
        if (!this.boundsCalculated) {
            this.CalcBoundingCylinder();
        }

        return this.minX;
    }

    // fc.a(I[IIIIZ)V (NXT Animate2)
    // var6 is unused by the software model.
    override Animate2(var1: number, var2: Int32Array | null, var3: number, var4: number, var5: number, _var6: boolean): void {
        const labels = requireNonNull(var2),
            var7 = labels.length;
        const px = this.pointX,
            py = this.pointY,
            pz = this.pointZ;
        const havePoints = px !== null && py !== null && pz !== null;
        const vertexLimit = havePoints ? Math.min(px.length, py.length, pz.length) : 0;
        if (var1 === 0) {
            let var21 = 0;
            ModelLitImpl.originX = 0;
            ModelLitImpl.originY = 0;
            ModelLitImpl.originZ = 0;

            for (let var26 = 0; var26 < var7; var26++) {
                const var31 = labels[var26];
                if (var31 < requireNonNull(this.labelVertices).length) {
                    const var36 = requireNonNull(arrayAtObj(this.labelVertices, var31));

                    for (let var41 = 0; var41 < var36.length; var41++) {
                        const var46 = var36[var41];
                        if (havePoints && var46 >>> 0 < vertexLimit) {
                            ModelLitImpl.originX = (ModelLitImpl.originX + px[var46]) | 0;
                            ModelLitImpl.originY = (ModelLitImpl.originY + py[var46]) | 0;
                            ModelLitImpl.originZ = (ModelLitImpl.originZ + pz[var46]) | 0;
                        } else {
                            ModelLitImpl.originX = (ModelLitImpl.originX + arrayAtI32(this.pointX, var46)) | 0;
                            ModelLitImpl.originY = (ModelLitImpl.originY + arrayAtI32(this.pointY, var46)) | 0;
                            ModelLitImpl.originZ = (ModelLitImpl.originZ + arrayAtI32(this.pointZ, var46)) | 0;
                        }
                        var21++;
                    }
                }
            }

            if (var21 > 0) {
                ModelLitImpl.originX = (((ModelLitImpl.originX / var21) | 0) + var3) | 0;
                ModelLitImpl.originY = (((ModelLitImpl.originY / var21) | 0) + var4) | 0;
                ModelLitImpl.originZ = (((ModelLitImpl.originZ / var21) | 0) + var5) | 0;
                return;
            }

            ModelLitImpl.originX = var3;
            ModelLitImpl.originY = var4;
            ModelLitImpl.originZ = var5;
            return;
        }

        if (var1 === 1) {
            for (let var20 = 0; var20 < var7; var20++) {
                const var25 = labels[var20];
                if (var25 < requireNonNull(this.labelVertices).length) {
                    const var30 = requireNonNull(arrayAtObj(this.labelVertices, var25));

                    for (let var35 = 0; var35 < var30.length; var35++) {
                        const var40 = var30[var35];
                        if (havePoints && var40 >>> 0 < vertexLimit) {
                            px[var40] = (px[var40] + var3) | 0;
                            py[var40] = (py[var40] + var4) | 0;
                            pz[var40] = (pz[var40] + var5) | 0;
                        } else {
                            arrayPutI32(this.pointX, var40, (arrayAtI32(this.pointX, var40) + var3) | 0);
                            arrayPutI32(this.pointY, var40, (arrayAtI32(this.pointY, var40) + var4) | 0);
                            arrayPutI32(this.pointZ, var40, (arrayAtI32(this.pointZ, var40) + var5) | 0);
                        }
                    }
                }
            }

            return;
        }

        if (var1 === 2) {
            for (let var19 = 0; var19 < var7; var19++) {
                const var24 = labels[var19];
                if (var24 < requireNonNull(this.labelVertices).length) {
                    const var29 = requireNonNull(arrayAtObj(this.labelVertices, var24));

                    for (let var34 = 0; var34 < var29.length; var34++) {
                        const var39 = var29[var34];
                        if (!havePoints || var39 >>> 0 >= vertexLimit) {
                            arrayPutI32(this.pointX, var39, (arrayAtI32(this.pointX, var39) - ModelLitImpl.originX) | 0);
                            arrayPutI32(this.pointY, var39, (arrayAtI32(this.pointY, var39) - ModelLitImpl.originY) | 0);
                            arrayPutI32(this.pointZ, var39, (arrayAtI32(this.pointZ, var39) - ModelLitImpl.originZ) | 0);
                            continue; // One of the three Java accesses above throws for this vertex.
                        }
                        px[var39] = (px[var39] - ModelLitImpl.originX) | 0;
                        py[var39] = (py[var39] - ModelLitImpl.originY) | 0;
                        pz[var39] = (pz[var39] - ModelLitImpl.originZ) | 0;
                        if (var5 !== 0) {
                            const var43 = arrayAtI32(Pix3D.sinTable, var5);
                            const var48 = arrayAtI32(Pix3D.cosTable, var5);
                            const var52 = (Math.imul(py[var39], var43) + Math.imul(px[var39], var48) + 32767) >> 16;
                            py[var39] = (Math.imul(py[var39], var48) - Math.imul(px[var39], var43) + 32767) >> 16;
                            px[var39] = var52;
                        }

                        if (var3 !== 0) {
                            const var44 = arrayAtI32(Pix3D.sinTable, var3);
                            const var49 = arrayAtI32(Pix3D.cosTable, var3);
                            const var53 = (Math.imul(py[var39], var49) - Math.imul(pz[var39], var44) + 32767) >> 16;
                            pz[var39] = (Math.imul(py[var39], var44) + Math.imul(pz[var39], var49) + 32767) >> 16;
                            py[var39] = var53;
                        }

                        if (var4 !== 0) {
                            const var45 = arrayAtI32(Pix3D.sinTable, var4);
                            const var50 = arrayAtI32(Pix3D.cosTable, var4);
                            const var54 = (Math.imul(pz[var39], var45) + Math.imul(px[var39], var50) + 32767) >> 16;
                            pz[var39] = (Math.imul(pz[var39], var50) - Math.imul(px[var39], var45) + 32767) >> 16;
                            px[var39] = var54;
                        }

                        px[var39] = (px[var39] + ModelLitImpl.originX) | 0;
                        py[var39] = (py[var39] + ModelLitImpl.originY) | 0;
                        pz[var39] = (pz[var39] + ModelLitImpl.originZ) | 0;
                    }
                }
            }

            return;
        }

        if (var1 === 3) {
            for (let var18 = 0; var18 < var7; var18++) {
                const var23 = labels[var18];
                if (var23 < requireNonNull(this.labelVertices).length) {
                    const var28 = requireNonNull(arrayAtObj(this.labelVertices, var23));

                    for (let var33 = 0; var33 < var28.length; var33++) {
                        const var38 = var28[var33];
                        arrayPutI32(this.pointX, var38, (arrayAtI32(this.pointX, var38) - ModelLitImpl.originX) | 0);
                        arrayPutI32(this.pointY, var38, (arrayAtI32(this.pointY, var38) - ModelLitImpl.originY) | 0);
                        arrayPutI32(this.pointZ, var38, (arrayAtI32(this.pointZ, var38) - ModelLitImpl.originZ) | 0);
                        arrayPutI32(this.pointX, var38, (Math.imul(arrayAtI32(this.pointX, var38), var3) / 128) | 0);
                        arrayPutI32(this.pointY, var38, (Math.imul(arrayAtI32(this.pointY, var38), var4) / 128) | 0);
                        arrayPutI32(this.pointZ, var38, (Math.imul(arrayAtI32(this.pointZ, var38), var5) / 128) | 0);
                        arrayPutI32(this.pointX, var38, (arrayAtI32(this.pointX, var38) + ModelLitImpl.originX) | 0);
                        arrayPutI32(this.pointY, var38, (arrayAtI32(this.pointY, var38) + ModelLitImpl.originY) | 0);
                        arrayPutI32(this.pointZ, var38, (arrayAtI32(this.pointZ, var38) + ModelLitImpl.originZ) | 0);
                    }
                }
            }

            return;
        }

        if (var1 === 5) {
            if (this.labelFaces !== null && this.faceAlpha !== null) {
                for (let var17 = 0; var17 < var7; var17++) {
                    const var22 = labels[var17];
                    if (var22 < this.labelFaces.length) {
                        const var27 = requireNonNull(arrayAtObj(this.labelFaces, var22));

                        for (let var32 = 0; var32 < var27.length; var32++) {
                            const var37 = var27[var32];
                            let var42 = ((byteAt(this.faceAlpha, var37) & 255) + Math.imul(var3, 8)) | 0;
                            if (var42 < 0) {
                                var42 = 0;
                            } else if (var42 > 255) {
                                var42 = 255;
                            }

                            putByte(this.faceAlpha, var37, var42);
                        }
                    }
                }
            }

            return;
        }

        if (var1 === 7) {
            if (this.labelFaces !== null) {
                for (let var8 = 0; var8 < var7; var8++) {
                    const var9 = labels[var8];
                    if (var9 < this.labelFaces.length) {
                        const var10 = requireNonNull(arrayAtObj(this.labelFaces, var9));

                        for (let var11 = 0; var11 < var10.length; var11++) {
                            const var12 = var10[var11];
                            const var13 = arrayAtI16(this.faceColour, var12) & 65535;
                            let var14 = (var13 >> 10) & 63;
                            let var15 = (var13 >> 7) & 7;
                            let var16 = var13 & 127;
                            var14 = (var14 + var3) & 63;
                            var15 = (var15 + var4) | 0;
                            if (var15 < 0) {
                                var15 = 0;
                            } else if (var15 > 7) {
                                var15 = 7;
                            }

                            var16 = (var16 + var5) | 0;
                            if (var16 < 0) {
                                var16 = 0;
                            } else if (var16 > 127) {
                                var16 = 127;
                            }

                            arrayPutI16(this.faceColour, var12, (var14 << 10) | (var15 << 7) | var16);
                        }

                        this.relightPending = true;
                    }
                }
            }
        }
    }

    // fc.f(I)V (NXT SoftwareModelLitRenderer::Render3)
    // Draws face var1 from the projected vertices (or through Render3ZClip when it crosses the near plane).
    private Render3(var1: number): void {
        const nearClipped = ModelLitImpl.faceNearClipped;
        if (nearClipped?.[var1] ?? arrayAtObj(nearClipped, var1)) {
            this.Render3ZClip(var1);
            return;
        }

        const var2 = renderInt(this.faceVertexA, var1);
        const var3 = renderInt(this.faceVertexB, var1);
        const var4 = renderInt(this.faceVertexC, var1);
        const clippedX = ModelLitImpl.faceClippedX;
        Pix3D.hclip = clippedX?.[var1] ?? arrayAtObj(clippedX, var1);
        if (this.faceAlpha === null) {
            Pix3D.trans = 0;
        } else {
            Pix3D.trans = byteAt(this.faceAlpha, var1) & 255;
        }

        if (this.faceMaterial === null || arrayAtI16(this.faceMaterial, var1) === -1) {
            if (renderInt(this.faceColourC, var1) === -1) {
                Pix3D.flatTriangle(
                    renderInt(ModelLitImpl.vertexScreenY, var2),
                    renderInt(ModelLitImpl.vertexScreenY, var3),
                    renderInt(ModelLitImpl.vertexScreenY, var4),
                    renderInt(ModelLitImpl.vertexScreenX, var2),
                    renderInt(ModelLitImpl.vertexScreenX, var3),
                    renderInt(ModelLitImpl.vertexScreenX, var4),
                    renderInt(Pix3D.colourTable, renderInt(this.faceColourA, var1) & 65535)
                );
                return;
            }

            Pix3D.gouraudTriangle(
                renderInt(ModelLitImpl.vertexScreenY, var2),
                renderInt(ModelLitImpl.vertexScreenY, var3),
                renderInt(ModelLitImpl.vertexScreenY, var4),
                renderInt(ModelLitImpl.vertexScreenX, var2),
                renderInt(ModelLitImpl.vertexScreenX, var3),
                renderInt(ModelLitImpl.vertexScreenX, var4),
                renderInt(this.faceColourA, var1) & 65535,
                renderInt(this.faceColourB, var1) & 65535,
                renderInt(this.faceColourC, var1) & 65535
            );
            return;
        }

        let var5: number;
        let var6: number;
        let var7: number;
        if (this.faceTextureAxis !== null && sbyteAt(this.faceTextureAxis, var1) !== -1) {
            const var8 = byteAt(this.faceTextureAxis, var1) & 255;
            var5 = renderInt(this.faceTextureP, var8);
            var6 = renderInt(this.faceTextureM, var8);
            var7 = renderInt(this.faceTextureN, var8);
        } else {
            var5 = var2;
            var6 = var3;
            var7 = var4;
        }

        if (renderInt(this.faceColourC, var1) === -1) {
            Pix3D.textureTriangle(
                renderInt(ModelLitImpl.vertexScreenY, var2),
                renderInt(ModelLitImpl.vertexScreenY, var3),
                renderInt(ModelLitImpl.vertexScreenY, var4),
                renderInt(ModelLitImpl.vertexScreenX, var2),
                renderInt(ModelLitImpl.vertexScreenX, var3),
                renderInt(ModelLitImpl.vertexScreenX, var4),
                renderInt(this.faceColourA, var1),
                renderInt(this.faceColourA, var1),
                renderInt(this.faceColourA, var1),
                renderInt(ModelLitImpl.vertexViewSpaceX, var5),
                renderInt(ModelLitImpl.vertexViewSpaceX, var6),
                renderInt(ModelLitImpl.vertexViewSpaceX, var7),
                renderInt(ModelLitImpl.vertexViewSpaceY, var5),
                renderInt(ModelLitImpl.vertexViewSpaceY, var6),
                renderInt(ModelLitImpl.vertexViewSpaceY, var7),
                renderInt(ModelLitImpl.vertexViewSpaceZ, var5),
                renderInt(ModelLitImpl.vertexViewSpaceZ, var6),
                renderInt(ModelLitImpl.vertexViewSpaceZ, var7),
                arrayAtI16(this.faceMaterial, var1)
            );
            return;
        }

        Pix3D.textureTriangle(
            renderInt(ModelLitImpl.vertexScreenY, var2),
            renderInt(ModelLitImpl.vertexScreenY, var3),
            renderInt(ModelLitImpl.vertexScreenY, var4),
            renderInt(ModelLitImpl.vertexScreenX, var2),
            renderInt(ModelLitImpl.vertexScreenX, var3),
            renderInt(ModelLitImpl.vertexScreenX, var4),
            renderInt(this.faceColourA, var1),
            renderInt(this.faceColourB, var1),
            renderInt(this.faceColourC, var1),
            renderInt(ModelLitImpl.vertexViewSpaceX, var5),
            renderInt(ModelLitImpl.vertexViewSpaceX, var6),
            renderInt(ModelLitImpl.vertexViewSpaceX, var7),
            renderInt(ModelLitImpl.vertexViewSpaceY, var5),
            renderInt(ModelLitImpl.vertexViewSpaceY, var6),
            renderInt(ModelLitImpl.vertexViewSpaceY, var7),
            renderInt(ModelLitImpl.vertexViewSpaceZ, var5),
            renderInt(ModelLitImpl.vertexViewSpaceZ, var6),
            renderInt(ModelLitImpl.vertexViewSpaceZ, var7),
            arrayAtI16(this.faceMaterial, var1)
        );
    }

    // fc.a(II)I. NXT ModelUnlit::GetColour (ModelUnlit.cpp:4835).
    // The HSL colour var0 with its lightness scaled by var1 / 128, clamped to [2, 126].
    static GetColour(var0: number, var1: number): number {
        var1 = Math.imul(var1, var0 & 127) >> 7;
        if (var1 < 2) {
            var1 = 2;
        } else if (var1 > 126) {
            var1 = 126;
        }

        return ((var0 & 65408) + var1) | 0;
    }

    // fc.a(IIIIIIIIJILue;)V (overrides ug.a(IIIIIIIIJILue;)V; NXT SoftwareModelLitRenderer::WorldRender)
    // var1 = the model yaw, var2/var3 = sin/cos of the camera pitch, var4/var5 = sin/cos of the camera yaw,
    // (var6, var7, var8) = the model position relative to the camera, var9 = the pick typecode, var11 unused,
    // var12 = the particle system (unused in SD). Culls against the view frustum, picks, projects and sorts.
    override draw(var1: number, var2: number, var3: number, var4: number, var5: number, var6: number, var7: number, var8: number, var9: bigint, _var11: number, var12: ParticleSystem | null): void {
        if (!this.boundsCalculated) {
            this.CalcBoundingCylinder();
        }

        const var15 = (Math.imul(var8, var5) - Math.imul(var6, var4)) >> 16;
        const var16 = (Math.imul(var7, var2) + Math.imul(var15, var3)) >> 16;
        const var13 = (var16 + ((Math.imul(this.radiusCylinder, var3) + Math.imul(this.maxY, var2)) >> 16)) | 0;
        const var14 = (var16 + ((Math.imul(-this.radiusCylinder, var3) + Math.imul(this.minY, var2)) >> 16)) | 0;
        if (var13 <= 50) {
            return;
        }

        if (var14 >= 3500) {
            return;
        }

        // var13 > 50 from here, so every division by it is safe.
        const var17 = (Math.imul(var8, var4) + Math.imul(var6, var5)) >> 16;
        const var18 = (var17 + this.radiusCylinder) << 9;
        if (((var18 / var13) | 0) <= Pix3D.clipMinX) {
            return;
        }

        const var19 = (var17 - this.radiusCylinder) << 9;
        if (((var19 / var13) | 0) >= Pix3D.clipMaxX) {
            return;
        }

        const var20 = (Math.imul(var7, var3) - Math.imul(var15, var2)) >> 16;
        const var21 = (var20 + ((Math.imul(this.radiusCylinder, var2) + Math.imul(this.maxY, var3)) >> 16)) << 9;
        if (((var21 / var13) | 0) <= Pix3D.clipMinY) {
            return;
        }

        const var22 = (var20 + ((Math.imul(-this.radiusCylinder, var2) + Math.imul(this.minY, var3)) >> 16)) << 9;
        if (((var22 / var13) | 0) >= Pix3D.clipMaxY) {
            return;
        }

        let var23 = false;
        const var24 = var14 <= 50;
        const var25 = var24 || this.numT > 0;
        const var26 = Pix3D.originX;
        const var27 = Pix3D.originY;
        let var28 = 0;
        let var29 = 0;
        if (var1 !== 0) {
            var28 = renderInt(Pix3D.sinTable, var1);
            var29 = renderInt(Pix3D.cosTable, var1);
        }

        let var30 = false;
        if (var9 > 0n && ModelLit.checkHover && var14 > 0) {
            // var14 > 0 here as well.
            let var31: number;
            let var33: number;
            if (var17 > 0) {
                var31 = (var19 / var13) | 0;
                var33 = (var18 / var14) | 0;
            } else {
                var31 = (var19 / var14) | 0;
                var33 = (var18 / var13) | 0;
            }

            let var32: number;
            let var34: number;
            if (var20 > 0) {
                var32 = (var22 / var13) | 0;
                var34 = (var21 / var14) | 0;
            } else {
                var32 = (var22 / var14) | 0;
                var34 = (var21 / var13) | 0;
            }

            if (ModelLitImpl.mouseX >= var31 && ModelLitImpl.mouseX <= var33 && ModelLit.mouseY >= var32 && ModelLit.mouseY <= var34) {
                var31 = 999999;
                var33 = -999999;
                var32 = 999999;
                var34 = -999999;
                const var35 = Int32Array.of(this.minX, this.maxX, this.minX, this.maxX, this.minX, this.maxX, this.minX, this.maxX);
                const var36 = Int32Array.of(this.minZ, this.minZ, this.maxZ, this.maxZ, this.minZ, this.minZ, this.maxZ, this.maxZ);
                const var37 = Int32Array.of(this.minY, this.minY, this.minY, this.minY, this.maxY, this.maxY, this.maxY, this.maxY);

                for (let var38 = 0; var38 < 8; var38++) {
                    let var39 = var35[var38];
                    let var40 = var37[var38];
                    let var41 = var36[var38];
                    let var42: number;
                    if (var1 !== 0) {
                        var42 = (Math.imul(var41, var28) + Math.imul(var39, var29)) >> 16;
                        var41 = (Math.imul(var41, var29) - Math.imul(var39, var28)) >> 16;
                        var39 = var42;
                    }

                    var39 = (var39 + var6) | 0;
                    var40 = (var40 + var7) | 0;
                    var41 = (var41 + var8) | 0;
                    var42 = (Math.imul(var41, var4) + Math.imul(var39, var5)) >> 16;
                    var41 = (Math.imul(var41, var5) - Math.imul(var39, var4)) >> 16;
                    var39 = var42;
                    var42 = (Math.imul(var40, var3) - Math.imul(var41, var2)) >> 16;
                    var41 = (Math.imul(var40, var2) + Math.imul(var41, var3)) >> 16;
                    var40 = var42;
                    if (var41 > 0) {
                        const var43 = ((var39 << 9) / var41) | 0;
                        const var44 = ((var40 << 9) / var41) | 0;
                        if (var43 < var31) {
                            var31 = var43;
                        }

                        if (var43 > var33) {
                            var33 = var43;
                        }

                        if (var44 < var32) {
                            var32 = var44;
                        }

                        if (var44 > var34) {
                            var34 = var44;
                        }
                    }
                }

                if (ModelLitImpl.mouseX >= var31 && ModelLitImpl.mouseX <= var33 && ModelLit.mouseY >= var32 && ModelLit.mouseY <= var34) {
                    if (this.useAABBMouseCheck) {
                        // pf.W[dd.r++] = var9: the count increments before the store can throw.
                        const picked = ModelLit.pickedCount;
                        ModelLit.pickedCount = (picked + 1) | 0;
                        arrayPutB64(ModelLit.pickedTypecodes, picked, var9);
                    } else {
                        var30 = true;
                    }
                }
            }
        }

        // Locals named after the bytecode slots: fc.java labels both projected coordinates with the x.
        const pointX = this.pointX,
            pointY = this.pointY,
            pointZ = this.pointZ;
        const screenX = ModelLitImpl.vertexScreenX,
            screenY = ModelLitImpl.vertexScreenY,
            screenZ = ModelLitImpl.vertexScreenZ;
        const viewX = ModelLitImpl.vertexViewSpaceX,
            viewY = ModelLitImpl.vertexViewSpaceY,
            viewZ = ModelLitImpl.vertexViewSpaceZ;
        const points = this.numPoints;
        const sourceReady = pointX !== null && pointY !== null && pointZ !== null && pointX.length >= points && pointY.length >= points && pointZ.length >= points;
        const screenReady = screenX !== null && screenY !== null && screenZ !== null && screenX.length >= points && screenY.length >= points && screenZ.length >= points;
        const viewReady = viewX !== null && viewY !== null && viewZ !== null && viewX.length >= points && viewY.length >= points && viewZ.length >= points;
        // No callbacks occur between these vertex loads/stores. Short or absent arrays still
        // take their individual JVM checks, preserving every preceding store on a fault.
        for (let var31 = 0; var31 < this.numPoints; var31++) {
            let var32 = sourceReady ? pointX[var31] : renderInt(pointX, var31);
            let var33 = sourceReady ? pointY[var31] : renderInt(pointY, var31);
            let var34 = sourceReady ? pointZ[var31] : renderInt(pointZ, var31);
            let var35: number;
            if (var1 !== 0) {
                var35 = (Math.imul(var34, var28) + Math.imul(var32, var29)) >> 16;
                var34 = (Math.imul(var34, var29) - Math.imul(var32, var28)) >> 16;
                var32 = var35;
            }

            var32 = (var32 + var6) | 0;
            var33 = (var33 + var7) | 0;
            var34 = (var34 + var8) | 0;
            var35 = (Math.imul(var34, var4) + Math.imul(var32, var5)) >> 16;
            var34 = (Math.imul(var34, var5) - Math.imul(var32, var4)) >> 16;
            var32 = var35;
            var35 = (Math.imul(var33, var3) - Math.imul(var34, var2)) >> 16;
            var34 = (Math.imul(var33, var2) + Math.imul(var34, var3)) >> 16;
            var33 = var35;
            if (screenReady) {
                screenZ[var31] = (var34 - var16) | 0;
                if (var34 >= 50) {
                    screenX[var31] = (var26 + (((var32 << 9) / var34) | 0)) | 0;
                    screenY[var31] = (var27 + (((var33 << 9) / var34) | 0)) | 0;
                } else {
                    screenX[var31] = -5000;
                    var23 = true;
                }
            } else {
                arrayPutI32(screenZ, var31, (var34 - var16) | 0);
                if (var34 >= 50) {
                    arrayPutI32(screenX, var31, (var26 + (((var32 << 9) / var34) | 0)) | 0);
                    arrayPutI32(screenY, var31, (var27 + (((var33 << 9) / var34) | 0)) | 0);
                } else {
                    arrayPutI32(screenX, var31, -5000);
                    var23 = true;
                }
            }

            if (var25) {
                if (viewReady) {
                    viewX[var31] = var32;
                    viewY[var31] = var33;
                    viewZ[var31] = var34;
                } else {
                    arrayPutI32(viewX, var31, var32);
                    arrayPutI32(viewY, var31, var33);
                    arrayPutI32(viewZ, var31, var34);
                }
            }
        }

        try {
            this.Render2(var23, var30, var9, (var16 - var14) | 0, (var13 - var14 + 2) | 0, var12);
        } catch (e) {
            // catch (Exception)
            if (!isJavaException(e)) throw e;
        }
    }

    // fc.h()V
    override Rotate90(): void {
        for (let var1 = 0; var1 < this.numPoints; var1++) {
            const var2 = arrayAtI32(this.pointX, var1);
            arrayPutI32(this.pointX, var1, arrayAtI32(this.pointZ, var1));
            arrayPutI32(this.pointZ, var1, -var2 | 0);
        }

        this.boundsCalculated = false;
    }

    // fc.b(I)V
    override RotateXAxis(var1: number): void {
        const var2 = arrayAtI32(Pix3D.sinTable, var1);
        const var3 = arrayAtI32(Pix3D.cosTable, var1);

        for (let var4 = 0; var4 < this.numPoints; var4++) {
            const var5 = (Math.imul(arrayAtI32(this.pointY, var4), var3) - Math.imul(arrayAtI32(this.pointZ, var4), var2)) >> 16;
            arrayPutI32(this.pointZ, var4, (Math.imul(arrayAtI32(this.pointY, var4), var2) + Math.imul(arrayAtI32(this.pointZ, var4), var3)) >> 16);
            arrayPutI32(this.pointY, var4, var5);
        }

        this.boundsCalculated = false;
    }

    // fc.a(IIIIIIIJ)V (NXT SoftwareModelLitRenderer::ObjRender)
    override ObjRender(var1: number, var2: number, var3: number, var4: number, var5: number, var6: number, var7: number, var8: bigint): void {
        try {
            if (!this.boundsCalculated) {
                this.CalcBoundingCylinder();
            }

            const var10 = Pix3D.originX;
            const var11 = Pix3D.originY;
            const var12 = arrayAtI32(Pix3D.sinTable, var1);
            const var13 = arrayAtI32(Pix3D.cosTable, var1);
            const var14 = arrayAtI32(Pix3D.sinTable, var2);
            const var15 = arrayAtI32(Pix3D.cosTable, var2);
            const var16 = arrayAtI32(Pix3D.sinTable, var3);
            const var17 = arrayAtI32(Pix3D.cosTable, var3);
            const var18 = arrayAtI32(Pix3D.sinTable, var4);
            const var19 = arrayAtI32(Pix3D.cosTable, var4);
            const var20 = (Math.imul(var6, var18) + Math.imul(var7, var19)) >> 16;

            for (let var21 = 0; var21 < this.numPoints; var21++) {
                let var22 = arrayAtI32(this.pointX, var21);
                let var23 = arrayAtI32(this.pointY, var21);
                let var24 = arrayAtI32(this.pointZ, var21);
                if (var3 !== 0) {
                    const var25 = (Math.imul(var23, var16) + Math.imul(var22, var17)) >> 16;
                    var23 = (Math.imul(var23, var17) - Math.imul(var22, var16)) >> 16;
                    var22 = var25;
                }

                if (var1 !== 0) {
                    const var31 = (Math.imul(var23, var13) - Math.imul(var24, var12)) >> 16;
                    var24 = (Math.imul(var23, var12) + Math.imul(var24, var13)) >> 16;
                    var23 = var31;
                }

                if (var2 !== 0) {
                    const var32 = (Math.imul(var24, var14) + Math.imul(var22, var15)) >> 16;
                    var24 = (Math.imul(var24, var15) - Math.imul(var22, var14)) >> 16;
                    var22 = var32;
                }

                var22 = (var22 + var5) | 0;
                var23 = (var23 + var6) | 0;
                var24 = (var24 + var7) | 0;
                const var33 = (Math.imul(var23, var19) - Math.imul(var24, var18)) >> 16;
                var24 = (Math.imul(var23, var18) + Math.imul(var24, var19)) >> 16;
                arrayPutI32(ModelLitImpl.vertexScreenZ, var21, (var24 - var20) | 0);
                arrayPutI32(ModelLitImpl.vertexScreenX, var21, (var10 + intDivide(var22 << 9, var24)) | 0);
                arrayPutI32(ModelLitImpl.vertexScreenY, var21, (var11 + intDivide(var33 << 9, var24)) | 0);
                if (this.numT > 0) {
                    arrayPutI32(ModelLitImpl.vertexViewSpaceX, var21, var22);
                    arrayPutI32(ModelLitImpl.vertexViewSpaceY, var21, var33);
                    arrayPutI32(ModelLitImpl.vertexViewSpaceZ, var21, var24);
                }
            }

            this.Render2(false, var8 >= 0n, var8, this.radiusSphere, this.radiusSphere << 1, null);
        } catch (e) {
            // catch (RuntimeException)
            if (!isJavaException(e)) throw e;
        }
    }

    // fc.o()V
    // Recomputes the lit colours of the untextured faces from faceColour (after a type-7 HSL transform), keeping
    // each colour's light level (bits 17 and up).
    private relight(): void {
        for (let var4 = 0; var4 < this.numFaces; var4++) {
            const var3 = this.faceMaterial !== null ? arrayAtI16(this.faceMaterial, var4) : -1;
            if (var3 === -1) {
                const var1 = arrayAtI16(this.faceColour, var4) & 65535;
                if (arrayAtI32(this.faceColourC, var4) === -1) {
                    const var2 = arrayAtI32(this.faceColourA, var4) & -131072;
                    arrayPutI32(this.faceColourA, var4, var2 | ModelLitImpl.GetColour(var1, var2 >> 17));
                } else if (arrayAtI32(this.faceColourC, var4) !== -2) {
                    let var5 = arrayAtI32(this.faceColourA, var4) & -131072;
                    arrayPutI32(this.faceColourA, var4, var5 | ModelLitImpl.GetColour(var1, var5 >> 17));
                    var5 = arrayAtI32(this.faceColourB, var4) & -131072;
                    arrayPutI32(this.faceColourB, var4, var5 | ModelLitImpl.GetColour(var1, var5 >> 17));
                    var5 = arrayAtI32(this.faceColourC, var4) & -131072;
                    arrayPutI32(this.faceColourC, var4, var5 | ModelLitImpl.GetColour(var1, var5 >> 17));
                }
            }
        }
    }

    // a.a(I[III[I)V
    // Quicksort of keys var1[var3..var2] descending (ties broken by index parity), permuting var4 alongside. Only
    // Render2's quicksort path (useQuickSort: constant false in SD, set by HD allocateGlScratch) calls it. Stripped: the dummy first argument (every
    // caller passes 1, the recursion passes it through) with its return guard, the a.a invocation counter, the od.a
    // wrapper, and the client.wb arm that enters the partition loop without testing it first.
    // HD nj.a(IIZ[I[I)V, called with false.
    static quicksort(var1: Int32Array | null, var2: number, var3: number, var4: Int32Array | null): void {
        try {
            if (var2 > var3) {
                // (var3 - -var2) / 2
                const var5 = (((var3 + var2) | 0) / 2) | 0;
                let var6 = var3;
                const var7 = arrayAtI32(var1, var5);
                arrayPutI32(var1, var5, arrayAtI32(var1, var2));
                arrayPutI32(var1, var2, var7);
                const var8 = arrayAtI32(var4, var5);
                arrayPutI32(var4, var5, arrayAtI32(var4, var2));
                arrayPutI32(var4, var2, var8);

                for (let var9 = var3; var9 < var2; var9++) {
                    if (arrayAtI32(var1, var9) > (((var9 & 1) + var7) | 0)) {
                        const var10 = arrayAtI32(var1, var9);
                        arrayPutI32(var1, var9, arrayAtI32(var1, var6));
                        arrayPutI32(var1, var6, var10);
                        const var11 = arrayAtI32(var4, var9);
                        arrayPutI32(var4, var9, arrayAtI32(var4, var6));
                        arrayPutI32(var4, var6++, var11);
                    }
                }

                arrayPutI32(var1, var2, arrayAtI32(var1, var6));
                arrayPutI32(var1, var6, var7);
                arrayPutI32(var4, var2, arrayAtI32(var4, var6));
                arrayPutI32(var4, var6, var8);
                ModelLitImpl.quicksort(var1, (var6 - 1) | 0, var3, var4);
                ModelLitImpl.quicksort(var1, var2, (var6 + 1) | 0, var4);
            }
        } catch (error) {
            if (!glJar || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'nj.C(' + var3 + ',' + var2 + ',false,' + (var1 === null ? 'null' : '{...}') + ',' + (var4 === null ? 'null' : '{...}') + ')');
        }
    }
}
