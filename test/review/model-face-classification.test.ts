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
    'software face classification matches fc flag, pick and bucket stores at faults',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), '530-face-classification-'));
        try {
            const cp = [dir, gamepackPath].join(delimiter);
            const cases = ['ok', 'hidden', 'shortY', 'shortZ', 'nullNear', 'shortNear', 'nullX', 'shortX', 'nullRows', 'shortRows', 'nullRow', 'shortRow', 'shortPick'];
            const compile = Bun.spawnSync(['javac', '-cp', cp, '-d', dir, join(import.meta.dir, 'model-lit', 'FaceClassificationOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const oracle = Bun.spawnSync(['java', '-cp', cp, 'FaceClassificationOracle', ...cases]);
            expect(oracle.exitCode, oracle.stderr.toString()).toBe(0);
            Pix2D.setPixels(new Int32Array(320 * 240), 320, 240);
            Pix3D.setRenderClipping();
            const hashFlags = (flags: boolean[] | null): number => (flags === null ? 0 : flags.reduce((h, value) => (Math.imul(31, h) + (value ? 1231 : 1237)) | 0, 1));
            const samples: string[] = [];
            for (const near of [false, true]) {
                for (const cut of cases) {
                    const model = new ModelLitImpl();
                    Object.assign(model, {
                        numFaces: 1,
                        faceColourC: Int32Array.of(cut === 'hidden' ? -2 : 0),
                        faceVertexA: Int32Array.of(0),
                        faceVertexB: Int32Array.of(1),
                        faceVertexC: Int32Array.of(2)
                    });
                    const nearFlags = cut === 'nullNear' ? null : cut === 'shortNear' ? [] : [!near];
                    const xFlags = cut === 'nullX' ? null : cut === 'shortX' ? [] : [true];
                    const counts = new Int32Array(1600);
                    const row = cut === 'nullRow' ? null : cut === 'shortRow' ? new Int32Array(0) : Int32Array.of(-11);
                    Object.assign(ModelLitImpl, {
                        vertexScreenX: Int32Array.of(near ? -5000 : 10, 5, 12),
                        vertexScreenY: cut === 'shortY' ? new Int32Array(1) : Int32Array.of(5, 5, 8),
                        vertexScreenZ: new Int32Array(cut === 'shortZ' ? 1 : 3),
                        vertexViewSpaceX: Int32Array.of(5, 0, 0),
                        vertexViewSpaceY: Int32Array.of(0, 0, 5),
                        vertexViewSpaceZ: Int32Array.of(1, 1, 1),
                        faceNearClipped: nearFlags,
                        faceClippedX: xFlags,
                        tmpDepthFaceCount: counts,
                        tmpDepthFaces: cut === 'nullRows' ? null : cut === 'shortRows' ? [null] : [null, row]
                    });
                    ModelLitImpl.mouseX = 10 - Pix3D.originX;
                    ModelLit.mouseY = 5 - Pix3D.originY;
                    ModelLit.pickedCount = 0;
                    ModelLit.pickedTypecodes = new BigInt64Array(cut === 'shortPick' ? 0 : 1);
                    let outcome = 'ok';
                    try {
                        model['Render2'](near, true, 71n, 1, 0, null);
                    } catch (error) {
                        if (error instanceof RangeError) outcome = 'bounds';
                        else if (error instanceof TypeError) outcome = 'null';
                        else throw error;
                    }
                    const picks = ModelLit.pickedTypecodes.reduce((h, v) => (Math.imul(31, h) + Number(v)) | 0, 1);
                    const rowHash = row === null ? 0 : row.reduce((h, v) => (Math.imul(31, h) + v) | 0, 1);
                    samples.push([near, cut, outcome, ModelLit.pickedCount, picks, hashFlags(nearFlags), hashFlags(xFlags), counts[1], rowHash].join(' '));
                }
            }
            expect(samples).toEqual(oracle.stdout.toString().trimEnd().split(/\r?\n/));
            expect(samples.some(s => s.startsWith('false nullRow null ') && s.endsWith(' 1 0'))).toBe(true);
            expect(samples.some(s => s.startsWith('false nullRows null ') && s.endsWith(' 0 20'))).toBe(true);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    15000,
    'sd'
);
