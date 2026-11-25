import LocType from '#/config/LocType.js';
import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gamepackPath } from './reference.js';
import Client from '#/client/Client.js';
import LocMergeQueue from '#/client/LocMergeQueue.js';
import world from '#/dash3d/world.js';
import LocChange from '#/dash3d/LocChange.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import ClientNpc from '#/dash3d/ClientNpc.js';
import type ClientEntity from '#/dash3d/ClientEntity.js';
import { receivePacket } from './receive-packet.js';
import Protocol from '#/io/Protocol.js';
import ClientObj from '#/dash3d/ClientObj.js';
import Decor from '#/dash3d/Decor.js';
import GroundDecor from '#/dash3d/GroundDecor.js';
import PendingLocMerge from '#/dash3d/PendingLocMerge.js';
import Square from '#/dash3d/Square.js';
import Sprite from '#/dash3d/Sprite.js';
import Wall from '#/dash3d/Wall.js';
import Linkable from '#/datastruct/Linkable.js';
import type SharedPtrList from '#/datastruct/SharedPtrList.js';
import SceneCutover from '#/scene/SceneCutover.js';
import WrappedException from '#/util/WrappedException.js';

type Wire = { op: number; data: Uint8Array };
type Row = { level: number; cycle: number; width: number; length: number; mask: number; packets: Wire[] };
const posX = 37,
    posZ = 55,
    locId = 17771;

function payload(actor: number, shape: number, angle: number, i: number): Uint8Array {
    const x1 = (i * 13 - 120) & 255,
        z1 = (i * 31 + 15) & 255,
        z2 = (i * 93 + 131) & 255,
        x2 = (i * 17 - 12) & 255;
    const end = (i * 3197 + 3) & 65535,
        start = (i * 1279 + 21) & 65535;
    return Uint8Array.of((shape << 2) | angle, 0x57, x1 + 128, z1 + 128, 128 - z2, locId >> 8, locId + 128, end, end >> 8, x2, start >> 8, start, actor + 128, actor >> 8);
}

function rows(): Row[] {
    return Array.from({ length: 184 }, (_, i) => {
        const packets: Wire[] = [];
        for (let j = 0; j < 1 + (i % 4); j++) {
            const index = i + j,
                actor = [-74, -11, 10, -148, 77, -11, 0, 32767][index % 8],
                shape = index % 21 === 0 ? 25 : index % 23;
            const bytes = payload(actor, shape, (index >> 1) & 3, index);
            if (j % 2 === 0) packets.push({ op: 202, data: bytes });
            else packets.push({ op: 230, data: Uint8Array.of(48 ^ 128, 128 - 32, 202, ...bytes, 202, ...payload(10, shape, index & 3, index + 1)) });
        }
        return { level: i % 4, cycle: i % 3 === 0 ? 0x7ffffff0 : -3245 + i, width: 1 + (i % 6), length: 2 + (i % 7), mask: i % 5 === 0 ? 0 : i % 3 === 0 ? i % 16 : 15, packets };
    });
}

function queue(): string {
    const result: string[] = [];
    for (let m = LocMergeQueue.pending.head(); m !== null; m = LocMergeQueue.pending.next()) result.push([m.actor, m.angle, m.endDelay, m.x, m.offsetZ2, m.shape, m.z, m.offsetX2, m.offsetZ1, m.locId, m.offsetX1, m.startDelay].join(','));
    return result.join('/');
}
function changes(): string {
    const result: string[] = [];
    for (let c = Client.locChanges.head(); c !== null; c = Client.locChanges.next()) result.push([c.remaining, c.plane, c.x, c.layer, c.oldAngle, c.shape, c.oldShape, c.delay, c.oldId, c.id, c.z, c.angle].join(','));
    return result.join('/');
}
function actor(a: ClientEntity, entities: object[]): string {
    return [a.attachment === null ? -1 : entities.indexOf(a.attachment), a.attachmentEnd, a.attachmentHeight, a.attachmentX, a.attachmentStart, a.attachmentZ, a.attachmentMaxZ, a.attachmentMinX, a.attachmentMinZ, a.attachmentMaxX].join(',');
}

function processQueue(): string {
    try {
        LocMergeQueue.processQueue();
        return 'ok';
    } catch (error) {
        if (!(error instanceof WrappedException)) throw error;
        const cause = error.cause;
        let name: string;
        if (cause instanceof RangeError) name = 'ArrayIndexOutOfBoundsException';
        else if (cause instanceof TypeError && cause.message.includes('ClassCastException')) name = 'ClassCastException';
        else if (cause instanceof TypeError) name = 'NullPointerException';
        else throw error;
        return name + '@' + error.context;
    }
}

function nativeTile(level: number, mask: number, entities: ClientObj[]): Square {
    const tile = new Square(level, posX, posZ);
    tile.wall = new Wall();
    tile.decor = new Decor();
    tile.groundDecor = new GroundDecor();
    function key(layer: number): bigint {
        return (BigInt(501 + layer) << 32n) | BigInt(0x40000000 | ((4 + layer) << 14) | (layer << 20) | (posZ << 7) | posX);
    }
    tile.wall.typecode = key(0);
    tile.wall.model1 = (mask & 1) !== 0 ? entities[0] : null;
    tile.decor.typecode = key(1);
    tile.decor.model = (mask & 2) !== 0 ? entities[1] : null;
    tile.spriteCount = 3;
    for (let i = 0; i < 3; i++) {
        const sprite = (tile.sprites[i] = new Sprite());
        sprite.typecode = i === 0 ? 0n : key(2);
        sprite.minTileX = i === 1 ? posX - 1 : posX;
        sprite.minTileZ = posZ;
        sprite.model = i < 2 ? entities[0] : (mask & 4) !== 0 ? entities[2] : null;
    }
    tile.groundDecor.typecode = key(3);
    tile.groundDecor.model = (mask & 8) !== 0 ? entities[3] : null;
    return tile;
}

