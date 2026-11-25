import { compileClientWasm } from '#/util/ClientWasm';

interface BzipExports {
    memory: WebAssembly.Memory;
    staging(): number;
    output_state(): number;
    write_output(table: number, output: number, space: number, previous: number, repeat: number, used: number, first: number, position: number, blockLength: number): number;
}

export default class BzipOutputWasm {
    private static kernel: BzipExports | null = null;

    static async loadBrowserModule(): Promise<void> {
        const module = await compileClientWasm(process.env.RS530_BZIP_WASM);
        if (module === null) return;
        try {
            this.installModule(module);
        } catch (error) {
            if (!(error instanceof RangeError || error instanceof WebAssembly.LinkError || error instanceof WebAssembly.RuntimeError)) throw error;
        }
    }

    static installModule(module: WebAssembly.Module): void {
        this.kernel = new WebAssembly.Instance(module).exports as unknown as BzipExports;
    }

    // libbzip2's non-randomised output stage uses the same table produced by rd.c / HD oc.c.
    // It works in private scratch until the complete bounded call succeeds, so a rejected
    // block can run the original Java loop and retain its first failure and partial writes.
    static write(table: Int32Array, dest: Uint8Array | null, next: number, space: number, previous: number, repeat: number, used: number, first: number, position: number, blockLength: number): Uint32Array | null {
        const kernel = this.kernel;
        if (
            kernel === null ||
            dest === null ||
            blockLength < 1 ||
            blockLength > 100000 ||
            table.length !== 100000 ||
            next < 0 ||
            space < 0 ||
            space > 524288 ||
            next + space > dest.length ||
            dest.buffer === table.buffer ||
            used < 0 ||
            used > blockLength + 1 ||
            repeat < 0 ||
            repeat > 259 ||
            first !== (first << 24) >> 24 ||
            previous !== (previous << 24) >> 24
        )
            return null;
        const base = kernel.staging(),
            output = base + 4 * blockLength;
        const memory = kernel.memory,
            required = output + space;
        if (required > memory.buffer.byteLength) {
            try {
                memory.grow(Math.ceil((required - memory.buffer.byteLength) / 65536));
            } catch (error) {
                if (error instanceof RangeError) return null;
                throw error;
            }
        }
        const buffer = memory.buffer;
        new Int32Array(buffer, base, blockLength).set(table.subarray(0, blockLength));
        if (kernel.write_output(base, output, space, previous, repeat, used, first, position, blockLength) === 0) return null;
        const result = new Uint32Array(buffer, kernel.output_state(), 6);
        dest.set(new Uint8Array(buffer, output, result[5]), next);
        return result;
    }
}
