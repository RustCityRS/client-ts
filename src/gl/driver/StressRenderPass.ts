import RecordedRenderBundles from './RecordedRenderBundles';
import { requireNonNull } from '#/util/JavaArray';

// Only the stress renderer retains a frame. Record WebGPU work after GL state
// deduplication, including the value of each mutable dynamic offset. Reusing the
// same command stream keeps game callbacks, picking and randomness on Java time.
const enum Op {
    Pipeline,
    Bind,
    DynamicBind,
    Vertex,
    Index,
    Viewport,
    Scissor,
    Draw,
    Indexed
}

type Resource = GPURenderPipeline | GPUBindGroup | GPUBuffer;

export default class StressRenderPass {
    private words: number[] = [];
    private resources: Resource[] = [];
    private referenceWords: number[] = [];
    private referenceResources: Resource[] = [];
    private keepReference = false;
    private missedReference = false;
    private bundles?: RecordedRenderBundles;
    private useBundles = false;
    private readonly offset = new Uint32Array(1);
    private word = 0;
    private resource = 0;
    indexed = false;

    constructor(
        public descriptor: GPURenderPassDescriptor,
        private original: GPURenderPassEncoder | null,
        private readonly device: GPUDevice,
        private readonly layout: GPURenderBundleEncoderDescriptor
    ) {}

    reset(descriptor: GPURenderPassDescriptor, original: GPURenderPassEncoder): void {
        if (this.keepReference) {
            // Exchange the two recordings without copying the scene or allocating per frame.
            const words = this.referenceWords;
            this.referenceWords = this.words;
            this.words = words;
            const resources = this.referenceResources;
            this.referenceResources = this.resources;
            this.resources = resources;
            this.keepReference = false;
        }
        this.descriptor = descriptor;
        this.original = original;
        this.word = this.resource = 0;
        this.indexed = false;
        this.useBundles = false;
    }

    setPipeline(pipeline: GPURenderPipeline): void {
        this.words[this.word++] = Op.Pipeline;
        this.resources[this.resource++] = pipeline;
    }

    setBindGroup(slot: number, group: GPUBindGroup, offsets?: Uint32Array, start = 0, _length = 1): void {
        this.words[this.word++] = offsets ? Op.DynamicBind : Op.Bind;
        this.words[this.word++] = slot;
        if (offsets) this.words[this.word++] = offsets[start];
        this.resources[this.resource++] = group;
    }

    setVertexBuffer(slot: number, buffer: GPUBuffer, offset: number, size?: number): void {
        this.words[this.word++] = Op.Vertex;
        this.words[this.word++] = slot;
        this.words[this.word++] = offset;
        this.words[this.word++] = size ?? -1;
        this.resources[this.resource++] = buffer;
    }

    setIndexBuffer(buffer: GPUBuffer, format: GPUIndexFormat, offset: number, size?: number): void {
        this.words[this.word++] = Op.Index;
        this.words[this.word++] = format === 'uint16' ? 16 : 32;
        this.words[this.word++] = offset;
        this.words[this.word++] = size ?? -1;
        this.resources[this.resource++] = buffer;
    }

    setViewport(x: number, y: number, w: number, h: number, min: number, max: number): void {
        this.words[this.word++] = Op.Viewport;
        this.words[this.word++] = x;
        this.words[this.word++] = y;
        this.words[this.word++] = w;
        this.words[this.word++] = h;
        this.words[this.word++] = min;
        this.words[this.word++] = max;
    }

    setScissorRect(x: number, y: number, w: number, h: number): void {
        this.words[this.word++] = Op.Scissor;
        this.words[this.word++] = x;
        this.words[this.word++] = y;
        this.words[this.word++] = w;
        this.words[this.word++] = h;
    }

    draw(count: number): void {
        this.words[this.word++] = Op.Draw;
        this.words[this.word++] = count;
    }

    drawIndexed(count: number, instances: number, first: number): void {
        this.indexed = true;
        this.words[this.word++] = Op.Indexed;
        this.words[this.word++] = count;
        this.words[this.word++] = instances;
        this.words[this.word++] = first;
    }

    end(): void {
        if (this.original === null) throw new Error('Render pass already ended');
        // Release any unused resource references if this frame was shorter than the last.
        this.resources.length = this.resource;
        this.words.length = this.word;
        if (this.indexed && this.word >= 256) {
            if (this.matchesReference()) {
                if (!this.bundles) {
                    const bundles = new RecordedRenderBundles(this.device, this.layout);
                    this.writeCommands(bundles);
                    bundles.finish();
                    this.bundles = bundles;
                }
                this.useBundles = true;
                this.missedReference = false;
            } else if (!this.bundles || this.missedReference) {
                this.keepReference = true;
                this.bundles = undefined;
                this.missedReference = false;
            } else {
                // A transient sprite or changed HUD can disappear again on the next frame.
                this.missedReference = true;
            }
        } else {
            this.bundles = undefined;
            this.referenceResources.length = this.referenceWords.length = 0;
            this.missedReference = false;
        }
        this.encode(this.original);
        this.original = null;
    }

    private matchesReference(): boolean {
        const words = this.referenceWords,
            resources = this.referenceResources;
        if (this.word !== words.length || this.resource !== resources.length) return false;
        for (let i = 0; i < resources.length; i++) if (this.resources[i] !== resources[i]) return false;
        for (let i = 0; i < words.length; i++) if (!Object.is(this.words[i], words[i])) return false;
        return true;
    }

    encode(pass: GPURenderPassEncoder): void {
        if (this.useBundles) requireNonNull(this.bundles).execute(pass);
        else this.writeCommands(pass);
        pass.end();
    }

    private writeCommands(pass: GPURenderPassEncoder | RecordedRenderBundles): void {
        const w = this.words,
            refs = this.resources;
        let r = 0;
        for (let i = 0; i < w.length;) {
            switch (w[i++]) {
                case Op.Pipeline:
                    pass.setPipeline(refs[r++] as GPURenderPipeline);
                    break;
                case Op.Bind:
                    pass.setBindGroup(w[i++], refs[r++] as GPUBindGroup);
                    break;
                case Op.DynamicBind: {
                    const slot = w[i++];
                    this.offset[0] = w[i++];
                    pass.setBindGroup(slot, refs[r++] as GPUBindGroup, this.offset, 0, 1);
                    break;
                }
                case Op.Vertex: {
                    const slot = w[i++],
                        offset = w[i++],
                        size = w[i++];
                    pass.setVertexBuffer(slot, refs[r++] as GPUBuffer, offset, size < 0 ? undefined : size);
                    break;
                }
                case Op.Index: {
                    const format = w[i++],
                        offset = w[i++],
                        size = w[i++];
                    pass.setIndexBuffer(refs[r++] as GPUBuffer, format === 16 ? 'uint16' : 'uint32', offset, size < 0 ? undefined : size);
                    break;
                }
                case Op.Viewport:
                    pass.setViewport(w[i++], w[i++], w[i++], w[i++], w[i++], w[i++]);
                    break;
                case Op.Scissor:
                    pass.setScissorRect(w[i++], w[i++], w[i++], w[i++]);
                    break;
                case Op.Draw:
                    pass.draw(w[i++]);
                    break;
                case Op.Indexed:
                    pass.drawIndexed(w[i++], w[i++], w[i++]);
                    break;
            }
        }
    }
}
