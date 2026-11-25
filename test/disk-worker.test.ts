import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import GameShell from '#/client/GameShell.js';
import Js5LocalCache from '#/cache/Js5LocalCache.js';
import Signlink, { SignlinkThread, type SignlinkRunnable } from '#/util/Signlink.js';
import SignlinkRequest from '#/util/SignlinkRequest.js';
import ThreadUtils from '#/util/ThreadUtils.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { gamepackPath } from './reference.js';

test('ca waits for the Signlink disk thread, casts the result and joins that same thread during shutdown', async () => {
    const out = mkdtempSync(join(import.meta.dir, '../out/disk-worker-'));
    let java: string[];
    try {
        const compiled = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', out, join(import.meta.dir, 'cache/DiskWorkerOracle.java')]);
        expect(compiled.exitCode, compiled.stderr.toString()).toBe(0);
        const oracle = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', out + delimiter + gamepackPath, 'DiskWorkerOracle'], { timeout: 20000 });
        expect(oracle.exitCode, oracle.stderr.toString()).toBe(0);
        java = oracle.stdout.toString().trimEnd().split(/\r?\n/);
    } finally {
        rmSync(out, { recursive: true, force: true });
    }
    const previous = GameShell.signlink;
    const descriptors = Object.getOwnPropertyDescriptors(Signlink);
    const savedSleep = ThreadUtils.sleep;
    class ControlledSignlink extends Signlink {
        request: SignlinkRequest<SignlinkThread> | null = null;
        override startThread(runnable: SignlinkRunnable | null, priority: number): SignlinkRequest<SignlinkThread> {
            const request = (this.request = new SignlinkRequest<SignlinkThread>());
            request.type = 2;
            request.intArg = priority;
            request.objectArg = runnable;
            return request;
        }
    }
    const host = (GameShell.signlink = new ControlledSignlink());
    const rows: string[] = [];
    try {
        for (const mode of ['ok', 'reject', 'null', 'wrong']) {
            const published = Promise.withResolvers<void>();
            const finish = Promise.withResolvers<void>();
            ThreadUtils.sleep = async delay => {
                expect(delay).toBe(10n);
                await published.promise;
            };
            const opened = Js5LocalCache.create();
            const req = requireNonNull(host.request),
                cache = req.objectArg;
            if (!(cache instanceof Js5LocalCache)) throw new Error('Signlink did not receive the disk runnable');
            rows.push([mode, 'requested', req.type, req.intArg, req.status, cache['worker'] === null, cache['stopping'], cache.pending].join(' '));
            const worker = new SignlinkThread({ run: () => finish.promise });
            req.result = mode === 'null' ? null : worker;
            if (mode === 'wrong') Reflect.set(req, 'result', {});
            req.status = mode === 'reject' ? 2 : 1;
            published.resolve();
            let result: Js5LocalCache;
            try {
                result = await opened;
            } catch {
                rows.push([mode, 'rejected', cache['worker'] === null].join(' '));
                finish.resolve();
                continue;
            }
            rows.push([mode, 'opened', result === cache, cache['worker'] === req.result].join(' '));
            let joined = false;
            const closed = cache.EndAndJoin().then(
                () => {
                    joined = true;
                    return false;
                },
                () => true
            );
            if (mode === 'ok') rows.push(['joining', cache['stopping'], cache['worker'] === worker, !joined].join(' '));
            finish.resolve();
            rows.push([mode, 'stopped', await closed, cache['worker'] === null].join(' '));
            rows.push(
                'twice ' +
                    (await cache.EndAndJoin().then(
                        () => false,
                        () => true
                    ))
            );
        }
        ThreadUtils.sleep = savedSleep;
        const real = (GameShell.signlink = new Signlink());
        try {
            const cache = await Js5LocalCache.create();
            const second = cache.run();
            await cache.EndAndJoin();
            await second;
            rows.push('notifyAll true true');
        } finally {
            await real.stopWorker();
        }
        GameShell.signlink = null;
        rows.push(
            'no signlink ' +
                (await Js5LocalCache.create().then(
                    () => false,
                    () => true
                ))
        );
        expect(rows).toEqual(java);
    } finally {
        ThreadUtils.sleep = savedSleep;
        await host.stopWorker();
        Object.defineProperties(Signlink, descriptors);
        GameShell.signlink = previous;
    }
}, 30000);
