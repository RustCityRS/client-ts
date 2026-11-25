import { expect, test } from 'bun:test';
import Client from '#/client/Client.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type Js5 from '../../src/cache/Js5.js';
import JagString from '../../src/datastruct/JagString.js';
import LRUHashCache from '../../src/datastruct/LRUHashCache.js';
import AbstractIndexedSprite from '../../src/graphics/AbstractIndexedSprite.js';
import PixfontGeneric from '../../src/graphics/PixfontGeneric.js';
import Pix2D from '../../src/graphics/Pix2D.js';
import SoftwareFont from '../../src/graphics/SoftwareFont.js';
import SpriteLoader from '../../src/graphics/SpriteLoader.js';
import { byteAt } from '../../src/io/JavaByteArray.js';
import { requireNonNull } from '../../src/util/JavaArray.js';
import JavaRandom from '../../src/util/JavaRandom.js';
import { localAssets, readGroup } from '../cachefile.js';
import { cachePath, gamepackPath } from '../reference.js';
import { PIX2D, SPRITE_LOADER, withClinitStatics } from './staticState.js';

// Differential test for the Font unit: mb (Font), fg (SoftwareFont), the metric-only loader ik.a(II)Lfg; with its
// cache fa.p, the sprite font loader sb.a(Lal;IIILal;)Lmb; and the ag.k name icons, against client.jar.
//
// The test writes one script. font/FontOracle.java runs it against the real gamepack classes and this file runs it
// through the TS port; every script line yields one output line and the two outputs must be identical. Draw and
// measure lines report the return value (or the Java exception class), the ten tag-state statics, the split-line
// buffers mb.vb and mb.L, a hash of the whole framebuffer and every icon draw call. Font lines report the decoded
// line height, paddings, and hashes of the advance, kerning, offset, size, mask and icon arrays.
//
// Inputs: two synthetic full-format fonts (signed kerning edges, random masks), a synthetic 257-byte metric font, and
// all 18 font groups of cache archive 13 (p11_full, p12_full, b12_full, q8_full and the rest) loaded with their
// archive 8 glyph sprites through SpriteLoader.loadFont, plus the same ids through SoftwareFont.getFontMetrics. Deterministic
// edge cases (tag markup, entities, icons, wrapping widths 0/1/narrow/wide, all alignments, wave/shake/random effects
// with fixed cycles and seeds, empty, very long and cp1252 strings, constructor/loader failures, cache eviction) are
// followed by seeded random cases with random clipping, clip masks, icon sets and buffer sizes.
//
// Fonts load through the real SpriteLoader.loadFont (sb.a: ja.a + tf.a) and the real Client.fontMetricsArchive (nf.j).

const RANDOM_CASES = 6000;
const FONT_GROUPS = [305, 307, 468, 473, 494, 495, 496, 497, 584, 591, 645, 646, 647, 648, 764, 776, 819, 1591];
const P11 = 494,
    P12 = 495,
    B12 = 496,
    Q8 = 497;
// Font slots used by the script.
const SYNTH_A = 0,
    SYNTH_B = 1,
    METRIC = 2,
    SCRATCH = 3,
    REAL0 = 4,
    FM0 = 40;
const realSlot = (group: number) => REAL0 + FONT_GROUPS.indexOf(group);

// ---------- script generation ----------

class Rng {
    constructor(private state: number) {}

    next(): number {
        let x = this.state;
        x ^= x << 13;
        x ^= x >>> 17;
        x ^= x << 5;
        this.state = x | 0;
        return this.state;
    }

    int(lo: number, hi: number): number {
        const n = hi - lo + 1;
        return lo + (((this.next() % n) + n) % n);
    }

    pick<T>(values: readonly T[]): T {
        return values[this.int(0, values.length - 1)];
    }

    chance(n: number): boolean {
        return this.int(0, n - 1) === 0;
    }
}

const b64 = (b: Uint8Array) => Buffer.from(b).toString('base64');
const enc = (s: string) => Uint8Array.from(s, c => c.charCodeAt(0) & 255);
const tText = (b: Uint8Array | null) => (b === null ? 'n' : 't' + b64(b));
const tInts = (a: ArrayLike<number> | null) => (a === null ? 'n' : 'i' + Array.from(a).join(','));
const tBytes = (b: Uint8Array | null) => (b === null ? 'n' : 'b' + b64(b));
const tMasks = (m: (Uint8Array | null)[] | null) => (m === null ? 'n' : 'm' + m.map(x => (x === null ? 'n' : 'b' + b64(x))).join(','));
type LineSpec = { cap: number; text: Uint8Array } | null;
const tLines = (l: LineSpec[] | null) => (l === null ? 'n' : 'L' + l.map(x => (x === null ? 'n' : `s${x.cap}.${b64(x.text)}`)).join(','));

// The JS5 container without the two-byte version trailer that the sector files keep after it.
function container(raw: Uint8Array): Uint8Array {
    const length = ((raw[1] << 24) | (raw[2] << 16) | (raw[3] << 8) | raw[4]) >>> 0;
    return raw.subarray(0, (raw[0] === 0 ? 5 : 9) + length);
}

const FRAG = [
    '<col=ff00ff>',
    '</col>',
    '<col=ffffff>',
    '<col=0>',
    '<col=>',
    '<col=zz>',
    '<col=-1>',
    '<col=+7f>',
    '<col=7fffffff>',
    '<col=80000000>',
    '<col=123456789>',
    '<col=FF8000>',
    '<trans=100>',
    '<trans=0>',
    '<trans=255>',
    '<trans=256>',
    '<trans=300>',
    '<trans=-20>',
    '<trans=x>',
    '</trans>',
    '<str=00ff00>',
    '<str>',
    '</str>',
    '<str=>',
    '<u=123456>',
    '<u>',
    '</u>',
    '<u=q>',
    '<shad=111111>',
    '<shad>',
    '</shad>',
    '<shad=-1>',
    '<br>',
    '<br>',
    '<lt>',
    '<gt>',
    '<nbsp>',
    '<shy>',
    '<times>',
    '<euro>',
    '<copy>',
    '<reg>',
    '<img=0>',
    '<img=1>',
    '<img=2>',
    '<img=3>',
    '<img=4>',
    '<img=5>',
    '<img=-1>',
    '<img=x>',
    '<img=>',
    '<img=00>',
    '<img=2147483648>',
    '<foo>',
    '<>',
    '<<br>',
    '<br>>',
    '< br>',
    '<BR>',
    '<col=ff0000',
    '<',
    '>',
    ' ',
    ' ',
    ' ',
    '  ',
    '-',
    '--',
    '- ',
    'the ',
    'quick ',
    'brown-fox ',
    'jumps',
    'over-the-lazy ',
    'antidisestablishmentarianism',
    'a',
    'I',
    'W',
    'mmmmmmmm',
    '.',
    ',',
    'Lumbridge ',
    'Varrock '
];

