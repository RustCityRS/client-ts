import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import ObjType from '#/config/ObjType.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import PlayerModel from '#/dash3d/PlayerModel.js';
import HashTable from '#/datastruct/HashTable.js';
import Linkable from '#/datastruct/Linkable.js';
import PacketT from '#/io/PacketT.js';
import Protocol from '#/io/Protocol.js';
import WrappedException from '#/util/WrappedException.js';
import SuperPacket from '#/io/SuperPacket.js';
import DelayedStateChange from '#/ui/DelayedStateChange.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import ServerActiveProperties from '#/ui/ServerActiveProperties.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { gamepackPath } from './reference.js';
import { supplyPacket } from './receive-packet.js';

type Row = { op: number; mode: number; body: Uint8Array; capacity: number };

function vectors(): Row[] {
    const rows: Row[] = [];
    for (const mode of [0, 1, 2, 3, 4, 5, 8, 9, 12, 16, 17, 18, 19]) {
        const id = mode === 2 ? -1 : mode === 3 ? 1 : mode === 5 ? 65536 : 0,
            verify = (0xfffb + mode) & 65535;
        function add(op: number, write: (p: PacketT) => void) {
            if (mode >= 16 && ![9, 165, 149, 155, 176].includes(op)) return;
            const p = new PacketT(64);
            write(p);
            const payload = requireNonNull(p.m_data).slice(0, p.m_pos);
            for (let n = 0; n <= payload.length; n++) {
                const body = payload.subarray(0, n);
                rows.push({ op, mode, body, capacity: n });
                // The live packet buffer usually retains bytes beyond the on-wire length.
                if (n !== payload.length) rows.push({ op, mode, body, capacity: payload.length });
            }
        }
        if (mode >= 16) {
            const full = (op: number, write: (p: PacketT) => void) => {
                const p = new PacketT(16);
                write(p);
                rows.push({ op, mode, body: requireNonNull(p.m_data).slice(0, p.m_pos), capacity: p.m_pos });
            };
            full(149, p => {
                p.p2(verify);
                p.p4(0);
            });
            full(155, p => {
                p.p1(2);
                p.p4_alt3(0);
                p.p2_alt2(verify);
                p.p2(0);
            });
            full(176, p => {
                p.p4_alt2(mode & 1);
                p.p2_alt2(verify);
                p.p4_alt2(0);
            });
        }
        add(2, p => {
            p.p4_alt2(id);
            p.p2_alt2(verify);
            p.p2_alt3(0x96d3);
        });
        add(9, p => {
            p.p2_alt3(0x4da1);
            p.p4_alt1(id);
            p.p2_alt2(verify);
            p.p2_alt1(2);
            p.p2_alt2(-1);
        });
        add(21, p => {
            p.p1(-92);
            p.p2(verify);
            p.p4_alt1(id);
        });
        add(36, p => {
            p.p4_alt3(id);
            p.p2_alt1(-253);
            p.p2_alt2(verify);
        });
        add(48, p => {
            p.p2(verify);
            p.p1(0xff);
            p.p1(0xa1);
            p.p1(0);
            p.p2_alt3(15);
        });
        add(50, p => {
            p.p4(mode & 1 ? 0 : 31);
            p.p4_alt3(id);
            p.p2_alt3(mode === 8 ? -1 : mode === 12 ? 996 : 995);
            p.p2_alt1(verify);
        });
        add(65, p => {
            p.p2_alt1(verify);
            p.p1(-251);
            p.p2_alt3(16);
        });
        add(66, p => {
            p.p2_alt3(verify);
            p.p4_alt2(id);
        });
        add(69, p => {
            p.p2_alt3(verify);
            p.p4(-2147483645);
            p.p2_alt2(15);
        });
        add(73, p => {
            p.p2_alt2(-1);
            p.p4_alt1(id);
            p.p2_alt1(verify);
        });
        add(111, p => {
            p.p2_alt2(verify);
            p.p4_alt3(id);
            p.p2_alt3(17);
            p.p2_alt1(0xffff);
            p.p2_alt3(0xabcd);
        });
        add(119, p => {
            p.p2_alt2(verify);
            p.p4_alt1(id);
            p.p2(-199);
            p.p2_alt2(-1358);
        });
        add(123, p => {
            p.p2_alt1(32765);
            p.p2_alt2(verify);
            p.p1(0xed);
            p.p1(0xff);
            p.p1(0);
        });
        add(130, p => {
            p.p4_alt1(id);
            p.p2_alt3(verify);
            p.p2_alt2(65535);
        });
        add(132, p => {
            p.p2(809);
            p.p2_alt2(verify);
            p.p2_alt3(92);
            p.p2_alt3(761);
            p.p4(id);
        });
        add(165, p => {
            p.p2_alt1(verify);
            p.p2_alt1(2);
            p.p4(id);
            p.p2_alt2(-1);
            p.p4_alt2(-114875);
        });
        add(171, p => {
            p.p4_alt3(id);
            p.p1(244);
            p.p1(0);
            p.p2_alt2(verify);
        });
        add(207, p => {
            p.p4_alt3(id);
            p.p2_alt2(verify);
            p.p2(65001);
            p.p2_alt2(38712);
        });
        add(220, p => {
            p.p4_alt3(id);
            p.p2_alt1(37000);
            p.p2(verify);
        });
    }
    return rows;
}

