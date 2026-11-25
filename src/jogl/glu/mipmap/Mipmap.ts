import { GL } from '#/jogl/GL';
import GLException from '#/jogl/GLException';
import ByteBuffer from '#/util/nio/ByteBuffer';
import { JavaError } from '#/util/JavaException';
import { arrayAtF32, arrayAtI32, arrayPutI32, requireNonNull } from '#/util/JavaArray';
import BuildMipmap from './BuildMipmap';
import type PixelStorageModes from './PixelStorageModes';

// java.lang.String.trim()Ljava/lang/String;: strips chars <= U+0020 at both ends (JS trim() strips a different set).
function javaTrim(value: string): string {
    let st = 0;
    let len = value.length;
    while (st < len && value.charCodeAt(st) <= 0x20) st++;
    while (st < len && value.charCodeAt(len - 1) <= 0x20) len--;
    return st > 0 || len < value.length ? value.substring(st, len) : value;
}

// java.lang.String.substring(II)Ljava/lang/String;
function javaSubstring(value: string, beginIndex: number, endIndex: number): string {
    if (beginIndex < 0 || beginIndex > endIndex || endIndex > value.length) {
        throw new RangeError('StringIndexOutOfBoundsException: begin ' + beginIndex + ', end ' + endIndex + ', length ' + value.length);
    }
    return value.substring(beginIndex, endIndex);
}

// java.lang.Double.parseDouble(Ljava/lang/String;)D (jdk.internal.math.FloatingDecimal.readJavaFormatString).
// The decimal grammar: optional sign, then NaN, Infinity, or digits with an optional point and exponent and an
// optional f/F/d/D suffix; the hexadecimal grammar (FloatingDecimal.parseHexString): optional sign, 0x/0X, hex digits
// with an optional point, a binary exponent p/P and the same optional suffix; anything else is a
// NumberFormatException. Decimal-to-double rounding is correct in both Java and JS, so Number() of the accepted text
// gives Java's value; a hexadecimal significand is scaled exactly and rounded half-even (subnormals included), as
// parseHexString does. closestFit passes at most three chars, too few for a hexadecimal float ("0x1p0" is the
// shortest); the arm is complete anyway. Exported only for the oracle test (test/hd/glu-mipmap.test.ts).
export function javaParseDouble(value: string | null): number {
    const text = javaTrim(requireNonNull(value));
    if (text.length === 0) throw new Error('NumberFormatException: empty String');
    if (/^[+-]?(?:NaN|Infinity|(?:[0-9]+\.?[0-9]*|\.[0-9]+)(?:[eE][+-]?[0-9]+)?[fFdD]?)$/.test(text)) {
        return Number(text.replace(/[fFdD]$/, ''));
    }
    const hex = /^([+-]?)0[xX]([0-9a-fA-F]*)(?:\.([0-9a-fA-F]*))?[pP]([+-]?[0-9]+)[fFdD]?$/.exec(text);
    if (hex !== null && ((hex[2] ?? '') + (hex[3] ?? '')).length > 0) {
        const digits = (hex[2] ?? '') + (hex[3] ?? '');
        const significand = BigInt('0x' + digits);
        const exponent = BigInt(hex[4] ?? '0') - 4n * BigInt((hex[3] ?? '').length);
        const magnitude = significand === 0n ? 0 : scaleHexSignificand(significand, exponent);
        return hex[1] === '-' ? -magnitude : magnitude;
    }
    // A second '.' among the leading digits (after an optional sign, outside the NaN, Infinity and 0x arms) stops
    // readJavaFormatString's digit loops with its own message.
    const unsigned = text.replace(/^[+-]/, '');
    if (!/^(?:N|I|0[xX])/.test(unsigned) && (/^[0-9.]*/.exec(unsigned)?.[0] ?? '').split('.').length > 2) {
        throw new Error('NumberFormatException: multiple points');
    }
    // readJavaFormatString reassigns `in = in.trim()` before parsing, so the message quotes the trimmed text.
    throw new Error('NumberFormatException: For input string: "' + text + '"');
}

