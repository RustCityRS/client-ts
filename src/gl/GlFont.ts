import { byteAt } from '#/io/JavaByteArray';
import { GL } from '#/jogl/GL';
import PixfontGeneric from '#/graphics/PixfontGeneric';
import { bitCeil } from '#/util/IntUtils';
import { arrayAtI32, arrayAtObj, arrayPutI32, arrayPutI8, requireNonNull } from '#/util/JavaArray';
import ByteBuffer from '#/util/nio/ByteBuffer';
import GlCleaner from './GlCleaner';
import GlRaster from './GlRaster';
import GlRenderer from './GlRenderer';

// mb in runescape_gl.jar (HD only): the GL font, built in place of the software font (dd) by ce.a(I[B)Lrk; while
// tf.w is set. The constructor packs the 256 glyph masks into one LUMINANCE_ALPHA texture, a 16x16 grid of square
// cells whose side is a sixteenth of the atlas (the atlas side is the power of two at or above 16 times the largest
// glyph width or height), with every set mask texel opaque white, and compiles one display list per glyph. A glyph
// draw sets the colour, translates to the glyph's top-left corner in tf's 2D ortho space and calls the glyph's list;
// while GlRaster has a mask sprite (dj.a, the minimap's round mask) it draws the quad in immediate mode instead,
// with the mask on texture unit 1 replacing the colour from the previous unit's result. NXT has no GL 1.x classes,
// so the names are descriptive (HD_PLAN.md 1.3).
//
// Java runs finalize() on the unreachable object itself. A FinalizationRegistry callback never sees the collected
// object, so the four fields finalize() reads (mb.Eb, mb.Fb, mb.Gb, mb.Hb) live in a record that the registry holds,
// behind accessors that keep the Java field roles; the callback runs finalize() on a stand-in sharing that record.
interface GlFontFields {
    size: number;
    texture: number;
    lists: Int32Array | null;
    generation: number;
}

const finalizer = new FinalizationRegistry<GlFontFields>(fields => GlFont.finalizeCollected(fields));

export default class GlFont extends PixfontGeneric {
    // No field of mb has a TS initializer: the JVM registers the object as finalizable when Object.<init> returns, so
    // a throw in rk.<init> reaches finalize() before mb's field initializers ran, and the constructor needs the super
    // call inside a try for that (TS only allows that without property initializers).
    private readonly fields: GlFontFields;

    // mb.Eb:I (bytes uploaded)
    private get size(): number {
        return this.fields.size;
    }

    private set size(value: number) {
        this.fields.size = value;
    }

    // mb.Fb:I (the atlas texture name; -1 once finalized)
    private get texture(): number {
        return this.fields.texture;
    }

    private set texture(value: number) {
        this.fields.texture = value;
    }

    // mb.Gb:[I (the 256 glyph display lists; null once finalized)
    private get lists(): Int32Array | null {
        return this.fields.lists;
    }

    private set lists(value: Int32Array | null) {
        this.fields.lists = value;
    }

    // mb.Hb:I (GlCleaner.generation when the atlas or the lists were created)
    private get generation(): number {
        return this.fields.generation;
    }

    private set generation(value: number) {
        this.fields.generation = value;
    }

    // mb.Ib:I (the atlas side in texels)
    private atlasSize: number;

    // mb.<init>([B[I[I[I[I[[B)V
    constructor(data: Uint8Array | null, xOffsets: Int32Array | null, yOffsets: Int32Array | null, widths: Int32Array | null, heights: Int32Array | null, glyphMasks: (Uint8Array | null)[] | null) {
        // The fields at their JVM defaults, as finalize() sees them until mb's field initializers run.
        const fields: GlFontFields = { size: 0, texture: 0, lists: null, generation: 0 };
        try {
            super(data, xOffsets, yOffsets, widths, heights);
        } catch (error) {
            // The object is unreachable once rk.<init> throws; its finalizer still runs (and queues texture 0, since Fb
            // is not -1 yet). A fresh object that nothing references stands in for it in the registry.
            finalizer.register({}, fields);
            throw error;
        }
        this.fields = fields;
        this.atlasSize = 0;
        finalizer.register(this, fields);
        this.texture = -1;
        this.size = 0;
        this.uploadAtlas(glyphMasks);
        this.buildLists();
    }

