import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import ClientBuild from '#/client/ClientBuild.js';
import world from '#/dash3d/world.js';
import { gamepackPath } from './reference.js';

type Case = [size: number, x: number, width: number, z: number, height: number, level: number, mask: number, fault: number];
type Row = Uint8Array | Int32Array;

function cases(): Case[] {
    const all: Case[] = [];
    for (const p of [0, 1, 2, 3])
        for (let mask = 0; mask < 8; mask++) {
            for (const [w, h] of [
                [8, 8],
                [1, 1],
                [2, 4],
                [5, 3],
                [0, 0],
                [0, 3],
                [3, 0],
                [-1, 4],
                [4, -1]
            ])
                all.push([11, 2, w, 1, h, p, mask, 0]);
        }
    for (const fault of Array.from({ length: 21 }, (_, i) => i)) {
        for (const [x, z, w, h] of [
            [1, 1, 3, 4],
            [2, 4, 0, 0],
            [-2, 1, 4, 3],
            [3, -2, 3, 4],
            [9, 9, 8, 8],
            [103, 103, 2, 2],
            [105, 108, 8, 2]
        ]) {
            for (const p of [-1, 0, 1, 3, 4]) all.push([11, x, w, z, h, p, 0, fault], [11, x, w, z, h, p, 7, fault]);
        }
    }
    for (const [x, z, w, h] of [
        [0, 0, 64, 64],
        [-5, -3, 64, 64],
        [46, 53, 64, 64],
        [96, 96, 8, 8],
        [103, 103, 1, 1],
        [-64, -64, 64, 64],
        [104, 104, 64, 64],
        [100, -5, 8, 8],
        [7, 7, 0, 0],
        [0, 1, 0, -1],
        [-2147483648, 1, 4, 2],
        [2147483646, 2, 5, 2],
        [2, 2147483645, 4, 4]
    ]) {
        for (const p of [0, 1, 3]) for (const mask of [0, 7]) all.push([105, x, w, z, h, p, mask, 0]);
    }
    return all;
}