// significand * 2^exponent (significand > 0) rounded half-even to the nearest double: Infinity past
// Double.MAX_VALUE, subnormal steps of 2^-1074 below Double.MIN_NORMAL.
function scaleHexSignificand(significand: bigint, exponent: bigint): number {
    const top = BigInt(significand.toString(2).length) - 1n + exponent; // floor(log2(value))
    if (top > 1023n) return Infinity;
    const low = top - 52n > -1074n ? top - 52n : -1074n; // weight of the last kept bit
    const shift = low - exponent;
    let kept: bigint;
    if (shift <= 0n) {
        kept = significand << -shift;
    } else {
        kept = significand >> shift;
        const rest = significand - (kept << shift);
        const half = 1n << (shift - 1n);
        if (rest > half || (rest === half && (kept & 1n) === 1n)) kept += 1n;
    }
    if (kept === 0n) return 0;
    if (BigInt(kept.toString(2).length) - 1n + low > 1023n) return Infinity; // rounded up past MAX_VALUE
    // kept <= 2^53 and low >= -1074: both factors and the product are exact doubles
    const scale = low < -1022n ? 2 ** (Number(low) + 1022) * 2 ** -1022 : 2 ** Number(low);
    return Number(kept) * scale;
}

// com.sun.opengl.impl.mipmap.Mipmap (shipped jogl.jar, JOGL 1.1.x): argument checks, byte swaps, the closest-fit
// size probe and the gluBuild2DMipmaps entry that GLU delegates to. Every member the shipped class keeps is ported.
// The two GLU_SWAP_4_BYTES overloads differ only in a primitive type, which a TS number cannot tell apart, so they
// are GLU_SWAP_4_BYTES ((I)I) and GLU_SWAP_4_BYTES_F ((F)F).
// The synthetic class$(Ljava/lang/String;)Ljava/lang/Class; and class$com$sun$opengl$impl$mipmap$Mipmap field are
// javac's -target 1.4 support for the Mipmap.class literal in <clinit> (see $assertionsDisabled); they have no TS
// counterpart.
// GLU error codes are literals, as javac inlined them: 100900 GLU_INVALID_ENUM, 100901 GLU_INVALID_VALUE,
// 100904 GLU_INVALID_OPERATION.
export default class Mipmap {
    // com.sun.opengl.impl.mipmap.Mipmap.$assertionsDisabled:Z
    // Mipmap.<clinit>()V sets it to !desiredAssertionStatus() (through the synthetic class$(String) and the
    // class$com$sun$opengl$impl$mipmap$Mipmap cache). The client JVM runs without -ea, so it is true and the assert
    // statements below never evaluate their conditions.
    static readonly $assertionsDisabled: boolean = true;

    // com.sun.opengl.impl.mipmap.Mipmap.<init>()V
    constructor() {}

    // com.sun.opengl.impl.mipmap.Mipmap.computeLog(I)I
    // Compute the log base 2 of a power of two; -1 when the value is not one.
    static computeLog(value: number): number {
        let i = 0;
        // Error
        if (value === 0) {
            return -1;
        }
        for (;;) {
            if ((value & 1) >= 1) {
                if (value !== 1) {
                    return -1;
                }
                return i;
            }
            value = value >> 1;
            i++;
        }
    }

    // com.sun.opengl.impl.mipmap.Mipmap.nearestPower(I)I
    // Compute the nearest power of 2 number. This algorithm is a little strange, but it works quite well.
    static nearestPower(value: number): number {
        let i = 1;
        // Error!
        if (value === 0) {
            return -1;
        }
        for (;;) {
            if (value === 1) {
                return i;
            } else if (value === 3) {
                return Math.imul(i, 4);
            }
            value = value >> 1;
            i = Math.imul(i, 2);
        }
    }

    // com.sun.opengl.impl.mipmap.Mipmap.GLU_SWAP_2_BYTES(S)S
    static GLU_SWAP_2_BYTES(s: number): number {
        let b = 0;
        b = ((s >>> 8) << 24) >> 24;
        s = ((s << 8) << 16) >> 16;
        s = ((s | (255 & b)) << 16) >> 16;
        return s;
    }

    // com.sun.opengl.impl.mipmap.Mipmap.GLU_SWAP_4_BYTES(I)I
    static GLU_SWAP_4_BYTES(i: number): number {
        let t = i << 24;
        t |= 0x00ff0000 & (i << 8);
        t |= 0x0000ff00 & (i >>> 8);
        t |= 0x000000ff & (i >>> 24);
        return t;
    }

