import { expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gamepackPath } from './reference.js';

type Counts = Record<'if' | 'im' | 'sf' | 'sm' | 'ctors', number>;

test('erased instance finalizers only increment unobserved JAR counters; their source comments do not count as ports', async () => {
    const root = join(import.meta.dir, '..');
    interface ClassEntry {
        obf: string;
        tsPath: string;
        members: Counts;
        portedCoverage: string | null;
        erasedInstanceMethods?: { signature: string; counter: string; callsObjectFinalize?: boolean }[];
    }
    const classes: ClassEntry[] = JSON.parse(readFileSync(join(root, 'test/maps/classmap.json'), 'utf8')).classes;
    const counters: string[] = JSON.parse(readFileSync(join(root, 'test/maps/membermap.json'), 'utf8')).artifacts.counters;
    const checked = Bun.spawnSync([process.execPath, join(import.meta.dir, 'maps/publish-classes.ts'), '--check']);
    expect(checked.exitCode, checked.stderr.toString()).toBe(0);
    const observed = Bun.spawnSync([
        'java',
        '--add-exports',
        'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED',
        '--add-exports',
        'java.base/jdk.internal.org.objectweb.asm.tree=ALL-UNNAMED',
        '-cp',
        gamepackPath,
        join(import.meta.dir, 'game/CounterFinalizersOracle.java'),
        gamepackPath
    ]);
    expect(observed.exitCode, observed.stderr.toString()).toBe(0);
    const erased: string[] = [];
    for (const row of classes) {
        const count = row.members.if + row.members.im + row.members.ctors;
        const citations = row.portedCoverage === null ? 0 : Number(row.portedCoverage.split('/')[0]);
        if (!row.erasedInstanceMethods) continue;
        const native = (await import(pathToFileURL(join(root, row.tsPath)).href)).default;
        for (const { signature, counter, callsObjectFinalize = false } of row.erasedInstanceMethods) {
            expect(counters).toContain(row.obf + '.' + counter.split(':')[0]);
            expect(signature.split('(')[0] in native.prototype).toBe(false);
            erased.push([row.obf, signature, counter, callsObjectFinalize].join(' '));
        }
        expect(citations + row.erasedInstanceMethods.length).toBeLessThanOrEqual(count);
    }
    expect(erased.toSorted()).toEqual(observed.stdout.toString().trimEnd().split(/\r?\n/).toSorted());
});

test('both maps account for every class, field, method and constructor in the original jar', () => {
    const maps = join(import.meta.dir, 'maps');
    const classes: { classes: { obf: string; members: Counts }[] } = JSON.parse(readFileSync(join(maps, 'classmap.json'), 'utf8'));
    const members: { statics: { owner: string; member: string }[]; artifacts: { counters: string[]; unload: string[] } } = JSON.parse(readFileSync(join(maps, 'membermap.json'), 'utf8'));
    const mapped = classes.classes.map(c => c.obf);
    for (const item of members.statics) mapped.push(item.owner + ' ' + item.member);
    for (const field of members.artifacts.counters) mapped.push(field.replace('.', ' field ') + ':I');
    for (const method of members.artifacts.unload) mapped.push(method.replace('.', ' method '));
    const scratch = mkdtempSync(join(tmpdir(), 'rs530-classmap-'));
    try {
        const compile = Bun.spawnSync(['javac', '-d', scratch, join(import.meta.dir, 'game', 'PortMapOracle.java')]);
        expect(compile.exitCode, compile.stderr.toString()).toBe(0);
        const counts = new Map<string, Counts>();
        for (const kind of ['static', 'instance']) {
            const original = Bun.spawnSync(['java', '-cp', scratch + delimiter + gamepackPath, 'PortMapOracle', gamepackPath, kind]);
            expect(original.exitCode, original.stderr.toString()).toBe(0);
            const rows = original.stdout.toString().trimEnd().split(/\r?\n/);
            if (kind === 'static') expect(mapped.sort()).toEqual(rows.toSorted());
            for (const row of rows) {
                const [owner, member, signature] = row.split(' ');
                if (member === undefined) {
                    if (!counts.has(owner)) counts.set(owner, { if: 0, im: 0, sf: 0, sm: 0, ctors: 0 });
                    continue;
                }
                const c = counts.get(owner);
                if (!c) throw new Error(owner);
                if (kind === 'static') c[member === 'field' ? 'sf' : 'sm']++;
                else if (member === 'field') c.if++;
                else if (signature.startsWith('<init>(')) c.ctors++;
                else c.im++;
            }
        }
        for (const c of classes.classes) expect(counts.get(c.obf), c.obf).toEqual(c.members);
    } finally {
        rmSync(scratch, { recursive: true, force: true });
    }
});
