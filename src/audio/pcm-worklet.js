/* global AudioWorkletProcessor, registerProcessor */

// The browser calls process() on the audio rendering thread. Indices count
// interleaved PCM frames, including across the unsigned 32-bit wraparound.
class PcmWorklet extends AudioWorkletProcessor {
    constructor(options) {
        super();
        const { channels, capacity, shared } = options.processorOptions;
        this.channels = channels;
        this.capacity = capacity;
        this.indices = shared ? new Int32Array(shared, 0, 3) : null;
        this.samples = shared ? new Int16Array(shared, 12) : new Int16Array(capacity * channels);
        this.read = 0;
        this.write = 0;
        this.readSlot = 0;
        this.writeSlot = 0;
        this.closed = false;
        this.port.onmessage = ({ data }) => {
            if (data === null) {
                this.closed = true;
                this.port.close();
            } else if (!this.indices) {
                const start = this.writeSlot * this.channels;
                const first = Math.min(data.length, this.samples.length - start);
                this.samples.set(data.subarray(0, first), start);
                if (first < data.length) this.samples.set(data.subarray(first), 0);
                const frames = data.length / this.channels;
                this.write = (this.write + frames) >>> 0;
                this.writeSlot = (this.writeSlot + frames) % this.capacity;
            }
        };
    }

    process(_inputs, outputs) {
        const indices = this.indices;
        if (this.closed || (indices && Atomics.load(indices, 2))) return false;
        const out = outputs[0];
        if (!out.length) return true;
        const read = indices ? Atomics.load(indices, 0) >>> 0 : this.read;
        const write = indices ? Atomics.load(indices, 1) >>> 0 : this.write;
        const count = Math.min((write - read) >>> 0, out[0].length);
        let slot = this.readSlot;
        for (let i = 0; i < count; i++) {
            const from = slot * this.channels;
            for (let ch = 0; ch < this.channels; ch++) out[ch][i] = this.samples[from + ch] / 32768;
            if (++slot === this.capacity) slot = 0;
        }
        // The Web Audio render quantum is pre-zeroed; unread frames are silence.
        if (count) {
            this.readSlot = slot;
            this.read = (read + count) >>> 0;
            if (indices) Atomics.store(indices, 0, this.read);
            else this.port.postMessage(this.read);
        }
        return true;
    }
}
registerProcessor('majula-pcm', PcmWorklet);
