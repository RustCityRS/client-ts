// The clear-quad pipeline (HD_PLAN 2.3 clear row, 2.4): glClear when it cannot be a render-pass loadOp, i.e. with the
// scissor test on (GL's glClear honours the scissor box) or with DEPTH_BUFFER_BIT under DepthMask(false) next to a
// colour clear. A full-screen triangle writes the clear colour and, through frag_depth, the clear depth. The pipeline
// state does the rest: no blending, depth compare 'always', colour write mask 0 when COLOR_BUFFER_BIT is absent and
// depth writes only for DEPTH_BUFFER_BIT with DepthMask(true). The scissor rect is set to the GL scissor box.
//
// Uniform layout (32 bytes, one dynamic-offset slot per clear): color vec4f at 0, depth f32 at 16.

struct ClearParams {
    color: vec4f,
    depth: f32,
}

@group(0) @binding(0) var<uniform> params: ClearParams;

@vertex
fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
    var corners = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
    return vec4f(corners[i], 0.0, 1.0);
}

struct ClearOut {
    @location(0) color: vec4f,
    @builtin(frag_depth) depth: f32,
}

@fragment
fn fs() -> ClearOut {
    var out: ClearOut;
    out.color = params.color;
    out.depth = params.depth;
    return out;
}
