import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import BufferedImagePixMap from '../../src/graphics/BufferedImagePixMap.js';
import ImageProducerPixMap from '../../src/graphics/ImageProducerPixMap.js';
import Pix2D from '../../src/graphics/Pix2D.js';
import PixScreen, { CanvasComponent, CanvasGraphics, DirectColorModel, rasterToImageData, type AwtComponent, type AwtGraphics, type CanvasSurface } from '../../src/graphics/PixScreen.js';
import { requireNonNull } from '../../src/util/JavaArray.js';
import { gamepackPath } from '../reference.js';
import { PIX2D, withClinitStaticsAsync } from './staticState.js';

// oh (PixMap), ck (ImageProducerPixMap), wc (BufferedImagePixMap) and bj.a(IILjava/awt/Component;I)Loh;
// (PixMap.create) against client.jar. The same script runs through the TS port, drawing on a fake canvas surface that
// implements putImageData's dirty-rectangle rules from the HTML spec, and through pixmap/PixMapOracle.java, which runs
// the real classes on a headless java.awt.Canvas and draws into a TYPE_INT_ARGB BufferedImage. After every operation
// both sides report the result (ok, or the Java exception class at that point, with bj/ck's g wrapper unwrapped), the
// PixMap state (class, pixel array length, height, width, ck's consumer, image), td's binding (pixel array identity,
// length and content hash, width, height, clip), the whole screen hash (alpha included, so opaque output is checked)
// and the Graphics clip.
//
// Operations: the factory (wc, and the ck fallback when wc's raster rejects the size), direct ck/wc construction (with
// the state a throwing init leaves behind), a null Component, fills, full draws, dirty-rectangle draws at, across and
// outside the image and the screen, with zero and negative sizes, under user clips (setClip, clipRect intersections,
// negative clips), null Graphics, Pix2D rebinding and clip changes that bind must reset, and a fresh Graphics. Then
// three seeded random runs.
//
// Not testable against the jar (AWT platform boundary): which java.awt.Image subclass backs the PixMap, ImageObserver
// notifications (ck.imageUpdate only returns true; the adapter sends none), drawImage's boolean result (both
// callers discard it), and the real browser canvas (the fake surface follows the putImageData spec; the last test
// checks the RGBA bytes it receives). Sizes whose pixel array cannot be allocated (w * h + 1 near 2^31) are left
// out: the JVM's OutOfMemoryError and the JS engine's RangeError are platform limits, not client logic.

const SW = 120;
const SH = 90;
const SENTINEL = 0x11223344;
const RANDOM_SEEDS = [0x5eed1234, 0x0badf00d, 0x13579bdf];
const RANDOM_OPS = 4000;

