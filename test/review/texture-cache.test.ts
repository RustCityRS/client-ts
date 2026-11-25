import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import BZip2Decompressor from '../../src/cache/BZip2Decompressor.js';
import BZip2State from '../../src/cache/BZip2State.js';
import ByteArrayCopier from '../../src/cache/ByteArrayCopier.js';
import Js5 from '../../src/cache/Js5.js';
import Js5Index from '../../src/cache/Js5Index.js';
import Js5ResourceProvider from '../../src/cache/Js5ResourceProvider.js';
import ColourImageCache from '../../src/dash3d/ColourImageCache.js';
import ColourImageCacheEntry from '../../src/dash3d/ColourImageCacheEntry.js';
import MonochromeImageCache from '../../src/dash3d/MonochromeImageCache.js';
import MonochromeImageCacheEntry from '../../src/dash3d/MonochromeImageCacheEntry.js';
import ProceduralTexture from '../../src/dash3d/ProceduralTexture.js';
import Texture from '../../src/dash3d/Texture.js';
import TextureCache from '../../src/dash3d/TextureCache.js';
import TextureOp from '../../src/dash3d/TextureOp.js';
import TextureOpEmboss from '../../src/dash3d/TextureOpEmboss.js';
import TextureOpKaleidoscope from '../../src/dash3d/TextureOpKaleidoscope.js';
import TextureOpPerlinNoise from '../../src/dash3d/TextureOpPerlinNoise.js';
import TextureOpSprite from '../../src/dash3d/TextureOpSprite.js';
import TextureOpVoronoiNoise from '../../src/dash3d/TextureOpVoronoiNoise.js';
import TextureShapeRaster from '../../src/dash3d/TextureShapeRaster.js';
import LruHashTable from '../../src/datastruct/LruHashTable.js';
import SecondaryNode from '../../src/datastruct/SecondaryNode.js';
import Crc32 from '../../src/io/Crc32.js';
import PacketT from '../../src/io/PacketT.js';
import { requireNonNull } from '../../src/util/JavaArray.js';
import { readGroup } from '../cachefile.js';
import { cachePath, gamepackPath } from '../reference.js';
import { SPRITE_LOADER, type StaticReset, withClinitStatics } from './staticState.js';

// The software texture cache (batch 6a) against client.jar: kg (TextureCache, src/dash3d/TextureCache.ts) and qi
// (Texture, src/dash3d/Texture.ts) with its member-map static nk.N (Texture.animBuffer).
// test/review/texture-cache/TextureCacheOracle.java (javac'd next to client.jar) runs the same script on the real
// gamepack classes. Both sides read archives 9 (texture programs), 26 (texture metadata) and 8 (sprites) through a real
// al/Js5 over a provider that serves the cache's sector files, so the jar's own jd programs, procedural operators and
// sprite decoders run on one side and Codex's native ones on the other; synthetic archives (served through the same
// al/Js5) add texture files and metadata the cache does not have. Any served group can be withheld, which makes the
// provider answer null as a group that is not downloaded yet does.
//
// One result line per operation: ok or the Java exception (the obfuscator's g wrapper unwrapped), the return value,
// then the state every op can touch: the LRU (vj.k) in queue (eviction) order with each node's key, identity, used
// flag (qi.P), brightness bits (qi.N), smooth/transpose flags and scroll speeds and its texel identity, the same table
// in hash order (the walk RunAnims makes), kg.J, the gamma table kg.x and wf.L, the bf size statics and normalised
// coordinate tables, gj.P, jf.o and nk.N. Arrays, textures and caches carry identity tags numbered in first-print
// order over the whole run, so a cache hit returning the same array, a rebuild, an eviction, a texture evicted while
// its own program builds a nested texture, and RunAnim's swap with nk.N are all compared as identities. Texel arrays
// print as length and two hashes (Arrays.hashCode and FNV-1a over every ARGB int); "anim" prints every cached
// texture's texels after the walk and "dump" also prints the other procedural statics. The first line prints the
// <clinit> state both sides start from.
//
// Inputs (about 20,000 ops):
// - the constructor's metadata columns (every id's flags, the four signed byte columns and the colours) for the real
//   cache, for synthetic metadata (flags other than 0/1, negative bytes, colours past 0x7fff, a count of 0, a
//   truncated file, random rows), for the wrong archive given as metadata, and for null archives; capacities 20, 50,
//   1, 2, 3, 5, 0 (the first put throws in vj) and -1 (never evicts);
// - GetTextureColour (every pc call-site constant), GetTextureSmall (low memory on and off), isAvailable and
//   GetTextureSolid for every id and the ids around the metadata bounds;
// - every texture of the cache: isLoaded, the uncached 1.0 texels (kg.c), and GetTextureData at 0.6, 0.7, 0.8, 0.9 and
//   1.0 (rotated per texture, so the gamma table each build starts from varies) and again at the last brightness (the
//   cached array), with low memory off and on (128x128 and forced 64x64), over a 20-entry LRU (nested textures are
//   built through kg.c and evict entries mid-build);
// - RunAnims over 40 cycles per pass for every scrolling texture (both sizes, the smoothed ones too) with tick counts
//   0, +-1..+-1000, 2^31-1 and -2^31, some textures not re-marked used between cycles, a low-memory switch mid-run
//   (nk.N is then longer than a 64x64 texture, which RunAnim hands it), and synthetic textures whose trailer sets every
//   scroll direction and speed up to -128/127, the smooth flag as 0/1/2/255 and the transpose flag as 0/1/2;
// - not-ready textures (missing and withheld sprites and nested textures, readiness lost after a build with
//   discarding archives), a nested texture past the metadata count (E[id] throws inside the outer build), truncated
//   and empty texture files and an unknown operator; brightness 0.0, -0.0, NaN, infinities, negatives and denormals;
// - seeded random sequences per capacity: hits, misses, evictions, ClearCache, setLowMemory, foreign (non-qi) nodes in
//   the LRU (GetTexture's and RunAnims' checkcasts) and textures injected under keys past the metadata; a kg.J set by
//   reflection (the SD client never sets it), which ClearCache and setLowMemory reset as well.
//
// TC_DUMP=<prefix> writes the script and both outputs; TC_STATS=1 prints per-op result counts.

type Statics = Record<string, unknown>;

// ---- dumps (TextureCacheOracle.tagId/arr/ref/...) ----

let tags = new WeakMap<object, number>();
let nextTag = 0;

function tagId(v: object): number {
    let id = tags.get(v);
    if (id === undefined) {
        id = nextTag++;
        tags.set(v, id);
    }
    return id;
}

function hash(a: ArrayLike<number>): number {
    let h = 1;
    for (let i = 0; i < a.length; i++) h = (Math.imul(31, h) + a[i]) | 0;
    return h;
}

