import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Js5 from '#/cache/Js5.js';
import Js5Index from '#/cache/Js5Index.js';
import { glJar } from '#/client/ClientVariant.js';
import GlModel from '#/dash3d/GlModel.js';
import GroundShadowBlock from '#/dash3d/GroundShadowBlock.js';
import GroundShadows from '#/dash3d/GroundShadows.js';
import ModelLitImpl from '#/dash3d/ModelLitImpl.js';
import Occlude from '#/dash3d/Occlude.js';
import Sprite from '#/dash3d/Sprite.js';
import Square from '#/dash3d/Square.js';
import TerrainBatch from '#/dash3d/TerrainBatch.js';
import TextureCache from '#/dash3d/TextureCache.js';
import world from '#/dash3d/world.js';
import LruHashTable from '#/datastruct/LruHashTable.js';
import SecondaryNode from '#/datastruct/SecondaryNode.js';
import GlCleaner from '#/gl/GlCleaner.js';
import GlRenderer from '#/gl/GlRenderer.js';
import PointLightManager from '#/gl/PointLightManager.js';
import Pix8 from '#/graphics/Pix8.js';
import Crc32 from '#/io/Crc32.js';
import PacketT from '#/io/PacketT.js';
import type { GL } from '#/jogl/GL.js';
import ByteBuffer from '#/util/nio/ByteBuffer.js';
import { gamepackPath } from '../reference.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

// The renderer members the HD window-mode switch (pm.a(ZIZIZII)V) and the shared rebuild (lb.a(Z)V) call, against the
// original gamepacks (HdModeSwitchApisOracle.java prints the same lines from the real classes):
//   HD w.m()V / w.o()V          ModelLitImpl.allocateGlScratch / allocateSoftwareScratch (SD: fc.<clinit> state)
//   HD nk.k(II)V / nk.b(I)V     TextureCache#setCapacity / ClearCache (SD: kg.a(I)V ClearCache)
//   HD hg.a()V                  TerrainBatch.unload
//   HD fc.a()V                  world.ResetMap (SD: ng.e()V)
//   HD tj.a(II)V / tj.a()V      GroundShadows.init / unload, with wm.<init>()V (GroundShadowBlock) over a logging GL
//   HD ek.<init>(III)V          Pix8's three-argument constructor (both jars: the 8-argument one)
//   HD td.v()V                  GlModel.resetTempModels, with td.<init>()V
//   HD jf.a / jf.l              PointLightManager.lights / lightCount (<clinit> values)
// Each gamepack runs in its own child process with the matching RS530_GAMEPACK_IDENTITY, so every class starts from
// its <clinit> values; the touched statics are put back afterwards all the same.

type Statics = Record<string, unknown>;

function tag(e: unknown): string {
    if (e instanceof TypeError) return 'NPE';
    if (e instanceof RangeError) return /array index/.test(e.message) ? 'AIOOBE' : 'NegativeArraySize';
    throw e;
}

function attempt(run: () => void): string | null {
    try {
        run();
        return null;
    } catch (e) {
        return tag(e);
    }
}

function dirtyInts(a: Int32Array | Uint8Array): boolean {
    for (const v of a) if (v !== 0) return true;
    return false;
}

function arr(a: unknown): string {
    if (a === null || a === undefined) return 'null';
    if (a instanceof Int32Array) return 'I' + a.length + (dirtyInts(a) ? '!' : '');
    if (a instanceof Uint8Array) return 'B' + a.length + (dirtyInts(a) ? '!' : '');
    const rows = a as unknown[];
    if (rows.length > 0 && rows[0] instanceof Int32Array) {
        const cols = new Set<string>();
        let dirty = false;
        for (const row of rows as (Int32Array | null)[]) {
            if (row === null) {
                cols.add('null');
                continue;
            }
            cols.add(String(row.length));
            dirty ||= dirtyInts(row);
        }
        return 'I' + rows.length + 'x' + [...cols].sort().join('/') + (dirty ? '!' : '');
    }
    return 'L' + rows.length + ':' + rows.filter(o => o !== null && o !== undefined).length;
}

