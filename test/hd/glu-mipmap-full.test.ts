import { expect, test } from 'bun:test';
import Mipmap from '#/jogl/glu/mipmap/Mipmap.js';
import { type Block, blockLine, type Case, compareAll, type DataKind, javaRun, make, probeReads, random, randomBytes, runCase, store } from './gluMipmapHarness.js';

// Every format x type combination the shipped jogl.jar's gluBuild2DMipmaps accepts, run through the real jogl.jar
// code (GluMipmapOracle.java) and through the port, comparing every GL call and every level's bytes.
// - Mipmap.checkMipmapArgs accepts the 12 legal formats except GL_STENCIL_INDEX with all 20 legal types: JOGL's
//   isLegalFormatForPackedPixelType returns true for every packed type, so packed types pair with any format.
// - Sizes: power-of-two squares and rectangles (HalveImage 2D then 1D chains), 1xN and Nx1 (halve1Dimage_*),
//   and non-power-of-two sizes (ScaleInternal.scale_internal_*, enlarging and reducing).
// - Pixel-store modes the code reads: unpack alignment 1/2/4/8 (and 0), row length, skip rows/pixels, swap bytes
//   and, for GL_BITMAP, LSB-first; the pack modes are read back too (retrieveStoreModes) and the unpack modes are
//   restored at the end.
// - closestFit's answers: proxy limits below the size (ScaleInternal's exact 2:1 HalveImage shortcut), the
//   GL_MAX_TEXTURE_SIZE fallback (GL_VERSION 1.0), a 1x1 limit.
// - Data kinds: heap/direct ByteBuffers, a ByteBuffer at a non-zero position and Short/Int/FloatBuffers (GLU copies
//   them into native-order direct buffers), and Mipmap's byte[]/short[]/int[]/float[] arms (big-endian direct).
// - Image.fill_image called directly for every non-bitmap type (its only jogl.jar caller passes GL_BITMAP), with
//   index_format on and off.
// - Errors: short data, skips past the end, alignment 0, null data.
// - Blocks the cases above never enter (section 11, held by the block-entry probe test): the 1-row swap branch of
//   halve1Dimage_ushort/short/uint/int/float and the scale_internal_* blocks that need a reduction of 2:1 or more on
//   one axis, alone or with swap bytes.
// - HalveImage.halveImage and ScaleInternal.scale_internal called directly with 1-4 component shorts (section 12).
// A third test pins the one known divergence: GL_FLOAT levels computed from NaN input (GLTRACE.md section 19).

const FORMATS = [6400, 6402, 6403, 6404, 6405, 6406, 6407, 6408, 6409, 6410, 32992, 32993];
const TYPES = [6656, 5120, 5121, 5122, 5123, 5124, 5125, 5126, 32818, 33634, 33635, 33636, 32819, 33637, 32820, 33638, 32821, 33639, 32822, 33640];
const TYPE_NAMES: Record<number, string> = {
    6656: 'bitmap',
    5120: 'byte',
    5121: 'ubyte',
    5122: 'short',
    5123: 'ushort',
    5124: 'int',
    5125: 'uint',
    5126: 'float',
    32818: '332',
    33634: '233rev',
    33635: '565',
    33636: '565rev',
    32819: '4444',
    33637: '4444rev',
    32820: '5551',
    33638: '1555rev',
    32821: '8888',
    33639: '8888rev',
    32822: '1010102',
    33640: '2101010rev'
};
const SWAP = 3312,
    LSB = 3313,
    ROW_LENGTH = 3314,
    SKIP_ROWS = 3315,
    SKIP_PIXELS = 3316,
    ALIGNMENT = 3317;

function isPacked(type: number): boolean {
    return type >= 32818;
}

// A natural format for each type: the packed 3-component types take GL_RGB, the 4-component ones GL_RGBA.
function naturalFormat(type: number): number {
    if (type === 32818 || type === 33634 || type === 33635 || type === 33636) return 6407;
    return 6408;
}

interface Modes {
    rowlen: number;
    skiprows: number;
    skippixels: number;
    align: number;
}

// Bytes the caller's image needs under the given unpack modes (generous for GL_BITMAP, whose MSB-first branch reads
// one byte per bit).
function dataLength(w: number, h: number, fmt: number, type: number, m: Modes): number {
    const comps = Mipmap.elements_per_group(fmt, type);
    const groupsPerLine = m.rowlen > 0 ? m.rowlen : w;
    const align = m.align > 0 ? m.align : 1;
    const pad = (n: number) => (n % align === 0 ? n : n + align - (n % align));
    if (type === 6656) {
        const rowsize = pad(Math.ceil((groupsPerLine * comps) / 8));
        return m.skiprows * rowsize + Math.ceil((m.skippixels * comps) / 8) + h * Math.max(rowsize, w * comps) + 8;
    }
    const group = Mipmap.bytes_per_element(type) * comps;
    const rowsize = pad(groupsPerLine * group);
    return m.skiprows * rowsize + m.skippixels * group + h * rowsize;
}

