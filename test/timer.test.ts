import { expect, spyOn, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { tmpdir } from 'node:os';
import Timer from '#/client/Timer.js';
import NanoTimer from '#/client/NanoTimer.js';
import MillisTimer from '#/client/MillisTimer.js';
import GameShell from '#/client/GameShell.js';
import { CanvasComponent } from '#/graphics/PixScreen.js';
import Pix2D from '#/graphics/Pix2D.js';
import SafeTime from '#/io/SafeTime.js';
import ThreadUtils from '#/util/ThreadUtils.js';
import { gamepackPath } from './reference.js';
import Signlink from '#/util/Signlink.js';

test('530 frame clocks match every gamepack tick, sleep and history slot through stalls, reset and wall-clock rollback', async () => {
    const commands: (string | number)[][] = [];
    for (const kind of ['nano', 'millis']) {
        commands.push([kind, 1000000000, 1000]);
        for (let i = 0; i < 181; i++) {
            if (i % 23 === 0) commands.push(['reset', 125000, 1]);
            const gap = [0, 1, 2, 20, 5, 30, 80, 231, 6000, -500][i % 10];
            commands.push(['step', gap * 1000000 + 125000, gap, i % 4 === 0 ? 5 : 1, [20, 18, 14, 25, 50][i % 5]]);
        }
    }
    for (const n of [-3, 0, 1, 9, 10, 11, 20, 21, 32768, 100000000, 2147483647]) commands.push(['sleep', 0, 0, n]);
    const dir = mkdtempSync(join(tmpdir(), 'rs530-timer-'));
    const state = { ...SafeTime };
    let nanos = 0n,
        millis = 0n;
    const sleeps: bigint[] = [];
    const nano = spyOn(performance, 'now').mockImplementation(() => Number(nanos) / 1000000);
    const wall = spyOn(Date, 'now').mockImplementation(() => Number(millis));
    const sleep = ThreadUtils['sleepInternal'];
    try {
        const java = join(import.meta.dir, 'game', 'TimerOracle.java'),
            cp = dir + delimiter + gamepackPath;
        for (const cmd of [
            ['javac', '-cp', gamepackPath, '-d', dir, java],
            ['java', '-cp', cp, 'TimerOracle', gamepackPath, dir]
        ]) {
            const process = Bun.spawnSync(cmd);
            expect(process.stderr.toString()).toBe('');
            expect(process.exitCode).toBe(0);
        }
        const oracle = Bun.spawnSync(['java', '-cp', cp, 'TimerOracle'], { stdin: Buffer.from(commands.map(row => row.join(' ')).join('\n') + '\n') });
        expect(oracle.stderr.toString()).toBe('');
        expect(oracle.exitCode).toBe(0);
        const results = oracle.stdout.toString().trim().split(/\r?\n/);
        expect(results).toHaveLength(commands.length);
        ThreadUtils['sleepInternal'] = async delay => {
            sleeps.push(delay);
            nanos += delay * 1000000n;
            millis += delay;
        };
        SafeTime['m_lastTime'] = SafeTime['m_offset'] = 0n;
        let clock: Timer = new NanoTimer();
        for (const [i, [op, ns, ms, min, cycle]] of commands.entries()) {
            sleeps.length = 0;
            nanos += BigInt(ns);
            millis += BigInt(ms);
            let ticks = -1;
            switch (op) {
                case 'nano':
                    clock = await Timer.create();
                    break;
                case 'millis':
                    clock = new MillisTimer();
                    break;
                case 'reset':
                    clock.reset();
                    break;
                case 'step':
                    ticks = await clock.wait(Number(min), Number(cycle));
                    break;
                case 'sleep':
                    await ThreadUtils.sleep(BigInt(min));
                    break;
            }
            const fields = clock instanceof NanoTimer ? [clock['nextTick']] : clock instanceof MillisTimer ? [clock['now'], clock['step'], '[' + clock['times'].join(', ') + ']', clock['fraction'], clock['index'], clock['sleepTime']] : [];
            expect([ticks, '[' + sleeps.join(', ') + ']', nanos, millis, ...fields].join(';'), commands[i].join(' ')).toBe(results[i]);
        }
        nano.mockImplementation(() => {
            throw new Error('No high-resolution clock');
        });
        expect(await Timer.create()).toBeInstanceOf(MillisTimer);
    } finally {
        nano.mockRestore();
        wall.mockRestore();
        Object.assign(SafeTime, state);
        ThreadUtils['sleepInternal'] = sleep;
        rmSync(dir, { recursive: true, force: true });
    }
});

test('the shell runs outstanding logic cycles before drawing and an ed.d reset ends catch-up in the current frame', async () => {
    const saved = { ...GameShell },
        raster = { ...Pix2D },
        frames = GameShell.m_drawTime.slice(),
        updates = GameShell.m_updateTime.slice();
    const events: string[] = [];
    let frame = 0,
        cycle = 0;
    class Clock extends Timer {
        reset() {
            events.push('reset');
        }
        async wait() {
            events.push('wait');
            return [3, 6, 1][frame++];
        }
    }
    const timer = spyOn(Timer, 'create').mockResolvedValue(new Clock());
    const signlink = new Signlink();
    class Shell extends GameShell {
        async init() {}
        protected mountCanvas() {
            events.push('canvas');
            const component = new CanvasComponent({
                createImageData() {
                    throw Error('unused');
                },
                putImageData() {}
            });
            GameShell.canvas = component;
            return component;
        }
        protected removeCanvas() {
            events.push('remove');
        }
        protected async MainInit() {
            events.push('init:' + GameShell.drawArea?.pixels?.length);
        }
        protected async MainQuit() {
            events.push('quit');
        }
        protected releaseStatics() {}
        protected async MainLoop() {
            events.push('tick');
            if (++cycle === 4) GameShell.DoneSlowUpdate();
        }
        protected refreshCanvas() {
            events.push('refresh');
        }
        protected MainRedraw() {
            events.push('draw');
            if (frame === 3) GameShell.m_killTime = 1n;
        }
    }
    try {
        GameShell.m_fullRedrawForce = 50;
        GameShell.signlink = signlink;
        GameShell.m_killTime = 0n;
        GameShell.m_shutdown = false;
        GameShell.m_sWid = 10;
        GameShell.m_sHei = 3;
        await new Shell().run();
        expect(events).toEqual(['canvas', 'init:31', 'wait', 'tick', 'tick', 'tick', 'draw', 'wait', 'tick', 'reset', 'refresh', 'draw', 'wait', 'tick', 'draw', 'quit', 'remove']);
        expect(GameShell.m_updateTime.filter(t => t !== 0n)).toHaveLength(1);
        expect(GameShell.m_drawTime.filter(t => t !== 0n)).toHaveLength(2);
    } finally {
        timer.mockRestore();
        await signlink.stopWorker();
        Object.assign(GameShell, saved);
        Object.assign(Pix2D, raster);
        GameShell.m_drawTime.set(frames);
        GameShell.m_updateTime.set(updates);
    }
});
