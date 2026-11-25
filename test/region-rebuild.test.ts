import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Client from '#/client/Client.js';
import ClientBuild from '#/client/ClientBuild.js';
import CinematicCamera from '#/client/CinematicCamera.js';
import OrbitCamera from '#/client/OrbitCamera.js';
import NpcType from '#/config/NpcType.js';
import SpotType from '#/config/SpotType.js';
import type ClientEntity from '#/dash3d/ClientEntity.js';
import ClientNpc from '#/dash3d/ClientNpc.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import ClientObj from '#/dash3d/ClientObj.js';
import ClientObjNode from '#/dash3d/ClientObjNode.js';
import ClientProj from '#/dash3d/ClientProj.js';
import ClientProjNode from '#/dash3d/ClientProjNode.js';
import LocChange from '#/dash3d/LocChange.js';
import MapSpotAnim from '#/dash3d/MapSpotAnim.js';
import MapSpotAnimNode from '#/dash3d/MapSpotAnimNode.js';
import MinimapBuilder from '#/dash3d/MinimapBuilder.js';
import SharedPtrList from '#/datastruct/SharedPtrList.js';

import LocalisedText from '#/ui/LocalisedText.js';
import Preferences from '#/ui/Preferences.js';
import WorldMap from '#/ui/WorldMap.js';
import MapArea from '#/ui/MapArea.js';
import SubArea from '#/ui/SubArea.js';
import WorldMapLabels from '#/ui/WorldMapLabels.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { gamepackPath } from './reference.js';

const commands = [
    'mark',
    'build 1 6 35 6 39 0',
    'mark',
    'build 3 6 66 6 66 0',
    'visible 0',
    'build 3 6 34 6 38 0',
    'mark',
    'build 3 8 36 7 41 1',
    'mark',
    'build 3 8 77 7 81 1',
    'build 1 6 30 6 35 1',
    'dest 0 49',
    'visible 1',
    'build 2 6 12 6 23 0',
    'build 2 9 45 8 40 0',
    'mark',
    'build 2 396 45 386 40 0',
    'visible 0',
    'build 3 396 47 386 38 1',
    'build 3 396 46 386 38 1'
];

