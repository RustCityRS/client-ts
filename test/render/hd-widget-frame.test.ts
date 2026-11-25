import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { hdGamepackPath, joglPath } from './hd-reference.js';
import { loginFixture } from '../login-fixture.js';
import type { GL } from '#/jogl/GL.js';

type Rect = [x: number, y: number, width: number, height: number];
type Scenario = [state: number, width: number, height: number, mode: number, previousRoots: number];
const floatBits = new DataView(new ArrayBuffer(4));
function bits(value: number): string {
    floatBits.setFloat32(0, value);
    return floatBits.getUint32(0).toString(16);
}
function recordedCall(name: keyof GL, args: number[]): string {
    const values = args.map(arg => (name === 'glVertex2f' ? bits(arg) : name === 'glOrtho' ? arg.toFixed(1) : String(arg)));
    return 'G.' + name + '(' + values.join(',') + ')';
}
function intersect(a: Rect, b: Rect): Rect {
    const x = Math.max(a[0], b[0]),
        y = Math.max(a[1], b[1]);
    return [x, y, Math.min(a[0] + a[2], b[0] + b[2]) - x, Math.min(a[1] + a[3], b[1] + b[3]) - y];
}
function visible(r: Rect): boolean {
    return r[2] > 0 && r[3] > 0;
}

// A command specification for this particular six-widget tree. Geometry is
// submitted at its original coordinates. The parent scissor clips it on the GPU.
function frames([state, width, height, mode, previousRoots]: Scenario): string[] {
    const screen: Rect = [0, 0, width, height],
        outer: Rect = [7, 5, 19, 15],
        inner: Rect = [16, 11, 13, 10];
    const border: Rect = [29, 2, 11, 14],
        last: Rect = [9, 22, 24, 6];
    const outerClip = intersect(screen, outer),
        innerClip = intersect(outerClip, inner);
    const f = Math.fround,
        subpixel = f(0.3);
    let orthographic = false;
    const result: string[] = [];
    for (let frame = 0; frame < 2; frame++) {
        const rootCount = frame === 0 ? previousRoots : 3,
            events: string[] = [];
        const gl = (name: string, ...args: (string | number)[]) => events.push('G.gl' + name + '(' + args.join(',') + ')');
        const scissor = ([x, y, w, h]: Rect) => {
            gl('Enable', 3089);
            gl('Scissor', x, height - y - h, w, h);
        };
        function begin(mode: number, colour: number, alpha?: number) {
            if (!orthographic) {
                gl('MatrixMode', 5889);
                gl('LoadIdentity');
                gl('Ortho', '0.0', width + '.0', '0.0', height + '.0', '-1.0', '1.0');
                gl('Viewport', 0, 0, width, height);
                gl('MatrixMode', 5888);
                gl('LoadIdentity');
                gl('Disable', 2896);
                gl('Disable', 2929);
                gl('Disable', 2912);
                orthographic = true;
            }
            gl('Begin', mode);
            const components = [colour >> 16, colour >> 8, colour];
            if (alpha !== undefined) components.push(alpha);
            gl(alpha === undefined ? 'Color3ub' : 'Color4ub', ...components.map(x => (x << 24) >> 24));
        }
        const vertex = (x: number, y: number) => gl('Vertex2f', bits(x), bits(y));
        const shiftX = (x: number) => f(x + subpixel),
            shiftY = (y: number) => f(height - f(y + subpixel));
        function line(x0: number, y0: number, x1: number, y1: number, colour: number) {
            begin(2, colour);
            vertex(shiftX(x0), shiftY(y0));
            vertex(shiftX(x1), shiftY(y1));
            gl('End');
        }
        scissor(screen);
        if (visible(outerClip)) {
            scissor(outerClip);
            if (rootCount > 0 && visible(intersect(outerClip, [4, 8, 13, 10]))) {
                begin(6, 0x916abc, mode === 1 ? undefined : 185);
                vertex(4, height - 8);
                vertex(4, height - 18);
                vertex(17, height - 18);
                vertex(17, height - 8);
                gl('End');
            }
            if (visible(innerClip)) {
                scissor(innerClip);
                if (rootCount > 0 && visible(intersect(innerClip, [14, 8, 16, 13]))) line(14, mode === 1 ? 8 : 20, 29, mode === 1 ? 20 : 8, 0x7843f9);
                scissor(outerClip);
            }
            scissor(screen);
        }
        if (rootCount > 1 && visible(intersect(screen, border))) {
            begin(2, 0xedea15, mode === 1 ? 123 : undefined);
            const x0 = shiftX(29),
                y0 = shiftY(2),
                x1 = f(x0 + 10),
                y1 = f(y0 - 13);
            vertex(x0, y0);
            vertex(x0, y1);
            vertex(x1, y1);
            vertex(x1, y0);
            gl('End');
        }
        if (rootCount > 2 && visible(intersect(screen, [9, 22, 25, 7]))) line(9, 22, 33, 28, 0x8832c1);
        gl('Disable', 3089);
        events.push('swap@' + (100 - rootCount) + '/' + '1'.repeat(rootCount) + '0'.repeat(3 - rootCount));
        const roots = [outer, border, last].map((r, i) => [...r, 0, Number(i >= rootCount), Number(i < rootCount)].join(',')).join(';');
        const children = visible(outerClip) ? 0 : -1,
            childOfInner = visible(innerClip) ? 0 : -1;
        result.push([events.join(';'), roots, screen.join(','), [0, children, children, childOfInner, 1, 2].join(','), state === 10 ? '1,0' : '0,1'].join('|'));
    }
    return result;
}

