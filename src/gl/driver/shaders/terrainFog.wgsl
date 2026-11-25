// The water material already shades its submerged bed. The air in front of it
// has the same colour as the air in front of the surface and the adjoining bank.
fn applyTerrainFog(colour: vec3f, world: vec3f, visibility: f32) -> vec3f {
    if (visibility >= 1.0) { return colour; }
    if (enhancedView.fogHeight.z == 0.0) { return mix(enhancedView.sky.rgb, colour, visibility); }
    if (visibility <= 0.0) { return enhancedView.horizon.rgb; }

    // A texel is centred in each four-tile cell. World Y increases downwards.
    let uv = world.xz / (512.0 * vec2f(textureDimensions(fogTerrain)));
    let field = textureSampleLevel(fogTerrain, fogSampler, uv, 0.0);
    let ground = enhancedView.fogHeight.x + field.a * enhancedView.fogHeight.y;
    let altitude = saturate((ground - world.y) / 512.0);
    var tint = mix(field.rgb, enhancedView.horizon.rgb, altitude);
    tint = mix(enhancedView.horizon.rgb, tint, smoothstep(0.0, 0.8, visibility));
    return mix(tint, colour, visibility);
}
