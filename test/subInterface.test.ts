import DelayedStateChange from '#/ui/DelayedStateChange.js';
import { receivePacket } from './receive-packet.js';
import Client from '#/client/Client.js';
import LruHashTable from '#/datastruct/LruHashTable.js';
import { test, expect } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import HashTableIterator from '#/datastruct/HashTableIterator.js';
import PacketT from '#/io/PacketT.js';
import { ClientScript } from '#/script/ClientScript.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import Minimenu from '#/ui/Minimenu.js';
import InterfaceSession from '#/ui/InterfaceSession.js';
import InterfaceView from '#/ui/InterfaceView.js';
import ServerActiveProperties from '#/ui/ServerActiveProperties.js';
import { requireNonNull } from '#/util/JavaArray.js';
import WrappedException from '#/util/WrappedException.js';
import { localAssets, readGroup } from './cachefile.js';
import { cachePath, gamepackPath } from './reference.js';

const root = 596,
    a = 100,
    b = 101,
    c = 102;

function layoutHash(): number {
    let hash = 1,
        r = 0x530;
    for (let i = 0; i < 2048; i++) {
        const widget = new IfType();
        r = (Math.imul(r, 1664525) + 1013904223) | 0;
        const width = r >> (i % 31);
        r = (Math.imul(r, 1664525) + 1013904223) | 0;
        const height = r >> (i % 25);
        widget.heightMode = (i % 7) - 1;
        widget.widthMode = (((i / 7) | 0) % 7) - 1;
        widget.xMode = (((i / 3) | 0) % 8) - 1;
        widget.yMode = (((i / 11) | 0) % 8) - 1;
        widget.type = [0, 2, 7, 3][i & 3];
        widget.itemY = Math.imul(0x10003, i);
        widget.itemX = Math.imul(-0x10001, i);
        widget.baseWidth = r >> (i % 19);
        widget.baseHeight = r >> (i % 11);
        widget.baseX = width ^ r;
        widget.baseY = height ^ r;
        widget.aspectWidth = (i & 15) - 7;
        widget.aspectHeight = (i & 7) - 3;
        widget.properties = new ServerActiveProperties(i % 3, -1);
        widget.onResize = [1];
        Client.qaOpTest = (i & 1) !== 0;
        try {
            Client.InterfaceCalculateSize(widget, width, true, height);
            Client.InterfaceCalculatePosition(widget, -116, width, height);
        } catch (err) {
            if (!(err instanceof WrappedException && err.cause instanceof RangeError)) throw err;
            hash = (Math.imul(hash, 31) + 733) | 0;
        }
        for (const value of [widget.width, widget.height, widget.x, widget.y]) hash = (Math.imul(hash, 31) + value) | 0;
        hash = (Math.imul(hash, 31) + Number(requireNonNull(Client.m_hookQueue).takeFrontAndPop() !== null)) | 0;
    }
    Client.qaOpTest = false;
    return hash;
}

