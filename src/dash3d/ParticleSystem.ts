import SecondaryHashTable from '#/datastruct/SecondaryHashTable';
import SharedPtrList from '#/datastruct/SharedPtrList';
import PacketT from '#/io/PacketT';
import InterfaceStateStatics from '#/ui/InterfaceStateStatics';
import ParticleBase from './ParticleBase';

export default class ParticleSystem extends ParticleBase {
    // ue.p:I
    private static detailLevel = 0;

    // ue.<clinit>()V
    static {
        new SecondaryHashTable(8);
        ParticleSystem.detailLevel = 2;
        new PacketT(131056);
    }

    // ue.<init>()V
    constructor() {
        super();
        new InterfaceStateStatics();
        new SharedPtrList();
    }

    // ue.a()I
    static getDetailLevel(): number {
        return ParticleSystem.detailLevel;
    }

    // ue.c(I)V
    static setDetailLevel(level: number): void {
        ParticleSystem.detailLevel = level;
    }

    // ue.b()V. Empty in the SD client; actors call it on their particle system when they reset.
    reset(): void {}
}