function leaves(a: unknown): number {
    if (a === null || a === undefined) return 0;
    if (!Array.isArray(a)) return 1;
    let count = 0;
    for (const e of a) count += leaves(e);
    return count;
}

function deep(a: unknown): string {
    if (a === null || a === undefined) return 'null';
    const dims: number[] = [];
    let probe: unknown = a;
    while (Array.isArray(probe)) {
        dims.push(probe.length);
        probe = probe.length > 0 ? probe[0] : null;
    }
    return '[' + dims.join(',') + ']:' + leaves(a);
}

function ident(now: unknown, before: unknown): string {
    if (now === null || now === undefined) return '-';
    return now === before ? 's' : 'n';
}

function mark(a: unknown): void {
    if (a instanceof Int32Array && a.length > 0) a[0] = 1;
    if (Array.isArray(a) && a.length > 0 && a[0] instanceof Int32Array && a[0].length > 0) a[0][0] = 1;
}

// ---- ModelLitImpl ----

const MODEL = ['sortFaceDepths', 'sortFaceIndices', 'tmpDepthFaceCount', 'tmpDepthFaces', 'tmpExtendedDepthFaceCount', 'tmpExtendedDepthFaces'];

function modelArrays(): unknown[] {
    return MODEL.map(key => Reflect.get(ModelLitImpl, key));
}

function modelState(step: string, before: unknown[] | null): string {
    const now = modelArrays();
    const keys = ['d', 'i', 'c', 'f', 'xc', 'xf'];
    let s = 'model ' + step + ' q=' + Reflect.get(ModelLitImpl, 'useQuickSort');
    for (let i = 0; i < 6; i++) s += ' ' + keys[i] + '=' + arr(now[i]);
    s += ' ids=';
    for (let i = 0; i < 6; i++) s += before === null ? (now[i] === null ? '-' : 'n') : ident(now[i], before[i]);
    return s;
}

function model(out: string[]): void {
    out.push(modelState('clinit', null));
    if (!glJar) return;
    for (const step of ['m', 'm', 'o', 'o', 'm', 'o']) {
        const before = modelArrays();
        for (const a of before) mark(a);
        if (step === 'm') ModelLitImpl.allocateGlScratch();
        else ModelLitImpl.allocateSoftwareScratch();
        out.push(modelState(step, before));
    }
}

// ---- TextureCache ----

// test/texture-cache-fixture.ts's zero-entry materials table, with capacity 7.
function newTextureCache(capacity: number): TextureCache {
    const bytes = Buffer.from('0000000012050000010000000000000000000000010000', 'hex');
    const index = new Js5Index(bytes, Crc32.prefix(bytes, bytes.length));
    const materials = new Js5(
        {
            index: () => index,
            group: () => Uint8Array.of(0, 0, 0, 0, 2, 0, 0),
            prefetchGroup() {},
            GetGroupLoadPercentage: () => 100
        },
        false,
        false
    );
    return new TextureCache(null, materials, null, capacity, false);
}

function lru(table: LruHashTable | null): string {
    if (table === null) return 'null';
    const hash = table['table'];
    let entries = 0;
    for (const sentinel of hash.buckets) {
        for (let node = sentinel.next; node !== sentinel; node = node === null ? null : node.next) {
            if (node === null) throw new TypeError('broken bucket');
            entries++;
        }
    }
    return '[size=' + table['m_cacheSize'] + ' rem=' + table['remaining'] + ' buckets=' + hash.buckets.length + ' entries=' + entries + ' head=' + (table.head() === null ? 'null' : 'set') + ']';
}

