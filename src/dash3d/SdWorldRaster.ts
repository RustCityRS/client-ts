import Pix2D from '#/graphics/Pix2D';
import { requireNonNull } from '#/util/JavaArray';
import Pix3D from './Pix3D';
import SdRasterSpans, { type SdRasterFrame } from './SdRasterSpans';
import { rasterizeSdFrame } from './SdWebGpuRaster';
import world from './world';

/** Capture a synchronous SD draw on the currently bound framebuffer. Unsupported pixel access
 * fails the capture. Rendering and presentation can be queued without a GPU-to-CPU readback. */
export function captureSdFrame(draw: () => void): SdRasterFrame {
    if (Pix3D.spanTarget !== null) throw new Error('Nested SD WebGPU frame');
    const pixels = requireNonNull(Pix2D.pixels);
    const frame = new SdRasterSpans(pixels, Pix2D.width, Pix2D.height);
    Pix3D.spanTarget = frame;
    Pix2D.pixels = frame.guardedTarget;
    try {
        draw();
        return frame.finish();
    } finally {
        if (Pix2D.pixels === frame.guardedTarget) Pix2D.pixels = pixels;
        Pix3D.spanTarget = null;
    }
}

/** Render supported SD scene and UI draws into a new packed GPU framebuffer. The caller owns
 * the buffer and can queue presentation without synchronously copying pixels back to the CPU. */
export function renderSdFrame(device: GPUDevice, draw: () => void): Promise<GPUBuffer> {
    return rasterizeSdFrame(device, captureSdFrame(draw));
}

export function captureSdWorld(...args: Parameters<typeof world.draw>): SdRasterFrame {
    return captureSdFrame(() => world.draw(...args));
}

/** The optional GPU entry point for a pure world pass. The caller owns the returned packed pixel buffer. */
export function renderSdWorld(device: GPUDevice, ...args: Parameters<typeof world.draw>): Promise<GPUBuffer> {
    return rasterizeSdFrame(device, captureSdWorld(...args));
}
