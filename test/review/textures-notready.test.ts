import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Js5 from '../../src/cache/Js5.js';
import Js5Index from '../../src/cache/Js5Index.js';
import Js5ResourceProvider from '../../src/cache/Js5ResourceProvider.js';
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

// kg (TextureCache) and qi (Texture) against client.jar when the procedural inputs are NOT ready, through
// textures-notready/TextureNotReadyOracle.java. textures.test.ts always has every sprite and nested texture on disk,
// so it never reaches the "not ready" branches. Here the disk withholds chosen groups of archive 8 (sprites) and 9
// (textures) while "hide" is in force, on both sides:
// - isLoaded (kg.a(IB)Z -> qi.a(Lal;BLpc;)Z -> jd.a(Lpc;BLal;)Z) false for missing sprites and for nested textures whose
//   group is withheld (GetTexture null) or whose own inputs are missing;
// - getPixels (kg.c(II)[I -> qi.a(ZBLpc;Lal;)[I) and getTextureData (kg.a(IFI)[I -> qi.a(Lal;Lpc;IFZ)[I) null;
// - Construct's not-ready return leaves the cached texels and brightness alone: built at 0.7, withheld, asked at 0.8
//   (null), asked at 0.7 again (the old array, no readiness check on a cache hit). The sprite archive discards packed
//   and unpacked data, so a sprite read once is fetched (and can be withheld) again;
// - kg.a(IFI)[I sets qi.P before G || E[id] throws: a texture injected under a key past the metadata arrays is
//   marked used by the failing call, and the next RunAnims clears it.

