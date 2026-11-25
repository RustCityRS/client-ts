import { GLX as E, GlUnsupported } from './GlEnums';
import type { TextureTarget } from './GlState';
import type GpuDevice from './GpuDevice';

// GL texture objects for the WebGPU driver (HD_PLAN 2.3 textures row, 2.4 incompleteness). Host code, not a Java port.
//
// GL keeps images per (face, level) and sampler state on the object; WebGPU wants one texture with a fixed mip chain
// and separate samplers. New GL images are unpacked on the CPU using the pixel store current at specification.
// After upload, the GPU owns every resident level. A mip excluded by a later base or level change keeps
// its texels in a separate single-level texture until it is redefined or can join the chain again. A compatible
// 2D upload can overwrite the submitted texture in queue order. Other changes build a new GPUTexture holding
// the base level and every consistent mip level. Samplers come from a cache keyed by the object's parameters.
//
// Formats (never -srgb):
//   RGBA (6408, or internal format 4)       -> rgba8unorm
//   LUMINANCE_ALPHA (6410, or 2)            -> rg8unorm   (L in r, A in g; the combiner swizzles L to rgb)
//   ALPHA (6406)                            -> r8unorm    (A in r; rgb reads 0 per the GL texture-application table)
//   LUMINANCE (6409, or 1)                  -> r8unorm    (L in r; alpha reads 1)
// 1D textures become 2D textures of height 1, 3D textures '3d', cube maps 6-layer '2d' textures with a 'cube' view.

export type BaseFormat = typeof E.GL_RGBA | typeof E.GL_LUMINANCE_ALPHA | typeof E.GL_ALPHA | typeof E.GL_LUMINANCE;

export interface LevelImage {
    readonly width: number;
    readonly height: number;
    readonly depth: number;
    readonly border: number;
    readonly internalFormat: number; // as passed
    readonly base: BaseFormat;
    readonly data: Uint8Array<ArrayBuffer>; // tightly packed, base-format components per texel
}

type StoredImage = Omit<LevelImage, 'data'> & {
    readonly data: Uint8Array<ArrayBuffer> | null;
    readonly detached?: { texture: GPUTexture; owner: GpuDevice };
};

// The base internal format GL derives from internalformat. Throws GlUnsupported outside the inventory.
export function baseFormat(internalFormat: number): BaseFormat {
    switch (internalFormat) {
        case 4:
        case E.GL_RGBA:
            return E.GL_RGBA;
        case 2:
        case E.GL_LUMINANCE_ALPHA:
            return E.GL_LUMINANCE_ALPHA;
        case E.GL_ALPHA:
            return E.GL_ALPHA;
        case 1:
        case E.GL_LUMINANCE:
            return E.GL_LUMINANCE;
        default:
            throw new GlUnsupported('texture internal format ' + internalFormat);
    }
}

export function componentCount(format: number): number {
    switch (format) {
        case E.GL_RGBA:
        case E.GL_BGRA:
            return 4;
        case E.GL_LUMINANCE_ALPHA:
            return 2;
        case E.GL_ALPHA:
        case E.GL_LUMINANCE:
            return 1;
        default:
            throw new GlUnsupported('pixel format ' + format);
    }
}

export function gpuFormat(base: BaseFormat): GPUTextureFormat {
    if (base === E.GL_RGBA) return 'rgba8unorm';
    if (base === E.GL_LUMINANCE_ALPHA) return 'rg8unorm';
    return 'r8unorm';
}

export interface UnpackState {
    readonly alignment: number;
    readonly rowLength: number;
    readonly skipRows: number;
    readonly skipPixels: number;
}

// Reads a width x height x depth image of `components` unsigned bytes per pixel from src (the bytes GL reads, starting
// at the buffer position) with the GL unpack rules (2.1 section 3.6.4): row length l = ROW_LENGTH or width, row stride
// k = a * ceil(n * l / a) for one-byte elements, image stride k * height, SKIP_PIXELS and SKIP_ROWS applied first.
// Returns the tightly packed bytes. Throws RangeError when src is shorter than the image: the native driver would read
// past the client memory.
export function unpackImage(src: Uint8Array, width: number, height: number, depth: number, components: number, unpack: UnpackState): Uint8Array<ArrayBuffer> {
    const l = unpack.rowLength > 0 ? unpack.rowLength : width;
    const a = unpack.alignment;
    const rowStride = a * Math.ceil((components * l) / a);
    const imageStride = rowStride * height;
    const skip = unpack.skipPixels * components + unpack.skipRows * rowStride;
    const rowBytes = width * components;
    const out = new Uint8Array(rowBytes * height * depth);
    if (out.length === 0) return out;
    const last = skip + (depth - 1) * imageStride + (height - 1) * rowStride + rowBytes;
    if (last > src.length) throw new RangeError('GL image needs ' + last + ' bytes, the buffer holds ' + src.length);
    if (rowStride === rowBytes) {
        out.set(skip === 0 && out.length === src.length ? src : src.subarray(skip, last));
        return out;
    }
    for (let z = 0; z < depth; z++) {
        for (let y = 0; y < height; y++) {
            const from = skip + z * imageStride + y * rowStride;
            out.set(src.subarray(from, from + rowBytes), (z * height + y) * rowBytes);
        }
    }
    return out;
}