function randText(r: Rng, maxPieces = 30): Uint8Array {
    const out: number[] = [];
    const pieces = r.chance(25) ? r.int(100, 400) : r.int(0, maxPieces);
    for (let p = 0; p < pieces; p++) {
        const kind = r.int(0, 9);
        if (kind < 4) {
            for (const c of r.pick(FRAG)) out.push(c.charCodeAt(0));
        } else if (kind < 7) {
            out.push(r.int(97, 122));
        } else if (kind < 9) {
            out.push(r.int(1, 255));
        } else {
            out.push(r.chance(4) ? 0 : r.int(128, 255));
        }
    }
    return Uint8Array.from(out);
}

function syntheticFont(r: Rng, maxGlyph: number, edgeRange: number): string {
    const metrics: number[] = [];
    const heights = new Int32Array(256);
    for (let i = 0; i < 256; i++) metrics.push(r.int(0, 14));
    for (let i = 0; i < 256; i++) {
        heights[i] = r.int(0, 9);
        metrics.push(heights[i]);
    }
    for (let i = 0; i < 256; i++) metrics.push(r.int(0, 7));
    for (let e = 0; e < 2; e++) {
        for (let i = 0; i < 256; i++) {
            for (let j = 0; j < heights[i]; j++) metrics.push(i % 17 === 0 ? r.int(0, 255) : r.int(-edgeRange, edgeRange) & 255);
        }
    }
    const xo: number[] = [],
        yo: number[] = [],
        gw: number[] = [],
        gh: number[] = [];
    const masks: (Uint8Array | null)[] = [];
    for (let i = 0; i < 256; i++) {
        gw.push(r.int(0, maxGlyph));
        gh.push(r.int(0, maxGlyph + 2));
        xo.push(r.int(-2, 3));
        yo.push(r.int(-2, 10));
        const mask = new Uint8Array(gw[i] * gh[i]);
        for (let j = 0; j < mask.length; j++) mask[j] = r.chance(3) ? 0 : r.int(0, 255);
        masks.push(mask);
    }
    return [tBytes(Uint8Array.from(metrics)), tInts(xo), tInts(yo), tInts(gw), tInts(gh), tMasks(masks)].join(' ');
}

type Clip = { w: number; h: number; minY: number; maxY: number };

