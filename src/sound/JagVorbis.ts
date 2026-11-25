import type Js5 from '#/cache/Js5';
import Linkable from '#/datastruct/Linkable';
import PacketT from '#/io/PacketT';
import { arrayAtF32, arrayAtI32, arrayAtObj, arrayAtU8, arrayPutF32, arrayPutI32, arrayPutI8, requireNonNull } from '#/util/JavaArray';
import { bitLength, doubleToInt, reverseBits } from '#/util/IntUtils';
import Wave from './Wave';
import CodeBook from './CodeBook';
import Floor from './Floor';
import Mapping from './Mapping';
import Residue from './Residue';

const f = Math.fround;
const maxCachedOverlap = 4096; // Half the largest standard Vorbis block, in samples.
export default class JagVorbis extends Linkable {
    // ni.q:[F
    private static m_B0: Float32Array | null = null;
    // ni.r:I
    private previousSize = 0;
    // ni.s:[Li;
    private static m_residue: Residue[] | null = null;
    // ni.t:Z
    private pingPong = false;
    // ni.u:[F
    private static m_C1: Float32Array | null = null;
    // ni.v:I
    private previousTail = 0;
    // ni.w:I
    private loopStart = 0;
    // ni.x:I
    private sampleRate = 0;
    // ni.y:[Ldh;
    static m_codebook: CodeBook[] | null = null;
    // ni.z:Z
    private previousSilent = false;
    // ni.A:I
    private loopEnd = 0;
    // ni.B:[I
    private static m_bitrev1: Int32Array | null = null;
    // ni.C:I
    private static m_blocksize1 = 0;
    // ni.D:[F
    private static m_A1: Float32Array | null = null;
    // ni.E:I
    private static byteIndex = 0;
    // ni.F:[F
    private previous: Float32Array | null = null;
    // ni.G:[Z
    private static m_modeBlockflag: boolean[] | null = null;
    // ni.I:[Llb;
    private static m_floor: Floor[] | null = null;
    // ni.J:Z
    private static m_gotHeaders = false;
    // ni.K:[F
    private static m_A0: Float32Array | null = null;
    // ni.L:I
    private static bitIndex = 0;
    // ni.M:[[B
    private packets: Uint8Array[] | null = null;
    // ni.N:[F
    private static block: Float32Array | null = null;
    // ni.O:[I
    private static m_bitrev0: Int32Array | null = null;
    // ni.P:I
    private static m_blocksize0 = 0;
    // ni.Q:[I
    private static m_modeMapping: Int32Array | null = null;
    // ni.R:I
    private sampleCount = 0;
    // ni.S:[B
    private static data: Uint8Array | null = null;
    // ni.T:[F
    private static m_B1: Float32Array | null = null;
    // ni.U:I
    private writeIndex = 0;
    // ni.V:[B
    private pcm: Int8Array | null = null;
    // ni.W:[F
    private static m_C0: Float32Array | null = null;
    // ni.X:[Lfh;
    private static m_mapping: Mapping[] | null = null;
    // ni.Y:I
    private packetIndex = 0;
    private static overlapScratch: Float32Array | null = null;

