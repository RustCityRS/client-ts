import { byteAt } from './JavaByteArray';

export default class Crc32 {
    // a.f:[I
    static CRCTable32 = new Int32Array(256);

    // a.<clinit>()V
    static {
        for (let i = 0; i < 256; i++) {
            let crc = i;
            for (let bit = 0; bit < 8; bit++) {
                if ((crc & 1) === 1) crc = (crc >>> 1) ^ -306674912;
                else crc >>>= 1;
            }
            this.CRCTable32[i] = crc;
        }
    }

    // q.a(I[BI)I
    static prefix(bytes: Uint8Array | null, end: number): number {
        return this.compute(0, bytes, end);
    }

    // ik.a(I[BII)I
    static compute(start: number, bytes: Uint8Array | null, end: number): number {
        let crc = -1;
        for (let i = start; i < end; i++) {
            crc = (crc >>> 8) ^ this.CRCTable32[(byteAt(bytes, i) ^ crc) & 255];
        }
        return ~crc;
    }
}
