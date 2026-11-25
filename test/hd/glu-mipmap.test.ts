import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';
import type { GL } from '#/jogl/GL.js';
import Mipmap, { javaParseDouble } from '#/jogl/glu/mipmap/Mipmap.js';
import { type Case, compareAll, floatSafe, GL_RGBA, javaName, javaRun, make, randomBytes, store, utf16 } from './gluMipmapHarness.js';

// The JOGL GLU mipmap port (src/jogl/GLU.ts, glu/mipmap/, util/BufferUtil.ts) against the shipped jogl.jar, on
// the client's own call (GL_RGBA/GL_UNSIGNED_BYTE) and the driver answers, pixel-store modes, sizes, data kinds and
// argument errors around it. gluMipmapHarness.ts holds the recorder and the oracle runner; glu-mipmap-full.test.ts
// runs every format x type combination gluBuild2DMipmaps accepts.

function corpus(): Case[] {
    const cases: Case[] = [];
    const add = (c: Case) => cases.push(c);

    // What the client does: uh.a(Lve;Lm;IZ)Z, GL_RGBA/GL_UNSIGNED_BYTE, 128x128 or 64x64, ByteBuffer.wrap(byte[]).
    for (const seed of [1, 2, 3]) {
        add(make('client-128-s' + seed, 128, 128, { bytes: randomBytes(128 * 128 * 4, 1000 + seed) }));
        add(make('client-64-s' + seed, 64, 64, { bytes: randomBytes(64 * 64 * 4, 2000 + seed) }));
    }
    add(make('client-128-zero', 128, 128, { bytes: new Uint8Array(128 * 128 * 4) }));
    add(make('client-64-ones', 64, 64, { bytes: new Uint8Array(64 * 64 * 4).fill(255) }));
    // driver answers: GL version, proxy-texture limits, GLException from the probe, faults elsewhere
    add(make('client-128-intel15', 128, 128, { ver: '1.5.0 - Build 7.14.10.4926' }));
    add(make('client-64-ati20', 64, 64, { ver: '2.0.6747 WinXP Release' }));
    add(make('client-128-gl10', 128, 128, { ver: '1.0' }));
    add(make('client-128-gl10-max64', 128, 128, { ver: '1.0', max: 64 }));
    add(make('client-128-max64', 128, 128, { max: 64 }));
    add(make('client-128-max16', 128, 128, { max: 16 }));
    add(make('client-64-max1', 64, 64, { max: 1 }));
    add(make('client-128-gle-probe', 128, 128, { fault: 'glGetTexLevelParameteriv#1#gle' }));
    add(make('client-128-max32-gle-probe2', 128, 128, { max: 32, fault: 'glGetTexLevelParameteriv#2#gle' }));
    add(make('client-64-gle-proxyimage', 64, 64, { fault: 'glTexImage2D#1#gle' }));
    add(make('client-64-rte-probe', 64, 64, { fault: 'glGetTexLevelParameteriv#1#rte' }));
    add(make('client-64-gle-getstring', 64, 64, { fault: 'glGetString#1#gle' }));
    add(make('client-64-gle-level2', 64, 64, { fault: 'glTexImage2D#4#gle' }));
    add(make('client-64-gle-store', 64, 64, { fault: 'glPixelStorei#2#gle' }));
    add(make('client-64-gle-getint', 64, 64, { fault: 'glGetIntegerv#7#gle' }));
    // pixel-store modes read by retrieveStoreModes and restored at the end
    add(make('client-128-align8', 128, 128, { store: store({ 3317: 8 }) }));
    add(make('client-64-align2', 64, 64, { store: store({ 3317: 2 }) }));
    add(make('client-64-align1', 64, 64, { store: store({ 3317: 1 }) }));
    add(make('client-64-align0', 64, 64, { store: store({ 3317: 0 }) }));
    add(make('client-64-swap-lsb', 64, 64, { store: store({ 3312: 1, 3313: 1, 3328: 1, 3329: 1, 3333: 2 }) }));
    add(make('client-64-skip', 64, 64, { store: store({ 3315: 1, 3316: 2 }) }));
    add(make('client-64-skip-past-end', 4, 4, { store: store({ 3315: 5 }) }));
    add(make('rowlen20-16x16', 16, 16, { store: store({ 3314: 20 }), bytes: randomBytes(20 * 16 * 4, 77) }));
    add(make('rowlen1-2x2', 2, 2, { store: store({ 3314: 1 }) }));
    add(make('store-swap2-lsb2', 4, 4, { store: store({ 3312: 2, 3313: 2, 3328: 2, 3329: 2 }) }));
    // one column with pad bytes per row (HalveImage.halve1Dimage_ubyte padBytes)
    add(make('size-1x8-align8', 1, 8, { store: store({ 3317: 8 }), bytes: randomBytes(8 * 8, 78) }));
    add(make('size-1x4-rowlen3', 1, 4, { store: store({ 3314: 3 }), bytes: randomBytes(12 * 4, 79) }));
    add(make('size-8x1-align8', 8, 1, { store: store({ 3317: 8 }) }));

    // GL_VERSION parsing: String.trim, substring(0, 3), Double.parseDouble
    const versions: [string, string | null][] = [
        ['ver-1.1', '1.1 Generic'],
        ['ver-1.09', '1.09'],
        ['ver-ctrl-trim', ' \u0001\t2.1 x'],
        ['ver-nbsp', ' 2.1'],
        ['ver-NaN', 'NaN'],
        ['ver-abc', 'abc'],
        ['ver-short', '1'],
        ['ver-empty', ''],
        ['ver-blank', '    '],
        ['ver-null', null],
        ['ver-2.d', '2.d'],
        ['ver-1e1', '1e1'],
        ['ver-neg', '-1.'],
        ['ver-dot9', '  .9 '],
        ['ver-plus', '+1.2'],
        ['ver-1.F', '1.F'],
        ['ver-hex', '0x1.0p0'],
        ['ver-2.', '2. '],
        ['ver-dots', '1..'],
        ['ver-exp', '1e+']
    ];
    for (const [id, ver] of versions) add(make(id, 4, 4, { ver }));

    // sizes, including 1D chains and the 1x1 early return
    for (const [w, h] of [
        [1, 1],
        [2, 2],
        [4, 1],
        [1, 4],
        [2, 1],
        [1, 2],
        [8, 2],
        [2, 8],
        [16, 4],
        [4, 16],
        [32, 32],
        [256, 16]
    ] as const) {
        add(make('size-' + w + 'x' + h, w, h));
    }
    // sizes that are not powers of two go through ScaleInternal.scale_internal_ubyte
    for (const [w, h] of [
        [3, 5],
        [5, 3],
        [100, 60],
        [7, 1],
        [1, 7],
        [3, 3],
        [5, 5],
        [129, 127],
        [6, 2],
        [2, 6],
        [96, 96]
    ] as const) {
        add(make('npot-' + w + 'x' + h, w, h));
    }
    add(make('npot-300x20-max256', 300, 20, { max: 256 }));
    add(make('npot-3x5-align8', 3, 5, { store: store({ 3317: 8 }) }));
    // non-integer downscales (fractional edge weights on both axes, inner rows and columns): 255x191 -> 64x32
    add(make('npot-255x191-max64', 255, 191, { max: 64 }));
    add(make('npot-255x3-max64', 255, 3, { max: 64 }));
    // other unsigned-byte formats: component counts 1..4 and row padding of odd row sizes
    add(make('rgb-8x8', 8, 8, { ifmt: 6407, fmt: 6407, bytes: randomBytes(8 * 8 * 3, 31) }));
    add(make('rgb-8x8-align1', 8, 8, { ifmt: 6407, fmt: 6407, bytes: randomBytes(8 * 8 * 3, 32), store: store({ 3317: 1 }) }));
    add(make('rgb-5x3', 5, 3, { ifmt: 6407, fmt: 6407, bytes: randomBytes(8 * 3 * 3, 33) }));
    add(make('bgr-2x2', 2, 2, { ifmt: 6407, fmt: 32992, bytes: randomBytes(16, 34) }));
    add(make('lum-8x8', 8, 8, { ifmt: 6409, fmt: 6409, bytes: randomBytes(64, 35) }));
    add(make('lum-1x8', 1, 8, { ifmt: 6409, fmt: 6409, bytes: randomBytes(32, 38) }));
    add(make('rgb-1x4', 1, 4, { ifmt: 6407, fmt: 6407, bytes: randomBytes(16, 39) }));
    add(make('lumalpha-4x4', 4, 4, { ifmt: 6410, fmt: 6410, bytes: randomBytes(32, 36) }));
    add(make('alpha-4x2', 4, 2, { ifmt: 6406, fmt: 6406, bytes: randomBytes(8, 37) }));
    add(make('bgra-4x4', 4, 4, { fmt: 32993 }));
    add(make('ifmt4-4x4', 4, 4, { ifmt: 4 }));
    // argument errors
    add(make('bad-format', 4, 4, { fmt: 4660 }));
    add(make('stencil-format', 4, 4, { fmt: 6401 }));
    add(make('bad-type', 4, 4, { type: 0 }));
    add(make('zero-width', 0, 4, { bytes: new Uint8Array(16) }));
    add(make('negative-height', 4, -3, { bytes: new Uint8Array(16) }));
    // proxy targets chosen by closestFit
    add(make('target-cube-face', 4, 4, { target: 34069 }));
    add(make('target-cube-nz', 4, 4, { target: 34074 }));
    add(make('target-1d', 4, 1, { target: 3552 }));
    add(make('target-proxy2d', 4, 4, { target: 32868 }));
    add(make('target-cube-map', 4, 4, { target: 34067 }));
    // GLU.copyToByteBuffer and GLU.getCurrentGL
    add(make('glu-direct', 4, 4, { data: 'bbdirect' }));
    add(make('glu-heap-pos4', 4, 4, { pos: 4, bytes: randomBytes(68, 41) }));
    add(make('glu-direct-pos4', 4, 4, { data: 'bbdirect', pos: 4, bytes: randomBytes(68, 42) }));
    add(make('glu-short-pos2', 4, 4, { data: 'sbheap', pos: 2, bytes: randomBytes(68, 43) }));
    add(make('glu-int-pos1', 4, 4, { data: 'ibheap', pos: 1, bytes: randomBytes(68, 44) }));
    add(make('glu-float', 4, 4, { data: 'fbheap', bytes: floatSafe(randomBytes(64, 45)) }));
    add(make('glu-null', 4, 4, { data: 'null' }));
    add(make('glu-noctx', 4, 4, { entry: 'noctx' }));
    add(make('glu-noctx-null', 4, 4, { entry: 'noctx', data: 'null' }));
    add(make('glu-short-data', 4, 4, { bytes: randomBytes(32, 46) }));
    add(make('glu-tiny-data', 4, 4, { bytes: randomBytes(20, 47) }));
    add(make('glu-tiny-npot', 3, 3, { bytes: randomBytes(20, 48) }));
    // Mipmap.gluBuild2DMipmaps with the other java.lang.Object data arms
    add(make('mipmap-heap-pos8', 4, 4, { entry: 'mipmap', pos: 8, bytes: randomBytes(72, 51) }));
    add(make('mipmap-heap-pos8-gle', 4, 4, { entry: 'mipmap', pos: 8, bytes: randomBytes(72, 52), fault: 'glTexImage2D#3#gle' }));
    add(make('mipmap-bytes', 4, 4, { entry: 'mipmap', data: 'bytes' }));
    add(make('mipmap-shorts', 4, 4, { entry: 'mipmap', data: 'shorts' }));
    add(make('mipmap-ints', 4, 4, { entry: 'mipmap', data: 'ints' }));
    add(make('mipmap-floats', 4, 4, { entry: 'mipmap', data: 'floats', bytes: floatSafe(randomBytes(64, 53)) }));
    add(make('mipmap-ints-npot', 3, 2, { entry: 'mipmap', data: 'ints', bytes: randomBytes(24, 54) }));
    add(make('mipmap-null', 4, 4, { entry: 'mipmap', data: 'null' }));
    add(make('mipmap-object', 4, 4, { entry: 'mipmap', data: 'object' }));
    add(make('mipmap-null-bad-type', 4, 4, { entry: 'mipmap', data: 'null', type: 0 }));

    // One case per routine family of the other GL types (glu-mipmap-full.test.ts covers every format x type).
    const other = (id: string, w: number, h: number, type: number, fmt: number, length: number) => add(make(id, w, h, { type, fmt, ifmt: fmt === 6400 ? 6408 : fmt, bytes: floatSafe(randomBytes(length, id.length)) }));
    other('type-byte', 4, 4, 5120, GL_RGBA, 64);
    other('type-ushort', 4, 4, 5123, GL_RGBA, 128);
    other('type-short', 4, 4, 5122, GL_RGBA, 128);
    other('type-uint', 4, 4, 5125, GL_RGBA, 256);
    other('type-int', 4, 4, 5124, GL_RGBA, 256);
    other('type-float', 4, 4, 5126, GL_RGBA, 256);
    other('type-4444', 4, 4, 32819, GL_RGBA, 32);
    other('type-332', 4, 4, 32818, 6407, 16);
    other('type-bitmap', 8, 8, 6656, 6400, 8);
    other('npot-byte', 3, 3, 5120, GL_RGBA, 36);
    other('npot-ushort', 3, 3, 5123, GL_RGBA, 72);
    other('npot-short', 3, 3, 5122, GL_RGBA, 72);
    other('npot-uint', 3, 3, 5125, GL_RGBA, 144);
    other('npot-int', 3, 3, 5124, GL_RGBA, 144);
    other('npot-float', 3, 3, 5126, GL_RGBA, 144);
    other('npot-565', 3, 3, 33635, 6407, 24);
    return cases;
}

