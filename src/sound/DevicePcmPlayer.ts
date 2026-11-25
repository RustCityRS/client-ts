import PCMPlayer from './PCMPlayer';
import { JavaCheckedException } from '#/util/JavaException';
import { arrayAtI32, arrayPutU8, requireNonNull } from '#/util/JavaArray';
import { bitCeil, bitCount } from '#/util/IntUtils';

// javax.sound.sampled.SourceDataLine, limited to the operations used by ua.
export interface PcmLine {
    available(): number;
    open(): void;
    start(): void;
    close(): void;
    flush(): void;
    write(bytes: Uint8Array | null, offset: number, length: number): void;
}

export interface PcmFormat {
    rate: number;
    channels: number;
    bits: number;
    signed: boolean;
    bigEndian: boolean;
}

// javax.sound.sampled.AudioSystem is supplied by the host.
export interface AudioDevice {
    getMixerNames(): (string | null)[] | null;
    getLine(format: PcmFormat | null, capacityBytes: number): PcmLine;
}
export class LineUnavailableError extends JavaCheckedException {}

export default class DevicePcmPlayer extends PCMPlayer {
    // Browser implementation of javax.sound.sampled.AudioSystem.
    static audioSystem: AudioDevice | null = null;

    // ua.P:Z
    private soundMax = false;
    // ua.Q:I
    private lineCapacity = 0;
    // ua.R:Ljavax/sound/sampled/AudioFormat;
    private format: PcmFormat | null = null;
    // ua.S:Ljavax/sound/sampled/SourceDataLine;
    private line: PcmLine | null = null;
    // ua.T:[B
    private bytes: Uint8Array | null = null;
    // ua.<init>()V. The JVM obtains AudioSystem through static calls.
    constructor() {
        super();
    }

    // ua.a()I
    protected override AlreadyWritten(): number {
        return (this.lineCapacity - (requireNonNull(this.line).available() >> (PCMPlayer.m_stereo ? 2 : 1))) | 0;
    }
    // ua.c(I)V
    override Open(capacity: number): void {
        try {
            this.line = requireNonNull(DevicePcmPlayer.audioSystem).getLine(this.format, capacity << (PCMPlayer.m_stereo ? 2 : 1));
            this.line.open();
            this.line.start();
            this.lineCapacity = capacity;
        } catch (e) {
            if (!(e instanceof LineUnavailableError)) throw e;
            if (bitCount(capacity) !== 1) this.Open(bitCeil(capacity));
            else {
                this.line = null;
                throw e;
            }
        }
    }
    // ua.a(Ljava/awt/Component;)V
    override SubclassInit(_component: object | null): void {
        const mixers = requireNonNull(DevicePcmPlayer.audioSystem).getMixerNames();
        if (mixers !== null) for (const name of mixers) if (name !== null && name.toLowerCase().includes('soundmax')) this.soundMax = true;
        this.format = { rate: PCMPlayer.m_frequency, bits: 16, channels: PCMPlayer.m_stereo ? 2 : 1, signed: true, bigEndian: false };
        this.bytes = new Uint8Array(256 << (PCMPlayer.m_stereo ? 2 : 1));
    }
    // ua.d()V
    protected override Close(): void {
        if (this.line !== null) {
            this.line.close();
            this.line = null;
        }
    }
    // ua.b()V
    protected override DiscardBufferInner(): void {
        requireNonNull(this.line).flush();
        if (this.soundMax) {
            requireNonNull(this.line).close();
            this.line = null;
            this.line = requireNonNull(DevicePcmPlayer.audioSystem).getLine(this.format, this.lineCapacity << (PCMPlayer.m_stereo ? 2 : 1));
            this.line.open();
            this.line.start();
        }
    }
    // ua.c()V
    protected override write(): void {
        const count = PCMPlayer.m_stereo ? 512 : 256;
        for (let i = 0; i < count; i++) {
            let value = arrayAtI32(this.samples, i);
            if (((value + 8388608) & 0xff000000) !== 0) value = 8388607 ^ (value >> 31);
            arrayPutU8(this.bytes, i * 2, value >> 8);
            arrayPutU8(this.bytes, i * 2 + 1, value >> 16);
        }
        requireNonNull(this.line).write(this.bytes, 0, count << 1);
    }
}
