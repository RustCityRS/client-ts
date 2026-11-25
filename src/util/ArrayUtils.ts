import { arrayAtB64, arrayAtI16, arrayAtI32, arrayAtObj, arrayAtU8, arrayPutB64, arrayPutI16, arrayPutI32, arrayPutObj, arrayPutU8, floatWords, requireNonNull } from './JavaArray';
import { isJavaRuntimeException } from './JavaException';
import WrappedException from './WrappedException';

export default class ArrayUtils {
    // gi.a([BI)[B
    static copy(bytes: Uint8Array | null, sourceOffset: number): Uint8Array {
        const length = requireNonNull(bytes).length;
        const result = new Uint8Array(length);
        ArrayUtils.copyBytes(bytes, sourceOffset, result, 0, length);
        return result;
    }

    // cc.a([Ljava/lang/Object;I[Ljava/lang/Object;II)V
    static copyObjects<T>(source: T[] | null, sourcePos: number, dest: T[] | null, destPos: number, length: number): void {
        if (source === dest) {
            if (sourcePos === destPos) {
                return;
            }

            if (destPos > sourcePos && destPos < ((sourcePos + length) | 0)) {
                length = (length - 1) | 0;
                sourcePos = (sourcePos + length) | 0;
                destPos = (destPos + length) | 0;
                length = (sourcePos - length) | 0;

                for (length = (length + 7) | 0; sourcePos >= length; arrayPutObj(dest, destPos--, arrayAtObj(source, sourcePos--))) {
                    arrayPutObj(dest, destPos--, arrayAtObj(source, sourcePos--));
                    arrayPutObj(dest, destPos--, arrayAtObj(source, sourcePos--));
                    arrayPutObj(dest, destPos--, arrayAtObj(source, sourcePos--));
                    arrayPutObj(dest, destPos--, arrayAtObj(source, sourcePos--));
                    arrayPutObj(dest, destPos--, arrayAtObj(source, sourcePos--));
                    arrayPutObj(dest, destPos--, arrayAtObj(source, sourcePos--));
                    arrayPutObj(dest, destPos--, arrayAtObj(source, sourcePos--));
                }

                length = (length - 7) | 0;

                while (sourcePos >= length) {
                    arrayPutObj(dest, destPos--, arrayAtObj(source, sourcePos--));
                }

                return;
            }
        }

        length = (length + sourcePos) | 0;

        for (length = (length - 7) | 0; sourcePos < length; arrayPutObj(dest, destPos++, arrayAtObj(source, sourcePos++))) {
            arrayPutObj(dest, destPos++, arrayAtObj(source, sourcePos++));
            arrayPutObj(dest, destPos++, arrayAtObj(source, sourcePos++));
            arrayPutObj(dest, destPos++, arrayAtObj(source, sourcePos++));
            arrayPutObj(dest, destPos++, arrayAtObj(source, sourcePos++));
            arrayPutObj(dest, destPos++, arrayAtObj(source, sourcePos++));
            arrayPutObj(dest, destPos++, arrayAtObj(source, sourcePos++));
            arrayPutObj(dest, destPos++, arrayAtObj(source, sourcePos++));
        }

        length = (length + 7) | 0;

        while (sourcePos < length) {
            arrayPutObj(dest, destPos++, arrayAtObj(source, sourcePos++));
        }
    }

    // cc.a([III)V
    static clearInts(dest: Int32Array | null, offset: number, length: number): void {
        length = (offset + length - 7) | 0;

        while (offset < length) {
            arrayPutI32(dest, offset++, 0);
            arrayPutI32(dest, offset++, 0);
            arrayPutI32(dest, offset++, 0);
            arrayPutI32(dest, offset++, 0);
            arrayPutI32(dest, offset++, 0);
            arrayPutI32(dest, offset++, 0);
            arrayPutI32(dest, offset++, 0);
            arrayPutI32(dest, offset++, 0);
        }

        length = (length + 7) | 0;

        while (offset < length) {
            arrayPutI32(dest, offset++, 0);
        }
    }

