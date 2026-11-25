import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import RunetekColour from '#/util/RunetekColour';
import type Js5 from '#/cache/Js5';
import { glJar } from '#/client/ClientVariant';
import LRUHashCache from '#/datastruct/LRUHashCache';
import PacketT from '#/io/PacketT';
import { requireNonNull } from '#/util/JavaArray';
import { loadClient, loadInterfaceList, loadSpriteLoader } from '#/util/GamepackClasses';

export default class FloType {
    // HD wl.a(I)V
    static releaseHdStatics(guard: number): void {
        try {
            const Client = loadClient();
            releaseReferences(Client, 'fontBold12');
            if (guard !== -2) {
                return;
            }
            const SpriteLoader = loadSpriteLoader();
            releaseReferences(SpriteLoader, 'compassName');
            releaseReferences(Client, 'locConfigArchive');
            const InterfaceList = loadInterfaceList();
            releaseReferences(InterfaceList, 'viewportComponent');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'wl.G(' + guard + ')');
        }
    }

    // SD ik.V:Lal;, HD cl.J:Lve;
    static m_pConfigClient: Js5 | null = null;
    // SD b.J:I, HD hj.a:I
    static count = 0;
    // SD vk.gb:I, HD ca.db:I
    static m_defaultWater = 0;
    // SD ik.U:Lve;, HD t.p:Ln;
    static readonly m_list = new LRUHashCache<FloType>(64);

    // SD ic.a(Lal;B)V, HD qc.a(ZLve;)V
    static Init(archive: Js5 | null): void {
        FloType.m_pConfigClient = archive;
        FloType.count = requireNonNull(FloType.m_pConfigClient).GetFileIdLimit(4);
    }

    // SD jl.a(II)Lwa;, HD um.a(BI)Lwl;
    static List(id: number): FloType {
        let type = FloType.m_list.Find(BigInt(id));
        if (type !== null) {
            if (!(type instanceof FloType)) throw new TypeError('ClassCastException: not a FloType');
            return type;
        }
        const bytes = requireNonNull(FloType.m_pConfigClient).GetFile(id, 4);
        type = new FloType();
        if (bytes !== null) type.Decode(new PacketT(bytes), id);
        FloType.m_list.Put(BigInt(id), type);
        return type;
    }

    // SD la.e(I)V, HD uh.e(I)V
    static removeSoft(): void {
        FloType.m_list.removeSoft();
    }
    // SD ai.a(II)V, HD aj.c(II)V
    static clean(age: number): void {
        FloType.m_list.Clean(age);
    }
    // SD ka.b(I)V, HD wh.a(I)V
    static clear(): void {
        FloType.m_list.Reset();
    }

    // SD ec.a(II)I, HD be.a(II)I. wl's two colour opcodes pass 116.
    static ColourFudge(rgb: number, guard = glJar ? 116 : -110): number {
        if (glJar) {
            if (rgb === 0xff00ff) return -1;
            if (guard < 97) return -63;
            return RunetekColour.RGBToHSL(rgb);
        }
        if (guard >= -109) return -63;
        return rgb === 0xff00ff ? -1 : RunetekColour.RGBToHSL(rgb);
    }

    // SD wa.b:Z, HD wl.y:Z
    occludes: boolean;
    // SD wa.h:I, HD wl.z:I
    colour: number;
    // SD wa.l:I, HD wl.p:I
    m_materialID: number;
    // SD wa.n:I, HD wl.t:I
    secondaryColour: number;

    // HD wl.f:I, 128 units per texture repeat (NXT FloorOverlayType.m_textureScale).
    declare m_textureScale: number;
    // HD wl.j:Z and wl.w:I. NXT FloorOverlayType has both names.
    declare m_hasSmoothEdges: boolean;
    declare m_priority: number;
    // NXT FloorOverlayType names these three members by offset. di.a passes
    // wl.l to tj.a for the floor shadow and packs wl.x:wl.m for the underwater tile.
    declare field_77: boolean; // HD wl.l:Z
    declare field_80: number; // HD wl.m:I, underwater colour
    declare field_84: number; // HD wl.x:I, underwater fog depth (unscaled)

    // SD wa.<init>()V, HD wl.<init>()V, in putfield order.
    constructor() {
        if (glJar) {
            this.m_hasSmoothEdges = false;
            this.field_77 = true;
            this.m_materialID = -1;
            this.m_textureScale = 128;
            this.m_priority = 8;
            this.field_84 = 16;
            this.secondaryColour = -1;
            this.occludes = true;
            this.colour = 0;
            this.field_80 = 1190717;
            return;
        }
        this.m_materialID = -1;
        this.colour = 0;
        this.secondaryColour = -1;
        this.occludes = true;
    }

    // SD wa.a(Lgd;BI)V, HD wl.a(ILwa;I)V
    Decode(packet: PacketT, id: number): void {
        for (let opcode = packet.g1(); opcode !== 0; opcode = packet.g1()) this.DecodeType(id, packet, opcode);
    }

    // SD wa.a(ILgd;IB)V, HD wl.a(IILwa;I)V
    private DecodeType(id: number, packet: PacketT, opcode: number): void {
        switch (opcode) {
            case 1:
                this.colour = FloType.ColourFudge(packet.g3());
                break;
            case 2:
                this.m_materialID = packet.g1();
                break;
            case 3:
                this.m_materialID = packet.g2();
                if (this.m_materialID === 65535) this.m_materialID = -1;
                break;
            case 5:
                this.occludes = false;
                break;
            case 7:
                this.secondaryColour = FloType.ColourFudge(packet.g3());
                break;
            case 8:
                FloType.m_defaultWater = id;
                break;
            case 9:
                if (glJar) this.m_textureScale = packet.g2();
                else packet.g2();
                break;
            case 10:
                if (glJar) this.field_77 = false;
                break;
            case 11:
                if (glJar) this.m_priority = packet.g1();
                else packet.g1();
                break;
            case 12:
                if (glJar) this.m_hasSmoothEdges = true;
                break;
            case 13:
                if (glJar) this.field_80 = packet.g3();
                else packet.g3();
                break;
            case 14:
                if (glJar) this.field_84 = packet.g1();
                else packet.g1();
                break;
        }
    }
}
