import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import type JagString from './JagString';
import Linkable from './Linkable';
import { loadLocalisedText, loadWorld, loadWorldMap } from '#/util/GamepackClasses';

export default class EnumStringEntry extends Linkable {
    // HD hb.d(I)V
    static releaseEnumStringEntryStatics(guard: number): void {
        try {
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'germanPleaseWait');
            const world = loadWorld();
            releaseReferences(world, 'midTab');
            releaseReferences(LocalisedText, 'frenchMillionSuffixAmount');
            if (guard > -16) {
                return;
            }
            const WorldMap = loadWorldMap();
            releaseReferences(WorldMap, 'overlayShapes');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'hb.B(' + guard + ')');
        }
    }

    // pd.q:Lid;
    value: JagString | null = null;

    // pd.<init>()V
    constructor();
    // pd.<init>(Lid;I)V
    constructor(value: JagString | null);
    constructor(value?: JagString | null) {
        super();
        if (value !== undefined) this.value = value;
    }
}
