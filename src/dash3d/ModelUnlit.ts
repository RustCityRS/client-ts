import type Js5 from '#/cache/Js5';
import { glJar } from '#/client/ClientVariant';
import PacketT from '#/io/PacketT';
import { byteAt, putByte } from '#/io/JavaByteArray';
import ArrayUtils from '#/util/ArrayUtils';
import { intDivide } from '#/util/IntUtils';
import { arrayAtI16, arrayAtI32, arrayAtObj, arrayPutI16, arrayPutI32, arrayPutObj, requireNonNull } from '#/util/JavaArray';
import FaceNormal from './FaceNormal';
import type ModelLit from './ModelLit';
import ModelLitImpl from './ModelLitImpl';
import ModelSource from './ModelSource';
import type ParticleSystem from './ParticleSystem';
import Pix3D from './Pix3D';
import PointNormal from './PointNormal';
import { loadGlModel, loadGlRenderer } from '#/util/GamepackClasses';

// Java baload sign-extends. The byte[] fields are Uint8Array here, so a signed read goes through this.
function sbyteAt(bytes: Uint8Array | null, index: number): number {
    return (byteAt(bytes, index) << 24) >> 24;
}

// An int[][] element load (aaload, then iaload), each throwing where the JVM would.
function at2(array: (Int32Array | null)[] | null, i: number, j: number): number {
    return arrayAtI32(arrayAtObj(array, i), j);
}

type ModelUnlitArgs = [] | [Uint8Array | null] | [(ModelUnlit | null)[] | null, number] | [number, number, number] | [ModelUnlit | null, boolean, boolean, boolean, boolean];

type MergePointIndex = { heads: Int32Array; next: Int32Array };

// cb in the revision 530 SD gamepack (NXT jag::oldscape::dash3d::ModelUnlit, split there into ModelUnlit and the
// software ModelUnlitImpl; 530 has one class). It is the decoded, unlit form of a cache model: vertex, face and
// texture-axis arrays, the two model-format decoders, the merge/copy constructors, the geometry transforms,
// recolour/retexture, ground conformance (HillSkewCopy), normal calculation and normal sharing between neighbouring
// scene models. Light/LightImpl turn it into a lit ModelLitImpl (fc). The scene can also hold it unlit: as a
// ModelSource it reports isUnlit() = true and light() lights it with the ambient/contrast stored by LocType.
//
// The obfuscator left this class clean: no invocation counters, dummy parameters, od.a wrappers or client.wb
// predicates. Member names: NXT spelling where nxtnames.json has a member hint for the same routine, otherwise rev 225
// Model names (pointX, faceVertexA, faceTextureP, labelVertices, ...) or camelCase descriptions. Overrides of
// ModelSource keep the base names (light = NXT LightWithPrepared, mergeNormals = NXT ShareLight), and NXT overloads
// that TS cannot express get a suffix (AddPointFromModel, LightImpl).
//
// The decompiler merged the section-offset locals of both decoders (LoadOb2Engine200 and LoadOb3Engine200) into one
// variable, so every section read from the same offset in cb.java. Those two methods and HillSkewCopy follow the
// bytecode and name their locals after the bytecode slots.
//
// Int arithmetic is Java's: Math.imul for *, | 0 after + and -, (a / b) | 0 for constant divisors and intDivide where
// the divisor can be 0. Every field array access goes through arrayAt/arrayPut/byteAt/putByte, so a null array or a
// bad index throws at Java's load or store. Short fields hold the (short) value and byte fields the (byte) value.
//
// Not here, by the member map: nothing. All five cb statics and the three static methods are ModelUnlit's own.
export default class ModelUnlit extends ModelSource {
    // Static fields in cb.<clinit> store order.

    // cb.G:[I
    // The tic of the last mergeNormals that found a shared vertex, per vertex of this model.
    private static shareMap: Int32Array | null = new Int32Array(10000);
    // cb.V:I
    private static shareTic: number = 0;
    // cb.Y:[I
    // The same for the other model's vertices.
    private static shareMap2: Int32Array | null = new Int32Array(10000);
    // cb.D:[I
    // Aliases Pix3D.cosTable (dc.g) as it was when cb was initialised.
    private static cos: Int32Array | null = Pix3D.cosTable;
    // cb.cb:[I
    // Aliases Pix3D.sinTable (dc.l).
    private static sin: Int32Array | null = Pix3D.sinTable;

    // Instance fields in cb's declaration order. y, s, Q and fb are the four that every cb.<init> stores explicitly
    // (in that order) before its body; the rest keep the JVM defaults until a constructor or decoder fills them.

    // cb.j:[S
    // Per vertex, the OR of (1 << source index) of the merged models that share it (merge constructor only).
    pointPartMask: Int16Array | null = null;
    // cb.k:S
    private maxX: number = 0;
    // cb.l:[I
    pointY: Int32Array | null = null;
    // cb.m:[I
    pointX: Int32Array | null = null;
    // cb.n:[B
    textureRotation: Uint8Array | null = null;
    // cb.o:[I
    // Per vertex, the label (vertex group) number. PrepareAnim turns it into labelVertices and nulls it.
    vertexLabel: Int32Array | null = null;
    // cb.p:[S
    faceColour: Int16Array | null = null;
    // cb.q:S
    // The contrast LocType stores for light() (NXT ModelUnlit field_18, read by LightWithPrepared).
    contrast: number = 0;
    // cb.r:[S
    faceTextureP: Int16Array | null = null;
    // cb.s:I
    numPoints: number;
    // cb.t:S
    // The ambient LocType stores for light() (NXT ModelUnlit field_16).
    ambient: number = 0;
    // cb.u:[Lha;
    // Per face, the normal of a flat-shaded face (render type 1); null for the others.
    faceNormal: (FaceNormal | null)[] | null = null;
    // cb.v:[B
    faceAlpha: Uint8Array | null = null;
    // cb.w:S
    private maxZ: number = 0;
    // cb.x:[S
    // Per face, (1 << source index) of the merged model it came from (merge constructor only).
    facePartMask: Int16Array | null = null;
    // cb.y:I
    numFaces: number;
    // cb.z:S
    private minZ: number = 0;
    // cb.A:[S
    textureScaleZ: Int16Array | null = null;
    // cb.B:[S
    faceTextureN: Int16Array | null = null;
    // cb.C:[I
    faceVertexA: Int32Array | null = null;
    // cb.E:[B
    // Per texture axis, the mapping type (0 = PMN triangle, 1..3 = the scaled types with the extra arrays).
    textureType: Uint8Array | null = null;
    // cb.F:[S
    faceTextureM: Int16Array | null = null;
    // cb.H:[S
    // Per face, the material (texture) id, -1 for an untextured face.
    faceMaterial: Int16Array | null = null;
    // cb.I:[I
    faceVertexC: Int32Array | null = null;
    // cb.J:[Lfa;
    pointNormal: (PointNormal | null)[] | null = null;
    // cb.K:[I
    // Per face, the label (face group) number. PrepareAnim turns it into labelFaces and nulls it.
    faceLabel: Int32Array | null = null;
    // cb.L:[B
    // Per face, the texture axis index into faceTextureP/M/N (-1 = use the face's own vertices).
    faceTextureAxis: Uint8Array | null = null;
    // cb.M:[[I
    labelVertices: (Int32Array | null)[] | null = null;
    // cb.N:[I
    faceVertexB: Int32Array | null = null;
    // cb.O:S
    private minX: number = 0;
    // cb.P:[B
    textureTransV: Uint8Array | null = null;
    // cb.Q:Z
    // Set by CalcBoundingCube, cleared by GeometryChanged.
    private boundsCalculated: boolean;
    // cb.R:I
    numT: number = 0;
    // cb.S:[S
    textureScaleY: Int16Array | null = null;
    // cb.T:[I
    pointZ: Int32Array | null = null;
    // cb.U:[B
    // Per face, 0 = smooth, 1 = flat, 2 = shared-normal (set by mergeNormals); null means all 0.
    faceRenderType: Uint8Array | null = null;
    // cb.W:S
    private maxY: number = 0;
    // cb.X:S
    private minY: number = 0;
    // cb.Z:[B
    textureTransU: Uint8Array | null = null;
    // cb.ab:[B
    textureSpeed: Uint8Array | null = null;
    // cb.bb:[B
    textureDirection: Uint8Array | null = null;
    // cb.db:[B
    facePriority: Uint8Array | null = null;
    // cb.eb:[S
    textureScaleX: Int16Array | null = null;
    // cb.fb:B
    // The model-wide face priority when facePriority is null.
    priority: number;
    // cb.gb:[[I
    labelFaces: (Int32Array | null)[] | null = null;
    // cb.hb:[Lfa;
    // Per vertex, the normal summed with a neighbouring model's coincident vertex by mergeNormals (null = unshared).
    sharedPointNormal: (PointNormal | null)[] | null = null;

