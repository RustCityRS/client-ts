import { expect } from 'bun:test';
import { JavaError } from '#/util/JavaException.js';
import WrappedException from '#/util/WrappedException.js';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Js5 from '#/cache/Js5.js';
import Js5Index from '#/cache/Js5Index.js';
import HashTable from '#/datastruct/HashTable.js';
import Linkable from '#/datastruct/Linkable.js';
import Crc32 from '#/io/Crc32.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import SubInterface from '#/ui/SubInterface.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { readGroup } from './cachefile.js';
import { loginFixture } from './login-fixture.js';
import { cachePath, gamepackPath } from './reference.js';

type Case = [op: string, shape: string, payload: string, watch: string, occurrence: number, action: string, group: number, arg: number];

function vectors(): Case[] {
    const rows: Case[] = [];
    for (const op of ['init', 'reset', 'load', 'allocate', 'get', 'child', 'unload']) {
        for (const shape of ['empty', 'null', 'short', 'parent', 'mixed', 'drop', 'flag', 'noFlags', 'noOuter', 'zeroOuter', 'noArchive']) {
            for (const group of [-1, 0, 1, 2, 3])
                for (const arg of op === 'get' || op === 'child' ? [-2, -1, 0, 1, 2, 3] : [0]) {
                    rows.push([op, shape, 'ok', '-', 0, '-', group, arg]);
                }
        }
        for (const shape of ['empty', 'null', 'parent', 'mixed', 'flag']) {
            for (const payload of ['missing', 'empty', 'if1', 'if3', 'zero', 'negative', 'waiting', 'real']) {
                rows.push([op, shape, payload, '-', 0, '-', 1, 0]);
            }
        }
        const fields: Record<string, [string[], string[], number]> = {
            init: [['archive', 'limit'], ['archiveB', 'archiveNull', 'stop'], 3],
            reset: [['archive', 'limit'], ['archiveB', 'archiveNull', 'stop'], 3],
            load: [['archive', 'flags', 'outer', 'ready', 'cap', 'fetch0', 'fetch1', 'fetch2', 'decode0', 'decode1'], ['archiveB', 'archiveNull', 'outerB', 'outerNull', 'outerShort', 'rowB', 'rowNull', 'rowShort', 'flagsB', 'flagsShort', 'stop'], 8],
            allocate: [['archive', 'flags', 'outer', 'ready', 'cap'], ['archiveB', 'archiveNull', 'outerB', 'outerShort', 'flagsB', 'flagsShort', 'stop'], 3],
            get: [['outer', 'archive', 'fetch0'], ['outerB', 'outerNull', 'rowB', 'rowShort', 'archiveNull', 'stop'], 8],
            child: [['outer', 'kids'], ['outerB', 'rowShort', 'kidsShort', 'kidsNull', 'stop'], 4],
            unload: [['outer', 'flags', 'type', 'release'], ['archiveNull', 'outerB', 'outerShort', 'rowB', 'rowShort', 'rowNull', 'flagsB', 'flagsShort', 'keep', 'stop'], 12]
        };
        const [watch, actions, limit] = fields[op];
        const shapes = op === 'unload' ? ['mixed', 'drop', 'flag'] : op === 'child' ? ['parent'] : ['empty', 'null', 'parent'];
        for (const shape of shapes)
            for (const field of watch)
                for (const action of actions) {
                    for (let occurrence = 1; occurrence <= limit; occurrence++) rows.push([op, shape, 'ok', field, occurrence, action, 1, 0]);
                }
        for (const field of ['index', 'group'])
            for (const action of ['archiveB', 'archiveNull', 'outerB', 'flagsShort', 'stop']) {
                rows.push([op, 'empty', 'real', field, 1, action, 1, 0]);
            }
    }
    for (const shape of ['mixed', 'null', 'short'])
        for (const group of [-1, 0, 1, 2, 32768]) {
            for (let mode = 0; mode <= 4; mode++) {
                rows.push(['parent', shape, 'ok', '-', 0, '-', group, mode]);
                for (const field of ['parentId', 'outer'])
                    for (const action of ['parentId', 'outerB', 'stop']) {
                        for (const occurrence of [1, 2, 3]) rows.push(['parent', shape, 'ok', field, occurrence, action, group, mode]);
                    }
            }
        }
    return rows;
}

