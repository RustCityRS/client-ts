import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import ClientMouseListener from '#/client/ClientMouseListener.js';
import MouseTracking from '#/client/MouseTracking.js';
import OrbitCamera from '#/client/OrbitCamera.js';
import SuperPacket from '#/io/SuperPacket.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { freshGame } from './actor-fixture.js';
import { loginFixture } from './login-fixture.js';
import { gamepackPath } from './reference.js';

type Vector = [count: number, xLength: number, yLength: number, click: number, repeats: number, pattern: number, capacity: number, position: number, replaceRecorderAt: number, replacePacketAt: number, damage: number];

function vectors(): Vector[] {
    const rows: Vector[] = [];
    for (const button of [0, 1, 2])
        for (const count of [-1, 0, 1, 39, 40]) {
            for (const x of [-1, 0, 1, 3]) for (const y of [-1, 0, 1, 3]) rows.push([count, x, y, button, 4, 2, 32, 2, 0, 0, 0]);
        }
    // Every byte of the four movement encodings, length backpatch, and click report.
    for (const [pattern, repeats] of [
        [0, 7],
        [1, 8],
        [2, 31],
        [2, 32],
        [3, 2047]
    ]) {
        for (let capacity = -1; capacity <= 24; capacity++) rows.push([3, 3, 3, 2, repeats, pattern, capacity, 0, 0, 0, 0]);
    }
    // Crossing the 240-byte limit decrements the count before moving leftover samples.
    for (const x of [48, 49, 50, 51, 52])
        for (const y of [48, 49, 50, 51, 52]) {
            rows.push([52, x, y, 0, 32, 2, 255, 0, 0, 0, 0]);
        }
    for (const damage of [1, 2, 5, 7]) for (const button of [0, 2]) rows.push([42, 42, 42, button, 33, 2, 260, 0, 0, 0, damage]);
    for (const pos of [-2147483648, -1, 2147483647]) rows.push([2, 2, 2, 1, 7, 0, 9, pos, 0, 0, 0]);
    // The second range covers the last compressed sample and each destination/source
    // acquisition in the compaction loop for a 52-sample report.
    for (const read of [...Array.from({ length: 21 }, (_, i) => i + 1), ...Array.from({ length: 38 }, (_, i) => 208 + i)]) {
        for (const damage of [0, 3]) rows.push([52, 52, 52, 2, 32, 2, 260, 0, read, 0, damage]);
    }
    for (let read = 1; read <= 25; read++) for (const damage of [0, 4, 8]) rows.push([3, 3, 3, 2, 8, 2, 24, 1, 0, read, damage]);
    return rows;
}

function samples(length: number, pattern: number, y: boolean): Int32Array | null {
    if (length < 0) return null;
    return Int32Array.from({ length }, (_, i) => {
        if (pattern === 0) return (y ? 3 : 2) + i;
        if (pattern === 1) return (i % 2 === 0 ? 120 : 33) + (y ? 1 : 0);
        if (pattern === 2) return i % 2 === 0 ? (y ? 65544 : 71111) + i : -1;
        return y ? -1 : 2;
    });
}

function packet(size: number, position: number, tag: number, cipher: boolean): SuperPacket {
    const p = new SuperPacket(0);
    p.m_data = size < 0 ? null : new Uint8Array(size).fill(tag);
    p.m_pos = position;
    if (cipher) p.SetEnc(Int32Array.of(tag, 3, 9, 17));
    return p;
}

function packetState(p: SuperPacket, cipher: boolean): string {
    const bytes = p.m_data === null ? 'null' : Buffer.from(p.m_data).toString('hex'),
        pos = p.m_pos;
    let next = -1;
    if (cipher) {
        p.m_data = new Uint8Array(1);
        p.m_pos = 0;
        p.pHead(251);
        next = p.m_data[0];
    }
    return [pos, bytes, next].join(',');
}

function recorderState(r: MouseTracking): string {
    const hash = (values: Int32Array | null) => (values === null ? 0 : values.reduce((h, v) => (Math.imul(h, 31) + v) | 0, 1));
    return [r.count, hash(r.samplesX), hash(r.samplesY)].join(',');
}

