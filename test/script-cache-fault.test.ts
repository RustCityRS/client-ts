import { expect } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import Js5 from '#/cache/Js5.js';
import Js5Index from '#/cache/Js5Index.js';
import LruHashTable from '#/datastruct/LruHashTable.js';
import SecondaryNode from '#/datastruct/SecondaryNode.js';
import Crc32 from '#/io/Crc32.js';
import PacketT from '#/io/PacketT.js';
import { ClientScript } from '#/script/ClientScript.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { loginFixture } from './login-fixture.js';
import { gamepackPath } from './reference.js';

type Probe = [mode: string, file: Uint8Array | null, replacement: Uint8Array | null];
const int = (value: number) => [value >>> 24, (value >>> 16) & 255, (value >>> 8) & 255, value & 255];
function program(body: number[], count: number, trailer = [0]): Uint8Array {
    return Uint8Array.of(0, ...body, ...int(count), 0, 1, 0, 2, 0, 3, 0, 4, ...trailer, trailer.length >>> 8, trailer.length & 255);
}

function probes(): Probe[] {
    const body = [0, 0, ...int(-5), 0, 3, 0x80, 0xff, 0, 0, 21, 3, 0, 38, 4, 0, 39, 5, 0, 99, ...int(125), 0, 100, 248, 255, 255, 9];
    const binary = program(body, 8);
    const rows: Probe[] = ['hit', 'cast', 'rebind', 'drop-cache', 'no-cache', 'no-archive', 'load'].map(mode => [mode, binary, null]);
    rows.push(['load', null, null], ['rebind', null, null], ['drop-cache', null, null]);
    for (const n of [-2, -1, 0, 1, 2, 3, 7, 8, 12]) rows.push(['load', program(body, n), null]);
    // A truncated trailer can move the count into arbitrary opcode bytes. Keep these fixtures restricted
    // to structural/read faults: an out-of-memory result would depend on the particular JVM heap size.
    const addFile = (bytes: Uint8Array) => {
        const size = bytes.length;
        const offset = size - 14 - ((bytes[size - 2] << 8) | bytes[size - 1]);
        if (size >= 2 && offset >= 0 && offset + 4 <= size && Buffer.from(bytes).readInt32BE(offset) > 512) return;
        rows.push(['load', bytes, null]);
    };
    for (let cut = 0; cut < binary.length; cut++) addFile(binary.slice(0, cut));
    for (let i = 0; i < binary.length; i++) {
        const changed = binary.slice();
        changed[i] ^= 1;
        // Keep declared array sizes small when varying the four-byte instruction count.
        if (i < 1 + body.length || i >= 5 + body.length) addFile(changed);
    }
    rows.push(['load', program([], 0, [3]), null], ['load', program([], 0, [1, 0, 1]), null], ['load', program([], 0, [2, 0, 0, 0, 2, ...int(-1), ...int(-2), ...int(-1), ...int(-3)]), null], ['rebind', program([0, 0, ...int(3)], 0), null]);
    for (const other of [null, new Uint8Array(1), program([], 0), program([0, 21, 12], 1), program(body, 8)]) {
        rows.push(['replace-bytes', program([0, 0, ...int(34)], 1), other]);
    }
    return rows;
}

