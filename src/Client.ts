import { glJar } from '#/client/ClientVariant';
import RawInflater from '#/cache/RawInflater';
import BzipOutputWasm from '#/cache/BzipOutputWasm';
import GameClient from '#/client/Client';
import { browserGameSize } from '#/client/StandaloneFrame';
import { openBrowserSocketHandle } from '#/io/BrowserSocket';
import Signlink from '#/util/Signlink';
import { requireNonNull } from '#/util/JavaArray';
import GpuDevice from '#/gl/driver/GpuDevice';
import { registerWebGpuDrawableFactory, webGpuCapsProfile } from '#/gl/driver/WebGpuDrawableFactory';

declare const RS530_DEV_LAUNCHER: boolean;
const development = typeof RS530_DEV_LAUNCHER !== 'undefined' && RS530_DEV_LAUNCHER;

export class Client extends GameClient {
    private readonly parameters = new URLSearchParams(location.search);

    constructor(nodeId: number, _lowmem: boolean | number, _members: boolean) {
        super();
        const canvas = document.getElementById('canvas');
        if (!(canvas instanceof HTMLCanvasElement)) throw new TypeError('Missing 530 canvas');
        canvas.style.maxWidth = '100%';
        canvas.style.maxHeight = canvas.parentElement === document.body ? '100dvh' : '100%';
        const context = requireNonNull(canvas.getContext('2d', { desynchronized: false, alpha: false }));
        this.attachBrowser(canvas, context);
        this.signlinkHost.openSocket = () => openBrowserSocketHandle(location.host, 0, location.protocol === 'https:');
        if (['worldid', 'modewhere', 'modewhat'].some(name => this.parameters.has(name))) {
            if (!development) this.parameters.set('modewhat', '0');
            void this.init();
        } else {
            this.parameters.set('worldid', String((nodeId - 9) | 0));
            this.parameters.set('modewhere', '1');
            this.parameters.set('modewhat', development ? '2' : '0');
            this.ReadJavConfigParameters();
            GameClient.modeWhere = 2;
            GameClient.selectedWorldId = GameClient.m_worldId;
            Signlink.platform = 2;
            GameClient.activeClient = this;
            void this.StartApp(765, (GameClient.modewhat + 32) | 0, 530, 503);
        }
    }

    override getSize(): { width: number; height: number } {
        return browserGameSize(super.getSize());
    }

    protected override appletParameter(name: string): string | null {
        return this.parameters.get(name);
    }

    protected override async MainInit(): Promise<void> {
        // Browser adapter/device acquisition precedes the first Java game tick. The JOGL
        // factory can then make a context current without an asynchronous WebGPU request.
        const codecs = Promise.all([RawInflater.loadBrowserModule(), BzipOutputWasm.loadBrowserModule()]);
        let device: GpuDevice | null = null;
        try {
            if (glJar) device = await GpuDevice.acquire();
        } catch {
            // Browsers may reject requestAdapter or requestDevice even when navigator.gpu exists.
        }
        await codecs;
        if (this.closed) return;
        if (device !== null) {
            registerWebGpuDrawableFactory(webGpuCapsProfile(device.device.limits), { device });
            this.attachSdDevice(device);
        }
        // Offer resizable HD with 4x AA on first launch. The gamepack decodes saved settings over these defaults.
        await super.MainInit(device !== null);
    }
}
