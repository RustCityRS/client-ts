import { expect } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Js5 from '#/cache/Js5.js';
import Js5Index from '#/cache/Js5Index.js';
import ProceduralTexture from '#/dash3d/ProceduralTexture.js';
import TextureCache from '#/dash3d/TextureCache.js';
import TextureOp from '#/dash3d/TextureOp.js';
import Crc32 from '#/io/Crc32.js';
import PacketT from '#/io/PacketT.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { readGroup } from '../cachefile.js';
import { loginFixture } from '../login-fixture.js';
import { cachePath } from '../reference.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

function diskArchive(dir: string, archive: number) {
    const reference = readGroup(cachePath, 255, archive);
    const table = new Js5Index(reference, Crc32.prefix(reference, reference.length));
    const groups = new Map<number, Uint8Array>();
    const chunks: Uint8Array[] = [];
    function word(value: number) {
        const bytes = Buffer.alloc(4);
        bytes.writeUInt32BE(value);
        chunks.push(bytes);
    }
    word(reference.length);
    chunks.push(reference);
    const ids = requireNonNull(table.groupIds);
    for (const id of ids) {
        const data = readGroup(cachePath, archive, id);
        groups.set(id, data);
        word(id);
        word(data.length);
        chunks.push(data);
    }
    writeFileSync(join(dir, String(archive)), Buffer.concat(chunks));
    const js5 = new Js5(
        {
            index: () => table,
            group: (_mode, id) => groups.get(id) ?? null,
            GetGroupLoadPercentage: id => (groups.has(id) ? 100 : 0),
            prefetchGroup() {}
        },
        false,
        true
    );
    return { js5, ids };
}

// Inputs are normal encoded texture operators, including both channel types.
// Add/subtract produce negative and >4095 channels before the final clamp.
function syntheticGraphs() {
    const colour = (r: number, g: number, b: number) => [0, 1, 255, 1, 0, r, g, b];
    const mono = (value: number) => [0, 0, 255, 1, 0, value];
    const gradient = (op: 2 | 3) => [0, op, 255, 0];
    const combine = (mode: 1 | 2, a: number, b: number) => [0, 7, 255, 1, 0, mode, a, b];
    const graph = (ops: number[][], rgb: number, alpha: number) => Buffer.from([ops.length, ...ops.flat(), rgb, alpha]);
    const twoColours = [colour(202, 10, 91), colour(197, 36, 170)];
    return [
        graph([gradient(2), gradient(3)], 0, 1),
        graph([gradient(3), colour(83, 222, 11)], 0, 1),
        graph([colour(8, 19, 212), gradient(2)], 0, 1),
        graph([colour(0, 0, 0), mono(255)], 0, 1),
        graph([colour(1, 1, 1), mono(174)], 0, 1),
        graph([...twoColours, combine(1, 0, 1), combine(2, 1, 0)], 2, 3),
        graph([...twoColours, combine(1, 0, 1), combine(2, 1, 0)], 3, 2)
    ];
}

type Probe = { kind: 'packed' | 'rgba'; damage: 'none' | 'short' | 'gamma' | 'alpha' | 'red' | 'green' | 'blue' | 'lateGreen' | 'emptyGamma' | 'nullGamma' | 'conditionalAlpha'; graph: Buffer };

function channelProbe({ kind, damage, graph: bytes }: Probe): string {
    const graph = new ProceduralTexture(new PacketT(bytes));
    const previousGamma = ProceduralTexture.gammaTable;
    const visits: number[] = [];
    function state() {
        const caches = requireNonNull(graph['operators'])
            .map(op => (requireNonNull(op).monochromeImageCache ? 'm' : requireNonNull(op).colourImageCache ? 'c' : '-'))
            .join('');
        return '|' + visits.join(',') + '|' + caches;
    }
    try {
        if (damage !== 'none') {
            const root = damage === 'alpha' ? 'alpha' : 'colour';
            const source = requireNonNull(graph[root]);
            const damaged = new (class extends TextureOp {
                constructor() {
                    super(0, false);
                }
                override getColourOutput(row: number) {
                    visits.push(row);
                    if (damage === 'alpha') return [new Int32Array(0)];
                    const channels = requireNonNull(source.getColourOutput(row));
                    if (damage === 'short') return channels.slice(0, 1);
                    if (damage === 'red') return [new Int32Array(1), null, null];
                    if (damage === 'green' || (damage === 'lateGreen' && row === 1)) return [channels[0], new Int32Array(1), null];
                    if (damage === 'lateGreen') return channels;
                    if (damage === 'blue') return [channels[0], channels[1], new Int32Array(1)];
                    if (damage === 'emptyGamma' || damage === 'nullGamma') {
                        ProceduralTexture.gammaTable = damage === 'nullGamma' ? null : new Int32Array(0);
                        return channels;
                    }
                    if (damage === 'conditionalAlpha') return [Int32Array.of(4096, 0), new Int32Array(2), new Int32Array(2)];
                    ProceduralTexture.gammaTable = new Int32Array(0);
                    return [channels[0], channels[1], null];
                }
            })();
            graph[root] = damaged;
            if (damage === 'conditionalAlpha') {
                graph['alpha'] = new (class extends TextureOp {
                    constructor() {
                        super(0, false);
                    }
                    override getColourOutput() {
                        return [new Int32Array(0)];
                    }
                })();
            }
        }
        if (kind === 'packed') return graph.getPixels(null, null, false, 2, false, 1, 2).join(',') + state();
        return Buffer.from(graph.getPixelsRgba(2, 2, false, null, 1, null)).toString('hex') + state();
    } catch (error) {
        if (error instanceof RangeError && error.message.startsWith('array index ')) return 'bounds ' + error.message.split(' ').at(-1) + state();
        if (error instanceof TypeError && error.message === 'Null array') return 'null' + state();
        throw error;
    } finally {
        ProceduralTexture.gammaTable = previousGamma;
    }
}

