import { expect } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import GameShell from '#/client/GameShell.js';
import LocType from '#/config/LocType.js';
import JagString, { fromJsString } from '#/datastruct/JagString.js';
import Linkable from '#/datastruct/Linkable.js';
import SharedPtrList from '#/datastruct/SharedPtrList.js';
import Pix2D from '#/graphics/Pix2D.js';
import Pix32 from '#/graphics/Pix32.js';
import SoftwareFont from '#/graphics/SoftwareFont.js';
import WorldMapFont from '#/graphics/WorldMapFont.js';
import { mapFontSurface } from '#/graphics/WorldMapFontSurface.js';
import MapElementInstance from '#/ui/MapElementInstance.js';
import WorldMap from '#/ui/WorldMap.js';
import WorldMapLabels from '#/ui/WorldMapLabels.js';
import { requireNonNull } from '#/util/JavaArray.js';
import WrappedException from '#/util/WrappedException.js';
import { loginFixture } from './login-fixture.js';
import { cachePath, gamepackPath } from './reference.js';
import { localAssets } from './cachefile.js';

function cases(): number[][] {
    const rows: number[][] = [];
    const direct = [0x29800, 62000, 56, 76, 9, 54, -4147, 77, 0x381ff, 15];
    const scaled = [5, 51, 156, 82, 50, 84, 115, 8];
    const label = [2, 51, 50, 170, 127, 82, 84, 1];
    for (const op of [0, 1]) {
        const args = op === 0 ? direct : scaled;
        for (const fault of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]) {
            for (const mask of [0, 1, 2, 3, 4, 5]) rows.push([op, fault, mask, 4, 5, 1, ...args]);
        }
        for (const tick of [-2147483648, -20, -5, 0, 1, 5, 10, 11, 17, 20, 21, 127, 2147483647]) {
            for (const clip of [0, 1, 2]) rows.push([op, 0, 1, 4, tick, clip, ...args]);
        }
    }
    for (const scale of [0, -65536, 65535, 65536, 98000, 1 << 20, 2147483647]) {
        for (const index of [0, 8]) {
            const args = direct.slice();
            args[index] = scale;
            rows.push([0, 0, 1, 4, 19, 0, ...args]);
        }
    }
    for (const [i, v] of [
        [5, 51],
        [3, 50],
        [0, 115],
        [2, 8],
        [1, 63],
        [1, 71],
        [5, 129],
        [1, -17]
    ]) {
        const args = scaled.slice();
        args[i] = v;
        rows.push([1, 0, 1, 4, 10, 1, ...args]);
    }
    for (const zoom of [-1, 0, 2, 3, 31, 4, 5, 6, 7, 8, 81, 10, 12, 128]) {
        for (const mask of [0, 8]) for (const clip of [0, 1, 2]) rows.push([2, 0, mask, zoom, 0, clip, ...label]);
    }
    for (const fault of [11, 12, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36]) {
        for (const zoom of [3, 4, 6, 7, 8]) rows.push([2, fault, 8, zoom, 0, 1, ...label]);
    }
    for (const [i, v] of [
        [5, 50],
        [6, 51],
        [5, 39],
        [3, -170],
        [0, 2147483647],
        [1, -2000000000],
        [7, 2147483647]
    ]) {
        const args = label.slice();
        args[i] = v;
        rows.push([2, 0, 0, 6, 0, 1, ...args]);
    }
    for (let flags = 0; flags < 256; flags++) rows.push([2, 37, flags, 4, 0, 1, ...label]);
    for (const zoom of [3, 4, 6, 8, 10]) for (const focus of [0, 5, 27]) for (const clip of [0, 1]) rows.push([3, 0, 0, zoom, focus, clip, ...label]);
    return rows;
}

