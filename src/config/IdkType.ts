import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import type Js5 from '#/cache/Js5';
import ModelUnlit from '#/dash3d/ModelUnlit';
import LRUHashCache from '#/datastruct/LRUHashCache';
import PacketT from '#/io/PacketT';
import { arrayAtI16, arrayAtI32, arrayPutI32, arrayPutObj, requireNonNull } from '#/util/JavaArray';
import { loadClient, loadCookieStatics, loadLocalisedText } from '#/util/GamepackClasses';

export default class IdkType {
    // HD dm.b(I)V
    static releaseHdStatics(guard: number): void {
        try {
            const Client = loadClient();
            releaseReferences(Client, 'percentSign');
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'englishLoadingTitleScreen');
            if (guard !== -9893) {
                return;
            }
            releaseReferences(LocalisedText, 'englishLoading');
            const CookieStatics = loadCookieStatics();
            releaseReferences(CookieStatics, 'space');
            releaseReferences(LocalisedText, 'LOADINGDOTDOTDOT', 'germanRemoveFriend', 'loadingTitleScreen');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'dm.C(' + guard + ')');
        }
    }

    nonSelectable: boolean; // fi.d:Z
    readonly headModels: Int32Array; // fi.e:[I
    models: Int32Array | null = null; // fi.f:[I
    retextureTo: Int16Array | null = null; // fi.h:[S
    recolourTo: Int16Array | null = null; // fi.l:[S
    recolourFrom: Int16Array | null = null; // fi.o:[S
    retextureFrom: Int16Array | null = null; // fi.t:[S
    bodyPart: number; // fi.v:I

    static m_recentUse = new LRUHashCache<IdkType>(64); // hh.S:Lve;
    static m_numDefinitions = 0; // ml.u:I
    static m_pConfigClient: Js5 | null = null; // ra.Z:Lal;
    static m_pModels: Js5 | null = null; // qh.b:Lal;

    // fi.<init>()V
    constructor() {
        this.headModels = Int32Array.of(-1, -1, -1, -1, -1);
        this.nonSelectable = false;
        this.bodyPart = -1;
    }

    // fi.a(ILgd;I)V
    private DecodeType(opcode: number, packet: PacketT): void {
        if (opcode === 1) {
            this.bodyPart = packet.g1();
        } else if (opcode === 2) {
            const count = packet.g1();
            this.models = new Int32Array(count);
            for (let i = 0; i < count; i++) this.models[i] = packet.g2();
        } else if (opcode === 3) {
            this.nonSelectable = true;
        } else if (opcode === 40) {
            const count = packet.g1();
            this.recolourFrom = new Int16Array(count);
            this.recolourTo = new Int16Array(count);
            for (let i = 0; i < count; i++) {
                this.recolourFrom[i] = packet.g2();
                this.recolourTo[i] = packet.g2();
            }
        } else if (opcode === 41) {
            const count = packet.g1();
            this.retextureFrom = new Int16Array(count);
            this.retextureTo = new Int16Array(count);
            for (let i = 0; i < count; i++) {
                this.retextureFrom[i] = packet.g2();
                this.retextureTo[i] = packet.g2();
            }
        } else if (opcode >= 60 && opcode < 70) {
            arrayPutI32(this.headModels, opcode - 60, packet.g2());
        }
    }

    // fi.a(BLgd;)V
    Decode(packet: PacketT): void {
        for (;;) {
            const opcode = packet.g1();
            if (opcode === 0) return;
            this.DecodeType(opcode, packet);
        }
    }

    // fi.a(B)Z
    CheckHead(): boolean {
        let ready = true;
        for (let i = 0; i < 5; i++) {
            if (arrayAtI32(this.headModels, i) !== -1) {
                const archive = IdkType.m_pModels;
                const group = arrayAtI32(this.headModels, i);
                if (!requireNonNull(archive).RequestDownload(true, group, 0)) ready = false;
            }
        }
        return ready;
    }

    // fi.a(I)Lcb;
    GetHeadNoCheck(): ModelUnlit {
        const parts = new Array<ModelUnlit | null>(5).fill(null);
        let count = 0;
        for (let i = 0; i < 5; i++) {
            if (arrayAtI32(this.headModels, i) !== -1) {
                parts[count++] = ModelUnlit.Load(IdkType.m_pModels, arrayAtI32(this.headModels, i), 0);
            }
        }
        const model = new ModelUnlit(parts, count);
        if (this.recolourFrom !== null) {
            for (let i = 0; i < this.recolourFrom.length; i++) {
                model.Recolour(arrayAtI16(this.recolourFrom, i), arrayAtI16(this.recolourTo, i));
            }
        }
        if (this.retextureFrom !== null) {
            for (let i = 0; i < this.retextureFrom.length; i++) {
                model.Retexture(arrayAtI16(this.retextureFrom, i), arrayAtI16(this.retextureTo, i));
            }
        }
        return model;
    }

    // fi.a(Z)Z
    CheckModel(check = true): boolean {
        if (this.models === null) return true;
        let available = check;
        for (let i = 0; i < this.models.length; i++) {
            if (!requireNonNull(IdkType.m_pModels).RequestDownload(check, this.models[i], 0)) available = false;
        }
        return available;
    }

    // fi.c(I)Lcb;
    GetModelNoCheck(): ModelUnlit | null {
        if (this.models === null) return null;
        const parts = new Array<ModelUnlit | null>(this.models.length).fill(null);
        for (let i = 0; i < this.models.length; i++) {
            arrayPutObj(parts, i, ModelUnlit.Load(IdkType.m_pModels, arrayAtI32(this.models, i), 0));
        }
        const model = parts.length === 1 ? parts[0] : new ModelUnlit(parts, parts.length);
        if (this.recolourFrom !== null) {
            for (let i = 0; i < this.recolourFrom.length; i++) {
                const from = arrayAtI16(this.recolourFrom, i);
                const to = arrayAtI16(this.recolourTo, i);
                requireNonNull(model).Recolour(from, to);
            }
        }
        if (this.retextureFrom !== null) {
            for (let i = 0; i < this.retextureFrom.length; i++) {
                const from = arrayAtI16(this.retextureFrom, i);
                const to = arrayAtI16(this.retextureTo, i);
                requireNonNull(model).Retexture(from, to);
            }
        }
        return model;
    }

    // id.a(Lal;BLal;)V
    static Init(config: Js5 | null, models: Js5 | null): void {
        IdkType.m_pConfigClient = config;
        IdkType.m_pModels = models;
        IdkType.m_numDefinitions = requireNonNull(IdkType.m_pConfigClient).GetFileIdLimit(3);
    }

    // hk.a(II)Lfi;
    static List(id: number): IdkType {
        let type = IdkType.m_recentUse.Find(BigInt(id));
        if (type !== null) return type;
        const bytes = requireNonNull(IdkType.m_pConfigClient).GetFile(id, 3);
        type = new IdkType();
        if (bytes !== null) type.Decode(new PacketT(bytes));
        IdkType.m_recentUse.Put(BigInt(id), type);
        return type;
    }

    // ad.a(II)V
    static clean(maxAge: number): void {
        IdkType.m_recentUse.Clean(maxAge);
    }
    // ge.e(I)V
    static removeSoft(): void {
        IdkType.m_recentUse.removeSoft();
    }
    // m.d(I)V
    static ResetCache(): void {
        IdkType.m_recentUse.Reset();
    }
}
