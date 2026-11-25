import { freshActors } from './actor-fixture.js';
import ReceivePlayerPositions from '#/client/ReceivePlayerPositions.js';
import Protocol from '#/io/Protocol.js';
import SuperPacket from '#/io/SuperPacket.js';
import { tutorialPlayerInfo } from './majula.js';
import PlayerModel from '#/dash3d/PlayerModel.js';
import NpcType from '#/config/NpcType.js';
import { toJsString } from '#/datastruct/JagString.js';
import { localAssets } from './cachefile.js';
import { requireNonNull } from '../src/util/JavaArray.js';
import { cachePath, gamepackPath } from './reference.js';
import { expect, test } from 'bun:test';
import { fileURLToPath } from 'node:url';
import ClientApp from '#/client/Client.js';
import { runRebuild } from './rebuild-fixture.js';
import { loginFixture } from './login-fixture.js';

function decode(bytes: Uint8Array, player: boolean, cycle: number): void {
    const saved = Protocol.inPacket;
    Protocol.inPacket = new SuperPacket(bytes.length);
    Protocol.inPacket.m_data = bytes;
    Protocol.packetSize = bytes.length;
    ClientApp.loopCycle = cycle;
    try {
        if (player) ReceivePlayerPositions.GetPlayerInfo();
        else ClientApp.GetNPCPos();
    } finally {
        Protocol.inPacket = saved;
    }
}

class Bits {
    private n = 0;
    bytes: number[] = [];
    p(width: number, value: number): this {
        for (let i = width - 1; i >= 0; i--) {
            const pos = this.n++;
            this.bytes[pos >> 3] |= ((value >> i) & 1) << (7 - (pos & 7));
        }
        return this;
    }
}

const visible = new Bits().p(1, 1).p(2, 3).p(7, 55).p(1, 1).p(2, 2).p(1, 0).p(7, 51).p(8, 0).p(11, 73).p(1, 1).p(5, -2).p(3, 7).p(1, 1).p(5, 3).p(11, 2047);
// Damage and face coordinates as emitted by Majula's 530 encoder in rs-protocol/tests/wire_530.rs.
const first = Uint8Array.of(...visible.bytes, 65, 0x81, 44, 0x81, 0xb8, 0x19, 0x2f, 0xa5, 0x19);
const second = Uint8Array.from(new Bits().p(1, 1).p(2, 1).p(3, 4).p(1, 0).p(8, 1).p(1, 1).p(2, 2).p(1, 1).p(3, 1).p(3, 2).p(1, 0).p(11, 2047).bytes);

function runPlayers(motion = false) {
    const state = freshActors();
    const trace = [];
    for (const packet of [first, second]) {
        decode(packet, true, 100);
        const actor = requireNonNull(state.players.get(73));
        trace.push([state.level, state.self.pathX[0], state.self.pathZ[0], actor.pathX[0], actor.pathZ[0], actor.pathLength, actor.yaw, actor.health, actor.hitDamage[0], actor.hitType[0], actor.faceX, actor.faceZ].join(' '));
    }
    if (motion) {
        const actor = requireNonNull(state.players.get(73));
        for (let i = 0; i < 80; i++) {
            ClientApp.mapBuildBaseX = ClientApp.mapBuildBaseZ = 0;
            ClientApp.loopCycle = 101 + i;
            ClientApp.GlMoveEntity(1, actor);
            trace.push([actor.x, actor.z, actor.yaw].join(' '));
        }
    }
    return trace;
}

test('530 local teleport, player add, masks and running update', () => {
    expect(runPlayers()).toEqual(['2 51 55 49 58 0 1792 200 300 1 6447 6437', '2 52 55 50 60 2 1792 200 300 1 6447 6437']);
});

