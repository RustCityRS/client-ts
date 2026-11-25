import { arrayAtI32, requireNonNull } from '#/util/JavaArray';
// ij in the revision 530 SD gamepack. The three initialization loops preserve
// the order of the integer stores in ij.b(int).
export default class Isaac {
    private remaining = 0; // ij.c:I
    private readonly memory: Int32Array | null = null; // ij.f:[I
    private counter = 0; // ij.h:I
    private readonly results: Int32Array | null = null; // ij.k:[I
    private accumulator = 0; // ij.m:I
    private lastResult = 0; // ij.n:I

    // ij.<init>([I)V
    constructor(seed: Int32Array);
    constructor(seed?: Int32Array) {
        // ij.<init>()V is private and leaves both arrays null.
        if (arguments.length === 0) return;
        this.results = new Int32Array(256);
        this.memory = new Int32Array(256);
        const words = requireNonNull(seed);
        for (let i = 0; i < words.length; i++) {
            if (i >= this.results.length) throw new RangeError('ISAAC seed exceeds 256 words');
            this.results[i] = words[i];
        }
        this.Init();
    }

    // ij.a(I)V
    private Generate(): void {
        this.counter = (this.counter + 1) | 0;
        this.lastResult = (this.lastResult + this.counter) | 0;
        const memory = requireNonNull(this.memory);
        for (let index = 0; index < 256; index++) {
            const previous = memory[index];
            if ((index & 2) === 0) {
                if ((index & 1) !== 0) this.accumulator ^= this.accumulator >>> 6;
                else this.accumulator ^= this.accumulator << 13;
            } else if ((index & 1) !== 0) {
                this.accumulator ^= this.accumulator >>> 16;
            } else {
                this.accumulator ^= this.accumulator << 2;
            }
            this.accumulator = (this.accumulator + memory[(index + 128) & 255]) | 0;
            const value = (this.accumulator + memory[(previous & 1020) >> 2] + this.lastResult) | 0;
            memory[index] = value;
            this.lastResult = (memory[((value >> 8) >> 2) & 255] + previous) | 0;
            requireNonNull(this.results)[index] = this.lastResult;
        }
    }

    // ij.b(I)V
    private Init(): void {
        const results = requireNonNull(this.results);
        const memory = requireNonNull(this.memory);
        let h = -1640531527;
        let g = -1640531527;
        let f = -1640531527;
        let e = -1640531527;
        let d = -1640531527;
        let c = -1640531527;
        let b = -1640531527;
        let a = -1640531527;

        for (let index = 0; index < 4; index++) {
            a ^= b << 11;
            b = (b + c) | 0;
            d = (d + a) | 0;
            b ^= c >>> 2;
            e = (e + b) | 0;
            c = (c + d) | 0;
            c ^= d << 8;
            f = (f + c) | 0;
            d = (d + e) | 0;
            d ^= e >>> 16;
            e = (e + f) | 0;
            e ^= f << 10;
            h = (h + e) | 0;
            g = (g + d) | 0;
            f = (f + g) | 0;
            f ^= g >>> 4;
            g = (g + h) | 0;
            g ^= h << 8;
            a = (a + f) | 0;
            h = (h + a) | 0;
            h ^= a >>> 9;
            c = (c + h) | 0;
            b = (b + g) | 0;
            a = (a + b) | 0;
        }

        for (let index = 0; index < 256; index += 8) {
            b = (b + results[index + 1]) | 0;
            f = (f + results[index + 5]) | 0;
            c = (c + results[index + 2]) | 0;
            a = (a + results[index]) | 0;
            d = (d + results[index + 3]) | 0;
            h = (h + results[index + 7]) | 0;
            g = (g + results[index + 6]) | 0;
            a ^= b << 11;
            b = (b + c) | 0;
            e = (e + results[index + 4]) | 0;
            d = (d + a) | 0;
            b ^= c >>> 2;
            c = (c + d) | 0;
            c ^= d << 8;
            e = (e + b) | 0;
            f = (f + c) | 0;
            d = (d + e) | 0;
            d ^= e >>> 16;
            e = (e + f) | 0;
            e ^= f << 10;
            h = (h + e) | 0;
            g = (g + d) | 0;
            f = (f + g) | 0;
            f ^= g >>> 4;
            a = (a + f) | 0;
            g = (g + h) | 0;
            g ^= h << 8;
            b = (b + g) | 0;
            h = (h + a) | 0;
            h ^= a >>> 9;
            c = (c + h) | 0;
            a = (a + b) | 0;
            memory[index] = a;
            memory[index + 1] = b;
            memory[index + 2] = c;
            memory[index + 3] = d;
            memory[index + 4] = e;
            memory[index + 5] = f;
            memory[index + 6] = g;
            memory[index + 7] = h;
        }

        for (let index = 0; index < 256; index += 8) {
            c = (c + memory[index + 2]) | 0;
            b = (b + memory[index + 1]) | 0;
            h = (h + memory[index + 7]) | 0;
            g = (g + memory[index + 6]) | 0;
            f = (f + memory[index + 5]) | 0;
            d = (d + memory[index + 3]) | 0;
            a = (a + memory[index]) | 0;
            e = (e + memory[index + 4]) | 0;
            a ^= b << 11;
            d = (d + a) | 0;
            b = (b + c) | 0;
            b ^= c >>> 2;
            e = (e + b) | 0;
            c = (c + d) | 0;
            c ^= d << 8;
            d = (d + e) | 0;
            f = (f + c) | 0;
            d ^= e >>> 16;
            e = (e + f) | 0;
            g = (g + d) | 0;
            e ^= f << 10;
            h = (h + e) | 0;
            f = (f + g) | 0;
            f ^= g >>> 4;
            a = (a + f) | 0;
            g = (g + h) | 0;
            g ^= h << 8;
            b = (b + g) | 0;
            h = (h + a) | 0;
            h ^= a >>> 9;
            a = (a + b) | 0;
            memory[index] = a;
            memory[index + 1] = b;
            c = (c + h) | 0;
            memory[index + 2] = c;
            memory[index + 3] = d;
            memory[index + 4] = e;
            memory[index + 5] = f;
            memory[index + 6] = g;
            memory[index + 7] = h;
        }

        this.Generate();
        this.remaining = 256;
    }

    // ij.b(B)I
    TakeNextValue(): number {
        if (this.remaining-- === 0) {
            this.Generate();
            this.remaining = 255;
        }
        return arrayAtI32(this.results, this.remaining);
    }
}
