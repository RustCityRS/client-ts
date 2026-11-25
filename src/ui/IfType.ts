import { releaseReferences } from '#/util/StaticReferences';
import { isJavaRuntimeException } from '#/util/JavaException';
import WrappedException from '#/util/WrappedException';
import Client from '#/client/Client';
import LRUHashCache from '#/datastruct/LRUHashCache';
import AbstractSprite from '#/graphics/AbstractSprite';
import PixfontGeneric from '#/graphics/PixfontGeneric';
import type AbstractIndexedSprite from '#/graphics/AbstractIndexedSprite';
import SpriteLoader from '#/graphics/SpriteLoader';
import type Js5 from '#/cache/Js5';
import PacketT from '#/io/PacketT';
import { arrayAtI32, arrayAtObj, arrayAtU8, arrayPutI32, arrayPutObj, requireNonNull } from '#/util/JavaArray';
import JagString, { fromLiteral } from '#/datastruct/JagString';
import ServerActiveProperties from './ServerActiveProperties';
import LocalisedText from './LocalisedText';
import { glJar } from '#/client/ClientVariant';
import NpcType from '#/config/NpcType';
import ObjType from '#/config/ObjType';
import type SeqType from '#/config/SeqType';
import ModelLit from '#/dash3d/ModelLit';
import ModelUnlit from '#/dash3d/ModelUnlit';
import type PlayerModel from '#/dash3d/PlayerModel';
import type Pix32 from '#/graphics/Pix32';
import SoftwareAlphaSprite from '#/graphics/SoftwareAlphaSprite';
import { byteAt } from '#/io/JavaByteArray';
import FriendChatChannelClass from '#/client/FriendChatChannel';
import GlRenderer from '#/gl/GlRenderer';
import { loadGlAlphaSprite, loadGlSprite, loadScriptRunner } from '#/util/GamepackClasses';

export type Hook = (number | JagString | null)[];
export type HookName =
    | 'onRelease'
    | 'onDragComplete'
    | 'onChatTransmit'
    | 'onFriendTransmit'
    | 'onKey'
    | 'onTimer'
    | 'onStockTransmit'
    | 'onOp'
    | 'onMouseLeave'
    | 'onHold'
    | 'onStatTransmit'
    | 'onCamFinished'
    | 'onTargetEnter'
    | 'onLoad'
    | 'onMouseRepeat'
    | 'onSubChange'
    | 'onVarcTransmit'
    | 'onResize'
    | 'onClickRepeat'
    | 'onVarcstrTransmit'
    | 'onClick'
    | 'onVarTransmit'
    | 'onScrollWheel'
    | 'onDialogAbort'
    | 'onMouseOver'
    | 'onInvTransmit'
    | 'onDrag'
    | 'onMiscTransmit'
    | 'onClanTransmit'
    | 'onTargetLeave';

