import QuickChatCatTypeList from '#/config/QuickChatCatTypeList.js';
import QuickChatPhraseTypeList from '#/config/QuickChatPhraseTypeList.js';
import ParamType from '#/config/ParamType.js';
import FloType from '#/config/FloType.js';
import FluType from '#/config/FluType.js';
import IdkType from '#/config/IdkType.js';
import LocType from '#/config/LocType.js';
import NpcType from '#/config/NpcType.js';
import ObjType from '#/config/ObjType.js';
import StructType from '#/config/StructType.js';
import SeqType from '#/config/SeqType.js';
import BASTypeList from '#/config/BASTypeList.js';
import SpotType from '#/config/SpotType.js';
import VarBitType from '#/config/VarBitType.js';
import VarpType from '#/config/VarpType.js';
import InvType from '#/config/InvType.js';
import EnumType from '#/config/EnumType.js';
import CursorType from '#/config/CursorType.js';
import MSITypeList from '#/config/MSITypeList.js';
import AnimFrameSet from '#/dash3d/AnimFrameSet.js';
import IfType from '#/ui/IfType.js';
import SoftwareFont from '#/graphics/SoftwareFont.js';
import Preferences from '#/ui/Preferences.js';
import Js5NetQueue from '#/io/Js5NetQueue.js';
import type JagString from '#/datastruct/JagString.js';
import { loginFixture } from './login-fixture.js';
import { fixtureDiskQueue } from './disk-queue.js';
import { createJs5Client } from './js5net/client.js';
import { installSocketHost, restoreSocketHost, settleSignlink } from './socket-host.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { cachePath, gamepackPath } from './reference.js';
import { afterEach, expect, test } from 'bun:test';
import Client from '#/client/Client.js';
import type { Js5Storage } from '#/cache/Js5Resources.js';
import Crc32 from '#/io/Crc32.js';
import PacketT from '#/io/PacketT.js';
import { fromJsString } from '#/datastruct/JagString.js';
import type { Js5Stream } from '#/io/SocketPlatform.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import TitleFlames from '#/title/TitleFlames.js';
import { loadingGroupIds, preserveLoadingGroupIds } from './loading-group-fixture.js';
import SpriteLoader from '#/graphics/SpriteLoader.js';
import Fonts from '#/graphics/Fonts.js';
import TitleScreen from '#/title/TitleScreen.js';
import Js5 from '#/cache/Js5.js';
import Js5Index from '#/cache/Js5Index.js';
import Huffman from '#/io/Huffman.js';
import WordPack from '#/io/WordPack.js';
import WorldMap from '#/ui/WorldMap.js';
import MapArea from '#/ui/MapArea.js';
import LocalisedText from '#/ui/LocalisedText.js';
import GameShell from '#/client/GameShell.js';
import { archiveSlots, createJs5Resources, readGroup } from './cachefile.js';

function container(data: Uint8Array): Uint8Array {
    const packet = new PacketT(5 + data.length);
    packet.p1(0);
    packet.p4(data.length);
    packet.pArrayBuffer(data, data.length, 0);
    return requireNonNull(packet.m_data);
}

afterEach(restoreSocketHost);

class CacheServer implements Js5Stream {
    responses = new Map<number, Uint8Array>();
    requests: { archive: number; group: number; urgent: boolean }[] = [];
    private input: number[] = [];

    GetAvailable(): number {
        return this.input.length;
    }