test('rg widget messages preserve cursor, verify acknowledgement, native components and queues for every payload prefix', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'widget-wire-')),
        rows = vectors();
    const saved = {
        inPacket: Protocol.inPacket,
        packetType: Protocol.packetType,
        packetSize: Protocol.packetSize,
        idleReads: Protocol.idleReads,
        ptype1: Protocol.ptype1,
        ptype2: Protocol.ptype2,
        lastPacketType0: Protocol.lastPacketType0,
        sequenceAckPending: Protocol.sequenceAckPending
    };
    const stream = Client.stream,
        verify = Client.verifyId,
        overrides = Client.serverActiveProperties,
        local = Client.localPlayer,
        widgets = IfType.m_list,
        loaded = IfType.m_open,
        dirty = InterfaceList.dirty[6],
        config = ObjType.m_pConfigClient,
        subInterfaces = InterfaceList.subInterfaces;
    const priorObj = ObjType.types.Find(995n),
        priorMissing = ObjType.types.Find(996n),
        priorNegative = ObjType.types.Find(-1n);
    const obj = new ObjType();
    obj.xAngle2d = 113;
    obj.yAngle2d = 337;
    obj.zAngle2d = 882;
    obj.zoom2d = 2147483647;
    obj.yOffset2d = -173;
    obj.xOffset2d = 235;
    ObjType.m_pConfigClient = null;
    ObjType.types.Put(995n, obj);
    ObjType.types.Remove(996n);
    ObjType.types.Remove(-1n);
    try {
        const build = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'ui/WidgetPacketOracle.java')]);
        expect(build.exitCode, build.stderr.toString()).toBe(0);
        const input = rows.map(r => [r.op, r.mode, r.capacity, Buffer.from(r.body).toString('hex')].join(' ')).join('\n') + '\n';
        const reference = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'WidgetPacketOracle'], { stdin: Buffer.from(input), maxBuffer: 8000000 });
        expect(reference.exitCode, reference.stderr.toString()).toBe(0);
        const expected = reference.stdout.toString().trimEnd().split(/\r?\n/);
        expect(expected.length).toBe(rows.length);
        for (const [index, { mode, op, body, capacity }] of rows.entries()) {
            const buffer = new SuperPacket(capacity);
            requireNonNull(buffer.m_data).fill(0);
            supplyPacket(op, body, buffer);
            Protocol.idleReads = 7;
            Protocol.ptype1 = 81;
            Protocol.lastPacketType0 = 93;
            Client.verifyId = 56;
            Protocol.sequenceAckPending = false;
            const c = new IfType();
            c.if3 = (mode & 1) === 0;
            c.id = 0;
            c.drawCycle = InterfaceList.cycle;
            c.rootIndex = 6;
            c.properties = new ServerActiveProperties(634, 803);
            InterfaceList.dirty[6] = false;
            IfType.m_list = [[c]];
            IfType.m_open = [true];
            Client.localPlayer = (mode & 2) === 0 ? new ClientPlayer() : null;
            if (Client.localPlayer !== null && (mode & 4) === 0) {
                const appearance = (Client.localPlayer.appearance = new PlayerModel());
                appearance.npcId = -1;
            }
            Client.serverActiveProperties = new HashTable(512);
            if ((mode & 8) !== 0) Client.serverActiveProperties.put(new ServerActiveProperties(19, 56), -1n);
            const rawProperties: HashTable<Linkable> = Client.serverActiveProperties;
            if (mode >= 16) {
                rawProperties.put(new Linkable(), BigInt(mode - 17));
                InterfaceList.subInterfaces = new HashTable(8);
                const mounts: HashTable<Linkable> = InterfaceList.subInterfaces;
                mounts.put(new Linkable(), 0n);
            }
            DelayedStateChange.clear();
            let result: string;
            try {
                result = String(await Protocol.TcpIn());
            } catch (caught) {
                let e = caught;
                while (e instanceof WrappedException && e.cause !== null) e = e.cause;
                result = e instanceof RangeError ? (e.message === '/ by zero' ? 'arithmetic' : 'bounds') : e instanceof TypeError ? (e.message.startsWith('ClassCastException') ? 'cast' : 'null') : String(e);
            }
            const masks: string[] = [],
                changes: string[] = [];
            for (let p = rawProperties.head(); p !== null; p = rawProperties.next()) masks.push(p instanceof ServerActiveProperties ? [p.key, p.events, p.targetParam].join(':') : p.key + ':link');
            for (let n = DelayedStateChange.poll(); n !== null; n = DelayedStateChange.poll()) changes.push([n.type(), n.id(), n.value, n.value2, n.value3, n.text === null ? '-' : Buffer.from(n.text.toBytes()).toString('hex')].join(':'));
            const actual = [
                result,
                buffer.m_pos,
                Protocol.packetType,
                Client.verifyId,
                Protocol.sequenceAckPending,
                Protocol.idleReads,
                Protocol.ptype1,
                Protocol.lastPacketType0,
                Protocol.ptype2,
                c.modelXAngle,
                c.modelYAngle,
                c.modelType,
                c.modelId,
                c.modelZoom,
                InterfaceList.dirty[6],
                masks.join(','),
                changes.join(',')
            ].join(';');
            expect(actual, 'op ' + op + ' mode ' + mode + ' bytes ' + body.length + '/' + capacity).toBe(expected[index]);
        }
    } finally {
        Object.assign(Protocol, saved);
        Client.stream = stream;
        Client.verifyId = verify;
        Client.serverActiveProperties = overrides;
        Client.localPlayer = local;
        IfType.m_list = widgets;
        IfType.m_open = loaded;
        InterfaceList.dirty[6] = dirty;
        InterfaceList.subInterfaces = subInterfaces;
        ObjType.m_pConfigClient = config;
        ObjType.types.Remove(995n);
        if (priorObj !== null) ObjType.types.Put(995n, priorObj);
        if (priorMissing !== null) ObjType.types.Put(996n, priorMissing);
        if (priorNegative !== null) ObjType.types.Put(-1n, priorNegative);
        DelayedStateChange.clear();
        rmSync(dir, { recursive: true, force: true });
    }
}, 30000);
