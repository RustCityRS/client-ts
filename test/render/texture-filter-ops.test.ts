import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import type { ColourImageRow } from '#/dash3d/ColourImageCache.js';
import TextureOp from '#/dash3d/TextureOp.js';
import TextureOpClamp from '#/dash3d/TextureOpClamp.js';
import TextureOpFlip from '#/dash3d/TextureOpFlip.js';
import TextureOpInvert from '#/dash3d/TextureOpInvert.js';
import PacketT from '#/io/PacketT.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { gamepackPath } from '../reference.js';

function cases(): number[][] {
    const cases: number[][] = [];
    for (const id of [6, 9, 22]) {
        for (const code of [-1, 0, 1, 2, 3, 255]) {
            for (const size of [-2, -1, 0, 1, 2]) {
                for (const value of [0, 1, 2, 255]) cases.push([0, id, code, size, value]);
            }
        }
        for (const mono of [0, 1]) {
            for (const childMono of [0, 1]) {
                for (const capacity of [0, 1, 2, 255]) {
                    for (const width of [0, 1, 5, 9]) {
                        for (const config of [0, 1, 2, 3, 4]) {
                            cases.push([1, id, mono, childMono, config, capacity, width, width, width - 1, 2, 1, 0]);
                        }
                    }
                }
                for (const row of [-2147483648, -1, 0, 1, 2, 3, 2147483647]) {
                    for (const capacity of [1, 2, 255]) {
                        for (const mask of [-2147483648, 0, 4, 2147483647]) {
                            cases.push([1, id, mono, childMono, 4, capacity, 5, 5, mask, mask, row, 0]);
                        }
                    }
                }
                for (let damage = 1; damage <= 16; damage++) {
                    for (const width of [-1, 0, 5, 7]) {
                        for (const config of [0, 1, 4]) {
                            cases.push([1, id, mono, childMono, config, 1, 5, width, 4, 2, 1, damage]);
                        }
                    }
                }
            }
        }
    }
    return cases;
}

function filter(id: number): TextureOp {
    switch (id) {
        case 6:
            return new TextureOpClamp();
        case 9:
            return new TextureOpFlip();
        case 22:
            return new TextureOpInvert();
        default:
            throw new Error(String(id));
    }
}

function fault(error: unknown): string {
    if (error instanceof TypeError && /^Null (reference|array|byte array)$/.test(error.message)) return 'null';
    const index = error instanceof RangeError && /^(?:byte )?array index (-?\d+)$/.exec(error.message);
    if (index) return 'index' + index[1];
    throw error;
}

function decode([, id, code, length, value]: number[]): string {
    const op = filter(id);
    const data = length < 0 ? null : Uint8Array.of(value, value ^ 0xa5).slice(0, length);
    const packet = length === -2 ? null : new PacketT(data);
    let outcome = 'ok';
    try {
        op.decode(packet, code);
    } catch (error) {
        outcome = fault(error);
    }
    const fields = id === 6 ? [Reflect.get(op, 'min'), Reflect.get(op, 'max')].join(',') : id === 9 ? [Reflect.get(op, 'horizontal'), Reflect.get(op, 'vertical')].join(',') : '-';
    return [outcome, packet?.m_pos ?? '-', op.monochrome, op.cacheCapacity, requireNonNull(op.children).length, fields].join('|');
}

const values = [-2147483648, -1, 0, 123, 4096, 7000, 2147483647];
class Child extends TextureOp {
    dest: ColourImageRow = [];
    calls = '';
    constructor(
        mono: boolean,
        readonly width: number,
        readonly damage: number
    ) {
        super(0, mono);
    }
    channel(row: number, ch: number): Int32Array {
        if (this.damage === 16) return requireNonNull(this.dest[ch]);
        return Int32Array.from({ length: this.width }, (_, x) => (values[(x + ch) % values.length] + Math.imul(row, 7)) | 0);
    }
    override getMonochromeOutput(row: number): Int32Array | null {
        this.calls += 'm' + row + ',';
        if (this.damage === 1) return null;
        const r = this.channel(row, 0);
        return this.damage === 2 ? r.slice(0, 2) : r;
    }
    override getColourOutput(row: number): ColourImageRow | null {
        this.calls += 'c' + row + ',';
        if (this.damage === 1) return null;
        if (this.damage === 3) return [];
        const r = this.channel(row, 0),
            g = this.channel(row, 1),
            b = this.channel(row, 2);
        if (this.damage === 4) return [r];
        return [this.damage === 2 ? r.slice(0, 2) : r, this.damage === 5 ? null : g, this.damage === 6 ? b.slice(0, 2) : b];
    }
}

