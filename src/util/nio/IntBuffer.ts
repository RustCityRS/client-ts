import { requireNonNull } from '#/util/JavaArray';
import Buffer, { checkFromIndexSize, copyElements, createCapacityException, createSameBufferException, indexOutOfBounds, unsupportedOperation } from './Buffer';
import BufferOverflowException from './BufferOverflowException';
import ByteOrder from './ByteOrder';

// java.nio.IntBuffer with the behaviour of HeapIntBuffer (allocate, wrap: int[] storage in native order) and of the
// ByteBuffer views ByteBufferAsIntBufferB/L and DirectIntBufferU/S (asIntBuffer: the byte buffer's storage, in the
// byte buffer's order at creation). Every element goes through the DataView, so both kinds share one code path.
export default class IntBuffer extends Buffer {
    // java.nio.IntBuffer.hb:[I (null for a view)
    private readonly hb: Int32Array | null;

    // java.nio.IntBuffer.offset:I
    private readonly offset: number;

    // java.nio.Buffer.address:J, as the byte index of element 0 in `data`
    private readonly address: number;

    // the storage bytes and their element order
    private readonly data: DataView;
    private readonly bigEndian: boolean;
    private readonly direct: boolean;

    // java.nio.HeapIntBuffer.<init>([IIIIIILjava/lang/foreign/MemorySegment;)V (hb != null)
    // java.nio.ByteBufferAsIntBufferB/L.<init>(Ljava/nio/ByteBuffer;IIIIJLjava/lang/foreign/MemorySegment;)V (hb == null)
    // Not for ported code: use allocate, wrap or ByteBuffer.asIntBuffer.
    constructor(mark: number, pos: number, lim: number, cap: number, hb: Int32Array | null, offset: number, data: DataView, address: number, bigEndian: boolean, direct: boolean) {
        super(mark, pos, lim, cap);
        this.hb = hb;
        this.offset = offset;
        this.data = data;
        this.address = address;
        this.bigEndian = bigEndian;
        this.direct = direct;
    }

    // java.nio.IntBuffer.allocate(I)Ljava/nio/IntBuffer;
    static allocate(capacity: number): IntBuffer {
        if (capacity < 0) throw createCapacityException(capacity);
        const hb = new Int32Array(capacity);
        return new IntBuffer(-1, 0, capacity, capacity, hb, 0, new DataView(hb.buffer, hb.byteOffset, hb.byteLength), 0, ByteOrder.nativeOrder() === ByteOrder.BIG_ENDIAN, false);
    }

    // java.nio.IntBuffer.wrap([I)Ljava/nio/IntBuffer;
    static wrap(array: Int32Array | null): IntBuffer;
    // java.nio.IntBuffer.wrap([III)Ljava/nio/IntBuffer;
    static wrap(array: Int32Array | null, offset: number, length: number): IntBuffer;
    static wrap(array: Int32Array | null, offset?: number, length?: number): IntBuffer {
        if (offset === undefined || length === undefined) {
            const whole = requireNonNull(array);
            return IntBuffer.wrap(whole, 0, whole.length);
        }
        const buf = requireNonNull(array);
        // new HeapIntBuffer(buf, off, len) is Buffer(-1, off, off + len, buf.length); wrap rethrows the
        // IllegalArgumentException of its limit/position checks as IndexOutOfBoundsException.
        const lim = (offset + length) | 0;
        if (lim > buf.length || lim < 0 || offset > lim || offset < 0) throw indexOutOfBounds();
        return new IntBuffer(-1, offset, lim, buf.length, buf, 0, new DataView(buf.buffer, buf.byteOffset, buf.byteLength), 0, ByteOrder.nativeOrder() === ByteOrder.BIG_ENDIAN, false);
    }

    // java.nio.HeapIntBuffer.ix(I)I, ByteBufferAsIntBufferB.byteOffset(J)J
    private ix(i: number): number {
        return this.address + (i << 2);
    }

    // java.nio.IntBuffer.get()I
    get(): number;
    // java.nio.IntBuffer.get(I)I
    get(index: number): number;
    get(index?: number): number {
        if (index === undefined) return this.data.getInt32(this.ix(this.nextGetIndex()), !this.bigEndian);
        return this.data.getInt32(this.ix(this.checkIndex(index)), !this.bigEndian);
    }

