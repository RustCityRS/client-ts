import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import ClientMouseListener from '#/client/ClientMouseListener.js';
import GameShell from '#/client/GameShell.js';
import HashTable from '#/datastruct/HashTable.js';
import Pix2D from '#/graphics/Pix2D.js';
import ComponentDrag from '#/ui/ComponentDrag.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import SubInterface from '#/ui/SubInterface.js';
import WrappedException from '#/util/WrappedException.js';
import { compareFramebuffers } from '../render/Framebuffer.js';
import { loginFixture } from '../login-fixture.js';
import { readReferenceFrames } from '../reference-frames.js';
import { gamepackPath } from '../reference.js';

const width = 32,
    height = 20,
    targetColour = 0x481246,
    coverColour = 0x38cc71;
type Group = (IfType | null)[];

function box(id: number, parentId: number, x: number, y: number, w: number, h: number, colour: number): IfType {
    const component = new IfType();
    Object.assign(component, { id, parentId, x, y, width: w, height: h, if3: true, fill: true, type: 3, colour });
    return component;
}

function drawFrame(source: number, inline: number, motion: number, mode: number) {
    const background = box(1, -1, 0, 0, width, height, 0x172536);
    const parent = box(10, -1, 3, 2, 16, 11, 0);
    parent.type = 0;
    parent.scrollX = 2;
    parent.scrollY = 3;
    const layer = source === 2 ? -1 : 10;
    const target = box(11, layer, mode === 2 ? 15 : 4, 5, mode === 3 ? 24 : 6, 4, targetColour);
    target.dragRender = inline !== 0;
    target.transparency = 16;
    target.hidden = mode === 4;
    const cover = box(12, layer, target.x, target.y, target.width, target.height, coverColour);
    const group: Group = source === 0 ? [null, background, parent, target, cover] : [null, background, parent];
    const slots: Group | null = source === 1 ? [null, target, cover] : null;
    const mount: Group | null = source === 2 ? [target, null, cover] : null;
    if (mode === 11) (slots ?? mount ?? group).push(box(13, -1412584499, 4, 7, 4, 3, 0xb33168));
    parent.childSlots = slots;
    function alias(value: Group | null) {
        return value === null ? '-' : value === group ? 'group' : value === slots ? 'slots' : value === mount ? 'mount' : 'other';
    }
    IfType.m_list = [group, mount];
    IfType.m_open = [true, true];
    InterfaceList.subInterfaces = new HashTable<SubInterface>(8);
    if (source === 2) {
        const sub = new SubInterface();
        sub.type = 1;
        sub.group = 1;
        InterfaceList.subInterfaces.put(sub, 10n);
    }
    InterfaceList.top = 0;
    GameShell.m_sWid = width;
    GameShell.m_sHei = height;
    Client.loopCycle = 99;
    InterfaceList.rootCount = 2;
    Client.qaOpTest = false;
    Client.rectDebug = 0;
    InterfaceList.dirty.fill(true);
    InterfaceList.rectRedrawnLastFrame.fill(false);
    InterfaceList.rectangleRedraw.fill(false);
    ComponentDrag.component = mode === 5 ? null : target;
    ComponentDrag.parent = mode === 1 ? null : mode === 8 ? background : parent;
    ComponentDrag.started = (motion & 1) !== 0;
    ComponentDrag.parentVisible = (motion & 2) !== 0;
    ComponentDrag.parentX = 3;
    ComponentDrag.parentY = 2;
    ClientMouseListener.x = mode === 7 ? -7 : 29;
    ClientMouseListener.mouseY = mode === 7 ? -9 : 18;
    ComponentDrag.dragMouseX = ComponentDrag.dragMouseY = 1;
    if (mode === 9) {
        ComponentDrag.parentX = 2147483645;
        ComponentDrag.parentY = 2147483646;
        ClientMouseListener.x = ClientMouseListener.mouseY = -2147483648;
    }
    if (mode === 10) {
        ComponentDrag.parentX = -2147483645;
        ComponentDrag.parentY = -2147483646;
        ComponentDrag.dragMouseX = -2147483648;
        ComponentDrag.dragMouseY = 2147483647;
    }
    ComponentDrag.dragLayerComponents = [];
    ComponentDrag.dragLayerX = 73;
    ComponentDrag.dragLayerY = 91;
    const pixels = new Int32Array(width * height);
    Pix2D.setPixels(pixels, width, height);
    const native = Client.DrawLayer,
        fill = Pix2D.fillRect,
        blend = Pix2D.fillRectTrans;
    const draws: string[] = [],
        stores: string[] = [];
    const injected = new Error('draw callback');
    let first = '-',
        replay = '-',
        depth = 0,
        fault = '-';
    const observedKeys = ['dragLayerX', 'dragLayerComponents', 'dragLayerY'] as const;
    const fields = ['db', 'q', 'n'];
    for (const [index, key] of observedKeys.entries()) {
        let current: (typeof ComponentDrag)[typeof key] = ComponentDrag[key];
        Object.defineProperty(ComponentDrag, key, {
            configurable: true,
            get: () => current,
            set(value: typeof current) {
                current = value;
                if (depth === 0) return;
                if (key === 'dragLayerComponents') first = alias(ComponentDrag.dragLayerComponents);
                stores.push([fields[index], ComponentDrag.dragLayerX, alias(ComponentDrag.dragLayerComponents), ComponentDrag.dragLayerY].join(','));
            }
        });
    }
    function record(x: number, y: number, w: number, h: number, rgb: number, alpha: number) {
        if (rgb !== targetColour && rgb !== coverColour) return;
        draws.push([rgb === targetColour ? 'T' : 'C', x, y, w, h, alpha, Pix2D.clipMinX, Pix2D.clipMinY, Pix2D.clipMaxX, Pix2D.clipMaxY].join(','));
        if (mode === 6 && rgb === targetColour && replay !== '-') throw injected;
    }
    try {
        // Each observer delegates to the native implementation, just as in the instrumented lf.class.
        Client.DrawLayer = (...args) => {
            const [y, list, parentId, bottom, top, root, right, x, left] = args;
            if (parentId === -1412584499) replay = [alias(list), x, y, root, left, top, right, bottom].join(',');
            depth++;
            try {
                native(...args);
            } finally {
                depth--;
            }
        };
        Pix2D.fillRect = (x, y, w, h, rgb) => {
            record(x, y, w, h, rgb, 256);
            fill(x, y, w, h, rgb);
        };
        Pix2D.fillRectTrans = (x, y, w, h, rgb, alpha) => {
            record(x, y, w, h, rgb, alpha);
            blend(x, y, w, h, rgb, alpha);
        };
        Client.drawGame(-54);
    } catch (error) {
        if (!(error instanceof WrappedException)) throw error;
        if (error.cause !== injected && !(error.cause instanceof TypeError)) throw error;
        fault = error.context + '/' + (error.cause === injected ? 'probe' : 'null');
    } finally {
        Client.DrawLayer = native;
        Pix2D.fillRect = fill;
        Pix2D.fillRectTrans = blend;
        for (const key of observedKeys) Object.defineProperty(ComponentDrag, key, { value: ComponentDrag[key], configurable: true, writable: true });
    }
    const state = [
        fault,
        first,
        replay,
        draws.join(';'),
        alias(ComponentDrag.dragLayerComponents),
        [ComponentDrag.dragLayerX, ComponentDrag.dragLayerY, target.rootIndex, target.drawCycle, InterfaceList.rootCount].join(','),
        [Pix2D.clipMinX, Pix2D.clipMinY, Pix2D.clipMaxX, Pix2D.clipMaxY].join(',')
    ];
    return { state, stores: stores.join(';'), pixels };
}

