import type GlModel from '#/dash3d/GlModel';
import type Square from '#/dash3d/Square';
import type TextureCache from '#/dash3d/TextureCache';
import type GlBuffer from '#/gl/GlBuffer';
import type GlModelStream from '#/dash3d/GlModelStream';
import { loadWorld } from '#/util/GamepackClasses';
import { bufferByteView } from '#/util/nio/BufferBytes';
import type GpuDevice from './GpuDevice';
import WaterResources from './WaterResources';
import Shoreline from './Shoreline';
import TerrainAtmosphere from './TerrainAtmosphere';
import type TerrainBatch from '#/dash3d/TerrainBatch';
import GlLighting from '#/gl/GlLighting';
import type WebGpuGL from './WebGpuGL';
import depthShader from './shaders/sunlightDepth.wgsl' with { type: 'text' };

const SIZE = 1024;
const RADIUS = 24 * 128;
const TEXEL_SIZE = (2 * RADIUS) / SIZE;
const CENTER_STEP = Math.round(256 / TEXEL_SIZE) * TEXEL_SIZE;
const DEPTH_RANGE = 16384;
const FORMAT: GPUTextureFormat = 'depth16unorm';
const STREAM_BYTES = 256 * 1024;

interface VertexStream {
    buffer: GPUBuffer;
    stride: number;
    offset: number;
    version: number;
}

interface Cutout {
    texture: GPUTexture;
    group: GPUBindGroup;
}

interface Caster {
    vertex: GPUBuffer;
    indices: GPUBuffer;
    offset: number;
    stride: number;
    count: number;
    version: number;
    indexVersion: number;
    x: number;
    y: number;
    z: number;
    yaw: number;
    firstIndex: number;
    colour?: VertexStream;
    uv?: VertexStream;
    cutout?: Cutout;
}

class ShadowLayer {
    readonly texture: GPUTexture;
    readonly view: GPUTextureView;
    private readonly draws: Caster[] = [];
    private length = 0;
    private dirty = true;
    private instances: GPUBuffer | null = null;
    private transforms = new Float32Array(0);

    constructor(
        private readonly gpu: GpuDevice,
        label: string,
        copyUsage: GPUTextureUsageFlags
    ) {
        this.texture = gpu.device.createTexture({ label, size: [SIZE, SIZE], format: FORMAT, usage: GPUTextureUsage.RENDER_ATTACHMENT | copyUsage });
        this.view = this.texture.createView();
    }

    begin(moved: boolean): void {
        this.dirty ||= moved;
        this.length = 0;
    }

    add(
        vertex: GPUBuffer,
        indices: GPUBuffer,
        offset: number,
        stride: number,
        count: number,
        version: number,
        indexVersion: number,
        x: number,
        y: number,
        z: number,
        yaw: number,
        firstIndex = 0,
        colour?: VertexStream,
        uv?: VertexStream,
        cutout?: Cutout
    ): void {
        const at = this.length++;
        const old = this.draws[at];
        if (
            old &&
            old.vertex === vertex &&
            old.indices === indices &&
            old.offset === offset &&
            old.stride === stride &&
            old.count === count &&
            old.version === version &&
            old.indexVersion === indexVersion &&
            old.firstIndex === firstIndex &&
            old.colour === colour &&
            old.uv === uv &&
            old.cutout === cutout &&
            old.x === x &&
            old.y === y &&
            old.z === z &&
            old.yaw === yaw
        )
            return;
        this.dirty = true;
        if (old) {
            old.vertex = vertex;
            old.indices = indices;
            old.offset = offset;
            old.stride = stride;
            old.count = count;
            old.version = version;
            old.indexVersion = indexVersion;
            old.firstIndex = firstIndex;
            old.colour = colour;
            old.uv = uv;
            old.cutout = cutout;
            old.x = x;
            old.y = y;
            old.z = z;
            old.yaw = yaw;
        } else {
            this.draws.push({ vertex, indices, offset, stride, count, version, indexVersion, x, y, z, yaw, firstIndex, colour, uv, cutout });
        }
    }

