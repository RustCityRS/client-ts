type Viewport = [number, number, number, number, number, number];
type Scissor = [number, number, number, number];
type VertexBuffer = { buffer: GPUBuffer; offset: number; size?: number };

// WebGPU keeps viewport and scissor on the pass. A bundle starts with empty
// pipeline, bind group, vertex and index state, even after another bundle.
export default class RecordedRenderBundles {
    private readonly segments: { viewport?: Viewport; scissor?: Scissor; bundles: GPURenderBundle[] }[] = [];
    private viewport?: Viewport;
    private scissor?: Scissor;
    private encoder?: GPURenderBundleEncoder;
    private drew = false;
    private pipeline?: GPURenderPipeline;
    private readonly groups: { group: GPUBindGroup; offsets: number[] }[] = [];
    private readonly vertices: VertexBuffer[] = [];
    private index?: VertexBuffer & { format: GPUIndexFormat };

    constructor(
        private readonly device: GPUDevice,
        private readonly layout: GPURenderBundleEncoderDescriptor
    ) {}

    private current(): GPURenderBundleEncoder {
        if (this.encoder) return this.encoder;
        const encoder = this.device.createRenderBundleEncoder(this.layout);
        if (this.pipeline) encoder.setPipeline(this.pipeline);
        for (let slot = 0; slot < this.groups.length; slot++) {
            const binding = this.groups[slot];
            if (binding) encoder.setBindGroup(slot, binding.group, binding.offsets);
        }
        for (let slot = 0; slot < this.vertices.length; slot++) {
            const vertex = this.vertices[slot];
            if (vertex) encoder.setVertexBuffer(slot, vertex.buffer, vertex.offset, vertex.size);
        }
        if (this.index) encoder.setIndexBuffer(this.index.buffer, this.index.format, this.index.offset, this.index.size);
        return (this.encoder = encoder);
    }

    setPipeline(pipeline: GPURenderPipeline): void {
        this.current().setPipeline(pipeline);
        this.pipeline = pipeline;
    }

    setBindGroup(slot: number, group: GPUBindGroup, offsets?: Uint32Array, start = 0, length = offsets ? offsets.length - start : 0): void {
        const encoder = this.current();
        const binding = (this.groups[slot] ??= { group, offsets: [] });
        binding.group = group;
        binding.offsets.length = length;
        if (offsets) {
            for (let i = 0; i < length; i++) binding.offsets[i] = offsets[start + i];
            encoder.setBindGroup(slot, group, offsets, start, length);
        } else encoder.setBindGroup(slot, group);
    }

    setVertexBuffer(slot: number, buffer: GPUBuffer, offset = 0, size?: number): void {
        this.current().setVertexBuffer(slot, buffer, offset, size);
        const vertex = (this.vertices[slot] ??= { buffer, offset, size });
        vertex.buffer = buffer;
        vertex.offset = offset;
        vertex.size = size;
    }

    setIndexBuffer(buffer: GPUBuffer, format: GPUIndexFormat, offset = 0, size?: number): void {
        this.current().setIndexBuffer(buffer, format, offset, size);
        this.index = { buffer, format, offset, size };
    }

    setViewport(x: number, y: number, w: number, h: number, min: number, max: number): void {
        if (this.drew) this.closeSegment();
        this.viewport = [x, y, w, h, min, max];
    }

    setScissorRect(x: number, y: number, w: number, h: number): void {
        if (this.drew) this.closeSegment();
        this.scissor = [x, y, w, h];
    }

    draw(count: number): void {
        this.current().draw(count);
        this.drew = true;
    }

    drawIndexed(count: number, instances: number, first: number): void {
        this.current().drawIndexed(count, instances, first);
        this.drew = true;
    }

    private closeSegment(): void {
        if (!this.encoder) return;
        this.segments.push({ viewport: this.viewport, scissor: this.scissor, bundles: [this.encoder.finish()] });
        this.encoder = undefined;
        this.drew = false;
    }

    finish(): void {
        this.closeSegment();
        this.groups.length = this.vertices.length = 0;
        this.pipeline = this.index = undefined;
    }

    execute(pass: GPURenderPassEncoder): void {
        let viewport: Viewport | undefined, scissor: Scissor | undefined;
        for (const segment of this.segments) {
            if (segment.viewport && viewport !== segment.viewport) pass.setViewport(...(viewport = segment.viewport));
            if (segment.scissor && scissor !== segment.scissor) pass.setScissorRect(...(scissor = segment.scissor));
            pass.executeBundles(segment.bundles);
        }
    }
}
