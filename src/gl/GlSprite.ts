import AbstractSprite from '#/graphics/AbstractSprite';
import type Pix32 from '#/graphics/Pix32';
import { GL } from '#/jogl/GL';
import { bitCeil, doubleToInt, intDivide } from '#/util/IntUtils';
import { arrayAtI32, arrayPutI8, requireNonNull } from '#/util/JavaArray';
import ByteBuffer from '#/util/nio/ByteBuffer';
import GlCleaner from './GlCleaner';
import GlRaster from './GlRaster';
import GlRenderer from './GlRenderer';

// cf in runescape_gl.jar (HD only): the GL sprite, the HD subclass of the abstract sprite (qf, AbstractSprite) beside
// the software Pix32 (mm). The constructors upload the pixels as an RGBA texture padded to power-of-two sides
// (textureWidth, textureHeight), with pixel 0 transparent and every other pixel opaque, and compile a display list
// that draws the width x height quad from the origin downwards. Draws run in the 2D ortho projection with y flipped
// against the GL height (GlRenderer.height, tf.A): the plain draws translate and call the list (REPLACE combine,
// GlRenderer.begin2dReplace, tf.a()V), the alpha draws modulate a white colour with alpha/256
// (GlRenderer.begin2dModulate, tf.e()V), the scaled and the reversed rotated draws switch the texture to LINEAR
// filtering, and the masked draws put a second sprite on texture unit 1 as a REPLACE-of-PREVIOUS stage whose
// coordinates run against the GlRaster clip origin. The sprite loaders, the widget code and the minimap build one in
// place of a Pix32 when GL is active (`tf.w ? new cf(...) : new mm(...)`). finalize() hands the texture to
// GlCleaner.deleteTexture2d (fa.c(III)V) and the list to GlCleaner.deleteList (fa.a(II)V). NXT has no GL 1.x
// classes, so the names are descriptive (HD_PLAN.md 1.3); the draw names follow AbstractSprite's and Pix32's.
//
// Java runs finalize() on the unreachable object itself. A FinalizationRegistry callback never sees the collected
// object, so the four fields finalize() reads (cf.L, cf.Z, cf.ab, cf.db) live in a record that the registry holds,
// behind accessors that keep the Java field roles; the callback runs finalize() on a stand-in sharing that record.
interface GlSpriteFields {
    size: number;
    list: number;
    texture: number;
    generation: number;
}

const finalizer = new FinalizationRegistry<GlSpriteFields>(fields => GlSprite.finalizeCollected(fields));

export default class GlSprite extends AbstractSprite {
    // cf.<init> runs the field initializers L = 0, ab = -1, Z = -1, bb = 0, in that order.
    private readonly fields: GlSpriteFields = { size: 0, list: -1, texture: -1, generation: 0 };
    textureWidth = 0; // cf.O:I (bitCeil(width))
    private filter = 0; // cf.bb:I (the filter last set on the texture: 2 LINEAR, otherwise NEAREST; 0 none yet)
    textureHeight = 0; // cf.cb:I (bitCeil(height))

    // cf.L:I (bytes uploaded, counted in GlCleaner.memory2d)
    get size(): number {
        return this.fields.size;
    }

    set size(value: number) {
        this.fields.size = value;
    }

    // cf.Z:I (the display list; -1 once finalized)
    private get list(): number {
        return this.fields.list;
    }

    private set list(value: number) {
        this.fields.list = value;
    }

    // cf.ab:I (the texture name; -1 before the first upload and once finalized)
    get texture(): number {
        return this.fields.texture;
    }

    set texture(value: number) {
        this.fields.texture = value;
    }

    // cf.db:I (GlCleaner.generation when the texture or the list was created)
    private get generation(): number {
        return this.fields.generation;
    }

    private set generation(value: number) {
        this.fields.generation = value;
    }

    // cf.d(I)V
    private setFilter(filter: number): void {
        if (this.filter === filter) {
            return;
        }
        this.filter = filter;
        const gl = GlRenderer.gl;
        if (filter === 2) {
            requireNonNull(gl).glTexParameteri(GL.GL_TEXTURE_2D, GL.GL_TEXTURE_MIN_FILTER, GL.GL_LINEAR);
            requireNonNull(gl).glTexParameteri(GL.GL_TEXTURE_2D, GL.GL_TEXTURE_MAG_FILTER, GL.GL_LINEAR);
        } else {
            requireNonNull(gl).glTexParameteri(GL.GL_TEXTURE_2D, GL.GL_TEXTURE_MIN_FILTER, GL.GL_NEAREST);
            requireNonNull(gl).glTexParameteri(GL.GL_TEXTURE_2D, GL.GL_TEXTURE_MAG_FILTER, GL.GL_NEAREST);
        }
    }

