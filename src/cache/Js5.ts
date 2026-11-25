import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import { arrayAtI32, arrayAtObj, arrayPutObj, requireNonNull } from '#/util/JavaArray';
import { JavaError } from '#/util/ClientError';
import WrappedException from '#/util/WrappedException';
import PacketT from '#/io/PacketT';
import type JagString from '#/datastruct/JagString';
import ArrayUtils from '#/util/ArrayUtils';
import { byteAt } from '#/io/JavaByteArray';
import Crc32 from '#/io/Crc32';
import Js5Compression from './Js5Compression';
import ByteArrayCopier, { type StoredBytes } from './ByteArrayCopier';
import DirectByteArrayCopier from './DirectByteArrayCopier';
import type Js5Index from './Js5Index';

import type Js5ResourceProvider from './Js5ResourceProvider';
import { loadClient, loadDelayedStateChange } from '#/util/GamepackClasses';

type LoadedArchive = {
    index: Js5Index;
    packed: (StoredBytes | null)[];
    unpacked: ((StoredBytes | null)[] | null)[];
};

// wk's class initializer can run on the first access from either the JS5 archive or codec module.
let gzip: Js5Compression | null | undefined;
// Multi-file outputs are temporary until every stripe has been copied. Lend
// one workspace across archives, releasing it only after a successful split.
let splitScratch: Uint8Array | undefined;
// Once a file is returned, its backing storage belongs to its caller. Until
// then a subsequent unpack can overwrite the archive's own private pages.
const privateFilePages = new WeakSet<ArrayBufferLike>();

