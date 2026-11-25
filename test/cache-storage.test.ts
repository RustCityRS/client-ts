import { requireNonNull } from '#/util/JavaArray.js';
import { gamepackPath } from './reference.js';
import { expect, test } from 'bun:test';
import { fileURLToPath } from 'node:url';

import IntHashTable from '#/cache/IntHashTable.js';
import DirectByteArrayCopier from '#/cache/DirectByteArrayCopier.js';
import ByteArrayCopier from '#/cache/ByteArrayCopier.js';
import { cacheAssets } from './cachefile.js';
import Crc32 from '#/io/Crc32.js';
import ArrayUtils from '#/util/ArrayUtils.js';

function javaByteHash(bytes: Uint8Array): number {
    let result = 1;
    for (const value of bytes) result = (Math.imul(31, result) + ((value << 24) >> 24)) | 0;
    return result;
}

function hashTables(): string[] {
    const rows = [];
    const keys = [[], [-1], [7, 23, -9, 39, 7, -1, -2147483648, 2147483647], Array.from({ length: 101 }, (_, i) => (i % 7 === 0 ? -1 : (i << 10) - 1))];
    for (const input of keys) {
        const table = new IntHashTable(Int32Array.from(input));
        const fields = table['entries'];
        rows.push('[' + Array.from(fields).join(', ') + ']');
        rows.push(
            '[' +
                input
                    .concat([-1, 0, 7, 120])
                    .map(key => table.get(key))
                    .join(', ') +
                ']'
        );
    }
    return rows;
}

function storage(): string[] {
    const rows: string[] = [];
    const previous = ByteArrayCopier.directBufferUnavailable;
    try {
        for (const heapOnly of [false, true]) {
            ByteArrayCopier.directBufferUnavailable = heapOnly;
            for (const size of [0, 1, 136, 137, 257]) {
                for (const copyIn of [false, true]) {
                    for (const copyOut of [false, true]) {
                        const src = Uint8Array.from({ length: size }, (_, i) => 37 * i + 5);
                        const packed = ByteArrayCopier.wrap(src, 136, copyIn);
                        if (size > 0) src[size - 1] ^= 0x55;
                        const first = ByteArrayCopier.unwrap(copyOut, packed);
                        if (size > 0) first[0] ^= 0x80;
                        const second = ByteArrayCopier.unwrap(false, packed);
                        rows.push([packed instanceof Uint8Array, packed === src, first === src, first === second, second === src, javaByteHash(first), javaByteHash(second)].join(' '));
                    }
                }
            }
        }
    } finally {
        ByteArrayCopier.directBufferUnavailable = previous;
    }
    rows.push(String(ByteArrayCopier.wrap(null, 136, true) === null), String(ByteArrayCopier.unwrap(false, null) === null));
    const direct = new DirectByteArrayCopier();
    function record(call: () => unknown): void {
        try {
            const result = call();
            rows.push(result instanceof Uint8Array ? Buffer.from(result).toString('hex') : 'ok');
        } catch {
            rows.push('rejected');
        }
    }
    record(() => direct.get());
    record(() => ByteArrayCopier.unwrap(false, {}));
    for (const bytes of [null, new Uint8Array(), Uint8Array.of(4, 8, 15)]) {
        for (const offset of [-2147483648, -1, 0, 1, 2147483647]) record(() => ArrayUtils.copy(bytes, offset));
    }
    const original = Uint8Array.of(1, 2, 3);
    direct.set(original);
    original.fill(9);
    direct.get()[0] = 12;
    rows.push(Buffer.from(direct.get()).toString('hex'));
    direct.set(Uint8Array.of(255, 254));
    rows.push(Buffer.from(direct.get()).toString('hex'));
    const buffer = requireNonNull(direct['buffer']);
    rows.push([buffer.position, buffer.limit, buffer.bytes.length].join(' '));
    record(() => direct.set(null));
    rows.push(String(direct['buffer'] === buffer));
    buffer.limit = 1;
    buffer.position = 1;
    record(() => direct.get());
    rows.push([buffer.position, buffer.limit, buffer.bytes.length].join(' '));
    return rows;
}

async function archives(): Promise<string[]> {
    const rows: string[] = [];
    for (const archive of [0, 2, 5]) {
        for (const size of [1, 130, 131, 132, 136, 137]) {
            const packed = new Uint8Array(size + 7);
            const packedView = new DataView(packed.buffer);
            packedView.setInt32(1, size);
            for (let i = 0; i < size; i++) packed[5 + i] = i * 13 + 1;
            const ref = Uint8Array.of(0, 0, 0, 0, 18, 5, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0);
            new DataView(ref.buffer).setInt32(11, Crc32.prefix(packed, packed.length - 2));
            const assets = cacheAssets(new Map([[archive, ref]]), async () => packed);
            expect(assets.file(archive, 0)).toBeUndefined();
            for (let i = 0; i < 4; i++) await Promise.resolve();
            const result = requireNonNull(assets.file(archive, 0));
            result[0] ^= 0x80;
            const resident = requireNonNull(assets.archive(archive)['unpacked'])[0]?.[0] != null;
            let second = assets.file(archive, 0);
            if (!second) {
                for (let i = 0; i < 4; i++) await Promise.resolve();
                second = requireNonNull(assets.file(archive, 0));
            }
            rows.push([resident, result === second, javaByteHash(second)].join(' '));
            await assets.stop();
        }
    }
    return rows;
}

function arrayCopies(): string[] {
    const layouts = [
        [0, 0, 0],
        [0, 0, 16],
        [0, 2, 5],
        [0, 3, 17],
        [3, 0, 17],
        [8, 8, 0],
        [2, 3, 0],
        [0, 4, 8],
        [0, 4, 16],
        [0, 31, 4],
        [30, 0, 4],
        [32, 32, 1],
        [-1, 2, 3],
        [4, 0, -1]
    ];
    const rows = [];
    for (const same of [false, true]) {
        for (const [from, to, count] of layouts) {
            const src = Uint8Array.from({ length: 32 }, (_, i) => 5 + 3 * i);
            const dst = same ? src : new Uint8Array(32);
            let error = false;
            try {
                ArrayUtils.copyBytes(src, from, dst, to, count);
            } catch (e) {
                if (!(e instanceof RangeError)) throw e;
                error = true;
            }
            rows.push([error, Buffer.from(dst).toString('hex')].join(' '));
        }
    }
    return rows;
}

test('530 archive name tables, byte ownership and file reads match mf, md and al in the original jar', async () => {
    const source = fileURLToPath(new URL('./cache/CacheStorageOracle.java', import.meta.url));
    const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', gamepackPath, source], { timeout: 20000 });
    expect(java.stderr.toString()).toBe('');
    expect(java.exitCode).toBe(0);
    const expected = java.stdout.toString().trimEnd().split(/\r?\n/);
    expect([...hashTables(), ...storage(), ...(await archives()), ...arrayCopies()]).toEqual(expected);
}, 25000);