function generate(): string[] {
    const r = new Rng(0x2545f491);
    const s: string[] = [];
    const clip: Clip = { w: 0, h: 0, minY: 0, maxY: 0 };
    const pix = (w: number, h: number, seed: number) => {
        s.push(`pix ${w} ${h} ${seed}`);
        clip.w = w;
        clip.h = h;
        clip.minY = 0;
        clip.maxY = h;
    };
    const setClip = (left: number, top: number, right: number, bottom: number) => {
        s.push(`clip ${left} ${top} ${right} ${bottom}`);
        clip.minY = Math.max(top, 0);
        clip.maxY = Math.min(bottom, clip.h);
    };

    // Constant tag strings and the initial fa.p capacity.
    s.push('consts', 'cacheinfo');

    // Cache data for the Java al instances (the TS side reads the same sector files through localAssets).
    for (const archive of [8, 13]) s.push(`idx ${archive} ${tBytes(container(readGroup(cachePath, 255, archive)))}`);
    for (const group of [0, ...FONT_GROUPS]) s.push(`grp 8 ${group} ${tBytes(container(readGroup(cachePath, 8, group)))}`);
    for (const group of FONT_GROUPS) s.push(`grp 13 ${group} ${tBytes(container(readGroup(cachePath, 13, group)))}`);
    s.push('arch 8 0 0', 'arch 13 0 0');

    // Fonts.
    s.push(`synth ${SYNTH_A} ${syntheticFont(r, 8, 4)}`);
    s.push(`synth ${SYNTH_B} ${syntheticFont(r, 14, 127)}`);
    const small = new Uint8Array(257);
    for (let i = 0; i < 257; i++) small[i] = r.int(0, 255);
    s.push(`metrics ${METRIC} ${tBytes(small)}`);
    for (const group of FONT_GROUPS) s.push(`load ${realSlot(group)} 8 ${group} 0 13`);

    // Constructor and loader failures.
    const zeros = (n: number) => new Uint8Array(n);
    const full = (n: number, v: number) => new Int32Array(n).fill(v);
    const goodMasks = tMasks(new Array<Uint8Array | null>(256).fill(new Uint8Array(0)));
    s.push(`metrics ${SCRATCH} n`, `metrics ${SCRATCH} ${tBytes(zeros(0))}`, `metrics ${SCRATCH} ${tBytes(zeros(256))}`, `metrics ${SCRATCH} ${tBytes(zeros(258))}`);
    s.push(`metrics ${SCRATCH} ${tBytes(zeros(300))}`, `metrics ${SCRATCH} ${tBytes(zeros(768))}`, `metrics ${SCRATCH} ${tBytes(zeros(769))}`);
    s.push(`synth ${SCRATCH} ${tBytes(small)} ${tInts(full(256, 1))} ${tInts(full(256, 2))} ${tInts(full(256, 3))} ${tInts(full(256, 0))} ${goodMasks}`);
    s.push(`synth ${SCRATCH} ${tBytes(small)} ${tInts(full(256, 1))} ${tInts(full(256, -5))} ${tInts(full(256, 3))} ${tInts(full(256, 4))} n`);
    s.push(`synth ${SCRATCH} ${tBytes(small)} ${tInts(full(256, 1))} ${tInts(full(255, 2))} ${tInts(full(256, 3))} ${tInts(full(256, 4))} ${goodMasks}`);
    s.push(`synth ${SCRATCH} ${tBytes(small)} ${tInts(full(256, 1))} ${tInts(full(256, 2))} ${tInts(full(256, 3))} ${tInts(full(200, 4))} ${goodMasks}`);
    s.push(`synth ${SCRATCH} ${tBytes(small)} n ${tInts(full(256, 2))} n ${tInts(full(256, 4))} ${goodMasks}`);
    s.push(`synth ${SCRATCH} ${tBytes(small)} ${tInts(full(256, 1))} n ${tInts(full(256, 3))} ${tInts(full(256, 4))} ${goodMasks}`);
    s.push(`synth ${SCRATCH} n ${tInts(full(256, 1))} ${tInts(full(256, 2))} ${tInts(full(256, 3))} ${tInts(full(256, 4))} ${goodMasks}`);
    s.push(`load ${SCRATCH} 8 ${P11} 1 13`, `load ${SCRATCH} 8 0 0 13`, `load ${SCRATCH} n ${P11} 0 13`, `load ${SCRATCH} 8 ${P11} 0 n`);
    s.push(`load ${SCRATCH} 8 ${P12} 0 13`);

    // Name icons: setNameIcons argument checks.
    for (const [set, heights] of [
        [0, 'n'],
        [1, 'n'],
        [1, 'i4,9,2'],
        [1, 'i4,9'],
        [0, 'i1'],
        [3, 'i'],
        [3, 'n'],
        [2, 'i1,2,3,4,5'],
        [2, 'i1,2,3,4,5,6']
    ] as const) {
        s.push(`icons ${SCRATCH} ${set} ${heights}`);
    }

    // SoftwareFont.getFontMetrics and its 4-entry soft LRU cache.
    s.push('fmarchive 13', 'nameicons 2', 'fmreset 4');
    for (const id of [P11, P12, P11, B12, Q8, 305, 307, P11, 468, 473, P12, P12, 1591, 0, 305, P11]) s.push(`fm ${FM0} ${id}`, 'cacheinfo');
    s.push('nameicons 0');
    for (const id of [584, 591, 584, 645]) s.push(`fm ${FM0 + 1} ${id}`);
    s.push('fmarchive n');
    for (const id of [584, 591, 646]) s.push(`fm ${FM0 + 2} ${id}`);
    s.push('fmarchive 13', 'fmreset 1', 'nameicons 1');
    for (const id of [646, 647, 646, 646, 648]) s.push(`fm ${FM0 + 3} ${id}`);
    s.push('fmreset 4');
    for (const group of FONT_GROUPS) s.push(`fm ${FM0 + 4} ${group}`);

    // Deterministic edge cases on the real fonts.
    const sample = enc('The quick brown fox jumps over the lazy dog. 0123456789 !"#$%&\'()*+,-./:;=?@[\\]^_`{|}~');
    const cp1252 = Uint8Array.from({ length: 128 }, (_, i) => 128 + i);
    const all = Uint8Array.from({ length: 255 }, (_, i) => 1 + i);
    const tagged = enc(
        '<col=ff0000>Red</col> <shad=000000>shadow</shad> <str>strike</str> <u=00ff00>under</u> <trans=128>half <img=0> faded</trans> <img=1><img=3> a<lt>b<gt>c <br>next line <nbsp><shy><times><euro><copy><reg> <col=00ff00><shad>both<br>reset after br <u>under<str=ff>both</str></u> end'
    );
    const words = enc(
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis-nostrud-exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.'
    );
    const long = Uint8Array.from({ length: 3000 }, (_, i) => (i % 11 === 10 ? 32 : i % 23 === 22 ? 45 : 97 + (i % 26)));
    const longTagged = enc(Array.from({ length: 120 }, (_, i) => `<col=${((i * 2654435761) >>> 8).toString(16)}>w${i}</col> `).join(''));
    const empty = new Uint8Array(0);
    const texts = [sample, cp1252, all, tagged, words, long, longTagged, empty, enc('<br>'), enc('<br><br>x<br>'), enc('-'), enc(' '), enc('a-b-c-d-e-f-g-h-i-j-k')];
    const colours = [0xffffff, 0xff0000, 0];
    const shadows = [-1, 0, 0x123456];

    const realFonts = [P11, P12, B12, Q8];
    for (const group of realFonts) {
        const f = realSlot(group);
        pix(220, 140, group);
        s.push(`icons ${f} 2 n`);
        for (const t of texts) s.push(`width ${f} ${tText(t)}`);
        for (const t of [sample, cp1252, tagged, empty, all]) {
            for (const op of ['left', 'centre', 'right']) s.push(`${op} ${f} ${tText(t)} 110 ${r.int(10, 130)} ${r.pick(colours)} ${r.pick(shadows)}`);
        }
        s.push(`icons ${f} 2 i0,5,9,14,-2`);
        for (const width of [0, 1, 20, 60, 500]) {
            for (let alignX = 0; alignX < 4; alignX++) {
                for (let alignY = 0; alignY < 4; alignY++) {
                    pix(220, 140, width * 16 + alignX * 4 + alignY);
                    const lineHeight = (alignX + alignY) % 3 === 0 ? 0 : 14;
                    s.push(`para ${f} ${tText(tagged)} 5 5 ${width} 130 ${r.pick(colours)} ${r.pick(shadows)} ${alignX} ${alignY} ${lineHeight}`);
                    s.push(`paraA ${f} ${tText(words)} 5 5 ${width} 130 ${r.pick(colours)} ${r.pick(shadows)} ${r.pick([0, 64, 128, 255, 256])} ${alignX} ${alignY} ${lineHeight}`);
                }
            }
            for (const t of [tagged, words, long, longTagged, all]) {
                s.push(`lines ${f} ${tText(t)} ${width}`, `pwidth ${f} ${tText(t)} ${width}`);
            }
        }
        for (const height of [0, 5, 13, 26, 400]) {
            s.push(`para ${f} ${tText(words)} 0 0 100 ${height} 16777215 -1 0 3 0`);
            s.push(`randA ${f} ${tText(sample)} 3 4 150 ${height} 255 0 1 1 r 99 i0,0,0,0`);
        }
        pix(220, 140, group + 1);
        for (const cycle of [0, 1, 7, 50, 1000, -33, 2147483647]) {
            s.push(`wave ${f} ${tText(sample)} 110 60 16776960 0 ${cycle}`);
            s.push(`wave2 ${f} ${tText(tagged)} 110 80 65280 -1 ${cycle}`);
        }
        for (const [cycle, shake] of [
            [0, 0],
            [1, 8],
            [7, 56],
            [50, 100],
            [3, -50],
            [2147483647, -2147483648]
        ]) {
            s.push(`shake ${f} ${tText(sample)} 110 100 16711680 0 ${cycle} ${shake}`);
        }
        for (const seed of [0, 1, 12345, -1, 2147483647]) {
            s.push(`rand ${f} ${tText(tagged)} 2 30 16777215 0 r ${seed}`);
            for (let align = 0; align < 3; align++) s.push(`randA ${f} ${tText(sample)} 10 10 200 100 255 -1 ${align} ${2 - align} r ${seed} ${align === 0 ? 'n' : 'i0,0,0,0'}`);
        }
        s.push(`rand ${f} ${tText(sample)} 2 30 16777215 0 n 5`, `randA ${f} ${tText(sample)} 2 30 9 9 1 1 0 0 n 5 n`, `rand ${f} n 2 30 1 0 n 5`);
        s.push(`randA ${f} ${tText(sample)} 2 30 9 9 1 1 2 0 r 5 i0,0`, `randA ${f} ${tText(sample)} 2 30 9 9 1 1 2 0 r 5 i0,0,0,0,0`);
        for (const widths of ['n', 'i', 'i0', 'i1', 'i40', 'i500', 'i30,60,90', 'i-1']) {
            for (const t of [tagged, words, long]) {
                s.push(`split ${f} ${tText(t)} ${widths} ${tLines(new Array<LineSpec>(100).fill(null))}`);
            }
            s.push(`split ${f} ${tText(words)} ${widths} ${tLines([{ cap: 0, text: empty }, null, { cap: 40, text: enc('stale') }])}`);
            s.push(`split ${f} ${tText(words)} ${widths} n`);
        }
        s.push(`escape ${tText(tagged)}`, `escape ${tText(empty)}`, `escape ${tText(enc('<<>>'))}`, 'escape n');
        for (const op of ['left', 'centre', 'right', 'wave', 'wave2', 'width', 'lines', 'pwidth']) {
            const args = op === 'width' ? '' : op === 'lines' || op === 'pwidth' ? ' 10' : ' 1 2 3 4' + (op.startsWith('wave') ? ' 5' : '');
            s.push(`${op} ${f} n${args}`);
        }
        s.push(`para ${f} n 1 2 3 4 5 6 7 8 9`, `paraA ${f} n 1 2 3 4 5 6 7 8 9 10`, `shake ${f} n 1 2 3 4 5 6`, `split ${f} n i1 n`, `randA ${f} n 1 2 3 4 5 6 7 8 n 1 n`);
    }
    // Every real font once: basic draws, a paragraph and all byte values.
    for (const group of FONT_GROUPS) {
        const f = realSlot(group);
        pix(256, 128, group);
        s.push(`icons ${f} 1 n`);
        s.push(`left ${f} ${tText(all.subarray(0, 128))} 0 30 16777215 0`, `left ${f} ${tText(all.subarray(127))} 0 60 255 -1`);
        s.push(`para ${f} ${tText(tagged)} 4 70 240 50 65280 0 3 3 0`, `width ${f} ${tText(all)}`, `wave ${f} ${tText(sample)} 128 120 1 2 17`);
    }
    // Metric-only fonts: measuring works, drawing a glyph dereferences the missing masks and offsets.
    for (const f of [METRIC, FM0 + 4]) {
        pix(64, 32, f);
        s.push(`width ${f} ${tText(sample)}`, `width ${f} ${tText(tagged)}`, `lines ${f} ${tText(words)} 50`, `pwidth ${f} ${tText(words)} 50`);
        s.push(`left ${f} ${tText(sample)} 1 20 1 -1`, `left ${f} ${tText(enc('<img=0><col=ff><br>'))} 1 20 1 -1`, `glyph ${f} 65 1 1 3 3 255 0`, `glyph ${f} 65 1 1 0 3 255 0`);
    }
    // Glyph plotting edges on a synthetic font: clipping on every side, oversize and negative boxes, bad indices.
    for (const font of [SYNTH_A, SYNTH_B]) {
        pix(40, 30, font);
        for (const [x, y, w, h] of [
            [-3, -3, 8, 10],
            [36, 25, 8, 10],
            [10, 10, 0, 5],
            [10, 10, 5, 0],
            [10, 10, -1, 4],
            [0, 0, 40, 30],
            [5, 5, 3, 3],
            [39, 29, 1, 1]
        ]) {
            for (const c of [65, 0, 255]) {
                s.push(`glyph ${font} ${c} ${x} ${y} ${w} ${h} 16711935 ${c & 1}`, `glyphA ${font} ${c} ${x} ${y} ${w} ${h} 65535 ${r.int(0, 256)} 1`);
            }
        }
        s.push(`glyph ${font} -1 1 1 2 2 1 0`, `glyph ${font} 256 1 1 2 2 1 0`, `glyphA ${font} 300 1 1 2 2 1 128 0`);
        setClip(5, 5, 30, 20);
        s.push(`mask ${tInts(Array.from({ length: 15 }, (_, i) => i - 3))} ${tInts(Array.from({ length: 15 }, (_, i) => ((i * 7) % 20) - 2))}`);
        for (let i = 0; i < 12; i++) s.push(`glyph ${font} ${r.int(0, 255)} ${r.int(0, 34)} ${r.int(0, 24)} ${r.int(0, 9)} ${r.int(0, 11)} ${r.next()} 0`);
        s.push('cliprst', 'mask i i', `mask ${tInts(new Array(30).fill(0))} ${tInts(new Array(29).fill(0))}`, 'mask n n', 'nomask');
    }

    // Seeded random cases.
    const drawable = [SYNTH_A, SYNTH_A, SYNTH_B, ...FONT_GROUPS.map(realSlot), realSlot(P11), realSlot(P12), realSlot(B12), realSlot(Q8)];
    const ops = ['left', 'centre', 'right', 'para', 'paraA', 'wave', 'wave2', 'shake', 'rand', 'randA', 'width', 'lines', 'pwidth', 'split', 'escape', 'glyph', 'glyphA'];
    const widthsPool = [0, 1, 2, 5, 10, 30, 60, 100, 150, 200, 1000, -5];
    for (let k = 0; k < RANDOM_CASES; k++) {
        if (r.chance(12)) {
            const [w, h] = r.pick([
                [1, 1],
                [7, 3],
                [3, 200],
                [300, 20],
                [0, 0],
                [64, 64]
            ]);
            pix(w, h, r.next());
        } else {
            pix(160, 100, r.next());
        }
        if (r.chance(3)) setClip(r.int(-5, 60), r.int(-5, 40), r.int(-10, 170), r.int(-10, 110));
        if (r.chance(15)) s.push('cliprst');
        if (r.chance(4)) {
            const n = clip.maxY - clip.minY;
            if (n >= 0 && !r.chance(20)) {
                const offs = Array.from({ length: n }, () => r.int(-10, 120));
                const lens = Array.from({ length: n }, () => (r.chance(30) ? r.int(-5, -1) : r.int(0, 100)));
                s.push(`mask ${tInts(offs)} ${tInts(lens)}`);
            } else {
                s.push(`mask ${tInts(new Array(Math.max(0, n + 1)).fill(0))} ${tInts(new Array(Math.max(0, n + 1)).fill(0))}`);
            }
        } else {
            s.push('nomask');
        }
        const f = r.chance(30) ? r.pick([METRIC, FM0, FM0 + 3, FM0 + 4]) : r.pick(drawable);
        if (r.chance(3)) {
            const set = r.int(0, 3);
            const sizes = [0, 3, 5, 0];
            const heights = r.chance(2) ? 'n' : tInts(Array.from({ length: r.chance(10) ? sizes[set] + 1 : sizes[set] }, () => r.int(-5, 20)));
            s.push(`icons ${f} ${set} ${heights}`);
        }
        const text = r.chance(25) ? 'n' : tText(randText(r));
        const op = r.pick(ops);
        const x = r.int(-40, 200),
            y = r.int(-20, 140);
        const colour = r.chance(5) ? r.next() : r.next() & 0xffffff;
        const shadow = r.chance(3) ? -1 : r.chance(4) ? 0 : r.next() & 0xffffff;
        const w = r.chance(2) ? r.pick(widthsPool) : r.int(-5, 220);
        const h = r.chance(2) ? r.pick(widthsPool) : r.int(-5, 160);
        const alignX = r.chance(10) ? r.pick([-1, 4, 7]) : r.int(0, 3);
        const alignY = r.chance(10) ? r.pick([-1, 4, 7]) : r.int(0, 3);
        const lineHeight = r.chance(3) ? 0 : r.int(-3, 30);
        const alpha = r.chance(8) ? r.pick([-10, 300, 256, 0]) : r.int(0, 256);
        const cycle = r.chance(4) ? r.pick([0, 1, 5, 100, 12345, -7, 2147483647, -2147483648]) : r.int(-1000, 1000);
        const shake = r.chance(6) ? r.pick([-2147483648, 2147483647, 0, 56]) : r.int(-100, 100);
        const seed = r.next();
        const rnd = r.chance(40) ? 'n' : 'r';
        switch (op) {
            case 'left':
            case 'centre':
            case 'right':
                s.push(`${op} ${f} ${text} ${x} ${y} ${colour} ${shadow}`);
                break;
            case 'para':
                s.push(`para ${f} ${text} ${x} ${y} ${w} ${h} ${colour} ${shadow} ${alignX} ${alignY} ${lineHeight}`);
                break;
            case 'paraA':
                s.push(`paraA ${f} ${text} ${x} ${y} ${w} ${h} ${colour} ${shadow} ${alpha} ${alignX} ${alignY} ${lineHeight}`);
                break;
            case 'wave':
            case 'wave2':
                s.push(`${op} ${f} ${text} ${x} ${y} ${colour} ${shadow} ${cycle}`);
                break;
            case 'shake':
                s.push(`shake ${f} ${text} ${x} ${y} ${colour} ${shadow} ${cycle} ${shake}`);
                break;
            case 'rand':
                s.push(`rand ${f} ${text} ${x} ${y} ${colour} ${shadow} ${rnd} ${seed}`);
                break;
            case 'randA': {
                const bounds = r.chance(3) ? 'n' : tInts(new Array(r.chance(10) ? r.int(0, 3) : 4).fill(-9));
                s.push(`randA ${f} ${text} ${x} ${y} ${w} ${h} ${colour} ${shadow} ${alignX} ${alignY} ${rnd} ${seed} ${bounds}`);
                break;
            }
            case 'width':
                s.push(`width ${f} ${text}`);
                break;
            case 'lines':
            case 'pwidth':
                s.push(`${op} ${f} ${text} ${w}`);
                break;
            case 'split': {
                const widths = r.chance(5) ? 'n' : tInts(Array.from({ length: r.int(0, 3) }, () => (r.chance(2) ? r.pick(widthsPool) : r.int(-5, 120))));
                let lines: LineSpec[] | null = null;
                if (!r.chance(7)) {
                    lines = Array.from({ length: r.chance(3) ? 100 : r.int(0, 8) }, () => {
                        if (r.chance(2)) return null;
                        const t = randText(r, 4);
                        return { cap: t.length + r.int(0, 6), text: t };
                    });
                }
                s.push(`split ${f} ${text} ${widths} ${tLines(lines)}`);
                break;
            }
            case 'escape':
                s.push(`escape ${text}`);
                break;
            case 'glyph':
            case 'glyphA': {
                const c = r.chance(30) ? r.pick([-1, 256]) : r.int(0, 255);
                const gx = r.int(-12, 170),
                    gy = r.int(-12, 110),
                    gw = r.int(-2, 16),
                    gh = r.int(-2, 18);
                if (op === 'glyph') s.push(`glyph ${f} ${c} ${gx} ${gy} ${gw} ${gh} ${colour} ${r.int(0, 1)}`);
                else s.push(`glyphA ${f} ${c} ${gx} ${gy} ${gw} ${gh} ${colour} ${alpha} ${r.int(0, 1)}`);
                break;
            }
        }
    }
    return s;
}

