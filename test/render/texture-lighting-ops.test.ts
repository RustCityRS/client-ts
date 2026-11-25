import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import type { ColourImageRow } from '#/dash3d/ColourImageCache.js';
import TextureOp from '#/dash3d/TextureOp.js';
import TextureOpColourKey from '#/dash3d/TextureOpColourKey.js';
import TextureOpHslAdjust from '#/dash3d/TextureOpHslAdjust.js';
import TextureOpEmboss from '#/dash3d/TextureOpEmboss.js';
import TextureOpDiagonalWaves from '#/dash3d/TextureOpDiagonalWaves.js';
import TextureOpEdgeDetector from '#/dash3d/TextureOpEdgeDetector.js';
import PacketT from '#/io/PacketT.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { gamepackPath } from '../reference.js';

const ops = [TextureOpColourKey, TextureOpHslAdjust, TextureOpEmboss, TextureOpDiagonalWaves, TextureOpEdgeDetector];
const fields = [
    ['keyColour', 'tolerance', 'redScale', 'blueScale', 'greenScale'],
    ['hue', 'green', 'red', 'blue', 'saturationDelta', 'lightnessDelta', 'hueDelta', 'saturation', 'lightness'],
    ['light', 'elevation', 'azimuth', 'depth'],
    ['divisor', 'amplitude', 'firstX', 'secondY', 'firstY', 'frequency', 'secondX'],
    ['scale']
];
const edges = [-2147483648, -1, 0, 1, 408, 409, 410, 1365, 2048, 4095, 4096, 65535, 2147483647];
const colours = [
    [2048, 2048, 2048],
    [4096, 0, 0],
    [0, 4096, 0],
    [0, 0, 4096],
    [4096, 4096, 0],
    [0, 4096, 4096],
    [4096, 0, 4096],
    [3333, 2000, 1000],
    [3333, 1000, 2000],
    [1000, 3333, 2000],
    [2000, 3333, 1000],
    [1000, 2000, 3333],
    [2000, 1000, 3333]
];
type Case = [kind: number, width: number, height: number, capacity: number, mode: number, mono: number, ...commands: string[]];

function cases(): Case[] {
    const rows: Case[] = [];
    for (let kind = 0; kind < ops.length; kind++) {
        for (const [w, h] of [
            [0, 4],
            [1, 1],
            [7, 8],
            [13, 5],
            [64, 8]
        ])
            for (const capacity of [1, 2, 255])
                for (const mode of [0, 1, 2, 3]) {
                    rows.push([kind, w, h, capacity, mode, mode & 1, 'g0', 'p', 'g0', 'g' + (h - 1), 'g' + (h >> 1), 'g0']);
                }
        for (let code = -1; code <= 7; code++)
            for (const hex of ['ff00f1', '7f', '-', 'null', 'none']) {
                rows.push([kind, 5, 3, 1, 0, 0, 'd' + code + ':' + hex, 'p', 'g0']);
            }
        for (let mode = 0; mode <= 9; mode++)
            for (const mono of [0, 1]) {
                rows.push([kind, 7, 4, 1, mode, mono, 'p', 'g1', 'b', 'w8', 'g1', 'g2', 'g-1', 'g4']);
            }
    }
    for (const mode of [1, 2, 4])
        for (const rgb of ['000000', 'ffff00', '0080ff', 'ff00ff']) {
            rows.push([0, 13, 3, 2, mode, 0, 'd0:ffff', 'd1:faff', 'd2:1111', 'd3:9876', 'd4:' + rgb, 'g0', 'g1']);
        }
    for (const h of ['0000', '1000', 'f000', '8000', '7fff'])
        for (const s of ['80', '00', '64'])
            for (const l of ['80', '00', '7f']) {
                rows.push([1, 13, 4, 1, 2, 0, 'd0:' + h, 'd1:' + s, 'd2:' + l, 'g0', 'g1', 'g2']);
            }
    for (const k of [0, 2])
        for (const a of ['a', 'a1']) {
            rows.push([k, 5, 4, 1, 0, 1, a, 'd4:fedcba', 'p', 'g0', 'g0']);
        }
    for (const depth of ['0000', '0001', '1000', 'ffff'])
        for (const a of ['0000', '0c90', 'ffff'])
            for (const e of ['0000', '1234', 'ffff']) {
                rows.push([2, 13, 4, 2, 1, 0, 't', 'd0:' + depth, 'd1:' + a, 'd2:' + e, 'p', 'g0', 'g1', 's-2147483648', 'g2']);
            }
    for (const k of [2, 4])
        for (const depth of ['0000', '2aaa', 'ffff'])
            for (const mode of [0, 1, 3]) {
                rows.push([k, 13, 4, 1, mode, 1, 'd0:' + depth, 'p', 'g0', 'g1', 'm2147483647', 'g2', 'v-1', 'g2147483647', 'm0', 'g3']);
            }
    for (const cmd of ['l', 'l1', 'c', 'c1', 'x', 'x1', 'y', 'y1'])
        for (const k of [2, 3]) {
            rows.push([k, 13, 5, 1, 0, 1, 'p', 'g1', cmd, 'g1', 'g2', 'g3']);
        }
    for (const mode of [0, 1])
        for (const n of ['0000', '0001', '1000', 'ffff'])
            for (const amp of ['0000', '0100', '2000', 'ffff']) {
                rows.push([3, 13, 7, 2, mode, 1, 'd0:0000', 'd1:09ab', 'd2:ffff', 'd3:ed98', 'd4:' + n, 'd5:' + amp, 'd6:2000', 'p', 'g0', 'g1', 'g2', 'g5', 'd6:0000', 'g4']);
            }
    return rows;
}

