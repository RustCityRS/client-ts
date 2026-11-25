import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import TextureOp from '#/dash3d/TextureOp.js';
import WrappedException from '#/util/WrappedException.js';
import TextureOpBoxBlur from '#/dash3d/TextureOpBoxBlur.js';
import TextureOpKaleidoscope from '#/dash3d/TextureOpKaleidoscope.js';
import TextureOpNormalMap from '#/dash3d/TextureOpNormalMap.js';
import TextureOpPolarDistortion from '#/dash3d/TextureOpPolarDistortion.js';
import TextureOpTile from '#/dash3d/TextureOpTile.js';
import type { ColourImageRow } from '#/dash3d/ColourImageCache.js';
import PacketT from '#/io/PacketT.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { gamepackPath } from '../reference.js';

function cases(): number[][] {
    const result: number[][] = [];
    for (const id of [5, 19, 20, 23, 33]) {
        for (const code of [-1, 0, 1, 2, 3]) {
            for (const size of [-2, -1, 0, 1, 2]) {
                for (const value of [0, 1, 2, 255]) result.push([0, id, code, size, value]);
            }
        }
        for (const mono of [0, 1]) {
            for (const childMono of [0, 1]) {
                for (const [width, height] of [
                    [0, 1],
                    [1, 1],
                    [4, 4],
                    [5, 3],
                    [8, 4],
                    [4, 8]
                ]) {
                    for (let config = 0; config < 6; config++) {
                        for (let signal = 0; signal < 4; signal++) {
                            for (let row = 0; row < height; row++) result.push([1, id, mono, childMono, config, width, height, row, 0, signal]);
                        }
                    }
                }
                for (let damage = 1; damage <= 17; damage++) {
                    for (const row of [-2, 0, 1, 3]) result.push([1, id, mono, childMono, 2, 4, 4, row, damage, damage % 4]);
                }
                // The Java wh scan with last source row MAX_INT increments back to MIN_INT.
                if (id !== 5) for (const row of [-2147483648, 2147483646, 2147483647]) result.push([1, id, mono, childMono, 2, 4, 4, row, 0, 2]);
            }
        }
    }
    return result;
}

function filter(id: number): TextureOp {
    switch (id) {
        case 5:
            return new TextureOpBoxBlur();
        case 19:
            return new TextureOpPolarDistortion();
        case 20:
            return new TextureOpTile();
        case 23:
            return new TextureOpKaleidoscope();
        case 33:
            return new TextureOpNormalMap();
        default:
            throw new Error(String(id));
    }
}

function fault(error: unknown): string {
    while (error instanceof WrappedException) error = error.cause;
    if (error instanceof TypeError && /^Null (reference|array|byte array)$/.test(error.message)) return 'null';
    if (error instanceof RangeError && error.message === '/ by zero') return 'divide';
    if (error instanceof RangeError && /negative|typed array length|array length/i.test(error.message)) return 'negative';
    if (error instanceof Error && error.message === 'This operation does not have a monochrome output') return error.message;
    const index = error instanceof RangeError && /^(?:byte )?array index (-?\d+)$/.exec(error.message);
    if (index) return 'index' + index[1];
    throw error;
}

function decode([, id, code, size, value]: number[]): string {
    const op = filter(id);
    const data = size < 0 ? null : Uint8Array.of(value, value ^ 0xa5).slice(0, size);
    const packet = size === -2 ? null : new PacketT(data);
    let status = 'ok';
    try {
        op.decode(packet, code);
    } catch (error) {
        status = fault(error);
    }
    const own = id === 5 ? ['horizontalRadius', 'verticalRadius'] : id === 19 ? ['magnitude'] : id === 20 ? ['horizontalTiles', 'verticalTiles'] : id === 33 ? ['scale', 'bias'] : [];
    return [status, packet?.m_pos ?? '-', op.monochrome, requireNonNull(op.children).length, own.length ? own.map(k => Reflect.get(op, k)).join(',') : '-'].join('|');
}

