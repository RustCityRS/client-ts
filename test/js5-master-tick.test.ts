import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Js5LocalCache from '#/cache/Js5LocalCache.js';
import Js5MasterIndex from '#/cache/Js5MasterIndex.js';
import Js5RemoteLoader from '#/cache/Js5RemoteLoader.js';
import Js5NetQueue from '#/io/Js5NetQueue.js';
import { gamepackPath } from './reference.js';

test('wi.a(Z)V rereads the provider table and slot separately throughout both passes', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rs530-master-tick-'));
    try {
        const access = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED'];
        const classpath = dir + delimiter + gamepackPath;
        for (const command of [
            ['javac', ...access, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'cache/MasterTickOracle.java')],
            ['java', ...access, '-cp', classpath, 'MasterTickOracle', dir]
        ]) {
            const result = Bun.spawnSync(command);
            expect(result.exitCode, result.stderr.toString()).toBe(0);
        }
        const rows: number[][] = [];
        for (let shape = 0; shape < 4; shape++) {
            rows.push([shape, 0, 0]);
            for (let at = 1; at <= 33; at++) {
                for (let action = 0; action < 7; action++) rows.push([shape, at, action]);
            }
        }
        const oracle = Bun.spawnSync(['java', ...access, '-cp', classpath, 'MasterTickOracle'], {
            stdin: Buffer.from(rows.map(row => row.join(' ')).join('\n') + '\n')
        });
        expect(oracle.exitCode, oracle.stderr.toString()).toBe(0);
        const lines = oracle.stdout.toString().trimEnd().split(/\r?\n/);
        expect(lines.length).toBe(rows.length);

        const net = new Js5NetQueue();
        // These providers have no disk stores, so no worker is started or called.
        const disk: Js5LocalCache = Object.create(Js5LocalCache.prototype);
        const master = new Js5MasterIndex(net, disk);
        const entries = Array.from({ length: 4 }, (_, id) => new Js5RemoteLoader(id, null, null, net, disk, 0, 0, false));
        for (const [index, [shape, at, action]] of rows.entries()) {
            const original = [entries[0], null, entries[1], entries[0]];
            const alternate = [null, entries[2], entries[3], null, entries[2]];
            const empty: Js5RemoteLoader[] = [];
            const single = [entries[3]];
            type Table = (Js5RemoteLoader | null)[] | null;
            let active: Table = shape === 0 ? original : shape === 1 ? null : shape === 2 ? empty : single;
            const table = (value: Table) => (value === null ? '-' : value === original ? 'a' : value === alternate ? 'b' : value === empty ? 'e' : 's');
            const trace: string[] = [];
            const stop = new Error('provider observer stopped');
            function observe(entry: string) {
                trace.push(entry);
                if (trace.length === at) {
                    switch (action) {
                        case 0:
                            active = alternate;
                            break;
                        case 1:
                            active = null;
                            break;
                        case 2:
                            active = empty;
                            break;
                        case 3:
                            active = single;
                            break;
                        case 4:
                            original.fill(null);
                            break;
                        case 5:
                            original.fill(entries[3]);
                            break;
                        case 6:
                            throw stop;
                    }
                }
            }
            for (const [id, provider] of entries.entries()) {
                provider.processPrefetch = () => {
                    observe('d' + id);
                    Js5RemoteLoader.prototype.processPrefetch.call(provider);
                };
                provider.processQueue = () => {
                    observe('g' + id);
                    Js5RemoteLoader.prototype.processQueue.call(provider);
                };
            }
            Object.defineProperty(master, 'providers', {
                configurable: true,
                get() {
                    const captured = active;
                    observe('r' + table(captured));
                    return captured;
                }
            });
            let status = 'ok';
            try {
                master.tick();
            } catch (error) {
                if (error === stop) status = 'stop';
                else if (error instanceof TypeError) status = 'null';
                else if (error instanceof RangeError) status = 'bounds';
                else throw error;
            }
            expect([status, table(active), trace.join(',')].join('/'), rows[index].join(' ')).toBe(lines[index]);
        }
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}, 30000);
