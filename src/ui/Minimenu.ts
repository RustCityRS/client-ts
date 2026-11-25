import { isJavaRuntimeException } from '#/util/JavaException';
import WrappedException from '#/util/WrappedException';
import JagString, { fromJsString, fromLiteral, hashTableInitStrings, toJsString } from '#/datastruct/JagString';
import GameShell from '#/client/GameShell';
import PresentationCamera from '#/gl/driver/PresentationCamera';
import { glJar } from '#/client/ClientVariant';
import MinimenuOps from './MinimenuOps';
import ClientMouseListener from '#/client/ClientMouseListener';
import ComponentDrag from './ComponentDrag';
import ClientKeyboardListener from '#/client/ClientKeyboardListener';
import { arrayAtB64, arrayAtI16, arrayAtI32, arrayAtObj, arrayPutB64, arrayPutI16, arrayPutI32, arrayPutObj, requireNonNull } from '#/util/JavaArray';
import ArrayUtils from '#/util/ArrayUtils';
import IfType from './IfType';

import HookReq from '#/script/HookReq';
import { runToCompletion } from '#/script/ScriptContinuation';
import ScriptRunner from '#/script/ScriptRunner';
import { ClientScript } from '#/script/ClientScript';
import type InterfaceSession from './InterfaceSession';
import InterfaceList from './InterfaceList';
import NpcType from '#/config/NpcType';
import type ClientPlayer from '#/dash3d/ClientPlayer';
import ReceivePlayerPositions from '#/client/ReceivePlayerPositions';
import ModelLit from '#/dash3d/ModelLit';
import Pix3D from '#/dash3d/Pix3D';
import world from '#/dash3d/world';
import { intDivide } from '#/util/IntUtils';
import LocType from '#/config/LocType';
import GameVariant from '#/client/GameVariant';
import Client from '#/client/Client';
import type AbstractSprite from '#/graphics/AbstractSprite';
import Pix32 from '#/graphics/Pix32';
import SoftwareAlphaSprite from '#/graphics/SoftwareAlphaSprite';
import ObjType from '#/config/ObjType';
import ParamType from '#/config/ParamType';
import LocalisedText from './LocalisedText';
import NativePix2D from '#/graphics/Pix2D';
import PixfontGeneric from '#/graphics/PixfontGeneric';
import SpriteLoader from '#/graphics/SpriteLoader';

const inventoryOps = [MinimenuOps.OPHELD1, MinimenuOps.OPHELD2, MinimenuOps.OPHELD3, MinimenuOps.OPHELD4, MinimenuOps.OPHELD5];
const inventoryComponentOps = [MinimenuOps.INV_BUTTON1, MinimenuOps.INV_BUTTON2, MinimenuOps.INV_BUTTON3, MinimenuOps.INV_BUTTON4, MinimenuOps.INV_BUTTON5];
const npcOps = [MinimenuOps.OPNPC1, MinimenuOps.OPNPC2, MinimenuOps.OPNPC3, MinimenuOps.OPNPC4, MinimenuOps.OPNPC5];
const locOps = [MinimenuOps.OPLOC1, MinimenuOps.OPLOC2, MinimenuOps.OPLOC3, MinimenuOps.OPLOC4, MinimenuOps.OPLOC5];

export interface MenuOption {
    nativeIndex?: number;
    label: string;
    secondary?: boolean;
    run(): void | boolean | Promise<void>;
}

// oi.b and the click bounds in the main game loop.
import JavaRandom from '#/util/JavaRandom';
import GlRendererClass from '#/gl/GlRenderer';
import { loadGlAlphaSprite, loadGlRaster, loadGlSprite } from '#/util/GamepackClasses';

// JVM checkcast mm permits null. The following cf/el constructor dereferences it.
function castSoftwareSprite(sprite: AbstractSprite | null): Pix32 | null {
    if (sprite !== null && !(sprite instanceof Pix32)) throw new TypeError('ClassCastException: not a Pix32');
    return sprite;
}

// SD pg.a / HD ob.a, in the order of ObjType.groundOps.
const groundObjActions = [MinimenuOps.OPOBJ1, MinimenuOps.OPOBJ2, MinimenuOps.OPOBJ3, MinimenuOps.OPOBJ4, MinimenuOps.OPOBJ5];

const draggableActions = [...inventoryComponentOps, ...inventoryOps, MinimenuOps.SELECT_OBJ, MinimenuOps.EXAMINE_HELD];
const interfaceActions = [
    ...inventoryOps,
    MinimenuOps.SELECT_OBJ,
    MinimenuOps.OPHELDU,
    MinimenuOps.OPHELDT,
    MinimenuOps.IF_BUTTONX,
    MinimenuOps.IF_BUTTONT,
    MinimenuOps.EXAMINE_HELD,
    MinimenuOps.IF_BUTTONX_LOW_PRIORITY,
    ...inventoryComponentOps,
    MinimenuOps.IF_BUTTON,
    MinimenuOps.SELECT_TARGET,
    MinimenuOps.IF_CLOSE,
    MinimenuOps.IF_TOGGLE,
    MinimenuOps.IF_SET,
    MinimenuOps.IF_CONTINUE
];

export default class Minimenu {
    static readonly tooltipRandom = new JavaRandom(); // bi.i:Ljava/util/Random;
    static readonly tooltipBounds = new Int32Array(4); // ed.g:[I
    static tooltipSeed = 0; // ei.s:I
    static readonly option = new Array<JagString | null>(500).fill(null); // ak.a:[Lid;
    static readonly target = new Array<JagString | null>(500).fill(null); // ph.e:[Lid;
    static readonly actions = new Int16Array(500); // p.u:[S
    static readonly paramB = new Int32Array(500); // mh.h:[I
    static readonly paramC = new Int32Array(500); // ml.x:[I
    static readonly cursor = new Int32Array(500); // ia.n:[I
    static readonly keys = new BigInt64Array(500); // sa.z:[J
    static count = 0; // vb.o:I
    static defaultCursor = -1; // aa.e:I
    static isOpen = false; // ie.F:Z
    static x = 0; // fl.i:I
    static y = 0; // hc.j:I
    static width = 0; // lk.u:I
    static height = 0; // client.C:I
    static spriteStyle = false; // ec.g:Z
    static backgroundColour = 0; // lj.j:I
    static transparency = 0; // d.p:I
    static highlightColour = 0; // jh.m:I
    static skinHoverAlpha = 0; // bc.i:I
    static skinTitleSpriteId = 0; // bi.k:I
    static skinTitleEndSprite = 0; // ah.e:I
    static bottomSpriteId = 0; // fd.ab:I
    static sideSpriteId = 0; // nh.O:I
    static skinBottomCornerSprite = 0; // bd.W:I
    static textColour = 0; // qi.U:I
    static skinHighlightTextColour = 0; // bj.h:I
    static spriteBottomCorner: AbstractSprite | null = null; // dd.i:Lvc;
    static titleBarSprite: AbstractSprite | null = null; // o.R:Lvc;
    static bottomEdgeSprite: AbstractSprite | null = null; // sc.N:Lvc;
    static skinTitleEndSprite2: AbstractSprite | null = null; // c.E:Lvc;
    static styleSideSprite: AbstractSprite | null = null; // ra.Q:Lvc;

