import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import type Js5 from '#/cache/Js5';
import LRUHashCache from '#/datastruct/LRUHashCache';
import PacketT from '#/io/PacketT';
import { requireNonNull } from '#/util/JavaArray';
import { loadClient, loadLocalisedText } from '#/util/GamepackClasses';

// ic in runescape_gl.jar
export default class LightType {
    // HD ic.a(B)V
    static releaseHdStatics(guard: number): void {
        try {
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'frenchLoadedUpdateList');
            // eslint-disable-next-line @typescript-eslint/no-require-imports -- ClientVarCache stays deferred until ic.a(B)V in LightType.releaseHdStatics.
            const ClientVarCache = (require('#/util/ClientVarCache') as typeof import('#/util/ClientVarCache')).default;
            releaseReferences(ClientVarCache, 'm_varServ');
            releaseReferences(LocalisedText, 'germanIgnoresFull');
            const Client = loadClient();
            releaseReferences(Client, 'friendRank');
            releaseReferences(LocalisedText, 'frenchLoadedSprites');
            if (guard !== -86) {
                return;
            }
            releaseReferences(Client, 'imageCompass');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'ic.B(' + guard + ')');
        }
    }

    // HD gl.a:Lve;
    static m_pConfigClient: Js5 | null = null;
    // SD ak.d:Lve;, HD rm.d:Ln;
    static readonly cache = new LRUHashCache<object>(64);

    // HD ic.<init>()V, in putfield order.
    m_amplitude = 2048; // ic.g:I
    m_waveType = 0; // ic.c:I
    m_offset = 0; // ic.o:I
    m_frequency = 2048; // ic.p:I

    // HD id.a(Lve;B)V
    static Init(archive: Js5 | null): void {
        LightType.m_pConfigClient = archive;
    }

    // HD la.a(II)Lic;
    static List(id: number): LightType {
        const cached = LightType.cache.Find(BigInt(id));
        if (cached !== null) {
            if (!(cached instanceof LightType)) throw new TypeError('ClassCastException: not a LightType');
            return cached;
        }
        const bytes = requireNonNull(LightType.m_pConfigClient).GetFile(id, 31);
        const type = new LightType();
        if (bytes !== null) type.Decode(new PacketT(bytes), id);
        LightType.cache.Put(BigInt(id), type);
        return type;
    }

    // HD ic.a(ILwa;I)V
    Decode(packet: PacketT, id: number): void {
        for (let opcode = packet.g1(); opcode !== 0; opcode = packet.g1()) this.DecodeType(opcode, packet, id);
    }

    // HD ic.a(ILwa;IZ)V
    private DecodeType(opcode: number, packet: PacketT, _id: number): void {
        if (opcode !== 1) {
            if (opcode === 2) this.m_frequency = packet.g2();
            else if (opcode === 3) this.m_amplitude = packet.g2();
            else if (opcode === 4) this.m_offset = packet.g2s();
        } else {
            this.m_waveType = packet.g1();
        }
    }

    // SD ga.c(I)V, HD gd.b(I)V
    static clear(): void {
        LightType.cache.Reset();
    }

    // SD oj.a(B)V, HD hd.a(I)V
    static removeSoft(): void {
        LightType.cache.removeSoft();
    }

    // SD pj.a(IB)V, HD c.c(II)V
    static clean(age: number): void {
        LightType.cache.Clean(age);
    }
}