test('rg 202 and enclosed 230, jk enqueue, sg actor attachments and timed loc replacements match the gamepack', async () => {
    const vectors = rows(),
        tmp = mkdtempSync(join(tmpdir(), 'loc-merge-530-'));
    let expected: string[];
    try {
        const source = fileURLToPath(new URL('./game/LocMergeOracle.java', import.meta.url));
        const build = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', tmp, source]);
        expect(build.stderr.toString()).toBe('');
        expect(build.exitCode).toBe(0);
        const lines = vectors.map(row => [row.level, row.cycle, row.width, row.length, row.mask, ...row.packets.map(p => p.op + ':' + Buffer.from(p.data).toString('hex'))].join(' '));
        const trace = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', tmp + delimiter + gamepackPath, 'LocMergeOracle'], { stdin: Buffer.from(lines.join('\n') + '\n') });
        expect(trace.stderr.toString()).toBe('');
        expect(trace.exitCode).toBe(0);
        expected = trace.stdout.toString().trimEnd().split(/\r?\n/);
    } finally {
        rmSync(tmp, { recursive: true, force: true });
    }
    const oldZone = [Protocol.zoneUpdateX, Protocol.zoneBaseZ],
        entities = Array.from({ length: 4 }, () => new ClientObj());
    const oldNative = SceneCutover.native,
        oldSquares = world.squares;
    const squares = Array.from({ length: 4 }, () => Array.from({ length: 104 }, () => new Array<Square | null>(104).fill(null)));
    const heights = Array.from({ length: 4 }, (_, level) => Array.from({ length: 105 }, (_, x) => Int32Array.from({ length: 105 }, (_, z) => Math.imul(x, 17777777) ^ Math.imul(z, 172972831) ^ Math.imul(level, -1131351479))));
    const oldHeights = world.levelHeightmaps,
        oldScene = LocChange.scene,
        oldPid = Client.localPid,
        oldCycle = Client.loopCycle,
        oldLevel = Client.playerLevel;
    const oldPlayer = Client.players[10],
        oldNpc = Client.npcs[9],
        oldSelf = Client.localPlayer;
    const oldMissingPlayer = Client.players[147],
        oldMissingNpc = Client.npcs[76],
        oldLastNpc = Client.npcs[32766];
    try {
        Client.localPid = 73;
        world.levelHeightmaps = heights;
        Client.players[147] = null;
        Client.npcs[76] = null;
        Client.npcs[32766] = null;
        for (const native of [false, true]) {
            SceneCutover.native = native;
            world.squares = native ? squares : null;
            for (const [i, row] of vectors.entries()) {
                LocMergeQueue.pending.clear();
                Client.locChanges.clear();
                Client.loopCycle = row.cycle;
                Client.playerLevel = (row.level + 1) & 3;
                const self = (Client.localPlayer = new ClientPlayer());
                const player = (Client.players[10] = new ClientPlayer());
                const npc = (Client.npcs[9] = new ClientNpc());
                const type = new LocType();
                type.width = row.width;
                type.length = row.length;
                LocType.m_recentUse.Put(BigInt(locId), type);
                squares[row.level][posX][posZ] = nativeTile(row.level, row.mask, entities);
                if (native) {
                    LocChange.scene = null;
                } else {
                    LocChange.scene = {
                        getLoc: (level, x, z, layer) => (level === row.level && x === posX && z === posZ ? { id: 501 + layer, shape: 4 + layer, angle: layer } : null),
                        getEntity: (level, x, z, layer) => (level === row.level && x === posX && z === posZ && (row.mask & (1 << layer)) !== 0 ? entities[layer] : null),
                        setLoc() {}
                    };
                }
                Protocol.zoneUpdateX = 32;
                Protocol.zoneBaseZ = 48;
                for (const packet of row.packets) await receivePacket(packet.op, packet.data);
                const before = queue();
                Client.playerLevel = row.level;
                const failed = processQueue();
                const actors = [self, player, npc].map(a => actor(a, entities)).join('/');
                expect([before, failed, queue(), actors, changes()].join(';'), 'native=' + native + ' row ' + i).toBe(expected[i]);
            }
        }
        LocMergeQueue.pending.clear();
        const wrong = new Linkable(),
            next = new PendingLocMerge();
        const pending: SharedPtrList<Linkable> = LocMergeQueue.pending;
        pending.push_back(wrong);
        pending.push_back(next);
        const failure = processQueue();
        expect([failure, wrong.IsLinked(), pending.head() === next].join('/')).toBe(expected[vectors.length]);
    } finally {
        SceneCutover.native = oldNative;
        world.squares = oldSquares;
        [Protocol.zoneUpdateX, Protocol.zoneBaseZ] = oldZone;
        Client.players[10] = oldPlayer;
        Client.npcs[9] = oldNpc;
        Client.localPlayer = oldSelf;
        Client.players[147] = oldMissingPlayer;
        Client.npcs[76] = oldMissingNpc;
        Client.npcs[32766] = oldLastNpc;
        Client.localPid = oldPid;
        Client.loopCycle = oldCycle;
        Client.playerLevel = oldLevel;
        world.levelHeightmaps = oldHeights;
        LocChange.scene = oldScene;
        LocMergeQueue.pending.clear();
        Client.locChanges.clear();
        LocType.m_recentUse.Remove(BigInt(locId));
    }
}, 20000);
