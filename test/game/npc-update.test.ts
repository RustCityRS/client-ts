import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import ClientNpc from '#/dash3d/ClientNpc.js';
import NpcType from '#/config/NpcType.js';
import { JavaError } from '#/util/JavaException.js';
import WrappedException from '#/util/WrappedException.js';
import { loginFixture } from '../login-fixture.js';
import { gamepackPath } from '../reference.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

for (const identity of ['sd', 'gl'] as const) {
    loginFixture(
        import.meta.url,
        identity + ' NPC update reads the type and wraps runtime failures like the original',
        async () => {
            const temp = mkdtempSync(join(tmpdir(), '530-npc-update-'));
            try {
                const hd = identity === 'gl';
                const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
                const cp = [temp, hd ? hdGamepackPath : gamepackPath, joglPath].join(delimiter);
                const compile = Bun.spawnSync(['javac', asm, '-d', temp, join(import.meta.dir, 'NpcUpdateOracle.java')]);
                expect(compile.exitCode, compile.stderr.toString()).toBe(0);
                const command = ['java', asm, '-Djava.awt.headless=true', '-cp', cp, 'NpcUpdateOracle', hd ? 'hd' : 'sd'];
                const instrument = Bun.spawnSync([...command, temp]);
                expect(instrument.exitCode, instrument.stderr.toString()).toBe(0);
                const original = Bun.spawnSync(command);
                expect(original.exitCode, original.stderr.toString()).toBe(0);
                const npc = new ClientNpc();
                const observed: string[] = [];
                for (const value of [null, new NpcType()]) {
                    for (let fault = 0; fault < 3; fault++) {
                        let reads = 0;
                        Object.defineProperty(npc, 'npcType', {
                            configurable: true,
                            get() {
                                reads++;
                                if (fault === 1) throw new Error();
                                if (fault === 2) throw new JavaError();
                                return value;
                            }
                        });
                        let result: string | null = 'return';
                        try {
                            npc.update(-1, 2, -3, 4, 5);
                        } catch (error) {
                            if (error instanceof JavaError) result = 'error';
                            else if (error instanceof WrappedException) result = error.context;
                            else throw error;
                        }
                        observed.push(reads + '|' + result);
                    }
                }
                expect(observed).toEqual(original.stdout.toString().trimEnd().split(/\r?\n/));
            } finally {
                rmSync(temp, { force: true, recursive: true });
            }
        },
        30000,
        identity
    );
}
