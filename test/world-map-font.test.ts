import { expect } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import GameShell from '#/client/GameShell.js';
import JagString from '#/datastruct/JagString.js';
import Pix2D from '#/graphics/Pix2D.js';
import WorldMapFont from '#/graphics/WorldMapFont.js';
import { mapFontSurface, type MapAwtFont, type MapFontSurface } from '#/graphics/WorldMapFontSurface.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { loginFixture } from './login-fixture.js';
import { gamepackPath } from './reference.js';

function codes(): string[] {
    const rows: string[] = [];
    for (const size of [11, 12, 14, 17, 19, 22, 26, 30])
        for (const bold of [0, 1]) {
            rows.push('F ' + [size, bold, 0].join(' '));
            for (let ch = 0; ch < 256; ch++) {
                rows.push('D ' + [ch % 3, 15 + (ch % 53), 11 + (ch % 31), ch * 65801, (ch >> 2) & 1, ch % 4, 0, Buffer.from([ch]).toString('base64')].join(' '));
            }
        }
    for (const size of [11, 30])
        for (const mode of [0, 1, 2, 3]) {
            rows.push('F ' + [size, 1, mode].join(' '));
            for (const [i, s] of ['', 'W', '@red@A~123~', '<col=12>ÛäÆÆ', '@1@2@', 'abcdefghijklmnopqrstuvwxyz', 'W'.repeat(600), '~123~', String.fromCharCode(...Array.from({ length: 256 }, (_, j) => j))].entries()) {
                for (const x of [-2147483648, -11, 29, 64, 2147483647])
                    for (const y of [-5, 0, 10, 28, 44]) {
                        rows.push('D ' + [i % 3, x, y, (0xd16792ef + i * 154241) | 0, 1, (x + y) & 3, 0, Buffer.from(s, 'latin1').toString('base64')].join(' '));
                    }
            }
            for (let bad = 0; bad <= 8; bad++)
                for (const kind of [0, 1, 2]) {
                    for (const colour of [0, 0xa870bc]) rows.push('D ' + [kind, 1, 19, colour, 1, 0, bad, 'QUM='].join(' '));
                }
        }
    for (const alpha of [0, 1])
        for (const width of [-1, 0, 1, 2, 3, 4, 5, 7, 8, 13])
            for (const src of [-1, 0, 2, 11]) {
                for (const dst of [-2, 1, 15])
                    for (const bad of [0, 1, 2]) {
                        rows.push('B ' + [alpha, -61923264, src, dst, width, 2, 1, -1, bad].join(' '));
                    }
            }
    for (const mode of [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]) rows.push('F ' + [17, 1, mode].join(' '));
    return rows;
}
function fault(e: unknown): string {
    if (e instanceof TypeError) return 'null';
    if (e instanceof RangeError) return /negative|Invalid typed array length/.test(e.message) ? 'size' : 'bounds';
    if (e instanceof Error && e.message === 'host') return 'host';
    throw e;
}
function digest(p: Int32Array | null): string {
    if (p === null) {
        return '-';
    } else {
        return createHash('sha256')
            .update(Buffer.from(p.buffer, p.byteOffset, p.byteLength))
            .digest('hex');
    }
}

