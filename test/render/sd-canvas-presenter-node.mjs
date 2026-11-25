import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import SdCanvasPresenter from '../../src/gl/driver/SdCanvasPresenter.ts';

const { create, globals } = await import(pathToFileURL(process.argv[4]).href);
Object.assign(globalThis, globals);
const gpu = create([]);
const adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' });
assert.ok(adapter, 'SD canvas presentation requires a WebGPU adapter');
const device = await adapter.requestDevice();
const scenario = readFileSync(process.argv[2], 'utf8')
    .trim()
    .split('\n')
    .map(row => row.split(' ').map(Number));
const expected = readFileSync(process.argv[3]);
try {
    for (const format of ['bgra8unorm', 'rgba8unorm']) {
        const outputs = [];
        let width,
            height,
            configured = false,
            releases = 0;
        const context = {
            configure(c) {
                assert.equal(configured, false);
                assert.equal(c.device, device);
                assert.equal(c.format, format);
                assert.equal(c.alphaMode, 'opaque');
                assert.ok(c.usage & GPUTextureUsage.COPY_DST);
                configured = true;
            },
            getCurrentTexture() {
                assert.ok(configured);
                // Every simulated swap hands back a new empty hardware texture.
                const texture = device.createTexture({ size: [width, height], format, usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC | GPUTextureUsage.RENDER_ATTACHMENT });
                outputs.push(texture);
                return texture;
            },
            unconfigure() {
                assert.ok(configured);
                configured = false;
                releases++;
            }
        };
        device.pushErrorScope('validation');
        const presenter = new SdCanvasPresenter(device, context, format);
        let packed;
        try {
            for (const [w, h, sw, sh, seed, count, ...coords] of scenario) {
                width = sw;
                height = sh;
                const words = Int32Array.from({ length: w * h + 1 }, (_, i) => Math.imul(i, 0x2545f491) ^ Math.imul(seed, 0x27d4eb2f));
                if (packed?.size !== words.byteLength) {
                    packed?.destroy();
                    // No COPY_SRC or MAP_READ usage. Normal present takes only the resident raster output.
                    packed = device.createBuffer({ size: words.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
                }
                device.queue.writeBuffer(packed, 0, words);
                let rects;
                if (count === -1) {
                    rects = undefined;
                } else {
                    rects = Array.from({ length: count }, (_, i) => ({
                        x: coords[4 * i],
                        y: coords[4 * i + 1],
                        width: coords[4 * i + 2],
                        height: coords[4 * i + 3]
                    }));
                }
                if (format === 'rgba8unorm') {
                    const encoder = device.createCommandEncoder();
                    presenter.present(packed, w, h, rects, encoder);
                    device.queue.submit([encoder.finish()]);
                } else presenter.present(packed, w, h, rects);
            }
            // Retire the window with all its swaps still queued. SD/HD mode changes can do this.
            presenter.release();
            presenter.release();
            assert.equal(releases, 1);
            assert.throws(() => presenter.present(packed, 1, 1), /released/);
            assert.equal(outputs.length, scenario.length);

            let at = 0;
            for (const [frame, texture] of outputs.entries()) {
                const { width: w, height: h } = texture;
                const pitch = Math.ceil(w / 64) * 256;
                const staging = device.createBuffer({ size: pitch * h, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
                try {
                    const encoder = device.createCommandEncoder();
                    encoder.copyTextureToBuffer({ texture }, { buffer: staging, bytesPerRow: pitch }, [w, h]);
                    device.queue.submit([encoder.finish()]);
                    await staging.mapAsync(GPUMapMode.READ);
                    const bytes = new Uint8Array(staging.getMappedRange());
                    for (let y = 0; y < h; y++)
                        for (let x = 0; x < w; x++) {
                            const p = y * pitch + x * 4;
                            const r = bytes[p + (format === 'bgra8unorm' ? 2 : 0)];
                            const b = bytes[p + (format === 'bgra8unorm' ? 0 : 2)];
                            const argb = ((bytes[p + 3] << 24) | (r << 16) | (bytes[p + 1] << 8) | b) >>> 0;
                            assert.equal(argb, expected.readUInt32BE(at), format + ' frame ' + frame + ' at ' + x + ',' + y);
                            at += 4;
                        }
                } finally {
                    staging.destroy();
                }
            }
            assert.equal(at, expected.length);
        } finally {
            presenter.release();
            packed?.destroy();
            for (const texture of outputs) texture.destroy();
        }
        const error = await device.popErrorScope();
        assert.equal(error, null, error?.message);
    }
    console.log(adapter.info.description, expected.length * 2, 'canvas bytes checked');
} finally {
    device.destroy();
}
