import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import LocMergeQueue from '#/client/LocMergeQueue.js';
import ClientObj from '#/dash3d/ClientObj.js';
import ClientObjNode from '#/dash3d/ClientObjNode.js';
import type Square from '#/dash3d/Square.js';
import world from '#/dash3d/world.js';
import Linkable from '#/datastruct/Linkable.js';
import SharedPtrList from '#/datastruct/SharedPtrList.js';
import Protocol from '#/io/Protocol.js';
import SuperPacket from '#/io/SuperPacket.js';
import SceneCutover from '#/scene/SceneCutover.js';
import WrappedException from '#/util/WrappedException.js';
import { gamepackPath } from './reference.js';
import { loginFixture } from './login-fixture.js';
import { supplyPacket } from './receive-packet.js';

type Input = [opcode: number, entry: number, scenario: number, start: number, body: Buffer];

function vectors(): Input[] {
    const rows: Input[] = [];
    for (const op of [16, 121, 33, 14, 97, 240, 135, 17, 195, 104, 202, 179, 20]) {
        // rg's size table gives 104 a zero length. Its qd subpacket in an
        // enclosed 230 still reads the whole 17-byte projectile body.
        const length = op === 104 ? 17 : Protocol.serverPacketSizes[op];
        const full = Buffer.from(Array.from({ length }, (_, i) => (i * 51 + 157) & 255));
        if (op === 179) full[0] = 128 + (4 << 2);
        if (op === 20) full[1] = 128 - (6 << 2);
        if (op === 195) full[0] = -(9 << 2);
        for (let cut = 0; cut <= full.length; cut++) for (const entry of [0, 1, 2, 3, 4]) rows.push([op, entry, 0, 0, full.subarray(0, cut)]);
        for (const scenario of [1, 2]) for (const start of [0, -1, 2147483646, 2147483647, -2147483648]) rows.push([op, 0, scenario, start, full]);
        if (op !== 14 && op !== 240) continue;
        const invalidList = Buffer.from(full);
        invalidList[0] = op === 14 ? 0 : 128;
        for (const scenario of [3, 4]) for (const entry of [0, 1, 2]) for (const cut of [0, full.length - 1, full.length]) rows.push([op, entry, scenario, 0, invalidList.subarray(0, cut)]);
    }
    return rows;
}

async function client([op, entry, scenario, start, body]: Input): Promise<string> {
    const base = scenario <= 2 ? 200 : 0;
    const pile = new SharedPtrList<ClientObjNode>();
    const wrong = new Linkable(),
        node = new ClientObjNode(new ClientObj());
    node.obj.id = 5;
    node.obj.count = 7;
    const mixed: SharedPtrList<Linkable> = pile;
    if (scenario === 3) mixed.push_back(wrong);
    mixed.push_back(node);
    if (scenario === 4) mixed.push_back(wrong);
    Client.groundObj = [Array.from({ length: 8 }, () => new Array<SharedPtrList<ClientObjNode> | null>(8).fill(null))];
    Client.groundObj[0][0][0] = pile;
    LocMergeQueue.pending.clear();
    Client.locChanges.clear();
    world.squares = [Array.from({ length: 8 }, () => new Array<Square | null>(8).fill(null))];
    world.levelHeightmaps = null;
    Client.playerLevel = 0;
    Client.localPid = 51;
    Protocol.zoneUpdateX = Protocol.zoneBaseZ = base;
    Protocol.idleReads = 71;
    Protocol.lastPacketType0 = 41;
    Protocol.ptype1 = 42;
    Protocol.ptype2 = 43;
    const enclosed = entry === 2 || entry === 4;
    const frame = enclosed ? Buffer.concat([Buffer.from([base + 128, 128 - base, op]), body]) : body;
    const packet = new SuperPacket(0);
    packet.m_data = scenario === 1 ? null : entry === 0 ? new Uint8Array(frame) : new Uint8Array(frame.length);
    packet.m_pos = start;
    supplyPacket(enclosed ? 230 : op, frame, packet);
    Protocol.packetSize = entry === 3 || entry === 4 ? frame.length + 2 : frame.length;
    let status = 'ok';
    try {
        if (entry === 0) Client.ZonePacket();
        else status = String(await Protocol.TcpIn());
    } catch (error) {
        if (!(error instanceof WrappedException)) throw error;
        const cause = error.cause;
        let type: string;
        if (cause instanceof RangeError) type = 'ArrayIndexOutOfBoundsException';
        else if (cause instanceof TypeError) type = cause.message.startsWith('ClassCastException') ? 'ClassCastException' : 'NullPointerException';
        else throw error;
        status = type + '@' + error.context;
    }
    const merges: string[] = [];
    for (let m = LocMergeQueue.pending.head(); m !== null; m = LocMergeQueue.pending.next()) merges.push([m.actor, m.angle, m.endDelay, m.x, m.offsetZ2, m.shape, m.z, m.offsetX2, m.offsetZ1, m.locId, m.offsetX1, m.startDelay].join(','));
    const next = pile['cursor'];
    const cur = next === null ? '-' : next === wrong ? 'w' : next === node ? 'b' : next === pile.sentinel ? 's' : '?';
    return [
        status,
        [packet.m_pos, Protocol.packetType, Protocol.packetSize].join(','),
        [Protocol.idleReads, Protocol.lastPacketType0, Protocol.ptype1, Protocol.ptype2].join(','),
        merges.join('/'),
        [cur, node.obj.count, node.IsLinked(), wrong.IsLinked()].join(',')
    ].join('|');
}

loginFixture(
    import.meta.url,
    'all zone payload prefixes reproduce the gamepack reader, wire cursor and diagnostic context',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), '530-zone-truncation-'));
        try {
            SceneCutover.native = true;
            const cc = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game/ZonePacketTruncationOracle.java'), join(import.meta.dir, 'game/LocMergeOracle.java')]);
            expect(cc.exitCode, cc.stderr.toString()).toBe(0);
            const rows = vectors(),
                lines = rows.map(([op, entry, scenario, start, body]) => [op, entry, scenario, start, body.toString('hex')].join(' '));
            const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'ZonePacketTruncationOracle'], { stdin: Buffer.from(lines.join('\n') + '\n'), maxBuffer: 4 * 1024 * 1024 });
            expect(java.exitCode, java.stderr.toString()).toBe(0);
            const expected = java.stdout.toString().trimEnd().split(/\r?\n/);
            expect(expected.length).toBe(rows.length);
            for (const [i, row] of rows.entries()) expect(await client(row), lines[i]).toBe(expected[i]);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    25000
);
