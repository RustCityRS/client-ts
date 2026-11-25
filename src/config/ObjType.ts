import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import type SoftwareFont from '#/graphics/SoftwareFont';
import AbstractSprite from '#/graphics/AbstractSprite';
import Pix32 from '#/graphics/Pix32';
import Pix2D from '#/graphics/Pix2D';
import Pix3D from '#/dash3d/Pix3D';
import LRUHashCache from '#/datastruct/LRUHashCache';
import type Js5 from '#/cache/Js5';
import { glJar } from '#/client/ClientVariant';
import LocalisedText from '#/ui/LocalisedText';
import PacketT from '#/io/PacketT';
import JagString, { fromLiteral } from '#/datastruct/JagString';
import HashTable from '#/datastruct/HashTable';
import IntNode from '#/datastruct/IntNode';
import StringNode from '#/datastruct/StringNode';
import { bitCeil, doubleToInt } from '#/util/IntUtils';
import { arrayAtI16, arrayAtI32, arrayAtI8, arrayAtObj, arrayPutI32, arrayPutObj, requireNonNull } from '#/util/JavaArray';
import ModelLit from '#/dash3d/ModelLit';
import type ModelLitImpl from '#/dash3d/ModelLitImpl';
import ModelUnlit from '#/dash3d/ModelUnlit';
import type SeqType from './SeqType';
import { loadClient, loadGlModel, loadGlRenderer, loadGlSprite } from '#/util/GamepackClasses';

