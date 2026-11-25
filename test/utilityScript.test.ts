import NpcType from '#/config/NpcType.js';
import ObjType from '#/config/ObjType.js';
import { setLocalWorld, saveWorldConnection } from './world-connection.js';
import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import { cachePath, gamepackPath } from './reference.js';
import { localAssets, readGroup } from './cachefile.js';
import Client from '#/client/Client.js';
import GameShell from '#/client/GameShell.js';
import ClientKeyboardListener from '#/client/ClientKeyboardListener.js';
import LocType from '#/config/LocType.js';
import JagString, { fromJsString } from '#/datastruct/JagString.js';
import Pix32 from '#/graphics/Pix32.js';
import JavaUrl from '#/io/JavaUrl.js';
import SuperPacket from '#/io/SuperPacket.js';
import { ClientScript } from '#/script/ClientScript.js';
import HookReq from '#/script/HookReq.js';
import ScriptRunner from '#/script/ScriptRunner.js';
import InterfaceList from '#/ui/InterfaceList.js';
import LocalisedText from '#/ui/LocalisedText.js';
import Minimenu from '#/ui/Minimenu.js';
import Preferences from '#/ui/Preferences.js';
import { requireNonNull } from '#/util/JavaArray.js';
import Signlink from '#/util/Signlink.js';
import SignlinkRequest from '#/util/SignlinkRequest.js';

const skinInts = ['backgroundColour', 'transparency', 'highlightColour', 'skinHoverAlpha', 'skinTitleSpriteId', 'skinTitleEndSprite', 'bottomSpriteId', 'sideSpriteId', 'skinBottomCornerSprite', 'textColour', 'skinHighlightTextColour'] as const;
const skinSprites = ['spriteBottomCorner', 'titleBarSprite', 'bottomEdgeSprite', 'skinTitleEndSprite2', 'styleSideSprite'] as const;
const hex = (v: JagString | null) => (v === null ? '-' : Buffer.from(v.toBytes()).toString('hex'));
const utf8 = (v: string) => Buffer.from(v).toString('hex');
type Input = { op: number; ints: number[]; strings: JagString[] };

function code(row: Input): ClientScript {
    const s = new ClientScript(),
        before = fromJsString('before'),
        after = fromJsString('after');
    const ops = [0, 3, ...row.ints.map(() => 0), ...row.strings.map(() => 3), row.op, 0, 3, 21];
    s.opcodes = Int32Array.from(ops);
    s.intOperands = Int32Array.from([7124, 0, ...row.ints, ...row.strings.map(() => 0), 0, 0x45e24, 0, 0]);
    s.stringOperands = [null, before, ...row.ints.map(() => null), ...row.strings, null, null, after, null];
    return s;
}

