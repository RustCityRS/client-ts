import NpcType from '#/config/NpcType.js';
import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import ClientBuild from '#/client/ClientBuild.js';
import LRUHashCache from '#/datastruct/LRUHashCache.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { gamepackPath } from './reference.js';

const hash = (values: ArrayLike<number>) => Array.from(values).reduce((h, v) => (Math.imul(31, h) + v) | 0, 1);
const record = (level: number, x: number, z: number, id: number) => {
    const position = (level << 14) | (x << 7) | z;
    return [position >> 8, position & 255, id >> 8, id & 255];
};
test('map NPC creation matches vg.e for region slot reuse, placement bounds, partial failures and the 511-entry limit', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rs530-npcmap-'));
    const saved = { loopCycle: Client.loopCycle, mapBuildBaseX: Client.mapBuildBaseX, mapBuildBaseZ: Client.mapBuildBaseZ },
        actors = Client.npcs.slice(),
        indices = Client.npcIds.slice();
    const ids = Client.mapNpcRegionIds.slice(),
        count = Client.npcSpawnRegionCount,
        files = Client.mapBuildNpcData,
        groups = Client.mapBuildIndex;
    const plane = ClientBuild.buildLevel,
        oldCache = NpcType.m_recentUse;
    try {
        const build = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game', 'MapSpawnOracle.java')]);
        expect(build.exitCode, build.stderr.toString()).toBe(0);
        Object.defineProperty(NpcType, 'm_recentUse', { value: new LRUHashCache<NpcType>(64) });
        for (let i = 1; i <= 5; i++) {
            const type = new NpcType();
            type.id = i;
            type.movementFlags = i === 3 ? 2 : 1;
            type.m_gridSize = i === 2 ? 3 : 1;
            type.spawnDirection = i === 4 ? 8 : i;
            type.m_turnSpeed = i === 2 ? 0 : 21 + i;
            type.m_baseAnimationSet = 90 + i;
            NpcType.m_recentUse.Put(BigInt(i), type);
        }
        const region = (50 << 8) | 47;
        const encoded = (bytes: number[]) => Buffer.from(bytes).toString('base64');
        const a = encoded([...record(0, 1, 2, 1), ...record(1, 63, 63, 2), ...record(0, 4, 5, 2), ...record(0, 7, 8, 3)]);
        const bad = encoded([...record(0, 3, 4, 1), ...record(0, 6, 7, 4)]);
        const long = encoded(Array.from({ length: 514 }, (_, i) => record(0, i % 64, (i * 3) % 64, i % 2 === 0 ? 1 : 2)).flat());
        const rows: string[] = [];
        const add = (reserve: number, bx: number, bz: number, level: number, groups: number[], files: string[]) => rows.push([reserve, bx, bz, level, groups.join(','), files.join(',')].join(' '));
        for (const offset of [-103, -102, -100, -1, 0, 1, 63, 64, 2147483647])
            for (const level of [0, 1, 2]) {
                add(0, (50 * 64 + offset) | 0, (47 * 64 + offset) | 0, level, [region, region + 1, region], ['e', a, a]);
                add(-1, (50 * 64 + offset) | 0, (47 * 64 + offset) | 0, level, [region + 1, region], [a, a]);
            }
        for (const n of [0, 1, 63, 64])
            for (const data of ['n', 'e', '-', a, bad, 'Bw==', encoded([...record(0, 1, 1, 1), 0, 1, 0]), long]) {
                add(n, 3200, 3008, 0, [region], [data]);
            }
        add(0, 3200, 3008, 0, [region], ['n', a]);
        const jar = Bun.spawnSync(['java', '-cp', dir + delimiter + gamepackPath, 'MapSpawnOracle'], { stdin: Buffer.from(rows.join('\n') + '\n') });
        expect(jar.exitCode, jar.stderr.toString()).toBe(0);
        const refs = jar.stdout.toString().trimEnd().split(/\r?\n/);
        expect(refs).toHaveLength(rows.length);
        for (const [i, line] of rows.entries()) {
            const [s, bx, bz, level, map, packed] = line.split(' '),
                reserve = Number(s);
            if (reserve >= 0) {
                Client.loopCycle = 101;
                Client.npcSpawnRegionCount = reserve;
                Client.npcCount = 0;
                Client.mapNpcRegionIds.fill(0);
                Client.npcs.fill(null);
                Client.npcIds.fill(-1);
                for (let j = 0; j < reserve && j < 64; j++) Client.mapNpcRegionIds[j] = 1000 + j;
            } else Client.loopCycle++;
            Client.mapBuildBaseX = Number(bx);
            Client.mapBuildBaseZ = Number(bz);
            ClientBuild.buildLevel = Number(level);
            Client.mapBuildIndex = Int32Array.from(map.split(','), Number);
            Client.mapBuildNpcData = packed === '-' ? null : packed.split(',').map(p => (p === 'n' ? null : p === 'e' ? new Uint8Array() : Uint8Array.from(Buffer.from(p, 'base64'))));
            let error = false;
            try {
                Client.spawnMapNpcs();
            } catch {
                error = true;
            }
            const observed: number[] = [];
            Client.npcs.forEach((n, j) => {
                if (n) observed.push(j, n.lastUpdate, requireNonNull(n.npcType).id, n.getSize(), n.targetYaw, n.yaw, n.turnSpeed, n.bas, n.x, n.z, hash(n.pathX), hash(n.pathZ));
            });
            expect([error, Client.npcSpawnRegionCount, hash(Client.mapNpcRegionIds), Client.npcCount, hash(Client.npcIds), hash(observed)].join(' '), 'case ' + i).toBe(refs[i]);
        }
    } finally {
        Object.defineProperty(NpcType, 'm_recentUse', { value: oldCache });
        Object.assign(Client, saved);
        for (let i = 0; i < actors.length; i++) Client.npcs[i] = actors[i];
        Client.npcIds.set(indices);
        Client.mapNpcRegionIds.set(ids);
        Client.npcSpawnRegionCount = count;
        Client.mapBuildNpcData = files;
        Client.mapBuildIndex = groups;
        ClientBuild.buildLevel = plane;
        rmSync(dir, { recursive: true, force: true });
    }
});
