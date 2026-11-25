import { releaseReferences } from '#/util/StaticReferences';
import { glJar } from '#/client/ClientVariant';
import type PacketT from '#/io/PacketT';
import ArrayUtils from '#/util/ArrayUtils';
import { intDivide, intRemainder } from '#/util/IntUtils';
import { isJavaRuntimeException } from '#/util/JavaException';
import WrappedException from '#/util/WrappedException';
import { arrayAtI32, arrayPutI32, requireNonNull } from '#/util/JavaArray';
import TextureOp from './TextureOp';
import { loadGameShell, loadInterfaceList, loadLocalisedText, loadMinimenu } from '#/util/GamepackClasses';

// vg
export default class TextureOpStripes extends TextureOp {
    // HD d.f(B)V
    static releaseTextureOpStripesStatics(guard: number): void {
        try {
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'close');
            const Minimenu = loadMinimenu();
            releaseReferences(Minimenu, 'actions');
            if (guard !== 122) {
                TextureOpStripes.floorMod(62, -109, 127);
            }
            const GameShell = loadGameShell();
            releaseReferences(GameShell, 'frame');
            releaseReferences(Minimenu, 'tooltipRandom');
            releaseReferences(LocalisedText, 'englishClose');
            releaseReferences(Minimenu, 'titleBarSprite');
            const InterfaceList = loadInterfaceList();
            releaseReferences(InterfaceList, 'pressedContinue');
            // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD sj stays deferred until d.f(B)V in TextureOpStripes.releaseTextureOpStripesStatics.
            const ParamType = (require('#/config/ParamType') as typeof import('#/config/ParamType')).default;
            releaseReferences(ParamType, 'm_pConfigClient');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'd.E(' + guard + ')');
        }
    }

    // HD d.c(III)I
    static floorMod(value: number, divisor: number, guard: number): number {
        try {
            const sign = (divisor - 1) & (value >> 31);
            intRemainder(-95, intDivide((33 - guard) | 0, 54));
            return (sign + intRemainder((value + (value >>> 31)) | 0, divisor)) | 0;
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'd.C(' + value + ',' + divisor + ',' + guard + ')');
        }
    }

    private count = 10; // vg.X:I
    private orientation: number; // vg.P:I
    private duty: number; // vg.gb:I
    private starts: Int32Array | null = null; // vg.bb:[I
    private ends: Int32Array | null = null; // vg.W:[I

    // vg.<init>()V
    constructor() {
        super(0, true);
        this.orientation = 0;
        this.duty = 2048;
    }

    // vg.a(Lgd;ZI)V
    override decode(packet: PacketT | null, code: number): void {
        if (code === 0) this.count = requireNonNull(packet).g1();
        else if (code === 1) this.duty = requireNonNull(packet).g2();
        else if (code === 2) this.orientation = requireNonNull(packet).g1();
    }

    // vg.a(IB)[I
    override getMonochromeOutput(row: number): Int32Array | null {
        const output = requireNonNull(this.monochromeImageCache).get(row);
        if (requireNonNull(this.monochromeImageCache).invalid) {
            const y = arrayAtI32(TextureOp.normalisedY, row);
            if (this.orientation !== 0) {
                for (let x = 0; x < TextureOp.width; x++) {
                    const px = arrayAtI32(TextureOp.normalisedX, x);
                    let coord = 0;
                    let value = 0;
                    if (this.orientation === 1) coord = px;
                    else if (this.orientation === 2) coord = 2048 + ((px + y - 4096) >> 1);
                    else if (this.orientation === 3) coord = 2048 + ((px - y) >> 1);
                    for (let i = 0; i < this.count; i++) {
                        if (coord >= arrayAtI32(this.starts, i) && coord < arrayAtI32(this.starts, i + 1)) {
                            if (coord < arrayAtI32(this.ends, i)) value = 4096;
                            break;
                        }
                    }
                    arrayPutI32(output, x, value);
                }
            } else {
                let value = 0;
                for (let i = 0; i < this.count; i++) {
                    if (y >= arrayAtI32(this.starts, i) && y < arrayAtI32(this.starts, i + 1)) {
                        if (y < arrayAtI32(this.ends, i)) value = 4096;
                        break;
                    }
                }
                ArrayUtils.fillInts(output, 0, TextureOp.width, value);
            }
        }
        return output;
    }

    // SD vg.b(Z)V, HD d.h(I)V
    private createStripes(): void {
        if (!glJar) this.starts = new Int32Array((1 + this.count) | 0);
        let start = 0;
        this.ends = new Int32Array((1 + this.count) | 0);
        const interval = intDivide(4096, this.count);
        if (glJar) this.starts = new Int32Array((1 + this.count) | 0);
        const width = Math.imul(this.duty, interval) >> 12;
        for (let i = 0; i < this.count; i++) {
            arrayPutI32(this.starts, i, start);
            arrayPutI32(this.ends, i, (start + width) | 0);
            start = (start + interval) | 0;
        }
        arrayPutI32(this.starts, this.count, 4096);
        arrayPutI32(this.ends, this.count, (arrayAtI32(this.ends, 0) + 4096) | 0);
    }

    // vg.b(I)V
    override postDecode(): void {
        this.createStripes();
    }
}