test('uh.a(Lve;Lm;IZ)Z calls GLU.gluBuild2DMipmaps(GL_TEXTURE_2D, GL_RGBA, size, size, GL_RGBA, GL_UNSIGNED_BYTE, ByteBuffer.wrap(byte[])) with size 128 or 64', () => {
    const javap = Bun.spawnSync(['javap', '-c', '-p', '-classpath', hdGamepackPath, 'uh']);
    expect(javap.exitCode, javap.stderr.toString()).toBe(0);
    const text = javap.stdout.toString();
    const method = text.slice(text.indexOf('final boolean a(ve, m, int, boolean);'));
    const code = method.slice(0, method.indexOf('\n\n'));
    const at = (pc: number) => {
        const m = new RegExp('^\\s*' + pc + ': (.*)$', 'm').exec(code);
        return m === null ? '' : (m[1] ?? '').replace(/\s+/g, ' ').trim();
    };
    // size = flag ? 64 : 128
    expect(at(44)).toBe('iload 4');
    expect(at(46)).toBe('ifne 55');
    expect(at(49)).toBe('sipush 128');
    expect(at(55)).toBe('bipush 64');
    expect(at(57)).toBe('istore 6');
    // the pixels: ByteBuffer.wrap of the texture's byte[]
    expect(at(163)).toContain('Method java/nio/ByteBuffer.wrap:([B)Ljava/nio/ByteBuffer;');
    expect(at(166)).toBe('astore 9');
    expect(at(432)).toContain('class javax/media/opengl/glu/GLU');
    expect([443, 446, 449, 451, 453, 456, 459].map(at)).toEqual(['sipush 3553', 'sipush 6408', 'iload 6', 'iload 6', 'sipush 6408', 'sipush 5121', 'aload 9']);
    expect(at(461)).toContain('Method javax/media/opengl/glu/GLU.gluBuild2DMipmaps:(IIIIIILjava/nio/Buffer;)I');
    expect(at(464)).toBe('pop');
    // it is the only GLU call in the gamepack
    expect(text.split('javax/media/opengl/glu/GLU.gluBuild2DMipmaps').length - 1).toBe(1);
}, 30000);

