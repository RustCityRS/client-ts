import type PacketT from '#/io/PacketT';
import { arrayAtI32 } from '#/util/JavaArray';
import { intDivide, doubleToInt } from '#/util/IntUtils';

export default class Envelope {
    // eb.a:I
    start = 0;
    // eb.b:I
    form = 0;
    // eb.c:I
    end = 0;
    // eb.d:[I
    private peaks: Int32Array;
    // eb.e:I
    private length = 2;
    // eb.f:[I
    private durations = new Int32Array(2);
    // eb.g:I
    private amplitude = 0;
    // eb.h:I
    private threshold = 0;
    // eb.i:I
    private step = 0;
    // eb.j:I
    private segment = 0;
    // eb.k:I
    private ticks = 0;
    // eb.<init>()V
    constructor() {
        this.peaks = new Int32Array(2);
        this.durations[1] = 65535;
        this.peaks[1] = 65535;
    }
    // eb.a()V
    GenInit(): void {
        this.threshold = 0;
        this.segment = 0;
        this.step = 0;
        this.amplitude = 0;
        this.ticks = 0;
    }
    // eb.a(Lgd;)V
    Load(p: PacketT): void {
        this.form = p.g1();
        this.start = p.g4();
        this.end = p.g4();
        this.LoadPoints(p);
    }
    // eb.b(Lgd;)V
    LoadPoints(p: PacketT): void {
        this.length = p.g1();
        this.durations = new Int32Array(this.length);
        this.peaks = new Int32Array(this.length);
        for (let i = 0; i < this.length; i++) {
            this.durations[i] = p.g2();
            this.peaks[i] = p.g2();
        }
    }
    // eb.a(I)I
    GenNext(total: number): number {
        if (this.ticks >= this.threshold) {
            this.amplitude = arrayAtI32(this.peaks, this.segment++) << 15;
            if (this.segment >= this.length) this.segment = this.length - 1;
            this.threshold = doubleToInt((this.durations[this.segment] / 65536.0) * total);
            if (this.threshold > this.ticks) this.step = intDivide(((this.peaks[this.segment] << 15) - this.amplitude) | 0, (this.threshold - this.ticks) | 0);
        }
        this.amplitude = (this.amplitude + this.step) | 0;
        this.ticks = (this.ticks + 1) | 0;
        return (this.amplitude - this.step) >> 15;
    }
}
