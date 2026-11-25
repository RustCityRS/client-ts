// Java checks the signed index at the load or store instruction. A JS bounds
// check performed later can leave a different cursor, node or destination.
export function requireNonNull<T>(value: T | null | undefined): T {
    if (value === null || value === undefined) throw new TypeError('Null reference');
    return value;
}

export function arrayAt<T>(array: ArrayLike<T> | null, index: number): T {
    index |= 0;
    if (array === null) throw new TypeError('Null array');
    if (index < 0 || index >= array.length) throw new RangeError('array index ' + index);
    return array[index];
}

export function arrayPut<T>(array: { readonly length: number; [index: number]: T } | null, index: number, value: T): void {
    index |= 0;
    if (array === null) throw new TypeError('Null array');
    if (index < 0 || index >= array.length) throw new RangeError('array index ' + index);
    array[index] = value;
}

// Element-kind specializations: identical Java checks, one array kind per function. A single helper shared by
// every element kind goes megamorphic in V8 and never inlines (91% of live-client CPU, PORTING.md 2026-11-23).
// Call the helper matching the static array type; keep arrayAt/arrayPut for unions only.

export function arrayAtI32(array: Int32Array | null, index: number): number {
    index |= 0;
    if (array === null) throw new TypeError('Null array');
    if (index < 0 || index >= array.length) throw new RangeError('array index ' + index);
    return array[index];
}

export function arrayPutI32(array: Int32Array | null, index: number, value: number): void {
    index |= 0;
    if (array === null) throw new TypeError('Null array');
    if (index < 0 || index >= array.length) throw new RangeError('array index ' + index);
    array[index] = value;
}

export function arrayAtI16(array: Int16Array | null, index: number): number {
    index |= 0;
    if (array === null) throw new TypeError('Null array');
    if (index < 0 || index >= array.length) throw new RangeError('array index ' + index);
    return array[index];
}

export function arrayPutI16(array: Int16Array | null, index: number, value: number): void {
    index |= 0;
    if (array === null) throw new TypeError('Null array');
    if (index < 0 || index >= array.length) throw new RangeError('array index ' + index);
    array[index] = value;
}

export function arrayAtI8(array: Int8Array | null, index: number): number {
    index |= 0;
    if (array === null) throw new TypeError('Null array');
    if (index < 0 || index >= array.length) throw new RangeError('array index ' + index);
    return array[index];
}

export function arrayPutI8(array: Int8Array | null, index: number, value: number): void {
    index |= 0;
    if (array === null) throw new TypeError('Null array');
    if (index < 0 || index >= array.length) throw new RangeError('array index ' + index);
    array[index] = value;
}

export function arrayAtU8(array: Uint8Array | null, index: number): number {
    index |= 0;
    if (array === null) throw new TypeError('Null array');
    if (index < 0 || index >= array.length) throw new RangeError('array index ' + index);
    return array[index];
}

export function arrayPutU8(array: Uint8Array | null, index: number, value: number): void {
    index |= 0;
    if (array === null) throw new TypeError('Null array');
    if (index < 0 || index >= array.length) throw new RangeError('array index ' + index);
    array[index] = value;
}

export function arrayAtF32(array: Float32Array | null, index: number): number {
    index |= 0;
    if (array === null) throw new TypeError('Null array');
    if (index < 0 || index >= array.length) throw new RangeError('array index ' + index);
    return array[index];
}

// Read or copy JVM float[] words without quieting, canonicalizing, or changing the sign of NaNs.
export function floatWords(array: Float32Array | null): Int32Array | null {
    return array === null ? null : new Int32Array(array.buffer, array.byteOffset, array.length);
}

export function arrayPutF32(array: Float32Array | null, index: number, value: number): void {
    index |= 0;
    if (array === null) throw new TypeError('Null array');
    if (index < 0 || index >= array.length) throw new RangeError('array index ' + index);
    array[index] = value;
}

export function arrayAtB64(array: BigInt64Array | null, index: number): bigint {
    index |= 0;
    if (array === null) throw new TypeError('Null array');
    if (index < 0 || index >= array.length) throw new RangeError('array index ' + index);
    return array[index];
}

export function arrayPutB64(array: BigInt64Array | null, index: number, value: bigint): void {
    index |= 0;
    if (array === null) throw new TypeError('Null array');
    if (index < 0 || index >= array.length) throw new RangeError('array index ' + index);
    array[index] = value;
}

// plain JS arrays (objects, booleans, strings share V8 PACKED/HOLEY_ELEMENTS maps)
export function arrayAtObj<T>(array: ArrayLike<T> | null, index: number): T {
    index |= 0;
    if (array === null) throw new TypeError('Null array');
    if (index < 0 || index >= array.length) throw new RangeError('array index ' + index);
    return array[index];
}

export function arrayPutObj<T>(array: { readonly length: number; [index: number]: T } | null, index: number, value: T): void {
    index |= 0;
    if (array === null) throw new TypeError('Null array');
    if (index < 0 || index >= array.length) throw new RangeError('array index ' + index);
    array[index] = value;
}
