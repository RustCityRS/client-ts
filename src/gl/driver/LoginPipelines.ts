import { GLX as E } from './GlEnums';
import GlState from './GlState';
import type { IndexedStage } from '#/gl/driver/shaders/indexed.wgsl';
import type { BaseFormat } from './TextureObject';

// Captured from the original runescape_gl.jar title.19 trace, the cached title scene at tick 120
// over 64 camera angles, and a fresh Tutorial Island login. Only observed mesh/material pairs
// are compiled. The drawable supplies its sample count and alpha mask. Every draw supplies its
// own uniforms, including the changing GL_CONSTANT light and water colours.
function buffer(arrayStride: number, ...attributes: [number, number, GPUVertexFormat][]): GPUVertexBufferLayout {
    return { arrayStride, attributes: attributes.map(([shaderLocation, offset, format]) => ({ shaderLocation, offset, format })) };
}

export const loginVertexLayouts: GPUVertexBufferLayout[][] = [
    [buffer(36, [0, 0, 'float32x3'], [1, 12, 'unorm8x4'], [2, 16, 'float32x3'], [3, 28, 'float32x2'])],
    [buffer(20, [0, 8, 'float32x3'], [3, 0, 'float32x2'])],
    [buffer(16, [0, 4, 'float32x3'], [1, 0, 'unorm8x4'])],
    [buffer(12, [0, 0, 'float32x3']), buffer(16, [1, 0, 'unorm8x4'], [2, 4, 'float32x3']), buffer(8, [3, 0, 'float32x2'])],
    [buffer(28, [0, 0, 'float32x3'], [1, 12, 'unorm8x4'], [2, 16, 'float32x3']), buffer(36, [3, 0, 'float32x2'])],
    [buffer(36, [0, 0, 'float32x3'], [1, 12, 'unorm8x4'], [3, 28, 'float32x2']), buffer(12, [2, 0, 'float32x3'])],
    [buffer(24, [0, 0, 'float32x3'], [2, 12, 'float32x3']), buffer(36, [1, 0, 'unorm8x4'], [3, 16, 'float32x2'])],
    [buffer(12, [0, 0, 'float32x3']), buffer(36, [1, 0, 'unorm8x4'], [2, 4, 'float32x3'], [3, 16, 'float32x2'])],
    [buffer(12, [0, 0, 'float32x3']), buffer(28, [1, 0, 'unorm8x4'], [2, 4, 'float32x3']), buffer(36, [3, 0, 'float32x2'])],
    [buffer(12, [0, 0, 'float32x3']), buffer(24, [1, 0, 'unorm8x4'], [2, 4, 'float32x3'], [3, 16, 'float32x2'])],
    [buffer(24, [0, 0, 'float32x3']), buffer(36, [1, 0, 'unorm8x4'], [3, 16, 'float32x2']), buffer(12, [2, 0, 'float32x3'])],
    [buffer(16, [0, 0, 'float32x3'], [1, 12, 'unorm8x4']), buffer(16, [2, 0, 'float32x3']), buffer(8, [3, 0, 'float32x2'])],
    [buffer(12, [0, 0, 'float32x3']), buffer(16, [1, 0, 'unorm8x4']), buffer(12, [2, 0, 'float32x3']), buffer(8, [3, 0, 'float32x2'])],
    [buffer(24, [0, 0, 'float32x3'], [2, 12, 'float32x3']), buffer(28, [1, 0, 'unorm8x4']), buffer(36, [3, 0, 'float32x2'])],
    [buffer(12, [0, 0, 'float32x3']), buffer(4, [1, 0, 'unorm8x4']), buffer(20, [2, 0, 'float32x3'], [3, 12, 'float32x2'])],
    [buffer(16, [0, 0, 'float32x3'], [1, 12, 'unorm8x4']), buffer(12, [2, 0, 'float32x3']), buffer(8, [3, 0, 'float32x2'])],
    [buffer(12, [0, 0, 'float32x3']), buffer(36, [1, 0, 'unorm8x4'], [3, 16, 'float32x2']), buffer(24, [2, 0, 'float32x3'])],
    [buffer(16, [0, 0, 'float32x3'], [1, 12, 'unorm8x4']), buffer(36, [2, 0, 'float32x3'], [3, 12, 'float32x2'])],
    [buffer(12, [0, 0, 'float32x3']), buffer(16, [1, 0, 'unorm8x4']), buffer(36, [2, 0, 'float32x3'], [3, 12, 'float32x2'])],
    [buffer(16, [0, 0, 'float32x3'], [1, 12, 'unorm8x4']), buffer(28, [2, 0, 'float32x3']), buffer(36, [3, 0, 'float32x2'])],
    [buffer(28, [0, 0, 'float32x3'], [2, 16, 'float32x3']), buffer(4, [1, 0, 'unorm8x4']), buffer(36, [3, 0, 'float32x2'])],
    [buffer(36, [0, 0, 'float32x3'], [2, 16, 'float32x3'], [3, 28, 'float32x2']), buffer(4, [1, 0, 'unorm8x4'])],
    [buffer(36, [0, 0, 'float32x3'], [2, 16, 'float32x3'], [3, 28, 'float32x2'])],
    [buffer(40, [0, 0, 'float32x3'], [1, 12, 'unorm8x4'], [2, 16, 'float32x3'], [3, 28, 'float32x2'], [5, 36, 'float32'])],
    [buffer(16, [0, 0, 'float32x3'], [1, 12, 'unorm8x4']), buffer(24, [2, 0, 'float32x3'], [3, 12, 'float32x2'])],
    [buffer(12, [0, 0, 'float32x3']), buffer(4, [1, 0, 'unorm8x4']), buffer(12, [2, 0, 'float32x3']), buffer(8, [3, 0, 'float32x2'])],
    [buffer(16, [0, 0, 'float32x3']), buffer(16, [1, 0, 'unorm8x4']), buffer(12, [2, 0, 'float32x3']), buffer(8, [3, 0, 'float32x2'])]
];