function pixels(length: number, id: number) {
    const a = new Int32Array(length);
    for (let i = 0; i < length; i++) a[i] = i % 7 === 1 ? 0 : 0xff000000 ^ Math.imul(i, 0x7231a59) ^ Math.imul(id, 0x8ab329);
    return a;
}
function lines(a: (JagString | null)[] | null): string {
    if (a === null) return '-';
    const seen = new Map<JagString, number>();
    return a
        .map(s => {
            if (s === null) return '-';
            if (!seen.has(s)) seen.set(s, seen.size);
            return seen.get(s) + ':' + s.length + ':' + Buffer.from(requireNonNull(s.bytes)).toString('base64');
        })
        .join(',');
}
function failure(error: unknown): string {
    const contexts: string[] = [];
    let e = error;
    while (e instanceof WrappedException) {
        contexts.unshift(...(e.context ?? '').split(' ').filter(c => /^(e\.C|mj\.A|ik\.F)\(/.test(c)));
        e = e.cause;
    }
    const result =
        e instanceof TypeError ? (e.message.includes('ClassCastException') ? 'cast' : 'null') : e instanceof RangeError ? (e.message.includes('zero') ? 'arithmetic' : 'bounds') : e instanceof Error && e.message === 'sprite' ? 'state' : String(e);
    return [result, ...contexts].join('/');
}

function observe(p: number[], fonts: WorldMapFont[], mainLabels: WorldMapLabels): string {
    const [op, initialFault, mask, zoom, ticks, clip] = p;
    let fault = initialFault;
    const trace: string[] = [];
    Pix2D.setPixels(pixels(182 * 135, 9), 182, 135);
    if (clip === 1) Pix2D.setClipping(11, 9, 125, 103);
    if (clip === 2) Pix2D.setClipping(61, 65, 61, 65);
    WorldMap.zoom = zoom === -1 ? NaN : zoom === 31 ? 3.25 : zoom === 81 ? 8.125 : zoom;
    WorldMap.baseX = 500;
    WorldMap.baseZ = 590;
    WorldMap.height = 128;
    WorldMap.flashTicks = ticks;
    WorldMap.flashCount = ticks === -20 ? 0 : 2;
    WorldMap.flashingIcon = 1;
    const first = (WorldMap.deferredIcons = new SharedPtrList<MapElementInstance>());
    const seedNode = new MapElementInstance();
    seedNode.mapFunction = 2;
    seedNode.x = 75;
    seedNode.z = 38;
    if (mask & 1) first.push_back(seedNode);
    if (mask & 2) (first as SharedPtrList<Linkable>).push_back(new Linkable());
    const map = (WorldMap.locIds = Array.from({ length: 2 }, () => Array.from({ length: 2 }, () => new Int32Array(4096))));
    for (const [x, y, id] of [
        [63, 64, 100],
        [61, 63, 101],
        [65, 68, 102],
        [70, 58, 101],
        [52, 71, 100],
        [68, 61, 101],
        [72, 69, 102],
        [13, 0, 100],
        [126, 127, 102]
    ]) {
        map[x >> 6][y >> 6][(x & 63) + ((y & 63) << 6)] = id + 1;
    }
    class Sprite extends Pix32 {
        constructor(readonly id: number) {
            super(14, 14, id, 2, 9, 10, pixels(90, id));
        }
        override draw(x: number, y: number) {
            trace.push(this.id + '@' + x + ',' + y);
            if (this.id === 1 && fault === 17) {
                WorldMap.deferredIcons = new SharedPtrList();
                fault = 0;
            }
            if (this.id === 1 && fault === 18) throw Error('sprite');
            super.draw(x, y);
        }
    }
    WorldMap.mapFunctions = [0, 1, 2].map(i => new Sprite(i));
    WorldMap.disabled = [false, (mask & 4) !== 0, false];
    LocType.m_recentUse.Reset();
    for (let i = 0; i < 3; i++) {
        const loc = new LocType();
        loc.mapFunction = i;
        LocType.m_recentUse.Put(BigInt(100 + i), loc);
    }
    const labels = (WorldMap.labels = new WorldMapLabels(5));
    ['Lake<br>Isle', 'Port @red@W', 'Icy <br>Tör<br>Three', 'Hide', 'Last'].forEach((word, i) => {
        labels.text[i] = fromJsString(word);
        labels.flags[i] = [8, 9, 10, 16, 11][i];
        labels.x[i] = 558 + i * 3;
        labels.z[i] = 659 - i * 3;
        labels.colors[i] = i === 1 ? 0xac5019 : -1;
    });
    if (mask & 8) {
        labels.flags[0] = 26;
        labels.colors[0] = 0xf00023;
        labels.flags[1] = 8;
        labels.colors[1] = -1;
        labels.flags[2] = 9;
    }
    WorldMap.labelLines = Array<JagString | null>(5).fill(null);
    WorldMap.labelLines[4] = WorldMap.labelLines[3] = fromJsString('tail');
    Client.fontPlain11 = new SoftwareFont(new Uint8Array(257));
    [WorldMap.font11, WorldMap.font12, WorldMap.font14, WorldMap.font17, WorldMap.font19, WorldMap.font22, WorldMap.font26, WorldMap.font30] = fonts;
    switch (fault) {
        case 1:
            WorldMap.deferredIcons = null;
            break;
        case 2:
            WorldMap.disabled = null;
            break;
        case 3:
            WorldMap.disabled = [false];
            break;
        case 4:
            WorldMap.mapFunctions = null;
            break;
        case 5:
            WorldMap.mapFunctions = [new Sprite(0)];
            break;
        case 6:
            WorldMap.mapFunctions[2] = null;
            break;
        case 7:
            WorldMap.locIds = null;
            break;
        case 8:
            Object.assign(map, { 1: null });
            break;
        case 9:
            map[0][1] = new Int32Array(12);
            break;
        case 10:
            Object.assign(map[1], { 1: null });
            break;
        case 11:
            Pix2D.pixels = new Int32Array(6700);
            break;
        case 12:
            Pix2D.pixels = null;
            break;
        case 13:
            seedNode.mapFunction = -1;
            break;
        case 14:
            seedNode.mapFunction = 3;
            break;
        case 15: {
            const loc = new LocType();
            loc.mapFunction = -1;
            LocType.m_recentUse.Put(102n, loc);
            break;
        }
        case 16:
            map[1] = [];
            break;
        case 20:
            WorldMap.labels = null;
            break;
        case 21:
            labels.flags = new Int8Array(1);
            break;
        case 22:
            labels.colors = new Int32Array(2);
            break;
        case 23:
            labels.text[1] = null;
            break;
        case 24:
            labels.z = new Int16Array(1);
            break;
        case 25:
            Object.assign(labels, { x: null });
            break;
        case 26:
            Object.assign(WorldMap, { labelLines: null });
            break;
        case 27:
            WorldMap.labelLines = [null];
            break;
        case 28:
            WorldMap.labelLines = [];
            break;
        case 29:
            Client.fontPlain11 = null;
            break;
        case 30:
            WorldMap.font11 = WorldMap.font17 = WorldMap.font22 = WorldMap.font30 = null;
            break;
        case 31:
            labels.text[0] = fromJsString('1<br>2<br>3<br>4<br>5<br>6');
            break;
        case 32:
            labels.text[0] = fromJsString('');
            break;
        case 33:
            labels.text[1] = labels.text[0];
            break;
        case 34:
            labels.count = 0;
            break;
        case 35:
            Object.assign(labels, { text: null });
            break;
        case 36:
            labels.flags = new Int8Array(5).fill(16);
            break;
        case 37:
            labels.count = 1;
            labels.flags[0] = mask;
            break;
    }
    if (op === 3) {
        WorldMap.labels = mainLabels;
        let ordinal = ticks,
            focus = -1;
        for (let i = 0; i < mainLabels.count; i++)
            if ((mainLabels.flags[i] & 8) !== 0 && ordinal-- === 0) {
                focus = i;
                break;
            }
        if (focus < 0) throw Error('missing label ' + ticks);
        WorldMap.baseX = mainLabels.x[focus] - 67;
        WorldMap.baseZ = mainLabels.z[focus] - WorldMap.height + 1 + 67;
    }
    let result = 'ok';
    try {
        if (op === 0) WorldMap.drawMapFunctions(p[6], p[7], p[8], p[9], p[10], p[11], p[12], p[13], p[14], p[15]);
        if (op === 1) WorldMap.drawScaled(p[6], p[7], p[8], p[9], p[10], p[11], p[12], p[13]);
        if (op >= 2) WorldMap.drawLabels(p[6], p[7], p[8], p[9], p[10], p[11], p[12], p[13]);
    } catch (e) {
        result = failure(e);
    }
    function describe(l: SharedPtrList<MapElementInstance> | null) {
        if (l === null) return '-';
        function node(n: Linkable | null) {
            if (n === null) return '-';
            if (n === l?.sentinel) return 'H';
            if (n instanceof MapElementInstance) return (n === seedNode ? 'S' : 'N') + n.mapFunction + ':' + n.x + ':' + n.z;
            return 'bad';
        }
        const s = [node(l['cursor'])];
        for (let n = l.sentinel.next; n !== l.sentinel; n = requireNonNull(n).next) s.push(node(n));
        return s.join(',');
    }
    let raster;
    if (Pix2D.pixels === null) {
        raster = '-';
    } else {
        raster = createHash('sha256')
            .update(new Uint8Array(Pix2D.pixels.buffer, Pix2D.pixels.byteOffset, Pix2D.pixels.byteLength))
            .digest('hex');
    }
    const raw = op === 3 ? '|' + Buffer.from(requireNonNull(Pix2D.pixels).buffer).toString('base64') : '';
    return [result, raster, trace.join(';'), describe(first), (first === WorldMap.deferredIcons ? 'same:' : 'other:') + describe(WorldMap.deferredIcons), lines(WorldMap.labelLines)].join('|') + raw;
}
loginFixture(
    import.meta.url,
    'world map sprites, highlight queue, clipping and AWT label pixels match the original render methods',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-worldmap-overlays-'));
        try {
            const rows = cases();
            const cc = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, ...['WorldMapFontOracle', 'WorldMapOverlayOracle', 'ProceduralTextureCacheOracle'].map(n => join(import.meta.dir, 'render', n + '.java'))]);
            expect(cc.exitCode, cc.stderr.toString()).toBe(0);
            const original = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'WorldMapOverlayOracle', cachePath], {
                stdin: Buffer.from(rows.map(r => r.join(' ')).join('\n') + '\n'),
                maxBuffer: 16 * 1024 * 1024
            });
            expect(original.exitCode, original.stderr.toString()).toBe(0);
            const results = original.stdout.toString().trimEnd().split(/\r?\n/);
            expect(results.length).toBe(rows.length);
            GameShell.canvas = mapFontSurface;
            const fonts = [11, 12, 14, 17, 19, 22, 26, 30].map(size => new WorldMapFont(size, true, mapFontSurface));
            const mainLabels = WorldMapLabels.load(fromJsString('main_labels'), localAssets(cachePath, [23]).archive(23));
            for (const [i, p] of rows.entries()) expect(observe(p, fonts, mainLabels), p.join(' ')).toBe(results[i]);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    60000
);
