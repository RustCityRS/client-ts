import JagString from '#/datastruct/JagString.js';
import { setAppletWorld } from './world-connection.js';
import { expect, spyOn } from 'bun:test';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import GameVariant from '#/client/GameVariant.js';
import GameShell from '#/client/GameShell.js';
import LocalisedText from '#/ui/LocalisedText.js';
import Signlink from '#/util/Signlink.js';
import { clientErrorHost } from '#/util/ClientError.js';
import { gamepackPath } from './reference.js';
import { loginFixture } from './login-fixture.js';

loginFixture(
    import.meta.url,
    'standalone argument handling, frame events, window dimensions, Signlink and thread startup agree with client.main',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'standalone-530-')),
            classes = join(dir, 'classes');
        const restore = [Client, GameShell, Signlink, GameVariant, LocalisedText, clientErrorHost].map(t => [t, Object.getOwnPropertyDescriptors(t)] as const);
        const active = Client.activeClient;
        const rows: { args: (string | null)[] | null; fail: string }[] = [];
        const add = (args: (string | null)[] | null, fail = '-') => rows.push({ args, fail });
        for (const mode of ['live', 'rc', 'wip'])
            for (const lang of ['en', 'de', 'fr', 'pt', 'english', 'german', 'DE', 'french', 'e\0n']) {
                for (const game of ['game0', 'game1']) add(['+123', mode, lang, game]);
            }
        for (const world of ['', ' ', '0', '-2147483648', '2147483647', '2147483648', '١٢٣', '1.0', null]) add([world, 'live', 'en', 'game1']);
        for (const fail of ['create', 'title Jagex', 'front', 'insets', 'size 1034 790', 'loc 40 40']) add(['1', 'rc', 'fr', 'game1'], fail);
        add(null, 'nullargs');
        add([]);
        add(['1', 'live']);
        add(['1', 'live', 'en', 'game0', '']);
        add(['1', null, 'en', 'game0']);
        add(['1', 'live', null, 'game1']);
        add(['1', 'live', 'en', null]);
        add(['1', 'RC', 'de', 'game1']);
        add(['1', 'rc', 'de', 'GAME0']);
        add(['-11', '-1', '-23'], 'shell');
        add(['2147483647', '2147483647', '2147483647'], 'shell');

        let calls: string[] = [],
            run = false,
            exit = -1,
            fail = '-';
        const messages: string[] = [];
        const log = spyOn(console, 'log').mockImplementation((...args) => {
            messages.push(args.join(' '));
        });
        const gameThread = spyOn(Client.prototype, 'run').mockImplementation(async () => {
            run = true;
        });
        const start = Signlink.prototype.startThread;
        const startThread = spyOn(Signlink.prototype, 'startThread').mockImplementation(function (this: Signlink, task, priority) {
            calls.push('thread ' + (task === GameShell.m_activeShell) + ' ' + priority);
            return start.call(this, task, priority);
        });
        const call = (text: string) => {
            calls.push(text);
            if (text === fail) throw Error('frame host');
        };
        GameShell.standaloneHost = {
            exit(code) {
                exit = code;
            },
            createFrame() {
                call('create');
                return {
                    setTitle(title) {
                        call('title ' + title);
                    },
                    setResizable(value) {
                        call('resize ' + value);
                    },
                    addWindowListener(shell) {
                        call('listen ' + (shell === GameShell.m_activeShell));
                    },
                    setVisible(value) {
                        call('visible ' + value);
                    },
                    toFront() {
                        call('front');
                    },
                    getSize() {
                        return { width: 0, height: 0 };
                    },
                    getInsets() {
                        call('insets');
                        return { top: 17, left: 3, bottom: 5, right: 7 };
                    },
                    setSize(w, h) {
                        call('size ' + w + ' ' + h);
                    },
                    setLocation(x, y) {
                        call('loc ' + x + ' ' + y);
                    }
                };
            }
        };
        const readSignlink = (): Signlink | null => GameShell.signlink;
        try {
            mkdirSync(classes);
            const manifest = join(dir, 'MANIFEST.MF'),
                agent = join(dir, 'standalone.jar');
            writeFileSync(manifest, 'Manifest-Version: 1.0\r\nPremain-Class: StandaloneOracle\r\n\r\n');
            const exports = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED'];
            const build = Bun.spawnSync(['javac', ...exports, '-cp', gamepackPath, '-d', classes, join(import.meta.dir, 'game', 'StandaloneOracle.java')]);
            expect(build.stderr.toString()).toBe('');
            expect(build.exitCode).toBe(0);
            expect(Bun.spawnSync(['jar', 'cfm', agent, manifest, '-C', classes, '.']).exitCode).toBe(0);
            const input = rows.map(({ args, fail }) => [fail.replaceAll(' ', '_'), ...(args ?? []).map(a => (a === null ? '-' : Buffer.from(a).toString('base64')))].join(' ')).join('\n') + '\n';
            const oracle = Bun.spawnSync(['java', ...exports, '-javaagent:' + agent, '-Djava.awt.headless=true', '-cp', classes + delimiter + gamepackPath, 'StandaloneOracle'], { stdin: Buffer.from(input), timeout: 20000 });
            expect(oracle.stderr.toString()).toBe('');
            expect(oracle.exitCode).toBe(0);
            const expected = oracle.stdout.toString().trimEnd().split(/\r?\n/);
            expect(expected.length).toBe(rows.length);
            for (const [i, row] of rows.entries()) {
                fail = row.fail;
                calls = [];
                messages.length = 0;
                exit = -1;
                run = false;
                setAppletWorld();
                Client.m_worldId = 907;
                Client.modeWhere = 31;
                Client.modewhat = 12;
                LocalisedText.language = 29;
                Client.advertSuppressed = Client.objectTag = Client.javascript = true;
                GameVariant.id = -7;
                Client.haveIe6 = true;
                Client.affiliateId = 91;
                Client.country = 61;
                Client.settings = null;
                Client.activeClient = null;
                GameShell.m_activeShell = GameShell.frame = GameShell.errorSignlink = GameShell.signlink = null;
                clientErrorHost.revision = 908;
                GameShell.leftMargin = 3;
                GameShell.topMargin = 5;
                GameShell.m_sWid = 7;
                GameShell.m_sHei = 9;
                GameShell.m_frameWidth = 11;
                GameShell.m_frameHeight = 13;
                if (row.fail === 'shell' && row.args !== null) {
                    await new Client().StartStandalone(Number(row.args[0]), -17, 85, Number(row.args[1]), 'other', Number(row.args[2]));
                } else await Client.Main(row.args);
                const link = readSignlink();
                await link?.stopWorker();
                const output = messages.join('\n');
                const actual = [
                    Client.m_worldId,
                    Client.modeWhere,
                    Client.modewhat,
                    LocalisedText.language,
                    Client.advertSuppressed,
                    Client.objectTag,
                    Client.javascript,
                    GameVariant.id,
                    Client.haveIe6,
                    Client.affiliateId,
                    Client.country,
                    Client.settings === JagString.empty,
                    Client.activeClient !== null,
                    GameShell.m_activeShell !== null,
                    Client.activeClient === GameShell.m_activeShell,
                    clientErrorHost.revision,
                    GameShell.leftMargin,
                    GameShell.topMargin,
                    GameShell.m_sWid,
                    GameShell.m_sHei,
                    GameShell.m_frameWidth,
                    GameShell.m_frameHeight,
                    GameShell.frame !== null,
                    GameShell.errorSignlink === link,
                    link !== null && link.applet === null,
                    run,
                    exit,
                    calls.join(','),
                    output.startsWith('Error:') ? 'error' : output
                ].join('|');
                expect(actual, JSON.stringify(row)).toBe(expected[i]);
            }
            const original = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', gamepackPath, 'client']);
            expect(original.exitCode).toBe(1);
            expect(original.stdout.toString().trim()).toBe('Bad argument count, Usage: worldid, <live/rc/wip>, <english/german>, <game0/game1>');
            for (const kind of ['normal', 'blocked', 'applet', 'concrete']) {
                const java = Bun.spawnSync(['java', ...exports, '-javaagent:' + agent, '-Djava.awt.headless=true', '-cp', classes + delimiter + gamepackPath, 'StandaloneOracle', kind]);
                expect(java.stderr.toString()).toBe('');
                expect(java.exitCode).toBe(0);
                messages.length = 0;
                class Shell extends Client {
                    protected override async MainQuit() {
                        messages.push('quit');
                    }
                    protected override releaseStatics() {
                        messages.push('release true');
                    }
                }
                const shell = kind === 'concrete' ? new Client() : new Shell();
                GameShell.canvas = null;
                GameShell.m_shutdown = false;
                GameShell.m_activeShell = shell;
                Client.activeClient = kind === 'concrete' ? shell : null;
                fail = '-';
                GameShell.frame = kind === 'applet' ? null : GameShell.standaloneHost.createFrame();
                const worker = (GameShell.signlink = GameShell.errorSignlink = new Signlink());
                GameShell.standaloneHost.exit = code => {
                    messages.push('exit ' + code);
                    if (kind === 'blocked') throw Error('blocked');
                };
                await shell.Shutdown(true);
                if (kind !== 'normal')
                    messages.push(
                        ['returned', GameShell.m_shutdown, Client.activeClient !== null, GameShell.m_activeShell === shell, GameShell.frame !== null, GameShell.errorSignlink !== null, GameShell.signlink !== null, Reflect.get(worker, 'stop')].join(
                            ' '
                        )
                    );
                expect(messages.join('\n'), kind).toBe(java.stdout.toString().trim().replaceAll('\r\n', '\n'));
            }
        } finally {
            log.mockRestore();
            gameThread.mockRestore();
            startThread.mockRestore();
            for (const [type, state] of restore) Object.defineProperties(type, state);
            Client.activeClient = active;
            rmSync(dir, { recursive: true, force: true });
        }
    },
    30000
);
