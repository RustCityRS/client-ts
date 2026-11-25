import { requireNonNull } from '#/util/JavaArray';
import Buffer, { checkFromIndexSize, copyElements, createCapacityException, createSameBufferException, indexOutOfBounds, unsupportedOperation } from './Buffer';
import BufferOverflowException from './BufferOverflowException';
import ByteOrder from './ByteOrder';

// java.nio.ShortBuffer with the behaviour of HeapShortBuffer (allocate, wrap: short[] storage in native order) and of the
// ByteBuffer views ByteBufferAsShortBufferB/L and DirectShortBufferU/S (asShortBuffer: the byte buffer's storage, in the
// byte buffer's order at creation). Every element goes through the DataView, so both kinds share one code path.
export default class ShortBuffer extends Buffer {
    // java.nio.ShortBuffer.hb:[S (null for a view)
    private readonly hb: Int16Array | null;

    // java.nio.ShortBuffer.offset:I
    private readonly offset: number;

    // java.nio.Buffer.address:J, as the byte index of element 0 in `data`
    private readonly address: number;

    // the storage bytes and their element order
    private readonly data: DataView;
    private readonly bigEndian: boolean;
    private readonly direct: boolean;

    // java.nio.HeapShortBuffer.<init>([SIIIIILjava/lang/foreign/MemorySegment;)V (hb != null)
    // java.nio.ByteBufferAsShortBufferB/L.<init>(Ljava/nio/ByteBuffer;IIIIJLjava/lang/foreign/MemorySegment;)V (hb == null)
    // Not for ported code: use allocate, wrap or ByteBuffer.asShortBuffer.
    constructor(mark: number, pos: number, lim: number, cap: number, hb: Int16Array | null, offset: number, data: DataView, address: number, bigEndian: boolean, direct: boolean) {
        super(mark, pos, lim, cap);
        this.hb = hb;
        this.offset = offset;
        this.data = data;
        this.address = address;
        this.bigEndian = bigEndian;
        this.direct = direct;
    }

    // java.nio.ShortBuffer.allocate(I)Ljava/nio/ShortBuffer;
    static allocate(capacity: number): ShortBuffer {
        if (capacity < 0) throw createCapacityException(capacity);
        const hb = new Int16Array(capacity);
        return new ShortBuffer(-1, 0, capacity, capacity, hb, 0, new DataView(hb.buffer, hb.byteOffset, hb.byteLength), 0, ByteOrder.nativeOrder() === ByteOrder.BIG_ENDIAN, false);
    }

    // java.nio.ShortBuffer.wrap([S)Ljava/nio/ShortBuffer;
    static wrap(array: Int16Array | null): ShortBuffer;
    // java.nio.ShortBuffer.wrap([SII)Ljava/nio/ShortBuffer;
    static wrap(array: Int16Array | null, offset: number, length: number): ShortBuffer;
    static wrap(array: Int16Array | null, offset?: number, length?: number): ShortBuffer {
        if (offset === undefined || length === undefined) {
            const whole = requireNonNull(array);
            return ShortBuffer.wrap(whole, 0, whole.length);
        }
        const buf = requireNonNull(array);
        // new HeapShortBuffer(buf, off, len) is Buffer(-1, off, off + len, buf.length); wrap rethrows the
        // IllegalArgumentException of its limit/position checks as IndexOutOfBoundsException.
        const lim = (offset + length) | 0;
        if (lim > buf.length || lim < 0 || offset > lim || offset < 0) throw indexOutOfBounds();
        return new ShortBuffer(-1, offset, lim, buf.length, buf, 0, new DataView(buf.buffer, buf.byteOffset, buf.byteLength), 0, ByteOrder.nativeOrder() === ByteOrder.BIG_ENDIAN, false);
    }

    // java.nio.HeapShortBuffer.ix(I)I, ByteBufferAsShortBufferB.byteOffset(J)J
    private ix(i: number): number {
        return this.address + (i << 1);
    }

    // java.nio.ShortBuffer.get()S
    get(): number;
    // java.nio.ShortBuffer.get(I)S
    get(index: number): number;
    get(index?: number): number {
        if (index === undefined) return this.data.getInt16(this.ix(this.nextGetIndex()), !this.bigEndian);
        return this.data.getInt16(this.ix(this.checkIndex(index)), !this.bigEndian);
    }

