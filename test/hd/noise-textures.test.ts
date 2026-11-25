import { afterAll, beforeAll, expect, mock, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, delimiter, dirname, join, relative, resolve } from 'node:path';
import { capsProfileFromJson, type CapsProfile } from '#/gl/CapsProfile.js';
import { GlTraceWriter } from '#/gl/GlTrace.js';
import Noise3D from '#/gl/noise/Noise3D.js';
import FractalNoise3D from '#/gl/noise/FractalNoise3D.js';
import RidgedMultifractal3D from '#/gl/noise/RidgedMultifractal3D.js';
import WrappedException from '#/util/WrappedException.js';
import FractalNoiseVolume from '#/gl/noise/FractalNoiseVolume.js';
import RidgedNoiseVolume from '#/gl/noise/RidgedNoiseVolume.js';
import NullGL from '#/gl/NullGL.js';
import RecordingGL from '#/gl/RecordingGL.js';
import type { GL } from '#/jogl/GL.js';
import type ByteBuffer from '#/util/nio/ByteBuffer.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

// Gate for the HD noise volumes: NoiseTextures (lm) and gl/noise (wf, vd, we, ng, sb). The original lm.c()/lm.b()/
// lm.d() of runescape_gl.jar run on GlRecorder (HdNoiseOracle.java) and the TS port on RecordingGL(NullGL(profile)),
// for the captured RTX 5070 profile (3D textures) and the same profile without GL_EXT_texture3D (64 2D slices per
// volume). The GLTrace records, the lm statics and both volumes' bytes must be identical.
//
// NoiseTextures reads tf.t, tf.r and tf.c(I)V from GlRenderer and fa.a from GlCleaner, which other H1 units port in
// parallel. While a module on NoiseTextures' import graph is still missing, this test substitutes it: an
// empty module in general, and for GlRenderer/GlCleaner a stand-in with the members lm uses, tf.c(I)V transcribed
// from the jar (cfr/tf.java:549-562) over tf.s, which tf.<clinit> sets to -1. Once the batch lands nothing is replaced.
const standIns: string[] = [];
function standIn(name: string): object {
    if (name === 'GlRenderer') {
        const renderer = {
            gl: null as GL | null, // tf.t
            texture3d: false, // tf.r
            boundTexture: -1, // tf.s
            bindTexture2D(texture: number): void {
                // tf.c(I)V
                if (texture === renderer.boundTexture) return;
                if (renderer.gl === null) throw new TypeError('Null reference');
                if (texture !== -1) {
                    if (renderer.boundTexture === -1) renderer.gl.glEnable(3553);
                    renderer.gl.glBindTexture(3553, texture);
                } else {
                    renderer.gl.glDisable(3553);
                }
                renderer.boundTexture = texture;
            }
        };
        return renderer;
    }
    return name === 'GlCleaner' ? { textureMemory: 0 } : {}; // fa.a
}
const visited = new Set<string>();
const sourceRoot = resolve(import.meta.dir, '../../src');
function substituteMissing(file: string): void {
    if (visited.has(file)) return;
    visited.add(file);
    for (const [, specifier] of readFileSync(file, 'utf8').matchAll(/^import\s[^'";]*['"]((?:\.{1,2}|#)\/[^'"]+)['"]/gm)) {
        const path = specifier.startsWith('#/') ? resolve(sourceRoot, specifier.slice(2)) : resolve(dirname(file), specifier);
        const target = existsSync(path) ? path : path.replace(/\.[jt]s$/, '') + '.ts';
        if (existsSync(target)) {
            if (target.endsWith('.ts')) substituteMissing(target);
            continue;
        }
        const name = basename(target, '.ts');
        if (standIns.includes(name)) continue;
        standIns.push(name);
        const module = { default: standIn(name) };
        mock.module(specifier.startsWith('#/') ? specifier : relative(import.meta.dir, path).replaceAll('\\', '/'), () => module);
    }
}
substituteMissing(join(sourceRoot, 'gl', 'NoiseTextures.ts'));
if (standIns.length !== 0) console.log('noise-textures: stand-ins for missing ' + standIns.join(', '));
const { default: NoiseTextures } = await import('#/gl/NoiseTextures.js');
const { default: GlRenderer } = await import('../../src/gl/GlRenderer.js');
const { default: GlCleaner } = await import('../../src/gl/GlCleaner.js');

// SHA-256 of lm.d (ng) and lm.c (sb), as HdInitOracle and init-context.test.ts pin them.
const RIDGED = '4d1dae62ac78cf787eaca55032a0261e8720e1c7f34918661a2b1ae8958834f1';
const FRACTAL = '232b74823805094c373dab9e8e342924bcb2ad278b1d1011568e30535b7615d4';
const SIZES = ['1x1x1', '3x5x7', '7x3x5', '16x8x4', '64x2x1', '2x64x3', '5x1x64', '0x4x4', '33x17x9'];
const sha = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');
const bytes = (data: Int8Array | null) => {
    if (data === null) throw new TypeError('null volume');
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
};
let dir: string, classpath: string;
const profiles = new Map<string, { path: string; profile: CapsProfile }>();

beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'rs530-hd-noise-'));
    classpath = [dir, hdGamepackPath, joglPath].join(delimiter);
    const sources = ['GlRecorder.java', 'HdNoiseOracle.java'].map(name => join(import.meta.dir, name));
    const build = Bun.spawnSync(['javac', '-encoding', 'UTF-8', '-cp', classpath, '-d', dir, ...sources]);
    expect(build.exitCode, build.stderr.toString()).toBe(0);
    const captured = readFileSync(join(import.meta.dir, 'rtx5070.json'), 'utf8');
    const no3d = JSON.parse(captured);
    const tokens = (no3d.strings[7939] as string).split(' ');
    expect(tokens).toContain('GL_EXT_texture3D');
    no3d.strings[7939] = tokens.filter(x => x !== 'GL_EXT_texture3D').join(' ');
    no3d.name = 'rtx5070-no3d';
    writeFileSync(join(dir, 'no3d.json'), JSON.stringify(no3d));
    profiles.set('rtx5070', { path: join(import.meta.dir, 'rtx5070.json'), profile: capsProfileFromJson(captured) });
    profiles.set('no3d', { path: join(dir, 'no3d.json'), profile: capsProfileFromJson(JSON.stringify(no3d)) });
});

