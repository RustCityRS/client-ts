import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import TextureOp from '#/dash3d/TextureOp.js';
import WrappedException from '#/util/WrappedException.js';
import type { ColourImageRow } from '#/dash3d/ColourImageCache.js';
import SecondaryNode from '#/datastruct/SecondaryNode.js';
import SecondaryByteArrayNode from '#/datastruct/SecondaryByteArrayNode.js';
import LruHashTable from '#/datastruct/LruHashTable.js';
import JavaRandom from '#/util/JavaRandom.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { gamepackPath } from '../reference.js';

class Plain extends TextureOp {}
class Source extends TextureOp {
    single: Int32Array | null;
    rgb: ColourImageRow | null;
    row = 0;
    constructor(mono: boolean, shape: number) {
        super(0, mono);
        this.single = shape === 1 ? null : Int32Array.of(301, 302);
        this.rgb = shape === 1 ? null : shape === 2 ? [] : [this.single, null, this.single];
    }
    override getMonochromeOutput(y: number) {
        this.row = y;
        return this.single;
    }
    override getColourOutput(y: number) {
        this.row = y;
        return this.rgb;
    }
}

function attempt(op: () => unknown): string {
    try {
        return String(op());
    } catch (error) {
        let cause = error;
        while (cause instanceof WrappedException) cause = cause.cause;
        if (!(cause instanceof Error)) throw cause;
        if (cause.message.startsWith('ClassCastException')) return 'cast';
        if (cause instanceof TypeError) return 'null-ref';
        if (cause.message === 'IllegalArgumentException') return 'argument';
        if (cause.message.startsWith('array index')) return 'bounds';
        if (cause instanceof RangeError) return 'size';
        if (cause.message.startsWith('This operation')) return cause.message;
        throw cause;
    }
}

