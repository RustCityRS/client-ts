import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import SharedPtrList from '#/datastruct/SharedPtrList';
import { arrayAtObj, arrayPutObj, requireNonNull } from '#/util/JavaArray';
import MonochromeImageCacheEntry from './MonochromeImageCacheEntry';
import { loadClient, loadIfType, loadLocalisedText, loadMaterialManager, loadMinimenu } from '#/util/GamepackClasses';

export default class MonochromeImageCache {
    // HD pf.a(I)V
    static releaseHdStatics(guard: number): void {
        try {
            const IfType = loadIfType();
            releaseReferences(IfType, 'm_spriteCache');
            if (guard !== 65536) {
                const MaterialManager = loadMaterialManager();
                MaterialManager.waterSurfaceColour(-109, -68);
            }
            const Minimenu = loadMinimenu();
            releaseReferences(Minimenu, 'cursor');
            const Client = loadClient();
            releaseReferences(Client, 'ignoreName37');
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'germanMoreOptions');
            // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD cg stays deferred until pf.a(I)V in MonochromeImageCache.releaseHdStatics.
            const DataFile = (require('#/cache/DataFile') as typeof import('#/cache/DataFile')).default;
            releaseReferences(DataFile, 'masterIndexFile');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'pf.G(' + guard + ')');
        }
    }

    static dummy: MonochromeImageCacheEntry | null = new MonochromeImageCacheEntry(0, 0); // ri.R:Llc;

    private used = 0; // wk.c:I
    private singleRow = -1; // wk.f:I
    private height: number; // wk.g:I
    private entries: (MonochromeImageCacheEntry | null)[] | null; // wk.m:[Llc;
    private queue: SharedPtrList<MonochromeImageCacheEntry> | null = new SharedPtrList(); // wk.p:Lgk;
    private capacity: number; // wk.q:I
    private pixels: (Int32Array | null)[] | null; // wk.v:[[I
    invalid = false; // wk.w:Z

    // wk.<init>(III)V
    constructor(capacity: number, height: number, width: number) {
        this.capacity = capacity;
        if (this.capacity < 0 || width < 0) throw new RangeError('Negative array size');
        this.pixels = Array.from({ length: this.capacity }, () => new Int32Array(width));
        this.height = height;
        if (this.height < 0) throw new RangeError('Negative array size');
        this.entries = new Array<MonochromeImageCacheEntry | null>(this.height).fill(null);
    }

    // wk.a(IZ)[I
    get(row: number): Int32Array | null {
        if (this.height === this.capacity) {
            this.invalid = arrayAtObj(this.entries, row) === null;
            arrayPutObj(this.entries, row, MonochromeImageCache.dummy);
            return arrayAtObj(this.pixels, row);
        }
        if (this.capacity === 1) {
            this.invalid = row !== this.singleRow;
            this.singleRow = row;
            return arrayAtObj(this.pixels, 0);
        }

        let entry = arrayAtObj(this.entries, row);
        if (entry !== null) {
            this.invalid = false;
        } else {
            this.invalid = true;
            if (this.used < this.capacity) {
                entry = new MonochromeImageCacheEntry(row, this.used);
                this.used = (this.used + 1) | 0;
            } else {
                const last = requireNonNull(this.queue).tail();
                if (last !== null && !(last instanceof MonochromeImageCacheEntry)) throw new TypeError('ClassCastException: not a MonochromeImageCacheEntry');
                const oldest = requireNonNull(last);
                entry = new MonochromeImageCacheEntry(row, oldest.slot);
                arrayPutObj(this.entries, oldest.row, null);
                oldest.Unlink();
            }
            arrayPutObj(this.entries, row, entry);
        }
        requireNonNull(this.queue).push_front(entry);
        return arrayAtObj(this.pixels, entry.slot);
    }

    // wk.a(I)V
    clear(start: number): void {
        for (let i = start; i < this.capacity; i++) arrayPutObj(this.pixels, i, null);
        this.entries = null;
        this.pixels = null;
        requireNonNull(this.queue).clear();
        this.queue = null;
    }

    // wk.b(B)[[I
    getAll(): (Int32Array | null)[] | null {
        if (this.height !== this.capacity) throw new Error('Can only retrieve a full image cache');
        for (let i = 0; i < this.capacity; i++) arrayPutObj(this.entries, i, MonochromeImageCache.dummy);
        return this.pixels;
    }
}
