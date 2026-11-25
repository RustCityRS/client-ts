import { GLX as E, GlUnsupported } from '#/gl/driver/GlEnums';
import type { TexEnvState } from '#/gl/driver/GlState';
import type { BaseFormat } from '#/gl/driver/TextureObject';
import immediateSource from './immediate.wgsl' with { type: 'text' };
import projectedOverlaySource from './projectedOverlay.wgsl' with { type: 'text' };

export interface ImmediateStage {
    unit: number;
    format: BaseFormat;
    env: TexEnvState;
    dimension?: '2d' | '3d' | 'cube';
}

function literal(x: number): string {
    return Number.isFinite(x) ? String(x) + (Number.isInteger(x) ? '.0' : '') : '0.0';
}

function source(code: number, unit: number, env: TexEnvState, constant?: string): string {
    if (code === E.GL_TEXTURE) return 'tex' + unit;
    if (code === E.GL_PREVIOUS) return 'outColor';
    if (code === E.GL_PRIMARY_COLOR) return 'v.color';
    if (code === E.GL_CONSTANT) return constant ?? 'vec4f(' + Array.from(env.color, literal).join(',') + ')';
    if (code === E.GL_TEXTURE0 || code === E.GL_TEXTURE1) return 'tex' + (code - E.GL_TEXTURE0);
    throw new GlUnsupported('immediate texture source ' + code);
}

function combine(env: TexEnvState, unit: number, alpha: boolean, constant?: string): string {
    const op = alpha ? env.combineAlpha : env.combineRgb;
    const operands = alpha ? env.operandAlpha : env.operandRgb;
    const sources = alpha ? env.sourceAlpha : env.sourceRgb;
    function arg(i: number): string {
        const s = source(sources[i], unit, env, constant);
        const operand = operands[i];
        const a = operand === E.GL_SRC_ALPHA || operand === E.GL_ONE_MINUS_SRC_ALPHA;
        const value = alpha ? s + '.a' : a ? 'vec3f(' + s + '.a)' : s + '.rgb';
        return operand === E.GL_ONE_MINUS_SRC_COLOR || operand === E.GL_ONE_MINUS_SRC_ALPHA ? '(1.0 - ' + value + ')' : value;
    }
    let result: string;
    switch (op) {
        case E.GL_REPLACE:
            result = arg(0);
            break;
        case E.GL_MODULATE:
            result = arg(0) + ' * ' + arg(1);
            break;
        case E.GL_ADD:
            result = arg(0) + ' + ' + arg(1);
            break;
        case E.GL_ADD_SIGNED:
            result = arg(0) + ' + ' + arg(1) + ' - 0.5';
            break;
        case E.GL_SUBTRACT:
            result = arg(0) + ' - ' + arg(1);
            break;
        case E.GL_INTERPOLATE:
            result = 'mix(' + arg(1) + ',' + arg(0) + ',' + arg(2) + ')';
            break;
        default:
            throw new GlUnsupported('immediate texture combiner ' + op);
    }
    return '(' + result + ') * ' + literal(alpha ? env.alphaScale : env.rgbScale);
}

function stageCode({ unit, format, env }: ImmediateStage, constant?: string): string {
    const t = 'tex' + unit;
    if (env.mode === E.GL_COMBINE) return 'outColor = saturate(vec4f(' + combine(env, unit, false, constant) + ',' + combine(env, unit, true, constant) + '));';
    const rgb = format === E.GL_ALPHA ? 'outColor.rgb' : env.mode === E.GL_REPLACE ? t + '.rgb' : 'outColor.rgb * ' + t + '.rgb';
    const alpha = format === E.GL_LUMINANCE ? 'outColor.a' : env.mode === E.GL_REPLACE ? t + '.a' : 'outColor.a * ' + t + '.a';
    if (env.mode !== E.GL_REPLACE && env.mode !== E.GL_MODULATE) throw new GlUnsupported('immediate texture environment ' + env.mode);
    return 'outColor = vec4f(' + rgb + ',' + alpha + ');';
}

export function fragmentOperations<T extends ImmediateStage>(stages: T[], alphaFunc: number, alphaRef: number, coordinate: (stage: T) => string, constantColor?: (unit: number) => string, saveBaseColour = false): { bindings: string; body: string } {
    let bindings = '',
        samples = '';
    for (const stage of stages) {
        const { unit, format, dimension = '2d' } = stage;
        bindings += '@group(0) @binding(' + 2 * unit + ') var texture' + unit + ': texture_' + dimension + '<f32>;\n';
        bindings += '@group(0) @binding(' + (2 * unit + 1) + ') var sampler' + unit + ': sampler;\n';
        const raw = 'sample' + unit;
        samples += 'let ' + raw + ' = textureSample(texture' + unit + ', sampler' + unit + ', ' + coordinate(stage) + ');\n';
        const expansion = format === E.GL_LUMINANCE_ALPHA ? 'vec4f(' + raw + '.rrr,' + raw + '.g)' : format === E.GL_ALPHA ? 'vec4f(0.0,0.0,0.0,' + raw + '.r)' : format === E.GL_LUMINANCE ? 'vec4f(' + raw + '.rrr,1.0)' : raw;
        samples += 'let tex' + unit + ' = ' + expansion + ';\n';
    }
    const alphaOps: Record<number, string> = { [E.GL_LESS]: '<', [E.GL_EQUAL]: '==', [E.GL_LEQUAL]: '<=', [E.GL_GREATER]: '>', [E.GL_NOTEQUAL]: '!=', [E.GL_GEQUAL]: '>=' };
    const alpha = alphaFunc === E.GL_NEVER ? 'discard;' : alphaFunc === E.GL_ALWAYS ? '' : 'if (!(outColor.a ' + alphaOps[alphaFunc] + ' ' + literal(alphaRef) + ')) { discard; }';
    const operations = stages.map(stage => stageCode(stage, constantColor?.(stage.unit)) + (saveBaseColour && stage.unit === 0 ? '\nbedColour = outColor.rgb;' : ''));
    return { bindings, body: samples + (saveBaseColour ? 'var bedColour = outColor.rgb;\n' : '') + operations.join('\n') + '\n' + alpha };
}

export function immediateShader(stages: ImmediateStage[], alphaFunc: number, alphaRef: number, projected = false): string {
    const { bindings, body } = fragmentOperations(stages, alphaFunc, alphaRef, s => 'v.uv' + s.unit);
    return bindings + (projected ? projectedOverlaySource : immediateSource).replace('/* @FRAGMENT_OPERATIONS */', body);
}
