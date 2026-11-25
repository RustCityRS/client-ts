import bloomSource from './shaders/worldBloom.wgsl' with { type: 'text' };
import distanceFogSource from './shaders/distanceFog.wgsl' with { type: 'text' };
import GpuDevice, { COLOR_FORMAT } from './GpuDevice';
import type GlState from './GlState';
import type { Rect } from './SurfaceTargets';
import type StaticPointLight from '#/dash3d/StaticPointLight';

function colorPass(label: string, view: GPUTextureView, loadOp: GPULoadOp): GPURenderPassDescriptor {
    return { label, colorAttachments: [{ view, loadOp, clearValue: [0, 0, 0, 0], storeOp: 'store' }] };
}

// Bright-pass filtering and blur use quarter-resolution targets. Composite adds only RGB to the
// world viewport, preserving every sample in the MSAA back buffer for the HUD and final resolve.
export default class WorldBloom {
    private readonly extract: GPURenderPipeline;
    private readonly horizontal: GPURenderPipeline;
    private readonly vertical: GPURenderPipeline;
    private readonly composite: GPURenderPipeline;
    private readonly lamps: GPURenderPipeline;
    private readonly sampler: GPUSampler;
    private readonly projection: GPUBuffer;
    private readonly identity: GPUBuffer;
    private readonly instances: GPUBuffer;
    private readonly lightData = new Float32Array(255 * 8);
    private readonly projectionData = new Float32Array(48);
    private lightCount = 0;
    private camera: GPUBuffer;
    private surface: {
        rect: Rect;
        source: GPUTextureView;
        textures: GPUTexture[];
        uniforms: GPUBuffer;
        passes: GPURenderPassDescriptor[];
        groups: GPUBindGroup[];
        camera: GPUBuffer;
        depth: GPUTextureView;
    } | null = null;

