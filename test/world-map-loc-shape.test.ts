import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Pix2D from '#/graphics/Pix2D.js';
import WorldMap from '#/ui/WorldMap.js';
import WrappedException from '#/util/WrappedException.js';
import { gamepackPath } from './reference.js';

test('world-map shapes match gk clipped pixels, optional background and partial fault writes in the original gamepack', () => {
    // stride, left/top/right/bottom, x/y, tile width/height, destination length
    const geometries = [
        [9, 0, 0, 9, 9, 0, 0, 9, 9, 81],
        [8, 0, 0, 8, 9, 1, 1, 6, 7, 80],
        [13, 3, 2, 9, 8, 0, 1, 10, 9, 108],
        [6, 1, 0, 4, 5, -4, -2, 11, 8, 32],
        [6, 1, 0, 4, 5, 1, 0, 1, 5, 32],
        [6, 1, 0, 4, 5, 1, 2, 3, 1, 32],
        [0, 0, 0, 4, 4, 0, 0, 4, 4, 1],
        [4, 0, 0, 4, 4, 0, 0, 4, 4, 5],
        [4, 0, 0, 4, 4, 0, 0, 4, 4, 0],
        [4, 0, 0, 4, 4, 0, 0, 4, 4, -1],
        [4, -4, -2, 4, 4, -4, -2, 8, 6, 9],
        [-4, 0, 0, 4, 4, 0, 0, 4, 4, 6],
        [4, -10, -5, -4, -1, -9, -3, 2, 1, -1],
        [4, 1, 1, 8, 8, 8, 2, 1, 1, -1],
        [5, 2, 2, 5, 5, 1, 1, 1, 5, -1],
        [5, 2, 2, 5, 5, 3, 3, 0, 1, -1],
        [5, 2, 2, 5, 5, 2, 5, 1, 9, -1],
        [5, 2, 2, 5, 5, 3, 1, 1, 1, -1],
        [5, 1, 1, 5, 5, 1, 1, -2, -3, -1],
        [0x40000000, 0, 4, 3, 7, 0, 4, 3, 3, 3],
        [1, 0, 0, 0x7fffffff, 1, 0x7ffffffe, 0, 4, 1, -1],
        [1, 0, 0, 2, 0x7fffffff, 0, 0x7ffffffe, 1, 5, -1]
    ];
    const rows: number[][] = [];
    for (const [stride, left, top, right, bottom, x, y, width, height, length] of geometries) {
        for (const shape of [-1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
            for (const rotation of [-1, 0, 1, 2, 3, 4, 0x7fffffff]) {
                for (const background of [0, 1]) rows.push([stride, left, top, right, bottom, x, y, width, height, shape, rotation, background, length, rows.length & 1]);
            }
        }
    }
    const dir = mkdtempSync(join(tmpdir(), 'rs530-map-shape-'));
    let lines: string[];
    try {
        const compile = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game', 'WorldMapLocShapeOracle.java')]);
        expect(compile.exitCode, compile.stderr.toString()).toBe(0);
        const run = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'WorldMapLocShapeOracle'], {
            stdin: Buffer.from(rows.map(row => row.join(' ')).join('\n') + '\n'),
            maxBuffer: 4 * 1024 * 1024,
            timeout: 20000
        });
        expect(run.exitCode, run.stderr.toString()).toBe(0);
        lines = run.stdout.toString().trimEnd().split(/\r?\n/);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
    expect(lines).toHaveLength(rows.length);
    const saved = { width: Pix2D.width, clipMinX: Pix2D.clipMinX, clipMinY: Pix2D.clipMinY, clipMaxX: Pix2D.clipMaxX, clipMaxY: Pix2D.clipMaxY, pixels: Pix2D.pixels };
    try {
        for (const [i, row] of rows.entries()) {
            const [stride, left, top, right, bottom, x, y, width, height, shape, rotation, paint, length, colours] = row;
            const foreground = colours === 0 ? 0x12345678 : 0,
                background = colours === 0 ? 0x87654321 | 0 : -1;
            Object.assign(Pix2D, { width: stride, clipMinX: left, clipMinY: top, clipMaxX: right, clipMaxY: bottom, pixels: Int32Array.of(0x31415926) });
            const pixels = length < 0 ? null : new Int32Array(length).fill(0x778855);
            let error = '-';
            try {
                WorldMap.drawLocShape(foreground, shape, width, paint !== 0, background, x, rotation, pixels, height, y);
            } catch (e) {
                if (!(e instanceof WrappedException)) throw e;
                const type = e.cause instanceof RangeError ? 'bounds' : e.cause instanceof TypeError ? 'null' : e.cause?.name;
                error = e.context + '/' + type;
            }
            const rendered = pixels === null ? '-' : Array.from(pixels, p => (p === foreground ? 'f' : p === background ? 'b' : p === 0x778855 ? '.' : '?')).join('');
            expect(error + '|' + rendered + '|' + Pix2D.pixels?.[0], row.join(' ')).toBe(lines[i]);
        }
    } finally {
        Object.assign(Pix2D, saved);
    }
}, 25000);
