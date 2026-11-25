import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import ClientNpc from '#/dash3d/ClientNpc.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import Protocol from '#/io/Protocol.js';
import { JavaError } from '#/util/JavaException.js';
import WrappedException from '#/util/WrappedException.js';
import SuperPacket from '#/io/SuperPacket.js';
import { loginFixture } from './login-fixture.js';
import { supplyPacket } from './receive-packet.js';
import { gamepackPath } from './reference.js';

loginFixture(
    import.meta.url,
    'TcpIn 131 clears player and NPC sequences through the current actor table at each array access',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-actor-reset-'));
        const saved = Object.getOwnPropertyDescriptors(Client);
        try {
            const cp = dir + delimiter + gamepackPath,
                access = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED'];
            for (const command of [
                ['javac', ...access, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game/ActorSequenceResetOracle.java')],
                ['java', ...access, '-cp', cp, 'ActorSequenceResetOracle', dir]
            ]) {
                const result = Bun.spawnSync(command);
                expect(result.exitCode, result.stderr.toString()).toBe(0);
            }
            const rows: number[][] = [];
            for (let shape = 0; shape <= 4; shape++) {
                rows.push([0, 0, shape]);
                for (let read = 1; read <= 26; read++) for (let mode = 0; mode <= 6; mode++) rows.push([read, mode, shape]);
            }
            const oracle = Bun.spawnSync(['java', ...access, '-cp', cp, 'ActorSequenceResetOracle'], {
                stdin: Buffer.from(rows.map(row => row.join(' ')).join('\n') + '\n'),
                maxBuffer: 4 * 1024 * 1024
            });
            expect(oracle.exitCode, oracle.stderr.toString()).toBe(0);
            const lines = oracle.stdout.toString().trimEnd().split(/\r?\n/);
            expect(lines.length).toBe(rows.length);
            for (const [index, row] of rows.entries()) {
                const [change, mode, shape] = row;
                const allPlayers = Array.from({ length: 4 }, (_, i) => {
                    const p = new ClientPlayer();
                    p.seq = 201 + i;
                    return p;
                });
                const allNpcs = Array.from({ length: 4 }, (_, i) => {
                    const n = new ClientNpc();
                    n.seq = 501 + i;
                    return n;
                });
                const originalPlayers = [allPlayers[0], null, allPlayers[1], allPlayers[0]];
                const originalNpcs = [null, allNpcs[0], allNpcs[1], allNpcs[0]];
                const otherPlayers = [allPlayers[2], allPlayers[3], null],
                    otherNpcs = [allNpcs[2], allNpcs[3], null];
                let players: (ClientPlayer | null)[] | null = shape === 1 ? [] : shape === 2 ? null : originalPlayers;
                let npcs: (ClientNpc | null)[] | null = shape === 3 ? [] : shape === 4 ? null : originalNpcs;
                const trace: string[] = [];
                let reads = 0;
                const stop = new JavaError('field read');
                Object.defineProperty(Client, 'players', {
                    configurable: true,
                    get() {
                        const captured = players;
                        trace.push('p' + (captured === originalPlayers ? 0 : captured === otherPlayers ? 1 : captured === null ? -1 : 2));
                        if (++reads === change)
                            switch (mode) {
                                case 0:
                                    players = otherPlayers;
                                    break;
                                case 1:
                                    players = null;
                                    break;
                                case 2:
                                    players = [];
                                    break;
                                case 3:
                                    players = otherPlayers.slice(0, 1);
                                    break;
                                case 4:
                                    players = Array<ClientPlayer | null>(4).fill(null);
                                    break;
                                case 5:
                                    npcs = otherNpcs;
                                    break;
                                case 6:
                                    throw stop;
                            }
                        return captured;
                    }
                });
                Object.defineProperty(Client, 'npcs', {
                    configurable: true,
                    get() {
                        const captured = npcs;
                        trace.push('n' + (captured === originalNpcs ? 0 : captured === otherNpcs ? 1 : captured === null ? -1 : 2));
                        if (++reads === change)
                            switch (mode) {
                                case 0:
                                    npcs = otherNpcs;
                                    break;
                                case 1:
                                    npcs = null;
                                    break;
                                case 2:
                                    npcs = [];
                                    break;
                                case 3:
                                    npcs = otherNpcs.slice(0, 1);
                                    break;
                                case 4:
                                    npcs = Array<ClientNpc | null>(4).fill(null);
                                    break;
                                case 5:
                                    players = otherPlayers;
                                    break;
                                case 6:
                                    throw stop;
                            }
                        return captured;
                    }
                });
                const input = new SuperPacket(12);
                input.m_pos = 9;
                supplyPacket(131, new Uint8Array(0), input);
                Protocol.lastPacketType0 = 11;
                Protocol.ptype1 = 83;
                Protocol.ptype2 = 104;
                Protocol.idleReads = 7;
                let status: string;
                try {
                    status = String(await Protocol.TcpIn());
                } catch (error) {
                    if (error === stop) status = 'stop';
                    else {
                        let cause = error;
                        while (cause instanceof WrappedException) cause = cause.cause;
                        if (cause instanceof TypeError) status = 'null';
                        else if (cause instanceof RangeError) status = 'bounds';
                        else throw error;
                    }
                }
                const header = [Protocol.packetType, Protocol.lastPacketType0, Protocol.ptype1, Protocol.ptype2, Protocol.idleReads, input.m_pos];
                const states = [...allPlayers, ...allNpcs].map(actor => actor.seq);
                expect([status, states.join(','), header.join(','), trace.join(',')].join('/'), row.join(' ')).toBe(lines[index]);
            }
        } finally {
            Object.defineProperty(Client, 'players', saved.players);
            Object.defineProperty(Client, 'npcs', saved.npcs);
            rmSync(dir, { recursive: true, force: true });
        }
    },
    30000
);
