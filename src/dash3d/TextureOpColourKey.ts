import { intDivide } from '#/util/IntUtils';
import { glJar } from '#/client/ClientVariant';
import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import type PacketT from '#/io/PacketT';
import { arrayAtI32, arrayAtObj, arrayPutI32, requireNonNull } from '#/util/JavaArray';
import type { ColourImageRow } from './ColourImageCache';
import TextureOp from './TextureOp';
import { loadLocalisedText, loadMSITypeList, loadStructType } from '#/util/GamepackClasses';

// va
export default class TextureOpColourKey extends TextureOp {
    // HD sk.f(B)V
    static releaseTextureOpColourKeyStatics(guard: number): void {
        try {
            intDivide(100, intDivide((76 - guard) | 0, 44));
            const MSITypeList = loadMSITypeList();
            releaseReferences(MSITypeList, 'types');
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'germanPreparedSoundEngine', 'germanExamine');
            const StructType = loadStructType();
            releaseReferences(StructType, 'm_recentUse');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'sk.B(' + guard + ')');
        }
    }

    private keyColour: Int32Array | null = new Int32Array(3); // va.P:[I
    private tolerance = 409; // va.R:I
    private redScale = 4096; // va.T:I
    private blueScale = 4096; // va.V:I
    private greenScale = 4096; // va.W:I

    // va.<init>()V
    constructor() {
        super(1, false);
    }

    // va.a(Lgd;ZI)V
    override decode(packet: PacketT | null, code: number): void {
        if (code === 0) this.tolerance = requireNonNull(packet).g2();
        else if (code === 1) this.blueScale = requireNonNull(packet).g2();
        else if (code === 2) this.greenScale = requireNonNull(packet).g2();
        else if (code === 3) this.redScale = requireNonNull(packet).g2();
        else if (code === 4) {
            const rgb = requireNonNull(packet).g3();
            if (glJar) {
                arrayPutI32(this.keyColour, 2, (rgb & 255) >> 12);
                arrayPutI32(this.keyColour, 1, 4080 & (rgb >> 4));
                arrayPutI32(this.keyColour, 0, (rgb & 0xff0000) << 4);
            } else {
                arrayPutI32(this.keyColour, 0, (rgb & 0xff0000) << 4);
                arrayPutI32(this.keyColour, 1, 4080 & (rgb >> 4));
                arrayPutI32(this.keyColour, 2, (rgb & 255) >> 12);
            }
        }
    }

    // va.a(ZI)[[I
    override getColourOutput(row: number): ColourImageRow | null {
        const dest = requireNonNull(this.colourImageCache).get(row);
        if (requireNonNull(this.colourImageCache).invalid) {
            const source = this.getChildColourOutput(row, 0);
            const red = arrayAtObj(source, 0);
            let blue: Int32Array | null, green: Int32Array | null;
            if (glJar) {
                green = arrayAtObj(source, 1);
                blue = arrayAtObj(source, 2);
            } else {
                blue = arrayAtObj(source, 2);
                green = arrayAtObj(source, 1);
            }
            const outRed = arrayAtObj(dest, 0),
                outGreen = arrayAtObj(dest, 1),
                outBlue = arrayAtObj(dest, 2);
            for (let x = 0; x < TextureOp.width; x++) {
                const r = arrayAtI32(red, x);
                let delta = (r - arrayAtI32(this.keyColour, 0)) | 0;
                if (delta < 0) delta = -delta | 0;
                if (this.tolerance < delta) {
                    arrayPutI32(outRed, x, r);
                    arrayPutI32(outGreen, x, arrayAtI32(green, x));
                    arrayPutI32(outBlue, x, arrayAtI32(blue, x));
                } else {
                    const g = arrayAtI32(green, x);
                    delta = (g - arrayAtI32(this.keyColour, 1)) | 0;
                    if (delta < 0) delta = -delta | 0;
                    if (this.tolerance < delta) {
                        arrayPutI32(outRed, x, r);
                        arrayPutI32(outGreen, x, g);
                        arrayPutI32(outBlue, x, arrayAtI32(blue, x));
                    } else {
                        const b = arrayAtI32(blue, x);
                        delta = (b - arrayAtI32(this.keyColour, 2)) | 0;
                        if (delta < 0) delta = -delta | 0;
                        if (delta > this.tolerance) {
                            arrayPutI32(outRed, x, r);
                            arrayPutI32(outGreen, x, g);
                            arrayPutI32(outBlue, x, b);
                        } else {
                            arrayPutI32(outRed, x, Math.imul(this.redScale, r) >> 12);
                            arrayPutI32(outGreen, x, Math.imul(this.greenScale, g) >> 12);
                            arrayPutI32(outBlue, x, Math.imul(this.blueScale, b) >> 12);
                        }
                    }
                }
            }
        }
        return dest;
    }
}