function fnv(a: ArrayLike<number>): number {
    let h = 0x811c9dc5 | 0;
    for (let i = 0; i < a.length; i++) h = Math.imul(h ^ a[i], 0x01000193);
    return h;
}

// java.lang.String.hashCode.
function stringHash(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    return h;
}

function arr(a: Int32Array | null): string {
    if (a === null) return 'null';
    if (!(a instanceof Int32Array)) return `TYPE!${Object.prototype.toString.call(a)}`;
    return `#${tagId(a)}:${a.length}:${hash(a)}:${fnv(a)}`;
}

function ref(a: object | null | undefined): string {
    if (a === null || a === undefined) return 'null';
    if (a instanceof Int32Array) return `#${tagId(a)}:${a.length}`;
    return `#${tagId(a)}`;
}

function bools(a: boolean[]): string {
    if (!Array.isArray(a) || !a.every(b => typeof b === 'boolean')) return 'TYPE!';
    return a.map(b => (b ? '1' : '0')).join('');
}

function bytes(a: Int8Array): string {
    return a instanceof Int8Array ? `${a.length}:${hash(a)}` : 'TYPE!';
}

function shorts(a: Int16Array): string {
    return a instanceof Int16Array ? `${a.length}:${hash(a)}` : 'TYPE!';
}

const f32 = new Float32Array(1);
const i32 = new Int32Array(f32.buffer);
const f64 = new Float64Array(1);
const i64 = new BigInt64Array(f64.buffer);

// Float.floatToIntBits (NaN canonical).
function floatBits(v: number): number {
    if (Number.isNaN(v)) return 0x7fc00000;
    f32[0] = v;
    return i32[0];
}

function bitsFloat(bits: number): number {
    i32[0] = bits;
    return f32[0];
}

// Double.doubleToLongBits (NaN canonical).
function doubleBits(v: number): string {
    if (Number.isNaN(v)) return '9221120237041090560';
    f64[0] = v;
    return i64[0].toString();
}

function code(e: unknown): string {
    if (e instanceof RangeError) {
        if (e.message.startsWith('array index') || e.message.startsWith('byte array index') || e.message.startsWith('BZip2 array index')) return 'aioobe';
        if (e.message === '/ by zero') return 'arith';
        if (/^(Invalid typed array length|Invalid array length|length cannot be negative|Requested length is negative)/.test(e.message)) return 'nase';
    }
    if (e instanceof TypeError) {
        if (e.message.startsWith('ClassCastException')) return 'cce';
        if (e.message === 'Null reference' || e.message === 'Null array' || e.message === 'Null byte array') return 'npe';
    }
    return `error:${String(e)}`;
}

// ---- archives (TextureCacheOracle.Provider) ----

// The JS5 container without the two-byte version trailer the sector files keep after it.
function container(raw: Uint8Array): Uint8Array {
    const length = ((raw[1] << 24) | (raw[2] << 16) | (raw[3] << 8) | raw[4]) >>> 0;
    return raw.subarray(0, (raw[0] === 0 ? 5 : 9) + length);
}

// An uncompressed JS5 container around data.
function store(data: Uint8Array): Uint8Array {
    const out = new Uint8Array(5 + data.length);
    out[1] = data.length >>> 24;
    out[2] = data.length >>> 16;
    out[3] = data.length >>> 8;
    out[4] = data.length;
    out.set(data, 5);
    return out;
}

// A protocol-5 index without names: the given groups (ascending), each holding file 0 only.
function indexOf(groups: number[]): Uint8Array {
    const n = groups.length;
    const out = new Uint8Array(4 + n * 2 + n * 4 + n * 4 + n * 2 + n * 2);
    let pos = 0;
    out[pos++] = 5;
    out[pos++] = 0;
    out[pos++] = n >> 8;
    out[pos++] = n;
    let last = 0;
    for (const g of groups) {
        const delta = g - last;
        last = g;
        out[pos++] = delta >> 8;
        out[pos++] = delta;
    }
    pos += n * 8;
    for (let i = 0; i < n; i++) {
        out[pos++] = 0;
        out[pos++] = 1;
    }
    return out;
}

class Provider extends Js5ResourceProvider {
    private readonly table: Js5Index;
    readonly held = new Set<number>();

    constructor(
        private readonly archive: number,
        private readonly files: Map<number, Uint8Array> | null = null,
        groups: number[] = []
    ) {
        super();
        const src = files === null ? container(readGroup(cachePath, 255, archive)) : store(indexOf(groups));
        this.table = new Js5Index(src, Crc32.prefix(src, src.length));
    }

    index(): Js5Index | null {
        return this.table;
    }

    group(_mode: number, group: number): Uint8Array | null {
        if (this.held.has(group)) return null;
        if (this.files !== null) {
            const f = this.files.get(group);
            return f === undefined ? null : store(f);
        }
        return container(readGroup(cachePath, this.archive, group)).slice();
    }

    prefetchGroup(_group: number): void {}

    GetGroupLoadPercentage(_group: number): number {
        return 100;
    }
}

// ---- the TS side of each op (TextureCacheOracle.run) ----

const real: (Js5 | null)[] = [null, null, null];
const realProviders: (Provider | null)[] = [null, null, null];
const synthetic = new Map<number, Js5>();
const syntheticProviders = new Map<number, Provider>();
const caches: TextureCache[] = [];
let cache: TextureCache | null = null;

function reopen(): void {
    const ids = [9, 26, 8];
    for (let i = 0; i < 3; i++) {
        realProviders[i] = new Provider(ids[i]);
        real[i] = new Js5(realProviders[i], false, true);
    }
}

function archive(c: number): Js5 | null {
    if (c === 9) return real[0];
    if (c === 26) return real[1];
    if (c === 8) return real[2];
    if (c >= 100) return requireNonNull(synthetic.get(c - 100));
    if (c === -1) return null;
    throw new Error(`archive ${c}`);
}

function provider(c: number): Provider {
    if (c === 9) return requireNonNull(realProviders[0]);
    if (c === 26) return requireNonNull(realProviders[1]);
    if (c === 8) return requireNonNull(realProviders[2]);
    return requireNonNull(syntheticProviders.get(c - 100));
}

function archiveName(a: unknown): string {
    if (a === null || a === undefined) return 'null';
    for (let i = 0; i < 3; i++) if (a === real[i]) return ['T', 'M', 'S'][i];
    for (const [k, v] of synthetic) if (a === v) return `syn${k}`;
    return 'other';
}

function providerName(p: unknown): string {
    if (p === null || p === undefined) return 'null';
    const i = caches.indexOf(p as TextureCache);
    return i >= 0 ? `kg${i}` : 'other';
}

const fields = (v: object): Statics => v as unknown as Statics;

function lruFields(t: LruHashTable): { remaining: number; size: number } {
    const f = fields(t);
    return { remaining: f['remaining'] as number, size: f['m_cacheSize'] as number };
}