test('gh utilities reproduce Java website, palette, menu skins, sprite prefetch, platform and script output', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'utility-cs2-'));
    const assets = localAssets(cachePath, [3, 8, 12]),
        sprites = assets.archive(8),
        real = sprites.RequestDownload2;
    const ids: number[] = [];
    for (let id = 0; id < 100 && ids.length < 8; id++) if (sprites.GetFileIdLimit(id) === 1) ids.push(id);
    expect(ids.length).toBe(8);
    const saved = {
        world: saveWorldConnection(),
        lang: LocalisedText.language,
        platform: Signlink.platform,
        os: Signlink.osNameLower,
        sprites: Client.m_pSprites,
        shell: GameShell.m_activeShell,
        link: GameShell.signlink,
        frame: GameShell.frame,
        active: Client.activeClient,
        dirty: InterfaceList.dirty.slice(),
        ie: Client.haveIe6,
        address: Client.pendingUrl,
        mode: Client.urlNewWindow,
        req: Client.openUrlRequest,
        dns: Client.dnsRequest,
        out: Client.out,
        rc: Client.recolourPalette,
        loc: LocType.recolPalette,
        npc: NpcType.clientPalette,
        obj: ObjType.recolourPalette,
        style: Minimenu.spriteStyle,
        ints: skinInts.map(k => Minimenu[k]),
        images: skinSprites.map(k => Minimenu[k]),
        cursor: Minimenu.objCursor,
        examine: Minimenu.examineCursor,
        held: [ClientKeyboardListener.pressed[81], ClientKeyboardListener.pressed[82], ClientKeyboardListener.pressed[86]],
        stepped: Preferences.steppedCameraKeys,
        write: Preferences.write
    };
    const rows: Input[] = [];
    const strings = ['', 'café', 'A'.repeat(290), 'foo/bar?q=±#frag', '../page?request=1', 'a+b', 'ïÿ'];
    for (let i = 0; i < 36; i++) {
        const str = fromJsString(strings[i % strings.length]),
            other = fromJsString(strings[(i + 1) % strings.length]);
        rows.push(
            { op: 5400, ints: [i * 91], strings: [str, other] },
            { op: 5401, ints: [(i * 13) & 255, i * 912477], strings: [] },
            { op: 5411, ints: [], strings: [] },
            { op: 5419, ints: [], strings: [] },
            { op: 5420, ints: [], strings: [] },
            { op: 5421, ints: [i % 3], strings: [str] },
            { op: 5423, ints: [], strings: [str] },
            { op: 5424, ints: [i, -i, i * 300, -1, ...Array.from({ length: 5 }, (_, j) => ids[(j + i) % ids.length]), 0xabc123, i * 789], strings: [] },
            { op: 5425, ints: [], strings: [] },
            { op: 5427, ints: [-i, i * 93937], strings: [] },
            { op: 5100, ints: [], strings: [] },
            { op: 5101, ints: [], strings: [] },
            { op: 5102, ints: [], strings: [] },
            { op: 6600, ints: [i % 3], strings: [] },
            { op: 6601, ints: [], strings: [] }
        );
    }
    let shown = '~';
    const requests: number[] = [];
    const applet = {
        getCodeBase: () => JavaUrl.parse('https://rs.example/game/'),
        getAppletContext: () => ({
            showDocument(url: JavaUrl, target: string) {
                shown = url.toString() + ' ' + target;
            }
        })
    };
    const link = (GameShell.signlink = new Signlink(applet));
    GameShell.m_activeShell = Object.create(Client.prototype) as Client;
    GameShell.frame = null;
    setLocalWorld(1);
    const packet = (Client.out = new SuperPacket(5000));
    packet.SetEnc(Int32Array.of(3, 7, 11, 13));
    Client.m_pSprites = sprites;
    const s = new HookReq();
    s.args = [39501];
    let script: ClientScript | null = null;
    const errors: Error[] = [],
        vm = new ScriptRunner(
            () => script,
            e => errors.push(e)
        );
    const img = new Pix32(1, 1),
        icon = new Pix32(1, 1);
    const mark = 0x45e24;
    try {
        const args = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED'];
        const compile = Bun.spawnSync(['javac', ...args, '-cp', gamepackPath, '-d', dir, resolve(import.meta.dir, 'ui/BrowserPacketOracle.java'), resolve(import.meta.dir, 'ui/UtilityScriptOracle.java')]);
        expect(compile.stderr.toString()).toBe('');
        expect(compile.exitCode).toBe(0);
        const jvm = ['java', ...args, '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'UtilityScriptOracle'];
        const indexPath = join(dir, '8');
        writeFileSync(indexPath, readGroup(cachePath, 255, 8));
        const fixture = rows.map((r, i) => [r.op, (i / 15) | 0, r.ints.join(','), r.strings.length === 0 ? '~' : r.strings.map(hex).join(',')].join('|')).join('\n') + '\n';
        const oracle = Bun.spawnSync([...jvm, indexPath], { stdin: Buffer.from(fixture) });
        expect(oracle.stderr.toString()).toBe('');
        expect(oracle.exitCode).toBe(0);
        const lines = oracle.stdout.toString().trimEnd().split(/\r?\n/);
        expect(lines.length).toBe(rows.length);
        sprites.RequestDownload2 = function (id) {
            requests.push(id);
            return real.call(this, id);
        };
        for (const [rowIndex, row] of rows.entries()) {
            const i = (rowIndex / 15) | 0;
            script = code(row);
            packet.m_pos = 0;
            requests.length = 0;
            shown = '~';
            Client.modeWhere = i % 3;
            Client.affiliateId = Math.imul(i, 9981171);
            Client.settings = i % 3 === 1 ? null : fromJsString(i % 3 === 2 ? 'é+?x' : '');
            LocalisedText.language = i % 4;
            Signlink.platform = (i % 2) + 2;
            Signlink.osNameLower = i % 4 < 2 ? 'windows' : 'linux';
            Client.haveIe6 = i % 5 === 0;
            Client.dnsRequest = null;
            if (i % 4 !== 0) {
                const dns = (Client.dnsRequest = new SignlinkRequest<string>());
                dns.intArg = Math.imul(i, 51937153);
                if (i % 4 >= 2) dns.result = i % 4 === 2 ? 'höst.name' : 'a\0😀b';
            }
            Client.recolourPalette = LocType.recolPalette = NpcType.clientPalette = ObjType.recolourPalette = new Int16Array(256);
            InterfaceList.dirty.fill(false);
            ObjType.modelCache.Put(1n, {});
            ObjType.spriteCache.Put(1n, icon);
            NpcType.m_modelCache.Put(1n, {});
            NpcType.headModelCache.Put(1n, {});
            for (const k of skinSprites) Minimenu[k] = img;
            for (const k of skinInts) Minimenu[k] = 181;
            Minimenu.objCursor = 92;
            Minimenu.examineCursor = 93;
            Minimenu.spriteStyle = i % 3 === 1;
            Client.openUrlRequest = null;
            Client.pendingUrl = null;
            Client.urlNewWindow = false;
            ClientKeyboardListener.pressed[81] = (i & 1) !== 0;
            ClientKeyboardListener.pressed[82] = (i & 2) !== 0;
            ClientKeyboardListener.pressed[86] = (i & 4) !== 0;
            Preferences.steppedCameraKeys = (i & 1) !== 0;
            let writes = 0;
            Preferences.write = () => {
                writes++;
            };
            let log = '';
            const print = console.log;
            try {
                console.log = (...a: unknown[]) => {
                    log += a.join(' ') + '\n';
                };
                vm.run(s);
            } finally {
                console.log = print;
            }
            expect(
                errors.map(e => e.message),
                row.op + ' VM'
            ).toEqual([]);
            const req = Client.openUrlRequest as SignlinkRequest | null;
            if (req !== null) await new Promise(resolve => setTimeout(resolve, 0));
            const ints = ScriptRunner.intStack.slice(0, ScriptRunner.intStack.indexOf(mark) + 1).join(',');
            const strs = ScriptRunner.stringStack
                .slice(0, 1 + ScriptRunner.stringStack.findIndex(v => hex(v) === '6166746572'))
                .map(hex)
                .join(',');
            const caches = [ObjType.modelCache, ObjType.spriteCache, NpcType.m_modelCache, NpcType.headModelCache].map(c => (c.Find(1n) === null ? 0 : 1)).join('');
            const hash = requireNonNull(Client.recolourPalette).reduce((acc, n) => (Math.imul(acc, 31) + n) | 0, 1);
            const address = [utf8(shown), hex(Client.pendingUrl), Client.urlNewWindow, req === null ? '-' : [req.type, req.status, utf8(String(req.objectArg))].join(',')];
            const skin = [...skinInts.map(k => Minimenu[k]), Minimenu.spriteStyle, ...skinSprites.map(k => Minimenu[k] !== null), Minimenu.objCursor, Minimenu.examineCursor];
            expect(
                [
                    ints,
                    strs,
                    Buffer.from(requireNonNull(packet.m_data).slice(0, packet.m_pos)).toString('hex'),
                    [hash, InterfaceList.dirty.filter(Boolean).length, caches],
                    address,
                    skin,
                    requests,
                    utf8(log),
                    [Preferences.steppedCameraKeys, writes]
                ].join(';'),
                row.op + ' state ' + i
            ).toBe(lines[rowIndex]);
        }
        const exit = Bun.spawnSync([...jvm, 'exit']);
        expect(exit.exitCode).toBe(0);
        expect(exit.stdout.toString().trim()).toBe('before exit');
        GameShell.frame = { getSize: () => ({ width: 10, height: 10 }), getInsets: () => ({ left: 0, right: 0, top: 0, bottom: 0 }) };
        const exits: string[] = [],
            oldHost = GameShell.standaloneHost;
        class Standalone extends Client {
            override async Shutdown() {
                exits.push('shutdown');
            }
        }
        Client.activeClient = new Standalone();
        GameShell.standaloneHost = {
            ...oldHost,
            exit: status => {
                exits.push('exit ' + status);
            }
        };
        try {
            ScriptRunner.intStack.fill(0);
            script = code({ op: 5411, ints: [], strings: [] });
            vm.run(s);
            expect(ScriptRunner.intStack.indexOf(mark)).toBe(-1);
            expect(errors.length).toBe(0);
            expect(exits).toEqual(['exit 0']);
        } finally {
            GameShell.standaloneHost = oldHost;
        }
    } finally {
        Client.m_pSprites = saved.sprites;
        sprites.RequestDownload2 = real;
        await link.stopWorker();
        rmSync(dir, { recursive: true, force: true });
        GameShell.frame = saved.frame;
        GameShell.signlink = saved.link;
        GameShell.m_activeShell = saved.shell;
        Client.activeClient = saved.active;
        Signlink.osNameLower = saved.os;
        Signlink.platform = saved.platform;
        Client.haveIe6 = saved.ie;
        LocalisedText.language = saved.lang;
        Object.assign(Client, saved.world);
        Client.dnsRequest = saved.dns;
        Client.out = saved.out;
        Client.openUrlRequest = saved.req;
        Client.pendingUrl = saved.address;
        Client.urlNewWindow = saved.mode;
        [ClientKeyboardListener.pressed[81], ClientKeyboardListener.pressed[82], ClientKeyboardListener.pressed[86]] = saved.held;
        Preferences.steppedCameraKeys = saved.stepped;
        Preferences.write = saved.write;
        Client.recolourPalette = saved.rc;
        LocType.recolPalette = saved.loc;
        NpcType.clientPalette = saved.npc;
        ObjType.recolourPalette = saved.obj;
        Minimenu.spriteStyle = saved.style;
        Minimenu.objCursor = saved.cursor;
        Minimenu.examineCursor = saved.examine;
        skinInts.forEach((k, i) => {
            Minimenu[k] = saved.ints[i];
        });
        skinSprites.forEach((k, i) => {
            Minimenu[k] = saved.images[i];
        });
        InterfaceList.dirty.splice(0, 100, ...saved.dirty);
        ObjType.modelCache.Remove(1n);
        ObjType.spriteCache.Remove(1n);
        NpcType.m_modelCache.Remove(1n);
        NpcType.headModelCache.Remove(1n);
    }
}, 30000);
