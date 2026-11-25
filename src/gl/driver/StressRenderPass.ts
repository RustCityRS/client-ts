import DrawPass from './DrawPass';
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
    Indexed,
    Split
}

type Resource = GPURenderPipeline | GPUBindGroup | GPUBuffer;

interface BundleRange {
    word: number;
    resource: number;
    viewport: number;
    scissor: number;
}

export default class StressRenderPass {
    private words: number[] = [];
    private resources: Resource[] = [];
    private referenceWords: number[] = [];
    private referenceResources: Resource[] = [];
    private ranges: BundleRange[] = [{ word: 0, resource: 0, viewport: -1, scissor: -1 }];
    private referenceRanges: BundleRange[] = [];
    private range = 0;
    private rangeDraws = 0;
    private keepReference = false;
    private bundles?: RecordedRenderBundles;
    private useBundles = false;
    private drawPass?: DrawPass;
    private drewSinceClip = false;
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
            const ranges = this.referenceRanges;
            this.referenceRanges = this.ranges;
            this.ranges = ranges;
            this.keepReference = false;
        }
        this.range = this.rangeDraws = 0;
        const first = (this.ranges[0] ??= { word: 0, resource: 0, viewport: -1, scissor: -1 });
        first.viewport = first.scissor = -1;
        this.descriptor = descriptor;
        this.original = original;
        this.word = this.resource = 0;
        this.indexed = false;
        this.useBundles = false;
        this.drewSinceClip = false;
    }

    beginDrawPass(): DrawPass {
        return (this.drawPass = new DrawPass(this));
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
        this.splitAfterDraw();
        this.words[this.word++] = Op.Viewport;
        this.ranges[this.range].viewport = this.word;
        this.words[this.word++] = x;
        this.words[this.word++] = y;
        this.words[this.word++] = w;
        this.words[this.word++] = h;
        this.words[this.word++] = min;
        this.words[this.word++] = max;
    }

    setScissorRect(x: number, y: number, w: number, h: number): void {
        this.splitAfterDraw();
        this.words[this.word++] = Op.Scissor;
        this.ranges[this.range].scissor = this.word;
        this.words[this.word++] = x;
        this.words[this.word++] = y;
        this.words[this.word++] = w;
        this.words[this.word++] = h;
    }

    draw(count: number): void {
        this.drewSinceClip = true;
        this.words[this.word++] = Op.Draw;
        this.words[this.word++] = count;
    }

    drawIndexed(count: number, instances: number, first: number): void {
        this.indexed = true;
        this.drewSinceClip = true;
        this.words[this.word++] = Op.Indexed;
        this.words[this.word++] = count;
        this.words[this.word++] = instances;
        this.words[this.word++] = first;
        // A local animation can change a few draws in an otherwise identical scene.
        // Bound the commands it invalidates while keeping adjacent bundles in draw order.
        if (++this.rangeDraws === 256) this.splitAfterDraw();
    }

    private splitAfterDraw(): void {
        if (!this.drewSinceClip) return;
        this.drewSinceClip = false;
        this.rangeDraws = 0;
        this.words[this.word++] = Op.Split;
        const start = this.word;
        this.word += 2;
        const previous = this.ranges[this.range++];
        const range = (this.ranges[this.range] ??= { word: 0, resource: 0, viewport: -1, scissor: -1 });
        range.word = this.word;
        range.resource = this.resource;
        range.viewport = previous.viewport;
        range.scissor = previous.scissor;
        requireNonNull(this.drawPass).recordBundleBindings(this);
        // A normal render pass already has these bindings and can jump over the copy.
        this.words[start] = this.word;
        this.words[start + 1] = this.resource;
    }

    end(): void {
        if (this.original === null) throw new Error('Render pass already ended');
        this.drawPass = undefined;
        // Release any unused resource references if this frame was shorter than the last.
        this.resources.length = this.resource;
        this.words.length = this.word;
        this.ranges.length = this.range + 1;
        if (this.indexed && this.word >= 256) {
            // Even if animations or a camera turn change the commands every game tick,
            // the source and its intermediate presentations all share this tick's bundle.
            if (!this.bundles || !this.matchesReference()) {
                this.bundles = this.buildBundles();
                this.keepReference = true;
            }
            this.useBundles = true;
        } else {
            this.bundles = undefined;
            this.referenceResources.length = this.referenceWords.length = 0;
            this.referenceRanges.length = 0;
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

    private buildBundles(): RecordedRenderBundles {
        const result = new RecordedRenderBundles();
        for (let i = 0; i < this.ranges.length; i++) {
            const range = this.ranges[i],
                next = this.ranges[i + 1];
            // Exclude the split instruction and its two direct-pass jump offsets.
            const end = next ? next.word - 3 : this.word;
            let bundle = this.bundles?.bundles[i];
            if (!bundle || !this.matchesRange(i, end, next?.resource ?? this.resource)) {
                const encoder = this.device.createRenderBundleEncoder(this.layout);
                this.writeCommands(encoder, range.word, end, range.resource, true);
                bundle = encoder.finish();
            }
            result.add(bundle, this.words, range.viewport, range.scissor);
        }
        return result;
    }

    private matchesRange(i: number, end: number, resourceEnd: number): boolean {
        const range = this.ranges[i],
            old = this.referenceRanges[i],
            after = this.referenceRanges[i + 1];
        if (!old || end - range.word !== (after ? after.word - 3 : this.referenceWords.length) - old.word || resourceEnd - range.resource !== (after?.resource ?? this.referenceResources.length) - old.resource) return false;
        for (let r = range.resource, other = old.resource; r < resourceEnd; r++, other++) if (this.resources[r] !== this.referenceResources[other]) return false;
        for (let w = range.word, other = old.word; w < end; w++, other++) if (!Object.is(this.words[w], this.referenceWords[other])) return false;
        return true;
    }

    encode(pass: GPURenderPassEncoder): void {
        if (this.useBundles) requireNonNull(this.bundles).execute(pass);
        else this.writeCommands(pass);
        pass.end();
    }

    private writeCommands(pass: GPURenderPassEncoder | GPURenderBundleEncoder, i = 0, end = this.word, r = 0, bundle = false): void {
        const w = this.words,
            refs = this.resources;
        while (i < end) {
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
                case Op.Split:
                    r = w[i + 1];
                    i = w[i];
                    break;
                case Op.Viewport:
                    if (!bundle) (pass as GPURenderPassEncoder).setViewport(w[i], w[i + 1], w[i + 2], w[i + 3], w[i + 4], w[i + 5]);
                    i += 6;
                    break;
                case Op.Scissor:
                    if (!bundle) (pass as GPURenderPassEncoder).setScissorRect(w[i], w[i + 1], w[i + 2], w[i + 3]);
                    i += 4;
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
