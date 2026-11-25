import { expect } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import GameShell from '#/client/GameShell.js';
import { toJsString } from '#/datastruct/JagString.js';
import GlCleaner from '#/gl/GlCleaner.js';
import SoftwareFont from '#/graphics/SoftwareFont.js';
import { requireNonNull } from '#/util/JavaArray.js';
import MinimapBuilder from '#/dash3d/MinimapBuilder.js';
import Pix3D from '#/dash3d/Pix3D.js';
import { capsProfileFromJson } from '#/gl/CapsProfile.js';
import GlRaster from '#/gl/GlRaster.js';
import GlRenderer from '#/gl/GlRenderer.js';
import NullGL from '#/gl/NullGL.js';
import Pix2D from '#/graphics/Pix2D.js';
import TitleFlames from '#/title/TitleFlames.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import Minimenu from '#/ui/Minimenu.js';
import WorldMap from '#/ui/WorldMap.js';
import WrappedException from '#/util/WrappedException.js';
import { loginFixture } from '../login-fixture.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

type Row = [boolean, number, string];
const cases: Row[] = [];
for (const active of [false, true]) {
    for (const [heap, texture, geometry, sprites] of [
        [65536 * 1024, 65535 * 1024, 1023, 1],
        [65537 * 1024 + 101, 65535 * 1024, 1024, 1024],
        [2 ** 32 + 3659, 2147483647, 2, 1021],
        [1023, -10000, 2, 4],
        [2048, 0, 0, 0]
    ])
        cases.push([active, 1405, [heap, texture, geometry, sprites].join(',')]);
    for (const code of [1337, 1338, 1339, 1400, 1401, 1402, 1403]) {
        for (const fault of ['ready', 'draw', 'restore']) cases.push([active, code, fault]);
        if (code === 1338 || code === 1339) cases.push([active, code, 'nomask']);
        if (code >= 1400 && code <= 1402) {
            for (const fault of ['shortDirty', 'shortRedraw']) cases.push([active, code, fault]);
        }
    }
}