    // cc.a([II[III)V
    static copyInts(source: Int32Array | null, sourcePos: number, dest: Int32Array | null, destPos: number, length: number): void {
        if (source === dest) {
            if (sourcePos === destPos) {
                return;
            }

            if (destPos > sourcePos && destPos < ((sourcePos + length) | 0)) {
                length = (length - 1) | 0;
                sourcePos = (sourcePos + length) | 0;
                destPos = (destPos + length) | 0;
                length = (sourcePos - length) | 0;

                for (length = (length + 7) | 0; sourcePos >= length; arrayPutI32(dest, destPos--, arrayAtI32(source, sourcePos--))) {
                    arrayPutI32(dest, destPos--, arrayAtI32(source, sourcePos--));
                    arrayPutI32(dest, destPos--, arrayAtI32(source, sourcePos--));
                    arrayPutI32(dest, destPos--, arrayAtI32(source, sourcePos--));
                    arrayPutI32(dest, destPos--, arrayAtI32(source, sourcePos--));
                    arrayPutI32(dest, destPos--, arrayAtI32(source, sourcePos--));
                    arrayPutI32(dest, destPos--, arrayAtI32(source, sourcePos--));
                    arrayPutI32(dest, destPos--, arrayAtI32(source, sourcePos--));
                }

                length = (length - 7) | 0;

                while (sourcePos >= length) {
                    arrayPutI32(dest, destPos--, arrayAtI32(source, sourcePos--));
                }

                return;
            }
        }

        length = (length + sourcePos) | 0;

        for (length = (length - 7) | 0; sourcePos < length; arrayPutI32(dest, destPos++, arrayAtI32(source, sourcePos++))) {
            arrayPutI32(dest, destPos++, arrayAtI32(source, sourcePos++));
            arrayPutI32(dest, destPos++, arrayAtI32(source, sourcePos++));
            arrayPutI32(dest, destPos++, arrayAtI32(source, sourcePos++));
            arrayPutI32(dest, destPos++, arrayAtI32(source, sourcePos++));
            arrayPutI32(dest, destPos++, arrayAtI32(source, sourcePos++));
            arrayPutI32(dest, destPos++, arrayAtI32(source, sourcePos++));
            arrayPutI32(dest, destPos++, arrayAtI32(source, sourcePos++));
        }

        length = (length + 7) | 0;

        while (sourcePos < length) {
            arrayPutI32(dest, destPos++, arrayAtI32(source, sourcePos++));
        }
    }

    // cc.a([JI[JII)V
    static copyLongs(source: BigInt64Array | null, sourcePos: number, dest: BigInt64Array | null, destPos: number, length: number): void {
        if (source === dest) {
            if (sourcePos === destPos) {
                return;
            }

            if (destPos > sourcePos && destPos < ((sourcePos + length) | 0)) {
                length = (length - 1) | 0;
                sourcePos = (sourcePos + length) | 0;
                destPos = (destPos + length) | 0;
                length = (sourcePos - length) | 0;

                for (length = (length + 3) | 0; sourcePos >= length; arrayPutB64(dest, destPos--, arrayAtB64(source, sourcePos--))) {
                    arrayPutB64(dest, destPos--, arrayAtB64(source, sourcePos--));
                    arrayPutB64(dest, destPos--, arrayAtB64(source, sourcePos--));
                    arrayPutB64(dest, destPos--, arrayAtB64(source, sourcePos--));
                }

                length = (length - 3) | 0;

                while (sourcePos >= length) {
                    arrayPutB64(dest, destPos--, arrayAtB64(source, sourcePos--));
                }

                return;
            }
        }

        length = (length + sourcePos) | 0;

        for (length = (length - 3) | 0; sourcePos < length; arrayPutB64(dest, destPos++, arrayAtB64(source, sourcePos++))) {
            arrayPutB64(dest, destPos++, arrayAtB64(source, sourcePos++));
            arrayPutB64(dest, destPos++, arrayAtB64(source, sourcePos++));
            arrayPutB64(dest, destPos++, arrayAtB64(source, sourcePos++));
        }

        length = (length + 3) | 0;

        while (sourcePos < length) {
            arrayPutB64(dest, destPos++, arrayAtB64(source, sourcePos++));
        }
    }

