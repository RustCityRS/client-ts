import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Js5 from '../../src/cache/Js5.js';
import Js5Index from '../../src/cache/Js5Index.js';
import Js5ResourceProvider from '../../src/cache/Js5ResourceProvider.js';
import Client from '../../src/client/Client.js';
import ClientBuild from '../../src/client/ClientBuild.js';
import FriendChatChannel from '../../src/client/FriendChatChannel.js';
import FriendChatUser from '../../src/client/FriendChatUser.js';
import GameShell from '../../src/client/GameShell.js';
import HintArrow from '../../src/client/HintArrow.js';
import OrbitCamera from '../../src/client/OrbitCamera.js';
import ReceivePlayerPositions from '../../src/client/ReceivePlayerPositions.js';
import FloType from '../../src/config/FloType.js';
import FluType from '../../src/config/FluType.js';
import LocType from '../../src/config/LocType.js';
import MSIType from '../../src/config/MSIType.js';
import MSITypeList from '../../src/config/MSITypeList.js';
import NpcType from '../../src/config/NpcType.js';
import VarBitType from '../../src/config/VarBitType.js';
import ClientNpc from '../../src/dash3d/ClientNpc.js';
import ClientObjNode from '../../src/dash3d/ClientObjNode.js';
import ClientPlayer from '../../src/dash3d/ClientPlayer.js';
import CollisionMap from '../../src/dash3d/CollisionMap.js';
import Ground from '../../src/dash3d/Ground.js';
import GroundDecor from '../../src/dash3d/GroundDecor.js';
import MinimapBuilder from '../../src/dash3d/MinimapBuilder.js';
import ModelSource from '../../src/dash3d/ModelSource.js';
import Pix3D from '../../src/dash3d/Pix3D.js';
import PlayerModel from '../../src/dash3d/PlayerModel.js';
import QuickGround from '../../src/dash3d/QuickGround.js';
import Square from '../../src/dash3d/Square.js';
import Wall from '../../src/dash3d/Wall.js';
import world from '../../src/dash3d/world.js';
import JagString, { fromLiteral } from '../../src/datastruct/JagString.js';
import LRUHashCache from '../../src/datastruct/LRUHashCache.js';
import SharedPtrList from '../../src/datastruct/SharedPtrList.js';
import AbstractSprite from '../../src/graphics/AbstractSprite.js';
import Pix2D from '../../src/graphics/Pix2D.js';
import Pix32 from '../../src/graphics/Pix32.js';
import PixfontGeneric from '../../src/graphics/PixfontGeneric.js';
import PixScreen from '../../src/graphics/PixScreen.js';
import SoftwareFont from '../../src/graphics/SoftwareFont.js';
import SpriteLoader from '../../src/graphics/SpriteLoader.js';
import Crc32 from '../../src/io/Crc32.js';
import IfType from '../../src/ui/IfType.js';
import InterfaceList from '../../src/ui/InterfaceList.js';
import WorldMapLabels from '../../src/ui/WorldMapLabels.js';
import { doubleToInt } from '../../src/util/IntUtils.js';
import ClientVarCache from '../../src/util/ClientVarCache.js';
import { arrayAt, arrayPut, requireNonNull } from '../../src/util/JavaArray.js';
import { mathRandom } from '../../src/util/JavaRandom.js';
import { readGroup } from '../cachefile.js';
import { cachePath, gamepackPath } from '../reference.js';
import { PIX2D, SPRITE_LOADER, type StaticReset, withClinitStatics } from './staticState.js';

// MinimapBuilder.CompassDraw (ke.a(ILaj;III)V), Draw (fd.a(ILaj;III)V) and BuildBuffer (ph.a(IZ)Z) against
// client.jar, in two halves. Both run their TS side with every static the fixtures and the three methods touch reset
// to its fresh-JVM value first and restored afterwards (staticState.ts), since each Java side runs in a fresh JVM.
//
// The edge half: each scenario is "op seed mode"; this file and minimap-builder/MinimapBuilderOracle.java build the
// same synthetic state from the same xorshift stream, step for step, run the method, and report how it ended
// (completed, or which Java exception), the framebuffer hash, the ce.T redraw flags, Pix2D's clip and mask state, and
// for BuildBuffer the return value, map-function arrays and count, ek.w/ob.Kb identity and pixels, the bound target
// and the next Math.random draw (so the number of random draws must match too). The modes force the edge paths: null
// component/masks/sprites/fonts/player, a short mask, redraw index 100, a component past the framebuffer edge (the
// label clip mask then throws), minimap states 2/5, a non-rh image, zoom -256 (division by zero), a short mapdot
// array, a short clan list, level 4, a map-scene sprite that is not loaded (the build fails and keeps ob.Kb), an
// existing ob.Kb, a 100x100 image, no draw area, and map-function overflow past 1000.
// Draw places map functions, ground objects, NPCs and players within a few tiles of the local player, so their dots
// survive DrawDot's radius cull and the friend/clan/team/icon choices show in the pixels. Build opens the collision
// maps' inner squares (ke's reset leaves 0x1000000 there, which is in all four walk masks and would pin every walk),
// so the map-function walk really moves and hits its bounds and blockers, and loc 105's own map function cycles
// through ph.a's excluded set.
//
// The real half (minimap-builder/MinimapRealOracle.java): Lumbridge, built here with the native ClientBuild loaders
// from the cache's four map squares and their loc, underlay and overlay types, recorded as world calls (SetGround,
// SetWall, AddScenery, SetGroundDecor with nc.a's typecodes), level flags and collision flags, and replayed by both
// sides into their own world. Both load the real archives (sector files) and run the real loaders: LocType, MSIType
// (map scenes), NpcType, VarBitType, IfType, the sprite group ids, the p11/p12/b12 fonts, the minimap sprites
// (map functions recoloured with a seeded Math.random, map dots, flag, compass, markers, edge arrows) and the main map
// labels; and the minimap and compass components of the fixed and resizable game frames (548:64/65, 746:8/10) with
// their GetMask spans. One result line per op. BuildBuffer runs on every level, fresh, recycling the last image, for
// another player level, and with the map-scene sprites unavailable (it fails, keeps the half-drawn image, and the
// next build resumes); each line has the result, the map-function arrays, the whole 512x512 image (with 8 band
// hashes), ek.w/ob.Kb identity, the bound target, the next Math.random draw and the count of DrawDetail calls and
// failures. Draw and CompassDraw then run over that image into a 765x503 frame at many yaws, angles, zooms, minimap
// states and positions, with real NPC types (plain, without a dot, not interactive, multinpcs over random varbits/
// varps, a forced map icon), players (friend, clan, team, unnamed), hint arrows of every type near and past the edge
// and at the actor arrays' bounds, the flag, ground objects and the real labels moved next to the player; each line
// has the frame hash, redraw flags, clip state and the ordered log of every DrawDot (wa.a) and DrawArrow (hd.a) call
// with its arguments and sprite. The Java log comes from fd/hd/ph rewritten (JDK ASM) to call through logging
// wrappers; the TS log from wrapping Client.DrawDot/DrawArrow/DrawDetail.
// Sensitivity: 48 of 53 single-statement mutations of MinimapBuilder.ts (bounds, masks, offsets, colours, argument
// and branch order, dropped stores, the walk, the label/dot/arrow choices) make this file fail; 8 of them are caught
// only by the real half (the four arrow actor bounds, the arrow blink cycle, the map flag test, the compass angle,
// the left label bound). The five survivors are equivalent: tileZ < 103 -> < 102 in the walk (ke's reset blocks the outer border with
// 0xffffff, which holds every walk mask bit, so the walk never steps onto z = 103), the +width, +height and -height
// label bounds turned strict (a label exactly there is drawn wholly outside the component's clip rectangle), and
// mapIcon === -1 -> < 0 (the decoder stores g2 or the default -1).
// MINIMAP_TALLY=1 prints the edge half's path counts; MINIMAP_REAL_DUMP=<prefix> writes the real half's script and
// both outputs.

const W = 140;
const H = 120;
const NAMES = ['alice', 'bob', 'Carol', 'dave1', 'e_f', 'zz'];
const LABELS = ['Lumbridge', 'Varrock<br>East', '<col=ff0000>Draynor</col>', '', 'A', 'Al Kharid'];
const KINDS = [0, 1, 2, 10, 5];
const FLAGS = [0x8, 0x80, 0x2, 0x20, 0x100, 0x200000, 0x40000, 0x1000, 0x4];

let s = 0;
let frame = new Int32Array(0);
let comp: IfType | null = null;
let x = 0;
let y = 0;
let index = 0;
let builtFn5 = -1;

function rnd(): number {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return s;
}

function r(n: number): number {
    return (rnd() >>> 1) % n;
}

// A vc that is not an rh: the checkcasts must throw before anything reads it.
function other(): AbstractSprite {
    return Object.create(AbstractSprite.prototype) as AbstractSprite;
}

class Screen extends PixScreen {
    constructor() {
        super();
    }
    draw(): void {}
    init(): void {}
    drawClipped(): void {}
}

function dot(w: number, h: number): Pix32 {
    const d = new Pix32(w, h);
    const pixels = requireNonNull(d.pixels);
    for (let i = 0; i < pixels.length; i++) pixels[i] = r(3) === 0 ? 0 : rnd();
    return d;
}

function image(w: number, h: number, seed: number): Pix32 {
    const d = new Pix32(w, h);
    const pixels = requireNonNull(d.pixels);
    for (let i = 0; i < pixels.length; i++) pixels[i] = Math.imul(i, 0x2545f491) ^ seed;
    return d;
}

function font(style: number): SoftwareFont {
    const metrics = new Uint8Array(257).fill(4 + style);
    metrics[256] = 9 + style;
    const gw = 3 + (style % 2);
    const zero = new Int32Array(256);
    const w = new Int32Array(256).fill(gw);
    const h = new Int32Array(256).fill(5);
    const mask = Array.from({ length: 256 }, (_, c) => {
        const m = new Uint8Array(gw * 5);
        for (let j = 0; j < m.length; j++) if ((c + j + style) % 3 !== 0) m[j] = 1;
        return m;
    });
    return new SoftwareFont(metrics, zero, zero, w, h, mask);
}

function name(i: number) {
    return fromLiteral(NAMES[i]);
}

function key(id: number, shape: number, angle: number, neg: boolean): bigint {
    const k = (BigInt(id) << 32n) | 0x40000000n | BigInt((angle & 3) << 20) | BigInt(shape << 14) | 69n;
    return neg ? k | -0x8000000000000000n : k;
}

