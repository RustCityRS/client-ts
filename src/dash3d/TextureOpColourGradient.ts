import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import type PacketT from '#/io/PacketT';
import { intDivide } from '#/util/IntUtils';
import { arrayAtI32, arrayAtObj, arrayPutI32, requireNonNull } from '#/util/JavaArray';
import type { ColourImageRow } from './ColourImageCache';
import TextureOp from './TextureOp';
import { loadLogin, loadObjType } from '#/util/GamepackClasses';

export default class TextureOpColourGradient extends TextureOp {
    // HD um.i(I)V
    static releaseTextureOpColourGradientStatics(guard: number): void {
        try {
            if (guard < 7) {
                return;
            }
            const ObjType = loadObjType();
            releaseReferences(ObjType, 'm_countFont');
            const Login = loadLogin();
            releaseReferences(Login, 'rsaModulus');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'um.Q(' + guard + ')');
        }
    }

    private table: Int32Array | null = new Int32Array(257); // nk.bb:[I
    private markers: (Int32Array | null)[] | null = null; // nk.eb:[[I

    // nk.<init>()V
    constructor() {
        super(1, false);
    }

    // nk.b(I)V
    override postDecode(): void {
        if (this.markers === null) this.setPreset(1);
        this.buildTable();
    }

    // nk.e(I)V
    private buildTable(): void {
        const count = requireNonNull(this.markers).length;
        if (count > 0) {
            for (let i = 0; i < 257; i++) {
                const x = i << 4;
                let next = 0;
                for (let j = 0; j < count && x >= arrayAtI32(arrayAtObj(this.markers, j), 0); j++) next++;
                let r: number, g: number, b: number;
                if (next < count) {
                    const right = arrayAtObj(this.markers, next);
                    if (next > 0) {
                        const left = arrayAtObj(this.markers, next - 1);
                        const t = intDivide((x - arrayAtI32(left, 0)) << 12, (arrayAtI32(right, 0) - arrayAtI32(left, 0)) | 0);
                        const other = (4096 - t) | 0;
                        r = (Math.imul(other, arrayAtI32(left, 1)) + Math.imul(t, arrayAtI32(right, 1))) >> 12;
                        b = (Math.imul(arrayAtI32(left, 3), other) + Math.imul(arrayAtI32(right, 3), t)) >> 12;
                        g = (Math.imul(other, arrayAtI32(left, 2)) + Math.imul(t, arrayAtI32(right, 2))) >> 12;
                    } else {
                        r = arrayAtI32(right, 1);
                        b = arrayAtI32(right, 3);
                        g = arrayAtI32(right, 2);
                    }
                } else {
                    const last = arrayAtObj(this.markers, count - 1);
                    g = arrayAtI32(last, 2);
                    r = arrayAtI32(last, 1);
                    b = arrayAtI32(last, 3);
                }
                g >>= 4;
                r >>= 4;
                if (g < 0) g = 0;
                else if (g > 255) g = 255;
                b >>= 4;
                if (r < 0) r = 0;
                else if (r > 255) r = 255;
                if (b >= 0) {
                    if (b > 255) b = 255;
                } else b = 0;
                arrayPutI32(this.table, i, (r << 16) | (g << 8) | b);
            }
        }
    }

    // nk.a(Lgd;ZI)V
    override decode(packet: PacketT | null, code: number): void {
        if (code === 0) {
            const p = requireNonNull(packet);
            const preset = p.g1();
            if (preset !== 0) {
                this.setPreset(preset);
                return;
            }
            this.markers = Array.from({ length: p.g1() }, () => new Int32Array(4));
            for (let i = 0; i < this.markers.length; i++) {
                arrayPutI32(arrayAtObj(this.markers, i), 0, p.g2());
                arrayPutI32(arrayAtObj(this.markers, i), 1, p.g1() << 4);
                arrayPutI32(arrayAtObj(this.markers, i), 2, p.g1() << 4);
                arrayPutI32(arrayAtObj(this.markers, i), 3, p.g1() << 4);
            }
        }
    }

    // nk.c(II)V
    private setPreset(preset: number): void {
        if (preset === 0) return;
        switch (preset) {
            case 1:
                this.markers = Array.from({ length: 2 }, () => new Int32Array(4));
                arrayPutI32(arrayAtObj(this.markers, 0), 2, 0);
                arrayPutI32(arrayAtObj(this.markers, 0), 1, 0);
                arrayPutI32(arrayAtObj(this.markers, 1), 1, 4096);
                arrayPutI32(arrayAtObj(this.markers, 0), 3, 0);
                arrayPutI32(arrayAtObj(this.markers, 1), 2, 4096);
                arrayPutI32(arrayAtObj(this.markers, 0), 0, 0);
                arrayPutI32(arrayAtObj(this.markers, 1), 0, 4096);
                arrayPutI32(arrayAtObj(this.markers, 1), 3, 4096);
                return;
            case 2:
                this.markers = Array.from({ length: 8 }, () => new Int32Array(4));
                arrayPutI32(arrayAtObj(this.markers, 0), 0, 0);
                arrayPutI32(arrayAtObj(this.markers, 0), 2, 2602);
                arrayPutI32(arrayAtObj(this.markers, 0), 3, 2361);
                arrayPutI32(arrayAtObj(this.markers, 1), 3, 1558);
                arrayPutI32(arrayAtObj(this.markers, 0), 1, 2650);
                arrayPutI32(arrayAtObj(this.markers, 2), 3, 1413);
                arrayPutI32(arrayAtObj(this.markers, 3), 3, 947);
                arrayPutI32(arrayAtObj(this.markers, 1), 1, 2313);
                arrayPutI32(arrayAtObj(this.markers, 1), 0, 2867);
                arrayPutI32(arrayAtObj(this.markers, 1), 2, 1799);
                arrayPutI32(arrayAtObj(this.markers, 4), 3, 722);
                arrayPutI32(arrayAtObj(this.markers, 2), 2, 1734);
                arrayPutI32(arrayAtObj(this.markers, 2), 0, 3072);
                arrayPutI32(arrayAtObj(this.markers, 3), 2, 1220);
                arrayPutI32(arrayAtObj(this.markers, 5), 3, 1766);
                arrayPutI32(arrayAtObj(this.markers, 2), 1, 2618);
                arrayPutI32(arrayAtObj(this.markers, 6), 3, 915);
                arrayPutI32(arrayAtObj(this.markers, 3), 0, 3276);
                arrayPutI32(arrayAtObj(this.markers, 3), 1, 2296);
                arrayPutI32(arrayAtObj(this.markers, 7), 3, 1140);
                arrayPutI32(arrayAtObj(this.markers, 4), 2, 963);
                arrayPutI32(arrayAtObj(this.markers, 5), 2, 2152);
                arrayPutI32(arrayAtObj(this.markers, 4), 1, 2072);
                arrayPutI32(arrayAtObj(this.markers, 5), 1, 2730);
                arrayPutI32(arrayAtObj(this.markers, 4), 0, 3481);
                arrayPutI32(arrayAtObj(this.markers, 6), 1, 2232);
                arrayPutI32(arrayAtObj(this.markers, 7), 1, 1686);
                arrayPutI32(arrayAtObj(this.markers, 6), 2, 1060);
                arrayPutI32(arrayAtObj(this.markers, 5), 0, 3686);
                arrayPutI32(arrayAtObj(this.markers, 6), 0, 3891);
                arrayPutI32(arrayAtObj(this.markers, 7), 0, 4096);
                arrayPutI32(arrayAtObj(this.markers, 7), 2, 1413);
                return;
            case 3:
                this.markers = Array.from({ length: 7 }, () => new Int32Array(4));
                arrayPutI32(arrayAtObj(this.markers, 0), 2, 0);
                arrayPutI32(arrayAtObj(this.markers, 0), 3, 4096);
                arrayPutI32(arrayAtObj(this.markers, 0), 1, 0);
                arrayPutI32(arrayAtObj(this.markers, 1), 2, 4096);
                arrayPutI32(arrayAtObj(this.markers, 0), 0, 0);
                arrayPutI32(arrayAtObj(this.markers, 1), 1, 0);
                arrayPutI32(arrayAtObj(this.markers, 2), 2, 4096);
                arrayPutI32(arrayAtObj(this.markers, 2), 1, 0);
                arrayPutI32(arrayAtObj(this.markers, 3), 2, 4096);
                arrayPutI32(arrayAtObj(this.markers, 1), 3, 4096);
                arrayPutI32(arrayAtObj(this.markers, 3), 1, 4096);
                arrayPutI32(arrayAtObj(this.markers, 1), 0, 663);
                arrayPutI32(arrayAtObj(this.markers, 2), 3, 0);
                arrayPutI32(arrayAtObj(this.markers, 4), 2, 0);
                arrayPutI32(arrayAtObj(this.markers, 2), 0, 1363);
                arrayPutI32(arrayAtObj(this.markers, 4), 1, 4096);
                arrayPutI32(arrayAtObj(this.markers, 5), 1, 4096);
                arrayPutI32(arrayAtObj(this.markers, 3), 3, 0);
                arrayPutI32(arrayAtObj(this.markers, 6), 1, 0);
                arrayPutI32(arrayAtObj(this.markers, 5), 2, 0);
                arrayPutI32(arrayAtObj(this.markers, 4), 3, 0);
                arrayPutI32(arrayAtObj(this.markers, 5), 3, 4096);
                arrayPutI32(arrayAtObj(this.markers, 6), 3, 4096);
                arrayPutI32(arrayAtObj(this.markers, 3), 0, 2048);
                arrayPutI32(arrayAtObj(this.markers, 4), 0, 2727);
                arrayPutI32(arrayAtObj(this.markers, 5), 0, 3411);
                arrayPutI32(arrayAtObj(this.markers, 6), 0, 4096);
                arrayPutI32(arrayAtObj(this.markers, 6), 2, 0);
                return;
            case 4:
                this.markers = Array.from({ length: 6 }, () => new Int32Array(4));
                arrayPutI32(arrayAtObj(this.markers, 0), 1, 0);
                arrayPutI32(arrayAtObj(this.markers, 0), 2, 0);
                arrayPutI32(arrayAtObj(this.markers, 1), 1, 0);
                arrayPutI32(arrayAtObj(this.markers, 0), 0, 0);
                arrayPutI32(arrayAtObj(this.markers, 2), 1, 0);
                arrayPutI32(arrayAtObj(this.markers, 0), 3, 0);
                arrayPutI32(arrayAtObj(this.markers, 3), 1, 0);
                arrayPutI32(arrayAtObj(this.markers, 4), 1, 546);
                arrayPutI32(arrayAtObj(this.markers, 1), 3, 1493);
                arrayPutI32(arrayAtObj(this.markers, 1), 2, 0);
                arrayPutI32(arrayAtObj(this.markers, 1), 0, 1843);
                arrayPutI32(arrayAtObj(this.markers, 2), 0, 2457);
                arrayPutI32(arrayAtObj(this.markers, 2), 2, 0);
                arrayPutI32(arrayAtObj(this.markers, 3), 0, 2781);
                arrayPutI32(arrayAtObj(this.markers, 5), 1, 4096);
                arrayPutI32(arrayAtObj(this.markers, 3), 2, 1124);
                arrayPutI32(arrayAtObj(this.markers, 4), 0, 3481);
                arrayPutI32(arrayAtObj(this.markers, 2), 3, 2939);
                arrayPutI32(arrayAtObj(this.markers, 3), 3, 3565);
                arrayPutI32(arrayAtObj(this.markers, 4), 2, 3084);
                arrayPutI32(arrayAtObj(this.markers, 5), 2, 4096);
                arrayPutI32(arrayAtObj(this.markers, 4), 3, 4031);
                arrayPutI32(arrayAtObj(this.markers, 5), 0, 4096);
                arrayPutI32(arrayAtObj(this.markers, 5), 3, 4096);
                return;
            case 5:
                this.markers = Array.from({ length: 16 }, () => new Int32Array(4));
                arrayPutI32(arrayAtObj(this.markers, 0), 3, 321);
                arrayPutI32(arrayAtObj(this.markers, 0), 1, 80);
                arrayPutI32(arrayAtObj(this.markers, 0), 2, 192);
                arrayPutI32(arrayAtObj(this.markers, 1), 2, 449);
                arrayPutI32(arrayAtObj(this.markers, 0), 0, 0);
                arrayPutI32(arrayAtObj(this.markers, 2), 2, 690);
                arrayPutI32(arrayAtObj(this.markers, 1), 0, 155);
                arrayPutI32(arrayAtObj(this.markers, 1), 1, 321);
                arrayPutI32(arrayAtObj(this.markers, 2), 1, 578);
                arrayPutI32(arrayAtObj(this.markers, 3), 2, 995);
                arrayPutI32(arrayAtObj(this.markers, 1), 3, 562);
                arrayPutI32(arrayAtObj(this.markers, 4), 2, 1397);
                arrayPutI32(arrayAtObj(this.markers, 3), 1, 947);
                arrayPutI32(arrayAtObj(this.markers, 2), 3, 803);
                arrayPutI32(arrayAtObj(this.markers, 5), 2, 1429);
                arrayPutI32(arrayAtObj(this.markers, 2), 0, 389);
                arrayPutI32(arrayAtObj(this.markers, 3), 0, 671);
                arrayPutI32(arrayAtObj(this.markers, 4), 1, 1285);
                arrayPutI32(arrayAtObj(this.markers, 5), 1, 1525);
                arrayPutI32(arrayAtObj(this.markers, 4), 0, 897);
                arrayPutI32(arrayAtObj(this.markers, 5), 0, 1175);
                arrayPutI32(arrayAtObj(this.markers, 3), 3, 1140);
                arrayPutI32(arrayAtObj(this.markers, 6), 1, 1734);
                arrayPutI32(arrayAtObj(this.markers, 6), 0, 1368);
                arrayPutI32(arrayAtObj(this.markers, 7), 1, 1413);
                arrayPutI32(arrayAtObj(this.markers, 4), 3, 1509);
                arrayPutI32(arrayAtObj(this.markers, 6), 2, 1461);
                arrayPutI32(arrayAtObj(this.markers, 8), 1, 1108);
                arrayPutI32(arrayAtObj(this.markers, 9), 1, 1766);
                arrayPutI32(arrayAtObj(this.markers, 10), 1, 2409);
                arrayPutI32(arrayAtObj(this.markers, 5), 3, 1413);
                arrayPutI32(arrayAtObj(this.markers, 7), 0, 1507);
                arrayPutI32(arrayAtObj(this.markers, 8), 0, 1736);
                arrayPutI32(arrayAtObj(this.markers, 9), 0, 2088);
                arrayPutI32(arrayAtObj(this.markers, 11), 1, 3116);
                arrayPutI32(arrayAtObj(this.markers, 10), 0, 2355);
                arrayPutI32(arrayAtObj(this.markers, 11), 0, 2691);
                arrayPutI32(arrayAtObj(this.markers, 6), 3, 1333);
                arrayPutI32(arrayAtObj(this.markers, 12), 1, 3806);
                arrayPutI32(arrayAtObj(this.markers, 12), 0, 3031);
                arrayPutI32(arrayAtObj(this.markers, 7), 2, 1525);
                arrayPutI32(arrayAtObj(this.markers, 7), 3, 1702);
                arrayPutI32(arrayAtObj(this.markers, 8), 3, 2056);
                arrayPutI32(arrayAtObj(this.markers, 13), 1, 3437);
                arrayPutI32(arrayAtObj(this.markers, 14), 1, 3116);
                arrayPutI32(arrayAtObj(this.markers, 9), 3, 2666);
                arrayPutI32(arrayAtObj(this.markers, 8), 2, 1590);
                arrayPutI32(arrayAtObj(this.markers, 15), 1, 2377);
                arrayPutI32(arrayAtObj(this.markers, 10), 3, 3276);
                arrayPutI32(arrayAtObj(this.markers, 13), 0, 3522);
                arrayPutI32(arrayAtObj(this.markers, 11), 3, 3228);
                arrayPutI32(arrayAtObj(this.markers, 9), 2, 2056);
                arrayPutI32(arrayAtObj(this.markers, 10), 2, 2586);
                arrayPutI32(arrayAtObj(this.markers, 14), 0, 3727);
                arrayPutI32(arrayAtObj(this.markers, 11), 2, 3148);
                arrayPutI32(arrayAtObj(this.markers, 15), 0, 4096);
                arrayPutI32(arrayAtObj(this.markers, 12), 3, 3196);
                arrayPutI32(arrayAtObj(this.markers, 12), 2, 3710);
                arrayPutI32(arrayAtObj(this.markers, 13), 2, 3421);
                arrayPutI32(arrayAtObj(this.markers, 14), 2, 3148);
                arrayPutI32(arrayAtObj(this.markers, 13), 3, 3019);
                arrayPutI32(arrayAtObj(this.markers, 14), 3, 3228);
                arrayPutI32(arrayAtObj(this.markers, 15), 3, 2746);
                arrayPutI32(arrayAtObj(this.markers, 15), 2, 2505);
                return;
            case 6:
                this.markers = Array.from({ length: 4 }, () => new Int32Array(4));
                arrayPutI32(arrayAtObj(this.markers, 0), 1, 0);
                arrayPutI32(arrayAtObj(this.markers, 0), 2, 4096);
                arrayPutI32(arrayAtObj(this.markers, 1), 1, 4096);
                arrayPutI32(arrayAtObj(this.markers, 2), 1, 4096);
                arrayPutI32(arrayAtObj(this.markers, 0), 0, 2048);
                arrayPutI32(arrayAtObj(this.markers, 1), 2, 4096);
                arrayPutI32(arrayAtObj(this.markers, 3), 1, 4096);
                arrayPutI32(arrayAtObj(this.markers, 0), 3, 0);
                arrayPutI32(arrayAtObj(this.markers, 2), 2, 4096);
                arrayPutI32(arrayAtObj(this.markers, 3), 2, 0);
                arrayPutI32(arrayAtObj(this.markers, 1), 0, 2867);
                arrayPutI32(arrayAtObj(this.markers, 1), 3, 0);
                arrayPutI32(arrayAtObj(this.markers, 2), 3, 0);
                arrayPutI32(arrayAtObj(this.markers, 3), 3, 0);
                arrayPutI32(arrayAtObj(this.markers, 2), 0, 3276);
                arrayPutI32(arrayAtObj(this.markers, 3), 0, 4096);
                return;
            default:
                throw new Error('Invalid gradient preset');
        }
    }

    // nk.a(ZI)[[I
    override getColourOutput(row: number, guard: boolean | number = true): ColourImageRow | null {
        const output = requireNonNull(this.colourImageCache).get(row);
        if (requireNonNull(this.colourImageCache).invalid) {
            const input = this.getChildMonochromeOutput(0, row, !guard);
            const r = arrayAtObj(output, 0),
                g = arrayAtObj(output, 1),
                b = arrayAtObj(output, 2);
            for (let x = 0; x < TextureOp.width; x++) {
                let value = arrayAtI32(input, x) >> 4;
                if (value < 0) value = 0;
                if (value > 256) value = 256;
                value = arrayAtI32(this.table, value);
                arrayPutI32(r, x, (value >> 12) & 4080);
                arrayPutI32(g, x, (value & 65280) >> 4);
                arrayPutI32(b, x, (value & 255) << 4);
            }
        }
        return output;
    }
}
