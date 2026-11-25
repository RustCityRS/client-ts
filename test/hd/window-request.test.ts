import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import GameShell from '#/client/GameShell.js';
import Signlink from '#/util/Signlink.js';
import WrappedException from '#/util/WrappedException.js';
import { loginFixture } from '../login-fixture.js';
import { gamepackPath } from '../reference.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

for (const variant of ['sd', 'gl'] as const) {
    loginFixture(
        import.meta.url,
        variant + ' window requests select the JAR context rebuild and canvas replacement',
        async () => {
            const dir = mkdtempSync(join(tmpdir(), 'rs530-window-request-'));
            const applyWindow = GameShell.applyWindowMode;
            const renderer = variant === 'gl' ? (await import('#/gl/GlRenderer.js')).default : null;
            const initialActive = renderer?.active ?? false,
                initialFrame = GameShell.fullScreenFrame,
                initialResizable = GameShell.resizable;
            const frame = { getSize: () => ({ width: 765, height: 503 }), getInsets: () => ({ left: 0, right: 0, top: 0, bottom: 0 }) };
            const osName = Signlink.osNameLower,
                refresh = Client.windowModeRefreshTime;
            try {
                const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
                const compile = Bun.spawnSync(['javac', asm, '-d', dir, join(import.meta.dir, 'WindowLayoutOracle.java'), join(import.meta.dir, 'WindowRequestOracle.java')]);
                expect(compile.exitCode, compile.stderr.toString()).toBe(0);
                const cp = [dir, ...(variant === 'gl' ? [hdGamepackPath, joglPath] : [gamepackPath])].join(delimiter);
                const java = ['java', asm, '-Djava.awt.headless=true', '-cp', cp, 'WindowRequestOracle', variant];
                const patch = Bun.spawnSync([...java, dir]);
                expect(patch.exitCode, patch.stderr.toString()).toBe(0);
                const run = Bun.spawnSync(java);
                expect(run.exitCode, run.stderr.toString()).toBe(0);
                const rows = run.stdout.toString().trimEnd().split(/\r?\n/);
                expect(rows).toHaveLength(variant === 'gl' ? 576 : 144);
                for (const row of rows) {
                    const [current, host, mode, bits, time, expectedCall, expectedError] = row.split('|');
                    const mask = Number(bits);
                    if (renderer !== null) renderer.active = current !== '0';
                    GameShell.resizable = current === '2';
                    GameShell.fullScreenFrame = current === '3' ? frame : null;
                    expect(Client.getWindowMode()).toBe(Number(current));
                    Signlink.osNameLower = host === 'null' ? null : host;
                    Client.windowModeRefreshTime = 12345n;
                    let call = '-',
                        error = '-';
                    GameShell.applyWindowMode = (...args) => {
                        call = args.join(',');
                        if (mask & 4) throw new TypeError('window');
                    };
                    try {
                        Client.setWindowMode(-321, (mask & 1) !== 0, Number(mode), (mask & 2) !== 0, 987);
                    } catch (cause) {
                        if (!(cause instanceof WrappedException)) throw cause;
                        error = String(cause.context);
                    }
                    expect([String(Client.windowModeRefreshTime), call, error], row).toEqual([time, expectedCall, expectedError]);
                }
            } finally {
                GameShell.applyWindowMode = applyWindow;
                if (renderer !== null) renderer.active = initialActive;
                GameShell.fullScreenFrame = initialFrame;
                GameShell.resizable = initialResizable;
                Signlink.osNameLower = osName;
                Client.windowModeRefreshTime = refresh;
                rmSync(dir, { recursive: true, force: true });
            }
        },
        45000,
        variant
    );
}
