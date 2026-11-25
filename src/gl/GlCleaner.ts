import IntNode from '#/datastruct/IntNode';
import SharedPtrList from '#/datastruct/SharedPtrList';
import SafeTime from '#/io/SafeTime';
import { arrayPutI32, requireNonNull } from '#/util/JavaArray';
import GlRenderer from './GlRenderer';

// fa in runescape_gl.jar (HD only, all static): deferred deletion of GL objects. The finalizers of the GL wrappers
// (vi GlBuffer, sd GlSolidTexture, uh Texture, cf/oh/mb sprites and fonts) cannot call GL from the finalizer thread, so
// they queue their names here with the context generation they were created in; client.a(B)V calls flush (fa.c()V)
// on the game thread each frame while GL is active. A name from an older generation is dropped, because shutdown
// (tf.o()V) calls reset (fa.b()V), which starts a new generation, empties the queues and zeroes the three on-card byte
// counters that k.a prints as oncard_texture, oncard_2d and oncard_geometry. In TS the finalizers are
// FinalizationRegistry callbacks (HD_PLAN.md 2.4); they run on the one JS thread, so the Java methods' `synchronized`
// needs no counterpart. NXT has no GL 1.x classes, so the names are descriptive (HD_PLAN.md 1.3).
// Statics are declared in classfile order with their fa.<clinit>()V values (stored a, d, c, e, f, b, g, h, i, j).
export default class GlCleaner {
    static textureMemory = 0; // fa.a:I (oncard_texture: textures, noise volumes)
    private static bufferQueue: SharedPtrList<IntNode> | null = new SharedPtrList<IntNode>(); // fa.b:Lih; (VBOs)
    static generation = 0; // fa.c:I (incremented by every reset)
    private static lastGcTime = 0n; // fa.d:J
    static memory2d = 0; // fa.e:I (oncard_2d: sprite and font textures)
    static geometryMemory = 0; // fa.f:I (oncard_geometry: VBOs)
    private static texture2dQueue: SharedPtrList<IntNode> | null = new SharedPtrList<IntNode>(); // fa.g:Lih; (2D textures)
    private static textureQueue: SharedPtrList<IntNode> | null = new SharedPtrList<IntNode>(); // fa.h:Lih; (textures)
    private static listQueue: SharedPtrList<IntNode> | null = new SharedPtrList<IntNode>(); // fa.i:Lih; (display lists)
    private static names: Int32Array | null = new Int32Array(1000); // fa.j:[I

    // fa.a(III)V. Queues a texture (sd, uh) of `size` bytes created in `generation`.
    static deleteTexture(texture: number, size: number, generation: number): void {
        if (generation !== GlCleaner.generation) {
            return;
        }
        const node = new IntNode(size);
        node.key = BigInt(texture);
        requireNonNull(GlCleaner.textureQueue).push_back(node);
    }

    // fa.a(II)V. Queues a display list (cf, oh, mb) created in `generation`.
    static deleteList(list: number, generation: number): void {
        if (generation !== GlCleaner.generation) {
            return;
        }
        const node = new IntNode();
        node.key = BigInt(list);
        requireNonNull(GlCleaner.listQueue).push_back(node);
    }

    // fa.a()V
    static unload(): void {
        GlCleaner.bufferQueue = null;
        GlCleaner.texture2dQueue = null;
        GlCleaner.textureQueue = null;
        GlCleaner.listQueue = null;
        GlCleaner.names = null;
    }

    // fa.b()V
    static reset(): void {
        GlCleaner.generation = (GlCleaner.generation + 1) | 0;
        requireNonNull(GlCleaner.bufferQueue).clear();
        requireNonNull(GlCleaner.texture2dQueue).clear();
        requireNonNull(GlCleaner.textureQueue).clear();
        requireNonNull(GlCleaner.listQueue).clear();
        GlCleaner.geometryMemory = 0;
        GlCleaner.memory2d = 0;
        GlCleaner.textureMemory = 0;
    }

    // fa.b(III)V. Queues a VBO (vi) of `size` bytes created in `generation`.
    static deleteBuffer(buffer: number, size: number, generation: number): void {
        if (generation !== GlCleaner.generation) {
            return;
        }
        const node = new IntNode(size);
        node.key = BigInt(buffer);
        requireNonNull(GlCleaner.bufferQueue).push_back(node);
    }

    // fa.c()V. Deletes everything queued, in batches of up to 1000 names (VBOs, then the 2D and other textures in one
    // run, then display lists one at a time), takes the bytes off the counters, and asks for a collection at most once
    // a minute while the counters exceed 96 MiB.
    static flush(): void {
        let node: IntNode | null;
        const gl = GlRenderer.gl;
        let count = 0;
        while ((node = requireNonNull(GlCleaner.bufferQueue).takeFrontAndPop()) !== null) {
            arrayPutI32(GlCleaner.names, count++, Number(BigInt.asIntN(32, node.key)));
            GlCleaner.geometryMemory = (GlCleaner.geometryMemory - node.value) | 0;
            if (count !== 1000) {
                continue;
            }
            requireNonNull(gl).glDeleteBuffersARB(count, GlCleaner.names, 0);
            count = 0;
        }
        if (count > 0) {
            requireNonNull(gl).glDeleteBuffersARB(count, GlCleaner.names, 0);
            count = 0;
        }
        while ((node = requireNonNull(GlCleaner.texture2dQueue).takeFrontAndPop()) !== null) {
            arrayPutI32(GlCleaner.names, count++, Number(BigInt.asIntN(32, node.key)));
            GlCleaner.memory2d = (GlCleaner.memory2d - node.value) | 0;
            if (count !== 1000) {
                continue;
            }
            requireNonNull(gl).glDeleteTextures(count, GlCleaner.names, 0);
            count = 0;
        }
        while ((node = requireNonNull(GlCleaner.textureQueue).takeFrontAndPop()) !== null) {
            arrayPutI32(GlCleaner.names, count++, Number(BigInt.asIntN(32, node.key)));
            GlCleaner.textureMemory = (GlCleaner.textureMemory - node.value) | 0;
            if (count !== 1000) {
                continue;
            }
            requireNonNull(gl).glDeleteTextures(count, GlCleaner.names, 0);
            count = 0;
        }
        if (count > 0) {
            requireNonNull(gl).glDeleteTextures(count, GlCleaner.names, 0);
            count = 0;
        }
        while ((node = requireNonNull(GlCleaner.listQueue).takeFrontAndPop()) !== null) {
            const list = Number(BigInt.asIntN(32, node.key));
            requireNonNull(gl).glDeleteLists(list, 1);
        }
        if (((GlCleaner.geometryMemory + GlCleaner.memory2d + GlCleaner.textureMemory) | 0) > 0x6000000 && SafeTime.CurrentTimeMillis() > BigInt.asIntN(64, GlCleaner.lastGcTime + 60000n)) {
            // System.gc() when the host exposes the collector.
            globalThis.gc?.();
            GlCleaner.lastGcTime = SafeTime.CurrentTimeMillis();
        }
    }

    // fa.c(III)V. Queues a 2D texture (cf, el, oh, mb) of `size` bytes created in `generation`.
    static deleteTexture2d(texture: number, size: number, generation: number): void {
        if (generation !== GlCleaner.generation) {
            return;
        }
        const node = new IntNode(size);
        node.key = BigInt(texture);
        requireNonNull(GlCleaner.texture2dQueue).push_back(node);
    }
}
