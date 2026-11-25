import { expect, test } from 'bun:test';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import GameShell from '#/client/GameShell.js';
import { glJar } from '#/client/ClientVariant.js';
import { CanvasComponent } from '#/graphics/PixScreen.js';
import Signlink from '#/util/Signlink.js';
import Timer from '#/client/Timer.js';
import WrappedException from '#/util/WrappedException.js';
import { JavaError } from '#/util/JavaException.js';
import { gamepackPath } from '../reference.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

async function run(): Promise<void> {
    const cp = glJar ? [hdGamepackPath, joglPath].join(delimiter) : gamepackPath;
    const original = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', cp, join(import.meta.dir, 'RedrawAwaitOracle.java'), glJar ? 'gl' : 'sd']);
    expect(original.exitCode, original.stderr.toString()).toBe(0);
    const context = original.stdout.toString().trim();
    expect(context).toBe(glJar ? 'rc.AA(0)' : 'p.O(-10911)');
    const entered = Promise.withResolvers<void>(),
        release = Promise.withResolvers<void>();
    const events: string[] = [];
    const failure = new TypeError('draw failed');
    let draw: () => void | Promise<void> = () => {};
    class Shell extends GameShell {
        async init() {}
        protected async MainInit() {}
        protected async MainLoop() {}
        protected MainRedraw() {
            return draw();
        }
        protected async MainQuit() {
            events.push('quit');
        }
        protected refreshCanvas() {
            throw failure;
        }
        protected removeCanvas() {}
        protected releaseStatics() {}
        protected mountCanvas() {
            const component = new CanvasComponent();
            GameShell.canvas = component;
            return component;
        }
    }
    const shell = new Shell();
    const wrapper = Reflect.get(GameShell.prototype, 'MainRedrawWrapper');
    for (const kind of ['refresh', 'sync', 'async', 'fatal'] as const) {
        const fatal = new JavaError('host terminated');
        GameShell.m_fullRedrawForce = kind === 'refresh' ? 51 : 0;
        draw = () => {
            if (kind === 'sync') throw failure;
            return Promise.reject(kind === 'fatal' ? fatal : failure);
        };
        try {
            const result = wrapper.call(shell);
            expect(kind === 'async' || kind === 'fatal').toBe(true);
            await result;
            throw new Error('unexpected draw');
        } catch (error) {
            if (kind === 'fatal') expect(error).toBe(fatal);
            else {
                expect(error).toBeInstanceOf(WrappedException);
                if (!(error instanceof WrappedException)) throw error;
                expect(error.context).toBe(context);
                expect(error.cause).toBe(failure);
            }
        }
    }
    draw = () => {
        events.push('draw');
        entered.resolve();
        GameShell.m_killTime = 1n;
        return release.promise.then(() => {
            events.push('present');
        });
    };
    class Clock extends Timer {
        reset() {}
        async wait() {
            events.push('wait');
            return 0;
        }
    }
    Timer.create = async () => new Clock();
    Signlink.flushEvents = async () => {
        events.push('flush');
    };
    GameShell.signlink = new Signlink();
    GameShell.m_killTime = 0n;
    GameShell.m_shutdown = false;
    GameShell.m_sWid = 7;
    GameShell.m_sHei = 3;
    const loop = shell.run();
    await entered.promise;
    await Promise.resolve();
    expect(events).toEqual(['wait', 'draw']);
    release.resolve();
    await loop;
    expect(events).toEqual(['wait', 'draw', 'present', 'flush', 'quit']);
}

test('both shell loops preserve the native redraw fault and await presentation before flushing AWT events', async () => {
    if (process.env.RS530_REDRAW_AWAIT_CHILD === '1') return run();
    for (const identity of ['sd', 'gl']) {
        const child = Bun.spawnSync([process.execPath, 'test', fileURLToPath(import.meta.url)], {
            env: { ...process.env, RS530_GAMEPACK_IDENTITY: identity, RS530_REDRAW_AWAIT_CHILD: '1' },
            timeout: 20000
        });
        expect(child.exitCode, child.stderr.toString()).toBe(0);
        expect(child.stderr.toString()).toMatch(/^\s*1 pass$/m);
    }
}, 60000);