    // cb.<init>()V (private in Java; used by HillSkewCopy and CopyForShareLight)
    constructor();
    // cb.<init>([B)V (private in Java; used by Load)
    constructor(var1: Uint8Array | null);
    // cb.<init>([Lcb;I)V (NXT ModelUnlit::Combine)
    constructor(var1: (ModelUnlit | null)[] | null, var2: number);
    // cb.<init>(III)V
    constructor(var1: number, var2: number, var3: number);
    // cb.<init>(Lcb;ZZZZ)V (NXT ModelUnlit::Copy)
    constructor(var1: ModelUnlit | null, var2: boolean, var3: boolean, var4: boolean, var5: boolean);
    constructor(...args: ModelUnlitArgs) {
        super();
        // The field initializers that every cb.<init> runs after ug.<init>.
        this.numFaces = 0;
        this.numPoints = 0;
        this.boundsCalculated = false;
        this.priority = 0;

        if (args.length === 0) {
            // cb.<init>()V
            return;
        }

        if (args.length === 1) {
            // cb.<init>([B)V
            const var1 = args[0];
            if (sbyteAt(var1, (requireNonNull(var1).length - 1) | 0) === -1 && sbyteAt(var1, (requireNonNull(var1).length - 2) | 0) === -1) {
                this.LoadOb3Engine200(var1);
            } else {
                this.LoadOb2Engine200(var1);
            }
            return;
        }

        if (args.length === 3) {
            // cb.<init>(III)V
            const [var1, var2, var3] = args;
            this.pointX = new Int32Array(var1);
            this.pointY = new Int32Array(var1);
            this.pointZ = new Int32Array(var1);
            this.vertexLabel = new Int32Array(var1);
            this.faceVertexA = new Int32Array(var2);
            this.faceVertexB = new Int32Array(var2);
            this.faceVertexC = new Int32Array(var2);
            this.faceRenderType = new Uint8Array(var2);
            this.facePriority = new Uint8Array(var2);
            this.faceAlpha = new Uint8Array(var2);
            this.faceColour = new Int16Array(var2);
            this.faceMaterial = new Int16Array(var2);
            this.faceTextureAxis = new Uint8Array(var2);
            this.faceLabel = new Int32Array(var2);
            if (var3 > 0) {
                this.textureType = new Uint8Array(var3);
                this.faceTextureP = new Int16Array(var3);
                this.faceTextureM = new Int16Array(var3);
                this.faceTextureN = new Int16Array(var3);
                this.textureScaleX = new Int16Array(var3);
                this.textureScaleY = new Int16Array(var3);
                this.textureScaleZ = new Int16Array(var3);
                this.textureRotation = new Uint8Array(var3);
                this.textureDirection = new Uint8Array(var3);
                this.textureSpeed = new Uint8Array(var3);
                this.textureTransU = new Uint8Array(var3);
                this.textureTransV = new Uint8Array(var3);
            }
            return;
        }

        if (args.length === 2) {
            // cb.<init>([Lcb;I)V
            const [var1, var2] = args;
            let var3 = false;
            let var4 = false;
            let var5 = false;
            let var6 = false;
            let var7 = false;
            let var8 = false;
            this.numPoints = 0;
            this.numFaces = 0;
            this.numT = 0;

            this.priority = -1;

            for (let var11 = 0; var11 < var2; var11++) {
                const var12 = arrayAtObj(var1, var11);
                if (var12 !== null) {
                    this.numPoints = (this.numPoints + var12.numPoints) | 0;
                    this.numFaces = (this.numFaces + var12.numFaces) | 0;
                    this.numT = (this.numT + var12.numT) | 0;
                    if (var12.facePriority !== null) {
                        var4 = true;
                    } else {
                        if (this.priority === -1) {
                            this.priority = var12.priority;
                        }

                        if (this.priority !== var12.priority) {
                            var4 = true;
                        }
                    }

                    // Java's non-short-circuit |= only reads a field of the non-null var12, so || is equivalent.
                    var3 = var3 || var12.faceRenderType !== null;
                    var5 = var5 || var12.faceAlpha !== null;
                    var6 = var6 || var12.faceLabel !== null;
                    var7 = var7 || var12.faceMaterial !== null;
                    var8 = var8 || var12.faceTextureAxis !== null;
                }
            }

            this.pointX = new Int32Array(this.numPoints);
            this.pointY = new Int32Array(this.numPoints);
            this.pointZ = new Int32Array(this.numPoints);
            this.vertexLabel = new Int32Array(this.numPoints);
            this.pointPartMask = new Int16Array(this.numPoints);
            this.faceVertexA = new Int32Array(this.numFaces);
            this.faceVertexB = new Int32Array(this.numFaces);
            this.faceVertexC = new Int32Array(this.numFaces);
            if (var3) {
                this.faceRenderType = new Uint8Array(this.numFaces);
            }

            if (var4) {
                this.facePriority = new Uint8Array(this.numFaces);
            }

            if (var5) {
                this.faceAlpha = new Uint8Array(this.numFaces);
            }

            if (var6) {
                this.faceLabel = new Int32Array(this.numFaces);
            }

            if (var7) {
                this.faceMaterial = new Int16Array(this.numFaces);
            }

            if (var8) {
                this.faceTextureAxis = new Uint8Array(this.numFaces);
            }

            this.faceColour = new Int16Array(this.numFaces);
            this.facePartMask = new Int16Array(this.numFaces);
            if (this.numT > 0) {
                this.textureType = new Uint8Array(this.numT);
                this.faceTextureP = new Int16Array(this.numT);
                this.faceTextureM = new Int16Array(this.numT);
                this.faceTextureN = new Int16Array(this.numT);
                this.textureScaleX = new Int16Array(this.numT);
                this.textureScaleY = new Int16Array(this.numT);
                this.textureScaleZ = new Int16Array(this.numT);
                this.textureRotation = new Uint8Array(this.numT);
                this.textureDirection = new Uint8Array(this.numT);
                this.textureSpeed = new Uint8Array(this.numT);
                this.textureTransU = new Uint8Array(this.numT);
                this.textureTransV = new Uint8Array(this.numT);
            }

            // The destination starts empty and owns all three coordinate arrays until the
            // merge returns. Index only successfully inserted points during this constructor.
            const points: MergePointIndex | undefined = this.numPoints >= 32 ? { heads: new Int32Array(1 << Math.min(16, 32 - Math.clz32(this.numPoints - 1))), next: new Int32Array(this.numPoints) } : undefined;
            this.numPoints = 0;
            this.numFaces = 0;
            this.numT = 0;

            for (let var20 = 0; var20 < var2; var20++) {
                const var13 = ((1 << var20) << 16) >> 16;
                const var14 = arrayAtObj(var1, var20);
                if (var14 !== null) {
                    for (let var15 = 0; var15 < var14.numFaces; var15++) {
                        if (var3 && var14.faceRenderType !== null) {
                            putByte(this.faceRenderType, this.numFaces, byteAt(var14.faceRenderType, var15));
                        }

                        if (var4) {
                            if (var14.facePriority !== null) {
                                putByte(this.facePriority, this.numFaces, byteAt(var14.facePriority, var15));
                            } else {
                                putByte(this.facePriority, this.numFaces, var14.priority);
                            }
                        }

                        if (var5 && var14.faceAlpha !== null) {
                            putByte(this.faceAlpha, this.numFaces, byteAt(var14.faceAlpha, var15));
                        }

                        if (var6 && var14.faceLabel !== null) {
                            arrayPutI32(this.faceLabel, this.numFaces, arrayAtI32(var14.faceLabel, var15));
                        }

                        if (var7) {
                            if (var14.faceMaterial !== null) {
                                arrayPutI16(this.faceMaterial, this.numFaces, arrayAtI16(var14.faceMaterial, var15));
                            } else {
                                arrayPutI16(this.faceMaterial, this.numFaces, -1);
                            }
                        }

                        if (var8) {
                            if (var14.faceTextureAxis !== null && sbyteAt(var14.faceTextureAxis, var15) !== -1) {
                                putByte(this.faceTextureAxis, this.numFaces, sbyteAt(var14.faceTextureAxis, var15) + this.numT);
                            } else {
                                putByte(this.faceTextureAxis, this.numFaces, -1);
                            }
                        }

                        arrayPutI16(this.faceColour, this.numFaces, arrayAtI16(var14.faceColour, var15));
                        arrayPutI16(this.facePartMask, this.numFaces, var13);
                        arrayPutI32(this.faceVertexA, this.numFaces, this.AddPointFromModel(var14, arrayAtI32(var14.faceVertexA, var15), var13, points));
                        arrayPutI32(this.faceVertexB, this.numFaces, this.AddPointFromModel(var14, arrayAtI32(var14.faceVertexB, var15), var13, points));
                        arrayPutI32(this.faceVertexC, this.numFaces, this.AddPointFromModel(var14, arrayAtI32(var14.faceVertexC, var15), var13, points));
                        this.numFaces = (this.numFaces + 1) | 0;
                    }

                    for (let var16 = 0; var16 < var14.numT; var16++) {
                        let var17: number;
                        putByte(this.textureType, this.numT, (var17 = sbyteAt(var14.textureType, var16)));
                        if (var17 === 0) {
                            // The (short) casts are the Int16Array stores.
                            arrayPutI16(this.faceTextureP, this.numT, this.AddPointFromModel(var14, arrayAtI16(var14.faceTextureP, var16), var13, points));
                            arrayPutI16(this.faceTextureM, this.numT, this.AddPointFromModel(var14, arrayAtI16(var14.faceTextureM, var16), var13, points));
                            arrayPutI16(this.faceTextureN, this.numT, this.AddPointFromModel(var14, arrayAtI16(var14.faceTextureN, var16), var13, points));
                        }

                        if (var17 >= 1 && var17 <= 3) {
                            arrayPutI16(this.faceTextureP, this.numT, arrayAtI16(var14.faceTextureP, var16));
                            arrayPutI16(this.faceTextureM, this.numT, arrayAtI16(var14.faceTextureM, var16));
                            arrayPutI16(this.faceTextureN, this.numT, arrayAtI16(var14.faceTextureN, var16));
                            arrayPutI16(this.textureScaleX, this.numT, arrayAtI16(var14.textureScaleX, var16));
                            arrayPutI16(this.textureScaleY, this.numT, arrayAtI16(var14.textureScaleY, var16));
                            arrayPutI16(this.textureScaleZ, this.numT, arrayAtI16(var14.textureScaleZ, var16));
                            putByte(this.textureRotation, this.numT, byteAt(var14.textureRotation, var16));
                            putByte(this.textureDirection, this.numT, byteAt(var14.textureDirection, var16));
                            putByte(this.textureSpeed, this.numT, byteAt(var14.textureSpeed, var16));
                        }

                        if (var17 === 2) {
                            putByte(this.textureTransU, this.numT, byteAt(var14.textureTransU, var16));
                            putByte(this.textureTransV, this.numT, byteAt(var14.textureTransV, var16));
                        }

                        this.numT = (this.numT + 1) | 0;
                    }
                }
            }
            return;
        }

        // cb.<init>(Lcb;ZZZZ)V
        const [var1n, var2, var3, var4, var5] = args;
        // A null source throws at the first getfield (var1.s).
        const var1 = requireNonNull(var1n);
        this.numPoints = var1.numPoints;
        this.numFaces = var1.numFaces;
        this.numT = var1.numT;
        if (var2) {
            this.pointX = var1.pointX;
            this.pointY = var1.pointY;
            this.pointZ = var1.pointZ;
        } else {
            this.pointX = new Int32Array(this.numPoints);
            this.pointY = new Int32Array(this.numPoints);
            this.pointZ = new Int32Array(this.numPoints);

            for (let var6 = 0; var6 < this.numPoints; var6++) {
                arrayPutI32(this.pointX, var6, arrayAtI32(var1.pointX, var6));
                arrayPutI32(this.pointY, var6, arrayAtI32(var1.pointY, var6));
                arrayPutI32(this.pointZ, var6, arrayAtI32(var1.pointZ, var6));
            }
        }

        if (var3) {
            this.faceColour = var1.faceColour;
        } else {
            this.faceColour = new Int16Array(this.numFaces);

            for (let var7 = 0; var7 < this.numFaces; var7++) {
                arrayPutI16(this.faceColour, var7, arrayAtI16(var1.faceColour, var7));
            }
        }

        // The bytecode tests var4 first and places the sharing arm first (cb.java inverts it).
        if (var4 || var1.faceMaterial === null) {
            this.faceMaterial = var1.faceMaterial;
        } else {
            this.faceMaterial = new Int16Array(this.numFaces);

            for (let var8 = 0; var8 < this.numFaces; var8++) {
                arrayPutI16(this.faceMaterial, var8, arrayAtI16(var1.faceMaterial, var8));
            }
        }

        if (var5) {
            this.faceAlpha = var1.faceAlpha;
        } else {
            this.faceAlpha = new Uint8Array(this.numFaces);
            if (var1.faceAlpha === null) {
                for (let var9 = 0; var9 < this.numFaces; var9++) {
                    putByte(this.faceAlpha, var9, 0);
                }
            } else {
                for (let var10 = 0; var10 < this.numFaces; var10++) {
                    putByte(this.faceAlpha, var10, byteAt(var1.faceAlpha, var10));
                }
            }
        }

        this.faceVertexA = var1.faceVertexA;
        this.faceVertexB = var1.faceVertexB;
        this.faceVertexC = var1.faceVertexC;
        this.faceRenderType = var1.faceRenderType;
        this.facePriority = var1.facePriority;
        this.faceTextureAxis = var1.faceTextureAxis;
        this.priority = var1.priority;
        this.textureType = var1.textureType;
        this.faceTextureP = var1.faceTextureP;
        this.faceTextureM = var1.faceTextureM;
        this.faceTextureN = var1.faceTextureN;
        this.textureScaleX = var1.textureScaleX;
        this.textureScaleY = var1.textureScaleY;
        this.textureScaleZ = var1.textureScaleZ;
        this.textureRotation = var1.textureRotation;
        this.textureDirection = var1.textureDirection;
        this.textureSpeed = var1.textureSpeed;
        this.textureTransU = var1.textureTransU;
        this.textureTransV = var1.textureTransV;
        this.vertexLabel = var1.vertexLabel;
        this.faceLabel = var1.faceLabel;
        this.labelVertices = var1.labelVertices;
        this.labelFaces = var1.labelFaces;
        this.pointNormal = var1.pointNormal;
        this.faceNormal = var1.faceNormal;
        this.sharedPointNormal = var1.sharedPointNormal;
        this.ambient = var1.ambient;
        this.contrast = var1.contrast;
    }

