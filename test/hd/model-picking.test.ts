import { expect } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import GlModel from '#/dash3d/GlModel.js';
import ModelLit from '#/dash3d/ModelLit.js';
import ModelLitImpl from '#/dash3d/ModelLitImpl.js';
import ModelUnlit from '#/dash3d/ModelUnlit.js';
import Pix3D from '#/dash3d/Pix3D.js';
import TextureCache from '#/dash3d/TextureCache.js';
import GlRenderer from '#/gl/GlRenderer.js';
import type { GL } from '#/jogl/GL.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { localAssets } from '../cachefile.js';
import { loginFixture } from '../login-fixture.js';
import { cachePath } from '../reference.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

loginFixture(
    import.meta.url,
    'HD model picking matches original bounds and triangle hits in all four quadrants',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-model-picking-'));
        try {
            const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
            const sources = ['GlRecorder', 'HdTitleFrameOracle', 'HdModelPickingOracle'].map(name => join(import.meta.dir, name + '.java'));
            const build = Bun.spawnSync(['javac', '-encoding', 'UTF-8', '-cp', cp, '-d', dir, ...sources]);
            expect(build.exitCode, build.stderr.toString()).toBe(0);
            const poses: number[][] = [];
            for (const [id, angle, pitch, yaw, dx, dy, dz] of [
                [115, 0, 0, 0, -138, -80, 640],
                [115, 128, 0, 0, -138, 106, 640],
                [115, 256, 0, 0, 133, -80, 640],
                [115, 731, 0, 0, 133, 106, 640],
                [543, 390, 72, 43, -155, 215, 540],
                [4500, 673, 96, 2000, 162, 290, 555]
            ]) {
                for (const bounds of [0, 1]) poses.push([id, bounds, 1, 1, angle, pitch, yaw, dx, dy, dz]);
            }
            poses.push([115, 1, 0, 1, 0, 0, 0, 0, 0, 640], [115, 1, 1, 0, 0, 0, 0, 0, 0, 640], [115, 0, 1, -1, 0, 0, 0, 0, 0, 640]);
            const output = join(dir, 'picks.bin');
            const jar = Bun.spawnSync(['java', '--add-opens=java.base/java.lang=ALL-UNNAMED', '-Djava.awt.headless=true', '-cp', cp, 'HdModelPickingOracle', cachePath, join(import.meta.dir, 'rtx5070.json'), output], {
                stdin: Buffer.from(poses.map(pose => pose.join(' ')).join('\n') + '\n')
            });
            expect(jar.exitCode, jar.stderr.toString()).toBe(0);
            const original = readFileSync(output);
            const assets = localAssets(cachePath, [7, 8, 9, 26]);
            Pix3D.textureProvider = new TextureCache(assets.archive(9), assets.archive(26), assets.archive(8), 20, false);
            Pix3D.clipMinX = -271;
            Pix3D.clipMaxX = 271;
            Pix3D.clipMinY = -208;
            Pix3D.clipMaxY = 208;
            const stop = new Error('draw reached glPushMatrix');
            GlRenderer.gl = new Proxy({} as GL, {
                get(_target, method) {
                    if (method === 'glPushMatrix')
                        return () => {
                            throw stop;
                        };
                    throw new Error('Unexpected GL call ' + String(method));
                }
            });
            const models = new Map<number, GlModel>();
            const sentinel = 0x1760a56972adn;
            const keys = requireNonNull(ModelLit.pickedTypecodes);
            const sin = requireNonNull(Pix3D.sinTable),
                cos = requireNonNull(Pix3D.cosTable);
            let offset = 0;
            const hits: number[] = [],
                quadrant = new Set<number>();
            for (const [id, bounds, hover, keyMode, angle, pitch, yaw, dx, dy, dz] of poses) {
                let model = models.get(id);
                if (model === undefined) {
                    model = new GlModel(requireNonNull(ModelUnlit.Load(assets.archive(7), id, 0)), 64, 768, false);
                    models.set(id, model);
                }
                model.useAABBMouseCheck = bounds === 1;
                ModelLit.checkHover = hover === 1;
                const key = keyMode > 0 ? (1n << 48n) + BigInt(id) : BigInt(keyMode);
                let hit = 0;
                for (let y = -198; y <= 198; y += 11) {
                    for (let x = -260; x <= 260; x += 10) {
                        ModelLit.pickedCount = 1;
                        keys.fill(sentinel, 0, 3);
                        ModelLitImpl.mouseX = x;
                        ModelLit.mouseY = y;
                        try {
                            model.draw(angle, sin[pitch], cos[pitch], sin[yaw], cos[yaw], dx, dy, dz, key, 0, null);
                        } catch (error) {
                            if (error !== stop) throw error;
                        }
                        const count = original[offset],
                            appended = original.readBigInt64BE(offset + 1);
                        if (ModelLit.pickedCount !== count || keys[1] !== appended || keys[0] !== sentinel || keys[2] !== sentinel) {
                            expect([ModelLit.pickedCount, keys[0], keys[1], keys[2]], [id, bounds, x, y, angle, pitch, yaw].join(',')).toEqual([count, sentinel, appended, sentinel]);
                        }
                        offset += 9;
                        if (count === 2) {
                            hit++;
                            if (!bounds) quadrant.add((x > 0 ? 1 : 0) + (y > 0 ? 2 : 0));
                        }
                    }
                }
                hits.push(hit);
            }
            expect(offset).toBe(original.length);
            expect(quadrant.size).toBe(4);
            expect(hits.slice(-3)).toEqual([0, 0, 0]);
            expect(hits.slice(0, -3).some((hit, i) => i % 2 === 1 && hit > hits[i - 1])).toBe(true);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    60000,
    'gl'
);
