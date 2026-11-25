import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { requireNonNull } from '#/util/JavaArray.js';
import { capsProfileFromJson, FALLBACK_CAPS_PROFILE, RADEON_CAPS_PROFILE, type CapsProfile } from '#/gl/CapsProfile.js';
import { GLX as E, GlUnsupported } from '#/gl/driver/GlEnums.js';
import DrawPass from '#/gl/driver/DrawPass.js';
import GlState, { ArrayPointer, identity, invert, multiply, transformPoint } from '#/gl/driver/GlState.js';
import { includeClientPointer, type ClientVertexRange } from '#/gl/driver/ClientVertexRange.js';
import { BufferObject } from '#/gl/driver/BufferObject.js';
import { TextureObject, unpackImage } from '#/gl/driver/TextureObject.js';
import WebGpuGL, { WATER_PROGRAM_SHA256 } from '#/gl/driver/WebGpuGL.js';
import { GlTraceWriter, sha256Hex } from '#/gl/GlTrace.js';
import NullGL from '#/gl/NullGL.js';
import RecordingGL from '#/gl/RecordingGL.js';
import type { GL } from '#/jogl/GL.js';
import GLContext from '#/jogl/GLContext.js';
import GLException from '#/jogl/GLException.js';
import GLU from '#/jogl/GLU.js';
import ByteBuffer from '#/util/nio/ByteBuffer.js';
import ByteOrder from '#/util/nio/ByteOrder.js';
import FloatBuffer from '#/util/nio/FloatBuffer.js';
import IntBuffer from '#/util/nio/IntBuffer.js';

// Driver step of HD batch H1 (HD_PLAN 4): the WebGpuGL state mirror against GL semantics, with no GPU (a WebGpuGL made
// without a drawable keeps all CPU state). The GPU half (clears, swaps, uploads) is driver-gpu.test.ts.

const rtx = capsProfileFromJson(readFileSync(join(import.meta.dir, 'rtx5070.json'), 'utf8'));
const bits = (f: Float32Array) => [...new Uint32Array(f.buffer, f.byteOffset, f.length)].map(v => v.toString(16).padStart(8, '0'));

function gl(profile: CapsProfile = FALLBACK_CAPS_PROFILE): WebGpuGL {
    return new WebGpuGL(profile);
}

function expectMatrixClose(actual: ArrayLike<number>, expected: ArrayLike<number>): void {
    for (let i = 0; i < 16; i++) expect(actual[i]).toBeCloseTo(expected[i], 5);
}

describe('matrices', () => {
    test('glTranslate/glRotate/glScale post-multiply the current matrix in call order (C = C * M)', () => {
        const g = gl();
        g.glMatrixMode(E.GL_MODELVIEW);
        g.glLoadIdentity();
        g.glTranslatef(1, 2, 3);
        g.glRotatef(90, 0, 0, 1);
        g.glScalef(2, 2, 2);
        // M * (1,0,0,1) = T * R * (2,0,0,1) = T * (0,2,0,1) = (1,4,3,1)
        const p = transformPoint(g.state.modelview, [1, 0, 0, 1]);
        expect(p[0]).toBeCloseTo(1, 5);
        expect(p[1]).toBeCloseTo(4, 5);
        expect(p[2]).toBeCloseTo(3, 5);
        expect(p[3]).toBe(1);
    });

    test('glRotatef normalises the axis and uses degrees; glOrtho builds the GL matrix', () => {
        const g = gl();
        g.glRotatef(180, 0, 0, 5);
        const p = transformPoint(g.state.modelview, [1, 0, 0, 1]);
        expect(p[0]).toBeCloseTo(-1, 6);
        expect(p[1]).toBeCloseTo(0, 6);
        g.glMatrixMode(E.GL_PROJECTION);
        g.glLoadIdentity();
        g.glOrtho(0, 800, 600, 0, -1, 1);
        const q = transformPoint(g.state.projection, [800, 600, 0.5, 1]);
        [1, -1, -0.5, 1].forEach((v, i) => expect(q[i]).toBeCloseTo(v, 6));
        g.glOrtho(0, 0, 1, 2, 3, 4);
        expect(g.glGetError()).toBe(E.GL_INVALID_VALUE);
    });

    test('glLoadMatrixf copies raw bits and glPushMatrix/glPopMatrix restore', () => {
        const g = gl();
        const m = new Float32Array(20);
        for (let i = 0; i < 16; i++) m[i + 4] = i + 0.5;
        new Uint32Array(m.buffer)[4] = 0x7fc12345; // NaN payload
        g.glLoadMatrixf(m, 4);
        expect(new Uint32Array(g.state.modelview.buffer)[0]).toBe(0x7fc12345);
        g.glPushMatrix();
        g.glLoadIdentity();
        g.glTranslatef(5, 0, 0);
        g.glPopMatrix();
        expect(g.state.modelview[15]).toBe(15.5);
        expect(g.state.modelviewStack).toHaveLength(1);
    });

    test('stack overflow and underflow are GL errors that change nothing', () => {
        const g = gl();
        g.glMatrixMode(E.GL_PROJECTION);
        for (let i = 0; i < 4; i++) g.glPushMatrix();
        expect(g.glGetError()).toBe(E.GL_STACK_OVERFLOW);
        expect(g.state.projectionStack).toHaveLength(4);
        g.glMatrixMode(E.GL_MODELVIEW);
        g.glPopMatrix();
        expect(g.glGetError()).toBe(E.GL_STACK_UNDERFLOW);
        expect(g.glGetError()).toBe(E.GL_NO_ERROR);
    });

    test("MatrixMode(TEXTURE) selects the active unit's texture stack", () => {
        const g = gl();
        g.glActiveTexture(E.GL_TEXTURE1);
        g.glMatrixMode(E.GL_TEXTURE);
        g.glLoadIdentity();
        g.glRotatef(22.5, 1, 0, 0);
        g.glMatrixMode(E.GL_MODELVIEW);
        expect([...g.state.textureMatrix(0)]).toEqual([...identity()]);
        expect([...g.state.textureMatrix(2)]).toEqual([...identity()]);
        expect(g.state.textureMatrix(1)[5]).toBeCloseTo(Math.cos((22.5 * Math.PI) / 180), 6);
        expect([...g.state.modelview]).toEqual([...identity()]);
    });

    test('invert and multiply agree', () => {
        const m = identity();
        const s = new GlState(4, true);
        s.translate(3, -2, 7);
        s.rotate(33, 1, 2, 3);
        s.scale(2, 0.5, 4);
        m.set(s.modelview);
        const inv = Float32Array.from(requireInverse(m));
        expectMatrixClose(multiply(new Float32Array(16), m, inv), identity());
    });
});

function requireInverse(m: Float32Array): Float64Array {
    const inv = invert(m);
    if (inv === null) throw new Error('singular');
    return inv;
}

