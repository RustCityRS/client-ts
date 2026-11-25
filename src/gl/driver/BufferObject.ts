// ARB vertex buffer objects for the WebGPU driver (HD_PLAN 2.3 VBO row, 2.4 write-after-use). Host code, not a Java
// port.
//
// The GL data store lives on the CPU (GL semantics: glBufferDataARB copies the client bytes at call time) and is
// mirrored into a GPUBuffer (VERTEX | INDEX | COPY_DST) when a draw uses it. WebGPU runs queue.writeBuffer before the
// commands of the frame's still-unsubmitted encoder, so writing a GPUBuffer that an encoded draw already references
// would change what that draw reads. The buffer is therefore renamed instead: when the store changed after the GPU
// copy was referenced in the current submission epoch, realize() allocates a fresh GPUBuffer and retires the old one
// (destroyed after submit). Otherwise it writes in place.

import { inflateSync } from 'fflate';
import { deflate, deflateInit2, deflateReset } from 'pako/lib/zlib/deflate.js';
import ZStream from 'pako/lib/zlib/zstream.js';
import { GLX as E } from './GlEnums';
import { ShadowGridImage } from './ShadowGridImage';

interface SharedGpuBuffer {
    buffer: GPUBuffer | null;
    users: number;
    usedEpoch: number;
}

const idleByteBudget = 128 * 1024;
type WordStore = { dictionary: Uint32Array; indices: Uint8Array | Uint16Array };

// Each idle job has at most 32K words. Reuse its open-addressed word table and
// index scratch; copy only the representation that will outlive compaction.
class BufferCompactor {
    private readonly slots = new Uint16Array(idleByteBudget / 4);
    private readonly words = new Uint32Array(idleByteBudget / 4);
    private readonly indices = new Uint16Array(idleByteBudget / 4);
    private compressor?: VertexCompressor;

    compact(raw: Uint8Array<ArrayBuffer>, vertexOnly: boolean): WordStore | { packed: Uint8Array } | Uint8Array<ArrayBuffer> {
        const packed = vertexOnly && raw.length >= 2048 ? (this.compressor ??= new VertexCompressor()).compress(raw) : null;
        const count = raw.length / 4;
        // A dictionary needs at least one byte per word plus its first palette entry.
        if (packed === null || packed.length + 160 >= (count + 4) * 0.85) {
            const store = this.compactWords(raw, packed);
            if (store) return store;
        }
        return packed !== null && packed.length + 160 < raw.length * 0.85 ? { packed: packed.slice() } : raw;
    }

    private compactWords(raw: Uint8Array, packed: Uint8Array | null): WordStore | null {
        const count = raw.length / 4;
        const maxBytes = ((raw.length * 0.9) | 0) - 192;
        const maxEntries = Math.max(256, ((maxBytes - count * 2) / 4) | 0);
        const source = new DataView(raw.buffer, raw.byteOffset, raw.length);
        const mask = this.slots.length - 1;
        this.slots.fill(0);
        let size = 0;
        for (let i = 0; i < count; i++) {
            const word = source.getUint32(i * 4, true);
            const hash = Math.imul(word ^ (word >>> 16), 0x9e3779b1);
            let slot = (hash ^ (hash >>> 16)) & mask;
            let index = this.slots[slot] - 1;
            // Raw bytes remain valid for unusually long collision chains.
            for (let probes = 0; index >= 0 && this.words[index] !== word; probes++) {
                if (probes === 32) return null;
                slot = (slot + 1) & mask;
                index = this.slots[slot] - 1;
            }
            if (index < 0) {
                if (size === maxEntries) return null;
                this.words[size] = word;
                index = size++;
                this.slots[slot] = size;
            }
            this.indices[i] = index;
        }
        const narrow = size <= 256;
        const bytes = size * 4 + count * (narrow ? 1 : 2);
        if (bytes > maxBytes || (packed !== null && packed.length + 160 < bytes * 0.85)) return null;
        const indices = narrow ? new Uint8Array(this.indices.subarray(0, count)) : this.indices.slice(0, count);
        return { dictionary: this.words.slice(0, size), indices };
    }
}

class VertexCompressor {
    private readonly stream = new ZStream();
    private readonly output = new Uint8Array(idleByteBudget);

    constructor() {
        // Raw DEFLATE, level 3. The history and match tables serve every store in the batch.
        deflateInit2(this.stream, 3, 8, -15, 7, 0);
    }

    compress(raw: Uint8Array): Uint8Array | null {
        const stream = this.stream;
        deflateReset(stream);
        stream.input = raw;
        stream.next_in = stream.next_out = 0;
        stream.avail_in = raw.length;
        stream.output = this.output;
        stream.avail_out = this.output.length;
        const status = deflate(stream, 4); // Z_FINISH
        stream.input = stream.output = null;
        // An incompressible store can exhaust the output buffer. Keep its existing representation.
        return status === 1 ? this.output.subarray(0, stream.next_out) : null;
    }
}

