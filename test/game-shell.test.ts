import { expect, spyOn, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import GameShell from '#/client/GameShell.js';
import { CanvasComponent } from '#/graphics/PixScreen.js';
import Pix2D from '#/graphics/Pix2D.js';
import SafeTime from '#/io/SafeTime.js';
import Signlink from '#/util/Signlink.js';
import ThreadUtils from '#/util/ThreadUtils.js';
import WrappedException from '#/util/WrappedException.js';
import { clientErrorHost } from '#/util/ClientError.js';
import { gamepackPath } from './reference.js';

test('the applet matches p.run, start, stop, destroy, paint and update against the original AWT shell', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rs530-shell-'));
    const saved = { ...GameShell },
        linkFields = { ...Signlink },
        raster = { ...Pix2D };
    const clock = { ...SafeTime },
        base = clientErrorHost.base;
    let millis = 100000n,
        output = '',
        hooks = '';
    const sleeps: bigint[] = [];
    const now = spyOn(Date, 'now').mockImplementation(() => Number(millis));
    const log = spyOn(console, 'log').mockImplementation(msg => {
        output += String(msg);
    });
    const sleep = ThreadUtils['sleepInternal'];
    const component = new CanvasComponent({
        createImageData() {
            throw Error('No pixels presented in this fixture');
        },
        putImageData() {}
    });
    class Shell extends GameShell {
        async init() {}
        protected mountCanvas() {
            GameShell.canvas = component;
            return component;
        }
        protected removeCanvas() {}
        protected refreshCanvas() {}
        protected async MainInit() {
            hooks += 'init=' + GameShell.drawArea?.pixels?.length + ',';
        }
        protected async MainQuit() {
            hooks += 'quit,';
        }
        protected releaseStatics() {}
        protected async MainLoop() {
            hooks += 'tick,';
        }
        protected MainRedraw() {
            hooks += 'draw,';
        }
    }
    const worker = new Signlink();
    try {
        const cp = dir + delimiter + gamepackPath;
        const files = ['GameShellOracle', 'WindowModeOracle', 'TimerOracle'].map(name => join(import.meta.dir, 'game', name + '.java'));
        const compile = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, ...files]);
        expect(compile.exitCode, compile.stderr.toString()).toBe(0);
        const prepare = Bun.spawnSync(['java', '-cp', cp, 'TimerOracle', gamepackPath, dir]);
        expect(prepare.exitCode, prepare.stderr.toString()).toBe(0);
        const commands: string[][] = [];
        for (const vendor of ['~', 'Other', 'Sun', 'APPLE-IBM', 'IBM']) {
            for (const version of ['~', '1.1', '1.1.0', '1.2', '1.2.1', '1.4.2', '1.5', '1.12-ea', '1.4294967300', '1.4294967301x', '1.-6', '21']) {
                commands.push(['run', vendor, version]);
            }
        }
        for (let flags = 0; flags < 8; flags++) {
            for (const op of ['start', 'stop', 'destroy', 'closing', 'provide']) commands.push([op, String(flags), '0', '0', '0']);
            for (const op of ['paint', 'update'])
                for (const delta of [999, 1000, 1001]) {
                    for (const [x, y] of [
                        [-2, 0],
                        [-1, 0],
                        [7, 4],
                        [6, 5],
                        [7, 5],
                        [8, 6]
                    ]) {
                        commands.push([op, String(flags), String(delta), String(x), String(y)]);
                    }
                }
        }
        const result = Bun.spawnSync(['java', '--add-opens=java.desktop/java.awt=ALL-UNNAMED', '-Djava.awt.headless=true', '-cp', cp, 'GameShellOracle'], {
            stdin: Buffer.from(commands.map(command => command.join(' ')).join('\n') + '\n'),
            timeout: 30000
        });
        expect(result.exitCode, result.stderr.toString()).toBe(0);
        const lines = result.stdout.toString().trimEnd().split(/\r?\n/);
        expect(lines).toHaveLength(commands.length);
        SafeTime['m_lastTime'] = SafeTime['m_offset'] = 0n;
        clientErrorHost.base = null;
        ThreadUtils['sleepInternal'] = async delay => {
            sleeps.push(delay);
            millis += delay;
        };
        for (const [i, [op, a, b, c, d]] of commands.entries()) {
            const shell = new Shell();
            GameShell.providesignlink(worker);
            Object.assign(worker, { applet: shell });
            GameShell.m_activeShell = shell;
            GameShell.m_shutdown = GameShell.java5OrLater = GameShell.fullRedraw = GameShell.canvasInvalid = false;
            GameShell.canvas = GameShell.drawArea = GameShell.timer = null;
            GameShell.m_minDel = 1;
            GameShell.m_killTime = 7n;
            GameShell.m_frameWidth = GameShell.m_sWid = 7;
            GameShell.m_frameHeight = GameShell.m_sHei = 5;
            millis += 10000n;
            sleeps.length = 0;
            output = hooks = '';
            let error = '-';
            try {
                if (op === 'run') {
                    Signlink.javaVendor = a === '~' ? null : a;
                    Signlink.javaVersion = b === '~' ? null : b;
                    await shell.run();
                } else {
                    const flags = Number(a),
                        width = Number(c),
                        height = Number(d);
                    if (flags & 1) GameShell.m_activeShell = null;
                    GameShell.m_shutdown = (flags & 2) !== 0;
                    GameShell.java5OrLater = (flags & 4) !== 0;
                    GameShell.canvasSetTime = millis - BigInt(b);
                    const graphics = width === -2 ? null : { getClip: () => (width === -1 ? null : { x: 100, y: -3, width, height }) };
                    switch (op) {
                        case 'paint':
                            shell.paint(graphics);
                            break;
                        case 'update':
                            shell.update(graphics);
                            break;
                        case 'start':
                            shell.start();
                            break;
                        case 'stop':
                            shell.stop();
                            break;
                        case 'destroy':
                            await shell.destroy();
                            break;
                        case 'closing':
                            await shell.windowClosing();
                            break;
                        case 'provide':
                            GameShell.providesignlink(flags & 1 ? null : worker);
                            break;
                    }
                }
            } catch (ex) {
                error = (op === 'paint' || op === 'update') && ex instanceof WrappedException ? String(ex.context) : 'exception';
            }
            const reason = output.includes('error_game_wrongjava') ? 'wrongjava' : output.includes('error_game_crash') ? 'crash' : '-';
            const kill = GameShell.m_killTime === 0n || GameShell.m_killTime === 7n ? GameShell.m_killTime : GameShell.m_killTime - millis;
            const row = [
                error,
                reason,
                GameShell.m_minDel,
                GameShell.java5OrLater,
                GameShell.fullRedraw,
                GameShell.canvasInvalid,
                GameShell.m_shutdown,
                kill,
                GameShell.errorSignlink === null,
                GameShell.signlink === null,
                GameShell.timer !== null,
                hooks,
                '[' + sleeps.join(', ') + ']'
            ];
            expect(row.join('|'), commands[i].join(' ')).toBe(lines[i]);
        }
    } finally {
        await worker.stopWorker();
        Object.assign(GameShell, saved);
        Object.assign(Signlink, linkFields);
        Object.assign(Pix2D, raster);
        Object.assign(SafeTime, clock);
        clientErrorHost.base = base;
        ThreadUtils['sleepInternal'] = sleep;
        log.mockRestore();
        now.mockRestore();
        rmSync(dir, { recursive: true, force: true });
    }
});
