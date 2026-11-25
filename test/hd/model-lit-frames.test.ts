import { expect } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import SeqType from '#/config/SeqType.js';
import AnimFrameSet from '#/dash3d/AnimFrameSet.js';
import GlModel from '#/dash3d/GlModel.js';
import ModelLitImpl from '#/dash3d/ModelLitImpl.js';
import Pix2D from '#/graphics/Pix2D.js';
import { digest } from './model-bytes.js';
import ModelUnlit from '#/dash3d/ModelUnlit.js';
import Pix3D from '#/dash3d/Pix3D.js';
import TextureCache from '#/dash3d/TextureCache.js';
import Preferences from '#/ui/Preferences.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { localAssets } from '../cachefile.js';
import { loginFixture } from '../login-fixture.js';
import { cachePath } from '../reference.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

loginFixture(
    import.meta.url,
    'HD masked and split animation frame selection matches ak on player idle, walk and punch sequences',
    async () => {
        const assets = localAssets(cachePath, [0, 1, 7, 8, 9, 20, 26]);
        const archive = assets.archive(7);
        SeqType.Init(assets.archive(20), assets.archive(1), assets.archive(0));
        Pix3D.textureProvider = new TextureCache(assets.archive(9), assets.archive(26), assets.archive(8), 20, false);
        Preferences.highDetailLighting = true;
        const idle = requireNonNull(SeqType.List(808).frames),
            walk = requireNonNull(SeqType.List(819).frames);
        const punch = SeqType.List(422),
            otherBase = requireNonNull(SeqType.List(460).frames)[0];
        const punch0 = requireNonNull(punch.frames)[0],
            punch1 = requireNonNull(punch.frames)[1],
            mask = requireNonNull(punch.mask);
        const basis = Int32Array.of(0, 0, 32768, 0, 32768, 0, -32768, 0, 0, 3, -2, 5, -5, 2, -3);
        const sets = new Map<number, AnimFrameSet>();
        function frame(packed: number): [AnimFrameSet | null, number] {
            if (packed < 0) return [null, -1];
            const group = packed >>> 16;
            let set = sets.get(group);
            if (!set) {
                set = new AnimFrameSet(assets.archive(0), assets.archive(1), group, false);
                sets.set(group, set);
            }
            return [set, packed & 65535];
        }
        const skeleton = (id: number) => {
            const [set, index] = frame(id);
            return requireNonNull(requireNonNull(set).frames[index]).base;
        };
        expect(skeleton(idle[0])).toBe(skeleton(walk[0]));
        expect(skeleton(idle[0])).not.toBe(skeleton(punch0));
        expect(skeleton(idle[0])?.id).toBe(skeleton(punch0)?.id);
        expect(skeleton(idle[0])?.id).not.toBe(skeleton(otherBase)?.id);
        const cases: { name: string; split?: boolean; a: number; b?: number; c?: number; d?: number; part?: number; matrix?: boolean; mask?: boolean; normals?: boolean; discard?: boolean; still?: boolean }[] = [
            { name: 'masked-missing-frame', a: -1, still: true },
            { name: 'masked-without-bones', a: walk[0], discard: true, still: true },
            { name: 'masked-torso', a: idle[0], part: 1 },
            { name: 'masked-arms', a: walk[0], part: 2, matrix: true },
            { name: 'masked-tween', a: walk[0], b: walk[1], part: 3, matrix: true, normals: true },
            { name: 'masked-separate-base-object', a: walk[0], b: punch0, part: 2, matrix: true },
            { name: 'masked-different-skeleton', a: walk[0], b: otherBase, part: 2, matrix: true },
            { name: 'split-missing-first', split: true, a: -1, c: punch0, mask: true, still: true },
            { name: 'split-fallback-no-mask', split: true, a: walk[0], b: walk[1], c: punch0, normals: true },
            { name: 'split-fallback-no-overlay', split: true, a: walk[0], b: walk[1], mask: true, normals: true },
            { name: 'split-without-bones', split: true, a: idle[0], c: walk[0], mask: true, discard: true, still: true },
            { name: 'split-no-tweens', split: true, a: idle[0], c: punch0, mask: true },
            { name: 'split-matching-tweens', split: true, a: walk[0], b: walk[1], c: idle[0], d: idle[1], mask: true, normals: true },
            { name: 'split-walk-and-punch', split: true, a: walk[0], b: walk[1], c: punch0, d: punch1, mask: true, normals: true },
            { name: 'punch-with-walking-legs', split: true, a: punch0, b: punch1, c: walk[0], d: walk[1], mask: true, normals: true },
            { name: 'punch-without-walking-legs', split: true, a: punch0, b: punch1, c: walk[0], d: walk[1], normals: true },
            { name: 'split-reject-primary-tween', split: true, a: walk[0], b: otherBase, c: idle[0], d: idle[1], mask: true },
            { name: 'split-reject-overlay-tween', split: true, a: walk[0], b: walk[1], c: idle[0], d: otherBase, mask: true }
        ];
        const dir = mkdtempSync(join(tmpdir(), 'rs530-hd-frame-selection-'));
        try {
            const input = join(dir, 'commands.txt'),
                output = join(dir, 'native.tsv');
            writeFileSync(input, cases.map(k => [k.name, k.split ? 'split' : 'masked', k.a, k.b ?? -1, k.c ?? -1, k.d ?? -1, k.part ?? 3, !!k.matrix, !!k.mask, !!k.normals, !!k.discard].join(' ')).join('\n'));
            const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
            const sources = ['GlRecorder', 'HdTitleFrameOracle', 'HdGlModelAnimationOracle', 'HdModelLitFramesOracle'].map(n => join(import.meta.dir, n + '.java'));
            const build = Bun.spawnSync(['javac', '-encoding', 'UTF-8', '-cp', cp, '-d', dir, ...sources]);
            expect(build.exitCode, build.stderr.toString()).toBe(0);
            const run = Bun.spawnSync([
                'java',
                '--add-opens=java.base/java.lang=ALL-UNNAMED',
                '-Djava.awt.headless=true',
                '-Dgltrace.stacks=false',
                '-cp',
                cp,
                'HdModelLitFramesOracle',
                cachePath,
                join(import.meta.dir, 'rtx5070.json'),
                input,
                output
            ]);
            expect(run.exitCode, run.stderr.toString()).toBe(0);
            const rows = readFileSync(output, 'utf8').trimEnd().split(/\r?\n/);
            let cursor = 0;
            const finalPoints = new Map<string, string>();
            function compare(name: string, step: string, m: GlModel): string {
                const [mesh, phase, ...expected] = rows[cursor++].split('\t');
                expect([mesh, phase]).toEqual([name, step]);
                const coords = [m.pointX, m.pointY, m.pointZ, m.normalX, m.normalY, m.normalZ, m.faceColour, m.faceAlpha].map(a => (a === null ? '-' : '[' + a.join(', ') + ']'));
                const staticState = [GlModel.pivotX, GlModel.pivotY, GlModel.pivotZ, GlModel.transformOrigin].map(String);
                const flags = [m.positionStream, m.colourStream, m.normalStream].map(s => String(s?.valid ?? '-'));
                expect([...coords, ...staticState, ...flags, String(m.bounds?.valid)], name + ' ' + step).toEqual(expected);
                return coords.slice(0, 3).join('/');
            }
            for (const k of cases) {
                const m = new GlModel(new ModelUnlit([ModelUnlit.Load(archive, 292, 0), ModelUnlit.Load(archive, 151, 0), ModelUnlit.Load(archive, 40250, 0)], 3), 64, 768, false);
                m.buildAnimationTables();
                if (k.discard) m.prepareBuffers(false, false, false, false, false, true, false);
                const before = compare(k.name, 'before', m);
                const [a, ai] = frame(k.a),
                    [b, bi] = frame(k.b ?? -1),
                    [c, ci] = frame(k.c ?? -1),
                    [d, di] = frame(k.d ?? -1);
                if (k.split) m.SplitAnimate(a, ai, b, bi, 2, 7, c, ci, d, di, 3, 8, k.mask ? mask : null, !!k.normals);
                else m.animateMasked(a, ai, b, bi, 2, 7, k.part ?? 3, !!k.normals, k.matrix ? basis : null);
                const after = compare(k.name, 'after', m);
                expect(after === before, k.name + ' moves the mesh').toBe(!!k.still);
                finalPoints.set(k.name, after);
            }
            const parts = [292, 151, 40250].map(id => ModelUnlit.Load(archive, id, 0));
            const software = new ModelLitImpl(new ModelUnlit(parts, 3), 64, 768, -50, -10, -50);
            function mesh(label: string, m: ModelLitImpl): void {
                const arrays = [m.pointX, m.pointY, m.pointZ, m['faceVertexA'], m['faceVertexB'], m['faceVertexC'], m['faceColourA'], m['faceColourB'], m['faceColourC'], m['faceColour'], m['faceAlpha']];
                expect([label, m.numPoints, ...arrays.map(digest)].join(' '), label).toBe(rows[cursor++]);
            }
            mesh('source', software);
            const [first, fi] = frame(walk[0]),
                [next, ni] = frame(walk[1]);
            for (const part of [1, 2, 3]) {
                software.animateMasked(first, fi, next, ni, 2, 7, part, true, part === 1 ? null : basis);
                mesh('masked ' + part, software);
            }
            const joined = software.AppendModel(new ModelLitImpl(ModelUnlit.Load(archive, 292, 0), 64, 768, -50, -10, -50)) as ModelLitImpl;
            mesh('joined', joined);
            for (let type = 0; type <= 9; type++) {
                let outcome = 'ok';
                try {
                    joined.animateAll(type, 11, 23, 7);
                    joined.endAnimate();
                } catch (error) {
                    if (!(error instanceof TypeError)) throw error;
                    outcome = 'null';
                }
                mesh('all ' + type + ' ' + outcome, joined);
            }
            software.animateAll(7, 3, -1, 4);
            software.endAnimate();
            mesh('relit', software);
            for (const y of [1, 2, 3, 8, 9, 10])
                for (const x of [-5, -4, 0, 6, 7]) {
                    expect('hit ' + x + ' ' + y + ' ' + software['FastInsideTriangle'](x, y, 2, 9, 2, -4, 6, -1)).toBe(rows[cursor++]);
                }
            const pixels = new Int32Array(320 * 240);
            Pix2D.setPixels(pixels, 320, 240);
            Pix3D.setRenderClipping();
            for (let i = 0; i < requireNonNull(Pix3D.colourTable).length; i++) requireNonNull(Pix3D.colourTable)[i] = (Math.imul(i, 0x8357) + 0x23b1) & 0xffffff;
            function expectPixels(label: string): number {
                const count = pixels.reduce((n, v) => n + (v === 0 ? 0 : 1), 0);
                expect([label, digest(pixels), count].join(' '), label).toBe(rows[cursor++]);
                return count;
            }
            const worldPixels: number[] = [];
            for (const z of [40, 50, 70, 130, 290, 620]) {
                pixels.fill(0);
                software.draw(384, 0, 65536, 0, 65536, 0, 47, z, 0n, 0, null);
                worldPixels.push(expectPixels('world ' + z));
            }
            expect(Math.max(...worldPixels)).toBeGreaterThan(0);
            for (const zoom of [0, 100, 384, 1024]) {
                pixels.fill(0);
                software.ObjRenderOrthog(0, 384, 0, 0, 0, 47, 300, zoom);
                const count = expectPixels('ortho ' + zoom);
                if (zoom === 384) expect(count).toBeGreaterThan(0);
            }
            expect(cursor).toBe(rows.length);
            expect(finalPoints.get('masked-separate-base-object')).toBe(finalPoints.get('masked-arms'));
            expect(finalPoints.get('masked-different-skeleton')).toBe(finalPoints.get('masked-arms'));
            expect(finalPoints.get('split-fallback-no-overlay')).toBe(finalPoints.get('split-fallback-no-mask'));
            expect(finalPoints.get('split-walk-and-punch')).not.toBe(finalPoints.get('split-fallback-no-mask'));
            expect(finalPoints.get('punch-with-walking-legs')).not.toBe(finalPoints.get('punch-without-walking-legs'));
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    60000,
    'gl'
);
