import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import PacketT from '#/io/PacketT.js';
import TextureOp from '#/dash3d/TextureOp.js';
import TextureOpShapes from '#/dash3d/TextureOpShapes.js';
import TextureShape from '#/dash3d/TextureShape.js';
import TextureShapeLine from '#/dash3d/TextureShapeLine.js';
import TextureShapeBezier from '#/dash3d/TextureShapeBezier.js';
import TextureShapeRect from '#/dash3d/TextureShapeRect.js';
import TextureShapeEllipse from '#/dash3d/TextureShapeEllipse.js';
import TextureShapeRaster from '#/dash3d/TextureShapeRaster.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { gamepackPath } from '../reference.js';

const types = [TextureShapeLine, TextureShapeBezier, TextureShapeRect, TextureShapeEllipse];
const coordinates = [
    ['x0', 'y0', 'x1', 'y1'],
    ['x0', 'y0', 'x1', 'y1', 'x2', 'y2', 'x3', 'y3'],
    ['x0', 'y0', 'x1', 'y1'],
    ['centreX', 'centreY', 'radiusX', 'radiusY']
];
type Case = [width: number, height: number, ...commands: string[]];
const line = [0, 151, 1771, 3620, 2100, 0xa987b4, 4],
    bezier = [1, 160, 790, 3690, 900, 3181, 2916, 512, 3777, 0xc1b2a3, 1];
const rect = [2, 310, 675, 3210, 3711, 0xa43287, 0x2255f1, 3],
    ellipse = [3, 2033, 2014, 1256, 1281, 0x9143bb, 0x822000, 2];

function packet(shapes: number[][]): Buffer {
    const data = [shapes.length];
    for (const [kind, ...args] of shapes) {
        data.push(kind);
        for (const v of args.slice(0, coordinates[kind].length)) data.push(v >> 8, v);
        for (const v of args.slice(coordinates[kind].length, -1)) data.push(v >> 16, v >> 8, v);
        data.push(args[args.length - 1]);
    }
    return Buffer.from(data);
}

function cases(): Case[] {
    const out: Case[] = [];
    const shapes = [line, bezier, rect, ellipse];
    for (const shape of shapes) {
        const data = packet([shape]);
        for (let i = 0; i <= data.length; i++) out.push([3, 4, 'd0:' + data.subarray(0, i).toString('hex').replace(/^$/, '-'), 'i255', 'g1']);
    }
    for (const hex of ['null', 'none', '-', '00', '0104', '0300020012', '030aff11']) {
        for (const code of [-1, 0, 1, 9]) out.push([4, 4, 'd0:00', 'd' + code + ':' + hex, 'i255', 'g1']);
    }
    for (const [w, h] of [
        [64, 64],
        [128, 128],
        [64, 128],
        [128, 64],
        [11, 7],
        [7, 11],
        [1, 1],
        [0, 7],
        [4, 0]
    ]) {
        for (const mono of [0, 1]) {
            for (const list of [shapes, shapes.toReversed(), [rect, ellipse, rect], []]) {
                out.push([w, h, 'd1:0' + mono, 'd0:' + packet(list).toString('hex'), 'i255', 'g0', 'g' + (h - 1), 'g0']);
            }
        }
    }
    for (const [w, h] of [
        [15, 9],
        [8, 13],
        [64, 64]
    ])
        for (const k of [0, 1, 2, 3]) {
            const opts = [
                [0, 0, 4096, 4096],
                [-2048, 500, 6400, 3300],
                [3999, 3300, 160, 25],
                [500, 4000, 500, 17],
                [4096, 1, 129, 1],
                [-100, -201, 0, 0],
                [512, 512, 512, 512],
                [2500, 2300, 3800, 2900],
                [2500, 2300, 300, 300],
                [0, 0, 4095, 1666]
            ];
            for (const [i, pos] of opts.entries()) {
                const pts = k === 1 ? [...pos, pos[2] + 200, pos[1] - 291, pos[0] - 200, pos[3] + 654] : pos;
                if (k === 3 && (pts[2] < 0 || pts[3] < 0)) continue;
                for (const thickness of [0, 1, 3, 9]) {
                    const fill = i % 3 === 1 ? -1 : 0x1ec330,
                        edge = i % 3 === 2 ? -1 : 0x640a57;
                    const shape = k < 2 ? [k, ...pts, edge, thickness] : [k, ...pts, fill, edge, thickness];
                    out.push([w, h, 'r0', 'n' + shape.join(','), 'u0,0', 'u0,1', 'u0,2', 'r' + (i % 3), 'i255', 'g2']);
                }
            }
        }
    const packed = 'd0:' + packet(shapes).toString('hex');
    for (const capacity of [0, 1, 2, 255]) for (const mono of [0, 1]) out.push([9, 6, 'd1:0' + mono, packed, 'i' + capacity, 'g2', 'g2', 'g0', 'g-1']);
    for (const mono of [0, 1])
        for (const row of [0, 2, 4])
            for (const c of [0, 1, 2])
                for (const len of [-1, 0, 3]) {
                    out.push([9, 7, 'd1:0' + mono, packed, 'i255', 'b' + [row, c, len].join(','), 'g1', 'g1', 'g3']);
                }
    for (const mode of [0, 1, 2, 3, 4])
        for (const mono of [0, 1]) {
            out.push([9, 7, 'p' + mode, 'd1:0' + mono, 'i255', 'g1', 'g3']);
            out.push([9, 7, 'p' + mode, 'r3']);
        }
    return out;
}

