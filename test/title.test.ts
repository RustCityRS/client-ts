import ScriptRunner from '#/script/ScriptRunner.js';
import InterfaceInputFixture from './interfaceInputFixture.js';
import InterfaceList from '#/ui/InterfaceList.js';
import Login from '#/io/Login.js';
import Client from '#/client/Client.js';
import { expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { compareFramebuffers } from './render/Framebuffer.js';
import { gamepackPath } from './reference.js';
import NativePix2D from '#/graphics/Pix2D.js';
import SpriteLoader from '#/graphics/SpriteLoader.js';
import TitleFlames from '#/title/TitleFlames.js';
import GameShell from '#/client/GameShell.js';
import { localAssets, readGroup } from './cachefile.js';

import { unpackGroup } from './cache/unpackGroup.js';
import Js5IndexFixture from './cache/Js5IndexFixture.js';
import { fromJsString, toJsString } from '#/datastruct/JagString.js';
import WorldList from '#/io/WorldList.js';
import Js5 from '#/cache/Js5.js';
import TitleScreen from '#/title/TitleScreen.js';
import IfType from '#/ui/IfType.js';
import InterfaceSession from '#/ui/InterfaceSession.js';
import InterfaceView from '#/ui/InterfaceView.js';
import Crc32 from '#/io/Crc32.js';
import { mathRandom } from '#/util/JavaRandom.js';

function hash(values: Iterable<number>): number {
    let result = 1;
    for (const value of values) result = (Math.imul(31, result) + value) | 0;
    return result;
}

function originalTitleFrames(cache: string, group: number): Int32Array[] {
    const dir = mkdtempSync(join(tmpdir(), '530-title-frames-'));
    try {
        execFileSync('javac', ['-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'render', 'ProceduralTextureCacheOracle.java'), join(import.meta.dir, 'game', 'CacheTitleFrameOracle.java')]);
        const frames = execFileSync('java', ['-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'CacheTitleFrameOracle', cache, String(group)], { maxBuffer: 4 * 1024 * 1024 });
        const count = 765 * 503;
        expect(frames.length).toBe(2 * count * 4);
        return [0, 1].map(phase => Int32Array.from({ length: count }, (_, i) => frames.readInt32LE((phase * count + i) * 4)));
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

test('rune flames match the SD gamepack after fifteen five-tick updates', () => {
    const random = mathRandom['seed'],
        flames = { ...TitleFlames },
        raster = { ...NativePix2D };
    const frame = new Int32Array(765 * 503).fill(0x999933);
    mathRandom.setSeed(1431n);
    TitleFlames.flameLineOffset = new Int32Array(256);
    TitleFlames.coolingCycle = TitleFlames.phase = TitleFlames.sparks = 0;
    TitleFlames.SetupFire(Object.assign(Object.create(Js5.prototype), { GetFile2: () => null }));
    NativePix2D.setPixels(frame, 765, 503);
    // client.g ticks fk.Y once per logic cycle (ng.c); vb.b consumes it and reads hh.kb at draw time.
    const savedCycle = Client.loopCycle,
        savedPending = TitleFlames.pendingCycles;
    TitleFlames.pendingCycles = 0;
    try {
        for (let cycle = 1; cycle <= 75; cycle++) {
            Client.loopCycle = cycle;
            TitleFlames.tick();
            if (cycle % 5 === 0) TitleFlames.RenderFlames(16, 16);
        }
    } finally {
        Client.loopCycle = savedCycle;
        TitleFlames.pendingCycles = savedPending;
        Object.assign(TitleFlames, flames);
        Object.assign(NativePix2D, raster);
        mathRandom['seed'] = random;
    }
    expect(hash(frame)).toBe(803259979);
});

test.skipIf(!process.env.CACHE_530)(
    '530 cache title pixels, login component layout and IF3 draw match the Java gamepack',
    () => {
        const cache = process.env.CACHE_530;
        if (cache === undefined) throw new TypeError('CACHE_530 is not set');
        const group = (archive: number, id: number) => readGroup(cache, archive, id);
        const assets = localAssets(
            cache,
            Array.from({ length: 28 }, (_, id) => id)
        );
        const pixels = new Int32Array(765 * 503);
        const titleState = { ...TitleScreen },
            rasterState = { ...NativePix2D };
        const width = GameShell.m_sWid,
            height = GameShell.m_sHei,
            percent = TitleScreen.m_loadPos,
            message = TitleScreen.m_loadString;
        try {
            GameShell.m_sWid = 765;
            GameShell.m_sHei = 503;
            TitleScreen.m_loadPos = 50;
            TitleScreen.m_loadString = fromJsString('Loaded title screen');
            NativePix2D.setPixels(pixels, 765, 503);
            TitleScreen.m_open = false;
            TitleScreen.backgroundId = 1407;
            TitleScreen.logoGroup = 498;
            const archive = assets.archive(8);
            const font = SpriteLoader.loadFont(archive, 496, 0, assets.archive(13));
            TitleScreen.Open(archive);
            TitleScreen.Draw(-1, font, false);
            expect(hash(pixels)).toBe(1545058567);
        } finally {
            Object.assign(TitleScreen, titleState);
            Object.assign(NativePix2D, rasterState);
            GameShell.m_sWid = width;
            GameShell.m_sHei = height;
            TitleScreen.m_loadPos = percent;
            TitleScreen.m_loadString = message;
        }
        const flameState = { ...TitleFlames },
            randomSeed = mathRandom['seed'];
        const rootCount = InterfaceList.rootCount,
            qa = Client.qaOpTest;
        const redraw = InterfaceList.rectRedrawnLastFrame;
        try {
            // vb.a calls pj.c to dirty every root; db.a copies those bits to n.i for the full title draw.
            Object.assign(InterfaceList, { rectRedrawnLastFrame: new Array<boolean>(100).fill(true) });
            GameShell.m_sWid = 765;
            GameShell.m_sHei = 503;
            Client.qaOpTest = false;
            NativePix2D.setPixels(pixels, 765, 503);
            TitleFlames.pendingCycles = 0;
            TitleFlames.runesGroup = assets.archive(8).GetGroupId(fromJsString('runes'));
            TitleFlames.SetupFire(assets.archive(8));

            const table = group(255, 3);
            const index = new Js5IndexFixture(table, Crc32.compute(0, table, table.length));
            const id = index.getGroupId('loginscreen');
            const reference = originalTitleFrames(cache, id);
            const components = unpackGroup(index, id, group(3, id)).map((bytes, i) => {
                if (bytes === undefined) throw new TypeError(`loginscreen component ${i} is missing`);
                return IfType.decode((id << 16) | i, bytes);
            });
            expect(components.length).toBe(434);
            const view = new InterfaceView(components);
            const errors: Error[] = [];
            const ui = new InterfaceSession(view, assets, error => errors.push(error));
            expect(hash(components.flatMap(c => [c.x, c.y, c.width, c.height]))).toBe(-263961196);
            NativePix2D.cls();
            InterfaceList.rootCount = 0;
            Client.drawTopLevelInterface();
            compareFramebuffers({ width: 765, height: 503, pitch: 765, pixels: reference[0] }, { width: 765, height: 503, pitch: 765, pixels: pixels });
            expect(hash(pixels)).toBe(-267401199);

            WorldList.decode(Buffer.from('0101010000555300010101000000000001002d00006c6f63616c686f73740000000001000000', 'hex'));
            // The archived title login script's CS2 guards (5600/5603-5605) need the real login state 10 (tf.C).
            const savedState = Client.gameState;
            const savedWorld = Client.selectedWorldId;
            Client.selectedWorldId = 1;
            const savedLogin = [Login.loginType, Login.reply, Login.hopTime, Login.disallowResult, Login.loops, Client.loginStep, Client.loginRetryCount];
            const savedLookup = [Login.worldLookupStep, Login.worldLookupErrors, Client.loginConnectCycles];
            const savedSocketError = Client.socketError;
            const savedUsername = Client.username,
                savedPassword = Client.password;
            let fixture: InterfaceInputFixture | undefined;
            Client.gameState = 10;
            Login.reply = -2;
            Client.loginStep = Login.worldLookupStep = 0;
            try {
                const nativeInput = (fixture = new InterfaceInputFixture(ui));
                ScriptRunner.OnLoad(InterfaceList.top, ui.runner);
                Client.InterfaceCalculateSizeAndPosAll(false);
                NativePix2D.cls();
                InterfaceList.rootCount = 0;
                Client.drawTopLevelInterface();
                compareFramebuffers({ width: 765, height: 503, pitch: 765, pixels: reference[1] }, { width: 765, height: 503, pitch: 765, pixels: pixels });
                expect(hash(pixels)).toBe(1343206555);

                let cycle = 0;
                function click(x: number, y: number): void {
                    nativeInput.tick({ x, y, held: true, click: { x, y }, keys: [] }, ++cycle);
                    nativeInput.tick({ x, y, held: false, keys: [] }, ++cycle);
                }
                function type(text: string): void {
                    for (const c of text) nativeInput.tick({ x: -1, y: -1, held: false, keys: [{ keyCode: -1, keyChar: c.charCodeAt(0) }] }, ++cycle);
                }
                click(381, 178);
                type('oracle530');
                click(380, 336);
                type('password');
                expect(toJsString(components[340].textValue)).toBe('oracle530');
                expect(toJsString(components[346].textValue).replace('|', '')).toBe('********');
                click(380, 378);
                expect(errors).toEqual([]);
                expect(Login.reply).toBe(-3);
            } finally {
                Client.gameState = savedState;
                Client.selectedWorldId = savedWorld;
                [Login.loginType, Login.reply, Login.hopTime, Login.disallowResult, Login.loops, Client.loginStep, Client.loginRetryCount] = savedLogin;
                [Login.worldLookupStep, Login.worldLookupErrors, Client.loginConnectCycles] = savedLookup;
                Client.socketError = savedSocketError;
                Client.username = savedUsername;
                Client.password = savedPassword;
                fixture?.restore();
            }
        } finally {
            GameShell.m_sWid = width;
            GameShell.m_sHei = height;
            InterfaceList.rootCount = rootCount;
            Object.assign(InterfaceList, { rectRedrawnLastFrame: redraw });
            Client.qaOpTest = qa;
            Object.assign(TitleFlames, flameState);
            Object.assign(NativePix2D, rasterState);
            mathRandom['seed'] = randomSeed;
        }
    },
    30000
);
