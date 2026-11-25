import { glJar } from '#/client/ClientVariant.js';
import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { tmpdir } from 'node:os';
import Js5Index from '#/cache/Js5Index.js';
import Js5RemoteLoader from '#/cache/Js5RemoteLoader.js';
import Js5LocalCache from '#/cache/Js5LocalCache.js';
import Js5DiskRequest from '#/cache/Js5DiskRequest.js';
import Js5NetQueue from '#/io/Js5NetQueue.js';
import Js5NetQueueRequest from '#/io/Js5NetQueueRequest.js';
import Crc32 from '#/io/Crc32.js';
import PacketT from '#/io/PacketT.js';
import Linkable from '#/datastruct/Linkable.js';
import type HashTable from '#/datastruct/HashTable.js';
import SharedPtrList from '#/datastruct/SharedPtrList.js';
import JavaCrc32 from '#/util/JavaCrc32.js';
import { JavaError } from '#/util/ClientError.js';
import { mathRandom } from '#/util/JavaRandom.js';
import { gamepackPath } from './reference.js';

const indexBytes = Uint8Array.of(0, 0, 0, 0, 4, 5, 0, 0, 0);
function index(version: number, crc: number, count: number): Js5Index {
    const record = new Js5Index(indexBytes, Crc32.prefix(indexBytes, indexBytes.length));
    record.capacity = 3;
    record.fileCounts = new Int32Array(count);
    record.groupVersions = new Int32Array(count).fill(version);
    record.groupCrcs = new Int32Array(count).fill(crc);
    return record;
}

function run(op: number, change: number, action: number, flags: number): string {
    const net = new Js5NetQueue();
    net.errors = 4;
    net.response = 7;
    const store: Js5LocalCache = Object.create(Js5LocalCache.prototype);
    const provider = new Js5RemoteLoader(17, null, null, net, store, 0, 0, op >= 7);
    const bytes = Uint8Array.of(8, 16, 32, 0x12, 0x34),
        crc = Crc32.prefix(bytes, 3);
    const first = index(0x1234, crc + (flags >> 2), 3),
        second = index(0xabcd, crc, 2),
        shortIndex = index(0xfedc, crc, 0);
    let reads = 0;
    let reference: Js5Index | null = first;
    const stop = new JavaError('stop');
    Object.defineProperty(provider, 'reference', {
        get() {
            const captured = reference;
            if (++reads === change) {
                if (action === 0) reference = second;
                if (action === 1) reference = null;
                if (action === 2) reference = shortIndex;
                if (action === 3) throw stop;
                if (action === 4) provider['scanGroup'] = -1;
                if (action === 5) provider['scanGroup'] = 2147483647;
            }
            return captured;
        }
    });
    provider['status'] = Int8Array.of(1, op === 3 ? 1 : 0, 1);
    const table: HashTable = provider['requests'];
    const wrong = new (class extends Linkable {
        getData() {
            return bytes;
        }
    })();
    const disk = new Js5DiskRequest();
    disk.data = bytes;
    disk.incomplete = false;
    disk.urgent = (flags & 1) !== 0;
    const network = new Js5NetQueueRequest();
    network.m_footerLength = 2;
    network.packet = new PacketT(bytes);
    network.packet.m_pos = 3;
    network.incomplete = false;
    network.urgent = (flags & 1) !== 0;
    const request = op === 0 ? disk : op === 1 ? network : wrong;
    if (op <= 2) table.put(request, 1n);
    if (op >= 3 && op <= 6) {
        provider['scan'] = new SharedPtrList();
        provider['verifying'] = op === 4 || op === 6;
        provider['prefetching'] = op === 5;
        if (op === 3) {
            const hint = new Linkable();
            hint.key = 1n;
            provider['prefetch'].push_back(hint);
        }
        if (op === 6) provider['scanGroup'] = -1;
    }
    if (op >= 7) {
        if (op === 8) table.put(disk, 0n);
        table.put(wrong, 1n);
    }
    if (flags & 2) for (let i = 0; i < 20; i++) net.RequestData(0, i, 4, true);
    let result = 'ok';
    try {
        if (op <= 2) result = provider.group(0, 1) === null ? 'none' : 'bytes';
        else if (op === 3) provider.processPrefetch();
        else provider.processQueue();
    } catch (error) {
        if (error === stop) result = 'stop';
        else if (error instanceof TypeError) result = error.message === 'Expected Js5Request' ? 'cast' : 'null';
        else if (error instanceof RangeError) result = 'bounds';
        else throw error;
    }
    const retained = table.get(1n);
    return [
        result,
        reads,
        [bytes[3], bytes[4]].join(','),
        [net.errors, net.response, net.GetUrgentQueueSize()].join(','),
        '[' + Array.from(provider['status']).join(', ') + ']',
        [provider['verified'], provider['scanGroup'], provider['verifying'], provider['prefetching']].join(','),
        retained === null ? 'empty' : retained === wrong ? 'wrong' : retained === request ? 'same' : 'new',
        disk.orphan
    ].join('/');
}

