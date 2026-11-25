import { readPacketBody } from './packet-body-fixture.js';
import { setLocalWorld, saveWorldConnection } from './world-connection.js';
import { expect, test } from 'bun:test';
import { parse } from 'acorn';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { delimiter, resolve } from 'node:path';
import Client from '#/client/Client.js';
import GameShell from '#/client/GameShell.js';
import JagString, { fromJsString } from '#/datastruct/JagString.js';
import JavaUrl from '#/io/JavaUrl.js';
import SafeTime from '#/io/SafeTime.js';
import PacketT from '#/io/PacketT.js';
import SuperPacket from '#/io/SuperPacket.js';
import CookieStatics from '#/util/CookieStatics.js';
import JavaCalendar from '#/util/JavaCalendar.js';
import { arrayAt, requireNonNull } from '#/util/JavaArray.js';
import Signlink from '#/util/Signlink.js';
import type SignlinkRequest from '#/util/SignlinkRequest.js';
import { gamepackPath } from './reference.js';

// Parse the exact script supplied by the JAR's gi.a to the browser. The fixture
// compares the assigned string, and never executes the applet's script.
function referenceCookie(source: string): string | null {
    if (source === '~') return null;
    try {
        const body = parse(source, { ecmaVersion: 3 }).body;
        const statement = body[0];
        if (body.length !== 1 || statement.type !== 'ExpressionStatement') return null;
        const expr = statement.expression;
        if (
            expr.type !== 'AssignmentExpression' ||
            expr.operator !== '=' ||
            expr.left.type !== 'MemberExpression' ||
            expr.left.computed ||
            expr.left.object.type !== 'Identifier' ||
            expr.left.object.name !== 'document' ||
            expr.left.property.type !== 'Identifier' ||
            expr.left.property.name !== 'cookie' ||
            expr.right.type !== 'Literal'
        )
            return null;
        return typeof expr.right.value === 'string' ? expr.right.value : null;
    } catch (error) {
        if (error instanceof SyntaxError) return null;
        throw error;
    }
}