// ---------- TS interpreter (mirrors FontOracle.run) ----------

let log = '';

// Records the img= tag's draw calls, like the oracle's si subclass.
class RecordingSprite extends AbstractIndexedSprite {
    constructor(
        private readonly idx: number,
        w: number,
        h: number
    ) {
        super();
        this.cropW = w;
        this.cropH = h;
    }

    draw(x: number, y: number): void {
        log += `d${this.idx},${x},${y};`;
    }

    drawAlpha(x: number, y: number, alpha: number): void {
        log += `a${this.idx},${x},${y},${alpha};`;
    }
}

function sprite(idx: number, w: number, h: number): RecordingSprite {
    return new RecordingSprite(idx, w, h);
}

const iconSets: ((AbstractIndexedSprite | null)[] | null)[] = [null, [sprite(0, 5, 7), sprite(1, 0, 3), null], [sprite(0, 13, 11), sprite(1, 8, 8), sprite(2, 1, 1), sprite(3, 20, 4), sprite(4, -3, 2)], []];

function hashInts(a: ArrayLike<number> | null): number {
    if (a === null) return 7;
    let h = a.length;
    for (let i = 0; i < a.length; i++) h = (Math.imul(h, 31) + a[i]) | 0;
    return h;
}

function hashBytes(a: Uint8Array | null): number {
    if (a === null) return 7;
    let h = a.length;
    for (let i = 0; i < a.length; i++) h = (Math.imul(h, 31) + ((a[i] << 24) >> 24)) | 0;
    return h;
}

