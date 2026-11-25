import { GLX as E } from './GlEnums';
import type Buffer from '#/util/nio/Buffer';

// GlState: the driver's mirror of every OpenGL state the jar touches (HD_PLAN 2.2). Host code, not a Java port.
//
// It follows real GL 1.3/2.1 compatibility-profile semantics, not tf's state cache (some calls bypass tf). Initial
// values are the GL spec's. GL errors never throw here: a failing command sets the sticky error (as glGetError would
// report it) and changes nothing, as GL does. Enum values outside the jar's inventory are rejected earlier, by
// WebGpuGL, with GlUnsupported.
//
// Numerics. Matrices are column-major Float32Array(16) (GL's memory order). Each transform is computed in double
// and the result rounded to binary32, which is how a GL driver stores them; no Java-visible value depends on it.
// Values set from float[] arguments are copied as raw bits (NaN payloads kept).

export type Mat4 = Float32Array;

// Sixteen finite binary32 values always have a finite sum in binary64.
function finiteMatrix(m: Mat4): boolean {
    return Number.isFinite(m[0] + m[1] + m[2] + m[3] + m[4] + m[5] + m[6] + m[7] + m[8] + m[9] + m[10] + m[11] + m[12] + m[13] + m[14] + m[15]);
}

export function identity(): Mat4 {
    const m = new Float32Array(16);
    m[0] = m[5] = m[10] = m[15] = 1;
    return m;
}

// out = a * b (column-major), computed in double, stored as binary32. out may alias a or b.
export function multiply(out: Mat4, a: ArrayLike<number>, b: ArrayLike<number>, product = new Float64Array(16)): Mat4 {
    for (let c = 0; c < 4; c++) {
        const column = c * 4;
        const x = b[column],
            y = b[column + 1],
            z = b[column + 2],
            w = b[column + 3];
        for (let row = 0; row < 4; row++) {
            product[column + row] = 0 + a[row] * x + a[4 + row] * y + a[8 + row] * z + a[12 + row] * w;
        }
    }
    out.set(product);
    return out;
}

// The inverse of m in double, or null when m is singular.
export function invert(m: ArrayLike<number>, inv = new Float64Array(16)): Float64Array | null {
    const a = m;
    inv[0] = a[5] * a[10] * a[15] - a[5] * a[11] * a[14] - a[9] * a[6] * a[15] + a[9] * a[7] * a[14] + a[13] * a[6] * a[11] - a[13] * a[7] * a[10];
    inv[4] = -a[4] * a[10] * a[15] + a[4] * a[11] * a[14] + a[8] * a[6] * a[15] - a[8] * a[7] * a[14] - a[12] * a[6] * a[11] + a[12] * a[7] * a[10];
    inv[8] = a[4] * a[9] * a[15] - a[4] * a[11] * a[13] - a[8] * a[5] * a[15] + a[8] * a[7] * a[13] + a[12] * a[5] * a[11] - a[12] * a[7] * a[9];
    inv[12] = -a[4] * a[9] * a[14] + a[4] * a[10] * a[13] + a[8] * a[5] * a[14] - a[8] * a[6] * a[13] - a[12] * a[5] * a[10] + a[12] * a[6] * a[9];
    inv[1] = -a[1] * a[10] * a[15] + a[1] * a[11] * a[14] + a[9] * a[2] * a[15] - a[9] * a[3] * a[14] - a[13] * a[2] * a[11] + a[13] * a[3] * a[10];
    inv[5] = a[0] * a[10] * a[15] - a[0] * a[11] * a[14] - a[8] * a[2] * a[15] + a[8] * a[3] * a[14] + a[12] * a[2] * a[11] - a[12] * a[3] * a[10];
    inv[9] = -a[0] * a[9] * a[15] + a[0] * a[11] * a[13] + a[8] * a[1] * a[15] - a[8] * a[3] * a[13] - a[12] * a[1] * a[11] + a[12] * a[3] * a[9];
    inv[13] = a[0] * a[9] * a[14] - a[0] * a[10] * a[13] - a[8] * a[1] * a[14] + a[8] * a[2] * a[13] + a[12] * a[1] * a[10] - a[12] * a[2] * a[9];
    inv[2] = a[1] * a[6] * a[15] - a[1] * a[7] * a[14] - a[5] * a[2] * a[15] + a[5] * a[3] * a[14] + a[13] * a[2] * a[7] - a[13] * a[3] * a[6];
    inv[6] = -a[0] * a[6] * a[15] + a[0] * a[7] * a[14] + a[4] * a[2] * a[15] - a[4] * a[3] * a[14] - a[12] * a[2] * a[7] + a[12] * a[3] * a[6];
    inv[10] = a[0] * a[5] * a[15] - a[0] * a[7] * a[13] - a[4] * a[1] * a[15] + a[4] * a[3] * a[13] + a[12] * a[1] * a[7] - a[12] * a[3] * a[5];
    inv[14] = -a[0] * a[5] * a[14] + a[0] * a[6] * a[13] + a[4] * a[1] * a[14] - a[4] * a[2] * a[13] - a[12] * a[1] * a[6] + a[12] * a[2] * a[5];
    inv[3] = -a[1] * a[6] * a[11] + a[1] * a[7] * a[10] + a[5] * a[2] * a[11] - a[5] * a[3] * a[10] - a[9] * a[2] * a[7] + a[9] * a[3] * a[6];
    inv[7] = a[0] * a[6] * a[11] - a[0] * a[7] * a[10] - a[4] * a[2] * a[11] + a[4] * a[3] * a[10] + a[8] * a[2] * a[7] - a[8] * a[3] * a[6];
    inv[11] = -a[0] * a[5] * a[11] + a[0] * a[7] * a[9] + a[4] * a[1] * a[11] - a[4] * a[3] * a[9] - a[8] * a[1] * a[7] + a[8] * a[3] * a[5];
    inv[15] = a[0] * a[5] * a[10] - a[0] * a[6] * a[9] - a[4] * a[1] * a[10] + a[4] * a[2] * a[9] + a[8] * a[1] * a[6] - a[8] * a[2] * a[5];
    const det = a[0] * inv[0] + a[1] * inv[4] + a[2] * inv[8] + a[3] * inv[12];
    if (det === 0 || !Number.isFinite(det)) return null;
    for (let i = 0; i < 16; i++) inv[i] /= det;
    return inv;
}