    private pending: number[] = [];
    Write(offset: number, bytes: Uint8Array, len: number): void {
        this.pending.push(...bytes.subarray(offset, offset + len));
        while (this.pending.length) {
            const length = this.pending[0] === 15 ? 5 : 4;
            if (this.pending.length < length) return;
            this.receive(Uint8Array.from(this.pending.splice(0, length)));
        }
    }
    private receive(bytes: Uint8Array): void {
        if (bytes[0] === 15) {
            this.input.push(0);
            return;
        }
        if (bytes[0] !== 0 && bytes[0] !== 1) return;
        const archive = bytes[1],
            group = (bytes[2] << 8) | bytes[3],
            urgent = bytes[0] === 1;
        this.requests.push({ archive, group, urgent });
        const data = this.responses.get((archive << 16) | group);
        if (!data) throw new Error('Missing cache fixture');
        let block = 8;
        this.input.push(archive, group >>> 8, group & 255, data[0] | (urgent ? 0 : 128), ...data.subarray(1, 5));
        for (let i = 5; i < data.length; i++) {
            if (block === 512) {
                this.input.push(255);
                block = 1;
            }
            this.input.push(data[i]);
            block++;
        }
    }
    async read(): Promise<number> {
        return requireNonNull(this.input.shift());
    }
    async Read(out: Uint8Array, off: number, len: number): Promise<void> {
        out.set(this.input.splice(0, len), off);
    }
    Close() {}
}

function populate(server: CacheServer): Uint8Array[] {
    const master = new PacketT(28 * 8);
    const payload: Uint8Array[] = [];
    for (let i = 0; i < 28; i++) {
        payload.push(Uint8Array.from({ length: 532 + i }, (_, j) => 13 * j - 9 * i));
        const packed = container(payload[i]);
        const named = i === 8;
        const table = new PacketT(named ? 30 : 22);
        table.p1(6);
        table.p4(i + 32);
        table.p1(named ? 1 : 0);
        table.p2(1);
        table.p2(0);
        if (named) table.p4(0);
        table.p4(Crc32.prefix(packed, packed.length));
        table.p4(255 + i);
        table.p2(1);
        table.p2(0);
        if (named) table.p4(0);
        const index = container(requireNonNull(table.m_data));
        server.responses.set(i << 16, packed);
        server.responses.set((255 << 16) | i, index);
        master.p4(Crc32.prefix(index, index.length));
        master.p4(i + 32);
    }
    server.responses.set((255 << 16) | 255, container(requireNonNull(master.m_data)));
    return payload;
}

async function boot(server: CacheServer, disk?: Js5Storage) {
    installSocketHost(async () => server);
    const { client, queue: net } = createJs5Client(0);
    const assets = createJs5Resources(net, fixtureDiskQueue(), disk);
    const tick = async () => {
        await client['js5Tick']();
        Client.js5MasterIndex?.tick();
        await settleSignlink();
    };
    client['assets'] = assets;
    Client.loadingStage = 30;
    for (let i = 0; i < 120 && Client.loadingStage !== 45; i++) {
        await tick();
        await client['MainLoad']();
    }
    expect(Client.loadingStage).toBe(45);
    return { assets, net, tick };
}

test('JS5 loads and validates all 28 indexes, schedules background groups, and reopens persisted network bytes', async () => {
    const server = new CacheServer();
    const payload = populate(server);
    const bytes = new Map<number, Uint8Array>();
    const disk: Js5Storage = {
        read: async (archive, group) => bytes.get((archive << 16) | group)?.slice(),
        write: async (archive, group, src) => {
            bytes.set((archive << 16) | group, src.slice());
        }
    };
    const { assets, net, tick } = await boot(server, disk);
    try {
        for (let i = 0; i < 160 && bytes.size < 54; i++) await tick();
        expect(server.requests[0]).toEqual({ archive: 255, group: 255, urgent: true });
        expect(
            server.requests
                .filter(x => x.archive === 255 && x.group !== 255)
                .map(x => x.group)
                .sort((a, b) => a - b)
        ).toEqual(Array.from({ length: 28 }, (_, i) => i));
        expect(
            server.requests
                .filter(x => x.archive !== 255 && !x.urgent)
                .map(x => x.archive)
                .sort((a, b) => a - b)
        ).toEqual(Array.from({ length: 28 }, (_, i) => i).filter(i => i !== 6 && i !== 14));
        for (let i = 0; i < 28; i++) {
            let result: Uint8Array | undefined;
            for (let t = 0; t < 60 && !result; t++) {
                result = assets.file(i, 0);
                await tick();
            }
            expect(result).toEqual(payload[i]);
            expect(assets.archive(i).GetIndexCrc()).toBe(requireNonNull(assets.index(i)).m_indexCRC);
        }
        for (let i = 0; i < 100 && bytes.size < 56; i++) await tick();
        expect(bytes.size).toBe(56);
    } finally {
        net.close();
        await assets.stop();
    }

    // The original CRC excludes the version trailer. A stale trailer still forces a new group request.
    const badVersion = requireNonNull(bytes.get(14 << 16));
    badVersion[badVersion.length - 1] ^= 1;
    // The CRC for the reference table covers the whole container.
    requireNonNull(bytes.get((255 << 16) | 6))[8] ^= 64;
    server.requests = [];
    const warm = await boot(server, disk);
    try {
        let missing: Uint8Array | undefined;
        for (let t = 0; t < 100 && !missing; t++) {
            missing = warm.assets.file(14, 0);
            await warm.tick();
        }
        expect(missing).toEqual(payload[14]);
        expect(server.requests).toEqual([
            { archive: 255, group: 255, urgent: true },
            { archive: 255, group: 6, urgent: true },
            { archive: 14, group: 0, urgent: true }
        ]);
    } finally {
        warm.net.close();
        await warm.assets.stop();
    }
});

