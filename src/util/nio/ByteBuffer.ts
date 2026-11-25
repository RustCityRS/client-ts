import { requireNonNull } from '#/util/JavaArray';
import Buffer, { checkFromIndexSize, createCapacityException, createSameBufferException, indexOutOfBounds, unsupportedOperation } from './Buffer';
import BufferOverflowException from './BufferOverflowException';
import BufferUnderflowException from './BufferUnderflowException';
import ByteOrder from './ByteOrder';
import FloatBuffer from './FloatBuffer';
import IntBuffer from './IntBuffer';
import ShortBuffer from './ShortBuffer';

// A Java byte[]. The port stores byte[] as either typed array; only the bits matter to a ByteBuffer, and get()
// always returns the signed Java byte.
export type ByteArray = Int8Array | Uint8Array;

// java.nio.ByteBuffer with the behaviour of HeapByteBuffer (allocate, wrap) and DirectByteBuffer (allocateDirect).
// The heap array or the direct allocation is the storage; views from asShortBuffer/asIntBuffer/asFloatBuffer share it.
export default class ByteBuffer extends Buffer {
    // java.nio.ByteBuffer.hb:[B (null for a direct buffer)
    private readonly hb: ByteArray | null;

    // java.nio.ByteBuffer.offset:I
    private readonly offset: number;

    // java.nio.ByteBuffer.bigEndian:Z
    private bigEndian: boolean = true;

    // java.nio.ByteBuffer.nativeByteOrder:Z
    private nativeByteOrder: boolean = ByteOrder.nativeOrder() === ByteOrder.BIG_ENDIAN;

    // java.nio.Buffer.address:J, as the byte index of element 0 in `data`
    private readonly address: number;

    // the storage: the whole heap array, or the zeroed direct allocation
    private readonly bytes: Uint8Array;
    private readonly data: DataView;
    private readonly direct: boolean;

    // java.nio.HeapByteBuffer.<init>([BIIIIILjava/lang/foreign/MemorySegment;)V (hb != null)
    // java.nio.DirectByteBuffer.<init>(I)V (hb == null: the memory is reserved after Buffer's capacity check)
    private constructor(mark: number, pos: number, lim: number, cap: number, hb: ByteArray | null, offset: number) {
        super(mark, pos, lim, cap);
        this.hb = hb;
        this.offset = offset;
        this.direct = hb === null;
        this.bytes = hb === null ? new Uint8Array(cap) : new Uint8Array(hb.buffer, hb.byteOffset, hb.length);
        this.data = new DataView(this.bytes.buffer, this.bytes.byteOffset, this.bytes.byteLength);
        this.address = offset;
    }

    // java.nio.ByteBuffer.allocateDirect(I)Ljava/nio/ByteBuffer;
    static allocateDirect(capacity: number): ByteBuffer {
        return new ByteBuffer(-1, 0, capacity, capacity, null, 0);
    }

    // java.nio.ByteBuffer.allocate(I)Ljava/nio/ByteBuffer;
    static allocate(capacity: number): ByteBuffer {
        if (capacity < 0) throw createCapacityException(capacity);
        return new ByteBuffer(-1, 0, capacity, capacity, new Int8Array(capacity), 0);
    }

    // java.nio.ByteBuffer.wrap([B)Ljava/nio/ByteBuffer;
    static wrap(array: ByteArray | null): ByteBuffer;
    // java.nio.ByteBuffer.wrap([BII)Ljava/nio/ByteBuffer;
    static wrap(array: ByteArray | null, offset: number, length: number): ByteBuffer;
    static wrap(array: ByteArray | null, offset?: number, length?: number): ByteBuffer {
        if (offset === undefined || length === undefined) {
            const whole = requireNonNull(array);
            return ByteBuffer.wrap(whole, 0, whole.length);
        }
        const buf = requireNonNull(array);
        // new HeapByteBuffer(buf, off, len) is Buffer(-1, off, off + len, buf.length); wrap rethrows the
        // IllegalArgumentException of its limit/position checks as IndexOutOfBoundsException.
        const lim = (offset + length) | 0;
        if (lim > buf.length || lim < 0 || offset > lim || offset < 0) throw indexOutOfBounds();
        return new ByteBuffer(-1, offset, lim, buf.length, buf, 0);
    }

    // java.nio.HeapByteBuffer.ix(I)I
    private ix(i: number): number {
        return i + this.address;
    }

    // java.nio.ByteBuffer.get()B. A caller with a known descriptor can skip JS overload dispatch.
    getByte(): number {
        return this.data.getInt8(this.ix(this.nextGetIndex()));
    }

