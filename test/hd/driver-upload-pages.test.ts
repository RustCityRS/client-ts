import { afterAll, beforeAll, expect, test } from 'bun:test';
import GpuDevice from '#/gl/driver/GpuDevice.js';

const pageSize = 1024 * 1024;
const usage = Object.getOwnPropertyDescriptor(globalThis, 'GPUBufferUsage');
const mapMode = Object.getOwnPropertyDescriptor(globalThis, 'GPUMapMode');
beforeAll(() => {
    if (!usage) Object.assign(globalThis, { GPUBufferUsage: { MAP_WRITE: 2, COPY_SRC: 4 } });
    if (!mapMode) Object.assign(globalThis, { GPUMapMode: { WRITE: 2 } });
});
afterAll(() => {
    if (!usage) Reflect.deleteProperty(globalThis, 'GPUBufferUsage');
    if (!mapMode) Reflect.deleteProperty(globalThis, 'GPUMapMode');
});

class UploadPage {
    readonly data = new ArrayBuffer(pageSize);
    readonly remaps: PromiseWithResolvers<void>[] = [];
    destroyed = 0;
    getMappedRange(): ArrayBuffer {
        return this.data;
    }
    unmap(): void {}
    destroy(): void {
        this.destroyed++;
    }
    mapAsync(): Promise<void> {
        const remap = Promise.withResolvers<void>();
        this.remaps.push(remap);
        return remap.promise;
    }
}

function harness() {
    const pages: UploadPage[] = [],
        submissions: string[][] = [],
        copies: number[][] = [],
        writes: number[][] = [];
    const lost = Promise.withResolvers<GPUDeviceLostInfo>();
    const device = {
        lost: lost.promise,
        createBuffer(desc: GPUBufferDescriptor) {
            expect(desc.size).toBe(pageSize);
            expect(desc.mappedAtCreation).toBe(true);
            expect(desc.usage).toBe(GPUBufferUsage.MAP_WRITE | GPUBufferUsage.COPY_SRC);
            const page = new UploadPage();
            pages.push(page);
            return page;
        },
        createCommandEncoder(desc: GPUCommandEncoderDescriptor) {
            return {
                copyBufferToBuffer(src: UploadPage, offset: number, _dst: GPUBuffer, to: number, size: number) {
                    expect([offset, to]).toEqual([0, 0]);
                    copies.push([...new Uint8Array(src.data, offset, size)]);
                },
                finish() {
                    return desc.label;
                }
            };
        },
        queue: {
            writeBuffer(_dst: GPUBuffer, offset: number, src: ArrayBuffer, from: number, size: number) {
                expect([offset, from]).toEqual([0, 0]);
                writes.push([...new Uint8Array(src, from, size)]);
            },
            submit(commands: string[]) {
                submissions.push(commands);
            }
        }
    };
    return { gpu: new GpuDevice(device as unknown as GPUDevice, 'rgba8unorm'), pages, writes, copies, submissions, lost };
}
function destination(): GPUBuffer {
    return { size: pageSize } as GPUBuffer;
}

test('growing queue staging retains earlier writes and reuses the same backing on later submissions', () => {
    const { gpu, writes } = harness();
    const stream = destination();
    const first = Uint8Array.of(31, 41, 59, 26);
    gpu.stageDrawBytes(stream, 0, first);
    first.fill(0);
    const initial = gpu['streamBytes'].get(stream);
    expect(initial?.length).toBeLessThan(stream.size);
    gpu.stageDrawBytes(stream, 16400, Uint8Array.of(53, 58, 97, 93));
    expect(gpu.matchesDrawBytes(stream, 0, Uint8Array.of(31, 41, 59, 26), 0, 4)).toBe(true);
    const grown = gpu['streamBytes'].get(stream);
    expect(grown).not.toBe(initial);
    gpu.submit();
    expect(writes[0].length).toBe(16404);
    expect(writes[0].slice(0, 4)).toEqual([31, 41, 59, 26]);
    expect(writes[0].slice(-4)).toEqual([53, 58, 97, 93]);
    gpu.stageDrawBytes(stream, 4, Uint8Array.of(1, 2, 3, 4));
    gpu.submit();
    expect(gpu['streamBytes'].get(stream)).toBe(grown);
    expect(writes[1]).toEqual([31, 41, 59, 26, 1, 2, 3, 4]);
});

