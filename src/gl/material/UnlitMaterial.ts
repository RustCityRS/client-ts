import Preferences from '#/ui/Preferences';
import GlRenderer from '#/gl/GlRenderer';
import type MaterialRenderer from './MaterialRenderer';

// ue in runescape_gl.jar (HD only): material 6, unlit. With high-detail lighting on (od.c), bind() turns GL_LIGHTING
// off through the renderer's cached switch and unbind() turns it back on; otherwise it does nothing. te.e(I)V stores
// it in the slot its argument names (6 at the only call, tf.s()V).
export default class UnlitMaterial implements MaterialRenderer {
    // ue.<init>()V
    constructor() {}

    // ue.b()V
    bind(): void {
        if (Preferences.graphics.highDetailLighting) {
            GlRenderer.setLighting(false);
        }
    }

    // ue.c()I
    flags(): number {
        return 0;
    }

    // ue.a(I)V
    setArgument(_argument: number): void {}

    // ue.a()V
    unbind(): void {
        if (Preferences.graphics.highDetailLighting) {
            GlRenderer.setLighting(true);
        }
    }
}