class Child extends TextureOp {
    calls = '';
    shared: Int32Array[];
    constructor(
        readonly w: number,
        readonly mode: number,
        mono: boolean
    ) {
        super(0, mono);
        this.shared = Array.from({ length: 3 }, () => new Int32Array(w));
    }
    channel(row: number, c: number): Int32Array | null {
        const a = this.mode === 3 ? this.shared[c] : new Int32Array(this.w);
        for (let x = 0; x < a.length; x++) {
            const i = ((((x + row) | 0) % edges.length) + edges.length) % edges.length;
            switch (this.mode) {
                case 1:
                    a[x] = edges[(i + c * 3) % edges.length];
                    break;
                case 2:
                    a[x] = colours[i][c];
                    break;
                case 4:
                    a[x] = ((x + c + row) | 0) % 3 === 0 ? 409 : 410;
                    break;
                default:
                    a[x] = (x * x * 337 + 391 * row + 1147 * c + Math.imul(x, row)) & 8191;
            }
        }
        if ((this.mode === 5 && c === 0) || (this.mode === 7 && c === 2)) return a.slice(0, 2);
        if (this.mode === 6 && c === 1) return null;
        return a;
    }
    override getMonochromeOutput(row: number): Int32Array | null {
        this.calls += 'm' + row + ',';
        return this.channel(row, 0);
    }
    override getColourOutput(row: number): ColourImageRow | null {
        this.calls += 'c' + row + ',';
        if (this.mode === 8) return null;
        if (this.mode === 9) return [null];
        return [this.channel(row, 0), this.channel(row, 1), this.channel(row, 2)];
    }
}