// m * v for a column vector v (4 components), in double, stored as binary32.
export function transformPoint(m: ArrayLike<number>, v: ArrayLike<number>, out: Float32Array = new Float32Array(4)): Float32Array {
    const x = v[0],
        y = v[1],
        z = v[2],
        w = v[3];
    for (let row = 0; row < 4; row++) out[row] = m[row] * x + m[4 + row] * y + m[8 + row] * z + m[12 + row] * w;
    return out;
}

// Copies count binary32 values from src[offset..] as raw bits (NaN payloads kept). Throws RangeError when the source
// does not hold them: the native driver would read past the Java array.
export function copyFloatBits(dst: Float32Array, src: Float32Array, offset: number, count: number): void {
    if (offset < 0 || offset + count > src.length) throw new RangeError('GL read ' + count + ' floats at ' + offset + ' of a float[' + src.length + ']');
    if (offset === 0 && count === src.length && count <= dst.length) {
        dst.set(src);
        return;
    }
    new Uint32Array(dst.buffer, dst.byteOffset, count).set(new Uint32Array(src.buffer, src.byteOffset + offset * 4, count));
}

export function vec4(x: number, y: number, z: number, w: number): Float32Array {
    return Float32Array.of(x, y, z, w);
}

function clamp01(v: number): number {
    return v < 0 ? 0 : v > 1 ? 1 : v;
}

export class TexEnvState {
    private cachedShaderKey: string | null = null;
    private cachedCombinerKey: string | null = null;
    private idTable?: Map<string, number>;
    private combinerId = 0;
    private readonly combinerValues: number[] = [];
    private readonly recentCombiners: { values: number[]; key: string }[] = [];
    private nextCombiner = 0;
    private readsConstant = false;
    mode: number = E.GL_MODULATE;
    readonly color = vec4(0, 0, 0, 0);
    combineRgb: number = E.GL_MODULATE;
    combineAlpha: number = E.GL_MODULATE;
    readonly sourceRgb = Int32Array.of(E.GL_TEXTURE, E.GL_PREVIOUS, E.GL_CONSTANT);
    readonly sourceAlpha = Int32Array.of(E.GL_TEXTURE, E.GL_PREVIOUS, E.GL_CONSTANT);
    readonly operandRgb = Int32Array.of(E.GL_SRC_COLOR, E.GL_SRC_COLOR, E.GL_SRC_ALPHA);
    readonly operandAlpha = Int32Array.of(E.GL_SRC_ALPHA, E.GL_SRC_ALPHA, E.GL_SRC_ALPHA);
    rgbScale = 1;
    alphaScale = 1;

    invalidateShaderKey(colorOnly = false): void {
        this.cachedShaderKey = null;
        if (!colorOnly) {
            this.cachedCombinerKey = null;
            this.combinerId = 0;
        }
    }

    // Indexed shaders read constant colour from uniforms. Prewarmed and live GL states
    // with the same active combiner share a small ID in the owning renderer.
    indexedCombinerId(ids: Map<string, number>): number {
        if (this.combinerId !== 0 && this.idTable === ids) return this.combinerId;
        const key = this.shaderKey(false);
        let id = ids.get(key);
        if (id === undefined) {
            id = ids.size + 1;
            ids.set(key, id);
        }
        this.idTable = ids;
        return (this.combinerId = id);
    }

    usesConstantColor(): boolean {
        this.shaderKey(false);
        return this.readsConstant;
    }

    // Only operands consumed by the active combiner affect its WGSL. A changing, unused constant
    // colour must not allocate a new pipeline on every water or lighting update.
    shaderKey(includeColor = true): string {
        if (this.cachedCombinerKey === null) this.cachedCombinerKey = this.combinerKey();
        if (!includeColor || !this.readsConstant) return this.cachedCombinerKey;
        return (this.cachedShaderKey ??= this.cachedCombinerKey + ',' + this.color.join(','));
    }

    private combinerKey(): string {
        this.readsConstant = false;
        if (this.mode !== E.GL_COMBINE) return String(this.mode);
        const values = this.combinerValues;
        values[0] = this.mode;
        values[1] = this.combineRgb;
        values[2] = this.combineAlpha;
        values[3] = this.rgbScale;
        values[4] = this.alphaScale;
        let used = 5;
        for (let channel = 0; channel < 2; channel++) {
            const op = channel === 0 ? this.combineRgb : this.combineAlpha;
            const source = channel === 0 ? this.sourceRgb : this.sourceAlpha;
            const operand = channel === 0 ? this.operandRgb : this.operandAlpha;
            const count = op === E.GL_REPLACE ? 1 : op === E.GL_INTERPOLATE ? 3 : 2;
            for (let i = 0; i < count; i++) {
                values[used++] = source[i];
                values[used++] = operand[i];
                if (source[i] === E.GL_CONSTANT) this.readsConstant = true;
            }
        }
        // Alternating textured and untextured model groups repeatedly restore the same few
        // combiners. Reuse their shader keys without allocating an operand array and string.
        for (const recent of this.recentCombiners) {
            if (recent.values.length !== used) continue;
            let i = 0;
            while (i < used && values[i] === recent.values[i]) i++;
            if (i === used) return recent.key;
        }
        values.length = used;
        const key = values.join(',');
        this.recentCombiners[this.nextCombiner] = { values: values.slice(), key };
        this.nextCombiner = (this.nextCombiner + 1) & 7;
        return key;
    }
}

export class TexGenState {
    mode: number = E.GL_EYE_LINEAR;
    readonly objectPlane: Float32Array;
    readonly eyePlane: Float32Array;

