import type Js5 from '#/cache/Js5';
import PacketT from '#/io/PacketT';
import { loadTone } from '#/util/GamepackClasses';
import { arrayAtI32, arrayAtI8, arrayPutI8, requireNonNull } from '#/util/JavaArray';
import Wave from './Wave';
import type Tone from './Tone';

export default class JagFX {
    // vd.a:I
    private start = 0;
    // vd.b:[Lfj;
    private tones: (Tone | null)[] = new Array(10).fill(null);
    // vd.c:I
    private end = 0;
    // vd.<init>()V and vd.<init>(Lgd;)V
    private constructor(packet?: PacketT) {
        if (packet === undefined) return;
        for (let i = 0; i < 10; i++)
            if (packet.g1() !== 0) {
                packet.m_pos--;
                const Tone = loadTone();
                const tone = (this.tones[i] = new Tone());
                tone.decode(packet);
            }
        this.start = packet.g2();
        this.end = packet.g2();
    }
    // vd.a()I
    trimDelay(): number {
        let delay = 9999999;
        for (const tone of this.tones) if (tone !== null && ((tone.start / 20) | 0) < delay) delay = (tone.start / 20) | 0;
        if (this.start < this.end && ((this.start / 20) | 0) < delay) delay = (this.start / 20) | 0;
        if (delay === 9999999 || delay === 0) return 0;
        for (const tone of this.tones) if (tone !== null) tone.start = (tone.start - Math.imul(delay, 20)) | 0;
        if (this.start < this.end) {
            this.start = (this.start - Math.imul(delay, 20)) | 0;
            this.end = (this.end - Math.imul(delay, 20)) | 0;
        }
        return delay;
    }
    // vd.b()Lji;
    toPcm(): Wave {
        return new Wave(22050, this.mix(), (Math.imul(22050, this.start) / 1000) | 0, (Math.imul(22050, this.end) / 1000) | 0);
    }
    // vd.c()[B
    private mix(): Int8Array {
        let millis = 0;
        for (const tone of this.tones) if (tone !== null && ((tone.duration + tone.start) | 0) > millis) millis = (tone.duration + tone.start) | 0;
        if (millis === 0) return new Int8Array(0);
        const output = new Int8Array((Math.imul(22050, millis) / 1000) | 0);
        for (const tone of this.tones)
            if (tone !== null) {
                const count = (Math.imul(tone.duration, 22050) / 1000) | 0,
                    start = (Math.imul(tone.start, 22050) / 1000) | 0;
                const samples = tone.generate(count, tone.duration);
                for (let i = 0; i < count; i++) {
                    const j = (i + start) | 0;
                    let v = arrayAtI8(output, j) + (arrayAtI32(samples, i) >> 8);
                    if (((v + 128) & -256) !== 0) v = (v >> 31) ^ 127;
                    arrayPutI8(output, j, v);
                }
            }
        return output;
    }
    // vd.a(Lal;II)Lvd;
    static load(archive: Js5 | null, group: number, file: number): JagFX | null {
        const bytes = requireNonNull(archive).GetFile(file, group);
        return bytes === null ? null : new JagFX(new PacketT(bytes));
    }
}
