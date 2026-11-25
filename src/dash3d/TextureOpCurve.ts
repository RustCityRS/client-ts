import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import type PacketT from '#/io/PacketT';
import { intDivide } from '#/util/IntUtils';
import { arrayAtI16, arrayAtI32, arrayAtObj, arrayPutI16, arrayPutI32, requireNonNull } from '#/util/JavaArray';
import TextureOp from './TextureOp';
import { loadByteArrayPool, loadMinimenu, loadSpriteLoader, loadTerrainBuilder } from '#/util/GamepackClasses';

export default class TextureOpCurve extends TextureOp {
    // HD wi.b(Z)V
    static releaseTextureOpCurveStatics(guard: boolean): void {
        try {
            const ByteArrayPool = loadByteArrayPool();
            releaseReferences(ByteArrayPool, 'small');
            const SpriteLoader = loadSpriteLoader();
            releaseReferences(SpriteLoader, 'hintMapEdge');
            if (guard) {
                const Minimenu = loadMinimenu();
                Minimenu.MenuOnly(-71, 100);
            }
            const TerrainBuilder = loadTerrainBuilder();
            releaseReferences(TerrainBuilder, 'edgeVertices');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'wi.O(' + guard + ')');
        }
    }

    private before: Int32Array | null = null; // kj.N:[I
    private after: Int32Array | null = null; // kj.O:[I
    private table: Int16Array | null = new Int16Array(257); // kj.P:[S
    private interpolation = 0; // kj.Q:I
    private markers: (Int32Array | null)[] | null = null; // kj.ab:[[I

    // kj.<init>()V
    constructor() {
        super(1, true);
    }

    // kj.a(IB)[I
    override getMonochromeOutput(row: number): Int32Array | null {
        const output = requireNonNull(this.monochromeImageCache).get(row);
        if (requireNonNull(this.monochromeImageCache).invalid) {
            const child = this.getChildMonochromeOutput(0, row);
            const width = TextureOp.width;
            const table = this.table;
            if (output !== null && output.length >= width && child !== null && child.length >= width && table !== null && table.length >= 257) {
                for (let x = 0; x < width; x++) output[x] = table[Math.max(0, Math.min(256, child[x] >> 4))];
                return output;
            }
            for (let x = 0; x < TextureOp.width; x++) {
                let i = arrayAtI32(child, x) >> 4;
                if (i < 0) i = 0;
                if (i > 256) i = 256;
                arrayPutI32(output, x, arrayAtI16(this.table, i));
            }
        }
        return output;
    }

    // kj.b(I)V
    override postDecode(): void {
        if (this.markers === null) this.markers = [new Int32Array(2), Int32Array.of(4096, 4096)];
        if (this.markers.length < 2) throw new Error('Curve operation requires at least two markers');
        if (this.interpolation === 2) this.extrapolate();
        TextureOp.initTrigTables();
        this.buildTable();
    }

    // kj.e(I)V
    private extrapolate(): void {
        const first = arrayAtObj(this.markers, 0);
        const second = arrayAtObj(this.markers, 1);
        const last = arrayAtObj(this.markers, requireNonNull(this.markers).length - 1);
        const previous = arrayAtObj(this.markers, requireNonNull(this.markers).length - 2);
        this.before = Int32Array.of(arrayAtI32(first, 0) + arrayAtI32(first, 0) - arrayAtI32(second, 0), arrayAtI32(first, 1) + (arrayAtI32(first, 1) - arrayAtI32(second, 1)));
        this.after = Int32Array.of(arrayAtI32(previous, 0) + arrayAtI32(previous, 0) - arrayAtI32(last, 0), -arrayAtI32(last, 1) + arrayAtI32(previous, 1) + arrayAtI32(previous, 1));
    }

    // kj.a(Lgd;ZI)V
    override decode(packet: PacketT | null, code: number): void {
        if (code === 0) {
            const p = requireNonNull(packet);
            this.interpolation = p.g1();
            this.markers = Array.from({ length: p.g1() }, () => new Int32Array(2));
            for (let i = 0; i < this.markers.length; i++) {
                arrayPutI32(arrayAtObj(this.markers, i), 0, p.g2());
                arrayPutI32(arrayAtObj(this.markers, i), 1, p.g2());
            }
        }
    }

    // kj.c(II)[I
    private marker(index: number): Int32Array | null {
        if (index < 0) return this.before;
        return index >= requireNonNull(this.markers).length ? this.after : arrayAtObj(this.markers, index);
    }

    // kj.f(I)V
    private buildTable(): void {
        if (this.interpolation === 2) {
            for (let i = 0; i < 257; i++) {
                const x = i << 4;
                let next = 1;
                while (next < requireNonNull(this.markers).length - 1 && arrayAtI32(arrayAtObj(this.markers, next), 0) <= x) next++;
                const left = arrayAtObj(this.markers, next - 1),
                    right = arrayAtObj(this.markers, next);
                const a = arrayAtI32(this.marker(next - 2), 1),
                    b = arrayAtI32(left, 1),
                    c = arrayAtI32(right, 1),
                    d = arrayAtI32(this.marker(next + 1), 1);
                const t = intDivide((x - arrayAtI32(left, 0)) << 12, (-arrayAtI32(left, 0) + arrayAtI32(right, 0)) | 0);
                const t2 = Math.imul(t, t) >> 12;
                const cubic = (d - (c + a) + b) | 0,
                    quad = (-cubic + (a - b)) | 0,
                    linear = (-a + c) | 0;
                const t3Value = Math.imul(Math.imul(t, cubic) >> 12, t2) >> 12;
                const t2Value = Math.imul(quad, t2) >> 12,
                    tValue = Math.imul(t, linear) >> 12;
                let value = (tValue + t2Value + t3Value + b) | 0;
                if (value <= -32768) value = -32767;
                if (value >= 32768) value = 32767;
                arrayPutI16(this.table, i, value);
            }
        } else if (this.interpolation === 1) {
            for (let i = 0; i < 257; i++) {
                const x = i << 4;
                let next = 1;
                while (next < requireNonNull(this.markers).length - 1 && x >= arrayAtI32(arrayAtObj(this.markers, next), 0)) next++;
                const right = arrayAtObj(this.markers, next),
                    left = arrayAtObj(this.markers, next - 1);
                const fraction = intDivide((x - arrayAtI32(left, 0)) << 12, (-arrayAtI32(left, 0) + arrayAtI32(right, 0)) | 0);
                const t = (-arrayAtI32(TextureOp.cosine, (fraction >> 5) & 255) + 4096) >> 1;
                const other = (4096 - t) | 0;
                let value = (Math.imul(arrayAtI32(right, 1), t) + Math.imul(other, arrayAtI32(left, 1))) >> 12;
                if (value <= -32768) value = -32767;
                if (value >= 32768) value = 32767;
                arrayPutI16(this.table, i, value);
            }
        } else {
            for (let i = 0; i < 257; i++) {
                const x = i << 4;
                let next = 1;
                while (requireNonNull(this.markers).length - 1 > next && x >= arrayAtI32(arrayAtObj(this.markers, next), 0)) next++;
                const left = arrayAtObj(this.markers, next - 1),
                    right = arrayAtObj(this.markers, next);
                const t = intDivide((x - arrayAtI32(left, 0)) << 12, (-arrayAtI32(left, 0) + arrayAtI32(right, 0)) | 0);
                const other = (4096 - t) | 0;
                let value = (Math.imul(arrayAtI32(right, 1), t) + Math.imul(other, arrayAtI32(left, 1))) >> 12;
                if (value <= -32768) value = -32767;
                if (value >= 32768) value = 32767;
                arrayPutI16(this.table, i, value);
            }
        }
    }
}
