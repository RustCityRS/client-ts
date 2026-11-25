import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import AbstractIndexedSprite from '#/graphics/AbstractIndexedSprite.js';
import Pix2D from '#/graphics/Pix2D.js';
import Pix8 from '#/graphics/Pix8.js';
import SpriteLoader from '#/graphics/SpriteLoader.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import InterfaceView from '#/ui/InterfaceView.js';
import Minimenu from '#/ui/Minimenu.js';
import { requireNonNull } from '#/util/JavaArray.js';
import WrappedException from '#/util/WrappedException.js';
import { compareFramebuffers } from './render/Framebuffer.js';
import { localAssets } from './cachefile.js';
import { readReferenceFrames } from './reference-frames.js';
import { cachePath, gamepackPath } from './reference.js';
import { loginFixture } from './login-fixture.js';

const W = 48,
    H = 94;
const colours = ['scrollbarTrack', 'scrollbarGripForeground', 'scrollbarGripHighlight', 'scrollbarGripLowlight'] as const;
type Row = [x: number, y: number, offset: number, height: number, content: number, clip: number, mode: number, failAt: number];

function cases(): Row[] {
    const rows: Row[] = [];
    for (const height of [12, 32, 33, 47, 64, 76, 81, 120]) {
        for (const content of [10, height, height + 1, height + 51, 900]) {
            for (const clip of [0, 1, 2, 3]) rows.push([7, 5, (content - height) >> 1, height, content, clip, 0, 0]);
        }
    }
    for (const [x, y] of [
        [-7, -3],
        [0, 0],
        [41, 66],
        [51, 0]
    ]) {
        for (const offset of [-51, 0, 30, 92, 1050, -2147483648, 2147483647]) rows.push([x, y, offset, 68, 180, 1, 1, 0]);
    }
    for (const [height, content] of [
        [64, 0],
        [64, 64],
        [0, 0],
        [65536, 65537],
        [65589, 10007],
        [46341, 100000],
        [-31, 50]
    ]) {
        rows.push([2, 0, 1019, height, content, 0, 0, 0]);
    }
    for (const mode of [1, 3, 4, 5, 6, 7, 8, 9, 12, 13, 15]) rows.push([7, 0, 47, 76, 230, 0, mode, 0]);
    for (let i = 1; i <= 12; i++) rows.push([7, 5, 47, 76, 230, 0, 1, i]);
    return rows;
}

function pixelHash(pixels: Int32Array): number {
    let h = 1;
    for (const value of pixels) h = (Math.imul(h, 31) + value) | 0;
    return h;
}

