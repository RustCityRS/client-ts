import { expect, spyOn } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import GameShell from '#/client/GameShell.js';
import { GamepackClassNotFound } from '#/io/GamepackClass.js';
import { LineUnavailableError } from '#/sound/DevicePcmPlayer.js';
import { FileIoError } from '#/io/File.js';
import { SocketIoError } from '#/io/SocketPlatform.js';
import { JavaError } from '#/util/ClientError.js';
import Signlink from '#/util/Signlink.js';
import WrappedException from '#/util/WrappedException.js';
import { gamepackPath } from './reference.js';
import { loginFixture } from './login-fixture.js';

type Row = [flags: number, trigger: number, action: number, clean: number];
function cases(): Row[] {
    const rows: Row[] = [];
    for (let flags = 0; flags < 64; flags++) for (const clean of [0, 1]) rows.push([flags, 0, 0, clean]);
    for (const flags of [0, 2, 4, 8, 16])
        for (let trigger = 1; trigger <= 9; trigger++) {
            for (let action = 1; action <= 14; action++) for (const clean of [0, 1]) rows.push([flags, trigger, action, clean]);
        }
    for (const pause of [-2, -3]) for (const clean of [0, 1]) rows.push([0, pause, 0, clean]);
    return rows;
}
function nativeResult(error: unknown, original: WrappedException): string {
    if (error instanceof WrappedException) {
        return (error === original ? 'same:' : 'wrap:') + error.context + '/' + nativeResult(error.cause, original);
    }
    if (error instanceof TypeError) return 'null';
    if (error instanceof GamepackClassNotFound) return 'class';
    if (error instanceof LineUnavailableError) return 'line';
    if (error instanceof FileIoError || error instanceof SocketIoError) return 'io';
    return error instanceof JavaError ? 'error' : 'runtime';
}

loginFixture(
    import.meta.url,
    'shell shutdown matches the original JAR across applet, canvas and worker callbacks, failures and repeat calls',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-shell-shutdown-'));
        const rows = cases();
        let lines: string[];
        try {
            const cc = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, ...['ShellShutdownOracle', 'WindowModeOracle'].map(c => join(import.meta.dir, 'game', c + '.java'))]);
            expect(cc.exitCode, cc.stderr.toString()).toBe(0);
            const result = Bun.spawnSync(['java', '--add-opens=java.desktop/java.awt=ALL-UNNAMED', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'ShellShutdownOracle'], {
                stdin: Buffer.from(rows.map(v => v.join(' ')).join('\n') + '\n'),
                maxBuffer: 4194304
            });
            expect(result.exitCode, result.stderr.toString()).toBe(0);
            lines = result.stdout.toString().trimEnd().split(/\r?\n/);
            expect(lines).toHaveLength(rows.length);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }

        let output: string[] = [];
        let onPrint: (s: string) => void = () => {};
        const log = spyOn(console, 'log').mockImplementation(s => {
            onPrint(s);
            output.push(s);
        });
        try {
            for (const [index, [flags, trigger, action, clean]] of rows.entries()) {
                let events = 0,
                    trace = '';
                const original = WrappedException.wrap(new Error('wrapped'), 'origin');
                function event(s: string) {
                    trace += s + ';';
                    if (++events !== trigger) return;
                    switch (action) {
                        case 1:
                            throw new Error('callback');
                        case 2:
                            throw original;
                        case 3:
                            throw new JavaError('callback');
                        case 4:
                            throw new FileIoError('callback');
                        case 5:
                            GameShell.canvas = canvas[1];
                            break;
                        case 6:
                            GameShell.canvas = null;
                            break;
                        case 7:
                            GameShell.signlink = links[1];
                            break;
                        case 8:
                            GameShell.signlink = null;
                            break;
                        case 9:
                            parents[1] = null;
                            break;
                        case 10:
                            void shell.Shutdown(!clean);
                            break;
                        case 11:
                            GameShell.canvas = canvas[1];
                            GameShell.signlink = links[1];
                            break;
                        case 12:
                            throw new SocketIoError('callback');
                        case 13:
                            throw new LineUnavailableError('callback');
                        case 14:
                            throw new GamepackClassNotFound('callback');
                    }
                }
                onPrint = s => event('log:' + s);
                const paused = Promise.withResolvers<void>(),
                    resume = Promise.withResolvers<void>();
                function hold() {
                    paused.resolve();
                    return resume.promise;
                }
                class Shell extends Client {
                    protected override async MainQuit() {
                        event('quit');
                        if (trigger === -2) await hold();
                    }
                    protected override releaseStatics() {
                        event('release:true');
                    }
                }
                const shell = new Shell();
                const canvasId = (obj: object | null): string => (obj === null ? '-' : obj === canvas[0] ? '0' : '1');
                const parents: ({ remove(c: object | null): void } | null)[] = [0, 1].map(i => {
                    if (flags & 16) {
                        return null;
                    } else {
                        return {
                            remove(c: object | null) {
                                event('remove' + i + ':' + canvasId(c));
                            }
                        };
                    }
                });
                const canvas = [0, 1].map(i => ({
                    removeFocusListener(listener: GameShell) {
                        event('focus' + i + ':' + (listener === shell));
                    },
                    getParent() {
                        event('parent' + i);
                        return parents[i];
                    }
                }));
                const links: Signlink[] = [0, 1].map(i => {
                    const applet = {
                        destroy() {
                            event('destroy' + i);
                            if (trigger === -3) return hold();
                        }
                    };
                    return Object.assign(Object.create(Signlink.prototype), {
                        applet: flags & 2 ? null : flags & 4 ? shell : applet,
                        stop: false,
                        worker: { async join() {} },
                        cacheData: {
                            close() {
                                event('stop' + i);
                            }
                        },
                        masterIndex: null,
                        cacheIndexes: null,
                        randomFile: null
                    });
                });
                GameShell.m_activeShell = shell;
                GameShell.signlink = flags & 1 ? null : links[0];
                GameShell.canvas = flags & 8 ? null : canvas[0];
                GameShell.m_shutdown = (flags & 32) !== 0;
                GameShell.frame = null;
                output = [];
                let first = 'ok',
                    again = 'ok';
                const run = shell.Shutdown(clean !== 0);
                if (trigger < 0) {
                    await paused.promise;
                    try {
                        await shell.Shutdown(!clean);
                    } catch (error) {
                        again = nativeResult(error, original);
                    }
                    GameShell.canvas = canvas[1];
                    GameShell.signlink = links[1];
                    resume.resolve();
                }
                try {
                    await run;
                } catch (error) {
                    first = nativeResult(error, original);
                }
                if (trigger >= 0) {
                    try {
                        await shell.Shutdown(!clean);
                    } catch (error) {
                        again = nativeResult(error, original);
                    }
                }
                const state = [GameShell.m_shutdown, canvasId(GameShell.canvas), GameShell.signlink === null ? '-' : GameShell.signlink === links[0] ? 0 : 1, links[0]['stop'], links[1]['stop']];
                expect([first, again, trace, state.join(','), output.join('\n')].join('|'), rows[index].join(' ')).toBe(lines[index]);
            }
        } finally {
            log.mockRestore();
        }
    },
    20000
);

