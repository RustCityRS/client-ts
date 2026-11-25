import type Buffer from '#/util/nio/Buffer';
import ByteOrder from '#/util/nio/ByteOrder';
import FloatBuffer from '#/util/nio/FloatBuffer';
import { arrayPutF32, arrayPutI32, requireNonNull } from '#/util/JavaArray';
import GLCapabilities from '#/jogl/GLCapabilities';
import type GLCapabilitiesChooser from '#/jogl/GLCapabilitiesChooser';
import GLContext from '#/jogl/GLContext';
import type GLDrawable from '#/jogl/GLDrawable';
import GLDrawableFactory from '#/jogl/GLDrawableFactory';
import GLException from '#/jogl/GLException';
import type { GL, GLbitfield, GLboolean, GLclampd, GLclampf, GLdouble, GLenum, GLfloat, GLint, GLintptrARB, GLsizei, GLsizeiptrARB, GLubyte, GLuint } from '#/jogl/GL';
import { type CapsProfile, profileHasExtension, validateCapsProfile } from './CapsProfile';
import { bitsToFloat } from './GlTrace';

// NullGL: a GPU-free GL. Not a Java class; it stands where the OpenGL driver stands (HD_PLAN 1.2), for tests and
// headless runs, usually under RecordingGL. It renders nothing and records nothing itself. What it does
// (GLTRACE.md section 16 is the contract the Java responder shares):
// - Profile: a required constructor argument, with no default, because the Java responder's default
//   (test/hd/rtx5070.json) is a file. Which profile oracles pass: see the header of CapsProfile.ts.
// - Names: glGenTextures, glGenBuffersARB, glGenProgramsARB and glGenLists hand out 1, 2, 3, ... per kind and
//   never reuse a name (glDelete* frees nothing).
// - Queries: glGetString, isExtensionAvailable, glGetIntegerv and glGetFloatv answer from the CapsProfile,
//   statically, except the state the jar reads back: DRAW_BUFFER and READ_BUFFER (set by glDrawBuffer and
//   glReadBuffer; initially BACK for a double-buffered drawable, else FRONT), LIGHT_MODEL_AMBIENT (set by
//   glLightModelfv; initially the GL default 0.2, 0.2, 0.2, 1) and PROGRAM_ERROR_POSITION_ARB (always -1: every
//   program string loads). glGetTexLevelParameteriv answers TEXTURE_WIDTH/HEIGHT/DEPTH of proxy targets by the
//   proxy rule below and 0 for everything else.
// - glGetError() answers 0 (an extra method: the shipped javax.media.opengl.GL has no glGetError).
// - The Java-side argument checks of the shipped com.sun.opengl.impl.GLImpl that concern arrays and entry-point
//   availability, in GLImpl's order: BufferFactory.rangeCheck for the int[] of glGen*/glDelete*, the
//   'array offset argument' GLException of every array overload, and GLException('Method "<name>" not
//   available') for profile.missingEntryPoints (checked in exactly the 16 DYNAMIC_ENTRY_POINTS methods, the only
//   names a valid profile can list). Not reproduced: GLImpl's Buffer-argument checks (direct buffer for
//   gl*Pointer, BufferFactory.rangeCheck/rangeCheckBytes against imageSizeInBytes, and checkBufferObject, which in
//   the shipped build tests only inBeginEndPair and the VBO/PBO extension flags, never the bound buffer).
// - Writes to output arrays use the typed Java array helpers, so a null array or an index past the end throws
//   TypeError/RangeError (the native code would write through a bad pointer).
export default class NullGL implements GL {
    readonly profile: CapsProfile;
    private nextTexture = 1;
    private nextBuffer = 1;
    private nextProgram = 1;
    private nextList = 1;
    // proxy target -> level -> [width, height, depth] (all 0 when the proxy image is not supported)
    private readonly proxyImages = new Map<number, Map<number, readonly [number, number, number]>>();
    private drawBuffer: number;
    private readBuffer: number;
    // LIGHT_MODEL_AMBIENT as binary32 bits
    private readonly ambient = new Uint32Array([0x3e4ccccd, 0x3e4ccccd, 0x3e4ccccd, 0x3f800000]);

