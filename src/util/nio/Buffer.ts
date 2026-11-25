import BufferOverflowException from './BufferOverflowException';
import BufferUnderflowException from './BufferUnderflowException';
import InvalidMarkException from './InvalidMarkException';

// Java exception conventions used by the nio port (src/util): IndexOutOfBoundsException is an index error
// (RangeError), IllegalArgumentException and UnsupportedOperationException are plain host errors named by their
// message, a null dereference is TypeError('Null reference') from requireNonNull. All of them are RuntimeExceptions.

// new java.lang.IndexOutOfBoundsException()
export function indexOutOfBounds(): RangeError {
    return new RangeError('IndexOutOfBoundsException');
}

// new java.lang.UnsupportedOperationException()
export function unsupportedOperation(): Error {
    return new Error('UnsupportedOperationException');
}

// java.nio.Buffer.createCapacityException(I)Ljava/lang/IllegalArgumentException;
export function createCapacityException(capacity: number): Error {
    return new Error('IllegalArgumentException: capacity < 0: (' + capacity + ' < 0)');
}

// java.nio.Buffer.createSameBufferException()Ljava/lang/IllegalArgumentException;
export function createSameBufferException(): Error {
    return new Error('IllegalArgumentException: The source buffer is this buffer');
}

// java.util.Objects.checkFromIndexSize(III)I
export function checkFromIndexSize(fromIndex: number, size: number, length: number): number {
    if ((length | fromIndex | size) < 0 || size > length - fromIndex) throw indexOutOfBounds();
    return fromIndex;
}

// Element moves of a bulk put. Java copies raw memory (System.arraycopy, Unsafe.copyMemory, or copySwapMemory when
// the two orders differ) with memmove semantics, so `src` must already be a snapshot of the source elements.
// Moving bits instead of values keeps float NaN payloads, which a JS number cannot carry.
export function copyElements(src: Uint8Array, srcLittleEndian: boolean, dst: DataView, dstIndex: number, dstLittleEndian: boolean, size: number): void {
    if (srcLittleEndian === dstLittleEndian) {
        new Uint8Array(dst.buffer, dst.byteOffset + dstIndex, src.length).set(src);
        return;
    }
    const from = new DataView(src.buffer, src.byteOffset, src.byteLength);
    for (let i = 0; i < src.length; i += size) {
        if (size === 2) dst.setUint16(dstIndex + i, from.getUint16(i, srcLittleEndian), dstLittleEndian);
        else dst.setUint32(dstIndex + i, from.getUint32(i, srcLittleEndian), dstLittleEndian);
    }
}

// java.nio.Buffer
export default abstract class Buffer {
    // java.nio.Buffer.mark:I
    private markField: number = -1;

    // java.nio.Buffer.position:I
    private positionField: number = 0;

    // java.nio.Buffer.limit:I
    private limitField: number = 0;

    // java.nio.Buffer.capacity:I
    private readonly capacityField: number;

    // java.nio.Buffer.<init>(IIIILjava/lang/foreign/MemorySegment;)V (the segment is always null here)
    protected constructor(mark: number, pos: number, lim: number, cap: number) {
        if (cap < 0) throw createCapacityException(cap);
        this.capacityField = cap;
        this.limit(lim);
        this.position(pos);
        if (mark >= 0) {
            if (mark > pos) throw new Error('IllegalArgumentException: mark > position: (' + mark + ' > ' + pos + ')');
            this.markField = mark;
        }
    }

    // java.nio.Buffer.capacity()I
    capacity(): number {
        return this.capacityField;
    }

    // java.nio.Buffer.position()I
    position(): number;
    // java.nio.Buffer.position(I)Ljava/nio/Buffer;
    position(newPosition: number): this;
    position(newPosition?: number): number | this {
        if (newPosition === undefined) return this.positionField;
        if (newPosition > this.limitField || newPosition < 0) throw this.createPositionException(newPosition);
        if (this.markField > newPosition) this.markField = -1;
        this.positionField = newPosition;
        return this;
    }

    // java.nio.Buffer.createPositionException(I)Ljava/lang/IllegalArgumentException;
    private createPositionException(newPosition: number): Error {
        if (newPosition > this.limitField) return new Error('IllegalArgumentException: newPosition > limit: (' + newPosition + ' > ' + this.limitField + ')');
        return new Error('IllegalArgumentException: newPosition < 0: (' + newPosition + ' < 0)');
    }

