import QuickChatCatType from './QuickChatCatType';
import LruHashTable from '#/datastruct/LruHashTable';
import type Js5 from '#/cache/Js5';
import PacketT from '#/io/PacketT';
import { requireNonNull } from '#/util/JavaArray';

export default class QuickChatCatTypeList {
    // sc.Q:Lvj;
    static readonly types = new LruHashTable<QuickChatCatType>(64);
    // nh.N:Lal;
    static local: Js5 | null = null;
    // gj.W:Lal;
    static global: Js5 | null = null;

    // rc.a(Lal;Lal;B)V
    static init(local: Js5 | null, global: Js5 | null): void {
        this.local = local;
        this.global = global;
    }
    // ib.a(BI)Lpg;
    static GetQuickChatCatType(id: number): QuickChatCatType {
        let type = this.types.Find(BigInt(id));
        if (type !== null) return type;
        const bytes = id < 32768 ? requireNonNull(this.local).GetFile(id, 0) : requireNonNull(this.global).GetFile(id & 32767, 0);
        type = new QuickChatCatType();
        if (bytes !== null) type.Decode(new PacketT(bytes));
        if (id >= 32768) type.markGlobal();
        this.types.Put(BigInt(id), type);
        return type;
    }
}
