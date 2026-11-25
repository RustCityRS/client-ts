import { createHash } from 'node:crypto';

export function digest(array: Int32Array | Int16Array | Int8Array | Uint8Array | null): string {
    if (array === null) return '-';
    const bytes = Buffer.alloc(array.length * 4);
    for (let i = 0; i < array.length; i++) {
        bytes.writeInt32BE(array instanceof Uint8Array ? (array[i] << 24) >> 24 : array[i], i * 4);
    }
    return createHash('sha256').update(bytes).digest('hex');
}
