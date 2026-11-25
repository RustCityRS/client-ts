import QuickChatCatTypeList from '#/config/QuickChatCatTypeList.js';
import QuickChatPhraseTypeList from '#/config/QuickChatPhraseTypeList.js';
import ChatHistory from '#/game/ChatHistory.js';
import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import EnumType from '#/config/EnumType.js';
import ClientQuickChatCommandDecoder from '#/config/ClientQuickChatCommandDecoder.js';
import JagString, { fromJsString } from '#/datastruct/JagString.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import PlayerModel from '#/dash3d/PlayerModel.js';
import Protocol from '#/io/Protocol.js';
import ReceivePlayerPositions from '#/client/ReceivePlayerPositions.js';
import Client from '#/client/Client.js';
import InterfaceList from '#/ui/InterfaceList.js';
import { createChatScriptTrace } from './chat-script.js';
import { ClientScript } from '#/script/ClientScript.js';
import LruHashTable from '#/datastruct/LruHashTable.js';
import Huffman from '#/io/Huffman.js';
import PacketT from '#/io/PacketT.js';
import SuperPacket from '#/io/SuperPacket.js';
import WordPack from '#/io/WordPack.js';
import ScriptRunner from '#/script/ScriptRunner.js';
import LocalisedText from '#/ui/LocalisedText.js';
import { requireNonNull } from '#/util/JavaArray.js';
import WrappedException from '#/util/WrappedException.js';
import { localAssets, readGroup } from './cachefile.js';
import { cachePath, gamepackPath } from './reference.js';

const enc = (b: Uint8Array) => Buffer.from(b).toString('base64');
const word = (s: JagString | null) => (s === null ? '-' : enc(s.toBytes()));
const array = (v: Int32Array | null) => (v === null ? 'null' : '[' + Array.from(v).join(', ') + ']');

test('chat insertion preserves the JAR history rows and counters after partial shifts', () => {
    const dir = mkdtempSync(join(tmpdir(), '530-chat-history-'));
    const fields = ['types', 'names', 'text', 'clans', 'phrases'] as const;
    const saved = fields.map(field => ChatHistory[field]);
    const count = ChatHistory.count,
        changed = Client.chatTransmitCycle,
        cycle = Client.transmitCycle;
    const labels = [null, fromJsString('a'), fromJsString('b'), fromJsString('c')];
    try {
        const source = fileURLToPath(new URL('./game/ChatOracle.java', import.meta.url));
        const compile = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, source]);
        expect(compile.exitCode, compile.stderr.toString()).toBe(0);
        const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'ChatOracle', 'history']);
        expect(java.exitCode, java.stderr.toString()).toBe(0);
        const expected = java.stdout.toString().trimEnd().split(/\r?\n/);
        let row = 0;
        for (let method = 0; method < 3; method++)
            for (const [index] of fields.entries())
                for (const len of [-1, 0, 98, 99, 100, 101]) {
                    for (const [i, field] of fields.entries()) {
                        const length = i === index ? len : 100;
                        const value = length < 0 ? null : field === 'types' || field === 'phrases' ? Int32Array.from({ length }, (_, j) => i * 109 + j) : Array.from({ length }, (_, j) => labels[(i + j) % 4]);
                        Reflect.set(ChatHistory, field, value);
                    }
                    ChatHistory.count = 0x7fffffff;
                    Client.chatTransmitCycle = -3;
                    Client.transmitCycle = 17;
                    let outcome = 'ok';
                    try {
                        if (method === 0) ChatHistory.AddChat(73, labels[1], labels[2], 19, labels[3]);
                        if (method === 1) Client.AddChat(labels[1], labels[3], 6);
                        if (method === 2) Client.AddChat2(labels[3], labels[1], labels[2], 9);
                    } catch {
                        outcome = 'exception';
                    }
                    const hashes = fields.map(field => {
                        const array = ChatHistory[field];
                        if (array === null) return 0;
                        let hash = 1;
                        for (const item of array) hash = (Math.imul(31, hash) + (typeof item === 'number' ? item : labels.indexOf(item))) | 0;
                        return hash;
                    });
                    expect([outcome, ChatHistory.count, Client.chatTransmitCycle, ...hashes].join('|')).toBe(expected[row++]);
                }
        expect(row).toBe(expected.length);
    } finally {
        fields.forEach((field, i) => Reflect.set(ChatHistory, field, saved[i]));
        ChatHistory.count = count;
        Client.chatTransmitCycle = changed;
        Client.transmitCycle = cycle;
        rmSync(dir, { recursive: true, force: true });
    }
});

