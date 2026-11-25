import { fixtureDiskQueue } from './disk-queue.js';
import { requireNonNull } from '../src/util/JavaArray.js';
import { gamepackPath } from './reference.js';
import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Js5MasterIndex from '../src/cache/Js5MasterIndex.js';
import Js5RemoteLoader from '../src/cache/Js5RemoteLoader.js';
import JavaCrc32 from '../src/util/JavaCrc32.js';
import { JavaError } from '../src/util/ClientError.js';
import Js5DiskRequest from '../src/cache/Js5DiskRequest.js';
import type HashTable from '../src/datastruct/HashTable.js';
import Linkable from '../src/datastruct/Linkable.js';
import Js5NetQueue from '../src/io/Js5NetQueue.js';
import Js5NetQueueRequest from '../src/io/Js5NetQueueRequest.js';
import Crc32 from '../src/io/Crc32.js';
import PacketT from '../src/io/PacketT.js';

const data = (bytes: Uint8Array | Int8Array | null) => (bytes === null ? '-' : Buffer.from(bytes).toString('base64'));
const bytes = (encoded: string) => Uint8Array.from(Buffer.from(encoded, 'base64'));

class Store {
    private groups = new Map<number, Uint8Array>();
    read(group: number) {
        return this.groups.get(group)?.slice() ?? null;
    }
    write(group: number, value: Uint8Array) {
        this.groups.set(group, value.slice());
    }
}

class ProviderTrace {
    readonly crcTable = Crc32.CRCTable32;
    readonly net = new Js5NetQueue();
    readonly disk = fixtureDiskQueue();
    groupStore = new Store();
    indexStore = new Store();
    master: Js5MasterIndex | null = null;
    provider: Js5RemoteLoader | null = null;
    queued: Js5DiskRequest | null = null;
    immediate: Js5DiskRequest | null = null;

    deliver(request: Js5NetQueueRequest, value: Uint8Array, pos: number, done: boolean) {
        request.packet = new PacketT(value);
        request.packet.m_pos = pos < 0 ? value.length - request.m_footerLength : pos;
        if (done) {
            request.unlinkSecondary();
            request.incomplete = false;
        }
    }

    run(line: string): string {
        const c = line.split(' '),
            n = Number(c[1]);
        const previous = this.provider;
        const provider = () => requireNonNull(this.provider);
        const master = () => requireNonNull(this.master);
        const groupRequest = () => provider()['requests'].get(BigInt(n));
        try {
            switch (c[0]) {
                case 'crcTable':
                    Crc32.CRCTable32 = n === 0 ? new Int32Array(256) : this.crcTable;
                    break;
                case 'crcState':
                    Js5RemoteLoader.crc32 = n === 0 ? null : new JavaCrc32();
                    break;
                case 'crcError':
                    Js5RemoteLoader.crc32 = new (class extends JavaCrc32 {
                        override reset(): void {
                            throw new JavaError('checksum');
                        }
                    })();
                    break;
                case 'fatalGroup':
                    try {
                        return data(provider().group(0, n));
                    } catch (cause) {
                        if (cause instanceof JavaError) return 'fatal';
                        throw cause;
                    }
                case 'crcSeed':
                    requireNonNull(Js5RemoteLoader.crc32).update(Uint8Array.of(2, 3, 255), 0, n);
                    break;
                case 'master':
                    this.master = new Js5MasterIndex(this.net, this.disk);
                    break;
                case 'load':
                    return String(master().load());
                case 'masterBytes':
                    this.deliver(requireNonNull(master()['request']), bytes(c[1]), -1, true);
                    break;
                case 'provider':
                    this.provider = master().getProvider(n, c[2] === '1' ? this.indexStore : null, c[3] === '1' ? this.groupStore : null);
                    return this.provider === previous ? 'same' : 'new';
                case 'fill':
                    for (let i = 0; i < n; i++) this.net.RequestData(0, i, 40, c[2] === '1');
                    break;
                case 'unfill':
                    this.net[c[1] === '1' ? 'urgent' : 'prefetch'].clear();
                    break;
                case 'index':
                    return String(provider().index()?.m_indexVersion ?? '-');
                case 'indexPct':
                    return String(provider().GetIndexPercentage());
                case 'indexBytes':
                    this.deliver(provider()['indexRequest'] as Js5NetQueueRequest, bytes(c[1]), Number(c[2]), c[3] === '1');
                    break;
                case 'group':
                    return data(provider().group(Number(c[2]), n));
                case 'groupBytes':
                    this.deliver(groupRequest() as Js5NetQueueRequest, bytes(c[2]), Number(c[3]), c[4] === '1');
                    break;
                case 'groupPct':
                    return String(provider().GetGroupLoadPercentage(n));
                case 'mixedPct': {
                    const table: HashTable = provider()['requests'];
                    const kind = Number(c[2]);
                    const net = new Js5NetQueueRequest();
                    net.packet = new PacketT(kind === 4 ? 0 : 20);
                    net.packet.m_pos = 7;
                    const disk = new Js5DiskRequest();
                    disk.incomplete = false;
                    const wrong = new (class extends Linkable {
                        getPercentage() {
                            return 71;
                        }
                    })();
                    const entries = [wrong, new Linkable(), disk, net, net];
                    if (kind < entries.length) table.put(entries[kind], BigInt(n));
                    const next = new Js5DiskRequest();
                    if (kind < entries.length) table.put(next, BigInt(n));
                    let result: string;
                    try {
                        result = String(provider().GetGroupLoadPercentage(n));
                    } catch (error) {
                        if (error instanceof TypeError) result = 'cast';
                        else if (error instanceof RangeError) result = 'arithmetic';
                        else throw error;
                    }
                    return result + '/' + (table.nextWithKey() === next);
                }
                case 'groupState': {
                    const r = groupRequest();
                    return r === null ? '-' : [r instanceof Js5NetQueueRequest ? 'net' : 'disk', r.incomplete, r.urgent, r.orphan].join('/');
                }
                case 'priority':
                    provider().prefetchGroup(n);
                    break;
                case 'prefetchAll':
                    provider().prefetchAll();
                    break;
                case 'tick':
                    master().tick();
                    break;
                case 'cleanup':
                    provider()['nextCleanup'] = 0n;
                    provider().processQueue();
                    break;
                case 'seed':
                    (c[1] === 'i' ? this.indexStore : this.groupStore).write(Number(c[2]), bytes(c[3]));
                    break;
                case 'write':
                    this.queued = this.disk.ProvideDataFromNetThread(n, this.groupStore, bytes(c[2]));
                    break;
                case 'immediate':
                    this.immediate = this.disk.BlockingFetchFromMainThread(1, n, this.groupStore);
                    break;
                case 'read':
                    this.queued = this.disk.EnqueueRequestFromMainThread(this.groupStore, n);
                    break;
                case 'diskState': {
                    const r = requireNonNull(c[1] === 'q' ? this.queued : this.immediate);
                    let result: string;
                    try {
                        result = data(r.getData());
                    } catch {
                        result = 'exception';
                    }
                    return [r.type, r.secondaryKey, r.urgent, r.getPercentage(), result, this.queued !== null && this.queued.data !== null && this.queued.data === r.data].join('/');
                }
                case 'pending':
                    this.disk.pending = n;
                    break;
                default:
                    throw new Error(line);
            }
        } catch {
            return 'exception';
        }
        return '.';
    }

