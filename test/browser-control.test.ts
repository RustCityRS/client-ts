import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import JagString, { type JagStringApplet } from '#/datastruct/JagString.js';
import { utf8Bytes, utf8String } from '#/io/JavaText.js';
import Client from '#/client/Client.js';
import BrowserControl from '#/util/BrowserControl.js';
import { JavaError } from '#/util/ClientError.js';
import WrappedException from '#/util/WrappedException.js';
import { loginFixture } from './login-fixture.js';
import { gamepackPath } from './reference.js';

const token = {},
    failure = new Error('page callback failed'),
    fatal = new JavaError();
const text = (s: string | null) => (s === null ? '~' : Buffer.from(utf8Bytes(s)).toString('hex'));
function describe(result: unknown): string {
    if (result === null) return '~';
    if (result === token) return 'obj';
    if (result instanceof JagString) return 'j' + Buffer.from(result.toBytes()).toString('hex');
    return typeof result === 'string' ? 's' + text(result) : String(result);
}
function vectors(): string[] {
    const rows: string[] = [];
    const guards = { c: [-11594, -11593, 0], e: [-1, 12, 13, 43], C: [-119, -90, 8, 65, 55, -50], E: [-23731, -1] };
    for (const [op, values] of Object.entries(guards))
        for (const guard of values)
            for (const applet of [0, 1])
                for (let mode = 0; mode < 6; mode++) {
                    for (const [source, length] of [
                        ['61620063', 4],
                        ['c3a9eda08000', 6],
                        ['ff61', 1],
                        ['', 0],
                        ['01', 2],
                        ['01', -1],
                        ['~', 0]
                    ]) {
                        rows.push([op, guard, applet, mode, source, length].join(' '));
                    }
                }
    return rows;
}

function trace(line: string): string {
    const [op, g, a, m, h, n] = line.split(' '),
        guard = Number(g),
        value = new JagString();
    value.bytes = h === '~' ? null : Buffer.from(h, 'hex');
    value.length = Number(n);
    const str = value.bytes === null ? null : utf8String(value.bytes, 0, value.bytes.length);
    let log = '-',
        out = 'void';
    const result = () => {
        switch (Number(m)) {
            case 0:
                return null;
            case 1:
                return true;
            case 2:
                return token;
            case 3:
                return 'é\0\ud800🙂';
            case 4:
                throw failure;
            default:
                throw fatal;
        }
    };
    let applet: Pick<JagStringApplet, 'call' | 'evaluate'> | null;
    if (a === '0') {
        applet = null;
    } else {
        applet = {
            call(name: string | null) {
                log = 'c' + text(name) + (arguments.length === 1 ? '-' : '+' + (arguments.length - 1));
                return result();
            },
            evaluate(script: string | null) {
                log = 'e' + text(script);
                result();
            }
        };
    }
    try {
        if (op === 'c') out = describe(BrowserControl.call(guard, applet, str));
        if (op === 'e') BrowserControl.eval(guard, str, applet);
        if (op === 'C') out = describe(value.callScript(applet, guard));
        if (op === 'E') value.evaluateScript(applet, guard);
    } catch (e) {
        const ctx = e instanceof WrappedException ? ' ' + e.context : '';
        const cause = e instanceof WrappedException ? e.cause : e;
        if (cause === failure) out = 'host';
        else if (cause === fatal) out = 'fatal';
        else if (cause instanceof TypeError) out = 'null';
        else if (cause instanceof RangeError) out = cause.message.includes('/ by zero') ? 'divide' : 'bounds';
        else throw e;
        out += ctx;
    }
    return log + ' ' + out + ' ' + (value.bytes === null ? '~' : Buffer.from(value.bytes).toString('hex'));
}

loginFixture(
    import.meta.url,
    '530 LiveConnect native guards, argument strings, return identity, errors and browser dispatch match',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), '530-liveconnect-'));
        try {
            const asm = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED'];
            const compile = Bun.spawnSync(['javac', ...asm, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'ui/BrowserControlOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const cmd = ['java', ...asm, '-Dfile.encoding=UTF-8', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'BrowserControlOracle'];
            const instrument = Bun.spawnSync([...cmd, gamepackPath, dir]);
            expect(instrument.exitCode, instrument.stderr.toString()).toBe(0);
            const rows = vectors();
            const run = Bun.spawnSync(cmd, { stdin: Buffer.from(rows.join('\n') + '\n') });
            expect(run.exitCode, run.stderr.toString()).toBe(0);
            const expected = run.stdout.toString().trimEnd().split(/\r?\n/);
            expect(expected.length).toBe(rows.length);
            for (const [i, row] of rows.entries()) expect(trace(row), row).toBe(expected[i]);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }

        const page = {
            known() {
                expect(this).toBe(page);
                expect(arguments.length).toBe(0);
                return token;
            }
        };
        const saved = Object.getOwnPropertyDescriptor(globalThis, 'window');
        Object.defineProperty(globalThis, 'window', { value: page, configurable: true });
        try {
            const client = Object.create(Client.prototype) as Client;
            expect(BrowserControl.call(-11594, client, 'known')).toBe(token);
            expect(() => BrowserControl.call(-11594, client, 'missing')).toThrow(TypeError);
            const cookies: string[] = [];
            client.setCookie = value => {
                cookies.push(value);
            };
            BrowserControl.eval(43, 'document.cookie="a\\x62"', client);
            BrowserControl.eval(43, 'document.cookie="a";document.cookie="b"', client);
            expect(cookies).toEqual(['ab']);
        } finally {
            if (saved) Object.defineProperty(globalThis, 'window', saved);
            else Reflect.deleteProperty(globalThis, 'window');
        }
    },
    35000
);
