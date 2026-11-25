import { intDivide, intRemainder } from '#/util/IntUtils';
import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import SecondaryNode from '#/datastruct/SecondaryNode';
import type ClientProj from './ClientProj';
import { loadClient, loadLocalisedText, loadMinimenu, loadQuickChatPhraseTypeList } from '#/util/GamepackClasses';

export default class ClientProjNode extends SecondaryNode {
    // HD ud.e(I)V
    static releaseClientProjNodeStatics(guard: number): void {
        try {
            const Minimenu = loadMinimenu();
            releaseReferences(Minimenu, 'countSeparator');
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'frenchChatcol6');
            intRemainder(54, intDivide((48 - guard) | 0, 56));
            const Client = loadClient();
            releaseReferences(Client, 'statUpdates', 'basesArchive');
            const QuickChatPhraseTypeList = loadQuickChatPhraseTypeList();
            releaseReferences(QuickChatPhraseTypeList, 'phrases');
            releaseReferences(LocalisedText, 'frenchLoading');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'ud.C(' + guard + ')');
        }
    }

    readonly projectile: ClientProj; // tf.G:Lhl;

    // tf.<init>(Lhl;)V
    constructor(projectile: ClientProj) {
        super();
        this.projectile = projectile;
    }
}
