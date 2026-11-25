import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import ModelLit from '#/dash3d/ModelLit.js';
import ModelLitImpl from '#/dash3d/ModelLitImpl.js';
import Pix3D from '#/dash3d/Pix3D.js';
import Pix2D from '#/graphics/Pix2D.js';
import { loginFixture } from '../login-fixture.js';
import { gamepackPath } from '../reference.js';

loginFixture(
    import.meta.url,
    'software projection faults leave the same picks, source and destination arrays as fc',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), '530-projection-'));
        try {
            const cp = [dir, gamepackPath].join(delimiter);
            const compile = Bun.spawnSync(['javac', '-cp', cp, '-d', dir, join(import.meta.dir, 'model-lit', 'ProjectionOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const oracle = Bun.spawnSync(['java', '-cp', cp, 'ProjectionOracle']);
            expect(oracle.exitCode, oracle.stderr.toString()).toBe(0);
            Pix2D.setPixels(new Int32Array(320 * 240), 320, 240);
            Pix3D.setRenderClipping();
            const initial = [
                [-3, 7, 1],
                [-4, 5, 0],
                [-52, -49, 40]
            ];
            const rows: string[] = [];
            for (let mode = 0; mode < 4; mode++) {
                for (let cut = 0; cut < 9; cut++) {
                    for (const length of [-1, 0, 1, 2, 3]) {
                        const model = new ModelLitImpl();
                        Object.assign(model, {
                            boundsCalculated: true,
                            numPoints: 3,
                            numT: mode === 0 ? 0 : 1,
                            radiusCylinder: mode === 0 ? 30 : 60,
                            minX: -60,
                            minY: -60,
                            minZ: -60,
                            maxX: 60,
                            maxY: 60,
                            maxZ: 60,
                            useAABBMouseCheck: true
                        });
                        ModelLit.checkHover = true;
                        ModelLitImpl.mouseX = ModelLit.mouseY = ModelLit.pickedCount = 0;
                        ModelLit.pickedTypecodes = new BigInt64Array(mode === 3 ? 0 : 2);
                        const storage = Array.from({ length: 9 }, (_, i) => {
                            const size = i === cut ? length : 3;
                            if (size < 0) return null;
                            return i < 3 ? Int32Array.from(initial[i].slice(0, size)) : new Int32Array(size).fill(-770 - i);
                        });
                        if (mode === 2) {
                            storage[4] = storage[3];
                            storage[8] = storage[2];
                        }
                        [model.pointX, model.pointY, model.pointZ] = storage;
                        [ModelLitImpl['vertexScreenX'], ModelLitImpl['vertexScreenY'], ModelLitImpl['vertexScreenZ'], ModelLitImpl['vertexViewSpaceX'], ModelLitImpl['vertexViewSpaceY'], ModelLitImpl['vertexViewSpaceZ']] = storage.slice(3);
                        let outcome = 'ok';
                        try {
                            model.draw(0, 0, 65536, 0, 65536, 0, 0, 100, 71n, 0, null);
                        } catch (error) {
                            if (error instanceof TypeError) outcome = 'null';
                            else if (error instanceof RangeError) outcome = 'bounds';
                            else throw error;
                        }
                        const picks = ModelLit.pickedTypecodes.reduce((h, n) => (Math.imul(31, h) + Number(n)) | 0, 1);
                        const hashes = storage.map(values => (values === null ? 0 : values.reduce((h, n) => (Math.imul(31, h) + n) | 0, 1)));
                        rows.push([mode, cut, length, outcome, ModelLit.pickedCount, picks, ...hashes].join(' '));
                    }
                }
            }
            expect(rows).toEqual(oracle.stdout.toString().trimEnd().split(/\r?\n/));
            expect(rows.some(row => row.startsWith('1 4 1 bounds 1 '))).toBe(true);
            expect(rows.some(row => row.startsWith('0 7 -1 ok 1 '))).toBe(true);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    15000,
    'sd'
);
