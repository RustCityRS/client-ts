import { expect, test } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { type CapsProfile, capsProfileFromJson } from '#/gl/CapsProfile.js';
import { formatRecordLine, GlTraceWriter, parseTrace } from '#/gl/GlTrace.js';
import { RecordingGLDrawableFactory } from '#/gl/RecordingGL.js';
import { NullGLDrawableFactory } from '#/gl/NullGL.js';
import GLCapabilities from '#/jogl/GLCapabilities.js';
import type GLContext from '#/jogl/GLContext.js';
import type GLDrawable from '#/jogl/GLDrawable.js';
import type GLDrawableFactory from '#/jogl/GLDrawableFactory.js';
import type { GL } from '#/jogl/GL.js';
import { arrayAtI32 } from '#/util/JavaArray.js';

// The GL state the jar reads back (GLTRACE.md section 16), replayed through RecordingGL over NullGL with the captured
// RTX 5070 profile (rtx5070.json), the frame oracles' default:
// - rd.a(I)V reads LIGHT_MODEL_AMBIENT, which mk.a(IFFF)V set, and loads it into ARB vertex-program local 66.
// - tf.h()V saves DRAW_BUFFER and READ_BUFFER, copies FRONT_LEFT into BACK_LEFT, and restores the saved pair.
// - rd.f()V reads PROGRAM_ERROR_POSITION_ARB after it loads the water program.
// The captured profile lists static answers for all four pnames (the GL defaults). A responder that used them would
// load the default ambient (0.2, 0.2, 0.2, 1) into local 66 instead of mk's. That was the regression in Codex's first
// hd-state-audit profile run. Hardware CI captures both texture paths from the native JOGL driver.
// Existing RTX 5070 recordings under out/hd-state-audit can also be compared independently.

const PROFILE: CapsProfile = capsProfileFromJson(readFileSync(join(import.meta.dir, 'rtx5070.json'), 'utf8'));

const LIGHT_MODEL_AMBIENT = 2899;
const DRAW_BUFFER = 3073;
const READ_BUFFER = 3074;
const PROGRAM_ERROR_POSITION_ARB = 34379;

// mk.a(0x204080, 0.5f, 0.75f, 0.25f) as GlStateAuditOracle calls it, and the GL default ambient.
const MK_AMBIENT = [0x3d808081, 0x3e008081, 0x3e808081, 0x3f800000];
const DEFAULT_AMBIENT = [0x3e4ccccd, 0x3e4ccccd, 0x3e4ccccd, 0x3f800000];

// The ARB vertex program rd.f()V loads (ldc #22 of rd in runescape_gl.jar): 46 lines, no final line feed.
const WATER_PROGRAM = [
    '!!ARBvp1.0',
    'ATTRIB  iPos         = vertex.position;',
    'ATTRIB  iColour      = vertex.color;',
    'OUTPUT  oPos         = result.position;',
    'OUTPUT  oColour      = result.color;',
    'OUTPUT  oTexCoord0   = result.texcoord[0];',
    'OUTPUT  oTexCoord1   = result.texcoord[1];',
    'OUTPUT  oFogCoord    = result.fogcoord;',
    'PARAM   time         = program.local[65];',
    'PARAM   turbulence   = program.local[64];',
    'PARAM   lightAmbient = program.local[66]; ',
    'PARAM   pMatrix[4]   = { state.matrix.projection };',
    'PARAM   mvMatrix[4]  = { state.matrix.modelview };',
    'PARAM   ivMatrix[4]  = { state.matrix.texture[1] };',
    'PARAM   fNoise[64]   = { program.local[0..63] };',
    'TEMP    noise, clipPos, viewPos, worldPos;',
    'ADDRESS noiseAddr;',
    'DP4   viewPos.x, mvMatrix[0], iPos;',
    'DP4   viewPos.y, mvMatrix[1], iPos;',
    'DP4   viewPos.z, mvMatrix[2], iPos;',
    'DP4   viewPos.w, mvMatrix[3], iPos;',
    'DP4   worldPos.x, ivMatrix[0], viewPos;',
    'DP4   worldPos.y, ivMatrix[1], viewPos;',
    'DP4   worldPos.z, ivMatrix[2], viewPos;',
    'DP4   worldPos.w, ivMatrix[3], viewPos;',
    'ADD   noise.x, worldPos.x, worldPos.z;SUB   noise.y, worldPos.z, worldPos.x;MUL   noise, noise, 0.0001220703125;',
    'FRC   noise, noise;',
    'MUL   noise, noise, 64;',
    'ARL   noiseAddr.x, noise.x;',
    'MOV   noise.x, fNoise[noiseAddr.x].x;',
    'ARL   noiseAddr.x, noise.y;',
    'MOV   noise.y, fNoise[noiseAddr.x].y;',
    'MUL   noise, noise, turbulence.x;',
    'MAD   oTexCoord0, worldPos.xzww, 0.0078125, noise;',
    'MOV   oTexCoord0.w, 1;',
    'MUL   oTexCoord1.xy, worldPos.xzww, 0.0009765625;',
    'MOV   oTexCoord1.zw, time.xxxw;',
    'DP4   clipPos.x, pMatrix[0], viewPos;',
    'DP4   clipPos.y, pMatrix[1], viewPos;',
    'DP4   clipPos.z, pMatrix[2], viewPos;',
    'DP4   clipPos.w, pMatrix[3], viewPos;',
    'MUL   oColour.xyz, iColour, lightAmbient;',
    'MOV   oColour.w, 1;',
    'MOV   oFogCoord.x, clipPos.z;',
    'MOV   oPos, clipPos; ',
    'END'
].join('\n');

