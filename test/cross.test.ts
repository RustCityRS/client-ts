import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import Pix2D from '#/graphics/Pix2D.js';
import Pix32 from '#/graphics/Pix32.js';
import SpriteLoader from '#/graphics/SpriteLoader.js';
import Minimenu from '#/ui/Minimenu.js';
import { gamepackPath } from './reference.js';

test('crosshair frames, clipping and restricted chat areas follow qa.a in the original client', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rs530-cross-'));
    const raster = { ...Pix2D },
        menu = { ...Minimenu },
        state = { localPlayer: Client.localPlayer, mapBuildBaseX: Client.mapBuildBaseX, mapBuildBaseZ: Client.mapBuildBaseZ },
        cross = SpriteLoader.cross,
        area = Client.withinTutorialIsland;
    try {
        const build = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game', 'CrossOracle.java')]);
        expect(build.exitCode, build.stderr.toString()).toBe(0);
        const ref = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'CrossOracle']);
        expect(ref.exitCode, ref.stderr.toString()).toBe(0);
        const lines = ref.stdout.toString().trimEnd().split(/\r?\n/);
        const screen = new Int32Array(53 * 38);
        Pix2D.setPixels(screen, 53, 38);
        const crosses = Array.from(
            { length: 8 },
            (_, i) =>
                new Pix32(
                    16,
                    16,
                    i & 1,
                    i & 3,
                    9,
                    7,
                    Int32Array.from({ length: 63 }, (_, p) => ((p + i) % 5 === 0 ? 0 : (i + 1) * 65536 + p + 1))
                )
        );
        const self = new ClientPlayer();
        let row = 0;
        for (let mode = -1; mode <= 3; mode++)
            for (const step of [-2147483648, -100, -99, -1, 0, 99, 100, 299, 300, 399, 400, 2147483647])
                for (let i = 0; i < 9; i++) {
                    Minimenu.crossMode = mode;
                    Minimenu.crossTicks = step;
                    Minimenu.crossX = i % 3 === 0 ? 0 : i % 3 === 1 ? 28 : -2147483648;
                    Minimenu.crossY = i % 3 === 0 ? 11 : 33;
                    SpriteLoader.cross = i === 0 ? null : i === 1 ? new Array(8).fill(null) : crosses;
                    Client.localPlayer = i === 2 ? null : self;
                    Client.mapBuildBaseX = i === 3 ? 3052 : i === 4 ? 3071 : 3138;
                    Client.mapBuildBaseZ = i === 4 ? 9491 : i === 5 ? 3008 : 3061;
                    self.x = 128;
                    self.z = 128;
                    Client.withinTutorialIsland = 73;
                    screen.fill(123456);
                    let error = false;
                    try {
                        Client.drawCross();
                    } catch {
                        error = true;
                    }
                    const hash = screen.reduce((v, p) => (Math.imul(v, 31) + p) | 0, 1);
                    expect([error, Client.withinTutorialIsland, hash].join(' '), [mode, step, i].join('/')).toBe(lines[row++]);
                }
        expect(row).toBe(lines.length);
    } finally {
        SpriteLoader.cross = cross;
        Client.withinTutorialIsland = area;
        Object.assign(Client, state);
        Object.assign(Minimenu, menu);
        Object.assign(Pix2D, raster);
        rmSync(dir, { recursive: true, force: true });
    }
});
