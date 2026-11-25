import Client from '#/client/Client.js';
import NpcType from '#/config/NpcType.js';
import LocType from '#/config/LocType.js';
import ObjType from '#/config/ObjType.js';
import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import { arrayAt, requireNonNull } from '#/util/JavaArray.js';
import EnumType from '#/config/EnumType.js';
import Js5 from '#/cache/Js5.js';
import ClientVarCache from '#/util/ClientVarCache.js';
import HashTable from '#/datastruct/HashTable.js';
import IntNode from '#/datastruct/IntNode.js';
import JagString, { fromJsString } from '#/datastruct/JagString.js';
import StringNode from '#/datastruct/StringNode.js';
import PacketT from '#/io/PacketT.js';
import PlayerModel from '#/dash3d/PlayerModel.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import ScriptRunner from '#/script/ScriptRunner.js';
import { ClientScript } from '#/script/ClientScript.js';
import HookReq from '#/script/HookReq.js';
import { localAssets, readGroup } from './cachefile.js';
import { cachePath, gamepackPath } from './reference.js';

const mix = (a: number, b: number) => (Math.imul(31, a) + b) | 0;

function hash(value: unknown): number {
    if (value === null) return 0;
    if (typeof value === 'boolean') return value ? 1231 : 1237;
    if (typeof value === 'number') return value;
    if (value instanceof JagString) {
        let h = 1;
        for (let i = 0; i < value.length; i++) h = mix(h, arrayAt(value.bytes, i));
        return h;
    }
    if (value instanceof HashTable) {
        let h = value.getBucketCount() + 1;
        for (let n = value.head(); n; n = value.next()) {
            h = mix(h, Number(n.key));
            h = mix(h, hash((n as IntNode | StringNode).value));
        }
        return h;
    }
    if (Array.isArray(value) || value instanceof Int8Array || value instanceof Int16Array || value instanceof Int32Array) {
        let h = 1;
        for (const element of value) h = mix(h, hash(element));
        return h;
    }
    throw new Error('Unhandled definition field ' + String(value));
}

class Fields {
    readonly fields: { name: string; descriptor: string; member: string; hash: number }[];
    count = 0;
    cursorHash = 1;
    constructor(file: string, owner: string) {
        const source = readFileSync(resolve(import.meta.dir, '../src/config', file + '.ts'), 'utf8');
        this.fields = [...source.matchAll(/^ +\/\/ (\w+)\.(\w+):([^\r\n]+)\r?\n +(\w+)/gm)]
            .filter(([, cls]) => cls === owner)
            .map(([, , name, descriptor, member]) => ({ name, descriptor, member, hash: 1 }))
            .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    }
    add(obj: ObjType | NpcType | LocType, cursor: number): void {
        this.count++;
        this.cursorHash = mix(this.cursorHash, cursor);
        for (const f of this.fields) f.hash = mix(f.hash, hash((obj as unknown as Record<string, unknown>)[f.member]));
    }
    rows(): string[] {
        return [[this.count, this.cursorHash].join(' '), ...this.fields.map(f => [f.name, f.descriptor, f.hash].join(' '))];
    }
}

