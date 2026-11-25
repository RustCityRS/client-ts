import type Buffer from '#/util/nio/Buffer';
import FloatBuffer from '#/util/nio/FloatBuffer';
import { bufferByteView } from '#/util/nio/BufferBytes';
import { arrayPutF32, arrayPutI32, requireNonNull } from '#/util/JavaArray';
import GLException from '#/jogl/GLException';
import type { GL, GLbitfield, GLboolean, GLclampd, GLclampf, GLdouble, GLenum, GLfloat, GLint, GLintptrARB, GLsizei, GLsizeiptrARB, GLubyte, GLuint } from '#/jogl/GL';
import { type CapsProfile, profileHasExtension, validateCapsProfile } from '#/gl/CapsProfile';
import { bitsToFloat, javaUtf8Bytes, sha256Hex } from '#/gl/GlTrace';
import { BufferObject, StaticBufferStores } from './BufferObject';
import ImmediateRenderer from './ImmediateRenderer';
import IndexedRenderer from './IndexedRenderer';
import { GLX as E, GlUnsupported, notYet } from './GlEnums';
import GlState, { type ArrayPointer, copyFloatBits, isTextureTarget, PROGRAM_LOCAL_PARAMETERS, type TextureTarget } from './GlState';
import type GpuDevice from './GpuDevice';
import { glBoxToRect } from './SurfaceTargets';
import type SurfaceTargets from './SurfaceTargets';
import { transferPixels } from './PixelTransfer';
import { baseFormat, componentCount, convertPixels, cubeFaceIndex, isCubeFace, type LevelImage, TextureObject, unpackImage } from './TextureObject';

// WebGpuGL: the GL 1.3 fixed-function "driver" under the ported HD client (HD_PLAN 1.2, 2.2-2.5). It implements the
// JOGL GL interface of src/jogl/GL.ts on WebGPU and corresponds to no Java class; it plays the OpenGL driver's
// role. It never makes a draw decision of its own: it executes exactly the calls it receives.
//
// Driver v1 (HD batch H1) covers what H1's context start exercises:
// - Everything Java can observe is answered exactly as NullGL (GLTRACE.md section 16) answers it, so
//   RecordingGL(WebGpuGL) records the same trace as RecordingGL(NullGL): the JOGL GLImpl argument checks in GLImpl's
//   order, missing entry points from the CapsProfile, names 1, 2, 3, ... per kind (never reused), the profile's
//   strings, integers, floats and extensions, the proxy rule, and the four read-back states (DRAW_BUFFER,
//   READ_BUFFER, LIGHT_MODEL_AMBIENT, PROGRAM_ERROR_POSITION_ARB = -1). The pixel-store pnames answer from the
//   mirror, which starts at the profile's values (JOGL's GLU restores what it changes, so the answers agree).
// - The full state mirror (GlState), texture objects (TextureObject), buffer objects (BufferObject), display lists
//   (compiled commands replayed through the same execution paths; RecordingGL logs only glCallList), ARB program
//   objects (only the shipped water program literal, checked by SHA-256) with local parameters, glClear (a loadOp
//   when unscissored, else a clear quad honouring scissor and DepthMask) and, in WebGpuDrawable, swapBuffers.
// - Immediate mode replays display lists through the current matrices, colour, texture units and draw state.
//   ImmediateRenderer submits the resulting triangles and lines to the drawable's WebGPU colour and depth targets.
//   Indexed model/terrain geometry enters through glDrawElements.
// - Any enum value outside the jar's inventory throws GlUnsupported at the call (a port slip fails loudly). GL errors
//   proper (INVALID_VALUE, stack over/underflow, ...) behave as GL: the command is ignored and glGetError() reports it.
//
// A WebGpuGL made with no host keeps CPU state; framebuffer operations require the buffers supplied by a drawable.

export interface WebGpuGLHost {
    readonly gpu: GpuDevice;
    // The drawable's buffers at the surface's current size (allocated on first use).
    targets(): SurfaceTargets;
    front(): GPUTexture;
    // The colour buffer's alpha bits (0 for the jar's drawables: alpha reads as 1).
    readonly alphaBits: number;
}

// sha256 of the UTF-8 bytes of the jar's only ARB program string (rd.f()V, 1,736 bytes; out/530-hd-vertex-program.arb).
export const WATER_PROGRAM_SHA256 = '05b4a0e72fd47dddd64ec397b735a871b1510d8c0cd0693189495d18f6a553ce';

type Command = () => void;

export class ProgramObject {
    readonly name: number;
    source: string | null = null;
    readonly local = new Float32Array(PROGRAM_LOCAL_PARAMETERS * 4);

    constructor(name: number) {
        this.name = name;
    }
}

const MAX_LIST_NESTING = 64;
const VERTEX_POINTER_SIZES = [2, 3, 4] as const;
const COLOR_POINTER_SIZES = [3, 4] as const;
const NORMAL_POINTER_SIZES = [3] as const;
const TEXCOORD_POINTER_SIZES = [1, 2, 3, 4] as const;
const FLOAT_POINTER_TYPES = [E.GL_FLOAT] as const;
const COLOR_POINTER_TYPES = [E.GL_UNSIGNED_BYTE, E.GL_FLOAT] as const;

const PROXY_TEXTURE_1D = E.GL_PROXY_TEXTURE_1D;
const PROXY_TEXTURE_2D = E.GL_PROXY_TEXTURE_2D;
const PROXY_TEXTURE_3D = E.GL_PROXY_TEXTURE_3D;
const PROXY_TEXTURE_CUBE_MAP = E.GL_PROXY_TEXTURE_CUBE_MAP;

const INVENTORY_LIGHTS = new Set<number>([0, 1, 4, 5, 6, 7]);
const COMPARE_FUNCS = new Set<number>([E.GL_NEVER, E.GL_LESS, E.GL_EQUAL, E.GL_LEQUAL, E.GL_GREATER, E.GL_NOTEQUAL, E.GL_GEQUAL, E.GL_ALWAYS]);
const BLEND_SRC = new Set<number>([E.GL_ZERO, E.GL_ONE, E.GL_SRC_COLOR, E.GL_ONE_MINUS_SRC_COLOR, E.GL_DST_COLOR, E.GL_ONE_MINUS_DST_COLOR, E.GL_SRC_ALPHA, E.GL_ONE_MINUS_SRC_ALPHA, E.GL_DST_ALPHA, E.GL_ONE_MINUS_DST_ALPHA, E.GL_SRC_ALPHA_SATURATE]);
const BLEND_DST = new Set<number>([...BLEND_SRC].filter(f => f !== E.GL_SRC_ALPHA_SATURATE));
const COMBINE_MODES = new Set<number>([E.GL_REPLACE, E.GL_MODULATE, E.GL_ADD, E.GL_ADD_SIGNED, E.GL_INTERPOLATE, E.GL_SUBTRACT]);
const COMBINE_SOURCES = new Set<number>([E.GL_TEXTURE, E.GL_CONSTANT, E.GL_PRIMARY_COLOR, E.GL_PREVIOUS]);
const RGB_OPERANDS = new Set<number>([E.GL_SRC_COLOR, E.GL_ONE_MINUS_SRC_COLOR, E.GL_SRC_ALPHA, E.GL_ONE_MINUS_SRC_ALPHA]);
const ALPHA_OPERANDS = new Set<number>([E.GL_SRC_ALPHA, E.GL_ONE_MINUS_SRC_ALPHA]);
const MIN_FILTERS = new Set<number>([E.GL_NEAREST, E.GL_LINEAR, E.GL_NEAREST_MIPMAP_NEAREST, E.GL_LINEAR_MIPMAP_NEAREST, E.GL_NEAREST_MIPMAP_LINEAR, E.GL_LINEAR_MIPMAP_LINEAR]);
const PIXEL_STORE = new Set<number>([
    E.GL_UNPACK_SWAP_BYTES,
    E.GL_UNPACK_LSB_FIRST,
    E.GL_UNPACK_ROW_LENGTH,
    E.GL_UNPACK_SKIP_ROWS,
    E.GL_UNPACK_SKIP_PIXELS,
    E.GL_UNPACK_ALIGNMENT,
    E.GL_PACK_SWAP_BYTES,
    E.GL_PACK_LSB_FIRST,
    E.GL_PACK_ROW_LENGTH,
    E.GL_PACK_SKIP_ROWS,
    E.GL_PACK_SKIP_PIXELS,
    E.GL_PACK_ALIGNMENT
]);

function clamp01(v: number): number {
    return v < 0 ? 0 : v > 1 ? 1 : v;
}

function unsupported(what: string, value: number): GlUnsupported {
    return new GlUnsupported(what + ' ' + value + " is outside the jar's inventory");
}

// The array-offset check every array overload of com.sun.opengl.impl.GLImpl makes before its native call (NullGL
// has the same function; GLTRACE.md section 16 item 2).
function checkArrayOffset(array: Int32Array | Float32Array | null, offset: number, name: string): void {
    if (array !== null && array.length <= offset) {
        throw new GLException('array offset argument "' + name + '" (' + offset + ') equals or exceeds array length (' + array.length + ')');
    }
}

// com.sun.gluegen.runtime.BufferFactory.rangeCheck([III)V (GLTRACE.md section 16 item 1).
function rangeCheck(array: Int32Array | null, offset: number, minElementsRemaining: number): void {
    if (array === null) return;
    if (array.length < ((offset + minElementsRemaining) | 0)) {
        throw new RangeError('Required ' + minElementsRemaining + ' elements in array, only had ' + ((array.length - offset) | 0));
    }
}

// The bytes GL reads through a client Buffer argument: the storage from the buffer's position to its capacity (JOGL
// passes the address at the position; the native code reads as much as the command needs, past the limit if so).
function clientBytes(buffer: Buffer): Uint8Array {
    return bufferByteView(buffer, buffer.position(), buffer.capacity());
}

export default class WebGpuGL implements GL {
    readonly profile: CapsProfile;
    readonly state: GlState;
    private host: WebGpuGLHost | null;
    // BufferObject calls this synchronously when renaming the currently attached device's VBO.
    private readonly retireBuffer = (buffer: GPUBuffer): void => this.requireHost().gpu.retire(buffer);

