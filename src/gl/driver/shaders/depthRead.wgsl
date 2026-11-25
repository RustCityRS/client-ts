// Diagnostic depth readback (tests only): depth24plus cannot be copied to a buffer, so a compute pass loads each
// texel (sample 0 of a multisampled buffer) and stores it as f32, top row first.

@group(0) @binding(0) var depthTex: texture_depth_2d;
@group(0) @binding(1) var<storage, read_write> outDepth: array<f32>;
@group(0) @binding(2) var<uniform> size: vec4u;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id: vec3u) {
    if (id.x >= size.x || id.y >= size.y) {
        return;
    }
    outDepth[id.y * size.x + id.x] = textureLoad(depthTex, vec2i(id.xy), 0);
}