function trace(): void {
    const area = new MapArea(null, null, 0, 0, 0, true, 1);
    area.rectangles.push_back(new SubArea(45, 46, 70, 75));
    area.computeBounds(0);
    MapArea.areas.push_back(area);
    let messages = 0;
    Client.MessageBox = (message, immediate) => {
        if (message !== LocalisedText.loadingPleaseWait2 || !immediate) throw new Error('loading message');
        messages++;
    };
    const slots = [7, 12, 19, 31000],
        xs = [1024, 14208, 1023, 14209],
        zs = [2048, 15232, 2048, 2048];
    function locate(a: ClientEntity, x: number, z: number) {
        a.x = x;
        a.z = z;
        a.pathLength = 3;
        for (let i = 0; i < 10; i++) {
            a.pathX[i] = (x >> 7) - i;
            a.pathZ[i] = (z >> 7) + i;
        }
    }
    const self = (Client.localPlayer = Client.players[2047] = new ClientPlayer()),
        other = (Client.players[23] = new ClientPlayer());
    locate(self, 4480, 4992);
    locate(other, 7800, 2100);
    const npcs = slots.map((slot, i) => {
        const npc = (Client.npcs[slot] = new ClientNpc());
        npc.npcType = new NpcType();
        locate(npc, xs[i], zs[i]);
        return npc;
    });
    Client.npcCount = 1;
    Client.npcIds[0] = 12;
    SpotType.m_recentUse.Put(9n, new SpotType());
    for (let i = 0; i < 9; i++) {
        const x = i * 10 + 4,
            z = i * 8 + 1,
            plane = i % 4;
        Client.locChanges.push_back(Object.assign(new LocChange(), { x, z, id: 90 + i }));
        const obj = Object.assign(new ClientObj(), { id: 560 + i });
        const list = (Client.groundObj[plane][x][z] = new SharedPtrList<ClientObjNode>());
        list.push_back(new ClientObjNode(obj));
    }
    for (const line of commands) {
        const [act, ...args] = line.split(' '),
            n = args.map(Number);
        switch (act) {
            case 'mark':
                Client.soundEffectCount = 19;
                MinimapBuilder.minimapLevel = 3;
                OrbitCamera.mode = 5;
                CinematicCamera.tileX = 38;
                CinematicCamera.lookZ = 45;
                CinematicCamera.lookX = 54;
                CinematicCamera.tileZ = 60;
                OrbitCamera.x = 1512;
                OrbitCamera.z = -372;
                Client.destinationX = 43;
                Client.destinationZ = 0;
                WorldMapLabels.scene = new WorldMapLabels(0);
                Client.projectiles.push_back(new ClientProjNode(new ClientProj(9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)));
                MapSpotAnim.active.push_back(new MapSpotAnimNode(new MapSpotAnim(9, 0, 0, 0, 0, 0, 0)));
                break;
            case 'visible':
                Preferences.allLevelsVisible = n[0] !== 0;
                break;
            case 'dest':
                Client.destinationX = n[0];
                Client.destinationZ = n[1];
                break;
            case 'build':
                Client.gameState = n[5] === 0 ? 25 : 28;
                Client.StartRebuild(n[0], n[1], n[2], n[3], n[4], n[5] !== 0);
                break;
        }
        const row = [
            messages,
            Client.gameState,
            Client.mapBuildCentreZoneX,
            Client.mapBuildCentreZoneZ,
            ClientBuild.buildLevel,
            Client.mapBuildBaseX,
            Client.mapBuildBaseZ,
            Client.playerLevel,
            Client.soundEffectCount,
            MinimapBuilder.minimapLevel,
            OrbitCamera.mode,
            CinematicCamera.tileX,
            CinematicCamera.lookZ,
            CinematicCamera.lookX,
            CinematicCamera.tileZ,
            OrbitCamera.x,
            OrbitCamera.z,
            Client.destinationX,
            Client.destinationZ,
            +(WorldMap.sceneArea === area),
            +(WorldMapLabels.scene !== null),
            +(Client.projectiles.head() !== null),
            +(MapSpotAnim.active.head() !== null),
            Client.npcCount,
            ...Client.npcIds.subarray(0, Client.npcCount)
        ];
        npcs.forEach((npc, i) => row.push(+(Client.npcs[slots[i]] !== null), +(npc.npcType !== null)));
        const hash = (arr: Int32Array) => arr.reduce((n, v) => (Math.imul(31, n) + v) | 0, 1);
        for (const a of [...npcs, other, self]) row.push(a.x, a.z, a.pathLength, hash(a.pathX), hash(a.pathZ));
        for (let p = 0; p < 4; p++)
            for (let x = 0; x < 104; x++)
                for (let z = 0; z < 104; z++) {
                    const list = Client.groundObj[p][x][z];
                    if (list !== null) row.push(p, x, z, requireNonNull(list.head()).obj.id);
                }
        row.push(-444);
        for (let loc = Client.locChanges.head(); loc !== null; loc = Client.locChanges.next()) row.push(loc.x, loc.z, loc.id);
        console.log(row.join(' '));
    }
}

if (process.argv[2] === 'trace') trace();
else
    test('StartRebuild matches bj for same-area guards, origin shifts in both directions, NPC bounds, camera and queue resets', () => {
        const dir = mkdtempSync(join(tmpdir(), 'region530-'));
        try {
            const source = fileURLToPath(new URL('./game/RegionRebuildOracle.java', import.meta.url));
            const build = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, source]);
            expect(build.stderr.toString()).toBe('');
            expect(build.exitCode).toBe(0);
            const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'RegionRebuildOracle'], { stdin: Buffer.from(commands.join('\n') + '\n') });
            expect(java.stderr.toString()).toBe('');
            expect(java.exitCode).toBe(0);
            const ts = Bun.spawnSync([process.execPath, fileURLToPath(import.meta.url), 'trace']);
            expect(ts.stderr.toString()).toBe('');
            expect(ts.exitCode).toBe(0);
            const rows = ts.stdout.toString().trimEnd().split(/\r?\n/),
                reference = java.stdout.toString().trimEnd().split(/\r?\n/);
            expect(rows.length).toBe(commands.length);
            for (let i = 0; i < commands.length; i++) expect(rows[i], commands[i]).toBe(reference[i]);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    }, 20000);
