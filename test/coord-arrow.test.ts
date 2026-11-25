import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import ClientBuild from '#/client/ClientBuild.js';
import HintArrow from '#/client/HintArrow.js';
import OrbitCamera from '#/client/OrbitCamera.js';
import world from '#/dash3d/world.js';
import Pix2D from '#/graphics/Pix2D.js';
import Pix32 from '#/graphics/Pix32.js';
import WrappedException from '#/util/WrappedException.js';
import { loginFixture } from './login-fixture.js';
import { gamepackPath } from './reference.js';

loginFixture(import.meta.url, 'coordinate hint arrows match Java projection, sprite order and framebuffer', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rs530-coord-arrow-'));
    try {
        const compile = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game/CoordArrowOracle.java')]);
        expect(compile.exitCode, compile.stderr.toString()).toBe(0);
        const java = Bun.spawnSync(['java', '-cp', dir + delimiter + gamepackPath, 'CoordArrowOracle']);
        expect(java.exitCode, java.stderr.toString()).toBe(0);
        const lines = java.stdout.toString().trimEnd().split(/\r?\n/);
        const screen = new Int32Array(100 * 80);
        Pix2D.setPixels(screen, 100, 80);
        world.levelHeightmaps = Array.from({ length: 4 }, () => Array.from({ length: 105 }, () => new Int32Array(105)));
        ClientBuild.m_mapl = Array.from({ length: 4 }, () => Array.from({ length: 104 }, () => new Uint8Array(104)));

        let scenario = 0,
            row = 0;
        let initial: (HintArrow | null)[] = [];
        let trace = '';
        class Icon extends Pix32 {
            constructor(readonly id: number) {
                super(2, 2, 0, 0, 2, 2, Int32Array.of(id + 1, 0, 0, id + 5));
            }
            override draw(x: number, y: number): void {
                trace += [this.id, x, y].join(',') + '/';
                super.draw(x, y);
                if (this.id === 0) {
                    if (scenario === 9) Reflect.set(Client, 'hintArrows', null);
                    if (scenario === 10) initial[2] = null;
                    if (scenario === 11) Client.hintHeadicons = [null, new Icon(7)];
                    if (scenario === 12) Client.loopCycle = 10;
                    if (scenario === 13) Client.mapBuildBaseX++;
                }
            }
        }
        function arrow(index: number): HintArrow {
            const a = new HintArrow();
            a.type = 2;
            a.x = (Client.mapBuildBaseX + 3) | 0;
            a.z = (Client.mapBuildBaseZ + 8) | 0;
            a.offsetX = 64 + index;
            a.offsetZ = 64 - index;
            a.height = index * 4;
            a.icon = index;
            return a;
        }
        for (scenario = 0; scenario < 19; scenario++) {
            for (const cycle of [-2147483648, -21, -1, 0, 9, 10, 19, 20, 2147483647]) {
                for (const width of [80, 81, -3, -2147483648, 2147483647]) {
                    Client.loopCycle = cycle;
                    Client.mapBuildBaseX = scenario === 17 ? 2147483647 : 3000;
                    Client.mapBuildBaseZ = 3100;
                    OrbitCamera.x = 448;
                    OrbitCamera.z = 0;
                    OrbitCamera.y = 0;
                    OrbitCamera.pitch = 0;
                    OrbitCamera.yaw = 0;
                    Client.playerLevel = 0;
                    const first = arrow(0),
                        second = arrow(1),
                        third = arrow(2);
                    initial = [first, null, second, third];
                    Reflect.set(Client, 'hintArrows', scenario === 1 ? null : scenario === 2 ? [] : initial);
                    Client.hintHeadicons = [new Icon(0), new Icon(1), new Icon(2)];
                    if (scenario === 3) first.type = 10;
                    if (scenario === 4) Client.hintHeadicons = null;
                    if (scenario === 5 && Client.hintHeadicons) Client.hintHeadicons[1] = null;
                    if (scenario === 6) second.icon = -1;
                    if (scenario === 7) second.z += 150;
                    if (scenario === 8) first.height = -2147483648;
                    if (scenario === 14) Client.playerLevel = -1;
                    if (scenario === 15) OrbitCamera.z = 1050;
                    if (scenario === 16) OrbitCamera.yaw = 2048;
                    if (scenario === 18) third.offsetX = 2147483647;
                    const left = scenario === 8 ? 2147483647 : 8,
                        top = scenario === 8 ? -2147483648 : 17;
                    Client.projectX = 9011;
                    Client.projectY = -459;
                    trace = '';
                    screen.fill(41);
                    let status = 'ok';
                    try {
                        Client.GdmCoordArrow(left, width, 83, top);
                    } catch (caught) {
                        let e = caught;
                        while (e instanceof WrappedException) e = e.cause;
                        if (e instanceof RangeError) status = 'bounds';
                        else if (e instanceof TypeError) status = 'null';
                        else throw e;
                    }
                    const hash = screen.reduce((acc, pixel) => (Math.imul(acc, 31) + pixel) | 0, 1);
                    expect([status, Client.projectX, Client.projectY, trace, hash].join(' '), [scenario, cycle, width].join('/')).toBe(lines[row++]);
                }
            }
        }
        expect(row).toBe(lines.length);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