function meta(k: TextureCache): string {
    const f = fields(k);
    let s = '';
    s += ` h=${bools(f['exists'] as boolean[])}`;
    s += ` p=${bools(f['available'] as boolean[])}`;
    s += ` a=${bools(f['solid'] as boolean[])}`;
    s += ` E=${bools(f['small'] as boolean[])}`;
    s += ` i=${bools(f['flag4'] as boolean[])}`;
    s += ` d=${bytes(f['byte5'] as Int8Array)}`;
    s += ` m=${bytes(f['byte6'] as Int8Array)}`;
    s += ` g=${bytes(f['byte7'] as Int8Array)}`;
    s += ` c=${bytes(f['byte8'] as Int8Array)}`;
    s += ` t=${shorts(f['averageColour'] as Int16Array)}`;
    s += ` G=${f['lowMemory'] ? 1 : 0} q=${f['capacity'] as number}`;
    s += ` J=${ref(f['secondaryCache'] as object | null)} n=${archiveName(f['textures'])} C=${archiveName(f['sprites'])}`;
    const t = lruFields(f['recentUse'] as LruHashTable);
    s += ` k=${t.remaining}/${t.size}`;
    return s;
}

function texture(node: SecondaryNode, full: boolean): string {
    if (!(node instanceof Texture)) return `${node.key}:${ref(node)}:foreign`;
    const t = fields(node);
    const o = t['pixels'] as Int32Array | null;
    return `${node.key}:${ref(node)}:${node.used ? 1 : 0}:${floatBits(t['brightness'] as number)}:` + `${t['smooth'] ? 1 : 0}${t['transposed'] ? 1 : 0}:${t['scrollX'] as number},${t['scrollY'] as number}:${full ? arr(o) : ref(o)}`;
}

function queue(table: LruHashTable): SecondaryNode[] {
    const q = fields(fields(table)['queue'] as object);
    const sentinel = q['sentinel'] as SecondaryNode;
    const out: SecondaryNode[] = [];
    for (let n = requireNonNull(sentinel.secondaryNext); n !== sentinel; n = requireNonNull(n.secondaryNext)) out.push(n);
    return out;
}

function lru(full: boolean): string {
    if (cache === null) return 'nocache';
    const table = fields(cache)['recentUse'] as LruHashTable;
    const q = queue(table);
    const t = lruFields(table);
    let s = `lru=${q.length}/${t.remaining}/${t.size}`;
    if (full) {
        s += ' [';
        for (const n of q) s += texture(n, true) + ';';
        s += ']';
    } else {
        let h = 1;
        for (const n of q) h = (Math.imul(31, h) + stringHash(texture(n, false))) | 0;
        s += `:${h}`;
    }
    let order = '';
    let count = 0;
    for (let n = table.head(); n !== null; n = table.next()) {
        count++;
        order += `${n.key}${ref(n)},`;
    }
    s += ` ht=${count}:${full ? order : String(stringHash(order))}`;
    const second = fields(cache)['secondaryCache'] as LruHashTable | null;
    s += ` J=${ref(second)}`;
    if (second !== null) {
        const j = lruFields(second);
        s += `:${queue(second).length}/${j.remaining}/${j.size}`;
    }
    return s;
}

function statics(): string {
    const x = ProceduralTexture.gammaTable;
    let s = `x=${x === null ? 'null' : `${ref(x)}:${hash(x)}`}`;
    s += ` L=${doubleBits(ProceduralTexture.tableBrightness)}`;
    s += ` size=${TextureOp.width},${TextureOp.height},${TextureOp.widthMask},${TextureOp.heightMask},${TextureOp.sizeScale}`;
    s += ` nx=${arr(TextureOp.normalisedX)} ny=${arr(TextureOp.normalisedY)}`;
    s += ` P=${providerName(TextureOp.textureProvider)} o=${archiveName(TextureOpSprite.spriteArchive)}`;
    s += ` N=${ref(Texture.animBuffer)}`;
    return s;
}

function moreStatics(): string {
    let s = ` sin=${arr(TextureOp.sinTable)} cos=${arr(TextureOp.cosine)}`;
    const perm = TextureOp.permutationCache;
    if (perm === null) s += ' perm=null';
    else {
        const t = lruFields(perm);
        s += ` perm=${ref(perm)}:${queue(perm).length}/${t.remaining}/${t.size}`;
    }
    s += ` kal=${TextureOpKaleidoscope.sampleX},${TextureOpKaleidoscope.sourceRow}`;
    s += ` vor=${TextureOpVoronoiNoise.nearestDistance},${TextureOpVoronoiNoise.secondDistance},${TextureOpVoronoiNoise.thirdDistance},${TextureOpVoronoiNoise.fourthNearest}`;
    s += ' raster=';
    const raster = TextureShapeRaster.raster;
    if (raster === null) s += 'null';
    else {
        let hh = 1;
        for (const row of raster) hh = (Math.imul(31, hh) + (row === null ? 0 : (Math.imul(31, row.length) + hash(row)) | 0)) | 0;
        s += `${ref(raster)}:${raster.length}:${hh}`;
    }
    s += ` clip=${TextureShapeRaster.clipMinX},${TextureShapeRaster.clipMaxX},${TextureShapeRaster.clipTop},${TextureShapeRaster.clipMaxY}`;
    s += ` circle=${arr(TextureShapeRaster.circleWidths)} group=${TextureOpSprite.spriteGroupId}`;
    s += ` N=${arr(Texture.animBuffer)}`;
    return s;
}

function state(): string {
    return ` | ${lru(false)} | ${statics()}`;
}

