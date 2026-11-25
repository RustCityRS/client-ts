import { expect } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import ClientBuild from '#/client/ClientBuild.js';
import world from '#/dash3d/world.js';
import WrappedException from '#/util/WrappedException.js';
import { gamepackPath } from './reference.js';
import { loginFixture } from './login-fixture.js';

function terrain(size: number, seed: number) {
    return Array.from({ length: 4 }, (_, l) => Array.from({ length: size }, (_, x) => Int32Array.from({ length: size }, (_, z) => (Math.imul(l + seed, 0x71234567) + Math.imul(x, 0x445f7e3) - Math.imul(z, 0x59f23bc1)) ^ (seed * 1237 + x + z))));
}
function run([level, fineX, fineZ, bits, mode, at, guard = -71]: number[], observed: boolean) {
    const tileX = fineX >> 7,
        tileZ = fineZ >> 7;
    const size = (tileX >= 4 && tileX <= 103) || (tileZ >= 4 && tileZ <= 103) ? 105 : 5;
    const x = Math.max(0, Math.min(size - 2, tileX)),
        z = Math.max(0, Math.min(size - 2, tileZ));
    const p = Math.max(0, Math.min(3, level < 3 && (bits & 2) !== 0 ? level + 1 : level));
    const first = terrain(size, 31),
        replacement = terrain(size, -17);
    const flags = Array.from({ length: 2 }, () => Array.from({ length: size }, () => new Uint8Array(size)));
    flags[1][x][z] = bits;
    let heights: Int32Array[][] | null = first,
        bridge: Uint8Array[][] | null = flags;
    switch (mode) {
        case 21:
            heights = null;
            break;
        case 22:
            heights = [];
            break;
        case 23:
            Reflect.set(first, p, null);
            break;
        case 24:
            first[p] = new Array(x).fill(null);
            break;
        case 25:
            Reflect.set(first[p], x + 1, null);
            break;
        case 26:
            first[p][x + 1] = new Int32Array(z + 1);
            break;
        case 27:
            first[p][x] = new Int32Array(z + 1);
            break;
        case 28:
            bridge = null;
            break;
        case 29:
            bridge = [[]];
            break;
        case 30:
            Reflect.set(flags, 1, null);
            break;
        case 31:
            flags[1] = new Array(x).fill(null);
            break;
        case 32:
            Reflect.set(flags[1], x, null);
            break;
        case 33:
            flags[1][x] = new Uint8Array(z);
            break;
    }
    let step = 0;
    const trace: string[] = [],
        failure = new Error('height observation');
    function touch(label: string) {
        trace.push(label);
        if (++step !== at) return;
        switch (mode) {
            case 1:
                heights = replacement;
                break;
            case 2:
                first[p] = replacement[p];
                break;
            case 3:
                first[p][x] = replacement[p][x];
                first[p][x + 1] = replacement[p][x + 1];
                break;
            case 4:
                first[p][x] = replacement[p][x];
                break;
            case 5:
                first[p][x + 1] = replacement[p][x + 1];
                break;
            case 6:
                heights = null;
                break;
            case 7:
                Reflect.set(first, p, null);
                break;
            case 8:
                Reflect.set(first[p], x, null);
                break;
            case 9:
                first[p][x + 1] = new Int32Array(z);
                break;
            case 10:
                heights = [];
                break;
            case 11:
                flags[1][x][z] ^= 2;
                break;
            case 12:
                bridge = null;
                break;
            case 13:
                throw failure;
            case 14:
                first[p][x][z + 1] = -2147483648;
                break;
        }
    }
    // Record completed array reads, letting arrayAt itself fault on a negative
    // index, a short array or a null parent before the read is observed.
    function watchArray(raw: unknown, levels: string): unknown {
        if (raw === null || typeof raw !== 'object' || levels.length === 0) return raw;
        return new Proxy(raw, {
            get(target, prop) {
                const value = Reflect.get(target, prop, target);
                if (typeof prop !== 'string' || !/^\d+$/.test(prop)) return value;
                touch(levels[0] + prop + (levels.length === 1 ? '=' + value : ''));
                return watchArray(value, levels.slice(1));
            }
        });
    }
    Object.defineProperty(world, 'levelHeightmaps', {
        configurable: true,
        get() {
            const current = heights;
            if (!observed) return current;
            touch('H');
            return watchArray(current, 'PRV');
        }
    });
    Object.defineProperty(ClientBuild, 'm_mapl', {
        configurable: true,
        get() {
            const current = bridge;
            if (!observed) return current;
            touch('F');
            return watchArray(current, 'BCT');
        }
    });
    let status: string,
        context: string | null = '';
    try {
        status = 'v' + Client.GetAvH(fineX, fineZ, level, guard);
    } catch (error) {
        if (error instanceof WrappedException) context = error.context;
        const e = error instanceof WrappedException ? error.cause : error;
        if (e === failure) status = 'probe';
        else if (e instanceof TypeError) status = 'null';
        else if (e instanceof RangeError && e.message.startsWith('array index ')) status = 'bounds:' + e.message.slice(12);
        else if (e instanceof RangeError && e.message === '/ by zero') status = 'arithmetic';
        else throw e;
    }
    return status + '|' + context + '|' + trace.join(';');
}

