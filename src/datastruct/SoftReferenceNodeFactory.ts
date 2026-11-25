import type ReferenceNode from './ReferenceNode';
import ReferenceNodeFactory from './ReferenceNodeFactory';
import SoftReferenceNode from './SoftReferenceNode';

export default class SoftReferenceNodeFactory extends ReferenceNodeFactory {
    // sh.<init>()V
    constructor() {
        super();
    }
    // sh.a(BLmk;)Lmk;
    override create<T extends object>(node: ReferenceNode<T>): ReferenceNode<T> {
        return new SoftReferenceNode(node.get());
    }
}
