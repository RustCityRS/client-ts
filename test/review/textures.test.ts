import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Js5 from '../../src/cache/Js5.js';
import Js5Index from '../../src/cache/Js5Index.js';
import Js5ResourceProvider from '../../src/cache/Js5ResourceProvider.js';
import SecondaryNode from '../../src/datastruct/SecondaryNode.js';
import ProceduralTexture from '../../src/dash3d/ProceduralTexture.js';
import Texture from '../../src/dash3d/Texture.js';
import TextureCache from '../../src/dash3d/TextureCache.js';
import TextureOp from '../../src/dash3d/TextureOp.js';
import TextureOpSprite from '../../src/dash3d/TextureOpSprite.js';
import Crc32 from '../../src/io/Crc32.js';
import PacketT from '../../src/io/PacketT.js';
import { requireNonNull } from '../../src/util/JavaArray.js';
import { readGroup } from '../cachefile.js';
import { cachePath, gamepackPath } from '../reference.js';
import { withClinitStatics } from './staticState.js';

// kg (TextureCache, src/dash3d/TextureCache.ts) and qi (Texture, src/dash3d/Texture.ts) against client.jar,
// through textures/TextureCacheOracle.java, which drives the real kg/qi/jd over the real cache archives 9 (texture
// programs), 26 (texture metadata) and 8 (sprites); only the JS5 disk provider is substituted on both sides.
//
// One seeded script runs through both. Every result line must match: the return value (booleans, the average colour,
// or a texel array as <identity tag>:<length>:<Arrays.hashCode>, where the tag is the order the array object was
// first seen, so cache hits returning the same object, rebuilds, and RunAnim's swap with nk.N are compared as
// aliasing, not only content), or the Java exception (aioobe/npe/cce, unwrapped from the obfuscator's g).
//
// Coverage: every metadata column of the constructor (including the four byte columns and the flag the SD client
// never reads) and kg.G/kg.q; GetTextureColour/GetTextureSmall/isAvailable/GetTextureSolid for every id, -1 and
// count; isLoaded and getPixels (64 and 128, transposed and not, nested textures) for every archive-9 group plus
// missing and out-of-range ids; getTextureData for every texture at brightness 0.7, then a seeded random phase over
// a small working set: cache hits at the same float, rebuilds at 0.6/0.8/0.9/1.0, 0.0 vs -0.0 (fcmpl equal), NaN
// (never equal), the smooth (box filter) textures, RunAnims with zero, negative and large tick counts and the used
// flag, setLowMemory both ways (forced 64x64 and the cache clear), ClearCache, capacities 1/2/3/20/50 (LRU eviction
// order), and a foreign node in the LRU (GetTexture's and RunAnims' checkcasts). A dump after selected operations
// lists the LRU in hash-table order with each texture's used flag, brightness bits, smooth/transpose flags, scroll
// speeds and texels, and nk.N (Texture.animBuffer).

class CacheDisk extends Js5ResourceProvider {
    readonly table: Js5Index;
    constructor(private readonly archive: number) {
        super();
        const ref = readGroup(cachePath, 255, archive);
        this.table = new Js5Index(ref, Crc32.prefix(ref, ref.length));
    }
    index() {
        return this.table;
    }
    group(_mode: number, group: number) {
        return readGroup(cachePath, this.archive, group);
    }
    prefetchGroup() {}
    GetGroupLoadPercentage() {
        return 100;
    }
}

const f32 = new Float32Array(1);
const i32 = new Int32Array(f32.buffer);
function floatBits(value: number): number {
    f32[0] = value;
    return i32[0];
}
function bitsFloat(bits: number): number {
    i32[0] = bits;
    return f32[0];
}

function hashInts(a: ArrayLike<number>): number {
    let h = 1;
    for (let i = 0; i < a.length; i++) h = (Math.imul(31, h) + a[i]) | 0;
    return h;
}

function classify(e: unknown): string {
    if (e instanceof RangeError) return 'aioobe';
    if (e instanceof TypeError && e.message.startsWith('ClassCastException')) return 'cce';
    if (e instanceof TypeError && e.message.startsWith('Null')) return 'npe';
    throw e;
}

// Seeded LCG (Java's Random constants) for the script.
class Lcg {
    private seed: bigint;
    constructor(seed: number) {
        this.seed = (BigInt(seed) ^ 0x5deece66dn) & ((1n << 48n) - 1n);
    }
    next(bits: number): number {
        this.seed = (this.seed * 0x5deece66dn + 0xbn) & ((1n << 48n) - 1n);
        return Number(BigInt.asIntN(32, this.seed >> BigInt(48 - bits)));
    }
    int(bound: number): number {
        return ((this.next(31) % bound) + bound) % bound;
    }
    pick<T>(values: readonly T[]): T {
        return values[this.int(values.length)];
    }
}

