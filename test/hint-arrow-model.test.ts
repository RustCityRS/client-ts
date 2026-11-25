import { expect } from 'bun:test';
import WrappedException from '#/util/WrappedException.js';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import ClientBuild from '#/client/ClientBuild.js';
import HintArrow from '#/client/HintArrow.js';
import ModelLitImpl from '#/dash3d/ModelLitImpl.js';
import Pix3D from '#/dash3d/Pix3D.js';
import world from '#/dash3d/world.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { loginFixture } from './login-fixture.js';
import { localAssets } from './cachefile.js';
import { gamepackPath, cachePath } from './reference.js';

type Case = [id: number, angle: number, x: number, z: number, height: number, level: number, mode: number, reset: number];

loginFixture(
    import.meta.url,
    'hint arrow models match the JAR cache, lighting, scratch model, yaw and terrain adjustments',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), '530-arrow-model-'));
        try {
            const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
            const compile = Bun.spawnSync(['javac', asm, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'review/model-mesh/ModelMeshOracle.java'), join(import.meta.dir, 'game/HintArrowModelOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const cmd = ['java', asm, '-XX:-OmitStackTraceInFastThrow', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'HintArrowModelOracle'];
            const patch = Bun.spawnSync([...cmd, gamepackPath, dir]);
            expect(patch.exitCode, patch.stderr.toString()).toBe(0);
            const archive = localAssets(cachePath, [7]).archive(7);
            const modelIds = requireNonNull(requireNonNull(requireNonNull(archive['provider']).index()).groupIds);
            const ids = [0, 1, 2, 3, 4, 7, 73, 177, 1396].map(i => modelIds[i]);
            const rows: Case[] = [];
            for (const [j, id] of ids.entries()) {
                for (const angle of [0, 1, 77, 511, 512, 1024, 1536, 2047]) {
                    for (const [mode, height] of [
                        [0, 0],
                        [0, 47],
                        [1, -257],
                        [2, 2147483542],
                        [10, -2147483648],
                        [11, 1]
                    ])
                        rows.push([id, angle, 6491, 7923, height, j & 3, mode, 0]);
                }
            }
            for (let mode = 0; mode < 14; mode++) {
                for (const id of [ids[0], -1, 2147483647]) {
                    for (const [angle, x, z, level] of [
                        [0, 65, 27, 0],
                        [991, 13250, 13249, 2],
                        [-1, 6444, 6444, 1],
                        [2048, 2147483647, -2147483648, 3],
                        [0, -2147483648, 2147483647, -1],
                        [0, 6490, 6492, 5]
                    ])
                        rows.push([id, angle, x, z, -917, level, mode, 1]);
                }
            }
            // Repeated lookups across the four-entry LRU, including using an already-cached model without rk.k.
            for (const i of [0, 1, 2, 3, 0, 4, 1, 3, 0, 5, 4, 0, 2]) rows.push([ids[i], 73, 4608, 6272, 181, 1, i === 3 ? 4 : 2, 0]);
            const java = Bun.spawnSync([...cmd, cachePath], { stdin: Buffer.from(rows.map(r => r.join(' ')).join('\n') + '\n'), maxBuffer: 4 * 1024 * 1024, timeout: 30000 });
            expect(java.exitCode, java.stderr.toString()).toBe(0);
            const expected = java.stdout.toString().trimEnd().split(/\r?\n/);
            expect(expected.length).toBe(rows.length);
            const heights = Array.from({ length: 4 }, (_, p) => Array.from({ length: 105 }, (_, x) => Int32Array.from({ length: 105 }, (_, z) => (p * 131 + x * 7 - z * 11) * 10001)));
            const flat = Array.from({ length: 4 }, () => Array.from({ length: 105 }, () => new Int32Array(105)));
            const flags = Array.from({ length: 4 }, () => Array.from({ length: 104 }, (_, x) => Uint8Array.from({ length: 104 }, (_, z) => ((x + z) % 3 === 0 ? 2 : 0))));
            const emptyFlags = Array.from({ length: 4 }, () => Array.from({ length: 104 }, () => new Uint8Array(104)));
            Pix3D.textureProvider = {
                getTextureSmall: () => true,
                isAvailable: id => id % 7 !== 3,
                getPixels: () => null,
                isLoaded: () => true,
                getTextureData: () => null,
                getTextureColour: id => (Math.imul(id, 0x1f3d) + 0x123) & 0xffff,
                getTextureSolid: id => (id & 1) === 0
            };
            const identity = new Map<object, number>();
            function tag(obj: object | null): number {
                if (obj === null) return 0;
                const prev = identity.get(obj);
                if (prev !== undefined) return prev;
                const next = identity.size + 1;
                identity.set(obj, next);
                return next;
            }
            function state(m: ModelLitImpl | null): string {
                if (m === null) return '-';
                const hash = createHash('sha256'),
                    refs: number[] = [];
                const arrays = [m.pointX, m.pointY, m.pointZ, m['faceColourA'], m['faceColourB'], m['faceColourC']];
                for (const [i, row] of arrays.entries()) {
                    refs.push(tag(row));
                    if (row !== null) {
                        const size = Math.min(row.length, i < 3 ? m.numPoints : m['numFaces']),
                            buf = Buffer.alloc(size * 4);
                        for (let j = 0; j < size; j++) buf.writeInt32BE(row[j], j * 4);
                        hash.update(buf);
                    }
                }
                return [tag(m), m.numPoints, m['numFaces'], m.boundsCalculated, refs.join(','), hash.digest('hex')].join(':');
            }
            let calls = 0,
                samples = 0,
                trace = 1,
                mode = 0;
            const fetch = archive.GetFile.bind(archive),
                height = Client.GetAvH;
            archive.GetFile = (file, group) => {
                calls++;
                return fetch(file, group);
            };
            Client.GetAvH = (x, z, level, guard) => {
                samples++;
                trace = (Math.imul((Math.imul((Math.imul(trace, 31) + level) | 0, 31) + x) | 0, 31) + z) | 0;
                if (guard === undefined) throw new Error('missing height guard');
                trace = (Math.imul(trace, 31) + guard) | 0;
                if (mode === 10 && samples === 2) Client.playerLevel = 3;
                if (mode === 11 && samples === 4) ClientBuild.m_mapl = null;
                return height(x, z, level, guard);
            };
            for (const [i, [id, angle, x, z, baseY, level, scenario, reset]] of rows.entries()) {
                mode = scenario;
                if (reset) HintArrow.clearModelCache();
                Client.playerLevel = level;
                world.levelHeightmaps = mode === 0 ? flat : heights;
                ClientBuild.m_mapl = mode === 1 ? emptyFlags : flags;
                let base: ModelLitImpl | null = new ModelLitImpl();
                base.numPoints = 3;
                base.pointX = Int32Array.of(-150, 21, 201);
                base.pointY = Int32Array.of(-9, 0, 101);
                base.pointZ = Int32Array.of(19, 172, -120);
                Client.modelsArchive = archive;
                if (mode === 3) base = null;
                if (mode === 4) Client.modelsArchive = null;
                if (mode === 5) ClientBuild.m_mapl = null;
                if (mode === 6) world.levelHeightmaps = null;
                if (mode === 7) HintArrow.modelCache.Put(BigInt(id), new ModelLitImpl());
                if (mode === 8) HintArrow.modelCache.Put(BigInt(id), {});
                if (mode === 9) requireNonNull(base).pointX = null;
                if (mode === 12) requireNonNull(base).numPoints = 0;
                if (mode === 13) world.levelHeightmaps = [];
                samples = 0;
                trace = 1;
                calls = 0;
                let result = 'ok',
                    value: ModelLitImpl | null = null;
                try {
                    const built = HintArrow.buildArrowModel(angle, z, id, base, baseY, x);
                    if (built !== null && !(built instanceof ModelLitImpl)) throw new Error('wrong model subtype');
                    value = built;
                } catch (caught) {
                    let err = caught;
                    while (err instanceof WrappedException) err = err.cause;
                    if (err instanceof TypeError && err.message.startsWith('Null ')) result = 'null';
                    else if (err instanceof RangeError && /^array index -?\d+$/.test(err.message)) result = 'index' + err.message.slice(12);
                    else if (err instanceof TypeError && err.message.startsWith('ClassCastException')) result = 'cast';
                    else throw err;
                }
                const cached = HintArrow.modelCache.Find(BigInt(id));
                const cs = cached instanceof ModelLitImpl ? state(cached) : cached === null ? '-' : 'other';
                const text = [result, calls, samples, trace].join(' ') + '|' + cs + '|' + state(value) + '|' + state(ModelLitImpl['tempSpotModel']);
                expect(text, 'case ' + i + ' ' + rows[i].join(' ')).toBe(expected[i]);
            }
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    60000
);
