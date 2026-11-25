import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Js5 from '#/cache/Js5.js';
import ObjType from '#/config/ObjType.js';
import SpotType from '#/config/SpotType.js';
import SeqType from '#/config/SeqType.js';
import ClientObj from '#/dash3d/ClientObj.js';
import ClientProj from '#/dash3d/ClientProj.js';
import GlModel from '#/dash3d/GlModel.js';
import MapSpotAnim from '#/dash3d/MapSpotAnim.js';
import type ModelSource from '#/dash3d/ModelSource.js';
import ParticleSystem from '#/dash3d/ParticleSystem.js';
import GlRenderer from '#/gl/GlRenderer.js';
import { IllegalStateException } from '#/util/JavaException.js';
import WrappedException from '#/util/WrappedException.js';
import { loginFixture } from '../login-fixture.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

loginFixture(
    import.meta.url,
    'HD ground item, spot animation and projectile draw effects match the original gamepack',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'hd-entity-draw-'));
        try {
            const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
            const build = Bun.spawnSync(['javac', '-cp', cp, '-d', dir, join(import.meta.dir, 'HdEntityDrawOracle.java')]);
            expect(build.exitCode, build.stderr.toString()).toBe(0);
            const oracle = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', cp, 'HdEntityDrawOracle']);
            expect(oracle.exitCode, oracle.stderr.toString()).toBe(0);
            const expected = oracle.stdout.toString().trim().split(/\r?\n/);
            const observed: string[] = [],
                events: string[] = [];
            const caller = new ParticleSystem(),
                owned = new ParticleSystem();
            let fault = 0,
                step = 0;
            function model(tag: number): GlModel {
                const lit = new GlModel();
                lit.getMinY = () => {
                    events.push('height ' + tag);
                    if (fault === 2) throw new IllegalStateException();
                    return -tag;
                };
                lit.draw = (a, b, c, d, e, f, g, h, key, plane, particles) => {
                    events.push('draw ' + tag + ' ' + [a, b, c, d, e, f, g, h, key, plane, particles === caller ? 'caller' : particles === owned ? 'owned' : 'null'].join(','));
                    if (fault === 1) throw new IllegalStateException();
                };
                lit.CopyForAnimSpot = (alpha, colour, normals) => {
                    events.push('copy ' + tag + ' ' + [alpha, colour, normals].join(','));
                    return lit;
                };
                lit.Resize = (x, y, z) => {
                    events.push('scale ' + [x, y, z].join(','));
                };
                lit.Rotate90 = () => {
                    events.push('rotate90');
                };
                lit.RotateXAxis = pitch => {
                    events.push('pitch ' + pitch);
                };
                return lit;
            }
            GlRenderer.active = true;
            const missing = new Js5({ index: () => null, group: () => null, prefetchGroup: () => {}, GetGroupLoadPercentage: () => 0 }, true, true);
            ObjType.m_pModels = SpotType.m_pModels = missing;
            for (let id = 1; id <= 3; id++) {
                const type = Object.assign(new ObjType(), { id });
                if (id === 1) {
                    type.countObj = new Int32Array(10);
                    type.countThreshold = new Int32Array(10);
                    type.countObj[0] = 2;
                    type.countThreshold[0] = 5;
                }
                ObjType.types.Put(BigInt(id), type);
                if (id !== 3) ObjType.modelCache.Put(BigInt(id), model(id * 10));
                const spot = Object.assign(new SpotType(), { id, resizeXZ: 96, resizeY: 160, rotation: 90 });
                SpotType.m_recentUse.Put(BigInt(id), spot);
                if (id !== 3) SpotType.m_modelCache.Put(BigInt(id), model(30 + id));
            }
            function draw(entity: ModelSource, error: number): void {
                fault = error;
                events.length = 0;
                events.push('before ' + entity.getMinY());
                try {
                    entity.update(step, -2, 3, -4, 5);
                    entity.draw(step, -2, 3, -4, 5, -6, 7, -8, -0x8000000000000000n + BigInt(step), 2, (step & 1) === 0 ? caller : null);
                } catch (failure) {
                    if (!(failure instanceof WrappedException) || !(failure.cause instanceof IllegalStateException)) throw failure;
                    events.push(String(failure.context));
                }
                events.push('after ' + entity.getMinY());
                observed.push(events.join('|'));
                step++;
            }
            const item = Object.assign(new ClientObj(), { id: 1 });
            for (const count of [1, 4, 5, 12]) {
                item.count = count;
                draw(item, 0);
            }
            item.id = 3;
            draw(item, 0);
            item.id = 1;
            draw(item, 1);
            draw(item, 2);
            for (const id of [1, 3]) {
                const spot = new MapSpotAnim(id, 0, 64, 64, 0, 0, 1);
                const projectile = new ClientProj(id, 0, 64, 64, 0, 0, 8, -1, 0, 0, 0);
                spot.particles = projectile.particles = owned;
                projectile.pitch = 511;
                for (const error of [0, 1, 2]) {
                    draw(spot, error);
                    draw(projectile, error);
                }
                spot['seq'] = Object.assign(new SeqType(), { delays: Int32Array.of(1, 3, 5), frames: Int32Array.of(100, 200, 300) });
                spot.finished = false;
                for (const delta of [0, 1, 1, 2, 5, 2, 2147483647]) {
                    spot.advance(delta);
                    observed.push('advance ' + spot.frame + ' ' + spot.frameCycle + ' ' + spot.finished);
                }
            }
            expect(expected).toHaveLength(33);
            expect(observed).toEqual(expected);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    30000,
    'gl'
);
