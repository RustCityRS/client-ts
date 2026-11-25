import { inflate, inflateInit2, inflateReset } from 'pako/lib/zlib/inflate.js';
import ZStream from 'pako/lib/zlib/zstream.js';
import { compileClientWasm } from '#/util/ClientWasm';

interface ZlibExports extends WebAssembly.Exports {
    memory: WebAssembly.Memory;
    init(): number;
    staging(): number;
    inflate_raw(input: number, length: number, output: number, capacity: number): number;
    written(): number;
    reset(): void;
}

// java.util.zip.Inflater(true). zlib owns its window, and the caller supplies one
// input/output pair before each inflate and reset. Large groups get temporary staging.
export default class RawInflater {
    static module: WebAssembly.Module | null = null;
    private wasm: ZlibExports | null = null;
    private bytes: Uint8Array | null = null;
    private fallback: ZStream | null = null;

    static async loadBrowserModule(): Promise<void> {
        RawInflater.module ??= await compileClientWasm(process.env.RS530_GZIP_WASM);
    }

    private createWasm(): ZlibExports | null {
        if (RawInflater.module === null) return null;
        const exports = new WebAssembly.Instance(RawInflater.module).exports as ZlibExports;
        return exports.init() === 0 ? exports : null;
    }

    inflate(input: Uint8Array, offset: number, length: number, output: Uint8Array): number {
        // Preserve source/destination overlap when a caller supplies the same Java array.
        const src = input.byteOffset + offset,
            dst = output.byteOffset;
        const overlaps = input.buffer === output.buffer && src < dst + output.length && dst < src + length;
        const inputOffset = overlaps ? Math.max(0, src - dst) : 0;
        const outputOffset = overlaps ? Math.max(0, dst - src) : length;
        const size = Math.max(inputOffset + length, outputOffset + output.length);
        const keep = size <= 512 * 1024;
        const wasm = keep ? (this.wasm ??= this.createWasm()) : this.createWasm();
        if (wasm !== null) {
            const start = wasm.staging();
            const end = start + size;
            if (end > wasm.memory.buffer.byteLength) {
                try {
                    wasm.memory.grow(Math.ceil((end - wasm.memory.buffer.byteLength) / 65536));
                } catch (error) {
                    if (!(error instanceof RangeError)) throw error;
                    return this.inflateJs(input, offset, length, output);
                }
            }
            const bytes = keep && this.bytes?.buffer === wasm.memory.buffer ? this.bytes : new Uint8Array(wasm.memory.buffer);
            if (keep) this.bytes = bytes;
            bytes.set(input.subarray(offset, offset + length), start + inputOffset);
            const status = wasm.inflate_raw(start + inputOffset, length, start + outputOffset, output.length);
            const written = wasm.written();
            output.set(bytes.subarray(start + outputOffset, start + outputOffset + written));
            return status;
        }
        return this.inflateJs(input, offset, length, output);
    }

    private inflateJs(input: Uint8Array, offset: number, length: number, output: Uint8Array): number {
        if (this.fallback === null) {
            this.fallback = new ZStream();
            inflateInit2(this.fallback, -15);
        }
        const stream = this.fallback;
        stream.input = input;
        stream.next_in = offset;
        stream.avail_in = length;
        stream.output = output;
        stream.next_out = 0;
        stream.avail_out = output.length;
        return inflate(stream, 1);
    }

    reset(): void {
        this.wasm?.reset();
        if (this.fallback !== null) {
            inflateReset(this.fallback);
            this.fallback.input = this.fallback.output = null;
        }
    }
}