afterAll(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
});

function oracle(...args: string[]): string[] {
    const run = Bun.spawnSync(['java', '-XX:-OmitStackTraceInFastThrow', '-Djava.awt.headless=true', '-cp', classpath, 'HdNoiseOracle', ...args], { timeout: 60000 });
    expect(run.exitCode, run.stdout.toString() + run.stderr.toString()).toBe(0);
    return run.stdout.toString().trim().split(/\r?\n/);
}

test('generators match ng.b and sb.b at non-cubic sizes, and se.a over edge values', () => {
    const lines = oracle('volumes', ...SIZES);
    const expected = SIZES.map(size => {
        const [x, y, z] = size.split('x').map(Number);
        return 'volume ' + size + ' ' + sha(bytes(new RidgedNoiseVolume().build(x, y, z))) + ' ' + sha(bytes(new FractalNoiseVolume().build(x, y, z)));
    });
    const values = [-2147483648, -8191, -4096, -1, 0, 1, 4095, 8191, 2147483647];
    const out = new DataView(new ArrayBuffer(64 * values.length ** 3 * 4));
    let at = 0;
    for (let h = -16; h < 48; h++)
        for (const x of values)
            for (const y of values)
                for (const z of values) {
                    out.setInt32(at, Noise3D.gradient(x, y, z, h));
                    at += 4;
                }
    expected.push('gradient ' + sha(new Uint8Array(out.buffer)));
    for (const generator of [new FractalNoise3D(12, 5, 16, 2, 2, Math.fround(0.45)), new RidgedMultifractal3D(8, 5, 8, 8, 2, Math.fround(0.1), Math.fround(0.55), 3)]) {
        for (const length of [-1, 0, 4])
            for (const start of [-1, 0, 2, 3, 2147483647]) {
                const target = length < 0 ? null : new Int8Array(length);
                Reflect.set(generator, 'output', target);
                Reflect.set(generator, 'index', start);
                for (let value = -128; value <= 127; value++) {
                    const index = (value & 7) - 1;
                    let outcome = 'ok';
                    try {
                        generator.writeSample(index, value);
                    } catch (error) {
                        if (!(error instanceof WrappedException)) throw error;
                        if (error.cause instanceof TypeError) outcome = error.context + '|null';
                        else if (error.cause instanceof RangeError) outcome = error.context + '|' + error.cause.message.replace(/^array index /, '');
                        else throw error;
                    }
                    expected.push(outcome + ' ' + Reflect.get(generator, 'index') + ' ' + (target === null ? '-' : Buffer.from(target.buffer).toString('hex')));
                }
            }
    }
    expect(lines).toEqual(expected);
});

// The lm state lines HdNoiseOracle prints, from the TS statics.
function volumeState(buffer: ByteBuffer | null): string {
    if (buffer === null) return 'null';
    const copy = new Uint8Array(buffer.limit());
    for (let i = 0; i < copy.length; i++) copy[i] = buffer.get(i);
    return buffer.position() + ' ' + buffer.limit() + ' ' + buffer.capacity() + ' ' + buffer.isDirect() + ' ' + sha(copy);
}

