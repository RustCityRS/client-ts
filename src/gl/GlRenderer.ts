import Pix3D from '#/dash3d/Pix3D';
import JagString, { fromLiteral } from '#/datastruct/JagString';
import { GL } from '#/jogl/GL';
import GLCapabilities from '#/jogl/GLCapabilities';
import GLContext from '#/jogl/GLContext';
import type GLDrawable from '#/jogl/GLDrawable';
import type { WebGpuDrawable } from './driver/WebGpuDrawableFactory';
import GLDrawableFactory from '#/jogl/GLDrawableFactory';
import GLU from '#/jogl/GLU';
import Preferences from '#/ui/Preferences';
import { intDivide } from '#/util/IntUtils';
import { arrayAtI32, arrayAtObj, arrayPutF32, arrayPutU8, requireNonNull } from '#/util/JavaArray';
import { JavaError } from '#/util/JavaException';
import ThreadUtils from '#/util/ThreadUtils';
import ByteOrder from '#/util/nio/ByteOrder';
import FloatBuffer from '#/util/nio/FloatBuffer';
import IntBuffer from '#/util/nio/IntBuffer';
import GlCleaner from './GlCleaner';
import GlLighting from './GlLighting';
import PointLightManager from './PointLightManager';
import MaterialManager from '#/gl/material/MaterialManager';

// tf in runescape_gl.jar (HD only, all static): the GL renderer. It owns the JOGL drawable and context on the game
// canvas (init, tf.a(Ljava/awt/Canvas;I)I; shutdown, tf.o()V), probes the driver (tf.m()I), sets the initial GL state
// (tf.s()V, tf.f()V), caches the state the client toggles most (2D texture binding, texture-environment combine modes,
// lighting, fog, depth test, normal array), builds the 2D ortho and 3D projections (including the per-level depth bias
// of tf.a(FF)V, which edits proj[10] and proj[14] in place), clears, swaps (tf.d()V) and copies the front buffer to the
// back buffer (tf.h()V). `active` (tf.w) is the client's renderer switch. NXT has no GL 1.x classes, so the names are
// descriptive (HD_PLAN.md 1.3). Statics are declared in classfile order with their tf.<clinit>()V values; the
// initializer stores h, d, n, l, u, w, s, q, x, o, m, g, i, j, F and then I, and the rest keep their JVM defaults.
export default class GlRenderer {
    private static vendor: string | null = null; // tf.a:Ljava/lang/String; (GL_VENDOR)
    private static renderer: string | null = null; // tf.b:Ljava/lang/String; (GL_RENDERER)
    private static projectionZScale = 0; // tf.c:F (proj[10] without depth bias)
    private static textureMatrixDirty = false; // tf.d:Z (unit 0's texture matrix is not the identity)
    static maxTextureUnits = 0; // tf.e:I (GL_MAX_TEXTURE_UNITS)
    static bigEndian = false; // tf.f:Z (native byte order is big endian)
    static cycle = 0; // tf.g:I (Client.loopCycle, copied by ui.a(IIZIII)V each scene frame)
    private static combineAlpha = 0; // tf.h:I (0 MODULATE, 1 REPLACE, 2 ADD)
    private static combineRgb = 0; // tf.i:I (0 MODULATE, 1 REPLACE, 2 ADD, 3 SUBTRACT, 4 ADD_SIGNED, 5 INTERPOLATE)
    private static depthBias = 0; // tf.j:F
    private static projectionZOffset = 0; // tf.k:F (proj[14] without depth bias)
    private static lighting = true; // tf.l:Z
    private static depthBiasDistance = 0; // tf.m:F
    static normalArray = true; // tf.n:Z
    private static ortho2d = false; // tf.o:Z (the 2D ortho projection of setOrtho2d is loaded)
    private static context: GLContext | null = null; // tf.p:Ljavax/media/opengl/GLContext;
    private static frustumScale = 0.09765625; // tf.q:F
    static texture3d = false; // tf.r:Z (GL_EXT_texture3D, after the Radeon driver check)
    private static boundTexture = -1; // tf.s:I
    static gl: GL | null = null; // tf.t:Ljavax/media/opengl/GL;
    private static depthTest = true; // tf.u:Z
    private static maxTextureImageUnits = 0; // tf.v:I (GL_MAX_TEXTURE_IMAGE_UNITS)
    static active = false; // tf.w:Z (the HD context is up)
    static get sceneFar(): number {
        // HD fog ends two tiles before the far plane, at the enhanced traversal radius.
        if (Preferences.enhancedGraphicsEnabled) return 50 * 128;
        // Stress includes the diagonal of the entire build area.
        return Preferences.graphicsMode === 'stress' ? 160 * 128 : 3584;
    }
    static get sceneRadius(): number {
        if (Preferences.enhancedGraphicsEnabled) return 48;
        return Preferences.graphicsMode === 'stress' ? 104 : 28;
    }
    private static projection: Float32Array | null = new Float32Array(16); // tf.x:[F
    static get sceneProjection(): Float32Array | null {
        return this.projection;
    }
    static multisampleSupported = false; // tf.y:Z (GL_ARB_multisample)
    static whiteTexture = 0; // tf.z:I (the 1x1 white texture of initTextures)
    static height = 0; // tf.A:I
    private static glVersion = 0; // tf.B:I (GL_VERSION major * 10 + minor)
    static vboSupported = false; // tf.C:Z (GL_ARB_vertex_buffer_object, after the Radeon driver check)
    private static maxTextureCoords = 0; // tf.D:I (GL_MAX_TEXTURE_COORDS)
    private static drawable: GLDrawable | null = null; // tf.E:Ljavax/media/opengl/GLDrawable;
    private static fog = true; // tf.F:Z
    static streamVbo = false; // tf.G:Z (vboSupported, set only on Radeon drivers)
    static vertexProgramSupported = false; // tf.H:Z (GL_ARB_vertex_program)
    private static radeon: JagString | null = fromLiteral('radeon'); // tf.I:Lna; (cd.a(Ljava/lang/String;B)Lna;)
    static width = 0; // tf.J:I
    static cubeMapSupported = false; // tf.K:Z (GL_ARB_texture_cube_map)

