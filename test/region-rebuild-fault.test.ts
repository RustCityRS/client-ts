import { expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Client from '#/client/Client.js';
import ClientBuild from '#/client/ClientBuild.js';
import CinematicCamera from '#/client/CinematicCamera.js';
import OrbitCamera from '#/client/OrbitCamera.js';
import NpcType from '#/config/NpcType.js';
import type ClientEntity from '#/dash3d/ClientEntity.js';
import ClientNpc from '#/dash3d/ClientNpc.js';
import type ClientObjNode from '#/dash3d/ClientObjNode.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import LocChange from '#/dash3d/LocChange.js';
import MapSpotAnim from '#/dash3d/MapSpotAnim.js';
import MinimapBuilder from '#/dash3d/MinimapBuilder.js';
import Linkable from '#/datastruct/Linkable.js';
import SharedPtrList from '#/datastruct/SharedPtrList.js';
import MapArea from '#/ui/MapArea.js';
import SubArea from '#/ui/SubArea.js';
import Preferences from '#/ui/Preferences.js';
import WorldMap from '#/ui/WorldMap.js';
import WorldMapLabels from '#/ui/WorldMapLabels.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { gamepackPath } from './reference.js';

const modes = [
    'ok',
    'centre-callback',
    'npc-table-null',
    'npc-table-short',
    'npc-x-null',
    'npc-x-short',
    'npc-z-null',
    'npc-z-short',
    'culled-npc',
    'npc-ids-null',
    'npc-ids-short',
    'player-table-null',
    'player-table-short',
    'player-x-null',
    'player-x-short',
    'player-z-null',
    'player-z-short',
    'self-null',
    'ground-null',
    'planes-short',
    'plane-null',
    'x-short',
    'z-short',
    'dest-null-source-short',
    'dest-short-source-null',
    'end-dest-null',
    'loc-null',
    'loc-class',
    'spot-null',
    'proj-null'
];
const commands = [0, 1].flatMap(title => modes.map(mode => [mode, title, 7, 8].join(' ')));
for (const [x, z] of [
    [5, 4],
    [7, 4],
    [5, 8],
    [6, 6],
    [25, 23],
    [2147483647, -2147483648]
]) {
    for (const mode of ['ok', 'planes-short', 'z-short', 'end-dest-null']) commands.push([mode, 1, x, z].join(' '));
}

function place(entity: ClientEntity, offset: number): void {
    entity.x = 5800 + offset;
    entity.z = 7100 + offset;
    entity.pathLength = 2;
    for (let i = 0; i < 10; i++) {
        entity.pathX[i] = 44 + offset - i;
        entity.pathZ[i] = 51 + offset + i;
    }
}

function hash(values: Int32Array | null): number {
    return values === null ? 0 : values.reduce((h, v) => (Math.imul(h, 31) + v) | 0, 1);
}

type Pile = SharedPtrList<ClientObjNode>;
type Grid = (((Pile | null)[] | null)[] | null)[] | null;
function groundHash(grid: Grid, piles: Map<Pile, number>): number {
    if (grid === null) return 0;
    let h = 31 + grid.length;
    for (const plane of grid) {
        h = (Math.imul(h, 31) + (plane === null ? -1 : plane.length)) | 0;
        if (plane === null) continue;
        for (const row of plane) {
            h = (Math.imul(h, 31) + (row === null ? -1 : row.length)) | 0;
            if (row !== null) for (const cell of row) h = (Math.imul(h, 31) + (cell === null ? 0 : requireNonNull(piles.get(cell)))) | 0;
        }
    }
    return h;
}

function trace(): void {
    const area = new MapArea(null, null, 0, 0, 0, true, 1);
    area.rectangles.push_back(new SubArea(152, 155, 178, 182));
    area.computeBounds(0);
    MapArea.areas.push_back(area);
    for (const line of commands) {
        const [mode, flag, x, z] = line.split(' ');
        const title = flag === '1';
        Client.mapBuildCentreZoneX = -33;
        Client.mapBuildCentreZoneZ = -42;
        ClientBuild.buildLevel = 2;
        Client.mapBuildBaseX = 0;
        Client.mapBuildBaseZ = 0;
        Client.playerLevel = 3;
        WorldMap.sceneArea = null;
        WorldMapLabels.scene = new WorldMapLabels(0);
        Preferences.allLevelsVisible = false;
        Client.gameState = title ? 28 : 25;
        let messages = 0;
        Client.MessageBox = () => {
            messages++;
            if (mode === 'centre-callback') {
                Client.mapBuildCentreZoneX = 20;
                Client.mapBuildCentreZoneZ = 21;
                Client.mapBuildBaseX = 12;
                Client.mapBuildBaseZ = -15;
            }
        };
        OrbitCamera.mode = 5;
        MinimapBuilder.minimapLevel = 3;
        Client.soundEffectCount = 19;
        CinematicCamera.tileX = 38;
        CinematicCamera.lookZ = 45;
        CinematicCamera.lookX = 54;
        CinematicCamera.tileZ = 60;
        OrbitCamera.x = -2147483648 + 6;
        OrbitCamera.z = 2147483647 - 7;
        Client.destinationX = 43;
        Client.destinationZ = -73;
        Client.npcCount = 9;
        Reflect.set(Client, 'npcIds', new Int32Array(3).fill(-7));
        Reflect.set(Client, 'npcs', new Array<ClientNpc | null>(32768).fill(null));
        const first = (Client.npcs[0] = new ClientNpc()),
            second = (Client.npcs[2] = new ClientNpc());
        first.npcType = new NpcType();
        second.npcType = new NpcType();
        place(first, 1);
        place(second, 4);
        Reflect.set(Client, 'players', new Array<ClientPlayer | null>(2048).fill(null));
        const player = (Client.players[1] = new ClientPlayer()),
            self = (Client.localPlayer = Client.players[2047] = new ClientPlayer());
        place(player, 7);
        place(self, 12);
        Client.groundObj = Array.from({ length: 4 }, () => Array.from({ length: 104 }, () => new Array<Pile | null>(104).fill(null)));
        const piles = new Map<Pile, number>();
        for (const plane of Client.groundObj)
            for (const x of [0, 8, 95, 103])
                for (const z of [0, 1, 16, 17, 87, 103]) {
                    const pile = (plane[x][z] = new SharedPtrList<ClientObjNode>());
                    piles.set(pile, piles.size + 1);
                }
        const loc = new LocChange();
        loc.x = 35;
        loc.z = 48;
        Client.locChanges = new SharedPtrList<LocChange>();
        Client.locChanges.push_back(loc);
        const projectiles = new SharedPtrList(),
            spots = new SharedPtrList();
        projectiles.push_back(new Linkable());
        spots.push_back(new Linkable());
        Reflect.set(Client, 'projectiles', projectiles);
        Reflect.set(MapSpotAnim, 'active', spots);
        switch (mode) {
            case 'ok':
            case 'centre-callback':
                break;
            case 'npc-table-null':
                Reflect.set(Client, 'npcs', null);
                break;
            case 'npc-table-short':
                Reflect.set(Client, 'npcs', Client.npcs.slice(0, 2));
                break;
            case 'npc-x-null':
                Reflect.set(second, 'pathX', null);
                break;
            case 'npc-x-short':
                second.pathX = second.pathX.slice(0, 3);
                break;
            case 'npc-z-null':
                Reflect.set(second, 'pathZ', null);
                break;
            case 'npc-z-short':
                second.pathZ = second.pathZ.slice(0, 3);
                break;
            case 'culled-npc':
                second.x = -2345;
                Reflect.set(second, 'pathX', null);
                break;
            case 'npc-ids-null':
                Reflect.set(Client, 'npcIds', null);
                break;
            case 'npc-ids-short':
                Reflect.set(Client, 'npcIds', new Int32Array(1));
                break;
            case 'player-table-null':
                Reflect.set(Client, 'players', null);
                break;
            case 'player-table-short':
                Reflect.set(Client, 'players', Client.players.slice(0, 2));
                break;
            case 'player-x-null':
                Reflect.set(player, 'pathX', null);
                break;
            case 'player-x-short':
                player.pathX = player.pathX.slice(0, 6);
                break;
            case 'player-z-null':
                Reflect.set(player, 'pathZ', null);
                break;
            case 'player-z-short':
                player.pathZ = player.pathZ.slice(0, 6);
                break;
            case 'self-null':
                Client.localPlayer = null;
                break;
            case 'ground-null':
                Reflect.set(Client, 'groundObj', null);
                break;
            case 'planes-short':
                Client.groundObj = Client.groundObj.slice(0, 2);
                break;
            case 'plane-null':
                Reflect.set(Client.groundObj, 2, null);
                break;
            case 'x-short':
                Client.groundObj[1] = Client.groundObj[1].slice(0, 4);
                break;
            case 'z-short':
                Client.groundObj[1][0] = Client.groundObj[1][0].slice(0, 2);
                break;
            case 'dest-null-source-short':
                Reflect.set(Client.groundObj[1], 0, null);
                Client.groundObj[1][8] = new Array<Pile | null>(2).fill(null);
                break;
            case 'dest-short-source-null':
                Client.groundObj[1][0] = [];
                Reflect.set(Client.groundObj[1], 8, null);
                break;
            case 'end-dest-null':
                Reflect.set(Client.groundObj[1], 103, null);
                break;
            case 'loc-null':
                Reflect.set(Client, 'locChanges', null);
                break;
            case 'loc-class':
                (Client.locChanges as SharedPtrList<Linkable>).push_back(new Linkable());
                break;
            case 'spot-null':
                Reflect.set(MapSpotAnim, 'active', null);
                break;
            case 'proj-null':
                Reflect.set(Client, 'projectiles', null);
                break;
            default:
                throw new Error(mode);
        }
        let outcome = 'ok';
        try {
            Client.StartRebuild(1, Number(z), 43, Number(x), 52, title);
        } catch (err) {
            if (err instanceof TypeError) outcome = err.message.includes('ClassCastException') ? 'cast' : 'null';
            else if (err instanceof RangeError) outcome = 'bounds';
            else throw err;
        }
        const row = [
            outcome,
            messages,
            Client.gameState,
            Client.mapBuildCentreZoneX,
            Client.mapBuildCentreZoneZ,
            ClientBuild.buildLevel,
            Client.mapBuildBaseX,
            Client.mapBuildBaseZ,
            Client.playerLevel,
            +(WorldMap.sceneArea === area),
            +(WorldMapLabels.scene !== null),
            Client.npcCount,
            hash(Client.npcIds),
            Client.npcs?.length ?? -1,
            Client.players?.length ?? -1
        ];
        for (const actor of [first, second, player, self]) row.push(actor.x, actor.z, actor.pathLength, hash(actor.pathX), hash(actor.pathZ));
        row.push(
            +(second.npcType !== null),
            +(Client.npcs?.[2] === second),
            groundHash(Client.groundObj, piles),
            loc.x,
            loc.z,
            +loc.IsLinked(),
            Client.soundEffectCount,
            MinimapBuilder.minimapLevel,
            OrbitCamera.mode,
            CinematicCamera.tileX,
            OrbitCamera.x,
            CinematicCamera.lookZ,
            CinematicCamera.lookX,
            CinematicCamera.tileZ,
            OrbitCamera.z,
            Client.destinationX,
            Client.destinationZ,
            MapSpotAnim.active === null ? -1 : +(spots.head() !== null),
            Client.projectiles === null ? -1 : +(projectiles.head() !== null)
        );
        console.log(row.join(' '));
    }
}

if (process.argv[2] === 'trace') trace();
else
    test('StartRebuild preserves Java partial actor paths, ID counts, ground writes and camera state on faults', () => {
        const directory = mkdtempSync(join(tmpdir(), 'rs530-region-fault-'));
        try {
            execFileSync('javac', ['-cp', gamepackPath, '-d', directory, join(import.meta.dir, 'game', 'RegionRebuildFaultOracle.java')]);
            const java = execFileSync('java', ['-Xmx384m', '-Djava.awt.headless=true', '-cp', directory + delimiter + gamepackPath, 'RegionRebuildFaultOracle'], { input: commands.join('\n') + '\n', encoding: 'utf8' })
                .trimEnd()
                .split(/\r?\n/);
            const ts = execFileSync(process.execPath, [fileURLToPath(import.meta.url), 'trace'], { encoding: 'utf8' })
                .trimEnd()
                .split(/\r?\n/);
            const reference = (cmd: string) => requireNonNull(java[commands.indexOf(cmd)]).split(' ');
            // Distinguish the saved destination row from the later JVM aastore checks.
            expect(reference('dest-null-source-short 1 7 8')[0]).toBe('bounds');
            expect(reference('dest-short-source-null 1 7 8')[0]).toBe('null');
            expect(reference('npc-ids-short 1 7 8').slice(0, 12)).toEqual(['bounds', '1', '28', '7', '8', '1', '8', '16', '3', '0', '0', '2']);
            expect(reference('centre-callback 1 7 8')[9]).toBe('1');
            expect(ts.length).toBe(commands.length);
            expect(java.length).toBe(commands.length);
            for (let i = 0; i < commands.length; i++) expect(ts[i], commands[i]).toBe(java[i]);
        } finally {
            rmSync(directory, { recursive: true, force: true });
        }
    }, 30000);