function* results(): Generator<string> {
    const refs = new Map<object, number>();
    function id(ref: object | null): number {
        if (ref === null) return 0;
        const tag = refs.get(ref) ?? refs.size + 1;
        refs.set(ref, tag);
        return tag;
    }
    const parent = new Plain(2, false);
    parent.decode(null, 2147483647);
    parent.postDecode();
    yield [requireNonNull(parent.children).length, parent.cacheCapacity, parent.monochrome, parent.getTextureId(), parent.getSpriteId(), attempt(() => parent.getMonochromeOutput(7)), attempt(() => parent.getColourOutput(7))].join(' ');
    for (const mono of [false, true])
        for (let shape = 0; shape < 5; shape++) {
            const source = new Source(mono, shape);
            refs.clear();
            id(source.single);
            id(source.rgb);
            parent.children = shape === 4 ? null : [shape === 3 ? null : source, null];
            for (const child of [-1, 0, 1, 2, -2147483648, 0])
                for (const y of [-131, 0, 123]) {
                    const rgb = attempt(() => {
                        const pixels = parent.getChildColourOutput(y, child);
                        return [id(pixels), ...(pixels ?? []).map(id)].join(',');
                    });
                    const single = attempt(() => id(parent.getChildMonochromeOutput(child, y)));
                    yield [rgb, single, source.row].join(' ');
                }
        }
    for (const cap of [-1, 0, 1, 2, 255])
        for (const height of [-1, 0, 1, 3])
            for (const width of [-2, 0, 1, 4]) {
                refs.clear();
                const node = new Plain(0, true);
                for (const mono of [true, false, true, false]) {
                    node.monochrome = mono;
                    node.cacheCapacity = cap;
                    const init = attempt(() => {
                        node.initCache(width, height);
                        return 'ok';
                    });
                    const incoming = id(node.colourImageCache),
                        other = id(node.monochromeImageCache);
                    for (const row of [0, 1, 0, 2, 1]) {
                        const got = attempt(() => id(requireNonNull(mono ? node.monochromeImageCache : node.colourImageCache).get(row)));
                        yield [init, incoming, other, got].join(' ');
                    }
                    if (!mono)
                        for (let i = 0; i < 2; i++) {
                            const cleared = attempt(() => {
                                node.clearImageCache();
                                return 'ok';
                            });
                            yield [cleared, id(node.colourImageCache), id(node.monochromeImageCache)].join(' ');
                        }
                }
            }
    refs.clear();
    const hash = (a: Int32Array | null) => a?.reduce((h, n) => (Math.imul(h, 31) + n) | 0, 1) ?? 0;
    for (const w of [0, 1, 3, 5, 64, 128, 0, 7, -1, 65, 524289])
        for (const h of [0, 3, 3, w, -1, 1, 64, 5]) {
            const result = attempt(() => {
                TextureOp.setSize(w, h);
                return 'ok';
            });
            yield [result, TextureOp.width, TextureOp.height, TextureOp.widthMask, TextureOp.heightMask, TextureOp.sizeScale, id(TextureOp.normalisedX), id(TextureOp.normalisedY), hash(TextureOp.normalisedX), hash(TextureOp.normalisedY)].join(' ');
        }
    for (const mask of [0, 3, 1, 3, 2, 3, 0, 3]) {
        if (!(mask & 1)) TextureOp.sinTable = null;
        if (!(mask & 2)) TextureOp.cosine = null;
        TextureOp.initTrigTables();
        const sin = requireNonNull(TextureOp.sinTable),
            cos = requireNonNull(TextureOp.cosine);
        yield [id(sin), id(cos), '[' + sin.join(', ') + ']', '[' + cos.join(', ') + ']'].join(' ');
        sin[0] = 3;
        cos[0] = 5;
    }
    refs.clear();
    for (const seed of [0, 1, -1, 12589, -2147483648, 2147483647]) {
        const r = new JavaRandom(BigInt(seed));
        for (const bound of [-1, 0, 1, 2, 3, 15, 16, 17, 127, 128, 129, 255, 256, 257, 67108864, 1073741825, 2147483647]) {
            for (let i = 0; i < 12; i++) yield attempt(() => TextureOp.nextInt(r, bound));
            yield attempt(() => TextureOp.nextInt(null, bound));
        }
    }
    TextureOp.permutationCache = new LruHashTable(16);
    for (let i = 0; i < 122; i++) {
        const seed = i < 62 ? (i % 19) - 9 : [-1, 0, 1, 2147483647, -2147483648, 3, 0][i % 7];
        const p = requireNonNull(TextureOp.getPermutation(seed));
        yield id(p) + ' [' + new Int8Array(p.buffer, p.byteOffset, p.length).join(', ') + ']';
        p[0] = i;
    }
    TextureOp.permutationCache.Put(-4n, new SecondaryNode());
    yield attempt(() => TextureOp.getPermutation(-4));
    TextureOp.permutationCache.Put(-9n, new SecondaryByteArrayNode(null));
    yield attempt(() => id(TextureOp.getPermutation(-9)));
    TextureOp.permutationCache = null;
    yield attempt(() => TextureOp.getPermutation(7));
}

test('530 procedural texture base matches Java child and cache identities, coordinate tables and seeded permutations', () => {
    const globals = { width: 0, height: 0, widthMask: 0, heightMask: 0, sizeScale: 0, normalisedX: null, normalisedY: null, sinTable: null, cosine: null, permutationCache: null };
    const saved = Object.fromEntries(Object.keys(globals).map(k => [k, TextureOp[k as keyof typeof globals]]));
    const dir = mkdtempSync(join(tmpdir(), 'texture-op-'));
    try {
        Object.assign(TextureOp, globals);
        const cc = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'TextureOpOracle.java')]);
        expect(cc.exitCode, cc.stderr.toString()).toBe(0);
        const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'TextureOpOracle'], { maxBuffer: 4 * 1024 * 1024 });
        expect(java.exitCode, java.stderr.toString()).toBe(0);
        const lines = java.stdout.toString().trimEnd().split(/\r?\n/);
        let n = 0;
        for (const result of results()) {
            expect(result, 'oracle line ' + (n + 1)).toBe(lines[n++]);
        }
        expect(n).toBe(lines.length);
    } finally {
        Object.assign(TextureOp, saved);
        rmSync(dir, { recursive: true, force: true });
    }
}, 20000);
