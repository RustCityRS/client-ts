/** Inputs to the four original dc scanlines. Each batch preserves draw order within a row.
 * A span reading or writing a neighbouring row gets its own dispatch, with a GPU pass boundary. */
export interface SdRasterFrame {
    width: number;
    height: number;
    initial: Int32Array;
    assets: Int32Array;
    // Packed words differing from the preceding capture in this resident backing buffer.
    assetChanges?: { revision: number; start: number; end: number };
    batches: Int32Array[];
    feedback?: { offset: number; pixels: Int32Array }[];
}

// Row heads precede the records. All records store destination, count, clip-relative x, colour,
// step, alpha, flags, asset base, kind and next-record index. Only texture and sprite sampling
// append the 7 projection/UV words. Resident opaque four-pixel Gouraud runs can
// instead store five words: packed destination/count, initial colour, step,
// complemented palette offset and next. The high bit identifies this format.
// A run sampling just one colour needs only the descriptor, complemented sample index and next.
const headerWords = 10;
const shortGouraudWords = 5;
const maxBatchWords = 4096 * headerWords;

export const enum SdSpriteMode {
    ColourKey = 0,
    Opaque = 1,
    PixelAlpha = 2,
    Opacity = 3,
    PixelAlphaAll = 4,
    ScaledPixelAlpha = 5
}

export default class SdRasterSpans {
    readonly initial: Int32Array;
    private packedBytes = new WeakMap<Uint8Array, Int32Array>();
    private readonly offsets = new Map<Int32Array, number>();
    private readonly assets: Int32Array[] = [];
    private assetBuffer = new Int32Array(0);
    private assetRevision = 0;
    private assetDirtyStart = Infinity;
    private assetDirtyEnd = 0;
    private lastAsset: Int32Array | null = null;
    private lastOffset = 0;
    readonly guardedTarget: Int32Array;
    private assetWords = 0;
    private feedbackWords = 0;
    private feedback?: Map<Int32Array, number>;
    private readonly batches: Int32Array[] = [];
    private words: Int32Array;
    private readonly commandBlocks: Int32Array[] = [];
    private blockIndex = 0;
    private blockOffset = 0;
    private readonly tails: Int32Array;
    private cursor: number;
    private readonly rowHeaders: number;
    private readonly edgeBands: Int32Array[];
    private readonly bandSizes: Int32Array;
    private edgeCount = 0;
    private error: string | undefined;

    constructor(
        private readonly target: Int32Array,
        readonly width: number,
        readonly height: number,
        private readonly persistent = false
    ) {
        if (width <= 0 || height <= 0 || target.length < width * height) throw new RangeError('Invalid SD raster dimensions');
        // The browser owns the device framebuffer between redraws. Its PixScreen array is only
        // the seed for the first upload or an explicitly requested CPU-to-device resync.
        this.initial = persistent ? target : target.slice();
        // Reads of previously drawn pixels have to execute on the GPU as well. Reject unported
        // blitters even when they would write the same word as the initial CPU framebuffer.
        const denied = (property: PropertyKey): never => {
            this.error = 'Unsupported CPU framebuffer access during SD WebGPU frame: ' + String(property);
            throw new Error(this.error);
        };
        this.guardedTarget = new Proxy(target, {
            get: (array, property) => (property === 'length' ? array.length : denied(property)),
            set: (_array, property) => denied(property)
        });
        // The marker distinguishes these lists from existing captures with row heads only.
        const bands = Math.ceil(height / 8);
        this.rowHeaders = height + 3 + bands;
        this.bandSizes = new Int32Array(bands);
        this.edgeBands = new Array<Int32Array>(bands);
        this.words = persistent ? this.batchStorage() : new Int32Array(this.rowHeaders + maxBatchWords);
        this.tails = new Int32Array(this.rowHeaders);
        this.cursor = this.rowHeaders;
        this.resetHeads();
    }

    matches(target: Int32Array, width: number, height: number): boolean {
        return this.target === target && this.width === width && this.height === height;
    }

    // queue.writeBuffer copies each view at submission. The browser resets only once every
    // previous upload using this capture has been issued. Standalone captures remain immutable.
    reset(): void {
        if (!this.persistent) throw new Error('Only a persistent SD capture can be reset');
        this.blockIndex = this.blockOffset = 0;
        this.words = this.batchStorage();
        this.resetHeads();
        this.cursor = this.rowHeaders;
        this.batches.length = 0;
        this.offsets.clear();
        this.lastAsset = null;
        this.assetRevision++;
        this.assetDirtyStart = Infinity;
        this.assetDirtyEnd = 0;
        this.assetWords = this.feedbackWords = 0;
        this.feedback?.clear();
        this.packedBytes = new WeakMap();
        this.error = undefined;
    }

    private resetHeads(): void {
        this.words.fill(-1, 0, this.rowHeaders);
        this.bandSizes.fill(0);
        this.edgeCount = 0;
        this.words[this.height + 1] = this.width;
        this.tails.fill(-1);
    }

