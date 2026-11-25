import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import Linkable from '#/datastruct/Linkable';
import { loadClient, loadLocalisedText, loadProtocol, loadWorldMap } from '#/util/GamepackClasses';

// c extends jf.
export default class ColourImageCacheEntry extends Linkable {
    // HD lb.c(I)V
    static releaseColourImageCacheEntryStatics(guard: number): void {
        try {
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'defaultChatcol1');
            const Client = loadClient();
            releaseReferences(Client, 'statBaseLevel');
            releaseReferences(LocalisedText, 'chatcol1');
            if (guard !== 25) {
                const WorldMap = loadWorldMap();
                WorldMap.reopen(-58);
            }
            releaseReferences(LocalisedText, 'englishChatcol1');
            const Protocol = loadProtocol();
            releaseReferences(Protocol, 'clanTag');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'lb.B(' + guard + ')');
        }
    }

    // c.q:I
    row: number;
    // c.u:I
    slot: number;

    // c.<init>(II)V
    constructor(row: number, slot: number) {
        super();
        this.row = row;
        this.slot = slot;
    }
}
