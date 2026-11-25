import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import type Js5 from '#/cache/Js5';
import LRUHashCache from '#/datastruct/LRUHashCache';
import PacketT from '#/io/PacketT';
import { arrayAtI16, requireNonNull } from '#/util/JavaArray';
import ModelLit from '#/dash3d/ModelLit';
import ModelUnlit from '#/dash3d/ModelUnlit';
import SeqType from './SeqType';
import { loadLocalisedText, loadProtocol } from '#/util/GamepackClasses';

export default class SpotType {
    // HD eg.a(I)V
    static releaseHdStatics(guard: number): void {
        try {
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'englishChateffect5');
            const Protocol = loadProtocol();
            releaseReferences(Protocol, 'inPacket');
            if (guard !== 6) {
                SpotType.releaseHdStatics(-57);
            }
            releaseReferences(LocalisedText, 'frenchDiscard', 'defaultChateffect5', 'chateffect5', 'germanLoadedSprites');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'eg.E(' + guard + ')');
        }
    }

    // ig.s:Lal;
    static m_pConfigClient: Js5 | null = null;
    // ec.j:Lal;
    static m_pModels: Js5 | null = null;
    // r.V:Lve;
    static m_recentUse = new LRUHashCache<SpotType>(64);
    // m.O:Lve;
    static m_modelCache = new LRUHashCache<object>(30);

    // nf.a(Lal;Lal;Z)V
    static Init(models: Js5 | null, archive: Js5 | null): void {
        SpotType.m_pModels = models;
        SpotType.m_pConfigClient = archive;
    }

    // bf.b(II)Lli;
    static List(id: number): SpotType {
        let type = SpotType.m_recentUse.Find(BigInt(id));
        if (type !== null) return type;
        const archive = SpotType.m_pConfigClient;
        const file = SpotType.getFileId(id);
        const group = SpotType.getGroupId(id);
        const bytes = requireNonNull(archive).GetFile(file, group);
        type = new SpotType();
        type.id = id;
        if (bytes !== null) type.Decode(new PacketT(bytes));
        SpotType.m_recentUse.Put(BigInt(id), type);
        return type;
    }

    // kk.e(I)V
    static ResetCache(): void {
        SpotType.m_recentUse.Reset();
        SpotType.m_modelCache.Reset();
    }
    // ll.a(II)V
    static clean(age: number): void {
        SpotType.m_recentUse.Clean(age);
        SpotType.m_modelCache.Clean(age);
    }
    // rg.b(I)V
    static removeSoft(): void {
        SpotType.m_recentUse.removeSoft();
        SpotType.m_modelCache.removeSoft();
    }

    // mg.a(IB)I
    private static getFileId(id: number): number {
        return id & 255;
    }
    // di.a(ZI)I
    private static getGroupId(id: number): number {
        return id >>> 8;
    }

    resizeY: number; // li.a:I
    id = 0; // li.d:I
    hillSkew: boolean; // li.f:Z
    resizeXZ: number; // li.g:I
    retextureSrc: Int16Array | null = null; // li.h:[S
    rotation: number; // li.i:I
    retextureDst: Int16Array | null = null; // li.j:[S
    seq: number; // li.k:I
    recolourDst: Int16Array | null = null; // li.n:[S
    ambient: number; // li.o:I
    model = 0; // li.q:I
    recolourSrc: Int16Array | null = null; // li.r:[S
    contrast: number; // li.u:I

    // li.<init>()V
    constructor() {
        this.resizeY = 128;
        this.rotation = 0;
        this.resizeXZ = 128;
        this.ambient = 0;
        this.hillSkew = false;
        this.seq = -1;
        this.contrast = 0;
    }

    // li.a(ILgd;I)V
    private DecodeType(opcode: number, p: PacketT): void {
        switch (opcode) {
            case 1:
                this.model = p.g2();
                break;
            case 2:
                this.seq = p.g2();
                break;
            case 4:
                this.resizeXZ = p.g2();
                break;
            case 5:
                this.resizeY = p.g2();
                break;
            case 6:
                this.rotation = p.g2();
                break;
            case 7:
                this.ambient = p.g1();
                break;
            case 8:
                this.contrast = p.g1();
                break;
            case 9:
                this.hillSkew = true;
                break;
            case 40: {
                const n = p.g1();
                this.recolourSrc = new Int16Array(n);
                this.recolourDst = new Int16Array(n);
                for (let i = 0; i < n; i++) {
                    this.recolourSrc[i] = p.g2();
                    this.recolourDst[i] = p.g2();
                }
                break;
            }
            case 41: {
                const n = p.g1();
                this.retextureSrc = new Int16Array(n);
                this.retextureDst = new Int16Array(n);
                for (let i = 0; i < n; i++) {
                    this.retextureSrc[i] = p.g2();
                    this.retextureDst[i] = p.g2();
                }
                break;
            }
        }
    }

    // li.a(ZLgd;)V
    Decode(p: PacketT): void {
        for (let opcode = p.g1(); opcode !== 0; opcode = p.g1()) this.DecodeType(opcode, p);
    }

    // li.a(IBII)Lnd; (NXT SpotType::GetTempModel2 with SpotType::GetBaseModel inlined, SpotType.cpp:151/212; named
    // GetTempModel per the batch-5 API sheet)
    // The spot animation's model for one draw: the lit base (model recoloured, retextured and lit with ambient + 64 and
    // contrast + 850) cached in m_modelCache by id, animated through seq when it has one and var4 != -1
    // (SeqType.AnimateModel: cycle var3, frame var4, next frame var1), else a CopyForAnimSpot copy; then resized and
    // turned by rotation. The Java byte argument is a stripped dummy: every caller passes a literal at most -43
    // (bk.a(IIIIIIIIJILue;)V: -50, hl.a(I)Lnd;: -67, pb.a(IIIIIIIIJILue;)V: -71, ac.b(B)Lnd;: -44 and -47), so the
    // guard `if (var2 > -43) return null` after the cache lookup never returns. Locals keep the decompiler's names.
    GetTempModel(var1: number, var3: number, var4: number): ModelLit | null {
        const cached = SpotType.m_modelCache.Find(BigInt(this.id));
        if (cached !== null && !(cached instanceof ModelLit)) throw new TypeError('ClassCastException: not a ModelLit');
        let var5: ModelLit | null = cached;
        if (var5 === null) {
            const var6 = ModelUnlit.Load(SpotType.m_pModels, this.model, 0);
            if (var6 === null) {
                return null;
            }

            if (this.recolourSrc !== null) {
                for (let var7 = 0; this.recolourSrc.length > var7; var7++) {
                    var6.Recolour(arrayAtI16(this.recolourSrc, var7), arrayAtI16(this.recolourDst, var7));
                }
            }

            if (this.retextureSrc !== null) {
                for (let var11 = 0; this.retextureSrc.length > var11; var11++) {
                    var6.Retexture(arrayAtI16(this.retextureSrc, var11), arrayAtI16(this.retextureDst, var11));
                }
            }

            var5 = var6.Light((this.ambient + 64) | 0, (850 + this.contrast) | 0, -30, -50, -30);
            SpotType.m_modelCache.Put(BigInt(this.id), var5);
        }

        let var10: ModelLit;
        if (this.seq !== -1 && var4 !== -1) {
            var10 = SeqType.List(this.seq).AnimateModel(var3, var5, var4, var1);
        } else {
            var10 = var5.CopyForAnimSpot(true, true, true);
        }

        if (this.resizeXZ !== 128 || this.resizeY !== 128) {
            var10.Resize(this.resizeXZ, this.resizeY, this.resizeXZ);
        }

        if (this.rotation !== 0) {
            if (this.rotation === 90) {
                var10.Rotate90();
            }

            if (this.rotation === 180) {
                var10.Rotate180();
            }

            if (this.rotation === 270) {
                var10.Rotate270();
            }
        }

        return var10;
    }
}