    private batchStorage(): Int32Array {
        const size = this.rowHeaders + maxBatchWords;
        let block = this.commandBlocks[this.blockIndex];
        if (block && this.blockOffset + size > block.length) {
            this.blockIndex++;
            this.blockOffset = 0;
            block = this.commandBlocks[this.blockIndex];
        }
        if (!block) {
            // Several short, barrier-separated batches can share one backing allocation.
            block = new Int32Array(size * 4);
            this.commandBlocks.push(block);
        }
        return block.subarray(this.blockOffset, this.blockOffset + size);
    }

    private flush(advance = true): void {
        if (this.cursor === this.rowHeaders) return;
        if (this.edgeCount !== 0) {
            this.words[this.height] = -2147483648;
            for (let i = 0; i < this.bandSizes.length; i++) {
                this.words[this.height + 2 + i] = this.cursor;
                const n = this.bandSizes[i];
                if (n !== 0) {
                    this.words.set(this.edgeBands[i].subarray(0, n), this.cursor);
                    this.cursor += n;
                }
            }
            this.words[this.rowHeaders - 1] = this.cursor;
        }
        if (this.persistent) {
            this.batches.push(this.words.subarray(0, this.cursor));
            // WebGPU storage binding offsets are 256-byte aligned. Consecutive batches
            // in a block can be uploaded together and bound at their original offsets.
            this.blockOffset = Math.ceil((this.blockOffset + this.cursor) / 64) * 64;
            if (!advance) {
                this.cursor = this.rowHeaders;
                return;
            }
            this.words = this.batchStorage();
        } else this.batches.push(this.words.slice(0, this.cursor));
        this.resetHeads();
        this.cursor = this.rowHeaders;
    }

    bind(pixels: Int32Array | null): Int32Array | null {
        if (pixels === this.target || pixels === this.guardedTarget) return this.guardedTarget;
        this.invalidate(pixels); // A sprite surface may be redrawn and sampled again later in this frame.
        return pixels;
    }

    invalidate(source: Int32Array | null): void {
        if (source !== null) this.offsets.delete(source);
        if (source === this.lastAsset) this.lastAsset = null;
    }

    private owns(target: Int32Array | null): boolean {
        return target === this.target || target === this.guardedTarget;
    }

    fill(target: Int32Array | null, dst: number, width: number, height: number, stride: number, colour: number, alpha?: number, blendChannels = false): boolean {
        if (!this.owns(target)) return false;
        if (width <= 0) return true;
        for (let y = 0; y < height; y++, dst += stride) {
            if (!this.record(target, 4, dst, 0, width, colour, 0, alpha ?? 256, alpha === undefined ? 0 : blendChannels ? 2 : 1, null)) return false;
        }
        return true;
    }

    blit(target: Int32Array | null, source: Int32Array | null, dst: number, src: number, width: number, height: number, dstStep: number, srcStep: number, flags: SdSpriteMode, alpha = 256, mirrored = false): boolean {
        if (!this.owns(target)) return false;
        const scratch = source === null ? undefined : this.feedback?.get(source);
        if (scratch !== undefined && flags === 1 && !mirrored) {
            for (let row = 0; row < height; row++) {
                if (!this.record(target, 9, dst, 0, width, scratch + src, 0, 0, 0, null)) return false;
                dst = (dst + width + dstStep) | 0;
                src = (src + width + srcStep) | 0;
            }
            return true;
        }
        for (let y = 0; y < height; y++) {
            this.spriteSpan(target, source, dst, width, src, 0, 0, mirrored ? -65536 : 65536, 0, 0, flags, alpha);
            dst = (dst + width + dstStep) | 0;
            src = (src + (mirrored ? -width : width) + srcStep) | 0;
        }
        return true;
    }

    scaled(target: Int32Array | null, source: Int32Array | null, dst: number, width: number, height: number, dstStep: number, x: number, y: number, dx: number, dy: number, stride: number, flags: SdSpriteMode, alpha = 256): boolean {
        if (!this.owns(target)) return false;
        for (let row = 0; row < height; row++, dst = (dst + width + dstStep) | 0, y = (y + dy) | 0) {
            this.spriteSpan(target, source, dst, width, Math.imul(y >> 16, stride), x, 0, dx, 0, 0, flags, alpha);
        }
        return true;
    }

    private packBytes(bytes: Uint8Array): Int32Array {
        let packed = this.packedBytes.get(bytes);
        if (packed === undefined) {
            packed = new Int32Array(Math.ceil(bytes.length / 4));
            for (let i = 0; i < bytes.length; i++) packed[i >> 2] |= bytes[i] << ((i & 3) << 3);
            this.packedBytes.set(bytes, packed);
        }
        return packed;
    }

    invalidateBytes(bytes: Uint8Array | null): void {
        if (bytes !== null) this.packedBytes.delete(bytes);
    }

