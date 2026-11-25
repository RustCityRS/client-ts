import File, { FileIoError } from '#/io/File';
import { glJar } from '#/client/ClientVariant';
import type { FullscreenHost } from '#/client/StandaloneFrame';
import { WebGpuDrawableFactory } from '#/gl/driver/WebGpuDrawableFactory';
import GLDrawableFactory from '#/jogl/GLDrawableFactory';
import SafeTime from '#/io/SafeTime';
import type { SocketHandle } from '#/io/SocketPlatform';
import type NativeAudioDevice from '#/sound/NativeAudioDevice';
import { requireNonNull } from './JavaArray';
import SignlinkRequest from './SignlinkRequest';
import ThreadUtils from './ThreadUtils';

// Browser shutdown can cancel a socket owner while the native open is pending.
// Notifications live outside dj and run after fb publishes a terminal status.
const requestCallbacks = new WeakMap<SignlinkRequest, Set<() => void>>();
export function onSignlinkRequestSettled(request: SignlinkRequest, callback: () => void): void {
    if (request.status !== 0) {
        queueMicrotask(callback);
        return;
    }
    let callbacks = requestCallbacks.get(request);
    if (!callbacks) {
        callbacks = new Set();
        requestCallbacks.set(request, callbacks);
    }
    callbacks.add(callback);
}

export interface SignlinkRunnable {
    run(): void | Promise<void>;
}

// java.lang.Thread. Starting and joining a Runnable use the browser task queue.
export class SignlinkThread {
    readonly daemon = true;
    priority = 5;
    private readonly completion: Promise<void>;
    constructor(runnable: SignlinkRunnable | null) {
        this.completion = Promise.resolve()
            .then(() => runnable?.run())
            .catch(error => console.error(error));
    }
    join(): Promise<void> {
        return this.completion;
    }
}

export interface SignlinkEventQueue {
    peekEvent(): unknown;
    postEvent(event: { source: object; id: number; command: string }): void;
}

export interface SignlinkClass {
    getDeclaredMethod(name: string, parameters: readonly SignlinkClass[] | null): unknown;
    getDeclaredField(name: string): unknown;
}

export interface SignlinkInput {
    read(): Promise<number>;
    close(): Promise<void>;
}

export interface SignlinkHost {
    fullscreen?: FullscreenHost;
    openSocket?(host: string, port: number): Promise<SocketHandle>;
    openUrl?(url: URL): Promise<SignlinkInput>;
    property?(key: string): string | null;
    eventQueue?: SignlinkEventQueue | null;
    focusMethod?(applet: object | null, name: string): unknown;
    audioDevice?: NativeAudioDevice | null;
}

// Browser tasks deliver the AWT ActionEvent posted by qj.a. Pointer and key
// events are dispatched by the user agent before control returns to game code.
function browserEventQueue(): SignlinkEventQueue | null {
    if (typeof window === 'undefined') return null;
    const pending: { source: object; id: number; command: string }[] = [];
    return {
        peekEvent() {
            return pending[0] ?? null;
        },
        postEvent(event) {
            pending.push(event);
            setTimeout(() => {
                const next = pending.shift();
                if (next?.source instanceof EventTarget) next.source.dispatchEvent(new CustomEvent('action', { detail: next }));
            }, 0);
        }
    };
}

// Component.getDeclaredMethod / Applet.getMethod at the browser AWT boundary.
function focusMethod(_applet: object | null, name: string) {
    return {
        name,
        invoke(surface: object, enabled: boolean) {
            const method = Reflect.get(surface, name);
            if (typeof method === 'function') Reflect.apply(method, surface, [enabled]);
        }
    };
}

function systemProperty(key: string): string | null {
    const browser = globalThis.navigator;
    switch (key) {
        case 'java.vendor':
            return browser?.vendor ?? 'Unknown';
        case 'java.version':
            return browser?.userAgent ?? '1.1';
        case 'os.name':
            return browser?.platform ?? 'Unknown';
        default:
            return null;
    }
}

