import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import LRUHashCache from '#/datastruct/LRUHashCache';
import type Js5 from '#/cache/Js5';
import PacketT from '#/io/PacketT';
import JagString, { fromLiteral } from '#/datastruct/JagString';
import HashTable from '#/datastruct/HashTable';
import IntNode from '#/datastruct/IntNode';
import StringNode from '#/datastruct/StringNode';
import { bitCeil } from '#/util/IntUtils';
import { arrayAtI16, arrayAtI32, arrayAtI8, arrayAtObj, arrayPutI32, arrayPutObj, requireNonNull } from '#/util/JavaArray';
import LocalisedText from '#/ui/LocalisedText';
import ClientVarCache from '#/util/ClientVarCache';
import type ActorSlotAnim from '#/dash3d/ActorSlotAnim';
import AnimFrameSet from '#/dash3d/AnimFrameSet';
import ModelLit from '#/dash3d/ModelLit';
import ModelUnlit from '#/dash3d/ModelUnlit';
import { glJar } from '#/client/ClientVariant';
import Pix3D from '#/dash3d/Pix3D';
import type BASType from './BASType';
import BASTypeList from './BASTypeList';
import SeqType from './SeqType';
import { loadDelayedStateChange, loadGlModel, loadGlRenderer, loadMinimenu } from '#/util/GamepackClasses';

