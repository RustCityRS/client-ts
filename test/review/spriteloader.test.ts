import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { closeSync, mkdtempSync, openSync, readSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import Js5 from '../../src/cache/Js5.js';
import Js5Index from '../../src/cache/Js5Index.js';
import Client from '../../src/client/Client.js';
import TitleFlames from '../../src/title/TitleFlames.js';
import TitleScreen from '../../src/title/TitleScreen.js';
import { preserveLoadingGroupIds } from '../loading-group-fixture.js';
import Js5ResourceProvider from '../../src/cache/Js5ResourceProvider.js';
import { fromJsString } from '../../src/datastruct/JagString.js';
import AbstractIndexedSprite from '../../src/graphics/AbstractIndexedSprite.js';
import AbstractSprite from '../../src/graphics/AbstractSprite.js';
import Pix2D from '../../src/graphics/Pix2D.js';
import SoftwareAlphaSprite from '../../src/graphics/SoftwareAlphaSprite.js';
import SoftwareFont from '../../src/graphics/SoftwareFont.js';
import Pix8 from '../../src/graphics/Pix8.js';
import Pix32 from '../../src/graphics/Pix32.js';
import SpriteLoader from '../../src/graphics/SpriteLoader.js';
import Crc32 from '../../src/io/Crc32.js';
import { arrayAt, arrayPut, requireNonNull } from '../../src/util/JavaArray.js';
import { cachePath, gamepackPath } from '../reference.js';

// SpriteLoader (src/graphics/SpriteLoader.ts) against client.jar, through spriteloader/SpriteLoaderDiffOracle.java.
//
// SpriteLoader is a logical class: the archive-8 sprite decoder og.a and its staging statics (lc.q ad.g lh.g qj.B ff.s
// jh.l df.H ke.m vg.hb tb.d c.v), mk.c, the builders (df.d ed.a oc.a p.a pk.b qd.b vi.e ud.a rk.b uk.b tf.a), the
// loaders (ja.a hl.a gi.a ha.a ii.a lc.a ml.a nh.a oh.a qc.a sj.a u.a wb.a), wh.b, the group ids that ld.a stores
// (di.l ef.w gg.E mi.D mj.a), the four name constants and the HUD arrays that the stage-80 loader uf.a stores (di.m
// gf.cb gg.H gh.N me.L).
//
// The test builds one script, runs it through the port, then pipes it into the oracle, which runs it on the real
// gamepack statics in a fresh JVM. Each line carries the outcome (ok or the Java exception, unwrapped from the
// obfuscator's g), a digest of the return value (each sprite field by field: geometry, offsets, pixel length and hash;
// ch also its palette and whether it shares the staging plane and palette; fg every glyph table, the masks and which
// staging arrays it kept), the whole staging state (each array with an identity marker: same object as after the
// previous op or a new one) and the five group ids.
//
// Sections: the class's clinit state (the TS side from a fresh Bun process); every one of the 1,707 archive-8 groups
// through a rotating loader (all thirteen plus fa.a), through ja.a and through hl.a, each followed by a rotating
// builder; ld.a/g.a/pf.a name resolution against the native loading statics; the 21 groups the client looks up by name through
// every loader; the 18 font groups through the stage-65 loader sb.a and through ja.a + tf.a with their archive-13
// metrics; uf.a's stage-80 sprite loads in its order (HUD arrays, trims and the mapfunction recolour), then every HUD
// sprite drawn into a Pix2D target and the framebuffer hashed; loader edge cases (null archive, missing and
// out-of-range groups and files); staging misuse (nulled, shortened and swapped staging arrays, builders run twice);
// negative array sizes; and seeded synthetic files (row and column major, alpha planes with and without non-0xff
// alpha, every palette size class, trimmed and untrimmed frames, zero-size frames, indices past the palette, 256-frame
// font sheets) plus truncated, bit-flipped and recounted copies of synthetic and real files.
//
// The statics are shared with every other test file in the Bun process, so the test resets them to their clinit
// values first and restores the incoming ones (and Pix2D's target) afterwards.

const SYNTHETIC_CASES = 3000;
const GROUPS_8 = 1707;
const FONT_GROUPS = [305, 307, 468, 473, 494, 495, 496, 497, 584, 591, 645, 646, 647, 648, 764, 776, 819, 1591];
// Every archive-8 group name that a string in the client resolves to (al.a(BLid;)I through ld.a, g.a and pf.a).
const CLIENT_NAMES = [
    'p11_full',
    'p12_full',
    'b12_full',
    'mapfunction',
    'hitmarks',
    'hitbar_default',
    'headicons_pk',
    'headicons_prayer',
    'hint_headicons',
    'hint_mapmarkers',
    'mapflag',
    'cross',
    'mapdots',
    'scrollbar',
    'name_icons',
    'floorshadows',
    'compass',
    'hint_mapedge',
    'titlebg',
    'logo',
    'runes'
];
const LOADERS = ['ja', 'hl', 'gi', 'ha', 'ii', 'lc', 'ml', 'nh', 'oh', 'qc', 'sj', 'u', 'wb', 'fa'];
const BUILDERS = ['df', 'ed', 'oc', 'p', 'pk', 'qd', 'vi', 'ud', 'rk', 'uk', 'tf'];
// Allocation guard for synthetic files: the decoder and builders allocate width*height per frame, so inputs that would
// ask for gigabytes are skipped (negative products still run: NegativeArraySizeException on both sides).
const MAX_FRAME = 1 << 20;
const MAX_TOTAL = 1 << 22;

// The static fields API.md assigns to SpriteLoader, and its methods.
const FIELDS = [
    'alphas',
    'canvasWidth',
    'compassId',
    'compassName',
    'count',
    'cross',
    'floorShadowsId',
    'hasAlpha',
    'headiconsPkId',
    'height',
    'hintMapEdge',
    'hitbarDefault',
    'hitbarDefaultName',
    'hitmarksId',
    'innerHeights',
    'mapdotsGroupId',
    'mapdotsName',
    'mapflagName',
    'mapfunctionsRecoloured',
    'palette',
    'pixels',
    'scrollbars',
    'widths',
    'xOffsets',
    'yOffsets'
];
const METHODS = [
    'clear',
    'createFont',
    'createIndexedSprite',
    'createIndexedSprite2',
    'createIndexedSprites',
    'createSoftwareSprites',
    'createSprite',
    'createSprites',
    'decode',
    'load',
    'loadFont',
    'loadGroup',
    'loadIndexedSprite',
    'loadIndexedSprite2',
    'loadIndexedSprites',
    'loadIndexedSprites2',
    'loadSoftwareSprite',
    'loadSoftwareSpriteWithAlpha',
    'loadSoftwareSprites',
    'loadSprite',
    'loadSprite2',
    'loadSprite3',
    'loadSprites',
    'loadSprites2',
    'toIndexedSprites',
    'toSoftwareSprite',
    'toSoftwareSprites',
    'toSprite',
    'total'
];

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
const tBytes = (b: Uint8Array | null) => (b === null ? 'n' : 'b' + b64(b));
const fromToken = (t: string): Uint8Array | null => (t === 'n' ? null : new Uint8Array(Buffer.from(t.slice(1), 'base64')));

// One group container straight from the sector files, without the two-byte version trailer.
function readGroup(archive: number, group: number): Uint8Array {
    const entry = Buffer.alloc(6);
    const index = openSync(join(cachePath, 'main_file_cache.idx' + archive), 'r');
    try {
        if (readSync(index, entry, 0, 6, group * 6) !== 6) throw new Error(`Missing JS5 entry ${archive}/${group}`);
    } finally {
        closeSync(index);
    }
    const buffer = Buffer.alloc(entry.readUIntBE(0, 3));
    let sector = entry.readUIntBE(3, 3);
    const disk = openSync(join(cachePath, 'main_file_cache.dat2'), 'r');
    try {
        const header = Buffer.alloc(8);
        for (let offset = 0; offset < buffer.length; offset += 512) {
            const pos = sector * 520;
            if (readSync(disk, header, 0, 8, pos) !== 8 || header.readUInt16BE(0) !== group || header.readUInt16BE(2) !== offset >> 9 || header[7] !== archive) {
                throw new Error(`Invalid JS5 sector ${sector} for ${archive}/${group}`);
            }
            sector = header.readUIntBE(4, 3);
            const count = Math.min(512, buffer.length - offset);
            if (readSync(disk, buffer, offset, count, pos + 8) !== count) throw new Error(`Short JS5 sector ${sector}`);
        }
    } finally {
        closeSync(disk);
    }
    const raw = new Uint8Array(buffer);
    const length = ((raw[1] << 24) | (raw[2] << 16) | (raw[3] << 8) | raw[4]) >>> 0;
    return raw.subarray(0, (raw[0] === 0 ? 5 : 9) + length);
}

function runOracle(script: string): string[] {
    const source = fileURLToPath(new URL('./spriteloader/SpriteLoaderDiffOracle.java', import.meta.url));
    const dir = mkdtempSync(join(tmpdir(), 'spriteloader-diff-'));
    try {
        const javac = spawnSync('javac', ['-nowarn', '-cp', gamepackPath, '-d', dir, source], { timeout: 120000, encoding: 'utf8' });
        if (javac.status !== 0) throw new Error(`javac failed: ${javac.stderr}`);
        const java = spawnSync('java', ['-Xmx1g', '-Djava.awt.headless=true', '-cp', gamepackPath + delimiter + dir, 'SpriteLoaderDiffOracle'], {
            input: script,
            timeout: 400000,
            encoding: 'utf8',
            maxBuffer: 1024 * 1024 * 1024
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

// ---- digests (identical to the oracle's) ----

function ints(a: Int32Array | null): string {
    if (a === null) return 'null';
    let h = 1;
    for (let i = 0; i < a.length; i++) h = (Math.imul(h, 31) + a[i]) | 0;
    return `${a.length}:${h}`;
}

function planeHash(p: Uint8Array): number {
    let h = p.length;
    for (let i = 0; i < p.length; i++) h = (Math.imul(h, 31) + (p[i] & 255)) | 0;
    return h;
}

const plane = (a: Uint8Array | null) => (a === null ? 'null' : `${a.length}:${planeHash(a)}`);

function planes(a: (Uint8Array | null)[] | null): string {
    if (a === null) return 'null';
    let h = 1;
    for (const p of a) h = (Math.imul(h, 31) + (p === null ? 7 : planeHash(p))) | 0;
    return `${a.length}:${h}`;
}

function bools(a: boolean[] | null): string {
    if (a === null) return 'null';
    let h = 1;
    for (const v of a) h = (Math.imul(h, 31) + (v ? 2 : 1)) | 0;
    return `${a.length}:${h}`;
}

type StagingArrays = [Int32Array | null, Int32Array | null, Int32Array | null, Int32Array | null, Int32Array | null, (Uint8Array | null)[] | null, (Uint8Array | null)[] | null, boolean[] | null];

const stagingArrays = (): StagingArrays => [SpriteLoader.xOffsets, SpriteLoader.yOffsets, SpriteLoader.widths, SpriteLoader.innerHeights, SpriteLoader.palette, SpriteLoader.pixels, SpriteLoader.alphas, SpriteLoader.hasAlpha];

let previous: unknown[] = new Array(11).fill(null);

function staging(): string {
    const s = SpriteLoader;
    const now = stagingArrays();
    const text = [ints(s.xOffsets), ints(s.yOffsets), ints(s.widths), ints(s.innerHeights), ints(s.palette), planes(s.pixels), planes(s.alphas), bools(s.hasAlpha)];
    let out = `${s.count},${s.canvasWidth},${s.height}`;
    for (let i = 0; i < now.length; i++) {
        out += ' ';
        if (now[i] !== null) out += now[i] === previous[i] ? '=' : '*';
        out += text[i];
    }
    previous = now;
    return out;
}

type Ids = { headiconsPkId: number; hitmarksId: number; mapdotsGroupId: number; compassId: number; floorShadowsId: number };
const ids = (s: Ids) => `${s.headiconsPkId},${s.hitmarksId},${s.mapdotsGroupId},${s.compassId},${s.floorShadowsId}`;

// The shape of SpriteLoader's statics: the class itself, or the snapshot a fresh Bun process prints.
type Statics = Ids & {
    count: number;
    canvasWidth: number;
    height: number;
    xOffsets: Int32Array | null;
    yOffsets: Int32Array | null;
    widths: Int32Array | null;
    innerHeights: Int32Array | null;
    palette: Int32Array | null;
    pixels: (Uint8Array | null)[] | null;
    alphas: (Uint8Array | null)[] | null;
    hasAlpha: boolean[] | null;
    mapdotsName: { toBytes(): Uint8Array };
    compassName: { toBytes(): Uint8Array };
    hitbarDefaultName: { toBytes(): Uint8Array };
    mapflagName: { toBytes(): Uint8Array };
    cross: (AbstractSprite | null)[] | null;
    hintMapEdge: (AbstractSprite | null)[] | null;
    hitbarDefault: (AbstractSprite | null)[] | null;
    mapfunctionsRecoloured: (AbstractSprite | null)[] | null;
    scrollbars: (AbstractIndexedSprite | null)[] | null;
    total(): number;
};

function statics(s: Statics): string {
    return (
        `q=${s.count} g=${s.canvasWidth} h=${s.height} X=${ints(s.xOffsets)} Y=${ints(s.yOffsets)} W=${ints(s.widths)} H=${ints(s.innerHeights)} ` +
        `P=${ints(s.palette)} pix=${planes(s.pixels)} alp=${planes(s.alphas)} has=${bools(s.hasAlpha)} ids=${ids(s)} ` +
        `names=${b64(s.mapdotsName.toBytes())},${b64(s.compassName.toBytes())},${b64(s.hitbarDefaultName.toBytes())},${b64(s.mapflagName.toBytes())} ` +
        `cross=${digest(s.cross)} edge=${digest(s.hintMapEdge)} hitbar=${digest(s.hitbarDefault)} mapfn=${digest(s.mapfunctionsRecoloured)} ` +
        `scroll=${digest(s.scrollbars)} total=${s.total()}`
    );
}

function digest(o: unknown, before: StagingArrays | null = null): string {
    if (o === null || o === undefined) return 'null';
    if (typeof o === 'boolean' || typeof o === 'number') return String(o);
    if (Array.isArray(o)) return '[' + o.map((v, i) => digestAt(v, before, i)).join(';') + ']';
    return digestAt(o, before, 0);
}

function digestAt(o: unknown, before: StagingArrays | null, frame: number): string {
    if (o === null || o === undefined) return 'null';
    if (o instanceof Pix32) {
        return `${o instanceof SoftwareAlphaSprite ? 'vh' : 'rh'}:${o.height},${o.width},${o.yOffset},${o.cropH},${o.xOffset},${o.cropW},${ints(o.pixels)}`;
    }
    if (o instanceof Pix8) {
        const palette = o['palette'];
        let alias = '';
        if (before !== null) {
            const planesBefore = before[5];
            alias = ',' + (planesBefore !== null && frame < planesBefore.length && planesBefore[frame] === o.pixels ? 'P' : '-') + (palette === before[4] ? 'C' : '-');
        }
        return `ch:${o.xOffset},${o.cropH},${o.yOffset},${o.width},${o.height},${o.cropW},${plane(o.pixels)},${ints(palette)}${alias}`;
    }
    if (o instanceof SoftwareFont) {
        let alias = '';
        if (before !== null) {
            alias =
                ',' +
                (o['glyphXOffsets'] === before[0] ? 'X' : '-') +
                (o['glyphYOffsets'] === before[1] ? 'Y' : '-') +
                (o['glyphWidths'] === before[2] ? 'W' : '-') +
                (o['glyphHeights'] === before[3] ? 'H' : '-') +
                (o['glyphMasks'] === before[5] ? 'M' : '-');
        }
        return (
            `fg:${o.lineHeight},${o['paddingTop']},${o['paddingBottom']},${ints(o['glyphHeights'])},${ints(o['glyphYOffsets'])},${ints(o['iconHeights'])},` +
            `${ints(o['glyphXOffsets'])},${ints(o['glyphWidths'])},${ints(o['glyphAdvances'])},${plane(o['kerning'])},${o['icons'] === null ? 'null' : 'icons'},` +
            `${planes(o['glyphMasks'])}${alias}`
        );
    }
    throw new Error('unexpected value ' + String(o));
}

function classify(e: unknown): string {
    if (e instanceof TypeError && /^Null (reference|array|byte array)$/.test(e.message)) return 'npe';
    if (e instanceof RangeError) {
        if (e.message === '/ by zero') return 'arith';
        if (e.message.startsWith('array index ') || e.message.startsWith('byte array index ')) return 'aioobe';
        // new Int32Array(-n) / new Array(-n): the engine's NegativeArraySizeException.
        if (/negative|Invalid typed array length|Invalid array length|Array length must be a positive integer/.test(e.message)) return 'neg';
    }
    if (e instanceof Error && e.constructor === Error) return 'rt';
    // An engine error (a TypeError from touching null, say) means the port does not raise Java's exception itself.
    return 'native:' + String(e).replace(/\s+/g, '_');
}

// ---- the TS side ----

// The JS5 provider behind the archives: it serves the index and group containers the script supplied, like the
// oracle's ud subclass.
class Provider extends Js5ResourceProvider {
    constructor(
        private readonly table: Js5Index | null,
        private readonly groups: Map<number, Uint8Array>
    ) {
        super();
    }

    index(): Js5Index | null {
        return this.table;
    }

    group(_mode: number, group: number): Uint8Array | null {
        return this.groups.get(group) ?? null;
    }

    prefetchGroup(_group: number): void {}

    GetGroupLoadPercentage(_group: number): number {
        return 100;
    }
}

class Digested {
    constructor(readonly text: string) {}
}

class Runner {
    readonly indexes = new Map<number, Uint8Array>();
    readonly groups = new Map<number, Map<number, Uint8Array>>();
    readonly archives = new Map<number, Js5>();
    namesLoaded = false;

    constructor(private readonly fresh: string) {}

    archive(tok: string): Js5 | null {
        return tok === 'n' ? null : (this.archives.get(Number(tok)) ?? null);
    }

    loader(which: string, arch: Js5 | null, x: number, y: number): unknown {
        switch (which) {
            case 'ja':
                return SpriteLoader.load(x, y, arch);
            case 'hl':
                return SpriteLoader.loadGroup(arch, x);
            case 'gi':
                return SpriteLoader.loadSoftwareSpriteWithAlpha(x, arch, y);
            case 'ha':
                return SpriteLoader.loadSoftwareSprites(x, arch, y);
            case 'ii':
                return SpriteLoader.loadSprite(x, arch);
            case 'lc':
                return SpriteLoader.loadIndexedSprites(arch, x);
            case 'ml':
                return SpriteLoader.loadSprite2(arch, x, y);
            case 'nh':
                return SpriteLoader.loadSprites(x, arch, y);
            case 'oh':
                return SpriteLoader.loadSprites2(x, arch, y);
            case 'qc':
                return SpriteLoader.loadIndexedSprite(x, arch, y);
            case 'sj':
                return SpriteLoader.loadSprite3(x, arch);
            case 'u':
                return SpriteLoader.loadIndexedSprite2(x, arch);
            case 'wb':
                return SpriteLoader.loadIndexedSprites2(x, y, arch);
            case 'fa':
                // fa.a(ILal;II)Lrh; (archive, group, file): ja.a then df.d.
                return SpriteLoader.loadSoftwareSprite(arch, x, y);
            default:
                throw new Error('bad loader ' + which);
        }
    }

    // Every HUD sprite drawn (draw and drawAlpha) into a fresh w*h Pix2D target, then the target hashed.
    drawHud(w: number, h: number): string {
        const buf = new Int32Array(w * h);
        Pix2D.setPixels(buf, w, h);
        const sets: ((AbstractSprite | AbstractIndexedSprite | null)[] | null)[] = [SpriteLoader.cross, SpriteLoader.hintMapEdge, SpriteLoader.hitbarDefault, SpriteLoader.mapfunctionsRecoloured, SpriteLoader.scrollbars];
        let k = 0;
        for (const set of sets) {
            if (set === null) continue;
            for (const s of set) {
                const x = ((k * 37) % w) - 8;
                const y = ((k * 23) % h) - 8;
                k++;
                if (s instanceof AbstractSprite) {
                    s.draw(x, y);
                    s.drawAlpha(x + 5, y + 3, 128);
                } else if (s instanceof AbstractIndexedSprite) {
                    s.draw(x, y);
                    s.drawAlpha(x + 5, y + 3, 128);
                }
            }
        }
        return `${k}:${ints(buf).split(':')[1]}`;
    }

    run(a: string[]): unknown {
        switch (a[0]) {
            case 'clinit':
                return new Digested(this.fresh);
            case 'statics':
                return new Digested(statics(SpriteLoader));
            case 'idx':
                this.indexes.set(Number(a[1]), fromToken(a[2]) ?? new Uint8Array(0));
                return null;
            case 'grp': {
                const id = Number(a[1]);
                let map = this.groups.get(id);
                if (map === undefined) {
                    map = new Map();
                    this.groups.set(id, map);
                }
                map.set(Number(a[2]), fromToken(a[3]) ?? new Uint8Array(0));
                return null;
            }
            case 'arch': {
                const source = Number(a[2]);
                const src = this.indexes.get(source);
                const table = src === undefined ? null : new Js5Index(src, Crc32.prefix(src, src.length));
                this.archives.set(Number(a[1]), new Js5(new Provider(table, this.groups.get(source) ?? new Map()), a[3] === '1', a[4] === '1'));
                return null;
            }
            case 'dec':
                SpriteLoader.decode(fromToken(a[1]));
                return null;
            case 'clear':
                SpriteLoader.clear();
                return null;
            case 'total':
                return SpriteLoader.total();
            case 'drop':
                switch (a[1]) {
                    case 'q':
                        SpriteLoader.count = Number(a[2]);
                        break;
                    case 'X':
                        SpriteLoader.xOffsets = null;
                        break;
                    case 'Y':
                        SpriteLoader.yOffsets = null;
                        break;
                    case 'W':
                        SpriteLoader.widths = null;
                        break;
                    case 'H':
                        SpriteLoader.innerHeights = null;
                        break;
                    case 'P':
                        SpriteLoader.palette = null;
                        break;
                    case 'pix':
                        SpriteLoader.pixels = null;
                        break;
                    case 'alp':
                        SpriteLoader.alphas = null;
                        break;
                    case 'has':
                        SpriteLoader.hasAlpha = null;
                        break;
                    case 'pix0':
                        arrayPut(SpriteLoader.pixels, 0, null);
                        break;
                    case 'alp0':
                        arrayPut(SpriteLoader.alphas, 0, null);
                        break;
                    case 'pal1':
                        SpriteLoader.palette = new Int32Array(1);
                        break;
                    case 'has0':
                        arrayPut(SpriteLoader.hasAlpha, 0, !arrayAt(SpriteLoader.hasAlpha, 0));
                        break;
                    case 'short': {
                        // Arrays.copyOf: truncate or zero-extend to n.
                        const n = Number(a[2]);
                        const copy = (src: Int32Array | null) => {
                            const out = new Int32Array(n);
                            out.set(requireNonNull(src).subarray(0, n));
                            return out;
                        };
                        SpriteLoader.xOffsets = copy(SpriteLoader.xOffsets);
                        SpriteLoader.yOffsets = copy(SpriteLoader.yOffsets);
                        SpriteLoader.widths = copy(SpriteLoader.widths);
                        SpriteLoader.innerHeights = copy(SpriteLoader.innerHeights);
                        break;
                    }
                    default:
                        throw new Error('bad drop ' + a[1]);
                }
                return null;
            case 'build': {
                const before = stagingArrays();
                let value: unknown;
                switch (a[1]) {
                    case 'df':
                        value = SpriteLoader.toSoftwareSprite();
                        break;
                    case 'ed':
                        value = SpriteLoader.toSoftwareSprites();
                        break;
                    case 'oc':
                        value = SpriteLoader.createSoftwareSprites();
                        break;
                    case 'p':
                        value = SpriteLoader.createSprites();
                        break;
                    case 'pk':
                        value = SpriteLoader.toSprite();
                        break;
                    case 'qd':
                        value = SpriteLoader.toIndexedSprites();
                        break;
                    case 'vi':
                        value = SpriteLoader.createIndexedSprites();
                        break;
                    case 'ud':
                        value = SpriteLoader.createSprite();
                        break;
                    case 'rk':
                        value = SpriteLoader.createIndexedSprite();
                        break;
                    case 'uk':
                        value = SpriteLoader.createIndexedSprite2(Number(a[2]));
                        break;
                    case 'tf':
                        value = SpriteLoader.createFont(fromToken(a[2]));
                        break;
                    default:
                        throw new Error('bad build ' + a[1]);
                }
                return new Digested(digest(value, before));
            }
            case 'ldr':
                return new Digested(digest(this.loader(a[1], this.archive(a[2]), Number(a[3]), a.length > 4 ? Number(a[4]) : 0)));
            case 'ldrn': {
                const arch = this.archive(a[2]);
                const id = requireNonNull(arch).GetGroupId(fromJsString(a[3]));
                const groupInY = a[1] === 'ja' || a[1] === 'gi' || a[1] === 'oh';
                const value = groupInY ? this.loader(a[1], arch, 0, id) : this.loader(a[1], arch, id, 0);
                return new Digested(`${id}=${digest(value)}`);
            }
            case 'names': {
                const arch = requireNonNull(this.archive(a[1]));
                Client.lookupSpriteGroupIds(arch);
                Client.loadTitleGroupIds(arch);
                Client.findRunesSpriteGroup(arch);
                this.namesLoaded = true;
                const s = SpriteLoader;
                return new Digested(
                    [
                        Client.fontPlain11Id,
                        Client.p12FullGroup,
                        Client.fontBold12Id,
                        Client.mapfunctionSpriteGroup,
                        s.hitmarksId,
                        Client.hitbarDefaultId,
                        s.headiconsPkId,
                        Client.headiconsPrayerGroup,
                        Client.hintHeadiconsGroup,
                        Client.hintMapmarkersSpriteGroup,
                        Client.mapflagGroupId,
                        Client.crossGroup,
                        s.mapdotsGroupId,
                        Client.scrollbarGroupId,
                        Client.nameIconsGroup,
                        s.floorShadowsId,
                        s.compassId,
                        Client.hintMapEdgeSpriteId,
                        TitleScreen.backgroundId,
                        TitleScreen.logoGroup,
                        TitleFlames.runesGroup
                    ].join(',')
                );
            }
            case 'stage80': {
                // uf.a(Lal;I)V's sprite loads in its order with its arguments; the four Math.random draws come from the
                // script. The font icon registrations (ma.b/wj.g/b.a) are not SpriteLoader's and are left out on both sides.
                const arch = this.archive(a[1]);
                const [r7, r5, r8, r6] = [Number(a[2]), Number(a[3]), Number(a[4]), Number(a[5])];
                if (!this.namesLoaded) throw new Error('names op must run before stage80');
                let out = '';
                const mapfunction = SpriteLoader.loadSoftwareSprites(Client.mapfunctionSpriteGroup, arch, 0);
                out += digest(mapfunction) + '/';
                out += digest(SpriteLoader.loadSprites(SpriteLoader.hitmarksId, arch, 0)) + '/';
                SpriteLoader.hitbarDefault = SpriteLoader.loadSprites(Client.hitbarDefaultId, arch, 0);
                out += digest(SpriteLoader.loadSprites(SpriteLoader.headiconsPkId, arch, 0)) + '/';
                out += digest(SpriteLoader.loadSprites(Client.headiconsPrayerGroup, arch, 0)) + '/';
                out += digest(SpriteLoader.loadSprites(Client.hintHeadiconsGroup, arch, 0)) + '/';
                out += digest(SpriteLoader.loadSprites(Client.hintMapmarkersSpriteGroup, arch, 0)) + '/';
                out += digest(SpriteLoader.loadSprite2(arch, Client.mapflagGroupId, 0)) + '/';
                SpriteLoader.cross = SpriteLoader.loadSprites2(0, arch, Client.crossGroup);
                out += digest(SpriteLoader.loadSprites2(0, arch, SpriteLoader.mapdotsGroupId)) + '/';
                SpriteLoader.scrollbars = SpriteLoader.loadIndexedSprites2(Client.scrollbarGroupId, 0, arch);
                out += digest(SpriteLoader.loadIndexedSprites2(Client.nameIconsGroup, 0, arch)) + '/';
                // fa.a(-123, archive, mi.D, 0): ja.a then df.d (see the 'fa' loader above).
                const compass = SpriteLoader.loadSoftwareSprite(arch, SpriteLoader.compassId, 0);
                requireNonNull(compass).trim();
                out += digest(compass) + '/';
                const edges = SpriteLoader.loadSoftwareSprites(Client.hintMapEdgeSpriteId, arch, 0);
                for (let i = 0; i < requireNonNull(edges).length; i++) requireNonNull(arrayAt(edges, i)).trim();
                SpriteLoader.hintMapEdge = edges;
                for (let i = 0; i < requireNonNull(mapfunction).length; i++) {
                    requireNonNull(arrayAt(mapfunction, i)).rgbAdjust((r8 + r5) | 0, (r6 + r8) | 0, (r7 + r8) | 0);
                }
                SpriteLoader.mapfunctionsRecoloured = mapfunction;
                return new Digested(out);
            }
            case 'hud':
                return new Digested(`${digest(SpriteLoader.cross)}/${digest(SpriteLoader.hintMapEdge)}/${digest(SpriteLoader.hitbarDefault)}/` + `${digest(SpriteLoader.mapfunctionsRecoloured)}/${digest(SpriteLoader.scrollbars)}`);
            case 'drawhud':
                return new Digested(this.drawHud(Number(a[1]), Number(a[2])));
            case 'font': {
                // sb.a(Lal;IIILal;)Lmb; (sprites, group, file, dummy, metrics): ja.a then tf.a on the metrics file.
                const before = stagingArrays();
                const sprites = this.archive(a[1]);
                const metrics = this.archive(a[2]);
                const group = Number(a[3]);
                const file = Number(a[4]);
                const value = SpriteLoader.loadFont(sprites, group, file, metrics);
                return new Digested(digest(value, before));
            }
            case 'hudset':
                switch (a[1]) {
                    case 'cross':
                        SpriteLoader.cross = null;
                        break;
                    case 'edge':
                        SpriteLoader.hintMapEdge = null;
                        break;
                    case 'hitbar':
                        SpriteLoader.hitbarDefault = null;
                        break;
                    case 'mapfn':
                        SpriteLoader.mapfunctionsRecoloured = null;
                        break;
                    case 'scroll':
                        SpriteLoader.scrollbars = null;
                        break;
                    default:
                        throw new Error('bad hud ' + a[1]);
                }
                return null;
            default:
                throw new Error('bad op ' + a[0]);
        }
    }

    execute(index: number, line: string): string {
        const a = line.split(' ');
        let result = 'ok';
        let value = '-';
        try {
            const v = this.run(a);
            value = v instanceof Digested ? v.text : digest(v);
        } catch (e) {
            result = classify(e);
        }
        return `${index} ${a[0]} ${result} ${value} | ${staging()} | ${ids(SpriteLoader)}`;
    }
}

// ---- clinit and save/restore ----

type Encoded = null | number | boolean | { t: string; v?: unknown[] };

// SpriteLoader's statics as a fresh Bun process sees them (nothing else in this process has touched that copy).
function freshStatics(): { fields: string[]; methods: string[]; text: string } {
    const url = pathToFileURL(fileURLToPath(new URL('../../src/graphics/SpriteLoader.ts', import.meta.url))).href;
    const code = `
        const S = (await import(${JSON.stringify(url)})).default;
        const enc = v => v === null || v === undefined ? null
            : typeof v === 'number' || typeof v === 'boolean' ? v
            : ArrayBuffer.isView(v) ? { t: v.constructor.name, v: Array.from(v) }
            : Array.isArray(v) ? { t: 'Array', v: v.map(enc) }
            : typeof v.toBytes === 'function' ? { t: 'id', v: Array.from(v.toBytes()) }
            : { t: 'other:' + (v.constructor ? v.constructor.name : typeof v) };
        const out = { fields: {}, methods: [] };
        for (const k of Object.getOwnPropertyNames(S)) {
            if (k === 'prototype' || k === 'length' || k === 'name') continue;
            if (typeof S[k] === 'function') out.methods.push(k); else out.fields[k] = enc(S[k]);
        }
        console.log(JSON.stringify(out));
    `;
    const child = spawnSync(process.execPath, ['-e', code], { encoding: 'utf8', timeout: 60000 });
    if (child.status !== 0) throw new Error(`fresh SpriteLoader import failed: ${child.stderr}`);
    const parsed = JSON.parse(child.stdout.trim()) as { fields: Record<string, Encoded>; methods: string[] };
    const decode = (e: Encoded): unknown => {
        if (e === null || typeof e === 'number' || typeof e === 'boolean') return e;
        const values = e.v ?? [];
        if (e.t === 'Int32Array') return Int32Array.from(values as number[]);
        if (e.t === 'Uint8Array') return Uint8Array.from(values as number[]);
        if (e.t === 'Array') return values.map(v => decode(v as Encoded));
        if (e.t === 'id') {
            const bytes = Uint8Array.from(values as number[]);
            return { toBytes: () => bytes };
        }
        throw new Error('unexpected fresh static ' + e.t);
    };
    const state: Record<string, unknown> = { total: () => SpriteLoader.total() };
    for (const [k, v] of Object.entries(parsed.fields)) state[k] = decode(v);
    return { fields: Object.keys(parsed.fields).sort(), methods: parsed.methods.sort(), text: statics(state as unknown as Statics) };
}

type Snapshot = {
    count: number;
    canvasWidth: number;
    height: number;
    xOffsets: Int32Array | null;
    yOffsets: Int32Array | null;
    widths: Int32Array | null;
    innerHeights: Int32Array | null;
    palette: Int32Array | null;
    pixels: (Uint8Array | null)[] | null;
    alphas: (Uint8Array | null)[] | null;
    hasAlpha: boolean[] | null;
    ids: Ids;
    cross: (AbstractSprite | null)[] | null;
    hintMapEdge: (AbstractSprite | null)[] | null;
    hitbarDefault: (AbstractSprite | null)[] | null;
    mapfunctionsRecoloured: (AbstractSprite | null)[] | null;
    scrollbars: (AbstractIndexedSprite | null)[] | null;
    pix2d: [Int32Array | null, number, number, number, number, number, number];
};

function snapshot(): Snapshot {
    const s = SpriteLoader;
    return {
        count: s.count,
        canvasWidth: s.canvasWidth,
        height: s.height,
        xOffsets: s.xOffsets,
        yOffsets: s.yOffsets,
        widths: s.widths,
        innerHeights: s.innerHeights,
        palette: s.palette,
        pixels: s.pixels,
        alphas: s.alphas,
        hasAlpha: s.hasAlpha,
        ids: { headiconsPkId: s.headiconsPkId, hitmarksId: s.hitmarksId, mapdotsGroupId: s.mapdotsGroupId, compassId: s.compassId, floorShadowsId: s.floorShadowsId },
        cross: s.cross,
        hintMapEdge: s.hintMapEdge,
        hitbarDefault: s.hitbarDefault,
        mapfunctionsRecoloured: s.mapfunctionsRecoloured,
        scrollbars: s.scrollbars,
        pix2d: [Pix2D.pixels, Pix2D.width, Pix2D.height, Pix2D.clipMinX, Pix2D.clipMinY, Pix2D.clipMaxX, Pix2D.clipMaxY]
    };
}

function restore(v: Snapshot): void {
    const s = SpriteLoader;
    s.count = v.count;
    s.canvasWidth = v.canvasWidth;
    s.height = v.height;
    s.xOffsets = v.xOffsets;
    s.yOffsets = v.yOffsets;
    s.widths = v.widths;
    s.innerHeights = v.innerHeights;
    s.palette = v.palette;
    s.pixels = v.pixels;
    s.alphas = v.alphas;
    s.hasAlpha = v.hasAlpha;
    s.headiconsPkId = v.ids.headiconsPkId;
    s.hitmarksId = v.ids.hitmarksId;
    s.mapdotsGroupId = v.ids.mapdotsGroupId;
    s.compassId = v.ids.compassId;
    s.floorShadowsId = v.ids.floorShadowsId;
    s.cross = v.cross;
    s.hintMapEdge = v.hintMapEdge;
    s.hitbarDefault = v.hitbarDefault;
    s.mapfunctionsRecoloured = v.mapfunctionsRecoloured;
    s.scrollbars = v.scrollbars;
    [Pix2D.pixels, Pix2D.width, Pix2D.height, Pix2D.clipMinX, Pix2D.clipMinY, Pix2D.clipMaxX, Pix2D.clipMaxY] = v.pix2d;
}

// The class's clinit values (checked against the fresh process and the fresh JVM below).
const CLINIT: Snapshot = {
    count: 0,
    canvasWidth: 0,
    height: 0,
    xOffsets: null,
    yOffsets: null,
    widths: null,
    innerHeights: null,
    palette: null,
    pixels: null,
    alphas: null,
    hasAlpha: null,
    ids: { headiconsPkId: 0, hitmarksId: 0, mapdotsGroupId: 0, compassId: 0, floorShadowsId: 0 },
    cross: null,
    hintMapEdge: null,
    hitbarDefault: null,
    mapfunctionsRecoloured: null,
    scrollbars: null,
    pix2d: [null, 0, 0, 0, 0, 0, 0]
};

// ---- script ----

type Frame = { w: number; h: number; flags: number; pixels: number[]; alphas: number[] };

// Writes the og.a format: frame data from 0 (flags byte, w*h index bytes, then w*h alpha bytes when flags & 2; column
// major when flags & 1), the palette (paletteSize - 1 three-byte entries), then the trailer: canvas width, canvas
// height, paletteSize - 1, the x offsets, y offsets, widths and heights of every frame and finally the frame count.
function encode(canvasW: number, canvasH: number, palette: number[], xOffs: number[], yOffs: number[], frames: Frame[]): Uint8Array {
    const out: number[] = [];
    for (const f of frames) {
        out.push(f.flags & 255);
        const put = (src: number[]) => {
            if ((f.flags & 1) === 0) {
                for (let i = 0; i < f.w * f.h; i++) out.push(src[i] & 255);
            } else {
                for (let x = 0; x < f.w; x++) for (let y = 0; y < f.h; y++) out.push(src[x + f.w * y] & 255);
            }
        };
        put(f.pixels);
        if ((f.flags & 2) !== 0) put(f.alphas);
    }
    for (const c of palette) out.push((c >> 16) & 255, (c >> 8) & 255, c & 255);
    const p2 = (v: number) => out.push((v >> 8) & 255, v & 255);
    p2(canvasW);
    p2(canvasH);
    out.push(palette.length & 255);
    for (const v of xOffs) p2(v);
    for (const v of yOffs) p2(v);
    for (const f of frames) p2(f.w);
    for (const f of frames) p2(f.h);
    p2(frames.length);
    return Uint8Array.from(out);
}

type SynthOptions = { frames: number; maxDim: number; paletteSize?: number; untrimmed?: boolean; flags?: number; alphaMode?: 'opaque' | 'mixed' | 'zero' };

function syntheticSprite(r: Rng, o: SynthOptions): Uint8Array {
    const paletteSize = o.paletteSize ?? (r.chance(6) ? 1 : r.chance(3) ? 256 : r.int(1, 256));
    const palette: number[] = [];
    for (let i = 1; i < paletteSize; i++) palette.push(r.chance(8) ? 0 : r.int(0, 0xffffff));
    const frames: Frame[] = [];
    const xOffs: number[] = [];
    const yOffs: number[] = [];
    const indexMax = r.chance(5) ? 255 : Math.max(paletteSize - 1, 0);
    let canvasW = r.int(0, 65535);
    let canvasH = r.int(0, 65535);
    for (let i = 0; i < o.frames; i++) {
        const w = !o.untrimmed && r.chance(12) ? 0 : r.int(1, o.maxDim);
        const h = !o.untrimmed && r.chance(12) ? 0 : r.int(1, o.maxDim);
        const flags = o.flags ?? r.pick([0, 1, 2, 3, 0, 1, 2, 3, 4, 7, 254, 255]);
        const mode = o.alphaMode ?? (r.chance(3) ? 'opaque' : 'mixed');
        const pixels: number[] = [];
        const alphas: number[] = [];
        for (let j = 0; j < w * h; j++) {
            pixels.push(r.chance(4) ? 0 : r.int(0, indexMax));
            alphas.push(mode === 'opaque' ? 255 : mode === 'zero' ? 0 : r.chance(3) ? 255 : r.int(0, 255));
        }
        frames.push({ w, h, flags, pixels, alphas });
        if (o.untrimmed) {
            // The frame fills the canvas: no offsets, canvas size = frame size.
            xOffs.push(0);
            yOffs.push(0);
            canvasW = w;
            canvasH = h;
        } else {
            xOffs.push(r.int(0, 70000) & 0xffff);
            yOffs.push(r.int(0, 70000) & 0xffff);
        }
    }
    return encode(canvasW, canvasH, palette, xOffs, yOffs, frames);
}

function mutate(r: Rng, src: Uint8Array): Uint8Array {
    const k = r.int(0, 5);
    if (k === 0) return src.slice(0, r.int(0, src.length));
    if (k === 1) return src.slice(r.int(0, Math.min(src.length, 20)));
    const out = src.slice();
    if (k === 2 || k === 3) {
        for (let n = r.int(1, 4); n > 0 && out.length > 0; n--) out[r.int(0, out.length - 1)] ^= 1 << r.int(0, 7);
    } else if (k === 4 && out.length >= 2) {
        const count = r.int(0, 12);
        out[out.length - 2] = count >> 8;
        out[out.length - 1] = count & 255;
    } else if (out.length >= 1) {
        out[r.int(Math.max(0, out.length - 30), out.length - 1)] = r.int(0, 255);
    }
    return out;
}

// Mirrors the decoder's trailer reads to keep the allocation sizes bounded.
function bounded(data: Uint8Array): boolean {
    const len = data.length;
    if (len < 2) return true;
    const count = (data[len - 2] << 8) | data[len - 1];
    const pos = len - 7 - 8 * count;
    if (pos < 0) return true;
    let total = 0;
    for (let i = 0; i < count; i++) {
        const wPos = pos + 5 + 4 * count + 2 * i;
        const hPos = pos + 5 + 6 * count + 2 * i;
        const product = Math.imul((data[hPos] << 8) | data[hPos + 1], (data[wPos] << 8) | data[wPos + 1]);
        if (product < 0) continue;
        if (product > MAX_FRAME) return false;
        total += product;
    }
    return total <= MAX_TOTAL;
}

// A loader op for group g in archive arch, with the group and file in the positions that loader takes them.
function loaderOp(loader: string, arch: string, group: number, file = 0): string {
    switch (loader) {
        case 'ja':
        case 'gi':
        case 'oh':
            return `ldr ${loader} ${arch} ${file} ${group}`;
        case 'ha':
        case 'ml':
        case 'nh':
        case 'qc':
        case 'wb':
        case 'fa':
            return `ldr ${loader} ${arch} ${group} ${file}`;
        default:
            return `ldr ${loader} ${arch} ${group}`;
    }
}

function generate(): { script: string[]; metricsFor: (g: number) => string } {
    const r = new Rng(0x5eed0b8 ^ 0x530);
    const s: string[] = ['clinit', 'statics', 'total'];

    // Archives 8 and 13 from the sector files. 8 serves the client's sprite archive; 108/208/308 are more al
    // instances over the same containers with the other discard-flag combinations.
    const index8 = readGroup(255, 8);
    const index13 = readGroup(255, 13);
    s.push(`idx 8 ${tBytes(index8)}`);
    const real = new Map<number, Uint8Array>();
    for (let g = 0; g < GROUPS_8; g++) {
        const c = readGroup(8, g);
        real.set(g, c);
        s.push(`grp 8 ${g} ${tBytes(c)}`);
    }
    s.push(`idx 13 ${tBytes(index13)}`);
    for (const g of FONT_GROUPS) s.push(`grp 13 ${g} ${tBytes(readGroup(13, g))}`);
    s.push('arch 8 8 0 1', 'arch 13 13 0 1', 'arch 108 8 1 0', 'arch 208 8 1 1', 'arch 308 8 0 0');

    // The metrics files, fetched once through a private Js5 so they can travel in the script as bytes.
    const metricsRunner = new Runner('');
    metricsRunner.run(['idx', '13', tBytes(index13)]);
    for (const g of FONT_GROUPS) metricsRunner.run(['grp', '13', String(g), tBytes(readGroup(13, g))]);
    metricsRunner.run(['arch', '13', '13', '0', '1']);
    const metricsArchive = requireNonNull(metricsRunner.archives.get(13) ?? null);
    const metricsCache = new Map<number, string>();
    const metricsFor = (g: number) => {
        let v = metricsCache.get(g);
        if (v === undefined) {
            v = tBytes(metricsArchive.GetFile(0, g));
            metricsCache.set(g, v);
        }
        return v;
    };
    const builderOp = (b: string, frame = 0) => (b === 'uk' ? `build uk ${frame}` : b === 'tf' ? `build tf ${r.chance(2) ? 'n' : metricsFor(r.pick(FONT_GROUPS))}` : `build ${b}`);

    // Group-id resolution (ld.a(Lal;I)V, g.a(ILal;)V, pf.a(Lal;I)V) and the clinit-to-loaded statics transition.
    s.push('names 8', 'statics', 'names 108');

    // Every archive-8 group: a rotating loader on a rotating archive instance, then ja.a + builder, then hl.a +
    // builder; every 50th group runs a builder again on the staging the first one cleared.
    const archs = ['8', '8', '108', '208', '308'];
    for (let g = 0; g < GROUPS_8; g++) {
        s.push(loaderOp(LOADERS[g % LOADERS.length], archs[g % archs.length], g));
        s.push(`ldr ja 8 0 ${g}`, builderOp(BUILDERS[(g * 7) % BUILDERS.length]));
        s.push(`ldr hl 8 ${g}`, builderOp(BUILDERS[(g * 5 + 3) % BUILDERS.length]));
        if (g % 50 === 0) s.push(builderOp(BUILDERS[g % BUILDERS.length]));
    }

    // The groups the client looks up by name, through every loader (and two names that resolve to nothing).
    for (const name of [...CLIENT_NAMES, 'no_such_sprite', 'mapdots_']) {
        for (const loader of LOADERS) s.push(`ldrn ${loader} 8 ${name}`);
        s.push(`ldrn ja 8 ${name}`, builderOp(r.pick(BUILDERS)));
    }

    // Stage 65 (si.a): the fonts through sb.a, and through ja.a + tf.a with and without the metrics file.
    for (const g of FONT_GROUPS) s.push(`font 8 13 ${g} 0`);
    s.push('font 8 13 494 1', 'font 8 13 1 0', 'font 8 n 494 0', 'font n 13 494 0', 'font 108 13 495 0', 'font 8 13 -1 0');
    for (const g of FONT_GROUPS) s.push(`ldr ja 8 0 ${g}`, `build tf ${metricsFor(g)}`, 'build tf n');
    s.push(`ldr ja 8 0 ${FONT_GROUPS[0]}`, 'build tf n', `build tf ${metricsFor(FONT_GROUPS[0])}`);

    // Stage 80 (uf.a): HUD arrays, then drawn. Three recolour draws, one on another archive instance, then a null
    // archive (NPE at the first load), then partly cleared HUD arrays drawn again.
    for (const arch of ['8', '108', '8']) {
        s.push(`stage80 ${arch} ${r.int(-10, 10)} ${r.int(-10, 10)} ${r.int(-20, 20)} ${r.int(-10, 10)}`, 'hud', 'drawhud 256 192', 'statics');
    }
    s.push('stage80 8 10 10 20 10', 'drawhud 300 200', 'stage80 8 -10 -10 -20 -10', 'drawhud 64 64');
    s.push('stage80 n 0 0 0 0', 'hud', 'hudset cross', 'hudset scroll', 'drawhud 128 96', 'hudset edge', 'hudset hitbar', 'hudset mapfn', 'hud', 'drawhud 16 16');

    // Loader edge cases: null archive, missing groups and files, out-of-range ids.
    for (const loader of LOADERS) {
        for (const [x, y] of [
            [0, 0],
            [5, 0],
            [0, 5],
            [1, 5],
            [5, 1],
            [-1, 0],
            [0, -1],
            [1706, 0],
            [0, 1706],
            [1707, 0],
            [0, 1707],
            [100000, 0],
            [0, 100000],
            [-2147483648, 0],
            [0, 2147483647]
        ]) {
            s.push(`ldr ${loader} 8 ${x} ${y}`, `ldr ${loader} n ${x} ${y}`);
        }
    }

    // Staging misuse on real data: a single-frame group (1), a multi-frame group (318, mapfunction), an alpha group
    // (802) and a font sheet (494).
    const drops = ['X', 'Y', 'W', 'H', 'P', 'pix', 'alp', 'has', 'pix0', 'alp0', 'pal1', 'has0', 'short 0', 'short 1', 'short 300'];
    for (const g of [1, 318, 802, 494]) {
        for (const d of drops) {
            for (const b of BUILDERS) s.push(`ldr ja 8 0 ${g}`, `drop ${d}`, b === 'tf' ? `build tf ${metricsFor(494)}` : builderOp(b, r.int(0, 2)));
        }
    }
    for (const q of [0, 1, 2, 5, 40, 300, -1]) {
        for (const b of BUILDERS) s.push('ldr ja 8 0 494', `drop q ${q}`, b === 'uk' ? `build uk ${q}` : b === 'tf' ? `build tf ${metricsFor(494)}` : `build ${b}`);
    }
    for (const frame of [-1, 0, 1, 2, 7, 255, 256]) s.push('ldr ja 8 0 318', `build uk ${frame}`);
    s.push('clear', 'build df', 'dec n', 'dec b', 'build ed', 'clear', 'total', 'statics');

    // Sizes whose int product overflows to a negative array length (NegativeArraySizeException in og.a and the builders).
    const p2 = (v: number) => [(v >> 8) & 255, v & 255];
    const trailer = (frames: number[][], head: number[] = []) =>
        Uint8Array.from([...head, ...p2(7), ...p2(9), 0, ...frames.flatMap(() => p2(1)), ...frames.flatMap(() => p2(2)), ...frames.flatMap(f => p2(f[0])), ...frames.flatMap(f => p2(f[1])), ...p2(frames.length)]);
    for (const frames of [
        [[65535, 65535]],
        [[46341, 46341]],
        [
            [2, 2],
            [65535, 40000]
        ],
        [
            [0, 0],
            [50000, 50000]
        ]
    ]) {
        const head = frames[0][0] === 2 ? [0, 0, 0, 0, 0] : frames[0][0] === 0 ? [0] : [];
        for (const b of ['df', 'ed', 'oc', 'p', 'pk', 'ud', 'qd', 'rk', 'vi', 'uk', 'tf']) s.push(`dec ${tBytes(trailer(frames, head))}`, b === 'uk' ? 'build uk 0' : b === 'tf' ? 'build tf n' : `build ${b}`);
    }

    // Synthetic files and mutated copies.
    const realSample = [0, 1, 2, 13, 100, 169, 299, 300, 305, 318, 494, 802, 1000, 1222, 1407, 1455, 1500];
    const sampleRunner = new Runner('');
    sampleRunner.run(['idx', '8', tBytes(index8)]);
    for (const g of realSample) sampleRunner.run(['grp', '8', String(g), tBytes(requireNonNull(real.get(g) ?? null))]);
    sampleRunner.run(['arch', '8', '8', '0', '1']);
    const sampleArchive = requireNonNull(sampleRunner.archives.get(8) ?? null);
    const realFiles = realSample.map(g => sampleArchive.GetFile(0, g) ?? new Uint8Array(0));

    const paletteSizes = [1, 2, 3, 16, 17, 128, 255, 256];
    let made = 0;
    while (made < SYNTHETIC_CASES) {
        let data: Uint8Array;
        const kind = r.int(0, 99);
        if (kind < 35) data = syntheticSprite(r, { frames: r.int(1, 6), maxDim: r.chance(4) ? 3 : 40 });
        else if (kind < 45) data = syntheticSprite(r, { frames: 1, maxDim: 24, untrimmed: true, paletteSize: r.pick(paletteSizes) });
        else if (kind < 52) data = syntheticSprite(r, { frames: r.int(1, 3), maxDim: 16, paletteSize: r.pick(paletteSizes), flags: r.pick([2, 3]), alphaMode: r.pick(['opaque', 'zero', 'mixed'] as const) });
        else if (kind < 57) data = syntheticSprite(r, { frames: r.int(2, 5), maxDim: 20, untrimmed: true, flags: r.pick([0, 1]) });
        else if (kind < 62) data = syntheticSprite(r, { frames: 256, maxDim: 3 });
        else if (kind < 85) data = mutate(r, syntheticSprite(r, { frames: r.int(1, 4), maxDim: 12 }));
        else data = mutate(r, r.pick(realFiles));
        if (!bounded(data)) continue;
        made++;
        s.push(`dec ${tBytes(data)}`);
        if (r.chance(10)) s.push(`drop ${r.pick(drops)}`);
        const builder = r.pick(BUILDERS);
        s.push(builder === 'uk' ? `build uk ${r.int(-1, 7)}` : builderOp(builder));
        if (r.chance(4)) s.push(builderOp(r.pick(BUILDERS.slice(0, 9))));
    }
    s.push('statics');

    return { script: s, metricsFor };
}

test('SpriteLoader matches client.jar', () => {
    using _groupState = preserveLoadingGroupIds();
    const fresh = freshStatics();

    // The port declares exactly the statics API.md assigns to SpriteLoader, and every method.
    expect(fresh.fields).toEqual([...FIELDS].sort());
    expect(fresh.methods).toEqual([...METHODS].sort());

    const { script } = generate();
    const incoming = snapshot();
    let ours: string[];
    try {
        restore(CLINIT);
        previous = new Array(11).fill(null);
        // After the reset the in-process statics read exactly as the fresh copy's.
        expect(statics(SpriteLoader)).toBe(fresh.text);
        const runner = new Runner(fresh.text);
        ours = script.map((line, i) => runner.execute(i, line));
    } finally {
        restore(incoming);
    }
    const theirs = runOracle(script.join('\n') + '\n');
    // SPRITELOADER_DUMP=<dir> writes both transcripts for inspection.
    const dump = process.env.SPRITELOADER_DUMP;
    if (dump) {
        writeFileSync(join(dump, 'spriteloader-ts.txt'), ours.join('\n') + '\n');
        writeFileSync(join(dump, 'spriteloader-java.txt'), theirs.join('\n') + '\n');
    }

    expect(theirs.length).toBe(ours.length);
    for (let i = 0; i < ours.length; i++) {
        if (ours[i] !== theirs[i]) {
            throw new Error(`mismatch at op ${i} "${script[i].slice(0, 160)}"\n  ts:   ${ours[i].slice(0, 3000)}\n  java: ${theirs[i].slice(0, 3000)}`);
        }
    }

    // Coverage: every outcome, every sprite class and every op kind is reached.
    const results = new Set(ours.map(line => line.split(' ')[2]));
    expect([...results].sort()).toEqual(['aioobe', 'neg', 'npe', 'ok']);
    const all = ours.join('\n');
    for (const tag of ['rh:', 'vh:', 'ch:', 'fg:', ',PC', ',XYWHM']) expect(all.includes(tag)).toBe(true);
    const field = (line: string, n: number) => line.split(' ')[n];
    const opsOf = (pred: (line: string) => boolean) => ours.filter((_, i) => pred(script[i]));
    // Every archive-8 group decodes through ja.a.
    expect(opsOf(l => /^ldr ja 8 0 \d+$/.test(l) && Number(l.split(' ')[4]) < GROUPS_8).filter(l => field(l, 3) === 'true').length).toBeGreaterThanOrEqual(GROUPS_8);
    // ld.a/g.a/pf.a resolve the client's names to the groups the cache index names.
    for (const line of opsOf(l => l.startsWith('names '))) expect(field(line, 3)).toBe('494,495,496,318,298,493,439,440,11,13,1222,299,300,316,1455,1243,169,14,1407,498,501');
    for (const line of opsOf(l => l.startsWith('ldrn '))) {
        const name = script[Number(field(line, 0))].split(' ')[3];
        expect(Number(field(line, 3).split('=')[0]) >= 0).toBe(CLIENT_NAMES.includes(name));
    }
    // The stage-80 runs on a real archive load every sprite family, and the HUD draw touches the framebuffer.
    for (const line of opsOf(l => /^stage80 \d/.test(l))) {
        expect(field(line, 2)).toBe('ok');
        expect(field(line, 3).split('/').slice(0, 11).includes('null')).toBe(false);
    }
    for (const line of opsOf(l => l.startsWith('drawhud '))) {
        const [, w, h] = script[Number(field(line, 0))].split(' ').map(Number);
        const [drawn, hash] = field(line, 3).split(':');
        if (drawn !== '0') expect(hash).not.toBe(ints(new Int32Array(w * h)).split(':')[1]);
    }
    const kinds = new Map<string, number>();
    for (const line of script) kinds.set(line.split(' ')[0], (kinds.get(line.split(' ')[0]) ?? 0) + 1);
    console.log(`spriteloader: ${ours.length} ops identical to client.jar (${[...kinds].map(([k, n]) => `${k} ${n}`).join(', ')})`);
}, 900000);