// GL_FLOAT data keeps bit 6 of every byte clear, so whichever byte a reinterpretation makes the high byte, each float
// is finite (no NaN payload can reach a host conversion).
function payload(length: number, type: number, seed: number): Uint8Array {
    const bytes = randomBytes(length, seed);
    if (type === 5126) for (let i = 0; i < bytes.length; i++) bytes[i] = (bytes[i] ?? 0) & 0xbf;
    return bytes;
}

let seedCounter = 1;

function storeOf(m: Modes, extra: Record<number, number> = {}): number[] {
    return store({ [ROW_LENGTH]: m.rowlen, [SKIP_ROWS]: m.skiprows, [SKIP_PIXELS]: m.skippixels, [ALIGNMENT]: m.align, ...extra });
}

function build(id: string, w: number, h: number, fmt: number, type: number, m: Modes, extra: Partial<Case> = {}, storeExtra: Record<number, number> = {}, lengthDelta = 0): Case {
    const length = Math.max(0, dataLength(w, h, fmt, type, m) + lengthDelta);
    return make(id, w, h, {
        fmt,
        type,
        ifmt: fmt === 6400 ? 6408 : fmt,
        store: storeOf(m, storeExtra),
        bytes: payload(length, type, seedCounter++ * 7919),
        ...extra
    });
}

const PLAIN: Modes = { rowlen: 0, skiprows: 0, skippixels: 0, align: 4 };

