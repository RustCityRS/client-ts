import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import TextureOp from '#/dash3d/TextureOp.js';
import TextureOpBricks from '#/dash3d/TextureOpBricks.js';
import TextureOpIrregularBricks from '#/dash3d/TextureOpIrregularBricks.js';
import TextureOpPerlinNoise from '#/dash3d/TextureOpPerlinNoise.js';
import TextureOpVoronoiNoise from '#/dash3d/TextureOpVoronoiNoise.js';
import TextureOpLineNoise from '#/dash3d/TextureOpLineNoise.js';
import PacketT from '#/io/PacketT.js';
import JavaRandom from '#/util/JavaRandom.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { gamepackPath } from '../reference.js';
import { loginFixture } from '../login-fixture.js';

const types = { hh: TextureOpBricks, wb: TextureOpIrregularBricks, vk: TextureOpPerlinNoise, je: TextureOpVoronoiNoise, kk: TextureOpLineNoise };
type Name = keyof typeof types;
type Row = [Name, number, number, number, string];
const names = {
    hh: 'yEdges halfMortar mortar colours xEdges heightVariation colourVariation widthVariation columns brickWidth brickHeight rows stagger yOffset',
    wb: 'colourVariation bevelPixels bevelMode bevelVariation minHeight maxWidth seed maxHeight minWidth bevel',
    vk: 'bias amplitudes octaves permutation seed xScale frequencies persistence yScale',
    je: 'jitter xCells offsets yCells permutation seed output metric',
    kk: 'length angle count angleRange seed'
};
function vectors(): Row[] {
    const rows: Row[] = [];
    const d = (code: number, hex: string) => 'D' + code + ':' + hex + ':0';
    for (const kind of Object.keys(types) as Name[]) {
        for (const [w, h] of [
            [1, 1],
            [4, 4],
            [8, 8],
            [13, 17],
            [16, 8],
            [16, 16],
            [32, 32],
            [64, 64],
            [64, 32]
        ])
            for (const cap of [0, 1, 2, 255]) {
                const setup = kind === 'kk' ? d(1, '0025') + ',' : '';
                rows.push([kind, w, h, cap, setup + 'P,G0,W,G0,G1,G0,A']);
                if (cap === 255) rows.push([kind, w, h, cap, 'P,A,W,A,G-1,G' + h]);
            }
        rows.push([kind, 128, 128, 255, 'P,A,W,A']);
        for (const fault of ['X', 'X1', 'Y', 'Y1', 'Z']) rows.push([kind, 16, 16, 255, 'P,' + fault + ',G1,G1,G0']);
        for (let code = -1; code <= 9; code++)
            for (const packet of ['n', '-', '00', '7f21', 'fffe000900020003'])
                for (const pos of [-1, 0, 1]) {
                    rows.push([kind, 8, 8, 1, 'v,D' + code + ':' + packet + ':' + pos + ',P']);
                }
    }
    for (const n of [0, 1, 2, 31, 127, 255]) {
        const b = n.toString(16).padStart(2, '0');
        for (const [width, height] of [
            [16, 16],
            [32, 32],
            [64, 32]
        ]) {
            rows.push(['hh', width, height, 255, [d(0, b), d(1, b), d(2, 'fa00'), d(3, 'ee01'), d(4, '1234'), d(5, 'e100'), d(6, '0021'), d(7, '8123'), 'P', 'A'].join(',')]);
            rows.push(['wb', width, height, 255, [d(0, b), d(6, b), d(5, '0a00'), d(7, '0500'), d(8, '0e00'), 'P', 'A'].join(',')]);
            rows.push(['kk', width, height, 255, [d(0, b), d(1, '003a'), d(2, b), d(3, 'fc00'), d(4, '0000'), 'P', 'A'].join(',')]);
            for (const p of ['0001', '0666', '4000', 'ffff000800000009fff7', '0000']) {
                rows.push(['vk', width, height, 2, [d(4, b), d(2, p), d(5, '07'), d(6, '11'), d(0, '00'), 'P', 'S', 'A', 'G0'].join(',')]);
            }
            for (let metric = 0; metric <= 6; metric++)
                for (let out = 0; out <= 5; out++) {
                    rows.push(['je', width, height, 2, [d(1, b), d(2, n % 2 ? 'ffff' : '0800'), d(3, '0' + out), d(4, '0' + metric), d(5, '03'), d(6, '0b'), 'P', 'S', 'A'].join(',')]);
                }
        }
    }
    for (const octaves of [0, 1, 2, 4, 12, 16, 31, 32, 63, 255]) {
        const count = octaves.toString(16).padStart(2, '0');
        rows.push(['vk', 8, 8, 255, 'D1:' + count + ':0,P,T,A']);
    }
    for (const perm of [-1, 0, 148, 255, 256, 512])
        for (const x of [-2147483648, -4097, 0, 2999, 4096, 2147483647]) {
            rows.push(['vk', 1, 1, 1, 'P,H512:7:' + perm + ':4:' + x + ':-1788,T']);
        }
    for (const [x, w, h] of [
        [0, 1, 1],
        [3, 13, 6],
        [12, 10, 9],
        [26, 3, 4],
        [-2, 8, 4],
        [0, 0, 0],
        [0, 11, -1]
    ]) {
        for (const mode of [0, 1])
            for (const bevel of [-1, 0, 1, 3, 16]) {
                rows.push(['wb', 16, 16, 255, 'D6:0' + mode + ':0,B1:' + x + ':' + w + ':' + h + ':' + bevel + ':77']);
            }
    }
    for (const cmd of ['D1:0000:0', 'D2:0100:0', 'D3:0fff:0', 'D4:0000:0', 'D5:0000:0', 'D8:0000:0']) rows.push(['wb', 16, 16, 255, cmd + ',P,A']);
    return rows;
}

