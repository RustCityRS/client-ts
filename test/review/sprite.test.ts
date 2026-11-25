import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Js5 from '../../src/cache/Js5.js';
import Js5Index from '../../src/cache/Js5Index.js';
import Js5ResourceProvider from '../../src/cache/Js5ResourceProvider.js';
import { fromJsString } from '../../src/datastruct/JagString.js';
import Pix2D from '../../src/graphics/Pix2D.js';
import SoftwareAlphaSprite from '../../src/graphics/SoftwareAlphaSprite.js';
import Pix32 from '../../src/graphics/Pix32.js';
import SpriteLoader from '../../src/graphics/SpriteLoader.js';
import Crc32 from '../../src/io/Crc32.js';
import { doubleToInt } from '../../src/util/IntUtils.js';
import { readGroup } from '../cachefile.js';
import { cachePath, gamepackPath } from '../reference.js';

// vc (AbstractSprite), rh (SoftwareSprite) and vh (SoftwareAlphaSprite) against client.jar. The test builds a
// seeded script of operations, runs it through the TS port as it goes, then pipes the same script into
// sprite/SpriteOracle.java, which runs it on the real gamepack classes. After every operation both sides report
// whether it completed or threw (and which Java exception), the td framebuffer (identity, size, hash, clip, clip
// mask) and the sprite (class, all six vc fields, pixel-array identity, length and hash), so a partial write before
// an exception must match too. Operations: every vc/rh/vh instance member (draw, opaque, alpha, h-flip, scaled, scaled alpha,
// the three rotations, the two masked rotations, the line-masked draw, the centred rotation vc.a(IIZII)V, argb
// export, bind, trim, padded trim, outline, shadow, flips, rgb adjust, both rh constructors and the vh one) and
// every private static blitter called directly, on rh and vh sprites with cropped and odd geometry, short and
// null pixel arrays, clips inside and outside the buffer, drawing into the sprite itself after bind, and
// coordinates near the int limits.
//
// Real sprites: the compass, mapdots, mapfunction, hitmarks, cross, scrollbar, headicon, hint, name-icon,
// floorshadow, hitbar, multiway, rune and logo groups of cache archive 8, plus the alpha groups, decoded on each
// side by its own decoder (ja.a + ed.a or pk.b, and fa.a = SpriteLoader.loadSoftwareSprite) from the same JS5
// containers. Sweeps run every masked-rotation angle -3..2051 on the compass in the call shape of ke.a (anchor at
// the sprite centre, zoom 256, angle = camera yaw), every alpha -2..258, the rh.a(IIIIII)V angle circle and the
// milliradian range of rh.a(IIIIIIDI)V. The test also checks that the integers the port derives from
// Math.sin/Math.cos equal the JVM's on every angle those methods can see: the doubles differ from HotSpot's
// intrinsics in the last bit for about 3% of them, but the converted values never do. A Pix2D clip mask
// (td.a([I[I)V) is set and cleared in between: the sprite draws ignore it.
//
// fa.a is SpriteLoader.loadSoftwareSprite (moved out of Pix32 so no sprite class imports SpriteLoader).

const MIN = -2147483648;
const MAX = 2147483647;
const RANDOM_OPS = 48000;
const RANDOM_SEEDS = [0x1234567, 0x7654321, 0x2468ace, 0x13579bd];

// Archive 8 groups. The named ones are resolved through the archive's name hashes; the numbered ones are every
// group whose first frame has a non-0xff alpha plane (pk.b makes a vh of those). MISSING_GROUP is in the index but
// its container is not served, so the loaders return false/null on both sides.
const NAMED_GROUPS = [
    'compass',
    'mapdots',
    'mapfunction',
    'hitmarks',
    'cross',
    'scrollbar',
    'headicons_pk',
    'headicons_prayer',
    'hint_headicons',
    'hint_mapmarkers',
    'mapflag',
    'hint_mapedge',
    'name_icons',
    'floorshadows',
    'hitbar_default',
    'overlay_multiway',
    'runes',
    'logo'
];
const ALPHA_GROUPS = [641, 642, 802, 881, 1403, 1699];
const MISSING_GROUP = 5;

