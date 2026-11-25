import { releaseReferences } from '#/util/StaticReferences';
import { requireNonNull } from '#/util/JavaArray';
import { isJavaRuntimeException } from '#/util/JavaException';
import WrappedException from '#/util/WrappedException';
import HashTable from './HashTable';
import ReferenceNode from './ReferenceNode';
import HardReferenceNode from './HardReferenceNode';
import ReferenceNodeFactory from './ReferenceNodeFactory';
import SoftReferenceNodeFactory from './SoftReferenceNodeFactory';
import SecondaryLinkedList from './SecondaryLinkedList';
import type SecondaryNode from './SecondaryNode';
import { loadClientBuild, loadDelayedStateChange, loadScriptRunner } from '#/util/GamepackClasses';

// fa.b(Z)Llh;
function loadFactory(): ReferenceNodeFactory | null {
    return typeof WeakRef === 'function' ? new SoftReferenceNodeFactory() : null;
}

// qi.a(Lei;ILei;)V
function insertAfter(position: SecondaryNode, node: SecondaryNode): void {
    if (node.secondaryPrev !== null) node.unlinkSecondary();
    node.secondaryPrev = position;
    node.secondaryNext = position.secondaryNext;
    requireNonNull(node.secondaryPrev).secondaryNext = node;
    requireNonNull(node.secondaryNext).secondaryPrev = node;
}

export default class LRUHashCache<T extends object> {
    // HD n.b(I)V
    static releaseHdStatics(guard: number): void {
        try {
            const ClientBuild = loadClientBuild();
            releaseReferences(ClientBuild, 'm_floors');
            const ScriptRunner = loadScriptRunner();
            releaseReferences(ScriptRunner, 'dateSeparator');
            if (guard !== 3101) {
                const DelayedStateChange = loadDelayedStateChange();
                DelayedStateChange.clientText(99, -14);
            }
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'n.A(' + guard + ')');
        }
    }

    // sa.p:Llh;
    static referenceFactory = loadFactory();

    // ve.a:I
    private readonly m_cacheSize: number;
    // ve.b:Ltb;
    private readonly queue = new SecondaryLinkedList<ReferenceNode<T>>();
    // ve.o:Lnc;
    private readonly table: HashTable<ReferenceNode<T>>;
    // ve.p:I
    private remaining: number;

    // ve.<init>(I)V
    constructor(capacity: number) {
        this.remaining = this.m_cacheSize = capacity;
        let buckets = 1;
        while (capacity > buckets + buckets) buckets += buckets;
        this.table = new HashTable(buckets);
    }

    // ve.a(JB)V
    Remove(key: bigint): void {
        const node = this.table.get(key);
        if (node !== null) {
            node.Unlink();
            node.unlinkSecondary();
            this.remaining = (this.remaining + 1) | 0;
        }
    }

    // SD ve.a(II)V, HD n.c(II)V. wk.b passes -127 and -126 to its two caches.
    Clean(maxAge: number, hdGuard?: -127 | -126): void {
        try {
            if (LRUHashCache.referenceFactory === null) return;
            for (let node = this.queue.head(); node !== null; node = this.queue.next()) {
                if (node.isSoft()) {
                    if (node.get() !== null) continue;
                    node.Unlink();
                    node.unlinkSecondary();
                    this.remaining = (this.remaining + 1) | 0;
                } else {
                    node.secondaryKey = BigInt.asIntN(64, node.secondaryKey + 1n);
                    if (node.secondaryKey > maxAge) {
                        const replacement = LRUHashCache.referenceFactory.create(node);
                        this.table.put(replacement, node.key);
                        insertAfter(node, replacement);
                        node.Unlink();
                        node.unlinkSecondary();
                    }
                }
            }
        } catch (error) {
            if (hdGuard === undefined || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'n.G(' + hdGuard + ',' + maxAge + ')');
        }
    }

    // ve.a(B)V
    removeSoft(): void {
        for (let node = this.queue.head(); node !== null; node = this.queue.next()) {
            if (node.isSoft()) {
                node.Unlink();
                node.unlinkSecondary();
                this.remaining = (this.remaining + 1) | 0;
            }
        }
    }

    // ve.a(I)V
    Reset(): void {
        this.queue.clear();
        this.table.clear();
        this.remaining = this.m_cacheSize;
    }

    // ve.b(B)I
    countHard(): number {
        let count = 0;
        for (let node = this.queue.head(); node !== null; node = this.queue.next()) {
            if (!node.isSoft()) count = (count + 1) | 0;
        }
        return count;
    }

    // ve.a(JZ)Ljava/lang/Object;
    Find(key: bigint): T | null {
        const node = this.table.get(key);
        if (!node) return null;
        const value = node.get();
        if (value === null) {
            node.Unlink();
            node.unlinkSecondary();
            this.remaining = (this.remaining + 1) | 0;
            return null;
        }
        if (!node.isSoft()) {
            this.queue.addTail(node);
            node.secondaryKey = 0n;
        } else {
            const hard = new HardReferenceNode(value);
            this.table.put(hard, node.key);
            this.queue.addTail(hard);
            hard.secondaryKey = 0n;
            node.Unlink();
            node.unlinkSecondary();
        }
        return value;
    }

    // ve.a(JLjava/lang/Object;B)V
    Put(key: bigint, value: T | null): void {
        this.Remove(key);
        if (this.remaining !== 0) this.remaining = (this.remaining - 1) | 0;
        else {
            const node = requireNonNull(this.queue.removeHead());
            node.Unlink();
            node.unlinkSecondary();
        }
        const node = new HardReferenceNode(value);
        this.table.put(node, key);
        this.queue.addTail(node);
        node.secondaryKey = 0n;
    }
}