// mk.a(IFFF)V from pc 32, after the early return for unchanged arguments: LIGHT_MODEL_AMBIENT, LIGHT0 DIFFUSE and
// LIGHT1 DIFFUSE from the colour and three intensities, in binary32 (i2f is exact for 0..255; fdiv and fmul round).
function mkA(gl: GL, colour: number, ambient: number, diffuse: number, back: number): void {
    const r = Math.fround(((colour >> 16) & 255) / 255);
    const g = Math.fround(((colour >> 8) & 255) / 255);
    const b = Math.fround((colour & 255) / 255);
    const a = new Float32Array([Math.fround(ambient * r), Math.fround(ambient * g), Math.fround(ambient * b), 1]);
    gl.glLightModelfv(LIGHT_MODEL_AMBIENT, a, 0);
    const d = new Float32Array([Math.fround(diffuse * r), Math.fround(diffuse * g), Math.fround(diffuse * b), 1]);
    gl.glLightfv(16384, 4609, d, 0);
    const n = new Float32Array([Math.fround(-back * r), Math.fround(-back * g), Math.fround(-back * b), 1]);
    gl.glLightfv(16385, 4609, n, 0);
}

// rd.a(I)V from pc 8 (the program exists). `volume` is lm.e; `d` is the static rd.d (float[4], rd.<clinit>()V).
function rdA(gl: GL, flags: number, volume: boolean, d: Float32Array): void {
    gl.glActiveTexture(33985);
    if ((flags & 128) === 0) gl.glEnable(volume ? 32879 : 3553);
    else gl.glDisable(volume ? 32879 : 3553);
    gl.glActiveTexture(33984);
    if ((flags & 64) === 0) {
        gl.glGetFloatv(LIGHT_MODEL_AMBIENT, d, 0);
        gl.glProgramLocalParameter4fvARB(34336, 66, d, 0);
    } else {
        gl.glProgramLocalParameter4fARB(34336, 66, 1, 1, 1, 1);
    }
    const turbulence = flags & 3;
    if (turbulence === 2) gl.glProgramLocalParameter4fARB(34336, 64, Math.fround(0.05), 1, 1, 1);
    else if (turbulence === 3) gl.glProgramLocalParameter4fARB(34336, 64, Math.fround(0.1), 1, 1, 1);
    else gl.glProgramLocalParameter4fARB(34336, 64, Math.fround(0.025), 1, 1, 1);
}