    constructor(coord: number) {
        // GL initial planes: S = (1,0,0,0), T = (0,1,0,0), R = Q = 0. The initial eye planes are not transformed.
        this.objectPlane = vec4(coord === 0 ? 1 : 0, coord === 1 ? 1 : 0, 0, 0);
        this.eyePlane = vec4(coord === 0 ? 1 : 0, coord === 1 ? 1 : 0, 0, 0);
    }
}

// Texture targets a unit binds and enables, in GL's priority order (highest first).
export const TEXTURE_TARGETS = [E.GL_TEXTURE_CUBE_MAP, E.GL_TEXTURE_3D, E.GL_TEXTURE_2D, E.GL_TEXTURE_1D] as const;
export type TextureTarget = (typeof TEXTURE_TARGETS)[number];

export function isTextureTarget(target: number): target is TextureTarget {
    return target === E.GL_TEXTURE_1D || target === E.GL_TEXTURE_2D || target === E.GL_TEXTURE_3D || target === E.GL_TEXTURE_CUBE_MAP;
}

export const TEXGEN_CAPS = [E.GL_TEXTURE_GEN_S, E.GL_TEXTURE_GEN_T, E.GL_TEXTURE_GEN_R, E.GL_TEXTURE_GEN_Q] as const;

class TextureTargetEnables extends Map<TextureTarget, boolean> {
    selected: TextureTarget | 0 = 0;

    constructor() {
        super();
        for (const target of TEXTURE_TARGETS) super.set(target, false);
    }

    override set(target: TextureTarget, enabled: boolean): this {
        if (this.get(target) !== enabled) {
            super.set(target, enabled);
            this.selected = TEXTURE_TARGETS.find(cap => this.get(cap)) ?? 0;
        }
        return this;
    }

    override delete(target: TextureTarget): boolean {
        const deleted = super.delete(target);
        if (target === this.selected) this.selected = TEXTURE_TARGETS.find(cap => this.get(cap)) ?? 0;
        return deleted;
    }

    override clear(): void {
        super.clear();
        this.selected = 0;
    }
}

export class TextureUnitState {
    // Enables of TEXTURE_1D/2D/3D/CUBE_MAP (keyed by target) and TEXTURE_GEN_S/T/R/Q (index 0..3).
    readonly targetEnabled = new TextureTargetEnables();
    readonly genEnabled = [false, false, false, false];
    readonly gen = [new TexGenState(0), new TexGenState(1), new TexGenState(2), new TexGenState(3)];
    readonly env = new TexEnvState();
    // Bound texture name per target (0 is the target's default texture object).
    readonly binding = new Map<TextureTarget, number>(TEXTURE_TARGETS.map(t => [t, 0]));
    readonly matrixStack: Mat4[] = [identity()];
    // Conservative fast path for 2D GL texcoords. Arbitrary matrix operations clear it.
    textureMatrixIsIdentity = true;
    readonly texCoord = vec4(0, 0, 0, 1);
}

export class LightState {
    readonly ambient = vec4(0, 0, 0, 1);
    readonly diffuse: Float32Array;
    readonly specular: Float32Array;
    // Eye-space position: GL transforms POSITION by the modelview current when it is specified.
    readonly position = vec4(0, 0, 1, 0);
    readonly spotDirection = vec4(0, 0, -1, 0);
    spotExponent = 0;
    spotCutoff = 180;
    constantAttenuation = 1;
    linearAttenuation = 0;
    quadraticAttenuation = 0;

    constructor(index: number) {
        this.diffuse = index === 0 ? vec4(1, 1, 1, 1) : vec4(0, 0, 0, 1);
        this.specular = index === 0 ? vec4(1, 1, 1, 1) : vec4(0, 0, 0, 1);
    }
}

export class FogState {
    mode: number = E.GL_EXP;
    density = 1;
    start = 0;
    end = 1;
    index = 0;
    readonly color = vec4(0, 0, 0, 0);

    copyFrom(o: FogState): void {
        this.mode = o.mode;
        this.density = o.density;
        this.start = o.start;
        this.end = o.end;
        this.index = o.index;
        this.color.set(o.color);
    }
}

export class MaterialState {
    readonly ambient = vec4(0.2, 0.2, 0.2, 1);
    readonly diffuse = vec4(0.8, 0.8, 0.8, 1);
    readonly specular = vec4(0, 0, 0, 1);
    readonly emission = vec4(0, 0, 0, 1);
    shininess = 0;
}

// A client array pointer. GL captures the ARRAY_BUFFER binding when the pointer is specified: with a buffer bound, the
// pointer is a byte offset into it; otherwise it addresses client memory (a TS NIO Buffer, read from its position).
export class ArrayPointer {
    enabled = false;
    size = 4;
    type: number = E.GL_FLOAT;
    stride = 0;
    buffer = 0;
    offset = 0;
    client: Buffer | null = null;
    clientPosition = 0;

    set(size: number, type: number, stride: number, buffer: number, offset: number, client: Buffer | null): void {
        this.size = size;
        this.type = type;
        this.stride = stride;
        this.buffer = buffer;
        this.offset = offset;
        this.client = client;
        this.clientPosition = client?.position() ?? 0;
    }
}

// The 8 GL lights. The jar uses LIGHT0, LIGHT1 and LIGHT4..7 (jf addresses them as n + 16388).
export const LIGHT_COUNT = 8;

// Indexed draws read these fixed-function enables together. Update the bit mask when GL
// changes state, including attribute-stack restores, while retaining the original enum map.
export const enum ServerFlag {
    Cull = 1,
    Lighting = 2,
    ColorMaterial = 4,
    Fog = 8,
    Depth = 16,
    Alpha = 32,
    Blend = 64,
    Scissor = 128,
    Light0 = 256,
    VertexProgram = 65536,
    FragmentProgram = 131072
}