export default class IfType {
    // HD be.b(I)V
    static releaseHdStatics(guard: number): void {
        try {
            releaseReferences(LocalisedText, 'germanTake');
            const ScriptRunner = loadScriptRunner();
            releaseReferences(ScriptRunner, 'eventOpbase');
            if (guard < 63) {
                IfType.releaseHdStatics(42);
            }
            const FriendChatChannel = FriendChatChannelClass;
            releaseReferences(FriendChatChannel, 'channelName');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'be.F(' + guard + ')');
        }
    }

    // gh.G:Lid;
    static readonly emptyString = fromLiteral('');
    // h.f:Lal;
    static m_pSprites: Js5 | null = null;
    // kk.R:Lal;
    static m_pModels: Js5 | null = null;
    // pb.nc:Lal;
    static m_pFontMetrics: Js5 | null = null;
    // kh.A:Lal;
    static m_pInterfaces: Js5 | null = null;
    // fk.ab:[[Laj;
    static m_list: ((IfType | null)[] | null)[] | null = null;
    // rg.b:[Z
    static m_open: boolean[] | null = null;

    // wf.a(Lal;Lal;ZLal;Lal;)V
    static Init(fonts: Js5 | null, sprites: Js5 | null, models: Js5 | null, archive: Js5 | null): void {
        IfType.m_pSprites = sprites;
        IfType.m_pModels = models;
        IfType.m_pFontMetrics = fonts;
        IfType.m_pInterfaces = archive;
        IfType.m_list = new Array(requireNonNull(IfType.m_pInterfaces).GetGroupIdLimit()).fill(null);
        IfType.m_open = new Array<boolean>(requireNonNull(IfType.m_pInterfaces).GetGroupIdLimit()).fill(false);
    }

    // qg.a(IZ)Z
    static OpenInterface(group: number, allocateOnly = false): boolean {
        try {
            if (arrayAtObj(IfType.m_open, group)) return true;
            if (!requireNonNull(IfType.m_pInterfaces).RequestGroupDownload(group)) return false;
            const capacity = requireNonNull(IfType.m_pInterfaces).GetFileIdLimit(group);
            if (capacity === 0) {
                arrayPutObj(IfType.m_open, group, true);
                return true;
            }
            if (arrayAtObj(IfType.m_list, group) === null) {
                arrayPutObj(IfType.m_list, group, new Array<IfType | null>(capacity).fill(null));
            }
            if (allocateOnly) return true;
            for (let file = 0; file < capacity; file++) {
                if (arrayAtObj(arrayAtObj(IfType.m_list, group), file) === null) {
                    const data = requireNonNull(IfType.m_pInterfaces).GetFile(file, group);
                    if (data !== null) {
                        const row = arrayAtObj(IfType.m_list, group);
                        const c = new IfType();
                        arrayPutObj(row, file, c);
                        c.id = ((group << 16) + file) | 0;
                        if (arrayAtU8(data, 0) === 255) c.Decode3(new PacketT(data));
                        else c.Decode(new PacketT(data));
                    }
                }
            }
            arrayPutObj(IfType.m_open, group, true);
            return true;
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'qg.D(' + group + ',' + allocateOnly + ')');
        }
    }

    // ad.a(BI)Laj;
    static Get(id: number): IfType | null {
        const group = id >> 16,
            file = id & 65535;
        if (arrayAtObj(IfType.m_list, group) === null || arrayAtObj(arrayAtObj(IfType.m_list, group), file) === null) {
            if (!IfType.OpenInterface(group)) return null;
        }
        return arrayAtObj(arrayAtObj(IfType.m_list, group), file);
    }

    // ra.a(II)V
    static CloseInterface(group: number): void {
        if (group === -1 || !arrayAtObj(IfType.m_open, group)) return;
        requireNonNull(IfType.m_pInterfaces).DiscardFiles(group);
        if (arrayAtObj(IfType.m_list, group) !== null) {
            let empty = true;
            for (let i = 0; i < requireNonNull(arrayAtObj(IfType.m_list, group)).length; i++) {
                if (arrayAtObj(arrayAtObj(IfType.m_list, group), i) !== null) {
                    if (requireNonNull(arrayAtObj(arrayAtObj(IfType.m_list, group), i)).type === 2) empty = false;
                    else arrayPutObj(arrayAtObj(IfType.m_list, group), i, null);
                }
            }
            if (empty) arrayPutObj(IfType.m_list, group, null);
            arrayPutObj(IfType.m_open, group, false);
        }
    }

    static resourceMissing = false; // rk.o:Z

    // aj.a([Lsi;B)Lmb;
    GetFont(icons: (AbstractIndexedSprite | null)[] | null): PixfontGeneric | null {
        IfType.resourceMissing = false;
        if (this.fontId === -1) return null;
        const cache = IfType.m_fontCache;
        const key = BigInt(this.fontId);
        const cached = requireNonNull(cache).Find(key);
        if (cached !== null) {
            if (!(cached instanceof PixfontGeneric)) throw new TypeError('ClassCastException: not a PixfontGeneric');
            return cached;
        }
        const font = SpriteLoader.loadFont(IfType.m_pSprites, this.fontId, 0, IfType.m_pFontMetrics);
        if (font === null) {
            IfType.resourceMissing = true;
            return null;
        }
        font.setNameIcons(icons, null);
        const destination = IfType.m_fontCache;
        const id = BigInt(this.fontId);
        requireNonNull(destination).Put(id, font);
        return font;
    }

    // bj.b:Lve;
    static readonly m_spriteCache = new LRUHashCache<AbstractSprite>(200);
    // gf.S:Lve;
    static readonly m_modelCache = new LRUHashCache<object>(50);
    // cf.f:Lve;
    static readonly m_fontCache = new LRUHashCache<PixfontGeneric>(20);

    // ci.a(BLaj;I)I
    static getOpCursor(component: IfType, op: number): number {
        if (!Client.GetActive(component).isOpEnabled(op) && component.onOp === null) return -1;
        return component.opCursors !== null && component.opCursors.length > op ? arrayAtI32(component.opCursors, op) : -1;
    }

    // jk.c(B)V
    static ResetCache(): void {
        IfType.m_spriteCache.Reset();
        IfType.m_modelCache.Reset();
        IfType.m_fontCache.Reset();
    }

    // vg.g(I)V
    static removeSoft(): void {
        IfType.m_spriteCache.removeSoft();
        IfType.m_modelCache.removeSoft();
        IfType.m_fontCache.removeSoft();
    }

    // nb.a(II)V
    static cleanCaches(age: number): void {
        IfType.m_spriteCache.Clean(age);
        IfType.m_modelCache.Clean(age);
        IfType.m_fontCache.Clean(age);
    }

    // aj.b:I
    lastVarTransmit = 0;
    // aj.c:[I
    varTriggers: Int32Array | null = null;
    // aj.d:I
    modelYAngle = 0;
    // aj.e:Z
    showItemCount = true;
    // aj.f:I
    buttonType = 0;
    // aj.g:[Ljava/lang/Object;
    onRelease: Hook | null = null;
    // aj.h:B
    heightMode = 0;
    // aj.i:Z
    hasHook = false;
    // aj.j:[Lid;
    invOptions: (JagString | null)[] | null = null;
    // aj.k:[Ljava/lang/Object;
    onDragComplete: Hook | null = null;
    // aj.l:Lid;
    activeTextValue = IfType.emptyString;
    // aj.m:B
    yMode = 0;
    // aj.n:I
    parentId = -1;
    // aj.o:I
    lastVarcStringTransmit = 0;
    // aj.p:[Ljava/lang/Object;
    onChatTransmit: Hook | null = null;
    // aj.q:Z
    spriteTiling = false;
    // aj.r:Lid;
    opBaseValue: JagString | null = IfType.emptyString;
    // aj.s:[I
    maskStarts: Int32Array | null = null;
    // aj.u:[Ljava/lang/Object;
    onFriendTransmit: Hook | null = null;
    // aj.v:[I
    opCursors: Int32Array | null = null;
    // aj.w:I
    modelId = 0;
    // aj.x:[Ljava/lang/Object;
    onKey: Hook | null = null;
    // aj.y:Z
    if3 = false;
    // aj.z:[I
    keyNextCycles: Int32Array | null = null;
    // aj.A:I
    spriteAngle = 0;
    // aj.B:I
    overColour = 0;
    // aj.C:I
    width = 0;
    // aj.E:Lid;
    targetVerbValue: JagString | null = IfType.emptyString;
    // aj.G:I
    baseWidth = 0;
    // aj.H:I
    height = 0;
    // aj.I:I
    activeColour = 0;
    // aj.J:[Ljava/lang/Object;
    onTimer: Hook | null = null;
    // aj.K:[Ljava/lang/Object;
    onStockTransmit: Hook | null = null;
    // aj.L:I
    lineSpacing = 0;
    // aj.M:I
    baseHeight = 0;
    // aj.N:[Ljava/lang/Object;
    onOp: Hook | null = null;
    // aj.O:I
    activeModel = -1;
    // aj.P:I
    modelRotationSpeed = 0;
    // aj.Q:I
    modelNext = 1;
    // aj.R:I
    drawCycle = -1;
    // aj.S:I
    transparency = 0;
    // aj.U:[I
    varcTriggers: Int32Array | null = null;
    // aj.V:[Ljava/lang/Object;
    onMouseLeave: Hook | null = null;
    // aj.W:[Ljava/lang/Object;
    onHold: Hook | null = null;
    // aj.X:B
    widthMode = 0;
    // aj.Y:I
    modelHeight = 0;
    // aj.Z:[Ljava/lang/Object;
    onStatTransmit: Hook | null = null;
    // aj.ab:I
    itemY = 0;
    // aj.bb:I
    textAlignH = 0;
    // aj.cb:I
    aspectWidth = 1;
    // aj.db:I
    modelOffsetX = 0;
    // aj.eb:[I
    comparisonValues: Int32Array | null = null;
    // aj.fb:Z
    hFlip = false;
    // aj.gb:Lid;
    textValue = IfType.emptyString;
    // aj.hb:I
    modelOffsetY = 0;
    // aj.ib:I
    x = 0;
    // aj.jb:I
    scrollHeight = 0;
    // aj.lb:[I
    invSlotSprite: Int32Array | null = null;
    // aj.mb:I
    spriteId = -1;
    // aj.nb:[Ljava/lang/Object;
    onCamFinished: Hook | null = null;
    // aj.ob:I
    type = 0;
    // aj.pb:[Laj;
    childSlots: (IfType | null)[] | null = null;
    // aj.qb:I
    modelOriginX = 0;
    // aj.ub:B
    xMode = 0;
    // aj.vb:I
    rootIndex = -1;
    // aj.wb:I
    targetOverCursor = -1;
    // aj.yb:[I
    invSlotOffsetX: Int32Array | null = null;
    // aj.zb:I
    activeModelType = 1;
    // aj.Bb:I
    modelWidth = 0;
    // aj.Fb:[Ljava/lang/Object;
    onTargetEnter: Hook | null = null;
    // aj.Gb:[I
    invSlotOffsetY: Int32Array | null = null;
    // aj.Hb:I
    overLayer = -1;
    // aj.Ib:[I
    opKeyRate: Int32Array | null = null;
    // aj.Jb:I
    textAlignV = 0;
    // aj.Kb:Z
    vFlip = false;
    // aj.Lb:[Ljava/lang/Object;
    onLoad: Hook | null = null;
    // aj.Mb:I
    y = 0;
    // aj.Ob:[I
    itemCounts: Int32Array | null = null;
    // aj.Pb:[Ljava/lang/Object;
    onMouseRepeat: Hook | null = null;
    // aj.Qb:[I
    statTriggers: Int32Array | null = null;
    // aj.Rb:[I
    invTriggers: Int32Array | null = null;
    // aj.Sb:I
    modelFrame = 0;
    // aj.Tb:Lid;
    targetTextValue = IfType.emptyString;
    // aj.Vb:[[I
    scripts: Int32Array[] | null = null;
    // aj.Wb:I
    aspectHeight = 1;
    // aj.Xb:Z
    spriteAlpha = false;
    // aj.Yb:I
    dragDeadTime = 0;
    // aj.Zb:[I
    itemIds: Int32Array | null = null;
    // aj.ac:[Ljava/lang/Object;
    onSubChange: Hook | null = null;
    // aj.bc:I
    childId = -1;
    // aj.cc:I
    dragDeadZone = 0;
    // aj.dc:[Ljava/lang/Object;
    onVarcTransmit: Hook | null = null;
    // aj.fc:Lid;
    buttonTextValue = LocalisedText.ok;
    // aj.hc:I
    scrollX = 0;
    // aj.ic:[Ljava/lang/Object;
    onResize: Hook | null = null;
    // aj.jc:I
    modelAnim = -1;
    // aj.kc:I
    modelThirdKit = -1;
    // aj.lc:I
    activeSprite = -1;
    // aj.mc:I
    fontId = -1;
    // aj.nc:Z
    textShadow = false;
    // aj.oc:I
    colour = 0;
    // aj.pc:[Ljava/lang/Object;
    onClickRepeat: Hook | null = null;
    // aj.qc:[Ljava/lang/Object;
    onVarcstrTransmit: Hook | null = null;
    // aj.sc:[I
    varcstrTriggers: Int32Array | null = null;
    // aj.tc:I
    outline = 0;
    // aj.wc:I
    clientCode = 0;
    // aj.xc:I
    itemCount = 0;
    // aj.yc:I
    itemId = -1;
    // aj.zc:Z
    dragRender = false;
    // aj.Ac:I
    scrollY = 0;
    // aj.Bc:I
    baseX = 0;
    // aj.Dc:I
    spriteShadow = 0;
    // aj.Ec:I
    baseY = 0;
    // aj.Fc:Z
    pressed = false;
    // aj.Gc:[Ljava/lang/Object;
    onClick: Hook | null = null;
    // aj.Hc:I
    modelCycle = 0;
    // aj.Ic:Z
    modelOrtho = false;
    // HD be.Vc:S. Offset applied to the widget model's projection depth.
    declare Vc: number;
    // HD be.o:S. Reference distance passed to tf.a(FF)V.
    declare o: number;
    // HD be.md:Z. Disable depth writes while drawing this component's model.
    declare md: boolean;
    // aj.Jc:Z
    fill = false;
    // aj.Kc:I
    id = -1;
    // aj.Lc:[Ljava/lang/Object;
    onVarTransmit: Hook | null = null;
    // aj.Mc:I
    lastTransmitCycle = -1;
    // aj.Nc:I
    lastStatTransmit = 0;
    // aj.Oc:Z
    lineDirection = false;
    // aj.Pc:[Ljava/lang/Object;
    onScrollWheel: Hook | null = null;
    // aj.Qc:[B
    opKeyCode: Int8Array | null = null;
    // aj.Rc:[Ljava/lang/Object;
    onDialogAbort: Hook | null = null;
    // aj.Sc:Ll;
    properties = ServerActiveProperties.DEFAULT;
    // aj.Tc:[Ljava/lang/Object;
    onMouseOver: Hook | null = null;
    // aj.Uc:I
    lineWidth = 1;
    // aj.Vc:I
    modelOriginY = 0;
    // aj.Wc:Z
    hidden = false;
    // aj.Xc:Z
    mouseOver = false;
    // aj.Yc:[Lid;
    operationNames: (JagString | null)[] | null = null;
    // aj.Zc:[Ljava/lang/Object;
    onInvTransmit: Hook | null = null;
    // aj.ad:[Ljava/lang/Object;
    onDrag: Hook | null = null;
    // aj.bd:[I
    comparisonOps: Int32Array | null = null;
    // aj.cd:Laj;
    dragParent: IfType | null = null;
    // aj.dd:[B
    opKeyModifier: Int8Array | null = null;
    // aj.gd:[Ljava/lang/Object;
    onMiscTransmit: Hook | null = null;
    // aj.hd:Z
    noClickThrough = false;
    // aj.id:I
    modelZAngle = 0;
    // aj.jd:I
    itemX = 0;
    // aj.kd:I
    activeOverColour = 0;
    // aj.ld:I
    scrollWidth = 0;
    // aj.md:I
    modelType = 1;
    // aj.nd:I
    modelXAngle = 0;
    // aj.od:[Ljava/lang/Object;
    onClanTransmit: Hook | null = null;
    // aj.pd:I
    targetLeaveCursor = -1;
    // aj.qd:I
    activeAnim = -1;
    // aj.rd:I
    lastInvTransmit = 0;
    // aj.sd:I
    lastVarcTransmit = 0;
    // aj.td:[Ljava/lang/Object;
    onTargetLeave: Hook | null = null;
    // aj.ud:[I
    maskWidths: Int32Array | null = null;
    // aj.vd:I
    modelZoom = 100;
    // SD aj.<init>()V, HD be.<init>()V
    constructor() {
        if (glJar) {
            this.o = 3000;
            this.Vc = 0;
            this.md = false;
        }
    }

    // aj.a(Lid;IB)V
    SetOpName(index: number, value: JagString | null): void {
        if (this.operationNames === null || index >= this.operationNames.length) {
            const values = new Array<JagString | null>(index + 1).fill(null);
            if (this.operationNames) {
                for (let i = 0; i < this.operationNames.length; i++) values[i] = this.operationNames[i];
            }
            this.operationNames = values;
        }
        arrayPutObj(this.operationNames, index, value);
    }

    // aj.a(III)V
    setOpCursor(index: number, cursor: number): void {
        if (this.opCursors === null || index >= this.opCursors.length) {
            const values = new Int32Array(index + 1);
            if (this.opCursors) {
                for (let i = 0; i < this.opCursors.length; i++) values[i] = this.opCursors[i];
                for (let i = this.opCursors.length; i < index; i++) values[i] = -1;
            }
            this.opCursors = values;
        }
        arrayPutI32(this.opCursors, index, cursor);
    }

    // aj.b(III)V
    SwapSlots(first: number, second: number): void {
        let value = arrayAtI32(this.itemIds, second);
        arrayPutI32(this.itemIds, second, arrayAtI32(this.itemIds, first));
        arrayPutI32(this.itemIds, first, value);
        value = arrayAtI32(this.itemCounts, second);
        arrayPutI32(this.itemCounts, second, arrayAtI32(this.itemCounts, first));
        arrayPutI32(this.itemCounts, first, value);
    }

    // qg.a(IZ)Z selects the decoder from the first byte and assigns the component uid.
    static decode(id: number, bytes: Uint8Array): IfType {
        const c = new IfType();
        c.id = id;
        const packet = new PacketT(bytes);
        if (bytes[0] === 255) c.Decode3(packet);
        else c.Decode(packet);
        return c;
    }
    // aj.a(ILgd;)V
    Decode(p: PacketT): void {
        this.if3 = false;
        this.type = p.g1();

        this.buttonType = p.g1();
        this.clientCode = p.g2();
        this.baseX = p.g2s();
        this.baseY = p.g2s();
        this.baseWidth = p.g2();
        this.baseHeight = p.g2();
        this.widthMode = 0;
        this.yMode = 0;
        this.heightMode = 0;
        this.xMode = 0;
        this.transparency = p.g1();
        this.parentId = p.g2();
        if (this.parentId !== 65535) {
            this.parentId = this.parentId + (this.id & -65536);
        } else {
            this.parentId = -1;
        }

        this.overLayer = p.g2();
        if (this.overLayer === 65535) {
            this.overLayer = -1;
        }

        const comparisons = p.g1();
        if (comparisons > 0) {
            this.comparisonValues = new Int32Array(comparisons);
            this.comparisonOps = new Int32Array(comparisons);

            for (let i = 0; i < comparisons; i++) {
                this.comparisonOps[i] = p.g1();
                this.comparisonValues[i] = p.g2();
            }
        }

        const scripts = p.g1();
        if (scripts > 0) {
            this.scripts = new Array<Int32Array>(scripts);

            for (let i = 0; scripts > i; i++) {
                const length = p.g2();
                this.scripts[i] = new Int32Array(length);

                for (let j = 0; length > j; j++) {
                    this.scripts[i][j] = p.g2();
                    if (this.scripts[i][j] === 65535) {
                        this.scripts[i][j] = -1;
                    }
                }
            }
        }

        if (this.type === 0) {
            this.scrollHeight = p.g2();
            this.hidden = p.g1() === 1;
        }

        let events = 0;
        if (this.type === 1) {
            p.g2();
            p.g1();
        }

        if (this.type === 2) {
            this.itemCounts = new Int32Array(Math.imul(this.baseHeight, this.baseWidth));
            this.heightMode = 3;
            this.widthMode = 3;
            this.itemIds = new Int32Array(Math.imul(this.baseHeight, this.baseWidth));
            const swap = p.g1();
            if (swap === 1) {
                events |= 268435456;
            }

            const ops = p.g1();
            if (ops === 1) {
                events |= 1073741824;
            }

            const use = p.g1();
            const replace = p.g1();
            this.itemX = p.g1();
            if (use === 1) {
                events |= -2147483648;
            }

            if (replace === 1) {
                events |= 536870912;
            }

            this.itemY = p.g1();
            this.invSlotOffsetY = new Int32Array(20);
            this.invSlotOffsetX = new Int32Array(20);
            this.invSlotSprite = new Int32Array(20);

            for (let i = 0; i < 20; i++) {
                const hasSprite = p.g1();
                if (hasSprite !== 1) {
                    this.invSlotSprite[i] = -1;
                } else {
                    this.invSlotOffsetX[i] = p.g2s();
                    this.invSlotOffsetY[i] = p.g2s();
                    this.invSlotSprite[i] = p.g4();
                }
            }

            this.invOptions = new Array<JagString | null>(5).fill(null);

            for (let i = 0; i < 5; i++) {
                const option = p.gStringNoConversion();
                if (option.getLength() > 0) {
                    this.invOptions[i] = option;
                    events |= 1 << (i + 23);
                }
            }
        }

        if (this.type === 3) {
            this.fill = p.g1() === 1;
        }

        if (this.type === 4 || this.type === 1) {
            this.textAlignH = p.g1();
            this.textAlignV = p.g1();
            this.lineSpacing = p.g1();
            this.fontId = p.g2();
            if (this.fontId === 65535) {
                this.fontId = -1;
            }

            this.textShadow = p.g1() === 1;
        }

        if (this.type === 4) {
            this.textValue = p.gStringNoConversion();
            this.activeTextValue = p.gStringNoConversion();
        }

        if (this.type === 1 || this.type === 3 || this.type === 4) {
            this.colour = p.g4();
        }

        if (this.type === 3 || this.type === 4) {
            this.activeColour = p.g4();
            this.overColour = p.g4();
            this.activeOverColour = p.g4();
        }

        if (this.type === 5) {
            this.spriteId = p.g4();
            this.activeSprite = p.g4();
        }

        if (this.type === 6) {
            this.modelType = 1;
            this.modelId = p.g2();
            if (this.modelId === 65535) {
                this.modelId = -1;
            }

            this.activeModelType = 1;
            this.activeModel = p.g2();
            if (this.activeModel === 65535) {
                this.activeModel = -1;
            }

            this.modelAnim = p.g2();
            if (this.modelAnim === 65535) {
                this.modelAnim = -1;
            }

            this.activeAnim = p.g2();
            if (this.activeAnim === 65535) {
                this.activeAnim = -1;
            }

            this.modelZoom = p.g2();
            this.modelXAngle = p.g2();
            this.modelYAngle = p.g2();
        }

        if (this.type === 7) {
            this.itemIds = new Int32Array(Math.imul(this.baseWidth, this.baseHeight));
            this.widthMode = 3;
            this.heightMode = 3;
            this.itemCounts = new Int32Array(Math.imul(this.baseHeight, this.baseWidth));
            this.textAlignH = p.g1();
            this.fontId = p.g2();
            if (this.fontId === 65535) {
                this.fontId = -1;
            }

            this.textShadow = p.g1() === 1;
            this.colour = p.g4();
            this.itemX = p.g2s();
            this.itemY = p.g2s();
            const objOps = p.g1();
            this.invOptions = new Array<JagString | null>(5).fill(null);
            if (objOps === 1) {
                events |= 1073741824;
            }

            for (let i = 0; i < 5; i++) {
                const option = p.gStringNoConversion();
                if (option.getLength() > 0) {
                    this.invOptions[i] = option;
                    events |= 1 << (i + 23);
                }
            }
        }

        if (this.type === 8) {
            this.textValue = p.gStringNoConversion();
        }

        if (this.buttonType === 2 || this.type === 2) {
            this.targetVerbValue = p.gStringNoConversion();
            this.targetTextValue = p.gStringNoConversion();
            const mask = p.g2() & 63;
            events |= mask << 11;
        }

        if (this.buttonType === 1 || this.buttonType === 4 || this.buttonType === 5 || this.buttonType === 6) {
            this.buttonTextValue = p.gStringNoConversion();
            if (this.buttonTextValue.getLength() === 0) {
                if (this.buttonType === 1) {
                    this.buttonTextValue = LocalisedText.ok;
                }

                if (this.buttonType === 4) {
                    this.buttonTextValue = LocalisedText.select;
                }

                if (this.buttonType === 5) {
                    this.buttonTextValue = LocalisedText.select;
                }

                if (this.buttonType === 6) {
                    this.buttonTextValue = LocalisedText.continue;
                }
            }
        }

        if (this.buttonType === 1 || this.buttonType === 4 || this.buttonType === 5) {
            events |= 4194304;
        }

        if (this.buttonType === 6) {
            events |= 1;
        }

        this.properties = new ServerActiveProperties(events, -1);
    }

    // SD aj.b(ILgd;)V, HD be.c(ILwa;)V
    Decode3(p: PacketT): void {
        this.if3 = true;
        p.m_pos++;
        this.type = p.g1();

        if ((128 & this.type) !== 0) {
            this.type &= 127;
            p.gStringNoConversion();
        }

        this.clientCode = p.g2();
        this.baseX = p.g2s();
        this.baseY = p.g2s();
        this.baseWidth = p.g2();
        this.baseHeight = p.g2();
        this.widthMode = p.g1s();
        this.heightMode = p.g1s();
        this.xMode = p.g1s();

        this.yMode = p.g1s();
        this.parentId = p.g2();
        if (this.parentId === 65535) {
            this.parentId = -1;
        } else {
            this.parentId = (-65536 & this.id) + this.parentId;
        }

        this.hidden = p.g1() === 1;
        if (this.type === 0) {
            this.scrollWidth = p.g2();
            this.scrollHeight = p.g2();
            this.noClickThrough = p.g1() === 1;
        }

        if (this.type === 5) {
            this.spriteId = p.g4();
            this.spriteAngle = p.g2();
            const flags = p.g1();
            this.spriteAlpha = (2 & flags) !== 0;
            this.spriteTiling = (flags & 1) !== 0;
            this.transparency = p.g1();
            this.outline = p.g1();
            this.spriteShadow = p.g4();
            this.vFlip = p.g1() === 1;
            this.hFlip = p.g1() === 1;
        }

        if (this.type === 6) {
            this.modelType = 1;
            this.modelId = p.g2();
            if (this.modelId === 65535) {
                this.modelId = -1;
            }

            this.modelOriginX = p.g2s();
            this.modelOriginY = p.g2s();
            this.modelXAngle = p.g2();
            this.modelYAngle = p.g2();
            this.modelZAngle = p.g2();
            this.modelZoom = p.g2();
            this.modelAnim = p.g2();
            if (this.modelAnim === 65535) {
                this.modelAnim = -1;
            }

            this.modelOrtho = p.g1() === 1;
            if (glJar) {
                this.Vc = (p.g2() << 16) >> 16;
                this.o = (p.g2() << 16) >> 16;
                this.md = p.g1() === 1;
            } else {
                p.g2();
                p.g2();
                p.g1();
            }
            if (this.widthMode !== 0) {
                this.modelWidth = p.g2();
            }

            if (this.heightMode !== 0) {
                this.modelHeight = p.g2();
            }
        }

        if (this.type === 4) {
            this.fontId = p.g2();
            if (this.fontId === 65535) {
                this.fontId = -1;
            }

            this.textValue = p.gStringNoConversion();
            this.lineSpacing = p.g1();
            this.textAlignH = p.g1();
            this.textAlignV = p.g1();
            this.textShadow = p.g1() === 1;
            this.colour = p.g4();
        }

        if (this.type === 3) {
            this.colour = p.g4();
            this.fill = p.g1() === 1;
            this.transparency = p.g1();
        }

        if (this.type === 9) {
            this.lineWidth = p.g1();
            this.colour = p.g4();
            this.lineDirection = p.g1() === 1;
        }

        const events = p.g3();
        let key = p.g1();
        if (key !== 0) {
            if (glJar) this.opKeyRate = new Int32Array(10);
            this.opKeyCode = new Int8Array(10);
            this.opKeyModifier = new Int8Array(10);
            if (!glJar) this.opKeyRate = new Int32Array(10);
            for (; key !== 0; key = p.g1()) {
                const slot = (key >> 4) - 1;
                key = (key << 8) | p.g1();
                key &= 4095;
                arrayPutI32(this.opKeyRate, slot, key === 4095 ? -1 : key);

                this.opKeyCode[slot] = p.g1s();
                this.opKeyModifier[slot] = p.g1s();
            }
        }

        this.opBaseValue = p.gStringNoConversion();
        const ops = p.g1();
        const count = 15 & ops;
        const cursors = ops >> 4;
        if (count > 0) {
            this.operationNames = new Array<JagString | null>(count).fill(null);

            for (let i = 0; i < count; i++) {
                this.operationNames[i] = p.gStringNoConversion();
            }
        }

        if (cursors > 0) {
            const index = p.g1();
            this.opCursors = new Int32Array(index + 1);

            for (let i = 0; i < this.opCursors.length; i++) {
                this.opCursors[i] = -1;
            }

            this.opCursors[index] = p.g2();
        }

        if (cursors > 1) {
            const index = p.g1();
            arrayPutI32(this.opCursors, index, p.g2());
        }

        this.dragDeadZone = p.g1();
        this.dragDeadTime = p.g1();
        this.dragRender = p.g1() === 1;
        let targetParam = -1;
        this.targetVerbValue = p.gStringNoConversion();
        if (ServerActiveProperties.targetMask(events) !== 0) {
            targetParam = p.g2();
            if (glJar) {
                this.targetOverCursor = p.g2();
                if (targetParam === 65535) targetParam = -1;
            } else {
                if (targetParam === 65535) targetParam = -1;
                this.targetOverCursor = p.g2();
            }
            if (this.targetOverCursor === 65535) {
                this.targetOverCursor = -1;
            }

            this.targetLeaveCursor = p.g2();
            if (this.targetLeaveCursor === 65535) {
                this.targetLeaveCursor = -1;
            }
        }

        this.properties = new ServerActiveProperties(events, targetParam);
        this.onLoad = this.DecodeHook(p);
        this.onMouseOver = this.DecodeHook(p);
        this.onMouseLeave = this.DecodeHook(p);
        this.onTargetLeave = this.DecodeHook(p);
        this.onTargetEnter = this.DecodeHook(p);
        this.onVarTransmit = this.DecodeHook(p);
        this.onInvTransmit = this.DecodeHook(p);
        this.onStatTransmit = this.DecodeHook(p);
        this.onTimer = this.DecodeHook(p);
        this.onOp = this.DecodeHook(p);
        this.onMouseRepeat = this.DecodeHook(p);
        this.onClick = this.DecodeHook(p);
        this.onClickRepeat = this.DecodeHook(p);
        this.onRelease = this.DecodeHook(p);
        this.onHold = this.DecodeHook(p);
        this.onDrag = this.DecodeHook(p);
        this.onDragComplete = this.DecodeHook(p);
        this.onScrollWheel = this.DecodeHook(p);
        this.onVarcTransmit = this.DecodeHook(p);
        this.onVarcstrTransmit = this.DecodeHook(p);
        this.varTriggers = this.DecodeTransmitList(p);
        this.invTriggers = this.DecodeTransmitList(p);
        this.statTriggers = this.DecodeTransmitList(p);
        this.varcTriggers = this.DecodeTransmitList(p);
        this.varcstrTriggers = this.DecodeTransmitList(p);
    }

    // aj.a(BLgd;)[Ljava/lang/Object;
    private DecodeHook(p: PacketT): Hook | null {
        const length = p.g1();
        if (length === 0) return null;
        const args: Hook = new Array(length).fill(null);
        for (let i = 0; i < length; i++) {
            const type = p.g1();
            if (type === 0) args[i] = p.g4();
            else if (type === 1) args[i] = p.gStringNoConversion();
        }
        this.hasHook = true;
        return args;
    }

    // aj.a(Lgd;B)[I
    private DecodeTransmitList(p: PacketT): Int32Array | null {
        const length = p.g1();
        if (length === 0) return null;
        const ids = new Int32Array(length);
        for (let i = 0; i < length; i++) ids[i] = p.g4();
        return ids;
    }

    // Renderer methods (batch 5, owned by Claude per PORTING.md). Stripped in all four: the invocation counters
    // (Eb, gc, fd, tb), the od.a catch/rethrow wrappers and the client.wb opaque branches.

    // aj.a(I)Z (NXT IfType::GetMask, iftype.cpp:1295)
    // Builds the per-row opaque spans of the spriteId graphic (an indexed Pix8, file 0 of the sprite archive) for the
    // minimap/compass clip (lf.a's client codes 1338 and 1339): maskStarts[row] is the first non-zero pixel (0 when the
    // row is empty) and maskWidths[row] the run up to the next zero pixel (the trimmed width when it reaches the edge).
    // False while the sprite is not loaded; true once the spans exist. NXT builds the same spans from the Pix32 graphic
    // into a separate mask cache; 530 keeps them on the component. Stripped: the int dummy var1. Both callers (lf.a at
    // javap offsets 760 and 1194) pass 22710, so the early `if (var1 != 22710) return true` after the trim never runs.
    GetMask(): boolean {
        if (this.maskStarts !== null) {
            return true;
        }

        const var2 = SpriteLoader.loadIndexedSprite(this.spriteId, IfType.m_pSprites, 0);
        if (var2 === null) {
            return false;
        }

        var2.trim();
        this.maskWidths = new Int32Array(var2.height);
        this.maskStarts = new Int32Array(var2.height);
        for (let var3 = 0; var3 < var2.height; var3++) {
            let var5 = var2.width;
            let var4 = 0;
            for (let var6 = 0; var2.width > var6; var6++) {
                if ((byteAt(var2.pixels, (Math.imul(var2.width, var3) + var6) | 0) << 24) >> 24 !== 0) {
                    var4 = var6;
                    break;
                }
            }

            for (let var7 = var4; var2.width > var7; var7++) {
                if ((byteAt(var2.pixels, (Math.imul(var3, var2.width) + var7) | 0) << 24) >> 24 === 0) {
                    var5 = var7;
                    break;
                }
            }

            arrayPutI32(this.maskStarts, var3, var4);
            arrayPutI32(this.maskWidths, var3, (-var4 + var5) | 0);
        }

        return true;
    }

    // aj.a(Lcl;IIZIZLek;)Lnd; (NXT IfType::GetTempModel, iftype.cpp:1166)
    // The model of model type/id (activeModelType/activeModel when var4, else modelType/modelId), animated by var7
    // (frame var3, next frame var2, cycle var5): 1 a model file lit (64, 768, -50, -10, -50) and cached in m_modelCache
    // under (type << 16) + id; 2 an NpcType chathead; 3 the player's chathead (var1); 4 an ObjType model (count 10);
    // 6 a full NpcType body; 7 three IdkType kit heads in the player's colours (modelId >>> 16, modelId & 65535,
    // modelThirdKit). resourceMissing starts as var6 and is set when a model is not ready; model type 0, type 1 with
    // id -1, a missing var1 for types 3 and 7 and an unknown type return null without setting it. var6 is a real
    // argument (both lf.a callers, javap offsets 4631 and 4694, happen to pass false). The NXT switch differs from 530
    // in type 4 (GetModelUnlit), 6 (GetHead) and 7 (none).
    GetTempModel(var1: PlayerModel | null, var2: number, var3: number, var4: boolean, var5: number, var6: boolean, var7: SeqType | null): ModelLit | null {
        IfType.resourceMissing = var6;
        let var8: number;
        let var9: number;
        if (var4) {
            var8 = this.activeModelType;
            var9 = this.activeModel;
        } else {
            var8 = this.modelType;
            var9 = this.modelId;
        }

        if (var8 === 0) {
            return null;
        }

        if (var8 === 1 && var9 === -1) {
            return null;
        }

        if (var8 === 1) {
            const cached = IfType.m_modelCache.Find(BigInt((var9 + (var8 << 16)) | 0));
            if (cached !== null && !(cached instanceof ModelLit)) throw new TypeError('ClassCastException: not a ModelLit');
            let var10: ModelLit | null = cached;
            if (var10 === null) {
                const var11 = ModelUnlit.Load(IfType.m_pModels, var9, 0);
                if (var11 === null) {
                    IfType.resourceMissing = true;
                    return null;
                }

                var10 = var11.Light(64, 768, -50, -10, -50);
                IfType.m_modelCache.Put(BigInt(((var8 << 16) + var9) | 0), var10);
            }

            if (var7 !== null) {
                var10 = var7.AnimateModelWithExtra(var3, var2, var10, var5);
            }

            return var10;
        }

        if (var8 === 2) {
            const var10 = NpcType.List(var9).GetHeadModel(var7, var2, var3, var5);
            if (var10 === null) {
                IfType.resourceMissing = true;
                return null;
            }

            return var10;
        }

        if (var8 === 3) {
            if (var1 === null) {
                return null;
            }

            const var10 = var1.GetHeadModel(var2, var5, var7, var3);
            if (var10 === null) {
                IfType.resourceMissing = true;
                return null;
            }

            return var10;
        }

        if (var8 === 4) {
            const var10 = ObjType.List(var9);
            const var11 = var10.GetModelLit(var7, var3, 10, var5, var2);
            if (var11 === null) {
                IfType.resourceMissing = true;
                return null;
            }

            return var11;
        }

        if (var8 === 6) {
            const var10 = NpcType.List(var9).GetTempModel(null, var3, var7, 0, var2, var5, 0, 0, null);
            if (var10 === null) {
                IfType.resourceMissing = true;
                return null;
            }

            return var10;
        }

        if (var8 === 7) {
            if (var1 === null) {
                return null;
            }

            const var11 = this.modelId & 65535;
            const var12 = this.modelThirdKit;
            const var10 = this.modelId >>> 16;
            const var13 = var1.getKitHeadModel(var7, var5, var12, var3, var11, var10, var2);
            if (var13 === null) {
                IfType.resourceMissing = true;
                return null;
            }

            return var13;
        }

        return null;
    }

    // aj.b(ZI)Lvc; (NXT IfType::GetInvBackground, iftype.cpp:1121)
    // The inventory slot background sprite invSlotSprite[var2] (file 0 of the sprite archive), cached in m_spriteCache
    // under its sprite id. Null for a slot outside the table, a -1 entry or (setting resourceMissing) a sprite that is
    // not ready. Stripped: the boolean dummy var1. Its only caller (lf.a, javap offset 2516) passes true, so
    // `if (var1 != true) return null` (after resourceMissing is cleared) never runs.
    GetInvBackground(var2: number): AbstractSprite | null {
        IfType.resourceMissing = false;
        if (var2 < 0 || requireNonNull(this.invSlotSprite).length <= var2) {
            return null;
        }

        const var3 = arrayAtI32(this.invSlotSprite, var2);
        if (var3 === -1) {
            return null;
        }

        let var4 = IfType.m_spriteCache.Find(BigInt(var3));
        // checkcast vc (bytecode 60): a cached entry of another type throws before any archive access.
        if (var4 !== null && !(var4 instanceof AbstractSprite)) throw new TypeError('ClassCastException: not an AbstractSprite');
        if (var4 !== null) {
            return var4;
        }

        var4 = SpriteLoader.loadSprite2(IfType.m_pSprites, var3, 0);
        if (var4 !== null) {
            IfType.m_spriteCache.Put(BigInt(var3), var4);
        } else {
            IfType.resourceMissing = true;
        }

        return var4;
    }

    // aj.c(ZI)Lvc; (NXT IfType::GetGraphic, iftype.cpp:950)
    // The graphic (activeSprite when var1, else spriteId; file 0 of the sprite archive) with this component's
    // vFlip/hFlip, outline (trimPadded by the outline, then a black outline, plus a white one at outline >= 2) and
    // spriteShadow applied, cached in m_spriteCache under the 64-bit key (spriteShadow << 40) + (vFlip << 38) +
    // (outline << 36) + (spriteAlpha << 35) + id + (hFlip << 39) (wrapping long arithmetic). spriteAlpha selects the alpha-capable
    // loader. Null for id -1 or (setting resourceMissing) a sprite that is not ready. Stripped: the int dummy var2. Both
    // callers (lf.a at javap offsets 3843 and 4346) pass -72 and -62, so `if (var2 > -25) aj.b(21)` (a junk
    // verify-id packet) never runs.
    // HD be.a(BZ)Lqf;: the same body with the byte dummy first. Every caller passes -113, so its `!= -113` `return null`
    // after the load never runs. While tf.w is set the finished software sprite is wrapped in an el (GlAlphaSprite) when
    // it is an am (SoftwareAlphaSprite), otherwise in a cf (GlSprite), and the GL sprite is what gets cached.
    GetGraphic(var1: boolean): AbstractSprite | null {
        try {
            IfType.resourceMissing = false;
            let var3: number;
            if (var1) {
                var3 = this.activeSprite;
            } else {
                var3 = this.spriteId;
            }

            if (var3 === -1) {
                return null;
            }

            const var4 = BigInt.asIntN(64, (BigInt(this.spriteShadow) << 40n) + (((!this.vFlip ? 0n : 1n) << 38n) + (BigInt(this.outline) << 36n)) + (((!this.spriteAlpha ? 0n : 1n) << 35n) + (BigInt(var3) - -((this.hFlip ? 1n : 0n) << 39n))));
            let var6 = IfType.m_spriteCache.Find(var4);
            // checkcast vc (bytecode 124): a cached entry of another type throws before any archive access.
            if (var6 !== null && !(var6 instanceof AbstractSprite)) throw new TypeError('ClassCastException: not an AbstractSprite');
            if (var6 !== null) {
                return var6;
            }

            let var7: Pix32 | null;
            if (!this.spriteAlpha) {
                var7 = SpriteLoader.loadSoftwareSprite(IfType.m_pSprites, var3, 0);
            } else {
                var7 = SpriteLoader.loadSoftwareSpriteWithAlpha(0, IfType.m_pSprites, var3);
            }

            if (var7 === null) {
                IfType.resourceMissing = true;
                return null;
            }

            if (this.vFlip) {
                var7.vflip();
            }

            if (this.hFlip) {
                var7.hflip();
            }

            if (this.outline > 0) {
                var7.trimPadded(this.outline);
            }

            if (this.outline >= 1) {
                var7.outline(1);
            }

            // SD stores var6 = var7 here (before outline(16777215)); HD stores it after the shadow. Same local, same value.
            if (this.outline >= 2) {
                var7.outline(16777215);
            }

            if (this.spriteShadow !== 0) {
                var7.shadow(this.spriteShadow);
            }

            // HD be.a(BZ)Lqf;: qf2 = tf.w ? (!(mm2 instanceof am) ? new cf(mm2) : new el(mm2)) : mm2
            if (glJar && GlRenderer.active) {
                var6 = !(var7 instanceof SoftwareAlphaSprite) ? new (loadGlSprite())(var7) : new (loadGlAlphaSprite())(var7);
            } else {
                var6 = var7;
            }
            IfType.m_spriteCache.Put(var4, var6);
            return var6;
        } catch (error) {
            // HD be.a(BZ)Lqf; wraps its whole body, whatever tf.w is: throw gj.a(e, "be.O(" + dummy + ',' + var1 + ')'),
            // the dummy always -113. Its SD counterpart aj.c(ZI)Lvc; also wraps it (aj.N(var1,var2), bytecode 5-304),
            // but var2 is the stripped per-caller dummy (-72 or -62) and the SD port has never carried that context.
            if (!glJar || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'be.O(-113,' + var1 + ')');
        }
    }
}
