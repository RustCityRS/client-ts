import { expect } from 'bun:test';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import GlRenderer from '#/gl/GlRenderer.js';
import { loginFixture } from '../login-fixture.js';
import { gamepackPath } from '../reference.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

for (const identity of ['sd', 'gl'] as const) {
    loginFixture(
        import.meta.url,
        identity + ' actor movement and immediate environment update match the gamepack',
        async () => {
            const cases: number[][] = [];
            for (const active of [0, 1]) {
                for (const local of [0, 1]) {
                    for (const before of [0, 1]) {
                        for (const jump of [0, 1]) {
                            for (const [x, z] of [
                                [40, 70],
                                [41, 67],
                                [48, 62],
                                [32, 78],
                                [49, 70],
                                [40, 61]
                            ]) {
                                cases.push([active, local, before, jump, x, z]);
                            }
                        }
                    }
                }
            }
            const cp = identity === 'gl' ? [hdGamepackPath, joglPath].join(delimiter) : gamepackPath;
            const oracle = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', cp, join(import.meta.dir, 'EntityTeleportLightingOracle.java'), identity], {
                stdin: Buffer.from(cases.map(row => row.join(' ')).join('\n') + '\n')
            });
            expect(oracle.exitCode, oracle.stderr.toString()).toBe(0);
            const expected = oracle.stdout.toString().trim().split(/\r?\n/);
            expect(expected).toHaveLength(cases.length);

            for (const [i, [active, local, before, jump, x, z]] of cases.entries()) {
                const actor = new ClientPlayer();
                Client.localPlayer = local ? actor : new ClientPlayer();
                GlRenderer.active = Boolean(active);
                Client.forceImmediateEnvironmentUpdate = Boolean(before);
                actor.pathX[0] = 40;
                actor.pathZ[0] = 70;
                actor.moveSized(2, z, x, Boolean(jump));
                const actual = [actor.pathLength, actor.pathX[0], actor.pathZ[0], actor.x, actor.z, Client.forceImmediateEnvironmentUpdate];
                expect(actual.join(' '), cases[i].join(' ')).toBe(expected[i]);
            }
        },
        30000,
        identity
    );
}
