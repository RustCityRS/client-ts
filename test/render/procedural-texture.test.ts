import { expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import type Js5 from '#/cache/Js5.js';
import ProceduralTexture from '#/dash3d/ProceduralTexture.js';
import TextureOp from '#/dash3d/TextureOp.js';
import TextureOpSprite from '#/dash3d/TextureOpSprite.js';
import type TextureProvider from '#/dash3d/TextureProvider.js';
import PacketT from '#/io/PacketT.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { gamepackPath } from '../reference.js';

function cases(): string[] {
    const result: string[] = [];
    const add = (...v: unknown[]) => result.push(v.join(' '));
    const token = (bytes: number[]) => 'h' + Buffer.from(bytes).toString('hex');
    for (const id of [-2147483648, -1, ...Array.from({ length: 258 }, (_, i) => i), 2147483647]) add('F', id);
    for (const mode of ['D', 'G']) for (const bad of ['p', 'n', 'h']) add(mode, bad);
    for (let id = 0; id <= 255; id++) {
        const bytes = [73, id, 255, 0];
        for (let k = 0; k <= bytes.length; k++) add('D', token(bytes.slice(0, k)));
        if (id < 40) {
            for (const cap of [0, 1, 2, 255]) add('D', token([31, id, cap, 1, 255]));
            const noChildren = [1, 0, id, 255, 0, 0, 0];
            for (let k = 0; k <= noChildren.length; k++) add('G', token(noChildren.slice(0, k)));
        }
    }
    const binary = (op: number, children: number[] = [], params: number[] = []) => [7, op, 1, params.length ? 1 : 0, ...params, ...children];
    for (const output of [0, 1, 2, 3, 4, 255])
        for (const child of [0, 1, 2, 3, 255]) {
            const bytes = [3, ...binary(7, [child, 2], [0, 1]), ...binary(39, [], [0, 0, 12]), ...binary(36, [], [0, 0, 0]), output, 1];
            for (let k = 0; k <= bytes.length; k++) add('G', token(bytes.slice(0, k)));
        }
    for (const kind of [0, 1, 2, 3, 4, 5]) for (const group of [-1, 0, 1, 7, 2147483647]) for (let stop = 0; stop <= 8; stop++) add('A', kind, group, stop);
    for (const kind of [0, 1, 2, 3, 4, 5, 7, 8])
        for (const [w, h] of [
            [-1, 2],
            [0, 0],
            [0, 3],
            [2, -1],
            [1, 3],
            [4, 3],
            [3, 4],
            [4, 4],
            [19, 4]
        ]) {
            for (const transpose of [0, 1]) for (const flip of [0, 1]) add('R', kind, w, h, 0, transpose, flip, 0.7);
        }
    for (const mode of [1, 2, 3, 4, 5, 6, 8, 9])
        for (const brightness of ['-Infinity', '-1', '-0.5', '0', '0.7', '1', '2', 'Infinity', 'NaN']) {
            for (const [w, h] of [
                [0, 3],
                [3, 4],
                [4, 0],
                [4, 4]
            ])
                add('R', 1, w, h, mode, 0, 0, brightness);
        }
    return result;
}
const map: { classes: { obf: string; deobName: string }[] } = JSON.parse(readFileSync(join(import.meta.dir, '../maps/classmap.json'), 'utf8'));
const names = new Map(map.classes.map(c => [c.deobName, c.obf]));
function describe(node: TextureOp | null): string {
    if (node === null) return '-';
    return [names.get(node.constructor.name), node.monochrome, node.cacheCapacity, requireNonNull(node.children).length, node.getSpriteId(), node.getTextureId()].join(',');
}
function fault(e: unknown): string {
    if (!(e instanceof Error)) throw e;
    if (e instanceof TypeError) return 'null';
    if (e.message.includes('zero')) return 'arith';
    if (e instanceof RangeError) return /size|length/i.test(e.message) ? 'size' : 'bounds';
    return e.message;
}
const ints = (v: Int32Array | null) => (v === null ? 'null' : '[' + v.join(', ') + ']');
function decode(graph: boolean, token: string) {
    const p = token === 'p' ? null : new PacketT(token === 'n' ? null : Buffer.from(token.slice(1), 'hex'));
    let value: string;
    try {
        if (!graph) value = describe(ProceduralTexture.decodeOp(p));
        else {
            const def = new ProceduralTexture(p);
            const nodes = requireNonNull(def['operators']);
            const all = nodes.map(
                op =>
                    describe(op) +
                    '[' +
                    requireNonNull(requireNonNull(op).children)
                        .map(c => nodes.indexOf(c))
                        .join(',') +
                    ']'
            );
            value = [all.join('/'), nodes.indexOf(def['colour']), nodes.indexOf(def['alpha']), ints(def['textureIds']), ints(def['spriteIds'])].join(':');
        }
    } catch (e) {
        value = fault(e);
    }
    return (p?.m_pos ?? -1) + ':' + value;
}
class Probe extends TextureOp {
    constructor(
        private kind: number,
        private trace: string[]
    ) {
        super(0, (kind & 1) === 0);
    }
    private values(y: number) {
        return Int32Array.from({ length: this.kind === 4 ? 1 : 18 }, (_, i) => (y * 1709 + i * 913 - 79) % 8000);
    }
    override getMonochromeOutput(row: number) {
        this.trace.push('m' + row);
        return this.kind === 2 ? null : this.values(row);
    }
    override getColourOutput(row: number) {
        this.trace.push('c' + row);
        if (this.kind === 3) return null;
        if (this.kind === 5) return [this.values(row)];
        return [this.values(row), this.kind === 7 ? null : this.values(row + 4), this.values(row + 9)];
    }
    override clearImageCache() {
        this.trace.push('d' + this.kind);
        if (this.kind === 8) throw new RangeError('/ by zero');
        super.clearImageCache();
    }
}
function run(command: string): string {
    const [cmd, ...args] = command.split(' ');
    if (cmd === 'F') return describe(ProceduralTexture.createOp(Number(args[0])));
    if (cmd === 'D' || cmd === 'G') return decode(cmd === 'G', args[0]);
    const trace: string[] = [];
    const provider = Object.create(null) as TextureProvider,
        archive = Object.create(null) as Js5;
    if (cmd === 'A') {
        const [mode, group, stop] = args.map(Number);
        const ready = (text: string) => {
            trace.push(text);
            TextureOpSprite.spriteGroupId = (TextureOpSprite.spriteGroupId + 2) | 0;
            return trace.length !== stop;
        };
        provider.isLoaded = id => ready('t' + id);
        archive.RequestDownload2 = id => ready('s' + id);
        archive.RequestDownload = (_check, g, id) => ready('f' + g + ',' + id);
        const def = new ProceduralTexture();
        def['spriteIds'] = mode === 1 ? null : mode === 2 ? new Int32Array(0) : Int32Array.of(0, 12, 4);
        def['textureIds'] = mode === 3 ? null : Int32Array.of(6, 3, 0, 5);
        TextureOpSprite.spriteGroupId = group;
        let value: string;
        try {
            value = String(def.isReady(mode === 4 ? null : provider, mode === 5 ? null : archive));
        } catch (e) {
            value = fault(e);
        }
        return [value, TextureOpSprite.spriteGroupId, trace.join(',')].join(':');
    }
    const [kind, w, h, mode, transpose, flip, brightness] = args.map(Number);
    const def = new ProceduralTexture(),
        p = new Probe(kind, trace),
        extra = new Probe(0, trace);
    p.cacheCapacity = mode === 4 ? -1 : 255;
    extra.cacheCapacity = 1;
    if (mode !== 9) {
        def['operators'] = [extra, mode === 2 ? null : p, mode === 3 ? null : extra];
        def['colour'] = mode === 1 ? null : p;
    }
    ProceduralTexture.gammaTable = mode === 5 ? new Int32Array(3) : mode === 6 ? null : new Int32Array(256);
    ProceduralTexture.tableBrightness = mode === 8 ? brightness : -1;
    TextureOp.width = TextureOp.height = TextureOp.widthMask = TextureOp.heightMask = TextureOp.sizeScale = 0;
    TextureOp.normalisedX = TextureOp.normalisedY = null;
    TextureOp.textureProvider = null;
    TextureOpSprite.spriteArchive = null;
    let rendered: string;
    try {
        rendered = ints(def.getPixels(provider, archive, transpose === 1, w, flip === 1, brightness, h));
    } catch (e) {
        rendered = fault(e);
    }
    const gamma = ProceduralTexture.gammaTable?.reduce((acc, n) => (Math.imul(31, acc) + n) | 0, 1) ?? 0;
    const bits = new DataView(new ArrayBuffer(8));
    bits.setFloat64(0, ProceduralTexture.tableBrightness);
    return [
        rendered,
        trace.join(','),
        [p.colourImageCache !== null, p.monochromeImageCache !== null, extra.monochromeImageCache !== null].join(','),
        [TextureOp.width, TextureOp.height, TextureOp.normalisedX === TextureOp.normalisedY, TextureOp.textureProvider === provider, TextureOpSprite.spriteArchive === archive, gamma, bits.getBigInt64(0)].join(',')
    ].join('|');
}
test('530 graph factory, constructor, dependency callbacks, render fault order and brightness match the gamepack', () => {
    const state = { ...TextureOp },
        sprite = { ...TextureOpSprite },
        def = { ...ProceduralTexture };
    const dir = mkdtempSync(join(tmpdir(), 'procedural-texture-'));
    try {
        const module = 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
        const cc = Bun.spawnSync(['javac', '--add-exports', module, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'ProceduralTextureOracle.java')]);
        expect(cc.exitCode, cc.stderr.toString()).toBe(0);
        const argv = ['java', '-Djava.awt.headless=true', '--add-exports', module, '-cp', dir + delimiter + gamepackPath, 'ProceduralTextureOracle'];
        const patch = Bun.spawnSync([...argv, dir]);
        expect(patch.exitCode, patch.stderr.toString()).toBe(0);
        const commands = cases();
        const jvm = Bun.spawnSync(argv, { stdin: Buffer.from(commands.join('\n') + '\n'), maxBuffer: 8 * 1024 * 1024 });
        expect(jvm.exitCode, jvm.stderr.toString()).toBe(0);
        const lines = jvm.stdout.toString().trimEnd().split(/\r?\n/);
        expect(lines.length).toBe(commands.length);
        for (const [i, c] of commands.entries()) expect(run(c), c).toBe(lines[i]);
    } finally {
        Object.assign(TextureOp, state);
        Object.assign(TextureOpSprite, sprite);
        Object.assign(ProceduralTexture, def);
        rmSync(dir, { recursive: true, force: true });
    }
}, 30000);
