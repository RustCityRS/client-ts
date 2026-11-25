import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import ClientBuild from '#/client/ClientBuild.js';
import WrappedException from '#/util/WrappedException.js';
import OrbitCamera from '#/client/OrbitCamera.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import RoofModeStatics from '#/dash3d/RoofModeStatics.js';
import world from '#/dash3d/world.js';
import Preferences from '#/ui/Preferences.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { gamepackPath } from './reference.js';
import { loginFixture } from './login-fixture.js';

type Case = [mode: number, level: number, camera: number, pitch: number, cx: number, cz: number, px: number, pz: number, hitX: number, hitZ: number, stamp: number, ground: number, cameraY: number, fault: number];

function vectors(): Case[] {
    const rows: Case[] = [];
    // Probe every potentially traversed tile, including the half-step tie in every octant.
    for (let dx = -4; dx <= 4; dx++)
        for (let dz = -4; dz <= 4; dz++) {
            for (let x = 5 + Math.min(0, dx); x <= 5 + Math.max(0, dx); x++) for (let z = 6 + Math.min(0, dz); z <= 6 + Math.max(0, dz); z++) rows.push([2, 0, 1, 309, 5, 6, 5 + dx, 6 + dz, x, z, 312, 12, 15, 0]);
            rows.push([2, 2, 1, 310, 5, 6, 5 + dx, 6 + dz, 5 + dx, 6 + dz, 711, 99, 2, 0]);
        }
    for (const stamp of [-2147483648, -105, -104, -1, 0, 1, 3, 4, 103, 104, 255, 256, 2147483647]) for (const mode of [0, 1, 2, 3]) for (const level of [-1, 0, 2, 3, 4]) rows.push([mode, level, 1, 20, 0, 0, 2, 2, 1, 1, stamp, 0, 0, 0]);
    for (let fault = 0; fault <= 21; fault++)
        for (const level of [0, 2, 3])
            for (const [camera, pitch] of [
                [0, 0],
                [1, 0],
                [1, 310],
                [2, 310]
            ])
                rows.push([2, level, camera, pitch, 5, 6, 8, 10, 5, 6, 104, 1750, 1000, fault]);
    for (const [x, z, px, pz] of [
        [0, 0, 0, 0],
        [103, 103, 0, 0],
        [0, 103, 103, 0],
        [-1, 6, 0, 7],
        [5, 104, 7, 7],
        [-12000000, 7, 1, 4],
        [5, 2, 7, -1]
    ])
        for (const camera of [0, 1]) for (const pitch of [309, 310]) rows.push([2, 0, camera, pitch, x, z, px, pz, 7, 7, 15, 15, 0, 0]);
    for (const [height, eye] of [
        [799, 0],
        [800, 0],
        [801, 0],
        [-2147483648, 2147483647],
        [2147483647, -2147483648],
        [104000, 103201],
        [104000, 103200]
    ])
        for (const camera of [-1, 0, 2, 3]) for (const fault of [0, 16, 20]) rows.push([2, 2, camera, 0, 5, 6, 8, 10, 5, 6, 5, height, eye, fault]);
    return rows;
}

