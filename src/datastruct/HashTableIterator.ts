import { intDivide } from '#/util/IntUtils';
import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import HashTable from './HashTable';
import type Linkable from './Linkable';
import { arrayAtObj, requireNonNull } from '#/util/JavaArray';
import { loadClient, loadClientBuild, loadPlayerModel, loadWorldList } from '#/util/GamepackClasses';

export default class HashTableIterator<T extends Linkable = Linkable> {
    // HD l.b(B)V
    static releaseHdStatics(guard: number): void {
        try {
            const ClientBuild = loadClientBuild();
            releaseReferences(ClientBuild, 'm_sattot');
            intDivide(118, intDivide((-33 - guard) | 0, 45));
            const PlayerModel = loadPlayerModel();
            releaseReferences(PlayerModel, 'modelCache');
            const WorldList = loadWorldList();
            releaseReferences(WorldList, 'urlJsSegment');
            // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD fg stays deferred until l.b(B)V in HashTableIterator.releaseHdStatics.
            const SoftwareFont = (require('#/graphics/SoftwareFont') as typeof import('#/graphics/SoftwareFont')).default;
            releaseReferences(SoftwareFont, 'cache');
            const Client = loadClient();
            releaseReferences(Client, 'imageMapdots');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'l.E(' + guard + ')');
        }
    }

    // oj.b:I
    private bucket = 0;
    // oj.g:Lnc;
    private readonly table: HashTable<T>;
    // oj.m:Ljf;
    private cursor: Linkable | null = null;

    // oj.<init>(Lnc;)V
    constructor(table: HashTable<T>) {
        this.table = table;
    }

    // oj.a(I)Ljf;
    next(): T | null {
        if (this.bucket > 0 && arrayAtObj(this.table.buckets, this.bucket - 1) !== this.cursor) {
            const node = requireNonNull(this.cursor);
            this.cursor = node.next;
            return node as T;
        }
        while (this.bucket < this.table.capacity) {
            const sentinel = arrayAtObj(this.table.buckets, this.bucket++);
            const node = requireNonNull(sentinel.next);
            if (node !== sentinel) {
                this.cursor = node.next;
                return node as T;
            }
        }
        return null;
    }

    // oj.b(I)Ljf;
    head(): T | null {
        this.bucket = 0;
        return this.next();
    }
}
