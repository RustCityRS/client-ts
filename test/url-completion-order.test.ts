import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Client from '#/client/Client.js';
import { glJar } from '#/client/ClientVariant.js';
import GameShell from '#/client/GameShell.js';
import { gamepackPath } from './reference.js';
import { hdGamepackPath, joglPath } from './render/hd-reference.js';

test('title and in-game URL completion preserve both gamepacks’ read and clear order', () => {
    if (process.env.RS530_URL_ORDER_CHILD !== '1') {
        for (const variant of ['sd', 'gl']) {
            const child = Bun.spawnSync([process.execPath, 'test', fileURLToPath(import.meta.url)], { env: { ...process.env, RS530_URL_ORDER_CHILD: '1', RS530_GAMEPACK_IDENTITY: variant } });
            expect(child.exitCode, child.stderr.toString()).toBe(0);
        }
        return;
    }
    const dir = mkdtempSync(join(tmpdir(), 'rs530-url-order-'));
    try {
        const cp = [dir, ...(glJar ? [hdGamepackPath, joglPath] : [gamepackPath])].join(delimiter);
        const asm = ['--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED', '--add-exports=java.base/jdk.internal.org.objectweb.asm.tree=ALL-UNNAMED'];
        const compile = Bun.spawnSync(['javac', ...asm, '-cp', cp, '-d', dir, join(import.meta.dir, 'hd', 'UrlCompletionOracle.java')]);
        expect(compile.exitCode, compile.stderr.toString()).toBe(0);
        const java = ['java', ...asm, '-Djava.awt.headless=true', '-cp', cp, 'UrlCompletionOracle', glJar ? 'gl' : 'sd'];
        const extract = Bun.spawnSync([...java, dir]);
        expect(extract.exitCode, extract.stderr.toString()).toBe(0);
        const oracle = Bun.spawnSync(java);
        expect(oracle.exitCode, oracle.stderr.toString()).toBe(0);
        const rows = oracle.stdout.toString().trimEnd().split(/\r?\n/);
        expect(rows).toHaveLength(32);
        for (const row of rows) {
            const [title, state, cut] = row.split('|')[0].split(' ').map(Number);
            const events: string[] = [];
            let reads = 0;
            const values: Record<string, unknown> = { openUrlRequest: state < 0 ? null : { status: state === 0 ? 0 : 1, result: state === 2 ? {} : null }, pendingUrl: null, urlNewWindow: true };
            for (const [field, label] of Object.entries({ openUrlRequest: 'request', pendingUrl: 'address', urlNewWindow: 'window' })) {
                Object.defineProperty(Client, field, {
                    configurable: true,
                    get() {
                        events.push('get-' + label);
                        if (label === 'request' && ++reads === cut) values[field] = null;
                        return values[field];
                    },
                    set(value) {
                        events.push('set-' + label);
                        values[field] = value;
                    }
                });
            }
            GameShell.openUrl = () => {
                events.push('open');
            };
            let outcome = 'ok';
            try {
                Client.pollUrlRequest(title !== 0);
            } catch (error) {
                if (!(error instanceof TypeError)) throw error;
                outcome = 'null';
            }
            expect([title + ' ' + state + ' ' + cut, events.join(';'), outcome].join('|')).toBe(row);
        }
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}, 30000);
