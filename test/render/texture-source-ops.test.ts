import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import TextureOp from '#/dash3d/TextureOp.js';
import TextureOpColour from '#/dash3d/TextureOpColour.js';
import TextureOpHorizontalGradient from '#/dash3d/TextureOpHorizontalGradient.js';
import TextureOpMonochromeFill from '#/dash3d/TextureOpMonochromeFill.js';
import TextureOpVerticalGradient from '#/dash3d/TextureOpVerticalGradient.js';
import PacketT from '#/io/PacketT.js';
import { arrayAt, arrayPut, requireNonNull } from '#/util/JavaArray.js';
import { gamepackPath } from '../reference.js';
import { loginFixture } from '../login-fixture.js';

type Kind = 'M' | 'C' | 'X' | 'Y';
type Row = [Kind, number | '-', number, number, number, number, number, string, string];
type Pixels = Int32Array | (Pixels | null)[];

function vectors(): Row[] {
    const rows: Row[] = [];
    for (const kind of ['M', 'C', 'X', 'Y'] as const) {
        for (const width of [0, 1, 3, 8, 9])
            for (const capacity of [0, 1, 2, 255]) {
                const standard = 'p,g0,i,g0,w,g0,g1,g0,d,g0,g2,g1,g0,k,g0,i,g2';
                rows.push([kind, '-', width, 3, capacity, 0, 0, '12ef75', standard]);
                rows.push([kind, '-', width, 3, capacity, 0, 0, 'cae937', 'i,g-1,g3,g2147483647,g-2147483648,g2']);
                rows.push([kind, '-', width, 3, capacity, 0, 0, '82bb02', 'i,x,g0,x1,g2,w,g1,y,g1,y1,g0,g2']);
                rows.push([kind, '-', width, 3, capacity, 0, 0, 'af69b3', 'i,s-1,g0,s11,g1,s2,g2,w,g0']);
                if (capacity > 0) {
                    rows.push([kind, '-', width, 3, capacity, 0, 0, 'ab61e5', 'i,z,g0,g0,g1']);
                    if (kind === 'C')
                        for (const edit of ['a', 'h0', 'h1', 'h2', 'l0', 'l1', 'l2', 'r0', 'r1', 'r2']) {
                            rows.push([kind, '-', width, 3, capacity, 0, 0, 'ab61e5', 'd,i,' + edit + ',g0,g0,g1,g0']);
                        }
                }
            }
        for (const code of [-1, 0, 1, 255, 2147483647])
            for (const data of ['no', 'null', '-', '00', 'ff', '004a', 'e9482a', '09ff02a1']) {
                for (const offset of [-1, 0, 1]) rows.push([kind, '-', 2, 2, 1, code, offset, data, 'p,i,d,g0,d,g0,g1']);
            }
    }
    for (let b = 0; b < 256; b++) {
        const byte = b.toString(16).padStart(2, '0');
        rows.push(['M', '-', 2, 2, 1, 0, 0, byte, 'd,i,g0']);
        const colour = Buffer.from([b, b ^ 0xa7, (b * 167) & 255]).toString('hex');
        rows.push(['C', '-', 2, 2, 1, 0, 0, colour, 'd,i,g0']);
    }
    for (const type of ['M', 'C'] as const)
        for (const n of [-2147483648, -65536, -1, 0, 1, 255, 4096, 0xffffff, 2147483647]) {
            rows.push([type, n, 3, 2, 1, 0, 0, '81c0ef', 'p,i,g0,d,g0,g1']);
        }
    return rows;
}

