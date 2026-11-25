import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import type PacketT from '#/io/PacketT';
import { arrayAtI32, arrayPutI32, requireNonNull } from '#/util/JavaArray';
import TextureOp from './TextureOp';
import { loadChatHistory, loadClient, loadJagString, loadLocalisedText, loadSpriteLoader } from '#/util/GamepackClasses';

// uh
export default class TextureOpBinary extends TextureOp {
    // HD ca.i(I)V
    static releaseTextureOpBinaryStatics(guard: number): void {
        try {
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'frenchExamine');
            const SpriteLoader = loadSpriteLoader();
            releaseReferences(SpriteLoader, 'innerHeights');
            const Client = loadClient();
            releaseReferences(Client, 'locChanges');
            const ChatHistory = loadChatHistory();
            releaseReferences(ChatHistory, 'types');
            const JagString = loadJagString();
            releaseReferences(JagString, 'nbsp');
            if (guard !== 1) {
                return;
            }
            releaseReferences(Client, 'soundEffectPositions', 'mapsArchive');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'ca.O(' + guard + ')');
        }
    }

    private max = 4096; // uh.T:I
    private min = 0; // uh.bb:I

    // uh.<init>()V
    constructor() {
        super(1, true);
    }

    // uh.a(Lgd;ZI)V
    override decode(packet: PacketT | null, code: number): void {
        if (code === 0) this.min = requireNonNull(packet).g2();
        else if (code === 1) this.max = requireNonNull(packet).g2();
    }

    // uh.a(IB)[I
    override getMonochromeOutput(row: number): Int32Array | null {
        const dst = requireNonNull(this.monochromeImageCache).get(row);
        if (requireNonNull(this.monochromeImageCache).invalid) {
            const src = this.getChildMonochromeOutput(0, row);
            for (let x = 0; x < TextureOp.width; x++) {
                const value = arrayAtI32(src, x);
                arrayPutI32(dst, x, this.min <= value && value <= this.max ? 4096 : 0);
            }
        }
        return dst;
    }
}
