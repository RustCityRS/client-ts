import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import type GlModel from '#/dash3d/GlModel';
import LRUHashCache from '#/datastruct/LRUHashCache';
import type Js5 from '#/cache/Js5';
import PacketT from '#/io/PacketT';
import { glJar } from '#/client/ClientVariant';
import JagString, { fromLiteral } from '#/datastruct/JagString';
import HashTable from '#/datastruct/HashTable';
import IntNode from '#/datastruct/IntNode';
import StringNode from '#/datastruct/StringNode';
import { bitCeil } from '#/util/IntUtils';
import { arrayAtI16, arrayAtI32, arrayAtI8, arrayAtObj, arrayPutObj, requireNonNull } from '#/util/JavaArray';
import LocalisedText from '#/ui/LocalisedText';
import ClientVarCache from '#/util/ClientVarCache';
import LocEntity from '#/dash3d/LocEntity';
import type ModelLit from '#/dash3d/ModelLit';
import ModelLitImpl from '#/dash3d/ModelLitImpl';
import ModelSource from '#/dash3d/ModelSource';
import ModelUnlit from '#/dash3d/ModelUnlit';
import type Pix8 from '#/graphics/Pix8';
import type SeqType from './SeqType';
import { loadClient, loadClientKeyboardListener, loadGlModel, loadGlRenderer } from '#/util/GamepackClasses';