function run([x, y, offset, height, content, clip, mode, failAt]: Row): string {
    let step = 0;
    const calls: string[] = [];
    const original = [Pix2D.fillRect, Pix2D.hline, Pix2D.vline] as const;
    const nativeColours = colours.map(name => Client[name]);
    const primary = Int32Array.from({ length: mode === 13 ? 170 : W * H }, (_, i) => Math.imul(i, 8347) ^ 0xa5c3);
    const alternate = new Int32Array(W * H).fill(0x897345);
    const drawFault = new Error('observed draw fault');
    function start(operation: string, ...args: number[]): void {
        calls.push([operation, ...args].join(','));
        if (++step === failAt) throw drawFault;
    }
    function after(): void {
        if (mode === 1 || mode === 15) {
            Client.scrollbarTrack = (Client.scrollbarTrack + step * 101) | 0;
            Client.scrollbarGripForeground = (Client.scrollbarGripForeground - step * 711) | 0;
            Client.scrollbarGripHighlight ^= step * 89101;
            Client.scrollbarGripLowlight = (Client.scrollbarGripLowlight + step * 4411) | 0;
        }
        if (mode === 15 && step === 5) Pix2D.pixels = alternate;
    }
    class Marker extends AbstractIndexedSprite {
        readonly sprite: Pix8;
        constructor(readonly id: number) {
            super();
            this.sprite = new Pix8(
                16,
                16,
                2,
                1,
                4,
                4,
                Uint8Array.from({ length: 16 }, (_, i) => (i + id) % 3),
                Int32Array.of(0, 0x1a0210 + id, 0xb03f00 + id)
            );
        }
        override draw(x: number, y: number): void {
            start('S' + this.id, x, y);
            this.sprite.draw(x, y);
            if (this.id === 0 && mode === 8) SpriteLoader.scrollbars = [null, new Marker(2)];
            if (this.id === 0 && mode === 9) SpriteLoader.scrollbars = null;
            after();
        }
        override drawAlpha(): void {
            throw new Error('unexpected alpha draw');
        }
    }
    let outcome = 'ok';
    try {
        if (mode === 1 || mode === 15) {
            const changed = [0x10203040, -70219, 0x6782342, -83210];
            colours.forEach((name, i) => (Client[name] = changed[i]));
        }
        Pix2D.setPixels(mode === 12 ? null : primary, W, H);
        if (clip === 1) Pix2D.setClipping(9, 11, 19, 63);
        if (clip === 2) Pix2D.setClipping(5, 31, 2, 21);
        if (clip === 3) Pix2D.setClipping(0, 0, 48, 16);
        SpriteLoader.scrollbars = [new Marker(0), new Marker(1)];
        if (mode === 5) SpriteLoader.scrollbars[0] = null;
        if (mode === 6) SpriteLoader.scrollbars.length = 1;
        if (mode === 7) SpriteLoader.scrollbars[1] = null;
        if (mode === 3) SpriteLoader.scrollbars = null;
        if (mode === 4) SpriteLoader.scrollbars = [];
        Pix2D.fillRect = (x, y, w, h, colour) => {
            start('F', x, y, w, h, colour);
            original[0](x, y, w, h, colour);
            after();
        };
        Pix2D.hline = (x, y, w, colour) => {
            start('H', x, y, w, colour);
            original[1](x, y, w, colour);
            after();
        };
        Pix2D.vline = (x, y, h, colour) => {
            start('V', x, y, h, colour);
            original[2](x, y, h, colour);
            after();
        };
        Client.DrawScrollbar(height, y, offset, content, x);
    } catch (error) {
        if (error === drawFault) outcome = 'injected';
        else if (error instanceof TypeError && ['Null reference', 'Null array'].includes(error.message)) outcome = 'null';
        else if (error instanceof RangeError && /^array index -?\d+$/.test(error.message)) outcome = 'range:' + error.message.split(' ').at(-1);
        else if (error instanceof RangeError && error.message === '/ by zero') outcome = 'division';
        else throw error;
    } finally {
        [Pix2D.fillRect, Pix2D.hline, Pix2D.vline] = original;
        colours.forEach((name, i) => (Client[name] = nativeColours[i]));
    }
    return [outcome, calls.join(';'), [pixelHash(primary), pixelHash(alternate)].join(',')].join('|');
}

