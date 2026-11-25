@group(0) @binding(0) var scene: texture_2d<f32>;
@group(0) @binding(1) var linearSampler: sampler;
@group(0) @binding(2) var<uniform> viewport: vec4u;
@group(0) @binding(3) var source: texture_2d<f32>;
@group(0) @binding(5) var sceneDepth: texture_depth_2d;
struct LampView { projection: mat4x4f, eyeToWorld: mat4x4f, horizon: vec4f, fogHeight: vec4f, fogMapScale: vec4f, fogRange: vec2f }
@group(0) @binding(6) var<uniform> view: LampView;
@group(0) @binding(7) var<uniform> camera: mat4x4f;
override useCoverage: bool = false;

@vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
    let xy = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
    return vec4f(xy * 2.0 - 1.0, 0.0, 1.0);
}

fn bloomVisibility(p: vec2i, sampleIndex: i32) -> f32 {
    let depthSample = textureLoad(sceneDepth, p, sampleIndex);
    let projection = view.projection;
    let depth = projection[3].z / (2.0 * depthSample - 1.0 + projection[2].z);
    let uv = (vec2f(p) + 0.5 - vec2f(viewport.xy)) / vec2f(viewport.zw);
    let ndc = uv * vec2f(2.0, -2.0) + vec2f(-1.0, 1.0);
    let xy = (ndc + projection[2].xy) * depth / vec2f(projection[0].x, projection[1].y);
    // Undo the refresh-rate camera transform to recover the source eye used by the world shader.
    let rotation = mat3x3f(camera[0].xyz, camera[1].xyz, camera[2].xyz);
    let sourceEye = transpose(rotation) * (vec3f(xy, -depth) - camera[3].xyz);
    let offset = (view.eyeToWorld * vec4f(sourceEye, 0.0)).xz;
    let nativeVisibility = saturate((view.fogRange.y - depth) / (view.fogRange.y - view.fogRange.x));
    return distanceFogVisibility(offset, view.fogMapScale, nativeVisibility, view.fogRange.y);
}

// Estimate the surface colour before atmospheric scattering so a bright horizon
// cannot seed glow on an otherwise dark emitter. Callers exclude zero visibility.
fn bloomSurfaceColour(c: vec3f, visibility: f32) -> vec3f {
    return saturate((c - (1.0 - visibility) * view.horizon.rgb) / visibility);
}

@fragment fn extract(@builtin(position) pixel: vec4f) -> @location(0) vec4f {
    let base = viewport.xy + vec2u(pixel.xy) * 4u;
    let last = viewport.xy + viewport.zw - 1u;
    var sum = vec3f(0);
    for (var y = 0u; y < 4u; y++) {
        for (var x = 0u; x < 4u; x++) {
            let p = vec2i(min(base + vec2u(x, y), last));
            let sampleIndex = 0i;
            let c = textureLoad(scene, p, sampleIndex);
            let weights = vec3f(0.2126, 0.7152, 0.0722);
            let coverage = select(0.0, 1.0 - c.a, useCoverage);
            if (coverage == 0.0 && dot(c.rgb, weights) <= 0.86) { continue; }
            let visibility = bloomVisibility(p, sampleIndex);
            if (visibility <= 0.0) { continue; }
            let sourceRGB = bloomSurfaceColour(c.rgb, visibility);
            let highlight = 0.045 * smoothstep(0.86, 1.0, dot(sourceRGB, weights));
            let emitter = coverage * smoothstep(0.16, 0.74, max(sourceRGB.r, max(sourceRGB.g, sourceRGB.b)));
            sum += sourceRGB * (visibility * max(highlight, emitter));
        }
    }
    return vec4f(sum / 16.0, 1.0);
}

struct Lamp {
    @builtin(position) position: vec4f,
    @location(0) offset: vec2f,
    @location(1) @interpolate(flat) centre: vec2f,
    @location(2) @interpolate(flat) depthRadius: vec2f,
    @location(3) @interpolate(flat) colour: vec4f,
}

