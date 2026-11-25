import Linkable from '#/datastruct/Linkable';

// l extends jf.
export default class ServerActiveProperties extends Linkable {
    // l.E:I
    readonly events: number;
    // l.x:I
    readonly targetParam: number;

    // l.<init>(II)V
    constructor(events: number, targetParam: number) {
        super();
        this.targetParam = targetParam;
        this.events = events;
    }

    // vj.a(IB)I
    static targetMask(events: number): number {
        return (events & 0x3fe8f) >> 11;
    }

    // l.b(I)I
    getTargetMask(): number {
        return ServerActiveProperties.targetMask(this.events);
    }

    // l.c(I)Z
    canUseObj(): boolean {
        return ((this.events >> 31) & 1) !== 0;
    }

    // l.d(I)Z
    canSwapObjs(): boolean {
        return (this.events & 496670741) >> 28 !== 0;
    }

    // l.e(I)I. NXT ServerActive::ServerDraggable. The 530 field starts at bit 18.
    ServerDraggable(): number {
        return (this.events >> 18) & 7;
    }

    // l.a(BI)Z
    isOpEnabled(op: number): boolean {
        return ((this.events >> (op + 1)) & 1) !== 0;
    }

    // l.f(I)Z
    hasObjOps(): boolean {
        return ((this.events >> 30) & 1) !== 0;
    }

    // l.g(I)Z
    canTarget(): boolean {
        return ((this.events >> 22) & 1) !== 0;
    }

    // l.c(B)Z
    canResume(): boolean {
        return (this.events & 1) !== 0;
    }

    // l.d(B)Z
    canReplaceObj(): boolean {
        return ((this.events >> 29) & 1) !== 0;
    }

    // l.h(I)Z
    isDragTarget(): boolean {
        return (this.events & 3867171) >> 21 !== 0;
    }

    // kl.E:Ll;
    static readonly DEFAULT = new ServerActiveProperties(0, -1);
}
