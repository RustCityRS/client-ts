import world from '#/dash3d/world.js';
import Protocol from '#/io/Protocol.js';
import ClientBuild from '#/client/ClientBuild.js';
import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Client from '#/client/Client.js';
import BASType from '#/config/BASType.js';
import BASTypeList from '#/config/BASTypeList.js';
import ClientNpc from '#/dash3d/ClientNpc.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import type ClientProj from '#/dash3d/ClientProj.js';
import SuperPacket from '#/io/SuperPacket.js';

import AreaSoundManager from '#/sound/AreaSoundManager.js';
import { doubleToInt } from '#/util/IntUtils.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { localAssets, readGroup } from './cachefile.js';
import { cachePath, gamepackPath } from './reference.js';

function archive(id: number, groups: number[]): string {
    const bytes = (index: number, group: number) => Buffer.from(readGroup(cachePath, index, group)).toString('base64');
    return [bytes(255, id), ...groups.map(group => group + ':' + bytes(id, group))].join(' ');
}

function state(p: ClientProj): number[] {
    return [
        p.id,
        p.plane,
        p.sourceX,
        p.sourceZ,
        p.sourceY,
        p.startCycle,
        p.endCycle,
        p.slope,
        p.distance,
        p.target,
        p.endHeight,
        p.yaw,
        p.pitch,
        p.frame,
        p.frameCycle,
        p.nextFrame,
        p.getMinY(),
        p.x,
        p.y,
        p.z,
        p['velocityX'],
        p['velocityY'],
        p['velocityZ'],
        p['speed'],
        p['acceleration']
    ];
}

