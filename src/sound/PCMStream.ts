import Linkable from '#/datastruct/Linkable';
import type PCMStreamable from './PCMStreamable';

export default abstract class PCMStream extends Linkable {
    // jj.q:Z
    active = true;
    // jj.r:Lkd;
    sound: PCMStreamable | null = null;
    // jj.s:Ljj;
    nextStream: PCMStream | null = null;
    // jj.t:I
    schedulerWeight = 0;
    // jj.<init>()V
    constructor() {
        super();
    }
    // jj.a()Ljj;
    abstract SubstreamStart(): PCMStream | null;
    // jj.a(I)V
    abstract PretendToMix(count: number): void;
    // jj.b()Ljj;
    abstract SubstreamNext(): PCMStream | null;
    // jj.a([III)V
    MaybeMix(buffer: Int32Array | null, offset: number, count: number): void {
        if (this.active) this.DoMix(buffer, offset, count);
        else this.PretendToMix(count);
    }
    // jj.c()I
    Priority(): number {
        return 255;
    }
    // jj.b([III)V
    abstract DoMix(buffer: Int32Array | null, offset: number, count: number): void;
    // jj.d()I
    abstract SelfMixCost(): number;
}