    // java.nio.ShortBuffer.put(S)Ljava/nio/ShortBuffer;
    put(value: number): this;
    // java.nio.ShortBuffer.put(IS)Ljava/nio/ShortBuffer;
    put(index: number, value: number): this;
    // java.nio.ShortBuffer.put([S)Ljava/nio/ShortBuffer;
    put(src: Int16Array | null): this;
    // java.nio.ShortBuffer.put([SII)Ljava/nio/ShortBuffer;
    put(src: Int16Array | null, offset: number, length: number): this;
    // java.nio.ShortBuffer.put(Ljava/nio/ShortBuffer;)Ljava/nio/ShortBuffer;
    put(src: ShortBuffer): this;
    put(a: number | Int16Array | ShortBuffer | null, b?: number, c?: number): this {
        if (typeof a === 'number') {
            if (b === undefined) this.data.setInt16(this.ix(this.nextPutIndex()), a, !this.bigEndian);
            else this.data.setInt16(this.ix(this.checkIndex(a)), b, !this.bigEndian);
            return this;
        }
        if (a instanceof ShortBuffer) return this.putBuffer(a);
        if (b === undefined || c === undefined) {
            const src = requireNonNull(a);
            return this.putArray(src, 0, src.length);
        }
        return this.putArray(a, b, c);
    }

    // java.nio.ShortBuffer.put([SII)Ljava/nio/ShortBuffer;
    private putArray(src: Int16Array | null, offset: number, length: number): this {
        const array = requireNonNull(src);
        checkFromIndexSize(offset, length, array.length);
        const pos = this.position();
        if (length > this.limit() - pos) throw new BufferOverflowException();
        const elements = new Uint8Array(array.buffer, array.byteOffset + (offset << 1), length << 1).slice();
        copyElements(elements, ByteOrder.nativeOrder() === ByteOrder.LITTLE_ENDIAN, this.data, this.ix(pos), !this.bigEndian, 2);
        this.position(pos + length);
        return this;
    }

    // java.nio.ShortBuffer.put(Ljava/nio/ShortBuffer;)Ljava/nio/ShortBuffer;
    private putBuffer(src: ShortBuffer): this {
        if (src === this) throw createSameBufferException();
        const srcPos = src.position();
        const srcLim = src.limit();
        const srcRem = srcPos <= srcLim ? srcLim - srcPos : 0;
        const pos = this.position();
        const lim = this.limit();
        const rem = pos <= lim ? lim - pos : 0;
        if (srcRem > rem) throw new BufferOverflowException();
        // java.nio.ShortBuffer.putBuffer(ILjava/nio/ShortBuffer;II)V: copyMemory, or copySwapMemory when the orders differ
        const elements = new Uint8Array(src.data.buffer, src.data.byteOffset + src.ix(srcPos), srcRem << 1).slice();
        copyElements(elements, !src.bigEndian, this.data, this.ix(pos), !this.bigEndian, 2);
        this.position(pos + srcRem);
        src.position(srcPos + srcRem);
        return this;
    }

    // java.nio.ShortBuffer.order()Ljava/nio/ByteOrder;
    order(): ByteOrder {
        return this.bigEndian ? ByteOrder.BIG_ENDIAN : ByteOrder.LITTLE_ENDIAN;
    }

    // java.nio.ShortBuffer.isDirect()Z
    isDirect(): boolean {
        return this.direct;
    }

    // java.nio.ShortBuffer.isReadOnly()Z
    isReadOnly(): boolean {
        return false;
    }

    // java.nio.ShortBuffer.hasArray()Z
    hasArray(): boolean {
        return this.hb !== null;
    }

    // java.nio.ShortBuffer.array()[S
    array(): Int16Array {
        if (this.hb === null) throw unsupportedOperation();
        return this.hb;
    }

    // java.nio.ShortBuffer.arrayOffset()I
    arrayOffset(): number {
        if (this.hb === null) throw unsupportedOperation();
        return this.offset;
    }

    // Not java.nio: a live view of the storage bytes of elements [0, capacity), the memory GL reads (BufferBytes).
    storageBytes(): Uint8Array {
        return new Uint8Array(this.data.buffer, this.data.byteOffset + this.address, this.capacity() << 1);
    }
}
