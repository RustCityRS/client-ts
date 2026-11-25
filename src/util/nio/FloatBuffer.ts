import { requireNonNull } from '#/util/JavaArray';
import Buffer, { checkFromIndexSize, copyElements, createCapacityException, createSameBufferException, indexOutOfBounds, unsupportedOperation } from './Buffer';
import BufferOverflowException from './BufferOverflowException';
import ByteOrder from './ByteOrder';
import ReadOnlyBufferException from './ReadOnlyBufferException';

// java.nio.FloatBuffer with the behaviour of HeapFloatBuffer/HeapFloatBufferR (allocate, wrap, asReadOnlyBuffer:
// float[] storage in native order) and of the ByteBuffer views ByteBufferAsFloatBuffer(R)B/L and
// DirectFloatBuffer(R)U/S (asFloatBuffer: the byte buffer's storage, in the byte buffer's order at creation).
// Values read by get() pass through a JS number, so a NaN payload is not preserved (JavaScriptCore canonicalizes
// every NaN); bulk puts move raw bits and keep it, as Java's memory copies do.
export default class FloatBuffer extends Buffer {
    // java.nio.FloatBuffer.hb:[F (null for a view)
    private readonly hb: Float32Array | null;

    // java.nio.FloatBuffer.offset:I
    private readonly offset: number;

    // java.nio.FloatBuffer.isReadOnly:Z
    private readonly readOnly: boolean;

    // java.nio.Buffer.address:J, as the byte index of element 0 in `data`
    private readonly address: number;

    // the storage bytes and their element order
    private readonly data: DataView;
    private readonly bigEndian: boolean;
    private readonly direct: boolean;

    // java.nio.HeapFloatBuffer(R).<init>([FIIIIILjava/lang/foreign/MemorySegment;)V (hb != null)
    // java.nio.ByteBufferAsFloatBuffer(R)B/L.<init>(Ljava/nio/ByteBuffer;IIIIJLjava/lang/foreign/MemorySegment;)V (hb == null)
    // Not for ported code: use allocate, wrap, asReadOnlyBuffer or ByteBuffer.asFloatBuffer.
    constructor(mark: number, pos: number, lim: number, cap: number, hb: Float32Array | null, offset: number, data: DataView, address: number, bigEndian: boolean, direct: boolean, readOnly: boolean) {
        super(mark, pos, lim, cap);
        this.hb = hb;
        this.offset = offset;
        this.data = data;
        this.address = address;
        this.bigEndian = bigEndian;
        this.direct = direct;
        this.readOnly = readOnly;
    }

    // java.nio.FloatBuffer.allocate(I)Ljava/nio/FloatBuffer;
    static allocate(capacity: number): FloatBuffer {
        if (capacity < 0) throw createCapacityException(capacity);
        const hb = new Float32Array(capacity);
        return new FloatBuffer(-1, 0, capacity, capacity, hb, 0, new DataView(hb.buffer, hb.byteOffset, hb.byteLength), 0, ByteOrder.nativeOrder() === ByteOrder.BIG_ENDIAN, false, false);
    }

    // java.nio.FloatBuffer.wrap([F)Ljava/nio/FloatBuffer;
    static wrap(array: Float32Array | null): FloatBuffer;
    // java.nio.FloatBuffer.wrap([FII)Ljava/nio/FloatBuffer;
    static wrap(array: Float32Array | null, offset: number, length: number): FloatBuffer;
    static wrap(array: Float32Array | null, offset?: number, length?: number): FloatBuffer {
        if (offset === undefined || length === undefined) {
            const whole = requireNonNull(array);
            return FloatBuffer.wrap(whole, 0, whole.length);
        }
        const buf = requireNonNull(array);
        // new HeapFloatBuffer(buf, off, len) is Buffer(-1, off, off + len, buf.length); wrap rethrows the
        // IllegalArgumentException of its limit/position checks as IndexOutOfBoundsException.
        const lim = (offset + length) | 0;
        if (lim > buf.length || lim < 0 || offset > lim || offset < 0) throw indexOutOfBounds();
        return new FloatBuffer(-1, offset, lim, buf.length, buf, 0, new DataView(buf.buffer, buf.byteOffset, buf.byteLength), 0, ByteOrder.nativeOrder() === ByteOrder.BIG_ENDIAN, false, false);
    }

    // java.nio.FloatBuffer.asReadOnlyBuffer()Ljava/nio/FloatBuffer;
    asReadOnlyBuffer(): FloatBuffer {
        return new FloatBuffer(this.markValue(), this.position(), this.limit(), this.capacity(), this.hb, this.offset, this.data, this.address, this.bigEndian, this.direct, true);
    }

    // java.nio.HeapFloatBuffer.ix(I)I, ByteBufferAsFloatBufferB.byteOffset(J)J
    private ix(i: number): number {
        return this.address + (i << 2);
    }

    // java.nio.FloatBuffer.get()F
    get(): number;
    // java.nio.FloatBuffer.get(I)F
    get(index: number): number;
    get(index?: number): number {
        if (index === undefined) return this.data.getFloat32(this.ix(this.nextGetIndex()), !this.bigEndian);
        return this.data.getFloat32(this.ix(this.checkIndex(index)), !this.bigEndian);
    }