// fn5 is loc 105's own map function (its multi [102] never resolves, so ph.a keeps it).
function locs(fn5: number): void {
    LocType.m_recentUse.Reset();
    MSITypeList.types.Reset();
    MSITypeList.spriteCache.Reset();
    MSITypeList.archive = null;
    MSITypeList.spritesArchive = new Js5({ index: () => null, group: () => null, prefetchGroup() {}, GetGroupLoadPercentage: () => 0 }, true, true);
    const functions = [0, 22, -1, -1, 5, -1, 48, -1];
    const multis = [null, null, null, [-1, 101, 100], [102, -1], [102], null, null];
    for (let i = 0; i < 8; i++) {
        const l = new LocType();
        l.id = 100 + i;
        l.mapFunction = i === 5 ? fn5 : functions[i];
        const multi = multis[i];
        l.multi = multi === null ? null : Int32Array.from(multi);
        l.mapScene = i === 7 ? 10 : -1;
        l.msiRotate = false;
        l.msiAngle = 0;
        l.width = 1;
        l.length = 1;
        LocType.m_recentUse.Put(BigInt(100 + i), l);
    }
    const m = new MSIType();
    m.m_spriteID = 40;
    m.m_resize = false;
    m.m_tint = 0;
    MSITypeList.types.Put(10n, m);
}

function common(mode: number): void {
    frame = new Int32Array(W * H);
    for (let i = 0; i < frame.length; i++) frame[i] = Math.imul(i, 0x9e3779b1) ^ s;
    Pix2D.setPixels(mode === 6 ? null : frame, W, H);
    const cw = 40 + r(50);
    const ch = 40 + r(50);
    x = r(W - cw + 1);
    y = r(H - ch + 1);
    const c = new IfType();
    c.width = cw;
    c.height = ch;
    const starts = new Int32Array(ch);
    const widths = new Int32Array(ch);
    for (let i = 0; i < ch; i++) {
        const a = r(6);
        starts[i] = a;
        widths[i] = cw - a - r(6);
    }
    c.maskStarts = starts;
    c.maskWidths = widths;
    comp = c;
    index = r(100);
    InterfaceList.rectangleRedraw.fill(false);
    switch (mode) {
        case 1:
            comp = null;
            break;
        case 2:
            c.maskStarts = null;
            break;
        case 3:
            c.maskWidths = new Int32Array(3);
            break;
        case 4:
            index = 100;
            break;
        case 5:
            x = W - 10;
            break;
        case 7:
            y = H - 10;
            break;
    }
}

function status(e: unknown): string {
    if (e instanceof TypeError) return e.message.startsWith('ClassCastException') ? 'cast' : 'null';
    if (e instanceof RangeError) {
        if (e.message === '/ by zero') return 'division';
        if (/index/.test(e.message)) return 'bounds';
    }
    if (e instanceof Error && e.message === 'IllegalArgumentException') return 'illegal';
    if (e instanceof Error && e.message === 'IllegalStateException') return 'state';
    throw e;
}

function hash(a: ArrayLike<number> | null): number {
    if (a === null) return 0;
    let h = 1;
    for (let i = 0; i < a.length; i++) h = (Math.imul(31, h) + a[i]) | 0;
    return h;
}

function hashFlags(a: boolean[]): number {
    let h = 1;
    for (const v of a) h = (Math.imul(31, h) + (v ? 1 : 0)) | 0;
    return h;
}

function pix(): string {
    return `${hash(frame)}|${hashFlags(InterfaceList.rectangleRedraw)}|${Pix2D.clipMinX},${Pix2D.clipMinY},${Pix2D.clipMaxX},${Pix2D.clipMaxY}|` + `${Pix2D.maskOffsets === null}${Pix2D.maskLengths === null}`;
}

function compass(mode: number): string {
    common(mode);
    Client.imageCompass = dot(20 + r(20), 20 + r(20));
    Client.minimapState = r(7);
    OrbitCamera.followYaw = r(2048);
    const limit = r(4) === 0 ? r(6) : 3;
    if (mode === 10) Client.imageCompass = null;
    if (mode === 11) Client.imageCompass = other();
    let st = 'ok';
    try {
        MinimapBuilder.CompassDraw(index, comp, limit, x, y);
    } catch (e) {
        st = status(e);
    }
    return `${st}|${pix()}`;
}

function draw(mode: number): string {
    common(mode);
    Client.minimapState = r(8) === 0 ? (r(2) === 0 ? 2 : 5) : 0;
    OrbitCamera.followYaw = r(2048);
    OrbitCamera.minimapAngle = r(121) - 60;
    OrbitCamera.minimapZoom = r(31) - 20;
    const self = new ClientPlayer();
    self.x = r(104 * 128);
    self.z = r(104 * 128);
    self.team = r(3);
    Client.localPlayer = self;
    MinimapBuilder.minimapImage = image(512, 512, rnd());
    Client.mapBuildBaseX = r(4000);
    Client.mapBuildBaseZ = r(4000);
    Client.fontPlain11 = font(0);
    Client.p12 = font(1);
    Client.fontBold12 = font(2);
    if (r(4) === 0) {
        WorldMapLabels.scene = null;
    } else {
        const n = r(5);
        const k = new WorldMapLabels(n);
        for (let i = 0; i < n; i++) {
            k.flags[i] = r(32);
            k.x[i] = Client.mapBuildBaseX + (self.x >> 7) + r(21) - 10;
            k.z[i] = Client.mapBuildBaseZ + (self.z >> 7) + r(21) - 10;
            k.colors[i] = r(3) === 0 ? -1 : rnd() & 0xffffff;
            k.text[i] = fromLiteral(LABELS[r(LABELS.length)]);
        }
        WorldMapLabels.scene = k;
    }
    locs(-1);
    MinimapBuilder.mapFunctionLocIds.fill(0);
    Client.activeMapFunctionX.fill(0);
    Client.activeMapFunctionZ.fill(0);
    Client.activeMapFunctionCount = r(6);
    for (let i = 0; i < Client.activeMapFunctionCount; i++) {
        Client.activeMapFunctionX[i] = (self.x >> 7) + r(17) - 8;
        Client.activeMapFunctionZ[i] = (self.z >> 7) + r(17) - 8;
        MinimapBuilder.mapFunctionLocIds[i] = 100 + r(7);
    }
    const functions = new Array<AbstractSprite | null>(50).fill(null);
    for (let i = 0; i < 50; i++) functions[i] = dot(3 + (i % 4), 3 + (i % 3));
    SpriteLoader.mapfunctionsRecoloured = functions;
    Client.playerLevel = r(4);
    Client.groundObj = Array.from({ length: 4 }, () => Array.from({ length: 104 }, () => new Array<SharedPtrList<ClientObjNode> | null>(104).fill(null)));
    const objs = r(6);
    for (let i = 0; i < objs; i++) {
        const ox = Math.min(103, Math.max(0, (self.x >> 7) + r(17) - 8));
        const oz = Math.min(103, Math.max(0, (self.z >> 7) + r(17) - 8));
        Client.groundObj[Client.playerLevel][ox][oz] = new SharedPtrList<ClientObjNode>();
    }
    Client.imageMapdots = [dot(3, 3), dot(4, 4), dot(3, 4), dot(4, 3), dot(5, 5), dot(2, 2)];
    Client.npcs.fill(null);
    Client.npcCount = r(5);
    for (let i = 0; i < Client.npcCount; i++) {
        const id = r(12);
        Client.npcIds[i] = id;
        if (r(4) !== 0 && Client.npcs[id] === null) {
            const npc = new ClientNpc();
            npc.x = self.x + r(2048) - 1024;
            npc.z = self.z + r(2048) - 1024;
            if (r(5) !== 0) {
                const t = new NpcType();
                t.drawMapDot = r(4) !== 0;
                t.interactive = r(4) !== 0;
                t.mapIcon = r(3) === 0 ? r(6) : -1;
                t.multi = r(5) === 0 ? Int32Array.of(-1) : null;
                npc.npcType = t;
            }
            Client.npcs[id] = npc;
        }
    }
    Client.players.fill(null);
    ReceivePlayerPositions.m_lastNum = r(5);
    for (let i = 0; i < ReceivePlayerPositions.m_lastNum; i++) {
        const id = r(20);
        ReceivePlayerPositions.m_lastID[i] = id;
        if (r(5) !== 0 && Client.players[id] === null) {
            const p = new ClientPlayer();
            p.x = self.x + r(2048) - 1024;
            p.z = self.z + r(2048) - 1024;
            p.team = r(3);
            p.username = r(30) === 0 ? null : name(r(6));
            p.appearance = r(6) === 0 ? null : new PlayerModel();
            Client.players[id] = p;
        }
    }
    Client.friendCount = r(4);
    for (let i = 0; i < Client.friendCount; i++) {
        Client.friendName37[i] = name(r(6)).toBase37();
        Client.friendWorld[i] = r(3);
    }
    FriendChatChannel.memberCount = r(3);
    const members = new Array<FriendChatUser | null>(FriendChatChannel.memberCount).fill(null);
    FriendChatChannel.members = members;
    for (let i = 0; i < FriendChatChannel.memberCount; i++) {
        const m = new FriendChatUser();
        m.key = name(r(6)).toBase37();
        members[i] = m;
    }
    Client.loopCycle = r(40);
    Client.hintArrows.fill(null);
    for (let i = 0; i < 4; i++) {
        if (r(3) === 0) continue;
        const a = new HintArrow();
        a.type = KINDS[r(5)];
        a.actor = r(16) - 2;
        a.icon = r(2);
        a.z = Client.mapBuildBaseZ + r(104);
        a.x = Client.mapBuildBaseX + r(104);
        Client.hintArrows[i] = a;
    }
    Client.hintMapMarkers = [dot(6, 6), dot(5, 7)];
    SpriteLoader.hintMapEdge = [image(30, 30, rnd()), image(30, 30, rnd())];
    Client.destinationX = r(3) === 0 ? 0 : r(104);
    Client.destinationZ = r(104);
    Client.imageMapflag = dot(6, 8);
    switch (mode) {
        case 10:
            Client.minimapState = 2;
            break;
        case 11:
            MinimapBuilder.minimapImage = null;
            break;
        case 12:
            MinimapBuilder.minimapImage = other();
            break;
        case 13:
            Client.fontPlain11 = null;
            break;
        case 14:
            OrbitCamera.minimapZoom = -256;
            break;
        case 15:
            SpriteLoader.mapfunctionsRecoloured = null;
            break;
        case 16:
            Client.imageMapdots = [null];
            break;
        case 17:
            Client.localPlayer = null;
            break;
        case 18:
            WorldMapLabels.scene = null;
            break;
        case 19:
            FriendChatChannel.members = new Array<FriendChatUser | null>(FriendChatChannel.memberCount === 0 ? 0 : FriendChatChannel.memberCount - 1).fill(null);
            break;
        case 20:
            SpriteLoader.mapfunctionsRecoloured = new Array<AbstractSprite | null>(6).fill(null);
            break;
    }
    let st = 'ok';
    try {
        MinimapBuilder.Draw(x, comp, index, y);
    } catch (e) {
        st = status(e);
    }
    return `${st}|${pix()}`;
}

function state(v: AbstractSprite | null, prevW: AbstractSprite | null, prevK: AbstractSprite | null): string {
    if (v === null) return 'n';
    if (!(v instanceof Pix32)) return 'o';
    return `${v === prevW ? 'w' : ''}${v === prevK ? 'k' : ''}${hash(v.pixels)}`;
}