loginFixture(
    import.meta.url,
    'AWT world map glyphs, font retries, bounds and pixels match all original eg instance methods',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), '530-eg-'));
        try {
            const cc = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'render/WorldMapFontOracle.java')]);
            expect(cc.exitCode, cc.stderr.toString()).toBe(0);
            const rows = codes();
            const jvm = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'WorldMapFontOracle', dir], { stdin: Buffer.from(rows.join('\n') + '\n'), maxBuffer: 24 * 1024 * 1024, timeout: 50000 });
            expect(jvm.exitCode, jvm.stderr.toString()).toBe(0);
            const expected = jvm.stdout.toString().trimEnd().split(/\r?\n/);
            expect(expected.length).toBe(rows.length);
            // Repeat every ordinary glyph draw through an actual unobserved AWT Canvas.
            // Windows has a native peer (created with addNotify, without displaying a window).
            const normal = rows.slice(0, 16 * 257);
            const independent = Bun.spawnSync(['java', '-Djava.awt.headless=' + String(process.platform !== 'win32'), '-cp', dir + delimiter + gamepackPath, 'WorldMapFontOracle', dir, 'plain'], {
                stdin: Buffer.from(normal.join('\n') + '\n'),
                maxBuffer: 8 * 1024 * 1024,
                timeout: 50000
            });
            expect(independent.exitCode, independent.stderr.toString()).toBe(0);
            const peer = independent.stdout.toString().trimEnd().split(/\r?\n/);
            expect(peer.length).toBe(normal.length);
            for (const [i, row] of normal.entries()) {
                // A peer supplies the real images directly, with no observer's counters.
                if (row.startsWith('F ')) expect(peer[i].split('|').slice(3)).toEqual(expected[i].split('|').slice(3));
                else expect(peer[i]).toBe(expected[i]);
            }
            let current: WorldMapFont | null = null;
            for (const [i, row] of rows.entries()) {
                const parts = row.split(' '),
                    v = parts.slice(1).map(Number);
                let actual: string;
                if (parts[0] === 'F') {
                    const [size, b, mode] = v,
                        bold = b !== 0;
                    const raw = mode === 3 ? readFileSync(join(dir, 'cells-' + size + '-' + bold + '-' + mode)) : null;
                    let lastBold = false,
                        trace = 1,
                        images = 0,
                        flushes = 0,
                        metrics = '',
                        pos = 0;
                    const metricComponent: MapFontSurface = {
                        getFontMetrics(f: MapAwtFont) {
                            lastBold = f.bold;
                            metrics += f.size + (f.bold ? 'b,' : 'p,');
                            if (mode === 5) throw Error('host');
                            return mapFontSurface.getFontMetrics(f);
                        },
                        createImage() {
                            throw Error('used constructor component as pe.S');
                        }
                    };
                    GameShell.canvas = {
                        getFontMetrics() {
                            throw Error('used pe.S as constructor component');
                        },
                        createImage(w: number, h: number) {
                            images++;
                            trace = (Math.imul(Math.imul(trace, 31) + w, 31) + h) | 0;
                            if (mode === 6 && images === 10) GameShell.canvas = null;
                            if (mode === 7 && images === 10) return null;
                            const image = requireNonNull(mapFontSurface.createImage(w, h));
                            return {
                                getGraphics: () => image.getGraphics(),
                                createPixelGrabber(target: Int32Array) {
                                    if (mode === 10 && images === 10) throw Error('host');
                                    const grabber = image.createPixelGrabber(target);
                                    return {
                                        grabPixels() {
                                            if (mode === 11 && images === 10) throw Error('host');
                                            grabber.grabPixels();
                                            for (let j = 0; j < target.length; j++) {
                                                let c = target[j] & 255;
                                                if (c !== 0 && (mode === 2 || (mode === 1 && lastBold))) c = [29, 30, 31, 101, 229, 230, 231][j % 7];
                                                if (raw !== null) c = raw[pos++];
                                                target[j] = c * 0x10101;
                                            }
                                        }
                                    };
                                },
                                flush() {
                                    flushes++;
                                    if (mode === 8 && images === 10) throw Error('host');
                                }
                            };
                        }
                    } satisfies MapFontSurface;
                    current = null;
                    let result = 'ok';
                    const oldChars = WorldMapFont.charset,
                        oldOffsets = WorldMapFont.glyphOffsets,
                        oldLength = WorldMapFont.charsetLength;
                    if (mode === 12) WorldMapFont.charset = null;
                    if (mode === 13) WorldMapFont.charsetLength = -1;
                    if (mode === 14) WorldMapFont.charsetLength = 20000;
                    if (mode === 15) {
                        WorldMapFont.charset = 'A';
                        WorldMapFont.charsetLength = 2;
                    }
                    if (mode === 16) WorldMapFont.unload();
                    try {
                        current = new WorldMapFont(size, bold, mode === 9 ? null : metricComponent);
                    } catch (e) {
                        result = fault(e);
                    } finally {
                        WorldMapFont.charset = oldChars;
                        WorldMapFont.glyphOffsets = oldOffsets;
                        WorldMapFont.charsetLength = oldLength;
                    }
                    actual = [
                        result,
                        metrics,
                        [images, flushes, trace],
                        current === null ? '-' : [current['antialiased'], current['cursor'], current.getLineHeight(), current.getBaseline()],
                        current === null ? '-' : Buffer.from(requireNonNull(current['data']).buffer).toString('base64')
                    ].join('|');
                    if (raw !== null) expect(pos).toBe(raw.length);
                } else if (parts[0] === 'D') {
                    const [op, x, y, colour, shadow, clip, bad] = v;
                    const font = requireNonNull(current);
                    let s: JagString | null = new JagString();
                    s.bytes = Uint8Array.from(Buffer.from(parts[8], 'base64'));
                    s.length = s.bytes.length;
                    const first = s.length === 0 ? 0 : s.bytes[0],
                        width = 79,
                        height = 43;
                    const screen = Int32Array.from({ length: bad === 8 ? 83 : width * height }, (_, j) => (0x91bc239e + Math.imul(j, 1403747)) | 0);
                    Pix2D.setPixels(bad === 7 ? null : screen, width, height);
                    if (clip === 1) Pix2D.setClipping(3, 6, 51, 39);
                    if (clip === 2) Pix2D.setClipping(27, 9, 28, 10);
                    if (clip === 3) Pix2D.setClipping(13, 16, 8, 4);
                    const old = font['data'],
                        lookup = WorldMapFont.glyphOffsets;
                    if (bad === 1) s = null;
                    if (bad === 2) requireNonNull(s).length += 3;
                    if (bad === 3) font['data'] = null;
                    if (bad === 4) font['data'] = requireNonNull(old).slice(0, 11);
                    if (bad === 5) WorldMapFont.glyphOffsets = null;
                    if (bad === 6) WorldMapFont.glyphOffsets = new Int32Array(256).fill(-7);
                    let widthResult: number | string,
                        status = 'ok';
                    try {
                        widthResult = font['stringWidth'](s);
                    } catch (e) {
                        widthResult = fault(e);
                    }
                    try {
                        if (op === 0) font.drawStringCentered(s, x, y, colour, !!shadow);
                        if (op === 1) font['drawString'](s, x, y, colour, !!shadow);
                        if (op === 2) font['drawGlyph'](parts[8] === '' ? 0 : requireNonNull(lookup)[first], x, y, colour, font['data']);
                    } catch (e) {
                        status = fault(e);
                    } finally {
                        font['data'] = old;
                        WorldMapFont.glyphOffsets = lookup;
                    }
                    actual = [widthResult, status, digest(Pix2D.pixels)].join('|');
                } else {
                    const [alpha, colour, src, dst, w, h, dstSkip, srcSkip, bad] = v;
                    const font = requireNonNull(current);
                    const source = Int8Array.of(0, 1, 29, 30, 31, 70, 128, 229, 230, 231, 255, 2);
                    const target = Int32Array.from({ length: 17 }, (_, j) => (0xffbe8734 + j * 72187) | 0);
                    let result = 'ok';
                    try {
                        font[alpha ? 'blitAlpha' : 'blitMono'](bad === 1 ? null : target, bad === 2 ? null : source, colour, src, dst, w, h, dstSkip, srcSkip);
                    } catch (e) {
                        result = fault(e);
                    }
                    actual = result + '|' + digest(target);
                }
                expect(actual, 'case ' + i + ': ' + row.slice(0, 130)).toBe(expected[i]);
            }
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    60000
);
