import { expect } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Js5 from '#/cache/Js5.js';
import Client from '#/client/Client.js';
import LocType from '#/config/LocType.js';
import MSIType from '#/config/MSIType.js';
import MSITypeList from '#/config/MSITypeList.js';
import GroundDecor from '#/dash3d/GroundDecor.js';
import Sprite from '#/dash3d/Sprite.js';
import Square from '#/dash3d/Square.js';
import Wall from '#/dash3d/Wall.js';
import world from '#/dash3d/world.js';
import Pix2D from '#/graphics/Pix2D.js';
import Pix8 from '#/graphics/Pix8.js';
import { loginFixture } from './login-fixture.js';
import { gamepackPath } from './reference.js';

const native = { WallType: world.WallType, SceneType: world.SceneType, GdType: world.GdType, loc: LocType.List, msi: MSITypeList.List };
const ids = [0x7ffffffe, 23, 31],
    W = 512,
    H = 96;
function pixels(frame: Int32Array): string {
    const result: string[] = [];
    for (let i = 0; i < frame.length; i++) if (frame[i] !== 0) result.push(i + '=' + frame[i]);
    return result.join(',');
}
function run([layers, shape, angle, neg, icons, opts, mode, fail]: number[], observed: boolean) {
    const x = mode === 14 ? 0x40000005 : 5,
        z = mode === 15 ? -2147483548 : 100;
    const offsetX = (1 - x) | 0,
        offsetZ = (1 - z) | 0,
        level = mode === 21 ? 2 : 0;
    const squares = [Array.from({ length: 3 }, () => new Array<Square | null>(3).fill(null))];
    world.squares = squares;
    const square = (squares[0][1][1] = new Square(0, 1, 1));
    LocType.m_recentUse.Reset();
    MSITypeList.types.Reset();
    MSITypeList.spriteCache.Reset();
    MSITypeList.archive = null;
    LocType.m_pConfigClient = null;
    MSITypeList.spritesArchive = new Js5({ index: () => null, group: () => null, prefetchGroup() {}, GetGroupLoadPercentage: () => 0 }, true, true);
    let step = 0,
        inSprite = false;
    const trace: string[] = [],
        fault = new Error('minimap watchpoint');
    function watch(tag: string) {
        trace.push(tag);
        if (++step === fail) throw fault;
    }
    const locs: LocType[] = [];
    for (let i = 0; i < 3; i++) {
        const id = ids[i],
            ms = 10 + i;
        let key = (BigInt(id) << 32n) | 0x40000000n | BigInt((angle & 3) << 20) | BigInt((i === 1 && layers !== 2 ? 9 : shape) << 14) | 69n;
        if ((neg & (1 << i)) !== 0) key |= -0x8000000000000000n;
        if ((layers & (1 << i)) !== 0) {
            if (i === 0) {
                square.wall = new Wall();
                square.wall.typecode = key;
            }
            if (i === 1) {
                const s = new Sprite();
                s.minTileX = s.minTileZ = 1;
                s.typecode = key;
                square.sprites[0] = s;
                square.spriteCount = 1;
            }
            if (i === 2) {
                square.groundDecor = new GroundDecor();
                square.groundDecor.typecode = key;
            }
        }
        const l = new LocType();
        locs.push(l);
        l.id = id;
        l.mapScene = (icons & (1 << i)) !== 0 ? ms : -1;
        l.msiRotate = (opts & 1) !== 0;
        l.msiAngle = i - 1;
        l.width = mode === 11 ? 0 : mode === 12 ? -2147483648 : 2 + i;
        l.length = mode === 13 ? 0 : 3 + i;
        if (mode !== 7 || i !== 1) LocType.m_recentUse.Put(BigInt(id), l);
        const m = new MSIType();
        m.m_spriteID = mode === 8 ? -1 : 40 + i;
        m.m_resize = (opts & 2) !== 0;
        m.m_tint = (opts & 4) !== 0 ? 0xbb72c1 : 0;
        if (observed)
            m.GetSprite = a => {
                watch('i' + m.m_spriteID + ',' + a);
                const sprite = MSIType.prototype.GetSprite.call(m, a);
                if (mode === 18) {
                    locs[0].width = 5;
                    locs[0].length = 3;
                    m.m_resize = true;
                    m.m_tint = 0xd972c1;
                }
                return sprite;
            };
        if (mode !== 9) MSITypeList.types.Put(BigInt(ms), m);
        for (let a = 0; a < 4; a++) {
            const palette = mode === 19 ? Int32Array.of(0, 1) : Int32Array.of(0, 0x854fe1 + i * 7 + a, 0xc874aa + i * 91 + a, 0x12a1d7 + i);
            const px = mode === 10 ? new Uint8Array(3) : Uint8Array.of(0, 1, 2, 3, 2, 1, 0, 3, 1, 0, 2, 1);
            const image = new Pix8(7 + a, 6, 1, 1, 4, 3, px, palette);
            if (observed) {
                image.drawScaled = (x, y, w, h) => {
                    watch('d' + [x, y, w, h].join(','));
                    inSprite = true;
                    try {
                        Pix8.prototype.drawScaled.call(image, x, y, w, h);
                    } finally {
                        inSprite = false;
                    }
                };
                image.drawScaledTinted = (x, y, w, h, tint) => {
                    watch('t' + [x, y, w, h, tint].join(','));
                    inSprite = true;
                    try {
                        Pix8.prototype.drawScaledTinted.call(image, x, y, w, h, tint);
                    } finally {
                        inSprite = false;
                    }
                };
            }
            if (mode !== 6 || i !== (icons === 4 ? 2 : icons === 2 ? 1 : 0)) MSITypeList.spriteCache.Put(BigInt(m.m_spriteID | (a << 16)), image);
        }
    }
    const pos = 24624 + 5 * 4 + 2048 * 3,
        len = mode === 3 ? pos : mode === 4 ? pos + 2 : mode === 5 ? pos + 1025 : W * H;
    const buffer = new Int32Array(len),
        other = new Int32Array(len);
    function probe(frame: Int32Array): Int32Array {
        return new Proxy(frame, {
            get(target, k) {
                return Reflect.get(target, k, target);
            },
            set(target, k, value) {
                if (!inSprite) {
                    watch('p' + String(k) + '=' + value);
                    if (mode === 17) Pix2D.pixels = alternate;
                }
                return Reflect.set(target, k, value, target);
            }
        });
    }
    const alternate = observed ? probe(other) : other;
    Pix2D.setPixels(mode === 1 ? null : observed ? probe(buffer) : buffer, W, H);
    if (mode === 16) Pix2D.setClipping(64, 60, 79, 71);
    if (mode === 2) world.squares = null;
    if (mode === 20) {
        square.sprites[0] = null;
        square.spriteCount = 1;
    }
    for (const [method, tag] of [
        ['WallType', 'w'],
        ['SceneType', 's'],
        ['GdType', 'g']
    ] as const) {
        if (observed) {
            world[method] = (p, x, z) => {
                watch(tag + [p, x, z].join(','));
                return native[method](p, x, z);
            };
        } else {
            world[method] = native[method];
        }
    }
    if (observed) {
        LocType.List = id => {
            watch('l' + id);
            return native.loc(id);
        };
    } else {
        LocType.List = native.loc;
    }
    if (observed) {
        MSITypeList.List = (id, group) => {
            watch('m' + id + ',' + group);
            return native.msi(id, group);
        };
    } else {
        MSITypeList.List = native.msi;
    }
    let result: string;
    try {
        result = String(Client.DrawDetail(z, offsetX, 0x81234567 | 0, level, x, offsetZ, 0x120b51));
    } catch (e) {
        if (e === fault) result = 'probe';
        else if (e instanceof TypeError) result = 'null';
        else if (e instanceof RangeError && e.message === '/ by zero') result = 'division';
        else if (e instanceof RangeError && /^(?:array|byte array) index -?\d+$/.test(e.message)) result = 'bounds:' + e.message.split(' ').at(-1);
        else throw e;
    }
    return [result, trace.join(';'), pixels(buffer), pixels(other)].join('|');
}

