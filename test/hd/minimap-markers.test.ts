import { requireNonNull } from '#/util/JavaArray.js';
import { expect } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import OrbitCamera from '#/client/OrbitCamera.js';
import Pix3D from '#/dash3d/Pix3D.js';
import { capsProfileFromJson } from '#/gl/CapsProfile.js';
import GlRaster from '#/gl/GlRaster.js';
import GlRenderer from '#/gl/GlRenderer.js';
import GlSprite from '#/gl/GlSprite.js';
import { GlTraceWriter } from '#/gl/GlTrace.js';
import NullGL from '#/gl/NullGL.js';
import RecordingGL from '#/gl/RecordingGL.js';
import AbstractSprite from '#/graphics/AbstractSprite.js';
import Pix2D from '#/graphics/Pix2D.js';
import Pix32 from '#/graphics/Pix32.js';
import SpriteLoader from '#/graphics/SpriteLoader.js';
import IfType from '#/ui/IfType.js';
import Minimenu from '#/ui/Minimenu.js';
import WrappedException from '#/util/WrappedException.js';
import { loginFixture } from '../login-fixture.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';
import { diffTraces } from './glTraceDiff.js';

function pixels(length: number, seed: number): Int32Array {
    return Int32Array.from({ length }, (_, i) => (i % 5 === 0 ? 0 : Math.imul(i + 1, seed)));
}

function failure(error: unknown): string {
    const cause = error instanceof WrappedException ? error.cause : error;
    const context = error instanceof WrappedException ? error.context : '';
    if (!(cause instanceof Error)) throw error;
    let name: string;
    if (cause.message.startsWith('ClassCastException')) name = 'ClassCastException';
    else if (cause instanceof TypeError) name = 'NullPointerException';
    else if (cause.message === '/ by zero') name = 'ArithmeticException';
    else if (cause.message.startsWith('array index ')) name = 'ArrayIndexOutOfBoundsException';
    else if (cause.message === 'IllegalStateException') name = 'IllegalStateException';
    else throw error;
    return name + ':' + context;
}

