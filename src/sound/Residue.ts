import { arrayAtF32, arrayAtI32, arrayAtObj, arrayPutF32 } from '#/util/JavaArray';
import { intDivide, intRemainder } from '#/util/IntUtils';
import JagVorbis from './JagVorbis';

export default class Residue {
    // i.a:I
    private begin: number;
    // i.b:I
    private classes: number;
    // i.c:I
    private classbook: number;
    // i.d:I
    private type = JagVorbis.ReadBits(16);
    // i.e:I
    private end: number;
    // i.f:[I
    private books: Int32Array;
    // i.g:I
    private partitionSize: number;
    // i.a([FIZ)V
    decode(output: Float32Array | null, length: number, skip: boolean): void {
        for (let i = 0; i < length; i++) arrayPutF32(output, i, 0);
        if (skip) return;
        const classifications = arrayAtObj(JagVorbis.m_codebook, this.classbook);
        const dimensions = classifications.dimensions,
            partitions = intDivide(this.end - this.begin, this.partitionSize);
        const classes = new Int32Array(partitions);
        for (let pass = 0; pass < 8; pass++) {
            let partition = 0;
            while (partition < partitions) {
                if (pass === 0) {
                    let scalar = classifications.scalar();
                    for (let j = dimensions - 1; j >= 0; j--) {
                        if (partition + j < partitions) classes[partition + j] = intRemainder(scalar, this.classes);
                        scalar = intDivide(scalar, this.classes);
                    }
                }
                for (let j = 0; j < dimensions; j++) {
                    const id = arrayAtI32(this.books, arrayAtI32(classes, partition) * 8 + pass);
                    if (id >= 0) {
                        const start = (this.begin + Math.imul(partition, this.partitionSize)) | 0,
                            book = arrayAtObj(JagVorbis.m_codebook, id);
                        if (this.type === 0) {
                            const stride = intDivide(this.partitionSize, book.dimensions);
                            for (let i = 0; i < stride; i++) {
                                const vector = book.vector();
                                for (let k = 0; k < book.dimensions; k++) {
                                    const n = (start + i + Math.imul(k, stride)) | 0;
                                    arrayPutF32(output, n, arrayAtF32(output, n) + arrayAtF32(vector, k));
                                }
                            }
                        } else {
                            let i = 0;
                            while (i < this.partitionSize) {
                                const vector = book.vector();
                                for (let k = 0; k < book.dimensions; k++) {
                                    const n = (start + i) | 0;
                                    arrayPutF32(output, n, arrayAtF32(output, n) + arrayAtF32(vector, k));
                                    i++;
                                }
                            }
                        }
                    }
                    if (++partition >= partitions) break;
                }
            }
        }
    }
    // i.<init>()V
    constructor() {
        this.begin = JagVorbis.ReadBits(24);
        this.end = JagVorbis.ReadBits(24);
        this.partitionSize = JagVorbis.ReadBits(24) + 1;
        this.classes = JagVorbis.ReadBits(6) + 1;
        this.classbook = JagVorbis.ReadBits(8);
        const masks = new Int32Array(this.classes);
        for (let i = 0; i < this.classes; i++) {
            const low = JagVorbis.ReadBits(3),
                high = JagVorbis.ReadBit() !== 0 ? JagVorbis.ReadBits(5) : 0;
            masks[i] = (high << 3) | low;
        }
        this.books = new Int32Array(this.classes * 8);
        for (let i = 0; i < this.books.length; i++) this.books[i] = (masks[i >> 3] & (1 << (i & 7))) !== 0 ? JagVorbis.ReadBits(8) : -1;
    }
}
