import type Buffer from '#/util/nio/Buffer';
import type FloatBuffer from '#/util/nio/FloatBuffer';

// javax.media.opengl.GL as shipped in the 530 HD jogl.jar (JOGL 1.1.x, shrunk with ProGuard by Jagex).
//
// Surface. The shipped interface declares exactly 102 methods and no fields. 100 are invoked by
// runescape_gl.jar (out/530-hd-jogl.tsv); glPixelStorei and glGetTexLevelParameteriv are invoked only by
// jogl.jar's own GLU mipmap code (com.sun.opengl.impl.mipmap.*), which the port also needs. The interface
// below declares those 102 methods with JOGL's names, parameter order and overloads, and nothing else.
// test/hd/jogl-surface.test.ts checks it against javap of the shipped class.
//
// Java types become these TS types:
// - int, short and byte become number. Parameters typed plain `number` are Java ints with no GL typedef,
//   such as array offsets. The GL typedef aliases below show what a parameter carries.
// - float and double become number (the caller applies Math.fround at each Java float operation, so a
//   GLfloat argument is already a binary32 value).
// - boolean becomes boolean.
// - long becomes bigint. Every long the jar passes is a VBO byte offset. Each one is a long literal
//   (0/12/16/28/36) or the i2l of an int (td.w()V), so Number(offset) is exact. bigint keeps the port
//   rule (long -> bigint), and the Buffer and long overloads can be told apart with typeof.
// - float[] and int[] become Float32Array and Int32Array; String becomes string. java.nio.Buffer and
//   FloatBuffer are the src/util/nio classes.
// - Java reference parameters can be null, so those parameters are `| null`. Examples: glTexImage2D(...,
//   null) allocates, and GLU's closestFit makes proxy calls with a null Buffer.
//
// Behaviour implementations must keep. These are the Java-side checks of the shipped
// com.sun.opengl.impl.GLImpl, which a driver (NullGL, WebGpuGL) has to reproduce where the jar can see them:
// - An array overload with `arr !== null && arr.length <= offset` throws GLException('array offset argument
//   "<name>_offset" (<offset>) equals or exceeds array length (<length>)'). <name> is the parameter name
//   used below, e.g. params_offset or textures_offset.
// - gl{Vertex,Color,Normal,TexCoord}Pointer(..., Buffer) throw GLException('Argument "ptr" was not a direct
//   buffer') for a non-direct buffer (glInterleavedArrays and glDrawElements accept either kind).
// - The Buffer and long forms of gl{Vertex,Color,Normal,TexCoord}Pointer, glInterleavedArrays and
//   glDrawElements first run GLImpl.checkArrayVBODisabled/Enabled (checkElementVBODisabled/Enabled for
//   glDrawElements), which call checkBufferObject. It throws GLException('May not call this between glBegin
//   and glEnd') while inside glBegin/glEnd (the inBeginEndPair flag that GLImpl.glBegin sets and glEnd
//   clears), and for the long forms only, GLException('Required extensions not available to call this
//   function') when neither GL_VERSION_1_5 nor GL_ARB_vertex_buffer_object is available
//   (initBufferObjectExtensionChecks asks isExtensionAvailable once). No check reads which buffer is bound:
//   a Buffer form with a buffer bound, or a long form with none, goes on to the native call.
// - An extension entry point the driver does not provide throws GLException('Method "<name>" not
//   available'), as GLImpl does for a null proc address.
//
// Constants. The shipped class has no fields: javac inlined every GL_* constant into the gamepack and
// into jogl.jar, so ProGuard dropped them. The const object `GL` below holds every GL enum value that
// runescape_gl.jar passes to a GL entry point (found by constant propagation over its bytecode). It also
// holds every GL enum the GLU mipmap code (com.sun.opengl.impl.mipmap.*) compares with or passes, plus
// GL_EXTENSIONS (JOGL's FunctionAvailabilityCache). Names are the JOGL 1.1.x names (core names where GL
// 1.1-2.1 has one, ARB names otherwise). Each value matches javap -constants of JOGL 2's com.jogamp.opengl
// interfaces and of LWJGL 3.3's org.lwjgl.opengl classes, with one documented exception in the test
// (GL_UNSIGNED_INT_10_10_10_2).
//
// Why a const object named GL: Java code reads these as GL.GL_X (interface constants of
// javax.media.opengl.GL). A frozen `as const` object with the same name as the interface keeps that
// spelling in the port (`gl: GL` for the type, `GL.GL_TEXTURE_2D` for the value), keeps literal types,
// and needs one import for both. GLConstants is an alias of the same object.

// C typedef names from gl.h/glext.h, used as parameter types to document what each Java int carries.
export type GLenum = number; // a GL_* enumerant
export type GLbitfield = number; // OR-ed GL_*_BIT flags
export type GLint = number;
export type GLuint = number; // a GL object name or index, as a Java int bit pattern
export type GLsizei = number;
export type GLsizeiptrARB = number; // JOGL 1.1.x passes VBO sizes as Java int
export type GLintptrARB = number; // JOGL 1.1.x passes VBO offsets as Java int
export type GLfloat = number; // Java float (binary32 value)
export type GLclampf = number; // Java float (binary32 value)
export type GLdouble = number;
export type GLclampd = number;
export type GLubyte = number; // Java byte (-128..127, sign-extended); GL reads the low 8 bits unsigned
export type GLboolean = boolean;

