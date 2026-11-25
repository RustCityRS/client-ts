import world from '#/dash3d/world.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import ClientBuild from '#/client/ClientBuild.js';
import ConfigLocType from '#/config/LocType.js';
import LRUHashCache from '#/datastruct/LRUHashCache.js';
import CollisionMap from '#/dash3d/CollisionMap.js';
import type { Rebuild } from '#/io/GameProtocol.js';
import { gamepackPath } from './reference.js';
import { loginFixture } from './login-fixture.js';
import { preserveTerrainState } from './terrain-state.js';

const sources = [
    [120, 240],
    [13, 27]
];
const chunks = [
    [0, 0],
    [2, 5],
    [5, 2],
    [7, 7]
];
const types = [
    [71, 1, 3],
    [90, 4, 2],
    [511, 3, 5],
    [33001, 2, 1]
];

function makeLand(region: number): Uint8Array {
    const out: number[] = [];
    for (let p = 0; p < 4; p++)
        for (let x = 0; x < 64; x++)
            for (let z = 0; z < 64; z++) {
                const key = region * 31 + p * 71 + x * 11 + z * 13;
                const overlayCode = 2 + (key % 10) * 4 + ((x + 2 * z + p) & 3);
                out.push(overlayCode, 1 + (key % 250), 50 + ((x + 2 * z + p) & 3), 82 + (key % 123), 1, 2 + (key % 222));
            }
    out.push(129);
    for (const [p, mode] of [1, 0, 2, 1].entries()) {
        out.push(mode);
        if (mode === 1) {
            for (let i = 0; i < 256; i++) out.push((region * 59 + p * 23 + i * 17) & 255);
        }
    }
    return Uint8Array.from(out);
}

function makeLocs(region: number): Uint8Array {
    const out: number[] = [];
    function smart(n: number): void {
        if (n < 128) out.push(n);
        else out.push((n >>> 8) + 128, n & 255);
    }
    let lastId = -1;
    for (const [i, [id]] of types.entries()) {
        let delta = id - lastId;
        while (delta >= 32767) {
            smart(32767);
            delta -= 32767;
        }
        smart(delta);
        lastId = id;
        const entries: { position: number; shape: number; angle: number }[] = [];
        for (let p = 0; p < 4; p++)
            for (const [cx, cz] of chunks)
                for (let angle = 0; angle < 4; angle++) {
                    const x = cx * 8 + ((angle * 2 + i + region) % 8),
                        z = cz * 8 + ((7 - angle * 2 + i * 3 + region) % 8);
                    entries.push({ position: (p << 12) | (x << 6) | z, shape: [0, 4, 10, 22][i], angle });
                }
        entries.sort((a, b) => a.position - b.position);
        let previous = 0;
        for (const { position, shape, angle } of entries) {
            smart(position - previous + 1);
            out.push((shape << 2) | angle);
            previous = position;
        }
        smart(0);
    }
    smart(0);
    return Uint8Array.from(out);
}