// rd.f()V from pc 7 (the program exists): returns what it reads into its new int[1].
function rdF(gl: GL, program: number): number {
    const error = new Int32Array(1);
    gl.glBindProgramARB(34336, program);
    gl.glProgramStringARB(34336, 34933, WATER_PROGRAM.length, WATER_PROGRAM);
    gl.glGetIntegerv(PROGRAM_ERROR_POSITION_ARB, error, 0);
    return arrayAtI32(error, 0);
}

// tf.c(I)V; `state.s` is tf.s.
function tfC(gl: GL, state: { s: number }, texture: number): void {
    if (texture === state.s) return;
    if (texture !== -1) {
        if (state.s === -1) gl.glEnable(3553);
        gl.glBindTexture(3553, texture);
    } else {
        gl.glDisable(3553);
    }
    state.s = texture;
}

// tf.h()V; `width` and `height` are tf.J and tf.A.
function tfH(gl: GL, state: { s: number }, width: number, height: number): void {
    const saved = new Int32Array(2);
    gl.glGetIntegerv(DRAW_BUFFER, saved, 0);
    gl.glGetIntegerv(READ_BUFFER, saved, 1);
    gl.glDrawBuffer(1026);
    gl.glReadBuffer(1024);
    tfC(gl, state, -1);
    gl.glPushAttrib(8192);
    gl.glDisable(2912);
    gl.glDisable(3042);
    gl.glDisable(2929);
    gl.glDisable(3008);
    gl.glRasterPos2i(0, 0);
    gl.glCopyPixels(0, 0, width, height, 6144);
    gl.glPopAttrib();
    gl.glDrawBuffer(arrayAtI32(saved, 0));
    gl.glReadBuffer(arrayAtI32(saved, 1));
}

// GlStateAuditOracle.integer(GL, int): glGetIntegerv into {-1}.
function integer(gl: GL, pname: number): number {
    const value = new Int32Array([-1]);
    gl.glGetIntegerv(pname, value, 0);
    return arrayAtI32(value, 0);
}

function ambientBits(gl: GL): number[] {
    const values = new Float32Array(4);
    gl.glGetFloatv(LIGHT_MODEL_AMBIENT, values, 0);
    return Array.from(new Uint32Array(values.buffer));
}

function open(factory: GLDrawableFactory, capabilities: GLCapabilities): { drawable: GLDrawable; context: GLContext; gl: GL } {
    const drawable = factory.getGLDrawable({}, capabilities, null);
    drawable.setRealized(true);
    const context = drawable.createContext(null);
    context.makeCurrent();
    return { drawable, context, gl: context.getGL() };
}

// The audit oracle's materials() sequence for these reads: the water program (rd.<init>()V: glGenProgramsARB at pc
// 43-56, then rd.f()V at pc 321; its rd.e()V lists at pc 317 are left out), mk.a(0x204080, 0.5f, 0.75f, 0.25f),
// rd.a(0), then tf.h() with FRONT/BACK_LEFT selected and tf.J = tf.A = 32.
// `slices` is the oracle's gltrace.forceSlices run: lm.e is false, and the 2D slice path leaves a texture bound
// (tf.s != -1), so tf.h's tf.c(-1) disables GL_TEXTURE_2D. Which texture is bound does not show in tf.h's records.
function auditReplay(slices: boolean): { text: string; error: number; local66: number[]; draw: number; read: number } {
    const writer = new GlTraceWriter();
    const factory = new RecordingGLDrawableFactory(new NullGLDrawableFactory(PROFILE), writer);
    const { gl } = open(factory, new GLCapabilities());
    const ids = new Int32Array(1);
    gl.glGenProgramsARB(1, ids, 0);
    const error = rdF(gl, arrayAtI32(ids, 0));
    mkA(gl, 0x204080, 0.5, 0.75, 0.25);
    const d = new Float32Array(4);
    rdA(gl, 0, !slices, d);
    writer.mark('water-local-66');
    gl.glDrawBuffer(1028);
    gl.glReadBuffer(1026);
    tfH(gl, { s: slices ? 4 : -1 }, 32, 32);
    const draw = integer(gl, DRAW_BUFFER);
    const read = integer(gl, READ_BUFFER);
    writer.mark('buffers-restored');
    return { text: writer.text(), error, local66: Array.from(new Uint32Array(d.buffer)), draw, read };
}

