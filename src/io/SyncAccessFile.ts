import { FileIoError, type RandomAccessFile } from './File';

// Positional operations supplied by a browser worker's FileSystemSyncAccessHandle.
export interface SyncAccessHandle {
    getSize(): number;
    read(data: Uint8Array<ArrayBufferLike>, options: { at: number }): number;
    write(data: Uint8Array<ArrayBufferLike>, options: { at: number }): number;
    close(): void;
}

export default class SyncAccessFile implements RandomAccessFile {
    private position = 0n;

    constructor(private readonly handle: SyncAccessHandle) {}

    seek(position: bigint): void {
        if (position < 0n) throw new FileIoError('Negative seek offset');
        this.position = position;
    }

    private at(): number {
        const position = Number(this.position);
        if (!Number.isSafeInteger(position)) throw new FileIoError('File offset exceeds host precision');
        return position;
    }

    read(data: Uint8Array, offset: number, length: number): number {
        if (offset < 0 || length < 0 || length > data.length - offset) throw new RangeError('Invalid file read range');
        if (length === 0) return 0;
        let count: number;
        try {
            count = this.handle.read(data.subarray(offset, offset + length), { at: this.at() });
        } catch (cause) {
            throw new FileIoError('File read failed', { cause });
        }
        if (count === 0) return -1;
        this.position += BigInt(count);
        return count;
    }

    write(data: Uint8Array, offset: number, length: number): void {
        if (offset < 0 || length < 0 || length > data.length - offset) throw new RangeError('Invalid file write range');
        while (length > 0) {
            let count: number;
            try {
                count = this.handle.write(data.subarray(offset, offset + length), { at: this.at() });
            } catch (cause) {
                throw new FileIoError('File write failed', { cause });
            }
            if (count <= 0) throw new FileIoError('Short file write');
            this.position += BigInt(count);
            offset += count;
            length -= count;
        }
    }

    length(): bigint {
        try {
            return BigInt(this.handle.getSize());
        } catch (cause) {
            throw new FileIoError('File length failed', { cause });
        }
    }

    close(): void {
        try {
            this.handle.close();
        } catch (cause) {
            throw new FileIoError('File close failed', { cause });
        }
    }
}
