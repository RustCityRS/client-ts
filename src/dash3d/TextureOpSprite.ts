import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import type Js5 from '#/cache/Js5';
import SpriteLoader from '#/graphics/SpriteLoader';
import type PacketT from '#/io/PacketT';
import { intDivide } from '#/util/IntUtils';
import { arrayAtI32, arrayAtObj, arrayPutI32, requireNonNull } from '#/util/JavaArray';
import type { ColourImageRow } from './ColourImageCache';
import TextureOp from './TextureOp';
import LocalisedTextClass from '#/ui/LocalisedText';
import ObjTypeClass from '#/config/ObjType';
import { loadClient } from '#/util/GamepackClasses';

export default class TextureOpSprite extends TextureOp {
    // HD nh.f(B)V
    static releaseTextureOpSpriteStatics(guard: number): void {
        try {
            const LocalisedText = LocalisedTextClass;
            releaseReferences(LocalisedText, 'germanChateffect3', 'englishLoadingPleaseWait2');
            if (guard >= -11) {
                const ObjType = ObjTypeClass;
                ObjType.m_numDefinitions = -68;
            }
            releaseReferences(LocalisedText, 'loadingPleaseWait2');
            const Client = loadClient();
            releaseReferences(Client, 'fpsCommand', 'archiveLoadWeights');
            releaseReferences(LocalisedText, 'germanLoading');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'nh.DA(' + guard + ')');
        }
    }

    static spriteGroupId = -1; // hg.a:I
    static spriteArchive: Js5 | null = null; // jf.o:Lal;

    protected spriteHeight = 0; // la.N:I
    private spriteId = -1; // la.Y:I
    protected spriteWidth = 0; // la.lb:I
    protected pixels: Int32Array | null = null; // la.mb:[I

    // la.<init>()V
    constructor() {
        super(0, false);
    }

    // la.f(I)Z
    protected loadSprite(): boolean {
        if (this.pixels !== null) return true;
        if (this.spriteId < 0) return false;
        const sprite = TextureOpSprite.spriteGroupId >= 0 ? SpriteLoader.loadSoftwareSprite(TextureOpSprite.spriteArchive, TextureOpSprite.spriteGroupId, this.spriteId) : SpriteLoader.loadSprite(this.spriteId, TextureOpSprite.spriteArchive);
        requireNonNull(sprite).trim();
        this.spriteHeight = requireNonNull(sprite).height;
        this.spriteWidth = requireNonNull(sprite).width;
        this.pixels = requireNonNull(sprite).pixels;
        return true;
    }

    // la.a(Lgd;ZI)V
    override decode(packet: PacketT | null, code: number): void {
        if (code === 0) this.spriteId = requireNonNull(packet).g2();
    }

    // la.c(B)I
    override getSpriteId(): number {
        return this.spriteId;
    }

    // la.a(ZI)[[I
    override getColourOutput(row: number): ColourImageRow | null {
        const output = requireNonNull(this.colourImageCache).get(row);
        if (requireNonNull(this.colourImageCache).invalid && this.loadSprite()) {
            const red = arrayAtObj(output, 0);
            const green = arrayAtObj(output, 1);
            const blue = arrayAtObj(output, 2);
            let offset = Math.imul(this.spriteWidth, this.spriteHeight === TextureOp.height ? row : intDivide(Math.imul(row, this.spriteHeight), TextureOp.height));
            if (this.spriteWidth !== TextureOp.width) {
                for (let x = 0; x < TextureOp.width; x++) {
                    const sx = intDivide(Math.imul(x, this.spriteWidth), TextureOp.width);
                    const pixel = arrayAtI32(this.pixels, (sx + offset) | 0);
                    arrayPutI32(blue, x, (pixel << 4) & 4080);
                    arrayPutI32(green, x, (pixel >> 4) & 4080);
                    arrayPutI32(red, x, (pixel & 0xff0000) >> 12);
                }
            } else {
                for (let x = 0; x < TextureOp.width; x++) {
                    const pixel = arrayAtI32(this.pixels, offset);
                    offset = (offset + 1) | 0;
                    arrayPutI32(blue, x, (pixel & 255) << 4);
                    arrayPutI32(green, x, (pixel & 0xff00) >> 4);
                    arrayPutI32(red, x, (pixel >> 12) & 4080);
                }
            }
        }
        return output;
    }

    // la.d(B)V
    override clearImageCache(): void {
        super.clearImageCache();
        this.pixels = null;
    }
}