    // java.nio.FloatBuffer.put(F)Ljava/nio/FloatBuffer;
    put(value: number): this;
    // java.nio.FloatBuffer.put(IF)Ljava/nio/FloatBuffer;
    put(index: number, value: number): this;
    // java.nio.FloatBuffer.put([F)Ljava/nio/FloatBuffer;
    put(src: Float32Array | null): this;
    // java.nio.FloatBuffer.put([FII)Ljava/nio/FloatBuffer;
    put(src: Float32Array | null, offset: number, length: number): this;
    // java.nio.FloatBuffer.put(Ljava/nio/FloatBuffer;)Ljava/nio/FloatBuffer;
    // A null argument dispatches as put([F) (NullPointerException); Java's put((FloatBuffer) null) on a read-only
    // heap buffer throws ReadOnlyBufferException first, which an untyped null cannot select.
    put(src: FloatBuffer): this;
    put(a: number | Float32Array | FloatBuffer | null, b?: number, c?: number): this {
        if (typeof a === 'number') {
            if (this.readOnly) throw new ReadOnlyBufferException();
            if (b === undefined) this.data.setFloat32(this.ix(this.nextPutIndex()), a, !this.bigEndian);
            else this.data.setFloat32(this.ix(this.checkIndex(a)), b, !this.bigEndian);
            return this;
        }
        if (a instanceof FloatBuffer) return this.putBuffer(a);
        if (b === undefined || c === undefined) {
            const src = requireNonNull(a);
            return this.putArray(src, 0, src.length);
        }
        return this.putArray(a, b, c);
    }

    // java.nio.FloatBuffer.put([FII)Ljava/nio/FloatBuffer;
    private putArray(src: Float32Array | null, offset: number, length: number): this {
        if (this.readOnly) throw new ReadOnlyBufferException();
        const array = requireNonNull(src);
        checkFromIndexSize(offset, length, array.length);
        const pos = this.position();
        if (length > this.limit() - pos) throw new BufferOverflowException();
        const elements = new Uint8Array(array.buffer, array.byteOffset + (offset << 2), length << 2).slice();
        copyElements(elements, ByteOrder.nativeOrder() === ByteOrder.LITTLE_ENDIAN, this.data, this.ix(pos), !this.bigEndian, 4);
        this.position(pos + length);
        return this;
    }

    // java.nio.FloatBuffer.put(Ljava/nio/FloatBuffer;)Ljava/nio/FloatBuffer;
    private putBuffer(src: FloatBuffer): this {
        // java.nio.HeapFloatBufferR.put(Ljava/nio/FloatBuffer;)Ljava/nio/FloatBuffer; throws before the same-buffer
        // check; the read-only views inherit FloatBuffer.put and check src == this first.
        if (this.readOnly && this.hb !== null) throw new ReadOnlyBufferException();
        if (src === this) throw createSameBufferException();
        if (this.readOnly) throw new ReadOnlyBufferException();
        const srcPos = src.position();
        const srcLim = src.limit();
        const srcRem = srcPos <= srcLim ? srcLim - srcPos : 0;
        const pos = this.position();
        const lim = this.limit();
        const rem = pos <= lim ? lim - pos : 0;
        if (srcRem > rem) throw new BufferOverflowException();
        // java.nio.FloatBuffer.putBuffer(ILjava/nio/FloatBuffer;II)V: copyMemory, or copySwapMemory when the orders differ
        const elements = new Uint8Array(src.data.buffer, src.data.byteOffset + src.ix(srcPos), srcRem << 2).slice();
        copyElements(elements, !src.bigEndian, this.data, this.ix(pos), !this.bigEndian, 4);
        this.position(pos + srcRem);
        src.position(srcPos + srcRem);
        return this;
    }

    // java.nio.FloatBuffer.order()Ljava/nio/ByteOrder;
    order(): ByteOrder {
        return this.bigEndian ? ByteOrder.BIG_ENDIAN : ByteOrder.LITTLE_ENDIAN;
    }

    // java.nio.FloatBuffer.isDirect()Z
    isDirect(): boolean {
        return this.direct;
    }

    // java.nio.FloatBuffer.isReadOnly()Z
    isReadOnly(): boolean {
        return this.readOnly;
    }

    // java.nio.FloatBuffer.hasArray()Z
    hasArray(): boolean {
        return this.hb !== null && !this.readOnly;
    }

    // java.nio.FloatBuffer.array()[F
    array(): Float32Array {
        if (this.hb === null) throw unsupportedOperation();
        if (this.readOnly) throw new ReadOnlyBufferException();
        return this.hb;
    }

    // java.nio.FloatBuffer.arrayOffset()I
    arrayOffset(): number {
        if (this.hb === null) throw unsupportedOperation();
        if (this.readOnly) throw new ReadOnlyBufferException();
        return this.offset;
    }

    // Not java.nio: a live view of the storage bytes of elements [0, capacity), the memory GL reads (BufferBytes).
    storageBytes(): Uint8Array {
        return new Uint8Array(this.data.buffer, this.data.byteOffset + this.address, this.capacity() << 2);
    }
}