loginFixture(import.meta.url, 'DOM canvas removal aborts focus listeners and rereads the parent and child on the live shell', async () => {
    const trace: string[] = [];
    for (const mode of ['swap', 'null-after-abort', 'null-parent', 'null-child', 'wrong-child', 'throw-remove']) {
        const client = new Client();
        const root = {
            removeChild(child: unknown) {
                trace.push('remove:' + (child === last ? 'last' : child === null ? 'null' : 'wrong'));
                if (child === null) throw new TypeError('removeChild requires a Node');
                if (child !== last) throw new DOMException('The node is not a child of this parent', 'NotFoundError');
                if (mode === 'throw-remove') throw Error('remove');
                return child;
            }
        };
        const first = {
            get parentNode() {
                throw Error('read parent before abort');
            }
        };
        const second = {
            get parentNode() {
                trace.push('parent');
                GameShell.canvas = mode === 'null-child' ? null : mode === 'wrong-child' ? first : last;
                return mode === 'null-parent' ? null : root;
            }
        };
        const last = {};
        client['events'].signal.addEventListener('abort', () => {
            trace.push('abort');
            GameShell.canvas = mode === 'null-after-abort' ? null : second;
        });
        GameShell.canvas = first;
        trace.length = 0;
        let outcome = 'ok';
        try {
            client['removeCanvas']();
        } catch (e) {
            outcome = e instanceof TypeError ? 'null' : e instanceof DOMException ? e.name : 'remove';
        }
        expect(trace, mode).toEqual(mode === 'null-after-abort' ? ['abort'] : mode === 'null-parent' ? ['abort', 'parent'] : ['abort', 'parent', mode === 'null-child' ? 'remove:null' : mode === 'wrong-child' ? 'remove:wrong' : 'remove:last']);
        expect(outcome, mode).toBe(mode === 'throw-remove' ? 'remove' : mode === 'wrong-child' ? 'NotFoundError' : mode === 'null-after-abort' || mode === 'null-parent' || mode === 'null-child' ? 'null' : 'ok');
        expect(client['events'].signal.aborted).toBe(true);
    }
});
