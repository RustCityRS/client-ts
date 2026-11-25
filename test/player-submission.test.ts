import { expect } from 'bun:test';
import WrappedException from '#/util/WrappedException.js';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import ClientBuild from '#/client/ClientBuild.js';
import ReceivePlayerPositions from '#/client/ReceivePlayerPositions.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import PlayerModel from '#/dash3d/PlayerModel.js';
import type ModelSource from '#/dash3d/ModelSource.js';
import type Square from '#/dash3d/Square.js';
import world from '#/dash3d/world.js';
import Preferences from '#/ui/Preferences.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { loginFixture } from './login-fixture.js';
import { gamepackPath } from './reference.js';

function gridHash(rows: (Int32Array | null)[] | null): number {
    if (rows === null) return 0;
    let hash = 1;
    for (const row of rows) {
        let item = 0;
        if (row !== null) {
            item = 1;
            for (const n of row) item = (Math.imul(item, 31) + n) | 0;
        }
        hash = (Math.imul(hash, 31) + item) | 0;
    }
    return hash;
}

loginFixture(
    import.meta.url,
    'th.a player submissions match the 530 gamepack',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-player-submission-')),
            probeDir = join(dir, 'observed');
        const height = Client.GetAvH,
            add = world.AddDynamic,
            add2 = world.AddDynamic2;
        const terrain = Array.from({ length: 4 }, (_, p) => Array.from({ length: 105 }, (_, x) => Int32Array.from({ length: 105 }, (_, z) => p * 317 + x * 19 - z * 27)));
        const flags = Array.from({ length: 4 }, (_, p) => Array.from({ length: 104 }, (_, x) => Uint8Array.from({ length: 104 }, (_, z) => (p === 1 && (x + z) % 3 === 1 ? 2 : 0))));
        function run(row: number[], observed: boolean): string {
            const [pass, mode, x, z, size, count, attach, bits] = row;
            const trace: string[] = [],
                slots = [6, 2, 15, 9, 1, 17],
                players: ClientPlayer[] = [];
            const number = (p: ModelSource | null) => players.findIndex(player => player === p);
            let sizes = 0,
                idReads = 0,
                selfReads = 0,
                cycleReads = 0,
                countReads = 0;
            Client.playerLevel = 1;
            Preferences.manyIdleAnimations = (bits & 1) !== 0;
            world.maxTileX = world.maxTileZ = 104;
            world.dynamicCount = 0;
            world.dynamicSprites = new Array(24).fill(null);
            world.squares = Array.from({ length: 4 }, () => Array.from({ length: 104 }, () => new Array<Square | null>(104).fill(null)));
            world.levelHeightmaps = terrain;
            world.underwaterHeightmap = null;
            ClientBuild.m_mapl = flags;
            const grid: (Int32Array | null)[] = Array.from({ length: 104 }, () => new Int32Array(104).fill((bits & 2) !== 0 ? 2 : 0));
            Client.tileActorCount = grid;
            let activeIds: Int32Array | null = new Int32Array(Math.max(6, count));
            let playerCount = count,
                cycle = 10;
            Reflect.set(Client, 'players', new Array<ClientPlayer | null>(18).fill(null));
            for (let i = 0; i < slots.length; i++) {
                const p = new ClientPlayer();
                players.push(p);
                Client.players[slots[i]] = i === 4 ? null : p;
                activeIds[i] = slots[i];
                if (i !== 3) {
                    p.appearance = new PlayerModel();
                    p.appearance.npcId = -1;
                }
                p.x = (x + (i === 5 ? 128 : 0)) | 0;
                p.z = (z + (i === 5 ? 128 : 0)) | 0;
                p.setSize(size);
                p.yaw = 380 * i;
                p.sceneHeight = -110 - i;
                p.stretches = (i & 1) === 1;
                p.lowDetail = true;
                p.walkSeq = i === 1 ? 12 : -1;
                if (attach !== 0 && i !== 2) p.attachment = {};
                p.attachmentStart = attach === 2 ? 11 : 10;
                p.attachmentEnd = attach === 3 ? 10 : 11;
                p.attachmentMinX = 4 + i;
                p.attachmentMinZ = 6 + i;
                p.attachmentMaxX = 5 + i;
                p.attachmentMaxZ = 8 + i;
                if (observed) {
                    p.isVisible = () => {
                        trace.push('v' + i);
                        const visible = ClientPlayer.prototype.isVisible.call(p);
                        if (mode === 23 && i === 0) playerCount = 0;
                        return visible;
                    };
                    p.getSize = () => {
                        trace.push('s' + i);
                        const n = ClientPlayer.prototype.getSize.call(p);
                        if (i === 0) {
                            sizes++;
                            if (mode === 20 && sizes === 1) p.x = (p.x + 128) | 0;
                            if (mode === 21 && sizes === 2) p.setSize(1);
                        }
                        return n;
                    };
                    Object.defineProperty(p, 'getBasType', {
                        value: () => {
                            trace.push('b' + i);
                            if (mode === 24) return null;
                            if (mode === 35) p.walkSeq = 123;
                            return ClientPlayer.prototype.getBasType.call(p);
                        }
                    });
                }
            }
            let self: ClientPlayer | null = players[0];
            Client.destinationX = x >> 7;
            Client.destinationZ = z >> 7;
            const tx = Math.max(0, Math.min(103, x >> 7)),
                tz = Math.max(0, Math.min(103, z >> 7));
            switch (mode) {
                case 1:
                    grid[tx] = grid[Math.min(103, tx + 1)];
                    break;
                case 2:
                    Client.tileActorCount = null;
                    break;
                case 3:
                    Client.tileActorCount = grid.slice(0, tx);
                    break;
                case 4:
                    grid[tx] = null;
                    break;
                case 5:
                    grid[tx] = new Int32Array(tz);
                    break;
                case 6:
                    requireNonNull(grid[tx])[tz] = 2147483647;
                    break;
                case 7:
                    playerCount = -1;
                    break;
                case 8:
                    self = null;
                    break;
                case 9:
                    Client.destinationZ++;
                    break;
                case 10:
                    activeIds[4] = 18;
                    break;
                case 11:
                    activeIds = activeIds.slice(0, 2);
                    break;
                case 12:
                    Reflect.set(Client, 'players', null);
                    break;
                case 13:
                    activeIds = null;
                    break;
                case 14:
                    world.dynamicSprites = [];
                    break;
                case 15:
                    Client.playerLevel = -1;
                    break;
                case 16:
                    world.levelHeightmaps = [];
                    break;
                case 17:
                    world.squares = null;
                    break;
                case 18:
                    activeIds[5] = activeIds[0];
                    break;
                case 19:
                    Client.players[6] = null;
                    break;
                case 33:
                    self = players[3];
                    self.z = (self.z + 128) | 0;
                    break;
            }
            if (observed && (mode === 36 || mode === 37)) {
                for (const [i, player] of players.entries()) {
                    const fineX = player.x,
                        fineZ = player.z;
                    Object.defineProperty(player, 'x', {
                        get() {
                            trace.push('x' + i);
                            if (mode === 37) Client.playerLevel = 3 - Client.playerLevel;
                            return fineX;
                        }
                    });
                    Object.defineProperty(player, 'z', {
                        get() {
                            trace.push('z' + i);
                            return fineZ;
                        }
                    });
                }
            }
            const failure = new Error('submission probe');
            if (observed) {
                Client.GetAvH = (x, z, level, guard) => {
                    trace.push('h' + [level, x, z, guard].join(','));
                    if (mode === 25) {
                        Client.playerLevel = 2;
                        players[0].x = (players[0].x + 120) | 0;
                        players[0].z = (players[0].z + 13) | 0;
                        players[0].yaw = 1900;
                        players[0].attachmentMinX = 33;
                    }
                    if (mode === 26) throw failure;
                    return height(x, z, level, guard);
                };
            } else {
                Client.GetAvH = height;
            }
            if (observed) {
                world.AddDynamic = (level, x, z, y, radius, p, yaw, key, stretch) => {
                    trace.push('a' + [level, x, z, y, radius, number(p), yaw, key, stretch].join(','));
                    if (mode === 27) throw failure;
                    if (mode === 28) {
                        activeIds = Int32Array.of(17);
                        playerCount = 1;
                    }
                    return add(level, x, z, y, radius, p, yaw, key, stretch);
                };
            } else {
                world.AddDynamic = add;
            }
            if (observed) {
                world.AddDynamic2 = (level, x, z, y, p, yaw, key, x1, z1, x2, z2) => {
                    trace.push('e' + [level, x, z, y, number(p), yaw, key, x1, z1, x2, z2].join(','));
                    if (mode === 27) throw failure;
                    if (mode === 29) Client.tileActorCount = null;
                    return add2(level, x, z, y, p, yaw, key, x1, z1, x2, z2);
                };
            } else {
                world.AddDynamic2 = add2;
            }
            Object.defineProperty(ReceivePlayerPositions, 'm_lastNum', {
                configurable: true,
                get() {
                    const n = playerCount;
                    if (observed) {
                        trace.push('n' + n);
                        if (mode === 34 && ++countReads === 1) playerCount = 201;
                    }
                    return n;
                }
            });
            Object.defineProperty(ReceivePlayerPositions, 'm_lastID', {
                configurable: true,
                get() {
                    if (observed) {
                        trace.push('i');
                        if (mode === 31 && ++idReads === playerCount + 2) {
                            activeIds = requireNonNull(activeIds).slice();
                            activeIds[0] = 17;
                        }
                    }
                    return activeIds;
                }
            });
            Object.defineProperty(Client, 'localPlayer', {
                configurable: true,
                get() {
                    const p = self;
                    if (observed) {
                        trace.push('l' + number(p));
                        if (mode === 30 && ++selfReads === 1) self = players[3];
                    }
                    return p;
                }
            });
            Object.defineProperty(Client, 'loopCycle', {
                configurable: true,
                get() {
                    const t = cycle;
                    if (observed) {
                        trace.push('c' + t);
                        if (mode === 32 && ++cycleReads === 1) cycle = 11;
                    }
                    return t;
                }
            });
            let status = 'ok';
            try {
                if (pass === 0 || pass === 2 || pass === 3) Client.pushPlayers(true);
                if (pass === 1 || pass === 2 || pass === 3) Client.pushPlayers(false);
                if (pass === 3) Client.pushPlayers(false);
            } catch (caught) {
                let e = caught;
                while (e instanceof WrappedException) e = e.cause;
                if (e === failure) status = 'probe';
                else if (e instanceof TypeError) status = 'null';
                else if (e instanceof RangeError) status = 'bounds';
                else throw e;
            }
            const sprites = world.dynamicSprites.flatMap(s => (s === null ? [] : [[s.typecode, number(s.model), s.level, s.x, s.z, s.y, s.yaw, s.minTileX, s.minTileZ, s.maxTileX, s.maxTileZ].join(',')]));
            return [status, Client.destinationX, gridHash(grid), gridHash(Client.tileActorCount), players.map(p => p.sceneHeight + ':' + Number(p.lowDetail)).join(','), world.dynamicCount, sprites.join(';'), playerCount, trace.join(';')].join('/');
        }
        try {
            const access = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED'];
            const compile = Bun.spawnSync(['javac', ...access, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game/PlayerSubmissionOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const cp = dir + delimiter + gamepackPath;
            mkdirSync(probeDir);
            const instrument = Bun.spawnSync(['java', ...access, '-cp', cp, 'PlayerSubmissionOracle', gamepackPath, probeDir]);
            expect(instrument.exitCode, instrument.stderr.toString()).toBe(0);
            for (const observed of [false, true]) {
                const rows: number[][] = [];
                if (!observed) {
                    for (let pass = 0; pass <= 3; pass++)
                        for (const bits of [0, 1, 2])
                            for (const [x, z, size] of [
                                [832, 960, 1],
                                [896, 1024, 2],
                                [960, 832, 3],
                                [960, 896, 3],
                                [960, 833, 3],
                                [64, 64, 3],
                                [-64, -64, 1],
                                [13312, 13312, 4],
                                [13248, 13248, 3],
                                [0, 128, 0],
                                [128, 256, -2],
                                [2147483647, -2147483648, 1],
                                [832, 960, 2147483647],
                                [896, 1024, -2147483648]
                            ])
                                for (const attach of [0, 1]) rows.push([pass, 0, x, z, size, 6, attach, bits]);
                    for (const n of [-1, 0, 1, 50, 51, 200, 201]) for (const attach of [0, 1, 2, 3]) for (const bits of [0, 1]) rows.push([2, 0, 833, 960, 1, n, attach, bits]);
                    for (const mode of [...Array.from({ length: 19 }, (_, i) => i + 1), 33])
                        for (const pass of [0, 1, 2])
                            for (const size of [1, 2, 3]) {
                                const offset = (size & 1) * 64;
                                rows.push([pass, mode, 768 + offset, 896 + offset, size, 6, pass % 2, 1]);
                            }
                } else {
                    for (const mode of [20, 21, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 34, 35, 36, 37])
                        for (const pass of [0, 1, 2])
                            for (const size of [1, 2, 3]) {
                                const offset = (size & 1) * 64,
                                    n = mode === 24 || mode === 35 ? 51 : 6;
                                rows.push([pass, mode, 768 + offset, 896 + offset, size, n, 0, 1], [pass, mode, 769 + offset, 896, size, n, 1, 1]);
                            }
                }
                const java = Bun.spawnSync(['java', '-Xmx384m', ...access, '-cp', observed ? probeDir + delimiter + cp : cp, 'PlayerSubmissionOracle'], {
                    stdin: Buffer.from(rows.map(row => row.join(' ')).join('\n') + '\n'),
                    maxBuffer: 8 * 1024 * 1024
                });
                expect(java.exitCode, java.stderr.toString()).toBe(0);
                const lines = java.stdout.toString().trimEnd().split(/\r?\n/);
                expect(lines.length).toBe(rows.length);
                for (const [i, row] of rows.entries()) expect(run(row, observed), row.join(' ')).toBe(lines[i]);
            }
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    60000
);
