import { receivePacket } from './receive-packet.js';
import Js5 from '#/cache/Js5.js';
import Js5Index from '#/cache/Js5Index.js';
import Crc32 from '#/io/Crc32.js';
import InvType from '#/config/InvType.js';
import LruHashTable from '#/datastruct/LruHashTable.js';
import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import SafeTime from '#/io/SafeTime.js';
import { arrayAt, requireNonNull } from '#/util/JavaArray.js';
import EnumType from '#/config/EnumType.js';
import ParamType from '#/config/ParamType.js';
import StructType from '#/config/StructType.js';
import VarBitType from '#/config/VarBitType.js';
import ClientVarCache from '#/util/ClientVarCache.js';
import VarpType from '#/config/VarpType.js';
import EnumStringEntry from '#/datastruct/EnumStringEntry.js';
import type HashTable from '#/datastruct/HashTable.js';
import IntNode from '#/datastruct/IntNode.js';
import JagString from '#/datastruct/JagString.js';
import type ReferenceNode from '#/datastruct/ReferenceNode.js';
import LRUHashCache from '#/datastruct/LRUHashCache.js';
import StringNode from '#/datastruct/StringNode.js';
import PacketT from '#/io/PacketT.js';
import { localAssets } from './cachefile.js';
import { cachePath, gamepackPath } from './reference.js';

const mix = (h: number, n: number) => (Math.imul(h, 31) + n) | 0;
function text(s: JagString | null): number {
    if (s === null) return 0;
    let h = 1;
    for (let i = 0; i < s.length; i++) h = mix(h, arrayAt(s.bytes, i));
    return h;
}
function table(values: HashTable<IntNode | StringNode | EnumStringEntry> | null): number {
    if (values === null) return 0;
    let h = values.getBucketCount() + 1;
    for (let n = values.head(); n !== null; n = values.next()) {
        h = mix(h, Number(n.key & 0xffffffffn));
        h = mix(h, n instanceof IntNode ? n.value : text(n.value));
    }
    return h;
}
function enumHash(e: EnumType): number {
    let h = [e.m_outputType, text(e['defaultString']), e['defaultInt'], table(e.entries)].reduce(mix, e.input);
    if (e.entries !== null) {
        const entries: (IntNode | StringNode)[] = [];
        for (let n = e.entries.head(); n; n = e.entries.next()) entries.push(n);
        for (const n of entries) {
            const key = Number(n.key);
            h = mix(h, n instanceof StringNode ? text(e.GetOutputString(key)) : e.getInt(key));
            h = mix(h, Number(n instanceof StringNode ? e.containsString(requireNonNull(n.value)) : e.containsInt(n.value)));
        }
    }
    return mix(h, table(e['inverse']));
}
function structHash(s: StructType): number {
    const params = s['params'];
    let h = table(params);
    if (params !== null) {
        for (let n = params.head(); n; n = params.next()) {
            try {
                h = mix(h, n instanceof StringNode ? text(s.GetParam2(Number(n.key), null)) : s.GetParam(33, Number(n.key)));
            } catch {
                h = mix(h, 0x7341);
            }
        }
    }
    return h;
}
function referenceStates(): string[] {
    const cache = new LRUHashCache<{ name: string }>(3);
    const values = ['A', 'B', 'C', 'D'].map(name => ({ name }));
    const states: string[] = [];
    const record = (action: string, value = '-') => {
        let s = [action, value, cache['remaining'], cache.countHard()].join(' ');
        for (let n = cache['queue'].head(); n; n = cache['queue'].next()) s += ' ' + [n.key, n.isSoft() ? 's' : 'h', n.secondaryKey].join('/');
        states.push(s);
    };
    cache.Put(3n, values[0]);
    cache.Put(6n, values[1]);
    cache.Put(7n, values[2]);
    record('full');
    cache.Clean(1);
    cache.Find(7n);
    cache.Clean(1);
    record('demote');
    record('promote', requireNonNull(cache.Find(3n)).name);
    const soft = cache['table'].get(6n) as ReferenceNode<{ name: string }> & { reference: { deref(): unknown } };
    // The JVM oracle clears SoftReference explicitly. Emulate a host-released JS target.
    soft.reference = { deref: () => undefined };
    record('released', String(cache.Find(6n)));
    cache.Put(7n, values[3]);
    cache.Put(9n, null);
    cache.Put(10n, values[2]);
    record('evict', String(cache.Find(3n)));
    cache.Clean(0);
    cache.Clean(0);
    cache.removeSoft();
    record('removeSoft');
    cache.Put(9n, values[2]);
    cache.Put(10n, values[1]);
    cache.Remove(10n);
    cache.Reset();
    record('clear');
    return states;
}