function trace([kind, initial, width, height, capacity, code, offset, data, ops]: Row): string {
    const cls = { M: TextureOpMonochromeFill, C: TextureOpColour, X: TextureOpHorizontalGradient, Y: TextureOpVerticalGradient }[kind];
    const op: TextureOp = initial === '-' ? new cls() : Reflect.construct(cls, [initial]);
    const packet = data === 'no' ? null : new PacketT(data === 'null' ? null : Uint8Array.from(Buffer.from(data === '-' ? '' : data, 'hex')));
    if (packet !== null) packet.m_pos = offset;
    op.cacheCapacity = capacity;
    TextureOp.width = width;
    TextureOp.normalisedX = Int32Array.of(31, 32, 33, 34, 35);
    TextureOp.normalisedY = Int32Array.of(-15, 725, 4096, 8192);
    const ids = new Map<Pixels, number>();
    const arrays: Pixels[] = [];
    function id(a: Pixels | null): number {
        if (a === null) return 0;
        const known = ids.get(a);
        if (known !== undefined) return known;
        const next = arrays.length + 1;
        arrays.push(a);
        ids.set(a, next);
        if (Array.isArray(a)) for (const item of a) id(item);
        return next;
    }
    function hash(): number {
        let hash = 1;
        for (const a of arrays) {
            hash = (Math.imul(31, hash) + a.length) | 0;
            if (a instanceof Int32Array) {
                for (const x of a) hash = (Math.imul(31, hash) + x) | 0;
            } else for (const child of a) hash = (Math.imul(31, hash) + id(child)) | 0;
        }
        return hash;
    }
    function pixels(): (Pixels | null)[] | null {
        return op.monochrome ? requireNonNull(op.monochromeImageCache)['pixels'] : requireNonNull(op.colourImageCache)['pixels'];
    }
    function firstColourRow() {
        return arrayAt(requireNonNull(op.colourImageCache)['pixels'], 0);
    }
    id(TextureOp.normalisedX);
    id(TextureOp.normalisedY);
    let last: Int32Array | (Int32Array | null)[] | null = null;
    const values: string[] = [];
    for (const cmd of ops.split(',')) {
        let status = 'ok';
        const arg = Number(cmd.slice(1));
        try {
            switch (cmd[0]) {
                case 'i':
                    op.initCache(width, height);
                    id(pixels());
                    break;
                case 'd':
                    op.decode(packet, code);
                    break;
                case 'g':
                    last = op.monochrome ? op.getMonochromeOutput(arg) : op.getColourOutput(arg);
                    status = 'id' + id(last);
                    break;
                case 'w':
                    if (last instanceof Int32Array && last.length) last[0] = -910;
                    if (Array.isArray(last)) {
                        let i = 0;
                        for (const a of last) if (a !== null && a.length) a[0] = 10000 + ++i;
                    }
                    break;
                case 'x':
                    TextureOp.normalisedX = cmd.length === 1 ? null : Int32Array.of(117, 119);
                    break;
                case 'y':
                    TextureOp.normalisedY = cmd.length === 1 ? null : Int32Array.of(97);
                    break;
                case 's':
                    TextureOp.width = arg;
                    break;
                case 'z':
                    arrayPut(pixels(), 0, null);
                    break;
                case 'a': {
                    const r = firstColourRow();
                    arrayPut(r, 1, arrayAt(r, 0));
                    arrayPut(r, 2, arrayAt(r, 0));
                    break;
                }
                case 'h':
                    arrayPut(firstColourRow(), arg, null);
                    break;
                case 'l':
                    arrayPut(firstColourRow(), arg, new Int32Array(1));
                    break;
                case 'r':
                    arrayPut(requireNonNull(op.colourImageCache)['pixels'], 0, new Array<Int32Array | null>(arg).fill(null));
                    break;
                case 'k':
                    op.clearImageCache();
                    break;
                case 'p':
                    break;
                default:
                    throw new Error(cmd);
            }
        } catch (e) {
            if (e instanceof TypeError) status = 'null';
            else if (e instanceof RangeError) status = /array length|negativearraysize/i.test(e.message) ? 'size' : 'bounds';
            else throw e;
        }
        const value = op instanceof TextureOpColour ? [op['red'], op['green'], op['blue']].join('/') : op instanceof TextureOpMonochromeFill ? op['value'] : '-';
        const cache = op.monochrome ? op.monochromeImageCache : op.colourImageCache;
        values.push([status, packet?.m_pos ?? '-', value, cache === null ? '-' : Number(cache.invalid), id(TextureOp.normalisedX), id(TextureOp.normalisedY), hash()].join(':'));
    }
    return values.join('|');
}

loginFixture(
    import.meta.url,
    '530 constant and gradient texture sources retain rows and match original colour and decode writes',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), '530-texture-source-'));
        try {
            const cc = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'TextureSourceOpsOracle.java')]);
            expect(cc.exitCode, cc.stderr.toString()).toBe(0);
            const rows = vectors(),
                lines = rows.map(v => v.join(' '));
            const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'TextureSourceOpsOracle'], {
                stdin: Buffer.from(lines.join('\n') + '\n'),
                maxBuffer: 8 * 1024 * 1024
            });
            expect(java.exitCode, java.stderr.toString()).toBe(0);
            const expected = java.stdout.toString().trimEnd().split(/\r?\n/);
            expect(expected.length).toBe(rows.length);
            for (const [i, row] of rows.entries()) expect(trace(row), lines[i]).toBe(expected[i]);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    30000
);
