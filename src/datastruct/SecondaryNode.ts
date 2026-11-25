import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import { requireNonNull } from '#/util/JavaArray';
import Linkable from './Linkable';
import { loadClient, loadLocalisedText, loadNpcType } from '#/util/GamepackClasses';

export default class SecondaryNode extends Linkable {
    // HD rg.c(I)V
    static releaseSecondaryNodeStatics(guard: number): void {
        try {
            const Client = loadClient();
            releaseReferences(Client, 'jingleArchive');
            if (guard !== -3) {
                return;
            }
            releaseReferences(Client, 'friendWorldName');
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'englishStarted3dLibrary');
            const NpcType = loadNpcType();
            releaseReferences(NpcType, 'slotFrameCycles');
            releaseReferences(LocalisedText, 'started3dLibrary');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'rg.QA(' + guard + ')');
        }
    }

    // ei.t:Lei;
    secondaryNext: SecondaryNode | null = null;
    // ei.v:J
    secondaryKey = 0n;
    // ei.z:Lei;
    secondaryPrev: SecondaryNode | null = null;

    // ei.<init>()V
    constructor() {
        super();
    }

    // ei.b(I)V
    unlinkSecondary(): void {
        if (this.secondaryPrev !== null) {
            requireNonNull(this.secondaryPrev).secondaryNext = this.secondaryNext;
            requireNonNull(this.secondaryNext).secondaryPrev = this.secondaryPrev;
            this.secondaryNext = null;
            this.secondaryPrev = null;
        }
    }
}
