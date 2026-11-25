import { requireNonNull } from '#/util/JavaArray';
import { type AudioDevice, type PcmFormat, type PcmLine, LineUnavailableError } from '#/sound/DevicePcmPlayer';
import workletSource from './pcm-worklet.js' with { type: 'text' };

// Host implementation of SourceDataLine. Each opened line owns a render node.
// Replacing the node on flush also retires its queued messages and acknowledgements.
class WebAudioLine implements PcmLine {
    private node: AudioWorkletNode | null = null;
    private indices: Int32Array | null = null;
    private samples: Int16Array | null = null;
    private read = 0;
    private writeFrame = 0;
    private writeSlot = 0;
    private silentEnd = 0;
    private started = false;
    private failed = false;
    private readonly capacity: number;
    private readonly frameBytes: number;

    constructor(
        private readonly output: PcmOutput,
        private readonly format: PcmFormat,
        private readonly capacityBytes: number
    ) {
        this.frameBytes = format.channels * 2;
        this.capacity = capacityBytes / this.frameBytes;
    }

    open(): void {
        this.silentEnd = performance.now();
    }

    start(): void {
        this.started = true;
        this.connect();
    }

    connect(): void {
        const ctx = this.output.runningContext;
        if (!this.started || !ctx || this.node) return;
        try {
            const shared = globalThis.crossOriginIsolated && typeof SharedArrayBuffer === 'function' ? new SharedArrayBuffer(12 + this.capacityBytes) : null;
            const node = new AudioWorkletNode(ctx, 'majula-pcm', {
                numberOfInputs: 0,
                numberOfOutputs: 1,
                outputChannelCount: [this.format.channels],
                processorOptions: { capacity: this.capacity, channels: this.format.channels, shared }
            });
            this.indices = shared ? new Int32Array(shared, 0, 3) : null;
            this.samples = shared ? new Int16Array(shared, 12) : null;
            this.read = this.writeFrame = this.writeSlot = 0;
            node.port.onmessage = event => {
                if (this.node === node) this.read = event.data >>> 0;
            };
            node.onprocessorerror = () => {
                if (this.node === node) this.failed = true;
            };
            this.node = node;
            node.connect(ctx.destination);
        } catch {
            this.retire();
            this.failed = true;
        }
    }

    private retire(): void {
        if (this.node) {
            if (this.indices) Atomics.store(this.indices, 2, 1);
            this.node.disconnect();
            this.node.port.onmessage = null;
            this.node.onprocessorerror = null;
            this.node.port.postMessage(null);
            this.node.port.close();
            this.node = null;
            this.indices = null;
            this.samples = null;
        }
        this.failed = false;
        this.silentEnd = performance.now();
    }

    available(): number {
        if (this.failed || this.output.moduleFailed) throw new LineUnavailableError();
        if (!this.node) {
            // Before autoplay unlock (or while suspended), the Java mixer keeps
            // running against a silent device clock, exactly as the old host did.
            const queued = Math.max(0, Math.ceil(((this.silentEnd - performance.now()) * this.format.rate) / 1000));
            return (this.capacity - Math.min(queued, this.capacity)) * this.frameBytes;
        }
        const read = this.indices ? Atomics.load(this.indices, 0) >>> 0 : this.read;
        return (this.capacity - ((this.writeFrame - read) >>> 0)) * this.frameBytes;
    }

    flush(): void {
        this.retire();
        this.connect();
    }

    close(): void {
        this.started = false;
        this.retire();
        this.output.remove(this);
    }

    write(input: Uint8Array | null, offset: number, length: number): void {
        const bytes = requireNonNull(input);
        const frames = length / this.frameBytes;
        if (!Number.isInteger(frames) || offset < 0 || length < 0 || offset + length > bytes.byteLength) throw new RangeError('Invalid PCM block');
        if (!this.node) {
            this.silentEnd = Math.max(performance.now(), this.silentEnd) + (frames * 1000) / this.format.rate;
            return;
        }
        // DevicePcmPlayer only submits complete 256-frame blocks with room in
        // the line. Never block the main thread waiting for the render thread.
        if (length > this.available()) throw new LineUnavailableError();
        const from = new DataView(bytes.buffer, bytes.byteOffset + offset, length);
        if (this.samples && this.indices) {
            let dest = this.writeSlot * this.format.channels;
            for (let i = 0; i < length; i += 2) {
                this.samples[dest] = from.getInt16(i, true);
                if (++dest === this.samples.length) dest = 0;
            }
            this.writeSlot = (this.writeSlot + frames) % this.capacity;
            this.writeFrame = (this.writeFrame + frames) >>> 0;
            Atomics.store(this.indices, 1, this.writeFrame);
        } else {
            const chunk = new Int16Array(length / 2);
            for (let i = 0; i < chunk.length; i++) chunk[i] = from.getInt16(i * 2, true);
            this.node.port.postMessage(chunk, [chunk.buffer]);
            this.writeFrame = (this.writeFrame + frames) >>> 0;
        }
    }
}

export default class PcmOutput implements AudioDevice {
    private context: AudioContext | null = null;
    private module: 'idle' | 'loading' | 'ready' | 'failed' = 'idle';
    private readonly lines = new Set<WebAudioLine>();

    get moduleFailed(): boolean {
        return this.module === 'failed';
    }
    get runningContext(): AudioContext | null {
        return this.module === 'ready' && this.context?.state === 'running' ? this.context : null;
    }

    getMixerNames(): string[] {
        return [];
    }

    getLine(format: PcmFormat | null, capacityBytes: number): PcmLine {
        const pcm = requireNonNull(format);
        if (
            typeof AudioContext === 'undefined' ||
            !Number.isInteger(capacityBytes) ||
            capacityBytes <= 0 ||
            pcm.rate !== 22050 ||
            (pcm.channels !== 1 && pcm.channels !== 2) ||
            pcm.bits !== 16 ||
            !pcm.signed ||
            pcm.bigEndian ||
            capacityBytes % (pcm.channels * 2) !== 0
        )
            throw new LineUnavailableError();
        if (this.moduleFailed) void this.loadModule(); // DevicePcmPlayer's timed reopen.
        const line = new WebAudioLine(this, pcm, capacityBytes);
        this.lines.add(line);
        return line;
    }

    remove(line: WebAudioLine): void {
        this.lines.delete(line);
    }

    private async loadModule(): Promise<void> {
        const ctx = this.context;
        if (!ctx || this.module === 'loading' || this.module === 'ready') return;
        this.module = 'loading';
        try {
            const url = URL.createObjectURL(new Blob([workletSource], { type: 'text/javascript' }));
            try {
                await ctx.audioWorklet.addModule(url);
            } finally {
                URL.revokeObjectURL(url);
            }
            if (this.context !== ctx) return;
            this.module = 'ready';
            for (const line of this.lines) line.connect();
        } catch {
            if (this.context === ctx) this.module = 'failed';
        }
    }

    unlock(): void {
        if (typeof AudioContext === 'undefined') return;
        if (this.context === null) {
            const ctx = new AudioContext({ sampleRate: 22050 });
            this.context = ctx;
            ctx.onstatechange = () => {
                if (this.context === ctx) for (const line of this.lines) line.flush();
            };
        }
        if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
        void this.loadModule();
    }

    close(): void {
        for (const line of this.lines) line.close();
        if (this.context !== null) {
            this.context.onstatechange = null;
            void this.context.close();
            this.context = null;
        }
        this.module = 'idle';
    }
}