loginFixture(
    import.meta.url,
    'The native region loaders match the JAR dynamic template, tile and multi-tile loc placement over four rotations',
    async () => {
        using _terrain = preserveTerrainState();
        const packed = sources.map(([rx, rz], i) => ({ id: (rx << 8) | rz, map: 40 + i * 2, loc: 41 + i * 2, land: makeLand(i), locations: makeLocs(i) }));
        const templates = new Int32Array(4 * 13 * 13).fill(-1);
        const templateRows: string[] = [];
        function add(p: number, dx: number, dz: number, sourcePlane: number, region: number, chunk: number, rotation: number): void {
            const [rx, rz] = sources[region],
                [cx, cz] = chunks[chunk];
            const value = (sourcePlane << 24) | (((rx << 3) + cx) << 14) | (((rz << 3) + cz) << 3) | (rotation << 1) | 1;
            templates[(p * 13 + dx) * 13 + dz] = value;
            templateRows.push([p, dx, dz, value].join(' '));
        }
        for (let plane = 0; plane < 4; plane++)
            for (let rotation = 0; rotation < 4; rotation++) {
                add(plane, 2 + 2 * rotation, 3 + (plane % 2), (plane + rotation) & 3, (plane + rotation) & 1, (2 * plane + rotation) & 3, rotation);
                add(plane, rotation === 0 ? 0 : 12, rotation * 2 + 5, (plane + 2) & 3, 1 - ((plane + rotation) & 1), (plane + rotation) & 3, rotation);
            }
        // A real template whose source map-square is absent exercises the loader's blank-chunk branch.
        templates[11 * 13 + 8] = (5 << 14) | (7 << 3);
        templateRows.push('0 11 8 ' + templates[11 * 13 + 8]);
        const rebuild: Rebuild = {
            baseX: 3160,
            baseZ: 3192,
            zoneX: 401,
            zoneZ: 405,
            level: 1,
            localX: 42,
            localZ: 68,
            templates,
            squares: packed.map(s => ({ id: s.id, map: s.map, loc: s.loc, key: new Int32Array(4), underwaterMap: -1, underwaterLoc: -1 }))
        };
        const prior = {
            mapBuildIndex: Client.mapBuildIndex,
            sceneMapLandData: Client.sceneMapLandData,
            sceneMapLocData: Client.sceneMapLocData,
            mapBuildCentreZoneX: Client.mapBuildCentreZoneX,
            mapBuildCentreZoneZ: Client.mapBuildCentreZoneZ,
            mapBuildBaseX: Client.mapBuildBaseX,
            mapBuildBaseZ: Client.mapBuildBaseZ,
            dynamicRegion: Client.dynamicRegion,
            dynamicChunks: Client.dynamicChunks
        };
        const maps = CollisionMap.levelMaps,
            typeCache = ConfigLocType.m_recentUse,
            collector = ClientBuild.AddLoc;
        const dir = mkdtempSync(join(tmpdir(), 'rs530-instance-placement-'));
        try {
            const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
            const javac = Bun.spawnSync(['javac', asm, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game/InstancedRegionOracle.java')]);
            expect(javac.stderr.toString()).toBe('');
            expect(javac.exitCode).toBe(0);
            const launch = ['java', asm, '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'InstancedRegionOracle'];
            const assembly = Bun.spawnSync([...launch, gamepackPath, dir]);
            expect(assembly.stderr.toString()).toBe('');
            expect(assembly.exitCode).toBe(0);
            const inputs = [
                packed.length,
                ...packed.map(s => [s.id, Buffer.from(s.land).toString('base64'), Buffer.from(s.locations).toString('base64')].join(' ')),
                types.length,
                ...types.map(row => row.join(' ')),
                templateRows.length,
                ...templateRows
            ];
            const java = Bun.spawnSync(launch, { stdin: Buffer.from(inputs.join('\n') + '\n'), timeout: 20000, maxBuffer: 4 * 1024 * 1024 });
            expect(java.stderr.toString()).toBe('');
            expect(java.exitCode).toBe(0);
            const [tiles, locs] = java.stdout.toString().trimEnd().split(/\r?\n/);
            Client.mapBuildIndex = Int32Array.from(packed, s => s.id);
            Client.sceneMapLandData = packed.map(s => s.land);
            Client.sceneMapLocData = packed.map(s => s.locations);
            Client.mapBuildCentreZoneX = rebuild.zoneX;
            Client.mapBuildCentreZoneZ = rebuild.zoneZ;
            Client.mapBuildBaseX = rebuild.baseX;
            Client.mapBuildBaseZ = rebuild.baseZ;
            Client.dynamicRegion = true;
            Reflect.set(
                Client,
                'dynamicChunks',
                Array.from({ length: 4 }, (_, p) => Array.from({ length: 13 }, (_, x) => templates.slice((p * 13 + x) * 13, (p * 13 + x + 1) * 13)))
            );
            Reflect.set(
                CollisionMap,
                'levelMaps',
                Array.from({ length: 4 }, () => new CollisionMap(104, 104))
            );
            Reflect.set(ConfigLocType, 'm_recentUse', new LRUHashCache<ConfigLocType>(64));
            world.init(4, 104, 104, 25, false);
            ClientBuild.Init(false);
            for (const [id, width, length] of types) {
                const type = new ConfigLocType();
                type.id = id;
                type.width = width;
                type.length = length;
                ConfigLocType.m_recentUse.Put(BigInt(id), type);
            }
            const placements: string[] = [];
            ClientBuild.AddLoc = (_underwater, plane, id, _height, angle, shape, x, z) => {
                placements.push([id, plane, x, z, shape, angle].join(','));
            };
            ClientBuild.loadDynamicGround(false);
            Client.mapBuildLocsDynamic(false);
            const heights = requireNonNull(world.levelHeightmaps);
            const layers = [ClientBuild.m_mapl, ClientBuild.m_floort1, ClientBuild.m_floort2, ClientBuild.m_floors, ClientBuild.m_floorr, world.tileCameraClearance, ClientBuild.m_shadow].map(grid => requireNonNull(grid));
            const bytesPerTile = 11;
            const raw = Buffer.alloc(4 * 104 * 104 * bytesPerTile);
            let at = 0;
            for (let p = 0; p < 4; p++)
                for (let x = 0; x < 104; x++)
                    for (let z = 0; z < 104; z++) {
                        raw.writeInt32BE(heights[p][x][z], at);
                        at += 4;
                        for (const arr of layers) raw[at++] = arr[p][x][z];
                    }
            const reference = Buffer.from(tiles, 'base64');
            expect(reference.length).toBe(raw.length);
            const bad = raw.findIndex((byte, index) => byte !== reference[index]);
            const i = (bad / bytesPerTile) | 0,
                plane = (i / (104 * 104)) | 0,
                x = ((i / 104) | 0) % 104,
                z = i % 104;
            expect(bad, `tile ${plane},${x},${z}, byte ${bad % bytesPerTile}, ts=${raw[bad]} java=${reference[bad]}`).toBe(-1);
            const referencePlacements = locs.split(';');
            expect(referencePlacements.length).toBe(492);
            expect(placements).toEqual(referencePlacements);
        } finally {
            Object.assign(Client, prior);
            Reflect.set(CollisionMap, 'levelMaps', maps);
            Reflect.set(ConfigLocType, 'm_recentUse', typeCache);
            ClientBuild.AddLoc = collector;
            rmSync(dir, { recursive: true, force: true });
        }
    },
    30000
);