    // tf.a(Ljava/lang/String;)Lna;
    // The catch (UnsupportedEncodingException) arm, `text.getBytes()`, cannot run: every JVM supports ISO-8859-1.
    private static toJagString(text: string | null): JagString {
        const bytes = isoLatin1Bytes(requireNonNull(text));
        return JagString.fromBytes(bytes, 0, bytes.length);
    }

    // tf.a(IIII)V
    static setPerspective(originX: number, originY: number, scaleX: number, scaleY: number): void {
        GlRenderer.setCamera(0, 0, GlRenderer.width, GlRenderer.height, originX, originY, 0.0, 0.0, scaleX, scaleY);
    }

    // tf.a()V
    static begin2dReplace(): void {
        MaterialManager.setMaterial(0, 0);
        GlRenderer.setOrtho2d();
        GlRenderer.setTextureCombineRgb(1);
        GlRenderer.setTextureCombineAlpha(1);
        GlRenderer.setLighting(false);
        GlRenderer.setDepthTest(false);
        GlRenderer.setFog(false);
        GlRenderer.resetTextureMatrix();
    }

    // tf.b()V
    static resetTextureMatrix(): void {
        if (GlRenderer.textureMatrixDirty) {
            requireNonNull(GlRenderer.gl).glMatrixMode(GL.GL_TEXTURE);
            requireNonNull(GlRenderer.gl).glLoadIdentity();
            requireNonNull(GlRenderer.gl).glMatrixMode(GL.GL_MODELVIEW);
            GlRenderer.textureMatrixDirty = false;
        }
    }

    // tf.c()V
    static begin2dFont(): void {
        MaterialManager.setMaterial(0, 0);
        GlRenderer.setOrtho2d();
        GlRenderer.setTextureCombineRgb(0);
        GlRenderer.setTextureCombineAlpha(0);
        GlRenderer.setLighting(false);
        GlRenderer.setDepthTest(false);
        GlRenderer.setFog(false);
        GlRenderer.resetTextureMatrix();
    }

    // tf.a(FF)V
    static setDepthBias(distance: number, bias: number): void {
        if (GlRenderer.ortho2d) {
            return;
        }
        if (distance === GlRenderer.depthBiasDistance && bias === GlRenderer.depthBias) {
            return;
        }
        GlRenderer.depthBiasDistance = distance;
        GlRenderer.depthBias = bias;
        if (bias !== 0.0) {
            const near = Math.fround(distance / Math.fround(bias + distance));
            const near2 = Math.fround(near * near);
            const shift = Math.fround(Math.fround(Math.fround(-GlRenderer.projectionZOffset * Math.fround(1.0 - near)) * Math.fround(1.0 - near)) / bias);
            arrayPutF32(GlRenderer.projection, 10, Math.fround(GlRenderer.projectionZScale + shift));
            arrayPutF32(GlRenderer.projection, 14, Math.fround(GlRenderer.projectionZOffset * near2));
        } else {
            arrayPutF32(GlRenderer.projection, 10, GlRenderer.projectionZScale);
            arrayPutF32(GlRenderer.projection, 14, GlRenderer.projectionZOffset);
        }
        requireNonNull(GlRenderer.gl).glMatrixMode(GL.GL_PROJECTION);
        requireNonNull(GlRenderer.gl).glLoadMatrixf(GlRenderer.projection, 0);
        requireNonNull(GlRenderer.gl).glMatrixMode(GL.GL_MODELVIEW);
    }

    static get stressDrawable(): WebGpuDrawable | null {
        const drawable = this.drawable;
        return drawable !== null && 'replayStress' in drawable ? (drawable as WebGpuDrawable) : null;
    }

    // tf.d()V
    static swapBuffers(deferPresentation = false): void {
        try {
            const drawable = deferPresentation ? GlRenderer.stressDrawable : null;
            if (drawable) drawable.submitEnhancedSource();
            else requireNonNull(GlRenderer.drawable).swapBuffers();
        } catch (error) {
            if (!(error instanceof Error) || error instanceof JavaError) throw error;
            // empty catch block
        }
    }

    // tf.a(Z)V
    static setFog(enabled: boolean): void {
        if (enabled === GlRenderer.fog) {
            return;
        }
        if (enabled) {
            requireNonNull(GlRenderer.gl).glEnable(GL.GL_FOG);
        } else {
            requireNonNull(GlRenderer.gl).glDisable(GL.GL_FOG);
        }
        GlRenderer.fog = enabled;
    }

    // tf.e()V
    static begin2dModulate(): void {
        MaterialManager.setMaterial(0, 0);
        GlRenderer.setOrtho2d();
        GlRenderer.setTextureCombineRgb(0);
        GlRenderer.setTextureCombineAlpha(0);
        GlRenderer.setLighting(false);
        GlRenderer.setDepthTest(false);
        GlRenderer.setFog(false);
        GlRenderer.resetTextureMatrix();
    }

