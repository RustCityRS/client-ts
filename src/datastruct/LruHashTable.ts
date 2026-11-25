import { requireNonNull } from '#/util/JavaArray';
import HashTable from './HashTable';
import SecondaryLinkedList from './SecondaryLinkedList';
import SecondaryNode from './SecondaryNode';

export default class LruHashTable<T extends SecondaryNode = SecondaryNode> {
    // vj.e:Lei;
    private sentinel = new SecondaryNode();
    // vj.j:Lnc;
    private table: HashTable<T>;
    // vj.l:Ltb;
    private queue = new SecondaryLinkedList<T>();
    // vj.m:I
    private m_cacheSize: number;
    // vj.n:I
    private remaining: number;

    // vj.<init>(I)V
    constructor(capacity: number) {
        this.remaining = capacity;
        let buckets = 1;
        while (capacity > ((buckets + buckets) | 0)) {
            buckets = (buckets + buckets) | 0;
        }
        this.m_cacheSize = capacity;
        this.table = new HashTable<T>(buckets);
    }

    // vj.a(B)Ljf;
    next(): T | null {
        return this.table.next();
    }

    // vj.a(IJ)Lei;
    Find(key: bigint, lowWord?: number): T | null {
        const node = this.table.get(key, lowWord);
        if (node !== null) this.queue.addTail(node);
        return node;
    }

    // vj.a(I)Ljf;
    head(): T | null {
        return this.table.head();
    }

    // vj.a(JILei;)V
    Put(key: bigint, node: T): void {
        if (this.remaining === 0) {
            let evicted = requireNonNull(this.queue.removeHead());
            evicted.Unlink();
            evicted.unlinkSecondary();
            if (evicted === this.sentinel) {
                evicted = requireNonNull(this.queue.removeHead());
                evicted.Unlink();
                evicted.unlinkSecondary();
            }
        } else {
            this.remaining = (this.remaining - 1) | 0;
        }
        this.table.put(node, key);
        this.queue.addTail(node);
    }

    // vj.b(I)V
    Reset(): void {
        this.queue.clear();
        this.table.clear();
        this.sentinel = new SecondaryNode();
        this.remaining = this.m_cacheSize;
    }
}