function hex(s: string): Uint8Array {
    const out = new Uint8Array(s.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(s.substring(i * 2, i * 2 + 2), 16);
    return out;
}

function current(): TextureCache {
    return requireNonNull(cache);
}

function runOp(t: string[], n: number[]): string {
    switch (t[0]) {
        case 'init': {
            const emboss = requireNonNull(TextureOpEmboss.inverseNormalLength);
            const sentinels = `${ColourImageCache.residentSentinel !== null ? 1 : 0}${MonochromeImageCache.dummy !== null ? 1 : 0}`;
            return ` ${statics()}${moreStatics()} emboss=${emboss.length}:${hash(emboss)} fade=${arr(TextureOpPerlinNoise.fadeTable)} sentinels=${sentinels}`;
        }
        case 'reopen':
            reopen();
            return '';
        case 'syn': {
            const files = new Map<number, Uint8Array>();
            const groups: number[] = [];
            for (let i = 2; i < t.length; i++) {
                const [g, data] = t[i].split(':');
                groups.push(Number.parseInt(g, 10));
                if (data !== '-') files.set(Number.parseInt(g, 10), hex(data));
            }
            const p = new Provider(-1, files, groups);
            syntheticProviders.set(n[1], p);
            synthetic.set(n[1], new Js5(p, false, true));
            return '';
        }
        case 'flags': {
            // A fresh al over the same provider with the given discard flags.
            const p = provider(n[1]);
            const a = new Js5(p, n[2] !== 0, n[3] !== 0);
            if (n[1] === 9) real[0] = a;
            else if (n[1] === 26) real[1] = a;
            else if (n[1] === 8) real[2] = a;
            else synthetic.set(n[1] - 100, a);
            return '';
        }
        case 'hold': {
            const p = provider(n[1]);
            if (n[3] !== 0) p.held.add(n[2]);
            else p.held.delete(n[2]);
            return '';
        }
        case 'new': {
            cache = null;
            const k = new TextureCache(archive(n[1]), archive(n[2]), archive(n[3]), n[4], n[5] !== 0);
            caches.push(k);
            cache = k;
            return ` kg${caches.length - 1}${meta(k)}`;
        }
        case 'colour':
        case 'colour2':
            return ` ${current().getTextureColour(n[1])}`;
        case 'small':
            return ` ${current().getTextureSmall(n[1]) ? 1 : 0}`;
        case 'avail':
            return ` ${current().isAvailable(n[1]) ? 1 : 0}`;
        case 'solid':
            return ` ${current().getTextureSolid(n[1]) ? 1 : 0}`;
        case 'loaded':
            return ` ${current().isLoaded(n[1]) ? 1 : 0}`;
        case 'pix':
            return ` ${arr(current().getPixels(n[1]))}`;
        case 'data':
            return ` ${arr(current().getTextureData(n[1], bitsFloat(n[2])))}`;
        case 'anim': {
            const k = current();
            k.RunAnims(n[1]);
            let s = ' ';
            for (const node of queue(fields(k)['recentUse'] as LruHashTable)) s += texture(node, true) + ';';
            return `${s} N=${arr(Texture.animBuffer)}`;
        }
        case 'low':
            current().setLowMemory(n[1] !== 0);
            return '';
        case 'clear':
            current().ClearCache();
            return '';
        case 'foreign':
            (fields(current())['recentUse'] as LruHashTable).Put(BigInt(n[1]), new SecondaryNode());
            return '';
        case 'second': {
            const k = current();
            const second = new LruHashTable(n[1]);
            for (let i = 0; i < n[2]; i++) second.Put(BigInt(i), new SecondaryNode());
            fields(k)['secondaryCache'] = second;
            return '';
        }
        case 'inject': {
            const k = current();
            const textures = fields(k)['textures'] as Js5 | null;
            const tex = new Texture(new PacketT(requireNonNull(textures).GetFile(0, n[1])));
            (fields(k)['recentUse'] as LruHashTable).Put(BigInt(n[2]), tex);
            return ` ${ref(tex)}`;
        }
        case 'dump':
            return ` ${lru(true)} |${moreStatics()}`;
        default:
            throw new Error(`bad op ${t[0]}`);
    }
}

function runTs(script: string[]): string[] {
    tags = new WeakMap();
    nextTag = 0;
    caches.length = 0;
    synthetic.clear();
    syntheticProviders.clear();
    cache = null;
    reopen();
    const out: string[] = [];
    for (const line of script) {
        const t = line.split(' ');
        const n = t.map((s, i) => (i === 0 || (t[0] === 'syn' && i > 1) ? 0 : Number.parseInt(s, 10)));
        let result: string;
        try {
            result = 'ok' + runOp(t, n);
        } catch (e) {
            if (e instanceof Error && (e.message.startsWith('bad op') || e.message.startsWith('archive '))) throw e;
            result = code(e);
        }
        out.push(result + state());
    }
    return out;
}

// ---- static state: the fresh-JVM values of everything the script touches ----

function resets(): StaticReset[] {
    return [
        // nk.N.
        { target: Texture, clinit: { animBuffer: null } },
        // kg.x (new int[256]) and wf.L (-1.0).
        { target: ProceduralTexture, clinit: { gammaTable: new Int32Array(256), tableBrightness: -1.0 } },
        // hf.I, g.k, kl.Eb, vi.hb, j.b, vg.U, cf.h, h.e, c.t, vb.e (new vj(16)) and gj.P.
        {
            target: TextureOp,
            clinit: {
                width: 0,
                height: 0,
                widthMask: 0,
                heightMask: 0,
                sizeScale: 0,
                normalisedX: null,
                normalisedY: null,
                sinTable: null,
                cosine: null,
                permutationCache: new LruHashTable(16),
                textureProvider: null
            }
        },
        // hg.a and jf.o.
        { target: TextureOpSprite, clinit: { spriteGroupId: -1, spriteArchive: null } },
        // kk.cb, ik.ab; b.O, bh.i, u.k, jk.G; we.z, wa.j, gg.I, ia.m, sf.d, vg.Y.
        { target: TextureOpKaleidoscope, clinit: { sampleX: 0, sourceRow: 0 } },
        { target: TextureOpVoronoiNoise, clinit: { nearestDistance: 0, secondDistance: 0, thirdDistance: 0, fourthNearest: 0 } },
        { target: TextureShapeRaster, clinit: { raster: null, clipMinX: 0, clipMaxX: 100, clipTop: 0, clipMaxY: 100, circleWidths: null } },
        // lh.c (new c(0, 0)) and ri.R (new lc(0, 0)): the image caches' empty-row markers.
        { target: ColourImageCache, clinit: { residentSentinel: new ColourImageCacheEntry(0, 0) } },
        { target: MonochromeImageCache, clinit: { dummy: new MonochromeImageCacheEntry(0, 0) } },
        // The sprite decoder's scratch (ja/og/pk/df/tf/ed), and the JS5 reads: vc.J, ce.K, pj.P, rd.a, ij.d.
        SPRITE_LOADER(),
        { target: Js5, clinit: { strictValidation: false, maxContainerSize: 0 } },
        { target: ByteArrayCopier, clinit: { directBufferUnavailable: false } },
        { target: BZip2Decompressor, clinit: { state: new BZip2State(), block: null } }
    ];
}

// ---- oracle ----

function runOracle(script: string[]): string[] {
    const outDir = resolve(import.meta.dir, '../../out');
    mkdirSync(outDir, { recursive: true });
    const scratch = mkdtempSync(join(outDir, 'texture-cache-oracle-'));
    try {
        const source = fileURLToPath(new URL('./texture-cache/TextureCacheOracle.java', import.meta.url));
        const build = Bun.spawnSync(['javac', '-nowarn', '-cp', gamepackPath, '-d', scratch, source]);
        if (build.exitCode !== 0) throw new Error(`javac failed: ${build.stderr.toString()}`);
        const run = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-Xmx2g', '-cp', gamepackPath + delimiter + scratch, 'TextureCacheOracle', cachePath], {
            stdin: Buffer.from(script.join('\n') + '\n'),
            maxBuffer: 512 * 1024 * 1024,
            timeout: 280000
        });
        if (run.exitCode !== 0) throw new Error(`TextureCacheOracle exited ${run.exitCode}: ${run.stderr.toString().slice(0, 4000)}`);
        const lines = run.stdout.toString().split(/\r?\n/);
        if (lines[lines.length - 1] === '') lines.pop();
        return lines;
    } finally {
        rmSync(scratch, { recursive: true, force: true });
    }
}