    // tf.f()V
    private static initState(): void {
        GlRenderer.ortho2d = false;
        requireNonNull(GlRenderer.gl).glDisable(GL.GL_TEXTURE_2D);
        GlRenderer.boundTexture = -1;
        requireNonNull(GlRenderer.gl).glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_TEXTURE_ENV_MODE, GL.GL_COMBINE);
        requireNonNull(GlRenderer.gl).glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_COMBINE_RGB, GL.GL_MODULATE);
        GlRenderer.combineRgb = 0;
        requireNonNull(GlRenderer.gl).glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_COMBINE_ALPHA, GL.GL_MODULATE);
        GlRenderer.combineAlpha = 0;
        requireNonNull(GlRenderer.gl).glEnable(GL.GL_LIGHTING);
        requireNonNull(GlRenderer.gl).glEnable(GL.GL_FOG);
        requireNonNull(GlRenderer.gl).glEnable(GL.GL_DEPTH_TEST);
        GlRenderer.lighting = true;
        GlRenderer.depthTest = true;
        GlRenderer.fog = true;
        MaterialManager.resetMaterial();
        requireNonNull(GlRenderer.gl).glActiveTexture(GL.GL_TEXTURE1);
        requireNonNull(GlRenderer.gl).glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_TEXTURE_ENV_MODE, GL.GL_COMBINE);
        requireNonNull(GlRenderer.gl).glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_COMBINE_RGB, GL.GL_MODULATE);
        requireNonNull(GlRenderer.gl).glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_COMBINE_ALPHA, GL.GL_MODULATE);
        requireNonNull(GlRenderer.gl).glActiveTexture(GL.GL_TEXTURE0);
        requireNonNull(GlRenderer.gl).setSwapInterval(0);
        requireNonNull(GlRenderer.gl).glClearColor(0.0, 0.0, 0.0, 0.0);
        requireNonNull(GlRenderer.gl).glShadeModel(GL.GL_SMOOTH);
        requireNonNull(GlRenderer.gl).glClearDepth(1.0);
        requireNonNull(GlRenderer.gl).glDepthFunc(GL.GL_LEQUAL);
        GlRenderer.enableDepthWrite();
        requireNonNull(GlRenderer.gl).glMatrixMode(GL.GL_TEXTURE);
        requireNonNull(GlRenderer.gl).glLoadIdentity();
        requireNonNull(GlRenderer.gl).glPolygonMode(GL.GL_FRONT, GL.GL_FILL);
        requireNonNull(GlRenderer.gl).glEnable(GL.GL_CULL_FACE);
        requireNonNull(GlRenderer.gl).glCullFace(GL.GL_BACK);
        requireNonNull(GlRenderer.gl).glEnable(GL.GL_BLEND);
        requireNonNull(GlRenderer.gl).glBlendFunc(GL.GL_SRC_ALPHA, GL.GL_ONE_MINUS_SRC_ALPHA);
        requireNonNull(GlRenderer.gl).glEnable(GL.GL_ALPHA_TEST);
        requireNonNull(GlRenderer.gl).glAlphaFunc(GL.GL_GREATER, 0.0);
        requireNonNull(GlRenderer.gl).glEnableClientState(GL.GL_VERTEX_ARRAY);
        requireNonNull(GlRenderer.gl).glEnableClientState(GL.GL_NORMAL_ARRAY);
        GlRenderer.normalArray = true;
        requireNonNull(GlRenderer.gl).glEnableClientState(GL.GL_COLOR_ARRAY);
        requireNonNull(GlRenderer.gl).glEnableClientState(GL.GL_TEXTURE_COORD_ARRAY);
        requireNonNull(GlRenderer.gl).glMatrixMode(GL.GL_MODELVIEW);
        requireNonNull(GlRenderer.gl).glLoadIdentity();
        GlLighting.init();
        PointLightManager.init();
    }

    // tf.g()V
    static enableDepthWrite(): void {
        requireNonNull(GlRenderer.gl).glDepthMask(true);
    }

    // tf.b(Z)V
    static setDepthTest(enabled: boolean): void {
        if (enabled === GlRenderer.depthTest) {
            return;
        }
        if (enabled) {
            requireNonNull(GlRenderer.gl).glEnable(GL.GL_DEPTH_TEST);
        } else {
            requireNonNull(GlRenderer.gl).glDisable(GL.GL_DEPTH_TEST);
        }
        GlRenderer.depthTest = enabled;
    }

    // tf.a(F)V
    static setLevelDepthBias(bias: number): void {
        GlRenderer.setDepthBias(3000.0, Math.fround(bias * 1.5));
    }

    // tf.h()V
    static copyFrontToBack(): void {
        const buffers = new Int32Array(2);
        requireNonNull(GlRenderer.gl).glGetIntegerv(GL.GL_DRAW_BUFFER, buffers, 0);
        requireNonNull(GlRenderer.gl).glGetIntegerv(GL.GL_READ_BUFFER, buffers, 1);
        requireNonNull(GlRenderer.gl).glDrawBuffer(GL.GL_BACK_LEFT);
        requireNonNull(GlRenderer.gl).glReadBuffer(GL.GL_FRONT_LEFT);
        GlRenderer.bindTexture2D(-1);
        requireNonNull(GlRenderer.gl).glPushAttrib(GL.GL_ENABLE_BIT);
        requireNonNull(GlRenderer.gl).glDisable(GL.GL_FOG);
        requireNonNull(GlRenderer.gl).glDisable(GL.GL_BLEND);
        requireNonNull(GlRenderer.gl).glDisable(GL.GL_DEPTH_TEST);
        requireNonNull(GlRenderer.gl).glDisable(GL.GL_ALPHA_TEST);
        requireNonNull(GlRenderer.gl).glRasterPos2i(0, 0);
        requireNonNull(GlRenderer.gl).glCopyPixels(0, 0, GlRenderer.width, GlRenderer.height, GL.GL_COLOR);
        requireNonNull(GlRenderer.gl).glPopAttrib();
        requireNonNull(GlRenderer.gl).glDrawBuffer(arrayAtI32(buffers, 0));
        requireNonNull(GlRenderer.gl).glReadBuffer(arrayAtI32(buffers, 1));
    }

    // tf.a(Ljava/awt/Canvas;)V. pm.a(ZIZIZII)V calls it with the game canvas when it switches from an HD mode back
    // to SD: it makes and drops one context on the canvas.
    static resetCanvas(canvas: GlCanvas | null): void {
        try {
            if (!requireNonNull(canvas).isDisplayable()) {
                return;
            }
            const factory = GLDrawableFactory.getFactory();
            const drawable = requireNonNull(factory).getGLDrawable(canvas, null, null);
            drawable.setRealized(true);
            const context = drawable.createContext(null);
            context.makeCurrent();
            context.release();
            context.destroy();
            drawable.setRealized(false);
        } catch {
            // empty catch block (Throwable)
        }
    }

    // tf.i()V
    static begin2dUntextured(): void {
        MaterialManager.setMaterial(0, 0);
        GlRenderer.setOrtho2d();
        GlRenderer.bindTexture2D(-1);
        GlRenderer.setLighting(false);
        GlRenderer.setDepthTest(false);
        GlRenderer.setFog(false);
        GlRenderer.resetTextureMatrix();
    }

    // tf.j()V
    private static setOrtho2d(): void {
        if (GlRenderer.ortho2d) {
            return;
        }
        requireNonNull(GlRenderer.gl).glMatrixMode(GL.GL_PROJECTION);
        requireNonNull(GlRenderer.gl).glLoadIdentity();
        requireNonNull(GlRenderer.gl).glOrtho(0.0, GlRenderer.width, 0.0, GlRenderer.height, -1.0, 1.0);
        requireNonNull(GlRenderer.gl).glViewport(0, 0, GlRenderer.width, GlRenderer.height);
        requireNonNull(GlRenderer.gl).glMatrixMode(GL.GL_MODELVIEW);
        requireNonNull(GlRenderer.gl).glLoadIdentity();
        GlRenderer.ortho2d = true;
    }

    // tf.c(Z)V
    static setLighting(enabled: boolean): void {
        if (enabled === GlRenderer.lighting) {
            return;
        }
        if (enabled) {
            requireNonNull(GlRenderer.gl).glEnable(GL.GL_LIGHTING);
        } else {
            requireNonNull(GlRenderer.gl).glDisable(GL.GL_LIGHTING);
        }
        GlRenderer.lighting = enabled;
    }

    // tf.k()V
    static unload(): void {
        GlRenderer.radeon = null;
        GlRenderer.renderer = null;
        GlRenderer.vendor = null;
        GlRenderer.gl = null;
        GlRenderer.drawable = null;
        GlRenderer.context = null;
        GlRenderer.projection = null;
    }

    // tf.l()F
    static getDepthBias(): number {
        return GlRenderer.depthBias;
    }

    // tf.m()I. Returns 0 when the driver is usable, otherwise failure bits: 1 Microsoft, Brian Paul or Mesa vendor,
    // 2 GL older than 1.2, 4 unparsable GL_VERSION, 8 no GL_ARB_multitexture, 16 fewer than 2 texture units, coords
    // or image units, 32 no GL_ARB_texture_env_combine; -4 when glGenBuffersARB throws.
    private static probeCapabilities(): number {
        let failures = 0;
        GlRenderer.vendor = requireNonNull(GlRenderer.gl).glGetString(GL.GL_VENDOR);
        GlRenderer.renderer = requireNonNull(GlRenderer.gl).glGetString(GL.GL_RENDERER);
        const vendor = requireNonNull(GlRenderer.vendor).toLowerCase();
        if (vendor.indexOf('microsoft') !== -1) {
            failures |= 0x1;
        }
        if (vendor.indexOf('brian paul') !== -1 || vendor.indexOf('mesa') !== -1) {
            failures |= 0x1;
        }
        const version = requireNonNull(GlRenderer.gl).glGetString(GL.GL_VERSION);
        const parts = javaSplitDotSpace(requireNonNull(version));
        if (parts.length >= 2) {
            try {
                const major = javaParseInt(arrayAtObj(parts, 0));
                const minor = javaParseInt(arrayAtObj(parts, 1));
                GlRenderer.glVersion = (Math.imul(major, 10) + minor) | 0;
            } catch (error) {
                if (!(error instanceof NumberFormatException)) throw error;
                failures |= 0x4;
            }
        } else {
            failures |= 0x4;
        }
        if (GlRenderer.glVersion < 12) {
            failures |= 0x2;
        }
        if (!requireNonNull(GlRenderer.gl).isExtensionAvailable('GL_ARB_multitexture')) {
            failures |= 0x8;
        }
        if (!requireNonNull(GlRenderer.gl).isExtensionAvailable('GL_ARB_texture_env_combine')) {
            failures |= 0x20;
        }
        const value = new Int32Array(1);
        requireNonNull(GlRenderer.gl).glGetIntegerv(GL.GL_MAX_TEXTURE_UNITS, value, 0);
        GlRenderer.maxTextureUnits = arrayAtI32(value, 0);
        requireNonNull(GlRenderer.gl).glGetIntegerv(GL.GL_MAX_TEXTURE_COORDS, value, 0);
        GlRenderer.maxTextureCoords = arrayAtI32(value, 0);
        requireNonNull(GlRenderer.gl).glGetIntegerv(GL.GL_MAX_TEXTURE_IMAGE_UNITS, value, 0);
        GlRenderer.maxTextureImageUnits = arrayAtI32(value, 0);
        if (GlRenderer.maxTextureUnits < 2 || GlRenderer.maxTextureCoords < 2 || GlRenderer.maxTextureImageUnits < 2) {
            failures |= 0x10;
        }
        if (failures !== 0) {
            return failures;
        }
        GlRenderer.bigEndian = ByteOrder.nativeOrder() === ByteOrder.BIG_ENDIAN;
        GlRenderer.vboSupported = requireNonNull(GlRenderer.gl).isExtensionAvailable('GL_ARB_vertex_buffer_object');
        GlRenderer.multisampleSupported = requireNonNull(GlRenderer.gl).isExtensionAvailable('GL_ARB_multisample');
        GlRenderer.cubeMapSupported = requireNonNull(GlRenderer.gl).isExtensionAvailable('GL_ARB_texture_cube_map');
        GlRenderer.vertexProgramSupported = requireNonNull(GlRenderer.gl).isExtensionAvailable('GL_ARB_vertex_program');
        GlRenderer.texture3d = requireNonNull(GlRenderer.gl).isExtensionAvailable('GL_EXT_texture3D');
        const renderer = GlRenderer.toJagString(GlRenderer.renderer).toLowerCase();
        if (renderer.indexOf(requireNonNull(GlRenderer.radeon)) !== -1) {
            let model = 0;
            const words = renderer.replaceChar(32, 47).split(32);
            for (let i = 0; i < words.length; i++) {
                const word = arrayAtObj(words, i);
                if (word.getLength() < 4 || !word.substring(0, 4).isDecimal()) {
                    continue;
                }
                model = word.substring(0, 4).decimal();
                break;
            }
            if (model >= 7000 && model <= 7999) {
                GlRenderer.vboSupported = false;
            }
            if (model >= 7000 && model <= 9250) {
                GlRenderer.texture3d = false;
            }
            GlRenderer.streamVbo = GlRenderer.vboSupported;
        }
        if (GlRenderer.vboSupported) {
            try {
                const buffers = new Int32Array(1);
                requireNonNull(GlRenderer.gl).glGenBuffersARB(1, buffers, 0);
            } catch {
                // catch (Throwable)
                return -4;
            }
        }
        return 0;
    }

    // tf.n()V
    static clearDepth(): void {
        requireNonNull(GlRenderer.gl).glClear(GL.GL_DEPTH_BUFFER_BIT);
    }

    // tf.o()V
    static shutdown(): void {
        if (GlRenderer.gl !== null) {
            try {
                MaterialManager.releaseMaterials();
            } catch {
                // empty catch block (Throwable)
            }
            GlRenderer.gl = null;
        }
        if (GlRenderer.context !== null) {
            GlCleaner.reset();
            try {
                if (GLContext.getCurrent() === GlRenderer.context) {
                    requireNonNull(GlRenderer.context).release();
                }
            } catch {
                // empty catch block (Throwable)
            }
            try {
                requireNonNull(GlRenderer.context).destroy();
            } catch {
                // empty catch block (Throwable)
            }
            GlRenderer.context = null;
        }
        if (GlRenderer.drawable !== null) {
            try {
                requireNonNull(GlRenderer.drawable).setRealized(false);
            } catch {
                // empty catch block (Throwable)
            }
            GlRenderer.drawable = null;
        }
        PointLightManager.release();
        GlRenderer.active = false;
    }

    // tf.a(FFF)V
    static translateTexture(x: number, y: number, z: number): void {
        requireNonNull(GlRenderer.gl).glMatrixMode(GL.GL_TEXTURE);
        if (GlRenderer.textureMatrixDirty) {
            requireNonNull(GlRenderer.gl).glLoadIdentity();
        }
        requireNonNull(GlRenderer.gl).glTranslatef(x, y, z);
        requireNonNull(GlRenderer.gl).glMatrixMode(GL.GL_MODELVIEW);
        GlRenderer.textureMatrixDirty = true;
    }

    // tf.a(IIIIIIFFII)V. The scene camera: a perspective frustum (near 50, far 3584) for the viewport x, y, width,
    // height around the projection origin, then the pitch and yaw rotations. The frustum edges, in 1/256 units, become
    // the Pix3D clip bounds.
    static setCamera(x: number, y: number, width: number, height: number, originX: number, originY: number, pitch: number, yaw: number, scaleX: number, scaleY: number): void {
        const left = intDivide((x - originX) << 8, scaleX);
        const right = intDivide((x + width - originX) << 8, scaleX);
        const top = intDivide((y - originY) << 8, scaleY);
        const bottom = intDivide((y + height - originY) << 8, scaleY);
        requireNonNull(GlRenderer.gl).glMatrixMode(GL.GL_PROJECTION);
        requireNonNull(GlRenderer.gl).glLoadIdentity();
        GlRenderer.setFrustum(
            Math.fround(Math.fround(left) * GlRenderer.frustumScale),
            Math.fround(Math.fround(right) * GlRenderer.frustumScale),
            Math.fround(Math.fround(-bottom | 0) * GlRenderer.frustumScale),
            Math.fround(Math.fround(-top | 0) * GlRenderer.frustumScale),
            50.0,
            GlRenderer.sceneFar
        );
        requireNonNull(GlRenderer.gl).glViewport(x, (GlRenderer.height - y - height) | 0, width, height);
        requireNonNull(GlRenderer.gl).glMatrixMode(GL.GL_MODELVIEW);
        requireNonNull(GlRenderer.gl).glLoadIdentity();
        requireNonNull(GlRenderer.gl).glRotatef(180.0, 1.0, 0.0, 0.0);
        if (pitch !== 0.0) {
            requireNonNull(GlRenderer.gl).glRotatef(pitch, 1.0, 0.0, 0.0);
        }
        if (yaw !== 0.0) {
            requireNonNull(GlRenderer.gl).glRotatef(yaw, 0.0, 1.0, 0.0);
        }
        GlRenderer.ortho2d = false;
        Pix3D.clipMinX = left;
        Pix3D.clipMaxX = right;
        Pix3D.clipMinY = top;
        Pix3D.clipMaxY = bottom;
    }

    // tf.d(Z)V
    private static setNormalArray(enabled: boolean): void {
        if (enabled === GlRenderer.normalArray) {
            return;
        }
        if (enabled) {
            requireNonNull(GlRenderer.gl).glEnableClientState(GL.GL_NORMAL_ARRAY);
        } else {
            requireNonNull(GlRenderer.gl).glDisableClientState(GL.GL_NORMAL_ARRAY);
        }
        GlRenderer.normalArray = enabled;
    }

    // tf.p()V
    static applyLightingPreference(): void {
        if (Preferences.graphics.highDetailLighting) {
            GlRenderer.setLighting(true);
            GlRenderer.setNormalArray(true);
        } else {
            GlRenderer.setLighting(false);
            GlRenderer.setNormalArray(false);
        }
    }

    // tf.a(I)V
    static setTextureCombineAlpha(mode: number): void {
        if (mode === GlRenderer.combineAlpha) {
            return;
        }
        if (mode === 0) {
            requireNonNull(GlRenderer.gl).glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_COMBINE_ALPHA, GL.GL_MODULATE);
        }
        if (mode === 1) {
            requireNonNull(GlRenderer.gl).glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_COMBINE_ALPHA, GL.GL_REPLACE);
        }
        if (mode === 2) {
            requireNonNull(GlRenderer.gl).glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_COMBINE_ALPHA, GL.GL_ADD);
        }
        GlRenderer.combineAlpha = mode;
    }

    // tf.a(FFFFFF)V. glFrustum(left, right, bottom, top, near, far) built by hand into proj, keeping proj[10] and
    // proj[14] so that setDepthBias can edit them; loading it clears the depth bias.
    private static setFrustum(left: number, right: number, bottom: number, top: number, near: number, far: number): void {
        const near2 = Math.fround(near * 2.0);
        arrayPutF32(GlRenderer.projection, 0, Math.fround(near2 / Math.fround(right - left)));
        arrayPutF32(GlRenderer.projection, 1, 0.0);
        arrayPutF32(GlRenderer.projection, 2, 0.0);
        arrayPutF32(GlRenderer.projection, 3, 0.0);
        arrayPutF32(GlRenderer.projection, 4, 0.0);
        arrayPutF32(GlRenderer.projection, 5, Math.fround(near2 / Math.fround(top - bottom)));
        arrayPutF32(GlRenderer.projection, 6, 0.0);
        arrayPutF32(GlRenderer.projection, 7, 0.0);
        arrayPutF32(GlRenderer.projection, 8, Math.fround(Math.fround(right + left) / Math.fround(right - left)));
        arrayPutF32(GlRenderer.projection, 9, Math.fround(Math.fround(top + bottom) / Math.fround(top - bottom)));
        const zScale = Math.fround(-Math.fround(far + near) / Math.fround(far - near));
        GlRenderer.projectionZScale = zScale;
        arrayPutF32(GlRenderer.projection, 10, zScale);
        arrayPutF32(GlRenderer.projection, 11, -1.0);
        arrayPutF32(GlRenderer.projection, 12, 0.0);
        arrayPutF32(GlRenderer.projection, 13, 0.0);
        const zOffset = Math.fround(-Math.fround(near2 * far) / Math.fround(far - near));
        GlRenderer.projectionZOffset = zOffset;
        arrayPutF32(GlRenderer.projection, 14, zOffset);
        arrayPutF32(GlRenderer.projection, 15, 0.0);
        requireNonNull(GlRenderer.gl).glLoadMatrixf(GlRenderer.projection, 0);
        GlRenderer.depthBiasDistance = 0.0;
        GlRenderer.depthBias = 0.0;
    }

    // tf.b(I)V. Clears colour and depth to the RGB colour (the fog colour at the scene clear), then restores the
    // black clear colour.
    static clear(colour: number): void {
        requireNonNull(GlRenderer.gl).glClearColor(Math.fround(((colour >> 16) & 0xff) / 255.0), Math.fround(((colour >> 8) & 0xff) / 255.0), Math.fround((colour & 0xff) / 255.0), 0.0);
        requireNonNull(GlRenderer.gl).glClear(GL.GL_COLOR_BUFFER_BIT | GL.GL_DEPTH_BUFFER_BIT);
        requireNonNull(GlRenderer.gl).glClearColor(0.0, 0.0, 0.0, 0.0);
    }

    // tf.c(I)V. -1 disables GL_TEXTURE_2D.
    static bindTexture2D(texture: number): void {
        if (texture === GlRenderer.boundTexture) {
            return;
        }
        if (texture !== -1) {
            if (GlRenderer.boundTexture === -1) {
                requireNonNull(GlRenderer.gl).glEnable(GL.GL_TEXTURE_2D);
            }
            requireNonNull(GlRenderer.gl).glBindTexture(GL.GL_TEXTURE_2D, texture);
        } else {
            requireNonNull(GlRenderer.gl).glDisable(GL.GL_TEXTURE_2D);
        }
        GlRenderer.boundTexture = texture;
    }

    // tf.q()V
    static disableDepthWrite(): void {
        requireNonNull(GlRenderer.gl).glDepthMask(false);
    }

    // tf.r()F
    static getDepthBiasDistance(): number {
        return GlRenderer.depthBiasDistance;
    }

    // tf.a(Ljava/awt/Canvas;I)I. Creates the drawable and context on the canvas with `samples` (0, 2 or 4; pm.a passes
    // 2 * antialiasing) and returns 0, or: -1 canvas not displayable, -2 no current context after 7 tries 1 s apart
    // (the drawable stays realized), -3 swapBuffers failed 7 times 100 ms apart, -5 any other Throwable, and the
    // probeCapabilities failure bits or -4. Every failure but -1 and -2 runs shutdown first. Async because of the two
    // retry sleeps (sk.a(JI)V, ThreadUtils.sleep).
    static async init(canvas: GlCanvas | null, samples: number): Promise<number> {
        try {
            let result: number;
            if (!requireNonNull(canvas).isDisplayable()) {
                return -1;
            }
            const capabilities = new GLCapabilities();
            if (samples > 0) {
                capabilities.setSampleBuffers(true);
                capabilities.setNumSamples(samples);
            }
            const factory = GLDrawableFactory.getFactory();
            GlRenderer.drawable = requireNonNull(factory).getGLDrawable(canvas, capabilities, null);
            requireNonNull(GlRenderer.drawable).setRealized(true);
            let tries = 0;
            while (true) {
                GlRenderer.context = requireNonNull(GlRenderer.drawable).createContext(null);
                try {
                    result = requireNonNull(GlRenderer.context).makeCurrent();
                    if (result !== 0) {
                        break;
                    }
                } catch (error) {
                    if (!(error instanceof Error) || error instanceof JavaError) throw error;
                    // empty catch block (Exception)
                }
                if (tries++ > 5) {
                    return -2;
                }
                await ThreadUtils.sleep(1000n);
            }
            GlRenderer.gl = requireNonNull(GlRenderer.context).getGL();
            new GLU();
            GlRenderer.active = true;
            GlRenderer.width = requireNonNull(canvas).getSize().width;
            GlRenderer.height = requireNonNull(canvas).getSize().height;
            result = GlRenderer.probeCapabilities();
            if (result !== 0) {
                GlRenderer.shutdown();
                return result;
            }
            GlRenderer.initTextures();
            GlRenderer.initState();
            requireNonNull(GlRenderer.gl).glClear(GL.GL_COLOR_BUFFER_BIT);
            tries = 0;
            while (true) {
                try {
                    requireNonNull(GlRenderer.drawable).swapBuffers();
                } catch (error) {
                    if (!(error instanceof Error) || error instanceof JavaError) throw error;
                    if (tries++ > 5) {
                        GlRenderer.shutdown();
                        return -3;
                    }
                    await ThreadUtils.sleep(100n);
                    continue;
                }
                break;
            }
            requireNonNull(GlRenderer.gl).glClear(GL.GL_COLOR_BUFFER_BIT);
            return 0;
        } catch {
            // catch (Throwable)
            GlRenderer.shutdown();
            return -5;
        }
    }

    // tf.a(II)V
    static resize(width: number, height: number): void {
        GlRenderer.width = width;
        GlRenderer.height = height;
        GlRenderer.ortho2d = false;
    }

    // tf.a(IIIIII)V. The orthographic camera of 3D interface models (gn.a, components with the orthographic flag).
    static setOrthographic(originX: number, originY: number, zoom: number, depthOffset: number, scaleX: number, scaleY: number): void {
        const left = -originX | 0;
        const right = (GlRenderer.width - originX) | 0;
        const top = -originY | 0;
        const bottom = (GlRenderer.height - originY) | 0;
        requireNonNull(GlRenderer.gl).glMatrixMode(GL.GL_PROJECTION);
        requireNonNull(GlRenderer.gl).glLoadIdentity();
        const scale = Math.fround(Math.fround(zoom) / 512.0);
        const scaleH = Math.fround(scale * Math.fround(256.0 / Math.fround(scaleX)));
        const scaleV = Math.fround(scale * Math.fround(256.0 / Math.fround(scaleY)));
        requireNonNull(GlRenderer.gl).glOrtho(
            Math.fround(Math.fround(left) * scaleH),
            Math.fround(Math.fround(right) * scaleH),
            Math.fround(Math.fround(-bottom | 0) * scaleV),
            Math.fround(Math.fround(-top | 0) * scaleV),
            (50 - depthOffset) | 0,
            (3584 - depthOffset) | 0
        );
        requireNonNull(GlRenderer.gl).glViewport(0, 0, GlRenderer.width, GlRenderer.height);
        requireNonNull(GlRenderer.gl).glMatrixMode(GL.GL_MODELVIEW);
        requireNonNull(GlRenderer.gl).glLoadIdentity();
        requireNonNull(GlRenderer.gl).glRotatef(180.0, 1.0, 0.0, 0.0);
        GlRenderer.ortho2d = false;
    }

    // tf.d(I)V
    static setTextureCombineRgb(mode: number): void {
        if (mode === GlRenderer.combineRgb) {
            return;
        }
        if (mode === 0) {
            requireNonNull(GlRenderer.gl).glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_COMBINE_RGB, GL.GL_MODULATE);
        }
        if (mode === 1) {
            requireNonNull(GlRenderer.gl).glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_COMBINE_RGB, GL.GL_REPLACE);
        }
        if (mode === 2) {
            requireNonNull(GlRenderer.gl).glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_COMBINE_RGB, GL.GL_ADD);
        }
        if (mode === 3) {
            requireNonNull(GlRenderer.gl).glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_COMBINE_RGB, GL.GL_SUBTRACT);
        }
        if (mode === 4) {
            requireNonNull(GlRenderer.gl).glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_COMBINE_RGB, GL.GL_ADD_SIGNED);
        }
        if (mode === 5) {
            requireNonNull(GlRenderer.gl).glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_COMBINE_RGB, GL.GL_INTERPOLATE);
        }
        GlRenderer.combineRgb = mode;
    }

    // tf.s()V. The 1x1 white texture (whiteTexture), the point-light tables, then the materials (which upload the
    // noise textures first).
    private static initTextures(): void {
        const names = new Int32Array(1);
        requireNonNull(GlRenderer.gl).glGenTextures(1, names, 0);
        GlRenderer.whiteTexture = arrayAtI32(names, 0);
        requireNonNull(GlRenderer.gl).glBindTexture(GL.GL_TEXTURE_2D, GlRenderer.whiteTexture);
        requireNonNull(GlRenderer.gl).glTexImage2D(GL.GL_TEXTURE_2D, 0, 4, 1, 1, 0, GL.GL_RGBA, GL.GL_UNSIGNED_BYTE, IntBuffer.wrap(Int32Array.of(-1)));
        PointLightManager.allocate();
        MaterialManager.createMaterials(6);
    }

    // ga.a()V. Point-sprite size limits: the relocated static sits in the particle class ga, and membermap-hd.json places
    // it here (HD_PLAN.md 1.3). The window rebuild lb.a(Z)V calls it after a GL context comes up. With
    // GL_ARB_point_parameters it sets the distance attenuation (1, 0, 5.0E-4f), then clamps GL_POINT_SIZE_MAX to 1024
    // (fcmpl/ifle, so NaN is passed through unclamped) and sets the size range to [1, max]. The GL_ARB_point_sprite
    // test has an empty body, but javac kept the call (bytecode 90-98), so it stays.
    static initPointParameters(): void {
        const gl = GlRenderer.gl;
        if (requireNonNull(gl).isExtensionAvailable('GL_ARB_point_parameters')) {
            const attenuation = Float32Array.of(1.0, 0.0, 5.0e-4);
            requireNonNull(gl).glPointParameterfvARB(GL.GL_POINT_DISTANCE_ATTENUATION, attenuation, 0);
            const buffer = FloatBuffer.allocate(1);
            requireNonNull(gl).glGetFloatv(GL.GL_POINT_SIZE_MAX, buffer);
            let size = buffer.get(0);
            if (size > 1024.0) {
                size = 1024.0;
            }
            requireNonNull(gl).glPointParameterfARB(GL.GL_POINT_SIZE_MIN, 1.0);
            requireNonNull(gl).glPointParameterfARB(GL.GL_POINT_SIZE_MAX, size);
        }
        if (requireNonNull(gl).isExtensionAvailable('GL_ARB_point_sprite')) {
            // empty if block
        }
    }
}

