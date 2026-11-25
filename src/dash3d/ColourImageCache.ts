import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import SharedPtrList from '#/datastruct/SharedPtrList';
import { arrayAtObj, arrayPutObj, requireNonNull } from '#/util/JavaArray';
import ColourImageCacheEntry from './ColourImageCacheEntry';
import { loadClient, loadIfType, loadLocalisedText, loadObjType, loadRouteFinding, loadScriptRunner, loadTitleFlames, loadWorldList } from '#/util/GamepackClasses';

export type ColourImageRow = (Int32Array | null)[];

// pi
export default class ColourImageCache {
    // HD nd.c(B)V
    static releaseHdStatics(guard: number): void {
        try {
            const Client = loadClient();
            releaseReferences(Client, 'materialsArchive');
            const IfType = loadIfType();
            releaseReferences(IfType, 'm_pFontMetrics');
            const RouteFinding = loadRouteFinding();
            releaseReferences(RouteFinding, 'm_distMap');
            const ScriptRunner = loadScriptRunner();
            releaseReferences(ScriptRunner, 'scriptErrorPrefix');
            const TitleFlames = loadTitleFlames();
            releaseReferences(TitleFlames, 'flameSprite');
            if (guard <= 25) {
                return;
            }
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'germanCancel');
            const WorldList = loadWorldList();
            releaseReferences(WorldList, 'settingsParamPrefix');
            // eslint-disable-next-line @typescript-eslint/no-require-imports -- BASTypeList stays deferred until nd.c(B)V in ColourImageCache.releaseHdStatics.
            const BASTypeList = (require('#/config/BASTypeList') as typeof import('#/config/BASTypeList')).default;
            releaseReferences(BASTypeList, 'archive');
            const ObjType = loadObjType();
            releaseReferences(ObjType, 'm_pConfigClient');
            // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD ab stays deferred until nd.c(B)V in ColourImageCache.releaseHdStatics.
            const TextureOpEmboss = (require('./TextureOpEmboss') as typeof import('./TextureOpEmboss')).default;
            releaseReferences(TextureOpEmboss, 'inverseNormalLength');
            releaseReferences(Client, 'jsZap');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'nd.B(' + guard + ')');
        }
    }

    // lh.c:Lc;
    static residentSentinel: ColourImageCacheEntry | null = new ColourImageCacheEntry(0, 0);

    // pi.a:[[[I
    private pixels: (ColourImageRow | null)[] | null;
    // pi.b:I
    private allocated = 0;
    // pi.e:I
    private capacity: number;
    // pi.n:I
    private lastRow = -1;
    // pi.f:Lgk;
    private recentlyUsed: SharedPtrList<ColourImageCacheEntry> | null = new SharedPtrList();
    // pi.w:Z
    invalid = false;
    // pi.h:I
    private height: number;
    // pi.j:[Lc;
    private entries: (ColourImageCacheEntry | null)[] | null;

    // pi.<init>(III)V
    constructor(capacity: number, height: number, width: number) {
        this.capacity = capacity;
        // multianewarray checks the width even when there are zero slots.
        if (this.capacity < 0 || width < 0) throw new RangeError('NegativeArraySizeException');
        this.pixels = Array.from({ length: this.capacity }, () => [new Int32Array(width), new Int32Array(width), new Int32Array(width)]);
        this.height = height;
        this.entries = new Array<ColourImageCacheEntry | null>(this.height).fill(null);
    }

    // pi.a(II)[[I. The second argument is at least 22 at every call site.
    get(row: number): ColourImageRow | null {
        if (this.capacity === this.height) {
            this.invalid = arrayAtObj(this.entries, row) === null;
            arrayPutObj(this.entries, row, ColourImageCache.residentSentinel);
            return arrayAtObj(this.pixels, row);
        }
        if (this.capacity === 1) {
            this.invalid = row !== this.lastRow;
            this.lastRow = row;
            return arrayAtObj(this.pixels, 0);
        }
        let entry = arrayAtObj(this.entries, row);
        if (entry === null) {
            this.invalid = true;
            if (this.allocated >= this.capacity) {
                const evicted = requireNonNull(requireNonNull(this.recentlyUsed).tail());
                if (!(evicted instanceof ColourImageCacheEntry)) throw new TypeError('ClassCastException: not a ColourImageCacheEntry');
                entry = new ColourImageCacheEntry(row, evicted.slot);
                arrayPutObj(this.entries, evicted.row, null);
                evicted.Unlink();
            } else {
                entry = new ColourImageCacheEntry(row, this.allocated);
                this.allocated = (this.allocated + 1) | 0;
            }
            arrayPutObj(this.entries, row, entry);
        } else {
            this.invalid = false;
        }
        requireNonNull(this.recentlyUsed).push_front(entry);
        return arrayAtObj(this.pixels, entry.slot);
    }

    // pi.a(B)[[[I. The full-image caller passes -18.
    getAll(): (ColourImageRow | null)[] | null {
        if (this.height !== this.capacity) throw new Error('Can only retrieve a full image cache');
        for (let row = 0; row < this.capacity; row++) arrayPutObj(this.entries, row, ColourImageCache.residentSentinel);
        return this.pixels;
    }

    // pi.b(B)V. bf.d(B)V passes -56.
    clear(): void {
        for (let slot = 0; slot < this.capacity; slot++) {
            arrayPutObj(arrayAtObj(this.pixels, slot), 0, null);
            arrayPutObj(arrayAtObj(this.pixels, slot), 1, null);
            arrayPutObj(arrayAtObj(this.pixels, slot), 2, null);
            arrayPutObj(this.pixels, slot, null);
        }
        this.entries = null;
        this.pixels = null;
        requireNonNull(this.recentlyUsed).clear();
        this.recentlyUsed = null;
    }
}