    private nextTexture = 1;
    private nextBuffer = 1;
    private nextProgram = 1;
    private readonly programLocalScratch = new Float32Array(4);
    private readonly programLocalBytes = new Uint8Array(this.programLocalScratch.buffer);
    private nextList = 1;
    readonly textures = new Map<number, TextureObject>();
    private readonly defaultTextures = new Map<TextureTarget, TextureObject>();
    readonly buffers = new Map<number, BufferObject>();
    private readonly staticStores = new StaticBufferStores();
    readonly programs = new Map<number, ProgramObject>();
    readonly lists = new Map<number, Command[]>();
    private compiling: { readonly name: number; readonly commands: Command[] } | null = null;
    private callDepth = 0;
    private immediate = new ImmediateRenderer();
    private indexed = new IndexedRenderer();
    private readonly proxyImages = new Map<number, Map<number, readonly [number, number, number]>>();
    // setSwapInterval is recorded and has no effect (the browser paces frames).
    swapInterval = 0;
    // glClear calls executed (diagnostics).
    clears = 0;

    constructor(profile: CapsProfile, doubleBuffered: boolean = true, host: WebGpuGLHost | null = null) {
        validateCapsProfile(profile);
        this.profile = profile;
        const units = profile.integers[String(E.GL_MAX_TEXTURE_UNITS)];
        const unitCount = units === undefined || units.length === 0 ? 4 : Math.max(1, Math.min(8, units[0]));
        this.state = new GlState(unitCount, doubleBuffered);
        this.host = host;
        for (const pname of PIXEL_STORE) {
            const v = profile.integers[String(pname)];
            if (v !== undefined && v.length > 0) this.state.pixelStore.set(pname, v[0]);
        }
        const pointMax = profile.floats[String(E.GL_POINT_SIZE_MAX)];
        if (pointMax !== undefined && pointMax.length > 0) this.state.pointSizeMax = bitsToFloat(parseInt(pointMax[0], 16) >>> 0);
        for (const t of [E.GL_TEXTURE_1D, E.GL_TEXTURE_2D, E.GL_TEXTURE_3D, E.GL_TEXTURE_CUBE_MAP] as const) this.defaultTextures.set(t, new TextureObject(0, t));
    }

    // Host only: binds the GL to a drawable's buffers (WebGpuContext does this when it is first made current).
    attach(host: WebGpuGLHost): void {
        this.host = host;
    }

    prewarmIndexedPipelines(sampleCount: number): Promise<void> {
        const host = this.requireHost();
        return this.indexed.prewarm(host.gpu, sampleCount, host.alphaBits);
    }

    private requireHost(): WebGpuGLHost {
        if (this.host === null) throw new Error('WebGpuGL: no drawable (this GL was made without a host)');
        return this.host;
    }

    // Not in the shipped interface: the sticky GL error, cleared by reading it (NullGL always answers 0).
    glGetError(): number {
        return this.state.takeError();
    }

    // com.sun.opengl.impl.GLImpl: `if (__addr_ == 0) throw new GLException("Method \"<name>\" not available")`
    private checkAvailable(name: string): void {
        if (this.profile.missingEntryPoints.includes(name)) throw new GLException('Method "' + name + '" not available');
    }

    // Runs a server command now, or appends it to the display list being compiled.
    private emit(command: Command): void {
        if (this.compiling !== null) this.compiling.commands.push(command);
        else command();
    }

    private get compilingList(): boolean {
        return this.compiling !== null;
    }

    // A display list retains its argument. An ordinary GL call consumes it synchronously.
    private floatArgument(src: Float32Array, offset: number, count: number): Float32Array {
        if (!this.compilingList && offset === 0 && src.length === count) return src;
        const out = new Float32Array(count);
        copyFloatBits(out, src, offset, count);
        return out;
    }

    // ----- objects -------------------------------------------------------------------------------------------------

    // The texture object bound to `target` on the active unit (name 0: the target's default object).
    boundTexture(target: TextureTarget, unit: number = this.state.activeTexture): TextureObject {
        const name = this.state.units[unit].binding.get(target) ?? 0;
        if (name === 0) return requireNonNull(this.defaultTextures.get(target));
        return requireNonNull(this.textures.get(name));
    }

    // The texture a unit samples: the bound object of its highest-priority enabled target, or null when no target is
    // enabled or that object is incomplete (GL: an incomplete texture disables the unit; there is no fallback to a
    // lower-priority target).
    effectiveTexture(unit: number): TextureObject | null {
        const target = this.state.unitTarget(unit);
        if (target === 0) return null;
        const t = this.boundTexture(target, unit);
        return t.isComplete() ? t : null;
    }

    // The GPU texture of a complete texture object (draw time; tests call it directly).
    realizeTexture(texture: TextureObject): GPUTexture {
        return texture.realize(this.requireHost().gpu);
    }

    // The GPU copy of a buffer object, marked as used by the current submission (draw time; tests call it directly).
    realizeBuffer(buffer: BufferObject): GPUBuffer {
        const gpu = this.requireHost().gpu;
        return buffer.realize(gpu.device, gpu.epoch, this.retireBuffer);
    }

    private boundBuffer(target: number): BufferObject | null {
        const name = target === E.GL_ARRAY_BUFFER ? this.state.arrayBufferBinding : this.state.elementArrayBufferBinding;
        return name === 0 ? null : (this.buffers.get(name) ?? null);
    }

    private boundProgram(): ProgramObject {
        const name = this.state.vertexProgramBinding;
        let p = this.programs.get(name);
        if (p === undefined) {
            p = new ProgramObject(name);
            this.programs.set(name, p);
        }
        return p;
    }

    // Disposes every GPU resource (context destroy). CPU state stays readable.
    dispose(): void {
        const host = this.host;
        this.immediate.dispose(host?.gpu);
        this.indexed.dispose(host?.gpu);
        host?.gpu.releaseUploadPages();
        const retire = (r: GPUTexture | GPUBuffer) => {
            if (host !== null) host.gpu.retire(r);
            else r.destroy();
        };
        for (const t of this.textures.values()) t.destroy(retire);
        for (const t of this.defaultTextures.values()) t.destroy(retire);
        for (const b of this.buffers.values()) b.destroy(retire);
        host?.gpu.flushRetired();
    }

    // ----- proxy rule (identical to NullGL; GLTRACE.md section 16) ---------------------------------------------------

    private maxSize(pname: number): number {
        const values = this.profile.integers[String(pname)] ?? this.profile.integers['3379'];
        return values === undefined || values.length === 0 ? 0 : values[0];
    }

    private proxyImage(target: number, level: number, border: number, width: number, height: number, depth: number): boolean {
        let dims: number;
        let max: number;
        if (target === PROXY_TEXTURE_1D) {
            dims = 1;
            max = this.maxSize(E.GL_MAX_TEXTURE_SIZE);
        } else if (target === PROXY_TEXTURE_2D) {
            dims = 2;
            max = this.maxSize(E.GL_MAX_TEXTURE_SIZE);
        } else if (target === PROXY_TEXTURE_CUBE_MAP) {
            dims = 2;
            max = this.maxSize(E.GL_MAX_CUBE_MAP_TEXTURE_SIZE);
        } else if (target === PROXY_TEXTURE_3D) {
            dims = 3;
            max = this.maxSize(E.GL_MAX_3D_TEXTURE_SIZE);
        } else {
            return false;
        }
        const size = [width, height, depth].slice(0, dims);
        const fits = (d: number) => d >= 0 && d * 2 ** level <= max;
        const supported = border === 0 && level >= 0 && size.every(fits) && (target !== PROXY_TEXTURE_CUBE_MAP || width === height);
        let levels = this.proxyImages.get(target);
        if (levels === undefined) {
            levels = new Map();
            this.proxyImages.set(target, levels);
        }
        levels.set(level, supported ? [width, dims >= 2 ? height : 1, dims >= 3 ? depth : 1] : [0, 0, 0]);
        return true;
    }

    private proxyQuery(target: number, level: number, pname: number): number {
        const image = this.proxyImages.get(target)?.get(level);
        if (image === undefined) return 0;
        if (pname === E.GL_TEXTURE_WIDTH) return image[0];
        if (pname === E.GL_TEXTURE_HEIGHT) return image[1];
        if (pname === E.GL_TEXTURE_DEPTH) return image[2];
        return 0;
    }

    // ----- validation helpers ---------------------------------------------------------------------------------------

    private unitOf(texture: number, what: string): number {
        const unit = texture - E.GL_TEXTURE0;
        if (unit < 0 || unit >= 32) throw unsupported(what, texture);
        return unit;
    }

    private lightIndex(light: number): number {
        const i = light - E.GL_LIGHT0;
        if (!INVENTORY_LIGHTS.has(i)) throw unsupported('light', light);
        return i;
    }

    private checkCap(cap: number, enabling: boolean): void {
        if (isTextureTarget(cap)) return;
        if (cap >= E.GL_TEXTURE_GEN_S && cap <= E.GL_TEXTURE_GEN_Q) return;
        if (cap >= E.GL_LIGHT0 && cap <= E.GL_LIGHT7) {
            this.lightIndex(cap);
            return;
        }
        if (cap === E.GL_FRAGMENT_PROGRAM_ARB && enabling) throw unsupported('glEnable', cap);
        if (!this.state.enabled.has(cap)) throw unsupported(enabling ? 'glEnable' : 'glDisable', cap);
    }

    private texGenCoord(coord: number): number {
        const i = coord - E.GL_S;
        if (i < 0 || i > 3) throw unsupported('texgen coord', coord);
        return i;
    }

    private checkTexEnvTarget(target: number): void {
        if (target !== E.GL_TEXTURE_ENV) throw unsupported('texture environment target', target);
    }

    // Inventory check for an enum-valued texture environment parameter.
    private checkTexEnvEnum(pname: number, value: number): void {
        switch (pname) {
            case E.GL_TEXTURE_ENV_MODE:
                if (value !== E.GL_MODULATE && value !== E.GL_REPLACE && value !== E.GL_ADD && value !== E.GL_COMBINE) throw unsupported('TEXTURE_ENV_MODE', value);
                return;
            case E.GL_COMBINE_RGB:
            case E.GL_COMBINE_ALPHA:
                if (!COMBINE_MODES.has(value)) throw unsupported('combiner function', value);
                return;
            case E.GL_SOURCE0_RGB:
            case E.GL_SOURCE1_RGB:
            case E.GL_SOURCE2_RGB:
            case E.GL_SOURCE0_ALPHA:
            case E.GL_SOURCE1_ALPHA:
            case E.GL_SOURCE2_ALPHA:
                if (!COMBINE_SOURCES.has(value)) throw unsupported('combiner source', value);
                return;
            case E.GL_OPERAND0_RGB:
            case E.GL_OPERAND1_RGB:
            case E.GL_OPERAND2_RGB:
                if (!RGB_OPERANDS.has(value)) throw unsupported('combiner RGB operand', value);
                return;
            case E.GL_OPERAND0_ALPHA:
            case E.GL_OPERAND1_ALPHA:
            case E.GL_OPERAND2_ALPHA:
                if (!ALPHA_OPERANDS.has(value)) throw unsupported('combiner alpha operand', value);
                return;
            case E.GL_RGB_SCALE:
            case E.GL_ALPHA_SCALE:
                return;
            default:
                throw unsupported('texture environment parameter', pname);
        }
    }

