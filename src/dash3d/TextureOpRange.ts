import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import type PacketT from '#/io/PacketT';
import { arrayAtI32, arrayAtObj, arrayPutI32, requireNonNull } from '#/util/JavaArray';
import type { ColourImageRow } from './ColourImageCache';
import TextureOp from './TextureOp';
import { loadClient, loadGameShell, loadLocalisedText, loadTerrainBuilder } from '#/util/GamepackClasses';

// ge
export default class TextureOpRange extends TextureOp {
    // HD fh.h(I)V
    static releaseTextureOpRangeStatics(guard: number): void {
        try {
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'millionSuffixAmount', 'millionSuffix');
            if (guard !== 1024) {
                const GameShell = loadGameShell();
                releaseReferences(GameShell, 'errorSignlink');
            }
            releaseReferences(LocalisedText, 'englishMillionSuffixAmount');
            const Client = loadClient();
            releaseReferences(Client, 'noClipCommand');
            const GameShell = loadGameShell();
            releaseReferences(GameShell, 'fullScreenFrame');
            const TerrainBuilder = loadTerrainBuilder();
            releaseReferences(TerrainBuilder, 'useSurfaceHeight');
            releaseReferences(LocalisedText, 'frenchChatcol2');
            releaseReferences(GameShell, 'errorSignlink');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'fh.C(' + guard + ')');
        }
    }

    private range = 2048; // ge.N:I
    private max = 3072; // ge.T:I
    private min = 1024; // ge.W:I

    // ge.<init>()V
    constructor() {
        super(1, false);
    }

    // ge.a(Lgd;ZI)V
    override decode(packet: PacketT | null, code: number): void {
        if (code === 0) this.min = requireNonNull(packet).g2();
        else if (code === 1) this.max = requireNonNull(packet).g2();
        else if (code === 2) this.monochrome = requireNonNull(packet).g1() === 1;
    }

    // ge.b(I)V
    override postDecode(): void {
        this.range = (this.max - this.min) | 0;
    }

    // ge.a(IB)[I
    override getMonochromeOutput(row: number): Int32Array | null {
        const dst = requireNonNull(this.monochromeImageCache).get(row);
        if (requireNonNull(this.monochromeImageCache).invalid) {
            const src = this.getChildMonochromeOutput(0, row);
            for (let x = 0; x < TextureOp.width; x++) {
                arrayPutI32(dst, x, ((Math.imul(this.range, arrayAtI32(src, x)) >> 12) + this.min) | 0);
            }
        }
        return dst;
    }

    // ge.a(ZI)[[I
    override getColourOutput(row: number): ColourImageRow | null {
        const dst = requireNonNull(this.colourImageCache).get(row);
        if (requireNonNull(this.colourImageCache).invalid) {
            const rgb = this.getChildColourOutput(row, 0);
            const red = arrayAtObj(rgb, 0),
                green = arrayAtObj(rgb, 1),
                blue = arrayAtObj(rgb, 2);
            const outR = arrayAtObj(dst, 0),
                outG = arrayAtObj(dst, 1),
                outB = arrayAtObj(dst, 2);
            for (let x = 0; x < TextureOp.width; x++) {
                arrayPutI32(outR, x, ((Math.imul(arrayAtI32(red, x), this.range) >> 12) + this.min) | 0);
                arrayPutI32(outG, x, ((Math.imul(this.range, arrayAtI32(green, x)) >> 12) + this.min) | 0);
                arrayPutI32(outB, x, ((Math.imul(this.range, arrayAtI32(blue, x)) >> 12) + this.min) | 0);
            }
        }
        return dst;
    }
}