type WidgetRow = (IfType | null)[];
type Outer = (WidgetRow | null)[];
class Stop extends JavaError {}

function run(v: Case, realIndex: Js5Index, realGroup: Uint8Array): string {
    const [op, shape, payload, watch, occurrence, action, group, arg] = v;
    const calls: string[] = [],
        decoded: IfType[] = [];
    const ids = new Map<object, number>();
    let hits = 0,
        active = false;
    const id = (value: object | null): number => {
        if (value === null) return 0;
        const known = ids.get(value);
        if (known !== undefined) return known;
        const next = ids.size + 1;
        ids.set(value, next);
        return next;
    };
    function observe(field: string): void {
        if (!active || field !== watch || ++hits !== occurrence) return;
        active = false;
        try {
            switch (action) {
                case 'stop':
                    throw new Stop();
                case 'archiveB':
                    IfType.m_pInterfaces = b;
                    break;
                case 'archiveNull':
                    IfType.m_pInterfaces = null;
                    break;
                case 'outerB':
                    IfType.m_list = other;
                    break;
                case 'outerNull':
                    IfType.m_list = null;
                    break;
                case 'outerShort':
                    IfType.m_list = [null];
                    break;
                case 'rowB':
                    requireNonNull(IfType.m_list)[1] = second;
                    break;
                case 'rowNull':
                    requireNonNull(IfType.m_list)[1] = null;
                    break;
                case 'rowShort':
                    requireNonNull(IfType.m_list)[1] = [];
                    break;
                case 'flagsB':
                    IfType.m_open = altFlags;
                    break;
                case 'flagsShort':
                    IfType.m_open = [false];
                    break;
                case 'kidsShort':
                    parent.childSlots = [];
                    break;
                case 'kidsNull':
                    parent.childSlots = null;
                    break;
                case 'keep':
                    parent.type = 2;
                    break;
                case 'parentId':
                    subject.parentId = (1 << 16) + 2;
                    break;
                default:
                    throw new Error(action);
            }
        } finally {
            active = true;
        }
    }
    function callback(owner: string, method: string): void {
        calls.push(owner + method);
        observe(method);
    }
    function archive(name: string): Js5 {
        const arch = new Js5(
            {
                index() {
                    callback(name, 'index');
                    return realIndex;
                },
                group() {
                    callback(name, 'group');
                    return realGroup;
                },
                GetGroupLoadPercentage() {
                    throw new Error('unexpected group percentage');
                },
                prefetchGroup() {
                    throw new Error('unexpected prefetch');
                }
            },
            false,
            true
        );
        arch.GetGroupIdLimit = function () {
            callback(name, 'limit');
            return payload === 'real' ? Js5.prototype.GetGroupIdLimit.call(this) : payload === 'negative' ? -1 : name === 'a' ? 3 : 5;
        };
        arch.RequestGroupDownload = function (group) {
            callback(name, 'ready');
            return payload === 'real' ? Js5.prototype.RequestGroupDownload.call(this, group) : payload !== 'waiting';
        };
        arch.GetFileIdLimit = function (group) {
            callback(name, 'cap');
            return payload === 'real' ? Js5.prototype.GetFileIdLimit.call(this, group) : payload === 'zero' ? 0 : payload === 'negative' ? -1 : name === 'a' ? 3 : 2;
        };
        arch.GetFile = function (file, group) {
            callback(name, 'fetch' + file);
            if (payload === 'real') return Js5.prototype.GetFile.call(this, file, group);
            if (file === 1 && payload === 'missing') return null;
            if (file === 1 && payload === 'empty') return new Uint8Array(0);
            if (file === 1 && payload === 'if3') return Uint8Array.of(255, 3, 0, 75);
            if (file === 1 && payload === 'if1') return Uint8Array.of(3, 0, 0, 53, 1);
            const data = new Uint8Array(160);
            data[0] = 3;
            data[3] = (name === 'a' ? 10 : 50) + file;
            return data;
        };
        arch.DiscardFiles = function (group) {
            callback(name, 'release');
            if (payload === 'real') Js5.prototype.DiscardFiles.call(this, group);
        };
        return arch;
    }
    const a = archive('a'),
        b = archive('b');
    IfType.m_pSprites = IfType.m_pModels = IfType.m_pFontMetrics = b;
    IfType.m_pInterfaces = a;
    const parent = new IfType(),
        child = new IfType(),
        inventory = new IfType();
    const subject = new IfType();
    if (op === 'parent') {
        subject.id = (group << 16) + 12;
        subject.parentId = arg === 0 ? group << 16 : -1;
        InterfaceList.subInterfaces = new HashTable<SubInterface>(8);
        if (arg === 2 || arg === 3) {
            const sub = new SubInterface();
            sub.group = arg === 2 ? group & 65535 : group + 1;
            InterfaceList.subInterfaces.put(sub, (5n << 32n) + (1n << 16n));
        } else if (arg === 4) Reflect.apply(InterfaceList.subInterfaces.put, InterfaceList.subInterfaces, [new Linkable(), 3n]);
    }
    parent.id = 17;
    parent.type = 3;
    child.id = 23;
    child.type = 1;
    inventory.id = 37;
    inventory.type = 2;
    parent.childSlots = [child, null, parent];
    const first: WidgetRow = [null, null, null],
        second: WidgetRow = [child, null, inventory];
    const old: Outer = [null, first, null],
        other: Outer = [null, second, null];
    const flags = [false, false, false],
        altFlags = [true, false, true];
    IfType.m_list = old;
    IfType.m_open = flags;
    switch (shape) {
        case 'null':
            old[1] = null;
            break;
        case 'short':
            old[1] = [null];
            break;
        case 'parent':
            first[0] = parent;
            break;
        case 'mixed':
            first[0] = parent;
            first[2] = inventory;
            flags[1] = true;
            break;
        case 'drop':
            first[0] = parent;
            first[1] = child;
            flags[1] = true;
            break;
        case 'flag':
            old[1] = null;
            flags[1] = true;
            break;
        case 'noFlags':
            IfType.m_open = null;
            break;
        case 'noOuter':
            IfType.m_list = null;
            break;
        case 'zeroOuter':
            IfType.m_list = [];
            break;
        case 'noArchive':
            IfType.m_pInterfaces = null;
            break;
    }
    for (const value of [a, b, old, other, first, second, flags, altFlags, parent, child, inventory, parent.childSlots]) id(value);
    const slots: [object, string, string][] = [
        [IfType, 'm_pInterfaces', 'archive'],
        [IfType, 'm_list', 'outer'],
        [IfType, 'm_open', 'flags'],
        [parent, 'childSlots', 'kids'],
        [parent, 'type', 'type'],
        [child, 'type', 'type'],
        [inventory, 'type', 'type'],
        [subject, 'parentId', 'parentId']
    ];
    const restore: (() => void)[] = [];
    for (const [host, key, label] of slots) {
        const descriptor = requireNonNull(Object.getOwnPropertyDescriptor(host, key));
        let value: unknown = descriptor.value;
        Object.defineProperty(host, key, {
            configurable: true,
            enumerable: descriptor.enumerable,
            get() {
                observe(label);
                return value;
            },
            set(next) {
                value = next;
            }
        });
        restore.push(() => Object.defineProperty(host, key, { ...descriptor, value }));
    }
    for (const [key, format] of [
        ['Decode', 'if1'],
        ['Decode3', 'if3']
    ] as const) {
        const original = IfType.prototype[key];
        IfType.prototype[key] = function (packet) {
            const group = this.id >> 16,
                file = this.id & 65535;
            active = false;
            const published = IfType.m_list?.[group]?.[file] === this;
            const loaded = IfType.m_open?.[group] === true;
            active = true;
            calls.push(format + this.id + ':' + Number(published) + ':' + Number(loaded));
            decoded.push(this);
            observe('decode' + file);
            return original.call(this, packet);
        };
        restore.push(() => (IfType.prototype[key] = original));
    }
    const widget = (c: IfType | null): string => (c === null ? '-' : [id(c), c.id, c.type, +c.if3, c.clientCode, c.baseWidth].join(':'));
    const row = (r: WidgetRow | null): string => (r === null ? '-' : id(r) + ':' + r.length + '[' + r.slice(0, 4).map(widget).join(',') + ']');
    const outer = (o: Outer | null): string => (o === null ? '-' : id(o) + ':' + o.length + ':' + (o.length > 1 ? row(o[1]) : '-'));
    const mask = (f: boolean[] | null): string => (f === null ? '-' : id(f) + ':' + f.length + ':' + Number(f.length > 1 && f[1]));
    let result = 'ok';
    active = true;
    try {
        switch (op) {
            case 'init':
                IfType.Init(a, b, b, a);
                break;
            case 'reset':
                InterfaceList.reset();
                break;
            case 'load':
            case 'allocate':
                result = String(IfType.OpenInterface(group, op === 'allocate'));
                break;
            case 'get':
                result = 'id' + id(IfType.Get((group << 16) + arg));
                break;
            case 'child':
                result = 'id' + id(InterfaceList.GetComponent(group << 16, arg));
                break;
            case 'unload':
                IfType.CloseInterface(group);
                break;
            case 'parent':
                result = 'id' + id(InterfaceList.getParent(subject));
                break;
        }
    } catch (thrown) {
        const error = thrown instanceof WrappedException ? thrown.cause : thrown;
        if (error instanceof Stop) result = 'stop';
        else if (error instanceof TypeError) result = error.message.startsWith('ClassCastException') ? 'ClassCastException' : 'null';
        else if (error instanceof RangeError) result = /array length/i.test(error.message) ? 'size' : 'bounds';
        else throw error;
    } finally {
        active = false;
        for (const reset of restore) reset();
    }
    return [
        result,
        hits,
        calls.join(','),
        [IfType.m_pInterfaces, IfType.m_pSprites, IfType.m_pModels, IfType.m_pFontMetrics].map(id).join(','),
        outer(IfType.m_list),
        outer(old),
        outer(other),
        row(first),
        row(second),
        mask(IfType.m_open),
        mask(flags),
        mask(altFlags),
        decoded.slice(0, 4).map(widget).join(',')
    ].join(';');
}

