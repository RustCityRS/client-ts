import IntNode from '#/datastruct/IntNode';
import FriendChatChannel from '#/client/FriendChatChannel';
import PixfontGeneric from '#/graphics/PixfontGeneric';
import BrowserControl from '#/util/BrowserControl';
import Signlink from '#/util/Signlink';
import RunetekColour from '#/util/RunetekColour';
import OrbitCamera from '#/client/OrbitCamera';
import CinematicCamera from '#/client/CinematicCamera';
import Minimenu from '#/ui/Minimenu';
import ClientKeyboardListener from '#/client/ClientKeyboardListener';
import ClientInvCache from '#/client/ClientInvCache';
import InvType from '#/config/InvType';
import ClientVarCache from '#/util/ClientVarCache';
import Login from '#/io/Login';
import GameWorld from '#/io/GameWorld';
import WorldList from '#/io/WorldList';
import SafeTime from '#/io/SafeTime';
import AccountCreation from '#/io/AccountCreation';
import TitleScreen from '#/title/TitleScreen';
import ChatHistory from '#/game/ChatHistory';
import WordPack from '#/io/WordPack';
import ClientPlayer from '#/dash3d/ClientPlayer';
import GameVariant from '#/client/GameVariant';
import { glJar } from '#/client/ClientVariant';
import QuickChatCatTypeList from '#/config/QuickChatCatTypeList';
import QuickChatPhraseTypeList from '#/config/QuickChatPhraseTypeList';
import Client from '#/client/Client';
import QuickChatPhrase from '#/client/QuickChatPhrase';
import IfType, { type Hook } from '#/ui/IfType';
import InterfaceList from '#/ui/InterfaceList';
import SubInterface from '#/ui/SubInterface';
import DelayedStateChange from '#/ui/DelayedStateChange';
import PlayerModel from '#/dash3d/PlayerModel';
import MapArea from '#/ui/MapArea';
import { arrayAtB64, arrayAtI16, arrayAtI32, arrayAtObj, arrayAtU8, arrayPutI16, arrayPutI32, arrayPutObj, requireNonNull } from '#/util/JavaArray';
import { ClientScript } from './ClientScript';
import JagString, { fromJsString, fromLiteral, toJsString } from '#/datastruct/JagString';
import { mathRandom } from '#/util/JavaRandom';
import { doubleToInt, intDivide, intRemainder } from '#/util/IntUtils';
import LocalisedText from '#/ui/LocalisedText';
import JavaCalendar from '#/util/JavaCalendar';

import { utf8String } from '#/io/JavaText';
import { JavaError, reportClientError } from '#/util/ClientError';
import { IllegalStateException } from '#/util/JavaException';
import HookReq from './HookReq';
import ClientGosubFrame from './ClientGosubFrame';
import { runToCompletion } from './ScriptContinuation';
import WorldMap from '#/ui/WorldMap';
import DisplayMode from '#/client/DisplayMode';
import Preferences from '#/ui/Preferences';
import LocType from '#/config/LocType';
import ObjType from '#/config/ObjType';
import EnumType from '#/config/EnumType';
import NpcType from '#/config/NpcType';
import ParamType from '#/config/ParamType';
import StructType from '#/config/StructType';
import GameShell from '#/client/GameShell';
import Pix3D from '#/dash3d/Pix3D';
import TextureCache from '#/dash3d/TextureCache';
import ParticleSystem from '#/dash3d/ParticleSystem';
import RoofModeStatics from '#/dash3d/RoofModeStatics';
import AudioEngine from '#/sound/AudioEngine';
import MidiManager from '#/sound/MidiManager';
import SoftwareFont from '#/graphics/SoftwareFont';
import GlRenderer from '#/gl/GlRenderer';
import MaterialManager from '#/gl/material/MaterialManager';

function glActive(): boolean {
    return glJar && GlRenderer.active;
}

// System.exit(0) in gh.a, when a standalone host closes from opcode 5411.
const applicationExit = Symbol('application exit');

// gh.a(wf, int, int)
export default class ScriptRunner {
    static readonly eventOpbase = fromLiteral('event_opbase'); // lj.d:Lid;
    static readonly monthJan = fromLiteral('Jan'); // u.a:Lid;
    static readonly monthJun = fromLiteral('Jun'); // u.n:Lid;
    static readonly monthSep = fromLiteral('Sep'); // u.m:Lid;
    static readonly monthNov = fromLiteral('Nov'); // u.d:Lid;
    static readonly monthJul = fromLiteral('Jul'); // u.p:Lid;
    static readonly monthMar = fromLiteral('Mar'); // u.s:Lid;
    static readonly monthAug = fromLiteral('Aug'); // u.t:Lid;
    static readonly monthDec = fromLiteral('Dec'); // u.e:Lid;
    static readonly monthMay = fromLiteral('May'); // u.u:Lid;
    static readonly monthApr = fromLiteral('Apr'); // u.j:Lid;
    static readonly monthFeb = fromLiteral('Feb'); // u.w:Lid;
    static readonly monthOct = fromLiteral('Oct'); // u.v:Lid;
    static readonly months = [
        ScriptRunner.monthJan,
        ScriptRunner.monthFeb,
        ScriptRunner.monthMar,
        ScriptRunner.monthApr,
        ScriptRunner.monthMay,
        ScriptRunner.monthJun,
        ScriptRunner.monthJul,
        ScriptRunner.monthAug,
        ScriptRunner.monthSep,
        ScriptRunner.monthOct,
        ScriptRunner.monthNov,
        ScriptRunner.monthDec
    ]; // u.g:[Lid;
    static readonly dateSeparator = fromLiteral(')2'); // li.p:Lid;
    static readonly errorInLabel = fromLiteral('(U0a )2 in: '); // sj.D:Lid;
    static readonly viaScript = fromLiteral('(U0a )2 via: '); // pf.O:Lid;
    static readonly gosubErrorPrefix = fromLiteral('(U0a )2 non)2existant gosub script)2num: '); // na.x:Lid;
    static readonly scriptErrorPrefix = fromLiteral('Clientscript error in: '); // qe.fb:Lid;
    static readonly scriptErrorMessage = fromLiteral('Clientscript error )2 check log for details'); // bh.e:Lid;
    static readonly intStack = new Int32Array(1000); // tg.B:[I
    static readonly stringStack = new Array<JagString | null>(1000).fill(null); // g.p:[Lid;
    static activeQuickChatMessage: QuickChatPhrase | null = null; // bh.h:Ld;
    static quickChatPacketsSent = 0; // SD o.Q, HD hc.R
    static crownTag0: JagString | null = fromLiteral('<img=0>'); // q.f:Lid;
    static img1Tag: JagString | null = fromLiteral('<img=1>'); // lj.a:Lid;
    static activeComponent: IfType | null = null; // al.B:Laj;
    static activeComponent2: IfType | null = null; // ai.i:Laj;
    static readonly emptyString = fromLiteral(''); // uj.i:Lid;
    static calendar = new JavaCalendar(); // ok.s:Ljava/util/Calendar;
    static readonly nullString = fromLiteral('null'); // pa.Ab:Lid;
    static readonly space = fromLiteral(' '); // wh.Y:Lid;
    static readonly arrays = Array.from({ length: 5 }, () => new Int32Array(5000)); // ie.H:[[I
    static readonly lengths = new Int32Array(5); // hf.G:[I
    static readonly frames = new Array<ClientGosubFrame | null>(50).fill(null); // kc.p:[Lqf;
    static frameCount = 0; // oi.b:I
    static intLocals: Int32Array | null = null; // mk.J:[I
    static stringLocals: (JagString | null)[] | null = null; // lk.t:[Lid;

    constructor(
        private readonly loadScript: (id: number) => ClientScript | null,
        private readonly report?: (error: Error) => void
    ) {}

    // gd.b(IB)V. NXT ScriptRunner::OnLoad.
    static OnLoad(group: number, runner = Client.activeClient?.ui?.runner ?? new ScriptRunner(ClientScript.Get)): void | Promise<void> {
        if (group === -1 || !IfType.OpenInterface(group)) return;
        const row = requireNonNull(arrayAtObj(IfType.m_list, group));
        return runToCompletion(
            (function* (): Generator<Promise<void>, void, void> {
                for (const slot of row) {
                    const c = requireNonNull(slot);
                    if (c.onLoad === null) continue;
                    const event = new HookReq();
                    event.args = c.onLoad;
                    event.component = c;
                    const pending = runner.ExecuteScript(event, 2000000);
                    if (pending instanceof Promise) yield pending;
                }
            })()
        );
    }

    // li.a(Lwf;I)V
    run(event: HookReq): void | Promise<void> {
        return this.ExecuteScript(event, 200000);
    }

    // gh.a(Lwf;II)V
    ExecuteScript(event: HookReq, maxOps: number): void | Promise<void> {
        return runToCompletion(this.instructions(event, maxOps));
    }

    private static *leaveFullscreen(): Generator<Promise<void>, void, void> {
        if (glJar && GameShell.fullScreenFrame !== null) {
            const change = Client.setWindowMode(-1, true, Preferences.windowMode, false, -1);
            if (change instanceof Promise) yield change;
        }
    }