loginFixture(
    import.meta.url,
    'HD procedural RGBA matches the original gamepack for the full texture cache and alpha edge cases',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), '530-hd-rgba-'));
        try {
            const textures = diskArchive(dir, 9);
            const sprites = diskArchive(dir, 8).js5;
            const materials = diskArchive(dir, 26).js5;
            const provider = new TextureCache(textures.js5, materials, sprites, 20, false);
            const cases = [];
            for (const graph of syntheticGraphs()) {
                for (const [height, width] of [
                    [4, 4],
                    [2, 4],
                    [4, 2],
                    [1, 1],
                    [0, 4],
                    [4, 0],
                    [-1, 3]
                ]) {
                    for (const transpose of [false, true]) {
                        for (const gamma of [0, 0.7, 1, 2]) cases.push({ graph, height, width, transpose, gamma });
                    }
                }
            }
            const probes: Probe[] = [];
            for (const kind of ['packed', 'rgba'] as const) {
                for (const graph of syntheticGraphs().slice(2, 4)) {
                    for (const damage of ['none', 'short', 'gamma', 'alpha'] as const) probes.push({ kind, damage, graph });
                    if (kind === 'rgba') {
                        for (const damage of ['red', 'green', 'blue', 'lateGreen', 'emptyGamma', 'nullGamma', 'conditionalAlpha'] as const) probes.push({ kind, damage, graph });
                    }
                }
            }
            const input = [...cases.map(c => [c.graph.toString('hex'), c.height, c.width, c.transpose, c.gamma].join(' ')), ...probes.map(p => ['probe', p.kind, p.damage, p.graph.toString('hex')].join(' '))].join('\n') + '\n';
            const jars = [hdGamepackPath, joglPath].join(delimiter);
            const compile = Bun.spawnSync(['javac', '-cp', jars, '-d', dir, join(import.meta.dir, 'HdProceduralRgbaOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const java = Bun.spawnSync(['java', '-Xmx384m', '-XX:-OmitStackTraceInFastThrow', '-Djava.awt.headless=true', '-cp', dir + delimiter + jars, 'HdProceduralRgbaOracle', dir], {
                stdin: Buffer.from(input),
                timeout: 180000,
                maxBuffer: 4 * 1024 * 1024
            });
            expect(java.exitCode, java.stderr.toString()).toBe(0);
            const expected = java.stdout.toString().trimEnd().split(/\r?\n/);
            expect(expected.length).toBe(textures.ids.length + cases.length + probes.length);

            let row = 0,
                nestedGraphs = 0,
                images = 0;
            const spriteIds = new Set<number>(),
                textureIds = new Set<number>();
            const differences: string[] = [];
            for (const id of textures.ids) {
                const packet = new PacketT(requireNonNull(textures.js5.GetFile(0, id)));
                const graph = new ProceduralTexture(packet);
                const spriteDeps = requireNonNull(graph['spriteIds']),
                    textureDeps = requireNonNull(graph['textureIds']);
                const [idText, pos, spriteCsv, textureCsv, ...hashes] = expected[row++].split('|');
                expect([String(id), String(packet.m_pos), spriteDeps.join(','), textureDeps.join(',')]).toEqual([idText, pos, spriteCsv, textureCsv]);
                expect(graph.isReady(provider, sprites), 'texture ' + id).toBe(true);
                for (const dep of spriteDeps) spriteIds.add(dep);
                for (const dep of textureDeps) textureIds.add(dep);
                if (textureDeps.length) nestedGraphs++;
                for (let flags = 0; flags < 4; flags++) {
                    const size = (flags & 1) === 0 ? 64 : 128,
                        transpose = (flags & 2) !== 0;
                    const gamma = ((id ^ flags) & 1) === 0 ? Math.fround(0.7) : 1;
                    const pixels = graph.getPixelsRgba(size, size, transpose, provider, gamma, sprites);
                    const hash = createHash('sha256').update(pixels).digest('hex');
                    if (hash !== hashes[flags]) differences.push(`texture ${id}, ${size} square, transpose ${transpose}: ${hash} != ${hashes[flags]}`);
                    images++;
                }
            }
            expect([textures.ids.length, images, spriteIds.size, nestedGraphs, textureIds.size]).toEqual([680, 2720, 28, 293, 189]);
            expect(differences.slice(0, 15), differences.length + ' full RGBA images differ').toEqual([]);
            for (const c of cases) {
                const graph = new ProceduralTexture(new PacketT(c.graph));
                let result: string;
                try {
                    const pixels = graph.getPixelsRgba(c.height, c.width, c.transpose, null, c.gamma, null);
                    result = Buffer.from(pixels).toString('hex');
                } catch (error) {
                    if (!(error instanceof RangeError)) throw error;
                    if (error.message.startsWith('array index ')) result = 'bounds ' + error.message.split(' ').at(-1);
                    else if (c.height * c.width < 0) result = 'negative';
                    else throw error;
                }
                const caches = requireNonNull(graph['operators'])
                    .map(value => {
                        const op = requireNonNull(value);
                        return op.monochromeImageCache ? 'm' : op.colourImageCache ? 'c' : '-';
                    })
                    .join('');
                expect(['case', result, TextureOp.width + ',' + TextureOp.height, caches].join('|'), [c.graph.toString('hex'), c.height, c.width, c.transpose, c.gamma].join(' ')).toBe(expected[row++]);
            }
            for (const p of probes) {
                expect('probe|' + channelProbe(p), [p.kind, p.damage, p.graph.toString('hex')].join(' ')).toBe(expected[row++]);
            }
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    240000,
    'gl'
);
