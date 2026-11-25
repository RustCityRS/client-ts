import type Signlink from '#/util/Signlink';
import { requireNonNull } from '#/util/JavaArray';
import type NativeAudioDevice from './NativeAudioDevice';
import PCMPlayer from './PCMPlayer';
export default class NativePcmPlayer extends PCMPlayer {
    // qb.P:Lk;
    private static device: NativeAudioDevice | null = null;
    // qb.Q:I
    private readonly channel: number;
    // qb.<init>(Lfb;I)V
    constructor(signlink: Signlink | null, channel: number) {
        super();
        NativePcmPlayer.device = requireNonNull(signlink).getAudioDevice();
        this.channel = channel;
    }
    // qb.a(Ljava/awt/Component;)V
    override SubclassInit(component: object | null): void {
        requireNonNull(NativePcmPlayer.device).init(PCMPlayer.m_stereo, component, PCMPlayer.m_frequency);
    }
    // qb.b()V
    protected override DiscardBufferInner(): void {
        requireNonNull(NativePcmPlayer.device).flush(this.channel);
    }
    // qb.c(I)V
    override Open(capacity: number): void {
        if (capacity > 32768) throw new RangeError('PCM capacity exceeds 32768');
        requireNonNull(NativePcmPlayer.device).open(this.channel, capacity);
    }
    // qb.d()V
    protected override Close(): void {
        requireNonNull(NativePcmPlayer.device).close(this.channel);
    }
    // qb.a()I
    protected override AlreadyWritten(): number {
        return requireNonNull(NativePcmPlayer.device).position(this.channel);
    }
    // qb.c()V
    protected override write(): void {
        requireNonNull(NativePcmPlayer.device).write(this.channel, this.samples);
    }
    // qb.e()V
    static clear(): void {
        this.device = null;
    }
}
