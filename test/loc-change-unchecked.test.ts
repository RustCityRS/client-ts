import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import ClientBuild from '#/client/ClientBuild.js';
import LocType from '#/config/LocType.js';
import CollisionMap from '#/dash3d/CollisionMap.js';
import LocChange from '#/dash3d/LocChange.js';
import Preferences from '#/ui/Preferences.js';
import { loginFixture } from './login-fixture.js';
import { gamepackPath } from './reference.js';

loginFixture(import.meta.url, 'loc changes follow the original visibility, bridge and collision lookup order', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rs530-loc-change-unchecked-'));
    try {
        const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
        const cp = dir + delimiter + gamepackPath;
        const compile = Bun.spawnSync(['javac', asm, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game/LocChangeUncheckedOracle.java')]);
        expect(compile.exitCode, compile.stderr.toString()).toBe(0);
        const instrument = Bun.spawnSync(['java', asm, '-cp', cp, 'LocChangeUncheckedOracle', gamepackPath, dir]);
        expect(instrument.exitCode, instrument.stderr.toString()).toBe(0);
        const rows: number[][] = [];
        for (let mode = 0; mode < 9; mode++) {
            for (let bits = 0; bits < 32; bits++) {
                for (let i = 0; i < 13; i++) {
                    const plane = [-1, 0, 1, 2, 3, 4, 0, 1, 2, 3, 0, 1, 2][i];
                    rows.push([mode, plane, i === 7 ? 0 : i === 8 ? 103 : 102, i === 9 ? 0 : i === 10 ? 103 : 1, (i + bits) % 23, bits & 2 ? -1 : 2147483647, i % 5, i - 3, bits, bits % 5, 0]);
                }
            }
            for (const shape of [-2147483648, -1, 0, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 2147483647]) {
                rows.push([mode, 0, 1, 2, shape, (shape + 11) | 0, 2, 0, 3, 0, 1]);
            }
        }
        const java = Bun.spawnSync(['java', asm, '-cp', cp, 'LocChangeUncheckedOracle'], { stdin: Buffer.from(rows.map(v => v.join(' ')).join('\n')) });
        expect(java.exitCode, java.stderr.toString()).toBe(0);
        const lines = java.stdout.toString().trimEnd().split(/\r?\n/);
        expect(lines.length).toBe(rows.length);
        const first = new CollisionMap(5, 5),
            second = new CollisionMap(5, 5);
        const type = new LocType();
        const flags = Array.from({ length: 4 }, () => Array.from({ length: 104 }, () => new Uint8Array(104)));
        let mode = 0,
            trace = '';
        const tag = (map: CollisionMap | null) => (map === null ? 'n' : map === first ? 'a' : 'b');
        LocChange.removeUnchecked = (map, x, height, plane, z, layer) => {
            trace += ['r', tag(map), x, height, plane, z, layer, Preferences.showGroundDecorations].join(',') + '/';
            if (mode === 1) throw Error('stop');
            if (mode === 2) Reflect.set(CollisionMap, 'levelMaps', null);
            if (mode === 3) CollisionMap.levelMaps[plane] = second;
            if (mode === 4) Preferences.showGroundDecorations = !Preferences.showGroundDecorations;
        };
        ClientBuild.AddLoc = (water, plane, id, height, angle, shape, x, z, build, map) => {
            trace += ['p', water, plane, id, height, angle, shape, x, z, build, tag(map), Preferences.showGroundDecorations].join(',') + '/';
            if (mode === 5) throw Error('stop');
            if (mode === 6) Preferences.showGroundDecorations = false;
        };
        Reflect.set(LocType, 'List', (id: number) => {
            trace += 'l,' + id + '/';
            if (mode === 1) throw Error('stop');
            return mode === 2 ? null : type;
        });
        type.CheckModel = shape => {
            trace += 'm,' + shape + '/';
            if (mode === 5) throw Error('stop');
            return (shape & 1) === 0;
        };
        for (const [i, row] of rows.entries()) {
            const [scenario, plane, x, z, shape, id, layer, angle, bits, buildLevel, op] = row;
            mode = scenario;
            trace = '';
            Preferences.allLevelsVisible = (bits & 1) !== 0;
            Preferences.showGroundDecorations = (bits & 2) !== 0;
            ClientBuild.buildLevel = buildLevel;
            Reflect.set(CollisionMap, 'levelMaps', mode === 7 ? null : [first, first, first, first]);
            ClientBuild.m_mapl = mode === 8 ? null : flags;
            for (const p of flags) p[x][z] = 0;
            if (plane >= 0 && plane < 4 && bits & 4) flags[plane][x][z] |= 8;
            if (bits & 8) flags[0][x][z] |= 2;
            if (bits & 16) flags[1][x][z] |= 2;
            let status = 'ok';
            try {
                if (op === 0) Client.LocChangeUnchecked(shape, plane, id, layer, x, angle, z);
                else status = String(ClientBuild.ChangeLocAvailable(id, shape));
            } catch (err) {
                if (err instanceof TypeError) status = 'null';
                else if (err instanceof RangeError) status = 'bounds';
                else if (err instanceof Error && err.message === 'stop') status = 'stop';
                else throw err;
            }
            expect([status, Preferences.showGroundDecorations, trace].join(':'), row.join('/')).toBe(lines[i]);
        }
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
