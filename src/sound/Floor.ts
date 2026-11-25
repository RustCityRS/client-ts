import { arrayAtF32, arrayAtI32, arrayAtObj, arrayPutF32, arrayPutI32, arrayPutObj } from '#/util/JavaArray';
import { bitLength, intDivide } from '#/util/IntUtils';
import JagVorbis from './JagVorbis';

export default class Floor {
    // lb.a:[I
    private static ranges: Int32Array | null = Int32Array.of(256, 128, 86, 64);
    // lb.b:[I
    private masterbooks: Int32Array;
    // lb.c:[I
    private dimensions: Int32Array;
    // lb.d:[I
    private static ys: Int32Array | null = null;
    // lb.e:[Z
    private static enabled: boolean[] | null = null;
    // lb.f:[F
    private static inverseDb: Float32Array | null = Float32Array.of(
        1.0649863e-7,
        1.1341951e-7,
        1.2079015e-7,
        1.2863978e-7,
        1.369995e-7,
        1.459025e-7,
        1.5538409e-7,
        1.6548181e-7,
        1.7623574e-7,
        1.8768856e-7,
        1.998856e-7,
        2.128753e-7,
        2.2670913e-7,
        2.4144197e-7,
        2.5713223e-7,
        2.7384212e-7,
        2.9163792e-7,
        3.1059022e-7,
        3.307741e-7,
        3.5226967e-7,
        3.7516213e-7,
        3.995423e-7,
        4.255068e-7,
        4.5315863e-7,
        4.8260745e-7,
        5.1397e-7,
        5.4737063e-7,
        5.829419e-7,
        6.208247e-7,
        6.611694e-7,
        7.041359e-7,
        7.4989464e-7,
        7.98627e-7,
        8.505263e-7,
        9.057983e-7,
        9.646621e-7,
        1.0273513e-6,
        1.0941144e-6,
        1.1652161e-6,
        1.2409384e-6,
        1.3215816e-6,
        1.4074654e-6,
        1.4989305e-6,
        1.5963394e-6,
        1.7000785e-6,
        1.8105592e-6,
        1.9282195e-6,
        2.053526e-6,
        2.1869757e-6,
        2.3290977e-6,
        2.4804558e-6,
        2.6416496e-6,
        2.813319e-6,
        2.9961443e-6,
        3.1908505e-6,
        3.39821e-6,
        3.619045e-6,
        3.8542307e-6,
        4.1047006e-6,
        4.371447e-6,
        4.6555283e-6,
        4.958071e-6,
        5.280274e-6,
        5.623416e-6,
        5.988857e-6,
        6.3780467e-6,
        6.7925284e-6,
        7.2339453e-6,
        7.704048e-6,
        8.2047e-6,
        8.737888e-6,
        9.305725e-6,
        9.910464e-6,
        1.0554501e-5,
        1.1240392e-5,
        1.1970856e-5,
        1.2748789e-5,
        1.3577278e-5,
        1.4459606e-5,
        1.5399271e-5,
        1.6400005e-5,
        1.7465769e-5,
        1.8600793e-5,
        1.9809577e-5,
        2.1096914e-5,
        2.2467912e-5,
        2.3928002e-5,
        2.5482977e-5,
        2.7139005e-5,
        2.890265e-5,
        3.078091e-5,
        3.2781227e-5,
        3.4911533e-5,
        3.718028e-5,
        3.9596467e-5,
        4.2169668e-5,
        4.491009e-5,
        4.7828602e-5,
        5.0936775e-5,
        5.424693e-5,
        5.7772202e-5,
        6.152657e-5,
        6.552491e-5,
        6.9783084e-5,
        7.4317984e-5,
        7.914758e-5,
        8.429104e-5,
        8.976875e-5,
        9.560242e-5,
        1.0181521e-4,
        1.0843174e-4,
        1.1547824e-4,
        1.2298267e-4,
        1.3097477e-4,
        1.3948625e-4,
        1.4855085e-4,
        1.5820454e-4,
        1.6848555e-4,
        1.7943469e-4,
        1.9109536e-4,
        2.0351382e-4,
        2.167393e-4,
        2.3082423e-4,
        2.4582449e-4,
        2.6179955e-4,
        2.7881275e-4,
        2.9693157e-4,
        3.1622787e-4,
        3.3677815e-4,
        3.5866388e-4,
        3.8197188e-4,
        4.0679457e-4,
        4.3323037e-4,
        4.613841e-4,
        4.913675e-4,
        5.2329927e-4,
        5.573062e-4,
        5.935231e-4,
        6.320936e-4,
        6.731706e-4,
        7.16917e-4,
        7.635063e-4,
        8.1312325e-4,
        8.6596457e-4,
        9.2223985e-4,
        9.821722e-4,
        0.0010459992,
        0.0011139743,
        0.0011863665,
        0.0012634633,
        0.0013455702,
        0.0014330129,
        0.0015261382,
        0.0016253153,
        0.0017309374,
        0.0018434235,
        0.0019632196,
        0.0020908006,
        0.0022266726,
        0.0023713743,
        0.0025254795,
        0.0026895993,
        0.0028643848,
        0.0030505287,
        0.003248769,
        0.0034598925,
        0.0036847359,
        0.0039241905,
        0.0041792067,
        0.004450795,
        0.004740033,
        0.005048067,
        0.0053761187,
        0.005725489,
        0.0060975635,
        0.0064938175,
        0.0069158226,
        0.0073652514,
        0.007843887,
        0.008353627,
        0.008896492,
        0.009474637,
        0.010090352,
        0.01074608,
        0.011444421,
        0.012188144,
        0.012980198,
        0.013823725,
        0.014722068,
        0.015678791,
        0.016697686,
        0.017782796,
        0.018938422,
        0.020169148,
        0.021479854,
        0.022875736,
        0.02436233,
        0.025945531,
        0.027631618,
        0.029427277,
        0.031339627,
        0.03337625,
        0.035545226,
        0.037855156,
        0.0403152,
        0.042935107,
        0.045725275,
        0.048696756,
        0.05186135,
        0.05523159,
        0.05882085,
        0.062643364,
        0.06671428,
        0.07104975,
        0.075666964,
        0.08058423,
        0.08582105,
        0.09139818,
        0.097337745,
        0.1036633,
        0.11039993,
        0.11757434,
        0.12521498,
        0.13335215,
        0.14201812,
        0.15124726,
        0.16107617,
        0.1715438,
        0.18269168,
        0.19456401,
        0.20720787,
        0.22067343,
        0.23501402,
        0.25028655,
        0.26655158,
        0.28387362,
        0.3023213,
        0.32196787,
        0.34289113,
        0.36517414,
        0.3889052,
        0.41417846,
        0.44109413,
        0.4697589,
        0.50028646,
        0.53279793,
        0.5674221,
        0.6042964,
        0.64356697,
        0.6853896,
        0.72993004,
        0.777365,
        0.8278826,
        0.88168305,
        0.9389798,
        1.0
    );
    // lb.g:[I
    private static xs: Int32Array | null = null;
    // lb.h:[I
    private partitions: Int32Array;
    // lb.i:I
    private multiplier: number;
    // lb.j:[I
    private subclasses: Int32Array;
    // lb.k:[[I
    private books: Int32Array[];
    // lb.l:[I
    private xList: Int32Array;
    // lb.a(IIIII)I
    private predict(x0: number, y0: number, x1: number, y1: number, x: number): number {
        const dy = (y1 - y0) | 0,
            dx = (x1 - x0) | 0;
        const offset = intDivide(Math.imul(dy < 0 ? -dy : dy, (x - x0) | 0), dx);
        return dy < 0 ? (y0 - offset) | 0 : (y0 + offset) | 0;
    }
    // lb.a()Z
    decode(): boolean {
        if (JagVorbis.ReadBit() === 0) return false;
        const c = Floor;
        for (let i = 0; i < this.xList.length; i++) arrayPutI32(c.xs, i, this.xList[i]);
        const bits = bitLength(arrayAtI32(c.ranges, this.multiplier - 1) - 1);
        arrayPutI32(c.ys, 0, JagVorbis.ReadBits(bits));
        arrayPutI32(c.ys, 1, JagVorbis.ReadBits(bits));
        let index = 2;
        for (const partition of this.partitions) {
            const n = arrayAtI32(this.dimensions, partition),
                subclass = arrayAtI32(this.subclasses, partition),
                mask = (1 << subclass) - 1;
            let value = subclass > 0 ? arrayAtObj(JagVorbis.m_codebook, arrayAtI32(this.masterbooks, partition)).scalar() : 0;
            for (let j = 0; j < n; j++) {
                const book = arrayAtI32(arrayAtObj(this.books, partition), value & mask);
                value >>>= subclass;
                arrayPutI32(c.ys, index++, book >= 0 ? arrayAtObj(JagVorbis.m_codebook, book).scalar() : 0);
            }
        }
        return true;
    }
    // lb.a(II)V
    private sort(low: number, high: number): void {
        if (low >= high) return;
        const c = Floor;
        let pivot = low;
        const x = arrayAtI32(c.xs, low),
            y = arrayAtI32(c.ys, low),
            enabled = arrayAtObj(c.enabled, low);
        for (let i = low + 1; i <= high; i++) {
            const next = arrayAtI32(c.xs, i);
            if (next < x) {
                arrayPutI32(c.xs, pivot, next);
                arrayPutI32(c.ys, pivot, arrayAtI32(c.ys, i));
                arrayPutObj(c.enabled, pivot, arrayAtObj(c.enabled, i));
                arrayPutI32(c.xs, i, arrayAtI32(c.xs, ++pivot));
                arrayPutI32(c.ys, i, arrayAtI32(c.ys, pivot));
                arrayPutObj(c.enabled, i, arrayAtObj(c.enabled, pivot));
            }
        }
        arrayPutI32(c.xs, pivot, x);
        arrayPutI32(c.ys, pivot, y);
        arrayPutObj(c.enabled, pivot, enabled);
        this.sort(low, pivot - 1);
        this.sort(pivot + 1, high);
    }
    // lb.b()V
    static clear(): void {
        this.ranges = null;
        this.inverseDb = null;
        this.xs = null;
        this.ys = null;
        this.enabled = null;
    }
    // lb.a(IIII[FI)V
    private line(x0: number, y0: number, x1: number, y1: number, output: Float32Array | null, n: number): void {
        const dy = (y1 - y0) | 0,
            dx = (x1 - x0) | 0,
            base = intDivide(dy, dx);
        let y = y0,
            error = 0;
        const step = dy < 0 ? (base - 1) | 0 : (base + 1) | 0;
        const remainder = ((dy < 0 ? -dy : dy) - Math.imul(base < 0 ? -base : base, dx)) | 0;
        arrayPutF32(output, x0, arrayAtF32(output, x0) * arrayAtF32(Floor.inverseDb, y0));
        if (x1 > n) x1 = n;
        for (let x = x0 + 1; x < x1; x++) {
            error = (error + remainder) | 0;
            if (error >= dx) {
                error = (error - dx) | 0;
                y = (y + step) | 0;
            } else y = (y + base) | 0;
            arrayPutF32(output, x, arrayAtF32(output, x) * arrayAtF32(Floor.inverseDb, y));
        }
    }
    // lb.a([FI)V
    apply(output: Float32Array | null, n: number): void {
        const c = Floor,
            length = this.xList.length,
            range = arrayAtI32(c.ranges, this.multiplier - 1);
        arrayPutObj(c.enabled, 1, true);
        arrayPutObj(c.enabled, 0, true);
        for (let i = 2; i < length; i++) {
            const low = c.lowNeighbor(c.xs, i),
                high = c.highNeighbor(c.xs, i);
            const predicted = this.predict(arrayAtI32(c.xs, low), arrayAtI32(c.ys, low), arrayAtI32(c.xs, high), arrayAtI32(c.ys, high), arrayAtI32(c.xs, i));
            const y = arrayAtI32(c.ys, i),
                room = range - predicted,
                inside = Math.min(room, predicted) << 1;
            if (y !== 0) {
                arrayPutObj(c.enabled, high, true);
                arrayPutObj(c.enabled, low, true);
                arrayPutObj(c.enabled, i, true);
                if (y >= inside) arrayPutI32(c.ys, i, room > predicted ? y : predicted - y + room - 1);
                else arrayPutI32(c.ys, i, (y & 1) !== 0 ? predicted - intDivide(y + 1, 2) : predicted + intDivide(y, 2));
            } else {
                arrayPutObj(c.enabled, i, false);
                arrayPutI32(c.ys, i, predicted);
            }
        }
        this.sort(0, length - 1);
        let x0 = 0,
            y0 = Math.imul(arrayAtI32(c.ys, 0), this.multiplier);
        for (let i = 1; i < length; i++) {
            if (arrayAtObj(c.enabled, i)) {
                const x = arrayAtI32(c.xs, i),
                    y = Math.imul(arrayAtI32(c.ys, i), this.multiplier);
                this.line(x0, y0, x, y, output, n);
                if (x >= n) return;
                x0 = x;
                y0 = y;
            }
        }
        const scale = arrayAtF32(c.inverseDb, y0);
        for (let i = x0; i < n; i++) arrayPutF32(output, i, arrayAtF32(output, i) * scale);
    }
    // lb.a([II)I
    private static lowNeighbor(xs: Int32Array | null, index: number): number {
        const x = arrayAtI32(xs, index);
        let at = -1,
            max = -2147483648;
        for (let i = 0; i < index; i++) {
            const value = arrayAtI32(xs, i);
            if (value < x && value > max) {
                at = i;
                max = value;
            }
        }
        return at;
    }
    // lb.b([II)I
    private static highNeighbor(xs: Int32Array | null, index: number): number {
        const x = arrayAtI32(xs, index);
        let at = -1,
            min = 2147483647;
        for (let i = 0; i < index; i++) {
            const value = arrayAtI32(xs, i);
            if (value > x && value < min) {
                at = i;
                min = value;
            }
        }
        return at;
    }
    // lb.<init>()V
    constructor() {
        if (JagVorbis.ReadBits(16) !== 1) throw new Error('Invalid floor type');
        const count = JagVorbis.ReadBits(5);
        this.partitions = new Int32Array(count);
        let classes = 0;
        for (let i = 0; i < count; i++) {
            const id = JagVorbis.ReadBits(4);
            this.partitions[i] = id;
            if (id >= classes) classes = id + 1;
        }
        this.dimensions = new Int32Array(classes);
        this.subclasses = new Int32Array(classes);
        this.masterbooks = new Int32Array(classes);
        this.books = new Array(classes);
        for (let i = 0; i < classes; i++) {
            this.dimensions[i] = JagVorbis.ReadBits(3) + 1;
            const bits = (this.subclasses[i] = JagVorbis.ReadBits(2));
            if (bits !== 0) this.masterbooks[i] = JagVorbis.ReadBits(8);
            const row = (this.books[i] = new Int32Array(1 << bits));
            for (let j = 0; j < row.length; j++) row[j] = JagVorbis.ReadBits(8) - 1;
        }
        this.multiplier = JagVorbis.ReadBits(2) + 1;
        const bits = JagVorbis.ReadBits(4);
        let size = 2;
        for (const id of this.partitions) size += this.dimensions[id];
        this.xList = new Int32Array(size);
        this.xList[0] = 0;
        this.xList[1] = 1 << bits;
        let index = 2;
        for (const id of this.partitions) for (let j = 0; j < this.dimensions[id]; j++) this.xList[index++] = JagVorbis.ReadBits(bits);
        if (Floor.xs === null || Floor.xs.length < index) {
            Floor.xs = new Int32Array(index);
            Floor.ys = new Int32Array(index);
            Floor.enabled = new Array(index).fill(false);
        }
    }
}
