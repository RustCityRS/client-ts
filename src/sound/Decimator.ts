import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import { arrayAtI32, arrayAtObj, arrayPutI32, requireNonNull } from '#/util/JavaArray';
import { doubleToInt, intDivide, intRemainder } from '#/util/IntUtils';
import { loadClient, loadLocalisedText, loadWorldMap } from '#/util/GamepackClasses';

export default class Decimator {
    // HD vj.a(B)V
    static releaseHdStatics(guard: number): void {
        try {
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'frenchLoadingConfig', 'connectingToUpdateServer');
            const Client = loadClient();
            releaseReferences(Client, 'p11Software');
            if (guard !== -110) {
                return;
            }
            const WorldMap = loadWorldMap();
            releaseReferences(WorldMap, 'labelSuffix');
            releaseReferences(LocalisedText, 'englishConnectingToUpdateServer');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'vj.F(' + guard + ')');
        }
    }

    // hd.d:[[I
    private table: Int32Array[] | null = null;
    // hd.f:I
    private inputRate = 0;
    // hd.k:I
    private outputRate = 0;

    // qe.a(IBI)I
    private static gcd(a: number, b: number): number {
        if (a < b) {
            const t = a;
            a = b;
            b = t;
        }
        while (b !== 0) {
            const t = intRemainder(a, b);
            a = b;
            b = t;
        }
        return a;
    }
    // hd.<init>(II)V
    constructor(input: number, output: number) {
        if (input === output) return;
        const gcd = Decimator.gcd(input, output);
        input = intDivide(input, gcd);
        output = intDivide(output, gcd);
        this.inputRate = input;
        this.outputRate = output;
        this.table = new Array(input);
        for (let phase = 0; phase < input; phase++) {
            const row = (this.table[phase] = new Int32Array(14)),
                ratio = output / input,
                center = phase / input + 6.0;
            const low = Math.max(0, Math.floor(center - 6)),
                high = Math.min(14, Math.ceil(center + 7));
            for (let tap = low; tap < high; tap++) {
                const angle = (tap - center) * Math.PI;
                let amplitude = ratio;
                if (angle < -1e-4 || angle > 1e-4) amplitude = ratio * (Math.sin(angle) / angle);
                amplitude *= 0.54 + Math.cos((tap - center) * (Math.PI / 14)) * 0.46;
                row[tap] = doubleToInt(Math.floor(0.5 + amplitude * 65536));
            }
        }
    }
    // hd.a(IB)I
    TransmitPos(value: number): number {
        return this.table === null ? value : (6 + Number(BigInt.asIntN(32, (BigInt(this.outputRate) * BigInt(value)) / BigInt(this.inputRate)))) | 0;
    }
    // hd.a(BI)I
    TransmitFreq(value: number): number {
        return this.table === null ? value : Number(BigInt.asIntN(32, (BigInt(value) * BigInt(this.outputRate)) / BigInt(this.inputRate)));
    }
    // hd.a([BZ)[B
    Decimate(input: Int8Array): Int8Array;
    Decimate(input: Int8Array | null): Int8Array | null;
    Decimate(input: Int8Array | null): Int8Array | null {
        if (this.table === null) return input;
        const bytes = requireNonNull(input),
            size = (14 + Number(BigInt.asIntN(32, (BigInt(bytes.length) * BigInt(this.outputRate)) / BigInt(this.inputRate)))) | 0;
        const sums = new Int32Array(size);
        let offset = 0,
            phase = 0;
        for (const sample of bytes) {
            const row = arrayAtObj(this.table, phase);
            for (let j = 0; j < 14; j++) {
                const i = (j + offset) | 0;
                arrayPutI32(sums, i, arrayAtI32(sums, i) + Math.imul(sample, row[j]));
            }
            phase = (phase + this.outputRate) | 0;
            const step = intDivide(phase, this.inputRate);
            offset = (offset + step) | 0;
            phase = (phase - Math.imul(step, this.inputRate)) | 0;
        }
        const result = new Int8Array(size);
        for (let i = 0; i < size; i++) result[i] = Math.min(127, Math.max(-128, (sums[i] + 32768) >> 16));
        return result;
    }
}
