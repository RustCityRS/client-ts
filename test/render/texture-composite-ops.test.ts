import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import TextureOp from '#/dash3d/TextureOp.js';
import TextureOpCombine from '#/dash3d/TextureOpCombine.js';
import TextureOpInterpolate from '#/dash3d/TextureOpInterpolate.js';
import TextureOpRange from '#/dash3d/TextureOpRange.js';
import TextureOpBinary from '#/dash3d/TextureOpBinary.js';
import TextureOpMonochrome from '#/dash3d/TextureOpMonochrome.js';
import TextureOpColourize from '#/dash3d/TextureOpColourize.js';
import TextureOpHorizontalGradient from '#/dash3d/TextureOpHorizontalGradient.js';
import TextureOpVerticalGradient from '#/dash3d/TextureOpVerticalGradient.js';
import TextureOpMonochromeFill from '#/dash3d/TextureOpMonochromeFill.js';
import TextureOpColour from '#/dash3d/TextureOpColour.js';
import type { ColourImageRow } from '#/dash3d/ColourImageCache.js';
import PacketT from '#/io/PacketT.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { gamepackPath } from '../reference.js';
import { loginFixture } from '../login-fixture.js';

const constructors = { o: TextureOpCombine, qa: TextureOpInterpolate, ge: TextureOpRange, uh: TextureOpBinary, ic: TextureOpMonochrome, s: TextureOpColourize };
type Name = keyof typeof constructors;
type Row = [Name, number, number, number, number, string, string];
const edge = [-2147483648, 2147483647, -1, 0, 1, 2047, 2048, 4095, 4096, 4097, -56789, 123456, 0x60000317];

function vectors(): Row[] {
    const rows: Row[] = [];
    for (const name of Object.keys(constructors) as Name[]) {
        const modes = name === 'o' ? [-1, 0, ...Array.from({ length: 12 }, (_, i) => i + 1), 13, 255] : [-1, 0, 7, 128];
        const forms = ['o', 'qa', 'ge'].includes(name) ? [0, 1] : [-1];
        for (const mode of modes)
            for (const form of forms) {
                for (let seed = 0; seed < edge.length; seed++)
                    for (const mask of [0, 1, 2, 4, 7]) {
                        rows.push([name, mode, form, mask, seed, 'ok', 'v,g0,w,g0,p,g1,g0']);
                    }
                for (const fault of ['alias', 'badDst', 'shortDst', 'dual', 'noChild', 'shortChild', 'noArray', 'zeroWidth', 'negWidth', 'badWidth', 'allOne', 'allZero', 'real']) {
                    for (const mask of [0, 7]) rows.push([name, mode, form, mask, 3, fault, 'g0,w,g0,g1']);
                }
                const children = name === 'qa' ? 3 : name === 'o' ? 2 : 1;
                for (let idx = 0; idx < children; idx++)
                    for (let ch = 0; ch <= 4; ch++)
                        for (const size of ['n', 's']) {
                            rows.push([name, mode, form, 0, 2, 'src' + idx + ch + size, 'g0,g0,g1']);
                            rows.push([name, mode, form, 7, 0, 'src' + idx + ch + size, 'g0,g0,g1']);
                        }
            }
        for (const code of [-1, 0, 1, 2, 3, 255])
            for (const data of ['no', 'null', '-', '01', 'ab', '1234', '01020304'])
                for (const offset of [-1, 0, 1]) {
                    rows.push([name, -1, -1, 0, 0, 'ok', 'v,d' + code + ':' + data + ':' + offset + ',g0,p,g1']);
                }
    }
    return rows;
}

