import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { mdFence } from './glTraceSpec.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';
import { GlTraceWriter, parseTrace, serializeTrace } from '../../src/gl/GlTrace.js';
import { capsProfileFromJson, capsProfileToJson, FALLBACK_CAPS_PROFILE } from '../../src/gl/CapsProfile.js';
import { RecordingGLDrawableFactory } from '../../src/gl/RecordingGL.js';
import { NullGLDrawableFactory } from '../../src/gl/NullGL.js';
import { diffTraces } from './glTraceDiff.js';
import GLCapabilities from '../../src/jogl/GLCapabilities.js';
import GLU from '../../src/jogl/GLU.js';
import { glMethods, type GL } from '../../src/jogl/GL.js';
import type GLContext from '../../src/jogl/GLContext.js';
import type GLDrawable from '../../src/jogl/GLDrawable.js';
import ByteBuffer from '../../src/util/nio/ByteBuffer.js';
import FloatBuffer from '../../src/util/nio/FloatBuffer.js';
import ShortBuffer from '../../src/util/nio/ShortBuffer.js';

const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

function rows(dir: string): string[][] {
    const text = readFileSync(join(dir, 'trace.tsv'), 'utf8');
    expect(serializeTrace(parseTrace(text))).toBe(text);
    return text
        .trimEnd()
        .split('\n')
        .filter(line => !line.startsWith('#'))
        .map(line => line.split('\t'));
}

function payload(dir: string, descriptor: string, count = Infinity) {
    const [, type, position, limit, capacity, storage, hash, hex] = descriptor.split(':');
    const bytes = hex === undefined ? readFileSync(join(dir, 'blobs', hash)) : Buffer.from(hex, 'hex');
    expect(sha(bytes)).toBe(hash);
    expect(bytes.length).toBe(Math.min(count, Number(limit) - Number(position)) * (type === 'byte' ? 1 : 4));
    expect(Number(capacity)).toBeGreaterThanOrEqual(Number(limit));
    expect(storage).toBe('direct');
    return bytes;
}

function checkOrder(lines: string[][]) {
    let frame = 0;
    let sequence = 0;
    let deletion = 0;
    for (const [id, call] of lines) {
        if (call.startsWith('glDelete')) {
            expect(id).toBe(frame + '.d' + deletion++);
            continue;
        }
        expect(id).toBe(frame + '.' + sequence++);
        if (call === 'GLDrawable.swapBuffers') {
            frame++;
            sequence = 0;
            deletion = 0;
        }
    }
}

function checkMipmaps(dir: string, lines: string[][], size: number) {
    let reference = Buffer.alloc(size * size * 4);
    for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
            const i = (y * size + x) * 4;
            reference[i] = x * 11 + y * 23;
            reference[i + 1] = x ^ y;
            reference[i + 2] = x * y;
            reference[i + 3] = 255 - y;
        }
    const uploads = lines.filter(row => row[1] === 'glTexImage2D' && row[2] === '3553');
    expect(uploads.length).toBe(Math.log2(size) + 1);
    for (const [level, row] of uploads.entries()) {
        const width = size >> level;
        expect(row.slice(2, 10)).toEqual(['3553', String(level), '6408', String(width), String(width), '0', '6408', '5121']);
        // JOGL reuses buffers with larger limits at later levels. Only width*width texels enter GL.
        const bytes = payload(dir, row[10]);
        expect(bytes.subarray(0, reference.length).equals(reference)).toBe(true);
        const half = width >> 1;
        const next = Buffer.alloc(half * half * 4);
        for (let y = 0; y < half; y++)
            for (let x = 0; x < half; x++)
                for (let c = 0; c < 4; c++) {
                    const p = (2 * y * width + 2 * x) * 4 + c;
                    next[(y * half + x) * 4 + c] = (reference[p] + reference[p + 4] + reference[p + width * 4] + reference[p + width * 4 + 4] + 2) >> 2;
                }
        reference = next;
    }
}

