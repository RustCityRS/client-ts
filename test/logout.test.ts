import { freshGame } from './actor-fixture.js';
import ReceivePlayerPositions from '#/client/ReceivePlayerPositions.js';
import NpcType from '#/config/NpcType.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Js5 from '#/cache/Js5.js';
import CinematicCamera from '#/client/CinematicCamera.js';
import Client from '#/client/Client.js';
import HintArrow from '#/client/HintArrow.js';
import OrbitCamera from '#/client/OrbitCamera.js';
import LightType from '#/config/LightType.js';
import ClientVarCache from '#/util/ClientVarCache.js';
import ClientNpc from '#/dash3d/ClientNpc.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import CollisionMap from '#/dash3d/CollisionMap.js';
import Pix3D from '#/dash3d/Pix3D.js';
import LruHashTable from '#/datastruct/LruHashTable.js';
import SecondaryNode from '#/datastruct/SecondaryNode.js';
import SoftwareFont from '#/graphics/SoftwareFont.js';
import { ClientScript } from '#/script/ClientScript.js';
import { emptyTextureCache } from './texture-cache-fixture.js';
import world from '#/dash3d/world.js';
import Square from '#/dash3d/Square.js';
import Occlude from '#/dash3d/Occlude.js';
import Sprite from '#/dash3d/Sprite.js';
import SharedPtrList from '#/datastruct/SharedPtrList.js';
import PacketT from '#/io/PacketT.js';
import Protocol from '#/io/Protocol.js';
import SuperPacket from '#/io/SuperPacket.js';
import MidiManager from '#/sound/MidiManager.js';
import WorldMap from '#/ui/WorldMap.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { gamepackPath } from './reference.js';

function trace(mode: string, modewhat: number): void {
    let closed = false;
    const stream = {
        GetAvailable: () => 0,
        async Read() {},
        async read() {
            return -1;
        },
        Write() {},
        Close() {
            closed = true;
        }
    };
    Client.stream = stream;
    const game = freshGame({ outgoing: new SuperPacket(5000), account: null, rebuild: null });
    let titleCalls = 0;
    game.resetToTitle = () => {
        titleCalls++;
        Client.gameState = 10;
    };
    Client.gameState = 30;
    world.maxTileX = world.maxTileZ = 1;
    const tile = new Square(0, 0, 0),
        occluder = new Occlude(),
        sprite = new Sprite();
    world.mainLevelTiles = [[[tile]]];
    world.underwaterSquares = [[[tile]]];
    world.occluders = [occluder];
    world.numOccluders = 1;
    world.dynamicSprites = [sprite, sprite];
    world.dynamicCount = 1;
    world.spriteBuffer = [sprite, sprite];
    Client.modewhat = modewhat;
    const marker = Uint8Array.of(1, 2, 3);
    const archives = Array.from({ length: 11 }, () => {
        const archive = new Js5({ index: () => null, group: () => null, prefetchGroup() {}, GetGroupLoadPercentage: () => 0 }, false, false);
        Object.assign(archive, { unpacked: [[marker]], packed: [marker] });
        return archive;
    });
    [Client.animFramesArchive, Client.basesArchive, Client.interfacesArchive, Client.m_pJagFx, Client.mapsArchive, Client.m_pMidi, Client.modelsArchive, Client.m_pSprites, Client.binaryArchive, Client.jingleArchive, Client.m_pClientScripts] =
        archives;
    const provider = emptyTextureCache(archives[0]);
    const primary = provider['recentUse'],
        secondary = mode === 'aliased' ? primary : new LruHashTable(7);
    const nodes = [new SecondaryNode(), new SecondaryNode()];
    primary.Put(37n, nodes[0]);
    secondary.Put(49n, nodes[1]);
    const caches = [primary, secondary],
        sentinels = caches.map(cache => cache['sentinel']);
    provider['secondaryCache'] = mode === 'secondary' || mode === 'badSecondary' || mode === 'aliased' ? secondary : null;
    if (mode === 'badPrimary') Reflect.set(provider, 'recentUse', null);
    // vj.b clears the secondary links before it dereferences the hash table.
    if (mode === 'badSecondary') Reflect.set(secondary, 'table', null);
    if (mode === 'nullProvider') {
        Pix3D.setTextures(null);
    } else if (mode === 'wrongProvider') {
        Pix3D.setTextures({
            isAvailable: () => false,
            getTextureSmall: () => false,
            getPixels: () => null,
            isLoaded: () => false,
            getTextureData: () => null,
            getTextureColour: () => 0,
            getTextureSolid: () => false
        });
    } else {
        Pix3D.setTextures(provider);
    }
    const font = new SoftwareFont(new Uint8Array(257)),
        script = new ClientScript();
    SoftwareFont.cache.Put(9n, font);
    ClientScript.m_cache.Put(9n, script);
    const maps = Array.from({ length: 4 }, (_, level) => {
        const map = new CollisionMap(104, 104);
        map.flags[25][25] = 123;
        CollisionMap.levelMaps[level] = map;
        return map;
    });
    ClientPlayer.debugBallast = new Array<Uint8Array | null>(50).fill(null);
    ClientPlayer.debugBallast[2] = new Uint8Array(1);
    ClientPlayer.memoryPaddingCount = 3;
    Client.verifyId = 43;
    Protocol.sequenceAckPending = true;
    const npcType = new NpcType();
    NpcType.m_recentUse.Put(9n, npcType);
    LightType.cache.Put(9n, marker);
    const hitbars: [] = [];
    Client.npcHitbarSprites.Put(9n, hitbars);
    Client.hintArrows[3] = new HintArrow();
    Client.dynamicRegion = true;
    Client.destinationX = 6;
    Client.destinationZ = 7;
    Client.mapBuildCentreZoneX = 421;
    Client.mapBuildCentreZoneZ = 429;
    Client.mapBuildBaseX = 3000;
    Client.mapBuildBaseZ = 3100;
    WorldMap.progress = 53;
    Client.jingleActive = true;
    Client.midiSong = 3;
    MidiManager.status = 0;
    MidiManager.targetVolume = 99;
    MidiManager.fadeSpeed = 47;
    Client.players[15] = new ClientPlayer();
    ReceivePlayerPositions.m_apCache[15] = new PacketT(4);
    Client.npcs[32767] = new ClientNpc();
    ReceivePlayerPositions.m_lastNum = 12;
    Client.npcCount = 14;
    Client.groundObj[3][103][103] = new SharedPtrList();
    CinematicCamera.positionPath = CinematicCamera.lookPath = 4;
    OrbitCamera.shake.fill(true);
    OrbitCamera.mode = 3;
    const varpChanges = ClientVarCache.changes;
    if (mode === 'badArchive') Client.binaryArchive = null;
    if (mode === 'badCollision') CollisionMap.levelMaps[2] = null;
    let outcome = 'ok';
    try {
        Client.Logout(game);
    } catch (error) {
        if (!(error instanceof TypeError)) throw error;
        outcome = error.message.includes('ClassCastException') ? 'cast' : 'null';
    }
    const shakeHash = OrbitCamera.shake.reduce((h, value) => (Math.imul(h, 31) + (value ? 1231 : 1237)) | 0, 1);
    const result = [
        outcome,
        titleCalls,
        Client.gameState,
        Client.verifyId,
        Protocol.sequenceAckPending,
        Client.dynamicRegion,
        Client.mapBuildCentreZoneX,
        Client.mapBuildCentreZoneZ,
        Client.mapBuildBaseX,
        Client.mapBuildBaseZ,
        Client.destinationX,
        Client.destinationZ,
        WorldMap.progress,
        Client.jingleActive,
        Client.midiSong,
        MidiManager.status,
        MidiManager.targetVolume,
        MidiManager.fadeSpeed,
        Client.hintArrows[3] === null,
        Client.players[15] === null,
        ReceivePlayerPositions.m_apCache[15] === null,
        Client.npcs[32767] === null,
        ReceivePlayerPositions.m_lastNum,
        Client.npcCount,
        Client.groundObj[3][103][103] === null,
        CinematicCamera.positionPath,
        CinematicCamera.lookPath,
        OrbitCamera.mode,
        shakeHash,
        ClientPlayer.debugBallast[2] === null,
        ClientPlayer.memoryPaddingCount,
        NpcType.m_recentUse.Find(9n) === npcType,
        LightType.cache.Find(9n) === marker,
        Client.npcHitbarSprites.Find(9n) === hitbars,
        Client.stream === null,
        closed,
        ClientVarCache.changes === varpChanges,
        world.mainLevelTiles[0][0][0] === null,
        world.underwaterSquares[0][0][0] === null,
        world.numOccluders,
        world.occluders[0] === occluder,
        world.dynamicCount,
        world.dynamicSprites[0] === null,
        world.dynamicSprites[1] === sprite,
        world.spriteBuffer.every(value => value === null)
    ];
    for (const map of maps) result.push(map.flags[25][25]);
    for (const archive of archives) result.push(requireNonNull(archive['unpacked'])[0] === null, requireNonNull(archive['packed'])[0] === marker);
    result.push(SoftwareFont.cache.Find(9n) === font, ClientScript.m_cache.Find(9n) === script);
    caches.forEach((cache, i) => result.push(cache['sentinel'] === sentinels[i], cache['remaining'], nodes[i].prev === null, nodes[i].secondaryPrev === null));
    console.log(result.join('/'));
}