    // mb.finalize()V
    protected finalize(): void {
        if (this.texture !== -1) {
            GlCleaner.deleteTexture2d(this.texture, this.size, this.generation);
            this.texture = -1;
            this.size = 0;
        }
        if (this.lists !== null) {
            for (let i = 0; i < requireNonNull(this.lists).length; i++) {
                GlCleaner.deleteList(arrayAtI32(this.lists, i), this.generation);
            }
            this.lists = null;
        }
        // super.finalize(): rk, rg and ab declare no finalizer of their own, so this is Object.finalize().
    }

    // The registry's callback (no Java counterpart): runs finalize() for a collected font.
    static finalizeCollected(fields: GlFontFields): void {
        const collected = Object.create(GlFont.prototype) as GlFont;
        Object.defineProperty(collected, 'fields', { value: fields });
        collected.finalize();
    }

    // SD mb.a(IIIIIIZ)V / HD rk.a(IIIIIIZ)V, implemented by HD mb.a(IIIIIIZ)V. `width`, `height` and `shadow` are read
    // only by the masked draw (the glyph's own size comes from rk.I and rk.U).
    override drawGlyph(c: number, x: number, y: number, width: number, height: number, colour: number, _shadow: boolean): void {
        if (GlRaster.mask !== null) {
            GlRenderer.begin2dFont();
            const gl = GlRenderer.gl;
            requireNonNull(gl).glColor3ub(((colour >> 16) << 24) >> 24, ((colour >> 8) << 24) >> 24, (colour << 24) >> 24);
            requireNonNull(gl).glTranslatef(Math.fround(x), Math.fround((GlRenderer.height - y) | 0), 0.0);
            const s0 = Math.fround(Math.fround(c % 16) / 16.0);
            const t0 = Math.fround(Math.fround((c / 16) | 0) / 16.0);
            const s1 = Math.fround(s0 + Math.fround(Math.fround(arrayAtI32(this.glyphWidths, c)) / Math.fround(this.atlasSize)));
            const t1 = Math.fround(t0 + Math.fround(Math.fround(arrayAtI32(this.glyphHeights, c)) / Math.fround(this.atlasSize)));
            GlRenderer.bindTexture2D(this.texture);
            const mask = requireNonNull(GlRaster.mask);
            requireNonNull(gl).glActiveTexture(GL.GL_TEXTURE1);
            requireNonNull(gl).glEnable(GL.GL_TEXTURE_2D);
            requireNonNull(gl).glBindTexture(GL.GL_TEXTURE_2D, mask.texture);
            requireNonNull(gl).glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_COMBINE_RGB, GL.GL_REPLACE);
            requireNonNull(gl).glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_SOURCE0_RGB, GL.GL_PREVIOUS);
            const maskS0 = Math.fround(Math.fround((x - GlRaster.clipMinX) | 0) / Math.fround(mask.textureWidth));
            const maskT0 = Math.fround(Math.fround((y - GlRaster.clipMinY) | 0) / Math.fround(mask.textureHeight));
            const maskS1 = Math.fround(Math.fround((x + width - GlRaster.clipMinX) | 0) / Math.fround(mask.textureWidth));
            const maskT1 = Math.fround(Math.fround((y + height - GlRaster.clipMinY) | 0) / Math.fround(mask.textureHeight));
            requireNonNull(gl).glBegin(GL.GL_TRIANGLE_FAN);
            requireNonNull(gl).glMultiTexCoord2f(GL.GL_TEXTURE1, maskS1, maskT0);
            requireNonNull(gl).glTexCoord2f(s1, t0);
            requireNonNull(gl).glVertex2f(Math.fround(arrayAtI32(this.glyphWidths, c)), 0.0);
            requireNonNull(gl).glMultiTexCoord2f(GL.GL_TEXTURE1, maskS0, maskT0);
            requireNonNull(gl).glTexCoord2f(s0, t0);
            requireNonNull(gl).glVertex2f(0.0, 0.0);
            requireNonNull(gl).glMultiTexCoord2f(GL.GL_TEXTURE1, maskS0, maskT1);
            requireNonNull(gl).glTexCoord2f(s0, t1);
            requireNonNull(gl).glVertex2f(0.0, Math.fround(-arrayAtI32(this.glyphHeights, c) | 0));
            requireNonNull(gl).glMultiTexCoord2f(GL.GL_TEXTURE1, maskS1, maskT1);
            requireNonNull(gl).glTexCoord2f(s1, t1);
            requireNonNull(gl).glVertex2f(Math.fround(arrayAtI32(this.glyphWidths, c)), Math.fround(-arrayAtI32(this.glyphHeights, c) | 0));
            requireNonNull(gl).glEnd();
            requireNonNull(gl).glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_COMBINE_RGB, GL.GL_MODULATE);
            requireNonNull(gl).glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_SOURCE0_RGB, GL.GL_TEXTURE);
            requireNonNull(gl).glDisable(GL.GL_TEXTURE_2D);
            requireNonNull(gl).glActiveTexture(GL.GL_TEXTURE0);
            requireNonNull(gl).glLoadIdentity();
        } else {
            GlRenderer.begin2dFont();
            const gl = GlRenderer.gl;
            GlRenderer.bindTexture2D(this.texture);
            requireNonNull(gl).glColor3ub(((colour >> 16) << 24) >> 24, ((colour >> 8) << 24) >> 24, (colour << 24) >> 24);
            requireNonNull(gl).glTranslatef(Math.fround(x), Math.fround((GlRenderer.height - y) | 0), 0.0);
            requireNonNull(gl).glCallList(arrayAtI32(this.lists, c));
            requireNonNull(gl).glLoadIdentity();
        }
    }

    // SD mb.a(IIIIIIIZ)V / HD rk.a(IIIIIIIZ)V, implemented by HD mb.a(IIIIIIIZ)V. No masked variant; an alpha above
    // 255 is sent as 255.
    override drawGlyphAlpha(c: number, x: number, y: number, _width: number, _height: number, colour: number, alpha: number, _shadow: boolean): void {
        GlRenderer.begin2dFont();
        const gl = GlRenderer.gl;
        GlRenderer.bindTexture2D(this.texture);
        requireNonNull(gl).glColor4ub(((colour >> 16) << 24) >> 24, ((colour >> 8) << 24) >> 24, (colour << 24) >> 24, alpha > 255 ? -1 : (alpha << 24) >> 24);
        requireNonNull(gl).glTranslatef(Math.fround(x), Math.fround((GlRenderer.height - y) | 0), 0.0);
        requireNonNull(gl).glCallList(arrayAtI32(this.lists, c));
        requireNonNull(gl).glLoadIdentity();
    }

    // mb.b()V. One TRIANGLE_FAN list per glyph: the quad from (0, 0) to (width, -height) over the glyph's atlas cell.
    private buildLists(): void {
        if (this.lists !== null) {
            return;
        }
        this.lists = new Int32Array(256);
        const gl = GlRenderer.gl;
        for (let i = 0; i < 256; i++) {
            const s0 = Math.fround(Math.fround(i % 16) / 16.0);
            const t0 = Math.fround(Math.fround((i / 16) | 0) / 16.0);
            const s1 = Math.fround(s0 + Math.fround(Math.fround(arrayAtI32(this.glyphWidths, i)) / Math.fround(this.atlasSize)));
            const t1 = Math.fround(t0 + Math.fround(Math.fround(arrayAtI32(this.glyphHeights, i)) / Math.fround(this.atlasSize)));
            arrayPutI32(this.lists, i, requireNonNull(gl).glGenLists(1));
            requireNonNull(gl).glNewList(arrayAtI32(this.lists, i), GL.GL_COMPILE);
            requireNonNull(gl).glBegin(GL.GL_TRIANGLE_FAN);
            requireNonNull(gl).glTexCoord2f(s1, t0);
            requireNonNull(gl).glVertex2f(Math.fround(arrayAtI32(this.glyphWidths, i)), 0.0);
            requireNonNull(gl).glTexCoord2f(s0, t0);
            requireNonNull(gl).glVertex2f(0.0, 0.0);
            requireNonNull(gl).glTexCoord2f(s0, t1);
            requireNonNull(gl).glVertex2f(0.0, Math.fround(-arrayAtI32(this.glyphHeights, i) | 0));
            requireNonNull(gl).glTexCoord2f(s1, t1);
            requireNonNull(gl).glVertex2f(Math.fround(arrayAtI32(this.glyphWidths, i)), Math.fround(-arrayAtI32(this.glyphHeights, i) | 0));
            requireNonNull(gl).glEnd();
            requireNonNull(gl).glEndList();
        }
        this.generation = GlCleaner.generation;
    }

    // mb.a([[B)V. Only the first call uploads (the texture name guards it). A glyph's rows start at its cell's top-left
    // texel; a set mask byte writes luminance and alpha 0xff, a clear one leaves both zero.
    private uploadAtlas(glyphMasks: (Uint8Array | null)[] | null): void {
        if (this.texture !== -1) {
            return;
        }
        this.atlasSize = 0;
        for (let i = 0; i < 256; i++) {
            if (arrayAtI32(this.glyphHeights, i) > this.atlasSize) {
                this.atlasSize = arrayAtI32(this.glyphHeights, i);
            }
            if (arrayAtI32(this.glyphWidths, i) > this.atlasSize) {
                this.atlasSize = arrayAtI32(this.glyphWidths, i);
            }
        }
        this.atlasSize = Math.imul(this.atlasSize, 16);
        this.atlasSize = bitCeil(this.atlasSize);
        const cell = (this.atlasSize / 16) | 0;
        const texels = new Int8Array(Math.imul(Math.imul(this.atlasSize, this.atlasSize), 2));
        for (let i = 0; i < 256; i++) {
            const cellX = Math.imul(i % 16, cell);
            const cellY = Math.imul((i / 16) | 0, cell);
            let dst = Math.imul((Math.imul(cellY, this.atlasSize) + cellX) | 0, 2);
            let src = 0;
            const height = arrayAtI32(this.glyphHeights, i);
            const width = arrayAtI32(this.glyphWidths, i);
            const mask = arrayAtObj(glyphMasks, i);
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    if (byteAt(mask, src++) !== 0) {
                        arrayPutI8(texels, dst++, -1);
                        arrayPutI8(texels, dst++, -1);
                        continue;
                    }
                    dst = (dst + 2) | 0;
                }
                dst = (dst + Math.imul((this.atlasSize - width) | 0, 2)) | 0;
            }
        }
        const buffer = ByteBuffer.wrap(texels);
        const gl = GlRenderer.gl;
        if (this.texture === -1) {
            const names = new Int32Array(1);
            requireNonNull(gl).glGenTextures(1, names, 0);
            this.texture = arrayAtI32(names, 0);
            this.generation = GlCleaner.generation;
        }
        GlRenderer.bindTexture2D(this.texture);
        requireNonNull(gl).glTexImage2D(GL.GL_TEXTURE_2D, 0, GL.GL_LUMINANCE_ALPHA, this.atlasSize, this.atlasSize, 0, GL.GL_LUMINANCE_ALPHA, GL.GL_UNSIGNED_BYTE, buffer);
        GlCleaner.memory2d = (GlCleaner.memory2d + ((buffer.limit() - this.size) | 0)) | 0;
        this.size = buffer.limit();
        requireNonNull(gl).glTexParameteri(GL.GL_TEXTURE_2D, GL.GL_TEXTURE_MIN_FILTER, GL.GL_NEAREST);
        requireNonNull(gl).glTexParameteri(GL.GL_TEXTURE_2D, GL.GL_TEXTURE_MAG_FILTER, GL.GL_NEAREST);
    }
}
