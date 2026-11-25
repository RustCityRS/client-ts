import { expect } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import type Js5 from '#/cache/Js5.js';
import { capsProfileFromJson } from '#/gl/CapsProfile.js';
import GlAlphaSprite from '#/gl/GlAlphaSprite.js';
import GlCleaner from '#/gl/GlCleaner.js';
import GlRaster from '#/gl/GlRaster.js';
import GlRenderer from '#/gl/GlRenderer.js';
import GlSprite from '#/gl/GlSprite.js';
import { GlTraceWriter } from '#/gl/GlTrace.js';
import NullGL from '#/gl/NullGL.js';
import RecordingGL from '#/gl/RecordingGL.js';
import Pix32 from '#/graphics/Pix32.js';
import SoftwareAlphaSprite from '#/graphics/SoftwareAlphaSprite.js';
import SpriteLoader from '#/graphics/SpriteLoader.js';
import { localAssets } from '../cachefile.js';
import { loginFixture } from '../login-fixture.js';
import { cachePath } from '../reference.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';
import { diffTraces } from './glTraceDiff.js';

// HD batch H2 (HD_PLAN.md section 4), unit raster-sprite: the GL sprite (cf, GlSprite), the GL alpha sprite (el,
// GlAlphaSprite) and the GL raster (dj, GlRaster) against the unmodified runescape_gl.jar driven by
// HdSpritesOracle.java through GlRecorder. Both sides record GLTrace v1 (src/gl/GLTRACE.md) over the rtx5070
// profile (TS: RecordingGL over NullGL) and print the Java-visible state (dj statics, fa.e and fa.c, every cf field)
// after each step; the traces must be byte-identical, deletions included (finalize is called explicitly and every
// sprite stays referenced, so no finalizer runs on its own).
//
// upload: every group of archive 8 through the client's sprite path (uj.a + re.b in Java, SpriteLoader.loadGroup +
// createSprites in TS with tf.w set), so every cache sprite frame (6508 in 1707 groups, 17 of them el and 1884 of
// them 0x0) is uploaded by cf.a([I)V or el.a([I)V and its glTexImage2D buffer hash compared.
// script: every draw of cf/el (both constructors, cache and synthetic sprites, offsets, padding, re-upload,
// finalize across a context generation, 0x0 sprites) and every dj member, over clip states, clip masks, both byte
// orders and GL sizes, a full-circle sweep of the masked minimap rotation, plus 400 seeded random calls with ordinary
// and extreme arguments. The oracle JVM runs with the libm intrinsics off, so Math.sin/cos are fdlibm as in V8.

const profilePath = join(import.meta.dir, 'rtx5070.json');

function runOracle(dir: string, mode: string, argument: string): { trace: string; state: string } {
    const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
    const sources = ['HdSpritesOracle.java', 'HdTitleFrameOracle.java', 'GlRecorder.java'];
    const compile = Bun.spawnSync(['javac', '-cp', cp, '-d', dir, ...sources.map(s => join(import.meta.dir, s))]);
    expect(compile.exitCode, compile.stderr.toString()).toBe(0);
    const out = join(dir, 'java');
    const run = Bun.spawnSync([
        'java',
        '--add-opens=java.base/java.lang=ALL-UNNAMED',
        '-Djava.awt.headless=true',
        '-XX:+UnlockDiagnosticVMOptions',
        '-XX:-UseLibmIntrinsic',
        '-Dgltrace.caps=' + profilePath,
        '-cp',
        cp,
        'HdSpritesOracle',
        cachePath,
        out,
        mode,
        argument
    ]);
    expect(run.exitCode, run.stderr.toString()).toBe(0);
    return { trace: readFileSync(join(out, 'trace.tsv'), 'utf8'), state: readFileSync(join(out, 'state.txt'), 'utf8') };
}

function install(): GlTraceWriter {
    const writer = new GlTraceWriter();
    GlRenderer.gl = new RecordingGL(new NullGL(capsProfileFromJson(readFileSync(profilePath, 'utf8'))), writer);
    GlRenderer.active = true;
    return writer;
}

