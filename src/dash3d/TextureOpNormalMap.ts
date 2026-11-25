import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import type PacketT from '#/io/PacketT';
import { doubleToInt, intDivide } from '#/util/IntUtils';
import { arrayAtI32, arrayAtObj, arrayPutI32, requireNonNull } from '#/util/JavaArray';
import type { ColourImageRow } from './ColourImageCache';
import TextureOp from './TextureOp';
import { loadClient, loadClientKeyboardListener, loadLocalisedText } from '#/util/GamepackClasses';

// vf
export default class TextureOpNormalMap extends TextureOp {
    // HD an.f(B)V
    static releaseTextureOpNormalMapStatics(guard: number): void {
        try {
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'germanLoadingFonts', 'hidden', 'englishHidden');
            if (guard !== 119) {
                const Client = loadClient();
                Client.zoomWidth2 = 109;
            }
            const ClientKeyboardListener = loadClientKeyboardListener();
            releaseReferences(ClientKeyboardListener, 'instance');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'an.E(' + guard + ')');
        }
    }

    private bias = true; // vf.N:Z
    private scale = 4096; // vf.Q:I

    // vf.<init>()V
    constructor() {
        super(1, false);
    }

    // vf.a(Lgd;ZI)V
    override decode(packet: PacketT | null, code: number): void {
        if (code === 0) this.scale = requireNonNull(packet).g2();
        else if (code === 1) this.bias = requireNonNull(packet).g1() === 1;
    }

    // vf.a(ZI)[[I
    override getColourOutput(row: number, guard: boolean | number = true): ColourImageRow | null {
        const output = requireNonNull(this.colourImageCache).get(row);
        if (requireNonNull(this.colourImageCache).invalid) {
            const above = this.getChildMonochromeOutput(0, (row - 1) & TextureOp.heightMask, !guard);
            const centre = this.getChildMonochromeOutput(0, row);
            const below = this.getChildMonochromeOutput(0, (row + 1) & TextureOp.heightMask);
            const r = arrayAtObj(output, 0),
                g = arrayAtObj(output, 1),
                b = arrayAtObj(output, 2);
            for (let x = 0; x < TextureOp.width; x++) {
                const dx = Math.imul(this.scale, arrayAtI32(centre, (x + 1) & TextureOp.widthMask) - arrayAtI32(centre, (x - 1) & TextureOp.widthMask));
                const dy = Math.imul(this.scale, -arrayAtI32(above, x) + arrayAtI32(below, x));
                const nx = dx >> 12,
                    ny = dy >> 12;
                const xx = Math.imul(nx, nx) >> 12,
                    yy = Math.imul(ny, ny) >> 12;
                const len = doubleToInt(4096 * Math.sqrt(Math.fround((4096 + yy + xx) | 0) / 4096));
                let red = 0,
                    green = 0,
                    blue = 0;
                if (len !== 0) {
                    red = intDivide(dx, len);
                    blue = intDivide(16777216, len);
                    green = intDivide(dy, len);
                }
                if (this.bias) {
                    green = (green >> 1) + 2048;
                    red = (red >> 1) + 2048;
                    blue = (blue >> 1) + 2048;
                }
                arrayPutI32(r, x, red);
                arrayPutI32(g, x, green);
                arrayPutI32(b, x, blue);
            }
        }
        return output;
    }
}