function run([size, x, width, z, height, level, mask, fault]: Case): string {
    const rows: Row[] = [];
    let writes = 0,
        trace = 1;
    function observe<T extends Row>(row: T): T {
        const id = rows.length;
        rows.push(row);
        return new Proxy(row, {
            get(target, key) {
                return Reflect.get(target, key, target);
            },
            set(target, key, value) {
                const success = Reflect.set(target, key, value, target);
                if (success) {
                    writes++;
                    trace = (Math.imul((Math.imul((Math.imul(trace, 31) + id) | 0, 31) + Number(key)) | 0, 31) + value) | 0;
                }
                return success;
            }
        });
    }
    const heights: Int32Array[][] = [],
        shadows: Uint8Array[][] = [];
    for (let p = 0; p < 4; p++) {
        const plane: Int32Array[] = [],
            shadow: Uint8Array[] = [];
        heights.push(plane);
        shadows.push(shadow);
        for (let a = 0; a < size; a++) {
            const h = new Int32Array(size),
                s = new Uint8Array(size);
            for (let b = 0; b < size; b++) {
                const key = p * 65537 + a * 37 + b;
                h[b] = (Math.imul(key, 1664525) + 1013904223) | 0;
                s[b] = key * 19 + 7;
            }
            plane.push(observe(h));
            shadow.push(observe(s));
        }
    }
    if (x > 0 && x < size && z > 0 && z < size && level >= 0 && level < 4) {
        for (const [i, [a, b]] of [
            [x - 1, z],
            [x, z - 1],
            [x - 1, z - 1]
        ].entries())
            if ((mask & (1 << i)) === 0) heights[level][a][b] = level === 0 ? 0 : heights[level - 1][a][b];
    }
    world.levelHeightmaps = heights;
    ClientBuild.m_shadow = shadows;
    const p = level >= 0 && level < 4 ? level : 0,
        a = x >= 0 && x < size ? x : 1,
        b = z >= 0 && z < size ? z : 1;
    const next = Math.min(a + 1, size - 1),
        len = Math.min(b + 1, size);
    switch (fault) {
        case 1:
            ClientBuild.m_shadow = null;
            break;
        case 2:
            ClientBuild.m_shadow = [];
            break;
        case 3:
            Reflect.set(shadows, p, null);
            break;
        case 4:
            shadows[p] = shadows[p].slice(0, next);
            break;
        case 5:
            Reflect.set(shadows[p], next, null);
            break;
        case 6:
            shadows[p][next] = observe(Uint8Array.from({ length: len }, (_, i) => shadows[p][next][i]));
            break;
        case 7:
            world.levelHeightmaps = null;
            break;
        case 8:
            Reflect.set(world, 'levelHeightmaps', [null]);
            break;
        case 9:
            Reflect.set(heights, p, null);
            break;
        case 10:
            heights[p] = heights[p].slice(0, next);
            break;
        case 11:
            Reflect.set(heights[p], next, null);
            break;
        case 12:
            heights[p][next] = observe(Int32Array.from({ length: len }, (_, i) => heights[p][next][i]));
            break;
        case 13:
            if (p > 0) Reflect.set(heights, p - 1, null);
            break;
        case 14:
            if (p > 0) Reflect.set(heights[p - 1], next, null);
            break;
        case 15:
            if (p > 0) heights[p - 1][a] = new Int32Array(0);
            break;
        case 16:
            if (a > 0) Reflect.set(heights[p], a - 1, null);
            break;
        case 17:
            if (p > 0 && a > 0) Reflect.set(heights[p - 1], a - 1, null);
            break;
        case 18:
            if (a > 0) heights[p][a] = heights[p][a - 1];
            break;
        case 19:
            if (p > 0) heights[p] = heights[p - 1];
            break;
        case 20:
            if (a > 0) shadows[p][a] = shadows[p][a - 1];
            break;
    }
    writes = 0;
    trace = 1;
    let status = 'ok';
    try {
        ClientBuild.clearMapArea(x, width, z, height, level);
    } catch (e) {
        if (e instanceof TypeError && e.message.startsWith('Null ')) status = 'null';
        else if (e instanceof RangeError && /^array index -?\d+$/.test(e.message)) status = 'index' + e.message.slice(12);
        else throw e;
    }
    let digest = 1;
    for (const row of rows) for (const value of row) digest = (Math.imul(digest, 31) + value) | 0;
    return [status, writes, trace, digest].join(' ');
}

test('bk.a missing terrain matches every ordered shadow and height store, edge seams and partial faults in the original JAR', () => {
    const dir = mkdtempSync(join(tmpdir(), '530-absent-terrain-'));
    const originalHeight = world.levelHeightmaps,
        originalShadow = ClientBuild.m_shadow;
    try {
        const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
        const compile = Bun.spawnSync(['javac', asm, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game', 'GroundMissingOracle.java')]);
        expect(compile.exitCode, compile.stderr.toString()).toBe(0);
        const command = ['java', asm, '-XX:-OmitStackTraceInFastThrow', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'GroundMissingOracle'];
        const prepare = Bun.spawnSync([...command, gamepackPath, dir]);
        expect(prepare.exitCode, prepare.stderr.toString()).toBe(0);
        const rows = cases();
        const lines = rows.map(row => row.join(' '));
        const java = Bun.spawnSync(command, { stdin: Buffer.from(lines.join('\n') + '\n'), timeout: 30000 });
        expect(java.exitCode, java.stderr.toString()).toBe(0);
        const expected = java.stdout.toString().trimEnd().split(/\r?\n/);
        expect(expected.length).toBe(rows.length);
        for (const [i, row] of rows.entries()) expect(run(row), lines[i]).toBe(expected[i]);
    } finally {
        world.levelHeightmaps = originalHeight;
        ClientBuild.m_shadow = originalShadow;
        rmSync(dir, { recursive: true, force: true });
    }
}, 60000);
