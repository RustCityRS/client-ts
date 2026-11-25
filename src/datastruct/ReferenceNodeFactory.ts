import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import type ReferenceNode from './ReferenceNode';
import { loadClient, loadLocalisedText, loadPlayerModel } from '#/util/GamepackClasses';

export default abstract class ReferenceNodeFactory {
    // HD q.a(I)V
    static releaseHdStatics(guard: number): void {
        try {
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'germanConnectedToUpdateServer', 'frenchHidden');
            const Client = loadClient();
            releaseReferences(Client, 'cardLabel');
            const PlayerModel = loadPlayerModel();
            releaseReferences(PlayerModel, 'recolourDestinationsAlt');
            releaseReferences(Client, 'worldUrlAdvertFlag');
            releaseReferences(LocalisedText, 'frenchLoadingFonts');
            if (guard !== 0) {
                releaseReferences(LocalisedText, 'frenchHidden');
            }
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'q.B(' + guard + ')');
        }
    }

    // lh.<init>()V
    constructor() {}
    // lh.a(BLmk;)Lmk;
    abstract create<T extends object>(node: ReferenceNode<T>): ReferenceNode<T>;
}
