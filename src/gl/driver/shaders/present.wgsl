// Presentation blit (HD_PLAN 1.4, 2.4 swap row): copies the front texture (rgba8unorm, the last swapped frame) into the
// canvas texture, whose format may differ (bgra8unorm on most platforms). textureLoad, no filtering: one texel per
// pixel, unorm passthrough. Alpha is written as 1 (the canvas is configured with alphaMode 'opaque' anyway, because
// glDrawPixels writes destination alpha 0).
//
// Orientation: the driver keeps GL window row y at texture row (height - 1 - y), which is the row order WebGPU
// rasterizes GL clip space into. The front texture is therefore already top-down and the blit does not flip.

@group(0) @binding(0) var src: texture_2d<f32>;

@vertex
fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
    var corners = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
    return vec4f(corners[i], 0.0, 1.0);
}

@fragment
fn fs(@builtin(position) pos: vec4f) -> @location(0) vec4f {
    let c = textureLoad(src, vec2i(pos.xy), 0);
    return vec4f(c.rgb, 1.0);
}
