import { expect } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import OrbitCamera from '#/client/OrbitCamera.js';
import Pix3D from '#/dash3d/Pix3D.js';
import AbstractSprite from '#/graphics/AbstractSprite.js';
import Pix2D from '#/graphics/Pix2D.js';
import Pix32 from '#/graphics/Pix32.js';
import SpriteLoader from '#/graphics/SpriteLoader.js';
import IfType from '#/ui/IfType.js';
import { loginFixture } from './login-fixture.js';
import { gamepackPath } from './reference.js';

loginFixture(
    import.meta.url,
    'minimap dots and hint arrows match the 530 gamepack',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-minimap-markers-')),
            probed = join(dir, 'observed');
        const nativeSin = Pix3D.sinTable,
            nativeCos = Pix3D.cosTable;
        function run(row: number[], observed: boolean): string {
            const [op, mode, dx, dz, width, height, yaw, zoom, x, y, id] = row;
            const trace: string[] = [];
            const W = 96,
                H = 88;
            let widthReads = 0,
                heightReads = 0,
                zoomReads = 0,
                currentWidth = width,
                currentHeight = height,
                currentZoom = zoom;
            const frame = Int32Array.from({ length: mode === 18 ? (W * H) / 2 : W * H }, (_, i) => (37 * i) ^ 0xaac9);
            Pix2D.setPixels(frame, W, H);
            Pix2D.setClipping(3, 7, 91, 80);
            const widget = new IfType();
            let component: IfType | null = widget;
            let starts: Int32Array | null = Int32Array.from({ length: 73 }, (_, i) => (i % 6) + 3);
            let widths: Int32Array | null = Int32Array.from({ length: 73 }, (_, i) => 81 - (i % 16));
            const dot = new Pix32(
                13,
                15,
                2,
                3,
                7,
                8,
                Int32Array.from({ length: 56 }, (_, i) => (i % 3 === 0 ? 0 : 12471 * i))
            );
            const edge = new Pix32(30, 30);
            edge.pixels = Int32Array.from({ length: 900 }, (_, i) => (i % 6 === 0 ? 0 : (i * 1237) ^ 0xb731));
            let sprite: AbstractSprite | null = dot;
            Client.hintMapMarkers = [null, dot];
            SpriteLoader.hintMapEdge = [null, edge];
            let sin = nativeSin,
                cos = nativeCos;
            switch (mode) {
                case 1:
                    component = null;
                    break;
                case 2:
                    sprite = null;
                    component = null;
                    Client.hintMapMarkers[1] = null;
                    break;
                case 3:
                    sprite = Object.create(AbstractSprite.prototype);
                    Client.hintMapMarkers[1] = sprite;
                    SpriteLoader.hintMapEdge[1] = sprite;
                    break;
                case 4:
                    SpriteLoader.hintMapEdge = null;
                    break;
                case 5:
                    Client.hintMapMarkers = null;
                    break;
                case 6:
                    sin = null;
                    break;
                case 7:
                    cos = null;
                    break;
                case 8:
                    sin = new Int32Array(0);
                    break;
                case 9:
                    cos = new Int32Array(0);
                    break;
                case 10:
                    starts = null;
                    break;
                case 11:
                    widths = null;
                    break;
                case 12:
                    starts = new Int32Array(72);
                    break;
                case 13:
                    widths = new Int32Array(30);
                    break;
                case 14:
                    starts.fill(9);
                    widths.fill(-5);
                    break;
                case 15:
                    Pix2D.setPixels(null, W, H);
                    Pix2D.setClipping(3, 7, 91, 80);
                    break;
                case 16:
                    dot.pixels = new Int32Array(20);
                    edge.pixels = new Int32Array(35);
                    break;
                case 17:
                    dot.cropH = -2147483648;
                    dot.cropW = 2147483647;
                    break;
                case 19: {
                    const pos = (yaw - 67) & 2047;
                    sin = new Int32Array(2048);
                    cos = new Int32Array(2048);
                    sin[pos] = 0x7fffffff;
                    cos[pos] = -0x400001;
                    break;
                }
                case 20:
                    Client.hintMapMarkers = [];
                    SpriteLoader.hintMapEdge = [];
                    break;
            }
            const read = (host: object, field: string, get: () => unknown) => Object.defineProperty(host, field, { configurable: true, get });
            read(widget, 'width', () => {
                const value = currentWidth;
                if (observed) {
                    trace.push('w' + value);
                    if (mode === 21 && ++widthReads === 1) currentWidth = (value + 18) | 0;
                }
                return value;
            });
            read(widget, 'height', () => {
                const value = currentHeight;
                if (observed) {
                    trace.push('h' + value);
                    if (mode === 21 && ++heightReads === 1) currentHeight = (value - 10) | 0;
                }
                return value;
            });
            read(widget, 'maskStarts', () => {
                if (observed) trace.push('x');
                return starts;
            });
            read(widget, 'maskWidths', () => {
                if (observed) trace.push('n');
                return widths;
            });
            read(OrbitCamera, 'minimapZoom', () => {
                const value = currentZoom;
                if (observed) {
                    trace.push('z' + value);
                    if (mode === 22 && ++zoomReads === 1) currentZoom = -255;
                }
                return value;
            });
            read(OrbitCamera, 'minimapAngle', () => {
                if (observed) trace.push('a');
                return -67;
            });
            read(OrbitCamera, 'followYaw', () => {
                if (observed) trace.push('y');
                return yaw;
            });
            read(Pix3D, 'sinTable', () => {
                if (observed) trace.push('s');
                return sin;
            });
            read(Pix3D, 'cosTable', () => {
                if (observed) trace.push('c');
                return cos;
            });
            if (observed) {
                dot.drawMasked = (x, y, starts, widths) => {
                    trace.push('m' + x + ',' + y);
                    Pix32.prototype.drawMasked.call(dot, x, y, starts, widths);
                };
                edge.drawRotatedRadians = (x, y, w, h, ax, ay, angle, zoom) => {
                    trace.push('r' + [x, y, w, h, ax, ay, (angle * 1e8) | 0, zoom].join(','));
                    Pix32.prototype.drawRotatedRadians.call(edge, x, y, w, h, ax, ay, angle, zoom);
                };
            }
            let status = 'ok';
            try {
                if (op === 0) Client.DrawArrow(component, dx, dz, y, x, id);
                else Client.DrawDot(component, x, sprite, op === 1, dx, y, dz);
            } catch (e) {
                if (e instanceof TypeError && e.message.startsWith('ClassCastException')) status = 'cast';
                else if (e instanceof TypeError) status = 'null';
                else if (e instanceof Error && e.message === 'IllegalStateException') status = 'state';
                else if (e instanceof RangeError && e.message === '/ by zero') status = 'division';
                else if (e instanceof RangeError && e.message.startsWith('array index ')) status = 'bounds:' + e.message.slice(12);
                else throw e;
            }
            return [status, trace.join(';'), frame.reduce((hash, value) => (Math.imul(hash, 31) + value) | 0, 1)].join('|');
        }
        try {
            const access = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED'];
            const compile = Bun.spawnSync(['javac', ...access, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game/MinimapMarkersOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const cp = dir + delimiter + gamepackPath;
            mkdirSync(probed);
            const rewrite = Bun.spawnSync(['java', ...access, '-cp', cp, 'MinimapMarkersOracle', gamepackPath, probed]);
            expect(rewrite.exitCode, rewrite.stderr.toString()).toBe(0);
            for (const observed of [false, true]) {
                const rows: number[][] = [];
                for (const op of [0, 1, 2]) {
                    for (const [dx, dz] of [
                        [0, 0],
                        [18, 23],
                        [30, 0],
                        [31, 0],
                        [-44, -20],
                        [45, 0],
                        [80, 20],
                        [-4, -599],
                        [600, 0],
                        [601, 0],
                        [46341, 0],
                        [65536, -65536],
                        [2147483647, -2147483648]
                    ]) {
                        for (const angle of [0, 67, 579, 1091, 1931]) rows.push([op, 0, dx, dz, 71, 60, angle, 0, 8, 12, 1]);
                    }
                    for (let mode = 1; mode <= 22; mode++)
                        for (const [dx, dz] of [
                            [3, 1],
                            [-29, 35],
                            [500, 100],
                            [602, 0]
                        ])
                            rows.push([op, mode, dx, dz, 71, 60, -373, 95, 8, 12, 1]);
                    for (const width of [0, 1, -9, 2147483647]) for (const zoom of [-256, -257, 2147483647]) rows.push([op, 0, -7, 13, width, 57, 135, zoom, 2147483647, -2147483648, 1]);
                    for (const id of [-1, 0, 1, 2]) for (const mode of [0, 6, 7, 21]) for (const dx of [2, 30, 140, 700]) rows.push([op, mode, dx, 3, 60, 47, 567, -256, 9, 17, id], [op, mode, dx, 3, 60, 47, 567, 12, 9, 17, id]);
                }
                const java = Bun.spawnSync(['java', '-XX:-OmitStackTraceInFastThrow', ...access, '-cp', observed ? probed + delimiter + cp : cp, 'MinimapMarkersOracle'], {
                    stdin: Buffer.from(rows.map(row => row.join(' ')).join('\n') + '\n'),
                    maxBuffer: 8 * 1024 * 1024
                });
                expect(java.exitCode, java.stderr.toString()).toBe(0);
                const lines = java.stdout.toString().trimEnd().split(/\r?\n/);
                expect(lines.length).toBe(rows.length);
                for (const [i, row] of rows.entries()) expect(run(row, observed), row.join(' ')).toBe(lines[i]);
            }
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    60000
);
