import { requireNonNull } from '#/util/JavaArray';
import { JavaCheckedException } from '#/util/JavaException';
export class FileIoError extends JavaCheckedException {}
export class EndOfFile extends FileIoError {}

// The host provides java.io.RandomAccessFile. Its cursor is distinct from
// ne.b after a write crosses the maximum file length.
export interface RandomAccessFile {
    seek(offset: bigint): void;
    read(data: Uint8Array, offset: number, length: number): number;
    write(data: Uint8Array, offset: number, length: number): void;
    length(): bigint;
    close(): void;
}

// ne. The gamepack receives initialized handles from its platform loader.
export default class File {
    private limit = 0n; // ne.a:J
    private position = 0n; // ne.b:J
    private path: string | null = null; // ne.c:Ljava/io/File;
    private file: RandomAccessFile | null = null; // ne.d:Ljava/io/RandomAccessFile;

    // ne.<init>()V
    constructor() {}

    static open(file: RandomAccessFile, path: string, limit: bigint): File {
        const handle = new File();
        handle.file = file;
        handle.path = path;
        handle.limit = limit;
        return handle;
    }

    // ne.a(I[BII)I
    read(length: number, data: Uint8Array, offset: number, advanceThreshold = -1): number {
        const count = requireNonNull(this.file).read(data, offset, length);
        if (~count < advanceThreshold) this.position = BigInt.asIntN(64, this.position + BigInt(count));
        return count;
    }

    // ne.a(I)V
    close(): void {
        if (this.file !== null) {
            this.file.close();
            this.file = null;
        }
    }

    // ne.a(I[BIB)V
    write(length: number, data: Uint8Array | null, offset: number): void {
        if (BigInt.asIntN(64, this.position + BigInt(length)) > this.limit) {
            requireNonNull(this.file).seek(BigInt.asIntN(64, this.limit + 1n));
            requireNonNull(this.file).write(Uint8Array.of(1), 0, 1);
            throw new EndOfFile();
        }
        requireNonNull(this.file).write(requireNonNull(data), offset, length);
        this.position = BigInt.asIntN(64, this.position + BigInt(length));
    }

    // ne.a(IJ)V
    seek(offset: bigint): void {
        requireNonNull(this.file).seek(offset);
        this.position = offset;
    }

    // ne.b(I)J
    length(): bigint {
        return requireNonNull(this.file).length();
    }

    // ne.a(B)Ljava/io/File;
    getFile(): string | null {
        return this.path;
    }

    // ne.finalize()V
    finalize(): void {
        if (this.file !== null) {
            console.log('Warning! fileondisk ' + this.path + ' not closed correctly using close(). Auto-closing instead. ');
            this.close();
        }
    }
}
