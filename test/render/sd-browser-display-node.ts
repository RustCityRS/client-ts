import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import Client from '#/client/Client.js';
import GameShell from '#/client/GameShell.js';
import SdBrowserDisplay from '#/client/SdBrowserDisplay.js';
import Pix3D from '#/dash3d/Pix3D.js';
import { fromJsString } from '#/datastruct/JagString.js';
import GpuDevice from '#/gl/driver/GpuDevice.js';
import Presenter from '#/gl/driver/Presenter.js';
import { readTexture } from '#/gl/driver/SurfaceTargets.js';
import Pix2D from '#/graphics/Pix2D.js';
import PixScreen, { CanvasComponent, type CanvasSurface } from '#/graphics/PixScreen.js';
import SoftwareFont from '#/graphics/SoftwareFont.js';
import { requireNonNull } from '#/util/JavaArray.js';

const { create, globals } = await import(pathToFileURL(process.argv[2]).href);
Object.assign(globalThis, globals);
const api: GPU = create([]);
const adapter = await api.requestAdapter({ powerPreference: 'high-performance' });
assert.ok(adapter, 'SD browser bridge requires a GPU adapter');
const device = await adapter.requestDevice();
const gpu = new GpuDevice(device, 'rgba8unorm');
const w = 83,
    h = 49;
const raw = readFileSync(process.argv[3]);
let at = 0;
function next(length = w * h): Int32Array {
    const snapshot = Int32Array.from({ length }, (_, i) => raw.readInt32BE(at + i * 4));
    at += length * 4;
    return snapshot;
}
const screens = [next(), next(), next(), next()];
const handedOff = next(w * h + 1),
    cpu = next(),
    lastGpu = next();
assert.equal(at, raw.byteLength);
const outputs: GPUTexture[] = [];
let configuration: GPUCanvasConfiguration | undefined,
    releases = 0;
const context = {
    configure(c: GPUCanvasConfiguration) {
        configuration = c;
    },
    unconfigure() {
        assert.ok(configuration);
        configuration = undefined;
        releases++;
    },
    getCurrentTexture() {
        assert.ok(configuration);
        const texture = device.createTexture({ size: [w, h], format: configuration.format, usage: (configuration.usage ?? GPUTextureUsage.RENDER_ATTACHMENT) | GPUTextureUsage.COPY_SRC });
        outputs.push(texture);
        return texture;
    }
} as GPUCanvasContext;
let cpuPaints = 0,
    readbacks = 0,
    submissions = 0;
