import type Buffer from '#/util/nio/Buffer';
import { requireNonNull } from '#/util/JavaArray';
import { bufferByteView, bufferElementSize } from '#/util/nio/BufferBytes';
import { GLX as E, GlUnsupported } from './GlEnums';
import GlState, { ServerFlag, type ArrayPointer } from './GlState';
import GpuDevice, { COLOR_FORMAT, DEPTH_FORMAT } from './GpuDevice';
import { blendFactors, depthComparisons } from './ImmediateRenderer';
import { glBoxToRect } from './SurfaceTargets';
import type WebGpuGL from './WebGpuGL';
import type { BufferObject } from './BufferObject';
import type { WebGpuGLHost } from './WebGpuGL';
import { indexedShader, type IndexedStage } from '#/gl/driver/shaders/indexed.wgsl';
import TextureBindingCache from './TextureBindingCache';
import { loginMaterial, loginPipelinePairs, loginVertexLayouts } from './LoginPipelines';
import { ClientVertexRanges, includeClientPointer } from './ClientVertexRange';

interface Slice {
    buffer: GPUBuffer;
    offset: number;
}
interface VertexMemory {
    buffer: GPUBuffer | null;
    offset: number;
}
interface Attribute extends VertexMemory {
    name?: number;
    stride: number;
    format: GPUVertexFormat;
    bytes: number;
}
// Only client arrays and unaligned VBO attributes need the highest index. Keep the
// range in the driver so ordinary indexed draws do not allocate a captured function.
class DrawIndexRange {
    data?: Uint8Array;
    firstByte = 0;
    count = 0;
    element?: BufferObject;
    private largest = -1;

    set(data: Uint8Array | undefined, firstByte: number, count: number, element: BufferObject | undefined): void {
        this.data = data;
        this.firstByte = firstByte;
        this.count = count;
        this.element = element;
        this.largest = -1;
    }

    highest(): number {
        if (this.largest < 0) {
            if (this.element) {
                this.largest = this.element.highestIndex(this.firstByte, this.count);
            } else {
                const data = requireNonNull(this.data);
                const view = new DataView(data.buffer, data.byteOffset + this.firstByte, this.count * 4);
                for (let i = 0; i < this.count; i++) this.largest = Math.max(this.largest, view.getUint32(i * 4, true));
            }
        }
        return this.largest;
    }
}

interface VertexBinding extends VertexMemory {
    name?: number;
    firstSlot: number;
    stride: number;
    end: number;
}
interface VertexInput {
    attributes: Attribute[];
    buffers: VertexBinding[];
    bufferCount: number;
    bindingOf: number[];
    slots: number[];
    variants: PipelineVariants;
}

interface PipelineVariants {
    next?: Map<number | string, PipelineVariants>;
    lastKey?: number | string;
    lastChild?: PipelineVariants;
    pipeline?: Pipeline;
}

function variant(node: PipelineVariants, key: number | string): PipelineVariants {
    if (node.lastKey === key && node.lastChild !== undefined) return node.lastChild;
    const next = (node.next ??= new Map());
    let child = next.get(key);
    if (child === undefined) {
        child = {};
        next.set(key, child);
    }
    node.lastKey = key;
    node.lastChild = child;
    return child;
}

// GL pointers describe each attribute independently. Attributes in the same interleaved record
// address the same GPU buffer at base + vertex * stride and can share one WebGPU binding.
function emptyVertexInput(): VertexInput {
    return { attributes: [], buffers: [], bufferCount: 0, bindingOf: [], slots: [], variants: {} };
}

// Keep the small reusable records, releasing their GPU handles when their input becomes spare.
function clearVertexHandles(input: VertexInput, firstAttribute = 0, firstBinding = 0): void {
    for (let i = firstAttribute; i < input.attributes.length; i++) input.attributes[i].buffer = null;
    for (let i = firstBinding; i < input.buffers.length; i++) input.buffers[i].buffer = null;
}

function updateVertexInput(input: VertexInput, previous: VertexInput | undefined, formats: PipelineVariants, active: number): void {
    const { slots, attributes, buffers, bindingOf } = input;
    let count = 0;
    for (let slot = 0; slot < slots.length; slot++) {
        const a = attributes[slot];
        let i = 0;
        for (; i < count; i++) {
            const b = buffers[i];
            if (b.name !== a.name || b.buffer !== a.buffer || b.stride !== a.stride) continue;
            const start = Math.min(b.offset, a.offset),
                end = Math.max(b.end, a.offset + a.bytes);
            if (end - start > a.stride) continue;
            b.offset = start;
            b.end = end;
            break;
        }
        if (i === count) {
            const b = buffers[count];
            if (b) {
                b.buffer = a.buffer;
                b.name = a.name;
                b.firstSlot = slots[slot];
                b.offset = a.offset;
                b.stride = a.stride;
                b.end = a.offset + a.bytes;
            } else {
                buffers[count] = { buffer: a.buffer, name: a.name, firstSlot: slots[slot], offset: a.offset, stride: a.stride, end: a.offset + a.bytes };
            }
            count++;
        }
        bindingOf[slot] = i;
    }
    input.bufferCount = count;
    clearVertexHandles(input, slots.length, count);
    if (previous && previous.slots === slots) {
        let sameLayout = true;
        for (let i = 0; i < slots.length; i++) {
            const a = attributes[i],
                old = previous.attributes[i],
                binding = bindingOf[i];
            if (binding !== previous.bindingOf[i] || a.stride !== old.stride || a.format !== old.format || a.offset - buffers[binding].offset !== old.offset - previous.buffers[binding].offset) {
                sameLayout = false;
                break;
            }
        }
        if (sameLayout) {
            input.variants = previous.variants;
            return;
        }
    }
    let layout = variant(formats, active);
    for (let i = 0; i < slots.length; i++) {
        const a = attributes[i],
            binding = bindingOf[i];
        layout = attributeLayout(layout, binding, a.stride, a.offset - buffers[binding].offset, a.format);
    }
    input.variants = layout;
}

