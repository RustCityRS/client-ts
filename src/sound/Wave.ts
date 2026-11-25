import PCMStreamable from './PCMStreamable';
import type Decimator from './Decimator';

export default class Wave extends PCMStreamable {
    // ji.r:[B
    samples: Int8Array | null;
    // ji.s:I
    loopStart: number;
    // ji.t:I
    rate: number;
    // ji.u:Z
    pingPong: boolean;
    // ji.v:I
    loopEnd: number;
    // ji.<init>(I[BII)V and ji.<init>(I[BIIZ)V
    constructor(rate: number, samples: Int8Array | null, start: number, end: number, pingPong = false) {
        super();
        this.rate = rate;
        this.samples = samples;
        this.loopStart = start;
        this.loopEnd = end;
        this.pingPong = pingPong;
    }
    // ji.a(Lhd;)Lji;
    Decimate(decimator: Decimator): Wave {
        this.samples = decimator.Decimate(this.samples);
        this.rate = decimator.TransmitFreq(this.rate);
        if (this.loopStart === this.loopEnd) this.loopStart = this.loopEnd = decimator.TransmitPos(this.loopStart);
        else {
            this.loopStart = decimator.TransmitPos(this.loopStart);
            this.loopEnd = decimator.TransmitPos(this.loopEnd);
            if (this.loopStart === this.loopEnd) this.loopStart = (this.loopStart - 1) | 0;
        }
        return this;
    }
}
