import { setAppletWorld } from './world-connection.js';
import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import GameVariant from '#/client/GameVariant.js';
import GameShell from '#/client/GameShell.js';
import JavaUrl from '#/io/JavaUrl.js';
import LocalisedText from '#/ui/LocalisedText.js';
import Minimenu from '#/ui/Minimenu.js';
import PlayerModel from '#/dash3d/PlayerModel.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import Signlink, { type SignlinkRunnable } from '#/util/Signlink.js';
import { clientErrorHost } from '#/util/ClientError.js';
import { JavaError } from '#/util/JavaException.js';
import { FileIoError } from '#/io/File.js';
import JagString, { fromLiteral } from '#/datastruct/JagString.js';
import WrappedException from '#/util/WrappedException.js';
import { gamepackPath } from './reference.js';
import { loginFixture } from './login-fixture.js';
import { attachMainInitHost } from './main-init-fixture.js';

loginFixture(
    import.meta.url,
    'client.init, p host checks and single-instance startup match the original applet and Signlink worker',
    async () => {
        const dir = mkdtempSync(join(import.meta.dir, '../out/client-boot-'));
        const restore = [Client, GameVariant, GameShell, Signlink, LocalisedText, Minimenu, PlayerModel, clientErrorHost].map(type => [type, Object.getOwnPropertyDescriptors(type)] as const);
        const oldActive = Client.activeClient;
        const params = new Map<string, string>();
        const paramFailure = new Error(),
            seriousFailure = new JavaError(),
            ioFailure = new FileIoError();
        function value(name: string): string | null {
            const s = params.get(name);
            if (s === '!runtime') throw paramFailure;
            if (s === '!wrapped') throw WrappedException.wrap(paramFailure, 'parent');
            if (s === '!error') throw seriousFailure;
            if (s === '!io') throw ioFailure;
            if (s === '!empty') {
                JagString.empty = fromLiteral('replaced');
                return null;
            }
            return s ?? null;
        }
        let document: JavaUrl, code: JavaUrl;
        const calls: string[] = [],
            instructions: string[] = [],
            rows: string[] = [];
        let wheelPlatform = 0,
            finishing = false;
        function observe(event: string) {
            if (!finishing) return;
            calls.push(event + '@' + (Client.js5DiskQueue !== null) + '/' + Client.signlinkMode);
            if (event === 'wheel') Signlink.platform = wheelPlatform;
        }
        class HeadlessClient extends Client {
            override async run() {}
            override setCanvasSize(width: number, height: number) {
                observe('canvas' + width + 'x' + height);
                super.setCanvasSize(width, height);
            }
            override setCanvasLocation(x: number, y: number) {
                observe('location' + x + ',' + y);
                super.setCanvasLocation(x, y);
            }
        }
        const game = new HeadlessClient();
        const page = {
            getSize() {
                observe('size');
                return { width: 765, height: 503 };
            },
            getParameter(name: string) {
                calls.push(name);
                return value(name);
            },
            getDocumentBase() {
                calls.push('document');
                value('!document');
                return document;
            },
            getCodeBase() {
                calls.push('code');
                return code;
            },
            getAppletContext() {
                calls.push('context');
                return {
                    showDocument(url: JavaUrl, target: string) {
                        calls.push(target + '=' + url.toString());
                    }
                };
            }
        };
        class HeadlessWorker extends Signlink {
            override startThread(r: SignlinkRunnable | null, priority: number) {
                const task = super.startThread(r, priority);
                if (!finishing) calls.push('request=' + task.type + '/' + task.intArg + '/' + (task.objectArg === game));
                return task;
            }
        }
        const worker = new HeadlessWorker(page);
        setAppletWorld();
        const set = (key: string, value: string | null) => {
            instructions.push('set ' + key + ' ' + (value === null ? '~' : Buffer.from(value).toString('base64')));
            if (value === null) params.delete(key);
            else params.set(key, value);
        };
        const doc = (s: string) => {
            document = JavaUrl.parse(s);
            instructions.push('doc ' + s);
        };
        const base = (s: string) => {
            code = JavaUrl.parse(s);
            instructions.push('code ' + s);
        };
        const reset = () => {
            instructions.push('reset');
            GameShell.m_activeShell = Client.activeClient = null;
            GameShell.m_reloadCount = 0;
            Reflect.set(game, 'errorShown', false);
        };
        const invoke = async (action: 'init' | 'start') => {
            calls.length = 0;
            instructions.push(action);
            let result = 'ok';
            try {
                if (action === 'init') await game.init();
                else await game.StartApp(330, 34, -42, 221);
            } catch (e) {
                let cause = e;
                while (cause instanceof WrappedException && cause.cause !== null) cause = cause.cause;
                result = cause instanceof RangeError && !cause.message.startsWith('language') ? 'number' : cause instanceof TypeError ? 'null' : 'runtime';
                if (cause === paramFailure && e instanceof WrappedException) result = 'runtime/' + e.context;
                if (e === seriousFailure) result = 'error';
                if (e === ioFailure) result = 'io';
            }
            rows.push(
                [
                    result,
                    Client.m_worldId,
                    Client.modeWhere,
                    Client.modewhat,
                    Client.advertSuppressed,
                    LocalisedText.language,
                    Client.objectTag,
                    Client.javascript,
                    GameVariant.id,
                    Client.affiliateId,
                    Client.settings === null ? '-' : Buffer.from(Client.settings.toBytes()).toString('hex'),
                    Client.country,
                    Client.haveIe6,
                    Client.activeClient === game,
                    GameShell.m_activeShell === game,
                    GameShell.m_reloadCount,
                    clientErrorHost.revision,
                    GameShell.m_sHei,
                    GameShell.m_frameHeight,
                    GameShell.leftMargin,
                    GameShell.topMargin,
                    GameShell.m_sWid,
                    GameShell.m_frameWidth,
                    Reflect.get(game, 'errorShown'),
                    calls.join(',')
                ].join('|')
            );
        };
        try {
            GameShell.frame = null;
            GameShell.signlink = worker;
            GameShell.m_sWid = GameShell.m_frameWidth = GameShell.m_sHei = GameShell.m_frameHeight = GameShell.leftMargin = GameShell.topMargin = 0;
            Client.m_worldId = 1;
            Client.modewhat = 0;
            Client.haveIe6 = false;
            LocalisedText.language = Client.country = GameVariant.id = clientErrorHost.revision = 0;
            reset();
            base('http://CONTENT.Example:8080/rs/');
            doc('http://Example.JAGEX.com/');
            await invoke('init');
            set('worldid', '+\u0663\u0665');
            set('modewhere', ' 1');
            await invoke('init');
            set('modewhere', '-5');
            set('modewhat', '2147483648');
            await invoke('init');
            set('modewhere', '1');
            set('modewhat', '2');
            set('advertsuppressed', '1');
            set('lang', '\uff11');
            set('objecttag', '1');
            set('js', 'true');
            set('game', '1');
            set('affid', '-2147483648');
            set('settings', '\u00e9\0\u00df\u20ac');
            set('country', '\uff10\uff17');
            set('haveie6', '1');
            await invoke('init');
            expect([Client.m_worldId, LocalisedText.language, Client.country, Client.affiliateId]).toEqual([35, 1, 7, -2147483648]);
            expect(Client.settings?.toBytes()).toEqual(Uint8Array.of(233, 223, 63));
            await invoke('init');
            await invoke('init');
            await invoke('init');
            await invoke('init');
            reset();
            set('settings', null);
            set('country', null);
            set('lang', ' 0');
            set('affid', '2147483648');
            set('modewhat', '9');
            set('modewhere', '8');
            await invoke('init');
            set('lang', '4');
            await invoke('init');
            set('lang', '0');
            set('country', '2.5');
            for (const host of ['jagex.com', 'notjagex.com', 'runescape.com', 'a.B.runescape.com', 'runescape.com.evil', 'abc127.0.0.1', 'localhost', '192.168.1.', '192.168.1.999', '192.168.1.000x', '[::1]']) {
                reset();
                doc('http://' + host + '/doc?test');
                await invoke('init');
            }
            for (const [world, mode, platform, modewhat, updated, initialFps] of [
                [65535, 0, 3, 1, 7, 0],
                [2147483647, 1, 3, 0, 1, 0],
                [-2147483648, 2, 2, 0, 3, 0],
                [22, 1, 1, 3, 3, 0],
                [0, 7, 3, 0, 2, 0],
                [47, 0, 1, 0, 3, 0],
                [49, 0, 2, 0, 5, 1],
                [51, 2, 1, 1, 3, 1]
            ]) {
                reset();
                doc('http://127.0.0.1/');
                set('worldid', String(world));
                await invoke('init');
                calls.length = 0;
                attachMainInitHost(game, observe);
                Client.modeWhere = mode;
                Client.modewhat = modewhat;
                Signlink.platform = platform;
                wheelPlatform = updated;
                Client.signlinkMode = -37;
                Client.displayFps = initialFps !== 0;
                Object.assign(Client, { js5DiskQueue: null });
                Object.assign(ClientPlayer, { debugBallast: null });
                instructions.push(['finish', mode, platform, modewhat, updated, initialFps].join(' '));
                finishing = true;
                try {
                    await game['MainInit']();
                } finally {
                    finishing = false;
                    await Client.js5DiskQueue?.EndAndJoin();
                }
                rows.push(
                    [
                        'ok',
                        Client.worldListHost,
                        Client.worldListPrimaryPort,
                        Client.worldListSecondaryPort,
                        Client.gameHost,
                        Client.primaryPort,
                        Client.secondaryPort,
                        Client.worldListPort,
                        Client.currentPort,
                        Client.selectedWorldId,
                        Client.displayFps,
                        ClientPlayer.debugBallast?.length ?? -1,
                        Client.signlinkMode,
                        calls.join(',')
                    ].join('|')
                );
            }
            doc('http://127.0.0.1/');
            set('worldid', '1');
            set('modewhere', '1');
            set('modewhat', '2');
            for (const name of ['!document', 'worldid', 'modewhere', 'modewhat', 'advertsuppressed', 'lang', 'objecttag', 'js', 'game', 'affid', 'settings', 'country', 'haveie6']) {
                const previous = params.get(name) ?? null;
                for (const failure of ['!runtime', '!wrapped', '!io', '!error']) {
                    reset();
                    set(name, failure);
                    await invoke('init');
                }
                set(name, previous);
            }
            reset();
            set('settings', '!empty');
            await invoke('init');
            reset();
            await invoke('start');
            await invoke('start');
            const compile = Bun.spawnSync(['javac', '-nowarn', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game/ClientBootOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const result = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'ClientBootOracle'], {
                stdin: Buffer.from(instructions.join('\n') + '\n'),
                timeout: 20000
            });
            expect(result.exitCode, result.stderr.toString()).toBe(0);
            expect(result.stderr.toString()).toBe('');
            const expected = result.stdout.toString().trimEnd().split(/\r?\n/);
            expect(rows.length).toBe(expected.length);
            for (let i = 0; i < rows.length; i++) expect(rows[i], instructions.filter(v => /^(init|start|finish)/.test(v))[i] + ' ' + i).toBe(expected[i]);
        } finally {
            await worker.stopWorker();
            for (const [type, descriptors] of restore) Object.defineProperties(type, descriptors);
            Client.activeClient = oldActive;
            rmSync(dir, { recursive: true });
        }
    },
    30000
);