function hash(value: unknown): number {
    if (value === null) return 0;
    if (typeof value === 'boolean' || typeof value === 'number') return Number(value);
    if (value instanceof Int16Array || value instanceof Uint8Array || value instanceof Int32Array) {
        let h = 1;
        for (const n of value) h = (Math.imul(31, h) + n) | 0;
        return h;
    }
    if (Array.isArray(value)) {
        let h = 1;
        for (const o of value) h = (Math.imul(31, h) + hash(o)) | 0;
        return h;
    }
    throw new Error('Unexpected field value');
}
function trace([kind, width, height, cap, steps]: Row): string {
    const op = new types[kind]();
    op.cacheCapacity = cap;
    TextureOp.width = TextureOp.height = -1;
    TextureOp.setSize(width, height);
    op.initCache(width, height);
    const cache = requireNonNull(op.monochromeImageCache),
        backing = requireNonNull(cache['pixels']),
        ids = new Map<Int32Array | null, number>();
    for (const row of backing) ids.set(row, ids.size + 1);
    TextureOpVoronoiNoise.nearestDistance = 10;
    TextureOpVoronoiNoise.secondDistance = 11;
    TextureOpVoronoiNoise.thirdDistance = 12;
    TextureOpVoronoiNoise.fourthNearest = 13;
    const output: string[] = [],
        keys = names[kind].split(' ');
    let packet: PacketT | null = null,
        last: Int32Array | null = null;
    for (const word of steps.split(',')) {
        let result = 'ok';
        try {
            switch (word[0]) {
                case 'D': {
                    const [code, data, pos] = word.slice(1).split(':');
                    packet = data === 'n' ? null : new PacketT(data === '-' ? new Uint8Array() : Uint8Array.from(Buffer.from(data, 'hex')));
                    if (packet) packet.m_pos = +pos;
                    op.decode(packet, +code);
                    break;
                }
                case 'P':
                    op.postDecode();
                    break;
                case 'G':
                    last = op.getMonochromeOutput(+word.slice(1));
                    result = last === null ? 'nil' : String(ids.get(last));
                    break;
                case 'A': {
                    let digest = 1;
                    for (let y = 0; y < height; y++) {
                        last = op.getMonochromeOutput(y);
                        digest = (Math.imul(digest, 31) + hash(last)) | 0;
                        digest = (Math.imul(digest, 31) + (last === null ? 0 : requireNonNull(ids.get(last)))) | 0;
                    }
                    result = 'image' + digest;
                    break;
                }
                case 'W':
                    if (last && last.length) last[0] = -530;
                    break;
                case 'X':
                    TextureOp.normalisedX = word.length === 1 ? null : Int32Array.of(-3072, 8192, 4096);
                    break;
                case 'Y':
                    TextureOp.normalisedY = word.length === 1 ? null : Int32Array.of(4096, 8192, -128);
                    break;
                case 'Z':
                    backing[0] = null;
                    break;
                case 'S': {
                    if (op instanceof TextureOpVoronoiNoise) result = 'share' + (op['permutation'] === TextureOp.getPermutation(op['seed']));
                    else if (op instanceof TextureOpPerlinNoise) result = 'share' + (op['permutation'] === TextureOp.getPermutation(op['seed']));
                    break;
                }
                case 'T': {
                    let h = 1;
                    for (const t of [-2147483648, -1, 0, 1, 2048, 4095, 4096, 65535, 2147483647]) h = (Math.imul(h, 31) + TextureOpPerlinNoise.fade(t)) | 0;
                    result = 'fade' + h;
                    break;
                }
                case 'H': {
                    const [a, b, c, d, x, y] = word.slice(1).split(':').map(Number);
                    if (op instanceof TextureOpPerlinNoise) result = 'noise' + op['noise'](a, b, c, d, x, y);
                    break;
                }
                case 'B': {
                    const [y, x, w, h, bevel, seed] = word.slice(1).split(':').map(Number);
                    if (op instanceof TextureOpIrregularBricks) {
                        op['bevelPixels'] = bevel;
                        op['drawBrick'](y, x, w, h, backing, new JavaRandom(BigInt(seed)));
                    }
                    break;
                }
            }
        } catch (e) {
            if (e instanceof TypeError) result = 'null';
            else if (e instanceof RangeError) result = e.message.includes('/ by zero') ? 'divide' : e.message.includes('IllegalArgumentException') ? 'bound' : /negativearraysize|array length/i.test(e.message) ? 'size' : 'bounds';
            else if (e instanceof Error && e.message.includes('full image cache')) result = 'runtime';
            else throw e;
        }
        let state = 1;
        for (const key of keys) state = (Math.imul(31, state) + hash(Reflect.get(op, key))) | 0;
        output.push(
            [
                result,
                packet?.m_pos ?? '-',
                state,
                +cache.invalid,
                hash(backing),
                hash(Int32Array.of(TextureOpVoronoiNoise.nearestDistance, TextureOpVoronoiNoise.secondDistance, TextureOpVoronoiNoise.thirdDistance, TextureOpVoronoiNoise.fourthNearest))
            ].join(':')
        );
    }
    return output.join('|');
}

loginFixture(
    import.meta.url,
    '530 seeded texture operators match full JAR images, generator state, cache eviction and draw faults',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), '530-texture-seeded-'));
        try {
            const cc = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'TextureSeededOpsOracle.java')]);
            expect(cc.exitCode, cc.stderr.toString()).toBe(0);
            const rows = vectors(),
                lines = rows.map(v => v.join(' '));
            const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'TextureSeededOpsOracle'], {
                stdin: Buffer.from(lines.join('\n') + '\n'),
                maxBuffer: 12 * 1024 * 1024,
                timeout: 20000
            });
            expect(java.exitCode, java.stderr.toString()).toBe(0);
            const expected = java.stdout.toString().trimEnd().split(/\r?\n/);
            expect(expected.length).toBe(rows.length);
            for (const [i, row] of rows.entries()) expect(trace(row), lines[i]).toBe(expected[i]);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    60000
);
