import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Js5 from '#/cache/Js5.js';
import Js5Index from '#/cache/Js5Index.js';
import ByteArrayCopier, { type StoredBytes } from '#/cache/ByteArrayCopier.js';
import Js5Compression from '#/cache/Js5Compression.js';
import ArrayUtils from '#/util/ArrayUtils.js';
import Crc32 from '#/io/Crc32.js';
import PacketT from '#/io/PacketT.js';
import WrappedException from '#/util/WrappedException.js';
import { gamepackPath } from './reference.js';

function hash(bytes: Uint8Array): number {
    let result = 1;
    for (const value of bytes) result = (Math.imul(result, 31) + ((value << 24) >> 24)) | 0;
    return result;
}
function container(payload: number[]): Uint8Array {
    const bytes = new Uint8Array(5 + payload.length);
    new DataView(bytes.buffer).setInt32(1, payload.length);
    bytes.set(payload, 5);
    return bytes;
}
function stripes(payload: number[], deltas: number[][]): Uint8Array {
    const data = payload.slice();
    for (const stripe of deltas) for (const n of stripe) data.push(n >>> 24, n >>> 16, n >>> 8, n);
    return container([...data, deltas.length]);
}

type Vector = {
    count: number;
    capacity: number;
    row: number;
    flags: number;
    fault: number;
    ids: number[] | null;
    key: number[] | null;
    data: Uint8Array;
};
function vectors(): Vector[] {
    const cases: Vector[] = [];
    const valid = stripes(
        [11, 12, 13, 14, 15, 16, 17],
        [
            [1, 2],
            [2, -1]
        ]
    );
    const push = (change: Partial<Vector>) => cases.push({ count: 2, capacity: 4, row: -1, flags: 0, fault: 0, ids: [1, 3], key: null, data: valid, ...change });
    for (let flags = 0; flags < 16; flags++)
        for (const row of [-1, 0, 2, 8, 10, 15]) {
            for (const ids of [null, [], [1], [1, 3], [1, 1], [1, -1], [1, 4]]) push({ flags, row, ids });
            for (const fault of [1, 2, 3, 4, 5, 6]) {
                for (const count of [-1, 0, 1, 2]) push({ count, row, flags, fault });
            }
        }
    for (const flags of [0, 1, 2, 3, 4, 7])
        for (const row of [-1, 0, 2, 15]) {
            for (const key of [null, [], [0], [0, 0, 0], [1], [1, 2, 3, 4], [0, 0, 0, 0]]) {
                for (const data of [container([1, 2, 3]), container(Array.from({ length: 24 }, (_, i) => i)), Uint8Array.of(1, 0, 0, 0)]) push({ count: 1, capacity: 2, ids: [1], flags, row, key, data });
            }
            for (const data of [
                container([]),
                container([0]),
                stripes([], [[-2, 3]]),
                stripes([1], [[1, 20]]),
                stripes(
                    [1, 2],
                    [
                        [3, 2],
                        [-2, 5]
                    ]
                ),
                stripes(
                    [],
                    [
                        [2147483647, -2147483647],
                        [1, 0]
                    ]
                ),
                container([0, 0, 7]),
                stripes(
                    [],
                    Array.from({ length: 255 }, () => [0, 0])
                ),
                stripes(Array(280).fill(136), [[137, 6]])
            ])
                push({ flags, row, data });
            for (const capacity of [-1, 0, 1, 2, 4]) push({ flags, row, capacity });
        }
    // XTEA([1,2,3,4]) of the two-stripe payload in "valid", starting at byte 5.
    const encrypted = container([83, 216, 189, 49, 64, 73, 120, 187, 245, 146, 44, 133, 238, 220, 209, 85, 197, 186, 252, 99, 176, 110, 144, 124]);
    for (let flags = 0; flags < 8; flags++) {
        push({ flags, data: encrypted, key: [1, 2, 3, 4] });
        for (const ids of [[], [1], [-1]])
            for (const fault of [1, 2]) {
                push({ flags, ids, fault, row: -1 });
                push({ flags, ids, fault, row: 0 });
            }
        push({
            flags,
            ids: [1, 0, 3],
            count: 3,
            data: stripes(
                [27, 28, 29, 30, 31, 32],
                [
                    [1, -1, 2],
                    [0, 2, -1]
                ]
            )
        });
    }
    return cases;
}

const emptyIndex = Uint8Array.of(0, 0, 0, 0, 4, 5, 0, 0, 0);
type Rows = ((StoredBytes | null)[] | null)[];