test('qd projectile packets and pk scene submissions match the gamepack across tracking, terrain, BAS offsets and animation', () => {
    const dir = mkdtempSync(join(tmpdir(), 'projectile530-'));
    const saved = {
        input: Protocol.inPacket,
        op: Protocol.packetType,
        npc: Client.npcs[23],
        player: Client.players[13],
        self: Client.localPlayer,
        zoneX: Protocol.zoneUpdateX,
        zoneZ: Protocol.zoneBaseZ,
        localPid: Client.localPid,
        plane: Client.playerLevel,
        tick: Client.loopCycle,
        elapsed: AreaSoundManager.elapsed,
        heights: world.levelHeightmaps,
        flags: ClientBuild.m_mapl
    };
    const commands: string[] = [],
        expected: number[][] = [];
    try {
        localAssets(cachePath, [20, 21]);
        const bas = new BASType();
        bas.transforms = new Array<Int32Array | null>(12).fill(null);
        bas.transforms[2] = Int32Array.of(-171, 43, 257, 0, 0, 0);
        bas.transforms[4] = Int32Array.of(401, -79, -23, 0, 0, 0);
        BASTypeList.types.Put(35n, bas);
        const npc = (Client.npcs[23] = Object.assign(new ClientNpc(), { bas: 35, yaw: 1931 }));
        const other = (Client.players[13] = Object.assign(new ClientPlayer(), { bas: 35, yaw: 274 }));
        const self = (Client.localPlayer = Object.assign(new ClientPlayer(), { bas: 35, yaw: 585 }));
        Client.localPid = 7;
        Client.playerLevel = 1;
        Client.loopCycle = 100;
        world.levelHeightmaps = Array.from({ length: 4 }, (_, p) => Array.from({ length: 105 }, (_, x) => Int32Array.from({ length: 105 }, (_, z) => p * 400 + x * 64 - z * 128)));
        ClientBuild.m_mapl = Array.from({ length: 4 }, (_, p) => Array.from({ length: 104 }, (_, x) => Uint8Array.from({ length: 104 }, (_, z) => (p === 1 && (x + z) % 4 === 1 ? 2 : 0))));
        Client.projectiles.clear();
        Protocol.zoneUpdateX = 34;
        Protocol.zoneBaseZ = 48;
        function record(line: string, row: number[]) {
            for (let node = Client.projectiles.head(); node !== null; node = Client.projectiles.next()) row.push(...state(node.projectile));
            commands.push(line);
            expected.push(row);
        }
        function packet(op: number, pos: number, dx: number, dz: number, source: number, target: number, id: number, h1: number, h2: number, start: number, end: number, pitch: number, distance: number) {
            const p = new SuperPacket(32);
            p.p1(pos);
            p.p1(dx);
            p.p1(dz);
            if (op === 104) p.p2(source);
            p.p2(target);
            p.p2(id);
            p.p1(h1);
            p.p1(h2);
            p.p2(start);
            p.p2(end);
            p.p1(pitch);
            p.p1(distance);
            const bytes = requireNonNull(p.m_data).slice(0, p.m_pos);
            p.m_pos = 0;
            p.m_data = bytes;
            Protocol.inPacket = p;
            Protocol.packetType = op;
            Client.ZonePacket();
            record('packet ' + op + ' ' + Buffer.from(bytes).toString('hex'), [p.m_pos]);
        }
        function tick(cycle: number, delta: number, plane: number) {
            Client.loopCycle = cycle;
            AreaSoundManager.elapsed = delta;
            Client.playerLevel = plane;
            npc.x = 4944 + cycle;
            npc.z = cycle % 5 === 0 ? -1 : 7677 - cycle;
            other.x = cycle % 6 === 0 ? 13312 : 4747 - cycle;
            other.z = 6810 + cycle;
            self.x = 4096 - cycle;
            self.z = 7800 + cycle;
            const row: number[] = [];
            Client.pushProjectiles(p => row.push(p.id, p.plane, doubleToInt(p.x), doubleToInt(p.z), doubleToInt(p.y), p.yaw, -1));
            record('tick ' + cycle + ' ' + delta + ' ' + plane, [row.length / 7, ...row]);
        }
        // Whole tile, half tile, absent target, actor launch slots, no sequence, partial/full/no loop.
        packet(16, 0x10, 7, -3, 0, 24, 9, 90, 3, 2, 55, 255, 17);
        packet(121, 0x9e, -6, 8, 0, -14, 35, 27, 10, 0, 92, 16, 71);
        packet(104, 0xa1, 12, 1, (2 << 11) + 24, -8, 73, -76, 20, 1, 82, 52, 255);
        packet(104, 0x30, -4, -6, -((4 << 11) + 14), 0, 59, 65, 0, 6, 70, 0, 5);
        packet(104, 0xc9, 1, 10, -((2 << 11) + 8), 96, 287, -128, 39, 0, 42, 72, 0);
        packet(104, 0x7c, -7, 3, (1 << 11) + 24, 0, 240, 0, 1, 10, 90, 11, 0);
        packet(16, 0x6e, 0, 0, 0, 0, 9, 1, 1, 1, 5, 255, 0);
        packet(16, 0xfa, -100, 0, 0, 0, 9, 0, 0, 0, 35, 0, 0);
        packet(121, 0x11, 0, 0, 0, 0, 65535, 0, 0, 0, 35, 0, 0);
        for (const [cycle, delta] of [
            [99, 2],
            [100, 0],
            [101, 1],
            [102, 1],
            [102, 0],
            [105, 3],
            [110, 5],
            [127, 17],
            [146, 19],
            [155, 9],
            [156, 1],
            [171, 15],
            [183, 12],
            [190, 7],
            [192, 2],
            [193, 1]
        ])
            tick(cycle, delta, 1);
        packet(16, 0x32, 4, 4, 0, 0, 9, 2, 3, 0, 20, 21, 4);
        tick(194, 1, 2);

        const java = (name: string) => fileURLToPath(new URL('./game/' + name + '.java', import.meta.url));
        const build = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, java('ChatOracle'), java('ProjectileZoneOracle')]);
        expect(build.stderr.toString()).toBe('');
        expect(build.exitCode).toBe(0);
        const input = [archive(20, [0, 1, 2, 3, 7, 9]), archive(21, [0, 1]), ...commands, ''].join('\n');
        const run = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'ProjectileZoneOracle'], { stdin: Buffer.from(input), timeout: 20000 });
        expect(run.stderr.toString()).toBe('');
        expect(run.exitCode).toBe(0);
        const rows = run.stdout.toString().trimEnd().split(/\r?\n/);
        expect(rows.length).toBe(commands.length);
        for (let i = 0; i < rows.length; i++) {
            const values = rows[i].split(' ').map(Number);
            expect(expected[i].length, commands[i]).toBe(values.length);
            for (let j = 0; j < values.length; j++) {
                const actual = expected[i][j],
                    reference = values[j];
                expect(actual, commands[i] + ' field ' + j).toBe(reference);
            }
        }
    } finally {
        Protocol.inPacket = saved.input;
        Protocol.packetType = saved.op;
        Protocol.zoneUpdateX = saved.zoneX;
        Protocol.zoneBaseZ = saved.zoneZ;
        Client.projectiles.clear();
        Client.npcs[23] = saved.npc;
        Client.players[13] = saved.player;
        Client.localPlayer = saved.self;
        Client.localPid = saved.localPid;
        Client.playerLevel = saved.plane;
        Client.loopCycle = saved.tick;
        AreaSoundManager.elapsed = saved.elapsed;
        world.levelHeightmaps = saved.heights;
        ClientBuild.m_mapl = saved.flags;
        rmSync(dir, { recursive: true, force: true });
    }
}, 30000);