function runOracle(script: string): string[] {
    const source = fileURLToPath(new URL('./sprite/SpriteOracle.java', import.meta.url));
    const dir = mkdtempSync(join(tmpdir(), 'sprite-oracle-'));
    try {
        const javac = spawnSync('javac', ['-nowarn', '-cp', gamepackPath, '-d', dir, source], { timeout: 60000, encoding: 'utf8' });
        if (javac.status !== 0) throw new Error(`javac failed: ${javac.stderr}`);
        const java = spawnSync('java', ['-Djava.awt.headless=true', '-cp', gamepackPath + delimiter + dir, 'SpriteOracle'], {
            input: script,
            timeout: 240000,
            encoding: 'utf8',
            maxBuffer: 256 * 1024 * 1024
        });
        if (java.status !== 0) throw new Error(`oracle failed (${java.status} ${java.signal}): ${java.stderr}`);
        return java.stdout
            .split('\n')
            .map(line => line.trimEnd())
            .filter(line => line.length > 0);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

function hash(values: ArrayLike<number>): number {
    let h = 1;
    for (let i = 0; i < values.length; i++) h = (Math.imul(h, 31) + values[i]) | 0;
    return h;
}

function pattern(i: number, seed: number): number {
    return Math.imul(i, 0x2545f491) ^ Math.imul(seed, 0x27d4eb2f);
}

// Mirrors SpriteOracle.spritePixels.
function spritePixels(length: number, seed: number, mode: number): Int32Array | null {
    if (length < 0) return null;
    const a = new Int32Array(length);
    for (let i = 0; i < length; i++) {
        let v = pattern(i, seed);
        if ((v & 0x700) === 0) {
            v = 0;
        } else if (mode === 1) {
            const k = v & 0x3000;
            if (k === 0) v &= 0xffffff;
            else if (k === 0x1000) v |= 0xff000000;
        }
        a[i] = v;
    }
    return a;
}

// Mirrors SpriteOracle.table.
function table(length: number, seed: number, lo: number, range: number): Int32Array | null {
    if (length < 0) return null;
    const a = new Int32Array(length);
    for (let i = 0; i < length; i++) a[i] = (lo + ((pattern(i, seed) >>> 8) % range)) | 0;
    return a;
}

let buf: Int32Array | null = null;
let sprite: Pix32 | null = null;
let created: Int32Array | null = null;
let index8: Uint8Array | null = null;
const groups8 = new Map<number, Uint8Array>();
let archive: Js5 | null = null;

// The JS5 provider behind the archive: it serves the index and group containers the script supplied, like the
// oracle's ud subclass.
class Provider extends Js5ResourceProvider {
    index(): Js5Index | null {
        return index8 === null ? null : new Js5Index(index8, Crc32.prefix(index8, index8.length));
    }

    group(_mode: number, group: number): Uint8Array | null {
        return groups8.get(group) ?? null;
    }

    prefetchGroup(_group: number): void {}

    GetGroupLoadPercentage(_group: number): number {
        return 100;
    }
}

// Mirrors SpriteOracle.trig (Java's saturating (int) cast of a double is doubleToInt).
const SCALES = [1, 2, 3, 7, 16, 100, 255, 256, 1000, 2048, 4095, 4096, 4097, 8192, 9000, 16384, 65536, 1 << 20, 1 << 24, -1, -4096, MAX, MIN];

function trig(kind: number): number {
    let h = 1;
    const count = kind === 0 ? 65536 : kind === 1 ? 4200 : 20001;
    for (let i = 0; i < count; i++) {
        if (kind === 0) {
            const x = i * 9.587379924285257e-5;
            for (const scale of SCALES) {
                h = (Math.imul(h, 31) + doubleToInt(Math.floor(Math.sin(x) * scale + 0.5))) | 0;
                h = (Math.imul(h, 31) + doubleToInt(Math.floor(Math.cos(x) * scale + 0.5))) | 0;
            }
        } else {
            const x = kind === 1 ? (i - 50) / 326.11 : (i - 10000) / 1000.0;
            h = (Math.imul(h, 31) + doubleToInt(Math.sin(x) * 65536.0)) | 0;
            h = (Math.imul(h, 31) + doubleToInt(Math.cos(x) * 65536.0)) | 0;
        }
    }
    return h;
}

// fa.a(ILal;II)Lrh;
function fromArchive(group: number, file: number): Pix32 | null {
    return SpriteLoader.loadSoftwareSprite(archive, group, file);
}

type StaticBlitter = (...args: unknown[]) => void;
const rhStatics = Pix32 as unknown as Record<string, StaticBlitter>;
const vhStatics = SoftwareAlphaSprite as unknown as Record<string, StaticBlitter>;
const statics: [StaticBlitter, number][] = [
    [rhStatics.plotQuick, 6],
    [rhStatics.plot, 7],
    [rhStatics.tranSprite, 8],
    [rhStatics.plotScaled, 10],
    [rhStatics.plotScaledAlpha, 11],
    [rhStatics.plotMirrored, 7],
    [vhStatics.tranSprite, 8],
    [vhStatics.plotScaled, 10],
    [vhStatics.tranSpriteScaled, 11],
    [vhStatics.plotHflip, 7],
    [vhStatics.plot, 7]
];

function arrayState(a: Int32Array | null): string {
    if (a === null) return 'null';
    const who = a === buf ? 'buf:' : a === created ? 'spr:' : sprite !== null && a === sprite.pixels ? 'cur:' : 'other:';
    return `${who}${a.length}:${hash(a)}`;
}

function classify(e: unknown): string {
    if (e instanceof RangeError) {
        if (e.message.startsWith('/ by zero')) return 'arith';
        if (e.message.startsWith('array index')) return 'aioobe';
        if (/negative|Invalid typed array length/.test(e.message)) return 'nase';
    }
    if (e instanceof TypeError && (e.message === 'Null reference' || e.message === 'Null array')) return 'npe';
    if (e instanceof Error && e.message === 'IllegalStateException') return 'ise';
    if (e instanceof Error && e.message === 'IllegalArgumentException') return 'iae';
    throw e;
}

function current(): Pix32 {
    if (sprite === null) throw new TypeError('Null reference');
    return sprite;
}

function execute(index: number, line: string): string {
    const f = line.split(' ');
    const op = f[0];
    const data = op === 'idx' || op === 'grp';
    const n = f.map((v, i) => (i === 0 || data ? 0 : parseInt(v, 10)));
    let extra = '';
    let result = 'ok';
    try {
        switch (op) {
            case 'idx':
                index8 = new Uint8Array(Buffer.from(f[1], 'base64'));
                break;
            case 'grp':
                groups8.set(parseInt(f[1], 10), new Uint8Array(Buffer.from(f[2], 'base64')));
                break;
            case 'arch':
                archive = new Js5(new Provider(), false, true);
                break;
            case 'cache': {
                created = null;
                sprite = null;
                if (n[1] === 2) {
                    sprite = fromArchive(n[2], n[3]);
                    extra = ` ${sprite !== null}`;
                } else {
                    const loaded = SpriteLoader.load(n[3], n[2], archive);
                    extra = ` ${loaded}`;
                    if (loaded) {
                        if (n[1] === 0) {
                            const all = SpriteLoader.toSoftwareSprites();
                            sprite = all[n[4] % all.length];
                            extra += ` ${all.length}`;
                        } else {
                            sprite = SpriteLoader.toSprite();
                        }
                    }
                }
                created = sprite === null ? null : sprite.pixels;
                break;
            }
            case 'trig':
                extra = ` ${trig(n[1])}`;
                break;
            case 'clipmask':
                Pix2D.setClipMask(table(n[1], n[2], n[3], n[4]), table(n[5], n[6], n[7], n[8]));
                break;
            case 'noclipmask':
                Pix2D.clearClipMask();
                break;
            case 'fb': {
                buf = n[1] < 0 ? null : new Int32Array(n[1]);
                if (buf !== null) for (let i = 0; i < buf.length; i++) buf[i] = pattern(i, n[4]);
                Pix2D.setPixels(buf, n[2], n[3]);
                break;
            }
            case 'fill':
                if (buf !== null) for (let i = 0; i < buf.length; i++) buf[i] = pattern(i, n[1]);
                break;
            case 'setclip':
                Pix2D.setClipping(n[1], n[2], n[3], n[4]);
                break;
            case 'rawclip':
                Pix2D.clipMinX = n[1];
                Pix2D.clipMinY = n[2];
                Pix2D.clipMaxX = n[3];
                Pix2D.clipMaxY = n[4];
                break;
            case 'target':
                Pix2D.setPixels(buf, n[1], n[2]);
                break;
            case 'new':
                created = spritePixels(n[8], n[9], n[1]);
                sprite = n[1] === 0 ? new Pix32(n[2], n[3], n[4], n[5], n[6], n[7], created) : new SoftwareAlphaSprite(n[2], n[3], n[4], n[5], n[6], n[7], created);
                break;
            case 'newwh': {
                created = null;
                sprite = null;
                sprite = new Pix32(n[1], n[2]);
                created = sprite.pixels;
                const p = spritePixels(created === null ? 0 : created.length, n[3], 0);
                if (created !== null && p !== null) created.set(p);
                break;
            }
            case 'draw':
                current().draw(n[1], n[2]);
                break;
            case 'opaque':
                current().drawOpaque(n[1], n[2]);
                break;
            case 'alpha':
                current().drawAlpha(n[1], n[2], n[3]);
                break;
            case 'hfd':
                current().drawHFlip(n[1], n[2]);
                break;
            case 'scaled':
                current().drawScaled(n[1], n[2], n[3], n[4]);
                break;
            case 'scaleda':
                current().drawScaledAlpha(n[1], n[2], n[3], n[4], n[5]);
                break;
            case 'rot':
                current().drawRotated(n[1], n[2], n[3], n[4], n[5], n[6]);
                break;
            case 'rotc':
                current().drawRotatedCentred(n[1], n[2], n[3], n[4]);
                break;
            case 'rotd':
                current().drawRotatedRadians(n[1], n[2], n[3], n[4], n[5], n[6], n[7] / 1000.0, n[8]);
                break;
            case 'rotm':
            case 'rotmo': {
                const starts = table(n[9], n[10], n[11], n[12]);
                const widths = table(n[13], n[14], n[15], n[16]);
                if (op === 'rotm') current().drawRotatedMasked(n[1], n[2], n[3], n[4], n[5], n[6], n[7], n[8], starts, widths);
                else current().drawRotatedMaskedOpaque(n[1], n[2], n[3], n[4], n[5], n[6], n[7], n[8], starts, widths);
                break;
            }
            case 'masked': {
                const starts = table(n[3], n[4], n[5], n[6]);
                const widths = table(n[7], n[8], n[9], n[10]);
                current().drawMasked(n[1], n[2], starts, widths);
                break;
            }
            case 'argb': {
                const a = current().toArgb();
                extra = ` ${a.length}:${hash(a)}`;
                break;
            }
            case 'bind':
                current().bind();
                break;
            case 'trim':
                current().trim();
                break;
            case 'trimp':
                current().trimPadded(n[1]);
                break;
            case 'outline':
                current().outline(n[1]);
                break;
            case 'shadow':
                current().shadow(n[1]);
                break;
            case 'vflip':
                current().vflip();
                break;
            case 'hflip':
                current().hflip();
                break;
            case 'rgb':
                current().rgbAdjust(n[1], n[2], n[3]);
                break;
            case 'static': {
                const [blit, ints] = statics[n[1]];
                blit(buf, sprite === null ? null : sprite.pixels, ...n.slice(2, 2 + ints));
                break;
            }
            default:
                throw new Error(`unknown op ${op}`);
        }
    } catch (e) {
        result = classify(e);
    }
    const s = sprite;
    const kind = s instanceof SoftwareAlphaSprite ? 'vh' : 'rh';
    const spriteState = s === null ? 'nosprite' : `${kind} ${s.cropW} ${s.cropH} ${s.xOffset} ${s.yOffset} ${s.width} ${s.height} ${arrayState(s.pixels)}`;
    const mask = (a: Int32Array | null) => (a === null ? 'null' : `${a.length}:${hash(a)}`);
    return (
        `${index} ${op} ${result} ${Pix2D.width} ${Pix2D.height} ${arrayState(Pix2D.pixels)} ` + `${Pix2D.clipMinX} ${Pix2D.clipMinY} ${Pix2D.clipMaxX} ${Pix2D.clipMaxY} ${mask(Pix2D.maskOffsets)} ${mask(Pix2D.maskLengths)} ${spriteState}${extra}`
    );
}

// ---- seeded script generation ----

class Rng {
    constructor(private state: number) {}

    next(): number {
        let s = this.state;
        s ^= s << 13;
        s ^= s >>> 17;
        s ^= s << 5;
        this.state = s | 0;
        return this.state;
    }

    int(lo: number, hi: number): number {
        return lo + Math.floor(((this.next() >>> 0) / 4294967296) * (hi - lo + 1));
    }

    pick<T>(values: readonly T[]): T {
        return values[this.int(0, values.length - 1)];
    }
}

const EXTREME = [MIN, MAX, MIN + 1, MAX - 1, 1 << 30, -(1 << 30), 65536, -65536, 0x7fff, -0x8000];
const ALPHAS = [0, 1, 127, 128, 255, 256, -1, 257, 512, -256];
const COLOURS = [0, 0xffffff, 0xff000000 | 0, -1, 0x00ff00ff, 0x80808080 | 0, 0x7fffffff, 0x01010101];

const FRAMEBUFFERS: [number, number][] = [
    [97, 61],
    [40, 30],
    [64, 64],
    [160, 120]
];

type CacheGroup = { name: string; group: number; frames: number };
let cacheGroups: CacheGroup[] = [];

function coord(r: Rng, dim: number): number {
    const k = r.int(0, 99);
    if (k < 60) return r.int(-20, dim + 10);
    if (k < 80) return r.int(-60, dim + 60);
    if (k < 95) return r.pick([0, -1, 1, dim - 1, dim, dim + 1, -dim, 2 * dim]);
    return r.pick(EXTREME);
}

function newSprite(r: Rng): string {
    if (cacheGroups.length > 0 && r.int(0, 99) < 30) {
        const g = r.pick(cacheGroups);
        const mode = r.int(0, 2);
        const file = r.int(0, 99) < 95 ? 0 : 1;
        return mode === 2 ? `cache 2 ${g.group} ${file}` : `cache ${mode} ${g.group} ${file} ${r.int(0, 300)}`;
    }
    const kind = r.int(0, 1);
    const k = r.int(0, 99);
    let cropW = r.int(1, 40);
    let cropH = r.int(1, 40);
    let width = r.int(1, cropW);
    let height = r.int(1, cropH);
    let xOffset = r.int(0, cropW - width);
    let yOffset = r.int(0, cropH - height);
    if (k < 10) {
        width = cropW;
        height = cropH;
        xOffset = 0;
        yOffset = 0;
    } else if (k < 18) {
        xOffset = r.int(-10, cropW + 10);
        yOffset = r.int(-10, cropH + 10);
    } else if (k < 22) {
        cropW = r.int(-5, 3);
        cropH = r.int(-5, 3);
    } else if (k < 25) {
        width = r.int(-3, 0);
    }
    let length = Math.max(0, width) * Math.max(0, height);
    const l = r.int(0, 99);
    if (l < 4) length = -1;
    else if (l < 10) length = Math.max(0, length - r.int(1, 5));
    return `new ${kind} ${cropW} ${cropH} ${xOffset} ${yOffset} ${width} ${height} ${length} ${r.int(MIN, MAX)}`;
}

function framebuffer(r: Rng): string {
    const [w, h] = r.pick(FRAMEBUFFERS);
    const k = r.int(0, 99);
    const length = k < 5 ? w * h - r.int(1, w * 3) : w * h;
    return `fb ${length} ${w} ${h} ${r.int(MIN, MAX)}`;
}

function clip(r: Rng): string {
    const w = Pix2D.width;
    const h = Pix2D.height;
    const k = r.int(0, 99);
    if (k < 70) {
        const x0 = r.int(-5, w);
        const y0 = r.int(-5, h);
        return `setclip ${x0} ${y0} ${r.int(x0, w + 5)} ${r.int(y0, h + 5)}`;
    }
    if (k < 85) return `setclip 0 0 ${w} ${h}`;
    // Clip bounds past the buffer: the blitters then index out of range (AIOOBE on both sides).
    return `rawclip ${r.int(-8, 4)} ${r.int(-8, 4)} ${r.int(w - 4, w + 8)} ${r.int(h - 4, h + 8)}`;
}

function scaleSize(r: Rng, dim: number): number {
    const k = r.int(0, 99);
    if (k < 80) return r.int(1, dim * 2);
    if (k < 95) return r.pick([0, -1, 1, 2, dim, dim + 1]);
    return r.int(-50, 0);
}

function rotationScale(r: Rng): number {
    const k = r.int(0, 99);
    if (k < 40) return 4096;
    if (k < 75) return r.int(-8192, 16384);
    if (k < 90) return r.pick([0, 1, -1, 2, 7, 4095, 4097, 65536, -4096]);
    return r.pick([MAX, MIN, 1 << 24, -(1 << 24)]);
}

function angle(r: Rng): number {
    const k = r.int(0, 99);
    if (k < 60) return r.int(0, 65535);
    if (k < 80) return r.pick([0, 16384, 32768, 49152, 65535, 65536, 8192, 24576, 1, -1]);
    return r.int(MIN, MAX);
}

function randomOp(r: Rng): string {
    const w = Pix2D.width;
    const h = Pix2D.height;
    const s = sprite;
    const sw = s === null ? 10 : Math.max(1, Math.min(64, Math.abs(s.cropW)));
    const sh = s === null ? 10 : Math.max(1, Math.min(64, Math.abs(s.cropH)));
    const k = r.int(0, 999);
    if (k < 15) return framebuffer(r);
    if (k < 25) return `fill ${r.int(MIN, MAX)}`;
    if (k < 70) return clip(r);
    if (k < 120) return newSprite(r);
    if (k < 125) return `newwh ${r.int(-2, 40)} ${r.int(-2, 40)} ${r.int(MIN, MAX)}`;
    if (k < 210) return `draw ${coord(r, w)} ${coord(r, h)}`;
    if (k < 260) return `opaque ${coord(r, w)} ${coord(r, h)}`;
    if (k < 320) return `alpha ${coord(r, w)} ${coord(r, h)} ${r.pick(ALPHAS)}`;
    if (k < 360) return `hfd ${coord(r, w)} ${coord(r, h)}`;
    if (k < 420) return `scaled ${r.int(-40, w + 20)} ${r.int(-40, h + 20)} ${scaleSize(r, sw)} ${scaleSize(r, sh)}`;
    if (k < 460) return `scaleda ${r.int(-40, w + 20)} ${r.int(-40, h + 20)} ${scaleSize(r, sw)} ${scaleSize(r, sh)} ${r.pick(ALPHAS)}`;
    if (k < 560) {
        const t = r.int(0, 99);
        const ax = t < 60 ? r.int(0, 16 * sw) : t < 85 ? r.int(-16 * sw, 32 * sw) : r.int(-100000, 100000);
        const ay = t < 60 ? r.int(0, 16 * sh) : t < 85 ? r.int(-16 * sh, 32 * sh) : r.int(-100000, 100000);
        const x = t < 60 ? r.int(0, 16 * w) : t < 95 ? r.int(-16 * 40, 16 * (w + 40)) : r.pick(EXTREME);
        const y = t < 60 ? r.int(0, 16 * h) : t < 95 ? r.int(-16 * 40, 16 * (h + 40)) : r.pick(EXTREME);
        return `rot ${ax} ${ay} ${x} ${y} ${angle(r)} ${rotationScale(r)}`;
    }
    if (k < 600) return `rotc ${angle(r)} ${coord(r, h)} ${coord(r, w)} ${rotationScale(r)}`;
    if (k < 650) {
        const dw = r.int(-3, 100);
        const dh = r.int(-3, 100);
        const angleMilli = r.int(0, 99) < 85 ? r.int(-7000, 7000) : r.int(MIN, MAX);
        return `rotd ${r.int(-30, w)} ${r.int(-30, h)} ${dw} ${dh} ${r.int(-10, 2 * sw)} ${r.int(-10, 2 * sh)} ${angleMilli} ${r.int(-300, 1024)}`;
    }
    if (k < 720) {
        const dw = r.int(-3, 80);
        const dh = r.int(-3, 80);
        const t = r.int(0, 99);
        const rows = t < 5 ? -1 : t < 15 ? Math.max(0, dh + r.int(-3, 2)) : Math.max(0, dh);
        const op = r.int(0, 1) === 0 ? 'rotm' : 'rotmo';
        const theta = r.int(0, 99) < 85 ? r.int(0, 2048) : r.int(MIN, MAX);
        return (
            `${op} ${r.int(-30, w)} ${r.int(-30, h)} ${dw} ${dh} ${r.int(-10, 2 * sw)} ${r.int(-10, 2 * sh)} ${theta} ${r.int(-300, 1024)} ` +
            `${rows} ${r.int(MIN, MAX)} ${r.int(-4, 3)} ${Math.max(1, dw + 6)} ${t < 8 ? -1 : rows} ${r.int(MIN, MAX)} ${r.int(-3, 2)} ${Math.max(1, dw + 6)}`
        );
    }
    if (k < 780) {
        const span = (Pix2D.clipMaxY - Pix2D.clipMinY) | 0;
        const t = r.int(0, 99);
        const rows = t < 4 ? -1 : t < 10 ? Math.max(0, span + r.int(-2, 2)) : Math.max(0, span);
        const lens = t < 7 ? -1 : t < 14 ? Math.max(0, rows - r.int(0, 3)) : rows;
        const cw = Math.max(1, Pix2D.clipMaxX - Pix2D.clipMinX);
        return `masked ${coord(r, w)} ${coord(r, h)} ${rows} ${r.int(MIN, MAX)} ${r.int(-5, 3)} ${cw + 8} ${lens} ${r.int(MIN, MAX)} ${r.int(-4, 2)} ${cw + 8}`;
    }
    if (k < 800) return 'argb';
    if (k < 808) return 'bind';
    if (k < 820) return `target ${w} ${h}`;
    if (k < 835) return 'trim';
    if (k < 850) {
        const padding = r.int(0, 99) < 80 ? r.int(-3, 12) : r.pick(EXTREME);
        return trimAllocation(padding) > MAX_ALLOCATION ? 'trimp 1' : `trimp ${padding}`;
    }
    if (k < 862) return `outline ${r.pick(COLOURS)}`;
    if (k < 874) return `shadow ${r.pick(COLOURS)}`;
    if (k < 884) return 'vflip';
    if (k < 894) return 'hflip';
    if (k < 905) return `rgb ${r.int(-300, 300)} ${r.int(-300, 300)} ${r.int(-300, 300)}`;
    if (k < 912) {
        const span = (Pix2D.clipMaxY - Pix2D.clipMinY) | 0;
        const rows = r.int(0, 99) < 85 ? Math.max(0, span) : Math.max(0, span + r.int(-1, 1));
        return `clipmask ${rows} ${r.int(MIN, MAX)} 0 ${Math.max(1, Pix2D.width)} ${rows} ${r.int(MIN, MAX)} 0 ${Math.max(1, Pix2D.width)}`;
    }
    if (k < 916) return 'noclipmask';
    return randomStatic(r);
}

// Allocation guard: rh.c(I)V allocates (width + left + right) * (height + top + bottom) ints, and padding near the
// int limit overflows the right/bottom clamps into sizes of gigabytes. Java then throws OutOfMemoryError (an Error,
// outside the exception model both sides compare) or not, depending on the heap, so those paddings are not sent.
// Negative products still go through (NegativeArraySizeException on both sides).
const MAX_ALLOCATION = 1 << 22;

function trimAllocation(padding: number): number {
    const s = sprite;
    if (s === null || (s.width === s.cropW && s.height === s.cropH)) return 0;
    const left = padding > s.xOffset ? s.xOffset : padding;
    const right = ((padding + s.xOffset + s.width) | 0) > s.cropW ? (s.cropW - s.xOffset - s.width) | 0 : padding;
    const top = padding > s.yOffset ? s.yOffset : padding;
    const bottom = ((padding + s.yOffset + s.height) | 0) > s.cropH ? (s.cropH - s.yOffset - s.height) | 0 : padding;
    return Math.imul((s.width + left + right) | 0, (s.height + top + bottom) | 0);
}

function randomStatic(r: Rng): string {
    const which = r.int(0, statics.length - 1);
    const ints = statics[which][1];
    const bufLength = buf === null ? 0 : buf.length;
    const src = sprite === null ? null : sprite.pixels;
    const srcLength = src === null ? 0 : src.length;
    const args: number[] = [];
    if (ints === 6) {
        // plotQuick(srcPos, dstPos, width, height, dstStep, srcStep)
        args.push(r.int(-2, srcLength + 2), r.int(-2, bufLength + 2), r.int(-2, 20), r.int(-2, 12), r.int(-3, 60), r.int(-3, 20));
    } else if (ints === 7 || ints === 8) {
        // (colour, srcPos, dstPos, width, height, dstStep, srcStep[, alpha])
        const mirrored = which === 5 || which === 9;
        args.push(r.int(MIN, MAX), mirrored ? r.int(-2, srcLength + 2) : r.int(-2, srcLength + 2), r.int(-2, bufLength + 2), r.int(-2, 20), r.int(-2, 12), r.int(-3, 60), mirrored ? r.int(0, 40) : r.int(-3, 20));
        if (ints === 8) args.push(r.pick(ALPHAS));
    } else {
        // (colour, srcX, srcY, dstPos, dstStep, width, height, stepX, stepY, srcWidth[, alpha])
        args.push(r.int(MIN, MAX), r.int(-65536, 20 << 16), r.int(-65536, 20 << 16), r.int(-2, bufLength + 2), r.int(-3, 60), r.int(-2, 20), r.int(-2, 12));
        args.push(r.int(-32768, 3 << 16), r.int(-32768, 3 << 16), r.int(-2, 30));
        if (ints === 11) args.push(r.pick(ALPHAS));
    }
    return `static ${which} ${args.join(' ')}`;
}

function directedCases(): string[] {
    const lines: string[] = [];
    lines.push('fb 5917 97 61 12345');
    // Plain rh and vh sprites, cropped, at the clip edges and beyond.
    for (const kind of [0, 1]) {
        lines.push(`new ${kind} 20 16 3 2 13 11 143 ${kind * 7 + 1}`);
        for (const [x, y] of [
            [0, 0],
            [-3, -2],
            [-20, -16],
            [90, 55],
            [97, 61],
            [-5, 50],
            [40, -10],
            [MIN, 0],
            [0, MIN],
            [MAX, 0],
            [0, MAX],
            [MAX - 5, MAX - 5]
        ]) {
            lines.push(`draw ${x} ${y}`, `opaque ${x} ${y}`, `alpha ${x} ${y} 128`, `hfd ${x} ${y}`);
            lines.push(`scaled ${x} ${y} 40 32`, `scaleda ${x} ${y} 7 9 200`);
        }
        lines.push('setclip 10 8 60 40');
        for (const [x, y] of [
            [5, 5],
            [55, 35],
            [8, 30],
            [30, 6]
        ]) {
            lines.push(`draw ${x} ${y}`, `opaque ${x} ${y}`, `alpha ${x} ${y} 77`, `hfd ${x} ${y}`, `scaled ${x} ${y} 33 21`, `scaleda ${x} ${y} 33 21 99`);
        }
        // Rotations through every octant and the axis-aligned cases (zero sin or cos steps).
        for (const a of [0, 1, 8192, 16384, 24576, 32768, 40960, 49152, 57344, 65535, 3000, 20000, 37000, 60000]) {
            lines.push(`rot 160 128 480 320 ${a} 4096`, `rot 0 0 400 300 ${a} 2048`, `rot 320 256 200 200 ${a} 9000`);
            lines.push(`rotc ${a} 30 40 4096`);
        }
        lines.push('rot 160 128 480 320 0 0', `rot 160 128 480 320 5 ${MAX}`, `rot 160 128 480 320 5 ${MIN}`, 'rot 160 128 480 320 5 1');
        lines.push('setclip 0 0 97 61');
        lines.push('rotd 10 10 30 25 6 5 785 256', 'rotd 50 30 40 40 10 8 -2000 300', 'rotd -20 -20 60 60 0 0 3141 128');
        lines.push('rotm 10 10 30 25 6 5 512 256 25 99 0 30 25 77 0 30', 'rotmo 10 10 30 25 6 5 512 256 25 99 0 30 25 77 0 30');
        lines.push('masked 10 10 61 5 0 20 61 6 0 30', 'masked -5 -5 61 5 -3 40 61 6 -2 40', 'masked 10 10 60 5 0 20 61 6 0 30');
        lines.push('argb', 'trimp 2', 'argb', 'trim', 'argb', 'outline 16711680', 'shadow 255', 'vflip', 'hflip', 'rgb 40 -40 300');
        lines.push('draw 20 20', 'bind', 'draw 0 0', 'alpha 1 1 128', 'rot 160 128 100 100 9000 4096', 'target 97 61');
    }
    // Rotations about each corner of the cropped image at large magnification (small integer steps) put the
    // image edges through the middle of the clip, so every octant branch meets its exact end-of-row bounds.
    lines.push('fb 5917 97 61 999', 'setclip 0 0 97 61');
    for (const kind of [0, 1]) {
        lines.push(`new ${kind} 9 7 1 1 6 5 30 ${kind + 50}`);
        for (const a of [0, 4096, 8192, 12288, 16384, 20480, 24576, 28672, 32768, 36864, 40960, 45056, 49152, 53248, 57344, 61440, 5461, 27306, 38229, 60074]) {
            for (const scale of [1 << 24, 1 << 23, 1 << 22, 1 << 20, 65536, 16384, 4096]) {
                for (const [ax, ay] of [
                    [16, 16],
                    [112, 16],
                    [16, 96],
                    [112, 96]
                ]) {
                    lines.push(`rot ${ax} ${ay} ${16 * 48} ${16 * 30} ${a} ${scale}`);
                }
            }
        }
    }
    lines.push('newwh 12 9 4242', 'draw 3 3', 'newwh 0 5 1', 'draw 3 3', 'newwh -1 5 1', 'draw 3 3', 'newwh 46341 46341 1');
    lines.push('new 0 10 10 0 0 10 10 -1 5', 'draw 0 0', 'opaque 0 0', 'argb', 'trim');
    lines.push('new 1 10 10 0 0 10 10 50 5', 'draw 0 0', 'opaque 0 0', 'scaled 0 0 20 20', 'rotd 0 0 20 20 5 5 1000 256');
    lines.push('fb -1 10 10 0', 'new 0 10 10 0 0 10 10 100 5', 'draw 0 0', 'rotd 0 0 20 20 5 5 1000 256', 'rotm 0 0 5 5 1 1 0 256 5 1 0 5 5 1 0 5');
    return lines;
}

// The JS5 container without the two-byte version trailer that the sector files keep after it.
function container(raw: Uint8Array): Uint8Array {
    const length = ((raw[1] << 24) | (raw[2] << 16) | (raw[3] << 8) | raw[4]) >>> 0;
    return raw.subarray(0, (raw[0] === 0 ? 5 : 9) + length);
}

// The archive 8 index and the containers of the groups above, as script lines, and the resolved group list (with
// frame counts read through a separate archive, so the scripted one starts cold on both sides).
function cacheSetup(): string[] {
    const lines: string[] = [];
    const index = container(readGroup(cachePath, 255, 8));
    lines.push(`idx ${Buffer.from(index).toString('base64')}`);
    const resolver = new Js5(
        new (class extends Js5ResourceProvider {
            index(): Js5Index | null {
                return new Js5Index(index, Crc32.prefix(index, index.length));
            }
            group(_mode: number, group: number): Uint8Array | null {
                return container(readGroup(cachePath, 8, group));
            }
            prefetchGroup(_group: number): void {}
            GetGroupLoadPercentage(_group: number): number {
                return 100;
            }
        })(),
        false,
        true
    );
    const groups: CacheGroup[] = [];
    for (const name of NAMED_GROUPS) groups.push({ name, group: resolver.GetGroupId(fromJsString(name)), frames: 0 });
    for (const group of ALPHA_GROUPS) groups.push({ name: `alpha${group}`, group, frames: 0 });
    for (const g of groups) {
        if (g.group < 0) throw new Error(`archive 8 has no group ${g.name}`);
        if (!SpriteLoader.load(0, g.group, resolver)) throw new Error(`archive 8 group ${g.name} did not load`);
        g.frames = SpriteLoader.toSoftwareSprites().length;
        lines.push(`grp ${g.group} ${Buffer.from(container(readGroup(cachePath, 8, g.group))).toString('base64')}`);
    }
    lines.push('arch');
    cacheGroups = groups;
    return lines;
}

function group(name: string): CacheGroup {
    const g = cacheGroups.find(c => c.name === name);
    if (g === undefined) throw new Error(`no cache group ${name}`);
    return g;
}

// Every real sprite through every draw, at positions inside, across and outside the clip, then every transform.
function cacheCases(): string[] {
    const lines: string[] = [];
    const W = 160;
    const H = 120;
    lines.push(`fb ${W * H} ${W} ${H} 4321`, `setclip 0 0 ${W} ${H}`, 'trig 0', 'trig 1', 'trig 2');
    const positions = [
        [5, 5],
        [-7, -3],
        [150, 110],
        [70, 50],
        [-30, 100],
        [W, H],
        [-60, -60]
    ];
    const draws = (cw: number, ch: number): string[] => {
        const out: string[] = [];
        for (const [x, y] of positions) {
            out.push(`draw ${x} ${y}`, `opaque ${x} ${y}`, `alpha ${x} ${y} 128`, `hfd ${x} ${y}`);
            out.push(`scaled ${x} ${y} ${2 * cw + 1} ${ch + (ch >> 1)}`, `scaled ${x} ${y} ${(cw >> 1) + 1} ${(ch >> 2) + 1}`, `scaleda ${x} ${y} ${cw + 3} ${2 * ch - 1} 77`);
        }
        out.push(`rot ${cw << 3} ${ch << 3} ${16 * 80} ${16 * 60} 12345 4096`, `rot 0 0 ${16 * 20} ${16 * 100} 40000 7000`, 'rotc 23456 60 80 3000');
        out.push(`rotd 40 30 ${cw + 10} ${ch + 10} ${cw >> 1} ${ch >> 1} 1234 256`, `rotd 100 70 40 40 ${cw} 0 -3000 400`);
        out.push(`rotm 20 20 33 33 ${cw >> 1} ${ch >> 1} 700 256 33 11 0 6 33 12 20 14`, `rotmo 90 60 33 33 ${cw >> 1} ${ch >> 1} 1500 300 33 13 0 6 33 14 20 14`);
        out.push(`masked 10 10 ${H} 15 0 30 ${H} 16 0 40`, `masked -20 50 ${H} 17 -5 30 ${H} 18 0 60`);
        return out;
    };
    for (const g of cacheGroups) {
        const frames = g.frames <= 12 ? [...Array(g.frames).keys()] : [0, 1, 2, 17, 50, g.frames - 1];
        for (const frame of frames) {
            lines.push(`fill ${g.group * 31 + frame}`, `cache 0 ${g.group} 0 ${frame}`);
            const [cw, ch] = PROBE.get(`${g.group}:${frame}`) ?? [16, 16];
            lines.push(...draws(cw, ch));
        }
        // pk.b (vh when the frame has alpha) and fa.a, then every transform on the decoded sprite.
        lines.push(`cache 1 ${g.group} 0`, 'draw 3 3', 'alpha 40 40 200', 'scaleda 60 10 50 50 100', 'rotm 20 20 33 33 8 8 333 256 33 1 0 6 33 2 20 14');
        lines.push(`cache 2 ${g.group} 0`, 'draw 10 70', 'argb', 'trimp 1', 'argb', 'trim', 'argb', 'outline 16711680', 'shadow 0', 'vflip', 'hflip', 'rgb 20 -30 50', 'draw 40 40', 'bind', 'draw 0 0', `target ${W} ${H}`);
        lines.push(`cache 1 ${g.group} 0`, 'trimp 3', 'outline 65280', 'shadow 255', 'rgb -300 0 300', 'opaque 0 0', 'argb');
    }
    // Loader misses: a group the index lists but nobody serves, and file 1 of a one-file group.
    lines.push(`cache 0 ${MISSING_GROUP} 0 0`, `cache 1 ${MISSING_GROUP} 0`, `cache 2 ${MISSING_GROUP} 0`, `cache 2 ${group('compass').group} 1`, `cache 0 ${group('compass').group} 1 0`);

    // The compass as ke.a draws it (rh.a(IIIIIIII[I[I)V with anchor = sprite centre, zoom 256, angle = camera yaw
    // df.B, and the component's line masks; a 33x33 window here): every angle 0..2048 and a few past it, then the
    // opaque variant with varying zoom, then an alpha sprite (vh overrides both).
    const compass = group('compass').group;
    lines.push('fill 77', `cache 0 ${compass} 0 0`);
    for (let a = -3; a <= 2051; a++) lines.push(`rotm 24 4 33 33 25 25 ${a} 256 33 7 0 6 33 9 20 14`);
    for (let a = 0; a <= 2048; a++) lines.push(`rotmo 100 60 33 33 25 25 ${a} ${200 + (a % 9) * 20} 33 21 0 6 33 22 20 14`);
    lines.push(`cache 1 ${ALPHA_GROUPS[0]} 0`);
    for (let a = 0; a <= 2048; a += 3) lines.push(`rotm 24 4 33 33 8 8 ${a} 256 33 7 0 6 33 9 20 14`, `rotmo 100 60 33 33 8 8 ${a} 512 33 21 0 6 33 22 20 14`);

    // Every alpha -2..258 through drawAlpha and drawScaledAlpha on a vh and an rh.
    for (const load of [`cache 1 ${ALPHA_GROUPS[0]} 0`, `cache 1 ${ALPHA_GROUPS[5]} 0`, `cache 0 ${group('hitmarks').group} 0 2`]) {
        lines.push(load);
        for (let a = -2; a <= 258; a++) lines.push(`alpha ${(a * 7) % 150} ${(a * 3) % 110} ${a}`, `scaleda ${(a * 5) % 150} 30 37 29 ${a}`);
    }

    // rh.a(IIIIII)V around the circle at several scales, and rh.a(IIIIIIDI)V over the milliradian range.
    lines.push(`cache 0 ${group('cross').group} 0 0`);
    const scales = [4096, 2048, 9000, 65536, 1 << 20];
    for (let a = 0; a < 65536; a += 41) lines.push(`rot 128 128 ${16 * 80} ${16 * 60} ${a} ${scales[a % scales.length]}`);
    lines.push(`cache 2 ${group('mapfunction').group} 0`);
    for (let m = -7000; m <= 7000; m += 7) lines.push(`rotd 60 40 40 40 7 7 ${m} ${256 + (m % 5) * 64}`);

    // A clip mask on Pix2D (td.f/td.a): set, wrong length (IllegalArgumentException), draws under it, cleared.
    lines.push(`clipmask ${H} 5 0 ${W} ${H} 6 0 ${W}`, `clipmask ${H - 1} 5 0 ${W} ${H} 6 0 ${W}`, `clipmask ${H} 5 0 ${W} -1 6 0 ${W}`, `cache 0 ${group('runes').group} 0 3`);
    lines.push(...draws(96, 96));
    lines.push('noclipmask', 'draw 30 30');
    return lines;
}

// Crop size of every decoded frame ("group:frame"), recorded when the test first decodes them all.
const PROBE = new Map<string, [number, number]>();

test('SoftwareSprite and SoftwareAlphaSprite match rh and vh in client.jar', () => {
    // SpriteLoader's staging statics are shared with the other test files in this process: restore them afterwards.
    const saved = {
        count: SpriteLoader.count,
        canvasWidth: SpriteLoader.canvasWidth,
        height: SpriteLoader.height,
        xOffsets: SpriteLoader.xOffsets,
        yOffsets: SpriteLoader.yOffsets,
        widths: SpriteLoader.widths,
        innerHeights: SpriteLoader.innerHeights,
        palette: SpriteLoader.palette,
        pixels: SpriteLoader.pixels,
        alphas: SpriteLoader.alphas,
        hasAlpha: SpriteLoader.hasAlpha
    };
    // So is Pix2D: start from its <clinit> state, as the fresh JVM does, and put the incoming state back afterwards.
    const savedPix2D = {
        pixels: Pix2D.pixels,
        width: Pix2D.width,
        height: Pix2D.height,
        clipMinX: Pix2D.clipMinX,
        clipMinY: Pix2D.clipMinY,
        clipMaxX: Pix2D.clipMaxX,
        clipMaxY: Pix2D.clipMaxY,
        maskOffsets: Pix2D.maskOffsets,
        maskLengths: Pix2D.maskLengths
    };
    Object.assign(Pix2D, { pixels: null, width: 0, height: 0, clipMinX: 0, clipMinY: 0, clipMaxX: 0, clipMaxY: 0, maskOffsets: null, maskLengths: null });
    try {
        const script: string[] = [];
        const got: string[] = [];
        const emit = (line: string): void => {
            try {
                got.push(execute(script.length, line));
            } catch (e) {
                throw new Error(`operation ${script.length} (${line.slice(0, 200)}) threw outside the Java exception set`, { cause: e });
            }
            script.push(line);
        };

        for (const line of cacheSetup()) emit(line);
        for (const g of cacheGroups) {
            for (let frame = 0; frame < g.frames; frame++) {
                emit(`cache 0 ${g.group} 0 ${frame}`);
                const s = sprite;
                if (s !== null) PROBE.set(`${g.group}:${frame}`, [Math.max(1, Math.min(400, s.cropW)), Math.max(1, Math.min(400, s.cropH))]);
            }
        }
        for (const line of directedCases()) emit(line);
        for (const line of cacheCases()) emit(line);

        let sizeIndex = 0;
        for (const seed of RANDOM_SEEDS) {
            const r = new Rng(seed);
            const [w, h] = FRAMEBUFFERS[sizeIndex++ % FRAMEBUFFERS.length];
            emit(`fb ${w * h} ${w} ${h} ${r.int(MIN, MAX)}`);
            emit(newSprite(r));
            for (let i = 0; i < RANDOM_OPS / RANDOM_SEEDS.length; i++) emit(randomOp(r));
        }
        emit('noclipmask');

        const expected = runOracle(script.join('\n') + '\n');
        expect(expected.length).toBe(got.length);
        for (let i = 0; i < got.length; i++) {
            if (got[i] !== expected[i]) {
                throw new Error(`mismatch at operation ${i}: ${script[i].slice(0, 200)}\n  ts:   ${got[i]}\n  java: ${expected[i]}`);
            }
        }

        // The script reaches every outcome, both sprite classes and both loader results.
        const results = new Set(got.map(line => line.split(' ')[2]));
        expect([...results].sort()).toEqual(['aioobe', 'arith', 'iae', 'ise', 'nase', 'npe', 'ok']);
        const cacheLines = got.filter(line => line.split(' ')[1] === 'cache');
        expect(cacheLines.some(line => line.includes(' vh '))).toBe(true);
        expect(cacheLines.some(line => line.endsWith(' false'))).toBe(true);
        expect(cacheLines.length).toBeGreaterThan(500);
        console.log(`sprite oracle: ${got.length} operations, ${cacheLines.length} cache decodes`);
    } finally {
        Object.assign(SpriteLoader, saved);
        Object.assign(Pix2D, savedPix2D);
    }
}, 600000);
