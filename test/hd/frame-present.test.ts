import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import GameShell from '#/client/GameShell.js';
import InterfaceList from '#/ui/InterfaceList.js';
import WrappedException from '#/util/WrappedException.js';
import { loginFixture } from '../login-fixture.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

loginFixture(
    import.meta.url,
    'HD client frame presents through the drawable and clears the same root rectangles',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-hd-frame-present-'));
        try {
            const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
            const sources = ['GlRecorder.java', 'HdTitleFrameOracle.java', 'HdFramePresentOracle.java'];
            const compile = Bun.spawnSync(['javac', '-cp', cp, '-d', dir, ...sources.map(s => join(import.meta.dir, s))]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const run = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', cp, 'HdFramePresentOracle']);
            expect(run.exitCode, run.stderr.toString()).toBe(0);
            const expected = run.stdout.toString().trimEnd().split(/\r?\n/);
            expect(expected.length).toBe(36);
            const { default: GlRenderer } = await import('#/gl/GlRenderer.js');
            let swaps = 0,
                swapFails = false;
            Reflect.set(GlRenderer, 'drawable', {
                swapBuffers() {
                    swaps++;
                    if (swapFails) throw new Error('swap');
                }
            });
            GlRenderer.active = true;
            const client = new Client();
            GameShell.m_focus = true;
            GameShell.fullRedraw = false;
            GameShell.fullScreenFrame = { getSize: () => ({ width: 765, height: 503 }), getInsets: () => ({ left: 0, right: 0, top: 0, bottom: 0 }) };
            Client.gameState = 42;
            Client.loadingComplete = false;
            const actual = [];
            for (const count of [0, 1, 7, 99, 100, 101])
                for (const size of [99, 100, 101])
                    for (const fail of [false, true]) {
                        InterfaceList.rootCount = count;
                        InterfaceList.dirty.length = size;
                        InterfaceList.dirty.fill(false);
                        InterfaceList.rectangleRedraw.fill(true);
                        swaps = 0;
                        swapFails = fail;
                        let error = '-';
                        try {
                            await client['MainRedraw']();
                        } catch (cause) {
                            if (!(cause instanceof WrappedException) || !(cause.cause instanceof RangeError)) throw cause;
                            expect(cause.context).toBe('client.K(40)');
                            error = 'bounds';
                        }
                        const bits = (flags: boolean[]) => flags.map(bit => (bit ? '1' : '0')).join('');
                        actual.push([error, swaps, bits(InterfaceList.dirty), bits(InterfaceList.rectangleRedraw)].join('|'));
                    }
            expect(actual).toEqual(expected);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    45000,
    'gl'
);
