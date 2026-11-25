import { expect } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import { capsProfileFromJson } from '#/gl/CapsProfile.js';
import GlIndexedSprite from '#/gl/GlIndexedSprite.js';
import GlRaster from '#/gl/GlRaster.js';
import GlRenderer from '#/gl/GlRenderer.js';
import { GlTraceWriter } from '#/gl/GlTrace.js';
import NullGL from '#/gl/NullGL.js';
import RecordingGL from '#/gl/RecordingGL.js';
import Pix2D from '#/graphics/Pix2D.js';
import Pix8 from '#/graphics/Pix8.js';
import SpriteLoader from '#/graphics/SpriteLoader.js';
import WrappedException from '#/util/WrappedException.js';
import { loginFixture } from '../login-fixture.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';
import { diffTraces } from './glTraceDiff.js';

loginFixture(
    import.meta.url,
    'HD gameplay scrollbars follow the renderer through resizable software and fixed HD switches',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-hd-scrollbar-'));
        try {
            const rows: number[][] = [];
            for (const state of [2, 0, 1, 2, 1, 0]) {
                for (const [scroll, content, x, y, h] of [
                    [17, 230, 286, 362, 119],
                    [0, 120, 9, 8, 48],
                    [74, 81, 3, -7, 66],
                    [0, 42, 60, 40, 42],
                    [7, 0, 320, 40, 58]
                ]) {
                    rows.push([state, scroll, content, x, y, h, 0, 0, 765, 503], [state, scroll, content, x, y, h, 10, 18, 290, 459]);
                }
            }
            const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
            const compile = Bun.spawnSync(['javac', '-encoding', 'UTF-8', '-cp', cp, '-sourcepath', import.meta.dir, '-d', dir, join(import.meta.dir, 'HdScrollbarOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const profile = join(import.meta.dir, 'rtx5070.json');
            const ref = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-Dgltrace.stacks=false', '-Dgltrace.caps=' + profile, '-cp', cp, 'HdScrollbarOracle', dir], { stdin: Buffer.from(rows.map(row => row.join(' ')).join('\n') + '\n') });
            expect(ref.exitCode, ref.stderr.toString()).toBe(0);
            const lines = ref.stdout.toString().trim().split(/\r?\n/);
            expect(lines.length).toBe(rows.length);
            const writer = new GlTraceWriter();
            GlRenderer.gl = new RecordingGL(new NullGL(capsProfileFromJson(readFileSync(profile, 'utf8'))), writer);
            GlRenderer.width = 765;
            GlRenderer.height = 503;
            const data = Uint8Array.of(1, 2, 0, 2, 1, 2),
                palette = Int32Array.of(0, 0xf7a520, 0x5314b2);
            const gpu = [0, 1].map(() => new GlIndexedSprite(5, 4, 1, 1, 3, 2, data, palette));
            const cpu = [0, 1].map(() => new Pix8(5, 4, 1, 1, 3, 2, data, palette));
            for (const [i, [state, scroll, content, x, y, h, left, top, right, bottom]] of rows.entries()) {
                writer.mark('row' + i);
                GlRenderer.active = state !== 0;
                SpriteLoader.scrollbars = GlRenderer.active ? gpu : cpu;
                const pixels = GlRenderer.active ? null : new Int32Array(765 * 503 + 1);
                Pix2D.setPixels(pixels, 765, 503);
                Pix2D.setClipping(left, top, right, bottom);
                if (GlRenderer.active) GlRaster.setClipping(left, top, right, bottom);
                let result = 'ok';
                try {
                    Client.DrawScrollbar(h, y, scroll, content, x);
                } catch (error) {
                    if (!(error instanceof WrappedException && error.cause instanceof RangeError && error.cause.message === '/ by zero')) throw error;
                    result = 'ArithmeticException ' + error.context;
                }
                const hash = pixels === null ? '-' : createHash('sha256').update(pixels).digest('hex');
                expect(result + ' ' + hash).toBe(lines[i]);
            }
            const original = readFileSync(join(dir, 'trace.tsv'), 'utf8');
            expect(original.match(/\t~mark\trow\d+$/gm)?.length).toBe(rows.length);
            const diff = diffTraces(original, writer.text(), { includeDeletions: true });
            expect(diff.equal, diff.report).toBe(true);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    45000,
    'gl'
);
