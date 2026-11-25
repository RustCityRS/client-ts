import { expect } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import ObjType from '#/config/ObjType.js';
import GlModel from '#/dash3d/GlModel.js';
import type GlModelStream from '#/dash3d/GlModelStream.js';
import ModelUnlit from '#/dash3d/ModelUnlit.js';
import Pix3D from '#/dash3d/Pix3D.js';
import TextureCache from '#/dash3d/TextureCache.js';
import GlRenderer from '#/gl/GlRenderer.js';
import GlLighting from '#/gl/GlLighting.js';
import { capsProfileFromJson } from '#/gl/CapsProfile.js';
import { GlTraceWriter } from '#/gl/GlTrace.js';
import NullGL from '#/gl/NullGL.js';
import RecordingGL from '#/gl/RecordingGL.js';
import Preferences from '#/ui/Preferences.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { localAssets } from '../cachefile.js';
import { loginFixture } from '../login-fixture.js';
import { cachePath } from '../reference.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

type ModelArray = Uint8Array | Int16Array | Int32Array | Float32Array | (Int32Array | null)[] | null;
function hash(a: ModelArray): string {
    if (a === null) return '-';
    const values = a instanceof Float32Array ? new Int32Array(a.buffer, a.byteOffset, a.length) : a instanceof Uint8Array ? new Int8Array(a.buffer, a.byteOffset, a.length) : Array.isArray(a) ? a.map(v => (v === null ? 0 : Number(hash(v)))) : a;
    let h = 1;
    for (const v of values) h = (Math.imul(h, 31) + v) | 0;
    return String(h);
}
function stream(s: GlModelStream | null): string {
    if (s === null) return '-';
    const b = requireNonNull(s.buffer);
    const bytes = b.storageBytes().subarray(0, b.limit());
    return [s.offset, s.stride, s.valid, createHash('sha256').update(bytes).digest('hex')].join(',');
}