    private checkTexParameter(target: number, pname: number, param: number): void {
        if (!isTextureTarget(target)) throw unsupported('glTexParameteri target', target);
        switch (pname) {
            case E.GL_TEXTURE_MIN_FILTER:
                if (!MIN_FILTERS.has(param)) throw unsupported('TEXTURE_MIN_FILTER', param);
                return;
            case E.GL_TEXTURE_MAG_FILTER:
                if (param !== E.GL_NEAREST && param !== E.GL_LINEAR) throw unsupported('TEXTURE_MAG_FILTER', param);
                return;
            case E.GL_TEXTURE_WRAP_S:
            case E.GL_TEXTURE_WRAP_T:
            case E.GL_TEXTURE_WRAP_R:
                if (param !== E.GL_REPEAT && param !== E.GL_CLAMP_TO_EDGE) throw unsupported('texture wrap mode', param);
                return;
            default:
                throw unsupported('glTexParameteri pname', pname);
        }
    }

    private checkPointer(what: string, size: number, type: number, sizes: readonly number[], types: readonly number[]): void {
        if (!sizes.includes(size)) throw unsupported(what + ' size', size);
        if (!types.includes(type)) throw unsupported(what + ' type', type);
    }

    // =============================================================================================================
    // GL entry points, in the shipped interface's order. Each follows NullGL's JOGL checks, then the driver semantics.
    // =============================================================================================================

    // javax.media.opengl.GL.glActiveTexture(I)V
    glActiveTexture(texture: GLenum): void {
        this.checkAvailable('glActiveTexture');
        const unit = this.unitOf(texture, 'glActiveTexture');
        if (this.compiling === null) this.setActiveTexture(unit);
        else this.compiling.commands.push(this.setActiveTexture.bind(this, unit));
    }

    private setActiveTexture(unit: number): void {
        if (unit >= this.state.unitCount) this.state.setError(E.GL_INVALID_ENUM);
        else this.state.activeTexture = unit;
    }

    // javax.media.opengl.GL.glAlphaFunc(IF)V
    glAlphaFunc(func: GLenum, ref: GLclampf): void {
        if (!COMPARE_FUNCS.has(func)) throw unsupported('glAlphaFunc', func);
        const r = clamp01(Math.fround(ref));
        this.emit(() => {
            this.state.alphaFunc = func;
            this.state.alphaRef = r;
        });
    }

    // javax.media.opengl.GL.glBegin(I)V
    glBegin(mode: GLenum): void {
        if (mode !== E.GL_LINES && mode !== E.GL_LINE_LOOP && mode !== E.GL_TRIANGLE_FAN) throw unsupported('glBegin mode', mode);
        if (this.compiling === null) this.immediate.begin(mode, this.state);
        else this.compiling.commands.push(this.immediate.begin.bind(this.immediate, mode, this.state));
    }

    // javax.media.opengl.GL.glBindBufferARB(II)V
    glBindBufferARB(target: GLenum, buffer: GLuint): void {
        this.checkAvailable('glBindBufferARB');
        if (target !== E.GL_ARRAY_BUFFER && target !== E.GL_ELEMENT_ARRAY_BUFFER) throw unsupported('glBindBufferARB target', target);
        // Not compiled into display lists (ARB_vertex_buffer_object).
        if (buffer !== 0 && !this.buffers.has(buffer)) this.buffers.set(buffer, new BufferObject(buffer, this.staticStores));
        if (target === E.GL_ARRAY_BUFFER) this.state.arrayBufferBinding = buffer;
        else this.state.elementArrayBufferBinding = buffer;
    }

    // javax.media.opengl.GL.glBindProgramARB(II)V
    glBindProgramARB(target: GLenum, program: GLuint): void {
        this.checkAvailable('glBindProgramARB');
        if (target !== E.GL_VERTEX_PROGRAM_ARB) throw unsupported('glBindProgramARB target', target);
        this.emit(() => {
            if (!this.programs.has(program)) this.programs.set(program, new ProgramObject(program));
            this.state.vertexProgramBinding = program;
        });
    }

    // javax.media.opengl.GL.glBindTexture(II)V
    glBindTexture(target: GLenum, texture: GLuint): void {
        if (!isTextureTarget(target)) throw unsupported('glBindTexture target', target);
        if (this.compiling === null) this.bindTexture(target, texture);
        else this.compiling.commands.push(this.bindTexture.bind(this, target, texture));
    }

    private bindTexture(target: TextureTarget, texture: GLuint): void {
        if (texture !== 0) {
            let object = this.textures.get(texture);
            if (object === undefined) {
                object = new TextureObject(texture, target);
                this.textures.set(texture, object);
            } else if (object.target !== target) {
                this.state.setError(E.GL_INVALID_OPERATION);
                return;
            }
        }
        this.state.unit.binding.set(target, texture);
    }

    // javax.media.opengl.GL.glBlendFunc(II)V
    glBlendFunc(sfactor: GLenum, dfactor: GLenum): void {
        if (!BLEND_SRC.has(sfactor)) throw unsupported('glBlendFunc sfactor', sfactor);
        if (!BLEND_DST.has(dfactor)) throw unsupported('glBlendFunc dfactor', dfactor);
        this.emit(() => {
            this.state.blendSrc = sfactor;
            this.state.blendDst = dfactor;
        });
    }

    // javax.media.opengl.GL.glBufferDataARB(IILjava/nio/Buffer;I)V
    glBufferDataARB(target: GLenum, size: GLsizeiptrARB, data: Buffer | null, usage: GLenum): void {
        this.checkAvailable('glBufferDataARB');
        if (target !== E.GL_ARRAY_BUFFER && target !== E.GL_ELEMENT_ARRAY_BUFFER) throw unsupported('glBufferDataARB target', target);
        if (usage !== E.GL_STATIC_DRAW && usage !== E.GL_STREAM_DRAW) throw unsupported('glBufferDataARB usage', usage);
        // Not compiled into display lists.
        const b = this.boundBuffer(target);
        if (b === null) {
            this.state.setError(E.GL_INVALID_OPERATION);
            return;
        }
        if (size < 0) {
            this.state.setError(E.GL_INVALID_VALUE);
            return;
        }
        let src: Uint8Array | null = null;
        if (data !== null) {
            src = clientBytes(data);
            if (src.length < size) throw new RangeError('glBufferDataARB reads ' + size + ' bytes from a buffer holding ' + src.length);
        }
        b.setData(size, src, usage, target);
        this.indexed.invalidateVertexInput();
    }

    // javax.media.opengl.GL.glBufferSubDataARB(IIILjava/nio/Buffer;)V
    glBufferSubDataARB(target: GLenum, offset: GLintptrARB, size: GLsizeiptrARB, data: Buffer | null): void {
        this.checkAvailable('glBufferSubDataARB');
        if (target !== E.GL_ARRAY_BUFFER && target !== E.GL_ELEMENT_ARRAY_BUFFER) throw unsupported('glBufferSubDataARB target', target);
        const b = this.boundBuffer(target);
        if (b === null) {
            this.state.setError(E.GL_INVALID_OPERATION);
            return;
        }
        if (offset < 0 || size < 0 || offset + size > b.byteLength) {
            this.state.setError(E.GL_INVALID_VALUE);
            return;
        }
        const src = data === null ? new Uint8Array(size) : clientBytes(data);
        if (src.length < size) throw new RangeError('glBufferSubDataARB reads ' + size + ' bytes from a buffer holding ' + src.length);
        b.setSubData(offset, src.subarray(0, size));
        this.indexed.invalidateVertexInput();
    }

    // javax.media.opengl.GL.glCallList(I)V
    glCallList(list: GLuint): void {
        if (this.compiling === null) this.execCallList(list);
        else this.compiling.commands.push(this.execCallList.bind(this, list));
    }

    private execCallList(list: number): void {
        const commands = this.lists.get(list);
        if (commands === undefined || this.callDepth >= MAX_LIST_NESTING) return;
        this.callDepth++;
        try {
            for (const c of commands) c();
        } finally {
            this.callDepth--;
        }
    }

    // javax.media.opengl.GL.glClear(I)V
    glClear(mask: GLbitfield): void {
        if ((mask & ~(E.GL_COLOR_BUFFER_BIT | E.GL_DEPTH_BUFFER_BIT)) !== 0) throw unsupported('glClear mask', mask);
        this.emit(() => this.execClear(mask));
    }

    // GL's glClear honours the scissor box and the depth mask but no other per-fragment state. Unscissored (or a
    // scissor box covering the surface), it is a new render pass with loadOp 'clear' for the cleared buffers; otherwise
    // a clear quad clipped to the scissor rect, writing colour and/or depth.
    private execClear(mask: number): void {
        const s = this.state;
        const color = (mask & E.GL_COLOR_BUFFER_BIT) !== 0;
        const depth = (mask & E.GL_DEPTH_BUFFER_BIT) !== 0 && s.depthMask;
        this.clears++;
        if (!color && !depth) return;
        if (color && s.drawBuffer !== E.GL_BACK && s.drawBuffer !== E.GL_BACK_LEFT) throw notYet('H2', 'glClear with draw buffer ' + s.drawBuffer);
        const host = this.requireHost();
        const t = host.targets();
        let rect = { x: 0, y: 0, width: t.width, height: t.height };
        if (s.isEnabled(E.GL_SCISSOR_TEST)) {
            const r = glBoxToRect(s.scissor[0], s.scissor[1], s.scissor[2], s.scissor[3], t.width, t.height);
            if (r === null) return;
            rect = r;
        }
        const c = s.clearColor;
        const alpha = host.alphaBits === 0 ? 1 : c[3];
        const full = rect.x === 0 && rect.y === 0 && rect.width === t.width && rect.height === t.height;
        if (full) {
            t.beginPass(color ? { r: c[0], g: c[1], b: c[2], a: alpha } : null, depth ? s.clearDepth : null);
        } else {
            t.clearQuad(rect, Float32Array.of(c[0], c[1], c[2], alpha), s.clearDepth, color, depth);
        }
    }

    // javax.media.opengl.GL.glClearColor(FFFF)V
    glClearColor(red: GLclampf, green: GLclampf, blue: GLclampf, alpha: GLclampf): void {
        const c = [red, green, blue, alpha].map(v => clamp01(Math.fround(v)));
        this.emit(() => this.state.clearColor.set(c));
    }

