import PixfontGeneric from '#/graphics/PixfontGeneric.js';
import WrappedException from '#/util/WrappedException.js';
import { gamepackPath } from './reference.js';
import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import JagString, { fromJsString, fromLiteral, toJsString } from '../src/datastruct/JagString.js';
import { ClientScript } from '../src/script/ClientScript.js';
import HookReq from '../src/script/HookReq.js';
import ScriptRunner from '../src/script/ScriptRunner.js';

type Input = [Uint8Array | null, number];
function make(input: Input): JagString {
    const s = new JagString();
    s.bytes = input[0]?.slice() ?? null;
    s.length = input[1];
    return s;
}
function bytes(data: Uint8Array | null): string {
    return data === null ? '~' : data.length === 0 ? '-' : Buffer.from(data).toString('base64');
}
function describe(s: JagString): string {
    return [bytes(s.bytes), s.length, s['mutable']].join('/');
}
function result(value: unknown, s: JagString, other: JagString): string {
    if (value instanceof JagString) return (value === s ? 'self' : value === other ? 'other' : 'new') + ':' + describe(value);
    if (Array.isArray(value)) return value.map(x => result(x, s, other) + ';').join('');
    if (value instanceof Uint8Array) return bytes(value);
    return String(value);
}
function run(op: string, s: JagString, o: JagString, a: number, b: number): unknown {
    switch (op) {
        case 'split':
            return s.split(a);
        case 'reverse':
            return s.reverse();
        case 'char':
            return s.charAt(a);
        case 'name':
            return s.formatName(a);
        case 'base':
            return s.toBase37();
        case 'normalize':
            return s.normalizeName();
        case 'sub':
            return s.substring(a, b);
        case 'from':
            return s.substringFrom(a);
        case 'hash':
            return s.longHashCode();
        case 'hash32':
            return s.hashCode();
        case 'objectHash':
            return s.objectHashCode();
        case 'parse':
            return s.parseInt(a);
        case 'integer':
            return s['isInteger'](a);
        case 'decimal':
            return s.decimal();
        case 'isDecimal':
            return s.isDecimal();
        case 'replace':
            return s.replace(o, s);
        case 'range':
            return s.appendRange(a, o, b);
        case 'as':
            return s.asString();
        case 'find':
            return s.indexOf(o);
        case 'findFrom':
            return s.indexOfFrom(o, a);
        case 'trim':
            return s.trim();
        case 'ends':
            return s.endsWith(o);
        case 'copy':
            return s.toBytes();
        case 'equals':
            return s.equals(o);
        case 'objectEquals':
            return s.equalsObject(o);
        case 'string':
            return s.toString();
        case 'tighten':
            return s.trimToLength();
        case 'with':
            return s.withChar(a);
        case 'sentence':
            return s.sentenceCase();
        case 'lower':
            return s.toLowerCase();
        case 'equalsCase':
            return s.equalsIgnoreCase(o);
        case 'findChar':
            return s.indexOfChar(a, b);
        case 'startsCase':
            return s.startsWithIgnoreCase(o);
        case 'starts':
            return s.startsWith(o);
        case 'collate':
            return s.compareCollated(o);
        case 'compare':
            return s.compare(o);
        case 'appendChar':
            return s.appendChar(a);
        case 'resize':
            s.setLength(a);
            return null;
        case 'append':
            return s.append(o);
        case 'appendSelf':
            return s.append(s);
        case 'intern':
            return s.intern();
        case 'join':
            return JagString.joinRange(3, [s, null, o], 0);
        case 'format':
            return JagString.formatInteger(a < 0, 0, b, Math.abs(a));
        case 'number':
            return JagString.formatNumber(BigInt(b), a & 3, Math.abs(a) % 5, a >= 0);
        case 'escape':
            return PixfontGeneric.escape(s);
        case 'url':
            return bytes(new TextEncoder().encode(s.toUrl().toString()));
        case 'resolveUrl':
            return bytes(new TextEncoder().encode(s.resolveUrl(o.toUrl()).toString()));
        case 'date': {
            const code = new ClientScript();
            code.opcodes = Int32Array.of(0, 4104, 21);
            code.intOperands = Int32Array.of(a, 0, 0);
            const event = new HookReq();
            event.args = [0];
            new ScriptRunner(
                () => code,
                error => {
                    throw error;
                }
            ).run(event);
            const text = ScriptRunner.stringStack[0];
            return text === null ? null : toJsString(text);
        }
        default:
            throw new Error(op);
    }
}