function scenarios(): Scenario[] {
    const rows: Scenario[] = [];
    for (const state of [10, 30])
        for (const [w, h] of [
            [47, 33],
            [34, 24],
            [25, 17],
            [13, 11],
            [7, 5]
        ])
            for (const mode of [0, 1]) for (const previousRoots of [0, 1, 2, 3]) rows.push([state, w, h, mode, previousRoots]);
    return rows;
}

function referenceFrames(rows: Scenario[]): string[] {
    const temp = mkdtempSync(join(tmpdir(), '530-hd-widget-frame-'));
    try {
        const libs = hdGamepackPath + delimiter + joglPath;
        const build = Bun.spawnSync(['javac', join(import.meta.dir, '../hd/GlRecorder.java'), '-cp', libs, '-d', temp, join(import.meta.dir, 'HdFrameBoundaryOracle.java'), join(import.meta.dir, 'HdWidgetFrameOracle.java')]);
        expect(build.exitCode, build.stderr.toString()).toBe(0);
        const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', temp + delimiter + libs, 'HdWidgetFrameOracle'], {
            stdin: Buffer.from(rows.map(r => r.join(' ')).join('\n') + '\n'),
            maxBuffer: 4 * 1024 * 1024
        });
        expect(java.exitCode, java.stderr.toString()).toBe(0);
        const actual = java.stdout.toString().trimEnd().split(/\r?\n/);
        expect(actual.length).toBe(rows.length * 2);
        return actual;
    } finally {
        rmSync(temp, { force: true, recursive: true });
    }
}

test('original HD title and game frames submit a populated widget group through JOGL before swap', () => {
    const rows = scenarios();
    const actual = referenceFrames(rows);
    for (const [i, row] of rows.entries()) expect(actual.slice(2 * i, 2 * i + 2), row.join(' ')).toEqual(frames(row));
}, 30000);

