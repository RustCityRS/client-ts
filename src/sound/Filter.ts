import type PacketT from '#/io/PacketT';
import { arrayAtI32, arrayAtObj, arrayPutI32 } from '#/util/JavaArray';
import { doubleToInt } from '#/util/IntUtils';
import type Envelope from './Envelope';

const f = Math.fround;
function poles(): Int32Array[][] {
    return Array.from({ length: 2 }, () => [new Int32Array(4), new Int32Array(4)]);
}

export default class Filter {
    // ub.a:[[I
    static coefficients: Int32Array[] | null = [new Int32Array(8), new Int32Array(8)];
    // ub.b:I
    static gain = 0;
    // ub.c:[[[I
    private magnitudes: Int32Array[][];
    // ub.d:F
    private static linearGain = 0;
    // ub.e:[[[I
    private frequencies = poles();
    // ub.f:[I
    private unity: Int32Array;
    // ub.g:[[F
    private static workspace: Float32Array[] | null = [new Float32Array(8), new Float32Array(8)];
    // ub.h:[I
    pairs: Int32Array;
    // ub.<init>()V
    constructor() {
        this.magnitudes = poles();
        this.unity = new Int32Array(2);
        this.pairs = new Int32Array(2);
    }
    // ub.a(IF)I
    compute(direction: number, t: number): number {
        t = f(t);
        if (direction === 0) {
            let value = f(this.unity[0] + f((this.unity[1] - this.unity[0]) * t));
            value = f(value * f(0.0030517578));
            Filter.linearGain = f(Math.pow(0.1, f(value / 20)));
            Filter.gain = doubleToInt(f(Filter.linearGain * 65536));
        }
        if (arrayAtI32(this.pairs, direction) === 0) return 0;
        let radius = this.amplitude(direction, 0, t);
        const row = arrayAtObj(Filter.workspace, direction);
        row[0] = f(-2 * radius) * f(Math.cos(this.phase(direction, 0, t)));
        row[1] = radius * radius;
        for (let pair = 1; pair < this.pairs[direction]; pair++) {
            radius = this.amplitude(direction, pair, t);
            const a = f(f(-2 * radius) * f(Math.cos(this.phase(direction, pair, t)))),
                b = f(radius * radius),
                end = pair * 2;
            row[end + 1] = row[end - 1] * b;
            row[end] = f(row[end - 1] * a) + f(row[end - 2] * b);
            for (let i = end - 1; i >= 2; i--) row[i] += f(f(row[i - 1] * a) + f(row[i - 2] * b));
            row[1] += f(f(row[0] * a) + b);
            row[0] += a;
        }
        if (direction === 0) for (let i = 0; i < this.pairs[0] * 2; i++) row[i] *= Filter.linearGain;
        for (let i = 0; i < this.pairs[direction] * 2; i++) arrayPutI32(arrayAtObj(Filter.coefficients, direction), i, doubleToInt(f(row[i] * 65536)));
        return this.pairs[direction] * 2;
    }
    // ub.a(Lgd;Leb;)V
    decode(p: PacketT, envelope: Envelope): void {
        const count = p.g1();
        this.pairs[0] = count >> 4;
        this.pairs[1] = count & 15;
        if (count === 0) {
            this.unity[0] = this.unity[1] = 0;
            return;
        }
        this.unity[0] = p.g2();
        this.unity[1] = p.g2();
        const mask = p.g1();
        for (let d = 0; d < 2; d++)
            for (let pair = 0; pair < this.pairs[d]; pair++) {
                arrayPutI32(this.frequencies[d][0], pair, p.g2());
                arrayPutI32(this.magnitudes[d][0], pair, p.g2());
            }
        for (let d = 0; d < 2; d++)
            for (let pair = 0; pair < this.pairs[d]; pair++) {
                if ((mask & (1 << (d * 4 + pair))) !== 0) {
                    arrayPutI32(this.frequencies[d][1], pair, p.g2());
                    arrayPutI32(this.magnitudes[d][1], pair, p.g2());
                } else {
                    arrayPutI32(this.frequencies[d][1], pair, arrayAtI32(this.frequencies[d][0], pair));
                    arrayPutI32(this.magnitudes[d][1], pair, arrayAtI32(this.magnitudes[d][0], pair));
                }
            }
        if (mask !== 0 || this.unity[1] !== this.unity[0]) envelope.LoadPoints(p);
    }
    // ub.a(IIF)F
    private amplitude(direction: number, pair: number, t: number): number {
        const low = arrayAtI32(this.magnitudes[direction][0], pair),
            high = arrayAtI32(this.magnitudes[direction][1], pair);
        let value = f(low + f(t * (high - low)));
        value = f(value * f(0.0015258789));
        return f(1 - f(Math.pow(10, f(-value / 20))));
    }
    // ub.a(F)F
    private static frequency(octave: number): number {
        const hz = f(f(32.703197) * f(Math.pow(2, octave)));
        return f(f(hz * f(Math.PI)) / 11025);
    }
    // ub.a()V
    static clear(): void {
        this.workspace = null;
        this.coefficients = null;
    }
    // ub.b(IIF)F
    private phase(direction: number, pair: number, t: number): number {
        const low = arrayAtI32(this.frequencies[direction][0], pair),
            high = arrayAtI32(this.frequencies[direction][1], pair);
        let value = f(low + f(t * (high - low)));
        value = f(value * f(1.2207031e-4));
        return Filter.frequency(value);
    }
}
