import TitleScreen from '#/title/TitleScreen.js';
import { setLocalWorld } from './world-connection.js';
import WorldList from '#/io/WorldList.js';
import GameWorld from '#/io/GameWorld.js';
import { fixtureDiskQueue } from './disk-queue.js';
import Js5NetQueue from '#/io/Js5NetQueue.js';
import ScriptRunner from '#/script/ScriptRunner.js';
import SubInterface from '#/ui/SubInterface.js';
import InterfaceList from '#/ui/InterfaceList.js';
import IfType from '#/ui/IfType.js';
import Minimenu from '#/ui/Minimenu.js';
import SignlinkRequest from '#/util/SignlinkRequest.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Client from '#/client/Client.js';
import TitleFlames from '#/title/TitleFlames.js';
import PixfontGeneric from '#/graphics/PixfontGeneric.js';
import SoftwareFont from '#/graphics/SoftwareFont.js';
import Pix32 from '#/graphics/Pix32.js';
import Pix8 from '#/graphics/Pix8.js';
import SoftwareAlphaSprite from '#/graphics/SoftwareAlphaSprite.js';
import SpriteLoader from '#/graphics/SpriteLoader.js';
import WorldMap from '#/ui/WorldMap.js';
import { mathRandom } from '#/util/JavaRandom.js';
import ClientKeyboardListener from '#/client/ClientKeyboardListener.js';
import GameShell from '#/client/GameShell.js';
import CollisionMap from '#/dash3d/CollisionMap.js';
import Js5ResourceProvider from '#/cache/Js5ResourceProvider.js';
import Js5Index from '#/cache/Js5Index.js';
import Js5 from '#/cache/Js5.js';
import Crc32 from '#/io/Crc32.js';
import PacketT from '#/io/PacketT.js';
import SafeTime from '#/io/SafeTime.js';
import LocalisedText from '#/ui/LocalisedText.js';
import Preferences from '#/ui/Preferences.js';
import Signlink from '#/util/Signlink.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { archiveSlots as slots, createJs5Resources, readGroup } from './cachefile.js';
import { gamepackPath, cachePath } from './reference.js';

const rows: number[][] = [];
const row = (stage: number, blocked = -1, gate = 4, percent = 100, flag = 0) => rows.push([stage, blocked, gate, percent, flag]);
// Block matching archive reads when group % 4 >= gate and report percent for pending groups.
row(0, 16384, 1000, 0);
row(0, 16385, 1500, 0, 2);
row(0, 16385, 1501, 0, 4);
row(0, 22000, 5999, 0, 14);
row(0, 22000, 6000, 0, 7);
row(10);
row(30, 0, 0, 0);
row(30, 0, 0, 100);
for (const n of [0, 1, 7, 8, 18, 27, 28]) row(40, 0, 0, n);
row(45);
for (const stage of [50, 60]) for (const gate of [0, 1, 2, 3, 4]) row(stage, -1, gate, 39);
row(65);
for (const gate of [0, 1, 2, 3, 4]) row(70, -1, gate, 49);
for (const gate of [0, 1, 2, 3, 4]) row(80, -1, gate, 77);
row(90, -1, 0, 0);
row(90, -1, 0, 84);
row(90);
row(100, -1, 0, 0);
row(100);
row(110);
row(120, -1, 0, 22);
row(120);
for (const a of [3, 12, 13, 23]) for (const p of [0, 32, 99]) row(130, a, 0, p);
row(130);
row(135, -1, 4, 0);
for (const code of [7, 9, 0, 14, 1000, 1001]) for (const loaded of [0, 100]) row(135, code, 4, loaded);
row(135, -1, 4, 100);
row(140);
row(150, -1, 4, 100, 0);
row(150, -1, 4, 100, 1);
row(150, -1, 4, 100, 4);
row(150, -1, 4, 100, 14);
row(160);
row(160, 99, 4, 1);

