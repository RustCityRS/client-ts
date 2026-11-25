import type Pix32 from '#/graphics/Pix32';
import { GL } from '#/jogl/GL';
import { bitCeil } from '#/util/IntUtils';
import { arrayAtI32, arrayPutI8, requireNonNull } from '#/util/JavaArray';
import ByteBuffer from '#/util/nio/ByteBuffer';
import GlCleaner from './GlCleaner';
import GlRenderer from './GlRenderer';
import GlSprite from './GlSprite';

// el in runescape_gl.jar (HD only): the GL counterpart of SoftwareAlphaSprite (am). It differs from GlSprite only in
// the upload, which keeps each pixel's own alpha (argb >>> 24) instead of making every non-zero pixel opaque. The
// alpha sprite loader (re.b(I)[Lqf;) and the widget code (be.a, ij.a: `x instanceof am ? new el(x) : new cf(x)`)
// build one when GL is active. Its upload, unlike GlSprite's, does not record the context generation with a new
// texture name; GlSprite's list creation, which follows in the constructor, does. NXT has no GL 1.x classes, so the
// name is descriptive (HD_PLAN.md 1.3).
export default class GlAlphaSprite extends GlSprite {
    // el.a([I)V
    override upload(pixels: Int32Array | null): void {
        this.textureWidth = bitCeil(this.width);
        this.textureHeight = bitCeil(this.height);
        const bytes = new Int8Array(Math.imul(Math.imul(this.textureWidth, this.textureHeight), 4));
        let dst = 0;
        let src = 0;
        const rowPadding = Math.imul((this.textureWidth - this.width) | 0, 4);
        for (let row = 0; row < this.height; row++) {
            for (let column = 0; column < this.width; column++) {
                let argb: number;
                if ((argb = arrayAtI32(pixels, src++)) !== 0) {
                    arrayPutI8(bytes, dst++, ((argb >> 16) << 24) >> 24);
                    arrayPutI8(bytes, dst++, ((argb >> 8) << 24) >> 24);
                    arrayPutI8(bytes, dst++, (argb << 24) >> 24);
                    arrayPutI8(bytes, dst++, argb >> 24);
                    continue;
                }
                dst = (dst + 4) | 0;
            }
            dst = (dst + rowPadding) | 0;
        }
        const buffer = ByteBuffer.wrap(bytes);
        const gl = GlRenderer.gl;
        if (this.texture === -1) {
            const names = new Int32Array(1);
            requireNonNull(gl).glGenTextures(1, names, 0);
            this.texture = arrayAtI32(names, 0);
        }
        GlRenderer.bindTexture2D(this.texture);
        requireNonNull(gl).glTexImage2D(GL.GL_TEXTURE_2D, 0, GL.GL_RGBA, this.textureWidth, this.textureHeight, 0, GL.GL_RGBA, GL.GL_UNSIGNED_BYTE, buffer);
        GlCleaner.memory2d = (GlCleaner.memory2d + (buffer.limit() - this.size)) | 0;
        this.size = buffer.limit();
    }

    // el.<init>(IIIIII[I)V
    constructor(cropW: number, cropH: number, xOffset: number, yOffset: number, width: number, height: number, pixels: Int32Array | null);
    // el.<init>(Lmm;)V
    constructor(sprite: Pix32 | null);
    constructor(arg0: number | Pix32 | null, cropH?: number, xOffset?: number, yOffset?: number, width?: number, height?: number, pixels?: Int32Array | null) {
        if (typeof arg0 === 'number') {
            // el.<init>(IIIIII[I)V
            super(arg0, requireNonNull(cropH), requireNonNull(xOffset), requireNonNull(yOffset), requireNonNull(width), requireNonNull(height), pixels ?? null);
        } else {
            // el.<init>(Lmm;)V
            super(arg0);
        }
    }
}