    // ch uses index zero for transparency, including when a nonzero index maps to RGB zero.
    indexed(
        target: Int32Array | null,
        indices: Uint8Array | null,
        palette: Int32Array | null,
        dst: number,
        width: number,
        height: number,
        dstStep: number,
        base: number,
        stride: number,
        x: number,
        y: number,
        dx: number,
        dy: number,
        mode: number,
        argument = 0
    ): boolean {
        if (!this.owns(target)) return false;
        if (width <= 0 || height <= 0) return true;
        if (indices === null) throw new TypeError('Null index array');
        const packed = this.packBytes(indices);
        const paletteBase = palette === null ? 0 : this.assetOffset(palette);
        for (let row = 0; row < height; row++, dst = (dst + width + dstStep) | 0, y = (y + dy) | 0) {
            const start = (base + Math.imul(y >> 16, stride)) | 0;
            // Short palettes can be legal when the image uses only their defined entries.
            const last = x + dx * (width - 1);
            if (palette === null || palette.length < 256 || last !== (last | 0) || start + (Math.min(x, last) >> 16) < 0 || start + (Math.max(x, last) >> 16) >= indices.length) {
                for (let i = 0, u = x; i < width; i++, u = (u + dx) | 0) {
                    const src = (start + (u >> 16)) | 0;
                    if (src < 0 || src >= indices.length || (indices[src] !== 0 && (palette === null || indices[src] >= palette.length))) {
                        if (i > 0) this.record(target, 7, dst, 0, i, start, paletteBase, argument, mode, packed, 0, x, 0, 0, dx);
                        if (src >= 0 && src < indices.length && palette === null) throw new TypeError('Null palette');
                        throw new RangeError('SD indexed span exceeds its source');
                    }
                }
            }
            if (!this.record(target, 7, dst, 0, width, start, paletteBase, argument, mode, packed, 0, x, 0, 0, dx)) return false;
        }
        return true;
    }

    glyph(target: Int32Array | null, mask: Uint8Array | null, colour: number, src: number, dst: number, width: number, height: number, dstStep: number, srcStep: number, alpha?: number): boolean {
        if (!this.owns(target)) return false;
        if (width <= 0 || height <= 0) return true;
        if (mask === null) throw new TypeError('Null array');
        const packed = this.packBytes(mask);
        for (let y = 0; y < height; y++) {
            if (src < 0 || src + width > mask.length) throw new RangeError('SD glyph exceeds its mask');
            if (!this.record(target, 6, dst, 0, width, colour, src, alpha ?? 256, alpha === undefined ? 0 : 1, packed)) return false;
            dst = (dst + width + dstStep) | 0;
            src = (src + width + srcStep) | 0;
        }
        return true;
    }

    // rh/vh sprite affine sampling. The centred rotation uses 12 fractional bits.
    spriteSpan(target: Int32Array | null, source: Int32Array | null, dst: number, count: number, base: number, x: number, y: number, dx: number, dy: number, stride: number, flags: SdSpriteMode, alpha = 256, shift = 16): boolean {
        if (!this.owns(target) || target === null) return false;
        if (count <= 0) return true;
        if (source === null) throw new TypeError('Null array');
        if (this.owns(source)) throw new Error('SD framebuffer cannot be used as a sprite source');
        const lastX = x + dx * (count - 1),
            lastY = y + dy * (count - 1);
        const minIndex = base + (Math.min(x, lastX) >> shift) + (Math.min(y, lastY) >> shift) * stride;
        const maxIndex = base + (Math.max(x, lastX) >> shift) + (Math.max(y, lastY) >> shift) * stride;
        if (lastX < -2147483648 || lastX > 2147483647 || lastY < -2147483648 || lastY > 2147483647 || minIndex < 0 || maxIndex >= source.length || dst < 0 || dst + count > this.target.length) {
            // rh/vh stop at the first actual array access that faults. A transparent texel can
            // advance past an invalid destination without loading or storing that destination.
            let begin = -1,
                end = 0,
                badIndex: number | undefined;
            for (let i = 0, sx = x, sy = y; i < count; i++, sx = (sx + dx) | 0, sy = (sy + dy) | 0) {
                const index = (base + (sx >> shift) + Math.imul(sy >> shift, stride)) | 0;
                if (index < 0 || index >= source.length) {
                    badIndex = index;
                    break;
                }
                const at = (dst + i) | 0;
                if (at < 0 || at >= this.target.length) {
                    const rgb = source[index];
                    if ((flags === SdSpriteMode.ColourKey || flags === SdSpriteMode.Opacity) && rgb === 0) continue;
                    if (flags === SdSpriteMode.PixelAlpha && rgb >>> 24 === 0) continue;
                    badIndex = at;
                    break;
                }
                if (begin < 0) begin = i;
                end = i + 1;
            }
            if (begin >= 0) this.record(target, 5, (dst + begin) | 0, 0, end - begin, base, shift, alpha, flags, source, stride, (x + Math.imul(begin, dx)) | 0, (y + Math.imul(begin, dy)) | 0, 0, dx, dy);
            if (badIndex !== undefined) throw new RangeError('array index ' + badIndex);
            return true;
        }
        if (!this.record(target, 5, dst, 0, count, base, shift, alpha, flags, source, stride, x, y, 0, dx, dy)) {
            throw new RangeError('SD sprite span exceeds the destination');
        }
        return true;
    }