const hash = (numbers: Int32Array | null) => (numbers === null ? 0 : numbers.reduce((h, v) => (Math.imul(h, 31) + v) | 0, 1));
function run([mode, file, replacement]: Probe): string {
    const initial = new LruHashTable<SecondaryNode>(2),
        other = new LruHashTable<SecondaryNode>(2);
    Reflect.set(ClientScript, 'm_cache', initial);
    const occupant = mode === 'cast' ? new SecondaryNode() : new ClientScript();
    if (mode === 'cast' || mode === 'hit') {
        initial.Put(0n, occupant);
        initial.Put(1n, new ClientScript());
    }
    let reads = 0;
    const table = Uint8Array.of(0, 0, 0, 0, 18, 5, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0);
    if (mode === 'hit' || mode === 'cast' || mode === 'no-archive') {
        Client.m_pClientScripts = null;
    } else {
        Client.m_pClientScripts = new Js5(
            {
                index: () => new Js5Index(table, Crc32.prefix(table, table.length)),
                group(_unused, id) {
                    if (id !== 0) throw new Error('unexpected group ' + id);
                    reads++;
                    if (mode === 'rebind') Reflect.set(ClientScript, 'm_cache', other);
                    if (mode === 'drop-cache') Reflect.set(ClientScript, 'm_cache', null);
                    return file === null ? null : Uint8Array.of(0, ...int(file.length), ...file);
                },
                GetGroupLoadPercentage() {
                    throw new Error('unexpected percentage');
                },
                prefetchGroup() {
                    throw new Error('unexpected prefetch');
                }
            },
            true,
            true
        );
    }
    Client.m_pClientScripts?.GetIndexCrc(); // The following observer is attached only to the script's gd.
    if (mode === 'no-cache') Reflect.set(ClientScript, 'm_cache', null);
    const observed: { packet: PacketT | null } = { packet: null };
    const get = PacketT.prototype.g2;
    PacketT.prototype.g2 = function () {
        const first = observed.packet === null && this.m_pos === requireNonNull(this.m_data).length - 2;
        if (first) observed.packet = this;
        const value = get.call(this);
        if (first && mode === 'replace-bytes') this.m_data = replacement;
        return value;
    };
    let script: ClientScript | null = null,
        outcome = 'loaded';
    try {
        script = ClientScript.Get(0);
        if (script === null) outcome = 'missing';
    } catch (error) {
        if (error instanceof TypeError) outcome = error.message.includes('ClassCastException') ? 'cast' : 'null';
        else if (error instanceof RangeError) outcome = error.message.includes('index') ? 'bounds' : 'length';
        else throw error;
    } finally {
        PacketT.prototype.g2 = get;
    }
    if (mode === 'cast' || mode === 'hit') initial.Put(2n, new ClientScript());
    const oldEntry = initial.Find(0n),
        newEntry = other.Find(0n);
    return [outcome, reads, observed.packet?.m_pos ?? '-', oldEntry === null ? 0 : oldEntry === occupant ? 1 : 2, +(newEntry !== null), +(initial.Find(1n) !== null), hash(script?.opcodes ?? null), hash(script?.intOperands ?? null)].join(' ');
}

loginFixture(
    import.meta.url,
    'j.a cache promotion, packet cursor and partially decoded script failures match client.jar',
    async () => {
        const rows = probes(),
            dir = mkdtempSync(join(tmpdir(), 'rs530-script-fault-'));
        const encode = (bytes: Uint8Array | null) => (bytes === null ? '-' : 'x' + Buffer.from(bytes).toString('hex'));
        try {
            const inputs = join(dir, 'rows.txt');
            writeFileSync(inputs, rows.map(([mode, bytes, alt]) => [mode, encode(bytes), encode(alt)].join(' ')).join('\n') + '\n');
            execFileSync('javac', ['--add-modules', 'jdk.jdi', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game', 'ScriptCacheFaultOracle.java')]);
            const ref = execFileSync('java', ['--add-modules', 'jdk.jdi', '-cp', dir + delimiter + gamepackPath, 'ScriptCacheDebugger', inputs], { encoding: 'utf8', timeout: 30000 })
                .trimEnd()
                .split(/\r?\n/);
            expect(ref.length).toBe(rows.length);
            expect(ref[1]).toBe('cast 0 - 1 0 0 0 0');
            expect(ref[2].split(' ').slice(3, 5)).toEqual(['0', '1']);
            expect(ref[ref.length - 5].split(' ').slice(0, 2)).toEqual(['null', '1']);
            for (const [i, probe] of rows.entries()) expect(run(probe), [i, probe[0], encode(probe[1])].join(' ')).toBe(ref[i]);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    45000
);