test('JOGL GLU mipmap port issues the shipped jogl.jar GL call sequence and level bytes for every case', () => {
    const cases = corpus();
    expect(new Set(cases.map(c => c.id)).size).toBe(cases.length);
    const java = javaRun(cases);
    expect(java.size).toBe(cases.length);

    const mismatches = compareAll(cases, java);
    expect(mismatches.slice(0, 12).join('\n')).toBe('');
    const compared = cases.length;
    let levels = 0;
    for (const lines of java.values()) levels += lines.filter(line => /^\d+\tglTexImage2D\t(?!32868|34075)/.test(line)).length;

    // the corpus reaches what it claims to
    const block = (id: string) => (java.get(id) ?? []).join('\n');
    for (const seed of [1, 2, 3]) {
        expect(block('client-128-s' + seed)).toContain('result\t0');
        expect(block('client-128-s' + seed).match(/\tglTexImage2D\t3553\t/g)?.length).toBe(8); // levels 0..7
        expect(block('client-64-s' + seed).match(/\tglTexImage2D\t3553\t/g)?.length).toBe(7); // levels 0..6
    }
    expect(block('client-128-gl10')).toContain('\tglGetIntegerv\t3379\t');
    expect(block('client-128-gle-probe')).toContain('\tglGetIntegerv\t3379\t');
    expect(block('client-128-max16')).toContain('\tglTexImage2D\t3553\t0\t6408\t16\t16\t0\t6408\t5121\tB:byte:0:1024:1024:direct:');
    expect(block('client-128-align8')).toContain('\tglTexImage2D\t3553\t7\t6408\t1\t1\t0\t6408\t5121\tB:byte:0:8:8:direct:');
    // nearestPower rounds 3 * 2^k up to 4 * 2^k: 100x60 is scaled up to 128x64
    expect(block('npot-100x60')).toContain('\tglTexImage2D\t3553\t0\t6408\t128\t64\t0\t6408\t5121\tB:byte:0:32768:32768:direct:');
    expect(block('client-64-align0')).toContain('throw\tjava.lang.ArithmeticException');
    expect(block('ver-nbsp')).toContain('throw\tjava.lang.NumberFormatException');
    expect(block('ver-ctrl-trim')).toContain('\tglTexImage2D\t32868\t');
    expect(block('ver-short')).toContain('throw\tjava.lang.StringIndexOutOfBoundsException');
    expect(block('ver-null')).toContain('throw\tjava.lang.NullPointerException');
    expect(block('glu-null')).toContain('throw\tjava.lang.IllegalArgumentException');
    expect(block('glu-noctx')).toContain('throw\tjavax.media.opengl.GLException');
    expect(block('glu-short-data')).toContain('throw\tjava.nio.BufferUnderflowException');
    expect(block('mipmap-heap-pos8-gle')).toContain('data\t8\t72\t-1');
    expect(compared).toBeGreaterThanOrEqual(100);
    expect(levels).toBeGreaterThanOrEqual(300);
    console.log('glu-mipmap: ' + compared + ' cases, ' + levels + ' levels compared');
}, 120000);

