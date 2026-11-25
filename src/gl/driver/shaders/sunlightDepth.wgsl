@group(0) @binding(0) var<uniform> worldToLight: mat4x4f;

fn project(p: vec3f, offset: vec3f, turn: vec2f) -> vec4f {
    let rotated = vec3f(p.x * turn.y + p.z * turn.x, p.y, p.z * turn.y - p.x * turn.x);
    return worldToLight * vec4f(rotated + offset, 1.0);
}

@vertex fn vertex(@location(0) p: vec3f, @location(1) offset: vec3f, @location(2) turn: vec2f) -> @builtin(position) vec4f {
    return project(p, offset, turn);
}

struct Coverage {
    @builtin(position) position: vec4f, @location(0) alpha: f32, @location(1) uv: vec2f,
}

@vertex fn coloured(@location(0) p: vec3f, @location(1) offset: vec3f, @location(2) turn: vec2f, @location(3) colour: vec4f) -> Coverage {
    return Coverage(project(p,offset,turn), colour.a, vec2f(0));
}

@vertex fn textured(@location(0) p: vec3f, @location(1) offset: vec3f, @location(2) turn: vec2f, @location(3) colour: vec4f, @location(4) uv: vec2f) -> Coverage {
    return Coverage(project(p,offset,turn), colour.a, uv);
}

@fragment fn alpha(i: Coverage) {
    if (i.alpha < 0.5) { discard; }
}

@group(1) @binding(0) var coverageMap: texture_2d<f32>;
@group(1) @binding(1) var coverageSampler: sampler;
@fragment fn cutout(i: Coverage) {
    if (textureSampleLevel(coverageMap, coverageSampler, i.uv, 0.0).r * i.alpha < 0.5) { discard; }
}