test('NPC add, masks, crawl, despawn', () => {
    const state = freshActors();
    const assets = localAssets(cachePath, [18]);
    NpcType.Init(assets.archive(18), assets.archive(18));
    state.self.move(true, 46, 49);
    const add = new Bits().p(8, 0).p(15, 2000).p(1, 1).p(3, 4).p(1, 1).p(5, -4).p(14, 87).p(5, 9).p(15, 32767);
    decode(Uint8Array.of(...add.bytes, 0xcc, 2, 50, 255, 184, 128, 133, 1, 163, 5, 0, 92, 0, 25, 175, 25, 37), false, 78);
    const npc = requireNonNull(state.npcs.get(2000));
    expect([requireNonNull(npc.npcType).id, npc.yaw, npc.pathX[0], npc.pathZ[0], npc.health, npc.faceEntity, npc.spotanim, npc.spotStart, npc.spotHeight, npc.faceX, npc.faceZ]).toEqual([87, 1536, 58, 42, 200, 32773, 291, 83, 92, 6447, 6437]);
    decode(Uint8Array.from(new Bits().p(8, 1).p(1, 1).p(2, 2).p(1, 0).p(3, 7).p(1, 0).bytes), false, 79);
    expect([npc.pathX[0], npc.pathZ[0], npc.pathSpeed[0]]).toEqual([59, 41, 0]);
    decode(Uint8Array.of(0), false, 80);
    expect(ClientApp.npcs.filter(npc => npc !== null).length).toBe(0);
});

test('first PLAYER_INFO and NPC_INFO from a Majula 530 Tutorial Island login', () => {
    const state = freshActors();
    const assets = localAssets(cachePath, [18]);
    NpcType.Init(assets.archive(18), assets.archive(18));
    PlayerModel.recolourDestinations = PlayerModel.recolourDestinationsRs;
    decode(tutorialPlayerInfo, true, 5);
    expect(toJsString(requireNonNull(state.self.username))).toBe('Porttester');
    expect(state.self.bas).toBe(1426);
    const npcInfo = Buffer.from('0037d2708763f37d8d90770737dad90770937dc7a875e7fffe080218a91847080218bb1829080218bf1829080218b9182f', 'hex');
    decode(npcInfo, false, 5);
    expect(ClientApp.npcs.filter(npc => npc !== null).length).toBe(4);
    decode(Uint8Array.of(0, 0), true, 17);
    decode(Uint8Array.of(4, 0), false, 17);
    expect(ClientApp.npcs.filter(npc => npc !== null).length).toBe(4);
});

loginFixture(import.meta.url, 'instanced rebuild deduplicates map squares in template order', async () => {
    const bits = new Bits();
    const template = (401 << 14) | (402 << 3) | 2;
    for (let i = 0; i < 676; i++) {
        if (i === 0 || i === 300) {
            bits.p(1, 1).p(26, template);
        } else {
            bits.p(1, 0);
        }
    }
    const packet = Uint8Array.of(179, 0, 16, 1, 126, 183, 0, ...bits.bytes, ...new Uint8Array(16), 1, 144);
    const rebuild = runRebuild(packet, true);
    expect(rebuild.squares.map(square => square.id)).toEqual([0x3232]);
    expect([rebuild.localX, rebuild.localZ, rebuild.level, rebuild.zoneX, rebuild.zoneZ]).toEqual([51, 55, 2, 400, 400]);
    expect(requireNonNull(rebuild.templates)[300]).toBe(template);
});

test.skipIf(!gamepackPath)(
    'player updates give the same path and masks in sc.e',
    () => {
        const source = fileURLToPath(new URL('./game/PlayerOracle.java', import.meta.url));
        const args = [first, second].map(data => Buffer.from(data).toString('hex'));
        const result = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', gamepackPath, source, ...args, 'motion'], { timeout: 20000 });
        expect(result.stderr.toString()).toBe('');
        expect(result.exitCode).toBe(0);
        expect(runPlayers(true)).toEqual(result.stdout.toString().trim().split(/\r?\n/));
    },
    30000
);