    // cc.a([SI[SII)V
    static copyShorts(source: Int16Array | null, sourcePos: number, dest: Int16Array | null, destPos: number, length: number): void {
        if (source === dest) {
            if (sourcePos === destPos) {
                return;
            }

            if (destPos > sourcePos && destPos < ((sourcePos + length) | 0)) {
                length = (length - 1) | 0;
                sourcePos = (sourcePos + length) | 0;
                destPos = (destPos + length) | 0;
                length = (sourcePos - length) | 0;

                for (length = (length + 7) | 0; sourcePos >= length; arrayPutI16(dest, destPos--, arrayAtI16(source, sourcePos--))) {
                    arrayPutI16(dest, destPos--, arrayAtI16(source, sourcePos--));
                    arrayPutI16(dest, destPos--, arrayAtI16(source, sourcePos--));
                    arrayPutI16(dest, destPos--, arrayAtI16(source, sourcePos--));
                    arrayPutI16(dest, destPos--, arrayAtI16(source, sourcePos--));
                    arrayPutI16(dest, destPos--, arrayAtI16(source, sourcePos--));
                    arrayPutI16(dest, destPos--, arrayAtI16(source, sourcePos--));
                    arrayPutI16(dest, destPos--, arrayAtI16(source, sourcePos--));
                }

                length = (length - 7) | 0;

                while (sourcePos >= length) {
                    arrayPutI16(dest, destPos--, arrayAtI16(source, sourcePos--));
                }

                return;
            }
        }

        length = (length + sourcePos) | 0;

        for (length = (length - 7) | 0; sourcePos < length; arrayPutI16(dest, destPos++, arrayAtI16(source, sourcePos++))) {
            arrayPutI16(dest, destPos++, arrayAtI16(source, sourcePos++));
            arrayPutI16(dest, destPos++, arrayAtI16(source, sourcePos++));
            arrayPutI16(dest, destPos++, arrayAtI16(source, sourcePos++));
            arrayPutI16(dest, destPos++, arrayAtI16(source, sourcePos++));
            arrayPutI16(dest, destPos++, arrayAtI16(source, sourcePos++));
            arrayPutI16(dest, destPos++, arrayAtI16(source, sourcePos++));
            arrayPutI16(dest, destPos++, arrayAtI16(source, sourcePos++));
        }

        length = (length + 7) | 0;

        while (sourcePos < length) {
            arrayPutI16(dest, destPos++, arrayAtI16(source, sourcePos++));
        }
    }

    // HD kg.a([FI[FII)V
    static copyFloats(source: Float32Array | null, sourcePos: number, dest: Float32Array | null, destPos: number, length: number): void {
        const sourceBits = floatWords(source),
            destBits = floatWords(dest);
        if (source === dest) {
            if (sourcePos === destPos) {
                return;
            }

            if (destPos > sourcePos && destPos < ((sourcePos + length) | 0)) {
                length = (length - 1) | 0;
                sourcePos = (sourcePos + length) | 0;
                destPos = (destPos + length) | 0;
                length = (sourcePos - length) | 0;

                for (length = (length + 7) | 0; sourcePos >= length; arrayPutI32(destBits, destPos--, arrayAtI32(sourceBits, sourcePos--))) {
                    arrayPutI32(destBits, destPos--, arrayAtI32(sourceBits, sourcePos--));
                    arrayPutI32(destBits, destPos--, arrayAtI32(sourceBits, sourcePos--));
                    arrayPutI32(destBits, destPos--, arrayAtI32(sourceBits, sourcePos--));
                    arrayPutI32(destBits, destPos--, arrayAtI32(sourceBits, sourcePos--));
                    arrayPutI32(destBits, destPos--, arrayAtI32(sourceBits, sourcePos--));
                    arrayPutI32(destBits, destPos--, arrayAtI32(sourceBits, sourcePos--));
                    arrayPutI32(destBits, destPos--, arrayAtI32(sourceBits, sourcePos--));
                }

                length = (length - 7) | 0;

                while (sourcePos >= length) {
                    arrayPutI32(destBits, destPos--, arrayAtI32(sourceBits, sourcePos--));
                }

                return;
            }
        }

        length = (length + sourcePos) | 0;

        for (length = (length - 7) | 0; sourcePos < length; arrayPutI32(destBits, destPos++, arrayAtI32(sourceBits, sourcePos++))) {
            arrayPutI32(destBits, destPos++, arrayAtI32(sourceBits, sourcePos++));
            arrayPutI32(destBits, destPos++, arrayAtI32(sourceBits, sourcePos++));
            arrayPutI32(destBits, destPos++, arrayAtI32(sourceBits, sourcePos++));
            arrayPutI32(destBits, destPos++, arrayAtI32(sourceBits, sourcePos++));
            arrayPutI32(destBits, destPos++, arrayAtI32(sourceBits, sourcePos++));
            arrayPutI32(destBits, destPos++, arrayAtI32(sourceBits, sourcePos++));
            arrayPutI32(destBits, destPos++, arrayAtI32(sourceBits, sourcePos++));
        }

        length = (length + 7) | 0;

        while (sourcePos < length) {
            arrayPutI32(destBits, destPos++, arrayAtI32(sourceBits, sourcePos++));
        }
    }

