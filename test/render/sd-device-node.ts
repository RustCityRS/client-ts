import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import SdRasterSpans, { type SdRasterFrame } from '#/dash3d/SdRasterSpans.js';
import { rasterizeSdFrame, SdWebGpuRaster } from '#/dash3d/SdWebGpuRaster.js';
import { readWebGpuFramebuffer } from './Framebuffer.js';

const { create, globals } = await import(pathToFileURL(process.argv[2]).href);
Object.assign(globalThis, globals);
const gpu = create([]);
const adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' });
if (adapter === null) throw new Error('SD world gate requires a WebGPU adapter');
const device: GPUDevice = await adapter.requestDevice();
const resident = process.argv[4] === 'resident' ? new SdWebGpuRaster(device) : null;
async function verifyResidentPaletteChanges(): Promise<void> {
    const raster = new SdWebGpuRaster(device),
        pixels = new Int32Array(4);
    const first = new SdRasterSpans(pixels, 4, 1, true),
        second = new SdRasterSpans(pixels, 4, 1, true);
    const palette = Int32Array.of(10, 20, 30, 40);
    await raster.prepare();
    const writes: number[] = [];
    const queue = device.queue,
        write = queue.writeBuffer;
    const writeToQueue = write.bind(queue);
    queue.writeBuffer = function (buffer, offset, data, dataOffset, size) {
        if (buffer.label === '530 SD palette and texels') writes.push(size ?? 0);
        writeToQueue(buffer, offset, data, dataOffset, size);
    };
    try {
        const draw = async (capture: SdRasterSpans, source: Int32Array, index: number, bytes: number): Promise<void> => {
            capture.gouraud(capture.guardedTarget, 0, 0, 4, index << 8, 0, 0, 1, source);
            const count = writes.length;
            const result = raster.drawResident(capture.finish(), false);
            const frame = await readWebGpuFramebuffer(device, { buffer: result, width: 4, pitch: 4, height: 1 });
            if (frame.pixels.some(pixel => pixel !== source[index])) throw new Error('Stale resident palette entry ' + index);
            if (writes.length !== count + Number(bytes !== 0) || (bytes && writes[count] !== bytes)) {
                throw new Error('Expected palette upload ' + bytes + ' got ' + writes.slice(count));
            }
            capture.reset();
        };
        await draw(first, palette, 1, 16);
        await draw(first, palette, 2, 0);
        palette[2] = 0x637c47;
        await draw(first, palette, 2, 4);
        await draw(first, palette.subarray(0, 2), 1, 0);
        await draw(first, palette, 3, 8);
        palette[1] = 91;
        first.gouraud(first.guardedTarget, 0, 0, 4, 256, 0, 0, 1, palette);
        first.finish(); // This revision never reached the device.
        first.reset();
        await draw(first, palette, 1, 16);
        await draw(second, palette, 0, 16);
        const expanded = new Int32Array(2048);
        expanded.set(palette);
        expanded[2047] = 0x1277a3;
        await draw(second, expanded, 2047, expanded.byteLength);
        await draw(second, expanded, 2047, 0);
    } finally {
        queue.writeBuffer = write;
        raster.dispose();
    }
}
try {
    if (resident) {
        await verifyResidentPaletteChanges();
        await resident.prepare();
    }
    const files: { width: number; height: number; initial: string; assets: string; batches: string[]; feedback?: { offset: number; image: string }[]; output: string }[] = JSON.parse(readFileSync(process.argv[3], 'utf8'));
    const load = (file: string): Int32Array => {
        const data = readFileSync(file);
        return new Int32Array(data.buffer, data.byteOffset, data.byteLength / 4);
    };
    for (const [index, source] of files.entries()) {
        const frame: SdRasterFrame = { width: source.width, height: source.height, initial: load(source.initial), assets: load(source.assets), batches: source.batches.map(load) };
        if (resident) {
            if (source.feedback) frame.feedback = source.feedback.map(({ offset, image }) => ({ offset, pixels: load(image) }));
            const buffer = resident.drawResident(frame, index === 0);
            const result = await readWebGpuFramebuffer(device, { buffer, width: frame.width, pitch: frame.width, height: frame.height });
            writeFileSync(source.output, result.pixels);
            if (index === files.length - 1) {
                // PixScreen remains stale until a real CPU consumer asks for it.
                const native = frame.initial;
                await resident.syncToCpu(native);
                if (native.some((word, i) => i < result.pixels.length && word !== result.pixels[i])) throw new Error('Stale CPU framebuffer after handoff');
            }
            continue;
        }
        if (source.feedback) {
            const feedback = source.feedback;
            frame.feedback = feedback.map(({ offset, image }) => ({ offset, pixels: load(image) }));
            const raster = new SdWebGpuRaster(device);
            try {
                await raster.update(frame, frame.initial);
                writeFileSync(source.output, frame.initial);
                frame.feedback.forEach(({ pixels }, i) => writeFileSync(feedback[i].image, pixels));
            } finally {
                raster.dispose();
            }
            continue;
        }
        const buffer = await rasterizeSdFrame(device, frame);
        try {
            const result = await readWebGpuFramebuffer(device, { buffer, width: frame.width, pitch: frame.width, height: frame.height });
            writeFileSync(source.output, result.pixels);
        } finally {
            buffer.destroy();
        }
    }
} finally {
    resident?.dispose();
    device.destroy();
}