function corpus(): Case[] {
    const cases: Case[] = [];
    const add = (c: Case) => cases.push(c);

    // 1. every accepted format x type, five sizes each
    const sizes: [number, number][] = [
        [4, 4],
        [8, 2],
        [1, 4],
        [3, 5],
        [5, 1]
    ];
    for (const fmt of FORMATS)
        for (const type of TYPES)
            for (const [w, h] of sizes) {
                add(build(`m-${fmt}-${TYPE_NAMES[type]}-${w}x${h}`, w, h, fmt, type, PLAIN));
            }

    // 2. unpack alignment and swap bytes, per type
    for (const type of TYPES)
        for (const swap of [0, 1])
            for (const align of [1, 2, 4, 8])
                for (const [w, h] of [
                    [4, 4],
                    [3, 3],
                    [2, 8],
                    [7, 1],
                    [6, 6]
                ] as const) {
                    const fmt = type === 6656 ? 6409 : naturalFormat(type);
                    add(build(`a-${TYPE_NAMES[type]}-s${swap}-a${align}-${w}x${h}`, w, h, fmt, type, { ...PLAIN, align }, {}, { [SWAP]: swap }));
                }
    // swap with the other formats' component counts
    for (const type of TYPES)
        for (const fmt of [6406, 6410, 6407, 32993]) {
            add(build(`sf-${TYPE_NAMES[type]}-${fmt}`, 4, 2, fmt, type, PLAIN, {}, { [SWAP]: 1 }));
            add(build(`sfn-${TYPE_NAMES[type]}-${fmt}`, 3, 2, fmt, type, PLAIN, {}, { [SWAP]: 1 }));
        }

    // 3. row length and skips, per type (skips move the start of GLU's scaled read; halving reads from 0)
    const skipModes: Modes[] = [
        { rowlen: 7, skiprows: 0, skippixels: 0, align: 4 },
        { rowlen: 0, skiprows: 1, skippixels: 0, align: 4 },
        { rowlen: 0, skiprows: 0, skippixels: 2, align: 1 },
        { rowlen: 9, skiprows: 2, skippixels: 3, align: 8 }
    ];
    for (const type of TYPES)
        for (const [mi, m] of skipModes.entries())
            for (const swap of [0, 1])
                for (const [w, h] of [
                    [4, 4],
                    [3, 5],
                    [1, 2]
                ] as const) {
                    const fmt = type === 6656 ? 6408 : naturalFormat(type);
                    add(build(`k-${TYPE_NAMES[type]}-m${mi}-s${swap}-${w}x${h}`, w, h, fmt, type, m, {}, { [SWAP]: swap }));
                }

    // 4. GL_BITMAP: LSB-first, bit offsets from skip pixels, row length, alignment, index and non-index formats
    for (const lsb of [0, 1])
        for (const skippixels of [0, 1, 3, 7, 9])
            for (const align of [1, 4, 8])
                for (const fmt of [6400, 6409, 6408]) {
                    for (const [w, h] of [
                        [8, 4],
                        [5, 3],
                        [16, 1]
                    ] as const) {
                        add(build(`bm-l${lsb}-p${skippixels}-a${align}-${fmt}-${w}x${h}`, w, h, fmt, 6656, { rowlen: 0, skiprows: 0, skippixels, align }, {}, { [LSB]: lsb }));
                    }
                }
    for (const lsb of [0, 1])
        for (const fmt of [6400, 6410, 32992]) {
            add(build(`bm-rl-l${lsb}-${fmt}`, 6, 4, fmt, 6656, { rowlen: 11, skiprows: 1, skippixels: 5, align: 2 }, {}, { [LSB]: lsb, [SWAP]: 1 }));
        }

    // 5. closestFit's answers below the size: proxy limits, the GL_MAX_TEXTURE_SIZE fallback, a 1x1 limit
    for (const type of TYPES) {
        const fmt = type === 6656 ? 6400 : naturalFormat(type);
        const n = TYPE_NAMES[type];
        add(build(`f-${n}-8x8-max4`, 8, 8, fmt, type, PLAIN, { max: 4 }));
        add(build(`f-${n}-8x8-gl10-max4`, 8, 8, fmt, type, PLAIN, { max: 4, ver: '1.0' }));
        add(build(`f-${n}-6x6-max4`, 6, 6, fmt, type, PLAIN, { max: 4 }));
        add(build(`f-${n}-16x4-max8`, 16, 4, fmt, type, PLAIN, { max: 8 }));
        add(build(`f-${n}-8x8-max1`, 8, 8, fmt, type, PLAIN, { max: 1 }));
        add(build(`f-${n}-8x8-max4-swap`, 8, 8, fmt, type, PLAIN, { max: 4 }, { [SWAP]: 1 }));
        add(build(`f-${n}-12x3-gl10-max8-swap`, 12, 3, fmt, type, PLAIN, { max: 8, ver: '1.0' }, { [SWAP]: 1 }));
    }

    // 6. data kinds: GLU's buffer copies (native-order direct) and Mipmap's array arms (big-endian direct)
    const kinds: [string, Partial<Case>][] = [
        ['bbdirect', { data: 'bbdirect' }],
        ['bbheap-pos2', { pos: 2 }],
        ['sbheap', { data: 'sbheap' }],
        ['ibheap', { data: 'ibheap' }],
        ['fbheap', { data: 'fbheap' }],
        ['mm-bytes', { entry: 'mipmap', data: 'bytes' }],
        ['mm-shorts', { entry: 'mipmap', data: 'shorts' }],
        ['mm-ints', { entry: 'mipmap', data: 'ints' }],
        ['mm-floats', { entry: 'mipmap', data: 'floats' }],
        ['mm-heap-pos4', { entry: 'mipmap', pos: 4 }]
    ];
    for (const type of TYPES)
        for (const [name, extra] of kinds)
            for (const [w, h] of [
                [4, 4],
                [3, 2]
            ] as const) {
                const fmt = type === 6656 ? 6400 : naturalFormat(type);
                const m = PLAIN;
                // whole elements for the Short/Int/FloatBuffer and array arms, plus the start offset
                const pos = extra.pos ?? 0;
                let length = dataLength(w, h, fmt, type, m) + 8;
                length += 4 - (length % 4);
                const bytes = payload(length + (name === 'bbheap-pos2' || name === 'mm-heap-pos4' ? pos : 0), type, seedCounter++ * 7919);
                add(make(`d-${TYPE_NAMES[type]}-${name}-${w}x${h}`, w, h, { fmt, type, ifmt: fmt === 6400 ? 6408 : fmt, store: storeOf(m, { [SWAP]: 1 }), bytes, ...extra }));
            }

    // 7. errors: short data, a skip past the end, alignment 0, null data
    for (const type of TYPES) {
        const fmt = type === 6656 ? 6400 : naturalFormat(type);
        const n = TYPE_NAMES[type];
        add(build(`e-${n}-short-pot`, 4, 4, fmt, type, PLAIN, {}, {}, -3));
        add(build(`e-${n}-short-npot`, 3, 5, fmt, type, PLAIN, {}, {}, -5));
        add(build(`e-${n}-short-1d`, 1, 8, fmt, type, PLAIN, {}, {}, -1));
        add(build(`e-${n}-skip-past-end`, 2, 2, fmt, type, { rowlen: 0, skiprows: 9, skippixels: 0, align: 4 }, {}, {}, -dataLength(2, 2, fmt, type, { rowlen: 0, skiprows: 9, skippixels: 0, align: 4 }) + 4));
        add(build(`e-${n}-align0`, 4, 4, fmt, type, { ...PLAIN, align: 0 }));
        add(build(`e-${n}-mm-null`, 4, 4, fmt, type, PLAIN, { entry: 'mipmap', data: 'null' }));
        add(build(`e-${n}-mm-object`, 4, 4, fmt, type, PLAIN, { entry: 'mipmap', data: 'object' }));
        add(build(`e-${n}-glu-null`, 4, 4, fmt, type, PLAIN, { data: 'null' }));
    }

    // 8. Image.fill_image directly, every non-bitmap type (the bitmap branch runs through cases 1-5)
    for (const type of TYPES)
        for (const fmt of [6408, 6407, 6409, 6400])
            for (const index of [false, true])
                for (const swap of [0, 1]) {
                    if (type === 6656) continue;
                    const m = PLAIN;
                    const w = 3,
                        h = 2;
                    // packed types write 3 or 4 shorts per pixel whatever the format; give room for 4
                    const cap = w * h * 4 * 2;
                    add(build(`fill-${TYPE_NAMES[type]}-${fmt}-i${index ? 1 : 0}-s${swap}`, w, h, fmt, type, m, { entry: 'fill', cap, index }, { [SWAP]: swap }));
                }
    for (const type of TYPES) {
        if (type === 6656) continue;
        const fmt = naturalFormat(type);
        const n = TYPE_NAMES[type];
        for (const [mi, m] of skipModes.entries()) {
            add(build(`fillk-${n}-m${mi}`, 3, 3, fmt, type, m, { entry: 'fill', cap: 3 * 3 * 4 * 2 }, { [SWAP]: 1 }));
        }
        // the exact capacity Image's caller would allocate (image_size(w, h, format, GL_UNSIGNED_SHORT)): packed
        // types overrun it with one-component formats
        add(build(`fillx-${n}-lum`, 2, 2, 6409, type, PLAIN, { entry: 'fill', cap: Mipmap.image_size(2, 2, 6409, 5123) }));
        add(build(`fillx-${n}-rgba`, 2, 2, 6408, type, PLAIN, { entry: 'fill', cap: Mipmap.image_size(2, 2, 6408, 5123) }));
        add(build(`fills-${n}-short`, 3, 2, 6408, type, PLAIN, { entry: 'fill', cap: 3 * 2 * 4 * 2 }, {}, -2));
        add(build(`fill-${n}-null`, 3, 2, 6408, type, PLAIN, { entry: 'fill', cap: 3 * 2 * 4 * 2, data: 'null' }));
        add(build(`fill-${n}-align0`, 3, 2, 6408, type, { ...PLAIN, align: 0 }, { entry: 'fill', cap: 3 * 2 * 4 * 2 }));
    }

    // 9. short data where ScaleInternal enlarges on both axes (its single-sample branch, where scale_internal_uint
    // makes an absolute getInt before the relative reads): the exception class pins the read order
    for (const type of TYPES)
        for (const delta of [-1, -2, -4, -7])
            for (const [w, h] of [
                [3, 3],
                [3, 6],
                [5, 3]
            ] as const) {
                add(build(`es-${TYPE_NAMES[type]}-${w}x${h}-d${-delta}`, w, h, naturalFormat(type), type, PLAIN, {}, {}, delta));
            }
    // a 3x1 one-component image with under 4 bytes: the first sample read is the single-sample branch's (for
    // scale_internal_uint the absolute getInt throws IndexOutOfBoundsException, not BufferUnderflowException)
    for (const type of TYPES)
        for (const delta of [-9, -10, -12]) {
            add(build(`es1-${TYPE_NAMES[type]}-d${-delta}`, 3, 1, 6409, type, PLAIN, {}, {}, delta));
        }

    // 10. the Extract classes directly: extract under both byte orders and swap flags at several positions, then
    // shove of given floats (in and out of [0, 1], rounding boundaries, NaN and infinities) at several indices,
    // including reads and writes past the end
    const next = random(530);
    const bits = (v: number) => ((new Int32Array(new Float32Array([v]).buffer)[0] ?? 0) >>> 0).toString(16);
    const maxes = [3, 7, 15, 31, 63, 255, 1023];
    for (const type of TYPES.filter(isPacked)) {
        const n = TYPE_NAMES[type];
        const size = Mipmap.bytes_per_element(type);
        let k = 0;
        const extractCase = (order: string, swap: number, data: DataKind, pos: number, index: number, floats: number[], length = 16) => {
            add(make(`x-${n}-${k++}`, 1, 1, { entry: 'extract', type, data, pos, bytes: randomBytes(length, seedCounter++ * 7919), x: [order, swap, index, ...floats.map(bits)].join(',') }));
        };
        for (const order of ['be', 'le'])
            for (const swap of [0, 1])
                for (const data of ['bbheap', 'bbdirect'] as const)
                    for (const pos of [0, 1, 3]) {
                        extractCase(
                            order,
                            swap,
                            data,
                            pos,
                            Math.floor(next() * 3),
                            Array.from({ length: 4 }, () => next() * 1.5 - 0.25)
                        );
                    }
        for (const max of maxes)
            for (let j = 0; j < 3; j++) {
                const c = Math.floor(next() * max);
                extractCase('le', 0, 'bbdirect', 0, j, [(c + 0.5) / max, (c + 0.4999) / max, (c + 0.5001) / max, c / max]);
            }
        extractCase('be', 1, 'bbheap', 2, 1, [NaN, Infinity, -Infinity, 1e10]);
        extractCase('le', 0, 'bbheap', 0, 0, [-1e10, -0, 2, -0.75]);
        // past the end: extract underflows, shove's index lands on or past the limit
        extractCase('be', 0, 'bbheap', 16 - size + 1, 0, [0.5, 0.5, 0.5, 0.5]);
        extractCase('le', 1, 'bbdirect', 16, 0, [0.5, 0.5, 0.5, 0.5]);
        extractCase('be', 0, 'bbheap', 0, Math.floor(16 / size), [0.25, 0.5, 0.75, 1]);
        extractCase('le', 0, 'bbdirect', 4, Math.floor(16 / size) - 1, [0.25, 0.5, 0.75, 1]);
        extractCase('be', 0, 'bbheap', 0, Math.floor(16 / size) + 3, [0.25, 0.5, 0.75, 1]);
        extractCase('be', 0, 'bbheap', 0, -1, [0.25, 0.5, 0.75, 1]);
    }

    // 11. blocks sections 1-10 never enter (BLOCKS below; the block-entry probe test holds them), for every
    // non-bitmap type, swap bytes off and on, and three component counts (the natural format, LUMINANCE and
    // LUMINANCE_ALPHA):
    // - power-of-two Nx1 and 1xN: the first halving of the user's data takes the 1-row swap branch of
    //   halve1Dimage_*. Swap applies only to the user's data, and a non-power-of-two Nx1 is resampled first.
    // - reductions of 2:1 or more on one axis: the y-only branch's middle rows, the x-only branch's middle columns,
    //   and the swap arms of the both-axes branch's edge columns and body in scale_internal_*. Proxy limits clamp
    //   both axes together (closestFit halves both), so a y-only reduction needs width 1 or the GL_VERSION 1.0
    //   path, which clamps each axis to GL_MAX_TEXTURE_SIZE on its own.
    // Proxy sizes whose axes reach 1 at different steps (3x12 at max 4, 7x20 at max 2) are left out: closestFit's
    // level-1 width of a width-1 power goes to 0, the recorder answers 0 for it, and the do-while never ends, in
    // jogl.jar and in the port alike.
    const reduced: [number, number, number, string | null][] = [
        [1, 12, 4, null],
        [12, 1, 4, null],
        [12, 12, 4, null],
        [12, 6, 4, null],
        [6, 12, 4, null],
        [24, 1, 4, null],
        [8, 8, 1, null],
        [16, 16, 2, null],
        [3, 24, 4, '1.0'],
        [24, 3, 4, '1.0'],
        [5, 12, 4, '1.0'],
        [12, 5, 4, '1.0'],
        [1, 12, 4, '1.0'],
        [12, 12, 4, '1.0']
    ];
    for (const type of TYPES) {
        if (type === 6656) continue;
        const n = TYPE_NAMES[type];
        for (const swap of [0, 1])
            for (const fmt of [naturalFormat(type), 6409, 6410]) {
                for (const [w, h, max, ver] of reduced) {
                    add(build(`blk-${n}-${fmt}-s${swap}-${w}x${h}-max${max}-${ver ?? 'nv'}`, w, h, fmt, type, PLAIN, ver === null ? { max } : { max, ver }, { [SWAP]: swap }));
                }
                for (const [w, h] of [
                    [8, 1],
                    [16, 1],
                    [2, 1],
                    [4, 1],
                    [1, 8]
                ] as const) {
                    add(build(`blk-${n}-${fmt}-s${swap}-${w}x${h}-pot`, w, h, fmt, type, PLAIN, {}, { [SWAP]: swap }));
                }
            }
    }

    // 12. HalveImage.halveImage and ScaleInternal.scale_internal directly: random shorts with 1-4 components, in a
    // native-order direct ShortBuffer (as bitmapBuild2DMipmaps allocates them) and a heap one. Exact halving, odd
    // sizes, scale_internal's exact-2:1 shortcut, reductions, enlargements and an identity size; an output one short
    // too small (BufferOverflowException for halveImage's relative puts, IndexOutOfBoundsException for
    // scale_internal's absolute ones); a datain position that neither routine uses.
    const shortCase = (id: string, entry: 'halve' | 'scale', w: number, h: number, components: number, data: DataKind, outShorts: number, x: string, pos = 0) => {
        add(make(id, w, h, { entry, data, pos, bytes: randomBytes(w * h * components * 2, seedCounter++ * 7919), cap: outShorts * 2, x }));
    };
    for (const components of [1, 2, 3, 4])
        for (const data of ['sbdirect', 'sbheap'] as const) {
            for (const [w, h] of [
                [2, 2],
                [4, 2],
                [2, 4],
                [6, 4],
                [8, 8],
                [4, 6],
                [3, 3],
                [5, 2]
            ] as const) {
                const out = (w >> 1) * (h >> 1) * components;
                shortCase(`halve-c${components}-${data}-${w}x${h}`, 'halve', w, h, components, data, out, String(components));
            }
            shortCase(`halve-c${components}-${data}-6x4-short`, 'halve', 6, 4, components, data, 3 * 2 * components - 1, String(components));
            shortCase(`halve-c${components}-${data}-4x4-pos3`, 'halve', 4, 4, components, data, 2 * 2 * components, String(components), 3);
            const scales: [number, number, number, number][] = [
                [4, 4, 2, 2],
                [8, 2, 4, 1],
                [6, 6, 4, 4],
                [5, 3, 2, 2],
                [7, 1, 3, 1],
                [1, 7, 1, 3],
                [9, 6, 4, 5],
                [12, 5, 3, 2],
                [3, 2, 5, 7],
                [2, 2, 4, 3],
                [1, 1, 3, 2],
                [3, 3, 3, 3]
            ];
            for (const [w, h, wout, hout] of scales) {
                shortCase(`scale-c${components}-${data}-${w}x${h}-${wout}x${hout}`, 'scale', w, h, components, data, wout * hout * components, [components, wout, hout].join(','));
            }
            shortCase(`scale-c${components}-${data}-6x6-4x4-short`, 'scale', 6, 6, components, data, 4 * 4 * components - 1, [components, 4, 4].join(','));
            shortCase(`scale-c${components}-${data}-5x3-2x2-pos3`, 'scale', 5, 3, components, data, 2 * 2 * components, [components, 2, 2].join(','), 3);
        }
    return cases;
}