    // cb.b(III)V
    Resize(var1: number, var2: number, var3: number): void {
        for (let var4 = 0; var4 < this.numPoints; var4++) {
            arrayPutI32(this.pointX, var4, (Math.imul(arrayAtI32(this.pointX, var4), var1) / 128) | 0);
            arrayPutI32(this.pointY, var4, (Math.imul(arrayAtI32(this.pointY, var4), var2) / 128) | 0);
            arrayPutI32(this.pointZ, var4, (Math.imul(arrayAtI32(this.pointZ, var4), var3) / 128) | 0);
        }

        this.GeometryChanged();
    }

    // cb.a(IIIBSB)I
    // var4 = render type (byte), var5 = colour (short), var6 = alpha (byte). Returns the new face index.
    AddFace(var1: number, var2: number, var3: number, var4: number, var5: number, var6: number): number {
        arrayPutI32(this.faceVertexA, this.numFaces, var1);
        arrayPutI32(this.faceVertexB, this.numFaces, var2);
        arrayPutI32(this.faceVertexC, this.numFaces, var3);
        putByte(this.faceRenderType, this.numFaces, var4);
        putByte(this.faceTextureAxis, this.numFaces, -1);
        arrayPutI16(this.faceColour, this.numFaces, var5);
        arrayPutI16(this.faceMaterial, this.numFaces, -1);
        putByte(this.faceAlpha, this.numFaces, var6);
        // return this.y++;
        const previous = this.numFaces;
        this.numFaces = (previous + 1) | 0;
        return previous;
    }

    // cb.c()V
    Rotate90(): void {
        for (let var1 = 0; var1 < this.numPoints; var1++) {
            const var2 = arrayAtI32(this.pointX, var1);
            arrayPutI32(this.pointX, var1, arrayAtI32(this.pointZ, var1));
            arrayPutI32(this.pointZ, var1, -var2 | 0);
        }

        this.GeometryChanged();
    }

    // cb.a(II[[I[[IIIIZZ)Lcb;
    // var1 = hill-skew type (1..5), var2 = its parameter, var3 = the ground heightmap, var4 = the second heightmap
    // (types 4 and 5), var5/var6/var7 = the model's world x/y/z, var8 = copy instead of changing this model, var9 =
    // drop the normals and bounds of the result (otherwise only this model's bounds flag is cleared).
    HillSkewCopy(var1: number, var2: number, var3: (Int32Array | null)[] | null, var4: (Int32Array | null)[] | null, var5: number, var6: number, var7: number, var8: boolean, var9: boolean): ModelUnlit {
        this.CalcBoundingCube();
        let var10 = (var5 + this.minX) | 0;
        let var11 = (var5 + this.maxX) | 0;
        let var12 = (var7 + this.minZ) | 0;
        let var13 = (var7 + this.maxZ) | 0;
        if ((var1 === 1 || var1 === 2 || var1 === 3 || var1 === 5) && (var10 < 0 || (var11 + 128) >> 7 >= requireNonNull(var3).length || var12 < 0 || (var13 + 128) >> 7 >= requireNonNull(arrayAtObj(var3, 0)).length)) {
            return this;
        }

        if (var1 === 4 || var1 === 5) {
            if (var4 === null) {
                return this;
            }

            if (var10 < 0 || (var11 + 128) >> 7 >= var4.length || var12 < 0 || (var13 + 128) >> 7 >= requireNonNull(arrayAtObj(var4, 0)).length) {
                return this;
            }
        } else {
            var10 >>= 7;
            var11 = (var11 + 127) >> 7;
            var12 >>= 7;
            var13 = (var13 + 127) >> 7;
            if (at2(var3, var10, var12) === var6 && at2(var3, var11, var12) === var6 && at2(var3, var10, var13) === var6 && at2(var3, var11, var13) === var6) {
                return this;
            }
        }

        const var14 = var8 ? new ModelUnlit() : this;
        if (var8) {
            var14.numPoints = this.numPoints;
            var14.numFaces = this.numFaces;
            var14.numT = this.numT;
            var14.faceVertexA = this.faceVertexA;
            var14.faceVertexB = this.faceVertexB;
            var14.faceVertexC = this.faceVertexC;
            var14.faceRenderType = this.faceRenderType;
            var14.facePriority = this.facePriority;
            var14.faceAlpha = this.faceAlpha;
            var14.faceTextureAxis = this.faceTextureAxis;
            var14.faceColour = this.faceColour;
            var14.faceMaterial = this.faceMaterial;
            var14.priority = this.priority;
            var14.textureType = this.textureType;
            var14.faceTextureP = this.faceTextureP;
            var14.faceTextureM = this.faceTextureM;
            var14.faceTextureN = this.faceTextureN;
            var14.textureScaleX = this.textureScaleX;
            var14.textureScaleY = this.textureScaleY;
            var14.textureScaleZ = this.textureScaleZ;
            var14.textureRotation = this.textureRotation;
            var14.textureDirection = this.textureDirection;
            var14.textureSpeed = this.textureSpeed;
            var14.textureTransU = this.textureTransU;
            var14.textureTransV = this.textureTransV;
            var14.vertexLabel = this.vertexLabel;
            var14.faceLabel = this.faceLabel;
            var14.labelVertices = this.labelVertices;
            var14.labelFaces = this.labelFaces;
            var14.ambient = this.ambient;
            var14.contrast = this.contrast;
            var14.pointNormal = this.pointNormal;
            var14.faceNormal = this.faceNormal;
            var14.sharedPointNormal = this.sharedPointNormal;
            if (var1 === 3) {
                var14.pointX = ArrayUtils.copyOf(this.pointX);
                var14.pointY = ArrayUtils.copyOf(this.pointY);
                var14.pointZ = ArrayUtils.copyOf(this.pointZ);
            } else {
                var14.pointX = this.pointX;
                var14.pointY = new Int32Array(var14.numPoints);
                var14.pointZ = this.pointZ;
            }
        }

        if (var1 === 1) {
            for (let var15 = 0; var15 < var14.numPoints; var15++) {
                const var16 = (arrayAtI32(this.pointX, var15) + var5) | 0;
                const var17 = (arrayAtI32(this.pointZ, var15) + var7) | 0;
                const var18 = var16 & 127;
                const var19 = var17 & 127;
                const var20 = var16 >> 7;
                const var21 = var17 >> 7;
                const var22 = (Math.imul(at2(var3, var20, var21), 128 - var18) + Math.imul(at2(var3, (var20 + 1) | 0, var21), var18)) >> 7;
                const var23 = (Math.imul(at2(var3, var20, (var21 + 1) | 0), 128 - var18) + Math.imul(at2(var3, (var20 + 1) | 0, (var21 + 1) | 0), var18)) >> 7;
                const var24 = (Math.imul(var22, 128 - var19) + Math.imul(var23, var19)) >> 7;
                arrayPutI32(var14.pointY, var15, (arrayAtI32(this.pointY, var15) + var24 - var6) | 0);
            }
        } else if (var1 === 2) {
            for (let var15 = 0; var15 < var14.numPoints; var15++) {
                const var16 = intDivide(arrayAtI32(this.pointY, var15) << 16, this.minY);
                if (var16 < var2) {
                    const var17 = (arrayAtI32(this.pointX, var15) + var5) | 0;
                    const var18 = (arrayAtI32(this.pointZ, var15) + var7) | 0;
                    const var19 = var17 & 127;
                    const var20 = var18 & 127;
                    const var21 = var17 >> 7;
                    const var22 = var18 >> 7;
                    const var23 = (Math.imul(at2(var3, var21, var22), 128 - var19) + Math.imul(at2(var3, (var21 + 1) | 0, var22), var19)) >> 7;
                    const var24 = (Math.imul(at2(var3, var21, (var22 + 1) | 0), 128 - var19) + Math.imul(at2(var3, (var21 + 1) | 0, (var22 + 1) | 0), var19)) >> 7;
                    const var25 = (Math.imul(var23, 128 - var20) + Math.imul(var24, var20)) >> 7;
                    arrayPutI32(var14.pointY, var15, (arrayAtI32(this.pointY, var15) + intDivide(Math.imul((var25 - var6) | 0, (var2 - var16) | 0), var2)) | 0);
                } else {
                    arrayPutI32(var14.pointY, var15, arrayAtI32(this.pointY, var15));
                }
            }
        } else if (var1 === 3) {
            const var15 = (var2 & 255) * 4;
            const var16 = ((var2 >> 8) & 255) * 4;
            // Tilts this model, not var14 (the bytecode calls it on aload_0).
            this.tiltToGround(var3, var5, var6, var7, var15, var16);
        } else if (var1 === 4) {
            const var15 = (this.maxY - this.minY) | 0;

            for (let var16 = 0; var16 < this.numPoints; var16++) {
                const var17 = (arrayAtI32(this.pointX, var16) + var5) | 0;
                const var18 = (arrayAtI32(this.pointZ, var16) + var7) | 0;
                const var19 = var17 & 127;
                const var20 = var18 & 127;
                const var21 = var17 >> 7;
                const var22 = var18 >> 7;
                const var23 = (Math.imul(at2(var4, var21, var22), 128 - var19) + Math.imul(at2(var4, (var21 + 1) | 0, var22), var19)) >> 7;
                const var24 = (Math.imul(at2(var4, var21, (var22 + 1) | 0), 128 - var19) + Math.imul(at2(var4, (var21 + 1) | 0, (var22 + 1) | 0), var19)) >> 7;
                const var25 = (Math.imul(var23, 128 - var20) + Math.imul(var24, var20)) >> 7;
                arrayPutI32(var14.pointY, var16, (arrayAtI32(this.pointY, var16) + ((var25 - var6) | 0) + var15) | 0);
            }
        } else if (var1 === 5) {
            const var15 = (this.maxY - this.minY) | 0;

            for (let var16 = 0; var16 < this.numPoints; var16++) {
                const var17 = (arrayAtI32(this.pointX, var16) + var5) | 0;
                const var18 = (arrayAtI32(this.pointZ, var16) + var7) | 0;
                const var19 = var17 & 127;
                const var20 = var18 & 127;
                const var21 = var17 >> 7;
                const var22 = var18 >> 7;
                let var23 = (Math.imul(at2(var3, var21, var22), 128 - var19) + Math.imul(at2(var3, (var21 + 1) | 0, var22), var19)) >> 7;
                let var24 = (Math.imul(at2(var3, var21, (var22 + 1) | 0), 128 - var19) + Math.imul(at2(var3, (var21 + 1) | 0, (var22 + 1) | 0), var19)) >> 7;
                const var25 = (Math.imul(var23, 128 - var20) + Math.imul(var24, var20)) >> 7;
                var23 = (Math.imul(at2(var4, var21, var22), 128 - var19) + Math.imul(at2(var4, (var21 + 1) | 0, var22), var19)) >> 7;
                var24 = (Math.imul(at2(var4, var21, (var22 + 1) | 0), 128 - var19) + Math.imul(at2(var4, (var21 + 1) | 0, (var22 + 1) | 0), var19)) >> 7;
                const var26 = (Math.imul(var23, 128 - var20) + Math.imul(var24, var20)) >> 7;
                const var27 = (var25 - var26) | 0;
                arrayPutI32(var14.pointY, var16, ((Math.imul(intDivide(arrayAtI32(this.pointY, var16) << 8, var15), var27) >> 8) - ((var6 - var25) | 0)) | 0);
            }
        }

        if (var9) {
            var14.GeometryChanged();
        } else {
            this.boundsCalculated = false;
        }

        return var14;
    }