test('qd mount replacement, move, close, resize and callbacks agree with the gamepack', async () => {
    const assets = localAssets(cachePath, [3, 12]);
    new InterfaceSession(new InterfaceView([]), assets);
    Minimenu.isOpen = false;
    Minimenu.ResetMinimenu();
    const loaded = requireNonNull(IfType.m_open),
        rows = requireNonNull(IfType.m_list);
    const input: [number, Uint8Array][] = [];
    const frame = (op: number, write: (buf: PacketT) => void) => {
        const packet = new PacketT(16);
        write(packet);
        input.push([op, requireNonNull(packet.m_data).slice(0, packet.m_pos)]);
    };
    const pos = (i: number) => (root << 16) | i;
    const open = (parent: number, group: number, type: number) =>
        frame(155, p => {
            p.p1(type);
            p.p4_alt3(pos(parent));
            p.p2_alt2(3);
            p.p2(group);
        });
    const move = (from: number, dest: number) =>
        frame(176, p => {
            p.p4_alt2(pos(from));
            p.p2_alt2(4);
            p.p4_alt2(pos(dest));
        });
    const close = (parent: number) =>
        frame(149, p => {
            p.p2(5);
            p.p4(pos(parent));
        });
    frame(145, p => {
        p.p2_alt3(root);
        p.p1_alt1(0);
        p.p2_alt3(2);
    });
    open(0, a, 0);
    open(1, b, 1);
    open(0, a, 1);
    move(0, 1);
    move(1, 1);
    open(2, c, 0);
    move(1, 0);
    move(1, 0);
    close(1);
    close(2);

    const out = resolve(import.meta.dir, '../out');
    mkdirSync(out, { recursive: true });
    const tmp = mkdtempSync(join(out, 'subinterface-'));
    let lines: string[];
    try {
        const source = fileURLToPath(new URL('./ui/SubInterfaceOracle.java', import.meta.url));
        const build = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', tmp, source]);
        if (build.exitCode !== 0) throw Error(build.stderr.toString());
        const index = join(tmp, 'index.bin');
        writeFileSync(index, readGroup(cachePath, 255, 3));
        const cmd = ['java', '-Djava.awt.headless=true', '-cp', tmp + delimiter + gamepackPath, 'SubInterfaceOracle', index];
        for (const [op, data] of input) cmd.push(op + '-' + Buffer.from(data).toString('hex'));
        const run = Bun.spawnSync(cmd, { timeout: 20000 });
        if (run.exitCode !== 0) throw Error(run.stderr.toString());
        lines = run.stdout.toString().trim().split(/\r?\n/);
    } finally {
        rmSync(tmp, { recursive: true, force: true });
    }
    requireNonNull(Client.m_hookQueue).clear();
    expect(String(layoutHash())).toBe(requireNonNull(lines.shift()));
    const oldScriptCache = ClientScript.m_cache;
    ClientScript.m_cache = new LruHashTable<ClientScript>(128);
    const previousCycle = InterfaceList.cycle;
    InterfaceList.cycle = 10;
    try {
        for (const [group, count, marker] of [
            [root, 3, 1],
            [a, 1, 4],
            [b, 1, 5],
            [c, 1, 6]
        ]) {
            loaded[group] = true;
            rows[group] = Array.from({ length: count }, (_, i) => {
                const widget = new IfType();
                widget.id = (group << 16) | i;
                widget.type = group === root ? 0 : 3;
                widget.widthMode = widget.heightMode = group === root ? 0 : 1;
                widget.baseWidth = 101 + i * 4;
                widget.baseHeight = 73 - i;
                widget.drawCycle = InterfaceList.cycle;
                widget.rootIndex = i + marker * 3;
                widget.onLoad = [9001, marker];
                widget.onSubChange = [9001, marker + i];
                widget.onResize = [9001, marker];
                return widget;
            });
        }
        requireNonNull(IfType.m_pInterfaces).RequestGroupDownload = () => false;
        const script = new ClientScript();
        script.opcodes = Int32Array.of(42, 0, 4002, 33, 4000, 43, 21);
        script.intOperands = Int32Array.of(2, 10, 0, 0, 0, 2, 0);
        script.stringOperands = new Array(7).fill(null);
        script.intLocals = 1;
        ClientScript.m_cache.Put(9001n, script);
        for (const [op, bytes] of input) {
            InterfaceList.dirty.fill(false);
            DelayedStateChange.varcs[2] = 0;
            InterfaceList.pressedContinue = requireNonNull(IfType.Get(pos(2)));
            const prior = InterfaceList.subInterfaces.get(BigInt(pos(0)));
            await receivePacket(op, bytes);
            const mounted: string[] = [],
                iterator = new HashTableIterator(InterfaceList.subInterfaces);
            for (let node = iterator.head(); node !== null; node = iterator.next()) mounted.push([node.key, node.type, node.group].join('/'));
            const sample: (boolean | string | number)[] = [mounted.join(','), !!prior?.IsLinked(), DelayedStateChange.varcs[2], InterfaceList.pressedContinue !== null];
            sample.push(InterfaceList.dirty.reduce((h, flag) => (Math.imul(h, 31) + Number(flag)) | 0, 1));
            for (const group of [root, a, b, c]) {
                sample.push(loaded[group]);
                for (const widget of rows[group] ?? []) if (widget) sample.push(widget.width + '/' + widget.height);
            }
            for (let event = requireNonNull(Client.m_hookQueue).takeFrontAndPop(); event !== null; event = requireNonNull(Client.m_hookQueue).takeFrontAndPop()) sample.push(requireNonNull(event.component).id);
            expect(sample.join('|')).toBe(requireNonNull(lines.shift()));
        }
    } finally {
        ClientScript.m_cache = oldScriptCache;
        InterfaceList.cycle = previousCycle;
        InterfaceList.dirty.fill(false);
        InterfaceList.pressedContinue = null;
        InterfaceList.subInterfaces.clear();
        requireNonNull(Client.m_hookQueue).clear();
    }
    expect(lines).toEqual([]);
}, 30000);