function build(mode: number): string {
    common(mode);
    const level = mode === 20 ? 4 : r(4);
    Client.playerLevel = r(3) === 0 ? r(4) : level & 3;
    const mapl = Array.from({ length: 4 }, () => Array.from({ length: 104 }, () => new Uint8Array(104)));
    ClientBuild.m_mapl = mapl;
    for (let l = 0; l < 4; l++)
        for (let i = 0; i < 104; i++)
            for (let j = 0; j < 104; j++) {
                const v = r(16);
                mapl[l][i][j] = v < 10 ? 0 : v === 10 ? 8 : v === 11 ? 16 : v === 12 ? 24 : v === 13 ? 2 : v === 14 ? 10 : 4;
            }
    const squares = Array.from({ length: 4 }, () => Array.from({ length: 104 }, () => new Array<Square | null>(104).fill(null)));
    world.squares = squares;
    for (let l = 0; l < 4; l++)
        for (let i = 0; i < 104; i++)
            for (let j = 0; j < 104; j++) {
                const v = r(10);
                if (v === 0) continue;
                const sq = new Square(l, i, j);
                squares[l][i][j] = sq;
                if (v < 7) sq.quickGround = new QuickGround(0, 0, 0, 0, -1, v === 1 ? 0 : rnd() & 0xffffff, true);
                if (r(12) === 0) {
                    const id = 100 + r(7);
                    const shape = r(4);
                    const angle = r(4);
                    const neg = r(4) === 0;
                    sq.wall = new Wall();
                    sq.wall.typecode = key(id, shape, angle, neg);
                }
                if (r(mode === 26 ? 3 : 60) === 0) {
                    const id = 100 + r(7);
                    const angle = r(4);
                    sq.groundDecor = new GroundDecor();
                    sq.groundDecor.typecode = key(id, 22, angle, false);
                }
            }
    if (mode === 21) {
        const l = level & 3;
        const i = 1 + r(102);
        const j = 1 + r(102);
        let sq = squares[l][i][j];
        if (sq === null) squares[l][i][j] = sq = new Square(l, i, j);
        sq.wall = new Wall();
        sq.wall.typecode = key(107, 0, 0, false);
        mapl[l][i][j] = 0;
    }
    for (let l = 0; l < 4; l++) {
        const m = new CollisionMap(104, 104);
        for (let a = 0; a < 104; a++) for (let bz = 0; bz < 104; bz++) if (m.flags[a][bz] === 0x1000000) m.flags[a][bz] = 0;
        for (let k = 0; k < 1500; k++) {
            const a = r(104);
            const bz = r(104);
            const v = FLAGS[r(9)];
            m.flags[a][bz] |= v;
        }
        CollisionMap.levelMaps[l] = m;
    }
    builtFn5 = [29, 34, 36, 46, 47, 3, -1, 22][r(8)];
    locs(builtFn5);
    MinimapBuilder.mapFunctionLocIds.fill(0);
    Client.activeMapFunctionX.fill(0);
    Client.activeMapFunctionZ.fill(0);
    Client.activeMapFunctionCount = -7;
    const im = r(3);
    MinimapBuilder.minimapImage = im === 0 ? null : image(512, 512, rnd());
    MinimapBuilder.pendingImage = mode === 22 ? image(512, 512, rnd()) : null;
    if (mode === 23) MinimapBuilder.minimapImage = other();
    if (mode === 24) MinimapBuilder.minimapImage = image(100, 100, rnd());
    const screen = new Screen();
    screen.pixels = new Int32Array(W * H);
    screen.height = H;
    screen.width = W;
    GameShell.drawArea = mode === 25 ? null : screen;
    const prevW = MinimapBuilder.minimapImage;
    const prevK = MinimapBuilder.pendingImage;
    mathRandom.setSeed(BigInt(rnd()));
    let st: string;
    try {
        st = String(MinimapBuilder.BuildBuffer(level));
    } catch (e) {
        st = status(e);
    }
    const next = doubleToInt(mathRandom.nextDouble() * 2147483647.0);
    return (
        `${st}|${Client.activeMapFunctionCount}|${hash(MinimapBuilder.mapFunctionLocIds)}|${hash(Client.activeMapFunctionX)}|` +
        `${hash(Client.activeMapFunctionZ)}|${state(MinimapBuilder.minimapImage, prevW, prevK)}|` +
        `${state(MinimapBuilder.pendingImage, prevW, prevK)}|${Pix2D.pixels === screen.pixels},${Pix2D.width},${Pix2D.height}|${next}`
    );
}