// Retain every bit of the uploaded snapshot. A diagnostic or repacking caller can take a
// mutable byte view, so once that view escapes its storage and identity must remain stable.
class StaticStore {
    readonly byteLength: number;
    owners = 1;
    resident?: SharedGpuBuffer;
    considered = false;
    private rawEscaped = false;
    private storage: Uint8Array<ArrayBuffer> | WordStore | { packed: Uint8Array } | ShadowGridImage;

    constructor(
        readonly key: number,
        source: Uint8Array,
        private vertexOnly: boolean
    ) {
        this.storage = ShadowGridImage.capture(source) ?? new Uint8Array(source);
        this.byteLength = source.length;
        this.considered = this.storage instanceof ShadowGridImage;
    }

    // Only uploaded immutable stores enter here, from an idle callback. Meshes contain many
    // repeated float bit patterns, colours and indices. A local dictionary also permits exact
    // index scans and full dedup comparisons without reconstructing the byte array.
    compact(workspace: BufferCompactor): void {
        const raw = this.storage;
        if (!(raw instanceof Uint8Array)) return;
        this.storage = workspace.compact(raw, this.vertexOnly);
        // The original upload was copied into this store. Release its backing only
        // after a smaller representation owns all bytes and no caller has kept a view.
        if (this.storage !== raw && !this.rawEscaped && raw.buffer instanceof ArrayBuffer && raw.byteOffset === 0 && raw.byteLength === raw.buffer.byteLength) {
            raw.buffer.transferToFixedLength?.(0);
        }
    }

    matches(source: Uint8Array): boolean {
        if (this.byteLength !== source.length) return false;
        if (this.storage instanceof ShadowGridImage) return this.storage.matches(source);
        const storage = 'packed' in this.storage ? this.bytes() : this.storage;
        if (storage instanceof Uint8Array) {
            for (let i = 0; i < source.length; i++) {
                if (source[i] !== storage[i]) return false;
            }
        } else {
            const { dictionary, indices } = storage;
            const view = new DataView(source.buffer, source.byteOffset, source.length);
            for (let i = 0; i < indices.length; i++) {
                if (view.getUint32(i * 4, true) !== dictionary[indices[i]]) return false;
            }
        }
        return true;
    }

    highest(offset: number, count: number): number | undefined {
        this.vertexOnly = false;
        // A former vertex source now needs synchronous arbitrary index ranges. Decode it
        // once; subsequent uncached ranges can scan it without repeated decompression.
        if ('packed' in this.storage) this.storage = this.bytes();
        if (!('dictionary' in this.storage) || !Number.isSafeInteger(offset) || (offset & 3) !== 0 || offset < 0 || !Number.isSafeInteger(count) || count < 0 || offset + count * 4 > this.byteLength) return undefined;
        const { dictionary, indices } = this.storage;
        const start = offset / 4;
        let highest = -1;
        for (let i = start; i < start + count; i++) highest = Math.max(highest, dictionary[indices[i]]);
        return highest;
    }

    bytes(): Uint8Array<ArrayBuffer> {
        if (this.storage instanceof Uint8Array) this.rawEscaped = true;
        return this.borrowBytes();
    }

    // Only for a synchronous upload or index scan. A retained view must go through bytes().
    borrowBytes(): Uint8Array<ArrayBuffer> {
        if (this.storage instanceof Uint8Array) return this.storage;
        if (this.storage instanceof ShadowGridImage) return this.storage.bytes();
        if ('packed' in this.storage) {
            const out = new Uint8Array(this.byteLength);
            inflateSync(this.storage.packed, { out });
            return out;
        }
        const { dictionary, indices } = this.storage;
        const bytes = new Uint8Array(this.byteLength);
        const view = new DataView(bytes.buffer);
        for (let i = 0; i < indices.length; i++) view.setUint32(i * 4, dictionary[indices[i]], true);
        return bytes;
    }

    expose(): Uint8Array<ArrayBuffer> {
        const bytes = this.bytes();
        this.storage = bytes;
        this.considered = true;
        return bytes;
    }

    mutableBytes(): Uint8Array<ArrayBuffer> {
        return this.storage instanceof Uint8Array && this.owners > 1 ? this.storage.slice() : this.bytes();
    }

    get retainedByteLength(): number {
        if (this.storage instanceof ShadowGridImage) return this.storage.retainedByteLength;
        if ('packed' in this.storage) return this.storage.packed.byteLength;
        return this.storage instanceof Uint8Array ? this.storage.byteLength : this.storage.dictionary.byteLength + this.storage.indices.byteLength;
    }
}

