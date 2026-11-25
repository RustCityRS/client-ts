import { requireNonNull } from '#/util/JavaArray';
import { GLX as E, GlUnsupported } from './GlEnums';
import GlState, { transformPoint } from './GlState';
import { COLOR_FORMAT, DEPTH_FORMAT } from './GpuDevice';
import type GpuDevice from './GpuDevice';
import { glBoxToRect } from './SurfaceTargets';
import TextureBindingCache from './TextureBindingCache';
import type WebGpuGL from './WebGpuGL';
import type { WebGpuGLHost } from './WebGpuGL';
import { immediateShader, type ImmediateStage } from '#/gl/driver/shaders/immediate.wgsl';

const STRIDE = 12;
const CHUNK_SIZE = 1024 * 1024;
export const blendFactors: Record<number, GPUBlendFactor> = {
    [E.GL_ZERO]: 'zero',
    [E.GL_ONE]: 'one',
    [E.GL_SRC_COLOR]: 'src',
    [E.GL_ONE_MINUS_SRC_COLOR]: 'one-minus-src',
    [E.GL_DST_COLOR]: 'dst',
    [E.GL_ONE_MINUS_DST_COLOR]: 'one-minus-dst',
    [E.GL_SRC_ALPHA]: 'src-alpha',
    [E.GL_ONE_MINUS_SRC_ALPHA]: 'one-minus-src-alpha',
    [E.GL_DST_ALPHA]: 'dst-alpha',
    [E.GL_ONE_MINUS_DST_ALPHA]: 'one-minus-dst-alpha',
    [E.GL_SRC_ALPHA_SATURATE]: 'src-alpha-saturated'
};
export const depthComparisons: GPUCompareFunction[] = ['never', 'less', 'equal', 'less-equal', 'greater', 'not-equal', 'greater-equal', 'always'];

type PipelineField = number | boolean | string | undefined;

interface PipelineState {
    pipeline: GPURenderPipeline;
    textureLayout: GPUBindGroupLayout | null;
}

/** GL immediate vertices latch the current colour and coordinates, including when played from a display list. */
export default class ImmediateRenderer {
    private readonly clipRect = { x: 0, y: 0, width: 0, height: 0 };
    private mode: number | null = null;
    private vertices = new Float32Array(6 * STRIDE);
    private quadBytes = new Uint8Array(this.vertices.buffer, 0, 6 * STRIDE * 4);
    private vertexCount = 0;
    private readonly point = Float64Array.of(0, 0, 0, 1);
    private readonly transformed = new Float32Array(4);
    private readonly outline = new Float32Array(8 * STRIDE);
    private readonly outlineBytes = Array.from({ length: 9 }, (_, count) => new Uint8Array(this.outline.buffer, 0, count * STRIDE * 4));
    private readonly stages: ImmediateStage[] = [];
    private readonly stageSlots: (ImmediateStage | undefined)[] = [];
    private readonly resources: (GPUTexture | GPUSampler)[] = [];
    private signature: PipelineField[] = [];
    private previousSignature: PipelineField[] = [];
    private previousPipeline: PipelineState | undefined;
    private uploadOffset = 0;
    private pipelines = new Map<string, PipelineState>();
    private readonly bindings = new TextureBindingCache();
    private chunks: GPUBuffer[] = [];
    private epoch = -1;
    private chunk = 0;
    private offset = 0;

    begin(mode: number, state: GlState): void {
        if (this.mode !== null) {
            state.setError(E.GL_INVALID_OPERATION);
            return;
        }
        this.mode = mode;
        this.vertexCount = 0;
    }

    vertex(x: number, y: number, state: GlState): void {
        if (this.mode === null) return; // glVertex outside a primitive has unspecified output; no primitives form.
        this.point[0] = x;
        this.point[1] = y;
        const pos = this.transformed;
        transformPoint(state.modelview, this.point, pos);
        transformPoint(state.projection, pos, pos);
        const offset = this.vertexCount++ * STRIDE;
        if (offset === this.vertices.length) {
            const expanded = new Float32Array(this.vertices.length * 2);
            expanded.set(this.vertices);
            this.vertices = expanded;
            this.quadBytes = new Uint8Array(expanded.buffer, 0, 6 * STRIDE * 4);
        }
        for (let i = 0; i < 4; i++) {
            this.vertices[offset + i] = pos[i];
            this.vertices[offset + 4 + i] = state.currentColor[i];
        }
        for (let unit = 0; unit < 2; unit++) {
            const at = offset + 8 + unit * 2;
            if (unit < state.units.length) {
                const textureUnit = state.units[unit];
                const coord = textureUnit.texCoord;
                if (textureUnit.textureMatrixIsIdentity && coord[2] === 0 && coord[3] === 1 && Number.isFinite(coord[0] + coord[1])) {
                    // Identity's last term adds +0, including when a GL coordinate is -0.
                    this.vertices[at] = coord[0] + 0;
                    this.vertices[at + 1] = coord[1] + 0;
                } else {
                    const uv = transformPoint(state.textureMatrix(unit), coord, pos);
                    this.vertices[at] = uv[0] / uv[3];
                    this.vertices[at + 1] = uv[1] / uv[3];
                }
            } else {
                this.vertices[at] = this.vertices[at + 1] = 0;
            }
        }
    }

