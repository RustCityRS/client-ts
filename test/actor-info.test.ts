import { freshActors } from './actor-fixture.js';
import ReceivePlayerPositions from '#/client/ReceivePlayerPositions.js';
import Protocol from '#/io/Protocol.js';
import WrappedException from '#/util/WrappedException.js';
import NpcType from '#/config/NpcType.js';
import ObjType from '#/config/ObjType.js';
import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import ClientEntity from '#/dash3d/ClientEntity.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';

import ActorSlotAnim from '#/dash3d/ActorSlotAnim.js';
import PlayerModel from '#/dash3d/PlayerModel.js';
import GameVariant from '#/client/GameVariant.js';
import PacketT from '#/io/PacketT.js';
import SuperPacket from '#/io/SuperPacket.js';
import JagString, { fromJsString } from '#/datastruct/JagString.js';
import SeqType from '#/config/SeqType.js';
import SpotType from '#/config/SpotType.js';
import BASType from '#/config/BASType.js';
import BASTypeList from '#/config/BASTypeList.js';
import ClientApp from '#/client/Client.js';
import Preferences from '#/ui/Preferences.js';
import AreaSoundManager from '#/sound/AreaSoundManager.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { gamepackPath } from './reference.js';

function data(write: (p: PacketT) => void): Buffer {
    const p = new PacketT(1000);
    write(p);
    return Buffer.from(requireNonNull(p.m_data).subarray(0, p.m_pos));
}

function appearance(flags: number, npc: number, radius: number, badName = false): Buffer {
    return data(p => {
        p.p1(flags);
        p.p1(-1);
        p.p1(-3);
        if (npc >= 0) {
            p.p2(65535);
            p.p2(npc);
            p.p1(3);
        } else {
            const equipment = [258, 0, 32768, 32769, 0, 258, 0, 0, 0, 440, 844, 0];
            for (let i = 0; i < equipment.length; i++) {
                const id = equipment[i];
                if (id === 0) p.p1(0);
                else p.p2(id);
            }
        }
        for (const c of [8, 70, 240, 5, 14]) p.p1(c);
        p.p2(340);
        p.p8(badName ? 0n : fromJsString('port_tesTer').toBase37());
        p.p1(109);
        if ((flags & 4) !== 0) p.p2(1440);
        else {
            p.p1(112);
            p.p1(255);
        }
        p.p1(radius);
        if (radius > 0) for (const sound of [110, 118, 114, 109]) p.p2(sound);
    });
}

class Bits {
    private n = 0;
    private bytes: number[] = [];
    p(bits: number, value: number): this {
        for (let i = bits - 1; i >= 0; i--) {
            const pos = this.n++;
            this.bytes[pos >> 3] |= ((value >> i) & 1) << (7 - (pos & 7));
        }
        return this;
    }
    end(...suffix: Buffer[]): Buffer {
        return Buffer.concat([Buffer.from(this.bytes), ...suffix]);
    }
}
const hex = (data: Uint8Array) => Buffer.from(data).toString('hex');
const app = appearance(0x59, -1, 0);
function playerMasks(seq: number) {
    return data(p => {
        p.p1(255);
        p.p1(15); // all twelve extended bits, incl. chat
        p.p2_alt1(0);
        p.p1(0);
        p.p1(0);
        p.p2(32768 + 990);
        p.p1_alt1(3);
        p.p1_alt3(129);
        p.p2(seq);
        p.p1(2);
        p.p1_alt1(app.length);
        p.pArrayBuffer(app, app.length, 0);
        p.p2_alt2(32768 + 73);
        p.p1(-49);
        p.p1(47);
        p.p1_alt1(51);
        p.p1(46);
        p.p2_alt1(3);
        p.p2_alt1(12);
        p.p1(-3);
        p.pStringNoConversion(fromJsString('~On my way'), 0);
        p.p1(22);
        p.p1_alt3(1);
        p.p1(-3);
        for (const [id, delay, mask] of [
            [101, 1, 5],
            [102, 2, 14],
            [65535, 0, 8]
        ]) {
            p.p2_alt1(id);
            p.p1_alt1(delay);
            p.p2(mask);
        }
        p.p2_alt1(211);
        p.p4_alt3(0xf8210003);
        p.p2(6207);
        p.p2_alt3(6321);
    });
}
function npcMasks(seq: number, newType: number) {
    return data(p => {
        p.p1(255);
        p.p1(3);
        p.p1(220);
        p.p1(-3);
        p.p1_alt3(251);
        p.p1(-22);
        p.p1_alt3(3);
        p.p2(seq);
        p.p1(2);
        p.p2_alt2(32768 + 73);
        p.p2_alt2(211);
        p.p4_alt1(0xf8210003);
        p.p2_alt1(newType);
        p.pStringNoConversion(fromJsString('hi!'), 0);
        p.p1(-3);
        for (const [id, delay, mask] of [
            [101, 1, 5],
            [102, 2, 14],
            [65535, 0, 8]
        ]) {
            p.p2_alt1(id);
            p.p1_alt3(delay);
            p.p2(mask);
        }
        p.p2_alt2(6402);
        p.p2(6456);
    });
}
function addPlayer(b: Bits, id: number, update: boolean, dx: number, dz: number, yaw: number) {
    return b.p(11, id).p(1, +update).p(5, dx).p(3, yaw).p(1, 1).p(5, dz);
}
function addNpc(b: Bits, id: number, type: number, update: boolean, dx: number, dz: number, yaw: number) {
    return b.p(15, id).p(1, 1).p(3, yaw).p(1, +update).p(5, dz).p(14, type).p(5, dx);
}