// Record lines without their ids: hardware and replay number their records differently.
function recordLines(text: string): string[] {
    return parseTrace(text).records.map(r => {
        const line = formatRecordLine(r);
        return line.slice(line.indexOf('\t') + 1);
    });
}

// The n record lines that end with the first line starting with `end`, or null.
function blockEndingAt(lines: readonly string[], end: string, n: number): string[] | null {
    const last = lines.findIndex(l => l.startsWith(end));
    return last < 0 || last + 1 < n ? null : lines.slice(last + 1 - n, last + 1);
}

// The three compared blocks of auditReplay: [first line prefix in the replay, last line prefix].
const BLOCKS = {
    program: ['glBindProgramARB\t34336\t', 'glGetIntegerv\t34379\t'],
    water: ['glLightModelfv\t2899\t', '~mark\twater-local-66'],
    buffers: ['glDrawBuffer\t1028', '~mark\tbuffers-restored']
} as const;
type BlockName = keyof typeof BLOCKS;

function replayBlock(lines: readonly string[], name: BlockName): string[] {
    const [first, last] = BLOCKS[name];
    const start = lines.findIndex(l => l.startsWith(first));
    const end = lines.findIndex(l => l.startsWith(last));
    if (start < 0 || end < start) throw new Error('replay has no ' + name + ' block');
    return lines.slice(start, end + 1);
}

test('the captured profile lists static answers for the read-back pnames, which the responder must not use', () => {
    expect(PROFILE.floats[String(LIGHT_MODEL_AMBIENT)]).toEqual(DEFAULT_AMBIENT.map(b => b.toString(16)));
    expect(PROFILE.integers[String(DRAW_BUFFER)]).toEqual([1029]);
    expect(PROFILE.integers[String(READ_BUFFER)]).toEqual([1029]);
    expect(PROFILE.integers[String(PROGRAM_ERROR_POSITION_ARB)]).toEqual([-1]);
});

test("mk.a(IFFF)V then rd.a(I)V: glGetFloatv(LIGHT_MODEL_AMBIENT) reads back mk's exact bits and register 66 carries them", () => {
    const replay = auditReplay(false);
    expect(replay.local66).toEqual(MK_AMBIENT);
    const water = replayBlock(recordLines(replay.text), 'water');
    expect(water).toEqual([
        'glLightModelfv\t2899\tfv:3d808081,3e008081,3e808081,3f800000\t0',
        'glLightfv\t16384\t4609\tfv:3dc0c0c2,3e40c0c2,3ec0c0c2,3f800000\t0',
        'glLightfv\t16385\t4609\tfv:bd008081,bd808081,be008081,3f800000\t0',
        'glActiveTexture\t33985',
        'glEnable\t32879',
        'glActiveTexture\t33984',
        'glGetFloatv\t2899\tfv:3d808081,3e008081,3e808081,3f800000\t0',
        'glProgramLocalParameter4fvARB\t34336\t66\tfv:3d808081,3e008081,3e808081,3f800000\t0',
        'glProgramLocalParameter4fARB\t34336\t64\tf:3ccccccd\tf:3f800000\tf:3f800000\tf:3f800000',
        '~mark\twater-local-66'
    ]);

    // The read-back follows every glLightModelfv: mk.f()V's default sun (mk.a(mk.k, 1.1523438f, 0.69921875f, 1.2f)),
    // then a rd.a with every flag (128: disable, 64: local 66 is 1,1,1,1, 3: turbulence 0.1f), then rd.a(2) again.
    const writer = new GlTraceWriter();
    const { gl } = open(new RecordingGLDrawableFactory(new NullGLDrawableFactory(PROFILE), writer), new GLCapabilities());
    const d = new Float32Array(4);
    expect(ambientBits(gl)).toEqual(DEFAULT_AMBIENT);
    mkA(gl, 16777215, Math.fround(1.1523438), Math.fround(0.69921875), Math.fround(1.2));
    rdA(gl, 128 | 64 | 3, false, d);
    rdA(gl, 2, false, d);
    expect(Array.from(new Uint32Array(d.buffer))).toEqual([0x3f938000, 0x3f938000, 0x3f938000, 0x3f800000]);
    expect(recordLines(writer.text()).filter(l => /^glProgramLocalParameter4f|^glGetFloatv|^glLightModelfv|^gl(En|Dis)able/.test(l))).toEqual([
        'glGetFloatv\t2899\tfv:3e4ccccd,3e4ccccd,3e4ccccd,3f800000\t0',
        'glLightModelfv\t2899\tfv:3f938000,3f938000,3f938000,3f800000\t0',
        'glDisable\t3553',
        'glProgramLocalParameter4fARB\t34336\t66\tf:3f800000\tf:3f800000\tf:3f800000\tf:3f800000',
        'glProgramLocalParameter4fARB\t34336\t64\tf:3dcccccd\tf:3f800000\tf:3f800000\tf:3f800000',
        'glEnable\t3553',
        'glGetFloatv\t2899\tfv:3f938000,3f938000,3f938000,3f800000\t0',
        'glProgramLocalParameter4fvARB\t34336\t66\tfv:3f938000,3f938000,3f938000,3f800000\t0',
        'glProgramLocalParameter4fARB\t34336\t64\tf:3d4ccccd\tf:3f800000\tf:3f800000\tf:3f800000'
    ]);

    // Bits, not values: a NaN payload, -0, the smallest denormal and -infinity come back unchanged.
    const odd = [0x7fa00001, 0x80000000, 0x00000001, 0xff800000];
    gl.glLightModelfv(LIGHT_MODEL_AMBIENT, new Float32Array(new Uint32Array([0, ...odd]).buffer), 1);
    rdA(gl, 0, false, d);
    expect(Array.from(new Uint32Array(d.buffer))).toEqual(odd);
    expect(recordLines(writer.text()).at(-2)).toBe('glProgramLocalParameter4fvARB\t34336\t66\tfv:7fa00001,80000000,00000001,ff800000\t0');
    // Only a full LIGHT_MODEL_AMBIENT vector at a valid offset changes the state (section 16).
    gl.glLightModelfv(LIGHT_MODEL_AMBIENT, new Float32Array([7, 7, 7]), 0);
    gl.glLightModelfv(2898, new Float32Array([7, 7, 7, 7]), 0);
    expect(ambientBits(gl)).toEqual(odd);
});

