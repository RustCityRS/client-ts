import { GLX as E, GlUnsupported } from '#/gl/driver/GlEnums';
import type GlState from '#/gl/driver/GlState';
import { fragmentOperations, type ImmediateStage } from './immediateShader';
import indexedSource from './indexed.wgsl' with { type: 'text' };
import lightingSource from './indexedLighting.wgsl' with { type: 'text' };
import waterSource from './indexedWater.wgsl' with { type: 'text' };
import sunlightSource from './sunlightSample.wgsl' with { type: 'text' };
import distanceFogSource from './distanceFog.wgsl' with { type: 'text' };
import terrainFogSource from './terrainFog.wgsl' with { type: 'text' };
import enhancedWaterSource from './enhancedWater.wgsl' with { type: 'text' };
import shorelineSource from './shoreline.wgsl' with { type: 'text' };

export interface IndexedStage extends ImmediateStage {
    target: number;
}

// OpenGL compatibility vertex processing. Light positions and eye planes have already been transformed
// by the modelview at glLightfv/glTexGenfv time. Vertex array inputs expand to (x, y, 0, 1) as in GL.
export function indexedShader(s: GlState, slots: number[], stages: IndexedStage[], presentationCamera = false, sunlight = false, enhancedWater: boolean | 'shore' | 'bank' | 'bed' = false, emissive = false): string {
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
        unit => 'u.envColors[' + unit + ']',
        enhancedWater === 'bed'
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
        texgen = waterSource;
        for (const { unit } of stages) {
            if (unit === 0) texgen += 'out.uv0 = vec4f(world.xz * 0.0078125 + noise,world.w * 0.0078125,1);\n';
            else if (unit === 1) texgen += 'out.uv1 = vec4f(world.xz * 0.0009765625,u.local[65].xw);\n';
            else throw new GlUnsupported('water vertex program texture unit ' + unit);
        }
    }
    let fog = '';
    const terrainFog = sunlight && s.isEnabled(E.GL_FOG) && s.fog.mode === E.GL_LINEAR;
    // The ground-light mesh adds destination * light to the already fogged ground.
    const groundLight = sunlight && s.isEnabled(E.GL_BLEND) && s.blendSrc === E.GL_DST_COLOR && s.blendDst === E.GL_ONE;
    if (s.isEnabled(E.GL_FOG)) {
        const factor = s.fog.mode === E.GL_LINEAR ? '(u.fogParams.y - abs(v.eyeZ)) / (u.fogParams.y - u.fogParams.x)' : s.fog.mode === E.GL_EXP ? 'exp(-u.fogParams.z * abs(v.eyeZ))' : 'exp(-pow(u.fogParams.z * abs(v.eyeZ), 2.0))';
        if (terrainFog) {
            const visibility = 'let visibility = distanceFogVisibility(v.fogWorld.xz - enhancedView.eyeToWorld[3].xz, enhancedView.fogMapScale, saturate(' + factor + '), u.fogParams.y);\n';
            const rgb = groundLight ? 'outColor.rgb * visibility' : 'applyTerrainFog(outColor.rgb, v.fogWorld, visibility)';
            fog = visibility + 'outColor = vec4f(' + rgb + ', outColor.a);';
        } else fog = 'outColor = vec4f(mix(u.fogColor.rgb, outColor.rgb, saturate(' + factor + ')), outColor.a);';
    }
    const lit = !water && s.isEnabled(E.GL_LIGHTING);
    const varyings = stages.map(t => '@location(' + (2 + t.unit) + ') uv' + t.unit + ': vec4f');
    let sunBindings = '';
    let fragment = body;
    const shoreline = enhancedWater === 'shore' || enhancedWater === 'bank';
    const worldGroup = presentationCamera ? 3 : 2;
    if (sunlight || enhancedWater) {
        sunBindings = `struct EnhancedView { eyeToLight: mat4x4f, sunAndTime: vec4f, penumbra: vec4f, sky: vec4f, sunColour: vec4f, eyeToWorld: mat4x4f, horizon: vec4f, fogHeight: vec4f, fogMapScale: vec4f }
                       @group(${worldGroup}) @binding(0) var<uniform> enhancedView: EnhancedView;
                       `;
    }
    if (terrainFog) {
        sunBindings += distanceFogSource;
        if (!groundLight)
            sunBindings +=
                `@group(${worldGroup}) @binding(2) var fogTerrain: texture_2d<f32>;
             @group(${worldGroup}) @binding(9) var fogSampler: sampler;
             ` + terrainFogSource;
        varyings.push('@location(9) fogWorld: vec3f');
        texgen += '\nout.fogWorld = (enhancedView.eyeToWorld * eye).xyz;\n';
    }
    const sunShading = sunlight && !groundLight && !emissive;
    if (sunShading) {
        sunBindings +=
            `@group(${worldGroup}) @binding(1) var sunDepth: texture_depth_2d;
                       @group(${worldGroup}) @binding(3) var sunSampler: sampler_comparison;
                       ` + sunlightSource;
        varyings.push('@location(8) sunlight: vec3f');
        texgen += '\nout.sunlight = (enhancedView.eyeToLight * eye).xyz;\n';
        fog = 'outColor = vec4f(outColor.rgb * sunlightAt(v.sunlight, shadowDx, shadowDy), outColor.a);\n' + fog;
    } else if (emissive && sunlight) {
        fog = 'outColor = vec4f(outColor.rgb * (1.0 + 0.32 * smoothstep(0.20,0.85,max(outColor.r,max(outColor.g,outColor.b)))), outColor.a);\n' + fog;
    }
    if (enhancedWater === 'bed') {
        sunBindings += `@group(${worldGroup}) @binding(5) var waterSampler: sampler;
                        @group(${worldGroup}) @binding(8) var bankField: texture_2d<f32>;\n`;
        varyings.push('@location(5) bedPosition: vec3f');
        texgen += '\nout.bedPosition = pos.xyz;\n';
        fragment =
            body +
            `
            // The 530 material adds caustics and at least 45% underwater tint even at zero depth.
            // Gradually expose the lit, textured bed at the waterline.
            let bankUV = (v.bedPosition.xz / 32.0) / vec2f(textureDimensions(bankField));
            let field = textureSampleLevel(bankField, waterSampler, bankUV, 0.0).rg;
            let depth = v.bedPosition.y + field.g * 2040.0;
            let edge = 1.0 - smoothstep(0.28, 0.46, abs(field.r - 0.5));
            let dry = edge * (1.0 - smoothstep(0.0, 12.0, depth));
            if (dry > 0.0) { outColor = vec4f(mix(outColor.rgb, bedColour, dry), outColor.a); }`;
    } else if (enhancedWater) {
        sunBindings += `@group(${worldGroup}) @binding(4) var normalVolume: texture_3d<f32>;
                        @group(${worldGroup}) @binding(5) var waterSampler: sampler;
                        @group(${worldGroup}) @binding(6) var waterBed: texture_2d<f32>;
                        @group(${worldGroup}) @binding(7) var waterEnvironment: texture_cube<f32>;\n`;
        if (shoreline) sunBindings += `@group(${worldGroup}) @binding(8) var bankField: texture_2d<f32>;\n`;
        varyings.push('@location(5) waterTile: vec4f', '@location(6) waterEye: vec3f', '@location(7) waterSun: vec3f');
        const camera = presentationCamera ? 'presentationView * u.modelview' : 'u.modelview';
        texgen += `
            let tile = pos.xz / 128.0;
            out.waterTile = vec4f(tile, ${enhancedWater === 'bank' ? 'pos.y' : '0.0'}, 0.0);
            let modelAxes = mat3x3f(normalize(u.modelview[0].xyz), normalize(u.modelview[1].xyz), normalize(u.modelview[2].xyz));
            out.waterSun = transpose(modelAxes) * enhancedView.sunAndTime.xyz;
            let shown = ${camera};
            let axes = mat3x3f(normalize(shown[0].xyz), normalize(shown[1].xyz), normalize(shown[2].xyz));
            let toEye = transpose(axes) * -(shown * pos).xyz;
            out.waterEye = toEye * inverseSqrt(max(dot(toEye, toEye), 0.0001));
        `;
        if (enhancedWater === 'shore')
            texgen += `
            let bedSize = vec2f(textureDimensions(waterBed));
            let bedUV = (clamp(tile, vec2f(0.0), bedSize - 1.0) + 0.5) / bedSize;
            // One encoded height step is 8 fine units in 530 and 32 in 742.
            out.waterTile = vec4f(tile, textureSampleLevel(waterBed, waterSampler, bedUV, 0.0).rg * vec2f(8160.0, 1.0));
        `;
        if (enhancedWater === 'bank') {
            fragment = `let film = bankFilm(v.waterTile.xyz, v.waterEye, v.waterSun);
                ${body}
                outColor = vec4f(mix(outColor.rgb, film.rgb, film.a), outColor.a);`;
        } else {
            fragment = `let waveUV = vec3f(v.waterTile.xy / 8.0, enhancedView.sunAndTime.w * u.fogParams.w / 40.0);
                let wave = decodeWaterNormal(textureSample(normalVolume, waterSampler, waveUV));
                let light = waterLight(wave, v.waterEye, v.waterSun);
                let reflection = textureSample(waterEnvironment, waterSampler, light.ray).rrr;
                var waterColour = shadeWater(wave, light, reflection, v.waterTile.zw, ${water ? 'enhancedView.sky.rgb' : 'u.envColors[1].rgb'});
                ${shoreline ? 'waterColour = shallowWater(v.waterTile.xy, v.waterTile.zw, v.waterEye, v.waterSun, waterColour);' : ''}
                ${body}
                outColor = vec4f(waterColour.rgb, waterColour.a * v.color.a);
                ${shoreline ? 'if (outColor.a <= 0.0) { discard; }' : ''}`;
        }
    }
    const parts: Record<string, string> = {
        '@UNIFORM_FIELDS': water ? 'local: array<vec4f,67>' : lit ? 'lights: array<Light,8>' : '',
        '@CAMERA_BINDING': presentationCamera ? '@group(2) @binding(0) var<uniform> presentationView: mat4x4f;' : '',
        '@VARYINGS': varyings.join(','),
        '@VERTEX_INPUTS': args,
        '@CAMERA_TRANSFORM': presentationCamera ? 'let renderedEye = presentationView * eye;' : '',
        '@VIEW_POSITION': presentationCamera ? 'renderedEye' : 'eye',
        '@NORMAL_INPUT': input(2, 'u.currentNormal'),
        '@COLOR_INPUT': input(1, 'u.currentColor'),
        '@LIGHTING': lit ? lightingSource.replace('/* @AMBIENT */', tracked ? 'primary' : 'u.materialAmbient').replace('/* @DIFFUSE */', tracked ? 'primary' : 'u.materialDiffuse') : '',
        '@TEXGEN': texgen,
        '@FRAGMENT_OPERATIONS': (sunShading ? 'let shadowDx = dpdx(v.sunlight); let shadowDy = dpdy(v.sunlight);\n' : '') + fragment,
        '@FOG': fog
    };
    return bindings + sunBindings + (enhancedWater && enhancedWater !== 'bed' ? enhancedWaterSource : '') + (shoreline ? shorelineSource : '') + indexedSource.replace(/\/\*\s*(@[A-Z_]+)\s*\*\//g, (_, name: string) => parts[name]);
}
