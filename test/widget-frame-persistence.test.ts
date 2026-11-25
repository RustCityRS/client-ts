import { expect } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import GameShell from '#/client/GameShell.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import BufferedImagePixMap from '#/graphics/BufferedImagePixMap.js';
import { CanvasComponent, type CanvasSurface } from '#/graphics/PixScreen.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { loginFixture } from './login-fixture.js';
import { gamepackPath } from './reference.js';

const width = 23,
    height = 17;

function pixelBytes(pixels: Int32Array): string {
    const bytes = Buffer.alloc(width * height * 4);
    for (let i = 0; i < width * height; i++) bytes.writeUInt32BE(pixels[i] & 0xffffff, i * 4);
    return bytes.toString('base64');
}

function drawFrames(): string[] {
    const client = new Client();
    const rect = (id: number, x: number, y: number, w: number, h: number, colour: number) => Object.assign(new IfType(), { id, x, y, width: w, height: h, colour, parentId: -1, if3: true, type: 3, fill: true });
    const a = rect(0, 2, 2, 7, 4, 0x991122),
        b = rect(1, 12, 6, 6, 8, 0x1155cc);
    const group = [a, b];
    IfType.m_list = [group];
    IfType.m_open = [true];
    Object.assign(InterfaceList, { top: 0, rootCount: 2, dirty: new Array<boolean>(100).fill(false), rectangleRedraw: new Array<boolean>(100).fill(false), rectRedrawnLastFrame: new Array<boolean>(100).fill(false) });
    Client.localPlayer = new ClientPlayer();
    const screen = new Int32Array(width * height).fill(0x123456);
    const surface: CanvasSurface = {
        createImageData(w, h) {
            return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) } as ImageData;
        },
        putImageData(image, dx, dy, x, y, w, h) {
            for (let row = y; row < y + h; row++)
                for (let col = x; col < x + w; col++) {
                    const p = (row * image.width + col) * 4;
                    screen[(dy + row) * width + dx + col] = (image.data[p] << 16) | (image.data[p + 1] << 8) | image.data[p + 2];
                }
        }
    };
    const canvas = new CanvasComponent(surface);
    GameShell.canvas = canvas;
    GameShell.fullScreenFrame = { getSize: () => ({ width, height }), getInsets: () => ({ top: 0, left: 0, bottom: 0, right: 0 }) };
    GameShell.m_frameWidth = GameShell.m_sWid = width;
    GameShell.m_frameHeight = GameShell.m_sHei = height;
    GameShell.canvasInvalid = GameShell.fullRedraw = Client.loadingComplete = false;
    Client.windowModeRefreshTime = 0n;
    const fb = (GameShell.drawArea = new BufferedImagePixMap());
    fb.init(height, width, canvas);
    const pixels = requireNonNull(fb.pixels);
    pixels.fill(0x123456);
    const rows: string[] = [];
    const bits = (flags: boolean[]) => String(Number(flags[0])) + Number(flags[1]);
    for (let i = 0; i < 10; i++) {
        Client.loopCycle = 63 + i;
        Client.gameState = i % 3 === 0 ? 10 : 30;
        InterfaceList.dirty[0] = i === 0 || i === 3 || i === 6 || i === 8;
        InterfaceList.dirty[1] = i === 0 || i === 4 || i === 5 || i === 9;
        a.colour = 0x991122 + i * 59;
        b.colour = 0x1155cc - i * 113;
        b.hidden = i === 4;
        client['MainRedraw']();
        rows.push([pixelBytes(pixels), pixelBytes(screen), bits(InterfaceList.dirty), bits(InterfaceList.rectangleRedraw), bits(InterfaceList.rectRedrawnLastFrame), InterfaceList.rootCount].join('|'));
    }
    return rows;
}

loginFixture(
    import.meta.url,
    'visible widget pixels survive undamaged title and game frames through both presentation paths',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), '530-widget-frames-'));
        try {
            const source = join(import.meta.dir, 'game');
            execFileSync('javac', ['-cp', gamepackPath, '-d', dir, join(source, 'WindowModeOracle.java'), join(source, 'WidgetFramePersistenceOracle.java')]);
            const java = execFileSync('java', ['--add-opens=java.desktop/java.awt=ALL-UNNAMED', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'WidgetFramePersistenceOracle'], { encoding: 'utf8' })
                .trim()
                .split(/\r?\n/);
            expect(java.length).toBe(10);
            expect(java[1].split('|')[0]).toBe(java[0].split('|')[0]);
            const first = Buffer.from(java[0].split('|')[0], 'base64');
            expect(first.readUInt32BE((2 * width + 2) * 4)).toBe(0x991122);
            expect(first.readUInt32BE((6 * width + 12) * 4)).toBe(0x1155cc);
            const frames = drawFrames();
            for (let i = 0; i < java.length; i++) expect(frames[i], 'frame ' + i).toBe(java[i]);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    20000
);
