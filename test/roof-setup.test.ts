import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import ClientBuild from '#/client/ClientBuild.js';
import RoofModeStatics from '#/dash3d/RoofModeStatics.js';
import world from '#/dash3d/world.js';
import Preferences from '#/ui/Preferences.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { loginFixture } from './login-fixture.js';
import { gamepackPath } from './reference.js';

function hash(values: Int32Array | Uint8Array | null): number {
    if (values === null) return 0;
    let sum = 1;
    for (const v of values) sum = (Math.imul(sum, 31) + (values instanceof Uint8Array ? (v << 24) >> 24 : v)) | 0;
    return sum;
}

function marksHash(marks: Uint8Array[][] | null): number {
    if (marks === null) return 0;
    let sum = 1;
    for (const plane of marks) {
        let part = 1;
        for (const row of plane) part = (Math.imul(part, 31) + hash(row)) | 0;
        sum = (Math.imul(sum, 31) + part) | 0;
    }
    return sum;
}

function trace([scenario, layout, mode, stamp, operation]: number[]): string {
    RoofModeStatics.roofRemovalDisabled = mode === 0;
    Preferences.allLevelsVisible = mode !== 3;
    Preferences.removeRoofsSelectively = mode === 2 || mode === 3;
    RoofModeStatics.markStamp = stamp;
    Client.playerLevel = scenario % 4;
    world.squares = Array.from({ length: 4 }, () => Array.from({ length: 104 }, () => Array(104).fill(null)));
    ClientBuild.m_mapl = Array.from({ length: 4 }, () => Array.from({ length: 104 }, (_, x) => Uint8Array.from({ length: 104 }, (_, z) => (x % 3 === 1 && z % 3 === 1 ? 4 : 0))));
    world.levelHeightmaps = Array.from({ length: 4 }, (_, p) => Array.from({ length: 105 }, (_, x) => Int32Array.from({ length: 105 }, (_, z) => z * 7 - x * 9 - p * 240)));
    const previous = layout === 0 ? null : Array.from({ length: 4 }, () => Array.from({ length: 104 }, () => new Uint8Array(104).fill(69)));
    if (previous !== null) {
        if (layout === 2) previous[1][13] = Uint8Array.of(88, -23);
        if (layout === 3) Reflect.set(previous[2], 8, null);
        if (layout === 4) previous[1] = previous[0];
    }
    RoofModeStatics.roofMarks = previous;
    RoofModeStatics.hideMinZ = world.roofHideMinZ = Int32Array.of(1, 2);
    RoofModeStatics.roofMaxZ = world.roofHideMaxZ = Int32Array.of(3, 4);
    RoofModeStatics.roofMinX = world.roofMinX = Int32Array.of(5, 6);
    RoofModeStatics.roofMaxX = world.hideAreaMaxX = Int32Array.of(7, 8);
    RoofModeStatics.roofMaxY = world.hiddenRoofY = Int32Array.of(9, 10);
    let result = 'ok';
    try {
        if (operation === 0) RoofModeStatics.applyRoofMode();
        else if (operation === 1) {
            RoofModeStatics.applyRoofMode();
            RoofModeStatics.roofRemovalDisabled = false;
            Preferences.allLevelsVisible = true;
            Preferences.removeRoofsSelectively = true;
            RoofModeStatics.markStamp = (RoofModeStatics.markStamp + 1) | 0;
            RoofModeStatics.applyRoofMode();
        } else if (operation === 2) RoofModeStatics.fillRoofMarks(stamp);
        else RoofModeStatics.allocRoofBounds(-1);
    } catch (error) {
        if (error instanceof TypeError) result = 'null';
        else if (error instanceof RangeError) result = operation === 3 ? 'negative' : 'bounds';
        else throw error;
    }
    const bounds = [RoofModeStatics.hideMinZ, RoofModeStatics.roofMaxZ, RoofModeStatics.roofMinX, RoofModeStatics.roofMaxX, RoofModeStatics.roofMaxY];
    const drawn = [world.roofHideMinZ, world.roofHideMaxZ, world.roofMinX, world.hideAreaMaxX, world.hiddenRoofY];
    const out = [result, Number(RoofModeStatics.roofMarks === previous), marksHash(RoofModeStatics.roofMarks), marksHash(previous)];
    for (const [i, value] of bounds.entries()) {
        out.push(requireNonNull(value).length, hash(value), Number(value === drawn[i]), hash(drawn[i]));
    }
    return out.join('/');
}

loginFixture(
    import.meta.url,
    'roof setup retains original mark writes, area bounds and scene-draw references across mode changes',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), '530-roof-setup-'));
        try {
            const compile = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game/RoofSetupOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const rows: number[][] = [];
            const stamps = [-2147483648, -1, 0, 3, 4, 127, 256, 2147483647];
            for (let layout = 0; layout < 5; layout++) {
                for (let mode = 0; mode < 4; mode++) {
                    for (let op = 0; op < 4; op++) {
                        for (let p = 0; p < 4; p++) rows.push([p, layout, mode, stamps[(layout + mode + p + op) % 8], op]);
                    }
                }
            }
            const java = Bun.spawnSync(['java', '-Xmx256m', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'RoofSetupOracle'], { stdin: Buffer.from(rows.map(row => row.join(' ')).join('\n') + '\n'), timeout: 40000 });
            expect(java.exitCode, java.stderr.toString()).toBe(0);
            const lines = java.stdout.toString().trimEnd().split(/\r?\n/);
            expect(lines.length).toBe(rows.length);
            for (const [i, row] of rows.entries()) expect(trace(row), row.join(' ')).toBe(lines[i]);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    90000
);