export default class Js5 {
    // HD ve.a(I)V
    static releaseHdStatics(guard: number): void {
        try {
            if (guard !== 100) {
                const DelayedStateChange = loadDelayedStateChange();
                DelayedStateChange.serverAngles(7, 24, -83, -91, -45);
            }
            const Client = loadClient();
            releaseReferences(Client, 'fontMetricsArchive');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 've.AA(' + guard + ')');
        }
    }

    static maxContainerSize = 0; // ce.K:I
    // wk.s:Lbi;
    static get gzipDecompressor(): Js5Compression | null {
        if (gzip === undefined) gzip = new Js5Compression();
        return gzip;
    }
    static set gzipDecompressor(value: Js5Compression | null) {
        gzip = value;
    }
    // vc.J:Z
    static strictValidation = false;
    // al.t:Lud;
    private readonly provider: Js5ResourceProvider | null;
    // al.e:Z
    private readonly discardPacked: boolean;
    // al.N:Z
    private readonly discardUnpacked: boolean;
    // al.x:Ldb;
    protected index: Js5Index | null = null;
    // al.w:[Ljava/lang/Object;
    protected packed: (StoredBytes | null)[] | null = null;
    // al.O:[[Ljava/lang/Object;
    protected unpacked: ((StoredBytes | null)[] | null)[] | null = null;

    // al.<init>(Lud;ZZ)V
    constructor(provider: Js5ResourceProvider | null, discardPacked: boolean, discardUnpacked: boolean) {
        this.provider = provider;
        this.discardPacked = discardPacked;
        this.discardUnpacked = discardUnpacked;
    }

    // al.a(B)Z
    private GetIndexIsReady(): this is this & LoadedArchive {
        if (!this.index) {
            this.index = requireNonNull(this.provider).index();
            if (!this.index) return false;
            this.unpacked = new Array(this.index.capacity).fill(null);
            this.packed = new Array(this.index.capacity).fill(null);
        }
        return true;
    }

    // al.c(IZ)Z
    private GetGroupIsValid(group: number): this is this & LoadedArchive {
        if (!this.GetIndexIsReady()) return false;
        if (group >= 0 && group < requireNonNull(this.index.fileCapacities).length && arrayAtI32(this.index.fileCapacities, group) !== 0) return true;
        if (Js5.strictValidation) throw new RangeError(String(group));
        return false;
    }

    // al.a(IBI)Z
    private validFile(file: number, group: number): this is this & LoadedArchive {
        if (!this.GetIndexIsReady()) return false;
        if (group >= 0 && file >= 0 && group < requireNonNull(this.index.fileCapacities).length && file < arrayAtI32(this.index.fileCapacities, group)) return true;
        if (Js5.strictValidation) throw new RangeError(group + ',' + file);
        return false;
    }

    // al.a(BLid;)I
    GetGroupId(name: JagString | null): number {
        if (!this.GetIndexIsReady()) return -1;
        name = requireNonNull(name).toLowerCase();
        const names = this.index.groupNames;
        const hash = name.hashCode();
        const group = requireNonNull(names).get(hash);
        return this.GetGroupIsValid(group) ? group : -1;
    }

    // al.a(ILid;Lid;)[B
    GetFile3(fileName: JagString | null, groupName: JagString | null): Uint8Array | null {
        if (!this.GetIndexIsReady()) return null;
        groupName = requireNonNull(groupName).toLowerCase();
        fileName = requireNonNull(fileName).toLowerCase();
        const groupNames = this.index.groupNames;
        const groupHash = groupName.hashCode();
        const group = requireNonNull(groupNames).get(groupHash);
        if (!this.GetGroupIsValid(group)) return null;
        const fileNames = arrayAtObj(this.index.fileNames, group);
        const fileHash = fileName.hashCode();
        const file = requireNonNull(fileNames).get(fileHash);
        return this.GetFile(file, group);
    }

    // al.a(III)[B
    GetFile(file: number, group: number): Uint8Array | null {
        return this.FetchFile(file, null, group);
    }

    // al.a(ILid;)Z
    RequestGroupDownload2(name: JagString | null): boolean {
        if (!this.GetIndexIsReady()) return false;
        name = requireNonNull(name).toLowerCase();
        const names = this.index.groupNames;
        const hash = name.hashCode();
        const group = requireNonNull(names).get(hash);
        return this.RequestGroupDownload(group);
    }

    // al.a(Lid;I)Z
    containsGroup(name: JagString | null, minimumId: number): boolean {
        if (!this.GetIndexIsReady()) return false;
        name = requireNonNull(name).toLowerCase();
        const names = this.index.groupNames;
        const hash = name.hashCode();
        const group = requireNonNull(names).get(hash);
        return minimumId <= group;
    }

    // al.a(Lid;B)V
    UpdateCacheHint2(name: JagString | null): void {
        if (this.GetIndexIsReady()) {
            name = requireNonNull(name).toLowerCase();
            const names = this.index.groupNames;
            const hash = name.hashCode();
            const group = requireNonNull(names).get(hash);
            this.UpdateCacheHint(group);
        }
    }

    // al.a(BI)V
    private UpdateCacheHint(group: number): void {
        requireNonNull(this.provider).prefetchGroup(group);
    }

    // al.a(BZZ)V
    discardNames(files: boolean, groups: boolean): void {
        if (this.GetIndexIsReady()) {
            if (files) {
                this.index.fileNames = null;
                this.index.fileNameHashes = null;
            }
            if (groups) {
                this.index.groupNames = null;
                this.index.groupNameHashes = null;
            }
        }
    }

    // al.a(IZ)I
    private GetGroupLoadPercentage(group: number): number {
        if (!this.GetGroupIsValid(group)) return 0;
        return arrayAtObj(this.packed, group) !== null ? 100 : requireNonNull(this.provider).GetGroupLoadPercentage(group);
    }

    // al.b(Lid;I)I
    GetGroupLoadPercentage2(name: JagString | null, selector = -19579): number {
        if (!this.GetIndexIsReady()) return 0;
        name = requireNonNull(name).toLowerCase();
        if (selector !== -19579) return 47;
        const names = this.index.groupNames;
        const hash = name.hashCode();
        const group = requireNonNull(names).get(hash);
        return this.GetGroupLoadPercentage(group);
    }

    // al.a(ZII)Z
    RequestDownload(check: boolean, group: number, file: number): boolean {
        if (!this.validFile(file, group)) return false;
        if (arrayAtObj(this.unpacked, group) !== null && arrayAtObj(arrayAtObj(this.unpacked, group), file) !== null) return true;
        if (!check) this.GetGroupId(null);
        if (arrayAtObj(this.packed, group) !== null) return true;
        this.loadGroup(group);
        return arrayAtObj(this.packed, group) !== null;
    }

    // al.a(Lid;ILid;)Z
    RequestDownload3(fileName: JagString | null, groupName: JagString | null): boolean {
        if (!this.GetIndexIsReady()) return false;
        groupName = requireNonNull(groupName).toLowerCase();
        fileName = requireNonNull(fileName).toLowerCase();
        const groupNames = this.index.groupNames;
        const groupHash = groupName.hashCode();
        const group = requireNonNull(groupNames).get(groupHash);
        if (!this.GetGroupIsValid(group)) return false;
        const fileNames = arrayAtObj(this.index.fileNames, group);
        const fileHash = fileName.hashCode();
        const file = requireNonNull(fileNames).get(fileHash);
        return this.RequestDownload(true, group, file);
    }

    // al.b(B)V
    DiscardAllFiles(): void {
        if (this.unpacked !== null) {
            for (let i = 0; i < this.unpacked.length; i++) this.unpacked[i] = null;
        }
    }

    // al.a(II)[B
    GetFile2(id: number): Uint8Array | null {
        if (!this.GetIndexIsReady()) return null;
        if (requireNonNull(this.index.fileCapacities).length === 1) return this.GetFile(id, 0);
        if (!this.GetGroupIsValid(id)) return null;
        if (arrayAtI32(this.index.fileCapacities, id) === 1) return this.GetFile(0, id);
        throw new Error();
    }

    // al.b(IZ)Z
    RequestDownload2(id: number, check = true): boolean {
        if (!this.GetIndexIsReady()) return false;
        if (requireNonNull(this.index.fileCapacities).length === 1) return this.RequestDownload(check, 0, id);
        if (!check) this.GetGroupLoadPercentage2(null, -9);
        if (!this.GetGroupIsValid(id)) return false;
        if (arrayAtI32(this.index.fileCapacities, id) === 1) return this.RequestDownload(true, id, 0);
        throw new Error();
    }

    // al.c(B)I
    GetIndexCrc(): number {
        if (!this.GetIndexIsReady()) throw new Error('');
        return this.index.m_indexCRC;
    }

    // al.c(I)Z
    RequestFullDownload(): boolean {
        if (!this.GetIndexIsReady()) return false;
        let ready = true;
        for (let i = 0; i < requireNonNull(this.index.groupIds).length; i++) {
            const group = arrayAtI32(this.index.groupIds, i);
            if (arrayAtObj(this.packed, group) === null) {
                this.loadGroup(group);
                if (arrayAtObj(this.packed, group) === null) ready = false;
            }
        }
        return ready;
    }

    // al.d(I)I
    GetDataPercent(emptyWeight: number): number {
        if (!this.GetIndexIsReady()) return 0;
        let sum = 0,
            weight = 0;
        for (let group = 0; group < this.packed.length; group++) {
            if (arrayAtI32(this.index.fileCounts, group) > 0) {
                sum = (sum + this.GetGroupLoadPercentage(group)) | 0;
                weight = (weight + 100) | 0;
            }
        }
        if (weight === emptyWeight) return 100;
        if (weight === 0) throw new RangeError('/ by zero');
        return (Math.imul(100, sum) / weight) | 0;
    }

    // al.a(IIB)[B
    PeekFile(group: number, file: number): Uint8Array | null {
        if (!this.validFile(file, group)) return null;
        if (arrayAtObj(this.unpacked, group) === null || arrayAtObj(arrayAtObj(this.unpacked, group), file) === null) {
            if (!this.UnpackGroupData(undefined, group)) {
                this.loadGroup(group);
                if (!this.UnpackGroupData(undefined, group)) return null;
            }
        }
        const result = ByteArrayCopier.unwrap(false, arrayAtObj(arrayAtObj(this.unpacked, group), file));
        if (this.discardUnpacked && result !== null) privateFilePages.delete(result.buffer);
        return result;
    }

    // al.b(I)I
    GetGroupIdLimit(): number {
        return this.GetIndexIsReady() ? requireNonNull(this.index.fileCapacities).length : -1;
    }

    // al.c(II)I
    GetFileIdLimit(group: number): number {
        return this.GetGroupIsValid(group) ? arrayAtI32(this.index.fileCapacities, group) : 0;
    }

    // al.b(BI)Z
    RequestGroupDownload(group: number): boolean {
        if (!this.GetGroupIsValid(group)) return false;
        if (arrayAtObj(this.packed, group) !== null) return true;
        this.loadGroup(group);
        return arrayAtObj(this.packed, group) !== null;
    }

    // al.a(IB)V
    DiscardFiles(group: number): void {
        if (this.GetGroupIsValid(group) && this.unpacked !== null) arrayPutObj(this.unpacked, group, null);
    }

    // al.b(IB)[I
    GetFileList(group: number): Int32Array | null {
        if (!this.GetGroupIsValid(group)) return null;
        let ids = arrayAtObj(this.index.sparseFileIds, group);
        if (ids === null) {
            ids = new Int32Array(arrayAtI32(this.index.fileCounts, group));
            for (let i = 0; i < ids.length; i++) ids[i] = i;
        }
        return ids;
    }

    // al.b(II)V
    private loadGroup(this: Js5 & LoadedArchive, group: number): void {
        if (!this.discardPacked) arrayPutObj(this.packed, group, ByteArrayCopier.wrap(requireNonNull(this.provider).group(0, group), 136, false));
        else arrayPutObj(this.packed, group, requireNonNull(this.provider).group(0, group));
    }

    // al.a([III)Z
    private UnpackGroupData(key: Int32Array | null | undefined, group: number): boolean {
        if (!this.GetGroupIsValid(group)) return false;
        if (arrayAtObj(this.packed, group) === null) return false;
        const count = arrayAtI32(this.index.fileCounts, group);
        const ids = arrayAtObj(this.index.sparseFileIds, group);
        if (arrayAtObj(this.unpacked, group) === null) arrayPutObj(this.unpacked, group, new Array(arrayAtI32(this.index.fileCapacities, group)).fill(null));
        const files = arrayAtObj(this.unpacked, group);
        let loaded = true;
        for (let i = 0; i < count; i++) {
            if (arrayAtObj(files, ids === null ? i : arrayAtI32(ids, i)) === null) {
                loaded = false;
                break;
            }
        }
        if (loaded) return true;

        let bytes: Uint8Array | null;
        if (key != null && (arrayAtI32(key, 0) !== 0 || arrayAtI32(key, 1) !== 0 || arrayAtI32(key, 2) !== 0 || arrayAtI32(key, 3) !== 0)) {
            bytes = ByteArrayCopier.unwrap(true, arrayAtObj(this.packed, group));
            const packet = new PacketT(bytes);
            packet.tinyKeyDecrypt(key, 5, requireNonNull(packet.m_data).length);
        } else {
            const packed = arrayAtObj(this.packed, group);
            bytes = packed instanceof DirectByteArrayCopier && packed.constructor === DirectByteArrayCopier ? packed.readPackedContainer() : ByteArrayCopier.unwrap(false, packed);
        }
        let data: Uint8Array;
        const scratch = count > 1 ? (splitScratch ?? new Uint8Array(128 * 1024)) : undefined;
        if (scratch !== undefined) splitScratch = undefined;
        try {
            data = Js5Compression.Decompress(bytes, scratch);
        } catch (cause) {
            if (!(cause instanceof Error) || cause instanceof JavaError) throw cause;
            const length = requireNonNull(bytes).length;
            throw WrappedException.wrap(cause, 'T3 - ' + [key != null, group, length, Crc32.prefix(bytes, length), Crc32.prefix(bytes, (length - 2) | 0), arrayAtI32(this.index.groupCrcs, group), this.index.m_indexCRC].join(','));
        }
        if (this.discardPacked) arrayPutObj(this.packed, group, null);
        if (count <= 1) {
            const file = ids === null ? 0 : arrayAtI32(ids, 0);
            if (!this.discardUnpacked) arrayPutObj(files, file, ByteArrayCopier.wrap(data, 136, false));
            else arrayPutObj(files, file, data);
        } else {
            let table = data.length;
            const stripes = byteAt(data, --table);
            table = (table - 4 * count * stripes) | 0;
            const sizes = new Int32Array(count);
            const packet = new PacketT(data);
            packet.m_pos = table;
            for (let stripe = 0; stripe < stripes; stripe++) {
                let size = 0;
                for (let file = 0; file < count; file++) {
                    size = (size + packet.g4()) | 0;
                    sizes[file] += size;
                }
            }
            const chunks: Uint8Array[] = new Array(count);
            // A single stripe can be checked completely before touching existing
            // file data. Keep Java's partial-failure order for malformed tables.
            let reusable = this.discardUnpacked && stripes === 1 && files !== null;
            if (reusable && files !== null) {
                let total = 0;
                let previous = -1;
                for (let i = 0; i < count; i++) {
                    const slot = ids === null ? i : ids[i];
                    if (!(slot > previous && slot < files.length) || sizes[i] < 0) {
                        reusable = false;
                        break;
                    }
                    previous = slot;
                    total += sizes[i];
                }
                reusable = reusable && total === table;
                if (reusable) {
                    for (let i = 0; i < count; i++) {
                        const old = files[ids === null ? i : ids[i]];
                        if (old instanceof Uint8Array && old.length === sizes[i] && privateFilePages.has(old.buffer)) chunks[i] = old;
                    }
                }
            }
            // Keep a distinct byte[] view for every file. Bound the sibling bytes
            // that a single escaped file can keep alive after its group is discarded.
            for (let file = 0; file < count;) {
                if (chunks[file] !== undefined) {
                    sizes[file++] = 0;
                    continue;
                }
                let end = file + 1;
                let pageLength = sizes[file];
                while (pageLength >= 0 && end < count && chunks[end] === undefined && sizes[end] >= 0 && pageLength + sizes[end] <= 4096) {
                    pageLength += sizes[end++];
                }
                const page = end === file + 1 ? null : new ArrayBuffer(pageLength);
                let pageOffset = 0;
                for (; file < end; file++) {
                    const length = sizes[file];
                    chunks[file] = page === null ? new Uint8Array(length) : new Uint8Array(page, pageOffset, length);
                    if (reusable) privateFilePages.add(chunks[file].buffer);
                    pageOffset += length;
                    sizes[file] = 0;
                }
            }
            packet.m_pos = table;
            let offset = 0;
            for (let stripe = 0; stripe < stripes; stripe++) {
                let size = 0;
                for (let file = 0; file < count; file++) {
                    size = (size + packet.g4()) | 0;
                    ArrayUtils.copyBytes(data, offset, chunks[file], sizes[file], size);
                    offset = (offset + size) | 0;
                    sizes[file] += size;
                }
            }
            for (let i = 0; i < count; i++) {
                const file = ids === null ? i : arrayAtI32(ids, i);
                if (this.discardUnpacked) arrayPutObj(files, file, chunks[i]);
                else arrayPutObj(files, file, ByteArrayCopier.wrap(chunks[i], 136, false));
            }
            splitScratch = scratch;
        }
        return true;
    }

    // al.a(BI[II)[B
    FetchFile(id: number, key: Int32Array | null, group: number): Uint8Array | null {
        if (!this.validFile(id, group)) return null;
        if (arrayAtObj(this.unpacked, group) === null || arrayAtObj(arrayAtObj(this.unpacked, group), id) === null) {
            if (!this.UnpackGroupData(key, group)) {
                this.loadGroup(group);
                if (!this.UnpackGroupData(key, group)) return null;
            }
        }
        const result = ByteArrayCopier.unwrap(false, arrayAtObj(arrayAtObj(this.unpacked, group), id));
        if (this.discardUnpacked) {
            if (result !== null) privateFilePages.delete(result.buffer);
            arrayPutObj(arrayAtObj(this.unpacked, group), id, null);
            if (arrayAtI32(this.index.fileCapacities, group) === 1) arrayPutObj(this.unpacked, group, null);
        }
        return result;
    }
}