function clientRows(): string[] {
    let events: string[] = [];
    let fault: string;
    let widget: IfType;
    let clips = 0;
    const failure = new Error('draw probe');
    const sdClip = Pix2D.setClipping.bind(Pix2D);
    const glClip = GlRaster.setClipping.bind(GlRaster);
    function clip(name: string, coords: number[]) {
        events.push(name + '(' + coords.join(',') + ')');
        if (++clips === 2 && fault === 'restore') throw failure;
    }
    Pix2D.setClipping = (...coords) => {
        clip('sdClip', coords);
        sdClip(...coords);
    };
    GlRaster.setClipping = (...coords) => {
        clip('glClip', coords);
        glClip(...coords);
    };
    const clip3d = Pix3D.setRenderClipping.bind(Pix3D);
    Pix3D.setRenderClipping = () => {
        events.push('raster3d');
        clip3d();
    };
    Pix2D.width = GlRenderer.width = 291;
    Pix2D.height = GlRenderer.height = 217;
    Pix2D.pixels = new Int32Array(291 * 217);
    GlRenderer.gl = new NullGL(capsProfileFromJson(readFileSync(join(import.meta.dir, 'rtx5070.json'), 'utf8')));
    const gate = new Array<boolean>(100).fill(false);
    Object.defineProperty(InterfaceList, 'rectRedrawnLastFrame', {
        get() {
            events.push('paint gate');
            return gate;
        }
    });
    function draw(name: string, ...args: (boolean | number)[]) {
        events.push(name + '(' + args.join(',') + ')');
        (GlRenderer.active ? glClip : sdClip)(2, 3, 43, 57);
        if (fault === 'draw') throw failure;
    }
    Client.drawScene = (...args) => draw('scene', ...args);
    MinimapBuilder.Draw = (x, c, root, y) => {
        expect(c).toBe(widget);
        draw('minimap', x, root, y);
    };
    MinimapBuilder.CompassDraw = (root, c, limit, x, y) => {
        expect(c).toBe(widget);
        expect(limit).toBe(3);
        draw('compass', root, x, y);
    };
    WorldMap.draw = (y, scale, x, h, w) => {
        expect(scale).toBe(2);
        draw('map', y, x, h, w);
    };
    WorldMap.drawOverview = (...args) => draw('overview', ...args);
    TitleFlames.RenderFlames = (...args) => draw('flames', ...args);
    function flags(name: string, size: number) {
        return new Proxy(new Array<boolean>(size).fill(false), {
            set(target, key, value) {
                events.push(name + '[' + String(key) + ']=' + value);
                return Reflect.set(target, key, value);
            }
        });
    }
    function field<T extends object, K extends keyof T>(owner: T, key: K, value: T[K], label: string) {
        Object.defineProperty(owner, key, {
            configurable: true,
            get: () => value,
            set(next: T[K]) {
                value = next;
                events.push(label);
            }
        });
    }
    return cases.map(row => {
        const [active, code, variant] = row;
        fault = variant;
        GlRenderer.active = active;
        Client.minimapState = 5; // ed.a has returned; keep the optional click-menu loop outside this draw-boundary fixture.
        widget = Object.assign(new IfType(), { parentId: -1, type: 1, clientCode: code, x: 13, y: 17, width: 121, height: 97 });
        if (code === 1405) {
            const [heap, texture, geometry, sprites] = variant.split(',').map(Number);
            Client.displayFps = true;
            GameShell.m_fps = 51;
            Object.defineProperty(performance, 'memory', { configurable: true, value: { usedJSHeapSize: heap } });
            GlCleaner.textureMemory = texture;
            GlCleaner.geometryMemory = geometry;
            GlCleaner.memory2d = sprites;
            Client.p12 = Client.fontPlain11 = new SoftwareFont(new Uint8Array(257));
            Client.p12.drawRight = (text, x, y, colour, shadow) => {
                events.push(toJsString(requireNonNull(text)) + '(' + [x, y, colour, shadow].join(',') + ')');
            };
            Reflect.set(Client, 'js5Providers', new Array(28).fill({ groupCount: () => 4, verifiedCount: () => 2, verificationPosition: () => 1 }));
        }
        widget.GetMask = () => {
            events.push('mask');
            return fault !== 'nomask';
        };
        field(InterfaceList, 'viewportComponent', null, 'wl.h');
        field(Minimenu, 'tooltipY', -7, 'rg.s');
        field(Minimenu, 'tooltipX2', -9, 'hi.a');
        Object.defineProperty(InterfaceList, 'dirty', { configurable: true, value: flags('dirty', fault === 'shortDirty' ? 2 : 100) });
        Object.defineProperty(InterfaceList, 'rectangleRedraw', { configurable: true, value: flags('redraw', fault === 'shortRedraw' ? 2 : 100) });
        clips = 0;
        events = [];
        let outcome = 'ok';
        try {
            Client.DrawLayer(11, [widget], -1, 155, 5, 2, 181, 9, 7);
        } catch (e) {
            const cause = e instanceof WrappedException ? e.cause : e;
            if (cause === failure) outcome = 'IllegalStateException';
            else if (cause instanceof RangeError) outcome = 'ArrayIndexOutOfBoundsException';
            else throw e;
        }
        const raster = active ? GlRaster : Pix2D;
        const bounds = [raster.clipMinX, raster.clipMinY, Reflect.get(raster, 'clipMaxX'), raster.clipMaxY];
        const viewport = [InterfaceList.viewportComponent === widget, Minimenu.tooltipY, Minimenu.tooltipX2];
        return [row.join(' '), outcome, events.join(';'), viewport.join(','), bounds.join(',')].join('|');
    });
}

loginFixture(
    import.meta.url,
    'HD DrawLayer dispatches special widget draws and restores the original clip in order',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-special-draw-'));
        try {
            const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
            const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
            const compile = Bun.spawnSync(['javac', asm, '-encoding', 'UTF-8', '-cp', cp, '-d', dir, join(import.meta.dir, 'GlRecorder.java'), join(import.meta.dir, 'WidgetSpecialDrawOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const java = ['java', asm, '-Djava.awt.headless=true', '-cp', cp, 'WidgetSpecialDrawOracle'];
            const patch = Bun.spawnSync([...java, dir]);
            expect(patch.exitCode, patch.stderr.toString()).toBe(0);
            const run = Bun.spawnSync([...java, 'run', 'cases'], { stdin: Buffer.from(cases.map(row => row.join(' ')).join('\n') + '\n') });
            expect(run.exitCode, run.stderr.toString()).toBe(0);
            const original = run.stdout.toString().trimEnd().split(/\r?\n/);
            expect(original).toHaveLength(cases.length);
            const actual = clientRows();
            for (const [i, row] of original.entries()) expect(actual[i], cases[i].join(' ')).toBe(row);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    45000,
    'gl'
);