function compare(java: { trace: string; state: string }, writer: GlTraceWriter, state: string[]): void {
    const tsState = state.join('\n') + '\n';
    if (tsState !== java.state) {
        const a = java.state.split('\n');
        const b = tsState.split('\n');
        let i = 0;
        while (i < a.length && a[i] === b[i]) i++;
        expect(b[i] ?? '<end>', 'state line ' + i + ' (Java first)').toBe(a[i] ?? '<end>');
    }
    const diff = diffTraces(java.trace, writer.text(), { includeDeletions: true, expectedLabel: 'java', actualLabel: 'ts' });
    if (!diff.equal) throw new Error(diff.report);
    // Byte equality of the record lines; GlRecorder's '#@' stack lines are never compared (GLTRACE.md section 2).
    const tsText = writer.text();
    const javaText = java.trace
        .split('\n')
        .filter(line => !line.startsWith('#@ '))
        .join('\n');
    expect(java.trace.length).toBeGreaterThan(javaText.length);
    if (tsText !== javaText) {
        const a = javaText.split('\n');
        const b = tsText.split('\n');
        let i = 0;
        while (i < a.length && a[i] === b[i]) i++;
        expect(JSON.stringify(b[i] ?? '<end>'), 'trace line ' + i + ' (Java first)').toBe(JSON.stringify(a[i] ?? '<end>'));
    }
}

function spriteState(s: GlSprite): string {
    return [s.textureWidth, s.textureHeight, s.size, s.texture, Reflect.get(s, 'list'), Reflect.get(s, 'filter'), Reflect.get(s, 'generation'), s.cropW, s.cropH, s.xOffset, s.yOffset, s.width, s.height].join(',');
}

function asGlSprite(s: unknown): GlSprite {
    if (!(s instanceof GlSprite)) throw new Error('not a GlSprite: ' + String(s));
    return s;
}

// The oracle's pixel generator (HdSpritesOracle.pixels).
function pixels(seed: number, zeroEvery: number, length: number): Int32Array {
    const out = new Int32Array(length);
    let x = seed | 0;
    for (let i = 0; i < length; i++) {
        x = (Math.imul(x, 1103515245) + 12345) | 0;
        out[i] = zeroEvery > 0 && (x >>> 16) % zeroEvery === 0 ? 0 : x;
    }
    return out;
}

function javaName(e: unknown): string {
    if (e instanceof TypeError) return 'NullPointerException';
    if (e instanceof RangeError) {
        if (e.message.includes('/ by zero')) return 'ArithmeticException';
        if (e.message.startsWith('array index')) return 'ArrayIndexOutOfBoundsException';
        if (e.message.includes('typed array length')) return 'NegativeArraySizeException';
    }
    if (e instanceof Error && e.message === 'IllegalArgumentException') return 'IllegalArgumentException';
    return 'unmapped:' + String(e);
}

