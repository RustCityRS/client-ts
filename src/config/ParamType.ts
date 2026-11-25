import { requireNonNull } from '#/util/JavaArray';
import type Js5 from '#/cache/Js5';
import LruHashTable from '#/datastruct/LruHashTable';
import PacketT from '#/io/PacketT';
import type JagString from '#/datastruct/JagString';
import SecondaryNode from '#/datastruct/SecondaryNode';

export default class ParamType extends SecondaryNode {
    // uf.s:Lal;
    static m_pConfigClient: Js5 | null = null;
    // mg.c:Lvj;
    static m_recentUse = new LruHashTable<ParamType>(64);

    // wa.a(ILal;)V
    static Init(archive: Js5 | null): void {
        ParamType.m_pConfigClient = archive;
    }

    // ak.a(II)Lsj;
    static List(id: number): ParamType {
        let type = ParamType.m_recentUse.Find(BigInt(id));
        if (type !== null) return type;
        const bytes = requireNonNull(ParamType.m_pConfigClient).GetFile(id, 11);
        type = new ParamType();
        if (bytes !== null) type.Decode(new PacketT(bytes));
        ParamType.m_recentUse.Put(BigInt(id), type);
        return type;
    }

    // sj.B:I
    m_defaultNumber = 0;
    // sj.K:Lid;
    defaultString: JagString | null = null;
    // sj.O:I
    private type = 0;

    // sj.<init>()V
    constructor() {
        super();
    }

    // sj.c(I)Z
    IsStringType(): boolean {
        return this.type === 115;
    }

    // sj.a(ILgd;)V
    Decode(packet: PacketT): void {
        for (;;) {
            const code = packet.g1();
            if (code === 0) return;
            this.DecodeType(code, packet);
        }
    }

    // sj.a(ILgd;I)V
    private DecodeType(code: number, packet: PacketT): void {
        if (code === 1) this.type = packet.g1();
        else if (code === 2) this.m_defaultNumber = packet.g4();
        else if (code === 5) this.defaultString = packet.gStringNoConversion();
    }
}