test('real quick-chat definitions, ordinary and quick chat packet handlers, public player masks and CS2 sends match client.jar', async () => {
    const cache = cachePath,
        jar = gamepackPath;
    const dir = mkdtempSync(join(tmpdir(), '530-chat-')),
        assets = localAssets(cache, [10, 24, 25, 17, 19]);
    const huffman = requireNonNull(assets.file(10, assets.groupId(10, 'huffman')));
    const oldCodec = WordPack['codec'],
        oldDecoder = QuickChatPhraseTypeList.decoder,
        oldLabels = { ...LocalisedText };
    const local = assets.archive(24),
        global = assets.archive(25);
    const rows: string[] = [],
        actual: string[] = [];
    const add = (key: string, value: string | number) => {
        rows.push(key);
        actual.push(String(value));
    };
    const sender = fromJsString('Alice').toBase37(),
        clan = fromJsString('blue guild').toBase37();
    const outgoing = new SuperPacket(5000);
    outgoing.SetEnc(Int32Array.of(1, 2, 3, 4));
    const oldPrefixes = ClientPlayer.titlePrefixes,
        oldSuffixes = ClientPlayer.nameSuffixes;
    ClientPlayer.titlePrefixes = null;
    ClientPlayer.nameSuffixes = null;
    const oldTop = InterfaceList.top,
        oldMode = Client.modeWhere;
    const oldCache = ClientScript.m_cache,
        oldMessage = ScriptRunner.activeQuickChatMessage;
    const oldResults = Client.searchResults,
        oldCount = Client.resultCount,
        oldIndex = Client.searchResultIndex;
    const oldInts = ScriptRunner.intStack.slice(),
        oldStrings = ScriptRunner.stringStack.slice();
    ClientScript.m_cache = new LruHashTable<ClientScript>(128);
    ScriptRunner.activeQuickChatMessage = null;
    Client.searchResults = null;
    Client.searchResultIndex = Client.resultCount = 0;
    InterfaceList.top = -1;
    Client.modeWhere = 0;
    const savedStream = Client.stream;
    const savedChat = { types: ChatHistory.types, phrases: ChatHistory.phrases, text: ChatHistory.text, names: ChatHistory.names, clans: ChatHistory.clans, count: ChatHistory.count };
    const savedChatState = {
        privateMessageIds: Client.privateMessageIds,
        privateMessageCount: Client.privateMessageCount,
        withinTutorialIsland: Client.withinTutorialIsland,
        chatTransmitCycle: Client.chatTransmitCycle,
        transmitCycle: Client.transmitCycle,
        chatPublicMode: Client.chatPublicMode,
        chatPrivateMode: Client.chatPrivateMode,
        chatTradeMode: Client.chatTradeMode
    };
    const savedIgnoreIds = Client.ignoreName37,
        savedIgnoreCount = Client.ignoreCount;
    const savedReader = { inPacket: Protocol.inPacket, packetType: Protocol.packetType, packetSize: Protocol.packetSize, lastPacketType0: Protocol.lastPacketType0, ptype1: Protocol.ptype1, ptype2: Protocol.ptype2, idleReads: Protocol.idleReads };
    Protocol.inPacket = new SuperPacket(5000);
    const savedPacket = Client.out,
        savedAccount = { underage: Client.underage, parentalChatConsent: Client.parentalChatConsent, mapQuickChat: Client.mapQuickChat, staffModLevel: Client.staffModLevel },
        previousSelf = Client.localPlayer;
    const baseX = Client.mapBuildBaseX,
        baseZ = Client.mapBuildBaseZ;
    Client.out = outgoing;
    Object.assign(Client, { underage: false, parentalChatConsent: false, mapQuickChat: false, staffModLevel: 0 });
    const actor = new ClientPlayer();
    actor.username = fromJsString('Alice');
    const appearance = new PlayerModel();
    const log = () => [ChatHistory.count, ChatHistory.types[0], word(ChatHistory.text[0]), word(ChatHistory.names[0]), word(ChatHistory.clans[0]), ChatHistory.phrases[0]].join('|');
    const traceScript = createChatScriptTrace(outgoing);
    const script = (...args: Parameters<typeof traceScript>) => {
        const trace = traceScript(...args);
        add(trace.command, trace.result);
    };
    const policy = (under: number, consent: number, quick: number, rights: number, area: number, ignore: number) => {
        Object.assign(Client, { underage: !!under, parentalChatConsent: !!consent, mapQuickChat: !!quick, staffModLevel: rights });
        Client.withinTutorialIsland = area;
        Client.ignoreCount = ignore;
        Client.ignoreName37[0] = sender;
        add(['policy', under, consent, quick, rights, area, ignore].join(' '), 'ok');
    };
    let counter = 0;
    const message = (op: number, rights: number, phrase: number, id: number, senderId = sender, clanId = clan) => {
        const p = new PacketT(200);
        p.p8(senderId);
        if (op === 54 || op === 81) {
            p.p1(255);
            p.p8(clanId);
        }
        if (op !== 71 && op !== 141) {
            p.p2(530);
            p.p3(id);
            p.p1(rights);
        }
        if (op === 81 || op === 141 || op === 247) {
            p.p2(phrase);
            p.p4(0);
            p.p8(0n);
        } else WordPack.write(fromJsString('  hELLO, <TAG>. hERE!  '), p);
        return requireNonNull(p.m_data).subarray(0, p.m_pos);
    };
    const readSocket = (op: number, bytes: Uint8Array) => {
        Client.stream = {
            GetAvailable: () => bytes.length,
            Read: async (dst, offset, length) => requireNonNull(dst).set(bytes.subarray(0, length), offset),
            Write() {},
            Close() {},
            async read() {
                return -1;
            }
        };
        Protocol.packetType = op;
        Protocol.packetSize = bytes.length;
        return Protocol.TcpIn();
    };
    const receive = async (op: number, rights: number, phrase: number, id = ++counter) => {
        const bytes = message(op, rights, phrase, id);
        expect(await readSocket(op, bytes)).toBe(true);
        expect(Protocol.packetType).toBe(-1);
        add('recv ' + op + ' ' + enc(bytes), log() + '|' + Protocol.inPacket.m_pos);
    };
    const player = (quick: boolean, rights: number, phrase: number, present = true) => {
        const payload = new PacketT(200);
        if (quick) {
            payload.p2(phrase);
            payload.p8(0n);
        } else WordPack.write(fromJsString('  tEsT <M>. x  '), payload);
        const msg = requireNonNull(payload.m_data).slice(0, payload.m_pos).reverse();
        const p = new PacketT(200),
            flags = (quick ? 0x8000 : 0) | 0xab3;
        p.p2_alt1(flags);
        p.p1(rights);
        p.p1(msg.length);
        p.pArrayBuffer(msg, msg.length, 0);
        const body = enc(requireNonNull(p.m_data).subarray(0, p.m_pos));
        requireNonNull(Protocol.inPacket.m_data).set(requireNonNull(p.m_data).subarray(0, p.m_pos));
        Protocol.inPacket.m_pos = 0;
        actor.appearance = present ? appearance : null;
        ReceivePlayerPositions['DecodeExtend'](1, actor, 128);
        add('public ' + body + ' ' + Number(present), [log(), word(actor.overheadText), [actor.chatColour, actor.chatEffect, actor.chatTimer].join(','), Protocol.inPacket.m_pos].join('|'));
    };
    try {
        ChatHistory.count = 0;
        ChatHistory.text = new Array(100).fill(null);
        ChatHistory.names = new Array(100).fill(null);
        ChatHistory.clans = new Array(100).fill(null);
        ChatHistory.phrases = new Int32Array(100);
        ChatHistory.types = new Int32Array(100);
        Client.privateMessageIds = new BigInt64Array(100);
        Reflect.set(Client, 'ignoreName37', new BigInt64Array(100));
        Client.privateMessageCount = 0;
        WordPack.setCodec(new Huffman(huffman));
        QuickChatPhraseTypeList['phrases'].Reset();
        QuickChatCatTypeList['types'].Reset();
        QuickChatPhraseTypeList.init(global, null, local);
        QuickChatCatTypeList.init(local, global);
        const header = [enc(huffman), ...[24, 25, 17, 19].map(id => [enc(readGroup(cache, 255, id)), ...Array.from(requireNonNull(requireNonNull(assets.index(id)).groupIds), group => group + ':' + enc(readGroup(cache, id, group)))].join(' '))];
        let firstPhrase = 0,
            withNumber = -1,
            catId = 0;
        const enums = new Set<number>();
        for (const [ar, base] of [
            [local, 0],
            [global, 32768]
        ] as const) {
            for (const file of requireNonNull(ar.GetFileList(0))) {
                const id = file + base,
                    c = QuickChatCatTypeList.GetQuickChatCatType(id);
                let hash = 1;
                for (let k = -1; k <= 256; k++) {
                    hash = (Math.imul(hash, 31) + c.GetSubCategoryIdByCharacter(k)) | 0;
                    hash = (Math.imul(hash, 31) + c.GetPhraseIdByCharacter(k)) | 0;
                }
                add('category ' + id, [id, word(c.description), array(c.categories), array(c.phrases), array(c.categoryKeys), array(c.phraseKeys), hash].join('|'));
                if (base === 0 && c.categories?.length && c.phrases?.length) catId = id;
            }
            for (const file of requireNonNull(ar.GetFileList(1))) {
                const id = file + base,
                    t = QuickChatPhraseTypeList.GetQuickChatPhraseType(id),
                    p = new PacketT(256);
                requireNonNull(p.m_data).fill(0xda);
                const body = word(t.GetText(p)) + ',' + p.m_pos;
                p.m_pos = 0;
                t.PackTransmitValues(p, new Int32Array(t.commandCount()).fill(-224));
                const params = t['params'];
                add(
                    'phrase ' + id,
                    [id, t.m_searchable, word(t.GetTextDisplay()), array(t.responses), array(t['commands']), params === null ? 'null' : '[' + params.map(array).join(', ') + ']', body, enc(requireNonNull(p.m_data).subarray(0, p.m_pos))].join('|')
                );
                if (base === 0 && t.commandCount() === 0 && t.responses?.length) firstPhrase = id;
                if (base === 0 && t.commandCount() > 0 && t.GetDynamicCommand(0) === 0) withNumber = id;
                for (let i = 0; i < t.commandCount(); i++) if ([0, 6, 7, 11].includes(t.GetDynamicCommand(i))) enums.add(t.GetDynamicCommandParameter(0, i));
            }
        }
        const decoder = new ClientQuickChatCommandDecoder();
        for (const n of [-(1n << 63n), -(1n << 62n), -91n, -1n, 0n, 1n, 35n, 91n, (1n << 63n) - 1n]) {
            add('decimal ' + n, word(JagString.fromLong(n)));
            for (const radix of [1, 2, 3, 10, 16, 36, 37])
                for (const start of [-1, 0, 1, 23])
                    for (const plus of [false, true]) {
                        let result;
                        try {
                            result = word(JagString.formatLong(start, n, plus, radix));
                        } catch {
                            result = 'threw';
                        }
                        add(['long', start, n, Number(plus), radix].join(' '), result);
                    }
        }
        for (const enumId of enums) {
            const type = EnumType.List(enumId),
                first = type.entries?.head();
            const keys = first ? [first.key, -1n, first.key + (1n << 32n)] : [-1n, 0n];
            for (const value of keys) for (const command of [0, 6, 7, 11]) add(['decoder', command, value, enumId].join(' '), word(decoder.decodeValue(value, command, Int32Array.of(enumId))));
        }
        for (const value of [0n, 4151n, 995n, 1961n, -1n, 4294968291n]) {
            for (const command of [1, 2, 3, 4, 5, 8, 9, 10, 12, 13, 14, 15]) add(['decoder', command, value, 0].join(' '), word(decoder.decodeValue(value, command, Int32Array.of(0))));
        }
        // The JVM logs the script and opcode, keeps partial output, and continues with the next hook.
        for (const op of [5059, 5060, 5061, 5068, 5069]) script(op);
        script(5060, [], [null]);
        script(5050);
        for (const op of [5052, 5054, 5062, 5063]) {
            script(op, [catId, -1], [], 'i');
            script(op, [catId, 0x7fffffff], [], 'i');
        }
        script(5057, [firstPhrase, -1], [], 'i');
        script(5067, [withNumber, QuickChatPhraseTypeList.GetQuickChatPhraseType(withNumber).commandCount()], [], 'i');
        script(5070, [firstPhrase, 0, 0], [], 'i');
        for (const op of [5050, 5051, 5052, 5053, 5054, 5062, 5063, 5064, 5065]) {
            const two = [5052, 5054, 5062, 5063, 5064, 5065].includes(op);
            script(op, two ? [catId, 0] : [catId], [], op === 5050 ? 's' : 'i');
        }
        script(5055, [firstPhrase], [], 's');
        script(5056, [firstPhrase], [], 'i');
        script(5057, [firstPhrase, 0], [], 'i');
        script(5058, [withNumber]);
        script(5066, [withNumber], [], 'i');
        script(5067, [withNumber, 0], [], 'i');
        script(5070, [withNumber, 0, 0], [], 'i');
        script(5068, [-1, 65534]);
        script(5069, [QuickChatPhraseTypeList.GetQuickChatPhraseType(withNumber).commandCount(), 42]);
        script(5068, [0, 65534]);
        script(5059);
        script(5069, [0, 65432]);
        script(5060, [], ['A name']);
        script(5061);
        for (const [phrase, glob] of [
            ['', 0],
            ['fish', 0],
            ['could you', 0],
            ['RuneScape', 1],
            ['impossible keyword', 1]
        ] as const) {
            script(5071, [glob], [phrase], 'i');
            for (let i = 0; i < 8; i++) script(5072, [], [], 'i');
            script(5073);
            script(5072, [], [], 'i');
        }
        script(5071, [0], [null], 'i');
        script(4210, [0], ['pickaxe'], 'i');
        script(5072, [], [], 'i');
        script(4211, [], [], 'i');
        script(5073);
        script(4211, [], [], 'i');
        script(5071, [0], ['fish'], 'i');
        script(4211, [], [], 'i');
        script(4212);
        script(5072, [], [], 'i');
        for (const lang of [0, 1, 2]) {
            LocalisedText.language = lang;
            LocalisedText.setLanguage(lang);
            add('language ' + lang, 'ok');
            for (const body of ['hi', 'ReD:WaVe:HELLO', 'yellow:shake:test', 'welle2:hi', 'lila:gleiten:gut', 'rouge:ondulation2:Salut', 'clignotant2:glissement:bonjour', '::ping']) script(5008, [], [body]);
            script(5009, [], ['blue guild', '  mixed <X>. ok!']);
        }
        script(5008, [], [null]);
        script(5009, [], [null, 'body']);
        script(5009, [], ['recipient', null]);
        script(5001, [1, 2]);
        script(5001, [1, 2, 3]);
        script(5002, [10, 1], [null]);
        script(5422, [0], ['First ', null]);
        script(5422, [2], ['Out of range ', '']);
        script(5422, [0], ['Sir ', ' the Brave']);
        for (const flags of [
            [0, 0, 0, 0, 0, 0],
            [1, 0, 0, 0, 0, 0],
            [1, 1, 0, 0, 0, 0],
            [0, 0, 1, 0, 0, 0],
            [0, 0, 0, 0, 0, 1],
            [0, 0, 0, 0, 1, 0],
            [1, 0, 0, 2, 0, 0]
        ]) {
            policy(flags[0], flags[1], flags[2], flags[3], flags[4], flags[5]);
            script(5009, [], [null, null]);
            script(5008, [], ['hello']);
            script(5009, [], ['Bob', 'hello']);
            for (const rights of [0, 1, 2, 3, 4]) {
                for (const op of [0, 54, 71, 81, 141, 247]) await receive(op, rights, withNumber);
                player(false, rights, firstPhrase);
                player(true, rights, withNumber);
            }
        }
        policy(0, 0, 0, 0, 0, 0);
        player(false, 1, firstPhrase, false);
        await receive(0, 1, firstPhrase, 42);
        await receive(247, 1, withNumber, 42);
        for (const [x, z] of [
            [3052, 3056],
            [3053, 3056],
            [3156, 3136],
            [3139, 3062],
            [3072, 9492],
            [3118, 9535],
            [3119, 9535]
        ]) {
            Client.mapBuildBaseX = x - 1;
            Client.mapBuildBaseZ = z - 2;
            Client.localPlayer = actor;
            actor.x = 128;
            actor.z = 256;
            Client.GdmGetSpecialArea();
            add(['area', x - 1, z - 2, 128, 256].join(' '), Client.withinTutorialIsland);
        }
        policy(0, 0, 0, 0, 0, 0);
        for (const op of [0, 54, 71, 81, 141, 247]) {
            for (const [ringLength, duplicate, cursor, ignoreLength, ignoreCount, rights, senderId, clanId] of [
                [-1, -1, 0, 100, 0, 1, sender, clan],
                [0, -1, 0, 100, 0, 1, sender, clan],
                [1, 0, -1, -1, 1, 0, sender, clan],
                [99, -1, 0, 100, 0, 2, sender, clan],
                [99, 98, -1, 0, 1, 0, sender, clan],
                [100, 99, -1, 0, 1, 0, sender, clan],
                [100, -1, -1, 100, 0, 1, sender, clan],
                [100, -1, 0x7fffffff, 100, 0, 2, sender, clan],
                [100, -1, 99, -1, 1, 1, sender, clan],
                [100, -1, 99, 0, 1, 0, sender, clan],
                [100, -1, 99, 0, 1, 3, sender, clan],
                [101, -1, 100, 1, 1, 2, 0n, clan],
                [100, -1, 99, -1, 0, 3, sender, 0n],
                [100, -1, 99, 1, 0, 0, 0n, 0n]
            ] as const) {
                const ring = ringLength < 0 ? null : new BigInt64Array(ringLength);
                if (duplicate >= 0) requireNonNull(ring)[duplicate] = (530n << 32n) + 123n;
                Reflect.set(Client, 'privateMessageIds', ring);
                Client.privateMessageCount = cursor;
                Reflect.set(Client, 'ignoreName37', ignoreLength < 0 ? null : new BigInt64Array(ignoreLength));
                Client.ignoreCount = ignoreCount;
                ChatHistory.count = 0;
                Client.chatTransmitCycle = -9;
                Client.transmitCycle = 17;
                ChatHistory.types[0] = -54;
                ChatHistory.names[0] = ChatHistory.text[0] = ChatHistory.clans[0] = null;
                ChatHistory.phrases[0] = -73;
                const body = message(op, rights, withNumber, 123, senderId, clanId);
                let outcome = 'ok';
                try {
                    expect(await readSocket(op, body)).toBe(true);
                } catch (error) {
                    if (!(error instanceof WrappedException)) throw error;
                    if (error.cause instanceof RangeError) outcome = 'ArrayIndexOutOfBoundsException';
                    else if (error.cause instanceof TypeError) outcome = 'NullPointerException';
                    else throw error;
                    outcome += ' ' + error.context;
                }
                let hash = ring === null ? 0 : 1;
                if (ring !== null) for (const id of ring) hash = (Math.imul(hash, 31) + Number(BigInt.asIntN(32, id ^ (id >> 32n)))) | 0;
                const command = ['faultRecv', op, enc(body), ringLength, duplicate, cursor, ignoreLength, ignoreCount].join(' ');
                add(command, [outcome, Protocol.packetType, Protocol.inPacket.m_pos, Client.privateMessageCount, hash, Client.chatTransmitCycle, log()].join('|'));
            }
        }
        const java = fileURLToPath(new URL('./game/ChatOracle.java', import.meta.url));
        const build = Bun.spawnSync(['javac', '-cp', jar, '-d', dir, java]);
        expect(build.stderr.toString()).toBe('');
        expect(build.exitCode).toBe(0);
        const run = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + jar, 'ChatOracle'], { stdin: Buffer.from(header.concat(rows).join('\n')), maxBuffer: 4 * 1024 * 1024, timeout: 20000 });
        expect(run.stderr.toString()).toBe('');
        expect(run.exitCode).toBe(0);
        const wanted = run.stdout.toString().trimEnd().split(/\r?\n/);
        expect(wanted.length).toBe(rows.length);
        for (let i = 0; i < rows.length; i++) expect(actual[i], rows[i]).toBe(wanted[i]);
    } finally {
        ClientScript.m_cache = oldCache;
        ScriptRunner.activeQuickChatMessage = oldMessage;
        Client.searchResults = oldResults;
        Client.resultCount = oldCount;
        Client.searchResultIndex = oldIndex;
        InterfaceList.top = oldTop;
        Client.modeWhere = oldMode;
        ScriptRunner.intStack.set(oldInts);
        for (let i = 0; i < oldStrings.length; i++) ScriptRunner.stringStack[i] = oldStrings[i];
        WordPack['codec'] = oldCodec;
        Client.stream = savedStream;
        Object.assign(Protocol, savedReader);
        Client.out = savedPacket;
        Object.assign(Client, savedAccount);
        Client.localPlayer = previousSelf;
        Client.mapBuildBaseX = baseX;
        Client.mapBuildBaseZ = baseZ;
        QuickChatPhraseTypeList.decoder = oldDecoder;
        Object.assign(LocalisedText, oldLabels);
        ClientPlayer.titlePrefixes = oldPrefixes;
        ClientPlayer.nameSuffixes = oldSuffixes;
        Object.assign(ChatHistory, savedChat);
        Object.assign(Client, savedChatState);
        Reflect.set(Client, 'ignoreName37', savedIgnoreIds);
        Client.ignoreCount = savedIgnoreCount;
        QuickChatPhraseTypeList['phrases'].Reset();
        QuickChatCatTypeList['types'].Reset();
        void assets.stop();
        rmSync(dir, { force: true, recursive: true });
    }
}, 32000);
