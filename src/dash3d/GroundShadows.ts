import Pix8 from '#/graphics/Pix8';
import GlRenderer from '#/gl/GlRenderer';
import GlLighting from '#/gl/GlLighting';
import MaterialManager from '#/gl/material/MaterialManager';
import { GL } from '#/jogl/GL';
import { arrayAtI32, arrayAtObj, arrayAtU8, arrayPutObj, arrayPutU8, requireNonNull } from '#/util/JavaArray';
import type LocType from '#/config/LocType';
import { isJavaRuntimeException } from '#/util/JavaException';
import WrappedException from '#/util/WrappedException';
import world from './world';
import GroundShadowBlock from './GroundShadowBlock';

// HD tj. Floor and projected model silhouettes accumulate in an 8-fine-unit shadow bitmap with a
// one-texel border. Each dirty 8×8-tile block supplies a GL_ALPHA texture for the terrain pass.
export default class GroundShadows {
    // tj.a:Lek;. The scene shadow bitmap, (widthBlocks * 128 + 2) x (lengthBlocks * 128 + 2) with an empty palette.
    static shadowMap: Pix8 | null = null;
    // tj.b:[[Lwm;. The shadow blocks, [widthBlocks][lengthBlocks].
    static blocks: (GroundShadowBlock | null)[][] | null = null;
    // tj.c:I. The block rows along z: (length + 7) >> 3.
    private static lengthBlocks = 0;
    // tj.d:[Lek;. The shadow stamps per loc shape. HD Client.loadSprites (cg.a(ILve;)V) loads them while GL is active.
    static shadowSprites: (Pix8 | null)[] | null = null;
    // tj.e:I. The block columns along x: (width + 7) >> 3.
    private static widthBlocks = 0;

    // tj.a(IIZZIIIIII)V
    static addTile(shape: number, rotation: number, skipOverlay: boolean, skipUnderlay: boolean, x: number, z: number, sw: number, se: number, ne: number, nw: number): void {
        if (skipOverlay && skipUnderlay) return;
        if (skipOverlay && shape === 1) return;
        if (skipUnderlay && shape === 0) return;
        const fineX = x << 7;
        const y = (sw + se + ne + nw) >> 2;
        const fineZ = z << 7;
        const mapX = (fineX - (Math.imul(y, GlLighting.shadowSlopeX) >> 8)) >> 3;
        const mapZ = (fineZ - (Math.imul(y, GlLighting.shadowSlopeZ) >> 8)) >> 3;
        if (shape === 0 || shape === 1 || (!skipOverlay && !skipUnderlay)) {
            GroundShadows.addSprite(arrayAtObj(GroundShadows.shadowSprites, 1), GroundShadows.shadowMap, mapX + 1, mapZ + 1);
            return;
        }
        GroundShadows.addRotatedSprite(arrayAtObj(GroundShadows.shadowSprites, shape), GroundShadows.shadowMap, mapX + 1, mapZ + 1, rotation, skipOverlay);
    }

    // tj.a(Lek;Lek;II)V
    private static addSprite(src: Pix8 | null, dst: Pix8 | null, x: number, z: number): void {
        x = (x + requireNonNull(src).xOffset) | 0;
        z = (z + requireNonNull(src).yOffset) | 0;
        let to = (x + Math.imul(z, requireNonNull(dst).width)) | 0;
        let from = 0;
        let h = requireNonNull(src).height;
        let w = requireNonNull(src).width;
        let toStep = (requireNonNull(dst).width - w) | 0;
        let fromStep = 0;
        if (z <= 0) {
            const clip = (1 - z) | 0;
            h = (h - clip) | 0;
            from = (from + Math.imul(clip, w)) | 0;
            to = (to + Math.imul(clip, requireNonNull(dst).width)) | 0;
            z = 1;
        }
        if (((z + h) | 0) >= requireNonNull(dst).height) h = (h - ((z + h + 1 - requireNonNull(dst).height) | 0)) | 0;
        if (x <= 0) {
            const clip = (1 - x) | 0;
            w = (w - clip) | 0;
            from = (from + clip) | 0;
            to = (to + clip) | 0;
            fromStep = (fromStep + clip) | 0;
            toStep = (toStep + clip) | 0;
            x = 1;
        }
        if (((x + w) | 0) >= requireNonNull(dst).width) {
            const clip = (x + w + 1 - requireNonNull(dst).width) | 0;
            w = (w - clip) | 0;
            fromStep = (fromStep + clip) | 0;
            toStep = (toStep + clip) | 0;
        }
        if (w <= 0 || h <= 0) return;
        GroundShadows.addPixels(requireNonNull(dst).pixels, requireNonNull(src).pixels, from, to, w, h, toStep, fromStep);
        GroundShadows.dirtyRect(x, z, w, h);
    }

