import { GLX as E, GlUnsupported } from '#/gl/driver/GlEnums';
import type GlState from '#/gl/driver/GlState';
import { fragmentOperations, type ImmediateStage } from './immediateShader';
import indexedSource from './indexed.wgsl' with { type: 'text' };
import lightingSource from './indexedLighting.wgsl' with { type: 'text' };
import waterSource from './indexedWater.wgsl' with { type: 'text' };

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
        texgen = waterSource;
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
    const lit = !water && s.isEnabled(E.GL_LIGHTING);
    const parts: Record<string, string> = {
        '@UNIFORM_FIELDS': water ? 'local: array<vec4f,67>' : lit ? 'lights: array<Light,8>' : '',
        '@CAMERA_BINDING': presentationCamera ? '@group(2) @binding(0) var<uniform> presentationView: mat4x4f;' : '',
        '@VARYINGS': stages.map(t => '@location(' + (2 + t.unit) + ') uv' + t.unit + ': vec4f').join(','),
        '@VERTEX_INPUTS': args,
        '@CAMERA_TRANSFORM': presentationCamera ? 'let renderedEye = presentationView * eye;' : '',
        '@VIEW_POSITION': presentationCamera ? 'renderedEye' : 'eye',
        '@NORMAL_INPUT': input(2, 'u.currentNormal'),
        '@COLOR_INPUT': input(1, 'u.currentColor'),
        '@LIGHTING': lit ? lightingSource.replace('/* @AMBIENT */', tracked ? 'primary' : 'u.materialAmbient').replace('/* @DIFFUSE */', tracked ? 'primary' : 'u.materialDiffuse') : '',
        '@TEXGEN': texgen,
        '@FRAGMENT_OPERATIONS': body,
        '@FOG': fog
    };
    return bindings + indexedSource.replace(/\/\*\s*(@[A-Z_]+)\s*\*\//g, (_, name: string) => parts[name]);
}