@vertex fn lampVs(@builtin(vertex_index) vertex: u32, @location(0) eyeRadius: vec4f, @location(1) colour: vec4f) -> Lamp {
    let corner = array<vec2f,6>(vec2f(-1,-1),vec2f(1,-1),vec2f(-1,1),vec2f(-1,1),vec2f(1,-1),vec2f(1,1))[vertex];
    let eye = camera * vec4f(eyeRadius.xyz, 1);
    let clip = view.projection * eye;
    let extent = vec2f(view.projection[0][0], view.projection[1][1]) * eyeRadius.w;
    let centre = (clip.xy / clip.w * vec2f(0.5,-0.5) + 0.5) * vec2f(viewport.zw) + vec2f(viewport.xy);
    let nativeVisibility = saturate((view.fogRange.y - abs(eye.z)) / (view.fogRange.y - view.fogRange.x));
    let offsetXZ = (view.eyeToWorld * vec4f(eyeRadius.xyz, 0.0)).xz;
    let visibility = distanceFogVisibility(offsetXZ, view.fogMapScale, nativeVisibility, view.fogRange.y);
    return Lamp(vec4f(clip.xy + corner * extent, 0.5 * clip.w, clip.w), corner, centre, vec2f(-eye.z, eyeRadius.w), vec4f(colour.rgb, visibility));
}

fn eyeDepth(p: vec2i) -> f32 {
    return view.projection[3][2] / (2.0 * textureLoad(sceneDepth, p, 0) - 1.0 + view.projection[2][2]);
}

@fragment fn lamp(i: Lamp) -> @location(0) vec4f {
    let radius2 = dot(i.offset, i.offset);
    if (radius2 >= 1.0 || i.colour.a == 0.0) { discard; }
    let lo = vec2i(viewport.xy);
    let hi = lo + vec2i(viewport.zw) - 1;
    let p = clamp(lo + vec2i(i.position.xy * 4.0), lo, hi);
    let depth = i.depthRadius.x;
    // A hidden emitter cannot seed glow from the foreground wall. For a visible emitter,
    // accept only nearby surfaces, so a light projected against empty sky contributes nothing.
    if (eyeDepth(clamp(vec2i(i.centre), lo, hi)) < depth - max(2.0, 0.002 * depth)) { discard; }
    let separation = eyeDepth(p) - depth;
    let shell = 1.0 - smoothstep(i.depthRadius.y, 2.0 * i.depthRadius.y, abs(separation));
    let c = bloomSurfaceColour(textureLoad(scene, p, 0).rgb, i.colour.a);
    let peak = max(c.r, max(c.g, c.b));
    let lightPeak = max(max(i.colour.r, i.colour.g), i.colour.b);
    let hue = i.colour.rgb / max(0.001, lightPeak);
    let agreement = dot(c / max(0.001, peak), hue) / max(1.0, dot(hue, hue));
    let surface = smoothstep(0.16, 0.62, peak) * smoothstep(0.4, 0.85, agreement);
    let falloff = (1.0 - radius2) * (1.0 - radius2);
    return vec4f(hue * surface * shell * falloff * min(1.4, 1.7 * lightPeak) * i.colour.a, 0.0);
}

// The 742 17-tap Gaussian, normalized to unit energy. Each linear read combines two adjacent taps.
fn gaussian(pixel: vec2f, axis: vec2f) -> vec3f {
    let size = vec2f(textureDimensions(source));
    let uv = pixel / size;
    let step = axis / size;
    let weights = vec4f(0.191011,0.140429,0.080715,0.036269);
    let offsets = vec4f(1.476580,3.445530,5.414899,7.384912);
    var sum = textureSampleLevel(source, linearSampler, uv, 0).rgb * 0.103153;
    for (var i=0u; i<4u; i++) {
        let off = step * offsets[i];
        sum += weights[i] * (textureSampleLevel(source, linearSampler, uv + off, 0).rgb + textureSampleLevel(source, linearSampler, uv - off, 0).rgb);
    }
    return sum;
}

@fragment fn horizontal(@builtin(position) p: vec4f) -> @location(0) vec4f {
    return vec4f(gaussian(p.xy, vec2f(1,0)), 1);
}

@fragment fn vertical(@builtin(position) p: vec4f) -> @location(0) vec4f {
    // Blend the tight, unblurred source back in while reusing its original quarter-resolution texture.
    return vec4f(gaussian(p.xy, vec2f(0,1)), 0.42);
}

@fragment fn composite(@builtin(position) pixel: vec4f) -> @location(0) vec4f {
    let uv = (pixel.xy - vec2f(viewport.xy)) / (4.0 * vec2f(textureDimensions(source)));
    return vec4f(textureSampleLevel(source, linearSampler, uv, 0).rgb * 0.88, 1);
}