export interface GL {
    glActiveTexture(texture: GLenum): void; // javax.media.opengl.GL.glActiveTexture(I)V
    glAlphaFunc(func: GLenum, ref: GLclampf): void; // javax.media.opengl.GL.glAlphaFunc(IF)V
    glBegin(mode: GLenum): void; // javax.media.opengl.GL.glBegin(I)V
    glBindBufferARB(target: GLenum, buffer: GLuint): void; // javax.media.opengl.GL.glBindBufferARB(II)V
    glBindProgramARB(target: GLenum, program: GLuint): void; // javax.media.opengl.GL.glBindProgramARB(II)V
    glBindTexture(target: GLenum, texture: GLuint): void; // javax.media.opengl.GL.glBindTexture(II)V
    glBlendFunc(sfactor: GLenum, dfactor: GLenum): void; // javax.media.opengl.GL.glBlendFunc(II)V
    glBufferDataARB(target: GLenum, size: GLsizeiptrARB, data: Buffer | null, usage: GLenum): void; // javax.media.opengl.GL.glBufferDataARB(IILjava/nio/Buffer;I)V
    glBufferSubDataARB(target: GLenum, offset: GLintptrARB, size: GLsizeiptrARB, data: Buffer | null): void; // javax.media.opengl.GL.glBufferSubDataARB(IIILjava/nio/Buffer;)V
    glCallList(list: GLuint): void; // javax.media.opengl.GL.glCallList(I)V
    glClear(mask: GLbitfield): void; // javax.media.opengl.GL.glClear(I)V
    glClearColor(red: GLclampf, green: GLclampf, blue: GLclampf, alpha: GLclampf): void; // javax.media.opengl.GL.glClearColor(FFFF)V
    glClearDepth(depth: GLclampd): void; // javax.media.opengl.GL.glClearDepth(D)V
    glClientActiveTexture(texture: GLenum): void; // javax.media.opengl.GL.glClientActiveTexture(I)V
    glColor3ub(red: GLubyte, green: GLubyte, blue: GLubyte): void; // javax.media.opengl.GL.glColor3ub(BBB)V
    glColor4f(red: GLfloat, green: GLfloat, blue: GLfloat, alpha: GLfloat): void; // javax.media.opengl.GL.glColor4f(FFFF)V
    glColor4fv(v: Float32Array | null, v_offset: number): void; // javax.media.opengl.GL.glColor4fv([FI)V
    glColor4ub(red: GLubyte, green: GLubyte, blue: GLubyte, alpha: GLubyte): void; // javax.media.opengl.GL.glColor4ub(BBBB)V
    glColorMaterial(face: GLenum, mode: GLenum): void; // javax.media.opengl.GL.glColorMaterial(II)V
    glColorPointer(size: GLint, type: GLenum, stride: GLsizei, ptr: Buffer | null): void; // javax.media.opengl.GL.glColorPointer(IIILjava/nio/Buffer;)V
    glColorPointer(size: GLint, type: GLenum, stride: GLsizei, ptr_buffer_offset: bigint): void; // javax.media.opengl.GL.glColorPointer(IIIJ)V
    glCopyPixels(x: GLint, y: GLint, width: GLsizei, height: GLsizei, type: GLenum): void; // javax.media.opengl.GL.glCopyPixels(IIIII)V
    glCullFace(mode: GLenum): void; // javax.media.opengl.GL.glCullFace(I)V
    glDeleteBuffersARB(n: GLsizei, ids: Int32Array | null, ids_offset: number): void; // javax.media.opengl.GL.glDeleteBuffersARB(I[II)V
    glDeleteLists(list: GLuint, range: GLsizei): void; // javax.media.opengl.GL.glDeleteLists(II)V
    glDeleteTextures(n: GLsizei, textures: Int32Array | null, textures_offset: number): void; // javax.media.opengl.GL.glDeleteTextures(I[II)V
    glDepthFunc(func: GLenum): void; // javax.media.opengl.GL.glDepthFunc(I)V
    glDepthMask(flag: GLboolean): void; // javax.media.opengl.GL.glDepthMask(Z)V
    glDisable(cap: GLenum): void; // javax.media.opengl.GL.glDisable(I)V
    glDisableClientState(array: GLenum): void; // javax.media.opengl.GL.glDisableClientState(I)V
    glDrawBuffer(mode: GLenum): void; // javax.media.opengl.GL.glDrawBuffer(I)V
    glDrawElements(mode: GLenum, count: GLsizei, type: GLenum, indices: Buffer | null): void; // javax.media.opengl.GL.glDrawElements(IIILjava/nio/Buffer;)V
    glDrawElements(mode: GLenum, count: GLsizei, type: GLenum, indices_buffer_offset: bigint): void; // javax.media.opengl.GL.glDrawElements(IIIJ)V
    glDrawPixels(width: GLsizei, height: GLsizei, format: GLenum, type: GLenum, pixels: Buffer | null): void; // javax.media.opengl.GL.glDrawPixels(IIIILjava/nio/Buffer;)V
    glEnable(cap: GLenum): void; // javax.media.opengl.GL.glEnable(I)V
    glEnableClientState(array: GLenum): void; // javax.media.opengl.GL.glEnableClientState(I)V
    glEnd(): void; // javax.media.opengl.GL.glEnd()V
    glEndList(): void; // javax.media.opengl.GL.glEndList()V
    glFogf(pname: GLenum, param: GLfloat): void; // javax.media.opengl.GL.glFogf(IF)V
    glFogfv(pname: GLenum, params: Float32Array | null, params_offset: number): void; // javax.media.opengl.GL.glFogfv(I[FI)V
    glFogi(pname: GLenum, param: GLint): void; // javax.media.opengl.GL.glFogi(II)V
    glGenBuffersARB(n: GLsizei, ids: Int32Array | null, ids_offset: number): void; // javax.media.opengl.GL.glGenBuffersARB(I[II)V
    glGenLists(range: GLsizei): GLuint; // javax.media.opengl.GL.glGenLists(I)I
    glGenProgramsARB(n: GLsizei, ids: Int32Array | null, ids_offset: number): void; // javax.media.opengl.GL.glGenProgramsARB(I[II)V
    glGenTextures(n: GLsizei, textures: Int32Array | null, textures_offset: number): void; // javax.media.opengl.GL.glGenTextures(I[II)V
    glGetFloatv(pname: GLenum, params: FloatBuffer | null): void; // javax.media.opengl.GL.glGetFloatv(ILjava/nio/FloatBuffer;)V
    glGetFloatv(pname: GLenum, params: Float32Array | null, params_offset: number): void; // javax.media.opengl.GL.glGetFloatv(I[FI)V
    glGetIntegerv(pname: GLenum, params: Int32Array | null, params_offset: number): void; // javax.media.opengl.GL.glGetIntegerv(I[II)V
    glGetString(name: GLenum): string | null; // javax.media.opengl.GL.glGetString(I)Ljava/lang/String;
    glGetTexLevelParameteriv(target: GLenum, level: GLint, pname: GLenum, params: Int32Array | null, params_offset: number): void; // javax.media.opengl.GL.glGetTexLevelParameteriv(III[II)V
    glHint(target: GLenum, mode: GLenum): void; // javax.media.opengl.GL.glHint(II)V
    glInterleavedArrays(format: GLenum, stride: GLsizei, pointer: Buffer | null): void; // javax.media.opengl.GL.glInterleavedArrays(IILjava/nio/Buffer;)V
    glInterleavedArrays(format: GLenum, stride: GLsizei, pointer_buffer_offset: bigint): void; // javax.media.opengl.GL.glInterleavedArrays(IIJ)V
    glLightModelfv(pname: GLenum, params: Float32Array | null, params_offset: number): void; // javax.media.opengl.GL.glLightModelfv(I[FI)V
    glLightf(light: GLenum, pname: GLenum, param: GLfloat): void; // javax.media.opengl.GL.glLightf(IIF)V
    glLightfv(light: GLenum, pname: GLenum, params: Float32Array | null, params_offset: number): void; // javax.media.opengl.GL.glLightfv(II[FI)V
    glLoadIdentity(): void; // javax.media.opengl.GL.glLoadIdentity()V
    glLoadMatrixf(m: Float32Array | null, m_offset: number): void; // javax.media.opengl.GL.glLoadMatrixf([FI)V
    glMatrixMode(mode: GLenum): void; // javax.media.opengl.GL.glMatrixMode(I)V
    glMultiTexCoord2f(target: GLenum, s: GLfloat, t: GLfloat): void; // javax.media.opengl.GL.glMultiTexCoord2f(IFF)V
    glNewList(list: GLuint, mode: GLenum): void; // javax.media.opengl.GL.glNewList(II)V
    glNormalPointer(type: GLenum, stride: GLsizei, ptr: Buffer | null): void; // javax.media.opengl.GL.glNormalPointer(IILjava/nio/Buffer;)V
    glNormalPointer(type: GLenum, stride: GLsizei, ptr_buffer_offset: bigint): void; // javax.media.opengl.GL.glNormalPointer(IIJ)V
    glOrtho(left: GLdouble, right: GLdouble, bottom: GLdouble, top: GLdouble, zNear: GLdouble, zFar: GLdouble): void; // javax.media.opengl.GL.glOrtho(DDDDDD)V
    glPixelStorei(pname: GLenum, param: GLint): void; // javax.media.opengl.GL.glPixelStorei(II)V
    glPixelZoom(xfactor: GLfloat, yfactor: GLfloat): void; // javax.media.opengl.GL.glPixelZoom(FF)V
    glPointParameterfARB(pname: GLenum, param: GLfloat): void; // javax.media.opengl.GL.glPointParameterfARB(IF)V
    glPointParameterfvARB(pname: GLenum, v: Float32Array | null, v_offset: number): void; // javax.media.opengl.GL.glPointParameterfvARB(I[FI)V
    glPolygonMode(face: GLenum, mode: GLenum): void; // javax.media.opengl.GL.glPolygonMode(II)V
    glPopAttrib(): void; // javax.media.opengl.GL.glPopAttrib()V
    glPopMatrix(): void; // javax.media.opengl.GL.glPopMatrix()V
    glProgramLocalParameter4fARB(target: GLenum, index: GLuint, x: GLfloat, y: GLfloat, z: GLfloat, w: GLfloat): void; // javax.media.opengl.GL.glProgramLocalParameter4fARB(IIFFFF)V
    glProgramLocalParameter4fvARB(target: GLenum, index: GLuint, params: FloatBuffer | null): void; // javax.media.opengl.GL.glProgramLocalParameter4fvARB(IILjava/nio/FloatBuffer;)V
    glProgramLocalParameter4fvARB(target: GLenum, index: GLuint, params: Float32Array | null, params_offset: number): void; // javax.media.opengl.GL.glProgramLocalParameter4fvARB(II[FI)V
    glProgramStringARB(target: GLenum, format: GLenum, len: GLsizei, string: string | null): void; // javax.media.opengl.GL.glProgramStringARB(IIILjava/lang/String;)V
    glPushAttrib(mask: GLbitfield): void; // javax.media.opengl.GL.glPushAttrib(I)V
    glPushMatrix(): void; // javax.media.opengl.GL.glPushMatrix()V
    glRasterPos2i(x: GLint, y: GLint): void; // javax.media.opengl.GL.glRasterPos2i(II)V
    glReadBuffer(mode: GLenum): void; // javax.media.opengl.GL.glReadBuffer(I)V
    glRotatef(angle: GLfloat, x: GLfloat, y: GLfloat, z: GLfloat): void; // javax.media.opengl.GL.glRotatef(FFFF)V
    glScalef(x: GLfloat, y: GLfloat, z: GLfloat): void; // javax.media.opengl.GL.glScalef(FFF)V
    glScissor(x: GLint, y: GLint, width: GLsizei, height: GLsizei): void; // javax.media.opengl.GL.glScissor(IIII)V
    glShadeModel(mode: GLenum): void; // javax.media.opengl.GL.glShadeModel(I)V
    glTexCoord2f(s: GLfloat, t: GLfloat): void; // javax.media.opengl.GL.glTexCoord2f(FF)V
    glTexCoordPointer(size: GLint, type: GLenum, stride: GLsizei, ptr: Buffer | null): void; // javax.media.opengl.GL.glTexCoordPointer(IIILjava/nio/Buffer;)V
    glTexCoordPointer(size: GLint, type: GLenum, stride: GLsizei, ptr_buffer_offset: bigint): void; // javax.media.opengl.GL.glTexCoordPointer(IIIJ)V
    glTexEnvf(target: GLenum, pname: GLenum, param: GLfloat): void; // javax.media.opengl.GL.glTexEnvf(IIF)V
    glTexEnvfv(target: GLenum, pname: GLenum, params: Float32Array | null, params_offset: number): void; // javax.media.opengl.GL.glTexEnvfv(II[FI)V
    glTexEnvi(target: GLenum, pname: GLenum, param: GLint): void; // javax.media.opengl.GL.glTexEnvi(III)V
    glTexGenfv(coord: GLenum, pname: GLenum, params: Float32Array | null, params_offset: number): void; // javax.media.opengl.GL.glTexGenfv(II[FI)V
    glTexGeni(coord: GLenum, pname: GLenum, param: GLint): void; // javax.media.opengl.GL.glTexGeni(III)V
    glTexImage1D(target: GLenum, level: GLint, internalformat: GLint, width: GLsizei, border: GLint, format: GLenum, type: GLenum, pixels: Buffer | null): void; // javax.media.opengl.GL.glTexImage1D(IIIIIIILjava/nio/Buffer;)V
    glTexImage2D(target: GLenum, level: GLint, internalformat: GLint, width: GLsizei, height: GLsizei, border: GLint, format: GLenum, type: GLenum, pixels: Buffer | null): void; // javax.media.opengl.GL.glTexImage2D(IIIIIIIILjava/nio/Buffer;)V
    glTexImage3D(target: GLenum, level: GLint, internalformat: GLint, width: GLsizei, height: GLsizei, depth: GLsizei, border: GLint, format: GLenum, type: GLenum, pixels: Buffer | null): void; // javax.media.opengl.GL.glTexImage3D(IIIIIIIIILjava/nio/Buffer;)V
    glTexParameteri(target: GLenum, pname: GLenum, param: GLint): void; // javax.media.opengl.GL.glTexParameteri(III)V
    glTranslatef(x: GLfloat, y: GLfloat, z: GLfloat): void; // javax.media.opengl.GL.glTranslatef(FFF)V
    glVertex2f(x: GLfloat, y: GLfloat): void; // javax.media.opengl.GL.glVertex2f(FF)V
    glVertexPointer(size: GLint, type: GLenum, stride: GLsizei, ptr: Buffer | null): void; // javax.media.opengl.GL.glVertexPointer(IIILjava/nio/Buffer;)V
    glVertexPointer(size: GLint, type: GLenum, stride: GLsizei, ptr_buffer_offset: bigint): void; // javax.media.opengl.GL.glVertexPointer(IIIJ)V
    glViewport(x: GLint, y: GLint, width: GLsizei, height: GLsizei): void; // javax.media.opengl.GL.glViewport(IIII)V
    isExtensionAvailable(glExtensionName: string | null): boolean; // javax.media.opengl.GL.isExtensionAvailable(Ljava/lang/String;)Z
    setSwapInterval(interval: number): void; // javax.media.opengl.GL.setSwapInterval(I)V
}

