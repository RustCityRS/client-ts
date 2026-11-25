import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import GameShell from '#/client/GameShell.js';
import HashTable from '#/datastruct/HashTable.js';
import Linkable from '#/datastruct/Linkable.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import SubInterface from '#/ui/SubInterface.js';
import { requireNonNull } from '#/util/JavaArray.js';
import WrappedException from '#/util/WrappedException.js';
import { loginFixture } from './login-fixture.js';
import { gamepackPath } from './reference.js';

type Entry = 'component' | 'subcomponents' | 'group' | 'all';
type Row = [Entry, number, number, boolean];
function sample([entry, mode, fail, resize]: Row): string {
    const trace: string[] = [],
        hits = new Map<string, number>(),
        undo: (() => void)[] = [];
    let active = false;
    function widget(id: number, parentId: number, marker: number): IfType {
        const c = new IfType();
        Object.assign(c, { id, parentId, type: marker === 1 ? 0 : 3, widthMode: 1, heightMode: 1, baseWidth: marker * 5, baseHeight: marker * 2, width: 60 + marker, height: 30 + marker });
        return c;
    }
    const root = widget(65536, -1, 1),
        child = widget(65537, root.id, 2),
        dynamic = widget(65536, root.id, 3),
        mounted = widget(131072, -1, 4);
    const original = [root, null, child],
        linked = [mounted],
        kids = [null, dynamic],
        alternate = [child, mounted];
    root.childSlots = kids;
    root.scrollWidth = mode === 1 ? 0 : 123;
    root.scrollHeight = mode === 1 ? 0 : 94;
    IfType.m_list = [null, original, linked];
    IfType.m_open = [false, true, true];
    InterfaceList.subInterfaces = new HashTable<SubInterface>(8);
    const sub = new SubInterface();
    sub.group = 2;
    Reflect.apply(InterfaceList.subInterfaces.put, InterfaceList.subInterfaces, [mode === 9 ? new Linkable() : sub, BigInt(root.id)]);
    if (mode === 4) IfType.m_list = null;
    if (mode === 5) requireNonNull(IfType.m_list)[1] = null;
    if (mode === 8) Reflect.set(InterfaceList, 'subInterfaces', null);
    if (mode === 10) root.id = -65536;
    GameShell.m_sWid = 301;
    GameShell.m_sHei = 150;
    InterfaceList.top = 1;
    Client.qaOpTest = false;
    const subject = mode === 14 ? null : entry === 'component' && (mode === 1 || mode === 16) ? child : root;
    function read(key: string) {
        trace.push(key);
        const n = (hits.get(key) ?? 0) + 1;
        hits.set(key, n);
        if (fail > 0 && --fail === 0) throw Error('probe');
        if (mode === 2 && n === 1 && key === 'aj.ld') root.scrollWidth = 197;
        if (mode === 2 && n === 1 && key === 'aj.jb') root.scrollHeight = -56;
        if (mode === 3 && n === 1 && key === 'aj.Kc') root.id = 2 << 16;
        if (mode === 6 && n === 1 && key === 'aj.pb') root.childSlots = null;
        if (mode === 7 && n === 1 && key === 'aj.pb') root.childSlots = alternate;
        if (mode === 15 && key === 'fl.l') GameShell.m_sWid = -321;
        if (mode === 16 && key === 'aj.C') root.height = -43;
        if (mode === 17 && key === 'fk.ab') IfType.m_list = null;
    }
    function watch<T extends object, K extends keyof T>(o: T, k: K, tag: string) {
        const descriptor = requireNonNull(Object.getOwnPropertyDescriptor(o, k));
        let value = o[k];
        Object.defineProperty(o, k, {
            configurable: true,
            get() {
                const old = value;
                if (active) read(tag);
                return old;
            },
            set(v: T[K]) {
                value = v;
            }
        });
        undo.push(() => Object.defineProperty(o, k, { ...descriptor, value }));
    }
    function replace<T extends object, K extends keyof T>(o: T, k: K, f: T[K]) {
        const prev = o[k];
        o[k] = f;
        undo.push(() => {
            o[k] = prev;
        });
    }
    // The classfile watchpoints observe just the selected entry method. Its callees execute unchanged.
    function nested<T>(run: () => T): T {
        const prev = active;
        active = false;
        try {
            return run();
        } finally {
            active = prev;
        }
    }
    for (const [key, tag] of [
        ['width', 'aj.C'],
        ['height', 'aj.H'],
        ['scrollWidth', 'aj.ld'],
        ['scrollHeight', 'aj.jb'],
        ['id', 'aj.Kc'],
        ['childSlots', 'aj.pb']
    ] as const)
        watch(root, key, tag);
    watch(GameShell, 'm_sHei', 'fl.l');
    watch(GameShell, 'm_sWid', 'hi.f');
    watch(InterfaceList, 'top', 'hd.m');
    watch(IfType, 'm_list', 'fk.ab');
    watch(InterfaceList, 'subInterfaces', 'va.Z');
    watch(sub, 'group', 'qd.v');
    const getParent = InterfaceList.getParent.bind(InterfaceList),
        get = InterfaceList.subInterfaces?.get;
    replace(InterfaceList, 'getParent', c => nested(() => getParent(c)));
    if (get) {
        const table = InterfaceList.subInterfaces;
        replace(table, 'get', key => nested(() => get.call(table, key)));
    }
    const children = Client.InterfaceCalculateSizeAndPosArray,
        group = Client.InterfaceCalculateSizeAndPosInterface;
    const open = IfType.OpenInterface.bind(IfType),
        size = Client.InterfaceCalculateSize,
        position = Client.InterfaceCalculatePosition;
    replace(Client, 'InterfaceCalculateSizeAndPosArray', (w, h, id, row, resize) => {
        if (active) trace.push('children:' + w + ',' + h + ',' + id + ',' + (row === null ? 'null' : row === original ? 'R' : row === linked ? 'L' : row === kids ? 'K' : row === alternate ? 'A' : '?') + ',' + resize);
        nested(() => children(w, h, id, row, resize));
    });
    if (entry !== 'group')
        replace(Client, 'InterfaceCalculateSizeAndPosInterface', (resize, h, w, id) => {
            if (active) trace.push('group:' + resize + ',' + h + ',' + w + ',' + id);
            nested(() => group(resize, h, w, id));
        });
    replace(IfType, 'OpenInterface', (id, allocate) => {
        if (!active) return open(id, allocate);
        trace.push('open:' + id + ',' + allocate);
        if (mode === 13) return false;
        return nested(() => {
            const answer = open(id, allocate);
            if (mode === 11) IfType.m_list = null;
            if (mode === 12) requireNonNull(IfType.m_list)[id] = alternate;
            return answer;
        });
    });
    replace(Client, 'InterfaceCalculateSize', (c, w, resize, h) => {
        if (active) trace.push('size:' + w + ',' + resize + ',' + h);
        nested(() => size(c, w, resize, h));
    });
    replace(Client, 'InterfaceCalculatePosition', (c, guard, w, h) => {
        if (active) trace.push('position:' + guard + ',' + w + ',' + h);
        nested(() => position(c, guard, w, h));
    });
    let status = 'ok';
    active = true;
    try {
        switch (entry) {
            case 'component':
                Reflect.apply(Client.InterfaceCalculateSizeAndPosComponent, Client, [subject]);
                break;
            case 'subcomponents':
                Reflect.apply(Client.InterfaceCalculateSizeAndPosSubcomponents, Client, [resize, subject]);
                break;
            case 'group':
                Client.InterfaceCalculateSizeAndPosInterface(resize, -23, 49, 1);
                break;
            case 'all':
                Client.InterfaceCalculateSizeAndPosAll(resize);
                break;
        }
    } catch (error) {
        let cause = error;
        while (cause instanceof WrappedException) cause = cause.cause;
        if (cause instanceof TypeError) status = cause.message.startsWith('ClassCastException') ? 'cast' : 'null';
        else if (cause instanceof RangeError) status = 'bounds';
        else if (cause instanceof Error && cause.message === 'probe') status = 'probe';
        else throw error;
    } finally {
        active = false;
        for (const reset of undo.reverse()) reset();
    }
    return [status, trace.join(';'), [root, child, dynamic, mounted].flatMap(c => [c.width, c.height]).join(',')].join('|');
}