test('tf.h()V saves DRAW_BUFFER and READ_BUFFER, copies FRONT_LEFT into BACK_LEFT and restores the saved pair', () => {
    const replay = auditReplay(false);
    expect([replay.draw, replay.read]).toEqual([1028, 1026]);
    expect(replayBlock(recordLines(replay.text), 'buffers')).toEqual([
        'glDrawBuffer\t1028',
        'glReadBuffer\t1026',
        'glGetIntegerv\t3073\tiv:1028\t0',
        'glGetIntegerv\t3074\tiv:1026\t1',
        'glDrawBuffer\t1026',
        'glReadBuffer\t1024',
        'glPushAttrib\t8192',
        'glDisable\t2912',
        'glDisable\t3042',
        'glDisable\t2929',
        'glDisable\t3008',
        'glRasterPos2i\t0\t0',
        'glCopyPixels\t0\t0\t32\t32\t6144',
        'glPopAttrib',
        'glDrawBuffer\t1028',
        'glReadBuffer\t1026',
        'glGetIntegerv\t3073\tiv:1028\t0',
        'glGetIntegerv\t3074\tiv:1026\t0',
        '~mark\tbuffers-restored'
    ]);

    // From the defaults: BACK/BACK on a double-buffered drawable, FRONT/FRONT on a single-buffered one. tf.c(-1)
    // disables GL_TEXTURE_2D when a texture is bound (tf.s != -1).
    const writer = new GlTraceWriter();
    const factory = new RecordingGLDrawableFactory(new NullGLDrawableFactory(PROFILE), writer);
    const back = open(factory, new GLCapabilities()).gl;
    tfH(back, { s: 7 }, 765, 503);
    expect([integer(back, DRAW_BUFFER), integer(back, READ_BUFFER)]).toEqual([1029, 1029]);
    const single = new GLCapabilities();
    single.setDoubleBuffered(false);
    const front = open(factory, single).gl;
    tfH(front, { s: -1 }, 765, 503);
    expect([integer(front, DRAW_BUFFER), integer(front, READ_BUFFER)]).toEqual([1028, 1028]);
    const lines = recordLines(writer.text());
    expect(lines.filter(l => /^gl(GetIntegerv\t307[34]|DrawBuffer|ReadBuffer|Disable\t3553)/.test(l))).toEqual([
        'glGetIntegerv\t3073\tiv:1029\t0',
        'glGetIntegerv\t3074\tiv:1029\t1',
        'glDrawBuffer\t1026',
        'glReadBuffer\t1024',
        'glDisable\t3553',
        'glDrawBuffer\t1029',
        'glReadBuffer\t1029',
        'glGetIntegerv\t3073\tiv:1029\t0',
        'glGetIntegerv\t3074\tiv:1029\t0',
        'glGetIntegerv\t3073\tiv:1028\t0',
        'glGetIntegerv\t3074\tiv:1028\t1',
        'glDrawBuffer\t1026',
        'glReadBuffer\t1024',
        'glDrawBuffer\t1028',
        'glReadBuffer\t1028',
        'glGetIntegerv\t3073\tiv:1028\t0',
        'glGetIntegerv\t3074\tiv:1028\t0'
    ]);
});