function hashMasks(a: (Uint8Array | null)[] | null): number {
    if (a === null) return 7;
    let h = a.length;
    for (const m of a) h = (Math.imul(h, 31) + hashBytes(m)) | 0;
    return h;
}

function str(s: JagString | null): string {
    if (s === null) return 'n';
    const parts: number[] = [];
    for (let i = 0; i < s.length; i++) parts.push(byteAt(s.bytes, i) & 255);
    return '[' + parts.join('.') + ']';
}

function strHash(s: JagString | null): number {
    if (s === null) return 7;
    let h = s.length;
    for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + (byteAt(s.bytes, i) & 255)) | 0;
    return h;
}

function statics(): string {
    const values = [
        PixfontGeneric.colour,
        PixfontGeneric.alpha,
        PixfontGeneric.strikeColour,
        PixfontGeneric.shadowColour,
        PixfontGeneric.underlineColour,
        PixfontGeneric.defaultShadowColour,
        PixfontGeneric.defaultColour,
        PixfontGeneric.defaultAlpha,
        PixfontGeneric.justifySpacing,
        PixfontGeneric.justifyRemainder
    ];
    let h = requireNonNull(PixfontGeneric.splitLines).length;
    for (const s of requireNonNull(PixfontGeneric.splitLines)) h = (Math.imul(h, 31) + strHash(s)) | 0;
    return values.join(',') + ',' + h + ',' + strHash(PixfontGeneric.splitBuffer);
}

