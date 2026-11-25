import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import { requireNonNull } from '#/util/JavaArray';
import type Js5 from '#/cache/Js5';
import LRUHashCache from '#/datastruct/LRUHashCache';
import PacketT from '#/io/PacketT';
import { loadLocalisedText, loadMinimenu, loadScriptRunner } from '#/util/GamepackClasses';

export default class VarBitType {
    // HD kk.a(Z)V
    static releaseHdStatics(guard: boolean): void {
        try {
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'frenchAllocatingMemory');
            const ScriptRunner = loadScriptRunner();
            releaseReferences(ScriptRunner, 'scriptErrorMessage');
            if (!guard) {
                const Minimenu = loadMinimenu();
                Minimenu.sideSpriteId = 8;
            }
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'kk.D(' + guard + ')');
        }
    }

    // kk.Q:[I
    static readonly m_maskLookUp = new Int32Array(32);

    // kk.<clinit>()V
    static {
        let power = 2;
        for (let i = 0; i < 32; i++) {
            VarBitType.m_maskLookUp[i] = (power - 1) | 0;
            power = (power + power) | 0;
        }
    }

    // ma.g:Lal;
    static m_pConfigClient: Js5 | null = null;
    // cd.d:Lve;
    static m_recentUse = new LRUHashCache<VarBitType>(64);

    // f.a(I)V
    static ResetCache(): void {
        VarBitType.m_recentUse.Reset();
    }

    // ib.e(I)V
    static removeSoft(): void {
        VarBitType.m_recentUse.removeSoft();
    }

    // si.a(BI)V
    static cleanCache(age: number): void {
        VarBitType.m_recentUse.Clean(age);
    }

    // mi.a(ILal;)V
    static Init(archive: Js5 | null): void {
        VarBitType.m_pConfigClient = archive;
    }

    // we.a(II)Log;
    static List(id: number): VarBitType {
        let type = VarBitType.m_recentUse.Find(BigInt(id));
        if (type !== null) {
            if (!(type instanceof VarBitType)) throw new TypeError('ClassCastException: not a VarBitType');
            return type;
        }
        const archive = VarBitType.m_pConfigClient;
        const file = VarBitType.getFileId(id);
        const group = VarBitType.getGroupId(id);
        const bytes = requireNonNull(archive).GetFile(file, group);
        type = new VarBitType();
        if (bytes !== null) type.Decode(new PacketT(bytes));
        VarBitType.m_recentUse.Put(BigInt(id), type);
        return type;
    }

    // wb.b(IB)I
    private static getGroupId(id: number): number {
        return id >>> 10;
    }
    // ec.a(IB)I
    private static getFileId(id: number): number {
        return id & 1023;
    }

    // og.d:I
    startBit = 0;
    // og.i:I
    endBit = 0;
    // og.j:I
    baseVar = 0;

    // og.<init>()V
    constructor() {}

    // og.a(Lgd;I)V
    Decode(packet: PacketT): void {
        for (;;) {
            const code = packet.g1();
            if (code === 0) return;
            this.DecodeType(packet, code);
        }
    }

    // og.a(Lgd;BI)V
    private DecodeType(packet: PacketT, code: number): void {
        if (code === 1) {
            this.baseVar = packet.g2();
            this.startBit = packet.g1();
            this.endBit = packet.g1();
        }
    }
}
