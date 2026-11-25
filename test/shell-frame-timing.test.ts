import { expect, spyOn } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import GameShell from '#/client/GameShell.js';
import Timer from '#/client/Timer.js';
import SafeTime from '#/io/SafeTime.js';
import { JavaCheckedException, JavaError } from '#/util/JavaException.js';
import WrappedException from '#/util/WrappedException.js';
import { loginFixture } from './login-fixture.js';
import { gamepackPath } from './reference.js';

type Row = [op: number, draws: number, updates: number, pos: number, force: number, wall: bigint, offset: bigint, prev: bigint, flags: number, trigger: number, action: number];
const minimum = -2147483648,
    maximum = 2147483647;
const longMax = 0x7fffffffffffffffn,
    longMin = -longMax - 1n;

function cases(): Row[] {
    const rows: Row[] = [];
    for (const force of [minimum, minimum + 1, -50, -1, 0, 1, 49, 50, 51, 52, 98, 99, 100, 101, 500, maximum - 1, maximum]) {
        for (const flags of [0, 1, 2, 3, 4, 5, 32, 64, 65, 128, 129, 131]) rows.push([1, 32, 32, 31, force, 1004n, 0n, 1000n, flags, 0, 0]);
    }
    for (const prev of [longMin, longMin + 1n, -0x200000000n, -1n, 0n, 1n, 37n, 0x200000000n, longMax - 1n, longMax]) {
        for (const delta of [-1n, 0n, 1n, 2n, 7n, 20n, 31n, 50n, 4001n, 64000n, 2147483647n, 2147483648n, 0xffffffffn, 0x100000000n, 0x100000001n, 0x200000000n]) {
            rows.push([1, 1, 3, 0, 51, 0n, BigInt.asIntN(64, prev + delta), prev, 1, 0, 0]);
        }
    }
    for (const op of [0, 1])
        for (const len of [-1, 0, 1, 2, 17, 31, 32, 33, 35]) {
            for (const pos of new Set([minimum, -1, 0, 1, 16, 30, 31, 32, len - 1, len, maximum])) {
                for (const flags of [0, 32]) rows.push([op, len, len, pos, 49, 4001n, 0n, 305n, flags, 0, 0]);
            }
        }
    for (const draws of [-1, 0, 1, 15, 30, 31, 32, 33, 39])
        for (const updates of [-1, 0, 1, 17, 30, 31, 32, 33, 39]) {
            for (const flags of [0, 8, 16, 40]) rows.push([2, draws, updates, 31, maximum, 100n, 0n, -3814n, flags, 0, 0]);
        }
    for (const [op, trigger] of [
        [0, 1],
        [1, 2],
        [1, 3],
        [1, 4],
        [1, 5],
        [1, 6],
        [2, 7]
    ]) {
        for (const flags of [0, 1, 3, 32, 65])
            for (let action = 1; action <= 15; action++) {
                rows.push([op, 34, 33, 30, 51, 8471n, 0n, 8429n, flags, trigger, action]);
            }
        // The browser canvas path has equivalent size/visibility/location effects.
        for (const flags of [128, 129, 131])
            for (const action of [5, 6, 7, 8, 9, 10, 11, 13, 14, 15]) {
                rows.push([op, 34, 33, 31, 51, 8471n, 0n, 8429n, flags, trigger, action]);
            }
    }
    return rows;
}

function errorText(error: unknown, original: WrappedException): string {
    if (error instanceof WrappedException) {
        return (error === original ? 'same:' : 'wrapped:') + error.context + '/' + errorText(error.cause, original);
    }
    if (error instanceof RangeError) return error.message.includes('zero') ? 'arithmetic' : 'bounds';
    if (error instanceof TypeError) return 'null';
    if (error instanceof JavaError) return 'error';
    return error instanceof JavaCheckedException ? 'checked' : 'runtime';
}

function ring(length: number, seed: number, pos: number, prev: bigint): BigInt64Array | null {
    if (length < 0) return null;
    const values = BigInt64Array.from({ length }, (_, i) => BigInt((i + 1) * seed));
    if (pos >= 0 && pos < length) values[pos] = prev;
    return values;
}