// mb.A, O, N, U, T, V, D, Q, E, G, W, B, S, J, gb, fb, db, eb, Z, ab, I, X, F, jb, kb (mb.<clinit> order).
const CONSTS = () => [
    PixfontGeneric.entityReg,
    PixfontGeneric.entityTimes,
    PixfontGeneric.entityGt,
    PixfontGeneric.entityEuro,
    PixfontGeneric.entityShy,
    PixfontGeneric.entityLt,
    PixfontGeneric.tagBreak,
    PixfontGeneric.tagColour,
    PixfontGeneric.tagColourEnd,
    PixfontGeneric.tagShadow,
    PixfontGeneric.entityNbsp,
    PixfontGeneric.tagUnderlineEnd,
    PixfontGeneric.tagUnderline,
    PixfontGeneric.tagStrike,
    PixfontGeneric.escapedGt,
    PixfontGeneric.tagTransEnd,
    PixfontGeneric.tagStrikeDefault,
    PixfontGeneric.escapedLt,
    PixfontGeneric.tagImage,
    PixfontGeneric.tagTrans,
    PixfontGeneric.tagUnderlineDefault,
    PixfontGeneric.tagShadowDefault,
    PixfontGeneric.tagStrikeEnd,
    PixfontGeneric.tagShadowEnd,
    PixfontGeneric.entityCopy
];

function iconSetId(icons: unknown): string {
    if (icons === null) return 'n';
    for (let i = 1; i < iconSets.length; i++) if (iconSets[i] === icons) return String(i);
    return '?';
}

function fontLine(f: PixfontGeneric | null): string {
    if (f === null) return 'null';
    const masks = f instanceof SoftwareFont ? f['glyphMasks'] : null;
    return [
        'F',
        f.lineHeight,
        f['paddingTop'],
        f['paddingBottom'],
        hashInts(f['glyphAdvances']),
        hashBytes(f['kerning']),
        hashInts(f['glyphXOffsets']),
        hashInts(f['glyphYOffsets']),
        hashInts(f['glyphWidths']),
        hashInts(f['glyphHeights']),
        hashMasks(masks),
        iconSetId(f['icons']),
        hashInts(f['iconHeights'])
    ].join(' ');
}

function err(e: unknown): string {
    // JagString.appendChar (id.d(II)Lid;, not this unit) models Java's IllegalArgumentException("invalid char") as a
    // RangeError; Font.escape reaches it for a char 0. Classify it as the Java exception it stands for.
    if (e instanceof RangeError && e.message === 'Invalid character') return 'IAE';
    if (e instanceof TypeError) return 'NPE';
    if (e instanceof RangeError) return 'IDX';
    if (e instanceof Error && e.message === 'IllegalArgumentException') return 'IAE';
    if (e instanceof Error && e.message.includes('ArithmeticException')) return 'ARITH';
    return e instanceof Error ? `JS:${e.name}:${e.message}` : `JS:${String(e)}`;
}

const fromB64 = (s: string) => new Uint8Array(Buffer.from(s, 'base64'));

function text(tok: string): JagString | null {
    if (tok === 'n') return null;
    const b = fromB64(tok.substring(1));
    const s = new JagString();
    s.bytes = b;
    s.length = b.length;
    return s;
}

function ints(tok: string): Int32Array | null {
    if (tok === 'n') return null;
    const body = tok.substring(1);
    return body === '' ? new Int32Array(0) : Int32Array.from(body.split(','), Number);
}

const bytes = (tok: string) => (tok === 'n' ? null : fromB64(tok.substring(1)));

function masks(tok: string): (Uint8Array | null)[] | null {
    if (tok === 'n') return null;
    const body = tok.substring(1);
    return body === '' ? [] : body.split(',').map(p => (p === 'n' ? null : fromB64(p.substring(1))));
}

function lines(tok: string): (JagString | null)[] | null {
    if (tok === 'n') return null;
    const body = tok.substring(1);
    if (body === '') return [];
    return body.split(',').map(p => {
        if (p === 'n') return null;
        const dot = p.indexOf('.');
        const b = fromB64(p.substring(dot + 1));
        const s = new JagString();
        s.bytes = new Uint8Array(Number(p.substring(1, dot)));
        s.bytes.set(b);
        s.length = b.length;
        return s;
    });
}

const i = (v: string) => Number.parseInt(v, 10);

// A Java null receiver throws at the call.
function nonNull<T>(value: T | null | undefined): T {
    if (value === null || value === undefined) throw new TypeError('null receiver');
    return value;
}