test('JagString results, unused capacity, interning and mutation on failure agree with the JAR', () => {
    const input = (s: string): Input => [Uint8Array.from(s, c => c.charCodeAt(0)), s.length];
    const empty = input('');
    const octets: Input = [Uint8Array.from({ length: 256 }, (_, i) => i), 256];
    const cases: Input[] = [empty, input('  hELLO. Àç!ß ÿ?X'), input('Codex_a__9'), input('AaBB'), input('BBAa'), input('\xa0\t<>abc<\xa0'), [Uint8Array.of(65, 66, 67, 68, 69), 2], octets];
    const commands: string[] = [],
        expected: string[] = [];
    function record(op: string, src = empty, rhs = empty, a = 0, b = 0, mutable = true) {
        const s = make(src),
            o = make(rhs);
        s['mutable'] = mutable;
        commands.push([op, bytes(s.bytes), s.length, bytes(o.bytes), o.length, Number(mutable), a, b].join(' '));
        let value: string;
        try {
            value = result(run(op, s, o, a, b), s, o);
        } catch (error) {
            if (op === 'string') {
                if (!(error instanceof WrappedException) || error.cause?.constructor !== Error || error.cause.message !== '') throw error;
                value = String(error.context);
            } else value = 'exception';
        }
        expected.push(value + '|' + describe(s));
    }
    for (const url of [
        'http://WORLD:80',
        'unknown:123',
        'data:text/plain,x',
        'http:x',
        'http:',
        'ftp://a',
        'file:///a/b',
        'file:/C:\\x\\y',
        'file:////host/share',
        'jar:file:/tmp/x.jar!/a',
        'jar:file:/tmp/x.jar',
        'jar:jar:file:/outer.jar!/inner.jar!/x',
        'mailto:',
        'mailto:abc@x?subject=abc#ref',
        'jrt:/java.base/java/lang',
        'jmod:/x!/y',
        ' Url:HTTP://MiXeD:65536/a/../b%20c#d ',
        'http://[::1]:65538/a',
        'http://[fe80::1%eth0]/a',
        'http://[1:2:/]',
        'http://a@b@c/a',
        'http://a b/q',
        'https://name/white space',
        'http://a\\b/x',
        'http://a{b}/x',
        'http://a|b/x',
        'http://user:pw@name:07000/a?b#c'
    ])
        record('url', input(url));
    for (const port of ['', '65535', '65536', '72535', '2147483647', '2147483648', '+82000', '-1', '-2', 'x', '15x']) {
        record('url', input('http://world:' + port + '/l=0/a=0/j0,o1,a2,m0'));
    }
    for (const base of ['http://World:80/a/b?q#ref', 'http://x', 'http:abc', 'file:/C:/a/b', 'jar:file:/a.jar!/dir/file']) {
        for (const ref of ['', 'x', '.', '..', '../../../../../x', './x/../y', './/x', '/./x/../y', '//World:70000/path', '#x', '?q', '?q#r', '/../a?a#b', 'http:x', 'http://Name:443/x', 'mailto:one@two', 'jar:file:/b.jar!/c']) {
            record('resolveUrl', input(ref), input(base));
        }
    }
    for (const src of cases) {
        for (const op of ['reverse', 'base', 'normalize', 'hash', 'hash32', 'objectHash', 'as', 'trim', 'copy', 'string', 'tighten', 'sentence', 'lower', 'escape']) record(op, src);
        for (const rhs of cases) {
            for (const op of ['find', 'ends', 'equals', 'objectEquals', 'equalsCase', 'startsCase', 'starts', 'collate', 'compare', 'append', 'join']) record(op, src, rhs);
            for (const start of [-1, 0, 1, src[1] + 2]) record('findFrom', src, rhs, start);
        }
        for (const n of [-128, -1, 0, 1, 32, 127, 128, 159, 255, 256]) {
            for (const op of ['split', 'with', 'appendChar', 'char']) record(op, src, empty, n);
            record('findChar', src, empty, n, -1);
            record('findChar', src, empty, n, 0);
        }
        for (const n of [-2, 0, 1, 3, src[1], src[1] + 1]) {
            for (const op of ['name', 'from', 'resize']) record(op, src, empty, n);
            for (const end of [-1, 0, 2, src[1]]) {
                record('sub', src, empty, n, end);
                record('range', src, src, n, end);
            }
        }
        record('appendSelf', src);
        for (const op of ['resize', 'append', 'range', 'tighten', 'appendChar']) record(op, src, cases[1], 1, 2, false);
    }
    for (const s of ['', '-', '+', '0', '+00', '-2147483648', '2147483648', '-2147483649', 'z', '-7fffffff', '7FFFFFFF', '01012', '1 0']) {
        for (const radix of [-1, 0, 1, 2, 8, 10, 16, 36, 37]) {
            for (const op of ['parse', 'integer', 'decimal', 'isDecimal']) record(op, input(s), empty, radix);
        }
    }
    for (const n of [-2147483648, -1, 0, 1, 18742, 2147483647]) {
        for (const a of [-36, -16, -10, 0, 1, 2, 4, 10, 16, 36, 37]) {
            record('format', empty, empty, a, n);
            record('number', empty, empty, a, n);
        }
    }
    for (const n of [-2147483648, -1500000, -153175, -153174, -11745, -1, 0, 1, 21000, 2147483647]) record('date', empty, empty, n);
    const collision = [input('codex-Aa-x'), input('codex-BB-x')];
    for (const src of [...collision, ...collision]) record('intern', src);
    record('replace', input('abbaab'), input('ab'));
    for (const invalid of [
        [null, 0],
        [null, 3],
        [Uint8Array.of(7), 4]
    ] as Input[]) {
        for (const op of ['equals', 'equalsCase', 'base', 'sub', 'tighten', 'copy', 'reverse', 'appendChar', 'trim', 'hash', 'starts']) record(op, invalid, cases[1], 1, 3);
    }
    const dir = mkdtempSync(join(tmpdir(), 'string530-'));
    try {
        const jar = gamepackPath;
        const source = fileURLToPath(new URL('./io/JagStringOracle.java', import.meta.url));
        const compile = Bun.spawnSync(['javac', '-cp', jar, '-d', dir, source], { timeout: 15000 });
        expect(compile.stderr.toString()).toBe('');
        expect(compile.exitCode).toBe(0);
        const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-Duser.timezone=' + zone, '-cp', dir + delimiter + jar, 'JagStringOracle'], { stdin: Buffer.from(commands.join('\n')), maxBuffer: 16 * 1024 * 1024, timeout: 30000 });
        expect(java.stderr.toString()).toBe('');
        expect(java.exitCode).toBe(0);
        const records = java.stdout.toString().trimEnd().split(/\r?\n/);
        expect(records.length).toBe(commands.length);
        expected.forEach((value, i) => expect(value, commands[i]).toBe(records[i]));
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}, 40000);

test('host metrics draw ISO-8859-1 text and applet calls cross the JVM charset boundary', () => {
    const s = fromJsString('a\0\x80\xff');
    expect(s.measure({ stringWidth: text => text.charCodeAt(1) })).toBe(128);
    const invalid = make([Uint8Array.of(1), 2]);
    expect(() => invalid.measure(null)).toThrow(RangeError);
    expect(() => invalid.draw(0, null, 0)).toThrow(RangeError);
    let drawn: unknown;
    s.draw(
        10,
        {
            drawString: (text, x, y) => {
                drawn = [text, x, y];
            }
        },
        15
    );
    expect(drawn).toEqual(['a\x80\xff', 10, 15]);
    const applet = {
        getParameter: (k: string) => (k === 'lang' ? 'Français' : null),
        call: (k: string) => (k === 'callback' ? 'é\0' : 7),
        evaluate: (value: string) => {
            drawn = value;
        }
    };
    expect((fromLiteral('callback').callScript(applet) as JagString).toBytes()).toEqual(Uint8Array.of(195, 169));
    expect(fromLiteral('lang').getParameter(applet)?.toBytes()).toEqual(fromJsString('Français').toBytes());
    fromLiteral('sample').evaluateScript(applet);
    expect(drawn).toBe('sample');
});