interface Stage {
    unit: number;
    target: number;
    dimension: IndexedStage['dimension'];
    format: BaseFormat;
    combineRgb?: number;
    combineAlpha?: number;
    sourceRgb?: number[];
    sourceAlpha?: number[];
    operandRgb?: number[];
    operandAlpha?: number[];
    rgbScale?: number;
    gen?: number[];
}

const stages: Stage[] = [
    { unit: 0, target: E.GL_TEXTURE_2D, dimension: '2d', format: E.GL_RGBA },
    { unit: 0, target: E.GL_TEXTURE_2D, dimension: '2d', format: E.GL_ALPHA, combineRgb: E.GL_REPLACE, combineAlpha: E.GL_REPLACE },
    { unit: 0, target: E.GL_TEXTURE_2D, dimension: '2d', format: E.GL_RGBA, sourceRgb: [E.GL_CONSTANT, E.GL_PREVIOUS, E.GL_CONSTANT], operandRgb: [E.GL_SRC_ALPHA, E.GL_SRC_COLOR, E.GL_SRC_ALPHA] },
    { unit: 0, target: E.GL_TEXTURE_2D, dimension: '2d', format: E.GL_RGBA, combineAlpha: E.GL_REPLACE },
    { unit: 1, target: E.GL_TEXTURE_CUBE_MAP, dimension: 'cube', format: E.GL_ALPHA, combineRgb: E.GL_REPLACE, sourceRgb: [E.GL_PREVIOUS, E.GL_PREVIOUS, E.GL_CONSTANT], gen: [E.GL_NORMAL_MAP, E.GL_NORMAL_MAP, E.GL_NORMAL_MAP, 0] },
    {
        unit: 2,
        target: E.GL_TEXTURE_2D,
        dimension: '2d',
        format: E.GL_RGBA,
        combineRgb: E.GL_ADD,
        combineAlpha: E.GL_REPLACE,
        sourceRgb: [E.GL_PREVIOUS, E.GL_PREVIOUS, E.GL_CONSTANT],
        sourceAlpha: [E.GL_PRIMARY_COLOR, E.GL_PREVIOUS, E.GL_CONSTANT],
        operandRgb: [E.GL_SRC_COLOR, E.GL_SRC_ALPHA, E.GL_SRC_ALPHA]
    },
    { unit: 1, target: E.GL_TEXTURE_3D, dimension: '3d', format: E.GL_LUMINANCE_ALPHA, combineRgb: E.GL_ADD, combineAlpha: E.GL_REPLACE, sourceAlpha: [E.GL_PREVIOUS, E.GL_PREVIOUS, E.GL_CONSTANT] },
    { unit: 0, target: E.GL_TEXTURE_2D, dimension: '2d', format: E.GL_RGBA, combineAlpha: E.GL_REPLACE, sourceRgb: [E.GL_CONSTANT, E.GL_PREVIOUS, E.GL_CONSTANT], operandRgb: [E.GL_SRC_ALPHA, E.GL_SRC_COLOR, E.GL_SRC_ALPHA] },
    {
        unit: 1,
        target: E.GL_TEXTURE_3D,
        dimension: '3d',
        format: E.GL_LUMINANCE_ALPHA,
        combineRgb: E.GL_ADD,
        combineAlpha: E.GL_REPLACE,
        sourceAlpha: [E.GL_PREVIOUS, E.GL_PREVIOUS, E.GL_CONSTANT],
        gen: [E.GL_EYE_LINEAR, E.GL_EYE_LINEAR, E.GL_EYE_LINEAR, E.GL_OBJECT_LINEAR]
    },
    {
        unit: 2,
        target: E.GL_TEXTURE_1D,
        dimension: '2d',
        format: E.GL_ALPHA,
        combineRgb: E.GL_INTERPOLATE,
        combineAlpha: E.GL_REPLACE,
        sourceRgb: [E.GL_CONSTANT, E.GL_PREVIOUS, E.GL_TEXTURE],
        sourceAlpha: [E.GL_PREVIOUS, E.GL_PREVIOUS, E.GL_CONSTANT]
    },
    {
        unit: 0,
        target: E.GL_TEXTURE_3D,
        dimension: '3d',
        format: E.GL_LUMINANCE_ALPHA,
        combineRgb: E.GL_ADD,
        combineAlpha: E.GL_ADD,
        sourceRgb: [E.GL_TEXTURE, E.GL_CONSTANT, E.GL_CONSTANT],
        sourceAlpha: [E.GL_TEXTURE, E.GL_CONSTANT, E.GL_CONSTANT],
        rgbScale: 2,
        gen: [E.GL_OBJECT_LINEAR, E.GL_OBJECT_LINEAR, E.GL_OBJECT_LINEAR, E.GL_OBJECT_LINEAR]
    },
    {
        unit: 1,
        target: E.GL_TEXTURE_1D,
        dimension: '2d',
        format: E.GL_ALPHA,
        combineRgb: E.GL_INTERPOLATE,
        combineAlpha: E.GL_INTERPOLATE,
        sourceRgb: [E.GL_CONSTANT, E.GL_PREVIOUS, E.GL_TEXTURE],
        sourceAlpha: [E.GL_CONSTANT, E.GL_PREVIOUS, E.GL_TEXTURE],
        gen: [E.GL_EYE_LINEAR, 0, 0, 0]
    }
];

