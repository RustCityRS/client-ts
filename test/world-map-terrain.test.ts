import { requireNonNull } from '#/util/JavaArray.js';
import WrappedException from '#/util/WrappedException.js';
import { expect } from 'bun:test';
import { loginFixture } from './login-fixture.js';
import Pix2D from '#/graphics/Pix2D.js';
import MSITypeList from '#/config/MSITypeList.js';
import { createHash, type Hash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Js5Index from '#/cache/Js5Index.js';
import Js5 from '#/cache/Js5.js';
import Client from '#/client/Client.js';
import ClientBuild from '#/client/ClientBuild.js';
import GameShell from '#/client/GameShell.js';
import { mapFontSurface, type MapAwtFont } from '#/graphics/WorldMapFontSurface.js';
import CollisionMap from '#/dash3d/CollisionMap.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import Pix3D from '#/dash3d/Pix3D.js';
import world from '#/dash3d/world.js';
import { mathRandom } from '#/util/JavaRandom.js';
import { fromLiteral } from '#/datastruct/JagString.js';
import PacketT from '#/io/PacketT.js';
import Crc32 from '#/io/Crc32.js';
import WorldMap from '#/ui/WorldMap.js';
import { gamepackPath, cachePath } from './reference.js';
import { localAssets, readGroup } from './cachefile.js';
import { freshWorldMap } from './world-map-fixture.js';

function word(n: number): Buffer {
    const w = Buffer.alloc(4);
    w.writeInt32BE(n);
    return w;
}

type Data = null | Int32Array | Int8Array | Data[];
function digest(data: Data): string {
    const hash = createHash('sha256');
    function write(d: Hash, v: Data): void {
        d.update(word(v === null ? -1 : v.length));
        if (v instanceof Int8Array) d.update(v);
        else if (v instanceof Int32Array) {
            const b = Buffer.alloc(v.length * 4);
            for (let i = 0; i < v.length; i++) b.writeInt32BE(v[i], i * 4);
            d.update(b);
        } else if (v !== null) for (const chunk of v) write(d, chunk);
    }
    write(hash, data);
    return hash.digest('hex');
}

function mapGlobals() {
    const timer = GameShell.timer,
        canvas = GameShell.canvas,
        updates = GameShell.m_updateTime.slice(),
        draws = GameShell.m_drawTime.slice();
    const ticks = GameShell.m_updateCount,
        maps = CollisionMap.levelMaps.slice(),
        active = Client.activeClient;
    const palette = Pix3D.colourTable,
        textures = Pix3D.textureProvider;
    const state = Client.gameState,
        player = Client.localPlayer,
        baseX = Client.mapBuildBaseX,
        baseZ = Client.mapBuildBaseZ;
    const hue = ClientBuild.m_hueOff,
        light = ClientBuild.m_ligOff;
    const scene = Object.getOwnPropertyDescriptors(world);
    return {
        [Symbol.dispose]() {
            GameShell.timer = timer;
            GameShell.canvas = canvas;
            GameShell.m_updateTime.set(updates);
            GameShell.m_drawTime.set(draws);
            GameShell.m_updateCount = ticks;
            CollisionMap.levelMaps.splice(0, 4, ...maps);
            Client.activeClient = active;
            Pix3D.colourTable = palette;
            Pix3D.textureProvider = textures;
            Client.gameState = state;
            Client.localPlayer = player;
            Client.mapBuildBaseX = baseX;
            Client.mapBuildBaseZ = baseZ;
            ClientBuild.m_hueOff = hue;
            ClientBuild.m_ligOff = light;
            Object.defineProperties(world, scene);
        }
    };
}

loginFixture(
    import.meta.url,
    'lg.b loads every main-map tile and icon group with the same bytes, links, loading stages and packet cursors as the jar',
    async () => {
        using _state = freshWorldMap();
        using _globals = mapGlobals();
        const ids = [23, 2, 16, 22, 8],
            assets = localAssets(cachePath, ids),
            binary: Uint8Array[] = [];
        for (const id of ids) {
            const table = readGroup(cachePath, 255, id);
            binary.push(word(table.length), table);
            for (const group of requireNonNull(new Js5Index(table, Crc32.prefix(table, table.length)).groupIds)) {
                const bytes = readGroup(cachePath, id, group);
                binary.push(word(bytes.length), bytes);
            }
        }
        Client.worldMapArchive = assets.archive(23);
        WorldMap.init([], Client.worldMapArchive);
        WorldMap.open(fromLiteral('main'));
        Client.activeClient = null;
        Client.localPlayer = new ClientPlayer();
        Client.localPlayer.x = 3328;
        Client.localPlayer.z = 9856;
        Client.mapBuildBaseX = 32;
        Client.mapBuildBaseZ = 120;
        Client.gameState = 30;
        ClientBuild.m_hueOff = 6;
        ClientBuild.m_ligOff = -5;
        WorldMap.hueOffset = -7;
        WorldMap.randomLightness = 9;
        Pix3D.colourTable = Int32Array.from({ length: 65536 }, (_, i) => (i * 111387 + 5734519) & 0xffffff);
        const unexpected = (): never => {
            throw new Error('Unexpected material lookup');
        };
        Pix3D.textureProvider = { isAvailable: i => i % 3 !== 0, getTextureColour: i => (i * 341) & 65535, getTextureSmall: unexpected, getTextureSolid: unexpected, getTextureData: unexpected, getPixels: unexpected, isLoaded: unexpected };
        let resets = 0;
        GameShell.timer = {
            reset() {
                resets++;
            },
            async wait() {
                return 1;
            }
        };
        for (let i = 0; i < 4; i++) {
            const map = (CollisionMap.levelMaps[i] = new CollisionMap(104, 104));
            map.flags[4][5] = 317 + i;
        }
        world.mainLevelTiles = world.underwaterSquares = null;
        world.spriteBuffer = world.dynamicSprites = null;
        world.numOccluders = 28;
        const fonts: number[] = [];
        GameShell.canvas = {
            ...mapFontSurface,
            getFontMetrics(f: MapAwtFont) {
                expect(f.bold).toBe(true);
                fonts.push(f.size);
                return mapFontSurface.getFontMetrics(f);
            }
        };
        const lines: string[] = [];
        const s = WorldMap;
        do {
            Client.m_ticksSinceNoTimeOutPacket = 27;
            WorldMap.step();
            const icons: number[] = [];
            for (let icon = s.icons.head(); icon !== null; icon = s.icons.next()) icons.push(icon.mapFunction, icon.z, icon.x);
            const state = [
                s.progress,
                s.baseX,
                s.baseZ,
                s.width,
                s.height,
                s.centerX,
                s.centerZ,
                new Int32Array(Float32Array.of(s.zoom).buffer)[0],
                new Int32Array(Float32Array.of(s.targetZoom).buffer)[0],
                s.targetX,
                s.targetZ,
                s.labels?.count ?? -1,
                resets,
                Client.m_ticksSinceNoTimeOutPacket,
                world.numOccluders,
                ...CollisionMap.levelMaps.map(map => requireNonNull(map).flags[4][5]),
                s.font11 !== null,
                s.font12 !== null,
                s.font14 !== null,
                s.font17 !== null,
                s.font19 !== null,
                s.font22 !== null,
                s.font26 !== null,
                s.font30 !== null
            ];
            const data = [s.overlayColors, s.underlayColors, s.overlayIds, s.overlayShapes, s.upperOverlayIds, s.upperOverlayShapes, s.wallTypes, s.mapScenes, s.locIds, Int32Array.from(icons)].map(digest);
            lines.push([...state, ...data].join('/'));
        } while (s.progress < 100);
        MSITypeList.archive = assets.archive(2);
        MSITypeList.spritesArchive = assets.archive(8);
        MSITypeList.redDelta = MSITypeList.greenDelta = MSITypeList.blueDelta = 0;
        const scenes = requireNonNull(s.mapScenes);
        let rendered = false;
        realView: for (let cx = 0; cx < scenes.length; cx++) {
            const column = requireNonNull(scenes[cx]);
            for (let cz = 0; cz < column.length; cz++) {
                const chunk = column[cz];
                if (chunk === null) continue;
                for (let i = 0; i < chunk.length; i++)
                    if ((chunk[i] & 0x3fff) !== 0) {
                        const x = (cx << 6) + (i & 63),
                            z = (cz << 6) + (i >> 6),
                            pixels = new Int32Array(193 * 117).fill(0x2b4059);
                        Pix2D.setPixels(pixels, 193, 117);
                        Pix2D.setClipping(5, 4, 189, 113);
                        s.drawTiles(201, z - 15, x + 23, 125, z + 16, x - 24, -6, -8, -91);
                        lines.push('view/' + x + '/' + z + '/' + digest(pixels));
                        rendered = true;
                        break realView;
                    }
            }
        }
        expect(rendered).toBe(true);
        expect(fonts).toEqual([11, 12, 14, 17, 19, 22, 26, 30]);
        const records: { mode: number; bytes: Buffer }[] = [];
        for (let mode = 0; mode < 4; mode++) {
            for (const inBounds of [true, false]) {
                const bytes = Buffer.from([1, 0, 0, inBounds ? 32 : 0, inBounds ? 39 : 0, 7, 213, 0, 15, 49, 0, 0, 2, ...new Array(63).fill(0)]);
                for (const length of [0, 1, 3, 4, 5, 6, 7, 8, 10, 12, 13, 68, bytes.length]) records.push({ mode, bytes: bytes.subarray(0, length) });
            }
        }
        binary.push(word(records.length));
        for (const { mode, bytes } of records) {
            binary.push(word(mode), word(bytes.length), bytes);
            const p = new PacketT(bytes);
            let failed = false;
            try {
                if (mode === 0) WorldMap.readOverlay(p);
                else if (mode === 1) WorldMap.readUpperOverlay(p);
                else if (mode === 2) WorldMap.readLocs(p);
                else WorldMap.readUnderlay(p);
            } catch {
                failed = true;
            }
            lines.push([mode, p.m_pos, failed].join('/'));
        }
        const edge = (label: string, action: () => void) => {
            let fault = 'ok';
            try {
                action();
            } catch (error) {
                let cause = error;
                while (cause instanceof WrappedException) cause = cause.cause;
                fault = cause instanceof TypeError ? 'null' : cause instanceof RangeError ? 'bounds' : String(cause);
            }
            lines.push(
                [
                    label,
                    fault,
                    s.progress,
                    s.baseX,
                    s.baseZ,
                    s.width,
                    s.height,
                    s.centerX,
                    s.centerZ,
                    world.numOccluders,
                    Client.m_ticksSinceNoTimeOutPacket,
                    resets,
                    ...CollisionMap.levelMaps.map(map => map?.flags[4][5] ?? -1),
                    GameShell.m_drawTime[0],
                    GameShell.m_updateTime[0],
                    GameShell.m_updateCount,
                    digest(s.overlayColors),
                    s.underlayColors?.length ?? -1,
                    s.underlayColors?.length === 1 ? digest(s.underlayColors) : '-',
                    s.font11 !== null
                ].join('/')
            );
        };
        const map = assets.archive(23),
            table = readGroup(cachePath, 255, 23),
            index = new Js5Index(table, Crc32.prefix(table, table.length));
        const delayed = (percent: number) => new Js5({ index: () => index, group: () => null, GetGroupLoadPercentage: () => percent, prefetchGroup() {} }, true, true);
        s.progress = 3;
        s.archive = delayed(17);
        Client.worldMapArchive = delayed(87);
        edge('wait', () => s.step());
        Client.worldMapArchive = null;
        edge('missing-percent-archive', () => s.step());
        s.archive = Client.worldMapArchive = map;
        s.progress = 0;
        CollisionMap.levelMaps.forEach((map, i) => (requireNonNull(map).flags[4][5] = 11 + i));
        const savedMap = CollisionMap.levelMaps[2];
        CollisionMap.levelMaps[2] = null;
        world.numOccluders = 59;
        edge('missing-third-collision-map', () => s.step());
        CollisionMap.levelMaps[2] = savedMap;
        s.progress = 10;
        s.baseX = 23;
        s.baseZ = -9;
        s.width = 37;
        s.height = 413;
        const player = Client.localPlayer;
        Client.localPlayer = null;
        edge('missing-player', () => s.step());
        Client.localPlayer = player;
        const materials = Pix3D.textureProvider;
        Pix3D.textureProvider = null;
        edge('missing-materials', () => s.step());
        Pix3D.textureProvider = materials;
        s.progress = 20;
        const timer = GameShell.timer;
        GameShell.timer = null;
        Client.m_ticksSinceNoTimeOutPacket = 38;
        GameShell.m_drawTime[0] = 17n;
        GameShell.m_updateTime[0] = 29n;
        GameShell.m_updateCount = 31;
        edge('missing-clock', () => s.step());
        GameShell.timer = timer;
        s.progress = 70;
        s.font11 = null;
        GameShell.canvas = null;
        edge('missing-font-surface', () => s.step());
        s.width = s.height = 64;
        s.baseX = s.baseZ = 0;
        s.underlayColors = [[null]];
        Pix3D.colourTable = null;
        const tile = new Uint8Array(69);
        tile[0] = tile[5] = 1;
        edge('missing-palette', () => s.readUnderlay(new PacketT(tile)));
        s.overlayColors = Int32Array.of(917);
        Pix3D.colourTable = new Int32Array(65536);
        edge('short-overlay-table', () => s.buildOverlayColors(0, 0));
        for (let seed = 0; seed < 32; seed++) {
            ClientBuild.m_hueOff = [-8, 0, 8, 2147483647][seed % 4];
            ClientBuild.m_ligOff = [16, 0, -16, -2147483648][seed % 4];
            mathRandom.setSeed(BigInt(seed));
            // Stop at the first missing terrain array, after al.a's two random draws.
            expect(() => ClientBuild.FinishBuild(CollisionMap.levelMaps, false)).toThrow();
            lines.push([seed, ClientBuild.m_hueOff, ClientBuild.m_ligOff, (mathRandom.nextDouble() * 32768) | 0].join('/'));
        }
        const root = mkdtempSync(join(tmpdir(), 'rs530-maptiles-'));
        try {
            const compile = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', root, join(import.meta.dir, 'game', 'WorldMapOracle.java'), join(import.meta.dir, 'game', 'WorldMapTerrainOracle.java')]);
            expect(compile.stderr.toString()).toBe('');
            expect(compile.exitCode).toBe(0);
            const file = join(root, 'map.dat');
            writeFileSync(file, Buffer.concat(binary));
            const run = Bun.spawnSync(['java', '--add-opens=java.base/java.lang=ALL-UNNAMED', '-Djava.awt.headless=true', '-cp', root + delimiter + gamepackPath, 'WorldMapTerrainOracle', file]);
            expect(run.stderr.toString()).toBe('');
            expect(run.exitCode).toBe(0);
            const expected = run.stdout.toString().trimEnd().split(/\r?\n/);
            expect(lines.length).toBe(expected.length);
            for (let i = 0; i < expected.length; i++) expect(lines[i], 'map stage or input ' + i).toBe(expected[i]);
        } finally {
            s.Reset(false);
            rmSync(root, { recursive: true, force: true });
        }
    },
    90000
);
