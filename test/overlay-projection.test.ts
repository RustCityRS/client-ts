import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import ClientBuild from '#/client/ClientBuild.js';
import OrbitCamera from '#/client/OrbitCamera.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';

import world from '#/dash3d/world.js';
import { gamepackPath } from './reference.js';

function terrain(mode: number): void {
    if (mode === 2) {
        world.levelHeightmaps = null;
    } else {
        world.levelHeightmaps = Array.from({ length: 4 }, (_, p) =>
            Array.from({ length: 105 }, (_, x) => Int32Array.from({ length: 105 }, (_, z) => (mode === 1 ? ((Math.imul(x, 1664525) ^ Math.imul(z, 1013904223)) + Math.imul(p, 1515870810)) | 0 : p * 240 + x * 3 - z * 5)))
        );
    }
    ClientBuild.m_mapl = mode === 3 ? null : Array.from({ length: 4 }, () => Array.from({ length: 104 }, (_, x) => Uint8Array.from({ length: 104 }, (_, z) => (((x + z) & 1) === 0 ? 2 : 0))));
    if (mode === 4 && world.levelHeightmaps) Reflect.set(world.levelHeightmaps[0], 2, null);
}

function run(f: () => void | number): string {
    try {
        return String(f() ?? 'ok');
    } catch {
        return 'error';
    }
}

test('ground heights, actor and point overlay projections match the SD JAR across clipping and signed-int edge cases', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rs530-projection-'));
    const saved = [OrbitCamera.x, OrbitCamera.y, OrbitCamera.z, OrbitCamera.pitch, OrbitCamera.yaw, Client.playerLevel, Client.projectX, Client.projectY];
    const heights = world.levelHeightmaps,
        flags = ClientBuild.m_mapl;
    try {
        const compile = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game/OverlayProjectionOracle.java')]);
        expect(compile.stderr.toString()).toBe('');
        const rows: number[][] = [];
        let seed = 597;
        const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) | 0);
        const edges = [-1, 0, 127, 128, 129, 255, 256, 257, 383, 1024, 13055, 13056, 13057, 13311, 13312, -2147483648, 2147483647];
        for (let mode = 0; mode < 5; mode++) {
            for (let i = 0; i < 650; i++) {
                const x = i < 120 ? edges[i % edges.length] : 128 + ((random() >>> 0) % 12929);
                const z = i < 120 ? edges[(i * 7 + 3) % edges.length] : 128 + ((random() >>> 0) % 12929);
                const depth = [49, 50, 51, 0, -40, 1600, -2147483648, 2147483647][i & 7];
                rows.push([
                    mode,
                    x,
                    z,
                    i & 1 ? random() : 25,
                    random(),
                    random(),
                    i & 1 ? random() : (x - 19) | 0,
                    i & 1 ? random() : -76,
                    (z - depth) | 0,
                    i % 19 === 0 ? -1 : i % 2 ? random() & 2047 : 0,
                    i % 17 === 0 ? 2048 : i % 2 ? random() & 2047 : 0,
                    i % 13 === 0 ? -1 : i % 11 === 0 ? 4 : i & 3
                ]);
            }
        }
        const bytes = Buffer.alloc(4 * (1 + rows.length * 12));
        bytes.writeInt32BE(rows.length);
        let offset = 4;
        for (const row of rows)
            for (const field of row) {
                bytes.writeInt32BE(field, offset);
                offset += 4;
            }
        const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'OverlayProjectionOracle'], { stdin: bytes });
        expect(java.stderr.toString()).toBe('');
        expect(java.exitCode).toBe(0);
        const expected = java.stdout.toString().trim().split(/\r?\n/);
        const actor = new ClientPlayer();
        let last = -1;
        for (const [i, r] of rows.entries()) {
            const [mode, x, z, height, cx, cy] = r;
            if (mode !== last) {
                terrain(mode);
                last = mode;
            }
            [OrbitCamera.x, OrbitCamera.y, OrbitCamera.z, OrbitCamera.pitch, OrbitCamera.yaw, Client.playerLevel] = r.slice(6);
            const fields: (string | number)[] = [run(() => Client.GetAvH(x, z, Client.playerLevel))];
            Client.projectX = -567;
            Client.projectY = 912;
            fields.push(
                run(() => Client.GetOverlayPos2(cy, z, height, cx, x)),
                Client.projectX,
                Client.projectY
            );
            Client.projectX = -567;
            Client.projectY = 912;
            actor.x = x;
            actor.z = z;
            fields.push(
                run(() => Client.GetOverlayPos(cy, cx, height, actor)),
                Client.projectX,
                Client.projectY
            );
            expect(fields.join(' ')).toBe(expected[i]);
        }
        expect(expected).toHaveLength(rows.length);
    } finally {
        [OrbitCamera.x, OrbitCamera.y, OrbitCamera.z, OrbitCamera.pitch, OrbitCamera.yaw, Client.playerLevel, Client.projectX, Client.projectY] = saved;
        world.levelHeightmaps = heights;
        ClientBuild.m_mapl = flags;
        rmSync(dir, { recursive: true, force: true });
    }
});