    // tj.b([B[BIIIIII)V
    private static addPixels(dst: Uint8Array | null, src: Uint8Array | null, from: number, to: number, width: number, height: number, toStep: number, fromStep: number): void {
        const groups = -(width >> 2);
        const tail = -(width & 3);
        for (let row = -height | 0; row < 0; row++) {
            if (dst !== null && src !== null && width >= 0 && to >= 0 && from >= 0 && to + width <= dst.length && from + width <= src.length) {
                // The complete row is in bounds. Keep tj's forward byte order for overlapping stamps.
                for (let group = groups; group < 0; group++) {
                    dst[to++] += src[from++];
                    dst[to++] += src[from++];
                    dst[to++] += src[from++];
                    dst[to++] += src[from++];
                }
                for (let col = tail; col < 0; col++) dst[to++] += src[from++];
            } else {
                for (let group = groups; group < 0; group++) {
                    arrayPutU8(dst, to, arrayAtU8(dst, to++) + arrayAtU8(src, from++));
                    arrayPutU8(dst, to, arrayAtU8(dst, to++) + arrayAtU8(src, from++));
                    arrayPutU8(dst, to, arrayAtU8(dst, to++) + arrayAtU8(src, from++));
                    arrayPutU8(dst, to, arrayAtU8(dst, to++) + arrayAtU8(src, from++));
                }
                for (let col = tail; col < 0; col++) arrayPutU8(dst, to, arrayAtU8(dst, to++) + arrayAtU8(src, from++));
            }
            to = (to + toStep) | 0;
            from = (from + fromStep) | 0;
        }
    }

    // tj.c(Lek;Lek;II)V
    private static removeSprite(src: Pix8 | null, dst: Pix8 | null, x: number, z: number): void {
        x = (x + requireNonNull(src).xOffset) | 0;
        z = (z + requireNonNull(src).yOffset) | 0;
        let to = (x + Math.imul(z, requireNonNull(dst).width)) | 0;
        let from = 0;
        let h = requireNonNull(src).height;
        let w = requireNonNull(src).width;
        let toStep = (requireNonNull(dst).width - w) | 0;
        let fromStep = 0;
        if (z <= 0) {
            const clip = (1 - z) | 0;
            h = (h - clip) | 0;
            from = (from + Math.imul(clip, w)) | 0;
            to = (to + Math.imul(clip, requireNonNull(dst).width)) | 0;
            z = 1;
        }
        if (((z + h) | 0) >= requireNonNull(dst).height) h = (h - ((z + h + 1 - requireNonNull(dst).height) | 0)) | 0;
        if (x <= 0) {
            const clip = (1 - x) | 0;
            w = (w - clip) | 0;
            from = (from + clip) | 0;
            to = (to + clip) | 0;
            fromStep = (fromStep + clip) | 0;
            toStep = (toStep + clip) | 0;
            x = 1;
        }
        if (((x + w) | 0) >= requireNonNull(dst).width) {
            const clip = (x + w + 1 - requireNonNull(dst).width) | 0;
            w = (w - clip) | 0;
            fromStep = (fromStep + clip) | 0;
            toStep = (toStep + clip) | 0;
        }
        if (w <= 0 || h <= 0) return;
        GroundShadows.subtractPixels(requireNonNull(dst).pixels, requireNonNull(src).pixels, from, to, w, h, toStep, fromStep);
        GroundShadows.dirtyRect(x, z, w, h);
    }