    // java.nio.IntBuffer.put(I)Ljava/nio/IntBuffer;
    put(value: number): this;
    // java.nio.IntBuffer.put(II)Ljava/nio/IntBuffer;
    put(index: number, value: number): this;
    // java.nio.IntBuffer.put([I)Ljava/nio/IntBuffer;
    put(src: Int32Array | null): this;
    // java.nio.IntBuffer.put([III)Ljava/nio/IntBuffer;
    put(src: Int32Array | null, offset: number, length: number): this;
    // java.nio.IntBuffer.put(Ljava/nio/IntBuffer;)Ljava/nio/IntBuffer;
    put(src: IntBuffer): this;
    put(a: number | Int32Array | IntBuffer | null, b?: number, c?: number): this {
        if (typeof a === 'number') {
            if (b === undefined) this.data.setInt32(this.ix(this.nextPutIndex()), a, !this.bigEndian);
            else this.data.setInt32(this.ix(this.checkIndex(a)), b, !this.bigEndian);
            return this;
        }
        if (a instanceof IntBuffer) return this.putBuffer(a);
        if (b === undefined || c === undefined) {
            const src = requireNonNull(a);
            return this.putArray(src, 0, src.length);
        }
        return this.putArray(a, b, c);
    }

    // java.nio.IntBuffer.put([III)Ljava/nio/IntBuffer;
    private putArray(src: Int32Array | null, offset: number, length: number): this {
        const array = requireNonNull(src);
        checkFromIndexSize(offset, length, array.length);
        const pos = this.position();
        if (length > this.limit() - pos) throw new BufferOverflowException();
        const elements = new Uint8Array(array.buffer, array.byteOffset + (offset << 2), length << 2).slice();
        copyElements(elements, ByteOrder.nativeOrder() === ByteOrder.LITTLE_ENDIAN, this.data, this.ix(pos), !this.bigEndian, 4);
        this.position(pos + length);
        return this;
    }

    // java.nio.IntBuffer.put(Ljava/nio/IntBuffer;)Ljava/nio/IntBuffer;
    private putBuffer(src: IntBuffer): this {
        if (src === this) throw createSameBufferException();
        const srcPos = src.position();
        const srcLim = src.limit();
        const srcRem = srcPos <= srcLim ? srcLim - srcPos : 0;
        const pos = this.position();
        const lim = this.limit();
        const rem = pos <= lim ? lim - pos : 0;
        if (srcRem > rem) throw new BufferOverflowException();
        // java.nio.IntBuffer.putBuffer(ILjava/nio/IntBuffer;II)V: copyMemory, or copySwapMemory when the orders differ
        const elements = new Uint8Array(src.data.buffer, src.data.byteOffset + src.ix(srcPos), srcRem << 2).slice();
        copyElements(elements, !src.bigEndian, this.data, this.ix(pos), !this.bigEndian, 4);
        this.position(pos + srcRem);
        src.position(srcPos + srcRem);
        return this;
    }

    // java.nio.IntBuffer.order()Ljava/nio/ByteOrder;
    order(): ByteOrder {
        return this.bigEndian ? ByteOrder.BIG_ENDIAN : ByteOrder.LITTLE_ENDIAN;
    }

    // java.nio.IntBuffer.isDirect()Z
    isDirect(): boolean {
        return this.direct;
    }

    // java.nio.IntBuffer.isReadOnly()Z
    isReadOnly(): boolean {
        return false;
    }

    // java.nio.IntBuffer.hasArray()Z
    hasArray(): boolean {
        return this.hb !== null;
    }

    // java.nio.IntBuffer.array()[I
    array(): Int32Array {
        if (this.hb === null) throw unsupportedOperation();
        return this.hb;
    }

    // java.nio.IntBuffer.arrayOffset()I
    arrayOffset(): number {
        if (this.hb === null) throw unsupportedOperation();
        return this.offset;
    }

    // Not java.nio: a live view of the storage bytes of elements [0, capacity), the memory GL reads (BufferBytes).
    storageBytes(): Uint8Array {
        return new Uint8Array(this.data.buffer, this.data.byteOffset + this.address, this.capacity() << 2);
    }
}
