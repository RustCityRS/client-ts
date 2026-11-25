import Client from '#/client/Client.js';
import GameShell from '#/client/GameShell.js';
import BufferedImagePixMap from '#/graphics/BufferedImagePixMap.js';

// AWT canvas, input surfaces and framebuffer supplied by p.run before the client.b startup hook.
export function attachMainInitHost(client: Client, event: (name: string) => void = () => {}): void {
    const surface = {
        addKeyListener() {
            event('key');
        },
        removeKeyListener() {},
        addMouseListener() {
            event('mouse');
        },
        removeMouseListener() {},
        addFocusListener() {
            event('focus');
        },
        removeFocusListener() {},
        addMouseMotionListener() {
            event('motion');
        },
        removeMouseMotionListener() {},
        setFocusTraversalKeysEnabled() {},
        addMouseWheelListener() {
            event('wheel');
        },
        removeMouseWheelListener() {}
    };
    const canvas = { width: 1, height: 1, style: {} };
    GameShell.canvas = canvas;
    Object.assign(client, { host: { canvas, mouseSurface: surface, keyboardSurface: surface } });
    Client.activeClient = client;
    GameShell.drawArea = Object.assign(new BufferedImagePixMap(), { pixels: new Int32Array(1), width: 1, height: 1 });
}