    // The native flame sprite samples the framebuffer drawn so far, then draws that
    // sprite through the current clip. Keep an independent GPU copy of the entire sprite,
    // including the portion outside the clip, for its Java pixel array after the redraw.
    flames(target: Int32Array | null, x: number, y: number, sprite: Int32Array | null, offsets: Int32Array | null, heat: Int32Array | null, gradient: Int32Array | null): boolean {
        if (!this.owns(target) || target === null) return false;
        if (sprite === null || offsets === null || heat === null) throw new TypeError('Null array');
        this.feedback ??= new Map();
        let scratch = this.feedback.get(sprite);
        if (scratch === undefined) {
            scratch = this.initial.length + this.feedbackWords;
            this.feedback.set(sprite, scratch);
            this.feedbackWords += sprite.length;
        }
        const gradientBase = gradient === null ? 0 : this.assetOffset(gradient);
        this.flush();
        let dest = 0,
            heatPos = 0,
            src = (x + Math.imul(y, this.width)) | 0;
        for (let row = 1; row < 255; row++) {
            if (row >= offsets.length) throw new RangeError('array index ' + row);
            let shift = (Math.imul(256 - row, offsets[row]) / 256) | 0;
            if (shift < 0) shift = 0;
            heatPos = (heatPos + shift) | 0;
            const heated = Math.max(0, 128 - shift),
                count = heated + shift;
            for (let col = 0; col < count; col++) {
                if (src + col < 0 || src + col >= this.target.length) throw new RangeError('array index ' + (src + col));
                if (col < heated) {
                    const i = (heatPos + col) | 0;
                    if (i < 0 || i >= heat.length) throw new RangeError('array index ' + i);
                    const level = heat[i];
                    if (level !== 0) {
                        if (gradient === null) throw new TypeError('Null array');
                        if (level < 0 || level >= gradient.length) throw new RangeError('array index ' + level);
                    }
                }
                if (dest + col >= sprite.length) throw new RangeError('array index ' + (dest + col));
            }
            if (!this.record(target, 8, src, 0, count, heatPos, scratch + dest, heated, gradientBase, heat)) return false;
            dest = (dest + count) | 0;
            src = (src + count + this.width - 128) | 0;
            heatPos = (heatPos + heated) | 0;
        }
        this.flush();
        return true;
    }

    // World-map shape and font painters may skip pixels in the middle of a row.
    // Merge adjacent writes with identical colour and glyph coverage into one scanline.
    paintPixel(target: Int32Array | null, index: number, colour: number, alpha = 256): boolean {
        if (!this.owns(target) || target === null) return false;
        index |= 0;
        if (index < 0 || index >= this.target.length) throw new RangeError('array index ' + index);
        const row = (index / this.width) | 0;
        const previousLink = this.tails[row],
            previous = previousLink - 9,
            kind = alpha === 256 ? 4 : 10;
        // A banded triangle may be painted between two adjacent pixel writes.
        const band = row >> 3,
            size = this.bandSizes[band];
        const laterEdge = size > 0 && this.edgeBands[band][size - 1] > previousLink;
        // The word before a short Gouraud link is a negative palette offset.
        if (
            !laterEdge &&
            previousLink >= 0 &&
            this.words[previousLink - 1] === kind &&
            this.words[previous + 6] === 0 &&
            this.words[previous + 3] === colour &&
            this.words[previous + 5] === alpha &&
            this.words[previous] + this.words[previous + 1] === index
        ) {
            this.words[previous + 1]++;
            return true;
        }
        return this.record(target, kind, index, 0, 1, colour, 0, alpha, 0, null);
    }

    private assetOffset(asset: Int32Array): number {
        if (asset === this.lastAsset) return this.lastOffset;
        let offset = this.offsets.get(asset);
        if (offset === undefined) {
            offset = this.assetWords;
            if (this.persistent) {
                const end = offset + asset.length;
                if (end > this.assetBuffer.length) {
                    const grown = new Int32Array(Math.max(end, this.assetBuffer.length * 2, 1024));
                    grown.set(this.assetBuffer.subarray(0, offset));
                    this.assetBuffer = grown;
                }
                // Palettes and texels can change in place, or move to a different packed
                // offset. Compare against the previous packed words at this destination.
                const packed = this.assetBuffer;
                let first = 0;
                while (first < asset.length && packed[offset + first] === asset[first]) first++;
                if (first < asset.length) {
                    let last = asset.length - 1;
                    while (last > first && packed[offset + last] === asset[last]) last--;
                    this.assetDirtyStart = Math.min(this.assetDirtyStart, offset + first);
                    this.assetDirtyEnd = Math.max(this.assetDirtyEnd, offset + last + 1);
                    packed.set(asset, offset);
                }
            } else this.assets.push(asset.slice());
            this.offsets.set(asset, offset);
            this.assetWords += asset.length;
        }
        this.lastAsset = asset;
        this.lastOffset = offset;
        return offset;
    }