// Converts packed source pixels of `format` into texels of `base` (GL 2.1 table 3.15/3.16 conversion through RGBA).
export function convertPixels(data: Uint8Array<ArrayBuffer>, format: number, base: BaseFormat): Uint8Array<ArrayBuffer> {
    if (format === base) return data;
    throw new GlUnsupported('texture upload from format ' + format + ' into base format ' + base);
}

const FACE_COUNT = 6;

export function cubeFaceIndex(target: number): number {
    return target - E.GL_TEXTURE_CUBE_MAP_POSITIVE_X;
}

export function isCubeFace(target: number): boolean {
    return target >= E.GL_TEXTURE_CUBE_MAP_POSITIVE_X && target <= E.GL_TEXTURE_CUBE_MAP_NEGATIVE_Z;
}

function isMipmapFilter(filter: number): boolean {
    return filter !== E.GL_NEAREST && filter !== E.GL_LINEAR;
}

export interface SamplerKey {
    readonly minFilter: number;
    readonly magFilter: number;
    readonly wrapS: number;
    readonly wrapT: number;
    readonly wrapR: number;
}

export function samplerKeyString(k: SamplerKey): string {
    return k.minFilter + ',' + k.magFilter + ',' + k.wrapS + ',' + k.wrapT + ',' + k.wrapR;
}

function addressMode(wrap: number): GPUAddressMode {
    if (wrap === E.GL_REPEAT) return 'repeat';
    if (wrap === E.GL_CLAMP_TO_EDGE) return 'clamp-to-edge';
    throw new GlUnsupported('texture wrap mode ' + wrap);
}

// GPU sampler state for a GL sampler key. A non-mipmapped GL min filter samples only the base level, hence
// lodMaxClamp 0.
export function samplerDescriptor(k: SamplerKey): GPUSamplerDescriptor {
    const min = k.minFilter;
    const linearMin = min === E.GL_LINEAR || min === E.GL_LINEAR_MIPMAP_NEAREST || min === E.GL_LINEAR_MIPMAP_LINEAR;
    const linearMip = min === E.GL_NEAREST_MIPMAP_LINEAR || min === E.GL_LINEAR_MIPMAP_LINEAR;
    return {
        addressModeU: addressMode(k.wrapS),
        addressModeV: addressMode(k.wrapT),
        addressModeW: addressMode(k.wrapR),
        magFilter: k.magFilter === E.GL_LINEAR ? 'linear' : 'nearest',
        minFilter: linearMin ? 'linear' : 'nearest',
        mipmapFilter: linearMip ? 'linear' : 'nearest',
        lodMinClamp: 0,
        lodMaxClamp: isMipmapFilter(min) ? 32 : 0
    };
}

export class TextureObject {
    readonly name: number;
    readonly target: TextureTarget;
    // Parameters (GL defaults: NEAREST_MIPMAP_LINEAR / LINEAR / REPEAT).
    minFilter: number = E.GL_NEAREST_MIPMAP_LINEAR;
    magFilter: number = E.GL_LINEAR;
    wrapS: number = E.GL_REPEAT;
    wrapT: number = E.GL_REPEAT;
    wrapR: number = E.GL_REPEAT;
    // images[face][level]; one face except for cube maps.
    readonly images: Map<number, StoredImage>[];
    deleted = false;
    // Bumped by every image change; the realized GPU texture remembers the version it was built from.
    version = 0;
    gpu: GPUTexture | null = null;
    gpuVersion = -1;
    gpuLevels = 0;
    private residentDevice: GpuDevice | null = null;
    private lastUseEpoch = -1;
    private complete?: boolean;
    private samplerDevice?: GpuDevice;
    private gpuSampler?: GPUSampler;

    constructor(name: number, target: TextureTarget) {
        this.name = name;
        this.target = target;
        this.images = Array.from({ length: target === E.GL_TEXTURE_CUBE_MAP ? FACE_COUNT : 1 }, () => new Map());
    }