test('drawable pass state follows interleaved indexed, blit and clear commands and resets on a new pass', () => {
    const calls: string[] = [];
    const raw = {
        setPipeline: (p: unknown) => calls.push('pipeline ' + p),
        setBindGroup: (i: number, g: unknown, offsets?: Uint32Array) => calls.push('group ' + i + ' ' + g + ' ' + (offsets?.[0] ?? '-')),
        setVertexBuffer: (i: number, b: unknown, at: number, size?: number) => calls.push('vertex ' + i + ' ' + b + ' ' + at + ' ' + (size ?? '-')),
        setIndexBuffer: () => calls.push('indices'),
        setViewport: () => calls.push('viewport'),
        setScissorRect: (_x: number, _y: number, width: number) => calls.push('scissor ' + width),
        draw: () => calls.push('draw'),
        drawIndexed: (_n: number, _instances: number, first: number) => calls.push('indexed ' + first),
        end: () => calls.push('end')
    } as unknown as GPURenderPassEncoder;
    const model = 'model' as unknown as GPURenderPipeline,
        blit = 'blit' as unknown as GPURenderPipeline;
    const texture = 'texture' as unknown as GPUBindGroup,
        colour = 'clear' as unknown as GPUBindGroup;
    const buffer = 'vbo' as unknown as GPUBuffer;
    const pass = new DrawPass(raw);
    function indexed(p: DrawPass, first: number): void {
        p.setPipeline(model);
        p.setBindGroup(0, texture);
        p.setVertexBuffer(0, buffer, 0);
        p.setIndexBuffer(buffer, 'uint32');
        p.setViewport(0, 0, 765, 503, 0, 1);
        p.setScissorRect(0, 0, 765, 503);
        p.drawIndexed(3, first);
    }
    indexed(pass, 0);
    indexed(pass, 3);
    pass.setPipeline(blit);
    pass.setBindGroup(0, colour, 0);
    pass.setBindGroup(0, colour, 256);
    pass.setVertexBuffer(0, buffer, 0, 16);
    pass.setScissorRect(2, 0, 50, 503);
    pass.draw(3);
    indexed(pass, 6);
    pass.end();
    indexed(new DrawPass(raw), 9);
    expect(calls).toEqual([
        'pipeline model',
        'group 0 texture -',
        'vertex 0 vbo 0 -',
        'indices',
        'viewport',
        'scissor 765',
        'indexed 0',
        'indexed 3',
        'pipeline blit',
        'group 0 clear 0',
        'group 0 clear 256',
        'vertex 0 vbo 0 16',
        'scissor 50',
        'draw',
        'pipeline model',
        'group 0 texture -',
        'vertex 0 vbo 0 -',
        'scissor 765',
        'indexed 6',
        'end',
        'pipeline model',
        'group 0 texture -',
        'vertex 0 vbo 0 -',
        'indices',
        'viewport',
        'scissor 765',
        'indexed 9'
    ]);
});

test('client vertex uploads use captured NIO addresses and only the indexed interleaved range', () => {
    const positions = ByteBuffer.allocateDirect(38400);
    const position = new ArrayPointer(),
        colour = new ArrayPointer();
    const ranges = new Map<ByteBuffer | FloatBuffer, ClientVertexRange>();
    position.set(3, E.GL_FLOAT, 12, 0, 0, positions);
    includeClientPointer(ranges, positions, position, 45);
    expect(ranges.get(positions)).toEqual({ start: 0, end: 552 });
    // Both pointers address different components in the same record. Their NIO positions were
    // captured at different times. Later changes to position/limit do not move either GL pointer.
    ranges.clear();
    positions.position(32);
    position.set(3, E.GL_FLOAT, 20, 0, 0, positions);
    positions.position(44);
    colour.set(4, E.GL_UNSIGNED_BYTE, 20, 0, 0, positions);
    positions.position(0).limit(4);
    includeClientPointer(ranges, positions, colour, 3);
    includeClientPointer(ranges, positions, position, 3);
    expect(ranges.get(positions)).toEqual({ start: 32, end: 108 });
    const floats = FloatBuffer.allocate(40);
    floats.position(2);
    position.set(2, E.GL_FLOAT, 0, 0, 4, floats);
    includeClientPointer(ranges, floats, position, 12);
    expect(ranges.get(floats)).toEqual({ start: 12, end: 116 });
    expect(() => includeClientPointer(ranges, floats, position, 18)).toThrow(RangeError);
    // Unaligned input is repacked through DataView, so it has no shared GPU range.
    ranges.clear();
    colour.set(3, E.GL_UNSIGNED_BYTE, 3, 0, 1, positions);
    includeClientPointer(ranges, positions, colour, 3);
    expect(ranges.size).toBe(0);
    expect(() => includeClientPointer(ranges, positions, colour, 0xffffffff)).toThrow(RangeError);

    const elements = new BufferObject(1);
    const bytes = new Uint8Array(Uint32Array.of(9, 45, 3, 161, 5).buffer);
    elements.setData(bytes.length, bytes, E.GL_STATIC_DRAW);
    expect(elements.highestIndex(4, 2)).toBe(45);
    expect(elements.highestIndex(4, 3)).toBe(161);
    elements.setSubData(12, new Uint8Array(Uint32Array.of(21).buffer));
    expect(elements.highestIndex(4, 3)).toBe(45);
    elements.setData(4, new Uint8Array(Uint32Array.of(7).buffer), E.GL_STATIC_DRAW);
    expect(elements.highestIndex(0, 1)).toBe(7);
});

test('cached shader keys follow active combiner operands and restore their previous identity', () => {
    const state = new GlState(3, true),
        env = state.unit.env;
    const modulate = env.shaderKey();
    const ids = new Map<string, number>();
    const modulateId = env.indexedCombinerId(ids);
    expect(new GlState(3, true).unit.env.indexedCombinerId(ids)).toBe(modulateId);
    state.setTexEnvEnum(E.GL_TEXTURE_ENV_MODE, E.GL_COMBINE);
    state.setTexEnvEnum(E.GL_COMBINE_RGB, E.GL_REPLACE);
    const replace = env.shaderKey();
    const replaceId = env.indexedCombinerId(ids);
    expect(replaceId).not.toBe(modulateId);
    expect(replace).not.toBe(modulate);
    state.setTexEnvEnum(E.GL_SOURCE2_RGB, E.GL_CONSTANT);
    state.setTexEnvColor(Float32Array.of(1, 0.5, 0, 1), 0);
    expect(env.shaderKey()).toBe(replace);
    expect(env.indexedCombinerId(ids)).toBe(replaceId);
    state.setTexEnvEnum(E.GL_COMBINE_RGB, E.GL_INTERPOLATE);
    const interpolate = env.shaderKey();
    const indexed = env.shaderKey(false);
    const interpolateId = env.indexedCombinerId(ids);
    expect(interpolateId).not.toBe(replaceId);
    expect(env.usesConstantColor()).toBe(true);
    state.setTexEnvColor(Float32Array.of(0, 0.5, 0, 1), 0);
    expect(env.shaderKey()).not.toBe(interpolate);
    expect(env.shaderKey(false)).toBe(indexed);
    expect(env.indexedCombinerId(ids)).toBe(interpolateId);
    expect(env.indexedCombinerId(new Map())).toBe(1);
    expect(env.indexedCombinerId(ids)).toBe(interpolateId);
    state.setTexEnvScale(E.GL_ALPHA_SCALE, 2);
    state.setTexEnvEnum(E.GL_TEXTURE_ENV_MODE, E.GL_MODULATE);
    expect(env.shaderKey()).toBe(modulate);
    expect(env.usesConstantColor()).toBe(false);
    state.setTexEnvEnum(E.GL_TEXTURE_ENV_MODE, E.GL_COMBINE);
    state.setTexEnvScale(E.GL_ALPHA_SCALE, 1);
    state.setTexEnvColor(Float32Array.of(1, 0.5, 0, 1), 0);
    expect(env.shaderKey()).toBe(interpolate);
});

