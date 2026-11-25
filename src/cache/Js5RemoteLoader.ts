import { glJar } from '#/client/ClientVariant';
import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import { JavaError } from '#/util/ClientError';
import HashTable from '#/datastruct/HashTable';
import SharedPtrList from '#/datastruct/SharedPtrList';
import Linkable from '#/datastruct/Linkable';
import JavaCrc32 from '#/util/JavaCrc32';
import SafeTime from '#/io/SafeTime';
import type Js5NetQueue from '#/io/Js5NetQueue';
import Js5Request from '#/io/Js5Request';
import { arrayAtI32, arrayAtI8, arrayPutI8, requireNonNull } from '#/util/JavaArray';
import type Js5LocalCache from './Js5LocalCache';
import Js5DiskRequest, { type Js5DiskStore } from './Js5DiskRequest';
import Js5Index from './Js5Index';
import Js5ResourceProvider from './Js5ResourceProvider';
import LocalisedTextClass from '#/ui/LocalisedText';
import { loadClient, loadClientKeyboardListener } from '#/util/GamepackClasses';

export default class Js5RemoteLoader extends Js5ResourceProvider {
    // HD bg.b(Z)V
    static releaseJs5RemoteLoaderStatics(guard: boolean): void {
        try {
            const Client = loadClient();
            releaseReferences(Client, 'mapfunctionName', 'kilobytes');
            if (guard) {
                return;
            }
            const ClientKeyboardListener = loadClientKeyboardListener();
            releaseReferences(ClientKeyboardListener, 'changes');
            releaseReferences(Client, 'loginout');
            const LocalisedText = LocalisedTextClass;
            releaseReferences(LocalisedText, 'englishLoadingInterfaces', 'loadingInterfaces', 'frenchFriendsFull');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'bg.F(' + guard + ')');
        }
    }

    static crc32: JavaCrc32 | null = new JavaCrc32(); // ff.G:Ljava/util/zip/CRC32;
    // mc.o:Lnc;
    private requests = new HashTable<Js5Request>(16);
    // mc.s:Lej;
    private net: Js5NetQueue;
    // mc.t:I
    readonly indexCrc: number;
    // mc.x:I
    private verified = 0;
    // mc.A:Lca;
    private disk: Js5LocalCache;
    // mc.B:[B
    private status: Int8Array | null = null;
    // mc.F:Lcg;
    private indexStore: Js5DiskStore | null;
    // mc.G:Ldb;
    private reference: Js5Index | null = null;
    // mc.K:Ldf;
    private indexRequest: Js5Request | null = null;
    // mc.Q:Lcg;
    private groupStore: Js5DiskStore | null;
    // mc.R:I
    private archive: number;
    // mc.W:I
    readonly indexVersion: number;
    // mc.Y:I
    private scanGroup = 0;
    // mc.Z:Z
    private verifying: boolean;
    // mc.ab:Lgk;
    private scan: SharedPtrList | null = null;
    // mc.bb:Lgk;
    private prefetch = new SharedPtrList();
    // mc.cb:Z
    private prefetching = false;
    // mc.db:J
    private nextCleanup = 0n;
    // mc.eb:Z
    private discardOrphans: boolean;

    // mc.<init>(ILcg;Lcg;Lej;Lca;IIZ)V
    constructor(archive: number, groupStore: Js5DiskStore | null, indexStore: Js5DiskStore | null, net: Js5NetQueue, disk: Js5LocalCache, crc: number, version: number, discardOrphans: boolean) {
        super();
        this.groupStore = groupStore;
        this.archive = archive;
        if (this.groupStore !== null) {
            this.verifying = true;
            this.scan = new SharedPtrList();
        } else {
            this.verifying = false;
        }
        this.indexStore = indexStore;
        this.disk = disk;
        this.indexCrc = crc;
        this.discardOrphans = discardOrphans;
        this.indexVersion = version;
        this.net = net;
        if (this.indexStore !== null) this.indexRequest = this.disk.BlockingFetchFromMainThread(1, this.archive, this.indexStore);
    }

    // mc.b(B)I
    groupCount(): number {
        return this.reference === null ? 0 : this.reference.m_groupCount;
    }

    // mc.a(Z)I
    verifiedCount(): number {
        return this.verified;
    }

    // mc.e(I)I
    verificationPosition(): number {
        if (this.reference === null) return 0;
        if (!this.verifying) return this.reference.m_groupCount;
        const node = requireNonNull(this.scan).head();
        return node === null ? 0 : Number(BigInt.asIntN(32, node.key));
    }

    // mc.a(II)[B
    override group(mode: number, group: number): Uint8Array | null {
        const request = this.fetch(mode, group);
        if (request === null) return null;
        const data = request.getData();
        request.Unlink();
        return data;
    }

    // mc.b(II)V
    override prefetchGroup(group: number): void {
        if (this.groupStore !== null) {
            for (let node = this.prefetch.head(); node !== null; node = this.prefetch.next()) {
                if (BigInt(group) === node.key) return;
            }
            const node = new Linkable();
            node.key = BigInt(group);
            this.prefetch.push_back(node);
        }
    }

    // mc.a(III)Ldf;
    private fetch(mode: number, group: number): Js5Request | null {
        let request = this.requests.get(BigInt(group));
        if (request !== null && !(request instanceof Js5Request)) throw new TypeError('Expected Js5Request');
        if (request !== null && mode === 0 && !request.urgent && request.incomplete) {
            request.Unlink();
            request = null;
        }
        if (request === null) {
            if (mode !== 0) {
                if (mode !== 1) {
                    if (mode !== 2) throw new Error('Invalid JS5 request mode');
                    if (this.groupStore === null) throw new Error('Missing JS5 disk');
                    if (arrayAtI8(this.status, group) !== -1) throw new Error('Group is not missing from disk');
                    if (this.net.IsPrefetchQueueFull()) return null;
                    request = this.net.RequestData(2, group, this.archive, false);
                } else {
                    if (this.groupStore === null) throw new Error('Missing JS5 disk');
                    request = this.disk.EnqueueRequestFromMainThread(this.groupStore, group);
                }
            } else if (this.groupStore !== null && arrayAtI8(this.status, group) !== -1) {
                request = this.disk.BlockingFetchFromMainThread(1, group, this.groupStore);
            } else {
                if (this.net.IsUrgentQueueFull()) return null;
                request = this.net.RequestData(2, group, this.archive, true);
            }
            this.requests.put(request, BigInt(group));
        }
        if (request.incomplete) return null;
        const bytes = request.getData();
        if (request instanceof Js5DiskRequest) {
            // Stock catches its own exception for absent groups. On an empty browser
            // cache every verification miss can go straight to the same retry path.
            try {
                if (bytes !== null && bytes.length > 2) {
                    requireNonNull(Js5RemoteLoader.crc32).reset();
                    requireNonNull(Js5RemoteLoader.crc32).update(bytes, 0, (bytes.length - 2) | 0);
                    const crc = Number(requireNonNull(Js5RemoteLoader.crc32).getValue()) | 0;
                    if (crc !== arrayAtI32(requireNonNull(this.reference).groupCrcs, group)) throw new Error('JS5 group CRC');
                    const version = bytes[bytes.length - 1] + (bytes[bytes.length - 2] << 8);
                    if ((arrayAtI32(requireNonNull(this.reference).groupVersions, group) & 65535) !== version) throw new Error('JS5 group version');
                    if (arrayAtI8(this.status, group) !== 1) {
                        this.verified = (this.verified + 1) | 0;
                        arrayPutI8(this.status, group, 1);
                    }
                    if (!request.urgent) request.Unlink();
                    return request;
                }
            } catch (cause) {
                if (!(cause instanceof Error) || cause instanceof JavaError) throw cause;
            }
            arrayPutI8(this.status, group, -1);
            request.Unlink();
            if (request.urgent && !this.net.IsUrgentQueueFull()) {
                request = this.net.RequestData(2, group, this.archive, true);
                this.requests.put(request, BigInt(group));
            }
            return null;
        }
        try {
            if (bytes === null || bytes.length <= 2) throw new Error('Missing JS5 response');
            requireNonNull(Js5RemoteLoader.crc32).reset();
            requireNonNull(Js5RemoteLoader.crc32).update(bytes, 0, (bytes.length - 2) | 0);
            const crc = Number(requireNonNull(Js5RemoteLoader.crc32).getValue()) | 0;
            if (crc !== arrayAtI32(requireNonNull(this.reference).groupCrcs, group)) throw new Error('JS5 group CRC');
            this.net.errors = 0;
            this.net.response = 0;
        } catch (cause) {
            if (!(cause instanceof Error) || cause instanceof JavaError) throw cause;
            this.net.RecordCRCFailure();
            request.Unlink();
            if (request.urgent && !this.net.IsUrgentQueueFull()) {
                request = this.net.RequestData(2, group, this.archive, true);
                this.requests.put(request, BigInt(group));
            }
            return null;
        }
        bytes[bytes.length - 2] = arrayAtI32(requireNonNull(this.reference).groupVersions, group) >>> 8;
        bytes[bytes.length - 1] = arrayAtI32(requireNonNull(this.reference).groupVersions, group);
        if (this.groupStore !== null) {
            this.disk.ProvideDataFromNetThread(group, this.groupStore, bytes);
            if (arrayAtI8(this.status, group) !== 1) {
                this.verified = (this.verified + 1) | 0;
                arrayPutI8(this.status, group, 1);
            }
        }
        if (!request.urgent) request.Unlink();
        return request;
    }

    // mc.c(II)I
    override GetGroupLoadPercentage(group: number): number {
        const request = this.requests.get(BigInt(group));
        if (request !== null && !(request instanceof Js5Request)) throw new TypeError('Expected Js5Request');
        return request === null ? 0 : request.getPercentage();
    }

    // mc.c(B)V
    prefetchAll(): void {
        if (this.groupStore !== null) {
            this.prefetching = true;
            if (this.scan === null) this.scan = new SharedPtrList();
        }
    }

    // mc.h(I)I
    GetIndexPercentage(): number {
        if (this.index() === null) return this.indexRequest === null ? 0 : this.indexRequest.getPercentage();
        return 100;
    }

    // mc.b(I)Ldb;
    override index(): Js5Index | null {
        if (this.reference !== null) return this.reference;
        if (this.indexRequest === null) {
            if (this.net.IsUrgentQueueFull()) return null;
            this.indexRequest = this.net.RequestData(0, this.archive, 255, true);
        }
        if (this.indexRequest.incomplete) return null;
        const bytes = this.indexRequest.getData();
        if (this.indexRequest instanceof Js5DiskRequest) {
            try {
                if (bytes === null) throw new Error('Missing JS5 index');
                this.reference = new Js5Index(bytes, this.indexCrc);
                if (this.reference.m_indexVersion !== this.indexVersion) throw new Error('JS5 index version');
            } catch (cause) {
                if (!(cause instanceof Error) || cause instanceof JavaError) throw cause;
                this.reference = null;
                if (this.net.IsUrgentQueueFull()) {
                    this.indexRequest = null;
                    return null;
                }
                this.indexRequest = this.net.RequestData(0, this.archive, 255, true);
                return null;
            }
        } else {
            try {
                if (bytes === null) throw new Error('Missing JS5 index response');
                this.reference = new Js5Index(bytes, this.indexCrc);
            } catch (cause) {
                if (!(cause instanceof Error) || cause instanceof JavaError) throw cause;
                this.net.RecordCRCFailure();
                this.reference = null;
                if (this.net.IsUrgentQueueFull()) {
                    this.indexRequest = null;
                    return null;
                }
                this.indexRequest = this.net.RequestData(0, this.archive, 255, true);
                return null;
            }
            if (this.indexStore !== null) this.disk.ProvideDataFromNetThread(this.archive, this.indexStore, bytes);
        }
        this.indexRequest = null;
        if (this.groupStore !== null) {
            this.status = new Int8Array(this.reference.capacity);
            this.verified = 0;
        }
        return this.reference;
    }

    // mc.d(B)V
    processPrefetch(): void {
        if (this.scan !== null) {
            if (this.index() === null) return;
            for (let node = this.prefetch.head(); node !== null; node = this.prefetch.next()) {
                const group = Number(BigInt.asIntN(32, node.key));
                if (group < 0 || requireNonNull(this.reference).capacity <= group || arrayAtI32(requireNonNull(this.reference).fileCounts, group) === 0) {
                    node.Unlink();
                    continue;
                }
                if (arrayAtI8(this.status, group) === 0) this.fetch(1, group);
                if (arrayAtI8(this.status, group) === -1) this.fetch(2, group);
                if (arrayAtI8(this.status, group) === 1) node.Unlink();
            }
        }
    }

    // mc.g(I)V
    processQueue(): void {
        if (this.scan !== null) {
            if (this.index() === null) return;
            if (this.verifying) {
                let complete = true;
                for (let node = this.scan.head(); node !== null; node = this.scan.next()) {
                    const group = Number(BigInt.asIntN(32, node.key));
                    if (arrayAtI8(this.status, group) === 0) this.fetch(1, group);
                    if (arrayAtI8(this.status, group) === 0) complete = false;
                    else node.Unlink();
                }
                while (glJar ? requireNonNull(requireNonNull(this.reference).fileCounts).length > this.scanGroup : this.scanGroup < requireNonNull(requireNonNull(this.reference).fileCounts).length) {
                    if (arrayAtI32(requireNonNull(this.reference).fileCounts, this.scanGroup) === 0) {
                        this.scanGroup = (this.scanGroup + 1) | 0;
                        continue;
                    }
                    if (this.disk.pending >= 250) {
                        complete = false;
                        break;
                    }
                    if (arrayAtI8(this.status, this.scanGroup) === 0) this.fetch(1, this.scanGroup);
                    if (arrayAtI8(this.status, this.scanGroup) === 0) {
                        const node = new Linkable();
                        node.key = BigInt(this.scanGroup);
                        complete = false;
                        this.scan.push_back(node);
                    }
                    this.scanGroup = (this.scanGroup + 1) | 0;
                }
                if (complete) {
                    this.scanGroup = 0;
                    this.verifying = false;
                }
            } else if (this.prefetching) {
                let complete = true;
                for (let node = this.scan.head(); node !== null; node = this.scan.next()) {
                    const group = Number(BigInt.asIntN(32, node.key));
                    if (arrayAtI8(this.status, group) !== 1) this.fetch(2, group);
                    if (arrayAtI8(this.status, group) === 1) node.Unlink();
                    else complete = false;
                }
                while (requireNonNull(requireNonNull(this.reference).fileCounts).length > this.scanGroup) {
                    if (arrayAtI32(requireNonNull(this.reference).fileCounts, this.scanGroup) === 0) {
                        this.scanGroup = (this.scanGroup + 1) | 0;
                        continue;
                    }
                    if (this.net.IsPrefetchQueueFull()) {
                        complete = false;
                        break;
                    }
                    if (arrayAtI8(this.status, this.scanGroup) !== 1) this.fetch(2, this.scanGroup);
                    if (arrayAtI8(this.status, this.scanGroup) !== 1) {
                        complete = false;
                        const node = new Linkable();
                        node.key = BigInt(this.scanGroup);
                        this.scan.push_back(node);
                    }
                    this.scanGroup = (this.scanGroup + 1) | 0;
                }
                if (complete) {
                    this.prefetching = false;
                    this.scanGroup = 0;
                }
            } else {
                this.scan = null;
            }
        }
        if (this.discardOrphans && this.nextCleanup <= SafeTime.CurrentTimeMillis()) {
            for (let request = this.requests.head(); request !== null; request = this.requests.next()) {
                if (!(request instanceof Js5Request)) throw new TypeError('Expected Js5Request');
                if (!request.incomplete) {
                    if (request.orphan) {
                        if (!request.urgent) throw new Error('Orphaned JS5 prefetch');
                        request.Unlink();
                        continue;
                    }
                    request.orphan = true;
                }
            }
            this.nextCleanup = BigInt.asIntN(64, 1000n + SafeTime.CurrentTimeMillis());
        }
    }
}