const BRIGHTNESS = [0.6, 0.7, 0.8, 0.9, 1.0].map(v => floatBits(v));
const SPECIAL = [floatBits(0.0), floatBits(-0.0), 0x7fc00000, floatBits(0.7)];

function buildScript(count: number, groups: number[], animated: number[], smooth: number[]): string[] {
    const script: string[] = [];
    const dump = () => script.push('dump');
    script.push('new 20 0', 'meta');
    for (let id = -1; id <= count; id++) script.push(`colour ${id}`, `small ${id}`, `avail ${id}`, `solid ${id}`);
    const present = new Set(groups);
    const missing = [-1, count, count + 1, 65535];
    for (let id = 0; id < count; id++) if (!present.has(id)) missing.push(id);
    const ids = [...groups, ...missing];
    for (const id of ids) script.push(`loaded ${id}`);
    for (const id of ids) script.push(`pix ${id}`);
    dump();
    for (const id of ids) script.push(`data ${id} ${floatBits(0.7)}`);
    dump();
    script.push('anim 1');
    dump();
    script.push('anim 7');
    dump();

    const random = new Lcg(530);
    for (const [capacity, low] of [
        [3, 0],
        [20, 0],
        [1, 0],
        [2, 1],
        [50, 0],
        [20, 1]
    ] as const) {
        script.push(`new ${capacity} ${low}`, 'meta');
        // A working set a few times the capacity, so hits, misses and evictions all happen.
        const working = Array.from({ length: Math.min(groups.length, capacity * 3 + 4) }, () => random.pick(groups));
        working.push(random.pick(missing));
        for (let n = 0; n < 220; n++) {
            const roll = random.int(100);
            const id = random.pick(working);
            if (roll < 50) {
                const bits = random.int(8) === 0 ? random.pick(SPECIAL) : random.pick(BRIGHTNESS);
                script.push(`data ${id} ${bits}`);
            } else if (roll < 62) {
                script.push(`anim ${random.pick([0, 1, 1, 2, 3, -1, -5, 17, 64, 127, 1000, -2147483648, 2147483647])}`);
            } else if (roll < 68) {
                script.push(`pix ${id}`);
            } else if (roll < 72) {
                script.push(`loaded ${id}`);
            } else if (roll < 76) {
                script.push(`small ${id}`, `avail ${id}`, `solid ${id}`, `colour ${id}`);
            } else if (roll < 78) {
                script.push(`low ${random.int(2)}`);
            } else if (roll < 79) {
                script.push('clear');
            } else {
                dump();
            }
        }
        dump();
    }
    // The scrolling and smoothed textures, at both sizes. Only textures whose texels were fetched since the last
    // RunAnims are animated. After low-memory mode is switched on, nk.N is still 16384 long, so RunAnim hands a 64x64
    // texture a 16384-entry array, and the next RunAnim treats it as 128x128 (Java behaviour, kept).
    const d8 = floatBits(0.8);
    const targets = [...animated, ...smooth.slice(0, 6)];
    script.push('new 50 0');
    for (const id of targets) script.push(`data ${id} ${d8}`);
    dump();
    for (const ticks of [1, 2, -3, 50, 0, 129, -2147483648, 2147483647]) {
        script.push(`anim ${ticks}`);
        dump();
        script.push(`anim ${ticks}`);
        for (const id of animated) script.push(`data ${id} ${d8}`);
    }
    script.push('anim 5', 'dump', 'low 1');
    for (const id of targets) script.push(`data ${id} ${d8}`);
    for (const ticks of [1, 3, 1, -7]) {
        script.push(`anim ${ticks}`);
        dump();
        for (const id of animated) script.push(`data ${id} ${d8}`);
    }
    script.push('low 0');
    for (const id of targets) script.push(`data ${id} ${floatBits(0.6)}`);
    script.push('anim 2', 'dump');
    // The cached-brightness test is fcmpl: 0.0 and -0.0 match (same array back), NaN never matches (rebuilt).
    const nan = 0x7fc00000;
    for (const bits of [floatBits(0.0), floatBits(-0.0), floatBits(0.0), nan, nan, floatBits(0.7), floatBits(0.7), floatBits(-0.0)]) {
        script.push(`data ${targets[0]} ${bits}`, `data ${groups[2]} ${bits}`);
    }
    script.push('dump');
    // State injection for paths the real cache cannot reach. No texture scrolls along x only: override the speeds of a
    // cached one. Every archive-9 group id is below the metadata count: put a decoded texture under keys past it, so
    // getTextureData reaches E[id] (aioobe unless low-memory mode short-circuits it).
    const s = targets[0];
    script.push(
        'new 8 0',
        `data ${s} ${d8}`,
        `scroll ${s} 3 0`,
        'anim 2',
        'dump',
        `data ${s} ${d8}`,
        `scroll ${s} -1 0`,
        'anim 5',
        'dump',
        `data ${s} ${d8}`,
        `scroll ${s} 0 0`,
        'anim 5',
        'dump',
        `data ${s} ${d8}`,
        `scroll ${s} 0 1`,
        'anim 1',
        'dump'
    );
    script.push(`inject ${s} ${count}`, `inject ${groups[3]} 70000`, `data ${count} ${d8}`, `data 70000 ${d8}`, `pix ${count}`, `loaded ${count}`, 'low 1', `inject ${s} ${count}`, `data ${count} ${d8}`, `pix ${count}`, 'anim 1', 'dump', 'low 0');
    // Checkcasts: a non-qi node in the LRU.
    script.push(
        'new 4 0',
        `data ${groups[0]} ${floatBits(0.7)}`,
        `foreign ${groups[1]}`,
        'dump',
        `data ${groups[1]} ${floatBits(0.7)}`,
        `loaded ${groups[1]}`,
        `pix ${groups[1]}`,
        'anim 1',
        'dump',
        'clear',
        `data ${groups[1]} ${floatBits(0.7)}`,
        'anim 1',
        'dump'
    );
    return script;
}

