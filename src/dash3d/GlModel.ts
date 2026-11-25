import ModelLit from './ModelLit';
import type ModelUnlit from './ModelUnlit';
import ModelLitImpl from './ModelLitImpl';
import type ModelSource from './ModelSource';
import type PointNormal from './PointNormal';
import type FaceNormal from './FaceNormal';
import type ParticleSystem from './ParticleSystem';
import Pix3D from './Pix3D';
import Pix8 from '#/graphics/Pix8';
import GlModelStream from './GlModelStream';
import GlModelBounds from './GlModelBounds';
import GlModelNormals from './GlModelNormals';
import GlBuffer from '#/gl/GlBuffer';
import GlLighting from '#/gl/GlLighting';
import GlRenderer from '#/gl/GlRenderer';
import MaterialManager from '#/gl/material/MaterialManager';
import type { HdTextureProvider } from './TextureProvider';
import { GL } from '#/jogl/GL';
import { floatBits } from '#/gl/GlTrace';
import Preferences from '#/ui/Preferences';
import PacketT from '#/io/PacketT';
import ByteBuffer from '#/util/nio/ByteBuffer';
import ArrayUtils from '#/util/ArrayUtils';
import { intDivide } from '#/util/IntUtils';
import { arrayAtB64, arrayAtF32, arrayAtI16, arrayAtI32, arrayAtObj, arrayAtU8, arrayPutB64, arrayPutF32, arrayPutI16, arrayPutI32, arrayPutObj, arrayPutU8, floatWords, requireNonNull } from '#/util/JavaArray';

const geometryPacketViews = new WeakMap<Uint8Array, DataView>();

function geometryPacketView(bytes: Uint8Array): DataView {
    let view = geometryPacketViews.get(bytes);
    if (!view) {
        view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        geometryPacketViews.set(bytes, view);
    }
    return view;
}

// JOGL takes longs for VBO byte offsets. A packed vertex contributes at most 28 bytes
// before the final stream, and the same short face runs recur across model draws.
const streamByteOffsets = Array.from({ length: 29 }, (_, offset) => BigInt(offset));
const faceRunByteOffsets = Array.from({ length: 512 }, (_, face) => BigInt(face * 12));

function streamByteOffset(offset: number): bigint {
    return streamByteOffsets[offset] ?? BigInt(offset);
}

// On the original x86 JVM a degenerate planar texture basis produces an indefinite binary32 NaN
// (0xffc00000) at fmul. A JS number can canonicalize its sign. Preserve the word through fastore.
const indefiniteUv = { bits: 0xffc00000 } as const;
type ModelUv = number | typeof indefiniteUv;

function planarUv(value: number): ModelUv {
    return Number.isNaN(value) ? indefiniteUv : value;
}

function putUv(array: Float32Array | null, index: number, value: ModelUv): void {
    if (typeof value !== 'number') arrayPutI32(floatWords(array), index, value.bits);
    else if (Number.isNaN(value)) arrayPutI32(floatWords(array), index, 0x7fc00000);
    else arrayPutF32(array, index, value);
}

// Java's int[] element postfix increment returns the value preceding the store.
function incrementIndex(array: Int32Array | null, index: number): number {
    const old = arrayAtI32(array, index);
    arrayPutI32(array, index, (old + 1) | 0);
    return old;
}

// HD nk.a(Z[J[I)V / gj.a([JII[II)V. Keep the parallel original face indices under the signed 64-bit sort keys.
function sortFaces(keys: BigInt64Array, faces: Int32Array, lo = 0, hi = keys.length - 1): void {
    if (lo >= hi) return;
    let dst = lo;
    const mid = (((hi + lo) | 0) / 2) | 0;
    const pivot = arrayAtB64(keys, mid);
    arrayPutB64(keys, mid, arrayAtB64(keys, hi));
    arrayPutB64(keys, hi, pivot);
    const face = arrayAtI32(faces, mid);
    arrayPutI32(faces, mid, arrayAtI32(faces, hi));
    arrayPutI32(faces, hi, face);
    for (let i = lo; i < hi; i++) {
        if (arrayAtB64(keys, i) >= BigInt.asIntN(64, pivot + BigInt(i & 1))) continue;
        const key = arrayAtB64(keys, i);
        arrayPutB64(keys, i, arrayAtB64(keys, dst));
        arrayPutB64(keys, dst, key);
        const original = arrayAtI32(faces, i);
        arrayPutI32(faces, i, arrayAtI32(faces, dst));
        arrayPutI32(faces, dst++, original);
    }
    arrayPutB64(keys, hi, arrayAtB64(keys, dst));
    arrayPutB64(keys, dst, pivot);
    arrayPutI32(faces, hi, arrayAtI32(faces, dst));
    arrayPutI32(faces, dst, face);
    sortFaces(keys, faces, lo, dst - 1);
    sortFaces(keys, faces, dst + 1, hi);
}

// HD td extends ak. Geometry, stream layout, per-material index ranges, animations and picking use the original model.
export default class GlModel extends ModelLit {
    faceColour: Int16Array | null = null; // td.t
    shareLight: boolean = false; // td.u
    normalX: Int16Array | null = null; // td.v
    faceVertexA: Int16Array | null = null; // td.w
    dynamicVbo: GlBuffer | null = null; // td.x
    facePartMask: Int16Array | null = null; // td.y
    colourStream: GlModelStream | null = null; // td.z
    normalStream: GlModelStream | null = null; // td.A
    faceAlpha: Uint8Array | null = null; // td.B
    uvStream: GlModelStream | null = null; // td.C
    static packet: PacketT | null = new PacketT(10000); // td.D
    contrast: number = 0; // td.E
    faceLabel: Uint8Array | null = null; // td.F
    static vertexKeys: BigInt64Array | null = null; // td.G
    pointX: Int32Array | null = null; // td.H
    vertexCount: number = 0; // td.I
    texU: Float32Array | null = null; // td.J
    labelVertices: (Int32Array | null)[] | null = null; // td.K
    normalY: Int16Array | null = null; // td.L
    faceMaterial: Int16Array | null = null; // td.M
    vertexIndices: Int16Array | null = null; // td.N
    labelFaces: (Int32Array | null)[] | null = null; // td.O
    faceVertexB: Int16Array | null = null; // td.P
    faceVertexC: Int16Array | null = null; // td.Q
    pointPartMask: Int16Array | null = null; // td.R
    expandedVertexCount: number = 0; // td.S
    static uploadBuffer: ByteBuffer | null = null; // td.T
    bounds: GlModelBounds | null = null; // td.U
    deferredUpdateMask: number = 0; // td.V
    normalZ: Int16Array | null = null; // td.W
    vertexOffsets: Int32Array | null = null; // td.X
    positionStream: GlModelStream | null = null; // td.Y
    materialRuns: Int32Array | null = null; // td.Z
    normalCount: Int16Array | null = null; // td.ab
    static tempActorStorage: GlModel | null = new GlModel(); // td.bb
    savedNormals: GlModelNormals | null = null; // td.cb
    vertexLabel: Int32Array | null = null; // td.db
    pointY: Int32Array | null = null; // td.eb
    indexStream: GlModelStream | null = null; // td.fb
    texV: Float32Array | null = null; // td.gb
    pointZ: Int32Array | null = null; // td.hb
    ambient: number = 0; // td.ib
    static tempActorModel: GlModel | null = new GlModel(); // td.jb
    bufferFlags: number = 0; // td.kb
    faceCount: number = 0; // td.lb
    static tempSpotStorage: GlModel | null = new GlModel(); // td.mb
    static tempSpotModel: GlModel | null = new GlModel(); // td.nb
    static tempLocStorage: GlModel | null = new GlModel(); // td.ob
    static tempLocModel: GlModel | null = new GlModel(); // td.pb
    static shadowX: Int32Array | null = new Int32Array(1); // td.qb
    static boxV: number = 0; // td.rb
    static pivotX: number = 0; // td.sb
    static sphereV: number = 0; // td.tb
    static shadowZ: Int32Array | null = new Int32Array(1); // td.ub
    static pivotZ: number = 0; // td.vb
    static cylinderU: number = 0; // td.wb
    static boxU: number = 0; // td.xb
    static pivotY: number = 0; // td.yb
    static cylinderV: number = 0; // td.zb
    static sphereU: number = 0; // td.Ab
    static transformOrigin: boolean = false; // td.Bb

