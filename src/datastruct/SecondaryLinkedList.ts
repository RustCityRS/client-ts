import { intDivide } from '#/util/IntUtils';
import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import { requireNonNull } from '#/util/JavaArray';
import SecondaryNode from './SecondaryNode';
import { loadLocalisedText, loadQuickChatCatTypeList } from '#/util/GamepackClasses';

export default class SecondaryLinkedList<T extends SecondaryNode = SecondaryNode> {
    // HD ce.a(B)V
    static releaseHdStatics(guard: number): void {
        try {
            intDivide(-102, intDivide((guard - 35) | 0, 48));
            const QuickChatCatTypeList = loadQuickChatCatTypeList();
            releaseReferences(QuickChatCatTypeList, 'global');
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'germanLoadingTextures');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'ce.C(' + guard + ')');
        }
    }

    // tb.x:Lei;
    private sentinel = new SecondaryNode();
    // tb.C:Lei;
    private cursor: SecondaryNode | null = null;

    // tb.<init>()V
    constructor() {
        this.sentinel.secondaryNext = this.sentinel;
        this.sentinel.secondaryPrev = this.sentinel;
    }

    // tb.a(I)Lei;
    head(): T | null {
        const node = requireNonNull(this.sentinel.secondaryNext);
        if (this.sentinel === node) {
            this.cursor = null;
            return null;
        } else {
            this.cursor = node.secondaryNext;
            return node as T;
        }
    }

    // tb.a(B)Lei;
    removeHead(): T | null {
        const node = requireNonNull(this.sentinel.secondaryNext);
        if (node === this.sentinel) return null;
        node.unlinkSecondary();
        return node as T;
    }

    // tb.b(I)I
    size(): number {
        let count = 0;
        let node = this.sentinel.secondaryNext;
        while (node !== this.sentinel) {
            count = (count + 1) | 0;
            node = requireNonNull(node).secondaryNext;
        }
        return count;
    }

    // tb.a(Lei;I)V
    addTail(node: T): void {
        if (node.secondaryPrev !== null) node.unlinkSecondary();
        node.secondaryNext = this.sentinel;
        node.secondaryPrev = this.sentinel.secondaryPrev;
        requireNonNull(node.secondaryPrev).secondaryNext = node;
        requireNonNull(node.secondaryNext).secondaryPrev = node;
    }

    // tb.b(B)V
    clear(): void {
        while (true) {
            const node = requireNonNull(this.sentinel.secondaryNext);
            if (this.sentinel === node) {
                this.cursor = null;
                return;
            }
            node.unlinkSecondary();
        }
    }

    // tb.a(Z)Lei;
    next(): T | null {
        const node = requireNonNull(this.cursor);
        if (this.sentinel === node) {
            this.cursor = null;
            return null;
        } else {
            this.cursor = node.secondaryNext;
            return node as T;
        }
    }
}