    // tj.a([B[BIIIIII)V
    private static subtractPixels(dst: Uint8Array | null, src: Uint8Array | null, from: number, to: number, width: number, height: number, toStep: number, fromStep: number): void {
        const groups = -(width >> 2);
        const tail = -(width & 3);
        for (let row = -height | 0; row < 0; row++) {
            for (let group = groups; group < 0; group++) {
                arrayPutU8(dst, to, arrayAtU8(dst, to++) - arrayAtU8(src, from++));
                arrayPutU8(dst, to, arrayAtU8(dst, to++) - arrayAtU8(src, from++));
                arrayPutU8(dst, to, arrayAtU8(dst, to++) - arrayAtU8(src, from++));
                arrayPutU8(dst, to, arrayAtU8(dst, to++) - arrayAtU8(src, from++));
            }
            for (let col = tail; col < 0; col++) arrayPutU8(dst, to, arrayAtU8(dst, to++) - arrayAtU8(src, from++));
            to = (to + toStep) | 0;
            from = (from + fromStep) | 0;
        }
    }

    // tj.c(Lek;III)V
    static addLoc(sprite: Pix8 | null, x: number, y: number, z: number): void {
        if (sprite === null) return;
        const destX = (x - (Math.imul(y, GlLighting.shadowSlopeX) >> 8)) >> 3;
        const destZ = (z - (Math.imul(y, GlLighting.shadowSlopeZ) >> 8)) >> 3;
        GroundShadows.addSprite(sprite, GroundShadows.shadowMap, destX + 1, destZ + 1);
    }

    // tj.a(Lek;III)V
    static removeLoc(sprite: Pix8 | null, x: number, y: number, z: number): void {
        if (sprite === null) return;
        const destX = (x - (Math.imul(y, GlLighting.shadowSlopeX) >> 8)) >> 3;
        const destZ = (z - (Math.imul(y, GlLighting.shadowSlopeZ) >> 8)) >> 3;
        GroundShadows.removeSprite(sprite, GroundShadows.shadowMap, destX + 1, destZ + 1);
    }

