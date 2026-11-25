import { JavaError } from '#/util/JavaException';
import type TextureCache from '#/dash3d/TextureCache';
import type StaticPointLight from '#/dash3d/StaticPointLight';
import { requireNonNull } from '#/util/JavaArray';
import type { GL } from '#/jogl/GL';
import GLCapabilities from '#/jogl/GLCapabilities';
import type GLCapabilitiesChooser from '#/jogl/GLCapabilitiesChooser';
import GLContext from '#/jogl/GLContext';
import type GLDrawable from '#/jogl/GLDrawable';
import GLDrawableFactory, { registerGLDrawableFactory } from '#/jogl/GLDrawableFactory';
import GLException from '#/jogl/GLException';
import { CAPS_PROFILE_FORMAT, type CapsProfile, validateCapsProfile } from '#/gl/CapsProfile';
import { GLX } from './GlEnums';
import GpuDevice from './GpuDevice';
import Presenter, { defaultSurface, presenterFor, type WebGpuSurface } from './Presenter';
import SurfaceTargets from './SurfaceTargets';
import WebGpuGL, { type WebGpuGLHost } from './WebGpuGL';

// The WebGPU platform behind the JOGL mirror (HD_PLAN 1.4, 2.3 context row). Host code, not a Java port.
//
// WebGpuDrawableFactory plays the role of JOGL's WindowsGLDrawableFactory and registers with the mirror's provider
// registry (registerWebGpuDrawableFactory). It follows the contracts in src/jogl/GLDrawableFactory.ts,
// GLDrawable.ts and GLContext.ts, and behaves exactly like NullGLDrawableFactory where Java can see it (GLTRACE.md
// section 16 "Context API"), so recorded traces do not depend on which one is registered:
// - getGLDrawable(null, ...) throws IllegalArgumentException('Null target'); a target the surface resolver does not
//   understand throws IllegalArgumentException('GLDrawables not supported for objects of type ...'). Otherwise a new,
//   unrealized drawable holding capabilities.clone() (new GLCapabilities() for null).
// - makeCurrent: CONTEXT_CURRENT when already current; otherwise releases the current context, returns
//   CONTEXT_NOT_CURRENT for an unrealized drawable, a destroyed context or a surface with no size yet, and
//   CONTEXT_CURRENT_NEW the first time, CONTEXT_CURRENT afterwards. With no device (or a lost one) it throws a
//   JavaError, the UnsatisfiedLinkError JOGL raises without natives: tf.a's catch (Throwable) returns -5 at once.
// - swapBuffers: ends the frame (resolve MSAA, copy back to front, blit front to the canvas, submit). The back buffer
//   is preserved. A lost device throws GLException (tf.d()V ignores it; tf.a retries and returns -3).
// - setSwapInterval is recorded by the GL and does nothing.

export interface WebGpuFactoryOptions {
    // The device the drawables use; default GpuDevice.current() at the time a context is made current.
    readonly device?: GpuDevice | null;
    // Resolves a getGLDrawable target to a surface (default: defaultSurface in Presenter.ts).
    readonly resolveSurface?: (target: object) => WebGpuSurface | null;
}

// The game queries the GL implementation. Native GL vendor strings would select
// workarounds for old OpenGL drivers even though WebGPU executes the draws.
export function webGpuCapsProfile(limits: GPUSupportedLimits): CapsProfile {
    // The indexed shader implements the three texture stages used by 530 materials.
    const stages = Math.min(3, limits.maxSampledTexturesPerShaderStage, limits.maxSamplersPerShaderStage);
    return {
        format: CAPS_PROFILE_FORMAT,
        name: 'webgpu',
        strings: {
            [GLX.GL_VENDOR]: 'RS530',
            [GLX.GL_RENDERER]: 'WebGPU',
            [GLX.GL_VERSION]: '2.1.0 WebGPU',
            [GLX.GL_EXTENSIONS]: 'GL_ARB_multitexture GL_ARB_texture_env_combine GL_ARB_vertex_buffer_object GL_ARB_multisample GL_ARB_texture_cube_map GL_ARB_vertex_program GL_EXT_texture3D'
        },
        integers: {
            [GLX.GL_MAX_TEXTURE_SIZE]: [limits.maxTextureDimension2D],
            [GLX.GL_MAX_CUBE_MAP_TEXTURE_SIZE]: [limits.maxTextureDimension2D],
            [GLX.GL_MAX_3D_TEXTURE_SIZE]: [limits.maxTextureDimension3D],
            [GLX.GL_MAX_TEXTURE_UNITS]: [stages],
            [GLX.GL_MAX_TEXTURE_COORDS]: [stages],
            [GLX.GL_MAX_TEXTURE_IMAGE_UNITS]: [stages]
        },
        floats: {},
        missingEntryPoints: []
    };
}

// MSAA: WebGPU allows 1 or 4 samples. GLCapabilities with sample buffers and 2 or more samples (the jar asks for
// 2 * pa.N = 2 or 4) get 4; anything else 1 (HD_PLAN Q3).
export function sampleCountFor(caps: GLCapabilities): number {
    return caps.getSampleBuffers() && caps.getNumSamples() >= 2 ? 4 : 1;
}