    // com.sun.opengl.impl.mipmap.Mipmap.GLU_SWAP_4_BYTES(F)F
    // (sic) JOGL never swaps the float: floatToRawIntBits then intBitsToFloat of the same bits returns the input.
    // The bit round trip runs through a Float32Array, as the JVM moves raw bits.
    static GLU_SWAP_4_BYTES_F(f: number): number {
        const i = arrayAtI32(new Int32Array(new Float32Array([f]).buffer), 0); // Float.floatToRawIntBits(F)I
        const t = arrayAtF32(new Float32Array(new Int32Array([i]).buffer), 0); // Float.intBitsToFloat(I)F
        return t;
    }

    // com.sun.opengl.impl.mipmap.Mipmap.checkMipmapArgs(III)I
    static checkMipmapArgs(_internalFormat: number, format: number, type: number): number {
        if (!Mipmap.legalFormat(format) || !Mipmap.legalType(type)) {
            return 100900; // GLU.GLU_INVALID_ENUM
        }
        if (format === GL.GL_STENCIL_INDEX) {
            return 100900; // GLU.GLU_INVALID_ENUM
        }
        if (!Mipmap.isLegalFormatForPackedPixelType(format, type)) {
            return 100904; // GLU.GLU_INVALID_OPERATION
        }
        return 0;
    }

    // com.sun.opengl.impl.mipmap.Mipmap.legalFormat(I)Z
    static legalFormat(format: number): boolean {
        switch (format) {
            case GL.GL_COLOR_INDEX:
            case GL.GL_STENCIL_INDEX:
            case GL.GL_DEPTH_COMPONENT:
            case GL.GL_RED:
            case GL.GL_GREEN:
            case GL.GL_BLUE:
            case GL.GL_ALPHA:
            case GL.GL_RGB:
            case GL.GL_RGBA:
            case GL.GL_LUMINANCE:
            case GL.GL_LUMINANCE_ALPHA:
            case GL.GL_BGR:
            case GL.GL_BGRA:
                return true;
            default:
                return false;
        }
    }

    // com.sun.opengl.impl.mipmap.Mipmap.legalType(I)Z
    static legalType(type: number): boolean {
        switch (type) {
            case GL.GL_BITMAP:
            case GL.GL_BYTE:
            case GL.GL_UNSIGNED_BYTE:
            case GL.GL_SHORT:
            case GL.GL_UNSIGNED_SHORT:
            case GL.GL_INT:
            case GL.GL_UNSIGNED_INT:
            case GL.GL_FLOAT:
            case GL.GL_UNSIGNED_BYTE_3_3_2:
            case GL.GL_UNSIGNED_BYTE_2_3_3_REV:
            case GL.GL_UNSIGNED_SHORT_5_6_5:
            case GL.GL_UNSIGNED_SHORT_5_6_5_REV:
            case GL.GL_UNSIGNED_SHORT_4_4_4_4:
            case GL.GL_UNSIGNED_SHORT_4_4_4_4_REV:
            case GL.GL_UNSIGNED_SHORT_5_5_5_1:
            case GL.GL_UNSIGNED_SHORT_1_5_5_5_REV:
            case GL.GL_UNSIGNED_INT_8_8_8_8:
            case GL.GL_UNSIGNED_INT_8_8_8_8_REV:
            case GL.GL_UNSIGNED_INT_10_10_10_2:
            case GL.GL_UNSIGNED_INT_2_10_10_10_REV:
                return true;
            default:
                return false;
        }
    }

    // com.sun.opengl.impl.mipmap.Mipmap.isTypePackedPixel(I)Z
    static isTypePackedPixel(type: number): boolean {
        if (!Mipmap.$assertionsDisabled && !Mipmap.legalType(type)) throw new JavaError('AssertionError');

        if (
            type === GL.GL_UNSIGNED_BYTE_3_3_2 ||
            type === GL.GL_UNSIGNED_BYTE_2_3_3_REV ||
            type === GL.GL_UNSIGNED_SHORT_5_6_5 ||
            type === GL.GL_UNSIGNED_SHORT_5_6_5_REV ||
            type === GL.GL_UNSIGNED_SHORT_4_4_4_4 ||
            type === GL.GL_UNSIGNED_SHORT_4_4_4_4_REV ||
            type === GL.GL_UNSIGNED_SHORT_5_5_5_1 ||
            type === GL.GL_UNSIGNED_SHORT_1_5_5_5_REV ||
            type === GL.GL_UNSIGNED_INT_8_8_8_8 ||
            type === GL.GL_UNSIGNED_INT_8_8_8_8_REV ||
            type === GL.GL_UNSIGNED_INT_10_10_10_2 ||
            type === GL.GL_UNSIGNED_INT_2_10_10_10_REV
        ) {
            return true;
        }
        return false;
    }

