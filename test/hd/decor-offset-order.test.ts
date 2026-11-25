import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import ClientBuild from '#/client/ClientBuild.js';
import LocType from '#/config/LocType.js';
import GroundShadows from '#/dash3d/GroundShadows.js';
import LocEntity from '#/dash3d/LocEntity.js';
import world from '#/dash3d/world.js';
import GlRenderer from '#/gl/GlRenderer.js';
import { loginFixture } from '../login-fixture.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

loginFixture(
    import.meta.url,
    'HD wall decoration models observe renderer changes and preserve the JAR shadow offset reads',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-decor-order-'));
        try {
            const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
            const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
            const compile = Bun.spawnSync(['javac', asm, '-cp', cp, '-d', dir, join(import.meta.dir, 'HdDecorOffsetOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const java = ['java', asm, '-Djava.awt.headless=true', '-cp', cp, 'HdDecorOffsetOracle'];
            const instrument = Bun.spawnSync([...java, dir]);
            expect(instrument.exitCode, instrument.stderr.toString()).toBe(0);
            const oracle = Bun.spawnSync(java);
            expect(oracle.exitCode, oracle.stderr.toString()).toBe(0);
            const rows = oracle.stdout.toString().trimEnd().split(/\r?\n/);
            expect(rows).toHaveLength(48);
            const config = new LocType();
            LocType.List = () => config;
            world.levelHeightmaps = Array.from({ length: 2 }, () => Array.from({ length: 5 }, () => new Int32Array(5)));
            world.WallType = () => 0n;
            for (const row of rows) {
                const [shape, flags] = row.split('|')[0].split(' ').map(Number);
                const events: string[] = [];
                GlRenderer.active = (flags & 1) !== 0;
                ClientBuild.DECORZOF2 = flags & 4 ? new Int32Array() : Int32Array.of(1, 2, 3, 4);
                ClientBuild.DECORXOF2 = flags & 8 ? new Int32Array() : Int32Array.of(5, 6, 7, 8);
                config.GetModel = (_upper, _shape, angle) => {
                    events.push('model=' + angle);
                    if (flags & 2) GlRenderer.active = !GlRenderer.active;
                    if (ClientBuild.DECORZOF2.length) ClientBuild.DECORZOF2[1] += 4;
                    if (ClientBuild.DECORXOF2.length) ClientBuild.DECORXOF2[1] += 8;
                    return new LocEntity();
                };
                GroundShadows.addLoc = (_sprite, x, y, z) => {
                    events.push('shadow=' + [x, y, z].join(','));
                };
                world.SetDecor = (_level, _tx, _tz, _y, _model, _model2, _shape, _angle, x, z) => {
                    events.push('decor=' + x + ',' + z);
                };
                let status = 'ok';
                try {
                    ClientBuild.AddLoc(false, 0, 3, 0, 1, shape, 2, 2, false, null);
                } catch (error) {
                    if (!(error instanceof RangeError)) throw error;
                    status = 'bounds';
                }
                expect([shape + ' ' + flags, events.join(';'), status].join('|')).toBe(row);
            }
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    30000,
    'gl'
);
