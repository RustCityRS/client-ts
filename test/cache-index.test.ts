import { cachePath, gamepackPath } from './reference.js';
import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import Js5Index from '#/cache/Js5Index.js';
import Js5IndexFixture from './cache/Js5IndexFixture.js';
import Crc32 from '#/io/Crc32.js';
import { readGroup } from './cachefile.js';

function digest(index: Js5Index): string {
    const hash = createHash('sha256'),
        word = Buffer.alloc(4);
    const put = (n: number) => {
        word.writeInt32BE(n);
        hash.update(word);
    };
    const ints = (row: Int32Array | null) => {
        if (!row) {
            put(-1);
            return;
        }
        put(row.length);
        const bytes = Buffer.alloc(row.length * 4);
        for (let i = 0; i < row.length; i++) bytes.writeInt32BE(row[i], i * 4);
        hash.update(bytes);
    };
    for (const n of [index.m_indexCRC, index.m_indexVersion, index.m_groupCount, index.capacity]) put(n);
    for (const data of [index.groupIds, index.fileCounts, index.fileCapacities, index.groupCrcs, index.groupVersions, index.groupNameHashes]) ints(data);
    for (const matrix of [index.sparseFileIds, index.fileNameHashes]) {
        put(matrix?.length ?? -1);
        for (const row of matrix ?? []) ints(row);
    }
    ints(index.groupNames?.['entries'] ?? null);
    put(index.fileNames?.length ?? -1);
    for (const table of index.fileNames ?? []) ints(table?.['entries'] ?? null);
    return hash.digest('hex');
}

function lookups(index: Js5IndexFixture): string {
    const values = [];
    for (const n of [0xc0, 0xe0, 0xd7, 0xf7, 0xdf, 0xde, 0xfe, 0xff, 0x61]) {
        const name = String.fromCharCode(n);
        values.push(index.getGroupId(name), index.getFileId(1, name), index.getFileId(4, name));
    }
    return '[' + values.join(', ') + ']';
}

function reference(protocol: number, named: number): Uint8Array {
    const payload: number[] = [protocol];
    const short = (n: number) => payload.push(n >>> 8, n & 255);
    const int = (n: number) => payload.push(n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255);
    if (protocol === 6) int(-1000000000);
    payload.push(named);
    const groups = [1, 4, 5, 9, 11],
        ids = [[0, 1], [2, 4], [0], [], [1]];
    short(groups.length);
    for (let i = 0; i < groups.length; i++) short(groups[i] - (groups[i - 1] ?? 0));
    if (named) for (const n of [0xe0, 0xd7, 0xdf, 0xfe, 0xff]) int(n);
    for (const n of [-1, 0, -2147483648, 2147483647, 17]) int(n);
    for (const n of [0, 9, -1, -65536, 100000]) int(n);
    for (const files of ids) short(files.length);
    for (const files of ids) for (let i = 0; i < files.length; i++) short(files[i] - (files[i - 1] ?? 0));
    if (named) for (const n of [0xe0, 0xdf, 0xd7, 0xfe, 0xff, 0xf7]) int(n);
    const bytes = new Uint8Array(5 + payload.length);
    new DataView(bytes.buffer).setInt32(1, payload.length);
    bytes.set(payload, 5);
    return bytes;
}

test('every reference table field and name probing table matches db in the SD gamepack', () => {
    const cases: { label: string; src: Uint8Array; crc: number; names: boolean }[] = [];
    const add = (label: string, src: Uint8Array, names = false, crc = Crc32.prefix(src, src.length)) => cases.push({ label, src, crc, names });
    for (let archive = 0; archive < 28; archive++) add('cache 254 archive ' + archive, readGroup(cachePath, 255, archive));
    for (const protocol of [5, 6]) for (const flag of [0, 1, 255]) add('protocol ' + protocol + ' name flag ' + flag, reference(protocol, flag), flag !== 0);
    const named = reference(6, 1);
    add('empty groups', Uint8Array.of(0, 0, 0, 0, 4, 5, 1, 0, 0));
    add('wrong CRC', named, false, Crc32.prefix(named, named.length) ^ 1);
    add('invalid protocol', reference(7, 0));
    add('truncated container', named.subarray(0, -2));
    const truncated = named.slice(0, 8);
    new DataView(truncated.buffer).setInt32(1, truncated.length - 5);
    add('truncated reference payload', truncated);
    const source = fileURLToPath(new URL('./cache/IndexOracle.java', import.meta.url));
    const input = cases.map(c => [c.names ? 'names' : 'index', c.crc, Buffer.from(c.src).toString('base64')].join(' ')).join('\n');
    const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', gamepackPath, source], { stdin: Buffer.from(input), timeout: 20000 });
    expect(java.stderr.toString()).toBe('');
    expect(java.exitCode).toBe(0);
    const lines = java.stdout.toString().trimEnd().split(/\r?\n/);
    expect(lines).toHaveLength(cases.length);
    cases.forEach(({ label, src, crc, names }, i) => {
        let result;
        try {
            const index = new Js5Index(src, crc);
            result = digest(index) + (names ? ' ' + lookups(new Js5IndexFixture(src, crc)) : '');
        } catch {
            result = 'rejected';
        }
        expect(result, label).toBe(lines[i]);
    });
}, 25000);

test('db installs each reference-table array before reading its contents, including partial and repeated decodes', () => {
    const initial = reference(6, 255);
    const crc = Crc32.prefix(initial, initial.length);
    const rows: { bytes: Uint8Array; minimum: number }[] = [];
    for (const protocol of [5, 6])
        for (const flag of [0, 1]) {
            const next = reference(protocol, flag);
            for (let length = 5; length <= next.length; length++) {
                const bytes = next.slice(0, length);
                new DataView(bytes.buffer).setInt32(1, length - 5);
                rows.push({ bytes, minimum: -1 });
            }
            rows.push({ bytes: next, minimum: 16 }, { bytes: next, minimum: 2147483647 });
        }
    const source = fileURLToPath(new URL('./cache/IndexOracle.java', import.meta.url));
    const header = 'redecode ' + crc + ' ' + Buffer.from(initial).toString('base64') + ' ';
    const input = rows.map(row => header + Buffer.from(row.bytes).toString('base64') + ' ' + row.minimum).join('\n');
    const oracle = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', gamepackPath, source], { stdin: Buffer.from(input), timeout: 20000 });
    expect(oracle.exitCode, oracle.stderr.toString()).toBe(0);
    const expected = oracle.stdout.toString().trimEnd().split(/\r?\n/);
    expect(expected).toHaveLength(rows.length);
    const keys = ['groupIds', 'fileCounts', 'fileCapacities', 'sparseFileIds', 'groupCrcs', 'groupVersions', 'groupNameHashes', 'groupNames', 'fileNameHashes', 'fileNames'] as const;
    for (let i = 0; i < rows.length; i++) {
        const index = new Js5Index(initial, crc);
        const old = keys.map(key => index[key]);
        const { bytes, minimum } = rows[i];
        let result = 'ok';
        try {
            index['LoadIndex'](bytes, minimum);
        } catch (error) {
            if (!(error instanceof Error)) throw error;
            result = 'rejected';
        }
        const changed = keys.map((key, slot) => (index[key] === old[slot] ? '0' : '1')).join('');
        expect([result, changed, digest(index)].join(' '), 'row ' + i).toBe(expected[i]);
    }
}, 25000);