    // The nine dc arguments remain signed Java ints. This fast path only narrows their wire
    // encoding after proving all potential framebuffer and palette accesses are in range.
    projectedGouraud(
        target: Int32Array | null,
        stride: number,
        table: Int32Array | null,
        height: number,
        clip: number,
        low: boolean,
        alpha: number,
        palette: Int32Array | null,
        y0: number,
        y1: number,
        y2: number,
        x0: number,
        x1: number,
        x2: number,
        c0: number,
        c1: number,
        c2: number
    ): boolean {
        if (target !== this.guardedTarget || stride !== this.width || palette === null || this.owns(palette) || height >>> 0 > 32767 || clip > 32767 || alpha >>> 0 > 255) return false;
        const minY = Math.min(y0, y1, y2),
            maxY = Math.max(y0, y1, y2);
        const minX = Math.min(x0, x1, x2),
            maxX = Math.max(x0, x1, x2);
        const sx = maxX - minX,
            sy = maxY - minY;
        if (minX < -32768 || maxX > 32767 || minY < -32768 || maxY > 32767 || sx > 32767 || sy > 32767) return false;
        const area = Math.abs((x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0));
        if (area === 0 || minY >= height) return true;
        const start = Math.max(0, minY),
            end = Math.min(maxY, height);
        const base = table?.[start];
        if (base === undefined || base < 0) return false;
        if (end <= start || (clip >= 0 && (maxX <= 0 || minX >= clip))) return true;
        const firstRow = (base / stride) | 0,
            top = firstRow + end - start;
        const offset = base - firstRow * stride;
        if (top > this.height || offset + (clip >= 0 ? Math.max(0, minX) : minX) < 0 || offset + (clip >= 0 ? Math.min(clip, maxX) : maxX) > stride) return false;
        const lo = Math.min(c0, c1, c2),
            hi = Math.max(c0, c1, c2);
        const paletteLimit = Math.min(65536, palette.length);
        if (lo < 0 || hi >= paletteLimit) return false;
        // Each numerator is bounded by twice the colour range times the orthogonal
        // extent. Division truncates toward zero. The extra pixel accounts for dc's
        // leading x increment. Compare multiplied bounds to avoid CPU gradient division.
        const margin = Math.min(lo, paletteLimit - 1 - hi);
        if (margin * area < (hi - lo) * (4 * sx * sy + 2 * sy)) return false;
        const firstBand = firstRow >> 3,
            lastBand = (top - 1) >> 3;
        if (this.cursor + 8 + lastBand - firstBand + 1 + this.edgeCount > this.words.length) this.flush();
        const at = this.cursor,
            words = this.words;
        words[at] = ~base;
        words[at + 1] = (y0 & 65535) | (y1 << 16);
        words[at + 2] = (y2 & 65535) | (x0 << 16);
        words[at + 3] = (x1 & 65535) | (x2 << 16);
        words[at + 4] = c0 | (c1 << 16);
        words[at + 5] = c2 | (height << 16);
        words[at + 6] = (clip & 65535) | (alpha << 16) | (+low << 24);
        words[at + 7] = this.assetOffset(palette);
        this.cursor += 8;
        this.appendEdgeToBands(at, firstBand, lastBand);
        return true;
    }

    // dc has already selected its long edge and both short edges, applied its vertical
    // clip and fetched scanline[y]. Keep the native row walk for any unproved access.
    gouraudEdges(
        target: Int32Array | null,
        base: number,
        stride: number,
        top: number,
        bottom: number,
        long: number,
        longStep: number,
        first: number,
        firstStep: number,
        second: number,
        secondStep: number,
        longLeft: boolean,
        shade: number,
        shadeY: number,
        shadeX: number,
        clip: number,
        lowDetail: boolean,
        alpha: number,
        palette: Int32Array | null
    ): boolean {
        if (target !== this.guardedTarget || stride !== this.width || palette === null || this.owns(palette) || top < 0 || bottom < 0) return false;
        const rows = top + bottom;
        if (rows === 0) return true;
        const startY = (base / stride) | 0;
        if (base < 0 || startY + rows > this.height) return false;
        const offset = base - startY * stride;
        const middle = (long + Math.imul(longStep, top)) | 0;
        const middleShade = (shade + Math.imul(shadeY, top)) | 0;
        const limit = Math.min(0x80000000, palette.length * 256);
        if (!this.validGouraudEdges(top, long, longStep, first, firstStep, shade, shadeY, shadeX, clip, offset, limit) || !this.validGouraudEdges(bottom, middle, longStep, second, secondStep, middleShade, shadeY, shadeX, clip, offset, limit))
            return false;
        const paletteOffset = this.assetOffset(palette);
        this.writeGouraudEdges(base, startY, top, long, longStep, first, firstStep, longLeft, shade, shadeY, shadeX, clip, lowDetail, alpha, paletteOffset);
        this.writeGouraudEdges(base + top * stride, startY + top, bottom, middle, longStep, second, secondStep, longLeft, middleShade, shadeY, shadeX, clip, lowDetail, alpha, paletteOffset);
        return true;
    }