function setAttribute(prior: Attribute | undefined, buffer: GPUBuffer, name: number | undefined, offset: number, stride: number, format: GPUVertexFormat, bytes: number): Attribute {
    if (!prior) return { buffer, name, offset, stride, format, bytes };
    prior.buffer = buffer;
    prior.name = name;
    prior.offset = offset;
    prior.stride = stride;
    prior.format = format;
    prior.bytes = bytes;
    return prior;
}

const floatFormats: readonly GPUVertexFormat[] = ['float32', 'float32', 'float32x2', 'float32x3', 'float32x4'];

const formatIds: Partial<Record<GPUVertexFormat, number>> = { float32: 0, float32x2: 1, float32x3: 2, float32x4: 3, unorm8x4: 4 };

// A layout's enabled-slot mask fixes both the number and order of its attributes.
// The driver's usual descriptors fit in 38 exact integer bits (16 + 16 + 3 + 3).
function attributeLayout(parent: PipelineVariants, binding: number, stride: number, offset: number, format: GPUVertexFormat): PipelineVariants {
    const id = formatIds[format];
    if (stride >= 0 && stride <= 65535 && offset >= 0 && offset <= 65535 && binding < 8 && id !== undefined) {
        return variant(parent, (stride * 65536 + offset) * 64 + binding * 8 + id);
    }
    return variant(parent, binding + '/' + stride + '/' + offset + '/' + format);
}

function capturedInput(layouts: GPUVertexBufferLayout[], formats: PipelineVariants): { variants: PipelineVariants; slots: number[] } {
    const attributes = layouts
        .flatMap((layout, i) =>
            Array.from(layout.attributes, a => ({
                slot: a.shaderLocation,
                binding: i,
                stride: layout.arrayStride,
                offset: a.offset,
                format: a.format
            }))
        )
        .sort((a, b) => a.slot - b.slot);
    const slots = attributes.map(a => a.slot);
    let layout = variant(
        formats,
        slots.reduce((mask, slot) => mask | (1 << slot), 0)
    );
    for (const a of attributes) layout = attributeLayout(layout, a.binding, a.stride, a.offset, a.format);
    return { variants: layout, slots };
}

function vertexLayouts(input: VertexInput): GPUVertexBufferLayout[] {
    const layouts = input.buffers.slice(0, input.bufferCount).map(b => ({ arrayStride: b.stride, attributes: [] as GPUVertexAttribute[] }));
    for (let i = 0; i < input.slots.length; i++) {
        const a = input.attributes[i],
            binding = input.bindingOf[i];
        layouts[binding].attributes.push({ shaderLocation: input.slots[i], offset: a.offset - input.buffers[binding].offset, format: a.format });
    }
    return layouts;
}
interface Pipeline {
    value: GPURenderPipeline;
    textureLayout: GPUBindGroupLayout;
    inputs: UniformInputs;
}

const CHUNK_BYTES = 1024 * 1024;
const ENV_COLORS = 192;
const BASE_FLOATS = ENV_COLORS + 3 * 4;
const LIGHT_FLOATS = 8 * 16;
const PROGRAM_FLOATS = 67 * 4;

class DrawUniforms {
    readonly values: Float32Array<ArrayBuffer>;
    readonly words: Uint32Array<ArrayBuffer>;
    readonly transformWords: Uint32Array<ArrayBuffer>;
    readonly bytes: Uint8Array<ArrayBuffer>;
    readonly uploaded: Uint32Array<ArrayBuffer>;
    epoch = -1;
    slice?: Slice;
    revision = -1;
    transformRevision = -1;
    lightMask = 0;
    inputs?: UniformInputs;
    registers?: Float32Array;
    width = -1;
    height = -1;
    readonly groups = new WeakMap<GPUBuffer, GPUBindGroup>();
    readonly pipelineLayouts = new WeakMap<GPUBindGroupLayout, GPUPipelineLayout>();
    readonly cameraPipelineLayouts = new WeakMap<GPUBindGroupLayout, GPUPipelineLayout>();
    layout?: GPUBindGroupLayout;

    constructor(extra: number) {
        this.values = new Float32Array(BASE_FLOATS + extra);
        this.words = new Uint32Array(this.values.buffer);
        this.transformWords = this.words.subarray(0, 48);
        this.bytes = new Uint8Array(this.values.buffer);
        this.uploaded = new Uint32Array(this.words.length);
    }

    matchesUpload(length: number): boolean {
        // Every layout consists of complete vec4s. Compare their raw words so signed zero
        // and distinct NaN payloads keep their shader-visible bit patterns.
        const words = this.words,
            uploaded = this.uploaded;
        for (let i = 0; i < length; i += 4) {
            if (words[i] !== uploaded[i] || words[i + 1] !== uploaded[i + 1] || words[i + 2] !== uploaded[i + 2] || words[i + 3] !== uploaded[i + 3]) return false;
        }
        return true;
    }
}

interface UniformInputs {
    normal: boolean;
    lit: boolean;
    fog: boolean;
    textureMatrices: number[];
    texCoords: number[];
    envColors: number[];
    planes: { unit: number; coord: number }[];
}

