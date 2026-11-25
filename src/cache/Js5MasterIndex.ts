import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import type Js5NetQueue from '#/io/Js5NetQueue';
import type Js5NetQueueRequest from '#/io/Js5NetQueueRequest';
import PacketT from '#/io/PacketT';
import { arrayAtObj, arrayPutObj, requireNonNull } from '#/util/JavaArray';
import Js5RemoteLoader from './Js5RemoteLoader';
import type Js5LocalCache from './Js5LocalCache';
import type { Js5DiskStore } from './Js5DiskRequest';
import { loadBrowserControl, loadInvType } from '#/util/GamepackClasses';

export default class Js5MasterIndex {
    // HD al.a(I)V
    static releaseHdStatics(guard: number): void {
        try {
            const InvType = loadInvType();
            releaseReferences(InvType, 'm_pConfigClient');
            if (guard > -10) {
                // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD na stays deferred until al.a(I)V in Js5MasterIndex.releaseHdStatics.
                const TextureShapeLine = (require('#/dash3d/TextureShapeLine') as typeof import('#/dash3d/TextureShapeLine')).default;
                TextureShapeLine.decode(null, -80);
            }
            const BrowserControl = loadBrowserControl();
            releaseReferences(BrowserControl, 'showVideoAd');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'al.I(' + guard + ')');
        }
    }

    // wi.h:Lca;
    private disk: Js5LocalCache;
    // wi.j:[Lmc;
    private providers: (Js5RemoteLoader | null)[] | null = null;
    // wi.l:Lfd;
    private request: Js5NetQueueRequest | null = null;
    // wi.n:Lgd;
    private packet: PacketT | null = null;
    // wi.o:Lej;
    private net: Js5NetQueue;

    // wi.<init>(Lej;Lca;)V
    constructor(net: Js5NetQueue, disk: Js5LocalCache) {
        this.disk = disk;
        this.net = net;
        if (!this.net.IsUrgentQueueFull()) this.request = this.net.RequestData(0, 255, 255, true);
    }

    // wi.a(ZILcg;Lcg;)Lmc;
    getProvider(archive: number, indexStore: Js5DiskStore | null, groupStore: Js5DiskStore | null): Js5RemoteLoader {
        return this.createProvider(indexStore, groupStore, 8, archive, true);
    }

    // wi.a(Z)V
    tick(): void {
        if (this.providers !== null) {
            for (let i = 0; i < requireNonNull(this.providers).length; i++) {
                if (arrayAtObj(this.providers, i) !== null) requireNonNull(arrayAtObj(this.providers, i)).processPrefetch();
            }
            for (let i = 0; requireNonNull(this.providers).length > i; i++) {
                if (arrayAtObj(this.providers, i) !== null) requireNonNull(arrayAtObj(this.providers, i)).processQueue();
            }
        }
    }

    // wi.b(I)Z
    load(): boolean {
        if (this.packet !== null) return true;
        if (this.request === null) {
            if (this.net.IsUrgentQueueFull()) return false;
            this.request = this.net.RequestData(0, 255, 255, true);
        }
        if (this.request.incomplete) return false;
        this.packet = new PacketT(this.request.getData());
        this.providers = new Array(((requireNonNull(this.packet.m_data).length - 5) / 8) | 0).fill(null);
        return true;
    }

    // wi.a(Lcg;Lcg;IIZ)Lmc;
    private createProvider(indexStore: Js5DiskStore | null, groupStore: Js5DiskStore | null, stride: number, archive: number, discardOrphans: boolean): Js5RemoteLoader {
        if (this.packet === null) throw new Error('JS5 master index is unavailable');
        this.packet.m_pos = (5 + Math.imul(archive, stride)) | 0;
        if (requireNonNull(this.packet.m_data).length <= this.packet.m_pos) throw new Error('JS5 master index entry is unavailable');
        const current = arrayAtObj(this.providers, archive);
        if (current !== null) return current;
        const crc = this.packet.g4();
        const version = this.packet.g4();
        const provider = new Js5RemoteLoader(archive, groupStore, indexStore, this.net, this.disk, crc, version, discardOrphans);
        arrayPutObj(this.providers, archive, provider);
        return provider;
    }
}