function names(values: Int32Array | null): string {
    return values === null ? 'null' : Array.from(values).join(',');
}

function state(out: string[], label: string): void {
    out.push(
        label +
            ' ' +
            NoiseTextures.texture3d +
            ' ' +
            NoiseTextures.ridgedTexture +
            ' ' +
            NoiseTextures.fractalTexture +
            ' ' +
            names(NoiseTextures.ridgedSlices) +
            ' ' +
            names(NoiseTextures.fractalSlices) +
            ' bound ' +
            GlRenderer['boundTexture'] +
            ' memory ' +
            GlCleaner.textureMemory
    );
    out.push(label + ' ridged ' + volumeState(NoiseTextures['ridgedVolume']));
    out.push(label + ' fractal ' + volumeState(NoiseTextures['fractalVolume']));
}

const records = (text: string) =>
    text
        .trimEnd()
        .split(/\r?\n/)
        .filter(line => !line.startsWith('#'));

for (const [name, texture3d] of [
    ['rtx5070', true],
    ['no3d', false]
] as const) {
    test(
        'original lm.c/lm.b/lm.d on the ' + name + ' profile (' + (texture3d ? '3D textures' : '2D slices') + ')',
        () => {
            const entry = profiles.get(name);
            if (entry === undefined) throw new Error('profile ' + name);
            const { path, profile } = entry;
            const traceDir = join(dir, name);
            const lines = oracle(traceDir, path);
            expect(lines[0]).toBe('caps 0 ' + texture3d);
            const javaRecords = records(readFileSync(join(traceDir, 'trace.tsv'), 'utf8'));

            // The TS side starts from the same state as the fresh JVM: lm.<clinit>, tf.s = -1, fa.a = 0, tf.r from tf.m().
            NoiseTextures.fractalSlices = null;
            NoiseTextures.ridgedSlices = null;
            NoiseTextures.fractalTexture = -1;
            NoiseTextures.ridgedTexture = -1;
            NoiseTextures['fractalVolume'] = null;
            NoiseTextures['ridgedVolume'] = null;
            NoiseTextures.texture3d = false;
            const writer = new GlTraceWriter();
            GlRenderer.gl = new RecordingGL(new NullGL(profile), writer);
            GlRenderer.texture3d = texture3d;
            GlRenderer['boundTexture'] = -1;
            GlCleaner.textureMemory = 0;
            const out = ['caps 0 ' + texture3d];
            state(out, 'initial');
            NoiseTextures.createTextures();
            state(out, 'created');
            writer.mark('noise-delete');
            NoiseTextures.deleteTextures();
            state(out, 'deleted');
            NoiseTextures.unload();
            state(out, 'unloaded');
            const tsRecords = records(writer.text());

            expect(out).toEqual(lines);
            expect(tsRecords).toEqual(javaRecords);
            // 3D: gen, bind, image, 2 params per volume. Slices: one gen of 64, then per slice bind, image and 2 params,
            // with tf.c's glEnable(TEXTURE_2D) before the first bind. Then ~gl first, the mark, and 2 deletions.
            expect(tsRecords).toHaveLength(texture3d ? 1 + 10 + 1 + 2 : 1 + 2 * (1 + 64 * 4) + 1 + 1 + 2);
            expect(lines).toContain('created ridged ' + (texture3d ? 0 : 63 * 8192) + ' 524288 524288 true ' + RIDGED);
            expect(lines).toContain('created fractal ' + (texture3d ? 0 : 63 * 8192) + ' 524288 524288 true ' + FRACTAL);
            // Every upload reads [position, limit) of the volume; the trace hashes exactly that range.
            const uploads = tsRecords.filter(line => line.includes('\tglTexImage'));
            expect(uploads).toHaveLength(texture3d ? 2 : 128);
            const ridged = new Uint8Array(524288),
                fractal = new Uint8Array(524288);
            ridged.set(bytes(new RidgedNoiseVolume().build(64, 64, 64)));
            fractal.set(bytes(new FractalNoiseVolume().build(64, 64, 64)));
            uploads.forEach((line, i) => {
                const volume = i < uploads.length / 2 ? ridged : fractal;
                const position = texture3d ? 0 : (i % 64) * 8192;
                expect(lastColumn(line)).toBe('B:byte:' + position + ':524288:524288:direct:' + sha(volume.subarray(position)));
            });
        },
        120000
    );
}

function lastColumn(line: string): string {
    const columns = line.split('\t');
    return columns[columns.length - 1];
}