type Pixels = Int32Array | null | Pixels[];
function trace([width, height, ...commands]: Case): string {
    const op = new TextureOpShapes(),
        other = Array.from({ length: height }, () => new Int32Array(width));
    TextureOp.width = TextureOp.height = -1;
    TextureOp.setSize(width, height);
    TextureShapeRaster.raster = null;
    TextureShapeRaster.circleWidths = null;
    TextureShapeRaster.clipMinX = 5;
    TextureShapeRaster.clipMaxX = 6;
    TextureShapeRaster.clipTop = 7;
    TextureShapeRaster.clipMaxY = 8;
    let last: Pixels = null,
        p: PacketT | null = null,
        replace = 0;
    const ids = new Map<object, number>(),
        log: string[] = [];
    class RecordingShape extends TextureShape {
        constructor(
            readonly id: number,
            fill: number,
            outline: number
        ) {
            super(fill, outline, 2);
        }
        record(mode: string, a: number, b: number): void {
            log.push(this.id + mode + a + ',' + b);
            if (this.id !== 1) return;
            TextureOp.width += 11;
            TextureOp.height--;
            if (replace === 1) Reflect.set(op, 'shapes', [this, new RecordingShape(4, 1, -1), new RecordingShape(5, -1, 1)]);
            if (replace === 2) Reflect.set(op, 'shapes', null);
            if (replace === 3) requireNonNull(op['shapes'])[1] = null;
            if (replace === 4) {
                TextureShapeRaster.raster = other;
                TextureShapeRaster.clipMinX = 31;
                TextureShapeRaster.clipMaxY = -8;
            }
        }
        override fill(a: number, b: number): void {
            this.record('f', a, b);
        }
        override outline(a: number, b: number): void {
            this.record('o', a, b);
        }
        override fillAndOutline(a: number, b: number): void {
            this.record('b', a, b);
        }
    }
    function image(value: Pixels): string {
        if (value === null) return '-';
        if (!ids.has(value)) ids.set(value, ids.size + 1);
        const hash = createHash('sha256');
        function write(v: Pixels): void {
            if (v === null) {
                hash.update(Buffer.of(0));
                return;
            }
            const row = v instanceof Int32Array;
            const bytes = Buffer.allocUnsafe(5 + (row ? v.length * 4 : 0));
            bytes[0] = row ? 1 : 2;
            bytes.writeInt32BE(v.length, 1);
            if (row) for (let i = 0; i < v.length; i++) bytes.writeInt32BE(v[i], 5 + i * 4);
            hash.update(bytes);
            if (!row) for (const child of v) write(child);
        }
        write(value);
        return ids.get(value) + '/' + hash.digest('hex');
    }
    function state(): string {
        const shapes = op['shapes'];
        const t =
            shapes === null
                ? '-'
                : '[' +
                  shapes
                      .map(s => {
                          if (s === null) return '_';
                          if (s instanceof RecordingShape) return 'p' + s.id;
                          const kind = types.findIndex(t => s instanceof t);
                          return [kind, ...coordinates[kind].map(f => Reflect.get(s, f)), s.fillColour, s.outlineColour, s.thickness].join(',');
                      })
                      .join('/') +
                  ']';
        const cache = op.monochrome ? op.monochromeImageCache : op.colourImageCache;
        const slots = op.monochrome ? (op.monochromeImageCache?.['pixels'] ?? null) : (op.colourImageCache?.['pixels'] ?? null);
        return [
            p?.m_pos ?? '-',
            t,
            op.monochrome,
            cache?.invalid ?? '-',
            image(slots),
            image(TextureShapeRaster.raster),
            image(last),
            slots === null ? '-' : slots.findIndex(s => s === last),
            image(TextureShapeRaster.circleWidths),
            [TextureShapeRaster.clipMinX, TextureShapeRaster.clipMaxX, TextureShapeRaster.clipTop, TextureShapeRaster.clipMaxY].join(','),
            log.join('/')
        ].join('|');
    }
    const states = [state()];
    for (const cmd of commands) {
        let result = 'ok';
        const rest = cmd.slice(1);
        try {
            switch (cmd[0]) {
                case 'd': {
                    const [code, hex] = rest.split(':');
                    p = hex === 'none' ? null : new PacketT(hex === 'null' ? null : Buffer.from(hex === '-' ? '' : hex, 'hex'));
                    op.decode(p, Number(code));
                    break;
                }
                case 'n': {
                    const [k, ...v] = rest.split(',').map(Number);
                    const shape = Reflect.construct(types[k], v) as TextureShape;
                    Reflect.set(op, 'shapes', [...(op['shapes'] ?? []), shape]);
                    break;
                }
                case 'i':
                    op.cacheCapacity = Number(rest);
                    op.initCache(width, height);
                    break;
                case 'g':
                    last = op.monochrome ? op.getMonochromeOutput(Number(rest)) : op.getColourOutput(Number(rest));
                    break;
                case 'r':
                    op['drawShapes'](other, Number(rest));
                    break;
                case 'u': {
                    const [i, method] = rest.split(',').map(Number),
                        s = requireNonNull(requireNonNull(op['shapes'])[i]);
                    if (method === 0) s.fill(width, height);
                    else if (method === 1) s.outline(width, height);
                    else s.fillAndOutline(height, width);
                    break;
                }
                case 'p':
                    replace = Number(rest);
                    Reflect.set(op, 'shapes', [new RecordingShape(1, 1, 1), new RecordingShape(2, 1, -1), new RecordingShape(3, -1, -1)]);
                    break;
                case 'b': {
                    const [r, ch, len] = rest.split(',').map(Number),
                        row = len < 0 ? null : new Int32Array(len);
                    if (op.monochrome) requireNonNull(requireNonNull(op.monochromeImageCache)['pixels'])[r] = row;
                    else requireNonNull(requireNonNull(requireNonNull(op.colourImageCache)['pixels'])[r])[ch] = row;
                    break;
                }
                case 'm':
                    [TextureOp.widthMask, TextureOp.heightMask] = rest.split(',').map(Number);
                    break;
            }
        } catch (e) {
            if (e instanceof TypeError && /^Null /.test(e.message)) result = 'null';
            else if (e instanceof RangeError && /array index -?\d+$/.test(e.message)) result = 'bounds' + e.message.split(' ').at(-1);
            else if (e instanceof RangeError && e.message === '/ by zero') result = 'arith';
            else if (e instanceof Error && e.message.includes('full image cache')) result = 'partial-cache';
            else throw e;
        }
        states.push(result + ':' + state());
    }
    return states.join(';');
}