    render(maps: SunlightMaps, encoder: GPUCommandEncoder, base?: GPUTexture, baseChanged = false): boolean {
        if (!this.dirty && !baseChanged && this.draws.length === this.length) return false;
        this.draws.length = this.length;
        this.dirty = false;
        // Keep the static map cached. Shade from one combined depth map, including both caster sets.
        if (base) {
            encoder.copyTextureToTexture({ texture: base }, { texture: this.texture }, [SIZE, SIZE]);
            if (!this.length) return true;
        }
        if (this.transforms.length < this.length * 5) {
            this.transforms = new Float32Array(5 * 2 ** Math.ceil(Math.log2(this.length)));
            if (this.instances) this.gpu.retire(this.instances);
            this.instances = this.gpu.device.createBuffer({ label: 'sun-caster-transforms', size: this.transforms.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
        }
        for (let i = 0; i < this.length; i++) {
            const draw = this.draws[i];
            const at = i * 5;
            this.transforms[at] = draw.x;
            this.transforms[at + 1] = draw.y;
            this.transforms[at + 2] = draw.z;
            const radians = (draw.yaw * Math.PI) / 1024;
            this.transforms[at + 3] = Math.sin(radians);
            this.transforms[at + 4] = Math.cos(radians);
        }
        if (this.length) this.gpu.device.queue.writeBuffer(this.instances!, 0, this.transforms.buffer, 0, this.length * 20);
        const pass = encoder.beginRenderPass({ label: this.texture.label, colorAttachments: [], depthStencilAttachment: { view: this.view, depthClearValue: 1, depthLoadOp: base ? 'load' : 'clear', depthStoreOp: 'store' } });
        if (this.length) {
            pass.setBindGroup(0, maps.depthGroup);
            pass.setVertexBuffer(1, this.instances);
            let lastPipeline: GPURenderPipeline | undefined,
                lastColour: VertexStream | undefined,
                lastUv: VertexStream | undefined,
                lastCutout: Cutout | undefined,
                vertex: GPUBuffer | null = null,
                offset = -1,
                indices: GPUBuffer | null = null;
            for (let i = 0; i < this.length; i++) {
                const d = this.draws[i];
                const pipeline = maps.depthPipeline(d.stride, d.colour?.stride ?? 0, d.uv?.stride ?? 0);
                if (pipeline !== lastPipeline) {
                    pass.setPipeline(pipeline);
                    lastPipeline = pipeline;
                }
                if (vertex !== d.vertex || offset !== d.offset) {
                    pass.setVertexBuffer(0, d.vertex, d.offset);
                    vertex = d.vertex;
                    offset = d.offset;
                }
                if (indices !== d.indices) {
                    pass.setIndexBuffer(d.indices, 'uint32');
                    indices = d.indices;
                }
                if (d.colour && d.colour !== lastColour) {
                    pass.setVertexBuffer(2, d.colour.buffer, d.colour.offset);
                    lastColour = d.colour;
                }
                if (d.uv && d.uv !== lastUv) {
                    pass.setVertexBuffer(3, d.uv.buffer, d.uv.offset);
                    lastUv = d.uv;
                }
                if (d.cutout && d.cutout !== lastCutout) {
                    pass.setBindGroup(1, d.cutout.group);
                    lastCutout = d.cutout;
                }
                pass.drawIndexed(d.count, 1, d.firstIndex, 0, i);
            }
        }
        pass.end();
        return true;
    }

    dispose(): void {
        this.gpu.retire(this.texture);
        if (this.instances) this.gpu.retire(this.instances);
        this.draws.length = 0;
    }
}

export default class SunlightMaps {
    static active: SunlightMaps | null = null;
    eyeX = 0;
    eyeY = 0;
    eyeZ = 0;
    readonly layout: GPUBindGroupLayout;
    readonly group: GPUBindGroup;
    readonly depthGroup: GPUBindGroup;
    private readonly depthLayout: GPUPipelineLayout;
    private readonly maskLayout: GPUBindGroupLayout;
    private readonly maskedDepthLayout: GPUPipelineLayout;
    private readonly maskSamplers: (GPUSampler | undefined)[] = [];
    private readonly cutouts = new Map<number, Cutout>();
    private readonly streams = new WeakMap<GlModelStream, VertexStream>();
    private provider: TextureCache | null = null;
    private readonly depthModule: GPUShaderModule;
    private readonly pipelines = new Map<number, GPURenderPipeline>();
    private readonly scenery: ShadowLayer;
    private readonly animated: ShadowLayer;
    private readonly worldToLight = new Float32Array(16);
    private readonly viewParams = new Float32Array(60);
    readonly fogViewParams = this.viewParams.subarray(32, 60);
    private readonly atmosphere = new TerrainAtmosphere();
    private readonly fogTexture: GPUTexture;
    private readonly fogView: GPUTextureView;
    private readonly fogSampler: GPUSampler;
    private readonly comparison: GPUSampler;
    private water: WaterResources | null = null;
    waterSurface: Int32Array[] | null = null;
    waterBottom: Int32Array[] | null = null;
    private shoreSource: (TerrainBatch | null)[] | null = null;
    readonly banks = new Set<TerrainBatch>();
    bankTiles: Uint8Array | null = null;
    drawingBank = false;
    drawingBed = false;
    hasWater = false;
    waterRate = 1;
    emissiveMaterial = false;
    private readonly sceneBuffer: GPUBuffer;
    private readonly viewBuffer: GPUBuffer;
    private readonly staticModels = new Set<GlModel>();
    private readonly ground = new Map<object, { buffer: GPUBuffer; count: number }>();
    private region: object | null = null;
    private gl!: WebGpuGL;
    private focusX = 0;
    private focusZ = 0;
    private stream = 0;
    private streamOffset = 0;
    private streamVersion = 0;
    private readonly streamBuffers: GPUBuffer[] = [];

    constructor(private readonly gpu: GpuDevice) {
        const d = gpu.device;
        this.scenery = new ShadowLayer(gpu, 'sun-static-depth', GPUTextureUsage.COPY_SRC);
        this.animated = new ShadowLayer(gpu, 'sun-world-depth', GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING);
        this.sceneBuffer = d.createBuffer({ label: 'sun-world-transform', size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        this.viewBuffer = d.createBuffer({ label: 'enhanced-world-view', size: this.viewParams.byteLength, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        this.fogTexture = d.createTexture({ label: 'enhanced terrain fog', size: [TerrainAtmosphere.size, TerrainAtmosphere.size], format: 'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
        this.fogView = this.fogTexture.createView();
        this.fogSampler = d.createSampler({ minFilter: 'linear', magFilter: 'linear' });
        const castLayout = d.createBindGroupLayout({ entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: {} }] });
        this.depthLayout = d.createPipelineLayout({ bindGroupLayouts: [castLayout] });
        this.maskLayout = d.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: {} },
                { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} }
            ]
        });
        this.maskedDepthLayout = d.createPipelineLayout({ bindGroupLayouts: [castLayout, this.maskLayout] });
        this.depthModule = d.createShaderModule({ label: 'sun-depth', code: depthShader });
        this.depthGroup = d.createBindGroup({ layout: castLayout, entries: [{ binding: 0, resource: { buffer: this.sceneBuffer } }] });
        this.layout = d.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: {} },
                { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'depth' } },
                { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: {} },
                { binding: 3, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'comparison' } },
                { binding: 9, visibility: GPUShaderStage.FRAGMENT, sampler: {} }
            ]
        });
        this.comparison = d.createSampler({ compare: 'less-equal', minFilter: 'linear', magFilter: 'linear' });
        this.group = d.createBindGroup({
            layout: this.layout,
            entries: [
                { binding: 0, resource: { buffer: this.viewBuffer } },
                { binding: 1, resource: this.animated.view },
                { binding: 2, resource: this.fogView },
                { binding: 3, resource: this.comparison },
                { binding: 9, resource: this.fogSampler }
            ]
        });
    }

    horizonColour(x: number, z: number, nativeColour: number, enabled: boolean): number {
        const field = this.atmosphere;
        this.viewParams[54] = 0;
        if (!enabled) return nativeColour;
        if (field.update() && field.ready) {
            const size = TerrainAtmosphere.size;
            this.gpu.device.queue.writeTexture({ texture: this.fogTexture }, field.pixels, { bytesPerRow: size * 4 }, [size, size]);
        }
        if (!field.ready) return nativeColour;
        const rgb = field.sampleColour(x, z);
        this.viewParams[48] = ((rgb >> 16) & 255) / 255;
        this.viewParams[49] = ((rgb >> 8) & 255) / 255;
        this.viewParams[50] = (rgb & 255) / 255;
        this.viewParams[52] = field.baseY;
        this.viewParams[53] = field.heightRange;
        this.viewParams[54] = 1;
        return rgb;
    }

    waterResources(): WaterResources {
        const water = (this.water ??= new WaterResources(this.gpu, this.viewBuffer, this.animated.view, this.comparison, this.fogView, this.fogSampler));
        if (this.waterSurface && this.waterBottom) water.updateDepth(this.waterSurface, this.waterBottom);
        this.hasWater = true;
        return water;
    }

    prepareBanks(batches: (TerrainBatch | null)[]): void {
        if (this.shoreSource === batches || !this.waterSurface || !this.waterBottom || !this.provider) return;
        this.banks.clear();
        this.bankTiles = null;
        let shore: Shoreline | undefined;
        for (const batch of batches) {
            if (!batch || batch.texture < 0 || this.provider.materialType(batch.texture) !== 4) continue;
            shore ??= new Shoreline(this.waterSurface, this.waterBottom);
            batch.addWaterFootprint(shore, this.gl);
        }
        if (shore) {
            shore.finish();
            this.waterResources().uploadShoreline(shore);
            this.bankTiles = shore.bankTiles;
            for (const batch of batches) {
                if (!batch) continue;
                const type = batch.texture < 0 ? 0 : this.provider.materialType(batch.texture);
                if (type !== 2 && type !== 4 && batch.touchesBank(shore.bankTiles)) this.banks.add(batch);
            }
        }
        this.shoreSource = batches;
    }

    depthPipeline(stride: number, colour: number, uv: number): GPURenderPipeline {
        const key = (stride * 256 + colour) * 256 + uv;
        let p = this.pipelines.get(key);
        if (!p) {
            const buffers: GPUVertexBufferLayout[] = [
                { arrayStride: stride, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] },
                {
                    arrayStride: 20,
                    stepMode: 'instance',
                    attributes: [
                        { shaderLocation: 1, offset: 0, format: 'float32x3' },
                        { shaderLocation: 2, offset: 12, format: 'float32x2' }
                    ]
                }
            ];
            if (colour) buffers.push({ arrayStride: colour, attributes: [{ shaderLocation: 3, offset: 0, format: 'unorm8x4' }] });
            if (uv) buffers.push({ arrayStride: uv, attributes: [{ shaderLocation: 4, offset: 0, format: 'float32x2' }] });
            p = this.gpu.device.createRenderPipeline({
                label: 'sun-caster',
                layout: uv ? this.maskedDepthLayout : this.depthLayout,
                vertex: { module: this.depthModule, entryPoint: uv ? 'textured' : colour ? 'coloured' : 'vertex', buffers },
                fragment: colour ? { module: this.depthModule, entryPoint: uv ? 'cutout' : 'alpha', targets: [] } : undefined,
                primitive: { topology: 'triangle-list' },
                depthStencil: { format: FORMAT, depthWriteEnabled: true, depthCompare: 'less', depthBias: 2, depthBiasSlopeScale: 1.25 }
            });
            this.pipelines.set(key, p);
        }
        return p;
    }

    begin(gl: WebGpuGL, eyeX: number, eyeY: number, eyeZ: number, x: number, y: number, z: number, sun: Float32Array, region: object | null, provider: TextureCache | null): void {
        this.gl = gl;
        this.provider = provider;
        this.eyeX = eyeX;
        this.eyeY = eyeY;
        this.eyeZ = eyeZ;
        this.focusX = x;
        this.focusZ = z;
        const a = this.worldToLight;
        // Project onto XZ along the game's sun. Y increases downwards, so the smallest depth sees the sky.
        const slopeX = sun[1] !== 0 ? sun[0] / sun[1] : 0;
        const slopeZ = sun[1] !== 0 ? sun[2] / sun[1] : 0;
        const left = Math.round((x - slopeX * y) / CENTER_STEP) * CENTER_STEP;
        const top = Math.round((z - slopeZ * y) / CENTER_STEP) * CENTER_STEP;
        const height = Math.round(y / 256) * 256;
        const moved = a[0] === 0 || a[4] !== Math.fround(-slopeX / RADIUS) || a[5] !== Math.fround(slopeZ / RADIUS) || a[12] !== Math.fround(-left / RADIUS) || a[13] !== Math.fround(top / RADIUS) || a[14] !== Math.fround(0.5 - height / DEPTH_RANGE);
        a[0] = 1 / RADIUS;
        a[4] = -slopeX / RADIUS;
        a[5] = slopeZ / RADIUS;
        a[6] = 1 / DEPTH_RANGE;
        a[9] = -1 / RADIUS;
        a[12] = -left / RADIUS;
        a[13] = top / RADIUS;
        a[14] = 0.5 - height / DEPTH_RANGE;
        a[15] = 1;
        if (moved) this.gpu.device.queue.writeBuffer(this.sceneBuffer, 0, a);
        const inv = gl.state.modelviewInverse()!;
        // The jar applies the camera translation later, when it positions the scene.
        this.viewParams.set(inv, 32);
        this.viewParams[44] += eyeX;
        this.viewParams[45] += eyeY;
        this.viewParams[46] += eyeZ;
        // Reciprocal distances to the four loaded map edges, in the same coordinates as the terrain.
        // A camera right against a map edge must still have a clear foreground.
        const world = loadWorld();
        const minSpan = world.viewRadius * 64;
        this.viewParams[56] = 1 / Math.max(minSpan, eyeX, 1);
        this.viewParams[57] = 1 / Math.max(minSpan, eyeZ, 1);
        this.viewParams[58] = 1 / Math.max(minSpan, world.maxTileX * 128 - eyeX, 1);
        this.viewParams[59] = 1 / Math.max(minSpan, world.maxTileZ * 128 - eyeZ, 1);
        for (let c = 0; c < 4; c++) {
            for (let row = 0; row < 4; row++) {
                const t = c * 4;
                this.viewParams[t + row] = a[row] * (inv[t] + (c === 3 ? eyeX : 0)) + a[4 + row] * (inv[t + 1] + (c === 3 ? eyeY : 0)) + a[8 + row] * (inv[t + 2] + (c === 3 ? eyeZ : 0)) + a[12 + row] * inv[t + 3];
            }
        }
        const mv = gl.state.modelview;
        for (let row = 0; row < 3; row++) this.viewParams[16 + row] = mv[row] * sun[0] + mv[4 + row] * sun[1] + mv[8 + row] * sun[2];
        this.viewParams[19] = performance.now() * 0.001;
        // Project the angular width of the directional light onto the horizontal shadow map.
        const horizontal = Math.hypot(slopeX, slopeZ);
        const stretch = Math.min(Math.hypot(1, horizontal), 2.5);
        this.viewParams[20] = horizontal ? slopeX / horizontal : 1;
        this.viewParams[21] = horizontal ? slopeZ / horizontal : 0;
        this.viewParams[22] = (0.08 * DEPTH_RANGE * stretch * stretch) / TEXEL_SIZE;
        this.viewParams[23] = 1 / stretch;
        this.viewParams.set(gl.state.fog.color, 24);
        const sunColour = GlLighting.getSunColour();
        this.viewParams[28] = ((sunColour >> 16) & 255) / 255;
        this.viewParams[29] = ((sunColour >> 8) & 255) / 255;
        this.viewParams[30] = (sunColour & 255) / 255;
        this.waterSurface = this.waterBottom = null;
        this.hasWater = false;
        this.drawingBank = false;
        this.drawingBed = false;
        this.emissiveMaterial = false;
        this.gpu.device.queue.writeBuffer(this.viewBuffer, 0, this.viewParams);
        this.stream = this.streamOffset = 0;
        this.streamVersion++;
        this.staticModels.clear();
        if (this.region !== region) {
            this.water?.forgetDepth();
            this.shoreSource = null;
            this.banks.clear();
            this.bankTiles = null;
            for (const g of this.ground.values()) this.gpu.retire(g.buffer);
            this.ground.clear();
            for (const mask of this.cutouts.values()) this.gpu.retire(mask.texture);
            this.cutouts.clear();
            this.region = region;
        }
        this.scenery.begin(moved);
        this.animated.begin(moved);
    }

    collectTile(tile: Square, modelClass: typeof GlModel): void {
        if (Math.abs(tile.x * 128 - this.focusX) > RADIUS + 1024 || Math.abs(tile.z * 128 - this.focusZ) > RADIUS + 1024) return;
        const wall = tile.wall,
            decor = tile.decor,
            ground = tile.groundDecor;
        if (wall?.model1 instanceof modelClass) this.model(wall.model1, wall.x, wall.y, wall.z, 0, true);
        if (wall?.model2 instanceof modelClass) this.model(wall.model2, wall.x, wall.y, wall.z, 0, true);
        if (decor?.model instanceof modelClass) this.model(decor.model, decor.x + decor.offsetX, decor.y, decor.z + decor.offsetZ, 0, true);
        if (decor?.model2 instanceof modelClass) this.model(decor.model2, decor.x, decor.y, decor.z, 0, true);
        if (ground?.model instanceof modelClass) this.model(ground.model, ground.x, ground.y, ground.z, 0, true);
        for (let i = 0; i < tile.spriteCount; i++) {
            const s = tile.sprites[i];
            if (s && s.minTileX === tile.x && s.minTileZ === tile.z && s.model instanceof modelClass) this.model(s.model, s.x, s.y, s.z, s.yaw, true);
        }
    }

    model(m: GlModel, x: number, y: number, z: number, yaw: number, scenery: boolean): void {
        if (!scenery && (this.staticModels.has(m) || Math.abs(x - this.focusX) > RADIUS + 1024 || Math.abs(z - this.focusZ) > RADIUS + 1024)) return;
        if (!m.faceCount || !m.positionStream || !m.indexStream) return;
        m.prepareSunlightStreams();
        const p = m.positionStream,
            e = m.indexStream;
        const index = e.vbo && this.gl.buffers.get(e.vbo.id);
        if (!index) return;
        if (scenery) this.staticModels.add(m);
        const vertex = this.attribute(p, m.expandedVertexCount);
        if (!vertex) return;
        const colours = m.colourStream && this.attribute(m.colourStream, m.expandedVertexCount);
        const indices = this.gl.realizeBuffer(index);
        const layer = scenery ? this.scenery : this.animated;
        const runs = m.materialRuns,
            materials = m.faceMaterial,
            provider = this.provider;
        let solidStart = 0;
        // All consecutive opaque materials share one caster draw.
        if (provider && runs && materials)
            for (let i = 0; i < runs.length - 1; i++) {
                const first = runs[i],
                    id = materials[first];
                if (id === -1) continue;
                const type = provider.materialType(id & 65535);
                const fluid = type === 2 || type === 4;
                if (!fluid && provider.getTextureSolid(id & 65535)) continue;
                if (first > solidStart) layer.add(vertex.buffer, indices, vertex.offset, vertex.stride, (first - solidStart) * 3, vertex.version, index.version, x, y, z, yaw, solidStart * 3, colours ?? undefined);
                const end = runs[i + 1];
                if (!fluid && colours && m.uvStream) {
                    const cutout = this.coverage(id & 65535);
                    const uv = cutout && this.attribute(m.uvStream, m.expandedVertexCount);
                    if (cutout && uv) layer.add(vertex.buffer, indices, vertex.offset, vertex.stride, (end - first) * 3, vertex.version, index.version, x, y, z, yaw, first * 3, colours, uv, cutout);
                }
                solidStart = end;
            }
        if (m.faceCount > solidStart) layer.add(vertex.buffer, indices, vertex.offset, vertex.stride, (m.faceCount - solidStart) * 3, vertex.version, index.version, x, y, z, yaw, solidStart * 3, colours ?? undefined);
    }

    private coverage(id: number): Cutout | null {
        const cached = this.cutouts.get(id);
        if (cached) return cached;
        const image = this.provider?.getShadowCoverage(id, this.gl);
        if (!image) return null;
        const d = this.gpu.device;
        const texture = d.createTexture({ label: 'sun-cutout', size: [image.size, image.size], format: 'r8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
        d.queue.writeTexture({ texture }, image.alpha, { bytesPerRow: image.size }, [image.size, image.size]);
        const key = +image.repeatS + 2 * +image.repeatT;
        const sampler = (this.maskSamplers[key] ??= d.createSampler({ addressModeU: image.repeatS ? 'repeat' : 'clamp-to-edge', addressModeV: image.repeatT ? 'repeat' : 'clamp-to-edge', minFilter: 'linear', magFilter: 'linear' }));
        const group = d.createBindGroup({
            layout: this.maskLayout,
            entries: [
                { binding: 0, resource: texture.createView() },
                { binding: 1, resource: sampler }
            ]
        });
        const cutout = { texture, group };
        this.cutouts.set(id, cutout);
        return cutout;
    }

    private attribute(p: GlModelStream, count: number): VertexStream | undefined {
        const store = p.vbo && this.gl.buffers.get(p.vbo.id);
        let buffer: GPUBuffer, offset: number, version: number;
        if (store) {
            buffer = this.gl.realizeBuffer(store);
            offset = p.offset;
            version = store.version;
        } else if (p.buffer) {
            buffer = this.streamVertices(p, count);
            offset = this.streamOffset - p.stride * count + p.offset;
            version = this.streamVersion;
        } else return;
        const cached = this.streams.get(p);
        if (cached && cached.buffer === buffer && cached.offset === offset && cached.stride === p.stride && cached.version === version) return cached;
        const stream = { buffer, offset, stride: p.stride, version };
        this.streams.set(p, stream);
        return stream;
    }

    private streamVertices(p: GlModelStream, count: number): GPUBuffer {
        const size = p.stride * count;
        if (this.streamOffset + size > (this.streamBuffers[this.stream]?.size ?? STREAM_BYTES)) {
            this.stream++;
            this.streamOffset = 0;
        }
        let buffer = this.streamBuffers[this.stream];
        if (!buffer || buffer.size < size) {
            if (buffer) this.gpu.retire(buffer);
            buffer = this.streamBuffers[this.stream] = this.gpu.device.createBuffer({ label: 'sun-client-positions', size: Math.max(STREAM_BYTES, size), usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
        }
        this.gpu.stageDrawBytes(buffer, this.streamOffset, bufferByteView(p.buffer!, 0, size));
        this.streamOffset += size;
        return buffer;
    }

    terrain(key: object, vbo: GlBuffer, stride: number, polygons: (Int32Array | null)[], blend: boolean[] | null, count: number): void {
        const vertex = this.gl.buffers.get(vbo.id);
        if (!vertex) return;
        let g = this.ground.get(key);
        if (!g) {
            let length = 0;
            for (let i = 0; i < count; i++) if (!blend?.[i]) length += Math.max(0, (polygons[i]?.length ?? 0) - 2) * 3;
            if (!length) return;
            const buffer = this.gpu.device.createBuffer({ label: 'sun-terrain-indices', size: length * 4, usage: GPUBufferUsage.INDEX, mappedAtCreation: true });
            const indices = new Uint32Array(buffer.getMappedRange());
            let at = 0;
            for (let i = 0; i < count; i++) {
                const poly = polygons[i];
                if (!poly || blend?.[i]) continue;
                for (let j = 1; j + 1 < poly.length; j++) {
                    indices[at++] = poly[0];
                    indices[at++] = poly[j];
                    indices[at++] = poly[j + 1];
                }
            }
            buffer.unmap();
            this.ground.set(key, (g = { buffer, count: length }));
        }
        this.scenery.add(this.gl.realizeBuffer(vertex), g.buffer, 0, stride, g.count, vertex.version, 0, 0, 0, 0, 0);
    }

    advanceWater(now: number): boolean {
        const seconds = Math.fround(now * 0.001);
        if (!this.hasWater || seconds === this.viewParams[19]) return false;
        this.viewParams[19] = seconds;
        this.gpu.device.queue.writeBuffer(this.viewBuffer, 76, this.viewParams, 19, 1);
        return true;
    }

    encode(encoder: GPUCommandEncoder): void {
        const changed = this.scenery.render(this, encoder);
        this.animated.render(this, encoder, this.scenery.texture, changed);
    }

    dispose(): void {
        this.scenery.dispose();
        this.water?.dispose();
        this.water = null;
        this.shoreSource = null;
        this.banks.clear();
        this.bankTiles = null;
        this.waterSurface = this.waterBottom = null;
        this.animated.dispose();
        this.gpu.retire(this.sceneBuffer);
        this.gpu.retire(this.viewBuffer);
        this.gpu.retire(this.fogTexture);
        for (const g of this.ground.values()) this.gpu.retire(g.buffer);
        for (const mask of this.cutouts.values()) this.gpu.retire(mask.texture);
        this.cutouts.clear();
        for (const b of this.streamBuffers) this.gpu.retire(b);
        this.ground.clear();
        this.staticModels.clear();
    }
}