const surface: CanvasSurface = {
    createImageData(width, height) {
        return { width, height, data: new Uint8ClampedArray(width * height * 4) } as ImageData;
    },
    putImageData(data, dx, dy, x, y, width, height) {
        assert.deepEqual([dx, dy, x, y, width, height], [0, 0, 0, 0, w, h]);
        cpuPaints++;
        for (let i = 0; i < w * h; i++) {
            const p = i * 4,
                d = data.data;
            assert.equal((d[p + 3] << 24) | (d[p] << 16) | (d[p + 1] << 8) | d[p + 2], cpu[i], 'CPU handoff pixel ' + i);
        }
    }
};
const component = new CanvasComponent(surface);
GameShell.canvas = component;
const screen = (GameShell.drawArea = await PixScreen.create(h, component, w));
const pixels = requireNonNull(screen.pixels);
for (let i = 0; i < pixels.length; i++) pixels[i] = Math.imul(i, 0x31c3eb91) ^ 0x7c568931;
const seed = pixels.slice();
const metrics = new Uint8Array(257).fill(5);
metrics[256] = 8;
const zero = new Int32Array(256);
Client.p12 = new SoftwareFont(
    metrics,
    zero,
    zero,
    new Int32Array(256).fill(3),
    new Int32Array(256).fill(5),
    Array.from({ length: 256 }, (_, c) => Uint8Array.from({ length: 15 }, (_, i) => +((c + i) % 3 !== 0)))
);
const map = GPUBuffer.prototype.mapAsync;
const submit = GPUQueue.prototype.submit;
GPUQueue.prototype.submit = function (commands) {
    submissions++;
    return submit.call(this, commands);
};
GPUBuffer.prototype.mapAsync = function (...args) {
    readbacks++;
    return map.apply(this, args);
};
device.pushErrorScope('validation');
try {
    const initialGraphics = component.getGraphics();
    const display = new SdBrowserDisplay(gpu, context, screen, component);
    await display.bind();
    assert.ok(Pix3D.spanTarget);
    assert.notEqual(Pix2D.pixels, pixels);
    display.beginFrame();
    screen.draw(0, 0, initialGraphics);
    assert.equal(outputs.length, 0);
    display.finishFrame();
    const beforePartial = submissions;
    display.beginFrame();
    Pix2D.fillRect(1, 1, 80, 47, 0x9c5a1762);
    Pix2D.fillRectTrans(3, 2, 45, 31, 0xabee77, 67);
    const graphics = component.getGraphics();
    graphics.clipRect(4, 2, 40, 19);
    screen.drawClipped(7, 23, 1, 0, graphics);
    screen.drawClipped(3, 31, 26, 14, graphics);
    assert.equal(outputs.length, 1);
    display.finishFrame();
    assert.equal(outputs.length, 2);
    assert.equal(submissions - beforePartial, 1, 'One submission for two fills and both window clips');
    // A frame without a dirty window still updates the raster underneath the next message.
    display.beginFrame();
    Pix2D.fillRect(36, 28, 29, 12, 0x7f090705);
    display.finishFrame();
    assert.equal(outputs.length, 2);
    Client.MessageBox(fromJsString('Please wait'), true);
    assert.equal(outputs.length, 3);
    Pix2D.fillRectTrans(37, 30, 41, 16, 0x916b4f, 127);
    screen.drawClipped(61, 20, 40, 34, component.getGraphics());
    assert.equal(outputs.length, 4);
    Pix2D.fillRect(2, 43, 27, 3, 0xdde0f210);
    assert.deepEqual(pixels, seed);
    assert.equal(readbacks, 0);
    const keptGraphics = component.getGraphics();
    await display.leave(true);
    assert.equal(releases, 1);
    assert.equal(readbacks, 1);
    assert.deepEqual(pixels, handedOff);
    assert.equal(Pix3D.spanTarget, null);
    assert.equal(Pix2D.pixels, pixels);
    assert.equal(component.presentImage, undefined);
    Pix2D.fillRect(13, 30, 6, 2, 0x90549886);
    screen.draw(0, 0, keptGraphics);
    assert.equal(cpuPaints, 1);

    // Rebind, present and discard. No stale raster words should reach the Java surface.
    const cpuState = pixels.slice();
    const second = new SdBrowserDisplay(gpu, context, screen, component);
    await second.bind();
    Pix2D.fillRect(19, 20, 11, 9, 0x11776655);
    screen.draw(0, 0, component.getGraphics());
    Pix2D.fillRect(1, 1, 12, 12, 0xc01454);
    await second.leave(false);
    assert.equal(releases, 2);
    assert.equal(readbacks, 1);
    assert.deepEqual(pixels, cpuState);
    assert.equal(Pix3D.spanTarget, null);
    assert.equal(Pix2D.pixels, pixels);
    assert.equal(component.presentImage, undefined);
    assert.equal(cpuPaints, 1);
    // The existing HD window presenter can take this very same canvas after SD.
    const hd = new Presenter(gpu, { width: () => w, height: () => h, canvasContext: () => context });
    const front = hd.ensureFront(w, h);
    gpu.getEncoder()
        .beginRenderPass({
            colorAttachments: [
                {
                    view: front.createView(),
                    loadOp: 'clear',
                    storeOp: 'store',
                    clearValue: [1, 0, 1, 1]
                }
            ]
        })
        .end();
    hd.present();
    gpu.submit();
    front.destroy();
    const expected = [...screens, lastGpu, new Int32Array(w * h).fill(0xffff00ff)];
    assert.equal(outputs.length, expected.length);
    for (const [i, texture] of outputs.entries()) {
        const d = await readTexture(gpu, texture, w, h);
        const actual = Int32Array.from({ length: w * h }, (_, k) => (d[4 * k + 3] << 24) | (d[4 * k] << 16) | (d[4 * k + 1] << 8) | d[4 * k + 2]);
        assert.deepEqual(actual, expected[i], 'Window ' + i);
    }
    const error = await device.popErrorScope();
    assert.equal(error, null, error?.message);
} finally {
    for (const texture of outputs) texture.destroy();
    GPUBuffer.prototype.mapAsync = map;
    GPUQueue.prototype.submit = submit;
    device.destroy();
}
