import Linkable from './Linkable';
import { arrayAtObj, requireNonNull } from '#/util/JavaArray';

// Java masks the low int of the long key. Converting a small bigint directly avoids
// constructing a temporary bigint in every lookup; larger longs need an exact low-word cast.
function bucketIndex(capacity: number, key: bigint): number {
    const value = Number(key);
    const low = Number.isSafeInteger(value) ? value : Number(BigInt.asIntN(32, key));
    return (capacity - 1) & low;
}

function newBucket(): Linkable {
    const sentinel = new Linkable();
    sentinel.next = sentinel;
    sentinel.prev = sentinel;
    return sentinel;
}

export default class HashTable<T extends Linkable = Linkable> {
    // nc.e:I
    capacity: number;
    // nc.i:Ljf;
    private searchCursor: Linkable | null = null;
    // nc.n:[Ljf;
    buckets: Linkable[];
    private sparseBuckets?: Linkable[];
    // nc.u:J
    private searchKey = 0n;
    // nc.v:Ljf;
    private iterator: Linkable | null = null;
    // nc.w:I
    private bucket = 0;

    // nc.<init>(I)V
    constructor(capacity: number, sparse = false) {
        this.buckets = new Array<Linkable>(capacity);
        this.capacity = capacity;
        if (sparse) {
            // The large terrain seam tables touch few bucket indices. Public field access still
            // exposes a full array of distinct sentinels, including their original self-links.
            const slots = this.buckets;
            this.sparseBuckets = slots;
            Object.defineProperty(this, 'buckets', {
                configurable: true,
                enumerable: true,
                get: () => {
                    for (let i = 0; i < slots.length; i++) slots[i] ??= newBucket();
                    this.buckets = slots;
                    return slots;
                },
                set: (value: Linkable[]) => {
                    this.sparseBuckets = undefined;
                    Object.defineProperty(this, 'buckets', { value, enumerable: true, writable: true, configurable: true });
                }
            });
        } else {
            for (let i = 0; i < capacity; i++) this.buckets[i] = newBucket();
        }
    }

    private bucketFor(key: bigint, lowWord?: number): Linkable {
        const i = lowWord === undefined ? bucketIndex(this.capacity, key) : (this.capacity - 1) & lowWord;
        const slots = this.sparseBuckets;
        if (slots === undefined) return arrayAtObj(this.buckets, i);
        return arrayAtObj(slots, i) ?? (slots[i] = newBucket());
    }

    // nc.a(BJ)Ljf;
    get(key: bigint, lowWord?: number): T | null {
        this.searchKey = key;
        const sentinel = this.bucketFor(key, lowWord);
        this.searchCursor = sentinel.next;
        while (this.searchCursor !== sentinel) {
            const node: Linkable = requireNonNull(this.searchCursor);
            if (node.key === key) {
                this.searchCursor = node.next;
                return node as T;
            }
            this.searchCursor = node.next;
        }
        this.searchCursor = null;
        return null;
    }

    // nc.a(B)Ljf;
    nextWithKey(): T | null {
        if (this.searchCursor === null) return null;
        const sentinel = this.bucketFor(this.searchKey);
        while (sentinel !== this.searchCursor) {
            const node: Linkable = requireNonNull(this.searchCursor);
            if (this.searchKey === node.key) {
                this.searchCursor = node.next;
                return node as T;
            }
            this.searchCursor = node.next;
        }
        this.searchCursor = null;
        return null;
    }

    // nc.a(BLjf;J)V
    put(node: T, key: bigint, lowWord?: number): void {
        if (node.prev !== null) node.Unlink();
        const sentinel = this.bucketFor(key, lowWord);
        node.key = key;
        node.next = sentinel;
        node.prev = sentinel.prev;
        requireNonNull(node.prev).next = node;
        requireNonNull(node.next).prev = node;
    }

    // nc.a(Z)V
    clear(): void {
        for (let bucket = 0; bucket < this.capacity; bucket++) {
            const sentinel = this.buckets[bucket];
            while (true) {
                const node = requireNonNull(sentinel.next);
                if (sentinel === node) break;
                node.Unlink();
            }
        }
        this.iterator = null;
        this.searchCursor = null;
    }

    // nc.c(B)Ljf;
    head(): T | null {
        this.bucket = 0;
        return this.next();
    }

    // nc.a(I)Ljf;
    next(): T | null {
        if (this.bucket > 0 && this.iterator !== this.buckets[this.bucket - 1]) {
            const node = this.iterator as T;
            this.iterator = node.next;
            return node;
        }
        while (this.capacity > this.bucket) {
            const node = requireNonNull(this.buckets[this.bucket++].next);
            if (this.buckets[this.bucket - 1] !== node) {
                this.iterator = node.next;
                return node as T;
            }
        }
        return null;
    }

    // nc.b(I)I
    getBucketCount(): number {
        return this.capacity;
    }

    // nc.d(B)I
    size(): number {
        let count = 0;
        for (let bucket = 0; bucket < this.capacity; bucket++) {
            const sentinel = this.buckets[bucket];
            let node = sentinel.next;
            while (sentinel !== node) {
                count = (count + 1) | 0;
                node = requireNonNull(node).next;
            }
        }
        return count;
    }
}
