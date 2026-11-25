import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import ClientBuild from '#/client/ClientBuild.js';
import Pix3D from '#/dash3d/Pix3D.js';
import { gamepackPath } from './reference.js';

const enum Op {
    Perlin,
    Interpolated,
    Smooth,
    Interpolate,
    Noise,
    Tile
}
type Case = [op: Op, table: number, a: number, b: number, c: number, d: number];
const min = -2147483648;
const max = 2147483647;

function cases(): Case[] {
    const rows: Case[] = [];
    const edges = [min, min + 1, min + 17, -4194304, -2049, -5, -1, 0, 1, 3, 8, 103, 123, 1023, 2048, 4194304, max - 10, max];
    const scales = [min, -1023, -8, -3, -1, 0, 1, 2, 3, 4, 5, 7, 8, 513, 1024, max];
    for (const x of edges) {
        for (const z of edges) {
            for (const table of [0, 1, 2, 3, 4, 5, 6]) {
                rows.push([Op.Perlin, table, x, z, 0, 0]);
                rows.push([Op.Tile, table, x, z, (x >>> 0) % 104, (z >>> 0) % 104]);
            }
            // Neither function reads dc.g even when unloaded.
            rows.push([Op.Noise, 1, z, x, 0, 0], [Op.Smooth, 1, z, x, 0, 0]);
        }
    }

    let state = 0x530;
    function next(): number {
        state = (Math.imul(state, 1664525) + 1013904223) | 0;
        return state;
    }
    for (const scale of scales) {
        for (const fraction of edges) {
            for (let table = 0; table < 7; table++) {
                rows.push([Op.Interpolated, table, scale, fraction, next(), 0]);
                rows.push([Op.Interpolate, table, scale, next(), next(), fraction]);
                rows.push([Op.Interpolate, table, scale, max, min, fraction]);
            }
        }
    }

    for (let i = 0; i < 1024; i++) {
        const x = next(),
            z = next(),
            scale = next(),
            fraction = next();
        rows.push([Op.Perlin, 0, x, z, 0, 0], [Op.Noise, 0, z, x, 0, 0], [Op.Smooth, 0, z, x, 0, 0]);
        rows.push([Op.Interpolated, i % 7, scale, x, z, 0], [Op.Interpolate, i % 7, scale, x, z, fraction]);
    }
    return rows;
}

function table(length: number): Int32Array {
    return Int32Array.from({ length }, (_, i) => {
        switch (i & 3) {
            case 0:
                return min + i;
            case 1:
                return max - i;
            case 2:
                return 65536;
            default:
                return (Math.imul(i, 1664525) + 1013904223) | 0;
        }
    });
}

function result([op, , a, b, c, d]: Case): string {
    try {
        switch (op) {
            case Op.Perlin:
                return String(ClientBuild.PerlinNoise(a, b));
            case Op.Interpolated:
                return String(ClientBuild.InterpolatedNoise(a, b, c));
            case Op.Smooth:
                return String(ClientBuild.SmoothNoise(a, b));
            case Op.Interpolate:
                return String(ClientBuild.Interpolate(a, b, c, d));
            case Op.Noise:
                return String(ClientBuild.Noise(a, b));
            case Op.Tile:
                return String(-8 * ClientBuild.PerlinNoise((932731 + c + a) | 0, (556238 + d + b) | 0));
        }
    } catch (err) {
        if (err instanceof RangeError && err.message === '/ by zero') return 'divide';
        if (err instanceof TypeError && err.message === 'Null array') return 'null';
        if (err instanceof RangeError && /^array index -?\d+$/.test(err.message)) return err.message.slice(6);
        throw err;
    }
}

test('terrain height and its four native noise helpers match the 530 JAR through overflow, table changes and lookup faults', () => {
    const dir = mkdtempSync(join(tmpdir(), '530-terrain-noise-'));
    const oldCos = Pix3D.cosTable;
    try {
        const compile = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game', 'TerrainNoiseOracle.java')]);
        expect(compile.exitCode, compile.stderr.toString()).toBe(0);
        const rows = cases();
        const lines = rows.map(row => row.join(' '));
        const java = Bun.spawnSync(['java', '-XX:-OmitStackTraceInFastThrow', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'TerrainNoiseOracle'], {
            stdin: Buffer.from(lines.join('\n') + '\n'),
            maxBuffer: 4 * 1024 * 1024
        });
        expect(java.exitCode, java.stderr.toString()).toBe(0);
        const expected = java.stdout.toString().trimEnd().split(/\r?\n/);
        expect(expected.length).toBe(rows.length);
        const vanilla = Int32Array.from({ length: 2048 }, (_, i) => (65536 * Math.cos(i * 0.0030679615)) | 0);
        const tables = [vanilla, null, table(0), table(1), table(513), table(1024), table(2048)];
        for (const [i, row] of rows.entries()) {
            Pix3D.cosTable = tables[row[1]];
            expect(result(row), lines[i]).toBe(expected[i]);
        }
    } finally {
        Pix3D.cosTable = oldCos;
        rmSync(dir, { recursive: true, force: true });
    }
}, 30000);