function soft(f: PixfontGeneric | null): SoftwareFont {
    if (!(f instanceof SoftwareFont)) throw new TypeError('null receiver');
    return f;
}

class Interpreter {
    readonly fonts: (PixfontGeneric | null)[] = new Array<PixfontGeneric | null>(64).fill(null);
    readonly seen: PixfontGeneric[] = [];
    readonly archives = new Map<number, Js5>();
    pixels = new Int32Array(0);
    readonly random = new JavaRandom(0n);

    constructor(private readonly archive: (id: number) => Js5) {}

    drawn(res: string): string {
        return `${res} S${statics()} P${hashInts(this.pixels)} L${log}`;
    }

    run(a: string[]): string {
        switch (a[0]) {
            case 'idx':
            case 'grp':
                return 'ok';
            case 'arch':
                this.archives.set(i(a[1]), this.archive(i(a[1])));
                return 'ok';
            case 'synth':
                this.fonts[i(a[1])] = null;
                this.fonts[i(a[1])] = new SoftwareFont(bytes(a[2]), ints(a[3]), ints(a[4]), ints(a[5]), ints(a[6]), masks(a[7]));
                return fontLine(this.fonts[i(a[1])]);
            case 'metrics':
                this.fonts[i(a[1])] = null;
                this.fonts[i(a[1])] = new SoftwareFont(bytes(a[2]));
                return fontLine(this.fonts[i(a[1])]);
            case 'load': {
                const sprites = a[2] === 'n' ? null : (this.archives.get(i(a[2])) ?? null);
                const metrics = a[5] === 'n' ? null : (this.archives.get(i(a[5])) ?? null);
                const f = SpriteLoader.loadFont(sprites, i(a[3]), i(a[4]), metrics);
                this.fonts[i(a[1])] = f;
                return fontLine(f);
            }
            case 'fm': {
                const f = SoftwareFont.getFontMetrics(i(a[2]));
                this.fonts[i(a[1])] = f;
                let k = this.seen.indexOf(f);
                if (k === -1) {
                    k = this.seen.length;
                    this.seen.push(f);
                }
                return `#${k} ${fontLine(f)}`;
            }
            case 'fmreset':
                SoftwareFont.cache = new LRUHashCache<SoftwareFont>(i(a[1]));
                return 'ok';
            case 'fmarchive':
                Client.fontMetricsArchive = a[1] === 'n' ? null : (this.archives.get(i(a[1])) ?? null);
                return 'ok';
            case 'nameicons':
                PixfontGeneric.nameIcons = iconSets[i(a[1])];
                return 'ok';
            case 'icons':
                nonNull(this.fonts[i(a[1])]).setNameIcons(iconSets[i(a[2])], ints(a[3]));
                return 'ok ' + fontLine(this.fonts[i(a[1])]);
            case 'pix': {
                const w = i(a[1]),
                    h = i(a[2]),
                    seed = i(a[3]);
                this.pixels = new Int32Array(w * h);
                for (let p = 0; p < this.pixels.length; p++) this.pixels[p] = (Math.imul(p, 0x9e3779b1 | 0) ^ seed) & 0xffffff;
                Pix2D.setPixels(this.pixels, w, h);
                return 'ok';
            }
            case 'clip':
                Pix2D.setClipping(i(a[1]), i(a[2]), i(a[3]), i(a[4]));
                return `ok ${Pix2D.clipMinX},${Pix2D.clipMinY},${Pix2D.clipMaxX},${Pix2D.clipMaxY}`;
            case 'cliprst':
                Pix2D.resetClipping();
                return `ok ${Pix2D.clipMinX},${Pix2D.clipMinY},${Pix2D.clipMaxX},${Pix2D.clipMaxY}`;
            case 'mask':
                Pix2D.setClipMask(ints(a[1]), ints(a[2]));
                return 'ok';
            case 'nomask':
                Pix2D.clearClipMask();
                return 'ok';
            case 'escape':
                return this.drawn(str(PixfontGeneric.escape(text(a[1]))));
            case 'consts':
                return ['C', ...CONSTS().map(str)].join(' ');
            case 'cacheinfo':
                return `c ${SoftwareFont.cache['m_cacheSize']} ${SoftwareFont.cache['remaining']}`;
            default:
                break;
        }

        const font = this.fonts[i(a[1])];
        log = '';
        let res: string;
        try {
            const random = (tok: string) => (tok === 'n' ? null : this.random);
            switch (a[0]) {
                case 'left':
                    nonNull(font).drawLeft(text(a[2]), i(a[3]), i(a[4]), i(a[5]), i(a[6]));
                    res = 'v';
                    break;
                case 'centre':
                    nonNull(font).drawCentred(text(a[2]), i(a[3]), i(a[4]), i(a[5]), i(a[6]));
                    res = 'v';
                    break;
                case 'right':
                    nonNull(font).drawRight(text(a[2]), i(a[3]), i(a[4]), i(a[5]), i(a[6]));
                    res = 'v';
                    break;
                case 'para':
                    res = String(nonNull(font).drawParagraph(text(a[2]), i(a[3]), i(a[4]), i(a[5]), i(a[6]), i(a[7]), i(a[8]), i(a[9]), i(a[10]), i(a[11])));
                    break;
                case 'paraA':
                    res = String(nonNull(font).drawParagraphAlpha(text(a[2]), i(a[3]), i(a[4]), i(a[5]), i(a[6]), i(a[7]), i(a[8]), i(a[9]), i(a[10]), i(a[11]), i(a[12])));
                    break;
                case 'wave':
                    nonNull(font).drawCentredWave(text(a[2]), i(a[3]), i(a[4]), i(a[5]), i(a[6]), i(a[7]));
                    res = 'v';
                    break;
                case 'wave2':
                    nonNull(font).drawCentredWave2(text(a[2]), i(a[3]), i(a[4]), i(a[5]), i(a[6]), i(a[7]));
                    res = 'v';
                    break;
                case 'shake':
                    nonNull(font).drawCentredShake(text(a[2]), i(a[3]), i(a[4]), i(a[5]), i(a[6]), i(a[7]), i(a[8]));
                    res = 'v';
                    break;
                case 'rand':
                    res = String(nonNull(font).drawRandom(text(a[2]), i(a[3]), i(a[4]), i(a[5]), i(a[6]), random(a[7]), i(a[8])));
                    break;
                case 'randA': {
                    const bounds = ints(a[13]);
                    res =
                        String(nonNull(font).drawRandomAligned(text(a[2]), i(a[3]), i(a[4]), i(a[5]), i(a[6]), i(a[7]), i(a[8]), i(a[9]), i(a[10]), random(a[11]), i(a[12]), bounds)) +
                        ':' +
                        (bounds === null ? 'n' : `${bounds[0]},${bounds[1]},${bounds[2]},${bounds[3]}`);
                    break;
                }
                case 'width':
                    res = String(nonNull(font).stringWidth(text(a[2])));
                    break;
                case 'lines':
                    res = String(nonNull(font).getParagraphLineCount(text(a[2]), i(a[3])));
                    break;
                case 'pwidth':
                    res = String(nonNull(font).getParagraphWidth(text(a[2]), i(a[3])));
                    break;
                case 'split': {
                    const out = lines(a[4]);
                    let sb: string;
                    try {
                        sb = String(nonNull(font).splitParagraph(text(a[2]), ints(a[3]), out));
                    } catch (e) {
                        sb = err(e);
                    }
                    if (out !== null) for (const line of out) sb += ':' + str(line);
                    res = sb;
                    break;
                }
                case 'glyph':
                    soft(font).drawGlyph(i(a[2]), i(a[3]), i(a[4]), i(a[5]), i(a[6]), i(a[7]), a[8] === '1');
                    res = 'v';
                    break;
                case 'glyphA':
                    soft(font).drawGlyphAlpha(i(a[2]), i(a[3]), i(a[4]), i(a[5]), i(a[6]), i(a[7]), i(a[8]), a[9] === '1');
                    res = 'v';
                    break;
                default:
                    throw new Error('unknown op ' + a[0]);
            }
        } catch (e) {
            if (e instanceof Error && e.message.startsWith('unknown op')) throw e;
            res = err(e);
        }
        return this.drawn(res);
    }
}