loginFixture(
    import.meta.url,
    'GetAvH matches each bridge and terrain corner read in the 530 gamepack',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-getavh-')),
            probe = join(dir, 'observed');
        try {
            const flags = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED'];
            const compile = Bun.spawnSync(['javac', ...flags, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game/GetAvHOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const cp = dir + delimiter + gamepackPath;
            mkdirSync(probe);
            const instrument = Bun.spawnSync(['java', ...flags, '-cp', cp, 'GetAvHOracle', gamepackPath, probe]);
            expect(instrument.exitCode, instrument.stderr.toString()).toBe(0);
            for (const observed of [false, true]) {
                const rows: number[][] = [];
                for (let guard = -128; guard <= 127; guard++) {
                    rows.push([0, 311, 453, 2, 0, 0, guard], [3, 311, 453, 0, 22, 0, guard], [1, 311, 453, 0, 28, 0, guard], [0, 311, 453, 2, 21, 0, guard], [3, -1, 453, 0, 28, 0, guard]);
                }
                if (!observed) {
                    for (const level of [-2147483648, -1, 0, 2, 3, 4, 2147483647])
                        for (const bits of [0, 2, 255]) {
                            for (const [x, z] of [
                                [-1, -1],
                                [0, 0],
                                [1, 127],
                                [511, 511],
                                [13185, 13311],
                                [13311, 13311],
                                [13312, 0],
                                [13, -128],
                                [2147483647, -2147483648]
                            ])
                                rows.push([level, x, z, bits, 0, 0]);
                            for (let mode = 21; mode <= 33; mode++) rows.push([level, 287, 331, bits, mode, 0]);
                        }
                    for (const dx of [0, 1, 2, 7, 16, 39, 63, 64, 79, 108, 126, 127]) for (const dz of [0, 1, 13, 49, 64, 87, 121, 126, 127]) rows.push([1, 256 + dx, 128 + dz, 2, 0, 0]);
                } else {
                    for (const [level, bits] of [
                        [1, 0],
                        [1, 2],
                        [3, 255]
                    ])
                        for (let mode = 1; mode <= 14; mode++) for (let step = 1; step <= 21; step++) rows.push([level, 311, 453, bits, mode, step]);
                    for (const level of [-1, 0, 3, 4]) for (let mode = 21; mode <= 33; mode++) rows.push([level, 311, 453, 2, mode, 0]);
                    for (const [x, z] of [
                        [-1, 0],
                        [13312, 0],
                        [0, -1],
                        [0, 13312]
                    ])
                        rows.push([0, x, z, 0, 0, 0]);
                }
                const wire = rows.map(row => row.join(' '));
                const java = Bun.spawnSync(['java', '-Xmx384m', '-XX:-OmitStackTraceInFastThrow', ...flags, '-cp', observed ? probe + delimiter + cp : cp, 'GetAvHOracle'], {
                    stdin: Buffer.from(wire.join('\n') + '\n'),
                    maxBuffer: 4 * 1024 * 1024
                });
                expect(java.exitCode, java.stderr.toString()).toBe(0);
                const lines = java.stdout.toString().trimEnd().split(/\r?\n/);
                expect(lines.length).toBe(rows.length);
                for (const [i, row] of rows.entries()) expect(run(row, observed), wire[i]).toBe(lines[i]);
            }
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    45000
);