// The image reads of the blocks section 11 is there to enter (lines found from their source text, see blockLine).
const Y_ONLY = '} else if (highy_int > lowy_int) {',
    MID_ROWS = 'for (m = (lowy_int + 1) | 0; m < highy_int; m++) {';
const X_ONLY = '} else if (highx_int > lowx_int) {',
    MID_COLS = 'for (l = (lowx_int + 1) | 0; l < highx_int; l++) {';
const EDGE_COLS = '// calculate the value for the pixels in the 1st and last column',
    BODY = '// this is for the pixels in the body';
const SWAP_ARM = 'if (myswap_bytes) {',
    PLAIN_ARM = '} else {';
const BLOCKS: Block[] = [
    // halve1Dimage_*: the 1-row branch's swap arm
    ...['ushort', 'short', 'uint', 'int', 'float'].map(t => ({ file: 'HalveImage' as const, method: 'halve1Dimage_' + t, path: ['if (height === 1) {', SWAP_ARM] })),
    // scale_internal_*: the y-only branch's middle rows (both arms where there is a swap), the swap arms of the
    // both-axes edge columns and of the body, and the plain arm of the x-only branch's middle columns
    { file: 'ScaleInternal', method: 'scale_internal_ubyte', path: [Y_ONLY, MID_ROWS] },
    { file: 'ScaleInternal', method: 'scale_internal_byte', path: [Y_ONLY, MID_ROWS] },
    ...['ushort', 'uint', 'int', 'float'].flatMap(t => [
        { file: 'ScaleInternal' as const, method: 'scale_internal_' + t, path: [Y_ONLY, MID_ROWS, SWAP_ARM] },
        { file: 'ScaleInternal' as const, method: 'scale_internal_' + t, path: [Y_ONLY, MID_ROWS, PLAIN_ARM] },
        { file: 'ScaleInternal' as const, method: 'scale_internal_' + t, path: [EDGE_COLS, SWAP_ARM] },
        { file: 'ScaleInternal' as const, method: 'scale_internal_' + t, path: [BODY, SWAP_ARM] },
        { file: 'ScaleInternal' as const, method: 'scale_internal_' + t, path: [X_ONLY, MID_COLS, PLAIN_ARM] }
    ])
];