loginFixture(
    import.meta.url,
    '530 frame redraw replays the original drag array last with the drag parent root and screen clip',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), '530-drag-frame-'));
        try {
            const rows: number[][] = [];
            for (const source of [0, 1, 2]) for (const inline of [0, 1]) for (const motion of [0, 1, 2, 3]) for (let mode = 0; mode <= 11; mode++) rows.push([source, inline, motion, mode]);
            const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
            const compile = Bun.spawnSync(['javac', asm, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'WidgetDragDrawOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const java = ['java', asm, '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'WidgetDragDrawOracle'];
            const prepare = Bun.spawnSync([...java, gamepackPath, dir]);
            expect(prepare.exitCode, prepare.stderr.toString()).toBe(0);
            const framePath = join(dir, 'frames.bin');
            const run = Bun.spawnSync([...java, framePath], { stdin: Buffer.from(rows.map(row => row.join(' ')).join('\n')) });
            expect(run.exitCode, run.stderr.toString()).toBe(0);
            const result = run.stdout.toString().trimEnd().split(/\r?\n/);
            expect(result).toHaveLength(rows.length);
            for (const { index, frame } of readReferenceFrames(framePath, width, height, rows.length)) {
                const [source, inline, motion, mode] = rows[index];
                const expected = result[index].split('|'),
                    context = rows[index].join(' ');
                const actual = drawFrame(source, inline, motion, mode);
                expect(actual.state, context).toEqual(expected.slice(0, 7));
                expect(actual.stores, context).toBe(expected[7]);
                expect(() => compareFramebuffers(frame, { ...frame, pixels: actual.pixels }), context).not.toThrow();
            }
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    30000
);
