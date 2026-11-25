import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import ClientKeyboardListener from '#/client/ClientKeyboardListener.js';
import ClientMouseListener from '#/client/ClientMouseListener.js';
import GameShell from '#/client/GameShell.js';
import MouseWheel from '#/client/MouseWheel.js';
import Signlink from '#/util/Signlink.js';
import WrappedException from '#/util/WrappedException.js';
import { loginFixture } from '../login-fixture.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

loginFixture(
    import.meta.url,
    'window replacement reads the canvas before a reentrant null wheel fails at attach or detach',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-window-wheel-'));
        try {
            const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
            const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
            const compile = Bun.spawnSync(['javac', asm, '-cp', cp, '-d', dir, ...['WindowLayoutOracle', 'HdWindowWheelOracle'].map(n => join(import.meta.dir, n + '.java'))]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const java = ['java', asm, '-Djava.awt.headless=true', '-cp', cp, 'HdWindowWheelOracle'];
            const instrument = Bun.spawnSync([...java, dir]);
            expect(instrument.exitCode, instrument.stderr.toString()).toBe(0);
            const oracle = Bun.spawnSync(java);
            expect(oracle.exitCode, oracle.stderr.toString()).toBe(0);
            const rows = oracle.stdout.toString().trimEnd().split(/\r?\n/);
            expect(rows).toHaveLength(2);
            const client = new Client();
            Client.activeClient = client;
            GameShell.signlink = Object.assign(Object.create(Signlink.prototype), { applet: { getSize: () => ({ width: 765, height: 503 }) } });
            client.leaveSdDisplay = () => undefined;
            ClientKeyboardListener.addListeners = ClientMouseListener.addListeners = () => {};
            ClientKeyboardListener.stop = ClientMouseListener.stop = () => {};
            Object.defineProperty(client, 'recreateCanvas', { value() {} });
            for (const [which, row] of rows.entries()) {
                let read = 0;
                let pending = false;
                const events: string[] = [];
                Object.defineProperty(MouseWheel, 'instance', {
                    configurable: true,
                    get() {
                        read++;
                        events.push('wheel');
                        if (which === 1 && read === 1) return null;
                        if (read === (which === 1 ? 2 : 1)) return {};
                        pending = true;
                        return null;
                    }
                });
                Object.defineProperty(GameShell, 'canvas', {
                    configurable: true,
                    get() {
                        if (pending) events.push('canvas');
                        return {};
                    }
                });
                let status: string | null = '';
                try {
                    await GameShell.applyWindowMode(0, -1, 0, false, true, -1);
                } catch (error) {
                    if (!(error instanceof WrappedException) || !(error.cause instanceof TypeError)) throw error;
                    status = error.context;
                }
                expect(events.join(';') + '|' + status).toBe(row);
            }
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    30000,
    'gl'
);
