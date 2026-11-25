import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import QuickChatPhraseTypeList from '#/config/QuickChatPhraseTypeList';
import QuickChatPhraseType from '#/config/QuickChatPhraseType';
import PacketT from '#/io/PacketT';
import LocalisedTextClass from '#/ui/LocalisedText';
import IdkTypeClass from '#/config/IdkType';
import { glJar } from './ClientVariant';
import { requireNonNull } from '#/util/JavaArray';

export default class QuickChatPhrase {
    // HD bd.a(I)V
    static releaseHdStatics(guard: number): void {
        try {
            const LocalisedText = LocalisedTextClass;
            releaseReferences(LocalisedText, 'loadingPercentEnd', 'germanSelect');
            if (guard !== 0) {
                releaseReferences(LocalisedText, 'loadingPercentEnd');
            }
            const IdkType = IdkTypeClass;
            releaseReferences(IdkType, 'm_pModels');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'bd.A(' + guard + ')');
        }
    }

    // d.g:I
    id = 0;
    // d.k:[I
    values: Int32Array | null = null;
    // d.o:Lpe;
    type: QuickChatPhraseType | null = null;
    // d.<init>()V
    constructor() {}

    // SD uc.a(ILgd;)Ld;, HD vh.a(ILwa;)Lbd; with guard 1024.
    static read(packet: PacketT | null): QuickChatPhrase {
        try {
            const message = new QuickChatPhrase();
            message.id = requireNonNull(packet).g2(glJar ? 1 : undefined);
            message.type = QuickChatPhraseTypeList.GetQuickChatPhraseType(message.id);
            return message;
        } catch (error) {
            if (!glJar || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'vh.M(1024,' + (packet === null ? 'null' : '{...}') + ')');
        }
    }
}
