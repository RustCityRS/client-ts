import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import TitleFlames from '#/title/TitleFlames.js';
import type Js5Resources from '#/cache/Js5Resources.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import HashTable from '#/datastruct/HashTable.js';
import Linkable from '#/datastruct/Linkable.js';
import ScriptRunner from '#/script/ScriptRunner.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import InterfaceSession from '#/ui/InterfaceSession.js';
import Minimenu from '#/ui/Minimenu.js';
import SubInterface from '#/ui/SubInterface.js';
import { loginFixture } from './login-fixture.js';
import { gamepackPath } from './reference.js';

class Stop extends Error {}

async function run(open: number, shape: number, top: number, stop: string, change: string) {
    const calls: string[] = [];
    const game = new Client();
    const initial = (InterfaceList.subInterfaces = new HashTable<SubInterface>(8));
    InterfaceList.top = top;
    Client.loginScreenInterface = 55;
    Client.defaultCursor = 9;
    Minimenu.defaultCursor = 16;
    const player = new ClientPlayer();
    player.x = 10;
    player.z = 11;
    let current = player;
    function call(op: string) {
        calls.push([op, InterfaceList.top, Minimenu.defaultCursor, InterfaceList.subInterfaces === initial, current === player, current.x, current.z].join('.'));
        if (op === stop) throw new Stop();
        if (op === change) {
            if (op.startsWith('sub')) InterfaceList.subInterfaces = new HashTable(4);
            if (op === 'reset') Client.loginScreenInterface = 33;
            if (op === 'size' || op === 'redraw') InterfaceList.top = 42;
            if (op === 'on55') Client.defaultCursor = 7;
            if (op === 'x') Client.localPlayer = new ClientPlayer();
        }
    }
    Object.defineProperty(Client, 'localPlayer', {
        configurable: true,
        get: () => current,
        set: (p: ClientPlayer) => {
            current = p;
            let x = p.x;
            Object.defineProperty(p, 'x', {
                configurable: true,
                get: () => x,
                set: (v: number) => {
                    x = v;
                    call('x');
                }
            });
        }
    });
    for (let i = 0; i < (shape === 0 ? 0 : 3); i++) {
        const sub = new SubInterface();
        sub.group = i + 20;
        if ((shape === 2 && i === 0) || (shape === 3 && i === 2)) (initial as HashTable<Linkable>).put(new Linkable(), BigInt(i));
        else initial.put(sub, BigInt(i));
    }
    IfType.CloseInterface = group => call('close' + group);
    Client.CloseSubinterface = sub => {
        call('sub' + sub.group);
        sub.Unlink();
    };
    InterfaceList.reset = () => call('reset');
    Client.InterfaceCalculateSizeAndPosAll = () => call('size');
    InterfaceList.redrawAll = () => call('redraw');
    ScriptRunner.OnLoad = group => call('on' + group);
    Client.setCursor = id => call('cursor' + id);
    game['assets'] = Object.create(null) as Js5Resources;
    TitleFlames.SetupFire = () => {
        call('flame');
        throw new Stop();
    };
    game.ui = Object.assign(Object.create(InterfaceSession.prototype), { view: {} });
    let result = 'ok';
    try {
        await game['resetToTitle'](open === 1);
    } catch (e) {
        if (e instanceof Stop) result = 'stop';
        else if (e instanceof TypeError && e.message.startsWith('ClassCastException')) result = 'cast';
        else throw e;
    }
    return result + ' ' + calls.join(' ') + ' |' + [InterfaceList.top, Minimenu.defaultCursor, current === player, current.x, current.z].join(' ');
}

loginFixture(
    import.meta.url,
    '530 title reset matches subinterface casts, hook order and live player coordinate writes',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'reset-title-order-'));
        try {
            const module = 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
            const cc = Bun.spawnSync(['javac', '--add-exports', module, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'ui/ResetTitleOrderOracle.java')]);
            expect(cc.exitCode, cc.stderr.toString()).toBe(0);
            const argv = ['java', '-Djava.awt.headless=true', '--add-exports', module, '-cp', dir + delimiter + gamepackPath, 'ResetTitleOrderOracle'];
            const patch = Bun.spawnSync([...argv, dir]);
            expect(patch.exitCode, patch.stderr.toString()).toBe(0);
            const cases: [number, number, number, string, string][] = [];
            for (const open of [0, 1])
                for (const shape of [0, 1, 2, 3])
                    for (const top of [-1, 23]) {
                        for (const stop of ['none', 'close23', 'sub20', 'sub21', 'reset', 'size', 'redraw', 'on55', 'cursor9', 'x', 'flame']) cases.push([open, shape, top, stop, 'none']);
                        for (const change of ['sub20', 'reset', 'size', 'redraw', 'on55', 'x']) cases.push([open, shape, top, 'none', change]);
                    }
            const jvm = Bun.spawnSync(argv, { stdin: Buffer.from(cases.map(v => v.join(' ')).join('\n') + '\n') });
            expect(jvm.exitCode, jvm.stderr.toString()).toBe(0);
            const expected = jvm.stdout.toString().trimEnd().split(/\r?\n/);
            expect(expected.length).toBe(cases.length);
            for (const [i, v] of cases.entries()) expect(await run(...v), v.join(' ')).toBe(expected[i]);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    20000
);
