import PacketT from '#/io/PacketT';
import { byteAt } from '#/io/JavaByteArray';
import { arrayAtI32, arrayAtI8, arrayPutI32, requireNonNull } from '#/util/JavaArray';

export default class MidiParser {
    // el.a:[B
    private static m_msgLen: Int8Array | null = Int8Array.of(
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        1,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        2,
        0,
        1,
        2,
        1,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0
    );
    // el.b:Lgd;
    private readonly packet = new PacketT(null);
    // el.c:[I
    private starts: Int32Array | null = null;
    // el.d:I
    private tempo = 0;
    // el.e:[I
    private positions: Int32Array | null = null;
    // el.f:[I
    ticks: Int32Array | null = null;
    // el.g:I
    division = 0;
    // el.h:[I
    private statuses: Int32Array | null = null;
    // el.i:J
    private time = 0n;
    // el.a(I)J
    TimeFromTick(ticks: number): bigint {
        return BigInt.asIntN(64, this.time + BigInt(ticks) * BigInt(this.tempo));
    }
    // el.a()V
    FinishTrack(): void {
        this.packet.m_pos = -1;
    }
    // el.b()V
    DropMidi(): void {
        this.packet.m_data = null;
        this.starts = null;
        this.positions = null;
        this.ticks = null;
        this.statuses = null;
    }
    // el.c()V
    static unload(): void {
        this.m_msgLen = null;
    }
    // el.a(II)I
    private GetEvent3(track: number, status: number): number {
        const p = this.packet;
        if (status === 255) {
            const kind = p.g1();
            let len = p.gMidiVarLen();
            if (kind === 47) {
                p.m_pos = (p.m_pos + len) | 0;
                return 1;
            }
            if (kind === 81) {
                const tempo = p.g3();
                len = (len - 3) | 0;
                this.time = BigInt.asIntN(64, this.time + BigInt(arrayAtI32(this.ticks, track)) * BigInt((this.tempo - tempo) | 0));
                this.tempo = tempo;
                p.m_pos = (p.m_pos + len) | 0;
                return 2;
            }
            p.m_pos = (p.m_pos + len) | 0;
            return 3;
        }
        const count = arrayAtI8(MidiParser.m_msgLen, status - 128);
        let value = status;
        if (count >= 1) value = status | (p.g1() << 8);
        if (count >= 2) value |= p.g1() << 16;
        return value;
    }
    // el.b(I)V
    ProcessDeltaTime(track: number): void {
        const delta = this.packet.gMidiVarLen();
        arrayPutI32(this.ticks, track, arrayAtI32(this.ticks, track) + delta);
    }
    // el.d()I
    NumTracks(): number {
        return requireNonNull(this.positions).length;
    }
    // el.e()Z
    AllTracksFinished(): boolean {
        for (const position of requireNonNull(this.positions)) if (position >= 0) return false;
        return true;
    }
    // el.f()Z
    GotMidi(): boolean {
        return this.packet.m_data !== null;
    }
    // el.c(I)V
    UnsetTrack(track: number): void {
        arrayPutI32(this.positions, track, this.packet.m_pos);
    }
    // el.d(I)I
    private GetEvent2(track: number): number {
        const p = this.packet;
        let status = byteAt(p.m_data, p.m_pos);
        if ((status & 128) !== 0) {
            arrayPutI32(this.statuses, track, status);
            p.m_pos = (p.m_pos + 1) | 0;
        } else status = arrayAtI32(this.statuses, track);
        if (status !== 240 && status !== 247) return this.GetEvent3(track, status);
        const length = p.gMidiVarLen();
        if (status === 247 && length > 0) {
            const next = byteAt(p.m_data, p.m_pos);
            if ((next >= 241 && next <= 243) || next === 246 || next === 248 || (next >= 250 && next <= 252) || next === 254) {
                p.m_pos = (p.m_pos + 1) | 0;
                arrayPutI32(this.statuses, track, next);
                return this.GetEvent3(track, next);
            }
        }
        p.m_pos = (p.m_pos + length) | 0;
        return 0;
    }
    // el.a([B)V
    SetMidi(data: Uint8Array | null): void {
        const p = this.packet;
        p.m_data = data;
        p.m_pos = 10;
        const tracks = p.g2();
        this.division = p.g2();
        this.tempo = 500000;
        this.starts = new Int32Array(tracks);
        let i = 0;
        while (i < tracks) {
            const chunk = p.g4(),
                size = p.g4();
            if (chunk === 0x4d54726b) this.starts[i++] = p.m_pos;
            p.m_pos = (p.m_pos + size) | 0;
        }
        this.time = 0n;
        this.positions = this.starts.slice();
        this.ticks = new Int32Array(tracks);
        this.statuses = new Int32Array(tracks);
    }
    // el.e(I)I
    GetEvent(track: number): number {
        return this.GetEvent2(track);
    }
    // el.g()I
    NextTrackToPlay(): number {
        const positions = requireNonNull(this.positions);
        let track = -1,
            min = 2147483647;
        for (let i = 0; i < positions.length; i++)
            if (positions[i] >= 0 && arrayAtI32(this.ticks, i) < min) {
                track = i;
                min = arrayAtI32(this.ticks, i);
            }
        return track;
    }
    // el.a(J)V
    Restart(time: bigint): void {
        this.time = time;
        const positions = requireNonNull(this.positions);
        for (let i = 0; i < positions.length; i++) {
            arrayPutI32(this.ticks, i, 0);
            arrayPutI32(this.statuses, i, 0);
            this.packet.m_pos = arrayAtI32(this.starts, i);
            this.ProcessDeltaTime(i);
            positions[i] = this.packet.m_pos;
        }
    }
    // el.f(I)V
    SetTrack(track: number): void {
        this.packet.m_pos = arrayAtI32(this.positions, track);
    }
    // el.<init>()V and el.<init>([B)V
    constructor(data?: Uint8Array | null) {
        if (data !== undefined) this.SetMidi(data);
    }
}