test('StartApp creates Signlink only for the first applet and executes that applet on its worker', async () => {
    const restore = [GameShell, Signlink, clientErrorHost].map(type => [type, Object.getOwnPropertyDescriptors(type)] as const);
    const events: string[] = [];
    class Applet extends Client {
        protected override appletParameter(name: string): string | null {
            events.push(name);
            return null;
        }
        override async run(): Promise<void> {
            events.push('run');
        }
        override getDocumentBase(): JavaUrl {
            return JavaUrl.parse('http://127.0.0.1/applet');
        }
        override getAppletContext() {
            return {
                showDocument(url: JavaUrl, target: string) {
                    events.push(target + ' ' + url.toString());
                }
            };
        }
    }
    const first = new Applet(),
        second = new Applet();
    const currentInstance = (): GameShell | null => GameShell.m_activeShell;
    const currentWorker = (): Signlink | null => GameShell.signlink;
    try {
        GameShell.signlink = GameShell.errorSignlink = null;
        GameShell.m_activeShell = GameShell.frame = null;
        GameShell.m_reloadCount = 0;
        await first.StartApp(765, 32, 530, 503);
        const worker = currentWorker();
        expect(worker?.applet).toBe(first);
        expect(worker).toBe(GameShell.errorSignlink);
        expect(currentInstance()).toBe(first);
        await second.StartApp(1024, 34, 531, 768);
        expect(currentWorker()).toBe(worker);
        expect(GameShell.m_sWid).toBe(765);
        expect(clientErrorHost.revision).toBe(530);
        expect(events).toEqual(['openwinjs', 'run', '_self http://127.0.0.1/applet']);
    } finally {
        await currentWorker()?.stopWorker();
        for (const [type, descriptors] of restore) Object.defineProperties(type, descriptors);
    }
});
