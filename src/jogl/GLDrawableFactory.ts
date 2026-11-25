import type GLCapabilities from './GLCapabilities';
import type GLCapabilitiesChooser from './GLCapabilitiesChooser';
import type GLDrawable from './GLDrawable';

// javax.media.opengl.GLDrawableFactory (shipped jogl.jar, JOGL 1.1.x, as customised by Jagex).
//
// getFactory() in the shipped class creates the platform factory once, picked by
// System.getProperty("os.name").toLowerCase():
// - "win" gives WindowsGLDrawableFactory;
// - "mac" gives MacOSXGLDrawableFactory;
// - "linux" or "sunos" gives X11GLDrawableFactory;
// - any other OS leaves the factory null and returns null. The gamepack then calls getGLDrawable on null,
//   and the NullPointerException reaches tf.a(Ljava/awt/Canvas;I)I's catch (Throwable), which returns -5.
// The browser has no os.name and no native factories. Instead the host registers one platform constructor
// with registerGLDrawableFactory (the WebGPU provider in the client, NullGL or a fake in tests). The
// constructor plays the role of os.name plus `new XxxGLDrawableFactory()`. With nothing registered, the
// Java "unsupported OS" path is kept: getFactory() returns null, and the port of tf.a throws
// TypeError('Null reference') at the call, as Java throws NPE. The constructor runs on the first
// getFactory() after a registration and may throw, as a Java factory constructor may. A throw caches
// nothing, so the next getFactory() runs it again, as Java retries while `factory` is null.
//
// Contract for getGLDrawable implementations. This is the Java-visible behaviour of the shipped
// WindowsGLDrawableFactory.
// - target === null: throw java.lang.IllegalArgumentException('Null target'). That is a RuntimeException,
//   a plain Error in the port (e.g. new Error('IllegalArgumentException')).
// - a target that is not the client's canvas component: throw IllegalArgumentException('GLDrawables not
//   supported for objects of type <class> (only Components are supported in this implementation)').
// - capabilities === null means new GLCapabilities(); chooser === null means the default chooser.
//   The drawable keeps capabilities.clone(), so later changes to the caller's object have no effect.
// - Returns a new, unrealized drawable. It does not touch the device.
export default abstract class GLDrawableFactory {
    // javax.media.opengl.GLDrawableFactory.getFactory()Ljavax/media/opengl/GLDrawableFactory;
    static getFactory(): GLDrawableFactory | null {
        if (factory === null && platform !== null) {
            factory = platform();
        }
        return factory;
    }

    // javax.media.opengl.GLDrawableFactory.getGLDrawable(Ljava/lang/Object;Ljavax/media/opengl/GLCapabilities;Ljavax/media/opengl/GLCapabilitiesChooser;)Ljavax/media/opengl/GLDrawable;
    abstract getGLDrawable(target: object | null, capabilities: GLCapabilities | null, chooser: GLCapabilitiesChooser | null): GLDrawable;
}

// javax.media.opengl.GLDrawableFactory.factory:Ljavax/media/opengl/GLDrawableFactory;
// A module binding rather than a private static, so that registerGLDrawableFactory can reset it.
let factory: GLDrawableFactory | null = null;

// Host stand-in for os.name: the platform factory constructor, or null for an unsupported platform.
let platform: (() => GLDrawableFactory) | null = null;

// Host only (no Java counterpart). Sets the platform whose factory getFactory() creates and returns, and
// drops the factory already created, so the next getFactory() constructs a new one. Pass null to make the
// platform unsupported again. Java never changes os.name within a JVM, so the client calls this once at
// boot; tests call it per case.
export function registerGLDrawableFactory(create: (() => GLDrawableFactory) | null): void {
    platform = create;
    factory = null;
}