function runPort(script: string[], textures: Js5, meta: Js5, sprites: Js5): string[] {
    const seen = new Map<object, number>();
    const ints = (a: Int32Array | null): string => {
        if (a === null) return 'null';
        let tag = seen.get(a);
        if (tag === undefined) {
            tag = seen.size;
            seen.set(a, tag);
        }
        return `#${tag}:${a.length}:${hashInts(a)}`;
    };
    const bools = (a: boolean[]): string => a.map(b => (b ? '1' : '0')).join('');
    const out: string[] = [];
    let cache: TextureCache | null = null;
    for (const line of script) {
        const op = line.split(' ');
        let result: string;
        try {
            const c = (): TextureCache => requireNonNull(cache);
            switch (op[0]) {
                case 'new':
                    cache = new TextureCache(textures, meta, sprites, Number(op[1]), op[2] === '1');
                    result = 'ok';
                    break;
                case 'meta': {
                    const k = c();
                    const parts = [k['exists'], k['available'], k['solid'], k['small'], k['flag4']].map(bools);
                    for (const a of [k['byte5'], k['byte6'], k['byte7'], k['byte8']]) parts.push(`${a.length}:${hashInts(a)}`);
                    parts.push(`${k['averageColour'].length}:${hashInts(k['averageColour'])}`, String(k['lowMemory']), String(k['capacity']));
                    result = parts.join('|');
                    break;
                }
                case 'colour':
                    result = String(c().getTextureColour(Number(op[1])));
                    break;
                case 'small':
                    result = String(c().getTextureSmall(Number(op[1])));
                    break;
                case 'avail':
                    result = String(c().isAvailable(Number(op[1])));
                    break;
                case 'solid':
                    result = String(c().getTextureSolid(Number(op[1])));
                    break;
                case 'loaded':
                    result = String(c().isLoaded(Number(op[1])));
                    break;
                case 'pix':
                    result = ints(c().getPixels(Number(op[1])));
                    break;
                case 'data':
                    result = ints(c().getTextureData(Number(op[1]), bitsFloat(Number(op[2]))));
                    break;
                case 'anim':
                    c().RunAnims(Number(op[1]));
                    result = 'ok';
                    break;
                case 'low':
                    c().setLowMemory(op[1] === '1');
                    result = 'ok';
                    break;
                case 'clear':
                    c().ClearCache();
                    result = 'ok';
                    break;
                case 'foreign':
                    c()['recentUse'].Put(BigInt(op[1]), new SecondaryNode());
                    result = 'ok';
                    break;
                case 'inject':
                    c()['recentUse'].Put(BigInt(op[2]), new Texture(new PacketT(requireNonNull(textures).GetFile(0, Number(op[1])))));
                    result = 'ok';
                    break;
                case 'scroll': {
                    const t = c()['recentUse'].Find(BigInt(op[1]));
                    if (!(t instanceof Texture)) throw new Error('scroll needs a cached texture');
                    t['scrollX'] = Number(op[2]);
                    t['scrollY'] = Number(op[3]);
                    result = 'ok';
                    break;
                }
                case 'dump': {
                    const table = c()['recentUse'];
                    let s = '';
                    for (let node = table.head(); node !== null; node = table.next()) {
                        if (!(node instanceof Texture)) {
                            s += `${node.key}:foreign;`;
                            continue;
                        }
                        s += `${node.key}:${node.used ? 1 : 0}:${floatBits(node['brightness'])}:${node['smooth'] ? 1 : 0}${node['transposed'] ? 1 : 0}:`;
                        s += `${node['scrollX']},${node['scrollY']}:${ints(node['pixels'])};`;
                    }
                    result = s + 'N=' + ints(Texture.animBuffer);
                    break;
                }
                default:
                    throw new Error(line);
            }
        } catch (e) {
            result = '!' + classify(e);
        }
        out.push(result);
    }
    return out;
}