type Slot = ColourImageRow | Int32Array | null;
function contents(slot: Slot | Slot[]): string {
    if (slot === null) return '_';
    if (slot instanceof Int32Array) return '[' + slot.join(',') + ']';
    return '[' + slot.map(contents).join(',') + ']';
}

function render([, id, mono, childMono, config, capacity, width, globalWidth, widthMask, heightMask, row, damage]: number[]): string {
    const op = filter(id);
    function param(code: number, ...bytes: number[]): void {
        op.decode(new PacketT(Uint8Array.from(bytes)), code);
    }
    if (id === 6 && config !== 4) {
        const low = config === 1 ? 6200 : 700,
            high = config === 1 ? 10 : 3200;
        param(0, low >> 8, low);
        param(1, high >> 8, high);
    } else if (id === 9 && config !== 4) {
        param(0, config & 1);
        param(1, (config >> 1) & 1);
    }
    param(id === 22 ? 0 : 2, mono);
    op.cacheCapacity = capacity;
    op.initCache(width, 3);
    TextureOp.width = globalWidth;
    TextureOp.widthMask = widthMask;
    TextureOp.heightMask = heightMask;
    const source = new Child(!!childMono, width, damage);
    requireNonNull(op.children)[0] = source;
    const cache = requireNonNull(mono ? op.monochromeImageCache : op.colourImageCache);
    const slots: Slot[] = Reflect.get(cache, 'pixels');
    for (const [i, slot] of slots.entries()) {
        if (damage === 7) {
            slots[i] = null;
            continue;
        }
        if (slot instanceof Int32Array) {
            for (let x = 0; x < slot.length; x++) slot[x] = -200 - x;
            if (damage === 8) slots[i] = slot.slice(0, 2);
        } else {
            const rgb = requireNonNull(slot);
            for (const [c, channel] of rgb.entries()) {
                const pixels = requireNonNull(channel);
                for (let x = 0; x < pixels.length; x++) pixels[x] = -200 - c * 30 - x;
            }
            if (damage === 8) rgb[1] = requireNonNull(rgb[1]).slice(0, 2);
            if (damage === 9) rgb[2] = null;
            if (damage === 10) slots[i] = rgb.slice(0, 1);
            if (damage === 11) rgb[0] = rgb[2];
        }
    }
    if (damage === 12) op.children = null;
    if (damage === 13) op.children = [];
    if (damage === 14) requireNonNull(op.children)[0] = null;
    if (damage === 15) {
        op.monochromeImageCache = null;
        op.colourImageCache = null;
    }
    if (damage === 16) {
        const slot = requireNonNull(slots[0]);
        source.dest = slot instanceof Int32Array ? [slot, slot, slot] : slot;
    }
    const trace = [];
    for (const request of [row, row, (row + 1) | 0, row]) {
        let result;
        try {
            const output = mono ? op.getMonochromeOutput(request) : op.getColourOutput(request);
            result = output === null ? 'returned-null' : 'slot' + slots.indexOf(output);
        } catch (error) {
            result = fault(error);
        }
        const invalid = (mono ? op.monochromeImageCache : op.colourImageCache)?.invalid ?? '-';
        trace.push([result, invalid, source.calls, contents(slots)].join('|'));
    }
    return trace.join(';');
}

test('pf, nl and bd match the 530 JAR on row values, channel order, cache hits, aliasing and partial failures', () => {
    const dir = mkdtempSync(join(tmpdir(), '530-texture-filter-'));
    const saved = [TextureOp.width, TextureOp.widthMask, TextureOp.heightMask];
    try {
        const compile = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'TextureFilterOpsOracle.java')]);
        expect(compile.exitCode, compile.stderr.toString()).toBe(0);
        const rows = cases();
        const lines = rows.map(v => v.join(' '));
        const java = Bun.spawnSync(['java', '-XX:-OmitStackTraceInFastThrow', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'TextureFilterOpsOracle'], {
            stdin: Buffer.from(lines.join('\n') + '\n'),
            maxBuffer: 32 * 1024 * 1024
        });
        expect(java.exitCode, java.stderr.toString()).toBe(0);
        const expected = java.stdout.toString().trimEnd().split(/\r?\n/);
        expect(expected.length).toBe(rows.length);
        for (const [i, row] of rows.entries()) expect(row[0] === 0 ? decode(row) : render(row), lines[i]).toBe(expected[i]);
    } finally {
        [TextureOp.width, TextureOp.widthMask, TextureOp.heightMask] = saved;
        rmSync(dir, { recursive: true, force: true });
    }
}, 30000);
