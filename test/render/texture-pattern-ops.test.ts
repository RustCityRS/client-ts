import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import TextureOp from '#/dash3d/TextureOp.js';
import TextureOpMandelbrot from '#/dash3d/TextureOpMandelbrot.js';
import TextureOpWaveform from '#/dash3d/TextureOpWaveform.js';
import TextureOpHerringbone from '#/dash3d/TextureOpHerringbone.js';
import TextureOpWeave from '#/dash3d/TextureOpWeave.js';
import TextureOpNoise from '#/dash3d/TextureOpNoise.js';
import TextureOpStripes from '#/dash3d/TextureOpStripes.js';
import PacketT from '#/io/PacketT.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { gamepackPath } from '../reference.js';

const operators = [TextureOpMandelbrot, TextureOpWaveform, TextureOpHerringbone, TextureOpWeave, TextureOpNoise, TextureOpStripes];
const fields = [['scale', 'iterations', 'offsetX', 'offsetY'], ['radial', 'waveform', 'frequency'], ['repeatsX', 'repeatsY', 'lineWidth'], ['lineWidth'], [], ['count', 'duty', 'orientation', 'starts', 'ends']];
const boundary = [-2147483648, -8193, -1, 0, 1, 584, 585, 586, 1463, 2047, 2048, 2049, 2633, 3511, 4095, 4096, 65535, 2147483647];
type Case = [kind: number, width: number, height: number, capacity: number, coords: string, ...commands: string[]];

function vectors(): Case[] {
    const rows: Case[] = [];
    for (let k = 0; k < operators.length; k++) {
        for (const [w, h] of [
            [0, 4],
            [1, 1],
            [3, 7],
            [8, 8],
            [17, 5],
            [64, 32],
            [31, 18]
        ])
            for (const capacity of [1, 2, 255]) {
                const a = h - 1,
                    b = h >> 1;
                for (const mode of ['n', 'b']) rows.push([k, w, h, capacity, mode, 'i', 'p', 'g0', 'w', 'g0', 'g' + a, 'g' + b, 'g0', 'c', 'i', 'g0']);
            }
        for (const cmd of ['x', 'x3', 'y', 'y1', 's22', 't', 't1']) rows.push([k, 9, 4, 2, 'n', 'i', 'p', 'g1', 'w', cmd, 'g1', 'g2', 'g2', 'g-1', 'g4']);
        for (const code of [0, 1, 2, 3, 4, 255])
            for (const hex of ['0001', '7f', '-', 'null', 'none']) {
                rows.push([k, 5, 4, 255, 'b', 'd' + code + ':' + hex, 'i', 'p', 'g0', 'g2']);
            }
    }
    const d = (code: number, value: number, bytes: number) => 'd' + code + ':' + value.toString(16).padStart(bytes * 2, '0');
    for (const mode of ['n', 'b']) {
        for (const scale of [0, 1, 255, 1365, 4096, 65535])
            for (const limit of [0, 1, 2, 20, 255]) {
                rows.push([0, 18, 9, 2, mode, d(0, scale, 2), d(1, limit, 2), d(2, 65535, 2), d(3, 32769, 2), 'i', 'g0', 'g1', 'g4', 'g8']);
            }
        for (const radial of [0, 1, 2])
            for (const waveform of [0, 1, 2, 3])
                for (const f of [0, 1, 17, 255]) {
                    rows.push([1, 18, 13, 255, mode, d(0, radial, 1), d(1, waveform, 1), d(3, f, 1), 'i', 'g2', 'p', 'g2', 'g3', 'g6', 'g12']);
                }
        for (const rx of [0, 1, 5, 255])
            for (const ry of [0, 1, 6])
                for (const width of [0, 204, 4096]) {
                    rows.push([2, 19, 7, 1, mode, d(0, rx, 1), d(1, ry, 1), d(2, width, 2), 'i', 'g0', 'g2', 'g3', 'g6']);
                }
        for (const line of [0, 1, 584, 585, 1025, 2047, 2048, 2049, 4096, 65535]) {
            rows.push([3, 18, 19, 2, mode, d(0, line, 2), 'i', ...Array.from({ length: 19 }, (_, i) => 'g' + i)]);
        }
        for (const count of [0, 1, 3, 10, 255])
            for (const direction of [0, 1, 2, 3, 4])
                for (const duty of [0, 2048, 4096, 65535]) {
                    rows.push([5, 8, 7, 2, mode, d(0, count, 1), d(1, duty, 2), d(2, direction, 1), 'i', 'g0', 'p', 'g0', 'g1', 'g3', 'g6', 'g1']);
                }
    }
    return rows;
}

