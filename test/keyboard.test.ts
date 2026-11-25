import Client from '#/client/Client.js';
import { loginFixture } from './login-fixture.js';
import { expect } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import ClientKeyboardListener, { type AwtKeyEvent } from '#/client/ClientKeyboardListener.js';
import { awtKeyCode } from '#/Keyboard.js';
import { gamepackPath } from './reference.js';

loginFixture(
    import.meta.url,
    'AWT key changes, character queues, focus, platform maps and typed event consumption match the 530 gamepack',
    async () => {
        const client = new Client();
        Client.loopCycle = 1;
        const cmds: string[] = [
            'add',
            'gain',
            'press 65 0',
            'poll',
            'type 120 0',
            'press 72 0',
            'next',
            'next',
            'poll',
            'collect',
            'next',
            'lost',
            'poll',
            'idle 2147483647',
            'poll',
            'clear',
            'poll',
            'next',
            'press 65 0',
            'release 65 0',
            'type 97 0',
            'add',
            'stop -1',
            'on'
        ];
        for (const microsoft of [0, 1])
            for (const traversal of [0, 1]) {
                cmds.push('map ' + microsoft + ' ' + traversal, 'add');
                for (let key = -2; key <= 525; key++) {
                    cmds.push('press ' + key + ' ' + ((key + 2) % 16), 'release ' + key + ' ' + ((key + 2) % 16));
                    if (key % 17 === 0) cmds.push('poll', 'next', 'next');
                }
                cmds.push('stop -1', 'poll', 'collect');
            }
        for (const ch of [0, 1, 8, 9, 10, 13, 65, 127, 128, 159, 160, 255, 256, 257, 8364, 65535]) cmds.push('type ' + ch + ' 0', 'poll', 'next');
        for (let i = 0; i < 160; i++) cmds.push('press ' + ((i % 26) + 65) + ' ' + (i % 16), 'type ' + ((i % 255) + 1) + ' 0');
        cmds.push('poll', 'collect', 'next', 'next');
        for (let i = 0; i < 320; i++) cmds.push('release 96 0');
        cmds.push('stop 128', 'release 65 0', 'stop -1', 'poll', 'collect');

        const dirPath = resolve('out');
        mkdirSync(dirPath, { recursive: true });
        const tmp = mkdtempSync(join(dirPath, 'keyboard-'));
        const k = ClientKeyboardListener,
            handler = new ClientKeyboardListener();
        const previous = k.instance;
        const sizes = [k.changeWriter, k.changeReader, k.eventReader, k.eventWriter, k.eventLimit, k.keyCode, k.keyChar, k.count, k.idleCycles];
        const buffers = [k.changes, k.eventCodes, k.eventChars, k.codes, k.chars, k.m_keycodeMap],
            copies = buffers.map(b => b.slice()),
            savedPressed = k.pressed.slice();
        try {
            const build = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', tmp, join(import.meta.dir, 'game', 'KeyboardOracle.java')]);
            expect(build.exitCode, build.stderr.toString()).toBe(0);
            const oracle = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', tmp + delimiter + gamepackPath, 'KeyboardOracle'], {
                stdin: Buffer.from(cmds.join('\n') + '\n'),
                maxBuffer: 4 * 1024 * 1024
            });
            expect(oracle.exitCode, oracle.stderr.toString()).toBe(0);
            const lines = oracle.stdout.toString().trimEnd().split(/\r?\n/);
            expect(lines.length).toBe(cmds.length);
            k.instance = handler;
            k.changeWriter = k.changeReader = k.eventReader = k.eventWriter = k.eventLimit = k.keyCode = k.keyChar = k.count = k.idleCycles = 0;
            for (const b of buffers.slice(0, 5)) b.fill(0);
            k.pressed.fill(false);
            let calls = '',
                hasTraversal = false;
            const surface = {
                addKeyListener: (l: ClientKeyboardListener | null) => {
                    calls += 'ak' + (l === handler);
                },
                addFocusListener: (l: ClientKeyboardListener | null) => {
                    calls += 'af' + (l === handler);
                },
                removeKeyListener: (l: ClientKeyboardListener | null) => {
                    calls += 'rk' + (l === handler);
                },
                removeFocusListener: (l: ClientKeyboardListener | null) => {
                    calls += 'rf' + (l === handler);
                },
                get setFocusTraversalKeysEnabled() {
                    if (hasTraversal) {
                        return (v: boolean) => {
                            calls += 'tab' + v;
                        };
                    } else {
                        return undefined;
                    }
                }
            };
            const hash = (a: ArrayLike<number | boolean>) => {
                let h = 1;
                for (let i = 0; i < a.length; i++) {
                    const n = a[i];
                    h = (Math.imul(31, h) + (n === true ? 1231 : n === false ? 1237 : n)) | 0;
                }
                return h;
            };
            for (const [i, cmd] of cmds.entries()) {
                const [op, v, m] = cmd.split(' '),
                    x = Number(v),
                    mod = Number(m);
                let res = 'ok',
                    consumed = false;
                calls = '';
                const event: AwtKeyEvent = {
                    getKeyCode: () => x,
                    getModifiers: () => mod,
                    getKeyChar: () => x,
                    consume: () => {
                        consumed = true;
                    }
                };
                try {
                    switch (op) {
                        case 'map':
                            hasTraversal = mod !== 0;
                            k.init(x === 0 ? 'OpenJDK' : 'MICROSOFT Inc', hasTraversal);
                            break;
                        case 'press':
                            handler.keyPressed(event);
                            res = String(consumed);
                            break;
                        case 'release':
                            handler.keyReleased(event);
                            res = String(consumed);
                            break;
                        case 'type':
                            handler.keyTyped(event);
                            res = String(consumed);
                            break;
                        case 'gain':
                            handler.focusGained();
                            break;
                        case 'lost':
                            handler.focusLost();
                            break;
                        case 'add':
                            k.addListeners(surface);
                            break;
                        case 'stop':
                            k.stop(x, surface);
                            break;
                        case 'clear':
                            k.dispose();
                            break;
                        case 'on':
                            k.instance = handler;
                            break;
                        case 'poll':
                            k.poll();
                            break;
                        case 'next':
                            res = String(k.next());
                            break;
                        case 'idle':
                            k.idleCycles = x;
                            break;
                        case 'collect':
                            await client['titleLoop']();
                            break;
                    }
                } catch (e) {
                    if (e instanceof TypeError) res = 'null';
                    else if (e instanceof RangeError) res = 'bounds';
                    else throw e;
                }
                const trace = [
                    res,
                    calls || '-',
                    k.getIdleCycles(),
                    k.changeWriter,
                    k.changeReader,
                    k.eventWriter,
                    k.eventReader,
                    k.eventLimit,
                    k.keyCode,
                    k.keyChar,
                    k.count,
                    ...[k.m_keycodeMap, k.changes, k.eventChars, k.eventCodes, k.pressed, k.codes, k.chars].map(hash)
                ].join(' ');
                expect(trace, 'event ' + i + ' ' + cmd).toBe(lines[i]);
            }
            expect(['Enter', 'Delete', 'Numpad7', 'Digit9', 'KeyZ', 'Backquote', 'F12', 'IntlBackslash', '???'].map(awtKeyCode)).toEqual([10, 127, 103, 57, 90, 192, 123, 520, -1]);
        } finally {
            k.instance = previous;
            [k.changeWriter, k.changeReader, k.eventReader, k.eventWriter, k.eventLimit, k.keyCode, k.keyChar, k.count, k.idleCycles] = sizes;
            for (let i = 0; i < buffers.length; i++) buffers[i].set(copies[i]);
            for (let i = 0; i < savedPressed.length; i++) k.pressed[i] = savedPressed[i];
            rmSync(tmp, { recursive: true, force: true });
        }
    },
    30000
);
