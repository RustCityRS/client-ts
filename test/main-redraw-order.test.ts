import { expect } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import GameShell from '#/client/GameShell.js';
import { toJsString } from '#/datastruct/JagString.js';
import SafeTime from '#/io/SafeTime.js';
import AudioEngine from '#/sound/AudioEngine.js';
import MidiManager from '#/sound/MidiManager.js';
import PCMPlayer from '#/sound/PCMPlayer.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { JavaError } from '#/util/JavaException.js';
import Signlink from '#/util/Signlink.js';
import WrappedException from '#/util/WrappedException.js';
import { loginFixture } from './login-fixture.js';
import { gamepackPath } from './reference.js';

type Row = [mode: number, fail: number, clock: bigint, total: number, missing: number];
class Stop extends JavaError {}

// Keep the original value for each captured read. A concurrent replacement applies to the next read.
function observe(client: Client, [mode, fail, clock, total, missing]: Row): string {
    const trace: string[] = [],
        counts = new Map<string, number>(),
        undo: (() => void)[] = [];
    let active = true;
    function watch<T extends object, K extends keyof T>(owner: T, key: K, id: string): void {
        const descriptor = requireNonNull(Object.getOwnPropertyDescriptor(owner, key));
        let storage = owner[key];
        Object.defineProperty(owner, key, {
            configurable: true,
            set(next: T[K]) {
                storage = next;
            },
            get() {
                const old = storage;
                if (active) read(id);
                return old;
            }
        });
        undo.push(() => Object.defineProperty(owner, key, { ...descriptor, value: storage }));
    }
    function read(key: string): void {
        trace.push(key);
        const n = (counts.get(key) ?? 0) + 1;
        counts.set(key, n);
        if (fail > 0 && --fail === 0) throw Error('probe');
        if (key === 'm.S' && n === 1 && mode <= 2) AudioEngine.musicPlayer = mode === 1 ? null : playerB;
        if (key === 'aj.kb') {
            if (n === 1 && mode >= 3 && mode <= 5) GameShell.fullScreenFrame = full;
            if (n === 2 && mode === 4) GameShell.fullScreenFrame = desktop;
            if (n === 2 && mode === 5) GameShell.fullScreenFrame = null;
        }
        if (key === 'tb.h' && n === 1 && (mode === 6 || mode === 7)) GameShell.frame = mode === 6 ? full : null;
        if (key === 'tb.h' && n === 3 && mode === 8) GameShell.frame = null;
        if (key === 'oa.a' && n === 1 && mode === 9) Client.windowModeRefreshTime = 120n;
        if (key === 'th.d' && n === 1 && mode === 12) Client.mapFilesMissing = 23;
        if (key === 'ah.d' && n === 1 && mode === 13) {
            Client.mapFilesMissing = -32;
            Client.mapLoadingTotal = 47;
        }
        if (key === 'th.d' && n === 2 && mode === 14) Client.mapLoadingTotal = 0;
        if (key === 'hi.g' && mode < 11) throw new Stop();
    }
    const frame = (id: number) => ({
        getSize() {
            trace.push('size' + id);
            return { width: 300 + id, height: 100 + id };
        },
        getInsets() {
            trace.push('insets' + id);
            return { top: 1, left: 2, bottom: 3, right: 4 };
        }
    });
    const playerA = new PCMPlayer(),
        playerB = new PCMPlayer(),
        desktop = frame(1),
        full = frame(2);
    playerA.QueueDiscardBuffer = () => {
        trace.push('A');
    };
    playerB.QueueDiscardBuffer = () => {
        trace.push('B');
    };
    MidiManager.load = () => mode <= 2;
    Client.gameState = mode === 9 || mode === 10 ? 30 : 25;
    Client.sceneState = 1;
    Client.jingleActive = true;
    AudioEngine.musicPlayer = mode === 2 ? null : playerA;
    GameShell.fullScreenFrame = null;
    GameShell.frame = desktop;
    GameShell.fullRedraw = false;
    GameShell.canvasInvalid = false;
    Signlink.osNameLower = 'mac';
    Client.windowModeRefreshTime = 17n;
    GameShell.m_frameWidth = GameShell.m_frameHeight = 0;
    Client.mapLoadingTotal = total;
    Client.mapFilesMissing = missing;
    SafeTime.CurrentTimeMillis = () => {
        trace.push('clock');
        return clock;
    };
    Client.setWindowMode = () => {
        trace.push('window');
    };
    Client.MessageBox = text => {
        trace.push(toJsString(requireNonNull(text)));
        throw new Stop();
    };
    watch(AudioEngine, 'musicPlayer', 'm.S');
    watch(GameShell, 'fullScreenFrame', 'aj.kb');
    watch(GameShell, 'frame', 'tb.h');
    watch(Client, 'windowModeRefreshTime', 'oa.a');
    watch(GameShell, 'fullRedraw', 'hi.g');
    watch(Client, 'mapLoadingTotal', 'th.d');
    watch(Client, 'mapFilesMissing', 'ah.d');
    let status = 'ok';
    try {
        client['MainRedraw']();
    } catch (error) {
        if (error instanceof Stop) status = 'stop';
        else if (error instanceof WrappedException) {
            const cause = error.cause;
            status = error.context + '/' + (cause instanceof TypeError ? 'null' : cause instanceof RangeError && cause.message === '/ by zero' ? 'zero' : cause instanceof Error ? cause.message : String(cause));
        } else throw error;
    } finally {
        active = false;
        for (const reset of undo) reset();
    }
    return [status, trace.join(';'), Client.windowModeRefreshTime, GameShell.m_frameWidth, GameShell.m_frameHeight, Client.mapLoadingTotal, Client.mapFilesMissing].join('|');
}

