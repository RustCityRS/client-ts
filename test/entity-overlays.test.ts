import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { inflateSync } from 'node:zlib';
import Client from '#/client/Client.js';
import WrappedException from '#/util/WrappedException.js';
import HintArrow from '#/client/HintArrow.js';
import OrbitCamera from '#/client/OrbitCamera.js';
import ReceivePlayerPositions from '#/client/ReceivePlayerPositions.js';
import NpcType from '#/config/NpcType.js';
import ClientNpc from '#/dash3d/ClientNpc.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import PlayerModel from '#/dash3d/PlayerModel.js';
import RoofModeStatics from '#/dash3d/RoofModeStatics.js';
import world from '#/dash3d/world.js';
import JagString, { fromJsString } from '#/datastruct/JagString.js';
import Pix2D from '#/graphics/Pix2D.js';
import Pix32 from '#/graphics/Pix32.js';
import PixfontGeneric from '#/graphics/PixfontGeneric.js';
import SoftwareFont from '#/graphics/SoftwareFont.js';
import SoftwareAlphaSprite from '#/graphics/SoftwareAlphaSprite.js';
import SpriteLoader from '#/graphics/SpriteLoader.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { loginFixture } from './login-fixture.js';
import { cachePath, gamepackPath } from './reference.js';
import { localAssets, readGroup } from './cachefile.js';

const WIDTH = 136,
    HEIGHT = 100;
type Case = [variant: number, colour: number, effect: number, timer: number, stamp: number, arg: number, faultAt: number];

function cases(): Case[] {
    const rows: Case[] = [];
    for (let colour = 0; colour <= 12; colour++)
        for (let effect = 0; effect <= 6; effect++) {
            for (const timer of [151, 126, 100, 51, 50, 25, 0, -1]) rows.push([0, colour, effect, timer, timer % 19, 0, 0]);
        }
    for (let variant = 1; variant <= 29; variant++) for (const arg of [0, 1, 2, 3]) rows.push([variant, 9, 5, 126, 9 + arg, arg, 0]);
    for (const effect of [0, 1, 2, 3, 4, 5]) for (let faultAt = 1; faultAt <= 77; faultAt++) rows.push([1, 10, effect, 13, 12, 0, faultAt]);
    for (const [colour, effect, age, stamp] of [
        [-1, 0, 150, 9],
        [11, 5, 25, -2147483648],
        [10, 4, -2147483648, 2147483647],
        [9, 3, 2147483647, 0],
        [6, 3, 149, 10],
        [7, 1, 150, 9],
        [8, 2, 149, 10]
    ])
        rows.push([0, colour, effect, age, stamp, 0, 0]);
    return rows;
}

function makeFont(style: number): SoftwareFont {
    const metrics = new Uint8Array(257).fill(4 + style);
    metrics[256] = 6 + style;
    const x = Int32Array.from({ length: 256 }, (_, i) => (i + style) % 2),
        y = new Int32Array(256).fill(1);
    const w = new Int32Array(256).fill(3 + style),
        h = new Int32Array(256).fill(4 + style);
    const masks = Array.from({ length: 256 }, (_, i) => Uint8Array.from({ length: w[i] * h[i] }, (_, k) => +((i + 3 * k + style) % 5 < 3)));
    return new SoftwareFont(metrics, x, y, w, h, masks);
}
const hex = (msg: JagString | null) => (msg === null ? '~' : Buffer.from(msg.toBytes()).toString('hex'));
const ints = (arr: Int32Array | null) => (arr === null ? 'null' : '[' + arr.join(', ') + ']');