// ---- inputs ----

// Seeded LCG (java.util.Random's constants) for the script.
class Lcg {
    private seed: bigint;
    constructor(seed: number) {
        this.seed = (BigInt(seed) ^ 0x5deece66dn) & ((1n << 48n) - 1n);
    }
    next(bits: number): number {
        this.seed = (this.seed * 0x5deece66dn + 0xbn) & ((1n << 48n) - 1n);
        return Number(BigInt.asIntN(32, this.seed >> BigInt(48 - bits)));
    }
    int(bound: number): number {
        return (((this.next(31) % bound) + bound) % bound) | 0;
    }
    pick<T>(values: readonly T[]): T {
        return values[this.int(values.length)];
    }
}

const fb = (v: number): number => floatBits(Math.fround(v));
const BRIGHTNESS = [0.6, 0.7, 0.8, 0.9, 1.0].map(fb);
const SPECIAL = [0.0, -0.0, NaN, 0.5, 1.5, 2.0, Infinity, -Infinity, -1.0, 1e-30, 0.75, 3.4028234663852886e38, 1.401298464324817e-45].map(fb);
const TICKS = [1, 2, 3, -1, -2, 5, 0, 17, 64, 127, 128, 129, -128, 1000, -1000, 65536, 2147483647, -2147483648, 4096, 16384, 7, -3];

interface Info {
    file: Uint8Array;
    scrollX: number;
    scrollY: number;
    smooth: boolean;
    transposed: boolean;
    sprites: number[];
    textures: number[];
}

const toHex = (b: Uint8Array): string => Buffer.from(b).toString('hex');

// A texture file: the given program, then qi's nine trailer bytes (smooth, transpose, three ignored, scroll x, scroll
// y, two ignored).
function withTrailer(program: Uint8Array, smooth: number, transposed: number, scrollX: number, scrollY: number, filler: number): Uint8Array {
    const out = new Uint8Array(program.length + 9);
    out.set(program);
    out.set([smooth, transposed, filler & 255, (filler >> 8) & 255, (filler >> 16) & 255, scrollX & 255, scrollY & 255, (filler >> 3) & 255, (filler >> 11) & 255], program.length);
    return out;
}

// A one-operator program: la (type 39, a sprite) or fk (type 36, a nested texture), both without inputs; then the
// colour and alpha operator indices.
function singleOp(type: number, id: number): Uint8Array {
    return Uint8Array.of(1, 0, type, 255, 1, 0, (id >> 8) & 255, id & 255, 0, 0);
}

