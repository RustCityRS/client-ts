import type GameShell from './GameShell';
import type { ShellFrame } from './GameShell';

export interface StandaloneFrame extends ShellFrame {
    readonly canvas?: HTMLCanvasElement;
    setTitle(title: string): void;
    setResizable(value: boolean): void;
    addWindowListener(listener: GameShell): void;
    setVisible(value: boolean): void;
    toFront(): void;
    setSize(width: number, height: number): void;
    setLocation(x: number, y: number): void;
}

export interface StandaloneHost {
    createFrame(): StandaloneFrame;
    exit(status: number): void;
}

export interface FullscreenHost {
    getDisplayModes(): Int32Array;
    enter(width: number, height: number): Promise<ShellFrame & { setVisible(value: boolean): void; dispose(): void }>;
    exit(): Promise<void>;
}

// Use the screen's pixel density to fit the applet in a narrow viewport without distorting the scene.
export function browserGameSize(size: { width: number; height: number }): { width: number; height: number } {
    if (size.width >= 765 && size.height >= 503) return size;
    const fit = Math.max(765 / Math.max(1, size.width), 503 / Math.max(1, size.height));
    const scale = Math.min(fit, Math.max(1, globalThis.devicePixelRatio || 1));
    size.width = Math.max(765, Math.round(size.width * scale));
    size.height = Math.max(503, Math.round(size.height * scale));
    return size;
}

export function browserFullscreenHost(doc: Document): FullscreenHost | undefined {
    if (!doc?.fullscreenEnabled) return undefined;
    const root = doc.documentElement;
    const view = doc.defaultView;
    if (!view?.screen || typeof root.requestFullscreen !== 'function') return undefined;
    return {
        getDisplayModes() {
            // A phone's CSS-pixel screen can fall below the game's 800x600 mode filter.
            // Its device pixels provide a fullscreen drawable at the reported resolution.
            const { width, height, colorDepth } = view.screen;
            const scale = width < 800 || height < 600 ? Math.max(1, view.devicePixelRatio) : 1;
            return Int32Array.of(Math.round(width * scale), Math.round(height * scale), colorDepth, 0);
        },
        async enter(width, height) {
            // The input and WebGPU canvases are siblings and can both be replaced during a mode change.
            await root.requestFullscreen({ navigationUI: 'hide' });
            return {
                getSize: () => ({ width, height }),
                getInsets: () => ({ left: 0, right: 0, top: 0, bottom: 0 }),
                isVisible: () => doc.fullscreenElement === root,
                setVisible() {},
                dispose() {}
            };
        },
        async exit() {
            if (doc.fullscreenElement === root) await doc.exitFullscreen();
        }
    };
}

// A browser window exposes its content rectangle. Its decorations and permission to
// resize, move, focus or close the window are controlled by the browser.
export const browserStandaloneHost: StandaloneHost = {
    createFrame() {
        const canvas = document.getElementById('canvas') ?? document.body.appendChild(document.createElement('canvas'));
        if (!(canvas instanceof HTMLCanvasElement)) throw new TypeError('Expected standalone canvas');
        return {
            canvas,
            setTitle(title) {
                document.title = title;
            },
            setResizable() {},
            addWindowListener(listener) {
                window.addEventListener(
                    'pagehide',
                    () => {
                        void listener.windowClosing();
                    },
                    { once: true }
                );
            },
            setVisible(value) {
                canvas.hidden = !value;
            },
            toFront() {
                window.focus();
            },
            getInsets() {
                return { left: 0, right: 0, top: 0, bottom: 0 };
            },
            getSize() {
                return browserGameSize({ width: window.innerWidth, height: window.innerHeight });
            },
            setSize(width, height) {
                window.resizeTo(width + window.outerWidth - window.innerWidth, height + window.outerHeight - window.innerHeight);
            },
            setLocation(x, y) {
                window.moveTo(x, y);
            }
        };
    },
    exit() {
        globalThis.window?.close();
    }
};
