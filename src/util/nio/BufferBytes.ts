import Buffer, { indexOutOfBounds } from './Buffer';
import ByteBuffer from './ByteBuffer';
import FloatBuffer from './FloatBuffer';
import IntBuffer from './IntBuffer';
import ShortBuffer from './ShortBuffer';

// Not java.nio: buffer contents as GL receives them, for GLTrace hashing (HD_PLAN 3.2) and uploads.
//
// JOGL hands GL either the heap array (JNI copies it in native order) or the direct address plus position, so GL
// reads the storage bytes, where every element is laid out in the buffer's order(): the native (little-endian)
// order for heap buffers and native-order views, the byte buffer's order for a view made from one. A Java recorder
// gets the same bytes by encoding each element of [position, limit) in buf.order() (floats by floatToRawIntBits).

export type BufferKind = 'byte' | 'short' | 'int' | 'float';

export function bufferKind(buffer: Buffer): BufferKind {
    if (buffer instanceof ByteBuffer) return 'byte';
    if (buffer instanceof ShortBuffer) return 'short';
    if (buffer instanceof IntBuffer) return 'int';
    if (buffer instanceof FloatBuffer) return 'float';
    throw new TypeError('Unsupported buffer type');
}

export function bufferElementSize(buffer: Buffer): number {
    if (buffer instanceof ByteBuffer) return 1;
    if (buffer instanceof ShortBuffer) return 2;
    if (buffer instanceof IntBuffer || buffer instanceof FloatBuffer) return 4;
    throw new TypeError('Unsupported buffer type');
}

function storageBytes(buffer: Buffer): Uint8Array {
    if (buffer instanceof ByteBuffer || buffer instanceof ShortBuffer || buffer instanceof IntBuffer || buffer instanceof FloatBuffer) {
        return buffer.storageBytes();
    }
    throw new TypeError('Unsupported buffer type');
}

// Borrow the storage of elements [start, end) for a synchronous read. Writes through the buffer are visible.
export function bufferByteView(buffer: Buffer, start: number, end: number): Uint8Array {
    const capacity = buffer.capacity();
    if (start < 0 || end < start || end > capacity) throw indexOutOfBounds();
    const bytes = storageBytes(buffer);
    if (start === 0 && end === capacity) return bytes;
    const size = bufferElementSize(buffer);
    return bytes.subarray(start * size, end * size);
}

// A snapshot of the storage bytes of elements [start, end), ignoring position and limit.
export function bufferByteRange(buffer: Buffer, start: number, end: number): Uint8Array {
    return bufferByteView(buffer, start, end).slice();
}

// A copy of the bytes GL reads for [position, limit). Byte length = remaining() * element size.
export function bufferBytes(buffer: Buffer): Uint8Array {
    return bufferByteRange(buffer, buffer.position(), buffer.limit());
}
