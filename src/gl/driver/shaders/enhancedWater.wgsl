// ahl and the 742 DirectX EnvMappedWater programs. A 742 tile is 512 fine units.
fn decodeWaterNormal(wave: vec4f) -> vec4f {
    return select(vec4f(0.0, 1.0, 0.0, 0.5), vec4f(wave.xyz * 2.0 - 1.0, wave.w), wave.y > 0.0);
}

struct WaterLight {
    ray: vec3f,
    fresnel: f32,
    diffuse: f32,
    specular: f32
}

fn waterLight(wave: vec4f, toEye: vec3f, nativeTowardSun: vec3f) -> WaterLight {
    let eye = toEye * inverseSqrt(max(dot(toEye, toEye), 0.0001));
    let light = -nativeTowardSun * inverseSqrt(max(dot(nativeTowardSun, nativeTowardSun), 0.0001));
    let ray = reflect(eye, wave.xyz);
    let fresnel = 1.0 - abs(dot(ray, wave.xyz));
    let specular = pow(saturate(dot(ray, light)), 32.0);
    return WaterLight(ray, fresnel, dot(light, wave.xyz) * 2.0 * (1.0 - fresnel), specular);
}

fn shadeWater(wave: vec4f, light: WaterLight, environment: vec3f, bed: vec2f, tint: vec3f) -> vec4f {
    let sun = enhancedView.sunColour.rgb;
    let surface = vec4f(mix(tint, tint * (environment + (light.diffuse + light.specular) * sun), light.fresnel), 1.0);

    // EnvMappedSea (effect 4). Foam follows bed depth, while deep water transmits the drawn bed.
    let breaking = saturate(bed.x / 256.0 - 0.3 * wave.w);
    let crest = pow(1.0001 - breaking, 5.0) - 0.5;
    let foam = 1.0 - 4.0 * crest * crest;
    let opacity = light.fresnel * breaking * smoothstep(0.0, 40.0, bed.x);
    let sea = mix(vec4f(environment, opacity), vec4f(0.4 + 0.1 * wave.w), foam) + vec4f(light.specular * sun * breaking, 0.0);
    return mix(surface, sea, bed.y);
}