test('mc checks request classes and rereads its index during group validation, background scans and retries', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rs530-mc-validation-'));
    const checksum = Js5RemoteLoader.crc32,
        seed = mathRandom['seed'];
    try {
        const access = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED'];
        const java = ['java', ...access, '-cp', dir + delimiter + gamepackPath, 'ProviderValidationOracle'];
        for (const cmd of [
            ['javac', ...access, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'cache/ProviderValidationOracle.java')],
            [...java, dir]
        ]) {
            const result = Bun.spawnSync(cmd);
            expect(result.exitCode, result.stderr.toString()).toBe(0);
        }
        const rows: [number, number, number, number][] = [];
        for (let op = 0; op < 9; op++)
            for (const flags of [0, 1, 2, 3, 4, 5, 6, 7]) {
                rows.push([op, 0, 0, flags]);
                for (let at = 1; at <= 9; at++) for (let action = 0; action < (op === 4 || op === 5 || op === 6 ? 6 : 4); action++) rows.push([op, at, action, flags]);
            }
        const out = Bun.spawnSync(java, { stdin: Buffer.from(rows.map(r => r.join(' ')).join('\n') + '\n'), maxBuffer: 4 * 1024 * 1024 });
        expect(out.exitCode, out.stderr.toString()).toBe(0);
        const lines = out.stdout.toString().trimEnd().split(/\r?\n/);
        expect(lines.length).toBe(rows.length);
        Js5RemoteLoader.crc32 = new JavaCrc32();
        for (const [i, row] of rows.entries()) expect(run(...row), row.join(' ')).toBe(lines[i]);
    } finally {
        Js5RemoteLoader.crc32 = checksum;
        mathRandom['seed'] = seed;
        rmSync(dir, { recursive: true, force: true });
    }
}, 30000);

test('verifying JS5 groups observes the cursor on the same side of the index read as its gamepack', () => {
    // At bg.c(Z)V @419/427 HD loads the index before the cursor. At mc.g(I)V @264/270 SD loads the cursor first.
    expect(run(4, 3, 5, 0)).toBe(glJar ? 'ok/3/18,52/4,7,0/[1, 0, 1]/0,0,false,false/empty/false' : 'bounds/4/18,52/4,7,0/[1, 0, 1]/0,2147483647,true,false/empty/false');
    expect(run(4, 9, 4, 0)).toBe(glJar ? 'bounds/10/18,52/4,7,0/[1, 0, 1]/0,-1,true,false/empty/false' : 'ok/9/18,52/4,7,0/[1, 0, 1]/0,0,false,false/empty/false');
    if (!glJar) {
        const hd = Bun.spawnSync([process.execPath, 'test', '--test-name-pattern', 'verifying JS5 groups observes', import.meta.path], { env: { ...process.env, RS530_GAMEPACK_IDENTITY: 'gl' } });
        expect(hd.exitCode, hd.stderr.toString()).toBe(0);
        expect(hd.stderr.toString()).toMatch(/^\s*1 pass$/m);
    }
});