// One corpus for every test in this file, so the seeds of sections 1-10 stay what they were.
let corpusCache: Case[] | null = null;
function corpusCases(): Case[] {
    corpusCache ??= corpus();
    return corpusCache;
}

test('GLU mipmap port matches the shipped jogl.jar for every format x type, pixel-store mode, size and data kind', () => {
    const cases = corpusCases();
    expect(new Set(cases.map(c => c.id)).size).toBe(cases.length);
    const java = javaRun(cases);
    expect(java.size).toBe(cases.length);

    const mismatches = compareAll(cases, java);
    expect(mismatches.length + ' mismatches\n' + mismatches.slice(0, 8).join('\n')).toBe('0 mismatches\n');

    // the corpus reaches what it claims to
    const blocks = [...java.values()].map(lines => lines.join('\n'));
    const count = (re: RegExp) => blocks.filter(b => re.test(b)).length;
    // every type uploads levels, as its own type (GL_BITMAP as GL_UNSIGNED_SHORT shorts)
    for (const type of TYPES) {
        if (type === 6656) continue;
        expect(count(new RegExp('\\tglTexImage2D\\t3553\\t\\d+\\t\\d+\\t\\d+\\t\\d+\\t0\\t\\d+\\t' + type + '\\tB:byte:')), TYPE_NAMES[type]).toBeGreaterThan(20);
    }
    expect(count(/\tglTexImage2D\t3553\t\d+\t\d+\t\d+\t\d+\t0\t\d+\t5123\tB:short:/)).toBeGreaterThan(100);
    // successes, and each exception class the errors produce
    expect(count(/\nresult\t0\n/)).toBeGreaterThan(2000);
    for (const thrown of ['java.nio.BufferUnderflowException', 'java.lang.IndexOutOfBoundsException', 'java.lang.IllegalArgumentException', 'java.lang.ArithmeticException', 'java.lang.NullPointerException']) {
        expect(count(new RegExp('\\nthrow\\t' + thrown.replace(/\./g, '\\.') + '\\n')), thrown).toBeGreaterThan(0);
    }
    // fill_image, halveImage and scale_internal output compared whole
    expect(count(/\nimage\t/)).toBeGreaterThan(300);
    const direct = cases.filter(c => c.entry === 'halve' || c.entry === 'scale');
    expect(direct.length).toBe(192);
    expect(direct.filter(c => /\nresult\t0\n.*\nimage\t/s.test(java.get(c.id)?.join('\n') ?? '')).length).toBe(176);
    for (const thrown of ['java.nio.BufferOverflowException', 'java.lang.IndexOutOfBoundsException']) {
        expect(direct.filter(c => (java.get(c.id) ?? []).includes('throw\t' + thrown)).length, thrown).toBe(8);
    }
    // section 11 builds every level, except where jogl.jar itself throws BufferUnderflowException (the port with it):
    // 1x12 at max 4 and 8x8 at the 1x1 limit, for some of the non-packed type/format pairs
    const unbuilt = cases.filter(c => c.id.startsWith('blk-') && !(java.get(c.id) ?? []).includes('result\t0'));
    expect(unbuilt.length).toBe(102);
    expect(unbuilt.filter(c => !isPacked(c.type) && /-(1x12-max4-(nv|1\.0)|8x8-max1-nv)$/.test(c.id) && (java.get(c.id) ?? []).includes('throw\tjava.nio.BufferUnderflowException')).length).toBe(102);
    const levels = blocks.reduce((n, b) => n + (b.match(/\tglTexImage2D\t3553\t/g)?.length ?? 0), 0);
    console.log('glu-mipmap-full: ' + cases.length + ' cases, ' + levels + ' levels compared');
}, 600000);

