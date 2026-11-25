import Client from '#/client/Client.js';
import { receivePacket } from './receive-packet.js';
import ObjType from '#/config/ObjType.js';
import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import ClientInvCache from '#/client/ClientInvCache.js';
import InvType from '#/config/InvType.js';
import PacketT from '#/io/PacketT.js';
import SuperPacket from '#/io/SuperPacket.js';
import { intQuery } from './int-query.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { localAssets, readGroup } from './cachefile.js';
import { cachePath, gamepackPath } from './reference.js';

test('he containers, all group 5 pj definitions, 3300-series queries and rg inventory packets match the gamepack', async () => {
    const assets = localAssets(cachePath, [2, 3]);
    const archive = assets.archive(2);
    const originalTop = InterfaceList.top;
    const originalRing = Client.changedInvs,
        originalChanges = Client.invTransmitCount;
    InterfaceList.top = -1;
    const incoming = new SuperPacket(5000);
    const component = new IfType();
    component.id = 65536;
    component.drawCycle = InterfaceList.cycle;
    component.rootIndex = 2;
    IfType.m_list = [null, [component]];
    IfType.m_open = [false, true];
    const originalCount = ObjType.m_numDefinitions;
    ObjType.m_numDefinitions = 0;
    Client.invTransmitCount = 0;
    Client.changedInvs = new Int32Array(32);
    const ints = (array: Int32Array | null) => (array === null ? '~' : array.join(','));
    const partial = 'wire 22 000100000001';
    const full = 'wire 105 000100000001';
    const commands = [
        'defs',
        'raw',
        'raw ff00',
        'raw 0201',
        'raw 02ffff02000000',
        'raw 020102ff',
        'config 60000 1',
        'obj 2 f9020000000500000007000000068000000000',
        'obj 3 f90100000005ffffffff00',
        'obj 4 f90101000005780000',
        'read -1 -1',
        'free -1',
        'state 60000',
        'free 60000',
        'set 60000 -1 2 1',
        'state 60000',
        'set 60000 5 2 2147483647',
        'set 60000 1 2 3',
        'set 60000 2 3 4',
        'set 60000 0 19000 9',
        'state 60000',
        'read 60000 2',
        'read 60000 4',
        'read 60000 -1',
        'read 60000 6',
        'total 0 60000 2',
        'total 2 60000 2',
        'total -1 60000 2',
        'total -1 60000 -1',
        'free 60000',
        'param 60000 5 0',
        'param 60000 5 1',
        'param 60000 6 1',
        'param 60000 112 0',
        'script 3301 60000 5',
        'script 3302 60000 5',
        'script 3303 60000 2',
        'script 3304 60000',
        'script 3330 60000',
        'script 3331 60000 5',
        'script 3332 60000 5',
        'set 60000 4 4 5',
        'param 60000 5 1',
        'set 32775 2 2 8',
        'script 3313 7 2',
        'script 3314 7 2',
        'script 3315 7 2',
        'script 3313 2147483647 2',
        'save 60000',
        'clear 60000',
        'identity 60000',
        'state 60000',
        'set 60000 6 9 3',
        'identity 60000',
        'remove 60000',
        'identity 60000',
        'state 60000',
        'save 32775',
        'reset',
        'identity 32775',
        'state 32775',
        'view 3 3',
        full + '00047b000381ffffffff00047f0000800005',
        'state 1',
        partial + '000000020004ff123456788082000300',
        'state 1',
        'wire 144 01000000',
        'state 1',
        full + '0001000002',
        'state 1',
        full + '0000',
        'state 1',
        'wire 191 0100',
        'state 1',
        'wire 22 fffeee8f00070000030a',
        'state 32775',
        'wire 22 fffeee9000070000030b',
        'state 7',
        'view 3 1',
        full + '00027f00037e0004',
        'state 1',
        partial + '01000401',
        'state 1',
        'view - -',
        partial + '00000307',
        'state 1',
        'view 0 -',
        full + '0001870002',
        'state 1',
        'view 4 4',
        full + '00017f0003',
        partial + '00',
        'state 1'
    ];
    // Verify wraparound of the b.I/pa.zb transmit history.
    for (let i = 0; i < 34; i++) commands.push('wire 191 ' + (i + 1).toString(16).padStart(2, '0') + '80');
    for (const [length, cursor] of [
        ['-', 0],
        ['0', -1],
        ['31', 0x7fffffff],
        ['32', 0x7fffffff],
        ['1', -0x80000000]
    ] as const) {
        for (const command of [full + '00017f0003', partial + '00000307', 'wire 191 0100', 'wire 144 01000000']) {
            commands.push('ring ' + length + ' ' + cursor, command, 'state 1');
        }
    }
    const out = resolve(import.meta.dir, '../out');
    mkdirSync(out, { recursive: true });
    const dir = mkdtempSync(join(out, 'inv-'));
    try {
        writeFileSync(join(dir, 'index'), readGroup(cachePath, 255, 2));
        writeFileSync(join(dir, 'group'), readGroup(cachePath, 2, 5));
        const compile = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game', 'InventoryOracle.java')]);
        if (compile.exitCode) throw Error(compile.stderr.toString());
        const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'InventoryOracle', dir], { stdin: Buffer.from(commands.join('\n') + '\n'), timeout: 20000 });
        if (java.exitCode) throw Error(java.stderr.toString());
        const expected = java.stdout.toString().replace(/\r/g, '').split('\n');
        expect(expected.length).toBe(commands.length + 1);
        expect(expected[0].split(',').length).toBe(549);
        expect(archive.GetFileList(5)?.length).toBe(546);
        const failures = commands.filter((_, i) => expected[i] === 'exception');
        expect(failures).toEqual(['set 60000 -1 2 1', 'total -1 60000 2', 'param 60000 5 1']);
        let saved: ClientInvCache | null = null,
            savedIds: Int32Array | null = null,
            savedCounts: Int32Array | null = null;
        let savedTable = ClientInvCache.m_invList;
        async function execute(words: string[]): Promise<string> {
            const [op, a, b, c, d] = words;
            switch (op) {
                case 'ring':
                    Client.changedInvs = a === '-' ? null : new Int32Array(+a);
                    Client.invTransmitCount = +b;
                    return '';
                case 'defs':
                    return Array.from({ length: archive.GetFileIdLimit(5) + 1 }, (_, i) => InvType.List(i).m_size).join(',');
                case 'raw': {
                    const type = new InvType(),
                        packet = new PacketT(Buffer.from(a ?? '', 'hex'));
                    let ok = true;
                    try {
                        type.Decode(packet);
                    } catch {
                        ok = false;
                    }
                    return [ok, packet.m_pos, type.m_size].join(';');
                }
                case 'config': {
                    const type = new InvType();
                    type.m_size = +b;
                    InvType.m_recentUse.Put(BigInt(a), type);
                    return '';
                }
                case 'obj': {
                    const type = new ObjType();
                    type.Decode(new PacketT(Buffer.from(b, 'hex')));
                    ObjType.types.Put(BigInt(a), type);
                    ObjType.m_numDefinitions = Math.max(ObjType.m_numDefinitions, +a + 1);
                    return '';
                }
                case 'view':
                    component.itemIds = a === '-' ? null : new Int32Array(+a).fill(27);
                    component.itemCounts = b === '-' ? null : new Int32Array(+b).fill(58);
                    InterfaceList.dirty[2] = false;
                    return '';
                case 'set':
                    ClientInvCache.Set(+c, +a, +d, +b);
                    return '';
                case 'read':
                    return [ClientInvCache.GetType(+a, +b), ClientInvCache.GetCount(+a, +b)].join(',');
                case 'total':
                    return String(ClientInvCache.InvTotal(+a, +b, +c));
                case 'param':
                    return String(ClientInvCache.GetParamCount(+b, +a, +c !== 0));
                case 'clear':
                    ClientInvCache.Blank(+a);
                    return '';
                case 'remove':
                    ClientInvCache.Delete(+a);
                    return '';
                case 'free':
                    return String(ClientInvCache.GetFreeSpace(+a));
                case 'state': {
                    const container = ClientInvCache.m_invList.get(BigInt(a));
                    return container === null ? '~' : ints(container.ids) + '/' + ints(container.counts);
                }
                case 'reset':
                    ClientInvCache.DeleteAll();
                    return '';
                case 'save':
                    savedTable = ClientInvCache.m_invList;
                    saved = requireNonNull(savedTable.get(BigInt(a)));
                    savedIds = saved.ids;
                    savedCounts = saved.counts;
                    return '';
                case 'identity':
                    return [savedTable === ClientInvCache.m_invList, saved === ClientInvCache.m_invList.get(BigInt(a)), requireNonNull(saved).IsLinked(), savedIds === saved?.ids, savedCounts === saved?.counts].join(',');
                case 'script':
                    return String(intQuery(+a, words.slice(2).map(Number)));
                case 'wire': {
                    const bytes = Buffer.from(b, 'hex');
                    let ok = true;
                    try {
                        ok = await receivePacket(+a, bytes, incoming);
                    } catch {
                        ok = false;
                    }
                    return [ok, incoming.m_pos, ints(component.itemIds), ints(component.itemCounts), InterfaceList.dirty[2], Client.invTransmitCount, ints(Client.changedInvs)].join(';');
                }
                default:
                    throw Error(op);
            }
        }
        for (let i = 0; i < commands.length; i++) {
            let result: string;
            try {
                result = await execute(commands[i].split(' '));
            } catch {
                result = 'exception';
            }
            expect(result, commands[i]).toBe(expected[i]);
        }
    } finally {
        InterfaceList.top = originalTop;
        InterfaceList.reset();
        ClientInvCache.DeleteAll();
        InvType.m_recentUse.Reset();
        ObjType.types.Reset();
        ObjType.m_numDefinitions = originalCount;
        Client.changedInvs = originalRing;
        Client.invTransmitCount = originalChanges;
        rmSync(dir, { recursive: true, force: true });
    }
}, 30000);
