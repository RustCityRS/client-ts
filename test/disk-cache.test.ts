import { glJar } from '#/client/ClientVariant.js';
import { gamepackPath, cachePath } from './reference.js';
import { requireNonNull } from '../src/util/JavaArray.js';
import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { closeSync, fstatSync, mkdirSync, mkdtempSync, openSync, readSync, rmdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import DataFile, { sectorDiskStore } from '../src/cache/DataFile.js';
import BufferedRandomAccessFile from '../src/io/BufferedRandomAccessFile.js';
import File, { EndOfFile, FileIoError } from '../src/io/File.js';
import SyncAccessFile from '../src/io/SyncAccessFile.js';
import PacketT from '../src/io/PacketT.js';
import Client from '#/client/Client.js';
import { readGroup } from './cachefile.js';

const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const data = (length: number, seed: number) => Uint8Array.from({ length }, (_, i) => (i * 37 + seed) & 255);

class MemoryHandle {
    bytes = new Uint8Array(0);
    getSize(): number {
        return this.bytes.length;
    }
    close(): void {}
    read(dst: Uint8Array, { at }: { at: number }): number {
        const part = this.bytes.subarray(at, at + dst.length);
        dst.set(part);
        return part.length;
    }
    write(src: Uint8Array, { at }: { at: number }): number {
        if (at + src.length > this.bytes.length) {
            const extended = new Uint8Array(at + src.length);
            extended.set(this.bytes);
            this.bytes = extended;
        }
        this.bytes.set(src, at);
        return src.length;
    }
}

function makeFile(name: string, r: number, w: number, limit: bigint) {
    const memory = new MemoryHandle();
    const file = File.open(new SyncAccessFile(memory), name, limit);
    const buf = new BufferedRandomAccessFile(file, r, w);
    const state = () =>
        [
            buf['filePosition'],
            buf['fileLength'],
            buf['readPosition'],
            buf['logicalLength'],
            buf['writePosition'],
            buf['writeLength'],
            buf['readLength'],
            buf['position'],
            hash(buf['readBuffer']),
            hash(buf['writeBuffer']),
            file['position'],
            hash(memory.bytes)
        ].join(',');
    return { buf, state };
}

type Command = [op: number, a: number, b: number, bytes: Uint8Array];
function trace(): Command[] {
    const commands: Command[] = [];
    function cmd(op: number, a = 0, b = 0, bytes: Uint8Array = new Uint8Array(0)): void {
        commands.push([op, a, b, bytes]);
    }
    cmd(20, -1);
    cmd(0, 3);
    cmd(1, 3, 0);
    for (const size of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 519, 520, 521]) {
        cmd(20, size);
        cmd(1, 3, 10, data(10, 8));
        cmd(0, 3);
    }
    cmd(20, 520);
    cmd(0, 3);
    cmd(1, 3, 0);
    cmd(0, 3);
    for (const [id, length] of [
        [1, 512],
        [2, 1100],
        [1, 901],
        [2, 17],
        [2, 0],
        [4, 513]
    ]) {
        cmd(1, id, length, data(length + 5, id + length));
        for (const mask of [0, 255, 65280, -1]) cmd(21, id, mask);
        cmd(0, 1);
        cmd(0, 2);
        cmd(0, 3);
    }
    cmd(1, 4, -1);
    cmd(1, 4, 2801);
    cmd(1, -1, 6, data(6, 1));
    cmd(1, 5, 40, data(17, 5));
    cmd(0, 5);
    cmd(0, -1);
    cmd(0, 65536);
    cmd(12, 6);
    cmd(14, 0, 6, Uint8Array.of(0, 2, 0, 0, 0, 240));
    cmd(0, 1);
    cmd(1, 1, 521, data(521, 71));
    cmd(0, 1);
    cmd(0, 4);
    cmd(5);
    cmd(15);
    cmd(2, 2);
    cmd(3, 1, 13, data(18, 9));
    cmd(2, 6);
    cmd(4, 1, 5, data(11, 10));
    cmd(2, 7);
    cmd(3, 0, 2, data(10, 11));
    cmd(2, 4);
    cmd(3, 2, 12, data(16, 12));
    cmd(2, 12);
    cmd(4, 0, 21, data(21, 13));
    cmd(2, 6000);
    cmd(4, 0, 7, data(7, 29));
    cmd(2, 5992);
    cmd(3, 2, 20, data(25, 64));
    cmd(5);
    cmd(2, -1);
    cmd(3, 2, 4, data(3, 15));
    cmd(2, 8);
    cmd(3, -1, 2, data(8, 12));
    cmd(4, 0, 23, data(7, 5));
    let random = 1983;
    const roll = (max: number) => ((random = (Math.imul(random, 1664525) + 1013904223) >>> 0) >>> 8) % max;
    for (let i = 0; i < 80; i++) {
        const channel = roll(2) * 10;
        cmd(channel + 2, roll(4) * 40 + roll(17));
        const count = roll(31),
            offset = roll(4);
        cmd(channel + 3 + roll(2), offset, count, data(count + offset + roll(4), roll(256)));
        if (roll(5) === 0) cmd(channel + 5);
    }
    cmd(2, 8191);
    cmd(4, 0, 3, data(3, 59));
    cmd(5);
    cmd(7);
    for (const present of [0, 1]) {
        cmd(8, 3, present, data(30, 31));
        cmd(9, 3, present, data(30, 31));
    }
    cmd(18, 3, 1, data(30, 0));
    cmd(19, 5, 1, new Uint8Array(29));
    cmd(18, 3, 1, data(30, 0));
    cmd(19, 5, 1, data(29, 62));
    cmd(18, 3, 1, data(30, 0));
    cmd(19, 15, 1, data(23, 40));
    cmd(18, 3, 1, data(30, 0));
    cmd(12, 0);
    cmd(16, 0, 0, data(9, 40));
    cmd(17);
    cmd(17);
    return commands;
}

