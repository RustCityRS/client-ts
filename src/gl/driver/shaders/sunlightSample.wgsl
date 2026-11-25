const sunSearch = array<vec2f, 5>(
    vec2f(0), vec2f(-5, -5), vec2f(5, -5), vec2f(-5, 5), vec2f(5, 5)
);
const sunDisk = array<vec2f, 8>(
    vec2f(0.39, -0.14), vec2f(-0.39, 0.14), vec2f(0.14, 0.39), vec2f(-0.14, -0.39),
    vec2f(0.82, 0.32), vec2f(-0.82, -0.32), vec2f(0.32, -0.82), vec2f(-0.32, 0.82)
);

fn sunlightAt(light: vec3f, dx: vec3f, dy: vec3f) -> f32 {
    let edge = max(abs(light.x), abs(light.y));
    if (edge >= 1.0 || light.z <= 0.0 || light.z >= 1.0) { return 1.0; }
    let dims = vec2i(textureDimensions(sunDepth));
    let scale = vec2f(0.5, -0.5);
    let uv = light.xy * scale + 0.5;
    let pixel = uv * vec2f(dims);
    let tx = dx.xy * scale * vec2f(dims);
    let ty = dy.xy * scale * vec2f(dims);

    // Depth on the receiver plane at each sample, including pitched terrain and walls.
    let determinant = tx.x * ty.y - tx.y * ty.x;
    var gradient = vec2f(0);
    if (abs(determinant) > 0.0000001) {
        gradient = clamp(vec2f(ty.y * dx.z - tx.y * dy.z, tx.x * dy.z - ty.x * dx.z) / determinant, vec2f(-0.003), vec2f(0.003));
    }
    let depth = light.z - 0.000065 - min(0.0015, 0.5 * (abs(gradient.x) + abs(gradient.y)));
    let shade = 0.36 * (1.0 - smoothstep(0.86, 1.0, edge));
    let centre = textureSampleCompareLevel(sunDepth, sunSampler, uv, depth);
    var separation = 0.0;
    var blockers = 0.0;
    for (var i = 0u; i < 5u; i++) {
        let cell = clamp(vec2i(floor(pixel + sunSearch[i])), vec2i(0), dims - 1);
        let receiver = depth + dot(vec2f(cell) + 0.5 - pixel, gradient);
        let gap = receiver - textureLoad(sunDepth, cell, 0);
        separation += max(0.0, gap);
        blockers += select(0.0, 1.0, gap > 0.0);
    }
    if (blockers == 0.0) { return 1.0 - shade * (1.0 - centre); }

    // The projected disk grows with the separation from the occluder. Cap it at the
    // blocker search footprint. Leave a subtexel contact edge and antialias distant pixels.
    let sun = enhancedView.penumbra;
    let contact = clamp(0.35 * max(length(tx), length(ty)), 0.65, 1.65);
    let radius = min(5.5, contact + sun.z * separation / blockers);
    let major = sun.xy * radius;
    let minor = vec2f(-sun.y, sun.x) * max(contact, radius * sun.w);
    var visible = centre;
    for (var i = 0u; i < 8u; i++) {
        let offset = major * sunDisk[i].x + minor * sunDisk[i].y;
        visible += textureSampleCompareLevel(sunDepth, sunSampler, uv + offset / vec2f(dims), depth + dot(offset, gradient));
    }
    return 1.0 - shade * (1.0 - visible / 9.0);
}
