import { expect } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Js5 from '#/cache/Js5.js';
import Js5Index from '#/cache/Js5Index.js';
import Client from '#/client/Client.js';
import ObjType from '#/config/ObjType.js';
import LRUHashCache from '#/datastruct/LRUHashCache.js';
import Pix2D from '#/graphics/Pix2D.js';
import Pix32 from '#/graphics/Pix32.js';
import SoftwareAlphaSprite from '#/graphics/SoftwareAlphaSprite.js';
import Crc32 from '#/io/Crc32.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import InterfaceView from '#/ui/InterfaceView.js';
import WrappedException from '#/util/WrappedException.js';
import { readGroup } from '../cachefile.js';
import { loginFixture } from '../login-fixture.js';
import { cachePath, gamepackPath } from '../reference.js';

type Case = [source: number, alpha: number, tile: number, angle: number, transparency: number, width: number, height: number, mode: number];
function cases(): Case[] {
    const rows: Case[] = [];
    for (const source of [0, 1, 2, 3, 4])
        for (const alpha of [0, 1])
            for (const tile of [0, 1]) {
                for (const [angle, transparency, width, height] of [
                    [0, 0, 6, 5],
                    [0, 0, 19, 14],
                    [0, 73, 19, 14],
                    [0, 255, 7, 9],
                    [0, 256, 7, 9],
                    [17321, 0, 17, 13],
                    [-24575, 73, 17, 13],
                    [32768, 128, 3, 3]
                ]) {
                    rows.push([source, alpha, tile, angle, transparency, width, height, 0]);
                }
            }
    for (const mode of [1, 2, 3, 4, 5, 6, 7]) for (const source of [0, 2, 3]) for (const alpha of [0, 1]) for (const tile of [0, 1]) for (const angle of [0, 8192]) rows.push([source, alpha, tile, angle, 71, 19, 14, mode]);
    for (const source of [5, 6, 7, 8, 9]) for (const tile of [0, 1]) rows.push([source, 1, tile, 0, 255, 19, 14, 0]);
    return rows;
}

const width = 29,
    height = 23;
const clip = () => [Pix2D.clipMinX, Pix2D.clipMinY, Pix2D.clipMaxX, Pix2D.clipMaxY].join(',');

