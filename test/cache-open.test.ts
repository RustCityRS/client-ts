import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { gamepackPath } from './reference.js';

test('client.b, ra.a, and client.c transfer cache handles, open JS5 and release partial caches in JAR order', () => {
    const work = mkdtempSync(join(import.meta.dir, '../out/cache-open-'));
    try {
        function run(command: string, args: string[]): string {
            const child = spawnSync(command, args, { encoding: 'utf8', timeout: 30000 });
            if (child.error || child.status !== 0) throw new Error(child.stderr || child.error?.message || 'Exit ' + child.status);
            return child.stdout.replaceAll('\r\n', '\n').trimEnd();
        }
        run('javac', ['-cp', gamepackPath, '-d', work, join(import.meta.dir, 'cache/OpenJs5Oracle.java')]);
        const java = run('java', ['-Djava.awt.headless=true', '-cp', work + delimiter + gamepackPath, 'OpenJs5Oracle', work]).split('\n');
        const ts = run(process.execPath, [join(import.meta.dir, 'cache/OpenJs5Fixture.ts')]).split('\n');
        expect(ts.length).toBe(java.length);
        for (let i = 0; i < java.length; i++) expect(ts[i]).toBe(java[i]);
    } finally {
        rmSync(work, { recursive: true, force: true });
    }
}, 60000);