interface Material {
    depthTest: boolean;
    depthWrite: boolean;
    lighting: boolean;
    water: boolean;
    blend: [number, number];
    stages: number[];
}

const materials: Material[] = [
    { depthTest: true, depthWrite: true, lighting: true, water: false, blend: [E.GL_SRC_ALPHA, E.GL_ONE_MINUS_SRC_ALPHA], stages: [0] },
    { depthTest: true, depthWrite: false, lighting: true, water: false, blend: [E.GL_SRC_ALPHA, E.GL_ONE_MINUS_SRC_ALPHA], stages: [0] },
    { depthTest: true, depthWrite: false, lighting: false, water: false, blend: [E.GL_SRC_ALPHA, E.GL_ONE_MINUS_SRC_ALPHA], stages: [1] },
    { depthTest: true, depthWrite: false, lighting: false, water: false, blend: [E.GL_DST_COLOR, E.GL_ONE], stages: [2] },
    { depthTest: true, depthWrite: true, lighting: true, water: false, blend: [E.GL_SRC_ALPHA, E.GL_ONE_MINUS_SRC_ALPHA], stages: [] },
    { depthTest: true, depthWrite: true, lighting: true, water: false, blend: [E.GL_SRC_ALPHA, E.GL_ONE_MINUS_SRC_ALPHA], stages: [3, 4, 5] },
    { depthTest: true, depthWrite: true, lighting: true, water: true, blend: [E.GL_SRC_ALPHA, E.GL_ONE_MINUS_SRC_ALPHA], stages: [0, 6] },
    { depthTest: true, depthWrite: false, lighting: true, water: false, blend: [E.GL_SRC_ALPHA, E.GL_ONE_MINUS_SRC_ALPHA], stages: [] },
    { depthTest: true, depthWrite: true, lighting: false, water: false, blend: [E.GL_SRC_ALPHA, E.GL_ONE_MINUS_SRC_ALPHA], stages: [0] },
    { depthTest: true, depthWrite: false, lighting: false, water: false, blend: [E.GL_DST_COLOR, E.GL_ONE], stages: [7] },
    { depthTest: false, depthWrite: false, lighting: false, water: false, blend: [E.GL_SRC_ALPHA, E.GL_ONE_MINUS_SRC_ALPHA], stages: [] },
    { depthTest: true, depthWrite: true, lighting: true, water: false, blend: [E.GL_SRC_ALPHA, E.GL_ONE_MINUS_SRC_ALPHA], stages: [0, 8, 9] },
    { depthTest: true, depthWrite: true, lighting: true, water: false, blend: [E.GL_SRC_ALPHA, E.GL_ONE_MINUS_SRC_ALPHA], stages: [10, 11] }
];