describe('texgen and lights are taken to eye space when specified', () => {
    test('EYE_PLANE is multiplied by the inverse modelview at specification; OBJECT_PLANE is stored as given', () => {
        const g = gl();
        g.glTranslatef(0, 0, -10);
        g.glTexGenfv(E.GL_S, E.GL_EYE_PLANE, Float32Array.of(9, 9, 0, 0, 1, 0), 2);
        expect([...g.state.unit.gen[0].eyePlane]).toEqual([0, 0, 1, 10]);
        // The eye-space plane gives the same value at a transformed point as the original plane at the object point.
        const obj = [3, 4, 5, 1];
        const eye = transformPoint(g.state.modelview, obj);
        const pe = g.state.unit.gen[0].eyePlane;
        expect(pe[0] * eye[0] + pe[1] * eye[1] + pe[2] * eye[2] + pe[3] * eye[3]).toBeCloseTo(5, 5);
        // Later modelview changes do not move a plane already specified.
        g.glLoadIdentity();
        expect([...g.state.unit.gen[0].eyePlane]).toEqual([0, 0, 1, 10]);
        g.glTexGenfv(E.GL_T, E.GL_OBJECT_PLANE, Float32Array.of(0.5, 0, 0.25, 0), 0);
        expect([...g.state.unit.gen[1].objectPlane]).toEqual([0.5, 0, 0.25, 0]);
        // Initial planes: S = (1,0,0,0), T = (0,1,0,0), R = Q = 0, eye planes untransformed.
        const fresh = gl().state.unit.gen;
        expect([...fresh[0].eyePlane, ...fresh[1].objectPlane, ...fresh[2].eyePlane, ...fresh[3].objectPlane]).toEqual([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    });

    test('eye planes follow direct matrix edits, aliased inputs and singular raw float words', () => {
        const g = gl();
        const state = g.state;
        const plane = state.unit.gen[0].eyePlane;
        const bits = new Uint32Array(plane.buffer, plane.byteOffset, plane.length);
        g.glRotatef(33, 0, 1, 0);
        g.glTranslatef(10, 20, 30);
        for (const tz of [17, 17, -25]) {
            state.modelview[14] = tz;
            const inv = requireNonNull(invert(state.modelview));
            plane.set([1, 2, 3, -4]);
            const expected = Float32Array.from([0, 4, 8, 12], j => plane[0] * inv[j] + plane[1] * inv[j + 1] + plane[2] * inv[j + 2] + plane[3] * inv[j + 3]);
            g.glTexGenfv(E.GL_S, E.GL_EYE_PLANE, plane, 0);
            expect(bits).toEqual(new Uint32Array(expected.buffer));
        }
        const unusual = Uint32Array.of(0x7fa12345, 0xffc12345, 0x80000000, 0);
        state.modelview.fill(0);
        g.glTexGenfv(E.GL_S, E.GL_EYE_PLANE, new Float32Array(unusual.buffer), 0);
        expect(bits).toEqual(unusual);
        expect(() => g.glTexGenfv(E.GL_S, E.GL_EYE_PLANE, new Float32Array(3), 0)).toThrow(RangeError);
        expect(bits).toEqual(unusual);
    });

    test('texgen state is per unit and NORMAL_MAP on Q is INVALID_ENUM', () => {
        const g = gl();
        g.glActiveTexture(E.GL_TEXTURE1);
        g.glTexGeni(E.GL_S, E.GL_TEXTURE_GEN_MODE, E.GL_NORMAL_MAP);
        g.glEnable(E.GL_TEXTURE_GEN_S);
        g.glTexGeni(E.GL_Q, E.GL_TEXTURE_GEN_MODE, E.GL_NORMAL_MAP);
        expect(g.glGetError()).toBe(E.GL_INVALID_ENUM);
        expect(g.state.units[1].gen[0].mode).toBe(E.GL_NORMAL_MAP);
        expect(g.state.units[1].gen[3].mode).toBe(E.GL_EYE_LINEAR);
        expect(g.state.units[1].genEnabled).toEqual([true, false, false, false]);
        expect(g.state.units[0].gen[0].mode).toBe(E.GL_EYE_LINEAR);
        expect(g.state.units[0].genEnabled).toEqual([false, false, false, false]);
    });

    test('light POSITION is transformed by the modelview at specification; colours are unclamped', () => {
        const g = gl();
        g.glRotatef(90, 0, 1, 0);
        g.glLightfv(E.GL_LIGHT0, E.GL_POSITION, Float32Array.of(1, 0, 0, 0), 0);
        const p = g.state.lights[0].position;
        expect(p[0]).toBeCloseTo(0, 6);
        expect(p[2]).toBeCloseTo(-1, 6);
        expect(p[3]).toBe(0);
        g.glLoadIdentity();
        g.glTranslatef(10, 20, 30);
        g.glLightfv(E.GL_LIGHT4, E.GL_POSITION, Float32Array.of(1, 2, 3, 1), 0);
        expect([...g.state.lights[4].position]).toEqual([11, 22, 33, 1]);
        g.glLightfv(E.GL_LIGHT1, E.GL_DIFFUSE, Float32Array.of(-1.2, -1.2, -1.2, 1), 0);
        expect(g.state.lights[1].diffuse[0]).toBe(Math.fround(-1.2));
        g.glLightf(E.GL_LIGHT5, E.GL_LINEAR_ATTENUATION, 0);
        g.glLightf(E.GL_LIGHT5, E.GL_CONSTANT_ATTENUATION, 0);
        expect([g.state.lights[5].constantAttenuation, g.state.lights[5].linearAttenuation]).toEqual([0, 0]);
        g.glLightf(E.GL_LIGHT5, E.GL_QUADRATIC_ATTENUATION, -1);
        expect(g.glGetError()).toBe(E.GL_INVALID_VALUE);
        // GL initial light colours: LIGHT0 diffuse white, the others black.
        expect([...gl().state.lights[0].diffuse, ...gl().state.lights[6].diffuse]).toEqual([1, 1, 1, 1, 0, 0, 0, 1]);
    });
});

describe('attrib stack', () => {
    test('PushAttrib(ENABLE_BIT) saves every enable, per unit too, and PopAttrib restores them', () => {
        const g = gl();
        g.glEnable(E.GL_FOG);
        g.glEnable(E.GL_BLEND);
        g.glActiveTexture(E.GL_TEXTURE1);
        g.glEnable(E.GL_TEXTURE_3D);
        g.glEnable(E.GL_TEXTURE_GEN_R);
        g.glActiveTexture(E.GL_TEXTURE0);
        g.glPushAttrib(E.GL_ENABLE_BIT);
        g.glDisable(E.GL_FOG);
        g.glDisable(E.GL_BLEND);
        g.glEnable(E.GL_DEPTH_TEST);
        g.glEnable(E.GL_VERTEX_PROGRAM_ARB);
        g.glActiveTexture(E.GL_TEXTURE1);
        g.glDisable(E.GL_TEXTURE_3D);
        g.glDisable(E.GL_TEXTURE_GEN_R);
        g.glDepthFunc(E.GL_LEQUAL);
        g.glPopAttrib();
        const s = g.state;
        expect([s.isEnabled(E.GL_FOG), s.isEnabled(E.GL_BLEND), s.isEnabled(E.GL_DEPTH_TEST), s.isEnabled(E.GL_VERTEX_PROGRAM_ARB)]).toEqual([true, true, false, false]);
        expect(s.units[1].targetEnabled.get(E.GL_TEXTURE_3D)).toBe(true);
        expect(s.units[1].genEnabled[2]).toBe(true);
        // Not in ENABLE_BIT: the active texture unit and the depth function stay as set.
        expect(s.activeTexture).toBe(1);
        expect(s.depthFunc).toBe(E.GL_LEQUAL);
    });

    test('PushAttrib(FOG_BIT) saves the fog enable and parameters only', () => {
        const g = gl();
        g.glEnable(E.GL_FOG);
        g.glFogi(E.GL_FOG_MODE, E.GL_LINEAR);
        g.glFogf(E.GL_FOG_START, 3072);
        g.glFogf(E.GL_FOG_END, 3328);
        g.glFogfv(E.GL_FOG_COLOR, Float32Array.of(0.25, 0.5, 2, -1), 0);
        expect([...g.state.fog.color]).toEqual([0.25, 0.5, 1, 0]); // clamped when specified
        g.glPushAttrib(E.GL_FOG_BIT);
        g.glDisable(E.GL_FOG);
        g.glFogf(E.GL_FOG_START, 1);
        g.glFogfv(E.GL_FOG_COLOR, Float32Array.of(0, 0, 0, 0), 0);
        g.glDisable(E.GL_BLEND);
        g.glEnable(E.GL_DEPTH_TEST);
        g.glPopAttrib();
        const s = g.state;
        expect(s.isEnabled(E.GL_FOG)).toBe(true);
        expect([s.fog.mode, s.fog.start, s.fog.end]).toEqual([E.GL_LINEAR, 3072, 3328]);
        expect([...s.fog.color]).toEqual([0.25, 0.5, 1, 0]);
        expect(s.isEnabled(E.GL_DEPTH_TEST)).toBe(true);
        g.glPopAttrib();
        expect(g.glGetError()).toBe(E.GL_STACK_UNDERFLOW);
    });

    test('tf.h()V order: save read/draw buffers, push ENABLE_BIT, disable, pop, restore', () => {
        const g = gl();
        g.glEnable(E.GL_FOG);
        g.glEnable(E.GL_BLEND);
        g.glEnable(E.GL_DEPTH_TEST);
        g.glEnable(E.GL_ALPHA_TEST);
        const saved = new Int32Array(2);
        g.glGetIntegerv(E.GL_DRAW_BUFFER, saved, 0);
        g.glGetIntegerv(E.GL_READ_BUFFER, saved, 1);
        expect([...saved]).toEqual([E.GL_BACK, E.GL_BACK]);
        g.glDrawBuffer(E.GL_BACK_LEFT);
        g.glReadBuffer(E.GL_FRONT_LEFT);
        g.glPushAttrib(E.GL_ENABLE_BIT);
        for (const cap of [E.GL_FOG, E.GL_BLEND, E.GL_DEPTH_TEST, E.GL_ALPHA_TEST]) g.glDisable(cap);
        g.glRasterPos2i(0, 0);
        g.glPopAttrib();
        g.glDrawBuffer(saved[0]);
        g.glReadBuffer(saved[1]);
        const s = g.state;
        expect([E.GL_FOG, E.GL_BLEND, E.GL_DEPTH_TEST, E.GL_ALPHA_TEST].map(c => s.isEnabled(c))).toEqual([true, true, true, true]);
        expect([s.drawBuffer, s.readBuffer]).toEqual([E.GL_BACK, E.GL_BACK]);
    });
});

describe('read-back state matches NullGL', () => {
    test('LIGHT_MODEL_AMBIENT: GL default, then the exact bits glLightModelfv gave (NaN payload kept)', () => {
        const g = gl();
        const out = new Float32Array(6);
        g.glGetFloatv(E.GL_LIGHT_MODEL_AMBIENT, out, 1);
        expect(bits(out).slice(1, 5)).toEqual(['3e4ccccd', '3e4ccccd', '3e4ccccd', '3f800000']);
        const v = new Float32Array(5);
        new Uint32Array(v.buffer).set([0, 0x3d808081, 0x7fa00001, 0x3e808081, 0x3f800000]);
        g.glLightModelfv(E.GL_LIGHT_MODEL_AMBIENT, v, 1);
        const fb = FloatBuffer.allocate(8);
        fb.position(2);
        g.glGetFloatv(E.GL_LIGHT_MODEL_AMBIENT, out, 0);
        expect(bits(out).slice(0, 4)).toEqual(['3d808081', '7fa00001', '3e808081', '3f800000']);
        g.glGetFloatv(E.GL_LIGHT_MODEL_AMBIENT, fb);
        expect(fb.position()).toBe(2);
        expect(fb.get(2)).toBe(bitsToNumber(0x3d808081));
    });

    test('profile answers, PROGRAM_ERROR_POSITION -1 and the GLImpl array checks', () => {
        const g = gl(rtx);
        const iv = new Int32Array(3);
        g.glGetIntegerv(E.GL_MAX_TEXTURE_UNITS, iv, 0);
        g.glGetIntegerv(E.GL_MAX_TEXTURE_COORDS, iv, 1);
        g.glGetIntegerv(E.GL_PROGRAM_ERROR_POSITION_ARB, iv, 2);
        expect([...iv]).toEqual([4, 8, -1]);
        expect(g.glGetString(E.GL_VENDOR)).toBe('NVIDIA Corporation');
        expect(g.glGetString(1)).toBeNull();
        expect(g.isExtensionAvailable('GL_ARB_vertex_program')).toBe(true);
        expect(g.isExtensionAvailable('GL_VERSION_1_3')).toBe(true);
        expect(() => g.glGetIntegerv(E.GL_MAX_TEXTURE_UNITS, iv, 3)).toThrow(GLException);
        expect(() => g.glGenTextures(2, new Int32Array(2), 1)).toThrow(RangeError);
        const names = new Int32Array(3);
        g.glGenTextures(3, names, 0);
        expect([...names]).toEqual([1, 2, 3]);
        g.glDeleteTextures(1, names, 0);
        g.glGenTextures(1, names, 0);
        expect(names[0]).toBe(4); // never reused, as NullGL
        const missing: CapsProfile = { ...FALLBACK_CAPS_PROFILE, name: 'no-vbo-procs', missingEntryPoints: ['glGenBuffersARB', 'glTexImage3D'] };
        const m = gl(missing);
        expect(() => m.glGenBuffersARB(1, new Int32Array(1), 0)).toThrow('Method "glGenBuffersARB" not available');
        expect(() => m.glTexImage3D(E.GL_TEXTURE_3D, 0, E.GL_ALPHA, 1, 1, 1, 0, E.GL_ALPHA, E.GL_UNSIGNED_BYTE, null)).toThrow(GLException);
    });

    test('pixel-store pnames answer from the mirror, starting at the profile values', () => {
        const g = gl(rtx);
        const v = new Int32Array(1);
        g.glGetIntegerv(E.GL_UNPACK_ALIGNMENT, v, 0);
        expect(v[0]).toBe(rtx.integers['3317'][0]);
        g.glPixelStorei(E.GL_UNPACK_ALIGNMENT, 1);
        g.glGetIntegerv(E.GL_UNPACK_ALIGNMENT, v, 0);
        expect(v[0]).toBe(1);
        g.glPixelStorei(E.GL_UNPACK_ALIGNMENT, 3);
        expect(g.glGetError()).toBe(E.GL_INVALID_VALUE);
    });
});

function bitsToNumber(u: number): number {
    return new Float32Array(new Uint32Array([u]).buffer)[0];
}

describe('display lists', () => {
    test('GL_COMPILE records without executing; glCallList replays through the same paths, nested', () => {
        const g = gl();
        const base = g.glGenLists(2);
        expect(base).toBe(1);
        g.glNewList(base, E.GL_COMPILE);
        g.glActiveTexture(E.GL_TEXTURE1);
        g.glEnable(E.GL_TEXTURE_CUBE_MAP);
        g.glMatrixMode(E.GL_TEXTURE);
        g.glLoadIdentity();
        g.glRotatef(22.5, 1, 0, 0);
        g.glMatrixMode(E.GL_MODELVIEW);
        g.glTexEnvi(E.GL_TEXTURE_ENV, E.GL_COMBINE_RGB, E.GL_REPLACE);
        g.glActiveTexture(E.GL_TEXTURE0);
        g.glEndList();
        g.glNewList(base + 1, E.GL_COMPILE);
        g.glCallList(base);
        g.glEnable(E.GL_FOG);
        g.glEndList();
        const s = g.state;
        expect([s.activeTexture, s.units[1].targetEnabled.get(E.GL_TEXTURE_CUBE_MAP), s.matrixMode, s.units[1].env.combineRgb]).toEqual([0, false, E.GL_MODELVIEW, E.GL_MODULATE]);
        expect([...s.textureMatrix(1)]).toEqual([...identity()]);
        g.glCallList(base + 1);
        expect([s.activeTexture, s.units[1].targetEnabled.get(E.GL_TEXTURE_CUBE_MAP), s.matrixMode, s.units[1].env.combineRgb, s.isEnabled(E.GL_FOG)]).toEqual([0, true, E.GL_MODELVIEW, E.GL_REPLACE, true]);
        expect(s.textureMatrix(1)[5]).toBeCloseTo(Math.cos((22.5 * Math.PI) / 180), 6);
        g.glCallList(99); // an undefined list does nothing
    });

    test('array arguments are copied at compile time; client-state and gen calls execute immediately', () => {
        const g = gl();
        const plane = Float32Array.of(0.0078125, 0, 0, 0);
        const list = g.glGenLists(1);
        g.glNewList(list, E.GL_COMPILE);
        g.glTexGenfv(E.GL_S, E.GL_OBJECT_PLANE, plane, 0);
        g.glEnableClientState(E.GL_VERTEX_ARRAY);
        const names = new Int32Array(1);
        g.glGenTextures(1, names, 0);
        expect(g.glGenLists(1)).toBe(2);
        g.glNewList(5, E.GL_COMPILE);
        expect(g.glGetError()).toBe(E.GL_INVALID_OPERATION);
        g.glEndList();
        expect(g.state.vertexArray.enabled).toBe(true);
        expect(names[0]).toBe(1);
        plane[0] = 99;
        g.glCallList(list);
        expect(g.state.unit.gen[0].objectPlane[0]).toBe(0.0078125);
        g.glEndList();
        expect(g.glGetError()).toBe(E.GL_INVALID_OPERATION);
    });

    test('a compiled fan with one vertex emits no primitives; surface copies need a drawable', () => {
        const g = gl();
        const list = g.glGenLists(1);
        g.glNewList(list, E.GL_COMPILE);
        g.glBegin(E.GL_TRIANGLE_FAN);
        g.glTexCoord2f(0, 0);
        g.glVertex2f(0, 0);
        g.glEnd();
        g.glEndList();
        g.glCallList(list);
        expect(g.glGetError()).toBe(E.GL_NO_ERROR);
        g.glDrawElements(E.GL_TRIANGLES, 3, E.GL_UNSIGNED_INT, 0n);
        g.glEnableClientState(E.GL_VERTEX_ARRAY);
        expect(() => g.glDrawElements(E.GL_TRIANGLES, 3, E.GL_UNSIGNED_INT, 0n)).toThrow('no drawable');
        expect(() => g.glCopyPixels(0, 0, 1, 1, E.GL_COLOR)).toThrow('no drawable');
    });
});

describe('textures', () => {
    const rgba = (n: number) => ByteBuffer.wrap(new Int8Array(n * 4).fill(-1));

    test('completeness: mipmap min filter needs the whole chain; an incomplete texture disables its unit', () => {
        const g = gl();
        const names = new Int32Array(2);
        g.glGenTextures(2, names, 0);
        g.glBindTexture(E.GL_TEXTURE_2D, names[0]);
        g.glTexImage2D(E.GL_TEXTURE_2D, 0, 4, 4, 4, 0, E.GL_RGBA, E.GL_UNSIGNED_BYTE, rgba(16));
        g.glEnable(E.GL_TEXTURE_2D);
        const t = g.boundTexture(E.GL_TEXTURE_2D);
        expect(t.isComplete()).toBe(false); // default NEAREST_MIPMAP_LINEAR, levels 1 and 2 missing
        expect(g.effectiveTexture(0)).toBeNull();
        g.glTexImage2D(E.GL_TEXTURE_2D, 1, 4, 2, 2, 0, E.GL_RGBA, E.GL_UNSIGNED_BYTE, rgba(4));
        g.glTexImage2D(E.GL_TEXTURE_2D, 2, 4, 1, 1, 0, E.GL_RGBA, E.GL_UNSIGNED_BYTE, rgba(1));
        expect(g.effectiveTexture(0)).toBe(t);
        g.glTexImage2D(E.GL_TEXTURE_2D, 2, 4, 2, 2, 0, E.GL_RGBA, E.GL_UNSIGNED_BYTE, rgba(4));
        expect(t.isComplete()).toBe(false); // inconsistent level 2
        g.glTexParameteri(E.GL_TEXTURE_2D, E.GL_TEXTURE_MIN_FILTER, E.GL_LINEAR);
        expect(t.isComplete()).toBe(true);
        // Priority: an enabled cube map wins over 2D, and its incompleteness disables the unit (no fallback to 2D).
        g.glBindTexture(E.GL_TEXTURE_CUBE_MAP, names[1]);
        g.glEnable(E.GL_TEXTURE_CUBE_MAP);
        expect(g.state.unitTarget(0)).toBe(E.GL_TEXTURE_CUBE_MAP);
        expect(g.effectiveTexture(0)).toBeNull();
        g.glTexParameteri(E.GL_TEXTURE_CUBE_MAP, E.GL_TEXTURE_MIN_FILTER, E.GL_LINEAR);
        for (let face = 0; face < 5; face++) g.glTexImage2D(E.GL_TEXTURE_CUBE_MAP_POSITIVE_X + face, 0, E.GL_ALPHA, 2, 2, 0, E.GL_ALPHA, E.GL_UNSIGNED_BYTE, null);
        expect(g.effectiveTexture(0)).toBeNull();
        g.glTexImage2D(E.GL_TEXTURE_CUBE_MAP_NEGATIVE_Z, 0, E.GL_ALPHA, 2, 2, 0, E.GL_ALPHA, E.GL_UNSIGNED_BYTE, null);
        expect(g.effectiveTexture(0)?.name).toBe(names[1]);
        // Binding a name to a second target is INVALID_OPERATION.
        g.glBindTexture(E.GL_TEXTURE_3D, names[1]);
        expect(g.glGetError()).toBe(E.GL_INVALID_OPERATION);
        // Deleting a bound texture reverts the binding to 0 (the default object).
        g.glDeleteTextures(1, names, 1);
        expect(g.state.units[0].binding.get(E.GL_TEXTURE_CUBE_MAP)).toBe(0);
    });

    test('sampler state defaults and parameters; 1D textures have height 1', () => {
        const g = gl();
        const names = new Int32Array(1);
        g.glGenTextures(1, names, 0);
        g.glBindTexture(E.GL_TEXTURE_1D, names[0]);
        g.glTexImage1D(E.GL_TEXTURE_1D, 0, E.GL_ALPHA, 8, 0, E.GL_ALPHA, E.GL_UNSIGNED_BYTE, ByteBuffer.wrap(Int8Array.of(0x73, -121, -101, -81, -61, -45, -21, -1)));
        const t = g.boundTexture(E.GL_TEXTURE_1D);
        expect(t.samplerKey()).toEqual({ minFilter: E.GL_NEAREST_MIPMAP_LINEAR, magFilter: E.GL_LINEAR, wrapS: E.GL_REPEAT, wrapT: E.GL_REPEAT, wrapR: E.GL_REPEAT });
        g.glTexParameteri(E.GL_TEXTURE_1D, E.GL_TEXTURE_MIN_FILTER, E.GL_LINEAR);
        g.glTexParameteri(E.GL_TEXTURE_1D, E.GL_TEXTURE_WRAP_S, E.GL_CLAMP_TO_EDGE);
        const img = t.baseImage();
        expect([img?.width, img?.height, img?.depth]).toEqual([8, 1, 1]);
        expect([...(img?.data ?? [])]).toEqual([0x73, 0x87, 0x9b, 0xaf, 0xc3, 0xd3, 0xeb, 0xff]);
        expect(t.isComplete()).toBe(true);
        expect(() => g.glTexParameteri(E.GL_TEXTURE_1D, E.GL_TEXTURE_WRAP_S, E.GL_CLAMP)).toThrow(GlUnsupported);
    });

    test('unpack follows UNPACK_ALIGNMENT, ROW_LENGTH and SKIP; IntBuffer pixels are read as stored bytes', () => {
        const src = Uint8Array.from({ length: 32 }, (_, i) => i);
        expect([...unpackImage(src, 3, 2, 1, 1, { alignment: 4, rowLength: 0, skipRows: 0, skipPixels: 0 })]).toEqual([0, 1, 2, 4, 5, 6]);
        expect([...unpackImage(src, 2, 2, 1, 2, { alignment: 1, rowLength: 5, skipRows: 1, skipPixels: 1 })]).toEqual([12, 13, 14, 15, 22, 23, 24, 25]);
        expect(() => unpackImage(src, 8, 8, 1, 1, { alignment: 4, rowLength: 0, skipRows: 0, skipPixels: 0 })).toThrow(RangeError);
        const g = gl();
        const names = new Int32Array(1);
        g.glGenTextures(1, names, 0);
        g.glBindTexture(E.GL_TEXTURE_2D, names[0]);
        g.glTexImage2D(E.GL_TEXTURE_2D, 0, 4, 1, 1, 0, E.GL_RGBA, E.GL_UNSIGNED_BYTE, IntBuffer.wrap(Int32Array.of(0x11223344)));
        expect([...(g.boundTexture(E.GL_TEXTURE_2D).baseImage()?.data ?? [])]).toEqual([0x44, 0x33, 0x22, 0x11]);
        // The no-3D-texture noise path: 64 LUMINANCE_ALPHA slices read from an advancing position of one buffer.
        const volume = ByteBuffer.allocateDirect(64 * 64 * 4 * 2).order(ByteOrder.nativeOrder());
        for (let i = 0; i < volume.capacity(); i++) volume.put(i, (i * 7) | 0);
        volume.position(8192);
        g.glTexImage2D(E.GL_TEXTURE_2D, 0, E.GL_LUMINANCE_ALPHA, 64, 64, 0, E.GL_LUMINANCE_ALPHA, E.GL_UNSIGNED_BYTE, volume);
        const slice = g.boundTexture(E.GL_TEXTURE_2D).baseImage()?.data ?? new Uint8Array();
        expect(slice.length).toBe(8192);
        expect(slice[0]).toBe((8192 * 7) & 0xff);
    });

    test('TextureObject.chainLength', () => {
        expect([TextureObject.chainLength(128, 128, 1), TextureObject.chainLength(1, 1, 1), TextureObject.chainLength(64, 64, 64), TextureObject.chainLength(8, 1, 1)]).toEqual([8, 1, 7, 4]);
    });
});

describe('buffers, programs, client arrays', () => {
    test('VBO data store follows glBufferDataARB / glBufferSubDataARB; range errors are GL errors', () => {
        const g = gl(RADEON_CAPS_PROFILE);
        const ids = new Int32Array(1);
        g.glGenBuffersARB(1, ids, 0);
        g.glBindBufferARB(E.GL_ARRAY_BUFFER, ids[0]);
        const data = ByteBuffer.allocate(10000).order(ByteOrder.nativeOrder());
        data.putFloat(0, 0.25).putFloat(4, -0.5).putFloat(8, -2).putFloat(12, 1);
        g.glBufferDataARB(E.GL_ARRAY_BUFFER, 16, data, E.GL_STREAM_DRAW);
        const b = g.buffers.get(ids[0]);
        expect(b?.data.length).toBe(16);
        expect([...new Float32Array(b?.data.slice().buffer ?? new ArrayBuffer(0))]).toEqual([0.25, -0.5, -2, 1]);
        data.putFloat(0, 1.5).putFloat(12, -4);
        g.glBufferSubDataARB(E.GL_ARRAY_BUFFER, 0, 16, data);
        expect([...new Float32Array(b?.data.slice().buffer ?? new ArrayBuffer(0))]).toEqual([1.5, -0.5, -2, -4]);
        g.glBufferSubDataARB(E.GL_ARRAY_BUFFER, 8, 16, data);
        expect(g.glGetError()).toBe(E.GL_INVALID_VALUE);
        g.glBindBufferARB(E.GL_ARRAY_BUFFER, 0);
        g.glBufferDataARB(E.GL_ARRAY_BUFFER, 4, null, E.GL_STATIC_DRAW);
        expect(g.glGetError()).toBe(E.GL_INVALID_OPERATION);
    });

    test('glInterleavedArrays sets the pointers and enables of its format', () => {
        const g = gl();
        const ids = new Int32Array(1);
        g.glGenBuffersARB(1, ids, 0);
        g.glBindBufferARB(E.GL_ARRAY_BUFFER, ids[0]);
        g.glEnableClientState(E.GL_NORMAL_ARRAY);
        g.glEnableClientState(E.GL_TEXTURE_COORD_ARRAY);
        g.glInterleavedArrays(E.GL_C4UB_V3F, 0, 0n);
        const s = g.state;
        expect([s.colorArray.enabled, s.vertexArray.enabled, s.normalArray.enabled, s.texCoordArrays[0].enabled]).toEqual([true, true, false, false]);
        expect([s.colorArray.size, s.colorArray.type, s.colorArray.stride, s.colorArray.offset, s.colorArray.buffer]).toEqual([4, E.GL_UNSIGNED_BYTE, 16, 0, ids[0]]);
        expect([s.vertexArray.offset, s.vertexArray.stride]).toEqual([4, 16]);
        g.glInterleavedArrays(E.GL_T2F_V3F, 0, 0n);
        expect([s.colorArray.enabled, s.texCoordArrays[0].enabled, s.vertexArray.offset, s.vertexArray.stride]).toEqual([false, true, 8, 20]);
    });

    test('ARB program: only the shipped water program loads; local parameters are per program', () => {
        const g = gl();
        const ids = new Int32Array(1);
        g.glGenProgramsARB(1, ids, 0);
        g.glBindProgramARB(E.GL_VERTEX_PROGRAM_ARB, ids[0]);
        expect(() => g.glProgramStringARB(E.GL_VERTEX_PROGRAM_ARB, E.GL_PROGRAM_FORMAT_ASCII_ARB, 9, '!!ARBvp1.0')).toThrow(GlUnsupported);
        const arb = join(import.meta.dir, '..', '..', 'out', '530-hd-vertex-program.arb');
        if (existsSync(arb)) {
            const source = readFileSync(arb, 'latin1');
            expect(sha256Hex(new TextEncoder().encode(source))).toBe(WATER_PROGRAM_SHA256);
            g.glProgramStringARB(E.GL_VERTEX_PROGRAM_ARB, E.GL_PROGRAM_FORMAT_ASCII_ARB, source.length, source);
            expect(g.programs.get(ids[0])?.source).toBe(source);
        }
        g.glProgramLocalParameter4fARB(E.GL_VERTEX_PROGRAM_ARB, 66, 0.0627451, 0.1254902, 0.2509804, 1);
        const fb = FloatBuffer.allocate(8);
        fb.put(4, 7).put(5, 8).put(6, 9).put(7, 10);
        fb.position(4);
        g.glProgramLocalParameter4fvARB(E.GL_VERTEX_PROGRAM_ARB, 3, fb);
        const local = g.programs.get(ids[0])?.local ?? new Float32Array(0);
        expect([...local.subarray(264, 268)]).toEqual([Math.fround(0.0627451), Math.fround(0.1254902), Math.fround(0.2509804), 1]);
        expect([...local.subarray(12, 16)]).toEqual([7, 8, 9, 10]);
        g.glProgramLocalParameter4fARB(E.GL_VERTEX_PROGRAM_ARB, 96, 0, 0, 0, 0);
        expect(g.glGetError()).toBe(E.GL_INVALID_VALUE);
        g.glBindProgramARB(E.GL_VERTEX_PROGRAM_ARB, 0);
        expect(g.state.vertexProgramBinding).toBe(0);
    });
});

describe('inventory', () => {
    test("enum values outside the jar's inventory throw GlUnsupported at the call", () => {
        const g = gl();
        expect(() => g.glEnable(E.GL_LIGHT0 + 2)).toThrow(GlUnsupported);
        expect(() => g.glEnable(E.GL_FRAGMENT_PROGRAM_ARB)).toThrow(GlUnsupported);
        g.glDisable(E.GL_FRAGMENT_PROGRAM_ARB);
        expect(() => g.glEnable(0x0ba1 /* NORMALIZE */)).toThrow(GlUnsupported);
        expect(() => g.glHint(E.GL_FOG_HINT, E.GL_NICEST)).toThrow(GlUnsupported);
        expect(() => g.glShadeModel(E.GL_FLAT)).toThrow(GlUnsupported);
        expect(() => g.glPolygonMode(E.GL_FRONT_AND_BACK, E.GL_FILL)).toThrow(GlUnsupported);
        expect(() => g.glFogi(E.GL_FOG_MODE, E.GL_EXP)).toThrow(GlUnsupported);
        expect(() => g.glTexEnvi(E.GL_TEXTURE_ENV, E.GL_COMBINE_RGB, E.GL_DOT3_RGB)).toThrow(GlUnsupported);
        expect(() => g.glTexEnvi(E.GL_TEXTURE_ENV, E.GL_TEXTURE_ENV_MODE, E.GL_DECAL)).toThrow(GlUnsupported);
        expect(() => g.glPushAttrib(0x4000 /* COLOR_BUFFER_BIT */)).toThrow(GlUnsupported);
        expect(() => g.glClear(0x400 /* STENCIL_BUFFER_BIT */)).toThrow(GlUnsupported);
        expect(() => g.glNewList(1, E.GL_COMPILE_AND_EXECUTE)).toThrow(GlUnsupported);
        expect(() => g.glCullFace(E.GL_FRONT_AND_BACK)).toThrow(GlUnsupported);
        expect(() => g.glBegin(4 /* TRIANGLES */)).toThrow(GlUnsupported);
    });

    test('setSwapInterval is recorded with no effect; glClear without a drawable throws', () => {
        const g = gl();
        g.setSwapInterval(0);
        expect(g.swapInterval).toBe(0);
        expect(() => g.glClear(E.GL_COLOR_BUFFER_BIT)).toThrow('no drawable');
        g.glDepthMask(false);
        g.glClear(E.GL_DEPTH_BUFFER_BIT); // DepthMask(false): nothing to clear, nothing touched
    });
});

// A context that only makes a GL current, for JOGL's GLU (GLU.getCurrentGL()).
class TestContext extends GLContext {
    constructor(private readonly gl: GL) {
        super();
    }

    makeCurrent(): number {
        TestContext.setCurrent(this);
        return GLContext.CONTEXT_CURRENT;
    }

    release(): void {
        TestContext.setCurrent(null);
    }

    destroy(): void {}

    getGL(): GL {
        return this.gl;
    }
}

describe('the driver records what NullGL records', () => {
    // A script over the H1 surface (and GLU's nested calls), run through RecordingGL(NullGL) and RecordingGL(WebGpuGL).
    function script(g: GL): void {
        const names = new Int32Array(4);
        g.glGetString(E.GL_RENDERER);
        g.isExtensionAvailable('GL_ARB_texture_env_combine');
        g.glGetIntegerv(E.GL_MAX_TEXTURE_IMAGE_UNITS, names, 0);
        g.glGenTextures(3, names, 1);
        g.glBindTexture(E.GL_TEXTURE_CUBE_MAP, names[1]);
        g.glTexImage2D(E.GL_TEXTURE_CUBE_MAP_POSITIVE_X, 0, E.GL_ALPHA, 4, 4, 0, E.GL_ALPHA, E.GL_UNSIGNED_BYTE, ByteBuffer.wrap(new Int8Array(16)));
        const list = g.glGenLists(2);
        g.glNewList(list, E.GL_COMPILE);
        g.glActiveTexture(E.GL_TEXTURE1);
        g.glTexGenfv(E.GL_Q, E.GL_OBJECT_PLANE, Float32Array.of(0, 0, 0, 1), 0);
        g.glPushMatrix();
        g.glEndList();
        g.glCallList(list);
        g.glLightModelfv(E.GL_LIGHT_MODEL_AMBIENT, Float32Array.of(1.15, 1.15, 1.15, 1), 0);
        const amb = new Float32Array(4);
        g.glGetFloatv(E.GL_LIGHT_MODEL_AMBIENT, amb, 0);
        g.glGetIntegerv(E.GL_DRAW_BUFFER, names, 0);
        g.glDrawBuffer(E.GL_BACK_LEFT);
        g.glGetIntegerv(E.GL_DRAW_BUFFER, names, 0);
        g.glGenProgramsARB(1, names, 0);
        g.glGetIntegerv(E.GL_PROGRAM_ERROR_POSITION_ARB, names, 0);
        g.glGetFloatv(E.GL_POINT_SIZE_MAX, amb, 0);
        g.glPointParameterfARB(E.GL_POINT_SIZE_MAX, 1024);
        g.setSwapInterval(0);
        try {
            g.glGetIntegerv(E.GL_MAX_TEXTURE_UNITS, names, 4);
        } catch {
            // GLException, recorded as !> GLException on both sides
        }
        const ctx = new TestContext(g);
        ctx.makeCurrent();
        try {
            g.glBindTexture(E.GL_TEXTURE_2D, names[2]);
            new GLU().gluBuild2DMipmaps(E.GL_TEXTURE_2D, E.GL_RGBA, 64, 64, E.GL_RGBA, E.GL_UNSIGNED_BYTE, ByteBuffer.wrap(new Int8Array(64 * 64 * 4).map((_, i) => i)));
        } finally {
            ctx.release();
        }
    }

    for (const profile of [FALLBACK_CAPS_PROFILE, RADEON_CAPS_PROFILE, rtx]) {
        test('profile ' + profile.name, () => {
            const traces = [new NullGL(profile), new WebGpuGL(profile)].map(inner => {
                const writer = new GlTraceWriter();
                script(new RecordingGL(inner, writer));
                return writer.text();
            });
            expect(traces[1]).toBe(traces[0]);
            expect(traces[0]).toContain('glTexImage2D\t32868'); // GLU's proxy probe ran
        });
    }

    test('GLU mipmaps land in the driver as a complete chain', () => {
        const g = new WebGpuGL(rtx);
        const names = new Int32Array(1);
        g.glGenTextures(1, names, 0);
        g.glBindTexture(E.GL_TEXTURE_2D, names[0]);
        const ctx = new TestContext(g);
        ctx.makeCurrent();
        try {
            new GLU().gluBuild2DMipmaps(E.GL_TEXTURE_2D, E.GL_RGBA, 128, 128, E.GL_RGBA, E.GL_UNSIGNED_BYTE, ByteBuffer.wrap(new Int8Array(128 * 128 * 4).fill(64)));
        } finally {
            ctx.release();
        }
        const t = g.boundTexture(E.GL_TEXTURE_2D);
        expect([...t.images[0].keys()]).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
        expect(t.images[0].get(7)?.width).toBe(1);
        expect(t.isComplete()).toBe(true);
        expect(g.state.pixelStore.get(E.GL_UNPACK_ALIGNMENT)).toBe(rtx.integers['3317'][0]); // restored by GLU
    });
});