function uniformInputs(s: GlState, slots: number[], stages: IndexedStage[], water: boolean): UniformInputs {
    const lit = !water && s.isEnabled(E.GL_LIGHTING);
    const envColors = stages.filter(stage => stage.env.usesConstantColor()).map(stage => stage.unit);
    const inputs: UniformInputs = { normal: lit, lit, fog: s.isEnabled(E.GL_FOG), textureMatrices: [], texCoords: [], envColors, planes: [] };
    if (water) {
        inputs.textureMatrices.push(1);
        return inputs;
    }
    for (const { unit } of stages) {
        inputs.textureMatrices.push(unit);
        if (!slots.includes(3 + unit)) inputs.texCoords.push(unit);
        for (let c = 0; c < 4; c++) {
            if (!s.units[unit].genEnabled[c]) continue;
            if (s.units[unit].gen[c].mode === E.GL_NORMAL_MAP) inputs.normal = true;
            else inputs.planes.push({ unit, coord: c });
        }
    }
    return inputs;
}

function pipelineChoice(root: PipelineVariants, s: GlState, stages: IndexedStage[], program: boolean, sampleCount: number, alphaBits: number, presentationView = false): PipelineVariants {
    const flags = s.enabled.mask;
    const cull = flags & ServerFlag.Cull ? (s.cullFaceMode === E.GL_FRONT ? 1 : 2) : 0;
    const depth = (flags & ServerFlag.Depth) !== 0;
    const blend = (flags & ServerFlag.Blend) !== 0;
    const alpha = flags & ServerFlag.Alpha ? s.alphaFunc : E.GL_ALWAYS;
    const lighting = (flags & ServerFlag.Lighting) !== 0;
    const tracked = (flags & ServerFlag.ColorMaterial) !== 0 && s.colorMaterialFace !== E.GL_BACK;
    const fog = !(flags & ServerFlag.Fog) ? 0 : s.fog.mode === E.GL_LINEAR ? 1 : s.fog.mode === E.GL_EXP ? 2 : 3;
    const otherBlend = blend && (s.blendSrc !== E.GL_SRC_ALPHA || s.blendDst !== E.GL_ONE_MINUS_SRC_ALPHA);
    const otherRef = alpha !== E.GL_ALWAYS && alpha !== E.GL_NEVER && s.alphaRef !== 0;
    // Common alpha blending and a zero cutoff need only the raster key. Other
    // factors and cutoffs get their own branches with their exact GL values.
    const raster =
        cull |
        (+(s.frontFace === E.GL_CCW) << 2) |
        (+depth << 3) |
        (+(depth && s.depthMask) << 4) |
        ((depth ? s.depthFunc - E.GL_NEVER : 0) << 5) |
        ((alpha - E.GL_NEVER) << 8) |
        (+program << 11) |
        (+lighting << 12) |
        (+tracked << 13) |
        (+(alphaBits !== 0) << 14) |
        (+blend << 15) |
        (fog << 16) |
        (+otherBlend << 18) |
        (+otherRef << 19) |
        (+presentationView << 20);
    let choice = variant(root, raster + sampleCount * 0x200000);
    if (otherBlend) choice = variant(choice, s.blendSrc * 65536 + s.blendDst);
    if (otherRef) choice = variant(choice, s.alphaRef);
    for (const stage of stages) {
        const unit = s.units[stage.unit];
        let texgen = 0;
        if (!program && (unit.genEnabled[0] || unit.genEnabled[1] || unit.genEnabled[2] || unit.genEnabled[3]))
            for (let c = 0; c < 4; c++) {
                if (!unit.genEnabled[c]) continue;
                const mode = unit.gen[c].mode;
                // GlState accepts OBJECT_LINEAR, EYE_LINEAR and NORMAL_MAP.
                const code = mode === E.GL_OBJECT_LINEAR ? 1 : mode === E.GL_EYE_LINEAR ? 2 : 3;
                texgen |= code << (2 * c);
            }
        // The four supported GL texture targets fit in two bits, including 1D
        // textures, which use a 2D WebGPU view and different shader coordinates.
        const target = stage.target === E.GL_TEXTURE_2D ? 0 : stage.target === E.GL_TEXTURE_1D ? 1 : stage.target === E.GL_TEXTURE_3D ? 2 : 3;
        choice = variant(choice, stage.format * 4096 + texgen * 16 + stage.unit * 4 + target);
        choice = variant(choice, stage.env.shaderKey(false));
    }
    return choice;
}

function transformUniforms(u: Float32Array<ArrayBuffer>, s: GlState, inputs: UniformInputs): void {
    u.set(s.modelview, 0);
    u.set(s.projection, 16);
    if (inputs.normal) {
        const inverse = s.modelviewInverse();
        if (inverse) {
            for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) u[32 + i * 4 + j] = inverse[j * 4 + i];
        } else {
            u.fill(0, 32, 48);
        }
    }
}

