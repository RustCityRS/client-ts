import { requireNonNull } from '../src/util/JavaArray.js';
import { gamepackPath } from './reference.js';
import { expect, test } from 'bun:test';
import { fileURLToPath } from 'node:url';
import Js5NetQueueRequest from '../src/io/Js5NetQueueRequest.js';
import PacketT from '../src/io/PacketT.js';
import SafeTime from '../src/io/SafeTime.js';

test('fd progress, readiness, padding and eh clock rollback match the gamepack', () => {
    const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', gamepackPath, fileURLToPath(new URL('./js5net/RequestOracle.java', import.meta.url))], { timeout: 15000 });
    expect(java.stderr.toString()).toBe('');
    expect(java.exitCode).toBe(0);
    const records = java.stdout.toString().trimEnd().split(/\r?\n/);
    const req = new Js5NetQueueRequest();
    let index = 0;
    function invoke(fn: () => number | Uint8Array): string {
        try {
            const value = fn();
            return value instanceof Uint8Array ? (value === requireNonNull(req.packet).m_data ? 'same' : 'different') : String(value);
        } catch {
            return 'exception';
        }
    }
    function state(): string {
        return invoke(() => req.getPercentage()) + ' ' + invoke(() => req.getData());
    }
    expect([req.incomplete, req.urgent, req.orphan, req.blockPosition, req.m_footerLength, state()].join(' ')).toBe(records[index++]);
    for (const size of [0, 3, 16]) {
        req.packet = new PacketT(size);
        for (const pad of [-2, 0, 2, 3, 16]) {
            req.m_footerLength = pad;
            for (const pos of [-1, 0, 1, 2, 3, 14, 16, 2147483647]) {
                req.packet.m_pos = pos;
                for (const incomplete of [false, true]) {
                    req.incomplete = incomplete;
                    expect(state()).toBe(records[index++]);
                }
            }
        }
    }
    const previous = SafeTime['m_lastTime'],
        adjustment = SafeTime['m_offset'];
    try {
        for (const delta of [0n, -1000n, (1n << 63n) - 1n]) {
            SafeTime['m_lastTime'] = (1n << 63n) - 1n;
            SafeTime['m_offset'] = delta;
            expect(SafeTime.CurrentTimeMillis().toString()).toBe(records[index++]);
        }
    } finally {
        SafeTime['m_lastTime'] = previous;
        SafeTime['m_offset'] = adjustment;
    }
    expect(index).toBe(records.length);
});
