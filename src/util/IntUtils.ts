// ti.c(II)I
export function bitCeil(value: number): number {
    value = (value - 1) | 0;
    value |= value >>> 1;
    value |= value >>> 2;
    value |= value >>> 4;
    value |= value >>> 8;
    value |= value >>> 16;
    return (value + 1) | 0;
}

const longWords = new DataView(new ArrayBuffer(8));

// Java ((long) high << 32) + (long) low. The low int sign-extends before addition.
export function longFromSignedWords(high: number, low: number): bigint {
    longWords.setInt32(0, low, true);
    longWords.setInt32(4, low < 0 ? high - 1 : high, true);
    return longWords.getBigInt64(0, true);
}

// JVM d2i, idiv and irem.
export function doubleToInt(value: number): number {
    return Math.max(-2147483648, Math.min(2147483647, value)) | 0;
}

export function intDivide(a: number, b: number): number {
    if (b === 0) throw new RangeError('/ by zero');
    return (a / b) | 0;
}

export function intRemainder(a: number, b: number): number {
    if (b === 0) throw new RangeError('/ by zero');
    return (a % b) | 0;
}

// kl.a(BI)I
export function bitLength(value: number): number {
    let count = 0;
    if (value < 0 || value >= 65536) {
        count += 16;
        value >>>= 16;
    }
    if (value >= 256) {
        count += 8;
        value >>>= 8;
    }
    if (value >= 16) {
        count += 4;
        value >>>= 4;
    }
    if (value >= 4) {
        count += 2;
        value >>>= 2;
    }
    if (value >= 2) {
        count++;
        value >>>= 1;
    }
    return value + count;
}
// ei.a(IIB)I
export function intPow(base: number, exponent: number): number {
    let result = 1;
    while (exponent > 1) {
        if ((exponent & 1) !== 0) result = Math.imul(result, base);
        base = Math.imul(base, base);
        exponent >>= 1;
    }
    return exponent === 1 ? Math.imul(result, base) : result;
}
// bi.a(III)I
export function reverseBits(value: number, count: number): number {
    let result = 0;
    while (count > 0) {
        result = (result << 1) | (value & 1);
        count--;
        value >>>= 1;
    }
    return result;
}
// e.a(II)Z
export function isPowerOfTwo(value: number): boolean {
    return (value & -value) === value;
}

// ki.c(II)I
export function bitCount(value: number): number {
    value = ((value & 0x55555555) + ((value >>> 1) & 0x55555555)) | 0;
    value = (((value & 0xcccccccc) >>> 2) + (value & 0x33333333)) | 0;
    value = (value + (value >>> 4)) & 0x0f0f0f0f;
    value = (value + (value >>> 8)) | 0;
    value = (value + (value >>> 16)) | 0;
    return value & 255;
}

// m.a(BII)I
export function floorMod(value: number, divisor: number): number {
    const sign = (value >> 31) & (divisor - 1);
    return (sign + intRemainder((value + (value >>> 31)) | 0, divisor)) | 0;
}
