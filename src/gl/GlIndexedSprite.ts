import { byteAt } from '#/io/JavaByteArray';
import { GL } from '#/jogl/GL';
import AbstractIndexedSprite from '#/graphics/AbstractIndexedSprite';
import { bitCeil } from '#/util/IntUtils';
import { arrayAtI32, arrayPutI8, requireNonNull } from '#/util/JavaArray';
import ByteBuffer from '#/util/nio/ByteBuffer';
import GlCleaner from './GlCleaner';
import GlRenderer from './GlRenderer';

// oh in runescape_gl.jar (HD only): the GL palette sprite, built in place of a Pix8 (ek) by the indexed-sprite
// factories (ui.h(I)[Lok;, wh.b(B)Lok;) while tf.w is set. The constructor expands the palette indices into an RGBA
// texture padded to power-of-two sides (index 0 transparent, every other index opaque) and compiles one display list
// that draws the sprite as a textured fan; the draws translate to the sprite's top-left corner in the 2D ortho space of
// tf (y up from the bottom edge, tf.A) and call that list. NXT has no GL 1.x classes, so the names are descriptive
// (HD_PLAN.md 1.3).
//
// Java runs finalize() on the unreachable object itself. A FinalizationRegistry callback never sees the collected
// object, so the four fields finalize() reads (oh.n, oh.o, oh.q, oh.r) live in a record that the registry holds,
// behind accessors that keep the Java field roles; the callback runs finalize() on a stand-in sharing that record.
interface GlIndexedSpriteFields {
    texture: number;
    list: number;
    size: number;
    generation: number;
}

const finalizer = new FinalizationRegistry<GlIndexedSpriteFields>(fields => GlIndexedSprite.finalizeCollected(fields));

export default class GlIndexedSprite extends AbstractIndexedSprite {
    // oh.<init>(IIIIII[B[I)V runs the field initializers n = -1, p = 0, o = -1, q = 0 after ok.<init>()V. The record
    // starts at those values, and r (no initializer) at the JVM default.
    private readonly fields: GlIndexedSpriteFields = { texture: -1, list: -1, size: 0, generation: 0 };

    // oh.n:I (the texture name; -1 once finalized)
    private get texture(): number {
        return this.fields.texture;
    }

    private set texture(value: number) {
        this.fields.texture = value;
    }

    // oh.o:I (the display list; -1 once finalized)
    private get list(): number {
        return this.fields.list;
    }

    private set list(value: number) {
        this.fields.list = value;
    }

    // oh.p:I (the filter mode last set on the texture: 0 none yet, 1 NEAREST, 2 LINEAR)
    private filter = 0;

    // oh.q:I (bytes uploaded)
    private get size(): number {
        return this.fields.size;
    }

    private set size(value: number) {
        this.fields.size = value;
    }

    // oh.r:I (GlCleaner.generation when the texture or the list was created)
    private get generation(): number {
        return this.fields.generation;
    }

    private set generation(value: number) {
        this.fields.generation = value;
    }

    // oh.s:I (texture height, the power of two at or above height)
    private textureHeight = 0;
    // oh.t:I (texture width, the power of two at or above width)
    private textureWidth = 0;

    // oh.<init>(IIIIII[B[I)V
    constructor(cropW: number, cropH: number, xOffset: number, yOffset: number, width: number, height: number, pixels: Uint8Array | null, palette: Int32Array | null) {
        super();
        // The JVM registers a finalizable object when Object.<init> returns, so finalize() also runs for an object whose
        // constructor threw; it then sees whichever of n, o, q and r were stored by then.
        finalizer.register(this, this.fields);
        this.cropW = cropW;
        this.cropH = cropH;
        this.xOffset = xOffset;
        this.yOffset = yOffset;
        this.width = width;
        this.height = height;
        this.upload(pixels, palette);
        this.buildList();
    }

