import { expect } from 'bun:test';
import { JavaError } from '#/util/JavaException.js';
import WrappedException from '#/util/WrappedException.js';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import Protocol from '#/io/Protocol.js';
import SuperPacket from '#/io/SuperPacket.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { loginFixture } from './login-fixture.js';
import { supplyPacket } from './receive-packet.js';
import { gamepackPath } from './reference.js';

interface Probe {
    opcode: number;
    sweep: boolean;
    changeGate: number;
    replacement: number;
    stopGate: number;
    changePacket: number;
    stopPacket: number;
    wire: Buffer;
    other: Buffer;
}

function probe(opcode: number, sweep: boolean): Probe {
    const wire = Buffer.alloc(32);
    wire[0] = opcode === 235 ? 128 : 1;
    wire[1] = opcode === 116 ? 1 : 0;
    wire[6] = 16;
    const other = Buffer.alloc(48);
    wire.copy(other, 3);
    other[7] = 81;
    return { opcode, sweep, changeGate: 0, replacement: 0, stopGate: 0, changePacket: 0, stopPacket: 0, wire, other };
}

function vectors(): Probe[] {
    const rows: Probe[] = [];
    for (let opcode = 0; opcode <= 255; opcode++) rows.push(probe(opcode, true));
    // An unknown id takes the entire comparison chain, including all thirteen
    // comparisons that enter the same zone-update handler.
    for (let i = 1; i <= 100; i++) {
        rows.push({ ...probe(255, true), stopGate: i });
        for (const replacement of [65, 179, 9]) rows.push({ ...probe(255, true), changeGate: i, replacement });
    }
    for (const [opcode, acquisitions] of [
        [65, 3],
        [37, 2],
        [44, 4],
        [217, 5],
        [116, 4],
        [26, 2],
        [132, 5],
        [169, 1],
        [235, 3]
    ]) {
        for (let read = 1; read <= acquisitions; read++) {
            for (let swap = 0; swap <= read; swap++) {
                rows.push({ ...probe(opcode, false), changePacket: swap, stopPacket: read });
            }
            rows.push({ ...probe(opcode, false), changePacket: read, other: Buffer.alloc(1) });
        }
        if ([44, 217, 116, 26, 169, 235].includes(opcode)) {
            for (let swap = 0; swap <= acquisitions; swap++) rows.push({ ...probe(opcode, false), changePacket: swap });
        }
    }
    return rows;
}

function encode(v: Probe): string {
    return [v.opcode, +v.sweep, v.changeGate, v.replacement, v.stopGate, v.changePacket, v.stopPacket, v.wire.toString('hex'), v.other.toString('hex')].join(' ');
}

const protocolSource = readFileSync(join(import.meta.dir, '../src/io/Protocol.ts'), 'utf8').split(/\r?\n/);
const sites = new Map<string, number>();
function comparisonSite(): number {
    // Bun reports the exact property access even for adjacent reads in ||.
    // Read the operand at that site to stop before entering any handler for
    // the exhaustive byte sweep. The normal TcpIn runs with its own imports.
    const frame = /at TcpIn \([^\n]*Protocol\.ts:(\d+):(\d+)\)/.exec(new Error().stack ?? '');
    if (!frame) throw new Error('TcpIn source location missing');
    const key = frame[0];
    const cached = sites.get(key);
    if (cached !== undefined) return cached;
    const line = protocolSource[Number(frame[1]) - 1].slice(Number(frame[2]) - 1);
    const gate = /^Protocol\.packetType === (\d+)/.exec(line);
    if (gate === null && !/^Protocol\.packetType\b/.test(line)) throw new Error('Unexpected packet-type access at ' + key);
    const value = gate === null ? -1 : Number(gate[1]);
    sites.set(key, value);
    return value;
}

