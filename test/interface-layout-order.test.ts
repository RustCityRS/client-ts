import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import SharedPtrList from '#/datastruct/SharedPtrList.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import ServerActiveProperties from '#/ui/ServerActiveProperties.js';
import { JavaError } from '#/util/JavaException.js';
import WrappedException from '#/util/WrappedException.js';
import { loginFixture } from './login-fixture.js';
import { gamepackPath } from './reference.js';

type Vector = [entry: number, x: number, y: number, type: number, seed: number, qa: number, active: number, resize: number, at: number, action: number];
function vectors(): Vector[] {
    const out: Vector[] = [];
    for (const x of [-2, 0, 1, 2, 3, 4, 5])
        for (const y of [-1, 0, 1, 2, 3, 4, 5]) {
            for (const entry of [0, 1])
                for (let seed = 0; seed < 6; seed++) {
                    const type = [0, 7, 2, 3][(x + y + 9 + seed) % 4];
                    out.push([entry, x, y, type, seed, 0, 0, 1, 0, 0], [entry, x, y, type, seed, 1, 0, 1, 0, 0], [entry, x, y, type, seed, 1, 1, 0, 0, 0]);
                }
        }
    for (const type of [0, 2, 7]) for (const seed of [0, 1, 2]) out.push([2, 3, 3, type, seed, 1, 0, seed % 2, 0, 0]);
    for (const seed of [6, 7]) out.push([2, 0, 0, 3, seed, 0, 0, 1, 0, 0]);
    // Fail, throw a JVM Error, or change the widget immediately before each
    // observable field access or nested call. The original operands already on
    // the JVM stack remain live while the following operands see the mutation.
    for (let at = 1; at <= 49; at++)
        for (const action of [1, 2, 3])
            for (const [entry, x, y, type, seed] of [
                [0, 0, 0, 0, 0],
                [0, 1, 2, 2, 1],
                [0, 4, 5, 7, 3],
                [0, 5, 4, 3, 0],
                [1, 3, 3, 2, 0],
                [1, 3, 3, 7, 1],
                [1, 4, 4, 0, 0],
                [2, 3, 3, 0, 0],
                [2, 0, 1, 7, 1]
            ])
                out.push([entry, x, y, type, seed, 1, 1, 1, at, action]);
    return out;
}
const fields = {
    width: 'C',
    height: 'H',
    widthMode: 'X',
    heightMode: 'h',
    type: 'ob',
    itemX: 'jd',
    itemY: 'ab',
    aspectWidth: 'cb',
    aspectHeight: 'Wb',
    baseWidth: 'G',
    baseHeight: 'M',
    clientCode: 'wc',
    onResize: 'ic',
    xMode: 'ub',
    yMode: 'm',
    baseX: 'Bc',
    baseY: 'Ec',
    x: 'ib',
    y: 'Mb',
    parentId: 'n',
    scrollWidth: 'ld',
    scrollHeight: 'jb',
    scrollX: 'hc',
    scrollY: 'Ac'
} as const;
function error(e: unknown): string {
    if (e instanceof WrappedException) return e.context + '/' + error(e.cause);
    if (e instanceof JavaError) return 'fatal';
    if (e instanceof RangeError && e.message === '/ by zero') return 'zero';
    if (e instanceof TypeError) return 'null';
    if (e instanceof Error && e.message === 'probe') return 'probe';
    throw e;
}
function run(v: Vector): string {
    const [entry, x, y, type, seed, qa, active, resize, at, action] = v;
    const w = seed === 3 ? 0x7fffffff : 31,
        h = seed === 3 ? -2147483648 : 24;
    const c = new IfType(),
        other = new IfType(),
        oldHook = [111],
        newHook = [222];
    Object.assign(c, {
        parentId: 13,
        xMode: x,
        widthMode: x,
        yMode: y,
        heightMode: y,
        type,
        clientCode: seed === 1 ? 1337 : 4,
        width: seed === 1 ? -13 : 11,
        height: seed === 1 ? -17 : 12,
        y: -27,
        x: 41,
        baseX: seed === 0 ? -6 : seed === 1 ? 278 : 0x600023,
        baseY: seed === 0 ? -9 : seed === 1 ? 271 : -0x222223,
        baseWidth: seed === 0 ? 3 : seed === 1 ? -6 : 0x33333337,
        baseHeight: seed === 0 ? 4 : seed === 1 ? -8 : -0x22222225,
        itemY: -3,
        itemX: 5,
        aspectWidth: seed === 2 ? 0 : 3,
        aspectHeight: seed === 4 ? 0 : 7,
        scrollX: seed === 1 ? -12 : 99,
        scrollY: seed === 1 ? 0 : 153,
        scrollHeight: 43,
        scrollWidth: 39,
        onResize: seed === 4 ? null : oldHook,
        properties: new ServerActiveProperties(active, -1)
    });
    other.parentId = 18;
    Client.qaOpTest = qa !== 0;
    Client.m_hookQueue = seed === 5 ? null : new SharedPtrList();
    InterfaceList.viewportComponent = null;
    const log: string[] = [];
    let watching = true;
    function event(key: string) {
        if (!watching) return;
        log.push(key);
        if (log.length !== at) return;
        if (action === 1) throw new Error('probe');
        if (action === 2) throw new JavaError();
        if (action === 3) {
            watching = false;
            Object.assign(c, { width: 17, height: -47, scrollX: 71, scrollY: -11, scrollHeight: 173, scrollWidth: -71, onResize: newHook, baseX: 0x70000, baseY: -8193, baseWidth: -33, baseHeight: 81, aspectWidth: 3, aspectHeight: 10 });
            watching = true;
        }
    }
    for (const widget of entry === 2 ? [c, other] : [c])
        for (const [name, obf] of Object.entries(fields)) {
            let value: unknown = Reflect.get(widget, name);
            Object.defineProperty(widget, name, {
                configurable: true,
                get() {
                    event('r' + obf);
                    return value;
                },
                set(v) {
                    event('w' + obf);
                    value = v;
                }
            });
        }
    const size = Client.InterfaceCalculateSize,
        pos = Client.InterfaceCalculatePosition,
        sub = Client.InterfaceCalculateSizeAndPosSubcomponents;
    let fault = '-';
    try {
        if (entry === 0) Client.InterfaceCalculatePosition(c, seed % 2 === 0 ? -116 : -76, w, h);
        else if (entry === 1) Client.InterfaceCalculateSize(c, w, resize !== 0, h);
        else {
            Client.InterfaceCalculateSize = (_c, width, change, height) => event('pa:' + width + ',' + change + ',' + height);
            Client.InterfaceCalculatePosition = (_c, guard, width, height) => event('gh:' + guard + ',' + width + ',' + height);
            Client.InterfaceCalculateSizeAndPosSubcomponents = (change, _c) => event('mi:' + change);
            Client.InterfaceCalculateSizeAndPosArray(w, h, 13, seed === 6 ? null : seed === 7 ? [] : [null, other, c], resize !== 0);
        }
    } catch (e) {
        fault = error(e);
    } finally {
        watching = false;
        Client.InterfaceCalculateSize = size;
        Client.InterfaceCalculatePosition = pos;
        Client.InterfaceCalculateSizeAndPosSubcomponents = sub;
    }
    const ev = Client.m_hookQueue?.head();
    return [
        fault,
        log.join(','),
        [c.x, c.y, c.width, c.height, c.scrollX, c.scrollY].join(','),
        (InterfaceList.viewportComponent === c) + ',' + (ev == null ? '-' : (ev.component === c) + ',' + (ev.args === oldHook ? 'old' : ev.args === newHook ? 'new' : 'other'))
    ].join('|');
}
loginFixture(
    import.meta.url,
    '530 widget position, size and layout arrays retain exact JVM field access and mutation prefixes',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), '530-widget-layout-')),
            rows = vectors();
        try {
            const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
            const compile = Bun.spawnSync(['javac', asm, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'ui', 'InterfaceLayoutOrderOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const java = ['java', asm, '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'InterfaceLayoutOrderOracle'];
            const prepare = Bun.spawnSync([...java, gamepackPath, dir]);
            expect(prepare.exitCode, prepare.stderr.toString()).toBe(0);
            const result = Bun.spawnSync(java, { stdin: Buffer.from(rows.map(v => v.join(' ')).join('\n')), maxBuffer: 12 * 1024 * 1024 });
            expect(result.exitCode, result.stderr.toString()).toBe(0);
            const expected = result.stdout.toString().trim().split(/\r?\n/);
            expect(expected.length).toBe(rows.length);
            for (let i = 0; i < rows.length; i++) expect(run(rows[i]), rows[i].join(' ')).toBe(expected[i]);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    45000
);
