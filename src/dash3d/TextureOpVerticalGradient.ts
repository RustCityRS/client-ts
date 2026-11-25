import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import ArrayUtils from '#/util/ArrayUtils';
import { arrayAtI32, requireNonNull } from '#/util/JavaArray';
import TextureOp from './TextureOp';
import { loadClient, loadIfType, loadOrbitCamera, loadQuickChatPhraseType } from '#/util/GamepackClasses';

// dk
export default class TextureOpVerticalGradient extends TextureOp {
    // HD qg.a(Z)V
    static releaseTextureOpVerticalGradientStatics(guard: boolean): void {
        try {
            const OrbitCamera = loadOrbitCamera();
            releaseReferences(OrbitCamera, 'shakeFrequency');
            if (!guard) {
                return;
            }
            const IfType = loadIfType();
            releaseReferences(IfType, 'm_pInterfaces');
            const QuickChatPhraseType = loadQuickChatPhraseType();
            releaseReferences(QuickChatPhraseType, 'empty');
            const Client = loadClient();
            releaseReferences(Client, 'gcPrefix');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'qg.S(' + guard + ')');
        }
    }

    // dk.<init>()V
    constructor() {
        super(0, true);
    }

    // dk.a(IB)[I
    override getMonochromeOutput(row: number): Int32Array | null {
        const pixels = requireNonNull(this.monochromeImageCache).get(row);
        if (requireNonNull(this.monochromeImageCache).invalid) {
            ArrayUtils.fillInts(pixels, 0, TextureOp.width, arrayAtI32(TextureOp.normalisedY, row));
        }
        return pixels;
    }
}