    get(): number;
    // java.nio.ByteBuffer.get(I)B
    get(index: number): number;
    // java.nio.ByteBuffer.get([B)Ljava/nio/ByteBuffer;
    get(dst: ByteArray | null): this;
    // java.nio.ByteBuffer.get([BII)Ljava/nio/ByteBuffer;
    get(dst: ByteArray | null, offset: number, length: number): this;
    get(a?: number | ByteArray | null, offset?: number, length?: number): number | this {
        if (a === undefined) return this.getByte();
        if (typeof a === 'number') return this.data.getInt8(this.ix(this.checkIndex(a)));
        if (offset === undefined || length === undefined) {
            const dst = requireNonNull(a);
            return this.getArray(dst, 0, dst.length);
        }
        return this.getArray(a, offset, length);
    }

    // java.nio.ByteBuffer.get([BII)Ljava/nio/ByteBuffer;
    private getArray(dst: ByteArray | null, offset: number, length: number): this {
        const array = requireNonNull(dst);
        checkFromIndexSize(offset, length, array.length);
        const pos = this.position();
        if (length > this.limit() - pos) throw new BufferUnderflowException();
        new Uint8Array(array.buffer, array.byteOffset, array.length).set(this.bytes.subarray(this.ix(pos), this.ix(pos) + length), offset);
        this.position(pos + length);
        return this;
    }

    // java.nio.ByteBuffer.put(B)Ljava/nio/ByteBuffer;. The relative single-byte overload.
    putByte(value: number): this {
        this.data.setInt8(this.ix(this.nextPutIndex()), value);
        return this;
    }

    put(b: number): this;
    // java.nio.ByteBuffer.put(IB)Ljava/nio/ByteBuffer;
    put(index: number, b: number): this;
    // java.nio.ByteBuffer.put([B)Ljava/nio/ByteBuffer;
    put(src: ByteArray | null): this;
    // java.nio.ByteBuffer.put([BII)Ljava/nio/ByteBuffer;
    put(src: ByteArray | null, offset: number, length: number): this;
    // java.nio.ByteBuffer.put(Ljava/nio/ByteBuffer;)Ljava/nio/ByteBuffer;
    put(src: ByteBuffer): this;
    put(a: number | ByteArray | ByteBuffer | null, b?: number, c?: number): this {
        if (typeof a === 'number') {
            if (b === undefined) return this.putByte(a);
            this.data.setInt8(this.ix(this.checkIndex(a)), b);
            return this;
        }
        if (a instanceof ByteBuffer) return this.putBuffer(a);
        if (b === undefined || c === undefined) {
            const src = requireNonNull(a);
            return this.putArray(src, 0, src.length);
        }
        return this.putArray(a, b, c);
    }

    // java.nio.ByteBuffer.put([BII)Ljava/nio/ByteBuffer;
    private putArray(src: ByteArray | null, offset: number, length: number): this {
        const array = requireNonNull(src);
        checkFromIndexSize(offset, length, array.length);
        const pos = this.position();
        if (length > this.limit() - pos) throw new BufferOverflowException();
        // TypedArray.set copies through a clone when both views share storage: System.arraycopy's memmove
        this.bytes.set(new Uint8Array(array.buffer, array.byteOffset + offset, length), this.ix(pos));
        this.position(pos + length);
        return this;
    }

    // java.nio.ByteBuffer.put(Ljava/nio/ByteBuffer;)Ljava/nio/ByteBuffer;
    private putBuffer(src: ByteBuffer): this {
        if (src === this) throw createSameBufferException();
        const srcPos = src.position();
        const srcLim = src.limit();
        const srcRem = srcPos <= srcLim ? srcLim - srcPos : 0;
        const pos = this.position();
        const lim = this.limit();
        const rem = pos <= lim ? lim - pos : 0;
        if (srcRem > rem) throw new BufferOverflowException();
        // putBuffer: Unsafe.copyMemory of the raw bytes, memmove semantics
        this.bytes.set(src.bytes.subarray(src.ix(srcPos), src.ix(srcPos) + srcRem), this.ix(pos));
        this.position(pos + srcRem);
        src.position(srcPos + srcRem);
        return this;
    }

    // java.nio.ByteBuffer.getShort()S
    getShort(): number;
    // java.nio.ByteBuffer.getShort(I)S
    getShort(index: number): number;
    getShort(index?: number): number {
        if (index === undefined) return this.data.getInt16(this.ix(this.nextGetIndex(2)), !this.bigEndian);
        return this.data.getInt16(this.ix(this.checkIndex(index, 2)), !this.bigEndian);
    }

    // java.nio.ByteBuffer.putShort(S)Ljava/nio/ByteBuffer;
    putShort(value: number): this;
    // java.nio.ByteBuffer.putShort(IS)Ljava/nio/ByteBuffer;
    putShort(index: number, value: number): this;
    putShort(a: number, b?: number): this {
        if (b === undefined) this.data.setInt16(this.ix(this.nextPutIndex(2)), a, !this.bigEndian);
        else this.data.setInt16(this.ix(this.checkIndex(a, 2)), b, !this.bigEndian);
        return this;
    }