function archiveIndex(): Buffer {
    const groups = [0, 1, 5, 11, 16, 17];
    // Format 5, one sparse file per group. Group 0 ends at varbit 1023.
    const bytes = Buffer.alloc(5 + 4 + groups.length * 14);
    bytes.writeInt32BE(bytes.length - 5, 1);
    bytes[5] = 5;
    bytes.writeUInt16BE(groups.length, 7);
    let previous = 0;
    for (const [i, group] of groups.entries()) {
        bytes.writeUInt16BE(group - previous, 9 + i * 2);
        bytes.writeUInt16BE(1, 9 + groups.length * 10 + i * 2);
        bytes.writeUInt16BE(group === 0 ? 1023 : 0, 9 + groups.length * 12 + i * 2);
        previous = group;
    }
    return bytes;
}

function loaderStates(bytes: Uint8Array): string[] {
    const states: string[] = [];
    const reads: string[] = [];
    const index = new Js5Index(bytes, Crc32.prefix(bytes, bytes.length));
    const archive = (seed: number) =>
        new Js5(
            {
                index: () => index,
                group(mode, group) {
                    reads.push([seed, mode, group].join('/'));
                    let file: number[];
                    switch (group) {
                        case 0:
                        case 1:
                            file = [1, 0, seed + group, 2, 6, 0];
                            break;
                        case 5:
                            file = [2, 0, seed, 0];
                            break;
                        case 11:
                            file = seed === 99 ? [2, 255] : [2, 0, 0, 0, seed, 0];
                            break;
                        default:
                            file = [5, 0, seed + group, 0];
                            break;
                    }
                    return Uint8Array.of(0, 0, 0, 0, file.length, ...file);
                },
                GetGroupLoadPercentage() {
                    throw new Error('unexpected progress');
                },
                prefetchGroup() {
                    throw new Error('unexpected prefetch');
                }
            },
            false,
            false
        );
    const save = {
        inv: [InvType.m_pConfigClient, InvType.m_recentUse] as const,
        param: [ParamType.m_pConfigClient, ParamType.m_recentUse] as const,
        varp: [VarpType.m_pConfigClient, VarpType.m_recentUse, VarpType.m_numDefinitions] as const,
        bit: [VarBitType.m_pConfigClient, VarBitType.m_recentUse] as const
    };
    try {
        InvType.m_recentUse = new LruHashTable(64);
        ParamType.m_recentUse = new LruHashTable(64);
        VarpType.m_recentUse = new LRUHashCache(64);
        VarBitType.m_recentUse = new LRUHashCache(64);
        const a = archive(3),
            b = archive(7);
        const init = (input: Js5) => {
            InvType.Init(input);
            ParamType.Init(input);
            VarpType.Init(input);
            VarBitType.Init(input);
        };
        init(a);
        const inv = InvType.List(0),
            param = ParamType.List(0),
            varp = VarpType.List(0, 17);
        const lower = VarBitType.List(1023),
            upper = VarBitType.List(1024);
        states.push(['load', inv.m_size, param.m_defaultNumber, varp.clientCode, lower.baseVar, upper.baseVar, VarpType.m_numDefinitions].join(' '));
        init(b);
        states.push(['same', InvType.List(0) === inv, ParamType.List(0) === param, VarpType.List(0, 16) === varp, VarBitType.List(1024) === upper].join(' '));
        VarpType.ResetCache();
        VarBitType.ResetCache();
        states.push(['reload', VarpType.List(0, 16).clientCode, VarBitType.List(1024).baseVar, VarBitType.List(-1).baseVar].join(' '));
        VarpType.m_numDefinitions = 719;
        let failed = false;
        try {
            VarpType.Init(null);
        } catch {
            failed = true;
        }
        states.push(['partial', failed, VarpType.m_pConfigClient === null, VarpType.m_numDefinitions, VarpType.List(0, 17).clientCode].join(' '));
        ParamType.m_recentUse = new LruHashTable(64);
        ParamType.Init(archive(99));
        failed = false;
        try {
            ParamType.List(0);
        } catch {
            failed = true;
        }
        ParamType.Init(b);
        states.push(['retry', failed, ParamType.List(0).m_defaultNumber, reads.join(',')].join(' '));
        return states;
    } finally {
        [InvType.m_pConfigClient, InvType.m_recentUse] = save.inv;
        [ParamType.m_pConfigClient, ParamType.m_recentUse] = save.param;
        [VarpType.m_pConfigClient, VarpType.m_recentUse, VarpType.m_numDefinitions] = save.varp;
        [VarBitType.m_pConfigClient, VarBitType.m_recentUse] = save.bit;
    }
}