// java.net.URL.openStream and java.io.DataInputStream.read()/close().
async function openUrl(url: URL): Promise<SignlinkInput> {
    const response = await fetch(url);
    if (!response.ok) throw new Error('URL stream returned ' + response.status);
    const reader = requireNonNull(response.body).getReader();
    let chunk: Uint8Array | null = null,
        position = 0;
    return {
        async read() {
            while (chunk === null || position === chunk.length) {
                const next = await reader.read();
                if (next.done) return -1;
                chunk = next.value;
                position = 0;
            }
            return chunk[position++];
        },
        async close() {
            await reader.cancel();
        }
    };
}

// fb. The SD applet implements request types 1, 2, 4, 8 and 9.
export default class Signlink {
    // fb.a:Ljava/lang/Thread;
    private readonly worker: SignlinkThread;
    // fb.b:[Lne;
    cacheIndexes: (File | null)[] | null = null;
    // fb.c:Ldj;
    private head: SignlinkRequest | null = null;
    // fb.d:Lk;
    private readonly audioDevice: NativeAudioDevice | null;
    // fb.e:Ljava/awt/EventQueue;
    eventQueue: SignlinkEventQueue | null = null;
    // fb.f:I
    static platform = 3;
    // fb.g:Ljava/lang/String;
    static osVersion: string | null = null;
    // fb.h:Lne;
    randomFile: File | null = null;
    // fb.i:Ljava/lang/String;
    static homeDir: string | null = null;
    // fb.j:Ldj;
    private tail: SignlinkRequest | null = null;
    // fb.k:Ljava/lang/String;
    static javaVersion: string | null = null;
    // fb.l:Ljava/lang/String;
    static osNameLower: string | null = null;
    // fb.m:Lne;
    masterIndex: File | null = null;
    // fb.n:Ljava/lang/String;
    static osArch: string | null = null;
    // fb.o:Ljava/applet/Applet;
    readonly applet: object | null;
    // fb.p:Ljava/lang/String;
    static javaVendor: string | null = null;
    // fb.q:Z
    private stop = false;
    // fb.r:Ljava/lang/String;
    static osName: string | null = null;
    // fb.s:Ljava/lang/reflect/Method;
    static setFocusTraversalKeysEnabled: unknown = null;
    // fb.t:Lne;
    cacheData: File | null = null;
    // fb.u:J
    static connectBlockedUntil = 0n;
    // fb.v:Ljava/lang/reflect/Method;
    static setFocusCycleRoot: unknown = null;

    // JS equivalent of the fb worker's wait/notify monitor.
    private wake: (() => void) | null = null;

    // fb.<init>(Ljava/applet/Applet;ILjava/lang/String;I)V
    constructor(
        applet: object | null = null,
        private readonly host: SignlinkHost = {}
    ) {
        this.applet = applet;
        this.audioDevice = host.audioDevice ?? null;
        const property = host.property ?? systemProperty;
        Signlink.javaVendor = 'Unknown';
        Signlink.javaVersion = '1.1';
        try {
            Signlink.javaVendor = property('java.vendor');
            Signlink.javaVersion = property('java.version');
        } catch {
            // The original client ignores failures from this host operation.
        }
        try {
            Signlink.osName = property('os.name');
        } catch {
            Signlink.osName = 'Unknown';
        }
        Signlink.osNameLower = requireNonNull(Signlink.osName).toLowerCase();
        try {
            Signlink.osArch = requireNonNull(property('os.arch')).toLowerCase();
        } catch {
            Signlink.osArch = '';
        }
        try {
            Signlink.osVersion = requireNonNull(property('os.version')).toLowerCase();
        } catch {
            Signlink.osVersion = '';
        }
        try {
            Signlink.homeDir = property('user.home');
            if (Signlink.homeDir !== null) Signlink.homeDir += '/';
        } catch {
            // The original client ignores failures from this host operation.
        }
        if (Signlink.homeDir === null) Signlink.homeDir = '~/';
        try {
            this.eventQueue = host.eventQueue === undefined ? browserEventQueue() : host.eventQueue;
        } catch {
            // The original client ignores failures from this host operation.
        }
        try {
            Signlink.setFocusTraversalKeysEnabled = (host.focusMethod ?? focusMethod)(applet, 'setFocusTraversalKeysEnabled');
        } catch {
            // The original client ignores failures from this host operation.
        }
        try {
            Signlink.setFocusCycleRoot = (host.focusMethod ?? focusMethod)(applet, 'setFocusCycleRoot');
        } catch {
            // The original client ignores failures from this host operation.
        }
        this.worker = new SignlinkThread(this);
        this.worker.priority = 10;
    }