function cases(): string[] {
    const commands: string[] = [];
    const start = (variant = 0) => commands.push('start 1 ' + variant);
    const packet = (op: string, tick: number, body: Buffer, size = body.length) => commands.push([op, tick, hex(body), size].join(' '));
    for (const variant of [0, 1]) {
        start(variant);
        for (const flags of [0, 1, 4, 255, 88, 193]) {
            for (const [npc, radius] of [
                [-1, 0],
                [-1, 3],
                [502, 1],
                [501, 3],
                [501, 0],
                [-1, 0]
            ]) {
                commands.push('a 10 ' + hex(appearance(flags, npc, radius)));
            }
        }
    }
    for (const bytes of [app, appearance(4, 502, 2), appearance(173, -1, 3, true)]) {
        for (let n = 0; n <= bytes.length; n++) {
            start();
            commands.push('a 16 ' + hex(bytes.subarray(0, n)));
        }
    }
    const p = addPlayer(new Bits().p(1, 1).p(2, 3).p(7, 59).p(1, 1).p(2, 2).p(1, 0).p(7, 52).p(8, 0), 73, true, -3, 2, 4).p(11, 2047).end(playerMasks(101));
    const n = addNpc(addNpc(new Bits().p(8, 0), 9, 501, false, -4, 5, 2), 15, 502, true, 5, 2, 6)
        .p(15, 32767)
        .end(npcMasks(102, 503));
    start();
    packet('p', 10, p);
    packet('n', 10, n);
    for (let cycle = 11; cycle <= 27; cycle++) commands.push('t ' + cycle);
    const retained = new Bits().p(1, 0).p(8, 1).p(1, 1).p(2, 0).p(11, 2047);
    // Chat is suppressed by an absent name/appearance in the first packet. Subsequent updates omit the chat bit.
    for (const [cycle, seq] of [
        [28, 101],
        [29, 102],
        [30, 101],
        [31, 103],
        [32, 65535]
    ]) {
        const mask = playerMasks(seq);
        const short = Buffer.concat([Buffer.of(mask[0] & 127, mask[1]), mask.subarray(6)]);
        packet('p', cycle, retained.end(short));
        packet('n', cycle, new Bits().p(8, 2).p(1, 0).p(1, 1).p(2, 0).p(15, 32767).end(npcMasks(seq, 502)));
    }
    packet('p', 34, new Bits().p(1, 0).p(8, 0).end());
    packet('p', 35, addPlayer(new Bits().p(1, 0).p(8, 0), 73, false, 0, -2, 6).p(11, 2047).end());
    packet('n', 36, addNpc(new Bits().p(8, 0), 9, 503, false, 1, 1, 1).end());
    packet('n', 37, Buffer.of(0));
    for (const [op, bytes] of [
        ['p', p],
        ['n', n]
    ] as const) {
        for (let cut = 0; cut < bytes.length; cut++) {
            start();
            packet(op, 40, bytes.subarray(0, cut), bytes.length);
        }
        for (const size of [-1, 0, 1, 3, bytes.length - 1, bytes.length + 1]) {
            start();
            packet(op, 50, bytes, size);
        }
    }
    for (const mask of [0, 128, 1, 8, 4, 2, 1024, 32, 512, 2048, 256, 64]) {
        for (const n of [0, 1, 3, 8, 30]) {
            start();
            commands.push(['pm', 99, hex(Buffer.alloc(n)), mask].join(' '));
        }
    }
    for (const mask of [0, 64, 2, 16, 4, 128, 1, 32, 256, 512]) {
        for (const n of [0, 1, 3, 8, 30]) {
            start();
            const bytes = mask < 256 ? Buffer.of(mask) : Buffer.of((mask & 255) | 8, mask >> 8);
            commands.push(['nm', 99, hex(Buffer.concat([bytes, Buffer.alloc(n)]))].join(' '));
        }
    }
    start();
    packet('p', 60, Buffer.of(0x3f, 0x80));
    packet('n', 61, Buffer.of(99));
    start();
    packet('wirep', 70, p);
    packet('wiren', 70, n);
    start();
    packet('wiren', 71, Buffer.of(99));
    start();
    packet('wirep', 72, Buffer.of(0x3f, 0x80));
    return commands;
}

