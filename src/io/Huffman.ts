import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import { byteAt, putByte } from './JavaByteArray';
import { arrayAtI32, arrayPutI32 } from '#/util/JavaArray';
import { loadMinimenu, loadWorldMap } from '#/util/GamepackClasses';

export default class Huffman {
    // HD fi.b(B)V
    static releaseHdStatics(guard: number): void {
        try {
            const WorldMap = loadWorldMap();
            releaseReferences(WorldMap, 'wallTypes');
            if (guard <= 85) {
                const Minimenu = loadMinimenu();
                Minimenu.crossMode = 33;
            }
            // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD a stays deferred until fi.b(B)V in Huffman.releaseHdStatics.
            const Crc32 = (require('./Crc32') as typeof import('./Crc32')).default;
            releaseReferences(Crc32, 'CRCTable32');
            releaseReferences(WorldMap, 'overview');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'fi.C(' + guard + ')');
        }
    }

    // dd.c:[I
    private codes: Int32Array;
    // dd.d:[I
    private tree: Int32Array;
    // dd.g:[B
    private lengths: Uint8Array;

    // dd.<init>([B)V
    constructor(lengths: Uint8Array) {
        const count = lengths.length;
        this.tree = new Int32Array(8);
        const next = new Int32Array(33);
        let free = 0;
        this.codes = new Int32Array(count);
        this.lengths = lengths;
        for (let symbol = 0; symbol < count; symbol++) {
            const bits = (lengths[symbol] << 24) >> 24;
            if (bits === 0) continue;
            const bit = 1 << (32 - bits);
            const code = arrayAtI32(next, bits);
            this.codes[symbol] = code;
            let following;
            if ((bit & code) === 0) {
                following = code | bit;
                for (let n = bits - 1; n >= 1; n--) {
                    const shorter = next[n];
                    if (shorter !== code) break;
                    const mask = 1 << (32 - n);
                    if ((shorter & mask) !== 0) {
                        next[n] = next[n - 1];
                        break;
                    }
                    next[n] = shorter | mask;
                }
            } else following = next[bits - 1];
            next[bits] = following;
            for (let n = bits + 1; n <= 32; n++) {
                if (next[n] === code) next[n] = following;
            }

            let node = 0;
            for (let n = 0; n < bits; n++) {
                const mask = 0x80000000 >>> n;
                if ((code & mask) === 0) node = (node + 1) | 0;
                else {
                    if (arrayAtI32(this.tree, node) === 0) this.tree[node] = free;
                    node = arrayAtI32(this.tree, node);
                }
                if (node >= this.tree.length) {
                    const expanded = new Int32Array(this.tree.length * 2);
                    for (let i = 0; i < this.tree.length; i++) expanded[i] = this.tree[i];
                    this.tree = expanded;
                }
            }
            arrayPutI32(this.tree, node, ~symbol);
            if (node >= free) free = (node + 1) | 0;
        }
    }

    // dd.a(II[BI[BI)I
    Encode(start: number, count: number, dest: Uint8Array | null, offset: number, source: Uint8Array | null): number {
        const end = (start + count) | 0;
        let carry = 0;
        let bitPos = offset << 3;
        for (let i = start; i < end; i = (i + 1) | 0) {
            const symbol = byteAt(source, i);
            const bits = (byteAt(this.lengths, symbol) << 24) >> 24;
            const code = arrayAtI32(this.codes, symbol);
            if (bits === 0) throw new Error('No codeword for data value ' + symbol);
            let shift = bitPos & 7;
            let out = bitPos >> 3;
            const last = (out + ((bits + shift - 1) >> 3)) | 0;
            const previous = carry & (-shift >> 31);
            bitPos = (bitPos + bits) | 0;
            shift += 24;
            carry = previous | (code >>> shift);
            putByte(dest, out, carry);
            if (out < last) {
                shift -= 8;
                carry = code >>> shift;
                putByte(dest, ++out, carry);
                if (out < last) {
                    shift -= 8;
                    carry = code >>> shift;
                    putByte(dest, ++out, carry);
                    if (out < last) {
                        shift -= 8;
                        carry = code >>> shift;
                        putByte(dest, ++out, carry);
                        if (out < last) {
                            shift -= 8;
                            carry = code << -shift;
                            putByte(dest, ++out, carry);
                        }
                    }
                }
            }
        }
        return (((bitPos + 7) >> 3) - offset) | 0;
    }

    // dd.a([BB[BIII)I
    Decode(source: Uint8Array | null, dest: Uint8Array | null, start: number, count: number, offset: number): number {
        if (count === 0) return 0;
        const end = (count + offset) | 0;
        let node = 0,
            input = start;
        while (true) {
            const bits = byteAt(source, input);
            node = (bits & 128) !== 0 ? arrayAtI32(this.tree, node) : (node + 1) | 0;
            let entry = arrayAtI32(this.tree, node);
            if (entry < 0) {
                putByte(dest, offset++, ~entry);
                if (offset >= end) break;
                node = 0;
            }
            node = (bits & 64) !== 0 ? arrayAtI32(this.tree, node) : (node + 1) | 0;
            entry = arrayAtI32(this.tree, node);
            if (entry < 0) {
                putByte(dest, offset++, ~entry);
                if (offset >= end) break;
                node = 0;
            }
            node = (bits & 32) !== 0 ? arrayAtI32(this.tree, node) : (node + 1) | 0;
            entry = arrayAtI32(this.tree, node);
            if (entry < 0) {
                putByte(dest, offset++, ~entry);
                if (offset >= end) break;
                node = 0;
            }
            node = (bits & 16) !== 0 ? arrayAtI32(this.tree, node) : (node + 1) | 0;
            entry = arrayAtI32(this.tree, node);
            if (entry < 0) {
                putByte(dest, offset++, ~entry);
                if (offset >= end) break;
                node = 0;
            }
            node = (bits & 8) !== 0 ? arrayAtI32(this.tree, node) : (node + 1) | 0;
            entry = arrayAtI32(this.tree, node);
            if (entry < 0) {
                putByte(dest, offset++, ~entry);
                if (offset >= end) break;
                node = 0;
            }
            node = (bits & 4) !== 0 ? arrayAtI32(this.tree, node) : (node + 1) | 0;
            entry = arrayAtI32(this.tree, node);
            if (entry < 0) {
                putByte(dest, offset++, ~entry);
                if (offset >= end) break;
                node = 0;
            }
            node = (bits & 2) !== 0 ? arrayAtI32(this.tree, node) : (node + 1) | 0;
            entry = arrayAtI32(this.tree, node);
            if (entry < 0) {
                putByte(dest, offset++, ~entry);
                if (offset >= end) break;
                node = 0;
            }
            node = (bits & 1) !== 0 ? arrayAtI32(this.tree, node) : (node + 1) | 0;
            entry = arrayAtI32(this.tree, node);
            if (entry < 0) {
                putByte(dest, offset++, ~entry);
                if (offset >= end) break;
                node = 0;
            }
            input = (input + 1) | 0;
        }
        return (input + 1 - start) | 0;
    }
}
