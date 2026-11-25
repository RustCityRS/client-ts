import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import ClientKeyboardListener from '#/client/ClientKeyboardListener.js';
import JagString from '#/datastruct/JagString.js';
import Pix2D from '#/graphics/Pix2D.js';
import PixfontGeneric from '#/graphics/PixfontGeneric.js';
import SoftwareFont from '#/graphics/SoftwareFont.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import Minimenu from '#/ui/Minimenu.js';
import JavaRandom from '#/util/JavaRandom.js';
import WrappedException from '#/util/WrappedException.js';
import { loginFixture } from '../login-fixture.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

function rows() {
    const cases: string[] = [];
    for (const guard of [-86, -120])
        for (const branch of ['null', 'widget', 'fallback']) {
            for (const choice of ['idle', 'use', 'spell', 'two', 'many', 'shift']) cases.push([guard, branch, choice, 'ok'].join(' '));
            for (const fault of ['font', 'noFont', 'random', 'nullBounds', 'shortBounds', 'roots', 'swap', 'drop']) {
                cases.push([guard, branch, 'many', fault].join(' '));
            }
        }
    return cases;
}

function clientResults(cases: string[]): string[] {
    const word = (s: string) => JagString.fromBytes(Buffer.from(s, 'latin1'), 0, s.length);
    const hex = (s: JagString | null) => (s === null ? '-' : Buffer.from(s.toBytes()).toString('hex'));
    const vec = (a: ArrayLike<number | boolean> | null) => (a === null ? 'null' : '[' + Array.from(a).join(', ') + ']');
    let events: string[] = [],
        fault = '',
        layout = false;
    function font(stride: number, kind: string): SoftwareFont {
        const metrics = new Uint8Array(257).fill(stride);
        metrics[256] = 5;
        const one = () => new Int32Array(256).fill(1);
        const f = new SoftwareFont(
            metrics,
            new Int32Array(256),
            one(),
            one(),
            new Int32Array(256).fill(2),
            Array.from({ length: 256 }, () => Uint8Array.of(1, 1))
        );
        const random = f.drawRandom.bind(f),
            aligned = f.drawRandomAligned.bind(f),
            width = f.stringWidth.bind(f);
        f.drawRandom = (...args) => {
            const [s, x, y, col, sh, , seed] = args;
            events.push('plain ' + kind + ' ' + hex(s) + ' ' + [x, y, col, sh, seed].join(','));
            layout = true;
            try {
                const jitter = random(...args);
                if (fault === 'swap') Client.fontBold12 = alternate;
                if (fault === 'drop') Client.fontBold12 = null;
                return jitter;
            } finally {
                layout = false;
            }
        };
        f.drawRandomAligned = (...args) => {
            const [s, x, y, w, h, col, sh, hor, ver, , seed] = args;
            events.push('aligned ' + kind + ' ' + hex(s) + ' ' + [x, y, w, h, col, sh, hor, ver, seed].join(','));
            layout = true;
            try {
                return aligned(...args);
            } finally {
                layout = false;
            }
        };
        f.stringWidth = s => {
            if (!layout) events.push('width ' + kind + ' ' + hex(s));
            return width(s);
        };
        return f;
    }
    const normal = font(4, 'base');
    const alternate = font(6, 'alt');
    Pix2D.width = 100;
    Pix2D.height = 70;
    Pix2D.pixels = new Int32Array(7000);
    Pix2D.setClipping(0, 0, 100, 70);
    const invalidate = InterfaceList.invalidateArea.bind(InterfaceList);
    InterfaceList.invalidateArea = (h, x, w, y) => {
        events.push('area ' + [x, y, w, h].join(','));
        invalidate(h, x, w, y);
    };
    for (const [i, s] of ['Walk', 'Take', 'Read', 'Try'].entries()) Minimenu.option[i] = word(s);
    for (const [i, s] of ['', 'Coin', 'Café', 'Box'].entries()) Minimenu.target[i] = word(s);
    Minimenu.targetVerb = word('Cast');
    Minimenu.targetName = word('Fire');
    Minimenu.objName = word('Key');
    InterfaceList.rootX.set([0, 10, 39]);
    InterfaceList.rootY.set([0, 10, 0]);
    InterfaceList.rootWidth.set([8, 41, 33]);
    InterfaceList.rootHeight.set([8, 29, 32]);
    InterfaceList.rootCount = 3;
    return cases.map(row => {
        const [guard, branch, choice, problem] = row.split(' ');
        fault = problem;
        Minimenu.count = ['idle', 'use', 'spell'].includes(choice) ? 1 : choice === 'two' ? 2 : 4;
        Minimenu.objSelected = choice === 'use' ? 1 : 0;
        Minimenu.targetMode = choice === 'spell';
        Minimenu.shiftClick = choice === 'shift';
        ClientKeyboardListener.pressed[81] = Minimenu.shiftClick;
        Client.fontBold12 = fault === 'noFont' ? null : normal;
        Minimenu.tooltipSeed = -203;
        Reflect.set(Minimenu, 'tooltipRandom', fault === 'random' ? null : new JavaRandom(1987n));
        Reflect.set(Minimenu, 'tooltipBounds', fault === 'nullBounds' ? null : fault === 'shortBounds' ? Int32Array.of(-4, -3) : Int32Array.of(-4, -3, -2, -1));
        InterfaceList.dirty.length = fault === 'roots' ? 1 : 3;
        InterfaceList.dirty.fill(false);
        const c = branch === 'null' ? null : Object.assign(new IfType(), { width: 77, height: 33, colour: 0x72c549, spriteShadow: 0x120924, textAlignH: 1, textAlignV: 2 });
        const failure = new Error('widget font');
        if (c)
            c.GetFont = icons => {
                expect(icons).toBe(PixfontGeneric.nameIcons);
                events.push('font');
                if (fault === 'font') throw failure;
                return branch === 'widget' ? alternate : null;
            };
        events = [];
        let result = 'ok';
        try {
            Minimenu.DrawFeedbackText(11, c, 6, Number(guard));
        } catch (error) {
            if (!(error instanceof WrappedException) || !error.context) throw error;
            const kind = error.cause === failure ? 'IllegalStateException' : error.cause instanceof RangeError ? 'ArrayIndexOutOfBoundsException' : error.cause instanceof TypeError ? 'NullPointerException' : null;
            if (!kind) throw error;
            result = kind + ' ' + error.context.slice(error.context.lastIndexOf('dm.D('));
        }
        return [row, result, events.join(';'), vec(Minimenu.tooltipBounds), vec(InterfaceList.dirty)].join('|');
    });
}

loginFixture(
    import.meta.url,
    'HD menu feedback text font jitter bounds and invalidated rectangles match dm.a',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-hd-menu-feedback-'));
        try {
            const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
            const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
            const compile = Bun.spawnSync(['javac', asm, '-encoding', 'UTF-8', '-cp', cp, '-d', dir, join(import.meta.dir, 'MenuFeedbackDrawOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const java = ['java', asm, '-Djava.awt.headless=true', '-cp', cp, 'MenuFeedbackDrawOracle'];
            const patch = Bun.spawnSync([...java, dir]);
            expect(patch.exitCode, patch.stderr.toString()).toBe(0);
            const cases = rows();
            const run = Bun.spawnSync([...java, 'run', 'cases'], { stdin: Buffer.from(cases.join('\n') + '\n') });
            expect(run.exitCode, run.stderr.toString()).toBe(0);
            const expected = run.stdout.toString().trimEnd().split(/\r?\n/);
            expect(expected).toHaveLength(cases.length);
            const actual = clientResults(cases);
            for (const [i, row] of expected.entries()) expect(actual[i], cases[i]).toBe(row);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    45000,
    'gl'
);
