import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import ClientBuild from '#/client/ClientBuild.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import MinimapBuilder from '#/dash3d/MinimapBuilder.js';
import RoofModeStatics from '#/dash3d/RoofModeStatics.js';
import Preferences from '#/ui/Preferences.js';
import { loginFixture } from './login-fixture.js';
import { gamepackPath } from './reference.js';

loginFixture(
    import.meta.url,
    'minimap level changes and rebuild arguments match hi.b in the gamepack',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-check-minimap-'));
        const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
        const cp = dir + delimiter + gamepackPath;
        try {
            const compile = Bun.spawnSync(['javac', asm, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game/CheckMinimapOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const rows: number[][] = [];
            for (const visible of [0, 1])
                for (const level of [-1, 0, 3]) {
                    for (const buildLevel of [level, level + 1])
                        for (const minimapLevel of [level, level - 1]) {
                            for (let player = 0; player < 4; player++)
                                for (let action = 0; action < 8; action++) {
                                    rows.push([visible, buildLevel, level, minimapLevel, player, action]);
                                }
                        }
                }
            function oracle(cases: number[][]): string[] {
                const run = Bun.spawnSync(['java', asm, '-Djava.awt.headless=true', '-cp', cp, 'CheckMinimapOracle'], {
                    stdin: Buffer.from(cases.map(row => row.join(' ')).join('\n') + '\n')
                });
                expect(run.exitCode, run.stderr.toString()).toBe(0);
                return run.stdout.toString().trimEnd().split(/\r?\n/);
            }
            const direct = rows.filter(([visible, build, level, minimap, player, action]) => action === 0 && (!visible && build !== level ? player !== 0 : minimap === level));
            const unmodified = oracle(direct);
            const prepare = Bun.spawnSync(['java', asm, '-cp', cp, 'CheckMinimapOracle', gamepackPath, dir]);
            expect(prepare.exitCode, prepare.stderr.toString()).toBe(0);
            const observed = oracle(rows);
            let directIndex = 0;
            const directlyChecked = new Set(direct);
            for (const [i, row] of rows.entries()) {
                const [visible, build, level, minimap, player, action] = row;
                Preferences.allLevelsVisible = !!visible;
                ClientBuild.buildLevel = build;
                Client.playerLevel = level;
                MinimapBuilder.minimapLevel = minimap;
                const self = new ClientPlayer(),
                    other = new ClientPlayer();
                Client.localPlayer = player === 1 ? null : self;
                self.pathX[0] = 73;
                self.pathZ[0] = 109;
                other.pathZ[0] = -212;
                if (player === 2) self.pathX = new Int32Array(0);
                if (player === 3) self.pathZ = new Int32Array(0);
                Client.mapBuildCentreZoneZ = -410;
                Object.defineProperty(Client, 'mapBuildCentreZoneX', {
                    configurable: true,
                    get() {
                        if (action === 5) Client.localPlayer = other;
                        if (action === 6) Client.localPlayer = null;
                        return 218;
                    }
                });
                let trace = '';
                Client.StartRebuild = (level, z, localX, x, localZ, title) => {
                    expect(title).toBe(false);
                    trace += `rebuild,${level},${z},${localX},${x},${localZ};`;
                };
                MinimapBuilder.BuildBuffer = level => {
                    trace += `build,${level};`;
                    if (action === 2) throw new Error('stop');
                    if (action === 3 || action === 4) Client.playerLevel = -81;
                    return action !== 0 && action !== 4;
                };
                RoofModeStatics.applyRoofMode = () => {
                    trace += `roofs,${MinimapBuilder.minimapLevel};`;
                    if (action === 7) throw new Error('stop');
                };
                let result = 'ok';
                try {
                    Client.GlCheckMinimap();
                } catch (e) {
                    if (e instanceof TypeError) result = 'null';
                    else if (e instanceof RangeError) result = 'bounds';
                    else if (e instanceof Error && e.message === 'stop') result = 'stop';
                    else throw e;
                }
                const actual = [result, trace, Client.playerLevel, MinimapBuilder.minimapLevel].join('/');
                expect(actual, row.join(' ')).toBe(observed[i]);
                if (directlyChecked.has(row)) expect(actual).toBe(unmodified[directIndex++]);
            }
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    30000
);