    private validGouraudEdges(rows: number, a: number, da: number, b: number, db: number, shade: number, dy: number, dx: number, clip: number, offset: number, limit: number): boolean {
        if (rows === 0) return true;
        const last = rows - 1;
        const a1 = a + da * last,
            b1 = b + db * last,
            shade1 = shade + dy * last;
        if (a1 !== (a1 | 0) || b1 !== (b1 | 0) || shade1 !== (shade1 | 0)) return false;
        let left = Math.min(a >> 16, b >> 16, a1 >> 16, b1 >> 16);
        let right = Math.max(a >> 16, b >> 16, a1 >> 16, b1 >> 16);
        if (clip >= 0) {
            left = Math.max(0, Math.min(clip, left));
            right = Math.max(0, Math.min(clip, right));
        }
        if (left === right) return true;
        if (offset + left < 0 || offset + right > this.width) return false;
        // Every actual interpolated colour is inside this interval, including the last
        // four-pixel group's sample. A wrapped interval falls back to the checked dc loop.
        return Math.min(shade, shade1) + Math.min(dx * left, dx * right) >= 0 && Math.max(shade, shade1) + Math.max(dx * left, dx * right) < limit;
    }

    private writeGouraudEdges(base: number, y: number, rows: number, a: number, da: number, b: number, db: number, longLeft: boolean, shade: number, dy: number, dx: number, clip: number, lowDetail: boolean, alpha: number, palette: number): void {
        if (rows === 0) return;
        let left = longLeft ? a : b,
            right = longLeft ? b : a;
        const dl = longLeft ? da : db,
            dr = longLeft ? db : da;
        const stride = this.width;
        const last = rows - 1,
            lastLeft = left + dl * last,
            lastRight = right + dr * last;
        if ((left >= right && lastLeft >= lastRight) || (clip >= 0 && (Math.max(right, lastRight) < 65536 || Math.min(left, lastLeft) >> 16 >= clip))) return;
        if (rows <= 3 && this.persistent && lowDetail && alpha === 0 && base + rows * stride <= 0x100000 && stride < 0x800) {
            // For short faces, the GPU's existing 3/5-word span occupies less storage than
            // both projected edges. Clip exactly as dc does before choosing a four-pixel group.
            for (let i = 0; i < rows; i++, y++, base += stride, left = (left + dl) | 0, right = (right + dr) | 0, shade = (shade + dy) | 0) {
                const x = clip < 0 ? left >> 16 : Math.max(0, left >> 16);
                const end = clip < 0 ? right >> 16 : Math.min(clip, right >> 16);
                const count = end - x;
                if (count <= 0) continue;
                const begin = (shade + Math.imul(dx, x)) | 0;
                const single = count <= 4 || dx << 2 === 0,
                    size = single ? 3 : shortGouraudWords;
                if (this.cursor + size + this.edgeCount > this.words.length) this.flush();
                const at = this.cursor,
                    words = this.words,
                    previous = this.tails[y];
                if (previous < 0) words[y] = at;
                else words[previous] = at;
                this.tails[y] = at + size - 1;
                this.cursor += size;
                words[at] = 0x80000000 | ((base + x) << 11) | count;
                if (single) words[at + 1] = ~(palette + (begin >> 8));
                else {
                    words[at + 1] = begin;
                    words[at + 2] = dx;
                    words[at + 3] = ~palette;
                }
                words[at + size - 1] = -1;
            }
            return;
        }
        // One projected half-triangle, linked once per eight rows it touches. The shader
        // merges that band's links with each row's normal span links by submission offset.
        for (let done = 0; done < rows;) {
            const count = Math.min(rows - done, (maxBatchWords - 16) * 4);
            const band = (y + done) >> 3,
                lastBand = (y + done + count - 1) >> 3;
            if (this.cursor + 13 + lastBand - band + 1 + this.edgeCount > this.words.length) this.flush();
            const words = this.words,
                at = this.cursor;
            words[at] = base + done * stride;
            words[at + 1] = y + done;
            words[at + 2] = count;
            words[at + 3] = (left + Math.imul(done, dl)) | 0;
            words[at + 4] = (right + Math.imul(done, dr)) | 0;
            words[at + 5] = dl;
            words[at + 6] = dr;
            words[at + 7] = (shade + Math.imul(done, dy)) | 0;
            words[at + 8] = dy;
            words[at + 9] = dx;
            words[at + 10] = clip;
            words[at + 11] = alpha;
            words[at + 12] = lowDetail ? ~palette : palette;
            this.cursor = at + 13;
            this.appendEdgeToBands(at, band, lastBand);
            done += count;
        }
    }

