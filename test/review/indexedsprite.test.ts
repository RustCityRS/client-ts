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
import AbstractIndexedSprite from '../../src/graphics/AbstractIndexedSprite.js';
import Pix2D from '../../src/graphics/Pix2D.js';
import Pix8 from '../../src/graphics/Pix8.js';
import SpriteLoader from '../../src/graphics/SpriteLoader.js';
import Crc32 from '../../src/io/Crc32.js';
import { arrayAt, requireNonNull } from '../../src/util/JavaArray.js';
import { readGroup } from '../cachefile.js';
import { cachePath, gamepackPath } from '../reference.js';

// si (AbstractIndexedSprite) and ch (SoftwareIndexedSprite) against client.jar, with real archive 8 sprites.
//
// The test writes one seeded script, runs it through the TS port, then pipes it into
// indexedsprite/IndexedSpriteCacheOracle.java, which runs the same script on the real gamepack classes. After every
// operation both sides print the outcome (ok or the Java exception), the hash of the whole Pix2D framebuffer (so a
// partial write before an exception must match too), the six si geometry fields and hashes of ch.y and of the
// private palette ch.z. Loads also print every frame they built.
//
// Real sprites: the sprite files of archive 8 groups name_icons, scrollbar, runes (the title-screen runes),
// mapfunction, headicons_prayer, hitmarks, cross, mapdots, hint_mapedge, compass, titlebutton, logo, titlebox and
// titlebg, plus every mapscene sprite referenced by config group 34. Each goes through the real decoder (og.a /
// SpriteLoader.decode) and a real ch builder (vi.e, qd.b, uk.b, rk.b). All frames of one group share one palette
// array, like in the client, so an rgbAdjust on one frame shows in the others. Mapscenes follow da.a(IB)Lch;: uk.b(0),
// rgbAdjust with the anti-bot tint range, canvas set to the inner size, 0 to 3 clockwise turns, then drawn.
//
// Every frame is drawn with draw a(II)V, drawAlpha a(III)V and both again through the abstract si type, at positions
// on both sides of every clip edge, on surfaces with a full, inner, tiny, empty, inverted and oversized clip, a short
// framebuffer and no framebuffer. It is drawn scaled (a(IIII)V) and scaled and tinted (a(IIIII)V) at shrinking,
// growing, odd, zero and negative sizes, then trimmed, rotated and recoloured. Synthetic sprites carry explicit
// pixels and palettes: index 0 over a non-zero palette[0] (it must stay transparent), indices past the palette and
// above 127 (signed bytes), colours with the top byte set and odd sizes (1xN, Nx1, 3x5, 7x3, ...). A seeded random
// section then mixes every member, the four private static plot routines called directly and inconsistent geometry.

const MIN = -2147483648;
const MAX = 2147483647;
const W = 120;
const H = 104;
const SW = 48;
const SH = 40;
const RANDOM_CASES = 16000;
const NAMED_GROUPS = ['name_icons', 'scrollbar', 'runes', 'mapfunction', 'headicons_prayer', 'hitmarks', 'cross', 'mapdots', 'hint_mapedge', 'compass', 'titlebutton', 'logo', 'titlebox', 'titlebg'];

