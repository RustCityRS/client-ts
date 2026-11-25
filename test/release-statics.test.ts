import { expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import Client from '#/client/Client.js';
import { JavaError, isStackOverflow } from '#/util/JavaException.js';
import WrappedException from '#/util/WrappedException.js';
import { loginFixture, javaRsaExponent, javaRsaModulus } from './login-fixture.js';
import { gamepackPath } from './reference.js';
import { hdGamepackPath, joglPath } from './render/hd-reference.js';

interface Binding {
    owner: string;
    property: string;
    type: object;
}

async function staticBindings(directory: string) {
    const fields = new Map<string, Binding[]>(),
        calls = new Map<string, Binding>();
    const classes = new Map<string, string>();
    // Bind the exact field descriptors on declarations in the canonical sources.
    // Physical TS storage sometimes differs from historical member-map names.
    for (const path of new Bun.Glob('**/*.ts').scanSync(directory)) {
        const absolute = resolve(directory, path),
            source = readFileSync(absolute, 'utf8');
        const file = ts.createSourceFile(absolute, source, ts.ScriptTarget.Latest, true);
        for (const decl of file.statements) {
            if (!ts.isClassDeclaration(decl) || !decl.name) continue;
            const name = decl.name.text;
            classes.set(name, absolute);
            let type: object | undefined;
            for (const node of decl.members) {
                if (!ts.canHaveModifiers(node) || !ts.getModifiers(node)?.some(m => m.kind === ts.SyntaxKind.StaticKeyword) || !node.name || !ts.isIdentifier(node.name)) continue;
                const prop = node.name.text;
                const comments = [...(ts.getLeadingCommentRanges(source, node.getFullStart()) ?? []), ...(ts.getTrailingCommentRanges(source, node.end) ?? [])].map(r => source.slice(r.pos, r.end)).join('\n');
                const fieldKeys = ts.isPropertyDeclaration(node) || ts.isGetAccessor(node) ? [...comments.matchAll(/(?<![\w.])([a-z]+\.\w+:(?:\[+(?:[IZBCDFJS]|L[\w/$]+;)|L[\w/$]+;))/g)].map(m => m[1]) : [];
                if (name === 'ClientKeyboardListener' && prop === 'm_keycodeMap' && node.getText().includes('// cf.m:[I')) fieldKeys.push('cf.m:[I');
                const call = ts.isMethodDeclaration(node) && (prop === 'unload' || prop === 'clear') ? /(?:^|\n)\/\/ (\w+\.\w+\(\)V)\b/.exec(comments)?.[1] : undefined;
                if (!fieldKeys.length && !call) continue;
                if (!type) {
                    const exports = await import(pathToFileURL(absolute).href);
                    type = exports[name] ?? exports.default;
                    if (!type) continue;
                }
                const binding = { owner: name, property: prop, type };
                if (call) calls.set(call, binding);
                for (const key of fieldKeys) {
                    if (!fields.has(key)) fields.set(key, []);
                    fields.get(key)?.push(binding);
                }
            }
        }
    }
    return { fields, calls, classes };
}

loginFixture(
    import.meta.url,
    'HD shutdown clears all 1,370 static references in JAR order through failures',
    async () => {
        const temp = mkdtempSync(join(tmpdir(), 'rs530-hd-static-shutdown-'));
        try {
            const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
            const compile = Bun.spawnSync(['javac', asm, '-d', temp, join(import.meta.dir, 'game/ReleaseStaticsOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const input = readFileSync(resolve(import.meta.dir, 'game/shutdown-bindings.tsv'), 'utf8')
                .trimEnd()
                .split('\n')
                .slice(1)
                .map(line => line.replace(/\r$/, '').split('\t'));
            const { fields, classes } = await staticBindings(resolve(import.meta.dir, '../src'));
            const owners = readFileSync(resolve(import.meta.dir, 'game/shutdown-owners.tsv'), 'utf8')
                .trimEnd()
                .split(/\r?\n/)
                .slice(1)
                .map(line => line.split('\t'));
            expect(owners.map(row => row[0])).toEqual([...new Set(input.map(row => row[0]))]);
            const methods: Record<string, string> = {};
            for (const [native, status, , , file, owner, method] of owners) {
                if (status !== 'dedicated') continue;
                classes.set(owner, resolve(import.meta.dir, '..', file));
                methods[native] = owner + '.' + method;
            }
            expect(input).toHaveLength(1370);
            expect(new Set(input.map(row => row[1])).size).toBe(1370);
            expect(new Set(input.map(row => row[3])).size).toBe(1370);
            const client = new Client();
            let events: string[] = [],
                stop = '',
                runtime = false;
            const interrupted = new JavaError('shutdown observation');
            function observe(name: string): void {
                events.push(name);
                if (name === stop) {
                    if (runtime) throw new TypeError('shutdown observation');
                    throw interrupted;
                }
            }
            async function binding(target: string): Promise<Binding> {
                const [owner, property] = target.split('.');
                const file = classes.get(owner);
                if (!file) throw new Error('Missing class ' + owner);
                const exports = await import(pathToFileURL(file).href);
                return { owner, property, type: exports[owner] ?? exports.default };
            }
            for (const [, hd, sd, target] of input) {
                if (!target) throw new Error('Missing HD shutdown binding for ' + hd);
                const storage = sd ? fields.get(sd)?.[0] : await binding(target);
                if (!storage) throw new Error('Missing static ' + hd);
                expect(storage.owner + '.' + storage.property).toBe(target);
                const { type, property } = storage;
                const descriptor = Object.getOwnPropertyDescriptor(type, property);
                if (!descriptor) throw new Error(target + ' is absent');
                let value = descriptor.value;
                Object.defineProperty(type, property, {
                    configurable: true,
                    get: descriptor.get ?? (() => value),
                    set(next: unknown) {
                        if (descriptor.set) descriptor.set.call(type, next);
                        else value = next;
                        observe((next === null ? 'null ' : 'set ') + hd);
                    }
                });
            }
            const primitive = readFileSync(resolve(import.meta.dir, 'game/shutdown-guard-fields.tsv'), 'utf8')
                .trimEnd()
                .split(/\r?\n/)
                .slice(1)
                .map(line => line.split('\t'));
            for (const [, hd, target] of primitive) {
                const { type, property } = await binding(target);
                const descriptor = Object.getOwnPropertyDescriptor(type, property);
                if (!descriptor) throw new Error('Missing primitive ' + target);
                let value = descriptor.value;
                Object.defineProperty(type, property, {
                    configurable: true,
                    get: descriptor.get ?? (() => value),
                    set(next: number | boolean) {
                        if (descriptor.set) descriptor.set.call(type, next);
                        else value = next;
                        observe('primitive ' + hd + ' ' + Number(next));
                    }
                });
            }
            for (const [native, target] of Object.entries(methods)) {
                const { type, property } = await binding(target);
                const original = Reflect.get(type, property);
                Object.defineProperty(type, property, {
                    configurable: true,
                    value: (...args: unknown[]) => {
                        observe('call ' + native);
                        return Reflect.apply(original, type, args);
                    }
                });
            }
            let complete: string[] = [];
            for (const boundary of ['null client.lb:[I', 'call tf.k()V', 'call gb.d()V', 'null jf.b:[F', 'call lm.d()V', 'null ib.i:[Lod;', 'call pd.e()V', 'null kc.p:[I', '']) {
                stop = boundary;
                runtime = stop === 'call lm.d()V';
                const result = Bun.spawnSync(['java', '-Djava.awt.headless=true', asm, '-cp', temp + delimiter + joglPath, 'ReleaseStaticsOracle', hdGamepackPath, boundary, runtime ? 'runtime' : 'error', 'hd']);
                expect(result.exitCode, result.stderr.toString()).toBe(0);
                const all = result.stdout.toString().trimEnd().split(/\r?\n/);
                if (!stop) {
                    const groups = new Set(input.map(row => row[0]));
                    expect(groups.size).toBe(278);
                    expect(all.filter(event => event.startsWith('call '))).toEqual([...groups].map(method => 'call ' + method));
                    let group = '';
                    const fieldsWithCaller: string[] = [];
                    for (const event of all) {
                        if (event.startsWith('call ')) group = event.slice(5);
                        else fieldsWithCaller.push(group + ' ' + event);
                    }
                    expect(fieldsWithCaller).toEqual(input.map(row => row[0] + ' null ' + row[1]));
                }
                const expected = all.filter(event => !event.startsWith('call ') || event.slice(5) in methods);
                events = [];
                try {
                    client['releaseStatics']();
                    if (stop) throw new Error('Missed ' + stop);
                } catch (error) {
                    if (runtime && error instanceof WrappedException) events.push('wrapped ' + error.context);
                    else if (error !== interrupted) throw error;
                }
                expect(events, boundary).toEqual(expected);
                if (!stop) complete = expected;
            }
            const failures = Bun.spawnSync(['java', '-Djava.awt.headless=true', asm, '-cp', temp + delimiter + joglPath, 'ReleaseStaticsOracle', hdGamepackPath, 'all-runtime', 'runtime', 'hd']);
            expect(failures.exitCode, failures.stderr.toString()).toBe(0);
            const contexts = failures.stdout
                .toString()
                .trimEnd()
                .split(/\r?\n/)
                .map(line => line.split('\t'));
            expect(contexts.map(row => row[0])).toEqual(complete.filter(event => event.startsWith('null ')));
            runtime = true;
            for (const [boundary, wrapped] of contexts) {
                events = [];
                stop = boundary;
                try {
                    client['releaseStatics']();
                    throw new Error('Missed ' + stop);
                } catch (error) {
                    if (!(error instanceof WrappedException)) throw error;
                    expect('wrapped ' + error.context, stop).toBe(wrapped);
                }
                const end = complete.indexOf(stop) + 1;
                expect(events.length, stop).toBe(end);
                expect(
                    events.every((event, i) => event === complete[i]),
                    stop
                ).toBe(true);
            }
            const callees = readFileSync(resolve(import.meta.dir, 'game/shutdown-guard-calls.tsv'), 'utf8')
                .trimEnd()
                .split(/\r?\n/)
                .slice(1)
                .map(line => line.split('\t'));
            const dependencies = new Map<string, string>();
            let watching = '';
            for (const [caller, , callee, , target] of callees) {
                if (!target || callee === caller) continue;
                dependencies.set(caller, callee);
                const { type, property } = await binding(target);
                const original = Reflect.get(type, property);
                Object.defineProperty(type, property, {
                    configurable: true,
                    value: (...args: unknown[]) => {
                        if (watching === callee) observe('invoke ' + callee);
                        return Reflect.apply(original, type, args);
                    }
                });
            }
            const guarded = owners.flatMap(row => (row[11] ? row[11].split(',').map(arg => row[0] + '\t' + arg) : []));
            const inputs = [...input, ...primitive].map(row => 'observe\t' + row[1]);
            inputs.push(...guarded.map(row => row + '\t' + (dependencies.get(row.split('\t', 1)[0]) ?? '')));
            const helpers = Bun.spawnSync(['java', '-Xss256k', '-Djava.awt.headless=true', asm, '-cp', temp + delimiter + joglPath, 'ReleaseStaticsOracle', hdGamepackPath, 'helpers', 'runtime', 'hd'], {
                stdin: Buffer.from(inputs.join('\n') + '\n')
            });
            expect(helpers.exitCode, helpers.stderr.toString()).toBe(0);
            const direct = helpers.stdout
                .toString()
                .trimEnd()
                .split(/\r?\n/)
                .map(line => line.split('\t'));
            expect(direct.map(([method, arg]) => method + '\t' + arg)).toEqual(guarded);
            runtime = false;
            stop = '';
            for (const [native, value, ...expected] of direct) {
                const arg = native.endsWith('(Z)V') ? value === 'true' : Number(value);
                const { type, property } = await binding(methods[native]);
                watching = dependencies.get(native) ?? '';
                events = [];
                let overflow = false;
                try {
                    Reflect.apply(Reflect.get(type, property), type, [arg]);
                } catch (error) {
                    if (isStackOverflow(error)) overflow = true;
                    else if (error instanceof WrappedException) events.push('wrapped ' + error.context);
                    else throw error;
                }
                expect(overflow, native + ' ' + arg).toBe(expected[0] === 'stack overflow');
                if (overflow) {
                    const period = expected.slice(1);
                    expect(events.length).toBeGreaterThanOrEqual(2 * period.length);
                    expect(
                        events.every((event, i) => event === period[i % period.length]),
                        native + ' ' + arg
                    ).toBe(true);
                } else {
                    expect(events, native + ' ' + arg).toEqual(expected);
                }
            }
            // Every reference shared with the SD gamepack must also be null after HD shutdown.
            const sdTrace = Bun.spawnSync(['java', '-Djava.awt.headless=true', asm, '-cp', temp, 'ReleaseStaticsOracle', gamepackPath]);
            expect(sdTrace.exitCode, sdTrace.stderr.toString()).toBe(0);
            for (const name of sdTrace.stdout.toString().trimEnd().split(/\r?\n/)) {
                if (!name.startsWith('null ')) continue;
                const entry = fields.get(name.slice(5))?.[0];
                if (!entry) throw new Error('Missing SD static ' + name);
                expect(Reflect.get(entry.type, entry.property), name).toBeNull();
            }
        } finally {
            rmSync(temp, { recursive: true, force: true });
        }
    },
    90000,
    'gl'
);

loginFixture(
    import.meta.url,
    'native shutdown calls the unloads and clears the 530 gamepack static references in order',
    async () => {
        const temp = mkdtempSync(join(tmpdir(), 'rs530-static-shutdown-'));
        try {
            const asm = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED'];
            const compile = Bun.spawnSync(['javac', ...asm, '-d', temp, join(import.meta.dir, 'game/ReleaseStaticsOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            function oracle(stop: string, runtime = false) {
                const proc = Bun.spawnSync(['java', '-Djava.awt.headless=true', ...asm, '-cp', temp, 'ReleaseStaticsOracle', gamepackPath, stop, ...(runtime ? ['runtime'] : [])]);
                expect(proc.exitCode, proc.stderr.toString()).toBe(0);
                return proc.stdout.toString().trimEnd().split(/\r?\n/);
            }
            const original = oracle('');
            const keys = original.filter(s => s.startsWith('null ')).map(s => s.slice(5));
            expect(new Set(keys).size).toBe(1294);
            expect(original.filter(s => s.startsWith('call '))).toHaveLength(253);
            const { fields, calls } = await staticBindings(resolve(import.meta.dir, '../src'));
            const client = new Client();
            let events: string[] = [],
                stop = '';
            const interrupted = new JavaError('shutdown observation');
            let runtime = false;
            function observe(event: string) {
                events.push(event);
                if (event === stop) throw runtime ? new Error('observed') : interrupted;
            }
            const storages: [string, Binding][] = [];
            for (const key of keys) {
                const found = fields.get(key);
                expect(
                    found?.map(b => b.owner + '.' + b.property),
                    key
                ).toHaveLength(1);
                const field = found?.[0];
                if (!field) throw new Error(key);
                const { type, property } = field;
                const previous = Object.getOwnPropertyDescriptor(type, property);
                if (!previous) throw new Error(key + ' missing ' + field.owner + '.' + property);
                storages.push([key, field]);
                let current = previous.value;
                Object.defineProperty(type, property, {
                    configurable: true,
                    get: previous.get ?? (() => current),
                    set(value: unknown) {
                        if (previous.set) previous.set.call(type, value);
                        else current = value;
                        observe((value === null ? 'null ' : 'set ') + key);
                    }
                });
            }
            const handledCalls = new Set<string>();
            for (const event of original.filter(s => s.startsWith('call '))) {
                const method = calls.get(event.slice(5));
                if (!method) continue;
                handledCalls.add(event);
                const native = Reflect.get(method.type, method.property);
                Object.defineProperty(method.type, method.property, {
                    value: function () {
                        observe(event);
                        return Reflect.apply(native, method.type, []);
                    }
                });
            }
            expect(handledCalls.size).toBe(15);
            for (const boundary of ['null client.sb:Lid;', 'null oh.g:[[B', 'call fc.m()V', 'call cb.l()V', 'null el.a:[B', 'null gi.t:Lnc;', '']) {
                stop = boundary;
                runtime = stop === 'call cb.l()V' || stop === 'null oh.g:[[B';
                events = [];
                try {
                    client['releaseStatics']();
                    if (stop) throw new Error('Missed ' + stop);
                } catch (err) {
                    if (runtime && err instanceof WrappedException) events.push('wrapped ' + err.context);
                    else if (err !== interrupted) throw err;
                }
                const expected = (stop ? oracle(stop, runtime) : original).filter(event => event.startsWith('null ') || event.startsWith('wrapped ') || handledCalls.has(event));
                expect(events.length, stop).toBe(expected.length);
                for (let i = 0; i < expected.length; i++) expect(events[i], stop + ' at ' + i).toBe(expected[i]);
            }
            for (const [key, b] of storages) expect(Reflect.get(b.type, b.property), key).toBeNull();
            const { default: PixScreen } = await import('#/graphics/PixScreen.js');
            const guards = [1000, 0, -1];
            const helpers = Bun.spawnSync(['java', '-Djava.awt.headless=true', ...asm, '-cp', temp, 'ReleaseStaticsOracle', gamepackPath, 'helpers'], {
                stdin: Buffer.from(guards.map(guard => 'oh.a(I)V\t' + guard).join('\n') + '\n')
            });
            expect(helpers.exitCode, helpers.stderr.toString()).toBe(0);
            const helperRows = helpers.stdout.toString().trimEnd().split(/\r?\n/);
            expect(helperRows).toHaveLength(guards.length);
            for (const [i, guard] of guards.entries()) {
                events = [];
                PixScreen.unload(guard);
                expect(events).toEqual(
                    helperRows[i]
                        .split('\t')
                        .slice(2)
                        .filter(event => event.startsWith('null '))
                );
            }
        } finally {
            rmSync(temp, { recursive: true, force: true });
        }
    },
    30000
);

test('startup captures the default and environment-supplied RSA keys before either the applet or login runs', () => {
    const here = resolve(import.meta.dir, '..');
    for (const external of [false, true]) {
        const env = { ...process.env };
        if (external) {
            env.LOGIN_RSAE = '65537';
            env.LOGIN_RSAN = '257';
        } else {
            delete env.LOGIN_RSAE;
            delete env.LOGIN_RSAN;
        }
        const proc = Bun.spawnSync(
            [
                process.execPath,
                '-e',
                `
            const {default:Client}=await import('./src/client/Client.ts');
            const {default:Login}=await import('./src/io/Login.ts');
            console.log(Client.rsaExponent+' '+Login.rsaModulus);
        `
            ],
            { env, cwd: here }
        );
        expect(proc.exitCode, proc.stderr.toString()).toBe(0);
        expect(proc.stdout.toString().trim()).toBe(external ? '65537 257' : javaRsaExponent + ' ' + javaRsaModulus);
    }
});