loginFixture(
    import.meta.url,
    'native minimap detail and map-scene icon draws match the 530 gamepack',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-minimap-detail-')),
            probe = join(dir, 'observed');
        try {
            const flags = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED'];
            const compile = Bun.spawnSync(['javac', ...flags, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game/MinimapDetailOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const cp = dir + delimiter + gamepackPath;
            mkdirSync(probe);
            const instrument = Bun.spawnSync(['java', ...flags, '-cp', cp, 'MinimapDetailOracle', gamepackPath, probe]);
            expect(instrument.exitCode, instrument.stderr.toString()).toBe(0);
            for (const observed of [false, true]) {
                const rows: number[][] = [];
                if (!observed) {
                    for (const layers of [0, 1, 2, 4, 7]) for (const shape of [0, 1, 2, 3, 9, 31]) for (let angle = 0; angle < 4; angle++) for (const neg of [0, 5]) rows.push([layers, shape, angle, neg, 0, 0, 0, 0]);
                    for (let opts = 0; opts < 8; opts++) for (let angle = 0; angle < 4; angle++) for (const icons of [1, 2, 4, 7]) rows.push([7, 2, angle, 2, icons, opts, 0, 0]);
                    for (let mode = 1; mode <= 21; mode++) for (const icons of [0, 1, 2, 4, 7]) for (const angle of [0, 1, 3]) rows.push([7, 2, angle, 3, icons, 7, mode, 0]);
                } else {
                    for (const icons of [0, 1, 2, 4, 7]) for (let fail = 0; fail <= 23; fail++) rows.push([7, 2, 1, 5, icons, 7, 0, fail]);
                    for (const mode of [3, 4, 5, 6, 8, 10, 17, 18, 19, 20]) for (const icons of [0, 1, 2, 4, 7]) for (const angle of [0, 1, 2, 3]) rows.push([7, 2, angle, 5, icons, 7, mode, 0]);
                }
                const wire = rows.map(row => row.join(' '));
                const java = Bun.spawnSync(['java', '-Xmx320m', '-XX:-OmitStackTraceInFastThrow', ...flags, '-cp', observed ? probe + delimiter + cp : cp, 'MinimapDetailOracle'], {
                    stdin: Buffer.from(wire.join('\n') + '\n'),
                    maxBuffer: 16 * 1024 * 1024
                });
                expect(java.exitCode, java.stderr.toString()).toBe(0);
                const lines = java.stdout.toString().trimEnd().split(/\r?\n/);
                expect(lines.length).toBe(rows.length);
                for (const [i, row] of rows.entries()) expect(run(row, observed), wire[i]).toBe(lines[i]);
            }
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    60000
);
