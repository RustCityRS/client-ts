import type Buffer from '#/util/nio/Buffer';
import FloatBuffer from '#/util/nio/FloatBuffer';
import type GLCapabilities from '#/jogl/GLCapabilities';
import type GLCapabilitiesChooser from '#/jogl/GLCapabilitiesChooser';
import GLContext from '#/jogl/GLContext';
import type GLDrawable from '#/jogl/GLDrawable';
import GLDrawableFactory from '#/jogl/GLDrawableFactory';
import type { GL, GLbitfield, GLboolean, GLclampd, GLclampf, GLdouble, GLenum, GLfloat, GLint, GLintptrARB, GLsizei, GLsizeiptrARB, GLubyte, GLuint } from '#/jogl/GL';
import {
    encodeBool,
    encodeBuffer,
    encodeByte,
    encodeCaps,
    encodeDouble,
    encodeFloat,
    encodeFloatArray,
    encodeInt,
    encodeIntArray,
    encodeLong,
    encodeString,
    entryRule,
    evalCount,
    type GlTraceWriter,
    type IntElem,
    isInt32,
    type NameKind,
    type RefKind,
    type ReturnRole,
    type Role,
    throwKind,
    type TraceValue
} from './GlTrace';

// RecordingGL: a GL decorator that forwards every call to an inner GL and appends one GLTrace v1 record per call
// (src/gl/GLTRACE.md). Not a Java class; the Java side of the same format is Codex's GlRecorder.java.
// RecordingGLDrawableFactory, RecordingGLDrawable and RecordingGLContext record the context calls of
// GLTRACE.md section 10. Typical use:
//
//   const writer = new GlTraceWriter();
//   registerGLDrawableFactory(() => new RecordingGLDrawableFactory(new NullGLDrawableFactory(profile), writer));
//   ... run the client ...; writer.text()
//
// or, for a unit oracle that installs the GL directly: tf.t = new RecordingGL(new NullGL(profile), writer).
//
// Recording never changes behaviour: the ~gl marker (if due) is appended and the inputs are serialized before the
// inner call, outputs and the return value after it, the record is appended when the call returns or throws, and a
// throw is rethrown unchanged. The
// encoders are total, so a value of the wrong TS type becomes a slip token instead of an exception.

export interface RecordingOptions {
    // Append a '#@ <frames>' stack line to each record (informational; never compared).
    readonly stacks?: boolean;
}

const NO_THROW: unique symbol = Symbol('no throw');

function isOutput(role: Role): boolean {
    return role.r === 'out-f' || role.r === 'out-i' || role.r === 'out-names' || role.r === 'out-buf';
}

function plainInt(v: number): IntElem {
    return { t: 'int', v };
}

function encodeName(writer: GlTraceWriter, kind: NameKind, value: unknown): TraceValue {
    return isInt32(value) ? writer.nameValue(kind, value) : encodeInt(value);
}

function encodeRef(writer: GlTraceWriter, kind: RefKind, value: unknown): TraceValue {
    if (value === null || typeof value === 'object') return writer.refValue(kind, value);
    return { t: 'slip', form: 'R?', text: typeof value };
}

function encodeInput(writer: GlTraceWriter, role: Role, args: readonly unknown[], i: number): TraceValue {
    const v = args[i];
    switch (role.r) {
        case 'int':
            return encodeInt(v);
        case 'float':
            return encodeFloat(v);
        case 'double':
            return encodeDouble(v);
        case 'bool':
            return encodeBool(v);
        case 'byte':
            return encodeByte(v);
        case 'long':
            return encodeLong(v);
        case 'string':
            return encodeString(v, writer.blobs);
        case 'caps':
            return encodeCaps(v);
        case 'buf':
            return encodeBuffer(v, null, writer.blobs);
        case 'buf-n':
            return encodeBuffer(v, evalCount(role.count, args), writer.blobs);
        case 'name':
            return encodeName(writer, role.kind, v);
        case 'ref':
            return encodeRef(writer, role.kind, v);
        case 'in-f':
            return encodeFloatArray(v, args[i + 1], evalCount(role.count, args));
        case 'in-names': {
            const kind = role.kind;
            return encodeIntArray(v, args[i + 1], evalCount(role.count, args), raw => writer.nameValue(kind, raw));
        }
        case 'out-f':
        case 'out-i':
        case 'out-names':
        case 'out-buf':
            throw new Error('output role ' + role.r);
    }
}

function encodeOutput(writer: GlTraceWriter, role: Role, args: readonly unknown[], i: number, returned: boolean): TraceValue {
    const v = args[i];
    switch (role.r) {
        case 'out-f':
            return encodeFloatArray(v, args[i + 1], evalCount(role.count, args));
        case 'out-i':
            return encodeIntArray(v, args[i + 1], evalCount(role.count, args), plainInt);
        case 'out-names': {
            const kind = role.kind;
            // Allocation happens only when the call returned normally (GLTRACE.md section 9).
            return encodeIntArray(v, args[i + 1], evalCount(role.count, args), returned ? raw => writer.allocName(kind, raw) : raw => writer.nameValue(kind, raw));
        }
        case 'out-buf':
            return encodeBuffer(v, evalCount(role.count, args), writer.blobs);
        default:
            throw new Error('input role ' + role.r);
    }
}

function encodeReturn(writer: GlTraceWriter, role: ReturnRole, result: unknown, args: readonly unknown[]): TraceValue | null {
    switch (role.r) {
        case 'void':
            return null;
        case 'int':
            return encodeInt(result);
        case 'bool':
            return encodeBool(result);
        case 'string':
            return encodeString(result, writer.blobs);
        case 'ref':
            return encodeRef(writer, role.kind, result);
        case 'alloc-lists': {
            if (!isInt32(result)) return encodeInt(result);
            const range = args[role.arg];
            if (result === 0 || !isInt32(range) || range <= 0) return writer.nameValue('L', result);
            const base = writer.allocName('L', result);
            for (let k = 1; k < range; k++) writer.allocName('L', (result + k) | 0);
            return base;
        }
    }
}

