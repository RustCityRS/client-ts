import ReferenceNode from './ReferenceNode';

export default class SoftReferenceNode<T extends object> extends ReferenceNode<T> {
    // hb.M:Ljava/lang/ref/SoftReference;
    private readonly reference: WeakRef<T> | null;

    // hb.<init>(Ljava/lang/Object;)V
    constructor(value: T | null) {
        super();
        this.reference = value === null ? null : new WeakRef(value);
    }
    // hb.b(Z)Ljava/lang/Object;
    override get(): T | null {
        return this.reference?.deref() ?? null;
    }
    // hb.d(Z)Z
    override isSoft(): boolean {
        return true;
    }
}