    end(gl: WebGpuGL, host: WebGpuGLHost | null): void {
        const mode = this.mode;
        if (mode === null) {
            gl.state.setError(E.GL_INVALID_OPERATION);
            return;
        }
        this.mode = null;
        const vertices = this.vertexCount;
        if (vertices < (mode === E.GL_TRIANGLE_FAN ? 3 : 2)) return;
        if (host === null) throw new Error('WebGpuGL: immediate draw requires a drawable');
        const state = gl.state,
            targets = host.targets(),
            gpu = host.gpu;
        const viewport = state.viewport,
            vx = viewport[0],
            vy = viewport[1],
            vw = viewport[2],
            vh = viewport[3];
        const sc = state.scissor;
        let x0 = vx,
            y0 = vy,
            x1 = vx + vw,
            y1 = vy + vh;
        if (state.enabled.get(E.GL_SCISSOR_TEST)) {
            x0 = Math.max(x0, sc[0]);
            y0 = Math.max(y0, sc[1]);
            x1 = Math.min(x1, sc[0] + sc[2]);
            y1 = Math.min(y1, sc[1] + sc[3]);
        }
        const rect = glBoxToRect(x0, y0, x1 - x0, y1 - y0, targets.width, targets.height, this.clipRect);
        if (!rect) return;
        const { x: clipX, y: clipY, width: clipWidth, height: clipHeight } = rect;
        const triangles = mode === E.GL_TRIANGLE_FAN;
        const cull = triangles && state.enabled.get(E.GL_CULL_FACE);
        if (cull && state.cullFaceMode === E.GL_FRONT_AND_BACK) return;
        const cullMode: GPUCullMode = cull ? (state.cullFaceMode === E.GL_BACK ? 'back' : 'front') : 'none';
        const stages = this.stages,
            resources = this.resources,
            signature = this.signature;
        let stageCount = 0;
        // Slots 11/12 describe unit 0; 13/14 describe unit 1. Absent texture units have no shader stage.
        signature[11] = signature[12] = signature[13] = signature[14] = undefined;
        for (let unit = 0; unit < Math.min(2, state.unitCount); unit++) {
            const texture = gl.effectiveTexture(unit);
            if (!texture) continue;
            if (texture.target !== E.GL_TEXTURE_2D) throw new GlUnsupported('immediate texture target ' + texture.target);
            const format = requireNonNull(texture.baseImage()).base;
            const stage = (this.stageSlots[unit] ??= { unit, format, env: state.units[unit].env });
            stage.format = format;
            stages[stageCount] = stage;
            signature[11 + 2 * unit] = format;
            signature[12 + 2 * unit] = stage.env.shaderKey();
            resources[stageCount * 2] = gl.realizeTexture(texture);
            resources[stageCount * 2 + 1] = texture.sampler(gpu);
            stageCount++;
        }
        stages.length = stageCount;
        resources.length = stageCount * 2;
        const alpha = state.enabled.get(E.GL_ALPHA_TEST) ? state.alphaFunc : E.GL_ALWAYS;
        const blending = state.enabled.get(E.GL_BLEND);
        const depthTest = state.enabled.get(E.GL_DEPTH_TEST);
        const depthCompare = depthTest ? depthComparisons[state.depthFunc - E.GL_NEVER] : 'always';
        const depthWrite = !!depthTest && state.depthMask;
        signature[0] = triangles;
        signature[1] = cullMode;
        signature[2] = state.frontFace;
        signature[3] = blending && state.blendSrc;
        signature[4] = blending && state.blendDst;
        signature[5] = depthCompare;
        signature[6] = depthWrite;
        signature[7] = targets.sampleCount;
        signature[8] = targets.alphaBits;
        signature[9] = alpha;
        signature[10] = alpha === E.GL_NEVER || alpha === E.GL_ALWAYS ? 0 : state.alphaRef;
        let cached = this.previousPipeline;
        if (cached) {
            for (let i = 0; i < signature.length; i++) {
                if (signature[i] !== this.previousSignature[i]) {
                    cached = undefined;
                    break;
                }
            }
        }
        if (!cached) {
            // Shader keys contain only numeric fields and commas; the separator is unambiguous.
            const key = signature.join('|');
            cached = this.pipelines.get(key);
            if (!cached) {
                const module = gpu.device.createShaderModule({ label: 'gl-immediate', code: immediateShader(stages, alpha, state.alphaRef) });
                const blend: GPUBlendComponent = { srcFactor: blendFactors[state.blendSrc], dstFactor: blendFactors[state.blendDst], operation: 'add' };
                const pipeline = gpu.device.createRenderPipeline({
                    label: 'gl-immediate',
                    layout: 'auto',
                    vertex: {
                        module,
                        entryPoint: 'vertex',
                        buffers: [
                            {
                                arrayStride: STRIDE * 4,
                                attributes: [
                                    { shaderLocation: 0, offset: 0, format: 'float32x4' },
                                    { shaderLocation: 1, offset: 16, format: 'float32x4' },
                                    { shaderLocation: 2, offset: 32, format: 'float32x2' },
                                    { shaderLocation: 3, offset: 40, format: 'float32x2' }
                                ]
                            }
                        ]
                    },
                    fragment: {
                        module,
                        entryPoint: 'fragment',
                        targets: [{ format: COLOR_FORMAT, writeMask: targets.alphaBits ? GPUColorWrite.ALL : GPUColorWrite.RED | GPUColorWrite.GREEN | GPUColorWrite.BLUE, blend: blending ? { color: blend, alpha: blend } : undefined }]
                    },
                    primitive: { topology: triangles ? 'triangle-list' : 'line-list', frontFace: state.frontFace === E.GL_CCW ? 'ccw' : 'cw', cullMode },
                    depthStencil: { format: DEPTH_FORMAT, depthCompare, depthWriteEnabled: depthWrite },
                    multisample: { count: targets.sampleCount }
                });
                cached = { pipeline, textureLayout: stages.length === 0 ? null : pipeline.getBindGroupLayout(0) };
                this.pipelines.set(key, cached);
            }
            this.previousPipeline = cached;
            this.signature = this.previousSignature;
            this.previousSignature = signature;
        }
        const group = cached.textureLayout === null ? null : this.bindings.get(gpu.device, cached.textureLayout, stages, resources);
        // Release the draw's GPU references while keeping the array's slots for the next glyph.
        while (resources.length > 0) resources.pop();
        const count = triangles ? (vertices - 2) * 3 : mode === E.GL_LINE_LOOP ? vertices * 2 : vertices - (vertices % 2);
        const input = this.vertices;
        const translateX = (2 * vx + vw) / targets.width - 1;
        const translateY = (2 * vy + vh) / targets.height - 1;
        for (let src = 0; src < vertices * STRIDE; src += STRIDE) {
            const w = input[src + 3];
            // GL clips against ±w in Z, WebGPU against [0,w]. Map a possibly off-surface GL viewport onto the full target.
            input[src] = (input[src] * vw) / targets.width + w * translateX;
            input[src + 1] = (input[src + 1] * vh) / targets.height + w * translateY;
            input[src + 2] = (input[src + 2] + w) * 0.5;
        }
        let bytes: Uint8Array<ArrayBuffer>;
        if (triangles && vertices === 4) {
            // Sprites and glyphs arrive as 0,1,2,3. Expand to 0,1,2,0,2,3 in place.
            input.copyWithin(4 * STRIDE, 2 * STRIDE, 4 * STRIDE);
            input.copyWithin(3 * STRIDE, 0, STRIDE);
            bytes = this.quadBytes;
        } else {
            const data = count <= 8 ? this.outline : new Float32Array(count * STRIDE);
            for (let i = 0; i < count; i++) {
                const v = triangles ? (i % 3 === 0 ? 0 : ((i / 3) | 0) + (i % 3)) : mode === E.GL_LINE_LOOP ? (((i + 1) / 2) | 0) % vertices : i;
                const src = v * STRIDE;
                const dst = i * STRIDE;
                for (let c = 0; c < STRIDE; c++) data[dst + c] = input[src + c];
            }
            bytes = count <= 8 ? this.outlineBytes[count] : new Uint8Array(data.buffer);
        }
        const buffer = this.upload(gpu, bytes),
            offset = this.uploadOffset;
        const pass = targets.currentPass();
        pass.setPipeline(cached.pipeline);
        if (group) pass.setBindGroup(0, group);
        pass.setViewport(0, 0, targets.width, targets.height, 0, 1);
        pass.setScissorRect(clipX, clipY, clipWidth, clipHeight);
        pass.drawImmediate(buffer, offset, bytes.byteLength, count);
    }

