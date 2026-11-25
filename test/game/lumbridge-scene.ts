import { expect } from 'bun:test';
import Client from '#/client/Client.js';
import GameShell from '#/client/GameShell.js';
import NanoTimer from '#/client/NanoTimer.js';
import ClientBuild from '#/client/ClientBuild.js';
import OrbitCamera from '#/client/OrbitCamera.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import CollisionMap from '#/dash3d/CollisionMap.js';
import Pix3D from '#/dash3d/Pix3D.js';
import TextureCache from '#/dash3d/TextureCache.js';
import Pix2D from '#/graphics/Pix2D.js';
import SpriteLoader from '#/graphics/SpriteLoader.js';
import SceneCutover from '#/scene/SceneCutover.js';
import { mathRandom } from '#/util/JavaRandom.js';
import { localAssets } from '../cachefile.js';
import { cachePath } from '../reference.js';

const camera = [6500, -1080, 5700, 256, 0] as const;

export function buildScene(dynamic: boolean, width = 512, height = 334): Int32Array {
    const assets = localAssets(
        cachePath,
        Array.from({ length: 28 }, (_, i) => i)
    );
    Client.dynamicRegion = dynamic;
    if (dynamic) {
        for (let level = 0; level < 4; level++) {
            for (let x = 0; x < 13; x++) {
                for (let z = 0; z < 13; z++) {
                    Client.dynamicChunks[level][x][z] = (level << 24) | ((395 + x) << 14) | ((395 + z) << 3) | (((x + z + level) & 3) << 1);
                }
            }
        }
        Client.dynamicChunks[0][0][0] = -1;
        Client.dynamicChunks[1][12][12] = (9 << 14) | (7 << 3);
    }
    Client.mapBuildGroundFile = Int32Array.of(254, 256, 380, 382);
    Client.mapBuildLocationFile = Int32Array.of(255, 257, 381, 383);
    Client.mapBuildIndex = Int32Array.of((49 << 8) | 49, (49 << 8) | 50, (50 << 8) | 49, (50 << 8) | 50);
    Client.mapBuildKeys = [
        [-1653558720, 2119901478, -1449369788, -1829505468],
        [1150282919, 572626783, -257791473, 2031745700],
        [183396243, -461663209, -212681663, -266126212],
        [0, 0, 0, 0]
    ].map(keys => Int32Array.from(keys));
    Client.sceneMapLandData = new Array(4).fill(null);
    Client.sceneMapLocData = new Array(4).fill(null);
    Client.mapBuildCentreZoneX = Client.mapBuildCentreZoneZ = 401;
    Client.mapBuildBaseX = Client.mapBuildBaseZ = 3160;
    for (let level = 0; level < 4; level++) CollisionMap.levelMaps[level] = new CollisionMap(104, 104);
    Pix3D.textureProvider = new TextureCache(assets.archive(9), assets.archive(26), assets.archive(8), 20, false);
    GameShell.timer = new NanoTimer();
    Client.gameState = 25;
    mathRandom.setSeed(53002n);
    Pix3D.setBrightness(Math.fround(0.8));
    ClientBuild.m_hueOff = ClientBuild.m_ligOff = 0;
    mathRandom.setSeed(53003n);
    expect(SceneCutover.active).toBe(true);
    const client = new Client();
    client['MapBuildLoop']();
    expect(Client.gameState).toBe(30);
    const pixels = new Int32Array(width * height);
    Client.localPlayer = new ClientPlayer();
    Client.localPlayer.x = Client.localPlayer.z = 50 * 128 + 64;
    Client.playerLevel = 0;
    [OrbitCamera.x, OrbitCamera.y, OrbitCamera.z, OrbitCamera.pitch, OrbitCamera.yaw] = camera;
    OrbitCamera.mode = 2;
    const sprites = assets.archive(8);
    SpriteLoader.cross = SpriteLoader.loadSprites2(0, sprites, sprites.GetGroupId(Client.crossName));
    expect(SpriteLoader.cross).toHaveLength(8);
    Pix2D.setPixels(pixels, width, height);
    Pix3D.setRenderClipping();
    mathRandom.setSeed(53004n);
    return pixels;
}