    private appendEdgeToBands(record: number, first: number, last: number): void {
        for (let band = first; band <= last; band++) {
            const size = this.bandSizes[band];
            let list = this.edgeBands[band];
            if (list === undefined || list.length === size) {
                const grown = new Int32Array(Math.max(32, size * 2));
                if (list !== undefined) grown.set(list);
                list = this.edgeBands[band] = grown;
            }
            list[size] = record;
            this.bandSizes[band] = size + 1;
        }
        this.edgeCount += last - first + 1;
    }

    // dc emits this span for each covered row of a Gouraud triangle. The common case
    // is a previously sampled palette and an in-row run. Keep its original range
    // checks here so an exceptional source, a row crossing, or a batch boundary
    // still follows the general record path.
    gouraud(target: Int32Array | null, row: number, x0: number, x1: number, colour: number, step: number, alpha: number, flags: number, palette: Int32Array | null, checked = false): boolean {
        if (target !== this.guardedTarget || palette === null || palette !== this.lastAsset || this.owns(palette)) {
            return this.generalGouraud(target, row, x0, x1, colour, step, alpha, flags, palette, checked);
        }
        const first = (row + x0) | 0,
            count = x1 - x0,
            y = (first / this.width) | 0;
        const begin = (colour + Math.imul(step, x0)) | 0;
        // dc shifts the low-detail increment to a Java int before advancing between groups.
        const end = begin + ((flags & 1) !== 0 ? (step << 2) * ((count - 1) >> 2) : step * (count - 1));
        const limit = Math.min(0x80000000, palette.length * 256);
        const compact = this.persistent && alpha === 0 && flags === 1 && first < 0x100000 && count < 0x800;
        const singleSample = count <= 4 || step << 2 === 0;
        const size = compact ? (singleSample ? 3 : shortGouraudWords) : headerWords;
        if (first < 0 || y >= this.height || count <= 0 || first + count > (y + 1) * this.width || this.cursor + size + this.edgeCount > this.words.length || begin < 0 || end < 0 || begin >= limit || end >= limit) {
            return this.generalGouraud(target, row, x0, x1, colour, step, alpha, flags, palette, checked);
        }
        const at = this.cursor,
            previous = this.tails[y],
            words = this.words;
        if (previous < 0) words[y] = at;
        else words[previous] = at;
        this.tails[y] = at + size - 1;
        this.cursor = at + size;
        if (compact) {
            words[at] = 0x80000000 | (first << 11) | count;
            if (singleSample) {
                words[at + 1] = ~(this.lastOffset + (begin >> 8));
                words[at + 2] = -1;
                return true;
            }
            words[at + 1] = begin;
            words[at + 2] = step;
            words[at + 3] = ~this.lastOffset;
            words[at + 4] = -1;
            return true;
        }
        words[at] = first;
        words[at + 1] = count;
        words[at + 2] = x0;
        words[at + 3] = colour;
        words[at + 4] = step;
        words[at + 5] = alpha;
        words[at + 6] = flags;
        words[at + 7] = this.lastOffset;
        words[at + 8] = 1;
        words[at + 9] = -1;
        return true;
    }

    private generalGouraud(target: Int32Array | null, row: number, x0: number, x1: number, colour: number, step: number, alpha: number, flags: number, palette: Int32Array | null, checked: boolean): boolean {
        const prior = this.error;
        if (this.record(target, 1, row, x0, x1, colour, step, alpha, flags, palette)) return true;
        if (!checked || target === null || !this.owns(target)) return false;
        this.error = prior;
        // An unproved range can still contain legal samples. dc reads the palette first, then
        // each destination of the colour group. Record exactly the legal prefix before throwing.
        const low = (flags & 1) !== 0,
            group = low ? 4 : 1;
        const count = x1 - x0;
        for (let i = 0; i < count; i += group) {
            const shade = (colour + Math.imul(step, x0 + i)) | 0;
            const sample = shade >> 8;
            if (palette === null) throw new TypeError('Null array');
            if (sample < 0 || sample >= palette.length) throw new RangeError('array index ' + sample);
            const first = (row + x0 + i) | 0;
            const n = Math.min(group, count - i);
            const valid = first < 0 ? 0 : Math.max(0, Math.min(n, this.target.length - first));
            if (valid > 0) this.record(target, 1, first, 0, valid, shade, 0, alpha, flags, palette);
            if (valid !== n) throw new RangeError('array index ' + ((first + valid) | 0));
        }
        return true;
    }

