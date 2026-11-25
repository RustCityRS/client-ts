import { requireNonNull } from '#/util/JavaArray.js';
import { expect, test } from 'bun:test';
import { gzipSync } from 'fflate';

import Crc32 from '#/io/Crc32.js';
import Js5Compression from '#/cache/Js5Compression.js';
import { unpackGroup } from './cache/unpackGroup.js';
import Js5Index from './cache/Js5IndexFixture.js';

function i32(value: number): number[] {
    return [value >>> 24, (value >>> 16) & 255, (value >>> 8) & 255, value & 255];
}

function raw(bytes: number[]): Uint8Array {
    return Uint8Array.of(0, ...i32(bytes.length), ...bytes);
}

const named = raw([6, ...i32(42), 1, 0, 2, 0, 3, 0, 5, ...i32(97), ...i32(98), ...i32(-99), ...i32(12), ...i32(3), ...i32(4), 0, 2, 0, 1, 0, 2, 0, 2, 0, 0, ...i32(120), ...i32(121), ...i32(0)]);

test('protocol 5 and 6 reference tables, sparse file IDs and stripe deltas', () => {
    const empty = raw([5, 0, 0, 0]);
    expect(new Js5Index(empty, Crc32.compute(0, empty, empty.length)).m_indexVersion).toBe(0);
    expect(() => new Js5Index(named, 0)).toThrow();
    const index = new Js5Index(named, Crc32.compute(0, named, named.length));
    expect(index.m_indexVersion).toBe(42);
    expect(Array.from(requireNonNull(index.groupIds))).toEqual([3, 8]);
    expect(requireNonNull(index.groupVersions)[8]).toBe(4);
    expect(requireNonNull(index.groupCrcs)[3]).toBe(-99);
    expect(index.getGroupId('A')).toBe(3);
    expect(index.getFileId(3, 'Y')).toBe(4);
    expect(index.getGroupId('unknown')).toBe(-1);
    const group = raw([1, 2, 3, 4, 5, 6, 7, ...i32(2), ...i32(-1), ...i32(1), ...i32(2), 2]);
    const files = unpackGroup(index, 3, group);
    expect(files[2]).toEqual(Uint8Array.of(1, 2, 4));
    expect(files[4]).toEqual(Uint8Array.of(3, 5, 6, 7));
    expect(files[1]).toBeUndefined();
});

test('group decryption begins at offset 5 and retains partial final blocks', () => {
    const index = new Js5Index(named, Crc32.compute(0, named, named.length));
    const container = Uint8Array.of(0, 0, 0, 0, 9, 0x3f, 0x46, 0x0d, 0x29, 0x04, 0x10, 0x36, 0x46, 9, 0, 4);
    const key = Int32Array.of(0x12345678, 0x87654321, 0x7fffffff, -1);
    const before = container.slice();
    expect(unpackGroup(index, 8, container, key)[0]).toEqual(Uint8Array.of(1, 2, 3, 4, 5, 6, 7, 8, 9));
    expect(container).toEqual(before);
});

test('headerless BZip2 and the fixed 10-byte GZIP header with a cache version trailer', () => {
    const repeated = new Uint8Array(1024).fill(255);
    const bz = Buffer.from('MUFZJlNZL/9cHQAADEAAwAAACKAAIKptQZiOReLuSKcKEgX/64Og', 'base64');
    expect(Js5Compression.Decompress(Uint8Array.of(1, ...i32(bz.length), ...i32(1024), ...bz, 0, 7))).toEqual(repeated);
    const gz = gzipSync(repeated);
    expect(Js5Compression.Decompress(Uint8Array.of(2, ...i32(gz.length), ...i32(1024), ...gz, 0, 7))).toEqual(repeated);
});
