import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import { arrayPutObj, requireNonNull } from '#/util/JavaArray';
import type TerrainBatch from '#/dash3d/TerrainBatch';
import Linkable from './Linkable';
import { loadWorld } from '#/util/GamepackClasses';

export default class SharedPtrList<T extends Linkable = Linkable> {
    // HD ih.c(I)V
    static releaseHdStatics(guard: number): void {
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD kf stays deferred until ih.c(I)V in SharedPtrList.releaseHdStatics.
            const HintArrow = (require('#/client/HintArrow') as typeof import('#/client/HintArrow')).default;
            releaseReferences(HintArrow, 'modelCache');
            if (guard !== 0) {
                SharedPtrList.setTerrainBatches(56, null);
            }
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'ih.J(' + guard + ')');
        }
    }

    // HD ih.a(I[Lhg;)V
    static setTerrainBatches(level: number, batches: (TerrainBatch | null)[] | null): void {
        const world = loadWorld();
        arrayPutObj(world.terrainBatches, level, batches);
    }

    // gk.c:Ljf;
    sentinel = new Linkable();
    // gk.t:Ljf;
    private cursor: Linkable | null = null;

    // gk.<init>()V
    constructor() {
        this.sentinel.prev = this.sentinel;
        this.sentinel.next = this.sentinel;
    }

    // gk.a(I)Ljf;
    next(): T | null {
        const node = requireNonNull(this.cursor);
        if (node === this.sentinel) {
            this.cursor = null;
            return null;
        } else {
            this.cursor = node.next;
            return node as T;
        }
    }

    // gk.a(B)Ljf;
    tail(): T | null {
        const node = requireNonNull(this.sentinel.prev);
        if (this.sentinel === node) {
            this.cursor = null;
            return null;
        } else {
            this.cursor = node.prev;
            return node as T;
        }
    }

    // gk.a(Ljf;Z)V
    push_back(node: T): void {
        if (node.prev !== null) node.Unlink();
        node.next = this.sentinel;
        node.prev = this.sentinel.prev;
        requireNonNull(node.prev).next = node;
        requireNonNull(node.next).prev = node;
    }

    // gk.b(B)V
    clear(): void {
        while (true) {
            const node = requireNonNull(this.sentinel.next);
            if (this.sentinel === node) break;
            node.Unlink();
        }
        this.cursor = null;
    }

    // gk.a(Ljf;B)V
    push_front(node: T): void {
        if (node.prev !== null) node.Unlink();
        node.prev = this.sentinel;
        node.next = this.sentinel.next;
        requireNonNull(node.prev).next = node;
        requireNonNull(node.next).prev = node;
    }

    // gk.a(Z)Ljf;
    takeFrontAndPop(): T | null {
        const node = requireNonNull(this.sentinel.next);
        if (node === this.sentinel) return null;
        node.Unlink();
        return node as T;
    }

    // gk.c(I)Ljf;
    prev(): T | null {
        const node = requireNonNull(this.cursor);
        if (node === this.sentinel) {
            this.cursor = null;
            return null;
        } else {
            this.cursor = node.prev;
            return node as T;
        }
    }

    // gk.d(I)Ljf;
    head(): T | null {
        const node = requireNonNull(this.sentinel.next);
        if (this.sentinel === node) {
            this.cursor = null;
            return null;
        } else {
            this.cursor = node.next;
            return node as T;
        }
    }
}