export class WebGpuDrawableFactory extends GLDrawableFactory {
    readonly profile: CapsProfile;
    private readonly options: WebGpuFactoryOptions;

    constructor(profile: CapsProfile, options: WebGpuFactoryOptions = {}) {
        super();
        validateCapsProfile(profile);
        this.profile = profile;
        this.options = options;
    }

    device(): GpuDevice | null {
        return this.options.device ?? GpuDevice.current();
    }

    // javax.media.opengl.GLDrawableFactory.getGLDrawable(Ljava/lang/Object;Ljavax/media/opengl/GLCapabilities;Ljavax/media/opengl/GLCapabilitiesChooser;)Ljavax/media/opengl/GLDrawable;
    getGLDrawable(target: object | null, capabilities: GLCapabilities | null, _chooser: GLCapabilitiesChooser | null): GLDrawable {
        if (target === null) throw new Error('IllegalArgumentException: Null target');
        const surface = (this.options.resolveSurface ?? defaultSurface)(target);
        if (surface === null) {
            const type = (target as { constructor?: { name?: string } }).constructor?.name ?? typeof target;
            throw new Error('IllegalArgumentException: GLDrawables not supported for objects of type ' + type + ' (only Components are supported in this implementation)');
        }
        return new WebGpuDrawable(this, target, surface, capabilities === null ? new GLCapabilities() : capabilities.clone());
    }
}

// Follows the GLDrawable contract in src/jogl/GLDrawable.ts.
export class WebGpuDrawable implements GLDrawable {
    readonly factory: WebGpuDrawableFactory;
    readonly target: object;
    readonly surface: WebGpuSurface;
    readonly capabilities: GLCapabilities;
    readonly sampleCount: number;
    private realized = false;
    private surfaceTargets: SurfaceTargets | null = null;
    private worldDrawDepth = 0;
    private sceneTargets: SurfaceTargets | null = null;
    private presenter: Presenter | null = null;
    private pendingFront: GPUTexture | null = null;
    // Completed swaps (diagnostics).
    swaps = 0;

    constructor(factory: WebGpuDrawableFactory, target: object, surface: WebGpuSurface, capabilities: GLCapabilities) {
        this.factory = factory;
        this.target = target;
        this.surface = surface;
        this.capabilities = capabilities;
        this.sampleCount = sampleCountFor(capabilities);
    }

    isRealized(): boolean {
        return this.realized;
    }

    // The buffers of this drawable on `gpu`, sized to the surface now. Allocated on first use.
    targets(gpu: GpuDevice): SurfaceTargets {
        let t = this.surfaceTargets;
        if (t !== null && t === this.sceneTargets && t.gpu === gpu) return t;
        if (t === null || t.gpu !== gpu) {
            t = new SurfaceTargets(gpu, this.sampleCount, this.capabilities.getAlphaBits());
            this.surfaceTargets = t;
            this.presenter = presenterFor(gpu, this.target, this.surface);
        }
        t.ensureSize(this.surface.width(), this.surface.height());
        if (this.worldDrawDepth !== 0) this.sceneTargets = t;
        return t;
    }

    // World traversal is synchronous and never resizes the canvas. A resize between
    // viewports, including one in the same browser task, is visible on the next draw.
    beginWorldDraw(): void {
        this.worldDrawDepth++;
    }

    beginWorldSunlight(
        x: number,
        y: number,
        z: number,
        focusX: number,
        focusY: number,
        focusZ: number,
        sun: Float32Array,
        region: object | null,
        textures: TextureCache | null,
        level: number,
        lights: (StaticPointLight | null)[] | null,
        count: number
    ): void {
        const context = GLContext.getCurrent();
        if (context instanceof WebGpuContext && context.drawable === this) {
            const driver = context.driver();
            this.surfaceTargets?.beginSunlight(driver, x, y, z, focusX, focusY, focusZ, sun, region, textures);
            this.surfaceTargets?.captureBloomLights(driver.state, x, y, z, level, lights, count);
        }
    }

    endWorldDraw(): void {
        if (--this.worldDrawDepth === 0) {
            this.surfaceTargets?.endSunlight();
            this.sceneTargets = null;
        }
    }

    // The drawable's buffers if a context has used them (tests read them back).
    currentTargets(): SurfaceTargets | null {
        return this.surfaceTargets;
    }

    currentPresenter(): Presenter | null {
        return this.presenter;
    }

    replayStress(gameDrawn = false, time = performance.now()): boolean {
        const t = this.surfaceTargets;
        if (!t || this.surface.width() !== t.width || this.surface.height() !== t.height) return false;
        if (t.replayStress(() => this.swapBuffers(), time, gameDrawn)) {
            t.presentationCamera?.markPresented(false);
            return true;
        }
        // A new scene must still appear when its bundles cannot be reused (for
        // example, a texture was retired). Never submit an unfinished game pass.
        const presenter = this.presenter;
        if (!this.pendingFront || this.pendingFront !== presenter?.front || t.gpu.lost) return false;
        const encoder = t.gpu.device.createCommandEncoder();
        presenter.present(encoder);
        t.gpu.device.queue.submit([encoder.finish()]);
        this.pendingFront = null;
        t.presentationCamera?.markPresented(true);
        return true;
    }

