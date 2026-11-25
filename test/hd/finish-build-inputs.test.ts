import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import ClientBuild from '#/client/ClientBuild.js';
import TerrainBuilder from '#/dash3d/TerrainBuilder.js';
import world from '#/dash3d/world.js';
import SharedPtrList from '#/datastruct/SharedPtrList.js';
import GlRenderer from '#/gl/GlRenderer.js';
import PointLightManager from '#/gl/PointLightManager.js';
import Preferences from '#/ui/Preferences.js';
import { loginFixture } from '../login-fixture.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

loginFixture(
    import.meta.url,
    'HD FinishBuild rereads terrain inputs after each surface, underwater and light builder callback',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-terrain-inputs-'));
        try {
            const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
            const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
            const compile = Bun.spawnSync(['javac', asm, '-cp', cp, '-d', dir, join(import.meta.dir, 'HdFinishBuildInputsOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const java = ['java', asm, '-Djava.awt.headless=true', '-cp', cp, 'HdFinishBuildInputsOracle'];
            const instrument = Bun.spawnSync([...java, dir]);
            expect(instrument.exitCode, instrument.stderr.toString()).toBe(0);
            const oracle = Bun.spawnSync(java);
            expect(oracle.exitCode, oracle.stderr.toString()).toBe(0);
            const rows = oracle.stdout.toString().trimEnd().split(/\r?\n/);
            expect(rows).toHaveLength(8);
            const end = new Error('submitted');
            for (const row of rows) {
                const [water, fault] = row.split('|')[0].split(' ').map(Number);
                let generation = 0;
                const ids = new Map<object, string>();
                const events: string[] = [];
                function bytes(name: string): Uint8Array[][] {
                    const value = Array.from({ length: 4 }, () => Array.from({ length: 104 }, () => new Uint8Array(104)));
                    ids.set(value, name + generation);
                    ids.set(value[0], name + generation);
                    return value;
                }
                function heights(name: string): Int32Array[][] {
                    const value = Array.from({ length: 2 }, () => Array.from({ length: 105 }, () => new Int32Array(105)));
                    ids.set(value[0], name + generation);
                    return value;
                }
                function replace(): void {
                    generation++;
                    ClientBuild.m_mapl = bytes('flags');
                    ClientBuild.m_floors = bytes('shapes');
                    ClientBuild.m_floort1 = bytes('under');
                    ClientBuild.m_floort2 = bytes('over');
                    ClientBuild.m_floorr = bytes('rot');
                    world.levelHeightmaps = heights('heights');
                    world.mainGroundh = heights('surface');
                    world.waterSpriteKeys = Array.from({ length: 104 }, () => new Int32Array(104));
                    ids.set(world.waterSpriteKeys, 'water' + generation);
                    if (generation === fault) ClientBuild.m_floort1 = [];
                }
                function record(name: string, ...values: (object | null)[]): void {
                    events.push(name + '=' + values.map(value => (value === null ? '-' : ids.get(value))).join(','));
                }
                TerrainBuilder.buildUnderlays = (flags, shapes, below, _shade, _ny, colours, above, rotation, _nx, _level, _nz, _hsl, ground, surface) => {
                    record('under', flags, shapes, below, colours, above, rotation, ground, surface);
                    replace();
                    return [];
                };
                TerrainBuilder.buildOverlays = (_ny, _nx, ground, _level, _nz, rotation, _shade, shapes, below, above, flags) => {
                    record('over', ground, rotation, shapes, below, above, flags);
                    replace();
                    return [];
                };
                SharedPtrList.setTerrainBatches = () => {
                    events.push('submit');
                    if (water) throw end;
                };
                PointLightManager.buildMeshes = (_nz, below, rotation, _lights, _level, _count, _ny, shapes, above, ground) => {
                    record('lights', below, rotation, shapes, above, ground);
                    throw end;
                };
                GlRenderer.active = Preferences.highDetailLighting = true;
                replace();
                ClientBuild.m_shadow = Array.from({ length: 4 }, () => Array.from({ length: 105 }, () => new Uint8Array(105)));
                ClientBuild.m_huetot = new Int32Array(104);
                ClientBuild.m_sattot = new Int32Array(104);
                ClientBuild.m_ligtot = new Int32Array(104);
                ClientBuild.m_comtot = new Int32Array(104);
                ClientBuild.m_tot = new Int32Array(104);
                let status = 'complete';
                try {
                    ClientBuild.FinishBuild(null, water !== 0);
                } catch (error) {
                    if (error === end) status = 'submitted';
                    else if (error instanceof RangeError) status = 'bounds';
                    else throw error;
                }
                expect([water + ' ' + fault, events.join(';'), status].join('|')).toBe(row);
            }
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    30000,
    'gl'
);