    // SD sj.c(Z)V / HD j.g(-7878)V.
    static clearSprites(): void {
        if (glJar) {
            this.bottomEdgeSprite = null;
            this.titleBarSprite = null;
            this.styleSideSprite = null;
            this.skinTitleEndSprite2 = null;
            this.spriteBottomCorner = null;
        } else {
            this.spriteBottomCorner = null;
            this.titleBarSprite = null;
            this.bottomEdgeSprite = null;
            this.skinTitleEndSprite2 = null;
            this.styleSideSprite = null;
        }
    }
    static deferred = 0; // pk.k:I
    static deferredX = 0; // g.n:I
    static deferredY = 0; // ef.J:I
    static mouseX = 0; // ve.g:I
    static mouseY = 0; // ud.j:I
    static tooltipX = -1; // fd.Z:I
    static tooltipY = -1; // jb.ab:I
    static tooltipY2 = -1; // li.y:I
    static tooltipComponent: IfType | null = null; // nk.V:Laj;
    static tooltipX2 = -1; // oi.g:I
    static shiftClick = false; // pb.sc:Z
    static readonly tooltipMoreSeparator = fromLiteral('<col=ffffff> )4 '); // n.k:Lid;
    static readonly playerOption = new Array<JagString | null>(8).fill(null); // bk.ic:[Lid;
    static readonly playerSecondary = new Array<boolean>(8).fill(false); // oe.A:[Z
    static readonly playerCursor = new Int32Array(8); // la.jb:[I
    static readonly playerAction = Int16Array.of(MinimenuOps.OPPLAYER1, MinimenuOps.OPPLAYER2, MinimenuOps.OPPLAYER3, MinimenuOps.OPPLAYER4, MinimenuOps.OPPLAYER5, MinimenuOps.OPPLAYER6, MinimenuOps.OPPLAYER7, MinimenuOps.OPPLAYER8); // HD af.l:[S / SD vj.o:[S
    static walkHere: JagString | null = null; // nh.ab:Lid;
    static crossX = 0; // sb.a:I
    static crossY = 0; // kg.K:I
    static crossMode = 0; // df.J:I
    static crossTicks = 0; // jh.r:I
    static readonly locColour = fromLiteral('<col=00ffff>'); // hd.p:Lid;
    static readonly yellow = fromLiteral('<col=ffff00>'); // pj.G:Lid;
    static readonly locArrow = fromLiteral(' )2> <col=00ffff>'); // d.m:Lid;
    static readonly npcArrow = fromLiteral(' )2> <col=ffff00>'); // ab.N:Lid;
    static readonly playerArrow = fromLiteral(' )2> <col=ffffff>'); // ti.Q:Lid;
    static readonly groundArrow = fromLiteral(' )2>'); // t.bb:Lid;
    static readonly openParen = fromLiteral(' (X'); // ia.i:Lid;
    static readonly closeParen = fromLiteral('(Y'); // tb.A:Lid;
    static readonly plus = fromLiteral(')0'); // qe.T:Lid;
    static readonly red = fromLiteral('<col=ff0000>'); // li.s:Lid;
    static readonly redOrange = fromLiteral('<col=ff3000>'); // ic.P:Lid;
    static readonly orangeRed = fromLiteral('<col=ff7000>'); // lj.g:Lid;
    static readonly amber = fromLiteral('<col=ffb000>'); // wj.d:Lid;
    static readonly lime = hashTableInitStrings.lime; // gk.f:Lid;
    static readonly chartreuse = fromLiteral('<col=80ff00>'); // th.k:Lid;
    static readonly yellowGreen = fromLiteral('<col=c0ff00>'); // tb.i:Lid;
    static highlightTicks = 0; // u.q:I
    static highlightComponent: IfType | null = null; // m.G:Laj;
    static highlightSlot = 0; // ki.O:I
    static readonly countSeparator = fromLiteral(' x '); // af.D:Lid;
    static targetMode = false; // ok.r:Z
    static targetVerb: JagString | null = null; // t.W:Lid;
    static targetName: JagString | null = null; // al.s:Lid;
    static targetComponent = 0; // qe.W:I
    static targetChild = -1; // gh.Y:I
    static targetCursor = 0; // ce.D:I
    static targetFlags = 0; // pj.C:I
    static targetParam = 0; // oh.a:I
    static objSelected = 0; // le.c:I
    static objSlot = 0; // ph.h:I
    static objComponent = 0; // ti.X:I
    static objId = 0; // gl.A:I
    static objName: JagString | null = null; // ge.Z:Lid;
    static objCursor = -1; // gl.C:I
    static examineCursor = -1; // me.P:I
    static objDragComponent: IfType | null = null; // ec.e:Laj;
    static objDragCycles = 0; // ej.b:I
    static objDragMoved = false; // te.c:Z
    static objDragSlot = 0; // vj.u:I
    static objGrabX = 0; // gl.y:I
    static objGrabY = 0; // bd.S:I
    static hoverSlot = 0; // oj.i:I
    static showOpIndices = false; // kl.p:Z
    static readonly orange = fromLiteral('<col=ff9040>'); // f.j:Lid;
    static readonly green = fromLiteral('<col=00ff00>'); // nk.O:Lid;
    static readonly white = fromLiteral('<col=ffffff>'); // uc.g:Lid;
    static readonly targetArrow = fromLiteral(' )2> '); // fk.N:Lid;
    static readonly objArrow = fromLiteral(' )2> <col=ff9040>'); // vb.m:Lid;
    static readonly hidden = fromLiteral('Hidden)2'); // fd.S:Lid;
    static readonly hiddenUse = fromLiteral('Hidden)2use'); // bf.E:Lid;
    static readonly opIndexSeparator = fromLiteral(': '); // oi.c:Lid;
    static readonly nullTargetVerb = fromLiteral('Null'); // nl.X:Lid;
    private get x(): number {
        return Minimenu.x;
    }
    private set x(value: number) {
        Minimenu.x = value;
    }
    private get y(): number {
        return Minimenu.y;
    }
    private set y(value: number) {
        Minimenu.y = value;
    }
    private get width(): number {
        return Minimenu.width;
    }
    private set width(value: number) {
        Minimenu.width = value;
    }
    private get height(): number {
        return Minimenu.height;
    }
    private set height(value: number) {
        Minimenu.height = value;
    }
    private displayEntries: MenuOption[] = [];
    private displayNative = false;
    private get entries(): MenuOption[] {
        return this.displayEntries;
    }
    private set entries(rows: MenuOption[]) {
        this.displayNative = false;
        this.displayEntries = rows;
        Minimenu.isOpen = rows.length !== 0;
    }
    constructor(private readonly font: PixfontGeneric) {}

    get open(): boolean {
        return Minimenu.isOpen;
    }
    get sceneMenuOpen(): boolean {
        return !this.displayNative && this.displayEntries.length !== 0 && Minimenu.isOpen;
    }
    clear(): void {
        this.entries = [];
        Minimenu.count = 0;
    }

    showNative(): void {
        this.displayNative = true;
    }

    pollNative(ui?: InterfaceSession): void | Promise<void> {
        const pending = Minimenu.GameLoop(ui);
        const finish = () => {
            this.displayNative = Minimenu.isOpen;
        };
        if (pending instanceof Promise) return pending.then(finish);
        finish();
    }

    // SD re.a(IBIIIII)V / HD ub.b(IIIIIII)V. NXT Minimenu::EnterTargetMode.
    static EnterTargetMode(defaultCursor: number, child: number, cursor: number, id: number, param: number, flags: number, runner?: Pick<ScriptRunner, 'run'>): void | Promise<void> {
        const c = InterfaceList.GetComponent(id, child);
        const finish = () => {
            if (glJar) {
                Minimenu.targetChild = child;
                Minimenu.targetParam = param;
                Minimenu.targetComponent = id;
                Minimenu.targetFlags = flags;
                Minimenu.targetMode = true;
                Minimenu.targetCursor = cursor;
            } else {
                Minimenu.targetParam = param;
                Minimenu.targetChild = child;
                Minimenu.targetComponent = id;
                Minimenu.targetFlags = flags;
                Minimenu.targetCursor = cursor;
                Minimenu.targetMode = true;
            }
            Minimenu.defaultCursor = defaultCursor;
            Client.ComponentUpdated(requireNonNull(c));
        };
        if (c !== null && c.onTargetEnter !== null) {
            const event = new HookReq();
            if (glJar) {
                event.component = c;
                event.args = c.onTargetEnter;
            } else {
                event.args = c.onTargetEnter;
                event.component = c;
            }
            const pending = (runner ?? Client.activeClient?.ui?.runner ?? new ScriptRunner(ClientScript.Get)).run(event);
            if (pending instanceof Promise) return pending.then(finish);
        }
        finish();
    }

    // SD kl.d(I)V / HD ec.a(B)V. NXT Minimenu::EndTargetMode.
    static EndTargetMode(runner?: Pick<ScriptRunner, 'run'>): void | Promise<void> {
        if (!Minimenu.targetMode) return;
        const c = InterfaceList.GetComponent(Minimenu.targetComponent, Minimenu.targetChild);
        const finish = () => {
            Minimenu.targetMode = false;
            Minimenu.defaultCursor = -1;
            Client.ComponentUpdated(requireNonNull(c));
        };
        if (c !== null && c.onTargetLeave !== null) {
            const event = new HookReq();
            if (glJar) {
                event.args = c.onTargetLeave;
                event.component = c;
            } else {
                event.component = c;
                event.args = c.onTargetLeave;
            }
            const pending = (runner ?? Client.activeClient?.ui?.runner ?? new ScriptRunner(ClientScript.Get)).run(event);
            if (pending instanceof Promise) return pending.then(finish);
        }
        finish();
    }