    // javax.media.opengl.GL.glClearDepth(D)V
    glClearDepth(depth: GLclampd): void {
        const d = clamp01(depth);
        this.emit(() => {
            this.state.clearDepth = d;
        });
    }

    // javax.media.opengl.GL.glClientActiveTexture(I)V
    glClientActiveTexture(texture: GLenum): void {
        this.checkAvailable('glClientActiveTexture');
        const unit = this.unitOf(texture, 'glClientActiveTexture');
        // Client state: not compiled.
        if (unit >= this.state.unitCount) this.state.setError(E.GL_INVALID_ENUM);
        else this.state.clientActiveTexture = unit;
    }

    // javax.media.opengl.GL.glColor3ub(BBB)V
    glColor3ub(red: GLubyte, green: GLubyte, blue: GLubyte): void {
        const r = Math.fround((red & 0xff) / 255),
            g = Math.fround((green & 0xff) / 255),
            b = Math.fround((blue & 0xff) / 255);
        if (this.compiling === null) this.state.setCurrentColor(r, g, b, 1);
        else this.compiling.commands.push(this.state.setCurrentColor.bind(this.state, r, g, b, 1));
    }

    // javax.media.opengl.GL.glColor4f(FFFF)V
    glColor4f(red: GLfloat, green: GLfloat, blue: GLfloat, alpha: GLfloat): void {
        const r = Math.fround(red),
            g = Math.fround(green),
            b = Math.fround(blue),
            a = Math.fround(alpha);
        if (this.compiling === null) this.state.setCurrentColor(r, g, b, a);
        else this.compiling.commands.push(this.state.setCurrentColor.bind(this.state, r, g, b, a));
    }

    // javax.media.opengl.GL.glColor4fv([FI)V
    glColor4fv(v: Float32Array | null, v_offset: number): void {
        checkArrayOffset(v, v_offset, 'v_offset');
        const c = this.floatArgument(requireNonNull(v), v_offset, 4);
        this.emit(() => this.state.setCurrentColor(c[0], c[1], c[2], c[3]));
    }

    // javax.media.opengl.GL.glColor4ub(BBBB)V
    glColor4ub(red: GLubyte, green: GLubyte, blue: GLubyte, alpha: GLubyte): void {
        const r = Math.fround((red & 0xff) / 255),
            g = Math.fround((green & 0xff) / 255);
        const b = Math.fround((blue & 0xff) / 255),
            a = Math.fround((alpha & 0xff) / 255);
        if (this.compiling === null) this.state.setCurrentColor(r, g, b, a);
        else this.compiling.commands.push(this.state.setCurrentColor.bind(this.state, r, g, b, a));
    }

    // javax.media.opengl.GL.glColorMaterial(II)V
    glColorMaterial(face: GLenum, mode: GLenum): void {
        if (face !== E.GL_FRONT && face !== E.GL_BACK && face !== E.GL_FRONT_AND_BACK) throw unsupported('glColorMaterial face', face);
        if (mode !== E.GL_AMBIENT_AND_DIFFUSE) throw unsupported('glColorMaterial mode', mode);
        this.emit(() => this.state.setColorMaterial(face, mode));
    }

    // javax.media.opengl.GL.glColorPointer(IIILjava/nio/Buffer;)V
    glColorPointer(size: GLint, type: GLenum, stride: GLsizei, ptr: Buffer | null): void;
    // javax.media.opengl.GL.glColorPointer(IIIJ)V
    glColorPointer(size: GLint, type: GLenum, stride: GLsizei, ptr_buffer_offset: bigint): void;
    glColorPointer(size: GLint, type: GLenum, stride: GLsizei, ptr: Buffer | null | bigint): void {
        this.checkPointer('glColorPointer', size, type, COLOR_POINTER_SIZES, COLOR_POINTER_TYPES);
        this.setPointer(this.state.colorArray, size, type, stride, ptr);
    }

    // Client state (not compiled). The long form is an offset into the ARRAY_BUFFER bound now; the Buffer form
    // addresses client memory from the buffer's position.
    private setPointer(p: ArrayPointer, size: number, type: number, stride: number, ptr: Buffer | null | bigint): void {
        if (stride < 0) {
            this.state.setError(E.GL_INVALID_VALUE);
            return;
        }
        if (typeof ptr === 'bigint') p.set(size, type, stride, this.state.arrayBufferBinding, Number(ptr), null);
        else p.set(size, type, stride, this.state.arrayBufferBinding, 0, ptr);
        this.indexed.invalidateVertexInput();
    }

    // javax.media.opengl.GL.glCopyPixels(IIIII)V
    glCopyPixels(x: GLint, y: GLint, width: GLsizei, height: GLsizei, type: GLenum): void {
        if (type !== E.GL_COLOR) throw unsupported('glCopyPixels type', type);
        this.emit(() => {
            if (!this.drawPixelRect(width, height)) return;
            const host = this.requireHost();
            const targets = host.targets();
            if (this.state.readBuffer === E.GL_FRONT || this.state.readBuffer === E.GL_FRONT_LEFT) {
                // The next swap changes this source. This frame cannot be redrawn
                // later using the same front-buffer binding.
                targets.stopStress();
                transferPixels(this.state, targets, host.front(), x, y, width, height, true, host.alphaBits === 0);
            } else {
                // A self-copy must sample a snapshot, including when the rectangles overlap.
                const back = targets.resolved();
                const saved = host.gpu.device.createTexture({ label: 'gl-copy-pixels', size: [targets.width, targets.height], format: 'rgba8unorm', usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING });
                host.gpu.getEncoder().copyTextureToTexture({ texture: back }, { texture: saved }, [targets.width, targets.height]);
                host.gpu.retire(saved);
                transferPixels(this.state, targets, saved, x, y, width, height, true, host.alphaBits === 0);
            }
        });
    }

    private drawPixelRect(width: number, height: number): boolean {
        if (width < 0 || height < 0) {
            this.state.setError(E.GL_INVALID_VALUE);
            return false;
        }
        return width !== 0 && height !== 0 && this.state.rasterPosValid && this.state.pixelZoomX !== 0 && this.state.pixelZoomY !== 0;
    }

    // javax.media.opengl.GL.glCullFace(I)V
    glCullFace(mode: GLenum): void {
        if (mode !== E.GL_FRONT && mode !== E.GL_BACK) throw unsupported('glCullFace', mode);
        this.emit(() => {
            this.state.cullFaceMode = mode;
        });
    }

    // javax.media.opengl.GL.glDeleteBuffersARB(I[II)V
    glDeleteBuffersARB(n: GLsizei, ids: Int32Array | null, ids_offset: number): void {
        rangeCheck(ids, ids_offset, n);
        checkArrayOffset(ids, ids_offset, 'ids_offset');
        this.checkAvailable('glDeleteBuffersARB');
        if (n < 0) {
            this.state.setError(E.GL_INVALID_VALUE);
            return;
        }
        const array = requireNonNull(ids);
        const host = this.host;
        for (let i = 0; i < n; i++) {
            const name = array[ids_offset + i];
            const b = name === 0 ? undefined : this.buffers.get(name);
            if (b === undefined) continue;
            b.destroy(r => (host !== null ? host.gpu.retire(r) : r.destroy()));
            this.buffers.delete(name);
            this.indexed.invalidateVertexInput();
            const s = this.state;
            if (s.arrayBufferBinding === name) s.arrayBufferBinding = 0;
            if (s.elementArrayBufferBinding === name) s.elementArrayBufferBinding = 0;
            for (const p of [s.vertexArray, s.normalArray, s.colorArray, ...s.texCoordArrays]) if (p.buffer === name) p.buffer = 0;
        }
    }

    // javax.media.opengl.GL.glDeleteLists(II)V
    glDeleteLists(list: GLuint, range: GLsizei): void {
        if (range < 0) {
            this.state.setError(E.GL_INVALID_VALUE);
            return;
        }
        for (let i = 0; i < range; i++) this.lists.delete((list + i) | 0);
    }

    // javax.media.opengl.GL.glDeleteTextures(I[II)V
    glDeleteTextures(n: GLsizei, textures: Int32Array | null, textures_offset: number): void {
        rangeCheck(textures, textures_offset, n);
        checkArrayOffset(textures, textures_offset, 'textures_offset');
        if (n < 0) {
            this.state.setError(E.GL_INVALID_VALUE);
            return;
        }
        const array = requireNonNull(textures);
        const host = this.host;
        for (let i = 0; i < n; i++) {
            const name = array[textures_offset + i];
            const t = name === 0 ? undefined : this.textures.get(name);
            if (t === undefined) continue;
            t.destroy(r => (host !== null ? host.gpu.retire(r) : r.destroy()));
            this.textures.delete(name);
            // GL: a deleted texture that is bound reverts that binding to 0.
            for (const u of this.state.units) {
                for (const [target, bound] of u.binding) if (bound === name) u.binding.set(target, 0);
            }
        }
    }

    // javax.media.opengl.GL.glDepthFunc(I)V
    glDepthFunc(func: GLenum): void {
        if (!COMPARE_FUNCS.has(func)) throw unsupported('glDepthFunc', func);
        this.emit(() => {
            this.state.depthFunc = func;
        });
    }

    // javax.media.opengl.GL.glDepthMask(Z)V
    glDepthMask(flag: GLboolean): void {
        this.emit(() => {
            this.state.depthMask = flag;
        });
    }

    // javax.media.opengl.GL.glDisable(I)V
    glDisable(cap: GLenum): void {
        this.checkCap(cap, false);
        if (this.compiling === null) this.state.setEnabled(cap, false);
        else this.compiling.commands.push(this.state.setEnabled.bind(this.state, cap, false));
    }

    // javax.media.opengl.GL.glDisableClientState(I)V
    glDisableClientState(array: GLenum): void {
        const pointer = this.clientArray(array);
        if (pointer.enabled) {
            pointer.enabled = false;
            this.indexed.invalidateVertexInput();
        }
    }

    private clientArray(array: number): ArrayPointer {
        const s = this.state;
        switch (array) {
            case E.GL_VERTEX_ARRAY:
                return s.vertexArray;
            case E.GL_NORMAL_ARRAY:
                return s.normalArray;
            case E.GL_COLOR_ARRAY:
                return s.colorArray;
            case E.GL_TEXTURE_COORD_ARRAY:
                return s.texCoordArrays[s.clientActiveTexture];
            default:
                throw unsupported('client array', array);
        }
    }

    // javax.media.opengl.GL.glDrawBuffer(I)V
    glDrawBuffer(mode: GLenum): void {
        if (mode !== E.GL_FRONT && mode !== E.GL_BACK && mode !== E.GL_FRONT_LEFT && mode !== E.GL_BACK_LEFT) throw unsupported('glDrawBuffer', mode);
        this.emit(() => {
            this.state.drawBuffer = mode;
        });
    }