    // com.sun.opengl.impl.mipmap.Mipmap.isLegalFormatForPackedPixelType(II)Z
    // (sic) JOGL tests isTypePackedPixel without negating it, so every packed type passes here and the tests below
    // only ever see unpacked types (they then always end in true).
    static isLegalFormatForPackedPixelType(format: number, type: number): boolean {
        // if not a packed pixel type then return true
        if (Mipmap.isTypePackedPixel(type)) {
            return true;
        }

        // 3_3_2/2_3_3_REV & 5_6_5/5_6_5_REV are only compatible with RGB
        // (a non-short-circuit &: both operands are evaluated)
        if ((type === GL.GL_UNSIGNED_BYTE_3_3_2 || type === GL.GL_UNSIGNED_BYTE_2_3_3_REV || type === GL.GL_UNSIGNED_SHORT_5_6_5 || type === GL.GL_UNSIGNED_SHORT_5_6_5_REV ? 1 : 0) & (format !== GL.GL_RGB ? 1 : 0)) {
            return false;
        }

        // 4_4_4_4/4_4_4_4_REV & 5_5_5_1/1_5_5_5_REV & 8_8_8_8/8_8_8_8_REV &
        // 10_10_10_2/2_10_10_10_REV are only compatible with RGBA, BGRA & ARGB_EXT
        if (
            (type === GL.GL_UNSIGNED_SHORT_4_4_4_4 ||
                type === GL.GL_UNSIGNED_SHORT_4_4_4_4_REV ||
                type === GL.GL_UNSIGNED_SHORT_5_5_5_1 ||
                type === GL.GL_UNSIGNED_SHORT_1_5_5_5_REV ||
                type === GL.GL_UNSIGNED_INT_8_8_8_8 ||
                type === GL.GL_UNSIGNED_INT_8_8_8_8_REV ||
                type === GL.GL_UNSIGNED_INT_10_10_10_2 ||
                type === GL.GL_UNSIGNED_INT_2_10_10_10_REV) &&
            format !== GL.GL_RGBA &&
            format !== GL.GL_BGRA
        ) {
            return false;
        }
        return true;
    }