export default class ObjType {
    // HD h.b(I)V
    static releaseHdStatics(guard: number): void {
        try {
            releaseReferences(LocalisedText, 'germanIgnoreFirst');
            const Client = loadClient();
            releaseReferences(Client, 'levelExperience');
            releaseReferences(LocalisedText, 'chatcol2');
            if (guard !== 3327) {
                return;
            }
            releaseReferences(LocalisedText, 'defaultChatcol2', 'englishChatcol2');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'h.P(' + guard + ')');
        }
    }

    // bb.b:Z
    static m_memServer = false;
    // wd.i:Lal;
    static m_pConfigClient: Js5 | null = null;
    // nf.c:Lal;
    static m_pModels: Js5 | null = null;
    // fa.b:Lve;
    static readonly types = new LRUHashCache<ObjType>(64);
    // ra.M:Lve;
    static readonly modelCache = new LRUHashCache<object>(50);
    // gb.r:Lve;
    static readonly spriteCache = new LRUHashCache<object>(100);

    // f.a(Z)V
    static removeSoft(): void {
        ObjType.types.removeSoft();
        ObjType.modelCache.removeSoft();
        ObjType.spriteCache.removeSoft();
    }

    // ad.a(IB)V
    static clean(age: number): void {
        ObjType.types.Clean(age);
        ObjType.modelCache.Clean(age);
        ObjType.spriteCache.Clean(age);
    }

    // SD bi.a(I)V, HD rc.a(Z)V.
    static clearModelCache(): void {
        try {
            this.modelCache.Reset();
        } catch (error) {
            if (!glJar || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'rc.Q(true)');
        }
    }

    // sd.Y:I
    static m_numDefinitions = 0;
    // tk.e:[I
    static wearables: Int32Array | null = null;
    // mj.i:[Lid;
    static inventoryOps: (JagString | null)[] | null = null;
    // sb.i:[Lid;
    static groundOps: (JagString | null)[] | null = null;

    static m_countFont: SoftwareFont | null = null; // ae.k:Lfg;

    // bj.a(Lal;IZLfg;Lal;)V
    static Init(archive: Js5 | null, members: boolean, font: SoftwareFont | null, models: Js5 | null): void {
        ObjType.m_memServer = members;
        ObjType.m_pConfigClient = archive;
        ObjType.m_pModels = models;
        const group = (requireNonNull(ObjType.m_pConfigClient).GetGroupIdLimit() - 1) | 0;
        ObjType.m_numDefinitions = ((group << 8) + requireNonNull(ObjType.m_pConfigClient).GetFileIdLimit(group)) | 0;
        ObjType.inventoryOps = [null, null, null, null, LocalisedText.drop];
        ObjType.m_countFont = font;
        ObjType.groundOps = [null, null, LocalisedText.take, null, null];
    }

    // SD qj.a(BZ)V / HD al.a(ZI)V. The only HD call (ri.a at 2025) passes 255,
    // so al.r is retained when membership changes, before the three caches reset.
    static SwitchMembers(members: boolean): void {
        if (ObjType.m_memServer !== members) {
            ObjType.m_memServer = members;
            ObjType.ResetCache();
        }
    }

    // qc.e(B)V, definition cache. Also clears the obj model and sprite caches.
    static ResetCache(): void {
        ObjType.types.Reset();
        ObjType.modelCache.Reset();
        ObjType.spriteCache.Reset();
    }

    // SD qi.c(B)V, HD wa.e(B)V.
    static ResetSpriteCache(): void {
        try {
            ObjType.spriteCache.Reset();
        } catch (error) {
            if (!glJar || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'wa.VC(-29)');
        }
    }

    // jg.a(IIZIBI)Lvc;. NXT ObjType::GetSprite combines this cache lookup and the icon renderer below.
    static GetSprite(id: number, outline: number, showCount: boolean, count: number, shadow: number): AbstractSprite | null {
        const packed = (id + (showCount ? 65536 : 0) + (outline << 17) + (shadow << 19)) | 0;
        const key = BigInt.asIntN(64, BigInt(packed) * 3849834839n + 3147483667n * BigInt(count));
        const cached = ObjType.spriteCache.Find(key);
        if (cached !== null) {
            if (!(cached instanceof AbstractSprite)) throw new TypeError('ClassCastException: not an AbstractSprite');
            return cached;
        }
        Pix3D.textureFallback = false;
        const sprite = ObjType.buildSprite(id, count, false, outline, showCount, shadow);
        if (sprite !== null && !Pix3D.textureFallback) ObjType.spriteCache.Put(key, sprite);
        return sprite;
    }

    // jb.a(IZIZIIZI)Lvc;. Its first boolean has no reads on the live path. The recursive
    // 36×32 draw is in NXT ObjType::GetSprite. NXT GetBaseSprite has a different size-dependent projection.
    static buildSprite(id: number, count: number, enlarged: boolean, outline: number, showCount: boolean, shadow: number, forceSoftware: true): Pix32 | null;
    static buildSprite(id: number, count: number, enlarged: boolean, outline: number, showCount: boolean, shadow: number, forceSoftware?: boolean): AbstractSprite | null;
    static buildSprite(id: number, count: number, enlarged: boolean, outline: number, showCount: boolean, shadow: number, forceSoftware = false): AbstractSprite | null {
        let type = ObjType.List(id);
        if (count > 1 && type.countObj !== null) {
            let variant = -1;
            for (let i = 0; i < 10; i++) {
                if (arrayAtI32(type.countThreshold, i) <= count && arrayAtI32(type.countThreshold, i) !== 0) {
                    variant = arrayAtI32(type.countObj, i);
                }
            }
            if (variant !== -1) type = ObjType.List(variant);
        }
        const model = type.GetModelUnlitLit();
        if (model === null) return null;
        let linked: Pix32 | null = null;
        if (type.certTemplate !== -1) {
            linked = ObjType.buildSprite(type.certLink, 10, true, 1, false, 0, true);
            if (linked === null) return null;
        } else if (type.lentTemplate !== -1) {
            linked = ObjType.buildSprite(type.lentLink, count, false, outline, false, shadow, true);
            if (linked === null) return null;
        }

        let pixels: Int32Array | null;
        let width: number;
        let height: number;
        let clip: Int32Array;
        if (glJar) {
            pixels = Pix2D.pixels;
            width = Pix2D.width;
            height = Pix2D.height;
            clip = new Int32Array(4);
        } else {
            width = Pix2D.width;
            pixels = Pix2D.pixels;
            clip = new Int32Array(4);
            height = Pix2D.height;
        }
        Pix2D.saveClipping(clip);
        let sprite = new Pix32(36, 32);
        Pix2D.setPixels(sprite.pixels, 36, 32);
        Pix3D.setRenderClipping();
        Pix3D.setOrigin(16, 16);
        let zoom = type.zoom2d;
        if (enlarged) zoom = doubleToInt(1.5 * zoom);
        else if (outline === 2) zoom = doubleToInt(1.04 * zoom);
        Pix3D.lowDetail = false;
        const depth = Math.imul(zoom, arrayAtI32(Pix3D.cosTable, type.xAngle2d)) >> 16;
        const rise = Math.imul(arrayAtI32(Pix3D.sinTable, type.xAngle2d), zoom) >> 16;
        model.ObjRender(0, type.yAngle2d, type.zAngle2d, type.xAngle2d, type.xOffset2d, (-((model.getMinY() / 2) | 0) + rise + type.yOffset2d) | 0, (depth + type.yOffset2d) | 0, -1n);
        if (outline >= 1) {
            sprite.outline(1);
            if (outline >= 2) sprite.outline(0xffffff);
            Pix2D.setPixels(sprite.pixels, 36, 32);
        }
        if (shadow !== 0) sprite.shadow(shadow);
        if (type.certTemplate !== -1) {
            requireNonNull(linked).draw(0, 0);
        } else if (type.lentTemplate !== -1) {
            const base = requireNonNull(linked);
            Pix2D.setPixels(base.pixels, 36, 32);
            sprite.draw(0, 0);
            sprite = base;
        }
        if (showCount && (type.stackable === 1 || count !== 1) && count !== -1) {
            const font = ObjType.m_countFont;
            const text = ObjType.InvNumber(count);
            requireNonNull(font).drawLeft(text, 0, 9, 0xffff00, 1);
        }
        Pix2D.setPixels(pixels, width, height);
        Pix2D.restoreClipping(clip);
        Pix3D.setRenderClipping();
        Pix3D.lowDetail = true;
        // HD na.a(IBZIZIIZ)Lqf; wraps the complete icon only. A note or lent overlay is still
        // composited into mm.L with the software raster before the outer sprite reaches GL.
        if (glJar && loadGlRenderer().active && !forceSoftware) {
            return new (loadGlSprite())(sprite);
        }
        return sprite;
    }

    // lf.a(B)V
    static findWearables(): void {
        const ids = new Int32Array(ObjType.m_numDefinitions);
        let count = 0;
        for (let id = 0; id < ObjType.m_numDefinitions; id++) {
            const type = ObjType.List(id);
            if (type.maleWear >= 0 || type.femaleWear >= 0) arrayPutI32(ids, count++, id);
        }
        ObjType.wearables = new Int32Array(count);
        for (let i = 0; i < count; i++) ObjType.wearables[i] = ids[i];
    }

    // rg.a(II)Lkl;
    static List(id: number): ObjType {
        let type = ObjType.types.Find(BigInt(id));
        if (type !== null) return type;
        const bytes = requireNonNull(ObjType.m_pConfigClient).GetFile(ObjType.file(id), ObjType.group(id));
        type = new ObjType();
        type.id = id;
        if (bytes) type.Decode(new PacketT(bytes));
        type.PostDecode();
        if (type.certTemplate !== -1) type.GenCert(ObjType.List(type.certTemplate), ObjType.List(type.certLink));
        if (type.lentTemplate !== -1) type.generateLent(ObjType.List(type.lentTemplate), ObjType.List(type.lentLink));
        if (!ObjType.m_memServer && type.members) {
            type.groundOps = ObjType.groundOps;
            type.inventoryOps = ObjType.inventoryOps;
            type.stockmarket = false;
            type.team = 0;
            type.name = LocalisedText.membersObject;
        }
        ObjType.types.Put(BigInt(id), type);
        return type;
    }
    // ha.a(II)I
    private static group(id: number): number {
        return id >>> 8;
    }
    // tb.a(II)I
    private static file(id: number): number {
        return id & 255;
    }

    static defaultName: JagString | null = fromLiteral('null'); // ha.f:Lid;
    static readonly iconCountYellow = fromLiteral('<col=ffff00>'); // qj.H:Lid;
    static readonly objCountThousandsColTag = fromLiteral('<col=ffffff>'); // ud.n:Lid;
    static readonly countColourMillions = fromLiteral('<col=00ff80>'); // ik.bb:Lid;
    static readonly colourEndTag = fromLiteral('<)4col>'); // rk.l:Lid;

    // ii.a(II)Lid;. NXT ObjType::InvNumber, rs2lib/configdecoder/ObjType.cpp.
    static InvNumber(count: number): JagString {
        if (count < 100000) {
            return JagString.join([ObjType.iconCountYellow, JagString.fromInt(count), ObjType.colourEndTag]);
        }
        if (count < 10000000) {
            return JagString.join([ObjType.objCountThousandsColTag, JagString.fromInt((count / 1000) | 0), LocalisedText.thousandsSuffix2, ObjType.colourEndTag]);
        }
        return JagString.join([ObjType.countColourMillions, JagString.fromInt((count / 1000000) | 0), LocalisedText.millionSuffix, ObjType.colourEndTag]);
    }

    static recolourPalette = new Int16Array(256); // al.q:[S
    // kl.b:I
    resizeY: number;
    // kl.d:I
    cursor1: number;
    // kl.f:Z
    members: boolean;
    // kl.h:I
    cost: number;
    // kl.j:I
    cursorOp1: number;
    // kl.k:I
    maleWear3: number;
    // kl.l:I
    certLink: number;
    // kl.m:I
    zAngle2d: number;
    // kl.n:I
    femaleHead: number;
    // kl.q:I
    yOffset2d: number;
    // kl.r:I
    maleOffsetZ: number;
    // kl.s:Lid;
    name: JagString | null;
    // kl.u:I
    xOffset2d: number;
    // kl.v:I
    certTemplate: number;
    // kl.x:I
    dummyItem: number;
    // kl.y:[I
    countThreshold: Int32Array | null = null;
    // kl.z:[S
    retextureDest: Int16Array | null = null;
    // kl.A:I
    femaleWear2: number;
    // kl.C:[Lid;
    groundOps: (JagString | null)[] | null;
    // kl.H:I
    resizeZ: number;
    // kl.I:I
    id = 0;
    // kl.J:I
    lentTemplate: number;
    // kl.K:[B
    recolourPalette: Int8Array | null = null;
    // kl.L:[S
    retextureSource: Int16Array | null = null;
    // kl.N:I
    resizeX: number;
    // kl.O:I
    lentLink: number;
    // kl.P:I
    yAngle2d: number;
    // kl.U:I
    xAngle2d: number;
    // kl.V:[I
    countObj: Int32Array | null = null;
    // kl.W:I
    maleOffsetY: number;
    // kl.Y:I
    femaleHead2: number;
    // kl.ab:Lnc;
    params: HashTable<IntNode | StringNode> | null = null;
    // kl.db:I
    cursor2: number;
    // kl.eb:I
    contrast: number;
    // kl.fb:I
    cursorOp2: number;
    // kl.gb:I
    zoom2d: number;
    // kl.hb:I
    maleHead2: number;
    // kl.ib:I
    stackable: number;
    // kl.jb:[S
    recolourDest: Int16Array | null = null;
    // kl.kb:I
    femaleOffsetX: number;
    // kl.mb:I
    femaleOffsetY: number;
    // kl.nb:I
    maleHead: number;
    // kl.ob:I
    femaleOffsetZ: number;
    // kl.pb:I
    femaleWear3: number;
    // kl.qb:I
    femaleWear: number;
    // kl.rb:Z
    stockmarket: boolean;
    // kl.tb:I
    maleWear2: number;
    // kl.vb:[Lid;
    inventoryOps: (JagString | null)[] | null;
    // kl.xb:I
    model = 0;
    // kl.yb:I
    maleOffsetX: number;
    // kl.zb:[S
    recolourSource: Int16Array | null = null;
    // kl.Ab:I
    team: number;
    // kl.Cb:I
    ambient: number;
    // kl.Fb:I
    maleWear: number;

    // kl.<init>()V
    constructor() {
        this.zAngle2d = 0;
        this.cursorOp1 = -1;
        this.cost = 1;
        this.femaleWear2 = -1;
        this.certLink = -1;
        this.dummyItem = 0;
        this.name = ObjType.defaultName;
        this.maleOffsetZ = 0;
        this.resizeX = 128;
        this.cursor1 = -1;
        this.lentTemplate = -1;
        this.certTemplate = -1;
        this.resizeZ = 128;
        this.yAngle2d = 0;
        this.maleOffsetY = 0;
        this.members = false;
        this.xAngle2d = 0;
        this.yOffset2d = 0;
        this.stackable = 0;
        this.groundOps = [null, null, LocalisedText.take, null, null];
        this.femaleOffsetZ = 0;
        this.femaleHead2 = -1;
        this.cursorOp2 = -1;
        this.cursor2 = -1;
        this.femaleOffsetX = 0;
        this.femaleWear3 = -1;
        this.femaleOffsetY = 0;
        this.contrast = 0;
        this.resizeY = 128;
        this.maleHead2 = -1;
        this.femaleWear = -1;
        this.maleWear2 = -1;
        this.inventoryOps = [null, null, null, null, LocalisedText.drop];
        this.zoom2d = 2000;
        this.xOffset2d = 0;
        this.femaleHead = -1;
        this.maleOffsetX = 0;
        this.stockmarket = false;
        this.maleWear = -1;
        this.team = 0;
        this.maleWear3 = -1;
        this.lentLink = -1;
        this.ambient = 0;
        this.maleHead = -1;
    }

    // kl.a(Lgd;I)V
    Decode(p: PacketT): void {
        for (;;) {
            const code = p.g1();
            if (code === 0) return;
            this.DecodeType(code, p);
        }
    }

    // kl.a(ILgd;I)V
    private DecodeType(code: number, p: PacketT): void {
        switch (code) {
            case 1:
                this.model = p.g2();
                break;
            case 2:
                this.name = p.gStringNoConversion();
                break;
            case 4:
                this.zoom2d = p.g2();
                break;
            case 5:
                this.xAngle2d = p.g2();
                break;
            case 6:
                this.yAngle2d = p.g2();
                break;
            case 7:
                this.xOffset2d = p.g2s();
                break;
            case 8:
                this.yOffset2d = p.g2s();
                break;
            case 11:
                this.stackable = 1;
                break;
            case 12:
                this.cost = p.g4();
                break;
            case 16:
                this.members = true;
                break;
            case 23:
                this.maleWear = p.g2();
                break;
            case 24:
                this.maleWear2 = p.g2();
                break;
            case 25:
                this.femaleWear = p.g2();
                break;
            case 26:
                this.femaleWear2 = p.g2();
                break;
            case 40: {
                const count = p.g1();
                this.recolourDest = new Int16Array(count);
                this.recolourSource = new Int16Array(count);
                for (let i = 0; i < count; i++) {
                    this.recolourSource[i] = p.g2();
                    this.recolourDest[i] = p.g2();
                }
                break;
            }
            case 41: {
                const count = p.g1();
                this.retextureDest = new Int16Array(count);
                this.retextureSource = new Int16Array(count);
                for (let i = 0; i < count; i++) {
                    this.retextureSource[i] = p.g2();
                    this.retextureDest[i] = p.g2();
                }
                break;
            }
            case 42: {
                const count = p.g1();
                this.recolourPalette = new Int8Array(count);
                for (let i = 0; i < count; i++) this.recolourPalette[i] = p.g1s();
                break;
            }
            case 65:
                this.stockmarket = true;
                break;
            case 78:
                this.maleWear3 = p.g2();
                break;
            case 79:
                this.femaleWear3 = p.g2();
                break;
            case 90:
                this.maleHead = p.g2();
                break;
            case 91:
                this.femaleHead = p.g2();
                break;
            case 92:
                this.maleHead2 = p.g2();
                break;
            case 93:
                this.femaleHead2 = p.g2();
                break;
            case 95:
                this.zAngle2d = p.g2();
                break;
            case 96:
                this.dummyItem = p.g1();
                break;
            case 97:
                this.certLink = p.g2();
                break;
            case 98:
                this.certTemplate = p.g2();
                break;
            case 110:
                this.resizeX = p.g2();
                break;
            case 111:
                this.resizeY = p.g2();
                break;
            case 112:
                this.resizeZ = p.g2();
                break;
            case 113:
                this.ambient = p.g1s();
                break;
            case 114:
                this.contrast = 5 * p.g1s();
                break;
            case 115:
                this.team = p.g1();
                break;
            case 121:
                this.lentLink = p.g2();
                break;
            case 122:
                this.lentTemplate = p.g2();
                break;
            case 125:
                this.maleOffsetX = p.g1s();
                this.maleOffsetY = p.g1s();
                this.maleOffsetZ = p.g1s();
                break;
            case 126:
                this.femaleOffsetX = p.g1s();
                this.femaleOffsetY = p.g1s();
                this.femaleOffsetZ = p.g1s();
                break;
            case 127:
                this.cursorOp1 = p.g1();
                this.cursor1 = p.g2();
                break;
            case 128:
                this.cursorOp2 = p.g1();
                this.cursor2 = p.g2();
                break;
            case 129:
            case 130:
                p.g1();
                p.g2();
                break;
            case 249: {
                const count = p.g1();
                if (this.params === null) this.params = new HashTable(bitCeil(count));
                for (let i = 0; i < count; i++) {
                    const string = p.g1() === 1;
                    const key = p.g3();
                    const node = string ? new StringNode(p.gStringNoConversion()) : new IntNode(p.g4());
                    this.params.put(node, BigInt(key));
                }
                break;
            }
            default:
                if (code >= 30 && code < 35) {
                    const op = p.gStringNoConversion();
                    arrayPutObj(this.groundOps, code - 30, op);
                    if (op.equalsIgnoreCase(LocalisedText.hidden)) arrayPutObj(this.groundOps, code - 30, null);
                } else if (code >= 35 && code < 40) {
                    arrayPutObj(this.inventoryOps, code - 35, p.gStringNoConversion());
                } else if (code >= 100 && code < 110) {
                    if (this.countObj === null) {
                        this.countThreshold = new Int32Array(10);
                        this.countObj = new Int32Array(10);
                    }
                    this.countObj[code - 100] = p.g2();
                    arrayPutI32(this.countThreshold, code - 100, p.g2());
                }
        }
    }

    // kl.c(I)V
    PostDecode(): void {}

    // kl.a(IIB)I
    GetParam(defaultValue: number, key: number): number {
        if (this.params === null) return defaultValue;
        const node = this.params.get(BigInt(key));
        if (node === null) return defaultValue;
        if (!(node instanceof IntNode)) throw new TypeError('Expected integer obj value');
        return node.value;
    }

    // kl.a(ILid;I)Lid;
    GetParam2(key: number, defaultValue: JagString | null): JagString | null {
        if (this.params === null) return defaultValue;
        const node = this.params.get(BigInt(key));
        if (node === null) return defaultValue;
        if (!(node instanceof StringNode)) throw new TypeError('Expected string obj value');
        return node.value;
    }

    // kl.a(BLkl;Lkl;)V
    GenCert(template: ObjType, link: ObjType): void {
        this.xOffset2d = template.xOffset2d;
        this.recolourDest = template.recolourDest;
        this.cost = link.cost;
        this.yOffset2d = template.yOffset2d;
        this.recolourSource = template.recolourSource;
        this.retextureSource = template.retextureSource;
        this.members = link.members;
        this.yAngle2d = template.yAngle2d;
        this.zoom2d = template.zoom2d;
        this.recolourPalette = template.recolourPalette;
        this.name = link.name;
        this.retextureDest = template.retextureDest;
        this.model = template.model;
        this.stackable = 1;
        this.zAngle2d = template.zAngle2d;
        this.xAngle2d = template.xAngle2d;
    }

    // kl.a(Lkl;Lkl;Z)V
    generateLent(template: ObjType, link: ObjType): void {
        this.retextureSource = link.retextureSource;
        this.xAngle2d = template.xAngle2d;
        this.zoom2d = template.zoom2d;
        this.retextureDest = link.retextureDest;
        this.recolourDest = link.recolourDest;
        this.maleWear = link.maleWear;
        this.cost = 0;
        this.recolourSource = link.recolourSource;
        this.femaleWear2 = link.femaleWear2;
        this.femaleOffsetX = link.femaleOffsetX;
        this.femaleOffsetZ = link.femaleOffsetZ;
        this.xOffset2d = template.xOffset2d;
        this.femaleOffsetY = link.femaleOffsetY;
        this.name = link.name;
        this.recolourPalette = link.recolourPalette;
        this.groundOps = link.groundOps;
        this.maleOffsetZ = link.maleOffsetZ;
        this.femaleHead = link.femaleHead;
        this.femaleWear = link.femaleWear;
        this.yAngle2d = template.yAngle2d;
        this.maleWear3 = link.maleWear3;
        this.femaleWear3 = link.femaleWear3;
        this.maleHead2 = link.maleHead2;
        this.maleOffsetY = link.maleOffsetY;
        this.team = link.team;
        this.members = link.members;
        this.maleOffsetX = link.maleOffsetX;
        this.femaleHead2 = link.femaleHead2;
        this.zAngle2d = template.zAngle2d;
        this.maleHead = link.maleHead;
        this.model = template.model;
        this.maleWear2 = link.maleWear2;
        this.params = link.params;
        this.inventoryOps = new Array<JagString | null>(5).fill(null);
        this.yOffset2d = template.yOffset2d;
        if (link.inventoryOps !== null) {
            for (let i = 0; i < 4; i++) this.inventoryOps[i] = arrayAtObj(link.inventoryOps, i);
        }
        this.inventoryOps[4] = LocalisedText.discard;
    }

    // kl.a(II)Lkl;
    GetStackSizeAlt(count: number): ObjType {
        if (this.countObj !== null && count > 1) {
            let id = -1;
            for (let i = 0; i < 10; i++) {
                const threshold = arrayAtI32(this.countThreshold, i);
                if (threshold <= count && threshold !== 0) id = arrayAtI32(this.countObj, i);
            }
            if (id !== -1) return ObjType.List(id);
        }
        return this;
    }

    // kl.b(ZI)Z
    CheckWearModel(female: boolean): boolean {
        let second = this.maleWear2;
        let first = this.maleWear;
        let third = this.maleWear3;
        if (female) {
            second = this.femaleWear2;
            first = this.femaleWear;
            third = this.femaleWear3;
        }
        if (first === -1) return true;
        let ready = true;
        if (!requireNonNull(ObjType.m_pModels).RequestDownload(true, first, 0)) ready = false;
        if (second !== -1 && !requireNonNull(ObjType.m_pModels).RequestDownload(true, second, 0)) ready = false;
        if (third !== -1 && !requireNonNull(ObjType.m_pModels).RequestDownload(true, third, 0)) ready = false;
        return ready;
    }

    // kl.a(IZ)Z
    CheckHeadModel(female: boolean): boolean {
        let first = this.maleHead;
        let second = this.maleHead2;
        if (female) {
            first = this.femaleHead;
            second = this.femaleHead2;
        }
        if (first === -1) return true;
        let ready = true;
        if (!requireNonNull(ObjType.m_pModels).RequestDownload(true, first, 0)) ready = false;
        if (second !== -1 && !requireNonNull(ObjType.m_pModels).RequestDownload(true, second, 0)) ready = false;
        return ready;
    }

    // Renderer methods (batch 5). Locals keep the decompiler's names (its output for these four bodies follows the
    // bytecode); argument expressions are evaluated before a null receiver is dereferenced, as the JVM does.

    // kl.a(ZZ)Lcb; (NXT ObjType::GetWearModelNoCheck, ObjType.cpp:1369)
    // The worn mesh: the one to three wear models merged, offset, recoloured and retextured. var2 = female. The first
    // Java boolean is a stripped dummy: its only caller (cl.a(IILek;IZ[Lci;IIZLek;I)Lnd;, javap offset 503) passes
    // false, which skips the guard `if (var1) this.b(false, -79)` (a discarded CheckWearModel call).
    GetWearModelNoCheck(var2: boolean): ModelUnlit | null {
        let var3 = this.maleWear;
        let var5 = this.maleWear3;
        let var4 = this.maleWear2;
        if (var2) {
            var4 = this.femaleWear2;
            var5 = this.femaleWear3;
            var3 = this.femaleWear;
        }

        if (var3 === -1) {
            return null;
        }

        let var6 = ModelUnlit.Load(ObjType.m_pModels, var3, 0);
        if (var4 !== -1) {
            const var7 = ModelUnlit.Load(ObjType.m_pModels, var4, 0);
            if (var5 === -1) {
                const var8: (ModelUnlit | null)[] = [var6, var7];
                var6 = new ModelUnlit(var8, 2);
            } else {
                const var14 = ModelUnlit.Load(ObjType.m_pModels, var5, 0);
                const var9: (ModelUnlit | null)[] = [var6, var7, var14];
                var6 = new ModelUnlit(var9, 3);
            }
        }

        if (!var2 && (this.maleOffsetX !== 0 || this.maleOffsetY !== 0 || this.maleOffsetZ !== 0)) {
            requireNonNull(var6).Translate(this.maleOffsetX, this.maleOffsetY, this.maleOffsetZ);
        }

        if (var2 && (this.femaleOffsetX !== 0 || this.femaleOffsetY !== 0 || this.femaleOffsetZ !== 0)) {
            requireNonNull(var6).Translate(this.femaleOffsetX, this.femaleOffsetY, this.femaleOffsetZ);
        }

        if (this.recolourSource !== null) {
            for (let var12 = 0; var12 < this.recolourSource.length; var12++) {
                const from = arrayAtI16(this.recolourSource, var12);
                const to = arrayAtI16(this.recolourDest, var12);
                requireNonNull(var6).Recolour(from, to);
            }
        }

        if (this.retextureSource !== null) {
            for (let var13 = 0; var13 < this.retextureSource.length; var13++) {
                const from = arrayAtI16(this.retextureSource, var13);
                const to = arrayAtI16(this.retextureDest, var13);
                requireNonNull(var6).Retexture(from, to);
            }
        }

        return var6;
    }

    // kl.a(B)Lfc; (no NXT counterpart; named per the batch-5 API sheet)
    // The inventory-icon model: the base model recoloured (through the obj palette when it has an entry), retextured,
    // lit as a ModelLitImpl and resized. NXT's GetModelUnlit (ObjType.cpp:698) resolves the count variant and returns
    // the unlit mesh, and NXT GetModelLit (ObjType.cpp:778) is the cached kl.a(Lek;IIIII)Lnd; below, so neither is this
    // routine. The byte argument is a stripped dummy: its live caller, the icon renderer jb.a(IZIZIIZI)Lvc; (javap
    // offset 113), passes -72, and its other call, in GenCert kl.a(BLkl;Lkl;)V at offset 9, passes -69 under the dead
    // guard `if (var1 > -120)` (GenCert's only caller passes -126). Either way `-128 / ((81 - var1) / 41)` divides by 3
    // and never throws.
    GetModelUnlitLit(): ModelLitImpl | null {
        const var2 = ModelUnlit.Load(ObjType.m_pModels, this.model, 0);
        if (var2 === null) {
            return null;
        }

        if (this.recolourSource !== null) {
            for (let var4 = 0; var4 < this.recolourSource.length; var4++) {
                if (this.recolourPalette !== null && this.recolourPalette.length > var4) {
                    var2.Recolour(arrayAtI16(this.recolourSource, var4), arrayAtI16(ObjType.recolourPalette, 255 & arrayAtI8(this.recolourPalette, var4)));
                } else {
                    var2.Recolour(arrayAtI16(this.recolourSource, var4), arrayAtI16(this.recolourDest, var4));
                }
            }
        }

        if (this.retextureSource !== null) {
            for (let var7 = 0; var7 < this.retextureSource.length; var7++) {
                var2.Retexture(arrayAtI16(this.retextureSource, var7), arrayAtI16(this.retextureDest, var7));
            }
        }

        const var8 = var2.LightImpl((this.ambient + 64) | 0, (768 + this.contrast) | 0, -50, -10, -50);
        if (this.resizeX !== 128 || this.resizeY !== 128 || this.resizeZ !== 128) {
            var8.Resize(this.resizeX, this.resizeY, this.resizeZ);
        }

        return var8;
    }

    // kl.a(ZI)Lcb; (NXT ObjType::GetHeadModelNoCheck, ObjType.cpp:1508)
    // The chathead mesh: one or two head models merged, recoloured and retextured. var1 = female. HD h.a(ZB)Lgb;
    // loads file 0 for both models. In SD, var2 is the first head model's file id. Its only caller (cl.a(IILek;II)Lnd;,
    // javap offset 223) passes 0, but it reaches ModelUnlit.Load, so it is kept rather than stripped.
    GetHeadModelNoCheck(var1: boolean, var2: number): ModelUnlit | null {
        let var4 = this.maleHead2;
        let var3 = this.maleHead;
        if (var1) {
            var3 = this.femaleHead;
            var4 = this.femaleHead2;
        }

        if (var3 === -1) {
            return null;
        }

        let var5 = ModelUnlit.Load(ObjType.m_pModels, var3, glJar ? 0 : var2);
        if (var4 !== -1) {
            const var6 = ModelUnlit.Load(ObjType.m_pModels, var4, 0);
            const var7: (ModelUnlit | null)[] = [var5, var6];
            var5 = new ModelUnlit(var7, 2);
        }

        if (this.recolourSource !== null) {
            for (let var10 = 0; var10 < this.recolourSource.length; var10++) {
                const from = arrayAtI16(this.recolourSource, var10);
                const to = arrayAtI16(this.recolourDest, var10);
                requireNonNull(var5).Recolour(from, to);
            }
        }

        if (this.retextureSource !== null) {
            for (let var11 = 0; var11 < this.retextureSource.length; var11++) {
                const from = arrayAtI16(this.retextureSource, var11);
                const to = arrayAtI16(this.retextureDest, var11);
                requireNonNull(var5).Retexture(from, to);
            }
        }

        return var5;
    }

    // SD kl.a(Lek;IIIII)Lnd;, HD h.a(IIILtk;II)Lak; (NXT ObjType::GetModelLit, ObjType.cpp:778)
    // The lit ground/interface model of this obj's count variant for var4 items, cached in modelCache (ra.M) by id with
    // useAABBMouseCheck set, then animated by var1 when non-null (frame var2, next frame var6, cycle var5). The third
    // Java int is a stripped dummy: every caller passes -93 (ig.a, aj.a(Lcl;IIZIZLek;)Lnd;, lf.a and the count-variant
    // recursion here, at javap offsets 20, 298, 4793 and 115), so the guard `if (var3 != -93) this.nb = 127` never runs.
    GetModelLit(var1: SeqType | null, var2: number, var4: number, var5: number, var6: number): ModelLit | null {
        if (this.countObj !== null && var4 > 1) {
            let var7 = -1;
            for (let var8 = 0; var8 < 10; var8++) {
                if (arrayAtI32(this.countThreshold, var8) <= var4 && arrayAtI32(this.countThreshold, var8) !== 0) {
                    var7 = arrayAtI32(this.countObj, var8);
                }
            }

            if (var7 !== -1) {
                return ObjType.List(var7).GetModelLit(var1, var2, 1, var5, var6);
            }
        }

        const cached = ObjType.modelCache.Find(BigInt(this.id));
        if (cached !== null && !(cached instanceof ModelLit)) throw new TypeError('ClassCastException: not a ModelLit');
        let var12: ModelLit | null = cached;
        if (var12 === null) {
            const var13 = ModelUnlit.Load(ObjType.m_pModels, this.model, 0);
            if (var13 === null) {
                return null;
            }

            if (this.recolourSource !== null) {
                for (let var9 = 0; var9 < this.recolourSource.length; var9++) {
                    if (this.recolourPalette === null || var9 >= this.recolourPalette.length) {
                        var13.Recolour(arrayAtI16(this.recolourSource, var9), arrayAtI16(this.recolourDest, var9));
                    } else {
                        var13.Recolour(arrayAtI16(this.recolourSource, var9), arrayAtI16(ObjType.recolourPalette, arrayAtI8(this.recolourPalette, var9) & 255));
                    }
                }
            }

            if (this.retextureSource !== null) {
                for (let var14 = 0; var14 < this.retextureSource.length; var14++) {
                    var13.Retexture(arrayAtI16(this.retextureSource, var14), arrayAtI16(this.retextureDest, var14));
                }
            }

            var12 = var13.Light((this.ambient + 64) | 0, (768 + this.contrast) | 0, -50, -10, -50);
            if (this.resizeX !== 128 || this.resizeY !== 128 || this.resizeZ !== 128) {
                var12.Resize(this.resizeX, this.resizeY, this.resizeZ);
            }

            var12.useAABBMouseCheck = true;
            if (glJar && loadGlRenderer().active) {
                const GlModel = loadGlModel();
                if (!(var12 instanceof GlModel)) throw new TypeError('ClassCastException: expected GlModel');
                var12.prepareBuffers(false, false, false, true, false, false, true);
            }
            ObjType.modelCache.Put(BigInt(this.id), var12);
        }

        if (var1 !== null) {
            var12 = var1.AnimateModelWithExtra(var2, var6, var12, var5);
        }

        return var12;
    }
}