function trace([kind, width, height, capacity, mode, mono, ...commands]: Case, table: Int8Array | null): string {
    const op = new ops[kind]();
    const child = new Child(width, mode, mono === 1);
    if (requireNonNull(op.children).length > 0) requireNonNull(op.children)[0] = child;
    TextureOp.width = TextureOp.height = -1;
    TextureOp.sinTable = TextureOp.cosine = null;
    TextureOpEmboss.inverseNormalLength = table;
    TextureOp.setSize(width, height);
    if (mode === 1) {
        for (let x = 0; x < width; x++) requireNonNull(TextureOp.normalisedX)[x] = edges[x % edges.length];
        for (let y = 0; y < height; y++) requireNonNull(TextureOp.normalisedY)[y] = edges[(5 * y) % edges.length];
    }
    op.cacheCapacity = capacity;
    op.initCache(width, height);
    const cache = requireNonNull(op.monochrome ? op.monochromeImageCache : op.colourImageCache);
    const slots = requireNonNull(op.monochrome ? requireNonNull(op.monochromeImageCache)['pixels'] : requireNonNull(op.colourImageCache)['pixels']);
    const ids = new Map<object, number>();
    let last: Int32Array | ColourImageRow | null = null,
        packet: PacketT | null = null;
    function pixels(v: Int32Array | ColourImageRow | null): string {
        if (v === null) return '_';
        if (!ids.has(v)) ids.set(v, ids.size + 1);
        const values = v instanceof Int32Array ? v.join(',') : v.map(pixels).join(',');
        return ids.get(v) + '[' + values + ']';
    }
    function state(): string {
        const state = [packet === null ? '-' : String(packet.m_pos)];
        for (const f of fields[kind]) {
            const value: number | Int32Array | null = Reflect.get(op, f);
            state.push(typeof value === 'number' ? String(value) : pixels(value));
        }
        state.push(child.calls, pixels(last), String(cache.invalid));
        for (const slot of slots) state.push(pixels(slot));
        return state.join('|');
    }
    const results = [state()];
    for (const cmd of commands) {
        let result = 'ok';
        try {
            switch (cmd[0]) {
                case 'd': {
                    const [code, hex] = cmd.slice(1).split(':');
                    packet = hex === 'none' ? null : new PacketT(hex === 'null' ? null : Buffer.from(hex === '-' ? '' : hex, 'hex'));
                    op.decode(packet, Number(code));
                    break;
                }
                case 'p':
                    op.postDecode();
                    break;
                case 'g':
                    last = op.monochrome ? op.getMonochromeOutput(Number(cmd.slice(1))) : op.getColourOutput(Number(cmd.slice(1)));
                    break;
                case 'a':
                    Reflect.set(op, kind === 0 ? 'keyColour' : 'light', cmd.length === 1 ? null : Int32Array.of(7));
                    break;
                case 'b':
                    if (op.monochrome) slots[0] = Int32Array.of(77);
                    else requireNonNull(requireNonNull(op.colourImageCache)['pixels']?.[0])[1] = Int32Array.of(77);
                    break;
                case 'l':
                    TextureOpEmboss.inverseNormalLength = cmd.length === 1 ? null : Int8Array.of(-67);
                    break;
                case 'c':
                    TextureOp.cosine = cmd.length === 1 ? null : Int32Array.of(-69);
                    break;
                case 'x':
                    TextureOp.normalisedX = cmd.length === 1 ? null : Int32Array.of(2048);
                    break;
                case 'y':
                    TextureOp.normalisedY = cmd.length === 1 ? null : Int32Array.of(2048);
                    break;
                case 'w':
                    TextureOp.width = Number(cmd.slice(1));
                    break;
                case 'm':
                    TextureOp.widthMask = Number(cmd.slice(1));
                    break;
                case 'v':
                    TextureOp.heightMask = Number(cmd.slice(1));
                    break;
                case 's':
                    TextureOp.sizeScale = Number(cmd.slice(1));
                    break;
                case 't':
                    result = String(requireNonNull(TextureOpEmboss.inverseNormalLength).reduce((h, b) => (Math.imul(h, 31) + b) | 0, 1));
                    break;
            }
        } catch (e) {
            if (e instanceof TypeError && /^Null /.test(e.message)) result = 'null';
            else if (e instanceof RangeError && e.message === '/ by zero') result = 'arith';
            else if (e instanceof RangeError && /array index -?\d+$/.test(e.message)) result = 'bounds' + e.message.split(' ').at(-1);
            else throw e;
        }
        results.push(result + ':' + state());
    }
    return results.join(';');
}

test('five colour and lighting operators agree with 530 on every channel, cache reuse, signed coefficients and partial pixel writes', () => {
    const saved = {
        width: TextureOp.width,
        height: TextureOp.height,
        widthMask: TextureOp.widthMask,
        heightMask: TextureOp.heightMask,
        sizeScale: TextureOp.sizeScale,
        normalisedX: TextureOp.normalisedX,
        normalisedY: TextureOp.normalisedY,
        sinTable: TextureOp.sinTable,
        cosine: TextureOp.cosine
    };
    const table = TextureOpEmboss.inverseNormalLength,
        dir = mkdtempSync(join(tmpdir(), 'rs530-lighting-'));
    try {
        const rows = cases();
        const c = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'TextureLightingOpsOracle.java')]);
        expect(c.exitCode, c.stderr.toString()).toBe(0);
        const java = Bun.spawnSync(['java', '-XX:-OmitStackTraceInFastThrow', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'TextureLightingOpsOracle'], {
            stdin: Buffer.from(rows.map(r => r.join(' ')).join('\n') + '\n'),
            maxBuffer: 64 * 1024 * 1024
        });
        expect(java.exitCode, java.stderr.toString()).toBe(0);
        const expected = java.stdout.toString().trimEnd().split(/\r?\n/);
        expect(expected.length).toBe(rows.length);
        for (const [i, row] of rows.entries()) expect(trace(row, table), row.join(' ')).toBe(expected[i]);
    } finally {
        Object.assign(TextureOp, saved);
        TextureOpEmboss.inverseNormalLength = table;
        rmSync(dir, { recursive: true, force: true });
    }
}, 30000);