    constructor(
        private readonly gpu: GpuDevice,
        samples: number,
        useMask: boolean
    ) {
        const device = gpu.device;
        const source = distanceFogSource + '\n' + bloomSource;
        const module = device.createShaderModule({ label: 'world-bloom', code: source });
        // The multisample source is read directly at four coverage positions across each 4x4 block.
        let extractModule = module;
        if (samples !== 1) {
            const code = source
                .replace('scene: texture_2d', 'scene: texture_multisampled_2d')
                .replace('sceneDepth: texture_depth_2d', 'sceneDepth: texture_depth_multisampled_2d')
                .replace('let sampleIndex = 0i;', 'let sampleIndex = i32((x + y) % 4u);');
            extractModule = device.createShaderModule({ label: 'world-bloom-msaa', code });
        }
        const add: GPUBlendComponent = { srcFactor: 'one', dstFactor: 'one', operation: 'add' };
        const lampVertices: GPUVertexBufferLayout[] = [
            {
                arrayStride: 32,
                stepMode: 'instance',
                attributes: [
                    { shaderLocation: 0, offset: 0, format: 'float32x4' },
                    { shaderLocation: 1, offset: 16, format: 'float32x4' }
                ]
            }
        ];
        const both = GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT;
        const sceneLayout = device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { multisampled: samples !== 1, sampleType: samples === 1 ? 'float' : 'unfilterable-float' } },
                { binding: 2, visibility: both, buffer: {} },
                { binding: 5, visibility: GPUShaderStage.FRAGMENT, texture: { multisampled: samples !== 1, sampleType: 'depth' } },
                { binding: 6, visibility: both, buffer: {} },
                { binding: 7, visibility: both, buffer: {} }
            ]
        });
        const scenePipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [sceneLayout] });
        const pipeline = (entryPoint: string, shader: GPUShaderModule, count = 1, blend?: GPUBlendState, lamps = false) =>
            device.createRenderPipeline({
                label: 'world-bloom-' + entryPoint,
                layout: entryPoint === 'extract' || lamps ? scenePipelineLayout : 'auto',
                vertex: {
                    module: shader,
                    entryPoint: lamps ? 'lampVs' : 'vs',
                    buffers: lamps ? lampVertices : []
                },
                fragment: {
                    module: shader,
                    entryPoint,
                    constants: entryPoint === 'extract' ? { useCoverage: useMask ? 1 : 0 } : {},
                    targets: [{ format: COLOR_FORMAT, blend, writeMask: entryPoint === 'composite' && !useMask ? GPUColorWrite.RED | GPUColorWrite.GREEN | GPUColorWrite.BLUE : GPUColorWrite.ALL }]
                },
                multisample: { count }
            });
        this.extract = pipeline('extract', extractModule);
        this.lamps = pipeline('lamp', extractModule, 1, { color: add, alpha: add }, true);
        this.horizontal = pipeline('horizontal', module);
        this.vertical = pipeline('vertical', module, 1, { color: { srcFactor: 'one', dstFactor: 'src-alpha' }, alpha: {} });
        this.composite = pipeline('composite', module, samples, { color: add, alpha: {} });
        this.sampler = device.createSampler({ minFilter: 'linear', magFilter: 'linear' });
        this.projection = device.createBuffer({ label: 'bloom-projection', size: this.projectionData.byteLength, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        this.identity = device.createBuffer({ label: 'bloom-stationary-view', size: 64, usage: GPUBufferUsage.UNIFORM, mappedAtCreation: true });
        new Float32Array(this.identity.getMappedRange()).set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
        this.identity.unmap();
        this.camera = this.identity;
        this.instances = device.createBuffer({ label: 'bloom-visible-lights', size: this.lightData.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    }

    capture(state: GlState, fogViewParams: Float32Array, camera: GPUBuffer | null, eyeX: number, eyeY: number, eyeZ: number, level: number, lights: (StaticPointLight | null)[] | null, count: number): void {
        const view = state.modelview;
        const projection = state.projection;
        this.camera = camera ?? this.identity;
        this.lightCount = 0;
        for (let i = 0; lights && i < count; i++) {
            const light = lights[i];
            if (!light || (light.m_level !== level && !(light.m_level > level ? light.m_lightLevelsBelow : light.m_lightLevelsAbove))) continue;
            const x = light.x - eyeX,
                y = light.y - eyeY,
                z = light.z - eyeZ;
            const depth = -(view[2] * x + view[6] * y + view[10] * z + view[14]);
            if (depth < 40 || depth > state.fog.end + 128) continue;
            const side = view[0] * x + view[4] * y + view[8] * z + view[12];
            const up = view[1] * x + view[5] * y + view[9] * z + view[13];
            // Keep a margin for camera interpolation between game draws.
            if (Math.abs(side * projection[0]) > depth * 1.25 + 128 || Math.abs(up * projection[5]) > depth * 1.25 + 128) continue;
            const j = this.lightCount++ * 8;
            this.lightData[j] = side;
            this.lightData[j + 1] = up;
            this.lightData[j + 2] = -depth;
            this.lightData[j + 3] = Math.min(48, 22 + light.m_radius * 4);
            this.lightData.set(light.diffuse, j + 4);
        }
        if (this.lightCount) this.gpu.device.queue.writeBuffer(this.instances, 0, this.lightData, 0, this.lightCount * 8);
        this.projectionData.set(projection);
        this.projectionData.set(fogViewParams, 16);
        if (fogViewParams[22] === 0) this.projectionData.set(state.fog.color, 32);
        this.projectionData[44] = state.fog.start;
        this.projectionData[45] = state.fog.end;
        this.gpu.device.queue.writeBuffer(this.projection, 0, this.projectionData);
    }

    prepare(source: GPUTextureView, depth: GPUTextureView, x: number, y: number, width: number, height: number): void {
        const rect = this.surface?.rect;
        if (this.surface && rect?.x === x && rect.y === y && rect.width === width && rect.height === height && this.surface.source === source && this.surface.depth === depth) {
            if (this.camera !== this.surface.camera) {
                this.surface.camera = this.camera;
                this.surface.groups[0] = this.sceneBindings(source, depth, this.surface.uniforms);
            }
            return;
        }
        this.releaseSurface();
        const device = this.gpu.device;
        const makeTexture = (name: string) =>
            device.createTexture({
                label: 'world-bloom-' + name,
                format: COLOR_FORMAT,
                size: [Math.ceil(width / 4), Math.ceil(height / 4)],
                usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
            });
        const bright = makeTexture('bright'),
            blurred = makeTexture('blurred');
        const brightView = bright.createView(),
            blurredView = blurred.createView();
        const uniforms = device.createBuffer({ label: 'world-bloom-viewport', size: 16, usage: GPUBufferUsage.UNIFORM, mappedAtCreation: true });
        new Uint32Array(uniforms.getMappedRange()).set([x, y, width, height]);
        uniforms.unmap();
        const params = { binding: 2, resource: { buffer: uniforms } };
        const sampler = { binding: 1, resource: this.sampler };
        this.surface = {
            rect: { x, y, width, height },
            source,
            depth,
            camera: this.camera,
            uniforms,
            textures: [bright, blurred],
            passes: [colorPass('bloom-bright', brightView, 'clear'), colorPass('bloom-horizontal', blurredView, 'clear'), colorPass('bloom-vertical', brightView, 'load'), colorPass('bloom-add', source, 'load')],
            groups: [
                this.sceneBindings(source, depth, uniforms),
                device.createBindGroup({ layout: this.horizontal.getBindGroupLayout(0), entries: [{ binding: 3, resource: brightView }, sampler] }),
                device.createBindGroup({ layout: this.vertical.getBindGroupLayout(0), entries: [{ binding: 3, resource: blurredView }, sampler] }),
                device.createBindGroup({ layout: this.composite.getBindGroupLayout(0), entries: [{ binding: 3, resource: brightView }, sampler, params] })
            ]
        };
    }

    private sceneBindings(source: GPUTextureView, depth: GPUTextureView, viewport: GPUBuffer): GPUBindGroup {
        return this.gpu.device.createBindGroup({
            layout: this.lamps.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: source },
                { binding: 2, resource: { buffer: viewport } },
                { binding: 5, resource: depth },
                { binding: 6, resource: { buffer: this.projection } },
                { binding: 7, resource: { buffer: this.camera } }
            ]
        });
    }

    encode(encoder: GPUCommandEncoder): void {
        const state = this.surface;
        if (!state) return;
        const rect = state.rect;
        for (let i = 0; i < state.passes.length; i++) {
            const pass = encoder.beginRenderPass(state.passes[i]);
            pass.setPipeline(i === 0 ? this.extract : i === 1 ? this.horizontal : i === 2 ? this.vertical : this.composite);
            pass.setBindGroup(0, state.groups[i]);
            if (i === 3) pass.setScissorRect(rect.x, rect.y, rect.width, rect.height);
            pass.draw(3);
            if (i === 0 && this.lightCount) {
                pass.setPipeline(this.lamps);
                pass.setVertexBuffer(0, this.instances);
                pass.draw(6, this.lightCount);
            }
            pass.end();
        }
    }

    private releaseSurface(): void {
        if (!this.surface) return;
        for (const texture of this.surface.textures) this.gpu.retire(texture);
        this.gpu.retire(this.surface.uniforms);
        this.surface = null;
    }

    dispose(): void {
        this.releaseSurface();
        this.gpu.retire(this.identity);
        this.gpu.retire(this.projection);
        this.gpu.retire(this.instances);
    }
}
