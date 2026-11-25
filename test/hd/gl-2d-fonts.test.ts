import { expect } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import JagString, { fromLiteral } from '#/datastruct/JagString.js';
import { capsProfileFromJson } from '#/gl/CapsProfile.js';
import GlCleaner from '#/gl/GlCleaner.js';
import GlFont from '#/gl/GlFont.js';
import GlIndexedSprite from '#/gl/GlIndexedSprite.js';
import GlRaster from '#/gl/GlRaster.js';
import GlRenderer from '#/gl/GlRenderer.js';
import type GlSprite from '#/gl/GlSprite.js';
import { GlTraceWriter } from '#/gl/GlTrace.js';
import NullGL from '#/gl/NullGL.js';
import RecordingGL from '#/gl/RecordingGL.js';
import MaterialManager from '#/gl/material/MaterialManager.js';
import type AbstractIndexedSprite from '#/graphics/AbstractIndexedSprite.js';
import SpriteLoader from '#/graphics/SpriteLoader.js';
import { arrayAtI32, arrayAtObj, requireNonNull } from '#/util/JavaArray.js';
import JavaRandom from '#/util/JavaRandom.js';
import { localAssets } from '../cachefile.js';
import { loginFixture } from '../login-fixture.js';
import { cachePath } from '../reference.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';
import { diffTraces } from './glTraceDiff.js';

// HD batch H2, fonts and indexed sprites: src/gl/GlIndexedSprite.ts (oh), src/gl/GlFont.ts (mb) and the tf.w
// arms of src/graphics/PixfontGeneric.ts (rk) against runescape_gl.jar. HdFontsOracle runs a command script against
// the jar under GlRecorder; the same script runs here through RecordingGL(NullGL) with the captured RTX 5070 profile.
// Both GLTrace v1 traces must be equal record for record (every argument, float bits, normalized names and the SHA-256
// of every uploaded texture, so the upload bytes of every cache font atlas and every indexed sprite are compared), and
// every command must print the same result line.
//
// The upload step turns every sprite group of archive 8 into GL indexed sprites (the jar decodes with gk.a([BI)V, the
// port with SpriteLoader.decode) and every font of archive 13 into a GL font. Groups whose palette indices reach 128
// throw in oh.a([B[I)V on both sides (the jar reads the palette with the signed index byte). The draw step covers
// plain, shadowed, coloured, alpha, struck and underlined text, entities and unknown tags, paragraphs in every
// alignment, the wave, shake and random layouts, icons (plain and alpha), text partly off the screen, the masked glyph
// path (GlRaster.mask set), direct glyph draws with an alpha over 255 and an out-of-range glyph, finalizers with the
// deletion flush, and a draw with no GL.

interface Entry {
    readonly kind: 0 | 1;
    readonly group: number;
    readonly sprite: Uint8Array;
    readonly metrics: Uint8Array | null;
}

function hex(text: string): string {
    return Buffer.from(text, 'latin1').toString('hex');
}

function text(hexText: string): JagString {
    const bytes = Buffer.from(hexText, 'hex');
    const s = JagString.allocate(bytes.length);
    for (const b of bytes) s.appendChar(b);
    return s;
}

function ints(csv: string): Int32Array | null {
    return csv === '-' ? null : Int32Array.from(csv.split(','), Number);
}

function kind(e: unknown): string {
    if (e instanceof TypeError) return 'NPE';
    if (e instanceof RangeError) return 'AIOOBE';
    if (e instanceof Error && e.message === 'IllegalArgumentException') return 'IllegalArgumentException';
    return e instanceof Error ? e.constructor.name : String(e);
}

function collect(): { entries: Entry[]; fontIds: number[]; iconGroup: number } {
    const assets = localAssets(cachePath, [8, 13]);
    const sprites = assets.archive(8);
    const metrics = assets.archive(13);
    const entries: Entry[] = [];
    for (let group = 0; group < sprites.GetGroupIdLimit(); group++) {
        if (sprites.GetFileIdLimit(group) === 0) continue;
        const data = sprites.GetFile(0, group);
        if (data !== null) entries.push({ kind: 0, group, sprite: data, metrics: null });
    }
    for (let group = 0; group < metrics.GetGroupIdLimit(); group++) {
        if (metrics.GetFileIdLimit(group) === 0) continue;
        const data = metrics.GetFile(0, group);
        const sprite = sprites.GetFileIdLimit(group) === 0 ? null : sprites.GetFile(0, group);
        if (data !== null && sprite !== null) entries.push({ kind: 1, group, sprite, metrics: data });
    }
    const fontIds = ['p11_full', 'p12_full', 'b12_full', 'q8_full'].map(name => metrics.GetGroupId(fromLiteral(name)));
    return { entries, fontIds, iconGroup: sprites.GetGroupId(fromLiteral('name_icons')) };
}

