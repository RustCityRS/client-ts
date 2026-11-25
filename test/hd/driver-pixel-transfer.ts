import { createHash } from 'node:crypto';
import { FALLBACK_CAPS_PROFILE } from '../../src/gl/CapsProfile.js';
import GlRaster from '../../src/gl/GlRaster.js';
import GlRenderer from '../../src/gl/GlRenderer.js';
import GpuDevice from '../../src/gl/driver/GpuDevice.js';
import { GLX as E } from '../../src/gl/driver/GlEnums.js';
import { WebGpuContext, WebGpuDrawable, WebGpuDrawableFactory } from '../../src/gl/driver/WebGpuDrawableFactory.js';
import GLCapabilities from '../../src/jogl/GLCapabilities.js';
import IntBuffer from '../../src/util/nio/IntBuffer.js';
import { requireNonNull } from '../../src/util/JavaArray.js';

// HdPixelTransferOracle.java, unmodified 530 JOGL and native RTX RGBA8 pre-swap readback.
const reference = [
    '97dcf67a320db7db5baed78750bb8330dfad3b4db36b36341cb4ccc708726972',
    '97dcf67a320db7db5baed78750bb8330dfad3b4db36b36341cb4ccc708726972',
    'd1b670ce1731ad5ecbf2bcdf68a0a3834f7438f9fe48ca4c45dcac8323271519',
    '1ec1b52f5986792ee2981b8bd3d64c5d3cc99d65e265722860cf84dd90097cf1',
    '66648476cfd9ed4972cfd35acb4ff6c82db53f5c6c702498c9d71963d3510258',
    'a03dee578b88fe51114cd74a6ab9a270bb6ebcec2a974e81256ff6d195764dc4',
    '0b5c9ba4eed677480a822e72bb624886cf087d8c04d055d40311db7b79b73c11',
    '0b5c9ba4eed677480a822e72bb624886cf087d8c04d055d40311db7b79b73c11',
    '3b122de15b0c15645b65938b73e78a8dc413149c7bd361f47284e9dc6e56090a',
    'fa3bc3a30f0da784dd39c05f91a53c3e1e16b1f0af5b54c7d01e68f83185dbb1'
];

export async function checkPixelTransfers(gpu: GpuDevice, check: (name: string, ok: boolean, detail: string) => void): Promise<void> {
    const width = 37,
        height = 29;
    const caps = new GLCapabilities();
    caps.setDoubleBuffered(true);
    caps.setAlphaBits(8);
    const factory = new WebGpuDrawableFactory(FALLBACK_CAPS_PROFILE, { device: gpu });
    const drawable = factory.getGLDrawable({ width, height }, caps, null) as WebGpuDrawable;
    drawable.setRealized(true);
    const context = drawable.createContext(null) as WebGpuContext;
    context.makeCurrent();
    const gl = context.driver();
    const targets = requireNonNull(drawable.currentTargets());
    const pixels = Int32Array.from({ length: width * height + 64 }, (_, i) => (0x2e7fdb95 + Math.imul(i, 0x170f0309)) | 0);
    function prepare() {
        for (const cap of [E.GL_SCISSOR_TEST, E.GL_DEPTH_TEST, E.GL_FOG, E.GL_BLEND, E.GL_ALPHA_TEST]) gl.glDisable(cap);
        gl.glClearColor(0.2, 0.4, 0.6, 0.8);
        gl.glClear(E.GL_COLOR_BUFFER_BIT);
        for (const pname of [E.GL_UNPACK_SWAP_BYTES, E.GL_UNPACK_SKIP_ROWS, E.GL_UNPACK_SKIP_PIXELS, E.GL_UNPACK_ROW_LENGTH]) gl.glPixelStorei(pname, 0);
        gl.glPixelStorei(E.GL_UNPACK_ALIGNMENT, 4);
        gl.glPixelZoom(1, 1);
    }
    GlRenderer.gl = gl;
    GlRenderer.width = width;
    GlRenderer.height = height;
    GlRenderer.active = true;
    try {
        for (let mode = 0; mode < reference.length; mode++) {
            prepare();
            if (mode <= 2) {
                GlRenderer.bigEndian = mode === 1;
                if (mode === 2) {
                    gl.glEnable(E.GL_SCISSOR_TEST);
                    gl.glScissor(9, 8, 10, 11);
                }
                GlRaster.drawPixels(pixels, 6, 7, 13, 11);
            } else if (mode >= 8) {
                GlRaster.drawPixels(pixels, 0, 0, width, height);
                drawable.swapBuffers();
                prepare();
                if (mode === 9) {
                    gl.glEnable(E.GL_SCISSOR_TEST);
                    gl.glScissor(4, 6, 17, 13);
                }
                GlRenderer.copyFrontToBack();
            } else {
                const data = IntBuffer.wrap(pixels);
                data.position(2);
                gl.glPixelStorei(E.GL_UNPACK_ROW_LENGTH, 15);
                gl.glPixelStorei(E.GL_UNPACK_SKIP_ROWS, 2);
                gl.glPixelStorei(E.GL_UNPACK_SKIP_PIXELS, 1);
                gl.glPixelStorei(E.GL_UNPACK_ALIGNMENT, 8);
                gl.glPixelStorei(E.GL_UNPACK_SWAP_BYTES, mode === 3 ? 1 : 0);
                gl.glRasterPos2i(mode === 7 ? -1 : 11, 17);
                gl.glPixelZoom(mode === 5 ? -1.5 : 1, mode === 4 ? 2.5 : mode === 6 ? 0 : -1);
                gl.glDrawPixels(9, 7, E.GL_BGRA, mode === 3 ? E.GL_UNSIGNED_INT_8_8_8_8_REV : E.GL_UNSIGNED_BYTE, data);
            }
            const actual = createHash('sha256')
                .update(await targets.readBack())
                .digest('hex');
            check('native JOGL pixel transfer ' + mode, actual === reference[mode], actual + ' vs ' + reference[mode]);
        }
    } finally {
        GlRenderer.active = false;
        GlRenderer.gl = null;
        GlRenderer.bigEndian = false;
        context.release();
        context.destroy();
        drawable.setRealized(false);
    }
}
