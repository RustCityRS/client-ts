import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';
import Client from '#/client/Client.js';
import WrappedException from '#/util/WrappedException.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';
import { loginFixture } from '../login-fixture.js';

loginFixture(
    import.meta.url,
    'HD JS5 failure retains the game loop context from the GL gamepack',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'hd-main-loop-failure-'));
        try {
            const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
            const compile = Bun.spawnSync(['javac', '-cp', cp, '-d', dir, join(import.meta.dir, 'HdMainLoopFailureOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const oracle = Bun.spawnSync(['java', '-Djava.awt.headless=false', '-cp', cp, 'HdMainLoopFailureOracle']);
            expect(oracle.exitCode, oracle.stderr.toString()).toBe(0);
            const applet = new Client();
            Client.gameState = 20;
            Client.js5NetQueue = null;
            let state: string | undefined;
            try {
                await applet['MainLoop']();
            } catch (error) {
                if (!(error instanceof WrappedException)) throw error;
                state = (error.cause instanceof TypeError) + '|' + error.context;
            }
            expect(state).toBe(oracle.stdout.toString().trimEnd());
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    45000,
    'gl'
);
