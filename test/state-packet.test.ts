import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import HintArrow from '#/client/HintArrow.js';
import VarBitType from '#/config/VarBitType.js';
import VarpType from '#/config/VarpType.js';
import ClientVarCache from '#/util/ClientVarCache.js';
import WrappedException from '#/util/WrappedException.js';
import HashTable from '#/datastruct/HashTable.js';
import SharedPtrList from '#/datastruct/SharedPtrList.js';
import AreaSoundManager from '#/sound/AreaSoundManager.js';
import LRUHashCache from '#/datastruct/LRUHashCache.js';
import LruHashTable from '#/datastruct/LruHashTable.js';
import JagString, { fromJsString } from '#/datastruct/JagString.js';
import PacketT from '#/io/PacketT.js';
import Protocol from '#/io/Protocol.js';
import SuperPacket from '#/io/SuperPacket.js';
import { ClientScript } from '#/script/ClientScript.js';
import DelayedStateChange from '#/ui/DelayedStateChange.js';
import InterfaceList from '#/ui/InterfaceList.js';
import LocalisedText from '#/ui/LocalisedText.js';
import Minimenu from '#/ui/Minimenu.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { supplyPacket } from './receive-packet.js';
import { gamepackPath } from './reference.js';

const text = (s: JagString | null) => (s === null ? '-' : Buffer.from(s.toBytes()).toString('hex'));
const hash = (a: Int32Array) => a.reduce((h, v) => (Math.imul(h, 31) + v) | 0, 1);
type Row = { op: number; mode: number; body: Uint8Array; capacity: number };

function vectors(): Row[] {
    const rows: Row[] = [];
    for (let mode = 0; mode < 4; mode++) {
        const add = (op: number, write: (p: PacketT) => void) => {
            const p = new PacketT(80);
            write(p);
            const packet = requireNonNull(p.m_data).slice(0, p.m_pos);
            for (let i = 0; i <= packet.length; i++) {
                const body = packet.subarray(0, i);
                rows.push({ op, mode, body, capacity: i });
                if (i !== packet.length) rows.push({ op, mode, body, capacity: packet.length });
            }
        };
        add(115, p => {
            p.p2(0xffef);
            p.pStringNoConversion(fromJsString('isis'), 0);
            p.pStringNoConversion(fromJsString('second'), 0);
            p.p4(-32851);
            p.pStringNoConversion(fromJsString('first'), 0);
            p.p4(2147483647);
            p.p4(85901);
        });
        add(37, p => {
            p.p1_alt1(5);
            p.p2_alt1(mode === 2 ? 9 : 8);
        });
        add(84, p => {
            p.p4_alt1(13);
            p.p2_alt3(mode === 2 ? 9 : 8);
        });
        add(60, p => {
            p.p2_alt2(mode === 3 ? 65535 : 1);
            p.p1(113);
        });
        add(226, p => {
            p.p4(-40516);
            p.p2_alt2(mode === 3 ? 65535 : 1);
        });
        add(38, p => {
            p.p1_alt1(83);
            p.p4_alt2(10893);
            p.p1(mode & 1 ? 250 : 17);
        });
        add(89, () => {});
        add(128, () => {});
        add(44, p => {
            p.p2_alt3(-1);
            p.p1(mode);
            p.p1(mode === 3 ? 0 : mode === 2 ? 8 : 1);
            p.pStringNoConversion(fromJsString(mode === 0 ? 'nULL' : 'Follow'), 0);
        });
        add(160, () => {});
        add(160, p => p.pStringNoConversion(fromJsString('Walk north'), 0));
        add(192, p => p.p1(5));
        for (const type of [0, 1, 2, 3, 4, 5, 6, 10, 32])
            add(217, p => {
                p.p1(((mode % 2) << 6) | type);
                p.p1(mode === 2 ? 2 : 1);
                p.p2(3256);
                p.p2(67);
                p.p1(8);
                p.p2(645);
            });
    }
    return rows;
}