function configure(op: TextureOp, id: number, config: number): void {
    if (config === 0) return;
    function param(code: number, ...bytes: number[]): void {
        op.decode(new PacketT(Uint8Array.from(bytes)), code);
    }
    if (id === 5 || id === 20) {
        param(0, [0, 0, 2, 1, 255, 3][config]);
        param(1, [0, 0, 1, 3, 2, 0][config]);
    } else if (id === 19 || id === 33) {
        const value = [0, 0, 1, 257, 4096, 65535][config];
        param(0, value >> 8, value);
        if (id === 33) param(1, config & 1);
    }
}

const boundary = [-2147483648, 2147483647, 0, -1, 4095, 4096, 8192];
type Trace = { count: number; hash: number };
class Child extends TextureOp {
    private readonly held: Int32Array[];
    constructor(
        readonly slot: number,
        mono: boolean,
        readonly width: number,
        readonly damage: number,
        readonly signal: number,
        readonly trace: Trace
    ) {
        super(0, mono);
        this.held = Array.from({ length: 3 }, () => new Int32Array(width));
    }
    call(mono: boolean, row: number): void {
        this.trace.count++;
        this.trace.hash = (Math.imul(31, Math.imul(31, this.trace.hash) + this.slot * 2 + (mono ? 0 : 1)) + row) | 0;
        if (this.damage === 15 && this.slot === 0) {
            TextureOpKaleidoscope.sampleX = (TextureOpKaleidoscope.sampleX + 1) & TextureOp.widthMask;
            TextureOpKaleidoscope.sourceRow = (TextureOpKaleidoscope.sourceRow + 2) & TextureOp.heightMask;
        }
    }
    channel(row: number, ch: number): Int32Array {
        const len = this.damage === 5 && this.slot === 0 ? Math.min(this.width, 2) : this.width;
        const values = this.damage === 16 ? this.held[ch] : new Int32Array(len);
        for (let x = 0; x < values.length; x++) {
            const raw = (Math.imul(row, 193) + ch * 691 + x * 1049 + this.slot * 3709) | 0;
            switch (this.signal) {
                case 0:
                    values[x] = raw & 4095;
                    break;
                case 1: {
                    const n = Math.imul(raw, 0x45678d);
                    values[x] = (n << (x & 7)) | (n >>> (32 - (x & 7)));
                    break;
                }
                case 2:
                    values[x] = (boundary[(x + ch + this.slot) % boundary.length] + Math.imul(row, 7)) | 0;
                    break;
                default:
                    values[x] = this.slot === 1 ? Math.imul(x + row, 16) : this.slot === 2 ? 4101 - x * 47 : raw;
                    break;
            }
        }
        return values;
    }
    override getMonochromeOutput(row: number): Int32Array | null {
        this.call(true, row);
        return (this.damage === 6 && this.slot === 0) || (this.damage === 9 && this.trace.count === 4) ? null : this.channel(row, 0);
    }
    override getColourOutput(row: number): ColourImageRow | null {
        this.call(false, row);
        if (this.damage === 9 && this.trace.count === 4) return null;
        return [this.channel(row, 0), this.damage === 6 && this.slot === 0 ? null : this.channel(row, 1), this.channel(row, 2)];
    }
}

type Slot = ColourImageRow | Int32Array | null;
function pixels(slot: Slot): string {
    if (slot === null) return '_';
    if (slot instanceof Int32Array) return '[' + slot.join(',') + ']';
    return '[' + slot.map(pixels).join(',') + ']';
}

