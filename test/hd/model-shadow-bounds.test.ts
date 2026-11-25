import { requireNonNull } from '#/util/JavaArray.js';
import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import GlModel from '#/dash3d/GlModel.js';
import GlModelBounds from '#/dash3d/GlModelBounds.js';
import GlLighting from '#/gl/GlLighting.js';
import Pix8 from '#/graphics/Pix8.js';
import { loginFixture } from '../login-fixture.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

loginFixture(
    import.meta.url,
    'HD model shadows preserve each checked access and partial projected and raster bytes',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), '530-shadow-bounds-'));
        const oldX = GlModel.shadowX,
            oldZ = GlModel.shadowZ,
            slopeX = GlLighting.shadowSlopeX,
            slopeZ = GlLighting.shadowSlopeZ;
        try {
            const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
            const javac = Bun.spawnSync(['javac', '-cp', cp, '-d', dir, join(import.meta.dir, 'HdModelShadowBoundsOracle.java')]);
            expect(javac.exitCode, javac.stderr.toString()).toBe(0);
            const java = Bun.spawnSync(['java', '-XX:-OmitStackTraceInFastThrow', '-cp', cp, 'HdModelShadowBoundsOracle']);
            expect(java.exitCode, java.stderr.toString()).toBe(0);
            const expected = java.stdout.toString().trimEnd().split(/\r?\n/);
            GlLighting.shadowSlopeX = GlLighting.shadowSlopeZ = 0;
            for (let mode = 0; mode < expected.length; mode++) {
                const model = new GlModel(),
                    bounds = (model.bounds = new GlModelBounds());
                bounds.valid = true;
                bounds.maxX = bounds.maxZ = 32;
                model.vertexCount = model.expandedVertexCount = 4;
                model.faceCount = 2;
                model.pointX = Int32Array.of(0, 32, 0, 32);
                model.pointY = new Int32Array(4);
                model.pointZ = Int32Array.of(0, 0, 32, 32);
                model.vertexOffsets = Int32Array.of(0, 1, 2, 3, 4);
                model.vertexIndices = Int16Array.of(1, 2, 3, 4);
                model.faceVertexA = Int16Array.of(0, 1);
                model.faceVertexB = Int16Array.of(2, 2);
                model.faceVertexC = Int16Array.of(1, 3);
                model.faceAlpha = Uint8Array.of(249, 0);
                GlModel.shadowZ = new Int32Array(4).fill(-7);
                GlModel.shadowX = new Int32Array(4).fill(-9);
                switch (mode) {
                    case 1:
                        model.pointX = null;
                        break;
                    case 2:
                        model.pointY = model.pointY.slice(0, 2);
                        break;
                    case 3:
                        model.pointZ = model.pointZ.slice(0, 1);
                        break;
                    case 4:
                        model.vertexOffsets = model.vertexOffsets.slice(0, 3);
                        break;
                    case 5:
                        model.vertexOffsets[2] = -1;
                        break;
                    case 6:
                        model.vertexIndices = model.vertexIndices.slice(0, 2);
                        break;
                    case 7:
                        model.vertexIndices[2] = 0;
                        break;
                    case 8:
                        model.vertexIndices[2] = -3;
                        break;
                    case 9:
                        model.vertexIndices[2] = 13;
                        break;
                    case 10:
                        GlModel.shadowX = null;
                        break;
                    case 11:
                        GlModel.shadowX = GlModel.shadowX.slice(0, 2);
                        break;
                    case 12:
                        model.faceVertexA = model.faceVertexA.slice(0, 1);
                        break;
                    case 13:
                        model.faceVertexB[1] = -3;
                        break;
                    case 14:
                        model.faceVertexC[1] = 6;
                        break;
                    case 15:
                        model.faceVertexC = null;
                        break;
                    case 16:
                        model.faceAlpha = model.faceAlpha.slice(0, 1);
                        break;
                    case 17:
                        GlModel.shadowX = GlModel.shadowZ;
                        break;
                    case 18:
                        GlModel.shadowX = model.pointX;
                        break;
                }
                const sprite = new Pix8(5, 5, 0);
                requireNonNull(sprite.pixels).fill(255);
                let fault = 'ok';
                try {
                    model.createShadow(sprite);
                } catch (e) {
                    if (e instanceof TypeError) fault = 'null';
                    else if (e instanceof RangeError && /^array index -?\d+$/.test(e.message)) fault = e.message.slice('array index '.length);
                    else throw e;
                }
                const words = (a: Int32Array | null) => (a === null ? 'null' : '[' + a.join(', ') + ']');
                expect([mode, fault, words(GlModel.shadowZ), words(GlModel.shadowX), Buffer.from(requireNonNull(sprite.pixels)).toString('hex')].join(' ')).toBe(expected[mode]);
            }
        } finally {
            GlModel.shadowX = oldX;
            GlModel.shadowZ = oldZ;
            GlLighting.shadowSlopeX = slopeX;
            GlLighting.shadowSlopeZ = slopeZ;
            rmSync(dir, { recursive: true, force: true });
        }
    },
    30000,
    'gl'
);