function writeGroups(path: string, entries: readonly Entry[]): void {
    const parts: Buffer[] = [];
    const int = (value: number) => {
        const b = Buffer.alloc(4);
        b.writeInt32BE(value);
        parts.push(b);
    };
    int(entries.length);
    for (const entry of entries) {
        int(entry.kind);
        int(entry.group);
        int(entry.sprite.length);
        parts.push(Buffer.from(entry.sprite));
        if (entry.metrics === null) {
            int(-1);
        } else {
            int(entry.metrics.length);
            parts.push(Buffer.from(entry.metrics));
        }
    }
    writeFileSync(path, Buffer.concat(parts));
}

function script(fontIds: readonly number[], iconGroup: number): string[] {
    const lines = ['upload', 'mark draw'];
    for (const f of fontIds) {
        lines.push(
            'mark font' + f,
            `left ${f} 10 20 16777215 -1 ${hex('Hello, World! 0123456789 ~!@#$%^&*()_+-=')}`,
            `left ${f} 10 40 16711680 0 ${hex('Shadowed text with kerning AVAWAT')}`,
            `right ${f} 700 60 65280 -1 ${hex('Right aligned')}`,
            `centre ${f} 380 80 255 0 ${hex('Centred <col=ff00ff>magenta</col> back')}`,
            `left ${f} 5 100 16777215 0 ${hex('<col=00ff00>green <shad=ff0000>red shadow</shad> <shad>default</shad> <col=123456>x</col>')}`,
            `left ${f} 5 120 16777215 -1 ${hex('<str>struck</str> <str=ff0000>red strike</str> <u=00ffff>under</u> <u>u2</u> <u=000000>')}`,
            `left ${f} 5 140 16777215 -1 ${hex('<lt>tag<gt> <nbsp> <shy> <times> <euro> <copy> <reg> <br> <unknown> <col=zz> <')}`,
            `left ${f} 5 160 16777215 0 ${hex('<trans=128>half</trans> <trans=300>over</trans> <trans=0>zero')}`,
            `para ${f} 5 180 200 100 16777215 0 128 1 1 0 ${hex('A long paragraph that wraps across several lines of text, with <col=ffff00>colour</col> and<br>breaks.')}`,
            `para256 ${f} 5 300 150 80 16777215 -1 0 3 14 ${hex('Justified paragraph text that is long enough to wrap onto more lines.')}`,
            `para256 ${f} 400 300 150 80 16777215 0 2 2 0 ${hex('Bottom right aligned <u=ff0000>under</u>')}`,
            `para ${f} 400 200 120 300 65535 0 256 3 3 0 ${hex('Spread vertically across the box, one two three four five six')}`,
            `wave ${f} 380 400 16777215 0 7 ${hex('Wave text')}`,
            `wave2 ${f} 380 420 16777215 -1 13 ${hex('Wave2 text <str>x</str>')}`,
            `shake ${f} 380 440 16777215 0 20 9 ${hex('Shake text <u>y</u>')}`,
            `shake ${f} 380 440 16777215 0 20 80 ${hex('Shake settled')}`,
            `random ${f} 10 460 16777215 0 12345 ${hex('Random spacing')}`,
            `randomAligned ${f} 10 470 300 30 16777215 0 1 1 54321 ${hex('Random aligned')}`,
            `randomAligned ${f} 10 470 300 30 16777215 -1 2 2 -7 ${hex('Random right')}`,
            `width ${f} ${hex('<col=ff0000>Width</col> of <lt>text<gt>')}`,
            `left ${f} -20 -5 16777215 0 ${hex('Off screen clipped text')}`,
            `left ${f} 740 510 16777215 0 ${hex('Clipped at the right and bottom')}`
        );
    }
    const p11 = requireNonNull(fontIds[0]);
    lines.push(
        'mark icons',
        `icons ${p11} ${iconGroup} -`,
        `left ${p11} 10 480 16777215 0 ${hex('<img=0> icon <img=1> <img=99> <img=x> <img=-1>')}`,
        `para ${p11} 10 480 300 40 16777215 0 100 0 0 0 ${hex('<img=0> alpha icon <img=1>')}`,
        `icons ${p11} ${iconGroup} 1,2`,
        `icons ${p11} ${iconGroup} 3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40`,
        `left ${p11} 10 490 16777215 0 ${hex('<img=0> icon <img=1>')}`,
        'mark mask',
        'mask 128 64 100 200',
        `left ${p11} 120 210 16777215 0 ${hex('Masked text <col=ff0000>red</col>')}`,
        `left ${p11} 90 190 16777215 -1 ${hex('Masked from outside the clip')}`,
        `glyph ${p11} 65 100 200 6 8 16711680 1`,
        `para ${p11} 120 220 100 40 16777215 0 128 0 0 0 ${hex('masked alpha')}`,
        'nomask',
        'mark glyphs',
        `glyph ${p11} 65 100 200 6 8 16711680 0`,
        `glyphAlpha ${p11} 66 10 10 6 8 255 300 0`,
        `glyphAlpha ${p11} 66 10 10 6 8 255 -5 1`,
        `glyphAlpha ${p11} 67 10 10 6 8 -1 255 0`,
        `glyph ${p11} 256 0 0 0 0 0 0`,
        `glyph ${p11} -1 0 0 0 0 0 0`,
        'mark sprites',
        `sprite ${iconGroup} 0 50 50`,
        `spriteAlpha ${iconGroup} 0 60 60 128`,
        `spriteAlpha ${iconGroup} 1 -5 600 0`,
        `sprite ${iconGroup} 1 70 70`,
        'mark finalize',
        `finalizeSprite ${iconGroup} 0`,
        `finalizeSprite ${iconGroup} 0`,
        `finalizeFont ${requireNonNull(fontIds[3])}`,
        `finalizeFont ${requireNonNull(fontIds[3])}`,
        'flush',
        'mark nogl',
        'nogl',
        `left ${p11} 10 20 16777215 -1 ${hex('no GL')}`,
        `sprite ${iconGroup} 1 70 70`
    );
    return lines;
}