    setImage(face: number, level: number, image: LevelImage): void {
        const old = this.images[face].get(level);
        if (old?.detached) old.detached.owner.retire(old.detached.texture);
        this.images[face].set(level, image);
        this.version++;
        this.complete = undefined;
    }

    setParameter(pname: number, value: number): void {
        switch (pname) {
            case E.GL_TEXTURE_MIN_FILTER:
                if (this.minFilter === value) return;
                this.minFilter = value;
                this.complete = undefined;
                break;
            case E.GL_TEXTURE_MAG_FILTER:
                if (this.magFilter === value) return;
                this.magFilter = value;
                break;
            case E.GL_TEXTURE_WRAP_S:
                if (this.wrapS === value) return;
                this.wrapS = value;
                break;
            case E.GL_TEXTURE_WRAP_T:
                if (this.wrapT === value) return;
                this.wrapT = value;
                break;
            case E.GL_TEXTURE_WRAP_R:
                if (this.wrapR === value) return;
                this.wrapR = value;
                break;
        }
        this.gpuSampler = undefined;
    }

    samplerKey(): SamplerKey {
        return { minFilter: this.minFilter, magFilter: this.magFilter, wrapS: this.wrapS, wrapT: this.wrapT, wrapR: this.wrapR };
    }

    sampler(gpu: GpuDevice): GPUSampler {
        if (this.gpuSampler === undefined || this.samplerDevice !== gpu) {
            this.gpuSampler = gpu.sampler(this.samplerKey());
            this.samplerDevice = gpu;
        }
        return this.gpuSampler;
    }

    // The number of mip levels a complete mipmap chain needs for the base image (GL 2.1 3.8.10: log2 of the largest
    // dimension, plus 1).
    static chainLength(width: number, height: number, depth: number): number {
        let n = 1;
        let size = Math.max(width, height, depth);
        while (size > 1) {
            size = size >> 1;
            n++;
        }
        return n;
    }

    // The consistent levels from the base level down: each level halves every dimension (minimum 1) and keeps the base
    // internal format and border. Stops at the first missing or inconsistent level.
    private consistentLevels(face: number): number {
        const levels = this.images[face];
        const base = levels.get(0);
        if (base === undefined) return 0;
        let n = 1;
        let w = base.width,
            h = base.height,
            d = base.depth;
        const max = TextureObject.chainLength(w, h, d);
        while (n < max) {
            w = Math.max(1, w >> 1);
            h = Math.max(1, h >> 1);
            d = Math.max(1, d >> 1);
            const img = levels.get(n);
            if (img === undefined || img.width !== w || img.height !== h || img.depth !== d || img.internalFormat !== base.internalFormat || img.border !== base.border) break;
            n++;
        }
        return n;
    }

    // GL texture completeness (2.1 3.8.10). Base level defined with non-zero size; with a mipmap min filter, every
    // level down to 1x1 consistent; cube maps also need six square faces of equal size and format ("cube complete").
    isComplete(): boolean {
        return (this.complete ??= this.checkComplete());
    }

    private checkComplete(): boolean {
        const base = this.images[0].get(0);
        if (base === undefined || base.width === 0 || base.height === 0 || base.depth === 0) return false;
        const needed = isMipmapFilter(this.minFilter) ? TextureObject.chainLength(base.width, base.height, base.depth) : 1;
        for (let face = 0; face < this.images.length; face++) {
            const img = this.images[face].get(0);
            if (img === undefined || img.width !== base.width || img.height !== base.height || img.internalFormat !== base.internalFormat || img.border !== base.border) return false;
            if (this.target === E.GL_TEXTURE_CUBE_MAP && img.width !== img.height) return false;
            if (this.consistentLevels(face) < needed) return false;
        }
        return true;
    }

    baseImage(): StoredImage | null {
        return this.images[0].get(0) ?? null;
    }

    // A submitted frame has finished encoding its references to this texture. A queue write now follows
    // those reads and snapshots the caller's bytes before it can refill its pixel buffer.
    updateResident2D(gpu: GpuDevice, width: number, height: number, internalFormat: number, bytesPerRow: number, pixels: Uint8Array): boolean {
        if (this.gpu === null || this.residentDevice !== gpu || this.lastUseEpoch === gpu.epoch || this.gpuVersion !== this.version) return false;
        const base = this.baseImage();
        if (!base || base.width !== width || base.height !== height || base.internalFormat !== internalFormat) return false;
        gpu.device.queue.writeTexture({ texture: this.gpu }, pixels, { bytesPerRow }, [width, height]);
        this.gpuVersion = ++this.version;
        return true;
    }

