import ProtocolInput from './protocol-input.js';
import ClientBuild from '#/client/ClientBuild.js';
import LRUHashCache from '#/datastruct/LRUHashCache.js';
import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { join, delimiter } from 'node:path';
import { gamepackPath } from './reference.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import ClientNpc from '#/dash3d/ClientNpc.js';
import type ClientEntity from '#/dash3d/ClientEntity.js';
import MapSpotAnim from '#/dash3d/MapSpotAnim.js';
import SeqType from '#/config/SeqType.js';
import SpotType from '#/config/SpotType.js';
import ClientApp from '#/client/Client.js';
import world from '#/dash3d/world.js';
import Protocol from '#/io/Protocol.js';
import Preferences from '#/ui/Preferences.js';
import SuperPacket from '#/io/SuperPacket.js';
import PacketT from '#/io/PacketT.js';
import { requireNonNull } from '#/util/JavaArray.js';
import WrappedException from '#/util/WrappedException.js';

test('remote and local actor movement, sequences, delayed spot animations, tile effects and destination reset match rg', async () => {
    const inputStream = new ProtocolInput();
    const savedClient = ClientApp.activeClient;
    const dir = mkdtempSync(join(import.meta.dir, '../out/actor-packets-'));
    const saved = {
        cycle: ClientApp.loopCycle,
        level: ClientApp.playerLevel,
        baseX: ClientApp.mapBuildBaseX,
        baseZ: ClientApp.mapBuildBaseZ,
        destX: ClientApp.destinationX,
        destZ: ClientApp.destinationZ,
        heights: world.levelHeightmaps,
        flags: ClientBuild.m_mapl,
        seqArchive: SeqType.m_pConfigClient,
        spotArchive: SpotType.m_pConfigClient,
        seqCache: SeqType.m_recentUse,
        spotCache: SpotType.m_recentUse,
        players: ClientApp.players.slice(),
        npcs: ClientApp.npcs.slice(),
        self: ClientApp.localPlayer,
        zoneX: Protocol.zoneUpdateX,
        zoneZ: Protocol.zoneBaseZ,
        effect: Preferences.soundEffectVolume,
        area: Preferences.areaSoundVolume,
        localPid: ClientApp.localPid,
        count: ClientApp.soundEffectCount
    };
    try {
        const incoming = new SuperPacket(5000);
        ClientApp.activeClient = null;
        ClientApp.players.fill(null);
        ClientApp.npcs.fill(null);
        ClientApp.localPlayer = ClientApp.players[2047] = new ClientPlayer();
        SeqType.m_recentUse = new LRUHashCache<SeqType>(64);
        SpotType.m_recentUse = new LRUHashCache<SpotType>(64);
        SeqType.m_pConfigClient = SpotType.m_pConfigClient = null;
        Protocol.lastPacketType0 = Protocol.ptype1 = Protocol.ptype2 = 0;
        ClientApp.localPid = 73;
        ClientApp.playerLevel = 0;
        ClientApp.loopCycle = 99;
        ClientApp.mapBuildBaseX = 3000;
        ClientApp.mapBuildBaseZ = 3100;
        ClientApp.destinationX = 68;
        ClientApp.destinationZ = 89;
        world.levelHeightmaps = Array.from({ length: 4 }, (_, level) => Array.from({ length: 105 }, (_, x) => Int32Array.from({ length: 105 }, (_, z) => level * 800 + x * 41 - z * 13)));
        ClientBuild.m_mapl = Array.from({ length: 4 }, (_, level) => Array.from({ length: 104 }, (_, x) => Uint8Array.from({ length: 104 }, (_, z) => (level === 1 && ((x + z) & 1) === 0 ? 2 : 0))));
        Protocol.zoneUpdateX = Protocol.zoneBaseZ = 0;
        MapSpotAnim.active.clear();
        ClientApp.players[9] = new ClientPlayer();
        ClientApp.npcs[42] = new ClientNpc();
        const unlistedPlayer = (ClientApp.players[345] = new ClientPlayer());
        const unlistedNpc = (ClientApp.npcs[567] = new ClientNpc());
        unlistedPlayer.seq = 300;
        unlistedNpc.seq = 301;
        ClientApp.soundEffectCount = 0;
        Preferences.soundEffectVolume = Preferences.areaSoundVolume = 127;
        for (let i = 0; i < 4; i++) {
            const seq = new SeqType();
            seq.id = 101 + i;
            seq.m_priority = 3 + i;
            seq.m_duplicateBehaviour = i % 3;
            seq.frames = Int32Array.of(6, 7, 8);
            seq.delays = Int32Array.of(0, 2, 1);
            seq.sounds = [Int32Array.of(((123 + i) << 8) | 33), null, Int32Array.of((166 << 8) | 97)];
            seq.m_loops = 2;
            seq.m_maxLoops = 3;
            seq.m_preanimMove = 0;
            seq.m_postanimMove = 1;
            SeqType.m_recentUse.Put(BigInt(seq.id), seq);
            const spot = new SpotType();
            spot.seq = seq.id;
            spot.id = 211 + i;
            SpotType.m_recentUse.Put(BigInt(spot.id), spot);
        }
        const noFrames = new SeqType();
        noFrames.m_priority = 3;
        SeqType.m_recentUse.Put(105n, noFrames);
        const noFrameSpot = new SpotType();
        noFrameSpot.seq = 105;
        SpotType.m_recentUse.Put(215n, noFrameSpot);
        const staticSpot = new SpotType();
        staticSpot.id = 65535;
        SpotType.m_recentUse.Put(65535n, staticSpot);
        SeqType.m_recentUse.Put(-1n, new SeqType());
        SeqType.m_recentUse.Put(65535n, new SeqType());
        const commands: string[] = [],
            actual: string[] = [];
        const array = (a: ArrayLike<number>) => '[' + Array.from(a).join(', ') + ']';
        function actor(a: ClientEntity) {
            return array([a.z, a.x, a.pathLength, a.seqPathLength, a.seq, a.spotanim, a.spotFrame, a.spotNext, a.spotHeight, a.spotCycle, a.spotStart, a.seqDelay, a.seqLoops, a.seqFrame, a.seqCycle, a.seqNext]) + array(a.pathX) + array(a.pathZ);
        }
        async function record(op: number | 'step', bytes: Uint8Array | number) {
            const command = op + ' ' + (typeof bytes === 'number' ? bytes : Buffer.from(bytes).toString('hex'));
            commands.push(command);
            let result = 'ok';
            try {
                if (typeof bytes === 'number') {
                    for (let n = MapSpotAnim.active.head(); n !== null; n = MapSpotAnim.active.next()) n.spot.advance(bytes);
                } else {
                    incoming.m_data = bytes;
                    incoming.m_pos = 0;
                    expect(await inputStream.read(Number(op), bytes, incoming)).toBe(true);
                }
            } catch (e) {
                const cause = e instanceof WrappedException ? e.cause : e;
                if (cause instanceof RangeError) result = 'bounds';
                else if (cause instanceof TypeError) result = 'null';
                else throw e;
                if (typeof bytes !== 'number' && e instanceof WrappedException) result += '@' + e.context?.split(' ').at(-1);
            }
            const spots: string[] = [];
            for (let n = MapSpotAnim.active.head(); n !== null; n = MapSpotAnim.active.next()) {
                const a = n.spot;
                spots.push(array([a.id, a.plane, a.x, a.y, a.z, a.startCycle, a.frame, a.frameCycle, a.nextFrame, +a.finished]));
            }
            actual.push(
                [
                    result,
                    incoming.m_pos,
                    Protocol.packetType,
                    Protocol.packetSize,
                    Protocol.lastPacketType0,
                    Protocol.ptype1,
                    Protocol.ptype2,
                    ClientApp.playerLevel,
                    ClientApp.destinationX,
                    ClientApp.destinationZ,
                    actor(requireNonNull(ClientApp.localPlayer)),
                    actor(requireNonNull(ClientApp.players[9])),
                    actor(requireNonNull(ClientApp.npcs[42])),
                    ClientApp.soundEffectCount,
                    spots.join('|'),
                    unlistedPlayer.seq,
                    unlistedNpc.seq
                ].join(';')
            );
        }
        async function send(op: number, encode: (p: PacketT) => void, partial = false) {
            const packet = new PacketT(16);
            encode(packet);
            const p = requireNonNull(packet.m_data);
            if (partial) for (let i = 0; i < packet.m_pos; i++) await record(op, p.slice(0, i));
            await record(op, p.slice(0, packet.m_pos));
        }
        for (const flags of [0, 2, 1, 3, 7, 255])
            await send(
                13,
                p => {
                    p.p1_alt3(flags + 1);
                    p.p1_alt1(flags);
                    p.p1(flags + 2);
                },
                flags === 0
            );
        for (const [id, seq] of [
            [600, 101],
            [42, 101],
            [42, 103],
            [42, 102],
            [42, 103],
            [42, 65535],
            [65535, 101]
        ])
            await send(
                102,
                p => {
                    p.p2_alt1(id);
                    p.p1_alt3(7);
                    p.p2(seq);
                },
                id === 600
            );
        for (const target of [0, 0x10000000 + 73, 0x10000000 + 9, 0x10000000 + 8, 0x20000000 + 42, 0x20000000 + 77, 0x1000ffff, 0x2000ffff])
            for (const [id, delay] of [
                [211, 0],
                [214, 0],
                [212, 5],
                [65535, 0],
                [212, 8],
                [212, 0],
                [65535, 0],
                [211, 0],
                [215, 0],
                [215, 1],
                [65535, 0],
                [9000, 0],
                [212, 0],
                [65535, 0]
            ])
                await send(
                    56,
                    p => {
                        p.p2(delay);
                        p.p2_alt1(0xabcd);
                        p.p4_alt2(target);
                        p.p2_alt3(id);
                    },
                    (target === 0 && id === 211) || (target === 0x1000ffff && id === 214) || (target === 0x2000ffff && id === 214)
                );
        for (const target of [0x100007ff, 0x10000800, 0x20007fff, 0x20008000, -1, 0x80000000 | 0]) {
            await send(56, p => {
                p.p2(0);
                p.p2_alt1(32768);
                p.p4_alt2(target);
                p.p2_alt3(211);
            });
        }
        for (const [plane, x, z, id] of [
            [0, 0, 0, 211],
            [1, 103, 103, 213],
            [0, 0, 1, 212],
            [1, 5, 7, 9000],
            [2, -1, 52, 212],
            [3, 50, 104, 214],
            [3, 96, 40, 65535],
            [2, 65, 37, 215]
        ])
            await send(
                56,
                p => {
                    p.p2(3);
                    p.p2_alt1(97);
                    p.p4_alt2(0x40000000 | (plane << 28) | ((ClientApp.mapBuildBaseX + x) << 14) | (ClientApp.mapBuildBaseZ + z));
                    p.p2_alt3(id);
                },
                x === 103
            );
        // Positive terrain coordinate packet and zero-length destination-reset packet.
        await send(17, p => {
            p.p1(0x24);
            p.p2(212);
            p.p1(16);
            p.p2(21);
        });
        for (const delta of [0, 1, 1, 3, 5]) await record('step', delta);
        await send(131, () => {});
        await send(153, () => {});
        const javaSources = ['ActorPacketOracle.java', 'ActorInfoOracle.java'].map(n => join(import.meta.dir, 'game', n));
        const build = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, ...javaSources]);
        expect(build.exitCode, build.stderr.toString()).toBe(0);
        const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'ActorPacketOracle'], { stdin: Buffer.from(commands.join('\n') + '\n'), timeout: 15000 });
        expect(java.exitCode, java.stderr.toString()).toBe(0);
        const expected = java.stdout.toString().trimEnd().split(/\r?\n/);
        expect(expected.length).toBe(actual.length);
        actual.forEach((row, i) => expect(row, commands[i] + ' at ' + i).toBe(expected[i]));
    } finally {
        inputStream.restore();
        ClientApp.activeClient = savedClient;
        ClientApp.localPid = saved.localPid;
        ClientApp.loopCycle = saved.cycle;
        ClientApp.playerLevel = saved.level;
        ClientApp.mapBuildBaseX = saved.baseX;
        ClientApp.mapBuildBaseZ = saved.baseZ;
        ClientApp.destinationX = saved.destX;
        ClientApp.destinationZ = saved.destZ;
        world.levelHeightmaps = saved.heights;
        Protocol.zoneUpdateX = saved.zoneX;
        Protocol.zoneBaseZ = saved.zoneZ;
        ClientApp.soundEffectCount = saved.count;
        Preferences.soundEffectVolume = saved.effect;
        Preferences.areaSoundVolume = saved.area;
        MapSpotAnim.active.clear();
        ClientApp.localPlayer = saved.self;
        Object.assign(ClientApp.players, saved.players);
        Object.assign(ClientApp.npcs, saved.npcs);
        ClientBuild.m_mapl = saved.flags;
        SeqType.m_recentUse = saved.seqCache;
        SpotType.m_recentUse = saved.spotCache;
        SeqType.m_pConfigClient = saved.seqArchive;
        SpotType.m_pConfigClient = saved.spotArchive;
        rmSync(dir, { recursive: true, force: true });
    }
});
