import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Pix32 from '#/graphics/Pix32.js';
import SpriteLoader from '#/graphics/SpriteLoader.js';
import { loginFixture } from '../login-fixture.js';
import { gamepackPath } from '../reference.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

function run([indices, alpha, palette, planes, heights, builder = 0, widths = 0]: number[]): string {
    const bytes = (mode: number, values: number[]) => (mode === 0 ? null : Uint8Array.from(values.slice(0, mode - 1)));
    SpriteLoader.count = 1;
    SpriteLoader.canvasWidth = 2;
    SpriteLoader.height = 1;
    SpriteLoader.widths = widths === 1 ? null : widths === 2 ? new Int32Array(0) : Int32Array.of(2);
    SpriteLoader.innerHeights = heights === 1 ? null : heights === 2 ? new Int32Array(0) : Int32Array.of(1);
    SpriteLoader.xOffsets = SpriteLoader.yOffsets = Int32Array.of(0);
    SpriteLoader.hasAlpha = [true];
    SpriteLoader.pixels = planes === 1 ? null : planes === 2 ? [] : [bytes(indices, [1, 254])];
    SpriteLoader.alphas = [bytes(alpha, [191, 0])];
    SpriteLoader.palette = palette === 0 ? null : Int32Array.from({ length: palette === 1 ? 1 : 256 }, (_, i) => Math.imul(0xa134c1, i) & 0xffffff);
    let result: string;
    try {
        const sprite = builder === 1 ? SpriteLoader.createSprite() : builder === 2 ? SpriteLoader.createSoftwareSprites()[0] : SpriteLoader.createSprites()[0];
        if (!(sprite instanceof Pix32) || sprite.pixels === null) throw new Error('Expected a populated software sprite');
        result = '[' + sprite.pixels.join(', ') + ']';
    } catch (error) {
        if (error instanceof TypeError) result = 'null';
        else if (error instanceof RangeError) result = 'bounds:' + /index (-?\d+)/.exec(error.message)?.[1];
        else throw error;
    }
    return result + '|' + [SpriteLoader.pixels === null, SpriteLoader.palette === null, SpriteLoader.widths === null].join(',');
}

for (const identity of ['sd', 'gl'] as const) {
    loginFixture(
        import.meta.url,
        identity + ' alpha sprite colours and first malformed staging access match its JAR',
        async () => {
            const dir = mkdtempSync(join(tmpdir(), 'rs530-sprite-alpha-order-'));
            try {
                const compile = Bun.spawnSync(['javac', '-encoding', 'UTF-8', '-d', dir, join(import.meta.dir, 'SpriteAlphaOrderOracle.java')]);
                expect(compile.exitCode, compile.stderr.toString()).toBe(0);
                const rows: number[][] = [];
                for (let indices = 0; indices <= 3; indices++)
                    for (let alpha = 0; alpha <= 3; alpha++)
                        for (let palette = 0; palette <= 2; palette++) {
                            rows.push([indices, alpha, palette, 0, 0]);
                        }
                for (const planes of [0, 1, 2]) for (const heights of [1, 2]) rows.push([3, 3, 2, planes, heights]);
                for (const builder of [1, 2]) for (const planes of [0, 1, 2]) for (const heights of [0, 1, 2]) for (const widths of [0, 1, 2]) rows.push([3, 3, 2, planes, heights, builder, widths]);
                const cp = [dir, identity === 'sd' ? gamepackPath : hdGamepackPath, joglPath].join(delimiter);
                const java = Bun.spawnSync(['java', '-XX:-OmitStackTraceInFastThrow', '-Djava.awt.headless=true', '-cp', cp, 'SpriteAlphaOrderOracle', identity], { stdin: Buffer.from(rows.map(r => r.join(' ')).join('\n') + '\n') });
                expect(java.exitCode, java.stderr.toString()).toBe(0);
                const expected = java.stdout.toString().trimEnd().split(/\r?\n/);
                expect(expected).toHaveLength(rows.length);
                for (const [i, row] of rows.entries()) expect(run(row), row.join(' ')).toBe(expected[i]);
                expect(run([0, 1, 2, 0, 0])).toBe((identity === 'gl' ? 'null' : 'bounds:0') + '|false,false,false');
                expect(run([3, 3, 2, 1, 2])).toBe((identity === 'gl' ? 'null' : 'bounds:0') + '|true,false,false');
            } finally {
                rmSync(dir, { recursive: true, force: true });
            }
        },
        30000,
        identity
    );
}