    // javax.media.opengl.GL.glDrawElements(IIILjava/nio/Buffer;)V
    glDrawElements(mode: GLenum, count: GLsizei, type: GLenum, indices: Buffer | null): void;
    // javax.media.opengl.GL.glDrawElements(IIIJ)V
    glDrawElements(mode: GLenum, count: GLsizei, type: GLenum, indices_buffer_offset: bigint): void;
    glDrawElements(mode: GLenum, count: GLsizei, type: GLenum, indices: Buffer | null | bigint): void {
        if (mode !== E.GL_TRIANGLES) throw unsupported('glDrawElements mode', mode);
        if (type !== E.GL_UNSIGNED_INT) throw unsupported('glDrawElements type', type);
        if (this.compilingList) throw new GlUnsupported("glDrawElements inside a display list is outside the jar's inventory");
        if (count < 0) {
            this.state.setError(E.GL_INVALID_VALUE);
            return;
        }
        if (count === 0 || !this.state.vertexArray.enabled) return;
        this.indexed.draw(this, this.requireHost(), count, indices);
    }

    // javax.media.opengl.GL.glDrawPixels(IIIILjava/nio/Buffer;)V
    glDrawPixels(width: GLsizei, height: GLsizei, format: GLenum, type: GLenum, pixels: Buffer | null): void {
        if (format !== E.GL_BGRA) throw unsupported('glDrawPixels format', format);
        if (type !== E.GL_UNSIGNED_BYTE && type !== E.GL_UNSIGNED_INT_8_8_8_8_REV) throw unsupported('glDrawPixels type', type);
        if (this.compilingList) throw new GlUnsupported("glDrawPixels inside a display list is outside the jar's inventory");
        if (!this.drawPixelRect(width, height)) return;
        const store = this.state.pixelStore;
        const bgra = unpackImage(clientBytes(requireNonNull(pixels)), width, height, 1, 4, {
            alignment: requireNonNull(store.get(E.GL_UNPACK_ALIGNMENT)),
            rowLength: requireNonNull(store.get(E.GL_UNPACK_ROW_LENGTH)),
            skipRows: requireNonNull(store.get(E.GL_UNPACK_SKIP_ROWS)),
            skipPixels: requireNonNull(store.get(E.GL_UNPACK_SKIP_PIXELS))
        });
        const swapWord = type === E.GL_UNSIGNED_INT_8_8_8_8_REV && store.get(E.GL_UNPACK_SWAP_BYTES) !== 0;
        if (swapWord) {
            for (let i = 0; i < bgra.length; i += 4) {
                const a = bgra[i],
                    b = bgra[i + 1];
                bgra[i] = bgra[i + 3];
                bgra[i + 1] = bgra[i + 2];
                bgra[i + 2] = b;
                bgra[i + 3] = a;
            }
        }
        const host = this.requireHost();
        const targets = host.targets();
        const source = host.gpu.device.createTexture({ label: 'gl-draw-pixels', size: [width, height], format: 'bgra8unorm', usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING });
        host.gpu.device.queue.writeTexture({ texture: source }, bgra, { bytesPerRow: width * 4 }, [width, height]);
        host.gpu.retire(source);
        transferPixels(this.state, targets, source, 0, 0, width, height, false, host.alphaBits === 0);
    }

    // javax.media.opengl.GL.glEnable(I)V
    glEnable(cap: GLenum): void {
        this.checkCap(cap, true);
        if (this.compiling === null) this.state.setEnabled(cap, true);
        else this.compiling.commands.push(this.state.setEnabled.bind(this.state, cap, true));
    }

    // javax.media.opengl.GL.glEnableClientState(I)V
    glEnableClientState(array: GLenum): void {
        const pointer = this.clientArray(array);
        if (!pointer.enabled) {
            pointer.enabled = true;
            this.indexed.invalidateVertexInput();
        }
    }

    // javax.media.opengl.GL.glEnd()V
    glEnd(): void {
        if (this.compiling === null) this.immediate.end(this, this.host);
        else this.compiling.commands.push(this.endImmediate.bind(this));
    }

    private endImmediate(): void {
        this.immediate.end(this, this.host);
    }

    // javax.media.opengl.GL.glEndList()V
    glEndList(): void {
        const c = this.compiling;
        if (c === null) {
            this.state.setError(E.GL_INVALID_OPERATION);
            return;
        }
        this.lists.set(c.name, c.commands);
        this.compiling = null;
    }

    // javax.media.opengl.GL.glFogf(IF)V
    glFogf(pname: GLenum, param: GLfloat): void {
        const v = Math.fround(param);
        if (pname === E.GL_FOG_MODE) {
            this.glFogi(pname, v | 0);
            return;
        }
        if (pname !== E.GL_FOG_DENSITY && pname !== E.GL_FOG_START && pname !== E.GL_FOG_END) throw unsupported('glFogf pname', pname);
        this.emit(() => this.state.setFogScalar(pname, v));
    }

    // javax.media.opengl.GL.glFogfv(I[FI)V
    glFogfv(pname: GLenum, params: Float32Array | null, params_offset: number): void {
        checkArrayOffset(params, params_offset, 'params_offset');
        const array = requireNonNull(params);
        if (pname === E.GL_FOG_COLOR) {
            const c = this.floatArgument(array, params_offset, 4);
            this.emit(() => this.state.setFogColor(c, 0));
            return;
        }
        this.glFogf(pname, this.floatArgument(array, params_offset, 1)[0]);
    }

    // javax.media.opengl.GL.glFogi(II)V
    glFogi(pname: GLenum, param: GLint): void {
        if (pname === E.GL_FOG_MODE) {
            if (param !== E.GL_LINEAR) throw unsupported('FOG_MODE', param);
            this.emit(() => this.state.setFogScalar(pname, param));
            return;
        }
        if (pname !== E.GL_FOG_DENSITY && pname !== E.GL_FOG_START && pname !== E.GL_FOG_END) throw unsupported('glFogi pname', pname);
        this.emit(() => this.state.setFogScalar(pname, param));
    }

    // javax.media.opengl.GL.glGenBuffersARB(I[II)V
    glGenBuffersARB(n: GLsizei, ids: Int32Array | null, ids_offset: number): void {
        rangeCheck(ids, ids_offset, n);
        checkArrayOffset(ids, ids_offset, 'ids_offset');
        this.checkAvailable('glGenBuffersARB');
        for (let i = 0; i < n; i++) arrayPutI32(ids, ids_offset + i, this.nextBuffer++);
    }

    // javax.media.opengl.GL.glGenLists(I)I
    glGenLists(range: GLsizei): GLuint {
        if (range < 0) this.state.setError(E.GL_INVALID_VALUE);
        if (range <= 0) return 0;
        const base = this.nextList;
        this.nextList = (this.nextList + range) | 0;
        for (let i = 0; i < range; i++) this.lists.set((base + i) | 0, []);
        return base;
    }

    // javax.media.opengl.GL.glGenProgramsARB(I[II)V
    glGenProgramsARB(n: GLsizei, ids: Int32Array | null, ids_offset: number): void {
        rangeCheck(ids, ids_offset, n);
        checkArrayOffset(ids, ids_offset, 'ids_offset');
        this.checkAvailable('glGenProgramsARB');
        for (let i = 0; i < n; i++) arrayPutI32(ids, ids_offset + i, this.nextProgram++);
    }

    // javax.media.opengl.GL.glGenTextures(I[II)V
    glGenTextures(n: GLsizei, textures: Int32Array | null, textures_offset: number): void {
        rangeCheck(textures, textures_offset, n);
        checkArrayOffset(textures, textures_offset, 'textures_offset');
        for (let i = 0; i < n; i++) arrayPutI32(textures, textures_offset + i, this.nextTexture++);
    }

    // javax.media.opengl.GL.glGetFloatv(ILjava/nio/FloatBuffer;)V
    glGetFloatv(pname: GLenum, params: FloatBuffer | null): void;
    // javax.media.opengl.GL.glGetFloatv(I[FI)V
    glGetFloatv(pname: GLenum, params: Float32Array | null, params_offset: number): void;
    glGetFloatv(pname: GLenum, params: FloatBuffer | Float32Array | null, params_offset?: number): void {
        const bits = this.floatAnswer(pname);
        if (params_offset === undefined) {
            // The FloatBuffer form writes from the buffer's position on; the position does not move.
            const buffer = requireNonNull(params instanceof Float32Array ? null : params);
            if (bits === null) return;
            for (let i = 0; i < bits.length; i++) buffer.put(buffer.position() + i, bitsToFloat(bits[i]));
            return;
        }
        const array = params instanceof FloatBuffer ? null : params;
        checkArrayOffset(array, params_offset, 'params_offset');
        if (bits === null) return;
        const target = requireNonNull(array);
        const raw = new Uint32Array(target.buffer, target.byteOffset, target.length);
        for (let i = 0; i < bits.length; i++) {
            arrayPutF32(target, params_offset + i, bitsToFloat(bits[i])); // the Java array store checks
            raw[params_offset + i] = bits[i]; // exact bits, NaN payloads included
        }
    }

    // The binary32 bits glGetFloatv writes for pname, or null when it writes nothing. LIGHT_MODEL_AMBIENT is the
    // mirror's state; everything else is the profile's static answer, as NullGL gives it (POINT_SIZE_MAX included:
    // the jar reads it once, before ga.a()V clamps it).
    private floatAnswer(pname: number): number[] | null {
        if (pname === E.GL_LIGHT_MODEL_AMBIENT) {
            const a = this.state.lightModelAmbient;
            return [...new Uint32Array(a.buffer, a.byteOffset, 4)];
        }
        const values = this.profile.floats[String(pname)];
        return values === undefined ? null : values.map(v => parseInt(v, 16) >>> 0);
    }

    // javax.media.opengl.GL.glGetIntegerv(I[II)V
    glGetIntegerv(pname: GLenum, params: Int32Array | null, params_offset: number): void {
        checkArrayOffset(params, params_offset, 'params_offset');
        let values: readonly number[] | undefined;
        const s = this.state;
        if (pname === E.GL_DRAW_BUFFER) values = [s.drawBuffer];
        else if (pname === E.GL_READ_BUFFER) values = [s.readBuffer];
        else if (pname === E.GL_PROGRAM_ERROR_POSITION_ARB) values = [-1];
        else if (s.pixelStore.has(pname)) values = [requireNonNull(s.pixelStore.get(pname))];
        else values = this.profile.integers[String(pname)];
        if (values === undefined) return;
        for (let i = 0; i < values.length; i++) arrayPutI32(params, params_offset + i, values[i]);
    }

