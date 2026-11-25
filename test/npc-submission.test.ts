import { expect, test } from 'bun:test';
import WrappedException from '#/util/WrappedException.js';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import ClientBuild from '#/client/ClientBuild.js';
import NpcType from '#/config/NpcType.js';
import ClientNpc from '#/dash3d/ClientNpc.js';
import type Sprite from '#/dash3d/Sprite.js';
import type Square from '#/dash3d/Square.js';
import world from '#/dash3d/world.js';
import ClientVarCache from '#/util/ClientVarCache.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { gamepackPath } from './reference.js';

test('a fresh Client has independent zeroed occupancy rows before its first NPC pass', () => {
    const cold = Bun.spawnSync(
        [
            process.execPath,
            '-e',
            `
        import Client from './src/client/Client.ts';
        const grid=Client.tileActorCount;
        if(grid.length!==104 || new Set(grid).size!==104 || grid.some(row=>row.length!==104 || row.some(n=>n!==0)))process.exit(1);
        Client.resetTileOccupancy();
        Client.GdmAddNPCs(true);
        Client.GdmAddNPCs(false);
    `
        ],
        { cwd: join(import.meta.dir, '..') }
    );
    expect(cold.exitCode, cold.stderr.toString()).toBe(0);
});

function gridHash(rows: (Int32Array | null)[] | null): number {
    if (rows === null) return 0;
    let value = 1;
    for (const row of rows) {
        let hash = 0;
        if (row !== null) {
            hash = 1;
            for (const count of row) hash = (Math.imul(hash, 31) + count) | 0;
        }
        value = (Math.imul(value, 31) + hash) | 0;
    }
    return value;
}