test('network-only JS5 loads each reference and fetches requested groups without disk prefetch', async () => {
    const server = new CacheServer(),
        payload = populate(server);
    const { assets, net, tick } = await boot(server);
    try {
        let read: Uint8Array | undefined;
        for (let t = 0; t < 60 && !read; t++) {
            read = assets.file(12, 0);
            await tick();
        }
        expect(read).toEqual(payload[12]);
        expect(server.requests.filter(r => r.archive !== 255)).toEqual([{ archive: 12, group: 0, urgent: true }]);
    } finally {
        net.close();
        await assets.stop();
    }
});

test('original loading group IDs, stage counts and ordered JS5 reads agree with client.jar', () => {
    const directory = mkdtempSync(join(tmpdir(), 'js5-loading530-'));
    const jar = gamepackPath;
    const source = fileURLToPath(new URL('./cache/LoadingOracle.java', import.meta.url));
    const reads: string[] = [];
    let remainder = 0;
    const indices = [8, 13].map(id => readGroup(cachePath, 255, id));
    const oneGroup = container(Uint8Array.of(5, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0));
    using _groupState = preserveLoadingGroupIds();
    for (const [owner, field, initial] of loadingGroupIds) Reflect.set(owner, field, initial);
    try {
        const compiled = Bun.spawnSync(['javac', '-cp', jar, '-d', directory, source], { timeout: 20000 });
        expect(compiled.stderr.toString()).toBe('');
        expect(compiled.exitCode).toBe(0);
        const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', directory + delimiter + jar, 'LoadingOracle'], {
            stdin: Buffer.from([...indices, oneGroup].map(bytes => Buffer.from(bytes).toString('base64')).join('\n')),
            timeout: 20000
        });
        expect(java.stderr.toString()).toBe('');
        expect(java.exitCode).toBe(0);
        const fixture = new URL('./loading-group-fixture.ts', import.meta.url).href;
        const fresh = Bun.spawnSync([
            process.execPath,
            '-e',
            `import { loadingGroupIds } from ${JSON.stringify(fixture)};
            console.log('[' + loadingGroupIds.map(([owner, field]) => owner[field]).join(', ') + ']');`
        ]);
        expect(fresh.stderr.toString()).toBe('');
        expect(fresh.exitCode).toBe(0);
        expect(fresh.stdout.toString().trim()).toBe(java.stdout.toString().split(/\r?\n/, 1)[0]);
        const [sprites, metrics] = indices.map((src, i) => {
            const table = new Js5Index(src, Crc32.prefix(src, src.length));
            return new Js5(
                {
                    index: () => table,
                    group: (_mode, id) => {
                        reads.push([8, 13][i] + '/' + id);
                        return id % 4 < remainder ? Uint8Array.of(0) : null;
                    },
                    prefetchGroup: () => {
                        throw new Error();
                    },
                    GetGroupLoadPercentage: () => {
                        throw new Error();
                    }
                },
                false,
                true
            );
        });
        const ids = () => '[' + loadingGroupIds.map(([owner, field]) => Reflect.get(owner, field)).join(', ') + ']';
        const lines = [ids()];
        Client.lookupSpriteGroupIds(sprites);
        Client.loadTitleGroupIds(sprites);
        Client.findRunesSpriteGroup(sprites);
        lines.push(ids());
        for (; remainder <= 4; remainder++) {
            reads.length = 0;
            lines.push(
                [Client.countFontsReady(sprites, metrics), Fonts.getFileCount(), TitleScreen.Ready(sprites), TitleScreen.ReadyMax(), Client.getGameSpritesLoaded(sprites, false), SpriteLoader.total(), TitleScreen.isRunesReady(sprites)].join(',') +
                    '|' +
                    reads.join(',')
            );
        }
        const names: [object, string][] = [
            [Fonts, 'p11FullName'],
            [Client, 'p12FullName'],
            [Fonts, 'b12FullName'],
            [Client, 'mapfunctionName'],
            [Client, 'hitmarksSpriteName'],
            [SpriteLoader, 'hitbarDefaultName'],
            [Client, 'headiconsPkName'],
            [Client, 'headiconsPrayerName'],
            [Client, 'hintHeadiconsName'],
            [Client, 'hintMapmarkersName'],
            [SpriteLoader, 'mapflagName'],
            [Client, 'crossName'],
            [SpriteLoader, 'mapdotsName'],
            [Client, 'scrollbarSpriteName'],
            [Client, 'nameIconsName'],
            [Client, 'floorshadowsSpriteName'],
            [SpriteLoader, 'compassName'],
            [Client, 'hintMapedgeSpriteName'],
            [TitleScreen, 'titleBgName'],
            [TitleScreen, 'logoName'],
            [TitleFlames, 'runesName']
        ];

        const waiting = new Js5({ index: () => null, group: () => null, prefetchGroup() {}, GetGroupLoadPercentage: () => 0 }, false, true);
        const replacements = [null, SpriteLoader.mapflagName, fromJsString('missing_name')];
        for (const [owner, name] of names) {
            const original = Reflect.get(owner, name);
            try {
                for (const archive of [sprites, waiting])
                    for (const value of replacements) {
                        loadingGroupIds.forEach(([target, key], i) => Reflect.set(target, key, -800 - i));
                        Reflect.set(owner, name, value);
                        let result = 'ok';
                        try {
                            Client.lookupSpriteGroupIds(archive);
                            Client.loadTitleGroupIds(archive);
                            Client.findRunesSpriteGroup(archive);
                        } catch {
                            result = 'exception';
                        }
                        lines.push(result + '|' + ids());
                    }
            } finally {
                Reflect.set(owner, name, original);
            }
        }
        for (const [owner, field] of loadingGroupIds) Reflect.set(owner, field, 0);
        for (const shape of ['null', 'pending', 'one', 'many']) {
            const src = shape === 'one' ? oneGroup : indices[0];
            const table = new Js5Index(src, Crc32.prefix(src, src.length));
            for (const hitmarks of [-1, 0])
                for (const markers of [-1, 0]) {
                    SpriteLoader.hitmarksId = hitmarks;
                    Client.hintMapmarkersSpriteGroup = markers;
                    for (let call = 0; call < 6; call++) {
                        let archive;
                        if (shape === 'null') {
                            archive = null;
                        } else {
                            archive = new Js5(
                                {
                                    index() {
                                        reads.push('index');
                                        return shape === 'pending' ? null : table;
                                    },
                                    group(_mode, group) {
                                        reads.push('8/' + group);
                                        return null;
                                    },
                                    prefetchGroup() {
                                        throw new Error();
                                    },
                                    GetGroupLoadPercentage() {
                                        throw new Error();
                                    }
                                },
                                false,
                                true
                            );
                        }
                        reads.length = 0;
                        let value: number | boolean | string;
                        try {
                            switch (call) {
                                case 0:
                                case 1:
                                    value = Client.getGameSpritesLoaded(archive, call === 1);
                                    break;
                                case 2:
                                    value = Client.countFontsReady(archive, null);
                                    break;
                                case 3:
                                    value = Client.countFontsReady(null, archive);
                                    break;
                                case 4:
                                    value = TitleScreen.Ready(archive);
                                    break;
                                default:
                                    value = TitleScreen.isRunesReady(archive);
                                    break;
                            }
                        } catch (error) {
                            if (!(error instanceof TypeError)) throw error;
                            value = 'null';
                        }
                        lines.push(value + '|' + reads.join(','));
                    }
                }
        }
        expect(lines).toEqual(java.stdout.toString().trimEnd().split(/\r?\n/));
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
}, 42000);