interface Run {
    readonly trace: string;
    readonly results: string[];
}

function runTs(profileJson: string, entries: readonly Entry[], commands: readonly string[]): Run {
    const profile = capsProfileFromJson(profileJson);
    // tf's cached GL state back at its <clinit> values without recording (HdFontsOracle does the same).
    GlRenderer.gl = new NullGL(profile);
    GlRenderer.setLighting(false);
    GlRenderer.setLighting(true);
    GlRenderer.setDepthTest(false);
    GlRenderer.setDepthTest(true);
    GlRenderer.setFog(false);
    GlRenderer.setFog(true);
    GlRenderer.setTextureCombineAlpha(1);
    GlRenderer.setTextureCombineAlpha(0);
    GlRenderer.setTextureCombineRgb(1);
    GlRenderer.setTextureCombineRgb(0);
    GlRenderer.bindTexture2D(0);
    GlRenderer.bindTexture2D(-1);
    GlRenderer.resetTextureMatrix();
    Reflect.set(GlRenderer, 'ortho2d', false);
    MaterialManager.materials = null;
    MaterialManager.current = 0;
    GlRenderer.active = true;
    GlRenderer.width = 765;
    GlRenderer.height = 503;
    const writer = new GlTraceWriter();
    GlRenderer.gl = new RecordingGL(new NullGL(profile), writer);
    const fonts = new Map<number, GlFont>();
    const sprites = new Map<number, AbstractIndexedSprite[]>();
    const font = (id: string | undefined) => requireNonNull(fonts.get(Number(id)));
    const sprite = (group: string | undefined, index: string | undefined) => arrayAtObj(requireNonNull(sprites.get(Number(group))), Number(index));
    const results: string[] = [];
    for (const line of commands) {
        const v = line.split(' ');
        const n = (i: number) => Number(v[i]);
        let result = 'ok';
        try {
            switch (v[0]) {
                case 'upload':
                    for (const entry of entries) {
                        const prefix = entry.kind === 0 ? 's' : 'f';
                        writer.mark(prefix + entry.group);
                        let r: string;
                        if (entry.kind === 0) {
                            const set: AbstractIndexedSprite[] = [];
                            sprites.set(entry.group, set);
                            try {
                                SpriteLoader.decode(entry.sprite);
                                for (let i = 0; i < SpriteLoader.count; i++) {
                                    set.push(
                                        new GlIndexedSprite(
                                            SpriteLoader.canvasWidth,
                                            SpriteLoader.height,
                                            arrayAtI32(SpriteLoader.xOffsets, i),
                                            arrayAtI32(SpriteLoader.yOffsets, i),
                                            arrayAtI32(SpriteLoader.widths, i),
                                            arrayAtI32(SpriteLoader.innerHeights, i),
                                            arrayAtObj(SpriteLoader.pixels, i),
                                            SpriteLoader.palette
                                        )
                                    );
                                }
                                SpriteLoader.clear();
                                r = 'ok ' + set.length;
                            } catch (e) {
                                r = 'throw ' + kind(e) + ' ' + set.length;
                            }
                        } else {
                            try {
                                SpriteLoader.decode(entry.sprite);
                                const glFont = new GlFont(entry.metrics, SpriteLoader.xOffsets, SpriteLoader.yOffsets, SpriteLoader.widths, SpriteLoader.innerHeights, SpriteLoader.pixels);
                                SpriteLoader.clear();
                                fonts.set(entry.group, glFont);
                                r = 'ok ' + glFont.lineHeight;
                            } catch (e) {
                                r = 'throw ' + kind(e);
                            }
                        }
                        results.push(prefix + ' ' + entry.group + ' ' + r + ' ' + GlCleaner.memory2d);
                    }
                    result = 'uploaded ' + GlCleaner.memory2d;
                    break;
                case 'mark':
                    writer.mark(requireNonNull(v[1]));
                    break;
                case 'icons':
                    font(v[1]).setNameIcons(requireNonNull(sprites.get(n(2))), ints(requireNonNull(v[3])));
                    break;
                case 'mask': {
                    const name = new Int32Array(1);
                    requireNonNull(GlRenderer.gl).glGenTextures(1, name, 0);
                    // GlFont reads only the mask's texture name and texture size (cf.ab, cf.O, cf.cb).
                    GlRaster.mask = { texture: name[0], textureWidth: n(1), textureHeight: n(2) } as unknown as GlSprite;
                    GlRaster.clipMinX = n(3);
                    GlRaster.clipMinY = n(4);
                    break;
                }
                case 'nomask':
                    GlRaster.mask = null;
                    break;
                case 'active':
                    GlRenderer.active = v[1] === '1';
                    break;
                case 'left':
                    font(v[1]).drawLeft(text(requireNonNull(v[6])), n(2), n(3), n(4), n(5));
                    break;
                case 'right':
                    font(v[1]).drawRight(text(requireNonNull(v[6])), n(2), n(3), n(4), n(5));
                    break;
                case 'centre':
                    font(v[1]).drawCentred(text(requireNonNull(v[6])), n(2), n(3), n(4), n(5));
                    break;
                case 'para':
                    result = 'lines ' + font(v[1]).drawParagraphAlpha(text(requireNonNull(v[12])), n(2), n(3), n(4), n(5), n(6), n(7), n(8), n(9), n(10), n(11));
                    break;
                case 'para256':
                    result = 'lines ' + font(v[1]).drawParagraph(text(requireNonNull(v[11])), n(2), n(3), n(4), n(5), n(6), n(7), n(8), n(9), n(10));
                    break;
                case 'wave':
                    font(v[1]).drawCentredWave(text(requireNonNull(v[7])), n(2), n(3), n(4), n(5), n(6));
                    break;
                case 'wave2':
                    font(v[1]).drawCentredWave2(text(requireNonNull(v[7])), n(2), n(3), n(4), n(5), n(6));
                    break;
                case 'shake':
                    font(v[1]).drawCentredShake(text(requireNonNull(v[8])), n(2), n(3), n(4), n(5), n(6), n(7));
                    break;
                case 'random':
                    result = 'random ' + font(v[1]).drawRandom(text(requireNonNull(v[7])), n(2), n(3), n(4), n(5), new JavaRandom(), n(6));
                    break;
                case 'randomAligned': {
                    const bounds = new Int32Array(4);
                    const count = font(v[1]).drawRandomAligned(text(requireNonNull(v[11])), n(2), n(3), n(4), n(5), n(6), n(7), n(8), n(9), new JavaRandom(), n(10), bounds);
                    result = 'random ' + count + ' ' + Array.from(bounds).join(',');
                    break;
                }
                case 'width':
                    result = 'width ' + font(v[1]).stringWidth(text(requireNonNull(v[2])));
                    break;
                case 'glyph':
                    font(v[1]).drawGlyph(n(2), n(3), n(4), n(5), n(6), n(7), v[8] === '1');
                    break;
                case 'glyphAlpha':
                    font(v[1]).drawGlyphAlpha(n(2), n(3), n(4), n(5), n(6), n(7), n(8), v[9] === '1');
                    break;
                case 'sprite':
                    requireNonNull(sprite(v[1], v[2])).draw(n(3), n(4));
                    break;
                case 'spriteAlpha':
                    requireNonNull(sprite(v[1], v[2])).drawAlpha(n(3), n(4), n(5));
                    break;
                case 'finalizeFont':
                    Reflect.apply(Reflect.get(font(v[1]), 'finalize'), font(v[1]), []);
                    break;
                case 'finalizeSprite': {
                    const target = requireNonNull(sprite(v[1], v[2]));
                    Reflect.apply(Reflect.get(target, 'finalize'), target, []);
                    break;
                }
                case 'flush':
                    GlCleaner.flush();
                    result = 'counters ' + GlCleaner.textureMemory + ' ' + GlCleaner.memory2d + ' ' + GlCleaner.geometryMemory;
                    break;
                case 'nogl':
                    GlRenderer.gl = null;
                    break;
                default:
                    throw new Error('unknown command ' + line);
            }
        } catch (e) {
            if (e instanceof Error && e.message.startsWith('unknown command')) throw e;
            result = 'throw ' + kind(e);
        }
        results.push(result);
    }
    return { trace: writer.text(), results };
}

