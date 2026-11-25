import { expect } from 'bun:test';
import { digest } from './model-bytes.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import LocType from '#/config/LocType.js';
import SeqType from '#/config/SeqType.js';
import GlModel from '#/dash3d/GlModel.js';
import ModelUnlit from '#/dash3d/ModelUnlit.js';
import type LocEntity from '#/dash3d/LocEntity.js';
import Pix3D from '#/dash3d/Pix3D.js';
import TextureCache from '#/dash3d/TextureCache.js';
import Pix8 from '#/graphics/Pix8.js';
import GlLighting from '#/gl/GlLighting.js';
import GlRenderer from '#/gl/GlRenderer.js';
import Preferences from '#/ui/Preferences.js';
import { localAssets } from '../cachefile.js';
import { loginFixture } from '../login-fixture.js';
import { cachePath } from '../reference.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

const ids = new Map<object, number>();
function id(value: object | null): number {
    if (value === null) return 0;
    const known = ids.get(value);
    if (known !== undefined) return known;
    const next = ids.size + 1;
    ids.set(value, next);
    return next;
}

function describe(entity: LocEntity | null): string {
    if (entity === null) return 'null';
    const model = entity.model,
        sprite = entity.shadow;
    const parts: (string | number)[] = [id(entity), id(model), id(sprite)];
    if (model !== null) {
        if (!(model instanceof GlModel)) throw new Error('Expected hardware model');
        parts.push([model.shareLight, model.getAmbient(), model.getContrast(), model.vertexCount, model.expandedVertexCount, model.faceCount].join(','));
        for (const array of [model.pointX, model.pointY, model.pointZ, model.faceVertexA, model.faceVertexB, model.faceVertexC, model.faceColour, model.faceAlpha]) parts.push(digest(array));
    }
    if (sprite !== null) {
        parts.push([sprite.cropW, sprite.cropH, sprite.xOffset, sprite.yOffset, sprite.width, sprite.height].join(','), digest(sprite.pixels));
    }
    return parts.join('|');
}

function definition(id: number, variant: number, shape: number): LocType {
    const loc = Object.assign(new LocType(), LocType.List(id));
    loc.id += variant * 100000;
    if (variant === 1) {
        Object.assign(loc, {
            resizeX: 110,
            resizeY: 144,
            resizeZ: 98,
            offsetX: 33,
            offsetY: -7,
            offsetZ: 6,
            ambient: -12,
            contrast: 27,
            mirror: true,
            shareLight: true,
            modelShapes: Int32Array.of(shape),
            recolourSource: Int16Array.of(5546, 0, 12),
            recolourDest: Int16Array.of(1, 2, 3),
            recolourPalette: Int8Array.of(0, 0, 0),
            retextureSource: Int16Array.of(-1),
            retextureDest: Int16Array.of(-1)
        });
    } else if (variant === 2) {
        loc.recolourSource = Int16Array.of(5546, 0);
        loc.recolourDest = Int16Array.of(1);
    } else if (variant === 3) {
        loc.modelIds = Int32Array.of(731, 731, 731, 731, 731);
        loc.modelShapes = null;
    } else if (variant >= 4 && variant <= 8) {
        loc.hillSkew = variant - 3;
        loc.hillParam = 0x4480;
    } else if (variant === 9) {
        loc.modelIds = new Int32Array(0);
        loc.modelShapes = null;
    }
    return loc;
}

// A nonzero sprite-request bit is significant on the first static cache fill. Repeat the same
// keys in both orders and alternate the supplied reusable sprite with a null input.
function vectors(): number[][] {
    const rows: number[][] = [];
    for (const [id, shape] of [
        [1, 10],
        [2, 10],
        [3, 0],
        [4, 9],
        [133, 10],
        [1276, 10],
        [1281, 10],
        [49923, 10]
    ]) {
        for (let angle = 0; angle < 8; angle++) {
            for (const mask of angle % 2 === 0 ? [0, 6, 10, 1, 3, 11, 1] : [10, 0, 6, 11, 1, 3]) rows.push([id, shape, angle, 0, mask, -1]);
        }
    }
    for (const shape of [2, 4, 10]) {
        for (let angle = 0; angle < 8; angle++) {
            for (const mask of [6, 1, 3]) rows.push([2, shape, angle, 1, mask, -1]);
        }
    }
    for (let variant = 2; variant <= 9; variant++) {
        for (const mask of [2, 3, 9]) rows.push([2, 10, 4, variant, mask, -1]);
    }
    for (let angle = 0; angle < 8; angle++) {
        for (const mask of [1, 3]) rows.push([1, 10, angle, 0, mask, 3206]);
    }
    return rows;
}