// Mipmap.image_size(IIII)I and the NumberFormatException message of closestFit's Double.parseDouble, run by the
// shipped jogl.jar (assertions disabled, as on the client JVM) and by the port. The GL_BITMAP arm's `width + 7`
// wraps as a Java int before the divide (Mipmap.image_size pc 50-56), and the message quotes the trimmed text
// (FloatingDecimal.readJavaFormatString reassigns `in = in.trim()` before it throws).
const MIPMAP_PROBE_JAVA = String.raw`
import com.sun.opengl.impl.mipmap.Mipmap;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.lang.reflect.Proxy;
import javax.media.opengl.GL;

public class MipmapProbeOracle {
    static String utf16(String s) {
        StringBuilder b = new StringBuilder();
        for (int i = 0; i < s.length(); i++) b.append(String.format("%04x", (int)s.charAt(i)));
        return b.toString();
    }

    static String fromUtf16(String h) {
        StringBuilder b = new StringBuilder();
        for (int i = 0; i < h.length(); i += 4) b.append((char)Integer.parseInt(h.substring(i, i + 4), 16));
        return b.toString();
    }

    public static void main(String[] args) throws Exception {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        for (String line; (line = in.readLine()) != null && !line.isEmpty();) {
            String[] f = line.split(" ");
            if (f[0].equals("size")) {
                int r = Mipmap.image_size(Integer.parseInt(f[1]), Integer.parseInt(f[2]), Integer.parseInt(f[3]), Integer.parseInt(f[4]));
                System.out.println(line + " => " + r);
                continue;
            }
            String ver = fromUtf16(f[1]);
            GL gl = (GL)Proxy.newProxyInstance(GL.class.getClassLoader(), new Class<?>[]{GL.class}, (proxy, m, a) -> {
                switch (m.getName()) {
                    case "glGetString": return ver;
                    case "glGetTexLevelParameteriv": ((int[])a[3])[(Integer)a[4]] = (Integer)a[1] == 1 ? 1 : 0; return null;
                    case "glGetIntegerv": ((int[])a[1])[(Integer)a[2]] = 2; return null;
                    default: return null;
                }
            });
            int[] w = new int[1], h = new int[1];
            try {
                Mipmap.closestFit(gl, 3553, 4, 4, 6408, 6408, 5121, w, h);
                System.out.println(line + " => " + w[0] + " " + h[0]);
            } catch (NumberFormatException e) {
                System.out.println(line + " throw java.lang.NumberFormatException " + utf16(e.getMessage()));
            } catch (RuntimeException e) {
                System.out.println(line + " throw " + e.getClass().getName());
            }
        }
    }
}
`;