const classNames = [
    ['ob', 'ClientEntity'],
    ['pb', 'ClientPlayer'],
    ['bk', 'ClientNpc'],
    ['cl', 'PlayerModel'],
    ['ci', 'ActorSlotAnim']
];
const fieldMaps = new Map(
    classNames.map(([owner, name]) => {
        const src = readFileSync(join(import.meta.dir, '../src/dash3d/' + name + '.ts'), 'utf8');
        const fields: [string, string][] = [];
        for (const line of src.split('\n')) {
            const m = line.match(new RegExp('^\\s*(?:private )?(\\w+)\\s*[:=].*// ' + owner + '\\.(\\w+):'));
            if (m) fields.push([m[2], m[1]]);
        }
        if (owner === 'cl') {
            for (const m of src.matchAll(/\/\/ cl\.(\w+):[^\n]+\n\s*(?:private )?(\w+)\s*[:=]/g)) fields.push([m[1], m[2]]);
        }
        return [owner, fields.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))] as const;
    })
);
function value(v: unknown): string {
    if (v === null) return '~';
    if (v instanceof Int32Array) return '[' + v.join(', ') + ']';
    if (v instanceof Int8Array) return hex(new Uint8Array(v.buffer, v.byteOffset, v.byteLength));
    if (v instanceof JagString) return hex(requireNonNull(v.bytes).subarray(0, v.length));
    if (v instanceof NpcType) return '#' + v.id;
    if (v instanceof PacketT) return v.m_pos + '#' + hex(requireNonNull(v.m_data));
    if (v instanceof PlayerModel) return fields('cl', v);
    if (v instanceof ActorSlotAnim) return fields('ci', v);
    if (Array.isArray(v)) return '[' + v.map(value).join(',') + ']';
    return String(v);
}
function fields(owner: string, object: object): string {
    return requireNonNull(fieldMaps.get(owner))
        .map(([field, key]) => field + '=' + value(Reflect.get(object, key)))
        .join(',');
}
function actor(v: ClientEntity | null): string {
    return v === null ? '~' : fields('ob', v) + '#' + fields(v instanceof ClientPlayer ? 'pb' : 'bk', v);
}
const hash = (array: Int32Array) => array.reduce((h, i) => (Math.imul(h, 31) + i) | 0, 1);