const serverFlags = new Map<number, number>([
    [E.GL_CULL_FACE, ServerFlag.Cull],
    [E.GL_LIGHTING, ServerFlag.Lighting],
    [E.GL_COLOR_MATERIAL, ServerFlag.ColorMaterial],
    [E.GL_FOG, ServerFlag.Fog],
    [E.GL_DEPTH_TEST, ServerFlag.Depth],
    [E.GL_ALPHA_TEST, ServerFlag.Alpha],
    [E.GL_BLEND, ServerFlag.Blend],
    [E.GL_SCISSOR_TEST, ServerFlag.Scissor]
]);
for (let i = 0; i < LIGHT_COUNT; i++) serverFlags.set(E.GL_LIGHT0 + i, ServerFlag.Light0 << i);
serverFlags.set(E.GL_VERTEX_PROGRAM_ARB, ServerFlag.VertexProgram);
serverFlags.set(E.GL_FRAGMENT_PROGRAM_ARB, ServerFlag.FragmentProgram);
export const SERVER_CAPS: readonly number[] = [...serverFlags.keys()];

class ServerEnables extends Map<number, boolean> {
    mask = 0;

    constructor() {
        super();
        for (const cap of SERVER_CAPS) super.set(cap, false);
    }

    override set(cap: number, enabled: boolean): this {
        const bit = serverFlags.get(cap) ?? 0;
        this.mask = enabled ? this.mask | bit : this.mask & ~bit;
        return super.set(cap, enabled);
    }

    override delete(cap: number): boolean {
        this.mask &= ~(serverFlags.get(cap) ?? 0);
        return super.delete(cap);
    }

    override clear(): void {
        this.mask = 0;
        super.clear();
    }
}

interface EnableSnapshot {
    readonly server: Map<number, boolean>;
    readonly units: { readonly targets: Map<TextureTarget, boolean>; readonly gen: boolean[] }[];
}

interface AttribEntry {
    readonly mask: number;
    readonly enables: EnableSnapshot | null;
    readonly fogEnabled: boolean | null;
    readonly fog: FogState | null;
}

export const MODELVIEW_STACK_DEPTH = 32;
export const PROJECTION_STACK_DEPTH = 4;
export const TEXTURE_STACK_DEPTH = 10;
export const ATTRIB_STACK_DEPTH = 16;
// ARB_vertex_program: MAX_PROGRAM_LOCAL_PARAMETERS_ARB for vertex programs is at least 96.
export const PROGRAM_LOCAL_PARAMETERS = 96;

export default class GlState {
    // Modelview/projection occupy a contiguous prefix of the indexed shader's uniform block.
    // Texture matrices share the revision used by material, light, fog and other uniforms.
    transformRevision = 0;
    uniformRevision = 0;
    readonly unitCount: number;
    error: number = E.GL_NO_ERROR;

    // Server enables (SERVER_CAPS); texture enables live in the units.
    readonly enabled = new ServerEnables();

    matrixMode: number = E.GL_MODELVIEW;
    readonly modelviewStack: Mat4[] = [identity()];
    private readonly matrixProduct = new Float64Array(16);
    private readonly xRotation = { angle: NaN, cos: 0, sin: 0 };
    private readonly yRotation = { angle: NaN, cos: 0, sin: 0 };
    private readonly inverseSource = new Uint32Array(16);
    private readonly matrixWords = new WeakMap<Mat4, Uint32Array>();
    private inverseModelview: Float64Array | null = null;
    private inverseWork?: Float64Array<ArrayBuffer>;
    private vectorWork?: Float32Array<ArrayBuffer>;
    private readonly freeMatrices: Mat4[] = [];
    readonly projectionStack: Mat4[] = [identity()];

    activeTexture = 0; // unit index (ACTIVE_TEXTURE - TEXTURE0)
    clientActiveTexture = 0;
    readonly units: TextureUnitState[];

    readonly viewport = Int32Array.of(0, 0, 0, 0);
    readonly scissor = Int32Array.of(0, 0, 0, 0);
    readonly clearColor = vec4(0, 0, 0, 0);
    clearDepth = 1;

    depthFunc: number = E.GL_LESS;
    depthMask = true;
    blendSrc: number = E.GL_ONE;
    blendDst: number = E.GL_ZERO;
    alphaFunc: number = E.GL_ALWAYS;
    alphaRef = 0;
    cullFaceMode: number = E.GL_BACK;
    frontFace: number = E.GL_CCW;
    polygonModeFront: number = E.GL_FILL;
    polygonModeBack: number = E.GL_FILL;
    shadeModel: number = E.GL_SMOOTH;
    fogHint: number = E.GL_DONT_CARE;

    readonly fog = new FogState();
    readonly lights: LightState[] = Array.from({ length: LIGHT_COUNT }, (_, i) => new LightState(i));
    readonly lightModelAmbient = vec4(0.2, 0.2, 0.2, 1);
    colorMaterialFace: number = E.GL_FRONT_AND_BACK;
    colorMaterialMode: number = E.GL_AMBIENT_AND_DIFFUSE;
    readonly materialFront = new MaterialState();
    readonly materialBack = new MaterialState();

    readonly currentColor = vec4(1, 1, 1, 1);
    readonly currentNormal = Float32Array.of(0, 0, 1);
    // Current raster position in window coordinates (x, y, z, w) and its valid bit.
    readonly rasterPos = vec4(0, 0, 0, 1);
    rasterPosValid = true;
    pixelZoomX = 1;
    pixelZoomY = 1;

    readonly vertexArray = new ArrayPointer();
    readonly normalArray = new ArrayPointer();
    readonly colorArray = new ArrayPointer();
    readonly texCoordArrays: ArrayPointer[];

    arrayBufferBinding = 0;
    elementArrayBufferBinding = 0;

    drawBuffer: number;
    readBuffer: number;

