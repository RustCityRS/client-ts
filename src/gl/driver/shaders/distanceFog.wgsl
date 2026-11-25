// The traversal radius is horizontal. A pitched camera still sees haze on distant
// ground, and the loaded map edge can shorten the fade in either direction.
fn distanceFogVisibility(offset: vec2f, mapScale: vec4f, nativeVisibility: f32, radius: f32) -> f32 {
    let mapEdge = max(-offset * mapScale.xy, offset * mapScale.zw);
    let range = max(length(offset) / radius, max(mapEdge.x, mapEdge.y));
    return min(nativeVisibility, 1.0 - smoothstep(0.60, 0.96, range));
}