    // cf.a(IILcf;)V. Draws at (x, y) through `mask` on texture unit 1, whose texels cover the clip area from the
    // GlRaster clip origin; the unit is restored to MODULATE of TEXTURE and disabled afterwards.
    drawMasked(x: number, y: number, mask: GlSprite | null): void {
        if (mask === null) {
            return;
        }
        GlRenderer.begin2dReplace();
        GlRenderer.bindTexture2D(mask.texture);
        mask.setFilter(1);
        const gl = GlRenderer.gl;
        GlRenderer.bindTexture2D(this.texture);
        this.setFilter(1);
        requireNonNull(gl).glActiveTexture(GL.GL_TEXTURE1);
        requireNonNull(gl).glEnable(GL.GL_TEXTURE_2D);
        requireNonNull(gl).glBindTexture(GL.GL_TEXTURE_2D, mask.texture);
        requireNonNull(gl).glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_COMBINE_RGB, GL.GL_REPLACE);
        requireNonNull(gl).glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_SOURCE0_RGB, GL.GL_PREVIOUS);
        const maskLeft = Math.fround(Math.fround((x - GlRaster.clipMinX) | 0) / Math.fround(mask.textureWidth));
        const maskTop = Math.fround(Math.fround((y - GlRaster.clipMinY) | 0) / Math.fround(mask.textureHeight));
        const maskRight = Math.fround(Math.fround((x + this.width - GlRaster.clipMinX) | 0) / Math.fround(mask.textureWidth));
        const maskBottom = Math.fround(Math.fround((y + this.height - GlRaster.clipMinY) | 0) / Math.fround(mask.textureHeight));
        x = (x + this.xOffset) | 0;
        y = (y + this.yOffset) | 0;
        requireNonNull(gl).glBegin(GL.GL_TRIANGLE_FAN);
        requireNonNull(gl).glColor4f(1.0, 1.0, 1.0, 1.0);
        const right = Math.fround(Math.fround(this.width) / Math.fround(this.textureWidth));
        const bottom = Math.fround(Math.fround(this.height) / Math.fround(this.textureHeight));
        requireNonNull(gl).glMultiTexCoord2f(GL.GL_TEXTURE1, maskRight, maskTop);
        requireNonNull(gl).glTexCoord2f(right, 0.0);
        requireNonNull(gl).glVertex2f(Math.fround((x + this.width) | 0), Math.fround((GlRenderer.height - y) | 0));
        requireNonNull(gl).glMultiTexCoord2f(GL.GL_TEXTURE1, maskLeft, maskTop);
        requireNonNull(gl).glTexCoord2f(0.0, 0.0);
        requireNonNull(gl).glVertex2f(Math.fround(x), Math.fround((GlRenderer.height - y) | 0));
        requireNonNull(gl).glMultiTexCoord2f(GL.GL_TEXTURE1, maskLeft, maskBottom);
        requireNonNull(gl).glTexCoord2f(0.0, bottom);
        requireNonNull(gl).glVertex2f(Math.fround(x), Math.fround((GlRenderer.height - ((y + this.height) | 0)) | 0));
        requireNonNull(gl).glMultiTexCoord2f(GL.GL_TEXTURE1, maskRight, maskBottom);
        requireNonNull(gl).glTexCoord2f(right, bottom);
        requireNonNull(gl).glVertex2f(Math.fround((x + this.width) | 0), Math.fround((GlRenderer.height - ((y + this.height) | 0)) | 0));
        requireNonNull(gl).glEnd();
        requireNonNull(gl).glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_COMBINE_RGB, GL.GL_MODULATE);
        requireNonNull(gl).glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_SOURCE0_RGB, GL.GL_TEXTURE);
        requireNonNull(gl).glDisable(GL.GL_TEXTURE_2D);
        requireNonNull(gl).glActiveTexture(GL.GL_TEXTURE0);
    }

    // cf.c(IIIII)V. The quad repeats the texture repeatX x repeatY times (texture coordinates past 1 wrap with the
    // default REPEAT wrap mode), modulated by alpha/256.
    drawTiledAlpha(x: number, y: number, alpha: number, repeatX: number, repeatY: number): void {
        GlRenderer.begin2dModulate();
        const gl = GlRenderer.gl;
        GlRenderer.bindTexture2D(this.texture);
        this.setFilter(1);
        let right = Math.fround(Math.fround(this.width) / Math.fround(this.textureWidth));
        let bottom = Math.fround(Math.fround(this.height) / Math.fround(this.textureHeight));
        right = Math.fround(right * Math.fround(repeatX));
        bottom = Math.fround(bottom * Math.fround(repeatY));
        const x0 = (x + this.xOffset) | 0;
        const x1 = (x0 + Math.imul(this.width, repeatX)) | 0;
        const y0 = (GlRenderer.height - y - this.yOffset) | 0;
        const y1 = (y0 - Math.imul(this.height, repeatY)) | 0;
        const alphaScale = Math.fround(Math.fround(alpha) / 256.0);
        requireNonNull(gl).glBegin(GL.GL_TRIANGLE_FAN);
        requireNonNull(gl).glColor4f(1.0, 1.0, 1.0, alphaScale);
        requireNonNull(gl).glTexCoord2f(right, 0.0);
        requireNonNull(gl).glVertex2f(Math.fround(x1), Math.fround(y0));
        requireNonNull(gl).glTexCoord2f(0.0, 0.0);
        requireNonNull(gl).glVertex2f(Math.fround(x0), Math.fround(y0));
        requireNonNull(gl).glTexCoord2f(0.0, bottom);
        requireNonNull(gl).glVertex2f(Math.fround(x0), Math.fround(y1));
        requireNonNull(gl).glTexCoord2f(right, bottom);
        requireNonNull(gl).glVertex2f(Math.fround(x1), Math.fround(y1));
        requireNonNull(gl).glEnd();
    }

    // cf.a(IIIIIIIILcf;)V. The rotated and zoomed view of this sprite around (anchorX, anchorY) fills the
    // width x height box at (x, y), cut by `mask` on texture unit 1 (the minimap). Each corner's texture coordinate is
    // 16.16 fixed point from the sine and cosine of angle/326.11 radians (2048 units per turn) times zoom/256.
    drawRotatedMasked(x: number, y: number, width: number, height: number, anchorX: number, anchorY: number, angle: number, zoom: number, mask: GlSprite | null): void {
        if (mask === null) {
            return;
        }
        GlRenderer.begin2dReplace();
        GlRenderer.bindTexture2D(mask.texture);
        mask.setFilter(1);
        const gl = GlRenderer.gl;
        GlRenderer.bindTexture2D(this.texture);
        this.setFilter(1);
        requireNonNull(gl).glActiveTexture(GL.GL_TEXTURE1);
        requireNonNull(gl).glEnable(GL.GL_TEXTURE_2D);
        requireNonNull(gl).glBindTexture(GL.GL_TEXTURE_2D, mask.texture);
        requireNonNull(gl).glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_COMBINE_RGB, GL.GL_REPLACE);
        requireNonNull(gl).glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_SOURCE0_RGB, GL.GL_PREVIOUS);
        const left = intDivide(-width | 0, 2);
        const top = intDivide(-height | 0, 2);
        const right = -left | 0;
        const bottom = -top | 0;
        let sin = doubleToInt(Math.sin(angle / 326.11) * 65536.0);
        let cos = doubleToInt(Math.cos(angle / 326.11) * 65536.0);
        sin = Math.imul(sin, zoom) >> 8;
        cos = Math.imul(cos, zoom) >> 8;
        const topLeftX = ((anchorX << 16) + ((Math.imul(top, sin) + Math.imul(left, cos)) | 0)) | 0;
        const topLeftY = ((anchorY << 16) + ((Math.imul(top, cos) - Math.imul(left, sin)) | 0)) | 0;
        const topRightX = ((anchorX << 16) + ((Math.imul(top, sin) + Math.imul(right, cos)) | 0)) | 0;
        const topRightY = ((anchorY << 16) + ((Math.imul(top, cos) - Math.imul(right, sin)) | 0)) | 0;
        const bottomLeftX = ((anchorX << 16) + ((Math.imul(bottom, sin) + Math.imul(left, cos)) | 0)) | 0;
        const bottomLeftY = ((anchorY << 16) + ((Math.imul(bottom, cos) - Math.imul(left, sin)) | 0)) | 0;
        const bottomRightX = ((anchorX << 16) + ((Math.imul(bottom, sin) + Math.imul(right, cos)) | 0)) | 0;
        const bottomRightY = ((anchorY << 16) + ((Math.imul(bottom, cos) - Math.imul(right, sin)) | 0)) | 0;
        const maskRight = Math.fround(Math.fround(mask.width) / Math.fround(mask.textureWidth));
        const maskBottom = Math.fround(Math.fround(mask.height) / Math.fround(mask.textureHeight));
        requireNonNull(gl).glBegin(GL.GL_TRIANGLE_FAN);
        requireNonNull(gl).glColor4f(1.0, 1.0, 1.0, 1.0);
        const scaleU = Math.fround(65536.0 * Math.fround(this.textureWidth));
        const scaleV = Math.fround(Math.imul(65536, this.textureHeight));
        requireNonNull(gl).glMultiTexCoord2f(GL.GL_TEXTURE1, maskRight, 0.0);
        requireNonNull(gl).glTexCoord2f(Math.fround(Math.fround(topRightX) / scaleU), Math.fround(Math.fround(topRightY) / scaleV));
        requireNonNull(gl).glVertex2f(Math.fround((x + width) | 0), Math.fround((GlRenderer.height - y) | 0));
        requireNonNull(gl).glMultiTexCoord2f(GL.GL_TEXTURE1, 0.0, 0.0);
        requireNonNull(gl).glTexCoord2f(Math.fround(Math.fround(topLeftX) / scaleU), Math.fround(Math.fround(topLeftY) / scaleV));
        requireNonNull(gl).glVertex2f(Math.fround(x), Math.fround((GlRenderer.height - y) | 0));
        requireNonNull(gl).glMultiTexCoord2f(GL.GL_TEXTURE1, 0.0, maskBottom);
        requireNonNull(gl).glTexCoord2f(Math.fround(Math.fround(bottomLeftX) / scaleU), Math.fround(Math.fround(bottomLeftY) / scaleV));
        requireNonNull(gl).glVertex2f(Math.fround(x), Math.fround((GlRenderer.height - ((y + height) | 0)) | 0));
        requireNonNull(gl).glMultiTexCoord2f(GL.GL_TEXTURE1, maskRight, maskBottom);
        requireNonNull(gl).glTexCoord2f(Math.fround(Math.fround(bottomRightX) / scaleU), Math.fround(Math.fround(bottomRightY) / scaleV));
        requireNonNull(gl).glVertex2f(Math.fround((x + width) | 0), Math.fround((GlRenderer.height - ((y + height) | 0)) | 0));
        requireNonNull(gl).glEnd();
        requireNonNull(gl).glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_COMBINE_RGB, GL.GL_MODULATE);
        requireNonNull(gl).glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_SOURCE0_RGB, GL.GL_TEXTURE);
        requireNonNull(gl).glDisable(GL.GL_TEXTURE_2D);
        requireNonNull(gl).glActiveTexture(GL.GL_TEXTURE0);
    }

    // SD vc.b(II)V / HD cf.d(II)V. The quad with the texture coordinates mirrored left to right.
    override drawHFlip(x: number, y: number): void {
        GlRenderer.begin2dReplace();
        x = (x + this.xOffset) | 0;
        y = (y + this.yOffset) | 0;
        const gl = GlRenderer.gl;
        GlRenderer.bindTexture2D(this.texture);
        this.setFilter(1);
        requireNonNull(gl).glTranslatef(Math.fround(x), Math.fround((GlRenderer.height - y) | 0), 0.0);
        const right = Math.fround(Math.fround(this.width) / Math.fround(this.textureWidth));
        const bottom = Math.fround(Math.fround(this.height) / Math.fround(this.textureHeight));
        requireNonNull(gl).glBegin(GL.GL_TRIANGLE_FAN);
        requireNonNull(gl).glTexCoord2f(0.0, 0.0);
        requireNonNull(gl).glVertex2f(Math.fround(this.width), 0.0);
        requireNonNull(gl).glTexCoord2f(right, 0.0);
        requireNonNull(gl).glVertex2f(0.0, 0.0);
        requireNonNull(gl).glTexCoord2f(right, bottom);
        requireNonNull(gl).glVertex2f(0.0, Math.fround(-this.height | 0));
        requireNonNull(gl).glTexCoord2f(0.0, bottom);
        requireNonNull(gl).glVertex2f(Math.fround(this.width), Math.fround(-this.height | 0));
        requireNonNull(gl).glEnd();
        requireNonNull(gl).glLoadIdentity();
    }

    // SD vc.c(II)V / HD cf.e(II)V
    override draw(x: number, y: number): void {
        GlRenderer.begin2dReplace();
        x = (x + this.xOffset) | 0;
        y = (y + this.yOffset) | 0;
        const gl = GlRenderer.gl;
        GlRenderer.bindTexture2D(this.texture);
        this.setFilter(1);
        requireNonNull(gl).glTranslatef(Math.fround(x), Math.fround((GlRenderer.height - y) | 0), 0.0);
        requireNonNull(gl).glCallList(this.list);
        requireNonNull(gl).glLoadIdentity();
    }

    // cf.b(IIIIII)V. drawRotated with the angle running the other way and LINEAR filtering (the minimap's flag and
    // arrow markers, hi.a, where the SD client calls Pix32.drawRotatedRadians).
    drawRotatedReversed(anchorX: number, anchorY: number, x: number, y: number, angle: number, scale: number): void {
        GlRenderer.begin2dReplace();
        const gl = GlRenderer.gl;
        GlRenderer.bindTexture2D(this.texture);
        this.setFilter(2);
        anchorX = (anchorX - (this.xOffset << 4)) | 0;
        anchorY = (anchorY - (this.yOffset << 4)) | 0;
        requireNonNull(gl).glTranslatef(Math.fround(Math.fround(x) / 16.0), Math.fround(Math.fround(GlRenderer.height) - Math.fround(Math.fround(y) / 16.0)), 0.0);
        requireNonNull(gl).glRotatef(Math.fround(Math.fround(-angle | 0) * Math.fround(0.005493164)), 0.0, 0.0, 1.0);
        if (scale !== 4096) {
            requireNonNull(gl).glScalef(Math.fround(Math.fround(scale) / 4096.0), Math.fround(Math.fround(scale) / 4096.0), 0.0);
        }
        requireNonNull(gl).glTranslatef(Math.fround(Math.fround(-anchorX | 0) / 16.0), Math.fround(Math.fround(anchorY) / 16.0), 0.0);
        requireNonNull(gl).glCallList(this.list);
        requireNonNull(gl).glLoadIdentity();
    }

    // SD vc.a(IIII)V / HD cf.a(IIII)V. Scales the crop box (cropW x cropH) to width x height at (x, y), LINEAR
    // filtered; the offsets and the trimmed edges are stepped in 16.16 fixed point as Pix32.drawScaled does.
    override drawScaled(x: number, y: number, width: number, height: number): void {
        let step: number;
        if (width <= 0 || height <= 0) {
            return;
        }
        GlRenderer.begin2dReplace();
        const spriteWidth = this.width;
        const spriteHeight = this.height;
        let offsetX = 0;
        let offsetY = 0;
        const cropW = this.cropW;
        const cropH = this.cropH;
        const stepX = intDivide(cropW << 16, width);
        const stepY = intDivide(cropH << 16, height);
        if (this.xOffset > 0) {
            step = intDivide(((this.xOffset << 16) + stepX - 1) | 0, stepX);
            x = (x + step) | 0;
            offsetX = (offsetX + (Math.imul(step, stepX) - (this.xOffset << 16))) | 0;
        }
        if (this.yOffset > 0) {
            step = intDivide(((this.yOffset << 16) + stepY - 1) | 0, stepY);
            y = (y + step) | 0;
            offsetY = (offsetY + (Math.imul(step, stepY) - (this.yOffset << 16))) | 0;
        }
        if (spriteWidth < cropW) {
            width = intDivide(((spriteWidth << 16) - offsetX + stepX - 1) | 0, stepX);
        }
        if (spriteHeight < cropH) {
            height = intDivide(((spriteHeight << 16) - offsetY + stepY - 1) | 0, stepY);
        }
        const gl = GlRenderer.gl;
        GlRenderer.bindTexture2D(this.texture);
        this.setFilter(2);
        const x0 = Math.fround(x);
        const x1 = Math.fround(x0 + Math.fround(width));
        const y0 = Math.fround((GlRenderer.height - y) | 0);
        const y1 = Math.fround(y0 - Math.fround(height));
        const right = Math.fround(Math.fround(this.width) / Math.fround(this.textureWidth));
        const bottom = Math.fround(Math.fround(this.height) / Math.fround(this.textureHeight));
        requireNonNull(gl).glBegin(GL.GL_TRIANGLE_FAN);
        requireNonNull(gl).glTexCoord2f(right, 0.0);
        requireNonNull(gl).glVertex2f(x1, y0);
        requireNonNull(gl).glTexCoord2f(0.0, 0.0);
        requireNonNull(gl).glVertex2f(x0, y0);
        requireNonNull(gl).glTexCoord2f(0.0, bottom);
        requireNonNull(gl).glVertex2f(x0, y1);
        requireNonNull(gl).glTexCoord2f(right, bottom);
        requireNonNull(gl).glVertex2f(x1, y1);
        requireNonNull(gl).glEnd();
    }

    // SD vc.a(II)V / HD cf.c(II)V. With no blending distinction in GL this draws exactly as draw does.
    override drawOpaque(x: number, y: number): void {
        GlRenderer.begin2dReplace();
        x = (x + this.xOffset) | 0;
        y = (y + this.yOffset) | 0;
        const gl = GlRenderer.gl;
        GlRenderer.bindTexture2D(this.texture);
        this.setFilter(1);
        requireNonNull(gl).glTranslatef(Math.fround(x), Math.fround((GlRenderer.height - y) | 0), 0.0);
        requireNonNull(gl).glCallList(this.list);
        requireNonNull(gl).glLoadIdentity();
    }

    // cf.finalize()V
    protected finalize(): void {
        if (this.texture !== -1) {
            GlCleaner.deleteTexture2d(this.texture, this.size, this.generation);
            this.texture = -1;
            this.size = 0;
        }
        if (this.list !== -1) {
            GlCleaner.deleteList(this.list, this.generation);
            this.list = -1;
        }
        // super.finalize(): qf, rg, ab and Object declare no finalizer of their own, so this is Object.finalize().
    }

    // The registry's callback (no Java counterpart): runs finalize() for a collected sprite.
    static finalizeCollected(fields: GlSpriteFields): void {
        const collected = Object.create(GlSprite.prototype) as GlSprite;
        Object.defineProperty(collected, 'fields', { value: fields });
        collected.finalize();
    }

    // SD vc.a(IIIIII)V / HD cf.a(IIIIII)V. Rotates by angle (65536 units per turn, 0.005493164 degrees each) and
    // scales by scale/4096 around (x, y), both in 1/16 px; the anchor is in 1/16 px of the crop box.
    override drawRotated(anchorX: number, anchorY: number, x: number, y: number, angle: number, scale: number): void {
        GlRenderer.begin2dReplace();
        const gl = GlRenderer.gl;
        GlRenderer.bindTexture2D(this.texture);
        this.setFilter(1);
        anchorX = (anchorX - (this.xOffset << 4)) | 0;
        anchorY = (anchorY - (this.yOffset << 4)) | 0;
        requireNonNull(gl).glTranslatef(Math.fround(Math.fround(x) / 16.0), Math.fround(Math.fround(GlRenderer.height) - Math.fround(Math.fround(y) / 16.0)), 0.0);
        requireNonNull(gl).glRotatef(Math.fround(Math.fround(angle) * Math.fround(0.005493164)), 0.0, 0.0, 1.0);
        if (scale !== 4096) {
            requireNonNull(gl).glScalef(Math.fround(Math.fround(scale) / 4096.0), Math.fround(Math.fround(scale) / 4096.0), 0.0);
        }
        requireNonNull(gl).glTranslatef(Math.fround(Math.fround(-anchorX | 0) / 16.0), Math.fround(Math.fround(anchorY) / 16.0), 0.0);
        requireNonNull(gl).glCallList(this.list);
        requireNonNull(gl).glLoadIdentity();
    }

    // SD vc.a(IIIII)V / HD cf.b(IIIII)V. drawScaled modulated by alpha/256, NEAREST filtered.
    override drawScaledAlpha(x: number, y: number, width: number, height: number, alpha: number): void {
        let step: number;
        if (width <= 0 || height <= 0) {
            return;
        }
        GlRenderer.begin2dModulate();
        const spriteWidth = this.width;
        const spriteHeight = this.height;
        let offsetX = 0;
        let offsetY = 0;
        const cropW = this.cropW;
        const cropH = this.cropH;
        const stepX = intDivide(cropW << 16, width);
        const stepY = intDivide(cropH << 16, height);
        if (this.xOffset > 0) {
            step = intDivide(((this.xOffset << 16) + stepX - 1) | 0, stepX);
            x = (x + step) | 0;
            offsetX = (offsetX + (Math.imul(step, stepX) - (this.xOffset << 16))) | 0;
        }
        if (this.yOffset > 0) {
            step = intDivide(((this.yOffset << 16) + stepY - 1) | 0, stepY);
            y = (y + step) | 0;
            offsetY = (offsetY + (Math.imul(step, stepY) - (this.yOffset << 16))) | 0;
        }
        if (spriteWidth < cropW) {
            width = intDivide(((spriteWidth << 16) - offsetX + stepX - 1) | 0, stepX);
        }
        if (spriteHeight < cropH) {
            height = intDivide(((spriteHeight << 16) - offsetY + stepY - 1) | 0, stepY);
        }
        const gl = GlRenderer.gl;
        GlRenderer.bindTexture2D(this.texture);
        this.setFilter(1);
        const x0 = Math.fround(x);
        const x1 = Math.fround(x0 + Math.fround(width));
        const y0 = Math.fround((GlRenderer.height - y) | 0);
        const y1 = Math.fround(y0 - Math.fround(height));
        const right = Math.fround(Math.fround(this.width) / Math.fround(this.textureWidth));
        const bottom = Math.fround(Math.fround(this.height) / Math.fround(this.textureHeight));
        const alphaScale = Math.fround(Math.fround(alpha) / 256.0);
        requireNonNull(gl).glBegin(GL.GL_TRIANGLE_FAN);
        requireNonNull(gl).glColor4f(1.0, 1.0, 1.0, alphaScale);
        requireNonNull(gl).glTexCoord2f(right, 0.0);
        requireNonNull(gl).glVertex2f(x1, y0);
        requireNonNull(gl).glTexCoord2f(0.0, 0.0);
        requireNonNull(gl).glVertex2f(x0, y0);
        requireNonNull(gl).glTexCoord2f(0.0, bottom);
        requireNonNull(gl).glVertex2f(x0, y1);
        requireNonNull(gl).glTexCoord2f(right, bottom);
        requireNonNull(gl).glVertex2f(x1, y1);
        requireNonNull(gl).glEnd();
    }

    // cf.b(IIII)V. The quad repeats the texture repeatX x repeatY times (type-5 widget tiling, gn.a).
    drawTiled(x: number, y: number, repeatX: number, repeatY: number): void {
        GlRenderer.begin2dReplace();
        const gl = GlRenderer.gl;
        GlRenderer.bindTexture2D(this.texture);
        this.setFilter(1);
        let right = Math.fround(Math.fround(this.width) / Math.fround(this.textureWidth));
        let bottom = Math.fround(Math.fround(this.height) / Math.fround(this.textureHeight));
        right = Math.fround(right * Math.fround(repeatX));
        bottom = Math.fround(bottom * Math.fround(repeatY));
        const x0 = (x + this.xOffset) | 0;
        const x1 = (x0 + Math.imul(this.width, repeatX)) | 0;
        const y0 = (GlRenderer.height - y - this.yOffset) | 0;
        const y1 = (y0 - Math.imul(this.height, repeatY)) | 0;
        requireNonNull(gl).glBegin(GL.GL_TRIANGLE_FAN);
        requireNonNull(gl).glTexCoord2f(right, 0.0);
        requireNonNull(gl).glVertex2f(Math.fround(x1), Math.fround(y0));
        requireNonNull(gl).glTexCoord2f(0.0, 0.0);
        requireNonNull(gl).glVertex2f(Math.fround(x0), Math.fround(y0));
        requireNonNull(gl).glTexCoord2f(0.0, bottom);
        requireNonNull(gl).glVertex2f(Math.fround(x0), Math.fround(y1));
        requireNonNull(gl).glTexCoord2f(right, bottom);
        requireNonNull(gl).glVertex2f(Math.fround(x1), Math.fround(y1));
        requireNonNull(gl).glEnd();
    }

    // cf.a([I)V. Uploads `pixels` (width x height ARGB) into the top-left corner of a textureWidth x textureHeight
    // RGBA texture: a non-zero pixel becomes R, G, B, 255 and pixel 0 stays transparent black. The texture name is
    // generated on the first upload.
    upload(pixels: Int32Array | null): void {
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
                    arrayPutI8(bytes, dst++, -1);
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
            this.generation = GlCleaner.generation;
        }
        GlRenderer.bindTexture2D(this.texture);
        requireNonNull(gl).glTexImage2D(GL.GL_TEXTURE_2D, 0, GL.GL_RGBA, this.textureWidth, this.textureHeight, 0, GL.GL_RGBA, GL.GL_UNSIGNED_BYTE, buffer);
        GlCleaner.memory2d = (GlCleaner.memory2d + (buffer.limit() - this.size)) | 0;
        this.size = buffer.limit();
    }

    // SD vc.a(III)V / HD cf.a(III)V
    override drawAlpha(x: number, y: number, alpha: number): void {
        GlRenderer.begin2dModulate();
        x = (x + this.xOffset) | 0;
        y = (y + this.yOffset) | 0;
        const gl = GlRenderer.gl;
        GlRenderer.bindTexture2D(this.texture);
        this.setFilter(1);
        requireNonNull(gl).glColor4f(1.0, 1.0, 1.0, Math.fround(Math.fround(alpha) / 256.0));
        requireNonNull(gl).glTranslatef(Math.fround(x), Math.fround((GlRenderer.height - y) | 0), 0.0);
        requireNonNull(gl).glCallList(this.list);
        requireNonNull(gl).glLoadIdentity();
    }

    // cf.a()V. Compiles the quad: width x height px from the origin downwards (y up in GL), texture coordinates up to
    // the sprite's share of the padded texture. The list name is generated on the first call.
    private createList(): void {
        const right = Math.fround(Math.fround(this.width) / Math.fround(this.textureWidth));
        const bottom = Math.fround(Math.fround(this.height) / Math.fround(this.textureHeight));
        const gl = GlRenderer.gl;
        if (this.list === -1) {
            this.list = requireNonNull(gl).glGenLists(1);
            this.generation = GlCleaner.generation;
        }
        requireNonNull(gl).glNewList(this.list, GL.GL_COMPILE);
        requireNonNull(gl).glBegin(GL.GL_TRIANGLE_FAN);
        requireNonNull(gl).glTexCoord2f(right, 0.0);
        requireNonNull(gl).glVertex2f(Math.fround(this.width), 0.0);
        requireNonNull(gl).glTexCoord2f(0.0, 0.0);
        requireNonNull(gl).glVertex2f(0.0, 0.0);
        requireNonNull(gl).glTexCoord2f(0.0, bottom);
        requireNonNull(gl).glVertex2f(0.0, Math.fround(-this.height | 0));
        requireNonNull(gl).glTexCoord2f(right, bottom);
        requireNonNull(gl).glVertex2f(Math.fround(this.width), Math.fround(-this.height | 0));
        requireNonNull(gl).glEnd();
        requireNonNull(gl).glEndList();
    }

    // cf.<init>(IIIIII[I)V
    constructor(cropW: number, cropH: number, xOffset: number, yOffset: number, width: number, height: number, pixels: Int32Array | null);
    // cf.<init>(Lmm;)V
    constructor(sprite: Pix32 | null);
    constructor(arg0: number | Pix32 | null, cropH?: number, xOffset?: number, yOffset?: number, width?: number, height?: number, pixels?: Int32Array | null) {
        super();
        // The JVM registers a finalizable object when Object.<init> returns, so finalize() also runs for an object whose
        // constructor threw; it then sees the field initializers' -1 names unless a name was already generated.
        finalizer.register(this, this.fields);
        if (typeof arg0 === 'number') {
            // cf.<init>(IIIIII[I)V
            this.cropW = arg0;
            this.cropH = requireNonNull(cropH);
            this.xOffset = requireNonNull(xOffset);
            this.yOffset = requireNonNull(yOffset);
            this.width = requireNonNull(width);
            this.height = requireNonNull(height);
            this.upload(pixels ?? null);
            this.createList();
        } else {
            // cf.<init>(Lmm;)V
            const sprite = requireNonNull(arg0);
            this.cropW = sprite.cropW;
            this.cropH = sprite.cropH;
            this.xOffset = sprite.xOffset;
            this.yOffset = sprite.yOffset;
            this.width = sprite.width;
            this.height = sprite.height;
            this.upload(sprite.pixels);
            this.createList();
        }
    }
}
