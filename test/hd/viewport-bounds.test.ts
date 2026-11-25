import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import GlRenderer from '#/gl/GlRenderer.js';
import type { GL } from '#/jogl/GL.js';
import WrappedException from '#/util/WrappedException.js';
import { loginFixture } from '../login-fixture.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

function cases(): number[][] {
    const rows: number[][] = [];
    for (const active of [0, 1]) {
        for (const [width, height] of [
            [0, -5],
            [1, 1],
            [765, 333],
            [765, 334],
            [765, 335],
            [765, 433],
            [765, 434],
            [765, 435],
            [2001, 205],
            [89, 1003],
            [32768, 32769],
            [2147483647, 2147483647],
            [37, 8388608]
        ]) {
            for (const [fov0, fov1, min, max, aspect0, aspect1] of [
                [256, 205, 1, 32767, 1, 32767],
                [230, 505, 250, 263, 410, 500],
                [505, 230, 245, 300, 450, 520]
            ]) {
                for (const bars of [0, 1]) rows.push([active, -17, 13, width, height, bars, 81, 0, fov0, fov1, min, max, aspect0, aspect1]);
            }
        }
    }
    for (const guard of [10, 11, 81])
        for (const fault of [0, 1, 2]) {
            rows.push([1, 2147483645, -11, 2001, 205, 1, guard, fault, 230, 505, 250, 263, 410, 500]);
            rows.push([1, -11, 2147483645, 89, 1003, 1, guard, fault, 230, 505, 250, 263, 410, 500]);
        }
    return rows;
}

function results(rows: number[][]): string[] {
    let commands: string[] = [],
        fault = 0,
        fans = 0,
        vertices = 0;
    const stop = new Error('GL command');
    const bits = new DataView(new ArrayBuffer(8));
    GlRenderer.width = 765;
    GlRenderer.height = 503;
    GlRenderer.gl = new Proxy({} as GL, {
        get(_target, key: string) {
            return (...args: unknown[]) => {
                const values = args.map(value => {
                    if (typeof value === 'number' && (key === 'glVertex2f' || key === 'glColor4f')) {
                        bits.setFloat32(0, value);
                        return bits.getUint32(0).toString(16);
                    }
                    if (typeof value === 'number' && key === 'glOrtho') {
                        bits.setFloat64(0, value);
                        return bits.getBigUint64(0).toString(16);
                    }
                    return String(value);
                });
                commands.push(key + '(' + values.join(',') + ')');
                if (key === 'glBegin') fans++;
                if (key === 'glVertex2f') vertices++;
                if ((fault === 1 && key === 'glDisable') || (fault === 2 && fans === 2 && vertices === 5)) throw stop;
            };
        }
    });
    return rows.map(a => {
        GlRenderer.active = Boolean(a[0]);
        [Client.viewportFovLow, Client.zoomWidth2, Client.fovClampMinWidth, Client.viewportMaxZoom, Client.zoomWidthMin, Client.fovClampMaxHeight] = a.slice(8);
        [Client.viewportX, Client.viewportY, Client.viewportWidth, Client.viewportHeight, Client.viewportScale] = [-1001, -1002, -1003, -1004, -1005];
        commands = [];
        fans = 0;
        vertices = 0;
        fault = a[7];
        let result = 'ok';
        try {
            Client.GdmCalcWindowSize(a[1], a[2], a[3], a[4], Boolean(a[5]), a[6]);
        } catch (error) {
            if (!(error instanceof WrappedException) || !error.context) throw error;
            const kind = error.cause === stop ? 'IllegalStateException' : error.cause?.message.includes('zero') ? 'ArithmeticException' : null;
            if (!kind) throw error;
            result = kind + ' ' + error.context.slice(error.context.lastIndexOf('ja.C('));
        }
        return [result, [Client.viewportX, Client.viewportY, Client.viewportWidth, Client.viewportHeight, Client.viewportScale].join(','), commands.join(';')].join('|');
    });
}

loginFixture(
    import.meta.url,
    'HD viewport bounds scale and emitted letterbox commands match ja.a',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-viewport-bounds-'));
        try {
            const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
            const compile = Bun.spawnSync(['javac', '-encoding', 'UTF-8', '-cp', cp, '-d', dir, join(import.meta.dir, 'ViewportBoundsOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const rows = cases();
            const run = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', cp, 'ViewportBoundsOracle'], { stdin: Buffer.from(rows.map(a => a.join(' ')).join('\n') + '\n') });
            expect(run.exitCode, run.stderr.toString()).toBe(0);
            const original = run.stdout.toString().trimEnd().split(/\r?\n/);
            expect(original.length).toBe(rows.length);
            const actual = results(rows);
            for (const [i, row] of original.entries()) expect(actual[i], rows[i].join(' ')).toBe(row);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    45000,
    'gl'
);