loginFixture(
    import.meta.url,
    'MainRedraw preserves Java player and frame rereads, signed resize deadlines and loading expressions',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-redraw-order-'));
        try {
            const observed = join(dir, 'observed');
            mkdirSync(observed);
            const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED',
                game = join(import.meta.dir, 'game');
            const cp = dir + delimiter + gamepackPath;
            const compile = Bun.spawnSync(['javac', asm, '-cp', gamepackPath, '-d', dir, join(game, 'WindowModeOracle.java'), join(game, 'MainRedrawOrderOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const prepare = Bun.spawnSync(['java', asm, '-cp', cp, 'MainRedrawOrderOracle', gamepackPath, observed]);
            expect(prepare.exitCode, prepare.stderr.toString()).toBe(0);
            const rows: Row[] = [];
            for (let mode = 0; mode <= 14; mode++) for (const fail of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]) rows.push([mode, fail, 100n, 8, 14]);
            for (const time of [-9223372036854775808n, -501n, -500n, -499n, 9223372036854775307n, 9223372036854775308n, 9223372036854775807n]) {
                rows.push([0, 0, time, 8, 14]);
            }
            for (const total of [-2147483648, -7, 0, 1, 13, 2147483647]) {
                for (const missing of [-2147483648, -1, 0, 3, 2147483647]) {
                    for (const mode of [11, 12, 13, 14]) rows.push([mode, 0, 100n, total, missing]);
                }
            }
            const run = Bun.spawnSync(['java', asm, '--add-opens=java.desktop/java.awt=ALL-UNNAMED', '-Djava.awt.headless=true', '-cp', observed + delimiter + cp, 'MainRedrawOrderOracle'], {
                stdin: Buffer.from(rows.map(row => row.join(' ')).join('\n') + '\n')
            });
            expect(run.exitCode, run.stderr.toString()).toBe(0);
            const expected = run.stdout.toString().trimEnd().split(/\r?\n/);
            expect(expected).toHaveLength(rows.length);
            const client = new Client();
            for (const [i, row] of rows.entries()) expect(observe(client, row), row.join(' ')).toBe(expected[i]);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    30000
);