function runOracle(script: string): string[] {
    const source = fileURLToPath(new URL('./indexedsprite/IndexedSpriteCacheOracle.java', import.meta.url));
    const dir = mkdtempSync(join(tmpdir(), 'indexedsprite-oracle-'));
    try {
        const javac = spawnSync('javac', ['-nowarn', '-cp', gamepackPath, '-d', dir, source], { timeout: 60000, encoding: 'utf8' });
        if (javac.status !== 0) throw new Error(`javac failed: ${javac.stderr}`);
        const java = spawnSync('java', ['-Xmx1g', '-Djava.awt.headless=true', '-cp', gamepackPath + delimiter + dir, 'IndexedSpriteCacheOracle'], {
            input: script,
            timeout: 300000,
            encoding: 'utf8',
            maxBuffer: 512 * 1024 * 1024
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

function pattern(i: number, seed: number): number {
    return Math.imul(i, 0x2545f491) ^ Math.imul(seed, 0x27d4eb2f);
}

function ints(a: Int32Array | null): string {
    if (a === null) return 'null';
    let h = 1;
    for (let i = 0; i < a.length; i++) h = (Math.imul(h, 31) + a[i]) | 0;
    return `${a.length}:${h}`;
}

function bytes(a: Uint8Array | null): string {
    if (a === null) return 'null';
    let h = 1;
    for (let i = 0; i < a.length; i++) h = (Math.imul(h, 31) + (a[i] & 255)) | 0;
    return `${a.length}:${h}`;
}

// ---- tokens (identical decoding in the oracle) ----

const byteToken = (b: Uint8Array | null) => (b === null ? 'n' : 'b' + Buffer.from(b).toString('base64'));

function intToken(a: Int32Array | null): string {
    if (a === null) return 'n';
    const buf = Buffer.alloc(a.length * 4);
    for (let i = 0; i < a.length; i++) buf.writeInt32BE(a[i], i * 4);
    return 'i' + buf.toString('base64');
}

const fromByteToken = (t: string): Uint8Array | null => (t === 'n' ? null : new Uint8Array(Buffer.from(t.slice(1), 'base64')));

function fromIntToken(t: string): Int32Array | null {
    if (t === 'n') return null;
    const buf = Buffer.from(t.slice(1), 'base64');
    const out = new Int32Array(buf.length >> 2);
    for (let i = 0; i < out.length; i++) out[i] = buf.readInt32BE(i * 4);
    return out;
}

// ---- TS side ----

let sprite: Pix8 | null = null;
let frames: (AbstractIndexedSprite | null)[] = [];

function digest(s: AbstractIndexedSprite | null): string {
    if (s === null) return 'null';
    if (!(s instanceof Pix8)) throw new Error('not a ch');
    return `${s.xOffset},${s.cropH},${s.yOffset},${s.width},${s.height},${s.cropW},${bytes(s.pixels)},${ints(s['palette'])}`;
}

function classify(e: unknown): string {
    if (e instanceof TypeError && /^Null (reference|array|byte array)$/.test(e.message)) return 'npe';
    if (e instanceof RangeError) {
        if (e.message === '/ by zero') return 'arith';
        if (e.message.startsWith('array index ') || e.message.startsWith('byte array index ')) return 'aioobe';
        // new Uint8Array(negative): the engine's wording varies.
        if (/negative|Invalid typed array length/.test(e.message)) return 'neg';
    }
    throw e;
}

function current(): Pix8 {
    return requireNonNull(sprite);
}

function load(f: string[]): string {
    SpriteLoader.decode(fromByteToken(f[1]));
    switch (f[2]) {
        case 'vi':
            frames = SpriteLoader.createIndexedSprites();
            break;
        case 'qd':
            frames = SpriteLoader.toIndexedSprites();
            break;
        case 'uk':
            frames = [SpriteLoader.createIndexedSprite2(Number.parseInt(f[3], 10))];
            break;
        case 'rk':
            frames = [SpriteLoader.createIndexedSprite()];
            break;
        default:
            throw new Error(`bad builder ${f[2]}`);
    }
    return `${frames.length}` + frames.map(s => ' ' + digest(s)).join('');
}

function execute(index: number, line: string): string {
    const f = line.split(' ');
    const op = f[0];
    const v = op === 'spr' || op === 'load' ? [] : f.map((x, i) => (i === 0 ? 0 : Number.parseInt(x, 10)));
    let result = 'ok';
    let extra = '';
    try {
        switch (op) {
            case 'pix': {
                let buf: Int32Array | null = null;
                if (v[1] >= 0) {
                    buf = new Int32Array(v[1]);
                    for (let i = 0; i < v[1]; i++) buf[i] = pattern(i, v[4]);
                }
                Pix2D.pixels = buf;
                Pix2D.width = v[2];
                Pix2D.height = v[3];
                break;
            }
            case 'clip':
                Pix2D.clipMinX = v[1];
                Pix2D.clipMinY = v[2];
                Pix2D.clipMaxX = v[3];
                Pix2D.clipMaxY = v[4];
                break;
            case 'spr': {
                const n = f.slice(1, 7).map(x => Number.parseInt(x, 10));
                sprite = new Pix8(n[0], n[1], n[2], n[3], n[4], n[5], fromByteToken(f[7]), fromIntToken(f[8]));
                break;
            }
            case 'load':
                extra = ' ' + load(f);
                break;
            case 'sel': {
                const s = arrayAt(frames, v[1]);
                if (s !== null && !(s instanceof Pix8)) throw new Error('not a ch');
                sprite = s;
                break;
            }
            case 'geom': {
                const s = current();
                s.xOffset = v[1];
                s.cropH = v[2];
                s.yOffset = v[3];
                s.width = v[4];
                s.height = v[5];
                s.cropW = v[6];
                break;
            }
            case 'fitcrop': {
                const s = current();
                s.cropH = s.height;
                s.cropW = s.width;
                break;
            }
            case 'draw':
                current().draw(v[1], v[2]);
                break;
            case 'vdraw': {
                const base: AbstractIndexedSprite = current();
                base.draw(v[1], v[2]);
                break;
            }
            case 'alpha':
                current().drawAlpha(v[1], v[2], v[3]);
                break;
            case 'valpha': {
                const base: AbstractIndexedSprite = current();
                base.drawAlpha(v[1], v[2], v[3]);
                break;
            }
            case 'scale':
                current().drawScaled(v[1], v[2], v[3], v[4]);
                break;
            case 'tint':
                current().drawScaledTinted(v[1], v[2], v[3], v[4], v[5]);
                break;
            case 'trim':
                current().trim();
                break;
            case 'rot':
                current().rotateClockwise();
                break;
            case 'rgb':
                current().rgbAdjust(v[1], v[2], v[3]);
                break;
            case 'splot': {
                const s = current();
                Pix8['plot'](Pix2D.pixels, s.pixels, s['palette'], v[1], v[2], v[3], v[4], v[5], v[6], v[7]);
                break;
            }
            case 'salpha': {
                const s = current();
                Pix8['plotAlpha'](Pix2D.pixels, s.pixels, s['palette'], v[1], v[2], v[3], v[4], v[5], v[6], v[7]);
                break;
            }
            case 'sscale': {
                const s = current();
                Pix8['plotScale'](Pix2D.pixels, s.pixels, s['palette'], v[1], v[2], v[3], v[4], v[5], v[6], v[7], v[8], v[9]);
                break;
            }
            case 'stint': {
                const s = current();
                Pix8['plotScaleTinted'](Pix2D.pixels, s.pixels, s['palette'], v[1], v[2], v[3], v[4], v[5], v[6], v[7], v[8], v[9], v[10]);
                break;
            }
            default:
                throw new Error(`bad op ${op}`);
        }
    } catch (e) {
        result = classify(e);
    }
    return `${index} ${op} ${result} ${ints(Pix2D.pixels)} ${sprite === null ? 'none' : digest(sprite)}${extra}`;
}

// bun runs every test file in one process and the other review tests start from the statics' initial values, so
// this test puts back every Pix2D and SpriteLoader static it touches.
function saveStatics(): () => void {
    const { pixels, width, height, clipMinX, clipMinY, clipMaxX, clipMaxY } = Pix2D;
    const s = SpriteLoader;
    const staging = [s.count, s.canvasWidth, s.height, s.xOffsets, s.yOffsets, s.widths, s.innerHeights, s.palette, s.pixels, s.alphas, s.hasAlpha] as const;
    return () => {
        Pix2D.pixels = pixels;
        Pix2D.width = width;
        Pix2D.height = height;
        Pix2D.clipMinX = clipMinX;
        Pix2D.clipMinY = clipMinY;
        Pix2D.clipMaxX = clipMaxX;
        Pix2D.clipMaxY = clipMaxY;
        [s.count, s.canvasWidth, s.height, s.xOffsets, s.yOffsets, s.widths, s.innerHeights, s.palette, s.pixels, s.alphas, s.hasAlpha] = staging;
        sprite = null;
        frames = [];
    };
}

// ---- cache access (inputs only) ----

// The JS5 container without the two-byte version trailer that the sector files keep after it.
function container(raw: Uint8Array): Uint8Array {
    const length = ((raw[1] << 24) | (raw[2] << 16) | (raw[3] << 8) | raw[4]) >>> 0;
    return raw.subarray(0, (raw[0] === 0 ? 5 : 9) + length);
}

class SectorProvider extends Js5ResourceProvider {
    private readonly table: Js5Index;

    constructor(private readonly archive: number) {
        super();
        const src = container(readGroup(cachePath, 255, archive));
        this.table = new Js5Index(src, Crc32.prefix(src, src.length));
    }

    index(): Js5Index | null {
        return this.table;
    }

    group(_mode: number, group: number): Uint8Array | null {
        return container(readGroup(cachePath, this.archive, group));
    }

    prefetchGroup(_group: number): void {}

    GetGroupLoadPercentage(_group: number): number {
        return 100;
    }
}

// The mapscene sprite groups: opcode 1 of every MapSceneType (config group 34) is the archive 8 group (da.a(IIgdI)V).
function mapsceneGroups(): number[] {
    const configs = new Js5(new SectorProvider(2), false, true);
    const out = new Set<number>();
    for (let i = 0; i < configs.GetFileIdLimit(34); i++) {
        const data = configs.GetFile(i, 34);
        if (data === null) continue;
        let pos = 0;
        let group = -1;
        for (;;) {
            const code = data[pos++];
            if (code === 0 || code === undefined) break;
            if (code === 1) {
                group = (data[pos] << 8) | data[pos + 1];
                pos += 2;
            } else if (code === 2) {
                pos += 3;
            } else if (code === 4) {
                group = -1;
            }
        }
        if (group >= 0) out.add(group);
    }
    return [...out].sort((a, b) => a - b);
}

type FrameGeom = { x: number; y: number; w: number; h: number };
type FileGeom = { cw: number; ch: number; frames: FrameGeom[] };

// The og.a trailer, read independently of the port: it only steers the coordinates the script uses.
function geometry(data: Uint8Array): FileGeom {
    const g2 = (p: number) => (data[p] << 8) | data[p + 1];
    const count = g2(data.length - 2);
    const pos = data.length - 7 - 8 * count;
    const out: FileGeom = { cw: g2(pos), ch: g2(pos + 2), frames: [] };
    for (let i = 0; i < count; i++) {
        out.frames.push({ x: g2(pos + 5 + 2 * i), y: g2(pos + 5 + 2 * count + 2 * i), w: g2(pos + 5 + 4 * count + 2 * i), h: g2(pos + 5 + 6 * count + 2 * i) });
    }
    return out;
}

// ---- script ----

type Clip = [number, number, number, number];

function generate(): string[] {
    const r = new Rng(0x2c1b3e57);
    const s: string[] = [];

    const sprites = new Js5(new SectorProvider(8), false, true);
    const named = NAMED_GROUPS.map(name => {
        const group = sprites.GetGroupId(fromJsString(name));
        if (group < 0) throw new Error(`missing sprite group ${name}`);
        return group;
    });
    const mapscenes = mapsceneGroups();
    expect(mapscenes.length).toBeGreaterThan(50);
    const file = (group: number): Uint8Array => {
        const data = sprites.GetFile(0, group);
        if (data === null) throw new Error(`missing sprite file ${group}`);
        return data;
    };

    const alphas = [MIN, -1, 0, 1, 64, 128, 200, 255, 256, 257, MAX];
    const colours = [0, 0xffffff, 0x808080, 0xff0000, 0x00ff00, 0x0000ff, 0x123456, -1, MIN, 0x7f00ff80, 0xffc000];

    // Surfaces for the real sprites. Every one has a clip and a framebuffer, some broken on purpose.
    type Surface = { pix: string; clip: Clip };
    const surfaces: Surface[] = [
        { pix: `pix ${W * H} ${W} ${H} 3`, clip: [0, 0, W, H] },
        { pix: `pix ${W * H} ${W} ${H} 4`, clip: [9, 6, 101, 91] },
        { pix: `pix ${W * H} ${W} ${H} 5`, clip: [50, 40, 58, 47] },
        { pix: `pix ${W * H} ${W} ${H} 6`, clip: [-4, -3, W + 5, H + 4] },
        { pix: `pix ${W * H - 700} ${W} ${H} 7`, clip: [0, 0, W, H] },
        { pix: `pix -1 ${W} ${H} 0`, clip: [0, 0, W, H] },
        { pix: `pix ${W * H} ${W} ${H} 8`, clip: [30, 30, 30, 30] },
        { pix: `pix ${W * H} ${W} ${H} 9`, clip: [60, 50, 40, 30] }
    ];
    const use = (surface: Surface) => s.push(surface.pix, `clip ${surface.clip.join(' ')}`);

    // Positions on both sides of every clip edge for a frame drawn at (x, y) + offset.
    const edges = (lo: number, hi: number, off: number, size: number, dense: boolean) => {
        const all = [lo - off - size - 1, lo - off - size, lo - off - size + 1, lo - off - 1, lo - off, lo - off + 1, ((lo + hi - size) >> 1) - off, hi - off - size - 1, hi - off - size, hi - off - size + 1, hi - off - 1, hi - off];
        const values = dense ? all : [all[1], all[3], all[5], all[6], all[8], all[11]];
        return [...new Set(values)];
    };

    const sweep = (fr: FrameGeom, surface: Surface, dense: boolean) => {
        const [l, t, rr, b] = surface.clip;
        let k = 0;
        for (const x of edges(l, rr, fr.x, fr.w, dense)) {
            for (const y of edges(t, b, fr.y, fr.h, dense)) {
                const a = alphas[k % alphas.length];
                s.push(k % 3 === 0 ? `vdraw ${x} ${y}` : `draw ${x} ${y}`, k % 3 === 1 ? `valpha ${x} ${y} ${a}` : `alpha ${x} ${y} ${a}`);
                k++;
            }
        }
    };

    const scaled = (g: FileGeom, surface: Surface) => {
        const [l, t, rr, b] = surface.clip;
        const sizes = [1, 2, 3, g.cw >> 1, g.cw - 1, g.cw, g.cw + 1, 2 * g.cw, 3 * g.cw + 1, 7, 13];
        const hsizes = [1, 2, 5, g.ch >> 1, g.ch - 1, g.ch, g.ch + 1, 2 * g.ch, 3 * g.ch + 1, 9, 11];
        for (let i = 0; i < sizes.length; i++) {
            const w = Math.max(sizes[i], 1);
            const h = Math.max(hsizes[(i * 3) % hsizes.length], 1);
            const positions: [number, number][] = [
                [l + 3, t + 2],
                [l - (w >> 1), t - (h >> 1)],
                [rr - (w >> 1), b - (h >> 1)],
                [l - w - 1, t],
                [rr, b]
            ];
            for (const [x, y] of positions) s.push(`scale ${x} ${y} ${w} ${h}`);
            const c = colours[i % colours.length];
            for (const [x, y] of positions.slice(0, 3)) s.push(`tint ${x} ${y} ${w} ${h} ${c}`);
        }
        s.push(`scale ${l} ${t} 0 5`, `scale ${l} ${t} 5 0`, `tint ${l} ${t} 0 0 255`, `scale ${l + 5} ${t + 5} -3 4`, `scale ${l + 5} ${t + 5} 4 -3`, `tint ${l + 9} ${t + 9} -7 -7 65280`);
    };

    // Real sprites from the named groups.
    for (let gi = 0; gi < named.length; gi++) {
        const data = file(named[gi]);
        const g = geometry(data);
        const big = g.cw * g.ch > 40000;
        s.push(`load ${byteToken(data)} vi`);
        const count = g.frames.length;
        const picks = count <= 6 ? [...Array(count).keys()] : [0, 1, count >> 2, count >> 1, (3 * count) >> 2, count - 1];
        for (const fi of picks) {
            const fr = g.frames[fi];
            s.push(`sel ${fi}`);
            const dense = surfaces[0];
            use(dense);
            sweep(fr, dense, !big);
            scaled(g, dense);
            for (let si = 1; si < surfaces.length; si++) {
                if (big && si > 3) continue;
                use(surfaces[si]);
                sweep(fr, surfaces[si], false);
                if (si < 4) scaled(g, surfaces[si]);
            }
            use(surfaces[1]);
            s.push(`rgb ${r.int(-30, 30)} ${r.int(-30, 30)} ${r.int(-30, 30)}`, 'draw 10 8', 'trim', 'draw 10 8', 'alpha 12 9 160', 'rot', 'draw 11 7', 'rot', 'vdraw 11 7', 'rot', 'scale 9 6 33 21', 'rot', 'draw 10 8');
            s.push('fitcrop', 'rot', 'draw 20 20', 'trim', 'draw 20 20');
        }
        // The frames share one palette: recolour through the last frame, then look at frame 0 again.
        s.push(`sel ${count - 1}`, 'rgb 300 -300 17', 'sel 0', 'draw 9 6', 'rgb -255 255 -128', 'alpha 9 6 99');
        // The other builders on the same file.
        s.push(`load ${byteToken(data)} qd`, 'sel 0', 'draw 9 6', `load ${byteToken(data)} uk 0`, 'sel 0', 'draw 9 6', `load ${byteToken(data)} rk`, 'sel 0', 'vdraw 9 6');
        s.push(`load ${byteToken(data)} uk ${count - 1}`, 'sel 0', 'draw 9 6', `load ${byteToken(data)} uk ${count}`);
    }

    // Mapscenes, the way da.a(IB)Lch; prepares them, then drawn like the minimap does and across the clip edges.
    for (let i = 0; i < mapscenes.length; i++) {
        const data = file(mapscenes[i]);
        const g = geometry(data);
        const surface = surfaces[i % 4];
        use(surface);
        s.push(`load ${byteToken(data)} uk 0`, 'sel 0');
        s.push(`rgb ${r.int(-30, 30)} ${r.int(-30, 30)} ${r.int(-30, 30)}`, 'fitcrop');
        for (let k = 0; k < i % 4; k++) s.push('rot');
        const fr = g.frames[0];
        // Rough frame size after the turns (odd turns swap w and h; offsets ignored): it only steers the sweep.
        const turned = (i % 4) % 2 === 1 ? { x: 0, y: 0, w: fr.h, h: fr.w } : { x: 0, y: 0, w: fr.w, h: fr.h };
        sweep(turned, surface, i % 3 === 0);
        for (let k = 0; k < 6; k++) s.push(`draw ${r.int(0, W - 8)} ${r.int(0, H - 8)}`);
        s.push(`scale ${r.int(-4, W)} ${r.int(-4, H)} ${r.int(1, 24)} ${r.int(1, 24)}`, `tint ${r.int(-4, W)} ${r.int(-4, H)} ${r.int(1, 24)} ${r.int(1, 24)} ${r.int(0, 0xffffff)}`);
        s.push('trim', 'rot', 'draw 30 30', `load ${byteToken(data)} vi`, 'sel 0', 'trim', 'draw 31 33', 'rot', 'alpha 31 33 128');
    }

    // Synthetic sprites with explicit pixels and palettes.
    const spr = (cropW: number, cropH: number, xOff: number, yOff: number, w: number, h: number, pixels: Uint8Array | null, palette: Int32Array | null) =>
        s.push(`spr ${cropW} ${cropH} ${xOff} ${yOff} ${w} ${h} ${byteToken(pixels)} ${intToken(palette)}`);
    const content = (len: number, maxIndex: number, zeroRate: number, wild: number) => {
        const out = new Uint8Array(Math.max(len, 0));
        for (let i = 0; i < out.length; i++) out[i] = r.chance(zeroRate) ? 0 : r.chance(wild) ? r.int(0, 255) : r.int(1, Math.max(maxIndex, 1));
        return out;
    };
    const paletteOf = (len: number, zeroColour: number) => {
        const out = new Int32Array(Math.max(len, 0));
        for (let i = 0; i < out.length; i++) out[i] = r.chance(10) ? r.pick(colours) : r.int(MIN, MAX);
        if (out.length > 0) out[0] = zeroColour;
        return out;
    };

    const small: Surface[] = [
        { pix: `pix ${SW * SH} ${SW} ${SH} 11`, clip: [0, 0, SW, SH] },
        { pix: `pix ${SW * SH} ${SW} ${SH} 12`, clip: [5, 4, 41, 33] },
        { pix: `pix ${SW * SH - 100} ${SW} ${SH} 13`, clip: [0, 0, SW, SH] },
        { pix: `pix ${SW * SH} ${SW} ${SH} 14`, clip: [-2, -1, SW + 2, SH + 1] }
    ];
    const odd: [number, number][] = [
        [1, 1],
        [1, 7],
        [7, 1],
        [1, 13],
        [13, 1],
        [3, 5],
        [7, 3],
        [5, 5],
        [2, 9],
        [9, 2],
        [4, 4],
        [11, 13],
        [17, 3],
        [3, 17],
        [31, 29]
    ];
    for (const [w, h] of odd) {
        for (const pad of [0, 1, 3]) {
            const cropW = w + 2 * pad;
            const cropH = h + pad;
            for (const [palLen, maxIndex, wild] of [
                [256, 255, 1000000],
                [8, 7, 1000000],
                [8, 7, 6],
                [2, 1, 1000000]
            ] as const) {
                for (const zeroColour of [0, 0xff00ff, -1]) {
                    for (const surface of small) {
                        use(surface);
                        spr(cropW, cropH, pad, pad >> 1, w, h, content(w * h, maxIndex, 4, wild), paletteOf(palLen, zeroColour));
                        sweep({ x: pad, y: pad >> 1, w, h }, surface, surface === small[0] && zeroColour === 0xff00ff);
                        s.push(`scale 3 2 ${cropW * 2 + 1} ${cropH * 3}`, `scale -2 -1 ${Math.max(cropW >> 1, 1)} ${Math.max(cropH >> 1, 1)}`, `tint 4 4 ${cropW + 3} ${cropH + 1} ${r.pick(colours)}`);
                        s.push(`tint ${SW - 5} ${SH - 4} ${cropW * 3} ${cropH * 2} ${r.int(0, 0xffffff)}`);
                    }
                    s.push('trim', 'draw 2 2', 'rot', 'draw 2 2', 'rot', 'alpha 3 1 77', 'rot', 'rgb -40 90 300', 'draw 1 1', 'rot', 'trim', 'vdraw 0 0');
                }
            }
        }
    }
    // Null and short arrays.
    use(small[0]);
    spr(10, 8, 1, 1, 6, 5, null, paletteOf(256, 0));
    s.push('draw 3 3', 'alpha 3 3 100', 'scale 3 3 12 10', 'tint 3 3 12 10 255', 'trim', 'rot');
    spr(10, 8, 1, 1, 6, 5, content(30, 255, 3, 1), null);
    s.push('draw 3 3', 'alpha 3 3 100', 'scale 3 3 12 10', 'tint 3 3 12 10 255', 'rgb 1 1 1', 'trim', 'rot');
    spr(10, 8, 1, 1, 6, 5, content(17, 255, 3, 1), paletteOf(256, 0));
    s.push('draw 3 3', 'alpha 3 3 100', 'scale 3 3 12 10', 'tint 3 3 12 10 255', 'trim', 'rot');
    spr(10, 8, 1, 1, 6, 5, content(30, 255, 5, 1), paletteOf(4, 0));
    s.push('draw 3 3', 'alpha 3 3 100', 'scale 3 3 12 10', 'tint 3 3 12 10 255', 'rgb 500 -500 0');
    spr(10, 8, 1, 1, 6, 5, new Uint8Array(30), new Int32Array(0));
    s.push('draw 3 3', 'alpha 3 3 100', 'scale 3 3 12 10', 'tint 3 3 12 10 255', 'rgb 1 2 3', 'trim', 'rot', 'draw 0 0');
    spr(-3, 4, 0, 0, 2, 2, content(4, 255, 5, 1), paletteOf(256, 0));
    s.push('trim', 'rot', 'draw 0 0', 'scale 0 0 5 5');
    spr(6, 6, 0, 0, -2, 3, content(6, 255, 5, 1), paletteOf(256, 0));
    s.push('draw 0 0', 'scale 0 0 5 5', 'rot', 'trim');
    s.push(...['pix -1 48 40 0', 'clip 0 0 48 40']);
    spr(6, 6, 1, 1, 4, 4, content(16, 255, 1000000, 1000000), paletteOf(256, 0));
    s.push('draw 3 3', 'alpha 3 3 128', 'scale 3 3 7 7', 'tint 3 3 7 7 255', 'draw 100 100', 'alpha -100 3 4');
    // No framebuffer and a first visible index past the palette: Java looks the palette up before it stores, so the
    // palette's AIOOBE wins over the framebuffer's NPE. With an index inside the palette the NPE comes first.
    for (const palLen of [0, 1, 4, 256]) {
        for (const first of [0, 1, 3, 200]) {
            const pixels = content(20, palLen + 3, 3, 1000000);
            pixels[0] = first;
            pixels[1] = first;
            spr(5, 4, 0, 0, 5, 4, pixels, paletteOf(palLen, 0x00ff00));
            s.push('draw 1 1', 'vdraw 1 1', 'alpha 1 1 128', 'valpha 1 1 7', 'scale 1 1 5 4', 'scale 1 1 9 7', 'tint 1 1 5 4 255', 'tint 1 1 3 2 -1');
            s.push('splot 0 0 0 5 4 0 0', 'splot 9 0 0 3 4 2 2', 'salpha 0 0 5 4 0 0 128', 'sscale 0 0 0 0 5 4 65536 65536 5', 'stint 0 0 0 0 5 4 65536 65536 5 255');
        }
    }

    // Seeded random cases.
    const randomSprite = () => {
        const w = r.chance(25) ? r.int(-4, 0) : r.int(1, 26);
        const h = r.chance(25) ? r.int(-4, 0) : r.int(1, 26);
        const cropW = r.chance(20) ? r.int(-4, 0) : Math.max(w, 0) + r.int(r.chance(6) ? -6 : 0, 12);
        const cropH = r.chance(20) ? r.int(-4, 0) : Math.max(h, 0) + r.int(r.chance(6) ? -6 : 0, 12);
        const area = Math.max(w, 0) * Math.max(h, 0);
        const pixLen = r.chance(40) ? -1 : r.chance(8) ? r.int(0, area + 3) : area;
        const palLen = r.chance(40) ? -1 : r.chance(5) ? r.int(0, 20) : r.pick([2, 8, 16, 64, 128, 256]);
        const maxIndex = r.chance(5) ? 255 : Math.max(palLen - 1, 1);
        const pixels = pixLen < 0 ? null : content(pixLen, maxIndex, r.pick([2, 4, 8, 1000000]), r.chance(3) ? 6 : 1000000);
        spr(cropW, cropH, r.int(-3, Math.max(cropW - w, 0) + 2), r.int(-3, Math.max(cropH - h, 0) + 2), w, h, pixels, palLen < 0 ? null : paletteOf(palLen, r.chance(2) ? 0 : r.int(MIN, MAX)));
    };
    const coord = (lo: number, hi: number) => (r.chance(80) ? r.pick([MIN, MAX, MIN + r.int(0, 50), MAX - r.int(0, 50)]) : r.int(lo, hi));
    const realPool = [...named.slice(0, 11), ...mapscenes.slice(0, 20)].map(file);

    use(small[0]);
    randomSprite();
    for (let i = 0; i < RANDOM_CASES; i++) {
        const k = r.int(0, 99);
        if (k < 1) {
            const len = r.chance(5) ? -1 : r.chance(5) ? r.int(0, SW * SH) : SW * SH;
            s.push(`pix ${len} ${SW} ${SH} ${r.int(0, 1000)}`);
        } else if (k < 4) {
            const left = r.int(-4, 30);
            const top = r.int(-4, 25);
            s.push(`clip ${left} ${top} ${r.chance(6) ? r.int(left - 3, SW + 5) : r.int(left, SW)} ${r.chance(6) ? r.int(top - 3, SH + 5) : r.int(top, SH)}`);
        } else if (k < 9) {
            randomSprite();
        } else if (k < 11) {
            const data = r.pick(realPool);
            s.push(`load ${byteToken(data)} ${r.pick(['vi', 'qd', 'vi', 'uk 0', 'rk'])}`, `sel ${r.int(0, geometry(data).frames.length - 1)}`);
            if (r.chance(4)) s.push('sel 0');
        } else if (k < 12) {
            s.push(`geom ${r.int(-6, 12)} ${r.int(-3, 30)} ${r.int(-6, 12)} ${r.int(-3, 24)} ${r.int(-3, 24)} ${r.int(-3, 30)}`);
        } else if (k < 13) {
            s.push('fitcrop');
        } else if (k < 30) {
            s.push(`${r.chance(4) ? 'vdraw' : 'draw'} ${coord(-30, 70)} ${coord(-30, 60)}`);
        } else if (k < 44) {
            s.push(`${r.chance(4) ? 'valpha' : 'alpha'} ${coord(-30, 70)} ${coord(-30, 60)} ${r.chance(10) ? r.pick(alphas) : r.int(0, 256)}`);
        } else if (k < 58) {
            s.push(`scale ${r.int(-40, 70)} ${r.int(-40, 60)} ${r.int(-5, 60)} ${r.int(-5, 60)}`);
        } else if (k < 70) {
            s.push(`tint ${r.int(-40, 70)} ${r.int(-40, 60)} ${r.int(-5, 60)} ${r.int(-5, 60)} ${r.chance(5) ? r.pick(colours) : r.int(0, 0xffffff)}`);
        } else if (k < 74) {
            s.push('trim');
        } else if (k < 78) {
            s.push('rot');
        } else if (k < 82) {
            s.push(`rgb ${r.int(-300, 300)} ${r.int(-300, 300)} ${r.int(-300, 300)}`);
        } else if (k < 86) {
            s.push(`splot ${r.int(MIN, MAX)} ${r.int(-2, 700)} ${r.int(-2, SW * SH + 2)} ${r.int(-2, 20)} ${r.int(-2, 20)} ${r.int(-5, 40)} ${r.int(-5, 40)}`);
        } else if (k < 90) {
            s.push(`salpha ${r.int(-2, 700)} ${r.int(-2, SW * SH + 2)} ${r.int(-2, 20)} ${r.int(-2, 20)} ${r.int(-5, 40)} ${r.int(-5, 40)} ${r.pick(alphas)}`);
        } else if (k < 95) {
            s.push(`sscale ${r.int(-70000, 900000)} ${r.int(-70000, 900000)} ${r.int(-2, SW * SH + 2)} ${r.int(-5, 40)} ${r.int(-2, 20)} ${r.int(-2, 20)} ${r.int(-70000, 200000)} ${r.int(-70000, 200000)} ${r.int(-3, 30)}`);
        } else {
            s.push(`stint ${r.int(-70000, 900000)} ${r.int(-70000, 900000)} ${r.int(-2, SW * SH + 2)} ${r.int(-5, 40)} ${r.int(-2, 20)} ${r.int(-2, 20)} ${r.int(-70000, 200000)} ${r.int(-70000, 200000)} ${r.int(-3, 30)} ${r.pick(colours)}`);
        }
    }

    return s;
}

test('si/ch indexed sprites with real archive 8 sprites match client.jar', () => {
    const script = generate();
    const restore = saveStatics();
    let ours: string[];
    try {
        ours = script.map((line, i) => execute(i, line));
    } finally {
        restore();
    }
    const theirs = runOracle(script.join('\n') + '\n');

    expect(theirs.length).toBe(ours.length);
    for (let i = 0; i < ours.length; i++) {
        if (ours[i] !== theirs[i]) {
            throw new Error(`mismatch at op ${i} "${script[i].slice(0, 160)}"\n  ts:   ${ours[i].slice(0, 2000)}\n  java: ${theirs[i].slice(0, 2000)}`);
        }
    }

    // The script reaches every outcome, and over a quarter of the draws change the framebuffer.
    const results = new Set(ours.map(line => line.split(' ')[2]));
    expect([...results].sort()).toEqual(['aioobe', 'arith', 'neg', 'npe', 'ok']);
    let changed = 0;
    let draws = 0;
    for (let i = 1; i < ours.length; i++) {
        const op = script[i].split(' ', 1)[0];
        if (op !== 'draw' && op !== 'alpha' && op !== 'scale' && op !== 'tint') continue;
        draws++;
        if (ours[i].split(' ')[3] !== ours[i - 1].split(' ')[3]) changed++;
    }
    expect(changed * 4).toBeGreaterThan(draws);
    console.log(`indexedsprite: ${script.length} operations, ${draws} draws, ${changed} changed the framebuffer`);
}, 600000);