loginFixture(
    import.meta.url,
    'GlModel expanded vertices and packed streams match td in both byte orders and lighting modes',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-gl-model-'));
        try {
            const assets = localAssets(cachePath, [7, 8, 9, 19, 26]),
                archive = assets.archive(7);
            const ids = [0, 2, 9, 12, 53, 115, 475, 505, 543, 2003, 2804, 4500, 6019, 7480, 8844, 10327, 12489, 17935, 21590, 23425, 23426, 23787, 27561, 30000, 37000, 40000].filter(id => archive.GetFile(0, id) !== null);
            expect(ids.length).toBeGreaterThan(15);
            const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
            const sources = ['GlRecorder', 'HdTitleFrameOracle', 'HdGlModelOracle'].map(n => join(import.meta.dir, n + '.java'));
            const build = Bun.spawnSync(['javac', '-encoding', 'UTF-8', '-cp', cp, '-d', dir, ...sources]);
            expect(build.exitCode, build.stderr.toString()).toBe(0);
            const jar = Bun.spawnSync(['java', '--add-opens=java.base/java.lang=ALL-UNNAMED', '-Djava.awt.headless=true', '-Dgltrace.stacks=false', '-cp', cp, 'HdGlModelOracle', cachePath, join(import.meta.dir, 'rtx5070.json'), ids.join(','), dir]);
            expect(jar.exitCode, jar.stderr.toString()).toBe(0);
            const rows = jar.stdout
                .toString()
                .split(/\r?\n/)
                .filter(l => l.startsWith('mesh '));
            expect(rows.length).toBe(ids.length * 4);
            GlRenderer.vboSupported = GlRenderer.streamVbo = false;
            GlLighting.sunDirection = Float32Array.of(-50, -60, -50, 0);
            const textures = new TextureCache(assets.archive(9), assets.archive(26), assets.archive(8), 20, false);
            Pix3D.textureProvider = textures;
            const colours = requireNonNull(Pix3D.colourTable);
            for (let i = 0; i < colours.length; i++) colours[i] = Math.imul(i, 109123) & 0xffffff;
            const arrays = [
                'pointX',
                'pointY',
                'pointZ',
                'vertexOffsets',
                'vertexIndices',
                'normalX',
                'normalY',
                'normalZ',
                'normalCount',
                'texU',
                'texV',
                'faceColour',
                'faceAlpha',
                'faceVertexA',
                'faceVertexB',
                'faceVertexC',
                'faceMaterial',
                'materialRuns',
                'labelVertices',
                'labelFaces',
                'pointPartMask',
                'facePartMask'
            ] as const;
            const streams = ['positionStream', 'colourStream', 'normalStream', 'uvStream', 'indexStream'] as const;
            for (const row of rows) {
                const [_, name, ...expected] = row.split(' '),
                    [id, state] = name.split('/').map(Number);
                Preferences.highDetailLighting = (state & 1) !== 0;
                GlRenderer.bigEndian = (state & 2) !== 0;
                const mesh = new GlModel(requireNonNull(ModelUnlit.Load(archive, id, 0)), 64, 768, (id & 1) !== 0);
                mesh.buildAnimationTables();
                const actual = [mesh.vertexCount, mesh.expandedVertexCount, mesh.faceCount].map(String);
                for (const key of arrays) actual.push(hash(mesh[key]));
                mesh['uploadVertices'](false, true, true, Preferences.highDetailLighting, true);
                mesh['uploadIndices']();
                for (const key of streams) actual.push(stream(mesh[key]));
                const fields = ['vertices', 'expanded', 'faces', ...arrays, ...streams];
                for (const [i, value] of actual.entries()) expect(value, name + ' ' + fields[i]).toBe(expected[i]);
            }
            const unlit = requireNonNull(ModelUnlit.Load(archive, 2, 0));
            ObjType.Init(assets.archive(19), true, null, archive);
            GlRenderer.active = true;
            GlRenderer.bigEndian = false;
            const items = [592, 1155].map(id => {
                const item = ObjType.List(id);
                const model = item.GetModelLit(null, 0, 1, 0, 0);
                if (!(model instanceof GlModel)) throw new Error('Expected a cached GL item model for ' + id);
                const reused = model === item.GetModelLit(null, 0, 1, 0, 0);
                return ['item', id, reused, model.texU === null, model.texV === null, stream(model.uvStream)].join(' ');
            });
            expect(items).toEqual(
                jar.stdout
                    .toString()
                    .split(/\r?\n/)
                    .filter(line => line.startsWith('item '))
            );
            const mergeResults: string[] = [];
            for (const receiver of [new GlModel(), new GlModel(unlit, 64, 768, false)]) {
                for (const other of [null, unlit]) {
                    try {
                        receiver.mergeNormals(other, 0, 0, 0, false);
                        mergeResults.push('merge ok');
                    } catch (error) {
                        if (!(error instanceof TypeError)) throw error;
                        mergeResults.push(error.message.startsWith('ClassCastException') ? 'merge ClassCastException' : 'merge NullPointerException');
                    }
                }
            }
            expect(mergeResults).toEqual(
                jar.stdout
                    .toString()
                    .split(/\r?\n/)
                    .filter(l => l.startsWith('merge '))
            );
            // The native fixture intercepts m.a(IZ)V at the same boundary. Both clients submit the actual model draws.
            const writer = new GlTraceWriter();
            GlRenderer.gl = new RecordingGL(new NullGL(capsProfileFromJson(readFileSync(join(import.meta.dir, 'rtx5070.json'), 'utf8'))), writer);
            textures.bindTexture = (id, bind) => {
                writer.mark('texture.' + id + '.' + bind);
            };
            Pix3D.clipMinX = -382;
            Pix3D.clipMaxX = 383;
            Pix3D.clipMinY = -251;
            Pix3D.clipMaxY = 252;
            for (const id of [0, 2, 115, 543, 4500])
                for (let state = 0; state < 8; state++) {
                    Preferences.highDetailLighting = (state & 1) !== 0;
                    GlRenderer.vboSupported = (state & 2) !== 0;
                    GlRenderer.streamVbo = (state & 4) !== 0 && GlRenderer.vboSupported;
                    GlRenderer.bigEndian = false;
                    GlModel.resetTempModels();
                    const base = new GlModel(ModelUnlit.Load(archive, id, 0), 64, 768, (id & 1) !== 0);
                    base.buildAnimationTables();
                    writer.mark('base.' + id + '.' + state);
                    GlRenderer.bindTexture2D(7);
                    base.ObjRender(17, 44, -108, 152, -11, 72, 605, 1n);
                    const actor = base.CopyForAnimActor(false, false, false);
                    if (actor.beginAnimate()) {
                        const labels = Int32Array.of(0, 2, 5, 1);
                        actor.Animate2(0, labels, 12, -20, 3, true);
                        actor.Animate2(2, labels, 1013, 750, 1536, true);
                        actor.Animate2(1, labels, -15, 31, 4, true);
                        actor.endAnimate();
                    }
                    writer.mark('actor.' + id + '.' + state);
                    actor.draw(83, 0, 65536, 0, 65536, 15, -13, 640, 0n, 0, null);
                }
            const native = readFileSync(join(dir, 'trace.tsv'), 'utf8')
                .split(/\r?\n/)
                .filter(l => /^\d/.test(l));
            const submitted = writer
                .text()
                .split('\n')
                .filter(l => /^\d/.test(l));
            expect(native.length).toBeGreaterThan(1000);
            expect(submitted.length).toBe(native.length);
            for (const [i, line] of native.entries()) expect(submitted[i], 'submitted call ' + i).toBe(line);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    60000,
    'gl'
);