    // td.<init>()V and td.<init>(Lgb;IIZ)V
    constructor();
    constructor(source: ModelUnlit | null, ambient: number, contrast: number, usePriority: boolean);
    constructor(...args: [] | [ModelUnlit | null, number, number, boolean]) {
        super();
        if (args.length === 0) return;
        const [input, ambient, contrast, usePriority] = args;
        const source = requireNonNull(input);
        const sourceFaces = new Int32Array(source.numFaces);
        this.vertexOffsets = new Int32Array((source.numPoints + 1) | 0);
        for (let var6: number = 0; var6 < source.numFaces; var6++) {
            if (
                (source.faceRenderType === null || (arrayAtU8(source.faceRenderType, var6) << 24) >> 24 !== 2) &&
                (source.faceMaterial === null || arrayAtI16(source.faceMaterial, var6) === -1 || !requireNonNull(Pix3D.textureProvider as HdTextureProvider | null).hasFlag4(arrayAtI16(source.faceMaterial, var6) & 65535))
            ) {
                arrayPutI32(sourceFaces, this.faceCount++, var6);
                incrementIndex(this.vertexOffsets, arrayAtI32(source.faceVertexA, var6));
                incrementIndex(this.vertexOffsets, arrayAtI32(source.faceVertexB, var6));
                incrementIndex(this.vertexOffsets, arrayAtI32(source.faceVertexC, var6));
            }
        }
        const sortKeys = new BigInt64Array(this.faceCount);
        for (let var7: number = 0; var7 < this.faceCount; var7++) {
            const var8: number = arrayAtI32(sourceFaces, var7);
            let var9: number = 0;
            let var10: number = 0;
            let var11: number = 0;
            let var12: number = 0;
            let var13: number = -1 | 0;
            if (source.faceMaterial !== null) {
                var13 = arrayAtI16(source.faceMaterial, var8);
                if (var13 !== -1) {
                    var11 = requireNonNull(Pix3D.textureProvider as HdTextureProvider | null).materialType(var13 & 65535);
                    var12 = requireNonNull(Pix3D.textureProvider as HdTextureProvider | null).materialArgument(var13 & 65535);
                }
            }
            const var14: boolean = (source.faceAlpha !== null && (arrayAtU8(source.faceAlpha, var8) << 24) >> 24 !== 0) || (var13 !== -1 && !requireNonNull(Pix3D.textureProvider as HdTextureProvider | null).getTextureSolid(var13 & 65535));
            if ((usePriority || var14) && source.facePriority !== null) {
                var9 = (var9 + (((arrayAtU8(source.facePriority, var8) << 24) >> 24) << 17)) | 0;
            }
            if (var14) {
                var9 = (var9 + 65536) | 0;
            }
            var9 = (var9 + ((var11 & 255) << 8)) | 0;
            var9 = (var9 + (var12 & 255)) | 0;
            var10 = (var10 + ((var13 & 65535) << 16)) | 0;
            var10 = (var10 + (var7 & 65535)) | 0;
            arrayPutB64(sortKeys, var7, BigInt.asIntN(64, BigInt.asIntN(64, BigInt(var9) << BigInt(32)) + BigInt(var10)));
        }
        sortFaces(sortKeys, sourceFaces);
        this.vertexCount = source.numPoints;
        this.pointX = source.pointX;
        this.pointY = source.pointY;
        this.pointZ = source.pointZ;
        this.vertexLabel = source.vertexLabel;
        this.pointPartMask = source.pointPartMask;
        const maxExpandedVertices = Math.imul(this.faceCount, 3);
        this.normalX = new Int16Array(maxExpandedVertices);
        this.normalY = new Int16Array(maxExpandedVertices);
        this.normalZ = new Int16Array(maxExpandedVertices);
        this.normalCount = new Int16Array(maxExpandedVertices);
        this.texU = new Float32Array(maxExpandedVertices);
        this.texV = new Float32Array(maxExpandedVertices);
        this.faceColour = new Int16Array(this.faceCount);
        this.faceAlpha = new Uint8Array(this.faceCount);
        this.faceVertexA = new Int16Array(this.faceCount);
        this.faceVertexB = new Int16Array(this.faceCount);
        this.faceVertexC = new Int16Array(this.faceCount);
        this.faceMaterial = new Int16Array(this.faceCount);
        if (source.faceLabel !== null) {
            this.faceLabel = new Uint8Array(this.faceCount);
        }
        if (source.facePartMask !== null) {
            this.facePartMask = new Int16Array(this.faceCount);
        }
        this.bounds = new GlModelBounds();
        this.positionStream = new GlModelStream();
        this.colourStream = new GlModelStream();
        if (Preferences.graphics.highDetailLighting) {
            this.normalStream = new GlModelStream();
        }
        this.uvStream = new GlModelStream();
        this.indexStream = new GlModelStream();
        this.ambient = (ambient << 16) >> 16;
        this.contrast = (contrast << 16) >> 16;
        this.vertexIndices = new Int16Array(maxExpandedVertices);
        GlModel.vertexKeys = new BigInt64Array(maxExpandedVertices);
        let var62: number = 0;
        for (let var65: number = 0; var65 < source.numPoints; var65++) {
            const var69: number = arrayAtI32(this.vertexOffsets, var65);
            arrayPutI32(this.vertexOffsets, var65, var62);
            var62 = (var62 + var69) | 0;
        }
        arrayPutI32(this.vertexOffsets, source.numPoints, var62);
        let var66: Int32Array | null = null;
        let var70: Int32Array | null = null;
        let var71: Int32Array | null = null;
        let var72: (Float32Array | null)[] | null = null;
        if (source.faceTextureAxis !== null) {
            const var73: number = source.numT;
            const var77: Int32Array | null = new Int32Array(var73);
            const var15: Int32Array | null = new Int32Array(var73);
            const var16: Int32Array | null = new Int32Array(var73);
            const var17: Int32Array | null = new Int32Array(var73);
            const var18: Int32Array | null = new Int32Array(var73);
            const var19: Int32Array | null = new Int32Array(var73);
            for (let var20: number = 0; var20 < var73; var20++) {
                arrayPutI32(var77, var20, 2147483647);
                arrayPutI32(var15, var20, -2147483647 | 0);
                arrayPutI32(var16, var20, 2147483647);
                arrayPutI32(var17, var20, -2147483647 | 0);
                arrayPutI32(var18, var20, 2147483647);
                arrayPutI32(var19, var20, -2147483647 | 0);
            }
            for (let var90: number = 0; var90 < this.faceCount; var90++) {
                const var21: number = arrayAtI32(sourceFaces, var90);
                if ((arrayAtU8(source.faceTextureAxis, var21) << 24) >> 24 !== -1) {
                    const var22: number = ((arrayAtU8(source.faceTextureAxis, var21) << 24) >> 24) & 255;
                    for (let var23: number = 0; var23 < 3; var23++) {
                        let var24: number;
                        if (var23 === 0) {
                            var24 = arrayAtI32(source.faceVertexA, var21);
                        } else {
                            if (var23 === 1) {
                                var24 = arrayAtI32(source.faceVertexB, var21);
                            } else {
                                var24 = arrayAtI32(source.faceVertexC, var21);
                            }
                        }
                        const var25: number = arrayAtI32(source.pointX, var24);
                        const var26: number = arrayAtI32(source.pointY, var24);
                        const var27: number = arrayAtI32(source.pointZ, var24);
                        if (var25 < arrayAtI32(var77, var22)) {
                            arrayPutI32(var77, var22, var25);
                        }
                        if (var25 > arrayAtI32(var15, var22)) {
                            arrayPutI32(var15, var22, var25);
                        }
                        if (var26 < arrayAtI32(var16, var22)) {
                            arrayPutI32(var16, var22, var26);
                        }
                        if (var26 > arrayAtI32(var17, var22)) {
                            arrayPutI32(var17, var22, var26);
                        }
                        if (var27 < arrayAtI32(var18, var22)) {
                            arrayPutI32(var18, var22, var27);
                        }
                        if (var27 > arrayAtI32(var19, var22)) {
                            arrayPutI32(var19, var22, var27);
                        }
                    }
                }
            }
            var66 = new Int32Array(var73);
            var70 = new Int32Array(var73);
            var71 = new Int32Array(var73);
            var72 = new Array<Float32Array | null>(var73).fill(null);
            for (let var91: number = 0; var91 < var73; var91++) {
                const var93: number = (arrayAtU8(source.textureType, var91) << 24) >> 24;
                if (var93 > 0) {
                    arrayPutI32(var66, var91, intDivide((arrayAtI32(var77, var91) + arrayAtI32(var15, var91)) | 0, 2));
                    arrayPutI32(var70, var91, intDivide((arrayAtI32(var16, var91) + arrayAtI32(var17, var91)) | 0, 2));
                    arrayPutI32(var71, var91, intDivide((arrayAtI32(var18, var91) + arrayAtI32(var19, var91)) | 0, 2));
                    let var95: number;
                    let var97: number;
                    let var99: number;
                    if (var93 === 1) {
                        const var101: number = arrayAtI16(source.textureScaleX, var91);
                        if (var101 === 0) {
                            var95 = Math.fround(1.0);
                            var99 = Math.fround(1.0);
                        } else {
                            if (var101 > 0) {
                                var95 = Math.fround(1.0);
                                var99 = Math.fround(var101 / Math.fround(1024.0));
                            } else {
                                var99 = Math.fround(1.0);
                                var95 = Math.fround(-var101 / Math.fround(1024.0));
                            }
                        }
                        var97 = Math.fround(Math.fround(64.0) / Math.fround(arrayAtI16(source.textureScaleY, var91) & 65535));
                    } else {
                        if (var93 === 2) {
                            var95 = Math.fround(Math.fround(64.0) / Math.fround(arrayAtI16(source.textureScaleX, var91) & 65535));
                            var97 = Math.fround(Math.fround(64.0) / Math.fround(arrayAtI16(source.textureScaleY, var91) & 65535));
                            var99 = Math.fround(Math.fround(64.0) / Math.fround(arrayAtI16(source.textureScaleZ, var91) & 65535));
                        } else {
                            var95 = Math.fround(arrayAtI16(source.textureScaleX, var91) / Math.fround(1024.0));
                            var97 = Math.fround(arrayAtI16(source.textureScaleY, var91) / Math.fround(1024.0));
                            var99 = Math.fround(arrayAtI16(source.textureScaleZ, var91) / Math.fround(1024.0));
                        }
                    }
                    arrayPutObj(
                        var72,
                        var91,
                        GlModel.textureBasis(arrayAtI16(source.faceTextureP, var91), arrayAtI16(source.faceTextureM, var91), arrayAtI16(source.faceTextureN, var91), ((arrayAtU8(source.textureRotation, var91) << 24) >> 24) & 255, var95, var97, var99)
                    );
                }
            }
        }
        for (let var74: number = 0; var74 < this.faceCount; var74++) {
            const var78: number = arrayAtI32(sourceFaces, var74);
            const var81: number = arrayAtI16(source.faceColour, var78) & 65535;
            let var84: number;
            if (source.faceMaterial === null) {
                var84 = -1 | 0;
            } else {
                var84 = arrayAtI16(source.faceMaterial, var78);
            }
            let var87: number;
            if (source.faceTextureAxis === null) {
                var87 = -1 | 0;
            } else {
                var87 = (arrayAtU8(source.faceTextureAxis, var78) << 24) >> 24;
            }
            let var88: number;
            if (source.faceAlpha === null) {
                var88 = 0;
            } else {
                var88 = ((arrayAtU8(source.faceAlpha, var78) << 24) >> 24) & 255;
            }
            let var89: ModelUv = Math.fround(0.0);
            let var92: ModelUv = Math.fround(0.0);
            let var94: ModelUv = Math.fround(0.0);
            let var96: ModelUv = Math.fround(0.0);
            let var98: ModelUv = Math.fround(0.0);
            let var100: ModelUv = Math.fround(0.0);
            let var102: number = 0;
            let var103: number = 0;
            let var104: number = 0;
            if (var84 !== -1) {
                if (var87 === -1) {
                    var89 = Math.fround(0.0);
                    var92 = Math.fround(1.0);
                    var94 = Math.fround(1.0);
                    var96 = Math.fround(1.0);
                    var102 = 1;
                    var98 = Math.fround(0.0);
                    var100 = Math.fround(0.0);
                    var103 = 2;
                } else {
                    var87 = var87 & 255;
                    const var28: number = (arrayAtU8(source.textureType, var87) << 24) >> 24;
                    if (var28 === 0) {
                        const var29: number = arrayAtI32(source.faceVertexA, var78);
                        const var30: number = arrayAtI32(source.faceVertexB, var78);
                        const var31: number = arrayAtI32(source.faceVertexC, var78);
                        const var32: number = arrayAtI16(source.faceTextureP, var87);
                        const var33: number = arrayAtI16(source.faceTextureM, var87);
                        const var34: number = arrayAtI16(source.faceTextureN, var87);
                        const var35: number = Math.fround(arrayAtI32(source.pointX, var32));
                        const var36: number = Math.fround(arrayAtI32(source.pointY, var32));
                        const var37: number = Math.fround(arrayAtI32(source.pointZ, var32));
                        const var38: number = Math.fround(Math.fround(arrayAtI32(source.pointX, var33)) - var35);
                        const var39: number = Math.fround(Math.fround(arrayAtI32(source.pointY, var33)) - var36);
                        const var40: number = Math.fround(Math.fround(arrayAtI32(source.pointZ, var33)) - var37);
                        const var41: number = Math.fround(Math.fround(arrayAtI32(source.pointX, var34)) - var35);
                        const var42: number = Math.fround(Math.fround(arrayAtI32(source.pointY, var34)) - var36);
                        const var43: number = Math.fround(Math.fround(arrayAtI32(source.pointZ, var34)) - var37);
                        const var44: number = Math.fround(Math.fround(arrayAtI32(source.pointX, var29)) - var35);
                        const var45: number = Math.fround(Math.fround(arrayAtI32(source.pointY, var29)) - var36);
                        const var46: number = Math.fround(Math.fround(arrayAtI32(source.pointZ, var29)) - var37);
                        const var47: number = Math.fround(Math.fround(arrayAtI32(source.pointX, var30)) - var35);
                        const var48: number = Math.fround(Math.fround(arrayAtI32(source.pointY, var30)) - var36);
                        const var49: number = Math.fround(Math.fround(arrayAtI32(source.pointZ, var30)) - var37);
                        const var50: number = Math.fround(Math.fround(arrayAtI32(source.pointX, var31)) - var35);
                        const var51: number = Math.fround(Math.fround(arrayAtI32(source.pointY, var31)) - var36);
                        const var52: number = Math.fround(Math.fround(arrayAtI32(source.pointZ, var31)) - var37);
                        const var53: number = Math.fround(Math.fround(var39 * var43) - Math.fround(var40 * var42));
                        const var54: number = Math.fround(Math.fround(var40 * var41) - Math.fround(var38 * var43));
                        const var55: number = Math.fround(Math.fround(var38 * var42) - Math.fround(var39 * var41));
                        let var56: number = Math.fround(Math.fround(var42 * var55) - Math.fround(var43 * var54));
                        let var57: number = Math.fround(Math.fround(var43 * var53) - Math.fround(var41 * var55));
                        let var58: number = Math.fround(Math.fround(var41 * var54) - Math.fround(var42 * var53));
                        let var59: number = Math.fround(Math.fround(1.0) / Math.fround(Math.fround(Math.fround(var56 * var38) + Math.fround(var57 * var39)) + Math.fround(var58 * var40)));
                        var89 = planarUv(Math.fround(Math.fround(Math.fround(Math.fround(var56 * var44) + Math.fround(var57 * var45)) + Math.fround(var58 * var46)) * var59));
                        var94 = planarUv(Math.fround(Math.fround(Math.fround(Math.fround(var56 * var47) + Math.fround(var57 * var48)) + Math.fround(var58 * var49)) * var59));
                        var98 = planarUv(Math.fround(Math.fround(Math.fround(Math.fround(var56 * var50) + Math.fround(var57 * var51)) + Math.fround(var58 * var52)) * var59));
                        var56 = Math.fround(Math.fround(var39 * var55) - Math.fround(var40 * var54));
                        var57 = Math.fround(Math.fround(var40 * var53) - Math.fround(var38 * var55));
                        var58 = Math.fround(Math.fround(var38 * var54) - Math.fround(var39 * var53));
                        var59 = Math.fround(Math.fround(1.0) / Math.fround(Math.fround(Math.fround(var56 * var41) + Math.fround(var57 * var42)) + Math.fround(var58 * var43)));
                        var92 = planarUv(Math.fround(Math.fround(Math.fround(Math.fround(var56 * var44) + Math.fround(var57 * var45)) + Math.fround(var58 * var46)) * var59));
                        var96 = planarUv(Math.fround(Math.fround(Math.fround(Math.fround(var56 * var47) + Math.fround(var57 * var48)) + Math.fround(var58 * var49)) * var59));
                        var100 = planarUv(Math.fround(Math.fround(Math.fround(Math.fround(var56 * var50) + Math.fround(var57 * var51)) + Math.fround(var58 * var52)) * var59));
                    } else {
                        const var106: number = arrayAtI32(source.faceVertexA, var78);
                        const var109: number = arrayAtI32(source.faceVertexB, var78);
                        const var111: number = arrayAtI32(source.faceVertexC, var78);
                        const var113: number = arrayAtI32(var66, var87);
                        const var115: number = arrayAtI32(var70, var87);
                        const var117: number = arrayAtI32(var71, var87);
                        const var119: Float32Array | null = arrayAtObj(var72, var87);
                        const var121: number = (arrayAtU8(source.textureDirection, var87) << 24) >> 24;
                        const var123: number = Math.fround(((arrayAtU8(source.textureSpeed, var87) << 24) >> 24) / Math.fround(256.0));
                        if (var28 === 1) {
                            const var124: number = Math.fround(Math.fround(arrayAtI16(source.textureScaleZ, var87) & 65535) / Math.fround(1024.0));
                            GlModel.cylinderUv(arrayAtI32(source.pointX, var106), arrayAtI32(source.pointY, var106), arrayAtI32(source.pointZ, var106), var113, var115, var117, var119, var124, var121, var123);
                            var89 = GlModel.cylinderU;
                            var92 = GlModel.cylinderV;
                            GlModel.cylinderUv(arrayAtI32(source.pointX, var109), arrayAtI32(source.pointY, var109), arrayAtI32(source.pointZ, var109), var113, var115, var117, var119, var124, var121, var123);
                            var94 = GlModel.cylinderU;
                            var96 = GlModel.cylinderV;
                            GlModel.cylinderUv(arrayAtI32(source.pointX, var111), arrayAtI32(source.pointY, var111), arrayAtI32(source.pointZ, var111), var113, var115, var117, var119, var124, var121, var123);
                            var98 = GlModel.cylinderU;
                            var100 = GlModel.cylinderV;
                            const var126: number = Math.fround(var124 / Math.fround(2.0));
                            if ((var121 & 1) === 0) {
                                if (Math.fround(var94 - var89) > var126) {
                                    var94 = Math.fround(var94 - var124);
                                    var102 = 1;
                                } else {
                                    if (Math.fround(var89 - var94) > var126) {
                                        var94 = Math.fround(var94 + var124);
                                        var102 = 2;
                                    }
                                }
                                if (Math.fround(var98 - var89) > var126) {
                                    var98 = Math.fround(var98 - var124);
                                    var103 = 1;
                                } else {
                                    if (Math.fround(var89 - var98) > var126) {
                                        var98 = Math.fround(var98 + var124);
                                        var103 = 2;
                                    }
                                }
                            } else {
                                if (Math.fround(var96 - var92) > var126) {
                                    var96 = Math.fround(var96 - var124);
                                    var102 = 1;
                                } else {
                                    if (Math.fround(var92 - var96) > var126) {
                                        var96 = Math.fround(var96 + var124);
                                        var102 = 2;
                                    }
                                }
                                if (Math.fround(var100 - var92) > var126) {
                                    var100 = Math.fround(var100 - var124);
                                    var103 = 1;
                                } else {
                                    if (Math.fround(var92 - var100) > var126) {
                                        var100 = Math.fround(var100 + var124);
                                        var103 = 2;
                                    }
                                }
                            }
                        } else {
                            if (var28 === 2) {
                                const var125: number = Math.fround(((arrayAtU8(source.textureTransU, var87) << 24) >> 24) / Math.fround(256.0));
                                const var127: number = Math.fround(((arrayAtU8(source.textureTransV, var87) << 24) >> 24) / Math.fround(256.0));
                                const var128: number = (arrayAtI32(source.pointX, var109) - arrayAtI32(source.pointX, var106)) | 0;
                                const var129: number = (arrayAtI32(source.pointY, var109) - arrayAtI32(source.pointY, var106)) | 0;
                                const var130: number = (arrayAtI32(source.pointZ, var109) - arrayAtI32(source.pointZ, var106)) | 0;
                                const var131: number = (arrayAtI32(source.pointX, var111) - arrayAtI32(source.pointX, var106)) | 0;
                                const var132: number = (arrayAtI32(source.pointY, var111) - arrayAtI32(source.pointY, var106)) | 0;
                                const var133: number = (arrayAtI32(source.pointZ, var111) - arrayAtI32(source.pointZ, var106)) | 0;
                                const var134: number = (Math.imul(var129, var133) - Math.imul(var132, var130)) | 0;
                                const var135: number = (Math.imul(var130, var131) - Math.imul(var133, var128)) | 0;
                                const var136: number = (Math.imul(var128, var132) - Math.imul(var131, var129)) | 0;
                                const var137: number = Math.fround(Math.fround(64.0) / Math.fround(arrayAtI16(source.textureScaleX, var87) & 65535));
                                const var138: number = Math.fround(Math.fround(64.0) / Math.fround(arrayAtI16(source.textureScaleY, var87) & 65535));
                                const var139: number = Math.fround(Math.fround(64.0) / Math.fround(arrayAtI16(source.textureScaleZ, var87) & 65535));
                                const var140: number = Math.fround(
                                    Math.fround(Math.fround(Math.fround(Math.fround(var134) * arrayAtF32(var119, 0)) + Math.fround(Math.fround(var135) * arrayAtF32(var119, 1))) + Math.fround(Math.fround(var136) * arrayAtF32(var119, 2))) / var137
                                );
                                const var141: number = Math.fround(
                                    Math.fround(Math.fround(Math.fround(Math.fround(var134) * arrayAtF32(var119, 3)) + Math.fround(Math.fround(var135) * arrayAtF32(var119, 4))) + Math.fround(Math.fround(var136) * arrayAtF32(var119, 5))) / var138
                                );
                                const var142: number = Math.fround(
                                    Math.fround(Math.fround(Math.fround(Math.fround(var134) * arrayAtF32(var119, 6)) + Math.fround(Math.fround(var135) * arrayAtF32(var119, 7))) + Math.fround(Math.fround(var136) * arrayAtF32(var119, 8))) / var139
                                );
                                var104 = GlModel.boxFace(var140, var141, var142);
                                GlModel.boxUv(arrayAtI32(source.pointX, var106), arrayAtI32(source.pointY, var106), arrayAtI32(source.pointZ, var106), var113, var115, var117, var104, var119, var121, var123, var125, var127);
                                var89 = GlModel.boxU;
                                var92 = GlModel.boxV;
                                GlModel.boxUv(arrayAtI32(source.pointX, var109), arrayAtI32(source.pointY, var109), arrayAtI32(source.pointZ, var109), var113, var115, var117, var104, var119, var121, var123, var125, var127);
                                var94 = GlModel.boxU;
                                var96 = GlModel.boxV;
                                GlModel.boxUv(arrayAtI32(source.pointX, var111), arrayAtI32(source.pointY, var111), arrayAtI32(source.pointZ, var111), var113, var115, var117, var104, var119, var121, var123, var125, var127);
                                var98 = GlModel.boxU;
                                var100 = GlModel.boxV;
                            } else {
                                if (var28 === 3) {
                                    GlModel.sphereUv(arrayAtI32(source.pointX, var106), arrayAtI32(source.pointY, var106), arrayAtI32(source.pointZ, var106), var113, var115, var117, var119, var121, var123);
                                    var89 = GlModel.sphereU;
                                    var92 = GlModel.sphereV;
                                    GlModel.sphereUv(arrayAtI32(source.pointX, var109), arrayAtI32(source.pointY, var109), arrayAtI32(source.pointZ, var109), var113, var115, var117, var119, var121, var123);
                                    var94 = GlModel.sphereU;
                                    var96 = GlModel.sphereV;
                                    GlModel.sphereUv(arrayAtI32(source.pointX, var111), arrayAtI32(source.pointY, var111), arrayAtI32(source.pointZ, var111), var113, var115, var117, var119, var121, var123);
                                    var98 = GlModel.sphereU;
                                    var100 = GlModel.sphereV;
                                    if ((var121 & 1) === 0) {
                                        if (Math.fround(var94 - var89) > Math.fround(0.5)) {
                                            var94--;
                                            var102 = 1;
                                        } else {
                                            if (Math.fround(var89 - var94) > Math.fround(0.5)) {
                                                var94++;
                                                var102 = 2;
                                            }
                                        }
                                        if (Math.fround(var98 - var89) > Math.fround(0.5)) {
                                            var98--;
                                            var103 = 1;
                                        } else {
                                            if (Math.fround(var89 - var98) > Math.fround(0.5)) {
                                                var98++;
                                                var103 = 2;
                                            }
                                        }
                                    } else {
                                        if (Math.fround(var96 - var92) > Math.fround(0.5)) {
                                            var96--;
                                            var102 = 1;
                                        } else {
                                            if (Math.fround(var92 - var96) > Math.fround(0.5)) {
                                                var96++;
                                                var102 = 2;
                                            }
                                        }
                                        if (Math.fround(var100 - var92) > Math.fround(0.5)) {
                                            var100--;
                                            var103 = 1;
                                        } else {
                                            if (Math.fround(var92 - var100) > Math.fround(0.5)) {
                                                var100++;
                                                var103 = 2;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            source.CalculateNormals();
            let var105: number;
            if (source.faceRenderType === null) {
                var105 = 0;
            } else {
                var105 = (arrayAtU8(source.faceRenderType, var78) << 24) >> 24;
            }
            if (var105 === 0) {
                const var107: bigint = BigInt.asIntN(64, BigInt(var87 << 2) + BigInt.asIntN(64, BigInt.asIntN(64, BigInt.asIntN(64, BigInt(var104 << 24) + BigInt(var81 << 8)) + BigInt(var88)) << BigInt(32)));
                const var112: number = arrayAtI32(source.faceVertexA, var78);
                const var114: PointNormal | null = arrayAtObj(source.pointNormal, var112);
                arrayPutI16(this.faceVertexA, var74, this.addVertex(source, var112, var107, requireNonNull(var114).x, requireNonNull(var114).y, requireNonNull(var114).z, requireNonNull(var114).w, var89, var92));
                const var116: number = arrayAtI32(source.faceVertexB, var78);
                const var118: PointNormal | null = arrayAtObj(source.pointNormal, var116);
                arrayPutI16(this.faceVertexB, var74, this.addVertex(source, var116, BigInt.asIntN(64, var107 + BigInt(var102)), requireNonNull(var118).x, requireNonNull(var118).y, requireNonNull(var118).z, requireNonNull(var118).w, var94, var96));
                const var120: number = arrayAtI32(source.faceVertexC, var78);
                const var122: PointNormal | null = arrayAtObj(source.pointNormal, var120);
                arrayPutI16(this.faceVertexC, var74, this.addVertex(source, var120, BigInt.asIntN(64, var107 + BigInt(var103)), requireNonNull(var122).x, requireNonNull(var122).y, requireNonNull(var122).z, requireNonNull(var122).w, var98, var100));
            } else {
                if (var105 === 1) {
                    const var108: FaceNormal | null = arrayAtObj(source.faceNormal, var78);
                    const var110: bigint = BigInt.asIntN(
                        64,
                        BigInt(((((((var87 << 2) + (requireNonNull(var108).x > 0 ? 1024 : 2048)) | 0) + (((requireNonNull(var108).y + 256) | 0) << 12)) | 0) + (((requireNonNull(var108).z + 256) | 0) << 22)) | 0) +
                            BigInt.asIntN(64, BigInt.asIntN(64, BigInt.asIntN(64, BigInt(var104 << 24) + BigInt(var81 << 8)) + BigInt(var88)) << BigInt(32))
                    );
                    arrayPutI16(this.faceVertexA, var74, this.addVertex(source, arrayAtI32(source.faceVertexA, var78), var110, requireNonNull(var108).x, requireNonNull(var108).y, requireNonNull(var108).z, 0, var89, var92));
                    arrayPutI16(
                        this.faceVertexB,
                        var74,
                        this.addVertex(source, arrayAtI32(source.faceVertexB, var78), BigInt.asIntN(64, var110 + BigInt(var102)), requireNonNull(var108).x, requireNonNull(var108).y, requireNonNull(var108).z, 0, var94, var96)
                    );
                    arrayPutI16(
                        this.faceVertexC,
                        var74,
                        this.addVertex(source, arrayAtI32(source.faceVertexC, var78), BigInt.asIntN(64, var110 + BigInt(var103)), requireNonNull(var108).x, requireNonNull(var108).y, requireNonNull(var108).z, 0, var98, var100)
                    );
                }
            }
            if (source.faceMaterial !== null) {
                arrayPutI16(this.faceMaterial, var74, arrayAtI16(source.faceMaterial, var78));
            } else {
                arrayPutI16(this.faceMaterial, var74, -1 | 0);
            }
            if (this.faceLabel !== null) {
                arrayPutU8(this.faceLabel, var74, (arrayAtI32(source.faceLabel, var78) << 24) >> 24);
            }
            arrayPutI16(this.faceColour, var74, arrayAtI16(source.faceColour, var78));
            if (source.faceAlpha !== null) {
                arrayPutU8(this.faceAlpha, var74, (arrayAtU8(source.faceAlpha, var78) << 24) >> 24);
            }
            if (source.facePartMask !== null) {
                arrayPutI16(this.facePartMask, var74, arrayAtI16(source.facePartMask, var78));
            }
        }
        let var75: number = 0;
        let var79: number = -10000 | 0;
        for (let var82: number = 0; var82 < this.faceCount; var82++) {
            const var85: number = arrayAtI16(this.faceMaterial, var82);
            if (var85 !== var79) {
                var75++;
                var79 = var85;
            }
        }
        this.materialRuns = new Int32Array((var75 + 1) | 0);
        var75 = 0;
        var79 = -10000 | 0;
        for (let var83: number = 0; var83 < this.faceCount; var83++) {
            const var86: number = arrayAtI16(this.faceMaterial, var83);
            if (var86 !== var79) {
                arrayPutI32(this.materialRuns, var75++, var83);
                var79 = var86;
            }
        }
        arrayPutI32(this.materialRuns, var75, this.faceCount);
        GlModel.vertexKeys = null;
        this.normalX = GlModel.copyShorts(this.normalX, this.expandedVertexCount);
        this.normalY = GlModel.copyShorts(this.normalY, this.expandedVertexCount);
        this.normalZ = GlModel.copyShorts(this.normalZ, this.expandedVertexCount);
        this.normalCount = GlModel.copyShorts(this.normalCount, this.expandedVertexCount);
        this.texU = GlModel.copyFloats(this.texU, this.expandedVertexCount);
        this.texV = GlModel.copyFloats(this.texV, this.expandedVertexCount);
    }

    // td.a(FFF)I
    private static boxFace(var0: number, var1: number, var2: number): number {
        const var3: number = var0 < Math.fround(0.0) ? -var0 : var0;
        const var4: number = var1 < Math.fround(0.0) ? -var1 : var1;
        const var5: number = var2 < Math.fround(0.0) ? -var2 : var2;
        if (var4 > var3 && var4 > var5) {
            return var1 > Math.fround(0.0) ? 0 : 1;
        } else {
            if (var5 > var3 && var5 > var4) {
                return var2 > Math.fround(0.0) ? 2 : 3;
            } else {
                return var0 > Math.fround(0.0) ? 4 : 5;
            }
        }
    }

    // td.a(ZZZ)Lak;
    CopyForAnimSpot(shareAlpha: boolean, shareColour: boolean, shareNormals: boolean): ModelLit {
        return this.copyAnimation(shareAlpha, shareColour, shareNormals, GlModel.tempSpotModel, GlModel.tempSpotStorage);
    }

    // td.a(IIIIIIIIJILga;)V
    draw(angle: number, sinPitch: number, cosPitch: number, sinYaw: number, cosYaw: number, x: number, y: number, z: number, typecode: bigint, _level: number, _particles: ParticleSystem | null): void {
        if (this.expandedVertexCount !== 0) {
            if (!requireNonNull(this.bounds).valid) {
                this.calculateBounds();
            }
            const var13: number = requireNonNull(this.bounds).radius;
            const var14: number = requireNonNull(this.bounds).minY;
            const var15: number = requireNonNull(this.bounds).maxY;
            const var16: number = ((Math.imul(z, cosYaw) - Math.imul(x, sinYaw)) | 0) >> 16;
            const var17: number = ((Math.imul(y, sinPitch) + Math.imul(var16, cosPitch)) | 0) >> 16;
            const var18: number = (var17 + (((Math.imul(var13, cosPitch) + Math.imul(var15, sinPitch)) | 0) >> 16)) | 0;
            if (var18 > 50) {
                const var19: number = (var17 + (((Math.imul(-var13, cosPitch) + Math.imul(var14, sinPitch)) | 0) >> 16)) | 0;
                if (var19 < GlRenderer.sceneFar) {
                    const var20: number = ((Math.imul(z, sinYaw) + Math.imul(x, cosYaw)) | 0) >> 16;
                    const var21: number = ((var20 + var13) | 0) << 9;
                    if (intDivide(var21, var18) > Pix3D.clipMinX) {
                        const var22: number = ((var20 - var13) | 0) << 9;
                        if (intDivide(var22, var18) < Pix3D.clipMaxX) {
                            const var23: number = ((Math.imul(y, cosPitch) - Math.imul(var16, sinPitch)) | 0) >> 16;
                            const var24: number = ((var23 + (((Math.imul(var13, sinPitch) + Math.imul(var15, cosPitch)) | 0) >> 16)) | 0) << 9;
                            if (intDivide(var24, var18) > Pix3D.clipMinY) {
                                const var25: number = ((var23 + (((Math.imul(-var13, sinPitch) + Math.imul(var14, cosPitch)) | 0) >> 16)) | 0) << 9;
                                if (intDivide(var25, var18) < Pix3D.clipMaxY) {
                                    let var26: number = 0;
                                    let var27: number = 0;
                                    if (angle !== 0) {
                                        var26 = arrayAtI32(Pix3D.sinTable, angle);
                                        var27 = arrayAtI32(Pix3D.cosTable, angle);
                                    }
                                    if (typecode > 0n && ModelLit.checkHover && var19 > 0) {
                                        let var28: number;
                                        let var30: number;
                                        if (var20 > 0) {
                                            var28 = intDivide(var22, var18);
                                            var30 = intDivide(var21, var19);
                                        } else {
                                            var28 = intDivide(var22, var19);
                                            var30 = intDivide(var21, var18);
                                        }
                                        let var29: number;
                                        let var31: number;
                                        if (var23 > 0) {
                                            var29 = intDivide(var25, var18);
                                            var31 = intDivide(var24, var19);
                                        } else {
                                            var29 = intDivide(var25, var19);
                                            var31 = intDivide(var24, var18);
                                        }
                                        if (ModelLitImpl.mouseX >= var28 && ModelLitImpl.mouseX <= var30 && ModelLit.mouseY >= var29 && ModelLit.mouseY <= var31) {
                                            var28 = 999999;
                                            var30 = -999999 | 0;
                                            var29 = 999999;
                                            var31 = -999999 | 0;
                                            const var32: number = requireNonNull(this.bounds).minX;
                                            const var33: number = requireNonNull(this.bounds).maxX;
                                            const var34: number = requireNonNull(this.bounds).minZ;
                                            const var35: number = requireNonNull(this.bounds).maxZ;
                                            const var36: Int32Array | null = Int32Array.of(var32, var33, var32, var33, var32, var33, var32, var33);
                                            const var37: Int32Array | null = Int32Array.of(var34, var34, var35, var35, var34, var34, var35, var35);
                                            const var38: Int32Array | null = Int32Array.of(var14, var14, var14, var14, var15, var15, var15, var15);
                                            for (let var39: number = 0; var39 < 8; var39++) {
                                                let var40: number = arrayAtI32(var36, var39);
                                                let var41: number = arrayAtI32(var38, var39);
                                                let var42: number = arrayAtI32(var37, var39);
                                                if (angle !== 0) {
                                                    const var43: number = ((Math.imul(var42, var26) + Math.imul(var40, var27)) | 0) >> 16;
                                                    var42 = ((Math.imul(var42, var27) - Math.imul(var40, var26)) | 0) >> 16;
                                                    var40 = var43;
                                                }
                                                var40 = (var40 + x) | 0;
                                                var41 = (var41 + y) | 0;
                                                var42 = (var42 + z) | 0;
                                                let var75: number = ((Math.imul(var42, sinYaw) + Math.imul(var40, cosYaw)) | 0) >> 16;
                                                var42 = ((Math.imul(var42, cosYaw) - Math.imul(var40, sinYaw)) | 0) >> 16;
                                                var40 = var75;
                                                var75 = ((Math.imul(var41, cosPitch) - Math.imul(var42, sinPitch)) | 0) >> 16;
                                                var42 = ((Math.imul(var41, sinPitch) + Math.imul(var42, cosPitch)) | 0) >> 16;
                                                var41 = var75;
                                                if (var42 > 0) {
                                                    const var44: number = intDivide(var40 << 9, var42);
                                                    const var45: number = intDivide(var41 << 9, var42);
                                                    if (var44 < var28) {
                                                        var28 = var44;
                                                    }
                                                    if (var44 > var30) {
                                                        var30 = var44;
                                                    }
                                                    if (var45 < var29) {
                                                        var29 = var45;
                                                    }
                                                    if (var45 > var31) {
                                                        var31 = var45;
                                                    }
                                                }
                                            }
                                            if (ModelLitImpl.mouseX >= var28 && ModelLitImpl.mouseX <= var30 && ModelLit.mouseY >= var29 && ModelLit.mouseY <= var31) {
                                                if (this.useAABBMouseCheck) {
                                                    arrayPutB64(ModelLit.pickedTypecodes, ModelLit.pickedCount++, typecode);
                                                } else {
                                                    if (requireNonNull(GlModel.shadowZ).length < this.expandedVertexCount) {
                                                        GlModel.shadowZ = new Int32Array(this.expandedVertexCount);
                                                        GlModel.shadowX = new Int32Array(this.expandedVertexCount);
                                                    }
                                                    let var55: number = 0;
                                                    label118: {
                                                        while (true) {
                                                            if (var55 >= this.vertexCount) {
                                                                var55 = 0;
                                                                while (true) {
                                                                    if (var55 >= this.faceCount) {
                                                                        break label118;
                                                                    }
                                                                    const var62: number = arrayAtI16(this.faceVertexA, var55);
                                                                    const var66: number = arrayAtI16(this.faceVertexB, var55);
                                                                    const var74: number = arrayAtI16(this.faceVertexC, var55);
                                                                    if (
                                                                        this.containsProjected(
                                                                            ModelLitImpl.mouseX,
                                                                            ModelLit.mouseY,
                                                                            arrayAtI32(GlModel.shadowX, var62),
                                                                            arrayAtI32(GlModel.shadowX, var66),
                                                                            arrayAtI32(GlModel.shadowX, var74),
                                                                            arrayAtI32(GlModel.shadowZ, var62),
                                                                            arrayAtI32(GlModel.shadowZ, var66),
                                                                            arrayAtI32(GlModel.shadowZ, var74)
                                                                        )
                                                                    ) {
                                                                        arrayPutB64(ModelLit.pickedTypecodes, ModelLit.pickedCount++, typecode);
                                                                        break label118;
                                                                    }
                                                                    var55++;
                                                                }
                                                            }
                                                            let var59: number = arrayAtI32(this.pointX, var55);
                                                            let var64: number = arrayAtI32(this.pointY, var55);
                                                            let var70: number = arrayAtI32(this.pointZ, var55);
                                                            if (angle !== 0) {
                                                                const var77: number = ((Math.imul(var70, var26) + Math.imul(var59, var27)) | 0) >> 16;
                                                                var70 = ((Math.imul(var70, var27) - Math.imul(var59, var26)) | 0) >> 16;
                                                                var59 = var77;
                                                            }
                                                            var59 = (var59 + x) | 0;
                                                            var64 = (var64 + y) | 0;
                                                            var70 = (var70 + z) | 0;
                                                            let var78: number = ((Math.imul(var70, sinYaw) + Math.imul(var59, cosYaw)) | 0) >> 16;
                                                            var70 = ((Math.imul(var70, cosYaw) - Math.imul(var59, sinYaw)) | 0) >> 16;
                                                            var59 = var78;
                                                            var78 = ((Math.imul(var64, cosPitch) - Math.imul(var70, sinPitch)) | 0) >> 16;
                                                            var70 = ((Math.imul(var64, sinPitch) + Math.imul(var70, cosPitch)) | 0) >> 16;
                                                            var64 = var78;
                                                            if (var70 < 50) {
                                                                break;
                                                            }
                                                            const var80: number = intDivide(var59 << 9, var70);
                                                            const var81: number = intDivide(var64 << 9, var70);
                                                            const var46: number = arrayAtI32(this.vertexOffsets, var55);
                                                            const var47: number = arrayAtI32(this.vertexOffsets, (var55 + 1) | 0);
                                                            for (let var48: number = var46; var48 < var47; var48++) {
                                                                const var49: number = (arrayAtI16(this.vertexIndices, var48) - 1) | 0;
                                                                if (var49 === -1) {
                                                                    break;
                                                                }
                                                                arrayPutI32(GlModel.shadowZ, var49, var80);
                                                                arrayPutI32(GlModel.shadowX, var49, var81);
                                                            }
                                                            var55++;
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                    const var51: GL | null = GlRenderer.gl;
                                    requireNonNull(var51).glPushMatrix();
                                    requireNonNull(var51).glTranslatef(x, y, z);
                                    requireNonNull(var51).glRotatef(Math.fround(Math.fround(angle) * Math.fround(0.17578125)), Math.fround(0.0), Math.fround(1.0), Math.fround(0.0));
                                    this.drawElements();
                                    requireNonNull(var51).glRotatef(Math.fround(Math.fround(-angle | 0) * Math.fround(0.17578125)), Math.fround(0.0), Math.fround(1.0), Math.fround(0.0));
                                    requireNonNull(var51).glTranslatef(-x | 0, -y | 0, -z | 0);
                                    requireNonNull(var51).glPopMatrix();
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // td.m()V
    rotate270WithNormals(): void {
        if (this.normalX === null) {
            this.Rotate270();
        } else {
            for (let var1: number = 0; var1 < this.vertexCount; var1++) {
                const var2: number = arrayAtI32(this.pointZ, var1);
                arrayPutI32(this.pointZ, var1, arrayAtI32(this.pointX, var1));
                arrayPutI32(this.pointX, var1, -var2 | 0);
            }
            for (let var3: number = 0; var3 < this.expandedVertexCount; var3++) {
                const var4: number = arrayAtI16(this.normalZ, var3);
                arrayPutI16(this.normalZ, var3, arrayAtI16(this.normalX, var3));
                arrayPutI16(this.normalX, var3, (-var4 << 16) >> 16);
            }
            requireNonNull(this.bounds).valid = false;
            requireNonNull(this.positionStream).valid = false;
            if (this.normalStream !== null) {
                requireNonNull(this.normalStream).valid = false;
            }
        }
    }

    // td.n()I
    getAmbient(): number {
        return this.ambient;
    }

    // td.c(I)V
    rotateZAxis(angle: number): void {
        const var2: number = arrayAtI32(Pix3D.sinTable, angle);
        const var3: number = arrayAtI32(Pix3D.cosTable, angle);
        for (let var4: number = 0; var4 < this.vertexCount; var4++) {
            const var5: number = ((Math.imul(arrayAtI32(this.pointY, var4), var2) + Math.imul(arrayAtI32(this.pointX, var4), var3)) | 0) >> 16;
            arrayPutI32(this.pointY, var4, ((Math.imul(arrayAtI32(this.pointY, var4), var3) - Math.imul(arrayAtI32(this.pointX, var4), var2)) | 0) >> 16);
            arrayPutI32(this.pointX, var4, var5);
        }
        requireNonNull(this.bounds).valid = false;
        requireNonNull(this.positionStream).valid = false;
    }

    // td.g()I
    getMaxX(): number {
        if (!requireNonNull(this.bounds).valid) {
            this.calculateBounds();
        }
        return requireNonNull(this.bounds).maxX;
    }

    // td.c()I
    getMaxZ(): number {
        if (!requireNonNull(this.bounds).valid) {
            this.calculateBounds();
        }
        return requireNonNull(this.bounds).maxZ;
    }

    // td.a()Z
    override isUnlit(): boolean {
        return this.shareLight && this.pointX !== null && this.normalX !== null;
    }

    // td.k()I
    getMinZ(): number {
        if (!requireNonNull(this.bounds).valid) {
            this.calculateBounds();
        }
        return requireNonNull(this.bounds).minZ;
    }

    // td.c(III)V
    Translate(x: number, y: number, z: number): void {
        for (let var4: number = 0; var4 < this.vertexCount; var4++) {
            arrayPutI32(this.pointX, var4, (arrayAtI32(this.pointX, var4) + x) | 0);
            arrayPutI32(this.pointY, var4, (arrayAtI32(this.pointY, var4) + y) | 0);
            arrayPutI32(this.pointZ, var4, (arrayAtI32(this.pointZ, var4) + z) | 0);
        }
        requireNonNull(this.bounds).valid = false;
        requireNonNull(this.positionStream).valid = false;
    }

    // td.b(ZZZ)Lak;
    CopyForAnimLoc(shareAlpha: boolean, shareColour: boolean, shareNormals: boolean): ModelLit {
        return this.copyAnimation(shareAlpha, shareColour, shareNormals, GlModel.tempLocModel, GlModel.tempLocStorage);
    }

    // td.a(IIIIII[FFIF)V
    private static cylinderUv(var0: number, var1: number, var2: number, var3: number, var4: number, var5: number, var6: Float32Array | null, var7: number, var8: number, var9: number): void {
        var0 = (var0 - var3) | 0;
        var1 = (var1 - var4) | 0;
        var2 = (var2 - var5) | 0;
        const var10: number = Math.fround(Math.fround(Math.fround(Math.fround(var0) * arrayAtF32(var6, 0)) + Math.fround(Math.fround(var1) * arrayAtF32(var6, 1))) + Math.fround(Math.fround(var2) * arrayAtF32(var6, 2)));
        const var11: number = Math.fround(Math.fround(Math.fround(Math.fround(var0) * arrayAtF32(var6, 3)) + Math.fround(Math.fround(var1) * arrayAtF32(var6, 4))) + Math.fround(Math.fround(var2) * arrayAtF32(var6, 5)));
        const var12: number = Math.fround(Math.fround(Math.fround(Math.fround(var0) * arrayAtF32(var6, 6)) + Math.fround(Math.fround(var1) * arrayAtF32(var6, 7))) + Math.fround(Math.fround(var2) * arrayAtF32(var6, 8)));
        let var13: number = Math.fround(Math.fround(Math.fround(Math.atan2(var10, var12)) / Math.fround(Math.PI * 2)) + Math.fround(0.5));
        if (var7 !== Math.fround(1.0)) {
            var13 = Math.fround(var13 * var7);
        }
        let var14: number = Math.fround(Math.fround(var11 + Math.fround(0.5)) + var9);
        if (var8 === 1) {
            const var15: number = var13;
            var13 = -var14;
            var14 = var15;
        } else {
            if (var8 === 2) {
                var13 = -var13;
                var14 = -var14;
            } else {
                if (var8 === 3) {
                    const var19: number = var13;
                    var13 = var14;
                    var14 = -var19;
                }
            }
        }
        GlModel.cylinderU = var13;
        GlModel.cylinderV = var14;
    }

    // td.a(Lth;IIIZ)V
    override mergeNormals(other: ModelSource | null, dx: number, dy: number, dz: number, _markFaces: boolean): void {
        if (other !== null && !(other instanceof GlModel)) throw new TypeError('ClassCastException: not a GlModel');
        const var6 = other;
        if (this.faceCount !== 0 && requireNonNull(var6).faceCount !== 0) {
            const var7: number = requireNonNull(var6).vertexCount;
            const var8: Int32Array | null = requireNonNull(var6).pointX;
            const var9: Int32Array | null = requireNonNull(var6).pointY;
            const var10: Int32Array | null = requireNonNull(var6).pointZ;
            const var11: Int16Array | null = requireNonNull(var6).normalX;
            const var12: Int16Array | null = requireNonNull(var6).normalY;
            const var13: Int16Array | null = requireNonNull(var6).normalZ;
            const var14: Int16Array | null = requireNonNull(var6).normalCount;
            let var15: Int16Array | null;
            let var16: Int16Array | null;
            let var17: Int16Array | null;
            let var18: Int16Array | null;
            if (this.savedNormals !== null) {
                var15 = requireNonNull(this.savedNormals).normalX;
                var16 = requireNonNull(this.savedNormals).normalY;
                var17 = requireNonNull(this.savedNormals).normalZ;
                var18 = requireNonNull(this.savedNormals).normalCount;
            } else {
                var15 = null;
                var16 = null;
                var17 = null;
                var18 = null;
            }
            let var19: Int16Array | null;
            let var20: Int16Array | null;
            let var21: Int16Array | null;
            let var22: Int16Array | null;
            if (requireNonNull(var6).savedNormals !== null) {
                var19 = requireNonNull(requireNonNull(var6).savedNormals).normalX;
                var20 = requireNonNull(requireNonNull(var6).savedNormals).normalY;
                var21 = requireNonNull(requireNonNull(var6).savedNormals).normalZ;
                var22 = requireNonNull(requireNonNull(var6).savedNormals).normalCount;
            } else {
                var19 = null;
                var20 = null;
                var21 = null;
                var22 = null;
            }
            const var23: Int32Array | null = requireNonNull(var6).vertexOffsets;
            const var24: Int16Array | null = requireNonNull(var6).vertexIndices;
            if (!requireNonNull(requireNonNull(var6).bounds).valid) {
                requireNonNull(var6).calculateBounds();
            }
            const var25: number = requireNonNull(requireNonNull(var6).bounds).minY;
            const var26: number = requireNonNull(requireNonNull(var6).bounds).maxY;
            const var27: number = requireNonNull(requireNonNull(var6).bounds).minX;
            const var28: number = requireNonNull(requireNonNull(var6).bounds).maxX;
            const var29: number = requireNonNull(requireNonNull(var6).bounds).minZ;
            const var30: number = requireNonNull(requireNonNull(var6).bounds).maxZ;
            for (let var31: number = 0; var31 < this.vertexCount; var31++) {
                const var32: number = (arrayAtI32(this.pointY, var31) - dy) | 0;
                if (var32 >= var25 && var32 <= var26) {
                    const var33: number = (arrayAtI32(this.pointX, var31) - dx) | 0;
                    if (var33 >= var27 && var33 <= var28) {
                        const var34: number = (arrayAtI32(this.pointZ, var31) - dz) | 0;
                        if (var34 >= var29 && var34 <= var30) {
                            let var35: number = -1 | 0;
                            let var36: number = arrayAtI32(this.vertexOffsets, var31);
                            let var37: number = arrayAtI32(this.vertexOffsets, (var31 + 1) | 0);
                            for (let var38: number = var36; var38 < var37; var38++) {
                                var35 = (arrayAtI16(this.vertexIndices, var38) - 1) | 0;
                                if (var35 === -1 || arrayAtI16(this.normalCount, var35) !== 0) {
                                    break;
                                }
                            }
                            if (var35 !== -1) {
                                for (let var52: number = 0; var52 < var7; var52++) {
                                    if (var33 === arrayAtI32(var8, var52) && var34 === arrayAtI32(var10, var52) && var32 === arrayAtI32(var9, var52)) {
                                        let var39: number = -1 | 0;
                                        var36 = arrayAtI32(var23, var52);
                                        var37 = arrayAtI32(var23, (var52 + 1) | 0);
                                        for (let var40: number = var36; var40 < var37; var40++) {
                                            var39 = (arrayAtI16(var24, var40) - 1) | 0;
                                            if (var39 === -1 || arrayAtI16(var14, var39) !== 0) {
                                                break;
                                            }
                                        }
                                        if (var39 !== -1) {
                                            if (var15 === null) {
                                                this.savedNormals = new GlModelNormals();
                                                var15 = requireNonNull(this.savedNormals).normalX = ArrayUtils.copyOfShorts(this.normalX);
                                                var16 = requireNonNull(this.savedNormals).normalY = ArrayUtils.copyOfShorts(this.normalY);
                                                var17 = requireNonNull(this.savedNormals).normalZ = ArrayUtils.copyOfShorts(this.normalZ);
                                                var18 = requireNonNull(this.savedNormals).normalCount = ArrayUtils.copyOfShorts(this.normalCount);
                                            }
                                            if (var19 === null) {
                                                const var53: GlModelNormals | null = (requireNonNull(var6).savedNormals = new GlModelNormals());
                                                var19 = requireNonNull(var53).normalX = ArrayUtils.copyOfShorts(var11);
                                                var20 = requireNonNull(var53).normalY = ArrayUtils.copyOfShorts(var12);
                                                var21 = requireNonNull(var53).normalZ = ArrayUtils.copyOfShorts(var13);
                                                var22 = requireNonNull(var53).normalCount = ArrayUtils.copyOfShorts(var14);
                                            }
                                            let var54: number = arrayAtI16(this.normalX, var35);
                                            let var41: number = arrayAtI16(this.normalY, var35);
                                            let var42: number = arrayAtI16(this.normalZ, var35);
                                            let var43: number = arrayAtI16(this.normalCount, var35);
                                            var36 = arrayAtI32(var23, var52);
                                            var37 = arrayAtI32(var23, (var52 + 1) | 0);
                                            for (let var44: number = var36; var44 < var37; var44++) {
                                                const var45: number = (arrayAtI16(var24, var44) - 1) | 0;
                                                if (var45 === -1) {
                                                    break;
                                                }
                                                if (arrayAtI16(var22, var45) !== 0) {
                                                    arrayPutI16(var19, var45, (arrayAtI16(var19, var45) + var54) | 0);
                                                    arrayPutI16(var20, var45, (arrayAtI16(var20, var45) + var41) | 0);
                                                    arrayPutI16(var21, var45, (arrayAtI16(var21, var45) + var42) | 0);
                                                    arrayPutI16(var22, var45, (arrayAtI16(var22, var45) + var43) | 0);
                                                }
                                            }
                                            var54 = arrayAtI16(var11, var39);
                                            var41 = arrayAtI16(var12, var39);
                                            var42 = arrayAtI16(var13, var39);
                                            var43 = arrayAtI16(var14, var39);
                                            var36 = arrayAtI32(this.vertexOffsets, var31);
                                            var37 = arrayAtI32(this.vertexOffsets, (var31 + 1) | 0);
                                            for (let var59: number = var36; var59 < var37; var59++) {
                                                const var60: number = (arrayAtI16(this.vertexIndices, var59) - 1) | 0;
                                                if (var60 === -1) {
                                                    break;
                                                }
                                                if (arrayAtI16(var18, var60) !== 0) {
                                                    arrayPutI16(var15, var60, (arrayAtI16(var15, var60) + var54) | 0);
                                                    arrayPutI16(var16, var60, (arrayAtI16(var16, var60) + var41) | 0);
                                                    arrayPutI16(var17, var60, (arrayAtI16(var17, var60) + var42) | 0);
                                                    arrayPutI16(var18, var60, (arrayAtI16(var18, var60) + var43) | 0);
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // td.a(IIIIIIIJ)V
    ObjRender(xAngle: number, yAngle: number, zAngle: number, pitch: number, x: number, y: number, z: number, _typecode: bigint): void {
        if (this.expandedVertexCount !== 0) {
            const var10: GL | null = GlRenderer.gl;
            requireNonNull(var10).glPushMatrix();
            if (pitch !== 0) {
                requireNonNull(var10).glRotatef(Math.fround(Math.fround(pitch) * Math.fround(0.17578125)), Math.fround(1.0), Math.fround(0.0), Math.fround(0.0));
            }
            requireNonNull(var10).glTranslatef(x, y, z);
            if (yAngle !== 0) {
                requireNonNull(var10).glRotatef(Math.fround(Math.fround(yAngle) * Math.fround(0.17578125)), Math.fround(0.0), Math.fround(1.0), Math.fround(0.0));
            }
            if (xAngle !== 0) {
                requireNonNull(var10).glRotatef(Math.fround(Math.fround(xAngle) * Math.fround(0.17578125)), Math.fround(1.0), Math.fround(0.0), Math.fround(0.0));
            }
            if (zAngle !== 0) {
                requireNonNull(var10).glRotatef(Math.fround(Math.fround(-zAngle | 0) * Math.fround(0.17578125)), Math.fround(0.0), Math.fround(0.0), Math.fround(1.0));
            }
            this.drawElements();
            requireNonNull(var10).glPopMatrix();
        }
    }

    // td.a(ISIB)I
    private static faceRgba(colour: number, material: number, light: number, alpha: number): number {
        let var4: number = arrayAtI32(Pix3D.colourTable, ModelLitImpl.GetColour(colour, light));
        if (material !== -1) {
            const var5: number = requireNonNull(Pix3D.textureProvider as HdTextureProvider | null).grayscaleFactor(material & 65535);
            if (var5 !== 0) {
                let var6: number;
                if (light < 0) {
                    var6 = 0;
                } else {
                    if (light > 127) {
                        var6 = 16777215;
                    } else {
                        var6 = Math.imul(131586, light);
                    }
                }
                if (var5 === 256) {
                    var4 = var6;
                } else {
                    const var8: number = (256 - var5) | 0;
                    var4 = (((((Math.imul(var6 & 16711935, var5) + Math.imul(var4 & 16711935, var8)) | 0) & (-16711936 | 0)) + (((Math.imul(var6 & 65280, var5) + Math.imul(var4 & 65280, var8)) | 0) & 16711680)) | 0) >> 8;
                }
            }
            let var10: number = requireNonNull(Pix3D.textureProvider as HdTextureProvider | null).brightness(material & 65535);
            if (var10 !== 0) {
                var10 = (var10 + 256) | 0;
                let var7: number = Math.imul((var4 & 16711680) >> 16, var10);
                if (var7 > 65535) {
                    var7 = 65535;
                }
                let var12: number = Math.imul((var4 & 65280) >> 8, var10);
                if (var12 > 65535) {
                    var12 = 65535;
                }
                let var9: number = Math.imul(var4 & 255, var10);
                if (var9 > 65535) {
                    var9 = 65535;
                }
                var4 = (((((var7 << 8) & 16711680) + (var12 & 65280)) | 0) + (var9 >> 8)) | 0;
            }
        }
        return ((var4 << 8) + ((255 - (alpha & 255)) | 0)) | 0;
    }

    // td.a(IIIIFFF)[F
    private static textureBasis(var0: number, var1: number, var2: number, var3: number, var4: number, var5: number, var6: number): Float32Array | null {
        const var7: Float32Array | null = new Float32Array(9);
        let var8: Float32Array | null = new Float32Array(9);
        let var9: number = Math.fround(Math.cos(Math.fround(Math.fround(var3) * Math.fround(0.024543693))));
        let var10: number = Math.fround(Math.sin(Math.fround(Math.fround(var3) * Math.fround(0.024543693))));
        let var11: number = Math.fround(Math.fround(1.0) - var9);
        arrayPutF32(var7, 0, var9);
        arrayPutF32(var7, 1, Math.fround(0.0));
        arrayPutF32(var7, 2, var10);
        arrayPutF32(var7, 3, Math.fround(0.0));
        arrayPutF32(var7, 4, Math.fround(1.0));
        arrayPutF32(var7, 5, Math.fround(0.0));
        arrayPutF32(var7, 6, -var10);
        arrayPutF32(var7, 7, Math.fround(0.0));
        arrayPutF32(var7, 8, var9);
        const var12: Float32Array | null = new Float32Array(9);
        let var13: number = Math.fround(1.0);
        let var14: number = Math.fround(0.0);
        var9 = Math.fround(Math.fround(var1) / Math.fround(32767.0));
        var10 = -Math.fround(Math.sqrt(Math.fround(Math.fround(1.0) - Math.fround(var9 * var9))));
        var11 = Math.fround(Math.fround(1.0) - var9);
        const var15: number = Math.fround(Math.sqrt((Math.imul(var0, var0) + Math.imul(var2, var2)) | 0));
        if (var15 === Math.fround(0.0) && var9 === Math.fround(0.0)) {
            var8 = var7;
        } else {
            if (var15 !== Math.fround(0.0)) {
                var13 = Math.fround(Math.fround(-var2 | 0) / var15);
                var14 = Math.fround(Math.fround(var0) / var15);
            }
            arrayPutF32(var12, 0, Math.fround(var9 + Math.fround(Math.fround(var13 * var13) * var11)));
            arrayPutF32(var12, 1, Math.fround(var14 * var10));
            arrayPutF32(var12, 2, Math.fround(Math.fround(var14 * var13) * var11));
            arrayPutF32(var12, 3, Math.fround(-var14 * var10));
            arrayPutF32(var12, 4, var9);
            arrayPutF32(var12, 5, Math.fround(var13 * var10));
            arrayPutF32(var12, 6, Math.fround(Math.fround(var13 * var14) * var11));
            arrayPutF32(var12, 7, Math.fround(-var13 * var10));
            arrayPutF32(var12, 8, Math.fround(var9 + Math.fround(Math.fround(var14 * var14) * var11)));
            arrayPutF32(var8, 0, Math.fround(Math.fround(Math.fround(arrayAtF32(var7, 0) * arrayAtF32(var12, 0)) + Math.fround(arrayAtF32(var7, 1) * arrayAtF32(var12, 3))) + Math.fround(arrayAtF32(var7, 2) * arrayAtF32(var12, 6))));
            arrayPutF32(var8, 1, Math.fround(Math.fround(Math.fround(arrayAtF32(var7, 0) * arrayAtF32(var12, 1)) + Math.fround(arrayAtF32(var7, 1) * arrayAtF32(var12, 4))) + Math.fround(arrayAtF32(var7, 2) * arrayAtF32(var12, 7))));
            arrayPutF32(var8, 2, Math.fround(Math.fround(Math.fround(arrayAtF32(var7, 0) * arrayAtF32(var12, 2)) + Math.fround(arrayAtF32(var7, 1) * arrayAtF32(var12, 5))) + Math.fround(arrayAtF32(var7, 2) * arrayAtF32(var12, 8))));
            arrayPutF32(var8, 3, Math.fround(Math.fround(Math.fround(arrayAtF32(var7, 3) * arrayAtF32(var12, 0)) + Math.fround(arrayAtF32(var7, 4) * arrayAtF32(var12, 3))) + Math.fround(arrayAtF32(var7, 5) * arrayAtF32(var12, 6))));
            arrayPutF32(var8, 4, Math.fround(Math.fround(Math.fround(arrayAtF32(var7, 3) * arrayAtF32(var12, 1)) + Math.fround(arrayAtF32(var7, 4) * arrayAtF32(var12, 4))) + Math.fround(arrayAtF32(var7, 5) * arrayAtF32(var12, 7))));
            arrayPutF32(var8, 5, Math.fround(Math.fround(Math.fround(arrayAtF32(var7, 3) * arrayAtF32(var12, 2)) + Math.fround(arrayAtF32(var7, 4) * arrayAtF32(var12, 5))) + Math.fround(arrayAtF32(var7, 5) * arrayAtF32(var12, 8))));
            arrayPutF32(var8, 6, Math.fround(Math.fround(Math.fround(arrayAtF32(var7, 6) * arrayAtF32(var12, 0)) + Math.fround(arrayAtF32(var7, 7) * arrayAtF32(var12, 3))) + Math.fround(arrayAtF32(var7, 8) * arrayAtF32(var12, 6))));
            arrayPutF32(var8, 7, Math.fround(Math.fround(Math.fround(arrayAtF32(var7, 6) * arrayAtF32(var12, 1)) + Math.fround(arrayAtF32(var7, 7) * arrayAtF32(var12, 4))) + Math.fround(arrayAtF32(var7, 8) * arrayAtF32(var12, 7))));
            arrayPutF32(var8, 8, Math.fround(Math.fround(Math.fround(arrayAtF32(var7, 6) * arrayAtF32(var12, 2)) + Math.fround(arrayAtF32(var7, 7) * arrayAtF32(var12, 5))) + Math.fround(arrayAtF32(var7, 8) * arrayAtF32(var12, 8))));
        }
        arrayPutF32(var8, 0, Math.fround(arrayAtF32(var8, 0) * var4));
        arrayPutF32(var8, 1, Math.fround(arrayAtF32(var8, 1) * var4));
        arrayPutF32(var8, 2, Math.fround(arrayAtF32(var8, 2) * var4));
        arrayPutF32(var8, 3, Math.fround(arrayAtF32(var8, 3) * var5));
        arrayPutF32(var8, 4, Math.fround(arrayAtF32(var8, 4) * var5));
        arrayPutF32(var8, 5, Math.fround(arrayAtF32(var8, 5) * var5));
        arrayPutF32(var8, 6, Math.fround(arrayAtF32(var8, 6) * var6));
        arrayPutF32(var8, 7, Math.fround(arrayAtF32(var8, 7) * var6));
        arrayPutF32(var8, 8, Math.fround(arrayAtF32(var8, 8) * var6));
        return var8;
    }

    // td.a(Lgb;IJIIIIFF)S
    private addVertex(_source: ModelUnlit | null, vertex: number, key: bigint, normalX: number, normalY: number, normalZ: number, weight: number, u: ModelUv, v: ModelUv): number {
        const var11: number = arrayAtI32(this.vertexOffsets, vertex);
        const var12: number = arrayAtI32(this.vertexOffsets, (vertex + 1) | 0);
        let var13: number = 0;
        for (let var14: number = var11; var14 < var12; var14++) {
            const var15: number = arrayAtI16(this.vertexIndices, var14);
            if (var15 === 0) {
                var13 = var14;
                break;
            }
            if (arrayAtB64(GlModel.vertexKeys, var14) === key) {
                return (((var15 - 1) | 0) << 16) >> 16;
            }
        }
        arrayPutI16(this.vertexIndices, var13, (((this.expandedVertexCount + 1) | 0) << 16) >> 16);
        arrayPutB64(GlModel.vertexKeys, var13, key);
        arrayPutI16(this.normalX, this.expandedVertexCount, (normalX << 16) >> 16);
        arrayPutI16(this.normalY, this.expandedVertexCount, (normalY << 16) >> 16);
        arrayPutI16(this.normalZ, this.expandedVertexCount, (normalZ << 16) >> 16);
        arrayPutI16(this.normalCount, this.expandedVertexCount, (weight << 16) >> 16);
        putUv(this.texU, this.expandedVertexCount, u);
        putUv(this.texV, this.expandedVertexCount, v);
        return (this.expandedVertexCount++ << 16) >> 16;
    }

    // td.b(I)V
    RotateYAxis(angle: number): void {
        const var2: number = arrayAtI32(Pix3D.sinTable, angle);
        const var3: number = arrayAtI32(Pix3D.cosTable, angle);
        for (let var4: number = 0; var4 < this.vertexCount; var4++) {
            const var5: number = ((Math.imul(arrayAtI32(this.pointZ, var4), var2) + Math.imul(arrayAtI32(this.pointX, var4), var3)) | 0) >> 16;
            arrayPutI32(this.pointZ, var4, ((Math.imul(arrayAtI32(this.pointZ, var4), var3) - Math.imul(arrayAtI32(this.pointX, var4), var2)) | 0) >> 16);
            arrayPutI32(this.pointX, var4, var5);
        }
        requireNonNull(this.bounds).valid = false;
        requireNonNull(this.positionStream).valid = false;
    }

    // td.a(I[IIIIZI[I)V
    animate2Masked(opcode: number, labels: Int32Array | null, x: number, y: number, z: number, rotateNormals: boolean, mask: number, transform: Int32Array | null): void {
        const var9: number = requireNonNull(labels).length;
        if (opcode === 0) {
            x = x << 4;
            y = y << 4;
            z = z << 4;
            let var61: number = 0;
            GlModel.pivotX = 0;
            GlModel.pivotY = 0;
            GlModel.pivotZ = 0;
            for (let var70: number = 0; var70 < var9; var70++) {
                const var79: number = arrayAtI32(labels, var70);
                if (var79 < requireNonNull(this.labelVertices).length) {
                    const var87: Int32Array | null = arrayAtObj(this.labelVertices, var79);
                    for (let var95: number = 0; var95 < requireNonNull(var87).length; var95++) {
                        const var103: number = arrayAtI32(var87, var95);
                        if (this.pointPartMask === null || (mask & arrayAtI16(this.pointPartMask, var103)) !== 0) {
                            GlModel.pivotX = (GlModel.pivotX + arrayAtI32(this.pointX, var103)) | 0;
                            GlModel.pivotY = (GlModel.pivotY + arrayAtI32(this.pointY, var103)) | 0;
                            GlModel.pivotZ = (GlModel.pivotZ + arrayAtI32(this.pointZ, var103)) | 0;
                            var61++;
                        }
                    }
                }
            }
            if (var61 > 0) {
                GlModel.pivotX = (intDivide(GlModel.pivotX, var61) + x) | 0;
                GlModel.pivotY = (intDivide(GlModel.pivotY, var61) + y) | 0;
                GlModel.pivotZ = (intDivide(GlModel.pivotZ, var61) + z) | 0;
                GlModel.transformOrigin = true;
            } else {
                GlModel.pivotX = x;
                GlModel.pivotY = y;
                GlModel.pivotZ = z;
            }
        } else {
            if (opcode === 1) {
                if (transform !== null) {
                    const var59: number = ((((((Math.imul(arrayAtI32(transform, 0), x) + Math.imul(arrayAtI32(transform, 1), y)) | 0) + Math.imul(arrayAtI32(transform, 2), z)) | 0) + 16384) | 0) >> 15;
                    const var68: number = ((((((Math.imul(arrayAtI32(transform, 3), x) + Math.imul(arrayAtI32(transform, 4), y)) | 0) + Math.imul(arrayAtI32(transform, 5), z)) | 0) + 16384) | 0) >> 15;
                    const var77: number = ((((((Math.imul(arrayAtI32(transform, 6), x) + Math.imul(arrayAtI32(transform, 7), y)) | 0) + Math.imul(arrayAtI32(transform, 8), z)) | 0) + 16384) | 0) >> 15;
                    x = var59;
                    y = var68;
                    z = var77;
                }
                x = x << 4;
                y = y << 4;
                z = z << 4;
                for (let var60: number = 0; var60 < var9; var60++) {
                    const var69: number = arrayAtI32(labels, var60);
                    if (var69 < requireNonNull(this.labelVertices).length) {
                        const var78: Int32Array | null = arrayAtObj(this.labelVertices, var69);
                        for (let var86: number = 0; var86 < requireNonNull(var78).length; var86++) {
                            const var94: number = arrayAtI32(var78, var86);
                            if (this.pointPartMask === null || (mask & arrayAtI16(this.pointPartMask, var94)) !== 0) {
                                arrayPutI32(this.pointX, var94, (arrayAtI32(this.pointX, var94) + x) | 0);
                                arrayPutI32(this.pointY, var94, (arrayAtI32(this.pointY, var94) + y) | 0);
                                arrayPutI32(this.pointZ, var94, (arrayAtI32(this.pointZ, var94) + z) | 0);
                            }
                        }
                    }
                }
            } else {
                if (opcode === 2) {
                    if (transform !== null) {
                        const var56: number = arrayAtI32(transform, 9) << 4;
                        const var65: number = arrayAtI32(transform, 10) << 4;
                        const var74: number = arrayAtI32(transform, 11) << 4;
                        const var83: number = arrayAtI32(transform, 12) << 4;
                        const var91: number = arrayAtI32(transform, 13) << 4;
                        const var98: number = arrayAtI32(transform, 14) << 4;
                        if (GlModel.transformOrigin) {
                            let var108: number = ((((((Math.imul(arrayAtI32(transform, 0), GlModel.pivotX) + Math.imul(arrayAtI32(transform, 3), GlModel.pivotY)) | 0) + Math.imul(arrayAtI32(transform, 6), GlModel.pivotZ)) | 0) + 16384) | 0) >> 15;
                            let var119: number = ((((((Math.imul(arrayAtI32(transform, 1), GlModel.pivotX) + Math.imul(arrayAtI32(transform, 4), GlModel.pivotY)) | 0) + Math.imul(arrayAtI32(transform, 7), GlModel.pivotZ)) | 0) + 16384) | 0) >> 15;
                            let var130: number = ((((((Math.imul(arrayAtI32(transform, 2), GlModel.pivotX) + Math.imul(arrayAtI32(transform, 5), GlModel.pivotY)) | 0) + Math.imul(arrayAtI32(transform, 8), GlModel.pivotZ)) | 0) + 16384) | 0) >> 15;
                            var108 = (var108 + var83) | 0;
                            var119 = (var119 + var91) | 0;
                            var130 = (var130 + var98) | 0;
                            GlModel.pivotX = var108;
                            GlModel.pivotY = var119;
                            GlModel.pivotZ = var130;
                            GlModel.transformOrigin = false;
                        }
                        const var110: Int32Array | null = new Int32Array(9);
                        const var121: number = arrayAtI32(Pix3D.cosTable, x) >> 1;
                        const var132: number = arrayAtI32(Pix3D.sinTable, x) >> 1;
                        const var134: number = arrayAtI32(Pix3D.cosTable, y) >> 1;
                        const var138: number = arrayAtI32(Pix3D.sinTable, y) >> 1;
                        const var142: number = arrayAtI32(Pix3D.cosTable, z) >> 1;
                        const var146: number = arrayAtI32(Pix3D.sinTable, z) >> 1;
                        const var147: number = ((Math.imul(var132, var142) + 16384) | 0) >> 15;
                        const var148: number = ((Math.imul(var132, var146) + 16384) | 0) >> 15;
                        arrayPutI32(var110, 0, ((((Math.imul(var134, var142) + Math.imul(var138, var148)) | 0) + 16384) | 0) >> 15);
                        arrayPutI32(var110, 1, ((((Math.imul(-var134 | 0, var146) + Math.imul(var138, var147)) | 0) + 16384) | 0) >> 15);
                        arrayPutI32(var110, 2, ((Math.imul(var138, var121) + 16384) | 0) >> 15);
                        arrayPutI32(var110, 3, ((Math.imul(var121, var146) + 16384) | 0) >> 15);
                        arrayPutI32(var110, 4, ((Math.imul(var121, var142) + 16384) | 0) >> 15);
                        arrayPutI32(var110, 5, -var132 | 0);
                        arrayPutI32(var110, 6, ((((Math.imul(-var138 | 0, var142) + Math.imul(var134, var148)) | 0) + 16384) | 0) >> 15);
                        arrayPutI32(var110, 7, ((((Math.imul(var138, var146) + Math.imul(var134, var147)) | 0) + 16384) | 0) >> 15);
                        arrayPutI32(var110, 8, ((Math.imul(var134, var121) + 16384) | 0) >> 15);
                        const var149: number =
                            ((((((Math.imul(arrayAtI32(var110, 0), -GlModel.pivotX | 0) + Math.imul(arrayAtI32(var110, 1), -GlModel.pivotY | 0)) | 0) + Math.imul(arrayAtI32(var110, 2), -GlModel.pivotZ | 0)) | 0) + 16384) | 0) >> 15;
                        const var151: number =
                            ((((((Math.imul(arrayAtI32(var110, 3), -GlModel.pivotX | 0) + Math.imul(arrayAtI32(var110, 4), -GlModel.pivotY | 0)) | 0) + Math.imul(arrayAtI32(var110, 5), -GlModel.pivotZ | 0)) | 0) + 16384) | 0) >> 15;
                        const var153: number =
                            ((((((Math.imul(arrayAtI32(var110, 6), -GlModel.pivotX | 0) + Math.imul(arrayAtI32(var110, 7), -GlModel.pivotY | 0)) | 0) + Math.imul(arrayAtI32(var110, 8), -GlModel.pivotZ | 0)) | 0) + 16384) | 0) >> 15;
                        const var155: number = (var149 + GlModel.pivotX) | 0;
                        const var156: number = (var151 + GlModel.pivotY) | 0;
                        const var159: number = (var153 + GlModel.pivotZ) | 0;
                        const var162: Int32Array | null = new Int32Array(9);
                        for (let var165: number = 0; var165 < 3; var165++) {
                            for (let var169: number = 0; var169 < 3; var169++) {
                                let var172: number = 0;
                                for (let var175: number = 0; var175 < 3; var175++) {
                                    var172 = (var172 + Math.imul(arrayAtI32(var110, (Math.imul(var165, 3) + var175) | 0), arrayAtI32(transform, (Math.imul(var169, 3) + var175) | 0))) | 0;
                                }
                                arrayPutI32(var162, (Math.imul(var165, 3) + var169) | 0, ((var172 + 16384) | 0) >> 15);
                            }
                        }
                        let var166: number = ((((((Math.imul(arrayAtI32(var110, 0), var83) + Math.imul(arrayAtI32(var110, 1), var91)) | 0) + Math.imul(arrayAtI32(var110, 2), var98)) | 0) + 16384) | 0) >> 15;
                        let var170: number = ((((((Math.imul(arrayAtI32(var110, 3), var83) + Math.imul(arrayAtI32(var110, 4), var91)) | 0) + Math.imul(arrayAtI32(var110, 5), var98)) | 0) + 16384) | 0) >> 15;
                        let var173: number = ((((((Math.imul(arrayAtI32(var110, 6), var83) + Math.imul(arrayAtI32(var110, 7), var91)) | 0) + Math.imul(arrayAtI32(var110, 8), var98)) | 0) + 16384) | 0) >> 15;
                        var166 = (var166 + var155) | 0;
                        var170 = (var170 + var156) | 0;
                        var173 = (var173 + var159) | 0;
                        const var176: Int32Array | null = new Int32Array(9);
                        for (let var177: number = 0; var177 < 3; var177++) {
                            for (let var180: number = 0; var180 < 3; var180++) {
                                let var184: number = 0;
                                for (let var188: number = 0; var188 < 3; var188++) {
                                    var184 = (var184 + Math.imul(arrayAtI32(transform, (Math.imul(var177, 3) + var188) | 0), arrayAtI32(var162, (var180 + Math.imul(var188, 3)) | 0))) | 0;
                                }
                                arrayPutI32(var176, (Math.imul(var177, 3) + var180) | 0, ((var184 + 16384) | 0) >> 15);
                            }
                        }
                        let var178: number = ((((((Math.imul(arrayAtI32(transform, 0), var166) + Math.imul(arrayAtI32(transform, 1), var170)) | 0) + Math.imul(arrayAtI32(transform, 2), var173)) | 0) + 16384) | 0) >> 15;
                        let var181: number = ((((((Math.imul(arrayAtI32(transform, 3), var166) + Math.imul(arrayAtI32(transform, 4), var170)) | 0) + Math.imul(arrayAtI32(transform, 5), var173)) | 0) + 16384) | 0) >> 15;
                        let var185: number = ((((((Math.imul(arrayAtI32(transform, 6), var166) + Math.imul(arrayAtI32(transform, 7), var170)) | 0) + Math.imul(arrayAtI32(transform, 8), var173)) | 0) + 16384) | 0) >> 15;
                        var178 = (var178 + var56) | 0;
                        var181 = (var181 + var65) | 0;
                        var185 = (var185 + var74) | 0;
                        for (let var189: number = 0; var189 < var9; var189++) {
                            const var191: number = arrayAtI32(labels, var189);
                            if (var191 < requireNonNull(this.labelVertices).length) {
                                const var41: Int32Array | null = arrayAtObj(this.labelVertices, var191);
                                for (let var42: number = 0; var42 < requireNonNull(var41).length; var42++) {
                                    const var43: number = arrayAtI32(var41, var42);
                                    if (this.pointPartMask === null || (mask & arrayAtI16(this.pointPartMask, var43)) !== 0) {
                                        let var44: number =
                                            ((((((Math.imul(arrayAtI32(var176, 0), arrayAtI32(this.pointX, var43)) + Math.imul(arrayAtI32(var176, 1), arrayAtI32(this.pointY, var43))) | 0) +
                                                Math.imul(arrayAtI32(var176, 2), arrayAtI32(this.pointZ, var43))) |
                                                0) +
                                                16384) |
                                                0) >>
                                            15;
                                        let var45: number =
                                            ((((((Math.imul(arrayAtI32(var176, 3), arrayAtI32(this.pointX, var43)) + Math.imul(arrayAtI32(var176, 4), arrayAtI32(this.pointY, var43))) | 0) +
                                                Math.imul(arrayAtI32(var176, 5), arrayAtI32(this.pointZ, var43))) |
                                                0) +
                                                16384) |
                                                0) >>
                                            15;
                                        let var46: number =
                                            ((((((Math.imul(arrayAtI32(var176, 6), arrayAtI32(this.pointX, var43)) + Math.imul(arrayAtI32(var176, 7), arrayAtI32(this.pointY, var43))) | 0) +
                                                Math.imul(arrayAtI32(var176, 8), arrayAtI32(this.pointZ, var43))) |
                                                0) +
                                                16384) |
                                                0) >>
                                            15;
                                        var44 = (var44 + var178) | 0;
                                        var45 = (var45 + var181) | 0;
                                        var46 = (var46 + var185) | 0;
                                        arrayPutI32(this.pointX, var43, var44);
                                        arrayPutI32(this.pointY, var43, var45);
                                        arrayPutI32(this.pointZ, var43, var46);
                                    }
                                }
                            }
                        }
                    } else {
                        for (let var57: number = 0; var57 < var9; var57++) {
                            const var66: number = arrayAtI32(labels, var57);
                            if (var66 < requireNonNull(this.labelVertices).length) {
                                const var75: Int32Array | null = arrayAtObj(this.labelVertices, var66);
                                for (let var84: number = 0; var84 < requireNonNull(var75).length; var84++) {
                                    const var92: number = arrayAtI32(var75, var84);
                                    if (this.pointPartMask === null || (mask & arrayAtI16(this.pointPartMask, var92)) !== 0) {
                                        arrayPutI32(this.pointX, var92, (arrayAtI32(this.pointX, var92) - GlModel.pivotX) | 0);
                                        arrayPutI32(this.pointY, var92, (arrayAtI32(this.pointY, var92) - GlModel.pivotY) | 0);
                                        arrayPutI32(this.pointZ, var92, (arrayAtI32(this.pointZ, var92) - GlModel.pivotZ) | 0);
                                        if (z !== 0) {
                                            const var99: number = arrayAtI32(Pix3D.sinTable, z);
                                            const var111: number = arrayAtI32(Pix3D.cosTable, z);
                                            const var122: number = ((((Math.imul(arrayAtI32(this.pointY, var92), var99) + Math.imul(arrayAtI32(this.pointX, var92), var111)) | 0) + 32767) | 0) >> 16;
                                            arrayPutI32(this.pointY, var92, ((((Math.imul(arrayAtI32(this.pointY, var92), var111) - Math.imul(arrayAtI32(this.pointX, var92), var99)) | 0) + 32767) | 0) >> 16);
                                            arrayPutI32(this.pointX, var92, var122);
                                        }
                                        if (x !== 0) {
                                            const var100: number = arrayAtI32(Pix3D.sinTable, x);
                                            const var112: number = arrayAtI32(Pix3D.cosTable, x);
                                            const var123: number = ((((Math.imul(arrayAtI32(this.pointY, var92), var112) - Math.imul(arrayAtI32(this.pointZ, var92), var100)) | 0) + 32767) | 0) >> 16;
                                            arrayPutI32(this.pointZ, var92, ((((Math.imul(arrayAtI32(this.pointY, var92), var100) + Math.imul(arrayAtI32(this.pointZ, var92), var112)) | 0) + 32767) | 0) >> 16);
                                            arrayPutI32(this.pointY, var92, var123);
                                        }
                                        if (y !== 0) {
                                            const var101: number = arrayAtI32(Pix3D.sinTable, y);
                                            const var113: number = arrayAtI32(Pix3D.cosTable, y);
                                            const var124: number = ((((Math.imul(arrayAtI32(this.pointZ, var92), var101) + Math.imul(arrayAtI32(this.pointX, var92), var113)) | 0) + 32767) | 0) >> 16;
                                            arrayPutI32(this.pointZ, var92, ((((Math.imul(arrayAtI32(this.pointZ, var92), var113) - Math.imul(arrayAtI32(this.pointX, var92), var101)) | 0) + 32767) | 0) >> 16);
                                            arrayPutI32(this.pointX, var92, var124);
                                        }
                                        arrayPutI32(this.pointX, var92, (arrayAtI32(this.pointX, var92) + GlModel.pivotX) | 0);
                                        arrayPutI32(this.pointY, var92, (arrayAtI32(this.pointY, var92) + GlModel.pivotY) | 0);
                                        arrayPutI32(this.pointZ, var92, (arrayAtI32(this.pointZ, var92) + GlModel.pivotZ) | 0);
                                    }
                                }
                            }
                        }
                        if (rotateNormals && this.normalX !== null) {
                            for (let var58: number = 0; var58 < var9; var58++) {
                                const var67: number = arrayAtI32(labels, var58);
                                if (var67 < requireNonNull(this.labelVertices).length) {
                                    const var76: Int32Array | null = arrayAtObj(this.labelVertices, var67);
                                    for (let var85: number = 0; var85 < requireNonNull(var76).length; var85++) {
                                        const var93: number = arrayAtI32(var76, var85);
                                        if (this.pointPartMask === null || (mask & arrayAtI16(this.pointPartMask, var93)) !== 0) {
                                            const var102: number = arrayAtI32(this.vertexOffsets, var93);
                                            const var114: number = arrayAtI32(this.vertexOffsets, (var93 + 1) | 0);
                                            for (let var125: number = var102; var125 < var114; var125++) {
                                                const var133: number = (arrayAtI16(this.vertexIndices, var125) - 1) | 0;
                                                if (var133 === -1) {
                                                    break;
                                                }
                                                if (z !== 0) {
                                                    const var135: number = arrayAtI32(Pix3D.sinTable, z);
                                                    const var139: number = arrayAtI32(Pix3D.cosTable, z);
                                                    const var143: number = ((((Math.imul(arrayAtI16(this.normalY, var133), var135) + Math.imul(arrayAtI16(this.normalX, var133), var139)) | 0) + 32767) | 0) >> 16;
                                                    arrayPutI16(this.normalY, var133, ((((((Math.imul(arrayAtI16(this.normalY, var133), var139) - Math.imul(arrayAtI16(this.normalX, var133), var135)) | 0) + 32767) | 0) >> 16) << 16) >> 16);
                                                    arrayPutI16(this.normalX, var133, (var143 << 16) >> 16);
                                                }
                                                if (x !== 0) {
                                                    const var136: number = arrayAtI32(Pix3D.sinTable, x);
                                                    const var140: number = arrayAtI32(Pix3D.cosTable, x);
                                                    const var144: number = ((((Math.imul(arrayAtI16(this.normalY, var133), var140) - Math.imul(arrayAtI16(this.normalZ, var133), var136)) | 0) + 32767) | 0) >> 16;
                                                    arrayPutI16(this.normalZ, var133, ((((((Math.imul(arrayAtI16(this.normalY, var133), var136) + Math.imul(arrayAtI16(this.normalZ, var133), var140)) | 0) + 32767) | 0) >> 16) << 16) >> 16);
                                                    arrayPutI16(this.normalY, var133, (var144 << 16) >> 16);
                                                }
                                                if (y !== 0) {
                                                    const var137: number = arrayAtI32(Pix3D.sinTable, y);
                                                    const var141: number = arrayAtI32(Pix3D.cosTable, y);
                                                    const var145: number = ((((Math.imul(arrayAtI16(this.normalZ, var133), var137) + Math.imul(arrayAtI16(this.normalX, var133), var141)) | 0) + 32767) | 0) >> 16;
                                                    arrayPutI16(this.normalZ, var133, ((((((Math.imul(arrayAtI16(this.normalZ, var133), var141) - Math.imul(arrayAtI16(this.normalX, var133), var137)) | 0) + 32767) | 0) >> 16) << 16) >> 16);
                                                    arrayPutI16(this.normalX, var133, (var145 << 16) >> 16);
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            if (this.normalStream !== null) {
                                requireNonNull(this.normalStream).valid = false;
                            }
                        }
                    }
                } else {
                    if (opcode === 3) {
                        if (transform !== null) {
                            const var54: number = arrayAtI32(transform, 9) << 4;
                            const var63: number = arrayAtI32(transform, 10) << 4;
                            const var72: number = arrayAtI32(transform, 11) << 4;
                            const var81: number = arrayAtI32(transform, 12) << 4;
                            const var89: number = arrayAtI32(transform, 13) << 4;
                            const var97: number = arrayAtI32(transform, 14) << 4;
                            if (GlModel.transformOrigin) {
                                let var105: number =
                                    ((((((Math.imul(arrayAtI32(transform, 0), GlModel.pivotX) + Math.imul(arrayAtI32(transform, 3), GlModel.pivotY)) | 0) + Math.imul(arrayAtI32(transform, 6), GlModel.pivotZ)) | 0) + 16384) | 0) >> 15;
                                let var116: number =
                                    ((((((Math.imul(arrayAtI32(transform, 1), GlModel.pivotX) + Math.imul(arrayAtI32(transform, 4), GlModel.pivotY)) | 0) + Math.imul(arrayAtI32(transform, 7), GlModel.pivotZ)) | 0) + 16384) | 0) >> 15;
                                let var127: number =
                                    ((((((Math.imul(arrayAtI32(transform, 2), GlModel.pivotX) + Math.imul(arrayAtI32(transform, 5), GlModel.pivotY)) | 0) + Math.imul(arrayAtI32(transform, 8), GlModel.pivotZ)) | 0) + 16384) | 0) >> 15;
                                var105 = (var105 + var81) | 0;
                                var116 = (var116 + var89) | 0;
                                var127 = (var127 + var97) | 0;
                                GlModel.pivotX = var105;
                                GlModel.pivotY = var116;
                                GlModel.pivotZ = var127;
                                GlModel.transformOrigin = false;
                            }
                            const var107: number = (x << 15) >> 7;
                            const var118: number = (y << 15) >> 7;
                            const var129: number = (z << 15) >> 7;
                            const var19: number = ((Math.imul(var107, -GlModel.pivotX | 0) + 16384) | 0) >> 15;
                            const var20: number = ((Math.imul(var118, -GlModel.pivotY | 0) + 16384) | 0) >> 15;
                            const var21: number = ((Math.imul(var129, -GlModel.pivotZ | 0) + 16384) | 0) >> 15;
                            const var22: number = (var19 + GlModel.pivotX) | 0;
                            const var23: number = (var20 + GlModel.pivotY) | 0;
                            const var24: number = (var21 + GlModel.pivotZ) | 0;
                            const var25: Int32Array | null = Int32Array.of(
                                ((Math.imul(var107, arrayAtI32(transform, 0)) + 16384) | 0) >> 15,
                                ((Math.imul(var107, arrayAtI32(transform, 3)) + 16384) | 0) >> 15,
                                ((Math.imul(var107, arrayAtI32(transform, 6)) + 16384) | 0) >> 15,
                                ((Math.imul(var118, arrayAtI32(transform, 1)) + 16384) | 0) >> 15,
                                ((Math.imul(var118, arrayAtI32(transform, 4)) + 16384) | 0) >> 15,
                                ((Math.imul(var118, arrayAtI32(transform, 7)) + 16384) | 0) >> 15,
                                ((Math.imul(var129, arrayAtI32(transform, 2)) + 16384) | 0) >> 15,
                                ((Math.imul(var129, arrayAtI32(transform, 5)) + 16384) | 0) >> 15,
                                ((Math.imul(var129, arrayAtI32(transform, 8)) + 16384) | 0) >> 15
                            );
                            let var26: number = ((Math.imul(var107, var81) + 16384) | 0) >> 15;
                            let var27: number = ((Math.imul(var118, var89) + 16384) | 0) >> 15;
                            let var28: number = ((Math.imul(var129, var97) + 16384) | 0) >> 15;
                            var26 = (var26 + var22) | 0;
                            var27 = (var27 + var23) | 0;
                            var28 = (var28 + var24) | 0;
                            const var29: Int32Array | null = new Int32Array(9);
                            for (let var30: number = 0; var30 < 3; var30++) {
                                for (let var31: number = 0; var31 < 3; var31++) {
                                    let var32: number = 0;
                                    for (let var33: number = 0; var33 < 3; var33++) {
                                        var32 = (var32 + Math.imul(arrayAtI32(transform, (Math.imul(var30, 3) + var33) | 0), arrayAtI32(var25, (var31 + Math.imul(var33, 3)) | 0))) | 0;
                                    }
                                    arrayPutI32(var29, (Math.imul(var30, 3) + var31) | 0, ((var32 + 16384) | 0) >> 15);
                                }
                            }
                            let var157: number = ((((((Math.imul(arrayAtI32(transform, 0), var26) + Math.imul(arrayAtI32(transform, 1), var27)) | 0) + Math.imul(arrayAtI32(transform, 2), var28)) | 0) + 16384) | 0) >> 15;
                            let var160: number = ((((((Math.imul(arrayAtI32(transform, 3), var26) + Math.imul(arrayAtI32(transform, 4), var27)) | 0) + Math.imul(arrayAtI32(transform, 5), var28)) | 0) + 16384) | 0) >> 15;
                            let var163: number = ((((((Math.imul(arrayAtI32(transform, 6), var26) + Math.imul(arrayAtI32(transform, 7), var27)) | 0) + Math.imul(arrayAtI32(transform, 8), var28)) | 0) + 16384) | 0) >> 15;
                            var157 = (var157 + var54) | 0;
                            var160 = (var160 + var63) | 0;
                            var163 = (var163 + var72) | 0;
                            for (let var168: number = 0; var168 < var9; var168++) {
                                const var34: number = arrayAtI32(labels, var168);
                                if (var34 < requireNonNull(this.labelVertices).length) {
                                    const var35: Int32Array | null = arrayAtObj(this.labelVertices, var34);
                                    for (let var36: number = 0; var36 < requireNonNull(var35).length; var36++) {
                                        const var37: number = arrayAtI32(var35, var36);
                                        if (this.pointPartMask === null || (mask & arrayAtI16(this.pointPartMask, var37)) !== 0) {
                                            let var38: number =
                                                ((((((Math.imul(arrayAtI32(var29, 0), arrayAtI32(this.pointX, var37)) + Math.imul(arrayAtI32(var29, 1), arrayAtI32(this.pointY, var37))) | 0) +
                                                    Math.imul(arrayAtI32(var29, 2), arrayAtI32(this.pointZ, var37))) |
                                                    0) +
                                                    16384) |
                                                    0) >>
                                                15;
                                            let var39: number =
                                                ((((((Math.imul(arrayAtI32(var29, 3), arrayAtI32(this.pointX, var37)) + Math.imul(arrayAtI32(var29, 4), arrayAtI32(this.pointY, var37))) | 0) +
                                                    Math.imul(arrayAtI32(var29, 5), arrayAtI32(this.pointZ, var37))) |
                                                    0) +
                                                    16384) |
                                                    0) >>
                                                15;
                                            let var40: number =
                                                ((((((Math.imul(arrayAtI32(var29, 6), arrayAtI32(this.pointX, var37)) + Math.imul(arrayAtI32(var29, 7), arrayAtI32(this.pointY, var37))) | 0) +
                                                    Math.imul(arrayAtI32(var29, 8), arrayAtI32(this.pointZ, var37))) |
                                                    0) +
                                                    16384) |
                                                    0) >>
                                                15;
                                            var38 = (var38 + var157) | 0;
                                            var39 = (var39 + var160) | 0;
                                            var40 = (var40 + var163) | 0;
                                            arrayPutI32(this.pointX, var37, var38);
                                            arrayPutI32(this.pointY, var37, var39);
                                            arrayPutI32(this.pointZ, var37, var40);
                                        }
                                    }
                                }
                            }
                        } else {
                            for (let var55: number = 0; var55 < var9; var55++) {
                                const var64: number = arrayAtI32(labels, var55);
                                if (var64 < requireNonNull(this.labelVertices).length) {
                                    const var73: Int32Array | null = arrayAtObj(this.labelVertices, var64);
                                    for (let var82: number = 0; var82 < requireNonNull(var73).length; var82++) {
                                        const var90: number = arrayAtI32(var73, var82);
                                        if (this.pointPartMask === null || (mask & arrayAtI16(this.pointPartMask, var90)) !== 0) {
                                            arrayPutI32(this.pointX, var90, (arrayAtI32(this.pointX, var90) - GlModel.pivotX) | 0);
                                            arrayPutI32(this.pointY, var90, (arrayAtI32(this.pointY, var90) - GlModel.pivotY) | 0);
                                            arrayPutI32(this.pointZ, var90, (arrayAtI32(this.pointZ, var90) - GlModel.pivotZ) | 0);
                                            arrayPutI32(this.pointX, var90, Math.imul(arrayAtI32(this.pointX, var90), x) >> 7);
                                            arrayPutI32(this.pointY, var90, Math.imul(arrayAtI32(this.pointY, var90), y) >> 7);
                                            arrayPutI32(this.pointZ, var90, Math.imul(arrayAtI32(this.pointZ, var90), z) >> 7);
                                            arrayPutI32(this.pointX, var90, (arrayAtI32(this.pointX, var90) + GlModel.pivotX) | 0);
                                            arrayPutI32(this.pointY, var90, (arrayAtI32(this.pointY, var90) + GlModel.pivotY) | 0);
                                            arrayPutI32(this.pointZ, var90, (arrayAtI32(this.pointZ, var90) + GlModel.pivotZ) | 0);
                                        }
                                    }
                                }
                            }
                        }
                    } else {
                        if (opcode === 5) {
                            if (this.labelFaces !== null && this.faceAlpha !== null) {
                                for (let var53: number = 0; var53 < var9; var53++) {
                                    const var62: number = arrayAtI32(labels, var53);
                                    if (var62 < requireNonNull(this.labelFaces).length) {
                                        const var71: Int32Array | null = arrayAtObj(this.labelFaces, var62);
                                        for (let var80: number = 0; var80 < requireNonNull(var71).length; var80++) {
                                            const var88: number = arrayAtI32(var71, var80);
                                            if (this.facePartMask === null || (mask & arrayAtI16(this.facePartMask, var88)) !== 0) {
                                                let var96: number = ((((arrayAtU8(this.faceAlpha, var88) << 24) >> 24) & 255) + Math.imul(x, 8)) | 0;
                                                if (var96 < 0) {
                                                    var96 = 0;
                                                } else {
                                                    if (var96 > 255) {
                                                        var96 = 255;
                                                    }
                                                }
                                                arrayPutU8(this.faceAlpha, var88, (var96 << 24) >> 24);
                                            }
                                        }
                                        if (requireNonNull(var71).length > 0) {
                                            requireNonNull(this.colourStream).valid = false;
                                        }
                                    }
                                }
                            }
                        } else {
                            if (opcode === 7) {
                                if (this.labelFaces !== null) {
                                    for (let var10: number = 0; var10 < var9; var10++) {
                                        const var11: number = arrayAtI32(labels, var10);
                                        if (var11 < requireNonNull(this.labelFaces).length) {
                                            const var12: Int32Array | null = arrayAtObj(this.labelFaces, var11);
                                            for (let var13: number = 0; var13 < requireNonNull(var12).length; var13++) {
                                                const var14: number = arrayAtI32(var12, var13);
                                                if (this.facePartMask === null || (mask & arrayAtI16(this.facePartMask, var14)) !== 0) {
                                                    const var15: number = arrayAtI16(this.faceColour, var14) & 65535;
                                                    let var16: number = (var15 >> 10) & 63;
                                                    let var17: number = (var15 >> 7) & 7;
                                                    let var18: number = var15 & 127;
                                                    var16 = ((var16 + x) | 0) & 63;
                                                    var17 = (var17 + intDivide(y, 4)) | 0;
                                                    if (var17 < 0) {
                                                        var17 = 0;
                                                    } else {
                                                        if (var17 > 7) {
                                                            var17 = 7;
                                                        }
                                                    }
                                                    var18 = (var18 + z) | 0;
                                                    if (var18 < 0) {
                                                        var18 = 0;
                                                    } else {
                                                        if (var18 > 127) {
                                                            var18 = 127;
                                                        }
                                                    }
                                                    arrayPutI16(this.faceColour, var14, (((var16 << 10) | (var17 << 7) | var18) << 16) >> 16);
                                                }
                                            }
                                            if (requireNonNull(var12).length > 0) {
                                                requireNonNull(this.colourStream).valid = false;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // td.b()I
    getMinY(): number {
        if (!requireNonNull(this.bounds).valid) {
            this.calculateBounds();
        }
        return requireNonNull(this.bounds).minY;
    }

    // td.o()V
    buildAnimationTables(): void {
        if (this.vertexLabel !== null) {
            const var1: Int32Array | null = new Int32Array(256);
            let var2: number = 0;
            for (let var3: number = 0; var3 < this.vertexCount; var3++) {
                const var4: number = arrayAtI32(this.vertexLabel, var3) & 255;
                incrementIndex(var1, var4);
                if (var4 > var2) {
                    var2 = var4;
                }
            }
            this.labelVertices = new Array<Int32Array | null>((var2 + 1) | 0).fill(null);
            for (let var7: number = 0; var7 <= var2; var7++) {
                arrayPutObj(this.labelVertices, var7, new Int32Array(arrayAtI32(var1, var7)));
                arrayPutI32(var1, var7, 0);
            }
            let var8: number = 0;
            while (var8 < this.vertexCount) {
                const var12: number = arrayAtI32(this.vertexLabel, var8) & 255;
                arrayPutI32(arrayAtObj(this.labelVertices, var12), incrementIndex(var1, var12), var8++);
            }
            this.vertexLabel = null;
        }
        if (this.faceLabel !== null) {
            const var5: Int32Array | null = new Int32Array(256);
            let var6: number = 0;
            for (let var9: number = 0; var9 < this.faceCount; var9++) {
                const var13: number = ((arrayAtU8(this.faceLabel, var9) << 24) >> 24) & 255;
                incrementIndex(var5, var13);
                if (var13 > var6) {
                    var6 = var13;
                }
            }
            this.labelFaces = new Array<Int32Array | null>((var6 + 1) | 0).fill(null);
            for (let var10: number = 0; var10 <= var6; var10++) {
                arrayPutObj(this.labelFaces, var10, new Int32Array(arrayAtI32(var5, var10)));
                arrayPutI32(var5, var10, 0);
            }
            let var11: number = 0;
            while (var11 < this.faceCount) {
                const var14: number = ((arrayAtU8(this.faceLabel, var11) << 24) >> 24) & 255;
                arrayPutI32(arrayAtObj(this.labelFaces, var14), incrementIndex(var5, var14), var11++);
            }
            this.faceLabel = null;
        }
    }

    // td.e(I)V
    setContrast(contrast: number): void {
        this.contrast = (contrast << 16) >> 16;
        if (this.normalStream !== null) {
            requireNonNull(this.normalStream).valid = false;
        }
    }

    // td.a(IIIIII[FIF)V
    private static sphereUv(var0: number, var1: number, var2: number, var3: number, var4: number, var5: number, var6: Float32Array | null, var7: number, var8: number): void {
        var0 = (var0 - var3) | 0;
        var1 = (var1 - var4) | 0;
        var2 = (var2 - var5) | 0;
        const var9: number = Math.fround(Math.fround(Math.fround(Math.fround(var0) * arrayAtF32(var6, 0)) + Math.fround(Math.fround(var1) * arrayAtF32(var6, 1))) + Math.fround(Math.fround(var2) * arrayAtF32(var6, 2)));
        const var10: number = Math.fround(Math.fround(Math.fround(Math.fround(var0) * arrayAtF32(var6, 3)) + Math.fround(Math.fround(var1) * arrayAtF32(var6, 4))) + Math.fround(Math.fround(var2) * arrayAtF32(var6, 5)));
        const var11: number = Math.fround(Math.fround(Math.fround(Math.fround(var0) * arrayAtF32(var6, 6)) + Math.fround(Math.fround(var1) * arrayAtF32(var6, 7))) + Math.fround(Math.fround(var2) * arrayAtF32(var6, 8)));
        const var12: number = Math.fround(Math.sqrt(Math.fround(Math.fround(Math.fround(var9 * var9) + Math.fround(var10 * var10)) + Math.fround(var11 * var11))));
        let var13: number = Math.fround(Math.fround(Math.fround(Math.atan2(var9, var11)) / Math.fround(Math.PI * 2)) + Math.fround(0.5));
        let var14: number = Math.fround(Math.fround(Math.fround(Math.fround(Math.asin(Math.fround(var10 / var12))) / Math.fround(Math.PI)) + Math.fround(0.5)) + var8);
        if (var7 === 1) {
            const var15: number = var13;
            var13 = -var14;
            var14 = var15;
        } else {
            if (var7 === 2) {
                var13 = -var13;
                var14 = -var14;
            } else {
                if (var7 === 3) {
                    const var19: number = var13;
                    var13 = var14;
                    var14 = -var19;
                }
            }
        }
        GlModel.sphereU = var13;
        GlModel.sphereV = var14;
    }

    // td.p()V
    rotate180WithNormals(): void {
        if (this.normalX === null) {
            this.Rotate180();
        } else {
            for (let var1: number = 0; var1 < this.vertexCount; var1++) {
                arrayPutI32(this.pointX, var1, -arrayAtI32(this.pointX, var1) | 0);
                arrayPutI32(this.pointZ, var1, -arrayAtI32(this.pointZ, var1) | 0);
            }
            for (let var2: number = 0; var2 < this.expandedVertexCount; var2++) {
                arrayPutI16(this.normalX, var2, (-arrayAtI16(this.normalX, var2) << 16) >> 16);
                arrayPutI16(this.normalZ, var2, (-arrayAtI16(this.normalZ, var2) << 16) >> 16);
            }
            requireNonNull(this.bounds).valid = false;
            requireNonNull(this.positionStream).valid = false;
            if (this.normalStream !== null) {
                requireNonNull(this.normalStream).valid = false;
            }
        }
    }

    // td.b(III)V
    Resize(x: number, y: number, z: number): void {
        for (let var4: number = 0; var4 < this.vertexCount; var4++) {
            arrayPutI32(this.pointX, var4, Math.imul(arrayAtI32(this.pointX, var4), x) >> 7);
            arrayPutI32(this.pointY, var4, Math.imul(arrayAtI32(this.pointY, var4), y) >> 7);
            arrayPutI32(this.pointZ, var4, Math.imul(arrayAtI32(this.pointZ, var4), z) >> 7);
        }
        requireNonNull(this.bounds).valid = false;
        requireNonNull(this.positionStream).valid = false;
    }

    // td.c(ZZZ)Lak;
    CopyForAnimActor(shareAlpha: boolean, shareColour: boolean, shareNormals: boolean): ModelLit {
        return this.copyAnimation(shareAlpha, shareColour, shareNormals, GlModel.tempActorModel, GlModel.tempActorStorage);
    }

    // td.e()V
    Rotate180(): void {
        for (let var1: number = 0; var1 < this.vertexCount; var1++) {
            arrayPutI32(this.pointX, var1, -arrayAtI32(this.pointX, var1) | 0);
            arrayPutI32(this.pointZ, var1, -arrayAtI32(this.pointZ, var1) | 0);
        }
        requireNonNull(this.bounds).valid = false;
        requireNonNull(this.positionStream).valid = false;
    }

    // td.q()V
    private uploadIndices(): void {
        if (requireNonNull(requireNonNull(GlModel.packet).m_data).length < Math.imul(this.expandedVertexCount, 12)) {
            GlModel.packet = new PacketT(Math.imul((this.expandedVertexCount + 100) | 0, 12));
        } else {
            requireNonNull(GlModel.packet).m_pos = 0;
        }
        if (GlRenderer.bigEndian) {
            for (let var1: number = 0; var1 < this.faceCount; var1++) {
                requireNonNull(GlModel.packet).p4(arrayAtI16(this.faceVertexA, var1));
                requireNonNull(GlModel.packet).p4(arrayAtI16(this.faceVertexB, var1));
                requireNonNull(GlModel.packet).p4(arrayAtI16(this.faceVertexC, var1));
            }
        } else {
            for (let var3: number = 0; var3 < this.faceCount; var3++) {
                requireNonNull(GlModel.packet).p4PlatformEndian(arrayAtI16(this.faceVertexA, var3));
                requireNonNull(GlModel.packet).p4PlatformEndian(arrayAtI16(this.faceVertexB, var3));
                requireNonNull(GlModel.packet).p4PlatformEndian(arrayAtI16(this.faceVertexC, var3));
            }
        }
        if (GlRenderer.vboSupported) {
            const var4: GlBuffer | null = new GlBuffer();
            const var2: ByteBuffer | null = ByteBuffer.wrap(requireNonNull(GlModel.packet).m_data, 0, requireNonNull(GlModel.packet).m_pos);
            requireNonNull(var4).uploadArray(var2);
            requireNonNull(this.indexStream).valid = true;
            requireNonNull(this.indexStream).buffer = null;
            requireNonNull(this.indexStream).vbo = var4;
        } else {
            const var5: ByteBuffer | null = ByteBuffer.allocateDirect(requireNonNull(GlModel.packet).m_pos);
            requireNonNull(var5).put(requireNonNull(GlModel.packet).m_data, 0, requireNonNull(GlModel.packet).m_pos);
            requireNonNull(var5).flip();
            requireNonNull(this.indexStream).valid = true;
            requireNonNull(this.indexStream).buffer = var5;
            requireNonNull(this.indexStream).vbo = null;
        }
    }

    // td.a(IIIIIII[FIFFF)V
    private static boxUv(var0: number, var1: number, var2: number, var3: number, var4: number, var5: number, var6: number, var7: Float32Array | null, var8: number, var9: number, var10: number, var11: number): void {
        var0 = (var0 - var3) | 0;
        var1 = (var1 - var4) | 0;
        var2 = (var2 - var5) | 0;
        const var12: number = Math.fround(Math.fround(Math.fround(Math.fround(var0) * arrayAtF32(var7, 0)) + Math.fround(Math.fround(var1) * arrayAtF32(var7, 1))) + Math.fround(Math.fround(var2) * arrayAtF32(var7, 2)));
        const var13: number = Math.fround(Math.fround(Math.fround(Math.fround(var0) * arrayAtF32(var7, 3)) + Math.fround(Math.fround(var1) * arrayAtF32(var7, 4))) + Math.fround(Math.fround(var2) * arrayAtF32(var7, 5)));
        const var14: number = Math.fround(Math.fround(Math.fround(Math.fround(var0) * arrayAtF32(var7, 6)) + Math.fround(Math.fround(var1) * arrayAtF32(var7, 7))) + Math.fround(Math.fround(var2) * arrayAtF32(var7, 8)));
        let var15: number;
        let var16: number;
        if (var6 === 0) {
            var15 = Math.fround(Math.fround(var12 + var9) + Math.fround(0.5));
            var16 = Math.fround(Math.fround(-var14 + var11) + Math.fround(0.5));
        } else {
            if (var6 === 1) {
                var15 = Math.fround(Math.fround(var12 + var9) + Math.fround(0.5));
                var16 = Math.fround(Math.fround(var14 + var11) + Math.fround(0.5));
            } else {
                if (var6 === 2) {
                    var15 = Math.fround(Math.fround(-var12 + var9) + Math.fround(0.5));
                    var16 = Math.fround(Math.fround(-var13 + var10) + Math.fround(0.5));
                } else {
                    if (var6 === 3) {
                        var15 = Math.fround(Math.fround(var12 + var9) + Math.fround(0.5));
                        var16 = Math.fround(Math.fround(-var13 + var10) + Math.fround(0.5));
                    } else {
                        if (var6 === 4) {
                            var15 = Math.fround(Math.fround(var14 + var11) + Math.fround(0.5));
                            var16 = Math.fround(Math.fround(-var13 + var10) + Math.fround(0.5));
                        } else {
                            var15 = Math.fround(Math.fround(-var14 + var11) + Math.fround(0.5));
                            var16 = Math.fround(Math.fround(-var13 + var10) + Math.fround(0.5));
                        }
                    }
                }
            }
        }
        if (var8 === 1) {
            const var17: number = var15;
            var15 = -var16;
            var16 = var17;
        } else {
            if (var8 === 2) {
                var15 = -var15;
                var16 = -var16;
            } else {
                if (var8 === 3) {
                    const var21: number = var15;
                    var15 = var16;
                    var16 = -var21;
                }
            }
        }
        GlModel.boxU = var15;
        GlModel.boxV = var16;
    }

    // td.f(I)V
    setAmbient(ambient: number): void {
        this.ambient = (ambient << 16) >> 16;
        requireNonNull(this.colourStream).valid = false;
    }

    // td.r()V
    static unload(): void {
        GlModel.vertexKeys = null;
        GlModel.packet = null;
        GlModel.uploadBuffer = null;
        GlModel.tempActorStorage = null;
        GlModel.tempActorModel = null;
        GlModel.tempSpotStorage = null;
        GlModel.tempSpotModel = null;
        GlModel.tempLocStorage = null;
        GlModel.tempLocModel = null;
        GlModel.shadowZ = null;
        GlModel.shadowX = null;
    }

    // td.d()Z
    beginAnimate(): boolean {
        if (this.labelVertices === null) {
            return false;
        } else {
            for (let var1: number = 0; var1 < this.vertexCount; var1++) {
                arrayPutI32(this.pointX, var1, arrayAtI32(this.pointX, var1) << 4);
                arrayPutI32(this.pointY, var1, arrayAtI32(this.pointY, var1) << 4);
                arrayPutI32(this.pointZ, var1, arrayAtI32(this.pointZ, var1) << 4);
            }
            GlModel.pivotX = 0;
            GlModel.pivotY = 0;
            GlModel.pivotZ = 0;
            return true;
        }
    }

    // td.a(SS)V
    Retexture(source: number, destination: number): void {
        for (let var3: number = 0; var3 < this.faceCount; var3++) {
            if (arrayAtI16(this.faceMaterial, var3) === source) {
                arrayPutI16(this.faceMaterial, var3, destination);
            }
        }
        let var7: number = 0;
        let var4: number = 0;
        if (source !== -1) {
            var7 = requireNonNull(Pix3D.textureProvider as HdTextureProvider | null).grayscaleFactor(source & 65535);
            var4 = requireNonNull(Pix3D.textureProvider as HdTextureProvider | null).brightness(source & 65535);
        }
        let var5: number = 0;
        let var6: number = 0;
        if (destination !== -1) {
            var5 = requireNonNull(Pix3D.textureProvider as HdTextureProvider | null).grayscaleFactor(destination & 65535);
            var6 = requireNonNull(Pix3D.textureProvider as HdTextureProvider | null).brightness(destination & 65535);
        }
        if (var7 !== var5 || var4 !== var6) {
            requireNonNull(this.colourStream).valid = false;
        }
    }

    // td.s()V
    private calculateBounds(): void {
        let var1: number = 32767;
        let var2: number = 32767;
        let var3: number = 32767;
        let var4: number = -32768 | 0;
        let var5: number = -32768 | 0;
        let var6: number = -32768 | 0;
        let var7: number = 0;
        let var8: number = 0;
        for (let var9: number = 0; var9 < this.vertexCount; var9++) {
            const var10: number = arrayAtI32(this.pointX, var9);
            const var11: number = arrayAtI32(this.pointY, var9);
            const var12: number = arrayAtI32(this.pointZ, var9);
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
            let var13: number = (Math.imul(var10, var10) + Math.imul(var12, var12)) | 0;
            if (var13 > var7) {
                var7 = var13;
            }
            var13 = (((Math.imul(var10, var10) + Math.imul(var12, var12)) | 0) + Math.imul(var11, var11)) | 0;
            if (var13 > var8) {
                var8 = var13;
            }
        }
        requireNonNull(this.bounds).minX = (var1 << 16) >> 16;
        requireNonNull(this.bounds).maxX = (var4 << 16) >> 16;
        requireNonNull(this.bounds).minY = (var2 << 16) >> 16;
        requireNonNull(this.bounds).maxY = (var5 << 16) >> 16;
        requireNonNull(this.bounds).minZ = (var3 << 16) >> 16;
        requireNonNull(this.bounds).maxZ = (var6 << 16) >> 16;
        requireNonNull(this.bounds).radius = ((Math.sqrt(var7) + 0.99) << 16) >> 16;
        Math.sqrt(var8);
        requireNonNull(this.bounds).valid = true;
    }

    // td.b(SS)V
    Recolour(source: number, destination: number): void {
        for (let var3: number = 0; var3 < this.faceCount; var3++) {
            if (arrayAtI16(this.faceColour, var3) === source) {
                arrayPutI16(this.faceColour, var3, destination);
            }
        }
        requireNonNull(this.colourStream).valid = false;
    }

    // td.a(IILtd;[[I[[IIII)V
    hillSkew(mode: number, parameter: number, base: GlModel | null, heights: (Int32Array | null)[] | null, upperHeights: (Int32Array | null)[] | null, x: number, y: number, z: number): void {
        if (!requireNonNull(requireNonNull(base).bounds).valid) {
            requireNonNull(base).calculateBounds();
        }
        let var9: number = (x + requireNonNull(requireNonNull(base).bounds).minX) | 0;
        let var10: number = (x + requireNonNull(requireNonNull(base).bounds).maxX) | 0;
        let var11: number = (z + requireNonNull(requireNonNull(base).bounds).minZ) | 0;
        let var12: number = (z + requireNonNull(requireNonNull(base).bounds).maxZ) | 0;
        if ((mode !== 1 && mode !== 2 && mode !== 3 && mode !== 5) || (var9 >= 0 && ((var10 + 128) | 0) >> 7 < requireNonNull(heights).length && var11 >= 0 && ((var12 + 128) | 0) >> 7 < requireNonNull(arrayAtObj(heights, 0)).length)) {
            if (mode !== 4 && mode !== 5) {
                var9 = var9 >> 7;
                var10 = ((var10 + 127) | 0) >> 7;
                var11 = var11 >> 7;
                var12 = ((var12 + 127) | 0) >> 7;
                if (arrayAtI32(arrayAtObj(heights, var9), var11) === y && arrayAtI32(arrayAtObj(heights, var10), var11) === y && arrayAtI32(arrayAtObj(heights, var9), var12) === y && arrayAtI32(arrayAtObj(heights, var10), var12) === y) {
                    return;
                }
            } else {
                if (upperHeights === null) {
                    return;
                }
                if (var9 < 0 || ((var10 + 128) | 0) >> 7 >= requireNonNull(upperHeights).length || var11 < 0 || ((var12 + 128) | 0) >> 7 >= requireNonNull(arrayAtObj(upperHeights, 0)).length) {
                    return;
                }
            }
            if (mode === 1) {
                for (let var13: number = 0; var13 < this.vertexCount; var13++) {
                    const var14: number = (arrayAtI32(this.pointX, var13) + x) | 0;
                    const var15: number = (arrayAtI32(this.pointZ, var13) + z) | 0;
                    const var16: number = var14 & 127;
                    const var17: number = var15 & 127;
                    const var18: number = var14 >> 7;
                    const var19: number = var15 >> 7;
                    const var20: number = ((Math.imul(arrayAtI32(arrayAtObj(heights, var18), var19), (128 - var16) | 0) + Math.imul(arrayAtI32(arrayAtObj(heights, (var18 + 1) | 0), var19), var16)) | 0) >> 7;
                    const var21: number = ((Math.imul(arrayAtI32(arrayAtObj(heights, var18), (var19 + 1) | 0), (128 - var16) | 0) + Math.imul(arrayAtI32(arrayAtObj(heights, (var18 + 1) | 0), (var19 + 1) | 0), var16)) | 0) >> 7;
                    const var22: number = ((Math.imul(var20, (128 - var17) | 0) + Math.imul(var21, var17)) | 0) >> 7;
                    arrayPutI32(this.pointY, var13, (((arrayAtI32(this.pointY, var13) + var22) | 0) - y) | 0);
                }
            } else {
                if (mode === 2) {
                    const var30: number = requireNonNull(requireNonNull(base).bounds).minY;
                    for (let var34: number = 0; var34 < this.vertexCount; var34++) {
                        const var38: number = intDivide(arrayAtI32(this.pointY, var34) << 16, var30);
                        if (var38 < parameter) {
                            const var41: number = (arrayAtI32(this.pointX, var34) + x) | 0;
                            const var44: number = (arrayAtI32(this.pointZ, var34) + z) | 0;
                            const var47: number = var41 & 127;
                            const var50: number = var44 & 127;
                            const var53: number = var41 >> 7;
                            const var56: number = var44 >> 7;
                            const var60: number = ((Math.imul(arrayAtI32(arrayAtObj(heights, var53), var56), (128 - var47) | 0) + Math.imul(arrayAtI32(arrayAtObj(heights, (var53 + 1) | 0), var56), var47)) | 0) >> 7;
                            const var23: number = ((Math.imul(arrayAtI32(arrayAtObj(heights, var53), (var56 + 1) | 0), (128 - var47) | 0) + Math.imul(arrayAtI32(arrayAtObj(heights, (var53 + 1) | 0), (var56 + 1) | 0), var47)) | 0) >> 7;
                            const var24: number = ((Math.imul(var60, (128 - var50) | 0) + Math.imul(var23, var50)) | 0) >> 7;
                            arrayPutI32(this.pointY, var34, (arrayAtI32(this.pointY, var34) + intDivide(Math.imul((var24 - y) | 0, (parameter - var38) | 0), parameter)) | 0);
                        }
                    }
                } else {
                    if (mode === 3) {
                        const var31: number = Math.imul(parameter & 255, 4);
                        const var35: number = Math.imul((parameter >> 8) & 255, 4);
                        this.tiltToGround(heights, x, y, z, var31, var35);
                    } else {
                        if (mode === 4) {
                            const var32: number = (requireNonNull(requireNonNull(base).bounds).maxY - requireNonNull(requireNonNull(base).bounds).minY) | 0;
                            for (let var36: number = 0; var36 < this.vertexCount; var36++) {
                                const var39: number = (arrayAtI32(this.pointX, var36) + x) | 0;
                                const var42: number = (arrayAtI32(this.pointZ, var36) + z) | 0;
                                const var45: number = var39 & 127;
                                const var48: number = var42 & 127;
                                const var51: number = var39 >> 7;
                                const var54: number = var42 >> 7;
                                const var57: number = ((Math.imul(arrayAtI32(arrayAtObj(upperHeights, var51), var54), (128 - var45) | 0) + Math.imul(arrayAtI32(arrayAtObj(upperHeights, (var51 + 1) | 0), var54), var45)) | 0) >> 7;
                                const var61: number = ((Math.imul(arrayAtI32(arrayAtObj(upperHeights, var51), (var54 + 1) | 0), (128 - var45) | 0) + Math.imul(arrayAtI32(arrayAtObj(upperHeights, (var51 + 1) | 0), (var54 + 1) | 0), var45)) | 0) >> 7;
                                const var64: number = ((Math.imul(var57, (128 - var48) | 0) + Math.imul(var61, var48)) | 0) >> 7;
                                arrayPutI32(this.pointY, var36, (((arrayAtI32(this.pointY, var36) + ((var64 - y) | 0)) | 0) + var32) | 0);
                            }
                        } else {
                            if (mode === 5) {
                                const var33: number = (requireNonNull(requireNonNull(base).bounds).maxY - requireNonNull(requireNonNull(base).bounds).minY) | 0;
                                for (let var37: number = 0; var37 < this.vertexCount; var37++) {
                                    const var40: number = (arrayAtI32(this.pointX, var37) + x) | 0;
                                    const var43: number = (arrayAtI32(this.pointZ, var37) + z) | 0;
                                    const var46: number = var40 & 127;
                                    const var49: number = var43 & 127;
                                    const var52: number = var40 >> 7;
                                    const var55: number = var43 >> 7;
                                    let var58: number = ((Math.imul(arrayAtI32(arrayAtObj(heights, var52), var55), (128 - var46) | 0) + Math.imul(arrayAtI32(arrayAtObj(heights, (var52 + 1) | 0), var55), var46)) | 0) >> 7;
                                    let var62: number = ((Math.imul(arrayAtI32(arrayAtObj(heights, var52), (var55 + 1) | 0), (128 - var46) | 0) + Math.imul(arrayAtI32(arrayAtObj(heights, (var52 + 1) | 0), (var55 + 1) | 0), var46)) | 0) >> 7;
                                    const var65: number = ((Math.imul(var58, (128 - var49) | 0) + Math.imul(var62, var49)) | 0) >> 7;
                                    var58 = ((Math.imul(arrayAtI32(arrayAtObj(upperHeights, var52), var55), (128 - var46) | 0) + Math.imul(arrayAtI32(arrayAtObj(upperHeights, (var52 + 1) | 0), var55), var46)) | 0) >> 7;
                                    var62 = ((Math.imul(arrayAtI32(arrayAtObj(upperHeights, var52), (var55 + 1) | 0), (128 - var46) | 0) + Math.imul(arrayAtI32(arrayAtObj(upperHeights, (var52 + 1) | 0), (var55 + 1) | 0), var46)) | 0) >> 7;
                                    const var66: number = ((Math.imul(var58, (128 - var49) | 0) + Math.imul(var62, var49)) | 0) >> 7;
                                    const var25: number = (var65 - var66) | 0;
                                    arrayPutI32(this.pointY, var37, ((Math.imul(intDivide(arrayAtI32(this.pointY, var37) << 8, var33), var25) >> 8) - ((y - var65) | 0)) | 0);
                                }
                            }
                        }
                    }
                }
            }
            requireNonNull(this.positionStream).valid = false;
            requireNonNull(this.bounds).valid = false;
        }
    }

    // td.a(ZZZZZZZ)V
    prepareBuffers(discardPositions: boolean, discardColours: boolean, discardNormals: boolean, discardUvs: boolean, discardIndices: boolean, discardLabels: boolean, upload: boolean): void {
        if (this.deferredUpdateMask !== 0) {
            throw new RangeError('IllegalArgumentException');
        } else {
            if (this.expandedVertexCount !== 0) {
                if (upload) {
                    const var8: boolean = !requireNonNull(this.colourStream).valid && (discardColours || (discardNormals && !Preferences.graphics.highDetailLighting));
                    this.uploadVertices(
                        false,
                        !requireNonNull(this.positionStream).valid && discardPositions,
                        var8,
                        this.normalStream !== null && !requireNonNull(this.normalStream).valid && discardNormals,
                        !requireNonNull(this.uvStream).valid && discardUvs
                    );
                    if (!requireNonNull(this.indexStream).valid && discardIndices && discardColours) {
                        this.uploadIndices();
                    }
                }
                if (discardPositions) {
                    if (requireNonNull(this.positionStream).valid) {
                        if (!requireNonNull(this.bounds).valid) {
                            this.calculateBounds();
                        }
                        this.pointX = null;
                        this.pointY = null;
                        this.pointZ = null;
                        this.vertexIndices = null;
                        this.vertexOffsets = null;
                    } else {
                        this.bufferFlags = ((this.bufferFlags | 1) << 24) >> 24;
                    }
                }
                if (discardColours) {
                    if (requireNonNull(this.colourStream).valid) {
                        this.faceColour = null;
                        this.faceAlpha = null;
                    } else {
                        this.bufferFlags = ((this.bufferFlags | 2) << 24) >> 24;
                    }
                }
                if (discardNormals && Preferences.graphics.highDetailLighting) {
                    if (requireNonNull(this.normalStream).valid) {
                        this.normalX = null;
                        this.normalY = null;
                        this.normalZ = null;
                        this.normalCount = null;
                    } else {
                        this.bufferFlags = ((this.bufferFlags | 4) << 24) >> 24;
                    }
                }
                if (discardUvs) {
                    if (requireNonNull(this.uvStream).valid) {
                        this.texU = null;
                        this.texV = null;
                    } else {
                        this.bufferFlags = ((this.bufferFlags | 8) << 24) >> 24;
                    }
                }
                if (discardIndices && discardColours) {
                    if (requireNonNull(this.indexStream).valid && requireNonNull(this.colourStream).valid) {
                        this.faceVertexA = null;
                        this.faceVertexB = null;
                        this.faceVertexC = null;
                    } else {
                        this.bufferFlags = ((this.bufferFlags | 16) << 24) >> 24;
                    }
                }
                if (discardLabels) {
                    this.vertexLabel = null;
                    this.faceLabel = null;
                    this.labelVertices = null;
                    this.labelFaces = null;
                }
            }
        }
    }

    // td.a([FI)[F
    private static copyFloats(source: Float32Array | null, length: number): Float32Array | null {
        const var2: Float32Array | null = new Float32Array(length);
        ArrayUtils.copyFloats(source, 0, var2, 0, length);
        return var2;
    }

    private writePositions(packet: PacketT, stride: number, bigEndian: boolean): boolean {
        const x = this.pointX,
            y = this.pointY,
            z = this.pointZ;
        const offsets = this.vertexOffsets,
            indices = this.vertexIndices,
            bytes = packet.m_data;
        if (bytes === null || x === null || y === null || z === null || offsets === null || indices === null || x.length < this.vertexCount || y.length < this.vertexCount || z.length < this.vertexCount || offsets.length <= this.vertexCount)
            return false;
        const output = geometryPacketView(bytes);
        for (let vertex = 0; vertex < this.vertexCount; vertex++) {
            const vx = x[vertex],
                vy = y[vertex],
                vz = z[vertex];
            const end = offsets[vertex + 1];
            for (let i = offsets[vertex]; i < end; i++) {
                const index = (i >>> 0 < indices.length ? indices[i] : arrayAtI16(indices, i)) - 1;
                if (index === -1) break;
                const at = Math.imul(index, stride);
                if (at >= 0 && at + 12 <= bytes.length) {
                    // td writes the binary32 position as three wa words. The whole in-bounds
                    // store has no intermediate observer. Preserve the post-write packet cursor.
                    output.setFloat32(at, vx, !bigEndian);
                    output.setFloat32(at + 4, vy, !bigEndian);
                    output.setFloat32(at + 8, vz, !bigEndian);
                    packet.m_pos = (at + 12) | 0;
                } else {
                    // wa advances before each failing byte. Keep the written prefix and cursor.
                    packet.m_pos = at;
                    if (bigEndian) {
                        packet.p4(floatBits(vx));
                        packet.p4(floatBits(vy));
                        packet.p4(floatBits(vz));
                    } else {
                        packet.p4PlatformEndian(floatBits(vx));
                        packet.p4PlatformEndian(floatBits(vy));
                        packet.p4PlatformEndian(floatBits(vz));
                    }
                }
            }
        }
        return true;
    }

    // td.a(ZZZZZ)V
    private uploadVertices(dynamic: boolean, positions: boolean, colours: boolean, normals: boolean, uvs: boolean): void {
        let var6: number = 0;
        if (positions) {
            requireNonNull(this.positionStream).offset = var6;
            var6 = (var6 + 12) | 0;
        }
        if (colours) {
            requireNonNull(this.colourStream).offset = var6;
            var6 = (var6 + 4) | 0;
        }
        if (normals) {
            requireNonNull(this.normalStream).offset = var6;
            var6 = (var6 + 12) | 0;
        }
        if (uvs) {
            requireNonNull(this.uvStream).offset = var6;
            var6 = (var6 + 8) | 0;
        }
        if (var6 !== 0) {
            if (requireNonNull(requireNonNull(GlModel.packet).m_data).length < Math.imul(this.expandedVertexCount, var6)) {
                GlModel.packet = new PacketT(Math.imul((this.expandedVertexCount + 100) | 0, var6));
            } else {
                requireNonNull(GlModel.packet).m_pos = 0;
            }
            const bigEndian = positions && GlRenderer.bigEndian;
            if (positions && !this.writePositions(requireNonNull(GlModel.packet), var6, bigEndian)) {
                if (bigEndian) {
                    for (let var7: number = 0; var7 < this.vertexCount; var7++) {
                        const var8: number = floatBits(arrayAtI32(this.pointX, var7)) | 0;
                        const var9: number = floatBits(arrayAtI32(this.pointY, var7)) | 0;
                        const var10: number = floatBits(arrayAtI32(this.pointZ, var7)) | 0;
                        const var11: number = arrayAtI32(this.vertexOffsets, var7);
                        const var12: number = arrayAtI32(this.vertexOffsets, (var7 + 1) | 0);
                        for (let var13: number = var11; var13 < var12; var13++) {
                            const var14: number = (arrayAtI16(this.vertexIndices, var13) - 1) | 0;
                            if (var14 === -1) {
                                break;
                            }
                            requireNonNull(GlModel.packet).m_pos = Math.imul(var14, var6);
                            requireNonNull(GlModel.packet).p4(var8);
                            requireNonNull(GlModel.packet).p4(var9);
                            requireNonNull(GlModel.packet).p4(var10);
                        }
                    }
                } else {
                    for (let var26: number = 0; var26 < this.vertexCount; var26++) {
                        const var35: number = floatBits(arrayAtI32(this.pointX, var26)) | 0;
                        const var40: number = floatBits(arrayAtI32(this.pointY, var26)) | 0;
                        const var44: number = floatBits(arrayAtI32(this.pointZ, var26)) | 0;
                        const var48: number = arrayAtI32(this.vertexOffsets, var26);
                        const var52: number = arrayAtI32(this.vertexOffsets, (var26 + 1) | 0);
                        for (let var54: number = var48; var54 < var52; var54++) {
                            const var56: number = (arrayAtI16(this.vertexIndices, var54) - 1) | 0;
                            if (var56 === -1) {
                                break;
                            }
                            requireNonNull(GlModel.packet).m_pos = Math.imul(var56, var6);
                            requireNonNull(GlModel.packet).p4PlatformEndian(var35);
                            requireNonNull(GlModel.packet).p4PlatformEndian(var40);
                            requireNonNull(GlModel.packet).p4PlatformEndian(var44);
                        }
                    }
                }
            }
            if (colours) {
                if (!Preferences.graphics.highDetailLighting) {
                    const var27: number = arrayAtF32(GlLighting.sunDirection, 0) | 0;
                    const var36: number = arrayAtF32(GlLighting.sunDirection, 1) | 0;
                    const var41: number = arrayAtF32(GlLighting.sunDirection, 2) | 0;
                    const var45: number = Math.sqrt((((Math.imul(var27, var27) + Math.imul(var36, var36)) | 0) + Math.imul(var41, var41)) | 0) | 0;
                    const var49: number = Math.fround(this.ambient * Math.fround(1.3)) | 0;
                    const var53: number = Math.imul(this.contrast, var45) >> 8;
                    for (let var55: number = 0; var55 < this.faceCount; var55++) {
                        const var57: number = arrayAtI16(this.faceVertexA, var55);
                        const var15: number = arrayAtI16(this.normalCount, var57);
                        let var16: number;
                        if (var15 < 0) {
                            var16 = (-1 - var15) | 0;
                        } else {
                            if (var15 !== 0) {
                                var16 =
                                    (var49 +
                                        intDivide((((Math.imul(var27, arrayAtI16(this.normalX, var57)) + Math.imul(var36, arrayAtI16(this.normalY, var57))) | 0) + Math.imul(var41, arrayAtI16(this.normalZ, var57))) | 0, Math.imul(var53, var15))) |
                                    0;
                            } else {
                                var16 =
                                    (var49 +
                                        intDivide(
                                            (((Math.imul(var27, arrayAtI16(this.normalX, var57)) + Math.imul(var36, arrayAtI16(this.normalY, var57))) | 0) + Math.imul(var41, arrayAtI16(this.normalZ, var57))) | 0,
                                            (var53 + intDivide(var53, 2)) | 0
                                        )) |
                                    0;
                            }
                            if (var16 < 0) {
                                var16 = 0;
                            } else {
                                if (var16 > 16384) {
                                    var16 = 16384;
                                }
                            }
                            arrayPutI16(this.normalCount, var57, (((-1 - var16) | 0) << 16) >> 16);
                        }
                        const var17: number = arrayAtI16(this.faceVertexB, var55);
                        const var18: number = arrayAtI16(this.normalCount, var17);
                        let var19: number;
                        if (var18 < 0) {
                            var19 = (-1 - var18) | 0;
                        } else {
                            if (var18 !== 0) {
                                var19 =
                                    (var49 +
                                        intDivide((((Math.imul(var27, arrayAtI16(this.normalX, var17)) + Math.imul(var36, arrayAtI16(this.normalY, var17))) | 0) + Math.imul(var41, arrayAtI16(this.normalZ, var17))) | 0, Math.imul(var53, var18))) |
                                    0;
                            } else {
                                var19 =
                                    (var49 +
                                        intDivide(
                                            (((Math.imul(var27, arrayAtI16(this.normalX, var17)) + Math.imul(var36, arrayAtI16(this.normalY, var17))) | 0) + Math.imul(var41, arrayAtI16(this.normalZ, var17))) | 0,
                                            (var53 + intDivide(var53, 2)) | 0
                                        )) |
                                    0;
                            }
                            if (var19 < 0) {
                                var19 = 0;
                            } else {
                                if (var19 > 16384) {
                                    var19 = 16384;
                                }
                            }
                            arrayPutI16(this.normalCount, var17, (((-1 - var19) | 0) << 16) >> 16);
                        }
                        const var20: number = arrayAtI16(this.faceVertexC, var55);
                        const var21: number = arrayAtI16(this.normalCount, var20);
                        let var22: number;
                        if (var21 < 0) {
                            var22 = (-1 - var21) | 0;
                        } else {
                            if (var21 !== 0) {
                                var22 =
                                    (var49 +
                                        intDivide((((Math.imul(var27, arrayAtI16(this.normalX, var20)) + Math.imul(var36, arrayAtI16(this.normalY, var20))) | 0) + Math.imul(var41, arrayAtI16(this.normalZ, var20))) | 0, Math.imul(var53, var21))) |
                                    0;
                            } else {
                                var22 =
                                    (var49 +
                                        intDivide(
                                            (((Math.imul(var27, arrayAtI16(this.normalX, var20)) + Math.imul(var36, arrayAtI16(this.normalY, var20))) | 0) + Math.imul(var41, arrayAtI16(this.normalZ, var20))) | 0,
                                            (var53 + intDivide(var53, 2)) | 0
                                        )) |
                                    0;
                            }
                            if (var22 < 0) {
                                var22 = 0;
                            } else {
                                if (var22 > 16384) {
                                    var22 = 16384;
                                }
                            }
                            arrayPutI16(this.normalCount, var20, (((-1 - var22) | 0) << 16) >> 16);
                        }
                        const var23: number = GlModel.faceRgba(arrayAtI16(this.faceColour, var55), arrayAtI16(this.faceMaterial, var55), var16, (arrayAtU8(this.faceAlpha, var55) << 24) >> 24);
                        const var24: number = GlModel.faceRgba(arrayAtI16(this.faceColour, var55), arrayAtI16(this.faceMaterial, var55), var19, (arrayAtU8(this.faceAlpha, var55) << 24) >> 24);
                        const var25: number = GlModel.faceRgba(arrayAtI16(this.faceColour, var55), arrayAtI16(this.faceMaterial, var55), var22, (arrayAtU8(this.faceAlpha, var55) << 24) >> 24);
                        requireNonNull(GlModel.packet).m_pos = (requireNonNull(this.colourStream).offset + Math.imul(var57, var6)) | 0;
                        requireNonNull(GlModel.packet).p4(var23);
                        requireNonNull(GlModel.packet).m_pos = (requireNonNull(this.colourStream).offset + Math.imul(var17, var6)) | 0;
                        requireNonNull(GlModel.packet).p4(var24);
                        requireNonNull(GlModel.packet).m_pos = (requireNonNull(this.colourStream).offset + Math.imul(var20, var6)) | 0;
                        requireNonNull(GlModel.packet).p4(var25);
                    }
                    this.normalX = null;
                    this.normalY = null;
                    this.normalZ = null;
                } else {
                    for (let var28: number = 0; var28 < this.faceCount; var28++) {
                        const var37: number = GlModel.faceRgba(arrayAtI16(this.faceColour, var28), arrayAtI16(this.faceMaterial, var28), this.ambient, (arrayAtU8(this.faceAlpha, var28) << 24) >> 24);
                        requireNonNull(GlModel.packet).m_pos = (requireNonNull(this.colourStream).offset + Math.imul(arrayAtI16(this.faceVertexA, var28), var6)) | 0;
                        requireNonNull(GlModel.packet).p4(var37);
                        requireNonNull(GlModel.packet).m_pos = (requireNonNull(this.colourStream).offset + Math.imul(arrayAtI16(this.faceVertexB, var28), var6)) | 0;
                        requireNonNull(GlModel.packet).p4(var37);
                        requireNonNull(GlModel.packet).m_pos = (requireNonNull(this.colourStream).offset + Math.imul(arrayAtI16(this.faceVertexC, var28), var6)) | 0;
                        requireNonNull(GlModel.packet).p4(var37);
                    }
                }
            }
            if (normals) {
                const base = Math.fround(3 / this.contrast);
                const flat = Math.fround(3 / Math.fround((this.contrast + intDivide(this.contrast, 2)) | 0));
                const packet = requireNonNull(GlModel.packet);
                packet.m_pos = requireNonNull(this.normalStream).offset;
                const count = this.expandedVertexCount;
                const x = this.normalX,
                    y = this.normalY,
                    z = this.normalZ,
                    weights = this.normalCount;
                const bytes = packet.m_data;
                const little = !GlRenderer.bigEndian;
                const end = packet.m_pos + (count - 1) * var6 + 12;
                if (count > 0 && x && y && z && weights && count <= x.length && count <= y.length && count <= z.length && count <= weights.length && bytes && packet.m_pos >= 0 && end <= bytes.length && end <= 0x80000000) {
                    // The complete interleaved range fits. Each native float store emits
                    // the same four packet bytes, including when the component is unaligned.
                    const output = geometryPacketView(bytes);
                    let at = packet.m_pos;
                    for (let i = 0; i < count; i++, at += var6) {
                        const weight = weights[i];
                        const scale = weight === 0 ? flat : Math.fround(base / weight);
                        output.setFloat32(at, Math.fround(x[i] * scale), little);
                        output.setFloat32(at + 4, Math.fround(y[i] * scale), little);
                        output.setFloat32(at + 8, Math.fround(z[i] * scale), little);
                    }
                    packet.m_pos = at | 0;
                } else {
                    // Preserve byte writes and the packet cursor up to the first Java fault.
                    const write = little ? packet.pFloatPlatformEndian : packet.pFloat;
                    for (let i = 0; i < count; i++) {
                        const weight = arrayAtI16(weights, i);
                        const scale = weight === 0 ? flat : Math.fround(base / weight);
                        write.call(packet, Math.fround(arrayAtI16(x, i) * scale));
                        write.call(packet, Math.fround(arrayAtI16(y, i) * scale));
                        write.call(packet, Math.fround(arrayAtI16(z, i) * scale));
                        packet.m_pos = (packet.m_pos + var6 - 12) | 0;
                    }
                }
            }
            if (uvs) {
                const uWords = floatWords(this.texU);
                const vWords = floatWords(this.texV);
                requireNonNull(GlModel.packet).m_pos = requireNonNull(this.uvStream).offset;
                if (GlRenderer.bigEndian) {
                    for (let var30: number = 0; var30 < this.expandedVertexCount; var30++) {
                        requireNonNull(GlModel.packet).pFloat(arrayAtI32(uWords, var30), true);
                        requireNonNull(GlModel.packet).pFloat(arrayAtI32(vWords, var30), true);
                        requireNonNull(GlModel.packet).m_pos = (requireNonNull(GlModel.packet).m_pos + ((var6 - 8) | 0)) | 0;
                    }
                } else {
                    for (let var31: number = 0; var31 < this.expandedVertexCount; var31++) {
                        requireNonNull(GlModel.packet).pFloatPlatformEndian(arrayAtI32(uWords, var31), true);
                        requireNonNull(GlModel.packet).pFloatPlatformEndian(arrayAtI32(vWords, var31), true);
                        requireNonNull(GlModel.packet).m_pos = (requireNonNull(GlModel.packet).m_pos + ((var6 - 8) | 0)) | 0;
                    }
                }
            }
            requireNonNull(GlModel.packet).m_pos = Math.imul(var6, this.expandedVertexCount);
            if (dynamic) {
                if (GlRenderer.streamVbo) {
                    const var32: ByteBuffer | null = ByteBuffer.wrap(requireNonNull(GlModel.packet).m_data, 0, requireNonNull(GlModel.packet).m_pos);
                    if (this.dynamicVbo === null) {
                        this.dynamicVbo = new GlBuffer(true);
                        requireNonNull(this.dynamicVbo).uploadArray(var32);
                    } else {
                        requireNonNull(this.dynamicVbo).update(var32);
                    }
                    if (positions) {
                        requireNonNull(this.positionStream).valid = true;
                        requireNonNull(this.positionStream).buffer = null;
                        requireNonNull(this.positionStream).vbo = this.dynamicVbo;
                        requireNonNull(this.positionStream).stride = var6;
                    }
                    if (colours) {
                        requireNonNull(this.colourStream).valid = true;
                        requireNonNull(this.colourStream).buffer = null;
                        requireNonNull(this.colourStream).vbo = this.dynamicVbo;
                        requireNonNull(this.colourStream).stride = var6;
                    }
                    if (normals) {
                        requireNonNull(this.normalStream).valid = true;
                        requireNonNull(this.normalStream).buffer = null;
                        requireNonNull(this.normalStream).vbo = this.dynamicVbo;
                        requireNonNull(this.normalStream).stride = var6;
                    }
                    if (uvs) {
                        requireNonNull(this.uvStream).valid = true;
                        requireNonNull(this.uvStream).buffer = null;
                        requireNonNull(this.uvStream).vbo = this.dynamicVbo;
                        requireNonNull(this.uvStream).stride = var6;
                    }
                } else {
                    if (GlModel.uploadBuffer !== null && requireNonNull(GlModel.uploadBuffer).capacity() >= requireNonNull(GlModel.packet).m_pos) {
                        requireNonNull(GlModel.uploadBuffer).clear();
                    } else {
                        GlModel.uploadBuffer = ByteBuffer.allocateDirect((requireNonNull(GlModel.packet).m_pos + Math.imul(100, var6)) | 0);
                    }
                    requireNonNull(GlModel.uploadBuffer).put(requireNonNull(GlModel.packet).m_data, 0, requireNonNull(GlModel.packet).m_pos);
                    requireNonNull(GlModel.uploadBuffer).flip();
                    if (positions) {
                        requireNonNull(this.positionStream).valid = true;
                        requireNonNull(this.positionStream).buffer = GlModel.uploadBuffer;
                        requireNonNull(this.positionStream).vbo = null;
                        requireNonNull(this.positionStream).stride = var6;
                    }
                    if (colours) {
                        requireNonNull(this.colourStream).valid = true;
                        requireNonNull(this.colourStream).buffer = GlModel.uploadBuffer;
                        requireNonNull(this.positionStream).vbo = null;
                        requireNonNull(this.colourStream).stride = var6;
                    }
                    if (normals) {
                        requireNonNull(this.normalStream).valid = true;
                        requireNonNull(this.normalStream).buffer = GlModel.uploadBuffer;
                        requireNonNull(this.normalStream).vbo = null;
                        requireNonNull(this.normalStream).stride = var6;
                    }
                    if (uvs) {
                        requireNonNull(this.uvStream).valid = true;
                        requireNonNull(this.uvStream).buffer = GlModel.uploadBuffer;
                        requireNonNull(this.uvStream).vbo = null;
                        requireNonNull(this.uvStream).stride = var6;
                    }
                }
            } else {
                if (GlRenderer.vboSupported) {
                    const var33: GlBuffer | null = new GlBuffer();
                    const var39: ByteBuffer | null = ByteBuffer.wrap(requireNonNull(GlModel.packet).m_data, 0, requireNonNull(GlModel.packet).m_pos);
                    requireNonNull(var33).uploadArray(var39);
                    if (positions) {
                        requireNonNull(this.positionStream).valid = true;
                        requireNonNull(this.positionStream).buffer = null;
                        requireNonNull(this.positionStream).vbo = var33;
                        requireNonNull(this.positionStream).stride = var6;
                    }
                    if (colours) {
                        requireNonNull(this.colourStream).valid = true;
                        requireNonNull(this.colourStream).buffer = null;
                        requireNonNull(this.colourStream).vbo = var33;
                        requireNonNull(this.colourStream).stride = var6;
                    }
                    if (normals) {
                        requireNonNull(this.normalStream).valid = true;
                        requireNonNull(this.normalStream).buffer = null;
                        requireNonNull(this.normalStream).vbo = var33;
                        requireNonNull(this.normalStream).stride = var6;
                    }
                    if (uvs) {
                        requireNonNull(this.uvStream).valid = true;
                        requireNonNull(this.uvStream).buffer = null;
                        requireNonNull(this.uvStream).vbo = var33;
                        requireNonNull(this.uvStream).stride = var6;
                    }
                } else {
                    const var34: ByteBuffer | null = ByteBuffer.allocateDirect(requireNonNull(GlModel.packet).m_pos);
                    requireNonNull(var34).put(requireNonNull(GlModel.packet).m_data, 0, requireNonNull(GlModel.packet).m_pos);
                    requireNonNull(var34).flip();
                    if (positions) {
                        requireNonNull(this.positionStream).valid = true;
                        requireNonNull(this.positionStream).buffer = var34;
                        requireNonNull(this.positionStream).vbo = null;
                        requireNonNull(this.positionStream).stride = var6;
                    }
                    if (colours) {
                        requireNonNull(this.colourStream).valid = true;
                        requireNonNull(this.colourStream).buffer = var34;
                        requireNonNull(this.positionStream).vbo = null;
                        requireNonNull(this.colourStream).stride = var6;
                    }
                    if (normals) {
                        requireNonNull(this.normalStream).valid = true;
                        requireNonNull(this.normalStream).buffer = var34;
                        requireNonNull(this.normalStream).vbo = null;
                        requireNonNull(this.normalStream).stride = var6;
                    }
                    if (uvs) {
                        requireNonNull(this.uvStream).valid = true;
                        requireNonNull(this.uvStream).buffer = var34;
                        requireNonNull(this.uvStream).vbo = null;
                        requireNonNull(this.uvStream).stride = var6;
                    }
                }
            }
        }
    }

    // td.a(ZZZLtd;Ltd;)Lak;
    private copyAnimation(shareAlpha: boolean, shareColour: boolean, shareNormals: boolean, result: GlModel | null, storage: GlModel | null): ModelLit {
        result = requireNonNull(result);
        result.vertexCount = this.vertexCount;
        result.expandedVertexCount = this.expandedVertexCount;
        result.faceCount = this.faceCount;
        result.ambient = this.ambient;
        result.contrast = this.contrast;
        result.deferredUpdateMask = ((1 | (shareAlpha && shareColour ? 0 : 2) | (shareNormals ? 0 : 4)) << 24) >> 24;
        if (result.pointX === null || requireNonNull(result.pointX).length < this.vertexCount) {
            result.pointX = new Int32Array((this.vertexCount + 100) | 0);
            result.pointY = new Int32Array((this.vertexCount + 100) | 0);
            result.pointZ = new Int32Array((this.vertexCount + 100) | 0);
        }
        const srcX = this.pointX,
            srcY = this.pointY,
            srcZ = this.pointZ;
        const dstX = result.pointX,
            dstY = result.pointY,
            dstZ = result.pointZ;
        let vertex = 0;
        if (srcX && srcY && srcZ && dstX && dstY && dstZ) {
            const end = Math.min(this.vertexCount, srcX.length, srcY.length, srcZ.length, dstX.length, dstY.length, dstZ.length);
            // Keep the original interleaved writes even when coordinate arrays alias.
            for (; vertex < end; vertex++) {
                dstX[vertex] = srcX[vertex];
                dstY[vertex] = srcY[vertex];
                dstZ[vertex] = srcZ[vertex];
            }
        }
        for (; vertex < this.vertexCount; vertex++) {
            arrayPutI32(dstX, vertex, arrayAtI32(srcX, vertex));
            arrayPutI32(dstY, vertex, arrayAtI32(srcY, vertex));
            arrayPutI32(dstZ, vertex, arrayAtI32(srcZ, vertex));
        }
        if (result.positionStream === null) {
            result.positionStream = new GlModelStream();
        }
        requireNonNull(result.positionStream).valid = false;
        if (result.bounds === null) {
            result.bounds = new GlModelBounds();
        }
        requireNonNull(result.bounds).valid = false;
        if (shareAlpha) {
            result.faceAlpha = this.faceAlpha;
        } else {
            if (requireNonNull(storage).faceAlpha === null || requireNonNull(requireNonNull(storage).faceAlpha).length < this.faceCount) {
                requireNonNull(storage).faceAlpha = new Uint8Array((this.faceCount + 100) | 0);
            }
            result.faceAlpha = requireNonNull(storage).faceAlpha;
            const source = this.faceAlpha,
                target = result.faceAlpha;
            let face = 0;
            if (source && target) {
                const end = Math.min(this.faceCount, source.length, target.length);
                for (; face < end; face++) target[face] = source[face];
            }
            for (; face < this.faceCount; face++) arrayPutU8(target, face, arrayAtU8(source, face));
        }
        if (shareColour) {
            result.faceColour = this.faceColour;
        } else {
            if (requireNonNull(storage).faceColour === null || requireNonNull(requireNonNull(storage).faceColour).length < this.faceCount) {
                requireNonNull(storage).faceColour = new Int16Array((this.faceCount + 100) | 0);
            }
            result.faceColour = requireNonNull(storage).faceColour;
            const source = this.faceColour,
                target = result.faceColour;
            let face = 0;
            if (source && target) {
                const end = Math.min(this.faceCount, source.length, target.length);
                for (; face < end; face++) target[face] = source[face];
            }
            for (; face < this.faceCount; face++) arrayPutI16(target, face, arrayAtI16(source, face));
        }
        if (shareAlpha && shareColour) {
            result.colourStream = this.colourStream;
        } else {
            if (requireNonNull(storage).colourStream === null) {
                requireNonNull(storage).colourStream = new GlModelStream();
            }
            result.colourStream = requireNonNull(storage).colourStream;
            requireNonNull(result.colourStream).valid = false;
        }
        if (!shareNormals && this.normalX !== null) {
            if (requireNonNull(storage).normalX === null || requireNonNull(requireNonNull(storage).normalX).length < this.expandedVertexCount) {
                requireNonNull(storage).normalX = new Int16Array((this.expandedVertexCount + 100) | 0);
                requireNonNull(storage).normalY = new Int16Array((this.expandedVertexCount + 100) | 0);
                requireNonNull(storage).normalZ = new Int16Array((this.expandedVertexCount + 100) | 0);
                requireNonNull(storage).normalCount = new Int16Array((this.expandedVertexCount + 100) | 0);
            }
            result.normalX = requireNonNull(storage).normalX;
            result.normalY = requireNonNull(storage).normalY;
            result.normalZ = requireNonNull(storage).normalZ;
            result.normalCount = requireNonNull(storage).normalCount;
            for (let var9: number = 0; var9 < this.expandedVertexCount; var9++) {
                arrayPutI16(result.normalX, var9, arrayAtI16(this.normalX, var9));
                arrayPutI16(result.normalY, var9, arrayAtI16(this.normalY, var9));
                arrayPutI16(result.normalZ, var9, arrayAtI16(this.normalZ, var9));
                arrayPutI16(result.normalCount, var9, arrayAtI16(this.normalCount, var9));
            }
            if (Preferences.graphics.highDetailLighting) {
                if (requireNonNull(storage).normalStream === null) {
                    requireNonNull(storage).normalStream = new GlModelStream();
                }
                result.normalStream = requireNonNull(storage).normalStream;
                requireNonNull(result.normalStream).valid = false;
            } else {
                result.normalStream = null;
            }
        } else {
            result.normalX = this.normalX;
            result.normalY = this.normalY;
            result.normalZ = this.normalZ;
            result.normalCount = this.normalCount;
            result.normalStream = this.normalStream;
        }
        result.texU = this.texU;
        result.texV = this.texV;
        result.vertexLabel = this.vertexLabel;
        result.labelVertices = this.labelVertices;
        result.faceVertexA = this.faceVertexA;
        result.faceVertexB = this.faceVertexB;
        result.faceVertexC = this.faceVertexC;
        result.faceMaterial = this.faceMaterial;
        result.faceLabel = this.faceLabel;
        result.labelFaces = this.labelFaces;
        result.uvStream = this.uvStream;
        result.indexStream = this.indexStream;
        result.materialRuns = this.materialRuns;
        result.vertexIndices = this.vertexIndices;
        result.vertexOffsets = this.vertexOffsets;
        result.useAABBMouseCheck = this.useAABBMouseCheck;
        result.pointPartMask = this.pointPartMask;
        result.facePartMask = this.facePartMask;
        return result;
    }

    // td.a(III)Lth;
    override light(_var1: number, _var2: number, _var3: number): ModelSource {
        this.shareLight = false;
        if (this.savedNormals !== null) {
            this.normalX = requireNonNull(this.savedNormals).normalX;
            this.normalY = requireNonNull(this.savedNormals).normalY;
            this.normalZ = requireNonNull(this.savedNormals).normalZ;
            this.normalCount = requireNonNull(this.savedNormals).normalCount;
            this.savedNormals = null;
        }
        return this;
    }

    // td.t()I
    getContrast(): number {
        return this.contrast;
    }

    // td.u()V
    rotate90WithNormals(): void {
        if (this.normalX === null) {
            this.Rotate90();
        } else {
            for (let var1: number = 0; var1 < this.vertexCount; var1++) {
                const var2: number = arrayAtI32(this.pointX, var1);
                arrayPutI32(this.pointX, var1, arrayAtI32(this.pointZ, var1));
                arrayPutI32(this.pointZ, var1, -var2 | 0);
            }
            for (let var3: number = 0; var3 < this.expandedVertexCount; var3++) {
                const var4: number = arrayAtI16(this.normalX, var3);
                arrayPutI16(this.normalX, var3, arrayAtI16(this.normalZ, var3));
                arrayPutI16(this.normalZ, var3, (-var4 << 16) >> 16);
            }
            requireNonNull(this.bounds).valid = false;
            requireNonNull(this.positionStream).valid = false;
            if (this.normalStream !== null) {
                requireNonNull(this.normalStream).valid = false;
            }
        }
    }

    // td.a(ZZZZZZZZZZZ)Ltd;
    copyForLoc(var1: boolean, var2: boolean, var3: boolean, var4: boolean, var5: boolean, var6: boolean, var7: boolean, var8: boolean, var9: boolean, var10: boolean, var11: boolean): GlModel {
        const var12: GlModel | null = new GlModel();
        requireNonNull(var12).vertexCount = this.vertexCount;
        requireNonNull(var12).expandedVertexCount = this.expandedVertexCount;
        requireNonNull(var12).faceCount = this.faceCount;
        if (var1) {
            requireNonNull(var12).pointX = this.pointX;
            requireNonNull(var12).pointZ = this.pointZ;
        } else {
            requireNonNull(var12).pointX = ArrayUtils.copyOf(this.pointX);
            requireNonNull(var12).pointZ = ArrayUtils.copyOf(this.pointZ);
        }
        if (var2) {
            requireNonNull(var12).pointY = this.pointY;
        } else {
            requireNonNull(var12).pointY = ArrayUtils.copyOf(this.pointY);
        }
        if (var1 && var2) {
            requireNonNull(var12).positionStream = this.positionStream;
            requireNonNull(var12).bounds = this.bounds;
        } else {
            requireNonNull(var12).positionStream = new GlModelStream();
            requireNonNull(var12).bounds = new GlModelBounds();
        }
        if (var3) {
            requireNonNull(var12).faceColour = this.faceColour;
        } else {
            requireNonNull(var12).faceColour = ArrayUtils.copyOfShorts(this.faceColour);
        }
        if (var4) {
            requireNonNull(var12).faceAlpha = this.faceAlpha;
        } else {
            requireNonNull(var12).faceAlpha = ArrayUtils.copyOfBytes(this.faceAlpha);
        }
        if (!var3 || !var4 || !var5 || ((!var8 || !var6) && !Preferences.graphics.highDetailLighting)) {
            requireNonNull(var12).colourStream = new GlModelStream();
        } else {
            requireNonNull(var12).colourStream = this.colourStream;
        }
        if (var6) {
            requireNonNull(var12).normalX = this.normalX;
            requireNonNull(var12).normalY = this.normalY;
            requireNonNull(var12).normalZ = this.normalZ;
            requireNonNull(var12).normalCount = this.normalCount;
        } else {
            requireNonNull(var12).normalX = ArrayUtils.copyOfShorts(this.normalX);
            requireNonNull(var12).normalY = ArrayUtils.copyOfShorts(this.normalY);
            requireNonNull(var12).normalZ = ArrayUtils.copyOfShorts(this.normalZ);
            requireNonNull(var12).normalCount = ArrayUtils.copyOfShorts(this.normalCount);
        }
        if (Preferences.graphics.highDetailLighting) {
            if (var6 && var7 && var8) {
                requireNonNull(var12).normalStream = this.normalStream;
            } else {
                requireNonNull(var12).normalStream = new GlModelStream();
            }
        } else {
            requireNonNull(var12).normalStream = null;
        }
        if (var9) {
            requireNonNull(var12).texU = this.texU;
            requireNonNull(var12).texV = this.texV;
            requireNonNull(var12).uvStream = this.uvStream;
        } else {
            requireNonNull(var12).texU = ArrayUtils.copyOfFloats(this.texU, 0);
            requireNonNull(var12).texV = ArrayUtils.copyOfFloats(this.texV, 0);
            requireNonNull(var12).uvStream = new GlModelStream();
        }
        if (var10) {
            requireNonNull(var12).faceVertexA = this.faceVertexA;
            requireNonNull(var12).faceVertexB = this.faceVertexB;
            requireNonNull(var12).faceVertexC = this.faceVertexC;
            requireNonNull(var12).indexStream = this.indexStream;
        } else {
            requireNonNull(var12).faceVertexA = ArrayUtils.copyOfShorts(this.faceVertexA);
            requireNonNull(var12).faceVertexB = ArrayUtils.copyOfShorts(this.faceVertexB);
            requireNonNull(var12).faceVertexC = ArrayUtils.copyOfShorts(this.faceVertexC);
            requireNonNull(var12).indexStream = new GlModelStream();
        }
        if (var11) {
            requireNonNull(var12).faceMaterial = this.faceMaterial;
        } else {
            requireNonNull(var12).faceMaterial = ArrayUtils.copyOfShorts(this.faceMaterial);
        }
        requireNonNull(var12).vertexLabel = this.vertexLabel;
        requireNonNull(var12).labelVertices = this.labelVertices;
        requireNonNull(var12).faceLabel = this.faceLabel;
        requireNonNull(var12).labelFaces = this.labelFaces;
        requireNonNull(var12).materialRuns = this.materialRuns;
        requireNonNull(var12).vertexIndices = this.vertexIndices;
        requireNonNull(var12).vertexOffsets = this.vertexOffsets;
        requireNonNull(var12).ambient = this.ambient;
        requireNonNull(var12).contrast = this.contrast;
        requireNonNull(var12).pointPartMask = this.pointPartMask;
        requireNonNull(var12).facePartMask = this.facePartMask;
        return var12;
    }

    // td.i()V
    Rotate90(): void {
        for (let var1: number = 0; var1 < this.vertexCount; var1++) {
            const var2: number = arrayAtI32(this.pointX, var1);
            arrayPutI32(this.pointX, var1, arrayAtI32(this.pointZ, var1));
            arrayPutI32(this.pointZ, var1, -var2 | 0);
        }
        requireNonNull(this.bounds).valid = false;
        requireNonNull(this.positionStream).valid = false;
    }

    // td.a(IIIIIIII)Z
    private containsProjected(var1: number, var2: number, var3: number, var4: number, var5: number, var6: number, var7: number, var8: number): boolean {
        if (var2 < var3 && var2 < var4 && var2 < var5) {
            return false;
        } else {
            if (var2 > var3 && var2 > var4 && var2 > var5) {
                return false;
            } else {
                return var1 < var6 && var1 < var7 && var1 < var8 ? false : var1 <= var6 || var1 <= var7 || var1 <= var8;
            }
        }
    }

    // td.a([SI)[S
    private static copyShorts(source: Int16Array | null, length: number): Int16Array | null {
        const var2: Int16Array | null = new Int16Array(length);
        ArrayUtils.copyShorts(source, 0, var2, 0, length);
        return var2;
    }

    // td.j()I
    GetRadiusCylinder(): number {
        if (!requireNonNull(this.bounds).valid) {
            this.calculateBounds();
        }
        return requireNonNull(this.bounds).radius;
    }

    // td.a(I[IIIIZ)V
    Animate2(opcode: number, labels: Int32Array | null, x: number, y: number, z: number, rotateNormals: boolean): void {
        labels = requireNonNull(labels);
        const labelCount = labels.length;
        if (opcode === 0) {
            x = x << 4;
            y = y << 4;
            z = z << 4;
            let var31: number = 0;
            GlModel.pivotX = 0;
            GlModel.pivotY = 0;
            GlModel.pivotZ = 0;
            const px = this.pointX,
                py = this.pointY,
                pz = this.pointZ;
            const vertices = Math.min(px?.length ?? 0, py?.length ?? 0, pz?.length ?? 0);
            for (let var37: number = 0; var37 < labelCount; var37++) {
                const var43: number = labels[var37];
                if (var43 < requireNonNull(this.labelVertices).length) {
                    const var49 = requireNonNull(arrayAtObj(this.labelVertices, var43));
                    let i = 0;
                    if (px && py && pz) {
                        let sumX = GlModel.pivotX,
                            sumY = GlModel.pivotY,
                            sumZ = GlModel.pivotZ;
                        for (; i < var49.length; i++) {
                            const vertex = var49[i];
                            if (vertex >>> 0 >= vertices) break;
                            sumX = (sumX + px[vertex]) | 0;
                            sumY = (sumY + py[vertex]) | 0;
                            sumZ = (sumZ + pz[vertex]) | 0;
                        }
                        GlModel.pivotX = sumX;
                        GlModel.pivotY = sumY;
                        GlModel.pivotZ = sumZ;
                        var31 += i;
                    }
                    // Publish the complete vertices before the JVM's first failing coordinate load.
                    for (; i < var49.length; i++) {
                        const vertex = var49[i];
                        GlModel.pivotX = (GlModel.pivotX + arrayAtI32(this.pointX, vertex)) | 0;
                        GlModel.pivotY = (GlModel.pivotY + arrayAtI32(this.pointY, vertex)) | 0;
                        GlModel.pivotZ = (GlModel.pivotZ + arrayAtI32(this.pointZ, vertex)) | 0;
                        var31++;
                    }
                }
            }
            if (var31 > 0) {
                GlModel.pivotX = (intDivide(GlModel.pivotX, var31) + x) | 0;
                GlModel.pivotY = (intDivide(GlModel.pivotY, var31) + y) | 0;
                GlModel.pivotZ = (intDivide(GlModel.pivotZ, var31) + z) | 0;
            } else {
                GlModel.pivotX = x;
                GlModel.pivotY = y;
                GlModel.pivotZ = z;
            }
        } else {
            if (opcode === 1) {
                x = x << 4;
                y = y << 4;
                z = z << 4;
                const px = this.pointX,
                    py = this.pointY,
                    pz = this.pointZ;
                const vertices = Math.min(px?.length ?? 0, py?.length ?? 0, pz?.length ?? 0);
                for (let var30: number = 0; var30 < labelCount; var30++) {
                    const var36: number = labels[var30];
                    if (var36 < requireNonNull(this.labelVertices).length) {
                        const var42 = requireNonNull(arrayAtObj(this.labelVertices, var36));
                        for (let var48: number = 0; var48 < var42.length; var48++) {
                            const var54: number = var42[var48];
                            if (px !== null && py !== null && pz !== null && var54 >>> 0 < vertices) {
                                px[var54] = (px[var54] + x) | 0;
                                py[var54] = (py[var54] + y) | 0;
                                pz[var54] = (pz[var54] + z) | 0;
                            } else {
                                arrayPutI32(this.pointX, var54, (arrayAtI32(this.pointX, var54) + x) | 0);
                                arrayPutI32(this.pointY, var54, (arrayAtI32(this.pointY, var54) + y) | 0);
                                arrayPutI32(this.pointZ, var54, (arrayAtI32(this.pointZ, var54) + z) | 0);
                            }
                        }
                    }
                }
            } else {
                if (opcode === 2) {
                    const px = this.pointX,
                        py = this.pointY,
                        pz = this.pointZ;
                    const sin = Pix3D.sinTable,
                        cos = Pix3D.cosTable;
                    const vertices = Math.min(px?.length ?? 0, py?.length ?? 0, pz?.length ?? 0);
                    const angles = Math.min(sin?.length ?? 0, cos?.length ?? 0);
                    // A model normally owns three independent coordinate arrays. Overlapping views
                    // take the ordered loads/stores below, as do invalid animation indices.
                    const xb = px?.buffer,
                        yb = py?.buffer,
                        zb = pz?.buffer;
                    const sb = sin?.buffer,
                        cb = cos?.buffer;
                    const independent = px && py && pz && sin && cos && x >>> 0 < angles && y >>> 0 < angles && z >>> 0 < angles && xb !== yb && xb !== zb && yb !== zb && xb !== sb && yb !== sb && zb !== sb && xb !== cb && yb !== cb && zb !== cb;
                    const sx = independent ? sin[x] : 0,
                        cx = independent ? cos[x] : 0;
                    const sy = independent ? sin[y] : 0,
                        cy = independent ? cos[y] : 0;
                    const sz = independent ? sin[z] : 0,
                        cz = independent ? cos[z] : 0;
                    const pivotX = GlModel.pivotX,
                        pivotY = GlModel.pivotY,
                        pivotZ = GlModel.pivotZ;
                    for (let var28: number = 0; var28 < labelCount; var28++) {
                        const var34: number = labels[var28];
                        if (var34 < requireNonNull(this.labelVertices).length) {
                            const var40 = requireNonNull(arrayAtObj(this.labelVertices, var34));
                            let i = 0;
                            if (independent) {
                                for (; i < var40.length; i++) {
                                    const vertex = var40[i];
                                    if (vertex >>> 0 >= vertices) break;
                                    let vx = (px[vertex] - pivotX) | 0,
                                        vy = (py[vertex] - pivotY) | 0,
                                        vz = (pz[vertex] - pivotZ) | 0;
                                    if (z !== 0) {
                                        const nextX = (Math.imul(vy, sz) + Math.imul(vx, cz) + 32767) >> 16;
                                        vy = (Math.imul(vy, cz) - Math.imul(vx, sz) + 32767) >> 16;
                                        vx = nextX;
                                    }
                                    if (x !== 0) {
                                        const nextY = (Math.imul(vy, cx) - Math.imul(vz, sx) + 32767) >> 16;
                                        vz = (Math.imul(vy, sx) + Math.imul(vz, cx) + 32767) >> 16;
                                        vy = nextY;
                                    }
                                    if (y !== 0) {
                                        const nextX = (Math.imul(vz, sy) + Math.imul(vx, cy) + 32767) >> 16;
                                        vz = (Math.imul(vz, cy) - Math.imul(vx, sy) + 32767) >> 16;
                                        vx = nextX;
                                    }
                                    px[vertex] = (vx + pivotX) | 0;
                                    py[vertex] = (vy + pivotY) | 0;
                                    pz[vertex] = (vz + pivotZ) | 0;
                                }
                            }
                            for (; i < var40.length; i++) {
                                const var52 = var40[i];
                                arrayPutI32(this.pointX, var52, (arrayAtI32(this.pointX, var52) - GlModel.pivotX) | 0);
                                arrayPutI32(this.pointY, var52, (arrayAtI32(this.pointY, var52) - GlModel.pivotY) | 0);
                                arrayPutI32(this.pointZ, var52, (arrayAtI32(this.pointZ, var52) - GlModel.pivotZ) | 0);
                                if (z !== 0) {
                                    const var57: number = arrayAtI32(Pix3D.sinTable, z);
                                    const var63: number = arrayAtI32(Pix3D.cosTable, z);
                                    const var68: number = ((((Math.imul(arrayAtI32(this.pointY, var52), var57) + Math.imul(arrayAtI32(this.pointX, var52), var63)) | 0) + 32767) | 0) >> 16;
                                    arrayPutI32(this.pointY, var52, ((((Math.imul(arrayAtI32(this.pointY, var52), var63) - Math.imul(arrayAtI32(this.pointX, var52), var57)) | 0) + 32767) | 0) >> 16);
                                    arrayPutI32(this.pointX, var52, var68);
                                }
                                if (x !== 0) {
                                    const var58: number = arrayAtI32(Pix3D.sinTable, x);
                                    const var64: number = arrayAtI32(Pix3D.cosTable, x);
                                    const var69: number = ((((Math.imul(arrayAtI32(this.pointY, var52), var64) - Math.imul(arrayAtI32(this.pointZ, var52), var58)) | 0) + 32767) | 0) >> 16;
                                    arrayPutI32(this.pointZ, var52, ((((Math.imul(arrayAtI32(this.pointY, var52), var58) + Math.imul(arrayAtI32(this.pointZ, var52), var64)) | 0) + 32767) | 0) >> 16);
                                    arrayPutI32(this.pointY, var52, var69);
                                }
                                if (y !== 0) {
                                    const var59: number = arrayAtI32(Pix3D.sinTable, y);
                                    const var65: number = arrayAtI32(Pix3D.cosTable, y);
                                    const var70: number = ((((Math.imul(arrayAtI32(this.pointZ, var52), var59) + Math.imul(arrayAtI32(this.pointX, var52), var65)) | 0) + 32767) | 0) >> 16;
                                    arrayPutI32(this.pointZ, var52, ((((Math.imul(arrayAtI32(this.pointZ, var52), var65) - Math.imul(arrayAtI32(this.pointX, var52), var59)) | 0) + 32767) | 0) >> 16);
                                    arrayPutI32(this.pointX, var52, var70);
                                }
                                arrayPutI32(this.pointX, var52, (arrayAtI32(this.pointX, var52) + GlModel.pivotX) | 0);
                                arrayPutI32(this.pointY, var52, (arrayAtI32(this.pointY, var52) + GlModel.pivotY) | 0);
                                arrayPutI32(this.pointZ, var52, (arrayAtI32(this.pointZ, var52) + GlModel.pivotZ) | 0);
                            }
                        }
                    }
                    if (rotateNormals && this.normalX !== null) {
                        for (let var29: number = 0; var29 < labelCount; var29++) {
                            const var35: number = labels[var29];
                            if (var35 < requireNonNull(this.labelVertices).length) {
                                const var41 = requireNonNull(arrayAtObj(this.labelVertices, var35));
                                for (let var47: number = 0; var47 < var41.length; var47++) {
                                    const var53: number = var41[var47];
                                    const var60: number = arrayAtI32(this.vertexOffsets, var53);
                                    const var66: number = arrayAtI32(this.vertexOffsets, (var53 + 1) | 0);
                                    for (let var71: number = var60; var71 < var66; var71++) {
                                        const var73: number = (arrayAtI16(this.vertexIndices, var71) - 1) | 0;
                                        if (var73 === -1) {
                                            break;
                                        }
                                        if (z !== 0) {
                                            const var17: number = arrayAtI32(Pix3D.sinTable, z);
                                            const var18: number = arrayAtI32(Pix3D.cosTable, z);
                                            const var19: number = ((((Math.imul(arrayAtI16(this.normalY, var73), var17) + Math.imul(arrayAtI16(this.normalX, var73), var18)) | 0) + 32767) | 0) >> 16;
                                            arrayPutI16(this.normalY, var73, ((((((Math.imul(arrayAtI16(this.normalY, var73), var18) - Math.imul(arrayAtI16(this.normalX, var73), var17)) | 0) + 32767) | 0) >> 16) << 16) >> 16);
                                            arrayPutI16(this.normalX, var73, (var19 << 16) >> 16);
                                        }
                                        if (x !== 0) {
                                            const var74: number = arrayAtI32(Pix3D.sinTable, x);
                                            const var76: number = arrayAtI32(Pix3D.cosTable, x);
                                            const var78: number = ((((Math.imul(arrayAtI16(this.normalY, var73), var76) - Math.imul(arrayAtI16(this.normalZ, var73), var74)) | 0) + 32767) | 0) >> 16;
                                            arrayPutI16(this.normalZ, var73, ((((((Math.imul(arrayAtI16(this.normalY, var73), var74) + Math.imul(arrayAtI16(this.normalZ, var73), var76)) | 0) + 32767) | 0) >> 16) << 16) >> 16);
                                            arrayPutI16(this.normalY, var73, (var78 << 16) >> 16);
                                        }
                                        if (y !== 0) {
                                            const var75: number = arrayAtI32(Pix3D.sinTable, y);
                                            const var77: number = arrayAtI32(Pix3D.cosTable, y);
                                            const var79: number = ((((Math.imul(arrayAtI16(this.normalZ, var73), var75) + Math.imul(arrayAtI16(this.normalX, var73), var77)) | 0) + 32767) | 0) >> 16;
                                            arrayPutI16(this.normalZ, var73, ((((((Math.imul(arrayAtI16(this.normalZ, var73), var77) - Math.imul(arrayAtI16(this.normalX, var73), var75)) | 0) + 32767) | 0) >> 16) << 16) >> 16);
                                            arrayPutI16(this.normalX, var73, (var79 << 16) >> 16);
                                        }
                                    }
                                }
                            }
                        }
                        if (this.normalStream !== null) {
                            requireNonNull(this.normalStream).valid = false;
                        }
                    }
                } else {
                    if (opcode === 3) {
                        for (let var27: number = 0; var27 < labelCount; var27++) {
                            const var33: number = labels[var27];
                            if (var33 < requireNonNull(this.labelVertices).length) {
                                const var39 = requireNonNull(arrayAtObj(this.labelVertices, var33));
                                for (let var45: number = 0; var45 < var39.length; var45++) {
                                    const var51: number = var39[var45];
                                    arrayPutI32(this.pointX, var51, (arrayAtI32(this.pointX, var51) - GlModel.pivotX) | 0);
                                    arrayPutI32(this.pointY, var51, (arrayAtI32(this.pointY, var51) - GlModel.pivotY) | 0);
                                    arrayPutI32(this.pointZ, var51, (arrayAtI32(this.pointZ, var51) - GlModel.pivotZ) | 0);
                                    arrayPutI32(this.pointX, var51, Math.imul(arrayAtI32(this.pointX, var51), x) >> 7);
                                    arrayPutI32(this.pointY, var51, Math.imul(arrayAtI32(this.pointY, var51), y) >> 7);
                                    arrayPutI32(this.pointZ, var51, Math.imul(arrayAtI32(this.pointZ, var51), z) >> 7);
                                    arrayPutI32(this.pointX, var51, (arrayAtI32(this.pointX, var51) + GlModel.pivotX) | 0);
                                    arrayPutI32(this.pointY, var51, (arrayAtI32(this.pointY, var51) + GlModel.pivotY) | 0);
                                    arrayPutI32(this.pointZ, var51, (arrayAtI32(this.pointZ, var51) + GlModel.pivotZ) | 0);
                                }
                            }
                        }
                    } else {
                        if (opcode === 5) {
                            if (this.labelFaces !== null && this.faceAlpha !== null) {
                                for (let var26: number = 0; var26 < labelCount; var26++) {
                                    const var32: number = labels[var26];
                                    if (var32 < requireNonNull(this.labelFaces).length) {
                                        const var38 = requireNonNull(arrayAtObj(this.labelFaces, var32));
                                        for (let var44: number = 0; var44 < var38.length; var44++) {
                                            const var50: number = var38[var44];
                                            let var56: number = ((((arrayAtU8(this.faceAlpha, var50) << 24) >> 24) & 255) + Math.imul(x, 8)) | 0;
                                            if (var56 < 0) {
                                                var56 = 0;
                                            } else {
                                                if (var56 > 255) {
                                                    var56 = 255;
                                                }
                                            }
                                            arrayPutU8(this.faceAlpha, var50, (var56 << 24) >> 24);
                                        }
                                        if (var38.length > 0) {
                                            requireNonNull(this.colourStream).valid = false;
                                        }
                                    }
                                }
                            }
                        } else {
                            if (opcode === 7) {
                                if (this.labelFaces !== null) {
                                    for (let var8: number = 0; var8 < labelCount; var8++) {
                                        const var9: number = labels[var8];
                                        if (var9 < requireNonNull(this.labelFaces).length) {
                                            const var10 = requireNonNull(arrayAtObj(this.labelFaces, var9));
                                            for (let var11: number = 0; var11 < var10.length; var11++) {
                                                const var12: number = var10[var11];
                                                const var13: number = arrayAtI16(this.faceColour, var12) & 65535;
                                                let var14: number = (var13 >> 10) & 63;
                                                let var15: number = (var13 >> 7) & 7;
                                                let var16: number = var13 & 127;
                                                var14 = ((var14 + x) | 0) & 63;
                                                var15 = (var15 + intDivide(y, 4)) | 0;
                                                if (var15 < 0) {
                                                    var15 = 0;
                                                } else {
                                                    if (var15 > 7) {
                                                        var15 = 7;
                                                    }
                                                }
                                                var16 = (var16 + z) | 0;
                                                if (var16 < 0) {
                                                    var16 = 0;
                                                } else {
                                                    if (var16 > 127) {
                                                        var16 = 127;
                                                    }
                                                }
                                                arrayPutI16(this.faceColour, var12, (((var14 << 10) | (var15 << 7) | var16) << 16) >> 16);
                                            }
                                            if (var10.length > 0) {
                                                requireNonNull(this.colourStream).valid = false;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // td.a(IIII)V
    animateAll(opcode: number, x: number, y: number, z: number): void {
        if (opcode === 0) {
            let var14: number = 0;
            GlModel.pivotX = 0;
            GlModel.pivotY = 0;
            GlModel.pivotZ = 0;
            for (let var19: number = 0; var19 < this.vertexCount; var19++) {
                GlModel.pivotX = (GlModel.pivotX + arrayAtI32(this.pointX, var19)) | 0;
                GlModel.pivotY = (GlModel.pivotY + arrayAtI32(this.pointY, var19)) | 0;
                GlModel.pivotZ = (GlModel.pivotZ + arrayAtI32(this.pointZ, var19)) | 0;
                var14++;
            }
            if (var14 > 0) {
                GlModel.pivotX = (intDivide(GlModel.pivotX, var14) + x) | 0;
                GlModel.pivotY = (intDivide(GlModel.pivotY, var14) + y) | 0;
                GlModel.pivotZ = (intDivide(GlModel.pivotZ, var14) + z) | 0;
            } else {
                GlModel.pivotX = x;
                GlModel.pivotY = y;
                GlModel.pivotZ = z;
            }
        } else {
            if (opcode === 1) {
                for (let var13: number = 0; var13 < this.vertexCount; var13++) {
                    arrayPutI32(this.pointX, var13, (arrayAtI32(this.pointX, var13) + x) | 0);
                    arrayPutI32(this.pointY, var13, (arrayAtI32(this.pointY, var13) + y) | 0);
                    arrayPutI32(this.pointZ, var13, (arrayAtI32(this.pointZ, var13) + z) | 0);
                }
            } else {
                if (opcode === 2) {
                    for (let var12: number = 0; var12 < this.vertexCount; var12++) {
                        arrayPutI32(this.pointX, var12, (arrayAtI32(this.pointX, var12) - GlModel.pivotX) | 0);
                        arrayPutI32(this.pointY, var12, (arrayAtI32(this.pointY, var12) - GlModel.pivotY) | 0);
                        arrayPutI32(this.pointZ, var12, (arrayAtI32(this.pointZ, var12) - GlModel.pivotZ) | 0);
                        if (z !== 0) {
                            const var16: number = arrayAtI32(Pix3D.sinTable, z);
                            const var21: number = arrayAtI32(Pix3D.cosTable, z);
                            const var25: number = ((((Math.imul(arrayAtI32(this.pointY, var12), var16) + Math.imul(arrayAtI32(this.pointX, var12), var21)) | 0) + 32767) | 0) >> 16;
                            arrayPutI32(this.pointY, var12, ((((Math.imul(arrayAtI32(this.pointY, var12), var21) - Math.imul(arrayAtI32(this.pointX, var12), var16)) | 0) + 32767) | 0) >> 16);
                            arrayPutI32(this.pointX, var12, var25);
                        }
                        if (x !== 0) {
                            const var17: number = arrayAtI32(Pix3D.sinTable, x);
                            const var22: number = arrayAtI32(Pix3D.cosTable, x);
                            const var26: number = ((((Math.imul(arrayAtI32(this.pointY, var12), var22) - Math.imul(arrayAtI32(this.pointZ, var12), var17)) | 0) + 32767) | 0) >> 16;
                            arrayPutI32(this.pointZ, var12, ((((Math.imul(arrayAtI32(this.pointY, var12), var17) + Math.imul(arrayAtI32(this.pointZ, var12), var22)) | 0) + 32767) | 0) >> 16);
                            arrayPutI32(this.pointY, var12, var26);
                        }
                        if (y !== 0) {
                            const var18: number = arrayAtI32(Pix3D.sinTable, y);
                            const var23: number = arrayAtI32(Pix3D.cosTable, y);
                            const var27: number = ((((Math.imul(arrayAtI32(this.pointZ, var12), var18) + Math.imul(arrayAtI32(this.pointX, var12), var23)) | 0) + 32767) | 0) >> 16;
                            arrayPutI32(this.pointZ, var12, ((((Math.imul(arrayAtI32(this.pointZ, var12), var23) - Math.imul(arrayAtI32(this.pointX, var12), var18)) | 0) + 32767) | 0) >> 16);
                            arrayPutI32(this.pointX, var12, var27);
                        }
                        arrayPutI32(this.pointX, var12, (arrayAtI32(this.pointX, var12) + GlModel.pivotX) | 0);
                        arrayPutI32(this.pointY, var12, (arrayAtI32(this.pointY, var12) + GlModel.pivotY) | 0);
                        arrayPutI32(this.pointZ, var12, (arrayAtI32(this.pointZ, var12) + GlModel.pivotZ) | 0);
                    }
                } else {
                    if (opcode !== 3) {
                        if (opcode === 5) {
                            for (let var11: number = 0; var11 < this.faceCount; var11++) {
                                let var15: number = ((((arrayAtU8(this.faceAlpha, var11) << 24) >> 24) & 255) + Math.imul(x, 8)) | 0;
                                if (var15 < 0) {
                                    var15 = 0;
                                } else {
                                    if (var15 > 255) {
                                        var15 = 255;
                                    }
                                }
                                arrayPutU8(this.faceAlpha, var11, (var15 << 24) >> 24);
                            }
                            requireNonNull(this.colourStream).valid = false;
                        } else {
                            if (opcode === 7) {
                                for (let var10: number = 0; var10 < this.faceCount; var10++) {
                                    const var6: number = arrayAtI16(this.faceColour, var10) & 65535;
                                    let var7: number = (var6 >> 10) & 63;
                                    let var8: number = (var6 >> 7) & 7;
                                    let var9: number = var6 & 127;
                                    var7 = ((var7 + x) | 0) & 63;
                                    var8 = (var8 + intDivide(y, 4)) | 0;
                                    if (var8 < 0) {
                                        var8 = 0;
                                    } else {
                                        if (var8 > 7) {
                                            var8 = 7;
                                        }
                                    }
                                    var9 = (var9 + z) | 0;
                                    if (var9 < 0) {
                                        var9 = 0;
                                    } else {
                                        if (var9 > 127) {
                                            var9 = 127;
                                        }
                                    }
                                    arrayPutI16(this.faceColour, var10, (((var7 << 10) | (var8 << 7) | var9) << 16) >> 16);
                                }
                                requireNonNull(this.colourStream).valid = false;
                            }
                        }
                    } else {
                        for (let var5: number = 0; var5 < this.vertexCount; var5++) {
                            arrayPutI32(this.pointX, var5, (arrayAtI32(this.pointX, var5) - GlModel.pivotX) | 0);
                            arrayPutI32(this.pointY, var5, (arrayAtI32(this.pointY, var5) - GlModel.pivotY) | 0);
                            arrayPutI32(this.pointZ, var5, (arrayAtI32(this.pointZ, var5) - GlModel.pivotZ) | 0);
                            arrayPutI32(this.pointX, var5, intDivide(Math.imul(arrayAtI32(this.pointX, var5), x), 128));
                            arrayPutI32(this.pointY, var5, intDivide(Math.imul(arrayAtI32(this.pointY, var5), y), 128));
                            arrayPutI32(this.pointZ, var5, intDivide(Math.imul(arrayAtI32(this.pointZ, var5), z), 128));
                            arrayPutI32(this.pointX, var5, (arrayAtI32(this.pointX, var5) + GlModel.pivotX) | 0);
                            arrayPutI32(this.pointY, var5, (arrayAtI32(this.pointY, var5) + GlModel.pivotY) | 0);
                            arrayPutI32(this.pointZ, var5, (arrayAtI32(this.pointZ, var5) + GlModel.pivotZ) | 0);
                        }
                    }
                }
            }
        }
    }

    // td.v()V
    static resetTempModels(): void {
        GlModel.tempActorStorage = new GlModel();
        GlModel.tempActorModel = new GlModel();
        GlModel.tempSpotStorage = new GlModel();
        GlModel.tempSpotModel = new GlModel();
        GlModel.tempLocStorage = new GlModel();
        GlModel.tempLocModel = new GlModel();
    }

    // td.h()I
    getMinX(): number {
        if (!requireNonNull(this.bounds).valid) {
            this.calculateBounds();
        }
        return requireNonNull(this.bounds).minX;
    }

    // td.w()V
    private drawElements(): void {
        const var1: GL | null = GlRenderer.gl;
        if (this.faceCount !== 0) {
            if (this.deferredUpdateMask !== 0) {
                this.uploadVertices(
                    true,
                    !requireNonNull(this.positionStream).valid && (this.deferredUpdateMask & 1) !== 0,
                    !requireNonNull(this.colourStream).valid && (this.deferredUpdateMask & 2) !== 0,
                    this.normalStream !== null && !requireNonNull(this.normalStream).valid && (this.deferredUpdateMask & 4) !== 0,
                    false
                );
            }
            this.uploadVertices(false, !requireNonNull(this.positionStream).valid, !requireNonNull(this.colourStream).valid, this.normalStream !== null && !requireNonNull(this.normalStream).valid, !requireNonNull(this.uvStream).valid);
            if (!requireNonNull(this.indexStream).valid) {
                this.uploadIndices();
            }
            if (this.bufferFlags !== 0) {
                if ((this.bufferFlags & 1) !== 0) {
                    this.pointX = null;
                    this.pointY = null;
                    this.pointZ = null;
                    this.vertexIndices = null;
                    this.vertexOffsets = null;
                }
                if ((this.bufferFlags & 2) !== 0) {
                    this.faceColour = null;
                    this.faceAlpha = null;
                }
                if ((this.bufferFlags & 4) !== 0) {
                    this.normalX = null;
                    this.normalY = null;
                    this.normalZ = null;
                    this.normalCount = null;
                }
                if ((this.bufferFlags & 8) !== 0) {
                    this.texU = null;
                    this.texV = null;
                }
                if ((this.bufferFlags & 16) !== 0) {
                    this.faceVertexA = null;
                    this.faceVertexB = null;
                    this.faceVertexC = null;
                }
                this.bufferFlags = 0;
            }
            let var2: GlBuffer | null = null;
            if (requireNonNull(this.positionStream).vbo !== null) {
                requireNonNull(requireNonNull(this.positionStream).vbo).bindArray();
                var2 = requireNonNull(this.positionStream).vbo;
                requireNonNull(var1).glVertexPointer(3, 5126, requireNonNull(this.positionStream).stride, streamByteOffset(requireNonNull(this.positionStream).offset));
            }
            if (requireNonNull(this.colourStream).vbo !== null) {
                if (var2 !== requireNonNull(this.colourStream).vbo) {
                    requireNonNull(requireNonNull(this.colourStream).vbo).bindArray();
                    var2 = requireNonNull(this.colourStream).vbo;
                }
                requireNonNull(var1).glColorPointer(4, 5121, requireNonNull(this.colourStream).stride, streamByteOffset(requireNonNull(this.colourStream).offset));
            }
            if (Preferences.graphics.highDetailLighting && requireNonNull(this.normalStream).vbo !== null) {
                if (var2 !== requireNonNull(this.normalStream).vbo) {
                    requireNonNull(requireNonNull(this.normalStream).vbo).bindArray();
                    var2 = requireNonNull(this.normalStream).vbo;
                }
                requireNonNull(var1).glNormalPointer(5126, requireNonNull(this.normalStream).stride, streamByteOffset(requireNonNull(this.normalStream).offset));
            }
            if (requireNonNull(this.uvStream).vbo !== null) {
                if (var2 !== requireNonNull(this.uvStream).vbo) {
                    requireNonNull(requireNonNull(this.uvStream).vbo).bindArray();
                    var2 = requireNonNull(this.uvStream).vbo;
                }
                requireNonNull(var1).glTexCoordPointer(2, 5126, requireNonNull(this.uvStream).stride, streamByteOffset(requireNonNull(this.uvStream).offset));
            }
            if (requireNonNull(this.indexStream).vbo !== null) {
                requireNonNull(requireNonNull(this.indexStream).vbo).bindElements();
            }
            if (
                requireNonNull(this.positionStream).vbo === null ||
                requireNonNull(this.colourStream).vbo === null ||
                (Preferences.graphics.highDetailLighting && requireNonNull(this.normalStream).vbo === null) ||
                requireNonNull(this.uvStream).vbo === null
            ) {
                if (GlRenderer.vboSupported) {
                    requireNonNull(var1).glBindBufferARB(34962, 0);
                }
                if (requireNonNull(this.positionStream).vbo === null) {
                    requireNonNull(requireNonNull(this.positionStream).buffer).position(requireNonNull(this.positionStream).offset);
                    requireNonNull(var1).glVertexPointer(3, 5126, requireNonNull(this.positionStream).stride, requireNonNull(this.positionStream).buffer);
                }
                if (requireNonNull(this.colourStream).vbo === null) {
                    requireNonNull(requireNonNull(this.colourStream).buffer).position(requireNonNull(this.colourStream).offset);
                    requireNonNull(var1).glColorPointer(4, 5121, requireNonNull(this.colourStream).stride, requireNonNull(this.colourStream).buffer);
                }
                if (Preferences.graphics.highDetailLighting && requireNonNull(this.normalStream).vbo === null) {
                    requireNonNull(requireNonNull(this.normalStream).buffer).position(requireNonNull(this.normalStream).offset);
                    requireNonNull(var1).glNormalPointer(5126, requireNonNull(this.normalStream).stride, requireNonNull(this.normalStream).buffer);
                }
                if (requireNonNull(this.uvStream).vbo === null) {
                    requireNonNull(requireNonNull(this.uvStream).buffer).position(requireNonNull(this.uvStream).offset);
                    requireNonNull(var1).glTexCoordPointer(2, 5126, requireNonNull(this.uvStream).stride, requireNonNull(this.uvStream).buffer);
                }
            }
            if (requireNonNull(this.indexStream).vbo === null && GlRenderer.vboSupported) {
                requireNonNull(var1).glBindBufferARB(34963, 0);
            }
            const var3: number = (requireNonNull(this.materialRuns).length - 1) | 0;
            for (let var4: number = 0; var4 < var3; var4++) {
                const var5: number = arrayAtI32(this.materialRuns, var4);
                const var6: number = arrayAtI32(this.materialRuns, (var4 + 1) | 0);
                const var7: number = arrayAtI16(this.faceMaterial, var5);
                if (var7 === -1) {
                    GlRenderer.bindTexture2D(-1);
                    MaterialManager.setMaterial(0, 0);
                } else {
                    requireNonNull(Pix3D.textureProvider as HdTextureProvider | null).bindTexture(var7 & 65535, true);
                }
                if (requireNonNull(this.indexStream).vbo !== null) {
                    requireNonNull(var1).glDrawElements(4, Math.imul((var6 - var5) | 0, 3), 5125, faceRunByteOffsets[var5] ?? BigInt(Math.imul(var5, 12)));
                } else {
                    requireNonNull(requireNonNull(this.indexStream).buffer).position(Math.imul(var5, 12));
                    requireNonNull(var1).glDrawElements(4, Math.imul((var6 - var5) | 0, 3), 5125, requireNonNull(this.indexStream).buffer);
                }
            }
        }
    }

    // td.f()V
    endAnimate(): void {
        for (let var1: number = 0; var1 < this.vertexCount; var1++) {
            arrayPutI32(this.pointX, var1, ((arrayAtI32(this.pointX, var1) + 7) | 0) >> 4);
            arrayPutI32(this.pointY, var1, ((arrayAtI32(this.pointY, var1) + 7) | 0) >> 4);
            arrayPutI32(this.pointZ, var1, ((arrayAtI32(this.pointZ, var1) + 7) | 0) >> 4);
        }
        requireNonNull(this.bounds).valid = false;
        requireNonNull(this.positionStream).valid = false;
    }

    // td.x()V
    Mirror(): void {
        for (let var1: number = 0; var1 < this.vertexCount; var1++) {
            arrayPutI32(this.pointZ, var1, -arrayAtI32(this.pointZ, var1) | 0);
        }
        if (this.normalZ !== null) {
            for (let var3: number = 0; var3 < this.expandedVertexCount; var3++) {
                arrayPutI16(this.normalZ, var3, (-arrayAtI16(this.normalZ, var3) << 16) >> 16);
            }
        }
        for (let var4: number = 0; var4 < this.faceCount; var4++) {
            const var2: number = arrayAtI16(this.faceVertexA, var4);
            arrayPutI16(this.faceVertexA, var4, arrayAtI16(this.faceVertexC, var4));
            arrayPutI16(this.faceVertexC, var4, var2);
        }
        requireNonNull(this.bounds).valid = false;
        requireNonNull(this.positionStream).valid = false;
        if (this.normalStream !== null) {
            requireNonNull(this.normalStream).valid = false;
        }
        requireNonNull(this.indexStream).valid = false;
    }

    // td.d(I)V
    RotateXAxis(angle: number): void {
        const var2: number = arrayAtI32(Pix3D.sinTable, angle);
        const var3: number = arrayAtI32(Pix3D.cosTable, angle);
        for (let var4: number = 0; var4 < this.vertexCount; var4++) {
            const var5: number = ((Math.imul(arrayAtI32(this.pointY, var4), var3) - Math.imul(arrayAtI32(this.pointZ, var4), var2)) | 0) >> 16;
            arrayPutI32(this.pointZ, var4, ((Math.imul(arrayAtI32(this.pointY, var4), var2) + Math.imul(arrayAtI32(this.pointZ, var4), var3)) | 0) >> 16);
            arrayPutI32(this.pointY, var4, var5);
        }
        requireNonNull(this.bounds).valid = false;
        requireNonNull(this.positionStream).valid = false;
    }

    // td.g(I)V
    rotateYAxisWithNormals(angle: number): void {
        if (this.normalX === null) {
            this.RotateYAxis(angle);
        } else {
            const var2: number = arrayAtI32(Pix3D.sinTable, angle);
            const var3: number = arrayAtI32(Pix3D.cosTable, angle);
            for (let var4: number = 0; var4 < this.vertexCount; var4++) {
                const var5: number = ((Math.imul(arrayAtI32(this.pointZ, var4), var2) + Math.imul(arrayAtI32(this.pointX, var4), var3)) | 0) >> 16;
                arrayPutI32(this.pointZ, var4, ((Math.imul(arrayAtI32(this.pointZ, var4), var3) - Math.imul(arrayAtI32(this.pointX, var4), var2)) | 0) >> 16);
                arrayPutI32(this.pointX, var4, var5);
            }
            for (let var6: number = 0; var6 < this.expandedVertexCount; var6++) {
                const var7: number = ((Math.imul(arrayAtI16(this.normalZ, var6), var2) + Math.imul(arrayAtI16(this.normalX, var6), var3)) | 0) >> 16;
                arrayPutI16(this.normalZ, var6, ((((Math.imul(arrayAtI16(this.normalZ, var6), var3) - Math.imul(arrayAtI16(this.normalX, var6), var2)) | 0) >> 16) << 16) >> 16);
                arrayPutI16(this.normalX, var6, (var7 << 16) >> 16);
            }
            requireNonNull(this.bounds).valid = false;
            requireNonNull(this.positionStream).valid = false;
            if (this.normalStream !== null) {
                requireNonNull(this.normalStream).valid = false;
            }
        }
    }

    // td.a(Lek;)Lek;
    createShadow(reuse: Pix8 | null): Pix8 | null {
        if (this.expandedVertexCount === 0) {
            return null;
        } else {
            if (!requireNonNull(this.bounds).valid) {
                this.calculateBounds();
            }
            let var2: number;
            let var3: number;
            if (GlLighting.shadowSlopeX > 0) {
                var2 = ((requireNonNull(this.bounds).minX - (Math.imul(requireNonNull(this.bounds).maxY, GlLighting.shadowSlopeX) >> 8)) | 0) >> 3;
                var3 = ((requireNonNull(this.bounds).maxX - (Math.imul(requireNonNull(this.bounds).minY, GlLighting.shadowSlopeX) >> 8)) | 0) >> 3;
            } else {
                var2 = ((requireNonNull(this.bounds).minX - (Math.imul(requireNonNull(this.bounds).minY, GlLighting.shadowSlopeX) >> 8)) | 0) >> 3;
                var3 = ((requireNonNull(this.bounds).maxX - (Math.imul(requireNonNull(this.bounds).maxY, GlLighting.shadowSlopeX) >> 8)) | 0) >> 3;
            }
            let var4: number;
            let var5: number;
            if (GlLighting.shadowSlopeZ > 0) {
                var4 = ((requireNonNull(this.bounds).minZ - (Math.imul(requireNonNull(this.bounds).maxY, GlLighting.shadowSlopeZ) >> 8)) | 0) >> 3;
                var5 = ((requireNonNull(this.bounds).maxZ - (Math.imul(requireNonNull(this.bounds).minY, GlLighting.shadowSlopeZ) >> 8)) | 0) >> 3;
            } else {
                var4 = ((requireNonNull(this.bounds).minZ - (Math.imul(requireNonNull(this.bounds).minY, GlLighting.shadowSlopeZ) >> 8)) | 0) >> 3;
                var5 = ((requireNonNull(this.bounds).maxZ - (Math.imul(requireNonNull(this.bounds).maxY, GlLighting.shadowSlopeZ) >> 8)) | 0) >> 3;
            }
            const var6: number = (((var3 - var2) | 0) + 1) | 0;
            const var7: number = (((var5 - var4) | 0) + 1) | 0;
            let var8: Pix8 | null;
            if (reuse !== null && requireNonNull(requireNonNull(reuse).pixels).length >= Math.imul(var6, var7)) {
                var8 = reuse;
                requireNonNull(reuse).cropW = requireNonNull(reuse).width = var6;
                requireNonNull(reuse).cropH = requireNonNull(reuse).height = var7;
                requireNonNull(reuse).clear();
            } else {
                var8 = new Pix8(var6, var7, 0);
            }
            requireNonNull(var8).xOffset = var2;
            requireNonNull(var8).yOffset = var4;
            if (requireNonNull(GlModel.shadowZ).length < this.expandedVertexCount) {
                GlModel.shadowZ = new Int32Array(this.expandedVertexCount);
                GlModel.shadowX = new Int32Array(this.expandedVertexCount);
            }
            const pointX = this.pointX,
                pointY = this.pointY,
                pointZ = this.pointZ,
                offsets = this.vertexOffsets;
            const indices = this.vertexIndices,
                shadowZ = GlModel.shadowZ,
                shadowX = GlModel.shadowX;
            const vertexCount = this.vertexCount;
            const completePoints = pointX !== null && pointY !== null && pointZ !== null && offsets !== null && pointX.length >= vertexCount && pointY.length >= vertexCount && pointZ.length >= vertexCount && offsets.length > vertexCount;
            const shadowLength = Math.min(shadowZ?.length ?? 0, shadowX?.length ?? 0);
            for (let var9: number = 0; var9 < this.vertexCount; var9++) {
                const px = completePoints ? pointX[var9] : arrayAtI32(pointX, var9);
                const py = completePoints ? pointY[var9] : arrayAtI32(pointY, var9);
                const var10 = ((((px - (Math.imul(py, GlLighting.shadowSlopeX) >> 8)) | 0) >> 3) - var2) | 0;
                const pz = completePoints ? pointZ[var9] : arrayAtI32(pointZ, var9);
                const var11 = ((((pz - (Math.imul(py, GlLighting.shadowSlopeZ) >> 8)) | 0) >> 3) - var4) | 0;
                const var12 = completePoints ? offsets[var9] : arrayAtI32(offsets, var9);
                const var13 = completePoints ? offsets[var9 + 1] : arrayAtI32(offsets, (var9 + 1) | 0);
                const completeIndices = indices !== null && var12 >= 0 && var13 <= indices.length;
                for (let var14: number = var12; var14 < var13; var14++) {
                    const var15 = ((completeIndices ? indices[var14] : arrayAtI16(indices, var14)) - 1) | 0;
                    if (var15 === -1) {
                        break;
                    }
                    if (shadowZ !== null && shadowX !== null && var15 >>> 0 < shadowLength) {
                        shadowZ[var15] = var10;
                        shadowX[var15] = var11;
                    } else {
                        arrayPutI32(shadowZ, var15, var10);
                        arrayPutI32(shadowX, var15, var11);
                    }
                }
            }
            const faceA = this.faceVertexA,
                faceB = this.faceVertexB,
                faceC = this.faceVertexC,
                alpha = this.faceAlpha;
            const completeFaces = faceA !== null && faceB !== null && faceC !== null && alpha !== null && faceA.length >= this.faceCount && faceB.length >= this.faceCount && faceC.length >= this.faceCount && alpha.length >= this.faceCount;
            for (let var19: number = 0; var19 < this.faceCount; var19++) {
                if (((completeFaces ? alpha[var19] : arrayAtU8(alpha, var19)) << 24) >> 24 <= 128) {
                    const var20 = completeFaces ? faceA[var19] : arrayAtI16(faceA, var19);
                    const var21 = completeFaces ? faceB[var19] : arrayAtI16(faceB, var19);
                    const var22 = completeFaces ? faceC[var19] : arrayAtI16(faceC, var19);
                    const completeTriangle = shadowZ !== null && shadowX !== null && var20 >>> 0 < shadowLength && var21 >>> 0 < shadowLength && var22 >>> 0 < shadowLength;
                    const var23 = completeTriangle ? shadowZ[var20] : arrayAtI32(shadowZ, var20);
                    const var24 = completeTriangle ? shadowZ[var21] : arrayAtI32(shadowZ, var21);
                    const var25 = completeTriangle ? shadowZ[var22] : arrayAtI32(shadowZ, var22);
                    const var16 = completeTriangle ? shadowX[var20] : arrayAtI32(shadowX, var20);
                    const var17 = completeTriangle ? shadowX[var21] : arrayAtI32(shadowX, var21);
                    const var18 = completeTriangle ? shadowX[var22] : arrayAtI32(shadowX, var22);
                    if (((Math.imul((var23 - var24) | 0, (var17 - var18) | 0) - Math.imul((var17 - var16) | 0, (var25 - var24) | 0)) | 0) > 0) {
                        Pix3D.fillShadowTriangle(requireNonNull(var8).pixels, var16, var17, var18, var23, var24, var25, var6);
                    }
                }
            }
            return var8;
        }
    }

    // td.l()V
    Rotate270(): void {
        for (let var1: number = 0; var1 < this.vertexCount; var1++) {
            const var2: number = arrayAtI32(this.pointZ, var1);
            arrayPutI32(this.pointZ, var1, arrayAtI32(this.pointX, var1));
            arrayPutI32(this.pointX, var1, -var2 | 0);
        }
        requireNonNull(this.bounds).valid = false;
        requireNonNull(this.positionStream).valid = false;
    }
}
