struct Light {
    ambient: vec4f, diffuse: vec4f, position: vec4f, attenuation: vec4f
}

struct Uniforms {
    modelview: mat4x4f, projection: mat4x4f, normalMatrix: mat4x4f,
    textureMatrices: array<mat4x4f,3>, viewport: vec4f, currentColor: vec4f, currentNormal: vec4f,
    materialAmbient: vec4f, materialDiffuse: vec4f, emission: vec4f, sceneAmbient: vec4f,
    fogColor: vec4f, fogParams: vec4f, currentTex: array<vec4f,3>, planes: array<vec4f,12>,
    envColors: array<vec4f,3>,
    /* @UNIFORM_FIELDS */
}

@group(1) @binding(0) var<uniform> u: Uniforms;
/* @CAMERA_BINDING */

struct Varying {
    @builtin(position) position: vec4f, @location(0) color: vec4f, @location(1) eyeZ: f32,
    /* @VARYINGS */
}

@vertex fn vertex(/* @VERTEX_INPUTS */) -> Varying {
    let pos = a0;
    let eye = u.modelview * pos;
    /* @CAMERA_TRANSFORM */
    let clip = u.projection * /* @VIEW_POSITION */;
    let normal = (u.normalMatrix * vec4f(/* @NORMAL_INPUT */.xyz,0)).xyz;
    var out: Varying;
    out.position = vec4f(clip.xy * u.viewport.xy + clip.w * u.viewport.zw, (clip.z + clip.w) * 0.5, clip.w);
    out.eyeZ = /* @VIEW_POSITION */.z;
    let primary = /* @COLOR_INPUT */;
    out.color = primary;
    /* @LIGHTING */
    /* @TEXGEN */
    return out;
}

@fragment fn fragment(v: Varying) -> @location(0) vec4f {
    var outColor = v.color;
    /* @FRAGMENT_OPERATIONS */
    /* @FOG */
    return outColor;
}