    // javax.media.opengl.GL.glGetString(I)Ljava/lang/String;
    glGetString(name: GLenum): string | null {
        const value = this.profile.strings[String(name)];
        return value === undefined ? null : value;
    }

    // javax.media.opengl.GL.glGetTexLevelParameteriv(III[II)V
    // Proxy targets answer by the proxy rule (as NullGL). Real targets answer from the bound object's image (the jar
    // and JOGL's GLU only ever query proxies).
    glGetTexLevelParameteriv(target: GLenum, level: GLint, pname: GLenum, params: Int32Array | null, params_offset: number): void {
        checkArrayOffset(params, params_offset, 'params_offset');
        arrayPutI32(params, params_offset, this.texLevelParameter(target, level, pname));
    }

    private texLevelParameter(target: number, level: number, pname: number): number {
        if (target === PROXY_TEXTURE_1D || target === PROXY_TEXTURE_2D || target === PROXY_TEXTURE_3D || target === PROXY_TEXTURE_CUBE_MAP) {
            return this.proxyQuery(target, level, pname);
        }
        const objTarget: number = isCubeFace(target) ? E.GL_TEXTURE_CUBE_MAP : target;
        if (!isTextureTarget(objTarget)) return 0;
        const img = this.boundTexture(objTarget).images[isCubeFace(target) ? cubeFaceIndex(target) : 0].get(level);
        if (img === undefined) return 0;
        if (pname === E.GL_TEXTURE_WIDTH) return img.width;
        if (pname === E.GL_TEXTURE_HEIGHT) return img.height;
        if (pname === E.GL_TEXTURE_DEPTH) return img.depth;
        if (pname === E.GL_TEXTURE_INTERNAL_FORMAT) return img.internalFormat;
        if (pname === E.GL_TEXTURE_BORDER) return img.border;
        return 0;
    }

    // javax.media.opengl.GL.glHint(II)V
    glHint(target: GLenum, mode: GLenum): void {
        if (target !== E.GL_FOG_HINT) throw unsupported('glHint target', target);
        if (mode !== E.GL_FASTEST) throw unsupported('glHint mode', mode);
        this.emit(() => {
            this.state.fogHint = mode;
        });
    }

    // javax.media.opengl.GL.glInterleavedArrays(IILjava/nio/Buffer;)V
    glInterleavedArrays(format: GLenum, stride: GLsizei, pointer: Buffer | null): void;
    // javax.media.opengl.GL.glInterleavedArrays(IIJ)V
    glInterleavedArrays(format: GLenum, stride: GLsizei, pointer_buffer_offset: bigint): void;
    // GL 2.1 2.8 table 2.5: C4UB_V3F enables colour (4 ubyte at 0) and vertex (3 float at 4), stride 16; T2F_V3F
    // enables texcoord (2 float at 0, client-active unit) and vertex (3 float at 8), stride 20; both disable the
    // arrays their format lacks (normal; texcoord or colour). Client state: not compiled.
    glInterleavedArrays(format: GLenum, stride: GLsizei, pointer: Buffer | null | bigint): void {
        if (format !== E.GL_C4UB_V3F && format !== E.GL_T2F_V3F) throw unsupported('glInterleavedArrays format', format);
        if (stride < 0) {
            this.state.setError(E.GL_INVALID_VALUE);
            return;
        }
        const s = this.state;
        const c4ub = format === E.GL_C4UB_V3F;
        const step = stride !== 0 ? stride : c4ub ? 16 : 20;
        const vbo = typeof pointer === 'bigint';
        const base = vbo ? Number(pointer) : 0;
        const client = vbo ? null : pointer;
        const binding = s.arrayBufferBinding;
        const tex = s.texCoordArrays[s.clientActiveTexture];
        this.indexed.invalidateVertexInput();
        s.normalArray.enabled = false;
        if (c4ub) {
            tex.enabled = false;
            s.colorArray.enabled = true;
            s.colorArray.set(4, E.GL_UNSIGNED_BYTE, step, binding, base, client);
            s.vertexArray.enabled = true;
            s.vertexArray.set(3, E.GL_FLOAT, step, binding, base + 4, client);
        } else {
            s.colorArray.enabled = false;
            tex.enabled = true;
            tex.set(2, E.GL_FLOAT, step, binding, base, client);
            s.vertexArray.enabled = true;
            s.vertexArray.set(3, E.GL_FLOAT, step, binding, base + 8, client);
        }
    }

    // javax.media.opengl.GL.glLightModelfv(I[FI)V
    glLightModelfv(pname: GLenum, params: Float32Array | null, params_offset: number): void {
        checkArrayOffset(params, params_offset, 'params_offset');
        if (pname !== E.GL_LIGHT_MODEL_AMBIENT) throw unsupported('glLightModelfv pname', pname);
        // NullGL changes LIGHT_MODEL_AMBIENT only for 0 <= offset <= length - 4 (GLTRACE.md section 16).
        if (params === null || params_offset < 0 || params_offset > params.length - 4) return;
        const v = this.floatArgument(params, params_offset, 4);
        this.emit(() => this.state.setLightModelAmbient(v, 0));
    }

    // javax.media.opengl.GL.glLightf(IIF)V
    glLightf(light: GLenum, pname: GLenum, param: GLfloat): void {
        const i = this.lightIndex(light);
        if (pname !== E.GL_CONSTANT_ATTENUATION && pname !== E.GL_LINEAR_ATTENUATION && pname !== E.GL_QUADRATIC_ATTENUATION) throw unsupported('glLightf pname', pname);
        const v = Math.fround(param);
        this.emit(() => this.state.setLightScalar(i, pname, v));
    }

    // javax.media.opengl.GL.glLightfv(II[FI)V
    glLightfv(light: GLenum, pname: GLenum, params: Float32Array | null, params_offset: number): void {
        checkArrayOffset(params, params_offset, 'params_offset');
        const i = this.lightIndex(light);
        if (pname !== E.GL_AMBIENT && pname !== E.GL_DIFFUSE && pname !== E.GL_POSITION) throw unsupported('glLightfv pname', pname);
        const src = requireNonNull(params);
        if (this.compiling === null) this.state.setLightVector(i, pname, src, params_offset);
        else this.compiling.commands.push(this.state.setLightVector.bind(this.state, i, pname, this.floatArgument(src, params_offset, 4), 0));
    }

    // javax.media.opengl.GL.glLoadIdentity()V
    glLoadIdentity(): void {
        if (this.compiling === null) this.state.loadIdentity();
        else this.compiling.commands.push(this.state.loadIdentity.bind(this.state));
    }

    // javax.media.opengl.GL.glLoadMatrixf([FI)V
    glLoadMatrixf(m: Float32Array | null, m_offset: number): void {
        checkArrayOffset(m, m_offset, 'm_offset');
        const src = requireNonNull(m);
        if (this.compiling === null) this.state.loadMatrix(src, m_offset);
        else this.compiling.commands.push(this.state.loadMatrix.bind(this.state, this.floatArgument(src, m_offset, 16), 0));
    }

    // javax.media.opengl.GL.glMatrixMode(I)V
    glMatrixMode(mode: GLenum): void {
        if (mode !== E.GL_MODELVIEW && mode !== E.GL_PROJECTION && mode !== E.GL_TEXTURE) throw unsupported('glMatrixMode', mode);
        if (this.compiling === null) this.state.setMatrixMode(mode);
        else this.compiling.commands.push(this.state.setMatrixMode.bind(this.state, mode));
    }

    // javax.media.opengl.GL.glMultiTexCoord2f(IFF)V
    glMultiTexCoord2f(target: GLenum, s: GLfloat, t: GLfloat): void {
        this.checkAvailable('glMultiTexCoord2f');
        const unit = this.unitOf(target, 'glMultiTexCoord2f');
        const ss = Math.fround(s),
            tt = Math.fround(t);
        if (this.compiling === null) this.setTexCoord(unit, ss, tt);
        else this.compiling.commands.push(this.setTexCoord.bind(this, unit, ss, tt));
    }

    private setTexCoord(unit: number, s: number, t: number): void {
        if (unit >= this.state.unitCount) {
            this.state.setError(E.GL_INVALID_ENUM);
            return;
        }
        const coord = this.state.units[unit].texCoord;
        this.state.uniformRevision++;
        coord[0] = s;
        coord[1] = t;
        coord[2] = 0;
        coord[3] = 1;
    }

    // javax.media.opengl.GL.glNewList(II)V
    glNewList(list: GLuint, mode: GLenum): void {
        if (mode === E.GL_COMPILE_AND_EXECUTE) throw unsupported('glNewList mode', mode);
        if (mode !== E.GL_COMPILE) {
            this.state.setError(E.GL_INVALID_ENUM);
            return;
        }
        if (list === 0) {
            this.state.setError(E.GL_INVALID_VALUE);
            return;
        }
        if (this.compiling !== null) {
            this.state.setError(E.GL_INVALID_OPERATION);
            return;
        }
        this.compiling = { name: list, commands: [] };
    }

    // javax.media.opengl.GL.glNormalPointer(IILjava/nio/Buffer;)V
    glNormalPointer(type: GLenum, stride: GLsizei, ptr: Buffer | null): void;
    // javax.media.opengl.GL.glNormalPointer(IIJ)V
    glNormalPointer(type: GLenum, stride: GLsizei, ptr_buffer_offset: bigint): void;
    glNormalPointer(type: GLenum, stride: GLsizei, ptr: Buffer | null | bigint): void {
        this.checkPointer('glNormalPointer', 3, type, NORMAL_POINTER_SIZES, FLOAT_POINTER_TYPES);
        this.setPointer(this.state.normalArray, 3, type, stride, ptr);
    }

    // javax.media.opengl.GL.glOrtho(DDDDDD)V
    glOrtho(left: GLdouble, right: GLdouble, bottom: GLdouble, top: GLdouble, zNear: GLdouble, zFar: GLdouble): void {
        this.emit(() => this.state.ortho(left, right, bottom, top, zNear, zFar));
    }

    // javax.media.opengl.GL.glPixelStorei(II)V
    // Client state: not compiled. The packed pixel blit uses byte swapping. Bitmaps are outside the inventory.
    glPixelStorei(pname: GLenum, param: GLint): void {
        if (!PIXEL_STORE.has(pname)) throw unsupported('glPixelStorei pname', pname);
        if (pname === E.GL_UNPACK_LSB_FIRST && param !== 0) throw unsupported('glPixelStorei(' + pname + ')', param);
        if (pname === E.GL_UNPACK_SWAP_BYTES) {
            this.state.pixelStore.set(pname, param === 0 ? 0 : 1);
            return;
        }
        if (pname === E.GL_UNPACK_ALIGNMENT || pname === E.GL_PACK_ALIGNMENT) {
            if (param !== 1 && param !== 2 && param !== 4 && param !== 8) {
                this.state.setError(E.GL_INVALID_VALUE);
                return;
            }
        } else if (param < 0) {
            this.state.setError(E.GL_INVALID_VALUE);
            return;
        }
        this.state.pixelStore.set(pname, param);
    }

