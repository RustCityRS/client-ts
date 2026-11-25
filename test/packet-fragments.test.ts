import { expect, test } from 'bun:test';
import WrappedException from '#/util/WrappedException.js';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { delimiter, resolve } from 'node:path';
import Client from '#/client/Client.js';
import GameShell from '#/client/GameShell.js';
import LocChange from '#/dash3d/LocChange.js';
import type JagString from '#/datastruct/JagString.js';
import Protocol from '#/io/Protocol.js';
import ReflectionCheck from '#/io/ReflectionCheck.js';
import SuperPacket from '#/io/SuperPacket.js';
import { requireNonNull } from '#/util/JavaArray.js';
import Signlink from '#/util/Signlink.js';
import { gamepackPath } from './reference.js';

test('rg receives host, stock, UID, spot and zone packets one byte at a time, including the failing enclosed opcode', async () => {
    const seeds = Int32Array.of(11, 19, 73, 37);
    const packets: [number, Uint8Array][] = [
        [42, Buffer.from('relative#test')],
        [42, Buffer.alloc(0)],
        [114, Buffer.from('00812345ef', 'hex')],
        [116, Buffer.from('0200000000000000000000000000000000000000', 'hex')],
        [116, Buffer.from('020100123456789abcdef0123401234500010000', 'hex')],
        [116, Buffer.from('070100123456789abcdef0123401234500010000', 'hex')],
        [142, Buffer.from('abc\0padding')],
        [142, Buffer.from('a')],
        [164, Buffer.from('010203ff', 'hex')],
        [169, Uint8Array.from({ length: 24 }, (_, i) => i * 7)],
        [26, Buffer.from('edfa', 'hex')],
        [112, Buffer.from('0212', 'hex')],
        [112, Buffer.from('0010', 'hex')],
        [230, Buffer.from('707f', 'hex')],
        [230, Buffer.from('707ffa0019', 'hex')],
        [230, Buffer.from('707ffa1300c302010100', 'hex')],
        [230, Buffer.from('707f13c304', 'hex')],
        [230, Buffer.from('707f140184', 'hex')],
        [230, Buffer.from('707fedef', 'hex')],
        [235, Buffer.from('84010000000000', 'hex')],
        [235, Buffer.from('80010000000000', 'hex')]
    ];
    for (const target of [0, 0x1000ffff, 0x2000ffff]) {
        const spot = new SuperPacket(10);
        spot.p2(2);
        spot.p2_alt1(197);
        spot.p4_alt2(target);
        spot.p2_alt3(211);
        packets.push([56, requireNonNull(spot.m_data).slice(0, spot.m_pos)]);
    }
    const frames = packets.map(([opcode, body]) => {
        const p = new SuperPacket(5000);
        p.SetEnc(seeds);
        p.pHead(opcode);
        if (opcode === 114 || opcode === 230) p.p2(body.length);
        if (opcode === 42 || opcode === 142) p.p1(body.length);
        for (const byte of body) {
            if (opcode === 42) p.pHead(byte);
            else p.p1(byte);
        }
        return requireNonNull(p.m_data).slice(0, p.m_pos);
    });
    const fields = {
        zoneUpdateX: Protocol.zoneUpdateX,
        zoneBaseZ: Protocol.zoneBaseZ,
        inPacket: Protocol.inPacket,
        packetType: Protocol.packetType,
        packetSize: Protocol.packetSize,
        lastPacketType0: Protocol.lastPacketType0,
        ptype1: Protocol.ptype1,
        ptype2: Protocol.ptype2,
        idleReads: Protocol.idleReads
    };
    const client = {
        uidFile: Client.uidFile,
        stream: Client.stream,
        activeClient: Client.activeClient,
        grandExchangeOffers: Client.grandExchangeOffers,
        stockTransmitCycle: Client.stockTransmitCycle,
        transmitCycle: Client.transmitCycle,
        haveIe6: Client.haveIe6,
        settings: Client.settings,
        pendingUrl: Client.pendingUrl,
        urlNewWindow: Client.urlNewWindow
    };
    const planes = Client.playerLevel,
        scene = LocChange.scene;
    const queue = ReflectionCheck.queue,
        signlink = GameShell.signlink,
        frame = GameShell.frame;
    const platform = Signlink.platform,
        os = Signlink.osNameLower;
    const hex = (s: JagString | null) => (s === null ? '~' : Buffer.from(s.toBytes()).toString('hex'));
    mkdirSync('out', { recursive: true });
    const dir = mkdtempSync(resolve('out/packet-fragments-'));
    try {
        const built = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, resolve(import.meta.dir, 'io/PacketFragmentsOracle.java')]);
        expect(built.stderr.toString()).toBe('');
        expect(built.exitCode).toBe(0);
        const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'PacketFragmentsOracle'], { stdin: Buffer.from(frames.map(bytes => Buffer.from(bytes).toString('hex')).join('\n') + '\n') });
        expect(java.stderr.toString()).toBe('');
        expect(java.exitCode).toBe(0);
        const lines = java.stdout.toString().trimEnd().split(/\r?\n/);
        let row = 0;
        for (const [i, bytes] of frames.entries()) {
            let pos = 0,
                visible = 0;
            Client.stream = {
                GetAvailable: () => visible - pos,
                async Read(dest, offset, length) {
                    if (length > visible - pos) throw Error('incomplete read');
                    requireNonNull(dest).set(bytes.subarray(pos, pos + length), offset);
                    pos += length;
                },
                async read() {
                    return -1;
                },
                Write() {},
                Close() {}
            };
            const p = (Protocol.inPacket = new SuperPacket(5000));
            requireNonNull(p.m_data).fill(0);
            requireNonNull(p.m_data).fill(49, 0, 12);
            p.SetEnc(seeds);
            p.m_pos = 7;
            Protocol.zoneUpdateX = 11;
            Protocol.zoneBaseZ = 19;
            Client.playerLevel = 0;
            Client.uidFile = null;
            LocChange.scene = null;
            Protocol.packetType = -1;
            Protocol.packetSize = -17;
            Protocol.idleReads = 37;
            Protocol.lastPacketType0 = 1;
            Protocol.ptype1 = 2;
            Protocol.ptype2 = 3;
            GameShell.signlink = null;
            GameShell.frame = null;
            Client.activeClient = null;
            Signlink.platform = 2;
            Signlink.osNameLower = 'windows';
            Client.haveIe6 = false;
            ReflectionCheck.resetQueue();
            Client.settings = null;
            Client.pendingUrl = null;
            Client.urlNewWindow = false;
            Client.grandExchangeOffers = new Array(6).fill(null);
            Client.stockTransmitCycle = 735;
            Client.transmitCycle = 968;
            for (; visible <= bytes.length; visible++) {
                let outcome: string;
                try {
                    outcome = String(await Protocol.TcpIn());
                } catch (error) {
                    const cause = error instanceof WrappedException ? error.cause : error;
                    if (!(cause instanceof TypeError || cause instanceof RangeError)) throw error;
                    outcome = 'exception';
                }
                const result = [
                    outcome,
                    Protocol.packetType,
                    Protocol.packetSize,
                    p.m_pos,
                    pos,
                    Protocol.lastPacketType0,
                    Protocol.ptype1,
                    Protocol.ptype2,
                    Protocol.idleReads,
                    Client.stockTransmitCycle,
                    Client.grandExchangeOffers[2] !== null,
                    hex(Client.settings),
                    hex(Client.pendingUrl),
                    Client.urlNewWindow,
                    ReflectionCheck.queue.head()?.id ?? '~',
                    Protocol.zoneUpdateX,
                    Protocol.zoneBaseZ
                ];
                expect(result.join('|'), packets[i][0] + ' at byte ' + visible).toBe(lines[row++]);
            }
        }
        expect(row).toBe(lines.length);
    } finally {
        Object.assign(Protocol, fields);
        Object.assign(Client, client);
        Client.playerLevel = planes;
        LocChange.scene = scene;
        GameShell.signlink = signlink;
        GameShell.frame = frame;
        ReflectionCheck.queue = queue;
        Signlink.platform = platform;
        Signlink.osNameLower = os;
        rmSync(dir, { recursive: true, force: true });
    }
});