    // HD al.a(Lpb;BIIIIIII)V
    static removeStaticLoc(type: LocType, guard: number, offsetZ: number, angle: number, offsetX: number, shape: number, tileX: number, tileZ: number, level: number): void {
        try {
            const rotation = angle & 3;
            let width: number, length: number;
            if (rotation === 1 || rotation === 3) {
                width = type.length;
                length = type.width;
            } else {
                length = type.length;
                width = type.width;
            }
            let z0: number, z1: number;
            if (((tileZ + length) | 0) > 104) {
                z1 = (tileZ + 1) | 0;
                z0 = tileZ;
            } else {
                z0 = (tileZ + (length >> 1)) | 0;
                z1 = (tileZ + ((1 + length) >> 1)) | 0;
            }
            const x = ((tileX << 7) + (width << 6)) | 0;
            const z = ((tileZ << 7) + (length << 6)) | 0;
            let x0: number, x1: number;
            if (((tileX + width) | 0) > 104) {
                x0 = tileX;
                x1 = (tileX + 1) | 0;
            } else {
                x0 = (tileX + (width >> 1)) | 0;
                x1 = (tileX + ((width + 1) >> 1)) | 0;
            }
            const heights = arrayAtObj(world.levelHeightmaps, level);
            let shadowY = 0;
            const y = (arrayAtI32(arrayAtObj(heights, x0), z1) + arrayAtI32(arrayAtObj(heights, x0), z0) + arrayAtI32(arrayAtObj(heights, x1), z0) + arrayAtI32(arrayAtObj(heights, x1), z1)) >> 2;
            if (level !== 0) {
                const ground = arrayAtObj(world.levelHeightmaps, 0);
                shadowY = (y - ((arrayAtI32(arrayAtObj(ground, x0), z1) + arrayAtI32(arrayAtObj(ground, x1), z0) + (arrayAtI32(arrayAtObj(ground, x0), z0) + arrayAtI32(arrayAtObj(ground, x1), z1))) >> 2)) | 0;
            }
            let above = null;
            if (level < 3) above = arrayAtObj(world.levelHeightmaps, (level + 1) | 0);
            const loc = type.GetModel(above, shape, angle, y, false, heights, null, z, x, true);
            GroundShadows.removeLoc(loc.shadow, (x - offsetX) | 0, shadowY, (z - offsetZ) | 0);
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'al.K(' + (type === null ? 'null' : '{...}') + ',' + [guard, offsetZ, angle, offsetX, shape, tileX, tileZ, level].join(',') + ')');
        }
    }

    // tj.b(Lek;III)Z
    static testLoc(sprite: Pix8 | null, x: number, y: number, z: number): boolean {
        if (sprite === null) return false;
        const destX = (x - (Math.imul(y, GlLighting.shadowSlopeX) >> 8)) >> 3;
        const destZ = (z - (Math.imul(y, GlLighting.shadowSlopeZ) >> 8)) >> 3;
        return GroundShadows.testSprite(sprite, GroundShadows.shadowMap, destX + 1, destZ + 1);
    }

    // tj.b(Lek;Lek;II)Z
    private static testSprite(src: Pix8, dst: Pix8 | null, x: number, z: number): boolean {
        x = (x + src.xOffset) | 0;
        z = (z + src.yOffset) | 0;
        let to = (x + Math.imul(z, requireNonNull(dst).width)) | 0;
        let height = src.height;
        let width = src.width;
        let skip = (requireNonNull(dst).width - width) | 0;
        if (z <= 0) {
            const clip = (1 - z) | 0;
            height = (height - clip) | 0;
            to = (to + Math.imul(clip, requireNonNull(dst).width)) | 0;
            z = 1;
        }
        if (((z + height) | 0) >= requireNonNull(dst).height) height = (height - ((z + height + 1 - requireNonNull(dst).height) | 0)) | 0;
        if (x <= 0) {
            const clip = (1 - x) | 0;
            width = (width - clip) | 0;
            to = (to + clip) | 0;
            skip = (skip + clip) | 0;
            x = 1;
        }
        if (((x + width) | 0) >= requireNonNull(dst).width) {
            const clip = (x + width + 1 - requireNonNull(dst).width) | 0;
            width = (width - clip) | 0;
            skip = (skip + clip) | 0;
        }
        if (width <= 0 || height <= 0) return false;
        GroundShadows.dirtyRect(x, z, width, height);
        skip = (skip + Math.imul(7, requireNonNull(dst).width)) | 0;
        return GroundShadows.hasUnshadowedPixels(requireNonNull(dst).pixels, to, width, height, skip, 8);
    }

    // tj.a([BIIIII)Z
    private static hasUnshadowedPixels(dst: Uint8Array | null, start: number, width: number, height: number, skip: number, step: number): boolean {
        const rest = width % step;
        const extra = rest !== 0 ? (step - rest) | 0 : 0;
        const rows = -((((height + step - 1) | 0) / step) | 0);
        const cols = -((((width + step - 1) | 0) / step) | 0);
        for (let row = rows; row < 0; row++) {
            for (let col = cols; col < 0; col++) {
                if (arrayAtU8(dst, start) === 0) return true;
                start = (start + step) | 0;
            }
            start = (start - extra) | 0;
            if (arrayAtU8(dst, (start - 1) | 0) === 0) return true;
            start = (start + skip) | 0;
        }
        return false;
    }

    // tj.a(Lek;Lek;IIIZ)V
    private static addRotatedSprite(src: Pix8 | null, dst: Pix8 | null, x: number, z: number, rotation: number, invert: boolean): void {
        if (x <= 0 || z <= 0 || ((x + 16) | 0) >= requireNonNull(dst).width || ((z + 16) | 0) >= requireNonNull(dst).height) return;
        const to = (x + Math.imul(z, requireNonNull(dst).width)) | 0;
        const toStep = (requireNonNull(dst).width - 16) | 0;
        let start: number;
        let dx: number;
        let dz: number;
        if (rotation === 0) {
            start = 240;
            dx = 1;
            dz = -32;
        } else if (rotation === 1) {
            start = 255;
            dx = -16;
            dz = 255;
        } else if (rotation === 2) {
            start = 15;
            dx = -1;
            dz = 32;
        } else {
            start = 0;
            dx = 16;
            dz = -255;
        }
        if (invert) GroundShadows.addInverse16(requireNonNull(dst).pixels, requireNonNull(src).pixels, start, to, toStep, dx, dz);
        else GroundShadows.add16(requireNonNull(dst).pixels, requireNonNull(src).pixels, start, to, toStep, dx, dz);
        GroundShadows.dirtyRect(x, z, 16, 16);
    }

    // tj.a([B[BIIIII)V
    private static addInverse16(dst: Uint8Array | null, src: Uint8Array | null, from: number, to: number, toStep: number, dx: number, dz: number): void {
        for (let row = -16; row < 0; row++) {
            for (let group = -4; group < 0; group++) {
                arrayPutU8(dst, to, arrayAtU8(dst, to++) + 1 - arrayAtU8(src, from));
                arrayPutU8(dst, to, arrayAtU8(dst, to++) + 1 - arrayAtU8(src, (from += dx)));
                arrayPutU8(dst, to, arrayAtU8(dst, to++) + 1 - arrayAtU8(src, (from += dx)));
                arrayPutU8(dst, to, arrayAtU8(dst, to++) + 1 - arrayAtU8(src, (from += dx)));
                from += dx;
            }
            to = (to + toStep) | 0;
            from = (from + dz) | 0;
        }
    }

    // tj.b([B[BIIIII)V
    private static add16(dst: Uint8Array | null, src: Uint8Array | null, from: number, to: number, toStep: number, dx: number, dz: number): void {
        for (let row = -16; row < 0; row++) {
            for (let group = -4; group < 0; group++) {
                arrayPutU8(dst, to, arrayAtU8(dst, to++) + arrayAtU8(src, from));
                arrayPutU8(dst, to, arrayAtU8(dst, to++) + arrayAtU8(src, (from += dx)));
                arrayPutU8(dst, to, arrayAtU8(dst, to++) + arrayAtU8(src, (from += dx)));
                arrayPutU8(dst, to, arrayAtU8(dst, to++) + arrayAtU8(src, (from += dx)));
                from += dx;
            }
            to = (to + toStep) | 0;
            from = (from + dz) | 0;
        }
    }

    // tj.a(IIII)V
    private static dirtyRect(x: number, z: number, w: number, h: number): void {
        const x0 = (x - 1) >> 7;
        const x1 = (x - 1 + w - 1) >> 7;
        const z0 = (z - 1) >> 7;
        const z1 = (z - 1 + h - 1) >> 7;
        for (let i = x0; i <= x1; i++) {
            for (let j = z0; j <= z1; j++) requireNonNull(arrayAtObj(arrayAtObj(GroundShadows.blocks, i), j)).dirty = true;
        }
    }

    // tj.a(IIII[[Z[[I)V. The eye height and ground heights are unread.
    static draw(eyeX: number, eyeZ: number, radius: number, _eyeY: number, visibility: boolean[][] | null, _heights: Int32Array[] | null): void {
        const gl = GlRenderer.gl;
        GlRenderer.setTextureCombineRgb(1);
        GlRenderer.setTextureCombineAlpha(1);
        GlRenderer.resetTextureMatrix();
        GlRenderer.setLighting(false);
        MaterialManager.setMaterial(0, 0);
        requireNonNull(gl).glDepthMask(false);
        for (let x = 0; x < GroundShadows.widthBlocks; x++) {
            blocks: for (let z = 0; z < GroundShadows.lengthBlocks; z++) {
                for (let tileX = x * 8; tileX < x * 8 + 8; tileX++) {
                    const dx = (tileX - eyeX) | 0;
                    if (dx < (-radius | 0) || dx > radius) continue;
                    for (let tileZ = z * 8; tileZ < z * 8 + 8; tileZ++) {
                        const dz = (tileZ - eyeZ) | 0;
                        if (dz < (-radius | 0) || dz > radius || !arrayAtObj(arrayAtObj(visibility, (dx + radius) | 0), (dz + radius) | 0)) continue;
                        const block = requireNonNull(arrayAtObj(arrayAtObj(GroundShadows.blocks, x), z));
                        if (block.dirty) {
                            block.updateTexture(GroundShadows.shadowMap, x, z);
                            block.dirty = false;
                        }
                        requireNonNull(gl).glPushMatrix();
                        requireNonNull(gl).glTranslatef(x * 1024, 0, z * 1024);
                        block.draw();
                        requireNonNull(gl).glPopMatrix();
                        continue blocks;
                    }
                }
            }
        }
        requireNonNull(gl).glEnableClientState(GL.GL_COLOR_ARRAY);
        requireNonNull(gl).glDepthMask(true);
        GlRenderer.applyLightingPreference();
    }

    // tj.a()V. lb.a(Z)V calls it at the start of every window rebuild. Stores a, d, b in that order.
    static unload(): void {
        GroundShadows.shadowMap = null;
        GroundShadows.shadowSprites = null;
        GroundShadows.blocks = null;
    }

    // tj.b()V
    static release(): void {
        GroundShadows.shadowMap = null;
        GroundShadows.shadowSprites = null;
        GroundShadows.blocks = null;
    }

    // tj.a(II)V. lb.a(Z)V calls it with 104, 104 when the rebuild finds GL active. The block counts round the tile
    // size up to whole 8-tile blocks; the bitmap is allocated before the grid, then every block is constructed (each
    // generating its GL texture) in the jar's loop order, x outer and z inner, re-reading the statics each pass.
    static init(width: number, length: number): void {
        GroundShadows.widthBlocks = ((width + 7) | 0) >> 3;
        GroundShadows.lengthBlocks = ((length + 7) | 0) >> 3;
        GroundShadows.shadowMap = new Pix8((Math.imul(GroundShadows.widthBlocks, 128) + 2) | 0, (Math.imul(GroundShadows.lengthBlocks, 128) + 2) | 0, 0);
        GroundShadows.blocks = newBlockArray2(GroundShadows.widthBlocks, GroundShadows.lengthBlocks);
        for (let var2 = 0; var2 < GroundShadows.widthBlocks; var2++) {
            for (let var3 = 0; var3 < GroundShadows.lengthBlocks; var3++) {
                arrayPutObj(arrayAtObj(GroundShadows.blocks, var2), var3, new GroundShadowBlock());
            }
        }
    }
}

// new wm[d0][d1] (multianewarray): both counts are checked for a negative size before anything is allocated.
function newBlockArray2(d0: number, d1: number): (GroundShadowBlock | null)[][] {
    if (d0 < 0) throw new RangeError('NegativeArraySizeException ' + d0);
    if (d1 < 0) throw new RangeError('NegativeArraySizeException ' + d1);
    return Array.from({ length: d0 }, () => new Array<GroundShadowBlock | null>(d1).fill(null));
}