test("Mipmap.image_size wraps width + 7 and closestFit's NumberFormatException quotes the trimmed text, as the shipped jogl.jar", () => {
    const lines: string[] = [];
    const widths = [-9, -1, 0, 1, 7, 8, 9, 1000000000, 2147483640, 2147483641, 2147483647, -2147483648];
    for (const w of widths)
        for (const h of [1, 3])
            for (const [fmt, type] of [
                [6400, 6656],
                [6408, 6656],
                [6408, 5121],
                [6407, 5126],
                [6408, 32819]
            ]) {
                lines.push(['size', w, h, fmt, type].join(' '));
            }
    const versions = ['ab c', 'ab\tc', ' x  1', 'e  x', '-  1', 'x' + String.fromCharCode(0xa0) + 'y', '1. 5', '2.1 x', 'abc', '\u00011.x', '1.\u0001x', 'ab', '0x1p0'];
    for (const v of versions) lines.push('ver ' + utf16(v));

    const ts = lines.map(line => {
        const f = line.split(' ');
        if (f[0] === 'size') return line + ' => ' + Mipmap.image_size(Number(f[1]), Number(f[2]), Number(f[3]), Number(f[4]));
        const ver = [...(f[1].match(/.{4}/g) ?? [])].map(u => String.fromCharCode(parseInt(u, 16))).join('');
        const gl = new Proxy(
            {},
            {
                get: (_target, name) => {
                    return (...a: unknown[]) => {
                        if (name === 'glGetString') return ver;
                        if (name === 'glGetTexLevelParameteriv') (a[3] as Int32Array)[a[4] as number] = a[1] === 1 ? 1 : 0;
                        if (name === 'glGetIntegerv') (a[1] as Int32Array)[a[2] as number] = 2;
                        return undefined;
                    };
                }
            }
        ) as unknown as GL;
        const w = new Int32Array(1),
            h = new Int32Array(1);
        try {
            Mipmap.closestFit(gl, 3553, 4, 4, 6408, 6408, 5121, w, h);
            return line + ' => ' + w[0] + ' ' + h[0];
        } catch (e) {
            const name = javaName(e);
            if (name === 'java.lang.NumberFormatException' && e instanceof Error) {
                return line + ' throw ' + name + ' ' + utf16(e.message.slice('NumberFormatException: '.length));
            }
            return line + ' throw ' + name;
        }
    });

    const dir = mkdtempSync(join(tmpdir(), 'rs530-mipmap-probe-'));
    try {
        writeFileSync(join(dir, 'MipmapProbeOracle.java'), MIPMAP_PROBE_JAVA);
        const compile = Bun.spawnSync(['javac', '-cp', joglPath, '-d', dir, join(dir, 'MipmapProbeOracle.java')]);
        expect(compile.exitCode, compile.stderr.toString()).toBe(0);
        const run = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + joglPath, 'MipmapProbeOracle'], { stdin: Buffer.from(lines.join('\n') + '\n') });
        expect(run.exitCode, run.stderr.toString()).toBe(0);
        const java = run.stdout.toString().trimEnd().split(/\r?\n/);
        expect(java.length).toBe(lines.length);
        expect(ts).toEqual(java);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
    // the cases reach what they claim to
    expect(ts).toContain('size 2147483641 1 6400 6656 => -268435456');
    expect(ts).toContain('size 2147483647 1 6400 6656 => -268435455');
    expect(ts).toContain('ver ' + utf16('ab c') + ' throw java.lang.NumberFormatException ' + utf16('For input string: "ab"'));
    expect(ts).toContain('ver ' + utf16('1. 5') + ' => 2 2'); // "1. " parses as 1.0 < 1.1: the GL_MAX_TEXTURE_SIZE fallback (2)
    expect(ts).toContain('ver ' + utf16('2.1 x') + ' => 4 4'); // the proxy probe accepts 4x4
}, 60000);