async function fixture(language: number) {
    const client = new Client(),
        assets = createJs5Resources(new Js5NetQueue(), fixtureDiskQueue());
    client['assets'] = assets;
    const tables = slots.map((_, id) => {
        const b = readGroup(cachePath, 255, id);
        return new Js5Index(b, Crc32.prefix(b, b.length));
    });
    let blocked = 0,
        gate = 0,
        pending = 0,
        heap = 0,
        clock = 0n,
        gcs = 0,
        window = '';
    Object.defineProperty(performance, 'memory', {
        value: {
            get usedJSHeapSize() {
                return heap * 1024;
            }
        }
    });
    Object.defineProperty(globalThis, 'gc', {
        configurable: true,
        value() {
            gcs++;
        }
    });
    SafeTime.CurrentTimeMillis = () => clock;
    const phases: string[] = [];
    let worldError = '';
    client.ShowError = reason => {
        worldError = Client.gameState + '@' + reason;
    };
    const worldPoll = GameWorld.ListFetch.bind(GameWorld);
    function note(op: string) {
        phases.push([op, Minimenu.defaultCursor, Client.localPlayer?.x ?? -1, InterfaceList.dirty.filter(Boolean).length].join(':'));
    }
    const loadHooks = ScriptRunner.OnLoad;
    ScriptRunner.OnLoad = function (group: number, runner?: ScriptRunner) {
        if (group !== -1 && Client.loadingStage === 160) note('onLoad');
        return loadHooks(group, runner);
    };
    const setCursor = Client.setCursor.bind(Client);
    Client.setCursor = id => {
        if (Client.loadingStage === 160) note('cursor');
        setCursor(id);
    };
    const setupFire = TitleFlames.SetupFire;
    TitleFlames.SetupFire = archive => {
        if (Client.loadingStage === 160) note('flames');
        return setupFire(archive);
    };
    const setState = Client.SetMainState.bind(Client);
    Client.SetMainState = next => {
        if (Client.loadingStage === 160 && next === 10) note('state');
        setState(next);
    };
    const setMode = Client.setWindowMode.bind(Client);
    Client.setWindowMode = (height, apply, mode, replace, width) => {
        window = [height, apply, mode, replace, width].join(',');
        if (mode === 0) {
            setMode(height, apply, mode, replace, width);
            window += ',' + [GameShell.m_sWid, GameShell.m_sHei, GameShell.leftMargin, GameShell.topMargin].join(',');
        }
    };
    GameShell.m_activeShell = Client.activeClient = client;
    GameShell.canvas = { setSize() {}, setLocation() {} };
    setLocalWorld(1);
    GameShell.signlink = new Signlink({ getSize: () => ({ width: 821, height: 526 }) });
    Client.gameState = 5;
    LocalisedText.language = language;
    LocalisedText.setLanguage(language);
    class Source extends Js5ResourceProvider {
        constructor(private readonly archive: number) {
            super();
        }
        index() {
            return tables[this.archive];
        }
        group(_mode: number, id: number) {
            if ((this.archive === blocked || blocked === -1) && (id & 3) >= gate) return null;
            return readGroup(cachePath, this.archive, id);
        }
        GetGroupLoadPercentage() {
            return pending;
        }
        prefetchGroup() {}
    }
    const hash = (a: ArrayLike<number>) => Array.from(a).reduce((n, b) => (Math.imul(31, n) + b) | 0, 1);
    const signedBytes = (a: Uint8Array | null) => (a === null ? 0 : hash(new Int8Array(a.buffer, a.byteOffset, a.byteLength)));
    function fontData(font: PixfontGeneric | null): string {
        if (!(font instanceof SoftwareFont)) throw new Error('Expected fg');
        const arrays = [font['glyphHeights'], font['glyphYOffsets'], font['glyphXOffsets'], font['glyphAdvances'], font['glyphWidths'], font['iconHeights']];
        const masks = font['glyphMasks'];
        return [font.lineHeight, font['paddingBottom'], font['paddingTop'], ...arrays.map(a => (a === null ? 0 : hash(a))), signedBytes(font['kerning']), masks === null ? 0 : hash(masks.map(signedBytes))].join(',');
    }
    function sprites(values: readonly unknown[] | null): string {
        if (values === null) return '-';
        return values
            .map(sprite => {
                const s = sprite;
                if (!(s instanceof Pix32) && !(s instanceof Pix8)) throw new Error('Unexpected sprite implementation');
                const dims = [s.xOffset, s.yOffset, s.width, s.height, s.cropW, s.cropH];
                if (s instanceof Pix32) return hash([s instanceof SoftwareAlphaSprite ? 2 : 1, ...dims, s.pixels === null ? 0 : hash(s.pixels)]);
                return hash([3, ...dims, signedBytes(s.pixels), s['palette'] === null ? 0 : hash(s['palette'])]);
            })
            .join(',');
    }
    function spriteData(): string {
        const fields = [
            Client.imageMapfunction,
            Client.imageHitmarks,
            SpriteLoader.hitbarDefault,
            Client.headiconsPk,
            Client.imageHeadiconsPrayer,
            Client.hintHeadicons,
            Client.hintMapMarkers,
            Client.imageMapflag === null ? null : [Client.imageMapflag],
            SpriteLoader.cross,
            Client.imageMapdots,
            SpriteLoader.scrollbars,
            PixfontGeneric.nameIcons,
            Client.imageCompass === null ? null : [Client.imageCompass],
            SpriteLoader.hintMapEdge
        ];
        const next = new DataView(new ArrayBuffer(8));
        next.setFloat64(0, mathRandom.nextDouble());
        return [
            ...fields.map(sprites),
            ...[Client.fontPlain11, Client.p12, Client.fontBold12].map(f => requireNonNull(f)['icons'] === PixfontGeneric.nameIcons),
            Client.imageMapfunction === SpriteLoader.mapfunctionsRecoloured,
            next.getBigInt64(0)
        ].join('/');
    }
    try {
        for (const r of rows) {
            const [stage, a, g, pc, flag] = r;
            blocked = a;
            gate = g;
            pending = pc;
            Client.loadingStage = stage;
            Preferences.safeMode = (flag & 1) !== 0;
            ClientKeyboardListener.eventReader = 0;
            ClientKeyboardListener.eventLimit = (flag >> 1) & 3;
            ClientKeyboardListener.eventChars.set([120, (flag & 8) !== 0 ? 115 : 83, 33]);
            if (stage === 0) {
                heap = a;
                clock = BigInt(g);
                Client.loadingMemoryCheckStart = 1000n;
                Client.lastGcTime = 500n;
                gcs = 0;
            }
            if (stage === 30 && pc === 100) {
                const request = requireNonNull(requireNonNull(Client.js5MasterIndex)['request']);
                request.packet = new PacketT(5 + 28 * 8);
                request.packet.m_pos = 5 + 28 * 8;
                request.incomplete = false;
            }
            if (stage >= 40) {
                if (stage === 40) for (let i = 0; i < 28; i++) requireNonNull(Client.js5Providers[i])['reference'] = i < pc ? tables[i] : null;
                for (let i = 0; i < slots.length; i++) {
                    const archive = new Js5(new Source(i), false, true),
                        name = slots[i];
                    Client[name] = archive;
                }
            }
            if (stage === 80) mathRandom.setSeed(BigInt(260000000 + language * 13 + gate));
            if (stage === 135) {
                worldError = '';
                Client.gameState = 5;
                GameWorld.ListFetch = a === -1 ? worldPoll : async () => a;
                WorldList.fetchStep = pc === 0 ? 1 : 0;
                WorldList.loaded = pc !== 0;
                WorldList.lastFetchTime = GameWorld.fetchStartTime = clock;
                Client.socketRequest = new SignlinkRequest();
            }
            const oldComponents = IfType.m_list,
                oldTable = InterfaceList.subInterfaces;
            let priorSub: SubInterface | null = null;
            let priorWorlds: GameWorld[] | null = null,
                priorSorted: GameWorld[] | null = null;
            if (stage === 160) {
                phases.length = 0;
                Client.username = Client.percent1;
                Client.password = Client.percent2;
                WorldList.worlds = priorWorlds = [new GameWorld()];
                GameWorld.m_list = priorSorted = priorWorlds.slice();
                GameWorld.m_next = 1;
                WorldList.fetchStep = 3;
                WorldList.fetchAttempts = 2;
                Minimenu.defaultCursor = 42;
                Client.localPlayer = null;
                InterfaceList.dirty.fill(false);
                if (pc === 1) {
                    priorSub = new SubInterface();
                    priorSub.group = 2;
                    priorSub.type = 1;
                    InterfaceList.subInterfaces.put(priorSub, BigInt(Client.loginScreenInterface << 16));
                }
            }
            if (stage === 150) {
                Preferences.buildArea = 2;
                Preferences.antiAliasingMode = 3;
                Preferences.currentAntiAliasingMode = 4;
                Preferences.windowMode = 2;
                window = '';
            }
            await client['MainLoad']();
            let extra = '-';
            if (stage === 65) extra = [fontData(Client.fontPlain11), fontData(Client.p12), fontData(Client.fontBold12), Client.p11Software === Client.fontPlain11].join('/');
            if (stage === 80) extra = spriteData();
            if (stage === 130 && Client.loadingStage === 135) extra = [WorldMap.mapFunctions === Client.imageMapfunction, requireNonNull(WorldMap.disabled).length].join(',');
            if (stage === 135) extra = Client.gameState + ',' + worldError;
            if (stage === 0) extra = [Client.loadingMemoryCheckStart, Client.lastGcTime, gcs].join(',');
            if (stage === 10) {
                const map = requireNonNull(CollisionMap.levelMaps[0]);
                extra = [map.width, requireNonNull(CollisionMap.levelMaps[3]).height, hash(map.flags.map(hash))].join(',');
            }
            if (stage === 30 && Client.loadingStage === 40) extra = String(Client.js5Providers.length);
            if (stage === 110) {
                extra = String(Client.mouseTracking !== null);
                requireNonNull(Client.mouseTracking).running = false;
            }
            if (stage === 140) {
                const bits = [5, 6, 8, 13, 10, 3].map(i => Number(tables[i].groupNames !== null).toString() + Number(tables[i].fileNames !== null)).join('');
                extra = [Client.loginScreenInterface, Client.loadingComplete, bits].join(',');
            }
            if (stage === 160) {
                const self = Client.localPlayer;
                extra = [
                    Client.gameState,
                    InterfaceList.top,
                    Minimenu.defaultCursor,
                    self?.x ?? -1,
                    self?.z ?? -1,
                    requireNonNull(requireNonNull(IfType.m_list)[InterfaceList.top]).filter(Boolean).length,
                    InterfaceList.dirty.filter(Boolean).length,
                    IfType.m_list !== oldComponents,
                    InterfaceList.subInterfaces !== oldTable,
                    priorSub === null || !priorSub.IsLinked(),
                    phases.join('/'),
                    Client.username === Client.percent1,
                    Client.password === Client.percent2,
                    WorldList.worlds === priorWorlds,
                    GameWorld.m_list === priorSorted,
                    GameWorld.m_next,
                    WorldList.fetchStep,
                    WorldList.fetchAttempts
                ].join(',');
            }
            if (stage === 150) extra = [Preferences.buildArea, Preferences.antiAliasingMode, Preferences.currentAntiAliasingMode, Preferences.windowMode, window].join(',');
            console.log([Client.loadingStage, TitleScreen.m_loadPos, Buffer.from(requireNonNull(TitleScreen.m_loadString).toBytes()).toString('base64'), Preferences.safeMode, ClientKeyboardListener.eventReader, extra].join('|'));
        }
    } finally {
        await assets.stop();
        await GameShell.signlink.stopWorker();
    }
}