function runOracle(script: string): string[] {
    const source = fileURLToPath(new URL('./pixmap/PixMapOracle.java', import.meta.url));
    const dir = mkdtempSync(join(tmpdir(), 'pixmap-oracle-'));
    try {
        const javac = spawnSync('javac', ['-nowarn', '-cp', gamepackPath, '-d', dir, source], { timeout: 60000, encoding: 'utf8' });
        if (javac.status !== 0) throw new Error(`javac failed: ${javac.stderr}`);
        const java = spawnSync('java', ['-Djava.awt.headless=true', '-cp', gamepackPath + delimiter + dir, 'PixMapOracle'], {
            input: script,
            timeout: 240000,
            encoding: 'utf8',
            maxBuffer: 64 * 1024 * 1024
        });
        if (java.status !== 0) throw new Error(`oracle failed (${java.status} ${java.signal}): ${java.stderr}`);
        return java.stdout
            .split('\n')
            .map(line => line.trimEnd())
            .filter(line => line.length > 0);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

function hash(values: ArrayLike<number>): number {
    let h = 1;
    for (let i = 0; i < values.length; i++) h = (Math.imul(h, 31) + values[i]) | 0;
    return h;
}

function pattern(i: number, seed: number): number {
    return Math.imul(i, 0x2545f491) ^ Math.imul(seed, 0x27d4eb2f);
}

// Maps a thrown TS error to the Java exception it stands for. The adapter in PixScreen.ts/BufferedImagePixMap.ts uses the
// JDK's own messages; 'length cannot be negative' and 'Requested length is negative' are JavaScriptCore's messages for
// new Int32Array(negative) (interpreter and JIT), Java's NegativeArraySizeException at newarray. Anything else is a
// test failure.
function classify(e: unknown): string {
    if (e instanceof TypeError && (e.message === 'Null reference' || e.message === 'Null array')) return 'NullPointerException';
    if (e instanceof RangeError) {
        if (e.message.startsWith('array index') || e.message === 'Coordinate out of bounds!' || e.message.startsWith('arraycopy:')) {
            return 'ArrayIndexOutOfBoundsException';
        }
        if (e.message.startsWith('length cannot be negative') || e.message === 'Requested length is negative') return 'NegativeArraySizeException';
        if (e.message.startsWith('Width (') || e.message.startsWith('Dimensions (')) return 'IllegalArgumentException';
        if (e.message.startsWith('Data array too small')) return 'RasterFormatException';
    }
    throw e;
}

// ---- fake canvas ----

const screen = new Uint8ClampedArray(SW * SH * 4);

class FakeImageData {
    readonly data: Uint8ClampedArray;
    constructor(
        readonly width: number,
        readonly height: number
    ) {
        this.data = new Uint8ClampedArray(width * height * 4);
    }
}

const surface: CanvasSurface = {
    createImageData(width: number, height: number): ImageData {
        if (width <= 0 || height <= 0) throw new Error('IndexSizeError');
        return new FakeImageData(width, height) as unknown as ImageData;
    },
    // HTML putImageData(imagedata, dx, dy, dirtyX, dirtyY, dirtyWidth, dirtyHeight)
    putImageData(data: ImageData, dx: number, dy: number, dirtyX: number, dirtyY: number, dirtyWidth: number, dirtyHeight: number): void {
        if (dirtyWidth < 0) {
            dirtyX += dirtyWidth;
            dirtyWidth = -dirtyWidth;
        }
        if (dirtyHeight < 0) {
            dirtyY += dirtyHeight;
            dirtyHeight = -dirtyHeight;
        }
        if (dirtyX < 0) {
            dirtyWidth += dirtyX;
            dirtyX = 0;
        }
        if (dirtyY < 0) {
            dirtyHeight += dirtyY;
            dirtyY = 0;
        }
        if (dirtyX + dirtyWidth > data.width) dirtyWidth = data.width - dirtyX;
        if (dirtyY + dirtyHeight > data.height) dirtyHeight = data.height - dirtyY;
        if (dirtyWidth <= 0 || dirtyHeight <= 0) return;
        for (let y = dirtyY; y < dirtyY + dirtyHeight; y++) {
            for (let x = dirtyX; x < dirtyX + dirtyWidth; x++) {
                const sx = dx + x;
                const sy = dy + y;
                if (sx < 0 || sy < 0 || sx >= SW || sy >= SH) continue;
                const from = (y * data.width + x) * 4;
                const to = (sy * SW + sx) * 4;
                for (let c = 0; c < 4; c++) screen[to + c] = data.data[from + c];
            }
        }
    }
};

function resetScreen(): void {
    for (let i = 0; i < SW * SH; i++) {
        screen[i * 4] = (SENTINEL >>> 16) & 0xff;
        screen[i * 4 + 1] = (SENTINEL >>> 8) & 0xff;
        screen[i * 4 + 2] = SENTINEL & 0xff;
        screen[i * 4 + 3] = (SENTINEL >>> 24) & 0xff;
    }
}

function screenState(): string {
    let h = 1;
    for (let i = 0; i < SW * SH; i++) {
        const argb = (screen[i * 4 + 3] << 24) | (screen[i * 4] << 16) | (screen[i * 4 + 1] << 8) | screen[i * 4 + 2];
        h = (Math.imul(h, 31) + argb) | 0;
    }
    return String(h);
}

// ---- TS side: mirrors PixMapOracle.main ----

async function runTs(lines: string[]): Promise<string[]> {
    const canvas = new CanvasComponent(surface);
    let g: AwtGraphics = new CanvasGraphics(surface);
    let cur: PixScreen | null = null;
    resetScreen();

    const pixMapState = (): string => {
        if (cur === null) return 'nocur';
        const name = cur instanceof BufferedImagePixMap ? 'wc' : cur instanceof ImageProducerPixMap ? 'ck' : '?';
        let cons = '-';
        if (cur instanceof ImageProducerPixMap) cons = (cur as unknown as { consumer: unknown }).consumer !== null ? 'consumer' : 'noconsumer';
        return `${name}:${cur.pixels === null ? 'null' : cur.pixels.length}:${cur.height}:${cur.width}:${cons}:${cur.image === null ? 'noimage' : 'image'}`;
    };
    const pix2dState = (): string => {
        const own = Pix2D.pixels;
        const pixels = own === null ? 'null' : `${cur !== null && own === cur.pixels ? 'own:' : 'other:'}${own.length}:${hash(own)}`;
        return `${pixels}:${Pix2D.width}:${Pix2D.height}:${Pix2D.clipMinX}:${Pix2D.clipMinY}:${Pix2D.clipMaxX}:${Pix2D.clipMaxY}`;
    };
    const clipState = (): string => {
        const clip = g.getClip();
        return clip === null ? 'noclip' : `${clip.x},${clip.y},${clip.width},${clip.height}`;
    };

    const out: string[] = [];
    for (let index = 0; index < lines.length; index++) {
        const p = lines[index].split(' ');
        const op = p[0];
        const n = (i: number): number => Number.parseInt(p[i], 10);
        let result = 'ok';
        try {
            switch (op) {
                case 'make': {
                    const component: AwtComponent | null = p[4] === 'null' ? null : canvas;
                    cur = null;
                    if (p[1] === 'bj') {
                        cur = await PixScreen.create(n(2), component, n(3));
                    } else if (p[1] === 'ck') {
                        const made = new ImageProducerPixMap();
                        cur = made;
                        made.init(n(2), n(3), component);
                    } else {
                        const made = new BufferedImagePixMap();
                        cur = made;
                        made.init(n(2), n(3), component);
                    }
                    break;
                }
                case 'fill': {
                    const pixels = requireNonNull(requireNonNull(cur).pixels);
                    for (let i = 0; i < pixels.length; i++) pixels[i] = pattern(i, n(1));
                    break;
                }
                case 'draw':
                    requireNonNull(cur).draw(n(1), n(2), g);
                    break;
                case 'drawnull':
                    requireNonNull(cur).draw(n(1), n(2), null);
                    break;
                case 'clip':
                    requireNonNull(cur).drawClipped(n(1), n(2), n(3), n(4), g);
                    break;
                case 'clipnull':
                    requireNonNull(cur).drawClipped(n(1), n(2), n(3), n(4), null);
                    break;
                case 'gset':
                    g.setClip({ x: n(1), y: n(2), width: n(3), height: n(4) });
                    break;
                case 'gnone':
                    g.setClip(null);
                    break;
                case 'grect':
                    g.clipRect(n(1), n(2), n(3), n(4));
                    break;
                case 'newg':
                    g = new CanvasGraphics(surface);
                    break;
                case 'bind':
                    requireNonNull(cur).bind();
                    break;
                case 'rebind':
                    Pix2D.setPixels(new Int32Array(Math.imul(n(1), n(2))), n(1), n(2));
                    break;
                case 'pclip':
                    Pix2D.setClipping(n(1), n(2), n(3), n(4));
                    break;
                case 'reset':
                    resetScreen();
                    break;
                default:
                    throw new Error(`unknown op ${op}`);
            }
        } catch (e) {
            result = classify(e);
        }
        out.push(`${index} ${op} ${result} ${pixMapState()} ${pix2dState()} ${screenState()} ${clipState()}`);
    }
    return out;
}

// ---- script ----

function buildScript(): string[] {
    const s: string[] = ['rebind 1 1'];
    const sizes: [number, number][] = [
        [90, 120],
        [30, 40],
        [5, 7],
        [1, 1],
        [91, 121],
        [17, 160]
    ];
    const rects = (): void => {
        s.push('clip 10 20 5 5', 'clip 0 0 0 0', 'clip 5 5 -1 -1', 'clip 10 10 0 3', 'clip 0 10 0 3', 'clip 7 3 -2 4');
        s.push('clip -3 6 2 2', 'clip 6 -3 2 2', 'clip 4 4 -2 -2', 'clip 200 200 0 0', 'clip 3 3 38 28', 'clip 3 3 37 27');
        s.push('clip 30 40 0 0', 'clip 31 40 0 0', 'clip 30 41 0 0', 'clip 90 120 0 0', 'clip 2 2 118 88', 'clip 2 2 119 89');
        s.push('clip 1 0 0 0', 'clip 0 1 0 0', 'clip 1 1 0 0', 'clip 1 1 -1 0', 'clip 1 1 0 -1', 'clip -1 1 0 0', 'clip 1 -1 0 0');
        s.push('clip 3 -2 1 1', 'clip -2 3 1 1', 'clip -2 -2 1 1', 'clip 3 -1 0 0', 'clip 3 -2147483648 0 0');
        s.push('clip 2147483647 1 0 0', 'clip -2147483648 1 0 0', 'clip 1 1 2147483647 0', 'clip 1 1 0 2147483647', 'clip 1 1 -2147483648 0');
    };
    for (const kind of ['bj', 'wc', 'ck']) {
        for (const [h, w] of sizes) {
            s.push(`make ${kind} ${h} ${w}`, 'reset', 'fill 1', 'draw 0 0', 'fill 2', 'draw 3 -2', 'fill 3', 'draw -5 4', 'draw 119 89', 'draw 120 90', 'draw -200 0');
            s.push('draw 2147483647 0', 'draw 0 -2147483648', 'draw -2147483648 2147483647', 'fill 4');
            rects();
            s.push('gset 4 6 30 20', 'fill 5', 'draw 0 0', 'clip 10 10 0 0', 'clip 10 10 20 15', 'grect 10 10 5 5', 'clip 20 20 0 0', 'gnone');
            s.push('grect 50 40 -3 10', 'draw 0 0', 'clip 10 10 50 40', 'gnone', 'grect 1 2 3 4', 'grect 10 10 5 5', 'draw 0 0', 'clip 3 3 0 0', 'newg');
            s.push('gset 2147483600 2147483600 1000 1000', 'draw 0 0', 'clip 5 5 0 0', 'grect -2147483648 -2147483648 2147483647 2147483647', 'draw 0 0', 'newg');
            s.push('fill 6', 'drawnull 1 1', 'clipnull 5 5 0 0', 'clipnull 5 5 -1 0', 'clip 4 4 1 1', 'draw 0 0');
            s.push('rebind 3 4', 'bind', 'pclip 1 2 3 3', 'pclip -5 -5 500 500', 'bind', 'reset');
        }
    }
    // A null Component: wc keeps it as the ImageObserver, ck dereferences it in createImage.
    for (const kind of ['bj', 'wc', 'ck']) {
        for (const [h, w] of [
            [30, 40],
            [0, 10],
            [-1, 5]
        ]) {
            s.push(`make ${kind} ${h} ${w} null`, 'fill 8', 'draw 2 3', 'clip 5 6 1 2', 'drawnull 0 0', 'bind', 'reset');
        }
    }
    // Sizes wc's raster rejects (ck fallback or both throwing), and ck/wc built directly with them.
    for (const [h, w] of [
        [0, 10],
        [10, 0],
        [0, 0],
        [-1, 5],
        [5, -1],
        [-1, -1],
        [-3, -7],
        [65536, 65536],
        [46341, 46341],
        [1, 2147483647],
        [2147483647, 1],
        [-2147483648, 1]
    ]) {
        for (const kind of ['bj', 'ck', 'wc']) {
            s.push('rebind 2 2', `make ${kind} ${h} ${w}`, 'fill 7', 'draw 0 0', 'clip 1 1 0 0', 'clip 0 0 0 0', 'drawnull 0 0', 'bind', 'reset');
        }
    }
    // Seeded random operations.
    for (const start of RANDOM_SEEDS) {
        let seed = start;
        const rnd = (bound: number): number => {
            seed = (Math.imul(seed, 1103515245) + 12345) | 0;
            return ((seed >>> 8) & 0xffffff) % bound;
        };
        const coord = (): number => rnd(180) - 30;
        const size = (): number => (rnd(10) === 0 ? rnd(8) - 4 : rnd(130));
        s.push('make bj 60 80', 'newg');
        for (let i = 0; i < RANDOM_OPS; i++) {
            const r = rnd(100);
            if (r < 3) {
                const kinds = ['bj', 'ck', 'wc'];
                s.push(`make ${kinds[rnd(3)]} ${rnd(100) + 1} ${rnd(130) + 1}${rnd(20) === 0 ? ' null' : ''}`);
            } else if (r < 12) s.push(`fill ${rnd(1000)}`);
            else if (r < 25) s.push(`draw ${coord()} ${coord()}`);
            else if (r < 68) s.push(`clip ${size()} ${size()} ${coord()} ${coord()}`);
            else if (r < 69) s.push(rnd(2) === 0 ? `drawnull ${coord()} ${coord()}` : `clipnull ${size()} ${size()} ${coord()} ${coord()}`);
            else if (r < 75) s.push(`gset ${coord()} ${coord()} ${size()} ${size()}`);
            else if (r < 82) s.push(`grect ${coord()} ${coord()} ${size()} ${size()}`);
            else if (r < 87) s.push('gnone');
            else if (r < 89) s.push('newg');
            else if (r < 92) s.push('bind');
            else if (r < 94) s.push(`rebind ${rnd(9) + 1} ${rnd(9) + 1}`);
            else if (r < 95) s.push(`pclip ${coord()} ${coord()} ${coord()} ${coord()}`);
            else s.push('reset');
        }
    }
    return s;
}

test('PixMap, ImageProducerPixMap, BufferedImagePixMap and PixMap.create match client.jar', async () => {
    const lines = buildScript();
    // Start Pix2D from td.<clinit> like the fresh JVM, and restore the incoming state afterwards.
    const ts = await withClinitStaticsAsync([PIX2D()], () => runTs(lines));
    const java = runOracle(lines.join('\n') + '\n');
    expect(java.length).toBe(lines.length);
    let mismatches = 0;
    let first = '';
    for (let i = 0; i < lines.length; i++) {
        if (ts[i] !== java[i]) {
            if (mismatches === 0) first = `mismatch at ${i} (${lines[i]}):\n  ts:   ${ts[i]}\n  java: ${java[i]}\n  prev: ${java[i - 1] ?? ''}`;
            mismatches++;
        }
    }
    if (mismatches > 0) throw new Error(`${mismatches} of ${lines.length} operations differ; first ${first}`);
    // The script must reach both subclasses, the factory fallback, each exception the code can throw, and real drawing.
    const result = (line: string): string => line.split(' ')[2];
    const madeByFactory = lines.flatMap((line, i) => (line.startsWith('make bj') ? [java[i]] : []));
    expect(madeByFactory.some(line => line.includes(' ok wc:'))).toBe(true);
    expect(madeByFactory.some(line => line.includes(' ok ck:'))).toBe(true);
    const results = new Set(java.map(result));
    for (const name of ['ok', 'NullPointerException', 'NegativeArraySizeException', 'IllegalArgumentException', 'ArrayIndexOutOfBoundsException']) {
        expect(results.has(name)).toBe(true);
    }
    expect(java.some(line => / clip ArrayIndexOutOfBoundsException ck:/.test(line))).toBe(true);
    expect(java.some(line => / clip NegativeArraySizeException ck:/.test(line))).toBe(true);
    expect(java.some(line => / clip ok ck:.*:consumer:/.test(line))).toBe(true);
    expect(java.some(line => / make ok ck:.*:noconsumer:/.test(line))).toBe(true);
    const drawsChangingScreen = java.filter((line, i) => i > 0 && /^\d+ (draw|clip) ok /.test(line) && line.split(' ')[5] !== java[i - 1].split(' ')[5]);
    expect(drawsChangingScreen.length).toBeGreaterThan(500);
    console.log(`pixmap oracle: ${lines.length} operations, ${drawsChangingScreen.length} draws that changed the screen, results ${[...results].join(', ')}`);
}, 300000);

test('the canvas receives each pixel word as 0xRRGGBB with alpha 255', async () => {
    resetScreen();
    const component = new CanvasComponent(surface);
    for (const pixMap of [await PixScreen.create(2, component, 3), new ImageProducerPixMap()]) {
        if (pixMap instanceof ImageProducerPixMap) pixMap.init(2, 3, component);
        const pixels = requireNonNull(pixMap.pixels);
        expect(pixels.length).toBe(7);
        expect(Pix2D.pixels).toBe(pixels);
        pixels.set([0x00123456, 0xff654321, 0x7fabcdef, 0x00000000, 0x80ffffff, 0x01020304, 0x55555555]);
        pixMap.draw(0, 0, new CanvasGraphics(surface));
        expect(Array.from(screen.subarray(0, 12))).toEqual([0x12, 0x34, 0x56, 255, 0x65, 0x43, 0x21, 255, 0xab, 0xcd, 0xef, 255]);
        expect(Array.from(screen.subarray(SW * 4, SW * 4 + 12))).toEqual([0, 0, 0, 255, 0xff, 0xff, 0xff, 255, 0x02, 0x03, 0x04, 255]);
    }
});

test('clipped RGBA writes respect the ImageData view offset and custom colour models', () => {
    const source = Int32Array.of(0x778899, 0x123456, 0xabcdef, 0x010203);
    const rgb = new DirectColorModel(32, 0xff0000, 0xff00, 0xff);
    const bgr = new DirectColorModel(32, 0xff, 0xff00, 0xff0000);
    for (const offset of [0, 1, 4]) {
        const bytes = new Uint8ClampedArray(24).fill(0x81);
        const target = { data: bytes.subarray(offset, offset + 16), width: 2, height: 2 } as ImageData;
        const expected = bytes.slice();
        for (const model of [rgb, bgr]) {
            rasterToImageData(surface, target, source, 2, 2, model, 1, 0, 1, 2);
            expected.set(model === rgb ? [0x12, 0x34, 0x56, 255] : [0x56, 0x34, 0x12, 255], offset + 4);
            expected.set(model === rgb ? [1, 2, 3, 255] : [3, 2, 1, 255], offset + 12);
            expect(bytes).toEqual(expected);
        }
    }
});
