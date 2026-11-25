import DelayedStateChange from '#/ui/DelayedStateChange.js';
import PacketT from '#/io/PacketT.js';
import { receivePacket } from './receive-packet.js';
import { afterEach, beforeEach, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { requireNonNull } from '#/util/JavaArray.js';
import Client from '#/client/Client.js';
import HashTable from '#/datastruct/HashTable.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import ServerActiveProperties from '#/ui/ServerActiveProperties.js';
import InterfaceSession from '#/ui/InterfaceSession.js';
import InterfaceView from '#/ui/InterfaceView.js';
import { localAssets, readGroup } from './cachefile.js';
import { cachePath, gamepackPath } from './reference.js';

let savedProperties: HashTable<ServerActiveProperties>;
beforeEach(() => {
    savedProperties = Client.serverActiveProperties;
    Client.serverActiveProperties = new HashTable<ServerActiveProperties>(512);
});
afterEach(() => {
    Client.serverActiveProperties = savedProperties;
});

test('GetActive follows component ID changes and current server overrides', () => {
    const c = component(0x12345678);
    c.childId = -1;
    const first = new ServerActiveProperties(1, 1);
    const second = new ServerActiveProperties(2, 2);
    Client.serverActiveProperties.put(first, 0x12345677ffffffffn);
    Client.serverActiveProperties.put(second, -0x7ffffffffffffffdn);
    expect(Client.GetActive(c)).toBe(first);
    c.childId = 3;
    expect(Client.GetActive(c)).toBe(c.properties);
    c.id = -2147483648;
    expect(Client.GetActive(c)).toBe(second);
    second.Unlink();
    expect(Client.GetActive(c)).toBe(c.properties);
});

function component(id: number): IfType {
    const c = new IfType();
    c.id = id;
    return c;
}

function properties(): number[] {
    const hashes = new Int32Array(12).fill(1);
    const add = (index: number, value: number | boolean) => {
        hashes[index] = (Math.imul(31, hashes[index]) + Number(value)) | 0;
    };
    let mask = 0x530;
    for (let i = 0; i < 4096; i++) {
        const bits = i < 32 ? 1 << i : i < 64 ? ~(1 << (i - 32)) : mask;
        const p = new ServerActiveProperties(bits, i - 1);
        add(0, p.events);
        add(1, p.targetParam);
        add(2, p.getTargetMask());
        add(3, p.canUseObj());
        add(4, p.canSwapObjs());
        add(5, p.ServerDraggable());
        for (let op = -2; op <= 32; op++) add(6, p.isOpEnabled(op));
        add(7, p.hasObjOps());
        add(8, p.canTarget());
        add(9, p.canResume());
        add(10, p.canReplaceObj());
        add(11, p.isDragTarget());
        mask = (Math.imul(mask, 1664525) + 1013904223) | 0;
    }
    return Array.from(hashes);
}

test('l event properties and qg/ad delayed group and component lookup agree with the gamepack', async () => {
    const directory = cachePath;
    const jar = gamepackPath;
    const group = 596;
    const packets = ['165-1000000002540000ff7f9bdf1357', '9-92340000540200910100ff7f', '165-12000100025400000080beefdead'];
    const out = resolve(import.meta.dir, '../out');
    mkdirSync(out, { recursive: true });
    const scratch = mkdtempSync(join(out, 'interface-foundation-'));
    let lines: string[];
    try {
        const path = fileURLToPath(new URL('./ui/InterfaceFoundationOracle.java', import.meta.url));
        const compile = Bun.spawnSync(['javac', '-cp', jar, '-d', scratch, path], { timeout: 20000 });
        if (compile.exitCode) throw new Error(compile.stderr.toString());
        const indexFile = join(scratch, 'index.dat'),
            groupFile = join(scratch, 'group.dat');
        writeFileSync(indexFile, readGroup(directory, 255, 3));
        writeFileSync(groupFile, readGroup(directory, 3, group));
        const run = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', scratch + delimiter + jar, 'InterfaceFoundationOracle', String(group), indexFile, groupFile, ...packets], { timeout: 20000 });
        if (run.exitCode) throw new Error(run.stderr.toString());
        lines = run.stdout.toString().trim().split(/\r?\n/);
    } finally {
        rmSync(scratch, { recursive: true, force: true });
    }
    expect(properties()).toEqual(JSON.parse(lines[0]));

    const assets = localAssets(directory, [3]);
    const archive = assets.archive(3);
    const isReady = archive.RequestGroupDownload.bind(archive);
    let ready = false;
    archive.RequestGroupDownload = id => ready && isReady(id);
    const loaded = requireNonNull(IfType.m_open),
        rows = requireNonNull(IfType.m_list);
    const first = group << 16;
    expect([IfType.OpenInterface(group), !IfType.Get(first), loaded[group]].join(',')).toBe(lines[1]);
    ready = true;
    expect([IfType.OpenInterface(group, true), requireNonNull(rows[group]).length, loaded[group]].join(',')).toBe(lines[2]);
    const preserved = component(first);
    requireNonNull(rows[group])[0] = preserved;
    expect([IfType.OpenInterface(group), IfType.Get(first) === preserved, loaded[group]].join(',')).toBe(lines[3]);
    let ids = 1,
        contents = 1;
    for (let i = 0; i < requireNonNull(rows[group]).length; i++) {
        const c = IfType.Get(first | i);
        ids = (Math.imul(31, ids) + (c?.id ?? -1)) | 0;
        contents = (Math.imul(31, contents) + (c ? c.clientCode * 256 + c.type : -1)) | 0;
    }
    expect([ids, contents].join(',')).toBe(lines[4]);
    ready = false;
    expect([IfType.OpenInterface(group), IfType.Get(first) === preserved].join(',')).toBe(lines[5]);
    preserved.type = 2;
    IfType.CloseInterface(group);
    const unloaded = [loaded[group], requireNonNull(rows[group])[0] === preserved, !requireNonNull(rows[group])[1]].join(',');

    const uiAssets = localAssets(directory, [3]);
    const uiArchive = uiAssets.archive(3);
    const uiReady = uiArchive.RequestGroupDownload.bind(uiArchive);
    uiArchive.RequestGroupDownload = id => ready && uiReady(id);
    const ui = new InterfaceSession(new InterfaceView([]), uiAssets);
    expect(IfType.Get(first)).toBeNull();
    ready = true;
    const parent = requireNonNull(IfType.Get(first));
    parent.properties = new ServerActiveProperties(767, 12345);
    let line = 6;
    let otherSession: InterfaceSession | null = null;
    for (const packet of packets) {
        const [opcode, body] = packet.split('-');
        expect(await receivePacket(Number(opcode), Buffer.from(body, 'hex'))).toBe(true);
        for (let child = -1; child <= 1; child++) {
            const c = child === -1 ? parent : component(first);
            c.childId = child;
            const p = Client.GetActive(c);
            expect([p.events, p.targetParam].join(',')).toBe(lines[line++]);
            if (otherSession === null) {
                otherSession = new InterfaceSession(new InterfaceView([]), uiAssets);
                expect(Client.GetActive(c)).toBe(p);
            }
        }
    }
    expect(unloaded).toBe(lines[line++]);

    // The fixture script appends its argument to varc 2. Both interpreters execute it.
    const script = Buffer.from(['00', '002a00000002', '00000000000a', '0fa200', '002100000000', '0fa000', '002b00000002', '001500', '000000070001000000000000000001'].join(''), 'hex');
    const scripts = uiAssets.archive(12);
    const file = scripts.GetFile.bind(scripts);
    scripts.GetFile = (f, g) => (f === 0 && g === 9001 ? script : file(f, g));
    for (let i = 0; i < requireNonNull(requireNonNull(uiAssets.index(3)).fileCapacities)[group]; i++) {
        const c = IfType.Get(first | i);
        if (c) c.onLoad = c.onSubChange = c.onDialogAbort = null;
    }
    const hook = (c: IfType, child: number, mark: number) => {
        c.type = 3;
        c.childId = child;
        c.onLoad = c.onSubChange = c.onDialogAbort = [9001, mark];
        return c;
    };
    hook(parent, -1, 4);
    parent.type = 0;
    parent.childSlots = [hook(component(first), 0, 1), null, hook(component(first), 8, 2), hook(component(first), 0, 3)];
    hook(requireNonNull(IfType.Get(first + 1)), -1, 5);
    DelayedStateChange.varcs[2] = 0;
    const top = new PacketT(5);
    top.p2_alt3(group);
    top.p1_alt1(0);
    top.p2_alt3(3);
    await receivePacket(145, requireNonNull(top.m_data));
    expect(DelayedStateChange.varcs[2]).toBe(Number(lines[line++]));
    DelayedStateChange.varcs[2] = 0;
    await receivePacket(209, new Uint8Array(0));
    expect(DelayedStateChange.varcs[2]).toBe(Number(lines[line++]));
    DelayedStateChange.varcs[2] = 0;
    Client.RunHookImmediate(InterfaceList.top, 1, ui.runner);
    expect(DelayedStateChange.varcs[2]).toBe(Number(lines[line++]));
    Client.PurgeServerActive(group);
    for (let child = -1; child <= 1; child++) {
        const c = component(first);
        c.childId = child;
        const p = Client.GetActive(c);
        expect([p.events, p.targetParam].join(',')).toBe(lines[line++]);
    }
}, 30000);
