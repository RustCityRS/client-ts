import Client from '#/client/Client.js';
import NpcType from '#/config/NpcType.js';
import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import { inflateSync } from 'node:zlib';
import CollisionMap from '#/dash3d/CollisionMap.js';
import SuperPacket from '#/io/SuperPacket.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import PlayerModel from '#/dash3d/PlayerModel.js';
import RouteFinding from '#/movement/RouteFinding.js';
import { gamepackPath } from './reference.js';

test('hj, mg, ld and tg search direction, cost and both ring buffers match the gamepack after success, nearest and failures', () => {
    const actor = new ClientPlayer();
    const maps: CollisionMap[] = [];
    const searches: number[][][] = [];
    for (let m = 0; m < 6; m++) {
        const map = new CollisionMap(m === 5 ? 24 : 104, m === 5 ? 19 : 104);
        for (let x = 0; x < map.width; x++)
            for (let z = 0; z < map.height; z++) {
                if (m === 0) map.flags[x][z] = 0;
                else if (m === 1) map.flags[x][z] = -1;
                else if (m === 2 || m === 3) {
                    if (x > 5 && x < 91 && z > 5 && z < 90) {
                        map.flags[x][z] = m === 2 && (x * 23 + z * 13) % 19 < 4 ? 1 << ((x * 7 + z * 11) % 25) : 0;
                        if (m === 3 && x % 4 === 0 && z % 24 !== (Math.floor(x / 4) % 2 === 0 ? 1 : 21)) map.flags[x][z] = 256;
                    }
                } else if (m === 5) map.flags[x][z] = 0;
            }
        maps.push(map);
        const cases: number[][] = [];
        for (let i = 0; i < 36; i++) {
            const tx = 12 + ((i * 13) % 69),
                tz = 12 + ((i * 17) % 70);
            cases.push([i % 5, 12 + ((i * 7) % 70), 12 + ((i * 23) % 70), tx, tz, i % 4, (i * 3) % 7, (i % 14) - 1, i % 4, i & 15, i & 1, i % 3, i % 9 === 0 ? 4 : -1]);
        }
        for (const size of [1, 2, 3, 4, 127]) {
            cases.push([size, 51, 49, 51, 49, 0, 0, -1, 0, 0, 0, 0, -1], [size, 102, 102, 97, 21, 0, 0, -1, 0, 0, 1, 1, -1], [size, 2, 3, -5, -6, 1, 2, 3, 1, 5, 1, 2, -1], [size, 3, 3, 2, 2, 1, 1, 6, 3, 9, 0, 0, -1]);
        }
        cases.push([1, -1, 30, 15, 17, 0, 0, -1, 0, 0, 1, 0, -1], [2, 20, 104, 40, 60, 0, 0, -1, 0, 0, 1, 0, -1]);
        searches.push(cases);
    }
    const words: number[] = [maps.length];
    for (let m = 0; m < maps.length; m++) {
        const map = maps[m];
        words.push(map.width, map.height);
        for (const row of map.flags) words.push(...row);
        words.push(searches[m].length);
        for (const entry of searches[m]) words.push(...entry);
    }
    const bytes = Buffer.alloc(words.length * 4);
    let offset = 0;
    for (const v of words) offset = bytes.writeInt32BE(v, offset);
    mkdirSync(resolve('out'), { recursive: true });
    const dir = mkdtempSync(resolve('out', 'route-oracle-'));
    try {
        const compile = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game', 'RouteOracle.java')]);
        expect(compile.stderr.toString()).toBe('');
        expect(compile.exitCode).toBe(0);
        const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'RouteOracle'], { stdin: bytes, maxBuffer: 32 * 1024 * 1024, timeout: 30000 });
        expect(java.stderr.toString()).toBe('');
        expect(java.exitCode).toBe(0);
        const expected = inflateSync(java.stdout);
        let read = 0;
        const next = () => {
            const n = expected.readInt32BE(read);
            read += 4;
            return n;
        };
        const type = new NpcType();
        type.m_gridSize = 4;
        NpcType.m_recentUse.Put(501n, type);
        RouteFinding.m_listx.fill(0);
        RouteFinding.m_listz.fill(0);
        Client.tryMoveNearest = 0;
        for (const row of RouteFinding.m_dirMap) row.fill(0);
        for (const row of RouteFinding.m_distMap) row.fill(0);
        Client.playerLevel = 2;
        Client.localPlayer = actor;
        Client.out = new SuperPacket(5000);
        Client.out.SetEnc(Int32Array.of(9, 7, 5, 3));
        for (let m = 0; m < maps.length; m++)
            for (const entry of searches[m]) {
                Client.out.m_pos = 0;
                CollisionMap.levelMaps[2] = maps[m];
                const [size, sx, sz, tx, tz, w, h, shape, angle, sides, near, mode, npcSize] = entry;
                actor.setSize(size);
                actor.appearance = npcSize < 0 ? null : new PlayerModel();
                if (actor.appearance !== null) actor.appearance.npcId = 501;
                let result;
                try {
                    result = +RouteFinding.FindRoute(w, tz, tx, h, near !== 0, angle, sides, sz, (shape + 1) | 0, mode, sx);
                } catch (error) {
                    if (!(error instanceof RangeError)) throw error;
                    result = -1;
                }
                expect(result, 'map ' + m + ', ' + entry.join(',')).toBe(next());
                expect(Client.tryMoveNearest).toBe(next());
                for (const row of [...RouteFinding.m_dirMap, ...RouteFinding.m_distMap, RouteFinding.m_listx, RouteFinding.m_listz]) {
                    for (const actual of row) {
                        const value = next();
                        if (actual !== value) throw Error('map ' + m + ', ' + entry.join(',') + ' array offset ' + (read - 4) + ' expected ' + value + ', got ' + actual);
                    }
                }
            }
        expect(read).toBe(expected.length);
    } finally {
        NpcType.m_recentUse.Reset();
        rmSync(dir, { recursive: true, force: true });
    }
}, 45000);
