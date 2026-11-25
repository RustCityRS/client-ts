// A render pass keeps these WebGPU settings until another command changes them or the pass ends.
// All drawing into a drawable shares this state, including scissored clears and pixel transfers.
import type StressRenderPass from './StressRenderPass';

export default class DrawPass {
    private pipeline?: GPURenderPipeline;
    private readonly groups: (GPUBindGroup | undefined)[] = [];
    private readonly dynamicOffsets: (number | undefined)[] = [];
    private readonly oneOffset = new Uint32Array(1);
    private readonly vertices: (GPUBuffer | undefined)[] = [];
    private readonly vertexOffsets: number[] = [];
    private readonly vertexSizes: (number | undefined)[] = [];
    private index?: GPUBuffer;
    private indexFormat?: GPUIndexFormat;
    private indexOffset = 0;
    private indexSize?: number;
    private readonly viewport = new Float64Array(6).fill(NaN);
    private readonly scissor = new Float64Array(4).fill(NaN);
    private immediateCount = 0;
    private immediateEnd = 0;

    constructor(private readonly encoder: GPURenderPassEncoder | StressRenderPass) {}

    setPipeline(pipeline: GPURenderPipeline): void {
        if (this.pipeline === pipeline) return;
        this.flushImmediate();
        this.encoder.setPipeline(pipeline);
        this.pipeline = pipeline;
    }

    setBindGroup(slot: number, group: GPUBindGroup, offset?: number): void {
        if (this.groups[slot] === group && this.dynamicOffsets[slot] === offset) return;
        this.flushImmediate();
        if (offset === undefined) this.encoder.setBindGroup(slot, group);
        else {
            this.oneOffset[0] = offset;
            this.encoder.setBindGroup(slot, group, this.oneOffset, 0, 1);
        }
        this.groups[slot] = group;
        this.dynamicOffsets[slot] = offset;
    }

    setVertexBuffer(slot: number, buffer: GPUBuffer, offset: number, size?: number): void {
        if (this.vertices[slot] === buffer && this.vertexOffsets[slot] === offset && this.vertexSizes[slot] === size) return;
        this.flushImmediate();
        this.encoder.setVertexBuffer(slot, buffer, offset, size);
        this.vertices[slot] = buffer;
        this.vertexOffsets[slot] = offset;
        this.vertexSizes[slot] = size;
    }

    setIndexBuffer(buffer: GPUBuffer, format: GPUIndexFormat, offset = 0, size?: number): void {
        if (this.index === buffer && this.indexFormat === format && this.indexOffset === offset && this.indexSize === size) return;
        this.flushImmediate();
        this.encoder.setIndexBuffer(buffer, format, offset, size);
        this.index = buffer;
        this.indexFormat = format;
        this.indexOffset = offset;
        this.indexSize = size;
    }

    setViewport(x: number, y: number, w: number, h: number, min: number, max: number): void {
        const v = this.viewport;
        if (v[0] === x && v[1] === y && v[2] === w && v[3] === h && v[4] === min && v[5] === max) return;
        this.flushImmediate();
        this.encoder.setViewport(x, y, w, h, min, max);
        v[0] = x;
        v[1] = y;
        v[2] = w;
        v[3] = h;
        v[4] = min;
        v[5] = max;
    }

    setScissorRect(x: number, y: number, w: number, h: number): void {
        const r = this.scissor;
        if (r[0] === x && r[1] === y && r[2] === w && r[3] === h) return;
        this.flushImmediate();
        this.encoder.setScissorRect(x, y, w, h);
        r[0] = x;
        r[1] = y;
        r[2] = w;
        r[3] = h;
    }

    // Immediate triangles and lines contain complete primitives in a single vertex stream.
    // Successive glyphs commonly use the same atlas, pipeline and clip. Preserve vertex order
    // and submit the run before any effective pass state change or intervening draw.
    drawImmediate(buffer: GPUBuffer, offset: number, bytes: number, count: number): void {
        if (this.immediateCount === 0 || this.vertices[0] !== buffer || this.immediateEnd !== offset) {
            this.flushImmediate();
            this.setVertexBuffer(0, buffer, offset);
        }
        this.immediateEnd = offset + bytes;
        this.immediateCount += count;
    }

    private flushImmediate(): void {
        if (this.immediateCount !== 0) {
            this.encoder.draw(this.immediateCount);
            this.immediateCount = 0;
        }
    }

    draw(count: number): void {
        this.flushImmediate();
        this.encoder.draw(count);
    }

    drawIndexed(count: number, firstIndex: number): void {
        this.flushImmediate();
        this.encoder.drawIndexed(count, 1, firstIndex);
    }

    end(): void {
        this.flushImmediate();
        this.encoder.end();
    }
}