loginFixture(
    import.meta.url,
    'HD location models match original cached geometry, shadows, animation and failure state',
    async () => {
        const directory = mkdtempSync(join(tmpdir(), 'rs530-loc-model-'));
        try {
            const cp = [directory, hdGamepackPath, joglPath].join(delimiter);
            const compile = Bun.spawnSync(['javac', '-encoding', 'UTF-8', '-cp', cp, '-sourcepath', import.meta.dir, '-d', directory, join(import.meta.dir, 'HdLocModelOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const inputs = vectors();
            const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', cp, 'HdLocModelOracle', cachePath], {
                stdin: Buffer.from(inputs.map(row => row.join(' ')).join('\n') + '\n'),
                timeout: 45000,
                maxBuffer: 4 * 1024 * 1024
            });
            expect(java.exitCode, java.stderr.toString()).toBe(0);
            const output = java.stdout.toString().trimEnd().split(/\r?\n/);
            const lines = output.filter(row => !row.startsWith('rotation '));
            expect(lines.length).toBe(inputs.length);
            const assets = localAssets(cachePath, [0, 1, 7, 8, 9, 16, 20, 26]);
            LocType.Init(assets.archive(7), assets.archive(16), true);
            SeqType.Init(assets.archive(20), assets.archive(1), assets.archive(0));
            Pix3D.textureProvider = new TextureCache(assets.archive(9), assets.archive(26), assets.archive(8), 20, false);
            GlRenderer.active = true;
            GlRenderer.vboSupported = false;
            Preferences.highDetailLighting = true;
            GlLighting.shadowSlopeX = -136;
            GlLighting.shadowSlopeZ = 224;
            const ground = Array.from({ length: 32 }, (_, x) => Int32Array.from({ length: 32 }, (_, z) => -80 - ((x * x + 7 * z - 3 * x * z) & 127)));
            const upper = ground.map((row, x) => Int32Array.from(row, (value, z) => value - (128 + 2 * x + z)));
            const reusable = new Pix8(256, 256, 0);
            for (const [i, [loc, shape, angle, variant, mask, animation]] of inputs.entries()) {
                const type = definition(loc, variant, shape);
                const sprite = (mask & 8) !== 0 ? reusable : null;
                const makeShadow = (mask & 2) !== 0;
                let status = 'ok',
                    entity: LocEntity | null;
                try {
                    if ((mask & 1) !== 0) {
                        entity = type.GetTempModel(-180, shape, 1, 1, 1536, 1664, ground, angle, makeShadow, 0, sprite, upper, animation === -1 ? null : SeqType.List(animation));
                    } else {
                        entity = type.GetModel(upper, shape, angle, -180, (mask & 4) !== 0, ground, sprite, 1536, 1664, makeShadow);
                    }
                } catch (error) {
                    if (!(error instanceof RangeError)) throw error;
                    status = 'ArrayIndexOutOfBoundsException';
                    entity = LocType.modelResult;
                }
                expect(status + ' ' + describe(entity), inputs[i].join(' ')).toBe(lines[i]);
            }
            const sequence = SeqType.List(808);
            const rotations = output.filter(row => row.startsWith('rotation '));
            expect(rotations).toHaveLength(72);
            const softwareNormals = new Map<string, string[]>();
            for (const row of rotations) {
                const [, modelId, active, normals, angle, ...expected] = row.split(' ');
                GlRenderer.active = active === 'true';
                sequence.special = normals === 'true';
                const base = new GlModel(ModelUnlit.Load(assets.archive(7), Number(modelId), 0), 64, 768, false);
                base.buildAnimationTables();
                const model = sequence.AnimateModel90(0, Number(angle), base, 2, 1);
                if (!(model instanceof GlModel)) throw new Error('Expected a GL location animation copy');
                const positions = [model.pointX, model.pointY, model.pointZ].map(a => digest(a?.subarray(0, model.vertexCount) ?? null));
                const directions = [model.normalX, model.normalY, model.normalZ].map(a => digest(a?.subarray(0, model.expandedVertexCount) ?? null));
                expect([...positions, ...directions], row.slice(0, row.indexOf(expected[0]))).toEqual(expected);
                if (sequence.special) {
                    const key = modelId + '/' + angle;
                    if (!GlRenderer.active) softwareNormals.set(key, expected.slice(3));
                    else if ((Number(angle) & 3) !== 0) expect(directions).not.toEqual(softwareNormals.get(key));
                }
            }
        } finally {
            rmSync(directory, { recursive: true, force: true });
        }
    },
    90000,
    'gl'
);
