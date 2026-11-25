import FriendChatChannel from '#/client/FriendChatChannel.js';
import InterfaceList from '#/ui/InterfaceList.js';
import Client from '#/client/Client.js';
import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';
import JagString, { fromJsString } from '#/datastruct/JagString.js';
import ChatHistory from '#/game/ChatHistory.js';
import Protocol from '#/io/Protocol.js';
import LocalisedText from '#/ui/LocalisedText.js';
import PacketT from '#/io/PacketT.js';
import SuperPacket from '#/io/SuperPacket.js';
import ScriptRunner from '#/script/ScriptRunner.js';
import { createChatScriptTrace } from './chat-script.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import LruHashTable from '#/datastruct/LruHashTable.js';
import { ClientScript } from '#/script/ClientScript.js';
import { clientErrorHost } from '#/util/ClientError.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { gamepackPath } from './reference.js';

const enc = (b: Uint8Array) => Buffer.from(b).toString('base64');
const text = (s: JagString | null) => (s === null ? '-' : enc(s.toBytes()));
const key = (name: string) => fromJsString(name).toBase37();
const mul = (v: number, n: number) => (Math.imul(v, 31) + n) | 0;
function hash<T>(list: Iterable<T>, fn: (v: T) => number): number {
    let n = 1;
    for (const v of list) n = mul(n, fn(v));
    return n;
}
const longs = (a: BigInt64Array) => hash(a, v => Number(BigInt.asIntN(32, v ^ (v >> 32n))));
const ints = (a: Int32Array) => hash(a, v => v);
const strings = (a: (JagString | null)[]) => hash(a, v => (v === null ? 0 : hash(v.toBytes(), b => (b << 24) >> 24)));
function snapshot(): string {
    const h = ChatHistory;
    const counts = [
        Client.friendState,
        Client.friendCount,
        Client.ignoreCount,
        FriendChatChannel.memberCount,
        FriendChatChannel.selfRank,
        FriendChatChannel.minKick,
        h.count,
        Client.chatPublicMode,
        Client.chatPrivateMode,
        Client.chatTradeMode,
        Client.friendListTransmitCycle,
        Client.clanTransmitCycle,
        Client.chatTransmitCycle,
        InterfaceList.miscTransmitAt
    ];
    let clan = FriendChatChannel.members === null ? 0 : 1;
    if (FriendChatChannel.members !== null)
        for (const m of FriendChatChannel.members) {
            clan = mul(clan, m === null ? 0 : 1);
            if (m !== null) {
                clan = mul(clan, Number(BigInt.asIntN(32, m.key ^ (m.key >> 32n))));
                clan = mul(clan, m.rank);
                clan = mul(clan, m.world);
                clan = mul(clan, strings([m.name, m.worldName]));
            }
        }
    return [
        '[' + counts.join(', ') + ']',
        longs(Client.friendName37),
        strings(Client.friendUsername),
        ints(Client.friendWorld),
        strings(Client.friendWorldName),
        ints(Client.friendRank),
        hash(Client.friendSameGame, n => (n ? 1231 : 1237)),
        longs(Client.ignoreName37),
        strings(Client.ignoreNames),
        clan,
        strings([FriendChatChannel.channelName, FriendChatChannel.ownerName]),
        ints(h.types),
        strings(h.names),
        strings(h.text),
        strings(h.clans),
        ints(h.phrases)
    ].join('|');
}
test('all 530 friend, ignore and clan tables, history slots and CS2 outputs retain the same contents as the gamepack after each update', async () => {
    const rows: string[] = [],
        results: string[] = [],
        current = fromJsString('Alice'),
        h = ChatHistory;
    const outgoing = new SuperPacket(5000);
    outgoing.SetEnc(Int32Array.of(1, 2, 3, 4));
    const oldOut = Client.out,
        oldSelf = Client.localPlayer,
        oldMember = Client.playerMember;
    const socialFields = [
        'country',
        'friendState',
        'friendCount',
        'ignoreCount',
        'friendListTransmitCycle',
        'clanTransmitCycle',
        'friendUsername',
        'friendName37',
        'friendWorld',
        'friendWorldName',
        'friendRank',
        'friendSameGame',
        'ignoreName37',
        'ignoreNames'
    ] as const;
    const savedSocial = socialFields.map(field => [field, Client[field]] as const);
    const savedClan = Object.getOwnPropertyDescriptors(FriendChatChannel);
    const savedMisc = InterfaceList.miscTransmitAt;
    const savedHistory = Object.getOwnPropertyDescriptors(ChatHistory);
    const savedChat = {
        modeWhere: Client.modeWhere,
        transmitCycle: Client.transmitCycle,
        chatTransmitCycle: Client.chatTransmitCycle,
        chatPublicMode: Client.chatPublicMode,
        chatPrivateMode: Client.chatPrivateMode,
        chatTradeMode: Client.chatTradeMode
    };
    for (const field of ['friendUsername', 'friendName37', 'friendWorld', 'friendWorldName', 'friendRank', 'friendSameGame', 'ignoreName37', 'ignoreNames'] as const) {
        Reflect.set(Client, field, Client[field].slice());
    }
    for (const field of ['types', 'names', 'text', 'clans', 'phrases'] as const) Reflect.set(h, field, h[field].slice());
    const originalWorldNames = Client.friendWorldName;
    const originalRanks = Client.friendRank;
    const oldCache = ClientScript.m_cache,
        oldMessage = ScriptRunner.activeQuickChatMessage;
    const oldCrown = ScriptRunner.crownTag0,
        oldStaffCrown = ScriptRunner.img1Tag;
    const oldResults = Client.searchResults,
        oldCount = Client.resultCount,
        oldIndex = Client.searchResultIndex;
    const oldInts = ScriptRunner.intStack.slice(),
        oldStrings = ScriptRunner.stringStack.slice();
    Client.out = outgoing;
    const actor = (Client.localPlayer = new ClientPlayer());
    actor.username = current;
    Client.playerMember = false;
    ClientScript.m_cache = new LruHashTable<ClientScript>(128);
    ScriptRunner.activeQuickChatMessage = null;
    Client.searchResults = null;
    Client.resultCount = Client.searchResultIndex = 0;
    const savedWorld = Client.selectedWorldId;
    const savedStream = Client.stream;
    const savedProtocol = {
        inPacket: Protocol.inPacket,
        packetSize: Protocol.packetSize,
        packetType: Protocol.packetType,
        lastPacketType0: Protocol.lastPacketType0,
        ptype1: Protocol.ptype1,
        ptype2: Protocol.ptype2,
        idleReads: Protocol.idleReads
    };
    Client.selectedWorldId = 530;
    Protocol.inPacket = new SuperPacket(5000);
    const step = (row: string, op: () => string | void) => {
        rows.push(row);
        const answer = op() ?? '';
        results.push(answer + '#' + snapshot());
    };
    const traceScript = createChatScriptTrace(outgoing);
    const script = (...args: Parameters<typeof traceScript>) => {
        const trace = traceScript(...args);
        step(trace.command, () => trace.result);
    };
    const packet = async (op: number, write: (p: PacketT) => void) => {
        const p = new PacketT(5000);
        write(p);
        const body = requireNonNull(p.m_data).subarray(0, p.m_pos);
        Client.stream = {
            GetAvailable: () => body.length,
            Read: async (dst, off, len) => {
                requireNonNull(dst).set(body.subarray(0, len), off);
            },
            Write() {},
            Close() {},
            async read() {
                return -1;
            }
        };
        Protocol.packetType = op;
        Protocol.packetSize = body.length;
        let result: string;
        try {
            result = String(await Protocol.TcpIn());
        } catch {
            result = 'exception';
        }
        step('recv ' + op + ' ' + enc(body), () => [result, Protocol.inPacket.m_pos, Protocol.packetType].join('|'));
    };
    const friend = (name: string, world: number, rank: number, flag: boolean) => {
        return packet(62, p => {
            p.p8(key(name) | (flag ? 0n : 1n << 63n));
            p.p2(world);
            p.p1(rank);
            if (world) p.pStringNoConversion(fromJsString('World ' + world), 0);
        });
    };
    const clan = (owner: string, guild: string, count: number, members: [string, number, number][] = []) => {
        return packet(55, p => {
            p.p8(key(owner));
            if (owner) {
                p.p8(key(guild));
                p.p1(-12);
                p.p1(count);
                for (const [name, world, rank] of members) {
                    p.p8(key(name));
                    p.p2(world);
                    p.p1(rank);
                    p.pStringNoConversion(fromJsString('W' + world), 0);
                }
            }
        });
    };
    const change = (name: string, world: number, rank: number, remove = false) => {
        return packet(196, p => {
            p.p8(key(name) | (remove ? 1n << 63n : 0n));
            p.p2(world);
            p.p1(rank);
            if (!remove) p.pStringNoConversion(fromJsString('World ' + world), 0);
        });
    };
    const savedLabels = { ...LocalisedText };
    const savedLang = LocalisedText.language,
        savedId = clientErrorHost.username,
        savedArea = Client.withinTutorialIsland;
    const directory = mkdtempSync(join(tmpdir(), 'social530-'));
    try {
        Client.modeWhere = 0; // SocialOracle starts with d.c = 0, including its failing scripts.
        Client.friendCount = Client.friendState = FriendChatChannel.memberCount = 0;
        FriendChatChannel.members = FriendChatChannel.channelName = null;
        Client.country = 42;
        Client.ignoreCount = FriendChatChannel.minKick = FriendChatChannel.selfRank = Client.friendListTransmitCycle = Client.clanTransmitCycle = InterfaceList.miscTransmitAt = 0;
        FriendChatChannel.ownerName = null;
        Client.friendName37.fill(0n);
        Client.ignoreName37.fill(0n);
        for (const list of [Client.ignoreNames, Client.friendUsername, Client.friendWorldName]) list.fill(null);
        Client.friendRank.fill(0);
        Client.friendWorld.fill(0);
        Client.friendSameGame.fill(0);
        h.text.fill(null);
        h.count = 0;
        Client.chatTransmitCycle = 0;
        Client.transmitCycle = 1;
        h.names.fill(null);
        h.clans.fill(null);
        h.types.fill(0);
        h.phrases.fill(0);
        Client.chatPublicMode = Client.chatPrivateMode = Client.chatTradeMode = 0;
        clientErrorHost.username = current.toBase37();
        Client.withinTutorialIsland = 0;
        step('worldNames short', () => {
            Reflect.set(Client, 'friendWorldName', []);
        });
        await friend('New slot', 1, 44, false);
        step('worldNames normal', () => {
            Reflect.set(Client, 'friendWorldName', originalWorldNames);
        });
        await friend('', 530, 0, true);
        step('sortEdge prepare', () => {
            Client.friendCount = 2;
            Client.friendName37[0] = key('Before');
            Client.friendName37[1] = key('Next');
            Client.friendUsername[0] = requireNonNull(JagString.fromBase37(Client.friendName37[0])).formatName(0);
            Client.friendUsername[1] = requireNonNull(JagString.fromBase37(Client.friendName37[1])).formatName(0);
            Client.friendWorld[0] = 17;
            Client.friendWorld[1] = Client.selectedWorldId;
            Reflect.set(Client, 'friendRank', Int32Array.of(19));
        });
        await friend('Before', 1, 27, true);
        step('sortEdge restore', () => {
            Reflect.set(Client, 'friendRank', originalRanks);
            Client.friendCount = 0;
        });
        await change('No list', 1, 3);
        await change('Missing', 1, 3, true);
        await clan('First owner', 'First list', 1, [['Jane', 7, 19]]);
        await clan('Second owner', 'Bad name', 2, [
            ['Alice', 22, -10],
            ['', 7, 1]
        ]);
        await clan(
            'Third owner',
            'Long list',
            101,
            Array.from({ length: 101 }, (_, i) => ['A' + i, 1, 3])
        );
        await clan('', '', 0);
        await packet(126, p => {
            for (let i = 0; i < 101; i++) p.p8(key('Ignore' + i));
        });
        step('area 1', () => {
            Client.withinTutorialIsland = 1;
        });
        for (const value of ['Ignore7:tradereq:', 'Unknown:tradereq:', 'Unknown:clan:', 'X:trade:']) {
            await packet(70, p => p.pStringNoConversion(fromJsString(value), 0));
        }
        step('area 0', () => {
            Client.withinTutorialIsland = 0;
        });
        await packet(126, p => p.p8(key('Ignored')));
        for (const value of [':chalreq:', ':allyreq:', 'Ignored:a:allyreq:', 'Ignored:duelfriend:', 'Alice:a:b:c:chalreq:', 'Alice:a:b:c:allyreq:', 'A:TRADE:', 'Notice:trade::trade:']) {
            await packet(70, p => p.pStringNoConversion(fromJsString(value), 0));
        }
        script(3604, [319], [null]);
        script(3604, [], [null]);
        for (const op of [3605, 3606, 3607, 3608, 3609, 3617, 3619, 3623, 3628]) script(op, [], [null]);
        for (const op of [3601, 3602, 3603, 3610, 3622, 3627]) script(op, [-1], [], [3601, 3610, 3622].includes(op) ? 's' : 'i');
        step('self missing', () => {
            Client.localPlayer = null;
        });
        script(3609, [], ['Alice'], 'i');
        script(3605, [], ['Alice']);
        script(3607, [], ['Alice']);
        step('self present', () => {
            Client.localPlayer = actor;
        });
        step('crowns second', () => {
            ScriptRunner.img1Tag = null;
        });
        for (const op of [3609, 3623, 3628]) {
            script(op, [], ['<img=0>Alice'], 'i');
            script(op, [], ['Alice'], 'i');
        }
        step('crowns first', () => {
            ScriptRunner.crownTag0 = null;
            ScriptRunner.img1Tag = oldStaffCrown;
        });
        script(3609, [], ['<img=1>Alice'], 'i');
        step('crowns normal', () => {
            ScriptRunner.crownTag0 = oldCrown;
        });
        step('worldNames short', () => {
            Object.assign(Client, { friendWorldName: [] });
        });
        script(3605, [], ['Truncated A']);
        step('worldNames normal', () => {
            Object.assign(Client, { friendWorldName: originalWorldNames });
        });
        for (const name of ['Truncated A', 'Truncated B']) script(3605, [], [name]);
        step('worldNames short', () => {
            Object.assign(Client, { friendWorldName: [] });
        });
        script(3606, [], ['Truncated A']);
        step('worldNames normal', () => {
            Object.assign(Client, { friendWorldName: originalWorldNames });
        });
        script(3606, [], ['Truncated A']);
        for (const lang of [1, 2]) {
            step('language ' + lang, () => {
                LocalisedText.setLanguage(lang);
                LocalisedText.language = lang;
            });
            script(3600, [], [], 'i');
            script(3621, [], [], 'i');
            script(3629, [], [], 'i');
            await packet(197, p => p.p1(1));
            script(3600, [], [], 'i');
            await packet(197, p => p.p1(2));
            await packet(126, p => {
                p.p8(key('Gwen'));
                p.p8(key('Fred'));
                p.p1(99);
            });
            for (const name of ['Alice', 'Gwen', 'Bob', 'Bob', 'Anna', 'Seth', 'Fred']) script(3605, [], [name]);
            for (const name of ['Bob', 'Alice', 'Al', 'Gwen', 'Fred']) script(3607, [], [name]);
            script(3604, [19], ['Bob']);
            script(3606, [], ['No one']);
            script(3606, [], ['Anna']);
            script(3608, [], ['Fred']);
            for (const [name, world, rank, flag] of [
                ['Bob', 1, 3, true],
                ['Bob', 530, 0, false],
                ['Seth', 530, 255, false],
                ['X A', 16, 200, true],
                ['Bob', 0, 2, true],
                ['Bob', 16, 4, true],
                ['Bob', 16, 4, true]
            ] as const)
                await friend(name, world, rank, flag);
            for (const op of [3601, 3602, 3603, 3610, 3622, 3627]) for (const i of [-1, 0, 1, 2, 5, 200]) script(op, [i], [], [3601, 3610, 3622].includes(op) ? 's' : 'i');
            for (const op of [3609, 3623, 3628]) for (const name of ['Alice', 'gWEN', '<img=0>bOB', '<img=1>AL', 'Nobody']) script(op, [], [name], 'i');
            await clan('Leader', 'guild', 3, [
                ['Zed', 1, -1],
                ['Alice', 530, 64],
                ['Betty', 5, 3]
            ]);
            await change('Betty', 77, -8);
            await change('Axel', 1, 4);
            await change('Alice', 9, 1, true);
            await change('Alice', 530, 1, true);
            await change('Axel', 1, 1, true);
            await change('Alice', 4, 92);
            await clan('Owner 2', 'new guild', 255);
            script(3617, [], ['Betty']);
            script(3619, [], ['Guild']);
            script(3620);
            for (const op of [3611, 3612, 3616, 3618, 3625]) script(op, [], [], op === 3611 || op === 3625 ? 's' : 'i');
            for (const op of [3613, 3614, 3615, 3624, 3626]) for (const i of [-1, 0, 1, 2, 99]) script(op, [i], [], op === 3613 || op === 3626 ? 's' : 'i');
            script(3617, [], [null]);
            await clan('', '', 0);
            await change('Ghost', 9, 1, true);
            for (const area of [0, 1]) {
                step('area ' + area, () => {
                    Client.withinTutorialIsland = area;
                });
                for (const value of [
                    'ordinary',
                    'Ann:tradereq:',
                    'Gwen:tradereq:',
                    'Bob:abc:chalreq:',
                    'Ann:assistreq:',
                    'Gwen:assistreq:',
                    'X:clan:',
                    'X:trade:',
                    'X:assist:',
                    'Z:duelstake:',
                    'Z:duelfriend:',
                    'Z:clanreq:',
                    'Z:hello:allyreq:',
                    'repeat:clan::clan:'
                ])
                    await packet(70, p => p.pStringNoConversion(fromJsString(value), 0));
            }
            step('tick', () => {
                Client.transmitCycle++;
            });
        }
        await packet(232, p => {
            p.p1(5);
            p.p1(200);
            p.p1(255);
        });
        script(5000, [], [], 'i');
        script(5005, [], [], 'i');
        script(5016, [], [], 'i');
        script(5001, [9, -90, 300]);
        script(5002, [0, 4], ['Someone']);
        for (let i = 0; i < 105; i++) {
            const phrase = i - 3,
                body = i % 7 ? fromJsString('body ' + i) : null,
                clan = i % 2 ? null : fromJsString('members'),
                name = i % 5 ? fromJsString('user ' + i) : null;
            step(['add', phrase, text(body), text(clan), i % 19, text(name)].join(' '), () => h.AddChat(phrase, body, clan, i % 19, name));
        }
        for (const i of [0, 1, 2, 7, 98, 99, 100, 200]) for (const op of [5003, 5004, 5010, 5011, 5012]) script(op, [i], [], op === 5004 || op === 5012 ? 'i' : 's');
        script(5017, [], [], 'i');
        for (let i = 0; i < 102; i++) script(3605, [], ['F' + i]);
        step('member 1', () => {
            Client.playerMember = true;
        });
        for (let i = 103; i < 206; i++) script(3605, [], ['F' + i]);
        for (let i = 0; i < 103; i++) script(3607, [], ['I' + i]);
        const java = (name: string) => fileURLToPath(new URL('./game/' + name + '.java', import.meta.url));
        const build = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', directory, java('ChatOracle'), java('SocialOracle')]);
        expect(build.stderr.toString()).toBe('');
        expect(build.exitCode).toBe(0);
        const result = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', directory + delimiter + gamepackPath, 'SocialOracle'], { stdin: Buffer.from(rows.join('\n')), maxBuffer: 4 * 1024 * 1024, timeout: 20000 });
        expect(result.stderr.toString()).toBe('');
        expect(result.exitCode).toBe(0);
        const expected = result.stdout.toString().trimEnd().split(/\r?\n/);
        expect(expected.length).toBe(rows.length);
        for (let i = 0; i < rows.length; i++) expect(results[i], i + ' ' + rows[i]).toBe(expected[i]);
    } finally {
        Client.stream = savedStream;
        Object.assign(Protocol, savedProtocol);
        Client.out = oldOut;
        Client.localPlayer = oldSelf;
        Client.playerMember = oldMember;
        for (const [field, value] of savedSocial) Reflect.set(Client, field, value);
        Object.defineProperties(FriendChatChannel, savedClan);
        InterfaceList.miscTransmitAt = savedMisc;
        Object.defineProperties(h, savedHistory);
        Object.assign(Client, savedChat);
        ClientScript.m_cache = oldCache;
        ScriptRunner.activeQuickChatMessage = oldMessage;
        ScriptRunner.crownTag0 = oldCrown;
        ScriptRunner.img1Tag = oldStaffCrown;
        Client.searchResults = oldResults;
        Client.resultCount = oldCount;
        Client.searchResultIndex = oldIndex;
        ScriptRunner.intStack.set(oldInts);
        for (let i = 0; i < oldStrings.length; i++) ScriptRunner.stringStack[i] = oldStrings[i];
        Client.selectedWorldId = savedWorld;
        Object.assign(LocalisedText, savedLabels);
        LocalisedText.language = savedLang;
        clientErrorHost.username = savedId;
        Client.withinTutorialIsland = savedArea;
        rmSync(directory, { recursive: true, force: true });
    }
}, 30000);