test('rg hint arrows, applet settings, URL routing and GMT cookie dates match the original gamepack', async () => {
    const saved = {
        settings: Client.settings,
        arrows: Client.hintArrows.slice(),
        icons: Client.hintHeadicons,
        frame: GameShell.frame,
        shell: GameShell.m_activeShell,
        link: GameShell.signlink,
        world: saveWorldConnection(),
        platform: Signlink.platform,
        os: Signlink.osNameLower,
        ie6: Client.haveIe6,
        request: Client.openUrlRequest,
        url: Client.pendingUrl,
        newWindow: Client.urlNewWindow,
        clock: SafeTime.CurrentTimeMillis,
        gmtCalendar: CookieStatics.gmtCalendar
    };
    const commands: string[] = [];
    for (let i = 0; i < 320; i++) {
        const p = new PacketT(9);
        p.p1(((i % 4) << 6) | ((i >> 2) % 17));
        p.p1((i * 17) % 7);
        p.p2(i % 5 === 0 ? 65535 : i * 14821);
        p.p2(i * 113);
        p.p1(i * 19);
        p.p2(i % 3 === 0 ? 65535 : i * 5234);
        commands.push('hint ' + [0, 1, 4, 6, 10][(i >> 3) % 5] + ' ' + Buffer.from(requireNonNull(p.m_data)).toString('hex'));
    }
    for (const v of [-9223372036854775808n, -9223372036854775807n, -1495240012345522n, -12219292800001n, -12219292800000n, -1n, 0n, 1n, 951782400000n, 1078102800000n, 94608000000n, 9223372036854775807n]) commands.push('date ' + v);
    for (let i = 0; i < 70; i++) {
        const settings = ['', 'setting=1', 'x;"-z', 'caf\u00e9', '\u00c3\u00a9'][i % 5];
        const data = Buffer.concat([Buffer.from(settings, 'latin1'), Buffer.of(0, 17, 213)]);
        commands.push('cookie ' + -1463015540n * BigInt(i) * 8181n + ' ' + data.toString('hex') + ' ' + (i % 3 === 0 ? '~' : 'rs_') + ' ' + (i % 2 === 0 ? '~' : '.example.test'));
    }
    const slash = String.fromCharCode(92);
    const escaped = [
        'plain text',
        '"',
        slash + '"',
        slash + slash,
        slash + "'",
        ...['b', 'f', 'n', 'r', 't', 'v', '0', '7', '17', '123', '377', '400', '700', '78', '08', '9', 'x41', 'x4', 'x4z', 'u0041', 'uD800', 'u12', 'u003b', 'uXYZ1', 'z'].map(s => slash + s),
        '\n',
        '\r',
        '\r\n',
        slash + '\n',
        slash + '\r',
        slash + '\r\n',
        '\u2028',
        '\u2029',
        slash + '\u2028',
        slash + '\u2029'
    ];
    for (const value of escaped) {
        commands.push('cookie 0 ' + Buffer.concat([Buffer.from('left' + value + 'right', 'utf8'), Buffer.of(0)]).toString('hex') + ' rs_ .example.test');
    }
    for (const fault of [0, 1, 2, 3]) for (const setting of ['session', 'null']) commands.push('cookie-fault ' + fault + ' ' + setting);
    for (const platform of [2, 3])
        for (const os of ['windows', 'linux'])
            for (const ie6 of [0, 1])
                for (const url of ['../account?a=1#page', 'https://rs.example/music', 'a\0b', '###', 'bad+scheme://example']) {
                    commands.push('url ' + platform + ' ' + os + ' ' + ie6 + ' ' + Buffer.from(url, 'latin1').toString('hex'));
                }
    setLocalWorld(1);
    GameShell.frame = null;
    CookieStatics.gmtCalendar = new JavaCalendar('GMT');
    let shown = '~',
        cookie = '~',
        prefix: string | null = null,
        host: string | null = null;
    let fault = 0,
        trace: string[] | null = null;
    const page = {
        getCodeBase: () => JavaUrl.parse('https://rs.example/game/'),
        getAppletContext: () => ({
            showDocument(url: JavaUrl, target: string) {
                shown = url.toString() + ' ' + target;
            }
        }),
        getParameter: (key: string) => {
            trace?.push(key + '/');
            if ((fault === 1 && key === 'cookieprefix') || (fault === 2 && key === 'cookiehost')) throw new Error('parameter');
            return key === 'cookieprefix' ? prefix : key === 'cookiehost' ? host : null;
        },
        evaluate: Client.prototype.evaluate,
        setCookie: (value: string) => {
            trace?.push('set/');
            if (fault === 3) throw new Error('cookie');
            cookie = value;
        }
    };
    GameShell.m_activeShell = Object.create(Client.prototype) as Client;
    const link = (GameShell.signlink = new Signlink(page));
    const hex = (v: JagString | null) => (v === null ? '~' : Buffer.from(v.toBytes()).toString('hex'));
    const fmt = (s: string) => Buffer.from(s, 'utf8').toString('hex');
    const seed = Int32Array.of(538, 777, 39, 30);
    const encrypted = new SuperPacket(5000),
        incoming = new SuperPacket(5000);
    encrypted.SetEnc(seed);
    incoming.SetEnc(seed);
    mkdirSync('out', { recursive: true });
    const dir = mkdtempSync(resolve('out/browser-packets-'));
    try {
        const exports = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED'];
        const compiled = Bun.spawnSync(['javac', ...exports, '-cp', gamepackPath, '-d', dir, resolve(import.meta.dir, 'ui/BrowserPacketOracle.java')]);
        expect(compiled.stderr.toString()).toBe('');
        expect(compiled.exitCode).toBe(0);
        const java = Bun.spawnSync(['java', ...exports, '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'BrowserPacketOracle'], { stdin: Buffer.from(commands.join('\n') + '\n') });
        expect(java.stderr.toString()).toBe('');
        expect(java.exitCode).toBe(0);
        const lines = java.stdout.toString().trimEnd().split(/\r?\n/);
        expect(lines.length).toBe(commands.length);
        Client.hintArrows.fill(null);
        for (const [i, row] of commands.entries()) {
            const [op, a, b, c, d] = row.split(' ');
            let result: string;
            if (op === 'hint') {
                Client.hintHeadicons = new Array(+a);
                const bytes = Buffer.from(b, 'hex'),
                    p = await readPacketBody(217, bytes);
                result = p.m_pos + ' ' + Client.hintArrows.map(h => (h === null ? '~' : [h.actor, h.z, h.model, h.x, h.type, h.offsetX, h.offsetZ, h.icon, h.height].join(','))).join('/');
            } else if (op === 'date') result = hex(CookieStatics.formatCookieDate(BigInt(a)));
            else if (op === 'cookie') {
                cookie = '~';
                host = d === '~' ? null : d;
                prefix = c === '~' ? null : c;
                SafeTime.CurrentTimeMillis = () => BigInt(a);
                const bytes = Buffer.from(b, 'hex'),
                    p = await readPacketBody(142, bytes);
                result = p.m_pos + ' ' + hex(Client.settings) + ' ' + fmt(cookie);
            } else if (op === 'cookie-fault') {
                fault = Number(a);
                trace = [];
                cookie = '~';
                const setting = b === 'null' ? null : fromJsString('session');
                CookieStatics.setCookie(setting);
                result = [Client.settings === setting, trace.join(''), cookie !== '~'].join(' ');
                fault = 0;
                trace = null;
            } else {
                Signlink.platform = +a;
                Signlink.osNameLower = b;
                Client.haveIe6 = c === '1';
                shown = '~';
                Client.openUrlRequest = null;
                Client.pendingUrl = null;
                Client.urlNewWindow = false;
                const plain = Buffer.from(d, 'hex');
                encrypted.m_pos = 0;
                for (const byte of plain) encrypted.pHead(byte);
                const bytes = requireNonNull(encrypted.m_data).subarray(0, encrypted.m_pos);
                await readPacketBody(42, bytes, incoming);
                await new Promise(resolve => setTimeout(resolve, 0));
                const request = Client.openUrlRequest as SignlinkRequest | null;
                result = [incoming.m_pos, fmt(shown), hex(Client.pendingUrl), Client.urlNewWindow, request === null ? '~' : [request.type, request.status, fmt(String(request.objectArg))].join(',')].join(' ');
            }
            let reference = arrayAt(lines, i);
            if (op === 'cookie') {
                const [pos, settings, script] = reference.split(' ');
                reference = [pos, settings, fmt(referenceCookie(Buffer.from(script, 'hex').toString('utf8')) ?? '~')].join(' ');
            }
            expect(result, row).toBe(reference);
        }
    } finally {
        await link.stopWorker();
        Client.settings = saved.settings;
        Client.hintArrows.splice(0, 4, ...saved.arrows);
        Client.hintHeadicons = saved.icons;
        GameShell.frame = saved.frame;
        GameShell.m_activeShell = saved.shell;
        GameShell.signlink = saved.link;
        Object.assign(Client, saved.world);
        Signlink.platform = saved.platform;
        Signlink.osNameLower = saved.os;
        Client.haveIe6 = saved.ie6;
        Client.openUrlRequest = saved.request;
        Client.pendingUrl = saved.url;
        Client.urlNewWindow = saved.newWindow;
        SafeTime.CurrentTimeMillis = saved.clock;
        CookieStatics.gmtCalendar = saved.gmtCalendar;
        rmSync(dir, { recursive: true, force: true });
    }
}, 20000);
