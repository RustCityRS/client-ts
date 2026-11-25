import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import { requireNonNull } from '#/util/JavaArray';
import SecondaryLinkedList from '#/datastruct/SecondaryLinkedList';
import { JavaError, reportClientError } from '#/util/ClientError';
import DataFile from './DataFile';
import GameShell from '#/client/GameShell';
import { SignlinkThread } from '#/util/Signlink';
import ThreadUtils from '#/util/ThreadUtils';
import Js5DiskRequest, { type Js5DiskStore } from './Js5DiskRequest';
import LocalisedTextClass from '#/ui/LocalisedText';
import { loadWorld } from '#/util/GamepackClasses';

// Object.wait and Object.notifyAll on ca.o. Each browser waiter resumes after the current task releases the queue.
const queueWaiters = new WeakMap<SecondaryLinkedList<Js5DiskRequest>, (() => void)[]>();

function waitForQueue(queue: SecondaryLinkedList<Js5DiskRequest>): Promise<void> {
    return new Promise(resolve => {
        const waiting = queueWaiters.get(queue);
        if (waiting === undefined) queueWaiters.set(queue, [resolve]);
        else waiting.push(resolve);
    });
}

function notifyQueue(queue: SecondaryLinkedList<Js5DiskRequest>): void {
    const waiting = queueWaiters.get(queue);
    if (waiting === undefined) return;
    queueWaiters.delete(queue);
    for (const resume of waiting) resume();
}

export default class Js5LocalCache {
    // HD k.b(I)V
    static releaseHdStatics(guard: number): void {
        try {
            const LocalisedText = LocalisedTextClass;
            releaseReferences(LocalisedText, 'frenchLoadingSprites');
            if (guard !== -16222) {
                return;
            }
            releaseReferences(LocalisedText, 'frenchChatcol9');
            const world = loadWorld();
            releaseReferences(world, 'roofMinX');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'k.I(' + guard + ')');
        }
    }

    // ca.o:Ltb;
    private queue = new SecondaryLinkedList<Js5DiskRequest>();
    // ca.p:Z
    private stopping = false;
    // ca.q:Ljava/lang/Thread;
    private worker: SignlinkThread | null = null;
    // ca.s:I
    pending = 0;

    private constructor() {}

    // ca.<init>()V. The browser yields while the Signlink worker publishes dj.b.
    static async create(): Promise<Js5LocalCache> {
        const cache = new Js5LocalCache();
        const request = requireNonNull(GameShell.signlink).startThread(cache, 5);
        while (request.status === 0) await ThreadUtils.sleep(10n);
        if (request.status === 2) throw new Error('JS5 disk thread could not start');
        const worker = request.result;
        if (worker !== null && !(worker instanceof SignlinkThread)) throw new TypeError('Expected java.lang.Thread');
        cache.worker = worker;
        return cache;
    }

    // ca.a(Z)V
    async EndAndJoin(): Promise<void> {
        this.stopping = true;
        notifyQueue(requireNonNull(this.queue));
        await requireNonNull(this.worker).join();
        this.worker = null;
    }

    // ca.a(IILcg;)Lqc;
    BlockingFetchFromMainThread(type: number, group: number, store: Js5DiskStore): Js5DiskRequest {
        const request = new Js5DiskRequest();
        request.type = type;
        let queued = this.queue.head();
        while (queued !== null) {
            if (queued.secondaryKey === BigInt(group) && store === queued.store && queued.type === 2) {
                request.incomplete = false;
                request.data = queued.data;
                return request;
            }
            queued = this.queue.next();
        }
        const result = store instanceof DataFile ? store.read(0xff00, group) : store.read(group);
        if (result instanceof Promise) {
            // IndexedDB has no synchronous read. Publish the same urgent request
            // to mc and complete it when the browser delivers the disk bytes.
            request.urgent = true;
            void result
                .then(
                    data => {
                        request.data = data;
                    },
                    () => {
                        request.data = null;
                    }
                )
                .then(() => {
                    request.incomplete = false;
                });
            return request;
        }
        request.data = result;
        request.urgent = true;
        request.incomplete = false;
        return request;
    }

    // ca.a(Lcg;II)Lqc;
    EnqueueRequestFromMainThread(store: Js5DiskStore, group: number): Js5DiskRequest {
        const request = new Js5DiskRequest();
        request.store = store;
        request.urgent = false;
        request.secondaryKey = BigInt(group);
        request.type = 3;
        this.QueueToWorker(request);
        return request;
    }

    // ca.a(ILqc;)V
    private QueueToWorker(request: Js5DiskRequest): void {
        this.queue.addTail(request);
        this.pending = (this.pending + 1) | 0;
        notifyQueue(requireNonNull(this.queue));
    }

    // ca.run()V
    async run(): Promise<void> {
        while (!this.stopping) {
            const request = this.queue.removeHead();
            if (request === null) {
                await waitForQueue(this.queue);
                continue;
            }
            this.pending = (this.pending - 1) | 0;
            try {
                if (request.type === 2) {
                    const data = requireNonNull(request.data);
                    const store = requireNonNull(request.store);
                    const group = Number(BigInt.asIntN(32, request.secondaryKey));
                    if (store instanceof DataFile) store.write(data.length, group, data);
                    else await store.write(group, data);
                } else if (request.type === 3) {
                    const store = requireNonNull(request.store);
                    const group = Number(BigInt.asIntN(32, request.secondaryKey));
                    request.data = store instanceof DataFile ? store.read(0xff00, group) : await store.read(group);
                }
            } catch (error) {
                if (!(error instanceof Error) || error instanceof JavaError) throw error;
                await reportClientError(error, null);
            }
            request.incomplete = false;
        }
    }

    // ca.a(ILcg;I[B)Lqc;
    ProvideDataFromNetThread(group: number, store: Js5DiskStore, data: Uint8Array): Js5DiskRequest {
        const request = new Js5DiskRequest();
        request.urgent = false;
        request.store = store;
        request.secondaryKey = BigInt(group);
        request.type = 2;
        request.data = data;
        this.QueueToWorker(request);
        return request;
    }
}
