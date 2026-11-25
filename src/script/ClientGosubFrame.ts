import { intDivide } from '#/util/IntUtils';
import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import type JagString from '#/datastruct/JagString';
import type { ClientScript } from './ClientScript';
import { loadClient, loadLocalisedText, loadMSITypeList } from '#/util/GamepackClasses';

// qf
export default class ClientGosubFrame {
    // HD hj.a(B)V
    static releaseHdStatics(guard: number): void {
        try {
            intDivide(103, intDivide((guard + 13) | 0, 52));
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'germanUse');
            const Client = loadClient();
            releaseReferences(Client, 'hintHeadiconsName');
            const MSITypeList = loadMSITypeList();
            releaseReferences(MSITypeList, 'archive');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'hj.B(' + guard + ')');
        }
    }

    script: ClientScript | null = null; // qf.d:Lm;
    strings: (JagString | null)[] | null = null; // qf.g:[Lid;
    pc = -1; // qf.i:I
    ints: Int32Array | null = null; // qf.k:[I

    // qf.<init>()V
    constructor() {}
}