function tcState(step: string, cache: TextureCache, primaryBefore: unknown, secondaryBefore: unknown): string {
    const primary = cache['recentUse'];
    const secondary = cache['secondaryCache'];
    return 'tc ' + step + ' cap=' + cache['capacity'] + ' P=' + ident(primary, primaryBefore) + lru(primary) + ' G=' + ident(secondary, secondaryBefore) + lru(secondary);
}

function put(table: LruHashTable | null, key: number): void {
    if (table === null) throw new TypeError('no LRU');
    table.Put(BigInt(key), new SecondaryNode());
}

function textureCache(out: string[]): void {
    const cache = newTextureCache(7);
    const p = cache['recentUse'];
    put(p, 1);
    put(p, 2);
    out.push(tcState('start', cache, p, null));
    if (glJar) {
        GlRenderer.active = false;
        cache.setCapacity(200);
        out.push(tcState('cap200-sw', cache, p, null));
        const p1 = cache['recentUse'],
            g1 = cache['secondaryCache'];
        GlRenderer.active = true;
        cache.setCapacity(20);
        out.push(tcState('cap20-gl', cache, p1, g1));
        GlRenderer.active = false;
    } else {
        cache['capacity'] = 20;
        cache['recentUse'] = new LruHashTable(20);
        cache['secondaryCache'] = new LruHashTable(20);
    }
    const p2 = cache['recentUse'],
        g2 = cache['secondaryCache'];
    put(p2, 1);
    put(p2, 2);
    put(g2, 3);
    put(g2, 4);
    put(g2, 5);
    out.push(tcState('filled', cache, p2, g2));
    cache.ClearCache();
    out.push(tcState('clear', cache, p2, g2));
    cache['secondaryCache'] = null;
    put(p2, 9);
    cache.ClearCache();
    out.push(tcState('clear-noG', cache, p2, null));
}

// ---- TerrainBatch ----

const TERRAIN = ['indices', 'blendIndices', 'indexBuffer', 'blendIndexBuffer'];

function tbState(step: string): string {
    let s = 'tb ' + step;
    ['U', 'K', 'Q', 'J'].forEach((f, i) => {
        s += ' ' + f + '=' + (Reflect.get(TerrainBatch, TERRAIN[i]) === null ? 'null' : 'set');
    });
    return s;
}

function terrainBatch(out: string[]): void {
    if (!glJar) return;
    out.push(tbState('clinit'));
    Reflect.set(TerrainBatch, 'indices', new PacketT(4));
    Reflect.set(TerrainBatch, 'blendIndices', new PacketT(8));
    Reflect.set(TerrainBatch, 'indexBuffer', ByteBuffer.allocateDirect(4));
    Reflect.set(TerrainBatch, 'blendIndexBuffer', ByteBuffer.allocateDirect(8));
    out.push(tbState('set'));
    TerrainBatch.unload();
    out.push(tbState('unload'));
}

// ---- world.ResetMap ----

function squares(d0: number, d1: number, d2: number): (Square | null)[][][] {
    return Array.from({ length: d0 }, () => Array.from({ length: d1 }, () => Array.from({ length: d2 }, () => Object.create(Square.prototype) as Square)));
}

function partly<T>(prototype: object, length: number, count: number): (T | null)[] {
    return Array.from({ length }, (_, i) => (i < count ? (Object.create(prototype) as T) : null));
}

function batches(): void {
    world.mainTerrainBatches = new Array<null>(4).fill(null);
    world.underwaterTerrainBatches = new Array<null>(1).fill(null);
}

function worldState(step: string, thrown: string | null): string {
    let s = 'world ' + step + (thrown === null ? '' : ' threw ' + thrown);
    s += ' main=' + deep(world.mainLevelTiles) + ' under=' + deep(world.underwaterSquares);
    s += ' numOcc=' + world.numOccluders + ' occ=' + deep(world.occluders);
    s += ' dyn=' + deep(world.dynamicSprites) + ' dynCount=' + world.dynamicCount + ' buf=' + deep(world.spriteBuffer);
    if (glJar) s += ' kb=' + (world.mainTerrainBatches === null ? 'null' : 'set') + ' R=' + (world.underwaterTerrainBatches === null ? 'null' : 'set');
    return s;
}

