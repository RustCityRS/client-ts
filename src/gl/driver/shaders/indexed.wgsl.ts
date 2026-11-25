import { GLX as E, GlUnsupported } from '#/gl/driver/GlEnums';
import type GlState from '#/gl/driver/GlState';
import { fragmentOperations, type ImmediateStage } from './immediate.wgsl';

export interface IndexedStage extends ImmediateStage {
    target: number;
}

// OpenGL compatibility vertex processing. Light positions and eye planes have already been transformed
// by the modelview at glLightfv/glTexGenfv time. Vertex array inputs expand to (x, y, 0, 1) as in GL.
export function indexedShader(s: GlState, slots: number[], stages: IndexedStage[], presentationCamera = false): string {
    const input = (slot: number, fallback: string) => (slots.includes(slot) ? 'a' + slot : fallback);
    const args = slots.map(slot => '@location(' + slot + ') a' + slot + ':vec4f').join(',');
    const { bindings, body } = fragmentOperations(
        stages,
        s.isEnabled(E.GL_ALPHA_TEST) ? s.alphaFunc : E.GL_ALWAYS,
        s.alphaRef,
        stage => {
            const uv = 'v.uv' + stage.unit;
            const target = stage.target;
            if (target === E.GL_TEXTURE_1D) return 'vec2f(' + uv + '.x/' + uv + '.w,0.5)';
            if (target === E.GL_TEXTURE_CUBE_MAP) return uv + '.xyz';
            return uv + (target === E.GL_TEXTURE_3D ? '.xyz/' : '.xy/') + uv + '.w';
        },
        unit => 'u.envColors[' + unit + ']'
    );
    const tracked = s.isEnabled(E.GL_COLOR_MATERIAL) && s.colorMaterialFace !== E.GL_BACK;
    const water = s.isEnabled(E.GL_VERTEX_PROGRAM_ARB);
    let texgen = '';
    for (const { unit } of stages) {
        if (water) continue;
        texgen += 'var tex' + unit + ' = ' + input(3 + unit, 'u.currentTex[' + unit + ']') + ';\n';
        for (let coord = 0; coord < 4; coord++) {
            if (!s.units[unit].genEnabled[coord]) continue;
            const mode = s.units[unit].gen[coord].mode;
            const plane = 'u.planes[' + (unit * 4 + coord) + ']';
            const c = 'xyzw'[coord];
            let expression: string;
            if (mode === E.GL_OBJECT_LINEAR) expression = 'dot(pos,' + plane + ')';
            else if (mode === E.GL_EYE_LINEAR) expression = 'dot(eye,' + plane + ')';
            else if (mode === E.GL_NORMAL_MAP && coord < 3) expression = 'normal.' + c;
            else throw new GlUnsupported('indexed texgen mode ' + mode + ' coordinate ' + coord);
            texgen += 'tex' + unit + '.' + c + ' = ' + expression + ';\n';
        }
        texgen += 'out.uv' + unit + ' = u.textureMatrices[' + unit + '] * tex' + unit + ';\n';
    }
    if (water) {
        // rd.f's !!ARBvp1.0. Texture matrix 1 takes view position back to world coordinates.
        texgen = `
    let world = u.textureMatrices[1] * eye;
    let noiseAddress = vec2u(fract(vec2f(world.x + world.z, world.z - world.x) * 0.0001220703125) * 64.0);
    let noise = vec2f(u.local[noiseAddress.x].x,u.local[noiseAddress.y].y) * u.local[64].x;
    out.color = vec4f(primary.rgb * u.local[66].rgb, 1);
    out.eyeZ = clip.z;
`;
        for (const { unit } of stages) {
            if (unit === 0) texgen += 'out.uv0 = vec4f(world.xz * 0.0078125 + noise,world.w * 0.0078125,1);\n';
            else if (unit === 1) texgen += 'out.uv1 = vec4f(world.xz * 0.0009765625,u.local[65].xw);\n';
            else throw new GlUnsupported('water vertex program texture unit ' + unit);
        }
    }
    let fog = '';
    if (s.isEnabled(E.GL_FOG)) {
        const factor = s.fog.mode === E.GL_LINEAR ? '(u.fogParams.y - abs(v.eyeZ)) / (u.fogParams.y - u.fogParams.x)' : s.fog.mode === E.GL_EXP ? 'exp(-u.fogParams.z * abs(v.eyeZ))' : 'exp(-pow(u.fogParams.z * abs(v.eyeZ), 2.0))';
        fog = 'outColor = vec4f(mix(u.fogColor.rgb, outColor.rgb, saturate(' + factor + ')), outColor.a);';
    }
    return (
        bindings +
        `
struct Light {
    ambient: vec4f, diffuse: vec4f, position: vec4f, attenuation: vec4f
}
struct Uniforms {
    modelview: mat4x4f, projection: mat4x4f, normalMatrix: mat4x4f,
    textureMatrices: array<mat4x4f,3>, viewport: vec4f, currentColor: vec4f, currentNormal: vec4f,
    materialAmbient: vec4f, materialDiffuse: vec4f, emission: vec4f, sceneAmbient: vec4f,
    fogColor: vec4f, fogParams: vec4f, currentTex: array<vec4f,3>, planes: array<vec4f,12>,
    envColors: array<vec4f,3>,
    ${water ? 'local: array<vec4f,67>' : s.isEnabled(E.GL_LIGHTING) ? 'lights: array<Light,8>' : ''}
}
@group(1) @binding(0) var<uniform> u: Uniforms;
${presentationCamera ? '@group(2) @binding(0) var<uniform> presentationView: mat4x4f;' : ''}
struct Varying {
    @builtin(position) position: vec4f, @location(0) color: vec4f, @location(1) eyeZ: f32,
    ` +
        stages.map(t => '@location(' + (2 + t.unit) + ') uv' + t.unit + ': vec4f').join(',') +
        `
}
@vertex fn vertex(` +
        args +
        `) -> Varying {
    let pos = a0;
    let eye = u.modelview * pos;
    ${presentationCamera ? 'let renderedEye = presentationView * eye;' : ''}
    let clip = u.projection * ${presentationCamera ? 'renderedEye' : 'eye'};
    let normal = (u.normalMatrix * vec4f(` +
        input(2, 'u.currentNormal') +
        `.xyz,0)).xyz;
    var out: Varying;
    out.position = vec4f(clip.xy * u.viewport.xy + clip.w * u.viewport.zw, (clip.z + clip.w) * 0.5, clip.w);
    out.eyeZ = ${presentationCamera ? 'renderedEye' : 'eye'}.z;
    let primary = ` +
        input(1, 'u.currentColor') +
        `;
    out.color = primary;
    ` +
        (!water && s.isEnabled(E.GL_LIGHTING)
            ? `
    let ambient = ` +
              (tracked ? 'primary' : 'u.materialAmbient') +
              `;
    let diffuse = ` +
              (tracked ? 'primary' : 'u.materialDiffuse') +
              `;
    var color = u.emission.rgb + ambient.rgb * u.sceneAmbient.rgb;
    for (var i=0u; i<8u; i++) {
        let l = u.lights[i];
        if (l.attenuation.w == 0.0) { continue; }
        var direction = l.position.xyz;
        var attenuation = 1.0;
        if (l.position.w != 0.0) {
            direction = direction / l.position.w - eye.xyz / eye.w;
            let d = length(direction);
            attenuation = 1.0 / dot(l.attenuation.xyz, vec3f(1,d,d*d));
        }
        let nDotL = max(dot(normal, normalize(direction)), 0.0);
        color += attenuation * (l.ambient.rgb * ambient.rgb + l.diffuse.rgb * diffuse.rgb * nDotL);
    }
    out.color = saturate(vec4f(color,diffuse.a));
    `
            : '') +
        texgen +
        `
    return out;
}
@fragment fn fragment(v: Varying) -> @location(0) vec4f {
    var outColor = v.color;
    ` +
        body +
        '\n' +
        fog +
        '\nreturn outColor;\n}'
    );
}
