import { expect } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import LRUHashCache from '#/datastruct/LRUHashCache.js';
import { capsProfileFromJson } from '#/gl/CapsProfile.js';
import GlAlphaSprite from '#/gl/GlAlphaSprite.js';
import GlRaster from '#/gl/GlRaster.js';
import GlRenderer from '#/gl/GlRenderer.js';
import GlSprite from '#/gl/GlSprite.js';
import { GlTraceWriter } from '#/gl/GlTrace.js';
import NullGL from '#/gl/NullGL.js';
import RecordingGL from '#/gl/RecordingGL.js';
import AbstractSprite from '#/graphics/AbstractSprite.js';
import Pix2D from '#/graphics/Pix2D.js';
import Pix32 from '#/graphics/Pix32.js';
import SoftwareAlphaSprite from '#/graphics/SoftwareAlphaSprite.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import { JavaError } from '#/util/JavaException.js';
import WrappedException from '#/util/WrappedException.js';
import { localAssets } from '../cachefile.js';
import { loginFixture } from '../login-fixture.js';
import { cachePath } from '../reference.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';
import { diffTraces } from './glTraceDiff.js';

function cases(): number[][] {
    const rows: number[][] = [];
    for (const active of [0, 1])
        for (const alpha of [0, 1])
            for (let shape = 0; shape < 4; shape++) {
                for (const angle of [0, 8192, -17321]) for (const opacity of [0, 73, 255, 256]) rows.push([active, alpha, shape, angle, opacity, 0]);
                for (const mode of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14]) rows.push([active, alpha, shape, 8192, 73, mode]);
                if (!active) rows.push([active, alpha, shape, 0, 73, 5]);
            }
    return rows;
}

function fault(error: unknown): string {
    let context = '';
    if (error instanceof WrappedException) {
        context = '@' + error.context;
        error = error.cause;
    }
    if (error instanceof JavaError) return 'AssertionError' + context;
    if (error instanceof TypeError) return (error.message.includes('ClassCastException') ? 'ClassCastException' : 'NullPointerException') + context;
    if (error instanceof RangeError) return (error.message === '/ by zero' ? 'ArithmeticException' : 'ArrayIndexOutOfBoundsException') + context;
    if (error instanceof Error && error.message === 'driver') return 'IllegalStateException' + context;
    throw error;
}

