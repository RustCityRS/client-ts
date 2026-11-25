import { expect } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import Pix2D from '#/graphics/Pix2D.js';
import Pix3D from '#/dash3d/Pix3D.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import InterfaceView from '#/ui/InterfaceView.js';
import ServerActiveProperties from '#/ui/ServerActiveProperties.js';
import WrappedException from '#/util/WrappedException.js';
import { loginFixture } from './login-fixture.js';
import { gamepackPath } from './reference.js';

type Row = [type: number, format: number, transparency: number, lineWidth: number, state: number, flags: number, x: number, y: number, w: number, h: number, mode: number, debug: number];
function vectors(): Row[] {
    const rows: Row[] = [];
    for (const format of [0, 1, 2, 3])
        for (const flags of [32, 33, 36, 37, 40, 41, 52, 53])
            for (const alpha of [-1, 0, 1, 127, 128, 255, 256]) {
                for (const state of [0, 1, 2, 3]) rows.push([3, format, alpha, 1, state, flags, 5, 4, 12, 7, 0, 0]);
            }
    for (const format of [0, 1])
        for (const size of [-3, 0, 1, 2, 3, 6, 13]) {
            for (const [x, y, w, h] of [
                [4, 4, 11, 7],
                [4, 4, 13, 0],
                [20, 12, -13, 0],
                [7, 4, 0, 12],
                [12, 12, 0, -9],
                [25, 14, -21, -9],
                [0, 1, 7, 5],
                [2, 2, 0, 0],
                [28, 17, 4, 6],
                [1, 2, 24, 17],
                [5, 17, 4, -13]
            ]) {
                for (const flags of [32, 34, 96, 98]) rows.push([9, format, 255, size, 0, flags, x, y, w, h, 0, 0]);
            }
        }
    for (const type of [3, 9])
        for (const format of [0, 1])
            for (const debug of [-2, 0, 1, 2, 3]) {
                for (const mode of [0, 1, 2, 4, 7]) for (const flags of [0, 33]) rows.push([type, format, mode === 1 ? 16 : 0, 5, 0, flags, 2, 2, 19, 13, mode, debug]);
            }
    return rows;
}
function fault(e: unknown): string {
    if (e instanceof WrappedException) return e.context + '/' + fault(e.cause);
    if (e instanceof TypeError) return 'null';
    if (e instanceof RangeError) return 'bounds';
    throw e;
}
function pixelsHash(pixels: Int32Array): string {
    const bytes = Buffer.alloc(pixels.length * 4);
    for (let i = 0; i < pixels.length; i++) bytes.writeInt32BE(pixels[i], i * 4);
    return createHash('sha256').update(bytes).digest('hex');
}

loginFixture(
    import.meta.url,
    '530 IF1 and IF3 rectangles and lines issue the original commands and preserve framebuffer pixels',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), '530-widget-primitives-')),
            rows = vectors();
        const restore: (() => void)[] = [];
        let command = '';
        try {
            const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
            const compile = Bun.spawnSync(['javac', asm, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'ui', 'WidgetPrimitiveOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const java = ['java', asm, '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'WidgetPrimitiveOracle'];
            const prepare = Bun.spawnSync([...java, gamepackPath, dir]);
            expect(prepare.exitCode, prepare.stderr.toString()).toBe(0);
            const result = Bun.spawnSync(java, { stdin: Buffer.from(rows.map(r => r.join(' ')).join('\n')), maxBuffer: 8 * 1024 * 1024 });
            expect(result.exitCode, result.stderr.toString()).toBe(0);
            const expected = result.stdout.toString().trimEnd().split(/\r?\n/);
            expect(expected.length).toBe(rows.length);

            for (const [name, op] of Object.entries({ fillRect: 'fill', drawRect: 'outline', fillRectTrans: 'fillAlpha', drawRectTrans: 'outlineAlpha', drawLine2: 'line', drawThickLine: 'thick' })) {
                const original = Reflect.get(Pix2D, name);
                Reflect.set(Pix2D, name, (...args: number[]) => {
                    command = op + '[' + args.join(', ') + ']';
                    return Reflect.apply(original, Pix2D, args);
                });
                restore.push(() => Reflect.set(Pix2D, name, original));
            }
            for (let index = 0; index < rows.length; index++) {
                const row = rows[index],
                    [type, format, alpha, size, state, flags, x, y, w, h, mode, debug] = row;
                const c = new IfType();
                Object.assign(c, {
                    parentId: -1,
                    type,
                    if3: (format & 1) !== 0,
                    hidden: (format & 2) !== 0,
                    fill: (flags & 1) !== 0,
                    lineDirection: (flags & 2) !== 0,
                    properties: new ServerActiveProperties((flags & 4) !== 0 ? 1 : 0, -1),
                    transparency: alpha,
                    lineWidth: size,
                    colour: 0xc04523,
                    activeColour: 0x235bc0,
                    overColour: (flags & 8) !== 0 ? 0 : 0x40bf45,
                    activeOverColour: (flags & 8) !== 0 ? 0 : 0xea3d61,
                    x,
                    y,
                    width: w,
                    height: h
                });
                if ((state & 1) !== 0) c.comparisonOps = new Int32Array(0);
                if (mode === 7) {
                    c.comparisonOps = Int32Array.of(0);
                    c.comparisonValues = null;
                }
                InterfaceList.mouseOverComponent = (state & 2) !== 0 ? c : null;
                Client.qaOpTest = (flags & 16) !== 0;
                InterfaceList.rootCount = 1;
                Client.loopCycle = 3482;
                Client.rectDebug = debug;
                Reflect.set(InterfaceList, 'rectRedrawnLastFrame', mode === 4 ? [] : [false, (flags & 32) !== 0, false]);
                const pixels = Int32Array.from({ length: mode === 1 ? 98 : 31 * 19 + 1 }, (_, i) => 0x873625 + i * 99);
                Pix2D.setPixels(mode === 2 ? null : pixels, 31, 19);
                Pix2D.setClipping(2, 3, 28, 17);
                Pix3D.trans = (flags & 64) !== 0 ? 73 : 0;
                Pix3D.hclip = false;
                let error = '-';
                command = '-';
                try {
                    new InterfaceView([c]).draw();
                } catch (e) {
                    error = fault(e);
                }
                const actual = [error, command, pixelsHash(pixels), [c.rootIndex, c.drawCycle, InterfaceList.rootCount].join(','), [Pix2D.clipMinX, Pix2D.clipMinY, Pix2D.clipMaxX, Pix2D.clipMaxY, Pix3D.width, Pix3D['height'], Pix3D.hclip].join(',')];
                expect(actual, row.join(' ')).toEqual(expected[index].split('|'));
            }
        } finally {
            for (const undo of restore) undo();
            rmSync(dir, { recursive: true, force: true });
        }
    },
    35000
);
