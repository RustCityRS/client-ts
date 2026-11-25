import { afterAll, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import {
    bytesToHex,
    COUNT_TABLES,
    ENTRY_RULE_SOURCE,
    ENTRY_RULES,
    encodeBuffer,
    encodeString,
    formatRecordLine,
    formatValue,
    GlTraceWriter,
    javaUtf8Bytes,
    parseRecordLine,
    parseTrace,
    parseValue,
    type RefKind,
    serializeTrace,
    sha256Hex,
    TraceParseError,
    type TraceRecord,
    type TraceValue,
    UNRECORDED_MEMBERS,
    unescapeText
} from '#/gl/GlTrace.js';
import RecordingGL, { RecordingGLContext, RecordingGLDrawableFactory } from '#/gl/RecordingGL.js';
import NullGL, { NullGLDrawableFactory } from '#/gl/NullGL.js';
import { type CapsProfile, capsProfileFromJson, capsProfileToJson, DYNAMIC_ENTRY_POINTS, FALLBACK_CAPS_PROFILE, joglVersion, joglVersionExtensions, profileHasExtension, RADEON_CAPS_PROFILE, validateCapsProfile } from '#/gl/CapsProfile.js';
import { diffTraces, liveSnapshots } from './glTraceDiff.js';
import GLCapabilities from '#/jogl/GLCapabilities.js';
import GLContext from '#/jogl/GLContext.js';
import GLDrawableFactory, { registerGLDrawableFactory } from '#/jogl/GLDrawableFactory.js';
import GLException from '#/jogl/GLException.js';
import { type GL, glMethods } from '#/jogl/GL.js';
import ByteBuffer from '#/util/nio/ByteBuffer.js';
import ByteOrder from '#/util/nio/ByteOrder.js';
import FloatBuffer from '#/util/nio/FloatBuffer.js';
import IntBuffer from '#/util/nio/IntBuffer.js';
import ShortBuffer from '#/util/nio/ShortBuffer.js';
import { JavaError } from '#/util/JavaException.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

import { mdFence, mdTableRows, glTraceSpecPath } from './glTraceSpec.js';

// GLTrace v1 (src/gl/GLTRACE.md): the rule table against the shipped JOGL surface and the spec's tables, the
// cross-language golden trace of every entry point (Appendix A, printed byte for byte by an independent Java
// recorder) and the TS-only slip golden (Appendix C), parse/serialize round trips, name normalization, buffer
// hashing, string tokens against Java's String.getBytes(UTF_8), RecordingGL over NullGL end to end, the NullGL
// responder, the capability profile (including the real tf.m()I of runescape_gl.jar against the fallback profile,
// with its calls compared as GLTrace records written by an independent Java recorder), and the diff tool.

function sha(bytes: Uint8Array | string): string {
    return createHash('sha256').update(bytes).digest('hex');
}

function hexBytes(hex: string): Uint8Array {
    return Uint8Array.from(hex.match(/../g) ?? [], h => parseInt(h, 16));
}

// The synthetic call list behind GLTRACE.md Appendix A: every entry point of section 12 and every rule.
export function goldenScript(writer: GlTraceWriter): void {
    const factory = new RecordingGLDrawableFactory(new NullGLDrawableFactory(FALLBACK_CAPS_PROFILE), writer);
    const caps = new GLCapabilities();
    caps.setSampleBuffers(true);
    caps.setNumSamples(4);
    const canvas = {};
    const drawable = factory.getGLDrawable(canvas, caps, null);
    drawable.setRealized(true);
    const context = drawable.createContext(null);
    context.makeCurrent();
    const gl: GL = context.getGL();
    gl.glGetString(7936);
    gl.isExtensionAvailable('GL_ARB_vertex_program');
    gl.isExtensionAvailable('GL_NV_fence');
    const ints = new Int32Array(3);
    gl.glGetIntegerv(34018, ints, 1);
    gl.setSwapInterval(0);
    const tex = new Int32Array(3);
    gl.glGenTextures(2, tex, 1);
    const vbo = new Int32Array(1);
    gl.glGenBuffersARB(1, vbo, 0);
    const prog = new Int32Array(1);
    gl.glGenProgramsARB(1, prog, 0);
    const lists = gl.glGenLists(2);
    gl.glNewList(lists + 1, 4864);
    gl.glBegin(6);
    gl.glColor4ub(-128, 1, 2, 127);
    gl.glTexCoord2f(0.5, 1);
    gl.glVertex2f(-1.5, 2);
    gl.glEnd();
    gl.glEndList();
    gl.glCallList(lists + 1);
    gl.glActiveTexture(33985);
    gl.glBindTexture(3553, tex[2]);
    gl.glBindTexture(3553, 0);
    gl.glBindTexture(3553, 999);
    gl.glBindBufferARB(34962, vbo[0]);
    gl.glBindProgramARB(34336, prog[0]);
    gl.glEnable(2929);
    gl.glDisable(3042);
    gl.glAlphaFunc(516, 0);
    gl.glBlendFunc(770, 771);
    gl.glClearColor(0.25, 0.5, 1, 0);
    gl.glClear(16640);
    gl.glClearDepth(1);
    gl.glClientActiveTexture(33984);
    gl.glColor3ub(-1, 0, 127);
    gl.glColor4f(1, 0, -0, 0.5);
    const color = new Float32Array(6);
    new Uint32Array(color.buffer)[2] = 0x7fa00001; // a NaN with a payload
    color[3] = 0.75;
    gl.glColor4fv(color, 1);
    gl.glColorMaterial(1032, 5634);
    const bytes = ByteBuffer.allocateDirect(16).order(ByteOrder.nativeOrder());
    for (let i = 0; i < 16; i++) bytes.put(i, i * 17);
    bytes.position(12);
    gl.glColorPointer(4, 5121, 16, bytes);
    gl.glColorPointer(4, 5121, 16, 12n);
    gl.glCopyPixels(0, 0, 765, 503, 6144);
    gl.glCullFace(1029);
    gl.glDepthFunc(515);
    gl.glDepthMask(false);
    gl.glDisableClientState(32886);
    gl.glEnableClientState(32884);
    gl.glDrawBuffer(1026);
    gl.glReadBuffer(1024);
    const indexBytes = ByteBuffer.allocateDirect(12).order(ByteOrder.LITTLE_ENDIAN);
    const indices = indexBytes.asIntBuffer();
    indices.put(0, 0).put(1, 1).put(2, 2);
    gl.glDrawElements(4, 3, 5125, indices);
    gl.glDrawElements(4, 6, 5125, 36n);
    gl.glDrawPixels(2, 1, 32993, 5121, IntBuffer.wrap(new Int32Array([0x11223344, -1])));
    const fog = new Float32Array([0.5, 0.25, 0.125, 1, 3000]);
    gl.glFogfv(2918, fog, 0);
    gl.glFogfv(2915, fog, 4);
    gl.glFogf(2916, 3584);
    gl.glFogi(2917, 9729);
    const out4 = new Float32Array(5);
    gl.glGetFloatv(2899, out4, 1);
    const pointMax = FloatBuffer.allocate(1);
    gl.glGetFloatv(33063, pointMax);
    const width = new Int32Array(1);
    gl.glTexImage2D(32868, 1, 4, 64, 32, 0, 6408, 5121, null);
    gl.glGetTexLevelParameteriv(32868, 1, 4096, width, 0);
    gl.glHint(3156, 4353);
    const interleaved = ByteBuffer.allocateDirect(40).order(ByteOrder.nativeOrder()).asFloatBuffer();
    interleaved.put(0, 1).put(9, -2);
    gl.glInterleavedArrays(10791, 20, interleaved);
    gl.glInterleavedArrays(10787, 16, 0n);
    const ambient = new Float32Array([0.2, 0.3, 0.4, 1]);
    gl.glLightModelfv(2899, ambient, 0);
    gl.glLightf(16388, 4617, Math.fround(0.001));
    const light = new Float32Array([0, 1, 0, 0, 0.5]);
    gl.glLightfv(16384, 4611, light, 0);
    gl.glLightfv(16385, 4615, light, 4);
    gl.glMatrixMode(5889);
    gl.glLoadIdentity();
    const matrix = new Float32Array(16);
    for (let i = 0; i < 16; i++) matrix[i] = i === 0 || i === 5 || i === 10 || i === 15 ? 1 : 0;
    gl.glLoadMatrixf(matrix, 0);
    gl.glMultiTexCoord2f(33985, 0.25, 0.75);
    const normals = FloatBuffer.allocate(100);
    for (let i = 0; i < 100; i++) normals.put(i, i / 8);
    gl.glNormalPointer(5126, 12, normals);
    gl.glNormalPointer(5126, 40, 16n);
    gl.glOrtho(0, 765, 0, 503, -1, 1);
    gl.glPixelStorei(3317, 1);
    gl.glPixelZoom(1, -1);
    gl.glPointParameterfARB(33062, 1);
    gl.glPointParameterfvARB(33065, new Float32Array([1, 0, 0.0005]), 0);
    gl.glPolygonMode(1032, 6914);
    gl.glPushAttrib(8192);
    gl.glPopAttrib();
    gl.glPushMatrix();
    gl.glPopMatrix();
    gl.glProgramLocalParameter4fARB(34336, 65, Math.fround(0.005), 0, 0, 1);
    const table = ByteBuffer.allocateDirect(48).order(ByteOrder.nativeOrder());
    for (let i = 0; i < 12; i++) table.putFloat(i * 4, i + 0.5);
    const noise = table.asFloatBuffer().asReadOnlyBuffer();
    noise.position(4);
    gl.glProgramLocalParameter4fvARB(34336, 1, noise);
    gl.glProgramLocalParameter4fvARB(34336, 66, ambient, 0);
    gl.glProgramStringARB(34336, 34933, 300, PROGRAM);
    gl.glRasterPos2i(0, 0);
    gl.glRotatef(180, 1, 0, 0);
    gl.glScalef(1, -1, 1);
    gl.glScissor(0, 0, 0, 0);
    gl.glShadeModel(7425);
    const big = ByteBuffer.allocateDirect(8).order(ByteOrder.BIG_ENDIAN);
    big.putFloat(0, 1).putFloat(4, -2);
    gl.glTexCoordPointer(2, 5126, 8, big.asFloatBuffer());
    gl.glTexCoordPointer(2, 5126, 36, 28n);
    gl.glTexEnvf(8960, 34163, 2);
    gl.glTexEnvfv(8960, 8705, ambient, 0);
    gl.glTexEnvi(8960, 8704, 34160);
    gl.glTexGenfv(8192, 9474, ambient, 0);
    gl.glTexGenfv(8193, 9473, new Float32Array(2), 0);
    gl.glTexGeni(8194, 9472, 34065);
    gl.glTexImage1D(3552, 0, 6408, 2, 0, 6408, 5121, ByteBuffer.wrap(new Int8Array([1, 2, 3, 4, -1, -2, -3, -4])));
    const empty = ByteBuffer.allocate(4);
    empty.position(4);
    gl.glTexImage3D(32879, 0, 6410, 1, 1, 0, 0, 6410, 5121, empty);
    gl.glTexParameteri(3553, 10241, 9729);
    gl.glTranslatef(1.5, -2.5, 0);
    const shorts = ShortBuffer.wrap(new Int16Array([1, -1, 32767, -32768]));
    gl.glVertexPointer(2, 5122, 4, shorts);
    gl.glVertexPointer(3, 5126, 36, 0n);
    gl.glViewport(0, 0, 765, 503);
    bytes.position(0);
    gl.glBufferDataARB(34962, 16, bytes, 35044);
    gl.glBufferSubDataARB(34962, 4, 8, IntBuffer.wrap(new Int32Array([1, 2, 3, 4, 5]), 1, 2));
    gl.glDeleteTextures(1, tex, 1);
    gl.glDeleteLists(lists, 2);
    gl.glDeleteBuffersARB(1, vbo, 0);
    drawable.swapBuffers();
    gl.glClear(16384);
    try {
        gl.glGenTextures(0, new Int32Array(2), 2);
    } catch {
        // GLException: array offset argument "textures_offset" (2) equals or exceeds array length (2)
    }
    writer.mark('teardown');
    context.release();
    context.destroy();
    drawable.setRealized(false);
}

const PROGRAM = '!!ARBvp1.0\n' + 'MOV result.position, vertex.position;\n'.repeat(7) + 'END';

function goldenText(): string {
    const w = new GlTraceWriter({ meta: ['profile=fallback-gl21'] });
    goldenScript(w);
    return w.text();
}

// The synthetic call list behind GLTRACE.md Appendix C. It is TS-only and outside the cross-language stream: the
// three most common slips of section 14, each right after the Java-representable call it stands in for.
export function slipScript(writer: GlTraceWriter): void {
    const factory = new RecordingGLDrawableFactory(new NullGLDrawableFactory(FALLBACK_CAPS_PROFILE), writer);
    const drawable = factory.getGLDrawable({}, new GLCapabilities(), null);
    drawable.setRealized(true);
    const context = drawable.createContext(null);
    context.makeCurrent();
    const gl: GL = context.getGL();
    gl.glEnable(1.5 | 0);
    gl.glEnable(1.5); // a fractional int: the missing `| 0`
    gl.glColor4f(Math.fround(0.1), 0, 0, 1);
    gl.glColor4f(0.1, 0, 0, 1); // an inexact float: the missing Math.fround
    gl.glColor3ub((255 << 24) >> 24, 0, 0);
    gl.glColor3ub(255, 0, 0); // an out-of-range byte: the missing sign extension
    context.release();
    context.destroy();
    drawable.setRealized(false);
}

function slipTraceText(): string {
    const w = new GlTraceWriter({ meta: ['source=ts', 'profile=fallback-gl21'] });
    slipScript(w);
    return w.text();
}

// Every value of a record: its columns, then its return.
function recordValues(r: TraceRecord): TraceValue[] {
    return r.ret === null ? [...r.args] : [...r.args, r.ret];
}

test('SHA-256 matches node:crypto', () => {
    const lengths = [0, 1, 3, 55, 56, 57, 63, 64, 65, 119, 120, 127, 128, 129, 1000, 4096, 1 << 20];
    let seed = 12345;
    for (const n of lengths) {
        const data = new Uint8Array(n);
        for (let i = 0; i < n; i++) {
            seed = (Math.imul(seed, 1103515245) + 12345) | 0;
            data[i] = seed >>> 24;
        }
        expect(sha256Hex(data)).toBe(sha(data));
        if (n > 8) expect(sha256Hex(data.subarray(3, n - 2))).toBe(sha(data.subarray(3, n - 2)));
    }
});

// Allowed roles per JVM parameter type (GLTRACE.md section 12).
function rolesFor(type: string): RegExp {
    switch (type) {
        case 'I':
            return /^(int|name:[TBLP])$/;
        case 'B':
            return /^byte$/;
        case 'F':
            return /^float$/;
        case 'D':
            return /^double$/;
        case 'Z':
            return /^bool$/;
        case 'J':
            return /^long$/;
        case '[F':
            return /^(in-f|out-f)\[.+\]$/;
        case '[I':
            return /^(in-names:[TBLP]|out-names:[TBLP]|out-i)\[.+\]$/;
        case 'Ljava/nio/Buffer;':
            return /^buf(\[.+\])?$/;
        case 'Ljava/nio/FloatBuffer;':
            return /^(buf|out-buf)(\[.+\])?$/;
        case 'Ljava/lang/String;':
            return /^string$/;
        case 'Ljava/lang/Object;':
            return /^ref:O$/;
        case 'Ljavax/media/opengl/GLCapabilities;':
            return /^caps$/;
        case 'Ljavax/media/opengl/GLCapabilitiesChooser;':
            return /^ref:O$/;
        case 'Ljavax/media/opengl/GLContext;':
            return /^ref:C$/;
        default:
            throw new Error('unexpected parameter type ' + type);
    }
}

function returnRolesFor(type: string): RegExp {
    switch (type) {
        case 'V':
            return /^void$/;
        case 'I':
            return /^(int|alloc-lists\[\$0\])$/;
        case 'Z':
            return /^bool$/;
        case 'Ljava/lang/String;':
            return /^string$/;
        case 'Ljavax/media/opengl/GLDrawable;':
            return /^ref:D$/;
        case 'Ljavax/media/opengl/GLContext;':
            return /^ref:C$/;
        case 'Ljavax/media/opengl/GL;':
            return /^ref:G$/;
        default:
            throw new Error('unexpected return type ' + type);
    }
}

function descriptorTypes(descriptor: string): { params: string[]; ret: string } {
    const m = /^\((.*)\)(.+)$/.exec(descriptor);
    if (m === null) throw new Error(descriptor);
    const params = m[1].match(/\[?(?:[IBFDZJ]|L[^;]+;)/g) ?? [];
    expect(params.join('')).toBe(m[1]);
    return { params, ret: m[2] };
}

test('the entry rules cover the shipped GL interface and the context surface, with roles matching each descriptor', () => {
    const glRules = ENTRY_RULE_SOURCE.filter(r => r[2] === '-');
    expect(glRules.map(r => r[0] + r[1])).toEqual(glMethods.map(([name, d]) => name + d));
    expect(ENTRY_RULES.size).toBe(110);
    const surface = [
        'GLDrawableFactory.getGLDrawable(Ljava/lang/Object;Ljavax/media/opengl/GLCapabilities;Ljavax/media/opengl/GLCapabilitiesChooser;)Ljavax/media/opengl/GLDrawable;',
        'GLDrawable.createContext(Ljavax/media/opengl/GLContext;)Ljavax/media/opengl/GLContext;',
        'GLDrawable.setRealized(Z)V',
        'GLDrawable.swapBuffers()V',
        'GLContext.makeCurrent()I',
        'GLContext.release()V',
        'GLContext.destroy()V',
        'GLContext.getGL()Ljavax/media/opengl/GL;',
        'GLDrawableFactory.getFactory()Ljavax/media/opengl/GLDrawableFactory;',
        'GLContext.getCurrent()Ljavax/media/opengl/GLContext;',
        'GLCapabilities.<init>()V',
        'GLCapabilities.setSampleBuffers(Z)V',
        'GLCapabilities.setNumSamples(I)V',
        'GLU.<init>()V',
        'GLU.gluBuild2DMipmaps(IIIIIILjava/nio/Buffer;)I'
    ];
    // jogl-surface.tsv: 117 members = 102 GL + 15 others; each other member is either recorded or listed as unrecorded.
    const contextRules = ENTRY_RULE_SOURCE.filter(r => r[2] !== '-').map(r => r[0] + r[1]);
    expect([...contextRules, ...UNRECORDED_MEMBERS.map(u => u[0] + u[1])].sort()).toEqual([...surface].sort());
    for (const rule of ENTRY_RULES.values()) {
        const { params, ret } = descriptorTypes(rule.descriptor);
        const source = ENTRY_RULE_SOURCE.find(r => r[0] === rule.entry && r[1] === rule.descriptor);
        if (source === undefined) throw new Error(rule.entry);
        const roles = source[3] === '' ? [] : source[3].split(' ');
        expect(roles.length).toBe(params.length);
        roles.forEach((role, i) => {
            expect(role).toMatch(rolesFor(params[i]));
            if (/^(in-|out-f|out-i|out-names)/.test(role)) expect(params[i + 1]).toBe('I'); // the array offset
            const ref = /\$([0-9])/.exec(role);
            if (ref !== null) expect(params[Number(ref[1])]).toBe('I');
        });
        expect(source[4]).toMatch(returnRolesFor(ret));
        expect(rule.deletion).toBe(/^glDelete/.test(rule.entry));
        expect(rule.endsFrame).toBe(rule.entry === 'GLDrawable.swapBuffers');
        expect(rule.receiver === null).toBe(!rule.entry.includes('.'));
    }
});

test('GLTRACE.md sections 11, 12, 13 and Appendix B equal the implementation', () => {
    const code = (s: string) => '`' + s + '`';
    expect(mdTableRows('entry-table')).toEqual(ENTRY_RULE_SOURCE.map(([e, d, r, p, ret, f]) => [code(e), code(d), r === '-' ? '-' : code(r), p === '' ? '-' : p.split(' ').map(code).join(' '), code(ret), f === '-' ? '-' : code(f)]));
    expect(mdTableRows('unrecorded')).toEqual(UNRECORDED_MEMBERS.map(([m, d, why]) => [code(m), code(d), why]));
    const tables: Record<string, Record<number, number>> = {};
    for (const [table, pname, count] of mdTableRows('count-tables')) {
        const name = /^`([A-Z]+)`$/.exec(table)?.[1] ?? '?';
        (tables[name] ??= {})[Number(pname.split(' ')[0])] = Number(count);
    }
    expect(tables).toEqual(COUNT_TABLES as Record<string, Record<number, number>>);
    expect(mdFence('profile')).toBe(capsProfileToJson(FALLBACK_CAPS_PROFILE));
});

// The rule key a parsed record exercises: overloads with the same arity differ in their Buffer/long column.
function ruleKey(r: TraceRecord): string | null {
    if (r.entry.startsWith('~')) return null;
    const candidates = [...ENTRY_RULES.values()].filter(x => x.entry === r.entry && x.params.length + (x.receiver === null ? 0 : 1) === r.args.length);
    if (candidates.length === 1) return candidates[0].entry + candidates[0].descriptor;
    const last = r.args[r.args.length - 1];
    const rule = candidates.find(x => x.descriptor.endsWith(last.t === 'long' ? 'J)V' : 'Buffer;)V'));
    return rule === undefined ? null : rule.entry + rule.descriptor;
}

test('golden trace: goldenScript reproduces GLTRACE.md Appendix A and exercises every entry point', () => {
    const text = goldenText();
    expect(text).toBe(mdFence('golden'));
    const file = parseTrace(text);
    // Appendix A is the cross-language stream: nothing in it is TS-only.
    expect(file.records.filter(r => recordValues(r).some(v => v.t === 'slip')).map(formatRecordLine)).toEqual([]);
    const covered = new Set(file.records.map(ruleKey).filter(k => k !== null));
    expect([...ENTRY_RULES.keys()].filter(k => !covered.has(k))).toEqual([]);
    expect(new Set(file.records.map(r => r.entry))).toContain('~gl');
    expect(new Set(file.records.map(r => r.entry))).toContain('~mark');

    // Numbering: ordered seq and deletion indices count up per frame; swapBuffers ends frame 0.
    const next = new Map<string, number>();
    for (const r of file.records) {
        const key = r.frame + (r.deletion ? 'd' : 'o');
        expect(r.seq).toBe(next.get(key) ?? 0);
        next.set(key, r.seq + 1);
    }
    const swap = file.records.findIndex(r => r.entry === 'GLDrawable.swapBuffers');
    expect(file.records[swap].frame).toBe(0);
    expect(file.records[swap + 1].frame).toBe(1);
    expect(file.records.filter(r => r.deletion).map(r => r.entry)).toEqual(['glDeleteTextures', 'glDeleteLists', 'glDeleteBuffersARB']);

    // Every hash is independently right: inline payloads against node:crypto, and the two long payloads rebuilt.
    let inline = 0;
    for (const r of file.records) {
        for (const v of r.ret === null ? r.args : [...r.args, r.ret]) {
            if (v.t === 'buffer' && v.hex !== null) {
                expect(sha(hexBytes(v.hex))).toBe(v.sha);
                inline++;
            }
            if (v.t === 'string' && v.text !== null) {
                const raw = unescapeText(v.text);
                expect(raw.length).toBe(v.len);
                expect(sha(raw)).toBe(v.sha);
                inline++;
            }
        }
    }
    expect(inline).toBe(15); // 3 strings, 12 buffers (one empty)
    const normals = new DataView(new ArrayBuffer(400));
    for (let i = 0; i < 100; i++) normals.setFloat32(i * 4, i / 8, true);
    expect(text).toContain('glNormalPointer\t5126\t12\tB:float:0:100:100:heap:' + sha(new Uint8Array(normals.buffer)) + '\n');
    expect(text).toContain('glProgramStringARB\t34336\t34933\t300\tS:280:' + sha(PROGRAM) + '\n');
});

test('TS-only slips: slipScript reproduces GLTRACE.md Appendix C; each slip differs from its Java call in the slip column only', () => {
    const text = slipTraceText();
    expect(text).toBe(mdFence('slips'));
    const records = parseTrace(text).records;
    const slips = records.filter(r => recordValues(r).some(v => v.t === 'slip'));
    expect(slips.map(formatRecordLine)).toEqual(['0.7\tglEnable\ti?:1.5', '0.9\tglColor4f\tf?:3fb999999999999a\tf:00000000\tf:00000000\tf:3f800000', '0.11\tglColor3ub\tb?:255\t0\t0']);
    for (const slip of slips) {
        const java = records[records.indexOf(slip) - 1];
        expect(java.entry).toBe(slip.entry);
        expect(recordValues(java).some(v => v.t === 'slip')).toBe(false);
        const differing = slip.args.flatMap((v, k) => (formatValue(v) === formatValue(java.args[k]) ? [] : [k]));
        expect(differing).toEqual([slip.args.findIndex(v => v.t === 'slip')]);
    }
    // Against the trace a Java client makes (only the correct calls, one frame), the first slip is the divergence,
    // and the diff tool calls it out.
    let seq = 0;
    const javaSide = serializeTrace({ meta: [], records: records.filter(r => !slips.includes(r)).map(r => ({ ...r, seq: seq++ })) });
    const diff = diffTraces(javaSide, text, { context: 0 });
    expect(diff.equal).toBe(false);
    expect(diff.report.split('\n')[0]).toBe('GLTrace diff: first divergence at ordered record 7 (expected 0.7, actual 0.7)');
    expect(diff.report).toContain('note: actual passes a value the Java parameter type cannot hold: i?:1.5');
});

test('parse and serialize round-trip records, values and whole traces; malformed input is rejected', () => {
    const text = goldenText();
    const file = parseTrace(text);
    expect(file.records.length).toBe(121);
    expect(file.meta).toEqual(['profile=fallback-gl21']);
    expect(serializeTrace(file)).toBe(text);
    for (const r of file.records) expect(parseRecordLine(formatRecordLine(r))).toEqual({ ...r, stack: null });

    // Random values of every form: parseValue(formatValue(v)) == v and formatValue(parseValue(s)) == s.
    let seed = 99;
    const rnd = (n: number) => {
        seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
        return (seed >>> 8) % n;
    };
    const int = () => [0, 1, -1, 2147483647, -2147483648, 34962][rnd(6)] + (rnd(2) === 0 ? 0 : rnd(1000));
    const kinds = ['T', 'B', 'L', 'P'] as const;
    const refs: RefKind[] = ['F', 'D', 'C', 'G', 'O'];
    const shaOf = (n: number) => sha(String(n));
    const gens: (() => TraceValue)[] = [
        () => ({ t: 'int', v: int() | 0 }),
        () => ({ t: 'float', bits: (rnd(65536) * 65536 + rnd(65536)) >>> 0 }),
        () => ({ t: 'double', bits: (BigInt(rnd(1 << 30)) << 34n) | BigInt(rnd(1 << 30)) }),
        () => ({ t: 'bool', v: rnd(2) === 0 }),
        () => ({ t: 'long', v: BigInt(int() | 0) * (rnd(2) === 0 ? 1n : 4294967296n) }),
        () => ({ t: 'null' }),
        () => ({ t: 'name', kind: kinds[rnd(4)], id: 1 + rnd(500) }),
        () => ({ t: 'rawname', kind: kinds[rnd(4)], v: int() | 0 }),
        () => ({ t: 'ref', kind: refs[rnd(5)], id: 1 + rnd(9) }),
        () => ({ t: 'fv', bits: Array.from({ length: rnd(5) }, () => (rnd(1 << 30) * 4) >>> 0), missing: rnd(3) }),
        () => ({ t: 'iv', elems: Array.from({ length: rnd(5) }, () => (rnd(2) === 0 ? { t: 'int' as const, v: int() | 0 } : { t: 'name' as const, kind: kinds[rnd(4)], id: 1 + rnd(9) })), missing: rnd(3) }),
        () => ({ t: 'buffer', kind: (['byte', 'short', 'int', 'float'] as const)[rnd(4)], pos: rnd(9), lim: rnd(99), cap: rnd(999), direct: rnd(2) === 0, sha: shaOf(rnd(99)), hex: rnd(2) === 0 ? null : 'ab'.repeat(rnd(5)) }),
        () => ({ t: 'string', len: rnd(300), sha: shaOf(rnd(99)), text: rnd(2) === 0 ? null : 'GL_ARB_x%20y%25' }),
        () => ({
            t: 'caps',
            doubleBuffered: true,
            stereo: false,
            hardwareAccelerated: true,
            depthBits: 24,
            stencilBits: 0,
            redBits: 8,
            greenBits: 8,
            blueBits: 8,
            alphaBits: 0,
            accumRedBits: 0,
            accumGreenBits: 0,
            accumBlueBits: 0,
            accumAlphaBits: 0,
            sampleBuffers: rnd(2) === 0,
            numSamples: rnd(5)
        }),
        () => ({ t: 'slip', form: (['i?', 'f?', 'b?', 'o?', 'B?'] as const)[rnd(5)], text: ['1.5', '3fb999999999999a', '255', '12', 'Array'][rnd(5)] })
    ];
    for (let i = 0; i < 3000; i++) {
        const v = gens[i % gens.length]();
        const s = formatValue(v);
        expect(parseValue(s)).toEqual(v);
        expect(formatValue(parseValue(s))).toBe(s);
    }
    expect(parseValue('teardown', '~mark')).toEqual({ t: 'label', text: 'teardown' });

    const bad = [
        '0.0',
        'x.0\tglEnable\t1',
        '0.01\tglEnable\t1',
        '0.0\tglEnable\t-0',
        '0.0\tglEnable\t2147483648',
        '0.0\tglEnable\tf:3f80000',
        '0.0\tglEnable\tf:3F800000',
        '0.0\tglEnable\t#X1',
        '0.0\tglEnable\t#T0',
        '0.0\tglEnable\t@Q1',
        '0.0\tglEnable\tB:byte:0:1:1:heap:00',
        '0.0\tglEnable\tS:1:' + 'a'.repeat(64) + ':a b',
        '0.0\tglGetString\t1\t=> null\t2',
        '0.0\tglEnable\t!> Oops',
        '0.0\tglEnable\tfv:1,!0',
        '0.0\tglEnable\tK:T',
        '0.0\t~mark\tbad label'
    ];
    for (const line of bad) expect(() => parseRecordLine(line)).toThrow(TraceParseError);
    expect(() => parseTrace('#GLTrace v2\n')).toThrow(TraceParseError);
    expect(() => parseTrace('#GLTrace v1')).toThrow(TraceParseError);
    expect(() => parseTrace('#GLTrace v1\n0.0\tglEnd\n#! late meta\n')).toThrow(TraceParseError);
    expect(() => parseTrace('#GLTrace v1\n#@ orphan stack\n')).toThrow(TraceParseError);
    const withStack = '#GLTrace v1\n0.0\t~gl\t@G1\n#@ tf.m pc208 < tf.a pc608\n0.1\tglEnd\n';
    expect(parseTrace(withStack).records[0].stack).toBe('tf.m pc208 < tf.a pc608');
    expect(serializeTrace(parseTrace(withStack))).toBe(withStack);
});

// A GL whose names are not 1, 2, 3: out of order, reused after deletion, repeated, and a throwing generator.
class OddNamesGL extends NullGL {
    private readonly textureNames = [7, 3, 7, 11];
    private textureIndex = 0;
    throwNext = false;

    override glGenTextures(n: number, textures: Int32Array | null, textures_offset: number): void {
        if (textures === null) throw new TypeError('Null array');
        for (let i = 0; i < n; i++) textures[textures_offset + i] = this.textureNames[this.textureIndex++];
        if (this.throwNext) throw new GLException('driver fault');
    }

    override glGenBuffersARB(n: number, ids: Int32Array | null, ids_offset: number): void {
        if (ids === null) throw new TypeError('Null array');
        for (let i = 0; i < n; i++) ids[ids_offset + i] = 9173;
    }

    override glGenLists(range: number): number {
        return range === 0 ? 0 : 100;
    }
}

test('names are normalized per kind in allocation order, across reuse, repeats, ranges, unknown values and failed calls', () => {
    const w = new GlTraceWriter();
    const inner = new OddNamesGL(FALLBACK_CAPS_PROFILE);
    const gl = new RecordingGL(inner, w);
    const t = new Int32Array(2);
    gl.glGenTextures(2, t, 0); // 7, 3
    gl.glBindTexture(3553, 3);
    gl.glBindTexture(3553, 7);
    gl.glDeleteTextures(1, t, 0); // deletes 7 (#T1)
    gl.glBindTexture(3553, 7); // stale: still #T1
    gl.glGenTextures(1, t, 0); // 7 again: a new id
    gl.glBindTexture(3553, 7);
    gl.glBindTexture(3553, -2);
    gl.glBindTexture(3553, 0);
    inner.throwNext = true;
    expect(() => gl.glGenTextures(1, t, 1)).toThrow(GLException); // writes 11 then throws: not allocated
    gl.glBindTexture(3553, 11);
    const b = new Int32Array(1);
    gl.glGenBuffersARB(1, b, 0);
    gl.glGenBuffersARB(1, b, 0); // the same raw name twice: the latest allocation wins
    gl.glBindBufferARB(34962, 9173);
    const base = gl.glGenLists(3);
    gl.glNewList(base + 2, 4864);
    gl.glCallList(base + 1);
    gl.glCallList(103);
    expect(gl.glGenLists(0)).toBe(0);
    gl.glDeleteLists(base, 2);
    w.mark('end');
    const lines = w
        .text()
        .split('\n')
        .slice(1, -1)
        .map(l => l.split('\t').slice(1).join(' '));
    expect(lines).toEqual([
        '~gl @G1',
        'glGenTextures 2 iv:#T1,#T2 0',
        'glBindTexture 3553 #T2',
        'glBindTexture 3553 #T1',
        'glDeleteTextures 1 iv:#T1 0',
        'glBindTexture 3553 #T1',
        'glGenTextures 1 iv:#T3 0',
        'glBindTexture 3553 #T3',
        'glBindTexture 3553 #T?-2',
        'glBindTexture 3553 0',
        'glGenTextures 1 iv:#T?11 1 !> GLException',
        'glBindTexture 3553 #T?11',
        'glGenBuffersARB 1 iv:#B1 0',
        'glGenBuffersARB 1 iv:#B2 0',
        'glBindBufferARB 34962 #B2',
        'glGenLists 3 => #L1',
        'glNewList #L3 4864',
        'glCallList #L2',
        'glCallList #L?103',
        'glGenLists 0 => 0',
        'glDeleteLists #L1 2',
        '~mark end'
    ]);
    expect(w.live('T')).toEqual([2, 3]);
    expect(w.live('B')).toEqual([1, 2]);
    expect(w.live('L')).toEqual([3]);
    expect(liveSnapshots(parseTrace(w.text())).map(s => s.live)).toEqual([
        { T: [2, 3], B: [1, 2], L: [3], P: [] },
        { T: [2, 3], B: [1, 2], L: [3], P: [] }
    ]);
});

test('buffer tokens hash [position, limit) in storage order, with views, fixed counts and the 256-byte inline limit', () => {
    const tok = (buf: unknown, count: number | null = null) => formatValue(encodeBuffer(buf, count));
    const le = (floats: number[]) => {
        const d = new DataView(new ArrayBuffer(floats.length * 4));
        floats.forEach((f, i) => d.setFloat32(i * 4, f, true));
        return new Uint8Array(d.buffer);
    };
    const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');
    // Non-zero position and a limit below capacity.
    const heap = FloatBuffer.wrap(new Float32Array([0, 1, 2, 3, 4, 5]));
    heap.position(2).limit(5);
    expect(tok(heap)).toBe('B:float:2:5:6:heap:' + sha(le([2, 3, 4])) + ':' + hex(le([2, 3, 4])));
    // A view that starts at byte 4 of a direct ByteBuffer, then moved to element 1.
    const raw = ByteBuffer.allocateDirect(20).order(ByteOrder.LITTLE_ENDIAN);
    for (let i = 0; i < 5; i++) raw.putFloat(i * 4, i + 0.5);
    raw.position(4);
    const view = raw.asFloatBuffer();
    view.position(1);
    expect(tok(view)).toBe('B:float:1:4:4:direct:' + sha(le([2.5, 3.5, 4.5])) + ':' + hex(le([2.5, 3.5, 4.5])));
    // The same bytes through a BIG_ENDIAN view: the stored (big-endian) bytes are hashed.
    raw.order(ByteOrder.BIG_ENDIAN).position(0);
    const be = raw.asFloatBuffer();
    expect(tok(be)).toBe('B:float:0:5:5:direct:' + sha(le([0.5, 1.5, 2.5, 3.5, 4.5])) + ':' + hex(le([0.5, 1.5, 2.5, 3.5, 4.5])));
    const beStore = ByteBuffer.allocateDirect(4).order(ByteOrder.BIG_ENDIAN);
    beStore.asFloatBuffer().put(0, 1);
    expect(tok(beStore.asFloatBuffer())).toBe('B:float:0:1:1:direct:' + sha(hexBytes('3f800000')) + ':3f800000');
    // Read-only views hash like their source; a fixed count is clamped to the limit.
    const ro = view.asReadOnlyBuffer();
    expect(tok(ro)).toBe(tok(view));
    expect(tok(view, 2)).toBe('B:float:1:4:4:direct:' + sha(le([2.5, 3.5])) + ':' + hex(le([2.5, 3.5])));
    expect(tok(view, 99)).toBe(tok(view));
    expect(tok(view, -1)).toBe('B:float:1:4:4:direct:' + sha(new Uint8Array(0)) + ':');
    // Exactly 256 bytes are inlined, 257 are not.
    const b256 = ByteBuffer.allocate(256);
    const b257 = ByteBuffer.allocate(257);
    expect(tok(b256)).toBe('B:byte:0:256:256:heap:' + sha(new Uint8Array(256)) + ':' + '00'.repeat(256));
    expect(tok(b257)).toBe('B:byte:0:257:257:heap:' + sha(new Uint8Array(257)));
    // short and int kinds in native (little-endian) order
    expect(tok(ShortBuffer.wrap(new Int16Array([0x1234])))).toBe('B:short:0:1:1:heap:' + sha(hexBytes('3412')) + ':3412');
    expect(tok(IntBuffer.wrap(new Int32Array([0x12345678])))).toBe('B:int:0:1:1:heap:' + sha(hexBytes('78563412')) + ':78563412');
    expect(tok(null)).toBe('null');
    expect(tok(new Float32Array(1))).toBe('B?:Float32Array');
    // The recorder hashes at call time: later writes do not change an earlier record.
    const w = new GlTraceWriter();
    const gl = new RecordingGL(new NullGL(FALLBACK_CAPS_PROFILE), w);
    const data = ByteBuffer.allocateDirect(4).order(ByteOrder.nativeOrder());
    gl.glVertexPointer(1, 5121, 0, data);
    data.put(0, 9);
    gl.glVertexPointer(1, 5121, 0, data);
    const recs = parseTrace(w.text()).records;
    expect(formatValue(recs[1].args[3])).toBe('B:byte:0:4:4:direct:' + sha(new Uint8Array(4)) + ':00000000');
    expect(formatValue(recs[2].args[3])).toBe('B:byte:0:4:4:direct:' + sha(hexBytes('09000000')) + ':09000000');
});

test('string tokens hash the UTF-8 bytes and inline them escaped up to 256 bytes', () => {
    const tok = (v: unknown) => formatValue(encodeString(v));
    const utf8 = (text: string) => new TextEncoder().encode(text);
    const text = '50% x\té~';
    expect(tok(text)).toBe('S:9:' + sha(utf8(text)) + ':50%25%20x%09%C3%A9~');
    expect(unescapeText('50%25%20x%09%C3%A9~')).toEqual(utf8(text));
    expect(tok('a'.repeat(256))).toBe('S:256:' + sha('a'.repeat(256)) + ':' + 'a'.repeat(256));
    expect(tok('a'.repeat(255) + 'é')).toBe('S:257:' + sha(utf8('a'.repeat(255) + 'é')));
    expect(tok('')).toBe('S:0:' + sha('') + ':');
    expect(tok(null)).toBe('null');
    expect(tok(7)).toBe('S?:7');
    expect(parseValue(tok(text))).toEqual({ t: 'string', len: 9, sha: sha(utf8(text)), text: '50%25%20x%09%C3%A9~' });
});

const s = (text: string) => 'S:' + text.length + ':' + sha(text) + ':' + text.replace(/[^\x21-\x24\x26-\x7e]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'));

test('RecordingGL over NullGL end to end: tf.a(Canvas,I)I context creation, a GLU-style nested call, a frame and tf.o()V teardown', () => {
    const w = new GlTraceWriter();
    registerGLDrawableFactory(() => new RecordingGLDrawableFactory(new NullGLDrawableFactory(FALLBACK_CAPS_PROFILE), w));
    try {
        const canvas = {};
        // tf.a(Ljava/awt/Canvas;I)I with n = 2
        const caps = new GLCapabilities();
        caps.setSampleBuffers(true);
        caps.setNumSamples(2);
        const factory = GLDrawableFactory.getFactory();
        if (factory === null) throw new Error('no factory');
        const drawable = factory.getGLDrawable(canvas, caps, null);
        drawable.setRealized(true);
        const context = drawable.createContext(null);
        expect(context.makeCurrent()).toBe(GLContext.CONTEXT_CURRENT_NEW);
        expect(GLContext.getCurrent()).toBe(context);
        const gl = context.getGL();
        expect(context.getGL()).toBe(gl);
        // GLU.getCurrentGL(): GLContext.getCurrent().getGL() reaches the same recording GL
        const current = GLContext.getCurrent();
        if (current === null) throw new Error('no current context');
        const glu = current.getGL();
        expect(glu).toBe(gl);
        const align = new Int32Array(1);
        glu.glGetIntegerv(3317, align, 0);
        expect(align[0]).toBe(4);
        expect(gl.glGetString(7938)).toBe('2.1.2 RS530 Virtual GL');
        const tex = new Int32Array(1);
        gl.glGenTextures(1, tex, 0);
        gl.glBindTexture(3553, tex[0]);
        gl.glTexImage2D(3553, 0, 6408, 1, 1, 0, 6408, 5121, IntBuffer.wrap(new Int32Array([-1])));
        gl.glClear(16384);
        drawable.swapBuffers();
        gl.glClear(16384);
        expect(context.makeCurrent()).toBe(GLContext.CONTEXT_CURRENT);
        // tf.o()V
        if (GLContext.getCurrent() === context) context.release();
        expect(GLContext.getCurrent()).toBe(null);
        context.destroy();
        drawable.setRealized(false);
        expect(context.makeCurrent()).toBe(GLContext.CONTEXT_NOT_CURRENT);
    } finally {
        registerGLDrawableFactory(null);
    }
    expect(w.text()).toBe(
        [
            '#GLTrace v1',
            '0.0\tGLDrawableFactory.getGLDrawable\t@F1\t@O1\tK:T:F:T:24:0:8:8:8:0:0:0:0:0:T:2\tnull\t=> @D1',
            '0.1\tGLDrawable.setRealized\t@D1\tT',
            '0.2\tGLDrawable.createContext\t@D1\tnull\t=> @C1',
            '0.3\tGLContext.makeCurrent\t@C1\t=> 2',
            '0.4\tGLContext.getGL\t@C1\t=> @G1',
            '0.5\tGLContext.getGL\t@C1\t=> @G1',
            '0.6\tGLContext.getGL\t@C1\t=> @G1',
            '0.7\t~gl\t@G1',
            '0.8\tglGetIntegerv\t3317\tiv:4\t0',
            '0.9\tglGetString\t7938\t=> ' + s('2.1.2 RS530 Virtual GL'),
            '0.10\tglGenTextures\t1\tiv:#T1\t0',
            '0.11\tglBindTexture\t3553\t#T1',
            '0.12\tglTexImage2D\t3553\t0\t6408\t1\t1\t0\t6408\t5121\tB:int:0:1:1:heap:' + sha(hexBytes('ffffffff')) + ':ffffffff',
            '0.13\tglClear\t16384',
            '0.14\tGLDrawable.swapBuffers\t@D1',
            '1.0\tglClear\t16384',
            '1.1\tGLContext.makeCurrent\t@C1\t=> 1',
            '1.2\tGLContext.release\t@C1',
            '1.3\tGLContext.destroy\t@C1',
            '1.4\tGLDrawable.setRealized\t@D1\tF',
            '1.5\tGLContext.makeCurrent\t@C1\t=> 0',
            ''
        ].join('\n')
    );
});

test('a second context made current releases the first internally: no record for the inner release, getCurrent is the wrapper', () => {
    const w = new GlTraceWriter();
    const factory = new RecordingGLDrawableFactory(new NullGLDrawableFactory(FALLBACK_CAPS_PROFILE), w);
    const d = factory.getGLDrawable({}, null, null);
    d.setRealized(true);
    const a = d.createContext(null);
    const b = d.createContext(a);
    a.makeCurrent();
    b.makeCurrent();
    expect(GLContext.getCurrent()).toBe(b);
    expect(b).toBeInstanceOf(RecordingGLContext);
    a.makeCurrent();
    expect(GLContext.getCurrent()).toBe(a);
    a.release();
    expect(
        w
            .text()
            .split('\n')
            .slice(1, -1)
            .map(l => l.split('\t').slice(1).join(' '))
    ).toEqual([
        'GLDrawableFactory.getGLDrawable @F1 @O1 null null => @D1',
        'GLDrawable.setRealized @D1 T',
        'GLDrawable.createContext @D1 null => @C1',
        'GLDrawable.createContext @D1 @C1 => @C2',
        'GLContext.makeCurrent @C1 => 2',
        'GLContext.makeCurrent @C2 => 2',
        'GLContext.makeCurrent @C1 => 1',
        'GLContext.release @C1'
    ]);
    expect(GLContext.getCurrent()).toBe(null);
});

test('recording never changes behaviour: results, throws and a Java Error pass through; the ~gl marker follows the receiver', () => {
    const w = new GlTraceWriter();
    const nullA = new NullGL(FALLBACK_CAPS_PROFILE);
    const a = new RecordingGL(nullA, w);
    const b = new RecordingGL(new NullGL(FALLBACK_CAPS_PROFILE), w);
    expect(a.isExtensionAvailable('GL_EXT_texture3D')).toBe(true);
    expect('glGetError' in a).toBe(false); // not part of the shipped interface
    expect(nullA.glGetError()).toBe(0);
    const fault = new JavaError('fault');
    const faulty = new RecordingGL(
        {
            ...nullA,
            glEnable: () => {
                throw fault;
            }
        } as unknown as GL,
        w
    );
    expect(() => faulty.glEnable(2929)).toThrow(fault);
    b.glEnable(1);
    b.glDeleteTextures(1, new Int32Array([5]), 0);
    a.glEnable(2);
    expect(() => a.glGenTextures(1, new Int32Array(1), 5)).toThrow(RangeError);
    expect(() => a.glLightfv(16384, 4611, new Float32Array(4), 4)).toThrow(GLException);
    expect(() => a.glDrawPixels(1, 1, 6408, 5121, IntBuffer.allocate(1))).not.toThrow();
    expect(
        w
            .text()
            .split('\n')
            .slice(1, -1)
            .map(l => l.split('\t').slice(1).join(' '))
    ).toEqual([
        '~gl @G1',
        'isExtensionAvailable ' + s('GL_EXT_texture3D') + ' => T',
        '~gl @G2',
        'glEnable 2929 !> Error',
        '~gl @G3',
        'glEnable 1',
        'glDeleteTextures 1 iv:#T?5 0',
        '~gl @G1',
        'glEnable 2',
        'glGenTextures 1 iv:!1 5 !> RuntimeException',
        'glLightfv 16384 4611 fv:!4 4 !> GLException',
        'glDrawPixels 1 1 6408 5121 B:int:0:1:1:heap:' + sha(new Uint8Array(4)) + ':00000000'
    ]);
});

test('the ~gl marker is decided when a call starts: a reentrant call reads ~gl @G1, ~gl @G2, inner, outer (section 10)', () => {
    // A responder whose glEnable makes a recorded call on another GL.
    class ReentrantGL extends NullGL {
        other: GL | null = null;
        override glEnable(cap: number): void {
            const other = this.other;
            if (other === null) throw new TypeError('Null reference');
            other.glDisable(cap);
        }
    }
    const w = new GlTraceWriter();
    const inner = new ReentrantGL(FALLBACK_CAPS_PROFILE);
    const g1 = new RecordingGL(inner, w);
    const g2 = new RecordingGL(new NullGL(FALLBACK_CAPS_PROFILE), w);
    inner.other = g2;
    g1.glEnable(2929);
    g1.glDisable(1);
    expect(w.text().split('\n').slice(1, -1)).toEqual([
        '0.0\t~gl\t@G1',
        '0.1\t~gl\t@G2',
        '0.2\tglDisable\t2929',
        '0.3\tglEnable\t2929', // no marker: the remembered receiver was @G1 when this call started
        '0.4\t~gl\t@G1', // the inner call left @G2 remembered
        '0.5\tglDisable\t1'
    ]);
});

test('an int or byte -0 is written as 0, as Java holds it; a float -0 stays f:80000000 (section 14)', () => {
    const w = new GlTraceWriter();
    const gl = new RecordingGL(new NullGL(FALLBACK_CAPS_PROFILE), w);
    const zero = -4 % 2; // -0 in JS, 0 in Java
    expect(Object.is(zero, -0)).toBe(true);
    const iv = new Int32Array(1);
    gl.glEnable(zero);
    gl.glColor3ub(zero, 0, -0);
    gl.glBindTexture(3553, zero);
    gl.glGetIntegerv(34018, iv, zero);
    gl.glDeleteLists(zero, -0);
    gl.glColor4f(0, 0, zero, 1);
    gl.glEnable(0.5);
    expect(w.text().split('\n').slice(1, -1)).toEqual([
        '0.0\t~gl\t@G1',
        '0.1\tglEnable\t0',
        '0.2\tglColor3ub\t0\t0\t0',
        '0.3\tglBindTexture\t3553\t0',
        '0.4\tglGetIntegerv\t34018\tiv:4\t0',
        '0.d0\tglDeleteLists\t0\t0',
        '0.5\tglColor4f\tf:00000000\tf:00000000\tf:80000000\tf:3f800000',
        '0.6\tglEnable\ti?:0.5'
    ]);
});

test('NullGL answers from the profile, allocates names, applies the proxy rule and the GLImpl array and availability checks', () => {
    const gl = new NullGL(FALLBACK_CAPS_PROFILE);
    const ids = new Int32Array(4);
    gl.glGenTextures(3, ids, 1);
    expect([...ids]).toEqual([0, 1, 2, 3]);
    gl.glGenBuffersARB(2, ids, 0);
    expect([...ids.subarray(0, 2)]).toEqual([1, 2]);
    gl.glGenProgramsARB(1, ids, 0);
    expect(ids[0]).toBe(1);
    expect(gl.glGenLists(2)).toBe(1);
    expect(gl.glGenLists(1)).toBe(3);
    expect(gl.glGenLists(0)).toBe(0);
    expect(gl.glGenLists(-1)).toBe(0);
    gl.glDeleteTextures(3, new Int32Array([1, 2, 3]), 0);
    gl.glGenTextures(1, ids, 0);
    expect(ids[0]).toBe(4); // never reused
    expect(gl.glGetString(7936)).toBe('RS530 Virtual GL');
    expect(gl.glGetString(7939)).toBe(FALLBACK_CAPS_PROFILE.strings['7939']);
    expect(gl.glGetString(1)).toBe(null);
    for (const name of [
        'GL_ARB_multitexture',
        'GL_ARB_texture_env_combine',
        'GL_ARB_vertex_buffer_object',
        'GL_ARB_multisample',
        'GL_ARB_texture_cube_map',
        'GL_ARB_vertex_program',
        'GL_EXT_texture3D',
        'GL_ARB_point_parameters',
        'GL_ARB_point_sprite',
        'GL_VERSION_1_5',
        'GL_VERSION_2_1'
    ]) {
        expect(gl.isExtensionAvailable(name)).toBe(true);
    }
    for (const name of ['GL_VERSION_2_2', 'GL_ARB_pixel_buffer_object', 'GL_ARB', '', null]) expect(gl.isExtensionAvailable(name)).toBe(false);
    const iv = new Int32Array(3).fill(-7);
    gl.glGetIntegerv(34018, iv, 0);
    gl.glGetIntegerv(34929, iv, 1);
    gl.glGetIntegerv(12345, iv, 2);
    expect([...iv]).toEqual([4, 8, -7]);
    const fv = new Float32Array(5);
    gl.glGetFloatv(2899, fv, 1);
    expect([...fv]).toEqual([0, Math.fround(0.2), Math.fround(0.2), Math.fround(0.2), 1]);
    const fb = FloatBuffer.allocate(3);
    fb.position(1);
    gl.glGetFloatv(33063, fb);
    expect(fb.position()).toBe(1);
    expect(fb.get(1)).toBe(2047);
    // proxy rule
    const q = new Int32Array(1);
    const query = (target: number, level: number, pname = 4096) => {
        gl.glGetTexLevelParameteriv(target, level, pname, q, 0);
        return q[0];
    };
    expect(query(32868, 1)).toBe(0);
    gl.glTexImage2D(32868, 1, 4, 64, 32, 0, 6408, 5121, null);
    expect([query(32868, 1, 4096), query(32868, 1, 4097), query(32868, 1, 32881), query(32868, 1, 4099), query(32868, 0)]).toEqual([64, 32, 1, 0, 0]);
    gl.glTexImage2D(32868, 1, 4, 8192, 32, 0, 6408, 5121, null);
    expect(query(32868, 1)).toBe(0);
    gl.glTexImage2D(32868, 0, 4, 8192, 8192, 0, 6408, 5121, null);
    expect(query(32868, 0)).toBe(8192);
    gl.glTexImage2D(32868, 0, 4, 64, 64, 1, 6408, 5121, null);
    expect(query(32868, 0)).toBe(0);
    gl.glTexImage1D(32867, 2, 4, 2048, 0, 6408, 5121, null);
    expect([query(32867, 2, 4096), query(32867, 2, 4097)]).toEqual([2048, 1]);
    gl.glTexImage2D(34075, 0, 4, 64, 32, 0, 6408, 5121, null);
    expect(query(34075, 0)).toBe(0);
    gl.glTexImage3D(32880, 0, 4, 4, 4, 9000, 0, 6408, 5121, null);
    expect(query(32880, 0)).toBe(0);
    gl.glTexImage2D(3553, 0, 4, 64, 64, 0, 6408, 5121, null);
    expect(query(3553, 0)).toBe(0);
    // GLImpl checks, in GLImpl's order
    expect(() => gl.glGenTextures(2, new Int32Array(2), 1)).toThrow(new RangeError('Required 2 elements in array, only had 1'));
    expect(() => gl.glGenTextures(0, new Int32Array(2), 2)).toThrow(new GLException('array offset argument "textures_offset" (2) equals or exceeds array length (2)'));
    expect(() => gl.glDeleteBuffersARB(0, new Int32Array(1), 1)).toThrow(new GLException('array offset argument "ids_offset" (1) equals or exceeds array length (1)'));
    expect(() => gl.glColor4fv(new Float32Array(4), 4)).toThrow(new GLException('array offset argument "v_offset" (4) equals or exceeds array length (4)'));
    expect(() => gl.glLoadMatrixf(new Float32Array(16), 16)).toThrow(new GLException('array offset argument "m_offset" (16) equals or exceeds array length (16)'));
    expect(() => gl.glGetIntegerv(3317, new Int32Array(1), 1)).toThrow(new GLException('array offset argument "params_offset" (1) equals or exceeds array length (1)'));
    expect(() => gl.glGenTextures(1, null, 0)).toThrow(TypeError);
    const limited: CapsProfile = { ...FALLBACK_CAPS_PROFILE, name: 'no-vbo', missingEntryPoints: ['glGenBuffersARB', 'glActiveTexture', 'glProgramLocalParameter4fvARB'] };
    const old = new NullGL(limited);
    expect(() => old.glGenBuffersARB(1, new Int32Array(1), 0)).toThrow(new GLException('Method "glGenBuffersARB" not available'));
    expect(() => old.glGenBuffersARB(1, new Int32Array(1), 1)).toThrow(RangeError); // the array check comes first
    expect(() => old.glActiveTexture(33984)).toThrow(new GLException('Method "glActiveTexture" not available'));
    expect(() => old.glProgramLocalParameter4fvARB(34336, 0, FloatBuffer.allocate(4))).toThrow(GLException);
    expect(() => old.glProgramLocalParameter4fvARB(34336, 0, new Float32Array(4), 4)).toThrow(new GLException('array offset argument "params_offset" (4) equals or exceeds array length (4)'));
    expect(() => old.glBindBufferARB(34962, 0)).not.toThrow();
});

test('capability profiles: validation, JSON round trip and JOGL version names', () => {
    validateCapsProfile(FALLBACK_CAPS_PROFILE);
    const json = capsProfileToJson(FALLBACK_CAPS_PROFILE);
    expect(capsProfileFromJson(json)).toEqual(FALLBACK_CAPS_PROFILE);
    expect(JSON.parse(json).strings['7938']).toBe('2.1.2 RS530 Virtual GL');
    expect(joglVersionExtensions('2.1.2 RS530 Virtual GL')).toEqual(['GL_VERSION_2_1', 'GL_VERSION_2_0', 'GL_VERSION_1_5', 'GL_VERSION_1_4', 'GL_VERSION_1_3', 'GL_VERSION_1_2', 'GL_VERSION_1_1', 'GL_VERSION_1_0']);
    // JOGL's quirks: 3.x skips 2.x; the second space token can raise the version.
    expect(joglVersionExtensions('3.0.0')).toEqual(['GL_VERSION_3_0', 'GL_VERSION_1_5', 'GL_VERSION_1_4', 'GL_VERSION_1_3', 'GL_VERSION_1_2', 'GL_VERSION_1_1', 'GL_VERSION_1_0']);
    expect(joglVersion('1.5.0 2.1.0')).toEqual({ major: 2, minor: 1 });
    expect(joglVersion('1.5.0 1.4.0')).toEqual({ major: 1, minor: 5 });
    expect(() => joglVersion('2.1 RS530')).toThrow('IllegalArgumentException');
    expect(profileHasExtension(FALLBACK_CAPS_PROFILE, 'GL_ARB_multisample')).toBe(true);
    const broken = (patch: Partial<CapsProfile>) => () => validateCapsProfile({ ...FALLBACK_CAPS_PROFILE, ...patch });
    expect(broken({ strings: { '7936': 'x', '7937': 'y', '7938': '2.1' } })).toThrow('strings.7939');
    expect(broken({ floats: { '1': ['3F800000'] } })).toThrow('floats.1');
    expect(broken({ integers: { '1': [1.5] } })).toThrow('integers.1');
    expect(broken({ missingEntryPoints: ['glNope'] })).toThrow('missingEntryPoints.glNope');
    // A core method is a direct native call in GLImpl and can never be missing (section 16 item 3).
    expect(broken({ missingEntryPoints: ['glBindTexture'] })).toThrow('missingEntryPoints.glBindTexture');
    expect(broken({ missingEntryPoints: [...DYNAMIC_ENTRY_POINTS] })).not.toThrow();
    expect(broken({ strings: { ...FALLBACK_CAPS_PROFILE.strings, '7938': '2.1 x' } })).toThrow('IllegalArgumentException');
    expect(() => new NullGL({ ...FALLBACK_CAPS_PROFILE, name: 'bad name' })).toThrow('name');

    // The JSON writer formats structurally: string values with brackets, commas and repeated spaces survive.
    const odd: CapsProfile = {
        ...FALLBACK_CAPS_PROFILE,
        name: 'odd',
        missingEntryPoints: ['glTexImage3D', 'glActiveTexture'],
        floats: {},
        strings: { ...FALLBACK_CAPS_PROFILE.strings, '7936': '[ a,  b ]', '7937': 'Vendor GPU [ rev 2,  x ]', '1': '[]', '2': '"q" \\ {x}' }
    };
    const oddJson = capsProfileToJson(odd);
    expect(capsProfileFromJson(oddJson)).toEqual(odd);
    expect(oddJson).toContain('\n    "7937": "Vendor GPU [ rev 2,  x ]",\n');
    expect(oddJson).toContain('\n  "floats": {},\n  "missingEntryPoints": ["glTexImage3D", "glActiveTexture"]\n}\n');

    // The Radeon profile is the fallback with a Radeon renderer and its own name.
    validateCapsProfile(RADEON_CAPS_PROFILE);
    expect(capsProfileFromJson(capsProfileToJson(RADEON_CAPS_PROFILE))).toEqual(RADEON_CAPS_PROFILE);
    expect(RADEON_CAPS_PROFILE.strings['7937']).toBe('RS530 Virtual Radeon');
    const unRadeon: CapsProfile = {
        ...RADEON_CAPS_PROFILE,
        name: FALLBACK_CAPS_PROFILE.name,
        strings: { ...RADEON_CAPS_PROFILE.strings, '7937': FALLBACK_CAPS_PROFILE.strings['7937'] }
    };
    expect(unRadeon).toEqual(FALLBACK_CAPS_PROFILE);

    // Extension tokens as JOGL's FunctionAvailabilityCache reads them: StringTokenizer's default delimiters
    // " \t\n\r\f" (not U+000B), then String.trim() of each token (checked against java.util.StringTokenizer).
    const tokens: CapsProfile = { ...FALLBACK_CAPS_PROFILE, strings: { ...FALLBACK_CAPS_PROFILE.strings, '7939': 'GL_A\tGL_B\nGL_C\r\fGL_D\u000bGL_E \u0001GL_F\u0001  \u0002 ' } };
    for (const [name, has] of [
        ['GL_A', true],
        ['GL_B', true],
        ['GL_C', true],
        ['GL_D\u000bGL_E', true],
        ['GL_D', false],
        ['GL_E', false],
        ['GL_F', true],
        ['\u0001GL_F\u0001', false],
        ['', true],
        ['GL_VERSION_2_1', true]
    ] as const) {
        expect(profileHasExtension(tokens, name)).toBe(has);
    }
});

test("the 16 entry points a profile may list are exactly GLImpl's looked-up ones, NullGL's and GlRecorder.java's", () => {
    expect(DYNAMIC_ENTRY_POINTS.size).toBe(16);
    for (const name of DYNAMIC_ENTRY_POINTS) expect(glMethods.some(([m]) => m === name)).toBe(true);
    const javap = Bun.spawnSync(['javap', '-c', '-p', '-classpath', joglPath, 'com.sun.opengl.impl.GLImpl']);
    expect(javap.exitCode, javap.stderr.toString()).toBe(0);
    const shipped = new Set([...javap.stdout.toString().matchAll(/String Method \\"(\w+)\\" not available/g)].map(m => m[1]));
    expect(shipped).toEqual(new Set(DYNAMIC_ENTRY_POINTS));
    const nullGL = readFileSync(join(import.meta.dir, '../../src/gl/NullGL.ts'), 'utf8');
    expect(new Set([...nullGL.matchAll(/this\.checkAvailable\('(\w+)'\)/g)].map(m => m[1]))).toEqual(new Set(DYNAMIC_ENTRY_POINTS));
    expect([...nullGL.matchAll(/this\.checkAvailable\('/g)].length).toBe(16);
    const recorder = readFileSync(join(import.meta.dir, 'GlRecorder.java'), 'utf8');
    const dynamic = /Set<String> DYNAMIC = Set\.of\(([^)]*)\)/.exec(recorder);
    expect(dynamic === null ? null : new Set([...dynamic[1].matchAll(/"(\w+)"/g)].map(m => m[1]))).toEqual(new Set(DYNAMIC_ENTRY_POINTS));
}, 30000);

// tf.m()I of runescape_gl.jar run by the real jar against a GL proxy answering from a profile. The proxy writes the
// GLTrace records itself (a small, independent Java implementation of GLTRACE.md sections 3-5, 6, 8, 9 and 10 for
// the entries tf.m uses) and the statics tf.m sets.
const TF_PROBE_JAVA = String.raw`
import java.io.*;
import java.lang.reflect.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import javax.media.opengl.GL;

public class TfProbeOracle {
    static final Map<Integer, String> strings = new HashMap<>();
    static final Map<Integer, int[]> ints = new HashMap<>();
    static final Set<String> extensions = new HashSet<>();
    static final List<String> trace = new ArrayList<>();
    static int seq, buffers;
    static final Map<Integer, Integer> bufferIds = new HashMap<>();

    static String sha(byte[] b) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(b));
    }
    static String str(String v) throws Exception {
        if (v == null) return "null";
        byte[] b = v.getBytes(StandardCharsets.UTF_8);
        StringBuilder t = new StringBuilder();
        for (byte x : b) {
            int u = x & 0xff;
            if (u >= 0x21 && u <= 0x7e && u != 0x25) t.append((char)u); else t.append('%').append(String.format("%02X", u));
        }
        return "S:" + b.length + ":" + sha(b) + (b.length <= 256 ? ":" + t : "");
    }
    static void add(String line) { trace.add("0." + (seq++) + "\t" + line); }

    public static void main(String[] args) throws Exception {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.UTF_8));
        for (String line; (line = in.readLine()) != null;) {
            String[] f = line.split("\t");
            switch (f[0]) {
                case "S" -> strings.put(Integer.parseInt(f[1]), f[2]);
                case "I" -> { int[] v = new int[f.length - 2]; for (int i = 2; i < f.length; i++) v[i - 2] = Integer.parseInt(f[i]); ints.put(Integer.parseInt(f[1]), v); }
                case "E" -> extensions.add(f[1]);
                default -> throw new AssertionError(line);
            }
        }
        final boolean[] first = {true};
        GL gl = (GL)Proxy.newProxyInstance(GL.class.getClassLoader(), new Class<?>[]{GL.class}, (proxy, m, a) -> {
            if (first[0]) { add("~gl\t@G1"); first[0] = false; }
            switch (m.getName()) {
                case "glGetString" -> { String v = strings.get((Integer)a[0]); add("glGetString\t" + a[0] + "\t=> " + str(v)); return v; }
                case "isExtensionAvailable" -> { boolean v = extensions.contains((String)a[0]); add("isExtensionAvailable\t" + str((String)a[0]) + "\t=> " + (v ? "T" : "F")); return v; }
                case "glGetIntegerv" -> {
                    int[] arr = (int[])a[1]; int off = (Integer)a[2]; int[] v = ints.get((Integer)a[0]);
                    if (v != null) System.arraycopy(v, 0, arr, off, v.length);
                    add("glGetIntegerv\t" + a[0] + "\tiv:" + arr[off] + "\t" + off); return null;
                }
                case "glGenBuffersARB" -> {
                    int n = (Integer)a[0]; int[] arr = (int[])a[1]; int off = (Integer)a[2];
                    StringJoiner j = new StringJoiner(",");
                    for (int i = 0; i < n; i++) { arr[off + i] = 500 + i; bufferIds.put(arr[off + i], ++buffers); j.add("#B" + buffers); }
                    add("glGenBuffersARB\t" + n + "\tiv:" + j + "\t" + off); return null;
                }
                default -> throw new AssertionError("unexpected GL call " + m);
            }
        });
        Field t = tf.class.getDeclaredField("t");
        t.setAccessible(true);
        t.set(null, gl);
        Method probe = tf.class.getDeclaredMethod("m");
        probe.setAccessible(true);
        int result = (Integer)probe.invoke(null);
        StringJoiner statics = new StringJoiner(" ");
        for (String name : new String[]{"B", "e", "D", "v", "C", "y", "K", "H", "r", "G", "f"}) {
            Field field = tf.class.getDeclaredField(name);
            field.setAccessible(true);
            statics.add(name + "=" + field.get(null));
        }
        System.out.println("result=" + result + " " + statics);
        for (String line : trace) System.out.println(line);
    }
}
`;

// The GL calls of tf.m()I (cfr/tf.java:319-412), issued by the same decisions. The Radeon block (cfr/tf.java:373-388)
// makes no GL call. It can only clear tf.C, for a 7000-7999 model number read from a four-digit token, which drops
// the probe glGenBuffersARB. The profiles probed here have no four-digit run in RENDERER, so tf.C is the VBO
// extension alone.
function tfProbeCalls(gl: GL): number {
    let n = 0;
    const vendor = gl.glGetString(7936) ?? '';
    const renderer = gl.glGetString(7937) ?? '';
    const lower = vendor.toLowerCase();
    if (lower.includes('microsoft')) n |= 1;
    if (lower.includes('brian paul') || lower.includes('mesa')) n |= 1;
    const parts = (gl.glGetString(7938) ?? '').split(/[. ]/);
    let version = 0;
    if (parts.length >= 2 && /^[+-]?[0-9]+$/.test(parts[0]) && /^[+-]?[0-9]+$/.test(parts[1])) version = Number(parts[0]) * 10 + Number(parts[1]);
    else n |= 4;
    if (version < 12) n |= 2;
    if (!gl.isExtensionAvailable('GL_ARB_multitexture')) n |= 8;
    if (!gl.isExtensionAvailable('GL_ARB_texture_env_combine')) n |= 0x20;
    const a = new Int32Array(1);
    gl.glGetIntegerv(34018, a, 0);
    const e = a[0];
    gl.glGetIntegerv(34929, a, 0);
    const d = a[0];
    gl.glGetIntegerv(34930, a, 0);
    const v = a[0];
    if (e < 2 || d < 2 || v < 2) n |= 0x10;
    if (n !== 0) return n;
    const vbo = gl.isExtensionAvailable('GL_ARB_vertex_buffer_object');
    gl.isExtensionAvailable('GL_ARB_multisample');
    gl.isExtensionAvailable('GL_ARB_texture_cube_map');
    gl.isExtensionAvailable('GL_ARB_vertex_program');
    gl.isExtensionAvailable('GL_EXT_texture3D');
    expect(/[0-9]{4}/.test(renderer)).toBe(false);
    if (vbo) gl.glGenBuffersARB(1, new Int32Array(1), 0);
    return 0;
}

// The fallback leaves tf.G false. The Radeon profile is the only one that sets it (td pc1955: the STREAM_DRAW vi and
// the jar's only glBufferSubDataARB), with every other static as the fallback's.
const TF_PROBES: readonly (readonly [CapsProfile, string])[] = [
    [FALLBACK_CAPS_PROFILE, 'result=0 B=21 e=4 D=8 v=16 C=true y=true K=true H=true r=true G=false f=false'],
    [RADEON_CAPS_PROFILE, 'result=0 B=21 e=4 D=8 v=16 C=true y=true K=true H=true r=true G=true f=false']
];
for (const [p, expected] of TF_PROBES)
    test(
        'profile ' + p.name + ' passes the real tf.m()I with the expected statics; its GL calls match RecordingGL record for record',
        () => {
            const dir = mkdtempSync(join(tmpdir(), 'rs530-gltrace-'));
            try {
                writeFileSync(join(dir, 'TfProbeOracle.java'), TF_PROBE_JAVA);
                const cp = hdGamepackPath + delimiter + joglPath;
                const compiled = Bun.spawnSync(['javac', '-cp', cp, '-d', dir, join(dir, 'TfProbeOracle.java')]);
                expect(compiled.exitCode, compiled.stderr.toString()).toBe(0);
                const input: string[] = [];
                for (const [k, v] of Object.entries(p.strings)) input.push('S\t' + k + '\t' + v);
                for (const [k, v] of Object.entries(p.integers)) input.push('I\t' + k + '\t' + v.join('\t'));
                for (const name of [...p.strings['7939'].split(' '), ...joglVersionExtensions(p.strings['7938'])]) input.push('E\t' + name);
                const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + cp, 'TfProbeOracle'], { stdin: Buffer.from(input.join('\n') + '\n') });
                expect(java.exitCode, java.stderr.toString()).toBe(0);
                const [status, ...javaTrace] = java.stdout.toString().trimEnd().split(/\r?\n/);
                expect(status).toBe(expected);

                const w = new GlTraceWriter();
                expect(tfProbeCalls(new RecordingGL(new NullGL(p), w))).toBe(0);
                expect(w.text().split('\n').slice(1, -1)).toEqual(javaTrace);
                expect(javaTrace.length).toBe(15); // ~gl, 3 glGetString, 7 isExtensionAvailable, 3 glGetIntegerv, glGenBuffersARB
            } finally {
                rmSync(dir, { recursive: true, force: true });
            }
        },
        60000
    );

// An independent Java implementation of GLTrace v1 written from GLTRACE.md: it reads the entry table, the count
// tables and the fallback profile from the markdown, implements the section 16 responder, and replays goldenScript
// (Appendix A, which has no TS-only slips) with a Proxy GL, real java.nio buffers and the shipped JOGL classes. Its
// "strings" mode encodes arbitrary UTF-16 strings by section 8.
const GLTRACE_REFERENCE_JAVA = String.raw`import java.lang.reflect.*;
import java.nio.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.Callable;
import java.util.regex.*;
import javax.media.opengl.*;

// An independent Java implementation of GLTrace v1, written from src/gl/GLTRACE.md: it reads the entry table
// (section 12), the count tables (section 13) and the fallback profile (Appendix B) from the markdown, implements the
// responder of section 16, replays goldenScript of gl-trace.test.ts with real java.nio buffers and prints the trace.
public class GlTraceReference {
    static final String TICK = String.valueOf((char)96); // the markdown code-span delimiter
    record Role(String r, char kind, String count) {}
    record Rule(String entry, String desc, Role receiver, List<Role> params, Role ret, boolean deletion, boolean endsFrame) {}

    static final Map<String, Rule> rules = new HashMap<>();
    static final Map<String, Map<Integer, Integer>> tables = new HashMap<>();
    static String profileName;
    static final Map<Integer, String> strings = new HashMap<>();
    static final Map<Integer, int[]> integers = new HashMap<>();
    static final Map<Integer, int[]> floats = new HashMap<>();

    static String section(String md, String name) {
        int a = md.indexOf("<!-- " + name + ":begin -->\n");
        int b = md.indexOf("<!-- " + name + ":end -->");
        return md.substring(a + ("<!-- " + name + ":begin -->\n").length(), b);
    }

    static Role role(String s) {
        Matcher m;
        if ((m = Pattern.compile("^(name|ref):([A-Z])$").matcher(s)).matches()) return new Role(m.group(1), m.group(2).charAt(0), null);
        if ((m = Pattern.compile("^(in-names|out-names):([A-Z])\\[(.+)\\]$").matcher(s)).matches()) return new Role(m.group(1), m.group(2).charAt(0), m.group(3));
        if ((m = Pattern.compile("^(buf|out-buf|in-f|out-f|out-i|alloc-lists)\\[(.+)\\]$").matcher(s)).matches()) return new Role(m.group(1).equals("buf") ? "buf-n" : m.group(1), ' ', m.group(2));
        return new Role(s, ' ', null);
    }

    static void load(Path mdPath) throws Exception {
        String md = Files.readString(mdPath).replace("\r\n", "\n");
        for (String line : section(md, "entry-table").split("\n")) {
            if (!line.startsWith("| " + TICK)) continue;
            String[] c = line.substring(1, line.length() - 1).split("\\|", -1);
            Arrays.setAll(c, i -> c[i].trim());
            String entry = c[0].replace(TICK, ""), desc = c[1].replace(TICK, "");
            Role receiver = c[2].equals("-") ? null : role(c[2].replace(TICK, ""));
            List<Role> params = new ArrayList<>();
            if (!c[3].equals("-")) for (String p : c[3].split(" ")) params.add(role(p.replace(TICK, "")));
            String flag = c[5].replace(TICK, "");
            rules.put(entry + desc, new Rule(entry, desc, receiver, params, role(c[4].replace(TICK, "")), flag.equals("deletion"), flag.equals("ends-frame")));
        }
        for (String line : section(md, "count-tables").split("\n")) {
            if (!line.startsWith("| " + TICK)) continue;
            String[] c = line.substring(1, line.length() - 1).split("\\|", -1);
            Arrays.setAll(c, i -> c[i].trim());
            tables.computeIfAbsent(c[0].replace(TICK, ""), k -> new HashMap<>()).put(Integer.parseInt(c[1].split(" ")[0]), Integer.parseInt(c[2]));
        }
        String json = section(md, "profile");
        Matcher n = Pattern.compile("\"name\": \"([^\"]*)\"").matcher(json);
        if (!n.find()) throw new AssertionError("Appendix B has no profile name");
        profileName = n.group(1);
        Matcher s = Pattern.compile("\"(\\d+)\": \"([^\"]*)\"").matcher(block(json, "strings"));
        while (s.find()) strings.put(Integer.parseInt(s.group(1)), s.group(2));
        Matcher i = Pattern.compile("\"(\\d+)\": \\[([^\\]]*)\\]").matcher(block(json, "integers"));
        while (i.find()) integers.put(Integer.parseInt(i.group(1)), Arrays.stream(i.group(2).split(", ")).mapToInt(Integer::parseInt).toArray());
        Matcher f = Pattern.compile("\"(\\d+)\": \\[([^\\]]*)\\]").matcher(block(json, "floats"));
        while (f.find()) floats.put(Integer.parseInt(f.group(1)), Arrays.stream(f.group(2).split(", ")).mapToInt(x -> Integer.parseUnsignedInt(x.replace("\"", ""), 16)).toArray());
    }

    static String block(String json, String key) {
        int a = json.indexOf("\"" + key + "\": {");
        return json.substring(a, json.indexOf("}", a));
    }

    // ------------------------------------------------------------------ recorder (sections 3-11, 15)
    static final List<String> out = new ArrayList<>();
    static int frame, seq, del;
    static final Map<Character, Map<Integer, Integer>> names = new HashMap<>();
    static final Map<Character, Integer> nameCount = new HashMap<>();
    static final Map<Character, IdentityHashMap<Object, Integer>> refs = new HashMap<>();
    static Object lastGL;

    static String hex(byte[] b) { return HexFormat.of().formatHex(b); }
    static String sha(byte[] b) throws Exception { return hex(MessageDigest.getInstance("SHA-256").digest(b)); }

    static String ref(char kind, Object o) {
        if (o == null) return "null";
        IdentityHashMap<Object, Integer> m = refs.computeIfAbsent(kind, k -> new IdentityHashMap<>());
        Integer id = m.get(o);
        if (id == null) { id = m.size() + 1; m.put(o, id); }
        return "@" + kind + id;
    }
    static String resolve(char kind, int v) {
        if (v == 0) return "0";
        Integer id = names.computeIfAbsent(kind, k -> new HashMap<>()).get(v);
        return id == null ? "#" + kind + "?" + v : "#" + kind + id;
    }
    static String allocate(char kind, int v) {
        if (v == 0) return "0";
        int id = nameCount.merge(kind, 1, Integer::sum);
        names.computeIfAbsent(kind, k -> new HashMap<>()).put(v, id);
        return "#" + kind + id;
    }
    static int count(String c, Object[] a) {
        if (c.matches("\\d+")) return Integer.parseInt(c);
        Matcher m = Pattern.compile("^\\$(\\d)$").matcher(c);
        if (m.matches()) return Math.max(0, (Integer)a[Integer.parseInt(m.group(1))]);
        m = Pattern.compile("^([A-Z]+)\\(\\$(\\d)\\)$").matcher(c);
        if (!m.matches()) throw new AssertionError(c);
        return tables.get(m.group(1)).getOrDefault((Integer)a[Integer.parseInt(m.group(2))], 1);
    }
    static String str(String v) throws Exception {
        if (v == null) return "null";
        byte[] b = v.getBytes(StandardCharsets.UTF_8);
        StringBuilder t = new StringBuilder();
        for (byte x : b) {
            int u = x & 0xff;
            if (u >= 0x21 && u <= 0x7e && u != 0x25) t.append((char)u); else t.append('%').append(String.format("%02X", u));
        }
        return "S:" + b.length + ":" + sha(b) + (b.length <= 256 ? ":" + t : "");
    }
    static String buf(Buffer b, Integer n) throws Exception {
        if (b == null) return "null";
        int pos = b.position(), lim = b.limit(), end = n == null ? lim : Math.min(lim, pos + Math.max(0, n));
        String kind;
        ByteBuffer bytes;
        if (b instanceof ByteBuffer x) { kind = "byte"; bytes = ByteBuffer.allocate(end - pos); for (int i = pos; i < end; i++) bytes.put(x.get(i)); }
        else if (b instanceof ShortBuffer x) { kind = "short"; bytes = ByteBuffer.allocate(2 * (end - pos)).order(x.order()); for (int i = pos; i < end; i++) bytes.putShort(x.get(i)); }
        else if (b instanceof IntBuffer x) { kind = "int"; bytes = ByteBuffer.allocate(4 * (end - pos)).order(x.order()); for (int i = pos; i < end; i++) bytes.putInt(x.get(i)); }
        else if (b instanceof FloatBuffer x) { kind = "float"; bytes = ByteBuffer.allocate(4 * (end - pos)).order(x.order()); for (int i = pos; i < end; i++) bytes.putInt(Float.floatToRawIntBits(x.get(i))); }
        else throw new AssertionError(b);
        byte[] raw = bytes.array();
        return "B:" + kind + ":" + pos + ":" + lim + ":" + b.capacity() + ":" + (b.isDirect() ? "direct" : "heap") + ":" + sha(raw) + (raw.length <= 256 ? ":" + hex(raw) : "");
    }
    static String fv(float[] a, int off, int n) {
        if (a == null) return "null";
        StringJoiner j = new StringJoiner(",");
        int present = 0;
        if (off >= 0) for (int i = 0; i < n && off + i < a.length; i++, present++) j.add(String.format("%08x", Float.floatToRawIntBits(a[off + i])));
        if (n - present > 0) j.add("!" + (n - present));
        return "fv:" + j;
    }
    interface Elem { String of(int v); }
    static String iv(int[] a, int off, int n, Elem e) {
        if (a == null) return "null";
        StringJoiner j = new StringJoiner(",");
        int present = 0;
        if (off >= 0) for (int i = 0; i < n && off + i < a.length; i++, present++) j.add(e.of(a[off + i]));
        if (n - present > 0) j.add("!" + (n - present));
        return "iv:" + j;
    }
    static String caps(GLCapabilities c) {
        if (c == null) return "null";
        String b1 = c.getDoubleBuffered() ? "T" : "F", b2 = c.getStereo() ? "T" : "F", b3 = c.getHardwareAccelerated() ? "T" : "F", b4 = c.getSampleBuffers() ? "T" : "F";
        return "K:" + String.join(":", b1, b2, b3, "" + c.getDepthBits(), "" + c.getStencilBits(), "" + c.getRedBits(), "" + c.getGreenBits(), "" + c.getBlueBits(),
            "" + c.getAlphaBits(), "" + c.getAccumRedBits(), "" + c.getAccumGreenBits(), "" + c.getAccumBlueBits(), "" + c.getAccumAlphaBits(), b4, "" + c.getNumSamples());
    }
    static boolean isOutput(Role r) { return r.r().startsWith("out-"); }
    static String input(Role r, Object[] a, int i) throws Exception {
        Object v = a[i];
        return switch (r.r()) {
            case "int" -> String.valueOf((int)(Integer)v);
            case "byte" -> String.valueOf((byte)(Byte)v);
            case "float" -> "f:" + String.format("%08x", Float.floatToRawIntBits((Float)v));
            case "double" -> "d:" + String.format("%016x", Double.doubleToRawLongBits((Double)v));
            case "bool" -> (Boolean)v ? "T" : "F";
            case "long" -> "o:" + v;
            case "string" -> str((String)v);
            case "caps" -> caps((GLCapabilities)v);
            case "buf" -> buf((Buffer)v, null);
            case "buf-n" -> buf((Buffer)v, count(r.count(), a));
            case "name" -> resolve(r.kind(), (Integer)v);
            case "ref" -> ref(r.kind(), v);
            case "in-f" -> fv((float[])v, (Integer)a[i + 1], count(r.count(), a));
            case "in-names" -> iv((int[])v, (Integer)a[i + 1], count(r.count(), a), x -> resolve(r.kind(), x));
            default -> throw new AssertionError(r);
        };
    }
    static String output(Role r, Object[] a, int i, boolean returned) throws Exception {
        Object v = a[i];
        return switch (r.r()) {
            case "out-f" -> fv((float[])v, (Integer)a[i + 1], count(r.count(), a));
            case "out-i" -> iv((int[])v, (Integer)a[i + 1], count(r.count(), a), String::valueOf);
            case "out-names" -> iv((int[])v, (Integer)a[i + 1], count(r.count(), a), returned ? x -> allocate(r.kind(), x) : x -> resolve(r.kind(), x));
            case "out-buf" -> buf((Buffer)v, count(r.count(), a));
            default -> throw new AssertionError(r);
        };
    }
    static String ret(Role r, Object v, Object[] a) throws Exception {
        return switch (r.r()) {
            case "int" -> String.valueOf((int)(Integer)v);
            case "bool" -> (Boolean)v ? "T" : "F";
            case "string" -> str((String)v);
            case "ref" -> ref(r.kind(), v);
            case "alloc-lists" -> {
                int base = (Integer)v, range = count(r.count(), a);
                if (base == 0 || range <= 0) yield resolve('L', base);
                String id = allocate('L', base);
                for (int k = 1; k < range; k++) allocate('L', base + k);
                yield id;
            }
            default -> throw new AssertionError(r);
        };
    }
    static void append(String entry, List<String> cols, String tail, boolean deletion, boolean endsFrame) {
        StringBuilder s = new StringBuilder(frame + "." + (deletion ? "d" + (del++) : "" + (seq++)) + "\t" + entry);
        for (String c : cols) s.append('\t').append(c);
        if (tail != null) s.append('\t').append(tail);
        out.add(s.toString());
        if (endsFrame) { frame++; seq = 0; del = 0; }
    }
    static void mark(String label) { append("~mark", List.of(label), null, false, false); }

    static Object call(Object receiver, Object gl, String entry, String desc, Object[] a, Callable<Object> invoke) throws Throwable {
        Rule rule = rules.get(entry + desc);
        if (rule == null) throw new AssertionError("no rule " + entry + desc);
        if (gl != null && !rule.deletion() && gl != lastGL) { lastGL = gl; append("~gl", List.of(ref('G', gl)), null, false, false); }
        List<String> cols = new ArrayList<>();
        if (rule.receiver() != null) cols.add(ref(rule.receiver().kind(), receiver));
        int base = cols.size();
        for (int i = 0; i < rule.params().size(); i++) cols.add(isOutput(rule.params().get(i)) ? null : input(rule.params().get(i), a, i));
        Object result = null;
        Throwable thrown = null;
        try { result = invoke.call(); } catch (Throwable t) { thrown = t; }
        for (int i = 0; i < rule.params().size(); i++) if (isOutput(rule.params().get(i))) cols.set(base + i, output(rule.params().get(i), a, i, thrown == null));
        String tail = null;
        if (thrown != null) {
            tail = "!> " + (thrown instanceof GLException ? "GLException" : thrown instanceof RuntimeException ? "RuntimeException" : thrown instanceof Error ? "Error" : thrown instanceof Exception ? "Exception" : "Throwable");
        } else if (!rule.ret().r().equals("void")) {
            tail = "=> " + ret(rule.ret(), result, a);
        }
        append(entry, cols, tail, rule.deletion(), rule.endsFrame());
        if (thrown != null) throw thrown;
        return result;
    }

    static String descriptor(Method m) {
        StringBuilder s = new StringBuilder("(");
        for (Class<?> c : m.getParameterTypes()) s.append(c.descriptorString());
        return s.append(")").append(m.getReturnType().descriptorString()).toString();
    }

    // ------------------------------------------------------------------ responder (section 16)
    static final class Responder {
        int textures = 1, buffers = 1, programs = 1, lists = 1;
        final Map<String, int[]> proxy = new HashMap<>();
        int drawBuffer, readBuffer;
        int[] ambient = {Float.floatToRawIntBits(0.2f), Float.floatToRawIntBits(0.2f), Float.floatToRawIntBits(0.2f), Float.floatToRawIntBits(1f)};
        Responder(boolean doubleBuffered) { drawBuffer = readBuffer = doubleBuffered ? 1029 : 1028; }

        static void offsetCheck(Object arr, int off, String name) {
            int len = arr == null ? -1 : Array.getLength(arr);
            if (arr != null && len <= off) throw new GLException("array offset argument \"" + name + "\" (" + off + ") equals or exceeds array length (" + len + ")");
        }
        static void rangeCheck(int[] arr, int off, int n) {
            if (arr != null && arr.length < off + n) throw new ArrayIndexOutOfBoundsException("Required " + n + " elements in array, only had " + (arr.length - off));
        }
        int max(int pname) { int[] v = integers.getOrDefault(pname, integers.get(3379)); return v[0]; }
        void proxyImage(int target, int level, int border, int w, int h, int d) {
            int dims, max;
            switch (target) {
                case 32867 -> { dims = 1; max = max(3379); }
                case 32868 -> { dims = 2; max = max(3379); }
                case 34075 -> { dims = 2; max = max(34076); }
                case 32880 -> { dims = 3; max = max(32883); }
                default -> { return; }
            }
            int[] size = {w, h, d};
            boolean ok = border == 0 && level >= 0 && (target != 34075 || w == h);
            for (int i = 0; i < dims; i++) ok &= size[i] >= 0 && size[i] * Math.pow(2, level) <= max;
            proxy.put(target + ":" + level, ok ? new int[]{w, dims >= 2 ? h : 1, dims >= 3 ? d : 1} : new int[3]);
        }
        Object invoke(Method m, Object[] a) {
            switch (m.getName()) {
                case "glGenTextures", "glGenBuffersARB", "glGenProgramsARB" -> {
                    int n = (Integer)a[0]; int[] arr = (int[])a[1]; int off = (Integer)a[2];
                    rangeCheck(arr, off, n);
                    offsetCheck(arr, off, m.getName().equals("glGenTextures") ? "textures_offset" : "ids_offset");
                    for (int i = 0; i < n; i++) arr[off + i] = m.getName().equals("glGenTextures") ? textures++ : m.getName().equals("glGenBuffersARB") ? buffers++ : programs++;
                    return null;
                }
                case "glDeleteTextures", "glDeleteBuffersARB" -> {
                    rangeCheck((int[])a[1], (Integer)a[2], (Integer)a[0]);
                    offsetCheck(a[1], (Integer)a[2], m.getName().equals("glDeleteTextures") ? "textures_offset" : "ids_offset");
                    return null;
                }
                case "glGenLists" -> { int r = (Integer)a[0]; if (r <= 0) return 0; int base = lists; lists += r; return base; }
                case "glGetString" -> { return strings.get((Integer)a[0]); }
                case "isExtensionAvailable" -> {
                    String name = (String)a[0];
                    for (StringTokenizer t = new StringTokenizer(strings.get(7939)); t.hasMoreTokens();) if (t.nextToken().trim().equals(name)) return true;
                    String[] v = strings.get(7938).split("\\.");
                    int major = Integer.parseInt(v[0]), minor = Integer.parseInt(v[1]);
                    Set<String> names = new HashSet<>();
                    while (major > 0) { while (minor >= 0) { names.add("GL_VERSION_" + major + "_" + minor); minor--; } if (major == 2) minor = 5; major--; }
                    return names.contains(name);
                }
                case "glGetIntegerv" -> {
                    offsetCheck(a[1], (Integer)a[2], "params_offset");
                    int pname = (Integer)a[0];
                    int[] v = pname == 3073 ? new int[]{drawBuffer} : pname == 3074 ? new int[]{readBuffer} : pname == 34379 ? new int[]{-1} : integers.get(pname);
                    if (v != null) System.arraycopy(v, 0, (int[])a[1], (Integer)a[2], v.length);
                    return null;
                }
                case "glDrawBuffer" -> { drawBuffer = (Integer)a[0]; return null; }
                case "glReadBuffer" -> { readBuffer = (Integer)a[0]; return null; }
                case "glLightModelfv" -> {
                    offsetCheck(a[1], (Integer)a[2], "params_offset");
                    float[] p = (float[])a[1];
                    int off = (Integer)a[2];
                    if ((Integer)a[0] == 2899 && p != null && off >= 0 && off <= p.length - 4) for (int i = 0; i < 4; i++) ambient[i] = Float.floatToRawIntBits(p[off + i]);
                    return null;
                }
                case "glGetFloatv" -> {
                    int[] v = (Integer)a[0] == 2899 ? ambient.clone() : floats.get((Integer)a[0]);
                    if (a.length == 2) {
                        FloatBuffer b = (FloatBuffer)a[1];
                        if (v != null) for (int i = 0; i < v.length; i++) b.put(b.position() + i, Float.intBitsToFloat(v[i]));
                    } else {
                        offsetCheck(a[1], (Integer)a[2], "params_offset");
                        if (v != null) for (int i = 0; i < v.length; i++) ((float[])a[1])[(Integer)a[2] + i] = Float.intBitsToFloat(v[i]);
                    }
                    return null;
                }
                case "glGetTexLevelParameteriv" -> {
                    offsetCheck(a[3], (Integer)a[4], "params_offset");
                    int[] img = proxy.get(a[0] + ":" + a[1]);
                    int pname = (Integer)a[2];
                    ((int[])a[3])[(Integer)a[4]] = img == null ? 0 : pname == 4096 ? img[0] : pname == 4097 ? img[1] : pname == 32881 ? img[2] : 0;
                    return null;
                }
                case "glTexImage1D" -> { proxyImage((Integer)a[0], (Integer)a[1], (Integer)a[4], (Integer)a[3], 1, 1); return null; }
                case "glTexImage2D" -> { proxyImage((Integer)a[0], (Integer)a[1], (Integer)a[5], (Integer)a[3], (Integer)a[4], 1); return null; }
                case "glTexImage3D" -> { proxyImage((Integer)a[0], (Integer)a[1], (Integer)a[6], (Integer)a[3], (Integer)a[4], (Integer)a[5]); return null; }
                case "glColor4fv", "glPointParameterfvARB" -> { offsetCheck(a[0 + (m.getName().equals("glColor4fv") ? 0 : 1)], (Integer)a[m.getName().equals("glColor4fv") ? 1 : 2], "v_offset"); return null; }
                case "glLoadMatrixf" -> { offsetCheck(a[0], (Integer)a[1], "m_offset"); return null; }
                case "glFogfv" -> { offsetCheck(a[1], (Integer)a[2], "params_offset"); return null; }
                case "glLightfv", "glTexEnvfv", "glTexGenfv" -> { offsetCheck(a[2], (Integer)a[3], "params_offset"); return null; }
                case "glProgramLocalParameter4fvARB" -> { if (a.length == 4) offsetCheck(a[2], (Integer)a[3], "params_offset"); return null; }
                default -> { return m.getReturnType() == boolean.class ? false : m.getReturnType() == int.class ? 0 : null; }
            }
        }
    }

    // ------------------------------------------------------------------ context objects (sections 10, 16)
    static final class RecFactory extends GLDrawableFactory {
        public GLDrawable getGLDrawable(Object target, GLCapabilities caps, GLCapabilitiesChooser chooser) {
            try {
                return (GLDrawable)call(this, null, "GLDrawableFactory.getGLDrawable", "(Ljava/lang/Object;Ljavax/media/opengl/GLCapabilities;Ljavax/media/opengl/GLCapabilitiesChooser;)Ljavax/media/opengl/GLDrawable;",
                    new Object[]{target, caps, chooser}, () -> {
                        if (target == null) throw new IllegalArgumentException("Null target");
                        return new RecDrawable(caps == null ? new GLCapabilities() : (GLCapabilities)caps.clone());
                    });
            } catch (RuntimeException | Error e) { throw e; } catch (Throwable t) { throw new RuntimeException(t); }
        }
    }
    static Object run(Object receiver, String entry, String desc, Object[] a, Callable<Object> body) {
        try { return call(receiver, null, entry, desc, a, body); }
        catch (RuntimeException | Error e) { throw e; } catch (Throwable t) { throw new RuntimeException(t); }
    }
    static final class RecDrawable implements GLDrawable {
        final GLCapabilities caps;
        boolean realized;
        RecDrawable(GLCapabilities caps) { this.caps = caps; }
        public GLContext createContext(GLContext share) {
            return (GLContext)run(this, "GLDrawable.createContext", "(Ljavax/media/opengl/GLContext;)Ljavax/media/opengl/GLContext;", new Object[]{share}, () -> new RecContext(this));
        }
        public void setRealized(boolean b) { run(this, "GLDrawable.setRealized", "(Z)V", new Object[]{b}, () -> { realized = b; return null; }); }
        public void swapBuffers() { run(this, "GLDrawable.swapBuffers", "()V", new Object[0], () -> null); }
    }
    static final class RecContext extends GLContext {
        final RecDrawable drawable;
        final GL gl;
        boolean created, destroyed;
        RecContext(RecDrawable d) {
            drawable = d;
            Responder responder = new Responder(d.caps.getDoubleBuffered());
            gl = (GL)Proxy.newProxyInstance(GL.class.getClassLoader(), new Class<?>[]{GL.class},
                (proxy, m, a) -> call(null, proxy, m.getName(), descriptor(m), a == null ? new Object[0] : a, () -> responder.invoke(m, a)));
        }
        public int makeCurrent() {
            return (Integer)run(this, "GLContext.makeCurrent", "()I", new Object[0], () -> {
                GLContext cur = GLContext.getCurrent();
                if (cur == this) return 1;
                if (cur != null) setCurrent(null); // internal release: not recorded
                if (!drawable.realized || destroyed) return 0;
                int r = created ? 1 : 2;
                created = true;
                setCurrent(this);
                return r;
            });
        }
        public void release() { run(this, "GLContext.release", "()V", new Object[0], () -> { setCurrent(null); return null; }); }
        public void destroy() { run(this, "GLContext.destroy", "()V", new Object[0], () -> { destroyed = true; return null; }); }
        public GL getGL() { return (GL)run(this, "GLContext.getGL", "()Ljavax/media/opengl/GL;", new Object[0], () -> gl); }
    }

    // ------------------------------------------------------------------ goldenScript of gl-trace.test.ts (Appendix A)
    static final String PROGRAM = "!!ARBvp1.0\n" + "MOV result.position, vertex.position;\n".repeat(7) + "END";

    static void golden() {
        GLDrawableFactory factory = new RecFactory();
        GLCapabilities caps = new GLCapabilities();
        caps.setSampleBuffers(true);
        caps.setNumSamples(4);
        Object canvas = new Object();
        GLDrawable drawable = factory.getGLDrawable(canvas, caps, null);
        drawable.setRealized(true);
        GLContext context = drawable.createContext(null);
        context.makeCurrent();
        GL gl = context.getGL();
        gl.glGetString(7936);
        gl.isExtensionAvailable("GL_ARB_vertex_program");
        gl.isExtensionAvailable("GL_NV_fence");
        int[] ints = new int[3];
        gl.glGetIntegerv(34018, ints, 1);
        gl.setSwapInterval(0);
        int[] tex = new int[3];
        gl.glGenTextures(2, tex, 1);
        int[] vbo = new int[1];
        gl.glGenBuffersARB(1, vbo, 0);
        int[] prog = new int[1];
        gl.glGenProgramsARB(1, prog, 0);
        int lists = gl.glGenLists(2);
        gl.glNewList(lists + 1, 4864);
        gl.glBegin(6);
        gl.glColor4ub((byte)-128, (byte)1, (byte)2, (byte)127);
        gl.glTexCoord2f(0.5f, 1);
        gl.glVertex2f(-1.5f, 2);
        gl.glEnd();
        gl.glEndList();
        gl.glCallList(lists + 1);
        gl.glActiveTexture(33985);
        gl.glBindTexture(3553, tex[2]);
        gl.glBindTexture(3553, 0);
        gl.glBindTexture(3553, 999);
        gl.glBindBufferARB(34962, vbo[0]);
        gl.glBindProgramARB(34336, prog[0]);
        gl.glEnable(2929);
        gl.glDisable(3042);
        gl.glAlphaFunc(516, 0);
        gl.glBlendFunc(770, 771);
        gl.glClearColor(0.25f, 0.5f, 1, 0);
        gl.glClear(16640);
        gl.glClearDepth(1);
        gl.glClientActiveTexture(33984);
        gl.glColor3ub((byte)-1, (byte)0, (byte)127);
        gl.glColor4f(1, 0, -0.0f, 0.5f);
        float[] color = new float[6];
        color[2] = Float.intBitsToFloat(0x7fa00001);
        color[3] = 0.75f;
        gl.glColor4fv(color, 1);
        gl.glColorMaterial(1032, 5634);
        ByteBuffer bytes = ByteBuffer.allocateDirect(16).order(ByteOrder.nativeOrder());
        for (int i = 0; i < 16; i++) bytes.put(i, (byte)(i * 17));
        bytes.position(12);
        gl.glColorPointer(4, 5121, 16, bytes);
        gl.glColorPointer(4, 5121, 16, 12L);
        gl.glCopyPixels(0, 0, 765, 503, 6144);
        gl.glCullFace(1029);
        gl.glDepthFunc(515);
        gl.glDepthMask(false);
        gl.glDisableClientState(32886);
        gl.glEnableClientState(32884);
        gl.glDrawBuffer(1026);
        gl.glReadBuffer(1024);
        IntBuffer indices = ByteBuffer.allocateDirect(12).order(ByteOrder.LITTLE_ENDIAN).asIntBuffer();
        indices.put(0, 0).put(1, 1).put(2, 2);
        gl.glDrawElements(4, 3, 5125, indices);
        gl.glDrawElements(4, 6, 5125, 36L);
        gl.glDrawPixels(2, 1, 32993, 5121, IntBuffer.wrap(new int[]{0x11223344, -1}));
        float[] fog = {0.5f, 0.25f, 0.125f, 1, 3000};
        gl.glFogfv(2918, fog, 0);
        gl.glFogfv(2915, fog, 4);
        gl.glFogf(2916, 3584);
        gl.glFogi(2917, 9729);
        float[] out4 = new float[5];
        gl.glGetFloatv(2899, out4, 1);
        FloatBuffer pointMax = FloatBuffer.allocate(1);
        gl.glGetFloatv(33063, pointMax);
        int[] width = new int[1];
        gl.glTexImage2D(32868, 1, 4, 64, 32, 0, 6408, 5121, null);
        gl.glGetTexLevelParameteriv(32868, 1, 4096, width, 0);
        gl.glHint(3156, 4353);
        FloatBuffer interleaved = ByteBuffer.allocateDirect(40).order(ByteOrder.nativeOrder()).asFloatBuffer();
        interleaved.put(0, 1).put(9, -2);
        gl.glInterleavedArrays(10791, 20, interleaved);
        gl.glInterleavedArrays(10787, 16, 0L);
        float[] ambient = {0.2f, 0.3f, 0.4f, 1};
        gl.glLightModelfv(2899, ambient, 0);
        gl.glLightf(16388, 4617, 0.001f);
        float[] light = {0, 1, 0, 0, 0.5f};
        gl.glLightfv(16384, 4611, light, 0);
        gl.glLightfv(16385, 4615, light, 4);
        gl.glMatrixMode(5889);
        gl.glLoadIdentity();
        float[] matrix = new float[16];
        for (int i = 0; i < 16; i++) matrix[i] = i == 0 || i == 5 || i == 10 || i == 15 ? 1 : 0;
        gl.glLoadMatrixf(matrix, 0);
        gl.glMultiTexCoord2f(33985, 0.25f, 0.75f);
        FloatBuffer normals = FloatBuffer.allocate(100);
        for (int i = 0; i < 100; i++) normals.put(i, i / 8f);
        gl.glNormalPointer(5126, 12, normals);
        gl.glNormalPointer(5126, 40, 16L);
        gl.glOrtho(0, 765, 0, 503, -1, 1);
        gl.glPixelStorei(3317, 1);
        gl.glPixelZoom(1, -1);
        gl.glPointParameterfARB(33062, 1);
        gl.glPointParameterfvARB(33065, new float[]{1, 0, 0.0005f}, 0);
        gl.glPolygonMode(1032, 6914);
        gl.glPushAttrib(8192);
        gl.glPopAttrib();
        gl.glPushMatrix();
        gl.glPopMatrix();
        gl.glProgramLocalParameter4fARB(34336, 65, 0.005f, 0, 0, 1);
        ByteBuffer table = ByteBuffer.allocateDirect(48).order(ByteOrder.nativeOrder());
        for (int i = 0; i < 12; i++) table.putFloat(i * 4, i + 0.5f);
        FloatBuffer noise = table.asFloatBuffer().asReadOnlyBuffer();
        noise.position(4);
        gl.glProgramLocalParameter4fvARB(34336, 1, noise);
        gl.glProgramLocalParameter4fvARB(34336, 66, ambient, 0);
        gl.glProgramStringARB(34336, 34933, 300, PROGRAM);
        gl.glRasterPos2i(0, 0);
        gl.glRotatef(180, 1, 0, 0);
        gl.glScalef(1, -1, 1);
        gl.glScissor(0, 0, 0, 0);
        gl.glShadeModel(7425);
        ByteBuffer big = ByteBuffer.allocateDirect(8).order(ByteOrder.BIG_ENDIAN);
        big.putFloat(0, 1).putFloat(4, -2);
        gl.glTexCoordPointer(2, 5126, 8, big.asFloatBuffer());
        gl.glTexCoordPointer(2, 5126, 36, 28L);
        gl.glTexEnvf(8960, 34163, 2);
        gl.glTexEnvfv(8960, 8705, ambient, 0);
        gl.glTexEnvi(8960, 8704, 34160);
        gl.glTexGenfv(8192, 9474, ambient, 0);
        gl.glTexGenfv(8193, 9473, new float[2], 0);
        gl.glTexGeni(8194, 9472, 34065);
        gl.glTexImage1D(3552, 0, 6408, 2, 0, 6408, 5121, ByteBuffer.wrap(new byte[]{1, 2, 3, 4, -1, -2, -3, -4}));
        ByteBuffer empty = ByteBuffer.allocate(4);
        empty.position(4);
        gl.glTexImage3D(32879, 0, 6410, 1, 1, 0, 0, 6410, 5121, empty);
        gl.glTexParameteri(3553, 10241, 9729);
        gl.glTranslatef(1.5f, -2.5f, 0);
        gl.glVertexPointer(2, 5122, 4, ShortBuffer.wrap(new short[]{1, -1, 32767, -32768}));
        gl.glVertexPointer(3, 5126, 36, 0L);
        gl.glViewport(0, 0, 765, 503);
        bytes.position(0);
        gl.glBufferDataARB(34962, 16, bytes, 35044);
        gl.glBufferSubDataARB(34962, 4, 8, IntBuffer.wrap(new int[]{1, 2, 3, 4, 5}, 1, 2));
        gl.glDeleteTextures(1, tex, 1);
        gl.glDeleteLists(lists, 2);
        gl.glDeleteBuffersARB(1, vbo, 0);
        drawable.swapBuffers();
        gl.glClear(16384);
        try {
            gl.glGenTextures(0, new int[2], 2);
        } catch (GLException expected) {
        }
        mark("teardown");
        context.release();
        context.destroy();
        drawable.setRealized(false);
    }

    // The section 16 state answers, on a double-buffered and a single-buffered context (stateScript in gl-trace.test.ts).
    static void state() {
        GLDrawableFactory factory = new RecFactory();
        GLDrawable drawable = factory.getGLDrawable(new Object(), null, null);
        drawable.setRealized(true);
        GLContext context = drawable.createContext(null);
        context.makeCurrent();
        GL gl = context.getGL();
        int[] i = new int[2];
        gl.glGetIntegerv(3073, i, 0);
        gl.glGetIntegerv(3074, i, 1);
        gl.glDrawBuffer(1026);
        gl.glReadBuffer(1024);
        gl.glGetIntegerv(3073, i, 0);
        gl.glGetIntegerv(3074, i, 1);
        gl.glGetIntegerv(34379, i, 0);
        float[] f = new float[5];
        gl.glGetFloatv(2899, f, 0);
        gl.glLightModelfv(2899, new float[]{9, 0.25f, 0.5f, 0.75f, 1}, 1);
        gl.glLightModelfv(2899, new float[]{7, 7, 7}, 0);
        gl.glGetFloatv(2899, f, 1);
        FloatBuffer b = FloatBuffer.allocate(4);
        gl.glGetFloatv(2899, b);
        float[] nan = {Float.intBitsToFloat(0x7fa00001), Float.intBitsToFloat(0xffc00001), Float.intBitsToFloat(0x80000000), Float.intBitsToFloat(0x00000001)};
        gl.glLightModelfv(2899, nan, 0);
        gl.glGetFloatv(2899, f, 0);
        gl.glGetFloatv(2899, FloatBuffer.allocate(4));
        FloatBuffer view = ByteBuffer.allocateDirect(20).order(ByteOrder.BIG_ENDIAN).asFloatBuffer();
        view.position(1);
        gl.glGetFloatv(2899, view);
        GLCapabilities single = new GLCapabilities();
        single.setDoubleBuffered(false);
        GLDrawable front = factory.getGLDrawable(new Object(), single, null);
        front.setRealized(true);
        GLContext other = front.createContext(null);
        other.makeCurrent();
        GL gl2 = other.getGL();
        gl2.glGetIntegerv(3073, i, 0);
        gl2.glGetIntegerv(3074, i, 1);
        gl2.glGetFloatv(2899, f, 0);
    }

    // Section 8 for arbitrary UTF-16 strings. Each line of the file is one string, written as 4-hex-digit code units
    // (an empty line is the empty string). Prints the string token, a tab, and the hex of String.getBytes(UTF_8).
    static void strings(Path file) throws Exception {
        for (String line : Files.readAllLines(file, StandardCharsets.US_ASCII)) {
            char[] units = new char[line.length() / 4];
            for (int k = 0; k < units.length; k++) units[k] = (char)Integer.parseInt(line.substring(4 * k, 4 * k + 4), 16);
            String v = new String(units);
            out.add(str(v) + "\t" + hex(v.getBytes(StandardCharsets.UTF_8)));
        }
    }

    public static void main(String[] args) throws Exception {
        load(Path.of(args[0]));
        String mode = args.length > 1 ? args[1] : "golden";
        if (mode.equals("strings")) {
            strings(Path.of(args[2]));
            for (String line : out) System.out.println(line);
            return;
        }
        if (mode.equals("state")) state(); else golden();
        System.out.println("#GLTrace v1");
        System.out.println("#! profile=" + profileName);
        for (String line : out) System.out.println(line);
    }
}
`;

// GlTraceReference, compiled once for the tests that run it and removed when this file's tests finish.
let referenceDir: string | null = null;

afterAll(() => {
    if (referenceDir !== null) rmSync(referenceDir, { recursive: true, force: true });
});

function referenceClasses(): string {
    if (referenceDir !== null) return referenceDir;
    const dir = mkdtempSync(join(tmpdir(), 'rs530-gltrace-java-'));
    writeFileSync(join(dir, 'GlTraceReference.java'), GLTRACE_REFERENCE_JAVA);
    const compiled = Bun.spawnSync(['javac', '-cp', joglPath, '-d', dir, join(dir, 'GlTraceReference.java')]);
    if (compiled.exitCode !== 0) {
        rmSync(dir, { recursive: true, force: true });
        throw new Error('javac GlTraceReference failed:\n' + compiled.stderr.toString());
    }
    referenceDir = dir;
    return dir;
}

// Runs GlTraceReference on this GLTRACE.md and returns its stdout with LF line ends.
function runReference(...args: string[]): string {
    const java = Bun.spawnSync(['java', '-cp', referenceClasses() + delimiter + joglPath, 'GlTraceReference', glTraceSpecPath, ...args]);
    expect(java.exitCode, java.stderr.toString()).toBe(0);
    return java.stdout.toString().replace(/\r\n/g, '\n');
}

test('a Java recorder written from GLTRACE.md prints Appendix A byte for byte with real java.nio buffers and JOGL classes', () => {
    const javaText = runReference();
    expect(javaText).toBe(mdFence('golden'));
    const javaFile = parseTrace(javaText);
    expect(javaFile.meta).toEqual(['profile=fallback-gl21']);
    expect(javaFile.records.length).toBe(121);
}, 60000);

test('string tokens follow Java String.getBytes(UTF_8): a pair is 4 bytes, each unpaired surrogate is "?" 0x3F (section 8)', () => {
    const cases: string[] = [
        // lone high, lone low, at either end and between other text
        '\uD800',
        '\uDBFF',
        '\uDC00',
        '\uDFFF',
        'ab\uD83D',
        '\uDE00ab',
        'a\uD800b',
        'a\uDC00b',
        // a trailing unpaired high surrogate after a non-surrogate unit: raw Bun 1.2.14 TextEncoder panics on these
        'A\uD800',
        'é\uD800',
        '€\uDBFF',
        // reversed pairs; a high before a pair; a low after a pair
        '\uDE00\uD83D',
        'x\uDC00\uD800y',
        '\uD83D😀',
        '😀\uDE00',
        // mixed non-ASCII and unpaired surrogates, inline (<= 256 bytes) and hashed only (> 256 bytes)
        'é\uD800€\uDC00x',
        'é\uD800€\uDC00x日本\uDBFF',
        'é\uD800€\uDC00x日本\uDBFF'.repeat(30),
        '%\uD800\t\u0000ÿ\uDFFFĀ',
        // valid pairs: U+1F600, U+10000, U+10FFFF, mixed with BMP text
        '😀',
        '𐀀',
        '􏿿',
        'a😀é€😀z',
        '😀'.repeat(70),
        // no surrogates: a real U+FFFD stays EF BF BD; boundaries of the 1-, 2- and 3-byte forms; empty and ASCII
        '�',
        '\u0000\u007f\u0080߿ࠀ￿',
        '',
        'GL_ARB_vertex_program'
    ];
    // Random strings dense in surrogates.
    let seed = 530;
    const rnd = (n: number) => {
        seed = (Math.imul(seed, 1103515245) + 12345) | 0;
        return (seed >>> 8) % n;
    };
    const pool = [0x41, 0x7a, 0x25, 0x00, 0x7f, 0x80, 0xe9, 0x7ff, 0x800, 0x20ac, 0xfffd, 0xffff, 0xd800, 0xdbff, 0xd83d, 0xdc00, 0xdfff, 0xde00];
    for (let n = 0; n < 400; n++) {
        let v = '';
        const length = rnd(14);
        for (let k = 0; k < length; k++) v += String.fromCharCode(rnd(3) === 0 ? 0xd800 + rnd(0x800) : pool[rnd(pool.length)]);
        cases.push(v);
    }

    // The case strings go to Java as code units: no encoder sees them on the way.
    const units = (v: string) => Array.from({ length: v.length }, (_, k) => v.charCodeAt(k).toString(16).padStart(4, '0')).join('');
    const file = join(referenceClasses(), 'strings.txt');
    writeFileSync(file, cases.map(v => units(v) + '\n').join(''));
    const javaLines = runReference('strings', file).split('\n').slice(0, -1);
    expect(javaLines.length).toBe(cases.length);

    const bytesOf = (v: string) => {
        const blobs: string[] = [];
        const token = formatValue(encodeString(v, (hash, bytes) => blobs.push(hash + ':' + bytesToHex(bytes))));
        expect(blobs.length).toBe(1);
        return { token, hex: blobs[0].slice(65) };
    };
    for (let k = 0; k < cases.length; k++) {
        const [javaToken, javaHex] = javaLines[k].split('\t');
        const ts = bytesOf(cases[k]);
        expect(ts.token, 'case ' + k + ' ' + units(cases[k])).toBe(javaToken);
        expect(ts.hex, 'case ' + k + ' ' + units(cases[k])).toBe(javaHex);
        expect(javaUtf8Bytes(cases[k])).toEqual(hexBytes(javaHex));
    }

    // The bytes themselves, as JDK 21 gives them (and as GLTRACE.md section 8 states).
    expect(bytesOf('\uD800').hex).toBe('3f');
    expect(bytesOf('\uDC00').hex).toBe('3f');
    expect(bytesOf('A\uD800').hex).toBe('413f');
    expect(bytesOf('\uDE00\uD83D').token).toBe('S:2:' + sha(hexBytes('3f3f')) + ':??');
    expect(bytesOf('\uD83D😀').hex).toBe('3ff09f9880');
    expect(bytesOf('é\uD800€\uDC00x').hex).toBe('c3a93fe282ac3f78');
    expect(bytesOf('😀').hex).toBe('f09f9880');
    expect(bytesOf('�').hex).toBe('efbfbd');
}, 60000);

// The section 16 state answers, as GlTraceReference.state() drives them in Java.
function stateScript(writer: GlTraceWriter): void {
    const factory = new RecordingGLDrawableFactory(new NullGLDrawableFactory(FALLBACK_CAPS_PROFILE), writer);
    const drawable = factory.getGLDrawable({}, null, null);
    drawable.setRealized(true);
    const context = drawable.createContext(null);
    context.makeCurrent();
    const gl = context.getGL();
    const i = new Int32Array(2);
    gl.glGetIntegerv(3073, i, 0);
    gl.glGetIntegerv(3074, i, 1);
    gl.glDrawBuffer(1026);
    gl.glReadBuffer(1024);
    gl.glGetIntegerv(3073, i, 0);
    gl.glGetIntegerv(3074, i, 1);
    gl.glGetIntegerv(34379, i, 0);
    const f = new Float32Array(5);
    gl.glGetFloatv(2899, f, 0);
    gl.glLightModelfv(2899, new Float32Array([9, 0.25, 0.5, 0.75, 1]), 1);
    gl.glLightModelfv(2899, new Float32Array([7, 7, 7]), 0);
    gl.glGetFloatv(2899, f, 1);
    gl.glGetFloatv(2899, FloatBuffer.allocate(4));
    // NaN payloads (a signaling NaN, a negative quiet NaN with a payload), -0 and a denormal read back bit-exact
    // through the array form and both FloatBuffer storages: heap, and a big-endian direct view at position 1
    const nan = new Float32Array(4);
    new Uint32Array(nan.buffer).set([0x7fa00001, 0xffc00001, 0x80000000, 0x00000001]);
    gl.glLightModelfv(2899, nan, 0);
    gl.glGetFloatv(2899, f, 0);
    gl.glGetFloatv(2899, FloatBuffer.allocate(4));
    const view = ByteBuffer.allocateDirect(20).order(ByteOrder.BIG_ENDIAN).asFloatBuffer();
    view.position(1);
    gl.glGetFloatv(2899, view);
    const single = new GLCapabilities();
    single.setDoubleBuffered(false);
    const front = factory.getGLDrawable({}, single, null);
    front.setRealized(true);
    const other = front.createContext(null);
    other.makeCurrent();
    const gl2 = other.getGL();
    gl2.glGetIntegerv(3073, i, 0);
    gl2.glGetIntegerv(3074, i, 1);
    gl2.glGetFloatv(2899, f, 0);
}

test('the state answers of section 16 agree between NullGL and the Java reference responder', () => {
    const javaText = runReference('state');
    const w = new GlTraceWriter();
    stateScript(w);
    const ts = w.text().split('\n').slice(1, -1);
    expect(javaText.trimEnd().split('\n').slice(2)).toEqual(ts);
    const answers = ts.filter(l => /\tglGet(Integerv|Floatv)\t/.test(l)).map(l => l.split('\t').slice(2, 4).join(' '));
    expect(answers).toEqual([
        '3073 iv:1029',
        '3074 iv:1029',
        '3073 iv:1026',
        '3074 iv:1024',
        '34379 iv:-1',
        '2899 fv:3e4ccccd,3e4ccccd,3e4ccccd,3f800000',
        '2899 fv:3e800000,3f000000,3f400000,3f800000',
        '2899 B:float:0:4:4:heap:' + sha(hexBytes('0000803e0000003f0000403f0000803f')) + ':0000803e0000003f0000403f0000803f',
        '2899 fv:7fa00001,ffc00001,80000000,00000001',
        '2899 B:float:0:4:4:heap:' + sha(hexBytes('0100a07f0100c0ff0000008001000000')) + ':0100a07f0100c0ff0000008001000000',
        '2899 B:float:1:5:5:direct:' + sha(hexBytes('7fa00001ffc000018000000000000001')) + ':7fa00001ffc000018000000000000001',
        '3073 iv:1028',
        '3074 iv:1028',
        '2899 fv:3e4ccccd,3e4ccccd,3e4ccccd,3f800000'
    ]);
}, 60000);

test('glTraceDiff: first divergence with 20 records of context, slips, deletion exclusion, live sets and the CLI', () => {
    const expected = goldenText();
    expect(diffTraces(expected, expected).equal).toBe(true);
    expect(diffTraces(expected, expected).report).toBe('GLTrace diff: equal (118 ordered records, live objects equal at 2 checkpoints)\n' + '(deletion records excluded from the ordered comparison: 3 expected, 3 actual)\n');

    // Seeded divergence: the TS side binds the other texture at 0.24.
    const actual = expected.replace('0.24\tglBindTexture\t3553\t#T2', '0.24\tglBindTexture\t3553\t#T1');
    const diff = diffTraces(expected, actual);
    expect(diff.equal).toBe(false);
    expect(diff.index).toBe(24);
    const lines = diff.report.split('\n');
    expect(lines[0]).toBe('GLTrace diff: first divergence at ordered record 24 (expected 0.24, actual 0.24)');
    expect(lines[2]).toBe('--- 20 matching records before ---');
    expect(lines.slice(3, 23)).toEqual(
        expected
            .split('\n')
            .slice(2 + 4, 2 + 24)
            .map(l => '  ' + l)
    ); // 2 header lines
    expect(lines[23]).toBe('--- divergence (- expected, + actual) ---');
    expect(lines[24]).toBe('- 0.24\tglBindTexture\t3553\t#T2');
    expect(lines[25]).toBe('+ 0.24\tglBindTexture\t3553\t#T1');
    expect(lines[26]).toBe('--- up to 20 following records, expected ---');
    expect(lines[27]).toBe('- 0.25\tglBindTexture\t3553\t0');
    expect(lines.filter(l => l.startsWith('- ')).length).toBe(21);
    expect(lines.filter(l => l.startsWith('+ ')).length).toBe(21);

    // A slip is called out; a missing record is a divergence; stacks are shown but not compared.
    const slip = diffTraces(expected, expected.replace('0.29\tglEnable\t2929', '0.29\tglEnable\ti?:2929.5'), { context: 2 });
    expect(slip.report).toContain('note: actual passes a value the Java parameter type cannot hold: i?:2929.5');
    const short = diffTraces(expected, expected.split('\n').slice(0, -2).join('\n') + '\n', { context: 0 });
    expect(short.report.split('\n')[0]).toBe('GLTrace diff: first divergence at ordered record 117 (expected 1.5, actual end of trace)');
    expect(diffTraces(expected, expected.replace('0.10\tsetSwapInterval\t0\n', '0.10\tsetSwapInterval\t0\n#@ Client.f < GlRenderer.a\n')).equal).toBe(true);

    // Deletions: moved to another frame they still compare equal; with --deletions they do not; dropped, the live sets differ.
    const del = '0.d0\tglDeleteTextures\t1\tiv:#T1\t1\n';
    const failedGen = '1.1\tglGenTextures\t0\tiv:\t2\t!> GLException\n';
    const moved = expected.replace(del, '').replace(failedGen, failedGen + '1.d0\tglDeleteTextures\t1\tiv:#T1\t1\n');
    expect(moved).not.toBe(expected);
    expect(diffTraces(expected, moved).equal).toBe(true);
    const movedDiff = diffTraces(expected, moved, { includeDeletions: true });
    expect(movedDiff.equal).toBe(false);
    // the header names a deletion record by its own id, frame.d<seq>, as the body lines do
    expect(movedDiff.report.split('\n')[0]).toBe('GLTrace diff: first divergence at ordered record 111 (expected 0.d0, actual 0.d1)');
    expect(movedDiff.report).toContain('\n- 0.d0\tglDeleteTextures\t1\tiv:#T1\t1\n');
    const dropped = diffTraces(expected, expected.replace(del, ''));
    expect(dropped.equal).toBe(false);
    expect(dropped.report).toBe(
        'GLTrace diff: ordered records equal (118), live objects differ\n' +
            '(deletion records excluded from the ordered comparison: 3 expected, 2 actual)\n' +
            'at teardown: expected only -; actual only #T1\n' +
            'at <end>: expected only -; actual only #T1\n'
    );

    // CLI
    const dir = mkdtempSync(join(tmpdir(), 'rs530-gltrace-diff-'));
    try {
        const e = join(dir, 'java.trace');
        const a = join(dir, 'ts.trace');
        writeFileSync(e, expected);
        writeFileSync(a, actual);
        const cli = (...args: string[]) => Bun.spawnSync(['bun', join(import.meta.dir, 'glTraceDiff.ts'), ...args]);
        const differ = cli(e, a, '--context', '3');
        expect(differ.exitCode).toBe(1);
        expect(differ.stdout.toString()).toBe(diffTraces(expected, actual, { context: 3, expectedLabel: e, actualLabel: a }).report);
        expect(cli(e, e).exitCode).toBe(0);
        expect(cli(e).exitCode).toBe(2);
        writeFileSync(a, 'not a trace\n');
        expect(cli(e, a).exitCode).toBe(2);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