export default class LocType {
    // HD pb.b(I)V
    static releaseHdStatics(guard: number): void {
        try {
            releaseReferences(LocalisedText, 'frenchChooseOption', 'frenchLoadingPleaseWait2');
            const Client = loadClient();
            releaseReferences(Client, 'dynamicChunks');
            const ClientKeyboardListener = loadClientKeyboardListener();
            releaseReferences(ClientKeyboardListener, 'pressed');
            releaseReferences(LocalisedText, 'frenchLoadingTextures');
            if (guard !== -11) {
                Client.walkClickStage = -96;
            }
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'pb.B(' + guard + ')');
        }
    }

    // gd.U:Lal;
    static m_pConfigClient: Js5 | null = null;
    // ik.Y:Lal;
    static m_pModels: Js5 | null = null;
    // ok.z:Z
    static members = false;
    // uj.j:Z
    static m_lowMem = false;
    // he.w:Lve;
    static readonly m_recentUse = new LRUHashCache<LocType>(64);
    // lj.c:Lve;
    static readonly m_mc1 = new LRUHashCache<object>(500);
    // vf.T:Lve;
    static readonly m_mc2 = new LRUHashCache<object>(30);
    // uj.f:Lve;
    static readonly m_mc3 = new LRUHashCache<object>(50);

    // SD sb.a(Lal;BLal;Z)V, HD oi.a(ILve;Lve;Z)V
    static Init(models: Js5 | null, archive: Js5 | null, members: boolean): void {
        if (glJar) {
            LocType.members = members;
            LocType.m_pModels = models;
        } else {
            LocType.m_pModels = models;
            LocType.members = members;
        }
        LocType.m_pConfigClient = archive;
    }

    // id.a(ZI)V
    static setMembers(members: boolean): void {
        if (LocType.members !== members) {
            LocType.members = members;
            LocType.ResetCache();
        }
    }

    // oi.a(I)V
    static removeSoft(): void {
        LocType.m_recentUse.removeSoft();
        LocType.m_mc1.removeSoft();
        LocType.m_mc2.removeSoft();
        LocType.m_mc3.removeSoft();
    }

    // ff.a(ZI)V
    static clean(age: number): void {
        LocType.m_recentUse.Clean(age);
        LocType.m_mc1.Clean(age);
        LocType.m_mc2.Clean(age);
        LocType.m_mc3.Clean(age);
    }

    // ke.a(I)V, definition cache. Also clears the loc model caches.
    static ResetCache(): void {
        LocType.m_recentUse.Reset();
        LocType.m_mc1.Reset();
        LocType.m_mc2.Reset();
        LocType.m_mc3.Reset();
    }

    // SD ke.a(II)Ljb;, HD wc.a(II)Lpb;
    static List(id: number): LocType {
        let type = LocType.m_recentUse.Find(BigInt(id));
        if (type !== null && !(type instanceof LocType)) throw new TypeError('ClassCastException: not a LocType');
        if (type !== null) return type;
        const bytes = requireNonNull(LocType.m_pConfigClient).GetFile(LocType.file(id), LocType.group(id));
        type = new LocType();
        type.id = id;
        if (bytes !== null) type.Decode(new PacketT(bytes));
        type.PostDecode();
        if (!LocType.members && type.members) type.ops = null;
        if (type.breakRoutefinding) {
            if (glJar) {
                type.blockwalk = 0;
                type.blockrange = false;
            } else {
                type.blockrange = false;
                type.blockwalk = 0;
            }
        }
        LocType.m_recentUse.Put(BigInt(id), type);
        return type;
    }

    // gl.b(II)I
    private static group(id: number): number {
        return id >>> 8;
    }
    // q.a(IZ)I
    private static file(id: number): number {
        return id & 255;
    }

    static defaultName: JagString | null = fromLiteral('null'); // n.e:Lid;
    static recolPalette = new Int16Array(256); // de.v:[S
    // jb.b:I
    resizeX: number;
    // jb.c:I
    minDelay: number;
    // jb.e:[I
    multi: Int32Array | null = null;
    // jb.f:Z
    breakRoutefinding: boolean;
    // jb.h:I
    cursor2: number;
    // jb.i:I
    ambient: number;
    // jb.j:I
    mapFunction: number;
    // jb.k:I
    id = 0;
    // jb.m:[S
    retextureSource: Int16Array | null = null;
    // jb.n:I
    raiseObject: number;
    // jb.q:Z
    forceDecor: boolean;
    // jb.r:Lid;
    name: JagString | null;
    // jb.t:I
    offsetZ: number;
    // jb.u:I
    cursor1: number;
    // jb.w:Lnc;
    params: HashTable<IntNode | StringNode> | null = null;
    // jb.x:Z
    occludes: boolean;
    // jb.y:I
    length: number;
    // jb.z:[S
    retextureDest: Int16Array | null = null;
    // jb.C:[B
    recolourPalette: Int8Array | null = null;
    // jb.D:[S
    recolourSource: Int16Array | null = null;
    // jb.E:I
    ambientSound: number;
    // jb.F:I
    offsetX: number;
    // jb.H:I
    animation: number;
    // jb.I:Z
    flag96: boolean;
    // jb.J:Z
    shareLight: boolean;
    // jb.K:Z
    randomAnimFrame: boolean;
    // jb.L:I
    contrast: number;
    // jb.M:Z
    blockrange: boolean;
    // jb.O:I
    msiAngle: number;
    // jb.P:Z
    flag90: boolean;
    // jb.R:I
    active: number;
    // jb.S:B
    hillSkew: number;
    // jb.T:[I
    modelShapes: Int32Array | null = null;
    // jb.U:S
    hillParam: number;
    // jb.X:I
    resizeZ: number;
    // jb.Y:I
    cursorOp1: number;
    // jb.Z:I
    wallWidth: number;
    // jb.bb:I
    resizeY: number;
    // jb.cb:Z
    hasParticles: boolean;
    // jb.eb:I
    cursorOp2: number;
    // jb.fb:I
    width: number;
    // jb.gb:[S
    recolourDest: Int16Array | null = null;
    // jb.hb:Z
    flag88: boolean;
    // jb.ib:I
    maxDelay: number;
    // jb.jb:Z
    mirror: boolean;
    // jb.kb:[Lid;
    ops: (JagString | null)[] | null;
    // jb.lb:I
    multiVarp: number;
    // jb.mb:[I
    randomSounds: Int32Array | null = null;
    // jb.nb:I
    offsetY: number;
    // jb.pb:I
    soundRadius: number;
    // jb.qb:I
    blockwalk: number;
    // jb.rb:Z
    members: boolean;
    // jb.tb:I
    forceApproach: number;
    // jb.ub:Z
    msiRotate: boolean;
    // jb.wb:I
    mapScene: number;
    // jb.xb:I
    multiVarbit: number;
    // jb.yb:[I
    modelIds: Int32Array | null = null;
    // jb.zb:Z
    shadow: boolean;
    // HD pb.lb:Z, runetek5 LocType::field_844 (opcode 82).
    declare field_844: boolean;

    // SD jb.<init>()V, HD pb.<init>()V
    constructor() {
        if (glJar) {
            this.width = 1;
            this.forceDecor = false;
            this.length = 1;
            this.flag90 = false;
            this.ambient = 0;
            this.name = LocType.defaultName;
            this.flag88 = true;
            this.cursorOp1 = -1;
            this.maxDelay = 0;
            this.mapScene = -1;
            this.hillSkew = 0;
            this.members = false;
            this.cursor1 = -1;
            this.offsetX = 0;
            this.minDelay = 0;
            this.mapFunction = -1;
            this.hasParticles = false;
            this.cursorOp2 = -1;
            this.hillParam = -1;
            this.resizeZ = 128;
            this.ops = new Array<JagString | null>(5).fill(null);
            this.resizeX = 128;
            this.randomAnimFrame = true;
            this.resizeY = 128;
            this.breakRoutefinding = false;
            this.active = -1;
            this.field_844 = false;
            this.shadow = true;
            this.multiVarp = -1;
            this.cursor2 = -1;
            this.forceApproach = 0;
            this.blockrange = true;
            this.offsetZ = 0;
            this.msiAngle = 0;
            this.wallWidth = 16;
            this.msiRotate = false;
            this.offsetY = 0;
            this.soundRadius = 0;
            this.contrast = 0;
            this.animation = -1;
            this.flag96 = false;
            this.ambientSound = -1;
            this.blockwalk = 2;
            this.mirror = false;
            this.multiVarbit = -1;
            this.raiseObject = -1;
            this.shareLight = false;
            this.occludes = false;
            return;
        }
        this.ambient = 0;
        this.forceDecor = false;
        this.breakRoutefinding = false;
        this.cursor1 = -1;
        this.name = LocType.defaultName;
        this.resizeX = 128;
        this.cursor2 = -1;
        this.minDelay = 0;
        this.animation = -1;
        this.flag96 = false;
        this.raiseObject = -1;
        this.blockrange = true;
        this.resizeZ = 128;
        this.offsetX = 0;
        this.offsetZ = 0;
        this.msiAngle = 0;
        this.cursorOp1 = -1;
        this.resizeY = 128;
        this.mapFunction = -1;
        this.hillSkew = 0;
        this.contrast = 0;
        this.flag90 = false;
        this.hasParticles = false;
        this.occludes = false;
        this.randomAnimFrame = true;
        this.length = 1;
        this.active = -1;
        this.flag88 = true;
        this.ops = new Array<JagString | null>(5).fill(null);
        this.mirror = false;
        this.soundRadius = 0;
        this.ambientSound = -1;
        this.cursorOp2 = -1;
        this.shareLight = false;
        this.members = false;
        this.wallWidth = 16;
        this.offsetY = 0;
        this.width = 1;
        this.multiVarp = -1;
        this.forceApproach = 0;
        this.mapScene = -1;
        this.multiVarbit = -1;
        this.blockwalk = 2;
        this.maxDelay = 0;
        this.msiRotate = false;
        this.hillParam = -1;
        this.shadow = true;
    }

    // jb.a(Lgd;I)V
    Decode(p: PacketT): void {
        for (;;) {
            const code = p.g1();
            if (code === 0) return;
            this.DecodeType(p, code);
        }
    }

    // jb.a(Lgd;IZ)V
    private DecodeType(p: PacketT, code: number): void {
        switch (code) {
            case 1: {
                const count = p.g1();
                if (count === 0) break;
                if (this.modelIds !== null && !LocType.m_lowMem) {
                    p.m_pos = (p.m_pos + count * 3) | 0;
                    break;
                }
                if (glJar) {
                    this.modelShapes = new Int32Array(count);
                    this.modelIds = new Int32Array(count);
                } else {
                    this.modelIds = new Int32Array(count);
                    this.modelShapes = new Int32Array(count);
                }
                for (let i = 0; i < count; i++) {
                    this.modelIds[i] = p.g2();
                    this.modelShapes[i] = p.g1();
                }
                break;
            }
            case 2:
                this.name = p.gStringNoConversion();
                break;
            case 5: {
                const count = p.g1();
                if (count === 0) break;
                if (this.modelIds !== null && !LocType.m_lowMem) {
                    p.m_pos = (p.m_pos + count * 2) | 0;
                    break;
                }
                if (glJar) {
                    this.modelIds = new Int32Array(count);
                    this.modelShapes = null;
                } else {
                    this.modelShapes = null;
                    this.modelIds = new Int32Array(count);
                }
                for (let i = 0; i < count; i++) this.modelIds[i] = p.g2();
                break;
            }
            case 14:
                this.width = p.g1();
                break;
            case 15:
                this.length = p.g1();
                break;
            case 17:
                this.blockwalk = 0;
                this.blockrange = false;
                break;
            case 18:
                this.blockrange = false;
                break;
            case 19:
                this.active = p.g1();
                break;
            case 21:
                this.hillSkew = 1;
                break;
            case 22:
                this.shareLight = true;
                break;
            case 23:
                this.occludes = true;
                break;
            case 24:
                this.animation = p.g2();
                if (this.animation === 65535) this.animation = -1;
                break;
            case 27:
                this.blockwalk = 1;
                break;
            case 28:
                this.wallWidth = p.g1();
                break;
            case 29:
                this.ambient = p.g1s();
                break;
            case 30:
            case 31:
            case 32:
            case 33:
            case 34: {
                const op = p.gStringNoConversion();
                arrayPutObj(this.ops, code - 30, op);
                if (op.equalsIgnoreCase(LocalisedText.hidden)) arrayPutObj(this.ops, code - 30, null);
                break;
            }
            case 39:
                this.contrast = p.g1s() * 5;
                break;
            case 40: {
                const count = p.g1();
                if (glJar) {
                    this.recolourSource = new Int16Array(count);
                    this.recolourDest = new Int16Array(count);
                } else {
                    this.recolourDest = new Int16Array(count);
                    this.recolourSource = new Int16Array(count);
                }
                for (let i = 0; i < count; i++) {
                    this.recolourSource[i] = p.g2();
                    this.recolourDest[i] = p.g2();
                }
                break;
            }
            case 41: {
                const count = p.g1();
                if (glJar) {
                    this.retextureDest = new Int16Array(count);
                    this.retextureSource = new Int16Array(count);
                } else {
                    this.retextureSource = new Int16Array(count);
                    this.retextureDest = new Int16Array(count);
                }
                for (let i = 0; i < count; i++) {
                    this.retextureSource[i] = p.g2();
                    this.retextureDest[i] = p.g2();
                }
                break;
            }
            case 42:
                this.recolourPalette = new Int8Array(p.g1());
                for (let i = 0; i < this.recolourPalette.length; i++) this.recolourPalette[i] = p.g1s();
                break;
            case 60:
                this.mapFunction = p.g2();
                break;
            case 62:
                this.mirror = true;
                break;
            case 64:
                this.shadow = false;
                break;
            case 65:
                this.resizeX = p.g2();
                break;
            case 66:
                this.resizeY = p.g2();
                break;
            case 67:
                this.resizeZ = p.g2();
                break;
            case 69:
                this.forceApproach = p.g1();
                break;
            case 70:
                this.offsetX = p.g2s();
                break;
            case 71:
                this.offsetY = p.g2s();
                break;
            case 72:
                this.offsetZ = p.g2s();
                break;
            case 73:
                this.forceDecor = true;
                break;
            case 74:
                this.breakRoutefinding = true;
                break;
            case 75:
                this.raiseObject = p.g1();
                break;
            case 77:
            case 92: {
                this.multiVarbit = p.g2();
                if (this.multiVarbit === 65535) this.multiVarbit = -1;
                this.multiVarp = p.g2();
                if (this.multiVarp === 65535) this.multiVarp = -1;
                let fallback = -1;
                if (code === 92) {
                    fallback = p.g2();
                    if (fallback === 65535) fallback = -1;
                }
                const count = p.g1();
                this.multi = new Int32Array(count + 2);
                for (let i = 0; i <= count; i++) {
                    this.multi[i] = p.g2();
                    if (this.multi[i] === 65535) this.multi[i] = -1;
                }
                this.multi[count + 1] = fallback;
                break;
            }
            case 78:
                this.ambientSound = p.g2();
                this.soundRadius = p.g1();
                break;
            case 79:
                this.minDelay = p.g2();
                this.maxDelay = p.g2();
                this.soundRadius = p.g1();
                this.randomSounds = new Int32Array(p.g1());
                for (let i = 0; i < this.randomSounds.length; i++) this.randomSounds[i] = p.g2();
                break;
            case 81:
                this.hillSkew = 2;
                this.hillParam = (p.g1() << 24) >> 16;
                break;
            case 82:
                if (glJar) this.field_844 = true;
                break;
            case 88:
                this.flag88 = false;
                break;
            case 89:
                this.randomAnimFrame = false;
                break;
            case 90:
                this.flag90 = true;
                break;
            case 91:
                this.members = true;
                break;
            case 93:
                this.hillSkew = 3;
                this.hillParam = (p.g2() << 16) >> 16;
                break;
            case 94:
                this.hillSkew = 4;
                break;
            case 95:
                this.hillSkew = 5;
                break;
            case 96:
                this.flag96 = true;
                break;
            case 97:
                this.msiRotate = true;
                break;
            case 98:
                this.hasParticles = true;
                break;
            case 99:
                this.cursorOp1 = p.g1();
                this.cursor1 = p.g2();
                break;
            case 100:
                this.cursorOp2 = p.g1();
                this.cursor2 = p.g2();
                break;
            case 101:
                this.msiAngle = p.g1();
                break;
            case 102:
                this.mapScene = p.g2();
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
        }
    }

    // jb.b(I)V
    PostDecode(): void {
        if (this.active === -1) {
            this.active = 0;
            if (this.modelIds !== null && (this.modelShapes === null || arrayAtI32(this.modelShapes, 0) === 10)) this.active = 1;
            for (let i = 0; i < 5; i++) {
                if (arrayAtObj(this.ops, i) !== null) {
                    this.active = 1;
                    break;
                }
            }
        }
        if (this.raiseObject === -1) this.raiseObject = this.blockwalk === 0 ? 0 : 1;
    }

    // jb.b(B)Z
    CheckModelAll(): boolean {
        if (this.modelIds === null) return true;
        let ready = true;
        for (let i = 0; i < this.modelIds.length; i++) {
            if (!requireNonNull(LocType.m_pModels).RequestDownload(true, this.modelIds[i] & 65535, 0)) ready = false;
        }
        return ready;
    }

    // jb.a(II)Z
    CheckModel(shape: number): boolean {
        if (this.modelShapes === null) {
            if (this.modelIds === null || shape !== 10) return true;
            let ready = true;
            for (let i = 0; i < this.modelIds.length; i++) {
                const archive = LocType.m_pModels;
                const group = arrayAtI32(this.modelIds, i) & 65535;
                if (!requireNonNull(archive).RequestDownload(true, group, 0)) ready = false;
            }
            return ready;
        }
        for (let i = 0; i < this.modelShapes.length; i++) {
            if (this.modelShapes[i] === shape) {
                const archive = LocType.m_pModels;
                const group = arrayAtI32(this.modelIds, i) & 65535;
                return requireNonNull(archive).RequestDownload(true, group, 0);
            }
        }
        return true;
    }

    // jb.a(B)Z
    HasBgSound(): boolean {
        if (this.multi === null) return this.ambientSound !== -1 || this.randomSounds !== null;
        for (const id of this.multi) {
            if (id === -1) continue;
            const type = LocType.List(id);
            if (type.ambientSound !== -1 || type.randomSounds !== null) return true;
        }
        return false;
    }

    // jb.c(B)Ljb;
    GetMultiLoc(): LocType | null {
        let selector = -1;
        if (this.multiVarbit !== -1) selector = ClientVarCache.GetVarbit(this.multiVarbit);
        else if (this.multiVarp !== -1) selector = arrayAtI32(ClientVarCache.m_var, this.multiVarp);
        const multi = requireNonNull(this.multi);
        if (selector >= 0 && selector < multi.length - 1 && multi[selector] !== -1) return LocType.List(multi[selector]);
        const fallback = arrayAtI32(multi, multi.length - 1);
        return fallback === -1 ? null : LocType.List(fallback);
    }

    // jb.a(ZII)I
    GetParam(defaultValue: number, key: number): number {
        if (this.params === null) return defaultValue;
        const node = this.params.get(BigInt(key));
        if (node === null) return defaultValue;
        if (!(node instanceof IntNode)) throw new TypeError('Expected integer location value');
        return node.value;
    }

    // jb.a(BLid;I)Lid;
    GetParam2(defaultValue: JagString | null, key: number): JagString | null {
        if (this.params === null) return defaultValue;
        const node = this.params.get(BigInt(key));
        if (node === null) return defaultValue;
        if (!(node instanceof StringNode)) throw new TypeError('Expected string location value');
        return node.value;
    }

    // Renderer methods (batch 5) and the two statics only they use. Locals keep the decompiler's names (its output for
    // these three bodies follows the bytecode); argument expressions are evaluated before a null receiver is
    // dereferenced, as the JVM does.

    // g.j:Lwj;
    // The one result holder both model getters fill and return (g.<clinit> creates it).
    static modelResult = new LocEntity(); // SD g.j, HD ni.n (replaced by lb.a)
    // ll.j:[Lcb;
    // BuildModel's scratch list of the shape-10 models it merges (ll.<clinit> allocates four slots; a fifth throws).
    static readonly temp: (ModelUnlit | null)[] = new Array<ModelUnlit | null>(4).fill(null);

    // SD jb.a([[IIIIZB[[ILch;IIZ)Lwj;, HD pb.a(II[[III[[IZLek;BZI)Lsm;. NXT LocType::GetModel.
    // Both paths use the same region, orientation and terrain inputs. HD caches the projected shadow in the
    // same entry as the base model and copies the model for each placement. SD keeps the unlit source on
    // the share-light branch so the scene can merge its normals. The obfuscator byte guards are stripped.
    GetModel(
        upperGround: (Int32Array | null)[] | null,
        shape: number,
        angle: number,
        baseY: number,
        shareLight: boolean,
        ground: (Int32Array | null)[] | null,
        previousShadow: Pix8 | null,
        worldZ: number,
        worldX: number,
        makeShadow: boolean
    ): LocEntity {
        if (glJar && loadGlRenderer().active) {
            // HD pb.a(II[[III[[IZLek;BZI)Lsm;, hardware arm.
            const GlModel = loadGlModel();
            const key = this.modelShapes !== null ? BigInt((angle + (this.id << 10) + (shape << 3)) | 0) : BigInt(((this.id << 10) + angle) | 0);
            const cached = LocType.m_mc2.Find(key);
            if (cached !== null && !(cached instanceof LocEntity)) throw new TypeError('ClassCastException: not a LocEntity');
            let base: GlModel | null;
            let shadow: Pix8 | null;
            if (cached === null) {
                base = this.BuildGlModel(angle, false, true, shape);
                if (base === null) {
                    LocType.modelResult.model = null;
                    LocType.modelResult.shadow = null;
                    return LocType.modelResult;
                }
                if (shape === 10 && angle > 3) base.RotateYAxis(256);
                shadow = makeShadow ? base.createShadow(previousShadow) : null;
                const entry = new LocEntity();
                entry.model = base;
                entry.shadow = shadow;
                LocType.m_mc2.Put(key, entry);
            } else {
                if (cached.model !== null && !(cached.model instanceof GlModel)) throw new TypeError('ClassCastException: not a GlModel');
                base = cached.model;
                shadow = cached.shadow;
            }

            const share = this.shareLight && shareLight;
            const result = requireNonNull(base).copyForLoc(this.hillSkew !== 3, this.hillSkew === 0, true, true, true, true, !share, true, true, true, true);
            if (this.hillSkew !== 0) result.hillSkew(this.hillSkew, this.hillParam, requireNonNull(base), ground, upperGround, worldX, baseY, worldZ);
            result.prepareBuffers(this.active === 0 && !this.hasParticles, true, true, true, this.active === 0, true, false);
            LocType.modelResult.model = result;
            result.shareLight = share;
            LocType.modelResult.shadow = shadow;
            return LocType.modelResult;
        }
        let var12: bigint;
        if (this.modelShapes !== null) {
            var12 = BigInt((angle + (shape << 3) + (this.id << 10)) | 0);
        } else {
            var12 = BigInt((angle + (this.id << 10)) | 0);
        }

        let var14: boolean;
        if (shareLight && this.shareLight) {
            var12 = BigInt.asIntN(64, var12 | -9223372036854775808n);
            var14 = true;
        } else {
            var14 = false;
        }

        const cached = LocType.m_mc2.Find(var12);
        if (cached !== null && !(cached instanceof ModelSource)) throw new TypeError('ClassCastException: not a ModelSource');
        let var15: ModelSource | null = cached;
        if (var15 === null) {
            const var16 = this.BuildModel(shape, angle);
            if (var16 === null) {
                LocType.modelResult.model = null;
                return LocType.modelResult;
            }

            var16.DiscardAnimLabels();
            if (shape === 10 && angle > 3) {
                var16.RotateYAxis(256);
            }

            if (var14) {
                var15 = var16;
                var16.ambient = ((64 + this.ambient) << 16) >> 16;
                var16.contrast = ((Math.imul(this.contrast, 5) + 768) << 16) >> 16;
                var16.CalculateNormals();
            } else {
                var15 = new ModelLitImpl(var16, (this.ambient + 64) | 0, (768 + Math.imul(5, this.contrast)) | 0, -50, -10, -50);
            }

            LocType.m_mc2.Put(var12, var15);
        }

        if (var14) {
            if (!(var15 instanceof ModelUnlit)) throw new TypeError(var15 === null ? 'Null reference' : 'ClassCastException: not a ModelUnlit');
            var15 = var15.CopyForShareLight();
        }

        if (this.hillSkew !== 0) {
            if (var15 instanceof ModelLitImpl) {
                var15 = var15.HillSkewCopy(this.hillSkew, this.hillParam, ground, upperGround, worldX, baseY, worldZ, true);
            } else if (var15 instanceof ModelUnlit) {
                var15 = var15.HillSkewCopy(this.hillSkew, this.hillParam, ground, upperGround, worldX, baseY, worldZ, true, false);
            }
        }

        LocType.modelResult.model = var15;
        return LocType.modelResult;
    }

    // HD pb.a(IZZI)Ltd;. The animated and static model groups have distinct keys in nf.f.
    private BuildGlModel(angle: number, animated: boolean, shareNormals: boolean, shape: number): GlModel | null {
        const GlModel = loadGlModel();
        const ambient = (this.ambient + 64) | 0;
        const contrast = (Math.imul(5, this.contrast) + 768) | 0;
        let base: GlModel | null;
        if (this.modelShapes !== null) {
            let index = -1;
            for (let i = 0; i < this.modelShapes.length; i++) {
                if (this.modelShapes[i] === shape) {
                    index = i;
                    break;
                }
            }
            if (index === -1) return null;
            let id = arrayAtI32(this.modelIds, index);
            if (animated) id = (id + 65536) | 0;
            const cached = LocType.m_mc1.Find(BigInt(id));
            if (cached !== null && !(cached instanceof GlModel)) throw new TypeError('ClassCastException: not a GlModel');
            base = cached;
            if (base === null) {
                const source = ModelUnlit.Load(LocType.m_pModels, id & 65535, 0);
                if (source === null) return null;
                base = new GlModel(source, ambient, contrast, animated);
                LocType.m_mc1.Put(BigInt(id), base);
            }
        } else {
            if (shape !== 10) return null;
            if (this.modelIds === null) return null;
            const count = this.modelIds.length;
            if (count === 0) return null;
            let key = 0n;
            for (let i = 0; i < count; i++) key = BigInt.asIntN(64, BigInt(arrayAtI32(this.modelIds, i)) + key * 67783n);
            if (animated) key = ~key;
            const cached = LocType.m_mc1.Find(key);
            if (cached !== null && !(cached instanceof GlModel)) throw new TypeError('ClassCastException: not a GlModel');
            base = cached;
            if (base === null) {
                let source: ModelUnlit | null = null;
                for (let i = 0; i < count; i++) {
                    source = ModelUnlit.Load(LocType.m_pModels, arrayAtI32(this.modelIds, i) & 65535, 0);
                    if (source === null) return null;
                    if (count > 1) arrayPutObj(LocType.temp, i, source);
                }
                if (count > 1) source = new ModelUnlit(LocType.temp, count);
                base = new GlModel(requireNonNull(source), ambient, contrast, animated);
                LocType.m_mc1.Put(key, base);
            }
        }
        let mirror = this.mirror;
        if (shape === 2 && angle > 3) mirror = !mirror;
        const shareY = this.resizeY === 128 && this.offsetY === 0;
        const shareXZ = angle === 0 && this.resizeX === 128 && this.resizeZ === 128 && this.offsetX === 0 && this.offsetZ === 0 && !mirror;
        const model = base.copyForLoc(shareXZ, shareY, this.recolourSource === null, true, base.getAmbient() === ambient, angle === 0 && !mirror, shareNormals, contrast === base.getContrast(), true, !mirror, this.retextureSource === null);
        if (mirror) model.Mirror();
        if (shape === 4 && angle > 3) {
            model.rotateYAxisWithNormals(256);
            model.Translate(45, 0, -45);
        }
        angle &= 3;
        if (angle === 1) model.rotate90WithNormals();
        else if (angle === 2) model.rotate180WithNormals();
        else if (angle === 3) model.rotate270WithNormals();
        if (this.recolourSource !== null) {
            for (let i = 0; i < this.recolourSource.length; i++) model.Recolour(arrayAtI16(this.recolourSource, i), arrayAtI16(this.recolourDest, i));
        }
        if (this.retextureSource !== null) {
            for (let i = 0; i < this.retextureSource.length; i++) model.Retexture(arrayAtI16(this.retextureSource, i), arrayAtI16(this.retextureDest, i));
        }
        if (this.resizeX !== 128 || this.resizeY !== 128 || this.resizeZ !== 128) model.Resize(this.resizeX, this.resizeY, this.resizeZ);
        if (this.offsetX !== 0 || this.offsetY !== 0 || this.offsetZ !== 0) model.Translate(this.offsetX, this.offsetY, this.offsetZ);
        if (ambient !== model.getAmbient()) model.setAmbient(ambient);
        if (model.getContrast() !== contrast) model.setContrast(contrast);
        return model;
    }

    // jb.a(III)Lcb; (NXT LocType::BuildModel, LocType.cpp:731)
    // The unlit model for shape var1 at angle var3: the model listed for that shape (or, with no shape list, the shape-10
    // models merged), each loaded once into m_mc1 (lj.c) keyed by id + 65536 when mirrored (mirror, toggled for a shape-2
    // wall corner at angle > 3), then copied (sharing the vertices only for an unscaled, unoffset angle-0 model), rotated,
    // recoloured, retextured, resized and offset. Null when the shape has no model or a model file is missing. The middle
    // Java int is a stripped dummy: both callers (GetModel and GetTempModel, at javap offsets 118 and 90) pass -30, so
    // the guard `if (var2 != -30) return null` never runs.
    private BuildModel(var1: number, var3: number): ModelUnlit | null {
        let var5 = this.mirror;
        if (var1 === 2 && var3 > 3) {
            var5 = !var5;
        }

        let var4: ModelUnlit | null = null;
        if (this.modelShapes !== null) {
            let var6 = -1;
            for (let var7 = 0; var7 < this.modelShapes.length; var7++) {
                if (var1 === this.modelShapes[var7]) {
                    var6 = var7;
                    break;
                }
            }

            if (var6 === -1) {
                return null;
            }

            let var8 = arrayAtI32(this.modelIds, var6);
            if (var5) {
                var8 = (var8 + 65536) | 0;
            }

            const cached = LocType.m_mc1.Find(BigInt(var8));
            if (cached !== null && !(cached instanceof ModelUnlit)) throw new TypeError('ClassCastException: not a ModelUnlit');
            var4 = cached;
            if (var4 === null) {
                var4 = ModelUnlit.Load(LocType.m_pModels, var8 & 65535, 0);
                if (var4 === null) {
                    return null;
                }

                if (var5) {
                    var4.Mirror();
                }

                LocType.m_mc1.Put(BigInt(var8), var4);
            }
        } else {
            if (var1 !== 10) {
                return null;
            }

            if (this.modelIds === null) {
                return null;
            }

            const var12 = this.modelIds.length;

            for (let var14 = 0; var12 > var14; var14++) {
                let var16 = arrayAtI32(this.modelIds, var14);
                if (var5) {
                    var16 = (var16 + 65536) | 0;
                }

                const cached = LocType.m_mc1.Find(BigInt(var16));
                if (cached !== null && !(cached instanceof ModelUnlit)) throw new TypeError('ClassCastException: not a ModelUnlit');
                var4 = cached;
                if (var4 === null) {
                    var4 = ModelUnlit.Load(LocType.m_pModels, var16 & 65535, 0);
                    if (var4 === null) {
                        return null;
                    }

                    if (var5) {
                        var4.Mirror();
                    }

                    LocType.m_mc1.Put(BigInt(var16), var4);
                }

                if (var12 > 1) {
                    arrayPutObj(LocType.temp, var14, var4);
                }
            }

            if (var12 > 1) {
                var4 = new ModelUnlit(LocType.temp, var12);
            }
        }

        const var13 = this.resizeX !== 128 || this.resizeY !== 128 || this.resizeZ !== 128;
        const var15 = this.offsetX !== 0 || this.offsetY !== 0 || this.offsetZ !== 0;
        const var17 = new ModelUnlit(var4, var3 === 0 && !var13 && !var15, this.recolourSource === null, this.retextureSource === null, true);
        if (var1 === 4 && var3 > 3) {
            var17.RotateYAxis(256);
            var17.Translate(45, 0, -45);
        }

        var3 &= 3;
        if (var3 === 1) {
            var17.Rotate90();
        } else if (var3 === 2) {
            var17.Rotate180();
        } else if (var3 === 3) {
            var17.Rotate270();
        }

        if (this.recolourSource !== null) {
            for (let var9 = 0; this.recolourSource.length > var9; var9++) {
                if (this.recolourPalette === null || this.recolourPalette.length <= var9) {
                    var17.Recolour(arrayAtI16(this.recolourSource, var9), arrayAtI16(this.recolourDest, var9));
                } else {
                    var17.Recolour(arrayAtI16(this.recolourSource, var9), arrayAtI16(LocType.recolPalette, 255 & arrayAtI8(this.recolourPalette, var9)));
                }
            }
        }

        if (this.retextureSource !== null) {
            for (let var18 = 0; var18 < this.retextureSource.length; var18++) {
                var17.Retexture(arrayAtI16(this.retextureSource, var18), arrayAtI16(this.retextureDest, var18));
            }
        }

        if (var13) {
            var17.Resize(this.resizeX, this.resizeY, this.resizeZ);
        }

        if (var15) {
            var17.Translate(this.offsetX, this.offsetY, this.offsetZ);
        }

        return var17;
    }

    // SD jb.a(IIIIII[[IIZIBLch;[[ILek;)Lwj;, HD pb.a(IILek;ILtk;I[[IZII[[IIII)Lsm;. NXT LocType::GetTempModel.
    // The animated cache stores the base before sequence animation, rotation and ground fitting. The HD
    // path projects the shadow after animation and before fitting the model to the terrain.
    GetTempModel(
        baseY: number,
        shape: number,
        nextFrame: number,
        cycle: number,
        worldZ: number,
        worldX: number,
        ground: (Int32Array | null)[] | null,
        angle: number,
        makeShadow: boolean,
        frame: number,
        previousShadow: Pix8 | null,
        upperGround: (Int32Array | null)[] | null,
        sequence: SeqType | null
    ): LocEntity | null {
        if (glJar && loadGlRenderer().active) {
            // HD pb.a(IILek;ILtk;I[[IZII[[IIII)Lsm;, hardware arm.
            const GlModel = loadGlModel();
            const key = this.modelShapes !== null ? BigInt(((shape << 3) + (this.id << 10) + angle) | 0) : BigInt((angle + (this.id << 10)) | 0);
            const cached = LocType.m_mc3.Find(key);
            if (cached !== null && !(cached instanceof GlModel)) throw new TypeError('ClassCastException: not a GlModel');
            let base = cached;
            if (base === null) {
                base = this.BuildGlModel(angle, true, true, shape);
                if (base === null) return null;
                base.buildAnimationTables();
                base.prepareBuffers(false, false, false, true, false, false, true);
                LocType.m_mc3.Put(key, base);
            }
            let copied = false;
            let model: GlModel | null = base;
            if (sequence !== null) {
                const animated = sequence.animateGlLoc(nextFrame, frame, cycle, angle, model);
                if (animated !== null && !(animated instanceof GlModel)) throw new TypeError('ClassCastException: not a GlModel');
                model = animated;
                copied = true;
            }
            if (shape === 10 && angle > 3) {
                if (!copied) {
                    const copy = requireNonNull(model).CopyForAnimLoc(true, true, true);
                    if (copy !== null && !(copy instanceof GlModel)) throw new TypeError('ClassCastException: not a GlModel');
                    model = copy;
                    copied = true;
                }
                requireNonNull(model).RotateYAxis(256);
            }
            LocType.modelResult.shadow = makeShadow ? requireNonNull(model).createShadow(previousShadow) : null;
            if (this.hillSkew !== 0) {
                if (!copied) {
                    copied = true;
                    const copy = requireNonNull(model).CopyForAnimLoc(true, true, true);
                    if (copy !== null && !(copy instanceof GlModel)) throw new TypeError('ClassCastException: not a GlModel');
                    model = copy;
                }
                requireNonNull(model).hillSkew(this.hillSkew, this.hillParam, base, ground, upperGround, worldX, baseY, worldZ);
            }
            LocType.modelResult.model = model;
            return LocType.modelResult;
        }
        let var15: bigint;
        if (this.modelShapes === null) {
            var15 = BigInt(((this.id << 10) + angle) | 0);
        } else {
            var15 = BigInt((angle + (this.id << 10) + (shape << 3)) | 0);
        }

        const cached = LocType.m_mc3.Find(var15);
        if (cached !== null && !(cached instanceof ModelLitImpl)) throw new TypeError('ClassCastException: not a ModelLitImpl');
        let var18: ModelLitImpl | null = cached;
        if (var18 === null) {
            const var19 = this.BuildModel(shape, angle);
            if (var19 === null) {
                return null;
            }

            var18 = new ModelLitImpl(var19, (this.ambient + 64) | 0, (Math.imul(5, this.contrast) + 768) | 0, -50, -10, -50);
            LocType.m_mc3.Put(var15, var18);
        }

        let var21 = false;
        if (sequence !== null) {
            // checkcast fc lets a null through; it would only fail at the next dereference.
            const animated: ModelLit | null = sequence.AnimateModel90(frame, angle, var18, cycle, nextFrame);
            if (animated !== null && !(animated instanceof ModelLitImpl)) throw new TypeError('ClassCastException: not a ModelLitImpl');
            var18 = animated;
            var21 = true;
        }

        if (shape === 10 && angle > 3) {
            if (!var21) {
                const copy = requireNonNull(var18).CopyForAnimLoc(true, true, true);
                if (!(copy instanceof ModelLitImpl)) throw new TypeError('ClassCastException: not a ModelLitImpl');
                var18 = copy;
                var21 = true;
            }

            requireNonNull(var18).RotateYAxis(256);
        }

        if (this.hillSkew !== 0) {
            if (!var21) {
                var21 = true;
                const copy = requireNonNull(var18).CopyForAnimLoc(true, true, true);
                if (!(copy instanceof ModelLitImpl)) throw new TypeError('ClassCastException: not a ModelLitImpl');
                var18 = copy;
            }

            var18 = requireNonNull(var18).HillSkewCopy(this.hillSkew, this.hillParam, ground, upperGround, worldX, baseY, worldZ, false);
        }

        LocType.modelResult.model = var18;
        return LocType.modelResult;
    }
}
