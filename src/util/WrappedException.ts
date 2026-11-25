import { releaseReferences } from './StaticReferences';
import { loadClient, loadJagString, loadMinimenu, loadObjType, loadQuickChatPhraseType } from './GamepackClasses';
export default class WrappedException extends Error {
    // HD ld.a(Z)V
    static releaseHdStatics(guard: boolean): void {
        const QuickChatPhraseType = loadQuickChatPhraseType();
        releaseReferences(QuickChatPhraseType, 'sendWidths');
        const Minimenu = loadMinimenu();
        releaseReferences(Minimenu, 'hiddenUse');
        const Client = loadClient();
        releaseReferences(Client, 'hintArrows');
        const ObjType = loadObjType();
        releaseReferences(ObjType, 'inventoryOps');
        if (guard) {
            const JagString = loadJagString();
            JagString.toUpperCaseChar(-64, -87);
        }
        releaseReferences(Client, 'worldListHost');
    }

    override cause: Error | null; // g.a:Ljava/lang/Throwable;
    context: string | null; // g.q:Ljava/lang/String;

    // g.<init>(Ljava/lang/Throwable;Ljava/lang/String;)V
    constructor(cause: Error | null, context: string | null) {
        super();
        this.context = context;
        this.cause = cause;
    }

    // od.a(Ljava/lang/Throwable;Ljava/lang/String;)Lg;
    static wrap(cause: Error | null, context: string | null): WrappedException {
        if (!(cause instanceof WrappedException)) return new WrappedException(cause, context);
        cause.context = cause.context + ' ' + context;
        return cause;
    }
}
