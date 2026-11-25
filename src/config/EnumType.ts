import HashTable from '#/datastruct/HashTable';
import IntNode from '#/datastruct/IntNode';
import JagString, { fromLiteral } from '#/datastruct/JagString';
import EnumStringEntry from '#/datastruct/EnumStringEntry';
import SecondaryNode from '#/datastruct/SecondaryNode';
import StringNode from '#/datastruct/StringNode';
import PacketT from '#/io/PacketT';
import type Js5 from '#/cache/Js5';
import LruHashTable from '#/datastruct/LruHashTable';
import { requireNonNull } from '#/util/JavaArray';
import { bitCeil } from '#/util/IntUtils';

export default class EnumType extends SecondaryNode {
    static nullText: JagString | null = fromLiteral('null'); // wf.t:Lid;
    static m_pConfigClient: Js5 | null = null; // ae.h:Lal;
    static m_recentUse = new LruHashTable<EnumType>(128); // t.z:Lvj;

    // h.a(ILal;)V
    static Init(archive: Js5 | null): void {
        EnumType.m_pConfigClient = archive;
    }

    // v.a(IB)Llg;
    static List(id: number): EnumType {
        let type = EnumType.m_recentUse.Find(BigInt(id));
        if (type !== null) {
            if (!(type instanceof EnumType)) throw new TypeError('ClassCastException: not a EnumType');
            return type;
        }
        const archive = EnumType.m_pConfigClient,
            file = EnumType.enumFile(id),
            group = EnumType.getGroupId(id);
        const bytes = requireNonNull(archive).GetFile(file, group);
        type = new EnumType();
        if (bytes !== null) type.Decode(new PacketT(bytes));
        EnumType.m_recentUse.Put(BigInt(id), type);
        return type;
    }

    // pe.b(II)I
    private static getGroupId(id: number): number {
        return id >>> 8;
    }
    // jd.a(II)I
    private static enumFile(id: number): number {
        return id & 255;
    }

    // lg.B:Lnc;
    private inverse: HashTable<EnumStringEntry | IntNode> | null = null;
    // lg.H:Lid;
    private defaultString = EnumType.nullText;
    // lg.R:I
    input = 0;
    // lg.U:Lnc;
    entries: HashTable<IntNode | StringNode> | null = null;
    // lg.Z:I
    m_outputType = 0;
    // lg.ab:I
    private defaultInt = 0;

    // lg.<init>()V
    constructor() {
        super();
    }

    // lg.a(Lgd;I)V
    Decode(packet: PacketT): void {
        for (;;) {
            const code = packet.g1();
            if (code === 0) return;
            this.DecodeType(code, packet);
        }
    }

    // lg.a(ILgd;B)V
    private DecodeType(code: number, packet: PacketT): void {
        if (code === 1) this.input = packet.g1();
        else if (code === 2) this.m_outputType = packet.g1();
        else if (code === 3) this.defaultString = packet.gStringNoConversion();
        else if (code === 4) this.defaultInt = packet.g4();
        else if (code === 5 || code === 6) {
            const count = packet.g2();
            this.entries = new HashTable(bitCeil(count));
            for (let i = 0; i < count; i++) {
                const key = packet.g4();
                const value = code === 5 ? new StringNode(packet.gStringNoConversion()) : new IntNode(packet.g4());
                this.entries.put(value, BigInt(key));
            }
        }
    }

    // lg.a(II)I
    getInt(key: number): number {
        const node = this.entries?.get(BigInt(key));
        if (node == null) return this.defaultInt;
        if (!(node instanceof IntNode)) throw new TypeError('ClassCastException: Expected integer enum value');
        return node.value;
    }

    // lg.b(II)Lid;
    GetOutputString(key: number): JagString | null {
        const node = this.entries?.get(BigInt(key));
        if (node == null) return this.defaultString;
        if (!(node instanceof StringNode)) throw new TypeError('ClassCastException: Expected string enum value');
        return node.value;
    }

    // lg.d(B)V
    private indexInts(): void {
        const entries = requireNonNull(this.entries);
        this.inverse = new HashTable(entries.getBucketCount());
        for (let node = entries.head(); node !== null; node = entries.next()) {
            if (!(node instanceof IntNode)) throw new TypeError('ClassCastException: Expected integer enum value');
            this.inverse.put(new IntNode(Number(BigInt.asIntN(32, node.key))), BigInt(node.value));
        }
    }

    // lg.c(B)V
    private indexStrings(): void {
        const entries = requireNonNull(this.entries);
        this.inverse = new HashTable(entries.getBucketCount());
        for (let node = entries.head(); node !== null; node = entries.next()) {
            if (!(node instanceof StringNode)) throw new TypeError('ClassCastException: Expected string enum value');
            this.inverse.put(new EnumStringEntry(node.value), requireNonNull(node.value).longHashCode());
        }
    }

    // lg.d(II)Z
    containsInt(value: number): boolean {
        if (this.entries === null) return false;
        if (this.inverse === null) this.indexInts();
        const node = requireNonNull(this.inverse).get(BigInt(value));
        if (node !== null && !(node instanceof IntNode)) throw new TypeError('ClassCastException: Expected integer enum value');
        return node !== null;
    }

    // lg.a(ZLid;)Z
    containsString(value: JagString | null): boolean {
        if (this.entries === null) return false;
        if (this.inverse === null) this.indexStrings();
        const inverse = requireNonNull(this.inverse);
        let node = inverse.get(requireNonNull(value).longHashCode());
        while (node !== null) {
            if (!(node instanceof EnumStringEntry)) throw new TypeError('ClassCastException: Expected string enum value');
            if (requireNonNull(node.value).equals(value)) return true;
            node = inverse.nextWithKey();
        }
        return false;
    }
}
