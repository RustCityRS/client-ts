import type Js5 from '#/cache/Js5';
import LRUHashCache from '#/datastruct/LRUHashCache';
import PacketT from '#/io/PacketT';
import { requireNonNull } from '#/util/JavaArray';
import BASType from './BASType';

export default class BASTypeList {
    // s.S:Lal;
    static archive: Js5 | null = null;
    // ig.n:Lve;
    static readonly types = new LRUHashCache<BASType>(64);
    // tb.o:Lmg;
    static readonly defaultType = new BASType();

    // oa.a(ILal;)V
    static init(archive: Js5 | null): void {
        BASTypeList.archive = archive;
    }

    // af.a(ZI)Lmg;
    static List(id: number): BASType {
        let type = BASTypeList.types.Find(BigInt(id));
        if (type !== null) return type;
        const bytes = requireNonNull(BASTypeList.archive).GetFile(id, 32);
        type = new BASType();
        if (bytes !== null) type.Decode(new PacketT(bytes));
        type.PostDecode();
        BASTypeList.types.Put(BigInt(id), type);
        return type;
    }

    // gl.d(I)V
    static CacheReset(): void {
        BASTypeList.types.Reset();
    }
    // he.a(IB)V
    static CacheClean(age: number): void {
        BASTypeList.types.Clean(age);
    }
    // qg.c(B)V
    static removeSoft(): void {
        BASTypeList.types.removeSoft();
    }
}
