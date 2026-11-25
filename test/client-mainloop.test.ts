import Login from '#/io/Login.js';
import AccountCreation from '#/io/AccountCreation.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Client from '#/client/Client.js';
import Js5Resources from '#/cache/Js5Resources.js';
import Js5MasterIndex from '#/cache/Js5MasterIndex.js';
import GameShell from '#/client/GameShell.js';
import ClientKeyboardListener from '#/client/ClientKeyboardListener.js';
import ClientMouseListener from '#/client/ClientMouseListener.js';
import MouseWheel from '#/client/MouseWheel.js';
import AudioEngine from '#/sound/AudioEngine.js';
import MidiManager from '#/sound/MidiManager.js';
import Minimenu from '#/ui/Minimenu.js';
import { gamepackPath } from './reference.js';

// Input, boundary that changes the main state, new state, login result, attached devices and previous cycle.
const rows: [number, string, number, number, number, number][] = [];
for (const state of [-1, 0, 5, 10, 20, 25, 28, 30, 40, 1000]) {
    for (const devices of [0, 1, 2, 3]) rows.push([state, '-', 0, -3, devices, [0, 1000, 1499, 2147483647][devices]]);
}
for (const state of [0, 5, 25, 28]) {
    for (const next of [0, 5, 10, 25, 28, 30, 40, 1000]) rows.push([state, state <= 5 ? 'load' : 'map', next, -3, 3, 17]);
}
for (const reply of [-5, -4, -3, -2, 0, 1, 2, 3, 15, 21, 29, 255]) rows.push([40, '-', 0, reply, 3, 17]);
for (const at of ['js5', 'master', 'wheel', 'slow', 'title', 'account', 'world', 'login', 'game']) {
    rows.push([at === 'slow' ? 5 : at === 'game' ? 30 : 10, at, 40, 2, 3, 17]);
}
rows.push([40, 'login', 25, 2, 3, 17], [10, 'js5', 1000, -3, 3, 17]);

async function trace(): Promise<void> {
    globalThis.Date = new Proxy(Date, {
        construct(ctor, args, target) {
            return Reflect.construct(ctor, args.length === 0 ? [2025, 5, 10, 14, 23, 41] : args, target);
        }
    });
    const app = new Client();
    const master = Object.assign(Object.create(Js5MasterIndex.prototype), { tick: () => note('master') });
    let calls: string[] = [],
        change = '',
        next = 0,
        reply = -3;
    function note(call: string): void {
        calls.push(call);
        if (call === change) Client.gameState = next;
    }
    const login = { selectLoginWorld: async () => note('world') };
    app.LoginPoll = async () => {
        note('login');
        Login.reply = reply;
    };
    const ui = {};
    app['titleLoop'] = () => note('title');
    AccountCreation.loop = async () => note('account');
    const game = { logout: () => note('logout') };
    const viewport = { menu: { clear() {} } };
    const wheel = {
        poll() {
            note('wheel');
            return 7;
        },
        start() {},
        stop() {}
    };
    Object.assign(app, {
        assets: Object.create(Js5Resources.prototype),
        js5Tick: async () => note('js5'),
        MainLoad: async () => note('load'),
        MapBuildLoop: () => note('map'),
        GameLoop: async () => note('game'),
        enterGame() {}
    });
    GameShell.DoneSlowUpdate = () => note('slow');
    MidiManager.fade = () => note('fade');
    AudioEngine.tick = () => note('pcm');
    ClientKeyboardListener.poll = () => note('keyboard');
    ClientMouseListener.poll = () => note('mouse');
    Client.ReconnectDone = () => note('resume');
    Client.Logout = () => note('logout');

    for (const [state, at, target, response, devices, cycle] of rows) {
        change = at;
        next = target;
        reply = response;
        Login.reply = -3;
        Object.assign(app, {
            ui,
            login,
            pendingLoginSession: {},
            game,
            viewport
        });
        Client.js5MasterIndex = devices & 1 ? master : null;
        MouseWheel.instance = devices & 2 ? wheel : null;
        MouseWheel.rotation = -123;
        Client.gameState = state;
        Client.loopCycle = cycle;
        Minimenu.tooltipSeed = -1;
        Minimenu.tooltipRandom.setSeed(123n);
        calls = [];
        await app['MainLoop']();
        console.log([Client.gameState, Client.loopCycle, Minimenu.tooltipSeed, Minimenu.tooltipRandom.nextInt(), MouseWheel.rotation, calls.join(',')].join('/'));
    }
}

if (process.argv[2] === 'trace') await trace();
else {
    const { test, expect } = await import('bun:test');
    test('client.a dispatches both phases of the same tick and preserves the reconnect result branches', () => {
        const dir = mkdtempSync(join(tmpdir(), 'mainloop530-'));
        try {
            const source = fileURLToPath(new URL('./game/ClientMainLoopOracle.java', import.meta.url));
            const asm = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED'];
            const build = Bun.spawnSync(['javac', ...asm, '-cp', gamepackPath, '-d', dir, source]);
            expect(build.exitCode, build.stderr.toString()).toBe(0);
            const java = ['java', ...asm, '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'ClientMainLoopOracle'];
            const patched = Bun.spawnSync([...java, gamepackPath, dir]);
            expect(patched.exitCode, patched.stderr.toString()).toBe(0);
            const original = Bun.spawnSync(java, { stdin: Buffer.from(rows.map(row => row.join(' ')).join('\n') + '\n') });
            expect(original.exitCode, original.stderr.toString()).toBe(0);
            const actual = Bun.spawnSync([process.execPath, fileURLToPath(import.meta.url), 'trace']);
            expect(actual.exitCode, actual.stderr.toString()).toBe(0);
            const expected = original.stdout.toString().trimEnd().split(/\r?\n/);
            const result = actual.stdout.toString().trimEnd().split(/\r?\n/);
            expect(expected.length).toBe(rows.length);
            expect(result.length).toBe(rows.length);
            for (let i = 0; i < rows.length; i++) expect(result[i], rows[i].join(' ')).toBe(expected[i]);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
}
