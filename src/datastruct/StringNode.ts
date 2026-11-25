import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import type JagString from './JagString';
import Linkable from './Linkable';
import { loadChatHistory, loadClient, loadLocalisedText, loadObjType } from '#/util/GamepackClasses';

export default class StringNode extends Linkable {
    // HD sj.d(I)V
    static releaseStringNodeStatics(guard: number): void {
        try {
            const ObjType = loadObjType();
            releaseReferences(ObjType, 'm_pModels');
            const ChatHistory = loadChatHistory();
            releaseReferences(ChatHistory, 'text');
            const Client = loadClient();
            releaseReferences(Client, 'colEndTag');
            if (guard !== -22749) {
                Client.maxLocModelsMissing = 66;
            }
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'frenchConnectingToUpdateServer');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'sj.C(' + guard + ')');
        }
    }

    // we.v:Lid;
    value: JagString | null = null;

    // we.<init>()V
    constructor();
    // we.<init>(Lid;)V
    constructor(value: JagString | null);
    constructor(value?: JagString | null) {
        super();
        if (value !== undefined) this.value = value;
    }
}