    // cb.a(IIIII)V. Empty: an unlit model has no per-cycle update.
    override update(_var1: number, _var2: number, _var3: number, _var4: number, _var5: number): void {}

    // cb.a(III)Lug; (NXT ModelUnlit::LightWithPrepared; the ModelSource name is kept because it overrides ug.a(III)).
    // Lights with the ambient/contrast LocType stored and the light vector (var1, var2, var3).
    override light(var1: number, var2: number, var3: number): ModelSource {
        return this.Light(this.ambient, this.contrast, var1, var2, var3);
    }

    // cb.a(Lal;II)Lcb;
    // var1 = group, var2 = file (the callers pass the model id and 0). Null when the file is not available.
    static Load(var0: Js5 | null, var1: number, var2: number): ModelUnlit | null {
        const var3 = requireNonNull(var0).GetFile(var2, var1);
        return var3 === null ? null : new ModelUnlit(var3);
    }

    // cb.b()I
    override getMinY(): number {
        if (!this.boundsCalculated) {
            this.CalcBoundingCube();
        }

        return this.minY;
    }

    // cb.d()V
    Mirror(): void {
        for (let var1 = 0; var1 < this.numPoints; var1++) {
            arrayPutI32(this.pointZ, var1, -arrayAtI32(this.pointZ, var1) | 0);
        }

        for (let var2 = 0; var2 < this.numFaces; var2++) {
            const var3 = arrayAtI32(this.faceVertexA, var2);
            arrayPutI32(this.faceVertexA, var2, arrayAtI32(this.faceVertexC, var2));
            arrayPutI32(this.faceVertexC, var2, var3);
        }

        this.GeometryChanged();
    }

    // cb.e()V
    CalculateNormals(): void {
        if (this.pointNormal !== null) {
            return;
        }

        this.pointNormal = new Array<PointNormal | null>(this.numPoints).fill(null);

        for (let var1 = 0; var1 < this.numPoints; var1++) {
            arrayPutObj(this.pointNormal, var1, new PointNormal());
        }

        for (let var2 = 0; var2 < this.numFaces; var2++) {
            const var3 = arrayAtI32(this.faceVertexA, var2);
            const var4 = arrayAtI32(this.faceVertexB, var2);
            const var5 = arrayAtI32(this.faceVertexC, var2);
            const var6 = (arrayAtI32(this.pointX, var4) - arrayAtI32(this.pointX, var3)) | 0;
            const var7 = (arrayAtI32(this.pointY, var4) - arrayAtI32(this.pointY, var3)) | 0;
            const var8 = (arrayAtI32(this.pointZ, var4) - arrayAtI32(this.pointZ, var3)) | 0;
            const var9 = (arrayAtI32(this.pointX, var5) - arrayAtI32(this.pointX, var3)) | 0;
            const var10 = (arrayAtI32(this.pointY, var5) - arrayAtI32(this.pointY, var3)) | 0;
            const var11 = (arrayAtI32(this.pointZ, var5) - arrayAtI32(this.pointZ, var3)) | 0;
            let var12 = (Math.imul(var7, var11) - Math.imul(var10, var8)) | 0;
            let var13 = (Math.imul(var8, var9) - Math.imul(var11, var6)) | 0;
            let var14 = (Math.imul(var6, var10) - Math.imul(var9, var7)) | 0;

            while (var12 > 8192 || var13 > 8192 || var14 > 8192 || var12 < -8192 || var13 < -8192 || var14 < -8192) {
                var12 >>= 1;
                var13 >>= 1;
                var14 >>= 1;
            }

            // Each component is in [-8192, 8192], so the int sum cannot overflow and the sqrt fits an int.
            let var15 = Math.sqrt((Math.imul(var12, var12) + Math.imul(var13, var13) + Math.imul(var14, var14)) | 0) | 0;
            if (var15 <= 0) {
                var15 = 1;
            }

            var12 = (Math.imul(var12, 256) / var15) | 0;
            var13 = (Math.imul(var13, 256) / var15) | 0;
            var14 = (Math.imul(var14, 256) / var15) | 0;
            let var16: number;
            if (this.faceRenderType === null) {
                var16 = 0;
            } else {
                var16 = sbyteAt(this.faceRenderType, var2);
            }

            if (var16 === 0) {
                let var17 = requireNonNull(arrayAtObj(this.pointNormal, var3));
                var17.x = (var17.x + var12) | 0;
                var17.y = (var17.y + var13) | 0;
                var17.z = (var17.z + var14) | 0;
                var17.w = (var17.w + 1) | 0;
                var17 = requireNonNull(arrayAtObj(this.pointNormal, var4));
                var17.x = (var17.x + var12) | 0;
                var17.y = (var17.y + var13) | 0;
                var17.z = (var17.z + var14) | 0;
                var17.w = (var17.w + 1) | 0;
                var17 = requireNonNull(arrayAtObj(this.pointNormal, var5));
                var17.x = (var17.x + var12) | 0;
                var17.y = (var17.y + var13) | 0;
                var17.z = (var17.z + var14) | 0;
                var17.w = (var17.w + 1) | 0;
            } else if (var16 === 1) {
                if (this.faceNormal === null) {
                    this.faceNormal = new Array<FaceNormal | null>(this.numFaces).fill(null);
                }

                let var23: FaceNormal;
                arrayPutObj(this.faceNormal, var2, (var23 = new FaceNormal()));
                var23.x = var12;
                var23.y = var13;
                var23.z = var14;
            }
        }
    }

