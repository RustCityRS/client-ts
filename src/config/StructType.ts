import HashTable from '#/datastruct/HashTable';
import IntNode from '#/datastruct/IntNode';
import type JagString from '#/datastruct/JagString';
import SecondaryNode from '#/datastruct/SecondaryNode';
import StringNode from '#/datastruct/StringNode';
import PacketT from '#/io/PacketT';
import type Js5 from '#/cache/Js5';
import LruHashTable from '#/datastruct/LruHashTable';
import { requireNonNull } from '#/util/JavaArray';
import { bitCeil } from '#/util/IntUtils';

export default class StructType extends SecondaryNode {
    static m_pConfigClient: Js5 | null = null; // bb.f:Lal;
    static m_recentUse = new LruHashTable<StructType>(64); // qi.G:Lvj;

    // mj.a(ILal;)V
    static Init(archive: Js5 | null): void {
        StructType.m_pConfigClient = archive;
    }

    // hl.a(II)Laf;
    static List(id: number): StructType {
        let type = StructType.m_recentUse.Find(BigInt(id));
        if (type !== null) return type;
        const bytes = requireNonNull(StructType.m_pConfigClient).GetFile(id, 26);
        type = new StructType();
        if (bytes !== null) type.Decode(new PacketT(bytes));
        StructType.m_recentUse.Put(BigInt(id), type);
        return type;
    }

    // af.B:Lnc;
    private params: HashTable<IntNode | StringNode> | null = null;

    // af.<init>()V
    constructor() {
        super();
    }

    // af.a(ILgd;)V
    Decode(packet: PacketT): void {
        for (;;) {
            const code = packet.g1();
            if (code === 0) return;
            this.decodeCode(packet, code);
        }
    }

    // af.a(Lgd;BI)V
    private decodeCode(packet: PacketT, code: number): void {
        if (code !== 249) return;
        const count = packet.g1();
        if (this.params === null) this.params = new HashTable(bitCeil(count));
        for (let i = 0; i < count; i++) {
            const string = packet.g1() === 1;
            const key = packet.g3();
            const value = string ? new StringNode(packet.gStringNoConversion()) : new IntNode(packet.g4());
            this.params.put(value, BigInt(key));
        }
    }

    // af.a(III)I
    GetParam(defaultValue: number, key: number): number {
        if (this.params === null) return defaultValue;
        const node = this.params.get(BigInt(key));
        if (node === null) return defaultValue;
        if (!(node instanceof IntNode)) throw new TypeError('Expected integer struct value');
        return node.value;
    }

    // af.a(BILid;)Lid;
    GetParam2(key: number, defaultValue: JagString | null): JagString | null {
        if (this.params === null) return defaultValue;
        const node = this.params.get(BigInt(key));
        if (node === null) return defaultValue;
        if (!(node instanceof StringNode)) throw new TypeError('Expected string struct value');
        return node.value;
    }
}
