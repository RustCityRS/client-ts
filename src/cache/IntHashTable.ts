import { intDivide } from '#/util/IntUtils';
import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import { loadClient, loadLocalisedText, loadLocType } from '#/util/GamepackClasses';
export default class IntHashTable {
    // HD jg.a(B)V
    static releaseHdStatics(guard: number): void {
        try {
            const LocType = loadLocType();
            releaseReferences(LocType, 'm_pModels');
            const Client = loadClient();
            releaseReferences(Client, 'uidFile');
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'germanLoadedTitleScreen');
            intDivide(-9, intDivide((guard - 64) | 0, 53));
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'jg.B(' + guard + ')');
        }
    }

    // mf.f:[I
    private readonly entries: Int32Array;

    // mf.<init>([I)V
    constructor(keys: Int32Array) {
        let size = 1;
        while ((keys.length >> 1) + keys.length >= size) size <<= 1;
        this.entries = new Int32Array(size + size);
        this.entries.fill(-1);
        for (let i = 0; i < keys.length; i++) {
            let slot = keys[i] & (size - 1);
            while (this.entries[1 + slot + slot] !== -1) slot = (slot + 1) & (size - 1);
            this.entries[slot + slot] = keys[i];
            this.entries[slot + slot + 1] = i;
        }
    }

    // mf.a(II)I
    get(key: number): number {
        const mask = (this.entries.length >> 1) - 1;
        let slot = key & mask;
        for (;;) {
            const index = this.entries[slot + slot + 1];
            if (index === -1) return -1;
            if (this.entries[slot + slot] === key) return index;
            slot = (slot + 1) & mask;
        }
    }
}