test('al unpacking matches JAR row aliasing, keys, chunk cursors, partial copies and file installation', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rs530-js5-unpack-'));
    const strict = Js5.strictValidation,
        buffersUnavailable = ByteArrayCopier.directBufferUnavailable;
    const decompress = Js5Compression.Decompress,
        word = PacketT.prototype.g4,
        copy = ArrayUtils.copyBytes;
    try {
        const access = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED'];
        const cp = dir + delimiter + gamepackPath;
        for (const cmd of [
            ['javac', ...access, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'cache/UnpackGroupOracle.java')],
            ['java', ...access, '-cp', cp, 'UnpackGroupOracle', dir]
        ]) {
            const result = Bun.spawnSync(cmd);
            expect(result.exitCode, result.stderr.toString()).toBe(0);
        }
        const cases = vectors();
        const integers = (a: number[] | null) => (a === null ? '-' : a.join(',') || 'e');
        const lines = cases.map(v => [v.count, v.capacity, v.row, v.flags, v.fault, integers(v.ids), integers(v.key), Buffer.from(v.data).toString('base64') || 'e'].join(' '));
        const java = Bun.spawnSync(['java', '-Xmx192m', ...access, '-cp', cp, 'UnpackGroupOracle'], {
            stdin: Buffer.from(lines.join('\n') + '\n'),
            maxBuffer: 4 * 1024 * 1024
        });
        expect(java.exitCode, java.stderr.toString()).toBe(0);
        const expected = java.stdout.toString().trimEnd().split(/\r?\n/);
        expect(expected.length).toBe(cases.length);

        let unpacked: Uint8Array | null = null;
        let words = 0,
            cursorHash = 1,
            copies = 0,
            copyHash = 1;
        Js5Compression.Decompress = data => (unpacked = decompress(data));
        PacketT.prototype.g4 = function () {
            if (this.m_data !== unpacked || unpacked === null) return word.call(this);
            words++;
            cursorHash = (Math.imul(31, cursorHash) + this.m_pos) | 0;
            try {
                return word.call(this);
            } finally {
                cursorHash = (Math.imul(31, cursorHash) + this.m_pos) | 0;
            }
        };
        ArrayUtils.copyBytes = (src, at, dest, off, len) => {
            if (src !== unpacked || unpacked === null || dest === null) return copy(src, at, dest, off, len);
            copies++;
            for (const n of [at, off, len, dest.length]) copyHash = (Math.imul(31, copyHash) + n) | 0;
            try {
                copy(src, at, dest, off, len);
            } finally {
                copyHash = (Math.imul(31, copyHash) + hash(dest)) | 0;
            }
        };
        Js5.strictValidation = false;
        ByteArrayCopier.directBufferUnavailable = false;
        for (const [i, v] of cases.entries()) {
            const index = new Js5Index(emptyIndex, Crc32.prefix(emptyIndex, emptyIndex.length));
            const ids = v.ids === null ? null : Int32Array.from(v.ids);
            index.capacity = 1;
            index.fileCounts = Int32Array.of(v.count);
            index.fileCapacities = Int32Array.of(v.capacity);
            index.sparseFileIds = [ids];
            index.groupCrcs = Int32Array.of(75);
            const oldRows: Rows = [v.row < 0 ? null : Array.from({ length: Math.max(0, v.capacity) }, (_, k) => (v.row & (1 << k) ? Uint8Array.of(95 + k) : null))];
            const newRows: Rows = [null];
            let rows = oldRows;
            const archive = new Js5(null, (v.flags & 1) !== 0, (v.flags & 2) !== 0);
            class Copier extends ByteArrayCopier {
                set() {}
                get() {
                    if (v.fault === 3) rows = newRows;
                    if (v.fault === 4) archive['packed'] = newPacked;
                    if (v.fault === 5) index.sparseFileIds = [new Int32Array(0)];
                    if (v.fault === 6 && ids !== null && ids.length > 0) ids[ids.length - 1] = 40;
                    return v.data.slice();
                }
            }
            const oldPacked = [v.flags & 8 ? null : v.flags & 4 ? new Copier() : v.data];
            const newPacked = [Uint8Array.of(4)];
            archive['index'] = index;
            archive['packed'] = oldPacked;
            let reads = 0;
            Object.defineProperty(archive, 'unpacked', {
                get() {
                    const captured = rows;
                    reads++;
                    if ((reads === 1 && v.fault === 1) || (reads === 2 && v.fault === 2)) rows = newRows;
                    return captured;
                }
            });
            words = 0;
            cursorHash = 1;
            copies = 0;
            copyHash = 1;
            unpacked = null;
            let result: string;
            try {
                result = String(archive['UnpackGroupData'](v.key === null ? null : Int32Array.from(v.key), 0));
            } catch (error) {
                const cause = error instanceof WrappedException ? error.cause : error;
                if (cause instanceof TypeError) result = 'null';
                else if (cause instanceof RangeError) result = /index /.test(cause.message) ? 'bounds' : 'negative';
                else if (cause instanceof Error) result = 'runtime';
                else throw error;
                if (error instanceof WrappedException) result += error.context?.split('T3 - ')[1] ?? '';
            }
            function slot(value: unknown): string {
                if (value === null) return '-';
                if (value instanceof Copier) return 'p';
                if (value instanceof Uint8Array) return 'h' + hash(value);
                if (value instanceof ByteArrayCopier) return 'd' + hash(value.get());
                return '[' + (value as unknown[]).map(slot).join(', ') + ']';
            }
            expect([result, slot(oldRows), slot(newRows), slot(oldPacked), slot(newPacked), [reads, words, cursorHash, copies, copyHash].join(':')].join('/'), lines[i].slice(0, 110)).toBe(expected[i]);
        }
    } finally {
        Js5Compression.Decompress = decompress;
        PacketT.prototype.g4 = word;
        ArrayUtils.copyBytes = copy;
        Js5.strictValidation = strict;
        ByteArrayCopier.directBufferUnavailable = buffersUnavailable;
        rmSync(dir, { recursive: true, force: true });
    }
}, 30000);