// JOGL 1.1.x javax.media.opengl.GL constant fields, which javac inlined into both jars (see the header).
export const GL = Object.freeze({
    // Primitives (glBegin, glDrawElements)
    GL_LINES: 1, // javax.media.opengl.GL.GL_LINES:I
    GL_LINE_LOOP: 2, // javax.media.opengl.GL.GL_LINE_LOOP:I
    GL_TRIANGLES: 4, // javax.media.opengl.GL.GL_TRIANGLES:I
    GL_TRIANGLE_FAN: 6, // javax.media.opengl.GL.GL_TRIANGLE_FAN:I

    // Blend factors (glBlendFunc) and combiner operands (glTexEnvi OPERANDn_RGB)
    GL_ONE: 1, // javax.media.opengl.GL.GL_ONE:I
    GL_SRC_COLOR: 768, // javax.media.opengl.GL.GL_SRC_COLOR:I
    GL_SRC_ALPHA: 770, // javax.media.opengl.GL.GL_SRC_ALPHA:I
    GL_ONE_MINUS_SRC_ALPHA: 771, // javax.media.opengl.GL.GL_ONE_MINUS_SRC_ALPHA:I
    GL_DST_COLOR: 774, // javax.media.opengl.GL.GL_DST_COLOR:I

    // Comparison functions (glDepthFunc, glAlphaFunc)
    GL_LEQUAL: 515, // javax.media.opengl.GL.GL_LEQUAL:I
    GL_GREATER: 516, // javax.media.opengl.GL.GL_GREATER:I

    // Bitfields (glClear, glPushAttrib)
    GL_FOG_BIT: 128, // javax.media.opengl.GL.GL_FOG_BIT:I
    GL_DEPTH_BUFFER_BIT: 256, // javax.media.opengl.GL.GL_DEPTH_BUFFER_BIT:I
    GL_ENABLE_BIT: 8192, // javax.media.opengl.GL.GL_ENABLE_BIT:I
    GL_COLOR_BUFFER_BIT: 16384, // javax.media.opengl.GL.GL_COLOR_BUFFER_BIT:I

    // Buffers and faces (glDrawBuffer, glReadBuffer, glCullFace, glColorMaterial, glPolygonMode)
    GL_FRONT_LEFT: 1024, // javax.media.opengl.GL.GL_FRONT_LEFT:I
    GL_BACK_LEFT: 1026, // javax.media.opengl.GL.GL_BACK_LEFT:I
    GL_FRONT: 1028, // javax.media.opengl.GL.GL_FRONT:I
    GL_BACK: 1029, // javax.media.opengl.GL.GL_BACK:I

    // Capabilities (glEnable, glDisable)
    GL_CULL_FACE: 2884, // javax.media.opengl.GL.GL_CULL_FACE:I
    GL_LIGHTING: 2896, // javax.media.opengl.GL.GL_LIGHTING:I
    GL_COLOR_MATERIAL: 2903, // javax.media.opengl.GL.GL_COLOR_MATERIAL:I
    GL_FOG: 2912, // javax.media.opengl.GL.GL_FOG:I
    GL_DEPTH_TEST: 2929, // javax.media.opengl.GL.GL_DEPTH_TEST:I
    GL_ALPHA_TEST: 3008, // javax.media.opengl.GL.GL_ALPHA_TEST:I
    GL_BLEND: 3042, // javax.media.opengl.GL.GL_BLEND:I
    GL_SCISSOR_TEST: 3089, // javax.media.opengl.GL.GL_SCISSOR_TEST:I
    GL_TEXTURE_GEN_S: 3168, // javax.media.opengl.GL.GL_TEXTURE_GEN_S:I
    GL_TEXTURE_GEN_T: 3169, // javax.media.opengl.GL.GL_TEXTURE_GEN_T:I
    GL_TEXTURE_GEN_R: 3170, // javax.media.opengl.GL.GL_TEXTURE_GEN_R:I
    GL_TEXTURE_GEN_Q: 3171, // javax.media.opengl.GL.GL_TEXTURE_GEN_Q:I
    GL_TEXTURE_1D: 3552, // javax.media.opengl.GL.GL_TEXTURE_1D:I
    GL_TEXTURE_2D: 3553, // javax.media.opengl.GL.GL_TEXTURE_2D:I
    GL_TEXTURE_3D: 32879, // javax.media.opengl.GL.GL_TEXTURE_3D:I
    GL_TEXTURE_CUBE_MAP: 34067, // javax.media.opengl.GL.GL_TEXTURE_CUBE_MAP:I
    GL_VERTEX_PROGRAM_ARB: 34336, // javax.media.opengl.GL.GL_VERTEX_PROGRAM_ARB:I
    GL_FRAGMENT_PROGRAM_ARB: 34820, // javax.media.opengl.GL.GL_FRAGMENT_PROGRAM_ARB:I
    // LIGHT2 and LIGHT3 are never used; jf addresses LIGHT4..LIGHT7 as `n + 16384 + 4`.
    GL_LIGHT0: 16384, // javax.media.opengl.GL.GL_LIGHT0:I
    GL_LIGHT1: 16385, // javax.media.opengl.GL.GL_LIGHT1:I
    GL_LIGHT4: 16388, // javax.media.opengl.GL.GL_LIGHT4:I
    GL_LIGHT5: 16389, // javax.media.opengl.GL.GL_LIGHT5:I
    GL_LIGHT6: 16390, // javax.media.opengl.GL.GL_LIGHT6:I
    GL_LIGHT7: 16391, // javax.media.opengl.GL.GL_LIGHT7:I

    // Lighting (glLightf, glLightfv, glLightModelfv, glColorMaterial)
    GL_LIGHT_MODEL_AMBIENT: 2899, // javax.media.opengl.GL.GL_LIGHT_MODEL_AMBIENT:I
    GL_AMBIENT: 4608, // javax.media.opengl.GL.GL_AMBIENT:I
    GL_DIFFUSE: 4609, // javax.media.opengl.GL.GL_DIFFUSE:I
    GL_POSITION: 4611, // javax.media.opengl.GL.GL_POSITION:I
    GL_CONSTANT_ATTENUATION: 4615, // javax.media.opengl.GL.GL_CONSTANT_ATTENUATION:I
    GL_LINEAR_ATTENUATION: 4616, // javax.media.opengl.GL.GL_LINEAR_ATTENUATION:I
    GL_QUADRATIC_ATTENUATION: 4617, // javax.media.opengl.GL.GL_QUADRATIC_ATTENUATION:I
    GL_AMBIENT_AND_DIFFUSE: 5634, // javax.media.opengl.GL.GL_AMBIENT_AND_DIFFUSE:I

    // Fog (glFogf, glFogfv, glFogi, glHint). glHint(GL_FOG_HINT, 4353) passes GL_FASTEST (mk.a(II)V pc113;
    // gl-state/calls.tsv mislabels 4353 as NICEST, which is 4354).
    GL_FOG_DENSITY: 2914, // javax.media.opengl.GL.GL_FOG_DENSITY:I
    GL_FOG_START: 2915, // javax.media.opengl.GL.GL_FOG_START:I
    GL_FOG_END: 2916, // javax.media.opengl.GL.GL_FOG_END:I
    GL_FOG_MODE: 2917, // javax.media.opengl.GL.GL_FOG_MODE:I
    GL_FOG_COLOR: 2918, // javax.media.opengl.GL.GL_FOG_COLOR:I
    GL_FOG_HINT: 3156, // javax.media.opengl.GL.GL_FOG_HINT:I
    GL_FASTEST: 4353, // javax.media.opengl.GL.GL_FASTEST:I

    // Queries (glGetIntegerv, glGetFloatv, glGetString, glGetTexLevelParameteriv) and point parameters
    GL_DRAW_BUFFER: 3073, // javax.media.opengl.GL.GL_DRAW_BUFFER:I
    GL_READ_BUFFER: 3074, // javax.media.opengl.GL.GL_READ_BUFFER:I
    GL_MAX_TEXTURE_SIZE: 3379, // javax.media.opengl.GL.GL_MAX_TEXTURE_SIZE:I
    GL_TEXTURE_WIDTH: 4096, // javax.media.opengl.GL.GL_TEXTURE_WIDTH:I
    GL_VENDOR: 7936, // javax.media.opengl.GL.GL_VENDOR:I
    GL_RENDERER: 7937, // javax.media.opengl.GL.GL_RENDERER:I
    GL_VERSION: 7938, // javax.media.opengl.GL.GL_VERSION:I
    GL_EXTENSIONS: 7939, // javax.media.opengl.GL.GL_EXTENSIONS:I
    GL_POINT_SIZE_MIN: 33062, // javax.media.opengl.GL.GL_POINT_SIZE_MIN:I
    GL_POINT_SIZE_MAX: 33063, // javax.media.opengl.GL.GL_POINT_SIZE_MAX:I
    GL_POINT_DISTANCE_ATTENUATION: 33065, // javax.media.opengl.GL.GL_POINT_DISTANCE_ATTENUATION:I
    GL_MAX_TEXTURE_UNITS: 34018, // javax.media.opengl.GL.GL_MAX_TEXTURE_UNITS:I
    GL_PROGRAM_ERROR_POSITION_ARB: 34379, // javax.media.opengl.GL.GL_PROGRAM_ERROR_POSITION_ARB:I
    GL_MAX_TEXTURE_COORDS: 34929, // javax.media.opengl.GL.GL_MAX_TEXTURE_COORDS:I
    GL_MAX_TEXTURE_IMAGE_UNITS: 34930, // javax.media.opengl.GL.GL_MAX_TEXTURE_IMAGE_UNITS:I

    // Pixel storage (GLU mipmap: glPixelStorei, glGetIntegerv)
    GL_UNPACK_SWAP_BYTES: 3312, // javax.media.opengl.GL.GL_UNPACK_SWAP_BYTES:I
    GL_UNPACK_LSB_FIRST: 3313, // javax.media.opengl.GL.GL_UNPACK_LSB_FIRST:I
    GL_UNPACK_ROW_LENGTH: 3314, // javax.media.opengl.GL.GL_UNPACK_ROW_LENGTH:I
    GL_UNPACK_SKIP_ROWS: 3315, // javax.media.opengl.GL.GL_UNPACK_SKIP_ROWS:I
    GL_UNPACK_SKIP_PIXELS: 3316, // javax.media.opengl.GL.GL_UNPACK_SKIP_PIXELS:I
    GL_UNPACK_ALIGNMENT: 3317, // javax.media.opengl.GL.GL_UNPACK_ALIGNMENT:I
    GL_PACK_SWAP_BYTES: 3328, // javax.media.opengl.GL.GL_PACK_SWAP_BYTES:I
    GL_PACK_LSB_FIRST: 3329, // javax.media.opengl.GL.GL_PACK_LSB_FIRST:I
    GL_PACK_ROW_LENGTH: 3330, // javax.media.opengl.GL.GL_PACK_ROW_LENGTH:I
    GL_PACK_SKIP_ROWS: 3331, // javax.media.opengl.GL.GL_PACK_SKIP_ROWS:I
    GL_PACK_SKIP_PIXELS: 3332, // javax.media.opengl.GL.GL_PACK_SKIP_PIXELS:I
    GL_PACK_ALIGNMENT: 3333, // javax.media.opengl.GL.GL_PACK_ALIGNMENT:I

    // Lists, matrices, copies, rasterization (glNewList, glMatrixMode, glCopyPixels, glPolygonMode, glShadeModel)
    GL_COMPILE: 4864, // javax.media.opengl.GL.GL_COMPILE:I
    GL_MODELVIEW: 5888, // javax.media.opengl.GL.GL_MODELVIEW:I
    GL_PROJECTION: 5889, // javax.media.opengl.GL.GL_PROJECTION:I
    GL_TEXTURE: 5890, // javax.media.opengl.GL.GL_TEXTURE:I
    GL_COLOR: 6144, // javax.media.opengl.GL.GL_COLOR:I
    GL_FILL: 6914, // javax.media.opengl.GL.GL_FILL:I
    GL_SMOOTH: 7425, // javax.media.opengl.GL.GL_SMOOTH:I

    // Data types (pointers, glDrawElements, pixel transfers; GLU mipmap type checks)
    GL_BYTE: 5120, // javax.media.opengl.GL.GL_BYTE:I
    GL_UNSIGNED_BYTE: 5121, // javax.media.opengl.GL.GL_UNSIGNED_BYTE:I
    GL_SHORT: 5122, // javax.media.opengl.GL.GL_SHORT:I
    GL_UNSIGNED_SHORT: 5123, // javax.media.opengl.GL.GL_UNSIGNED_SHORT:I
    GL_INT: 5124, // javax.media.opengl.GL.GL_INT:I
    GL_UNSIGNED_INT: 5125, // javax.media.opengl.GL.GL_UNSIGNED_INT:I
    GL_FLOAT: 5126, // javax.media.opengl.GL.GL_FLOAT:I
    GL_UNSIGNED_BYTE_3_3_2: 32818, // javax.media.opengl.GL.GL_UNSIGNED_BYTE_3_3_2:I
    GL_UNSIGNED_SHORT_4_4_4_4: 32819, // javax.media.opengl.GL.GL_UNSIGNED_SHORT_4_4_4_4:I
    GL_UNSIGNED_SHORT_5_5_5_1: 32820, // javax.media.opengl.GL.GL_UNSIGNED_SHORT_5_5_5_1:I
    GL_UNSIGNED_INT_8_8_8_8: 32821, // javax.media.opengl.GL.GL_UNSIGNED_INT_8_8_8_8:I
    GL_UNSIGNED_INT_10_10_10_2: 32822, // javax.media.opengl.GL.GL_UNSIGNED_INT_10_10_10_2:I
    GL_UNSIGNED_BYTE_2_3_3_REV: 33634, // javax.media.opengl.GL.GL_UNSIGNED_BYTE_2_3_3_REV:I
    GL_UNSIGNED_SHORT_5_6_5: 33635, // javax.media.opengl.GL.GL_UNSIGNED_SHORT_5_6_5:I
    GL_UNSIGNED_SHORT_5_6_5_REV: 33636, // javax.media.opengl.GL.GL_UNSIGNED_SHORT_5_6_5_REV:I
    GL_UNSIGNED_SHORT_4_4_4_4_REV: 33637, // javax.media.opengl.GL.GL_UNSIGNED_SHORT_4_4_4_4_REV:I
    GL_UNSIGNED_SHORT_1_5_5_5_REV: 33638, // javax.media.opengl.GL.GL_UNSIGNED_SHORT_1_5_5_5_REV:I
    GL_UNSIGNED_INT_8_8_8_8_REV: 33639, // javax.media.opengl.GL.GL_UNSIGNED_INT_8_8_8_8_REV:I
    GL_UNSIGNED_INT_2_10_10_10_REV: 33640, // javax.media.opengl.GL.GL_UNSIGNED_INT_2_10_10_10_REV:I

    // Pixel formats (glTexImage*, glDrawPixels; GLU mipmap format checks)
    GL_COLOR_INDEX: 6400, // javax.media.opengl.GL.GL_COLOR_INDEX:I
    GL_STENCIL_INDEX: 6401, // javax.media.opengl.GL.GL_STENCIL_INDEX:I
    GL_DEPTH_COMPONENT: 6402, // javax.media.opengl.GL.GL_DEPTH_COMPONENT:I
    GL_RED: 6403, // javax.media.opengl.GL.GL_RED:I
    GL_GREEN: 6404, // javax.media.opengl.GL.GL_GREEN:I
    GL_BLUE: 6405, // javax.media.opengl.GL.GL_BLUE:I
    GL_ALPHA: 6406, // javax.media.opengl.GL.GL_ALPHA:I
    GL_RGB: 6407, // javax.media.opengl.GL.GL_RGB:I
    GL_RGBA: 6408, // javax.media.opengl.GL.GL_RGBA:I
    GL_LUMINANCE: 6409, // javax.media.opengl.GL.GL_LUMINANCE:I
    GL_LUMINANCE_ALPHA: 6410, // javax.media.opengl.GL.GL_LUMINANCE_ALPHA:I
    GL_BITMAP: 6656, // javax.media.opengl.GL.GL_BITMAP:I
    GL_BGR: 32992, // javax.media.opengl.GL.GL_BGR:I
    GL_BGRA: 32993, // javax.media.opengl.GL.GL_BGRA:I

    // Texture environment and combiners (glTexEnvi, glTexEnvf, glTexEnvfv)
    GL_ADD: 260, // javax.media.opengl.GL.GL_ADD:I
    GL_REPLACE: 7681, // javax.media.opengl.GL.GL_REPLACE:I
    GL_MODULATE: 8448, // javax.media.opengl.GL.GL_MODULATE:I
    GL_TEXTURE_ENV_MODE: 8704, // javax.media.opengl.GL.GL_TEXTURE_ENV_MODE:I
    GL_TEXTURE_ENV_COLOR: 8705, // javax.media.opengl.GL.GL_TEXTURE_ENV_COLOR:I
    GL_TEXTURE_ENV: 8960, // javax.media.opengl.GL.GL_TEXTURE_ENV:I
    GL_SUBTRACT: 34023, // javax.media.opengl.GL.GL_SUBTRACT:I
    GL_COMBINE: 34160, // javax.media.opengl.GL.GL_COMBINE:I
    GL_COMBINE_RGB: 34161, // javax.media.opengl.GL.GL_COMBINE_RGB:I
    GL_COMBINE_ALPHA: 34162, // javax.media.opengl.GL.GL_COMBINE_ALPHA:I
    GL_RGB_SCALE: 34163, // javax.media.opengl.GL.GL_RGB_SCALE:I
    GL_ADD_SIGNED: 34164, // javax.media.opengl.GL.GL_ADD_SIGNED:I
    GL_INTERPOLATE: 34165, // javax.media.opengl.GL.GL_INTERPOLATE:I
    GL_CONSTANT: 34166, // javax.media.opengl.GL.GL_CONSTANT:I
    GL_PRIMARY_COLOR: 34167, // javax.media.opengl.GL.GL_PRIMARY_COLOR:I
    GL_PREVIOUS: 34168, // javax.media.opengl.GL.GL_PREVIOUS:I
    GL_SOURCE0_RGB: 34176, // javax.media.opengl.GL.GL_SOURCE0_RGB:I
    GL_SOURCE1_RGB: 34177, // javax.media.opengl.GL.GL_SOURCE1_RGB:I
    GL_SOURCE2_RGB: 34178, // javax.media.opengl.GL.GL_SOURCE2_RGB:I
    GL_SOURCE0_ALPHA: 34184, // javax.media.opengl.GL.GL_SOURCE0_ALPHA:I
    GL_SOURCE1_ALPHA: 34185, // javax.media.opengl.GL.GL_SOURCE1_ALPHA:I
    GL_SOURCE2_ALPHA: 34186, // javax.media.opengl.GL.GL_SOURCE2_ALPHA:I
    GL_OPERAND0_RGB: 34192, // javax.media.opengl.GL.GL_OPERAND0_RGB:I
    GL_OPERAND1_RGB: 34193, // javax.media.opengl.GL.GL_OPERAND1_RGB:I

    // Texture coordinate generation (glTexGeni, glTexGenfv)
    GL_S: 8192, // javax.media.opengl.GL.GL_S:I
    GL_T: 8193, // javax.media.opengl.GL.GL_T:I
    GL_R: 8194, // javax.media.opengl.GL.GL_R:I
    GL_Q: 8195, // javax.media.opengl.GL.GL_Q:I
    GL_EYE_LINEAR: 9216, // javax.media.opengl.GL.GL_EYE_LINEAR:I
    GL_OBJECT_LINEAR: 9217, // javax.media.opengl.GL.GL_OBJECT_LINEAR:I
    GL_TEXTURE_GEN_MODE: 9472, // javax.media.opengl.GL.GL_TEXTURE_GEN_MODE:I
    GL_OBJECT_PLANE: 9473, // javax.media.opengl.GL.GL_OBJECT_PLANE:I
    GL_EYE_PLANE: 9474, // javax.media.opengl.GL.GL_EYE_PLANE:I
    GL_NORMAL_MAP: 34065, // javax.media.opengl.GL.GL_NORMAL_MAP:I

    // Texture objects and parameters (glTexParameteri, glTexImage*, glActiveTexture; GLU proxies)
    GL_NEAREST: 9728, // javax.media.opengl.GL.GL_NEAREST:I
    GL_LINEAR: 9729, // javax.media.opengl.GL.GL_LINEAR:I
    GL_LINEAR_MIPMAP_LINEAR: 9987, // javax.media.opengl.GL.GL_LINEAR_MIPMAP_LINEAR:I
    GL_TEXTURE_MAG_FILTER: 10240, // javax.media.opengl.GL.GL_TEXTURE_MAG_FILTER:I
    GL_TEXTURE_MIN_FILTER: 10241, // javax.media.opengl.GL.GL_TEXTURE_MIN_FILTER:I
    GL_TEXTURE_WRAP_S: 10242, // javax.media.opengl.GL.GL_TEXTURE_WRAP_S:I
    GL_TEXTURE_WRAP_T: 10243, // javax.media.opengl.GL.GL_TEXTURE_WRAP_T:I
    GL_REPEAT: 10497, // javax.media.opengl.GL.GL_REPEAT:I
    GL_TEXTURE_WRAP_R: 32882, // javax.media.opengl.GL.GL_TEXTURE_WRAP_R:I
    GL_CLAMP_TO_EDGE: 33071, // javax.media.opengl.GL.GL_CLAMP_TO_EDGE:I
    GL_PROXY_TEXTURE_1D: 32867, // javax.media.opengl.GL.GL_PROXY_TEXTURE_1D:I
    GL_PROXY_TEXTURE_2D: 32868, // javax.media.opengl.GL.GL_PROXY_TEXTURE_2D:I
    GL_TEXTURE0: 33984, // javax.media.opengl.GL.GL_TEXTURE0:I
    GL_TEXTURE1: 33985, // javax.media.opengl.GL.GL_TEXTURE1:I
    GL_TEXTURE2: 33986, // javax.media.opengl.GL.GL_TEXTURE2:I
    // vm.e()V uploads the six faces as `34069 + i`.
    GL_TEXTURE_CUBE_MAP_POSITIVE_X: 34069, // javax.media.opengl.GL.GL_TEXTURE_CUBE_MAP_POSITIVE_X:I
    GL_TEXTURE_CUBE_MAP_NEGATIVE_X: 34070, // javax.media.opengl.GL.GL_TEXTURE_CUBE_MAP_NEGATIVE_X:I
    GL_TEXTURE_CUBE_MAP_POSITIVE_Y: 34071, // javax.media.opengl.GL.GL_TEXTURE_CUBE_MAP_POSITIVE_Y:I
    GL_TEXTURE_CUBE_MAP_NEGATIVE_Y: 34072, // javax.media.opengl.GL.GL_TEXTURE_CUBE_MAP_NEGATIVE_Y:I
    GL_TEXTURE_CUBE_MAP_POSITIVE_Z: 34073, // javax.media.opengl.GL.GL_TEXTURE_CUBE_MAP_POSITIVE_Z:I
    GL_TEXTURE_CUBE_MAP_NEGATIVE_Z: 34074, // javax.media.opengl.GL.GL_TEXTURE_CUBE_MAP_NEGATIVE_Z:I
    GL_PROXY_TEXTURE_CUBE_MAP: 34075, // javax.media.opengl.GL.GL_PROXY_TEXTURE_CUBE_MAP:I

    // Client arrays and interleaved formats (gl*ClientState, glInterleavedArrays)
    GL_VERTEX_ARRAY: 32884, // javax.media.opengl.GL.GL_VERTEX_ARRAY:I
    GL_NORMAL_ARRAY: 32885, // javax.media.opengl.GL.GL_NORMAL_ARRAY:I
    GL_COLOR_ARRAY: 32886, // javax.media.opengl.GL.GL_COLOR_ARRAY:I
    GL_TEXTURE_COORD_ARRAY: 32888, // javax.media.opengl.GL.GL_TEXTURE_COORD_ARRAY:I
    GL_C4UB_V3F: 10787, // javax.media.opengl.GL.GL_C4UB_V3F:I
    GL_T2F_V3F: 10791, // javax.media.opengl.GL.GL_T2F_V3F:I

    // Buffer objects (glBindBufferARB, glBufferDataARB)
    GL_ARRAY_BUFFER: 34962, // javax.media.opengl.GL.GL_ARRAY_BUFFER:I
    GL_ELEMENT_ARRAY_BUFFER: 34963, // javax.media.opengl.GL.GL_ELEMENT_ARRAY_BUFFER:I
    GL_STREAM_DRAW: 35040, // javax.media.opengl.GL.GL_STREAM_DRAW:I
    GL_STATIC_DRAW: 35044, // javax.media.opengl.GL.GL_STATIC_DRAW:I

    // ARB vertex program (glProgramStringARB; rd.f()V pc39 passes 34933 as the format. gl-state/calls.tsv
    // mislabels it PROGRAM_STRING_ARB, which is 34344)
    GL_PROGRAM_FORMAT_ASCII_ARB: 34933 // javax.media.opengl.GL.GL_PROGRAM_FORMAT_ASCII_ARB:I
} as const);