    // javax.media.opengl.GL.glPixelZoom(FF)V
    glPixelZoom(xfactor: GLfloat, yfactor: GLfloat): void {
        const x = Math.fround(xfactor),
            y = Math.fround(yfactor);
        this.emit(() => {
            this.state.pixelZoomX = x;
            this.state.pixelZoomY = y;
        });
    }

    // javax.media.opengl.GL.glPointParameterfARB(IF)V
    // Recorded with no effect on rendering: the jar draws no points (HD_PLAN 2.3).
    glPointParameterfARB(pname: GLenum, param: GLfloat): void {
        this.checkAvailable('glPointParameterfARB');
        this.pointParameter(pname, Math.fround(param));
    }

    private pointParameter(pname: number, v: number): void {
        if (pname !== E.GL_POINT_SIZE_MIN && pname !== E.GL_POINT_SIZE_MAX && pname !== E.GL_POINT_FADE_THRESHOLD_SIZE) throw unsupported('point parameter', pname);
        this.emit(() => {
            if (v < 0) {
                this.state.setError(E.GL_INVALID_VALUE);
                return;
            }
            if (pname === E.GL_POINT_SIZE_MIN) this.state.pointSizeMin = v;
            else if (pname === E.GL_POINT_SIZE_MAX) this.state.pointSizeMax = v;
            else this.state.pointFadeThreshold = v;
        });
    }

    // javax.media.opengl.GL.glPointParameterfvARB(I[FI)V
    glPointParameterfvARB(pname: GLenum, v: Float32Array | null, v_offset: number): void {
        checkArrayOffset(v, v_offset, 'v_offset');
        this.checkAvailable('glPointParameterfvARB');
        if (pname === E.GL_POINT_DISTANCE_ATTENUATION) {
            const a = this.floatArgument(requireNonNull(v), v_offset, 3);
            this.emit(() => this.state.pointDistanceAttenuation.set(a));
            return;
        }
        this.pointParameter(pname, this.floatArgument(requireNonNull(v), v_offset, 1)[0]);
    }

    // javax.media.opengl.GL.glPolygonMode(II)V
    glPolygonMode(face: GLenum, mode: GLenum): void {
        if (face !== E.GL_FRONT) throw unsupported('glPolygonMode face', face);
        if (mode !== E.GL_FILL) throw unsupported('glPolygonMode mode', mode);
        this.emit(() => {
            this.state.polygonModeFront = mode;
        });
    }

    // javax.media.opengl.GL.glPopAttrib()V
    glPopAttrib(): void {
        this.emit(() => this.state.popAttrib());
    }

    // javax.media.opengl.GL.glPopMatrix()V
    glPopMatrix(): void {
        if (this.compiling === null) this.state.popMatrix();
        else this.compiling.commands.push(this.state.popMatrix.bind(this.state));
    }

    // javax.media.opengl.GL.glProgramLocalParameter4fARB(IIFFFF)V
    glProgramLocalParameter4fARB(target: GLenum, index: GLuint, x: GLfloat, y: GLfloat, z: GLfloat, w: GLfloat): void {
        this.checkAvailable('glProgramLocalParameter4fARB');
        if (target !== E.GL_VERTEX_PROGRAM_ARB) throw unsupported('glProgramLocalParameter4fARB target', target);
        if (this.compiling !== null) {
            this.compiling.commands.push(this.execProgramLocal.bind(this, index, Float32Array.of(x, y, z, w)));
        } else {
            const v = this.programLocalScratch;
            v[0] = x;
            v[1] = y;
            v[2] = z;
            v[3] = w;
            this.execProgramLocal(index, v);
        }
    }

    private execProgramLocal(index: number, v: Float32Array): void {
        if (index < 0 || index >= PROGRAM_LOCAL_PARAMETERS) {
            this.state.setError(E.GL_INVALID_VALUE);
            return;
        }
        this.boundProgram().local.set(v, index * 4);
        this.state.uniformRevision++;
    }

    // javax.media.opengl.GL.glProgramLocalParameter4fvARB(IILjava/nio/FloatBuffer;)V
    glProgramLocalParameter4fvARB(target: GLenum, index: GLuint, params: FloatBuffer | null): void;
    // javax.media.opengl.GL.glProgramLocalParameter4fvARB(II[FI)V
    glProgramLocalParameter4fvARB(target: GLenum, index: GLuint, params: Float32Array | null, params_offset: number): void;
    glProgramLocalParameter4fvARB(target: GLenum, index: GLuint, params: FloatBuffer | Float32Array | null, params_offset?: number): void {
        if (params_offset !== undefined) checkArrayOffset(params instanceof FloatBuffer ? null : params, params_offset, 'params_offset');
        this.checkAvailable('glProgramLocalParameter4fvARB');
        if (target !== E.GL_VERTEX_PROGRAM_ARB) throw unsupported('glProgramLocalParameter4fvARB target', target);
        let v: Float32Array;
        if (params_offset === undefined) {
            // The FloatBuffer form reads 4 floats as stored from the buffer's position (GL's byte view).
            const buffer = requireNonNull(params instanceof Float32Array ? null : params);
            const pos = buffer.position();
            const remaining = (buffer.capacity() - pos) * 4;
            if (remaining < 16) throw new RangeError('GL read 4 floats from a buffer holding ' + remaining + ' bytes');
            const bytes = bufferByteView(buffer, pos, pos + 4);
            if (this.compiling !== null) v = new Float32Array(bytes.slice().buffer);
            else {
                this.programLocalBytes.set(bytes);
                v = this.programLocalScratch;
            }
        } else {
            v = this.floatArgument(requireNonNull(params instanceof FloatBuffer ? null : params), params_offset, 4);
        }
        if (this.compiling !== null) this.compiling.commands.push(this.execProgramLocal.bind(this, index, v));
        else this.execProgramLocal(index, v);
    }

    // javax.media.opengl.GL.glProgramStringARB(IIILjava/lang/String;)V
    // Only the jar's water program (rd.f()V) loads: the driver runs a hand translation of it (HD_PLAN 2.3), checked by
    // the SHA-256 of the string's UTF-8 bytes. PROGRAM_ERROR_POSITION_ARB stays -1.
    glProgramStringARB(target: GLenum, format: GLenum, len: GLsizei, string: string | null): void {
        this.checkAvailable('glProgramStringARB');
        if (target !== E.GL_VERTEX_PROGRAM_ARB) throw unsupported('glProgramStringARB target', target);
        if (format !== E.GL_PROGRAM_FORMAT_ASCII_ARB) throw unsupported('glProgramStringARB format', format);
        const source = requireNonNull(string);
        const bytes = javaUtf8Bytes(source);
        if (len !== bytes.length || sha256Hex(bytes) !== WATER_PROGRAM_SHA256) {
            throw new GlUnsupported('glProgramStringARB accepts only the shipped water program (sha256 ' + WATER_PROGRAM_SHA256 + ')');
        }
        this.emit(() => {
            this.boundProgram().source = source;
        });
    }

    // javax.media.opengl.GL.glPushAttrib(I)V
    glPushAttrib(mask: GLbitfield): void {
        if ((mask & ~(E.GL_ENABLE_BIT | E.GL_FOG_BIT)) !== 0 || mask === 0) throw unsupported('glPushAttrib mask', mask);
        this.emit(() => this.state.pushAttrib(mask));
    }

    // javax.media.opengl.GL.glPushMatrix()V
    glPushMatrix(): void {
        if (this.compiling === null) this.state.pushMatrix();
        else this.compiling.commands.push(this.state.pushMatrix.bind(this.state));
    }

    // javax.media.opengl.GL.glRasterPos2i(II)V
    glRasterPos2i(x: GLint, y: GLint): void {
        this.emit(() => {
            if (this.state.isEnabled(E.GL_VERTEX_PROGRAM_ARB)) throw notYet('H2', 'glRasterPos2i under an ARB vertex program');
            this.state.setRasterPos(x, y, 0, 1);
        });
    }

    // javax.media.opengl.GL.glReadBuffer(I)V
    glReadBuffer(mode: GLenum): void {
        if (mode !== E.GL_FRONT && mode !== E.GL_BACK && mode !== E.GL_FRONT_LEFT && mode !== E.GL_BACK_LEFT) throw unsupported('glReadBuffer', mode);
        this.emit(() => {
            this.state.readBuffer = mode;
        });
    }

    // javax.media.opengl.GL.glRotatef(FFFF)V
    glRotatef(angle: GLfloat, x: GLfloat, y: GLfloat, z: GLfloat): void {
        if (this.compiling === null) this.state.rotate(angle, x, y, z);
        else this.compiling.commands.push(this.state.rotate.bind(this.state, angle, x, y, z));
    }

    // javax.media.opengl.GL.glScalef(FFF)V
    glScalef(x: GLfloat, y: GLfloat, z: GLfloat): void {
        if (this.compiling === null) this.state.scale(x, y, z);
        else this.compiling.commands.push(this.state.scale.bind(this.state, x, y, z));
    }

    // javax.media.opengl.GL.glScissor(IIII)V
    glScissor(x: GLint, y: GLint, width: GLsizei, height: GLsizei): void {
        this.emit(() => {
            if (width < 0 || height < 0) {
                this.state.setError(E.GL_INVALID_VALUE);
                return;
            }
            this.state.scissor.set([x, y, width, height]);
        });
    }

    // javax.media.opengl.GL.glShadeModel(I)V
    glShadeModel(mode: GLenum): void {
        if (mode !== E.GL_SMOOTH) throw unsupported('glShadeModel', mode);
        this.emit(() => {
            this.state.shadeModel = mode;
        });
    }

    // javax.media.opengl.GL.glTexCoord2f(FF)V
    glTexCoord2f(s: GLfloat, t: GLfloat): void {
        const ss = Math.fround(s),
            tt = Math.fround(t);
        if (this.compiling === null) this.setTexCoord(0, ss, tt);
        else this.compiling.commands.push(this.setTexCoord.bind(this, 0, ss, tt));
    }

