import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Client from '#/client/Client.js';
import { glJar } from '#/client/ClientVariant.js';
import world from '#/dash3d/world.js';
import Protocol from '#/io/Protocol.js';
import SuperPacket from '#/io/SuperPacket.js';
import SceneCutover from '#/scene/SceneCutover.js';
import WrappedException from '#/util/WrappedException.js';
import { gamepackPath } from '../reference.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';
import { supplyPacket } from '../receive-packet.js';

type Row = [mode: 'empty' | 'missing' | 'null' | 'pending', wire: Buffer];

function wire(shape: number, angle: number, sequence: number, level: number, x: number, z: number): Buffer {
    const data = Buffer.alloc(7);
    data[0] = 128 - ((shape << 2) | angle);
    data.writeUInt16BE(sequence, 1);
    data.writeUInt32BE(((level << 28) | ((3200 + x) << 14) | (6400 + z)) >>> 0, 3);
    return data;
}

function cases(): Row[] {
    const rows: Row[] = [];
    for (let shape = 0; shape < 64; shape++)
        for (let angle = 0; angle < 4; angle++) {
            const data = wire(shape, angle, angle === 3 ? 65535 : (shape << 8) | angle, angle, 102 - shape, shape);
            rows.push(['empty', data], ['missing', data]);
        }
    for (const shape of [0, 2, 8, 11, 22, 23, 63]) {
        for (const [x, z] of [
            [-1, 0],
            [0, -1],
            [0, 0],
            [102, 102],
            [103, 1],
            [1, 103]
        ]) {
            const data = wire(shape, 2, 65535, 3, x, z);
            rows.push(['missing', data]);
            for (let length = 0; length <= data.length; length++) rows.push(['empty', data.subarray(0, length)]);
        }
    }
    rows.push(['null', Buffer.alloc(0)], ['pending', wire(2, 3, 7, 1, 32, 43)]);
    return rows;
}

async function compare(): Promise<void> {
    const dir = mkdtempSync(join(tmpdir(), 'rs530-loc-packet-'));
    const state = { stream: Client.stream, x: Client.mapBuildBaseX, z: Client.mapBuildBaseZ, native: SceneCutover.native, squares: world.squares };
    const protocol = { inPacket: Protocol.inPacket, packetSize: Protocol.packetSize, packetType: Protocol.packetType, lastPacketType0: Protocol.lastPacketType0, ptype1: Protocol.ptype1, ptype2: Protocol.ptype2, idleReads: Protocol.idleReads };
    try {
        const compile = Bun.spawnSync(['javac', '-encoding', 'UTF-8', '-d', dir, join(import.meta.dir, 'LocAnimPacketOracle.java')]);
        expect(compile.exitCode, compile.stderr.toString()).toBe(0);
        const rows = cases();
        const cp = [dir, ...(glJar ? [hdGamepackPath, joglPath] : [gamepackPath])].join(delimiter);
        const original = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-XX:-OmitStackTraceInFastThrow', '-cp', cp, 'LocAnimPacketOracle', glJar ? 'gl' : 'sd'], {
            stdin: Buffer.from(rows.map(([m, b]) => m + ' ' + b.toString('hex')).join('\n') + '\n')
        });
        expect(original.exitCode, original.stderr.toString()).toBe(0);
        const reference = original.stdout.toString().trimEnd().split(/\r?\n/);
        expect(reference).toHaveLength(rows.length);
        const empty = Array.from({ length: 4 }, () => Array.from({ length: 104 }, () => new Array<null>(104).fill(null)));
        SceneCutover.native = true;
        Client.mapBuildBaseX = 3200;
        Client.mapBuildBaseZ = 6400;
        for (const [index, [mode, body]] of rows.entries()) {
            const packet = new SuperPacket(body.length);
            packet.m_pos = 8;
            supplyPacket(235, body, packet);
            if (mode === 'null') {
                packet.m_data = null;
                // Both original ClientStream.Read methods return before touching a zero-length buffer.
                if (Client.stream !== null) Client.stream.Read = async () => {};
            }
            if (mode === 'pending') Protocol.packetSize = body.length + 2;
            Protocol.lastPacketType0 = 41;
            Protocol.ptype1 = 42;
            Protocol.ptype2 = 43;
            Protocol.idleReads = 71;
            world.squares = mode === 'missing' ? null : empty;
            let result: string;
            try {
                result = String(await Protocol.TcpIn());
            } catch (error) {
                if (!(error instanceof WrappedException)) throw error;
                if (error.cause instanceof RangeError) result = 'bounds ' + error.cause.message.split(' ').at(-1);
                else if (error.cause instanceof TypeError) result = 'null';
                else throw error;
                result += ' ' + error.context;
            }
            const row = result + '|' + [packet.m_pos, Protocol.packetType, Protocol.packetSize].join(',') + '|' + [Protocol.idleReads, Protocol.lastPacketType0, Protocol.ptype1, Protocol.ptype2].join(',');
            expect(row, mode + ' ' + body.toString('hex')).toBe(reference[index]);
        }
    } finally {
        Object.assign(Protocol, protocol);
        Client.stream = state.stream;
        Client.mapBuildBaseX = state.x;
        Client.mapBuildBaseZ = state.z;
        SceneCutover.native = state.native;
        world.squares = state.squares;
        rmSync(dir, { recursive: true, force: true });
    }
}

test('packet 235 matches the original TcpIn and native scene fault boundaries in both gamepacks', async () => {
    await compare();
    if (!glJar) {
        const child = Bun.spawnSync([process.execPath, 'test', fileURLToPath(import.meta.url)], {
            env: { ...process.env, RS530_GAMEPACK_IDENTITY: 'gl' }
        });
        expect(child.exitCode, child.stderr.toString()).toBe(0);
        expect(child.stderr.toString()).toMatch(/^\s*1 pass$/m);
    }
}, 120000);
