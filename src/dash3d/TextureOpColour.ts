import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import type PacketT from '#/io/PacketT';
import { arrayAtObj, arrayPutI32, requireNonNull } from '#/util/JavaArray';
import type { ColourImageRow } from './ColourImageCache';
import TextureOp from './TextureOp';
import { loadClient, loadFonts, loadJagString, loadLocalisedText, loadPlayerModel, loadQuickChatCatTypeList, loadWorldMap } from '#/util/GamepackClasses';

// gf
export default class TextureOpColour extends TextureOp {
    // HD fm.h(I)V
    static releaseTextureOpColourStatics(guard: number): void {
        try {
            const Fonts = loadFonts();
            releaseReferences(Fonts, 'b12FullName');
            const JagString = loadJagString();
            releaseReferences(JagString, 'minusSign');
            const WorldMap = loadWorldMap();
            releaseReferences(WorldMap, 'upper');
            const Client = loadClient();
            releaseReferences(Client, 'npcHitbarSprites');
            const PlayerModel = loadPlayerModel();
            releaseReferences(PlayerModel, 'layerFrameCycles');
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'frenchMenuSeparator');
            if (guard !== 1) {
                releaseReferences(Fonts, 'b12FullName');
            }
            const QuickChatCatTypeList = loadQuickChatCatTypeList();
            releaseReferences(QuickChatCatTypeList, 'types');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'fm.B(' + guard + ')');
        }
    }

    // gf.N:I
    private green = 0;
    // gf.U:I
    private blue = 0;
    // gf.V:I
    private red = 0;

    // gf.<init>()V delegates to gf.<init>(I)V.
    constructor();
    constructor(colour = 0) {
        super(0, false);
        this.setColour(colour);
    }

    // gf.d(II)V
    private setColour(rgb: number): void {
        this.green = (rgb & 0xff00) >> 4;
        this.blue = (rgb << 4) & 0xff0;
        this.red = (rgb >> 12) & 0xff0;
    }

    // gf.a(Lgd;ZI)V
    override decode(packet: PacketT | null, code: number): void {
        if (code === 0) this.setColour(requireNonNull(packet).g3());
    }

    // gf.a(ZI)[[I
    override getColourOutput(row: number): ColourImageRow | null {
        const pixels = requireNonNull(this.colourImageCache).get(row);
        if (requireNonNull(this.colourImageCache).invalid) {
            const green = arrayAtObj(pixels, 1);
            const red = arrayAtObj(pixels, 0);
            const blue = arrayAtObj(pixels, 2);
            for (let x = 0; x < TextureOp.width; x++) {
                arrayPutI32(red, x, this.red);
                arrayPutI32(green, x, this.green);
                arrayPutI32(blue, x, this.blue);
            }
        }
        return pixels;
    }
}