    constructor(profile: CapsProfile, doubleBuffered: boolean = true) {
        validateCapsProfile(profile);
        this.profile = profile;
        this.drawBuffer = this.readBuffer = doubleBuffered ? GL_BACK : GL_FRONT;
    }

    // Not in the shipped interface (no ported code calls it): there are never GL errors to report.
    glGetError(): number {
        return 0;
    }

    // com.sun.opengl.impl.GLImpl: `if (__addr_ == 0) throw new GLException("Method \"<name>\" not available")`
    private checkAvailable(name: string): void {
        if (this.profile.missingEntryPoints.includes(name)) throw new GLException('Method "' + name + '" not available');
    }

    private maxSize(pname: number): number {
        const values = this.profile.integers[String(pname)] ?? this.profile.integers['3379'];
        return values === undefined || values.length === 0 ? 0 : values[0];
    }

    // Proxy rule (GLTRACE.md section 16): a glTexImage* on a proxy target is supported when border is 0, level >= 0
    // and every dimension the target has is >= 0 with dimension * 2^level <= the target's maximum size (cube maps
    // also need width == height). The level then reports its width, height and depth; otherwise all three are 0.
    private proxyImage(target: number, level: number, border: number, width: number, height: number, depth: number): void {
        let dims: number;
        let max: number;
        if (target === PROXY_TEXTURE_1D) {
            dims = 1;
            max = this.maxSize(MAX_TEXTURE_SIZE);
        } else if (target === PROXY_TEXTURE_2D) {
            dims = 2;
            max = this.maxSize(MAX_TEXTURE_SIZE);
        } else if (target === PROXY_TEXTURE_CUBE_MAP) {
            dims = 2;
            max = this.maxSize(MAX_CUBE_MAP_TEXTURE_SIZE);
        } else if (target === PROXY_TEXTURE_3D) {
            dims = 3;
            max = this.maxSize(MAX_3D_TEXTURE_SIZE);
        } else {
            return;
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
    }

    private proxyQuery(target: number, level: number, pname: number): number {
        const image = this.proxyImages.get(target)?.get(level);
        if (image === undefined) return 0;
        if (pname === TEXTURE_WIDTH) return image[0];
        if (pname === TEXTURE_HEIGHT) return image[1];
        if (pname === TEXTURE_DEPTH) return image[2];
        return 0;
    }

    // javax.media.opengl.GL.glActiveTexture(I)V
    glActiveTexture(_texture: GLenum): void {
        this.checkAvailable('glActiveTexture');
    }

    // javax.media.opengl.GL.glAlphaFunc(IF)V
    glAlphaFunc(_func: GLenum, _ref: GLclampf): void {}

    // javax.media.opengl.GL.glBegin(I)V
    glBegin(_mode: GLenum): void {}

    // javax.media.opengl.GL.glBindBufferARB(II)V
    glBindBufferARB(_target: GLenum, _buffer: GLuint): void {
        this.checkAvailable('glBindBufferARB');
    }

    // javax.media.opengl.GL.glBindProgramARB(II)V
    glBindProgramARB(_target: GLenum, _program: GLuint): void {
        this.checkAvailable('glBindProgramARB');
    }

    // javax.media.opengl.GL.glBindTexture(II)V
    glBindTexture(_target: GLenum, _texture: GLuint): void {}

    // javax.media.opengl.GL.glBlendFunc(II)V
    glBlendFunc(_sfactor: GLenum, _dfactor: GLenum): void {}

    // javax.media.opengl.GL.glBufferDataARB(IILjava/nio/Buffer;I)V
    glBufferDataARB(_target: GLenum, _size: GLsizeiptrARB, _data: Buffer | null, _usage: GLenum): void {
        this.checkAvailable('glBufferDataARB');
    }

    // javax.media.opengl.GL.glBufferSubDataARB(IIILjava/nio/Buffer;)V
    glBufferSubDataARB(_target: GLenum, _offset: GLintptrARB, _size: GLsizeiptrARB, _data: Buffer | null): void {
        this.checkAvailable('glBufferSubDataARB');
    }

    // javax.media.opengl.GL.glCallList(I)V
    glCallList(_list: GLuint): void {}

    // javax.media.opengl.GL.glClear(I)V
    glClear(_mask: GLbitfield): void {}

    // javax.media.opengl.GL.glClearColor(FFFF)V
    glClearColor(_red: GLclampf, _green: GLclampf, _blue: GLclampf, _alpha: GLclampf): void {}

    // javax.media.opengl.GL.glClearDepth(D)V
    glClearDepth(_depth: GLclampd): void {}

    // javax.media.opengl.GL.glClientActiveTexture(I)V
    glClientActiveTexture(_texture: GLenum): void {
        this.checkAvailable('glClientActiveTexture');
    }

    // javax.media.opengl.GL.glColor3ub(BBB)V
    glColor3ub(_red: GLubyte, _green: GLubyte, _blue: GLubyte): void {}

    // javax.media.opengl.GL.glColor4f(FFFF)V
    glColor4f(_red: GLfloat, _green: GLfloat, _blue: GLfloat, _alpha: GLfloat): void {}

    // javax.media.opengl.GL.glColor4fv([FI)V
    glColor4fv(v: Float32Array | null, v_offset: number): void {
        checkArrayOffset(v, v_offset, 'v_offset');
    }

    // javax.media.opengl.GL.glColor4ub(BBBB)V
    glColor4ub(_red: GLubyte, _green: GLubyte, _blue: GLubyte, _alpha: GLubyte): void {}

    // javax.media.opengl.GL.glColorMaterial(II)V
    glColorMaterial(_face: GLenum, _mode: GLenum): void {}

    // javax.media.opengl.GL.glColorPointer(IIILjava/nio/Buffer;)V
    glColorPointer(size: GLint, type: GLenum, stride: GLsizei, ptr: Buffer | null): void;
    // javax.media.opengl.GL.glColorPointer(IIIJ)V
    glColorPointer(size: GLint, type: GLenum, stride: GLsizei, ptr_buffer_offset: bigint): void;
    glColorPointer(_size: GLint, _type: GLenum, _stride: GLsizei, _ptr: Buffer | null | bigint): void {}

    // javax.media.opengl.GL.glCopyPixels(IIIII)V
    glCopyPixels(_x: GLint, _y: GLint, _width: GLsizei, _height: GLsizei, _type: GLenum): void {}

    // javax.media.opengl.GL.glCullFace(I)V
    glCullFace(_mode: GLenum): void {}

    // javax.media.opengl.GL.glDeleteBuffersARB(I[II)V
    glDeleteBuffersARB(n: GLsizei, ids: Int32Array | null, ids_offset: number): void {
        rangeCheck(ids, ids_offset, n);
        checkArrayOffset(ids, ids_offset, 'ids_offset');
        this.checkAvailable('glDeleteBuffersARB');
    }

    // javax.media.opengl.GL.glDeleteLists(II)V
    glDeleteLists(_list: GLuint, _range: GLsizei): void {}

    // javax.media.opengl.GL.glDeleteTextures(I[II)V
    glDeleteTextures(n: GLsizei, textures: Int32Array | null, textures_offset: number): void {
        rangeCheck(textures, textures_offset, n);
        checkArrayOffset(textures, textures_offset, 'textures_offset');
    }

    // javax.media.opengl.GL.glDepthFunc(I)V
    glDepthFunc(_func: GLenum): void {}

    // javax.media.opengl.GL.glDepthMask(Z)V
    glDepthMask(_flag: GLboolean): void {}

    // javax.media.opengl.GL.glDisable(I)V
    glDisable(_cap: GLenum): void {}

    // javax.media.opengl.GL.glDisableClientState(I)V
    glDisableClientState(_array: GLenum): void {}

    // javax.media.opengl.GL.glDrawBuffer(I)V
    glDrawBuffer(mode: GLenum): void {
        this.drawBuffer = mode;
    }

    // javax.media.opengl.GL.glDrawElements(IIILjava/nio/Buffer;)V
    glDrawElements(mode: GLenum, count: GLsizei, type: GLenum, indices: Buffer | null): void;
    // javax.media.opengl.GL.glDrawElements(IIIJ)V
    glDrawElements(mode: GLenum, count: GLsizei, type: GLenum, indices_buffer_offset: bigint): void;
    glDrawElements(_mode: GLenum, _count: GLsizei, _type: GLenum, _indices: Buffer | null | bigint): void {}

    // javax.media.opengl.GL.glDrawPixels(IIIILjava/nio/Buffer;)V
    glDrawPixels(_width: GLsizei, _height: GLsizei, _format: GLenum, _type: GLenum, _pixels: Buffer | null): void {}

    // javax.media.opengl.GL.glEnable(I)V
    glEnable(_cap: GLenum): void {}

    // javax.media.opengl.GL.glEnableClientState(I)V
    glEnableClientState(_array: GLenum): void {}

    // javax.media.opengl.GL.glEnd()V
    glEnd(): void {}

    // javax.media.opengl.GL.glEndList()V
    glEndList(): void {}

    // javax.media.opengl.GL.glFogf(IF)V
    glFogf(_pname: GLenum, _param: GLfloat): void {}

    // javax.media.opengl.GL.glFogfv(I[FI)V
    glFogfv(_pname: GLenum, params: Float32Array | null, params_offset: number): void {
        checkArrayOffset(params, params_offset, 'params_offset');
    }

    // javax.media.opengl.GL.glFogi(II)V
    glFogi(_pname: GLenum, _param: GLint): void {}

    // javax.media.opengl.GL.glGenBuffersARB(I[II)V
    glGenBuffersARB(n: GLsizei, ids: Int32Array | null, ids_offset: number): void {
        rangeCheck(ids, ids_offset, n);
        checkArrayOffset(ids, ids_offset, 'ids_offset');
        this.checkAvailable('glGenBuffersARB');
        for (let i = 0; i < n; i++) arrayPutI32(ids, ids_offset + i, this.nextBuffer++);
    }

    // javax.media.opengl.GL.glGenLists(I)I
    glGenLists(range: GLsizei): GLuint {
        // GL returns 0 for range 0 and, with GL_INVALID_VALUE, for a negative range.
        if (range <= 0) return 0;
        const base = this.nextList;
        this.nextList = (this.nextList + range) | 0;
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
            // The FloatBuffer form writes from the buffer's position on (JNI address or array plus position); the
            // position does not move. GL writes raw bits, so after the buffer's own checks (index below the limit,
            // not read-only) the bits go into its storage in the buffer's order, NaN payloads included, as the
            // array form does: put(int, float) alone would store JavaScriptCore's canonical NaN.
            const buffer = requireNonNull(params instanceof Float32Array ? null : params);
            if (bits === null) return;
            const storage = buffer.storageBytes();
            const raw = new DataView(storage.buffer, storage.byteOffset, storage.byteLength);
            const littleEndian = buffer.order() === ByteOrder.LITTLE_ENDIAN;
            for (let i = 0; i < bits.length; i++) {
                const index = buffer.position() + i;
                buffer.put(index, bitsToFloat(bits[i])); // the buffer's index and read-only checks
                raw.setUint32(index << 2, bits[i], littleEndian); // exact bits, NaN payloads included
            }
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

    // The binary32 bits glGetFloatv writes for pname, or null when it writes nothing.
    private floatAnswer(pname: number): number[] | null {
        if (pname === LIGHT_MODEL_AMBIENT) return [...this.ambient];
        const values = this.profile.floats[String(pname)];
        return values === undefined ? null : values.map(v => parseInt(v, 16) >>> 0);
    }

    // javax.media.opengl.GL.glGetIntegerv(I[II)V
    glGetIntegerv(pname: GLenum, params: Int32Array | null, params_offset: number): void {
        checkArrayOffset(params, params_offset, 'params_offset');
        let values: readonly number[] | undefined;
        if (pname === DRAW_BUFFER) values = [this.drawBuffer];
        else if (pname === READ_BUFFER) values = [this.readBuffer];
        else if (pname === PROGRAM_ERROR_POSITION_ARB) values = [-1];
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
    glGetTexLevelParameteriv(target: GLenum, level: GLint, pname: GLenum, params: Int32Array | null, params_offset: number): void {
        checkArrayOffset(params, params_offset, 'params_offset');
        arrayPutI32(params, params_offset, this.proxyQuery(target, level, pname));
    }

    // javax.media.opengl.GL.glHint(II)V
    glHint(_target: GLenum, _mode: GLenum): void {}

    // javax.media.opengl.GL.glInterleavedArrays(IILjava/nio/Buffer;)V
    glInterleavedArrays(format: GLenum, stride: GLsizei, pointer: Buffer | null): void;
    // javax.media.opengl.GL.glInterleavedArrays(IIJ)V
    glInterleavedArrays(format: GLenum, stride: GLsizei, pointer_buffer_offset: bigint): void;
    glInterleavedArrays(_format: GLenum, _stride: GLsizei, _pointer: Buffer | null | bigint): void {}

    // javax.media.opengl.GL.glLightModelfv(I[FI)V
    glLightModelfv(pname: GLenum, params: Float32Array | null, params_offset: number): void {
        checkArrayOffset(params, params_offset, 'params_offset');
        if (pname === LIGHT_MODEL_AMBIENT && params !== null && params_offset >= 0 && params_offset <= params.length - 4) {
            this.ambient.set(new Uint32Array(params.buffer, params.byteOffset, params.length).subarray(params_offset, params_offset + 4));
        }
    }

    // javax.media.opengl.GL.glLightf(IIF)V
    glLightf(_light: GLenum, _pname: GLenum, _param: GLfloat): void {}

    // javax.media.opengl.GL.glLightfv(II[FI)V
    glLightfv(_light: GLenum, _pname: GLenum, params: Float32Array | null, params_offset: number): void {
        checkArrayOffset(params, params_offset, 'params_offset');
    }

    // javax.media.opengl.GL.glLoadIdentity()V
    glLoadIdentity(): void {}

    // javax.media.opengl.GL.glLoadMatrixf([FI)V
    glLoadMatrixf(m: Float32Array | null, m_offset: number): void {
        checkArrayOffset(m, m_offset, 'm_offset');
    }

    // javax.media.opengl.GL.glMatrixMode(I)V
    glMatrixMode(_mode: GLenum): void {}

    // javax.media.opengl.GL.glMultiTexCoord2f(IFF)V
    glMultiTexCoord2f(_target: GLenum, _s: GLfloat, _t: GLfloat): void {
        this.checkAvailable('glMultiTexCoord2f');
    }

    // javax.media.opengl.GL.glNewList(II)V
    glNewList(_list: GLuint, _mode: GLenum): void {}

    // javax.media.opengl.GL.glNormalPointer(IILjava/nio/Buffer;)V
    glNormalPointer(type: GLenum, stride: GLsizei, ptr: Buffer | null): void;
    // javax.media.opengl.GL.glNormalPointer(IIJ)V
    glNormalPointer(type: GLenum, stride: GLsizei, ptr_buffer_offset: bigint): void;
    glNormalPointer(_type: GLenum, _stride: GLsizei, _ptr: Buffer | null | bigint): void {}

    // javax.media.opengl.GL.glOrtho(DDDDDD)V
    glOrtho(_left: GLdouble, _right: GLdouble, _bottom: GLdouble, _top: GLdouble, _zNear: GLdouble, _zFar: GLdouble): void {}

    // javax.media.opengl.GL.glPixelStorei(II)V
    glPixelStorei(_pname: GLenum, _param: GLint): void {}

    // javax.media.opengl.GL.glPixelZoom(FF)V
    glPixelZoom(_xfactor: GLfloat, _yfactor: GLfloat): void {}

    // javax.media.opengl.GL.glPointParameterfARB(IF)V
    glPointParameterfARB(_pname: GLenum, _param: GLfloat): void {
        this.checkAvailable('glPointParameterfARB');
    }

    // javax.media.opengl.GL.glPointParameterfvARB(I[FI)V
    glPointParameterfvARB(_pname: GLenum, v: Float32Array | null, v_offset: number): void {
        checkArrayOffset(v, v_offset, 'v_offset');
        this.checkAvailable('glPointParameterfvARB');
    }

    // javax.media.opengl.GL.glPolygonMode(II)V
    glPolygonMode(_face: GLenum, _mode: GLenum): void {}

    // javax.media.opengl.GL.glPopAttrib()V
    glPopAttrib(): void {}

    // javax.media.opengl.GL.glPopMatrix()V
    glPopMatrix(): void {}

    // javax.media.opengl.GL.glProgramLocalParameter4fARB(IIFFFF)V
    glProgramLocalParameter4fARB(_target: GLenum, _index: GLuint, _x: GLfloat, _y: GLfloat, _z: GLfloat, _w: GLfloat): void {
        this.checkAvailable('glProgramLocalParameter4fARB');
    }

    // javax.media.opengl.GL.glProgramLocalParameter4fvARB(IILjava/nio/FloatBuffer;)V
    glProgramLocalParameter4fvARB(target: GLenum, index: GLuint, params: FloatBuffer | null): void;
    // javax.media.opengl.GL.glProgramLocalParameter4fvARB(II[FI)V
    glProgramLocalParameter4fvARB(target: GLenum, index: GLuint, params: Float32Array | null, params_offset: number): void;
    glProgramLocalParameter4fvARB(_target: GLenum, _index: GLuint, params: FloatBuffer | Float32Array | null, params_offset?: number): void {
        if (params_offset !== undefined) checkArrayOffset(params instanceof FloatBuffer ? null : params, params_offset, 'params_offset');
        this.checkAvailable('glProgramLocalParameter4fvARB');
    }

    // javax.media.opengl.GL.glProgramStringARB(IIILjava/lang/String;)V
    glProgramStringARB(_target: GLenum, _format: GLenum, _len: GLsizei, _string: string | null): void {
        this.checkAvailable('glProgramStringARB');
    }

    // javax.media.opengl.GL.glPushAttrib(I)V
    glPushAttrib(_mask: GLbitfield): void {}

    // javax.media.opengl.GL.glPushMatrix()V
    glPushMatrix(): void {}

    // javax.media.opengl.GL.glRasterPos2i(II)V
    glRasterPos2i(_x: GLint, _y: GLint): void {}

    // javax.media.opengl.GL.glReadBuffer(I)V
    glReadBuffer(mode: GLenum): void {
        this.readBuffer = mode;
    }

    // javax.media.opengl.GL.glRotatef(FFFF)V
    glRotatef(_angle: GLfloat, _x: GLfloat, _y: GLfloat, _z: GLfloat): void {}

    // javax.media.opengl.GL.glScalef(FFF)V
    glScalef(_x: GLfloat, _y: GLfloat, _z: GLfloat): void {}

    // javax.media.opengl.GL.glScissor(IIII)V
    glScissor(_x: GLint, _y: GLint, _width: GLsizei, _height: GLsizei): void {}

    // javax.media.opengl.GL.glShadeModel(I)V
    glShadeModel(_mode: GLenum): void {}

    // javax.media.opengl.GL.glTexCoord2f(FF)V
    glTexCoord2f(_s: GLfloat, _t: GLfloat): void {}

    // javax.media.opengl.GL.glTexCoordPointer(IIILjava/nio/Buffer;)V
    glTexCoordPointer(size: GLint, type: GLenum, stride: GLsizei, ptr: Buffer | null): void;
    // javax.media.opengl.GL.glTexCoordPointer(IIIJ)V
    glTexCoordPointer(size: GLint, type: GLenum, stride: GLsizei, ptr_buffer_offset: bigint): void;
    glTexCoordPointer(_size: GLint, _type: GLenum, _stride: GLsizei, _ptr: Buffer | null | bigint): void {}

    // javax.media.opengl.GL.glTexEnvf(IIF)V
    glTexEnvf(_target: GLenum, _pname: GLenum, _param: GLfloat): void {}

    // javax.media.opengl.GL.glTexEnvfv(II[FI)V
    glTexEnvfv(_target: GLenum, _pname: GLenum, params: Float32Array | null, params_offset: number): void {
        checkArrayOffset(params, params_offset, 'params_offset');
    }

    // javax.media.opengl.GL.glTexEnvi(III)V
    glTexEnvi(_target: GLenum, _pname: GLenum, _param: GLint): void {}

    // javax.media.opengl.GL.glTexGenfv(II[FI)V
    glTexGenfv(_coord: GLenum, _pname: GLenum, params: Float32Array | null, params_offset: number): void {
        checkArrayOffset(params, params_offset, 'params_offset');
    }

    // javax.media.opengl.GL.glTexGeni(III)V
    glTexGeni(_coord: GLenum, _pname: GLenum, _param: GLint): void {}

    // javax.media.opengl.GL.glTexImage1D(IIIIIIILjava/nio/Buffer;)V
    glTexImage1D(target: GLenum, level: GLint, _internalformat: GLint, width: GLsizei, border: GLint, _format: GLenum, _type: GLenum, _pixels: Buffer | null): void {
        this.proxyImage(target, level, border, width, 1, 1);
    }

    // javax.media.opengl.GL.glTexImage2D(IIIIIIIILjava/nio/Buffer;)V
    glTexImage2D(target: GLenum, level: GLint, _internalformat: GLint, width: GLsizei, height: GLsizei, border: GLint, _format: GLenum, _type: GLenum, _pixels: Buffer | null): void {
        this.proxyImage(target, level, border, width, height, 1);
    }

    // javax.media.opengl.GL.glTexImage3D(IIIIIIIIILjava/nio/Buffer;)V
    glTexImage3D(target: GLenum, level: GLint, _internalformat: GLint, width: GLsizei, height: GLsizei, depth: GLsizei, border: GLint, _format: GLenum, _type: GLenum, _pixels: Buffer | null): void {
        this.checkAvailable('glTexImage3D');
        this.proxyImage(target, level, border, width, height, depth);
    }

    // javax.media.opengl.GL.glTexParameteri(III)V
    glTexParameteri(_target: GLenum, _pname: GLenum, _param: GLint): void {}

    // javax.media.opengl.GL.glTranslatef(FFF)V
    glTranslatef(_x: GLfloat, _y: GLfloat, _z: GLfloat): void {}

    // javax.media.opengl.GL.glVertex2f(FF)V
    glVertex2f(_x: GLfloat, _y: GLfloat): void {}

    // javax.media.opengl.GL.glVertexPointer(IIILjava/nio/Buffer;)V
    glVertexPointer(size: GLint, type: GLenum, stride: GLsizei, ptr: Buffer | null): void;
    // javax.media.opengl.GL.glVertexPointer(IIIJ)V
    glVertexPointer(size: GLint, type: GLenum, stride: GLsizei, ptr_buffer_offset: bigint): void;
    glVertexPointer(_size: GLint, _type: GLenum, _stride: GLsizei, _ptr: Buffer | null | bigint): void {}

    // javax.media.opengl.GL.glViewport(IIII)V
    glViewport(_x: GLint, _y: GLint, _width: GLsizei, _height: GLsizei): void {}

    // javax.media.opengl.GL.isExtensionAvailable(Ljava/lang/String;)Z
    isExtensionAvailable(glExtensionName: string | null): boolean {
        return profileHasExtension(this.profile, glExtensionName);
    }

    // javax.media.opengl.GL.setSwapInterval(I)V
    setSwapInterval(_interval: number): void {}
}

const GL_FRONT = 1028;
const GL_BACK = 1029;
const DRAW_BUFFER = 3073;
const READ_BUFFER = 3074;
const LIGHT_MODEL_AMBIENT = 2899;
const PROGRAM_ERROR_POSITION_ARB = 34379;
const MAX_TEXTURE_SIZE = 3379;
const MAX_3D_TEXTURE_SIZE = 32883;
const MAX_CUBE_MAP_TEXTURE_SIZE = 34076;
const TEXTURE_WIDTH = 4096;
const TEXTURE_HEIGHT = 4097;
const TEXTURE_DEPTH = 32881;
const PROXY_TEXTURE_1D = 32867;
const PROXY_TEXTURE_2D = 32868;
const PROXY_TEXTURE_3D = 32880;
const PROXY_TEXTURE_CUBE_MAP = 34075;

// The array-offset check every array overload of com.sun.opengl.impl.GLImpl makes before its native call:
// `if (arr != null && arr.length <= offset) throw new GLException("array offset argument \"<name>\" (" + offset +
// ") equals or exceeds array length (" + arr.length + ")")`.
function checkArrayOffset(array: Int32Array | Float32Array | null, offset: number, name: string): void {
    if (array !== null && array.length <= offset) {
        throw new GLException('array offset argument "' + name + '" (' + offset + ') equals or exceeds array length (' + array.length + ')');
    }
}

// com.sun.gluegen.runtime.BufferFactory.rangeCheck([III)V. Its ArrayIndexOutOfBoundsException is an index error
// (RangeError) in the port.
function rangeCheck(array: Int32Array | null, offset: number, minElementsRemaining: number): void {
    if (array === null) return;
    if (array.length < ((offset + minElementsRemaining) | 0)) {
        throw new RangeError('Required ' + minElementsRemaining + ' elements in array, only had ' + ((array.length - offset) | 0));
    }
}

// A platform GLDrawableFactory with no device: every drawable gets NullGL contexts answering from `profile`.
// Register it with registerGLDrawableFactory(() => new NullGLDrawableFactory(profile)). Follows the
// GLDrawableFactory contract in src/jogl/GLDrawableFactory.ts.
export class NullGLDrawableFactory extends GLDrawableFactory {
    readonly profile: CapsProfile;

    constructor(profile: CapsProfile) {
        super();
        validateCapsProfile(profile);
        this.profile = profile;
    }

    // javax.media.opengl.GLDrawableFactory.getGLDrawable(Ljava/lang/Object;Ljavax/media/opengl/GLCapabilities;Ljavax/media/opengl/GLCapabilitiesChooser;)Ljavax/media/opengl/GLDrawable;
    getGLDrawable(target: object | null, capabilities: GLCapabilities | null, _chooser: GLCapabilitiesChooser | null): GLDrawable {
        if (target === null) throw new Error('IllegalArgumentException: Null target');
        return new NullGLDrawable(this.profile, capabilities === null ? new GLCapabilities() : capabilities.clone());
    }
}

// Follows the GLDrawable contract in src/jogl/GLDrawable.ts; swapBuffers presents nothing.
export class NullGLDrawable implements GLDrawable {
    readonly profile: CapsProfile;
    readonly capabilities: GLCapabilities;
    private realized = false;

    constructor(profile: CapsProfile, capabilities: GLCapabilities) {
        this.profile = profile;
        this.capabilities = capabilities;
    }

    isRealized(): boolean {
        return this.realized;
    }

    // javax.media.opengl.GLDrawable.createContext(Ljavax/media/opengl/GLContext;)Ljavax/media/opengl/GLContext;
    createContext(_shareWith: GLContext | null): GLContext {
        return new NullGLContext(this, new NullGL(this.profile, this.capabilities.getDoubleBuffered()));
    }

    // javax.media.opengl.GLDrawable.setRealized(Z)V
    setRealized(realized: boolean): void {
        this.realized = realized;
    }

    // javax.media.opengl.GLDrawable.swapBuffers()V
    swapBuffers(): void {}
}

// Follows the GLContext.makeCurrent/release/destroy/getGL contract in src/jogl/GLContext.ts: the first
// successful makeCurrent returns CONTEXT_CURRENT_NEW, later ones CONTEXT_CURRENT; an unrealized drawable or a
// destroyed context returns CONTEXT_NOT_CURRENT.
export class NullGLContext extends GLContext {
    readonly drawable: NullGLDrawable;
    private readonly gl: NullGL;
    private created = false;
    private destroyed = false;

    constructor(drawable: NullGLDrawable, gl: NullGL) {
        super();
        this.drawable = drawable;
        this.gl = gl;
    }

    // javax.media.opengl.GLContext.makeCurrent()I
    makeCurrent(): number {
        const current = GLContext.getCurrent();
        if (current === this) return GLContext.CONTEXT_CURRENT;
        if (current !== null) current.release();
        if (!this.drawable.isRealized() || this.destroyed) return GLContext.CONTEXT_NOT_CURRENT;
        const result = this.created ? GLContext.CONTEXT_CURRENT : GLContext.CONTEXT_CURRENT_NEW;
        this.created = true;
        NullGLContext.setCurrent(this);
        return result;
    }

    // javax.media.opengl.GLContext.release()V
    release(): void {
        NullGLContext.setCurrent(null);
    }

    // javax.media.opengl.GLContext.destroy()V
    destroy(): void {
        this.destroyed = true;
    }

    // javax.media.opengl.GLContext.getGL()Ljavax/media/opengl/GL;
    getGL(): GL {
        return this.gl;
    }
}