function worldReset(out: string[]): void {
    if (glJar) out.push('world clinit kb=' + (world.mainTerrainBatches === null ? 'null' : 'set') + ' R=' + (world.underwaterTerrainBatches === null ? 'null' : 'set'));
    world.mainLevelTiles = squares(2, 4, 5);
    world.maxTileX = 3;
    world.maxTileZ = 4;
    world.underwaterSquares = squares(1, 4, 5);
    world.numOccluders = 5;
    world.occluders = partly<Occlude>(Occlude.prototype, 10, 7);
    world.dynamicSprites = partly<Sprite>(Sprite.prototype, 10, 6);
    world.dynamicCount = 4;
    world.spriteBuffer = partly<Sprite>(Sprite.prototype, 3, 3);
    if (glJar) batches();
    out.push(worldState('A-before', null));
    out.push(
        worldState(
            'A',
            attempt(() => world.ResetMap())
        )
    );
    world.mainLevelTiles = null;
    world.underwaterSquares = null;
    world.occluders = null;
    world.dynamicSprites = null;
    world.spriteBuffer = null;
    world.numOccluders = 9;
    world.dynamicCount = 9;
    if (glJar) batches();
    out.push(
        worldState(
            'B',
            attempt(() => world.ResetMap())
        )
    );
    world.mainLevelTiles = squares(1, 2, 2);
    world.maxTileX = 3;
    world.maxTileZ = 2;
    world.underwaterSquares = squares(1, 2, 2);
    if (glJar) batches();
    out.push(
        worldState(
            'C',
            attempt(() => world.ResetMap())
        )
    );
    world.mainLevelTiles = squares(1, 3, 2);
    world.maxTileX = 3;
    world.maxTileZ = 2;
    world.underwaterSquares = squares(1, 2, 2);
    if (glJar) batches();
    out.push(
        worldState(
            'D',
            attempt(() => world.ResetMap())
        )
    );
}

// ---- GroundShadows ----

function pix8(p: Pix8 | null): string {
    if (p === null) return 'null';
    return '{w=' + p.width + ' h=' + p.height + ' cw=' + p.cropW + ' ch=' + p.cropH + ' x=' + p.xOffset + ' y=' + p.yOffset + ' px=' + arr(p.pixels) + ' pal=' + arr(p['palette']) + '}';
}

function blocks(b: (GroundShadowBlock | null)[][] | null): string {
    if (b === null) return 'null';
    return '[' + b.map(row => row.map(w => (w === null ? 'null' : w.dirty + '/' + w['coverageHash'] + '/' + w['textureId'])).join(',')).join(';') + ']';
}

function gsState(step: string, thrown: string | null): string {
    return (
        'gs ' +
        step +
        (thrown === null ? '' : ' threw ' + thrown) +
        ' e=' +
        GroundShadows['widthBlocks'] +
        ' c=' +
        GroundShadows['lengthBlocks'] +
        ' a=' +
        pix8(GroundShadows.shadowMap) +
        ' d=' +
        arr(GroundShadows.shadowSprites) +
        ' b=' +
        blocks(GroundShadows.blocks) +
        ' mem=' +
        GlCleaner.textureMemory +
        ' bound=' +
        GlRenderer['boundTexture']
    );
}

// The Java side's java.lang.reflect.Proxy GL: logs each call, hands out texture names from 1000.
function loggingGl(log: string[]): GL {
    let nextName = 1000;
    return new Proxy(
        {},
        {
            get: (_target, name) => {
                return (...args: unknown[]) => {
                    log.push(String(name) + '(' + args.map(a => (a instanceof Int32Array ? 'I[' + a.length + ']' : String(a))).join(',') + ')');
                    if (name === 'glGenTextures') {
                        const [n, names, offset] = args as [number, Int32Array, number];
                        for (let i = 0; i < n; i++) names[offset + i] = nextName++;
                    }
                    return undefined;
                };
            }
        }
    ) as unknown as GL;
}

