import { expect } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import GlModel from '#/dash3d/GlModel.js';
import ModelUnlit from '#/dash3d/ModelUnlit.js';
import Pix3D from '#/dash3d/Pix3D.js';
import TextureCache from '#/dash3d/TextureCache.js';
import Preferences from '#/ui/Preferences.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { localAssets } from '../cachefile.js';
import { loginFixture } from '../login-fixture.js';
import { cachePath } from '../reference.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

type Step = {
    name: string;
    scope: 'all' | 'masked' | 'discard';
    op: number;
    xyz: [number, number, number];
    rotateNormals: boolean;
    mask: number;
    labels: Int32Array;
    matrix: Int32Array | null;
};

// Includes shared torso/arm vertices, arm-only vertices, face groups, an empty group and an out-of-range group.
const body = Int32Array.of(2, 8, 17, 20, 23, 24, 59, 60, 91, 92, 4, 9, 10, 11, 12, 13, 14, 250);
// Jagex's 15-int basis: 3x3 in 1.15 fixed point followed by two translation vectors.
const basis = Int32Array.of(0, 0, 32768, 0, 32768, 0, -32768, 0, 0, 3, -2, 5, -5, 2, -3);
function all(name: string, op: number, xyz: Step['xyz']): Step {
    return { name, scope: 'all', op, xyz, rotateNormals: false, mask: 0, labels: body, matrix: null };
}
function masked(name: string, op: number, xyz: Step['xyz'], mask: number, rotateNormals = false, matrix: Int32Array | null = null, labels = body): Step {
    return { name, scope: 'masked', op, xyz, rotateNormals, mask, labels, matrix };
}
const steps: Step[] = [
    all('model-pivot', 0, [3, -2, 5]),
    all('model-move', 1, [-3, 6, 11]),
    all('model-turn', 2, [128, 1931, 256]),
    all('model-turn-zero', 2, [0, 0, 0]),
    all('model-scale', 3, [144, 117, 160]),
    all('model-fade', 5, [3, 0, 0]),
    all('model-fade-high', 5, [32, 0, 0]),
    all('model-fade-low', 5, [-32, 0, 0]),
    all('model-recolour', 7, [-3, 5, 2]),
    all('model-colour-high', 7, [65, 40, 145]),
    all('model-colour-low', 7, [-65, -41, -145]),
    all('model-unused', 4, [7, 8, 9]),
    masked('arm-pivot', 0, [5, -3, 6], 2),
    masked('arm-move', 1, [-6, 3, 10], 2),
    masked('arm-turn', 2, [125, 1933, 348], 2, true),
    masked('arm-turn-zero', 2, [0, 0, 0], 2, true),
    masked('arm-turn-geometry', 2, [31, 0, 0], 2),
    masked('arm-scale', 3, [151, 117, 144], 2),
    masked('torso-world-move', 1, [-3, 4, 8], 1, false, basis),
    masked('torso-world-turn', 2, [121, 255, 513], 1, true, basis),
    masked('torso-world-turn-again', 2, [0, 0, 0], 1, false, basis),
    masked('both-pivot', 0, [2, -3, 1], 3),
    masked('both-world-scale', 3, [128, 115, 137], 3, false, basis),
    masked('both-world-scale-again', 3, [128, 128, 128], 3, false, basis),
    masked('torso-world-scale', 3, [128, 121, 140], 1, false, basis),
    masked('arm-fade', 5, [4, 0, 0], 2),
    masked('arm-fade-high', 5, [32, 0, 0], 2),
    masked('arm-fade-low', 5, [-32, 0, 0], 2),
    masked('arm-recolour', 7, [-3, 5, 2], 2),
    masked('arm-colour-high', 7, [-7, 35, 161], 2),
    masked('arm-colour-low', 7, [4, -40, -155], 2),
    masked('no-part-fade', 5, [9, 0, 0], 4),
    masked('no-labels', 0, [8, 12, -9], 3, false, null, new Int32Array(0)),
    masked('unused-op', 4, [7, 8, 9], 3),
    { ...all('discard-uploaded-colours-normals', 0, [0, 0, 0]), scope: 'discard' },
    masked('turn-after-discard', 2, [75, 85, 95], 2, true),
    masked('fade-after-discard', 5, [8, 0, 0], 2),
    { ...all('discard-labels', 1, [0, 0, 0]), scope: 'discard' },
    masked('fade-without-labels', 5, [8, 0, 0], 2),
    masked('recolour-without-labels', 7, [2, 5, 6], 2)
];