function hash(values: BigInt64Array | null): number {
    if (values === null) return 0;
    let h = 1;
    for (const v of values) h = (Math.imul(31, h) + Number(BigInt.asIntN(32, v ^ (v >> 32n)))) | 0;
    return h;
}

function ringText(values: BigInt64Array | null) {
    return values === null ? 'null' : '[' + values.join(',') + ']';
}

async function observe([op, drawLength, updateLength, pos, force, wall, offset, prev, flags, trigger, action]: Row): Promise<string> {
    SafeTime['m_lastTime'] = wall;
    SafeTime['m_offset'] = offset;
    const draws = ring(drawLength, 31, pos, prev),
        updates = (flags & 16) !== 0 ? draws : ring(updateLength, -717, pos, prev);
    Object.assign(GameShell, {
        m_drawTime: draws,
        m_updateTime: updates,
        m_drawPos: pos,
        m_updatePos: pos,
        m_fps: -31,
        m_fullRedrawForce: force,
        fullRedraw: (flags & 64) !== 0,
        m_focusIn: (flags & 32) !== 0,
        m_focus: (flags & 32) === 0,
        m_updateCount: 7,
        m_sWid: 704,
        m_sHei: 537,
        leftMargin: -11,
        topMargin: 17
    });
    function fields() {
        return [
            GameShell.m_drawPos,
            GameShell.m_updatePos,
            GameShell.m_fps,
            GameShell.m_fullRedrawForce,
            GameShell.fullRedraw,
            GameShell.m_focus,
            GameShell.m_focusIn,
            GameShell.m_updateCount,
            hash(GameShell.m_drawTime),
            hash(GameShell.m_updateTime)
        ].join(',');
    }
    const original = WrappedException.wrap(new Error('inner'), 'nested'),
        trace: string[] = [];
    let fired = false,
        insets: { top: number; left: number; bottom: number; right: number } | null = { top: 15, left: 21, bottom: 87, right: 311 };
    function event(stage: number, text: string) {
        trace.push(text + '@' + fields());
        if (trigger !== stage || fired) return;
        fired = true;
        switch (action) {
            case 1:
                throw new Error('callback');
            case 2:
                throw original;
            case 3:
                throw new JavaError('callback');
            case 4:
                throw new JavaCheckedException('callback');
            case 5:
                GameShell.canvas = canvases[1];
                break;
            case 6:
                GameShell.canvas = null;
                break;
            case 7:
                GameShell.frame = null;
                break;
            case 8:
                GameShell.fullScreenFrame = hosts[1];
                break;
            case 9:
                GameShell.frame = hosts[1];
                GameShell.fullScreenFrame = null;
                break;
            case 10:
                GameShell.m_sWid = 901;
                GameShell.m_sHei = 717;
                GameShell.leftMargin = maximum - 1;
                GameShell.topMargin = minimum + 1;
                insets = { top: -31, left: 98, bottom: 0, right: 0 };
                break;
            case 11:
                insets = null;
                break;
            case 12:
                Object.assign(GameShell, { m_updateTime: new BigInt64Array(2) });
                GameShell.DoneSlowUpdate();
                break;
            case 13:
                Object.assign(GameShell, { m_drawTime: BigInt64Array.of(-991n, 551n), m_updateTime: BigInt64Array.of(94n, -32n, 17n), m_drawPos: -8, m_updatePos: 48, m_updateCount: -97 });
                break;
            case 14:
                GameShell.m_focus = false;
                GameShell.m_focusIn = true;
                GameShell.m_fullRedrawForce = minimum;
                GameShell.fullRedraw = false;
                break;
            case 15:
                GameShell.canvas = canvases[1];
                GameShell.frame = null;
                GameShell.leftMargin = -811;
                GameShell.topMargin = 713;
                break;
        }
    }
    // getInsets may return null at the host boundary. The real renderer must read the
    // returned value before it decides whether the current canvas can be positioned.
    const hosts = [0, 1].map(i => ({
        getSize: () => ({ width: 0, height: 0 }),
        getInsets() {
            event(5, 'insets' + i);
            return insets as { top: number; left: number; bottom: number; right: number };
        }
    }));
    const geometry = [0, 1].map(() => ({ w: 0, h: 0, visible: false, x: 0, y: 0 }));
    const canvases = [0, 1].map(i => {
        const g = geometry[i];
        function size(w: number, h: number) {
            event(3, 'size' + i + ':' + w + ',' + h);
            g.w = w;
            g.h = h;
        }
        function visible(v: boolean) {
            event(4, 'visible' + i + ':' + v);
            g.visible = v;
        }
        function position(x: number, y: number) {
            event(6, 'loc' + i + ':' + x + ',' + y);
            g.x = x;
            g.y = y;
        }
        if ((flags & 128) === 0) return { setSize: size, setVisible: visible, setLocation: position };
        let w = g.w,
            x = g.x;
        return {
            get width() {
                return g.w;
            },
            set width(v: number) {
                w = v;
            },
            get height() {
                return g.h;
            },
            set height(v: number) {
                size(w, v);
            },
            get hidden() {
                return !g.visible;
            },
            set hidden(v: boolean) {
                visible(!v);
            },
            style: {
                set marginLeft(v: string) {
                    x = parseInt(v, 10);
                },
                set marginTop(v: string) {
                    position(x, parseInt(v, 10));
                }
            }
        };
    });
    class Shell extends Client {
        protected override async MainLoop() {
            event(1, 'update');
        }
        protected override MainRedraw() {
            event(2, 'draw');
        }
    }
    class Clock extends Timer {
        reset() {
            event(7, 'reset');
        }
        async wait(): Promise<number> {
            throw Error('unexpected');
        }
    }
    GameShell.canvas = (flags & 4) === 0 ? canvases[0] : null;
    GameShell.frame = (flags & 1) !== 0 ? hosts[0] : null;
    GameShell.fullScreenFrame = (flags & 2) !== 0 ? hosts[1] : null;
    GameShell.timer = (flags & 8) === 0 ? new Clock() : null;
    const shell = new Shell();
    let outcome = 'ok';
    try {
        if (op === 0) await shell['MainLoopWrapper']();
        else if (op === 1) shell['MainRedrawWrapper']();
        else GameShell.DoneSlowUpdate();
    } catch (e) {
        outcome = errorText(e, original);
    }
    return [
        outcome,
        trace.join(';'),
        fields(),
        ...geometry.map(g => [g.w, g.h, g.visible, g.x, g.y].join(',')),
        ringText(draws),
        ringText(updates),
        ringText(GameShell.m_drawTime),
        ringText(GameShell.m_updateTime),
        GameShell.canvas === null ? '-' : GameShell.canvas === canvases[0] ? '0' : '1'
    ].join('|');
}