function render([, id, mono, childMono, config, width, height, row, damage, signal]: number[]): string {
    const op = filter(id);
    configure(op, id, config);
    op.monochrome = !!mono;
    TextureOp.sinTable = null;
    TextureOp.cosine = null;
    op.postDecode();
    TextureOp.width = width;
    TextureOp.height = height;
    TextureOp.widthMask = width - 1;
    TextureOp.heightMask = height - 1;
    TextureOp.normalisedX = Int32Array.from({ length: width }, (_, x) => ((x << 12) / width) | 0);
    TextureOp.normalisedY = Int32Array.from({ length: height }, (_, y) => ((y << 12) / height) | 0);
    TextureOpKaleidoscope.sampleX = 9;
    TextureOpKaleidoscope.sourceRow = 11;
    op.cacheCapacity = 1;
    op.initCache(width, height);
    const calls = { count: 0, hash: 1 };
    const children = requireNonNull(op.children);
    for (let i = 0; i < children.length; i++) children[i] = new Child(i, !!childMono, width, damage, signal, calls);
    const cache = requireNonNull(mono ? op.monochromeImageCache : op.colourImageCache);
    const slots: Slot[] = Reflect.get(cache, 'pixels');
    if (damage === 1) TextureOp.normalisedX = null;
    if (damage === 2) TextureOp.normalisedY = TextureOp.normalisedY.slice(0, 1);
    if (damage === 3) TextureOp.cosine = null;
    if (damage === 4) TextureOp.sinTable = Int32Array.of(1, -9);
    if (damage === 7) children[0] = null;
    if (damage === 8) op.children = [];
    if (damage === 10) slots[0] = null;
    if (damage === 11) TextureOp.widthMask = -2;
    if (damage === 12) TextureOp.width = -1;
    if (damage === 13) TextureOp.width += 2;
    if (damage === 14) {
        if (mono) slots[0] = new Int32Array(2);
        else {
            const rgb = slots[0];
            if (!Array.isArray(rgb)) throw new Error('colour cache');
            rgb[1] = new Int32Array(2);
        }
    }
    if (damage === 17) {
        requireNonNull(TextureOp.normalisedX).fill(2048);
        requireNonNull(TextureOp.normalisedY).fill(-2147483648);
    }
    const output = [];
    for (const y of [row, row, (row + 1) | 0]) {
        let status;
        try {
            const result = mono ? op.getMonochromeOutput(y) : op.getColourOutput(y);
            status = result === null ? 'returned-null' : result === slots[0] ? 'slot' : 'other';
        } catch (error) {
            status = fault(error);
        }
        output.push([status, cache.invalid, [calls.count, calls.hash], [TextureOpKaleidoscope.sampleX, TextureOpKaleidoscope.sourceRow], pixels(slots[0])].join('|'));
    }
    return output.join(';');
}

test('the five 530 sampling operators match Java on wrapped coordinates, channel values, child reads and faults', () => {
    const dir = mkdtempSync(join(tmpdir(), '530-texture-sampling-'));
    const oldDimensions = [TextureOp.width, TextureOp.height, TextureOp.widthMask, TextureOp.heightMask, TextureOpKaleidoscope.sampleX, TextureOpKaleidoscope.sourceRow];
    const oldTables = [TextureOp.normalisedX, TextureOp.normalisedY, TextureOp.sinTable, TextureOp.cosine];
    try {
        const compile = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'TextureSamplingOpsOracle.java')]);
        expect(compile.exitCode, compile.stderr.toString()).toBe(0);
        const rows = cases(),
            lines = rows.map(v => v.join(' '));
        const java = Bun.spawnSync(['java', '-XX:-OmitStackTraceInFastThrow', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'TextureSamplingOpsOracle'], {
            stdin: Buffer.from(lines.join('\n') + '\n'),
            maxBuffer: 48 * 1024 * 1024
        });
        expect(java.exitCode, java.stderr.toString()).toBe(0);
        const expected = java.stdout.toString().trimEnd().split(/\r?\n/);
        expect(expected.length).toBe(rows.length);
        for (const [i, row] of rows.entries()) expect(row[0] === 0 ? decode(row) : render(row), lines[i]).toBe(expected[i]);
    } finally {
        [TextureOp.width, TextureOp.height, TextureOp.widthMask, TextureOp.heightMask, TextureOpKaleidoscope.sampleX, TextureOpKaleidoscope.sourceRow] = oldDimensions;
        [TextureOp.normalisedX, TextureOp.normalisedY, TextureOp.sinTable, TextureOp.cosine] = oldTables;
        rmSync(dir, { recursive: true, force: true });
    }
}, 30000);
