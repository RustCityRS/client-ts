import { expect } from 'bun:test';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import Client from '#/client/Client.js';
import GameShell, { type ShellFrame } from '#/client/GameShell.js';
import { fromJsString } from '#/datastruct/JagString.js';
import GlRenderer from '#/gl/GlRenderer.js';
import JavaUrl from '#/io/JavaUrl.js';
import { JavaError } from '#/util/JavaException.js';
import type Signlink from '#/util/Signlink.js';
import WrappedException from '#/util/WrappedException.js';
import { loginFixture } from '../login-fixture.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

function scenarios(): string[] {
    const cases = ['f'];
    for (const active of [0, 1])
        for (const frame of [0, 1])
            for (const link of [0, 1]) {
                for (let cut = 0; cut <= 13; cut++) cases.push(['q', active, frame, link, cut].join(' '));
            }
    for (const newWindow of [0, 1])
        for (const active of [0, 1])
            for (const js of [0, 1]) {
                for (const mode of ['ok', 'js-error', 'js-fault', 'show-error', 'show-fault', 'first-base', 'no-link', 'clear-shell']) {
                    cases.push(['u', newWindow, active, js, mode, 'manual/item.html?x=2#here'].join(' '));
                }
                for (const address of ['../a/b', 'https://elsewhere.invalid/p?q=ok#h', 'badprotocol:path', 'null']) {
                    cases.push(['u', newWindow, active, js, 'ok', address].join(' '));
                }
            }
    for (const parameter of ['null', 'false', '0', '1', '01', 'true']) cases.push('s ' + parameter);
    return cases;
}

async function quit(r: string[]): Promise<string> {
    const events: string[] = [];
    const cut = Number(r[4]);
    class MouseBoundary extends JavaError {}
    function event(name: string) {
        events.push(name);
        if (events.length === cut) throw new Error('cut');
        if (name === 'mouse') throw new MouseBoundary();
    }
    const display = {
        setVisible(value: boolean) {
            event('visible=' + value);
        },
        dispose() {
            event('dispose');
        }
    } as unknown as ShellFrame;
    const shell = new Client();
    const link = {
        exitFullscreen(which: ShellFrame) {
            expect(which).toBe(display);
            event('exit');
            return { status: 1 };
        },
        releaseGlLibrary(type: object) {
            expect(type).toBe(shell.constructor);
            event('request11');
        }
    } as unknown as Signlink;
    let frame: ShellFrame | null = r[2] === '1' ? display : null;
    const entries: [object, string, PropertyDescriptor][] = [
        [
            GlRenderer,
            'active',
            {
                get() {
                    event('active');
                    return r[1] === '1';
                }
            }
        ],
        [
            GlRenderer,
            'shutdown',
            {
                value() {
                    event('shutdown');
                }
            }
        ],
        [
            GameShell,
            'fullScreenFrame',
            {
                get() {
                    event('frame');
                    return frame;
                },
                set(value) {
                    frame = value;
                    event('cleared');
                }
            }
        ],
        [
            GameShell,
            'signlink',
            {
                get() {
                    event('link');
                    return r[3] === '1' ? link : null;
                }
            }
        ],
        [
            Client,
            'mouseTracking',
            {
                get() {
                    event('mouse');
                }
            }
        ]
    ];
    const originals = entries.map(([owner, name]) => {
        const descriptor = Object.getOwnPropertyDescriptor(owner, name);
        if (!descriptor) throw new Error('Missing native field ' + name);
        return descriptor;
    });
    let status = 'ok';
    try {
        for (const [owner, name, descriptor] of entries) Object.defineProperty(owner, name, { ...descriptor, configurable: true });
        await shell['MainQuit']();
    } catch (error) {
        if (error instanceof MouseBoundary) status = 'boundary';
        else if (error instanceof WrappedException && (error.cause?.message === 'cut' || error.cause instanceof TypeError)) {
            status = error.context + '/' + (error.cause instanceof TypeError ? 'NullPointerException' : 'IllegalStateException');
        } else throw error;
    } finally {
        entries.forEach(([owner, name], i) => Object.defineProperty(owner, name, originals[i]));
    }
    return [status, events.join(';'), String(frame === null)].join('|');
}

