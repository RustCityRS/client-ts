import { GL } from '#/jogl/GL';

// GL enum values the driver needs beyond src/jogl/GL.ts (that object holds only what the jar and JOGL's GLU pass).
// Host code, not a Java port: values are from the OpenGL 2.1 compatibility spec / glext.h. Everything the jar itself
// passes is read from the GL object; this file adds the GL-legal neighbours the driver must recognise (initial
// values, query pnames, error-free alternatives it rejects on purpose) so that every literal has a name.
export const GLX = Object.freeze({
    ...GL,
    GL_ZERO: 0,
    GL_NONE: 0,
    GL_ONE_MINUS_SRC_COLOR: 769,
    GL_DST_ALPHA: 772,
    GL_ONE_MINUS_DST_ALPHA: 773,
    GL_ONE_MINUS_DST_COLOR: 775,
    GL_SRC_ALPHA_SATURATE: 776,

    GL_NEVER: 512,
    GL_LESS: 513,
    GL_EQUAL: 514,
    GL_NOTEQUAL: 517,
    GL_GEQUAL: 518,
    GL_ALWAYS: 519,

    GL_FRONT_AND_BACK: 1032,
    GL_CCW: 2305,

    GL_POINT: 6912,
    GL_LINE: 6913,
    GL_FLAT: 7424,

    GL_EXP: 2048,
    GL_EXP2: 2049,
    GL_FOG_INDEX: 2913,

    GL_DONT_CARE: 4352,
    GL_NICEST: 4354,

    GL_SPECULAR: 4610,
    GL_SPOT_DIRECTION: 4612,
    GL_SPOT_EXPONENT: 4613,
    GL_SPOT_CUTOFF: 4614,
    GL_EMISSION: 5632,
    GL_SHININESS: 5633,

    GL_COMPILE_AND_EXECUTE: 4865,

    GL_DECAL: 8449,
    GL_ALPHA_SCALE: 3356,
    GL_OPERAND2_RGB: 34194,
    GL_OPERAND0_ALPHA: 34200,
    GL_OPERAND1_ALPHA: 34201,
    GL_OPERAND2_ALPHA: 34202,
    GL_DOT3_RGB: 34478,
    GL_DOT3_RGBA: 34479,

    GL_SPHERE_MAP: 9218,
    GL_REFLECTION_MAP: 34066,

    GL_NEAREST_MIPMAP_NEAREST: 9984,
    GL_LINEAR_MIPMAP_NEAREST: 9985,
    GL_NEAREST_MIPMAP_LINEAR: 9986,
    GL_CLAMP: 10496,
    GL_MIRRORED_REPEAT: 33648,

    GL_TEXTURE_HEIGHT: 4097,
    GL_TEXTURE_INTERNAL_FORMAT: 4099,
    GL_TEXTURE_BORDER: 4101,
    GL_TEXTURE_DEPTH: 32881,
    GL_PROXY_TEXTURE_3D: 32880,
    GL_MAX_3D_TEXTURE_SIZE: 32883,
    GL_MAX_CUBE_MAP_TEXTURE_SIZE: 34076,

    GL_DYNAMIC_DRAW: 35048,

    GL_POINT_FADE_THRESHOLD_SIZE: 33064,

    // GL errors (glGetError; not in the shipped interface, kept by the driver for tests and diagnostics)
    GL_NO_ERROR: 0,
    GL_INVALID_ENUM: 1280,
    GL_INVALID_VALUE: 1281,
    GL_INVALID_OPERATION: 1282,
    GL_STACK_OVERFLOW: 1283,
    GL_STACK_UNDERFLOW: 1284,
    GL_OUT_OF_MEMORY: 1285
} as const);

// Thrown for any GL use outside the jar's inventory (HD_PLAN 1.2: "unused GL features fail loudly"): an enum value the
// jar never passes, a feature the WebGPU emulation does not implement, or (in v1) a rendering entry point that a later
// driver version implements. It is a plain Error, so a port slip surfaces at once instead of drawing something wrong.
// It is not a GLException: no Java code catches it on purpose.
export class GlUnsupported extends Error {
    constructor(what: string) {
        super('WebGpuGL: ' + what);
        this.name = 'GlUnsupported';
    }
}

// Rendering entry points that driver v1 does not implement yet; `batch` names the HD_PLAN batch whose driver step
// implements them (H2: immediate mode, pixels, front copy; H3: VBO/elements drawing).
export function notYet(batch: 'H2' | 'H3', what: string): GlUnsupported {
    return new GlUnsupported(batch + ': ' + what + ' is not implemented in driver v1');
}

export function enumName(value: number): string {
    for (const [k, v] of Object.entries(GLX)) {
        if (v === value && k !== 'GL_NONE' && k !== 'GL_NO_ERROR') return k + ' (' + value + ')';
    }
    return String(value);
}