if (process.argv[2] === 'trace') trace(process.argv[3], Number(process.argv[4]));
else {
    const { expect, test } = await import('bun:test');
    test('original ig.b and bf.c preserve the cache, archive and scene reset order through provider and partial failures', () => {
        const dir = mkdtempSync(join(tmpdir(), 'logout530-'));
        const asm = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED'];
        const java = ['java', ...asm, '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'LogoutOracle'];
        try {
            const sources = ['LogoutOracle', 'GameProtocolOracle'].map(name => fileURLToPath(new URL('./game/' + name + '.java', import.meta.url)));
            const compile = Bun.spawnSync(['javac', ...asm, '-cp', gamepackPath, '-d', dir, ...sources]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const prepare = Bun.spawnSync([...java, 'prepare', gamepackPath, dir]);
            expect(prepare.exitCode, prepare.stderr.toString()).toBe(0);
            for (const mode of ['ready', 'badArchive', 'badCollision', 'nullProvider', 'wrongProvider', 'secondary', 'aliased', 'badPrimary', 'badSecondary'])
                for (const modewhat of ['0', '1']) {
                    const original = Bun.spawnSync([...java, mode, modewhat]);
                    expect(original.exitCode, original.stderr.toString()).toBe(0);
                    const actual = Bun.spawnSync([process.execPath, fileURLToPath(import.meta.url), 'trace', mode, modewhat]);
                    expect(actual.exitCode, actual.stderr.toString()).toBe(0);
                    const expected = original.stdout.toString().trim().split('/');
                    const values = actual.stdout.toString().trim().split('/');
                    expect(values.length).toBe(expected.length);
                    for (let i = 0; i < values.length; i++) expect(values[i], mode + ' modewhat=' + modewhat + ' field ' + i).toBe(expected[i]);
                }
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    }, 45000);
}