test('rd.f()V: PROGRAM_ERROR_POSITION_ARB reads -1 after the water program, and after any program string', () => {
    const replay = auditReplay(false);
    expect(replay.error).toBe(-1);
    // The S token pins the transcribed program: its SHA-256 is the one in the hardware trace's glProgramStringARB.
    expect(replayBlock(recordLines(replay.text), 'program')).toEqual([
        'glBindProgramARB\t34336\t#P1',
        'glProgramStringARB\t34336\t34933\t1736\tS:1736:05b4a0e72fd47dddd64ec397b735a871b1510d8c0cd0693189495d18f6a553ce',
        'glGetIntegerv\t34379\tiv:-1\t0'
    ]);

    const writer = new GlTraceWriter();
    const { gl } = open(new RecordingGLDrawableFactory(new NullGLDrawableFactory(PROFILE), writer), new GLCapabilities());
    gl.glProgramStringARB(34336, 34933, 7, 'garbage');
    const value = new Int32Array([12345, 12345]);
    gl.glGetIntegerv(PROGRAM_ERROR_POSITION_ARB, value, 1);
    expect(Array.from(value)).toEqual([12345, -1]);
});

test("read-back state is per context: two GLs from one factory never see each other's ambient or buffer selectors", () => {
    const writer = new GlTraceWriter();
    const factory = new RecordingGLDrawableFactory(new NullGLDrawableFactory(PROFILE), writer);
    const first = open(factory, new GLCapabilities());
    const single = new GLCapabilities();
    single.setDoubleBuffered(false);
    const second = open(factory, single);

    first.context.makeCurrent();
    mkA(first.gl, 0x204080, 0.5, 0.75, 0.25);
    first.gl.glDrawBuffer(1028);
    first.gl.glReadBuffer(1026);

    second.context.makeCurrent();
    expect(ambientBits(second.gl)).toEqual(DEFAULT_AMBIENT);
    expect([integer(second.gl, DRAW_BUFFER), integer(second.gl, READ_BUFFER)]).toEqual([1028, 1028]);
    second.gl.glLightModelfv(LIGHT_MODEL_AMBIENT, new Float32Array([0.25, 0.5, 0.75, 1]), 0);
    second.gl.glDrawBuffer(1029);
    second.gl.glReadBuffer(1024);
    expect(integer(second.gl, PROGRAM_ERROR_POSITION_ARB)).toBe(-1);

    first.context.makeCurrent();
    const d = new Float32Array(4);
    rdA(first.gl, 0, true, d);
    expect(Array.from(new Uint32Array(d.buffer))).toEqual(MK_AMBIENT);
    expect([integer(first.gl, DRAW_BUFFER), integer(first.gl, READ_BUFFER)]).toEqual([1028, 1026]);
    expect(integer(first.gl, PROGRAM_ERROR_POSITION_ARB)).toBe(-1);

    second.context.makeCurrent();
    expect(ambientBits(second.gl)).toEqual([0x3e800000, 0x3f000000, 0x3f400000, 0x3f800000]);
    expect([integer(second.gl, DRAW_BUFFER), integer(second.gl, READ_BUFFER)]).toEqual([1029, 1024]);

    // A second context on the first drawable starts from the defaults too: the state belongs to the context's GL,
    // not to the drawable.
    const third = first.drawable.createContext(null);
    expect(third.makeCurrent()).toBe(2);
    const thirdGL = third.getGL();
    expect(ambientBits(thirdGL)).toEqual(DEFAULT_AMBIENT);
    expect([integer(thirdGL, DRAW_BUFFER), integer(thirdGL, READ_BUFFER)]).toEqual([1029, 1029]);

    // The trace shows each switch of receiver.
    expect(recordLines(writer.text()).filter(l => l.startsWith('~gl\t'))).toEqual(['~gl\t@G1', '~gl\t@G2', '~gl\t@G1', '~gl\t@G2', '~gl\t@G3']);
});