loginFixture(
    import.meta.url,
    'GameLoop mouse sample faults preserve live recorder reads, ISAAC and partial output in t.c',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-mouse-packet-')),
            rows = vectors();
        let expected: string[];
        try {
            const exports = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED'];
            const cp = dir + delimiter + gamepackPath;
            for (const cmd of [
                ['javac', ...exports, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game', 'MousePacketOracle.java')],
                ['java', ...exports, '-cp', cp, 'MousePacketOracle', dir]
            ]) {
                const r = Bun.spawnSync(cmd);
                expect(r.exitCode, r.stderr.toString()).toBe(0);
            }
            const r = Bun.spawnSync(['java', ...exports, '-Djava.awt.headless=true', '-cp', cp, 'MousePacketOracle'], {
                stdin: Buffer.from(rows.map(v => v.join(' ')).join('\n') + '\n'),
                maxBuffer: 8 * 1024 * 1024
            });
            expect(r.exitCode, r.stderr.toString()).toBe(0);
            expected = r.stdout.toString().trimEnd().split(/\r?\n/);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
        expect(expected.length).toBe(rows.length);

        const app = (Client.activeClient = new Client());
        app.game = freshGame({ outgoing: new SuperPacket(0), account: null, rebuild: null });
        Client.gameState = 30;
        Client.stream = null;
        const camera = Error('next GameLoop instruction');
        const descriptor = (obj: object, key: string) => requireNonNull(Object.getOwnPropertyDescriptor(obj, key));
        const mouseProperty = descriptor(Client, 'mouseTracking'),
            outProperty = descriptor(Client, 'out');
        const cameraProperty = descriptor(OrbitCamera, 'reportDelay');
        Object.defineProperty(OrbitCamera, 'reportDelay', {
            configurable: true,
            get() {
                throw camera;
            }
        });
        try {
            for (const [index, v] of rows.entries()) {
                const [count, xSize, ySize, button, repeats, mode, size, pos, changeRecorder, changePacket, damage] = v;
                const first = new MouseTracking(),
                    second = new MouseTracking();
                first.count = count;
                first.samplesX = samples(xSize, mode, false);
                first.samplesY = samples(ySize, mode, true);
                if (damage === 1) first.lock = null;
                second.count = 3;
                second.samplesX = samples(3, 1, false);
                second.samplesY = samples(3, 1, true);
                const a = packet(size, pos, 19, damage !== 7),
                    b = packet(14, damage === 8 ? -2147483648 : 3, 37, true);
                let recorder: MouseTracking | null = damage === 2 ? null : first,
                    out: SuperPacket | null = a;
                let recorderReads = 0,
                    packetReads = 0;
                Object.defineProperty(Client, 'mouseTracking', {
                    configurable: true,
                    get() {
                        if (++recorderReads === changeRecorder) recorder = damage === 3 ? null : second;
                        return recorder;
                    }
                });
                Object.defineProperty(Client, 'out', {
                    configurable: true,
                    get() {
                        if (recorderReads > 0 && ++packetReads === changePacket) out = damage === 4 ? null : b;
                        return out;
                    }
                });
                Client.mouseTracked = damage !== 5;
                Client.mouseTrackedX = Client.mouseTrackedY = 0;
                Client.mouseRepeatCount = repeats;
                Client.prevMouseClickTime = 199n;
                ClientMouseListener.clickButton = button;
                ClientMouseListener.clickTime = button === 2 ? -9223372036854775808n : 789n;
                ClientMouseListener.clickX = 65544;
                ClientMouseListener.clickY = -14;
                let fault = 'returned';
                try {
                    await app.GameLoop();
                } catch (e) {
                    fault = e === camera ? 'ok' : e instanceof TypeError ? 'null' : e instanceof RangeError ? 'bounds' : String(e);
                }
                const actual = [
                    fault,
                    recorderState(first),
                    recorderState(second),
                    recorder === null ? '-' : recorder === first ? 'a' : 'b',
                    packetState(a, damage !== 7),
                    packetState(b, true),
                    out === null ? '-' : out === a ? 'a' : 'b',
                    Client.mouseTrackedX,
                    Client.mouseTrackedY,
                    Client.mouseRepeatCount,
                    Client.prevMouseClickTime,
                    recorderReads,
                    packetReads
                ];
                expect(actual.join(';'), v.join(' ')).toBe(expected[index]);
            }
        } finally {
            Object.defineProperty(Client, 'mouseTracking', mouseProperty);
            Object.defineProperty(Client, 'out', outProperty);
            Object.defineProperty(OrbitCamera, 'reportDelay', cameraProperty);
        }
    },
    30000
);