async function client(v: Probe): Promise<string> {
    const first = new SuperPacket(48),
        second = new SuperPacket(0);
    first.m_pos = 12;
    second.m_data = new Uint8Array(v.other);
    second.m_pos = 3;
    supplyPacket(v.opcode, v.wire, first);
    Protocol.idleReads = 55;
    Protocol.lastPacketType0 = 42;
    Protocol.ptype1 = 51;
    Protocol.ptype2 = 11;
    Protocol.zoneUpdateX = 44;
    Protocol.zoneBaseZ = 45;
    Client.hintHeadicons = [null];
    Client.uidFile = null;
    Client.mapBuildBaseX = 1000;
    Client.mapBuildBaseZ = 1000;
    let packet = first,
        opcode = v.opcode,
        history = 42;
    let dispatch = false,
        gates = 0,
        buffers = 0;
    const boundary = new JavaError('probe');
    const reads: string[] = [];
    const saved = Object.getOwnPropertyDescriptors(Protocol);
    Object.defineProperties(Protocol, {
        lastPacketType0: {
            configurable: true,
            get: () => history,
            set(value: number) {
                history = value;
                dispatch = true;
            }
        },
        packetType: {
            configurable: true,
            get() {
                if (!dispatch) {
                    reads.push('p');
                    return opcode;
                }
                const candidate = comparisonSite();
                reads.push(candidate < 0 ? 'other' : String(candidate));
                gates++;
                if (gates === v.changeGate) opcode = v.replacement;
                if (gates === v.stopGate || (v.sweep && (opcode === candidate || candidate < 0))) throw boundary;
                return opcode;
            },
            set(value: number) {
                opcode = value;
            }
        },
        inPacket: {
            configurable: true,
            get() {
                reads.push('b' + first.m_pos + '/' + second.m_pos);
                if (dispatch) {
                    buffers++;
                    if (buffers === v.changePacket) packet = second;
                    if (buffers === v.stopPacket) throw boundary;
                }
                return packet;
            }
        }
    });
    let outcome: string;
    try {
        outcome = String(await Protocol.TcpIn());
    } catch (error) {
        const cause = error instanceof WrappedException ? error.cause : error;
        if (error === boundary) outcome = 'stop';
        else if (cause instanceof RangeError) outcome = 'bounds';
        else if (cause instanceof TypeError) outcome = 'null';
        else throw error;
    } finally {
        for (const name of ['packetType', 'inPacket', 'lastPacketType0'] as const) Object.defineProperty(Protocol, name, saved[name]);
    }
    return [reads.join(','), outcome, [first.m_pos, second.m_pos, packet === second ? 2 : 1].join(','), [opcode, history, Protocol.ptype1, Protocol.ptype2, Protocol.idleReads, Protocol.zoneUpdateX, Protocol.zoneBaseZ].join(',')].join(';');
}

loginFixture(
    import.meta.url,
    'TcpIn reads the current packet type and buffer in original dispatch order',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-packet-dispatch-'));
        const exports = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED', '--add-exports', 'java.base/jdk.internal.org.objectweb.asm.tree=ALL-UNNAMED'];
        const cp = [dir, gamepackPath].join(delimiter);
        const rows = vectors();
        try {
            for (const command of [
                ['javac', ...exports, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game', 'PacketDispatchOrderOracle.java')],
                ['java', ...exports, '-cp', cp, 'PacketDispatchOrderOracle', dir]
            ]) {
                const result = Bun.spawnSync(command);
                expect(result.exitCode, result.stderr.toString()).toBe(0);
            }
            const java = Bun.spawnSync(['java', ...exports, '-Djava.awt.headless=true', '-cp', cp, 'PacketDispatchOrderOracle'], {
                stdin: Buffer.from(rows.map(encode).join('\n') + '\n'),
                maxBuffer: 8 * 1024 * 1024
            });
            expect(java.exitCode, java.stderr.toString()).toBe(0);
            const expected = java.stdout.toString().trimEnd().split(/\r?\n/);
            expect(expected.length).toBe(rows.length);
            for (const [i, row] of rows.entries()) expect(await client(row), encode(row)).toBe(requireNonNull(expected[i]));
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    30000
);
