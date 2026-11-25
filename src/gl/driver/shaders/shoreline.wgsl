// Signed distance is measured landward from the edge of the 530 water mesh.
// The bank and the water sheet evaluate the same moving contact in 530 fine units.
fn shoreWave(tile: vec2f, time: f32) -> vec3f {
    // The map origin moves in blocks of eight tiles. These wave phases stay in
    // place across a map rebuild and travel along differently oriented banks.
    let phase = tile * (6.2831853 / 8.0);
    let bend = sin(phase.x - phase.y);
    let a = phase.x + 2.0 * phase.y + 1.25 * time + 0.7 * bend;
    let b = 2.0 * phase.x - phase.y - 1.83 * time;
    let height = 5.0 * sin(a) + 2.0 * sin(b);
    // The surface normal is the slope of this same water level, so the sheen
    // follows the advancing water on both sides of the original mesh boundary.
    let direction = vec2f(1.0, 2.0) + 0.7 * cos(phase.x - phase.y) * vec2f(1.0, -1.0);
    let slope = (5.0 * cos(a) * direction + 2.0 * cos(b) * vec2f(2.0, -1.0)) * (6.2831853 / (8.0 * 128.0));
    return vec3f(slope, height);
}

fn shorelineContact(level: f32, depth: f32, distance: f32) -> f32 {
    // A steep bank limits the rise by height. On flat ground the wash runs
    // out of momentum within a tenth of a tile.
    return min(depth + level, level - 72.0 * distance);
}

fn shorelineFilm(wave: vec3f, eye: vec3f, sun: vec3f, contact: f32, pixel: f32, lod: f32) -> vec4f {
    let normal = normalize(vec3f(-wave.x, 1.0, -wave.y));
    let light = waterLight(vec4f(normal, 0.0), eye, sun);
    let reflection = textureSampleLevel(waterEnvironment, waterSampler, light.ray, lod).rrr;
    let wet = smoothstep(-pixel, pixel, contact);
    // A thin film reflects about 2% head-on. The rough bed breaks up the
    // reflection at grazing angles. Most of the moving edge is damp ground.
    let reflectance = min(0.25, 0.02 + 0.98 * pow(saturate(light.fresnel), 5.0));
    let opacity = reflectance + 0.16 * (1.0 - reflectance);
    let radiance = reflection + 0.25 * enhancedView.sunColour.rgb * light.specular;
    // Both render paths blend straight alpha over the already-lit terrain.
    return vec4f(radiance * (reflectance / opacity), wet * opacity);
}

fn shorelineField(tile: vec2f) -> vec2f {
    let size = vec2f(textureDimensions(bankField));
    let uv = clamp(tile * 4.0 / size, 0.5 / size, 1.0 - 0.5 / size);
    let field = textureSampleLevel(bankField, waterSampler, uv, 0.0).rg;
    return vec2f(field.r - 0.5, -2040.0 * field.g);
}

fn shallowWater(tile: vec2f, bed: vec2f, eye: vec3f, sun: vec3f, original: vec4f) -> vec4f {
    let footprint = max(length(dpdx(tile)), length(dpdy(tile)));
    let pixel = clamp(max(footprint * 72.0, fwidth(bed.x) * 0.25), 0.55, 3.0);
    if (bed.y <= 0.0 || bed.x >= 192.0) { return original; }
    // Interpolate the four recorded corner depths, independent of the diagonal
    // chosen when the surface tile was triangulated.
    let size = vec2f(textureDimensions(waterBed));
    let uv = (clamp(tile, vec2f(0.0), size - 1.0) + 0.5) / size;
    let depth = textureSampleLevel(waterBed, waterSampler, uv, 0.0).r * 2040.0;
    let distance = shorelineField(tile).x;
    if (distance > 0.13) { return original; }
    let wave = shoreWave(tile, enhancedView.sunAndTime.w);
    let contact = shorelineContact(wave.z, depth, distance);
    let film = shorelineFilm(wave, eye, sun, contact, pixel, clamp(log2(max(1.0, footprint * 16.0)), 0.0, 7.0));
    let shallow = bed.y * (1.0 - smoothstep(72.0, 192.0, bed.x));
    return mix(original, film, shallow);
}

fn bankFilm(position: vec3f, eye: vec3f, sun: vec3f) -> vec4f {
    let tile = position.xy;
    let field = shorelineField(tile);
    let depth = position.z - field.y;
    let footprint = max(length(dpdx(tile)), length(dpdy(tile)));
    let pixel = clamp(max(footprint * 72.0, fwidth(depth)), 0.55, 3.0);
    if (field.x > 0.13 || field.x < -0.45 || depth < -7.0 - pixel) { return vec4f(0.0); }
    let wave = shoreWave(tile, enhancedView.sunAndTime.w);
    let contact = shorelineContact(wave.z, depth, field.x);
    if (contact <= -pixel) { return vec4f(0.0); }
    let lod = clamp(log2(max(1.0, footprint * 16.0)), 0.0, 7.0);
    return shorelineFilm(wave, eye, sun, contact, pixel, lod);
}
