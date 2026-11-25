import { expect, test } from 'bun:test';
import CollisionMap from '#/dash3d/CollisionMap.js';
import Client from '#/client/Client.js';
import ClientBuild from '#/client/ClientBuild.js';
import GameShell from '#/client/GameShell.js';
import Timer from '#/client/Timer.js';

import Pix3D from '#/dash3d/Pix3D.js';
import RoofModeStatics from '#/dash3d/RoofModeStatics.js';
import TextureCache from '#/dash3d/TextureCache.js';

import SuperPacket from '#/io/SuperPacket.js';
import SpriteLoader from '#/graphics/SpriteLoader.js';
import InterfaceSession from '#/ui/InterfaceSession.js';
import InterfaceView from '#/ui/InterfaceView.js';
import Preferences from '#/ui/Preferences.js';
import WorldMapLabels from '#/ui/WorldMapLabels.js';

import RegionRotate from '#/util/RegionRotate.js';
import type { Rebuild } from '#/io/GameProtocol.js';
import { localAssets } from './cachefile.js';
import { loginFixture } from './login-fixture.js';
import { cachePath } from './reference.js';

import { requireNonNull } from '#/util/JavaArray.js';

test('location streams accumulate extended object IDs, tile deltas and rotated footprints', () => {
    const bytes = Uint8Array.of(255, 255, 2, 0x90, 0x43, 42, 2, 9, 0, 0);
    const loadLocation = ClientBuild.AddLoc;
    const placements: { id: number; plane: number; x: number; z: number; shape: number; angle: number }[] = [];
    try {
        ClientBuild.AddLoc = (_underwater, plane, id, _height, angle, shape, x, z) => {
            placements.push({ id, plane, x, z, shape, angle });
        };
        ClientBuild.LoadLocations(0, null, bytes, 0, true);
    } finally {
        ClientBuild.AddLoc = loadLocation;
    }
    expect(placements).toEqual([
        { id: 32768, plane: 1, x: 1, z: 2, shape: 10, angle: 2 },
        { id: 32768, plane: 1, x: 1, z: 3, shape: 2, angle: 1 }
    ]);
    expect([0, 1, 2, 3].map(r => [RegionRotate.RegionRotateLocationX(4, 2, 2, 0, 3, r), RegionRotate.RegionRotateLocationZ(r, 3, 4, 2, 0, 2)])).toEqual([
        [2, 4],
        [4, 3],
        [3, 2],
        [2, 2]
    ]);
});

function lumbridgeRegion(): Rebuild {
    const keys = [
        [-1653558720, 2119901478, -1449369788, -1829505468],
        [1150282919, 572626783, -257791473, 2031745700],
        [183396243, -461663209, -212681663, -266126212],
        [0, 0, 0, 0]
    ];
    return {
        baseX: 3160,
        baseZ: 3160,
        zoneX: 401,
        zoneZ: 401,
        level: 0,
        localX: 52,
        localZ: 52,
        squares: [254, 256, 380, 382].map((map, i) => ({
            id: ((49 + (i >> 1)) << 8) | (49 + (i & 1)),
            map,
            loc: map + 1,
            key: Int32Array.from(keys[i]),
            underwaterMap: -1,
            underwaterLoc: -1
        }))
    };
}

loginFixture(
    import.meta.url,
    'a cold low-roofs Lumbridge rebuild clears the stage 90 texture cache and enters state 30',
    async () => {
        const assets = localAssets(
            cachePath,
            Array.from({ length: 28 }, (_, i) => i)
        );
        const client = new Client(),
            rebuild = lumbridgeRegion();
        Client.loadingStage = 90;
        await client['MainLoad']();
        expect(Client.loadingStage).toBe(100);
        const provider = Pix3D.textureProvider;
        if (!(provider instanceof TextureCache)) throw new Error('stage 90 did not publish kg');
        const warmPixels = requireNonNull(provider.getTextureData(17, Math.fround(0.7)));
        const warmTexture = requireNonNull(provider['recentUse'].Find(17n));

        Client.gameState = 25;
        Client.members = true;
        Client.dynamicRegion = false;
        Client.sceneState = 0;
        Client.mapBuildCentreZoneX = rebuild.zoneX;
        Client.mapBuildCentreZoneZ = rebuild.zoneZ;
        Client.mapBuildBaseX = rebuild.baseX;
        Client.mapBuildBaseZ = rebuild.baseZ;
        Client.mapBuildIndex = Int32Array.from(rebuild.squares, s => s.id);
        Client.mapBuildGroundFile = Int32Array.from(rebuild.squares, s => s.map);
        Client.mapBuildLocationFile = Int32Array.from(rebuild.squares, s => s.loc);
        Client.mapBuildKeys = rebuild.squares.map(s => s.key);
        Client.sceneMapLandData = rebuild.squares.map(() => null);
        Client.sceneMapLocData = rebuild.squares.map(() => null);
        Client.mapBuildNpcData = Client.npcSpawnGroupIds = null;
        for (let i = 0; i < 4; i++) CollisionMap.levelMaps[i] = new CollisionMap(104, 104);
        WorldMapLabels.scene = new WorldMapLabels(0);
        Preferences.setAllLevelsVisible(true);
        Preferences.removeRoofsSelectively = false;
        RoofModeStatics.roofRemovalDisabled = false;
        const id = assets.groupId(8, 'b12_full');
        Client.fontBold12 = requireNonNull(SpriteLoader.loadFont(assets.archive(8), id, 0, assets.archive(13)));
        const ui = new InterfaceSession(new InterfaceView([]), assets);
        const out = new SuperPacket(5000);
        out.SetEnc(Int32Array.of(1, 2, 3, 4));
        client['enterGame']({ rebuild, account: null, outgoing: out }, assets, ui);
        GameShell.timer = await Timer.create();
        const addLoc = ClientBuild.AddLoc;
        let locations = 0;
        ClientBuild.AddLoc = (...args) => {
            locations++;
            return addLoc(...args);
        };
        try {
            client['MapBuildLoop']();
        } finally {
            ClientBuild.AddLoc = addLoc;
        }
        expect(Client.gameState).toBe(30);
        expect(locations).toBe(8843);
        expect(RoofModeStatics.getRoofMode()).toBe(1);
        expect(RoofModeStatics.roofMarks).toHaveLength(4);
        expect(Pix3D.textureProvider).toBe(provider);
        expect(provider['recentUse'].Find(17n)).toBeNull();
        const coldPixels = requireNonNull(provider.getTextureData(17, Math.fround(0.7)));
        expect(provider['recentUse'].Find(17n)).not.toBe(warmTexture);
        expect(coldPixels).not.toBe(warmPixels);
        expect(coldPixels).toEqual(warmPixels);
    },
    30000
);