// Repeated loc meshes and shadow index arrays have identical static stores under distinct GL
// names. The table owns no extra bytes after the last name releases a store. Eight sample words
// select a bucket; only a full byte comparison permits sharing.
export class StaticBufferStores {
    private readonly buckets = new Map<number, StaticStore[]>();

    private readonly pending = new Set<StaticStore>();
    private idleCallback?: number;
    // Adjacent idle callbacks can reuse the scratch. The loaded scene never pins it across GC.
    private workspace?: WeakRef<BufferCompactor>;

    queueCompaction(entry: StaticStore): void {
        if (entry.considered || entry.byteLength < 512 || entry.byteLength > idleByteBudget || (entry.byteLength & 3) !== 0 || typeof requestIdleCallback !== 'function' || typeof cancelIdleCallback !== 'function') return;
        entry.considered = true;
        this.pending.add(entry);
        if (this.idleCallback === undefined) this.idleCallback = requestIdleCallback(this.compactIdle);
    }

    // A callback visits at most 128 KiB and leaves time for the next frame. The largest
    // individual job is bounded too, even if a caller specifies a multi-megabyte VBO.
    private readonly compactIdle = (deadline: IdleDeadline): void => {
        this.idleCallback = undefined;
        let budget = idleByteBudget;
        let workspace = this.workspace?.deref();
        for (const entry of this.pending) {
            if (deadline.timeRemaining() < 3 || entry.byteLength > budget) break;
            this.pending.delete(entry);
            budget -= entry.byteLength;
            if (!workspace) {
                workspace = new BufferCompactor();
                this.workspace = new WeakRef(workspace);
            }
            entry.compact(workspace);
        }
        if (this.pending.size !== 0) this.idleCallback = requestIdleCallback(this.compactIdle);
    };

    expose(entry: StaticStore): Uint8Array<ArrayBuffer> {
        this.removePending(entry);
        return entry.expose();
    }

    private removePending(entry: StaticStore): void {
        if (this.pending.delete(entry) && this.pending.size === 0 && this.idleCallback !== undefined) {
            cancelIdleCallback(this.idleCallback);
            this.idleCallback = undefined;
        }
    }

    acquire(source: Uint8Array, vertexOnly = false): StaticStore {
        const view = new DataView(source.buffer, source.byteOffset, source.byteLength);
        let key = source.length;
        for (let i = 0; i < 8; i++) {
            const at = ((i * (source.length - 4)) / 7) | 0;
            key = Math.imul(key ^ view.getUint32(at, true), 16777619);
        }
        let bucket = this.buckets.get(key);
        if (!bucket) {
            bucket = [];
            this.buckets.set(key, bucket);
        }
        for (const entry of bucket) {
            if (entry.matches(source)) {
                entry.owners++;
                return entry;
            }
        }
        const entry = new StaticStore(key, source, vertexOnly);
        bucket.push(entry);
        return entry;
    }

    release(entry: StaticStore): void {
        if (--entry.owners !== 0) return;
        this.removePending(entry);
        const bucket = this.buckets.get(entry.key);
        if (!bucket) return;
        if (bucket.length === 1) this.buckets.delete(entry.key);
        else bucket.splice(bucket.indexOf(entry), 1);
    }
}

const emptyBytes = new Uint8Array(0);

export class BufferObject {
    readonly name: number;
    private raw: Uint8Array<ArrayBuffer> = new Uint8Array(0);

    get byteLength(): number {
        return this.store?.byteLength ?? this.raw.byteLength;
    }

    // This name's physical CPU store. Multiple names can share it.
    get retainedByteLength(): number {
        return this.store?.retainedByteLength ?? this.raw.byteLength;
    }

    get data(): Uint8Array<ArrayBuffer> {
        return this.store && this.stores ? this.stores.expose(this.store) : this.raw;
    }
    usage = 0;
    deleted = false;
    version = 0;
    private store?: StaticStore;
    private sharedGpu?: SharedGpuBuffer;
    private indexVersion = -1;
    private maxIndices?: Map<number, { count: number; highest: number }>;

    // Only client-vertex or repacked attributes require a CPU scan. Static element ranges repeat
    // across animation frames; both BufferDataARB and BufferSubDataARB advance the store version.
    highestIndex(offset: number, count: number): number {
        const ranges = (this.maxIndices ??= new Map());
        if (this.indexVersion !== this.version) {
            ranges.clear();
            this.indexVersion = this.version;
        }
        const previous = ranges.get(offset);
        if (previous?.count === count) return previous.highest;
        let highest = this.store?.highest(offset, count);
        if (highest === undefined) {
            const data = this.store?.borrowBytes() ?? this.raw;
            const view = new DataView(data.buffer, data.byteOffset + offset, count * 4);
            highest = -1;
            for (let i = 0; i < count; i++) highest = Math.max(highest, view.getUint32(i * 4, true));
        }
        ranges.set(offset, { count, highest });
        return highest;
    }
    gpu: GPUBuffer | null = null;
    gpuVersion = -1;
    // The submission epoch in which the GPU copy was last referenced by an encoded command (-1: never).
    usedEpoch = -1;
    // How many times realize() had to rename (tests and diagnostics).
    renames = 0;