    // com.sun.opengl.impl.mipmap.Mipmap.closestFit(Ljavax/media/opengl/GL;IIIIII[I[I)V
    // Probes proxy textures at level 1 of the nearest power-of-two size, halving until the driver accepts one; falls
    // back to GL_MAX_TEXTURE_SIZE for GL < 1.1, when even 1x1 is refused, or when the probe throws GLException.
    static closestFit(gl: GL, target: number, width: number, height: number, internalFormat: number, format: number, type: number, newWidth: Int32Array | null, newHeight: Int32Array | null): void {
        // Use proxy textures if OpenGL version >= 1.1
        if (javaParseDouble(javaSubstring(javaTrim(requireNonNull(gl.glGetString(GL.GL_VERSION))), 0, 3)) >= 1.1) {
            let widthPowerOf2 = Mipmap.nearestPower(width);
            let heightPowerOf2 = Mipmap.nearestPower(height);
            const proxyWidth = new Int32Array(1);
            let noProxyTextures = false;

            try {
                do {
                    // compute level 1 width & height, clamping each at 1
                    const widthAtLevelOne = width > 1 ? widthPowerOf2 >> 1 : widthPowerOf2;
                    const heightAtLevelOne = height > 1 ? heightPowerOf2 >> 1 : heightPowerOf2;
                    let proxyTarget: number;
                    if (!Mipmap.$assertionsDisabled && !(widthAtLevelOne > 0)) throw new JavaError('AssertionError');
                    if (!Mipmap.$assertionsDisabled && !(heightAtLevelOne > 0)) throw new JavaError('AssertionError');

                    // does width x height at level 1 & all their mipmaps fit?
                    if (target === GL.GL_TEXTURE_2D || target === GL.GL_PROXY_TEXTURE_2D) {
                        proxyTarget = GL.GL_PROXY_TEXTURE_2D;
                        gl.glTexImage2D(proxyTarget, 1, internalFormat, widthAtLevelOne, heightAtLevelOne, 0, format, type, null);
                    } else if (
                        target === GL.GL_TEXTURE_CUBE_MAP_POSITIVE_X ||
                        target === GL.GL_TEXTURE_CUBE_MAP_NEGATIVE_X ||
                        target === GL.GL_TEXTURE_CUBE_MAP_POSITIVE_Y ||
                        target === GL.GL_TEXTURE_CUBE_MAP_NEGATIVE_Y ||
                        target === GL.GL_TEXTURE_CUBE_MAP_POSITIVE_Z ||
                        target === GL.GL_TEXTURE_CUBE_MAP_NEGATIVE_Z
                    ) {
                        proxyTarget = GL.GL_PROXY_TEXTURE_CUBE_MAP;
                        gl.glTexImage2D(proxyTarget, 1, internalFormat, widthAtLevelOne, heightAtLevelOne, 0, format, type, null);
                    } else {
                        if (!Mipmap.$assertionsDisabled && !(target === GL.GL_TEXTURE_1D || target === GL.GL_PROXY_TEXTURE_1D)) throw new JavaError('AssertionError');
                        proxyTarget = GL.GL_PROXY_TEXTURE_1D;
                        gl.glTexImage1D(proxyTarget, 1, internalFormat, widthAtLevelOne, 0, format, type, null);
                    }
                    gl.glGetTexLevelParameteriv(proxyTarget, 1, GL.GL_TEXTURE_WIDTH, proxyWidth, 0);
                    // does it fit?
                    if (arrayAtI32(proxyWidth, 0) === 0) {
                        // nope, so try again with these sizes
                        if (widthPowerOf2 === 1 && heightPowerOf2 === 1) {
                            // A 1x1 texture couldn't fit for some reason so break out. This should never happen.
                            // But things that should never happen do, so the fallback below covers it.
                            noProxyTextures = true;
                            break;
                        }
                        widthPowerOf2 = widthAtLevelOne;
                        heightPowerOf2 = heightAtLevelOne;
                    }
                    // else it does fit
                } while (arrayAtI32(proxyWidth, 0) === 0);
            } catch (e) {
                if (!(e instanceof GLException)) throw e;
                noProxyTextures = true;
            }
            // loop must terminate
            // return the width & height at level 0 that fits
            if (!noProxyTextures) {
                arrayPutI32(newWidth, 0, widthPowerOf2);
                arrayPutI32(newHeight, 0, heightPowerOf2);
                return;
            }
        }
        const maxsize = new Int32Array(1);
        gl.glGetIntegerv(GL.GL_MAX_TEXTURE_SIZE, maxsize, 0);
        // clamp user's texture sizes to maximum sizes, if necessary
        arrayPutI32(newWidth, 0, Mipmap.nearestPower(width));
        if (arrayAtI32(newWidth, 0) > arrayAtI32(maxsize, 0)) {
            arrayPutI32(newWidth, 0, arrayAtI32(maxsize, 0));
        }
        arrayPutI32(newHeight, 0, Mipmap.nearestPower(height));
        if (arrayAtI32(newHeight, 0) > arrayAtI32(maxsize, 0)) {
            arrayPutI32(newHeight, 0, arrayAtI32(maxsize, 0));
        }
    }