    private upload(gpu: GpuDevice, data: Uint8Array<ArrayBuffer>): GPUBuffer {
        if (this.epoch !== gpu.epoch) {
            this.epoch = gpu.epoch;
            this.offset = 0;
            this.chunk = 0;
        }
        if (data.byteLength > CHUNK_SIZE) {
            const buffer = gpu.device.createBuffer({ label: 'gl-immediate-large', size: data.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
            gpu.device.queue.writeBuffer(buffer, 0, data);
            gpu.retire(buffer);
            this.uploadOffset = 0;
            return buffer;
        }
        if (this.offset + data.byteLength > CHUNK_SIZE) {
            this.chunk++;
            this.offset = 0;
        }
        const buffer = (this.chunks[this.chunk] ??= gpu.device.createBuffer({ label: 'gl-immediate-stream', size: CHUNK_SIZE, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST }));
        const offset = this.offset;
        gpu.stageDrawBytes(buffer, offset, data);
        this.offset += data.byteLength;
        this.uploadOffset = offset;
        return buffer;
    }

    dispose(gpu: GpuDevice | undefined): void {
        for (const buffer of this.chunks) {
            if (gpu) gpu.retire(buffer);
            else buffer.destroy();
        }
        this.chunks = [];
        this.pipelines.clear();
        this.previousPipeline = undefined;
        this.resources.length = 0;
    }
}
