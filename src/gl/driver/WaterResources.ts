import JavaRandom from '#/util/JavaRandom';
import { unzlibSync } from 'fflate';
import type GpuDevice from './GpuDevice';
import Shoreline from './Shoreline';
import { lumbridgeCubeFace } from './WaterEnvironment';
import volumeWorker from './waterNormals.worker.js' with { type: 'text' };

const CORNERS = 105;

export default class WaterResources {
    readonly layout: GPUBindGroupLayout;
    readonly group: GPUBindGroup;
    private readonly normals: GPUTexture;
    private readonly depths: GPUTexture;
    private readonly bank: GPUTexture;
    private readonly environment: GPUTexture;
    private worker: Worker | null = null;
    private surface: Int32Array[] | null = null;
    private seabed: Int32Array[] | null = null;

    constructor(
        private readonly gpu: GpuDevice,
        view: GPUBuffer,
        shadows: GPUTextureView,
        comparison: GPUSampler,
        fogField: GPUTextureView,
        fogSampler: GPUSampler
    ) {
        const device = gpu.device;
        this.normals = device.createTexture({ label: '742 water normals', size: [128, 128, 16], dimension: '3d', mipLevelCount: 8, format: 'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
        this.depths = device.createTexture({ label: '530 water depths', size: [CORNERS, CORNERS], format: 'rg8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
        this.bank = device.createTexture({ label: '530 shoreline', size: [Shoreline.size, Shoreline.size], format: 'rg8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
        this.environment = device.createTexture({ label: '742 water environment 682–687', size: [128, 128, 6], mipLevelCount: 8, format: 'r8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
        let face = unzlibSync(Uint8Array.from(atob(lumbridgeCubeFace), c => c.charCodeAt(0)));
        for (let level = 0; level < 8; level++) {
            const width = 128 >> level;
            for (let z = 0; z < 6; z++) device.queue.writeTexture({ texture: this.environment, mipLevel: level, origin: [0, 0, z] }, face, { bytesPerRow: width }, [width, width]);
            if (width === 1) break;
            const half = width >> 1;
            const smaller = new Uint8Array(half * half);
            for (let y = 0; y < half; y++) {
                for (let x = 0; x < half; x++) {
                    const i = y * 2 * width + x * 2;
                    smaller[y * half + x] = (face[i] + face[i + 1] + face[i + width] + face[i + width + 1] + 2) >> 2;
                }
            }
            face = smaller;
        }
        this.layout = device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: {} },
                { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'depth' } },
                { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: {} },
                { binding: 3, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'comparison' } },
                { binding: 4, visibility: GPUShaderStage.FRAGMENT, texture: { viewDimension: '3d' } },
                { binding: 5, visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX, sampler: {} },
                { binding: 6, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, texture: {} },
                { binding: 7, visibility: GPUShaderStage.FRAGMENT, texture: { viewDimension: 'cube' } },
                { binding: 8, visibility: GPUShaderStage.FRAGMENT, texture: {} },
                { binding: 9, visibility: GPUShaderStage.FRAGMENT, sampler: {} }
            ]
        });
        this.group = device.createBindGroup({
            layout: this.layout,
            entries: [
                { binding: 0, resource: { buffer: view } },
                { binding: 1, resource: shadows },
                { binding: 2, resource: fogField },
                { binding: 3, resource: comparison },
                { binding: 4, resource: this.normals.createView() },
                { binding: 5, resource: device.createSampler({ addressModeU: 'repeat', addressModeV: 'repeat', addressModeW: 'repeat', minFilter: 'linear', magFilter: 'linear', mipmapFilter: 'linear' }) },
                { binding: 6, resource: this.depths.createView() },
                { binding: 7, resource: this.environment.createView({ dimension: 'cube' }) },
                { binding: 8, resource: this.bank.createView() },
                { binding: 9, resource: fogSampler }
            ]
        });
        const url = URL.createObjectURL(new Blob([volumeWorker], { type: 'text/javascript' }));
        try {
            this.worker = new Worker(url);
        } catch {
            return; // Keep the flat reflection if the browser disallows blob workers.
        } finally {
            URL.revokeObjectURL(url);
        }
        const permutation = Uint8Array.from({ length: 256 }, (_, i) => i);
        const random = new JavaRandom(419684n);
        for (let i = 0; i < permutation.length; i++) {
            const j = random.nextInt() & 255;
            const old = permutation[j];
            permutation[j] = permutation[i];
            permutation[i] = old;
        }
        this.worker.onmessage = (event: MessageEvent<Uint8Array<ArrayBuffer>[]>) => {
            if (this.worker && !gpu.lost) {
                for (let level = 0; level < event.data.length; level++) {
                    const width = 128 >> level,
                        depth = Math.max(1, 16 >> level);
                    device.queue.writeTexture({ texture: this.normals, mipLevel: level }, event.data[level], { bytesPerRow: width * 4, rowsPerImage: width }, [width, width, depth]);
                }
            }
            this.stopWorker();
        };
        this.worker.onerror = () => this.stopWorker();
        this.worker.postMessage(permutation, [permutation.buffer]);
    }

    private stopWorker(): void {
        this.worker?.terminate();
        this.worker = null;
    }

    forgetDepth(): void {
        this.surface = this.seabed = null;
    }

    uploadShoreline(shoreline: Shoreline): void {
        this.gpu.device.queue.writeTexture({ texture: this.bank }, shoreline.pixels, { bytesPerRow: Shoreline.size * 2 }, [Shoreline.size, Shoreline.size]);
    }

    updateDepth(surface: Int32Array[], bottom: Int32Array[]): void {
        if (this.surface === surface && this.seabed === bottom) return;
        this.surface = surface;
        this.seabed = bottom;
        const bytes = new Uint8Array(CORNERS * CORNERS * 2);
        const width = Math.min(CORNERS, bottom.length, surface.length);
        for (let x = 0; x < width; x++) {
            const height = Math.min(CORNERS, bottom[x].length, surface[x].length);
            for (let z = 0; z < height; z++) {
                const depth = Math.max(0, Math.min(255, (bottom[x][z] - surface[x][z]) >> 3));
                if (depth === 0) continue;
                bytes[(z * CORNERS + x) * 2] = depth;
                // A zero-depth bank adjoining a measured bed belongs to the same shoreline.
                for (let nz = Math.max(0, z - 1); nz <= Math.min(CORNERS - 1, z + 1); nz++) {
                    for (let nx = Math.max(0, x - 1); nx <= Math.min(CORNERS - 1, x + 1); nx++) bytes[(nz * CORNERS + nx) * 2 + 1] = 255;
                }
            }
        }
        this.gpu.device.queue.writeTexture({ texture: this.depths }, bytes, { bytesPerRow: CORNERS * 2 }, [CORNERS, CORNERS]);
    }

    dispose(): void {
        this.stopWorker();
        this.gpu.retire(this.normals);
        this.gpu.retire(this.depths);
        this.gpu.retire(this.bank);
        this.gpu.retire(this.environment);
        this.forgetDepth();
    }
}