    constructor(
        name: number,
        private readonly stores?: StaticBufferStores
    ) {
        this.name = name;
    }

    // glBufferDataARB: a new store of `size` bytes, initialized from src (or zero when src is null).
    setData(size: number, src: Uint8Array | null, usage: number, target: number = E.GL_ELEMENT_ARRAY_BUFFER): void {
        let store: StaticStore | undefined, data: Uint8Array<ArrayBuffer>;
        // Sample eight words from stores at least 32 bytes long. Streaming stores are mutable.
        if (usage === E.GL_STATIC_DRAW && size >= 32 && this.stores && src && src.length >= size) {
            store = this.stores.acquire(src.length === size ? src : src.subarray(0, size), target === E.GL_ARRAY_BUFFER);
            data = emptyBytes;
        } else {
            data = new Uint8Array(size);
            if (src !== null) data.set(src.length === size ? src : src.subarray(0, size));
        }
        if (this.store) this.stores?.release(this.store);
        this.store = store;
        this.raw = data;
        this.usage = usage;
        this.version++;
    }

    // glBufferSubDataARB: replaces [offset, offset + size). The caller has checked the range.
    setSubData(offset: number, src: Uint8Array): void {
        if (this.store) {
            const data = this.store.mutableBytes();
            data.set(src, offset);
            this.stores?.release(this.store);
            this.store = undefined;
            this.raw = data;
        } else {
            this.raw.set(src, offset);
        }
        this.version++;
    }

    private releaseGpu(retire: (old: GPUBuffer) => void): void {
        if (this.sharedGpu) {
            if (--this.sharedGpu.users === 0 && this.sharedGpu.buffer) {
                retire(this.sharedGpu.buffer);
                this.sharedGpu.buffer = null;
            }
            this.sharedGpu = undefined;
        } else if (this.gpu) {
            retire(this.gpu);
        }
        this.gpu = null;
    }

    // The GPU copy of the current store, marked as referenced in `epoch`. GPU sizes are padded to 4 bytes.
    realize(device: GPUDevice, epoch: number, retire: (old: GPUBuffer) => void): GPUBuffer {
        if (this.gpu !== null && this.gpuVersion === this.version) {
            this.usedEpoch = epoch;
            if (this.sharedGpu) this.sharedGpu.usedEpoch = epoch;
            return this.gpu;
        }
        const resident = this.store?.resident;
        if (resident?.buffer) {
            if (this.sharedGpu !== resident) {
                this.releaseGpu(retire);
                resident.users++;
                this.sharedGpu = resident;
                this.gpu = resident.buffer;
            }
            resident.usedEpoch = epoch;
            this.usedEpoch = epoch;
            this.gpuVersion = this.version;
            return resident.buffer;
        }
        if (this.sharedGpu) {
            if (this.sharedGpu.users === 1) {
                // Keep the exclusive allocation for the normal rename-or-update decision below.
                // Other names still holding the original CPU bytes can realize them on demand.
                this.usedEpoch = this.sharedGpu.usedEpoch;
                this.sharedGpu.buffer = null;
                this.sharedGpu.users = 0;
                this.sharedGpu = undefined;
            } else {
                if (this.usedEpoch === epoch) this.renames++;
                this.releaseGpu(retire);
            }
        }
        const data = this.store?.borrowBytes() ?? this.raw;
        const size = Math.max(4, (data.length + 3) & ~3);
        const padded = size === data.length ? data : new Uint8Array(size);
        if (padded !== data) padded.set(data);
        let target = this.gpu;
        if (target !== null && (target.size !== size || this.usedEpoch === epoch)) {
            if (this.usedEpoch === epoch) this.renames++;
            retire(target);
            target = null;
        }
        if (target === null) {
            target = device.createBuffer({
                label: 'gl-buffer-' + this.name,
                size,
                usage: GPUBufferUsage.VERTEX | GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
            });
        }
        device.queue.writeBuffer(target, 0, padded);
        this.gpu = target;
        if (this.store) {
            this.sharedGpu = this.store.resident = { buffer: target, users: 1, usedEpoch: epoch };
            this.stores?.queueCompaction(this.store);
        }
        this.gpuVersion = this.version;
        this.usedEpoch = epoch;
        return target;
    }

    destroy(retire: (old: GPUBuffer) => void): void {
        this.deleted = true;
        if (this.store) this.stores?.release(this.store);
        this.store = undefined;
        this.raw = new Uint8Array(0);
        this.maxIndices?.clear();
        this.releaseGpu(retire);
    }
}