    // fb.a(ILjava/lang/Object;III)Ldj;
    private enqueue<T>(intArg: number, objectArg: unknown, type: number): SignlinkRequest<T> {
        const r = new SignlinkRequest<T>();
        r.intArg = intArg;
        r.objectArg = objectArg;
        r.type = type;
        if (this.tail !== null) {
            this.tail.next = r;
            this.tail = r;
        } else this.tail = this.head = r;
        this.wake?.();
        return r;
    }
    // fb.a(ILjava/net/URL;)Ldj;
    openUrl(url: URL): SignlinkRequest<SignlinkInput> {
        return this.enqueue(0, url, 4);
    }
    // HD ll.a(Z)Z. The signed loader supplies the fullscreen peer.
    supportsFullscreen(): boolean {
        return this.host?.fullscreen !== undefined;
    }
    // HD ll.a(B)Lim;
    getDisplayModes(): SignlinkRequest {
        return this.enqueue(0, null, 5);
    }
    // HD ll.a(IIIII)Lim;. Only the signed loader's im has a second int for refresh/depth.
    enterFullscreen(_refresh: number, _depth: number, height: number, width: number): SignlinkRequest {
        return this.enqueue(((width << 16) + height) | 0, null, 6);
    }
    // HD ll.a(ILjava/lang/Class;)Lim;
    loadGlLibrary(clientClass: object): SignlinkRequest {
        return this.enqueue(0, clientClass, 10);
    }
    // HD ll.a(Ljava/lang/Class;I)Lim;
    releaseGlLibrary(clientClass: object): SignlinkRequest {
        return this.enqueue(0, clientClass, 11);
    }
    // HD ll.a(Ljava/awt/Frame;I)Lim;
    exitFullscreen(frame: object | null): SignlinkRequest {
        return this.enqueue(0, frame, 7);
    }
    // fb.a(IBILjava/awt/Component;[ILjava/awt/Point;)Ldj;
    setCursor(width: number, _height: number, component: object | null, pixels: Int32Array | null, hotspot: { x: number; y: number } | null): SignlinkRequest {
        return this.enqueue(width, [component, pixels, hotspot], 17);
    }
    // fb.a(Ljava/lang/String;Z)Ldj;
    openPreferences(name: string): SignlinkRequest {
        return this.enqueue(0, name, 12);
    }
    // fb.a([Ljava/lang/Class;ILjava/lang/String;Ljava/lang/Class;)Ldj;
    getDeclaredMethod(owner: SignlinkClass, name: string, parameters: readonly SignlinkClass[] | null): SignlinkRequest {
        return this.enqueue(0, [owner, name, parameters], 8);
    }
    // fb.a(Ljava/awt/Component;ZZ)Ldj;
    showCursor(component: object | null, show: boolean): SignlinkRequest {
        return this.enqueue(show ? 1 : 0, component, 15);
    }
    // fb.a(Ljava/lang/Class;Ljava/lang/String;I)Ldj;
    getDeclaredField(owner: SignlinkClass, name: string): SignlinkRequest {
        return this.enqueue(0, [owner, name], 9);
    }
    // fb.a(Z)V
    breakConnection(): void {
        Signlink.connectBlockedUntil = BigInt.asIntN(64, SafeTime.CurrentTimeMillis() + 5000n);
    }
    // fb.a(IZLjava/lang/String;)Ldj;
    openSocket(host: string | null, port: number): SignlinkRequest<SocketHandle> {
        return this.enqueue(port, host, 1);
    }
    // fb.a(ILjava/lang/Runnable;I)Ldj;
    startThread(runnable: SignlinkRunnable | null, priority: number): SignlinkRequest<SignlinkThread> {
        return this.enqueue(priority, runnable, 2);
    }
    // fb.a(Ljava/lang/String;B)Ldj;
    openUrlExternally(url: string): SignlinkRequest {
        return this.enqueue(0, url, 16);
    }
    // fb.b(I)Lk;
    getAudioDevice(): NativeAudioDevice | null {
        return this.audioDevice;
    }
    // fb.a(BI)Ldj;
    reverseDns(address: number): SignlinkRequest<string> {
        return this.enqueue(address, null, 3);
    }
    // fb.a(IZILjava/awt/Component;)Ldj;
    moveMouse(x: number, _z: number, component: { getLocationOnScreen(): { x: number; y: number } }): SignlinkRequest {
        const point = component.getLocationOnScreen();
        return this.enqueue((x + point.x) | 0, null, 14);
    }
    // fb.run()V
    async run(): Promise<void> {
        while (!this.stop) {
            const r = this.head;
            if (r === null) {
                await new Promise<void>(resolve => {
                    this.wake = resolve;
                });
                this.wake = null;
                continue;
            }
            this.head = r.next;
            if (this.head === null) this.tail = null;
            try {
                switch (r.type) {
                    case 1:
                        if (SafeTime.CurrentTimeMillis() < Signlink.connectBlockedUntil) throw new Error('Connection blocked');
                        // InetAddress.getByName(null) and getByName("") return the loopback address.
                        r.result = await requireNonNull(this.host.openSocket)((r.objectArg as string | null) || '127.0.0.1', r.intArg);
                        break;
                    case 2: {
                        const thread = new SignlinkThread(r.objectArg as SignlinkRunnable | null);
                        if (r.intArg < 1 || r.intArg > 10) throw new RangeError('Thread priority ' + r.intArg);
                        thread.priority = r.intArg;
                        r.result = thread;
                        break;
                    }
                    case 4:
                        if (SafeTime.CurrentTimeMillis() < Signlink.connectBlockedUntil) throw new Error('Connection blocked');
                        r.result = await (this.host.openUrl ?? openUrl)(r.objectArg as URL);
                        break;
                    case 5:
                        r.result = requireNonNull(this.host.fullscreen).getDisplayModes();
                        break;
                    case 6:
                        r.result = await requireNonNull(this.host.fullscreen).enter(r.intArg >>> 16, r.intArg & 0xffff);
                        break;
                    case 7:
                        await requireNonNull(this.host.fullscreen).exit();
                        break;
                    case 8: {
                        const [owner, name, parameters] = r.objectArg as [SignlinkClass, string, SignlinkClass[] | null];
                        r.result = owner.getDeclaredMethod(name, parameters);
                        break;
                    }
                    case 9: {
                        const [owner, name] = r.objectArg as [SignlinkClass, string];
                        r.result = owner.getDeclaredField(name);
                        break;
                    }
                    case 10: {
                        // The signed loader loads JOGL's native libraries for this class. The browser has a
                        // usable platform when its registered drawable factory owns a live WebGPU device.
                        if (!glJar) throw new Error('Unavailable request type 10');
                        const factory = GLDrawableFactory.getFactory();
                        if (!(factory instanceof WebGpuDrawableFactory) || factory.device()?.lost !== false) {
                            throw new Error('WebGPU device unavailable');
                        }
                        break;
                    }
                    case 11:
                        if (!glJar) throw new Error('Unavailable request type 11');
                        // The signed Java loader unloads native libraries here. WebGPU resources are
                        // released by GlRenderer.shutdown. Complete the queued request in order.
                        break;
                    default:
                        throw new Error('Unavailable request type ' + r.type);
                }
                r.status = 1;
            } catch {
                r.status = 2;
            }
            const callbacks = requestCallbacks.get(r);
            if (callbacks) {
                requestCallbacks.delete(r);
                for (const callback of callbacks) queueMicrotask(callback);
            }
        }
        for (let r = this.head; r !== null; r = r.next) requestCallbacks.delete(r);
    }
    // fb.a(I)V
    async stopWorker(): Promise<void> {
        this.stop = true;
        this.wake?.();
        await this.worker.join();
        const close = (f: File | null) => {
            try {
                f?.close();
            } catch (error) {
                if (!(error instanceof FileIoError)) throw error;
            }
        };
        close(this.cacheData);
        close(this.masterIndex);
        if (this.cacheIndexes !== null) for (const file of this.cacheIndexes) close(file);
        close(this.randomFile);
    }
    // qj.a(ILjava/lang/Object;Lfb;)V
    static async flushEvents(source: object | null, signlink: Signlink): Promise<void> {
        const queue = signlink.eventQueue;
        if (queue === null) return;
        for (let i = 0; i < 50 && queue.peekEvent() != null; i++) await ThreadUtils.sleep(1n);
        if (source !== null) queue.postEvent({ source, id: 1001, command: 'dummy' });
    }
}