loginFixture(
    import.meta.url,
    'production HD MainRedraw draws the six-widget tree and swaps like both native frame entries',
    async () => {
        const { default: Client } = await import('#/client/Client.js');
        const { default: GameShell } = await import('#/client/GameShell.js');
        const { default: ClientPlayer } = await import('#/dash3d/ClientPlayer.js');
        const { default: IfType } = await import('#/ui/IfType.js');
        const { default: InterfaceList } = await import('#/ui/InterfaceList.js');
        const { default: renderer } = await import('#/gl/GlRenderer.js');
        const { default: raster } = await import('#/gl/GlRaster.js');
        const { default: mouse } = await import('#/client/ClientMouseListener.js');
        const rows = scenarios();
        const original = referenceFrames(rows);
        const client = new Client();
        let events: string[] = [];
        renderer.gl = new Proxy({} as GL, {
            get(_target, name: keyof GL) {
                return (...args: number[]) => {
                    events.push(recordedCall(name, args));
                };
            }
        });
        Reflect.set(renderer, 'drawable', {
            swapBuffers() {
                events.push('swap@' + InterfaceList.dirty.filter(Boolean).length + '/' + InterfaceList.rectangleRedraw.map(Number).join(''));
            }
        });
        const drawTitle = Client.drawGame,
            drawGame = Client.GameDraw;
        let titlePasses = 0,
            gamePasses = 0;
        Client.drawGame = function (guard) {
            titlePasses++;
            return drawTitle.call(this, guard);
        };
        Client.GameDraw = function (guard) {
            gamePasses++;
            return drawGame.call(this, guard);
        };
        Client.localPlayer = new ClientPlayer();
        Client.loopCycle = 417;
        mouse.x = mouse.mouseY = -100;
        GameShell.fullScreenFrame = { getSize: () => ({ width: 0, height: 0 }), getInsets: () => ({ left: 0, right: 0, top: 0, bottom: 0 }) };
        GameShell.m_focus = true;
        InterfaceList.top = 1;
        IfType.m_open = [false, true];
        const component = (id: number, parentId: number, type: number, x: number, y: number, width: number, height: number, colour: number) => Object.assign(new IfType(), { id, parentId, type, if3: true, x, y, width, height, colour });
        let frame = 0;
        for (const row of rows) {
            const [state, width, height, mode, previousRoots] = row;
            GameShell.m_sWid = renderer.width = width;
            GameShell.m_sHei = renderer.height = height;
            GameShell.canvasInvalid = GameShell.fullRedraw = false;
            Client.windowModeRefreshTime = 0n;
            Client.gameState = state;
            renderer.active = true;
            Object.assign(renderer, { ortho2d: false, boundTexture: -1, lighting: true, depthTest: true, fog: true, textureMatrixDirty: false });
            const widgets = [
                component(65536, -1, 0, 7, 5, 19, 15, 0),
                Object.assign(component(65537, 65536, 3, -3, 3, 13, 10, 0x916abc), { fill: true, transparency: mode === 1 ? 0 : 71 }),
                component(65538, 65536, 0, 9, 6, 13, 10, 0),
                Object.assign(component(65539, 65538, 9, -2, -3, 15, 12, 0x7843f9), { lineWidth: 1, lineDirection: mode !== 1 }),
                Object.assign(component(65540, -1, 3, 29, 2, 11, 14, 0xedea15), { transparency: mode === 1 ? 133 : 0 }),
                Object.assign(component(65541, -1, 9, 9, 22, 24, 6, 0x8832c1), { lineWidth: 1 })
            ];
            IfType.m_list = [null, widgets];
            InterfaceList.rootCount = previousRoots;
            InterfaceList.dirty.fill(false);
            InterfaceList.rectRedrawnLastFrame.fill(false);
            InterfaceList.rectangleRedraw.length = 3;
            InterfaceList.rectangleRedraw.fill(false);
            for (let repeat = 0; repeat < 2; repeat++) {
                titlePasses = gamePasses = 0;
                events = [];
                await client['MainRedraw']();
                const roots: string[] = [];
                for (let i = 0; i < InterfaceList.rootCount; i++)
                    roots.push(
                        [
                            InterfaceList.rootX[i],
                            InterfaceList.rootY[i],
                            InterfaceList.rootWidth[i],
                            InterfaceList.rootHeight[i],
                            Number(InterfaceList.rectangleRedraw[i]),
                            Number(InterfaceList.dirty[i]),
                            Number(InterfaceList.rectRedrawnLastFrame[i])
                        ].join(',')
                    );
                const clip = [raster.clipMinX, raster.clipMinY, Reflect.get(raster, 'clipMaxX'), raster.clipMaxY].join(',');
                const actual = [events.join(';'), roots.join(';'), clip, widgets.map(c => c.rootIndex).join(','), titlePasses + ',' + gamePasses];
                expect(actual, row.join(' ') + ' frame ' + repeat).toEqual(original[frame++].split('|'));
            }
        }
    },
    30000,
    'gl'
);