export const GLConstants = GL;

export type GLMethod = readonly [name: keyof GL, descriptor: string];

// The JVM descriptor of every javax.media.opengl.GL method, in the shipped class's order. A recorder or
// proxy can use it to tell float from int arguments (both are JS numbers) and to pick an overload's trace
// form. test/hd/jogl-surface.test.ts checks it against javap and against the interface above.
export const glMethods: readonly GLMethod[] = Object.freeze([
    ['glActiveTexture', '(I)V'],
    ['glAlphaFunc', '(IF)V'],
    ['glBegin', '(I)V'],
    ['glBindBufferARB', '(II)V'],
    ['glBindProgramARB', '(II)V'],
    ['glBindTexture', '(II)V'],
    ['glBlendFunc', '(II)V'],
    ['glBufferDataARB', '(IILjava/nio/Buffer;I)V'],
    ['glBufferSubDataARB', '(IIILjava/nio/Buffer;)V'],
    ['glCallList', '(I)V'],
    ['glClear', '(I)V'],
    ['glClearColor', '(FFFF)V'],
    ['glClearDepth', '(D)V'],
    ['glClientActiveTexture', '(I)V'],
    ['glColor3ub', '(BBB)V'],
    ['glColor4f', '(FFFF)V'],
    ['glColor4fv', '([FI)V'],
    ['glColor4ub', '(BBBB)V'],
    ['glColorMaterial', '(II)V'],
    ['glColorPointer', '(IIILjava/nio/Buffer;)V'],
    ['glColorPointer', '(IIIJ)V'],
    ['glCopyPixels', '(IIIII)V'],
    ['glCullFace', '(I)V'],
    ['glDeleteBuffersARB', '(I[II)V'],
    ['glDeleteLists', '(II)V'],
    ['glDeleteTextures', '(I[II)V'],
    ['glDepthFunc', '(I)V'],
    ['glDepthMask', '(Z)V'],
    ['glDisable', '(I)V'],
    ['glDisableClientState', '(I)V'],
    ['glDrawBuffer', '(I)V'],
    ['glDrawElements', '(IIILjava/nio/Buffer;)V'],
    ['glDrawElements', '(IIIJ)V'],
    ['glDrawPixels', '(IIIILjava/nio/Buffer;)V'],
    ['glEnable', '(I)V'],
    ['glEnableClientState', '(I)V'],
    ['glEnd', '()V'],
    ['glEndList', '()V'],
    ['glFogf', '(IF)V'],
    ['glFogfv', '(I[FI)V'],
    ['glFogi', '(II)V'],
    ['glGenBuffersARB', '(I[II)V'],
    ['glGenLists', '(I)I'],
    ['glGenProgramsARB', '(I[II)V'],
    ['glGenTextures', '(I[II)V'],
    ['glGetFloatv', '(ILjava/nio/FloatBuffer;)V'],
    ['glGetFloatv', '(I[FI)V'],
    ['glGetIntegerv', '(I[II)V'],
    ['glGetString', '(I)Ljava/lang/String;'],
    ['glGetTexLevelParameteriv', '(III[II)V'],
    ['glHint', '(II)V'],
    ['glInterleavedArrays', '(IILjava/nio/Buffer;)V'],
    ['glInterleavedArrays', '(IIJ)V'],
    ['glLightModelfv', '(I[FI)V'],
    ['glLightf', '(IIF)V'],
    ['glLightfv', '(II[FI)V'],
    ['glLoadIdentity', '()V'],
    ['glLoadMatrixf', '([FI)V'],
    ['glMatrixMode', '(I)V'],
    ['glMultiTexCoord2f', '(IFF)V'],
    ['glNewList', '(II)V'],
    ['glNormalPointer', '(IILjava/nio/Buffer;)V'],
    ['glNormalPointer', '(IIJ)V'],
    ['glOrtho', '(DDDDDD)V'],
    ['glPixelStorei', '(II)V'],
    ['glPixelZoom', '(FF)V'],
    ['glPointParameterfARB', '(IF)V'],
    ['glPointParameterfvARB', '(I[FI)V'],
    ['glPolygonMode', '(II)V'],
    ['glPopAttrib', '()V'],
    ['glPopMatrix', '()V'],
    ['glProgramLocalParameter4fARB', '(IIFFFF)V'],
    ['glProgramLocalParameter4fvARB', '(IILjava/nio/FloatBuffer;)V'],
    ['glProgramLocalParameter4fvARB', '(II[FI)V'],
    ['glProgramStringARB', '(IIILjava/lang/String;)V'],
    ['glPushAttrib', '(I)V'],
    ['glPushMatrix', '()V'],
    ['glRasterPos2i', '(II)V'],
    ['glReadBuffer', '(I)V'],
    ['glRotatef', '(FFFF)V'],
    ['glScalef', '(FFF)V'],
    ['glScissor', '(IIII)V'],
    ['glShadeModel', '(I)V'],
    ['glTexCoord2f', '(FF)V'],
    ['glTexCoordPointer', '(IIILjava/nio/Buffer;)V'],
    ['glTexCoordPointer', '(IIIJ)V'],
    ['glTexEnvf', '(IIF)V'],
    ['glTexEnvfv', '(II[FI)V'],
    ['glTexEnvi', '(III)V'],
    ['glTexGenfv', '(II[FI)V'],
    ['glTexGeni', '(III)V'],
    ['glTexImage1D', '(IIIIIIILjava/nio/Buffer;)V'],
    ['glTexImage2D', '(IIIIIIIILjava/nio/Buffer;)V'],
    ['glTexImage3D', '(IIIIIIIIILjava/nio/Buffer;)V'],
    ['glTexParameteri', '(III)V'],
    ['glTranslatef', '(FFF)V'],
    ['glVertex2f', '(FF)V'],
    ['glVertexPointer', '(IIILjava/nio/Buffer;)V'],
    ['glVertexPointer', '(IIIJ)V'],
    ['glViewport', '(IIII)V'],
    ['isExtensionAvailable', '(Ljava/lang/String;)Z'],
    ['setSwapInterval', '(I)V']
] as const);
