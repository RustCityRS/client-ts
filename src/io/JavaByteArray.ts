// JS typed arrays ignore out-of-bounds accesses. A JVM baload or bastore throws
// after evaluating its index (which can advance the packet cursor).
export function byteAt(bytes: Uint8Array | null, index: number): number {
    index |= 0;
    if (bytes === null) throw new TypeError('Null byte array');
    if (index < 0 || index >= bytes.length) throw new RangeError('byte array index ' + index);
    return bytes[index];
}

export function putByte(bytes: Uint8Array | null, index: number, value: number): void {
    index |= 0;
    if (bytes === null) throw new TypeError('Null byte array');
    if (index < 0 || index >= bytes.length) throw new RangeError('byte array index ' + index);
    bytes[index] = value;
}