function runOracle(script: string): string[] {
    const source = fileURLToPath(new URL('./minimap-builder/MinimapBuilderOracle.java', import.meta.url));
    const dir = mkdtempSync(join(tmpdir(), 'minimap-builder-oracle-'));
    try {
        const javac = spawnSync('javac', ['-nowarn', '-cp', gamepackPath, '-d', dir, source], { timeout: 60000, encoding: 'utf8' });
        if (javac.status !== 0) throw new Error(`javac failed: ${javac.stderr}`);
        const java = spawnSync('java', ['--add-opens=java.base/java.lang=ALL-UNNAMED', '-Djava.awt.headless=true', '-cp', gamepackPath + delimiter + dir, 'MinimapBuilderOracle'], {
            input: script,
            timeout: 240000,
            encoding: 'utf8',
            maxBuffer: 64 * 1024 * 1024
        });
        if (java.status !== 0) throw new Error(`oracle failed (${java.status} ${java.signal}): ${java.stderr}`);
        return java.stdout
            .split('\n')
            .map(line => line.trimEnd())
            .filter(line => line.length > 0);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

test('minimap build, draw and compass match the 530 gamepack', () => {
    const rows: number[][] = [];
    let seed = 0x1f2e3d4c;
    const next = () => {
        seed ^= seed << 13;
        seed ^= seed >>> 17;
        seed ^= seed << 5;
        return seed === 0 ? 1 : seed;
    };
    for (const mode of [0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 10, 11]) for (let k = 0; k < 12; k++) rows.push([0, next(), mode]);
    for (const mode of [0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]) for (let k = 0; k < 12; k++) rows.push([1, next(), mode]);
    for (const mode of [0, 0, 0, 20, 21, 21, 22, 23, 24, 25, 26, 6]) for (let k = 0; k < 6; k++) rows.push([2, next(), mode]);
    const script = rows.map(row => row.join(' ')).join('\n') + '\n';
    const expected = runOracle(script);
    expect(expected.length).toBe(rows.length);
    const tally = new Map<string, number>();
    const count = (tag: string) => tally.set(tag, (tally.get(tag) ?? 0) + 1);
    // Count the draws each path reaches, so the scenarios provably cover labels, icons, dots and arrows.
    const { DrawDot, DrawArrow, DrawDetail } = Client;
    const paragraph = PixfontGeneric.prototype.drawParagraphAlpha;
    Client.DrawDot = (...args) => (count('dot'), DrawDot.apply(Client, args));
    Client.DrawArrow = (...args) => (count('arrow'), DrawArrow.apply(Client, args));
    Client.DrawDetail = (...args) => {
        const drawn = DrawDetail.apply(Client, args);
        if (!drawn) count('detail-false');
        return drawn;
    };
    PixfontGeneric.prototype.drawParagraphAlpha = function (...args) {
        count('label');
        return paragraph.apply(this, args);
    };
    try {
        withClinitStatics(resets(), () => {
            for (const [i, [op, sd, mode]] of rows.entries()) {
                s = sd;
                const actual = op === 0 ? compass(mode) : op === 1 ? draw(mode) : build(mode);
                expect(actual, `${op} ${sd} ${mode}`).toBe(expected[i]);
                count(op + ':' + actual.slice(0, actual.indexOf('|')));
                // A build that returned true or false gathered the map functions with loc 105's function builtFn5.
                if (op === 2 && /^(true|false)\|/.test(actual)) count('fn' + builtFn5);
            }
        });
    } finally {
        Object.assign(Client, { DrawDot, DrawArrow, DrawDetail });
        PixfontGeneric.prototype.drawParagraphAlpha = paragraph;
    }
    if (process.env.MINIMAP_TALLY) console.log([...tally].sort().join(' '));
    // Every op must reach both its normal end and its exception paths.
    for (const end of [
        '0:ok',
        '0:null',
        '0:cast',
        '0:bounds',
        '1:ok',
        '1:null',
        '1:cast',
        '1:bounds',
        '1:division',
        '1:illegal',
        '2:true',
        '2:false',
        '2:null',
        '2:bounds',
        '2:cast',
        'fn29',
        'fn34',
        'fn36',
        'fn46',
        'fn47',
        'dot',
        'arrow',
        'label',
        'detail-false'
    ]) {
        expect(tally.get(end) ?? 0, end).toBeGreaterThan(0);
    }
}, 300000);

// ---- static state: the fresh-JVM values of everything the two fixtures and the three methods touch ----

// world.<clinit>: nothing allocated; groundX/groundZ -1.
function worldClinit(): Record<string, unknown> {
    return {
        fillLeft: 0,
        dynamicCount: 0,
        roofHideMaxZ: null,
        clickLevel: 0,
        viewRadius: 0,
        cornerVisibility: null,
        hiddenRoofY: null,
        spriteBuffer: null,
        cy: 0,
        hideAreaMaxX: null,
        eyeTileZ: 0,
        roofMinX: null,
        gx: 0,
        groundZ: -1,
        minX: 0,
        levelTileOcclusionCycles: null,
        maxZ: 0,
        waterSpriteKeys: null,
        maxLevel: 0,
        squares: null,
        minLevel: 0,
        cycleNo: 0,
        mainGroundh: null,
        maxX: 0,
        cx: 0,
        occluders: null,
        numOccluders: 0,
        mainLevelTiles: null,
        underwaterHeightmap: null,
        takingInput: false,
        clickX: 0,
        dynamicSprites: null,
        minZ: 0,
        cameraCosY: 0,
        cameraCosX: 0,
        maxTileZ: 0,
        clickY: 0,
        cz: 0,
        roofHideMinZ: null,
        numActiveOccluders: 0,
        groundX: -1,
        cameraSinX: 0,
        maxTileX: 0,
        visibilityMap: null,
        activeOccluders: null,
        tileCameraClearance: null,
        levelHeightmaps: null,
        underwaterSquares: null,
        cameraSinY: 0
    };
}

// kb.<clinit>: the shape tables the Ground constructor reads (entities.test.ts and scene-entities.test.ts end with
// Ground.unload(), which nulls them) and the draw scratch arrays.
function groundClinit(): Record<string, unknown> {
    return {
        drawVertexY: new Int32Array(6),
        shapeFaces: [
            Int32Array.of(0, 1, 2, 3, 0, 0, 1, 3),
            Int32Array.of(1, 1, 2, 3, 1, 0, 1, 3),
            Int32Array.of(0, 1, 2, 3, 1, 0, 1, 3),
            Int32Array.of(0, 0, 1, 2, 0, 0, 2, 4, 1, 0, 4, 3),
            Int32Array.of(0, 0, 1, 4, 0, 0, 4, 3, 1, 1, 2, 4),
            Int32Array.of(0, 0, 4, 3, 1, 0, 1, 2, 1, 0, 2, 4),
            Int32Array.of(0, 1, 2, 4, 1, 0, 1, 4, 1, 0, 4, 3),
            Int32Array.of(0, 4, 1, 2, 0, 4, 2, 5, 1, 0, 4, 5, 1, 0, 5, 3),
            Int32Array.of(0, 4, 1, 2, 0, 4, 2, 3, 0, 4, 3, 5, 1, 0, 4, 5),
            Int32Array.of(0, 0, 4, 5, 1, 4, 1, 2, 1, 4, 2, 3, 1, 4, 3, 5),
            Int32Array.of(0, 0, 1, 5, 0, 1, 4, 5, 0, 1, 2, 4, 1, 0, 5, 3, 1, 5, 4, 3, 1, 4, 2, 3),
            Int32Array.of(1, 0, 1, 5, 1, 1, 4, 5, 1, 1, 2, 4, 0, 0, 5, 3, 0, 5, 4, 3, 0, 4, 2, 3),
            Int32Array.of(1, 0, 5, 4, 1, 0, 1, 5, 0, 0, 4, 3, 0, 4, 5, 3, 0, 5, 2, 3, 0, 1, 2, 5)
        ],
        drawTextureVertexY: new Int32Array(6),
        shapePoints: [
            Int32Array.of(1, 3, 5, 7),
            Int32Array.of(1, 3, 5, 7),
            Int32Array.of(1, 3, 5, 7),
            Int32Array.of(1, 3, 5, 7, 6),
            Int32Array.of(1, 3, 5, 7, 6),
            Int32Array.of(1, 3, 5, 7, 6),
            Int32Array.of(1, 3, 5, 7, 6),
            Int32Array.of(1, 3, 5, 7, 2, 6),
            Int32Array.of(1, 3, 5, 7, 2, 8),
            Int32Array.of(1, 3, 5, 7, 2, 8),
            Int32Array.of(1, 3, 5, 7, 11, 12),
            Int32Array.of(1, 3, 5, 7, 11, 12),
            Int32Array.of(1, 3, 5, 7, 13, 14)
        ],
        drawTextureVertexZ: new Int32Array(6),
        drawTextureVertexX: new Int32Array(6),
        drawVertexX: new Int32Array(6)
    };
}

// dc.<clinit>'s sine and cosine tables, which Draw, DrawDot and DrawArrow read (pix3d.test.ts runs Pix3D.unload()).
function pix3dTables(): Record<string, unknown> {
    const sinTable = new Int32Array(2048);
    const cosTable = new Int32Array(2048);
    for (let i = 0; i < 2048; i++) {
        sinTable[i] = (65536.0 * Math.sin(i * 0.0030679615)) | 0;
        cosTable[i] = (65536.0 * Math.cos(i * 0.0030679615)) | 0;
    }
    return { sinTable, cosTable };
}

function grid<T>(): (T | null)[][][] {
    return Array.from({ length: 4 }, () => Array.from({ length: 104 }, () => new Array<T | null>(104).fill(null)));
}

function resets(): StaticReset[] {
    const lru = (n: number) => new LRUHashCache<never>(n);
    return [
        PIX2D(),
        SPRITE_LOADER(),
        // ec.o, ek.w, ob.Kb and gk.j.
        { target: MinimapBuilder, clinit: { minimapLevel: -1, minimapImage: null, pendingImage: null, mapFunctionLocIds: new Int32Array(1000) } },
        {
            target: Client,
            clinit: {
                // qk.C, ba.h, oh.m, ah.f, ki.R, te.g, hk.e, vj.t, ed.d, uc.l, fi.n, tf.J, sj.L, jd.m, jf.b, ve.t, hh.kb, gl.z, ic.T, b.H.
                activeMapFunctionCount: 0,
                activeMapFunctionX: new Int32Array(1000),
                activeMapFunctionZ: new Int32Array(1000),
                playerLevel: 0,
                minimapState: 0,
                localPlayer: null,
                mapBuildBaseX: 0,
                mapBuildBaseZ: 0,
                npcCount: 0,
                npcs: new Array(32768).fill(null),
                npcIds: new Int32Array(32768),
                players: new Array(2048).fill(null),
                friendCount: 0,
                friendName37: new BigInt64Array(200),
                friendWorld: new Int32Array(200),
                hintArrows: new Array(4).fill(null),
                loopCycle: 0,
                destinationX: 0,
                destinationZ: 0,
                groundObj: grid<SharedPtrList<ClientObjNode>>(),
                // The sprites and fonts uf.a/si.a load (ff.u, ll.r, fe.Y, cf.e, vb.d, pe.B, oa.c, ph.m, wa.a, ma.b, rg.h, wj.g, uf.b)
                // and the group ids ld.a looks up.
                imageCompass: null,
                imageMapdots: null,
                imageMapflag: null,
                hintMapMarkers: null,
                imageMapfunction: null,
                imageHitmarks: null,
                headiconsPk: null,
                imageHeadiconsPrayer: null,
                hintHeadicons: null,
                fontPlain11: null,
                p11Software: null,
                p12: null,
                fontBold12: null,
                fontPlain11Id: 0,
                p12FullGroup: 0,
                fontBold12Id: 0,
                mapfunctionSpriteGroup: 0,
                hitbarDefaultId: 0,
                headiconsPrayerGroup: 0,
                hintHeadiconsGroup: 0,
                hintMapmarkersSpriteGroup: 0,
                mapflagGroupId: 0,
                crossGroup: 0,
                scrollbarGroupId: 0,
                nameIconsGroup: 0,
                hintMapEdgeSpriteId: 0
            }
        },
        {
            target: SpriteLoader,
            clinit: {
                headiconsPkId: 0,
                hitmarksId: 0,
                mapdotsGroupId: 0,
                compassId: 0,
                floorShadowsId: 0,
                cross: null,
                hintMapEdge: null,
                hitbarDefault: null,
                mapfunctionsRecoloured: null,
                scrollbars: null
            }
        },
        // The text state the label draws set.
        {
            target: PixfontGeneric,
            clinit: {
                nameIcons: null,
                defaultAlpha: 256,
                colour: 0,
                justifySpacing: 0,
                strikeColour: -1,
                defaultColour: 0,
                alpha: 256,
                defaultShadowColour: -1,
                justifyRemainder: 0,
                underlineColour: -1,
                shadowColour: -1,
                splitLines: new Array<JagString | null>(100).fill(null),
                splitBuffer: JagString.allocate(100)
            }
        },
        { target: SoftwareFont, clinit: { cache: new LRUHashCache<SoftwareFont>(4) } },
        // df.B, ag.e, kk.db.
        { target: OrbitCamera, clinit: { followYaw: 0, minimapAngle: 0, minimapZoom: 0 } },
        { target: WorldMapLabels, clinit: { scene: null } },
        { target: FriendChatChannel, clinit: { members: null, memberCount: 0 } },
        { target: ReceivePlayerPositions, clinit: { m_lastNum: 0, m_lastID: new Int32Array(2048) } },
        { target: InterfaceList, clinit: { rectangleRedraw: new Array<boolean>(100).fill(false) } },
        { target: GameShell, clinit: { drawArea: null } },
        { target: CollisionMap, clinit: { levelMaps: new Array<CollisionMap | null>(4).fill(null) } },
        {
            target: ClientBuild,
            clinit: {
                m_mapl: Array.from({ length: 4 }, () => Array.from({ length: 104 }, () => new Uint8Array(104))),
                buildLevel: 0,
                minusedlevel: 99,
                m_floort1: null,
                m_floort2: null,
                m_floors: null,
                m_floorr: null,
                m_mapo: null,
                m_shadow: null,
                m_huetot: null,
                m_sattot: null,
                m_ligtot: null,
                m_comtot: null,
                m_tot: null,
                AddLoc: ClientBuild.AddLoc
            }
        },
        { target: world, clinit: worldClinit() },
        { target: Ground, clinit: groundClinit() },
        // al's container checks (other suites flip them).
        { target: Js5, clinit: { strictValidation: false, maxContainerSize: 0 } },
        { target: Pix3D, clinit: pix3dTables() },
        {
            target: LocType,
            clinit: { m_pConfigClient: null, m_pModels: null, members: false, m_lowMem: false, m_recentUse: lru(64), m_mc1: lru(500), m_mc2: lru(30), m_mc3: lru(50) }
        },
        { target: MSITypeList, clinit: { archive: null, spritesArchive: null, redDelta: 0, greenDelta: 0, blueDelta: 0, types: lru(64), spriteCache: lru(64) } },
        { target: NpcType, clinit: { m_pConfigClient: null, m_pModels: null, m_recentUse: lru(64) } },
        { target: VarBitType, clinit: { m_pConfigClient: null, m_recentUse: lru(64) } },
        { target: ClientVarCache, clinit: { m_var: new Int32Array(2500) } },
        { target: IfType, clinit: { m_pSprites: null, m_pModels: null, m_pFontMetrics: null, m_pInterfaces: null, m_list: null, m_open: null } },
        { target: FloType, clinit: { m_pConfigClient: null, count: 0, m_defaultWater: 0, m_list: lru(64) } },
        { target: FluType, clinit: { m_pConfigClient: null, m_list: lru(64) } },
        // Math.random: the fixtures seed it before every use; this keeps the run from moving the suite's generator.
        { target: mathRandom, clinit: { seed: BigInt.asUintN(48, 0x530n ^ 0x5deece66dn) } }
    ];
}

// ---- the real-data half: Lumbridge, the cache's definitions, sprites, fonts, labels and minimap components ----

const RW = 765;
const RH = 503;
const REAL_NAMES = ['alice', 'bob', 'Carol', 'dave1', 'e_f', 'zz', 'Zezima', 'mod_ash'];
const MINIMAPS = [(548 << 16) | 64, (746 << 16) | 8];
const COMPASSES = [(548 << 16) | 65, (746 << 16) | 10];
// The four map squares of the Lumbridge rebuild (scene.test.ts): region id, land group, XTEA key of the loc group.
const LUMBRIDGE = [
    { region: (49 << 8) | 49, land: 254, key: [-1653558720, 2119901478, -1449369788, -1829505468] },
    { region: (49 << 8) | 50, land: 256, key: [1150282919, 572626783, -257791473, 2031745700] },
    { region: (50 << 8) | 49, land: 380, key: [183396243, -461663209, -212681663, -266126212] },
    { region: (50 << 8) | 50, land: 382, key: [0, 0, 0, 0] }
];
const BASE = 3160;

// The JS5 container without the two-byte version trailer the sector files keep after it.
function container(raw: Uint8Array): Uint8Array {
    const length = ((raw[1] << 24) | (raw[2] << 16) | (raw[3] << 8) | raw[4]) >>> 0;
    return raw.subarray(0, (raw[0] === 0 ? 5 : 9) + length);
}

// MinimapRealOracle.Provider: one archive served from the sector files.
class SectorProvider extends Js5ResourceProvider {
    private readonly table: Js5Index;

    constructor(private readonly archive: number) {
        super();
        const src = container(readGroup(cachePath, 255, archive));
        this.table = new Js5Index(src, Crc32.prefix(src, src.length));
    }

    index(): Js5Index | null {
        return this.table;
    }

    group(_mode: number, group: number): Uint8Array | null {
        return container(readGroup(cachePath, this.archive, group));
    }

    prefetchGroup(_group: number): void {}

    GetGroupLoadPercentage(_group: number): number {
        return 100;
    }
}

const js5 = (archive: number): Js5 => new Js5(new SectorProvider(archive), false, true);
// MinimapRealOracle.EMPTY: an archive with nothing loaded, for the map-scene sprites a build has to wait for.
const emptyJs5 = (): Js5 => new Js5({ index: () => null, group: () => null, prefetchGroup() {}, GetGroupLoadPercentage: () => 0 }, true, true);

// The scene models the replayed world holds (MinimapRealOracle.Model); the minimap never draws them.
class SceneModel extends ModelSource {
    draw(): void {}
    getMinY(): number {
        return 0;
    }
    update(): void {}
}

// A 16-bit HSL colour as RGB, for the generated tile colours (any deterministic colour does; these look like ground).
function hslRgb(hsl: number): number {
    const hue = ((hsl >> 10) & 63) / 64 + 0.0078125;
    const sat = ((hsl >> 7) & 7) / 8 + 0.0625;
    const light = (hsl & 127) / 128;
    const q = light < 0.5 ? light * (1 + sat) : light + sat - light * sat;
    const p = 2 * light - q;
    const channel = (t: number): number => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        const v = t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
        return Math.min(255, doubleToInt(v * 256));
    };
    return (channel(hue + 1 / 3) << 16) | (channel(hue) << 8) | channel(hue - 1 / 3);
}

function underlayColour(id: number): number {
    const t = FluType.List(id);
    return hslRgb((((t.weightedHue >> 2) & 63) << 10) | (((t.saturation >> 5) & 7) << 7) | ((t.lightness >> 1) & 127));
}

// An invisible overlay (no colour, no material) gets minimap colour 0, which Render2DGround leaves undrawn.
function overlayColour(id: number): number {
    const t = FloType.List(id);
    if (t.m_materialID !== -1) return 0x7a6a5a;
    return t.colour === -1 ? 0 : hslRgb(t.colour);
}

interface LumbridgeInfo {
    data: Buffer;
    grounds: number;
    locs: number;
    mapFunctionTiles: number[][];
    // The varbits and varps that pick the multiloc map functions (5492 and 38674 in Lumbridge).
    multiVarbits: number[];
    multiVarps: number[];
}

// Builds Lumbridge with the native loaders (ClientBuild.LoadGround/LoadLocations over the real map squares, real loc,
// underlay and overlay types) and records it as the world calls both sides replay: SetGround per tile (shape and
// rotation from the map, minimap colours from the floor types), SetWall/AddScenery/SetGroundDecor per loc with the
// typecode nc.a builds (kind 2, sign bit for inactive locs, bit 22 for raiseObject, bit 31 for jb.I, id << 32), and the
// collision flags the placements leave (CollisionMap.addWall/addLoc/blockGroundDecor), then the level flags.
function lumbridge(): LumbridgeInfo {
    const maps = js5(5);
    const config = js5(2);
    LocType.Init(js5(7), js5(16), true);
    FloType.Init(config);
    FluType.Init(config);
    world.init(4, 104, 104, 25, false);
    ClientBuild.Init(false);
    for (let l = 0; l < 4; l++) CollisionMap.levelMaps[l] = new CollisionMap(104, 104);
    const out: number[] = [];
    const locs: { ints: number[]; typecode: bigint }[] = [];
    const mapFunctionTiles: number[][] = [];
    const multiVarbits: number[] = [];
    const multiVarps: number[] = [];
    ClientBuild.AddLoc = (underwater, level, id, _heightLevel, angle, shape, x, z, _surface, collision) => {
        const t = LocType.List(id);
        let sizeX = t.width;
        let sizeZ = t.length;
        if (angle === 1 || angle === 3) {
            sizeX = t.length;
            sizeZ = t.width;
        }
        let typecode = BigInt((shape << 14) | x | (z << 7) | (angle << 20) | 0x40000000);
        if (t.active === 0 || underwater) typecode |= -0x8000000000000000n;
        if (t.raiseObject === 1) typecode |= 0x400000n;
        if (t.flag96) typecode |= 0x80000000n;
        typecode = BigInt.asIntN(64, typecode | (BigInt(id) << 32n));
        const block = t.blockwalk !== 0 && collision !== null;
        if (shape === 22) {
            locs.push({ ints: [2, level, x, z, 1, 1, t.flag90 ? 1 : 0], typecode });
            if (t.blockwalk === 1 && collision !== null) collision.blockGroundDecor(x, z);
            if (t.mapFunction >= 0 || t.multi !== null) mapFunctionTiles.push([level, x, z]);
            if (t.multi !== null && t.multiVarbit !== -1) multiVarbits.push(t.multiVarbit);
            if (t.multi !== null && t.multiVarp !== -1) multiVarps.push(t.multiVarp);
        } else if (shape === 10 || shape === 11) {
            locs.push({ ints: [1, level, x, z, sizeX, sizeZ, (angle << 9) + (shape === 11 ? 256 : 0)], typecode });
            if (block) requireNonNull(collision).addLoc(x, z, sizeX, sizeZ, t.blockrange);
        } else if (shape >= 12 || shape === 9) {
            locs.push({ ints: [1, level, x, z, 1, 1, 0], typecode });
            if (block) requireNonNull(collision).addLoc(x, z, sizeX, sizeZ, t.blockrange);
        } else if (shape <= 3) {
            const first = shape === 1 || shape === 3 ? ClientBuild.WSHAPE1[angle] : ClientBuild.WSHAPE0[angle];
            const second = shape === 2 ? ClientBuild.WSHAPE0[(angle + 1) & 3] : 0;
            locs.push({ ints: [0, level, x, z, 1, 1, first | (second << 8)], typecode });
            if (block) requireNonNull(collision).addWall(x, z, shape, angle, t.blockrange);
        }
    };
    const origin = (region: number) => [((region >> 8) * 64 - BASE) | 0, ((region & 255) * 64 - BASE) | 0];
    for (const sq of LUMBRIDGE) {
        const [x, z] = origin(sq.region);
        ClientBuild.LoadGround(z, false, 401 * 8 - 48, x, maps.GetFile(0, sq.land), (401 - 6) * 8, CollisionMap.levelMaps);
    }
    for (const sq of LUMBRIDGE) {
        const [x, z] = origin(sq.region);
        ClientBuild.LoadLocations(x, CollisionMap.levelMaps, maps.FetchFile(0, Int32Array.from(sq.key), sq.land + 1), z, false);
    }
    const t1 = requireNonNull(ClientBuild.m_floort1);
    const t2 = requireNonNull(ClientBuild.m_floort2);
    const shapes = requireNonNull(ClientBuild.m_floors);
    const rotations = requireNonNull(ClientBuild.m_floorr);
    let grounds = 0;
    const groundInts: number[] = [];
    for (let l = 0; l < 4; l++)
        for (let x = 0; x < 104; x++)
            for (let z = 0; z < 104; z++) {
                const under = t1[l][x][z];
                const over = t2[l][x][z];
                if (under === 0 && over === 0) continue;
                const underRgb = under > 0 ? underlayColour(under - 1) : 0;
                if (over === 0) groundInts.push(l, x, z, 0, 0, underRgb, 0);
                else groundInts.push(l, x, z, shapes[l][x][z] + 1, rotations[l][x][z], underRgb, overlayColour(over - 1));
                grounds++;
            }
    out.push(grounds, ...groundInts, locs.length);
    const chunks: Buffer[] = [];
    const ints = (values: number[]) => {
        const b = Buffer.alloc(values.length * 4);
        values.forEach((v, i) => b.writeInt32BE(v | 0, i * 4));
        chunks.push(b);
    };
    ints(out);
    for (const loc of locs) {
        ints(loc.ints);
        const b = Buffer.alloc(8);
        b.writeBigInt64BE(loc.typecode);
        chunks.push(b);
    }
    const mapl = requireNonNull(ClientBuild.m_mapl);
    for (let l = 0; l < 4; l++) for (let x = 0; x < 104; x++) chunks.push(Buffer.from(mapl[l][x]));
    for (let l = 0; l < 4; l++) {
        const flags = requireNonNull(CollisionMap.levelMaps[l]).flags;
        for (let x = 0; x < 104; x++) ints(Array.from(flags[x]));
    }
    return { data: Buffer.concat(chunks), grounds, locs: locs.length, mapFunctionTiles, multiVarbits, multiVarps };
}

// Big-endian reads over the fixture, as MinimapRealOracle's DataInputStream.
class FixtureReader {
    private at = 0;

    constructor(private readonly data: Buffer) {}

    int(): number {
        const v = this.data.readInt32BE(this.at);
        this.at += 4;
        return v;
    }

    long(): bigint {
        const v = this.data.readBigInt64BE(this.at);
        this.at += 8;
        return v;
    }

    bytes(n: number): Uint8Array {
        const v = Uint8Array.from(this.data.subarray(this.at, this.at + n));
        this.at += n;
        return v;
    }
}

function javaStringHash(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    return h;
}

function longHash(v: bigint): number {
    const u = BigInt.asUintN(64, v);
    return Number(BigInt.asIntN(32, u ^ (u >> 32n)));
}

function spriteDesc(v: AbstractSprite | null): string {
    if (v === null) return 'n';
    if (!(v instanceof Pix32)) return 'o';
    return `${v.cropW}x${v.cropH}:${hash(v.pixels)}`;
}

function spritesDesc(a: (AbstractSprite | null)[] | null): string {
    if (a === null) return 'n';
    let h = 1;
    for (const v of a) h = (Math.imul(31, h) + javaStringHash(spriteDesc(v))) | 0;
    return `${a.length}[${h}]`;
}

function imageDesc(v: AbstractSprite | null, prevW: AbstractSprite | null, prevK: AbstractSprite | null): string {
    if (v === null) return 'n';
    if (!(v instanceof Pix32)) return 'o';
    const p = requireNonNull(v.pixels);
    let s = `${v === prevW ? 'w' : ''}${v === prevK ? 'k' : ''}${hash(p)}`;
    if (p.length === 512 * 512) {
        for (let band = 0; band < 8; band++) s += (band === 0 ? ':' : ',') + hash(p.subarray(band * 64 * 512, (band + 1) * 64 * 512));
    }
    return s;
}

interface RealReached {
    labels: number;
    edgeArrows: number;
}

// The TS side of MinimapRealOracle.run, op for op.
function runReal(fixture: Buffer, script: string[], reached: RealReached): string[] {
    const comps = new Map<number, IfType>();
    const reader = new FixtureReader(fixture);
    let calls = '';
    let details = 0;
    let detailsFalse = 0;
    let sprites: Js5 | null = null;
    let empty: Js5 | null = null;
    let labels: WorldMapLabels | null = null;
    let screen: Screen | null = null;
    const frame = new Int32Array(RW * RH);
    const known = (c: IfType | null): string => (c !== null && [...comps.values()].includes(c) ? '' : '!');
    const tag = (s: AbstractSprite | null): string => {
        if (s === null) return 'n';
        const functions = SpriteLoader.mapfunctionsRecoloured;
        if (functions !== null) for (let i = 0; i < functions.length; i++) if (functions[i] === s) return 'f' + i;
        const dots = Client.imageMapdots;
        if (dots !== null) for (let i = 0; i < dots.length; i++) if (dots[i] === s) return 'd' + i;
        const markers = Client.hintMapMarkers;
        if (markers !== null) for (let i = 0; i < markers.length; i++) if (markers[i] === s) return 'm' + i;
        if (s === Client.imageMapflag) return 'F';
        return '?';
    };
    const name = (i: number) => fromLiteral(REAL_NAMES[i]);
    const pix = (): string => `${hash(frame)}|${hashFlags(InterfaceList.rectangleRedraw)}|${Pix2D.clipMinX},${Pix2D.clipMinY},${Pix2D.clipMaxX},${Pix2D.clipMaxY}|` + `${Pix2D.maskOffsets === null}${Pix2D.maskLengths === null}`;

    const init = (msiSeed: number, spriteSeed: number): string => {
        const config = js5(2);
        const interfaces = js5(3);
        const models = js5(7);
        sprites = js5(8);
        const fonts = js5(13);
        const locs = js5(16);
        const npcs = js5(18);
        const varbits = js5(22);
        const worldmap = js5(23);
        empty = emptyJs5();
        LocType.Init(models, locs, true);
        mathRandom.setSeed(BigInt(msiSeed));
        MSITypeList.init(sprites, config);
        NpcType.Init(npcs, models);
        VarBitType.Init(varbits);
        IfType.Init(fonts, sprites, models, interfaces);
        Client.lookupSpriteGroupIds(sprites);
        Client.loadFonts(sprites, fonts);
        mathRandom.setSeed(BigInt(spriteSeed));
        Client.loadSprites(sprites);
        labels = WorldMapLabels.load(fromLiteral('main_labels'), worldmap);
        screen = new Screen();
        screen.pixels = new Int32Array(RW * RH);
        screen.height = RH;
        screen.width = RW;
        GameShell.drawArea = screen;
        return (
            ` ${MSITypeList.redDelta},${MSITypeList.greenDelta},${MSITypeList.blueDelta} ${Client.mapfunctionSpriteGroup},${SpriteLoader.mapdotsGroupId},` +
            `${SpriteLoader.compassId} ${spritesDesc(SpriteLoader.mapfunctionsRecoloured)} ${spritesDesc(Client.imageMapdots)} ` +
            `${spriteDesc(Client.imageMapflag)} ${spriteDesc(Client.imageCompass)} ${spritesDesc(Client.hintMapMarkers)} ` +
            `${spritesDesc(SpriteLoader.hintMapEdge)} ${labels.count}`
        );
    };

    const replayWorld = (): string => {
        world.init(4, 104, 104, 25, false);
        const grounds = reader.int();
        for (let i = 0; i < grounds; i++) {
            const l = reader.int(),
                x = reader.int(),
                z = reader.int(),
                shape = reader.int(),
                rot = reader.int();
            const under = reader.int(),
                over = reader.int();
            world.SetGround(l, x, z, shape, rot, -1, 0, 0, 0, 0, under, under, under, under, over, over, over, over, under, over);
        }
        const count = reader.int();
        for (let i = 0; i < count; i++) {
            const kind = reader.int(),
                l = reader.int(),
                x = reader.int(),
                z = reader.int();
            const sizeX = reader.int(),
                sizeZ = reader.int(),
                aux = reader.int();
            const typecode = reader.long();
            if (kind === 0) world.SetWall(l, x, z, 0, new SceneModel(), aux >> 8 !== 0 ? new SceneModel() : null, aux & 255, aux >> 8, typecode);
            else if (kind === 1) world.AddScenery(l, x, z, 0, sizeX, sizeZ, new SceneModel(), aux, typecode);
            else if (kind === 2) world.SetGroundDecor(l, x, z, 0, new SceneModel(), typecode, aux !== 0);
            else throw new Error(`kind ${kind}`);
        }
        ClientBuild.m_mapl = Array.from({ length: 4 }, () => Array.from({ length: 104 }, () => reader.bytes(104)));
        for (let l = 0; l < 4; l++) {
            const m = new CollisionMap(104, 104);
            for (let x = 0; x < 104; x++) for (let z = 0; z < 104; z++) m.flags[x][z] = reader.int();
            CollisionMap.levelMaps[l] = m;
        }
        let h = 1;
        let squares = 0;
        const all = requireNonNull(world.squares);
        for (let l = 0; l < 4; l++)
            for (let x = 0; x < 104; x++)
                for (let z = 0; z < 104; z++) {
                    const s = all[l][x][z];
                    if (s === null) {
                        h = Math.imul(31, h);
                        continue;
                    }
                    squares++;
                    const add = (v: number) => (h = (Math.imul(31, h) + v) | 0);
                    add(s.quickGround === null ? -1 : s.quickGround.minimapRgb);
                    add(s.ground === null ? -1 : (Math.imul(s.ground.shape, 7) + s.ground.rotation) | 0);
                    add(s.ground === null ? -1 : s.ground.minimapOverlay);
                    add(s.ground === null ? -1 : s.ground.minimapUnderlay);
                    add(s.wall === null ? -1 : longHash(s.wall.typecode));
                    add(s.groundDecor === null ? -1 : longHash(s.groundDecor.typecode));
                    add(s.spriteCount);
                    for (let i = 0; i < s.spriteCount; i++) {
                        const sprite = requireNonNull(s.sprites[i]);
                        add(longHash(sprite.typecode));
                        add(sprite.minTileX);
                        add(sprite.minTileZ);
                    }
                }
        return ` ${grounds} ${count} ${squares} ${h}`;
    };

    const mask = (id: number): string => {
        const c = requireNonNull(IfType.Get(id));
        comps.set(id, c);
        c.width = c.baseWidth;
        c.height = c.baseHeight;
        const ok = c.GetMask();
        return ` ${ok} ${c.width}x${c.height} ${hash(c.maskStarts)} ${hash(c.maskWidths)}`;
    };

    const build = (level: number, playerLevel: number, seed: number, mode: number): string => {
        Client.playerLevel = playerLevel;
        if ((mode & 2) !== 0) {
            MinimapBuilder.minimapImage = null;
            MinimapBuilder.pendingImage = null;
        }
        MSITypeList.spritesArchive = (mode & 1) !== 0 ? empty : sprites;
        if ((mode & 1) !== 0) MSITypeList.spriteCache.Reset();
        const prevW = MinimapBuilder.minimapImage;
        const prevK = MinimapBuilder.pendingImage;
        details = detailsFalse = 0;
        mathRandom.setSeed(BigInt(seed));
        let st: string;
        try {
            st = String(MinimapBuilder.BuildBuffer(level));
        } catch (e) {
            st = status(e);
        }
        const next = doubleToInt(mathRandom.nextDouble() * 2147483647.0);
        return (
            ` ${st}|${Client.activeMapFunctionCount}|${hash(MinimapBuilder.mapFunctionLocIds)}|${hash(Client.activeMapFunctionX)}|` +
            `${hash(Client.activeMapFunctionZ)}|${imageDesc(MinimapBuilder.minimapImage, prevW, prevK)}|` +
            `${imageDesc(MinimapBuilder.pendingImage, prevW, prevK)}|${Pix2D.pixels === requireNonNull(screen).pixels},${Pix2D.width},` +
            `${Pix2D.height}|${next}|${details},${detailsFalse}`
        );
    };

    const run = (t: string[], n: number[]): string => {
        switch (t[0]) {
            case 'init':
                return init(n[1], n[2]);
            case 'world':
                return replayWorld();
            case 'mask':
                return mask(n[1]);
            case 'build':
                return build(n[1], n[2], n[3], n[4]);
            case 'frame':
                for (let i = 0; i < frame.length; i++) frame[i] = Math.imul(i, 0x9e3779b1) ^ n[1];
                Pix2D.setPixels(frame, RW, RH);
                InterfaceList.rectangleRedraw.fill(false);
                return '';
            case 'cam':
                OrbitCamera.followYaw = n[1];
                OrbitCamera.minimapAngle = n[2];
                OrbitCamera.minimapZoom = n[3];
                Client.minimapState = n[4];
                return '';
            case 'self': {
                if (n[1] < 0) {
                    Client.localPlayer = null;
                    return '';
                }
                const self = new ClientPlayer();
                self.x = n[1];
                self.z = n[2];
                self.team = n[3];
                Client.localPlayer = self;
                return '';
            }
            case 'base':
                Client.mapBuildBaseX = n[1];
                Client.mapBuildBaseZ = n[2];
                return '';
            case 'labels':
                WorldMapLabels.scene = n[1] === 0 ? null : labels;
                return '';
            case 'lflag':
                arrayPut(requireNonNull(labels).flags, n[1], n[2]);
                return '';
            case 'npcs':
                Client.npcs.fill(null);
                Client.npcCount = n[1];
                return '';
            case 'npc': {
                arrayPut(Client.npcIds, n[1], n[2]);
                if (n[3] === -2) {
                    arrayPut(Client.npcs, n[2], null);
                    return '';
                }
                const npc = new ClientNpc();
                npc.x = n[4];
                npc.z = n[5];
                if (n[3] >= 0) npc.npcType = NpcType.List(n[3]);
                arrayPut(Client.npcs, n[2], npc);
                return '';
            }
            case 'icon':
                NpcType.List(n[1]).mapIcon = n[2];
                return '';
            case 'players':
                Client.players.fill(null);
                ReceivePlayerPositions.m_lastNum = n[1];
                return '';
            case 'player': {
                arrayPut(ReceivePlayerPositions.m_lastID, n[1], n[2]);
                if (n[6] === -2) {
                    arrayPut(Client.players, n[2], null);
                    return '';
                }
                const p = new ClientPlayer();
                p.x = n[3];
                p.z = n[4];
                p.team = n[5];
                p.username = n[6] < 0 ? null : name(n[6]);
                p.appearance = n[7] !== 0 ? new PlayerModel() : null;
                arrayPut(Client.players, n[2], p);
                return '';
            }
            case 'friends':
                Client.friendCount = n[1];
                return '';
            case 'friend':
                arrayPut(Client.friendName37, n[1], name(n[2]).toBase37());
                arrayPut(Client.friendWorld, n[1], n[3]);
                return '';
            case 'clan':
                FriendChatChannel.members = new Array<FriendChatUser | null>(n[2]).fill(null);
                FriendChatChannel.memberCount = n[1];
                return '';
            case 'member': {
                const m = new FriendChatUser();
                m.key = name(n[2]).toBase37();
                arrayPut(FriendChatChannel.members, n[1], m);
                return '';
            }
            case 'arrow': {
                if (n[2] < 0) {
                    arrayPut(Client.hintArrows, n[1], null);
                    return '';
                }
                const a = new HintArrow();
                a.type = n[2];
                a.actor = n[3];
                a.icon = n[4];
                a.x = n[5];
                a.z = n[6];
                arrayPut(Client.hintArrows, n[1], a);
                return '';
            }
            case 'loop':
                Client.loopCycle = n[1];
                return '';
            case 'dest':
                Client.destinationX = n[1];
                Client.destinationZ = n[2];
                return '';
            case 'objs':
                Client.groundObj = grid<SharedPtrList<ClientObjNode>>();
                Client.playerLevel = n[1];
                return '';
            case 'obj':
                arrayPut(arrayAt(arrayAt(Client.groundObj, Client.playerLevel), n[1]), n[2], new SharedPtrList<ClientObjNode>());
                return '';
            case 'var':
                arrayPut(ClientVarCache.m_var, n[1], n[2]);
                return '';
            case 'draw': {
                calls = '';
                let st = 'ok';
                try {
                    MinimapBuilder.Draw(n[2], comps.get(n[1]) ?? null, n[4], n[3]);
                } catch (e) {
                    st = status(e);
                }
                return ` ${st}|${pix()}|${calls}`;
            }
            case 'compass': {
                let st = 'ok';
                try {
                    MinimapBuilder.CompassDraw(n[4], comps.get(n[1]) ?? null, n[5], n[2], n[3]);
                } catch (e) {
                    st = status(e);
                }
                return ` ${st}|${pix()}`;
            }
            default:
                throw new Error(`unknown op ${t[0]}`);
        }
    };

    const { DrawDot, DrawArrow, DrawDetail } = Client;
    const paragraph = PixfontGeneric.prototype.drawParagraphAlpha;
    Client.DrawDot = (component, x, sprite, draw, dx, y, dz) => {
        calls += `D${tag(sprite)},${x},${dx},${y},${dz},${draw ? 1 : 0}${known(component)};`;
        DrawDot.call(Client, component, x, sprite, draw, dx, y, dz);
    };
    Client.DrawArrow = (component, dx, dz, y, x, marker) => {
        calls += `A${dx},${dz},${y},${x},${marker}${known(component)};`;
        if (component !== null) {
            const radius = Math.min((component.width / 2) | 0, (component.height / 2) | 0);
            const distance = (Math.imul(dx, dx) + Math.imul(dz, dz)) | 0;
            if (distance <= 360000 && Math.imul(radius, radius) < distance) reached.edgeArrows++;
        }
        DrawArrow.call(Client, component, dx, dz, y, x, marker);
    };
    Client.DrawDetail = (...args) => {
        details++;
        const drawn = DrawDetail.apply(Client, args);
        if (!drawn) detailsFalse++;
        return drawn;
    };
    PixfontGeneric.prototype.drawParagraphAlpha = function (...args) {
        reached.labels++;
        return paragraph.apply(this, args);
    };
    try {
        return script.map(line => {
            const t = line.split(' ');
            const n = t.map((v, i) => (i === 0 ? 0 : Number(v) | 0));
            let result: string;
            try {
                result = 'ok' + run(t, n);
            } catch (e) {
                if (e instanceof Error && e.message.startsWith('unknown op')) throw e;
                result = status(e);
            }
            return result;
        });
    } finally {
        Object.assign(Client, { DrawDot, DrawArrow, DrawDetail });
        PixfontGeneric.prototype.drawParagraphAlpha = paragraph;
    }
}

interface ScriptInputs {
    labelX: number[];
    labelZ: number[];
    // Each label's text width in p11, p12 and b12 (getParagraphWidth(text, 100)), for the boundary draws.
    labelWidths: number[][];
    varps: number[];
    locVarps: number[];
    multiNpcs: number[];
    plainNpcs: number[];
    // Types without a map dot, and types with one that are not interactive.
    noDotNpcs: number[];
    passiveNpcs: number[];
    mapFunctionTiles: number[][];
    functionCount: number;
}

// The real-data script. Builds of every level (fresh, recycling the previous image, for another player level, with
// the map-scene sprites unavailable and then resumed), each followed by minimap and compass draws of the real
// components at several screen positions, with the camera, player, NPCs (real types: plain, without a dot, not
// interactive, multinpcs over random varbits/varps, a forced map icon), players (friends, clan, team), hint arrows of
// every type near and past the edge, the map flag, ground objects and the real map labels (moved next to the player
// through the build base, with the minimap flag set).
function realScript(inputs: ScriptInputs): string[] {
    let seed = 0x5301338;
    const rnd = (): number => {
        seed ^= seed << 13;
        seed ^= seed >>> 17;
        seed ^= seed << 5;
        return seed;
    };
    const r = (n: number): number => (rnd() >>> 1) % n;
    const s: string[] = ['init 1234567 7654321', 'world'];
    for (const id of [...MINIMAPS, ...COMPASSES]) s.push(`mask ${id}`);

    const scenario = (level: number): void => {
        s.push(`frame ${rnd()}`);
        const state = r(12) === 0 ? [1, 2, 3, 4, 5][r(5)] : 0;
        s.push(`cam ${r(2048)} ${r(121) - 60} ${r(31) - 20} ${state}`);
        // Mostly around the map functions, so their dots are in range.
        const anchor = r(3) === 0 ? [level, 52, 52] : inputs.mapFunctionTiles[r(inputs.mapFunctionTiles.length)];
        const tileX = Math.max(1, Math.min(102, anchor[1] + r(25) - 12));
        const tileZ = Math.max(1, Math.min(102, anchor[2] + r(25) - 12));
        const px = tileX * 128 + r(128);
        const pz = tileZ * 128 + r(128);
        s.push(r(60) === 0 ? 'self -1' : `self ${px} ${pz} ${r(3)}`);
        let bx = BASE;
        let bz = BASE;
        if (r(2) === 0) {
            // A real label a few tiles from the player, flagged for the minimap with a random size.
            const k = r(inputs.labelX.length);
            bx = inputs.labelX[k] - tileX + r(15) - 7;
            bz = inputs.labelZ[k] - tileZ + r(15) - 7;
            s.push(`lflag ${k} ${r(4) === 0 ? r(32) : 4 | r(4) | (r(2) << 4)}`);
        }
        for (let k = r(3); k > 0; k--) s.push(`lflag ${r(inputs.labelX.length)} ${r(32)}`);
        s.push(`base ${bx} ${bz}`);
        s.push(`labels ${r(6) === 0 ? 0 : 1}`);

        const npcIndices: number[] = [];
        const npcs = r(10);
        s.push(`npcs ${npcs}`);
        for (let i = 0; i < npcs; i++) {
            // Slot 0 and the last slot sometimes, so the arrows can point at the ends of the NPC array.
            const index = i === 0 && r(3) === 0 ? 0 : i === 1 && r(6) === 0 ? 32767 : r(300);
            npcIndices.push(index);
            const kind = r(13);
            let type;
            if (kind === 0) {
                type = -1;
            } else if (kind === 1) {
                type = -2;
            } else if (kind < 4) {
                type = inputs.multiNpcs[r(inputs.multiNpcs.length)];
            } else if (kind === 4) {
                type = inputs.noDotNpcs[r(inputs.noDotNpcs.length)];
            } else if (kind === 5) {
                type = inputs.passiveNpcs[r(inputs.passiveNpcs.length)];
            } else {
                type = inputs.plainNpcs[r(inputs.plainNpcs.length)];
            }
            const far = r(6) === 0 ? 4096 : 1024;
            s.push(`npc ${i} ${index} ${type} ${px + r(2 * far) - far} ${pz + r(2 * far) - far}`);
        }
        if (r(8) === 0) s.push(`icon ${inputs.plainNpcs[r(inputs.plainNpcs.length)]} ${r(10) === 0 ? -1 : r(12) === 0 ? inputs.functionCount : r(inputs.functionCount)}`);
        for (let k = r(4); k > 0; k--) s.push(`var ${inputs.varps[r(inputs.varps.length)]} ${r(10) === 0 ? r(64) - 8 : r(4)}`);
        if (r(2) === 0) s.push(`var ${inputs.locVarps[r(inputs.locVarps.length)]} ${r(12) === 0 ? rnd() : r(16)}`);

        const playerIndices: number[] = [];
        const players = r(10);
        s.push(`players ${players}`);
        for (let i = 0; i < players; i++) {
            const index = i === 0 && r(3) === 0 ? 0 : i === 1 && r(6) === 0 ? 2047 : r(2048);
            playerIndices.push(index);
            const nameIdx = r(40) === 0 ? -2 : r(50) === 0 ? -1 : r(REAL_NAMES.length);
            s.push(`player ${i} ${index} ${px + r(2048) - 1024} ${pz + r(2048) - 1024} ${r(3)} ${nameIdx} ${r(12) === 0 ? 0 : 1}`);
        }
        const friends = r(4);
        s.push(`friends ${friends}`);
        for (let i = 0; i < friends; i++) s.push(`friend ${i} ${r(REAL_NAMES.length)} ${r(3)}`);
        const members = r(4);
        s.push(`clan ${members} ${r(15) === 0 ? Math.max(0, members - 1) : members + r(2)}`);
        for (let i = 0; i < members && i < 3; i++) s.push(`member ${i} ${r(REAL_NAMES.length)}`);

        for (let i = 0; i < 4; i++) {
            const type = [-1, 0, 1, 1, 2, 2, 10, 10, 5][r(9)];
            // An NPC or player in the scene, or the array bounds (-1, 0, the last slot, the length), or anything.
            const pick = (indices: number[], length: number): number => {
                const k = r(8);
                if (indices.length > 0 && k < 5) return indices[r(indices.length)];
                return k === 5 ? [-1, 0, length - 1, length][r(4)] : r(length + 200) - 100;
            };
            const actor = type === 1 ? pick(npcIndices, 32768) : type === 10 ? pick(playerIndices, 2048) : r(10);
            const spread = r(3) === 0 ? 160 : 24;
            s.push(`arrow ${i} ${type} ${actor} ${r(2)} ${bx + tileX + r(2 * spread) - spread} ${bz + tileZ + r(2 * spread) - spread}`);
        }
        s.push(`loop ${r(40)}`);
        s.push(`dest ${r(4) === 0 ? 0 : Math.max(0, Math.min(103, tileX + r(41) - 20))} ${Math.max(0, Math.min(103, tileZ + r(41) - 20))}`);
        s.push(`objs ${level}`);
        for (let k = r(6); k > 0; k--) s.push(`obj ${Math.max(0, Math.min(103, tileX + r(31) - 15))} ${Math.max(0, Math.min(103, tileZ + r(31) - 15))}`);

        // The fixed layout's position, the resizable one's, and anywhere on (or a little off) the frame.
        const comp = r(4) === 0 ? 1 : 0;
        const at = r(4);
        const x = at === 0 ? 563 : at === 1 ? RW - 160 : r(RW - 152 + 20) - 10;
        const y = at === 0 ? 9 : at === 1 ? 5 : r(RH - 152 + 20) - 10;
        s.push(`draw ${MINIMAPS[comp]} ${x} ${y} ${r(100)}`);
        s.push(`compass ${COMPASSES[comp]} ${x - 30 + r(10)} ${y + r(10)} ${r(100)} ${r(8) === 0 ? r(7) : 3}`);
    };

    // Fresh builds of each level (the player on that level), then draws over them.
    for (const level of [1, 2, 3, 0]) {
        s.push(`build ${level} ${level} ${rnd()} 2`);
        for (let k = 0; k < 8; k++) scenario(level);
    }
    // Rebuilds that recycle the finished image, and builds for another player level's map functions.
    for (const [level, playerLevel] of [
        [0, 0],
        [0, 1],
        [1, 0],
        [2, 1],
        [3, 3],
        [0, 0]
    ]) {
        s.push(`build ${level} ${playerLevel} ${rnd()} 0`);
        for (let k = 0; k < 4; k++) scenario(playerLevel);
    }
    // The map-scene sprites are not loaded: the build fails (fresh, and while recycling the last image), keeps its
    // half-drawn image, and the next builds resume at the detail pass once the sprites are back.
    s.push(`build 0 0 ${rnd()} 3`, `build 0 0 ${rnd()} 1`, `build 0 0 ${rnd()} 0`);
    for (let k = 0; k < 4; k++) scenario(0);
    s.push(`build 2 2 ${rnd()} 1`);
    for (let k = 0; k < 3; k++) scenario(2);
    s.push(`build 2 2 ${rnd()} 0`);
    // Many draws over the finished ground level.
    s.push(`build 0 0 ${rnd()} 0`);
    for (let k = 0; k < 220; k++) scenario(0);
    // Labels on and one pixel either side of each of Draw's four label bounds (|screenX| and |screenY| against the
    // component's width and height), at camera angle 0 and zoom 0 so screenX = labelX - width / 2 and screenY = labelZ:
    // the three widest labels in each font size, placed through the player position with the build base 60 tiles away.
    const widest = (size: number) =>
        inputs.labelWidths
            .map((w, i) => [w[size], i])
            .sort((a, b) => b[0] - a[0])
            .slice(0, 3);
    for (const size of [0, 1, 2]) {
        for (const [width, k] of widest(size)) {
            for (const [tx, tz] of [
                [-152, 0],
                [152, 0],
                [0, -152],
                [0, 152]
            ]) {
                for (const e of [-1, 0, 1]) {
                    const sx = 242 - ((width / 2) | 0) - (tx === 0 ? 0 : tx + e);
                    const sz = 242 - (tz === 0 ? 0 : tz + e);
                    s.push(`frame ${rnd()}`, 'cam 0 0 0 0', `self ${sx * 32 + r(32)} ${sz * 32 + r(32)} 0`);
                    s.push(`lflag ${k} ${4 | size}`, `base ${inputs.labelX[k] - 60} ${inputs.labelZ[k] - 60}`, 'labels 1', 'npcs 0', 'players 0');
                    for (let i = 0; i < 4; i++) s.push(`arrow ${i} -1 0 0 0 0`);
                    s.push('dest 0 0', 'objs 0', `draw ${MINIMAPS[0]} 563 9 0`);
                }
            }
        }
    }
    return s;
}

function scriptInputs(info: LumbridgeInfo): ScriptInputs {
    const labels = WorldMapLabels.load(fromLiteral('main_labels'), js5(23));
    NpcType.Init(js5(18), js5(7));
    VarBitType.Init(js5(22));
    const multiNpcs: number[] = [];
    const plainNpcs: number[] = [];
    const noDotNpcs: number[] = [];
    const passiveNpcs: number[] = [];
    const varps = new Set<number>();
    for (let id = 0; id < 9000 && (multiNpcs.length < 24 || plainNpcs.length < 24 || noDotNpcs.length < 12 || passiveNpcs.length < 8); id++) {
        const t = NpcType.List(id);
        if (t.multi !== null) {
            if (multiNpcs.length >= 24) continue;
            multiNpcs.push(id);
            if (t.multiVarbit !== -1) varps.add(VarBitType.List(t.multiVarbit).baseVar);
            else if (t.multiVarp !== -1) varps.add(t.multiVarp);
        } else if (!t.drawMapDot) {
            if (noDotNpcs.length < 12) noDotNpcs.push(id);
        } else if (!t.interactive) {
            if (passiveNpcs.length < 8) passiveNpcs.push(id);
        } else if (plainNpcs.length < 24) {
            plainNpcs.push(id);
        }
    }
    const sprites = js5(8);
    Client.lookupSpriteGroupIds(sprites);
    Client.loadFonts(sprites, js5(13));
    const fonts = [Client.fontPlain11, Client.p12, Client.fontBold12].map(font => requireNonNull(font));
    const labelWidths = Array.from(labels.text.slice(0, labels.count), text => fonts.map(font => font.getParagraphWidth(text, 100)));
    const functionCount = requireNonNull(SpriteLoader.loadSoftwareSprites(Client.mapfunctionSpriteGroup, sprites, 0)).length;
    if ([multiNpcs, plainNpcs, noDotNpcs, passiveNpcs].some(list => list.length === 0)) throw new Error('missing NPC type kind');
    const locVarps = [...new Set([...info.multiVarps, ...info.multiVarbits.map(varbit => VarBitType.List(varbit).baseVar)])];
    return {
        labelX: Array.from(labels.x.subarray(0, labels.count)),
        labelZ: Array.from(labels.z.subarray(0, labels.count)),
        labelWidths,
        varps: [...varps],
        locVarps,
        multiNpcs,
        plainNpcs,
        noDotNpcs,
        passiveNpcs,
        mapFunctionTiles: info.mapFunctionTiles,
        functionCount
    };
}

function runRealOracle(fixture: Buffer, script: string[]): string[] {
    const out = resolve(import.meta.dir, '../../out');
    mkdirSync(out, { recursive: true });
    const scratch = mkdtempSync(join(out, 'minimap-real-oracle-'));
    const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
    try {
        const source = fileURLToPath(new URL('./minimap-builder/MinimapRealOracle.java', import.meta.url));
        const build = Bun.spawnSync(['javac', '-nowarn', asm, '-cp', gamepackPath, '-d', scratch, source]);
        if (build.exitCode !== 0) throw new Error(build.stderr.toString());
        const cp = scratch + delimiter + gamepackPath;
        const instrument = Bun.spawnSync(['java', asm, '-cp', cp, 'MinimapRealOracle', 'instrument', gamepackPath, scratch]);
        if (instrument.exitCode !== 0) throw new Error(`instrumentation failed: ${instrument.stderr.toString()}`);
        const fixturePath = join(scratch, 'lumbridge.bin');
        writeFileSync(fixturePath, fixture);
        const run = Bun.spawnSync(['java', asm, '--add-opens=java.base/java.lang=ALL-UNNAMED', '-Djava.awt.headless=true', '-cp', cp, 'MinimapRealOracle', fixturePath, cachePath], { stdin: Buffer.from(script.join('\n') + '\n'), timeout: 280000 });
        if (run.exitCode !== 0) throw new Error(`MinimapRealOracle exited ${run.exitCode}: ${run.stderr.toString()}`);
        const lines = run.stdout.toString().split(/\r?\n/);
        if (lines[lines.length - 1] === '') lines.pop();
        return lines;
    } finally {
        rmSync(scratch, { recursive: true, force: true });
    }
}

test('minimap build, draw and compass match the 530 gamepack on Lumbridge with the real cache', () => {
    const { info, script } = withClinitStatics(resets(), () => {
        const info = lumbridge();
        return { info, script: realScript(scriptInputs(info)) };
    });
    // The map has ground, walls, scenery, ground decor and map functions on several levels.
    expect(info.grounds).toBeGreaterThan(10000);
    expect(info.locs).toBeGreaterThan(4000);
    expect(info.mapFunctionTiles.length).toBeGreaterThan(30);
    expect(info.multiVarbits.length).toBe(2);
    const want = runRealOracle(info.data, script);
    const reached: RealReached = { labels: 0, edgeArrows: 0 };
    const got = withClinitStatics(resets(), () => runReal(info.data, script, reached));
    if (process.env.MINIMAP_REAL_DUMP) {
        writeFileSync(`${process.env.MINIMAP_REAL_DUMP}.script`, script.join('\n') + '\n');
        writeFileSync(`${process.env.MINIMAP_REAL_DUMP}.java`, want.join('\n') + '\n');
        writeFileSync(`${process.env.MINIMAP_REAL_DUMP}.ts`, got.join('\n') + '\n');
    }
    expect(want.length).toBe(script.length);
    expect(got.length).toBe(want.length);
    const mismatches: string[] = [];
    for (let i = 0; i < want.length && mismatches.length < 5; i++) {
        if (got[i] !== want[i]) {
            let at = 0;
            while (at < want[i].length && want[i][at] === got[i][at]) at++;
            const from = Math.max(0, at - 120);
            mismatches.push(`#${i} ${script[i]}\n  java: ...${want[i].slice(from, at + 200)}\n  ts:   ...${got[i].slice(from, at + 200)}`);
        }
    }
    expect(mismatches).toEqual([]);

    // The inputs both sides built: the loaders' sprites and labels, the replayed world and the component masks.
    expect(want[0]).toMatch(/^ok -?\d+,-?\d+,-?\d+ \d+,\d+,\d+ \d+\[/);
    expect(want[1]).toMatch(new RegExp(`^ok ${info.grounds} ${info.locs} \\d+ -?\\d+$`));
    for (let i = 2; i < 6; i++) expect(want[i]).toMatch(/^ok true (152x152|33x33) /);
    const results = (op: string) => want.filter((_, i) => script[i].startsWith(op + ' ')).map(line => line.split('|')[0]);
    const builds = results('build');
    expect(builds.filter(r => r === 'ok true').length).toBeGreaterThan(10);
    expect(builds.filter(r => r === 'ok false').length).toBeGreaterThanOrEqual(2);
    // The ground level's builds gathered the real map functions (Lumbridge has none on level 3), and the builds without
    // the map-scene sprites failed in DrawDetail.
    const buildLines = want.filter((_, i) => script[i].startsWith('build '));
    expect(buildLines.filter(line => / true\|35\|/.test(line)).length).toBeGreaterThan(4);
    expect(buildLines.filter(line => / false\|/.test(line) && /\|\d+,1$/.test(line)).length).toBeGreaterThanOrEqual(3);
    const draws = want.filter((_, i) => script[i].startsWith('draw '));
    expect(results('draw').filter(r => r === 'ok ok').length).toBeGreaterThan(200);
    expect(new Set(draws.map(line => line.split('|')[1])).size).toBeGreaterThan(200);
    // Every kind of dot: map functions, ground objects, NPCs, players (plain, friend, team, clan), markers and the flag.
    const dots = draws.join('');
    for (const kind of ['Df', 'Dd0', 'Dd1', 'Dd2', 'Dd3', 'Dd4', 'Dd5', 'Dm0', 'Dm1', 'DF', 'A']) expect(dots.includes(kind), kind).toBe(true);
    expect(reached.edgeArrows).toBeGreaterThan(10);
    expect(reached.labels).toBeGreaterThan(10);
    const compass = results('compass');
    expect(compass.filter(r => r === 'ok ok').length).toBeGreaterThan(200);
    // CompassDraw's two arms: the rotated compass (limit above the minimap state) and the blank fill.
    let state = 0;
    const arms = [0, 0];
    for (const line of script) {
        const t = line.split(' ');
        if (t[0] === 'cam') state = Number(t[4]);
        if (t[0] === 'compass') arms[Number(t[5]) > state ? 0 : 1]++;
    }
    expect(arms[0]).toBeGreaterThan(200);
    expect(arms[1]).toBeGreaterThan(10);
}, 600000);