    snapshot(): string {
        let s = [this.net.GetUrgentQueueSize(), this.net.response, this.net.errors, this.disk.pending].join('/');
        if (this.master) s += '|' + (this.master['packet']?.m_pos ?? '-');
        const p = this.provider;
        if (p) s += '|' + [p.indexCrc, p.indexVersion, p.groupCount(), p.verifiedCount(), p.verificationPosition(), p['scanGroup'], p['verifying'], p['prefetching'], data(p['status']), p['requests'].size()].join('/');
        return s + '|' + (Js5RemoteLoader.crc32?.getValue() ?? '-');
    }
}

function traceCommands(): string[] {
    const group = Uint8Array.of(0, 0, 0, 0, 3, 99, 201, 255, 0, 0);
    const diskGroup = group.slice();
    diskGroup.set([0xde, 0xad], diskGroup.length - 2);
    const raw = new PacketT(128);
    raw.p1(0);
    raw.p4(0);
    raw.p1(6);
    raw.p4(-12);
    raw.p1(0);
    raw.p2(2);
    raw.p2(1);
    raw.p2(3);
    const crc = Crc32.compute(0, group, group.length - 2);
    raw.p4(crc);
    raw.p4(crc);
    raw.p4(0xabcddead);
    raw.p4(1);
    raw.p2(1);
    raw.p2(1);
    raw.p2(0);
    raw.p2(0);
    const reference = requireNonNull(raw.m_data).slice(0, raw.m_pos);
    new DataView(reference.buffer).setInt32(1, reference.length - 5);
    const indexCrc = Crc32.prefix(reference, reference.length);
    const master = new PacketT(5 + 8 * 4 + 2);
    master.m_pos = 5;
    for (const version of [-12, -40, -12, -12]) {
        master.p4(indexCrc);
        master.p4(version);
    }
    const full = data(master.m_data),
        ref = data(reference),
        good = data(group),
        stored = data(diskGroup);
    const bad = data(Uint8Array.of(4, 5, 6));
    return [
        'crcSeed 3',
        'crcSeed 2',
        'crcSeed 4',
        'write 9 ' + bad,
        'diskState q',
        'immediate 9',
        'diskState i',
        'drain',
        'diskState q',
        'immediate 9',
        'diskState i',
        'read 9',
        'diskState q',
        'drain',
        'diskState q',
        'immediate 999',
        'diskState i',
        'fill 20 1',
        'master',
        'load',
        'provider 1 0 0',
        'unfill 1',
        'load',
        'masterBytes ' + full,
        'load',
        'load',
        'provider -1 0 0',
        'provider 4 0 0',
        'provider 5 0 0',
        'provider 2147483647 0 0',
        'provider 1 0 0',
        'provider 1 1 1',
        'indexPct',
        'index',
        'indexBytes ' + ref + ' 7 0',
        'indexPct',
        'indexBytes ' + bad + ' -1 1',
        'index',
        'indexBytes ' + ref + ' -1 1',
        'indexPct',
        'index',
        'group 1 1',
        'group 1 2',
        'group 1 9',
        'group 1 0',
        'groupState 1',
        'groupPct 1',
        'groupBytes 1 ' + good + ' 3 0',
        'groupPct 1',
        'groupBytes 1 ' + bad + ' -1 1',
        'group 1 0',
        'groupState 1',
        'groupBytes 1 ' + good + ' -1 1',
        'crcError',
        'fatalGroup 1',
        'groupState 1',
        'crcState 0',
        'group 1 0',
        'groupState 1',
        'crcState 1',
        'groupBytes 1 ' + good + ' -1 1',
        'crcTable 0',
        'group 1 0',
        'crcTable 1',
        'groupState 1',
        'group 4 0',
        'groupBytes 4 ' + good + ' -1 1',
        'cleanup',
        'groupState 4',
        'cleanup',
        'groupState 4',
        'seed i 2 ' + ref,
        'seed g 1 ' + stored,
        'seed g 4 ' + stored,
        'provider 2 1 1',
        'index',
        'indexPct',
        'priority -1',
        'priority 2',
        'priority 1',
        'priority 1',
        'prefetchAll',
        'pending 250',
        'tick',
        'pending 1',
        'tick',
        'groupState 1',
        'groupState 4',
        'drain',
        'tick',
        'tick',
        'groupState 4',
        'groupBytes 4 ' + good + ' -1 1',
        'tick',
        'tick',
        'group 4 0',
        'group 1 0',
        'group -1 0',
        'group 9 0',
        'drain',
        'seed i 1 ' + ref,
        'master',
        'load',
        'masterBytes ' + full,
        'load',
        'provider 1 1 1',
        'index',
        'indexPct',
        'indexBytes ' + ref + ' -1 1',
        'index',
        'group 4 0',
        'drain',
        'provider 3 1 1',
        'indexPct',
        'indexBytes ' + bad + ' -1 1',
        'fill 20 1',
        'index',
        'indexPct',
        'unfill 1',
        'indexPct',
        'indexBytes ' + ref + ' -1 1',
        'index',
        'tick',
        'group 1 0',
        'groupState 1',
        'drain',
        'tick',
        'tick',
        'mixedPct 1000 0',
        'mixedPct 1016 1',
        'mixedPct 1032 2',
        'mixedPct 1048 3',
        'mixedPct 1064 4',
        'mixedPct 1080 5',
        'master',
        'masterBytes AAA=',
        'load',
        'provider 0 0 0',
        'doubleStop'
    ];
}

