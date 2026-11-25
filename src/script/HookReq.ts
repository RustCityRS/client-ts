import type JagString from '#/datastruct/JagString';
import Linkable from '#/datastruct/Linkable';
import type IfType from '#/ui/IfType';

// wf extends jf. The event queues link the same object that gh.a consumes.
export default class HookReq extends Linkable {
    mouseInput = false; // wf.v:Z
    keyCode = 0; // wf.x:I
    opIndex = 0; // wf.y:I
    opBase: JagString | null = null; // wf.z:Lid;
    dragTarget: IfType | null = null; // wf.B:Laj;
    component: IfType | null = null; // wf.C:Laj;
    mouseX = 0; // wf.D:I
    keyChar = 0; // wf.E:I
    args: (number | JagString | null)[] | null = null; // wf.G:[Ljava/lang/Object;
    mouseY = 0; // wf.K:I

    // wf.<init>()V
    constructor() {
        super();
    }
}