loginFixture(
    import.meta.url,
    'HD minimap dots and arrows match both original rendering modes',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-hd-markers-'));
        try {
            const rows: number[][] = [];
            for (const active of [0, 1]) {
                for (const op of [0, 1]) {
                    // Inside, on and outside the 30/45 pixel radii and the original 600 pixel limit.
                    for (const [dx, dz] of [
                        [0, 0],
                        [18, 23],
                        [30, 0],
                        [31, 0],
                        [45, 0],
                        [46, 0],
                        [-47, 23],
                        [-4, -599],
                        [600, 0],
                        [601, 0],
                        [46341, 0],
                        [65536, -65536]
                    ]) {
                        for (const [yaw, zoom] of [
                            [67, 0],
                            [323, 0],
                            [579, 96],
                            [1091, 0],
                            [1603, -1],
                            [-270, 193]
                        ])
                            rows.push([active, op, dx, dz, yaw, zoom, 8, 12, 0]);
                    }
                    for (const mode of [1, 2, 3, 4, 5, 6, 7, 8]) {
                        for (const [dx, dz] of [
                            [2, 1],
                            [-22, 25],
                            [35, 0],
                            [100, 67],
                            [601, 0]
                        ])
                            rows.push([active, op, dx, dz, 901, 31, 5, 8, mode]);
                    }
                    for (const [x, y] of [
                        [-25, -15],
                        [55, 55],
                        [2147483647, -2147483648]
                    ]) {
                        for (const [dx, dz] of [
                            [4, -2],
                            [35, 12]
                        ])
                            rows.push([active, op, dx, dz, 330, 77, x, y, 1]);
                    }
                    for (const dx of [3, 30, 44, 601]) rows.push([active, op, dx, 0, 45, -256, 8, 12, 0]);
                }
            }
            const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
            const access = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED'];
            const compile = Bun.spawnSync(['javac', ...access, '-encoding', 'UTF-8', '-cp', cp, '-d', dir, join(import.meta.dir, 'GlRecorder.java'), join(import.meta.dir, 'HdMinimapMarkersOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const profile = join(import.meta.dir, 'rtx5070.json');
            const run = Bun.spawnSync(['java', ...access, '-Djava.awt.headless=true', '-Dgltrace.stacks=false', '-Dgltrace.caps=' + profile, '-XX:+UnlockDiagnosticVMOptions', '-XX:-UseLibmIntrinsic', '-cp', cp, 'HdMinimapMarkersOracle', dir], {
                stdin: Buffer.from(rows.map(row => row.join(' ')).join('\n') + '\n'),
                maxBuffer: 4 * 1024 * 1024
            });
            expect(run.exitCode, run.stderr.toString()).toBe(0);
            const lines = run.stdout.toString().trimEnd().split(/\r?\n/);
            expect(lines.length).toBe(rows.length);
            const writer = new GlTraceWriter();
            GlRenderer.gl = new RecordingGL(new NullGL(capsProfileFromJson(readFileSync(profile, 'utf8'))), writer);
            GlRenderer.active = true;
            GlRenderer.width = 96;
            GlRenderer.height = 88;
            const dot = new Pix32(13, 15, 2, 3, 7, 8, pixels(56, 12471));
            const edge = new Pix32(30, 30, 0, 0, 30, 30, pixels(900, 1237));
            const glDot = new GlSprite(dot);
            const glEdge = new GlSprite(edge);
            const glMask = new GlSprite(71, 61, 0, 0, 71, 61, pixels(71 * 61, 71));
            IfType.m_spriteCache.Put(20n, glMask);
            IfType.m_spriteCache.Put(21n, dot);
            for (const [index, [active, op, dx, dz, yaw, zoom, x, y, mode]] of rows.entries()) {
                GlRenderer.active = active === 1;
                OrbitCamera.followYaw = yaw;
                OrbitCamera.minimapAngle = -67;
                OrbitCamera.minimapZoom = zoom;
                writer.mark('row' + index);
                const frame = pixels(96 * 88, 37);
                const [left, top, right, bottom] = mode === 1 ? [33, 28, 49, 41] : [3, 7, 91, 80];
                Pix2D.setPixels(frame, 96, 88);
                Pix2D.setClipping(left, top, right, bottom);
                if (GlRenderer.active) GlRaster.setClipping(left, top, right, bottom);
                const widget = new IfType();
                widget.width = 71;
                widget.height = 61;
                widget.spriteId = mode === 2 ? -1 : mode === 3 ? 21 : 20;
                widget.maskStarts = Int32Array.from({ length: mode === 8 ? 1 : bottom - top }, (_, i) => (i % 6) + 3);
                widget.maskWidths = Int32Array.from({ length: bottom - top }, (_, i) => right - left - (i % 16));
                let sprite: AbstractSprite | null = active ? glDot : dot;
                let arrow: AbstractSprite | null = active ? glEdge : edge;
                if (mode === 4) {
                    sprite = active ? dot : glDot;
                    arrow = active ? edge : glEdge;
                } else if (mode === 5) {
                    sprite = null;
                    arrow = null;
                }
                Client.hintMapMarkers = [sprite];
                SpriteLoader.hintMapEdge = [arrow];
                IfType.resourceMissing = true;
                let result = 'ok';
                const component = mode === 6 ? null : widget;
                try {
                    if (op === 0) Client.DrawDot(component, x, sprite, true, dx, y, dz);
                    else Client.DrawArrow(component, dx, dz, y, x, mode === 7 ? 1 : 0);
                } catch (error) {
                    result = failure(error);
                }
                const bytes = Buffer.allocUnsafe(frame.length * 4);
                for (let i = 0; i < frame.length; i++) bytes.writeInt32BE(frame[i], i * 4);
                const digest = createHash('sha256').update(bytes).digest('hex');
                expect(result + '|' + IfType.resourceMissing + '|' + digest, 'case ' + rows[index].join(' ')).toBe(lines[index]);
            }
            const originalTrace = readFileSync(join(dir, 'trace.tsv'), 'utf8');
            expect(originalTrace).toContain('glRotatef');
            expect(originalTrace).toContain('glMultiTexCoord2f');
            const diff = diffTraces(originalTrace, writer.text(), { includeDeletions: true });
            expect(diff.equal, diff.report).toBe(true);

            const observed = join(dir, 'observed');
            const install = Bun.spawnSync(['java', ...access, '-cp', cp, 'HdMinimapMarkersOracle', 'instrument', hdGamepackPath, observed]);
            expect(install.exitCode, install.stderr.toString()).toBe(0);
            const reads = Bun.spawnSync(['java', ...access, '-cp', observed + delimiter + cp, 'HdMinimapMarkersOracle', 'reads']);
            expect(reads.exitCode, reads.stderr.toString()).toBe(0);
            const expected = reads.stdout.toString().trimEnd().split(/\r?\n/);
            const sin = Pix3D.sinTable,
                cos = Pix3D.cosTable;
            const dotProbe = new Pix32(1, 1, 0, 0, 1, 1, new Int32Array([0x123456]));
            const owners: [object, string][] = [
                [GlRenderer, 'active'],
                [SpriteLoader, 'hintMapEdge'],
                [Client, 'hintMapMarkers'],
                [OrbitCamera, 'followYaw'],
                [OrbitCamera, 'minimapAngle'],
                [OrbitCamera, 'minimapZoom'],
                [Pix3D, 'sinTable'],
                [Pix3D, 'cosTable'],
                [Minimenu, 'tooltipX2']
            ];
            const descriptors = owners.map(([host, key]) => requireNonNull(Object.getOwnPropertyDescriptor(host, key)));
            Pix2D.setPixels(new Int32Array(32 * 32), 32, 32);
            let caseIndex = 0;
            try {
                for (const active of [false, true])
                    for (const op of [0, 1, 2]) {
                        for (let mode = 0; mode < 11; mode++) {
                            const widget = new IfType();
                            const fields: string[] = [];
                            const observe = (owner: object, field: string, label: string, read: () => unknown): void => {
                                Object.defineProperty(owner, field, {
                                    configurable: true,
                                    get() {
                                        fields.push(label);
                                        return read();
                                    }
                                });
                            };
                            const dx = mode === 5 ? 601 : mode === 6 || mode === 7 || mode === 10 || op === 0 ? 7 : 100;
                            const sprite = mode === 7 ? null : dotProbe;
                            const component = mode === 9 ? null : widget;
                            widget.maskStarts = new Int32Array(32);
                            widget.maskWidths = new Int32Array(32).fill(32);
                            observe(widget, 'width', 'width', () => 71);
                            observe(widget, 'height', 'height', () => 61);
                            observe(GlRenderer, 'active', 'active', () => active);
                            observe(SpriteLoader, 'hintMapEdge', 'edges', () => (mode === 1 ? [] : [null]));
                            observe(Client, 'hintMapMarkers', 'markers', () => (mode === 10 ? [] : [sprite]));
                            observe(OrbitCamera, 'minimapAngle', 'angle', () => -67);
                            observe(OrbitCamera, 'followYaw', 'yaw', () => 240);
                            observe(Pix3D, 'sinTable', 'sin', () => (mode === 2 ? null : sin));
                            observe(Pix3D, 'cosTable', 'cos', () => (mode === 3 ? null : cos));
                            let zoomReads = 0;
                            observe(OrbitCamera, 'minimapZoom', 'zoom', () => (mode === 8 || (++zoomReads === 2 && mode === 4) ? -256 : 17));
                            let tooltipX = 311;
                            Object.defineProperty(Minimenu, 'tooltipX2', {
                                configurable: true,
                                set(value: number) {
                                    fields.push('setX');
                                    tooltipX = value;
                                }
                            });
                            let result = 'ok';
                            try {
                                if (op === 0) Client.DrawDot(component, 8, sprite, true, dx, 12, 13);
                                else Client.DrawArrow(component, dx, 13, 12, 8, 0, op === 2);
                            } catch (error) {
                                result = failure(error);
                            }
                            expect(fields.join(',') + '|' + tooltipX + '|' + result, 'active=' + active + ',op=' + op + ',mode=' + mode).toBe(expected[caseIndex++]);
                        }
                    }
            } finally {
                owners.forEach(([host, key], i) => Object.defineProperty(host, key, descriptors[i]));
            }
            expect(caseIndex).toBe(expected.length);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    90000,
    'gl'
);