async function compare(rows: number[][]): Promise<void> {
    const temp = mkdtempSync(join(tmpdir(), 'rs530-tiled-widget-'));
    try {
        const input = join(temp, 'cases.txt');
        writeFileSync(input, rows.map(r => r.join(' ')).join('\n'));
        const profile = join(import.meta.dir, 'rtx5070.json');
        const cp = [temp, hdGamepackPath, joglPath].join(delimiter);
        const cc = Bun.spawnSync(['javac', '-cp', cp, '-sourcepath', import.meta.dir, '-d', temp, join(import.meta.dir, 'HdTiledWidgetOracle.java')]);
        expect(cc.exitCode, cc.stderr.toString()).toBe(0);
        const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-Dgltrace.caps=' + profile, '-Dgltrace.stacks=false', '-cp', cp, 'HdTiledWidgetOracle', temp, input, cachePath], { maxBuffer: 10 * 1024 * 1024 });
        expect(java.exitCode, java.stderr.toString()).toBe(0);
        const expected = java.stdout.toString().trimEnd().split(/\r?\n/);
        expect(expected).toHaveLength(rows.length);
        const writer = new GlTraceWriter();
        const gl = new RecordingGL(new NullGL(capsProfileFromJson(readFileSync(profile, 'utf8'))), writer);
        let drawing = false,
            mode = 0,
            scissor = 0;
        for (const name of ['glScissor', 'glCallList', 'glBegin', 'glVertex2f'] as const) {
            const method = gl[name];
            Reflect.set(gl, name, (...args: number[]) => {
                if (drawing) {
                    if (name === 'glScissor' && ((++scissor === 2 && mode === 7) || (scissor === 3 && mode === 8))) throw Error('driver');
                    if (mode === 6 && (name === 'glCallList' || name === 'glBegin')) throw Error('driver');
                    if (mode === 13 && name === 'glVertex2f') throw new JavaError('fatal');
                }
                return Reflect.apply(method, gl, args);
            });
        }
        GlRenderer.gl = gl;
        GlRenderer.width = 41;
        GlRenderer.height = 33;
        IfType.m_pSprites = localAssets(cachePath, [8]).archive(8);
        const retained: object[] = [];
        const differences = new Map<string, string>();
        for (const [number, row] of rows.entries()) {
            const [active, hasAlpha, shape, angle, transparency, nextMode] = row;
            const alpha = hasAlpha === 1;
            mode = nextMode;
            writer.mark('case' + number);
            GlRenderer.active = active === 1;
            const c = new IfType();
            Object.assign(c, {
                id: 20,
                parentId: -1,
                type: 5,
                if3: true,
                spriteTiling: true,
                x: 5,
                y: 4,
                width: 24,
                height: 18,
                spriteAngle: angle,
                transparency,
                spriteAlpha: alpha,
                spriteId: mode === 9 ? [9, 641, 802, 13][shape] : mode === 14 ? -1 : 300,
                itemId: -1
            });
            const key = (BigInt(hasAlpha) << 35n) + BigInt(c.spriteId);
            const cache = new LRUHashCache<object>(16);
            Reflect.set(IfType, 'm_spriteCache', cache);
            let inserted: object | null = null;
            if (mode !== 9 && mode !== 14) {
                const w = (shape & 1) === 0 ? 4 : 3,
                    h = (shape & 2) === 0 ? 4 : 3;
                const cropW = mode === 3 ? 0 : w === 4 ? 7 : 8;
                const cropH = mode === 4 ? 0 : h === 4 ? 5 : 8;
                const pixels = Int32Array.from({ length: w * h }, (_, i) => {
                    const rgb = (0x61275a + i * 0x214257) & 0xffffff;
                    return i % 5 === 1 ? 0 : rgb | (alpha ? ((i * 61 + 47) & 255) << 24 : 0);
                });
                const software = new (alpha ? SoftwareAlphaSprite : Pix32)(cropW, cropH, 1, 1, w, h, pixels);
                let cached: object = software;
                if (mode === 2) cached = {};
                else if (GlRenderer.active !== (mode === 1)) cached = new (alpha ? GlAlphaSprite : GlSprite)(software);
                if (cached instanceof AbstractSprite) {
                    if (mode === 10) cached.width = 0;
                    if (mode === 11) cached.height = 0;
                }
                cache.Put(key, cached);
                inserted = cached;
                retained.push(cached);
            }
            InterfaceList.rectRedrawnLastFrame[0] = true;
            InterfaceList.dirty[0] = false;
            IfType.resourceMissing = true;
            const frame = Int32Array.from({ length: mode === 5 ? 226 : 41 * 33 }, (_, i) => 0x172635 + i * 13);
            Pix2D.setPixels(frame, 41, 33);
            Pix2D.setClipping(1, 1, 20, 14);
            GlRaster.setClipping(1, 2, 21, 17);
            scissor = 0;
            drawing = true;
            let result = 'ok';
            try {
                Client.DrawLayer(3, [c], -1, 27, 4, 0, 30, 7, 2);
            } catch (e) {
                result = fault(e);
            } finally {
                drawing = false;
            }
            const cached = cache.Find(key);
            if (cached !== null) retained.push(cached);
            let type = cached === null ? '_' : cached instanceof GlAlphaSprite ? 'el' : cached instanceof GlSprite ? 'cf' : cached instanceof SoftwareAlphaSprite ? 'am' : cached instanceof Pix32 ? 'mm' : 'other';
            type += ':' + (cached === null ? 'empty' : cached === inserted ? 'same' : 'loaded');
            if (cached instanceof AbstractSprite) type += ',' + [cached.cropW, cached.cropH, cached.width, cached.height].join(',');
            const softwareClip = [Pix2D.clipMinX, Pix2D.clipMinY, Pix2D.clipMaxX, Pix2D.clipMaxY].join(',');
            const hardwareClip = [GlRaster.clipMinX, GlRaster.clipMinY, GlRaster['clipMaxX'], GlRaster.clipMaxY].join(',');
            const image = Buffer.alloc(frame.byteLength);
            for (let i = 0; i < frame.length; i++) image.writeInt32LE(frame[i], i * 4);
            const fields = [result, type, softwareClip, hardwareClip, [c.rootIndex, IfType.resourceMissing, InterfaceList.dirty[0]].join(','), image.toString('base64')];
            const original = expected[number].split('|');
            for (const [i, value] of fields.entries()) {
                if (value === original[i]) continue;
                if (i === 5) {
                    const reference = Buffer.from(original[i], 'base64');
                    const index = image.findIndex((byte, j) => byte !== reference[j]);
                    if (!differences.has('pixels')) differences.set('pixels', row.join(' ') + ': first framebuffer byte ' + index);
                } else {
                    const detail = 'field ' + i + ' expected ' + original[i] + ' actual ' + value;
                    if (!differences.has(detail)) differences.set(detail, row.join(' ') + ': ' + detail);
                }
            }
        }
        const trace = readFileSync(join(temp, 'trace.tsv'), 'utf8');
        const actual = writer.text();
        if (trace !== actual) {
            const diff = diffTraces(trace, actual, { context: 4, includeDeletions: true });
            differences.set('commands', diff.equal ? 'GLTrace encoding differs' : diff.report);
        }
        expect([...differences.values()]).toEqual([]);
        expect(retained.length).toBeGreaterThan(rows.length);
    } finally {
        rmSync(temp, { recursive: true, force: true });
    }
}

// Keep the original nested exception contexts independently visible from the tiling dispatcher.
const rows = cases();
const invalidCache = (row: number[]) => row[5] === 2;
const rotatedWriteFault = (row: number[]) => row[0] === 0 && row[3] !== 0 && row[5] === 5;

loginFixture(import.meta.url, 'HD IF3 tiled graphic matches original GL wrappers, texture repeats, crop, clipping and pixels', () => compare(rows.filter(row => !invalidCache(row) && !rotatedWriteFault(row))), 90000, 'gl');
loginFixture(import.meta.url, 'HD GetGraphic preserves the JAR checkcast exception through the tiled widget draw', () => compare(rows.filter(invalidCache)), 90000, 'gl');
loginFixture(import.meta.url, 'HD rotated tiles preserve the JAR transformed-coordinate exception and partial framebuffer', () => compare(rows.filter(rotatedWriteFault)), 90000, 'gl');