    // HD ij.a(116)V. Each tf.w test observes the current renderer after the preceding calls.
    private static DrawSpriteMenuHd(): void {
        try {
            const x = Minimenu.x;
            const y = Minimenu.y;
            const height = Minimenu.height;
            const width = Minimenu.width;
            const GlRenderer = GlRendererClass;
            const GlRaster = loadGlRaster();
            const GlSprite = loadGlSprite();
            const GlAlphaSprite = loadGlAlphaSprite();

            if (Minimenu.titleBarSprite === null || Minimenu.skinTitleEndSprite2 === null) {
                if (requireNonNull(Client.m_pSprites).RequestDownload2(Minimenu.skinTitleSpriteId) && requireNonNull(Client.m_pSprites).RequestDownload2(Minimenu.skinTitleEndSprite)) {
                    Minimenu.titleBarSprite = SpriteLoader.loadSoftwareSpriteWithAlpha(0, Client.m_pSprites, Minimenu.skinTitleSpriteId);
                    Minimenu.skinTitleEndSprite2 = SpriteLoader.loadSoftwareSpriteWithAlpha(0, Client.m_pSprites, Minimenu.skinTitleEndSprite);
                    if (GlRenderer.active) {
                        Minimenu.titleBarSprite = Minimenu.titleBarSprite instanceof SoftwareAlphaSprite ? new GlAlphaSprite(castSoftwareSprite(Minimenu.titleBarSprite)) : new GlSprite(castSoftwareSprite(Minimenu.titleBarSprite));
                        Minimenu.skinTitleEndSprite2 = Minimenu.skinTitleEndSprite2 instanceof SoftwareAlphaSprite ? new GlAlphaSprite(castSoftwareSprite(Minimenu.skinTitleEndSprite2)) : new GlSprite(castSoftwareSprite(Minimenu.skinTitleEndSprite2));
                    }
                } else {
                    (GlRenderer.active ? GlRaster : NativePix2D).fillRectTrans(x, y, width, 20, Minimenu.backgroundColour, (256 - Minimenu.transparency) | 0);
                }
            }
            if (Minimenu.titleBarSprite !== null && Minimenu.skinTitleEndSprite2 !== null) {
                const tiles = intDivide(width, Minimenu.titleBarSprite.width);
                for (let i = 0; i < tiles; i++) {
                    Minimenu.titleBarSprite.draw((Math.imul(i, Minimenu.titleBarSprite.width) + x) | 0, y);
                }
                Minimenu.skinTitleEndSprite2.draw(x, y);
                Minimenu.skinTitleEndSprite2.drawHFlip((x + width - Minimenu.skinTitleEndSprite2.width) | 0, y);
            }
            const titleFont = Client.fontBold12;
            const titleText = LocalisedText.chooseOption;
            const titleColour = Minimenu.textColour;
            requireNonNull(titleFont).drawLeft(titleText, (x + 3) | 0, (14 + y) | 0, titleColour, -1);
            (GlRenderer.active ? GlRaster : NativePix2D).fillRectTrans(x, (20 + y) | 0, width, (height - 20) | 0, Minimenu.backgroundColour, (256 - Minimenu.transparency) | 0);
            const mouseY = ClientMouseListener.mouseY;
            const mouseX = ClientMouseListener.x;
            for (let i = 0; i < Minimenu.count; i++) {
                const baseline = (Math.imul(Minimenu.count - i - 1, 15) + y + 35) | 0;
                if (x < mouseX && mouseX < ((x + width) | 0) && ((baseline - 13) | 0) < mouseY && mouseY < ((baseline + 3) | 0)) {
                    (GlRenderer.active ? GlRaster : NativePix2D).fillRectTrans(x, (baseline - 13) | 0, width, 16, Minimenu.highlightColour, (256 - Minimenu.skinHoverAlpha) | 0);
                }
            }
            if (
                (Minimenu.bottomEdgeSprite === null || Minimenu.styleSideSprite === null || Minimenu.spriteBottomCorner === null) &&
                requireNonNull(Client.m_pSprites).RequestDownload2(Minimenu.bottomSpriteId) &&
                requireNonNull(Client.m_pSprites).RequestDownload2(Minimenu.sideSpriteId) &&
                requireNonNull(Client.m_pSprites).RequestDownload2(Minimenu.skinBottomCornerSprite)
            ) {
                Minimenu.bottomEdgeSprite = SpriteLoader.loadSoftwareSpriteWithAlpha(0, Client.m_pSprites, Minimenu.bottomSpriteId);
                Minimenu.styleSideSprite = SpriteLoader.loadSoftwareSpriteWithAlpha(0, Client.m_pSprites, Minimenu.sideSpriteId);
                Minimenu.spriteBottomCorner = SpriteLoader.loadSoftwareSpriteWithAlpha(0, Client.m_pSprites, Minimenu.skinBottomCornerSprite);
                if (GlRenderer.active) {
                    Minimenu.bottomEdgeSprite = Minimenu.bottomEdgeSprite instanceof SoftwareAlphaSprite ? new GlAlphaSprite(castSoftwareSprite(Minimenu.bottomEdgeSprite)) : new GlSprite(castSoftwareSprite(Minimenu.bottomEdgeSprite));
                    Minimenu.styleSideSprite = Minimenu.styleSideSprite instanceof SoftwareAlphaSprite ? new GlAlphaSprite(castSoftwareSprite(Minimenu.styleSideSprite)) : new GlSprite(castSoftwareSprite(Minimenu.styleSideSprite));
                    Minimenu.spriteBottomCorner = Minimenu.spriteBottomCorner instanceof SoftwareAlphaSprite ? new GlAlphaSprite(castSoftwareSprite(Minimenu.spriteBottomCorner)) : new GlSprite(castSoftwareSprite(Minimenu.spriteBottomCorner));
                }
            }
            if (Minimenu.bottomEdgeSprite !== null && Minimenu.styleSideSprite !== null && Minimenu.spriteBottomCorner !== null) {
                const bottomTiles = intDivide(width, Minimenu.bottomEdgeSprite.width);
                for (let i = 0; i < bottomTiles; i++) {
                    Minimenu.bottomEdgeSprite.draw((x + Math.imul(Minimenu.bottomEdgeSprite.width, i)) | 0, (height + y - Minimenu.bottomEdgeSprite.height) | 0);
                }
                const sideTiles = intDivide((height - 20) | 0, Minimenu.styleSideSprite.height);
                for (let i = 0; i < sideTiles; i++) {
                    Minimenu.styleSideSprite.draw(x, (y + 20 + Math.imul(i, Minimenu.styleSideSprite.height)) | 0);
                    Minimenu.styleSideSprite.drawHFlip((x + width - Minimenu.styleSideSprite.width) | 0, (y + 20 + Math.imul(i, Minimenu.styleSideSprite.height)) | 0);
                }
                Minimenu.spriteBottomCorner.draw(x, (height + y - Minimenu.spriteBottomCorner.height) | 0);
                Minimenu.spriteBottomCorner.drawHFlip((x + width - Minimenu.spriteBottomCorner.width) | 0, (y + height - Minimenu.spriteBottomCorner.height) | 0);
            }
            for (let i = 0; i < Minimenu.count; i++) {
                const baseline = (Math.imul(Minimenu.count - 1 - i, 15) + y + 35) | 0;
                let colour = Minimenu.textColour;
                if (x < mouseX && ((width + x) | 0) > mouseX && ((baseline - 13) | 0) < mouseY && mouseY < ((baseline + 3) | 0)) {
                    colour = Minimenu.skinHighlightTextColour;
                }
                const font = Client.fontBold12;
                const text = Minimenu.label(i);
                requireNonNull(font).drawLeft(text, (3 + x) | 0, baseline, colour, 0);
            }
            const menuX = Minimenu.x;
            const menuY = Minimenu.y;
            const menuHeight = Minimenu.height;
            InterfaceList.redrawArea(menuY, menuHeight, Minimenu.width, menuX);
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'ij.F(116)');
        }
    }

    // SD wh.e(-18)V.
    static DrawSpriteMenu(): void {
        if (glJar) return Minimenu.DrawSpriteMenuHd();
        const x = Minimenu.x,
            y = Minimenu.y,
            width = Minimenu.width,
            height = Minimenu.height;
        if (Minimenu.titleBarSprite === null || Minimenu.skinTitleEndSprite2 === null) {
            if (requireNonNull(Client.m_pSprites).RequestDownload2(Minimenu.skinTitleSpriteId) && requireNonNull(Client.m_pSprites).RequestDownload2(Minimenu.skinTitleEndSprite)) {
                Minimenu.titleBarSprite = SpriteLoader.loadSoftwareSpriteWithAlpha(0, Client.m_pSprites, Minimenu.skinTitleSpriteId);
                Minimenu.skinTitleEndSprite2 = SpriteLoader.loadSoftwareSpriteWithAlpha(0, Client.m_pSprites, Minimenu.skinTitleEndSprite);
            } else {
                NativePix2D.fillRectTrans(x, y, width, 20, Minimenu.backgroundColour, (256 - Minimenu.transparency) | 0);
            }
        }
        if (Minimenu.titleBarSprite !== null && Minimenu.skinTitleEndSprite2 !== null) {
            const tiles = intDivide(width, Minimenu.titleBarSprite.width);
            for (let i = 0; i < tiles; i++) {
                Minimenu.titleBarSprite.draw((x + Math.imul(i, Minimenu.titleBarSprite.width)) | 0, y);
            }
            Minimenu.skinTitleEndSprite2.draw(x, y);
            Minimenu.skinTitleEndSprite2.drawHFlip((x + width - Minimenu.skinTitleEndSprite2.width) | 0, y);
        }
        requireNonNull(Client.fontBold12).drawLeft(LocalisedText.chooseOption, (x + 3) | 0, (y + 14) | 0, Minimenu.textColour, -1);
        NativePix2D.fillRectTrans(x, (y + 20) | 0, width, (height - 20) | 0, Minimenu.backgroundColour, (256 - Minimenu.transparency) | 0);
        const mouseX = ClientMouseListener.x,
            mouseY = ClientMouseListener.mouseY;
        for (let i = 0; i < Minimenu.count; i++) {
            const baseline = (y + 35 + Math.imul(15, Minimenu.count - 1 - i)) | 0;
            if (x < mouseX && mouseX < ((width + x) | 0) && ((baseline - 13) | 0) < mouseY && ((baseline + 3) | 0) > mouseY) {
                NativePix2D.fillRectTrans(x, (baseline - 13) | 0, width, 16, Minimenu.highlightColour, (256 - Minimenu.skinHoverAlpha) | 0);
            }
        }
        if (
            (Minimenu.bottomEdgeSprite === null || Minimenu.styleSideSprite === null || Minimenu.spriteBottomCorner === null) &&
            requireNonNull(Client.m_pSprites).RequestDownload2(Minimenu.bottomSpriteId) &&
            requireNonNull(Client.m_pSprites).RequestDownload2(Minimenu.sideSpriteId) &&
            requireNonNull(Client.m_pSprites).RequestDownload2(Minimenu.skinBottomCornerSprite)
        ) {
            Minimenu.bottomEdgeSprite = SpriteLoader.loadSoftwareSpriteWithAlpha(0, Client.m_pSprites, Minimenu.bottomSpriteId);
            Minimenu.styleSideSprite = SpriteLoader.loadSoftwareSpriteWithAlpha(0, Client.m_pSprites, Minimenu.sideSpriteId);
            Minimenu.spriteBottomCorner = SpriteLoader.loadSoftwareSpriteWithAlpha(0, Client.m_pSprites, Minimenu.skinBottomCornerSprite);
        }
        if (Minimenu.bottomEdgeSprite !== null && Minimenu.styleSideSprite !== null && Minimenu.spriteBottomCorner !== null) {
            const bottomTiles = intDivide(width, Minimenu.bottomEdgeSprite.width);
            for (let i = 0; i < bottomTiles; i++) {
                Minimenu.bottomEdgeSprite.draw((Math.imul(Minimenu.bottomEdgeSprite.width, i) + x) | 0, (y + height - Minimenu.bottomEdgeSprite.height) | 0);
            }
            const sideTiles = intDivide((height - 20) | 0, Minimenu.styleSideSprite.height);
            for (let i = 0; i < sideTiles; i++) {
                Minimenu.styleSideSprite.draw(x, (20 + y + Math.imul(Minimenu.styleSideSprite.height, i)) | 0);
                Minimenu.styleSideSprite.drawHFlip((width + x - Minimenu.styleSideSprite.width) | 0, (20 + y + Math.imul(i, Minimenu.styleSideSprite.height)) | 0);
            }
            Minimenu.spriteBottomCorner.draw(x, (y + height - Minimenu.spriteBottomCorner.height) | 0);
            Minimenu.spriteBottomCorner.drawHFlip((width + x - Minimenu.spriteBottomCorner.width) | 0, (height + y - Minimenu.spriteBottomCorner.height) | 0);
        }
        for (let i = 0; i < Minimenu.count; i++) {
            const baseline = (Math.imul(Minimenu.count - i - 1, 15) + y + 35) | 0;
            let colour = Minimenu.textColour;
            if (mouseX > x && ((width + x) | 0) > mouseX && mouseY > ((baseline - 13) | 0) && ((3 + baseline) | 0) > mouseY) {
                colour = Minimenu.skinHighlightTextColour;
            }
            const font = Client.fontBold12;
            const label = Minimenu.label(i);
            requireNonNull(font).drawLeft(label, (x + 3) | 0, baseline, colour, 0);
        }
        InterfaceList.redrawArea(Minimenu.y, Minimenu.height, Minimenu.width, Minimenu.x);
    }

    // SD gf.e(B)V / HD ha.a(I)V, cancel row and mouse position before the top-level interface is drawn.
    // NXT names this part of the draw pass Minimenu::ResetMinimenu.
    static ResetMinimenu(): void {
        if (!Minimenu.isOpen) {
            if (glJar) {
                if (Minimenu.deferred !== 0) {
                    Minimenu.mouseX = Minimenu.deferredX;
                    Minimenu.mouseY = Minimenu.deferredY;
                } else if (ClientMouseListener.clickButton === 0) {
                    Minimenu.mouseX = ClientMouseListener.x;
                    Minimenu.mouseY = ClientMouseListener.mouseY;
                } else {
                    Minimenu.mouseX = ClientMouseListener.clickX;
                    Minimenu.mouseY = ClientMouseListener.clickY;
                }
                Minimenu.count = 1;
                arrayPutObj(Minimenu.option, 0, LocalisedText.cancel);
                arrayPutObj(Minimenu.target, 0, JagString.empty);
                arrayPutI16(Minimenu.actions, 0, MinimenuOps.CANCEL);
                arrayPutI32(Minimenu.cursor, 0, Minimenu.defaultCursor);
                return;
            }
            arrayPutI16(Minimenu.actions, 0, MinimenuOps.CANCEL);
            Minimenu.count = 1;
            arrayPutI32(Minimenu.cursor, 0, Minimenu.defaultCursor);
            if (Minimenu.deferred !== 0) {
                Minimenu.mouseX = Minimenu.deferredX;
                Minimenu.mouseY = Minimenu.deferredY;
            } else if (ClientMouseListener.clickButton === 0) {
                Minimenu.mouseY = ClientMouseListener.mouseY;
                Minimenu.mouseX = ClientMouseListener.x;
            } else {
                Minimenu.mouseY = ClientMouseListener.clickY;
                Minimenu.mouseX = ClientMouseListener.clickX;
            }
            arrayPutObj(Minimenu.option, 0, LocalisedText.cancel);
            arrayPutObj(Minimenu.target, 0, JagString.empty);
        }
    }

    // tb.a(BLid;SLid;IIJI)V. NXT Minimenu::AddEntry.
    static AddEntry(target: JagString | null, action: number, option: JagString | null, paramB: number, paramC: number, key: bigint, cursor: number): void {
        if (!Minimenu.isOpen && Minimenu.count < 500) {
            arrayPutObj(Minimenu.option, Minimenu.count, option);
            arrayPutObj(Minimenu.target, Minimenu.count, target);
            arrayPutI32(Minimenu.cursor, Minimenu.count, cursor !== -1 ? cursor : Minimenu.defaultCursor);
            arrayPutI16(Minimenu.actions, Minimenu.count, action);
            arrayPutB64(Minimenu.keys, Minimenu.count, key);
            arrayPutI32(Minimenu.paramB, Minimenu.count, paramB);
            arrayPutI32(Minimenu.paramC, Minimenu.count, paramC);
            Minimenu.count = (Minimenu.count + 1) | 0;
        }
    }

    // ti.f(I)V. NXT Minimenu::Sort.
    static Sort(): void {
        try {
            let done: boolean;
            do {
                done = true;
                for (let i = 0; i < ((Minimenu.count - 1) | 0); i++) {
                    const next = (i + 1) | 0;
                    if (arrayAtI16(Minimenu.actions, i) < 1000 && arrayAtI16(Minimenu.actions, next) > 1000) {
                        done = false;
                        const target = arrayAtObj(Minimenu.target, i);
                        arrayPutObj(Minimenu.target, i, arrayAtObj(Minimenu.target, next));
                        arrayPutObj(Minimenu.target, next, target);
                        const option = arrayAtObj(Minimenu.option, i);
                        arrayPutObj(Minimenu.option, i, arrayAtObj(Minimenu.option, next));
                        arrayPutObj(Minimenu.option, next, option);
                        const b = arrayAtI32(Minimenu.paramB, i);
                        arrayPutI32(Minimenu.paramB, i, arrayAtI32(Minimenu.paramB, next));
                        arrayPutI32(Minimenu.paramB, next, b);
                        const c = arrayAtI32(Minimenu.paramC, i);
                        arrayPutI32(Minimenu.paramC, i, arrayAtI32(Minimenu.paramC, next));
                        arrayPutI32(Minimenu.paramC, next, c);
                        const cursor = arrayAtI32(Minimenu.cursor, i);
                        arrayPutI32(Minimenu.cursor, i, arrayAtI32(Minimenu.cursor, next));
                        arrayPutI32(Minimenu.cursor, next, cursor);
                        const action = arrayAtI16(Minimenu.actions, i);
                        arrayPutI16(Minimenu.actions, i, arrayAtI16(Minimenu.actions, next));
                        arrayPutI16(Minimenu.actions, next, action);
                        const key = arrayAtB64(Minimenu.keys, i);
                        arrayPutB64(Minimenu.keys, i, arrayAtB64(Minimenu.keys, next));
                        arrayPutB64(Minimenu.keys, next, key);
                    }
                }
            } while (!done);
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, glJar ? 'wl.D(122)' : 'ti.A(-62)');
        }
    }

    // SD vk.a(IZ)V / HD qe.b(II)V
    static remove(index: number, onlyLabelsAndCursor = false): void {
        Minimenu.count = (Minimenu.count - 1) | 0;
        if (index !== Minimenu.count) {
            const next = (index + 1) | 0;
            ArrayUtils.copyObjects(Minimenu.option, next, Minimenu.option, index, (Minimenu.count - index) | 0);
            ArrayUtils.copyObjects(Minimenu.target, next, Minimenu.target, index, (Minimenu.count - index) | 0);
            ArrayUtils.copyInts(Minimenu.cursor, next, Minimenu.cursor, index, (Minimenu.count - index) | 0);
            if (glJar || !onlyLabelsAndCursor) {
                ArrayUtils.copyShorts(Minimenu.actions, next, Minimenu.actions, index, (Minimenu.count - index) | 0);
                ArrayUtils.copyLongs(Minimenu.keys, next, Minimenu.keys, index, (Minimenu.count - index) | 0);
                ArrayUtils.copyInts(Minimenu.paramB, next, Minimenu.paramB, index, (Minimenu.count - index) | 0);
                ArrayUtils.copyInts(Minimenu.paramC, next, Minimenu.paramC, index, (Minimenu.count - index) | 0);
            }
        }
    }

    // o.a(IS)Z
    static IsInterfaceEntry(action: number): boolean {
        return interfaceActions.includes(action);
    }

    // re.a(IB)Z. NXT Minimenu::MenuOnly.
    // HD wi.c(II)Z compares the second argument to the action index before reading the menu.
    static MenuOnly(index: number, minimum = 0): boolean {
        if (index < minimum) return false;
        let action = arrayAtI16(this.actions, index);
        if (action >= 2000) action -= 2000;
        return action === MinimenuOps.IF_BUTTONX_LOW_PRIORITY;
    }

    // HD lf.b(-117)V
    private static DrawHd(): void {
        try {
            const y = Minimenu.y;
            const width = Minimenu.width;
            const x = Minimenu.x;
            const colour = 6116423;
            const height = Minimenu.height;
            const GlRenderer = GlRendererClass;
            const raster = GlRenderer.active ? loadGlRaster() : NativePix2D;
            raster.fillRect(x, y, width, height, colour);
            raster.fillRect((1 + x) | 0, (1 + y) | 0, (width - 2) | 0, 16, 0);
            raster.drawRect((1 + x) | 0, (y + 18) | 0, (width - 2) | 0, (height - 19) | 0, 0);
            const titleFont = Client.fontBold12;
            const title = LocalisedText.chooseOption;
            requireNonNull(titleFont).drawLeft(title, (x + 3) | 0, (y + 14) | 0, colour, -1);
            const mouseY = ClientMouseListener.mouseY;
            const mouseX = ClientMouseListener.x;
            for (let i = 0; i < Minimenu.count; i++) {
                const baseline = (Math.imul(-i + (-1 + Minimenu.count), 15) + y + 31) | 0;
                let textColour = 0xffffff;
                if (x < mouseX && mouseX < ((x + width) | 0) && ((baseline - 13) | 0) < mouseY && mouseY < ((baseline + 3) | 0)) textColour = 0xffff00;
                const font = Client.fontBold12;
                const label = Minimenu.label(i);
                requireNonNull(font).drawLeft(label, (x + 3) | 0, baseline, textColour, 0);
            }
            const menuX = Minimenu.x;
            const menuY = Minimenu.y;
            const menuHeight = Minimenu.height;
            InterfaceList.redrawArea(menuY, menuHeight, Minimenu.width, menuX);
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'lf.A(-117)');
        }
    }

    // SD oi.b(B)V. NXT Minimenu::Draw.
    static Draw(): void {
        if (glJar) return Minimenu.DrawHd();
        const y = Minimenu.y;
        const x = Minimenu.x;
        const width = Minimenu.width;
        const colour = 6116423;
        const height = Minimenu.height;
        NativePix2D.fillRect(x, y, width, height, colour);
        NativePix2D.fillRect((x + 1) | 0, (y + 1) | 0, (width - 2) | 0, 16, 0);
        NativePix2D.drawRect((x + 1) | 0, (y + 18) | 0, (width - 2) | 0, (height - 19) | 0, 0);
        const titleFont = Client.fontBold12;
        const title = LocalisedText.chooseOption;
        requireNonNull(titleFont).drawLeft(title, (x + 3) | 0, (y + 14) | 0, colour, -1);
        const mouseX = ClientMouseListener.x;
        const mouseY = ClientMouseListener.mouseY;
        for (let index = 0; index < Minimenu.count; index++) {
            const baseline = (Math.imul(15, (Minimenu.count - index - 1) | 0) + 31 + y) | 0;
            let textColour = 16777215;
            if (x < mouseX && mouseX < ((width + x) | 0) && ((baseline - 13) | 0) < mouseY && mouseY < ((baseline + 3) | 0)) {
                textColour = 16776960;
            }
            const font = Client.fontBold12;
            const text = Minimenu.label(index);
            requireNonNull(font).drawLeft(text, (x + 3) | 0, baseline, textColour, 0);
        }
        InterfaceList.redrawArea(Minimenu.y, Minimenu.height, Minimenu.width, Minimenu.x);
    }

    // ii.a(ILaj;IB)V. NXT Minimenu::DrawFeedbackText.
    static DrawFeedbackText(x: number, component: IfType | null, y: number, hdGuard = -86): void {
        if (glJar) {
            try {
                if (Minimenu.count < 2 && Minimenu.objSelected === 0 && !Minimenu.targetMode) return;
                const text = Minimenu.getTooltip();
                if (component === null) {
                    const font = Client.fontBold12;
                    const random = Minimenu.tooltipRandom,
                        seed = Minimenu.tooltipSeed;
                    const extra = requireNonNull(font).drawRandom(text, (4 + x) | 0, (y + 15) | 0, 0xffffff, 0, random, seed);
                    const width = (requireNonNull(Client.fontBold12).stringWidth(text) + extra) | 0;
                    InterfaceList.invalidateArea(15, (4 + x) | 0, width, y);
                } else {
                    const font = component.GetFont(PixfontGeneric.nameIcons) ?? Client.fontBold12;
                    const width = component.width,
                        height = component.height,
                        colour = component.colour;
                    const shadow = component.spriteShadow,
                        horizontal = component.textAlignH,
                        vertical = component.textAlignV;
                    const random = Minimenu.tooltipRandom,
                        seed = Minimenu.tooltipSeed,
                        bounds = Minimenu.tooltipBounds;
                    requireNonNull(font).drawRandomAligned(text, x, y, width, height, colour, shadow, horizontal, vertical, random, seed, bounds);
                    const left = arrayAtI32(Minimenu.tooltipBounds, 0);
                    const dirtyWidth = arrayAtI32(Minimenu.tooltipBounds, 2);
                    const top = arrayAtI32(Minimenu.tooltipBounds, 1);
                    const dirtyHeight = arrayAtI32(Minimenu.tooltipBounds, 3);
                    InterfaceList.invalidateArea(dirtyHeight, left, dirtyWidth, top);
                }
            } catch (error) {
                if (!isJavaRuntimeException(error)) throw error;
                throw WrappedException.wrap(error, 'dm.D(' + (component === null ? 'null' : '{...}') + ',' + hdGuard + ',' + y + ',' + x + ')');
            }
            return;
        }
        if (Minimenu.count < 2 && Minimenu.objSelected === 0 && !Minimenu.targetMode) return;
        const text = Minimenu.getTooltip();
        if (component !== null) {
            let font = component.GetFont(PixfontGeneric.nameIcons);
            if (font === null) font = Client.fontBold12;
            const width = component.width;
            const height = component.height;
            const colour = component.colour;
            const shadow = component.spriteShadow;
            const horizontal = component.textAlignH;
            const vertical = component.textAlignV;
            const random = Minimenu.tooltipRandom;
            const seed = Minimenu.tooltipSeed;
            const bounds = Minimenu.tooltipBounds;
            requireNonNull(font).drawRandomAligned(text, x, y, width, height, colour, shadow, horizontal, vertical, random, seed, bounds);
            InterfaceList.invalidateArea(arrayAtI32(Minimenu.tooltipBounds, 3), arrayAtI32(Minimenu.tooltipBounds, 0), arrayAtI32(Minimenu.tooltipBounds, 2), arrayAtI32(Minimenu.tooltipBounds, 1));
        } else {
            const font = Client.fontBold12;
            const random = Minimenu.tooltipRandom;
            const seed = Minimenu.tooltipSeed;
            const extra = requireNonNull(font).drawRandom(text, (4 + x) | 0, (15 + y) | 0, 16777215, 0, random, seed);
            InterfaceList.invalidateArea(15, (x + 4) | 0, (extra + requireNonNull(Client.fontBold12).stringWidth(text)) | 0, y);
        }
    }

    // ja.a(IB)Lid;
    static label(index: number): JagString | null {
        const target = requireNonNull(arrayAtObj(this.target, index));
        return target.getLength() > 0 ? JagString.join([arrayAtObj(this.option, index), LocalisedText.MINISEPERATOR, arrayAtObj(this.target, index)]) : arrayAtObj(this.option, index);
    }

    // re.a(I)Lid;
    static getTooltip(): JagString | null {
        let label: JagString | null;
        if (this.objSelected === 1 && this.count < 2) {
            label = JagString.join([LocalisedText.use, LocalisedText.MINISEPERATOR, this.objName, this.groundArrow]);
        } else if (this.targetMode && this.count < 2) {
            label = JagString.join([this.targetVerb, LocalisedText.MINISEPERATOR, this.targetName, this.groundArrow]);
        } else if (this.shiftClick && ClientKeyboardListener.pressed[81] && this.count > 2) {
            label = this.label(this.count - 2);
        } else {
            label = this.label(this.count - 1);
        }
        if (this.count > 2) {
            label = JagString.join([label, this.tooltipMoreSeparator, JagString.fromInt((this.count - 2) | 0), LocalisedText.MOREOPTIONS]);
        }
        return label;
    }

    // af.a(BII)V
    static resumePauseButton(child: number, component: number): void {
        const packet = Client.out;
        packet.pHead(132);
        packet.p4_alt2(component);
        packet.p2_alt1(child);
    }

    // sg.a(I)I
    static topCursor(): number {
        try {
            if (Minimenu.shiftClick && arrayAtObj(ClientKeyboardListener.pressed, 81) && Minimenu.count > 2) {
                return arrayAtI32(Minimenu.cursor, (Minimenu.count - 2) | 0);
            }
            return arrayAtI32(Minimenu.cursor, (Minimenu.count - 1) | 0);
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, glJar ? 'tb.C(16859)' : 'sg.D(-2)');
        }
    }

    // qj.a(I)V. The click-position guard precedes the default action.
    static useTopOption(ui?: InterfaceSession): void | Promise<void> {
        if (Minimenu.deferred === 2) {
            if (Minimenu.mouseX !== Minimenu.deferredX || Minimenu.mouseY !== Minimenu.deferredY) return;
        } else if (Minimenu.mouseX !== ClientMouseListener.clickX || Minimenu.mouseY !== ClientMouseListener.clickY || (PresentationCamera.needsRepick && ui?.isSceneClick(ClientMouseListener.clickX, ClientMouseListener.clickY))) {
            Minimenu.deferredY = ClientMouseListener.clickY;
            Minimenu.deferredX = ClientMouseListener.clickX;
            Minimenu.deferred = 2;
            return;
        }
        Minimenu.deferred = 0;
        const index = (Minimenu.count - (Minimenu.shiftClick && arrayAtObj(ClientKeyboardListener.pressed, 81) && Minimenu.count > 2 ? 2 : 1)) | 0;
        return Client.DoAction(index, ui);
    }

    // f.b(I)V. NXT Minimenu::Open.
    static Open(): void {
        let width = requireNonNull(Client.fontBold12).stringWidth(LocalisedText.chooseOption);
        for (let i = 0; i < Minimenu.count; i++) {
            const font = Client.fontBold12;
            const label = Minimenu.label(i);
            const measured = requireNonNull(font).stringWidth(label);
            if (width < measured) width = measured;
        }
        width = (width + 8) | 0;
        let y = Minimenu.mouseY;
        let x = (Minimenu.mouseX - ((width / 2) | 0)) | 0;
        const height = (Math.imul(15, Minimenu.count) + 21) | 0;
        if (GameShell.m_sWid < ((x + width) | 0)) x = (GameShell.m_sWid - width) | 0;
        if (((height + y) | 0) > GameShell.m_sHei) y = (GameShell.m_sHei - height) | 0;
        if (x < 0) x = 0;
        if (y < 0) y = 0;
        if (Minimenu.deferred === 1) {
            if (Minimenu.mouseX !== Minimenu.deferredX || Minimenu.mouseY !== Minimenu.deferredY) return;
            Minimenu.x = x;
            Minimenu.y = y;
            Minimenu.width = width;
            Minimenu.deferred = 0;
            Minimenu.height = (Math.imul(15, Minimenu.count) + (Minimenu.spriteStyle ? 26 : 22)) | 0;
            Minimenu.isOpen = true;
            return;
        }
        if (ClientMouseListener.clickX !== Minimenu.mouseX || Minimenu.mouseY !== ClientMouseListener.clickY || (PresentationCamera.needsRepick && Client.activeClient?.ui?.isSceneClick(ClientMouseListener.clickX, ClientMouseListener.clickY))) {
            Minimenu.deferredY = ClientMouseListener.clickY;
            Minimenu.deferred = 1;
            Minimenu.deferredX = ClientMouseListener.clickX;
            return;
        }
        Minimenu.height = (Math.imul(15, Minimenu.count) + (Minimenu.spriteStyle ? 26 : 22)) | 0;
        Minimenu.width = width;
        Minimenu.y = y;
        Minimenu.x = x;
        Minimenu.isOpen = true;
        Minimenu.deferred = 0;
    }

    // ge.b(Z)V. NXT Minimenu::GameLoop, LoopOpenMouseMode and LoopClosedMouseMode.
    static GameLoop(ui?: InterfaceSession): void | Promise<void> {
        if (Minimenu.objDragComponent !== null || ComponentDrag.component !== null) return;
        let button = ClientMouseListener.clickButton;
        if (Minimenu.isOpen) {
            const close = () => {
                Minimenu.isOpen = false;
                InterfaceList.invalidateArea(Minimenu.height, Minimenu.x, Minimenu.width, Minimenu.y);
            };
            if (button !== 1) {
                const x = ClientMouseListener.x,
                    y = ClientMouseListener.mouseY;
                if (x < ((Minimenu.x - 10) | 0) || x > ((10 + Minimenu.width + Minimenu.x) | 0) || y < ((Minimenu.y - 10) | 0) || y > ((Minimenu.height + Minimenu.y + 10) | 0)) close();
                return;
            }
            const left = Minimenu.x,
                top = Minimenu.y,
                width = Minimenu.width;
            const x = ClientMouseListener.clickX,
                y = ClientMouseListener.clickY;
            let selected = -1;
            for (let i = 0; i < Minimenu.count; i++) {
                const baseline = (Math.imul(15, (Minimenu.count - 1 - i) | 0) + top + (Minimenu.spriteStyle ? 35 : 31)) | 0;
                if (x > left && x < ((left + width) | 0) && y > ((baseline - 13) | 0) && y < ((baseline + 3) | 0)) selected = i;
            }
            if (selected !== -1) {
                const pending = Client.DoAction(selected, ui);
                if (pending instanceof Promise) return pending.then(close);
            }
            return close();
        }

        if (button === 1 && Minimenu.count > 0 && Minimenu.grab()) return;
        if (button === 1 && ((Client.m_usingOneButtonMouse === 1 && Minimenu.count > 2) || Minimenu.MenuOnly((Minimenu.count - 1) | 0))) button = 2;
        if ((button === 2 && Minimenu.count > 0) || Minimenu.deferred === 1) Minimenu.Open();
        if ((button === 1 && Minimenu.count > 0) || Minimenu.deferred === 2) return Minimenu.useTopOption(ui);
    }

    // rg.a(IILaj;)Lid;. NXT Minimenu::GetIftypeOpName.
    static GetIftypeOpName(component: IfType, op: number): JagString | null {
        if (!Client.GetActive(component).isOpEnabled(op) && component.onOp === null) return null;
        const names = component.operationNames;
        if (names !== null && op < names.length && arrayAtObj(names, op) !== null && requireNonNull(arrayAtObj(names, op)).trim().length !== 0) {
            return arrayAtObj(names, op);
        }
        return Client.qaOpTest ? JagString.join([Minimenu.hidden, JagString.fromInt(op)]) : null;
    }

    // SD fl.a([Lid;I)[Lid; / HD wk.a(I[Lna;)[Lna;
    static withOpIndices(source: (JagString | null)[] | null, start = 0): (JagString | null)[] {
        const names = new Array<JagString | null>(5).fill(null);
        for (let i = glJar ? 0 : start; i < 5; i++) {
            arrayPutObj(names, i, JagString.join([JagString.fromInt(i), Minimenu.opIndexSeparator]));
            if (source !== null && arrayAtObj(source, i) !== null) {
                arrayPutObj(names, i, JagString.join([arrayAtObj(names, i), arrayAtObj(source, i)]));
            }
        }
        return names;
    }

    // sf.a(IIILaj;)V. NXT Minimenu::AddComponent.
    static AddComponent(mouseY: number, mouseX: number, component: IfType): void {
        if (component.buttonType === 1) Minimenu.AddEntry(JagString.empty, MinimenuOps.IF_BUTTON, component.buttonTextValue, 0, component.id, 0n, -1);
        if (component.buttonType === 2 && !Minimenu.targetMode) {
            const verb = Client.TargetVerb(component);
            if (verb !== null) {
                Minimenu.AddEntry(JagString.join([Minimenu.green, component.targetTextValue]), MinimenuOps.SELECT_TARGET, verb, -1, component.id, 0n, -1);
            }
        }
        if (component.buttonType === 3) Minimenu.AddEntry(JagString.empty, MinimenuOps.IF_CLOSE, LocalisedText.close, 0, component.id, 0n, -1);
        if (component.buttonType === 4) Minimenu.AddEntry(JagString.empty, MinimenuOps.IF_TOGGLE, component.buttonTextValue, 0, component.id, 0n, -1);
        if (component.buttonType === 5) Minimenu.AddEntry(JagString.empty, MinimenuOps.IF_SET, component.buttonTextValue, 0, component.id, 0n, -1);
        if (component.buttonType === 6 && InterfaceList.pressedContinue === null) {
            Minimenu.AddEntry(JagString.empty, MinimenuOps.IF_CONTINUE, component.buttonTextValue, -1, component.id, 0n, -1);
        }
        if (component.type === 2) {
            let slot = 0;
            for (let row = 0; row < component.baseHeight; row++) {
                for (let column = 0; column < component.baseWidth; column++, slot = (slot + 1) | 0) {
                    let x = Math.imul(column, component.itemX + 32);
                    let y = Math.imul(row, component.itemY + 32);
                    if (slot < 20) {
                        x = (x + arrayAtI32(component.invSlotOffsetX, slot)) | 0;
                        y = (y + arrayAtI32(component.invSlotOffsetY, slot)) | 0;
                    }
                    if (x > mouseX || mouseY < y || ((x + 32) | 0) <= mouseX || ((y + 32) | 0) <= mouseY) continue;
                    Client.hoveredSlotCom = component;
                    Minimenu.hoverSlot = slot;
                    if (arrayAtI32(component.itemIds, slot) <= 0) continue;
                    const properties = Client.GetActive(component);
                    const obj = ObjType.List((arrayAtI32(component.itemIds, slot) - 1) | 0);
                    if (Minimenu.objSelected === 1 && properties.hasObjOps()) {
                        if (Minimenu.objComponent !== component.id || Minimenu.objSlot !== slot) {
                            Minimenu.AddEntry(JagString.join([Minimenu.objName, Minimenu.objArrow, obj.name]), MinimenuOps.OPHELDU, LocalisedText.use, slot, component.id, BigInt(obj.id), -1);
                        }
                    } else if (Minimenu.targetMode && properties.hasObjOps()) {
                        const param = Minimenu.targetParam === -1 ? null : ParamType.List(Minimenu.targetParam);
                        if ((Minimenu.targetFlags & 16) !== 0 && (param === null || obj.GetParam(param.m_defaultNumber, Minimenu.targetParam) !== param.m_defaultNumber)) {
                            Minimenu.AddEntry(JagString.join([Minimenu.targetName, Minimenu.objArrow, obj.name]), MinimenuOps.OPHELDT, Minimenu.targetVerb, slot, component.id, BigInt(obj.id), Minimenu.targetCursor);
                        }
                    } else {
                        let names = obj.inventoryOps;
                        if (Minimenu.showOpIndices) names = Minimenu.withOpIndices(names, 0);
                        if (properties.hasObjOps()) {
                            for (let op = 4; op >= 3; op--) {
                                if (names !== null && arrayAtObj(names, op) !== null) {
                                    const action = inventoryOps[op];
                                    Minimenu.AddEntry(JagString.join([Minimenu.orange, obj.name]), action, arrayAtObj(names, op), slot, component.id, BigInt(obj.id), -1);
                                }
                            }
                        }
                        if (properties.canUseObj()) {
                            Minimenu.AddEntry(JagString.join([Minimenu.orange, obj.name]), MinimenuOps.SELECT_OBJ, LocalisedText.use, slot, component.id, BigInt(obj.id), Minimenu.objCursor);
                        }
                        if (properties.hasObjOps() && names !== null) {
                            for (let op = 2; op >= 0; op--) {
                                if (arrayAtObj(names, op) !== null) {
                                    const action = inventoryOps[op];
                                    Minimenu.AddEntry(JagString.join([Minimenu.orange, obj.name]), action, arrayAtObj(names, op), slot, component.id, BigInt(obj.id), -1);
                                }
                            }
                        }
                        names = component.invOptions;
                        if (Minimenu.showOpIndices) names = Minimenu.withOpIndices(names, 0);
                        if (names !== null) {
                            for (let op = 4; op >= 0; op--) {
                                if (arrayAtObj(names, op) !== null) {
                                    const action = inventoryComponentOps[op];
                                    Minimenu.AddEntry(JagString.join([Minimenu.orange, obj.name]), action, arrayAtObj(names, op), slot, component.id, BigInt(obj.id), -1);
                                }
                            }
                        }
                        Minimenu.AddEntry(JagString.join([Minimenu.orange, obj.name]), MinimenuOps.EXAMINE_HELD, LocalisedText.examine, slot, component.id, BigInt(obj.id), Minimenu.examineCursor);
                    }
                }
            }
        }
        if (component.if3) {
            if (!Minimenu.targetMode) {
                for (let op = 9; op >= 5; op--) {
                    const name = Minimenu.GetIftypeOpName(component, op);
                    if (name !== null) {
                        Minimenu.AddEntry(component.opBaseValue, MinimenuOps.IF_BUTTONX_LOW_PRIORITY, name, component.childId, component.id, BigInt(op + 1), IfType.getOpCursor(component, op));
                    }
                }
                const verb = Client.TargetVerb(component);
                if (verb !== null) Minimenu.AddEntry(component.opBaseValue, MinimenuOps.SELECT_TARGET, verb, component.childId, component.id, 0n, -1);
                for (let op = 4; op >= 0; op--) {
                    const name = Minimenu.GetIftypeOpName(component, op);
                    if (name !== null) {
                        Minimenu.AddEntry(component.opBaseValue, MinimenuOps.IF_BUTTONX, name, component.childId, component.id, BigInt(op + 1), IfType.getOpCursor(component, op));
                    }
                }
                if (Client.GetActive(component).canResume()) {
                    Minimenu.AddEntry(JagString.empty, MinimenuOps.IF_CONTINUE, LocalisedText.continue, component.childId, component.id, 0n, -1);
                }
            } else if (Client.GetActive(component).canTarget() && (Minimenu.targetFlags & 32) !== 0) {
                Minimenu.AddEntry(JagString.join([Minimenu.targetName, Minimenu.targetArrow, component.opBaseValue]), MinimenuOps.IF_BUTTONT, Minimenu.targetVerb, component.childId, component.id, 0n, Minimenu.targetCursor);
            }
        }
    }

    // r.a(III)Lid;
    static combatColour(self: number, level: number): JagString {
        const d = (self - level) | 0;
        if (d < -9) return this.red;
        if (d < -6) return this.redOrange;
        if (d < -3) return this.orangeRed;
        if (d < 0) return this.amber;
        if (d > 9) return this.green;
        if (d > 6) return this.lime;
        if (d > 3) return this.chartreuse;
        return d > 0 ? this.yellowGreen : this.yellow;
    }

    // bj.a(IIBILja;)V. NXT Minimenu::AddNpcOptions.
    static AddNpcOptions(x: number, z: number, id: number, npc: NpcType | null): void {
        if (Minimenu.count >= 400) return;
        if (requireNonNull(npc).multi !== null) npc = requireNonNull(npc).GetMultiNpc();
        if (npc === null || !npc.interactive) return;
        let name = npc.name;
        if (npc.m_visibleCombatLevel !== 0) {
            const label = GameVariant.id === 1 ? LocalisedText.rating : LocalisedText.level;
            name = JagString.join([name, Minimenu.combatColour(requireNonNull(Client.localPlayer).combatLevel, npc.m_visibleCombatLevel), Minimenu.openParen, label, JagString.fromInt(npc.m_visibleCombatLevel), Minimenu.closeParen]);
        }
        if (Minimenu.objSelected === 1) {
            Minimenu.AddEntry(JagString.join([Minimenu.objName, Minimenu.npcArrow, name]), MinimenuOps.OPNPCU, LocalisedText.use, x, z, BigInt(id), Minimenu.objCursor);
        } else if (Minimenu.targetMode) {
            const param = Minimenu.targetParam !== -1 ? ParamType.List(Minimenu.targetParam) : null;
            if ((Minimenu.targetFlags & 2) !== 0 && (param === null || npc.GetParam(Minimenu.targetParam, param.m_defaultNumber) !== param.m_defaultNumber)) {
                Minimenu.AddEntry(JagString.join([Minimenu.targetName, Minimenu.npcArrow, name]), MinimenuOps.OPNPCT, Minimenu.targetVerb, x, z, BigInt(id), Minimenu.targetCursor);
            }
        } else {
            let names = npc.ops;
            if (Minimenu.showOpIndices) names = Minimenu.withOpIndices(names, 0);
            if (names !== null) {
                for (let op = 4; op >= 0; op--) {
                    const label = arrayAtObj(names, op);
                    if (label === null || (GameVariant.id === 0 && label.equalsIgnoreCase(LocalisedText.attack))) continue;
                    let cursor = -1;
                    if (npc.cursorOp1 === op) cursor = npc.cursor1;
                    if (npc.cursorOp2 === op) cursor = npc.cursor2;
                    Minimenu.AddEntry(JagString.join([Minimenu.yellow, name]), npcOps[op], arrayAtObj(names, op), x, z, BigInt(id), cursor);
                }
            }
            if (GameVariant.id === 0 && names !== null) {
                for (let op = 4; op >= 0; op--) {
                    const label = arrayAtObj(names, op);
                    if (label !== null && label.equalsIgnoreCase(LocalisedText.attack)) {
                        const priority = requireNonNull(Client.localPlayer).combatLevel < npc.m_visibleCombatLevel ? 2000 : 0;
                        Minimenu.AddEntry(JagString.join([Minimenu.yellow, name]), npcOps[op] + priority, arrayAtObj(names, op), x, z, BigInt(id), npc.cursorAttack);
                    }
                }
            }
            Minimenu.AddEntry(JagString.join([Minimenu.yellow, name]), MinimenuOps.EXAMINE_NPC, LocalisedText.examine, x, z, BigInt(id), Minimenu.examineCursor);
        }
    }

    // dg.a(IIIILpb;)V. NXT Minimenu::AddPlayerOptions.
    static AddPlayerOptions(z: number, x: number, id: number, player: ClientPlayer | null): void {
        if (player === Client.localPlayer || Minimenu.count >= 400) return;
        const other = requireNonNull(player);
        let name: JagString;
        if (other.skillLevel === 0) {
            let permitted = true;
            const local = requireNonNull(Client.localPlayer);
            if (local.combatRange !== -1 && other.combatRange !== -1) {
                const level = Math.max(local.combatLevel, other.combatLevel);
                const range = Math.min(other.combatRange, local.combatRange);
                const limit = (range + ((Math.imul(10, level) / 100) | 0) + 5) | 0;
                let difference = (local.combatLevel - other.combatLevel) | 0;
                if (difference < 0) difference = -difference | 0;
                if (limit < difference) permitted = false;
            }
            const label = GameVariant.id === 1 ? LocalisedText.rating : LocalisedText.level;
            if (other.combatLevel < other.combatLevelWithSummoning) {
                name = JagString.join([
                    other.getDisplayName(),
                    permitted ? Minimenu.combatColour(local.combatLevel, other.combatLevel) : Minimenu.white,
                    Minimenu.openParen,
                    label,
                    JagString.fromInt(other.combatLevel),
                    Minimenu.plus,
                    JagString.fromInt((other.combatLevelWithSummoning - other.combatLevel) | 0),
                    Minimenu.closeParen
                ]);
            } else {
                name = JagString.join([other.getDisplayName(), permitted ? Minimenu.combatColour(local.combatLevel, other.combatLevel) : Minimenu.white, Minimenu.openParen, label, JagString.fromInt(other.combatLevel), Minimenu.closeParen]);
            }
        } else {
            name = JagString.join([other.getDisplayName(), Minimenu.openParen, LocalisedText.skill, JagString.fromInt(other.skillLevel), Minimenu.closeParen]);
        }
        if (Minimenu.objSelected === 1) {
            Minimenu.AddEntry(JagString.join([Minimenu.objName, Minimenu.playerArrow, name]), MinimenuOps.OPPLAYERU, LocalisedText.use, x, z, BigInt(id), Minimenu.objCursor);
        } else if (!Minimenu.targetMode) {
            for (let op = 7; op >= 0; op--) {
                const label = arrayAtObj(Minimenu.playerOption, op);
                if (label === null) continue;
                let priority = 0;
                if (GameVariant.id === 0 && label.equalsIgnoreCase(LocalisedText.attack)) {
                    const local = requireNonNull(Client.localPlayer);
                    if (local.combatLevel < other.combatLevel) priority = 2000;
                    if (local.team !== 0 && other.team !== 0) priority = other.team === local.team ? 2000 : 0;
                } else if (arrayAtObj(Minimenu.playerSecondary, op)) {
                    priority = 2000;
                }
                const action = ((arrayAtI16(Minimenu.playerAction, op) + priority) << 16) >> 16;
                Minimenu.AddEntry(JagString.join([Minimenu.white, name]), action, arrayAtObj(Minimenu.playerOption, op), x, z, BigInt(id), arrayAtI32(Minimenu.playerCursor, op));
            }
        } else if ((Minimenu.targetFlags & 8) !== 0) {
            Minimenu.AddEntry(JagString.join([Minimenu.targetName, Minimenu.playerArrow, name]), MinimenuOps.OPPLAYERT, Minimenu.targetVerb, x, z, BigInt(id), Minimenu.targetCursor);
        }
        for (let i = 0; i < Minimenu.count; i++) {
            if (arrayAtI16(Minimenu.actions, i) === MinimenuOps.WALK_HERE) {
                arrayPutObj(Minimenu.target, i, JagString.join([Minimenu.white, name]));
                break;
            }
        }
    }

    // pg.a(IIIIIII)V. NXT Minimenu::Build.
    static Build(viewY: number, mouseX: number, width: number, height: number, mouseY: number, viewX: number): void | Promise<void> {
        return runToCompletion(
            (function* (): Generator<Promise<void>, void, void> {
                if (Minimenu.objSelected === 0) {
                    const left = Pix3D.clipMinX;
                    const top = Pix3D.clipMinY;
                    const right = Pix3D.clipMaxX;
                    const bottom = Pix3D.clipMaxY;
                    const pickY = (intDivide(Math.imul(bottom - top, mouseY - viewY), height) + top) | 0;
                    const pickX = (intDivide(Math.imul(right - left, mouseX - viewX), width) + left) | 0;
                    if (Minimenu.targetMode && (Minimenu.targetFlags & 64) !== 0) {
                        if (InterfaceList.GetComponent(Minimenu.targetComponent, Minimenu.targetChild) !== null) {
                            Minimenu.AddEntry(Minimenu.groundArrow, MinimenuOps.TARGET_GROUND, Minimenu.targetVerb, pickX, pickY, 0n, Minimenu.targetCursor);
                        } else {
                            const end = Minimenu.EndTargetMode();
                            if (end instanceof Promise) yield end;
                        }
                    } else {
                        if (GameVariant.id === 1) Minimenu.AddEntry(JagString.empty, MinimenuOps.FACE_HERE, LocalisedText.faceHere, pickX, pickY, 0n, -1);
                        Minimenu.AddEntry(JagString.empty, MinimenuOps.WALK_HERE, Minimenu.walkHere, pickX, pickY, 0n, -1);
                    }
                }
                let previous = -1n;
                for (let i = 0; i < ModelLit.pickedCount; i++) {
                    const key = arrayAtB64(ModelLit.pickedTypecodes, i);
                    const low = Number(BigInt.asIntN(32, key));
                    const x = low & 127;
                    const z = (low & 16263) >> 7;
                    const kind = (low >> 29) & 3;
                    const id = Number((key >> 32n) & 0x7fffffffn);
                    if (previous === key) continue;
                    previous = key;
                    if (kind === 2 && world.hasTypecode(Client.playerLevel, x, z, key)) {
                        let loc: LocType | null = LocType.List(id);
                        if (loc.multi !== null) loc = loc.GetMultiLoc();
                        if (loc === null) continue;
                        if (Minimenu.objSelected === 1) {
                            Minimenu.AddEntry(JagString.join([Minimenu.objName, Minimenu.locArrow, loc.name]), MinimenuOps.OPLOCU, LocalisedText.use, x, z, key, Minimenu.objCursor);
                        } else if (Minimenu.targetMode) {
                            const param = Minimenu.targetParam === -1 ? null : ParamType.List(Minimenu.targetParam);
                            if ((Minimenu.targetFlags & 4) !== 0 && (param === null || loc.GetParam(param.m_defaultNumber, Minimenu.targetParam) !== param.m_defaultNumber)) {
                                Minimenu.AddEntry(JagString.join([Minimenu.targetName, Minimenu.locArrow, loc.name]), MinimenuOps.OPLOCT, Minimenu.targetVerb, x, z, key, Minimenu.targetCursor);
                            }
                        } else {
                            let names = loc.ops;
                            if (Minimenu.showOpIndices) names = Minimenu.withOpIndices(names, 0);
                            if (names !== null) {
                                for (let op = 4; op >= 0; op--) {
                                    if (arrayAtObj(names, op) !== null) {
                                        let cursor = -1;
                                        if (op === loc.cursorOp1) cursor = loc.cursor1;
                                        if (op === loc.cursorOp2) cursor = loc.cursor2;
                                        Minimenu.AddEntry(JagString.join([Minimenu.locColour, loc.name]), locOps[op], arrayAtObj(names, op), x, z, key, cursor);
                                    }
                                }
                            }
                            Minimenu.AddEntry(JagString.join([Minimenu.locColour, loc.name]), MinimenuOps.EXAMINE_LOC, LocalisedText.examine, x, z, BigInt(loc.id), Minimenu.examineCursor);
                        }
                    }
                    if (kind === 1) {
                        const npc = requireNonNull(arrayAtObj(Client.npcs, id));
                        if (((requireNonNull(npc.npcType).m_gridSize & 1) === 0 && (npc.x & 127) === 0 && (npc.z & 127) === 0) || ((requireNonNull(npc.npcType).m_gridSize & 1) === 1 && (npc.x & 127) === 64 && (npc.z & 127) === 64)) {
                            const minZ = (npc.z + 64 - Math.imul(64, requireNonNull(npc.npcType).m_gridSize)) | 0;
                            const minX = (npc.x - Math.imul(64, requireNonNull(npc.npcType).m_gridSize - 1)) | 0;
                            for (let j = 0; j < Client.npcCount; j++) {
                                const other = requireNonNull(arrayAtObj(Client.npcs, arrayAtI32(Client.npcIds, j)));
                                const otherType = requireNonNull(other.npcType);
                                const otherX = (other.x - Math.imul(64, otherType.m_gridSize) + 64) | 0;
                                const otherZ = (other.z + 64 - Math.imul(64, otherType.m_gridSize)) | 0;
                                if (
                                    other !== npc &&
                                    otherX >= minX &&
                                    otherType.m_gridSize <= ((requireNonNull(npc.npcType).m_gridSize - ((otherX - minX) >> 7)) | 0) &&
                                    otherZ >= minZ &&
                                    otherType.m_gridSize <= ((requireNonNull(npc.npcType).m_gridSize - ((otherZ - minZ) >> 7)) | 0)
                                ) {
                                    Minimenu.AddNpcOptions(x, z, arrayAtI32(Client.npcIds, j), other.npcType);
                                }
                            }
                            for (let j = 0; j < ReceivePlayerPositions.m_lastNum; j++) {
                                const player = requireNonNull(arrayAtObj(Client.players, arrayAtI32(ReceivePlayerPositions.m_lastID, j)));
                                const playerX = (player.x + 64 - Math.imul(player.getSize(), 64)) | 0;
                                const playerZ = (player.z - Math.imul(player.getSize() - 1, 64)) | 0;
                                if (
                                    playerX >= minX &&
                                    player.getSize() <= ((requireNonNull(npc.npcType).m_gridSize - ((playerX - minX) >> 7)) | 0) &&
                                    playerZ >= minZ &&
                                    player.getSize() <= ((requireNonNull(npc.npcType).m_gridSize - ((playerZ - minZ) >> 7)) | 0)
                                ) {
                                    Minimenu.AddPlayerOptions(z, x, arrayAtI32(ReceivePlayerPositions.m_lastID, j), player);
                                }
                            }
                        }
                        Minimenu.AddNpcOptions(x, z, id, npc.npcType);
                    }
                    if (kind === 0) {
                        const player = requireNonNull(arrayAtObj(Client.players, id));
                        if ((player.x & 127) === 64 && (player.z & 127) === 64) {
                            const minX = (player.x + 64 - Math.imul(player.getSize(), 64)) | 0;
                            const minZ = (player.z - Math.imul(player.getSize() - 1, 64)) | 0;
                            for (let j = 0; j < Client.npcCount; j++) {
                                const npc = requireNonNull(arrayAtObj(Client.npcs, arrayAtI32(Client.npcIds, j)));
                                const type = requireNonNull(npc.npcType);
                                const npcX = (npc.x - Math.imul(type.m_gridSize - 1, 64)) | 0;
                                const npcZ = (npc.z - Math.imul(type.m_gridSize - 1, 64)) | 0;
                                if (minX <= npcX && type.m_gridSize <= ((player.getSize() - ((npcX - minX) >> 7)) | 0) && minZ <= npcZ && type.m_gridSize <= ((player.getSize() - ((npcZ - minZ) >> 7)) | 0)) {
                                    Minimenu.AddNpcOptions(x, z, arrayAtI32(Client.npcIds, j), npc.npcType);
                                }
                            }
                            for (let j = 0; j < ReceivePlayerPositions.m_lastNum; j++) {
                                const other = requireNonNull(arrayAtObj(Client.players, arrayAtI32(ReceivePlayerPositions.m_lastID, j)));
                                const otherX = (other.x - Math.imul(other.getSize(), 64) + 64) | 0;
                                const otherZ = (other.z + 64 - Math.imul(other.getSize(), 64)) | 0;
                                if (other !== player && minX <= otherX && other.getSize() <= ((player.getSize() - ((otherX - minX) >> 7)) | 0) && otherZ >= minZ && other.getSize() <= ((player.getSize() - ((otherZ - minZ) >> 7)) | 0)) {
                                    Minimenu.AddPlayerOptions(z, x, arrayAtI32(ReceivePlayerPositions.m_lastID, j), other);
                                }
                            }
                        }
                        Minimenu.AddPlayerOptions(z, x, id, player);
                    }
                    if (kind === 3) {
                        const pile = arrayAtObj(arrayAtObj(arrayAtObj(Client.groundObj, Client.playerLevel), x), z);
                        if (pile === null) continue;
                        for (let node = pile.tail(); node !== null; node = pile.prev()) {
                            const item = node.obj.id;
                            const obj = ObjType.List(item);
                            if (Minimenu.objSelected === 1) {
                                Minimenu.AddEntry(JagString.join([Minimenu.objName, Minimenu.objArrow, obj.name]), MinimenuOps.OPOBJU, LocalisedText.use, x, z, BigInt(item), Minimenu.objCursor);
                            } else if (Minimenu.targetMode) {
                                const param = Minimenu.targetParam === -1 ? null : ParamType.List(Minimenu.targetParam);
                                if ((Minimenu.targetFlags & 1) !== 0 && (param === null || obj.GetParam(param.m_defaultNumber, Minimenu.targetParam) !== param.m_defaultNumber)) {
                                    Minimenu.AddEntry(JagString.join([Minimenu.targetName, Minimenu.objArrow, obj.name]), MinimenuOps.OPOBJT, Minimenu.targetVerb, x, z, BigInt(item), Minimenu.targetCursor);
                                }
                            } else {
                                let names = obj.groundOps;
                                if (Minimenu.showOpIndices) names = Minimenu.withOpIndices(names, 0);
                                for (let op = 4; op >= 0; op--) {
                                    if (names !== null && arrayAtObj(names, op) !== null) {
                                        let cursor = -1;
                                        if (op === obj.cursorOp1) cursor = obj.cursor1;
                                        if (op === obj.cursorOp2) cursor = obj.cursor2;
                                        Minimenu.AddEntry(JagString.join([Minimenu.orange, obj.name]), groundObjActions[op], arrayAtObj(names, op), x, z, BigInt(item), cursor);
                                    }
                                }
                                Minimenu.AddEntry(JagString.join([Minimenu.orange, obj.name]), MinimenuOps.EXAMINE_OBJ, LocalisedText.examine, x, z, BigInt(item), Minimenu.examineCursor);
                            }
                        }
                    }
                }
            })()
        );
    }

    // ge.b(Z)V, initial obj-slot drag capture.
    private static grab(): boolean {
        if (this.count <= 0) return false;
        const i = (this.count - 1) | 0;
        if (!draggableActions.includes(arrayAtI16(this.actions, i))) return false;
        const id = arrayAtI32(this.paramC, i),
            slot = arrayAtI32(this.paramB, i);
        const c = requireNonNull(IfType.Get(id)),
            flags = Client.GetActive(c);
        if (!flags.canSwapObjs() && !flags.canReplaceObj()) return false;
        this.objDragCycles = 0;
        this.objDragMoved = false;
        if (this.objDragComponent !== null) Client.ComponentUpdated(this.objDragComponent);
        this.objDragComponent = IfType.Get(id);
        this.objDragSlot = slot;
        this.objGrabX = ClientMouseListener.clickX;
        this.objGrabY = ClientMouseListener.clickY;
        Client.ComponentUpdated(requireNonNull(this.objDragComponent));
        return true;
    }

    // Inlined in ti.a(IIIB)Lqd; and ok.a(Lqd;ZI)V. NXT Minimenu::RemoveInterfaceEntries.
    static RemoveInterfaceEntries(): void {
        const count = Minimenu.count;
        for (let i = 0; i < count; i++) {
            if (Minimenu.IsInterfaceEntry(arrayAtI16(Minimenu.actions, i))) Minimenu.remove(i);
        }
        if (Minimenu.count === 1) {
            Minimenu.isOpen = false;
            InterfaceList.invalidateArea(Minimenu.height, Minimenu.x, Minimenu.width, Minimenu.y);
            return;
        }
        InterfaceList.invalidateArea(Minimenu.height, Minimenu.x, Minimenu.width, Minimenu.y);
        let width = requireNonNull(Client.fontBold12).stringWidth(LocalisedText.chooseOption);
        for (let i = 0; i < Minimenu.count; i++) {
            const font = Client.fontBold12;
            const label = Minimenu.label(i);
            const measured = requireNonNull(font).stringWidth(label);
            if (measured > width) width = measured;
        }
        Minimenu.width = (width + 8) | 0;
        Minimenu.height = (Math.imul(Minimenu.count, 15) + (Minimenu.spriteStyle ? 26 : 22)) | 0;
    }

    choose(entries: MenuOption[], x: number, y: number, right: boolean): void | Promise<void> {
        if (entries.every(e => e.nativeIndex !== undefined)) {
            return this.pollNative();
        }
        const options = [...entries.filter(o => !o.secondary), ...entries.filter(o => o.secondary)];
        if (!right) {
            const action = options[0]?.run();
            if (action instanceof Promise) return action;
            return;
        }
        options.push({ label: toJsString(LocalisedText.cancel), run() {} });
        this.entries = options;
        this.width = Math.max(this.font.stringWidth(LocalisedText.chooseOption), ...options.map(o => this.font.stringWidth(fromJsString(o.label)))) + 8;
        this.height = options.length * 15 + 22;
        this.x = Math.max(0, Math.min(765 - this.width, x - (this.width >> 1)));
        this.y = Math.max(0, Math.min(503 - this.height, y));
    }

    private index(x: number, y: number): number {
        if (x <= this.x || x >= this.x + this.width) return -1;
        for (let i = 0; i < this.entries.length; i++) {
            const baseline = this.y + (Minimenu.spriteStyle ? 35 : 31) + i * 15;
            if (y > baseline - 13 && y < baseline + 3) return i;
        }
        return -1;
    }

    click(x: number, y: number): void | Promise<void> {
        if (this.displayNative) return this.pollNative();
        const entry = this.entries[this.index(x, y)];
        const finish = () => {
            this.entries = [];
            InterfaceList.invalidateArea(this.height, this.x, this.width, this.y);
        };
        const pending = entry?.run();
        if (pending instanceof Promise) return pending.then(finish);
        finish();
    }

    checkBounds(x: number, y: number): void | Promise<void> {
        if (this.displayNative) return this.pollNative();
        if (this.open && (x < this.x - 10 || x > this.x + this.width + 10 || y < this.y - 10 || y > this.y + this.height + 10)) {
            this.entries = [];
            InterfaceList.invalidateArea(this.height, this.x, this.width, this.y);
        }
    }

    draw(mouseX: number, mouseY: number): void {
        if (!this.open) return;
        if (this.displayNative) {
            if (Minimenu.spriteStyle) Minimenu.DrawSpriteMenu();
            else Minimenu.Draw();
            return;
        }
        if (mouseX < this.x - 10 || mouseX > this.x + this.width + 10 || mouseY < this.y - 10 || mouseY > this.y + this.height + 10) {
            this.entries = [];
            return;
        }
        NativePix2D.fillRect(this.x, this.y, this.width, this.height, 6116423);
        NativePix2D.fillRect(this.x + 1, this.y + 1, this.width - 2, 16, 0);
        NativePix2D.drawRect(this.x + 1, this.y + 18, this.width - 2, this.height - 19, 0);
        this.font.drawLeft(LocalisedText.chooseOption, this.x + 3, this.y + 14, 6116423, -1);
        const over = this.index(mouseX, mouseY);
        this.entries.forEach((o, i) => this.font.drawLeft(fromJsString(o.label), this.x + 3, this.y + 31 + i * 15, i === over ? 0xffff00 : 0xffffff, 0));
    }
}
