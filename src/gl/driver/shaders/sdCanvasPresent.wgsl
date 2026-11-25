struct Vertex {
    @builtin(position) position: vec4f,
    @location(0) @interpolate(flat) stride: u32,
}
@vertex fn vertex(@builtin(vertex_index) vertex: u32, @builtin(instance_index) stride: u32) -> Vertex {
    let corners = array(vec2f(-1, -1), vec2f(3, -1), vec2f(-1, 3));
    return Vertex(vec4f(corners[vertex], 0, 1), stride);
}
@group(0) @binding(0) var<storage, read> pixels: array<u32>;
@fragment fn fragment(v: Vertex) -> @location(0) vec4f {
    let rgb = pixels[u32(v.position.y) * v.stride + u32(v.position.x)];
    return vec4f(vec4u((rgb >> 16u) & 255u, (rgb >> 8u) & 255u, rgb & 255u, 255u)) / 255.0;
}
