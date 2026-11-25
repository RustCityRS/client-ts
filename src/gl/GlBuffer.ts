import { arrayAtI32, requireNonNull } from '#/util/JavaArray';
import type ByteBuffer from '#/util/nio/ByteBuffer';
import { GL } from '#/jogl/GL';
import GlCleaner from './GlCleaner';
import GlRenderer from './GlRenderer';

// vi in runescape_gl.jar (HD only): one ARB vertex buffer object, used by the GL model (td), terrain batches (hg),
// point-light glow meshes (fj) and shadow blocks (wm). Uploads are STREAM_DRAW for a stream buffer, else STATIC_DRAW;
// the byte size is kept in GlCleaner.geometryMemory. finalize() hands the name to GlCleaner.deleteBuffer (fa.b(III)V),
// which drops it if the context was recreated since. NXT has no GL 1.x classes, so the names are descriptive
// (HD_PLAN.md 1.3).
//
// Java runs finalize() on the unreachable object itself. A FinalizationRegistry callback never sees the collected
// object, so the three fields finalize() reads (vi.a, vi.b, vi.c) live in a record that the registry holds, behind
// accessors that keep the Java field roles; the callback runs finalize() on a stand-in GlBuffer sharing that record.
interface GlBufferFields {
    id: number;
    generation: number;
    size: number;
}

const finalizer = new FinalizationRegistry<GlBufferFields>(fields => GlBuffer.finalizeCollected(fields));

export default class GlBuffer {
    private readonly fields: GlBufferFields = { id: -1, generation: 0, size: 0 };
    private stream = false; // vi.d:Z

    // vi.a:I (the buffer name; -1 once finalized)
    get id(): number {
        return this.fields.id;
    }

    private set id(value: number) {
        this.fields.id = value;
    }

    // vi.b:I (GlCleaner.generation at creation)
    private get generation(): number {
        return this.fields.generation;
    }

    private set generation(value: number) {
        this.fields.generation = value;
    }

    // vi.c:I (bytes in the buffer)
    private get size(): number {
        return this.fields.size;
    }

    private set size(value: number) {
        this.fields.size = value;
    }

    // vi.a(Ljava/nio/ByteBuffer;)V. Rewrites the buffer in place when the data fits, else reallocates it.
    update(buffer: ByteBuffer | null): void {
        if (requireNonNull(buffer).limit() <= this.size) {
            const gl = GlRenderer.gl;
            requireNonNull(gl).glBindBufferARB(GL.GL_ARRAY_BUFFER, this.id);
            requireNonNull(gl).glBufferSubDataARB(GL.GL_ARRAY_BUFFER, 0, requireNonNull(buffer).limit(), buffer);
        } else {
            this.uploadArray(buffer);
        }
    }

    // vi.finalize()V
    protected finalize(): void {
        if (this.id !== -1) {
            GlCleaner.deleteBuffer(this.id, this.size, this.generation);
            this.id = -1;
            this.size = 0;
        }
        // super.finalize(): Object.finalize() does nothing.
    }

    // The registry's callback (no Java counterpart): runs finalize() for a collected buffer.
    static finalizeCollected(fields: GlBufferFields): void {
        const collected = Object.create(GlBuffer.prototype) as GlBuffer;
        Object.defineProperty(collected, 'fields', { value: fields });
        collected.finalize();
    }

    // vi.a()V
    bindArray(): void {
        const gl = GlRenderer.gl;
        requireNonNull(gl).glBindBufferARB(GL.GL_ARRAY_BUFFER, this.id);
    }

    // vi.b(Ljava/nio/ByteBuffer;)V
    uploadElements(buffer: ByteBuffer | null): void {
        const gl = GlRenderer.gl;
        requireNonNull(gl).glBindBufferARB(GL.GL_ELEMENT_ARRAY_BUFFER, this.id);
        requireNonNull(gl).glBufferDataARB(GL.GL_ELEMENT_ARRAY_BUFFER, requireNonNull(buffer).limit(), buffer, this.stream ? GL.GL_STREAM_DRAW : GL.GL_STATIC_DRAW);
        GlCleaner.geometryMemory = (GlCleaner.geometryMemory + (requireNonNull(buffer).limit() - this.size)) | 0;
        this.size = requireNonNull(buffer).limit();
    }

    // vi.b()V
    bindElements(): void {
        const gl = GlRenderer.gl;
        requireNonNull(gl).glBindBufferARB(GL.GL_ELEMENT_ARRAY_BUFFER, this.id);
    }

    // vi.c(Ljava/nio/ByteBuffer;)V
    uploadArray(buffer: ByteBuffer | null): void {
        const gl = GlRenderer.gl;
        requireNonNull(gl).glBindBufferARB(GL.GL_ARRAY_BUFFER, this.id);
        requireNonNull(gl).glBufferDataARB(GL.GL_ARRAY_BUFFER, requireNonNull(buffer).limit(), buffer, this.stream ? GL.GL_STREAM_DRAW : GL.GL_STATIC_DRAW);
        GlCleaner.geometryMemory = (GlCleaner.geometryMemory + (requireNonNull(buffer).limit() - this.size)) | 0;
        this.size = requireNonNull(buffer).limit();
    }

    // vi.<init>()V calls this(false).
    constructor();
    // vi.<init>(Z)V
    constructor(stream: boolean);
    constructor(stream: boolean = false) {
        // The JVM registers a finalizable object when Object.<init> returns, so finalize() also runs for an object whose
        // constructor threw; it then sees id -1 (the field initializer) and does nothing.
        finalizer.register(this, this.fields);
        const gl = GlRenderer.gl;
        const names = new Int32Array(1);
        requireNonNull(gl).glGenBuffersARB(1, names, 0);
        this.stream = stream;
        this.id = arrayAtI32(names, 0);
        this.generation = GlCleaner.generation;
    }
}
