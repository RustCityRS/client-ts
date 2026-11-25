import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ColourImageRow } from '#/dash3d/ColourImageCache.js';
import TextureOp from '#/dash3d/TextureOp.js';
import TextureOpClamp from '#/dash3d/TextureOpClamp.js';
import TextureOpFlip from '#/dash3d/TextureOpFlip.js';
import TextureOpInvert from '#/dash3d/TextureOpInvert.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

class Child extends TextureOp {
    constructor(private readonly shape: number) {
        super(0, false);
    }
    override getColourOutput(): ColourImageRow {
        if (this.shape === 3) return [new Int32Array(0), null, new Int32Array(0)];
        if (this.shape === 4) return [null, new Int32Array(0), new Int32Array(0)];
        return [Int32Array.of(31), Int32Array.of(57), Int32Array.of(99)].slice(0, this.shape);
    }
}

test('HD filter channel lookups, pixel faults and partial output match the three original RGB methods', () => {
    if (process.env.RS530_GAMEPACK_IDENTITY !== 'gl') {
        const child = Bun.spawnSync([process.execPath, 'test', fileURLToPath(import.meta.url)], { env: { ...process.env, RS530_GAMEPACK_IDENTITY: 'gl' } });
        expect(child.exitCode, child.stderr.toString()).toBe(0);
        expect(child.stderr.toString()).toMatch(/^\s*1 pass$/m);
        return;
    }
    const dir = mkdtempSync(join(tmpdir(), 'hd-filter-channels-'));
    const old = [TextureOp.width, TextureOp.widthMask, TextureOp.heightMask];
    try {
        const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
        const compile = Bun.spawnSync(['javac', '-cp', cp, '-d', dir, join(import.meta.dir, 'HdFilterChannelOracle.java')]);
        expect(compile.exitCode, compile.stderr.toString()).toBe(0);
        const java = Bun.spawnSync(['java', '-XX:-OmitStackTraceInFastThrow', '-cp', cp, 'HdFilterChannelOracle']);
        expect(java.exitCode, java.stderr.toString()).toBe(0);
        const rows = java.stdout.toString().trimEnd().split(/\r?\n/);
        expect(rows).toHaveLength(72);
        TextureOp.width = 1;
        TextureOp.widthMask = TextureOp.heightMask = 0;
        let line = 0;
        for (const Filter of [TextureOpClamp, TextureOpFlip, TextureOpInvert]) {
            for (let input = 0; input <= 5; input++) {
                for (let output = 0; output <= 3; output++) {
                    const op = new Filter();
                    op.monochrome = false;
                    op.cacheCapacity = 1;
                    op.initCache(1, 1);
                    requireNonNull(op.children)[0] = new Child(input);
                    const slots = requireNonNull(requireNonNull(op.colourImageCache)['pixels']);
                    const channels = requireNonNull(slots[0]).slice(0, output);
                    slots[0] = channels;
                    let result = 'ok';
                    try {
                        op.getColourOutput(0);
                    } catch (error) {
                        if (error instanceof RangeError) result = 'index' + error.message.match(/-?\d+/)?.[0];
                        else if (error instanceof TypeError) result = 'null';
                        else throw error;
                    }
                    const values = '[' + channels.map(channel => '[' + requireNonNull(channel).join(', ') + ']').join(', ') + ']';
                    expect(result + '|' + values, [Filter.name, input, output].join('/')).toBe(rows[line++]);
                }
            }
        }
    } finally {
        [TextureOp.width, TextureOp.widthMask, TextureOp.heightMask] = old;
        rmSync(dir, { recursive: true, force: true });
    }
});
