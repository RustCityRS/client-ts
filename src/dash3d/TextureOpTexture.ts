import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import type PacketT from '#/io/PacketT';
import { intDivide } from '#/util/IntUtils';
import { arrayAtI32, arrayAtObj, arrayPutI32, requireNonNull } from '#/util/JavaArray';
import type { ColourImageRow } from './ColourImageCache';
import TextureOp from './TextureOp';
import { loadClient, loadClientBuild, loadLocalisedText } from '#/util/GamepackClasses';

export default class TextureOpTexture extends TextureOp {
    // HD ui.f(B)V
    static releaseTextureOpTextureStatics(guard: number): void {
        try {
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'englishMoreOptions', 'englishAttack', 'attack', 'MOREOPTIONS', 'germanLoadedFonts');
            if (guard <= 66) {
                return;
            }
            const Client = loadClient();
            releaseReferences(Client, 'seqConfigArchive');
            const ClientBuild = loadClientBuild();
            releaseReferences(ClientBuild, 'm_floort1');
            releaseReferences(LocalisedText, 'frenchChatcol0');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'ui.MA(' + guard + ')');
        }
    }

    private textureWidth = 0; // fk.Q:I
    private textureId = -1; // fk.R:I
    private pixels: Int32Array | null = null; // fk.T:[I
    private textureHeight = 0; // fk.Z:I

    // fk.<init>()V
    constructor() {
        super(0, false);
    }

    // fk.d(B)V
    override clearImageCache(): void {
        super.clearImageCache();
        this.pixels = null;
    }

    // fk.a(ZI)[[I
    override getColourOutput(row: number): ColourImageRow | null {
        const output = requireNonNull(this.colourImageCache).get(row);
        if (requireNonNull(this.colourImageCache).invalid && this.loadTexture()) {
            const red = arrayAtObj(output, 0);
            let offset = Math.imul(TextureOp.height === this.textureHeight ? row : intDivide(Math.imul(row, this.textureHeight), TextureOp.height), this.textureWidth);
            const green = arrayAtObj(output, 1);
            const blue = arrayAtObj(output, 2);
            if (this.textureWidth !== TextureOp.width) {
                for (let x = 0; x < TextureOp.width; x++) {
                    const sx = intDivide(Math.imul(x, this.textureWidth), TextureOp.width);
                    const pixel = arrayAtI32(this.pixels, (sx + offset) | 0);
                    arrayPutI32(blue, x, (pixel << 4) & 4080);
                    arrayPutI32(green, x, (pixel & 0xff00) >> 4);
                    arrayPutI32(red, x, (pixel >> 12) & 4080);
                }
                return output;
            }
            for (let x = 0; x < TextureOp.width; x++) {
                const pixel = arrayAtI32(this.pixels, offset);
                offset = (offset + 1) | 0;
                arrayPutI32(blue, x, (pixel << 4) & 4080);
                arrayPutI32(green, x, (pixel & 0xff00) >> 4);
                arrayPutI32(red, x, (pixel & 0xff0000) >> 12);
            }
        }
        return output;
    }

    // fk.a(I)I
    override getTextureId(): number {
        return this.textureId;
    }

    // fk.a(Lgd;ZI)V
    override decode(packet: PacketT | null, code: number): void {
        if (code === 0) this.textureId = requireNonNull(packet).g2();
    }

    // fk.f(I)Z
    private loadTexture(): boolean {
        if (this.pixels !== null) return true;
        if (this.textureId < 0) return false;
        const width = TextureOp.width;
        const height = TextureOp.height;
        const size = requireNonNull(TextureOp.textureProvider).getTextureSmall(this.textureId) ? 64 : 128;
        this.pixels = requireNonNull(TextureOp.textureProvider).getPixels(this.textureId);
        this.textureWidth = size;
        this.textureHeight = size;
        TextureOp.setSize(width, height);
        return this.pixels !== null;
    }
}
