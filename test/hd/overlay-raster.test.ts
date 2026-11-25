import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import HintArrow from '#/client/HintArrow.js';
import ClientNpc from '#/dash3d/ClientNpc.js';
import NpcType from '#/config/NpcType.js';
import Client from '#/client/Client.js';
import ReceivePlayerPositions from '#/client/ReceivePlayerPositions.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import PlayerModel from '#/dash3d/PlayerModel.js';
import { fromJsString } from '#/datastruct/JagString.js';
import { FALLBACK_CAPS_PROFILE } from '#/gl/CapsProfile.js';
import GlRaster from '#/gl/GlRaster.js';
import GlRenderer from '#/gl/GlRenderer.js';
import NullGL from '#/gl/NullGL.js';
import Pix2D from '#/graphics/Pix2D.js';
import Pix32 from '#/graphics/Pix32.js';
import SoftwareFont from '#/graphics/SoftwareFont.js';
import SpriteLoader from '#/graphics/SpriteLoader.js';
import { IllegalStateException } from '#/util/JavaException.js';
import WrappedException from '#/util/WrappedException.js';
import { loginFixture } from '../login-fixture.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

loginFixture(
    import.meta.url,
    'HD overhead draws reread the renderer flag at each native health-bar and chat clip',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-overlay-raster-'));
        try {
            const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
            const exports = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
            const build = Bun.spawnSync(['javac', exports, '-cp', cp, '-d', dir, join(import.meta.dir, 'GlRecorder.java'), join(import.meta.dir, 'HdOverlayRasterOracle.java')]);
            expect(build.exitCode, build.stderr.toString()).toBe(0);
            const native = ['java', exports, '-Djava.awt.headless=true', '-cp', cp, 'HdOverlayRasterOracle'];
            const prepare = Bun.spawnSync([...native, hdGamepackPath, dir]);
            expect(prepare.exitCode, prepare.stderr.toString()).toBe(0);
            const cases: number[][] = [];
            for (const effect of [4, 5])
                for (const initial of [0, 1]) {
                    for (let toggles = 0; toggles < 32; toggles++) cases.push([effect, initial, toggles, 0, 0]);
                    for (const toggles of [0, 9, 18, 31]) {
                        for (let fault = 1; fault <= (effect === 4 ? 15 : 14); fault++) cases.push([effect, initial, toggles, fault, 0]);
                        for (const mutation of [1, 2, 3]) cases.push([effect, initial, toggles, 0, mutation]);
                    }
                }
            for (const effect of [4, 5]) for (const initial of [0, 1]) for (const mode of [0, 1, 2, 3]) cases.push([effect, initial, 0, 0, 0, 1, mode]);
            const java = Bun.spawnSync(native, { stdin: Buffer.from(cases.map(c => c.join(' ')).join('\n') + '\n'), maxBuffer: 4 * 1024 * 1024 });
            expect(java.exitCode, java.stderr.toString()).toBe(0);
            const rows = java.stdout.toString().trimEnd().split(/\r?\n/);
            expect(rows).toHaveLength(cases.length);

            const player = (Client.localPlayer = new ClientPlayer());
            player.appearance = new PlayerModel();
            player.modelMinY = -81;
            player.overheadText = fromJsString('Obj');
            player.healthUntil = 73;
            player.health = 129;
            player.chatColour = 0;
            player.chatTimer = 143;
            Client.loopCycle = 60;
            Client.chatPublicMode = 0;
            ReceivePlayerPositions.m_lastNum = Client.npcCount = 0;
            GlRenderer.gl = new NullGL(FALLBACK_CAPS_PROFILE);
            GlRenderer.width = 140;
            GlRenderer.height = 90;
            const back = new Pix32(17, 6),
                front = new Pix32(17, 6);
            SpriteLoader.hitbarDefault = [back, front];
            const font = (Client.fontBold12 = new SoftwareFont(new Uint8Array(257)));
            font.lineHeight = 9;
            let active = false,
                armed = false,
                mask = 0,
                faultAt = 0,
                ordinal = 0,
                widths = 0,
                reads = 0,
                mutation = 0;
            let trace = '';
            for (const [owner, name, label] of [
                [ReceivePlayerPositions, 'm_lastNum', 'players'],
                [Client, 'npcCount', 'npcs'],
                [Client, 'players', 'playerList'],
                [ReceivePlayerPositions, 'm_lastID', 'playerIds'],
                [Client, 'npcIds', 'npcIds'],
                [Client, 'projectX', 'projectX'],
                [Client, 'projectY', 'projectY'],
                [Client, 'headiconsPk', 'skulls'],
                [Client, 'imageHeadiconsPrayer', 'prayers'],
                [Client, 'loopCycle', 'cycle'],
                [Client, 'chatPublicMode', 'chatMode'],
                [Client, 'maxChats', 'limit'],
                [Client, 'chatCount', 'count'],
                [Client, 'chatY', 'chatY'],
                [Client, 'chatHeight', 'chatHeight'],
                [Client, 'chatX', 'chatX'],
                [Client, 'chatWidth', 'chatWidth'],
                [Client, 'chatEffects', 'effects'],
                [Client, 'fontBold12', 'font']
            ] as const) {
                let value: unknown = Reflect.get(owner, name);
                Object.defineProperty(owner, name, {
                    configurable: true,
                    get() {
                        if (armed) trace += label + ';';
                        return value;
                    },
                    set(next: unknown) {
                        value = next;
                    }
                });
            }
            function event(key: string, ...args: number[]): void {
                if (!armed) return;
                trace += [key, ...args].join(',') + ';';
                if (++ordinal === faultAt) throw new IllegalStateException();
            }
            function toggle(bit: number): void {
                if ((mask & (1 << bit)) !== 0) active = !active;
            }
            Object.defineProperty(GlRenderer, 'active', {
                configurable: true,
                get() {
                    event('read', Number(active));
                    if (armed) {
                        reads++;
                        if (mutation === 1 && reads === 1) {
                            back.width = 41;
                            back.height = 19;
                            Client.projectX = 69;
                        }
                        if (mutation === 2 && reads === 3) Client.fontBold12 = null;
                        if (mutation === 3 && reads === 3) {
                            Client.projectX = -17;
                            Client.projectY = 71;
                            font.lineHeight = 23;
                        }
                    }
                    return active;
                }
            });
            Client.GetOverlayPos = (cy, cx, h, _actor, sx = 256, sy = 256) => {
                event('project', cy, cx, h, sx, sy);
                Client.projectX = 39;
                Client.projectY = 32;
            };
            back.draw = (x, y) => {
                event('back', x, y);
                toggle(1);
            };
            front.draw = (x, y) => {
                event('front', x, y);
                toggle(2);
            };
            font.stringWidth = () => {
                event('width', ++widths);
                toggle(widths === 1 ? 0 : 3);
                return 27;
            };
            font.drawLeft = (_msg, x, y, col, shadow) => {
                event('left', x, y, col, shadow);
                toggle(4);
            };
            font.drawCentred = (_msg, x, y, col, shadow) => {
                event('centre', x, y, col, shadow);
                toggle(4);
            };
            for (const [name, raster] of [
                ['sd', Pix2D],
                ['hd', GlRaster]
            ] as const) {
                for (const [suffix, method] of [
                    ['Clip', 'intersectClipping'],
                    ['Reset', 'setClipping']
                ] as const) {
                    const run = raster[method].bind(raster);
                    raster[method] = (...args) => {
                        event(name + suffix, ...args);
                        run(...args);
                    };
                }
            }
            for (const [i, [effect, initial, toggles, fault, change, roster, mode]] of cases.entries()) {
                armed = false;
                active = initial === 1;
                mask = toggles;
                faultAt = fault;
                mutation = change;
                Client.chatPublicMode = mode ?? 0;
                Client.npcCount = ReceivePlayerPositions.m_lastNum = roster ? 1 : 0;
                if (roster) {
                    ReceivePlayerPositions.m_lastID[0] = 17;
                    Client.players[17] = player;
                    Client.npcIds[0] = 31;
                    const npc = (Client.npcs[31] = new ClientNpc());
                    npc.npcType = new NpcType();
                    npc.npcType.headIcon = 0;
                    player.skullIcon = 0;
                    player.hitUntil.fill(80);
                    Client.imageHitmarks = [back, front];
                    Client.fontPlain11 = font;
                    Client.headiconsPk = Client.imageHeadiconsPrayer = Client.hintHeadicons = [back, front];
                    const p = (Client.hintArrows[0] = new HintArrow());
                    p.type = 10;
                    p.actor = 17;
                    const n = (Client.hintArrows[1] = new HintArrow());
                    n.type = 1;
                    n.actor = 31;
                    for (const hint of [p, n]) {
                        const id = hint.actor;
                        Object.defineProperty(hint, 'actor', {
                            get() {
                                if (armed) trace += 'hintActor;';
                                return id;
                            }
                        });
                    }
                } else player.skullIcon = -1;
                Client.fontBold12 = font;
                font.lineHeight = 9;
                back.width = 17;
                back.height = 6;
                player.chatEffect = effect;
                Pix2D.setPixels(new Int32Array(140 * 90), 140, 90);
                Pix2D.setClipping(2, 4, 92, 69);
                GlRaster.setClipping(7, 9, 103, 82);
                reads = ordinal = widths = 0;
                trace = '';
                armed = true;
                let result = 'ok';
                try {
                    Client.GdmEntityOverlays(13, 11, 96, 59, 301, 433);
                } catch (error) {
                    if (error instanceof WrappedException) result = error.context + '/' + (error.cause instanceof TypeError ? 'NullPointerException' : error.cause?.constructor.name);
                    else throw error;
                } finally {
                    armed = false;
                }
                const sd = [Pix2D.clipMinX, Pix2D.clipMinY, Pix2D.clipMaxX, Pix2D.clipMaxY].join(',');
                const hd = [GlRaster.clipMinX, GlRaster.clipMinY, GlRaster['clipMaxX'], GlRaster.clipMaxY].join(',');
                expect([trace, result, Number(active), Client.chatCount, sd, hd].join('|'), cases[i].join(' ')).toBe(rows[i]);
            }
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    45000,
    'gl'
);