    // Pixel store, keyed by pname (UNPACK/PACK SWAP_BYTES, LSB_FIRST, ROW_LENGTH, SKIP_ROWS, SKIP_PIXELS, ALIGNMENT).
    readonly pixelStore = new Map<number, number>([
        [E.GL_UNPACK_SWAP_BYTES, 0],
        [E.GL_UNPACK_LSB_FIRST, 0],
        [E.GL_UNPACK_ROW_LENGTH, 0],
        [E.GL_UNPACK_SKIP_ROWS, 0],
        [E.GL_UNPACK_SKIP_PIXELS, 0],
        [E.GL_UNPACK_ALIGNMENT, 4],
        [E.GL_PACK_SWAP_BYTES, 0],
        [E.GL_PACK_LSB_FIRST, 0],
        [E.GL_PACK_ROW_LENGTH, 0],
        [E.GL_PACK_SKIP_ROWS, 0],
        [E.GL_PACK_SKIP_PIXELS, 0],
        [E.GL_PACK_ALIGNMENT, 4]
    ]);

    vertexProgramBinding = 0;

    pointSizeMin = 0;
    pointSizeMax = 1;
    readonly pointDistanceAttenuation = Float32Array.of(1, 0, 0);
    pointFadeThreshold = 1;

    readonly attribStack: AttribEntry[] = [];

    constructor(unitCount: number, doubleBuffered: boolean) {
        this.unitCount = unitCount;
        this.units = Array.from({ length: unitCount }, () => new TextureUnitState());
        this.texCoordArrays = Array.from({ length: unitCount }, () => new ArrayPointer());
        this.drawBuffer = this.readBuffer = doubleBuffered ? E.GL_BACK : E.GL_FRONT;
    }

    // Records a GL error: the first one sticks until read (glGetError semantics).
    setError(code: number): void {
        if (this.error === E.GL_NO_ERROR) this.error = code;
    }

    takeError(): number {
        const e = this.error;
        this.error = E.GL_NO_ERROR;
        return e;
    }

    // GL sets the viewport and scissor box to the window size when the context is first made current.
    initWindowRects(width: number, height: number): void {
        this.uniformRevision++;
        this.viewport.set([0, 0, width, height]);
        this.scissor.set([0, 0, width, height]);
    }

    get unit(): TextureUnitState {
        return this.units[this.activeTexture];
    }

    // ----- enables -------------------------------------------------------------------------------------------

    // Sets an enable. Returns false (and records INVALID_ENUM) for a cap the mirror does not know.
    setEnabled(cap: number, on: boolean): boolean {
        const unit = this.unit;
        if (cap === E.GL_TEXTURE_1D || cap === E.GL_TEXTURE_2D || cap === E.GL_TEXTURE_3D || cap === E.GL_TEXTURE_CUBE_MAP) {
            unit.targetEnabled.set(cap, on);
            return true;
        }
        const gen = TEXGEN_CAPS.indexOf(cap as (typeof TEXGEN_CAPS)[number]);
        if (gen >= 0) {
            unit.genEnabled[gen] = on;
            return true;
        }
        if (!this.enabled.has(cap)) {
            this.setError(E.GL_INVALID_ENUM);
            return false;
        }
        if (cap === E.GL_COLOR_MATERIAL && on) this.uniformRevision++;
        this.enabled.set(cap, on);
        // GL: while COLOR_MATERIAL is enabled the tracked material parameters follow the current colour, starting
        // at the moment it is enabled.
        if (cap === E.GL_COLOR_MATERIAL && on) this.trackColorMaterial();
        return true;
    }

    isEnabled(cap: number): boolean {
        const server = this.enabled.get(cap);
        if (server !== undefined) return server;
        const unit = this.unit;
        if (isTextureTarget(cap)) return unit.targetEnabled.get(cap) === true;
        const gen = TEXGEN_CAPS.indexOf(cap as (typeof TEXGEN_CAPS)[number]);
        if (gen >= 0) return unit.genEnabled[gen];
        return false;
    }

    // The texture target a unit samples, by GL's priority (cube > 3D > 2D > 1D), or 0 when none is enabled. Whether the
    // bound object is complete is the texture table's business (an incomplete texture disables the unit).
    unitTarget(unit: number): TextureTarget | 0 {
        return this.units[unit].targetEnabled.selected;
    }

    // ----- current colour and colour material -----------------------------------------------------------------

    setCurrentColor(r: number, g: number, b: number, a: number): void {
        this.uniformRevision++;
        this.currentColor[0] = r;
        this.currentColor[1] = g;
        this.currentColor[2] = b;
        this.currentColor[3] = a;
        if (this.enabled.get(E.GL_COLOR_MATERIAL) === true) this.trackColorMaterial();
    }

    private trackColorMaterial(): void {
        if (this.colorMaterialFace !== E.GL_BACK) this.applyCurrentColor(this.materialFront);
        if (this.colorMaterialFace !== E.GL_FRONT) this.applyCurrentColor(this.materialBack);
    }

    private applyCurrentColor(material: MaterialState): void {
        const mode = this.colorMaterialMode;
        if (mode === E.GL_AMBIENT || mode === E.GL_AMBIENT_AND_DIFFUSE) material.ambient.set(this.currentColor);
        if (mode === E.GL_DIFFUSE || mode === E.GL_AMBIENT_AND_DIFFUSE) material.diffuse.set(this.currentColor);
        if (mode === E.GL_SPECULAR) material.specular.set(this.currentColor);
        if (mode === E.GL_EMISSION) material.emission.set(this.currentColor);
    }

    setColorMaterial(face: number, mode: number): void {
        this.uniformRevision++;
        this.colorMaterialFace = face;
        this.colorMaterialMode = mode;
        if (this.enabled.get(E.GL_COLOR_MATERIAL) === true) this.trackColorMaterial();
    }

    // ----- matrices --------------------------------------------------------------------------------------------

    // The stack MatrixMode selects (TEXTURE: the active unit's stack).
    get currentStack(): Mat4[] {
        if (this.matrixMode === E.GL_PROJECTION) return this.projectionStack;
        if (this.matrixMode === E.GL_TEXTURE) return this.unit.matrixStack;
        return this.modelviewStack;
    }