loginFixture(
    import.meta.url,
    'shell frame timing matches original JAR rings, canvas callbacks and retained failures',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-shell-frame-')),
            cp = dir + delimiter + gamepackPath;
        const rows = cases();
        let wall = 0n;
        const clock = spyOn(Date, 'now').mockImplementation(() => Number(wall));
        try {
            const java = ['WindowModeOracle', 'TimerOracle', 'ShellFrameTimingOracle'].map(n => join(import.meta.dir, 'game', n + '.java'));
            for (const cmd of [
                ['javac', '-cp', gamepackPath, '-d', dir, ...java],
                ['java', '-cp', cp, 'TimerOracle', gamepackPath, dir]
            ]) {
                const result = Bun.spawnSync(cmd);
                expect(result.exitCode, result.stderr.toString()).toBe(0);
            }
            const result = Bun.spawnSync(['java', '--add-opens=java.desktop/java.awt=ALL-UNNAMED', '-Djava.awt.headless=true', '-cp', cp, 'ShellFrameTimingOracle'], {
                stdin: Buffer.from(rows.map(r => r.join(' ')).join('\n') + '\n'),
                maxBuffer: 32 * 1024 * 1024
            });
            expect(result.exitCode, result.stderr.toString()).toBe(0);
            const lines = result.stdout.toString().trimEnd().split(/\r?\n/);
            expect(lines).toHaveLength(rows.length);
            for (let i = 0; i < rows.length; i++) {
                wall = rows[i][5];
                expect(await observe(rows[i]), rows[i].join(' ')).toBe(lines[i]);
            }
        } finally {
            clock.mockRestore();
            rmSync(dir, { recursive: true, force: true });
        }
    },
    60000
);
