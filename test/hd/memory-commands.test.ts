import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import world from '#/dash3d/world.js';
import { fromJsString, toJsString } from '#/datastruct/JagString.js';
import GlCleaner from '#/gl/GlCleaner.js';
import GlRenderer from '#/gl/GlRenderer.js';
import SuperPacket from '#/io/SuperPacket.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { loginFixture } from '../login-fixture.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

loginFixture(
    import.meta.url,
    'HD memory commands match model release, ordered card counters and packet forwarding',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-memory-commands-'));
        const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
        const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
        const command = (args: string[]) => {
            const result = Bun.spawnSync(args);
            expect(result.exitCode, result.stderr.toString()).toBe(0);
            return result.stdout.toString().trimEnd().split(/\r?\n/);
        };
        const log = console.log;
        const events: string[] = [];
        try {
            command(['javac', asm, '-cp', cp, '-d', dir, join(import.meta.dir, 'HdMemoryCommandsOracle.java')]);
            command(['java', asm, '-cp', cp, 'HdMemoryCommandsOracle', hdGamepackPath, dir]);
            const expected = command(['java', asm, '-Djava.awt.headless=true', '-cp', cp, 'HdMemoryCommandsOracle']);
            const release = world.releaseGlModels;
            world.releaseGlModels = () => {
                events.push('release');
                release();
            };
            Client.removeSoftCaches = () => {
                events.push('caches');
            };
            Client.AddChat = text => {
                events.push(toJsString(requireNonNull(text)).replace(/=-?\d+k/g, '=<heap>k'));
            };
            globalThis.gc = async () => {
                events.push('gc');
            };
            console.log = message => {
                events.push(String(message));
            };
            const actual: string[] = [];
            for (const rights of [0, 1, 2, 3])
                for (const active of [false, true])
                    for (const scene of [0, 1, 2])
                        for (const text of ['::mm', '::MM', '::cardmem', '::CARDMEM', '::cardmem ']) {
                            Client.staffModLevel = rights;
                            GlRenderer.active = active;
                            world.modelsReleased = scene === 2;
                            world.squares = scene === 0 ? [] : null;
                            Object.assign(GlCleaner, { geometryMemory: -217, memory2d: 381, textureMemory: 172032 });
                            const out = (Client.out = new SuperPacket(128));
                            out.SetEnc(Int32Array.of(1, 22, 4, 8));
                            events.length = 0;
                            let failed = false;
                            try {
                                await Client.DoCheat(fromJsString(text));
                            } catch {
                                failed = true;
                            }
                            const packet = Buffer.from(requireNonNull(out.m_data).subarray(0, out.m_pos)).toString('hex');
                            actual.push([[rights, active, scene, text].join(','), failed, world.modelsReleased, packet, events.join(';')].join('|'));
                        }
            expect(actual).toEqual(expected);
        } finally {
            console.log = log;
            rmSync(dir, { recursive: true, force: true });
        }
    },
    45000,
    'gl'
);