loginFixture(
    import.meta.url,
    'GdmEntityOverlays matches every framebuffer byte, ordered draw call and retained chat slot in the original JAR',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), '530-entity-overlays-'));
        try {
            const asm = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED'];
            const cc = Bun.spawnSync(['javac', ...asm, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game/EntityOverlaysOracle.java'), join(import.meta.dir, 'ui/menu-feedback-oracle.java'), join(import.meta.dir, 'game/ChatOracle.java')]);
            expect(cc.exitCode, cc.stderr.toString()).toBe(0);
            const java = ['java', ...asm, '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'EntityOverlaysOracle'];
            const prepare = Bun.spawnSync([...java, gamepackPath, dir]);
            expect(prepare.exitCode, prepare.stderr.toString()).toBe(0);
            const rows = cases();
            const assets = localAssets(cachePath, [8]),
                archive = assets.archive(8),
                archiveGroup = assets.groupId(8, 'hitbar_default');
            expect(archiveGroup).toBeGreaterThanOrEqual(0);
            const group = (a: number, g: number) => Buffer.from(readGroup(cachePath, a, g)).toString('base64');
            const input = [String(archiveGroup), group(255, 8) + ' ' + archiveGroup + ':' + group(8, archiveGroup), ...rows.map(r => r.join(' ')), ''];
            const jvm = Bun.spawnSync(java, { stdin: Buffer.from(input.join('\n')), maxBuffer: 16 * 1024 * 1024 });
            expect(jvm.exitCode, jvm.stderr.toString()).toBe(0);
            const expected = jvm.stdout.toString().trimEnd().split(/\r?\n/);
            expect(expected.length).toBe(rows.length);

            const names = new Map<object, string>();
            let active = false,
                trace = '',
                call = 0,
                faultAt = 0;
            function watch(owner: object, method: string, name: string, format: (self: object, args: unknown[]) => unknown[]): void {
                const original = requireNonNull(Object.getOwnPropertyDescriptor(owner, method)).value;
                Reflect.set(owner, method, function (this: object, ...args: unknown[]) {
                    if (!active) return Reflect.apply(original, this, args);
                    trace += [name, ...format(this, args)].join(',') + ';';
                    if (++call === faultAt) throw Error('trace');
                    active = false;
                    try {
                        return Reflect.apply(original, this, args);
                    } finally {
                        active = true;
                    }
                });
            }
            watch(Client, 'GetOverlayPos', 'p', (_, args) => [...args.slice(0, 3), names.get(args[3] as object)]);
            watch(Pix32.prototype, 'draw', 's', (s, args) => [names.get(s), ...args]);
            watch(SoftwareAlphaSprite.prototype, 'draw', 's', (s, args) => [names.get(s), ...args]);
            const load = SpriteLoader.loadSprites;
            SpriteLoader.loadSprites = (group, source, file) => {
                if (active) {
                    trace += ['g', group, file].join(',') + ';';
                    if (++call === faultAt) throw Error('trace');
                }
                const sprites = load(group, source, file);
                sprites?.forEach((s, i) => {
                    if (s !== null) names.set(s, 'g' + group + '.' + i);
                });
                return sprites;
            };
            watch(Pix2D, 'intersectClipping', 'c', (_, args) => args);
            watch(Pix2D, 'setClipping', 'r', (_, args) => args);
            for (const [method, id] of [
                ['stringWidth', 'w'],
                ['drawCentred', 'f'],
                ['drawLeft', 'l'],
                ['drawCentredWave', 'v'],
                ['drawCentredWave2', 'u'],
                ['drawCentredShake', 'k']
            ]) {
                watch(PixfontGeneric.prototype, method, id, (font, args) => [names.get(font), hex(args[0] as JagString | null), ...args.slice(1)]);
            }
            const sprite = (id: number, w: number, h: number) => {
                const pixels = Int32Array.from({ length: w * h }, (_, i) => ((i + id) % 7 === 0 ? 0 : (id * 0x3d0b13 + i * 133) & 0xffffff));
                const s = new Pix32(w, h, 0, 0, w, h, pixels);
                names.set(s, 'i' + id);
                return s;
            };
            const pair = (n: number) => [sprite(n, 15, 4), sprite(n + 1, 15, 4)];
            const slots = () => new Int32Array(4).fill(-91);
            const arrow = (type: number, actor: number, icon: number) => Object.assign(new HintArrow(), { type, actor, icon });
            for (const [row, vector] of rows.entries()) {
                const [variant, colour, effect, timer, stamp, arg, failure] = vector;
                faultAt = failure;
                call = 0;
                trace = '';
                names.clear();
                let top = 7,
                    left = 5,
                    w = 124,
                    h = 86;
                const pixels = new Int32Array(WIDTH * HEIGHT).fill(0x63201406);
                Pix2D.setPixels(pixels, WIDTH, HEIGHT);
                Pix2D.setClipping(left, top, left + w, top + h);
                Client.fontBold12 = makeFont(0);
                Client.fontPlain11 = makeFont(1);
                names.set(Client.fontBold12, 'b');
                names.set(Client.fontPlain11, 'p');
                Client.chatCount = 81;
                Client.chatEffects = 0;
                Client.maxChats = 4;
                Client.chatWidth = slots();
                Client.chatHeight = slots();
                Client.chatX = slots();
                Client.chatY = slots();
                Client.chatColour = slots();
                Client.chatEffect = slots();
                Client.chatTimer = slots();
                Client.chatMessage = [fromJsString('old'), null, null, fromJsString('old')];
                names.set(requireNonNull(Client.chatMessage[0]), 'old0');
                names.set(requireNonNull(Client.chatMessage[3]), 'old3');
                Client.chatColours = Int32Array.of(0xffe000, 0xcc1435, 0x61661e, 0x123abb, 0xff00ee, 0x00ffee);
                Client.projectX = -83;
                Client.projectY = -117;
                Client.playerLevel = 1;
                world.levelHeightmaps = null;
                Object.assign(OrbitCamera, { x: 4096, y: -105, z: 4096, pitch: 0, yaw: 0 });
                Client.loopCycle = 41;
                RoofModeStatics.markStamp = stamp;
                Client.chatPublicMode = 0;
                const self = (Client.localPlayer = new ClientPlayer()),
                    other = new ClientPlayer(),
                    npc = new ClientNpc();
                Client.players[2] = other;
                Client.npcs[3] = npc;
                ReceivePlayerPositions.m_lastNum = Client.npcCount = 1;
                Reflect.set(ReceivePlayerPositions, 'm_lastID', Int32Array.of(2));
                Reflect.set(Client, 'npcIds', Int32Array.of(3));
                self.appearance = new PlayerModel();
                other.appearance = new PlayerModel();
                const type = (npc.npcType = new NpcType());
                self.username = fromJsString('Tester');
                other.username = fromJsString('Peer');
                Client.friendCount = 0;
                Client.friendUsername = [other.username];
                for (const [i, actor] of [self, other, npc].entries()) {
                    names.set(actor, 'a' + i);
                    actor.x = 4096 + 5 * i;
                    actor.z = 4820 + i;
                    actor.modelMinY = -100 - 2 * i;
                    actor.overheadText = fromJsString(['Rune', 'Café', '<col=663322>q</col>'][i]);
                    actor.chatColour = colour;
                    actor.chatEffect = effect;
                    actor.chatTimer = timer;
                    names.set(actor.overheadText, 'text' + i);
                }
                Client.headiconsPk = [sprite(1, 7, 8)];
                Client.imageHeadiconsPrayer = [sprite(2, 8, 5)];
                Client.hintHeadicons = [sprite(3, 9, 7)];
                Client.imageHitmarks = [sprite(4, 11, 9), sprite(5, 12, 8)];
                SpriteLoader.hitbarDefault = pair(6);
                Client.npcHitbarSprites.Reset();
                type.hitmarkId = 27;
                Client.npcHitbarSprites.Put(27n, pair(8));
                Client.m_pSprites = null;
                Reflect.set(Client, 'hintArrows', [null, arrow(10, 2, 0), arrow(1, 3, 0), arrow(1, 4, 0)]);
                if (variant !== 0) {
                    for (const actor of [self, other, npc]) {
                        actor.healthUntil = 50;
                        actor.health = 127;
                        actor.hitUntil = Int32Array.of(44, 42, 48, 50);
                        actor.hitType = Int32Array.of(0, 1, 0, 1);
                        actor.hitDamage = Int32Array.of(0, -4, 123, 2000000000);
                    }
                    self.skullIcon = self.headIcon = other.headIcon = type.headIcon = 0;
                    type.m_overlayHeight = 90;
                }
                switch (variant) {
                    case 2:
                        Client.loopCycle = 52;
                        Client.chatEffects = arg;
                        break;
                    case 3:
                        Client.chatPublicMode = arg;
                        Client.friendCount = stamp & 1;
                        break;
                    case 4:
                        Client.maxChats = arg;
                        break;
                    case 5:
                        self.appearance = null;
                        npc.npcType = null;
                        other.x = 13057;
                        break;
                    case 6:
                        type.multi = Int32Array.of(-1);
                        other.z = 4097;
                        break;
                    case 7:
                        left = -11;
                        top = -8;
                        w = 89;
                        h = 73;
                        Pix2D.setClipping(2, 1, 55, 61);
                        break;
                    case 8:
                        Client.npcHitbarSprites.Put(27n, [null]);
                        type.hitmarkId = 28;
                        Client.npcHitbarSprites.Put(28n, [null]);
                        break;
                    case 9:
                        type.hitmarkId = 999;
                        break;
                    case 10:
                        Client.chatColour = new Int32Array(1);
                        break;
                    case 11:
                        Reflect.set(Client, 'chatMessage', null);
                        break;
                    case 12:
                        self.skullIcon = 7;
                        break;
                    case 13:
                        Client.imageHitmarks[1] = null;
                        break;
                    case 14:
                        SpriteLoader.hitbarDefault = [SpriteLoader.hitbarDefault[0], null];
                        break;
                    case 15:
                        Client.fontBold12 = null;
                        break;
                    case 16:
                        Client.fontPlain11 = null;
                        break;
                    case 17:
                        self.hitUntil = Int32Array.of(0);
                        break;
                    case 18:
                        Reflect.set(ReceivePlayerPositions, 'm_lastID', Int32Array.of(8));
                        Reflect.set(Client, 'players', new Array(5).fill(null));
                        break;
                    case 19:
                        Reflect.set(Client, 'hintArrows', [arrow(10, 2, 5)]);
                        break;
                    case 20:
                        self.chatTimer = -2147483648;
                        self.health = 2147483647;
                        type.m_overlayHeight = 2147483647;
                        break;
                    case 21:
                        self.overheadText = other.overheadText = npc.overheadText = null;
                        break;
                    case 22:
                        Client.loopCycle = 49;
                        type.m_overlayHeight = -1;
                        break;
                    case 23:
                        Client.chatEffects = 1;
                        break;
                    case 24:
                        Client.m_pSprites = archive;
                        type.hitmarkId = archiveGroup;
                        break;
                    case 25: {
                        type.multi = Int32Array.of(77);
                        const sub = new NpcType();
                        sub.headIcon = 0;
                        sub.m_overlayHeight = 27;
                        NpcType.m_recentUse.Put(77n, sub);
                        type.m_overlayHeight = 133;
                        type.headIcon = -1;
                        break;
                    }
                    case 26:
                        Client.m_pSprites = archive;
                        type.hitmarkId = -1;
                        break;
                    case 27:
                        Reflect.apply(Client.npcHitbarSprites.Put, Client.npcHitbarSprites, [123n, {}]);
                        type.hitmarkId = 123;
                        break;
                    case 28:
                        Client.m_pSprites = archive;
                        type.hitmarkId = archiveGroup;
                        Reflect.set(Client, 'npcIds', Int32Array.of(3, 3));
                        Client.npcCount = 2;
                        break;
                    case 29:
                        Client.m_pSprites = archive;
                        type.hitmarkId = 65535;
                        break;
                }
                let outcome = 'ok';
                active = true;
                try {
                    Client.GdmEntityOverlays(top, left, w, h);
                } catch (caught) {
                    let e = caught;
                    while (e instanceof WrappedException) e = e.cause;
                    outcome = e instanceof RangeError ? 'bounds' : e instanceof TypeError ? (e.message.includes('ClassCastException') ? 'cast' : 'null') : e instanceof Error && e.message === 'trace' ? 'trace' : String(e);
                } finally {
                    active = false;
                }
                const states = expected[row].split('|');
                const packed = requireNonNull(states.pop());
                const actual = [
                    outcome,
                    trace,
                    Client.chatCount,
                    ...[Client.chatWidth, Client.chatHeight, Client.chatX, Client.chatY, Client.chatColour, Client.chatEffect, Client.chatTimer].map(ints),
                    Client.chatMessage === null ? 'null' : Client.chatMessage.map(m => (m === null ? '~' : hex(m) + ':' + (names.get(m) ?? '?'))).join(','),
                    [Client.projectX, Client.projectY],
                    [Pix2D.clipMinX, Pix2D.clipMinY, Pix2D.clipMaxX, Pix2D.clipMaxY],
                    variant === 24 || variant === 28
                        ? '[' +
                          requireNonNull(Client.npcHitbarSprites.Find(BigInt(archiveGroup)))
                              .map(s => (s === null ? 'null' : names.get(s)))
                              .join(', ') +
                          ']'
                        : '-'
                ];
                expect(actual.join('|'), vector.join(' ')).toBe(states.join('|'));
                const reference = inflateSync(Buffer.from(packed, 'base64')),
                    frame = Buffer.from(pixels.buffer);
                if (!frame.equals(reference)) {
                    const at = frame.findIndex((v, i) => v !== reference[i]) >> 2;
                    throw Error('Framebuffer ' + vector.join(' ') + ' at ' + (at % WIDTH) + ',' + ((at / WIDTH) | 0) + ': ' + pixels[at] + ' vs ' + reference.readInt32LE(at * 4));
                }
                expect(frame.byteLength).toBe(reference.byteLength);
            }
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    60000
);