test('530 TextureCache (kg) and Texture (qi) match client.jar over the real texture archives', () => {
    const textureDisk = new CacheDisk(9);
    const groups = Array.from(requireNonNull(textureDisk.table.groupIds));
    const textures = new Js5(textureDisk, false, true);
    const meta = new Js5(new CacheDisk(26), false, true);
    const sprites = new Js5(new CacheDisk(8), false, true);
    const count = new PacketT(requireNonNull(meta.GetFile(0, 0))).g2();
    // Script inputs only: which textures scroll or are smoothed (qi.T/qi.K and qi.Q), from the decoded files.
    const animated: number[] = [],
        smooth: number[] = [];
    for (const id of groups) {
        const texture = new Texture(new PacketT(requireNonNull(textures.GetFile(0, id))));
        if (texture['scrollX'] !== 0 || texture['scrollY'] !== 0) animated.push(id);
        if (texture['smooth']) smooth.push(id);
    }
    expect(animated.length).toBeGreaterThan(0);
    expect(smooth.length).toBeGreaterThan(0);
    const script = buildScript(count, groups, animated, smooth);

    const dir = mkdtempSync(join(tmpdir(), '530-textures-'));
    let expected: string[];
    try {
        const compile = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'textures', 'TextureCacheOracle.java')]);
        expect(compile.exitCode, compile.stderr.toString()).toBe(0);
        const java = Bun.spawnSync(['java', '-Xmx1g', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'TextureCacheOracle', cachePath], {
            stdin: Buffer.from(script.join('\n') + '\n'),
            maxBuffer: 64 * 1024 * 1024,
            timeout: 300000
        });
        expect(java.exitCode, java.stderr.toString()).toBe(0);
        expected = java.stdout.toString().trimEnd().split(/\r?\n/);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }

    const actual = withClinitStatics(
        [
            { target: Texture, clinit: { animBuffer: null } },
            { target: ProceduralTexture, clinit: { gammaTable: new Int32Array(256), tableBrightness: -1.0 } },
            { target: TextureOp, clinit: { textureProvider: null } },
            { target: TextureOpSprite, clinit: { spriteGroupId: -1, spriteArchive: null } }
        ],
        () => runPort(script, textures, meta, sprites)
    );

    expect(expected.length).toBe(script.length);
    const differences: string[] = [];
    for (let i = 0; i < script.length; i++) {
        if (actual[i] !== expected[i]) differences.push(`${i} ${script[i]}\n  ts:   ${actual[i]?.slice(0, 400)}\n  java: ${expected[i]?.slice(0, 400)}`);
    }
    expect(differences.slice(0, 10), `${differences.length} of ${script.length} lines differ`).toEqual([]);

    // The script must actually reach the interesting paths.
    const results = new Map<string, number>();
    for (let i = 0; i < script.length; i++) {
        const key = script[i].split(' ')[0] + (expected[i].startsWith('!') ? expected[i] : expected[i] === 'null' ? ':null' : '');
        results.set(key, (results.get(key) ?? 0) + 1);
    }
    expect([...results.keys()].sort()).toEqual(expect.arrayContaining(['anim!cce', 'colour!aioobe', 'data', 'data!aioobe', 'data!cce', 'data:null', 'pix', 'pix!aioobe', 'pix:null', 'loaded', 'small!aioobe']));
}, 900000);