test('wi, mc, ca and qc match the JAR through master/index retries, disk verification, prefetch and orphan collection', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'provider530-'));
    const jar = gamepackPath;
    const trace = new ProviderTrace();
    const previousChecksum = Js5RemoteLoader.crc32;
    Js5RemoteLoader.crc32 = new JavaCrc32();
    try {
        const source = fileURLToPath(new URL('./cache/ProviderOracle.java', import.meta.url));
        const compile = Bun.spawnSync(['javac', '-cp', jar, '-d', dir, source], { timeout: 15000 });
        expect(compile.stderr.toString()).toBe('');
        expect(compile.exitCode).toBe(0);
        const commands = traceCommands();
        const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + jar, 'ProviderOracle', dir], { stdin: Buffer.from(commands.join('\n')), timeout: 20000 });
        expect(java.stderr.toString()).toBe('');
        expect(java.exitCode).toBe(0);
        const lines = java.stdout.toString().trimEnd().split(/\r?\n/);
        expect(lines).toHaveLength(commands.length);
        for (const [i, command] of commands.entries()) {
            let result: string;
            if (command === 'drain') {
                const barrier = trace.disk.EnqueueRequestFromMainThread(trace.groupStore, 901);
                while (barrier.incomplete) await Bun.sleep(1);
                result = '.';
            } else if (command === 'doubleStop') {
                const disk = fixtureDiskQueue();
                await disk.EndAndJoin();
                try {
                    await disk.EndAndJoin();
                    result = '.';
                } catch {
                    result = 'exception';
                }
            } else {
                result = trace.run(command);
            }
            expect(result + '|' + trace.snapshot(), i + ' ' + command).toBe(lines[i]);
        }
    } finally {
        Js5RemoteLoader.crc32 = previousChecksum;
        Crc32.CRCTable32 = trace.crcTable;
        await trace.disk.EndAndJoin();
        rmSync(dir, { recursive: true, force: true });
    }
}, 40000);