// Global class state and real stage-70 definitions survive a client instance.
// Start a fresh JS realm and JVM for each of the three supported languages.
if (process.argv[2] === 'fixture') await fixture(Number(process.argv[3]));
else {
    const { test, expect } = await import('bun:test');
    test('client.f loading progress, localization, input, archive readiness, name disposal and safe-mode preferences match revision 530', () => {
        const dir = mkdtempSync(join(tmpdir(), 'loading530-')),
            asm = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED'];
        try {
            const source = fileURLToPath(new URL('./game/ClientLoadingOracle.java', import.meta.url));
            const compile = Bun.spawnSync(['javac', ...asm, '-cp', gamepackPath, '-d', dir, source]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const java = ['java', ...asm, '--add-opens', 'java.base/java.lang=ALL-UNNAMED', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'ClientLoadingOracle'];
            const patch = Bun.spawnSync([...java, 'prepare', gamepackPath, dir]);
            expect(patch.exitCode, patch.stderr.toString()).toBe(0);
            const input = Buffer.from(rows.map(r => r.join(' ')).join('\n') + '\n');
            for (const language of [0, 1, 2]) {
                const original = Bun.spawnSync([...java, 'run', cachePath, String(language)], { stdin: input, timeout: 45000 });
                expect(original.exitCode, original.stderr.toString()).toBe(0);
                const ts = Bun.spawnSync([process.execPath, fileURLToPath(import.meta.url), 'fixture', String(language)], { timeout: 45000 });
                expect(ts.exitCode, ts.stderr.toString()).toBe(0);
                const lines = original.stdout.toString().trimEnd().split(/\r?\n/),
                    actual = ts.stdout.toString().trimEnd().split(/\r?\n/);
                expect(actual.length).toBe(rows.length);
                expect(lines.length).toBe(rows.length);
                for (let i = 0; i < rows.length; i++) expect(actual[i], language + ' stage/control ' + rows[i].join(' ')).toBe(lines[i]);
            }
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    }, 180000);
}