// The live-set effect of a deletion record whose call returned normally (GLTRACE.md section 17).
function applyDeletion(writer: GlTraceWriter, params: readonly Role[], args: readonly unknown[]): void {
    for (let i = 0; i < params.length; i++) {
        const role = params[i];
        if (role.r === 'in-names') {
            const arr = args[i];
            const off = args[i + 1];
            if (!(arr instanceof Int32Array) || !isInt32(off) || off < 0) continue;
            const n = evalCount(role.count, args);
            for (let k = 0; k < n && off + k < arr.length; k++) writer.deleteName(role.kind, arr[off + k]);
        } else if (role.r === 'name') {
            // glDeleteLists(list, range) deletes list .. list + range - 1.
            const list = args[i];
            const range = args[i + 1];
            if (!isInt32(list) || !isInt32(range)) continue;
            for (let k = 0; k < range; k++) writer.deleteName(role.kind, (list + k) | 0);
        }
    }
}

const SKIP_FRAME = /RecordingGL\.ts|GlTrace\.ts/;

function captureStack(): string {
    const lines = (new Error().stack ?? '').split('\n').slice(1);
    const frames: string[] = [];
    for (const line of lines) {
        if (SKIP_FRAME.test(line)) continue;
        const m = /^\s*at\s+(?:async\s+)?([^\s(]+)?/.exec(line);
        if (m === null) continue;
        frames.push((m[1] ?? '<anonymous>').replace(/[^\x21-\x7e]/g, '_'));
        if (frames.length === 8) break;
    }
    return frames.length === 0 ? '?' : frames.join(' < ');
}

// Records one call through its GLTrace rule. `receiver` fills the receiver column of a context-API entry; `gl` is
// the GL object for the ~gl marker (null for context-API entries).
export function recordCall<R>(writer: GlTraceWriter, receiver: object | null, gl: object | null, entry: string, descriptor: string, args: readonly unknown[], invoke: () => R, options: RecordingOptions = {}): R {
    const rule = entryRule(entry, descriptor);
    // The ~gl marker is decided and appended here, before the columns and before the inner call, as GlRecorder.java
    // does (GLTRACE.md section 10): in a reentrant call the outer call's marker precedes the inner call's records.
    if (gl !== null && !rule.deletion) writer.noteGL(gl);
    const cols: TraceValue[] = [];
    if (rule.receiver !== null) cols.push(encodeRef(writer, rule.receiver, receiver));
    const base = cols.length;
    const outputs: number[] = [];
    for (let i = 0; i < rule.params.length; i++) {
        const role = rule.params[i];
        if (isOutput(role)) {
            outputs.push(i);
            cols.push({ t: 'null' });
        } else {
            cols.push(encodeInput(writer, role, args, i));
        }
    }
    let result: R | typeof NO_THROW = NO_THROW;
    let thrown: unknown = NO_THROW;
    try {
        result = invoke();
    } catch (e) {
        thrown = e;
    }
    const returned = thrown === NO_THROW;
    for (const i of outputs) cols[base + i] = encodeOutput(writer, rule.params[i], args, i, returned);
    if (returned && rule.deletion) applyDeletion(writer, rule.params, args);
    const ret = returned ? encodeReturn(writer, rule.ret, result, args) : null;
    writer.append(entry, cols, ret, returned ? null : throwKind(thrown), rule.deletion, rule.endsFrame, options.stacks === true ? captureStack() : null);
    if (!returned) throw thrown;
    return result as R;
}

export default class RecordingGL implements GL {
    readonly inner: GL;
    readonly writer: GlTraceWriter;
    private readonly options: RecordingOptions;

    constructor(inner: GL, writer: GlTraceWriter, options: RecordingOptions = {}) {
        this.inner = inner;
        this.writer = writer;
        this.options = options;
    }

    private rec<R>(entry: string, descriptor: string, args: readonly unknown[], invoke: () => R): R {
        return recordCall(this.writer, null, this, entry, descriptor, args, invoke, this.options);
    }

    // javax.media.opengl.GL.glActiveTexture(I)V
    glActiveTexture(texture: GLenum): void {
        return this.rec('glActiveTexture', '(I)V', [texture], () => this.inner.glActiveTexture(texture));
    }

    // javax.media.opengl.GL.glAlphaFunc(IF)V
    glAlphaFunc(func: GLenum, ref: GLclampf): void {
        return this.rec('glAlphaFunc', '(IF)V', [func, ref], () => this.inner.glAlphaFunc(func, ref));
    }

    // javax.media.opengl.GL.glBegin(I)V
    glBegin(mode: GLenum): void {
        return this.rec('glBegin', '(I)V', [mode], () => this.inner.glBegin(mode));
    }

    // javax.media.opengl.GL.glBindBufferARB(II)V
    glBindBufferARB(target: GLenum, buffer: GLuint): void {
        return this.rec('glBindBufferARB', '(II)V', [target, buffer], () => this.inner.glBindBufferARB(target, buffer));
    }

    // javax.media.opengl.GL.glBindProgramARB(II)V
    glBindProgramARB(target: GLenum, program: GLuint): void {
        return this.rec('glBindProgramARB', '(II)V', [target, program], () => this.inner.glBindProgramARB(target, program));
    }

    // javax.media.opengl.GL.glBindTexture(II)V
    glBindTexture(target: GLenum, texture: GLuint): void {
        return this.rec('glBindTexture', '(II)V', [target, texture], () => this.inner.glBindTexture(target, texture));
    }

    // javax.media.opengl.GL.glBlendFunc(II)V
    glBlendFunc(sfactor: GLenum, dfactor: GLenum): void {
        return this.rec('glBlendFunc', '(II)V', [sfactor, dfactor], () => this.inner.glBlendFunc(sfactor, dfactor));
    }

    // javax.media.opengl.GL.glBufferDataARB(IILjava/nio/Buffer;I)V
    glBufferDataARB(target: GLenum, size: GLsizeiptrARB, data: Buffer | null, usage: GLenum): void {
        return this.rec('glBufferDataARB', '(IILjava/nio/Buffer;I)V', [target, size, data, usage], () => this.inner.glBufferDataARB(target, size, data, usage));
    }

    // javax.media.opengl.GL.glBufferSubDataARB(IIILjava/nio/Buffer;)V
    glBufferSubDataARB(target: GLenum, offset: GLintptrARB, size: GLsizeiptrARB, data: Buffer | null): void {
        return this.rec('glBufferSubDataARB', '(IIILjava/nio/Buffer;)V', [target, offset, size, data], () => this.inner.glBufferSubDataARB(target, offset, size, data));
    }

    // javax.media.opengl.GL.glCallList(I)V
    glCallList(list: GLuint): void {
        return this.rec('glCallList', '(I)V', [list], () => this.inner.glCallList(list));
    }

    // javax.media.opengl.GL.glClear(I)V
    glClear(mask: GLbitfield): void {
        return this.rec('glClear', '(I)V', [mask], () => this.inner.glClear(mask));
    }

    // javax.media.opengl.GL.glClearColor(FFFF)V
    glClearColor(red: GLclampf, green: GLclampf, blue: GLclampf, alpha: GLclampf): void {
        return this.rec('glClearColor', '(FFFF)V', [red, green, blue, alpha], () => this.inner.glClearColor(red, green, blue, alpha));
    }

    // javax.media.opengl.GL.glClearDepth(D)V
    glClearDepth(depth: GLclampd): void {
        return this.rec('glClearDepth', '(D)V', [depth], () => this.inner.glClearDepth(depth));
    }

    // javax.media.opengl.GL.glClientActiveTexture(I)V
    glClientActiveTexture(texture: GLenum): void {
        return this.rec('glClientActiveTexture', '(I)V', [texture], () => this.inner.glClientActiveTexture(texture));
    }

    // javax.media.opengl.GL.glColor3ub(BBB)V
    glColor3ub(red: GLubyte, green: GLubyte, blue: GLubyte): void {
        return this.rec('glColor3ub', '(BBB)V', [red, green, blue], () => this.inner.glColor3ub(red, green, blue));
    }

    // javax.media.opengl.GL.glColor4f(FFFF)V
    glColor4f(red: GLfloat, green: GLfloat, blue: GLfloat, alpha: GLfloat): void {
        return this.rec('glColor4f', '(FFFF)V', [red, green, blue, alpha], () => this.inner.glColor4f(red, green, blue, alpha));
    }

    // javax.media.opengl.GL.glColor4fv([FI)V
    glColor4fv(v: Float32Array | null, v_offset: number): void {
        return this.rec('glColor4fv', '([FI)V', [v, v_offset], () => this.inner.glColor4fv(v, v_offset));
    }

    // javax.media.opengl.GL.glColor4ub(BBBB)V
    glColor4ub(red: GLubyte, green: GLubyte, blue: GLubyte, alpha: GLubyte): void {
        return this.rec('glColor4ub', '(BBBB)V', [red, green, blue, alpha], () => this.inner.glColor4ub(red, green, blue, alpha));
    }

    // javax.media.opengl.GL.glColorMaterial(II)V
    glColorMaterial(face: GLenum, mode: GLenum): void {
        return this.rec('glColorMaterial', '(II)V', [face, mode], () => this.inner.glColorMaterial(face, mode));
    }

    // javax.media.opengl.GL.glColorPointer(IIILjava/nio/Buffer;)V
    glColorPointer(size: GLint, type: GLenum, stride: GLsizei, ptr: Buffer | null): void;
    // javax.media.opengl.GL.glColorPointer(IIIJ)V
    glColorPointer(size: GLint, type: GLenum, stride: GLsizei, ptr_buffer_offset: bigint): void;
    glColorPointer(size: GLint, type: GLenum, stride: GLsizei, ptr: Buffer | null | bigint): void {
        if (typeof ptr === 'bigint') {
            return this.rec('glColorPointer', '(IIIJ)V', [size, type, stride, ptr], () => this.inner.glColorPointer(size, type, stride, ptr));
        }
        return this.rec('glColorPointer', '(IIILjava/nio/Buffer;)V', [size, type, stride, ptr], () => this.inner.glColorPointer(size, type, stride, ptr));
    }

    // javax.media.opengl.GL.glCopyPixels(IIIII)V
    glCopyPixels(x: GLint, y: GLint, width: GLsizei, height: GLsizei, type: GLenum): void {
        return this.rec('glCopyPixels', '(IIIII)V', [x, y, width, height, type], () => this.inner.glCopyPixels(x, y, width, height, type));
    }

    // javax.media.opengl.GL.glCullFace(I)V
    glCullFace(mode: GLenum): void {
        return this.rec('glCullFace', '(I)V', [mode], () => this.inner.glCullFace(mode));
    }

    // javax.media.opengl.GL.glDeleteBuffersARB(I[II)V
    glDeleteBuffersARB(n: GLsizei, ids: Int32Array | null, ids_offset: number): void {
        return this.rec('glDeleteBuffersARB', '(I[II)V', [n, ids, ids_offset], () => this.inner.glDeleteBuffersARB(n, ids, ids_offset));
    }

    // javax.media.opengl.GL.glDeleteLists(II)V
    glDeleteLists(list: GLuint, range: GLsizei): void {
        return this.rec('glDeleteLists', '(II)V', [list, range], () => this.inner.glDeleteLists(list, range));
    }

    // javax.media.opengl.GL.glDeleteTextures(I[II)V
    glDeleteTextures(n: GLsizei, textures: Int32Array | null, textures_offset: number): void {
        return this.rec('glDeleteTextures', '(I[II)V', [n, textures, textures_offset], () => this.inner.glDeleteTextures(n, textures, textures_offset));
    }

    // javax.media.opengl.GL.glDepthFunc(I)V
    glDepthFunc(func: GLenum): void {
        return this.rec('glDepthFunc', '(I)V', [func], () => this.inner.glDepthFunc(func));
    }

    // javax.media.opengl.GL.glDepthMask(Z)V
    glDepthMask(flag: GLboolean): void {
        return this.rec('glDepthMask', '(Z)V', [flag], () => this.inner.glDepthMask(flag));
    }

    // javax.media.opengl.GL.glDisable(I)V
    glDisable(cap: GLenum): void {
        return this.rec('glDisable', '(I)V', [cap], () => this.inner.glDisable(cap));
    }

    // javax.media.opengl.GL.glDisableClientState(I)V
    glDisableClientState(array: GLenum): void {
        return this.rec('glDisableClientState', '(I)V', [array], () => this.inner.glDisableClientState(array));
    }

    // javax.media.opengl.GL.glDrawBuffer(I)V
    glDrawBuffer(mode: GLenum): void {
        return this.rec('glDrawBuffer', '(I)V', [mode], () => this.inner.glDrawBuffer(mode));
    }

    // javax.media.opengl.GL.glDrawElements(IIILjava/nio/Buffer;)V
    glDrawElements(mode: GLenum, count: GLsizei, type: GLenum, indices: Buffer | null): void;
    // javax.media.opengl.GL.glDrawElements(IIIJ)V
    glDrawElements(mode: GLenum, count: GLsizei, type: GLenum, indices_buffer_offset: bigint): void;
    glDrawElements(mode: GLenum, count: GLsizei, type: GLenum, indices: Buffer | null | bigint): void {
        if (typeof indices === 'bigint') {
            return this.rec('glDrawElements', '(IIIJ)V', [mode, count, type, indices], () => this.inner.glDrawElements(mode, count, type, indices));
        }
        return this.rec('glDrawElements', '(IIILjava/nio/Buffer;)V', [mode, count, type, indices], () => this.inner.glDrawElements(mode, count, type, indices));
    }

    // javax.media.opengl.GL.glDrawPixels(IIIILjava/nio/Buffer;)V
    glDrawPixels(width: GLsizei, height: GLsizei, format: GLenum, type: GLenum, pixels: Buffer | null): void {
        return this.rec('glDrawPixels', '(IIIILjava/nio/Buffer;)V', [width, height, format, type, pixels], () => this.inner.glDrawPixels(width, height, format, type, pixels));
    }

    // javax.media.opengl.GL.glEnable(I)V
    glEnable(cap: GLenum): void {
        return this.rec('glEnable', '(I)V', [cap], () => this.inner.glEnable(cap));
    }

    // javax.media.opengl.GL.glEnableClientState(I)V
    glEnableClientState(array: GLenum): void {
        return this.rec('glEnableClientState', '(I)V', [array], () => this.inner.glEnableClientState(array));
    }

    // javax.media.opengl.GL.glEnd()V
    glEnd(): void {
        return this.rec('glEnd', '()V', [], () => this.inner.glEnd());
    }

    // javax.media.opengl.GL.glEndList()V
    glEndList(): void {
        return this.rec('glEndList', '()V', [], () => this.inner.glEndList());
    }

    // javax.media.opengl.GL.glFogf(IF)V
    glFogf(pname: GLenum, param: GLfloat): void {
        return this.rec('glFogf', '(IF)V', [pname, param], () => this.inner.glFogf(pname, param));
    }

    // javax.media.opengl.GL.glFogfv(I[FI)V
    glFogfv(pname: GLenum, params: Float32Array | null, params_offset: number): void {
        return this.rec('glFogfv', '(I[FI)V', [pname, params, params_offset], () => this.inner.glFogfv(pname, params, params_offset));
    }

    // javax.media.opengl.GL.glFogi(II)V
    glFogi(pname: GLenum, param: GLint): void {
        return this.rec('glFogi', '(II)V', [pname, param], () => this.inner.glFogi(pname, param));
    }

    // javax.media.opengl.GL.glGenBuffersARB(I[II)V
    glGenBuffersARB(n: GLsizei, ids: Int32Array | null, ids_offset: number): void {
        return this.rec('glGenBuffersARB', '(I[II)V', [n, ids, ids_offset], () => this.inner.glGenBuffersARB(n, ids, ids_offset));
    }

    // javax.media.opengl.GL.glGenLists(I)I
    glGenLists(range: GLsizei): GLuint {
        return this.rec('glGenLists', '(I)I', [range], () => this.inner.glGenLists(range));
    }

    // javax.media.opengl.GL.glGenProgramsARB(I[II)V
    glGenProgramsARB(n: GLsizei, ids: Int32Array | null, ids_offset: number): void {
        return this.rec('glGenProgramsARB', '(I[II)V', [n, ids, ids_offset], () => this.inner.glGenProgramsARB(n, ids, ids_offset));
    }

    // javax.media.opengl.GL.glGenTextures(I[II)V
    glGenTextures(n: GLsizei, textures: Int32Array | null, textures_offset: number): void {
        return this.rec('glGenTextures', '(I[II)V', [n, textures, textures_offset], () => this.inner.glGenTextures(n, textures, textures_offset));
    }

    // javax.media.opengl.GL.glGetFloatv(ILjava/nio/FloatBuffer;)V
    glGetFloatv(pname: GLenum, params: FloatBuffer | null): void;
    // javax.media.opengl.GL.glGetFloatv(I[FI)V
    glGetFloatv(pname: GLenum, params: Float32Array | null, params_offset: number): void;
    glGetFloatv(pname: GLenum, params: FloatBuffer | Float32Array | null, params_offset?: number): void {
        if (params_offset === undefined) {
            const buffer = params instanceof FloatBuffer ? params : null;
            return this.rec('glGetFloatv', '(ILjava/nio/FloatBuffer;)V', [pname, params], () => this.inner.glGetFloatv(pname, buffer));
        }
        const array = params instanceof Float32Array ? params : null;
        return this.rec('glGetFloatv', '(I[FI)V', [pname, params, params_offset], () => this.inner.glGetFloatv(pname, array, params_offset));
    }

    // javax.media.opengl.GL.glGetIntegerv(I[II)V
    glGetIntegerv(pname: GLenum, params: Int32Array | null, params_offset: number): void {
        return this.rec('glGetIntegerv', '(I[II)V', [pname, params, params_offset], () => this.inner.glGetIntegerv(pname, params, params_offset));
    }

    // javax.media.opengl.GL.glGetString(I)Ljava/lang/String;
    glGetString(name: GLenum): string | null {
        return this.rec('glGetString', '(I)Ljava/lang/String;', [name], () => this.inner.glGetString(name));
    }

    // javax.media.opengl.GL.glGetTexLevelParameteriv(III[II)V
    glGetTexLevelParameteriv(target: GLenum, level: GLint, pname: GLenum, params: Int32Array | null, params_offset: number): void {
        return this.rec('glGetTexLevelParameteriv', '(III[II)V', [target, level, pname, params, params_offset], () => this.inner.glGetTexLevelParameteriv(target, level, pname, params, params_offset));
    }

    // javax.media.opengl.GL.glHint(II)V
    glHint(target: GLenum, mode: GLenum): void {
        return this.rec('glHint', '(II)V', [target, mode], () => this.inner.glHint(target, mode));
    }

    // javax.media.opengl.GL.glInterleavedArrays(IILjava/nio/Buffer;)V
    glInterleavedArrays(format: GLenum, stride: GLsizei, pointer: Buffer | null): void;
    // javax.media.opengl.GL.glInterleavedArrays(IIJ)V
    glInterleavedArrays(format: GLenum, stride: GLsizei, pointer_buffer_offset: bigint): void;
    glInterleavedArrays(format: GLenum, stride: GLsizei, pointer: Buffer | null | bigint): void {
        if (typeof pointer === 'bigint') {
            return this.rec('glInterleavedArrays', '(IIJ)V', [format, stride, pointer], () => this.inner.glInterleavedArrays(format, stride, pointer));
        }
        return this.rec('glInterleavedArrays', '(IILjava/nio/Buffer;)V', [format, stride, pointer], () => this.inner.glInterleavedArrays(format, stride, pointer));
    }

    // javax.media.opengl.GL.glLightModelfv(I[FI)V
    glLightModelfv(pname: GLenum, params: Float32Array | null, params_offset: number): void {
        return this.rec('glLightModelfv', '(I[FI)V', [pname, params, params_offset], () => this.inner.glLightModelfv(pname, params, params_offset));
    }

    // javax.media.opengl.GL.glLightf(IIF)V
    glLightf(light: GLenum, pname: GLenum, param: GLfloat): void {
        return this.rec('glLightf', '(IIF)V', [light, pname, param], () => this.inner.glLightf(light, pname, param));
    }

    // javax.media.opengl.GL.glLightfv(II[FI)V
    glLightfv(light: GLenum, pname: GLenum, params: Float32Array | null, params_offset: number): void {
        return this.rec('glLightfv', '(II[FI)V', [light, pname, params, params_offset], () => this.inner.glLightfv(light, pname, params, params_offset));
    }

    // javax.media.opengl.GL.glLoadIdentity()V
    glLoadIdentity(): void {
        return this.rec('glLoadIdentity', '()V', [], () => this.inner.glLoadIdentity());
    }

    // javax.media.opengl.GL.glLoadMatrixf([FI)V
    glLoadMatrixf(m: Float32Array | null, m_offset: number): void {
        return this.rec('glLoadMatrixf', '([FI)V', [m, m_offset], () => this.inner.glLoadMatrixf(m, m_offset));
    }

    // javax.media.opengl.GL.glMatrixMode(I)V
    glMatrixMode(mode: GLenum): void {
        return this.rec('glMatrixMode', '(I)V', [mode], () => this.inner.glMatrixMode(mode));
    }

    // javax.media.opengl.GL.glMultiTexCoord2f(IFF)V
    glMultiTexCoord2f(target: GLenum, s: GLfloat, t: GLfloat): void {
        return this.rec('glMultiTexCoord2f', '(IFF)V', [target, s, t], () => this.inner.glMultiTexCoord2f(target, s, t));
    }

    // javax.media.opengl.GL.glNewList(II)V
    glNewList(list: GLuint, mode: GLenum): void {
        return this.rec('glNewList', '(II)V', [list, mode], () => this.inner.glNewList(list, mode));
    }

    // javax.media.opengl.GL.glNormalPointer(IILjava/nio/Buffer;)V
    glNormalPointer(type: GLenum, stride: GLsizei, ptr: Buffer | null): void;
    // javax.media.opengl.GL.glNormalPointer(IIJ)V
    glNormalPointer(type: GLenum, stride: GLsizei, ptr_buffer_offset: bigint): void;
    glNormalPointer(type: GLenum, stride: GLsizei, ptr: Buffer | null | bigint): void {
        if (typeof ptr === 'bigint') {
            return this.rec('glNormalPointer', '(IIJ)V', [type, stride, ptr], () => this.inner.glNormalPointer(type, stride, ptr));
        }
        return this.rec('glNormalPointer', '(IILjava/nio/Buffer;)V', [type, stride, ptr], () => this.inner.glNormalPointer(type, stride, ptr));
    }

    // javax.media.opengl.GL.glOrtho(DDDDDD)V
    glOrtho(left: GLdouble, right: GLdouble, bottom: GLdouble, top: GLdouble, zNear: GLdouble, zFar: GLdouble): void {
        return this.rec('glOrtho', '(DDDDDD)V', [left, right, bottom, top, zNear, zFar], () => this.inner.glOrtho(left, right, bottom, top, zNear, zFar));
    }

    // javax.media.opengl.GL.glPixelStorei(II)V
    glPixelStorei(pname: GLenum, param: GLint): void {
        return this.rec('glPixelStorei', '(II)V', [pname, param], () => this.inner.glPixelStorei(pname, param));
    }

    // javax.media.opengl.GL.glPixelZoom(FF)V
    glPixelZoom(xfactor: GLfloat, yfactor: GLfloat): void {
        return this.rec('glPixelZoom', '(FF)V', [xfactor, yfactor], () => this.inner.glPixelZoom(xfactor, yfactor));
    }

    // javax.media.opengl.GL.glPointParameterfARB(IF)V
    glPointParameterfARB(pname: GLenum, param: GLfloat): void {
        return this.rec('glPointParameterfARB', '(IF)V', [pname, param], () => this.inner.glPointParameterfARB(pname, param));
    }

    // javax.media.opengl.GL.glPointParameterfvARB(I[FI)V
    glPointParameterfvARB(pname: GLenum, v: Float32Array | null, v_offset: number): void {
        return this.rec('glPointParameterfvARB', '(I[FI)V', [pname, v, v_offset], () => this.inner.glPointParameterfvARB(pname, v, v_offset));
    }

    // javax.media.opengl.GL.glPolygonMode(II)V
    glPolygonMode(face: GLenum, mode: GLenum): void {
        return this.rec('glPolygonMode', '(II)V', [face, mode], () => this.inner.glPolygonMode(face, mode));
    }

    // javax.media.opengl.GL.glPopAttrib()V
    glPopAttrib(): void {
        return this.rec('glPopAttrib', '()V', [], () => this.inner.glPopAttrib());
    }

    // javax.media.opengl.GL.glPopMatrix()V
    glPopMatrix(): void {
        return this.rec('glPopMatrix', '()V', [], () => this.inner.glPopMatrix());
    }

    // javax.media.opengl.GL.glProgramLocalParameter4fARB(IIFFFF)V
    glProgramLocalParameter4fARB(target: GLenum, index: GLuint, x: GLfloat, y: GLfloat, z: GLfloat, w: GLfloat): void {
        return this.rec('glProgramLocalParameter4fARB', '(IIFFFF)V', [target, index, x, y, z, w], () => this.inner.glProgramLocalParameter4fARB(target, index, x, y, z, w));
    }

    // javax.media.opengl.GL.glProgramLocalParameter4fvARB(IILjava/nio/FloatBuffer;)V
    glProgramLocalParameter4fvARB(target: GLenum, index: GLuint, params: FloatBuffer | null): void;
    // javax.media.opengl.GL.glProgramLocalParameter4fvARB(II[FI)V
    glProgramLocalParameter4fvARB(target: GLenum, index: GLuint, params: Float32Array | null, params_offset: number): void;
    glProgramLocalParameter4fvARB(target: GLenum, index: GLuint, params: FloatBuffer | Float32Array | null, params_offset?: number): void {
        if (params_offset === undefined) {
            const buffer = params instanceof FloatBuffer ? params : null;
            return this.rec('glProgramLocalParameter4fvARB', '(IILjava/nio/FloatBuffer;)V', [target, index, params], () => this.inner.glProgramLocalParameter4fvARB(target, index, buffer));
        }
        const array = params instanceof Float32Array ? params : null;
        return this.rec('glProgramLocalParameter4fvARB', '(II[FI)V', [target, index, params, params_offset], () => this.inner.glProgramLocalParameter4fvARB(target, index, array, params_offset));
    }

    // javax.media.opengl.GL.glProgramStringARB(IIILjava/lang/String;)V
    glProgramStringARB(target: GLenum, format: GLenum, len: GLsizei, string: string | null): void {
        return this.rec('glProgramStringARB', '(IIILjava/lang/String;)V', [target, format, len, string], () => this.inner.glProgramStringARB(target, format, len, string));
    }

    // javax.media.opengl.GL.glPushAttrib(I)V
    glPushAttrib(mask: GLbitfield): void {
        return this.rec('glPushAttrib', '(I)V', [mask], () => this.inner.glPushAttrib(mask));
    }

    // javax.media.opengl.GL.glPushMatrix()V
    glPushMatrix(): void {
        return this.rec('glPushMatrix', '()V', [], () => this.inner.glPushMatrix());
    }

    // javax.media.opengl.GL.glRasterPos2i(II)V
    glRasterPos2i(x: GLint, y: GLint): void {
        return this.rec('glRasterPos2i', '(II)V', [x, y], () => this.inner.glRasterPos2i(x, y));
    }

    // javax.media.opengl.GL.glReadBuffer(I)V
    glReadBuffer(mode: GLenum): void {
        return this.rec('glReadBuffer', '(I)V', [mode], () => this.inner.glReadBuffer(mode));
    }

    // javax.media.opengl.GL.glRotatef(FFFF)V
    glRotatef(angle: GLfloat, x: GLfloat, y: GLfloat, z: GLfloat): void {
        return this.rec('glRotatef', '(FFFF)V', [angle, x, y, z], () => this.inner.glRotatef(angle, x, y, z));
    }

    // javax.media.opengl.GL.glScalef(FFF)V
    glScalef(x: GLfloat, y: GLfloat, z: GLfloat): void {
        return this.rec('glScalef', '(FFF)V', [x, y, z], () => this.inner.glScalef(x, y, z));
    }

    // javax.media.opengl.GL.glScissor(IIII)V
    glScissor(x: GLint, y: GLint, width: GLsizei, height: GLsizei): void {
        return this.rec('glScissor', '(IIII)V', [x, y, width, height], () => this.inner.glScissor(x, y, width, height));
    }

    // javax.media.opengl.GL.glShadeModel(I)V
    glShadeModel(mode: GLenum): void {
        return this.rec('glShadeModel', '(I)V', [mode], () => this.inner.glShadeModel(mode));
    }

    // javax.media.opengl.GL.glTexCoord2f(FF)V
    glTexCoord2f(s: GLfloat, t: GLfloat): void {
        return this.rec('glTexCoord2f', '(FF)V', [s, t], () => this.inner.glTexCoord2f(s, t));
    }

    // javax.media.opengl.GL.glTexCoordPointer(IIILjava/nio/Buffer;)V
    glTexCoordPointer(size: GLint, type: GLenum, stride: GLsizei, ptr: Buffer | null): void;
    // javax.media.opengl.GL.glTexCoordPointer(IIIJ)V
    glTexCoordPointer(size: GLint, type: GLenum, stride: GLsizei, ptr_buffer_offset: bigint): void;
    glTexCoordPointer(size: GLint, type: GLenum, stride: GLsizei, ptr: Buffer | null | bigint): void {
        if (typeof ptr === 'bigint') {
            return this.rec('glTexCoordPointer', '(IIIJ)V', [size, type, stride, ptr], () => this.inner.glTexCoordPointer(size, type, stride, ptr));
        }
        return this.rec('glTexCoordPointer', '(IIILjava/nio/Buffer;)V', [size, type, stride, ptr], () => this.inner.glTexCoordPointer(size, type, stride, ptr));
    }

    // javax.media.opengl.GL.glTexEnvf(IIF)V
    glTexEnvf(target: GLenum, pname: GLenum, param: GLfloat): void {
        return this.rec('glTexEnvf', '(IIF)V', [target, pname, param], () => this.inner.glTexEnvf(target, pname, param));
    }

    // javax.media.opengl.GL.glTexEnvfv(II[FI)V
    glTexEnvfv(target: GLenum, pname: GLenum, params: Float32Array | null, params_offset: number): void {
        return this.rec('glTexEnvfv', '(II[FI)V', [target, pname, params, params_offset], () => this.inner.glTexEnvfv(target, pname, params, params_offset));
    }

    // javax.media.opengl.GL.glTexEnvi(III)V
    glTexEnvi(target: GLenum, pname: GLenum, param: GLint): void {
        return this.rec('glTexEnvi', '(III)V', [target, pname, param], () => this.inner.glTexEnvi(target, pname, param));
    }

    // javax.media.opengl.GL.glTexGenfv(II[FI)V
    glTexGenfv(coord: GLenum, pname: GLenum, params: Float32Array | null, params_offset: number): void {
        return this.rec('glTexGenfv', '(II[FI)V', [coord, pname, params, params_offset], () => this.inner.glTexGenfv(coord, pname, params, params_offset));
    }

    // javax.media.opengl.GL.glTexGeni(III)V
    glTexGeni(coord: GLenum, pname: GLenum, param: GLint): void {
        return this.rec('glTexGeni', '(III)V', [coord, pname, param], () => this.inner.glTexGeni(coord, pname, param));
    }

    // javax.media.opengl.GL.glTexImage1D(IIIIIIILjava/nio/Buffer;)V
    glTexImage1D(target: GLenum, level: GLint, internalformat: GLint, width: GLsizei, border: GLint, format: GLenum, type: GLenum, pixels: Buffer | null): void {
        return this.rec('glTexImage1D', '(IIIIIIILjava/nio/Buffer;)V', [target, level, internalformat, width, border, format, type, pixels], () => this.inner.glTexImage1D(target, level, internalformat, width, border, format, type, pixels));
    }

    // javax.media.opengl.GL.glTexImage2D(IIIIIIIILjava/nio/Buffer;)V
    glTexImage2D(target: GLenum, level: GLint, internalformat: GLint, width: GLsizei, height: GLsizei, border: GLint, format: GLenum, type: GLenum, pixels: Buffer | null): void {
        return this.rec('glTexImage2D', '(IIIIIIIILjava/nio/Buffer;)V', [target, level, internalformat, width, height, border, format, type, pixels], () =>
            this.inner.glTexImage2D(target, level, internalformat, width, height, border, format, type, pixels)
        );
    }

    // javax.media.opengl.GL.glTexImage3D(IIIIIIIIILjava/nio/Buffer;)V
    glTexImage3D(target: GLenum, level: GLint, internalformat: GLint, width: GLsizei, height: GLsizei, depth: GLsizei, border: GLint, format: GLenum, type: GLenum, pixels: Buffer | null): void {
        return this.rec('glTexImage3D', '(IIIIIIIIILjava/nio/Buffer;)V', [target, level, internalformat, width, height, depth, border, format, type, pixels], () =>
            this.inner.glTexImage3D(target, level, internalformat, width, height, depth, border, format, type, pixels)
        );
    }

    // javax.media.opengl.GL.glTexParameteri(III)V
    glTexParameteri(target: GLenum, pname: GLenum, param: GLint): void {
        return this.rec('glTexParameteri', '(III)V', [target, pname, param], () => this.inner.glTexParameteri(target, pname, param));
    }

    // javax.media.opengl.GL.glTranslatef(FFF)V
    glTranslatef(x: GLfloat, y: GLfloat, z: GLfloat): void {
        return this.rec('glTranslatef', '(FFF)V', [x, y, z], () => this.inner.glTranslatef(x, y, z));
    }

    // javax.media.opengl.GL.glVertex2f(FF)V
    glVertex2f(x: GLfloat, y: GLfloat): void {
        return this.rec('glVertex2f', '(FF)V', [x, y], () => this.inner.glVertex2f(x, y));
    }

    // javax.media.opengl.GL.glVertexPointer(IIILjava/nio/Buffer;)V
    glVertexPointer(size: GLint, type: GLenum, stride: GLsizei, ptr: Buffer | null): void;
    // javax.media.opengl.GL.glVertexPointer(IIIJ)V
    glVertexPointer(size: GLint, type: GLenum, stride: GLsizei, ptr_buffer_offset: bigint): void;
    glVertexPointer(size: GLint, type: GLenum, stride: GLsizei, ptr: Buffer | null | bigint): void {
        if (typeof ptr === 'bigint') {
            return this.rec('glVertexPointer', '(IIIJ)V', [size, type, stride, ptr], () => this.inner.glVertexPointer(size, type, stride, ptr));
        }
        return this.rec('glVertexPointer', '(IIILjava/nio/Buffer;)V', [size, type, stride, ptr], () => this.inner.glVertexPointer(size, type, stride, ptr));
    }

    // javax.media.opengl.GL.glViewport(IIII)V
    glViewport(x: GLint, y: GLint, width: GLsizei, height: GLsizei): void {
        return this.rec('glViewport', '(IIII)V', [x, y, width, height], () => this.inner.glViewport(x, y, width, height));
    }

    // javax.media.opengl.GL.isExtensionAvailable(Ljava/lang/String;)Z
    isExtensionAvailable(glExtensionName: string | null): boolean {
        return this.rec('isExtensionAvailable', '(Ljava/lang/String;)Z', [glExtensionName], () => this.inner.isExtensionAvailable(glExtensionName));
    }

    // javax.media.opengl.GL.setSwapInterval(I)V
    setSwapInterval(interval: number): void {
        return this.rec('setSwapInterval', '(I)V', [interval], () => this.inner.setSwapInterval(interval));
    }
}

const GET_GL_DRAWABLE = '(Ljava/lang/Object;Ljavax/media/opengl/GLCapabilities;Ljavax/media/opengl/GLCapabilitiesChooser;)Ljavax/media/opengl/GLDrawable;';

// Records GLDrawableFactory.getGLDrawable and wraps each drawable it returns.
export class RecordingGLDrawableFactory extends GLDrawableFactory {
    readonly inner: GLDrawableFactory;
    readonly writer: GlTraceWriter;
    private readonly options: RecordingOptions;

    constructor(inner: GLDrawableFactory, writer: GlTraceWriter, options: RecordingOptions = {}) {
        super();
        this.inner = inner;
        this.writer = writer;
        this.options = options;
    }

    // javax.media.opengl.GLDrawableFactory.getGLDrawable(Ljava/lang/Object;Ljavax/media/opengl/GLCapabilities;Ljavax/media/opengl/GLCapabilitiesChooser;)Ljavax/media/opengl/GLDrawable;
    getGLDrawable(target: object | null, capabilities: GLCapabilities | null, chooser: GLCapabilitiesChooser | null): GLDrawable {
        return recordCall(
            this.writer,
            this,
            null,
            'GLDrawableFactory.getGLDrawable',
            GET_GL_DRAWABLE,
            [target, capabilities, chooser],
            () => new RecordingGLDrawable(this.inner.getGLDrawable(target, capabilities, chooser), this.writer, this.options),
            this.options
        );
    }
}

// Records the three GLDrawable calls; swapBuffers ends the trace frame.
export class RecordingGLDrawable implements GLDrawable {
    readonly inner: GLDrawable;
    readonly writer: GlTraceWriter;
    private readonly options: RecordingOptions;

    constructor(inner: GLDrawable, writer: GlTraceWriter, options: RecordingOptions = {}) {
        this.inner = inner;
        this.writer = writer;
        this.options = options;
    }

    // javax.media.opengl.GLDrawable.createContext(Ljavax/media/opengl/GLContext;)Ljavax/media/opengl/GLContext;
    createContext(shareWith: GLContext | null): GLContext {
        const share = shareWith instanceof RecordingGLContext ? shareWith.inner : shareWith;
        return recordCall(
            this.writer,
            this,
            null,
            'GLDrawable.createContext',
            '(Ljavax/media/opengl/GLContext;)Ljavax/media/opengl/GLContext;',
            [shareWith],
            () => new RecordingGLContext(this.inner.createContext(share), this.writer, this.options),
            this.options
        );
    }

    // javax.media.opengl.GLDrawable.setRealized(Z)V
    setRealized(realized: boolean): void {
        return recordCall(this.writer, this, null, 'GLDrawable.setRealized', '(Z)V', [realized], () => this.inner.setRealized(realized), this.options);
    }

    // javax.media.opengl.GLDrawable.swapBuffers()V
    swapBuffers(): void {
        return recordCall(this.writer, this, null, 'GLDrawable.swapBuffers', '()V', [], () => this.inner.swapBuffers(), this.options);
    }
}

// Records the four GLContext calls. The client sees this wrapper as the current context (GLContext.getCurrent()),
// so tf.o()V's `GLContext.getCurrent() == p` test and GLU's GLContext.getCurrent().getGL() both reach the
// recorder; the inner context sees itself as current while its own makeCurrent runs, so a release it performs
// on a previous context is internal and unrecorded (GLTRACE.md section 10).
export class RecordingGLContext extends GLContext {
    readonly inner: GLContext;
    readonly writer: GlTraceWriter;
    private readonly options: RecordingOptions;
    private innerGL: GL | null = null;
    private gl: RecordingGL | null = null;

    constructor(inner: GLContext, writer: GlTraceWriter, options: RecordingOptions = {}) {
        super();
        this.inner = inner;
        this.writer = writer;
        this.options = options;
    }

    // javax.media.opengl.GLContext.makeCurrent()I
    makeCurrent(): number {
        return recordCall(
            this.writer,
            this,
            null,
            'GLContext.makeCurrent',
            '()I',
            [],
            () => {
                const previous = GLContext.getCurrent();
                if (previous instanceof RecordingGLContext) RecordingGLContext.setCurrent(previous.inner);
                try {
                    return this.inner.makeCurrent();
                } finally {
                    const now = GLContext.getCurrent();
                    if (now === this.inner) RecordingGLContext.setCurrent(this);
                    else if (previous instanceof RecordingGLContext && now === previous.inner) RecordingGLContext.setCurrent(previous);
                }
            },
            this.options
        );
    }

    // javax.media.opengl.GLContext.release()V
    release(): void {
        return recordCall(
            this.writer,
            this,
            null,
            'GLContext.release',
            '()V',
            [],
            () => {
                try {
                    this.inner.release();
                } finally {
                    if (GLContext.getCurrent() === this) RecordingGLContext.setCurrent(null);
                }
            },
            this.options
        );
    }

    // javax.media.opengl.GLContext.destroy()V
    destroy(): void {
        return recordCall(this.writer, this, null, 'GLContext.destroy', '()V', [], () => this.inner.destroy(), this.options);
    }

    // javax.media.opengl.GLContext.getGL()Ljavax/media/opengl/GL;
    getGL(): GL {
        return recordCall(
            this.writer,
            this,
            null,
            'GLContext.getGL',
            '()Ljavax/media/opengl/GL;',
            [],
            () => {
                const inner = this.inner.getGL();
                if (this.gl === null || this.innerGL !== inner) {
                    this.innerGL = inner;
                    this.gl = new RecordingGL(inner, this.writer, this.options);
                }
                return this.gl;
            },
            this.options
        );
    }
}