    private get stackDepthLimit(): number {
        if (this.matrixMode === E.GL_PROJECTION) return PROJECTION_STACK_DEPTH;
        if (this.matrixMode === E.GL_TEXTURE) return TEXTURE_STACK_DEPTH;
        return MODELVIEW_STACK_DEPTH;
    }

    get current(): Mat4 {
        const s = this.currentStack;
        return s[s.length - 1];
    }

    get modelview(): Mat4 {
        return this.modelviewStack[this.modelviewStack.length - 1];
    }

    modelviewInverse(): Float64Array | null {
        const m = this.modelview;
        // Matrices are mutable through the stack and the modelview getter. Compare
        // their binary32 words so direct writes, including the sign of zero, are visible.
        let words = this.matrixWords.get(m);
        if (!words) {
            words = new Uint32Array(m.buffer, m.byteOffset, m.length);
            this.matrixWords.set(m, words);
        }
        for (let i = 0; i < 16; i++) {
            if (this.inverseSource[i] !== words[i]) {
                this.inverseSource.set(words);
                this.inverseModelview = invert(m, (this.inverseWork ??= new Float64Array(16)));
                break;
            }
        }
        return this.inverseModelview;
    }

    get projection(): Mat4 {
        return this.projectionStack[this.projectionStack.length - 1];
    }

    textureMatrix(unit: number): Mat4 {
        const s = this.units[unit].matrixStack;
        return s[s.length - 1];
    }

    setMatrixMode(mode: number): void {
        this.matrixMode = mode;
    }

    private matrixChanged(): void {
        if (this.matrixMode === E.GL_TEXTURE) {
            this.unit.textureMatrixIsIdentity = false;
            this.uniformRevision++;
        } else this.transformRevision++;
    }

    loadIdentity(): void {
        this.matrixChanged();
        const m = this.current;
        m.fill(0);
        m[0] = m[5] = m[10] = m[15] = 1;
        if (this.matrixMode === E.GL_TEXTURE) this.unit.textureMatrixIsIdentity = true;
    }

    // m is copied as raw bits.
    loadMatrix(m: Float32Array, offset: number): void {
        this.matrixChanged();
        copyFloatBits(this.current, m, offset, 16);
    }

    multMatrix(m: ArrayLike<number>): void {
        this.matrixChanged();
        multiply(this.current, this.current, m, this.matrixProduct);
    }

    translate(x: number, y: number, z: number): void {
        this.matrixChanged();
        const m = this.current;
        x = Math.fround(x);
        y = Math.fround(y);
        z = Math.fround(z);
        if (!Number.isFinite(x + y + z) || !finiteMatrix(m)) {
            const t = identity();
            t[12] = x;
            t[13] = y;
            t[14] = z;
            this.multMatrix(t);
            return;
        }
        for (let row = 0; row < 4; row++) {
            const a = m[row],
                b = m[4 + row],
                c = m[8 + row],
                d = m[12 + row];
            // The original dot product starts at positive zero, including for unaffected columns.
            m[row] = 0 + a;
            m[4 + row] = 0 + b;
            m[8 + row] = 0 + c;
            m[12 + row] = 0 + a * x + b * y + c * z + d;
        }
    }

    scale(x: number, y: number, z: number): void {
        this.matrixChanged();
        const m = this.current;
        if (!Number.isFinite(x + y + z) || !finiteMatrix(m)) {
            const scale = new Float64Array(16);
            scale[0] = x;
            scale[5] = y;
            scale[10] = z;
            scale[15] = 1;
            this.multMatrix(scale);
            return;
        }
        for (let row = 0; row < 4; row++) {
            const a = m[row],
                b = m[4 + row],
                c = m[8 + row],
                d = m[12 + row];
            m[row] = 0 + a * x;
            m[4 + row] = 0 + b * y;
            m[8 + row] = 0 + c * z;
            m[12 + row] = 0 + d;
        }
    }

    // glRotate: angle in degrees about (x, y, z), normalised; a zero axis leaves the matrix unchanged.
    rotate(angle: number, x: number, y: number, z: number): void {
        this.matrixChanged();
        const m = this.current;
        // The camera rotates around +X and +Y. For finite inputs the zero terms
        // contribute nothing after the dot product's initial +0. The fixed axis
        // retains (1 - cos) + cos because it can round differently from 1.
        if (z === 0 && ((x === 1 && y === 0) || (x === 0 && y === 1)) && Number.isFinite(angle * Math.PI) && finiteMatrix(m)) {
            const xAxis = x === 1;
            const cached = xAxis ? this.xRotation : this.yRotation;
            let cos: number;
            let sin: number;
            if (angle === 180) {
                cos = -1;
                sin = Math.sin(Math.PI);
            } else {
                if (!Object.is(angle, cached.angle)) {
                    const rad = (angle * Math.PI) / 180;
                    cached.angle = angle;
                    cached.cos = Math.cos(rad);
                    cached.sin = Math.sin(rad);
                }
                cos = cached.cos;
                sin = cached.sin;
            }
            const diagonal = 1 - cos + cos;
            const rotated = xAxis ? 4 : 0;
            const fixed = xAxis ? 0 : 4;
            const s = xAxis ? sin : -sin;
            for (let row = 0; row < 4; row++) {
                const a = m[rotated + row],
                    b = m[8 + row];
                m[fixed + row] = 0 + m[fixed + row] * diagonal;
                m[rotated + row] = 0 + a * cos + b * s;
                m[8 + row] = 0 + a * -s + b * cos;
                m[12 + row] = 0 + m[12 + row];
            }
            return;
        }
        const len = Math.sqrt(x * x + y * y + z * z);
        if (len === 0) return;
        x /= len;
        y /= len;
        z /= len;
        const rad = (angle * Math.PI) / 180;
        const cos = Math.cos(rad),
            sin = Math.sin(rad),
            t = 1 - cos;
        const xx = x * x * t + cos,
            yx = y * x * t + z * sin,
            zx = x * z * t - y * sin;
        const xy = x * y * t - z * sin,
            yy = y * y * t + cos,
            zy = y * z * t + x * sin;
        const xz = x * z * t + y * sin,
            yz = y * z * t - x * sin,
            zz = z * z * t + cos;
        if (!Number.isFinite(x + y + z + cos) || !finiteMatrix(m)) {
            const rotation = Float64Array.of(xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0, 0, 0, 0, 1);
            this.multMatrix(rotation);
            return;
        }
        for (let row = 0; row < 4; row++) {
            const a = m[row],
                b = m[4 + row],
                c = m[8 + row],
                d = m[12 + row];
            m[row] = 0 + a * xx + b * yx + c * zx;
            m[4 + row] = 0 + a * xy + b * yy + c * zy;
            m[8 + row] = 0 + a * xz + b * yz + c * zz;
            m[12 + row] = 0 + d;
        }
    }

