import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import TextureOp from './TextureOp';
import { loadClient, loadCookieStatics, loadMSITypeList, loadScriptRunner } from '#/util/GamepackClasses';

// sc
export default class TextureOpHorizontalGradient extends TextureOp {
    // HD rl.h(I)V
    static releaseTextureOpHorizontalGradientStatics(guard: number): void {
        try {
            const CookieStatics = loadCookieStatics();
            releaseReferences(CookieStatics, 'dayNames', 'wed', 'fri');
            const ScriptRunner = loadScriptRunner();
            releaseReferences(ScriptRunner, 'errorInLabel');
            releaseReferences(CookieStatics, 'sun', 'mon', 'tue');
            if (guard !== 7759444) {
                TextureOpHorizontalGradient.releaseTextureOpHorizontalGradientStatics(72);
            }
            const MSITypeList = loadMSITypeList();
            releaseReferences(MSITypeList, 'spriteCache');
            releaseReferences(CookieStatics, 'thu');
            const Client = loadClient();
            releaseReferences(Client, 'headiconsPk', 'hitmarksSpriteName');
            releaseReferences(CookieStatics, 'sat');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'rl.C(' + guard + ')');
        }
    }

    // sc.<init>()V
    constructor() {
        super(0, true);
    }

    // sc.a(IB)[I
    override getMonochromeOutput(_row: number): Int32Array | null {
        return TextureOp.normalisedX;
    }
}