test('the corpus enters every block of BLOCKS (block-entry probe), and the probe tells an entered block from a dark one', () => {
    const lines = BLOCKS.map(b => ({ name: b.method + ' ' + b.path.join(' > '), at: b.file + ':' + blockLine(b) }));
    expect(new Set(lines.map(l => l.at)).size).toBe(BLOCKS.length);

    // the probe itself: a power-of-two 8x1 GL_UNSIGNED_SHORT image enters halve1Dimage_ushort's 1-row swap arm with
    // swap bytes on and not with them off
    const swapArm = lines[0]?.at ?? '';
    expect(swapArm).toMatch(/^HalveImage:\d+$/);
    const probe = (swap: number) => probeReads(() => runCase(make('probe-s' + swap, 8, 1, { type: 5123, store: store({ [SWAP]: swap }), bytes: randomBytes(64, 1) })));
    const off = probe(0),
        on = probe(1);
    expect(off.size).toBeGreaterThan(0);
    expect(off.has(swapArm)).toBe(false);
    expect(on.has(swapArm)).toBe(true);

    // section 11 enters them all (sections 1-10 enter none of them)
    const hits = probeReads(() => {
        for (const c of corpusCases()) if (c.id.startsWith('blk-')) runCase(c);
    });
    expect(lines.filter(l => !hits.has(l.at)).map(l => l.at + ' ' + l.name)).toEqual([]);
}, 600000);