    ortho(l: number, r: number, b: number, t: number, n: number, f: number): void {
        if (l === r || b === t || n === f) {
            this.setError(E.GL_INVALID_VALUE);
            return;
        }
        const o = new Float64Array(16);
        o[0] = 2 / (r - l);
        o[5] = 2 / (t - b);
        o[10] = -2 / (f - n);
        o[12] = -(r + l) / (r - l);
        o[13] = -(t + b) / (t - b);
        o[14] = -(f + n) / (f - n);
        o[15] = 1;
        this.multMatrix(o);
    }

    pushMatrix(): void {
        const s = this.currentStack;
        if (s.length >= this.stackDepthLimit) {
            this.setError(E.GL_STACK_OVERFLOW);
            return;
        }
        const next = this.freeMatrices.pop() ?? new Float32Array(16);
        next.set(s[s.length - 1]);
        s.push(next);
    }

    popMatrix(): void {
        this.matrixChanged();
        const s = this.currentStack;
        if (s.length <= 1) {
            this.setError(E.GL_STACK_UNDERFLOW);
            return;
        }
        this.freeMatrices.push(s[s.length - 1]);
        s.pop();
    }

    // ----- texgen and lights: transformed into eye space when specified -------------------------------------------

    // OBJECT_PLANE is stored as given. EYE_PLANE p is stored as p * M^-1, M the modelview current now (GL 2.1 2.12.3);
    // a singular modelview stores p unchanged (GL leaves the result undefined).
    setTexGenPlane(coord: number, pname: number, params: Float32Array, offset: number): void {
        this.uniformRevision++;
        const g = this.unit.gen[coord];
        if (pname === E.GL_OBJECT_PLANE) {
            copyFloatBits(g.objectPlane, params, offset, 4);
            return;
        }
        let p = params;
        if (offset !== 0 || params.length !== 4) {
            p = this.vectorWork ??= new Float32Array(4);
            copyFloatBits(p, params, offset, 4);
        }
        const inv = this.modelviewInverse();
        if (inv === null) {
            g.eyePlane.set(p);
            return;
        }
        // Read all four coefficients before writing. The supplied plane may alias the destination.
        const x = p[0],
            y = p[1],
            z = p[2],
            w = p[3];
        for (let j = 0; j < 4; j++) g.eyePlane[j] = x * inv[j * 4] + y * inv[j * 4 + 1] + z * inv[j * 4 + 2] + w * inv[j * 4 + 3];
    }

    // POSITION is transformed by the current modelview; AMBIENT and DIFFUSE are stored as given (light colours are
    // not clamped: LIGHT1's diffuse is negative).
    setLightVector(light: number, pname: number, params: Float32Array, offset: number): void {
        this.uniformRevision++;
        const l = this.lights[light];
        if (pname === E.GL_POSITION) {
            const p = (this.vectorWork ??= new Float32Array(4));
            copyFloatBits(p, params, offset, 4);
            transformPoint(this.modelview, p, l.position);
        } else if (pname === E.GL_AMBIENT) {
            copyFloatBits(l.ambient, params, offset, 4);
        } else if (pname === E.GL_DIFFUSE) {
            copyFloatBits(l.diffuse, params, offset, 4);
        } else if (pname === E.GL_SPECULAR) {
            copyFloatBits(l.specular, params, offset, 4);
        }
    }

    setLightScalar(light: number, pname: number, value: number): void {
        this.uniformRevision++;
        const l = this.lights[light];
        if (value < 0) {
            this.setError(E.GL_INVALID_VALUE);
            return;
        }
        if (pname === E.GL_CONSTANT_ATTENUATION) l.constantAttenuation = value;
        else if (pname === E.GL_LINEAR_ATTENUATION) l.linearAttenuation = value;
        else if (pname === E.GL_QUADRATIC_ATTENUATION) l.quadraticAttenuation = value;
    }

    // LIGHT_MODEL_AMBIENT is not clamped. Copied as raw bits: glGetFloatv reads it back bit for bit.
    setLightModelAmbient(params: Float32Array, offset: number): void {
        this.uniformRevision++;
        copyFloatBits(this.lightModelAmbient, params, offset, 4);
    }

    // ----- fog ------------------------------------------------------------------------------------------------

    setFogScalar(pname: number, value: number): void {
        this.uniformRevision++;
        if (pname === E.GL_FOG_MODE) {
            this.fog.mode = value;
        } else if (pname === E.GL_FOG_DENSITY) {
            if (value < 0) {
                this.setError(E.GL_INVALID_VALUE);
                return;
            }
            this.fog.density = value;
        } else if (pname === E.GL_FOG_START) {
            this.fog.start = value;
        } else if (pname === E.GL_FOG_END) {
            this.fog.end = value;
        }
    }

    // FOG_COLOR is clamped to [0, 1] when specified.
    setFogColor(params: Float32Array, offset: number): void {
        this.uniformRevision++;
        const c = this.fog.color;
        copyFloatBits(c, params, offset, 4);
        for (let i = 0; i < 4; i++) c[i] = clamp01(c[i]);
    }