loginFixture(
    import.meta.url,
    'HD rectangles, tooltips and lines match native gn.a through GL failures',
    async () => {
        const { default: Client } = await import('#/client/Client.js');
        const { default: IfType } = await import('#/ui/IfType.js');
        const { default: InterfaceList } = await import('#/ui/InterfaceList.js');
        const { default: renderer } = await import('#/gl/GlRenderer.js');
        const { default: raster } = await import('#/gl/GlRaster.js');
        const { JavaError } = await import('#/util/JavaException.js');
        const { default: WrappedException } = await import('#/util/WrappedException.js');
        const { default: SoftwareFont } = await import('#/graphics/SoftwareFont.js');
        const { default: JagString } = await import('#/datastruct/JagString.js');
        type Row = [type: number, flags: number, width: number, height: number, transparency: number, thickness: number, fault: number];
        const rows: Row[] = [];
        for (let flags = 0; flags < 32; flags++) for (const alpha of [0, 1, 128, 255, 256, -1]) rows.push([3, flags, 20, 15, alpha, 1, 0]);
        for (const [w, h] of [
            [17, 9],
            [4, 17],
            [-11, 12],
            [11, -12],
            [0, 0],
            [0, 8],
            [12, 0]
        ]) {
            for (const flags of [0, 1, 4, 5]) for (const thickness of [0, 1, 4, -3]) rows.push([9, flags, w, h, 217, thickness, 0]);
        }
        for (const [kind, flags, alpha, thickness] of [
            [3, 0, 0, 1],
            [3, 2, 255, 1],
            [9, 4, 0, 1],
            [9, 0, 0, 5]
        ]) {
            for (let step = 1; step < 19; step++) {
                rows.push([kind, flags, 17, 11, alpha, thickness, step], [kind, flags, 17, 11, alpha, thickness, -step]);
            }
        }
        for (const [width, height] of [
            [1, 2],
            [17, 11],
            [35, 23]
        ]) {
            for (const fault of [0, 2, 8, 16, -8]) rows.push([8, 0, width, height, 0, 1, fault]);
            rows.push([8, 16, width, height, 0, 1, 0]);
        }
        const dir = mkdtempSync(join(tmpdir(), 'rs530-hd-widget-primitives-'));
        try {
            const libs = [dir, hdGamepackPath, joglPath].join(delimiter);
            const javaSources = ['HdFrameBoundaryOracle.java', 'HdWidgetFrameOracle.java', 'HdWidgetPrimitiveOracle.java'].map(file => join(import.meta.dir, file));
            const compile = Bun.spawnSync(['javac', '-cp', libs, '-d', dir, join(import.meta.dir, '../hd/GlRecorder.java'), ...javaSources]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', libs, 'HdWidgetPrimitiveOracle'], { stdin: Buffer.from(rows.map(row => row.join(' ')).join('\n') + '\n'), maxBuffer: 4194304 });
            expect(java.exitCode, java.stderr.toString()).toBe(0);
            const original = java.stdout.toString().trimEnd().split(/\r?\n/);
            expect(original).toHaveLength(rows.length);
            const fatal = new JavaError('native GL error');
            let events: string[] = [],
                fault = 0;
            const gl = new Proxy({} as GL, {
                get(_target, name: keyof GL) {
                    return (...args: number[]) => {
                        events.push(recordedCall(name, args));
                        if (events.length === fault) throw fatal;
                        if (events.length === -fault) renderer.gl = null;
                    };
                }
            });
            InterfaceList.rectRedrawnLastFrame[0] = true;
            Client.p12 = new SoftwareFont(new Uint8Array(257));
            renderer.width = 41;
            renderer.height = 33;
            renderer.active = true;
            for (const [index, row] of rows.entries()) {
                const [type, flags, width, height, transparency, lineWidth, failure] = row;
                const c = Object.assign(new IfType(), {
                    parentId: -1,
                    id: 20,
                    type,
                    x: 5,
                    y: 4,
                    width,
                    height,
                    colour: 0xfb8244,
                    if3: Boolean(flags & 1),
                    fill: Boolean(flags & 2),
                    lineDirection: Boolean(flags & 4),
                    comparisonOps: flags & 8 ? new Int32Array(0) : null,
                    activeColour: 0x158fee,
                    overColour: 0x98765b,
                    activeOverColour: 0xacbd12,
                    transparency,
                    lineWidth
                });
                InterfaceList.mouseOverComponent = flags & 16 ? c : null;
                if (type === 8) {
                    Client.tooltipComponent = flags & 16 ? null : c;
                    InterfaceList.tooltipDelay = Client.tooltipTimer = 5;
                    c.textValue = JagString.empty;
                }
                renderer.gl = gl;
                Object.assign(renderer, { ortho2d: false, boundTexture: -1, lighting: true, depthTest: true, fog: true });
                fault = failure;
                events = [];
                let result = 'ok';
                try {
                    Client.DrawLayer(3, [c], -1, 27, 4, 0, 29, 7, 2);
                } catch (error) {
                    if (error === fatal) result = 'Error';
                    else if (error instanceof WrappedException && error.cause instanceof TypeError) result = 'NullPointerException ' + error.context;
                    else throw error;
                }
                const clip = [raster.clipMinX, raster.clipMinY, Reflect.get(raster, 'clipMaxX'), raster.clipMaxY];
                if (type === 8 && failure === 0) {
                    const primitives = original[index].match(/G\.glBegin\(\d+\)/g) ?? [];
                    expect(primitives).toEqual(flags & 16 ? [] : ['G.glBegin(6)', 'G.glBegin(2)']);
                }
                expect([result, c.rootIndex, clip.join(','), events.join(';')].join('|'), row.join(' ')).toBe(original[index]);
            }
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    30000,
    'gl'
);