test('all kl, ja and jb fields after decoding and members/free archive resolution match the 530 jar', () => {
    const directory = cachePath;
    const assets = localAssets(directory, [2, 16, 17, 18, 19]);
    const parts: Buffer[] = [];
    const int = (n: number) => {
        const b = Buffer.alloc(4);
        b.writeInt32BE(n);
        parts.push(b);
    };
    const bytes = (data: Uint8Array) => {
        int(data.length);
        parts.push(Buffer.from(data));
    };
    const workloads = [
        { archive: 19, cls: ObjType, cache: ObjType.types, owner: 'kl', shift: 8, edges: ['ff00', '28028000ffffabcd', 'f903000000010000000801000001ff0000000001ffffffff00', '640001'] },
        { archive: 18, cls: NpcType, cache: NpcType.m_recentUse, owner: 'ja', shift: 7, edges: ['7900', '0101ffff79010102', '760000ffff8000011234', '2a0380ff', 'f90100000002ff'] },
        { archive: 16, cls: LocType, cache: LocType.m_recentUse, owner: 'jb', shift: 8, edges: ['010100010a050400', '5200', '51ff00', '5cffffffff800001ffff', '28028000ffffabcd', '4f0001000200038000'] }
    ] as const;
    const expected: string[] = [];
    for (const w of workloads) {
        const archive = assets.archive(w.archive);
        const index = requireNonNull(assets.index(w.archive));
        bytes(readGroup(directory, 255, w.archive));
        for (const group of requireNonNull(index.groupIds)) bytes(readGroup(directory, w.archive, group));
        const fields = () => new Fields(w.cls.name, w.owner);
        const raw = fields(),
            loaded = [fields(), fields()];
        const decode = (id: number, data: Uint8Array, allowError: boolean) => {
            const type = new w.cls();
            type.id = id;
            const packet = new PacketT(data);
            let cursor: number;
            try {
                type.Decode(packet);
                cursor = packet.m_pos;
            } catch (error) {
                if (!allowError) throw error;
                cursor = ~packet.m_pos;
            }
            raw.add(type, cursor);
        };
        if (w.archive === 19) ObjType.Init(archive, true, null, archive);
        if (w.archive === 18) NpcType.Init(archive, archive);
        if (w.archive === 16) LocType.Init(archive, archive, true);
        for (let phase = 0; phase < 2; phase++) {
            ObjType.m_memServer = LocType.members = phase === 0;
            w.cache.Reset();
            for (const group of requireNonNull(index.groupIds)) {
                for (const file of requireNonNull(archive.GetFileList(group))) {
                    const id = (group << w.shift) + file;
                    if (phase === 0) decode(id, requireNonNull(archive.FetchFile(file, null, group)), false);
                    loaded[phase].add(w.cls.List(id), 0);
                }
            }
        }
        int(w.edges.length);
        for (const [i, hex] of w.edges.entries()) {
            const data = Buffer.from(hex, 'hex');
            bytes(data);
            decode(-2 - i, data, true);
        }
        expected.push(...raw.rows(), ...loaded[0].rows(), ...loaded[1].rows());
    }
    bytes(readGroup(directory, 255, 2));
    for (const group of requireNonNull(requireNonNull(assets.index(2)).groupIds)) bytes(readGroup(directory, 2, group));
    bytes(readGroup(directory, 255, 17));
    for (const group of requireNonNull(requireNonNull(assets.index(17)).groupIds)) bytes(readGroup(directory, 17, group));
    ObjType.SwitchMembers(true);
    LocType.setMembers(true);
    const previousModels = LocType.m_pModels;
    try {
        for (const method of ['CheckModelAll', 'CheckModel'] as const) {
            for (let scenario = 0; scenario < 5; scenario++) {
                const loc = new LocType(),
                    groups: number[] = [];
                loc.modelIds = Int32Array.of(1, 2, 3, 4);
                LocType.m_pModels = new Js5(
                    {
                        index: () => assets.index(17),
                        group(_mode, group) {
                            groups.push(group);
                            if (groups.length === 1) {
                                if (scenario === 1) loc.modelIds = new Int32Array(0);
                                if (scenario === 2) loc.modelIds = Int32Array.of(7, 5, 6);
                                if (scenario === 3) loc.modelIds = null;
                                if (scenario === 4) throw Error();
                            }
                            return group % 2 === 0 ? new Uint8Array(1) : null;
                        },
                        prefetchGroup() {},
                        GetGroupLoadPercentage() {
                            return 0;
                        }
                    },
                    false,
                    false
                );
                let result: string;
                try {
                    result = String(method === 'CheckModelAll' ? loc.CheckModelAll() : loc.CheckModel(10));
                } catch {
                    result = 'fault';
                }
                expected.push(result + ' [' + groups.join(', ') + ']');
            }
        }
    } finally {
        LocType.m_pModels = previousModels;
    }
    for (let size = -1; size <= 6; size++) {
        const target = new ObjType(),
            source = new ObjType();
        source.inventoryOps = size < 0 ? null : Array.from({ length: size }, (_, i) => fromJsString('slot' + i));
        let done = true;
        try {
            target.generateLent(new ObjType(), source);
        } catch {
            done = false;
        }
        expected.push([done, hash(target.inventoryOps)].join(' '));
    }
    const types = [NpcType, LocType, ObjType] as const;
    const originalNames = types.map(type => type.defaultName);
    const first = types.map(type => new type());
    expected.push([first[0].name === first[1].name, first[0].name === first[2].name, hash(first[2].name)].join(' '));
    const replacement = fromJsString('replacement');
    try {
        for (let mask = 0; mask < 8; mask++) {
            types.forEach((type, i) => {
                type.defaultName = (mask & (1 << i)) === 0 ? replacement : null;
            });
            const decoded = types.map(type => new type());
            expected.push(decoded.map(type => type.name === replacement).join(' '), decoded.map(type => hash(type.name)).join(' '));
            decoded.forEach((type, i) => type.Decode(new PacketT(Uint8Array.of(2, 'NLO'.charCodeAt(i), 0, 0))));
            expected.push(decoded.map(type => hash(type.name)).join(' '));
        }
        expected.push(first.map((type, i) => type.name === originalNames[i]).join(' '));
    } finally {
        types.forEach((type, i) => {
            type.defaultName = originalNames[i];
        });
    }
    const npc = new NpcType(),
        loc = new LocType();
    npc.multi = Int32Array.of(2, -1, 4);
    npc.multiVarp = 4;
    loc.multi = Int32Array.of(3, -1, 5);
    loc.multiVarp = 4;
    const previous = ClientVarCache.m_var[4];
    for (const selector of [-1, 0, 1, 2, 999]) {
        ClientVarCache.m_var[4] = selector;
        expected.push([requireNonNull(npc.GetMultiNpc()).id, npc.IsMultiNpcVisible(), npc.HasBackgroundMovementSound(), requireNonNull(loc.GetMultiLoc()).id, loc.HasBgSound()].join(' '));
    }
    npc.multi = loc.multi = Int32Array.of(-1, -1);
    expected.push([npc.GetMultiNpc() === null, npc.IsMultiNpcVisible(), loc.GetMultiLoc() === null].join(' '));
    ClientVarCache.m_var[4] = previous;
    const coins = ObjType.List(995);
    for (const count of [-1, 0, 1, 2, 3, 25, 100, 1000, 2147483647]) {
        const selected = coins.GetStackSizeAlt(count);
        expected.push([selected.id, selected === coins].join(' '));
    }
    const calls: [number, number, string | null, number[]][] = [];
    for (const item of [995, 4151, 4152, 2528]) {
        calls.push([4200, 1, null, [item]]);
        for (const slot of [-1, 1, 3, 5, 6]) {
            for (const op of [4201, 4202]) calls.push([op, 1, null, [item, slot]]);
        }
        for (let op = 4203; op <= 4207; op++) calls.push([op, 0, null, [item]]);
        calls.push([4208, 0, null, [item, 59]], [4208, 1, null, [item, 555]]);
    }
    for (const [op, id, param] of [
        [4300, 1, 59],
        [4400, 28194, 580]
    ])
        calls.push([op, 0, null, [id, param]], [op, 1, null, [id, 555]]);
    for (const [query, stockmarket] of [
        ['whip', 1],
        ['rune dagger', 0],
        ['?', 0],
        ['', 0]
    ] as const) {
        calls.push([4210, 0, query, [stockmarket]]);
        for (let i = 0; i < 12; i++) calls.push([4211, 0, null, []]);
        calls.push([4212, 2, null, []], [4211, 0, null, []]);
    }
    for (let id = 0; id < 32; id++) {
        const type = EnumType.List(id);
        const entry = type.entries?.head();
        const key = entry ? Number(entry.key) : -1;
        calls.push(
            [3400, 1, null, [id, -1]],
            [3408, 0, null, [type.input, type.m_outputType, id, key]],
            [3408, 0, null, [-1, type.m_outputType, id, key]],
            [3409, 0, null, [type.m_outputType, id, 0]],
            [3410, 0, 'missing', [id]],
            [3410, 0, '<null>', [id]],
            [3411, 0, null, [id]]
        );
    }
    for (const op of [3400, 3408, 3409, 3410, 3411, 4200, 4201, 4202, 4203, 4204, 4205, 4206, 4207, 4208, 4210, 4300, 4400, 4500]) {
        calls.push([op, 0, null, []]);
    }
    calls.push([3409, 0, null, [115, -1, 0]], [3410, 0, '<null>', [-1]], [4210, 0, '<null>', [0]], [4500, 0, null, [0, 59]], [4500, 1, null, [0, 555]]);
    // The string/int type tag and the table representation come from independent cache opcodes.
    // Exercise both 3409/3410 inverse builders after a mismatched type, along with duplicate keys
    // and the "Aa"/"BB" colliding long hashes.
    const enumShapes = [
        [115, 5, 3],
        [105, 6, 3],
        [115, 6, 3],
        [105, 5, 3],
        [115, 5, 0],
        [105, 6, 0],
        [115, 0, 0],
        [105, 0, 0]
    ];
    int(enumShapes.length);
    const enumBase = 83000;
    for (const [index, [output, table, count]] of enumShapes.entries()) {
        const packet = new PacketT(128),
            id = enumBase + index;
        packet.p1(1);
        packet.p1(105);
        packet.p1(2);
        packet.p1(output);
        packet.p1(3);
        packet.pStringNoConversion(fromJsString('missing'), 0);
        packet.p1(4);
        packet.p4(-239);
        if (table !== 0) {
            packet.p1(table);
            packet.p2(count);
            for (let j = 0; j < count; j++) {
                packet.p4(j === 2 ? 1 : j);
                if (table === 5) packet.pStringNoConversion(fromJsString(j === 0 ? 'Aa' : 'BB'), 0);
                else packet.p4(j === 0 ? -71 : 32);
            }
        }
        packet.p1(0);
        const data = requireNonNull(packet.m_data).subarray(0, packet.m_pos);
        bytes(data);
        const type = new EnumType();
        type.Decode(new PacketT(data));
        EnumType.m_recentUse.Put(BigInt(id), type);
        for (const key of [-1, 0, 1, 2]) {
            calls.push([3400, 1, null, [id, key]], [3408, 0, null, [105, output, id, key]], [3408, 0, null, [105, output ^ 1, id, key]]);
        }
        for (const value of [32, -71, 55]) calls.push([3409, 0, null, [output, id, value]]);
        for (const value of ['Aa', 'BB', 'missing', '<null>']) calls.push([3410, 0, value, [id]]);
        calls.push([3411, 0, null, [id]]);
    }
    const wrongId = enumBase + enumShapes.length;
    Reflect.apply(EnumType.m_recentUse.Put, EnumType.m_recentUse, [BigInt(wrongId), new ClientScript()]);
    calls.push([3411, 0, null, [wrongId]], [3400, 1, null, [wrongId, 1]], [3410, 0, 'Aa', [wrongId]]);
    int(calls.length);
    for (const [op, result, value, operands] of calls) {
        int(op);
        int(result);
        parts.push(Buffer.of(+(value !== null)));
        if (value !== null) {
            const data = Buffer.from(value, 'ascii');
            const length = Buffer.alloc(2);
            length.writeUInt16BE(data.length);
            parts.push(length, data);
        }
        int(operands.length);
        for (const operand of operands) int(operand);
        const code = new ClientScript();
        const inputStrings = value === null ? [] : [value === '<null>' ? null : fromJsString(value)];
        code.opcodes = Int32Array.from([...operands.map(() => 0), ...inputStrings.map(() => 3), op, 0, 3, 21]);
        code.intOperands = Int32Array.from([...operands, ...inputStrings.map(() => 0), 0, 534821, 0, 0]);
        code.stringOperands = [...operands.map(() => null), ...inputStrings, null, null, fromJsString('after'), null];
        const event = new HookReq();
        event.args = [70001];
        let fault = 'ok';
        const vm = new ScriptRunner(
            () => code,
            error => {
                const cause = error.cause;
                fault = cause instanceof RangeError ? 'bounds' : cause instanceof TypeError ? (cause.message.startsWith('Expected') || cause.message.startsWith('ClassCastException') ? 'cast' : 'null') : 'runtime';
            }
        );
        ScriptRunner.intStack.fill(-732);
        ScriptRunner.stringStack.fill(null);
        vm.ExecuteScript(event, 1000);
        let ints = 1,
            strings = 1;
        for (let i = 0; i < 10; i++) {
            ints = mix(ints, ScriptRunner.intStack[i]);
            strings = mix(strings, hash(ScriptRunner.stringStack[i]));
        }
        expected.push([ints, strings, fault].join(' '));
    }
    for (const length of [-1, 0, 1, 2, 3, 16, 31]) {
        for (const capacity of [-1, 0, 1, 2, 8, 16, 31]) {
            const names = length < 0 ? null : Array.from({ length }, (_, i) => (i % 5 === 0 ? null : fromJsString(String((i * 3) % 4))));
            const ids = capacity < 0 ? null : Int16Array.from({ length: capacity }, (_, i) => 32766 + i);
            let outcome = 'ok';
            try {
                Client.sortSearchResults(ids, names);
            } catch (error) {
                if (!(error instanceof TypeError || error instanceof RangeError)) throw error;
                outcome = error instanceof TypeError ? 'null' : 'bounds';
            }
            expected.push([outcome, hash(names), hash(ids)].join(' '));
        }
    }
    ObjType.findWearables();
    const wearables = requireNonNull(ObjType.wearables);
    expected.push([wearables.length, hash(wearables)].join(' '));
    const appearances = [
        { slots: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], colours: [0, 0, 0, 0, 0], npc: -1 },
        { slots: [257, 258, 32768, 0, 0, 0, 0, 0, 263, 0, 0, 265], colours: [2, 3, 1, 2, 4], npc: -1 },
        { slots: [32768, 32769, 0, 0, 0, 0, 0, 0, 32771, 0, 0, 32790], colours: [3, 2, 12, 2, 5], npc: -1 },
        { slots: [], colours: [1, 2, 3, 1, 2], npc: 3 }
    ];
    const previousPalette = PlayerModel.recolourDestinations;
    PlayerModel.recolourDestinations = PlayerModel.recolourDestinationsRs;
    int(appearances.length);
    for (const ap of appearances) {
        const packet = new PacketT(96);
        packet.p1(0);
        packet.p1(0);
        packet.p1(0);
        if (ap.npc >= 0) {
            packet.p2(65535);
            packet.p2(ap.npc);
            packet.p1(0);
        } else
            for (const slot of ap.slots) {
                if (slot === 0) packet.p1(0);
                else packet.p2(slot);
            }
        for (const colour of ap.colours) packet.p1(colour);
        packet.p2(0);
        packet.p8(1n);
        packet.p1(3);
        packet.p1(3);
        packet.p1(255);
        packet.p1(0);
        bytes(requireNonNull(packet.m_data).subarray(0, packet.m_pos));
        const player = new ClientPlayer();
        player.readAppearance(packet);
        expected.push(String(requireNonNull(player.appearance).getHeadId()));
    }
    PlayerModel.recolourDestinations = previousPalette;
    const out = resolve(import.meta.dir, '../out');
    mkdirSync(out, { recursive: true });
    const scratch = mkdtempSync(join(out, 'entity-config-'));
    try {
        const jar = gamepackPath;
        const source = resolve(import.meta.dir, 'ui/EntityConfigOracle.java');
        const compile = Bun.spawnSync(['javac', '-cp', jar, '-d', scratch, source]);
        if (compile.exitCode) throw new Error(compile.stderr.toString());
        const records = join(scratch, 'archives.bin');
        writeFileSync(records, Buffer.concat(parts));
        const oracle = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', scratch + delimiter + jar, 'EntityConfigOracle'], { stdin: Bun.file(records), timeout: 60000 });
        if (oracle.exitCode) throw new Error(oracle.stderr.toString());
        expect(expected).toEqual(oracle.stdout.toString().trim().split(/\r?\n/));
    } finally {
        for (const cache of [ObjType.types, NpcType.m_recentUse, LocType.m_recentUse]) cache.Reset();
        rmSync(scratch, { recursive: true, force: true });
    }
}, 120000);