function groundShadows(out: string[]): void {
    if (!glJar) return;
    const log: string[] = [];
    const flush = () => {
        for (const s of log) out.push('gl ' + s);
        log.length = 0;
    };
    out.push(gsState('clinit', null));
    GlRenderer.gl = loggingGl(log);
    GlRenderer['boundTexture'] = -1;
    GroundShadows.shadowSprites = new Array<Pix8 | null>(2).fill(null);
    for (const [width, length] of [
        [104, 104],
        [0, 0],
        [1, 9],
        [-9, 104],
        [-9, -9],
        [2147483647, 8],
        [16, 8]
    ]) {
        const thrown = attempt(() => GroundShadows.init(width, length));
        out.push(gsState('init ' + width + 'x' + length, thrown));
        flush();
    }
    out.push(
        gsState(
            'unload',
            attempt(() => GroundShadows.unload())
        )
    );
    GlRenderer.gl = null;
    out.push(
        gsState(
            'init-nogl 16x8',
            attempt(() => GroundShadows.init(16, 8))
        )
    );
    out.push(
        gsState(
            'unload',
            attempt(() => GroundShadows.unload())
        )
    );
}

// ---- Pix8 ----

function pix8s(out: string[]): void {
    out.push('pix8 ctor8 ' + pix8(new Pix8(3, 4, 1, 2, 5, 6, new Uint8Array(30), new Int32Array(2))));
    if (!glJar) return;
    for (const [w, h, p] of [
        [5, 7, 3],
        [0, 0, 0],
        [1, 1, 256],
        [-1, 5, 0],
        [3, 4, -1],
        [65536, 65536, 0],
        [-3, -4, 2]
    ]) {
        const key = 'pix8 ctor3 ' + w + ',' + h + ',' + p + ' ';
        try {
            out.push(key + pix8(new Pix8(w, h, p)));
        } catch (e) {
            out.push(key + 'threw ' + tag(e));
        }
    }
}

// ---- GlModel ----

const TEMP: [string, string][] = [
    ['bb', 'tempActorStorage'],
    ['jb', 'tempActorModel'],
    ['mb', 'tempSpotStorage'],
    ['nb', 'tempSpotModel'],
    ['ob', 'tempLocStorage'],
    ['pb', 'tempLocModel']
];

function temps(): (GlModel | null)[] {
    return TEMP.map(([, key]) => Reflect.get(GlModel, key) as GlModel | null);
}

function models(step: string, before: (GlModel | null)[] | null): string {
    let s = 'glmodel ' + step;
    const now = temps();
    const distinct = new Set<GlModel>();
    now.forEach((m, i) => {
        s += ' ' + TEMP[i][0] + '=';
        if (m === null) {
            s += 'null';
            return;
        }
        distinct.add(m);
        s += (before === null ? 'n' : ident(m, before[i])) + '{' + [m.shareLight, m.vertexCount, m.expandedVertexCount, m['deferredUpdateMask'], m['bufferFlags'], m['faceCount'], m.useAABBMouseCheck].join(',') + '}';
    });
    return s + ' distinct=' + distinct.size;
}

function glModel(out: string[]): void {
    if (!glJar) return;
    out.push(models('clinit', null));
    const before = temps();
    for (const m of before) {
        if (m === null) throw new TypeError('missing scratch model');
        m.vertexCount = 5;
        m['faceCount'] = 9;
        m.shareLight = true;
        m.useAABBMouseCheck = true;
    }
    GlModel.resetTempModels();
    out.push(models('reset', before));
    const again = temps();
    GlModel.resetTempModels();
    out.push(models('reset2', again));
}

// ---- PointLightManager ----

