import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import { requireNonNull } from '#/util/JavaArray';
import { glJar } from '#/client/ClientVariant';
import type Js5 from '#/cache/Js5';
import LRUHashCache from '#/datastruct/LRUHashCache';
import PacketT from '#/io/PacketT';
import { loadLocalisedText, loadNpcType, loadWorldMap } from '#/util/GamepackClasses';

export default class VarpType {
    // HD eh.a(B)V
    static releaseHdStatics(guard: number): void {
        try {
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'germanTradeRequest', 'germanFriendFirst');
            const NpcType = loadNpcType();
            releaseReferences(NpcType, 'm_pConfigClient');
            const WorldMap = loadWorldMap();
            releaseReferences(WorldMap, 'mapScenes');
            if (guard !== 62) {
                releaseReferences(NpcType, 'm_pConfigClient');
            }
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'eh.E(' + guard + ')');
        }
    }

    // ba.g:Lal;
    static m_pConfigClient: Js5 | null = null;
    // vf.S:Lve;
    static m_recentUse = new LRUHashCache<VarpType>(64);
    // gg.y:I
    static m_numDefinitions = 0;

    // ai.a(B)V
    static ResetCache(): void {
        VarpType.m_recentUse.Reset();
    }

    // ed.c(I)V
    static removeSoft(): void {
        VarpType.m_recentUse.removeSoft();
    }

    // le.a(BI)V
    static cleanCache(age: number): void {
        VarpType.m_recentUse.Clean(age);
    }

    // tk.a(Lal;B)V
    static Init(archive: Js5 | null): void {
        VarpType.m_pConfigClient = archive;
        VarpType.m_numDefinitions = requireNonNull(VarpType.m_pConfigClient).GetFileIdLimit(16);
    }

    // SD ck.a(II)Lbb; uses its group argument. HD ub.a(II)Leh; always fetches group 16.
    static List(id: number, group: number): VarpType {
        let type = VarpType.m_recentUse.Find(BigInt(id));
        if (type !== null) {
            if (!(type instanceof VarpType)) throw new TypeError('ClassCastException: not a VarpType');
            return type;
        }
        const bytes = requireNonNull(VarpType.m_pConfigClient).GetFile(id, glJar ? 16 : group);
        type = new VarpType();
        if (bytes !== null) type.Decode(new PacketT(bytes));
        VarpType.m_recentUse.Put(BigInt(id), type);
        return type;
    }

    // bb.d:I
    clientCode = 0;

    // bb.<init>()V
    constructor() {}

    // bb.a(Lgd;I)V
    Decode(packet: PacketT): void {
        for (;;) {
            const code = packet.g1();
            if (code === 0) return;
            this.DecodeType(code, packet);
        }
    }

    // bb.a(ILgd;I)V
    private DecodeType(code: number, packet: PacketT): void {
        if (code === 5) this.clientCode = packet.g2();
    }
}