test('530 vector shapes match the JAR on clipped rows, decoding, all dispatch modes and partial raster/cache writes', () => {
    const opState = { width: TextureOp.width, height: TextureOp.height, widthMask: TextureOp.widthMask, heightMask: TextureOp.heightMask, normalisedX: TextureOp.normalisedX, normalisedY: TextureOp.normalisedY, sizeScale: TextureOp.sizeScale };
    const r = TextureShapeRaster,
        rasterState = { raster: r.raster, clipMinX: r.clipMinX, clipMaxX: r.clipMaxX, clipTop: r.clipTop, clipMaxY: r.clipMaxY, circleWidths: r.circleWidths };
    const dir = mkdtempSync(join(tmpdir(), 'rs530-shape-'));
    try {
        const rows = cases(),
            lines = rows.map(v => v.join(' '));
        const c = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'TextureShapeOpsOracle.java')]);
        expect(c.exitCode, c.stderr.toString()).toBe(0);
        const java = Bun.spawnSync(['java', '-XX:-OmitStackTraceInFastThrow', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'TextureShapeOpsOracle'], {
            stdin: Buffer.from(lines.join('\n') + '\n'),
            maxBuffer: 32 * 1024 * 1024
        });
        expect(java.exitCode, java.stderr.toString()).toBe(0);
        const expected = java.stdout.toString().trimEnd().split(/\r?\n/);
        expect(expected.length).toBe(rows.length);
        for (const [i, row] of rows.entries()) expect(trace(row), lines[i]).toBe(expected[i]);
    } finally {
        Object.assign(TextureOp, opState);
        Object.assign(TextureShapeRaster, rasterState);
        rmSync(dir, { recursive: true, force: true });
    }
}, 60000);