// The Double.parseDouble emulation behind closestFit's GL_VERSION check (Mipmap.ts javaParseDouble), against the
// real java.lang.Double.parseDouble: decimal and hexadecimal grammars, rounding (half-even ties, subnormals,
// overflow), suffixes, trimming and NumberFormatException messages. closestFit itself passes at most three chars.
const PARSE_DOUBLE_JAVA = String.raw`
import java.io.BufferedReader;
import java.io.InputStreamReader;

public class ParseDoubleOracle {
    static String utf16(String s) {
        StringBuilder b = new StringBuilder();
        for (int i = 0; i < s.length(); i++) b.append(String.format("%04x", (int)s.charAt(i)));
        return b.toString();
    }

    public static void main(String[] args) throws Exception {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        for (String line; (line = in.readLine()) != null && !line.isEmpty();) {
            StringBuilder s = new StringBuilder();
            for (int i = 0; i < line.length(); i += 4) s.append((char)Integer.parseInt(line.substring(i, i + 4), 16));
            try {
                System.out.println(line + " " + Long.toHexString(Double.doubleToRawLongBits(Double.parseDouble(s.toString()))));
            } catch (NumberFormatException e) {
                System.out.println(line + " throw " + utf16(e.getMessage()));
            }
        }
    }
}
`;