    // cc.a([IIII)V
    static fillInts(dest: Int32Array | null, offset: number, length: number, value: number): void {
        length = (offset + length - 7) | 0;

        while (offset < length) {
            arrayPutI32(dest, offset++, value);
            arrayPutI32(dest, offset++, value);
            arrayPutI32(dest, offset++, value);
            arrayPutI32(dest, offset++, value);
            arrayPutI32(dest, offset++, value);
            arrayPutI32(dest, offset++, value);
            arrayPutI32(dest, offset++, value);
            arrayPutI32(dest, offset++, value);
        }

        length = (length + 7) | 0;

        while (offset < length) {
            arrayPutI32(dest, offset++, value);
        }
    }

    // cc.a([BI[BII)V
    static copyBytes(source: Uint8Array | null, sourcePos: number, dest: Uint8Array | null, destPos: number, length: number): void {
        if (source === dest) {
            if (sourcePos === destPos) {
                return;
            }

            if (destPos > sourcePos && destPos < ((sourcePos + length) | 0)) {
                length = (length - 1) | 0;
                sourcePos = (sourcePos + length) | 0;
                destPos = (destPos + length) | 0;
                length = (sourcePos - length) | 0;

                for (length = (length + 7) | 0; sourcePos >= length; arrayPutU8(dest, destPos--, arrayAtU8(source, sourcePos--))) {
                    arrayPutU8(dest, destPos--, arrayAtU8(source, sourcePos--));
                    arrayPutU8(dest, destPos--, arrayAtU8(source, sourcePos--));
                    arrayPutU8(dest, destPos--, arrayAtU8(source, sourcePos--));
                    arrayPutU8(dest, destPos--, arrayAtU8(source, sourcePos--));
                    arrayPutU8(dest, destPos--, arrayAtU8(source, sourcePos--));
                    arrayPutU8(dest, destPos--, arrayAtU8(source, sourcePos--));
                    arrayPutU8(dest, destPos--, arrayAtU8(source, sourcePos--));
                }

                length = (length - 7) | 0;

                while (sourcePos >= length) {
                    arrayPutU8(dest, destPos--, arrayAtU8(source, sourcePos--));
                }

                return;
            }
        }

        length = (length + sourcePos) | 0;

        for (length = (length - 7) | 0; sourcePos < length; arrayPutU8(dest, destPos++, arrayAtU8(source, sourcePos++))) {
            arrayPutU8(dest, destPos++, arrayAtU8(source, sourcePos++));
            arrayPutU8(dest, destPos++, arrayAtU8(source, sourcePos++));
            arrayPutU8(dest, destPos++, arrayAtU8(source, sourcePos++));
            arrayPutU8(dest, destPos++, arrayAtU8(source, sourcePos++));
            arrayPutU8(dest, destPos++, arrayAtU8(source, sourcePos++));
            arrayPutU8(dest, destPos++, arrayAtU8(source, sourcePos++));
            arrayPutU8(dest, destPos++, arrayAtU8(source, sourcePos++));
        }

        length = (length + 7) | 0;

        while (sourcePos < length) {
            arrayPutU8(dest, destPos++, arrayAtU8(source, sourcePos++));
        }
    }

    // HD vg.a(I[S)[S
    static copyOfShorts(source: Int16Array | null): Int16Array | null {
        if (source === null) return null;
        const result = new Int16Array(source.length);
        ArrayUtils.copyShorts(source, 0, result, 0, source.length);
        return result;
    }

    // HD ea.a([FI)[F
    static copyOfFloats(source: Float32Array | null, sourcePos: number): Float32Array | null {
        try {
            if (source === null) return null;
            const result = new Float32Array(source.length);
            ArrayUtils.copyFloats(source, sourcePos, result, 0, source.length);
            return result;
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, `ea.B(${source === null ? 'null' : '{...}'},${sourcePos})`);
        }
    }

    // HD oi.a(B[B)[B
    static copyOfBytes(source: Uint8Array | null): Uint8Array | null {
        if (source === null) return null;
        const result = new Uint8Array(source.length);
        ArrayUtils.copyBytes(source, 0, result, 0, source.length);
        return result;
    }

    // ok.a([IZ)[I / HD ja.a([II)[I
    static copyOf(source: Int32Array | null): Int32Array | null {
        if (source === null) return null;
        const result = new Int32Array(source.length);
        ArrayUtils.copyInts(source, 0, result, 0, source.length);
        return result;
    }
}