// [vertex layout, material], in order of first observation.
export const loginPipelinePairs: [number, number][] = [
    [0, 0],
    [0, 1],
    [1, 2],
    [2, 3],
    [0, 4],
    [0, 5],
    [3, 5],
    [3, 4],
    [4, 0],
    [4, 5],
    [0, 6],
    [5, 0],
    [5, 5],
    [5, 6],
    [6, 0],
    [6, 5],
    [6, 6],
    [3, 0],
    [3, 6],
    [7, 0],
    [8, 0],
    [9, 7],
    [10, 0],
    [10, 5],
    [10, 6],
    [6, 4],
    [11, 0],
    [11, 6],
    [11, 5],
    [11, 4],
    [3, 8],
    [7, 4],
    [12, 0],
    [12, 5],
    [12, 8],
    [4, 4],
    [13, 0],
    [7, 5],
    [14, 4],
    [14, 0],
    [14, 5],
    [11, 8],
    [15, 0],
    [15, 5],
    [15, 8],
    [16, 4],
    [16, 0],
    [17, 0],
    [18, 0],
    [19, 0],
    [2, 9],
    [20, 4],
    [20, 0],
    [21, 4],
    [21, 0],
    [21, 5],
    [22, 10],
    [23, 11],
    [0, 12],
    [24, 7],
    [15, 4],
    [15, 6],
    [25, 4],
    [5, 4],
    [26, 5],
    [26, 4],
    [26, 0],
    [26, 6]
];

export function loginMaterial(index: number): { state: GlState; stages: IndexedStage[] } {
    const material = materials[index];
    const state = new GlState(3, true);
    for (const cap of [E.GL_CULL_FACE, E.GL_COLOR_MATERIAL, E.GL_FOG, E.GL_BLEND, E.GL_ALPHA_TEST]) state.setEnabled(cap, true);
    state.setEnabled(E.GL_DEPTH_TEST, material.depthTest);
    state.setEnabled(E.GL_LIGHTING, material.lighting);
    state.setEnabled(E.GL_VERTEX_PROGRAM_ARB, material.water);
    state.depthMask = material.depthWrite;
    state.depthFunc = E.GL_LEQUAL;
    state.alphaFunc = E.GL_GREATER;
    state.fog.mode = E.GL_LINEAR;
    [state.blendSrc, state.blendDst] = material.blend;
    const active = material.stages.map(i => {
        const spec = stages[i],
            unit = state.units[spec.unit],
            env = unit.env;
        env.mode = E.GL_COMBINE;
        if (spec.combineRgb !== undefined) env.combineRgb = spec.combineRgb;
        if (spec.combineAlpha !== undefined) env.combineAlpha = spec.combineAlpha;
        if (spec.rgbScale !== undefined) env.rgbScale = spec.rgbScale;
        if (spec.sourceRgb) env.sourceRgb.set(spec.sourceRgb);
        if (spec.sourceAlpha) env.sourceAlpha.set(spec.sourceAlpha);
        if (spec.operandRgb) env.operandRgb.set(spec.operandRgb);
        if (spec.operandAlpha) env.operandAlpha.set(spec.operandAlpha);
        spec.gen?.forEach((mode, i) => {
            unit.genEnabled[i] = mode !== 0;
            if (mode !== 0) unit.gen[i].mode = mode;
        });
        return { unit: spec.unit, target: spec.target, dimension: spec.dimension, format: spec.format, env };
    });
    return { state, stages: active };
}
