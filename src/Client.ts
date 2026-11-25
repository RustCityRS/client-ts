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

export class Client extends GameClient {
    constructor() {
        super();
        this.standaloneWorldMap = location.pathname === '/worldmap';
        const canvas = document.getElementById('canvas');
        if (!(canvas instanceof HTMLCanvasElement)) throw new TypeError('Missing 530 canvas');
        if (this.standaloneWorldMap) {
            document.title = 'RuneScape World Map';
            canvas.setAttribute('aria-label', document.title);
            GameClient.loadingStage = 10;
        }
        canvas.style.maxWidth = '100%';
        canvas.style.maxHeight = canvas.parentElement === document.body ? '100dvh' : '100%';
        const context = requireNonNull(canvas.getContext('2d', { desynchronized: false, alpha: false }));
        this.attachBrowser(canvas, context);
        this.signlinkHost.openSocket = () => openBrowserSocketHandle(location.host, 0, location.protocol === 'https:');
        this.ReadJavConfigParameters();
        GameClient.selectedWorldId = GameClient.m_worldId;
        Signlink.platform = 2;
        GameClient.activeClient = this;
        void this.StartApp(765, (GameClient.modewhat + 32) | 0, 530, 503);
    }

    override getSize(): { width: number; height: number } {
        return browserGameSize(super.getSize());
    }

    protected override async MainInit(): Promise<void> {
        // Browser adapter/device acquisition precedes the first Java game tick. The JOGL
        // factory can then make a context current without an asynchronous WebGPU request.
        const codecs = Promise.all([RawInflater.loadBrowserModule(), BzipOutputWasm.loadBrowserModule()]);
        let device: GpuDevice | null = null;
        try {
            if (glJar && !this.standaloneWorldMap) device = await GpuDevice.acquire();
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
        // Majula uses local-world routing, which enables the gamepack's FPS overlay at startup.
        GameClient.displayFps = false;
    }
}
