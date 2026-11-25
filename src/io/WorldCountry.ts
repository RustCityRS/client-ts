import { intDivide, intRemainder } from '#/util/IntUtils';
import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import type JagString from '#/datastruct/JagString';
import { loadClient, loadCookieStatics, loadScriptRunner } from '#/util/GamepackClasses';

// oa
export default class WorldCountry {
    // HD ee.a(I)V
    static releaseHdStatics(guard: number): void {
        try {
            const ScriptRunner = loadScriptRunner();
            releaseReferences(ScriptRunner, 'lengths');
            const CookieStatics = loadCookieStatics();
            releaseReferences(CookieStatics, 'gmtSuffix');
            const Client = loadClient();
            releaseReferences(Client, 'p12FullName');
            intRemainder(32, intDivide((-78 - guard) | 0, 34));
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'ee.A(' + guard + ')');
        }
    }

    flag = 0; // oa.d:I
    name: JagString | null = null; // oa.l:Lid;

    // oa.<init>()V
    constructor() {}
}
