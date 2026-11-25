import { expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { captureSdFrame } from '#/dash3d/SdWorldRaster.js';
import Pix2D from '#/graphics/Pix2D.js';
import Pix32 from '#/graphics/Pix32.js';
import Pix8 from '#/graphics/Pix8.js';
import SoftwareAlphaSprite from '#/graphics/SoftwareAlphaSprite.js';
import SoftwareFont from '#/graphics/SoftwareFont.js';
import { gamepackPath } from '../reference.js';
import { hdGamepackPath, joglPath } from './hd-reference.js';
import { renderSdFrames } from './sd-device.js';

const width = 39,
    height = 31;
const starts = Int32Array.from({ length: 28 }, (_, i) => i % 3);
const lengths = Int32Array.from({ length: 28 }, (_, i) => 4 + (i % 4));
type Receiver = 'raster' | 'sprite' | 'alpha' | 'indexed' | 'font';
type Argument = number | boolean | 'starts' | 'lengths';
type Call = [Receiver, string, string, string, ...Argument[]];

function fixtures(): Call[][] {
    const cases: Call[][] = [];
    for (const opacity of [-2, 0, 1, 116, 255, 256, 278]) {
        cases.push([['raster', 'drawRectTrans', 'c', 'b', -2, 2, 35, 24, 0xfeab34, opacity]]);
        for (const radius of [-7, 0, 8]) cases.push([['raster', 'fillCircleTrans', 'a', 'f', 6, 4, radius, 0xfba334, opacity]]);
        cases.push([['indexed', 'drawAlpha', 'a', 'a', -4, 2, opacity]]);
        cases.push([['font', 'drawGlyphAlpha', 'a', 'a', 65, -3, 7, 11, 9, 0xcdee57, opacity, true]]);
        for (const s of ['sprite', 'alpha'] as const) {
            cases.push([[s, 'drawAlpha', 'a', 'a', -2, 7, opacity]]);
            cases.push([[s, 'drawScaledAlpha', 'a', 'b', 4, -4, 32, 20, opacity]]);
        }
    }
    for (const end of [
        [-4, 15],
        [27, 21],
        [18, 28],
        [0, 1]
    ]) {
        cases.push([['raster', 'drawLine2', 'f', 'e', 8, 4, ...end, 0x87213456 | 0]]);
    }
    for (const s of ['sprite', 'alpha'] as const) {
        cases.push([[s, 'draw', 'c', 'e', 2, -3]]);
        cases.push([[s, 'drawOpaque', 'a', 'c', 30, 21]]);
        cases.push([[s, 'drawHFlip', 'b', 'd', -1, 3]]);
        cases.push([[s, 'drawScaled', 'a', 'a', 8, 7, 31, 26]]);
        cases.push([[s, 'drawMasked', 'a', 'a', 2, -2, 'starts', 'lengths']]);
        for (const angle of [0, 16384, 32768, 49152, 3000, 23000, 44000, 56000]) {
            cases.push([[s, 'drawRotated', 'a', 'a', 104, 88, 301, 198, angle, 4096]]);
        }
        cases.push([[s, 'drawRotatedRadians', 'a', 'a', 12, 4, 9, 7, 5, 5, 0.8, 127]]);
        // Both rh and vh catch source bounds exceptions, leaving the prefix already drawn.
        cases.push([[s, 'drawRotatedRadians', 'a', 'a', 12, 4, 16, 9, 9, 4, 0.125, 256]]);
        // A negative destination can be skipped by rh's colour key. vh reads it even for zero alpha.
        cases.push([[s, 'drawRotatedRadians', 'a', 'a', -1, 0, 3, 1, 1, 0, 0.00001, 256]]);
        cases.push([[s, 'drawRotatedRadians', 'a', 'a', 37, 30, 6, 2, 5, 4, 0.00001, 256]]);
        cases.push([[s, 'drawRotatedMasked', 'a', s === 'alpha' ? 'a' : 'b', 7, 5, 8, 5, 4, 3, 38, 256, 'starts', 'lengths']]);
        cases.push([[s, 'drawRotatedMaskedOpaque', 'b', s === 'alpha' ? 'b' : 'a', 7, 5, 8, 5, 4, 3, 38, 256, 'starts', 'lengths']]);
    }
    cases.push([['indexed', 'draw', 'a', 'a', -1, 6]]);
    cases.push([['indexed', 'drawScaled', 'a', 'a', 6, -4, 18, 22]]);
    cases.push([['indexed', 'drawScaledTinted', 'a', 'a', -8, 8, 44, 23, 0xeaf04f]]);
    cases.push([
        ['indexed', 'draw', 'a', 'a', 0, 0],
        ['indexed', 'rgbAdjust', 'b', 'b', 22, -7, 1],
        ['indexed', 'draw', 'a', 'a', 17, 2]
    ]);
    cases.push([
        ['sprite', 'draw', 'c', 'e', 0, 0],
        ['sprite', 'shadow', 'e', 'f', 0x7cb043],
        ['sprite', 'draw', 'c', 'e', 17, 2]
    ]);
    cases.push([['font', 'drawGlyph', 'a', 'a', 65, 2, -3, 11, 9, 0x856612aa | 0, false]]);
    cases.push([
        ['raster', 'setClipMask', 'a', 'a', 'starts', 'lengths'],
        ['font', 'drawGlyph', 'a', 'a', 65, 3, -1, 11, 9, 0xd56112aa | 0, true]
    ]);
    return cases;
}

function draw(calls: Call[], capture: boolean) {
    const initial = Int32Array.from({ length: width * height }, (_, i) => Math.imul(i + 1, 0x8f72cb09));
    const rgb = Int32Array.from({ length: 99 }, (_, i) => (i % 4 === 0 ? 0 : i % 5 === 0 ? 0x998877 : Math.imul(i + 1, 0x834c971f)));
    const sizes = new Int32Array(256).fill(11),
        mask = Array<Uint8Array | null>(256).fill(null);
    mask[65] = Uint8Array.from({ length: 99 }, (_, i) => (i % 5 === 0 ? 0 : 153));
    const subjects = {
        raster: Pix2D,
        sprite: new Pix32(15, 11, 2, 1, 11, 9, rgb.slice()),
        alpha: new SoftwareAlphaSprite(15, 11, 2, 1, 11, 9, rgb.slice()),
        indexed: new Pix8(
            15,
            11,
            2,
            1,
            11,
            9,
            Uint8Array.from({ length: 99 }, (_, i) => i % 5),
            Int32Array.of(0x10203040, 0, 0xffb672ac, 0x3479c2e8, 0x00ffeeb3)
        ),
        font: new SoftwareFont(new Uint8Array(257), sizes, sizes, sizes, sizes, mask)
    };
    Pix2D.setPixels(initial, width, height);
    Pix2D.setClipping(1, 1, 37, 29);
    const run = (): void => {
        for (const [target, name, , , ...args] of calls) {
            const receiver = subjects[target];
            Reflect.apply(
                Reflect.get(receiver, name),
                receiver,
                args.map(a => (a === 'starts' ? starts : a === 'lengths' ? lengths : a))
            );
        }
    };
    const frame = capture ? captureSdFrame(run) : undefined;
    if (!capture) run();
    return { initial, frame };
}

test('SD WebGPU circles, lines, indexed, RGB, ARGB and glyphs match every framebuffer word from both original JARs', async () => {
    const dir = mkdtempSync(join(tmpdir(), '530-sd-primitives-'));
    const old = [Pix2D.pixels, Pix2D.width, Pix2D.height, Pix2D.clipMinX, Pix2D.clipMinY, Pix2D.clipMaxX, Pix2D.clipMaxY, Pix2D.maskOffsets, Pix2D.maskLengths] as const;
    try {
        const cases = fixtures();
        const script = join(dir, 'cases.txt');
        writeFileSync(script, cases.flatMap(calls => ['frame', ...calls.map(([target, , sd, hd, ...args]) => [target, sd, hd, ...args].join(' ')), 'save']).join('\n'));
        const references = [];
        for (const [pack, path] of [
            ['sd', gamepackPath],
            ['hd', hdGamepackPath + delimiter + joglPath]
        ]) {
            const output = join(dir, pack + '.bin');
            const java = Bun.spawnSync(['java', '-cp', path, join(import.meta.dir, 'SdPrimitiveOracle.java'), pack, script, output]);
            expect(java.exitCode, java.stderr.toString()).toBe(0);
            references.push(readFileSync(output).swap32());
        }
        const cpu = cases.map(c => draw(c, false).initial);
        const gpu = await renderSdFrames(
            dir,
            cases.map(c => {
                const { frame } = draw(c, true);
                if (frame === undefined) throw new Error('Missing primitive capture');
                return frame;
            })
        );
        for (let i = 0; i < cases.length; i++) {
            const start = i * width * height * 4,
                name = JSON.stringify(cases[i]);
            const expected = references[0].subarray(start, start + width * height * 4);
            expect(references[1].subarray(start, start + expected.length).equals(expected), 'SD/HD JAR ' + name).toBe(true);
            expect(Buffer.from(cpu[i].buffer).equals(expected), 'CPU ' + name).toBe(true);
            expect(Buffer.from(gpu[i].buffer, gpu[i].byteOffset, gpu[i].byteLength).equals(expected), 'GPU ' + name).toBe(true);
        }
    } finally {
        [Pix2D.pixels, Pix2D.width, Pix2D.height, Pix2D.clipMinX, Pix2D.clipMinY, Pix2D.clipMaxX, Pix2D.clipMaxY, Pix2D.maskOffsets, Pix2D.maskLengths] = old;
        rmSync(dir, { recursive: true, force: true });
    }
}, 30000);