class WithholdingDisk extends Js5ResourceProvider {
    readonly table: Js5Index;
    hiding = false;
    constructor(
        private readonly archive: number,
        private readonly withheld: ReadonlySet<number>
    ) {
        super();
        const ref = readGroup(cachePath, 255, archive);
        this.table = new Js5Index(ref, Crc32.prefix(ref, ref.length));
    }
    index() {
        return this.table;
    }
    group(_mode: number, group: number) {
        if (this.hiding && this.withheld.has(group)) return null;
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

const D7 = floatBits(0.7);
const D8 = floatBits(0.8);

function runPort(script: string[], textureDisk: WithholdingDisk, spriteDisk: WithholdingDisk, meta: Js5): string[] {
    const textures = new Js5(textureDisk, false, true);
    const sprites = new Js5(spriteDisk, true, true);
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
                case 'hide':
                    textureDisk.hiding = spriteDisk.hiding = true;
                    result = 'ok';
                    break;
                case 'reveal':
                    textureDisk.hiding = spriteDisk.hiding = false;
                    result = 'ok';
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
                case 'inject':
                    c()['recentUse'].Put(BigInt(op[2]), new Texture(new PacketT(textures.GetFile(0, Number(op[1])))));
                    result = 'ok';
                    break;
                case 'dump': {
                    const table = c()['recentUse'];
                    let s = '';
                    for (let node = table.head(); node !== null; node = table.next()) {
                        if (!(node instanceof Texture)) throw new Error('dump expects only textures');
                        s += `${node.key}:${node.used ? 1 : 0}:${floatBits(node['brightness'])}:${ints(node['pixels'])};`;
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

test('530 TextureCache (kg) and Texture (qi) match client.jar when sprites and nested textures are withheld', () => {
    const probeDisk = new WithholdingDisk(9, new Set());
    const groups = Array.from(requireNonNull(probeDisk.table.groupIds));
    const probe = new Js5(probeDisk, false, true);
    const meta = new Js5(new WithholdingDisk(26, new Set()), false, true);
    const count = new PacketT(requireNonNull(meta.GetFile(0, 0))).g2();

    // Script inputs only: which sprites and nested textures each program reads (jd.p and jd.a).
    const spriteUsers = new Map<number, number[]>();
    const nestedUsers = new Map<number, number[]>();
    for (const id of groups) {
        const procedural = new Texture(new PacketT(requireNonNull(probe.GetFile(0, id))))['procedural'];
        const spriteIds = Array.from(requireNonNull(procedural['spriteIds']));
        const textureIds = Array.from(requireNonNull(procedural['textureIds']));
        if (spriteIds.length > 0) spriteUsers.set(id, spriteIds);
        if (textureIds.length > 0) nestedUsers.set(id, textureIds);
    }
    const allSprites = [...new Set([...spriteUsers.values()].flat())].sort((a, b) => a - b);
    const withheldSprites = allSprites.filter((_, i) => i % 2 === 0);
    // The most nested-upon textures, plus two sprite users (so a nested chain can fail two levels down).
    const nestedCounts = new Map<number, number>();
    for (const ids of nestedUsers.values()) for (const id of ids) nestedCounts.set(id, (nestedCounts.get(id) ?? 0) + 1);
    const popular = [...nestedCounts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0] - b[0])
        .slice(0, 6)
        .map(([id]) => id);
    const withheldTextures = [...popular, ...[...spriteUsers.keys()].slice(0, 2)];
    const hiddenSet = new Set(withheldTextures);
    const spriteTargets = [...spriteUsers.keys()];
    const targets = [...new Set([...spriteTargets, ...withheldTextures, ...[...nestedUsers.entries()].filter(([, ids]) => ids.some(id => hiddenSet.has(id) || spriteUsers.has(id))).map(([id]) => id)])];
    expect(spriteTargets.length).toBeGreaterThan(0);

    const script: string[] = ['hide', 'new 20 0'];
    for (const id of targets) script.push(`loaded ${id}`, `pix ${id}`, `data ${id} ${D7}`);
    script.push('dump', 'reveal');
    for (const id of targets) script.push(`loaded ${id}`, `data ${id} ${D7}`, `pix ${id}`);
    script.push('dump', 'new 50 0');
    // Built at 0.7 with everything present, then the sprites withheld: a hit at 0.7 needs no readiness check, a
    // rebuild at 0.8 is refused (null) and must leave the 0.7 texels and brightness cached.
    for (const id of spriteTargets) script.push(`data ${id} ${D7}`);
    script.push('dump', 'hide');
    const probeIndex = script.length;
    for (const id of spriteTargets) script.push(`data ${id} ${D7}`, `data ${id} ${D8}`, `data ${id} ${D7}`, `loaded ${id}`, `pix ${id}`);
    script.push('dump', 'anim 1', 'dump', 'reveal');
    for (const id of spriteTargets) script.push(`data ${id} ${D8}`);
    script.push('dump');
    // qi.P is set before G || E[id] is evaluated: the failing call still marks the texture used.
    const s = spriteTargets[0];
    script.push('new 8 0', `inject ${s} ${count}`, 'dump', `data ${count} ${D8}`, 'dump', 'anim 1', 'dump', `inject ${groups[3]} 70000`, `data 70000 ${D7}`, 'dump', `data ${s} ${D7}`, 'anim 2', 'dump');

    const dir = mkdtempSync(join(tmpdir(), '530-textures-notready-'));
    let expected: string[];
    try {
        const compile = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'textures-notready', 'TextureNotReadyOracle.java')]);
        expect(compile.exitCode, compile.stderr.toString()).toBe(0);
        const java = Bun.spawnSync(['java', '-Xmx1g', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'TextureNotReadyOracle', cachePath, withheldSprites.join(','), withheldTextures.join(',')], {
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
        () => runPort(script, new WithholdingDisk(9, hiddenSet), new WithholdingDisk(8, new Set(withheldSprites)), meta)
    );

    expect(expected.length).toBe(script.length);
    const differences: string[] = [];
    for (let i = 0; i < script.length; i++) {
        if (actual[i] !== expected[i]) differences.push(`${i} ${script[i]}\n  ts:   ${actual[i]?.slice(0, 400)}\n  java: ${expected[i]?.slice(0, 400)}`);
    }
    expect(differences.slice(0, 10), `${differences.length} of ${script.length} lines differ`).toEqual([]);

    // The script must reach the paths it exists for (checked on the Java results).
    const at = (i: number): string => expected[i];
    expect(script.some((line, i) => line.startsWith('loaded') && at(i) === 'false')).toBe(true);
    expect(script.some((line, i) => line.startsWith('pix') && at(i) === 'null')).toBe(true);
    let refusedThenHit = 0;
    for (let i = probeIndex; i + 2 < script.length && script[i].startsWith('data'); i += 5) {
        if (at(i) !== 'null' && at(i + 1) === 'null' && at(i + 2) === at(i)) refusedThenHit++;
    }
    expect(refusedThenHit).toBeGreaterThan(0);
    const usedAfterThrow = script.findIndex(line => line === `data ${count} ${D8}`);
    expect(at(usedAfterThrow)).toBe('!aioobe');
    expect(at(usedAfterThrow + 1)).toContain(`${count}:1:`);
}, 900000);