    // java.nio.ByteBuffer.getInt()I
    getInt(): number;
    // java.nio.ByteBuffer.getInt(I)I
    getInt(index: number): number;
    getInt(index?: number): number {
        if (index === undefined) return this.data.getInt32(this.ix(this.nextGetIndex(4)), !this.bigEndian);
        return this.data.getInt32(this.ix(this.checkIndex(index, 4)), !this.bigEndian);
    }

    // java.nio.ByteBuffer.putInt(I)Ljava/nio/ByteBuffer;
    putInt(value: number): this;
    // java.nio.ByteBuffer.putInt(II)Ljava/nio/ByteBuffer;
    putInt(index: number, value: number): this;
    putInt(a: number, b?: number): this {
        if (b === undefined) this.data.setInt32(this.ix(this.nextPutIndex(4)), a, !this.bigEndian);
        else this.data.setInt32(this.ix(this.checkIndex(a, 4)), b, !this.bigEndian);
        return this;
    }

    // java.nio.ByteBuffer.getFloat()F
    getFloat(): number;
    // java.nio.ByteBuffer.getFloat(I)F
    getFloat(index: number): number;
    getFloat(index?: number): number {
        if (index === undefined) return this.data.getFloat32(this.ix(this.nextGetIndex(4)), !this.bigEndian);
        return this.data.getFloat32(this.ix(this.checkIndex(index, 4)), !this.bigEndian);
    }

    // java.nio.ByteBuffer.putFloat(F)Ljava/nio/ByteBuffer;
    putFloat(value: number): this;
    // java.nio.ByteBuffer.putFloat(IF)Ljava/nio/ByteBuffer;
    putFloat(index: number, value: number): this;
    putFloat(a: number, b?: number): this {
        if (b === undefined) this.data.setFloat32(this.ix(this.nextPutIndex(4)), a, !this.bigEndian);
        else this.data.setFloat32(this.ix(this.checkIndex(a, 4)), b, !this.bigEndian);
        return this;
    }

    // java.nio.ByteBuffer.asShortBuffer()Ljava/nio/ShortBuffer;
    asShortBuffer(): ShortBuffer {
        const pos = this.position();
        const size = (this.limit() - pos) >> 1;
        return new ShortBuffer(-1, 0, size, size, null, 0, this.data, this.address + pos, this.bigEndian, this.direct);
    }

    // java.nio.ByteBuffer.asIntBuffer()Ljava/nio/IntBuffer;
    asIntBuffer(): IntBuffer {
        const pos = this.position();
        const size = (this.limit() - pos) >> 2;
        return new IntBuffer(-1, 0, size, size, null, 0, this.data, this.address + pos, this.bigEndian, this.direct);
    }

    // java.nio.ByteBuffer.asFloatBuffer()Ljava/nio/FloatBuffer;
    asFloatBuffer(): FloatBuffer {
        const pos = this.position();
        const size = (this.limit() - pos) >> 2;
        return new FloatBuffer(-1, 0, size, size, null, 0, this.data, this.address + pos, this.bigEndian, this.direct, false);
    }

    // java.nio.ByteBuffer.order()Ljava/nio/ByteOrder;
    order(): ByteOrder;
    // java.nio.ByteBuffer.order(Ljava/nio/ByteOrder;)Ljava/nio/ByteBuffer; (null selects LITTLE_ENDIAN, as in Java)
    order(bo: ByteOrder | null): this;
    order(bo?: ByteOrder | null): ByteOrder | this {
        if (bo === undefined) return this.bigEndian ? ByteOrder.BIG_ENDIAN : ByteOrder.LITTLE_ENDIAN;
        this.bigEndian = bo === ByteOrder.BIG_ENDIAN;
        this.nativeByteOrder = this.bigEndian === (ByteOrder.nativeOrder() === ByteOrder.BIG_ENDIAN);
        return this;
    }

    // java.nio.ByteBuffer.isDirect()Z
    isDirect(): boolean {
        return this.direct;
    }

    // java.nio.ByteBuffer.isReadOnly()Z
    isReadOnly(): boolean {
        return false;
    }

    // java.nio.ByteBuffer.hasArray()Z
    hasArray(): boolean {
        return this.hb !== null;
    }

    // java.nio.ByteBuffer.array()[B
    array(): ByteArray {
        if (this.hb === null) throw unsupportedOperation();
        return this.hb;
    }

    // java.nio.ByteBuffer.arrayOffset()I
    arrayOffset(): number {
        if (this.hb === null) throw unsupportedOperation();
        return this.offset;
    }

    // Not java.nio: a live view of the storage bytes of elements [0, capacity), the memory GL reads (BufferBytes).
    storageBytes(): Uint8Array {
        if (this.address === 0 && this.capacity() === this.bytes.length) return this.bytes;
        return this.bytes.subarray(this.address, this.address + this.capacity());
    }
}