function pointLights(out: string[]): void {
    if (!glJar) return;
    out.push('plm clinit a=' + arr(PointLightManager.lights) + ' l=' + PointLightManager.lightCount);
}

// ---- driver ----

function snapshot(entries: [object, string[]][]): () => void {
    const saved = entries.map(([target, keys]) => [target, keys.map(key => [key, (target as Statics)[key]] as const)] as const);
    return () => {
        for (const [target, values] of saved) for (const [key, value] of values) (target as Statics)[key] = value;
    };
}

function javaLines(): string[] {
    const dir = mkdtempSync(join(tmpdir(), 'rs530-modeswitch-apis-'));
    try {
        const javac = Bun.spawnSync(['javac', '-encoding', 'UTF-8', '-d', dir, join(import.meta.dir, 'HdModeSwitchApisOracle.java')]);
        expect(javac.exitCode, javac.stderr.toString()).toBe(0);
        const cp = [dir, ...(glJar ? [hdGamepackPath, joglPath] : [gamepackPath])].join(delimiter);
        const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', cp, 'HdModeSwitchApisOracle', glJar ? 'hd' : 'sd'], { maxBuffer: 16 * 1024 * 1024 });
        expect(java.exitCode, java.stderr.toString()).toBe(0);
        return java.stdout.toString().trimEnd().split(/\r?\n/);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

function compare(): void {
    const expected = javaLines();
    const restore = snapshot([
        [ModelLitImpl, ['useQuickSort', ...MODEL]],
        [GlRenderer, ['active', 'gl', 'boundTexture']],
        [GlCleaner, ['textureMemory']],
        [TerrainBatch, TERRAIN],
        [world, ['mainLevelTiles', 'maxTileX', 'maxTileZ', 'underwaterSquares', 'numOccluders', 'occluders', 'dynamicSprites', 'dynamicCount', 'spriteBuffer', 'mainTerrainBatches', 'underwaterTerrainBatches']],
        [GroundShadows, ['shadowMap', 'blocks', 'lengthBlocks', 'shadowSprites', 'widthBlocks']],
        [GlModel, TEMP.map(([, key]) => key)],
        [PointLightManager, ['lights', 'lightCount']]
    ]);
    const actual: string[] = [];
    try {
        model(actual);
        textureCache(actual);
        terrainBatch(actual);
        worldReset(actual);
        groundShadows(actual);
        pix8s(actual);
        glModel(actual);
        pointLights(actual);
    } finally {
        restore();
    }
    const first = expected.findIndex((line, i) => actual[i] !== line);
    if (first >= 0) expect(actual[first], (glJar ? 'hd' : 'sd') + ' line ' + first).toBe(expected[first]);
    expect(actual.length).toBe(expected.length);
    console.log((glJar ? 'hd' : 'sd') + ': ' + expected.length + ' lines identical (' + expected.filter(l => l.startsWith('gl ')).length + ' GL calls)');
}

test('the HD mode-switch renderer members match both original gamepacks', () => {
    if (process.env.RS530_MODESWITCH_APIS_CHILD === '1') {
        compare();
        return;
    }
    for (const identity of ['sd', 'gl']) {
        const env: Record<string, string | undefined> = { ...process.env, RS530_MODESWITCH_APIS_CHILD: '1' };
        if (identity === 'gl') env.RS530_GAMEPACK_IDENTITY = 'gl';
        else delete env.RS530_GAMEPACK_IDENTITY;
        const child = Bun.spawnSync([process.execPath, 'test', fileURLToPath(import.meta.url)], { env, timeout: 150000 });
        const log = child.stdout.toString() + child.stderr.toString();
        expect(child.exitCode, identity + ':\n' + log).toBe(0);
        expect(child.stderr.toString(), identity).toMatch(/^\s*1 pass$/m);
        console.log(log.match(/^(sd|hd): .*$/m)?.[0] ?? identity + ': (no summary)');
    }
}, 300000);
