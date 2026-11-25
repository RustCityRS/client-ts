import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import { requireNonNull } from '#/util/JavaArray';
import type Js5 from '#/cache/Js5';
import LruHashTable from '#/datastruct/LruHashTable';
import PacketT from '#/io/PacketT';
import SecondaryNode from '#/datastruct/SecondaryNode';
import { loadClient, loadGameShell, loadLocalisedText, loadPlayerModel } from '#/util/GamepackClasses';

// pj extends ei
export default class InvType extends SecondaryNode {
    // HD md.d(I)V
    static releaseInvTypeStatics(guard: number): void {
        try {
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'frenchStarting3dLibrary', 'frenchUnableToFind');
            const GameShell = loadGameShell();
            releaseReferences(GameShell, 'canvas');
            releaseReferences(LocalisedText, 'frenchLoadedConfig');
            const Client = loadClient();
            releaseReferences(Client, 'shiftClickDisabled');
            const PlayerModel = loadPlayerModel();
            releaseReferences(PlayerModel, 'recolourDestinationsRs');
            if (guard <= 22) {
                return;
            }
            releaseReferences(Client, 'memoryCommand');
            releaseReferences(LocalisedText, 'frenchClose');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'md.B(' + guard + ')');
        }
    }

    // gf.ab:Lal;
    static m_pConfigClient: Js5 | null = null;
    // ed.c:Lvj;
    static m_recentUse = new LruHashTable<InvType>(64);

    // l.a(ILal;)V
    static Init(archive: Js5 | null): void {
        InvType.m_pConfigClient = archive;
    }

    // me.b(BI)Lpj;
    static List(id: number): InvType {
        let type = InvType.m_recentUse.Find(BigInt(id));
        if (type !== null) return type;
        const bytes = requireNonNull(InvType.m_pConfigClient).GetFile(id, 5);
        type = new InvType();
        if (bytes !== null) type.Decode(new PacketT(bytes));
        InvType.m_recentUse.Put(BigInt(id), type);
        return type;
    }

    // pj.H:I
    m_size = 0;

    // pj.<init>()V
    constructor() {
        super();
    }

    // pj.a(BLgd;)V
    Decode(packet: PacketT): void {
        for (;;) {
            const code = packet.g1();
            if (code === 0) return;
            this.DecodeType(code, packet);
        }
    }

    // pj.a(BILgd;)V
    private DecodeType(code: number, packet: PacketT): void {
        if (code === 2) this.m_size = packet.g2();
    }
}