    // Returning false lets dc execute the original checked loads/stores for exceptional spans.
    record(target: Int32Array | null, kind: number, row: number, x0: number, x1: number, colour: number, step: number, alpha: number, flags: number, asset: Int32Array | null, origin = 0, u = 0, v = 0, w = 0, du = 0, dv = 0, dw = 0): boolean {
        if (!this.owns(target) || target === null) return false;
        // dc can read its colours from the drawing surface. An immutable asset snapshot
        // would miss earlier stores, including stores in another row or the preceding group.
        const livePalette = kind === 1 && this.owns(asset);
        if (livePalette) kind = 11;
        const first = (row + x0) | 0,
            count = x1 - x0;
        // The native PixScreen also owns one sentinel word beyond the final visible row.
        // A checked Gouraud span can legally draw there before faulting on the next store.
        const physicalRow = (first / this.width) | 0;
        const y = kind === 1 || livePalette ? Math.min(this.height - 1, physicalRow) : physicalRow;
        const rightRead = kind === 0 && alpha === 254 ? 1 : 0;
        if (first < 0 || y >= this.height || count <= 0 || first + count + rightRead > this.target.length) {
            this.error = 'SD span exceeds the destination';
            return false;
        }
        let offset = 0;
        if ((kind >= 1 && kind <= 3) || kind === 5 || kind === 6 || kind === 7 || kind === 8 || livePalette) {
            if (asset === null) {
                this.error = 'Missing SD scanline source';
                return false;
            }
            if (kind === 1 || livePalette) {
                const begin = (colour + Math.imul(step, x0)) | 0;
                const end = begin + ((flags & 1) !== 0 ? (step << 2) * ((count - 1) >> 2) : step * (count - 1));
                if (Math.min(begin, end) < 0 || Math.max(begin, end) >= Math.min(0x80000000, asset.length * 256)) {
                    this.error = 'SD Gouraud span exceeds its palette';
                    return false;
                }
            } else if ((kind === 2 || kind === 3) && asset.length < ((flags & 1) === 1 ? 4096 : 16384)) {
                this.error = 'SD texture span has an incomplete source';
                return false;
            }
            if (!livePalette) offset = this.assetOffset(asset);
        }
        const crossesRow = first + count + rightRead > (y + 1) * this.width;
        const isolate = crossesRow || livePalette;
        const projected = kind === 2 || kind === 3 || kind === 5 || kind === 7;
        const spanWords = headerWords + (projected ? 7 : 0);
        if (isolate || this.cursor + spanWords + this.edgeCount > this.words.length) this.flush();
        const at = this.cursor,
            previous = this.tails[y];
        if (previous < 0) this.words[y] = at;
        else this.words[previous] = at;
        // A flat span at alpha 254 copies the pixel to its right. One lane must execute
        // this row in native order, including any earlier draws which produced that neighbour.
        if (rightRead !== 0 || livePalette) this.words[y] |= -0x80000000;
        this.tails[y] = at + 9;
        const words = this.words;
        words[at] = first;
        words[at + 1] = count;
        words[at + 2] = x0;
        words[at + 3] = colour;
        words[at + 4] = step;
        words[at + 5] = alpha;
        words[at + 6] = flags;
        words[at + 7] = offset;
        words[at + 8] = kind;
        words[at + 9] = -1;
        if (projected) {
            words[at + 10] = origin;
            words[at + 11] = u;
            words[at + 12] = v;
            words[at + 13] = w;
            words[at + 14] = du;
            words[at + 15] = dv;
            words[at + 16] = dw;
        }
        this.cursor += spanWords;
        if (isolate) this.flush();
        return true;
    }

    finish(): SdRasterFrame {
        if (this.error !== undefined) throw new Error(this.error);
        let assets: Int32Array;
        if (this.persistent) {
            this.flush(false);
            assets = this.assetBuffer.subarray(0, this.assetWords);
        } else {
            // Standalone captures also reject writes through aliases to the source framebuffer.
            for (let i = 0; i < this.initial.length; i++) {
                if (this.target[i] !== this.initial[i]) throw new Error('CPU framebuffer write during SD WebGPU scene pass');
            }
            this.flush();
            assets = new Int32Array(this.assetWords);
            let offset = 0;
            for (const words of this.assets) {
                assets.set(words, offset);
                offset += words.length;
            }
        }
        const frame: SdRasterFrame = { width: this.width, height: this.height, initial: this.initial, assets, batches: this.batches };
        if (this.persistent) frame.assetChanges = { revision: this.assetRevision, start: this.assetDirtyStart, end: this.assetDirtyEnd };
        if (this.feedback?.size) frame.feedback = Array.from(this.feedback, ([pixels, offset]) => ({ offset, pixels }));
        return frame;
    }
}
