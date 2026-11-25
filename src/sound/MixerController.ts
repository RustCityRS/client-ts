import Linkable from '#/datastruct/Linkable';
import type Mixer from './Mixer';

export default abstract class MixerController extends Linkable {
    // bg.q:I
    remaining = 0;
    // bg.<init>()V
    constructor() {
        super();
    }
    // bg.a(Lcj;)I
    abstract update(mixer: Mixer): number;
    // bg.a()V
    abstract remove(): void;
}
