import { expect } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { endianness, tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import GameShell from '#/client/GameShell.js';
import GameVariant from '#/client/GameVariant.js';
import { fromJsString } from '#/datastruct/JagString.js';
import Linkable from '#/datastruct/Linkable.js';
import SharedPtrList from '#/datastruct/SharedPtrList.js';
import BufferedImagePixMap from '#/graphics/BufferedImagePixMap.js';
import Pix32 from '#/graphics/Pix32.js';
import Pix2D from '#/graphics/Pix2D.js';
import PixScreen from '#/graphics/PixScreen.js';
import SpriteLoader from '#/graphics/SpriteLoader.js';
import IfType from '#/ui/IfType.js';
import InterfaceView from '#/ui/InterfaceView.js';
import InterfaceList from '#/ui/InterfaceList.js';
import MapArea from '#/ui/MapArea.js';
import MapElementInstance from '#/ui/MapElementInstance.js';
import WorldMap from '#/ui/WorldMap.js';
import WorldMapLabels from '#/ui/WorldMapLabels.js';
import { requireNonNull } from '#/util/JavaArray.js';
import WrappedException from '#/util/WrappedException.js';
import { localAssets, readGroup } from './cachefile.js';
import { loginFixture } from './login-fixture.js';
import { gamepackPath, cachePath } from './reference.js';

type Row = [entry: number, progress: number, zoom: number, scale: number, w: number, h: number, x: number, y: number, mode: number, flashes: number, ticks: number, variant: number, repeat: number, point: string];
function vectors(): Row[] {
    const rows: Row[] = [];
    for (const entry of [0, 1, 4, 5]) {
        for (const progress of [0, 43, 99, 100, 101])
            for (const zoom of [3, 5.25]) {
                rows.push([entry, progress, zoom, 2, 68, 41, 7, 9, 0, 2, 1, 1, 2, '-']);
            }
    }
    for (const entry of [0, 1]) {
        for (const mode of [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11])
            for (const variant of [0, 1]) {
                rows.push([entry, mode === 8 ? 35 : 100, 3.75, entry === 0 ? -3 : 2, 31, 20, 4, 6, mode, 3, 19, variant, 2, '-']);
            }
        for (const [x, y, w, h] of [
            [-7, -9, 45, 34],
            [315, 98, 32, 41],
            [25, 6, 1, 1],
            [4, 4, 0, 1],
            [1, 2, 1, 0]
        ]) {
            rows.push([entry, 100, 6, 2, w, h, x, y, 0, 0, 9, 0, 1, '-']);
        }
        for (const ticks of [-1, 0, 1, 2, 10, 11, 15, 20, 21, 0x7fffffff, -2147483648]) {
            rows.push([entry, 100, Math.fround(3.0000003), 2, 33, 18, 6, 13, 0, 2, ticks, 0, 1, '-']);
        }
    }
    for (const site of ['step', 'tiles', 'scaled', 'labels', '-']) {
        rows.push([2, site === 'step' ? 8 : 100, 4.3, 2, 33, 23, -2, -2, 0, 1, 1, 0, 1, site]);
    }
    for (const site of ['tiles', 'bind', 'opaque', 'swapFb', '-'])
        for (const mode of [0, 1, 2]) {
            rows.push([3, 100, 3.75, 2, 17, 13, 21, 32, mode, 3, 11, 1, 2, site]);
        }
    for (const mode of [12, 13, 14]) rows.push([2, 100, 3.25, 2, 84, 63, 17, 12, mode, 2, 1, 0, 1, '-']);
    rows.push([1, 100, 4, 2, 24, 11, 6, 3, 15, 2, 1, 1, 1, '-']);
    rows.push([1, 100, 4, 2, 24, 11, 6, 3, 16, 2, 1, 1, 2, '-']);
    for (const entry of [0, 4]) for (const progress of [0, 43, 99]) rows.push([entry, progress, 4, 2, 325, 88, 3, 8, 0, 3, 5, 0, 1, '-']);
    for (const entry of [4, 5])
        for (const mode of [3, 4, 5, 8, 17, 18, 19, 20, 21, 22, 23, 24]) {
            rows.push([entry, mode === 23 ? 0 : mode === 8 ? 7 : 100, 4, 2, 43, 29, 7, 8, mode, 2, 1, 1, 2, '-']);
        }
    for (const zoom of [-0, 0, NaN, Infinity, -2.7, 1e-19]) rows.push([2, 100, zoom, 0x7fffffff, 43, 29, 7, 3, 0, 1, 1, 0, 1, 'tiles']);
    return rows;
}
function flags() {
    return ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED', '--add-exports', 'java.base/jdk.internal.org.objectweb.asm.tree=ALL-UNNAMED'];
}
function hash(values: Int32Array | null): string {
    if (values === null) return '-';
    const bytes = Buffer.from(new Uint8Array(values.buffer, values.byteOffset, values.byteLength));
    if (endianness() === 'LE') bytes.swap32();
    return createHash('sha256').update(bytes).digest('hex');
}
function cause(e: unknown): string {
    if (e instanceof WrappedException) return e.context + '/' + cause(e.cause);
    if (e instanceof TypeError) return e.message.startsWith('ClassCastException') ? 'cast' : 'null';
    if (e instanceof RangeError) return e.message === '/ by zero' ? 'zero' : 'bounds';
    return e instanceof Error ? e.message : String(e);
}
function widgetState(item: IfType, parent: IfType, spare: IfType): string {
    return [
        [item.rootIndex, item.drawCycle, parent.rootIndex, parent.drawCycle, spare.rootIndex, spare.drawCycle, InterfaceList.rootCount].join(','),
        ...[InterfaceList.rootX, InterfaceList.rootY, InterfaceList.rootWidth, InterfaceList.rootHeight, InterfaceList.dirty, InterfaceList.rectangleRedraw].map(a => (a === null ? 'null' : '[' + a.join(', ') + ']'))
    ].join(';');
}

function frameSequence(): string[] {
    const width = 17,
        height = 15,
        widget = new IfType();
    Object.assign(widget, { if3: true, parentId: -1, type: 3, clientCode: 1401, x: 3, y: 2, width: 7, height: 9 });
    IfType.m_list = [[widget]];
    IfType.m_open = [true];
    InterfaceList.top = 0;
    Object.assign(InterfaceList, {
        rootCount: 2,
        dirty: [false, true, false],
        rectangleRedraw: [false, false, false],
        rectRedrawnLastFrame: [false, false, false],
        rootX: new Int32Array(3),
        rootY: new Int32Array(3),
        rootWidth: new Int32Array(3),
        rootHeight: new Int32Array(3)
    });
    WorldMap.progress = 0;
    WorldMap.current = null;
    GameShell.m_sWid = width;
    GameShell.m_sHei = height;
    Pix2D.setPixels(new Int32Array(width * height + 1), width, height);
    Client.localPlayer = new ClientPlayer();
    const rows: string[] = [];
    for (let i = 0; i < 6; i++) {
        Client.loopCycle = 220 + i;
        widget.hidden = i === 2 || i === 3;
        if (i % 2 === 0) Client.drawGame(-54);
        else Client.GameDraw(120);
        rows.push(
            [[widget.rootIndex, widget.drawCycle, InterfaceList.rootCount, InterfaceList.cycle].join(','), ...[InterfaceList.dirty, InterfaceList.rectangleRedraw, InterfaceList.rectRedrawnLastFrame].map(flags => '[' + flags.join(', ') + ']')].join(
                ';'
            )
        );
        for (let root = 0; root < InterfaceList.rootCount; root++) InterfaceList.rectangleRedraw[root] = false;
    }
    return rows;
}

loginFixture(
    import.meta.url,
    '530 main and overview world-map draw original framebuffers, cache publications and call boundaries',
    async () => {
        const rows = vectors(),
            dir = mkdtempSync(join(tmpdir(), 'rs530-map-draw-'));
        const assets = localAssets(cachePath, [8, 13]),
            glyphs = assets.archive(8),
            id = glyphs.GetGroupId(fromJsString('b12_full'));
        const font = SpriteLoader.loadFont(glyphs, id, 0, assets.archive(13));
        expect(font).not.toBeNull();
        let java: string[];
        try {
            for (const [archive, group] of [
                [255, 8],
                [255, 13],
                [8, id],
                [13, id]
            ])
                writeFileSync(join(dir, archive + '-' + group), readGroup(cachePath, archive, group));
            const compile = Bun.spawnSync(['javac', ...flags(), '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game', 'WorldMapDrawOracle.java'), join(import.meta.dir, 'game', 'title-loading', 'TitleLoadingOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const input = rows.map(row => row.map((v, i) => (i === 2 ? new Int32Array(Float32Array.of(Number(v)).buffer)[0] : v)).join(' ')).join('\n') + '\nframes\n';
            const run = Bun.spawnSync(['java', ...flags(), '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'WorldMapDrawOracle', dir], {
                stdin: Buffer.from(input),
                timeout: 20000,
                maxBuffer: 8 * 1024 * 1024
            });
            expect(run.exitCode, run.stderr.toString()).toBe(0);
            java = run.stdout.toString().trimEnd().split(/\r?\n/);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
        const frames = java.splice(-6);
        expect(java.length).toBe(rows.reduce((sum, row) => sum + row[12], 0));
        let expected = 0,
            lowMemoryHash = '';
        for (const row of rows) {
            const [entry, progress, zoom, scale, w, h, x, y, mode, flashes, ticks, variant, repeat, point] = row;
            Object.assign(WorldMap, {
                progress,
                width: mode === 10 ? 0 : 24,
                height: mode === 11 ? 0 : 18,
                centerX: 12,
                centerZ: 8,
                baseX: 0,
                baseZ: 0,
                zoom: Math.fround(zoom),
                viewTop: 4,
                viewMinX: 6,
                displayWidth: 10,
                displayHeight: 8,
                flashCount: flashes,
                flashTicks: ticks,
                flashingIcon: 1,
                current: progress < 100 ? null : new MapArea(null, null, 0, 0, 0x426722, true, 50),
                overview: null
            });
            const under = new Int32Array(4096),
                lower = new Int8Array(4096),
                shapes = new Int8Array(4096);
            const upper = new Int8Array(4096),
                upperShapes = new Int8Array(4096),
                walls = new Int8Array(4096);
            for (let i = 0; i < 4096; i++) {
                under[i] = 1 + ((0x396941 + i * 0x10507) & 0xffffff);
                if (i % 5 === 1) {
                    lower[i] = 1;
                    shapes[i] = 4 + (i % 38);
                }
                if (i % 11 === 5) {
                    upper[i] = 2;
                    upperShapes[i] = 4 + (i % 19);
                }
                if (i % 19 === 11) walls[i] = (i % 28) + 1;
            }
            Object.assign(WorldMap, {
                underlayColors: mode === 4 ? null : [[under]],
                overlayIds: [[lower]],
                overlayShapes: [[shapes]],
                upperOverlayIds: [[upper]],
                upperOverlayShapes: [[upperShapes]],
                wallTypes: [[walls]],
                locIds: [[null]],
                mapScenes: [[null]],
                overlayColors: Int32Array.of(0, 0xc48516, 0x1961af),
                labels: mode === 5 ? null : new WorldMapLabels(0),
                icons: new SharedPtrList<MapElementInstance>(),
                deferredIcons: new SharedPtrList<MapElementInstance>()
            });
            for (let i = 0; i < 4; i++) {
                const icon = new MapElementInstance();
                Object.assign(icon, { mapFunction: i % 2, x: 3 + 4 * i, z: 2 + 2 * i });
                WorldMap.icons.push_back(icon);
            }
            if (mode === 6) Reflect.apply(WorldMap.icons.push_back, WorldMap.icons, [new Linkable()]);
            const screen = Int32Array.from({ length: mode === 7 ? 135 : 333 * 112 + 1 }, (_, i) => 0x14375 + i * 3721);
            const fb = new BufferedImagePixMap();
            fb.width = 333;
            fb.height = 112;
            fb.pixels = screen;
            GameShell.drawArea = mode === 3 ? null : fb;
            fb.bind();
            GameVariant.id = variant;
            Client.displayFps = mode >= 12 && mode <= 14;
            Client.fontBold12 = mode === 8 ? null : font;
            Client.p12 = mode === 14 ? null : font;
            GameShell.m_fps = 49;
            Client.usedMemoryKb = () => (mode === 13 ? 65537 : 65536);
            if (mode === 15) {
                WorldMap.overview = new Pix32(w + 11, h + 9, 3, 4, w, h, new Int32Array(w * h).fill(0x6633cc));
            } else if ([1, 2, 6, 10, 11, 16].includes(mode)) {
                const cached = new Pix32(w + (mode === 2 ? 1 : 0), h + (mode === 16 ? 1 : 0));
                requireNonNull(cached.pixels).forEach((_v, i, pixels) => {
                    pixels[i] = 0x3e4470 + i * 59;
                });
                WorldMap.overview = cached;
            }
            for (let rep = 0; rep < repeat; rep++) {
                const calls: string[] = [],
                    restore: (() => void)[] = [];
                if (entry === 2 || entry === 3)
                    for (const [owner, key, site] of [
                        [WorldMap, 'drawTiles', 'tiles'],
                        [WorldMap, 'drawScaled', 'scaled'],
                        [WorldMap, 'drawLabels', 'labels'],
                        [WorldMap, 'step', 'step'],
                        [PixScreen.prototype, 'bind', 'bind'],
                        [Pix32.prototype, 'drawOpaque', 'opaque']
                    ] as const) {
                        const original = requireNonNull(Object.getOwnPropertyDescriptor(owner, key));
                        Object.defineProperty(owner, key, {
                            ...original,
                            value: function (this: unknown, ...args: unknown[]) {
                                calls.push(site);
                                if (point === site) throw new Error('boundary');
                                if (site === 'tiles' && point === 'swapFb') {
                                    const replacement = new BufferedImagePixMap();
                                    replacement.width = 333;
                                    replacement.height = 112;
                                    replacement.pixels = new Int32Array(333 * 112 + 1).fill(0x215167);
                                    GameShell.drawArea = replacement;
                                }
                                return Reflect.apply(original.value, this, args);
                            }
                        });
                        restore.push(() => Object.defineProperty(owner, key, original));
                    }
                const before = WorldMap.overview;
                let error = '-';
                const item = new IfType(),
                    parent = new IfType(),
                    spare = new IfType();
                try {
                    if (entry === 0 || entry === 2) WorldMap.draw(y, scale, x, h, w);
                    else if (entry === 1 || entry === 3) WorldMap.drawOverview(x, y, h, w);
                    else {
                        Client.loopCycle = 7890 + rep;
                        Object.assign(InterfaceList, {
                            rootCount: 7,
                            rootX: new Int32Array(12),
                            rootY: new Int32Array(mode === 22 ? 7 : 12),
                            rootWidth: new Int32Array(12),
                            rootHeight: new Int32Array(12),
                            dirty: new Array<boolean>(12).fill(false),
                            rectangleRedraw: new Array<boolean>(mode === 17 ? 7 : mode === 24 ? 8 : 12).fill(false)
                        });
                        InterfaceList.dirty[5] = true;
                        if (mode !== 17 && mode !== 24) InterfaceList.rectangleRedraw[9] = true;
                        if (mode === 18) Reflect.set(InterfaceList, 'dirty', null);
                        if (mode === 23) {
                            WorldMap.current = new MapArea(null, null, 0, 0, 0x426722, true, 50);
                            WorldMap.archive = null;
                        }
                        for (const c of [item, parent, spare]) {
                            c.rootIndex = -11;
                            c.drawCycle = -12;
                        }
                        Object.assign(item, { clientCode: entry === 4 ? 1400 : 1401, parentId: -1, type: 3, if3: true, x: mode === 20 ? 336 : x, y, width: w, height: h, id: 854, hidden: mode === 19 });
                        let widgets = [item];
                        if (mode === 21 || mode === 24) {
                            Object.assign(parent, { parentId: -1, id: 853, type: 0, if3: true, x: 3, y: 7, width: 38, height: 31 });
                            Object.assign(spare, { parentId: -1, id: 852, type: 3, if3: true, hidden: true, x: 1, y: 2, width: 11, height: 7 });
                            item.parentId = 853;
                            widgets = [spare, parent, item];
                        }
                        const view = new InterfaceView(widgets);
                        const prior = widgetState(item, parent, spare);
                        view.visibleComponents();
                        view.visiblePositions();
                        view.hitTest(x, y);
                        expect(widgetState(item, parent, spare), 'input reads').toBe(prior);
                        Client.DrawLayer(0, widgets, -1, 112, 0, -1, 333, 0, 0);
                    }
                } catch (e) {
                    error = cause(e);
                } finally {
                    for (const fn of restore) fn();
                }
                const overview = WorldMap.overview,
                    cached = overview instanceof Pix32 ? overview.pixels : null;
                const active = Pix2D.pixels === screen ? 'screen' : Pix2D.pixels === cached ? 'cache' : 'other';
                const actual = [
                    error,
                    calls.join(','),
                    [Pix2D.clipMinX, Pix2D.clipMinY, Pix2D.clipMaxX, Pix2D.clipMaxY, Pix2D.width, Pix2D.height].join(','),
                    [WorldMap.viewMinX, WorldMap.viewTop, WorldMap.displayWidth, WorldMap.displayHeight, WorldMap.flashCount, WorldMap.flashTicks].join(','),
                    [before === overview, overview !== null, active].join(','),
                    hash(screen),
                    hash(cached),
                    hash(Pix2D.pixels)
                ];
                const parts = java[expected++].split('|'),
                    [widgetFlags] = parts.splice(2, 1);
                // Establish the original's successful paint, visible memory text and target turnover independently.
                if ((entry >= 4 && mode === 0) || (w === 68 && h === 41) || mode === 12 || mode === 13) expect(parts[0], row.join(' ')).toBe('-');
                if (entry === 1 && w === 68 && h === 41 && progress >= 100) {
                    expect(parts[4]).toBe((rep > 0) + ',true,screen');
                    expect(parts[6]).not.toBe('-');
                    expect(parts[7]).toBe(parts[5]);
                }
                if (entry === 1 && mode === 3 && rep === 0) {
                    expect(parts[0]).toMatch(/^oc\.E\(.+\)\/null$/);
                    expect(parts[4]).toBe('false,true,cache');
                }
                if (mode === 12) {
                    expect(parts[1]).toBe('tiles,scaled,labels');
                    lowMemoryHash = parts[5];
                }
                if (mode === 13) {
                    expect(lowMemoryHash).not.toBe('');
                    expect(parts[5]).not.toBe(lowMemoryHash);
                }
                if (entry >= 4) expect(widgetState(item, parent, spare), row.join(' ')).toBe(widgetFlags);
                expect(actual, row.join(' ') + ' repeat ' + rep).toEqual(parts);
            }
        }
        expect(frameSequence()).toEqual(frames);
    },
    35000
);