loginFixture(
    import.meta.url,
    'HD GL sprites upload every cache sprite frame like the jar',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-hd-sprites-'));
        try {
            const archive = localAssets(cachePath, [8]).archive(8);
            const limit = archive.GetGroupIdLimit();
            const java = runOracle(dir, 'upload', String(limit));
            const writer = install();
            const state: string[] = [];
            const retained: unknown[] = [];
            let frames = 0;
            let alpha = 0;
            for (let group = 0; group < limit; group++) {
                if (!SpriteLoader.loadGroup(archive, group)) continue;
                writer.mark('g' + group);
                const sprites = SpriteLoader.createSprites();
                for (let i = 0; i < sprites.length; i++) {
                    const sprite = asGlSprite(sprites[i]);
                    retained.push(sprite);
                    frames++;
                    if (sprite instanceof GlAlphaSprite) alpha++;
                    state.push(group + ' ' + i + ' ' + (sprite instanceof GlAlphaSprite ? 'el' : 'cf') + ' ' + spriteState(sprite));
                }
            }
            state.push('fa=' + GlCleaner.memory2d + ',' + GlCleaner.generation);
            expect(frames).toBeGreaterThan(1000);
            expect(alpha).toBeGreaterThan(0);
            compare(java, writer, state);
            expect(retained.length).toBe(frames);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    240000,
    'gl'
);

// ---- the draw script ------------------------------------------------------------------------------------------------

class Rng {
    constructor(private state: number) {}
    next(): number {
        this.state = (this.state + 0x6d2b79f5) | 0;
        let t = this.state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return (t ^ (t >>> 14)) >>> 0;
    }
    int(lo: number, hi: number): number {
        return lo + (this.next() % (hi - lo + 1));
    }
    pick<T>(items: readonly T[]): T {
        return items[this.next() % items.length];
    }
    // Mostly ordinary values, sometimes an edge or an extreme int.
    arg(lo: number, hi: number): number {
        const r = this.next() % 20;
        if (r === 0) return this.pick([-2147483648, 2147483647, -1, 0, 1, 65536, -65536, 46341]);
        if (r === 1) return this.int(-100000, 100000);
        return this.int(lo, hi);
    }
}

// Cache groups the script draws: the first frame of a non-alpha group with both offsets set, of an alpha group, and
// of a group wider than 256.
function cacheGroups(archive: Js5): { offset: number; alpha: number; wide: number } {
    let offset = -1;
    let alpha = -1;
    let wide = -1;
    const limit = archive.GetGroupIdLimit();
    for (let group = 0; group < limit && (offset < 0 || alpha < 0 || wide < 0); group++) {
        if (!SpriteLoader.loadGroup(archive, group)) continue;
        const hasAlpha = SpriteLoader.hasAlpha?.[0] === true;
        const xOffset = SpriteLoader.xOffsets?.[0] ?? 0;
        const yOffset = SpriteLoader.yOffsets?.[0] ?? 0;
        const width = SpriteLoader.widths?.[0] ?? 0;
        SpriteLoader.clear();
        if (offset < 0 && !hasAlpha && xOffset > 0 && yOffset > 0) offset = group;
        if (alpha < 0 && hasAlpha) alpha = group;
        if (wide < 0 && !hasAlpha && width > 256) wide = group;
    }
    if (offset < 0 || alpha < 0 || wide < 0) throw new Error('cache groups ' + offset + ' ' + alpha + ' ' + wide);
    return { offset, alpha, wide };
}

function buildScript(groups: { offset: number; alpha: number; wide: number }): string[] {
    const s: string[] = [];
    s.push('size 765 503');
    // Synthetic sprites: offsets and padding, power-of-two, both constructors, 1x1, 0x0, masks for clip height 80.
    s.push('new 0 cf 40 30 3 2 33 25 1234 5');
    s.push('new 1 el 16 16 0 0 16 16 99 3');
    s.push('newmm 2 cf 64 40 5 7 50 31 777 4');
    s.push('newmm 3 el 20 20 2 1 17 13 4242 6');
    s.push('new 4 cf 1 1 0 0 1 1 5 0');
    s.push('new 5 cf 0 0 0 0 0 0 1 0');
    s.push('new 6 cf 120 80 0 0 120 80 31337 0');
    s.push('new 7 el 300 200 10 20 257 80 8 2');
    s.push('cache 8 ' + groups.offset + ' 0');
    s.push('cache 9 ' + groups.alpha + ' 0');
    s.push('cache 10 ' + groups.wide + ' 0');
    const ids = [0, 1, 2, 3, 4, 5, 7, 8, 9, 10];
    // Every draw on every sprite, at fixed arguments that reach each branch.
    for (const id of ids) {
        s.push(`d ${id} e2 10 20`);
        s.push(`d ${id} c2 -5 7`);
        s.push(`d ${id} d2 100 50`);
        s.push(`d ${id} a3 30 40 128`);
        s.push(`d ${id} a3 0 0 256`);
        s.push(`d ${id} a6 160 120 3200 4000 1024 4096`);
        s.push(`d ${id} a6 0 0 -16 16 -40000 2048`);
        s.push(`d ${id} b6 240 240 1600 1600 16384 4096`);
        s.push(`d ${id} b6 10 10 0 0 -3 8192`);
        s.push(`d ${id} a4 50 60 80 60`);
        s.push(`d ${id} a4 50 60 20 10`);
        s.push(`d ${id} a4 50 60 0 10`);
        s.push(`d ${id} a4 50 60 10 -1`);
        s.push(`d ${id} b5 70 80 66 50 200`);
        s.push(`d ${id} b5 70 80 5 5 0`);
        s.push(`d ${id} c5 10 10 100 3 2`);
        s.push(`d ${id} b4 10 10 2 3`);
        s.push(`d ${id} b4 0 0 0 0`);
        s.push(`d ${id} q5 512 40 60 300`);
        s.push(`d ${id} m2 15 25 -1`);
        s.push(`d ${id} m2 15 25 6`);
        s.push(`d ${id} m8 5 5 120 80 1000 2000 300 256 6`);
        s.push(`d ${id} m8 5 5 120 80 1000 2000 300 256 -1`);
    }
    // Raster primitives and clipping.
    s.push('hline 10 20 100 16711935', 'vline 10 20 100 65280', 'rect 5 6 50 40 255', 'rect 5 6 0 0 -1');
    s.push('rectT 5 6 50 40 16777215 128', 'rectT 5 6 50 40 1193046 256', 'rectT 5 6 50 40 1193046 -3');
    s.push('fill 0 0 765 503 0', 'fillT 100 100 20 30 11184810 64', 'fillT 100 100 20 30 11184810 300');
    s.push('line 0 0 764 502 16776960', 'line 30 30 30 30 1');
    s.push('thick 10 10 200 50 255 3', 'thick 10 10 50 200 255 4', 'thick 200 50 10 10 255 5', 'thick 50 200 10 10 255 2');
    s.push('thick 10 10 10 10 255 3', 'thick 0 0 -100 30 65535 7', 'thick 5 5 5 300 1 1');
    // Normals of -1, where the +1 rounding of the second offset matters.
    s.push('thick 0 0 65536 -1 255 1', 'thick 0 0 -1 65536 255 1', 'thick 7 9 -65536 1 255 3', 'thick 7 9 1 -65536 255 3');
    s.push('pix 7 3 20 30 16 8', 'big 1', 'pix 8 0 0 0 4 4', 'big 0', 'pixnull 1 2 3 4', 'clear');
    s.push('reset', 'clip 10 20 200 100', 'mask 6', 'd 0 m2 15 25 6', 'd 4 m2 12 22 6', 'd 8 m8 10 20 120 80 500 600 77 512 6');
    s.push('mask 0', 'mask -1', 'mask 6', 'inter 0 0 150 90', 'mask 6', 'inter 50 60 40 70');
    s.push('d 0 e2 0 0', 'hline 0 0 10 0', 'clip -10 -20 9999 9999', 'clip 300 300 100 100', 'inter 0 0 765 503');
    s.push('reset', 'mask 6', 'clip 0 0 765 80', 'mask 6', 'nomask', 'clip 0 0 765 80', 'mask 6', 'unload');
    // A resized surface, re-uploads, finalize and the deferred deletions.
    s.push('size 1024 768', 'd 0 e2 10 20', 'd 1 a4 10 20 33 44', 'fill 1 2 3 4 5', 'size 765 503');
    s.push('reup 0 4321 2', 'reup 3 1 0', 'd 0 e2 1 2', 'd 3 a3 1 2 3');
    s.push('fin 2', 'fin 3', 'fin 2', 'flush', 'd 2 e2 5 5', 'd 3 a6 0 0 0 0 0 4096', 'reup 2 9 9', 'fin 2', 'flush');
    // A new context generation (fa.b()V): names from the old one are dropped, a re-uploaded texture takes the new one.
    s.push('fareset', 'fin 0', 'reup 2 5 5', 'reup 3 2 2', 'reup 1 3 3', 'flush', 'fin 2', 'fin 3', 'fin 1', 'flush');
    // The minimap rotation over the whole circle (the sine and cosine truncations), on the cache sprite.
    for (let angle = 0; angle < 2048; angle += 4) s.push(`d 10 m8 0 0 151 151 ${angle * 3} ${angle * 2} ${angle} ${256 + (angle % 300)} 6`);
    // Seeded random calls.
    const rng = new Rng(530);
    const live = [0, 1, 4, 5, 6, 7, 8, 9, 10];
    const sprite = (): number => rng.pick(live);
    for (let i = 0; i < 400; i++) {
        const c = (): number => rng.arg(-50, 900);
        const colour = (): number => rng.next() | 0;
        switch (rng.int(0, 27)) {
            case 0:
                s.push(`d ${sprite()} e2 ${c()} ${c()}`);
                break;
            case 1:
                s.push(`d ${sprite()} c2 ${c()} ${c()}`);
                break;
            case 2:
                s.push(`d ${sprite()} d2 ${c()} ${c()}`);
                break;
            case 3:
                s.push(`d ${sprite()} a3 ${c()} ${c()} ${rng.arg(0, 256)}`);
                break;
            case 4:
                s.push(`d ${sprite()} a6 ${rng.arg(0, 4000)} ${rng.arg(0, 4000)} ${rng.arg(0, 12000)} ${rng.arg(0, 9000)} ${rng.arg(-70000, 70000)} ${rng.arg(0, 9000)}`);
                break;
            case 5:
                s.push(`d ${sprite()} b6 ${rng.arg(0, 4000)} ${rng.arg(0, 4000)} ${rng.arg(0, 12000)} ${rng.arg(0, 9000)} ${rng.arg(-70000, 70000)} ${rng.pick([4096, rng.arg(0, 9000)])}`);
                break;
            case 6:
                s.push(`d ${sprite()} a4 ${c()} ${c()} ${rng.arg(-2, 400)} ${rng.arg(-2, 400)}`);
                break;
            case 7:
                s.push(`d ${sprite()} b5 ${c()} ${c()} ${rng.arg(-2, 400)} ${rng.arg(-2, 400)} ${rng.arg(0, 256)}`);
                break;
            case 8:
                s.push(`d ${sprite()} c5 ${c()} ${c()} ${rng.arg(0, 256)} ${rng.arg(0, 8)} ${rng.arg(0, 8)}`);
                break;
            case 9:
                s.push(`d ${sprite()} b4 ${c()} ${c()} ${rng.arg(0, 8)} ${rng.arg(0, 8)}`);
                break;
            case 10:
                s.push(`d ${sprite()} q5 ${rng.arg(0, 2047)} ${c()} ${c()} ${rng.arg(0, 1024)}`);
                break;
            case 11:
                s.push(`d ${sprite()} m2 ${c()} ${c()} ${rng.pick([-1, 6, 7, 1])}`);
                break;
            case 12:
                s.push(`d ${sprite()} m8 ${c()} ${c()} ${rng.arg(0, 300)} ${rng.arg(0, 300)} ${rng.arg(0, 4000)} ${rng.arg(0, 4000)} ${rng.arg(0, 2047)} ${rng.arg(0, 1024)} ${rng.pick([-1, 6, 10])}`);
                break;
            case 13:
                s.push(`hline ${c()} ${c()} ${c()} ${colour()}`);
                break;
            case 14:
                s.push(`vline ${c()} ${c()} ${c()} ${colour()}`);
                break;
            case 15:
                s.push(`rect ${c()} ${c()} ${c()} ${c()} ${colour()}`);
                break;
            case 16:
                s.push(`rectT ${c()} ${c()} ${c()} ${c()} ${colour()} ${rng.arg(-10, 300)}`);
                break;
            case 17:
                s.push(`fill ${c()} ${c()} ${c()} ${c()} ${colour()}`);
                break;
            case 18:
                s.push(`fillT ${c()} ${c()} ${c()} ${c()} ${colour()} ${rng.arg(-10, 300)}`);
                break;
            case 19:
                s.push(`line ${c()} ${c()} ${c()} ${c()} ${colour()}`);
                break;
            case 20:
                s.push(`thick ${c()} ${c()} ${c()} ${c()} ${colour()} ${rng.arg(0, 20)}`);
                break;
            case 21:
                s.push(`pix ${rng.next() | 0} ${rng.int(0, 5)} ${c()} ${c()} ${rng.int(0, 24)} ${rng.int(0, 24)}`);
                break;
            case 22:
                s.push(`clip ${c()} ${c()} ${c()} ${c()}`);
                break;
            case 23:
                s.push(`inter ${c()} ${c()} ${c()} ${c()}`);
                break;
            case 24:
                s.push(rng.pick(['reset', 'nomask', 'unload', 'clear']));
                break;
            case 25:
                s.push(`mask ${rng.pick([6, 7, 0, -1])}`);
                break;
            case 26:
                s.push(`size ${rng.pick([765, 1024, 800])} ${rng.pick([503, 768, 600])}`);
                break;
            default:
                s.push(`big ${rng.int(0, 1)}`);
                break;
        }
    }
    return s;
}

loginFixture(
    import.meta.url,
    'HD GL sprite and raster draws issue the jar GL calls',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-hd-sprites-'));
        try {
            const archive = localAssets(cachePath, [8]).archive(8);
            const script = buildScript(cacheGroups(archive));
            const scriptPath = join(dir, 'script.txt');
            writeFileSync(scriptPath, script.join('\n') + '\n');
            const java = runOracle(dir, 'script', scriptPath);
            const writer = install();
            const sprites = new Map<number, GlSprite>();
            const retained: unknown[] = [];
            const lookup = (id: string): GlSprite | null => {
                const key = Number(id);
                if (key < 0) return null;
                const sprite = sprites.get(key);
                if (sprite === undefined) throw new Error('no sprite ' + id);
                return sprite;
            };
            const need = (id: string): GlSprite => {
                const sprite = lookup(id);
                if (sprite === null) throw new TypeError('null sprite');
                return sprite;
            };
            const put = (id: number, sprite: GlSprite): void => {
                sprites.set(id, sprite);
                retained.push(sprite);
            };
            const run = (t: string[]): void => {
                const n = (i: number): number => Number(t[i]) | 0;
                switch (t[0]) {
                    case 'size':
                        GlRenderer.width = n(1);
                        GlRenderer.height = n(2);
                        break;
                    case 'big':
                        GlRenderer.bigEndian = n(1) !== 0;
                        break;
                    case 'new': {
                        const px = pixels(n(9), n(10), Math.imul(n(7), n(8)));
                        put(n(1), t[2] === 'el' ? new GlAlphaSprite(n(3), n(4), n(5), n(6), n(7), n(8), px) : new GlSprite(n(3), n(4), n(5), n(6), n(7), n(8), px));
                        break;
                    }
                    case 'newmm': {
                        const px = pixels(n(9), n(10), Math.imul(n(7), n(8)));
                        if (t[2] === 'el') put(n(1), new GlAlphaSprite(new SoftwareAlphaSprite(n(3), n(4), n(5), n(6), n(7), n(8), px)));
                        else put(n(1), new GlSprite(new Pix32(n(3), n(4), n(5), n(6), n(7), n(8), px)));
                        break;
                    }
                    case 'cache': {
                        if (!SpriteLoader.loadGroup(archive, n(2))) throw new Error('group ' + t[2]);
                        const frames = SpriteLoader.createSprites();
                        retained.push(...frames);
                        put(n(1), asGlSprite(frames[n(3)]));
                        break;
                    }
                    case 'reup': {
                        const sprite = need(t[1]);
                        sprite.upload(pixels(n(2), n(3), Math.imul(sprite.width, sprite.height)));
                        break;
                    }
                    case 'fin':
                        (need(t[1]) as unknown as { finalize(): void }).finalize();
                        break;
                    case 'flush':
                        GlCleaner.flush();
                        break;
                    case 'fareset':
                        GlCleaner.reset();
                        break;
                    case 'd':
                        draw(need(t[1]), t, n);
                        break;
                    case 'hline':
                        GlRaster.hline(n(1), n(2), n(3), n(4));
                        break;
                    case 'vline':
                        GlRaster.vline(n(1), n(2), n(3), n(4));
                        break;
                    case 'reset':
                        GlRaster.resetClipping();
                        break;
                    case 'pix':
                        GlRaster.drawPixels(pixels(n(1), n(2), Math.imul(n(5), n(6))), n(3), n(4), n(5), n(6));
                        break;
                    case 'pixnull':
                        GlRaster.drawPixels(null, n(1), n(2), n(3), n(4));
                        break;
                    case 'rect':
                        GlRaster.drawRect(n(1), n(2), n(3), n(4), n(5));
                        break;
                    case 'rectT':
                        GlRaster.drawRectTrans(n(1), n(2), n(3), n(4), n(5), n(6));
                        break;
                    case 'thick':
                        GlRaster.drawThickLine(n(1), n(2), n(3), n(4), n(5), n(6));
                        break;
                    case 'fillT':
                        GlRaster.fillRectTrans(n(1), n(2), n(3), n(4), n(5), n(6));
                        break;
                    case 'inter':
                        GlRaster.intersectClipping(n(1), n(2), n(3), n(4));
                        break;
                    case 'clear':
                        GlRaster.clear();
                        break;
                    case 'line':
                        GlRaster.drawLine(n(1), n(2), n(3), n(4), n(5));
                        break;
                    case 'fill':
                        GlRaster.fillRect(n(1), n(2), n(3), n(4), n(5));
                        break;
                    case 'clip':
                        GlRaster.setClipping(n(1), n(2), n(3), n(4));
                        break;
                    case 'mask':
                        GlRaster.setClipMask(lookup(t[1]));
                        break;
                    case 'nomask':
                        GlRaster.clearClipMask();
                        break;
                    case 'unload':
                        GlRaster.unload();
                        break;
                    default:
                        throw new Error('op ' + t[0]);
                }
            };
            const draw = (s: GlSprite, t: string[], n: (i: number) => number): void => {
                switch (t[2]) {
                    case 'e2':
                        s.draw(n(3), n(4));
                        break;
                    case 'c2':
                        s.drawOpaque(n(3), n(4));
                        break;
                    case 'd2':
                        s.drawHFlip(n(3), n(4));
                        break;
                    case 'a3':
                        s.drawAlpha(n(3), n(4), n(5));
                        break;
                    case 'a6':
                        s.drawRotated(n(3), n(4), n(5), n(6), n(7), n(8));
                        break;
                    case 'b6':
                        s.drawRotatedReversed(n(3), n(4), n(5), n(6), n(7), n(8));
                        break;
                    case 'a4':
                        s.drawScaled(n(3), n(4), n(5), n(6));
                        break;
                    case 'b5':
                        s.drawScaledAlpha(n(3), n(4), n(5), n(6), n(7));
                        break;
                    case 'c5':
                        s.drawTiledAlpha(n(3), n(4), n(5), n(6), n(7));
                        break;
                    case 'b4':
                        s.drawTiled(n(3), n(4), n(5), n(6));
                        break;
                    case 'm2':
                        s.drawMasked(n(3), n(4), lookup(t[5]));
                        break;
                    case 'm8':
                        s.drawRotatedMasked(n(3), n(4), n(5), n(6), n(7), n(8), n(9), n(10), lookup(t[11]));
                        break;
                    case 'q5':
                        s.drawRotatedCentred(n(3), n(4), n(5), n(6));
                        break;
                    default:
                        throw new Error('draw ' + t[2]);
                }
            };
            const state = (): string => {
                let mask = 'null';
                if (GlRaster.mask !== null) {
                    mask = '?';
                    for (const [id, sprite] of sprites) if (sprite === GlRaster.mask) mask = 's' + id;
                }
                let line = 'dj=' + mask + ',' + GlRaster.clipMinY + ',' + GlRaster.clipMinX + ',' + Reflect.get(GlRaster, 'clipMaxX') + ',' + GlRaster.clipMaxY;
                line += ' fa=' + GlCleaner.memory2d + ',' + GlCleaner.generation;
                for (const id of [...sprites.keys()].sort((a, b) => a - b)) line += ' s' + id + '=' + spriteState(need(String(id)));
                return line;
            };
            const lines: string[] = [];
            script.forEach((line, i) => {
                writer.mark('op' + i);
                let result: string;
                try {
                    run(line.split(' '));
                    result = 'ok';
                } catch (e) {
                    result = 'threw ' + javaName(e);
                }
                lines.push(i + ' ' + result + ' ' + state());
            });
            compare(java, writer, lines);
            expect(lines.filter(l => l.includes(' threw ')).length).toBeGreaterThan(5);
            expect(retained.length).toBeGreaterThan(10);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    120000,
    'gl'
);
