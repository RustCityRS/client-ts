import type { GL } from './GL';

// javax.media.opengl.GLContext (shipped jogl.jar, JOGL 1.1.x, shrunk by ProGuard).
// The shipped class keeps four abstract methods and the current-context static. That static is a plain
// static field, not JOGL's usual ThreadLocal; the client drives GL from one thread.
//
// Contract for implementations (WebGpuGL, NullGL and test providers). This is the Java-visible behaviour
// of the shipped com.sun.opengl.impl.GLContextImpl and WindowsOnscreenGLContext. Providers must keep it,
// because tf.a(Ljava/awt/Canvas;I)I branches on it.
// - makeCurrent():
//   1. if GLContext.getCurrent() === this, return CONTEXT_CURRENT (the shipped impl calls update() first);
//   2. otherwise release the current context, if there is one;
//   3. try to make this context current:
//      - return CONTEXT_NOT_CURRENT when the surface is not ready (JOGL: lockSurface() ==
//        LOCK_SURFACE_NOT_READY, e.g. the canvas is not displayable or has no size yet);
//      - return CONTEXT_CURRENT_NEW when the device context was created by this call (the first
//        successful call);
//      - return CONTEXT_CURRENT otherwise;
//      - throw GLException when the device refuses (JOGL: wglMakeCurrent failed);
//   4. call GLContext.setCurrent(this) when the result is not CONTEXT_NOT_CURRENT.
//   The gamepack treats CONTEXT_NOT_CURRENT and a thrown GLException (any RuntimeException) alike: it
//   creates a new context, sleeps 1000 ms and retries, and returns -2 after the 7th failure. Use them only
//   for transient states. For a permanent failure (no device, device lost), either leave the platform
//   unregistered (GLDrawableFactory.getFactory() then returns null), or throw a JavaError
//   (util/JavaException.ts) from makeCurrent. The JavaError mirrors the UnsatisfiedLinkError the shipped
//   JOGL raises from its first native call when the natives are missing (jogl.jar never loads them
//   itself). It skips catch (Exception) and reaches tf.a's catch (Throwable), so tf.a returns -5 at once
//   with no retries, after tf.o().
// - release(): GLContext.setCurrent(null), then release the device binding. Nothing is checked first.
// - destroy(): free the device context. getGL() keeps returning the same object.
// - getGL(): the context's GL. It is created with the context and never changes.
export default abstract class GLContext {
    // JOGL 1.1.x javax.media.opengl.GLContext constants. javac inlined them (the gamepack tests
    // makeCurrent() != 0), so the shipped class has none; values as in JOGL (checked against JOGL 2's
    // com.jogamp.opengl.GLContext by test/hd/jogl-surface.test.ts).
    static readonly CONTEXT_NOT_CURRENT = 0; // javax.media.opengl.GLContext.CONTEXT_NOT_CURRENT:I
    static readonly CONTEXT_CURRENT = 1; // javax.media.opengl.GLContext.CONTEXT_CURRENT:I
    static readonly CONTEXT_CURRENT_NEW = 2; // javax.media.opengl.GLContext.CONTEXT_CURRENT_NEW:I

    private static currentContext: GLContext | null = null; // javax.media.opengl.GLContext.currentContext:Ljavax/media/opengl/GLContext;

    // javax.media.opengl.GLContext.makeCurrent()I
    abstract makeCurrent(): number;

    // javax.media.opengl.GLContext.release()V
    abstract release(): void;

    // javax.media.opengl.GLContext.getCurrent()Ljavax/media/opengl/GLContext;
    static getCurrent(): GLContext | null {
        return GLContext.currentContext;
    }

    // javax.media.opengl.GLContext.setCurrent(Ljavax/media/opengl/GLContext;)V
    protected static setCurrent(cur: GLContext | null): void {
        GLContext.currentContext = cur;
    }

    // javax.media.opengl.GLContext.destroy()V
    abstract destroy(): void;

    // javax.media.opengl.GLContext.getGL()Ljavax/media/opengl/GL;
    abstract getGL(): GL;
}
