import { expect } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import FloType from '#/config/FloType.js';
import MSIType from '#/config/MSIType.js';
import MSITypeList from '#/config/MSITypeList.js';
import Pix2D from '#/graphics/Pix2D.js';
import Pix8 from '#/graphics/Pix8.js';
import LocalisedText from '#/ui/LocalisedText.js';
import MapArea from '#/ui/MapArea.js';
import WorldMap from '#/ui/WorldMap.js';
import WrappedException from '#/util/WrappedException.js';
import { loginFixture } from './login-fixture.js';
import { gamepackPath } from './reference.js';
import { hdGamepackPath, joglPath } from './render/hd-reference.js';

function state(mode: number) {
    WorldMap.current = new MapArea(null, null, 0, 0, mode === 3 ? 0 : mode === 4 ? 0x1865ba : -1, true, 2);
    WorldMap.width = WorldMap.height = 128;
    FloType.m_defaultWater = 2;
    WorldMap.overlayColors = Int32Array.of(0, 0x990088, -1, 0x218352, 0x774f12);
    function chunks<T>(make: () => T): T[][] {
        return Array.from({ length: 2 }, () => Array.from({ length: 2 }, make));
    }
    const ground = (WorldMap.underlayColors = chunks(() => Int32Array.from({ length: 4096 }, (_, i) => (i % 9 === 0 ? 0 : (0x102030 + i * 0x10115) & 0xffffff))));
    const overlays = (WorldMap.overlayIds = chunks(() => Int8Array.from({ length: 4096 }, (_, i) => i % 5)));
    const upper = (WorldMap.upperOverlayIds = chunks(() => Int8Array.from({ length: 4096 }, (_, i) => ((i / 5) | 0) % 5)));
    const shapes = (WorldMap.overlayShapes = chunks(() => Int8Array.from({ length: 4096 }, (_, i) => (i + 3) % 48)));
    const upperShapes = (WorldMap.upperOverlayShapes = chunks(() => Int8Array.from({ length: 4096 }, (_, i) => (((i / 3) | 0) + 5) % 48)));
    const walls = (WorldMap.wallTypes = chunks(() => Int8Array.from({ length: 4096 }, (_, i) => i % 31)));
    const scenes = (WorldMap.mapScenes = chunks(() => new Int32Array(4096)));
    MSITypeList.CacheReset();
    for (let id = 0; id < 4; id++) {
        const type = new MSIType();
        type.m_tint = (id & 1) === 0 ? 0 : 0x48c0ed;
        type.m_resize = (id & 2) !== 0;
        type.m_spriteID = id + 4;
        MSITypeList.types.Put(BigInt(id), type);
        for (let r = 0; r < 4; r++) MSITypeList.spriteCache.Put(BigInt((r << 16) | type.m_spriteID), new Pix8(5, 4, 1, 1, 3, 2, Uint8Array.of(1, 2, 0, 0, 1, 2), Int32Array.of(0, 0xd27344, 0x337fc2)));
    }
    for (let i = 0; i < 16; i++) scenes[0][0][i + 2 + 64 * ((i % 3) + 1)] = ((i % 4) + 1) | (((i / 4) | 0) << 14) | (2 << 16) | (3 << 20);
    // Install the same null rows as a JVM multidimensional array.
    switch (mode) {
        case 1:
            WorldMap.underlayColors[0] = [null, ground[0][1]];
            break;
        case 2:
            WorldMap.underlayColors[0] = null;
            break;
        case 5:
            WorldMap.overlayColors = null;
            break;
        case 6:
            WorldMap.overlayColors = new Int32Array(2);
            break;
        case 7:
            WorldMap.overlayShapes[0] = [null, shapes[0][1]];
            break;
        case 8:
            WorldMap.upperOverlayShapes[0] = [null, upperShapes[0][1]];
            break;
        case 9:
            walls[0][0] = new Int8Array(1);
            break;
        case 10:
            WorldMap.upperOverlayIds[0] = null;
            break;
        case 11:
            WorldMap.mapScenes[0] = null;
            break;
        case 12:
            scenes[0][0] = new Int32Array(1);
            break;
        case 13:
            WorldMap.mapScenes[0] = [null, scenes[0][1]];
            break;
        case 14:
            WorldMap.underlayColors = null;
            break;
        case 15:
            WorldMap.current = null;
            break;
        case 16:
            WorldMap.mapScenes = null;
            break;
        case 17:
            WorldMap.overlayIds = [];
            break;
        case 19:
            WorldMap.upperOverlayIds[0] = [null, upper[0][1]];
            break;
        case 20:
            WorldMap.overlayIds[0] = [null, overlays[0][1]];
            break;
        case 21:
            upperShapes[0][0] = new Int8Array(3);
            break;
        case 22:
            upper[0][0][1] = -1;
            break;
        case 23:
            WorldMap.upperOverlayIds = [];
            WorldMap.overlayShapes = null;
            break;
        case 24:
            WorldMap.overlayShapes = [];
            WorldMap.wallTypes = null;
            break;
        case 25:
            upper[0][0] = new Int8Array(0);
            WorldMap.overlayIds[0] = null;
            break;
    }
    const pixels = new Int32Array(mode === 18 ? 233 : 45 * 37).fill(0x6a94b3);
    Pix2D.setPixels(pixels, 45, 37);
    Pix2D.setClipping(2, 1, 41, 35);
    return pixels;
}