loginFixture(
    import.meta.url,
    'native scrollbar arrows bevels clipping and exceptional draw order match the 530 gamepack',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-scrollbar-'));
        const options = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED'];
        const rows = cases();
        try {
            const compile = Bun.spawnSync(['javac', ...options, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game', 'ScrollbarDrawOracle.java'), join(import.meta.dir, 'render', 'ProceduralTextureCacheOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const java = ['java', ...options, '-XX:-OmitStackTraceInFastThrow', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'ScrollbarDrawOracle'];
            const prepare = Bun.spawnSync([...java, gamepackPath, dir]);
            expect(prepare.exitCode, prepare.stderr.toString()).toBe(0);
            const trace = Bun.spawnSync(java, { stdin: Buffer.from(rows.map(row => row.join(' ')).join('\n') + '\n'), maxBuffer: 4 * 1024 * 1024 });
            expect(trace.exitCode, trace.stderr.toString()).toBe(0);
            const expected = trace.stdout.toString().trimEnd().split(/\r?\n/);
            expect(expected.length).toBe(rows.length);
            for (const [i, row] of rows.entries()) expect(run(row), row.join(' ')).toBe(expected[i]);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    30000
);

type ContainerCase = [scroll: number, content: number, flags: number, fault: number, clip: number];
const screenWidth = 96,
    screenHeight = 96,
    background = 0x385720;

function containerCases(): ContainerCase[] {
    const rows: ContainerCase[] = [];
    for (const content of [39, 56, 57, 124]) {
        for (const scroll of [-17, 0, 37, 190]) {
            for (const flags of [0, 1, 2, 3, 4, 8, 10, 26]) rows.push([scroll, content, flags, 0, 0]);
        }
    }
    for (const fault of [0, 1, 2, 3, 4, 5]) {
        for (const clip of [0, 1, 2]) {
            for (const flags of [0, 2, 4]) rows.push([0, 124, flags, fault, clip]);
        }
    }
    return rows;
}

function drawContainer([scroll, content, flags, fault, clip]: ContainerCase, arrows: (AbstractIndexedSprite | null)[]) {
    const parent = new IfType();
    Object.assign(parent, { type: 0, parentId: -1, id: 40, x: 12, y: 9, width: 40, height: 56, scrollY: scroll, scrollX: 2, scrollHeight: content, if3: !!(flags & 1), hidden: !!(flags & 8) });
    function rectangle(id: number, y: number, colour: number) {
        const child = new IfType();
        Object.assign(child, { id, parentId: 40, type: 3, x: 31, y, width: 22, height: 11, fill: true, colour });
        return child;
    }
    const first = rectangle(41, 5, 0x861740),
        last = rectangle(42, content - 17, 0x4859da);
    InterfaceList.rootCount = 3;
    Client.loopCycle = InterfaceList.cycle = 763;
    InterfaceList.rectRedrawnLastFrame[3] = !!(flags & 2);
    Client.rectDebug = flags & 4 ? 2 : 0;
    Minimenu.isOpen = true;
    Client.qaOpTest = false;
    InterfaceList.mouseOverComponent = flags & 16 ? parent : null;
    SpriteLoader.scrollbars = arrows;
    if (fault === 1) SpriteLoader.scrollbars = null;
    else if (fault === 2) SpriteLoader.scrollbars = [arrows[0], null];
    else if (fault === 3) SpriteLoader.scrollbars = [arrows[0]];
    else if (fault === 4) SpriteLoader.scrollbars = [];
    else if (fault === 5) SpriteLoader.scrollbars = [null, arrows[1]];
    const pixels = new Int32Array(screenWidth * screenHeight).fill(background);
    Pix2D.setPixels(pixels, screenWidth, screenHeight);

    Pix2D.setClipping(clip === 2 ? 47 : 3, clip === 2 ? 14 : 2, clip === 1 ? 51 : clip === 2 ? 62 : 94, clip === 2 ? 56 : 92);
    let status = 'ok';
    try {
        new InterfaceView([parent, first, last]).draw();
    } catch (caught) {
        let error = caught;
        while (error instanceof WrappedException) error = error.cause;
        if (error instanceof TypeError) status = 'NullPointerException';
        else if (error instanceof RangeError) status = 'ArrayIndexOutOfBoundsException';
        else throw error;
    }
    return { pixels, state: [status, parent.scrollY, parent.rootIndex, first.rootIndex, last.rootIndex, first.drawCycle, last.drawCycle, Pix2D.clipMinX, Pix2D.clipMinY, Pix2D.clipMaxX, Pix2D.clipMaxY].join(' ') };
}

loginFixture(
    import.meta.url,
    'IF1 container traversal clips children and draws stock scrollbar sprites after them',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-scrollbar-layer-'));
        try {
            const asm = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED'];
            const compile = Bun.spawnSync(['javac', ...asm, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game', 'ScrollbarDrawOracle.java'), join(import.meta.dir, 'render', 'ProceduralTextureCacheOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const rows = containerCases(),
                path = join(dir, 'screens.bin');
            const java = Bun.spawnSync(['java', ...asm, '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'ScrollbarDrawOracle', 'containers', cachePath, path], {
                stdin: Buffer.from(rows.map(row => row.join(' ')).join('\n') + '\n')
            });
            expect(java.exitCode, java.stderr.toString()).toBe(0);
            const expected = java.stdout.toString().trimEnd().split(/\r?\n/);
            expect(expected.length).toBe(rows.length);
            const sprites = localAssets(cachePath, [8]).archive(8);
            const scrollbars = requireNonNull(SpriteLoader.loadIndexedSprites2(sprites.GetGroupId(Client.scrollbarSpriteName), 0, sprites));
            expect(scrollbars).toHaveLength(2);
            for (const { index, frame } of readReferenceFrames(path, screenWidth, screenHeight, rows.length)) {
                const row = rows[index];
                const actual = drawContainer(row, scrollbars);
                expect(actual.state, row.join(' ')).toBe(expected[index]);
                expect(() => compareFramebuffers(frame, { ...frame, pixels: actual.pixels }), row.join(' ')).not.toThrow();
                const [scroll, content, flags, fault, clip] = row;
                if (scroll === 0 && content === 124 && flags === 2 && clip === 0) {
                    expect(frame.pixels[17 * screenWidth + 49]).toBe(0x861740);
                    const edge = frame.pixels.subarray(16 * screenWidth + 52, 16 * screenWidth + 68);
                    expect(edge.some(pixel => pixel !== background)).toBe(fault === 0 || fault === 2 || fault === 3);
                }
                if (scroll === 190 && content === 124 && flags === 2 && clip === 0) {
                    // The bottom child becomes visible only if the parent is clamped before descent.
                    expect(frame.pixels[50 * screenWidth + 46]).toBe(0x4859da);
                }
            }
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    30000
);