    // ----- texture environment ----------------------------------------------------------------------------------

    setTexEnvEnum(pname: number, value: number): void {
        const env = this.unit.env;
        env.invalidateShaderKey();
        switch (pname) {
            case E.GL_TEXTURE_ENV_MODE:
                env.mode = value;
                return;
            case E.GL_COMBINE_RGB:
                env.combineRgb = value;
                return;
            case E.GL_COMBINE_ALPHA:
                env.combineAlpha = value;
                return;
            case E.GL_SOURCE0_RGB:
                env.sourceRgb[0] = value;
                return;
            case E.GL_SOURCE1_RGB:
                env.sourceRgb[1] = value;
                return;
            case E.GL_SOURCE2_RGB:
                env.sourceRgb[2] = value;
                return;
            case E.GL_SOURCE0_ALPHA:
                env.sourceAlpha[0] = value;
                return;
            case E.GL_SOURCE1_ALPHA:
                env.sourceAlpha[1] = value;
                return;
            case E.GL_SOURCE2_ALPHA:
                env.sourceAlpha[2] = value;
                return;
            case E.GL_OPERAND0_RGB:
                env.operandRgb[0] = value;
                return;
            case E.GL_OPERAND1_RGB:
                env.operandRgb[1] = value;
                return;
            case E.GL_OPERAND2_RGB:
                env.operandRgb[2] = value;
                return;
            case E.GL_OPERAND0_ALPHA:
                env.operandAlpha[0] = value;
                return;
            case E.GL_OPERAND1_ALPHA:
                env.operandAlpha[1] = value;
                return;
            case E.GL_OPERAND2_ALPHA:
                env.operandAlpha[2] = value;
                return;
            case E.GL_RGB_SCALE:
                this.setTexEnvScale(pname, value);
                return;
            case E.GL_ALPHA_SCALE:
                this.setTexEnvScale(pname, value);
                return;
            default:
                this.setError(E.GL_INVALID_ENUM);
        }
    }

    // RGB_SCALE and ALPHA_SCALE accept 1, 2 or 4.
    setTexEnvScale(pname: number, value: number): void {
        if (value !== 1 && value !== 2 && value !== 4) {
            this.setError(E.GL_INVALID_VALUE);
            return;
        }
        if (pname === E.GL_RGB_SCALE) this.unit.env.rgbScale = value;
        else this.unit.env.alphaScale = value;
        this.unit.env.invalidateShaderKey();
    }

    // TEXTURE_ENV_COLOR is clamped to [0, 1] when specified.
    setTexEnvColor(params: Float32Array, offset: number): void {
        this.uniformRevision++;
        const c = this.unit.env.color;
        copyFloatBits(c, params, offset, 4);
        for (let i = 0; i < 4; i++) c[i] = clamp01(c[i]);
        this.unit.env.invalidateShaderKey(true);
    }

    // ----- raster position ----------------------------------------------------------------------------------------

    // glRasterPos: object (x, y, z, w) through the modelview and projection, clipped as a point, then to window
    // coordinates by the viewport and the depth range [0, 1]. A clipped point invalidates the raster position.
    setRasterPos(x: number, y: number, z: number, w: number): void {
        const eye = transformPoint(this.modelview, [x, y, z, w]);
        const clip = transformPoint(this.projection, eye);
        const cw = clip[3];
        if (!(Math.abs(clip[0]) <= cw && Math.abs(clip[1]) <= cw && Math.abs(clip[2]) <= cw) || cw <= 0) {
            this.rasterPosValid = false;
            return;
        }
        const [vx, vy, vw, vh] = this.viewport;
        this.rasterPos[0] = vx + ((clip[0] / cw + 1) * vw) / 2;
        this.rasterPos[1] = vy + ((clip[1] / cw + 1) * vh) / 2;
        this.rasterPos[2] = (clip[2] / cw + 1) / 2;
        this.rasterPos[3] = cw;
        this.rasterPosValid = true;
    }

    // ----- attrib stack (ENABLE_BIT and FOG_BIT, the only groups the jar pushes) -----------------------------------

    pushAttrib(mask: number): void {
        if (this.attribStack.length >= ATTRIB_STACK_DEPTH) {
            this.setError(E.GL_STACK_OVERFLOW);
            return;
        }
        let enables: EnableSnapshot | null = null;
        let fog: FogState | null = null;
        let fogEnabled: boolean | null = null;
        if ((mask & E.GL_ENABLE_BIT) !== 0) {
            enables = {
                server: new Map(this.enabled),
                units: this.units.map(u => ({ targets: new Map(u.targetEnabled), gen: [...u.genEnabled] }))
            };
        }
        if ((mask & E.GL_FOG_BIT) !== 0) {
            fog = new FogState();
            fog.copyFrom(this.fog);
            fogEnabled = this.enabled.get(E.GL_FOG) === true;
        }
        this.attribStack.push({ mask, enables, fogEnabled, fog });
    }

    // Restores the groups the matching push saved. ENABLE_BIT before FOG_BIT, so a FOG_BIT push nested in the same
    // entry wins for FOG (both save the same value, so the order is not observable).
    popAttrib(): void {
        this.uniformRevision++;
        const entry = this.attribStack.pop();
        if (entry === undefined) {
            this.setError(E.GL_STACK_UNDERFLOW);
            return;
        }
        if (entry.enables !== null) {
            for (const [cap, on] of entry.enables.server) this.enabled.set(cap, on);
            entry.enables.units.forEach((saved, i) => {
                const u = this.units[i];
                for (const [t, on] of saved.targets) u.targetEnabled.set(t, on);
                for (let k = 0; k < 4; k++) u.genEnabled[k] = saved.gen[k];
            });
        }
        if (entry.fog !== null && entry.fogEnabled !== null) {
            this.fog.copyFrom(entry.fog);
            this.enabled.set(E.GL_FOG, entry.fogEnabled);
        }
    }
}