function generate(): string[] {
    const textureProvider = new Provider(9);
    const textures = new Js5(textureProvider, false, true);
    const metaArchive = new Js5(new Provider(26), false, true);
    const groups = Array.from(requireNonNull(requireNonNull(textureProvider.index()).groupIds));
    const meta = new PacketT(requireNonNull(metaArchive.GetFile(0, 0)));
    const count = meta.g2();
    const existsCol = Array.from({ length: count }, () => meta.g1() === 1);
    const skipped = existsCol.filter(Boolean).length;
    meta.m_pos += 2 * skipped; // available, solid
    const smallCol = existsCol.map(e => (e ? meta.g1() === 1 : false));

    // Script inputs only: which textures scroll, are smoothed or read sprites/nested textures. Read from the files
    // without qi's port (every file is the jd program followed by qi's nine trailer bytes), so a fault in Texture.ts
    // cannot change the script.
    const info = new Map<number, Info>();
    for (const id of groups) {
        const file = requireNonNull(textures.GetFile(0, id));
        const packet = new PacketT(file);
        const proc = fields(new ProceduralTexture(packet));
        if (packet.m_pos !== file.length - 9) throw new Error(`texture ${id}: ${file.length - packet.m_pos} trailer bytes`);
        const end = file.length;
        info.set(id, {
            file,
            scrollX: (file[end - 4] << 24) >> 24,
            scrollY: (file[end - 3] << 24) >> 24,
            smooth: file[end - 9] === 1,
            transposed: file[end - 8] === 1,
            sprites: Array.from(proc['spriteIds'] as Int32Array),
            textures: Array.from(proc['textureIds'] as Int32Array)
        });
    }
    const get = (id: number): Info => requireNonNull(info.get(id));
    const animated = groups.filter(id => get(id).scrollX !== 0 || get(id).scrollY !== 0);
    const smooth = groups.filter(id => get(id).smooth);
    const plain = groups.filter(id => get(id).sprites.length === 0 && get(id).textures.length === 0);
    const withSprite = groups.filter(id => get(id).sprites.length > 0 && get(id).textures.length === 0);
    const nested = groups.filter(id => get(id).textures.length > 0);
    if (animated.length < 8 || smooth.length < 8 || withSprite.length < 8 || nested.length < 50) throw new Error('unexpected texture archive');

    const s: string[] = [];
    const random = new Lcg(530);
    const ids = [-2147483648, -2, -1, ...Array.from({ length: count + 2 }, (_, i) => i), 65535, 2147483647];

    // ---- 1. metadata and the per-id queries ----
    s.push('init', 'new 9 26 8 50 0');
    for (const id of ids) s.push(`colour ${id}`, `small ${id}`, `avail ${id}`, `solid ${id}`);
    for (const id of [0, 1, 300, count - 1, count, -1]) for (const c of [-124, -120, -118, -125, -121]) s.push(`colour2 ${id} ${c}`);
    s.push('low 1');
    for (const id of ids) s.push(`small ${id}`);
    s.push('low 0', 'dump');

    // ---- 2. every texture at every brightness, both sizes ----
    for (const low of [0, 1]) {
        s.push(`new 9 26 8 20 ${low}`);
        for (let i = 0; i < count; i++) {
            const id = groups[i] ?? i;
            s.push(`loaded ${id}`, `pix ${id}`);
            for (let b = 0; b < 5; b++) s.push(`data ${id} ${BRIGHTNESS[(i + b) % 5]}`);
            s.push(`data ${id} ${BRIGHTNESS[(i + 4) % 5]}`);
            if (low === 1) s.push(`small ${id}`);
            if (i % 23 === 22) s.push(`anim ${TICKS[((i / 23) % TICKS.length) | 0]}`);
            if (i % 97 === 96) s.push('dump');
        }
        for (const id of [count, count + 1, 65535, -1, -2147483648]) s.push(`loaded ${id}`, `pix ${id}`, `data ${id} ${BRIGHTNESS[1]}`);
        s.push('dump');
    }

    // ---- 3. RunAnims over many cycles: every scrolling texture and some smoothed ones ----
    const animTargets = [...animated, ...smooth.slice(0, 4)];
    for (const low of [0, 1]) {
        s.push(`new 9 26 8 50 ${low}`);
        for (const id of animTargets) s.push(`data ${id} ${fb(0.8)}`);
        s.push('dump');
        for (let c = 0; c < 40; c++) {
            s.push(`anim ${TICKS[c % TICKS.length]}`);
            animTargets.forEach((id, j) => {
                if ((c + j) % 3 !== 0) s.push(`data ${id} ${(c + j) % 11 === 0 ? fb(0.9) : fb(0.8)}`);
            });
            if (c % 8 === 7) s.push('dump');
            // The low-memory switch mid-run: nk.N stays 16384 long while the textures become 64x64.
            if (c === 20) {
                s.push(`low ${1 - low}`);
                for (const id of animTargets) s.push(`data ${id} ${fb(0.8)}`);
            }
        }
        s.push('dump');
    }

    // ---- 4. synthetic texture files ----
    const smallKeys = groups.filter(id => smallCol[id]);
    const bigKeys = groups.filter(id => !smallCol[id]);
    // Trailers: [smooth, transpose, scroll x, scroll y].
    const trailers: [number, number, number, number][] = [
        [0, 0, 0, 0],
        [1, 0, 0, 0],
        [2, 0, 0, 0],
        [255, 0, 1, 0],
        [0, 1, 0, 0],
        [0, 2, 0, 1],
        [1, 1, -1, 0],
        [0, 0, 0, -1],
        [0, 0, 5, -7],
        [0, 0, 127, -128],
        [0, 0, -128, 127],
        [1, 0, 64, 64],
        [0, 1, -3, 2],
        [0, 0, 1, 1],
        [1, 1, 2, -2],
        [0, 0, -64, 0]
    ];
    const program = (id: number): Uint8Array => get(id).file.subarray(0, get(id).file.length - 9);
    const sources = [plain[0], plain[3], withSprite[0], plain[6], requireNonNull(smooth.find(id => get(id).textures.length === 0))];
    const synFiles = new Map<number, Uint8Array | null>();
    const synKeys: number[] = [];
    trailers.forEach(([q, t, x, y], i) => {
        for (const keys of [smallKeys, bigKeys]) {
            const key = keys[3 + i];
            synFiles.set(key, withTrailer(program(sources[i % sources.length]), q, t, x, y, random.int(1 << 24)));
            synKeys.push(key);
        }
    });
    // Nested references and not-ready textures, under keys chosen below the metadata count.
    const free = groups.filter(id => !synFiles.has(id));
    const [kSprite, kSprite0, kMissingSprite, kRefOk, kRefMissing, kRefHeld, kRefPast, kChain, kHeld, kTrunc1, kTrunc9, kEmpty, kBadOp, kNoOps, kRefTrunc] = free.slice(40, 55);
    const missingTexture = free[60];
    synFiles.set(kSprite, withTrailer(singleOp(39, withSprite.length > 0 ? get(withSprite[0]).sprites[0] : 0), 0, 0, 0, 1, 7));
    synFiles.set(kSprite0, withTrailer(singleOp(39, 0), 0, 0, 0, 0, 9));
    synFiles.set(kMissingSprite, withTrailer(singleOp(39, 65000), 0, 0, 0, 0, 11));
    synFiles.set(kRefOk, withTrailer(singleOp(36, synKeys[0]), 1, 0, 2, 0, 13));
    synFiles.set(kRefMissing, withTrailer(singleOp(36, missingTexture), 0, 0, 0, 0, 15));
    synFiles.set(kRefHeld, withTrailer(singleOp(36, kHeld), 0, 0, 0, 0, 17));
    synFiles.set(kRefPast, withTrailer(singleOp(36, count + 20), 0, 0, 0, 0, 19));
    synFiles.set(count + 20, withTrailer(program(plain[1]), 0, 0, 1, 0, 21));
    synFiles.set(kChain, withTrailer(singleOp(36, kRefOk), 0, 1, 0, -1, 23));
    synFiles.set(kHeld, withTrailer(program(plain[2]), 0, 0, 0, 0, 25));
    synFiles.set(kTrunc1, get(plain[4]).file.subarray(0, get(plain[4]).file.length - 1));
    synFiles.set(kTrunc9, program(plain[4]));
    synFiles.set(kEmpty, new Uint8Array(0));
    synFiles.set(kBadOp, withTrailer(Uint8Array.of(1, 0, 99, 255, 0, 0, 0), 0, 0, 0, 0, 27));
    synFiles.set(kNoOps, withTrailer(Uint8Array.of(0, 0, 0), 0, 0, 0, 0, 29));
    synFiles.set(kRefTrunc, withTrailer(singleOp(36, kTrunc1), 0, 0, 0, 0, 31));
    const synGroups = [...synFiles.keys(), kHeld].filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b);
    const synLine = (k: number): string => `syn ${k} ` + synGroups.map(g => `${g}:${toHex(requireNonNull(synFiles.get(g)))}`).join(' ');
    s.push(synLine(0), `hold 100 ${kHeld} 1`);
    const synAll = [...synKeys, kSprite, kSprite0, kMissingSprite, kRefOk, kRefMissing, kRefHeld, kRefPast, count + 20, kChain, kHeld, kTrunc1, kTrunc9, kEmpty, kBadOp, kNoOps, kRefTrunc];
    for (const low of [0, 1]) {
        s.push(`new 100 26 8 50 ${low}`);
        for (const id of synAll) s.push(`loaded ${id}`, `pix ${id}`, `data ${id} ${fb(0.7)}`, `data ${id} ${fb(0.7)}`, `data ${id} ${fb(0.9)}`);
        s.push('dump');
        const scrolling = [...synKeys, kSprite, kRefOk, kChain];
        for (let c = 0; c < 16; c++) {
            s.push(`anim ${TICKS[(c * 5) % TICKS.length]}`);
            scrolling.forEach((id, j) => {
                if ((c + j) % 4 !== 1) s.push(`data ${id} ${fb(0.9)}`);
            });
            if (c % 5 === 4) s.push('dump');
        }
    }
    // Eviction mid-build: the outer texture's nested texture (and its nested texture) push it out of a small LRU.
    for (const cap of [1, 2, 3]) {
        s.push(`new 100 26 8 ${cap} 0`);
        for (const id of [kChain, kRefOk, kChain, synKeys[0], kChain, kRefOk]) s.push(`data ${id} ${fb(0.8)}`, 'anim 1');
        s.push('dump');
    }
    // Readiness that changes: withheld groups served later, and a fresh discarding archive losing a sprite after a build.
    s.push(synLine(1), `hold 101 ${kHeld} 1`, `hold 101 ${synKeys[0]} 1`, 'new 101 26 8 20 0', `loaded ${kRefHeld}`, `data ${kRefHeld} ${fb(0.7)}`, `loaded ${kRefOk}`, `data ${kRefOk} ${fb(0.7)}`);
    s.push(`hold 101 ${kHeld} 0`, `hold 101 ${synKeys[0]} 0`);
    s.push(`loaded ${kRefHeld}`, `data ${kRefHeld} ${fb(0.7)}`, `loaded ${kRefOk}`, `data ${kRefOk} ${fb(0.7)}`, 'dump');
    const spriteUser = withSprite[1];
    const sprite = get(spriteUser).sprites[0];
    s.push('reopen', 'flags 8 1 1', 'new 9 26 8 20 0', `data ${spriteUser} ${fb(0.7)}`, `hold 8 ${sprite} 1`, `loaded ${spriteUser}`);
    s.push(`data ${spriteUser} ${fb(0.8)}`, `data ${spriteUser} ${fb(0.7)}`, `pix ${spriteUser}`, 'dump', `hold 8 ${sprite} 0`, `data ${spriteUser} ${fb(0.8)}`, 'dump');
    const child = get(nested[5]).textures[0];
    s.push(`hold 9 ${child} 1`, 'flags 9 1 1', 'new 9 26 8 20 0', `loaded ${nested[5]}`, `data ${nested[5]} ${fb(0.7)}`, `hold 9 ${nested[5]} 1`);
    s.push(`hold 9 ${child} 0`, `data ${nested[5]} ${fb(0.7)}`, `hold 9 ${nested[5]} 0`, `loaded ${nested[5]}`, `data ${nested[5]} ${fb(0.7)}`, 'dump', 'reopen');

    // ---- 5. brightness edges ----
    s.push('new 9 26 8 50 0');
    const edgeIds = [plain[5], smooth[2], nested[1], withSprite[2], animated[0]];
    for (const bits of SPECIAL) {
        for (const id of edgeIds) s.push(`data ${id} ${bits}`);
        s.push(`data ${edgeIds[0]} ${bits}`, 'anim 1');
    }
    for (const bits of [fb(0.0), fb(-0.0), fb(0.0), 0x7fc00000, 0x7fc00000, fb(0.7), fb(0.7), fb(-0.0)]) s.push(`data ${edgeIds[1]} ${bits}`, `data ${edgeIds[2]} ${bits}`);
    s.push('dump');

    // ---- 6. random sequences per capacity ----
    const missing = [count, count + 1, 65535, -1];
    const cheap = [...plain.slice(0, 40), ...withSprite.slice(0, 10), ...nested.slice(0, 20), ...animated, ...smooth.slice(0, 6)];
    for (const [capacity, low] of [
        [3, 0],
        [20, 0],
        [1, 0],
        [2, 1],
        [50, 0],
        [5, 1],
        [-1, 0],
        [20, 1]
    ] as const) {
        s.push(`new 9 26 8 ${capacity} ${low}`);
        const working = Array.from({ length: Math.min(cheap.length, Math.max(4, capacity) * 2 + 4) }, () => random.pick(cheap));
        working.push(random.pick(missing));
        for (let k = 0; k < 220; k++) {
            const roll = random.int(100);
            const id = random.pick(working);
            if (roll < 45) {
                const bits = random.int(8) === 0 ? random.pick(SPECIAL) : random.pick(BRIGHTNESS);
                s.push(`data ${id} ${bits}`);
            } else if (roll < 56) s.push(`anim ${random.pick(TICKS)}`);
            else if (roll < 62) s.push(`pix ${id}`);
            else if (roll < 67) s.push(`loaded ${id}`);
            else if (roll < 71) s.push(`small ${id}`, `avail ${id}`, `solid ${id}`, `colour ${id}`);
            else if (roll < 74) s.push(`low ${random.int(2)}`);
            else if (roll < 76) s.push('clear');
            else if (roll < 78) s.push(`foreign ${random.pick(working)}`);
            else if (roll < 80) s.push(`inject ${random.pick(cheap)} ${random.pick([count, count + 5, 70000, random.pick(working)])}`);
            else if (roll < 82) s.push('dump');
            else s.push(`data ${id} ${BRIGHTNESS[1]}`);
        }
        s.push('dump');
    }
    // kg.J present (the SD client never sets it): ClearCache and setLowMemory reset it too.
    s.push('new 9 26 8 4 0', `data ${plain[0]} ${BRIGHTNESS[1]}`, 'second 4 3', 'dump', 'clear', 'dump', 'second 2 5', 'low 1', 'dump', 'second 0 0', 'clear', 'second 3 1', 'low 0');
    // A capacity of 0: the first put finds no node to evict.
    s.push('new 9 26 8 0 0', `data ${plain[0]} ${BRIGHTNESS[1]}`, `loaded ${plain[0]}`, `pix ${plain[0]}`, `colour ${plain[0]}`, 'anim 1', 'dump');
    // Checkcasts: a non-qi node hit by GetTexture, and met by RunAnims after and before used textures.
    s.push('new 9 26 8 8 0', `data ${plain[0]} ${BRIGHTNESS[1]}`, `foreign ${plain[1]}`, `data ${plain[2]} ${BRIGHTNESS[1]}`, 'dump');
    s.push(`data ${plain[1]} ${BRIGHTNESS[1]}`, `loaded ${plain[1]}`, `pix ${plain[1]}`, 'anim 1', 'dump', 'clear', `data ${plain[1]} ${BRIGHTNESS[1]}`, 'anim 1', 'dump');
    // Injected textures past the metadata: GetTextureData sets the used flag before E[id] throws; low memory skips it.
    s.push('new 9 26 8 8 0', `inject ${animated[0]} ${count}`, `data ${count} ${BRIGHTNESS[2]}`, 'dump', 'anim 1', 'dump', `pix ${count}`, `loaded ${count}`);
    s.push('low 1', `inject ${animated[0]} ${count}`, `data ${count} ${BRIGHTNESS[2]}`, `pix ${count}`, 'anim 3', 'dump', 'low 0');

    // ---- 7. other archives as metadata, synthetic metadata, null archives ----
    s.push('new 9 9 8 20 0', 'new 9 8 8 20 0');
    const metaFiles: Uint8Array[] = [];
    metaFiles.push(Uint8Array.of(0, 0));
    // count 5: flags 1/0/2/1/255 (only 1 exists), then two rows of every column: flag bytes 1/2, 0/1, 1/0, 2/1, signed bytes
    // -128/127, 255/0, 1/-1, 66/-126, colours 0x8000 and 0xffff.
    metaFiles.push(Uint8Array.of(0, 5, 1, 0, 2, 1, 255, 1, 2, 0, 1, 1, 0, 2, 1, 128, 127, 255, 0, 1, 255, 66, 130, 0x80, 0x00, 0xff, 0xff));
    metaFiles.push(Uint8Array.of(0, 3, 1, 1, 1, 1, 1, 1, 0, 0));
    {
        const rows = 700;
        const flags = Array.from({ length: rows }, () => random.pick([0, 1, 1, 1, 2]));
        const body: number[] = [rows >> 8, rows & 255, ...flags];
        const live = flags.filter(f => f === 1).length;
        for (let col = 0; col < 4; col++) for (let i = 0; i < live; i++) body.push(random.pick([0, 1, 1, 2, 255]));
        for (let col = 0; col < 4; col++) for (let i = 0; i < live; i++) body.push(random.int(256));
        for (let i = 0; i < live * 2; i++) body.push(random.int(256));
        metaFiles.push(Uint8Array.from(body));
    }
    metaFiles.forEach((file, i) => {
        s.push(`syn ${10 + i} 0:${toHex(file)}`, `new 9 ${110 + i} 8 20 0`);
        for (const id of [-1, 0, 1, 2, 3, 4, 5, 6, 300, 699, 700]) s.push(`colour ${id}`, `small ${id}`, `avail ${id}`, `solid ${id}`, `data ${id} ${BRIGHTNESS[0]}`);
        s.push('low 1', `data 4 ${BRIGHTNESS[0]}`, 'small 4', 'anim 2', 'dump');
    });
    s.push(`syn 20 1:${toHex(metaFiles[1])}`, 'new 9 120 8 20 0', 'syn 21 0:-', 'new 9 121 8 20 0');
    s.push('new -1 26 8 20 0', 'colour 0', 'small 0', `data ${plain[0]} ${BRIGHTNESS[0]}`, `loaded ${plain[0]}`, `pix ${plain[0]}`, 'anim 1', 'inject 0 0', 'dump');
    s.push('new 9 -1 8 20 0', 'colour 0', 'dump');
    s.push('new 9 26 -1 20 0', `data ${plain[0]} ${BRIGHTNESS[0]}`, `data ${withSprite[0]} ${BRIGHTNESS[0]}`, `loaded ${withSprite[0]}`, `pix ${withSprite[0]}`, `data ${nested[0]} ${BRIGHTNESS[0]}`, 'dump');
    s.push('new 9 26 8 20 0', 'dump');
    return s;
}

