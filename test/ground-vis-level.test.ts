import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import ClientBuild from '#/client/ClientBuild.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { gamepackPath } from './reference.js';

type Case = [width: number, height: number, x: number, z: number, level: number, mask: number, bridge: number, fault: number];
function cases(): Case[] {
    const rows: Case[] = [];
    for (let level = 0; level <= 3; level++) {
        for (let byte = 0; byte <= 255; byte++) {
            for (const bridge of [0, 2, 8, 255]) {
                rows.push([3, 4, 1, 2, level, byte, bridge, 0]);
                rows.push([3, 4, 1, 2, level, bridge, byte, 0]);
            }
        }
    }
    for (let fault = 0; fault <= 12; fault++) {
        for (const level of [-2147483648, -1, 0, 1, 2, 3, 4, 2147483647]) {
            for (const [mask, bridge] of [
                [0, 0],
                [2, 0],
                [8, 2],
                [248, 0],
                [255, 255],
                [0, 255]
            ]) {
                rows.push([3, 4, 1, 2, level, mask, bridge, fault]);
                for (const [x, z] of [
                    [-1, 2],
                    [3, 2],
                    [1, -1],
                    [1, 4]
                ])
                    rows.push([3, 4, x, z, level, mask, bridge, fault]);
            }
        }
    }
    for (const [x, z] of [
        [0, 0],
        [0, 103],
        [103, 0],
        [103, 103],
        [103, 104],
        [104, 103],
        [-2147483648, 103],
        [103, 2147483647]
    ]) {
        for (const level of [0, 1, 2, 3]) for (const fault of [0, 7, 9, 10]) rows.push([104, 104, x, z, level, 0, 2, fault]);
    }
    return rows;
}

function run([width, height, x, z, level, mask, bridge, fault]: Case): string {
    const p = level >= 0 && level < 4 ? level : 0;
    const a = x >= 0 && x < width ? x : 0;
    const b = z >= 0 && z < height ? z : 0;
    function map(current: number, bridgeMask: number): Uint8Array[][] {
        const flags = Array.from({ length: 4 }, () => Array.from({ length: width }, () => new Uint8Array(height)));
        flags[1][a][b] = bridgeMask;
        if (level >= 0 && level < 4) flags[level][a][b] = current;
        return flags;
    }
    let flags: Uint8Array[][] | null = map(mask, bridge);
    let replace = false,
        reads = 0;
    let next: Uint8Array[][] | null = null;
    switch (fault) {
        case 1:
            flags = null;
            break;
        case 2:
            flags = [];
            break;
        case 3:
            Reflect.set(flags, p, null);
            break;
        case 4:
            flags[p] = flags[p].slice(0, a);
            break;
        case 5:
            Reflect.set(flags[p], a, null);
            break;
        case 6:
            flags[p][a] = flags[p][a].slice(0, b);
            break;
        case 7:
            Reflect.set(flags, 1, null);
            break;
        case 8:
            flags[1][a] = flags[1][a].slice(0, b);
            break;
        case 9:
            replace = true;
            break;
        case 10:
            replace = true;
            next = map(bridge ^ 2, bridge ^ 2);
            break;
        case 11:
            replace = true;
            next = [];
            break;
        case 12:
            flags[1] = flags[3];
            break;
    }
    Object.defineProperty(ClientBuild, 'm_mapl', {
        configurable: true,
        get() {
            const loaded = flags;
            if (++reads === 1 && replace) flags = next;
            return loaded;
        }
    });
    let result: string;
    try {
        result = 'value' + ClientBuild.VisLevel(x, level, z);
    } catch (error) {
        if (error instanceof TypeError && error.message.startsWith('Null ')) result = 'null';
        else if (error instanceof RangeError && /^array index -?\d+$/.test(error.message)) result = 'index' + error.message.slice(12);
        else throw error;
    }
    return reads + ' ' + result;
}

test('VisLevel matches both native flag lookups, bit-8 short-circuit and clipped or changing plane storage', () => {
    const dir = mkdtempSync(join(tmpdir(), '530-tile-visibility-'));
    const original = requireNonNull(Object.getOwnPropertyDescriptor(ClientBuild, 'm_mapl'));
    try {
        const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
        const compile = Bun.spawnSync(['javac', asm, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game', 'GroundVisLevelOracle.java')]);
        expect(compile.exitCode, compile.stderr.toString()).toBe(0);
        const command = ['java', asm, '-XX:-OmitStackTraceInFastThrow', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'GroundVisLevelOracle'];
        const prepare = Bun.spawnSync([...command, gamepackPath, dir]);
        expect(prepare.exitCode, prepare.stderr.toString()).toBe(0);
        const vectors = cases(),
            lines = vectors.map(row => row.join(' '));
        const java = Bun.spawnSync(command, { stdin: Buffer.from(lines.join('\n') + '\n'), timeout: 30000 });
        expect(java.exitCode, java.stderr.toString()).toBe(0);
        const expected = java.stdout.toString().trimEnd().split(/\r?\n/);
        expect(expected.length).toBe(vectors.length);
        for (const [i, row] of vectors.entries()) expect(run(row), lines[i]).toBe(expected[i]);
    } finally {
        Object.defineProperty(ClientBuild, 'm_mapl', original);
        rmSync(dir, { recursive: true, force: true });
    }
}, 60000);
