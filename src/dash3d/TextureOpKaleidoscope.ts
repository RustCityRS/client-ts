import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import type PacketT from '#/io/PacketT';
import { arrayAtI32, arrayAtObj, arrayPutI32, requireNonNull } from '#/util/JavaArray';
import type { ColourImageRow } from './ColourImageCache';
import TextureOp from './TextureOp';
import { loadBrowserControl, loadClient, loadInterfaceList, loadWorldMap } from '#/util/GamepackClasses';

// ti
export default class TextureOpKaleidoscope extends TextureOp {
    // HD je.i(I)V
    static releaseTextureOpKaleidoscopeStatics(guard: number): void {
        try {
            releaseReferences(TextureOp, 'sinTable');
            const Client = loadClient();
            releaseReferences(Client, 'objCountWhiteTag');
            const InterfaceList = loadInterfaceList();
            releaseReferences(InterfaceList, 'subInterfaces');
            const WorldMap = loadWorldMap();
            releaseReferences(WorldMap, 'archive');
            const BrowserControl = loadBrowserControl();
            releaseReferences(BrowserControl, 'jsShowingVideoAd');
            if (guard >= -100) {
                releaseReferences(BrowserControl, 'jsShowingVideoAd');
            }
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'je.R(' + guard + ')');
        }
    }

    static sampleX = 0; // kk.cb:I
    static sourceRow = 0; // ik.ab:I

    // ti.<init>()V
    constructor() {
        super(1, false);
    }

    // ti.a(Lgd;ZI)V
    override decode(packet: PacketT | null, code: number): void {
        if (code === 0) this.monochrome = requireNonNull(packet).g1() === 1;
    }

    // ti.a(IIB)V
    private transform(x: number, row: number): void {
        const fx = arrayAtI32(TextureOp.normalisedX, x);
        const fy = arrayAtI32(TextureOp.normalisedY, row);
        const angle = Math.fround(Math.atan2((fx - 2048) | 0, (fy - 2048) | 0));
        if (angle >= -Math.PI && angle <= (-3 * Math.PI) / 4) {
            TextureOpKaleidoscope.sampleX = x;
            TextureOpKaleidoscope.sourceRow = row;
        } else if (angle >= (-3 * Math.PI) / 4 && angle <= -Math.PI / 2) {
            TextureOpKaleidoscope.sampleX = row;
            TextureOpKaleidoscope.sourceRow = x;
        } else if (angle >= -Math.PI / 2 && angle <= -Math.PI / 4) {
            TextureOpKaleidoscope.sourceRow = x;
            TextureOpKaleidoscope.sampleX = (TextureOp.width - row) | 0;
        } else if (angle >= -Math.PI / 4 && angle <= 0) {
            TextureOpKaleidoscope.sourceRow = (TextureOp.height - row) | 0;
            TextureOpKaleidoscope.sampleX = x;
        } else if (angle >= 0 && angle <= Math.PI / 4) {
            TextureOpKaleidoscope.sampleX = (TextureOp.width - x) | 0;
            TextureOpKaleidoscope.sourceRow = (TextureOp.height - row) | 0;
        } else if (angle >= Math.PI / 4 && angle <= Math.PI / 2) {
            TextureOpKaleidoscope.sampleX = (TextureOp.width - row) | 0;
            TextureOpKaleidoscope.sourceRow = (TextureOp.height - x) | 0;
        } else if (angle >= Math.PI / 2 && angle <= (3 * Math.PI) / 4) {
            TextureOpKaleidoscope.sampleX = row;
            TextureOpKaleidoscope.sourceRow = (TextureOp.height - x) | 0;
        } else if (angle >= (3 * Math.PI) / 4 && angle <= Math.PI) {
            TextureOpKaleidoscope.sampleX = (TextureOp.width - x) | 0;
            TextureOpKaleidoscope.sourceRow = row;
        }
        TextureOpKaleidoscope.sampleX &= TextureOp.widthMask;
        TextureOpKaleidoscope.sourceRow &= TextureOp.heightMask;
    }

    // ti.a(IB)[I
    override getMonochromeOutput(row: number): Int32Array | null {
        const output = requireNonNull(this.monochromeImageCache).get(row);
        if (requireNonNull(this.monochromeImageCache).invalid) {
            for (let x = 0; x < TextureOp.width; x++) {
                this.transform(x, row);
                const source = this.getChildMonochromeOutput(0, TextureOpKaleidoscope.sourceRow);
                arrayPutI32(output, x, arrayAtI32(source, TextureOpKaleidoscope.sampleX));
            }
        }
        return output;
    }

    // ti.a(ZI)[[I
    override getColourOutput(row: number): ColourImageRow | null {
        const output = requireNonNull(this.colourImageCache).get(row);
        if (requireNonNull(this.colourImageCache).invalid) {
            const r = arrayAtObj(output, 0),
                b = arrayAtObj(output, 2),
                g = arrayAtObj(output, 1);
            for (let x = 0; x < TextureOp.width; x++) {
                this.transform(x, row);
                const source = this.getChildColourOutput(TextureOpKaleidoscope.sourceRow, 0);
                arrayPutI32(r, x, arrayAtI32(arrayAtObj(source, 0), TextureOpKaleidoscope.sampleX));
                arrayPutI32(g, x, arrayAtI32(arrayAtObj(source, 1), TextureOpKaleidoscope.sampleX));
                arrayPutI32(b, x, arrayAtI32(arrayAtObj(source, 2), TextureOpKaleidoscope.sampleX));
            }
        }
        return output;
    }
}
