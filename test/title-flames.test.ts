import { expect } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import type Js5 from '#/cache/Js5.js';
import Client from '#/client/Client.js';
import Pix3D from '#/dash3d/Pix3D.js';
import SdRasterSpans, { type SdRasterFrame } from '#/dash3d/SdRasterSpans.js';
import { fromJsString } from '#/datastruct/JagString.js';
import Pix2D from '#/graphics/Pix2D.js';
import Pix8 from '#/graphics/Pix8.js';
import Pix32 from '#/graphics/Pix32.js';
import SpriteLoader from '#/graphics/SpriteLoader.js';
import TitleFlames from '#/title/TitleFlames.js';
import IfType from '#/ui/IfType.js';
import InterfaceView from '#/ui/InterfaceView.js';
import InterfaceList from '#/ui/InterfaceList.js';
import { requireNonNull } from '#/util/JavaArray.js';
import WrappedException from '#/util/WrappedException.js';
import { mathRandom } from '#/util/JavaRandom.js';
import { localAssets } from './cachefile.js';
import { loginFixture } from './login-fixture.js';
import { cachePath, gamepackPath } from './reference.js';
import { renderSdFrames } from './render/sd-device.js';

type Row = [op: number, fault: number, n: number, cycles: number, x: number, y: number, clip: number];
function cases(): Row[] {
    const rows: Row[] = [];
    for (const clip of [0, 1, 2]) {
        rows.push([0, 0, 0, 0, 0, 0, clip], [5, 0, 0, 285, 18, 9, clip], [6, 0, 0, 0, 0, 0, clip]);
        for (const cycles of [-2147483648, -7, -1, 0, 1, 2, 5, 9, 10, 11, 127, 255, 256, 257, 2147483647]) {
            rows.push([2, 0, 0, cycles, 0, 0, clip], [3, 0, 0, cycles, 18, 11, clip], [4, 0, 0, cycles, 0, 0, clip]);
        }
        for (const [x, y] of [
            [0, 0],
            [-1, 0],
            [192, -1],
            [2, -2],
            [66, 0],
            [64, 26],
            [65, 26],
            [-91, 32],
            [2147483647, -1]
        ])
            rows.push([3, 0, 0, 0, x, y, clip]);
    }
    for (const op of [0, 1, 2, 3]) {
        const fields = op === 0 ? [11] : op === 1 ? [2, 3, 15] : op === 2 ? [1, 2, 3, 4, 5, 9, 14, 17, 18] : [1, 4, 6, 7, 8, 10, 12, 13, 16];
        for (const field of fields) {
            const lengths =
                field === 18 ? [2147483647, -12] : field === 14 ? [32768, 32769, 2147483647, -1] : [12, 13].includes(field) ? [-150, 0, 129, 255, 256, 32767, 2147483647] : [15, 16, 17].includes(field) ? [0] : [-1, 0, 3, 49, 126, 254, 1024, 32511];
            for (const n of lengths) rows.push([op, field, n, op === 2 ? 3 : 0, 16, 8, 1]);
        }
    }
    for (let rune = 0; rune < 12; rune++) rows.push([1, 0, rune, 0, 0, 0, 0]);
    for (const clip of [0, 1, 2])
        for (const cycles of [0, 1, 10]) {
            rows.push([9, 0, 0, cycles, 24, 18, clip]);
            rows.push([9, 0, 0, cycles, 24, 30, clip]);
        }
    // Registration stores rectangle slots, then stamps the component. The two
    // dirty-flag writes follow the complete flame draw in order.
    for (const field of [19, 20, 21, 22]) for (const length of [-1, 0, 7, 8, 100]) rows.push([9, field, length, 1, 24, 18, 1]);
    for (const root of [-1, 0, 7, 99, 100]) rows.push([9, 23, root, 0, 24, 18, 0]);
    for (const [field, length] of [
        [1, 0],
        [4, 1],
        [7, 14],
        [8, 7000],
        [10, 0]
    ])
        rows.push([9, field, length, 1, 24, 18, 1]);
    for (const op of [7, 8])
        for (const n of op === 7 ? [-1, 0, 3, 19, 20] : [0, 3, 19, 20])
            for (const [x, y] of [
                [0, 0],
                [-50, -16],
                [0, 238],
                [2147483647, 1]
            ]) {
                rows.push([op, 0, n, 0, x, y, 2]);
            }
    return rows;
}
function pattern(n: number, kind: number): Int32Array | null {
    if (n < 0) return null;
    const a = new Int32Array(n);
    for (let i = 0; i < a.length; i++) a[i] = kind === 0 ? i & 255 : kind === 1 ? (i % 67) - 33 : Math.imul(i, 0x48923d79) ^ Math.imul(kind, 0x73297c0b);
    return a;
}
function slots() {
    return [
        TitleFlames.flameBuffer0,
        TitleFlames.flameBuffer1,
        TitleFlames.blurBuffer,
        TitleFlames.flameBuffer,
        TitleFlames.flameLineOffset,
        TitleFlames.flameColours,
        TitleFlames.flameGradient,
        TitleFlames.flameSprite,
        TitleFlames.flameSprite?.pixels ?? null,
        Pix2D.pixels,
        TitleFlames.runeSprites
    ];
}
function state(before: ReturnType<typeof slots>): string {
    const ids = new Map<object, number>(),
        refs: string[] = [];
    for (const o of [...before, ...slots()]) {
        if (o === null) {
            refs.push('-');
            continue;
        }
        if (!ids.has(o)) ids.set(o, ids.size);
        refs.push(String(ids.get(o)));
    }
    const hash = createHash('sha256'),
        word = Buffer.alloc(4);
    function number(n: number) {
        word.writeInt32LE(n);
        hash.update(word);
    }
    for (const o of ids.keys()) {
        if (o instanceof Int32Array) {
            number(o.length);
            hash.update(new Uint8Array(o.buffer, o.byteOffset, o.byteLength));
        } else if (Array.isArray(o)) {
            number(o.length);
            for (const rune of o as (Pix8 | null)[]) {
                number(rune?.width ?? -1);
                if (rune === null) continue;
                for (const value of [rune.height, rune.xOffset, rune.yOffset, rune.pixels?.length ?? -1]) number(value);
                if (rune.pixels !== null) hash.update(rune.pixels);
            }
        }
    }
    return [refs.join(','), hash.digest('hex'), mathRandom['seed'], [TitleFlames.pendingCycles, TitleFlames.sparks, TitleFlames.phase, TitleFlames.coolingCycle, Pix2D.clipMinX, Pix2D.clipMinY, Pix2D.clipMaxX, Pix2D.clipMaxY].join(',')].join('|');
}
function observe([op, fault, n, cycles, x, y, clip]: Row, archive: Js5, runes: (Pix8 | null)[]) {
    // The widget success cases start with the byte-range cooling values produced by SetupFire.
    TitleFlames.flameBuffer0 = pattern(32768, op === 9 ? 0 : 3);
    TitleFlames.flameBuffer1 = pattern(32768, 4);
    TitleFlames.flameBuffer = pattern(32768, 0);
    TitleFlames.blurBuffer = pattern(32768, 5);
    TitleFlames.flameColours = Int32Array.of(0xee038145, 0x80bb3c67, 0xf13400e1, 0x750ccb89);
    TitleFlames.flameGradient = pattern(256, 6);
    TitleFlames.flameLineOffset = pattern(256, 1);
    TitleFlames.runeSprites = runes;
    TitleFlames.flameSprite = new Pix32(128, 254);
    TitleFlames.flameSprite.pixels = pattern(128 * 254, 7);
    Pix2D.setPixels(pattern(192 * 280, 8), 192, 280);
    Pix2D.setClipping(clip === 1 ? 24 : clip === 2 ? 51 : 0, clip === 1 ? 29 : clip === 2 ? 61 : 0, clip === 1 ? 102 : clip === 2 ? 51 : 192, clip === 1 ? 133 : clip === 2 ? 61 : 280);
    TitleFlames.pendingCycles = cycles;
    TitleFlames.sparks = 5;
    TitleFlames.phase = 2147483644;
    TitleFlames.coolingCycle = 1977;
    Client.loopCycle = clip;
    switch (fault) {
        case 1:
            TitleFlames.flameBuffer = pattern(n, 0);
            break;
        case 2:
            TitleFlames.flameBuffer0 = pattern(n, 3);
            break;
        case 3:
            TitleFlames.flameBuffer1 = pattern(n, 4);
            break;
        case 4:
            TitleFlames.flameLineOffset = pattern(n, 1);
            break;
        case 5:
            TitleFlames.blurBuffer = pattern(n, 5);
            break;
        case 6:
            TitleFlames.flameGradient = pattern(n, 6);
            break;
        case 7:
            TitleFlames.flameSprite.pixels = pattern(n, 7);
            break;
        case 8:
            Pix2D.pixels = pattern(n, 8);
            break;
        case 9:
            TitleFlames.runeSprites = n < 0 ? null : Array.from({ length: n }, (_, i) => runes[i] ?? null);
            TitleFlames.coolingCycle = 32768;
            break;
        case 10:
            TitleFlames.flameSprite = null;
            break;
        case 11:
            TitleFlames.flameColours = pattern(n, 6);
            break;
        case 12:
            requireNonNull(TitleFlames.flameLineOffset)[3] = n;
            break;
        case 13:
            requireNonNull(TitleFlames.flameBuffer)[1024] = n;
            break;
        case 14:
            TitleFlames.coolingCycle = n;
            break;
        case 15:
            TitleFlames.flameBuffer1 = TitleFlames.flameBuffer0;
            break;
        case 16:
            TitleFlames.flameSprite.pixels = Pix2D.pixels;
            break;
        case 17:
            TitleFlames.blurBuffer = TitleFlames.flameBuffer;
            break;
        case 18:
            TitleFlames.sparks = n;
            break;
    }
    mathRandom.setSeed(BigInt(18339 + clip));
    const before = slots();
    let widget: IfType | null = null;
    let result = 'ok';
    try {
        switch (op) {
            case 0:
                TitleFlames.SetupFire(archive);
                break;
            case 1:
                TitleFlames.GenerateFlameCoolingMap(n < 0 ? null : runes[n % runes.length]);
                break;
            case 2:
                TitleFlames.UpdateFlames(cycles);
                break;
            case 3:
                TitleFlames.RenderFlames(x, y);
                break;
            case 4:
                TitleFlames.tick();
                break;
            case 5:
                TitleFlames.SetupFire(archive);
                for (let tick = 0; tick < cycles; tick++) {
                    Client.loopCycle = tick;
                    TitleFlames.tick();
                    if (tick % 5 === 0) TitleFlames.RenderFlames(x, y);
                }
                break;
            case 6:
                TitleFlames.SetupFire(null);
                break;
            case 7:
                TitleFlames.GenerateFlameCoolingMap(new Pix8(1, 1, x, y, 5, 4, n < 0 ? null : new Uint8Array(n), new Int32Array(256)));
                break;
            case 8:
                TitleFlames.GenerateFlameCoolingMap(new Pix8(5, 4, x, y, 5, 4, new Uint8Array(n).fill(0x81), new Int32Array(256)));
                break;
            case 9: {
                widget = new IfType();
                Object.assign(widget, { clientCode: 1402, parentId: -1, if3: true, type: 3, x, y, width: 18, height: 22, id: 913, rootIndex: -31, drawCycle: -99 });
                Client.loopCycle = 0x49024310 + clip;
                Object.assign(InterfaceList, {
                    rootCount: fault === 23 ? n : 7,
                    rootX: pattern(100, 0),
                    rootY: pattern(100, 0),
                    rootWidth: pattern(100, 0),
                    rootHeight: pattern(100, 0),
                    dirty: new Array<boolean>(100).fill(false),
                    rectangleRedraw: new Array<boolean>(100).fill(false)
                });
                InterfaceList.dirty[5] = true;
                InterfaceList.rectangleRedraw[9] = true;
                if (fault === 19) Object.assign(InterfaceList, { dirty: n < 0 ? null : InterfaceList.dirty.slice(0, n) });
                if (fault === 20) Object.assign(InterfaceList, { rectangleRedraw: n < 0 ? null : InterfaceList.rectangleRedraw.slice(0, n) });
                if (fault === 21) Object.assign(InterfaceList, { rootY: n < 0 ? null : InterfaceList.rootY.slice(0, n) });
                if (fault === 22) Object.assign(InterfaceList, { rootHeight: n < 0 ? null : InterfaceList.rootHeight.slice(0, n) });
                new InterfaceView([widget]).draw();
                break;
            }
        }
    } catch (caught) {
        let e = caught;
        while (e instanceof WrappedException) e = e.cause;
        if (e instanceof TypeError) result = 'null';
        else if (e instanceof RangeError) result = 'bounds';
        else throw e;
    }
    let widgetState = '';
    if (widget !== null) {
        const arrays = [InterfaceList.rootX, InterfaceList.rootY, InterfaceList.rootWidth, InterfaceList.rootHeight, InterfaceList.dirty, InterfaceList.rectangleRedraw];
        widgetState = '|' + [widget.rootIndex, widget.drawCycle, InterfaceList.rootCount].join(',') + '|' + arrays.map(a => (a === null ? 'null' : '[' + a.join(', ') + ']')).join('|');
    }
    return result + '|' + state(before) + widgetState;
}
// Both sprites remain visible. The right one samples the heat after the update,
// even when a later Java array access interrupted the update.
async function checkRepeatedDraws(dir: string): Promise<void> {
    const frames: SdRasterFrame[] = [];
    const nativeFrames: Buffer[] = [];
    // Normal title tick, bad first load, short heat array, and signed row-count overflow.
    for (let mode = 0; mode < 4; mode++) {
        const pixels = new Int32Array(256 * 254);
        Pix2D.setPixels(pixels, 256, 254);
        const heat = new Int32Array(mode === 2 ? 32512 : 32768);
        heat[129] = 128;
        TitleFlames.flameBuffer = heat;
        TitleFlames.flameBuffer0 = new Int32Array(32768);
        TitleFlames.flameLineOffset = new Int32Array(256);
        TitleFlames.flameGradient = Int32Array.from({ length: 256 }, (_, i) => i * 65793);
        TitleFlames.flameSprite = new Pix32(128, 254);
        TitleFlames.pendingCycles = TitleFlames.sparks = TitleFlames.phase = TitleFlames.coolingCycle = Client.loopCycle = 0;
        mathRandom.setSeed(18339n);
        const capture = new SdRasterSpans(pixels, 256, 254, true);
        Pix3D.spanTarget = capture;
        Pix2D.pixels = capture.guardedTarget;
        try {
            Pix2D.cls();
            TitleFlames.RenderFlames(0, 0);
            let fault = 2147483647;
            if (mode === 0) TitleFlames.tick();
            else {
                try {
                    TitleFlames.UpdateFlames(mode === 1 ? -1 : mode === 2 ? 1 : -2147483392);
                } catch (error) {
                    if (!(error instanceof RangeError)) throw error;
                    fault = Number(error.message.split(' ').at(-1));
                }
            }
            TitleFlames.RenderFlames(128, 0);
            const native = readFileSync(join(dir, 'repeated-flames-' + mode + '.bin'));
            expect(fault).toBe(native.readInt32LE(0));
            nativeFrames.push(native.subarray(4));
            const frame = capture.finish();
            // The negative source index in case 1 fails before the first store.
            if (mode === 1) expect(frame.assets.length).toBe(256 + heat.length);
            frames.push(frame);
        } finally {
            Pix3D.spanTarget = null;
            Pix2D.pixels = pixels;
        }
    }
    const results = await renderSdFrames(dir, frames, true);
    for (const [i, result] of results.entries()) {
        expect(result.byteLength).toBe(nativeFrames[i].length);
        const mismatch = result.findIndex((pixel, j) => pixel !== nativeFrames[i].readInt32LE(j * 4));
        expect(mismatch, 'first differing pixel in repeated draw ' + i).toBe(-1);
    }
}