function words(...numbers: number[]): Buffer {
    const b = Buffer.alloc(numbers.length * 4);
    numbers.forEach((v, i) => b.writeInt32BE(v, i * 4));
    return b;
}

for (const [dr, dw, ir, iw] of [
    [17, 14, 8, 11],
    [5200, 0, 6000, 0]
]) {
    test.skipIf(!process.env.GAMEPACK_530)(`disk sectors and file cursors match cg, sa and ne with ${dr}/${dw}/${ir}/${iw} buffers`, () => {
        const commands = trace();
        const encoded = [words(dr, dw, ir, iw, commands.length)];
        for (const [op, a, b, bytes] of commands) encoded.push(words(op, a, b, bytes.length), Buffer.from(bytes));
        const oracle = fileURLToPath(new URL('./game/DiskCacheOracle.java', import.meta.url));
        mkdirSync(resolve('out'), { recursive: true });
        const dir = mkdtempSync(join(resolve('out'), 'disk530-'));
        let expected: string[];
        try {
            const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', gamepackPath, oracle, dir], {
                stdin: Buffer.concat(encoded),
                timeout: 20000,
                maxBuffer: 8 * 1024 * 1024
            });
            expect(java.stderr.toString()).toBe('');
            expect(java.exitCode).toBe(0);
            expected = java.stdout.toString().trim().split(/\r?\n/);
        } finally {
            rmdirSync(dir);
        }
        const dat = makeFile('dat', dr, dw, 8192n),
            idx = makeFile('idx', ir, iw, 4096n);
        const cg = new DataFile(7, dat.buf, idx.buf, 2800);
        expect(cg.toString()).toBe(expected[0]);
        expect(expected).toHaveLength(commands.length + 1);
        const shared = DataFile.sectorBuffer,
            uidFile = Client.uidFile;
        DataFile.sectorBuffer = new Uint8Array(520);
        try {
            commands.forEach(([op, a, b, bytes], step) => {
                const buf = op >= 10 ? idx.buf : dat.buf;
                let result = 'ok';
                try {
                    if (op === 20) DataFile.sectorBuffer = a < 0 ? null : new Uint8Array(a).fill(125);
                    else if (op === 21) {
                        const group = cg.read(b, a);
                        result = group === null ? 'null' : hash(group);
                    } else
                        switch (op % 10) {
                            case 0: {
                                const group = cg.read(0xff00, a);
                                result = group === null ? 'null' : hash(group);
                                break;
                            }
                            case 1:
                                result = String(cg.write(b, a, bytes));
                                break;
                            case 2:
                                buf.seek(BigInt(a));
                                break;
                            case 3:
                                buf.Read(b, bytes, a);
                                break;
                            case 4:
                                buf.Write(a, bytes, b);
                                break;
                            case 5:
                                buf['FlushToDisk']();
                                break;
                            case 6:
                                buf.readFully(bytes);
                                break;
                            case 7:
                                buf.Close();
                                break;
                            case 8:
                            case 9: {
                                const packet = new PacketT(bytes);
                                packet.m_pos = a;
                                Client.uidFile = b === 0 ? null : buf;
                                if (op % 10 === 8) Client.writeUid(packet);
                                else Client.updateUid(24, packet);
                                result = String(packet.m_pos);
                                break;
                            }
                        }
                } catch (e) {
                    result = e instanceof EndOfFile ? 'eof' : e instanceof FileIoError ? 'io' : 'runtime';
                }
                expect([result, hash(bytes), dat.state(), idx.state(), DataFile.sectorBuffer === null ? '-' : hash(DataFile.sectorBuffer)].join(';'), `step ${step}, op=${op} a=${a} b=${b}`).toBe(expected[step + 1]);
            });
        } finally {
            DataFile.sectorBuffer = shared;
            Client.uidFile = uidFile;
        }
    });
}