function uniforms(u: Float32Array<ArrayBuffer>, s: GlState, inputs: UniformInputs, width: number, height: number, registers?: Float32Array): void {
    if (inputs.normal) u.set(s.currentNormal, 104);
    for (const t of inputs.textureMatrices) u.set(s.textureMatrix(t), 48 + 16 * t);
    for (const t of inputs.texCoords) u.set(s.units[t].texCoord, 132 + 4 * t);
    for (const t of inputs.envColors) u.set(s.units[t].env.color, ENV_COLORS + 4 * t);
    for (const { unit, coord } of inputs.planes) {
        const g = s.units[unit].gen[coord];
        u.set(g.mode === E.GL_OBJECT_LINEAR ? g.objectPlane : g.eyePlane, 144 + 16 * unit + 4 * coord);
    }
    const v = s.viewport,
        x = v[0],
        y = v[1],
        w = v[2],
        h = v[3];
    u[96] = w / width;
    u[97] = h / height;
    u[98] = (2 * x + w) / width - 1;
    u[99] = (2 * y + h) / height - 1;
    u.set(s.currentColor, 100);
    if (inputs.fog) {
        u.set(s.fog.color, 124);
        u[128] = s.fog.start;
        u[129] = s.fog.end;
        u[130] = s.fog.density;
    }
    if (inputs.lit) {
        u.set(s.materialFront.ambient, 108);
        u.set(s.materialFront.diffuse, 112);
        u.set(s.materialFront.emission, 116);
        u.set(s.lightModelAmbient, 120);
        for (let i = 0; i < s.lights.length; i++) {
            const l = s.lights[i],
                p = BASE_FLOATS + i * 16;
            u[p + 15] = +((s.enabled.mask & (ServerFlag.Light0 << i)) !== 0);
            if (u[p + 15] === 0) continue;
            u.set(l.ambient, p);
            u.set(l.diffuse, p + 4);
            u.set(l.position, p + 8);
            u[p + 12] = l.constantAttenuation;
            u[p + 13] = l.linearAttenuation;
            u[p + 14] = l.quadraticAttenuation;
        }
    }
    if (registers) u.set(registers.subarray(0, PROGRAM_FLOATS), BASE_FLOATS);
}

/** Native indexed triangle submission. VBOs preserve their GL stores across draws. Client arrays and uniform
 * values enter a submission-local upload stream so later writes cannot alter vertices of an earlier draw. */
export default class IndexedRenderer {
    private readonly clipRect = { x: 0, y: 0, width: 0, height: 0 };
    private generation = 0;
    private warming?: Promise<void>;
    private readonly formats: PipelineVariants = {};
    private readonly modules = new Map<string, GPUShaderModule>();
    private readonly textureLayouts = new Map<string, GPUBindGroupLayout>();
    private readonly uniformInputs = new Map<string, UniformInputs>();
    private readonly textureGroups = new TextureBindingCache();
    private readonly stageByUnit: IndexedStage[] = [];
    private readonly stagesByMask: IndexedStage[][] = [];
    private readonly drawTextures: (GPUTexture | GPUSampler | undefined)[] = [];
    private workInput = emptyVertexInput();
    private clientInput = emptyVertexInput();
    private readonly vertexInputs: (VertexInput | undefined)[] = [];
    private readonly indexRange = new DrawIndexRange();
    private readonly clientBuffers = new ClientVertexRanges();
    private clientUploads = new WeakMap<ArrayBufferLike, { slice: Slice; start: number; end: number; epoch: number }>();
    private readonly slotLists: number[][] = [];
    private pointers?: ArrayPointer[];
    private lastInput?: VertexInput;
    private vertexEpoch = -1;
    private readonly unlit = new DrawUniforms(0);
    private readonly lit = new DrawUniforms(LIGHT_FLOATS);
    private readonly vertexProgram = new DrawUniforms(PROGRAM_FLOATS);
    private readonly chunks: GPUBuffer[] = [];
    private epoch = -1;
    private chunk = 0;
    private offset = 0;