loginFixture(
    import.meta.url,
    'stage 70 checks live JS5 slots and publishes configuration in gamepack order',
    async () => {
        const client = new Client();
        client['assets'] = createJs5Resources(new Js5NetQueue(), fixtureDiskQueue());
        const cases = ['partial 0', ...[2, 16, 17, 18, 19, 20, 21, 22, 24, 25, 27].map(id => 'swap ' + id), 'ready 0', 'over 0', 'objNull 0', 'interrupt 0', 'initSwap 0', 'fontSwap 0', 'wearFail 0'];
        const indexBytes = container(Uint8Array.of(5, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0));
        const table = new Js5Index(indexBytes, Crc32.prefix(indexBytes, indexBytes.length));
        const ordinary = container(Uint8Array.of(0)),
            wearable = container(Uint8Array.of(23, 0, 17, 0)),
            broken = container(Uint8Array.of(23));
        const published: [object, string][] = [
            [ParamType, 'm_pConfigClient'],
            [FloType, 'm_pConfigClient'],
            [FluType, 'm_pConfigClient'],
            [IdkType, 'm_pConfigClient'],
            [IdkType, 'm_pModels'],
            [LocType, 'm_pModels'],
            [LocType, 'm_pConfigClient'],
            [NpcType, 'm_pModels'],
            [NpcType, 'm_pConfigClient'],
            [ObjType, 'm_pConfigClient'],
            [ObjType, 'm_pModels'],
            [StructType, 'm_pConfigClient'],
            [AnimFrameSet, 'basesArchive'],
            [AnimFrameSet, 'framesArchive'],
            [SeqType, 'm_pConfigClient'],
            [BASTypeList, 'archive'],
            [SpotType, 'm_pModels'],
            [SpotType, 'm_pConfigClient'],
            [VarBitType, 'm_pConfigClient'],
            [VarpType, 'm_pConfigClient'],
            [IfType, 'm_pSprites'],
            [IfType, 'm_pModels'],
            [IfType, 'm_pFontMetrics'],
            [IfType, 'm_pInterfaces'],
            [InvType, 'm_pConfigClient'],
            [EnumType, 'm_pConfigClient'],
            [QuickChatPhraseTypeList, 'local'],
            [QuickChatPhraseTypeList, 'global'],
            [QuickChatCatTypeList, 'local'],
            [QuickChatCatTypeList, 'global'],
            [CursorType, 'configArchive'],
            [CursorType, 'spriteArchive'],
            [MSITypeList, 'spritesArchive'],
            [MSITypeList, 'archive']
        ];
        const oldFont = new SoftwareFont(new Uint8Array(257)),
            countFont = new SoftwareFont(new Uint8Array(257));
        const oldOps = [fromJsString('original')];
        const names = (ops: (JagString | null)[] | null) => {
            if (ops === oldOps) {
                return 'old';
            } else {
                return requireNonNull(ops)
                    .map(op => (op === null ? '_' : Buffer.from(op.toBytes()).toString('base64')))
                    .join(',');
            }
        };
        const dir = mkdtempSync(join(tmpdir(), 'stage70-'));
        try {
            const source = fileURLToPath(new URL('./cache/LoadingOracle.java', import.meta.url));
            const build = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, source]);
            expect(build.exitCode, build.stderr.toString()).toBe(0);
            const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'LoadingOracle', 'stage70'], {
                stdin: Buffer.from([Buffer.from(indexBytes).toString('base64'), ...cases].join('\n'))
            });
            expect(java.exitCode, java.stderr.toString()).toBe(0);
            const expected = java.stdout.toString().trimEnd().split(/\r?\n/);
            expect(expected.length).toBe(cases.length);
            const ready = expected[cases.indexOf('ready 0')].split('|'),
                failedWear = expected[cases.indexOf('wearFail 0')].split('|');
            expect([ready[1], ready[4], ready[8]]).toEqual(['ok', '80,50,TG9hZGVkIGNvbmZpZw==', '[0]']);
            expect([failedWear[1], failedWear[4], failedWear[8]]).toEqual(['exception', '70,50,TG9hZGVkIGNvbmZpZw==', '[731]']);
            for (const [i, scenario] of cases.entries()) {
                const [mode, value] = scenario.split(' '),
                    target = Number(value);
                const tags = new Map<Js5, string>(),
                    events: string[] = [];
                let changed = false;
                function bind(id: number, ref: Js5 | null): void {
                    const key = archiveSlots[id];
                    Client[key] = ref;
                }
                function archive(id: number, tag: string): Js5 {
                    const ref = new Js5(
                        {
                            index: () => {
                                events.push('i' + tag);
                                if (id === 19 && tag === 'r19' && mode === 'fontSwap') Client.p11Software = oldFont;
                                if (id === 3 && mode === 'interrupt') throw new Error('interface index unavailable');
                                if (id === 3 && mode === 'initSwap' && !changed) {
                                    changed = true;
                                    bind(2, archive(2, 'r2'));
                                }
                                return table;
                            },
                            group: (_request, group) => {
                                events.push('g' + tag + '/' + group);
                                if (!changed && id === target && mode === 'swap') {
                                    changed = true;
                                    bind(id, archive(id, 'r' + id));
                                }
                                if (!changed && id === 27 && mode === 'fontSwap') {
                                    changed = true;
                                    bind(19, archive(19, 'r19'));
                                }
                                if (!changed && id === 27 && mode === 'objNull') {
                                    changed = true;
                                    bind(19, null);
                                }
                                if (mode === 'partial' || mode === 'swap' || (mode === 'over' && id !== 19)) return null;
                                return id === 19 ? (mode === 'wearFail' ? broken : wearable) : ordinary;
                            },
                            prefetchGroup: () => {
                                throw Error('unexpected prefetch');
                            },
                            GetGroupLoadPercentage: group => {
                                events.push('p' + tag + '/' + group);
                                return mode === 'over' ? 119 : tag.startsWith('r') ? 91 : (id * 3 + 11) % 83;
                            }
                        },
                        false,
                        true
                    );
                    tags.set(ref, tag);
                    return ref;
                }
                const previous = archive(-1, 'old');
                for (const [owner, name] of published) {
                    expect(Object.hasOwn(owner, name), name).toBe(true);
                    Reflect.set(owner, name, previous);
                }
                for (let id = 0; id < archiveSlots.length; id++) bind(id, archive(id, 'a' + id));
                IfType.m_list = new Array(3).fill(null);
                IfType.m_open = new Array(4).fill(false);
                ObjType.m_numDefinitions = -7;
                ObjType.m_memServer = LocType.members = false;
                ObjType.wearables = Int32Array.of(731);
                ObjType.inventoryOps = ObjType.groundOps = oldOps;
                ObjType.m_countFont = oldFont;
                Client.p11Software = countFont;
                ObjType.types.Reset();
                Client.loadingStage = 70;
                TitleScreen.m_loadPos = 29;
                TitleScreen.m_loadString = fromJsString('seed');
                Preferences.safeMode = true;
                let result = 'ok';
                try {
                    await client['MainLoad']();
                } catch {
                    result = 'exception';
                }
                const refs = published.map(([owner, name]) => {
                    const ref = Reflect.get(owner, name);
                    return ref === null ? 'null' : tags.get(ref);
                });
                const got = [
                    scenario,
                    result,
                    events.join(','),
                    refs.join(','),
                    [Client.loadingStage, TitleScreen.m_loadPos, Buffer.from(TitleScreen.m_loadString.toBytes()).toString('base64')].join(','),
                    [ObjType.m_memServer, LocType.members, ObjType.m_numDefinitions, ObjType.m_countFont === countFont, ObjType.m_countFont === oldFont, Client.p11Software === countFont, IfType.m_list.length, IfType.m_open.length].join(','),
                    names(ObjType.inventoryOps),
                    names(ObjType.groundOps),
                    '[' + requireNonNull(ObjType.wearables).join(', ') + ']'
                ].join('|');
                expect(got, scenario).toBe(expected[i]);
            }
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    30000
);