test('Texture and TextureCache declare exactly the fields of qi and kg', () => {
    const { own, keys } = withClinitStatics(resets(), () => {
        const textures = new Js5(new Provider(9), false, true);
        const base = new Set(Object.keys(new SecondaryNode()));
        const texture = new Texture(new PacketT(textures.GetFile(0, 0)));
        const k = new TextureCache(textures, new Js5(new Provider(26), false, true), null, 20, false);
        return { own: Object.keys(texture).filter(name => !base.has(name)), keys: Object.keys(k) };
    });
    // qi: P D Q I T K N O.
    expect(own.sort()).toEqual(['brightness', 'pixels', 'procedural', 'scrollX', 'scrollY', 'smooth', 'transposed', 'used']);
    // kg: q G n C k J d c E i a m p h g t.
    expect(keys.sort()).toEqual(['averageColour', 'available', 'byte5', 'byte6', 'byte7', 'byte8', 'capacity', 'exists', 'flag4', 'lowMemory', 'recentUse', 'secondaryCache', 'small', 'solid', 'sprites', 'textures'].sort());
});

test('TextureCache (kg) and Texture (qi) match client.jar over the real texture archives', () => {
    const script = withClinitStatics(resets(), generate);
    const java = runOracle(script);
    expect(java.length).toBe(script.length);
    const ts = withClinitStatics(resets(), () => runTs(script));
    expect(ts.length).toBe(script.length);

    if (process.env.TC_DUMP) {
        writeFileSync(`${process.env.TC_DUMP}.script`, script.join('\n') + '\n');
        writeFileSync(`${process.env.TC_DUMP}.java`, java.join('\n') + '\n');
        writeFileSync(`${process.env.TC_DUMP}.ts`, ts.join('\n') + '\n');
    }
    const stats = new Map<string, number>();
    script.forEach((line, i) => {
        const r = java[i].split(' ');
        const key = `${line.split(' ')[0]}:${r[0]}${r[1] === 'null' ? '-null' : ''}`;
        stats.set(key, (stats.get(key) ?? 0) + 1);
    });
    if (process.env.TC_STATS) console.log(script.length, Object.fromEntries([...stats.entries()].sort()));

    const mismatches: string[] = [];
    for (let i = 0; i < script.length && mismatches.length < 6; i++) {
        if (ts[i] === java[i]) continue;
        const a = java[i].split(' ');
        const b = ts[i].split(' ');
        let at = 0;
        while (at < a.length && a[at] === b[at]) at++;
        mismatches.push(
            `#${i} ${script[i].slice(0, 200)}\n  java: ${a
                .slice(Math.max(0, at - 3), at + 4)
                .join(' ')
                .slice(0, 600)}\n  ts:   ${b
                .slice(Math.max(0, at - 3), at + 4)
                .join(' ')
                .slice(0, 600)}`
        );
    }
    expect(mismatches).toEqual([]);

    // The script reaches what it claims to (read from the jar's output).
    const ok = (op: string, pattern: RegExp): number => script.filter((line, i) => line.split(' ')[0] === op && pattern.test(java[i])).length;
    expect(ok('data', /^ok #\d+:16384:/)).toBeGreaterThan(1300);
    expect(ok('data', /^ok #\d+:4096:/)).toBeGreaterThan(6000);
    expect(ok('data', /^ok null/)).toBeGreaterThan(20);
    expect(ok('data', /^aioobe/)).toBeGreaterThan(20);
    expect(ok('data', /^npe/)).toBeGreaterThan(3);
    expect(ok('data', /^cce/)).toBeGreaterThan(0);
    expect(ok('pix', /^ok #\d+:16384:/)).toBeGreaterThan(200);
    expect(ok('pix', /^ok #\d+:4096:/)).toBeGreaterThan(1000);
    expect(ok('loaded', /^ok 0/)).toBeGreaterThan(5);
    expect(ok('loaded', /^ok 1/)).toBeGreaterThan(1300);
    expect(ok('anim', /^ok /)).toBeGreaterThan(300);
    expect(ok('anim', /^cce/)).toBeGreaterThan(0);
    expect(ok('new', /^ok kg/)).toBeGreaterThan(20);
    expect(ok('new', /^(aioobe|npe)/)).toBeGreaterThan(2);
    for (const c of ['colour', 'small', 'avail', 'solid']) expect(ok(c, /^aioobe/)).toBeGreaterThan(10);
}, 900000);
