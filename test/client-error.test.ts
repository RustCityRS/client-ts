import { fixtureDiskQueue } from './disk-queue.js';
import Signlink from '#/util/Signlink.js';
import GameShell from '#/client/GameShell.js';
import { gamepackPath } from './reference.js';
import { expect, test } from 'bun:test';
import { fileURLToPath } from 'node:url';
import { JavaError, clientErrorHost, compactTrace, reportClientError } from '../src/util/ClientError.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import WrappedException from '#/util/WrappedException.js';

test('disk error reporting matches pk, waits for the report, and keeps fatal requests incomplete', async () => {
    const result = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', gamepackPath, fileURLToPath(new URL('./cache/ErrorReporterOracle.java', import.meta.url))], { timeout: 15000 });
    expect(result.stderr.toString()).toBe('');
    expect(result.exitCode).toBe(0);
    const log = console.log,
        uncaught = console.error;
    const previous = { ...clientErrorHost },
        saved = Object.getOwnPropertyDescriptors(Signlink),
        previousLink = GameShell.errorSignlink;
    let link: Signlink | null = null;
    const output: string[] = [],
        urls: URL[] = [],
        failures: unknown[] = [];
    const disk = fixtureDiskQueue();
    try {
        console.log = value => output.push(String(value));
        console.error = value => failures.push(value);
        const error = new Error('bad:@&#%0a');
        error.name = 'java.lang.IllegalStateException';
        error.stack = error.toString() + '\n\tat Cache.write(Cache.java:123)\n\tat Thread.run(Unknown Source)';
        await reportClientError(error, 'queue%0a9');
        await reportClientError(null, null);
        await reportClientError(null, 'disk');
        expect(output.join('\n') + '\n').toBe(result.stdout.toString().replaceAll('\r\n', '\n'));
        clientErrorHost.base = new URL('http://localhost:12345/game/');
        clientErrorHost.revision = 530;
        clientErrorHost.username = 71n;
        const pending = Promise.withResolvers<void>();
        link = GameShell.errorSignlink = new Signlink(
            {},
            {
                async openUrl(url) {
                    urls.push(url);
                    await pending.promise;
                    return {
                        async read() {
                            return -1;
                        },
                        async close() {}
                    };
                }
            }
        );
        Signlink.javaVendor = 'test';
        Signlink.javaVersion = '1';
        const store = {
            read() {
                throw error;
            },
            write() {}
        };
        const request = disk.EnqueueRequestFromMainThread(store, 1);
        await Bun.sleep(0);
        expect(request.incomplete).toBe(true);
        expect(urls[0].pathname).toBe('/game/clienterror.ws');
        expect(urls[0].search).toBe('?c=530&u=71&v1=test&v2=1&e=Cache.write%3a123%20Thread.run%20|%20java.lang.IllegalStateException%3a%20bad%3a%40%26%23%0a');
        pending.resolve();
        while (request.incomplete) await Bun.sleep(1);
        expect(request.incomplete).toBe(false);
        const fatal = new JavaError('disk thread terminated');
        const broken = disk.EnqueueRequestFromMainThread(
            {
                read() {
                    throw fatal;
                },
                write() {}
            },
            2
        );
        const waiting = disk.EnqueueRequestFromMainThread(store, 3);
        await Bun.sleep(0);
        expect([broken.incomplete, waiting.incomplete, disk.pending]).toEqual([true, true, 1]);
        expect(failures).toEqual([fatal]);
        expect(urls).toHaveLength(1);
    } finally {
        await disk.EndAndJoin();
        await link?.stopWorker();
        GameShell.errorSignlink = previousLink;
        Object.defineProperties(Signlink, saved);
        console.log = log;
        console.error = uncaught;
        Object.assign(clientErrorHost, previous);
    }
});

test('wrapped diagnostic context, cause identity and compact stack match g, od and uc', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rs530-error-'));
    try {
        const build = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game', 'WrappedExceptionOracle.java')]);
        expect(build.exitCode, build.stderr.toString()).toBe(0);
        const jar = Bun.spawnSync(['java', '-cp', dir + delimiter + gamepackPath, 'WrappedExceptionOracle']);
        expect(jar.exitCode, jar.stderr.toString()).toBe(0);
        const rows = jar.stdout.toString().trimEnd().split(/\r?\n/);
        let i = 0;
        for (const source of ['Client.java', 'Client.kt', null])
            for (const line of [123, -1, -2])
                for (const first of [null, 'a', ''])
                    for (const next of [null, 'b', ''])
                        for (let mode = 0; mode < 3; mode++) {
                            const original = new Error('oops');
                            original.name = 'java.lang.IllegalStateException';
                            const location = line === -2 ? 'Native Method' : source === null ? 'Unknown Source' : source + (line >= 0 ? ':' + line : '');
                            original.stack = original + '\n\tat client.run(' + location + ')\n\tat ca.run(ca.java:17)\n';
                            const cause = mode === 2 ? null : original,
                                wrapped = WrappedException.wrap(cause, first);
                            const same = mode === 0 ? wrapped : WrappedException.wrap(wrapped, next);
                            let trace: string;
                            try {
                                trace = compactTrace(same);
                            } catch {
                                trace = '<exception>';
                            }
                            expect([same === wrapped, same.cause === cause, String(same.context), Buffer.from(trace).toString('base64')].join('|')).toBe(rows[i++]);
                        }
        expect(i).toBe(rows.length);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
