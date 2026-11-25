import crc32 from 'pako/lib/zlib/crc32.js';
import { requireNonNull } from './JavaArray';

// java.util.zip.CRC32 uses zlib independently of the gamepack's a.f table.
export default class JavaCrc32 {
    private crc = 0;

    // java.util.zip.CRC32.reset()V
    reset(): void {
        this.crc = 0;
    }

    // java.util.zip.CRC32.update([BII)V
    update(data: Uint8Array | null, offset: number, length: number): void {
        const bytes = requireNonNull(data);
        if (offset < 0 || length < 0 || length > bytes.length - offset) throw new RangeError('ArrayIndexOutOfBoundsException');
        this.crc = crc32(this.crc, bytes, length, offset);
    }

    // java.util.zip.CRC32.getValue()J
    getValue(): bigint {
        return BigInt(this.crc >>> 0);
    }
}