    // ni.a()V
    static clear(): void {
        this.overlapScratch = null;
        this.data = null;
        this.m_codebook = null;
        this.m_floor = null;
        this.m_residue = null;
        this.m_mapping = null;
        this.m_modeBlockflag = null;
        this.m_modeMapping = null;
        this.block = null;
        this.m_A0 = null;
        this.m_B0 = null;
        this.m_C0 = null;
        this.m_A1 = null;
        this.m_B1 = null;
        this.m_C1 = null;
        this.m_bitrev0 = null;
        this.m_bitrev1 = null;
    }
    // ni.b()I
    static ReadBit(): number {
        const bit = (arrayAtU8(this.data, this.byteIndex) >> this.bitIndex) & 1;
        this.bitIndex++;
        this.byteIndex = (this.byteIndex + (this.bitIndex >> 3)) | 0;
        this.bitIndex &= 7;
        return bit;
    }
    // ni.a([B)V
    private DecodeJagVorbis(data: Uint8Array): void {
        const p = new PacketT(data);
        this.sampleRate = p.g4();
        this.sampleCount = p.g4();
        this.loopStart = p.g4();
        this.loopEnd = p.g4();
        if (this.loopEnd < 0) {
            this.loopEnd = ~this.loopEnd;
            this.pingPong = true;
        }
        const count = p.g4();
        this.packets = new Array(count);
        for (let i = 0; i < count; i++) {
            let length = 0,
                part: number;
            do {
                part = p.g1();
                length = (length + part) | 0;
            } while (part >= 255);
            const bytes = new Uint8Array(length);
            p.gArrayBuffer(length, 0, bytes);
            this.packets[i] = bytes;
        }
    }
    // ni.a([I)Lji;
    ToWaveMultistep(budget: Int32Array | null): Wave | null {
        if (budget !== null && arrayAtI32(budget, 0) <= 0) return null;
        if (this.pcm === null) {
            this.previousSize = 0;
            this.previous = new Float32Array(JagVorbis.m_blocksize1);
            this.pcm = new Int8Array(this.sampleCount);
            this.writeIndex = 0;
            this.packetIndex = 0;
        }
        for (; this.packetIndex < requireNonNull(this.packets).length; this.packetIndex++) {
            if (budget !== null && arrayAtI32(budget, 0) <= 0) return null;
            // Only this synchronous PCM writer borrows the overlap buffer. A nested decode
            // cannot borrow it until the samples have been consumed.
            const scratch = JagVorbis.overlapScratch;
            JagVorbis.overlapScratch = null;
            const block = this.DecodeAudioPacket(this.packetIndex, scratch);
            if (block !== null) {
                let index = this.writeIndex;
                const count = Math.min(block.length, (this.sampleCount - index) | 0);
                for (let j = 0; j < count; j++) {
                    let value = doubleToInt(f(128 + f(block[j] * 128)));
                    if ((value & -256) !== 0) value = ~value >> 31;
                    arrayPutI8(this.pcm, index++, value - 128);
                }
                if (budget !== null) arrayPutI32(budget, 0, arrayAtI32(budget, 0) - (index - this.writeIndex));
                this.writeIndex = index;
            }
            JagVorbis.overlapScratch = block !== null && block.length <= maxCachedOverlap && (scratch === null || block.length > scratch.length) ? block : scratch;
        }
        this.previous = null;
        const bytes = this.pcm;
        this.pcm = null;
        return new Wave(this.sampleRate, bytes, this.loopStart, this.loopEnd, this.pingPong);
    }
    // ni.b([B)V
    private static ProcessHeaders(data: Uint8Array): void {
        this.SetBitPos(data, 0);
        this.m_blocksize0 = 1 << this.ReadBits(4);
        this.m_blocksize1 = 1 << this.ReadBits(4);
        this.block = new Float32Array(this.m_blocksize1);
        for (let large = 0; large < 2; large++) {
            const n = large !== 0 ? this.m_blocksize1 : this.m_blocksize0,
                half = n >> 1,
                quarter = n >> 2,
                eighth = n >> 3;
            const a = new Float32Array(half),
                b = new Float32Array(half),
                c = new Float32Array(quarter);
            for (let j = 0; j < quarter; j++) {
                a[2 * j] = Math.cos((4 * j * Math.PI) / n);
                a[2 * j + 1] = -f(Math.sin((4 * j * Math.PI) / n));
            }
            for (let j = 0; j < quarter; j++) {
                b[2 * j] = Math.cos(((2 * j + 1) * Math.PI) / (2 * n));
                b[2 * j + 1] = Math.sin(((2 * j + 1) * Math.PI) / (2 * n));
            }
            for (let j = 0; j < eighth; j++) {
                c[2 * j] = Math.cos(((4 * j + 2) * Math.PI) / n);
                c[2 * j + 1] = -f(Math.sin(((4 * j + 2) * Math.PI) / n));
            }
            const reverse = new Int32Array(eighth),
                bits = bitLength(eighth - 1);
            for (let j = 0; j < eighth; j++) reverse[j] = reverseBits(j, bits);
            if (large !== 0) {
                this.m_A1 = a;
                this.m_B1 = b;
                this.m_C1 = c;
                this.m_bitrev1 = reverse;
            } else {
                this.m_A0 = a;
                this.m_B0 = b;
                this.m_C0 = c;
                this.m_bitrev0 = reverse;
            }
        }
        const books = this.ReadBits(8) + 1;
        this.m_codebook = new Array(books);
        for (let i = 0; i < books; i++) this.m_codebook[i] = new CodeBook();
        const times = this.ReadBits(6) + 1;
        for (let i = 0; i < times; i++) this.ReadBits(16);
        const floors = this.ReadBits(6) + 1;
        this.m_floor = new Array(floors);
        for (let i = 0; i < floors; i++) this.m_floor[i] = new Floor();
        const residues = this.ReadBits(6) + 1;
        this.m_residue = new Array(residues);
        for (let i = 0; i < residues; i++) this.m_residue[i] = new Residue();
        const mappings = this.ReadBits(6) + 1;
        this.m_mapping = new Array(mappings);
        for (let i = 0; i < mappings; i++) this.m_mapping[i] = new Mapping();
        const modes = this.ReadBits(6) + 1;
        this.m_modeBlockflag = new Array(modes).fill(false);
        this.m_modeMapping = new Int32Array(modes);
        for (let i = 0; i < modes; i++) {
            this.m_modeBlockflag[i] = this.ReadBit() !== 0;
            this.ReadBits(16);
            this.ReadBits(16);
            this.m_modeMapping[i] = this.ReadBits(8);
        }
    }
    // ni.a(Lal;)Z
    private static GetHeaders(archive: Js5): boolean {
        if (!this.m_gotHeaders) {
            const setup = archive.GetFile(0, 0);
            if (setup === null) return false;
            this.ProcessHeaders(setup);
            this.m_gotHeaders = true;
        }
        return true;
    }
    // ni.a([BI)V
    private static SetBitPos(data: Uint8Array | null, index: number): void {
        this.data = data;
        this.byteIndex = index;
        this.bitIndex = 0;
    }
    // ni.a(Lal;II)Lni;
    static Load(archive: Js5, group: number, file: number): JagVorbis | null {
        if (!this.GetHeaders(archive)) {
            archive.RequestDownload(true, group, file);
            return null;
        }
        const data = archive.GetFile(file, group);
        return data === null ? null : new JagVorbis(data);
    }
    // ni.a(I)I
    static ReadBits(count: number): number {
        let value = 0,
            shift = 0;
        while (count >= 8 - this.bitIndex) {
            const n = 8 - this.bitIndex,
                mask = (1 << n) - 1;
            value = (value + (((arrayAtU8(this.data, this.byteIndex) >> this.bitIndex) & mask) << shift)) | 0;
            this.bitIndex = 0;
            this.byteIndex = (this.byteIndex + 1) | 0;
            shift += n;
            count -= n;
        }
        if (count > 0) {
            value = (value + (((arrayAtU8(this.data, this.byteIndex) >> this.bitIndex) & ((1 << count) - 1)) << shift)) | 0;
            this.bitIndex += count;
        }
        return value;
    }
    // ni.b(I)[F
    private DecodeAudioPacket(index: number, scratch: Float32Array | null = null): Float32Array | null {
        const v = JagVorbis;
        v.SetBitPos(arrayAtObj(this.packets, index), 0);
        v.ReadBit();
        const mode = v.ReadBits(bitLength(requireNonNull(v.m_modeMapping).length - 1));
        const large = arrayAtObj(v.m_modeBlockflag, mode),
            n = large ? v.m_blocksize1 : v.m_blocksize0;
        let leftLarge = false,
            rightLarge = false;
        if (large) {
            leftLarge = v.ReadBit() !== 0;
            rightLarge = v.ReadBit() !== 0;
        }
        const half = n >> 1,
            quarter = n >> 2,
            eighth = n >> 3;
        let leftStart: number, leftEnd: number, leftWidth: number, rightStart: number, rightEnd: number, rightWidth: number;
        if (large && !leftLarge) {
            leftStart = quarter - (v.m_blocksize0 >> 2);
            leftEnd = quarter + (v.m_blocksize0 >> 2);
            leftWidth = v.m_blocksize0 >> 1;
        } else {
            leftStart = 0;
            leftEnd = half;
            leftWidth = half;
        }
        if (large && !rightLarge) {
            rightStart = n - quarter - (v.m_blocksize0 >> 2);
            rightEnd = n - quarter + (v.m_blocksize0 >> 2);
            rightWidth = v.m_blocksize0 >> 1;
        } else {
            rightStart = half;
            rightEnd = n;
            rightWidth = half;
        }
        const mapping = arrayAtObj(v.m_mapping, arrayAtI32(v.m_modeMapping, mode));
        const silent = !arrayAtObj(v.m_floor, arrayAtI32(mapping.floors, mapping.mux)).decode();
        const block = v.block;
        for (let i = 0; i < mapping.submaps; i++) arrayAtObj(v.m_residue, arrayAtI32(mapping.residues, i)).decode(block, half, silent);
        if (!silent) arrayAtObj(v.m_floor, arrayAtI32(mapping.floors, mapping.mux)).apply(block, half);
        if (silent) {
            for (let i = half; i < n; i++) arrayPutF32(block, i, 0);
        } else {
            for (let i = 0; i < half; i++) arrayPutF32(block, i, arrayAtF32(block, i) * 0.5);
            for (let i = half; i < n; i++) arrayPutF32(block, i, -arrayAtF32(block, n - i - 1));
            // Both checked loops above visited every index in [0,n). The quarter/eighth
            // loops stay inside that block. In each butterfly, low >= stride and
            // offset <= stride - 4, so even low - 3 - offset is in range.
            const samples = requireNonNull(block);
            const a = large ? v.m_A1 : v.m_A0,
                b = large ? v.m_B1 : v.m_B0,
                c = large ? v.m_C1 : v.m_C0,
                reverse = large ? v.m_bitrev1 : v.m_bitrev0;
            for (let i = 0; i < quarter; i++) {
                const re = f(samples[4 * i] - samples[n - 4 * i - 1]),
                    im = f(samples[4 * i + 2] - samples[n - 4 * i - 3]);
                const cos = arrayAtF32(a, 2 * i),
                    sin = arrayAtF32(a, 2 * i + 1);
                samples[n - 4 * i - 1] = f(re * cos) - f(im * sin);
                samples[n - 4 * i - 3] = f(re * sin) + f(im * cos);
            }
            for (let i = 0; i < eighth; i++) {
                const re = samples[half + 3 + 4 * i],
                    im = samples[half + 1 + 4 * i],
                    re0 = samples[4 * i + 3],
                    im0 = samples[4 * i + 1];
                samples[half + 3 + 4 * i] = re + re0;
                samples[half + 1 + 4 * i] = im + im0;
                const cos = arrayAtF32(a, half - 4 - 4 * i),
                    sin = arrayAtF32(a, half - 3 - 4 * i);
                samples[4 * i + 3] = f(f(re - re0) * cos) - f(f(im - im0) * sin);
                samples[4 * i + 1] = f(f(im - im0) * cos) + f(f(re - re0) * sin);
            }
            const bits = bitLength(n - 1);
            for (let pass = 0; pass < bits - 3; pass++) {
                const stride = n >> (pass + 2),
                    step = 8 << pass;
                for (let j = 0; j < 2 << pass; j++) {
                    const high = n - stride * 2 * j,
                        low = n - stride * (2 * j + 1);
                    for (let k = 0; k < n >> (pass + 4); k++) {
                        const offset = 4 * k,
                            re = samples[high - 1 - offset],
                            im = samples[high - 3 - offset],
                            re0 = samples[low - 1 - offset],
                            im0 = samples[low - 3 - offset];
                        samples[high - 1 - offset] = re + re0;
                        samples[high - 3 - offset] = im + im0;
                        const cos = arrayAtF32(a, k * step),
                            sin = arrayAtF32(a, k * step + 1);
                        samples[low - 1 - offset] = f(f(re - re0) * cos) - f(f(im - im0) * sin);
                        samples[low - 3 - offset] = f(f(im - im0) * cos) + f(f(re - re0) * sin);
                    }
                }
            }
            for (let i = 1; i < eighth - 1; i++) {
                const j = arrayAtI32(reverse, i);
                if (i < j)
                    for (let offset = 1; offset <= 7; offset += 2) {
                        const from = 8 * i + offset,
                            to = 8 * j + offset,
                            tmp = samples[from];
                        // Check the indirect address before its subsequent store.
                        samples[from] = arrayAtF32(samples, to);
                        samples[to] = tmp;
                    }
            }
            for (let i = 0; i < half; i++) samples[i] = samples[2 * i + 1];
            for (let i = 0; i < eighth; i++) {
                samples[n - 1 - 2 * i] = samples[4 * i];
                samples[n - 2 - 2 * i] = samples[4 * i + 1];
                samples[n - quarter - 1 - 2 * i] = samples[4 * i + 2];
                samples[n - quarter - 2 - 2 * i] = samples[4 * i + 3];
            }
            for (let i = 0; i < eighth; i++) {
                const cos = arrayAtF32(c, 2 * i),
                    sin = arrayAtF32(c, 2 * i + 1),
                    re = samples[half + 2 * i],
                    im = samples[half + 2 * i + 1],
                    re0 = samples[n - 2 - 2 * i],
                    im0 = samples[n - 1 - 2 * i];
                let mix = f(f(sin * f(re - re0)) + f(cos * f(im + im0)));
                samples[half + 2 * i] = f(f(re + re0) + mix) * 0.5;
                samples[n - 2 - 2 * i] = f(f(re + re0) - mix) * 0.5;
                mix = f(f(sin * f(im + im0)) - f(cos * f(re - re0)));
                samples[half + 2 * i + 1] = f(f(im - im0) + mix) * 0.5;
                samples[n - 1 - 2 * i] = f(f(-im + im0) + mix) * 0.5;
            }
            for (let i = 0; i < quarter; i++) {
                samples[i] = f(samples[2 * i + half] * arrayAtF32(b, 2 * i)) + f(samples[2 * i + 1 + half] * arrayAtF32(b, 2 * i + 1));
                samples[half - 1 - i] = f(samples[2 * i + half] * arrayAtF32(b, 2 * i + 1)) - f(samples[2 * i + 1 + half] * arrayAtF32(b, 2 * i));
            }
            for (let i = 0; i < quarter; i++) samples[n - quarter + i] = -samples[i];
            for (let i = 0; i < quarter; i++) samples[i] = samples[quarter + i];
            for (let i = 0; i < quarter; i++) samples[quarter + i] = -samples[quarter - i - 1];
            for (let i = 0; i < quarter; i++) samples[half + i] = samples[n - i - 1];
            for (let i = leftStart; i < leftEnd; i++) {
                const t = f(Math.sin(((i - leftStart + 0.5) / leftWidth) * 0.5 * Math.PI));
                arrayPutF32(block, i, arrayAtF32(block, i) * f(Math.sin((Math.PI / 2) * t * t)));
            }
            for (let i = rightStart; i < rightEnd; i++) {
                const t = f(Math.sin(((i - rightStart + 0.5) / rightWidth) * 0.5 * Math.PI + Math.PI / 2));
                arrayPutF32(block, i, arrayAtF32(block, i) * f(Math.sin((Math.PI / 2) * t * t)));
            }
        }
        let result: Float32Array | null = null;
        if (this.previousSize > 0) {
            const length = (this.previousSize + n) >> 2;
            if (scratch !== null && length >= 0 && length <= scratch.length) {
                result = scratch.length === length ? scratch : scratch.subarray(0, length);
                result.fill(0);
            } else {
                result = new Float32Array(length);
            }
            if (!this.previousSilent) for (let i = 0; i < this.previousTail; i++) arrayPutF32(result, i, arrayAtF32(result, i) + arrayAtF32(this.previous, (this.previousSize >> 1) + i));
            if (!silent)
                for (let i = leftStart; i < half; i++) {
                    const offset = result.length - half + i;
                    arrayPutF32(result, offset, arrayAtF32(result, offset) + arrayAtF32(block, i));
                }
        }
        const old = this.previous;
        this.previous = block;
        v.block = old;
        this.previousSize = n;
        this.previousTail = rightEnd - half;
        this.previousSilent = silent;
        return result;
    }
    // ni.c(I)F
    static Float32Unpack(value: number): number {
        let mantissa = value & 0x1fffff;
        const exponent = (value & 0x7fe00000) >> 21;
        if ((value & 0x80000000) !== 0) mantissa = -mantissa;
        return f(mantissa * Math.pow(2, exponent - 788));
    }
    // ni.<init>([B)V
    constructor(data: Uint8Array) {
        super();
        this.DecodeJagVorbis(data);
    }
}