function surface(gl: GL) {
    const sorted = [...glMethods].sort(([a, ad], [b, bd]) => (a + ad < b + bd ? -1 : a + ad > b + bd ? 1 : 0));
    for (const [name, signature] of sorted) {
        const descriptors = signature.slice(1, signature.indexOf(')')).match(/\[?(?:[ZBIFDJ]|L[^;]+;)/g) ?? [];
        const args = descriptors.map(d => {
            switch (d) {
                case 'I':
                    return 1;
                case 'J':
                    return -4294967297n;
                case 'F':
                    return -0.25;
                case 'D':
                    return 1.25;
                case 'Z':
                    return true;
                case 'B':
                    return -93;
                case 'Ljava/lang/String;':
                    return '% \u0394\ud83d\ude42\ud800A\udc00';
                case '[I':
                    return new Int32Array(17).fill(551);
                case '[F':
                    return new Float32Array(17).fill(-0);
                case 'Ljava/nio/FloatBuffer;':
                    return FloatBuffer.wrap(Float32Array.of(0.25, 0.5, 1, -0));
                case 'Ljava/nio/Buffer;':
                    return ShortBuffer.wrap(Int16Array.of(-1, 0, 0x1234, 0x4567))
                        .position(1)
                        .limit(3);
                default:
                    throw new Error(name + ' has unexpected parameter ' + d);
            }
        });
        Reflect.apply(gl[name], gl, args);
    }
}

function ambient(first: GLContext, drawable: GLDrawable) {
    const a = first.getGL();
    const out = new Float32Array(4);
    a.glGetFloatv(2899, out, 0);
    expect(out).toEqual(Float32Array.of(0.2, 0.2, 0.2, 1));
    a.glDrawBuffer(1028);
    a.glReadBuffer(1026);
    const source = Float32Array.of(77, 0.375, -0.5, 1.25, -0, 88);
    a.glLightModelfv(2899, source, 1);
    source.fill(0);
    const second = drawable.createContext(null);
    expect(second.makeCurrent()).toBe(2);
    const b = second.getGL();
    const buffers = new Int32Array(2);
    b.glGetIntegerv(3073, buffers, 0);
    b.glGetIntegerv(3074, buffers, 1);
    expect(buffers).toEqual(Int32Array.of(1029, 1029));
    b.glGetFloatv(2899, out, 0);
    expect(out).toEqual(Float32Array.of(0.2, 0.2, 0.2, 1));
    b.glLightModelfv(2899, Float32Array.of(1, 1, 0, 1), 0);
    expect(first.makeCurrent()).toBe(1);
    a.glGetIntegerv(3073, buffers, 0);
    a.glGetIntegerv(3074, buffers, 1);
    expect(buffers).toEqual(Int32Array.of(1028, 1026));
    const words = FloatBuffer.allocate(6).position(2);
    a.glGetFloatv(2899, words);
    expect(words.position()).toBe(2);
    expect(words.array()).toEqual(Float32Array.of(0, 0, 0.375, -0.5, 1.25, -0));
    second.destroy();
}

function comparePortTrace(java: string[], work: string, mode: 'roundtrip' | 'mipmaps' | 'surface' | 'ambient') {
    const dir = join(work, mode);
    const original = Bun.spawnSync([...java, '-Dgltrace.stacks=false', 'GlRecorderOracle', dir, mode]);
    expect(original.exitCode, original.stderr.toString()).toBe(0);
    const writer = new GlTraceWriter({
        blobs(hash, bytes) {
            expect(readFileSync(join(dir, 'blobs', hash)).equals(bytes)).toBe(true);
        }
    });
    const profile = capsProfileFromJson(readFileSync(join(import.meta.dir, 'rtx5070.json'), 'utf8'));
    const factory = new RecordingGLDrawableFactory(new NullGLDrawableFactory(profile), writer);
    const caps = new GLCapabilities();
    caps.setSampleBuffers(true);
    caps.setNumSamples(2);
    const drawable = factory.getGLDrawable({}, caps, null);
    const context = drawable.createContext(null);
    expect(context.makeCurrent()).toBe(0);
    drawable.setRealized(true);
    expect(context.makeCurrent()).toBe(2);
    if (mode === 'roundtrip') {
        const gl = context.getGL();
        const ids = Int32Array.of(-1, -1, -1, -1);
        gl.glGenTextures(2, ids, 1);
        gl.glBindTexture(3553, ids[2]);
        gl.glClearColor(-0, 0.5, -1.5, 1);
        gl.glClearDepth(0.25);
        gl.glColor3ub(-128, 0, 127);
        gl.glDepthMask(false);
        gl.glVertexPointer(3, 5126, 12, 4294967300n);
        gl.glLightfv(16384, 4608, Float32Array.of(42, -0, 0.25, 0.5, 1, 77), 1);
        gl.glGetIntegerv(34018, Int32Array.of(-9, -9, -9), 1);
        const buf = ByteBuffer.allocateDirect(8);
        buf.put(Int8Array.of(-1, 1, 2, 3, 4, 5, 6, -2))
            .position(1)
            .limit(7);
        gl.glBufferDataARB(34962, 6, buf, 35044);
        gl.glDeleteTextures(1, ids, 1);
        drawable.swapBuffers();
        gl.glBindTexture(3553, ids[2]);
        gl.glBindTexture(3553, 811);
        gl.glGetString(7936);
        gl.glGetString(7939);
        gl.glGetString(-1);
        gl.isExtensionAvailable('GL_VERSION_4_6');
        gl.glColor4fv(Float32Array.of(0.25, -0), 0);
        gl.glProgramStringARB(34336, 34933, 6, 'a\t% é');
        const partial = Int32Array.of(0);
        expect(() => gl.glGetIntegerv(3386, partial, 0)).toThrow();
        expect(partial[0]).toBe(32768);
        expect(() => gl.glGenTextures(3, partial, 0)).toThrow();
        expect(() => gl.glLightfv(16384, 4608, new Float32Array(0), 0)).toThrow();
        for (const target of [32867, 32868, 34075, 32880]) {
            gl.glTexImage3D(target, 1, 6408, 16, 8, 4, 0, 6408, 5121, null);
            for (const pname of [4096, 4097, 32881, -1]) gl.glGetTexLevelParameteriv(target, 1, pname, partial, 0);
        }
        drawable.swapBuffers();
    } else if (mode === 'surface') {
        surface(context.getGL());
        drawable.swapBuffers();
    } else if (mode === 'ambient') {
        ambient(context, drawable);
    } else {
        for (const size of [128, 64]) {
            const rgba = ByteBuffer.allocateDirect(size * size * 4);
            for (let y = 0; y < size; y++)
                for (let x = 0; x < size; x++) {
                    rgba.put(x * 11 + y * 23)
                        .put(x ^ y)
                        .put(x * y)
                        .put(255 - y);
                }
            rgba.flip();
            expect(new GLU().gluBuild2DMipmaps(3553, 6408, size, size, 6408, 5121, rgba)).toBe(0);
            drawable.swapBuffers();
        }
    }
    context.release();
    context.destroy();
    expect(context.makeCurrent()).toBe(0);
    const fromJar = readFileSync(join(dir, 'trace.tsv'), 'utf8');
    const diff = diffTraces(fromJar, writer.text());
    expect(diff.equal, diff.report).toBe(true);
    expect(writer.text()).toBe(fromJar);
}

function checkAppendix(java: string[], work: string) {
    const dir = join(work, 'appendix');
    const profile = join(work, 'fallback.json');
    writeFileSync(profile, capsProfileToJson(FALLBACK_CAPS_PROFILE));
    const original = Bun.spawnSync([...java, '-Dgltrace.stacks=false', '-Dgltrace.caps=' + profile, 'GlTraceGoldenOracle', dir]);
    expect(original.exitCode, original.stderr.toString()).toBe(0);
    const expected = mdFence('golden');
    const fromJava = readFileSync(join(dir, 'trace.tsv'), 'utf8');
    const diff = diffTraces(expected, fromJava, { includeDeletions: true });
    expect(diff.equal, diff.report).toBe(true);
    expect(fromJava).toBe(expected);
}

describe('530 JOGL trace recorder', () => {
    let work: string;
    let java: string[];
    beforeAll(() => {
        work = mkdtempSync(join(tmpdir(), '530-gl-recorder-'));
        const libraries = [hdGamepackPath, joglPath].join(delimiter);
        const render = join(import.meta.dir, '../render');
        const compile = Bun.spawnSync([
            'javac',
            '-cp',
            libraries,
            '-d',
            work,
            join(import.meta.dir, 'GlRecorder.java'),
            join(import.meta.dir, 'GlRecorderOracle.java'),
            join(import.meta.dir, 'GlTraceGoldenOracle.java'),
            join(import.meta.dir, 'GlStateAuditOracle.java'),
            join(render, 'HdFrameBoundaryOracle.java'),
            join(render, 'HdWidgetFrameOracle.java'),
            join(render, 'HdTextureCommandOracle.java')
        ]);
        expect(compile.exitCode, compile.stderr.toString()).toBe(0);
        java = ['java', '-Djava.awt.headless=true', '-Dgltrace.caps=' + join(import.meta.dir, 'rtx5070.json'), '-cp', work + delimiter + libraries];
    }, 30_000);
    afterAll(() => {
        if (work) rmSync(work, { recursive: true, force: true });
    });

    test('the original renderer selects the RTX profile, populates ARB registers, and uploads every GLU mip level', () => {
        const dir = join(work, 'original');
        const original = Bun.spawnSync([...java, 'GlRecorderOracle', dir, 'jar']);
        expect(original.exitCode, original.stderr.toString()).toBe(0);
        expect(original.stdout.toString().trim()).toBe('0 4 32 8 46 true true true true true true true true');
        const trace = rows(dir);
        checkOrder(trace);
        const program = trace.find(row => row[1] === 'glProgramStringARB');
        if (!program) throw new Error('rd did not upload its ARB program');
        const hash = '05b4a0e72fd47dddd64ec397b735a871b1510d8c0cd0693189495d18f6a553ce';
        expect(program.slice(2)).toEqual(['34336', '34933', '1736', 'S:1736:' + hash]);
        expect(sha(readFileSync(join(dir, 'blobs', hash)))).toBe(hash);
        const parsed = parseTrace(readFileSync(join(dir, 'trace.tsv'), 'utf8'));
        expect(parsed.records.find(row => row.entry === 'glProgramStringARB')?.stack).toContain('rd.f 39');
        const noise = trace.filter(row => row[1] === 'glProgramLocalParameter4fvARB' && row[4].startsWith('B:'));
        expect(noise.length).toBe(64);
        const registers: Buffer[] = [];
        for (const [slot, row] of noise.entries()) {
            expect(row.slice(2, 4)).toEqual(['34336', String(slot)]);
            expect(row[4].split(':').slice(1, 6)).toEqual(['float', String(slot * 4), '65536', '65536', 'direct']);
            registers.push(payload(dir, row[4], 4));
        }
        expect(sha(Buffer.concat(registers))).toBe('2b920ae1e420ecbb75b3cfad8b57b67b57b85826972aae54f336b0d1ea9362ba');
        // mk.a -> LIGHT_MODEL_AMBIENT -> rd.a -> ARB local 66. Also sampled from the real RTX 5070 context.
        const ambient = 'fv:3d808081,3e008081,3e808081,3f800000';
        expect(trace.find(row => row[1] === 'glLightModelfv' && row[2] === '2899')?.[3]).toBe(ambient);
        expect(trace.find(row => row[1] === 'glGetFloatv' && row[2] === '2899')?.[3]).toBe(ambient);
        expect(trace.find(row => row[1] === 'glProgramLocalParameter4fvARB' && row[3] === '66')?.[4]).toBe(ambient);
        expect(trace.filter(r => r[1] === 'GLDrawable.swapBuffers').length).toBe(3);
        checkMipmaps(
            dir,
            trace.filter(row => row[0].startsWith('1.')),
            128
        );
        checkMipmaps(
            dir,
            trace.filter(row => row[0].startsWith('2.')),
            64
        );
    });

    test('the original widget redraws end at their drawable swaps', () => {
        const widgetDir = join(work, 'widgets');
        const widgets = Bun.spawnSync([...java, '-Dgltrace.dir=' + widgetDir, 'HdWidgetFrameOracle'], { stdin: Buffer.from('30 47 33 1 3\n') });
        expect(widgets.exitCode, widgets.stderr.toString()).toBe(0);
        const frames = rows(widgetDir);
        checkOrder(frames);
        expect(frames.filter(r => r[1] === 'GLDrawable.swapBuffers').length).toBe(2);
        for (const frame of ['0.', '1.']) {
            const events = frames.filter(row => row[0].startsWith(frame) && row[1] !== '~gl');
            expect(events[0].slice(1)).toEqual(['glEnable', '3089']);
            expect(events.some(row => row[1] === 'glVertex2f')).toBe(true);
            expect(events.at(-1)?.[1]).toBe('GLDrawable.swapBuffers');
        }
    });

    test('the original texture loader switches receivers and records the white pixel before a driver fault', () => {
        const textureDir = join(work, 'texture');
        const texture = Bun.spawnSync([...java, '-Dgltrace.dir=' + textureDir, 'HdTextureCommandOracle', '731', '915'], {
            stdin: Buffer.from('boot 0 - glGenTextures\ncontext 1 - -\nrgb 4 glTexEnvi -\nbind 19 - -\n')
        });
        expect(texture.exitCode, texture.stderr.toString()).toBe(0);
        const commands = rows(textureDir);
        checkOrder(commands);
        expect(commands.filter(r => r[1] === '~gl').map(r => r[2])).toEqual(['@G1', '@G2', '@G1']);
        expect(commands.filter(r => r.at(-1) === '!> Error').map(r => r[1])).toEqual(['glTexImage2D', 'glTexEnvi']);
        const white = Buffer.from([255, 255, 255, 255]);
        expect(commands.find(r => r[1] === 'glTexImage2D')?.[10]).toBe('B:int:0:1:1:heap:' + sha(white) + ':ffffffff');
        expect(readFileSync(join(textureDir, 'blobs', sha(white))).equals(white)).toBe(true);
        expect(commands.filter(r => r[1] === 'glBindTexture').map(r => r[3])).toEqual(['#T1', '#T?19']);
    });

    test('Java and TypeScript emit identical commands, object references, throws and deletion indices', () => {
        comparePortTrace(java, work, 'roundtrip');
    });
    test('the ported GLU emits byte-identical frames and blobs to the shipped JOGL implementation', () => {
        comparePortTrace(java, work, 'mipmaps');
    });
    test('all 102 overloads in the shipped JOGL interface serialize identically on both sides', () => {
        comparePortTrace(java, work, 'surface');
    });
    test('the Java trace reproduces GLTrace v1 Appendix A byte for byte', () => {
        checkAppendix(java, work);
    });
    test('new contexts start with their own ambient light, draw buffer and read buffer', () => {
        comparePortTrace(java, work, 'ambient');
    });
    test('the gamepack material uploads all cube faces and tf.h restores the last draw and read buffers', () => {
        const images = join(work, 'materials');
        const materials = Bun.spawnSync([...java, 'GlStateAuditOracle', images]);
        expect(materials.exitCode, materials.stderr.toString()).toBe(0);
        const states = rows(images);
        for (let face = 34069; face <= 34074; face++) {
            const uploads = states.filter(row => row[1] === 'glTexImage2D' && row[2] === String(face));
            expect(uploads.length).toBe(3);
            for (const row of uploads) {
                const [, kind, position, limit, capacity, storage, hash] = row[10].split(':');
                expect([kind, position, limit, capacity, storage]).toEqual(['byte', '0', '4096', '4096', 'heap']);
                expect(sha(readFileSync(join(images, 'blobs', hash)))).toBe(hash);
            }
        }
        expect(states.filter(r => r[1] === 'glDrawBuffer' || r[1] === 'glReadBuffer').map(r => r.slice(1))).toEqual([
            ['glDrawBuffer', '1028'],
            ['glReadBuffer', '1026'],
            ['glDrawBuffer', '1026'],
            ['glReadBuffer', '1024'],
            ['glDrawBuffer', '1028'],
            ['glReadBuffer', '1026']
        ]);
        const volumes = states.filter(r => r[1] === 'glTexImage3D');
        expect(volumes.map(r => r.slice(2, 11))).toEqual(Array(2).fill(['32879', '0', '6410', '64', '64', '64', '0', '6410', '5121']));
        const bytes3D = volumes.map(r => payload(images, r[11]));
        expect(bytes3D.map(sha)).toEqual(['4d1dae62ac78cf787eaca55032a0261e8720e1c7f34918661a2b1ae8958834f1', '232b74823805094c373dab9e8e342924bcb2ad278b1d1011568e30535b7615d4']);
        const fallbackDir = join(work, 'slices');
        const fallback = Bun.spawnSync([...java, '-Dgltrace.forceSlices=true', 'GlStateAuditOracle', fallbackDir]);
        expect(fallback.exitCode, fallback.stderr.toString()).toBe(0);
        const slices = rows(fallbackDir).filter(r => r[1] === 'glTexImage2D' && r[2] === '3553' && r[4] === '6410');
        expect(slices.length).toBe(128);
        for (const [index, slice] of slices.entries()) {
            const start = (index & 63) * 8192;
            expect(slice[10].split(':').slice(1, 6)).toEqual(['byte', String(start), '524288', '524288', 'direct']);
            expect(payload(fallbackDir, slice[10]).equals(bytes3D[index >> 6].subarray(start))).toBe(true);
        }
    }, 30_000);
});
