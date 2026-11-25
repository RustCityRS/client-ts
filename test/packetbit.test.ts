import { gamepackPath } from './reference.js';
import { requireNonNull } from '../src/util/JavaArray.js';
import { expect, test } from 'bun:test';
import { fileURLToPath } from 'node:url';
import SuperPacket from '../src/io/SuperPacket.js';

test('be methods, encrypted buffers and cursor changes match the original gamepack', () => {
    type Command = [number, number?, number?];
    const commands: Command[] = [[0], [5], [4, 17], [1, 0], [3]];
    for (let i = 0; i < 300; i++) commands.push([4, i * 29 - 17]);
    commands.push([1, 0], [3], [5], [6, 3, 259], [5], [6, 0, 0]);
    for (let offset = 0; offset < 8; offset++) {
        for (const width of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 16, 20, 24, 26, 31, 32, 36, 64]) {
            commands.push([1, 9], [7], [9, offset], [9, width], [10, 599], [8]);
        }
    }
    commands.push(
        [10, 0x7fffffff],
        [10, -0x80000000],
        [1, 0],
        [7],
        [9, 36],
        [5],
        [3],
        [2, -8],
        [9, 1],
        [2, 0],
        [9, -1],
        [8],
        [1, 600],
        [7],
        [9, 0],
        [5],
        [4, 0],
        [1, 0],
        [6, -1, 1],
        [6, 319, 3],
        [6, 0, -1],
        [1, 599],
        [6, 0, 2],
        [1, 0x7fffffff],
        [5],
        [1, 0x7fffffff],
        [4, 123],
        [7],
        [8],
        [3],
        [2, 0x7fffffff],
        [8]
    );
    const input = Buffer.alloc((1 + commands.length * 3) * 4);
    input.writeInt32BE(commands.length);
    let end = 4;
    for (const [op, a = 0, b = 0] of commands) {
        for (const word of [op, a, b]) end = input.writeInt32BE(word, end);
    }
    const oracle = fileURLToPath(new URL('./login/PacketBitOracle.java', import.meta.url));
    const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', gamepackPath, oracle], { stdin: input, timeout: 20000, maxBuffer: 4 * 1024 * 1024 });
    expect(java.stderr.toString()).toBe('');
    expect(java.exitCode).toBe(0);
    const seed = Int32Array.of(1, -1, -2147483648, 2147483647);
    const packet = new SuperPacket(600);
    const dest = new Uint8Array(320);
    let cursor = 0;
    const read = () => {
        const value = java.stdout.readInt32BE(cursor);
        cursor += 4;
        return value;
    };
    for (const [op, a = 0, b = 0] of commands) {
        let failed = 0,
            value = 0;
        try {
            switch (op) {
                case 0:
                    break;
                case 1:
                    packet.m_pos = a;
                    break;
                case 2:
                    packet['bitPos'] = a;
                    break;
                case 3:
                    packet.SetEnc(seed);
                    break;
                case 4:
                    packet.pHead(a);
                    break;
                case 5:
                    value = packet.g1Enc();
                    break;
                case 6:
                    packet.gArrayBufferEncrypted(dest, a, b);
                    break;
                case 7:
                    packet.GBitStart();
                    break;
                case 8:
                    packet.GBitEnd();
                    break;
                case 9:
                    value = packet.gBit(a);
                    break;
                case 10:
                    value = packet.BitsLeft(a);
                    break;
            }
        } catch {
            failed = 1;
        }
        const state = [failed, value, packet.m_pos, packet['bitPos'], packet['m_pIsaac']?.['remaining'] ?? -1];
        expect(state).toEqual(Array.from({ length: state.length }, read));
        for (const bytes of [requireNonNull(packet.m_data), dest]) {
            expect(Buffer.compare(bytes, java.stdout.subarray(cursor, cursor + bytes.length))).toBe(0);
            cursor += bytes.length;
        }
    }
    expect(cursor).toBe(java.stdout.length);
}, 30000);