test('the JAR and native creature readers agree after complete and truncated update masks, movement, removals and cached appearances', async () => {
    const commands = cases(),
        out = resolve('out');
    mkdirSync(out, { recursive: true });
    const dir = mkdtempSync(join(out, 'actor-info-'));
    const saved = {
        incoming: Protocol.inPacket,
        cycle: ClientApp.loopCycle,
        size: Protocol.packetSize,
        variant: GameVariant.id,
        sfx: Preferences.soundEffectVolume,
        area: Preferences.areaSoundVolume,
        wearables: ObjType.wearables,
        palette: PlayerModel.recolourDestinations,
        player: ClientApp.localPlayer
    };
    try {
        const compile = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game', 'ActorInfoOracle.java')]);
        expect(compile.stderr.toString()).toBe('');
        const result = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'ActorInfoOracle'], {
            stdin: Buffer.from(commands.join('\n') + '\n'),
            maxBuffer: 16 * 1024 * 1024
        });
        expect(result.stderr.toString()).toBe('');
        expect(result.exitCode).toBe(0);
        const rows = result.stdout.toString().trimEnd().split(/\r?\n/);
        expect(rows.length).toBe(commands.length);
        for (const [i, cmd] of commands.entries()) {
            const [op, cycle, arg, size] = cmd.split(' ');
            let error = 'ok',
                pos = -1;
            ClientApp.loopCycle = Number(cycle);
            let appearance: PacketT | null = null;
            try {
                if (op === 'start') {
                    freshActors();
                    Protocol.inPacket = new SuperPacket(5000);
                    ClientApp.playerLevel = ClientApp.mapBuildBaseX = ClientApp.mapBuildBaseZ = 0;
                    for (const list of [ClientApp.entityUpdateIds, ClientApp.entityRemovalIds, ClientApp.npcIds, ReceivePlayerPositions.m_lastID]) list.fill(0);
                    ClientApp.entityUpdateCount = ClientApp.entityRemovalCount = ClientApp.soundEffectCount = 0;
                    GameVariant.id = Number(arg);
                    AreaSoundManager.clear(true);
                    PlayerModel.recolourDestinations = arg === '0' ? PlayerModel.recolourDestinationsRs : PlayerModel.recolourDestinationsAlt;
                    for (let i = 0; i < 4; i++) {
                        const n = new NpcType();
                        n.id = 501 + i;
                        n.m_gridSize = 1 + i;
                        n.m_turnSpeed = i === 1 ? 0 : 64 - i;
                        n.m_baseAnimationSet = 340;
                        if (i === 2) {
                            n.m_backgroundSoundReady = 92;
                            n.m_backgroundSoundRange = 4;
                        }
                        NpcType.m_recentUse.Put(BigInt(n.id), n);
                        const s = new SeqType();
                        s.id = 101 + i;
                        s.m_priority = 3 + i;
                        s.m_duplicateBehaviour = i % 3;
                        s.frames = Int32Array.of(6, 7, 8);
                        s.delays = Int32Array.of(0, 2, 1);
                        s.sounds = [Int32Array.of(((123 + i) << 8) | 33), null, Int32Array.of((166 << 8) | 97)];
                        s.m_loops = 2;
                        s.m_maxLoops = 3;
                        s.m_preanimMove = 0;
                        s.m_postanimMove = 1;
                        SeqType.m_recentUse.Put(BigInt(s.id), s);
                        const t = new SpotType();
                        t.seq = s.id;
                        t.id = 211 + i;
                        SpotType.m_recentUse.Put(BigInt(t.id), t);
                    }
                    BASTypeList.types.Put(340n, new BASType());
                    ObjType.wearables = Int32Array.of(15000, 15001);
                    for (const id of ObjType.wearables) {
                        const t = new ObjType();
                        t.team = id - 14998;
                        ObjType.types.Put(BigInt(id), t);
                    }
                    Preferences.areaSoundVolume = Preferences.soundEffectVolume = 127;
                } else if (op === 'a') {
                    appearance = new PacketT(Buffer.from(arg, 'hex'));
                    requireNonNull(ClientApp.localPlayer).readAppearance(appearance);
                } else if (op === 'p' || op === 'n') {
                    Protocol.inPacket.m_data = Buffer.from(arg, 'hex');
                    Protocol.inPacket.m_pos = 0;
                    Protocol.packetSize = Number(size);
                    if (op === 'p') ReceivePlayerPositions.GetPlayerInfo();
                    else ClientApp.GetNPCPos();
                } else if (op === 'wirep' || op === 'wiren') {
                    const bytes = Buffer.from(arg, 'hex');
                    const savedStream = ClientApp.stream,
                        savedType = Protocol.packetType;
                    try {
                        ClientApp.stream = {
                            GetAvailable: () => bytes.length,
                            Read: async (dst, off, len) => requireNonNull(dst).set(bytes.subarray(0, len), off),
                            Write() {},
                            Close() {},
                            async read() {
                                return -1;
                            }
                        };
                        Protocol.inPacket.m_data = new Uint8Array(bytes.length);
                        Protocol.inPacket.m_pos = 4;
                        Protocol.packetSize = Number(size);
                        Protocol.packetType = op === 'wirep' ? 225 : 32;
                        if (!(await Protocol.TcpIn())) throw new Error('unexpected pending packet');
                        error = 'wire' + Protocol.packetType;
                    } finally {
                        ClientApp.stream = savedStream;
                        Protocol.packetType = savedType;
                    }
                } else if (op === 'pm' || op === 'nm') {
                    Protocol.inPacket.m_data = Buffer.from(arg, 'hex');
                    Protocol.inPacket.m_pos = 0;
                    if (op === 'pm') ReceivePlayerPositions['DecodeExtend'](9, null, Number(size));
                    else {
                        ClientApp.entityUpdateIds[0] = 9;
                        ClientApp.entityUpdateCount = 1;
                        ClientApp['GetNPCPosExtended']();
                    }
                } else {
                    ClientApp.GlMovePlayers();
                    ClientApp.GlMoveNpcs();
                    ClientApp.GlTimeoutChat();
                }
            } catch (caught) {
                let e = caught;
                while (e instanceof WrappedException && e.cause !== null) e = e.cause;
                if (e instanceof RangeError) error = e.message === '/ by zero' ? 'arithmetic' : 'bounds';
                else if (e instanceof TypeError) error = 'null';
                else if (e instanceof Error) error = e.message;
                else throw e;
            }
            if (appearance !== null) pos = appearance.m_pos;
            const values = [
                error,
                String(pos),
                String(Protocol.inPacket.m_pos),
                String(Protocol.inPacket['bitPos']),
                [ClientApp.playerLevel, ReceivePlayerPositions.m_lastNum, ClientApp.npcCount, ClientApp.entityUpdateCount, ClientApp.entityRemovalCount].join(','),
                ...[ReceivePlayerPositions.m_lastID, ClientApp.npcIds, ClientApp.entityUpdateIds, ClientApp.entityRemovalIds].map(a => String(hash(a)))
            ];
            for (const id of [2047, 9, 15, 73]) values.push(actor(ClientApp.players[id]), actor(ClientApp.npcs[id]), value(ReceivePlayerPositions.m_apCache[id]));
            values.push('[' + ClientApp.soundEffectIds.subarray(0, ClientApp.soundEffectCount).join(', ') + ']');
            const areas: string[] = [];
            for (const list of [AreaSoundManager.npcs, AreaSoundManager.players]) for (let s = list.head(); s !== null; s = list.next()) areas.push([s.delay, s.maxX, s.sound, s.radius].join(':'));
            values.push(areas.join(','));
            const expected = rows[i].split('|');
            if (Number(cycle) >= 10 && Number(cycle) <= 37 && op !== 'a') expect(error, cmd).toBe('ok');
            if (op === 'a' && Number(cycle) === 10) expect(error, cmd).toBe('ok');
            for (const [j, v] of values.entries()) expect(v, 'command ' + i + ' ' + cmd + ' field ' + j).toBe(expected[j]);
        }
    } finally {
        Protocol.inPacket = saved.incoming;
        Protocol.packetSize = saved.size;
        ClientApp.loopCycle = saved.cycle;
        ClientApp.localPlayer = saved.player;
        GameVariant.id = saved.variant;
        Preferences.soundEffectVolume = saved.sfx;
        Preferences.areaSoundVolume = saved.area;
        PlayerModel.recolourDestinations = saved.palette;
        ObjType.wearables = saved.wearables;
        AreaSoundManager.clear(true);
        ClientApp.soundEffectCount = 0;
        for (const cache of [NpcType.m_recentUse, ObjType.types, SeqType.m_recentUse, SpotType.m_recentUse, BASTypeList.types]) cache.Reset();
        rmSync(dir, { recursive: true, force: true });
    }
}, 30000);