    // Builds (or reuses) the GPUTexture for the current images. Requires a complete texture. Uploads go through
    // queue.writeTexture into a texture no encoded command references yet, so they are ordered before every later draw.
    // The replaced texture goes to `retire`, which destroys it only after the commands that may read it are submitted.
    realize(gpu: GpuDevice): GPUTexture {
        this.lastUseEpoch = gpu.epoch;
        if (this.gpu !== null && this.gpuVersion === this.version) return this.gpu;
        const base = this.baseImage();
        if (base === null || !this.isComplete()) throw new Error('WebGpuGL: realize of incomplete texture ' + this.name);
        let levels = Number.MAX_SAFE_INTEGER;
        for (let face = 0; face < this.images.length; face++) levels = Math.min(levels, this.consistentLevels(face));
        const format = gpuFormat(base.base);
        const is3d = this.target === E.GL_TEXTURE_3D;
        const device = gpu.device;
        const texture = device.createTexture({
            label: 'gl-texture-' + this.name,
            dimension: is3d ? '3d' : '2d',
            size: { width: base.width, height: base.height, depthOrArrayLayers: is3d ? base.depth : this.images.length },
            mipLevelCount: levels,
            format,
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC
        });
        const changes: { face: number; level: number; image: StoredImage }[] = [];
        try {
            for (let face = 0; face < this.images.length; face++) {
                for (const [level, img] of this.images[face]) {
                    const extent = { width: img.width, height: img.height, depthOrArrayLayers: is3d ? img.depth : 1 };
                    const origin = { x: 0, y: 0, z: is3d ? 0 : face };
                    const resident = img.detached?.texture ?? this.gpu;
                    if (level >= levels) {
                        if (img.data !== null || img.detached) continue;
                        if (!resident) throw new Error('WebGpuGL: missing resident texture level');
                        // Replacing an intermediate mip can exclude its unaffected descendants. Preserve just
                        // those images, so a later compatible chain can use them without pinning the old base.
                        const detached = device.createTexture({
                            label: 'gl-texture-mip-' + this.name,
                            dimension: is3d ? '3d' : '2d',
                            size: extent,
                            format: gpuFormat(img.base),
                            usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST
                        });
                        changes.push({ face, level, image: { ...img, detached: { texture: detached, owner: gpu } } });
                        gpu.endPass();
                        gpu.getEncoder().copyTextureToTexture({ texture: resident, mipLevel: level, origin }, { texture: detached }, extent);
                        continue;
                    }
                    const destination = { texture, mipLevel: level, origin };
                    if (img.data !== null) {
                        device.queue.writeTexture(
                            destination,
                            img.data,
                            {
                                offset: 0,
                                bytesPerRow: img.width * componentCount(img.base),
                                rowsPerImage: img.height
                            },
                            extent
                        );
                    } else {
                        if (!resident) throw new Error('WebGpuGL: missing resident texture level');
                        const source = img.detached ? { texture: img.detached.texture } : { texture: resident, mipLevel: level, origin };
                        gpu.endPass();
                        gpu.getEncoder().copyTextureToTexture(source, destination, extent);
                    }
                    if (img.data !== null || img.detached) changes.push({ face, level, image: { ...img, data: null, detached: undefined } });
                }
            }
        } catch (error) {
            gpu.retire(texture);
            for (const change of changes) if (change.image.detached) gpu.retire(change.image.detached.texture);
            throw error;
        }
        // Commit only after all copies are encoded. Display lists retain their own captured client image.
        for (const { face, level, image } of changes) {
            const old = this.images[face].get(level);
            if (old?.detached) old.detached.owner.retire(old.detached.texture);
            this.images[face].set(level, image);
        }
        if (this.gpu !== null) gpu.retire(this.gpu);
        this.gpu = texture;
        this.residentDevice = gpu;
        this.gpuVersion = this.version;
        this.gpuLevels = levels;
        return texture;
    }

    // The view the shaders bind for this object's target.
    viewDimension(): GPUTextureViewDimension {
        if (this.target === E.GL_TEXTURE_3D) return '3d';
        if (this.target === E.GL_TEXTURE_CUBE_MAP) return 'cube';
        return '2d';
    }

    destroy(retire: (old: GPUTexture) => void): void {
        this.deleted = true;
        if (this.gpu !== null) retire(this.gpu);
        for (const levels of this.images) {
            for (const [level, img] of levels) {
                if (img.detached) {
                    retire(img.detached.texture);
                    levels.set(level, { ...img, detached: undefined });
                }
            }
        }
        this.gpu = null;
        this.residentDevice = null;
    }
}