    // com.sun.opengl.impl.mipmap.Mipmap.elements_per_group(II)I
    static elements_per_group(format: number, type: number): number {
        // Return the number of elements per grtoup of a specified gromat
        // If the type is packedpixels then answer is 1
        if (
            type === GL.GL_UNSIGNED_BYTE_3_3_2 ||
            type === GL.GL_UNSIGNED_BYTE_2_3_3_REV ||
            type === GL.GL_UNSIGNED_SHORT_5_6_5 ||
            type === GL.GL_UNSIGNED_SHORT_5_6_5_REV ||
            type === GL.GL_UNSIGNED_SHORT_4_4_4_4 ||
            type === GL.GL_UNSIGNED_SHORT_4_4_4_4_REV ||
            type === GL.GL_UNSIGNED_SHORT_5_5_5_1 ||
            type === GL.GL_UNSIGNED_SHORT_1_5_5_5_REV ||
            type === GL.GL_UNSIGNED_INT_8_8_8_8 ||
            type === GL.GL_UNSIGNED_INT_8_8_8_8_REV ||
            type === GL.GL_UNSIGNED_INT_10_10_10_2 ||
            type === GL.GL_UNSIGNED_INT_2_10_10_10_REV
        ) {
            return 1;
        }

        // Types are not packed pixels so get elements per group
        switch (format) {
            case GL.GL_RGB:
            case GL.GL_BGR:
                return 3;
            case GL.GL_LUMINANCE_ALPHA:
                return 2;
            case GL.GL_RGBA:
            case GL.GL_BGRA:
                return 4;
            default:
                return 1;
        }
    }

    // com.sun.opengl.impl.mipmap.Mipmap.bytes_per_element(I)I
    static bytes_per_element(type: number): number {
        // return the number of bytes per element, based on the element type
        switch (type) {
            case GL.GL_BITMAP:
            case GL.GL_BYTE:
            case GL.GL_UNSIGNED_BYTE:
            case GL.GL_UNSIGNED_BYTE_3_3_2:
            case GL.GL_UNSIGNED_BYTE_2_3_3_REV:
                return 1;
            case GL.GL_SHORT:
            case GL.GL_UNSIGNED_SHORT:
            case GL.GL_UNSIGNED_SHORT_5_6_5:
            case GL.GL_UNSIGNED_SHORT_5_6_5_REV:
            case GL.GL_UNSIGNED_SHORT_4_4_4_4:
            case GL.GL_UNSIGNED_SHORT_4_4_4_4_REV:
            case GL.GL_UNSIGNED_SHORT_5_5_5_1:
            case GL.GL_UNSIGNED_SHORT_1_5_5_5_REV:
                return 2;
            case GL.GL_INT:
            case GL.GL_UNSIGNED_INT:
            case GL.GL_UNSIGNED_INT_8_8_8_8:
            case GL.GL_UNSIGNED_INT_8_8_8_8_REV:
            case GL.GL_UNSIGNED_INT_10_10_10_2:
            case GL.GL_UNSIGNED_INT_2_10_10_10_REV:
            case GL.GL_FLOAT:
                return 4;
            default:
                return 4;
        }
    }

    // com.sun.opengl.impl.mipmap.Mipmap.is_index(I)Z
    static is_index(format: number): boolean {
        return format === GL.GL_COLOR_INDEX || format === GL.GL_STENCIL_INDEX;
    }

    // com.sun.opengl.impl.mipmap.Mipmap.image_size(IIII)I
    // Compute memory required for internal packed array of data of given type and format.
    static image_size(width: number, height: number, format: number, type: number): number {
        let bytes_per_row: number;

        if (!Mipmap.$assertionsDisabled && !(width > 0)) throw new JavaError('AssertionError');
        if (!Mipmap.$assertionsDisabled && !(height > 0)) throw new JavaError('AssertionError');
        const components = Mipmap.elements_per_group(format, type);
        if (type === GL.GL_BITMAP) {
            bytes_per_row = (((width + 7) | 0) / 8) | 0;
        } else {
            bytes_per_row = Math.imul(Mipmap.bytes_per_element(type), width);
        }
        return Math.imul(Math.imul(bytes_per_row, height), components);
    }