    // gh.a(Lwf;II)V interpreter activation, including its resumable host calls.
    private *instructions(event: HookReq, maxOps: number): Generator<Promise<void>, void, void> {
        const args = requireNonNull(event.args);
        const id = arrayAtObj(args, 0);
        if (typeof id !== 'number') {
            throw new Error('Expected CS2 script id');
        }
        const entry = this.loadScript(id);
        if (!entry) return;
        let script: ClientScript | null = entry;
        ScriptRunner.frameCount = 0;
        let isp = 0; // gh.a local 6
        let ssp = 0; // gh.a local 7
        let pc = -1;
        let opcodes: Int32Array | null;
        let opcode = -1;
        let operands: Int32Array | null;
        if (glJar) {
            operands = script.intOperands;
            opcodes = script.opcodes;
        } else {
            opcodes = script.opcodes;
            operands = script.intOperands;
        }
        let intLocal = 0;
        let stringLocal = 0;
        try {
            if (glJar) {
                ScriptRunner.intLocals = new Int32Array(script.intLocals);
                ScriptRunner.stringLocals = new Array<JagString | null>(script.stringLocals).fill(null);
            } else {
                ScriptRunner.stringLocals = new Array<JagString | null>(script.stringLocals).fill(null);
                ScriptRunner.intLocals = new Int32Array(script.intLocals);
            }
            for (let i = 1; i < args.length; i++) {
                let value = args[i];
                if (value instanceof JagString) {
                    if (value.equals(ScriptRunner.eventOpbase)) value = event.opBase;
                    arrayPutObj(ScriptRunner.stringLocals, stringLocal++, value);
                } else if (typeof value === 'number') {
                    // These are successive comparisons in gh.a, 00cb..0184.
                    if (value === -2147483647) value = event.mouseX;
                    if (value === -2147483646) value = event.mouseY;
                    if (value === -2147483645) value = event.component === null ? -1 : event.component.id;
                    if (value === -2147483644) value = event.opIndex;
                    if (value === -2147483643) value = event.component === null ? -1 : event.component.childId;
                    if (value === -2147483642) value = event.dragTarget === null ? -1 : event.dragTarget.id;
                    if (value === -2147483641) value = event.dragTarget === null ? -1 : event.dragTarget.childId;
                    if (value === -2147483640) value = event.keyCode;
                    if (value === -2147483639) value = event.keyChar;
                    arrayPutI32(ScriptRunner.intLocals, intLocal++, value);
                }
            }
            let steps = 0;
            while (true) {
                steps = (steps + 1) | 0;
                if (steps > maxOps) throw new Error('slow');
                opcode = arrayAtI32(opcodes, ++pc);
                const extendedOperand = opcode >= 100 ? arrayAtI32(operands, pc) : 0;
                const active = extendedOperand === 1 ? 'activeComponent2' : 'activeComponent';
                if ((opcode >= 1000 && opcode < 2702) || opcode === 2703 || (opcode >= 2800 && opcode < 2900)) {
                    const explicit = opcode >= 2000;
                    let command = opcode;
                    let component: IfType | null;
                    if (explicit || (opcode >= 1900 && opcode < 2000)) {
                        if (explicit) command -= 1000;
                        // SD gh.a and HD h.a normalize different setter families before the widget lookup.
                        const setter = explicit && opcode < 2500;
                        const adjustFirst = glJar ? (command >= 1100 && command < 1200) || command >= 1400 : command < 1100 || command >= 1200;
                        if (setter && adjustFirst) opcode = command;
                        component = IfType.Get(arrayAtI32(ScriptRunner.intStack, --isp));
                        if (setter && !adjustFirst) opcode = command;
                    } else {
                        component = ScriptRunner[active];
                    }
                    if (command >= 1200 && command < 1300) Client.ComponentUpdated(component);
                    if (command >= 1400 && command < 1500) {
                        let signature = requireNonNull(arrayAtObj(ScriptRunner.stringStack, --ssp));
                        let ids: Int32Array | null = null;
                        if (signature.getLength() > 0 && signature.charAt(signature.getLength() - 1) === 89) {
                            const count = arrayAtI32(ScriptRunner.intStack, --isp);
                            if (count > 0) {
                                ids = new Int32Array(count);
                                for (let i = count - 1; i >= 0; i--) ids[i] = arrayAtI32(ScriptRunner.intStack, --isp);
                            }
                            signature = signature.substring(0, signature.getLength() - 1);
                        }
                        let args: Hook | null = new Array((signature.getLength() + 1) | 0).fill(null);
                        for (let i = args.length - 1; i >= 1; i--) {
                            args[i] = signature.charAt(i - 1) === 115 ? arrayAtObj(ScriptRunner.stringStack, --ssp) : arrayAtI32(ScriptRunner.intStack, --isp);
                        }
                        const scriptId = arrayAtI32(ScriptRunner.intStack, --isp);
                        if (scriptId === -1) args = null;
                        else args[0] = scriptId;
                        const c = requireNonNull(component);
                        // HD h.a sets be.T before dispatch. SD gh.a sets aj.i after the hook stores.
                        if (glJar) c.hasHook = true;
                        switch (command) {
                            case 1400:
                                c.onClick = args;
                                break;
                            case 1401:
                                c.onHold = args;
                                break;
                            case 1402:
                                c.onRelease = args;
                                break;
                            case 1403:
                                c.onMouseOver = args;
                                break;
                            case 1404:
                                c.onMouseLeave = args;
                                break;
                            case 1405:
                                c.onDrag = args;
                                break;
                            case 1406:
                                c.onTargetLeave = args;
                                break;
                            case 1407:
                                c.varTriggers = ids;
                                c.onVarTransmit = args;
                                break;
                            case 1408:
                                c.onTimer = args;
                                break;
                            case 1409:
                                c.onOp = args;
                                break;
                            case 1410:
                                c.onDragComplete = args;
                                break;
                            case 1411:
                                c.onClickRepeat = args;
                                break;
                            case 1412:
                                c.onMouseRepeat = args;
                                break;
                            case 1414:
                                if (glJar) {
                                    c.invTriggers = ids;
                                    c.onInvTransmit = args;
                                    break;
                                }
                                c.onInvTransmit = args;
                                c.invTriggers = ids;
                                break;
                            case 1415:
                                c.statTriggers = ids;
                                c.onStatTransmit = args;
                                break;
                            case 1416:
                                c.onTargetEnter = args;
                                break;
                            case 1417:
                                c.onScrollWheel = args;
                                break;
                            case 1418:
                                c.onChatTransmit = args;
                                break;
                            case 1419:
                                c.onKey = args;
                                break;
                            case 1420:
                                c.onFriendTransmit = args;
                                break;
                            case 1421:
                                c.onClanTransmit = args;
                                break;
                            case 1422:
                                c.onMiscTransmit = args;
                                break;
                            case 1423:
                                c.onDialogAbort = args;
                                break;
                            case 1424:
                                c.onSubChange = args;
                                break;
                            case 1425:
                                c.onStockTransmit = args;
                                break;
                            case 1426:
                                c.onCamFinished = args;
                                break;
                            case 1427:
                                c.onResize = args;
                                break;
                            case 1428:
                                c.onVarcTransmit = args;
                                c.varcTriggers = ids;
                                break;
                            case 1429:
                                if (glJar) {
                                    c.varcstrTriggers = ids;
                                    c.onVarcstrTransmit = args;
                                    break;
                                }
                                c.onVarcstrTransmit = args;
                                c.varcstrTriggers = ids;
                                break;
                        }
                        if (!glJar) c.hasHook = true;
                        continue;
                    }
                    switch (command) {
                        case 1000: {
                            isp -= 4;
                            const baseX = arrayAtI32(ScriptRunner.intStack, isp);
                            const c = requireNonNull(component);
                            c.baseX = baseX;
                            c.baseY = arrayAtI32(ScriptRunner.intStack, isp + 1);
                            let y = arrayAtI32(ScriptRunner.intStack, isp + 3);
                            let x = arrayAtI32(ScriptRunner.intStack, isp + 2);
                            if (y < 0) y = 0;
                            else if (y > 5) y = 5;
                            c.yMode = y;
                            if (x < 0) x = 0;
                            else if (x > 5) x = 5;
                            c.xMode = x;
                            Client.ComponentUpdated(c);
                            Client.InterfaceCalculateSizeAndPosComponent(c);
                            if (c.childId === -1) DelayedStateChange.clientPosition(c.id);
                            break;
                        }
                        case 1001: {
                            isp -= 4;
                            const baseWidth = arrayAtI32(ScriptRunner.intStack, isp);
                            const c = requireNonNull(component);
                            c.baseWidth = baseWidth;
                            c.baseHeight = arrayAtI32(ScriptRunner.intStack, isp + 1);
                            c.modelWidth = 0;
                            c.modelHeight = 0;
                            let y = arrayAtI32(ScriptRunner.intStack, isp + 3);
                            let x = arrayAtI32(ScriptRunner.intStack, isp + 2);
                            if (y < 0) y = 0;
                            else if (y > 4) y = 4;
                            c.heightMode = y;
                            if (x < 0) x = 0;
                            else if (x > 4) x = 4;
                            c.widthMode = x;
                            Client.ComponentUpdated(c);
                            Client.InterfaceCalculateSizeAndPosComponent(c);
                            if (c.type === 0) Client.InterfaceCalculateSizeAndPosSubcomponents(false, c);
                            break;
                        }
                        case 1003: {
                            const hidden = arrayAtI32(ScriptRunner.intStack, --isp) === 1;
                            const c = requireNonNull(component);
                            if (c.hidden !== hidden) {
                                c.hidden = hidden;
                                Client.ComponentUpdated(c);
                            }
                            if (c.childId === -1) DelayedStateChange.clientHidden(c.id);
                            break;
                        }
                        case 1004: {
                            isp -= 2;
                            const aspectWidth = arrayAtI32(ScriptRunner.intStack, isp);
                            const c = requireNonNull(component);
                            c.aspectWidth = aspectWidth;
                            c.aspectHeight = arrayAtI32(ScriptRunner.intStack, isp + 1);
                            Client.ComponentUpdated(c);
                            Client.InterfaceCalculateSizeAndPosComponent(c);
                            if (c.type === 0) Client.InterfaceCalculateSizeAndPosSubcomponents(false, c);
                            break;
                        }
                        case 1005: {
                            const noClickThrough = arrayAtI32(ScriptRunner.intStack, --isp) === 1;
                            const c = requireNonNull(component);
                            c.noClickThrough = noClickThrough;
                            break;
                        }
                        case 1100: {
                            isp -= 2;
                            const scrollX = arrayAtI32(ScriptRunner.intStack, isp);
                            const c = requireNonNull(component);
                            c.scrollX = scrollX;
                            if (((c.scrollWidth - c.width) | 0) < c.scrollX) c.scrollX = (c.scrollWidth - c.width) | 0;
                            if (c.scrollX < 0) c.scrollX = 0;
                            c.scrollY = arrayAtI32(ScriptRunner.intStack, isp + 1);
                            if (c.scrollY > ((c.scrollHeight - c.height) | 0)) c.scrollY = (c.scrollHeight - c.height) | 0;
                            if (c.scrollY < 0) c.scrollY = 0;
                            Client.ComponentUpdated(c);
                            if (c.childId === -1) DelayedStateChange.clientScroll(c.id);
                            break;
                        }
                        case 1101: {
                            const colour = arrayAtI32(ScriptRunner.intStack, --isp);
                            const c = requireNonNull(component);
                            c.colour = colour;
                            Client.ComponentUpdated(c);
                            if (c.childId === -1) DelayedStateChange.clientColour(c.id);
                            break;
                        }
                        case 1102: {
                            const fill = arrayAtI32(ScriptRunner.intStack, --isp) === 1;
                            const c = requireNonNull(component);
                            c.fill = fill;
                            Client.ComponentUpdated(c);
                            break;
                        }
                        case 1103: {
                            const transparency = arrayAtI32(ScriptRunner.intStack, --isp);
                            const c = requireNonNull(component);
                            c.transparency = transparency;
                            Client.ComponentUpdated(c);
                            break;
                        }
                        case 1104: {
                            const lineWidth = arrayAtI32(ScriptRunner.intStack, --isp);
                            const c = requireNonNull(component);
                            c.lineWidth = lineWidth;
                            Client.ComponentUpdated(c);
                            break;
                        }
                        case 1105: {
                            const spriteId = arrayAtI32(ScriptRunner.intStack, --isp);
                            const c = requireNonNull(component);
                            c.spriteId = spriteId;
                            Client.ComponentUpdated(c);
                            break;
                        }
                        case 1106: {
                            const spriteAngle = arrayAtI32(ScriptRunner.intStack, --isp);
                            const c = requireNonNull(component);
                            c.spriteAngle = spriteAngle;
                            Client.ComponentUpdated(c);
                            break;
                        }
                        case 1107: {
                            const spriteTiling = arrayAtI32(ScriptRunner.intStack, --isp) === 1;
                            const c = requireNonNull(component);
                            c.spriteTiling = spriteTiling;
                            Client.ComponentUpdated(c);
                            break;
                        }
                        case 1108: {
                            const c = requireNonNull(component);
                            c.modelType = 1;
                            c.modelId = arrayAtI32(ScriptRunner.intStack, --isp);
                            Client.ComponentUpdated(c);
                            if (c.childId === -1) DelayedStateChange.clientModel(c.id);
                            break;
                        }
                        case 1109: {
                            isp -= 6;
                            const modelOffsetX = arrayAtI32(ScriptRunner.intStack, isp);
                            const c = requireNonNull(component);
                            c.modelOffsetX = modelOffsetX;
                            c.modelOffsetY = arrayAtI32(ScriptRunner.intStack, isp + 1);
                            c.modelXAngle = arrayAtI32(ScriptRunner.intStack, isp + 2);
                            c.modelYAngle = arrayAtI32(ScriptRunner.intStack, isp + 3);
                            c.modelZAngle = arrayAtI32(ScriptRunner.intStack, isp + 4);
                            c.modelZoom = arrayAtI32(ScriptRunner.intStack, isp + 5);
                            Client.ComponentUpdated(c);
                            if (c.childId === -1) {
                                DelayedStateChange.clientChange(8, c.id);
                                DelayedStateChange.clientOffsets(c.id);
                            }
                            break;
                        }
                        case 1110: {
                            const seq = arrayAtI32(ScriptRunner.intStack, --isp);
                            const c = requireNonNull(component);
                            if (seq !== c.modelAnim) {
                                c.modelAnim = seq;
                                c.modelFrame = 0;
                                c.modelCycle = 0;
                                c.modelNext = 1;
                                Client.ComponentUpdated(c);
                            }
                            if (c.childId === -1) DelayedStateChange.clientAnimation(c.id);
                            break;
                        }
                        case 1111: {
                            const modelOrtho = arrayAtI32(ScriptRunner.intStack, --isp) === 1;
                            const c = requireNonNull(component);
                            c.modelOrtho = modelOrtho;
                            Client.ComponentUpdated(c);
                            break;
                        }
                        case 1112: {
                            const value = arrayAtObj(ScriptRunner.stringStack, --ssp);
                            const c = requireNonNull(component);
                            const previous = c.textValue;
                            const text = requireNonNull(value);
                            if (!text.equals(previous)) {
                                c.textValue = text;
                                Client.ComponentUpdated(c);
                            }
                            if (c.childId === -1) DelayedStateChange.clientText(c.id);
                            break;
                        }
                        case 1113: {
                            const fontId = arrayAtI32(ScriptRunner.intStack, --isp);
                            const c = requireNonNull(component);
                            c.fontId = fontId;
                            Client.ComponentUpdated(c);
                            break;
                        }
                        case 1114: {
                            isp -= 3;
                            const textAlignH = arrayAtI32(ScriptRunner.intStack, isp);
                            const c = requireNonNull(component);
                            c.textAlignH = textAlignH;
                            c.textAlignV = arrayAtI32(ScriptRunner.intStack, isp + 1);
                            c.lineSpacing = arrayAtI32(ScriptRunner.intStack, isp + 2);
                            Client.ComponentUpdated(c);
                            break;
                        }
                        case 1115: {
                            const textShadow = arrayAtI32(ScriptRunner.intStack, --isp) === 1;
                            const c = requireNonNull(component);
                            c.textShadow = textShadow;
                            Client.ComponentUpdated(c);
                            break;
                        }
                        case 1116: {
                            const outline = arrayAtI32(ScriptRunner.intStack, --isp);
                            const c = requireNonNull(component);
                            c.outline = outline;
                            Client.ComponentUpdated(c);
                            break;
                        }
                        case 1117: {
                            const spriteShadow = arrayAtI32(ScriptRunner.intStack, --isp);
                            const c = requireNonNull(component);
                            c.spriteShadow = spriteShadow;
                            Client.ComponentUpdated(c);
                            break;
                        }
                        case 1118: {
                            const vFlip = arrayAtI32(ScriptRunner.intStack, --isp) === 1;
                            const c = requireNonNull(component);
                            c.vFlip = vFlip;
                            Client.ComponentUpdated(c);
                            break;
                        }
                        case 1119: {
                            const hFlip = arrayAtI32(ScriptRunner.intStack, --isp) === 1;
                            const c = requireNonNull(component);
                            c.hFlip = hFlip;
                            Client.ComponentUpdated(c);
                            break;
                        }
                        case 1120: {
                            isp -= 2;
                            const scrollWidth = arrayAtI32(ScriptRunner.intStack, isp);
                            const c = requireNonNull(component);
                            c.scrollWidth = scrollWidth;
                            c.scrollHeight = arrayAtI32(ScriptRunner.intStack, isp + 1);
                            Client.ComponentUpdated(c);
                            if (c.type === 0) Client.InterfaceCalculateSizeAndPosSubcomponents(false, c);
                            break;
                        }
                        case 1121: {
                            if (glJar) {
                                isp -= 2;
                                const offset = (arrayAtI32(ScriptRunner.intStack, isp) << 16) >> 16;
                                requireNonNull(component).Vc = offset;
                                requireNonNull(component).o = (arrayAtI32(ScriptRunner.intStack, isp + 1) << 16) >> 16;
                                Client.ComponentUpdated(component);
                            } else {
                                Client.ComponentUpdated(component);
                                isp -= 2;
                            }
                            break;
                        }
                        case 1122: {
                            const spriteAlpha = arrayAtI32(ScriptRunner.intStack, --isp) === 1;
                            const c = requireNonNull(component);
                            c.spriteAlpha = spriteAlpha;
                            Client.ComponentUpdated(c);
                            break;
                        }
                        case 1123: {
                            const modelZoom = arrayAtI32(ScriptRunner.intStack, --isp);
                            const c = requireNonNull(component);
                            c.modelZoom = modelZoom;
                            Client.ComponentUpdated(c);
                            if (c.childId === -1) DelayedStateChange.clientChange(8, c.id);
                            break;
                        }
                        case 1200:
                        case 1205: {
                            isp -= 2;
                            const item = arrayAtI32(ScriptRunner.intStack, isp),
                                count = arrayAtI32(ScriptRunner.intStack, isp + 1);
                            const c = requireNonNull(component);
                            if (c.childId === -1) {
                                DelayedStateChange.clientObj(c.id);
                                DelayedStateChange.clientChange(8, c.id);
                                DelayedStateChange.clientOffsets(c.id);
                            }
                            if (item === -1) {
                                c.itemId = -1;
                                c.modelId = -1;
                                c.modelType = 1;
                                break;
                            }
                            c.itemCount = count;
                            c.itemId = item;
                            const obj = ObjType.List(item);
                            c.modelYAngle = obj.yAngle2d;
                            c.modelXAngle = obj.xAngle2d;
                            c.modelOffsetY = obj.yOffset2d;
                            c.modelOffsetX = obj.xOffset2d;
                            c.modelZAngle = obj.zAngle2d;
                            c.modelZoom = obj.zoom2d;
                            c.showItemCount = command !== 1205;
                            if (c.modelWidth > 0) c.modelZoom = intDivide(c.modelZoom << 5, c.modelWidth);
                            else if (c.baseWidth > 0) c.modelZoom = intDivide(c.modelZoom << 5, c.baseWidth);
                            break;
                        }
                        case 1201: {
                            const c = requireNonNull(component);
                            c.modelType = 2;
                            c.modelId = arrayAtI32(ScriptRunner.intStack, --isp);
                            if (c.childId === -1) DelayedStateChange.clientModel(c.id);
                            break;
                        }
                        case 1202: {
                            const c = requireNonNull(component);
                            c.modelType = 3;
                            c.modelId = requireNonNull(requireNonNull(Client.localPlayer).appearance).getHeadId();
                            if (c.childId === -1) DelayedStateChange.clientModel(c.id);
                            break;
                        }
                        case 1203: {
                            const c = requireNonNull(component);
                            c.modelType = 6;
                            c.modelId = arrayAtI32(ScriptRunner.intStack, --isp);
                            if (c.childId === -1) DelayedStateChange.clientModel(c.id);
                            break;
                        }
                        case 1204: {
                            const c = requireNonNull(component);
                            c.modelType = 5;
                            c.modelId = arrayAtI32(ScriptRunner.intStack, --isp);
                            if (c.childId === -1) DelayedStateChange.clientModel(c.id);
                            break;
                        }
                        case 1300: {
                            const index = (arrayAtI32(ScriptRunner.intStack, --isp) - 1) | 0;
                            if (index < 0 || index > 9) ssp--;
                            else {
                                const op = arrayAtObj(ScriptRunner.stringStack, --ssp);
                                requireNonNull(component).SetOpName(index, op);
                            }
                            break;
                        }
                        case 1301: {
                            isp -= 2;
                            const child = arrayAtI32(ScriptRunner.intStack, isp + 1),
                                id = arrayAtI32(ScriptRunner.intStack, isp);
                            const parent = InterfaceList.GetComponent(id, child);
                            requireNonNull(component).dragParent = parent;
                            break;
                        }
                        case 1302: {
                            const dragRender = arrayAtI32(ScriptRunner.intStack, --isp) === 1;
                            const c = requireNonNull(component);
                            c.dragRender = dragRender;
                            break;
                        }
                        case 1303: {
                            const dragDeadZone = arrayAtI32(ScriptRunner.intStack, --isp);
                            const c = requireNonNull(component);
                            c.dragDeadZone = dragDeadZone;
                            break;
                        }
                        case 1304: {
                            const dragDeadTime = arrayAtI32(ScriptRunner.intStack, --isp);
                            const c = requireNonNull(component);
                            c.dragDeadTime = dragDeadTime;
                            break;
                        }
                        case 1305: {
                            const opBaseValue = arrayAtObj(ScriptRunner.stringStack, --ssp);
                            const c = requireNonNull(component);
                            c.opBaseValue = opBaseValue;
                            break;
                        }
                        case 1306: {
                            const targetVerbValue = arrayAtObj(ScriptRunner.stringStack, --ssp);
                            const c = requireNonNull(component);
                            c.targetVerbValue = targetVerbValue;
                            break;
                        }
                        case 1307:
                            requireNonNull(component).operationNames = null;
                            break;
                        case 1308: {
                            const targetLeaveCursor = arrayAtI32(ScriptRunner.intStack, --isp);
                            const c = requireNonNull(component);
                            c.targetLeaveCursor = targetLeaveCursor;
                            c.targetOverCursor = arrayAtI32(ScriptRunner.intStack, --isp);
                            break;
                        }
                        case 1309: {
                            const cursor = arrayAtI32(ScriptRunner.intStack, --isp),
                                op = arrayAtI32(ScriptRunner.intStack, --isp);
                            if (op >= 1 && op <= 10) requireNonNull(component).setOpCursor(op - 1, cursor);
                            break;
                        }
                        case 1500:
                            arrayPutI32(ScriptRunner.intStack, isp++, requireNonNull(component).x);
                            break;
                        case 1501:
                            arrayPutI32(ScriptRunner.intStack, isp++, requireNonNull(component).y);
                            break;
                        case 1502:
                            arrayPutI32(ScriptRunner.intStack, isp++, requireNonNull(component).width);
                            break;
                        case 1503:
                            arrayPutI32(ScriptRunner.intStack, isp++, requireNonNull(component).height);
                            break;
                        case 1504:
                            arrayPutI32(ScriptRunner.intStack, isp++, +requireNonNull(component).hidden);
                            break;
                        case 1505:
                            arrayPutI32(ScriptRunner.intStack, isp++, requireNonNull(component).parentId);
                            break;
                        case 1600:
                            arrayPutI32(ScriptRunner.intStack, isp++, requireNonNull(component).scrollX);
                            break;
                        case 1601:
                            arrayPutI32(ScriptRunner.intStack, isp++, requireNonNull(component).scrollY);
                            break;
                        case 1602:
                            arrayPutObj(ScriptRunner.stringStack, ssp++, requireNonNull(component).textValue);
                            break;
                        case 1603:
                            arrayPutI32(ScriptRunner.intStack, isp++, requireNonNull(component).scrollWidth);
                            break;
                        case 1604:
                            arrayPutI32(ScriptRunner.intStack, isp++, requireNonNull(component).scrollHeight);
                            break;
                        case 1605:
                            arrayPutI32(ScriptRunner.intStack, isp++, requireNonNull(component).modelZoom);
                            break;
                        case 1606:
                            arrayPutI32(ScriptRunner.intStack, isp++, requireNonNull(component).modelXAngle);
                            break;
                        case 1607:
                            arrayPutI32(ScriptRunner.intStack, isp++, requireNonNull(component).modelZAngle);
                            break;
                        case 1608:
                            arrayPutI32(ScriptRunner.intStack, isp++, requireNonNull(component).modelYAngle);
                            break;
                        case 1609:
                            arrayPutI32(ScriptRunner.intStack, isp++, requireNonNull(component).transparency);
                            break;
                        case 1610:
                            arrayPutI32(ScriptRunner.intStack, isp++, requireNonNull(component).modelOffsetX);
                            break;
                        case 1611:
                            arrayPutI32(ScriptRunner.intStack, isp++, requireNonNull(component).modelOffsetY);
                            break;
                        case 1612:
                            arrayPutI32(ScriptRunner.intStack, isp++, requireNonNull(component).spriteId);
                            break;
                        case 1700:
                            arrayPutI32(ScriptRunner.intStack, isp++, requireNonNull(component).itemId);
                            break;
                        case 1701: {
                            const c = requireNonNull(component);
                            if (c.itemId !== -1) arrayPutI32(ScriptRunner.intStack, isp++, c.itemCount);
                            else arrayPutI32(ScriptRunner.intStack, isp++, 0);
                            break;
                        }
                        case 1702:
                            arrayPutI32(ScriptRunner.intStack, isp++, requireNonNull(component).childId);
                            break;
                        case 1703: {
                            if (!explicit) throw new Error();
                            const c = requireNonNull(component);
                            if (c.childSlots === null) {
                                arrayPutI32(ScriptRunner.intStack, isp++, 0);
                            } else {
                                let count = requireNonNull(c.childSlots).length;
                                for (let i = 0; i < requireNonNull(c.childSlots).length; i++) {
                                    if (arrayAtObj(c.childSlots, i) === null) {
                                        count = i;
                                        break;
                                    }
                                }
                                arrayPutI32(ScriptRunner.intStack, isp++, count);
                            }
                            break;
                        }
                        case 1800:
                            arrayPutI32(ScriptRunner.intStack, isp++, Client.GetActive(component).getTargetMask());
                            break;
                        case 1801: {
                            const index = (arrayAtI32(ScriptRunner.intStack, --isp) - 1) | 0;
                            const c = requireNonNull(component);
                            if (c.operationNames !== null && index < requireNonNull(c.operationNames).length && arrayAtObj(c.operationNames, index) !== null) {
                                arrayPutObj(ScriptRunner.stringStack, ssp++, arrayAtObj(c.operationNames, index));
                            } else {
                                arrayPutObj(ScriptRunner.stringStack, ssp++, ScriptRunner.emptyString);
                            }
                            break;
                        }
                        case 1802: {
                            const c = requireNonNull(component);
                            if (c.opBaseValue !== null) arrayPutObj(ScriptRunner.stringStack, ssp++, c.opBaseValue);
                            else arrayPutObj(ScriptRunner.stringStack, ssp++, ScriptRunner.emptyString);
                            break;
                        }
                        default:
                            throw new Error();
                    }
                    continue;
                }
                switch (opcode) {
                    case 0:
                        arrayPutI32(ScriptRunner.intStack, isp++, arrayAtI32(operands, pc));
                        break;
                    case 1: {
                        const varp = arrayAtI32(operands, pc);
                        arrayPutI32(ScriptRunner.intStack, isp++, arrayAtI32(ClientVarCache.m_var, varp));
                        break;
                    }
                    case 2: {
                        const varp = arrayAtI32(operands, pc);
                        ClientVarCache.setClient(varp, arrayAtI32(ScriptRunner.intStack, --isp));
                        break;
                    }
                    case 3:
                        arrayPutObj(ScriptRunner.stringStack, ssp++, arrayAtObj(script.stringOperands, pc));
                        break;
                    case 6:
                        pc = (pc + arrayAtI32(operands, pc)) | 0;
                        break;
                    case 7:
                        isp -= 2;
                        if (arrayAtI32(ScriptRunner.intStack, isp + 1) !== arrayAtI32(ScriptRunner.intStack, isp)) pc = (pc + arrayAtI32(operands, pc)) | 0;
                        break;
                    case 8:
                        isp -= 2;
                        if (arrayAtI32(ScriptRunner.intStack, isp) === arrayAtI32(ScriptRunner.intStack, isp + 1)) pc = (pc + arrayAtI32(operands, pc)) | 0;
                        break;
                    case 9:
                        isp -= 2;
                        if (arrayAtI32(ScriptRunner.intStack, isp) < arrayAtI32(ScriptRunner.intStack, isp + 1)) pc = (pc + arrayAtI32(operands, pc)) | 0;
                        break;
                    case 10:
                        isp -= 2;
                        if (arrayAtI32(ScriptRunner.intStack, isp + 1) < arrayAtI32(ScriptRunner.intStack, isp)) pc = (pc + arrayAtI32(operands, pc)) | 0;
                        break;
                    case 25: {
                        const varbit = arrayAtI32(operands, pc);
                        arrayPutI32(ScriptRunner.intStack, isp++, ClientVarCache.GetVarbit(varbit));
                        break;
                    }
                    case 27: {
                        const varbit = arrayAtI32(operands, pc);
                        ClientVarCache.SetVarbit(varbit, arrayAtI32(ScriptRunner.intStack, --isp));
                        break;
                    }
                    case 31:
                        isp -= 2;
                        if (arrayAtI32(ScriptRunner.intStack, isp) <= arrayAtI32(ScriptRunner.intStack, isp + 1)) pc = (pc + arrayAtI32(operands, pc)) | 0;
                        break;
                    case 32:
                        isp -= 2;
                        if (arrayAtI32(ScriptRunner.intStack, isp) >= arrayAtI32(ScriptRunner.intStack, isp + 1)) pc = (pc + arrayAtI32(operands, pc)) | 0;
                        break;
                    case 21: {
                        if (ScriptRunner.frameCount === 0) return;
                        const frame = requireNonNull(arrayAtObj(ScriptRunner.frames, --ScriptRunner.frameCount));
                        script = frame.script;
                        if (glJar) {
                            ScriptRunner.intLocals = frame.ints;
                            script = requireNonNull(script);
                            opcodes = script.opcodes;
                            pc = frame.pc;
                            ScriptRunner.stringLocals = frame.strings;
                            operands = script.intOperands;
                        } else {
                            ScriptRunner.stringLocals = frame.strings;
                            script = requireNonNull(script);
                            operands = script.intOperands;
                            pc = frame.pc;
                            ScriptRunner.intLocals = frame.ints;
                            opcodes = script.opcodes;
                        }
                        break;
                    }
                    case 33:
                        arrayPutI32(ScriptRunner.intStack, isp++, arrayAtI32(ScriptRunner.intLocals, arrayAtI32(operands, pc)));
                        break;
                    case 34:
                        arrayPutI32(ScriptRunner.intLocals, arrayAtI32(operands, pc), arrayAtI32(ScriptRunner.intStack, --isp));
                        break;
                    case 35:
                        arrayPutObj(ScriptRunner.stringStack, ssp++, arrayAtObj(ScriptRunner.stringLocals, arrayAtI32(operands, pc)));
                        break;
                    case 36:
                        arrayPutObj(ScriptRunner.stringLocals, arrayAtI32(operands, pc), arrayAtObj(ScriptRunner.stringStack, --ssp));
                        break;
                    case 37: {
                        const count = arrayAtI32(operands, pc);
                        ssp = (ssp - count) | 0;
                        const text = JagString.joinRange(count, ScriptRunner.stringStack, ssp);
                        arrayPutObj(ScriptRunner.stringStack, ssp++, text);
                        break;
                    }
                    case 38:
                        isp--;
                        break;
                    case 39:
                        ssp--;
                        break;
                    case 40: {
                        const target = requireNonNull(this.loadScript(arrayAtI32(operands, pc)));
                        const ints = new Int32Array(target.intLocals);
                        const strings = new Array<JagString | null>(target.stringLocals).fill(null);
                        for (let i = 0; i < target.intArgs; i++) {
                            arrayPutI32(ints, i, arrayAtI32(ScriptRunner.intStack, isp - target.intArgs + i));
                        }
                        for (let i = 0; i < target.stringArgs; i++) {
                            arrayPutObj(strings, i, arrayAtObj(ScriptRunner.stringStack, ssp - target.stringArgs + i));
                        }
                        let frame: ClientGosubFrame;
                        if (glJar) {
                            isp = (isp - target.intArgs) | 0;
                            ssp = (ssp - target.stringArgs) | 0;
                            frame = new ClientGosubFrame();
                            frame.strings = ScriptRunner.stringLocals;
                            frame.ints = ScriptRunner.intLocals;
                            frame.pc = pc;
                            frame.script = script;
                        } else {
                            ssp = (ssp - target.stringArgs) | 0;
                            isp = (isp - target.intArgs) | 0;
                            frame = new ClientGosubFrame();
                            frame.script = script;
                            frame.pc = pc;
                            frame.strings = ScriptRunner.stringLocals;
                            frame.ints = ScriptRunner.intLocals;
                        }
                        if (ScriptRunner.frameCount >= ScriptRunner.frames.length) throw new Error();
                        if (glJar) {
                            script = target;
                            pc = -1;
                        } else {
                            pc = -1;
                            script = target;
                        }
                        arrayPutObj(ScriptRunner.frames, ScriptRunner.frameCount++, frame);
                        ScriptRunner.intLocals = ints;
                        if (glJar) {
                            operands = script.intOperands;
                            opcodes = script.opcodes;
                            ScriptRunner.stringLocals = strings;
                        } else {
                            ScriptRunner.stringLocals = strings;
                            opcodes = script.opcodes;
                            operands = script.intOperands;
                        }
                        break;
                    }
                    case 42:
                        arrayPutI32(ScriptRunner.intStack, isp++, arrayAtI32(DelayedStateChange.varcs, arrayAtI32(operands, pc)));
                        break;
                    case 43: {
                        const varc = arrayAtI32(operands, pc);
                        arrayPutI32(DelayedStateChange.varcs, varc, arrayAtI32(ScriptRunner.intStack, --isp));
                        DelayedStateChange.clientVarc(varc);
                        break;
                    }
                    case 44: {
                        const array = arrayAtI32(operands, pc) >> 16;
                        const type = arrayAtI32(operands, pc) & 65535;
                        const length = arrayAtI32(ScriptRunner.intStack, --isp);
                        if (length < 0 || length > 5000) throw new Error();
                        arrayPutI32(ScriptRunner.lengths, array, length);
                        const value = type === 105 ? 0 : -1;
                        for (let i = 0; i < length; i++) arrayPutI32(arrayAtObj(ScriptRunner.arrays, array), i, value);
                        break;
                    }
                    case 45: {
                        const array = arrayAtI32(operands, pc);
                        const i = arrayAtI32(ScriptRunner.intStack, --isp);
                        if (i < 0 || i >= arrayAtI32(ScriptRunner.lengths, array)) throw new Error();
                        arrayPutI32(ScriptRunner.intStack, isp++, arrayAtI32(arrayAtObj(ScriptRunner.arrays, array), i));
                        break;
                    }
                    case 46: {
                        isp -= 2;
                        const array = arrayAtI32(operands, pc);
                        const i = arrayAtI32(ScriptRunner.intStack, isp);
                        if (i < 0 || i >= arrayAtI32(ScriptRunner.lengths, array)) throw new Error();
                        arrayPutI32(arrayAtObj(ScriptRunner.arrays, array), i, arrayAtI32(ScriptRunner.intStack, isp + 1));
                        break;
                    }
                    case 47: {
                        const value = arrayAtObj(DelayedStateChange.varcStrings, arrayAtI32(operands, pc));
                        arrayPutObj(ScriptRunner.stringStack, ssp++, value ?? ScriptRunner.nullString);
                        break;
                    }
                    case 48: {
                        const varcstr = arrayAtI32(operands, pc);
                        arrayPutObj(DelayedStateChange.varcStrings, varcstr, arrayAtObj(ScriptRunner.stringStack, --ssp));
                        DelayedStateChange.clientVarcString(varcstr);
                        break;
                    }
                    case 51: {
                        const table = arrayAtObj(script.switches, arrayAtI32(operands, pc));
                        const key = arrayAtI32(ScriptRunner.intStack, --isp);
                        const jump = requireNonNull(table).get(BigInt(key));
                        if (jump !== null && !(jump instanceof IntNode)) throw new TypeError('Expected IntNode');
                        if (jump !== null) pc = (pc + jump.value) | 0;
                        break;
                    }
                    case 100: {
                        isp -= 3;
                        const id = arrayAtI32(ScriptRunner.intStack, isp),
                            type = arrayAtI32(ScriptRunner.intStack, isp + 1);
                        const child = arrayAtI32(ScriptRunner.intStack, isp + 2);
                        if (type === 0) throw new Error();
                        const parent = requireNonNull(IfType.Get(id));
                        if (parent.childSlots === null) parent.childSlots = new Array<IfType | null>((child + 1) | 0).fill(null);
                        if (parent.childSlots.length <= child) {
                            const expanded = new Array<IfType | null>((child + 1) | 0).fill(null);
                            for (let i = 0; i < parent.childSlots.length; i++) expanded[i] = parent.childSlots[i];
                            parent.childSlots = expanded;
                        }
                        if (child > 0 && arrayAtObj(parent.childSlots, child - 1) === null) throw new Error('Gap at:' + (child - 1));
                        const c = new IfType();
                        c.if3 = true;
                        c.childId = child;
                        c.type = type;
                        c.parentId = c.id = parent.id;
                        arrayPutObj(parent.childSlots, child, c);
                        ScriptRunner[active] = c;
                        Client.ComponentUpdated(parent);
                        break;
                    }
                    case 101: {
                        const c = requireNonNull(ScriptRunner[active]);
                        if (c.childId === -1) throw new Error(extendedOperand === 1 ? 'Tried to .cc_delete static .active-component!' : 'Tried to cc_delete static active-component!');
                        const parent = requireNonNull(IfType.Get(c.id));
                        arrayPutObj(parent.childSlots, c.childId, null);
                        Client.ComponentUpdated(parent);
                        break;
                    }
                    case 102: {
                        const c = requireNonNull(IfType.Get(arrayAtI32(ScriptRunner.intStack, --isp)));
                        c.childSlots = null;
                        Client.ComponentUpdated(c);
                        break;
                    }
                    case 200: {
                        isp -= 2;
                        const id = arrayAtI32(ScriptRunner.intStack, isp),
                            child = arrayAtI32(ScriptRunner.intStack, isp + 1);
                        const c = InterfaceList.GetComponent(id, child);
                        if (c !== null && child !== -1) {
                            arrayPutI32(ScriptRunner.intStack, isp++, 1);
                            ScriptRunner[active] = c;
                        } else arrayPutI32(ScriptRunner.intStack, isp++, 0);
                        break;
                    }
                    case 201: {
                        const c = IfType.Get(arrayAtI32(ScriptRunner.intStack, --isp));
                        arrayPutI32(ScriptRunner.intStack, isp++, +(c !== null));
                        if (c !== null) ScriptRunner[active] = c;
                        break;
                    }
                    case 403: {
                        isp -= 2;
                        const kit = arrayAtI32(ScriptRunner.intStack, isp + 1);
                        const bodyPart = arrayAtI32(ScriptRunner.intStack, isp);
                        let found = false;
                        for (let part = 0; part < requireNonNull(PlayerModel.maleKitBodyParts).length; part++) {
                            if (arrayAtI32(PlayerModel.maleKitBodyParts, part) === bodyPart) {
                                requireNonNull(requireNonNull(Client.localPlayer).appearance).setKit(part, kit);
                                found = true;
                                break;
                            }
                        }
                        if (found) break;
                        for (let part = 0; part < requireNonNull(PlayerModel.femaleBodyParts).length; part++) {
                            if (arrayAtI32(PlayerModel.femaleBodyParts, part) === bodyPart) {
                                requireNonNull(requireNonNull(Client.localPlayer).appearance).setKit(part, kit);
                                break;
                            }
                        }
                        break;
                    }
                    case 404: {
                        isp -= 2;
                        const colour = arrayAtI32(ScriptRunner.intStack, isp + 1),
                            part = arrayAtI32(ScriptRunner.intStack, isp);
                        requireNonNull(requireNonNull(Client.localPlayer).appearance).setColour(part, colour);
                        break;
                    }
                    case 410: {
                        const female = arrayAtI32(ScriptRunner.intStack, --isp) !== 0;
                        requireNonNull(requireNonNull(Client.localPlayer).appearance).setFemale(female);
                        break;
                    }
                    case 2702: {
                        const id = arrayAtI32(ScriptRunner.intStack, --isp);
                        const sub = InterfaceList.subInterfaces.get(BigInt(id));
                        if (sub !== null && !(sub instanceof SubInterface)) throw new TypeError('ClassCastException: not a SubInterface');
                        arrayPutI32(ScriptRunner.intStack, isp++, +(sub !== null));
                        break;
                    }
                    case 2704:
                    case 2705: {
                        isp -= 2;
                        let group: number, id: number;
                        if (glJar) {
                            id = arrayAtI32(ScriptRunner.intStack, isp);
                            group = arrayAtI32(ScriptRunner.intStack, isp + 1);
                        } else {
                            group = arrayAtI32(ScriptRunner.intStack, isp + 1);
                            id = arrayAtI32(ScriptRunner.intStack, isp);
                        }
                        const sub = InterfaceList.subInterfaces.get(BigInt(id));
                        if (sub !== null && !(sub instanceof SubInterface)) throw new TypeError('ClassCastException: not a SubInterface');
                        if (sub !== null && sub.group === group) arrayPutI32(ScriptRunner.intStack, isp++, 1);
                        else arrayPutI32(ScriptRunner.intStack, isp++, 0);
                        break;
                    }
                    case 3100:
                        Client.AddChat(arrayAtObj(ScriptRunner.stringStack, --ssp), ScriptRunner.emptyString, 0);
                        break;
                    case 3101:
                        isp -= 2;
                        Client.TriggerPlayerAnim(arrayAtI32(ScriptRunner.intStack, isp), arrayAtI32(ScriptRunner.intStack, isp + 1), requireNonNull(Client.localPlayer));
                        break;
                    case 3103: {
                        const pending = Client.CloseModal(undefined, this);
                        if (pending instanceof Promise) yield pending;
                        break;
                    }
                    case 3104: {
                        const input = requireNonNull(arrayAtObj(ScriptRunner.stringStack, --ssp));
                        const value = input.isDecimal() ? input.decimal() : 0;
                        Client.out.pHead(23);
                        Client.out.p4(value);
                        break;
                    }
                    case 3105: {
                        const name = arrayAtObj(ScriptRunner.stringStack, --ssp);
                        Client.out.pHead(244);
                        Client.out.p8(requireNonNull(name).toBase37());
                        break;
                    }
                    case 3106: {
                        const input = arrayAtObj(ScriptRunner.stringStack, --ssp);
                        Client.out.pHead(65);
                        Client.out.p1((requireNonNull(input).getLength() + 1) | 0);
                        Client.out.pStringNoConversion(requireNonNull(input), 0);
                        break;
                    }
                    case 3107: {
                        let name: JagString | null, op: number;
                        if (glJar) {
                            op = arrayAtI32(ScriptRunner.intStack, --isp);
                            name = arrayAtObj(ScriptRunner.stringStack, --ssp);
                        } else {
                            name = arrayAtObj(ScriptRunner.stringStack, --ssp);
                            op = arrayAtI32(ScriptRunner.intStack, --isp);
                        }
                        Client.opPlayerByName(requireNonNull(name), op);
                        break;
                    }
                    case 3108:
                    case 3109: {
                        isp -= opcode === 3108 ? 3 : 2;
                        const x = arrayAtI32(ScriptRunner.intStack, isp);
                        if (glJar && opcode === 3109) {
                            const c = ScriptRunner[active];
                            const y = arrayAtI32(ScriptRunner.intStack, isp + 1);
                            Client.DragTryPickup(x, c, y);
                            break;
                        }
                        const y = arrayAtI32(ScriptRunner.intStack, isp + 1);
                        const c = opcode === 3108 ? IfType.Get(arrayAtI32(ScriptRunner.intStack, isp + 2)) : ScriptRunner[active];
                        Client.DragTryPickup(x, c, y);
                        break;
                    }
                    case 3110: {
                        const item = arrayAtI32(ScriptRunner.intStack, --isp);
                        Client.out.pHead(111);
                        Client.out.p2(item);
                        break;
                    }
                    case 3200: {
                        isp -= 3;
                        const loops = arrayAtI32(ScriptRunner.intStack, isp + 1);
                        const delay = arrayAtI32(ScriptRunner.intStack, isp + 2);
                        Client.PlaySynth(arrayAtI32(ScriptRunner.intStack, isp), loops, delay);
                        break;
                    }
                    case 3201:
                        Client.PlaySong(arrayAtI32(ScriptRunner.intStack, --isp));
                        break;
                    case 3202: {
                        isp -= 2;
                        Client.PlayJingle(arrayAtI32(ScriptRunner.intStack, isp), arrayAtI32(ScriptRunner.intStack, isp + 1));
                        break;
                    }
                    case 3300:
                        arrayPutI32(ScriptRunner.intStack, isp++, Client.loopCycle);
                        break;
                    // gh.a(Lwf;II)V, inventory queries
                    case 3301:
                    case 3302:
                    case 3303:
                    case 3313:
                    case 3314:
                    case 3315:
                    case 3331:
                    case 3332: {
                        isp -= 2;
                        let inv: number, arg: number;
                        if (glJar && (opcode === 3302 || opcode === 3303 || opcode === 3331)) {
                            arg = arrayAtI32(ScriptRunner.intStack, isp + 1);
                            inv = arrayAtI32(ScriptRunner.intStack, isp);
                        } else {
                            inv = arrayAtI32(ScriptRunner.intStack, isp);
                            arg = arrayAtI32(ScriptRunner.intStack, isp + 1);
                        }
                        if (opcode >= 3313 && opcode <= 3315) inv = (inv + 32768) | 0;
                        const stack = ScriptRunner.intStack,
                            out = isp++;
                        let value: number;
                        if (opcode === 3301 || opcode === 3313) value = ClientInvCache.GetType(inv, arg);
                        else if (opcode === 3302 || opcode === 3314) value = ClientInvCache.GetCount(inv, arg);
                        else if (opcode === 3303 || opcode === 3315) value = ClientInvCache.InvTotal(0, inv, arg);
                        else value = ClientInvCache.GetParamCount(arg, inv, opcode === 3332);
                        arrayPutI32(stack, out, value);
                        break;
                    }
                    case 3304:
                    case 3330: {
                        const key = arrayAtI32(ScriptRunner.intStack, --isp);
                        const out = isp++;
                        arrayPutI32(ScriptRunner.intStack, out, opcode === 3304 ? InvType.List(key).m_size : ClientInvCache.GetFreeSpace(key));
                        break;
                    }
                    case 3305:
                    case 3306:
                    case 3307: {
                        const skill = arrayAtI32(ScriptRunner.intStack, --isp);
                        const stack = ScriptRunner.intStack,
                            out = isp++;
                        const levels = opcode === 3305 ? Client.statEffectiveLevel : opcode === 3306 ? Client.statBaseLevel : Client.statXP;
                        arrayPutI32(stack, out, arrayAtI32(levels, skill));
                        break;
                    }
                    case 3308: {
                        const level = Client.playerLevel;
                        const x = (Client.mapBuildBaseX + (requireNonNull(Client.localPlayer).x >> 7)) | 0;
                        const z = glJar ? ((requireNonNull(Client.localPlayer).z >> 7) + Client.mapBuildBaseZ) | 0 : (Client.mapBuildBaseZ + (requireNonNull(Client.localPlayer).z >> 7)) | 0;
                        arrayPutI32(ScriptRunner.intStack, isp++, (z + (level << 28) + (x << 14)) | 0);
                        break;
                    }
                    case 3309: {
                        const coord = arrayAtI32(ScriptRunner.intStack, --isp);
                        arrayPutI32(ScriptRunner.intStack, isp++, (coord >> 14) & 16383);
                        break;
                    }
                    case 3310: {
                        const coord = arrayAtI32(ScriptRunner.intStack, --isp);
                        arrayPutI32(ScriptRunner.intStack, isp++, coord >> 28);
                        break;
                    }
                    case 3311: {
                        const coord = arrayAtI32(ScriptRunner.intStack, --isp);
                        arrayPutI32(ScriptRunner.intStack, isp++, coord & 16383);
                        break;
                    }
                    case 3312:
                        arrayPutI32(ScriptRunner.intStack, isp++, +Client.members);
                        break;
                    case 3316: {
                        if (Client.staffModLevel >= 2) arrayPutI32(ScriptRunner.intStack, isp++, Client.staffModLevel);
                        else arrayPutI32(ScriptRunner.intStack, isp++, 0);
                        break;
                    }
                    case 3317:
                        arrayPutI32(ScriptRunner.intStack, isp++, Client.rebootTimer);
                        break;
                    case 3318:
                        arrayPutI32(ScriptRunner.intStack, isp++, Client.selectedWorldId);
                        break;
                    case 3321:
                        arrayPutI32(ScriptRunner.intStack, isp++, Client.runenergy);
                        break;
                    case 3322:
                        arrayPutI32(ScriptRunner.intStack, isp++, Client.runWeight);
                        break;
                    case 3323:
                    case 3324: {
                        if (Client.blackmarks >= 5 && Client.blackmarks <= 9) arrayPutI32(ScriptRunner.intStack, isp++, opcode === 3323 ? 1 : Client.blackmarks);
                        else arrayPutI32(ScriptRunner.intStack, isp++, 0);
                        break;
                    }
                    case 3325:
                        arrayPutI32(ScriptRunner.intStack, isp++, +Client.playerMember);
                        break;
                    case 3326: {
                        const slot = isp++;
                        arrayPutI32(ScriptRunner.intStack, slot, requireNonNull(Client.localPlayer).combatLevel);
                        break;
                    }
                    case 3327: {
                        const slot = isp++;
                        arrayPutI32(ScriptRunner.intStack, slot, +requireNonNull(requireNonNull(Client.localPlayer).appearance).female);
                        break;
                    }
                    case 3328:
                        arrayPutI32(ScriptRunner.intStack, isp++, +(Client.underage && !Client.parentalChatConsent));
                        break;
                    case 3329:
                        arrayPutI32(ScriptRunner.intStack, isp++, +Client.mapQuickChat);
                        break;
                    case 3333:
                        arrayPutI32(ScriptRunner.intStack, isp++, Login.loginType);
                        break;
                    case 3335:
                        arrayPutI32(ScriptRunner.intStack, isp++, LocalisedText.language);
                        break;
                    case 3336: {
                        isp -= 4;
                        const x = arrayAtI32(ScriptRunner.intStack, isp + 1),
                            coord = arrayAtI32(ScriptRunner.intStack, isp);
                        const level = arrayAtI32(ScriptRunner.intStack, isp + 2),
                            z = arrayAtI32(ScriptRunner.intStack, isp + 3);
                        arrayPutI32(ScriptRunner.intStack, isp++, (coord + (x << 14) + (level << 28) + z) | 0);
                        break;
                    }
                    case 3337:
                        arrayPutI32(ScriptRunner.intStack, isp++, Client.affiliateId);
                        break;
                    case 3400: {
                        isp -= 2;
                        const id = arrayAtI32(ScriptRunner.intStack, isp);
                        const key = arrayAtI32(ScriptRunner.intStack, isp + 1);
                        const type = EnumType.List(id);
                        arrayPutObj(ScriptRunner.stringStack, ssp++, type.GetOutputString(key));
                        break;
                    }
                    case 3408: {
                        isp -= 4;
                        const input = arrayAtI32(ScriptRunner.intStack, isp);
                        const output = arrayAtI32(ScriptRunner.intStack, isp + 1);
                        let id: number, key: number;
                        if (glJar) {
                            key = arrayAtI32(ScriptRunner.intStack, isp + 3);
                            id = arrayAtI32(ScriptRunner.intStack, isp + 2);
                        } else {
                            id = arrayAtI32(ScriptRunner.intStack, isp + 2);
                            key = arrayAtI32(ScriptRunner.intStack, isp + 3);
                        }
                        const type = EnumType.List(id);
                        if (type.input !== input || type.m_outputType !== output) throw new Error('C3408-1');
                        if (output === 115) arrayPutObj(ScriptRunner.stringStack, ssp++, type.GetOutputString(key));
                        else arrayPutI32(ScriptRunner.intStack, isp++, type.getInt(key));
                        break;
                    }
                    case 3409: {
                        isp -= 3;
                        const id = arrayAtI32(ScriptRunner.intStack, isp + 1);
                        const output = arrayAtI32(ScriptRunner.intStack, isp);
                        const value = arrayAtI32(ScriptRunner.intStack, isp + 2);
                        if (id === -1) throw new Error('C3409-2');
                        const type = EnumType.List(id);
                        if (output !== type.m_outputType) throw new Error('C3409-1');
                        arrayPutI32(ScriptRunner.intStack, isp++, +type.containsInt(value));
                        break;
                    }
                    case 3410: {
                        const id = arrayAtI32(ScriptRunner.intStack, --isp);
                        const value = arrayAtObj(ScriptRunner.stringStack, --ssp);
                        if (id === -1) throw new Error('C3410-2');
                        const type = EnumType.List(id);
                        if (type.m_outputType !== 115) throw new Error('C3410-1');
                        arrayPutI32(ScriptRunner.intStack, isp++, +type.containsString(value));
                        break;
                    }
                    case 3411: {
                        const type = EnumType.List(arrayAtI32(ScriptRunner.intStack, --isp));
                        arrayPutI32(ScriptRunner.intStack, isp++, requireNonNull(type.entries).size());
                        break;
                    }
                    case 3600:
                        if (Client.friendState === 0) arrayPutI32(ScriptRunner.intStack, isp++, -2);
                        else if (Client.friendState === 1) arrayPutI32(ScriptRunner.intStack, isp++, -1);
                        else arrayPutI32(ScriptRunner.intStack, isp++, Client.friendCount);
                        break;
                    case 3601: {
                        const index = arrayAtI32(ScriptRunner.intStack, --isp);
                        if (Client.friendState !== 2 || index >= Client.friendCount) arrayPutObj(ScriptRunner.stringStack, ssp++, ScriptRunner.emptyString);
                        else arrayPutObj(ScriptRunner.stringStack, ssp++, arrayAtObj(Client.friendUsername, index));
                        break;
                    }
                    case 3602: {
                        const index = arrayAtI32(ScriptRunner.intStack, --isp);
                        if (Client.friendState !== 2 || index >= Client.friendCount) arrayPutI32(ScriptRunner.intStack, isp++, 0);
                        else arrayPutI32(ScriptRunner.intStack, isp++, arrayAtI32(Client.friendWorld, index));
                        break;
                    }
                    case 3603: {
                        const index = arrayAtI32(ScriptRunner.intStack, --isp);
                        if (Client.friendState === 2 && index < Client.friendCount) arrayPutI32(ScriptRunner.intStack, isp++, arrayAtI32(Client.friendRank, index));
                        else arrayPutI32(ScriptRunner.intStack, isp++, 0);
                        break;
                    }
                    case 3604: {
                        let name: JagString | null, rank: number;
                        if (glJar) {
                            rank = arrayAtI32(ScriptRunner.intStack, --isp);
                            name = arrayAtObj(ScriptRunner.stringStack, --ssp);
                        } else {
                            name = arrayAtObj(ScriptRunner.stringStack, --ssp);
                            rank = arrayAtI32(ScriptRunner.intStack, --isp);
                        }
                        Client.SetFriendRank(name, rank);
                        break;
                    }
                    case 3605:
                        Client.AddFriend(requireNonNull(arrayAtObj(ScriptRunner.stringStack, --ssp)).toBase37());
                        break;
                    case 3606:
                        Client.DelFriend(requireNonNull(arrayAtObj(ScriptRunner.stringStack, --ssp)).toBase37());
                        break;
                    case 3607:
                        Client.AddIgnore(requireNonNull(arrayAtObj(ScriptRunner.stringStack, --ssp)).toBase37(), 0);
                        break;
                    case 3608:
                        Client.DelIgnore(0, requireNonNull(arrayAtObj(ScriptRunner.stringStack, --ssp)).toBase37());
                        break;
                    case 3609: {
                        let name = requireNonNull(arrayAtObj(ScriptRunner.stringStack, --ssp));
                        if (name.startsWith(requireNonNull(ScriptRunner.crownTag0)) || name.startsWith(requireNonNull(ScriptRunner.img1Tag))) name = name.substringFrom(7);
                        arrayPutI32(ScriptRunner.intStack, isp++, +Client.IsFriend(name));
                        break;
                    }
                    case 3610: {
                        const index = arrayAtI32(ScriptRunner.intStack, --isp);
                        if (Client.friendState === 2 && index < Client.friendCount) arrayPutObj(ScriptRunner.stringStack, ssp++, arrayAtObj(Client.friendWorldName, index));
                        else arrayPutObj(ScriptRunner.stringStack, ssp++, ScriptRunner.emptyString);
                        break;
                    }
                    case 3611:
                        if (FriendChatChannel.channelName === null) arrayPutObj(ScriptRunner.stringStack, ssp++, ScriptRunner.emptyString);
                        else arrayPutObj(ScriptRunner.stringStack, ssp++, FriendChatChannel.channelName.formatName(0));
                        break;
                    case 3612:
                        if (FriendChatChannel.channelName === null) arrayPutI32(ScriptRunner.intStack, isp++, 0);
                        else arrayPutI32(ScriptRunner.intStack, isp++, FriendChatChannel.memberCount);
                        break;
                    case 3613: {
                        const index = arrayAtI32(ScriptRunner.intStack, --isp);
                        if (FriendChatChannel.channelName !== null && index < FriendChatChannel.memberCount) {
                            arrayPutObj(ScriptRunner.stringStack, ssp++, requireNonNull(requireNonNull(arrayAtObj(FriendChatChannel.members, index)).name).formatName(0));
                        } else arrayPutObj(ScriptRunner.stringStack, ssp++, ScriptRunner.emptyString);
                        break;
                    }
                    case 3614: {
                        const index = arrayAtI32(ScriptRunner.intStack, --isp);
                        if (FriendChatChannel.channelName === null || index >= FriendChatChannel.memberCount) arrayPutI32(ScriptRunner.intStack, isp++, 0);
                        else arrayPutI32(ScriptRunner.intStack, isp++, requireNonNull(arrayAtObj(FriendChatChannel.members, index)).world);
                        break;
                    }
                    case 3615: {
                        const index = arrayAtI32(ScriptRunner.intStack, --isp);
                        if (FriendChatChannel.channelName !== null && index < FriendChatChannel.memberCount) arrayPutI32(ScriptRunner.intStack, isp++, requireNonNull(arrayAtObj(FriendChatChannel.members, index)).rank);
                        else arrayPutI32(ScriptRunner.intStack, isp++, 0);
                        break;
                    }
                    case 3616:
                        arrayPutI32(ScriptRunner.intStack, isp++, FriendChatChannel.minKick);
                        break;
                    case 3617:
                        Client.FriendsChatKickUser(arrayAtObj(ScriptRunner.stringStack, --ssp));
                        break;
                    case 3618:
                        arrayPutI32(ScriptRunner.intStack, isp++, FriendChatChannel.selfRank);
                        break;
                    case 3619:
                        Client.FriendsChatJoinChat(requireNonNull(arrayAtObj(ScriptRunner.stringStack, --ssp)).toBase37());
                        break;
                    case 3620:
                        Client.FriendsChatLeaveChat();
                        break;
                    case 3621:
                        if (Client.friendState === 0) arrayPutI32(ScriptRunner.intStack, isp++, -1);
                        else arrayPutI32(ScriptRunner.intStack, isp++, Client.ignoreCount);
                        break;
                    case 3622: {
                        const index = arrayAtI32(ScriptRunner.intStack, --isp);
                        if (Client.friendState !== 0 && index < Client.ignoreCount) {
                            arrayPutObj(ScriptRunner.stringStack, ssp++, requireNonNull(JagString.fromBase37(arrayAtB64(Client.ignoreName37, index))).formatName(0));
                        } else arrayPutObj(ScriptRunner.stringStack, ssp++, ScriptRunner.emptyString);
                        break;
                    }
                    case 3623: {
                        let name = requireNonNull(arrayAtObj(ScriptRunner.stringStack, --ssp));
                        if (name.startsWith(requireNonNull(ScriptRunner.crownTag0)) || name.startsWith(requireNonNull(ScriptRunner.img1Tag))) name = name.substringFrom(7);
                        arrayPutI32(ScriptRunner.intStack, isp++, +Client.IsIgnored(0, name));
                        break;
                    }
                    case 3624: {
                        const index = arrayAtI32(ScriptRunner.intStack, --isp);
                        if (FriendChatChannel.members !== null && index < FriendChatChannel.memberCount) {
                            const name = requireNonNull(arrayAtObj(FriendChatChannel.members, index)).name;
                            const playerName = requireNonNull(Client.localPlayer).username;
                            if (requireNonNull(name).equalsIgnoreCase(playerName)) {
                                arrayPutI32(ScriptRunner.intStack, isp++, 1);
                                break;
                            }
                        }
                        arrayPutI32(ScriptRunner.intStack, isp++, 0);
                        break;
                    }
                    case 3625:
                        if (FriendChatChannel.ownerName === null) arrayPutObj(ScriptRunner.stringStack, ssp++, ScriptRunner.emptyString);
                        else arrayPutObj(ScriptRunner.stringStack, ssp++, FriendChatChannel.ownerName.formatName(0));
                        break;
                    case 3626: {
                        const index = arrayAtI32(ScriptRunner.intStack, --isp);
                        if (FriendChatChannel.channelName === null || index >= FriendChatChannel.memberCount) arrayPutObj(ScriptRunner.stringStack, ssp++, ScriptRunner.emptyString);
                        else arrayPutObj(ScriptRunner.stringStack, ssp++, requireNonNull(arrayAtObj(FriendChatChannel.members, index)).worldName);
                        break;
                    }
                    case 3627: {
                        const index = arrayAtI32(ScriptRunner.intStack, --isp);
                        if (Client.friendState === 2 && index >= 0 && index < Client.friendCount) arrayPutI32(ScriptRunner.intStack, isp++, arrayAtU8(Client.friendSameGame, index) !== 0 ? 1 : 0);
                        else arrayPutI32(ScriptRunner.intStack, isp++, 0);
                        break;
                    }
                    case 3628: {
                        let name = requireNonNull(arrayAtObj(ScriptRunner.stringStack, --ssp));
                        if (name.startsWith(requireNonNull(ScriptRunner.crownTag0)) || name.startsWith(requireNonNull(ScriptRunner.img1Tag))) name = name.substringFrom(7);
                        arrayPutI32(ScriptRunner.intStack, isp++, Client.getFriendIndex(name));
                        break;
                    }
                    case 3629:
                        arrayPutI32(ScriptRunner.intStack, isp++, Client.country);
                        break;
                    case 3903: {
                        const slot = arrayAtI32(ScriptRunner.intStack, --isp);
                        arrayPutI32(ScriptRunner.intStack, isp++, requireNonNull(arrayAtObj(Client.grandExchangeOffers, slot)).GetOfferType());
                        break;
                    }
                    case 3904: {
                        const slot = arrayAtI32(ScriptRunner.intStack, --isp);
                        arrayPutI32(ScriptRunner.intStack, isp++, requireNonNull(arrayAtObj(Client.grandExchangeOffers, slot)).m_item);
                        break;
                    }
                    case 3905: {
                        const slot = arrayAtI32(ScriptRunner.intStack, --isp);
                        arrayPutI32(ScriptRunner.intStack, isp++, requireNonNull(arrayAtObj(Client.grandExchangeOffers, slot)).m_price);
                        break;
                    }
                    case 3906: {
                        const slot = arrayAtI32(ScriptRunner.intStack, --isp);
                        arrayPutI32(ScriptRunner.intStack, isp++, requireNonNull(arrayAtObj(Client.grandExchangeOffers, slot)).m_addedCount);
                        break;
                    }
                    case 3907: {
                        const slot = arrayAtI32(ScriptRunner.intStack, --isp);
                        arrayPutI32(ScriptRunner.intStack, isp++, requireNonNull(arrayAtObj(Client.grandExchangeOffers, slot)).m_completedCount);
                        break;
                    }
                    case 3908: {
                        const slot = arrayAtI32(ScriptRunner.intStack, --isp);
                        arrayPutI32(ScriptRunner.intStack, isp++, requireNonNull(arrayAtObj(Client.grandExchangeOffers, slot)).m_completedGold);
                        break;
                    }
                    case 3909:
                        throw new Error();
                    case 3910: {
                        const slot = arrayAtI32(ScriptRunner.intStack, --isp);
                        const status = requireNonNull(arrayAtObj(Client.grandExchangeOffers, slot)).GetOfferStatus();
                        arrayPutI32(ScriptRunner.intStack, isp++, status === 0 ? 1 : 0);
                        break;
                    }
                    case 3911: {
                        const slot = arrayAtI32(ScriptRunner.intStack, --isp);
                        const status = requireNonNull(arrayAtObj(Client.grandExchangeOffers, slot)).GetOfferStatus();
                        arrayPutI32(ScriptRunner.intStack, isp++, status === 2 ? 1 : 0);
                        break;
                    }
                    case 3912: {
                        const slot = arrayAtI32(ScriptRunner.intStack, --isp);
                        const status = requireNonNull(arrayAtObj(Client.grandExchangeOffers, slot)).GetOfferStatus();
                        arrayPutI32(ScriptRunner.intStack, isp++, status === 5 ? 1 : 0);
                        break;
                    }
                    case 3913: {
                        const slot = arrayAtI32(ScriptRunner.intStack, --isp);
                        const status = requireNonNull(arrayAtObj(Client.grandExchangeOffers, slot)).GetOfferStatus();
                        arrayPutI32(ScriptRunner.intStack, isp++, status === 1 ? 1 : 0);
                        break;
                    }
                    case 4000: {
                        isp -= 2;
                        const a = arrayAtI32(ScriptRunner.intStack, isp);
                        const b = arrayAtI32(ScriptRunner.intStack, isp + 1);
                        arrayPutI32(ScriptRunner.intStack, isp++, (b + a) | 0);
                        break;
                    }
                    case 4001: {
                        isp -= 2;
                        const a = arrayAtI32(ScriptRunner.intStack, isp);
                        const b = arrayAtI32(ScriptRunner.intStack, isp + 1);
                        arrayPutI32(ScriptRunner.intStack, isp++, (a - b) | 0);
                        break;
                    }
                    case 4002: {
                        isp -= 2;
                        const first = arrayAtI32(ScriptRunner.intStack, glJar ? isp : isp + 1);
                        const second = arrayAtI32(ScriptRunner.intStack, glJar ? isp + 1 : isp);
                        arrayPutI32(ScriptRunner.intStack, isp++, Math.imul(first, second));
                        break;
                    }
                    case 4003: {
                        isp -= 2;
                        const a = arrayAtI32(ScriptRunner.intStack, isp);
                        const b = arrayAtI32(ScriptRunner.intStack, isp + 1);
                        arrayPutI32(ScriptRunner.intStack, isp++, intDivide(a, b));
                        break;
                    }
                    case 4004: {
                        const a = arrayAtI32(ScriptRunner.intStack, --isp);
                        arrayPutI32(ScriptRunner.intStack, isp++, doubleToInt(a * mathRandom.nextDouble()));
                        break;
                    }
                    case 4005: {
                        const a = arrayAtI32(ScriptRunner.intStack, --isp);
                        arrayPutI32(ScriptRunner.intStack, isp++, doubleToInt(((a + 1) | 0) * mathRandom.nextDouble()));
                        break;
                    }
                    case 4006: {
                        isp -= 5;
                        const a = arrayAtI32(ScriptRunner.intStack, isp);
                        const b = arrayAtI32(ScriptRunner.intStack, isp + 1);
                        let x0: number, x1: number;
                        if (glJar) {
                            x1 = arrayAtI32(ScriptRunner.intStack, isp + 3);
                            x0 = arrayAtI32(ScriptRunner.intStack, isp + 2);
                        } else {
                            x0 = arrayAtI32(ScriptRunner.intStack, isp + 2);
                            x1 = arrayAtI32(ScriptRunner.intStack, isp + 3);
                        }
                        const x = arrayAtI32(ScriptRunner.intStack, isp + 4);
                        arrayPutI32(ScriptRunner.intStack, isp++, (a + intDivide(Math.imul(x - x0, b - a), (x1 - x0) | 0)) | 0);
                        break;
                    }
                    case 4007: {
                        isp -= 2;
                        const a = BigInt(arrayAtI32(ScriptRunner.intStack, isp));
                        const b = BigInt(arrayAtI32(ScriptRunner.intStack, isp + 1));
                        arrayPutI32(ScriptRunner.intStack, isp++, Number(BigInt.asIntN(32, a + (a * b) / 100n)));
                        break;
                    }
                    case 4008: {
                        isp -= 2;
                        const a = arrayAtI32(ScriptRunner.intStack, isp);
                        const b = arrayAtI32(ScriptRunner.intStack, isp + 1);
                        arrayPutI32(ScriptRunner.intStack, isp++, a | (1 << b));
                        break;
                    }
                    case 4009: {
                        isp -= 2;
                        let a: number, b: number;
                        if (glJar) {
                            a = arrayAtI32(ScriptRunner.intStack, isp);
                            b = arrayAtI32(ScriptRunner.intStack, isp + 1);
                        } else {
                            b = arrayAtI32(ScriptRunner.intStack, isp + 1);
                            a = arrayAtI32(ScriptRunner.intStack, isp);
                        }
                        arrayPutI32(ScriptRunner.intStack, isp++, a & ~(1 << b));
                        break;
                    }
                    case 4010: {
                        isp -= 2;
                        const a = arrayAtI32(ScriptRunner.intStack, isp);
                        const b = arrayAtI32(ScriptRunner.intStack, isp + 1);
                        arrayPutI32(ScriptRunner.intStack, isp++, (a & (1 << b)) === 0 ? 0 : 1);
                        break;
                    }
                    case 4011: {
                        isp -= 2;
                        let a: number, b: number;
                        if (glJar) {
                            b = arrayAtI32(ScriptRunner.intStack, isp + 1);
                            a = arrayAtI32(ScriptRunner.intStack, isp);
                        } else {
                            a = arrayAtI32(ScriptRunner.intStack, isp);
                            b = arrayAtI32(ScriptRunner.intStack, isp + 1);
                        }
                        arrayPutI32(ScriptRunner.intStack, isp++, intRemainder(a, b));
                        break;
                    }
                    case 4012: {
                        isp -= 2;
                        const b = arrayAtI32(ScriptRunner.intStack, isp + 1);
                        const a = arrayAtI32(ScriptRunner.intStack, isp);
                        arrayPutI32(ScriptRunner.intStack, isp++, a === 0 ? 0 : doubleToInt(Math.pow(a, b)));
                        break;
                    }
                    case 4013: {
                        isp -= 2;
                        const b = arrayAtI32(ScriptRunner.intStack, isp + 1);
                        const a = arrayAtI32(ScriptRunner.intStack, isp);
                        arrayPutI32(ScriptRunner.intStack, isp++, a === 0 ? 0 : b === 0 ? 2147483647 : doubleToInt(Math.pow(a, 1 / b)));
                        break;
                    }
                    case 4014: {
                        isp -= 2;
                        const a = arrayAtI32(ScriptRunner.intStack, isp);
                        const b = arrayAtI32(ScriptRunner.intStack, isp + 1);
                        arrayPutI32(ScriptRunner.intStack, isp++, a & b);
                        break;
                    }
                    case 4015: {
                        isp -= 2;
                        const a = arrayAtI32(ScriptRunner.intStack, isp);
                        const b = arrayAtI32(ScriptRunner.intStack, isp + 1);
                        arrayPutI32(ScriptRunner.intStack, isp++, a | b);
                        break;
                    }
                    case 4016: {
                        isp -= 2;
                        const a = arrayAtI32(ScriptRunner.intStack, isp);
                        const b = arrayAtI32(ScriptRunner.intStack, isp + 1);
                        arrayPutI32(ScriptRunner.intStack, isp++, a < b ? a : b);
                        break;
                    }
                    case 4017: {
                        isp -= 2;
                        const b = arrayAtI32(ScriptRunner.intStack, isp + 1);
                        const a = arrayAtI32(ScriptRunner.intStack, isp);
                        arrayPutI32(ScriptRunner.intStack, isp++, b < a ? a : b);
                        break;
                    }
                    case 4018: {
                        isp -= 3;
                        const a = BigInt(arrayAtI32(ScriptRunner.intStack, isp));
                        const b = BigInt(arrayAtI32(ScriptRunner.intStack, isp + 1));
                        const c = BigInt(arrayAtI32(ScriptRunner.intStack, isp + 2));
                        arrayPutI32(ScriptRunner.intStack, isp++, Number(BigInt.asIntN(32, (c * a) / b)));
                        break;
                    }
                    case 4100: {
                        const text = arrayAtObj(ScriptRunner.stringStack, --ssp),
                            value = arrayAtI32(ScriptRunner.intStack, --isp);
                        arrayPutObj(ScriptRunner.stringStack, ssp++, JagString.join([text, JagString.fromInt(value)]));
                        break;
                    }
                    case 4101: {
                        ssp -= 2;
                        const first = arrayAtObj(ScriptRunner.stringStack, ssp),
                            second = arrayAtObj(ScriptRunner.stringStack, ssp + 1);
                        arrayPutObj(ScriptRunner.stringStack, ssp++, JagString.join([first, second]));
                        break;
                    }
                    case 4102: {
                        const text = arrayAtObj(ScriptRunner.stringStack, --ssp),
                            value = arrayAtI32(ScriptRunner.intStack, --isp);
                        arrayPutObj(ScriptRunner.stringStack, ssp++, JagString.join([text, JagString.fromSignedInt(value, true)]));
                        break;
                    }
                    case 4103: {
                        const text = arrayAtObj(ScriptRunner.stringStack, --ssp);
                        arrayPutObj(ScriptRunner.stringStack, ssp++, requireNonNull(text).toLowerCase());
                        break;
                    }
                    case 4104: {
                        const days = arrayAtI32(ScriptRunner.intStack, --isp);
                        ScriptRunner.calendar.setTimeInMillis(86400000n * (11745n + BigInt(days)));
                        const day = ScriptRunner.calendar.get(5);
                        const month = ScriptRunner.calendar.get(2);
                        const year = ScriptRunner.calendar.get(1);
                        arrayPutObj(ScriptRunner.stringStack, ssp++, JagString.join([JagString.fromInt(day), ScriptRunner.dateSeparator, arrayAtObj(ScriptRunner.months, month), ScriptRunner.dateSeparator, JagString.fromInt(year)]));
                        break;
                    }
                    case 4105: {
                        ssp -= 2;
                        const second = arrayAtObj(ScriptRunner.stringStack, ssp + 1),
                            first = arrayAtObj(ScriptRunner.stringStack, ssp);
                        if (requireNonNull(Client.localPlayer).appearance !== null && requireNonNull(requireNonNull(Client.localPlayer).appearance).female) {
                            arrayPutObj(ScriptRunner.stringStack, ssp++, second);
                        } else {
                            arrayPutObj(ScriptRunner.stringStack, ssp++, first);
                        }
                        break;
                    }
                    case 4106: {
                        const value = arrayAtI32(ScriptRunner.intStack, --isp);
                        arrayPutObj(ScriptRunner.stringStack, ssp++, JagString.fromInt(value));
                        break;
                    }
                    case 4107: {
                        ssp -= 2;
                        const first = arrayAtObj(ScriptRunner.stringStack, ssp),
                            second = arrayAtObj(ScriptRunner.stringStack, ssp + 1);
                        arrayPutI32(ScriptRunner.intStack, isp++, requireNonNull(first).compareCollated(requireNonNull(second)));
                        break;
                    }
                    case 4108: {
                        isp -= 2;
                        const text = arrayAtObj(ScriptRunner.stringStack, --ssp);
                        const width = arrayAtI32(ScriptRunner.intStack, isp);
                        const font = arrayAtI32(ScriptRunner.intStack, isp + 1);
                        arrayPutI32(ScriptRunner.intStack, isp++, SoftwareFont.getFontMetrics(font).getParagraphLineCount(text, width));
                        break;
                    }
                    case 4109: {
                        isp -= 2;
                        const text = arrayAtObj(ScriptRunner.stringStack, --ssp);
                        const font = arrayAtI32(ScriptRunner.intStack, isp + 1);
                        const width = arrayAtI32(ScriptRunner.intStack, isp);
                        arrayPutI32(ScriptRunner.intStack, isp++, SoftwareFont.getFontMetrics(font).getParagraphWidth(text, width));
                        break;
                    }
                    case 4110: {
                        ssp -= 2;
                        const first = arrayAtObj(ScriptRunner.stringStack, ssp),
                            second = arrayAtObj(ScriptRunner.stringStack, ssp + 1);
                        if (arrayAtI32(ScriptRunner.intStack, --isp) === 1) arrayPutObj(ScriptRunner.stringStack, ssp++, first);
                        else arrayPutObj(ScriptRunner.stringStack, ssp++, second);
                        break;
                    }
                    case 4111: {
                        const text = arrayAtObj(ScriptRunner.stringStack, --ssp);
                        arrayPutObj(ScriptRunner.stringStack, ssp++, PixfontGeneric.escape(text));
                        break;
                    }
                    case 4112: {
                        const text = arrayAtObj(ScriptRunner.stringStack, --ssp),
                            c = arrayAtI32(ScriptRunner.intStack, --isp);
                        if (c === -1) throw new Error('null char');
                        arrayPutObj(ScriptRunner.stringStack, ssp++, requireNonNull(text).withChar(c));
                        break;
                    }
                    case 4113: {
                        const c = arrayAtI32(ScriptRunner.intStack, --isp);
                        arrayPutI32(ScriptRunner.intStack, isp++, +JagString.isPrintable(c));
                        break;
                    }
                    case 4114: {
                        const c = arrayAtI32(ScriptRunner.intStack, --isp);
                        arrayPutI32(ScriptRunner.intStack, isp++, +JagString.isAlphaNumeric(c));
                        break;
                    }
                    case 4115: {
                        const c = arrayAtI32(ScriptRunner.intStack, --isp);
                        arrayPutI32(ScriptRunner.intStack, isp++, +JagString.isAlpha(c));
                        break;
                    }
                    case 4116: {
                        const c = arrayAtI32(ScriptRunner.intStack, --isp);
                        arrayPutI32(ScriptRunner.intStack, isp++, +JagString.isDigit(c));
                        break;
                    }
                    case 4117: {
                        const text = arrayAtObj(ScriptRunner.stringStack, --ssp);
                        if (text === null) arrayPutI32(ScriptRunner.intStack, isp++, 0);
                        else arrayPutI32(ScriptRunner.intStack, isp++, text.getLength());
                        break;
                    }
                    case 4118: {
                        isp -= 2;
                        const text = arrayAtObj(ScriptRunner.stringStack, --ssp);
                        let end: number, start: number;
                        if (glJar) {
                            start = arrayAtI32(ScriptRunner.intStack, isp);
                            end = arrayAtI32(ScriptRunner.intStack, isp + 1);
                        } else {
                            end = arrayAtI32(ScriptRunner.intStack, isp + 1);
                            start = arrayAtI32(ScriptRunner.intStack, isp);
                        }
                        arrayPutObj(ScriptRunner.stringStack, ssp++, requireNonNull(text).substring(start, end));
                        break;
                    }
                    case 4119: {
                        const text = requireNonNull(arrayAtObj(ScriptRunner.stringStack, --ssp));
                        const result = JagString.allocate(text.getLength());
                        let inside = false;
                        for (let i = 0; i < text.getLength(); i++) {
                            const c = text.charAt(i);
                            if (c === 60) inside = true;
                            else if (c === 62) inside = false;
                            else if (!inside) result.appendChar(c, 125);
                        }
                        result.trimToLength();
                        arrayPutObj(ScriptRunner.stringStack, ssp++, result);
                        break;
                    }
                    case 4120: {
                        isp -= 2;
                        const text = arrayAtObj(ScriptRunner.stringStack, --ssp);
                        let start: number, c: number;
                        if (glJar) {
                            c = arrayAtI32(ScriptRunner.intStack, isp);
                            start = arrayAtI32(ScriptRunner.intStack, isp + 1);
                        } else {
                            start = arrayAtI32(ScriptRunner.intStack, isp + 1);
                            c = arrayAtI32(ScriptRunner.intStack, isp);
                        }
                        arrayPutI32(ScriptRunner.intStack, isp++, requireNonNull(text).indexOfChar(c, start));
                        break;
                    }
                    case 4121: {
                        ssp -= 2;
                        const text = arrayAtObj(ScriptRunner.stringStack, ssp);
                        let start: number, needle: JagString | null;
                        if (glJar) {
                            needle = arrayAtObj(ScriptRunner.stringStack, ssp + 1);
                            start = arrayAtI32(ScriptRunner.intStack, --isp);
                        } else {
                            start = arrayAtI32(ScriptRunner.intStack, --isp);
                            needle = arrayAtObj(ScriptRunner.stringStack, ssp + 1);
                        }
                        arrayPutI32(ScriptRunner.intStack, isp++, requireNonNull(text).indexOfFrom(requireNonNull(needle), start));
                        break;
                    }
                    case 4122: {
                        const c = arrayAtI32(ScriptRunner.intStack, --isp);
                        arrayPutI32(ScriptRunner.intStack, isp++, JagString.toLowerCaseChar(c));
                        break;
                    }
                    case 4123: {
                        const c = arrayAtI32(ScriptRunner.intStack, --isp);
                        arrayPutI32(ScriptRunner.intStack, isp++, JagString.toUpperCaseChar(c));
                        break;
                    }
                    case 4124: {
                        const grouped = arrayAtI32(ScriptRunner.intStack, --isp) !== 0,
                            value = arrayAtI32(ScriptRunner.intStack, --isp);
                        arrayPutObj(ScriptRunner.stringStack, ssp++, JagString.formatNumber(BigInt(value), LocalisedText.language, 0, grouped));
                        break;
                    }
                    case 4200: {
                        const id = arrayAtI32(ScriptRunner.intStack, --isp);
                        arrayPutObj(ScriptRunner.stringStack, ssp++, ObjType.List(id).name);
                        break;
                    }
                    case 4201: {
                        isp -= 2;
                        const slot = arrayAtI32(ScriptRunner.intStack, isp + 1);
                        const id = arrayAtI32(ScriptRunner.intStack, isp);
                        const type = ObjType.List(id);
                        if (slot < 1 || slot > 5 || arrayAtObj(type.groundOps, slot - 1) === null) {
                            arrayPutObj(ScriptRunner.stringStack, ssp++, ScriptRunner.emptyString);
                        } else arrayPutObj(ScriptRunner.stringStack, ssp++, arrayAtObj(type.groundOps, slot - 1));
                        break;
                    }
                    case 4202: {
                        isp -= 2;
                        const id = arrayAtI32(ScriptRunner.intStack, isp);
                        const slot = arrayAtI32(ScriptRunner.intStack, isp + 1);
                        const type = ObjType.List(id);
                        if (slot >= 1 && slot <= 5 && arrayAtObj(type.inventoryOps, slot - 1) !== null) {
                            arrayPutObj(ScriptRunner.stringStack, ssp++, arrayAtObj(type.inventoryOps, slot - 1));
                        } else arrayPutObj(ScriptRunner.stringStack, ssp++, ScriptRunner.emptyString);
                        break;
                    }
                    case 4203: {
                        const id = arrayAtI32(ScriptRunner.intStack, --isp);
                        arrayPutI32(ScriptRunner.intStack, isp++, ObjType.List(id).cost);
                        break;
                    }
                    case 4204: {
                        const id = arrayAtI32(ScriptRunner.intStack, --isp);
                        arrayPutI32(ScriptRunner.intStack, isp++, +(ObjType.List(id).stackable === 1));
                        break;
                    }
                    case 4205: {
                        const id = arrayAtI32(ScriptRunner.intStack, --isp),
                            type = ObjType.List(id);
                        if (type.certTemplate === -1 && type.certLink >= 0) arrayPutI32(ScriptRunner.intStack, isp++, type.certLink);
                        else arrayPutI32(ScriptRunner.intStack, isp++, id);
                        break;
                    }
                    case 4206: {
                        const id = arrayAtI32(ScriptRunner.intStack, --isp),
                            type = ObjType.List(id);
                        if (type.certTemplate >= 0 && type.certLink >= 0) arrayPutI32(ScriptRunner.intStack, isp++, type.certLink);
                        else arrayPutI32(ScriptRunner.intStack, isp++, id);
                        break;
                    }
                    case 4207: {
                        const id = arrayAtI32(ScriptRunner.intStack, --isp);
                        arrayPutI32(ScriptRunner.intStack, isp++, +ObjType.List(id).members);
                        break;
                    }
                    case 4208: {
                        isp -= 2;
                        const key = arrayAtI32(ScriptRunner.intStack, isp + 1);
                        const id = arrayAtI32(ScriptRunner.intStack, isp);
                        const param = ParamType.List(key);
                        if (param.IsStringType()) arrayPutObj(ScriptRunner.stringStack, ssp++, ObjType.List(id).GetParam2(key, param.defaultString));
                        else arrayPutI32(ScriptRunner.intStack, isp++, ObjType.List(id).GetParam(param.m_defaultNumber, key));
                        break;
                    }
                    case 4210: {
                        const query = arrayAtObj(ScriptRunner.stringStack, --ssp);
                        const stockmarket = arrayAtI32(ScriptRunner.intStack, --isp);
                        Client.FindObjects(query, stockmarket === 1);
                        arrayPutI32(ScriptRunner.intStack, isp++, Client.resultCount);
                        break;
                    }
                    case 4211:
                        if (Client.searchResults !== null && Client.searchResultIndex < Client.resultCount) {
                            const stack = ScriptRunner.intStack;
                            const dest = isp++;
                            const results = Client.searchResults;
                            const index = Client.searchResultIndex;
                            Client.searchResultIndex = (index + 1) | 0;
                            arrayPutI32(stack, dest, arrayAtI16(results, index) & 65535);
                        } else arrayPutI32(ScriptRunner.intStack, isp++, -1);
                        break;
                    case 4212:
                        Client.searchResultIndex = 0;
                        break;
                    case 4300: {
                        isp -= 2;
                        const key = arrayAtI32(ScriptRunner.intStack, isp + 1);
                        const id = arrayAtI32(ScriptRunner.intStack, isp);
                        const param = ParamType.List(key);
                        if (!param.IsStringType()) arrayPutI32(ScriptRunner.intStack, isp++, NpcType.List(id).GetParam(key, param.m_defaultNumber));
                        else arrayPutObj(ScriptRunner.stringStack, ssp++, NpcType.List(id).GetParam2(param.defaultString, key));
                        break;
                    }
                    case 4400: {
                        isp -= 2;
                        let id: number, key: number;
                        if (glJar) {
                            key = arrayAtI32(ScriptRunner.intStack, isp + 1);
                            id = arrayAtI32(ScriptRunner.intStack, isp);
                        } else {
                            id = arrayAtI32(ScriptRunner.intStack, isp);
                            key = arrayAtI32(ScriptRunner.intStack, isp + 1);
                        }
                        const param = ParamType.List(key);
                        if (param.IsStringType()) arrayPutObj(ScriptRunner.stringStack, ssp++, LocType.List(id).GetParam2(param.defaultString, key));
                        else arrayPutI32(ScriptRunner.intStack, isp++, LocType.List(id).GetParam(param.m_defaultNumber, key));
                        break;
                    }
                    case 4500: {
                        isp -= 2;
                        const id = arrayAtI32(ScriptRunner.intStack, isp);
                        const key = arrayAtI32(ScriptRunner.intStack, isp + 1);
                        const param = ParamType.List(key);
                        if (param.IsStringType()) arrayPutObj(ScriptRunner.stringStack, ssp++, StructType.List(id).GetParam2(key, param.defaultString));
                        else arrayPutI32(ScriptRunner.intStack, isp++, StructType.List(id).GetParam(param.m_defaultNumber, key));
                        break;
                    }
                    case 5000: {
                        arrayPutI32(ScriptRunner.intStack, isp++, Client.chatPublicMode);
                        break;
                    }
                    case 5001: {
                        isp -= 3;
                        Client.chatPublicMode = arrayAtI32(ScriptRunner.intStack, isp);
                        Client.chatPrivateMode = arrayAtI32(ScriptRunner.intStack, isp + 1);
                        Client.chatTradeMode = arrayAtI32(ScriptRunner.intStack, isp + 2);
                        Client.out.pHead(157);
                        Client.out.p1(Client.chatPublicMode);
                        Client.out.p1(Client.chatPrivateMode);
                        Client.out.p1(Client.chatTradeMode);
                        break;
                    }
                    case 5002: {
                        isp -= 2;
                        const name = arrayAtObj(ScriptRunner.stringStack, --ssp);
                        const reason = arrayAtI32(ScriptRunner.intStack, isp);
                        const mute = arrayAtI32(ScriptRunner.intStack, isp + 1);
                        Client.out.pHead(99);
                        Client.out.p8(requireNonNull(name).toBase37());
                        Client.out.p1((reason - 1) | 0);
                        Client.out.p1(mute);
                        break;
                    }
                    case 5003: {
                        const index = arrayAtI32(ScriptRunner.intStack, --isp);
                        let value: JagString | null = null;
                        if (index < 100) value = arrayAtObj(ChatHistory.text, index);
                        if (value === null) value = ScriptRunner.emptyString;
                        arrayPutObj(ScriptRunner.stringStack, ssp++, value);
                        break;
                    }
                    case 5004: {
                        const index = arrayAtI32(ScriptRunner.intStack, --isp);
                        let type = -1;
                        if (index < 100 && arrayAtObj(ChatHistory.text, index) !== null) type = arrayAtI32(ChatHistory.types, index);
                        arrayPutI32(ScriptRunner.intStack, isp++, type);
                        break;
                    }
                    case 5005: {
                        arrayPutI32(ScriptRunner.intStack, isp++, Client.chatPrivateMode);
                        break;
                    }
                    case 5008: {
                        let text = requireNonNull(arrayAtObj(ScriptRunner.stringStack, --ssp));
                        if (text.startsWith(Client.commandPrefix)) {
                            const pending = Client.DoCheat(text);
                            if (pending instanceof Promise) yield pending;
                            break;
                        }
                        if (!Client.staffModLevel) {
                            if (Client.underage && !Client.parentalChatConsent) break;
                            if (Client.mapQuickChat) break;
                        }
                        let lower = text.toLowerCase();
                        let effect = 0;
                        let colour = 0;
                        if (lower.startsWith(LocalisedText.defaultChatcol0)) {
                            colour = 0;
                            text = text.substringFrom(LocalisedText.defaultChatcol0.getLength());
                        } else if (lower.startsWith(LocalisedText.defaultChatcol1)) {
                            colour = 1;
                            text = text.substringFrom(LocalisedText.defaultChatcol1.getLength());
                        } else if (lower.startsWith(LocalisedText.defaultChatcol2)) {
                            colour = 2;
                            text = text.substringFrom(LocalisedText.defaultChatcol2.getLength());
                        } else if (lower.startsWith(LocalisedText.defaultChatcol3)) {
                            colour = 3;
                            text = text.substringFrom(LocalisedText.defaultChatcol3.getLength());
                        } else if (lower.startsWith(LocalisedText.defaultChatcol4)) {
                            colour = 4;
                            text = text.substringFrom(LocalisedText.defaultChatcol4.getLength());
                        } else if (lower.startsWith(LocalisedText.defaultChatcol5)) {
                            colour = 5;
                            text = text.substringFrom(LocalisedText.defaultChatcol5.getLength());
                        } else if (lower.startsWith(LocalisedText.defaultChatcol6)) {
                            colour = 6;
                            text = text.substringFrom(LocalisedText.defaultChatcol6.getLength());
                        } else if (lower.startsWith(LocalisedText.defaultChatcol7)) {
                            colour = 7;
                            text = text.substringFrom(LocalisedText.defaultChatcol7.getLength());
                        } else if (lower.startsWith(LocalisedText.defaultChatcol8)) {
                            colour = 8;
                            text = text.substringFrom(LocalisedText.defaultChatcol8.getLength());
                        } else if (lower.startsWith(LocalisedText.defaultChatcol9)) {
                            colour = 9;
                            text = text.substringFrom(LocalisedText.defaultChatcol9.getLength());
                        } else if (lower.startsWith(LocalisedText.defaultChatcol10)) {
                            colour = 10;
                            text = text.substringFrom(LocalisedText.defaultChatcol10.getLength());
                        } else if (lower.startsWith(LocalisedText.defaultChatcol11)) {
                            colour = 11;
                            text = text.substringFrom(LocalisedText.defaultChatcol11.getLength());
                        } else if (LocalisedText.language !== 0) {
                            if (lower.startsWith(LocalisedText.chatcol0)) {
                                colour = 0;
                                text = text.substringFrom(LocalisedText.chatcol0.getLength());
                            } else if (lower.startsWith(LocalisedText.chatcol1)) {
                                colour = 1;
                                text = text.substringFrom(LocalisedText.chatcol1.getLength());
                            } else if (lower.startsWith(LocalisedText.chatcol2)) {
                                colour = 2;
                                text = text.substringFrom(LocalisedText.chatcol2.getLength());
                            } else if (lower.startsWith(LocalisedText.chatcol3)) {
                                colour = 3;
                                text = text.substringFrom(LocalisedText.chatcol3.getLength());
                            } else if (lower.startsWith(LocalisedText.chatcol4)) {
                                colour = 4;
                                text = text.substringFrom(LocalisedText.chatcol4.getLength());
                            } else if (lower.startsWith(LocalisedText.chatcol5)) {
                                colour = 5;
                                text = text.substringFrom(LocalisedText.chatcol5.getLength());
                            } else if (lower.startsWith(LocalisedText.chatcol6)) {
                                colour = 6;
                                text = text.substringFrom(LocalisedText.chatcol6.getLength());
                            } else if (lower.startsWith(LocalisedText.chatcol7)) {
                                colour = 7;
                                text = text.substringFrom(LocalisedText.chatcol7.getLength());
                            } else if (lower.startsWith(LocalisedText.chatcol8)) {
                                colour = 8;
                                text = text.substringFrom(LocalisedText.chatcol8.getLength());
                            } else if (lower.startsWith(LocalisedText.chatcol9)) {
                                colour = 9;
                                text = text.substringFrom(LocalisedText.chatcol9.getLength());
                            } else if (lower.startsWith(LocalisedText.chatcol10)) {
                                colour = 10;
                                text = text.substringFrom(LocalisedText.chatcol10.getLength());
                            } else if (lower.startsWith(LocalisedText.chatcol11)) {
                                colour = 11;
                                text = text.substringFrom(LocalisedText.chatcol11.getLength());
                            }
                        }

                        lower = text.toLowerCase();
                        if (lower.startsWith(LocalisedText.defaultChateffect1)) {
                            effect = 1;
                            text = text.substringFrom(LocalisedText.defaultChateffect1.getLength());
                        } else if (lower.startsWith(LocalisedText.defaultChateffect2)) {
                            effect = 2;
                            text = text.substringFrom(LocalisedText.defaultChateffect2.getLength());
                        } else if (lower.startsWith(LocalisedText.defaultChateffect3)) {
                            effect = 3;
                            text = text.substringFrom(LocalisedText.defaultChateffect3.getLength());
                        } else if (lower.startsWith(LocalisedText.defaultChateffect4)) {
                            effect = 4;
                            text = text.substringFrom(LocalisedText.defaultChateffect4.getLength());
                        } else if (lower.startsWith(LocalisedText.defaultChateffect5)) {
                            effect = 5;
                            text = text.substringFrom(LocalisedText.defaultChateffect5.getLength());
                        } else if (LocalisedText.language !== 0) {
                            if (lower.startsWith(LocalisedText.chateffect1)) {
                                effect = 1;
                                text = text.substringFrom(LocalisedText.chateffect1.getLength());
                            } else if (lower.startsWith(LocalisedText.chateffect2)) {
                                effect = 2;
                                text = text.substringFrom(LocalisedText.chateffect2.getLength());
                            } else if (lower.startsWith(LocalisedText.chateffect3)) {
                                effect = 3;
                                text = text.substringFrom(LocalisedText.chateffect3.getLength());
                            } else if (lower.startsWith(LocalisedText.chateffect4)) {
                                effect = 4;
                                text = text.substringFrom(LocalisedText.chateffect4.getLength());
                            } else if (lower.startsWith(LocalisedText.chateffect5)) {
                                effect = 5;
                                text = text.substringFrom(LocalisedText.chateffect5.getLength());
                            }
                        }
                        Client.out.pHead(237);
                        Client.out.p1(0);
                        const start = Client.out.m_pos;
                        Client.out.p1(colour);
                        Client.out.p1(effect);
                        WordPack.write(text, Client.out);
                        Client.out.pSize1((Client.out.m_pos - start) | 0);
                        break;
                    }
                    case 5009: {
                        ssp -= 2;
                        const recipient = arrayAtObj(ScriptRunner.stringStack, ssp);
                        const message = arrayAtObj(ScriptRunner.stringStack, ssp + 1);
                        if (!Client.staffModLevel) {
                            if (Client.underage && !Client.parentalChatConsent) break;
                            if (Client.mapQuickChat) break;
                        }
                        Client.out.pHead(201);
                        Client.out.p1(0);
                        const start = Client.out.m_pos;
                        Client.out.p8(requireNonNull(recipient).toBase37());
                        WordPack.write(message, Client.out);
                        Client.out.pSize1((Client.out.m_pos - start) | 0);
                        break;
                    }
                    case 5010: {
                        const index = arrayAtI32(ScriptRunner.intStack, --isp);
                        let value: JagString | null = null;
                        if (index < 100) value = arrayAtObj(ChatHistory.names, index);
                        if (value === null) value = ScriptRunner.emptyString;
                        arrayPutObj(ScriptRunner.stringStack, ssp++, value);
                        break;
                    }
                    case 5011: {
                        const index = arrayAtI32(ScriptRunner.intStack, --isp);
                        let value: JagString | null = null;
                        if (index < 100) value = arrayAtObj(ChatHistory.clans, index);
                        if (value === null) value = ScriptRunner.emptyString;
                        arrayPutObj(ScriptRunner.stringStack, ssp++, value);
                        break;
                    }
                    case 5012: {
                        const index = arrayAtI32(ScriptRunner.intStack, --isp);
                        let phrase = -1;
                        if (index < 100) phrase = arrayAtI32(ChatHistory.phrases, index);
                        arrayPutI32(ScriptRunner.intStack, isp++, phrase);
                        break;
                    }
                    case 5015: {
                        const self = Client.localPlayer;
                        const name = self === null || self.username === null ? Client.username : self.getDisplayName();
                        arrayPutObj(ScriptRunner.stringStack, ssp++, name);
                        break;
                    }
                    case 5016: {
                        arrayPutI32(ScriptRunner.intStack, isp++, Client.chatTradeMode);
                        break;
                    }
                    case 5017: {
                        arrayPutI32(ScriptRunner.intStack, isp++, ChatHistory.count);
                        break;
                    }
                    case 5050: {
                        const id = arrayAtI32(ScriptRunner.intStack, --isp);
                        arrayPutObj(ScriptRunner.stringStack, ssp++, QuickChatCatTypeList.GetQuickChatCatType(id).description);
                        break;
                    }
                    case 5051: {
                        const id = arrayAtI32(ScriptRunner.intStack, --isp);
                        const type = QuickChatCatTypeList.GetQuickChatCatType(id);
                        arrayPutI32(ScriptRunner.intStack, isp++, type.categories === null ? 0 : type.categories.length);
                        break;
                    }
                    case 5052: {
                        isp -= 2;
                        const id = arrayAtI32(ScriptRunner.intStack, isp);
                        const index = arrayAtI32(ScriptRunner.intStack, isp + 1);
                        const value = arrayAtI32(QuickChatCatTypeList.GetQuickChatCatType(id).categories, index);
                        arrayPutI32(ScriptRunner.intStack, isp++, value);
                        break;
                    }
                    case 5053: {
                        const id = arrayAtI32(ScriptRunner.intStack, --isp);
                        const type = QuickChatCatTypeList.GetQuickChatCatType(id);
                        arrayPutI32(ScriptRunner.intStack, isp++, type.phrases === null ? 0 : type.phrases.length);
                        break;
                    }
                    case 5054: {
                        isp -= 2;
                        const id = arrayAtI32(ScriptRunner.intStack, isp);
                        const index = arrayAtI32(ScriptRunner.intStack, isp + 1);
                        arrayPutI32(ScriptRunner.intStack, isp++, arrayAtI32(QuickChatCatTypeList.GetQuickChatCatType(id).phrases, index));
                        break;
                    }
                    case 5055: {
                        const id = arrayAtI32(ScriptRunner.intStack, --isp);
                        arrayPutObj(ScriptRunner.stringStack, ssp++, QuickChatPhraseTypeList.GetQuickChatPhraseType(id).GetTextDisplay());
                        break;
                    }
                    case 5056: {
                        const id = arrayAtI32(ScriptRunner.intStack, --isp);
                        const type = QuickChatPhraseTypeList.GetQuickChatPhraseType(id);
                        arrayPutI32(ScriptRunner.intStack, isp++, type.responses === null ? 0 : type.responses.length);
                        break;
                    }
                    case 5057: {
                        isp -= 2;
                        const index = arrayAtI32(ScriptRunner.intStack, isp + 1);
                        const id = arrayAtI32(ScriptRunner.intStack, isp);
                        arrayPutI32(ScriptRunner.intStack, isp++, arrayAtI32(QuickChatPhraseTypeList.GetQuickChatPhraseType(id).responses, index));
                        break;
                    }
                    case 5058: {
                        ScriptRunner.activeQuickChatMessage = new QuickChatPhrase();
                        ScriptRunner.activeQuickChatMessage.id = arrayAtI32(ScriptRunner.intStack, --isp);
                        ScriptRunner.activeQuickChatMessage.type = QuickChatPhraseTypeList.GetQuickChatPhraseType(ScriptRunner.activeQuickChatMessage.id);
                        ScriptRunner.activeQuickChatMessage.values = new Int32Array(requireNonNull(ScriptRunner.activeQuickChatMessage.type).commandCount());
                        break;
                    }
                    case 5059: {
                        if (glJar) ScriptRunner.quickChatPacketsSent = (ScriptRunner.quickChatPacketsSent + 1) | 0;
                        Client.out.pHead(167);
                        if (!glJar) ScriptRunner.quickChatPacketsSent = (ScriptRunner.quickChatPacketsSent + 1) | 0;
                        Client.out.p1(0);
                        const start = Client.out.m_pos;
                        Client.out.p1(0);
                        Client.out.p2(requireNonNull(ScriptRunner.activeQuickChatMessage).id);
                        const type = requireNonNull(ScriptRunner.activeQuickChatMessage).type;
                        const packet = Client.out;
                        const values = requireNonNull(ScriptRunner.activeQuickChatMessage).values;
                        requireNonNull(type).PackTransmitValues(packet, values);
                        Client.out.pSize1((Client.out.m_pos - start) | 0);
                        break;
                    }
                    case 5060: {
                        const recipient = arrayAtObj(ScriptRunner.stringStack, --ssp);
                        Client.out.pHead(178);
                        Client.out.p1(0);
                        const start = Client.out.m_pos;
                        Client.out.p8(requireNonNull(recipient).toBase37());
                        Client.out.p2(requireNonNull(ScriptRunner.activeQuickChatMessage).id);
                        const type = requireNonNull(ScriptRunner.activeQuickChatMessage).type;
                        const packet = Client.out;
                        const values = requireNonNull(ScriptRunner.activeQuickChatMessage).values;
                        requireNonNull(type).PackTransmitValues(packet, values);
                        Client.out.pSize1((Client.out.m_pos - start) | 0);
                        break;
                    }
                    case 5061: {
                        Client.out.pHead(167);
                        if (glJar) ScriptRunner.quickChatPacketsSent = (ScriptRunner.quickChatPacketsSent + 1) | 0;
                        Client.out.p1(0);
                        const start = Client.out.m_pos;
                        if (!glJar) ScriptRunner.quickChatPacketsSent = (ScriptRunner.quickChatPacketsSent + 1) | 0;
                        Client.out.p1(1);
                        Client.out.p2(requireNonNull(ScriptRunner.activeQuickChatMessage).id);
                        const type = requireNonNull(ScriptRunner.activeQuickChatMessage).type;
                        const packet = Client.out;
                        const values = requireNonNull(ScriptRunner.activeQuickChatMessage).values;
                        requireNonNull(type).PackTransmitValues(packet, values);
                        Client.out.pSize1((Client.out.m_pos - start) | 0);
                        break;
                    }
                    case 5062: {
                        isp -= 2;
                        const id = arrayAtI32(ScriptRunner.intStack, isp);
                        const index = arrayAtI32(ScriptRunner.intStack, isp + 1);
                        arrayPutI32(ScriptRunner.intStack, isp++, arrayAtI32(QuickChatCatTypeList.GetQuickChatCatType(id).categoryKeys, index));
                        break;
                    }
                    case 5063: {
                        isp -= 2;
                        const index = arrayAtI32(ScriptRunner.intStack, isp + 1);
                        const id = arrayAtI32(ScriptRunner.intStack, isp);
                        arrayPutI32(ScriptRunner.intStack, isp++, arrayAtI32(QuickChatCatTypeList.GetQuickChatCatType(id).phraseKeys, index));
                        break;
                    }
                    case 5064: {
                        isp -= 2;
                        const id = arrayAtI32(ScriptRunner.intStack, isp);
                        const key = arrayAtI32(ScriptRunner.intStack, isp + 1);
                        if (key === -1) arrayPutI32(ScriptRunner.intStack, isp++, -1);
                        else arrayPutI32(ScriptRunner.intStack, isp++, QuickChatCatTypeList.GetQuickChatCatType(id).GetSubCategoryIdByCharacter(key));
                        break;
                    }
                    case 5065: {
                        isp -= 2;
                        const id = arrayAtI32(ScriptRunner.intStack, isp);
                        const key = arrayAtI32(ScriptRunner.intStack, isp + 1);
                        if (key === -1) arrayPutI32(ScriptRunner.intStack, isp++, -1);
                        else arrayPutI32(ScriptRunner.intStack, isp++, QuickChatCatTypeList.GetQuickChatCatType(id).GetPhraseIdByCharacter(key));
                        break;
                    }
                    case 5066: {
                        const id = arrayAtI32(ScriptRunner.intStack, --isp);
                        arrayPutI32(ScriptRunner.intStack, isp++, QuickChatPhraseTypeList.GetQuickChatPhraseType(id).commandCount());
                        break;
                    }
                    case 5067: {
                        isp -= 2;
                        const id = arrayAtI32(ScriptRunner.intStack, isp);
                        const index = arrayAtI32(ScriptRunner.intStack, isp + 1);
                        const command = QuickChatPhraseTypeList.GetQuickChatPhraseType(id).GetDynamicCommand(index);
                        arrayPutI32(ScriptRunner.intStack, isp++, command);
                        break;
                    }
                    case 5068: {
                        isp -= 2;
                        const index = arrayAtI32(ScriptRunner.intStack, isp);
                        const value = arrayAtI32(ScriptRunner.intStack, isp + 1);
                        arrayPutI32(requireNonNull(ScriptRunner.activeQuickChatMessage).values, index, value);
                        break;
                    }
                    case 5069: {
                        isp -= 2;
                        const index = arrayAtI32(ScriptRunner.intStack, isp);
                        const value = arrayAtI32(ScriptRunner.intStack, isp + 1);
                        arrayPutI32(requireNonNull(ScriptRunner.activeQuickChatMessage).values, index, value);
                        break;
                    }
                    case 5070: {
                        isp -= 3;
                        const id = arrayAtI32(ScriptRunner.intStack, isp);
                        const index = arrayAtI32(ScriptRunner.intStack, isp + 1);
                        const param = arrayAtI32(ScriptRunner.intStack, isp + 2);
                        const type = QuickChatPhraseTypeList.GetQuickChatPhraseType(id);
                        if (type.GetDynamicCommand(index) !== 0) throw new Error('bad command');
                        arrayPutI32(ScriptRunner.intStack, isp++, type.GetDynamicCommandParameter(param, index));
                        break;
                    }
                    case 5071: {
                        const query = arrayAtObj(ScriptRunner.stringStack, --ssp);
                        const global = arrayAtI32(ScriptRunner.intStack, --isp) === 1;
                        QuickChatPhraseTypeList.searchPhrases(query, global);
                        arrayPutI32(ScriptRunner.intStack, isp++, Client.resultCount);
                        break;
                    }
                    case 5072: {
                        if (Client.searchResults === null || Client.searchResultIndex >= Client.resultCount) {
                            arrayPutI32(ScriptRunner.intStack, isp++, -1);
                        } else {
                            const stack = ScriptRunner.intStack;
                            const dest = isp++;
                            const results = Client.searchResults;
                            const index = Client.searchResultIndex;
                            Client.searchResultIndex = (index + 1) | 0;
                            arrayPutI32(stack, dest, arrayAtI16(results, index) & 65535);
                        }
                        break;
                    }
                    case 5073: {
                        Client.searchResultIndex = 0;
                        break;
                    }
                    case 5100:
                        if (arrayAtObj(ClientKeyboardListener.pressed, 86)) arrayPutI32(ScriptRunner.intStack, isp++, 1);
                        else arrayPutI32(ScriptRunner.intStack, isp++, 0);
                        break;
                    case 5101:
                        if (arrayAtObj(ClientKeyboardListener.pressed, 82)) arrayPutI32(ScriptRunner.intStack, isp++, 1);
                        else arrayPutI32(ScriptRunner.intStack, isp++, 0);
                        break;
                    case 5102:
                        if (arrayAtObj(ClientKeyboardListener.pressed, 81)) arrayPutI32(ScriptRunner.intStack, isp++, 1);
                        else arrayPutI32(ScriptRunner.intStack, isp++, 0);
                        break;
                    case 5200:
                        WorldMap.SetZoomLevel(arrayAtI32(ScriptRunner.intStack, --isp));
                        break;
                    case 5201:
                        arrayPutI32(ScriptRunner.intStack, isp++, WorldMap.GetZoomLevel());
                        break;
                    case 5202:
                        WorldMap.SetMapElementFlashing(arrayAtI32(ScriptRunner.intStack, --isp));
                        break;
                    case 5203:
                        WorldMap.targetLabel(arrayAtObj(ScriptRunner.stringStack, --ssp));
                        break;
                    case 5204:
                        arrayPutObj(ScriptRunner.stringStack, ssp - 1, WorldMap.completeLabel(arrayAtObj(ScriptRunner.stringStack, ssp - 1)));
                        break;
                    case 5205:
                        WorldMap.open(arrayAtObj(ScriptRunner.stringStack, --ssp));
                        break;
                    case 5206: {
                        const coord = arrayAtI32(ScriptRunner.intStack, --isp);
                        const area = MapArea.at((coord >> 14) & 16383, coord & 16383);
                        arrayPutObj(ScriptRunner.stringStack, ssp++, area === null ? ScriptRunner.emptyString : area.groupName);
                        break;
                    }
                    case 5207: {
                        const area = MapArea.get(arrayAtObj(ScriptRunner.stringStack, --ssp));
                        if (area !== null && area.displayName !== null) arrayPutObj(ScriptRunner.stringStack, ssp++, area.displayName);
                        else arrayPutObj(ScriptRunner.stringStack, ssp++, ScriptRunner.emptyString);
                        break;
                    }
                    case 5208:
                        arrayPutI32(ScriptRunner.intStack, isp++, WorldMap.displayWidth);
                        arrayPutI32(ScriptRunner.intStack, isp++, WorldMap.displayHeight);
                        break;
                    case 5209:
                        arrayPutI32(ScriptRunner.intStack, isp++, (WorldMap.baseX + WorldMap.centerX) | 0);
                        arrayPutI32(ScriptRunner.intStack, isp++, glJar ? (WorldMap.baseZ - WorldMap.centerZ + (-1 + WorldMap.height)) | 0 : (-WorldMap.centerZ + WorldMap.height + (-1 + WorldMap.baseZ)) | 0);
                        break;
                    case 5210: {
                        const area = WorldMap.getCurrent();
                        arrayPutI32(ScriptRunner.intStack, isp++, area === null ? 0 : area.originX << 6);
                        arrayPutI32(ScriptRunner.intStack, isp++, area === null ? 0 : area.originZ << 6);
                        break;
                    }
                    case 5211: {
                        const area = WorldMap.getCurrent();
                        arrayPutI32(ScriptRunner.intStack, isp++, area === null ? 0 : (area.maxX - area.minX) | 0);
                        arrayPutI32(ScriptRunner.intStack, isp++, area === null ? 0 : (area.maxZ - area.minZ) | 0);
                        break;
                    }
                    case 5212:
                    case 5213: {
                        const index = opcode === 5212 ? WorldMap.firstLabel() : WorldMap.nextLabel();
                        let size = 0,
                            text: JagString | null;
                        if (index !== -1) {
                            text = arrayAtObj(requireNonNull(WorldMap.labels).text, index);
                            size = requireNonNull(WorldMap.labels).size(index);
                        } else text = ScriptRunner.emptyString;
                        let lineBreak: JagString, space: JagString;
                        if (glJar) {
                            space = ScriptRunner.space;
                            lineBreak = WorldMap.lineBreak;
                        } else {
                            lineBreak = WorldMap.lineBreak;
                            space = ScriptRunner.space;
                        }
                        text = requireNonNull(text).replace(lineBreak, space);
                        arrayPutObj(ScriptRunner.stringStack, ssp++, text);
                        arrayPutI32(ScriptRunner.intStack, isp++, size);
                        break;
                    }
                    case 5214: {
                        const coord = arrayAtI32(ScriptRunner.intStack, --isp);
                        WorldMap.target(coord & 16383, (coord >> 14) & 16383);
                        break;
                    }
                    case 5215: {
                        const coord = arrayAtI32(ScriptRunner.intStack, --isp);
                        const name = arrayAtObj(ScriptRunner.stringStack, --ssp);
                        const areas = MapArea.allAt(coord & 16383, (coord >> 14) & 16383);
                        let found = false;
                        for (let area = areas.head(); area !== null; area = areas.next()) {
                            if (requireNonNull(area.groupName).equalsIgnoreCase(name)) {
                                found = true;
                                break;
                            }
                        }
                        arrayPutI32(ScriptRunner.intStack, isp++, found ? 1 : 0);
                        break;
                    }
                    case 5216:
                        WorldMap.toggleIcon(arrayAtI32(ScriptRunner.intStack, --isp));
                        break;
                    case 5217: {
                        const id = arrayAtI32(ScriptRunner.intStack, --isp);
                        if (WorldMap.iconDisabled(id)) arrayPutI32(ScriptRunner.intStack, isp++, 1);
                        else arrayPutI32(ScriptRunner.intStack, isp++, 0);
                        break;
                    }
                    case 5218: {
                        const area = WorldMap.getCurrent();
                        if (area !== null) arrayPutI32(ScriptRunner.intStack, isp++, area.defaultZoom);
                        else arrayPutI32(ScriptRunner.intStack, isp++, -1);
                        break;
                    }
                    case 5219:
                        WorldMap.targetExactLabel(arrayAtObj(ScriptRunner.stringStack, --ssp));
                        break;
                    case 5220:
                        arrayPutI32(ScriptRunner.intStack, isp++, WorldMap.progress === 100 ? 1 : 0);
                        break;
                    case 5300: {
                        isp -= 2;
                        if (glJar) {
                            const height = arrayAtI32(ScriptRunner.intStack, isp + 1);
                            const width = arrayAtI32(ScriptRunner.intStack, isp);
                            const change = Client.setWindowMode(width, true, 3, false, height);
                            if (change instanceof Promise) yield change;
                        }
                        arrayPutI32(ScriptRunner.intStack, isp++, +(glJar && GameShell.fullScreenFrame !== null));
                        break;
                    }
                    case 5301:
                        yield* ScriptRunner.leaveFullscreen();
                        break;
                    case 5302: {
                        const count = glJar ? (yield* DisplayMode.getAvailable(GameShell.signlink)).length : 0;
                        arrayPutI32(ScriptRunner.intStack, isp++, count);
                        break;
                    }
                    case 5303: {
                        if (glJar) {
                            const index = arrayAtI32(ScriptRunner.intStack, --isp);
                            const modes = yield* DisplayMode.getAvailable(GameShell.signlink);
                            arrayPutI32(ScriptRunner.intStack, isp++, requireNonNull(arrayAtObj(modes, index)).width);
                            arrayPutI32(ScriptRunner.intStack, isp++, requireNonNull(arrayAtObj(modes, index)).height);
                        } else {
                            isp--;
                            arrayPutI32(ScriptRunner.intStack, isp++, 0);
                            arrayPutI32(ScriptRunner.intStack, isp++, 0);
                        }
                        break;
                    }
                    case 5305: {
                        let index = -1;
                        if (glJar) {
                            const height = Preferences.fullscreenHeight;
                            const width = Preferences.fullscreenWidth;
                            const modes = yield* DisplayMode.getAvailable(GameShell.signlink);
                            for (let i = 0; i < modes.length; i++) {
                                const mode = requireNonNull(arrayAtObj(modes, i));
                                if (width === mode.width && mode.height === height) {
                                    index = i;
                                    break;
                                }
                            }
                        }
                        arrayPutI32(ScriptRunner.intStack, isp++, index);
                        break;
                    }
                    case 5306:
                        arrayPutI32(ScriptRunner.intStack, isp++, Client.getWindowMode());
                        break;
                    case 5307: {
                        let mode = arrayAtI32(ScriptRunner.intStack, --isp);
                        if (mode < 0 || mode > 2) mode = 0;
                        const change = Client.setWindowMode(-1, true, mode, false, -1);
                        if (change instanceof Promise) yield change;
                        break;
                    }
                    case 5308:
                        arrayPutI32(ScriptRunner.intStack, isp++, Preferences.windowMode);
                        break;
                    case 5309: {
                        let mode = arrayAtI32(ScriptRunner.intStack, --isp);
                        if (mode < 0 || mode > 2) mode = 0;
                        Preferences.windowMode = mode;
                        Preferences.write(GameShell.signlink);
                        break;
                    }
                    case 5400: {
                        ssp -= 2;
                        const first = arrayAtObj(ScriptRunner.stringStack, ssp),
                            second = arrayAtObj(ScriptRunner.stringStack, ssp + 1),
                            value = arrayAtI32(ScriptRunner.intStack, --isp);
                        const out = Client.out;
                        out.pHead(117);
                        out.p1((3 + requireNonNull(first).getLength() + requireNonNull(second).getLength()) | 0);
                        out.pStringNoConversion(requireNonNull(first), 0);
                        out.pStringNoConversion(requireNonNull(second), 0);
                        out.p1(value);
                        break;
                    }
                    case 5401: {
                        isp -= 2;
                        const palette = Client.recolourPalette,
                            index = arrayAtI32(ScriptRunner.intStack, isp);
                        const colour = RunetekColour.RGBToHSL(arrayAtI32(ScriptRunner.intStack, isp + 1));
                        arrayPutI16(palette, index, colour);
                        ObjType.clearModelCache();
                        ObjType.ResetSpriteCache();
                        NpcType.clearModelCache();
                        NpcType.clearHeadModelCache();
                        InterfaceList.redrawAll();
                        break;
                    }
                    case 5405: {
                        isp -= 2;
                        const length = arrayAtI32(ScriptRunner.intStack, isp + 1);
                        const path = arrayAtI32(ScriptRunner.intStack, isp);
                        if (path >= 0 && path < 2) {
                            arrayPutObj(
                                CinematicCamera.paths,
                                path,
                                Array.from(new Array(length << 1), () => new Int32Array(4))
                            );
                        }
                        break;
                    }
                    case 5406: {
                        isp -= 7;
                        const path = arrayAtI32(ScriptRunner.intStack, isp);
                        const pos = arrayAtI32(ScriptRunner.intStack, isp + 2);
                        const index = arrayAtI32(ScriptRunner.intStack, isp + 1) << 1;
                        const y = arrayAtI32(ScriptRunner.intStack, isp + 3);
                        const control = arrayAtI32(ScriptRunner.intStack, isp + 4);
                        const controlY = arrayAtI32(ScriptRunner.intStack, isp + 5);
                        const param = arrayAtI32(ScriptRunner.intStack, isp + 6);
                        if (path >= 0 && path < 2) {
                            const curve = arrayAtObj(CinematicCamera.paths, path);
                            if (curve !== null && index >= 0 && index < curve.length) {
                                arrayPutObj(curve, index, Int32Array.of(((pos >> 14) & 16383) << 7, y, (pos & 16383) << 7, param));
                                arrayPutObj(curve, index + 1, Int32Array.of(((control >> 14) & 16383) << 7, controlY, (control & 16383) << 7));
                            }
                        }
                        break;
                    }
                    case 5407: {
                        const path = arrayAtI32(ScriptRunner.intStack, --isp);
                        arrayPutI32(ScriptRunner.intStack, isp++, requireNonNull(arrayAtObj(CinematicCamera.paths, path)).length >> 1);
                        break;
                    }
                    case 5411:
                        yield* ScriptRunner.leaveFullscreen();
                        if (GameShell.frame === null) GameShell.openUrl(false, Client.getWebsiteUrlPrefix());
                        else {
                            GameShell.standaloneHost.exit(0);
                            throw applicationExit;
                        }
                        break;
                    case 5419: {
                        const request = Client.dnsRequest;
                        let text = ScriptRunner.emptyString;
                        if (request !== null) {
                            text = JagString.formatIpv4(request.intArg);
                            if (request.result !== null) text = fromJsString(request.result);
                        }
                        arrayPutObj(ScriptRunner.stringStack, ssp++, text);
                        break;
                    }
                    case 5420:
                        arrayPutI32(ScriptRunner.intStack, isp++, +(Signlink.platform === 3));
                        break;
                    case 5421: {
                        yield* ScriptRunner.leaveFullscreen();
                        let newWindow: boolean, path: JagString | null;
                        if (glJar) {
                            newWindow = arrayAtI32(ScriptRunner.intStack, --isp) === 1;
                            path = arrayAtObj(ScriptRunner.stringStack, --ssp);
                        } else {
                            path = arrayAtObj(ScriptRunner.stringStack, --ssp);
                            newWindow = arrayAtI32(ScriptRunner.intStack, --isp) === 1;
                        }
                        const address = JagString.join([Client.getWebsiteUrlPrefix(), path]);
                        if (GameShell.frame === null && (!newWindow || Signlink.platform === 3 || !requireNonNull(Signlink.osNameLower).startsWith('win') || Client.haveIe6)) {
                            GameShell.openUrl(newWindow, address);
                        } else {
                            if (glJar) Client.urlNewWindow = newWindow;
                            Client.pendingUrl = address;
                            if (!glJar) Client.urlNewWindow = newWindow;
                            Client.openUrlRequest = requireNonNull(GameShell.signlink).openUrlExternally(toJsString(address));
                        }
                        break;
                    }
                    case 5422: {
                        ssp -= 2;
                        const hdIndex = glJar ? arrayAtI32(ScriptRunner.intStack, --isp) : 0;
                        const suffix = arrayAtObj(ScriptRunner.stringStack, ssp + 1);
                        const prefix = arrayAtObj(ScriptRunner.stringStack, ssp);
                        const index = glJar ? hdIndex : arrayAtI32(ScriptRunner.intStack, --isp);
                        if (requireNonNull(prefix).getLength() > 0) {
                            if (ClientPlayer.titlePrefixes === null) ClientPlayer.titlePrefixes = new Array(arrayAtI32(ClientPlayer.nameAffixSlotCounts, GameVariant.id)).fill(null);
                            arrayPutObj(ClientPlayer.titlePrefixes, index, prefix);
                        }
                        if (requireNonNull(suffix).getLength() > 0) {
                            if (ClientPlayer.nameSuffixes === null) ClientPlayer.nameSuffixes = new Array(arrayAtI32(ClientPlayer.nameAffixSlotCounts, GameVariant.id)).fill(null);
                            arrayPutObj(ClientPlayer.nameSuffixes, index, suffix);
                        }
                        break;
                    }
                    case 5423:
                        requireNonNull(arrayAtObj(ScriptRunner.stringStack, --ssp)).print(0);
                        break;
                    case 5424: {
                        isp -= 11;

                        Minimenu.backgroundColour = arrayAtI32(ScriptRunner.intStack, isp);
                        Minimenu.transparency = arrayAtI32(ScriptRunner.intStack, isp + 1);
                        Minimenu.highlightColour = arrayAtI32(ScriptRunner.intStack, isp + 2);
                        Minimenu.skinHoverAlpha = arrayAtI32(ScriptRunner.intStack, isp + 3);
                        Minimenu.skinTitleSpriteId = arrayAtI32(ScriptRunner.intStack, isp + 4);
                        Minimenu.skinTitleEndSprite = arrayAtI32(ScriptRunner.intStack, isp + 5);
                        Minimenu.bottomSpriteId = arrayAtI32(ScriptRunner.intStack, isp + 6);
                        Minimenu.sideSpriteId = arrayAtI32(ScriptRunner.intStack, isp + 7);
                        Minimenu.skinBottomCornerSprite = arrayAtI32(ScriptRunner.intStack, isp + 8);
                        Minimenu.textColour = arrayAtI32(ScriptRunner.intStack, isp + 9);
                        Minimenu.skinHighlightTextColour = arrayAtI32(ScriptRunner.intStack, isp + 10);
                        let archive = Client.m_pSprites;
                        let spriteId = Minimenu.skinTitleSpriteId;
                        requireNonNull(archive).RequestDownload2(spriteId);
                        archive = Client.m_pSprites;
                        spriteId = Minimenu.skinTitleEndSprite;
                        requireNonNull(archive).RequestDownload2(spriteId);
                        archive = Client.m_pSprites;
                        spriteId = Minimenu.bottomSpriteId;
                        requireNonNull(archive).RequestDownload2(spriteId);
                        archive = Client.m_pSprites;
                        spriteId = Minimenu.sideSpriteId;
                        requireNonNull(archive).RequestDownload2(spriteId);
                        archive = Client.m_pSprites;
                        spriteId = Minimenu.skinBottomCornerSprite;
                        requireNonNull(archive).RequestDownload2(spriteId);
                        Minimenu.spriteStyle = true;
                        break;
                    }
                    case 5425:
                        Minimenu.clearSprites();
                        Minimenu.spriteStyle = false;
                        break;
                    case 5426:
                        Client.defaultCursor = arrayAtI32(ScriptRunner.intStack, --isp);
                        break;
                    case 5427:
                        isp -= 2;
                        Minimenu.objCursor = arrayAtI32(ScriptRunner.intStack, isp);
                        Minimenu.examineCursor = arrayAtI32(ScriptRunner.intStack, isp + 1);
                        break;
                    case 5500: {
                        isp -= 4;
                        const pos = arrayAtI32(ScriptRunner.intStack, isp);
                        if (glJar) {
                            const factor = arrayAtI32(ScriptRunner.intStack, isp + 3);
                            const step = arrayAtI32(ScriptRunner.intStack, isp + 2);
                            const height = arrayAtI32(ScriptRunner.intStack, isp + 1);
                            const z = ((pos & 16383) - Client.mapBuildBaseZ) | 0;
                            const x = (((pos >> 14) & 16383) - Client.mapBuildBaseX) | 0;
                            CinematicCamera.MoveTo(factor, x, height, step, z, false);
                            break;
                        }
                        const step = arrayAtI32(ScriptRunner.intStack, isp + 2);
                        const height = arrayAtI32(ScriptRunner.intStack, isp + 1);
                        const factor = arrayAtI32(ScriptRunner.intStack, isp + 3);
                        CinematicCamera.MoveTo(factor, (((pos >> 14) & 16383) - Client.mapBuildBaseX) | 0, height, step, ((pos & 16383) - Client.mapBuildBaseZ) | 0, false);
                        break;
                    }
                    case 5501: {
                        isp -= 4;
                        if (glJar) {
                            const height = arrayAtI32(ScriptRunner.intStack, isp + 1);
                            const pos = arrayAtI32(ScriptRunner.intStack, isp);
                            const factor = arrayAtI32(ScriptRunner.intStack, isp + 3);
                            const step = arrayAtI32(ScriptRunner.intStack, isp + 2);
                            const z = ((pos & 16383) - Client.mapBuildBaseZ) | 0;
                            const x = (((pos >> 14) & 16383) - Client.mapBuildBaseX) | 0;
                            CinematicCamera.LookAt(step, height, x, factor, z);
                            break;
                        }
                        const pos = arrayAtI32(ScriptRunner.intStack, isp);
                        const height = arrayAtI32(ScriptRunner.intStack, isp + 1);
                        const step = arrayAtI32(ScriptRunner.intStack, isp + 2);
                        const factor = arrayAtI32(ScriptRunner.intStack, isp + 3);
                        CinematicCamera.LookAt(step, height, (((pos >> 14) & 16383) - Client.mapBuildBaseX) | 0, factor, ((pos & 16383) - Client.mapBuildBaseZ) | 0);
                        break;
                    }
                    case 5502: {
                        isp -= 6;
                        const path = arrayAtI32(ScriptRunner.intStack, isp);
                        if (path >= 2) throw new Error('RuntimeException');
                        CinematicCamera.positionPath = path;
                        const segment = arrayAtI32(ScriptRunner.intStack, isp + 1);
                        if (requireNonNull(arrayAtObj(CinematicCamera.paths, CinematicCamera.positionPath)).length >> 1 <= ((segment + 1) | 0)) throw new Error('RuntimeException');
                        CinematicCamera.positionSegment = segment;
                        CinematicCamera.progress = 0;
                        CinematicCamera.startRate = arrayAtI32(ScriptRunner.intStack, isp + 2);
                        CinematicCamera.endRate = arrayAtI32(ScriptRunner.intStack, isp + 3);
                        const look = arrayAtI32(ScriptRunner.intStack, isp + 4);
                        if (look >= 2) throw new Error('RuntimeException');
                        CinematicCamera.lookPath = look;
                        const lookIndex = arrayAtI32(ScriptRunner.intStack, isp + 5);
                        if (requireNonNull(arrayAtObj(CinematicCamera.paths, CinematicCamera.lookPath)).length >> 1 <= ((lookIndex + 1) | 0)) throw new Error('RuntimeException');
                        if (glJar) {
                            CinematicCamera.lookSegment = lookIndex;
                            OrbitCamera.mode = 3;
                        } else {
                            OrbitCamera.mode = 3;
                            CinematicCamera.lookSegment = lookIndex;
                        }
                        break;
                    }
                    case 5503:
                        OrbitCamera.reset();
                        break;
                    case 5504:
                        isp -= 2;
                        OrbitCamera.followPitch = arrayAtI32(ScriptRunner.intStack, isp);
                        OrbitCamera.followYaw = arrayAtI32(ScriptRunner.intStack, isp + 1);
                        if (OrbitCamera.mode === 2) {
                            if (glJar) {
                                OrbitCamera.yaw = OrbitCamera.followYaw;
                                OrbitCamera.pitch = OrbitCamera.followPitch;
                            } else {
                                OrbitCamera.pitch = OrbitCamera.followPitch;
                                OrbitCamera.yaw = OrbitCamera.followYaw;
                            }
                        }
                        OrbitCamera.clamp(-74);
                        break;
                    case 5505:
                        arrayPutI32(ScriptRunner.intStack, isp++, OrbitCamera.followPitch);
                        break;
                    case 5506:
                        arrayPutI32(ScriptRunner.intStack, isp++, OrbitCamera.followYaw);
                        break;
                    case 5600: {
                        ssp -= 2;
                        const username = arrayAtObj(ScriptRunner.stringStack, ssp),
                            password = arrayAtObj(ScriptRunner.stringStack, ssp + 1),
                            type = arrayAtI32(ScriptRunner.intStack, --isp);
                        if (Client.gameState !== 10 || Login.worldLookupStep !== 0 || Client.loginStep !== 0 || AccountCreation.step !== 0 || WorldList.fetchStep !== 0) break;
                        Login.requestLogin(username, password, type, 0);
                        break;
                    }
                    case 5601:
                        Login.continueLogin();
                        break;
                    case 5602:
                        if (Client.loginStep === 0) Login.reply = -2;
                        break;
                    case 5603: {
                        isp -= 4;
                        if (Client.gameState !== 10 || Login.worldLookupStep !== 0 || Client.loginStep !== 0 || AccountCreation.step !== 0 || WorldList.fetchStep !== 0) break;
                        if (glJar) {
                            const year = arrayAtI32(ScriptRunner.intStack, isp + 2);
                            const country = arrayAtI32(ScriptRunner.intStack, isp + 3);
                            const day = arrayAtI32(ScriptRunner.intStack, isp);
                            const month = arrayAtI32(ScriptRunner.intStack, isp + 1);
                            AccountCreation.checkDateOfBirth(month, country, year, day);
                        } else AccountCreation.checkDateOfBirth(arrayAtI32(ScriptRunner.intStack, isp + 1), arrayAtI32(ScriptRunner.intStack, isp + 3), arrayAtI32(ScriptRunner.intStack, isp + 2), arrayAtI32(ScriptRunner.intStack, isp));
                        break;
                    }
                    case 5604: {
                        ssp--;
                        if (Client.gameState !== 10 || Login.worldLookupStep !== 0 || Client.loginStep !== 0 || AccountCreation.step !== 0 || WorldList.fetchStep !== 0) break;
                        AccountCreation.checkName(requireNonNull(arrayAtObj(ScriptRunner.stringStack, ssp)).toBase37());
                        break;
                    }
                    case 5605: {
                        isp -= 4;
                        ssp -= 2;
                        if (Client.gameState !== 10 || Login.worldLookupStep !== 0 || Client.loginStep !== 0 || AccountCreation.step !== 0 || WorldList.fetchStep !== 0) break;
                        if (glJar) {
                            const day = arrayAtI32(ScriptRunner.intStack, isp);
                            const country = arrayAtI32(ScriptRunner.intStack, isp + 3);
                            const month = arrayAtI32(ScriptRunner.intStack, isp + 1);
                            const password = arrayAtObj(ScriptRunner.stringStack, ssp + 1);
                            const name = requireNonNull(arrayAtObj(ScriptRunner.stringStack, ssp)).toBase37();
                            const year = arrayAtI32(ScriptRunner.intStack, isp + 2);
                            AccountCreation.createAccount(name, country, year, day, password, month);
                        } else
                            AccountCreation.createAccount(
                                requireNonNull(arrayAtObj(ScriptRunner.stringStack, ssp)).toBase37(),
                                arrayAtI32(ScriptRunner.intStack, isp + 3),
                                arrayAtI32(ScriptRunner.intStack, isp + 2),
                                arrayAtI32(ScriptRunner.intStack, isp),
                                arrayAtObj(ScriptRunner.stringStack, ssp + 1),
                                arrayAtI32(ScriptRunner.intStack, isp + 1)
                            );
                        break;
                    }
                    case 5606:
                        if (AccountCreation.step === 0) AccountCreation.reply = -2;
                        break;
                    case 5607:
                        arrayPutI32(ScriptRunner.intStack, isp++, Login.reply);
                        break;
                    case 5608:
                        arrayPutI32(ScriptRunner.intStack, isp++, Login.hopTime);
                        break;
                    case 5609:
                        arrayPutI32(ScriptRunner.intStack, isp++, AccountCreation.reply);
                        break;
                    case 5610: {
                        for (let i = 0; i < 5; i++) {
                            arrayPutObj(ScriptRunner.stringStack, ssp++, i < requireNonNull(Login.suggestedNames).length ? requireNonNull(arrayAtObj(Login.suggestedNames, i)).formatName(0) : ScriptRunner.emptyString);
                        }
                        Login.suggestedNames = null;
                        break;
                    }
                    case 5611:
                        arrayPutI32(ScriptRunner.intStack, isp++, Login.disallowResult);
                        break;
                    case 6001: {
                        let value = arrayAtI32(ScriptRunner.intStack, --isp);
                        if (value < 1) value = 1;
                        if (value > 4) value = 4;
                        Preferences.brightness = value;
                        if (!glActive() || !Preferences.graphics.highDetailLighting) {
                            if (Preferences.brightness === 1) Pix3D.setBrightness(Math.fround(0.9));
                            if (Preferences.brightness === 2) Pix3D.setBrightness(Math.fround(0.8));
                            if (Preferences.brightness === 3) Pix3D.setBrightness(Math.fround(0.7));
                            if (Preferences.brightness === 4) Pix3D.setBrightness(Math.fround(0.6));
                        }
                        if (glActive()) {
                            Client.forceImmediateEnvironmentUpdate = true;
                            if (!Preferences.graphics.highDetailLighting) Client.rebuildSceneIfIngame(104);
                        }
                        ObjType.ResetSpriteCache();
                        Preferences.write(GameShell.signlink);
                        Preferences.sent = false;
                        break;
                    }
                    case 6002: {
                        Preferences.setAllLevelsVisible(arrayAtI32(ScriptRunner.intStack, --isp) === 1);
                        LocType.ResetCache();
                        Client.rebuildSceneIfIngame(101);
                        RoofModeStatics.applyRoofMode();
                        Preferences.write(GameShell.signlink);
                        Preferences.sent = false;
                        break;
                    }
                    case 6003: {
                        Preferences.removeRoofsSelectively = arrayAtI32(ScriptRunner.intStack, --isp) === 1;
                        RoofModeStatics.applyRoofMode();
                        Preferences.write(GameShell.signlink);
                        Preferences.sent = false;
                        break;
                    }
                    case 6005: {
                        Preferences.showGroundDecorations = arrayAtI32(ScriptRunner.intStack, --isp) === 1;
                        Client.rebuildSceneIfIngame(112);
                        Preferences.write(GameShell.signlink);
                        Preferences.sent = false;
                        break;
                    }
                    case 6006: {
                        Preferences.highDetailTextures = arrayAtI32(ScriptRunner.intStack, --isp) === 1;
                        const provider = Pix3D.textureProvider;
                        if (provider !== null && !(provider instanceof TextureCache)) throw new TypeError('ClassCastException: expected TextureCache');
                        const lowMemory = !Preferences.graphics.highDetailTextures;
                        requireNonNull(provider).setLowMemory(lowMemory);
                        Preferences.write(GameShell.signlink);
                        Preferences.sent = false;
                        break;
                    }
                    case 6007: {
                        Preferences.manyIdleAnimations = arrayAtI32(ScriptRunner.intStack, --isp) === 1;
                        Preferences.write(GameShell.signlink);
                        Preferences.sent = false;
                        break;
                    }
                    case 6008: {
                        Preferences.flickeringEffects = arrayAtI32(ScriptRunner.intStack, --isp) === 1;
                        Preferences.write(GameShell.signlink);
                        Preferences.sent = false;
                        break;
                    }
                    case 6009: {
                        Preferences.highDetailTextures2 = arrayAtI32(ScriptRunner.intStack, --isp) === 1;
                        Preferences.write(GameShell.signlink);
                        Preferences.sent = false;
                        break;
                    }
                    case 6010: {
                        Preferences.characterShadows = arrayAtI32(ScriptRunner.intStack, --isp) === 1;
                        Preferences.write(GameShell.signlink);
                        Preferences.sent = false;
                        break;
                    }
                    case 6011: {
                        let value = arrayAtI32(ScriptRunner.intStack, --isp);
                        if (value < 0 || value > 2) value = 0;
                        Preferences.sceneryShadows = value;
                        Preferences.write(GameShell.signlink);
                        Preferences.sent = false;
                        break;
                    }
                    case 6012: {
                        if (glActive()) MaterialManager.setMaterial(0, 0);
                        Preferences.highDetailLighting = arrayAtI32(ScriptRunner.intStack, --isp) === 1;
                        if (glActive() && Preferences.graphics.highDetailLighting) {
                            Pix3D.setBrightness(Math.fround(0.7));
                        } else {
                            if (Preferences.brightness === 1) Pix3D.setBrightness(Math.fround(0.9));
                            if (Preferences.brightness === 2) Pix3D.setBrightness(Math.fround(0.8));
                            if (Preferences.brightness === 3) Pix3D.setBrightness(Math.fround(0.7));
                            if (Preferences.brightness === 4) Pix3D.setBrightness(Math.fround(0.6));
                        }
                        Client.rebuildSceneIfIngame(108);
                        Preferences.write(GameShell.signlink);
                        Preferences.sent = false;
                        break;
                    }
                    case 6014: {
                        Preferences.highWaterDetail = arrayAtI32(ScriptRunner.intStack, --isp) === 1;
                        if (glActive()) Client.rebuildSceneIfIngame(109);
                        Preferences.write(GameShell.signlink);
                        Preferences.sent = false;
                        break;
                    }
                    case 6015: {
                        Preferences.fogEnabled = arrayAtI32(ScriptRunner.intStack, --isp) === 1;
                        if (glActive()) Client.forceImmediateEnvironmentUpdate = true;
                        Preferences.write(GameShell.signlink);
                        Preferences.sent = false;
                        break;
                    }
                    case 6016: {
                        let value = arrayAtI32(ScriptRunner.intStack, --isp);
                        if (glJar && GlRenderer.active) GameShell.canvasInvalid = true;
                        if (value < 0 || value > 2) value = 0;
                        Preferences.currentAntiAliasingMode = value;
                        break;
                    }
                    case 6017: {
                        Preferences.stereo = arrayAtI32(ScriptRunner.intStack, --isp) === 1;
                        AudioEngine.setStereo(1);
                        Preferences.write(GameShell.signlink);
                        Preferences.sent = false;
                        break;
                    }
                    case 6018: {
                        let value = arrayAtI32(ScriptRunner.intStack, --isp);
                        if (value < 0) value = 0;
                        if (value > 127) value = 127;
                        Preferences.soundEffectVolume = value;
                        Preferences.write(GameShell.signlink);
                        Preferences.sent = false;
                        break;
                    }
                    case 6019: {
                        let value = arrayAtI32(ScriptRunner.intStack, --isp);
                        if (value < 0) value = 0;
                        if (value > 255) value = 255;
                        if (value !== Preferences.musicVolume) {
                            if (Preferences.musicVolume === 0 && Client.midiSong !== -1) {
                                if (glJar) {
                                    const archive = Client.m_pMidi;
                                    MidiManager.queue(0, false, Client.midiSong, archive, value);
                                } else MidiManager.queue(0, false, Client.midiSong, Client.m_pMidi, value);
                                Client.jingleActive = false;
                            } else if (value === 0) {
                                MidiManager.stopImmediate();
                                Client.jingleActive = false;
                            } else {
                                MidiManager.SetVolume(value);
                            }
                            Preferences.musicVolume = value;
                        }
                        Preferences.write(GameShell.signlink);
                        Preferences.sent = false;
                        break;
                    }
                    case 6020: {
                        let value = arrayAtI32(ScriptRunner.intStack, --isp);
                        if (value < 0) value = 0;
                        if (value > 127) value = 127;
                        Preferences.areaSoundVolume = value;
                        Preferences.write(GameShell.signlink);
                        Preferences.sent = false;
                        break;
                    }
                    case 6021: {
                        RoofModeStatics.roofRemovalDisabled = arrayAtI32(ScriptRunner.intStack, --isp) === 1;
                        RoofModeStatics.applyRoofMode();
                        break;
                    }
                    case 6023: {
                        let value = arrayAtI32(ScriptRunner.intStack, --isp);
                        if (value < 0) value = 0;
                        let limited = false;
                        if (value > 2) value = 2;
                        if (GameShell.maxMemory < 96) {
                            value = 0;
                            limited = true;
                        }
                        ParticleSystem.setDetailLevel(value);
                        Preferences.write(GameShell.signlink);
                        Preferences.sent = false;
                        arrayPutI32(ScriptRunner.intStack, isp++, limited ? 0 : 1);
                        break;
                    }
                    case 6024: {
                        let value = arrayAtI32(ScriptRunner.intStack, --isp);
                        if (value < 0 || value > 2) value = 0;
                        Preferences.antiAliasingMode = value;
                        Preferences.write(GameShell.signlink);
                        break;
                    }
                    case 6028: {
                        Preferences.cursorsEnabled = arrayAtI32(ScriptRunner.intStack, --isp) !== 0;
                        Preferences.write(GameShell.signlink);
                        break;
                    }
                    case 6101:
                        arrayPutI32(ScriptRunner.intStack, isp++, Preferences.brightness);
                        break;
                    case 6102:
                        arrayPutI32(ScriptRunner.intStack, isp++, +Preferences.getAllLevelsVisible());
                        break;
                    case 6103:
                        arrayPutI32(ScriptRunner.intStack, isp++, +Preferences.removeRoofsSelectively);
                        break;
                    case 6105:
                        arrayPutI32(ScriptRunner.intStack, isp++, +Preferences.showGroundDecorations);
                        break;
                    case 6106:
                        arrayPutI32(ScriptRunner.intStack, isp++, +Preferences.highDetailTextures);
                        break;
                    case 6107:
                        arrayPutI32(ScriptRunner.intStack, isp++, +Preferences.manyIdleAnimations);
                        break;
                    case 6108:
                        arrayPutI32(ScriptRunner.intStack, isp++, +Preferences.flickeringEffects);
                        break;
                    case 6109:
                        arrayPutI32(ScriptRunner.intStack, isp++, +Preferences.highDetailTextures2);
                        break;
                    case 6110:
                        arrayPutI32(ScriptRunner.intStack, isp++, +Preferences.characterShadows);
                        break;
                    case 6111:
                        arrayPutI32(ScriptRunner.intStack, isp++, Preferences.sceneryShadows);
                        break;
                    case 6112:
                        arrayPutI32(ScriptRunner.intStack, isp++, +Preferences.highDetailLighting);
                        break;
                    case 6114:
                        arrayPutI32(ScriptRunner.intStack, isp++, +Preferences.highWaterDetail);
                        break;
                    case 6115:
                        arrayPutI32(ScriptRunner.intStack, isp++, +Preferences.fogEnabled);
                        break;
                    case 6116:
                        arrayPutI32(ScriptRunner.intStack, isp++, Preferences.currentAntiAliasingMode);
                        break;
                    case 6117:
                        arrayPutI32(ScriptRunner.intStack, isp++, +Preferences.stereo);
                        break;
                    case 6118:
                        arrayPutI32(ScriptRunner.intStack, isp++, Preferences.soundEffectVolume);
                        break;
                    case 6119:
                        arrayPutI32(ScriptRunner.intStack, isp++, Preferences.musicVolume);
                        break;
                    case 6120:
                        arrayPutI32(ScriptRunner.intStack, isp++, Preferences.areaSoundVolume);
                        break;
                    case 6121: {
                        const renderer = glJar ? GlRenderer : null;
                        if (renderer !== null && renderer.active) {
                            arrayPutI32(ScriptRunner.intStack, isp++, +renderer.multisampleSupported);
                        } else {
                            arrayPutI32(ScriptRunner.intStack, isp++, 0);
                        }
                        break;
                    }
                    case 6123:
                        arrayPutI32(ScriptRunner.intStack, isp++, ParticleSystem.getDetailLevel());
                        break;
                    case 6124:
                        arrayPutI32(ScriptRunner.intStack, isp++, Preferences.antiAliasingMode);
                        break;
                    case 6128:
                        arrayPutI32(ScriptRunner.intStack, isp++, +Preferences.cursorsEnabled);
                        break;
                    case 6200:
                        isp -= 2;
                        Client.viewportFovLow = (arrayAtI32(ScriptRunner.intStack, isp) << 16) >> 16;
                        if (Client.viewportFovLow <= 0) Client.viewportFovLow = 256;
                        Client.zoomWidth2 = (arrayAtI32(ScriptRunner.intStack, isp + 1) << 16) >> 16;
                        if (Client.zoomWidth2 <= 0) Client.zoomWidth2 = 205;
                        break;
                    case 6201:
                        isp -= 2;
                        Client.viewportZoomMin = (arrayAtI32(ScriptRunner.intStack, isp) << 16) >> 16;
                        if (Client.viewportZoomMin <= 0) Client.viewportZoomMin = 256;
                        Client.zoomWidth = (arrayAtI32(ScriptRunner.intStack, isp + 1) << 16) >> 16;
                        if (Client.zoomWidth <= 0) Client.zoomWidth = 320;
                        break;
                    case 6202:
                        isp -= 4;
                        Client.fovClampMinWidth = (arrayAtI32(ScriptRunner.intStack, isp) << 16) >> 16;
                        if (Client.fovClampMinWidth <= 0) Client.fovClampMinWidth = 1;
                        Client.viewportMaxZoom = (arrayAtI32(ScriptRunner.intStack, isp + 1) << 16) >> 16;
                        if (Client.viewportMaxZoom <= 0) Client.viewportMaxZoom = 32767;
                        else if (glJar ? Client.fovClampMinWidth > Client.viewportMaxZoom : Client.viewportMaxZoom < Client.fovClampMinWidth) Client.viewportMaxZoom = Client.fovClampMinWidth;
                        Client.zoomWidthMin = (arrayAtI32(ScriptRunner.intStack, isp + 2) << 16) >> 16;
                        if (Client.zoomWidthMin <= 0) Client.zoomWidthMin = 1;
                        Client.fovClampMaxHeight = (arrayAtI32(ScriptRunner.intStack, isp + 3) << 16) >> 16;
                        if (Client.fovClampMaxHeight <= 0) Client.fovClampMaxHeight = 32767;
                        else if (glJar ? Client.fovClampMaxHeight < Client.zoomWidthMin : Client.zoomWidthMin > Client.fovClampMaxHeight) Client.fovClampMaxHeight = Client.zoomWidthMin;
                        break;
                    case 6203: {
                        let width: number, height: number;
                        if (glJar) {
                            width = requireNonNull(InterfaceList.viewportComponent).width;
                            height = requireNonNull(InterfaceList.viewportComponent).height;
                        } else {
                            height = requireNonNull(InterfaceList.viewportComponent).height;
                            width = requireNonNull(InterfaceList.viewportComponent).width;
                        }
                        Client.GdmCalcWindowSize(0, 0, width, height, false);
                        arrayPutI32(ScriptRunner.intStack, isp++, Client.viewportWidth);
                        arrayPutI32(ScriptRunner.intStack, isp++, Client.viewportHeight);
                        break;
                    }
                    case 6204:
                        arrayPutI32(ScriptRunner.intStack, isp++, Client.viewportZoomMin);
                        arrayPutI32(ScriptRunner.intStack, isp++, Client.zoomWidth);
                        break;
                    case 6205:
                        arrayPutI32(ScriptRunner.intStack, isp++, Client.viewportFovLow);
                        arrayPutI32(ScriptRunner.intStack, isp++, Client.zoomWidth2);
                        break;
                    case 6300:
                        arrayPutI32(ScriptRunner.intStack, isp++, Number(BigInt.asIntN(32, SafeTime.CurrentTimeMillis() / 60000n)));
                        break;
                    case 6301:
                        arrayPutI32(ScriptRunner.intStack, isp++, (Number(BigInt.asIntN(32, SafeTime.CurrentTimeMillis() / 86400000n)) - 11745) | 0);
                        break;
                    case 6302: {
                        isp -= 3;
                        const month = arrayAtI32(ScriptRunner.intStack, isp + 1);
                        const day = arrayAtI32(ScriptRunner.intStack, isp);
                        const year = arrayAtI32(ScriptRunner.intStack, isp + 2);
                        ScriptRunner.calendar.clear();
                        ScriptRunner.calendar.setHourOfDay(12);
                        ScriptRunner.calendar.setDate(year, month, day);
                        arrayPutI32(ScriptRunner.intStack, isp++, (Number(BigInt.asIntN(32, ScriptRunner.calendar.getTimeInMillis() / 86400000n)) - 11745) | 0);
                        break;
                    }
                    case 6303: {
                        ScriptRunner.calendar.clear();
                        const calendar = ScriptRunner.calendar;
                        const now = SafeTime.CurrentTimeMillis();
                        requireNonNull(calendar).setTimeInMillis(now);
                        arrayPutI32(ScriptRunner.intStack, isp++, ScriptRunner.calendar.get(1));
                        break;
                    }
                    case 6304: {
                        const year = arrayAtI32(ScriptRunner.intStack, --isp);
                        let leap = true;
                        if (year < 0) leap = ((year + 1) | 0) % 4 === 0;
                        else if (year < 1582) leap = year % 4 === 0;
                        else if (year % 4 !== 0 || (year % 100 === 0 && year % 400 !== 0)) leap = false;
                        arrayPutI32(ScriptRunner.intStack, isp++, leap ? 1 : 0);
                        break;
                    }
                    case 6405:
                        arrayPutI32(ScriptRunner.intStack, isp++, +BrowserControl.showVideoAd2());
                        break;
                    case 6406:
                        arrayPutI32(ScriptRunner.intStack, isp++, +BrowserControl.isVideoAdDone());
                        break;
                    case 6500: {
                        if (Client.gameState !== 10 || Login.worldLookupStep !== 0 || Client.loginStep !== 0 || AccountCreation.step !== 0) {
                            arrayPutI32(ScriptRunner.intStack, isp++, 1);
                            break;
                        }
                        const destination = ScriptRunner.intStack;
                        const slot = isp++;
                        const result = GameWorld.ListFetch();
                        if (result instanceof Promise) {
                            yield result.then(value => arrayPutI32(destination, slot, value === -1 ? 0 : 1));
                        } else {
                            arrayPutI32(destination, slot, result === -1 ? 0 : 1);
                        }
                        break;
                    }
                    case 6501: {
                        const world = GameWorld.ListStart();
                        if (world === null) {
                            arrayPutI32(ScriptRunner.intStack, isp++, -1);
                            arrayPutI32(ScriptRunner.intStack, isp++, 0);
                            arrayPutObj(ScriptRunner.stringStack, ssp++, ScriptRunner.emptyString);
                            arrayPutI32(ScriptRunner.intStack, isp++, 0);
                            arrayPutObj(ScriptRunner.stringStack, ssp++, ScriptRunner.emptyString);
                            arrayPutI32(ScriptRunner.intStack, isp++, 0);
                        } else {
                            arrayPutI32(ScriptRunner.intStack, isp++, world.id);
                            arrayPutI32(ScriptRunner.intStack, isp++, world.flags);
                            arrayPutObj(ScriptRunner.stringStack, ssp++, world.activity);
                            const country = world.getCountry();
                            arrayPutI32(ScriptRunner.intStack, isp++, requireNonNull(country).flag);
                            arrayPutObj(ScriptRunner.stringStack, ssp++, requireNonNull(country).name);
                            arrayPutI32(ScriptRunner.intStack, isp++, world.players);
                        }
                        break;
                    }
                    case 6502: {
                        const world = GameWorld.ListNext();
                        if (world === null) {
                            arrayPutI32(ScriptRunner.intStack, isp++, -1);
                            arrayPutI32(ScriptRunner.intStack, isp++, 0);
                            arrayPutObj(ScriptRunner.stringStack, ssp++, ScriptRunner.emptyString);
                            arrayPutI32(ScriptRunner.intStack, isp++, 0);
                            arrayPutObj(ScriptRunner.stringStack, ssp++, ScriptRunner.emptyString);
                            arrayPutI32(ScriptRunner.intStack, isp++, 0);
                        } else {
                            arrayPutI32(ScriptRunner.intStack, isp++, world.id);
                            arrayPutI32(ScriptRunner.intStack, isp++, world.flags);
                            arrayPutObj(ScriptRunner.stringStack, ssp++, world.activity);
                            const country = world.getCountry();
                            arrayPutI32(ScriptRunner.intStack, isp++, requireNonNull(country).flag);
                            arrayPutObj(ScriptRunner.stringStack, ssp++, requireNonNull(country).name);
                            arrayPutI32(ScriptRunner.intStack, isp++, world.players);
                        }
                        break;
                    }
                    case 6503: {
                        const world = arrayAtI32(ScriptRunner.intStack, --isp);
                        if (Client.gameState === 10 && Login.worldLookupStep === 0 && Client.loginStep === 0 && AccountCreation.step === 0) {
                            arrayPutI32(ScriptRunner.intStack, isp++, TitleScreen.SwitchToWorld(world) ? 1 : 0);
                        } else arrayPutI32(ScriptRunner.intStack, isp++, 0);
                        break;
                    }
                    case 6504:
                        Preferences.favouriteWorld = arrayAtI32(ScriptRunner.intStack, --isp);
                        Preferences.write(GameShell.signlink);
                        break;
                    case 6505:
                        arrayPutI32(ScriptRunner.intStack, isp++, Preferences.favouriteWorld);
                        break;
                    case 6506: {
                        const world = GameWorld.GetByID(arrayAtI32(ScriptRunner.intStack, --isp));
                        if (world === null) {
                            arrayPutI32(ScriptRunner.intStack, isp++, -1);
                            arrayPutObj(ScriptRunner.stringStack, ssp++, ScriptRunner.emptyString);
                            arrayPutI32(ScriptRunner.intStack, isp++, 0);
                            arrayPutObj(ScriptRunner.stringStack, ssp++, ScriptRunner.emptyString);
                            arrayPutI32(ScriptRunner.intStack, isp++, 0);
                        } else {
                            arrayPutI32(ScriptRunner.intStack, isp++, world.flags);
                            arrayPutObj(ScriptRunner.stringStack, ssp++, world.activity);
                            const country = world.getCountry();
                            arrayPutI32(ScriptRunner.intStack, isp++, requireNonNull(country).flag);
                            arrayPutObj(ScriptRunner.stringStack, ssp++, requireNonNull(country).name);
                            arrayPutI32(ScriptRunner.intStack, isp++, world.players);
                        }
                        break;
                    }
                    case 6507: {
                        isp -= 4;
                        let primary: number, secondary: number;
                        if (glJar) {
                            secondary = arrayAtI32(ScriptRunner.intStack, isp + 2);
                            primary = arrayAtI32(ScriptRunner.intStack, isp);
                        } else {
                            primary = arrayAtI32(ScriptRunner.intStack, isp);
                            secondary = arrayAtI32(ScriptRunner.intStack, isp + 2);
                        }
                        const reverseSecondary = arrayAtI32(ScriptRunner.intStack, isp + 3) === 1;
                        const reversePrimary = arrayAtI32(ScriptRunner.intStack, isp + 1) === 1;
                        GameWorld.ListSort(primary, reversePrimary, secondary, reverseSecondary);
                        break;
                    }
                    case 6600:
                        Preferences.steppedCameraKeys = arrayAtI32(ScriptRunner.intStack, --isp) === 1;
                        Preferences.write(GameShell.signlink);
                        break;
                    case 6601:
                        arrayPutI32(ScriptRunner.intStack, isp++, +Preferences.steppedCameraKeys);
                        break;
                    default: {
                        // Unknown low instructions still load the operand at 07ce before 769b throws.
                        if (opcode < 100) arrayAtI32(operands, pc);
                        throw new IllegalStateException();
                    }
                }
            }
        } catch (error) {
            if (error === applicationExit) return;
            if (!(error instanceof Error) || error instanceof JavaError) throw error;
            let message: string;
            // The Java error reporter itself reads the current script's name before logging.
            if (script === null) throw new TypeError("Cannot read properties of null (reading 'name')");
            if (script.name !== null) {
                const trace = JagString.allocate(30);
                trace.append(ScriptRunner.errorInLabel).append(script.name);
                for (let i = ScriptRunner.frameCount - 1; i >= 0; i--) {
                    trace.append(ScriptRunner.viaScript);
                    const frame = requireNonNull(arrayAtObj(ScriptRunner.frames, i));
                    trace.append(requireNonNull(requireNonNull(frame.script).name));
                }
                if (opcode === 40) {
                    const id = arrayAtI32(operands, pc);
                    trace.append(ScriptRunner.gosubErrorPrefix).append(JagString.fromInt(id));
                }
                if (Client.modeWhere !== 0) {
                    Client.AddChat(JagString.join([ScriptRunner.scriptErrorPrefix, script.name]), ScriptRunner.emptyString, 0);
                }
                message = 'CS2 - scr:' + script.key + ' op:' + opcode;
                const bytes = trace.toBytes();
                message += utf8String(bytes, 0, bytes.length);
            } else {
                if (Client.modeWhere !== 0) Client.AddChat(ScriptRunner.scriptErrorMessage, ScriptRunner.emptyString, 0);
                message = 'CS2 - scr:' + script.key + ' op:' + opcode;
            }
            if (this.report) this.report(new Error(message, { cause: error }));
            else void reportClientError(error, message);
        }
    }
}