test('nc.a and ie.b match native NPC insertion, occupied tile counts, active-list changes and partial failures', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rs530-npc-submission-')),
        probeDir = join(dir, 'instrumented');
    const old = {
        npcs: Client.npcs,
        ids: Client.npcIds,
        count: Client.npcCount,
        grid: Client.tileActorCount,
        level: Client.playerLevel,
        height: Client.GetAvH,
        vars: ClientVarCache.m_var,
        add: world.AddDynamic,
        x: world.maxTileX,
        z: world.maxTileZ,
        tiles: world.squares,
        countDynamic: world.dynamicCount,
        dynamic: world.dynamicSprites,
        terrain: world.levelHeightmaps,
        water: world.underwaterHeightmap,
        flags: ClientBuild.m_mapl
    };
    const terrain = Array.from({ length: 4 }, (_, p) => Array.from({ length: 105 }, (_, x) => Int32Array.from({ length: 105 }, (_, z) => p * 317 + x * 19 - z * 27)));
    const flags = Array.from({ length: 4 }, (_, p) => Array.from({ length: 104 }, (_, x) => Uint8Array.from({ length: 104 }, (_, z) => (p === 1 && (x + z) % 3 === 1 ? 2 : 0))));
    function run(a: number[], instrumented: boolean): string {
        const [pass, mode, x, z, size, dx, dz, otherSize, order] = a;
        const trace: string[] = [],
            ids = [6, 2, 15, 9, 1, 17],
            actors: ClientNpc[] = [],
            types: NpcType[] = [];
        let sizes = 0,
            lookups = 0;
        Client.playerLevel = 1;
        world.maxTileX = world.maxTileZ = 104;
        world.dynamicCount = 0;
        world.squares = Array.from({ length: 4 }, () => Array.from({ length: 104 }, () => new Array<Square | null>(104).fill(null)));
        world.dynamicSprites = new Array<Sprite | null>(24).fill(null);
        world.levelHeightmaps = terrain;
        world.underwaterHeightmap = null;
        ClientBuild.m_mapl = flags;
        Reflect.set(ClientVarCache, 'm_var', Int32Array.of(0));
        const len = mode === 18 ? 105 : 104;
        const grid: (Int32Array | null)[] = Array.from({ length: len }, () => new Int32Array(len).fill(pass === 4 || mode === 18 ? 43 : 0));
        Client.tileActorCount = grid;
        Reflect.set(Client, 'npcs', new Array<ClientNpc | null>(18).fill(null));
        Reflect.set(Client, 'npcIds', Int32Array.from(ids));
        Client.npcCount = 6;
        for (let i = 0; i < ids.length; i++) {
            const npc = new ClientNpc(),
                type = new NpcType();
            actors.push(npc);
            types.push(type);
            Client.npcs[ids[i]] = i === 4 ? null : npc;
            npc.npcType = i === 3 ? null : type;
            type.m_alwaysOnTop = i === 2 || (i === 5 && (order & 4) !== 0);
            type.interactive = (i & 1) === 0;
            npc.x = (x + (i === 2 ? dx : i === 5 ? -dx : 0)) | 0;
            npc.z = (z + (i === 2 || i === 5 ? dz : 0)) | 0;
            npc.setSize(i === 2 || i === 5 ? otherSize : size);
            npc.sceneHeight = -113 - i;
            npc.yaw = i * 380;
            npc.stretches = (i & 1) === 1;
            if (instrumented) {
                npc.isVisible = () => {
                    trace.push('v' + i);
                    return ClientNpc.prototype.isVisible.call(npc);
                };
                type.IsMultiNpcVisible = () => {
                    trace.push('m' + i);
                    const result = NpcType.prototype.IsMultiNpcVisible.call(type);
                    if (i === 0) {
                        ++lookups;
                        if (mode === 22 && lookups === 1) type.m_alwaysOnTop = !type.m_alwaysOnTop;
                        if (mode === 27 && lookups === 2) npc.npcType = null;
                        if ((mode === 33 || mode === 34) && lookups === 2) {
                            const size = ClientNpc.prototype.getSize.call(npc);
                            const x = (npc.x - Math.imul(size, 64)) >> 7,
                                z = (npc.z - Math.imul(size, 64)) >> 7;
                            const current = requireNonNull(Client.tileActorCount);
                            current[x] = new Int32Array(z + 1);
                            if (mode === 34) current[x + 1] = null;
                        }
                    }
                    return result;
                };
                npc.getSize = () => {
                    trace.push('s' + i);
                    const result = ClientNpc.prototype.getSize.call(npc);
                    if (i === 0) {
                        ++sizes;
                        if (mode === 20 && sizes === 1) npc.x = (npc.x + 128) | 0;
                        if (mode === 21 && sizes === 2) npc.setSize(1);
                    }
                    return result;
                };
            }
        }
        if (order & 1) Client.npcIds.reverse();
        if (order & 2) Client.npcIds[4] = Client.npcIds[0];
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
                types[0].multi = Int32Array.of(-1);
                break;
            case 8:
                types[0].multi = new Int32Array(0);
                break;
            case 9:
                types[1].multi = Int32Array.of(42, -1);
                types[1].multiVarp = 1;
                break;
            case 10:
                Client.npcIds[4] = 18;
                break;
            case 11:
                Reflect.set(Client, 'npcIds', Client.npcIds.slice(0, 3));
                break;
            case 12:
                Reflect.set(Client, 'npcs', null);
                break;
            case 13:
                Reflect.set(Client, 'npcIds', null);
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
            case 19:
                types[0].multi = Int32Array.of(7, -1);
                types[0].multiVarp = 0;
                break;
            case 30:
                Reflect.set(Client, 'npcs', null);
                Reflect.set(Client, 'npcIds', null);
                Client.npcCount = -1;
                break;
            case 31:
                Client.tileActorCount = [];
                Client.npcCount = 0;
                break;
            case 32:
                types[2].multi = new Int32Array(0);
                Reflect.set(Client, 'npcIds', Client.npcIds.slice(0, 4));
                Client.npcCount = 4;
                break;
        }
        const probeFailure = new Error('NPC probe');
        if (instrumented) {
            Client.GetAvH = (x, z, level, guard) => {
                trace.push('h' + [level, x, z, guard].join(','));
                if (mode === 23) {
                    Client.playerLevel = 2;
                    actors[0].x = (actors[0].x + 120) | 0;
                    actors[0].z = (actors[0].z + 13) | 0;
                    actors[0].yaw = 1900;
                    actors[0].stretches = true;
                }
                if (mode === 25) throw probeFailure;
                return old.height(x, z, level, guard);
            };
        } else {
            Client.GetAvH = old.height;
        }
        if (instrumented) {
            world.AddDynamic = (level, x, z, y, radius, npc, yaw, key, stretch) => {
                trace.push('a' + [level, x, z, y, radius, actors.findIndex(n => n === npc), yaw, key, stretch].join(','));
                if (mode === 24) {
                    Reflect.set(Client, 'npcIds', Int32Array.of(17));
                    Client.npcCount = 1;
                }
                if (mode === 26) throw probeFailure;
                if (mode === 28) Client.tileActorCount = null;
                if (mode === 29) {
                    Client.npcIds[1] = 17;
                    return false;
                }
                return old.add(level, x, z, y, radius, npc, yaw, key, stretch);
            };
        } else {
            world.AddDynamic = old.add;
        }
        let status = 'ok';
        try {
            switch (pass) {
                case 0:
                    Client.GdmAddNPCs(false);
                    break;
                case 1:
                    Client.GdmAddNPCs(true);
                    break;
                case 2:
                    Client.GdmAddNPCs(true);
                    Client.GdmAddNPCs(false);
                    break;
                case 3:
                    Client.resetTileOccupancy();
                    Client.GdmAddNPCs(true);
                    Client.GdmAddNPCs(false);
                    break;
                case 4:
                    Client.resetTileOccupancy();
                    break;
                case 5:
                    Client.GdmAddNPCs(false);
                    Client.GdmAddNPCs(true);
                    break;
                case 6:
                    Client.GdmAddNPCs(false);
                    Client.GdmAddNPCs(false);
                    break;
            }
        } catch (caught) {
            let e = caught;
            while (e instanceof WrappedException) e = e.cause;
            if (e === probeFailure) status = 'probe';
            else if (e instanceof TypeError) status = 'null';
            else if (e instanceof RangeError) status = 'bounds';
            else throw e;
        }
        const sprites = world.dynamicSprites.flatMap(s => (s === null ? [] : [[s.typecode, actors.findIndex(n => n === s.model), s.level, s.x, s.z, s.y, s.yaw, s.minTileX, s.minTileZ, s.maxTileX, s.maxTileZ].join(',')]));
        return [status, gridHash(grid), gridHash(Client.tileActorCount), actors.map(n => n.sceneHeight).join(','), world.dynamicCount, sprites.join(';'), Client.npcCount, trace.join(';')].join('/');
    }
    try {
        const access = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED'];
        const build = Bun.spawnSync(['javac', ...access, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game/NpcSubmissionOracle.java')]);
        expect(build.exitCode, build.stderr.toString()).toBe(0);
        mkdirSync(probeDir);
        const cp = dir + delimiter + gamepackPath;
        const instrument = Bun.spawnSync(['java', ...access, '-cp', cp, 'NpcSubmissionOracle', gamepackPath, probeDir]);
        expect(instrument.exitCode, instrument.stderr.toString()).toBe(0);
        for (const observed of [false, true]) {
            const rows: number[][] = [];
            if (!observed) {
                for (let pass = 0; pass <= 6; pass++)
                    for (const [x, z, size, dx, dz, other] of [
                        [832, 960, 1, 0, 0, 1],
                        [896, 1024, 2, 128, 0, 2],
                        [960, 832, 3, -128, 128, 3],
                        [960, 833, 3, 32, 17, 2],
                        [64, 64, 3, 0, 128, 1],
                        [-64, -64, 1, 0, 0, 1],
                        [13312, 13312, 4, -128, 0, 2],
                        [13248, 13248, 3, 0, 0, 3],
                        [0, 128, 0, 128, 0, 2],
                        [128, 256, -2, 0, 0, 0],
                        [2147483647, -2147483648, 1, 128, 1, 2]
                    ])
                        for (const order of [0, 1, 3, 4]) rows.push([pass, 0, x, z, size, dx, dz, other, order]);
                for (let mode = 1; mode <= 32; mode++) {
                    if (mode >= 20 && mode < 30) continue;
                    for (const pass of [0, 1, 2, 3, 4])
                        for (const size of [1, 2, 3]) {
                            const offset = (size & 1) * 64;
                            rows.push([pass, mode, 768 + offset, 896 + offset, size, 128, 0, size, pass & 1]);
                        }
                }
            } else {
                for (let mode = 20; mode <= 29; mode++)
                    for (const pass of [0, 2, 5])
                        for (const size of [1, 2, 3]) {
                            const offset = (size & 1) * 64;
                            rows.push([pass, mode, 768 + offset, 896 + offset, size, 0, 0, size, 0]);
                            rows.push([pass, mode, 768 + offset + 1, 896 + offset, size, 128, -128, 2, 1]);
                        }
                // A low count breaks the inner scan only. A short row behind
                // that cell is safe, but a null row in the next column faults.
                for (const mode of [33, 34])
                    for (const size of [2, 3, 4]) {
                        const offset = (size & 1) * 64;
                        rows.push([0, mode, 768 + offset, 896 + offset, size, 128, 0, size, 0]);
                    }
            }
            const java = Bun.spawnSync(['java', '-Xmx384m', ...access, '-cp', observed ? probeDir + delimiter + cp : cp, 'NpcSubmissionOracle'], {
                stdin: Buffer.from(rows.map(row => row.join(' ')).join('\n') + '\n'),
                maxBuffer: 8 * 1024 * 1024
            });
            expect(java.exitCode, java.stderr.toString()).toBe(0);
            const lines = java.stdout.toString().trimEnd().split(/\r?\n/);
            expect(lines.length).toBe(rows.length);
            for (const [i, row] of rows.entries()) expect(run(row, observed), row.join(' ')).toBe(lines[i]);
        }
    } finally {
        Client.tileActorCount = old.grid;
        Client.npcCount = old.count;
        Client.playerLevel = old.level;
        Client.GetAvH = old.height;
        Reflect.set(Client, 'npcs', old.npcs);
        Reflect.set(Client, 'npcIds', old.ids);
        Reflect.set(ClientVarCache, 'm_var', old.vars);
        world.squares = old.tiles;
        world.dynamicCount = old.countDynamic;
        world.maxTileX = old.x;
        world.maxTileZ = old.z;
        world.dynamicSprites = old.dynamic;
        world.levelHeightmaps = old.terrain;
        world.underwaterHeightmap = old.water;
        world.AddDynamic = old.add;
        ClientBuild.m_mapl = old.flags;
        rmSync(dir, { recursive: true, force: true });
    }
}, 60000);