    // com.sun.opengl.impl.mipmap.Mipmap.retrieveStoreModes(Ljavax/media/opengl/GL;Lcom/sun/opengl/impl/mipmap/PixelStorageModes;)V
    static retrieveStoreModes(gl: GL, psm: PixelStorageModes): void {
        const a = new Int32Array(1);
        gl.glGetIntegerv(GL.GL_UNPACK_ALIGNMENT, a, 0);
        psm.setUnpackAlignment(arrayAtI32(a, 0));
        gl.glGetIntegerv(GL.GL_UNPACK_ROW_LENGTH, a, 0);
        psm.setUnpackRowLength(arrayAtI32(a, 0));
        gl.glGetIntegerv(GL.GL_UNPACK_SKIP_ROWS, a, 0);
        psm.setUnpackSkipRows(arrayAtI32(a, 0));
        gl.glGetIntegerv(GL.GL_UNPACK_SKIP_PIXELS, a, 0);
        psm.setUnpackSkipPixels(arrayAtI32(a, 0));
        gl.glGetIntegerv(GL.GL_UNPACK_LSB_FIRST, a, 0);
        psm.setUnpackLsbFirst(arrayAtI32(a, 0) === 1);
        gl.glGetIntegerv(GL.GL_UNPACK_SWAP_BYTES, a, 0);
        psm.setUnpackSwapBytes(arrayAtI32(a, 0) === 1);

        gl.glGetIntegerv(GL.GL_PACK_ALIGNMENT, a, 0);
        psm.setPackAlignment(arrayAtI32(a, 0));
        gl.glGetIntegerv(GL.GL_PACK_ROW_LENGTH, a, 0);
        psm.setPackRowLength(arrayAtI32(a, 0));
        gl.glGetIntegerv(GL.GL_PACK_SKIP_ROWS, a, 0);
        psm.setPackSkipRows(arrayAtI32(a, 0));
        gl.glGetIntegerv(GL.GL_PACK_SKIP_PIXELS, a, 0);
        psm.setPackSkipPixels(arrayAtI32(a, 0));
        gl.glGetIntegerv(GL.GL_PACK_LSB_FIRST, a, 0);
        psm.setPackLsbFirst(arrayAtI32(a, 0) === 1);
        gl.glGetIntegerv(GL.GL_PACK_SWAP_BYTES, a, 0);
        psm.setPackSwapBytes(arrayAtI32(a, 0) === 1);
    }

    // com.sun.opengl.impl.mipmap.Mipmap.gluBuild2DMipmaps(Ljavax/media/opengl/GL;IIIIIILjava/lang/Object;)I
    // data is a java.lang.Object: a ByteBuffer (always, from GLU), or a byte[], short[], int[] or float[]
    // (Int8Array/Uint8Array, Int16Array, Int32Array, Float32Array), copied into a new big-endian direct buffer.
    // Anything else leaves the buffer null, and the level builder throws NullPointerException.
    static gluBuild2DMipmaps(gl: GL, target: number, internalFormat: number, width: number, height: number, format: number, type: number, data: object | null): number {
        let buffer: ByteBuffer | null;
        let dataPos = 0;

        const widthPowerOf2 = new Int32Array(1);
        const heightPowerOf2 = new Int32Array(1);
        let levels: number;

        const status = Mipmap.checkMipmapArgs(internalFormat, format, type);
        if (status !== 0) {
            return status;
        }

        if (width < 1 || height < 1) {
            return 100901; // GLU.GLU_INVALID_VALUE
        }

        Mipmap.closestFit(gl, target, width, height, internalFormat, format, type, widthPowerOf2, heightPowerOf2);

        levels = Mipmap.computeLog(arrayAtI32(widthPowerOf2, 0));
        const level = Mipmap.computeLog(arrayAtI32(heightPowerOf2, 0));
        if (level > levels) {
            levels = level;
        }

        buffer = null;
        if (data instanceof ByteBuffer) {
            buffer = data;
            dataPos = buffer.position();
        } else if (data instanceof Int8Array || data instanceof Uint8Array) {
            const array = data;
            buffer = ByteBuffer.allocateDirect(array.length);
            buffer.put(array);
        } else if (data instanceof Int16Array) {
            const array = data;
            buffer = ByteBuffer.allocateDirect(Math.imul(array.length, 2));
            const sb = buffer.asShortBuffer();
            sb.put(array);
        } else if (data instanceof Int32Array) {
            const array = data;
            buffer = ByteBuffer.allocateDirect(Math.imul(array.length, 4));
            const ib = buffer.asIntBuffer();
            ib.put(array);
        } else if (data instanceof Float32Array) {
            const array = data;
            buffer = ByteBuffer.allocateDirect(Math.imul(array.length, 4));
            const fb = buffer.asFloatBuffer();
            fb.put(array);
        }

        try {
            return BuildMipmap.gluBuild2DMipmapLevelsCore(gl, target, internalFormat, width, height, arrayAtI32(widthPowerOf2, 0), arrayAtI32(heightPowerOf2, 0), format, type, 0, 0, levels, buffer);
        } finally {
            requireNonNull(buffer).position(dataPos);
        }
    }
}