    // oh.a([B[I)V. Palette index 0 leaves the texel zero (transparent); any other index is read as a signed byte, so an
    // index of 128 or more throws ArrayIndexOutOfBoundsException at the palette read, as in the jar.
    private upload(pixels: Uint8Array | null, palette: Int32Array | null): void {
        this.textureWidth = bitCeil(this.width);
        this.textureHeight = bitCeil(this.height);
        const texels = new Int8Array(Math.imul(Math.imul(this.textureWidth, this.textureHeight), 4));
        let dst = 0;
        let src = 0;
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const index = (byteAt(pixels, src++) << 24) >> 24;
                if (index !== 0) {
                    const rgb = arrayAtI32(palette, index);
                    arrayPutI8(texels, dst++, ((rgb >> 16) << 24) >> 24);
                    arrayPutI8(texels, dst++, ((rgb >> 8) << 24) >> 24);
                    arrayPutI8(texels, dst++, (rgb << 24) >> 24);
                    arrayPutI8(texels, dst++, -1);
                    continue;
                }
                dst = (dst + 4) | 0;
            }
            dst = (dst + Math.imul((this.textureWidth - this.width) | 0, 4)) | 0;
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
        requireNonNull(gl).glTexImage2D(GL.GL_TEXTURE_2D, 0, GL.GL_RGBA, this.textureWidth, this.textureHeight, 0, GL.GL_RGBA, GL.GL_UNSIGNED_BYTE, buffer);
        GlCleaner.memory2d = (GlCleaner.memory2d + ((buffer.limit() - this.size) | 0)) | 0;
        this.size = buffer.limit();
    }

    // SD si.a(III)V / HD ok.a(III)V, implemented by HD oh.a(III)V
    override drawAlpha(x: number, y: number, alpha: number): void {
        GlRenderer.begin2dModulate();
        const gl = GlRenderer.gl;
        GlRenderer.bindTexture2D(this.texture);
        this.setFilter(1);
        requireNonNull(gl).glColor4f(1.0, 1.0, 1.0, Math.fround(Math.fround(alpha) / 256.0));
        x = (x + this.xOffset) | 0;
        y = (y + this.yOffset) | 0;
        requireNonNull(gl).glTranslatef(Math.fround(x), Math.fround((GlRenderer.height - y) | 0), 0.0);
        requireNonNull(gl).glCallList(this.list);
        requireNonNull(gl).glLoadIdentity();
    }

    // oh.b(I)V. Only mode 2 selects LINEAR; the draws pass 1.
    private setFilter(mode: number): void {
        if (this.filter === mode) {
            return;
        }
        this.filter = mode;
        const gl = GlRenderer.gl;
        if (mode === 2) {
            requireNonNull(gl).glTexParameteri(GL.GL_TEXTURE_2D, GL.GL_TEXTURE_MIN_FILTER, GL.GL_LINEAR);
            requireNonNull(gl).glTexParameteri(GL.GL_TEXTURE_2D, GL.GL_TEXTURE_MAG_FILTER, GL.GL_LINEAR);
        } else {
            requireNonNull(gl).glTexParameteri(GL.GL_TEXTURE_2D, GL.GL_TEXTURE_MIN_FILTER, GL.GL_NEAREST);
            requireNonNull(gl).glTexParameteri(GL.GL_TEXTURE_2D, GL.GL_TEXTURE_MAG_FILTER, GL.GL_NEAREST);
        }
    }

    // SD si.a(II)V / HD ok.a(II)V, implemented by HD oh.a(II)V
    override draw(x: number, y: number): void {
        GlRenderer.begin2dReplace();
        const gl = GlRenderer.gl;
        GlRenderer.bindTexture2D(this.texture);
        this.setFilter(1);
        x = (x + this.xOffset) | 0;
        y = (y + this.yOffset) | 0;
        requireNonNull(gl).glTranslatef(Math.fround(x), Math.fround((GlRenderer.height - y) | 0), 0.0);
        requireNonNull(gl).glCallList(this.list);
        requireNonNull(gl).glLoadIdentity();
    }

    // oh.finalize()V
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
        // super.finalize(): ok declares no finalizer, so this is Object.finalize().
    }

    // The registry's callback (no Java counterpart): runs finalize() for a collected sprite.
    static finalizeCollected(fields: GlIndexedSpriteFields): void {
        const collected = Object.create(GlIndexedSprite.prototype) as GlIndexedSprite;
        Object.defineProperty(collected, 'fields', { value: fields });
        collected.finalize();
    }

    // oh.a()V. The quad from (0, 0) to (width, -height), texture coordinates scaled to the used part of the texture.
    private buildList(): void {
        const s = Math.fround(Math.fround(this.width) / Math.fround(this.textureWidth));
        const t = Math.fround(Math.fround(this.height) / Math.fround(this.textureHeight));
        const gl = GlRenderer.gl;
        if (this.list === -1) {
            this.list = requireNonNull(gl).glGenLists(1);
            this.generation = GlCleaner.generation;
        }
        requireNonNull(gl).glNewList(this.list, GL.GL_COMPILE);
        requireNonNull(gl).glBegin(GL.GL_TRIANGLE_FAN);
        requireNonNull(gl).glTexCoord2f(s, 0.0);
        requireNonNull(gl).glVertex2f(Math.fround(this.width), 0.0);
        requireNonNull(gl).glTexCoord2f(0.0, 0.0);
        requireNonNull(gl).glVertex2f(0.0, 0.0);
        requireNonNull(gl).glTexCoord2f(0.0, t);
        requireNonNull(gl).glVertex2f(0.0, Math.fround(-this.height | 0));
        requireNonNull(gl).glTexCoord2f(s, t);
        requireNonNull(gl).glVertex2f(Math.fround(this.width), Math.fround(-this.height | 0));
        requireNonNull(gl).glEnd();
        requireNonNull(gl).glEndList();
    }
}