loginFixture(
    import.meta.url,
    '530 interface group publication, retained rows, children and release order',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), '530-interface-group-order-'));
        try {
            const options = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED'];
            const cc = Bun.spawnSync(['javac', ...options, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'ui', 'InterfaceGroupOrderOracle.java')]);
            expect(cc.exitCode, cc.stderr.toString()).toBe(0);
            const args = ['java', ...options, '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'InterfaceGroupOrderOracle'];
            const patch = Bun.spawnSync([...args, dir]);
            expect(patch.exitCode, patch.stderr.toString()).toBe(0);
            const index = readGroup(cachePath, 255, 3),
                group = readGroup(cachePath, 3, 1);
            const realIndex = new Js5Index(index, Crc32.prefix(index, index.length));
            const indexFile = join(dir, 'interfaces.idx'),
                groupFile = join(dir, 'group.dat');
            writeFileSync(indexFile, index);
            writeFileSync(groupFile, group);
            const cases = vectors(),
                lines = cases.map(v => v.join(' '));
            const jvm = Bun.spawnSync([...args, indexFile, groupFile], { stdin: Buffer.from(lines.join('\n') + '\n'), maxBuffer: 16 * 1024 * 1024 });
            expect(jvm.exitCode, jvm.stderr.toString()).toBe(0);
            const result = jvm.stdout.toString().trimEnd().split(/\r?\n/);
            expect(result.length).toBe(cases.length);
            for (const [i, v] of cases.entries()) expect(run(v, realIndex, group), lines[i]).toBe(result[i]);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    60000
);
