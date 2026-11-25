import { arrayAtI32, arrayAtObj, arrayPutI32 } from '#/util/JavaArray';
import { bitLength, doubleToInt, intDivide, intPow, intRemainder } from '#/util/IntUtils';
import JagVorbis from './JagVorbis';

export default class CodeBook {
    // dh.a:[[F
    private vectors: Float32Array[] | null = null;
    // dh.b:[I
    private lengths: Int32Array;
    // dh.c:I
    private entries: number;
    // dh.d:I
    dimensions: number;
    // dh.e:[I
    private values: Int32Array | null = null;
    // dh.f:[I
    private tree: Int32Array | null = null;
    // dh.a(II)I
    private static lookupValues(entries: number, dimensions: number): number {
        let n = (doubleToInt(Math.pow(entries, 1.0 / dimensions)) + 1) | 0;
        while (intPow(n, dimensions) > entries) n = (n - 1) | 0;
        return n;
    }
    // dh.a()[F
    vector(): Float32Array {
        return arrayAtObj(this.vectors, this.scalar());
    }
    // dh.b()V
    private buildTree(): void {
        const codes = new Int32Array(this.entries),
            next = new Int32Array(33);
        for (let i = 0; i < this.entries; i++) {
            const length = this.lengths[i];
            if (length === 0) continue;
            const mask = 1 << (32 - length),
                code = arrayAtI32(next, length);
            codes[i] = code;
            let end: number;
            if ((code & mask) !== 0) end = arrayAtI32(next, length - 1);
            else {
                end = code | mask;
                for (let j = length - 1; j >= 1; j--) {
                    const prefix = arrayAtI32(next, j);
                    if (prefix !== code) break;
                    const carry = 1 << (32 - j);
                    if ((prefix & carry) !== 0) {
                        next[j] = arrayAtI32(next, j - 1);
                        break;
                    }
                    next[j] = prefix | carry;
                }
            }
            next[length] = end;
            for (let j = length + 1; j <= 32; j++) if (next[j] === code) next[j] = end;
        }
        this.tree = new Int32Array(8);
        let limit = 0;
        for (let i = 0; i < this.entries; i++) {
            const length = this.lengths[i];
            if (length === 0) continue;
            let node = 0;
            for (let bit = 0; bit < length; bit++) {
                const mask = 0x80000000 >>> bit;
                if ((codes[i] & mask) !== 0) {
                    if (arrayAtI32(this.tree, node) === 0) arrayPutI32(this.tree, node, limit);
                    node = this.tree[node];
                } else node++;
                if (node >= this.tree.length) {
                    const grown: Int32Array = new Int32Array(this.tree.length * 2);
                    grown.set(this.tree);
                    this.tree = grown;
                }
            }
            arrayPutI32(this.tree, node, ~i);
            if (node >= limit) limit = node + 1;
        }
    }
    // dh.c()I
    scalar(): number {
        let node = 0;
        while (arrayAtI32(this.tree, node) >= 0) node = JagVorbis.ReadBit() !== 0 ? arrayAtI32(this.tree, node) : node + 1;
        return ~arrayAtI32(this.tree, node);
    }
    // dh.<init>()V
    constructor() {
        JagVorbis.ReadBits(24);
        this.dimensions = JagVorbis.ReadBits(16);
        this.entries = JagVorbis.ReadBits(24);
        this.lengths = new Int32Array(this.entries);
        if (JagVorbis.ReadBit() !== 0) {
            let entry = 0;
            for (let length = JagVorbis.ReadBits(5) + 1; entry < this.entries; length++) {
                const run = JagVorbis.ReadBits(bitLength(this.entries - entry));
                for (let j = 0; j < run; j++) arrayPutI32(this.lengths, entry++, length);
            }
        } else {
            const sparse = JagVorbis.ReadBit() !== 0;
            for (let i = 0; i < this.entries; i++) this.lengths[i] = sparse && JagVorbis.ReadBit() === 0 ? 0 : JagVorbis.ReadBits(5) + 1;
        }
        this.buildTree();
        const lookup = JagVorbis.ReadBits(4);
        if (lookup > 0) {
            const min = JagVorbis.Float32Unpack(JagVorbis.ReadBits(32)),
                delta = JagVorbis.Float32Unpack(JagVorbis.ReadBits(32));
            const bits = JagVorbis.ReadBits(4) + 1,
                sequence = JagVorbis.ReadBit() !== 0;
            const n = lookup === 1 ? CodeBook.lookupValues(this.entries, this.dimensions) : Math.imul(this.entries, this.dimensions);
            this.values = new Int32Array(n);
            for (let i = 0; i < n; i++) this.values[i] = JagVorbis.ReadBits(bits);
            this.vectors = Array.from({ length: this.entries }, () => new Float32Array(this.dimensions));
            const f = Math.fround;
            if (lookup === 1) {
                for (let i = 0; i < this.entries; i++) {
                    let last = 0,
                        stride = 1;
                    for (let j = 0; j < this.dimensions; j++) {
                        const index = intRemainder(intDivide(i, stride), n);
                        const value = f(f(f(f(arrayAtI32(this.values, index)) * delta) + min) + last);
                        this.vectors[i][j] = value;
                        if (sequence) last = value;
                        stride = Math.imul(stride, n);
                    }
                }
                return;
            }
            for (let i = 0; i < this.entries; i++) {
                let last = 0,
                    index = Math.imul(i, this.dimensions);
                for (let j = 0; j < this.dimensions; j++) {
                    const value = f(f(f(f(arrayAtI32(this.values, index)) * delta) + min) + last);
                    this.vectors[i][j] = value;
                    if (sequence) last = value;
                    index++;
                }
            }
        }
    }
}