loginFixture(
    import.meta.url,
    'late loading stages read live archive slots and retain the same partial state as client.f',
    async () => {
        const client = new Client();
        const ids = [3, 5, 6, 8, 10, 12, 13, 23, 26];
        const tables = new Map<number, Uint8Array>();
        for (const id of ids) {
            const name = id === 3 ? 'loginscreen' : id === 23 ? 'details' : id === 10 ? 'huffman' : '';
            const table = new PacketT(26);
            table.p1(5);
            table.p1(1);
            table.p2(1);
            table.p2(0);
            table.p4(fromJsString(name).hashCode());
            table.p4(0);
            table.p4(0);
            table.p2(1);
            table.p2(0);
            table.p4(0);
            tables.set(id, container(requireNonNull(table.m_data)));
        }
        const cases = [
            ...[80, 100].flatMap(stage => ['null', 'waiting', 'pendingIndex'].map(mode => stage + ' ' + mode + ' 8')),
            '100 ready 8',
            ...['null', 'waiting', 'replaceGroup', 'pendingIndex'].map(mode => '90 ' + mode + ' 26'),
            '110 null 8',
            ...['ready', 'null', 'pendingIndex', 'waiting', 'replaceGroup', 'rename', 'bad'].map(mode => '120 ' + mode + ' 10'),
            ...[3, 12, 13, 23].flatMap(id => ['null', 'waiting', 'replaceGroup', 'throwIndex'].map(mode => '130 ' + mode + ' ' + id)),
            '130 ready 23',
            '130 bad 23',
            '130 noIcons 23',
            '130 laterNull 3',
            '130 rename 23',
            '140 ready 3',
            '140 replaceIndex 3',
            ...[3, 5, 6, 8, 13, 10].map(id => '140 throwIndex ' + id)
        ];
        const temp = mkdtempSync(join(tmpdir(), 'late-loading-'));
        try {
            const source = (name: string) => fileURLToPath(new URL('./cache/' + name + '.java', import.meta.url));
            const compile = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', temp, source('LoadingOracle'), source('LateLoadingOracle')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const lines = ids.map(id => Buffer.from(requireNonNull(tables.get(id))).toString('base64')).concat(cases);
            const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', temp + delimiter + gamepackPath, 'LateLoadingOracle'], {
                stdin: Buffer.from(lines.join('\n'))
            });
            expect(java.exitCode, java.stderr.toString()).toBe(0);
            const expected = java.stdout.toString().trimEnd().split(/\r?\n/);
            expect(expected.length).toBe(cases.length);
            const prefix = LocalisedText.loadingInterfaces,
                percent = Client.percentSign;
            const huffman = Client.huffmanGroup,
                details = WorldMap.detailsGroup;
            const word = container(Uint8Array.of(1)),
                bad = container(Uint8Array.of(255)),
                area = container(new Uint8Array(13));
            const base64 = (text: JagString) => Buffer.from(text.toBytes()).toString('base64');
            for (const [row, scenario] of cases.entries()) {
                const [initial, mode, value] = scenario.split(' '),
                    target = Number(value);
                const inputs = new Map<Js5, { tag: string; table: Js5Index }>();
                const events: string[] = [];
                let changed = false;
                function bind(id: number, ref: Js5 | null): void {
                    const key = archiveSlots[id];
                    Client[key] = ref;
                }
                function archive(id: number, tag: string): Js5 {
                    const bytes = requireNonNull(tables.get(id));
                    const table = new Js5Index(bytes, Crc32.prefix(bytes, bytes.length));
                    const ref = new Js5(
                        {
                            index() {
                                events.push('i' + tag);
                                if (id === target) {
                                    if (mode === 'throwIndex') throw Error('index unavailable');
                                    if (mode === 'pendingIndex') return null;
                                    if (mode === 'replaceIndex' && !changed) {
                                        changed = true;
                                        bind(id, archive(id, 'r' + id));
                                    }
                                }
                                return table;
                            },
                            group(_priority, group) {
                                events.push('g' + tag + '/' + group);
                                if (id === target) {
                                    if (mode === 'replaceGroup' && !changed) {
                                        changed = true;
                                        bind(id, archive(id, 'r' + id));
                                    }
                                    if (mode === 'rename') Client.huffmanGroup = WorldMap.detailsGroup = fromJsString('missing');
                                    if (mode === 'bad') return bad;
                                    if (mode === 'waiting' || (mode === 'replaceGroup' && id !== 10 && id !== 23)) return null;
                                    if (mode === 'laterNull') {
                                        Client.m_pClientScripts = null;
                                        return null;
                                    }
                                }
                                return id === 23 ? area : word;
                            },
                            GetGroupLoadPercentage(group) {
                                events.push('p' + tag + '/' + group);
                                LocalisedText.loadingInterfaces = fromJsString('new prefix');
                                Client.percentSign = fromJsString('tail');
                                return tag.startsWith('r') ? 86 : -53;
                            },
                            prefetchGroup() {
                                throw Error('unexpected prefetch');
                            }
                        },
                        false,
                        true
                    );
                    inputs.set(ref, { tag, table });
                    return ref;
                }
                for (const id of ids) bind(id, id === target && mode === 'null' ? null : archive(id, 'a' + id));
                LocalisedText.loadingInterfaces = prefix;
                Client.percentSign = percent;
                Client.huffmanGroup = huffman;
                WorldMap.detailsGroup = details;
                Client.loadingStage = Number(initial);
                Preferences.safeMode = true;
                TitleScreen.m_loadPos = 19;
                TitleScreen.m_loadString = fromJsString('seed');
                Client.loginScreenInterface = -19;
                Client.loadingComplete = false;
                GameShell.signlink = null;
                Client.mouseTracking = null;
                const codec = new Huffman(Uint8Array.of(1));
                WordPack.setCodec(codec);
                Client.imageMapfunction = mode === 'noIcons' ? null : new Array(3).fill(null);
                WorldMap.archive = null;
                WorldMap.mapFunctions = new Array(2).fill(null);
                WorldMap.disabled = new Array(4).fill(false);
                MapArea.areas.clear();
                MapArea.areas.push_back(new MapArea(huffman, huffman, 0, 0, 0, true, 0));
                let result = 'ok';
                try {
                    await client['MainLoad']();
                } catch {
                    result = 'exception';
                }
                const names = ids.map(id => {
                    const key = archiveSlots[id],
                        ref = Client[key];
                    if (ref === null) return 'null';
                    const { tag, table } = requireNonNull(inputs.get(ref));
                    return tag + (table.fileNames === null ? '-' : 'f') + (table.groupNames === null ? '-' : 'g');
                });
                const first = MapArea.areas.head();
                const mapState = [
                    WorldMap.archive === null ? 'null' : requireNonNull(inputs.get(WorldMap.archive)).tag,
                    WorldMap.mapFunctions?.length ?? -1,
                    requireNonNull(WorldMap.disabled).length,
                    first === null ? 'none' : base64(requireNonNull(first.groupName))
                ];
                const actual = [
                    scenario,
                    result,
                    events.join(','),
                    names.join(','),
                    [Client.loadingStage, TitleScreen.m_loadPos, base64(TitleScreen.m_loadString)].join(','),
                    [Client.loginScreenInterface, Client.loadingComplete, Client.mouseTracking !== null, WordPack['codec'] !== codec].join(','),
                    mapState.join(',')
                ];
                expect(actual.join('|'), scenario).toEqual(expected[row]);
            }
        } finally {
            rmSync(temp, { recursive: true, force: true });
        }
    },
    30000
);