    // javax.media.opengl.GL.glTexCoordPointer(IIILjava/nio/Buffer;)V
    glTexCoordPointer(size: GLint, type: GLenum, stride: GLsizei, ptr: Buffer | null): void;
    // javax.media.opengl.GL.glTexCoordPointer(IIIJ)V
    glTexCoordPointer(size: GLint, type: GLenum, stride: GLsizei, ptr_buffer_offset: bigint): void;
    glTexCoordPointer(size: GLint, type: GLenum, stride: GLsizei, ptr: Buffer | null | bigint): void {
        this.checkPointer('glTexCoordPointer', size, type, TEXCOORD_POINTER_SIZES, FLOAT_POINTER_TYPES);
        this.setPointer(this.state.texCoordArrays[this.state.clientActiveTexture], size, type, stride, ptr);
    }

    // javax.media.opengl.GL.glTexEnvf(IIF)V
    glTexEnvf(target: GLenum, pname: GLenum, param: GLfloat): void {
        this.checkTexEnvTarget(target);
        const v = Math.fround(param);
        if (pname === E.GL_RGB_SCALE || pname === E.GL_ALPHA_SCALE) {
            this.emit(() => this.state.setTexEnvScale(pname, v));
            return;
        }
        this.glTexEnvi(target, pname, v | 0);
    }

    // javax.media.opengl.GL.glTexEnvfv(II[FI)V
    glTexEnvfv(target: GLenum, pname: GLenum, params: Float32Array | null, params_offset: number): void {
        checkArrayOffset(params, params_offset, 'params_offset');
        this.checkTexEnvTarget(target);
        const array = requireNonNull(params);
        if (pname === E.GL_TEXTURE_ENV_COLOR) {
            if (this.compiling === null) this.state.setTexEnvColor(array, params_offset);
            else this.compiling.commands.push(this.state.setTexEnvColor.bind(this.state, this.floatArgument(array, params_offset, 4), 0));
            return;
        }
        this.glTexEnvf(target, pname, this.floatArgument(array, params_offset, 1)[0]);
    }

    // javax.media.opengl.GL.glTexEnvi(III)V
    glTexEnvi(target: GLenum, pname: GLenum, param: GLint): void {
        this.checkTexEnvTarget(target);
        this.checkTexEnvEnum(pname, param);
        if (this.compiling === null) this.state.setTexEnvEnum(pname, param);
        else this.compiling.commands.push(this.state.setTexEnvEnum.bind(this.state, pname, param));
    }

    // javax.media.opengl.GL.glTexGenfv(II[FI)V
    glTexGenfv(coord: GLenum, pname: GLenum, params: Float32Array | null, params_offset: number): void {
        checkArrayOffset(params, params_offset, 'params_offset');
        const c = this.texGenCoord(coord);
        if (pname !== E.GL_OBJECT_PLANE && pname !== E.GL_EYE_PLANE) throw unsupported('glTexGenfv pname', pname);
        const src = requireNonNull(params);
        // EYE_PLANE uses the matrix at execution. Only a list retains the input plane.
        if (this.compiling === null) this.state.setTexGenPlane(c, pname, src, params_offset);
        else this.compiling.commands.push(this.state.setTexGenPlane.bind(this.state, c, pname, this.floatArgument(src, params_offset, 4), 0));
    }

    // javax.media.opengl.GL.glTexGeni(III)V
    glTexGeni(coord: GLenum, pname: GLenum, param: GLint): void {
        const c = this.texGenCoord(coord);
        if (pname !== E.GL_TEXTURE_GEN_MODE) throw unsupported('glTexGeni pname', pname);
        if (param !== E.GL_OBJECT_LINEAR && param !== E.GL_EYE_LINEAR && param !== E.GL_NORMAL_MAP) throw unsupported('TEXTURE_GEN_MODE', param);
        this.emit(() => {
            if (param === E.GL_NORMAL_MAP && c === 3) {
                this.state.setError(E.GL_INVALID_ENUM);
                return;
            }
            this.state.unit.gen[c].mode = param;
            this.state.uniformRevision++;
        });
    }

    // javax.media.opengl.GL.glTexImage1D(IIIIIIILjava/nio/Buffer;)V
    glTexImage1D(target: GLenum, level: GLint, internalformat: GLint, width: GLsizei, border: GLint, format: GLenum, type: GLenum, pixels: Buffer | null): void {
        if (this.proxyImage(target, level, border, width, 1, 1)) return;
        if (target !== E.GL_TEXTURE_1D) throw unsupported('glTexImage1D target', target);
        this.texImage(target, level, internalformat, width, 1, 1, border, format, type, pixels);
    }

    // javax.media.opengl.GL.glTexImage2D(IIIIIIIILjava/nio/Buffer;)V
    glTexImage2D(target: GLenum, level: GLint, internalformat: GLint, width: GLsizei, height: GLsizei, border: GLint, format: GLenum, type: GLenum, pixels: Buffer | null): void {
        if (this.proxyImage(target, level, border, width, height, 1)) return;
        if (target !== E.GL_TEXTURE_2D && !isCubeFace(target)) throw unsupported('glTexImage2D target', target);
        this.texImage(target, level, internalformat, width, height, 1, border, format, type, pixels);
    }

    // javax.media.opengl.GL.glTexImage3D(IIIIIIIIILjava/nio/Buffer;)V
    glTexImage3D(target: GLenum, level: GLint, internalformat: GLint, width: GLsizei, height: GLsizei, depth: GLsizei, border: GLint, format: GLenum, type: GLenum, pixels: Buffer | null): void {
        this.checkAvailable('glTexImage3D');
        if (this.proxyImage(target, level, border, width, height, depth)) return;
        if (target !== E.GL_TEXTURE_3D) throw unsupported('glTexImage3D target', target);
        this.texImage(target, level, internalformat, width, height, depth, border, format, type, pixels);
    }

    // A non-proxy image specification. The client bytes are unpacked now (pixel store current at the call), so a
    // compiled glTexImage keeps the image as it was when compiled, as GL does.
    private texImage(target: number, level: number, internalformat: number, width: number, height: number, depth: number, border: number, format: number, type: number, pixels: Buffer | null): void {
        const base = baseFormat(internalformat);
        if (type !== E.GL_UNSIGNED_BYTE) throw unsupported('texture pixel type', type);
        const components = componentCount(format);
        if (border !== 0) throw unsupported('texture border', border);
        if (level < 0 || width < 0 || height < 0 || depth < 0 || (isCubeFace(target) && width !== height)) {
            this.state.setError(E.GL_INVALID_VALUE);
            return;
        }
        const s = this.state.pixelStore;
        const unpack = {
            alignment: requireNonNull(s.get(E.GL_UNPACK_ALIGNMENT)),
            rowLength: requireNonNull(s.get(E.GL_UNPACK_ROW_LENGTH)),
            skipRows: requireNonNull(s.get(E.GL_UNPACK_SKIP_ROWS)),
            skipPixels: requireNonNull(s.get(E.GL_UNPACK_SKIP_PIXELS))
        };
        const source = pixels === null ? null : clientBytes(pixels);
        // Ground shadows repeatedly redefine a tightly packed level from the same 128x128 scratch buffer.
        // Display lists and in-flight textures still need a private snapshot of the specified pixels.
        if (source !== null && this.compiling === null && this.host !== null && target === E.GL_TEXTURE_2D && level === 0 && format === base) {
            const stride = width * components;
            if ((unpack.rowLength === 0 || unpack.rowLength === width) && unpack.skipRows === 0 && unpack.skipPixels === 0 && stride % unpack.alignment === 0 && source.length >= stride * height) {
                if (this.boundTexture(E.GL_TEXTURE_2D).updateResident2D(this.host.gpu, width, height, internalformat, stride, source)) return;
            }
        }
        const data = source === null ? new Uint8Array(width * height * depth * componentCount(base)) : convertPixels(unpackImage(source, width, height, depth, components, unpack), format, base);
        const image: LevelImage = { width, height, depth, border, internalFormat: internalformat, base, data };
        this.emit(() => {
            const objTarget: TextureTarget = isCubeFace(target) ? E.GL_TEXTURE_CUBE_MAP : (target as TextureTarget);
            this.boundTexture(objTarget).setImage(isCubeFace(target) ? cubeFaceIndex(target) : 0, level, image);
        });
    }

    // javax.media.opengl.GL.glTexParameteri(III)V
    glTexParameteri(target: GLenum, pname: GLenum, param: GLint): void {
        this.checkTexParameter(target, pname, param);
        this.emit(() => this.boundTexture(target as TextureTarget).setParameter(pname, param));
    }

    // javax.media.opengl.GL.glTranslatef(FFF)V
    glTranslatef(x: GLfloat, y: GLfloat, z: GLfloat): void {
        if (this.compiling === null) this.state.translate(x, y, z);
        else this.compiling.commands.push(this.state.translate.bind(this.state, x, y, z));
    }

    // javax.media.opengl.GL.glVertex2f(FF)V
    glVertex2f(x: GLfloat, y: GLfloat): void {
        const xx = Math.fround(x),
            yy = Math.fround(y);
        if (this.compiling === null) this.immediate.vertex(xx, yy, this.state);
        else this.compiling.commands.push(this.immediate.vertex.bind(this.immediate, xx, yy, this.state));
    }

    // javax.media.opengl.GL.glVertexPointer(IIILjava/nio/Buffer;)V
    glVertexPointer(size: GLint, type: GLenum, stride: GLsizei, ptr: Buffer | null): void;
    // javax.media.opengl.GL.glVertexPointer(IIIJ)V
    glVertexPointer(size: GLint, type: GLenum, stride: GLsizei, ptr_buffer_offset: bigint): void;
    glVertexPointer(size: GLint, type: GLenum, stride: GLsizei, ptr: Buffer | null | bigint): void {
        this.checkPointer('glVertexPointer', size, type, VERTEX_POINTER_SIZES, FLOAT_POINTER_TYPES);
        this.setPointer(this.state.vertexArray, size, type, stride, ptr);
    }

    // javax.media.opengl.GL.glViewport(IIII)V
    glViewport(x: GLint, y: GLint, width: GLsizei, height: GLsizei): void {
        this.emit(() => {
            if (width < 0 || height < 0) {
                this.state.setError(E.GL_INVALID_VALUE);
                return;
            }
            this.state.viewport.set([x, y, width, height]);
            this.state.uniformRevision++;
        });
    }

    // javax.media.opengl.GL.isExtensionAvailable(Ljava/lang/String;)Z
    isExtensionAvailable(glExtensionName: string | null): boolean {
        return profileHasExtension(this.profile, glExtensionName);
    }

    // javax.media.opengl.GL.setSwapInterval(I)V
    setSwapInterval(interval: number): void {
        this.swapInterval = interval;
    }
}