loginFixture(
    import.meta.url,
    'selective roof frames match the JAR stamp writes, bound resets, camera ray and flood queue calls',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), '530-roof-frame-'));
        try {
            const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
            const compile = Bun.spawnSync(['javac', asm, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game/RoofFrameOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const command = ['java', asm, '-XX:-OmitStackTraceInFastThrow', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'RoofFrameOracle'];
            const prepare = Bun.spawnSync([...command, gamepackPath, dir]);
            expect(prepare.exitCode, prepare.stderr.toString()).toBe(0);
            const rows = vectors(),
                lines = rows.map(row => row.join(' '));
            const java = Bun.spawnSync(command, { stdin: Buffer.from(lines.join('\n') + '\n'), timeout: 30000, maxBuffer: 4 * 1024 * 1024 });
            expect(java.exitCode, java.stderr.toString()).toBe(0);
            const expected = java.stdout.toString().trimEnd().split(/\r?\n/);
            expect(expected.length).toBe(rows.length);
            let marks = 0,
                reads = 0,
                hash = 1;
            function record(a: number, b: number, c: number, d: number): void {
                hash = (Math.imul((Math.imul((Math.imul((Math.imul(hash, 31) + a) | 0, 31) + b) | 0, 31) + c) | 0, 31) + d) | 0;
            }
            function watched(row: Uint8Array, id: number, flags: boolean): Uint8Array {
                return new Proxy(row, {
                    get(target, key) {
                        const value = Reflect.get(target, key, target);
                        if (flags && key !== 'length') {
                            reads++;
                            record(2, id, Number(key), value);
                        }
                        return value;
                    },
                    set(target, key, value) {
                        const ok = Reflect.set(target, key, value, target);
                        if (ok && !flags) {
                            marks++;
                            record(1, id, Number(key), value & 255);
                        }
                        return ok;
                    }
                });
            }
            const rawFlags = Array.from({ length: 4 }, () => Array.from({ length: 104 }, () => new Uint8Array(104)));
            const watchedFlags = rawFlags.map((plane, p) => plane.map((row, x) => watched(row, p * 104 + x, true)));
            const blank = Array.from({ length: 4 }, (_, p) => Array.from({ length: 104 }, (_, x) => watched(new Uint8Array(104), p * 104 + x, false)));
            const player = new ClientPlayer(),
                squares = [[[null]]];
            for (const [i, [mode, level, camMode, pitch, x, z, px, pz, hx, hz, stamp, height, camY, fault]] of rows.entries()) {
                marks = reads = 0;
                hash = 1;
                const calls: string[] = [];
                Preferences.allLevelsVisible = mode !== 1;
                Preferences.removeRoofsSelectively = mode !== 3;
                RoofModeStatics.roofRemovalDisabled = mode === 0;
                Client.playerLevel = level;
                OrbitCamera.mode = camMode;
                OrbitCamera.pitch = pitch;
                RoofModeStatics.markStamp = stamp;
                OrbitCamera.x = (x * 128 + 35) | 0;
                OrbitCamera.z = (z * 128 + 19) | 0;
                OrbitCamera.y = camY;
                Client.localPlayer = player;
                player.x = (px * 128 + 77) | 0;
                player.z = (pz * 128 + 14) | 0;
                world.squares = squares;
                const column = ((stamp % 104) + 104) % 104;
                const marked = blank.map(plane => plane.slice()),
                    flags = watchedFlags.map(plane => plane.slice());
                RoofModeStatics.roofMarks = marked;
                ClientBuild.m_mapl = flags;
                for (const plane of rawFlags) {
                    if (hx >= 0 && hx < 104 && hz >= 0 && hz < 104) plane[hx][hz] = 4;
                    if (fault >= 18 && px >= 0 && px < 104 && pz >= 0 && pz < 104) plane[px][pz] = 4;
                }
                const bounds: (Int32Array | null)[] = Array.from({ length: 5 }, (_, n) => Int32Array.of(111 + n, 222 + n, 333 + n));
                switch (fault) {
                    case 1:
                        RoofModeStatics.roofMarks = null;
                        break;
                    case 2:
                        Reflect.set(RoofModeStatics, 'roofMarks', [blank[0], null]);
                        break;
                    case 3:
                        marked[2] = [];
                        break;
                    case 4:
                        Reflect.set(marked[1], column, null);
                        break;
                    case 5:
                        marked[2][column] = watched(new Uint8Array(47), 2 * 104 + column, false);
                        break;
                    case 6:
                    case 7:
                    case 8:
                    case 9:
                    case 10:
                        bounds[fault - 6] = null;
                        break;
                    case 11:
                    case 12:
                    case 13:
                    case 14:
                    case 15:
                        bounds[fault - 11] = Int32Array.of(17);
                        break;
                    case 16:
                        ClientBuild.m_mapl = null;
                        break;
                    case 17:
                        Client.localPlayer = null;
                        break;
                    case 21:
                        if (px >= 0 && px < 104) flags[level & 3][px] = new Uint8Array(0);
                        break;
                }
                [RoofModeStatics.roofMaxY, RoofModeStatics.roofMinX, RoofModeStatics.roofMaxX, RoofModeStatics.hideMinZ, RoofModeStatics.roofMaxZ] = bounds;
                Client.GetAvH = (fx, fz, p) => {
                    calls.push('h' + [p, fx, fz].join(','));
                    if (fault === 20) {
                        OrbitCamera.x = 8 * 128;
                        OrbitCamera.z = 9 * 128;
                        Client.playerLevel = 1;
                        OrbitCamera.y = (height - 799) | 0;
                        rawFlags[1][8][9] = 4;
                    }
                    return height;
                };
                Reflect.set(RoofModeStatics, 'floodRoof', (rebuild: boolean, tz: number, slot: number, grid: unknown, tx: number) => {
                    calls.push([+rebuild, tz, slot, grid === squares ? 1 : 0, tx].join(','));
                    if (fault === 18 && slot === 0) {
                        OrbitCamera.x = 7 * 128;
                        OrbitCamera.z = 9 * 128;
                        requireNonNull(Client.localPlayer).x = 11 * 128;
                        requireNonNull(Client.localPlayer).z = 10 * 128;
                        Client.playerLevel = 1;
                        world.squares = null;
                        rawFlags[1][8][9] = 4;
                    }
                    if (fault === 19) throw new Error('probe');
                    return false;
                });
                let result = 'ok';
                try {
                    RoofModeStatics.updateRoofs();
                } catch (caught) {
                    let error = caught;
                    while (error instanceof WrappedException) error = error.cause;
                    if (error instanceof TypeError && error.message.startsWith('Null ')) result = 'null';
                    else if (error instanceof RangeError && error.message === '/ by zero') result = 'divide';
                    else if (error instanceof RangeError && /^array index -?\d+$/.test(error.message)) result = 'index' + error.message.slice(12);
                    else if (error instanceof Error && error.message === 'probe') result = 'probe';
                    else throw error;
                }
                for (const plane of rawFlags) {
                    if (hx >= 0 && hx < 104 && hz >= 0 && hz < 104) plane[hx][hz] = 0;
                    if (px >= 0 && px < 104 && pz >= 0 && pz < 104) plane[px][pz] = 0;
                }
                rawFlags[1][8][9] = 0;
                const bs = bounds.map(b => (b === null ? '-' : '[' + b.join(',') + ']')).join(';');
                expect([result, marks, reads, hash].join(' ') + '|' + bs + '|' + calls.join(';'), lines[i]).toBe(expected[i]);
            }
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    60000
);