// Known host divergence (GLTRACE.md section 19): Java's float arithmetic keeps a NaN operand's payload and sign
// through halveImage_float/halve1Dimage_float/scale_internal_float, the port's computed levels hold JavaScriptCore's
// canonical NaN 7fc00000. Pinned exactly: every differing line is a GL_FLOAT level the port computed (level 1 and
// up, or level 0 of a resampled non-power-of-two image), it equals Java's line once Java's NaNs are made canonical,
// and the input (level 0 of a power-of-two image, passed through) keeps its payloads on both sides.
test('GL_FLOAT levels computed from NaN input differ from jogl.jar only by the canonical NaN (known host divergence)', () => {
    const patterns = [0x7fc00001, 0xffc00000, 0x7f800001, 0x7fa00000, 0xff812345, 0x3f800000, 0x40000000, 0x7f800000, 0xff800000, 0x00000001];
    const floats = (n: number, seed: number) => {
        const bytes = new Uint8Array(n * 4);
        const view = new DataView(bytes.buffer);
        for (let i = 0; i < n; i++) view.setUint32(i * 4, patterns[(i * 7 + seed) % patterns.length] ?? 0, false);
        return bytes;
    };
    const nanCases: Case[] = [];
    let seed = 0;
    for (const swap of [0, 1])
        for (const [w, h] of [
            [4, 4],
            [2, 1],
            [1, 2],
            [3, 3],
            [8, 2],
            [5, 1]
        ] as const) {
            for (const [name, extra] of [
                ['bbheap', {}],
                ['fbheap', { data: 'fbheap' }],
                ['mm-floats', { entry: 'mipmap', data: 'floats' }]
            ] as const) {
                nanCases.push(make(`nan-${name}-s${swap}-${w}x${h}`, w, h, { type: 5126, bytes: floats(w * h * 4, seed++), store: store({ [SWAP]: swap }), ...extra }));
            }
            nanCases.push(make(`nan-lum-s${swap}-${w}x${h}`, w, h, { type: 5126, fmt: 6409, ifmt: 6409, bytes: floats(w * h, seed++), store: store({ [SWAP]: swap }) }));
        }
    const java = javaRun(nanCases);
    expect(java.size).toBe(nanCases.length);

    // little-endian float words (the levels are native-order direct buffers), every NaN made 7fc00000
    const canonical = (hexBytes: string) =>
        hexBytes.replace(/[0-9a-f]{8}/g, word => {
            const bits = parseInt(word.slice(6, 8) + word.slice(4, 6) + word.slice(2, 4) + word.slice(0, 2), 16);
            return (bits & 0x7f800000) === 0x7f800000 && (bits & 0x7fffff) !== 0 ? '0000c07f' : word;
        });
    const pow2 = (n: number) => (n & (n - 1)) === 0;
    let divergent = 0,
        passedThrough = 0;
    for (const c of nanCases) {
        const j = java.get(c.id) ?? [];
        const t = runCase(c);
        expect(t.length, c.id).toBe(j.length);
        for (let i = 0; i < t.length; i++) {
            const tl = t[i] ?? '',
                jl = j[i] ?? '';
            const level = /^\d+\tglTexImage2D\t3553\t(\d+)\t\d+\t\d+\t\d+\t0\t\d+\t5126\tB:byte:\d+:\d+:\d+:\w+:([0-9a-f]*)$/.exec(tl);
            const computed = level !== null && (level[1] !== '0' || !pow2(c.w) || !pow2(c.h));
            // passed-through input holding the 7fc00001 payload (big-endian user data or a native-order copy)
            if (level !== null && !computed && tl === jl && /7fc00001|0100c07f/.test(level[2] ?? '')) passedThrough++;
            if (tl === jl) continue;
            divergent++;
            expect(computed, c.id + ' line ' + i + ' differs outside a computed GL_FLOAT level\n  java: ' + jl + '\n  ts:   ' + tl).toBe(true);
            const prefix = tl.slice(0, tl.lastIndexOf(':') + 1);
            const ts = tl.slice(prefix.length);
            expect(jl.startsWith(prefix), c.id + ' line ' + i).toBe(true);
            expect(canonical(ts), c.id + ' line ' + i + ': the port keeps a NaN payload').toBe(ts);
            expect(canonical(jl.slice(prefix.length)), c.id + ' line ' + i).toBe(ts);
        }
    }
    // the divergence is real (Java keeps payloads in computed levels), and passed-through input is compared exactly
    expect(divergent).toBeGreaterThan(40);
    expect(passedThrough).toBeGreaterThan(10);
}, 600000);
