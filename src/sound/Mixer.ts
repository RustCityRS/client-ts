import Linkable from '#/datastruct/Linkable';
import SharedPtrList from '#/datastruct/SharedPtrList';
import { requireNonNull } from '#/util/JavaArray';
import PCMStream from './PCMStream';
import MixerController from './MixerController';

export default class Mixer extends PCMStream {
    // cj.u:Lgk;
    private readonly streams = new SharedPtrList<PCMStream>();
    // cj.v:Lgk;
    private readonly listeners = new SharedPtrList<MixerController>();
    // cj.w:I
    private processed: number;
    // cj.x:I
    private untilListener = -1;
    // cj.<init>()V
    constructor() {
        super();
        this.processed = 0;
    }
    // cj.a(Lbg;)V
    private UnlinkController(listener: MixerController): void {
        listener.Unlink();
        listener.remove();
        const first = this.listeners.sentinel.next;
        this.untilListener = first === this.listeners.sentinel ? -1 : requireNonNull(first as MixerController | null).remaining;
    }
    // cj.d()I
    SelfMixCost(): number {
        return 0;
    }
    // cj.b([III)V
    DoMix(buffer: Int32Array | null, offset: number, count: number): void {
        while (this.untilListener >= 0) {
            if (((this.processed + count) | 0) < this.untilListener) {
                this.processed = (this.processed + count) | 0;
                this.Mix2(buffer, offset, count);
                return;
            }
            const n = (this.untilListener - this.processed) | 0;
            this.Mix2(buffer, offset, n);
            offset = (offset + n) | 0;
            count = (count - n) | 0;
            this.processed = (this.processed + n) | 0;
            this.FixMixerWait();
            const l = requireNonNull(this.listeners.head());
            const next = l.update(this);
            if (next < 0) {
                l.remaining = 0;
                this.UnlinkController(l);
            } else {
                l.remaining = next;
                this.SortController(requireNonNull(l.next), l);
            }
            if (count === 0) return;
        }
        this.Mix2(buffer, offset, count);
    }
    // pg.a(Ljf;Ljf;I)V
    private static insertBefore(node: Linkable, position: Linkable): void {
        if (node.prev !== null) node.Unlink();
        node.prev = position.prev;
        node.next = position;
        requireNonNull(node.prev).next = node;
        node.next.prev = node;
    }
    // cj.a(Ljf;Lbg;)V
    private SortController(position: Linkable, listener: MixerController): void {
        while (position !== this.listeners.sentinel && (position as MixerController).remaining <= listener.remaining) position = requireNonNull(position.next);
        Mixer.insertBefore(listener, position);
        this.untilListener = requireNonNull(this.listeners.sentinel.next as MixerController | null).remaining;
    }
    // cj.b(I)V
    private PretendToMix2(count: number): void {
        for (let s = this.streams.head(); s !== null; s = this.streams.next()) s.PretendToMix(count);
    }
    // cj.a(Ljj;)V
    PlayStream(stream: PCMStream): void {
        this.streams.push_front(stream);
    }
    // cj.b(Ljj;)V
    StopStream(stream: PCMStream): void {
        stream.Unlink();
    }
    // cj.a()Ljj;
    SubstreamStart(): PCMStream | null {
        return this.streams.head();
    }
    // cj.b()Ljj;
    SubstreamNext(): PCMStream | null {
        return this.streams.next();
    }
    // cj.c([III)V
    private Mix2(buffer: Int32Array | null, offset: number, count: number): void {
        for (let s = this.streams.head(); s !== null; s = this.streams.next()) s.MaybeMix(buffer, offset, count);
    }
    // cj.e()V
    private FixMixerWait(): void {
        if (this.processed > 0) {
            for (let l = this.listeners.head(); l !== null; l = this.listeners.next()) l.remaining = (l.remaining - this.processed) | 0;
            this.untilListener = (this.untilListener - this.processed) | 0;
            this.processed = 0;
        }
    }
    // cj.a(I)V
    PretendToMix(count: number): void {
        while (this.untilListener >= 0) {
            if (((this.processed + count) | 0) < this.untilListener) {
                this.processed = (this.processed + count) | 0;
                this.PretendToMix2(count);
                return;
            }
            const n = (this.untilListener - this.processed) | 0;
            this.PretendToMix2(n);
            count = (count - n) | 0;
            this.processed = (this.processed + n) | 0;
            this.FixMixerWait();
            const l = requireNonNull(this.listeners.head());
            const next = l.update(this);
            if (next < 0) {
                l.remaining = 0;
                this.UnlinkController(l);
            } else {
                l.remaining = next;
                this.SortController(requireNonNull(l.next), l);
            }
            if (count === 0) return;
        }
        this.PretendToMix2(count);
    }
}