test('javaParseDouble matches java.lang.Double.parseDouble, hexadecimal floats included', () => {
    const inputs = [
        '1.1',
        '2.1',
        ' 1.5 ',
        '1e1',
        '-0',
        '+0.0',
        '.5',
        '5.',
        'NaN',
        '-Infinity',
        '1.F',
        '2.d',
        '1e',
        '1..',
        'x',
        '',
        '..',
        '-1.2.',
        '00.0.',
        '1e1.5',
        '1.e.',
        'N..',
        '+-1',
        '-',
        '0.x.',
        '0x1p0',
        '0X1P0',
        '0x1.8p1',
        '-0x1.8p1',
        '+0x.8p1',
        '0x1.p-1',
        '0xAbC.dEfp-4',
        '0x1p0f',
        '0x1p0D',
        ' 0x1p3 ',
        '0x0p0',
        '-0x0.0p99',
        '0x1p1023',
        '0x1.fffffffffffffp1023',
        '0x1.fffffffffffff8p1023',
        '0x1.fffffffffffff7ffp1023',
        '0x1p1024',
        '0x1p99999999999',
        '0x1p-1022',
        '0x1p-1074',
        '0x1p-1075',
        '0x1.0000000000001p-1075',
        '0x1.8p-1074',
        '0x1p-1076',
        '0x0.0000000000001p-1022',
        '0x1.00000000000008p0',
        '0x1.00000000000018p0',
        '0x1.000000000000080000001p0',
        '0x1.0000000000000fffp0',
        '0x123456789abcdef0123p-20',
        '0x.p1',
        '0xp1',
        '0x1',
        '0x1.8',
        '0x1p',
        '0x1p+',
        '0x1p+2',
        '0x1p-0',
        '0x1g0',
        '1p0',
        '0x1p1.5',
        '0x-1p0',
        '- 0x1p0'
    ];
    const bits = (v: number) => {
        const b = new BigInt64Array(new Float64Array([v]).buffer)[0] ?? 0n;
        return BigInt.asUintN(64, b).toString(16);
    };
    const lines = inputs.map(utf16);
    const ts = inputs.map((input, i) => {
        try {
            return lines[i] + ' ' + bits(javaParseDouble(input));
        } catch (e) {
            if (e instanceof Error && e.message.startsWith('NumberFormatException: ')) return lines[i] + ' throw ' + utf16(e.message.slice('NumberFormatException: '.length));
            return lines[i] + ' HOST ' + String(e);
        }
    });
    const dir = mkdtempSync(join(tmpdir(), 'rs530-parse-double-'));
    try {
        writeFileSync(join(dir, 'ParseDoubleOracle.java'), PARSE_DOUBLE_JAVA);
        const compile = Bun.spawnSync(['javac', '-d', dir, join(dir, 'ParseDoubleOracle.java')]);
        expect(compile.exitCode, compile.stderr.toString()).toBe(0);
        // the empty string ends the oracle's input, so it is compared separately
        const run = Bun.spawnSync(['java', '-cp', dir, 'ParseDoubleOracle'], { stdin: Buffer.from(lines.filter(l => l !== '').join('\n') + '\n') });
        expect(run.exitCode, run.stderr.toString()).toBe(0);
        const java = run.stdout.toString().trimEnd().split(/\r?\n/);
        expect(ts.filter((_, i) => lines[i] !== '')).toEqual(java);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
    expect(ts[inputs.indexOf('')]).toBe(' throw ' + utf16('empty String'));
    expect(ts[inputs.indexOf('0x1p-1074')]).toBe(utf16('0x1p-1074') + ' 1');
    expect(ts[inputs.indexOf('0x1p1024')]).toBe(utf16('0x1p1024') + ' 7ff0000000000000');
}, 60000);