    // java.nio.Buffer.limit()I
    limit(): number;
    // java.nio.Buffer.limit(I)Ljava/nio/Buffer;
    limit(newLimit: number): this;
    limit(newLimit?: number): number | this {
        if (newLimit === undefined) return this.limitField;
        if (newLimit > this.capacityField || newLimit < 0) throw this.createLimitException(newLimit);
        this.limitField = newLimit;
        if (this.positionField > newLimit) this.positionField = newLimit;
        if (this.markField > newLimit) this.markField = -1;
        return this;
    }

    // java.nio.Buffer.createLimitException(I)Ljava/lang/IllegalArgumentException;
    private createLimitException(newLimit: number): Error {
        if (newLimit > this.capacityField) return new Error('IllegalArgumentException: newLimit > capacity: (' + newLimit + ' > ' + this.capacityField + ')');
        return new Error('IllegalArgumentException: newLimit < 0: (' + newLimit + ' < 0)');
    }

    // java.nio.Buffer.mark()Ljava/nio/Buffer;
    mark(): this {
        this.markField = this.positionField;
        return this;
    }

    // java.nio.Buffer.reset()Ljava/nio/Buffer;
    reset(): this {
        const m = this.markField;
        if (m < 0) throw new InvalidMarkException();
        this.positionField = m;
        return this;
    }

    // java.nio.Buffer.clear()Ljava/nio/Buffer;
    clear(): this {
        this.positionField = 0;
        this.limitField = this.capacityField;
        this.markField = -1;
        return this;
    }

    // java.nio.Buffer.flip()Ljava/nio/Buffer;
    flip(): this {
        this.limitField = this.positionField;
        this.positionField = 0;
        this.markField = -1;
        return this;
    }

    // java.nio.Buffer.rewind()Ljava/nio/Buffer;
    rewind(): this {
        this.positionField = 0;
        this.markField = -1;
        return this;
    }

    // java.nio.Buffer.remaining()I
    remaining(): number {
        const rem = this.limitField - this.positionField;
        return rem > 0 ? rem : 0;
    }

    // java.nio.Buffer.hasRemaining()Z
    hasRemaining(): boolean {
        return this.positionField < this.limitField;
    }

    // java.nio.Buffer.isReadOnly()Z
    abstract isReadOnly(): boolean;

    // java.nio.Buffer.hasArray()Z
    abstract hasArray(): boolean;

    // java.nio.Buffer.array()Ljava/lang/Object;
    abstract array(): Int8Array | Uint8Array | Int16Array | Int32Array | Float32Array;

    // java.nio.Buffer.arrayOffset()I
    abstract arrayOffset(): number;

    // java.nio.Buffer.isDirect()Z
    abstract isDirect(): boolean;

    // java.nio.Buffer.nextGetIndex()I
    // java.nio.Buffer.nextGetIndex(I)I
    protected nextGetIndex(nb?: number): number {
        const p = this.positionField;
        if (nb === undefined) {
            if (p >= this.limitField) throw new BufferUnderflowException();
            this.positionField = p + 1;
            return p;
        }
        if (this.limitField - p < nb) throw new BufferUnderflowException();
        this.positionField = p + nb;
        return p;
    }

    // java.nio.Buffer.nextPutIndex()I
    // java.nio.Buffer.nextPutIndex(I)I
    protected nextPutIndex(nb?: number): number {
        const p = this.positionField;
        if (nb === undefined) {
            if (p >= this.limitField) throw new BufferOverflowException();
            this.positionField = p + 1;
            return p;
        }
        if (this.limitField - p < nb) throw new BufferOverflowException();
        this.positionField = p + nb;
        return p;
    }

    // java.nio.Buffer.checkIndex(I)I: Preconditions.checkIndex(i, limit)
    // java.nio.Buffer.checkIndex(II)I: Preconditions.checkIndex(i, limit - nb + 1)
    protected checkIndex(i: number, nb?: number): number {
        const length = nb === undefined ? this.limitField : this.limitField - nb + 1;
        if (i < 0 || i >= length) throw indexOutOfBounds();
        return i;
    }

    // java.nio.Buffer.markValue()I (package-private in Java; public here for the oracle and the trace recorder)
    markValue(): number {
        return this.markField;
    }

    // java.nio.Buffer.discardMark()V
    protected discardMark(): void {
        this.markField = -1;
    }
}