loginFixture(
    import.meta.url,
    '530 type 5 interface draw matches original sprite selection pixels tile calls and clip on failure',
    async () => {
        const scratch = mkdtempSync(join(tmpdir(), 'rs530-interface-sprites-')),
            observed = join(scratch, 'observed');
        try {
            mkdirSync(observed);
            const table = readGroup(cachePath, 255, 8),
                group = readGroup(cachePath, 8, 300);
            const index = new Js5Index(table, Crc32.prefix(table, table.length));
            const modelTable = readGroup(cachePath, 255, 7),
                modelIndex = new Js5Index(modelTable, Crc32.prefix(modelTable, modelTable.length));
            writeFileSync(join(scratch, 'index'), table);
            writeFileSync(join(scratch, 'sprite'), group);
            writeFileSync(join(scratch, 'models'), modelTable);
            const asm = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED'];
            const cp = scratch + delimiter + gamepackPath;
            function java(args: string[], stdin?: string): string {
                const proc = Bun.spawnSync(args, { stdin: stdin === undefined ? undefined : Buffer.from(stdin), maxBuffer: 16 * 1024 * 1024 });
                expect(proc.exitCode, proc.stderr.toString()).toBe(0);
                return proc.stdout.toString().trimEnd();
            }
            java(['javac', ...asm, '-cp', gamepackPath, '-d', scratch, join(import.meta.dir, 'InterfaceSpriteDrawOracle.java')]);
            java(['java', ...asm, '-cp', cp, 'InterfaceSpriteDrawOracle', gamepackPath, observed]);
            const rows = cases(),
                input = rows.map(r => r.join(' ')).join('\n') + '\n';
            for (const probe of [false, true]) {
                const reference = java(['java', ...asm, '-cp', probe ? observed + delimiter + cp : cp, 'InterfaceSpriteDrawOracle', scratch], input).split(/\r?\n/);
                expect(reference.length).toBe(rows.length);
                if (probe) {
                    const get = (entry: Case) => reference[rows.findIndex(row => row.join(' ') === entry.join(' '))].split('|');
                    expect(get([2, 1, 1, 0, 71, 19, 14, 4]).slice(0, 3)).toEqual(['third', 'alpha,alpha,3,4,185@4,4,22,18;alpha,alpha,3,9,185@4,4,22,18;alpha,alpha,3,14,185@4,4,22,18', '4,4,22,18']);
                    expect(get([2, 0, 1, 0, 71, 19, 14, 1]).slice(0, 3)).toEqual(['divide', '', '4,3,26,21']);
                    expect(get([8, 1, 0, 0, 255, 19, 14, 0]).slice(1, 5)).toEqual(['index;group,0', '4,3,26,21', 'true', 'true']);
                    expect(get([9, 1, 0, 0, 255, 19, 14, 0]).slice(1, 5)).toEqual(['index;group,0', '4,3,26,21', 'false', 'false']);
                }
                let trace: string[] = [],
                    draws = 0,
                    third = false;
                const restore: (() => void)[] = [];
                if (probe) {
                    const methods = { draw: 'draw', drawAlpha: 'alpha', drawScaled: 'scale', drawScaledAlpha: 'scaleAlpha', drawRotatedCentred: 'rotate' } as const;
                    // Observe the widget's call boundary; internal calls from the sprite rasterizer stay internal.
                    let inside = false;
                    for (const proto of [SoftwareAlphaSprite.prototype, Pix32.prototype]) {
                        for (const key of Object.keys(methods) as (keyof typeof methods)[]) {
                            const original = proto[key],
                                descriptor = Object.getOwnPropertyDescriptor(proto, key);
                            Object.defineProperty(proto, key, {
                                configurable: true,
                                writable: true,
                                value: function (this: Pix32, ...args: number[]) {
                                    if (inside) return Reflect.apply(original, this, args);
                                    trace.push([methods[key], this instanceof SoftwareAlphaSprite ? 'alpha' : 'rgb', ...args].join(',') + '@' + clip());
                                    if (++draws === 3 && third) throw new Error('third draw');
                                    inside = true;
                                    try {
                                        return Reflect.apply(original, this, args);
                                    } finally {
                                        inside = false;
                                    }
                                }
                            });
                            restore.push(() => {
                                if (descriptor) Object.defineProperty(proto, key, descriptor);
                                else Reflect.deleteProperty(proto, key);
                            });
                        }
                    }
                }
                try {
                    for (const [i, row] of rows.entries()) {
                        const [source, alpha, tile, angle, transparency, w, h, mode] = row;
                        trace = [];
                        draws = 0;
                        third = mode === 4;
                        const c = new IfType();
                        c.parentId = -1;
                        c.type = 5;
                        c.if3 = source >= 2;
                        c.comparisonOps = source === 1 ? new Int32Array(0) : null;
                        c.x = mode === 6 ? width + 8 : 3;
                        c.y = 4;
                        c.width = w;
                        c.height = h;
                        c.spriteTiling = tile !== 0;
                        c.spriteAngle = angle;
                        c.transparency = transparency;
                        c.spriteAlpha = alpha !== 0;
                        c.spriteId = source === 6 ? -1 : 300;
                        c.activeSprite = 169;
                        c.itemId = source === 3 || source >= 7 ? 411 : -1;
                        c.outline = 2;
                        c.spriteShadow = 0x80710e;
                        c.showItemCount = transparency % 2 === 0;
                        c.itemCount = angle === 0 ? 1234 : -31;
                        function sprite(seed: number): Pix32 {
                            const pixels = Int32Array.from({ length: mode === 3 ? 4 : 12 }, (_, j) => {
                                const rgb = (seed + j * 0x38204b) & 0xffffff;
                                return j % 5 === 1 ? 0 : rgb | (alpha ? ((j * 61 + 47) & 255) << 24 : 0);
                            });
                            const Type = alpha ? SoftwareAlphaSprite : Pix32;
                            return new Type(mode === 1 ? 0 : 6, mode === 2 ? 0 : 5, 1, 1, 4, 3, pixels);
                        }
                        const graphics = new LRUHashCache<Pix32>(16),
                            items = new LRUHashCache<object>(16);
                        Reflect.set(IfType, 'm_spriteCache', graphics);
                        Reflect.set(ObjType, 'spriteCache', items);
                        IfType.m_pSprites = new Js5(
                            {
                                index() {
                                    trace.push('index');
                                    return source >= 8 ? modelIndex : index;
                                },
                                group(_r, id) {
                                    trace.push('group,' + id);
                                    return source === 5 || source >= 8 ? null : group;
                                },
                                prefetchGroup() {
                                    throw new Error('unexpected prefetch');
                                },
                                GetGroupLoadPercentage() {
                                    throw new Error('unexpected group progress');
                                }
                            },
                            true,
                            true
                        );
                        if (source <= 3) {
                            const flags = (BigInt(c.spriteShadow) << 40n) + (BigInt(c.outline) << 36n) + (BigInt(alpha) << 35n);
                            graphics.Put(BigInt.asIntN(64, flags + 300n), sprite(0x674123));
                            graphics.Put(BigInt.asIntN(64, flags + 169n), sprite(0x1278bc));
                        }
                        if (source >= 8) {
                            ObjType.types.Reset();
                            ObjType.types.Put(411n, new ObjType());
                            ObjType.m_pModels = IfType.m_pSprites;
                        } else if (c.itemId !== -1) {
                            const packed = (c.itemId + (c.showItemCount ? 65536 : 0) + (c.outline << 17) + (c.spriteShadow << 19)) | 0;
                            items.Put(BigInt.asIntN(64, BigInt(packed) * 3849834839n + 3147483667n * BigInt(c.itemCount)), source === 7 ? {} : sprite(0xbc924a));
                        }
                        const screen = Int32Array.from({ length: width * height }, (_, j) => (0x214756 + j * 0xb9) & 0xffffff);
                        Pix2D.setPixels(screen, width, height);
                        Pix2D.setClipping(4, 3, 26, 21);
                        Client.loopCycle = InterfaceList.cycle = 37;
                        InterfaceList.rootCount = 0;
                        InterfaceList.dirty[0] = false;
                        InterfaceList.rectRedrawnLastFrame[0] = mode !== 5;
                        IfType.resourceMissing = source !== 9;
                        let widgets = [c];
                        if (mode === 7) {
                            const parent = new IfType();
                            Object.assign(parent, { parentId: -1, id: 489, type: 0, if3: true, x: 3, y: 2, width: 14, height: 13 });
                            c.parentId = 489;
                            c.x = -2;
                            c.y = 3;
                            widgets = [parent, c];
                        }
                        let error = 'ok';
                        try {
                            new InterfaceView(widgets).draw();
                        } catch (fault) {
                            let cause = fault;
                            while (cause instanceof WrappedException) cause = cause.cause;
                            if (cause instanceof RangeError) error = cause.message.includes('by zero') ? 'divide' : 'bounds';
                            else if (cause instanceof TypeError && cause.message.includes('ClassCastException')) error = 'cast';
                            else if (cause instanceof Error && cause.message === 'third draw') error = 'third';
                            else throw fault;
                        }
                        const digest = createHash('sha256').update(new Uint8Array(screen.buffer)).digest('hex');
                        const actual = [error, trace.join(';'), clip(), IfType.resourceMissing, InterfaceList.dirty[0], c.rootIndex, c.drawCycle, digest];
                        expect(actual.join('|'), (probe ? 'observed ' : 'unmodified ') + row.join(' ')).toBe(reference[i]);
                    }
                } finally {
                    for (const fn of restore.reverse()) fn();
                }
            }
        } finally {
            rmSync(scratch, { recursive: true, force: true });
        }
    },
    60000
);