for (const identity of ['sd', 'gl'] as const) {
    loginFixture(
        import.meta.url,
        identity + ' world-map tile and map-scene passes match each original framebuffer and partial fault',
        async () => {
            const hd = identity === 'gl';
            const oracle = hd ? 'HdWorldMapRenderAreaOracle' : 'WorldMapRenderAreaOracle';
            const classpath = hd ? [hdGamepackPath, joglPath].join(delimiter) : gamepackPath;
            const dir = mkdtempSync(join(tmpdir(), '530-map-area-'));
            try {
                const compile = Bun.spawnSync(['javac', '-cp', classpath, '-d', dir, join(import.meta.dir, hd ? 'hd' : 'game', oracle + '.java')]);
                expect(compile.exitCode, compile.stderr.toString()).toBe(0);
                const rows: number[][] = [];
                for (let mode = 0; mode <= 25; mode++) {
                    for (const area of [
                        [-2, -2, 21, 12],
                        [0, 0, 20, 10],
                        [61, 62, 68, 67],
                        [-68, -64, -59, -57],
                        [-6, 127, 12, 134]
                    ]) {
                        const [x, z, right, bottom] = area;
                        rows.push([mode, 0, right, 137500, z, -4, hd ? -12541 : 0xffffff, x, -70000, 3, bottom, 203350, 0x7500]);
                        rows.push([mode, 1, 48, z, right, 39, bottom, x, -2, 0, hd ? 0x17500 : -91]);
                    }
                    rows.push([mode, 0, 14, 0x10000, 0, 5, 0x123456, 0, 0, 6, 8, 0x10000, 0]);
                    rows.push([mode, 1, 41, 0, 9, 29, 11, 9, 1, 2, -47]);
                }
                for (const scale of [0, -1, 1, 32768, 65536, 0x7fffffff, -0x80000000]) {
                    rows.push([0, 0, 8, scale, 0, -2, 0xffffff, 0, 0x7fffffff, 1, 3, scale, -0x80000000]);
                }
                rows.push([0, 0, -2147483647, 0x20000, 0, 0, 0xffffff, 2147483646, 0, 0, 2, 0x10000, 0]);
                const proc = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + classpath, oracle], { stdin: Buffer.from(rows.map(v => v.join(' ')).join('\n')), timeout: 20000 });
                expect(proc.exitCode, proc.stderr.toString()).toBe(0);
                const expected = proc.stdout.toString().trimEnd().split(/\r?\n/);
                expect(expected).toHaveLength(rows.length);
                const originalLabel = LocalisedText.englishStarted3dLibrary;
                for (const [index, v] of rows.entries()) {
                    const pixels = state(v[0]);
                    LocalisedText.englishStarted3dLibrary = originalLabel;
                    Client.jingleActive = true;
                    let fault = 'ok',
                        context = '';
                    try {
                        if (hd && v[1] === 0) WorldMap.renderAreaHd(v[9], v[12], v[10], v[4], v[2], v[5], v[7], v[3], v[11], v[8], v[6]);
                        else if (hd) WorldMap.drawTilesHd(v[2], v[8], v[10], v[4], v[3], v[9], v[6], v[5], v[7]);
                        else if (v[1] === 0) WorldMap.renderArea(v[2], v[3], v[4], v[5], v[6], v[7], v[8], v[9], v[10], v[11], v[12]);
                        else WorldMap.drawTiles(v[2], v[3], v[4], v[5], v[6], v[7], v[8], v[9], v[10]);
                    } catch (e) {
                        let error: unknown = e;
                        if (error instanceof WrappedException) {
                            context = error.context?.match(/(?:ob\.G|jf\.AC|le\.C|rg\.SA|wl\.C)\(.*$/)?.[0] ?? '';
                            error = error.cause;
                        }
                        fault = error instanceof TypeError ? 'null' : error instanceof RangeError ? (error.message === '/ by zero' ? 'divide' : 'bounds') : String(error);
                    }
                    const bytes = Buffer.alloc(4 * pixels.length);
                    pixels.forEach((p, i) => bytes.writeInt32BE(p, 4 * i));
                    const hash = createHash('sha256').update(bytes).digest('hex');
                    expect([fault, context, hd ? Client.jingleActive : LocalisedText.englishStarted3dLibrary === originalLabel, hash].join('|'), v.join(' ')).toBe(expected[index]);
                }
            } finally {
                rmSync(dir, { recursive: true, force: true });
            }
        },
        30000,
        identity
    );
}