// The java.awt.Canvas members tf calls (java/awt/Component.isDisplayable()Z and getSize()Ljava/awt/Dimension;). The
// host canvas component implements them; the object itself is the GLDrawableFactory.getGLDrawable target.
export interface GlCanvas {
    isDisplayable(): boolean;
    getSize(): { readonly width: number; readonly height: number };
}

// java.lang.NumberFormatException (an IllegalArgumentException, so a RuntimeException: a plain Error in the port).
// probeCapabilities catches exactly this type around its two Integer.parseInt calls.
class NumberFormatException extends Error {}

// java.lang.String.getBytes("ISO-8859-1"): one byte per char; a char above U+00FF becomes '?' (63), and so does a
// valid surrogate pair as a whole (the encoder's replacement covers the pair), as Java's ISO_8859_1 encoder does.
function isoLatin1Bytes(value: string): Uint8Array {
    const bytes = new Uint8Array(value.length);
    let length = 0;
    for (let i = 0; i < value.length; i++) {
        const c = value.charCodeAt(i);
        if (c <= 0xff) {
            arrayPutU8(bytes, length++, c);
            continue;
        }
        if (c >= 0xd800 && c <= 0xdbff && i + 1 < value.length) {
            const d = value.charCodeAt(i + 1);
            if (d >= 0xdc00 && d <= 0xdfff) i++;
        }
        arrayPutU8(bytes, length++, 63);
    }
    return bytes.slice(0, length);
}

