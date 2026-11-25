import type GLCapabilities from './GLCapabilities';

// javax.media.opengl.GLCapabilitiesChooser (shipped jogl.jar, JOGL 1.1.x). It appears in the signature of
// GLDrawableFactory.getGLDrawable; the gamepack always passes null, which lets the platform factory use
// its default chooser.
interface GLCapabilitiesChooser {
    // javax.media.opengl.GLCapabilitiesChooser.chooseCapabilities(Ljavax/media/opengl/GLCapabilities;[Ljavax/media/opengl/GLCapabilities;I)I
    chooseCapabilities(desired: GLCapabilities | null, available: (GLCapabilities | null)[] | null, windowSystemRecommendedChoice: number): number;
}

export type { GLCapabilitiesChooser as default };