test('rg preserves reversed hook arguments, stat and varp ring counters, player menus and hint arrows on partial payloads', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'state-wire-')),
        rows = vectors();
    const header = {
        inPacket: Protocol.inPacket,
        packetType: Protocol.packetType,
        packetSize: Protocol.packetSize,
        ptype1: Protocol.ptype1,
        ptype2: Protocol.ptype2,
        lastPacketType0: Protocol.lastPacketType0,
        idleReads: Protocol.idleReads,
        sequenceAckPending: Protocol.sequenceAckPending
    };
    const client = { stream: Client.stream, verifyId: Client.verifyId, activeClient: Client.activeClient, hintHeadicons: Client.hintHeadicons, minimapState: Client.minimapState };
    const lists = {
        bits: VarBitType.m_recentUse,
        bitArchive: VarBitType.m_pConfigClient,
        types: VarpType.m_recentUse,
        varpArchive: VarpType.m_pConfigClient,
        count: VarpType.m_numDefinitions,
        script: ClientScript.m_cache,
        archive: Client.m_pClientScripts,
        subs: InterfaceList.subInterfaces,
        pending: ClientVarCache.changes
    };
    const state = {
        stat: Client.changedStatCount,
        varp: Client.varpTransmitCount,
        walk: Minimenu.walkHere,
        label: LocalisedText.walkHere,
        setting: Client.bankArrangeMode,
        arrows: Client.hintArrows.slice(),
        ops: Minimenu.playerOption.slice(),
        flags: Minimenu.playerSecondary.slice(),
        strings: DelayedStateChange.varcStrings.slice(300, 302),
        varcs: DelayedStateChange.varcs.slice(300, 302)
    };
    const integers = [Client.statXP, Client.statBaseLevel, Client.statEffectiveLevel, requireNonNull(Client.varpUpdates), requireNonNull(Client.statUpdates), ClientVarCache.m_var, ClientVarCache.m_varServ, Minimenu.playerCursor];
    const savedArrays = integers.map(a => a.slice());
    const locSounds = AreaSoundManager.locs,
        npcSounds = AreaSoundManager.npcs;
    try {
        // The Java process starts with empty multiloc and NPC ambient sound lists (wh.f).
        Reflect.set(AreaSoundManager, 'locs', new SharedPtrList());
        Reflect.set(AreaSoundManager, 'npcs', new SharedPtrList());
        const build = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'ui/WidgetPacketOracle.java'), join(import.meta.dir, 'ui/ClientStatePacketOracle.java')]);
        expect(build.exitCode, build.stderr.toString()).toBe(0);
        const input = rows.map(r => [r.op, r.mode, r.capacity, Buffer.from(r.body).toString('hex')].join(' ')).join('\n') + '\n';
        const ref = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'ClientStatePacketOracle'], { stdin: Buffer.from(input), maxBuffer: 4000000 });
        expect(ref.exitCode, ref.stderr.toString()).toBe(0);
        const lines = ref.stdout.toString().trimEnd().split(/\r?\n/);
        expect(lines.length).toBe(rows.length);
        const seed = fromJsString('seed');
        LocalisedText.walkHere = fromJsString('walk');
        InterfaceList.subInterfaces = new HashTable(8);
        Client.activeClient = null;
        const code = new ClientScript();
        code.opcodes = Int32Array.of(33, 43, 33, 43, 35, 48, 35, 48, 21);
        code.intOperands = Int32Array.of(0, 300, 1, 301, 0, 300, 1, 301, 0);
        code.stringOperands = new Array(9).fill(null);
        code.intLocals = 2;
        code.stringLocals = 2;
        ClientScript.m_cache = new LruHashTable(128);
        ClientScript.m_cache.Put(85901n, code);
        Client.m_pClientScripts = null;
        VarpType.m_recentUse = new LRUHashCache(64);
        VarpType.m_pConfigClient = null;
        VarBitType.m_recentUse = new LRUHashCache(64);
        VarBitType.m_pConfigClient = null;
        for (let i = 0; i < 3; i++) {
            const t = new VarpType();
            t.clientCode = i === 1 ? 0 : 9;
            VarpType.m_recentUse.Put(BigInt(i), t);
        }
        const b = new VarBitType();
        b.baseVar = 1;
        b.startBit = 2;
        b.endBit = 5;
        VarBitType.m_recentUse.Put(8n, b);
        for (const [i, { op, mode, body, capacity }] of rows.entries()) {
            const p = new SuperPacket(capacity);
            requireNonNull(p.m_data).fill(0);
            supplyPacket(op, body, p);
            Protocol.sequenceAckPending = false;
            Client.verifyId = 56;
            ClientVarCache.m_var.fill(0);
            ClientVarCache.m_varServ.fill(0);
            ClientVarCache.m_varServ[0] = 18;
            ClientVarCache.m_var[1] = 431;
            ClientVarCache.m_varServ[1] = 77;
            if (mode & 1) ClientVarCache.m_varServ[3] = 912;
            requireNonNull(Client.varpUpdates).fill(11);
            Client.varpTransmitCount = 2147483646;
            VarpType.m_numDefinitions = mode & 1 ? 4 : 3;
            ClientVarCache.changes = new HashTable(16);
            Client.bankArrangeMode = 91;
            DelayedStateChange.clear();
            requireNonNull(Client.statUpdates).fill(53);
            Client.changedStatCount = 2147483647;
            Client.statXP.fill(19);
            Client.statBaseLevel.fill(88);
            Client.statEffectiveLevel.fill(3);
            DelayedStateChange.varcs[300] = DelayedStateChange.varcs[301] = 367;
            DelayedStateChange.varcStrings[300] = DelayedStateChange.varcStrings[301] = seed;
            Minimenu.playerOption.fill(seed);
            Minimenu.playerCursor.fill(925);
            Minimenu.playerSecondary.fill(false);
            Minimenu.walkHere = seed;
            Client.minimapState = 111;
            Client.hintArrows.fill(null);
            Client.hintHeadicons = mode & 1 ? null : [null, null];
            if (mode & 2) Client.hintArrows[0] = new HintArrow();
            let result: string, thrown: unknown;
            try {
                result = String(await Protocol.TcpIn());
            } catch (caught) {
                let e = caught;
                thrown = e;
                while (e instanceof WrappedException && e.cause !== null) e = e.cause;
                result = e instanceof RangeError ? 'bounds' : e instanceof TypeError ? 'null' : String(e);
            }
            const options = Minimenu.playerOption.map((v, i) => [text(v), Minimenu.playerCursor[i], Minimenu.playerSecondary[i]].join(':'));
            const arrows = Client.hintArrows.map(a => (a === null ? '-' : [a.actor, a.z, a.model, a.x, a.type, a.offsetX, a.offsetZ, a.icon, a.height].join(':')));
            const actual = [
                result,
                p.m_pos,
                Protocol.packetType,
                Client.verifyId,
                Protocol.sequenceAckPending,
                DelayedStateChange.varcs[300],
                DelayedStateChange.varcs[301],
                text(DelayedStateChange.varcStrings[300]),
                text(DelayedStateChange.varcStrings[301]),
                hash(ClientVarCache.m_var),
                hash(ClientVarCache.m_varServ),
                Client.varpTransmitCount,
                hash(requireNonNull(Client.varpUpdates)),
                ClientVarCache.changes.size(),
                Client.bankArrangeMode,
                hash(Client.statXP),
                hash(Client.statBaseLevel),
                hash(Client.statEffectiveLevel),
                Client.changedStatCount,
                hash(requireNonNull(Client.statUpdates)),
                Client.minimapState,
                text(Minimenu.walkHere),
                options.join(','),
                arrows.join(',')
            ].join(';');
            expect(actual, 'op ' + op + ' mode ' + mode + ' bytes ' + body.length + '/' + capacity + (actual !== lines[i] && thrown instanceof Error ? '\n' + thrown.stack : '')).toBe(lines[i]);
        }
    } finally {
        Reflect.set(AreaSoundManager, 'locs', locSounds);
        Reflect.set(AreaSoundManager, 'npcs', npcSounds);
        Object.assign(Protocol, header);
        Object.assign(Client, client);
        Client.hintArrows.splice(0, Client.hintArrows.length, ...state.arrows);
        VarpType.m_recentUse = lists.types;
        VarpType.m_pConfigClient = lists.varpArchive;
        VarpType.m_numDefinitions = lists.count;
        VarBitType.m_recentUse = lists.bits;
        VarBitType.m_pConfigClient = lists.bitArchive;
        ClientVarCache.changes = lists.pending;
        Client.bankArrangeMode = state.setting;
        ClientScript.m_cache = lists.script;
        Client.m_pClientScripts = lists.archive;
        InterfaceList.subInterfaces = lists.subs;
        Client.changedStatCount = state.stat;
        Client.varpTransmitCount = state.varp;
        Minimenu.walkHere = state.walk;
        LocalisedText.walkHere = state.label;
        Minimenu.playerOption.splice(0, 8, ...state.ops);
        Minimenu.playerSecondary.splice(0, 8, ...state.flags);
        integers.forEach((a, i) => a.set(savedArrays[i]));
        DelayedStateChange.clear();
        DelayedStateChange.varcs.set(state.varcs, 300);
        DelayedStateChange.varcStrings.splice(300, 2, ...state.strings);
        rmSync(dir, { recursive: true, force: true });
    }
}, 30000);