test.skipIf(!process.env.CACHE_530)('sector disk store reads the distributed cache with the client buffer sizes', async () => {
    const dir = cachePath;
    function open(name: string, read: number): BufferedRandomAccessFile {
        const file = openSync(join(dir, name), 'r');
        return new BufferedRandomAccessFile(
            File.open(
                new SyncAccessFile({
                    getSize: () => fstatSync(file).size,
                    read: (dst, { at }) => readSync(file, dst, 0, dst.length, at),
                    write: () => {
                        throw new Error('Read-only reference');
                    },
                    close: () => closeSync(file)
                }),
                name,
                0n
            ),
            read,
            0
        );
    }
    const dat = open('main_file_cache.dat2', 5200);
    try {
        for (const [archive, groups] of [
            [255, [0, 3, 7, 12, 27]],
            [12, [1172]],
            [3, [744]]
        ] as const) {
            const idx = open('main_file_cache.idx' + archive, 6000);
            try {
                const disk = sectorDiskStore(new DataFile(archive, dat, idx, archive === 255 ? 500000 : 1000000));
                for (const id of groups) {
                    const bytes = await disk.read(id);
                    expect(bytes).not.toBeNull();
                    expect(hash(requireNonNull(bytes))).toBe(hash(readGroup(dir, archive, id)));
                }
            } finally {
                idx.Close();
            }
        }
    } finally {
        dat.Close();
    }
});

test('sector scratch retains the original gamepack bytes after each short header write', () => {
    // Each hex value was checked against the SHA-256 of le.h (SD) or wc.i (HD) after the native write.
    const result = glJar ? ['', '00', '007d', '007d7d', '007d7d7d', '007d7d7d00'] : ['', '7d', '7d7d', '7d7d7d', '7d7d7d7d', '7d007d7d00'];
    result.push('00000a000001', '00000a0000017d', '0003000000000007', '00030000000000077d');
    const store = new DataFile(7, makeFile('dat', 5200, 0, 8192n).buf, makeFile('idx', 6000, 0, 4096n).buf, 2800);
    const previous = DataFile.sectorBuffer;
    try {
        for (let size = 0; size < result.length; size++) {
            const scratch = (DataFile.sectorBuffer = new Uint8Array(size).fill(125));
            const write = () =>
                store.write(
                    10,
                    3,
                    Uint8Array.from({ length: 10 }, (_, i) => i)
                );
            if (size < 8) expect(write).toThrow(RangeError);
            else expect(write()).toBe(true);
            expect(Buffer.from(scratch).toString('hex')).toBe(result[size]);
        }
    } finally {
        DataFile.sectorBuffer = previous;
    }
    if (!glJar) {
        const hd = Bun.spawnSync([process.execPath, 'test', '--test-name-pattern', 'sector scratch retains', fileURLToPath(import.meta.url)], { env: { ...process.env, RS530_GAMEPACK_IDENTITY: 'gl' } });
        expect(hd.exitCode, hd.stderr.toString()).toBe(0);
        expect(hd.stderr.toString()).toMatch(/^\s*1 pass$/m);
    }
});