    private uniformLayout(device: GPUDevice, block: DrawUniforms): GPUBindGroupLayout {
        return (block.layout ??= device.createBindGroupLayout({ entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform', hasDynamicOffset: true, minBindingSize: block.values.byteLength } }] }));
    }

    private prepare(device: GPUDevice, s: GlState, slots: number[], stages: IndexedStage[], block: DrawUniforms, buffers: GPUVertexBufferLayout[], sampleCount: number, alphaBits: number, program: boolean, cameraLayout?: GPUBindGroupLayout) {
        // Meshes first seen as the camera turns often differ only in vertex stride and offsets.
        // Those require distinct pipelines but can share shader code, layouts and texture bindings.
        const code = indexedShader(s, slots, stages, !!cameraLayout);
        let module = this.modules.get(code);
        if (!module) {
            module = device.createShaderModule({ label: 'gl-indexed', code });
            this.modules.set(code, module);
        }
        const layoutKey = stages.map(t => t.unit + ':' + t.dimension).join(',');
        let textureLayout = this.textureLayouts.get(layoutKey);
        if (!textureLayout) {
            const entries: GPUBindGroupLayoutEntry[] = [];
            for (const t of stages) entries.push({ binding: t.unit * 2, visibility: GPUShaderStage.FRAGMENT, texture: { viewDimension: t.dimension } }, { binding: t.unit * 2 + 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } });
            textureLayout = device.createBindGroupLayout({ entries });
            this.textureLayouts.set(layoutKey, textureLayout);
        }
        const layouts = cameraLayout ? block.cameraPipelineLayouts : block.pipelineLayouts;
        let layout = layouts.get(textureLayout);
        if (!layout) {
            const groups = [textureLayout, this.uniformLayout(device, block)];
            if (cameraLayout) groups.push(cameraLayout);
            layout = device.createPipelineLayout({ bindGroupLayouts: groups });
            layouts.set(textureLayout, layout);
        }
        const blend = s.isEnabled(E.GL_BLEND),
            depth = s.isEnabled(E.GL_DEPTH_TEST);
        const cull = s.isEnabled(E.GL_CULL_FACE) ? (s.cullFaceMode === E.GL_FRONT ? 'front' : 'back') : 'none';
        const blendState: GPUBlendComponent = { srcFactor: blendFactors[s.blendSrc], dstFactor: blendFactors[s.blendDst], operation: 'add' };
        const descriptor: GPURenderPipelineDescriptor = {
            label: 'gl-indexed',
            layout,
            vertex: { module, entryPoint: 'vertex', buffers },
            fragment: {
                module,
                entryPoint: 'fragment',
                targets: [{ format: COLOR_FORMAT, writeMask: alphaBits ? GPUColorWrite.ALL : GPUColorWrite.RED | GPUColorWrite.GREEN | GPUColorWrite.BLUE, blend: blend ? { color: blendState, alpha: blendState } : undefined }]
            },
            primitive: { topology: 'triangle-list', frontFace: s.frontFace === E.GL_CCW ? 'ccw' : 'cw', cullMode: cull },
            depthStencil: { format: DEPTH_FORMAT, depthWriteEnabled: depth && s.depthMask, depthCompare: depth ? depthComparisons[s.depthFunc - E.GL_NEVER] : 'always' },
            multisample: { count: sampleCount }
        };
        // Geometry layouts and texture formats can use the same subset of GL uniform state.
        // Intern that subset once at pipeline creation so a draw can compare its identity.
        const fields = uniformInputs(s, slots, stages, program);
        const key = JSON.stringify(fields);
        const inputs = this.uniformInputs.get(key) ?? fields;
        if (inputs === fields) this.uniformInputs.set(key, fields);
        return { descriptor, textureLayout, inputs };
    }

    // Run after makeCurrent returns. A single asynchronous compilation is in flight at a time. Every
    // actual draw can still compile synchronously if it arrives before its captured variant is ready.
    prewarm(gpu: GpuDevice, sampleCount: number, alphaBits: number): Promise<void> {
        if (this.warming) return this.warming;
        const generation = this.generation;
        const active = () => generation === this.generation && !gpu.lost;
        this.warming = new Promise<void>(resolve => setTimeout(resolve, 0)).then(async () => {
            if (!active() || typeof gpu.device.createRenderPipelineAsync !== 'function') return;
            const materials = new Map<number, ReturnType<typeof loginMaterial>>();
            for (const [geometry, material] of loginPipelinePairs) {
                if (!active()) return;
                let spec = materials.get(material);
                if (!spec) {
                    spec = loginMaterial(material);
                    materials.set(material, spec);
                }
                const { state, stages } = spec,
                    layouts = loginVertexLayouts[geometry];
                const { variants, slots } = capturedInput(layouts, this.formats);
                const program = state.isEnabled(E.GL_VERTEX_PROGRAM_ARB);
                const choice = pipelineChoice(variants, state, stages, program, sampleCount, alphaBits);
                if (choice.pipeline) continue;
                const block = program ? this.vertexProgram : state.isEnabled(E.GL_LIGHTING) ? this.lit : this.unlit;
                try {
                    const prepared = this.prepare(gpu.device, state, slots, stages, block, layouts, sampleCount, alphaBits, program);
                    const value = await gpu.device.createRenderPipelineAsync(prepared.descriptor);
                    if (!active()) return;
                    choice.pipeline ??= { value, textureLayout: prepared.textureLayout, inputs: prepared.inputs };
                } catch {
                    // Leave a rejected variant to the normal draw-time creation path.
                }
            }
        });
        return this.warming;
    }

    private upload(gpu: GpuDevice, bytes: Uint8Array, align = 4, reuse?: Slice): Slice {
        if (this.epoch !== gpu.epoch) {
            this.epoch = gpu.epoch;
            this.chunk = this.offset = 0;
        }
        const size = (bytes.length + 3) & ~3;
        const padded = size === bytes.length ? bytes : new Uint8Array(size);
        if (padded !== bytes) padded.set(bytes);
        const usage = GPUBufferUsage.VERTEX | GPUBufferUsage.INDEX | GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST;
        let buffer: GPUBuffer, at: number;
        if (size > CHUNK_BYTES) {
            buffer = gpu.device.createBuffer({ label: 'gl-indexed-large', size, usage });
            gpu.retire(buffer);
            at = 0;
        } else {
            at = Math.ceil(this.offset / align) * align;
            if (at + size > CHUNK_BYTES) {
                this.chunk++;
                at = 0;
            }
            buffer = this.chunks[this.chunk] ??= gpu.device.createBuffer({ label: 'gl-indexed-stream', size: CHUNK_BYTES, usage });
            this.offset = at + size;
        }
        gpu.stageDrawBytes(buffer, at, padded, size <= CHUNK_BYTES);
        if (reuse) {
            reuse.buffer = buffer;
            reuse.offset = at;
            return reuse;
        }
        return { buffer, offset: at };
    }

    private attribute(gl: WebGpuGL, gpu: GpuDevice, p: ArrayPointer, loc: number, prior: Attribute | undefined): Attribute {
        const stored = gl.buffers.get(p.buffer),
            nio = p.client;
        const bytesPerValue = p.type === E.GL_FLOAT ? 4 : 1;
        const stride = p.stride || p.size * bytesPerValue;
        const offset = p.offset + (nio ? p.clientPosition * bufferElementSize(nio) : 0);
        if (!stored && !nio) throw new GlUnsupported('indexed vertex attribute ' + loc + ' has no backing store');
        if (offset & 3 || stride & 3 || (bytesPerValue === 1 && p.size !== 4)) {
            const data = stored?.data ?? bufferByteView(requireNonNull(nio), 0, requireNonNull(nio).capacity());
            const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
            const values = new Float32Array((this.indexRange.highest() + 1) * 4);
            for (let i = 0; i < values.length / 4; i++) {
                values[i * 4 + 3] = 1;
                for (let j = 0; j < p.size; j++) {
                    const at = offset + stride * i + bytesPerValue * j;
                    values[4 * i + j] = bytesPerValue === 4 ? view.getFloat32(at, true) : view.getUint8(at) / 255;
                }
            }
            const upload = this.upload(gpu, new Uint8Array(values.buffer));
            return setAttribute(prior, upload.buffer, undefined, upload.offset, 16, 'float32x4', 16);
        }
        const format: GPUVertexFormat = bytesPerValue === 1 ? 'unorm8x4' : floatFormats[p.size];
        if (stored) {
            const buffer = gl.realizeBuffer(stored);
            return setAttribute(prior, buffer, p.buffer, offset, stride, format, p.size * bytesPerValue);
        } else {
            const buffer = requireNonNull(nio);
            const range = requireNonNull(this.clientBuffers.get(buffer));
            if (range.gpu === undefined) {
                const bytes = bufferByteView(buffer, 0, buffer.capacity());
                const start = bytes.byteOffset + range.start,
                    end = bytes.byteOffset + range.end;
                const priorUpload = this.clientUploads.get(bytes.buffer);
                if (
                    priorUpload &&
                    priorUpload.epoch === gpu.epoch &&
                    start >= priorUpload.start &&
                    end <= priorUpload.end &&
                    ((start - priorUpload.start) & 3) === 0 &&
                    gpu.matchesDrawBytes(priorUpload.slice.buffer, priorUpload.slice.offset + start - priorUpload.start, bytes, range.start, range.end)
                ) {
                    range.gpu = priorUpload.slice.buffer;
                    range.offset = priorUpload.slice.offset + start - priorUpload.start;
                } else {
                    // Each draw range holds its own buffer/offset pair. Reusing the backing's
                    // cached slice cannot change an earlier range from another view of the same bytes.
                    const slice = this.upload(gpu, bytes.subarray(range.start, range.end), 4, priorUpload?.slice);
                    range.gpu = slice.buffer;
                    range.offset = slice.offset;
                    if (priorUpload) {
                        priorUpload.start = start;
                        priorUpload.end = end;
                        priorUpload.epoch = gpu.epoch;
                    } else {
                        this.clientUploads.set(bytes.buffer, { slice, start, end, epoch: gpu.epoch });
                    }
                }
            }
            return setAttribute(prior, range.gpu, undefined, range.offset + offset - range.start, stride, format, p.size * bytesPerValue);
        }
    }

    draw(gl: WebGpuGL, host: WebGpuGLHost, count: number, indices: Buffer | null | bigint): void {
        try {
            this.drawElements(gl, host, count, indices);
        } catch (error) {
            clearVertexHandles(this.workInput);
            if (this.lastInput) clearVertexHandles(this.lastInput);
            this.lastInput = undefined;
            throw error;
        } finally {
            if (this.clientBuffers.size !== 0) this.clientBuffers.clear();
            this.indexRange.data = undefined;
            this.indexRange.element = undefined;
            // Keep the backing array's capacity between draws. A cached group holds weak keys;
            // no strong reference to a deleted texture should survive a successful or failed draw.
            const resources = this.drawTextures;
            for (let i = 0; i < resources.length; i++) resources[i] = undefined;
        }
    }

    invalidateVertexInput(): void {
        this.vertexEpoch = -1;
    }

    private resolveVertexInput(gl: WebGpuGL, gpu: GpuDevice, pointers: ArrayPointer[], data: Uint8Array | undefined, firstByte: number, count: number, element?: BufferObject): VertexInput {
        let active = 0;
        for (let i = 0; i < pointers.length; i++) if (pointers[i].enabled) active |= 1 << i;
        let slots = this.slotLists[active];
        if (slots === undefined) {
            slots = [];
            for (let i = 0; i < pointers.length; i++) if (active & (1 << i)) slots.push(i);
            this.slotLists[active] = slots;
        }
        const previous = this.lastInput;
        // Models can replace their position stream independently of colour, normals and UVs.
        // Strides select a bounded cache slot. Check every descriptor and binding before reuse.
        const cacheSlot = (13 * (pointers[0].stride >>> 2) + 5 * (pointers[1].stride >>> 2) + (pointers[2].stride >>> 2)) & 31;
        const plan = this.vertexInputs[cacheSlot];
        if (plan?.slots === slots) {
            let i = 0;
            for (; i < slots.length; i++) {
                const pointer = pointers[slots[i]];
                const attr = plan.attributes[i];
                const binding = plan.buffers[plan.bindingOf[i]];
                const format = pointer.type === E.GL_FLOAT ? floatFormats[pointer.size] : pointer.size === 4 ? 'unorm8x4' : undefined;
                if (pointer.client !== null || pointer.buffer !== pointers[binding.firstSlot].buffer || pointer.offset !== attr.offset || (pointer.stride || attr.bytes) !== attr.stride || format !== attr.format) break;
            }
            if (i === slots.length) {
                if (previous && previous !== plan) clearVertexHandles(previous);
                this.lastInput = plan;
                for (i = 0; i < plan.bufferCount; i++) {
                    const binding = plan.buffers[i];
                    const name = pointers[binding.firstSlot].buffer;
                    const stored = gl.buffers.get(name);
                    if (!stored) throw new GlUnsupported('indexed vertex attribute ' + binding.firstSlot + ' has no backing store');
                    binding.name = name;
                    binding.buffer = gl.realizeBuffer(stored);
                }
                this.vertexEpoch = gpu.epoch;
                return plan;
            }
        }
        let input = this.workInput;
        input.slots = slots;
        let unchanged = previous !== undefined && previous.slots === slots;
        let allVbo = true;
        this.indexRange.set(data, firstByte, count, element);
        for (let i = 0; i < slots.length; i++) {
            const p = pointers[slots[i]];
            if (p.client && !gl.buffers.has(p.buffer)) includeClientPointer(this.clientBuffers, p.client, p, this.indexRange.highest());
        }
        for (let i = 0; i < slots.length; i++) {
            const slot = slots[i];
            const a = this.attribute(gl, gpu, pointers[slot], slot, input.attributes[i]);
            input.attributes[i] = a;
            if (a.name === undefined) allVbo = false;
            if (unchanged && previous) {
                const old = previous.attributes[i];
                const binding = previous.buffers[previous.bindingOf[i]];
                unchanged = a.buffer === binding.buffer && a.name === binding.name && a.offset === old.offset && a.stride === old.stride && a.format === old.format && a.bytes === old.bytes;
            }
        }
        if (unchanged && previous) {
            clearVertexHandles(input);
            input = previous;
        } else {
            updateVertexInput(input, previous, this.formats, active);
            if (previous) clearVertexHandles(previous);
            if (allVbo) {
                this.workInput = plan ?? emptyVertexInput();
                this.vertexInputs[cacheSlot] = input;
                // Only the active bindings own handles. The cached attributes are descriptors.
                for (let i = 0; i < slots.length; i++) input.attributes[i].buffer = null;
            } else {
                this.workInput = this.clientInput;
                this.clientInput = input;
            }
            this.lastInput = input;
        }
        // Consecutive material groups in one model refer to the same aligned VBOs. Client arrays
        // and repacked attributes depend on the indexed range and must be resolved on every draw.
        this.vertexEpoch = allVbo ? gpu.epoch : -1;
        return input;
    }

    private drawElements(gl: WebGpuGL, host: WebGpuGLHost, count: number, indices: Buffer | null | bigint): void {
        const { state: s } = gl,
            gpu = host.gpu,
            target = host.targets();
        const flags = s.enabled.mask;
        if (flags & ServerFlag.FragmentProgram) throw new GlUnsupported('indexed ARB fragment program');
        const program = flags & ServerFlag.VertexProgram ? gl.programs.get(s.vertexProgramBinding) : undefined;
        if (flags & ServerFlag.VertexProgram && !program?.source) throw new GlUnsupported('indexed draw with an unloaded vertex program');
        if (flags & ServerFlag.Cull && s.cullFaceMode === E.GL_FRONT_AND_BACK) return;
        const v = s.viewport,
            x = v[0],
            y = v[1],
            w = v[2],
            h = v[3],
            sc = s.scissor;
        const scissor = (flags & ServerFlag.Scissor) !== 0;
        const x0 = scissor ? Math.max(x, sc[0]) : x,
            y0 = scissor ? Math.max(y, sc[1]) : y;
        const x1 = scissor ? Math.min(x + w, sc[0] + sc[2]) : x + w,
            y1 = scissor ? Math.min(y + h, sc[1] + sc[3]) : y + h;
        const rect = glBoxToRect(x0, y0, x1 - x0, y1 - y0, target.width, target.height, this.clipRect);
        if (!rect) return;
        const { x: clipX, y: clipY, width: clipWidth, height: clipHeight } = rect;

        const element = gl.buffers.get(s.elementArrayBufferBinding);
        let indexBuffer: GPUBuffer,
            indexOffset: number,
            data: Uint8Array | undefined,
            byteLength: number,
            firstByte = 0;
        if (typeof indices === 'bigint') {
            if (!element) throw new GlUnsupported('indexed draw offset without an element buffer');
            const offset = Number(indices);
            // The GPU consumes element bytes directly. Mixed client attributes ask the element
            // store for the highest index only when needed.
            if (offset < 0) data = element.data.subarray(offset, offset + count * 4);
            byteLength = data?.byteLength ?? element.byteLength;
            if (offset > 0) firstByte = Math.min(offset, byteLength);
            indexBuffer = gl.realizeBuffer(element);
            indexOffset = offset;
        } else {
            if (indices === null) throw new GlUnsupported('indexed draw without client index storage');
            const start = indices.position(),
                n = (count * 4) / bufferElementSize(indices);
            data = bufferByteView(indices, start, start + n);
            byteLength = data.byteLength;
            const uploaded = this.upload(gpu, data);
            indexBuffer = uploaded.buffer;
            indexOffset = uploaded.offset;
        }
        if (byteLength - firstByte < count * 4) throw new RangeError('indexed draw exceeds element store');
        const textures = this.drawTextures;
        let stageMask = 0;
        let resourceCount = 0;
        const pointers = (this.pointers ??= [s.vertexArray, s.colorArray, s.normalArray, ...s.texCoordArrays.slice(0, 3)]);
        for (let i = 0; i < Math.min(3, s.unitCount); i++) {
            const tex = gl.effectiveTexture(i);
            if (!tex) continue;
            const dimension = tex.viewDimension() as IndexedStage['dimension'];
            const format = requireNonNull(tex.baseImage()).base;
            const stage = (this.stageByUnit[i] ??= { unit: i, target: tex.target, dimension, format, env: s.units[i].env });
            stage.target = tex.target;
            stage.dimension = dimension;
            stage.format = format;
            stageMask |= 1 << i;
            textures[resourceCount++] = gl.realizeTexture(tex);
            textures[resourceCount++] = tex.sampler(gpu);
        }
        // At most three texture units. Reuse their ordered stage lists when models alternate
        // between textured and untextured faces; leave resource slots available for the next draw.
        let stages = this.stagesByMask[stageMask];
        if (stages === undefined) {
            stages = [];
            for (let unit = 0; unit < this.stageByUnit.length; unit++) {
                if (stageMask & (1 << unit)) stages.push(this.stageByUnit[unit]);
            }
            this.stagesByMask[stageMask] = stages;
        }
        const input = this.lastInput && this.vertexEpoch === gpu.epoch ? this.lastInput : this.resolveVertexInput(gl, gpu, pointers, data, firstByte, count, typeof indices === 'bigint' && indices >= 0n ? element : undefined);
        const slots = input.slots;
        const viewGroup = target.worldCameraGroup;
        const choice = pipelineChoice(input.variants, s, stages, !!program, target.sampleCount, target.alphaBits, !!viewGroup);
        const device = gpu.device;
        const block = program ? this.vertexProgram : s.enabled.mask & ServerFlag.Lighting ? this.lit : this.unlit;
        const size = block.values.byteLength;
        let cached = choice.pipeline;
        if (!cached) {
            const prepared = this.prepare(device, s, slots, stages, block, vertexLayouts(input), target.sampleCount, target.alphaBits, !!program, viewGroup ? gpu.presentationCameraLayout : undefined);
            cached = { value: device.createRenderPipeline(prepared.descriptor), textureLayout: prepared.textureLayout, inputs: prepared.inputs };
            choice.pipeline = cached;
        }
        // Stage collection above initialized both resources for every active stage.
        const textureGroup = this.textureGroups.get(device, cached.textureLayout, stages, textures as (GPUTexture | GPUSampler)[]);
        const registers = program?.local;
        const lightMask = cached.inputs.lit ? s.enabled.mask & (255 * ServerFlag.Light0) : 0;
        const stateChanged = block.revision !== s.uniformRevision || block.inputs !== cached.inputs || block.width !== target.width || block.height !== target.height || block.registers !== registers || block.lightMask !== lightMask;
        const changed = stateChanged || block.transformRevision !== s.transformRevision;
        if (changed) {
            // A failed upload can leave the staging block partially refreshed. Force a complete
            // refresh on retry before publishing a revision and reusing its immutable GPU slot.
            block.revision = -1;
            transformUniforms(block.values, s, cached.inputs);
            if (stateChanged) uniforms(block.values, s, cached.inputs, target.width, target.height, registers);
        }
        let uniform = block.slice;
        // Multiple material and terrain draws frequently have identical uniforms. Their original
        // slot remains immutable until submit, even if client vertices have advanced the stream.
        const compared = stateChanged ? block.words : block.transformWords;
        if (!uniform || block.epoch !== gpu.epoch || (changed && !block.matchesUpload(compared.length))) {
            uniform = this.upload(gpu, block.bytes, device.limits.minUniformBufferOffsetAlignment, uniform);
            block.slice = uniform;
            block.epoch = gpu.epoch;
            block.uploaded.set(compared);
        }
        if (changed) {
            block.revision = s.uniformRevision;
            block.transformRevision = s.transformRevision;
            block.inputs = cached.inputs;
            block.registers = registers;
            block.lightMask = lightMask;
            block.width = target.width;
            block.height = target.height;
        }
        let group = block.groups.get(uniform.buffer);
        if (!group) {
            group = device.createBindGroup({ layout: this.uniformLayout(device, block), entries: [{ binding: 0, resource: { buffer: uniform.buffer, size } }] });
            block.groups.set(uniform.buffer, group);
        }
        const pass = target.currentPass();
        pass.setPipeline(cached.value);
        pass.setBindGroup(0, textureGroup);
        pass.setBindGroup(1, group, uniform.offset);
        if (viewGroup) pass.setBindGroup(2, viewGroup);
        for (let i = 0; i < input.bufferCount; i++) pass.setVertexBuffer(i, requireNonNull(input.buffers[i].buffer), input.buffers[i].offset);
        const alignedIndex = (indexOffset & 3) === 0;
        if (alignedIndex) pass.setIndexBuffer(indexBuffer, 'uint32');
        else pass.setIndexBuffer(indexBuffer, 'uint32', indexOffset, count * 4);
        pass.setViewport(0, 0, target.width, target.height, 0, 1);
        pass.setScissorRect(clipX, clipY, clipWidth, clipHeight);
        pass.drawIndexed(count, alignedIndex ? indexOffset / 4 : 0);
    }

    dispose(gpu: GpuDevice | undefined): void {
        this.generation++;
        this.warming = undefined;
        for (const buffer of this.chunks) {
            if (gpu) gpu.retire(buffer);
            else buffer.destroy();
        }
        this.chunks.length = 0;
        this.unlit.slice = this.lit.slice = this.vertexProgram.slice = undefined;
        this.formats.next?.clear();
        this.formats.lastChild = undefined;
        this.modules.clear();
        this.textureLayouts.clear();
        this.uniformInputs.clear();
        this.unlit.inputs = this.lit.inputs = this.vertexProgram.inputs = undefined;
        this.vertexProgram.registers = undefined;
        this.lastInput = undefined;
        this.vertexInputs.length = 0;
        this.workInput = emptyVertexInput();
        this.clientInput = emptyVertexInput();
        this.drawTextures.length = 0;
        this.clientBuffers.clear();
        this.clientUploads = new WeakMap();
        this.pointers = undefined;
    }
}
