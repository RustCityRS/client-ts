import { requireNonNull } from '#/util/JavaArray';
import ByteArrayCopier from './ByteArrayCopier';

// The browser's ArrayBuffer stores the direct NIO bytes. Java tracks its limit
// and its next relative read/write position separately from capacity.
type DirectByteBuffer = { bytes: Uint8Array; position: number; limit: number };

export default class DirectByteArrayCopier extends ByteArrayCopier {
    // md.k:Ljava/nio/ByteBuffer;
    private buffer: DirectByteBuffer | null = null;

    // md.<init>()V
    constructor() {
        super();
    }

    // md.b(B)[B
    get(): Uint8Array {
        const buffer = requireNonNull(this.buffer);
        const bytes = new Uint8Array(buffer.bytes.length);
        bytes.set(this.readBytes(buffer));
        return bytes;
    }

    // JS5 only reads an unencrypted container while decompressing and checking its CRC.
    // The BZip2 decoder can retain its input after an error, so it still gets a private copy.
    readPackedContainer(): Uint8Array {
        const buffer = requireNonNull(this.buffer);
        return buffer.bytes[0] === 1 ? this.get() : this.readBytes(buffer);
    }

    private readBytes(buffer: DirectByteBuffer): Uint8Array {
        buffer.position = 0;
        if (buffer.bytes.length > buffer.limit) throw new RangeError('BufferUnderflowException');
        buffer.position = buffer.bytes.length;
        return buffer.bytes;
    }

    // md.a(B[B)V
    set(bytes: Uint8Array | null): void {
        const input = requireNonNull(bytes);
        this.buffer = { bytes: new Uint8Array(input.length), position: 0, limit: input.length };
        this.buffer.position = 0;
        this.buffer.bytes.set(input);
        this.buffer.position = (this.buffer.position + input.length) | 0;
    }
}
