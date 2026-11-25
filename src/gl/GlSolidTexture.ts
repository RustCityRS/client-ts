import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import Pix3D from '#/dash3d/Pix3D';
import SecondaryNode from '#/datastruct/SecondaryNode';
import { GL } from '#/jogl/GL';
import { arrayAtI32, requireNonNull } from '#/util/JavaArray';
import ByteBuffer from '#/util/nio/ByteBuffer';
import GlCleaner from './GlCleaner';
import GlRenderer from './GlRenderer';
import MaterialManager from '#/gl/material/MaterialManager';
import LocalisedTextClass from '#/ui/LocalisedText';
import { loadInterfaceList } from '#/util/GamepackClasses';

// sd in runescape_gl.jar (HD only): a 1x1 RGBA texture of one palette colour, LINEAR filtered. The texture cache (nk)
// builds one from a texture's average colour (new sd(F[id] & 0xffff), an HSL index into Pix3D.colourTable) and binds
// it in place of a texture that is not uploaded yet. finalize() hands the name to GlCleaner.deleteTexture
// (fa.a(III)V). The other members of sd are statics the obfuscator moved in from unrelated classes; the HD member map
// places them elsewhere. NXT has no GL 1.x classes, so the names are descriptive (HD_PLAN.md 1.3).
//
// Java runs finalize() on the unreachable object itself. A FinalizationRegistry callback never sees the collected
// object, so the three fields finalize() reads (sd.K, sd.L, sd.U) live in a record that the registry holds, behind
// accessors that keep the Java field roles; the callback runs finalize() on a stand-in sharing that record.
interface GlSolidTextureFields {
    id: number;
    generation: number;
    size: number;
}

const finalizer = new FinalizationRegistry<GlSolidTextureFields>(fields => GlSolidTexture.finalizeCollected(fields));

export default class GlSolidTexture extends SecondaryNode {
    // HD sd.d(I)V
    static releaseGlSolidTextureStatics(guard: number): void {
        try {
            const LocalisedText = LocalisedTextClass;
            releaseReferences(LocalisedText, 'faceHere', 'frenchAttemptToReestablish');
            const InterfaceList = loadInterfaceList();
            releaseReferences(InterfaceList, 'rootWidth');
            if (guard !== 1) {
                releaseReferences(LocalisedText, 'englishFaceHere');
            }
            releaseReferences(LocalisedText, 'germanLoadedWorldList', 'englishFaceHere');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'sd.B(' + guard + ')');
        }
    }

    // sd.<init>(I)V runs the field initializers U = 0, then K = -1.
    private readonly fields: GlSolidTextureFields = { id: -1, generation: 0, size: 0 };

    // sd.K:I (the texture name; -1 once finalized)
    private get id(): number {
        return this.fields.id;
    }

    private set id(value: number) {
        this.fields.id = value;
    }

    // sd.L:I (GlCleaner.generation at creation)
    private get generation(): number {
        return this.fields.generation;
    }

    private set generation(value: number) {
        this.fields.generation = value;
    }

    // sd.U:I (bytes uploaded)
    private get size(): number {
        return this.fields.size;
    }

    private set size(value: number) {
        this.fields.size = value;
    }

    // sd.finalize()V (the call counter Q and the gj.a catch/rethrow wrapper stripped)
    protected finalize(): void {
        if (this.id !== -1) {
            GlCleaner.deleteTexture(this.id, this.size, this.generation);
            this.id = -1;
            this.size = 0;
        }
        // super.finalize(): rg, ab and Object declare no finalizer of their own, so this is Object.finalize().
    }

    // The registry's callback (no Java counterpart): runs finalize() for a collected texture.
    static finalizeCollected(fields: GlSolidTextureFields): void {
        const collected = Object.create(GlSolidTexture.prototype) as GlSolidTexture;
        Object.defineProperty(collected, 'fields', { value: fields });
        collected.finalize();
    }

    // sd.g(B)V (dummy 6 stripped: nk.a(IZ)V is the only caller and passes 6; the call counter N and the gj.a
    // catch/rethrow wrapper stripped). Binds the texture unless the current material's flags (ef.a(I)I) say it binds
    // its own (bit 1), and resets the RGB and alpha combine modes unless the material keeps them (bits 2 and 4).
    bind(): void {
        const flags = MaterialManager.getMaterialFlags();
        if ((flags & 0x1) === 0) {
            GlRenderer.bindTexture2D(this.id);
        }
        if ((flags & 0x2) === 0) {
            GlRenderer.setTextureCombineRgb(0);
        }
        if ((flags & 0x4) === 0) {
            GlRenderer.setTextureCombineAlpha(0);
        }
    }

    // sd.<init>(I)V (the gj.a catch/rethrow wrapper stripped)
    constructor(colour: number) {
        super();
        // The JVM registers a finalizable object when Object.<init> returns, so finalize() also runs for an object whose
        // constructor threw; it then sees id -1 (the field initializer) and does nothing.
        finalizer.register(this, this.fields);
        const gl = GlRenderer.gl;
        const names = new Int32Array(1);
        requireNonNull(gl).glGenTextures(1, names, 0);
        this.id = arrayAtI32(names, 0);
        this.generation = GlCleaner.generation;
        GlRenderer.bindTexture2D(this.id);
        const rgb = arrayAtI32(Pix3D.colourTable, colour);
        const pixel = Int8Array.of(((rgb >> 16) << 24) >> 24, ((rgb >> 8) << 24) >> 24, (rgb << 24) >> 24, -1);
        const buffer = ByteBuffer.wrap(pixel);
        requireNonNull(gl).glTexImage2D(GL.GL_TEXTURE_2D, 0, GL.GL_RGBA, 1, 1, 0, GL.GL_RGBA, GL.GL_UNSIGNED_BYTE, buffer);
        requireNonNull(gl).glTexParameteri(GL.GL_TEXTURE_2D, GL.GL_TEXTURE_MIN_FILTER, GL.GL_LINEAR);
        requireNonNull(gl).glTexParameteri(GL.GL_TEXTURE_2D, GL.GL_TEXTURE_MAG_FILTER, GL.GL_LINEAR);
        GlCleaner.textureMemory = (GlCleaner.textureMemory + (buffer.limit() - this.size)) | 0;
        this.size = buffer.limit();
    }
}
