interface NativeAudioDevice {
    // k.a(I[I)V
    write(channel: number, samples: Int32Array | null): void;
    // k.a(II)I
    position(channel: number): number;
    // k.a(BII)V
    open(channel: number, capacity: number): void;
    // k.b(II)V
    flush(channel: number): void;
    // k.c(II)V
    close(channel: number): void;
    // k.a(ZILjava/awt/Component;I)V
    init(stereo: boolean, component: object | null, rate: number): void;
}

export type { NativeAudioDevice as default };
