import type GLContext from './GLContext';

// javax.media.opengl.GLDrawable (shipped jogl.jar, JOGL 1.1.x, shrunk to the three methods the gamepack
// calls).
//
// Contract for implementations. This is the Java-visible behaviour of the shipped
// com.sun.opengl.impl.windows.WindowsOnscreenGLDrawable.
// - createContext(share): returns a new GLContext for this drawable; the gamepack passes null. The device
//   context is created lazily by the first successful makeCurrent(), so createContext never fails for
//   lack of a device.
// - setRealized(true/false): binds the drawable to, or unbinds it from, the native surface (the canvas).
//   tf.o()V and tf.a(Ljava/awt/Canvas;)V call setRealized(false) on drawables whose contexts are already
//   destroyed; that must not throw.
// - swapBuffers(): presents the back buffer. A GLException is caught by tf.d()V and ignored. In
//   tf.a(Ljava/awt/Canvas;I)I, each exception costs a 100 ms retry, and the 7th failure returns -3.
interface GLDrawable {
    // javax.media.opengl.GLDrawable.createContext(Ljavax/media/opengl/GLContext;)Ljavax/media/opengl/GLContext;
    createContext(shareWith: GLContext | null): GLContext;

    // javax.media.opengl.GLDrawable.setRealized(Z)V
    setRealized(realized: boolean): void;

    // javax.media.opengl.GLDrawable.swapBuffers()V
    swapBuffers(): void;
}

export type { GLDrawable as default };
