import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import RegionRotate from '#/util/RegionRotate.js';
import { gamepackPath } from './reference.js';

type Case = [x: number, z: number, width: number, length: number, locAngle: number, rotation: number, next: number, selector: number];

function cases(): Case[] {
    const rows: Case[] = [];
    for (let x = 0; x < 8; x++) {
        for (let z = 0; z < 8; z++) {
            for (const [width, length] of [
                [1, 1],
                [1, 4],
                [3, 1],
                [2, 5]
            ]) {
                for (let locAngle = 0; locAngle < 4; locAngle++) {
                    for (let rotation = 0; rotation < 4; rotation++) {
                        for (let next = 0; next < 4; next++) {
                            rows.push([x, z, width, length, locAngle, rotation, next, 2]);
                        }
                    }
                }
            }
        }
    }

    const extremes = [-2147483648, -2147483647, -1, 0, 1, 7, 8, 2147483646, 2147483647];
    for (const x of extremes) {
        for (const z of extremes) {
            for (const rotation of extremes) {
                rows.push([x, z, x, z, z, rotation, ~rotation, 2]);
                rows.push([x, z, z, x, x, rotation, ~z, rotation & 3]);
            }
        }
    }
    let seed = 530;
    function int(): number {
        seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
        return seed;
    }
    for (let i = 0; i < 1024; i++) {
        rows.push([int(), int(), int(), int(), int(), int(), int(), i & 3]);
    }
    return rows;
}

// Rotate all four occupied corner tiles, then take their minimum x and z.
function footprintOrigin(x: number, z: number, width: number, length: number, locAngle: number, rotation: number): number[] {
    const farX = x + ((locAngle & 1) === 0 ? width : length) - 1;
    const farZ = z + ((locAngle & 1) === 0 ? length : width) - 1;
    let minX = Infinity;
    let minZ = Infinity;
    for (const cx of [x, farX]) {
        for (const cz of [z, farZ]) {
            const [rx, rz] = [
                [cx, cz],
                [cz, 7 - cx],
                [7 - cx, 7 - cz],
                [7 - cz, cx]
            ][rotation];
            minX = Math.min(minX, rx);
            minZ = Math.min(minZ, rz);
        }
    }
    return [minX, minZ];
}

test('region rotations and composed location footprints match the 530 JAR', () => {
    const folder = mkdtempSync(join(tmpdir(), '530-region-rotate-'));
    try {
        const javac = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', folder, join(import.meta.dir, 'game', 'RegionRotateOracle.java')]);
        expect(javac.exitCode, javac.stderr.toString()).toBe(0);
        const rows = cases();
        const input = rows.map(row => row.join(' '));
        const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', folder + delimiter + gamepackPath, 'RegionRotateOracle'], {
            stdin: Buffer.from(input.join('\n') + '\n'),
            maxBuffer: 8 * 1024 * 1024
        });
        expect(java.exitCode, java.stderr.toString()).toBe(0);
        const expected = java.stdout.toString().trimEnd().split(/\r?\n/);
        expect(expected.length).toBe(rows.length);
        for (const [i, [x, z, width, length, locAngle, rotation, next, selector]] of rows.entries()) {
            const tileX = RegionRotate.RegionRotateX(rotation, selector, z, x);
            const tileZ = RegionRotate.RegionRotateZ(rotation, z, x);
            const locX = RegionRotate.RegionRotateLocationX(z, x, length, locAngle, width, rotation);
            const locZ = RegionRotate.RegionRotateLocationZ(rotation, width, z, length, locAngle, x);
            const placedAngle = (locAngle + rotation) & 3;
            const nextTileX = RegionRotate.RegionRotateX(next, 2, tileZ, tileX);
            const nextTileZ = RegionRotate.RegionRotateZ(next, tileZ, tileX);
            const nextLocX = RegionRotate.RegionRotateLocationX(locZ, locX, length, placedAngle, width, next);
            const nextLocZ = RegionRotate.RegionRotateLocationZ(next, width, locZ, length, placedAngle, locX);
            expect([tileX, tileZ, locX, locZ, nextTileX, nextTileZ, nextLocX, nextLocZ].join(' '), input[i]).toBe(expected[i]);

            const total = (rotation + next) & 3;
            if (selector === 2) {
                expect([nextTileX, nextTileZ], input[i]).toEqual([RegionRotate.RegionRotateX(total, 2, z, x), RegionRotate.RegionRotateZ(total, z, x)]);
            }
            expect([nextLocX, nextLocZ], input[i]).toEqual([RegionRotate.RegionRotateLocationX(z, x, length, locAngle, width, total), RegionRotate.RegionRotateLocationZ(total, width, z, length, locAngle, x)]);
            if (x >= 0 && x < 8 && z >= 0 && z < 8 && width > 0 && width <= 8 && length > 0 && length <= 8) {
                expect([locX, locZ], input[i]).toEqual(footprintOrigin(x, z, width, length, locAngle, rotation & 3));
            }
        }
    } finally {
        rmSync(folder, { recursive: true, force: true });
    }
}, 30000);