loginFixture(
    import.meta.url,
    'layout dispatch matches original field ordering, nullable rows and attached interface casts',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-layout-dispatch-'));
        try {
            const flags = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED', '--add-exports', 'java.base/jdk.internal.org.objectweb.asm.tree=ALL-UNNAMED'];
            const compile = Bun.spawnSync(['javac', ...flags, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'ui', 'LayoutCallThroughOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const rows: Row[] = [];
            for (const entry of ['component', 'subcomponents', 'group', 'all'] as const)
                for (let mode = 0; mode < 18; mode++)
                    for (const resize of [false, true]) {
                        rows.push([entry, mode, 0, resize]);
                        if (mode === 0 || mode === 1) for (let fail = 1; fail <= 15; fail++) rows.push([entry, mode, fail, resize]);
                    }
            const oracle = Bun.spawnSync(['java', ...flags, '-cp', dir + delimiter + gamepackPath, 'LayoutCallThroughOracle'], { stdin: Buffer.from(rows.map(r => r.join(' ')).join('\n') + '\n') });
            expect(oracle.exitCode, oracle.stderr.toString()).toBe(0);
            const expected = oracle.stdout.toString().trimEnd().split(/\r?\n/);
            expect(expected).toHaveLength(rows.length);
            for (const [i, row] of rows.entries()) expect(sample(row), row.join(' ')).toBe(expected[i]);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    30000
);