    // cb.a([[III)I
    // Bilinear height at fine coordinates (var1, var2) (128 units per tile); 0 outside the map.
    private static interpolateHeight(var0: (Int32Array | null)[] | null, var1: number, var2: number): number {
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

    // cb.a(Lug;IIIZ)V (NXT ShareLight; the ModelSource name is kept because it overrides ug.a(Lug;IIIZ)V).
    // var1 = the neighbouring unlit model, (var2, var3, var4) = its offset from this model, var5 = also mark faces
    // whose three vertices are all shared as render type 2 (when at least 3 vertices matched).
    override mergeNormals(var1: ModelSource, var2: number, var3: number, var4: number, var5: boolean): void {
        if (!(var1 instanceof ModelUnlit)) {
            // checkcast cb. A null var1 would pass the cast and throw at var6.k(); both are TypeErrors here.
            throw new TypeError(var1 === null ? 'Null reference' : 'ClassCastException: not a ModelUnlit');
        }

        const var6 = var1;
        var6.CalcBoundingCube();
        var6.CalculateNormals();
        ModelUnlit.shareTic = (ModelUnlit.shareTic + 1) | 0;
        let var7 = 0;
        const var8 = var6.pointX;
        const var9 = var6.numPoints;

        for (let var10 = 0; var10 < this.numPoints; var10++) {
            const var11 = requireNonNull(arrayAtObj(this.pointNormal, var10));
            if (var11.w !== 0) {
                const var12 = (arrayAtI32(this.pointY, var10) - var3) | 0;
                if (var12 < var6.minY || var12 > var6.maxY) {
                    continue;
                }

                const var13 = (arrayAtI32(this.pointX, var10) - var2) | 0;
                if (var13 < var6.minX || var13 > var6.maxX) {
                    continue;
                }

                const var14 = (arrayAtI32(this.pointZ, var10) - var4) | 0;
                if (var14 < var6.minZ || var14 > var6.maxZ) {
                    continue;
                }

                for (let var15 = 0; var15 < var9; var15++) {
                    // var16 is only dereferenced once the three coordinates match.
                    const var16 = arrayAtObj(var6.pointNormal, var15);
                    if (var13 === arrayAtI32(var8, var15) && var14 === arrayAtI32(var6.pointZ, var15) && var12 === arrayAtI32(var6.pointY, var15) && requireNonNull(var16).w !== 0) {
                        if (this.sharedPointNormal === null) {
                            this.sharedPointNormal = new Array<PointNormal | null>(this.numPoints).fill(null);
                        }

                        if (var6.sharedPointNormal === null) {
                            var6.sharedPointNormal = new Array<PointNormal | null>(var9).fill(null);
                        }

                        let var17 = arrayAtObj(this.sharedPointNormal, var10);
                        if (var17 === null) {
                            arrayPutObj(this.sharedPointNormal, var10, (var17 = new PointNormal(var11)));
                        }

                        let var18 = arrayAtObj(var6.sharedPointNormal, var15);
                        if (var18 === null) {
                            arrayPutObj(var6.sharedPointNormal, var15, (var18 = new PointNormal(var16)));
                        }

                        var17.x = (var17.x + requireNonNull(var16).x) | 0;
                        var17.y = (var17.y + requireNonNull(var16).y) | 0;
                        var17.z = (var17.z + requireNonNull(var16).z) | 0;
                        var17.w = (var17.w + requireNonNull(var16).w) | 0;
                        var18.x = (var18.x + var11.x) | 0;
                        var18.y = (var18.y + var11.y) | 0;
                        var18.z = (var18.z + var11.z) | 0;
                        var18.w = (var18.w + var11.w) | 0;
                        var7++;
                        arrayPutI32(ModelUnlit.shareMap, var10, ModelUnlit.shareTic);
                        arrayPutI32(ModelUnlit.shareMap2, var15, ModelUnlit.shareTic);
                    }
                }
            }
        }

        if (var7 < 3 || !var5) {
            return;
        }

        for (let var11 = 0; var11 < this.numFaces; var11++) {
            if (
                arrayAtI32(ModelUnlit.shareMap, arrayAtI32(this.faceVertexA, var11)) === ModelUnlit.shareTic &&
                arrayAtI32(ModelUnlit.shareMap, arrayAtI32(this.faceVertexB, var11)) === ModelUnlit.shareTic &&
                arrayAtI32(ModelUnlit.shareMap, arrayAtI32(this.faceVertexC, var11)) === ModelUnlit.shareTic
            ) {
                if (this.faceRenderType === null) {
                    this.faceRenderType = new Uint8Array(this.numFaces);
                }

                putByte(this.faceRenderType, var11, 2);
            }
        }

        for (let var12 = 0; var12 < var6.numFaces; var12++) {
            if (
                arrayAtI32(ModelUnlit.shareMap2, arrayAtI32(var6.faceVertexA, var12)) === ModelUnlit.shareTic &&
                arrayAtI32(ModelUnlit.shareMap2, arrayAtI32(var6.faceVertexB, var12)) === ModelUnlit.shareTic &&
                arrayAtI32(ModelUnlit.shareMap2, arrayAtI32(var6.faceVertexC, var12)) === ModelUnlit.shareTic
            ) {
                if (var6.faceRenderType === null) {
                    var6.faceRenderType = new Uint8Array(var6.numFaces);
                }

                putByte(var6.faceRenderType, var12, 2);
            }
        }
    }

    // cb.a([[IIIIII)V
    // Hill-skew type 3: samples the heightmap var1 at the four corners of a var5 x var6 footprint centred on
    // (var2, var4), tilts the model about X and Z to the slope and raises it from var3 to the lower diagonal's mean.
    private tiltToGround(var1: (Int32Array | null)[] | null, var2: number, var3: number, var4: number, var5: number, var6: number): void {
        let var7 = 0;
        let var8 = 0;
        let var9 = 0;
        const var10 = ((-var5 | 0) / 2) | 0;
        const var11 = ((-var6 | 0) / 2) | 0;
        const var12 = ModelUnlit.interpolateHeight(var1, (var2 + var10) | 0, (var4 + var11) | 0);
        const var13 = (var5 / 2) | 0;
        const var14 = ((-var6 | 0) / 2) | 0;
        const var15 = ModelUnlit.interpolateHeight(var1, (var2 + var13) | 0, (var4 + var14) | 0);
        const var16 = ((-var5 | 0) / 2) | 0;
        const var17 = (var6 / 2) | 0;
        const var18 = ModelUnlit.interpolateHeight(var1, (var2 + var16) | 0, (var4 + var17) | 0);
        const var19 = (var5 / 2) | 0;
        const var20 = (var6 / 2) | 0;
        const var21 = ModelUnlit.interpolateHeight(var1, (var2 + var19) | 0, (var4 + var20) | 0);
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

    // cb.f()V
    Rotate180(): void {
        for (let var1 = 0; var1 < this.numPoints; var1++) {
            arrayPutI32(this.pointX, var1, -arrayAtI32(this.pointX, var1) | 0);
            arrayPutI32(this.pointZ, var1, -arrayAtI32(this.pointZ, var1) | 0);
        }

        this.GeometryChanged();
    }

    // cb.g()Lcb;
    // A model that shares every array except a private copy of faceRenderType (which mergeNormals writes).
    CopyForShareLight(): ModelUnlit {
        const var1 = new ModelUnlit();
        if (this.faceRenderType !== null) {
            var1.faceRenderType = new Uint8Array(this.numFaces);

            for (let var2 = 0; var2 < this.numFaces; var2++) {
                putByte(var1.faceRenderType, var2, byteAt(this.faceRenderType, var2));
            }
        }

        var1.numPoints = this.numPoints;
        var1.numFaces = this.numFaces;
        var1.numT = this.numT;
        var1.pointX = this.pointX;
        var1.pointY = this.pointY;
        var1.pointZ = this.pointZ;
        var1.faceVertexA = this.faceVertexA;
        var1.faceVertexB = this.faceVertexB;
        var1.faceVertexC = this.faceVertexC;
        var1.facePriority = this.facePriority;
        var1.faceAlpha = this.faceAlpha;
        var1.faceTextureAxis = this.faceTextureAxis;
        var1.faceColour = this.faceColour;
        var1.faceMaterial = this.faceMaterial;
        var1.priority = this.priority;
        var1.textureType = this.textureType;
        var1.faceTextureP = this.faceTextureP;
        var1.faceTextureM = this.faceTextureM;
        var1.faceTextureN = this.faceTextureN;
        var1.textureScaleX = this.textureScaleX;
        var1.textureScaleY = this.textureScaleY;
        var1.textureScaleZ = this.textureScaleZ;
        var1.textureRotation = this.textureRotation;
        var1.textureDirection = this.textureDirection;
        var1.textureSpeed = this.textureSpeed;
        var1.textureTransU = this.textureTransU;
        var1.textureTransV = this.textureTransV;
        var1.vertexLabel = this.vertexLabel;
        var1.faceLabel = this.faceLabel;
        var1.labelVertices = this.labelVertices;
        var1.labelFaces = this.labelFaces;
        var1.pointNormal = this.pointNormal;
        var1.faceNormal = this.faceNormal;
        var1.ambient = this.ambient;
        var1.contrast = this.contrast;
        return var1;
    }

    // cb.b(IIIII)Lnd; (NXT Light)
    // var1 = ambient, var2 = contrast, (var3, var4, var5) = light vector.
    Light(var1: number, var2: number, var3: number, var4: number, var5: number): ModelLit {
        // HD gb.c(IIIII)Lak;
        if (glJar && loadGlRenderer().active) {
            const GlModel = loadGlModel();
            const model = new GlModel(this, var1, var2, true);
            model.buildAnimationTables();
            return model;
        }
        return new ModelLitImpl(this, var1, var2, var3, var4, var5);
    }

    // cb.h()V
    DiscardAnimLabels(): void {
        this.vertexLabel = null;
        this.faceLabel = null;
        this.labelVertices = null;
        this.labelFaces = null;
    }

    // cb.a()Z
    override isUnlit(): boolean {
        return true;
    }

    // cb.i()V
    Rotate270(): void {
        for (let var1 = 0; var1 < this.numPoints; var1++) {
            const var2 = arrayAtI32(this.pointZ, var1);
            arrayPutI32(this.pointZ, var1, arrayAtI32(this.pointX, var1));
            arrayPutI32(this.pointX, var1, -var2 | 0);
        }

        this.GeometryChanged();
    }

    // cb.j()V
    private GeometryChanged(): void {
        this.pointNormal = null;
        this.sharedPointNormal = null;
        this.faceNormal = null;
        this.boundsCalculated = false;
    }

    // cb.a(SS)V
    Retexture(var1: number, var2: number): void {
        if (this.faceMaterial === null) {
            return;
        }

        for (let var3 = 0; var3 < this.numFaces; var3++) {
            if (arrayAtI16(this.faceMaterial, var3) === var1) {
                arrayPutI16(this.faceMaterial, var3, var2);
            }
        }
    }

    // cb.a(I)V
    // Rotates in the x/z plane (yaw).
    RotateYAxis(var1: number): void {
        const var2 = arrayAtI32(ModelUnlit.sin, var1);
        const var3 = arrayAtI32(ModelUnlit.cos, var1);

        for (let var4 = 0; var4 < this.numPoints; var4++) {
            const var5 = (Math.imul(arrayAtI32(this.pointZ, var4), var2) + Math.imul(arrayAtI32(this.pointX, var4), var3)) >> 16;
            arrayPutI32(this.pointZ, var4, (Math.imul(arrayAtI32(this.pointZ, var4), var3) - Math.imul(arrayAtI32(this.pointX, var4), var2)) >> 16);
            arrayPutI32(this.pointX, var4, var5);
        }

        this.GeometryChanged();
    }

    // cb.a([B)V
    // The original format (no trailing 0xFFFF marker). Locals are named after the bytecode slots.
    private LoadOb2Engine200(var1: Uint8Array | null): void {
        let var2 = false;
        let var3 = false;
        const var4 = new PacketT(var1);
        const var5 = new PacketT(var1);
        const var6 = new PacketT(var1);
        const var7 = new PacketT(var1);
        const var8 = new PacketT(var1);
        var4.m_pos = (requireNonNull(var1).length - 18) | 0;
        const var9 = var4.g2();
        const var10 = var4.g2();
        const var11 = var4.g1();
        const var12 = var4.g1();
        const var13 = var4.g1();
        const var14 = var4.g1();
        const var15 = var4.g1();
        const var16 = var4.g1();
        const var17 = var4.g2();
        const var18 = var4.g2();
        const var19 = var4.g2();
        const var20 = var4.g2();
        let var21 = 0;
        const var22 = var21;
        var21 = (var21 + var9) | 0;
        const var23 = var21;
        var21 = (var21 + var10) | 0;
        const var24 = var21;
        if (var13 === 255) {
            var21 = (var21 + var10) | 0;
        }

        const var25 = var21;
        if (var15 === 1) {
            var21 = (var21 + var10) | 0;
        }

        const var26 = var21;
        if (var12 === 1) {
            var21 = (var21 + var10) | 0;
        }

        const var27 = var21;
        if (var16 === 1) {
            var21 = (var21 + var9) | 0;
        }

        const var28 = var21;
        if (var14 === 1) {
            var21 = (var21 + var10) | 0;
        }

        const var29 = var21;
        var21 = (var21 + var20) | 0;
        const var30 = var21;
        var21 = (var21 + Math.imul(var10, 2)) | 0;
        const var31 = var21;
        var21 = (var21 + Math.imul(var11, 6)) | 0;
        const var32 = var21;
        var21 = (var21 + var17) | 0;
        const var33 = var21;
        var21 = (var21 + var18) | 0;
        const var34 = var21;
        var21 = (var21 + var19) | 0;
        this.numPoints = var9;
        this.numFaces = var10;
        this.numT = var11;
        this.pointX = new Int32Array(var9);
        this.pointY = new Int32Array(var9);
        this.pointZ = new Int32Array(var9);
        this.faceVertexA = new Int32Array(var10);
        this.faceVertexB = new Int32Array(var10);
        this.faceVertexC = new Int32Array(var10);
        if (var11 > 0) {
            this.textureType = new Uint8Array(var11);
            this.faceTextureP = new Int16Array(var11);
            this.faceTextureM = new Int16Array(var11);
            this.faceTextureN = new Int16Array(var11);
        }

        if (var16 === 1) {
            this.vertexLabel = new Int32Array(var9);
        }

        if (var12 === 1) {
            this.faceRenderType = new Uint8Array(var10);
            this.faceTextureAxis = new Uint8Array(var10);
            this.faceMaterial = new Int16Array(var10);
        }

        if (var13 === 255) {
            this.facePriority = new Uint8Array(var10);
        } else {
            this.priority = (var13 << 24) >> 24;
        }

        if (var14 === 1) {
            this.faceAlpha = new Uint8Array(var10);
        }

        if (var15 === 1) {
            this.faceLabel = new Int32Array(var10);
        }

        this.faceColour = new Int16Array(var10);
        var4.m_pos = var22;
        var5.m_pos = var32;
        var6.m_pos = var33;
        var7.m_pos = var34;
        var8.m_pos = var27;
        let var35 = 0;
        let var36 = 0;
        let var37 = 0;

        for (let var38 = 0; var38 < var9; var38++) {
            const var39 = var4.g1();
            let var40 = 0;
            if ((var39 & 1) !== 0) {
                var40 = var5.gSmart1or2s();
            }

            let var41 = 0;
            if ((var39 & 2) !== 0) {
                var41 = var6.gSmart1or2s();
            }

            let var42 = 0;
            if ((var39 & 4) !== 0) {
                var42 = var7.gSmart1or2s();
            }

            arrayPutI32(this.pointX, var38, (var35 + var40) | 0);
            arrayPutI32(this.pointY, var38, (var36 + var41) | 0);
            arrayPutI32(this.pointZ, var38, (var37 + var42) | 0);
            var35 = arrayAtI32(this.pointX, var38);
            var36 = arrayAtI32(this.pointY, var38);
            var37 = arrayAtI32(this.pointZ, var38);
            if (var16 === 1) {
                arrayPutI32(this.vertexLabel, var38, var8.g1());
            }
        }

        var4.m_pos = var30;
        var5.m_pos = var26;
        var6.m_pos = var24;
        var7.m_pos = var28;
        var8.m_pos = var25;

        for (let var39 = 0; var39 < var10; var39++) {
            // (short) g2: the Int16Array store truncates.
            arrayPutI16(this.faceColour, var39, var4.g2());
            if (var12 === 1) {
                const var40 = var5.g1();
                if ((var40 & 1) === 1) {
                    putByte(this.faceRenderType, var39, 1);
                    var2 = true;
                } else {
                    putByte(this.faceRenderType, var39, 0);
                }

                if ((var40 & 2) === 2) {
                    putByte(this.faceTextureAxis, var39, var40 >> 2);
                    arrayPutI16(this.faceMaterial, var39, arrayAtI16(this.faceColour, var39));
                    arrayPutI16(this.faceColour, var39, 127);
                    if (arrayAtI16(this.faceMaterial, var39) !== -1) {
                        var3 = true;
                    }
                } else {
                    putByte(this.faceTextureAxis, var39, -1);
                    arrayPutI16(this.faceMaterial, var39, -1);
                }
            }

            if (var13 === 255) {
                putByte(this.facePriority, var39, var6.g1s());
            }

            if (var14 === 1) {
                putByte(this.faceAlpha, var39, var7.g1s());
            }

            if (var15 === 1) {
                arrayPutI32(this.faceLabel, var39, var8.g1());
            }
        }

        var4.m_pos = var29;
        var5.m_pos = var23;
        let var40 = 0;
        let var41 = 0;
        let var42 = 0;
        let var43 = 0;

        for (let var44 = 0; var44 < var10; var44++) {
            const var45 = var5.g1();
            if (var45 === 1) {
                var40 = (var4.gSmart1or2s() + var43) | 0;
                var43 = var40;
                var41 = (var4.gSmart1or2s() + var43) | 0;
                var43 = var41;
                var42 = (var4.gSmart1or2s() + var43) | 0;
                var43 = var42;
                arrayPutI32(this.faceVertexA, var44, var40);
                arrayPutI32(this.faceVertexB, var44, var41);
                arrayPutI32(this.faceVertexC, var44, var42);
            }

            if (var45 === 2) {
                var41 = var42;
                var42 = (var4.gSmart1or2s() + var43) | 0;
                var43 = var42;
                arrayPutI32(this.faceVertexA, var44, var40);
                arrayPutI32(this.faceVertexB, var44, var41);
                arrayPutI32(this.faceVertexC, var44, var42);
            }

            if (var45 === 3) {
                var40 = var42;
                var42 = (var4.gSmart1or2s() + var43) | 0;
                var43 = var42;
                arrayPutI32(this.faceVertexA, var44, var40);
                arrayPutI32(this.faceVertexB, var44, var41);
                arrayPutI32(this.faceVertexC, var44, var42);
            }

            if (var45 === 4) {
                const var46 = var40;
                var40 = var41;
                var41 = var46;
                var42 = (var4.gSmart1or2s() + var43) | 0;
                var43 = var42;
                arrayPutI32(this.faceVertexA, var44, var40);
                arrayPutI32(this.faceVertexB, var44, var41);
                arrayPutI32(this.faceVertexC, var44, var42);
            }
        }

        var4.m_pos = var31;

        for (let var45 = 0; var45 < var11; var45++) {
            putByte(this.textureType, var45, 0);
            arrayPutI16(this.faceTextureP, var45, var4.g2());
            arrayPutI16(this.faceTextureM, var45, var4.g2());
            arrayPutI16(this.faceTextureN, var45, var4.g2());
        }

        if (this.faceTextureAxis !== null) {
            let var46 = false;

            for (let var47 = 0; var47 < var10; var47++) {
                const var48 = byteAt(this.faceTextureAxis, var47) & 255;
                if (var48 !== 255) {
                    if (
                        (arrayAtI16(this.faceTextureP, var48) & 0xffff) === arrayAtI32(this.faceVertexA, var47) &&
                        (arrayAtI16(this.faceTextureM, var48) & 0xffff) === arrayAtI32(this.faceVertexB, var47) &&
                        (arrayAtI16(this.faceTextureN, var48) & 0xffff) === arrayAtI32(this.faceVertexC, var47)
                    ) {
                        putByte(this.faceTextureAxis, var47, -1);
                    } else {
                        var46 = true;
                    }
                }
            }

            if (!var46) {
                this.faceTextureAxis = null;
            }
        }

        if (!var3) {
            this.faceMaterial = null;
        }

        if (!var2) {
            this.faceRenderType = null;
        }
    }

    // cb.k()V
    private CalcBoundingCube(): void {
        if (this.boundsCalculated) {
            return;
        }

        this.boundsCalculated = true;
        let var1 = 32767;
        let var2 = 32767;
        let var3 = 32767;
        let var4 = -32768;
        let var5 = -32768;
        let var6 = -32768;

        for (let var7 = 0; var7 < this.numPoints; var7++) {
            const var8 = arrayAtI32(this.pointX, var7);
            const var9 = arrayAtI32(this.pointY, var7);
            const var10 = arrayAtI32(this.pointZ, var7);
            if (var8 < var1) {
                var1 = var8;
            }

            if (var8 > var4) {
                var4 = var8;
            }

            if (var9 < var2) {
                var2 = var9;
            }

            if (var9 > var5) {
                var5 = var9;
            }

            if (var10 < var3) {
                var3 = var10;
            }

            if (var10 > var6) {
                var6 = var10;
            }
        }

        this.minX = (var1 << 16) >> 16;
        this.maxX = (var4 << 16) >> 16;
        this.minY = (var2 << 16) >> 16;
        this.maxY = (var5 << 16) >> 16;
        this.minZ = (var3 << 16) >> 16;
        this.maxZ = (var6 << 16) >> 16;
    }

    // cb.l()V
    // Nulls ModelUnlit's own statics (applet shutdown), so it is ported rather than treated as an artifact.
    static unload(): void {
        ModelUnlit.shareMap = null;
        ModelUnlit.shareMap2 = null;
        ModelUnlit.sin = null;
        ModelUnlit.cos = null;
    }

    // cb.b(SS)V
    Recolour(var1: number, var2: number): void {
        for (let var3 = 0; var3 < this.numFaces; var3++) {
            if (arrayAtI16(this.faceColour, var3) === var1) {
                arrayPutI16(this.faceColour, var3, var2);
            }
        }
    }

    // cb.a(Lcb;IS)I (NXT AddPoint(ModelUnlitImpl&, int); suffixed because TS has no overloads by signature)
    // Adds vertex var2 of var1 unless this model already has a vertex at the same position, ORs the part bit var3
    // into it, and returns its index.
    private AddPointFromModel(var1: ModelUnlit, var2: number, var3: number, points?: MergePointIndex): number {
        const var4 = arrayAtI32(var1.pointX, var2);
        const var5 = arrayAtI32(var1.pointY, var2);
        const var6 = arrayAtI32(var1.pointZ, var2);

        let match = -1;
        let bucket = 0;
        if (points) {
            const hash = Math.imul(var4, 73856093) ^ Math.imul(var5, 19349663) ^ Math.imul(var6, 83492791);
            bucket = (hash ^ (hash >>> 16)) & (points.heads.length - 1);
            for (let p = points.heads[bucket] - 1; p >= 0; p = points.next[p] - 1) {
                if (var4 === arrayAtI32(this.pointX, p) && var5 === arrayAtI32(this.pointY, p) && var6 === arrayAtI32(this.pointZ, p)) {
                    match = p;
                    break;
                }
            }
        } else {
            // cb.a / HD gb.a compare X at every vertex before loading either Y or Z.
            const pointX = this.numPoints > 0 ? this.pointX : null;
            const validX = pointX !== null && pointX.length >= this.numPoints;
            for (let p = 0; p < this.numPoints; p++) {
                if (var4 === (validX ? pointX[p] : arrayAtI32(this.pointX, p)) && var5 === arrayAtI32(this.pointY, p) && var6 === arrayAtI32(this.pointZ, p)) {
                    match = p;
                    break;
                }
            }
        }
        if (match >= 0) {
            arrayPutI16(this.pointPartMask, match, arrayAtI16(this.pointPartMask, match) | var3);
            return match;
        }

        arrayPutI32(this.pointX, this.numPoints, var4);
        arrayPutI32(this.pointY, this.numPoints, var5);
        arrayPutI32(this.pointZ, this.numPoints, var6);
        arrayPutI16(this.pointPartMask, this.numPoints, var3);
        if (var1.vertexLabel !== null) {
            arrayPutI32(this.vertexLabel, this.numPoints, arrayAtI32(var1.vertexLabel, var2));
        }

        // return this.s++;
        const previous = this.numPoints;
        this.numPoints = (previous + 1) | 0;
        if (points) {
            points.next[previous] = points.heads[bucket];
            points.heads[bucket] = previous + 1;
        }
        return previous;
    }

    // cb.c(III)V
    Translate(var1: number, var2: number, var3: number): void {
        for (let var4 = 0; var4 < this.numPoints; var4++) {
            arrayPutI32(this.pointX, var4, (arrayAtI32(this.pointX, var4) + var1) | 0);
            arrayPutI32(this.pointY, var4, (arrayAtI32(this.pointY, var4) + var2) | 0);
            arrayPutI32(this.pointZ, var4, (arrayAtI32(this.pointZ, var4) + var3) | 0);
        }

        this.GeometryChanged();
    }

    // cb.d(III)V
    // Rotates by var3 in the x/y plane (roll), then var1 in the y/z plane (pitch), then var2 in the x/z plane (yaw).
    // Unlike the single-axis rotations it keeps the normals and bounds.
    rotate(var1: number, var2: number, var3: number): void {
        if (var3 !== 0) {
            const var4 = arrayAtI32(ModelUnlit.sin, var3);
            const var5 = arrayAtI32(ModelUnlit.cos, var3);

            for (let var6 = 0; var6 < this.numPoints; var6++) {
                const var7 = (Math.imul(arrayAtI32(this.pointY, var6), var4) + Math.imul(arrayAtI32(this.pointX, var6), var5)) >> 16;
                arrayPutI32(this.pointY, var6, (Math.imul(arrayAtI32(this.pointY, var6), var5) - Math.imul(arrayAtI32(this.pointX, var6), var4)) >> 16);
                arrayPutI32(this.pointX, var6, var7);
            }
        }

        if (var1 !== 0) {
            const var8 = arrayAtI32(ModelUnlit.sin, var1);
            const var10 = arrayAtI32(ModelUnlit.cos, var1);

            for (let var12 = 0; var12 < this.numPoints; var12++) {
                const var14 = (Math.imul(arrayAtI32(this.pointY, var12), var10) - Math.imul(arrayAtI32(this.pointZ, var12), var8)) >> 16;
                arrayPutI32(this.pointZ, var12, (Math.imul(arrayAtI32(this.pointY, var12), var8) + Math.imul(arrayAtI32(this.pointZ, var12), var10)) >> 16);
                arrayPutI32(this.pointY, var12, var14);
            }
        }

        if (var2 !== 0) {
            const var9 = arrayAtI32(ModelUnlit.sin, var2);
            const var11 = arrayAtI32(ModelUnlit.cos, var2);

            for (let var13 = 0; var13 < this.numPoints; var13++) {
                const var15 = (Math.imul(arrayAtI32(this.pointZ, var13), var9) + Math.imul(arrayAtI32(this.pointX, var13), var11)) >> 16;
                arrayPutI32(this.pointZ, var13, (Math.imul(arrayAtI32(this.pointZ, var13), var11) - Math.imul(arrayAtI32(this.pointX, var13), var9)) >> 16);
                arrayPutI32(this.pointX, var13, var15);
            }
        }
    }

    // cb.c(IIIII)Lfc; (NXT Light; suffixed because b(IIIII)Lnd; already takes the name)
    // var1 = ambient, var2 = contrast, (var3, var4, var5) = light vector.
    LightImpl(var1: number, var2: number, var3: number, var4: number, var5: number): ModelLitImpl {
        return new ModelLitImpl(this, var1, var2, var3, var4, var5);
    }

    // cb.m()V
    // Groups the vertex labels into labelVertices and the face labels into labelFaces, then drops the per-element labels.
    PrepareAnim(): void {
        if (this.vertexLabel !== null) {
            const var1 = new Int32Array(256);
            let var2 = 0;

            for (let var3 = 0; var3 < this.numPoints; var3++) {
                const var4 = arrayAtI32(this.vertexLabel, var3);
                arrayPutI32(var1, var4, (arrayAtI32(var1, var4) + 1) | 0);
                if (var4 > var2) {
                    var2 = var4;
                }
            }

            this.labelVertices = new Array<Int32Array | null>((var2 + 1) | 0).fill(null);

            for (let var10 = 0; var10 <= var2; var10++) {
                // var10 <= var2 <= 255, a label the first loop already indexed var1 with.
                arrayPutObj(this.labelVertices, var10, new Int32Array(var1[var10]));
                var1[var10] = 0;
            }

            for (let var5 = 0; var5 < this.numPoints; var5++) {
                const var6 = arrayAtI32(this.vertexLabel, var5);
                // M[var6][var1[var6]++] = var5. var6 indexed var1 in the first loop, so var1[var6] is in range.
                arrayPutI32(arrayAtObj(this.labelVertices, var6), var1[var6]++, var5);
            }

            this.vertexLabel = null;
        }

        if (this.faceLabel !== null) {
            const var7 = new Int32Array(256);
            let var8 = 0;

            for (let var9 = 0; var9 < this.numFaces; var9++) {
                const var11 = arrayAtI32(this.faceLabel, var9);
                arrayPutI32(var7, var11, (arrayAtI32(var7, var11) + 1) | 0);
                if (var11 > var8) {
                    var8 = var11;
                }
            }

            this.labelFaces = new Array<Int32Array | null>((var8 + 1) | 0).fill(null);

            for (let var12 = 0; var12 <= var8; var12++) {
                arrayPutObj(this.labelFaces, var12, new Int32Array(var7[var12]));
                var7[var12] = 0;
            }

            for (let var13 = 0; var13 < this.numFaces; var13++) {
                const var14 = arrayAtI32(this.faceLabel, var13);
                arrayPutI32(arrayAtObj(this.labelFaces, var14), var7[var14]++, var13);
            }

            this.faceLabel = null;
        }
    }

    // cb.b(I)V
    // Rotates in the y/z plane (pitch).
    private RotateXAxis(var1: number): void {
        const var2 = arrayAtI32(ModelUnlit.sin, var1);
        const var3 = arrayAtI32(ModelUnlit.cos, var1);

        for (let var4 = 0; var4 < this.numPoints; var4++) {
            const var5 = (Math.imul(arrayAtI32(this.pointY, var4), var3) - Math.imul(arrayAtI32(this.pointZ, var4), var2)) >> 16;
            arrayPutI32(this.pointZ, var4, (Math.imul(arrayAtI32(this.pointY, var4), var2) + Math.imul(arrayAtI32(this.pointZ, var4), var3)) >> 16);
            arrayPutI32(this.pointY, var4, var5);
        }

        this.GeometryChanged();
    }

    // cb.a(IIIIIIIIJILue;)V. Empty: an unlit model is lit (light) before the scene draws it.
    override draw(_var1: number, _var2: number, _var3: number, _var4: number, _var5: number, _var6: number, _var7: number, _var8: number, _var9: bigint, _var11: number, _var12: ParticleSystem | null): void {}

    // cb.e(III)I (NXT AddPoint(int, int, int))
    // Returns the index of the vertex at (var1, var2, var3), adding it if this model has none there.
    AddPoint(var1: number, var2: number, var3: number): number {
        for (let var4 = 0; var4 < this.numPoints; var4++) {
            if (arrayAtI32(this.pointX, var4) === var1 && arrayAtI32(this.pointY, var4) === var2 && arrayAtI32(this.pointZ, var4) === var3) {
                return var4;
            }
        }

        arrayPutI32(this.pointX, this.numPoints, var1);
        arrayPutI32(this.pointY, this.numPoints, var2);
        arrayPutI32(this.pointZ, this.numPoints, var3);
        // return this.s++;
        const previous = this.numPoints;
        this.numPoints = (previous + 1) | 0;
        return previous;
    }

    // cb.b([B)V
    // The extended format (trailing 0xFF 0xFF): texture-axis types, a separate material section and the optional
    // particle/billboard counts at the end. Locals are named after the bytecode slots.
    private LoadOb3Engine200(var1: Uint8Array | null): void {
        const var2 = new PacketT(var1);
        const var3 = new PacketT(var1);
        const var4 = new PacketT(var1);
        const var5 = new PacketT(var1);
        const var6 = new PacketT(var1);
        const var7 = new PacketT(var1);
        const var8 = new PacketT(var1);
        var2.m_pos = (requireNonNull(var1).length - 23) | 0;
        const var9 = var2.g2();
        const var10 = var2.g2();
        const var11 = var2.g1();
        const var12 = var2.g1();
        const var13 = (var12 & 1) === 1;
        const var14 = (var12 & 2) === 2;
        const var15 = var2.g1();
        const var16 = var2.g1();
        const var17 = var2.g1();
        const var18 = var2.g1();
        const var19 = var2.g1();
        const var20 = var2.g2();
        const var21 = var2.g2();
        const var22 = var2.g2();
        const var23 = var2.g2();
        const var24 = var2.g2();
        let var25 = 0;
        let var26 = 0;
        let var27 = 0;
        if (var11 > 0) {
            this.textureType = new Uint8Array(var11);
            var2.m_pos = 0;

            for (let var28 = 0; var28 < var11; var28++) {
                let var29: number;
                putByte(this.textureType, var28, (var29 = var2.g1s()));
                if (var29 === 0) {
                    var25++;
                }

                if (var29 >= 1 && var29 <= 3) {
                    var26++;
                }

                if (var29 === 2) {
                    var27++;
                }
            }
        }

        let var28 = var11;
        const var29 = var28;
        var28 = (var28 + var9) | 0;
        const var30 = var28;
        if (var13) {
            var28 = (var28 + var10) | 0;
        }

        const var31 = var28;
        var28 = (var28 + var10) | 0;
        const var32 = var28;
        if (var15 === 255) {
            var28 = (var28 + var10) | 0;
        }

        const var33 = var28;
        if (var17 === 1) {
            var28 = (var28 + var10) | 0;
        }

        const var34 = var28;
        if (var19 === 1) {
            var28 = (var28 + var9) | 0;
        }

        const var35 = var28;
        if (var16 === 1) {
            var28 = (var28 + var10) | 0;
        }

        const var36 = var28;
        var28 = (var28 + var23) | 0;
        const var37 = var28;
        if (var18 === 1) {
            var28 = (var28 + Math.imul(var10, 2)) | 0;
        }

        const var38 = var28;
        var28 = (var28 + var24) | 0;
        const var39 = var28;
        var28 = (var28 + Math.imul(var10, 2)) | 0;
        const var40 = var28;
        var28 = (var28 + var20) | 0;
        const var41 = var28;
        var28 = (var28 + var21) | 0;
        const var42 = var28;
        var28 = (var28 + var22) | 0;
        const var43 = var28;
        var28 = (var28 + Math.imul(var25, 6)) | 0;
        const var44 = var28;
        var28 = (var28 + Math.imul(var26, 6)) | 0;
        const var45 = var28;
        var28 = (var28 + Math.imul(var26, 6)) | 0;
        const var46 = var28;
        var28 = (var28 + var26) | 0;
        const var47 = var28;
        var28 = (var28 + var26) | 0;
        const var48 = var28;
        var28 = (var28 + ((var26 + Math.imul(var27, 2)) | 0)) | 0;
        const var49 = var28;
        this.numPoints = var9;
        this.numFaces = var10;
        this.numT = var11;
        this.pointX = new Int32Array(var9);
        this.pointY = new Int32Array(var9);
        this.pointZ = new Int32Array(var9);
        this.faceVertexA = new Int32Array(var10);
        this.faceVertexB = new Int32Array(var10);
        this.faceVertexC = new Int32Array(var10);
        if (var19 === 1) {
            this.vertexLabel = new Int32Array(var9);
        }

        if (var13) {
            this.faceRenderType = new Uint8Array(var10);
        }

        if (var15 === 255) {
            this.facePriority = new Uint8Array(var10);
        } else {
            this.priority = (var15 << 24) >> 24;
        }

        if (var16 === 1) {
            this.faceAlpha = new Uint8Array(var10);
        }

        if (var17 === 1) {
            this.faceLabel = new Int32Array(var10);
        }

        if (var18 === 1) {
            this.faceMaterial = new Int16Array(var10);
        }

        if (var18 === 1 && var11 > 0) {
            this.faceTextureAxis = new Uint8Array(var10);
        }

        this.faceColour = new Int16Array(var10);
        if (var11 > 0) {
            this.faceTextureP = new Int16Array(var11);
            this.faceTextureM = new Int16Array(var11);
            this.faceTextureN = new Int16Array(var11);
            if (var26 > 0) {
                this.textureScaleX = new Int16Array(var26);
                this.textureScaleY = new Int16Array(var26);
                this.textureScaleZ = new Int16Array(var26);
                this.textureRotation = new Uint8Array(var26);
                this.textureDirection = new Uint8Array(var26);
                this.textureSpeed = new Uint8Array(var26);
            }

            if (var27 > 0) {
                this.textureTransU = new Uint8Array(var27);
                this.textureTransV = new Uint8Array(var27);
            }
        }

        var2.m_pos = var29;
        var3.m_pos = var40;
        var4.m_pos = var41;
        var5.m_pos = var42;
        var6.m_pos = var34;
        let var50 = 0;
        let var51 = 0;
        let var52 = 0;

        for (let var53 = 0; var53 < var9; var53++) {
            const var54 = var2.g1();
            let var55 = 0;
            if ((var54 & 1) !== 0) {
                var55 = var3.gSmart1or2s();
            }

            let var56 = 0;
            if ((var54 & 2) !== 0) {
                var56 = var4.gSmart1or2s();
            }

            let var57 = 0;
            if ((var54 & 4) !== 0) {
                var57 = var5.gSmart1or2s();
            }

            arrayPutI32(this.pointX, var53, (var50 + var55) | 0);
            arrayPutI32(this.pointY, var53, (var51 + var56) | 0);
            arrayPutI32(this.pointZ, var53, (var52 + var57) | 0);
            var50 = arrayAtI32(this.pointX, var53);
            var51 = arrayAtI32(this.pointY, var53);
            var52 = arrayAtI32(this.pointZ, var53);
            if (var19 === 1) {
                arrayPutI32(this.vertexLabel, var53, var6.g1());
            }
        }

        var2.m_pos = var39;
        var3.m_pos = var30;
        var4.m_pos = var32;
        var5.m_pos = var35;
        var6.m_pos = var33;
        var7.m_pos = var37;
        var8.m_pos = var38;

        for (let var54 = 0; var54 < var10; var54++) {
            // (short) g2: the Int16Array store truncates.
            arrayPutI16(this.faceColour, var54, var2.g2());
            if (var13) {
                putByte(this.faceRenderType, var54, var3.g1s());
            }

            if (var15 === 255) {
                putByte(this.facePriority, var54, var4.g1s());
            }

            if (var16 === 1) {
                putByte(this.faceAlpha, var54, var5.g1s());
            }

            if (var17 === 1) {
                arrayPutI32(this.faceLabel, var54, var6.g1());
            }

            if (var18 === 1) {
                arrayPutI16(this.faceMaterial, var54, (var7.g2() - 1) | 0);
            }

            if (this.faceTextureAxis !== null) {
                if (arrayAtI16(this.faceMaterial, var54) !== -1) {
                    putByte(this.faceTextureAxis, var54, (var8.g1() - 1) | 0);
                } else {
                    putByte(this.faceTextureAxis, var54, -1);
                }
            }
        }

        var2.m_pos = var36;
        var3.m_pos = var31;
        let var55 = 0;
        let var56 = 0;
        let var57 = 0;
        let var58 = 0;

        for (let var59 = 0; var59 < var10; var59++) {
            const var60 = var3.g1();
            if (var60 === 1) {
                var55 = (var2.gSmart1or2s() + var58) | 0;
                var58 = var55;
                var56 = (var2.gSmart1or2s() + var58) | 0;
                var58 = var56;
                var57 = (var2.gSmart1or2s() + var58) | 0;
                var58 = var57;
                arrayPutI32(this.faceVertexA, var59, var55);
                arrayPutI32(this.faceVertexB, var59, var56);
                arrayPutI32(this.faceVertexC, var59, var57);
            }

            if (var60 === 2) {
                var56 = var57;
                var57 = (var2.gSmart1or2s() + var58) | 0;
                var58 = var57;
                arrayPutI32(this.faceVertexA, var59, var55);
                arrayPutI32(this.faceVertexB, var59, var56);
                arrayPutI32(this.faceVertexC, var59, var57);
            }

            if (var60 === 3) {
                var55 = var57;
                var57 = (var2.gSmart1or2s() + var58) | 0;
                var58 = var57;
                arrayPutI32(this.faceVertexA, var59, var55);
                arrayPutI32(this.faceVertexB, var59, var56);
                arrayPutI32(this.faceVertexC, var59, var57);
            }

            if (var60 === 4) {
                const var61 = var55;
                var55 = var56;
                var56 = var61;
                var57 = (var2.gSmart1or2s() + var58) | 0;
                var58 = var57;
                arrayPutI32(this.faceVertexA, var59, var55);
                arrayPutI32(this.faceVertexB, var59, var56);
                arrayPutI32(this.faceVertexC, var59, var57);
            }
        }

        var2.m_pos = var43;
        var3.m_pos = var44;
        var4.m_pos = var45;
        var5.m_pos = var46;
        var6.m_pos = var47;
        var7.m_pos = var48;

        // The scaled-type arrays are sized by the count of types 1..3 (var26) and the trans arrays by the count of type
        // 2 (var27) but indexed by the texture-axis index, as in the jar; arrayPut throws where the JVM would.
        for (let var60 = 0; var60 < var11; var60++) {
            const var61 = byteAt(this.textureType, var60) & 255;
            if (var61 === 0) {
                arrayPutI16(this.faceTextureP, var60, var2.g2());
                arrayPutI16(this.faceTextureM, var60, var2.g2());
                arrayPutI16(this.faceTextureN, var60, var2.g2());
            }

            if (var61 === 1) {
                arrayPutI16(this.faceTextureP, var60, var3.g2());
                arrayPutI16(this.faceTextureM, var60, var3.g2());
                arrayPutI16(this.faceTextureN, var60, var3.g2());
                arrayPutI16(this.textureScaleX, var60, var4.g2());
                arrayPutI16(this.textureScaleY, var60, var4.g2());
                arrayPutI16(this.textureScaleZ, var60, var4.g2());
                putByte(this.textureRotation, var60, var5.g1s());
                putByte(this.textureDirection, var60, var6.g1s());
                putByte(this.textureSpeed, var60, var7.g1s());
            }

            if (var61 === 2) {
                arrayPutI16(this.faceTextureP, var60, var3.g2());
                arrayPutI16(this.faceTextureM, var60, var3.g2());
                arrayPutI16(this.faceTextureN, var60, var3.g2());
                arrayPutI16(this.textureScaleX, var60, var4.g2());
                arrayPutI16(this.textureScaleY, var60, var4.g2());
                arrayPutI16(this.textureScaleZ, var60, var4.g2());
                putByte(this.textureRotation, var60, var5.g1s());
                putByte(this.textureDirection, var60, var6.g1s());
                putByte(this.textureSpeed, var60, var7.g1s());
                putByte(this.textureTransU, var60, var7.g1s());
                putByte(this.textureTransV, var60, var7.g1s());
            }

            if (var61 === 3) {
                arrayPutI16(this.faceTextureP, var60, var3.g2());
                arrayPutI16(this.faceTextureM, var60, var3.g2());
                arrayPutI16(this.faceTextureN, var60, var3.g2());
                arrayPutI16(this.textureScaleX, var60, var4.g2());
                arrayPutI16(this.textureScaleY, var60, var4.g2());
                arrayPutI16(this.textureScaleZ, var60, var4.g2());
                putByte(this.textureRotation, var60, var5.g1s());
                putByte(this.textureDirection, var60, var6.g1s());
                putByte(this.textureSpeed, var60, var7.g1s());
            }
        }

        if (var14) {
            var2.m_pos = var49;
            const var61 = var2.g1();
            if (var61 > 0) {
                var2.m_pos = (var2.m_pos + Math.imul(4, var61)) | 0;
            }

            const var62 = var2.g1();
            if (var62 > 0) {
                var2.m_pos = (var2.m_pos + Math.imul(4, var62)) | 0;
            }
        }
    }

    // cb.c(I)V
    // Rotates in the x/y plane (roll).
    private rotateZAxis(var1: number): void {
        const var2 = arrayAtI32(ModelUnlit.sin, var1);
        const var3 = arrayAtI32(ModelUnlit.cos, var1);

        for (let var4 = 0; var4 < this.numPoints; var4++) {
            const var5 = (Math.imul(arrayAtI32(this.pointY, var4), var2) + Math.imul(arrayAtI32(this.pointX, var4), var3)) >> 16;
            arrayPutI32(this.pointY, var4, (Math.imul(arrayAtI32(this.pointY, var4), var3) - Math.imul(arrayAtI32(this.pointX, var4), var2)) >> 16);
            arrayPutI32(this.pointX, var4, var5);
        }

        this.GeometryChanged();
    }
}