class Input extends TextureOp {
    mono: Int32Array | null;
    rgb: ColourImageRow | null;
    constructor(
        private readonly index: number,
        flag: boolean,
        seed: number,
        private readonly calls: string[]
    ) {
        super(0, flag);
        this.mono = Int32Array.from(edge, (_, x) => edge[(x + seed * (index + 1) + index * 3) % edge.length]);
        this.rgb = Array.from({ length: 3 }, (_, c) => Int32Array.from(edge, (_, x) => edge[(x + seed * (index + 1) + index * 3 + (x % 3 === 0 ? 0 : c * 2)) % edge.length]));
    }
    override getMonochromeOutput(row: number) {
        this.calls.push(this.index + 'm' + row);
        return this.mono;
    }
    override getColourOutput(row: number) {
        this.calls.push(this.index + 'c' + row);
        return this.rgb;
    }
}

function trace([name, mode, form, mask, seed, fault, actions]: Row): string {
    const op = new constructors[name]();
    const calls: string[] = [],
        width = (TextureOp.width = edge.length);
    const setup = (code: number, ...bytes: number[]) => op.decode(new PacketT(Uint8Array.from(bytes)), code);
    if (mode !== -1) {
        if (name === 'o') setup(0, mode);
        if (name === 'uh' || name === 'ge') {
            setup(0, mode * 67, mode * 53 + 1);
            setup(1, mode * 19 + 3, mode * 7 - 1);
        }
        if (name === 's') for (let i = 0; i < 3; i++) setup(i, mode * 53 + 1 + i * 3, mode * 3 + 48 + i);
    }
    if (form !== -1) {
        const code = name === 'o' ? 1 : name === 'ge' ? 2 : name === 'qa' ? 0 : -1;
        if (code !== -1) setup(code, form === 0 ? 1 : 0);
    }
    const retained: Int32Array[] = [],
        inputs: Input[] = [];
    for (let i = 0; i < 3; i++) {
        const input = new Input(i, (mask & (1 << i)) !== 0, seed, calls);
        inputs.push(input);
        retained.push(requireNonNull(input.mono), ...requireNonNull(input.rgb).map(requireNonNull));
        if (i < requireNonNull(op.children).length) requireNonNull(op.children)[i] = input;
    }
    if (fault === 'real') {
        TextureOp.normalisedX = inputs[0].mono;
        TextureOp.normalisedY = inputs[1].mono;
        for (let i = 0; i < requireNonNull(op.children).length; i++) {
            const sources = [TextureOpHorizontalGradient, TextureOpVerticalGradient, TextureOpMonochromeFill, TextureOpColour];
            const child = new sources[(i + seed) % 4]();
            child.cacheCapacity = 1;
            child.initCache(width, 2);
            requireNonNull(op.children)[i] = child;
        }
    }
    op.cacheCapacity = 1;
    op.initCache(width, 2);
    const mono = op.monochromeImageCache?.['pixels'],
        colour = op.colourImageCache?.['pixels'];
    let outM = mono?.[0] ?? null,
        outC = colour?.[0] ?? null;
    if (outM !== null) {
        outM.fill(-76);
        retained.push(outM);
    }
    if (outC !== null)
        outC.forEach((pixels, c) => {
            requireNonNull(pixels).fill(-76 - c);
            retained.push(requireNonNull(pixels));
        });
    if (fault === 'alias' && outC !== null) {
        outC[0] = requireNonNull(inputs[0].rgb)[1];
        outC[1] = requireNonNull(inputs[1].rgb)[2];
        outC[2] = requireNonNull(inputs[0].rgb)[0];
    }
    if (fault === 'alias' && mono) mono[0] = outM = inputs[1].mono;
    if (fault === 'badDst' && mono) {
        mono[0] = outM = new Int32Array(1);
        retained.push(outM);
    }
    if (fault === 'badDst' && outC) {
        outC[1] = new Int32Array(1);
        retained.push(outC[1]);
    }
    if (fault === 'shortDst' && colour) colour[0] = outC = [null];
    if (fault === 'noChild') requireNonNull(op.children)[0] = null;
    if (fault === 'shortChild') op.children = [];
    if (fault === 'noArray') op.children = null;
    if (fault === 'zeroWidth') TextureOp.width = 0;
    if (fault === 'negWidth') TextureOp.width = -1;
    if (fault === 'badWidth') TextureOp.width = width + 1;
    if (fault.startsWith('src')) {
        const input = inputs[Number(fault[3])],
            ch = Number(fault[4]),
            edit = fault[5] === 'n' ? null : new Int32Array(1);
        if (edit) retained.push(edit);
        if (ch === 3) input.rgb = null;
        else if (ch === 4) input.rgb = [null];
        else {
            input.mono = edit;
            requireNonNull(input.rgb)[ch] = edit;
        }
    }
    if (fault === 'dual') {
        inputs[0].mono = null;
        inputs[1].mono = new Int32Array(0);
        requireNonNull(inputs[0].rgb)[0] = null;
        requireNonNull(inputs[1].rgb)[0] = new Int32Array(0);
    }
    if (fault === 'allZero') requireNonNull(inputs[2].mono).fill(0);
    if (fault === 'allOne') requireNonNull(inputs[2].mono).fill(4096);
    let packet: PacketT | null = null;
    const results: string[] = [];
    for (const cmd of actions.split(',')) {
        let status = 'ok';
        try {
            if (cmd.startsWith('d')) {
                const [code, data, offset] = cmd.slice(1).split(':');
                packet = data === 'no' ? null : new PacketT(data === 'null' ? null : Uint8Array.from(Buffer.from(data === '-' ? '' : data, 'hex')));
                if (packet !== null) packet.m_pos = +offset;
                op.decode(packet, +code);
            } else if (cmd === 'p') op.postDecode();
            else if (cmd === 'w') {
                if (op.monochrome && outM && outM.length) outM[0] = 123;
                if (!op.monochrome && outC && outC[0]) outC[0][0] = 123;
            } else if (cmd.startsWith('g')) {
                const row = +cmd.slice(1),
                    ret = op.monochrome ? op.getMonochromeOutput(row) : op.getColourOutput(row);
                status = ret === null ? 'nil' : ret === (op.monochrome ? outM : outC) ? 'same' : 'other';
            }
        } catch (e) {
            if (e instanceof TypeError) status = 'null';
            else if (e instanceof RangeError) status = 'bounds';
            else if (e instanceof Error && e.message.includes('output')) status = 'state';
            else throw e;
        }
        const fields = [Number(op.monochrome)];
        if (op instanceof TextureOpCombine) fields.push(op['mode']);
        if (op instanceof TextureOpRange) fields.push(op['range'], op['max'], op['min']);
        if (op instanceof TextureOpBinary) fields.push(op['min'], op['max']);
        if (op instanceof TextureOpColourize) fields.push(op['red'], op['green'], op['blue']);
        let hash = 1;
        for (const row of retained) {
            let part = 1;
            for (const v of row) part = (Math.imul(part, 31) + v) | 0;
            hash = (Math.imul(hash, 31) + part) | 0;
        }
        results.push([status, fields.join(','), packet?.m_pos ?? '-', op.monochromeImageCache ? Number(op.monochromeImageCache.invalid) : '-', op.colourImageCache ? Number(op.colourImageCache.invalid) : '-', hash].join(':'));
    }
    return results.join('|') + ';' + calls.join(',');
}

loginFixture(
    import.meta.url,
    '530 composite texture inputs, operations and partial row writes match the gamepack',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), '530-texture-composite-'));
        try {
            const cc = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'TextureCompositeOpsOracle.java')]);
            expect(cc.exitCode, cc.stderr.toString()).toBe(0);
            const rows = vectors(),
                lines = rows.map(v => v.join(' '));
            const jvm = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'TextureCompositeOpsOracle'], {
                stdin: Buffer.from(lines.join('\n') + '\n'),
                maxBuffer: 16 * 1024 * 1024
            });
            expect(jvm.exitCode, jvm.stderr.toString()).toBe(0);
            const expected = jvm.stdout.toString().trimEnd().split(/\r?\n/);
            expect(expected.length).toBe(rows.length);
            for (const [i, row] of rows.entries()) expect(trace(row), lines[i]).toBe(expected[i]);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    30000
);