loginFixture(
    import.meta.url,
    '530 title flames match the JAR cooling maps, compositing, live raster, real runes and retained partial writes',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-title-flames-'));
        try {
            const archive = localAssets(cachePath, [8]).archive(8);
            TitleFlames.runesGroup = archive.GetGroupId(fromJsString('runes'));
            const runes = requireNonNull(SpriteLoader.loadIndexedSprites(archive, TitleFlames.runesGroup));
            expect(runes.length).toBe(12);
            const javac = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, ...['TitleFlamesOracle', 'ProceduralTextureCacheOracle'].map(n => join(import.meta.dir, 'render', n + '.java'))]);
            expect(javac.exitCode, javac.stderr.toString()).toBe(0);
            const rows = cases();
            const jvm = Bun.spawnSync(
                [
                    'java',
                    '-XX:-OmitStackTraceInFastThrow',
                    '--add-opens=java.base/java.lang=ALL-UNNAMED',
                    '--add-opens=java.base/java.util=ALL-UNNAMED',
                    '-Djava.awt.headless=true',
                    '-cp',
                    dir + delimiter + gamepackPath,
                    'TitleFlamesOracle',
                    cachePath,
                    String(TitleFlames.runesGroup),
                    dir
                ],
                { stdin: Buffer.from(rows.map(r => r.join(' ')).join('\n') + '\n') }
            );
            expect(jvm.exitCode, jvm.stderr.toString()).toBe(0);
            const lines = jvm.stdout.toString().trimEnd().split(/\r?\n/);
            expect(lines.length).toBe(rows.length);
            for (const [i, row] of rows.entries()) {
                const [op, fault, length, , x, y, clip] = row;
                if (op === 9 && fault === 0 && x === 24) {
                    const [result, , , , , publication, , , , , dirty, redraw] = lines[i].split('|');
                    const drawn = clip !== 2 && y === 18;
                    expect(result, row.join(' ')).toBe(clip !== 2 && y === 30 ? 'bounds' : 'ok');
                    expect(publication).toBe('7,' + (0x49024310 + clip) + ',8');
                    expect(JSON.parse(dirty)[7]).toBe(drawn);
                    expect(JSON.parse(redraw)[7]).toBe(drawn);
                }
                if (op === 9 && fault === 20 && length === 7) {
                    const [result, , , , , , , , , , dirty, redraw] = lines[i].split('|');
                    expect(result).toBe('bounds');
                    expect(JSON.parse(dirty)[7]).toBe(true);
                    expect(JSON.parse(redraw)).toHaveLength(7);
                }
                expect(observe(row, archive, runes), row.join(' ')).toBe(lines[i]);
            }
            await checkRepeatedDraws(dir);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    60000
);