async function variableStates(): Promise<string[]> {
    const base = 14;
    const assets = localAssets(cachePath, [3]);
    VarBitType.m_recentUse.Reset();
    VarpType.m_recentUse.Reset();
    VarBitType.Init(assets.archive(22));
    VarpType.Init(assets.archive(2));
    VarpType.m_numDefinitions = 20;
    requireNonNull(VarBitType.m_pConfigClient).FetchFile = file => Uint8Array.of(1, 0, 14, file === (1200 & 1023) ? 4 : 0, file === (1200 & 1023) ? 6 : 31, 0);
    requireNonNull(VarpType.m_pConfigClient).FetchFile = file => (file === base ? Uint8Array.of(5, 0, 9, 0) : null);
    let now = 1000n;
    const realTime = SafeTime.CurrentTimeMillis;
    SafeTime.CurrentTimeMillis = () => now;
    try {
        const domain = ClientVarCache;
        domain.m_var.fill(0);
        domain.m_varServ.fill(0);
        const states: string[] = [];
        const record = (...values: unknown[]) => states.push(values.join(' '));
        domain.reset();
        domain.setServer(base, 7);
        domain.setServer(7, -11);
        domain.setServer(base, 9);
        record('initial', domain.m_var[base], domain.m_varServ[base], domain.poll(true), domain.poll(false), domain.poll(false), domain.m_var[base]);
        domain.SetVarbit(1200, 3);
        domain.setBitServer(7, 1200);
        record('delayed', domain.GetVarbit(1200), domain.m_var[base], domain.m_varServ[base], requireNonNull(domain.changes.get(BigInt(base))).value === (0x4000000000000000n | (now + 500n)), domain.poll(true));
        now += 500n;
        expect(domain.poll(true)).toBe(-1);
        now++;
        record('expired', domain.poll(true), domain.GetVarbit(1200), domain.poll(false));
        domain.SetVarbit(1200, 8);
        now += 501n;
        record('client', domain.GetVarbit(1200), domain.poll(true), domain.changes.size());
        domain.setClient(base, -1);
        const before = domain.GetVarbit(1201);
        domain.SetVarbit(1201, 1);
        record('wide', before, domain.m_var[base]);
        domain.setClient(base, 256);
        domain.reset();
        record('reset', domain.m_var[base], domain.m_varServ[base], domain.m_var[7], domain.m_varServ[7], domain.changes.size());
        for (const packet of ['226-81234567008e', '60-008e77', '37-85b004', '84-060000003004', '128-', '89-']) {
            const [opcode, hex] = packet.split('-');
            await receivePacket(Number(opcode), Buffer.from(hex, 'hex'));
            record('packet', opcode, domain.m_var[base], domain.m_varServ[base]);
        }
        return states;
    } finally {
        SafeTime.CurrentTimeMillis = realTime;
        VarBitType.m_recentUse.Reset();
        VarpType.m_recentUse.Reset();
    }
}
test('config decoders, forward and inverse enum tables, and soft-reference LRU transitions match the 530 gamepack', async () => {
    const assets = localAssets(cachePath, [2, 17, 22]);
    const records: [number, Uint8Array][] = [];
    const add = (kind: number, archive: number, group: number) => {
        for (const bytes of requireNonNull(assets.files(archive, group))) if (bytes) records.push([kind, bytes]);
    };
    for (const g of requireNonNull(requireNonNull(assets.index(22)).groupIds)) add(0, 22, g);
    add(1, 2, 16);
    add(2, 2, 11);
    add(3, 2, 26);
    for (const g of requireNonNull(requireNonNull(assets.index(17)).groupIds)) add(4, 17, g);
    // An ignored opcode, 32-bit varbit, mixed duplicate struct keys, and
    // duplicate enum keys with equal 64-bit hashes ("Aa" and "BB").
    for (const [kind, hex] of [
        [0, 'ff010001001f00'],
        [1, '0705123400'],
        [2, '080173028000000005ff810000'],
        [3, 'f90300000001ffffffff01000001ff00000000020000000200'],
        [4, '0169027303550005000300000001416100000000024242000000000144630000'],
        [4, '016902690480000000060002ffffffffffffffff00000001ffffffff00']
    ] as const)
        records.push([kind, Buffer.from(hex, 'hex')]);
    const counts = new Int32Array(5),
        hashes = new Int32Array(5).fill(1);
    const input: Buffer[] = [Buffer.alloc(4)];
    input[0].writeInt32BE(records.length);
    for (const [kind, bytes] of records) {
        const header = Buffer.alloc(5);
        header[0] = kind;
        header.writeInt32BE(bytes.length, 1);
        input.push(header, Buffer.from(bytes));
        const packet = new PacketT(bytes);
        let h: number;
        switch (kind) {
            case 0: {
                const t = new VarBitType();
                t.Decode(packet);
                h = mix(mix(t.baseVar, t.startBit), t.endBit);
                break;
            }
            case 1: {
                const t = new VarpType();
                t.Decode(packet);
                h = t.clientCode;
                break;
            }
            case 2: {
                const t = new ParamType();
                t.Decode(packet);
                h = [t.m_defaultNumber, text(t.defaultString), +t.IsStringType()].reduce(mix, t['type']);
                break;
            }
            case 3: {
                const t = new StructType();
                t.Decode(packet);
                h = structHash(t);
                break;
            }
            default: {
                const t = new EnumType();
                t.Decode(packet);
                h = enumHash(t);
            }
        }
        counts[kind]++;
        hashes[kind] = mix(mix(hashes[kind], packet.m_pos), h);
    }
    const out = resolve(import.meta.dir, '../out');
    mkdirSync(out, { recursive: true });
    const scratch = mkdtempSync(join(out, 'config-'));
    try {
        const jar = gamepackPath;
        const source = resolve(import.meta.dir, 'ui/ConfigOracle.java');
        const compiled = Bun.spawnSync(['javac', '-cp', jar, '-d', scratch, source]);
        if (compiled.exitCode) throw new Error(compiled.stderr.toString());
        const path = join(scratch, 'configs.bin');
        writeFileSync(path, Buffer.concat(input));
        const index = archiveIndex();
        const result = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', scratch + delimiter + jar, 'ConfigOracle', index.toString('base64')], { stdin: Bun.file(path), timeout: 30000 });
        if (result.exitCode) throw new Error(result.stderr.toString());
        const [sizes, digests, ...states] = result.stdout.toString().trim().split(/\r?\n/);
        expect(Array.from(counts)).toEqual(JSON.parse(sizes));
        expect(Array.from(hashes)).toEqual(JSON.parse(digests));
        expect([...referenceStates(), ...(await variableStates()), ...loaderStates(index)]).toEqual(states);
    } finally {
        rmSync(scratch, { recursive: true, force: true });
    }
}, 60000);