export default class NpcType {
    // HD me.c(B)V
    static releaseHdStatics(guard: number): void {
        try {
            const DelayedStateChange = loadDelayedStateChange();
            releaseReferences(DelayedStateChange, 'varcs');
            if (guard !== 103) {
                const Minimenu = loadMinimenu();
                Minimenu.mouseX = -20;
            }
            releaseReferences(LocalisedText, 'frenchIgnoresFull', 'frenchChatcol4');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'me.K(' + guard + ')');
        }
    }

    // mf.k:Lal;
    static m_pConfigClient: Js5 | null = null;
    // nl.Y:Lal;
    static m_pModels: Js5 | null = null;
    // gf.Z:Lve;
    static readonly m_recentUse = new LRUHashCache<NpcType>(64);
    static readonly m_modelCache = new LRUHashCache<object>(50); // uk.k:Lve;
    static readonly headModelCache = new LRUHashCache<object>(5); // pb.xc:Lve;

    // fa.a(Z)V
    static ResetCache(): void {
        NpcType.m_recentUse.Reset();
        NpcType.m_modelCache.Reset();
        NpcType.headModelCache.Reset();
    }

    // ti.e(I)V
    static removeSoft(): void {
        NpcType.m_recentUse.removeSoft();
        NpcType.m_modelCache.removeSoft();
        NpcType.headModelCache.removeSoft();
    }

    // ui.a(IZ)V
    static clean(age: number): void {
        NpcType.m_recentUse.Clean(age);
        NpcType.m_modelCache.Clean(age);
        NpcType.headModelCache.Clean(age);
    }

    // SD il.a(Z)V, HD wj.b(I)V.
    static clearModelCache(): void {
        try {
            NpcType.m_modelCache.Reset();
        } catch (error) {
            if (!glJar || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'wj.B(0)');
        }
    }

    // SD b.d(I)V, HD ba.e(I)V.
    static clearHeadModelCache(): void {
        try {
            this.headModelCache.Reset();
        } catch (error) {
            if (!glJar || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'ba.C(88)');
        }
    }

    // qj.a(ILal;Lal;)V
    static Init(archive: Js5 | null, models: Js5 | null): void {
        NpcType.m_pModels = models;
        NpcType.m_pConfigClient = archive;
    }

    // uk.a(II)Lja;
    static List(id: number): NpcType {
        let type = NpcType.m_recentUse.Find(BigInt(id));
        if (type !== null) return type;
        const bytes = requireNonNull(NpcType.m_pConfigClient).GetFile(NpcType.file(id), NpcType.group(id));
        type = new NpcType();
        type.id = id;
        if (bytes) type.Decode(new PacketT(bytes));
        type.PostDecode();
        NpcType.m_recentUse.Put(BigInt(id), type);
        return type;
    }
    // pa.e(II)I
    private static group(id: number): number {
        return id >>> 7;
    }
    // f.a(II)I
    private static file(id: number): number {
        return id & 127;
    }

    static defaultName: JagString | null = fromLiteral('null'); // qg.A:Lid;
    static clientPalette = new Int16Array(256); // la.Z:[S
    // ja.a:I
    m_backgroundSoundReady: number;
    // ja.b:I
    headIcon: number;
    // ja.c:[S
    recolourDest: Int16Array | null = null;
    // ja.f:I
    resizeH: number;
    // ja.i:I
    cursor2: number;
    // ja.l:S
    shadowColour1: number;
    // ja.n:B
    shadowModifier1: number;
    // ja.o:I
    contrast: number;
    // ja.q:I
    m_baseAnimationSet: number;
    // ja.r:Lid;
    name: JagString | null;
    // ja.s:I
    m_turnSpeed: number;
    // ja.t:B
    shadowModifier2: number;
    // ja.u:I
    mapIcon: number;
    // ja.w:[S
    recolourSource: Int16Array | null = null;
    // ja.x:Z
    m_walkSmoothing: boolean;
    // ja.y:I
    m_visibleCombatLevel: number;
    // ja.z:I
    resizeV: number;
    // ja.B:I
    m_backgroundSoundRange: number;
    // ja.C:[[I
    modelOffsets: (Int32Array | null)[] | null = null;
    // ja.D:[I
    headModels: Int32Array | null = null;
    // ja.E:I
    multiVarbit: number;
    // ja.F:[Lid;
    ops: (JagString | null)[] | null;
    // ja.G:I
    id = 0;
    // ja.H:I
    multiVarp: number;
    // ja.J:[I
    multi: Int32Array | null = null;
    // ja.K:B
    movementFlags: number;
    // ja.L:[S
    retextureDest: Int16Array | null = null;
    // ja.M:I
    m_gridSize: number;
    // ja.O:I
    m_overlayHeight: number;
    // ja.P:I
    cursorOp1: number;
    // ja.Q:Lnc;
    params: HashTable<IntNode | StringNode> | null = null;
    // ja.R:S
    shadowColour2: number;
    // ja.T:I
    m_backgroundSoundWalk: number;
    // ja.U:B
    spawnDirection: number;
    // ja.V:I
    cursor1: number;
    // ja.X:I
    cursorOp2: number;
    // ja.Y:I
    ambient: number;
    // ja.ab:[B
    recolourPalette: Int8Array | null = null;
    // ja.bb:[S
    retextureSource: Int16Array | null = null;
    // ja.cb:I
    cursorAttack: number;
    // ja.fb:I
    hitmarkId: number;
    // ja.gb:Z
    drawMapDot: boolean;
    // ja.hb:Z
    interactive: boolean;
    // ja.ib:[[I
    slotMatrices: (Int32Array | null)[] | null = null;
    // ja.jb:Z
    spotShadow: boolean;
    // ja.kb:Z
    m_alwaysOnTop: boolean;
    // ja.lb:I
    m_backgroundSoundRun: number;
    // ja.mb:I
    m_backgroundSoundCrawl: number;
    // ja.nb:[I
    m_bodyList: Int32Array | null = null;

    // ja.<init>()V
    constructor() {
        this.resizeH = 128;
        this.shadowModifier1 = -96;
        this.cursor2 = -1;
        this.m_visibleCombatLevel = -1;
        this.m_turnSpeed = 32;
        this.shadowColour1 = 0;
        this.m_backgroundSoundReady = -1;
        this.m_walkSmoothing = true;
        this.mapIcon = -1;
        this.m_baseAnimationSet = -1;
        this.m_backgroundSoundRange = 0;
        this.resizeV = 128;
        this.shadowModifier2 = -16;
        this.name = NpcType.defaultName;
        this.m_overlayHeight = -1;
        this.contrast = 0;
        this.multiVarp = -1;
        this.ops = new Array<JagString | null>(5).fill(null);
        this.headIcon = -1;
        this.m_backgroundSoundWalk = -1;
        this.cursorOp1 = -1;
        this.movementFlags = 0;
        this.shadowColour2 = 0;
        this.interactive = true;
        this.drawMapDot = true;
        this.m_gridSize = 1;
        this.cursor1 = -1;
        this.multiVarbit = -1;
        this.spotShadow = true;
        this.cursorAttack = -1;
        this.m_backgroundSoundRun = -1;
        this.m_backgroundSoundCrawl = -1;
        this.spawnDirection = 7;
        this.m_alwaysOnTop = false;
        this.hitmarkId = -1;
        this.ambient = 0;
        this.cursorOp2 = -1;
    }

    // ja.a(Lgd;B)V
    Decode(p: PacketT): void {
        for (;;) {
            const code = p.g1();
            if (code === 0) return;
            this.DecodeType(code, p);
        }
    }

    // ja.a(ILgd;B)V
    private DecodeType(code: number, p: PacketT): void {
        switch (code) {
            case 1: {
                const count = p.g1();
                this.m_bodyList = new Int32Array(count);
                for (let i = 0; i < count; i++) {
                    this.m_bodyList[i] = p.g2();
                    if (this.m_bodyList[i] === 65535) this.m_bodyList[i] = -1;
                }
                break;
            }
            case 2:
                this.name = p.gStringNoConversion();
                break;
            case 12:
                this.m_gridSize = p.g1();
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
            case 40: {
                const count = p.g1();
                this.recolourSource = new Int16Array(count);
                this.recolourDest = new Int16Array(count);
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
            case 42:
                this.recolourPalette = new Int8Array(p.g1());
                for (let i = 0; i < this.recolourPalette.length; i++) this.recolourPalette[i] = p.g1s();
                break;
            case 60:
                this.headModels = new Int32Array(p.g1());
                for (let i = 0; i < this.headModels.length; i++) this.headModels[i] = p.g2();
                break;
            case 93:
                this.drawMapDot = false;
                break;
            case 95:
                this.m_visibleCombatLevel = p.g2();
                break;
            case 97:
                this.resizeH = p.g2();
                break;
            case 98:
                this.resizeV = p.g2();
                break;
            case 99:
                this.m_alwaysOnTop = true;
                break;
            case 100:
                this.ambient = p.g1s();
                break;
            case 101:
                this.contrast = p.g1s() * 5;
                break;
            case 102:
                this.headIcon = p.g2();
                break;
            case 103:
                this.m_turnSpeed = p.g2();
                break;
            case 106:
            case 118: {
                this.multiVarbit = p.g2();
                if (this.multiVarbit === 65535) this.multiVarbit = -1;
                this.multiVarp = p.g2();
                if (this.multiVarp === 65535) this.multiVarp = -1;
                let fallback = -1;
                if (code === 118) {
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
            case 107:
                this.interactive = false;
                break;
            case 109:
                this.m_walkSmoothing = false;
                break;
            case 111:
                this.spotShadow = false;
                break;
            case 113:
                this.shadowColour1 = p.g2s();
                this.shadowColour2 = p.g2s();
                break;
            case 114:
                this.shadowModifier1 = p.g1s();
                this.shadowModifier2 = p.g1s();
                break;
            case 115:
                p.g1();
                p.g1();
                break;
            case 119:
                this.movementFlags = p.g1s();
                break;
            case 121: {
                this.modelOffsets = new Array<Int32Array | null>(requireNonNull(this.m_bodyList).length).fill(null);
                const count = p.g1();
                for (let i = 0; i < count; i++) {
                    const slot = p.g1();
                    const offset = new Int32Array(3);
                    arrayPutObj(this.modelOffsets, slot, offset);
                    offset[0] = p.g1s();
                    offset[1] = p.g1s();
                    offset[2] = p.g1s();
                }
                break;
            }
            case 122:
                this.hitmarkId = p.g2();
                break;
            case 123:
                this.m_overlayHeight = p.g2();
                break;
            case 125:
                this.spawnDirection = p.g1s();
                break;
            case 126:
                this.mapIcon = p.g2();
                break;
            case 127:
                this.m_baseAnimationSet = p.g2();
                break;
            case 128:
                p.g1();
                break;
            case 134:
                this.m_backgroundSoundReady = p.g2();
                if (this.m_backgroundSoundReady === 65535) this.m_backgroundSoundReady = -1;
                this.m_backgroundSoundCrawl = p.g2();
                if (this.m_backgroundSoundCrawl === 65535) this.m_backgroundSoundCrawl = -1;
                this.m_backgroundSoundWalk = p.g2();
                if (this.m_backgroundSoundWalk === 65535) this.m_backgroundSoundWalk = -1;
                this.m_backgroundSoundRun = p.g2();
                if (this.m_backgroundSoundRun === 65535) this.m_backgroundSoundRun = -1;
                this.m_backgroundSoundRange = p.g1();
                break;
            case 135:
                this.cursorOp1 = p.g1();
                this.cursor1 = p.g2();
                break;
            case 136:
                this.cursorOp2 = p.g1();
                this.cursor2 = p.g2();
                break;
            case 137:
                this.cursorAttack = p.g2();
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

    // ja.b(B)V
    PostDecode(): void {}

    // ja.a(III)I
    GetParam(key: number, defaultValue: number): number {
        if (this.params === null) return defaultValue;
        const node = this.params.get(BigInt(key));
        if (node === null) return defaultValue;
        if (!(node instanceof IntNode)) throw new TypeError('Expected integer npc value');
        return node.value;
    }

    // ja.a(Lid;II)Lid;
    GetParam2(defaultValue: JagString | null, key: number): JagString | null {
        if (this.params === null) return defaultValue;
        const node = this.params.get(BigInt(key));
        if (node === null) return defaultValue;
        if (!(node instanceof StringNode)) throw new TypeError('Expected string npc value');
        return node.value;
    }

    // ja.b(I)Lja;
    GetMultiNpc(): NpcType | null {
        let selector = -1;
        if (this.multiVarbit !== -1) selector = ClientVarCache.GetVarbit(this.multiVarbit);
        else if (this.multiVarp !== -1) selector = arrayAtI32(ClientVarCache.m_var, this.multiVarp);
        const multi = requireNonNull(this.multi);
        if (selector >= 0 && selector < multi.length - 1 && multi[selector] !== -1) return NpcType.List(multi[selector]);
        const fallback = arrayAtI32(multi, multi.length - 1);
        return fallback === -1 ? null : NpcType.List(fallback);
    }

    // ja.a(I)Z
    IsMultiNpcVisible(): boolean {
        if (this.multi === null) return true;
        let selector = -1;
        if (this.multiVarbit !== -1) selector = ClientVarCache.GetVarbit(this.multiVarbit);
        else if (this.multiVarp !== -1) selector = arrayAtI32(ClientVarCache.m_var, this.multiVarp);
        if (selector >= 0 && selector < this.multi.length - 1 && this.multi[selector] !== -1) return true;
        return arrayAtI32(this.multi, this.multi.length - 1) !== -1;
    }

    // ja.a(B)Z
    HasBackgroundMovementSound(): boolean {
        if (this.multi === null) return this.m_backgroundSoundReady !== -1 || this.m_backgroundSoundWalk !== -1 || this.m_backgroundSoundRun !== -1;
        for (const id of this.multi) {
            if (id === -1) continue;
            const type = NpcType.List(id);
            if (type.m_backgroundSoundReady !== -1 || type.m_backgroundSoundWalk !== -1 || type.m_backgroundSoundRun !== -1) return true;
        }
        return false;
    }

    // Renderer methods (batch 5) and the per-slot scratch arrays only GetTempModel uses. Each array is a 14-entry
    // static allocated by its owner's <clinit>; GetTempModel fills the entries of the actor's slot animations, applies
    // them and nulls the frameset and seq entries again before it returns.

    // sb.b:[Lek;
    static readonly slotSeqs: (SeqType | null)[] = new Array<SeqType | null>(14).fill(null);
    // qh.f:[Lhf;
    static readonly layerFramesets: (AnimFrameSet | null)[] = new Array<AnimFrameSet | null>(14).fill(null);
    // jl.j:[I
    static readonly layerFrameIds = new Int32Array(14);
    // pj.A:[Lhf;
    static readonly slotNextFramesets: (AnimFrameSet | null)[] = new Array<AnimFrameSet | null>(14).fill(null);
    // ge.R:[I
    static readonly layerNextFrames = new Int32Array(14);
    // pg.P:[I
    static readonly slotFrameCycles = new Int32Array(14);
    // tb.y:[I
    static readonly slotFrameDelays = new Int32Array(14);

    // ja.a([Lci;ILek;IIIBIILek;)Lnd; (NXT NpcType::GetTempModel, NpcType.cpp:424)
    // The animated body model. The lit base (m_bodyList merged after each model's modelOffsets translation and BAS
    // transforms[slot] rotation/translation, recoloured, retextured, lit with ambient + 64 and contrast + 850) is cached
    // in m_modelCache by id, and the first build also derives each BAS slot's 15-int transform matrix into
    // slotMatrices. Then a CopyForAnimActor copy receives: every active slot animation of var1 (ActorSlotAnim per slot,
    // masked to its slot bit with that slot's matrix), the primary sequence var3 (frame var2, next frame var5, cycle
    // var6) and the secondary var10 (frame var9, next frame var8, cycle var4), walk-merged by var3's mask when both
    // load; and the resizeH/resizeV scale. A multinpc delegates to its current variant. Null when a body model file is
    // not ready (or the variant is hidden). The Java byte argument after var6 is a stripped dummy: every caller passes
    // a literal at most -85 (bk.a(IIIIIIIIJILue;)V: -105, aj.a(Lcl;IIZIZLek;)Lnd;: -101, cl.a(IILek;IZ[Lci;IIZLek;I)Lnd;:
    // -90, the multinpc recursion here: -86), so the guard `if (var7 > -85) ja.Z = 112` never writes Client's ja.Z.
    //
    // Locals are named after their bytecode slots: the decompiler duplicated this body (irreducible flow), and the
    // bytecode reuses slots 12..15 and 18..30 for different values in the base-model and animation stages, which are
    // separate block scopes here.
    GetTempModel(var1: (ActorSlotAnim | null)[] | null, var2: number, var3: SeqType | null, var4: number, var5: number, var6: number, var8: number, var9: number, var10: SeqType | null): ModelLit | null {
        if (this.multi !== null) {
            const var11 = this.GetMultiNpc();
            return var11 === null ? null : var11.GetTempModel(var1, var2, var3, var4, var5, var6, var8, var9, var10);
        }

        const cached = NpcType.m_modelCache.Find(BigInt(this.id));
        if (cached !== null && !(cached instanceof ModelLit)) throw new TypeError('ClassCastException: not a ModelLit');
        let var11: ModelLit | null = cached;
        if (var11 === null) {
            let var12 = false;
            for (let var13 = 0; var13 < requireNonNull(this.m_bodyList).length; var13++) {
                if (arrayAtI32(this.m_bodyList, var13) !== -1 && !requireNonNull(NpcType.m_pModels).RequestDownload(true, arrayAtI32(this.m_bodyList, var13), 0)) {
                    var12 = true;
                }
            }

            if (var12) {
                return null;
            }

            const var15 = new Array<ModelUnlit | null>(requireNonNull(this.m_bodyList).length).fill(null);
            for (let var16 = 0; requireNonNull(this.m_bodyList).length > var16; var16++) {
                if (arrayAtI32(this.m_bodyList, var16) !== -1) {
                    arrayPutObj(var15, var16, ModelUnlit.Load(NpcType.m_pModels, arrayAtI32(this.m_bodyList, var16), 0));
                    const loaded = var15[var16];
                    if (this.modelOffsets !== null && arrayAtObj(this.modelOffsets, var16) !== null && loaded !== null) {
                        loaded.Translate(arrayAtI32(arrayAtObj(this.modelOffsets, var16), 0), arrayAtI32(arrayAtObj(this.modelOffsets, var16), 1), arrayAtI32(arrayAtObj(this.modelOffsets, var16), 2));
                    }
                }
            }

            let var17: BASType | null = null;
            if (this.m_baseAnimationSet !== -1) {
                var17 = BASTypeList.List(this.m_baseAnimationSet);
            }

            if (var17 !== null && var17.transforms !== null) {
                for (let var18 = 0; var17.transforms.length > var18; var18++) {
                    if (arrayAtObj(var17.transforms, var18) === null || var18 >= var15.length) {
                        continue;
                    }

                    const part = var15[var18];
                    if (part === null) {
                        continue;
                    }

                    let var19: number;
                    let var20: number;
                    let var22: number;
                    let var23: number;
                    let var21: number;
                    let var24: number;
                    if (glJar) {
                        var21 = arrayAtI32(arrayAtObj(var17.transforms, var18), 2);
                        var22 = arrayAtI32(arrayAtObj(var17.transforms, var18), 3);
                        var23 = arrayAtI32(arrayAtObj(var17.transforms, var18), 4);
                        var20 = arrayAtI32(arrayAtObj(var17.transforms, var18), 1);
                        var24 = arrayAtI32(arrayAtObj(var17.transforms, var18), 5);
                        var19 = arrayAtI32(arrayAtObj(var17.transforms, var18), 0);
                    } else {
                        var19 = arrayAtI32(arrayAtObj(var17.transforms, var18), 0);
                        var20 = arrayAtI32(arrayAtObj(var17.transforms, var18), 1);
                        var22 = arrayAtI32(arrayAtObj(var17.transforms, var18), 3);
                        var23 = arrayAtI32(arrayAtObj(var17.transforms, var18), 4);
                        var21 = arrayAtI32(arrayAtObj(var17.transforms, var18), 2);
                        var24 = arrayAtI32(arrayAtObj(var17.transforms, var18), 5);
                    }
                    if (this.slotMatrices === null) {
                        this.slotMatrices = new Array<Int32Array | null>(var17.transforms.length).fill(null);
                    }

                    if (arrayAtObj(this.slotMatrices, var18) === null) {
                        const var25 = new Int32Array(15);
                        arrayPutObj(this.slotMatrices, var18, var25);
                        if (var22 === 0 && var23 === 0 && var24 === 0) {
                            var25[12] = -var19 | 0;
                            var25[13] = -var20 | 0;
                            var25[14] = -var21 | 0;
                            var25[8] = 32768;
                            var25[4] = 32768;
                            var25[0] = 32768;
                        } else {
                            let var27: number;
                            let var26: number;
                            let var28: number;
                            let var29: number;
                            let var31: number;
                            let var30: number;
                            if (glJar) {
                                var26 = arrayAtI32(Pix3D.cosTable, var22) >> 1;
                                var27 = arrayAtI32(Pix3D.sinTable, var22) >> 1;
                                var28 = arrayAtI32(Pix3D.cosTable, var23) >> 1;
                                var30 = arrayAtI32(Pix3D.cosTable, var24) >> 1;
                                var29 = arrayAtI32(Pix3D.sinTable, var23) >> 1;
                                var31 = arrayAtI32(Pix3D.sinTable, var24) >> 1;
                            } else {
                                var27 = arrayAtI32(Pix3D.sinTable, var22) >> 1;
                                var26 = arrayAtI32(Pix3D.cosTable, var22) >> 1;
                                var28 = arrayAtI32(Pix3D.cosTable, var23) >> 1;
                                var29 = arrayAtI32(Pix3D.sinTable, var23) >> 1;
                                var31 = arrayAtI32(Pix3D.sinTable, var24) >> 1;
                                var30 = arrayAtI32(Pix3D.cosTable, var24) >> 1;
                            }
                            var25[5] = -var27 | 0;
                            var25[8] = (Math.imul(var28, var26) - -16384) >> 15;
                            var25[4] = (16384 + Math.imul(var26, var30)) >> 15;
                            var25[2] = (Math.imul(var26, var29) - -16384) >> 15;
                            const var32 = (16384 + Math.imul(var27, var30)) >> 15;
                            var25[7] = (16384 + (Math.imul(-var31 | 0, -var29 | 0) - (-Math.imul(var28, var32) | 0))) >> 15;
                            var25[14] = (Math.imul(-var20 | 0, var25[5]) + Math.imul(var25[2], -var19 | 0) + Math.imul(-var21 | 0, var25[8]) + 16384) >> 15;
                            var25[1] = (Math.imul(var28, -var31 | 0) - ((-Math.imul(var32, var29) | 0) - 16384)) >> 15;
                            var25[13] = (16384 + (Math.imul(var25[7], -var21 | 0) + Math.imul(-var19 | 0, var25[1]) + Math.imul(var25[4], -var20 | 0))) >> 15;
                            var25[3] = (Math.imul(var31, var26) + 16384) >> 15;
                            const var33 = (16384 + Math.imul(var31, var27)) >> 15;
                            var25[0] = (Math.imul(var29, var33) + Math.imul(var28, var30) + 16384) >> 15;
                            var25[6] = (16384 + (Math.imul(var30, -var29 | 0) - (-Math.imul(var33, var28) | 0))) >> 15;
                            var25[12] = (16384 + (Math.imul(var25[3], -var20 | 0) + Math.imul(-var19 | 0, var25[0]) + Math.imul(var25[6], -var21 | 0))) >> 15;
                        }

                        var25[11] = var21;
                        var25[9] = var19;
                        var25[10] = var20;
                    }

                    if (var22 !== 0 || var23 !== 0 || var24 !== 0) {
                        part.rotate(var22, var23, var24);
                    }

                    if (var19 !== 0 || var20 !== 0 || var21 !== 0) {
                        part.Translate(var19, var20, var21);
                    }
                }
            }

            let var14: ModelUnlit | null;
            if (var15.length !== 1) {
                var14 = new ModelUnlit(var15, var15.length);
            } else {
                var14 = var15[0];
            }

            if (this.recolourSource !== null) {
                for (let var18 = 0; var18 < this.recolourSource.length; var18++) {
                    if (this.recolourPalette !== null && this.recolourPalette.length > var18) {
                        const from = arrayAtI16(this.recolourSource, var18);
                        const to = arrayAtI16(NpcType.clientPalette, 255 & arrayAtI8(this.recolourPalette, var18));
                        requireNonNull(var14).Recolour(from, to);
                    } else {
                        const from = arrayAtI16(this.recolourSource, var18);
                        const to = arrayAtI16(this.recolourDest, var18);
                        requireNonNull(var14).Recolour(from, to);
                    }
                }
            }

            if (this.retextureSource !== null) {
                for (let var18 = 0; var18 < this.retextureSource.length; var18++) {
                    const from = arrayAtI16(this.retextureSource, var18);
                    const to = arrayAtI16(this.retextureDest, var18);
                    requireNonNull(var14).Retexture(from, to);
                }
            }

            var11 = requireNonNull(var14).Light((this.ambient + 64) | 0, (850 - -this.contrast) | 0, -30, -50, -30);
            if (glJar && loadGlRenderer().active) {
                const GlModel = loadGlModel();
                if (!(var11 instanceof GlModel)) throw new TypeError('ClassCastException: expected GlModel');
                var11.prepareBuffers(false, false, false, true, false, false, true);
            }
            NpcType.m_modelCache.Put(BigInt(this.id), var11);
        }

        // Slots 12..15: any slot animation, then whether any applied frame animates transparencies, colours, or is
        // special (the three CopyForAnimActor sharing flags are their negations).
        let var12 = false;
        let var13 = false;
        let var14 = false;
        let var15 = false;
        const var16 = var1 !== null ? var1.length : 0;
        for (let var17 = 0; var16 > var17; var17++) {
            const slot = arrayAtObj(var1, var17);
            if (slot === null) {
                continue;
            }

            const var18 = SeqType.List(slot.seq);
            if (var18.frames === null) {
                continue;
            }

            arrayPutObj(NpcType.slotSeqs, var17, var18);
            var12 = true;
            const var19 = slot.frame;
            const var20 = slot.next;
            let var21 = arrayAtI32(var18.frames, var19);
            arrayPutObj(NpcType.layerFramesets, var17, AnimFrameSet.get(var21 >>> 16));
            var21 &= 65535;
            arrayPutI32(NpcType.layerFrameIds, var17, var21);
            const frameset = arrayAtObj(NpcType.layerFramesets, var17);
            if (frameset !== null) {
                var14 = frameset.getAnimateColours(var21) || var14;
                var13 = frameset.GetAnimateTransparencies(var21) || var13;
                var15 = var15 || var18.special;
            }

            if ((var18.tween || SeqType.forceTween) && var20 !== -1 && var18.frames.length > var20) {
                arrayPutI32(NpcType.slotFrameDelays, var17, arrayAtI32(var18.delays, var19));
                arrayPutI32(NpcType.slotFrameCycles, var17, slot.cycle);
                let var22 = arrayAtI32(var18.frames, var20);
                arrayPutObj(NpcType.slotNextFramesets, var17, AnimFrameSet.get(var22 >>> 16));
                var22 &= 65535;
                arrayPutI32(NpcType.layerNextFrames, var17, var22);
                const next = arrayAtObj(NpcType.slotNextFramesets, var17);
                if (next !== null) {
                    var14 = next.getAnimateColours(var22) || var14;
                    var13 = next.GetAnimateTransparencies(var22) || var13;
                }
            } else {
                arrayPutI32(NpcType.slotFrameDelays, var17, 0);
                arrayPutI32(NpcType.slotFrameCycles, var17, 0);
                arrayPutObj(NpcType.slotNextFramesets, var17, null);
                arrayPutI32(NpcType.layerNextFrames, var17, -1);
            }
        }

        if (!var12 && var3 === null && var10 === null) {
            const var18 = var11.CopyForAnimActor(true, true, true);
            if (this.resizeH !== 128 || this.resizeV !== 128) {
                var18.Resize(this.resizeH, this.resizeV, this.resizeH);
            }

            return var18;
        }

        let var18 = -1;
        let var19 = -1;
        let var22: AnimFrameSet | null = null;
        let var21: AnimFrameSet | null = null;
        let var20 = 0;
        if (var3 !== null) {
            var18 = arrayAtI32(var3.frames, var2);
            const var23 = var18 >>> 16;
            var21 = AnimFrameSet.get(var23);
            var18 &= 65535;
            if (var21 !== null) {
                var14 = var21.getAnimateColours(var18) || var14;
                var13 = var21.GetAnimateTransparencies(var18) || var13;
                var15 = var15 || var3.special;
            }

            if ((var3.tween || SeqType.forceTween) && var5 !== -1 && requireNonNull(var3.frames).length > var5) {
                var19 = arrayAtI32(var3.frames, var5);
                var20 = arrayAtI32(var3.delays, var2);
                const var24 = var19 >>> 16;
                var19 &= 65535;
                if (var23 !== var24) {
                    // As in the jar (javap offset 1849): var19 is already masked, so this always asks for frameset 0.
                    var22 = AnimFrameSet.get(var19 >>> 16);
                } else {
                    var22 = var21;
                }

                if (var22 !== null) {
                    var14 = var22.getAnimateColours(var19) || var14;
                    var13 = var22.GetAnimateTransparencies(var19) || var13;
                }
            }
        }

        let var23 = -1;
        let var25 = 0;
        let var24 = -1;
        let var26: AnimFrameSet | null = null;
        let var27: AnimFrameSet | null = null;
        if (var10 !== null) {
            var23 = arrayAtI32(var10.frames, var9);
            const var28 = var23 >>> 16;
            var23 &= 65535;
            var26 = AnimFrameSet.get(var28);
            if (var26 !== null) {
                var14 = var26.getAnimateColours(var23) || var14;
                var13 = var26.GetAnimateTransparencies(var23) || var13;
                var15 = var15 || var10.special;
            }

            if ((var10.tween || SeqType.forceTween) && var8 !== -1 && requireNonNull(var10.frames).length > var8) {
                var25 = arrayAtI32(var10.delays, var9);
                var24 = arrayAtI32(var10.frames, var8);
                const var29 = var24 >>> 16;
                var24 &= 65535;
                if (var29 !== var28) {
                    // As in the jar (javap offset 2067): var24 is already masked, so this always asks for frameset 0.
                    var27 = AnimFrameSet.get(var24 >>> 16);
                } else {
                    var27 = var26;
                }

                if (var27 !== null) {
                    var14 = var27.getAnimateColours(var24) || var14;
                    var13 = var27.GetAnimateTransparencies(var24) || var13;
                }
            }
        }

        const var28 = var11.CopyForAnimActor(!var13, !var14, !var15);
        let var30 = 1;
        for (let var29 = 0; var16 > var29; var29++) {
            if (arrayAtObj(NpcType.layerFramesets, var29) !== null) {
                var28.animateMasked(
                    arrayAtObj(NpcType.layerFramesets, var29),
                    arrayAtI32(NpcType.layerFrameIds, var29),
                    arrayAtObj(NpcType.slotNextFramesets, var29),
                    arrayAtI32(NpcType.layerNextFrames, var29),
                    (arrayAtI32(NpcType.slotFrameCycles, var29) - 1) | 0,
                    arrayAtI32(NpcType.slotFrameDelays, var29),
                    var30,
                    requireNonNull(arrayAtObj(NpcType.slotSeqs, var29)).special,
                    arrayAtObj(this.slotMatrices, var29)
                );
            }

            var30 <<= 1;
        }

        if (var21 !== null && var26 !== null) {
            const primary = requireNonNull(var3);
            const mask = primary.mask;
            const special = primary.special;
            const secondarySpecial = requireNonNull(var10).special;
            var28.SplitAnimate(var21, var18, var22, var19, (-1 + var6) | 0, var20, var26, var23, var27, var24, (var4 - 1) | 0, var25, mask, special || secondarySpecial);
        } else if (var21 === null) {
            if (var26 !== null) {
                var28.Animate(var26, var23, var27, var24, (var4 - 1) | 0, var25, requireNonNull(var10).special);
            }
        } else {
            var28.Animate(var21, var18, var22, var19, (-1 + var6) | 0, var20, requireNonNull(var3).special);
        }

        for (let var31 = 0; var31 < var16; var31++) {
            arrayPutObj(NpcType.layerFramesets, var31, null);
            arrayPutObj(NpcType.slotNextFramesets, var31, null);
            arrayPutObj(NpcType.slotSeqs, var31, null);
        }

        if (this.resizeH !== 128 || this.resizeV !== 128) {
            var28.Resize(this.resizeH, this.resizeV, this.resizeH);
        }

        return var28;
    }

    // ja.a(Lek;IIII)Lnd; (NXT NpcType::GetHead, NpcType.cpp:706; named GetHeadModel per the batch-5 API sheet)
    // The chathead model: the headModels merged, recoloured (through clientPalette where the NPC has a palette entry),
    // retextured and lit with the fixed (64, 768) lighting, cached in headModelCache by id, then animated by var1 when
    // non-null (SeqType.AnimateModelWithExtra: frame var4, next frame var2, cycle var5). A multinpc delegates to its
    // current variant. Null when there are no head models or a file is not ready. The third Java int is a stripped
    // dummy: every caller passes more than 73 (aj.a(Lcl;IIZIZLek;)Lnd;: 107, cl.a(IILek;II)Lnd;: 82, the multinpc
    // recursion here: 123), so the guard `if (var3 <= 73) this.b(-23)` (a discarded GetMultiNpc) never runs.
    GetHeadModel(var1: SeqType | null, var2: number, var4: number, var5: number): ModelLit | null {
        if (this.multi !== null) {
            const var6 = this.GetMultiNpc();
            if (var6 === null) {
                return null;
            }

            return var6.GetHeadModel(var1, var2, var4, var5);
        }

        if (this.headModels === null) {
            return null;
        }

        const cached = NpcType.headModelCache.Find(BigInt(this.id));
        if (cached !== null && !(cached instanceof ModelLit)) throw new TypeError('ClassCastException: not a ModelLit');
        let var6: ModelLit | null = cached;
        if (var6 === null) {
            let var7 = false;
            for (let var8 = 0; var8 < this.headModels.length; var8++) {
                if (!requireNonNull(NpcType.m_pModels).RequestDownload(true, arrayAtI32(this.headModels, var8), 0)) {
                    var7 = true;
                }
            }

            if (var7) {
                return null;
            }

            const var9 = new Array<ModelUnlit | null>(this.headModels.length).fill(null);
            for (let var10 = 0; var10 < this.headModels.length; var10++) {
                arrayPutObj(var9, var10, ModelUnlit.Load(NpcType.m_pModels, arrayAtI32(this.headModels, var10), 0));
            }

            let var11: ModelUnlit | null;
            if (var9.length === 1) {
                var11 = var9[0];
            } else {
                var11 = new ModelUnlit(var9, var9.length);
            }

            if (this.recolourSource !== null) {
                for (let var12 = 0; var12 < this.recolourSource.length; var12++) {
                    if (this.recolourPalette === null || var12 >= this.recolourPalette.length) {
                        const from = arrayAtI16(this.recolourSource, var12);
                        const to = arrayAtI16(this.recolourDest, var12);
                        requireNonNull(var11).Recolour(from, to);
                    } else {
                        const from = arrayAtI16(this.recolourSource, var12);
                        const to = arrayAtI16(NpcType.clientPalette, arrayAtI8(this.recolourPalette, var12) & 255);
                        requireNonNull(var11).Recolour(from, to);
                    }
                }
            }

            if (this.retextureSource !== null) {
                for (let var12 = 0; var12 < this.retextureSource.length; var12++) {
                    const from = arrayAtI16(this.retextureSource, var12);
                    const to = arrayAtI16(this.retextureDest, var12);
                    requireNonNull(var11).Retexture(from, to);
                }
            }

            var6 = requireNonNull(var11).Light(64, 768, -50, -10, -50);
            NpcType.headModelCache.Put(BigInt(this.id), var6);
        }

        if (var1 !== null) {
            var6 = var1.AnimateModelWithExtra(var4, var2, var6, var5);
        }

        return var6;
    }
}