test('indexed upload snapshots, submits copies before draws, and falls back without waiting on a seventh map', async () => {
    const { gpu, pages, writes, copies, submissions } = harness();
    const streams = Array.from({ length: 7 }, destination);
    for (let i = 0; i < streams.length; i++) gpu.stageDrawBytes(streams[i], 0, Uint8Array.of(i, 0, 0, 0), true);
    const backing = Uint8Array.of(90, 91, 92, 93, 4, 3, 2, 1);
    gpu.stageDrawBytes(streams[0], 8, backing.subarray(4), true);
    backing.fill(255);
    gpu.getEncoder();
    gpu.submit();
    expect(pages).toHaveLength(6);
    expect(copies).toHaveLength(6);
    expect(copies[0]).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 4, 3, 2, 1]);
    expect(writes).toEqual([[6, 0, 0, 0]]);
    expect(submissions).toEqual([['gl-draw-uploads', 'gl-frame-0']]);

    gpu.stageDrawBytes(streams[0], 0, Uint8Array.of(1, 2, 3, 4), true);
    pages[0].remaps[0].resolve();
    await pages[0].remaps[0].promise;
    // The page became available between two writes to the same destination. Both stay in its queued upload.
    gpu.stageDrawBytes(streams[0], 4, Uint8Array.of(5, 6, 7, 8), true);
    gpu.stageDrawBytes(streams[1], 0, Uint8Array.of(8, 7, 6, 5), true);
    gpu.submit();
    expect(writes[1]).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(copies[6]).toEqual([8, 7, 6, 5]);
    expect(pages[0].remaps).toHaveLength(2);
    expect(pages).toHaveLength(6);
});

test('context disposal retains pending bytes and rejected or stale remaps cannot reclaim a page', async () => {
    const { gpu, pages, writes, copies, lost } = harness();
    const stream = destination();
    gpu.stageDrawBytes(stream, 0, Uint8Array.of(1, 1, 1, 1), true);
    gpu.submit();
    pages[0].remaps[0].reject(new Error('mapping failed'));
    await pages[0].remaps[0].promise.catch(() => {});
    expect(pages[0].destroyed).toBe(1);
    gpu.stageDrawBytes(stream, 0, Uint8Array.of(2, 2, 2, 2), true);
    gpu.submit();
    gpu.stageDrawBytes(stream, 0, Uint8Array.of(3, 3, 3, 3), true);
    expect(pages).toHaveLength(3);
    gpu.releaseUploadPages();
    expect(pages.map(p => p.destroyed)).toEqual([1, 1, 1]);
    pages[1].remaps[0].resolve();
    await pages[1].remaps[0].promise;
    gpu.submit();
    expect(writes).toEqual([[3, 3, 3, 3]]);
    expect(copies).toHaveLength(2);
    gpu.stageDrawBytes(stream, 0, Uint8Array.of(4, 4, 4, 4), true);
    gpu.submit();
    expect(pages).toHaveLength(4);
    lost.resolve({ message: 'device destroyed' } as GPUDeviceLostInfo);
    await lost.promise;
    expect(gpu.lost).toBe(true);
    expect(pages.map(p => p.destroyed)).toEqual([1, 1, 1, 1]);
    pages[3].remaps[0].resolve();
    await pages[3].remaps[0].promise;
    gpu.stageDrawBytes(stream, 0, Uint8Array.of(5, 5, 5, 5), true);
    expect(pages).toHaveLength(4);
});