const arrays = ['pointX', 'pointY', 'pointZ', 'normalX', 'normalY', 'normalZ', 'faceColour', 'faceAlpha'] as const;
const streams = ['positionStream', 'colourStream', 'normalStream'] as const;
const fields = [...arrays, 'pivotX', 'pivotY', 'pivotZ', 'transformOrigin', ...streams, 'bounds.valid'];
function snapshot(model: GlModel): string[] {
    const components = arrays.map(name => (model[name] === null ? '-' : '[' + model[name].join(', ') + ']'));
    return [...components, ...[GlModel.pivotX, GlModel.pivotY, GlModel.pivotZ, GlModel.transformOrigin].map(String), ...streams.map(name => String(model[name]?.valid ?? '-')), String(model.bounds?.valid)];
}

loginFixture(
    import.meta.url,
    'HD whole-model and masked bone transforms match td after each animation operation',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-hd-animation-'));
        try {
            const commands = steps.map(s => [s.name, s.scope, s.op, ...s.xyz, s.rotateNormals, s.mask, s.labels.join(',') || '[]', s.matrix?.join(',') ?? '-'].join(' '));
            const input = join(dir, 'commands.txt');
            const output = join(dir, 'native.tsv');
            writeFileSync(input, commands.join('\n'));
            const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
            const sources = ['GlRecorder', 'HdTitleFrameOracle', 'HdGlModelAnimationOracle'].map(name => join(import.meta.dir, name + '.java'));
            const build = Bun.spawnSync(['javac', '-encoding', 'UTF-8', '-cp', cp, '-d', dir, ...sources]);
            expect(build.exitCode, build.stderr.toString()).toBe(0);
            const run = Bun.spawnSync([
                'java',
                '--add-opens=java.base/java.lang=ALL-UNNAMED',
                '-Djava.awt.headless=true',
                '-Dgltrace.stacks=false',
                '-cp',
                cp,
                'HdGlModelAnimationOracle',
                cachePath,
                join(import.meta.dir, 'rtx5070.json'),
                input,
                output
            ]);
            expect(run.exitCode, run.stderr.toString()).toBe(0);
            const rows = readFileSync(output, 'utf8').trimEnd().split(/\r?\n/);
            let cursor = 0;
            const compare = (name: string, step: string, model: GlModel) => {
                const [nativeMesh, nativeStep, ...native] = rows[cursor++].split('\t');
                expect([nativeMesh, nativeStep, native.length]).toEqual([name, step, fields.length]);
                for (const [i, value] of snapshot(model).entries()) expect(value, name + ' ' + step + ' ' + fields[i]).toBe(native[i]);
            };
            const assets = localAssets(cachePath, [7, 8, 9, 26]);
            const archive = assets.archive(7);
            Pix3D.textureProvider = new TextureCache(assets.archive(9), assets.archive(26), assets.archive(8), 20, false);
            for (const name of ['arms', 'arms-low-light', 'torso-arms', 'empty']) {
                // Archive 7 models 292 and 151 are the body meshes of identity kits 18 (torso) and 26 (arms).
                const raw = name === 'empty' ? new ModelUnlit(0, 0, 0) : name === 'torso-arms' ? new ModelUnlit([ModelUnlit.Load(archive, 292, 0), ModelUnlit.Load(archive, 151, 0)], 2) : requireNonNull(ModelUnlit.Load(archive, 151, 0));
                Preferences.highDetailLighting = name !== 'arms-low-light';
                const model = new GlModel(raw, 64, 768, false);
                model.buildAnimationTables();
                model.beginAnimate();
                compare(name, 'start', model);
                if (name === 'torso-arms') {
                    expect(new Set(requireNonNull(model.pointPartMask).subarray(0, model.vertexCount))).toEqual(new Set([1, 2, 3]));
                    expect(new Set(requireNonNull(model.facePartMask).subarray(0, model.faceCount))).toEqual(new Set([1, 2]));
                }
                for (const step of steps) {
                    for (const key of streams) {
                        const stream = model[key];
                        if (stream !== null) stream.valid = true;
                    }
                    requireNonNull(model.bounds).valid = true;
                    const [x, y, z] = step.xyz;
                    if (step.scope === 'discard') model.prepareBuffers(false, step.op === 0, step.op === 0, false, false, step.op === 1, false);
                    else if (step.scope === 'all') model.animateAll(step.op, x, y, z);
                    else model.animate2Masked(step.op, step.labels, x, y, z, step.rotateNormals, step.mask, step.matrix);
                    compare(name, step.name, model);
                }
                model.endAnimate();
                compare(name, 'end', model);
            }
            expect(cursor).toBe(rows.length);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    60000,
    'gl'
);