loginFixture(
    import.meta.url,
    'HD fonts and indexed sprites upload and draw like the original jar',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-hd-fonts-'));
        try {
            const classpath = [dir, hdGamepackPath, joglPath].join(delimiter);
            const build = Bun.spawnSync(['javac', '-encoding', 'UTF-8', '-cp', classpath, '-d', dir, ...['GlRecorder.java', 'HdFontsOracle.java'].map(name => join(import.meta.dir, name))]);
            expect(build.exitCode, build.stderr.toString()).toBe(0);
            const { entries, fontIds, iconGroup } = collect();
            expect(fontIds.every(id => id >= 0)).toBe(true);
            expect(iconGroup).toBeGreaterThanOrEqual(0);
            const groupsPath = join(dir, 'groups.bin');
            writeGroups(groupsPath, entries);
            const profileJson = readFileSync(join(import.meta.dir, 'rtx5070.json'), 'utf8');
            const profilePath = join(dir, 'profile.json');
            writeFileSync(profilePath, profileJson);
            const commands = script(fontIds, iconGroup);
            const traceDir = join(dir, 'trace');
            const run = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-Dgltrace.stacks=false', '-cp', classpath, 'HdFontsOracle', traceDir, profilePath, groupsPath], {
                stdin: Buffer.from(commands.join('\n') + '\n'),
                maxBuffer: 256 * 1024 * 1024,
                timeout: 600000
            });
            expect(run.exitCode, run.stderr.toString()).toBe(0);
            const java: Run = { results: run.stdout.toString().trimEnd().split(/\r?\n/), trace: readFileSync(join(traceDir, 'trace.tsv'), 'utf8') };
            const ts = runTs(profileJson, entries, commands);
            for (let i = 0; i < Math.max(ts.results.length, java.results.length); i++) {
                if (ts.results[i] !== java.results[i]) throw new Error('result ' + i + ': java ' + java.results[i] + ', ts ' + ts.results[i]);
            }
            const diff = diffTraces(java.trace, ts.trace, { expectedLabel: 'jar', actualLabel: 'ts', includeDeletions: true });
            if (!diff.equal) throw new Error(diff.report);
            // Coverage of the comparison itself: every font uploaded, most sprite groups uploaded, and the draws reached
            // the masked fan, the alpha colour, the strike line and the icon draws.
            const uploads = java.results.filter(line => /^[sf] /.test(line));
            expect(uploads).toHaveLength(entries.length);
            expect(uploads.filter(line => line.startsWith('f ') && line.includes(' ok '))).toHaveLength(entries.filter(e => e.kind === 1).length);
            const spriteOk = uploads.filter(line => line.startsWith('s ') && line.includes(' ok ')).length;
            expect(spriteOk).toBeGreaterThan(0);
            for (const entry of ['\tglTexImage2D\t3553\t0\t6410\t', '\tglTexImage2D\t3553\t0\t6408\t', '\tglMultiTexCoord2f\t33985\t', '\tglColor4ub\t', '\tglColor4f\t', '\tglBegin\t1', '\tglDeleteTextures\t', '\tglDeleteLists\t']) {
                expect(java.trace).toContain(entry);
            }
            console.log('fonts ' + entries.filter(e => e.kind === 1).length + ', sprite groups ' + spriteOk + ' ok / ' + entries.filter(e => e.kind === 0).length + ', trace records ' + java.trace.split('\n').length);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    600000,
    'gl'
);