// java.lang.String.split(Ljava/lang/String;)[Ljava/lang/String; with the regex "[. ]" and limit 0
// (java.util.regex.Pattern.split): the input itself when nothing matches, otherwise the pieces between the matches
// with the trailing empty strings removed (JS split keeps them).
function javaSplitDotSpace(value: string): string[] {
    if (!/[. ]/.test(value)) {
        return [value];
    }
    const parts = value.split(/[. ]/);
    let size = parts.length;
    while (size > 0 && arrayAtObj(parts, size - 1).length === 0) size--;
    return parts.slice(0, size);
}

const DECIMAL_DIGIT = /^\p{Nd}$/u;

// java.lang.Character.digit(CI)I for radix 10: a decimal digit (general category Nd) gives its value, anything else
// -1. Unicode encodes every Nd digit run as ten consecutive code points 0..9, so the value is the distance from the
// start of the run modulo 10.
function javaDecimalDigit(c: number): number {
    if (c >= 48 && c <= 57) return c - 48;
    if (!DECIMAL_DIGIT.test(String.fromCharCode(c))) return -1;
    let start = c;
    while (start > 0 && DECIMAL_DIGIT.test(String.fromCharCode(start - 1))) start--;
    return (c - start) % 10;
}

// java.lang.Integer.parseInt(Ljava/lang/String;)I: an optional sign then decimal digits, accumulated negatively so
// that -2147483648 parses; anything else, an empty string or an overflow throws NumberFormatException.
function javaParseInt(value: string): number {
    const len = value.length;
    if (len === 0) throw new NumberFormatException('For input string: ""');
    let negative = false;
    let i = 0;
    let limit = -2147483647;
    const first = value.charCodeAt(0);
    if (first < 48) {
        if (first === 45) {
            negative = true;
            limit = -2147483648;
        } else if (first !== 43) {
            throw new NumberFormatException('For input string: "' + value + '"');
        }
        if (len === 1) throw new NumberFormatException('For input string: "' + value + '"');
        i++;
    }
    const multmin = (limit / 10) | 0;
    let result = 0;
    while (i < len) {
        const digit = javaDecimalDigit(value.charCodeAt(i++));
        if (digit < 0 || result < multmin) throw new NumberFormatException('For input string: "' + value + '"');
        result *= 10;
        if (result < limit + digit) throw new NumberFormatException('For input string: "' + value + '"');
        result -= digit;
    }
    return negative ? result : -result | 0;
}
