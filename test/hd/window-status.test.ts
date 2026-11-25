import { expect } from 'bun:test';
import { loginFixture } from '../login-fixture.js';
import { delimiter, join } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import Client from '#/client/Client.js';
import GameShell from '#/client/GameShell.js';
import SuperPacket from '#/io/SuperPacket.js';
import Preferences from '#/ui/Preferences.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

loginFixture(
    import.meta.url,
    'the real HD window mode selects the original WINDOW_STATUS bytes for every display configuration',
    async () => {
        const { default: renderer } = await import('#/gl/GlRenderer.js');
        const dir = mkdtempSync(join(tmpdir(), 'rs530-hd-window-'));
        const classpath = [dir, hdGamepackPath, joglPath].join(delimiter);
        const originalPacket = Client.out;
        const originalJingle = Client.jingleActive;
        const initialActive = renderer.active,
            initialFrame = GameShell.fullScreenFrame,
            initialResizable = GameShell.resizable;
        const frame = { getSize: () => ({ width: 765, height: 503 }), getInsets: () => ({ left: 0, right: 0, top: 0, bottom: 0 }) };
        const width = GameShell.m_sWid,
            height = GameShell.m_sHei,
            antialias = Preferences.currentAntiAliasingMode;
        try {
            const compile = Bun.spawnSync(['javac', '-cp', classpath, '-d', dir, join(import.meta.dir, 'HdWindowStatusOracle.java')]);
            if (compile.exitCode !== 0) throw new Error(compile.stderr.toString());
            const oracle = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', classpath, 'HdWindowStatusOracle']);
            if (oracle.exitCode !== 0) throw new Error(oracle.stderr.toString());
            const rows = oracle.stdout
                .toString()
                .trim()
                .split(/\r?\n/)
                .map(line => line.split(' '));
            expect(rows.map(([mode]) => Number(mode))).toEqual([0, 1, 0, 2, 3, 3, 3, 3]);
            const packet = (Client.out = new SuperPacket(128));
            packet.SetEnc(Int32Array.of(530, -243, 0x7fffffff, 0));
            for (const [mask, [mode, expected, guarded, jingleActive]] of rows.entries()) {
                renderer.active = (mask & 1) !== 0;
                GameShell.resizable = (mask & 2) !== 0;
                GameShell.fullScreenFrame = (mask & 4) !== 0 ? frame : null;
                expect(Client.getWindowMode()).toBe(Number(mode));
                GameShell.m_sWid = 765 + mask * 61;
                GameShell.m_sHei = 503 + mask * 79;
                Preferences.currentAntiAliasingMode = mask % 3;
                const start = packet.m_pos;
                Client.sendWindowStatus();
                expect(Buffer.from(requireNonNull(packet.m_data).subarray(start, packet.m_pos)).toString('hex')).toBe(expected);
                Client.jingleActive = true;
                expect(Client.getWindowMode(1)).toBe(Number(guarded));
                expect(String(Client.jingleActive)).toBe(jingleActive);
            }
        } finally {
            Client.out = originalPacket;
            Client.jingleActive = originalJingle;
            renderer.active = initialActive;
            GameShell.fullScreenFrame = initialFrame;
            GameShell.resizable = initialResizable;
            GameShell.m_sWid = width;
            GameShell.m_sHei = height;
            Preferences.currentAntiAliasingMode = antialias;
            rmSync(dir, { recursive: true, force: true });
        }
    },
    30_000,
    'gl'
);