function trace([kind, width, height, capacity, coords, ...commands]: Case): string {
    const op = new operators[kind]();
    op.cacheCapacity = capacity;
    TextureOp.width = TextureOp.height = -1;
    TextureOp.sinTable = TextureOp.cosine = null;
    TextureOp.setSize(width, height);
    if (coords === 'b') {
        for (let x = 0; x < width; x++) requireNonNull(TextureOp.normalisedX)[x] = boundary[x % boundary.length];
        for (let y = 0; y < height; y++) requireNonNull(TextureOp.normalisedY)[y] = boundary[(5 * y) % boundary.length];
    }
    const ids = new Map<Int32Array, number>();
    let last: Int32Array | null = null,
        packet: PacketT | null = null;
    function data(array: Int32Array | null): string {
        if (array === null) return '-';
        if (!ids.has(array)) ids.set(array, ids.size + 1);
        let hash = 1;
        for (const value of array) hash = (Math.imul(31, hash) + value) | 0;
        return [ids.get(array), array.length, hash].join('/');
    }
    function state(): string {
        const values = fields[kind].map(key => {
            const v: number | Int32Array | null = Reflect.get(op, key);
            return typeof v === 'number' ? String(v) : data(v);
        });
        values.push(packet === null ? '-' : String(packet.m_pos), data(last));
        const cache = op.monochromeImageCache;
        if (cache !== null) {
            values.push(cache.invalid ? '1' : '0');
            for (const p of cache['pixels'] ?? []) values.push(data(p));
        }
        return values.join(',');
    }
    const results = [state()];
    for (const cmd of commands) {
        let result = 'ok';
        try {
            switch (cmd[0]) {
                case 'i':
                    op.initCache(width, height);
                    break;
                case 'p':
                    op.postDecode();
                    break;
                case 'g':
                    last = op.getMonochromeOutput(Number(cmd.slice(1)));
                    result = last === null ? 'null' : '[' + last.join(', ') + ']';
                    break;
                case 'c':
                    op.clearImageCache();
                    break;
                case 'w':
                    if (last !== null && last.length > 0) last[0] = 0x452190;
                    break;
                case 'x':
                    TextureOp.normalisedX = cmd.length === 1 ? null : Int32Array.of(-1, 3, 41);
                    break;
                case 'y':
                    TextureOp.normalisedY = cmd.length === 1 ? null : Int32Array.of(-1);
                    break;
                case 't':
                    TextureOp.sinTable = cmd.length === 1 ? null : Int32Array.of(-99);
                    break;
                case 's':
                    TextureOp.width = Number(cmd.slice(1));
                    break;
                case 'd': {
                    const [code, hex] = cmd.slice(1).split(':');
                    packet = hex === 'none' ? null : new PacketT(hex === 'null' ? null : Buffer.from(hex === '-' ? '' : hex, 'hex'));
                    op.decode(packet, Number(code));
                    break;
                }
            }
        } catch (e) {
            if (e instanceof TypeError) result = 'null';
            else if (e instanceof RangeError) result = e.message === '/ by zero' ? 'arith' : 'bounds';
            else throw e;
        }
        results.push(result + ':' + state());
    }
    return results.join(';');
}

test('six monochrome pattern generators match gamepack pixels, row reuse and partial faults', () => {
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
    const dir = mkdtempSync(join(tmpdir(), 'rs530-texture-pattern-'));
    try {
        const rows = vectors();
        const build = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'TexturePatternOpsOracle.java')]);
        expect(build.exitCode, build.stderr.toString()).toBe(0);
        const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'TexturePatternOpsOracle'], {
            stdin: Buffer.from(rows.map(r => r.join(' ')).join('\n') + '\n'),
            maxBuffer: 32 * 1024 * 1024
        });
        expect(java.exitCode, java.stderr.toString()).toBe(0);
        const expected = java.stdout.toString().trimEnd().split(/\r?\n/);
        expect(expected.length).toBe(rows.length);
        for (const [i, row] of rows.entries()) expect(trace(row), row.join(' ')).toBe(expected[i]);
    } finally {
        Object.assign(TextureOp, saved);
        rmSync(dir, { recursive: true, force: true });
    }
}, 30000);
