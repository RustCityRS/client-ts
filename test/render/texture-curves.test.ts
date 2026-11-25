import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import TextureOp from '#/dash3d/TextureOp.js';
import TextureOpCurve from '#/dash3d/TextureOpCurve.js';
import TextureOpColourGradient from '#/dash3d/TextureOpColourGradient.js';
import PacketT from '#/io/PacketT.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { gamepackPath } from '../reference.js';

class Ramp extends TextureOp {
    input = Int32Array.from({ length: 264 }, (_, i) => (i - 3) << 4);
    constructor() {
        super(0, true);
        this.input[0] = -2147483648;
        this.input[263] = 2147483647;
    }
    override getMonochromeOutput() {
        return this.input;
    }
}
const values = (v: Int32Array | null) => (v === null ? 'null' : '[' + v.join(', ') + ']');
const nested = (v: (Int32Array | null)[] | null) => (v === null ? 'null' : '[' + v.map(values).join(', ') + ']');
const hash = (v: Int32Array | Int16Array | null) => (v === null ? 0 : Array.from(v).reduce((a, b) => (Math.imul(a, 31) + b) | 0, 1));
function cases() {
    const all: string[][] = [];
    const param = (data: number[]) => 'b' + Buffer.from(data).toString('base64');
    for (const op of ['8', '10']) {
        all.push([op, 'r0', 'p', 'r0', 'r1', 'p', 'r2']);
        for (const packet of ['n', 'd', 'x', param([])]) all.push([op, packet, 'p', 'r0']);
        for (const mode of [0, 1, 2, 3, 4, 5, 6, 7, 255]) {
            const encoded = param([mode]);
            all.push([op, encoded, 'p', 'r0', 'r1', 'c', 'p', 'r2']);
            const lists = [
                [],
                [[0, 9]],
                [
                    [0, 0],
                    [4096, 4096]
                ],
                [
                    [2048, 19],
                    [2048, 32000]
                ],
                [
                    [0, 65535],
                    [4095, 9],
                    [4096, 32145]
                ],
                [
                    [65535, 65000],
                    [65534, 1025],
                    [0, 31]
                ],
                [
                    [0, 2],
                    [1, 32767],
                    [2048, 32768],
                    [3901, 65535],
                    [3930, 0]
                ]
            ];
            for (const markers of lists) {
                const data = [mode, markers.length];
                for (const [x, value] of markers) data.push(x >> 8, x, ...(op === '8' ? [value >> 8, value] : [value >> 7, value >> 2, value]));
                for (const length of new Set([0, 1, 2, 3, data.length - 1, data.length])) {
                    if (length < 0 || length > data.length) continue;
                    const packet = param(data.slice(0, length));
                    all.push([op, param(op === '8' ? [0, 2, 0, 0, 0, 9, 16, 0, 16, 0] : [1]), 'p', packet, 'p', 'r1']);
                    if (length === data.length) all.push([op, packet, 'c', 'p', 'r0', 'r0', encoded, 'p', 'r2']);
                }
            }
        }
    }
    return all;
}
function run([op, ...ops]: string[]) {
    const node = op === '8' ? new TextureOpCurve() : new TextureOpColourGradient();
    requireNonNull(node.children)[0] = new Ramp();
    TextureOp.width = 264;
    node.cacheCapacity = 1;
    node.initCache(264, 3);
    TextureOp.sinTable = TextureOp.cosine = null;
    const trace = [];
    for (const op of ops) {
        let result = 'ok',
            p: PacketT | null = null;
        try {
            if (op === 'p') node.postDecode();
            else if (op === 'c') {
                TextureOp.sinTable = new Int32Array(4);
                TextureOp.cosine = new Int32Array(3);
            } else if (op.startsWith('r')) {
                const y = Number(op.slice(1));
                result = node instanceof TextureOpCurve ? values(node.getMonochromeOutput(y)) : nested(node.getColourOutput(y));
            } else {
                p = op === 'n' ? null : new PacketT(op === 'd' ? null : Buffer.from(op.slice(1), 'base64'));
                node.decode(p, op[0] === 'x' ? 51 : 0);
            }
        } catch (e) {
            if (!(e instanceof Error)) throw e;
            result = e instanceof TypeError ? 'null' : e.message.includes('zero') ? 'arith' : e instanceof RangeError ? 'bounds' : e.message;
        }
        const state = node instanceof TextureOpCurve ? [node['interpolation'], nested(node['markers']), values(node['before']), values(node['after']), hash(node['table'])] : [nested(node['markers']), hash(node['table'])];
        trace.push([result, p?.m_pos ?? -1, ...state].join(':'));
    }
    return trace.join('|');
}

test('530 curve and gradient markers, all presets, partial decode and all 257 transfer values match the JAR', () => {
    const width = TextureOp.width,
        sin = TextureOp.sinTable,
        cos = TextureOp.cosine;
    const dir = mkdtempSync(join(tmpdir(), 'texture-curves-'));
    try {
        const cc = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'TextureCurveOracle.java')]);
        expect(cc.exitCode, cc.stderr.toString()).toBe(0);
        const scenarios = cases();
        const jvm = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'TextureCurveOracle'], {
            stdin: Buffer.from(scenarios.map(v => v.join(' ')).join('\n') + '\n'),
            maxBuffer: 48 * 1024 * 1024
        });
        expect(jvm.exitCode, jvm.stderr.toString()).toBe(0);
        const lines = jvm.stdout.toString().trimEnd().split(/\r?\n/);
        expect(lines.length).toBe(scenarios.length);
        for (const [i, s] of scenarios.entries()) expect(run(s), s.join(' ')).toBe(lines[i]);
    } finally {
        TextureOp.width = width;
        TextureOp.sinTable = sin;
        TextureOp.cosine = cos;
        rmSync(dir, { recursive: true, force: true });
    }
}, 30000);