    // javax.media.opengl.GLDrawable.createContext(Ljavax/media/opengl/GLContext;)Ljavax/media/opengl/GLContext;
    createContext(_shareWith: GLContext | null): GLContext {
        return new WebGpuContext(this, new WebGpuGL(this.factory.profile, this.capabilities.getDoubleBuffered()));
    }

    // javax.media.opengl.GLDrawable.setRealized(Z)V
    // Unrealizing unbinds the surface: the drawable's buffers are freed (tf.o()V and tf.a(Ljava/awt/Canvas;)V
    // unrealize drawables whose contexts are already destroyed). The window's front buffer stays with the Presenter.
    setRealized(realized: boolean): void {
        this.realized = realized;
        if (!realized) this.pendingFront = null;
        if (!realized && this.surfaceTargets !== null) {
            const targets = this.surfaceTargets;
            targets.dispose();
            this.surfaceTargets = null;
            targets.gpu.flushRetired();
        }
    }

    // javax.media.opengl.GLDrawable.swapBuffers()V
    swapBuffers(): void {
        this.swap(true);
    }

    submitEnhancedSource(): void {
        this.swap(false);
    }

    private swap(display: boolean): void {
        const t = this.surfaceTargets;
        const p = this.presenter;
        if (t === null || p === null) return; // no context has drawn into this drawable yet
        const gpu = t.gpu;
        if (gpu.lost) throw new GLException('WebGPU device lost: ' + gpu.lostMessage);
        const front = p.ensureFront(t.width, t.height);
        t.copyTo(front);
        if (display) p.present();
        else t.latchEnhancedSource(performance.now());
        if (gpu.hasRetiredResources) t.discardRecording();
        gpu.submit();
        t.finishStress();
        this.pendingFront = display ? null : front;
        this.swaps++;
    }
}

// Follows the GLContext contract in src/jogl/GLContext.ts.
export class WebGpuContext extends GLContext {
    readonly drawable: WebGpuDrawable;
    private readonly gl: WebGpuGL;
    private created = false;
    private destroyed = false;

    constructor(drawable: WebGpuDrawable, gl: WebGpuGL) {
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
        const gpu = this.drawable.factory.device();
        if (gpu === null || gpu.lost) throw new JavaError('UnsatisfiedLinkError: no WebGPU device' + (gpu === null ? '' : ' (lost: ' + gpu.lostMessage + ')'));
        const width = this.drawable.surface.width();
        const height = this.drawable.surface.height();
        if (!(width > 0 && height > 0)) return GLContext.CONTEXT_NOT_CURRENT;
        const drawable = this.drawable;
        if (!this.created) {
            // GL: the viewport and scissor box start as the window size when the context is first made current.
            this.gl.state.initWindowRects(width, height);
            const host: WebGpuGLHost = {
                gpu,
                alphaBits: drawable.capabilities.getAlphaBits(),
                targets: () => drawable.targets(gpu),
                front: () => {
                    const targets = drawable.targets(gpu);
                    return requireNonNull(drawable.currentPresenter()).ensureFront(targets.width, targets.height);
                }
            };
            this.gl.attach(host);
            drawable.targets(gpu);
            void this.gl.prewarmIndexedPipelines(drawable.sampleCount);
        }
        const result = this.created ? GLContext.CONTEXT_CURRENT : GLContext.CONTEXT_CURRENT_NEW;
        this.created = true;
        WebGpuContext.setCurrent(this);
        return result;
    }

    // javax.media.opengl.GLContext.release()V
    release(): void {
        WebGpuContext.setCurrent(null);
    }

    // javax.media.opengl.GLContext.destroy()V
    destroy(): void {
        if (!this.destroyed) this.gl.dispose();
        this.destroyed = true;
    }

    // javax.media.opengl.GLContext.getGL()Ljavax/media/opengl/GL;
    getGL(): GL {
        return this.gl;
    }

    // Host only: the driver object (the same object getGL() returns).
    driver(): WebGpuGL {
        return this.gl;
    }
}

// Registers the WebGPU platform with the JOGL mirror when a device is available (HD_PLAN 1.4). Returns false, and
// registers nothing, without one: GLDrawableFactory.getFactory() then stays null and the ported tf.a takes Java's
// "unsupported platform" path (-5), so pm.a falls back to SD.
export function registerWebGpuDrawableFactory(profile: CapsProfile, options: WebGpuFactoryOptions = {}): boolean {
    const device = options.device ?? GpuDevice.current();
    if (device === null) return false;
    registerGLDrawableFactory(() => new WebGpuDrawableFactory(profile, { ...options, device }));
    return true;
}