function compareHardwareTrace(file: string, slices: boolean, blocks: readonly BlockName[]): void {
    const hardware = recordLines(readFileSync(file, 'utf8'));
    const replay = recordLines(auditReplay(slices).text);
    for (const name of blocks) {
        const expected = replayBlock(replay, name);
        expect(blockEndingAt(hardware, BLOCKS[name][1], expected.length), file + ' ' + name).toEqual(expected);
    }
}

if (process.env.RS530_NATIVE_GL_TRACE === '1') {
    test('the active native JOGL driver matches the replay on volume and sliced water textures', async () => {
        const { hdGamepackPath, joglPath } = await import('../render/hd-reference.js');
        const natives = process.env.JOGL_NATIVES_530 || join(dirname(hdGamepackPath), 'natives', 'windows-amd64');
        const work = mkdtempSync(join(tmpdir(), 'rs530-gl-state-'));
        try {
            const cp = [work, hdGamepackPath, joglPath].join(delimiter);
            const build = Bun.spawnSync(['javac', '-encoding', 'UTF-8', '-cp', cp, '-d', work, join(import.meta.dir, 'GlRecorder.java'), join(import.meta.dir, 'GlStateAuditOracle.java')]);
            expect(build.exitCode, build.stderr.toString()).toBe(0);
            for (const slices of [false, true]) {
                const dest = join(work, slices ? 'slices' : 'volume');
                const run = Bun.spawnSync(['java', '--add-exports=java.desktop/sun.awt=ALL-UNNAMED', '--add-exports=java.desktop/sun.awt.windows=ALL-UNNAMED', '-Dgltrace.forceSlices=' + slices, '-cp', cp, 'GlStateAuditOracle', dest, natives]);
                expect(run.exitCode, run.stdout.toString() + run.stderr.toString()).toBe(0);
                compareHardwareTrace(join(dest, 'trace.tsv'), slices, ['program', 'water', 'buffers']);
            }
        } finally {
            rmSync(work, { recursive: true, force: true });
        }
    }, 60000);
}

// Archived RTX captures. rtx-slices is the gltrace.forceSlices run; rtx has no tf.h
// records; rtx-default's mk values come from mk.f()V, so only its program and tf.h blocks are compared.
const archived: readonly { dir: string; slices: boolean; blocks: readonly BlockName[] }[] = [
    { dir: 'rtx', slices: false, blocks: ['program', 'water'] },
    { dir: 'rtx-stateful', slices: false, blocks: ['program', 'water', 'buffers'] },
    { dir: 'rtx-volume', slices: false, blocks: ['program', 'water', 'buffers'] },
    { dir: 'rtx-slices', slices: true, blocks: ['program', 'water', 'buffers'] },
    { dir: 'rtx-default', slices: false, blocks: ['program', 'buffers'] }
];

for (const { dir, slices, blocks } of archived) {
    const file = join(import.meta.dir, '../../out/hd-state-audit', dir, 'trace.tsv');
    if (existsSync(file)) test('GL state agrees with the archived RTX 5070 capture ' + dir, () => compareHardwareTrace(file, slices, blocks));
}