function runOracle(script: string): string[] {
    const source = fileURLToPath(new URL('./font/FontOracle.java', import.meta.url));
    const dir = mkdtempSync(join(tmpdir(), 'font-oracle-'));
    try {
        const javac = Bun.spawnSync(['javac', '-nowarn', '-cp', gamepackPath, '-d', dir, source], { timeout: 60000 });
        if (javac.exitCode !== 0) throw new Error(javac.stderr.toString());
        const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-Xss4m', '-cp', gamepackPath + delimiter + dir, 'FontOracle'], {
            stdin: Buffer.from(script, 'latin1'),
            timeout: 240000
        });
        if (java.exitCode !== 0) throw new Error(java.stderr.toString());
        return java.stdout
            .toString()
            .split('\n')
            .map(line => line.trimEnd())
            .filter(line => line.length > 0);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

test('Font, SoftwareFont, SpriteLoader.loadFont and getFontMetrics match mb, fg, sb.a and ik.a in client.jar', () => {
    const assets = localAssets(cachePath, [8, 13]);
    expect(['p11_full', 'p12_full', 'b12_full', 'q8_full'].map(name => assets.groupId(8, name))).toEqual([P11, P12, B12, Q8]);
    expect(['p11_full', 'p12_full', 'b12_full', 'q8_full'].map(name => assets.groupId(13, name))).toEqual([P11, P12, B12, Q8]);
    for (const group of FONT_GROUPS) expect(requireNonNull(assets.file(13, group)).length).toBe(257);
    const script = generate();
    const want = runOracle(script.join('\n') + '\n');

    const savedCache = SoftwareFont.cache,
        savedIcons = PixfontGeneric.nameIcons,
        savedMetrics = Client.fontMetricsArchive;
    // Other suites (e.g. the CS2 interpreter) draw with the real Font and leave its shared scratch statics populated; the
    // Java oracle runs in a fresh JVM, so start the TS side from mb's <clinit> values and put the shared state back after.
    const fontStatics = ['splitBuffer', 'splitLines', 'defaultAlpha', 'colour', 'justifySpacing', 'strikeColour', 'defaultColour', 'alpha', 'defaultShadowColour', 'justifyRemainder', 'underlineColour', 'shadowColour'] as const;
    const fontState = PixfontGeneric as unknown as Record<(typeof fontStatics)[number], unknown>;
    const savedFont = fontStatics.map(name => fontState[name]);
    Object.assign(fontState, {
        splitBuffer: JagString.allocate(100),
        splitLines: new Array<JagString | null>(100).fill(null),
        defaultAlpha: 256,
        colour: 0,
        justifySpacing: 0,
        strikeColour: -1,
        defaultColour: 0,
        alpha: 256,
        defaultShadowColour: -1,
        justifyRemainder: 0,
        underlineColour: -1,
        shadowColour: -1
    });
    const got: string[] = [];
    try {
        withClinitStatics([PIX2D(), SPRITE_LOADER()], () => {
            const interpreter = new Interpreter(id => assets.archive(id));
            for (const line of script) {
                let res: string;
                try {
                    res = interpreter.run(line.split(' '));
                } catch (e) {
                    if (e instanceof Error && e.message.startsWith('unknown op')) throw e;
                    res = 'ERR ' + err(e);
                }
                got.push(res.trimEnd());
            }
        });
    } finally {
        Client.fontMetricsArchive = savedMetrics;
        fontStatics.forEach((name, i) => {
            fontState[name] = savedFont[i];
        });
        SoftwareFont.cache = savedCache;
        PixfontGeneric.nameIcons = savedIcons;
    }

    expect(want.length).toBe(script.length);
    const mismatches: { line: number; op: string; got: string; want: string }[] = [];
    for (let k = 0; k < want.length && mismatches.length < 5; k++) {
        if (got[k] !== want[k]) mismatches.push({ line: k, op: script[k].slice(0, 300), got: got[k], want: want[k] });
    }
    expect(mismatches).toEqual([]);
    // The script reaches the failure paths and the draw paths it was written for.
    expect(want.filter(line => line.startsWith('NPE ')).length).toBeGreaterThan(0);
    expect(want.filter(line => line.startsWith('IDX ')).length).toBeGreaterThan(0);
    expect(want.filter(line => line === 'ERR IAE').length).toBeGreaterThan(0);
    expect(want.filter(line => line.startsWith('null')).length).toBeGreaterThan(0);
    expect(new Set(want.filter(line => line.startsWith('#')).map(line => line.split(' ')[0])).size).toBeGreaterThan(18);
    expect(got).toEqual(want);
}, 300000);