async function applet(r: string[]): Promise<string> {
    const events: string[] = [];
    const shell = new Client();
    let reads = 0,
        status = 'ok';
    if (r[0] === 'f') {
        const link = {
            exitFullscreen(frame: ShellFrame | null) {
                expect(frame).toBeNull();
                events.push('exit');
                return { status: 1 };
            }
        } as unknown as Signlink;
        try {
            await GameShell.exitFullscreen(null, link);
        } catch (error) {
            if (!(error instanceof WrappedException) || !(error.cause instanceof TypeError)) throw error;
            status = error.context + '/NullPointerException';
        }
        return [status, events.join(';'), '-'].join('|');
    }
    const mode = r[4];
    shell.getCodeBase = () => {
        events.push('base');
        reads++;
        if (mode === 'first-base' && reads === 1) throw new Error('base');
        return JavaUrl.parse('https://example.invalid/folder' + reads + '/client.bin');
    };
    shell.getAppletContext = () => {
        events.push('context');
        if (mode === 'clear-shell') GameShell.m_activeShell = null;
        return {
            showDocument(url, target) {
                events.push('show=' + target + '=' + url.toString());
                if (mode === 'show-error') throw new JavaError('show');
                if (mode === 'show-fault') throw new Error('show');
            }
        };
    };
    const marker = {};
    if (mode === 'no-link') {
        GameShell.signlink = null;
    } else {
        GameShell.signlink = {
            applet: {
                call(name: string, args: unknown[]) {
                    expect(args).toHaveLength(1);
                    events.push(name + '=' + args[0]);
                    if (mode === 'js-error') throw new JavaError('js');
                    if (mode === 'js-fault') throw new Error('js');
                    return null;
                },
                getParameter(name: string) {
                    events.push('param=' + name);
                    return r[1] === 'null' ? null : r[1];
                }
            },
            startThread(app: Client, priority: number) {
                expect(app).toBe(shell);
                expect(priority).toBe(1);
                events.push('thread');
                return { status: 1, result: marker };
            }
        } as unknown as Signlink;
    }
    if (r[0] === 's') {
        GameShell.m_activeShell = null;
        GameShell.openWindowJs = r[1] !== '1';
        GameShell.gameThread = null;
        await shell.StartApp(765, 32, 530, 503);
        return ['ok', events.join(';'), [GameShell.openWindowJs, GameShell.gameThread === marker].join(',')].join('|');
    }
    GameShell.m_activeShell = shell;
    GlRenderer.active = r[2] === '1';
    GameShell.openWindowJs = r[3] === '1';
    try {
        GameShell.openUrl(r[1] === '1', r[5] === 'null' ? null : fromJsString(r[5]));
    } catch (error) {
        if (!(error instanceof JavaError) || error.message !== 'show') throw error;
        status = 'host-error';
    }
    return [status, events.join(';'), '-'].join('|');
}

loginFixture(
    import.meta.url,
    'HD shell quit, startup and URL opening follow the JAR at each host boundary',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-shell-host-'));
        try {
            const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
            const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
            const compile = Bun.spawnSync(['javac', asm, '-encoding', 'UTF-8', '-cp', cp, '-sourcepath', import.meta.dir, '-d', dir, join(import.meta.dir, 'HdShellHostOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const java = ['java', asm, '-Djava.awt.headless=true', '-cp', cp, 'HdShellHostOracle'];
            const instrument = Bun.spawnSync([...java, dir]);
            expect(instrument.exitCode, instrument.stderr.toString()).toBe(0);
            const recipes = scenarios();
            const run = Bun.spawnSync(java, { stdin: Buffer.from(recipes.join('\n') + '\n') });
            expect(run.exitCode, run.stderr.toString()).toBe(0);
            const expected = run.stdout.toString().trimEnd().split(/\r?\n/);
            expect(expected).toHaveLength(recipes.length);
            for (const [i, recipe] of recipes.entries()) {
                const args = recipe.split(' ');
                expect(await (args[0] === 'q' ? quit(args) : applet(args)), recipe).toBe(expected[i]);
            }

            const bundle = await Bun.build({ entrypoints: [join(import.meta.dir, 'shell-host.browser.ts')], target: 'browser', format: 'iife', define: { 'process.env.RS530_GAMEPACK_IDENTITY': '"gl"' } });
            expect(bundle.success, bundle.logs.map(v => v.message).join('\n')).toBe(true);
            writeFileSync(join(dir, 'probe.js'), await bundle.outputs[0].text());
            const page = join(dir, 'probe.html');
            writeFileSync(page, '<!doctype html><meta charset="utf-8"><pre></pre><script src="probe.js"></script>');
            const chrome = [process.env.CHROME_BIN, Bun.which('google-chrome'), Bun.which('chromium'), join(process.env.PROGRAMFILES ?? '', 'Google/Chrome/Application/chrome.exe')].find(p => p && existsSync(p));
            if (!chrome) throw new Error('Chrome is required for the browser Signlink queue test');
            const browser = Bun.spawnSync(
                [chrome, '--headless=new', '--disable-gpu', '--disable-extensions', '--no-first-run', '--disable-sync', '--disable-background-networking', '--dump-dom', '--user-data-dir=' + join(dir, 'profile'), pathToFileURL(page).href],
                { timeout: 30000 }
            );
            expect(browser.exitCode, browser.stderr.toString()).toBe(0);
            const data = browser.stdout.toString().match(/<pre>(.*?)<\/pre>/s)?.[1];
            expect(data, browser.stdout.toString()).toBe(
                JSON.stringify([
                    [0, 0, 0, true, true, true, 11, 0, true],
                    [9, 11, 9],
                    [1, 'first', 1, null, 1, 'last']
                ])
            );
        } finally {
            rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
        }
    },
    60000,
    'gl'
);
