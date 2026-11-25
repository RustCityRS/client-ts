import { expect } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import ClientBuild from '#/client/ClientBuild.js';
import RoofModeStatics from '#/dash3d/RoofModeStatics.js';
import Square from '#/dash3d/Square.js';
import Wall from '#/dash3d/Wall.js';
import Sprite from '#/dash3d/Sprite.js';
import world from '#/dash3d/world.js';
import RouteFinding from '#/movement/RouteFinding.js';
import { loginFixture } from './login-fixture.js';
import { gamepackPath } from './reference.js';

type Row = [mode: number, pattern: number, level: number, x: number, z: number, variant: number, stamp: number, index: number, rebuild: number];

function cases(): Row[] {
    const rows: Row[] = [];
    // Levels and scene edges, full 104x104 ring wrap, empty, rectangle, diagonal, perforated and one-square roofs.
    for (const [x, z] of [
        [0, 0],
        [0, 103],
        [103, 0],
        [103, 103],
        [53, 57]
    ])
        for (const level of [0, 1, 2, 3]) {
            for (const pattern of [0, 1, 3, 4, 5]) rows.push([0, pattern, level, x, z, 0, 235, 1, level & 1]);
        }
    rows.push([0, 2, 0, 50, 48, 0, 251, 0, 0]);
    for (const mode of [1, 2])
        for (const mask of [0, 1, 2, 4, 8, 16, 32, 64, 128, 256]) {
            rows.push([mode, 0, 0, 37, 39, mask, 43, 0, 1]);
        }
    for (const shape of [0, 17, 18, 19, 20, 21, 22])
        for (let angle = 0; angle < 4; angle++) {
            rows.push([3, 0, 1, 41, 36, shape | (angle << 6), 146, 1, 0]);
        }
    for (const mode of [4, 5, 6, 7, 8, 9, 10, 12, 13, 14, 16, 18, 19, 21, 22, 24, 25]) {
        for (const level of [0, 3]) rows.push([mode, 0, level, 37, 37, 0, 192, 1, 0]);
    }
    for (const n of [0, 1, 2, 3, 4, 5, 8]) for (const size of [n, ~n]) rows.push([11, 1, 0, 47, 23, size, 17, 0, 1]);
    for (const variant of [0, 1, 2, 3, 4]) for (const level of [0, 3]) rows.push([17, 0, level, 40, 40, variant, 1, 0, 1]);
    for (const variant of [0, 1, 2]) rows.push([23, 0, 0, 20, 20, variant, 111, 2, 0]);
    rows.push([26, 0, 0, 37, 37, 512, 192, 1, 0], [27, 0, 0, 37, 37, 18 | (2 << 6), 192, 1, 0]);
    for (const mode of [28, 29, 30]) rows.push([mode, 0, 0, 37, 37, 16, 41, 1, 1]);
    for (const stamp of [-1024, -1, 0, 1, 117, 128, 255, 256]) rows.push([0, 1, 1, 23, 47, 0, stamp, 1, 0]);
    for (const [x, z] of [
        [-1, 0],
        [0, -1],
        [104, 103],
        [103, 104]
    ])
        rows.push([0, 0, 0, x, z, 0, 1, 0, 0]);
    for (const level of [-1, 4]) rows.push([0, 0, level, 3, 3, 0, 1, 0, 0]);
    rows.push([0, 0, 0, 3, 3, 0, 1, -1, 0], [0, 0, 0, 3, 3, 0, 1, 3, 0]);
    return rows;
}

const byteGrid = () => Array.from({ length: 4 }, () => Array.from({ length: 104 }, () => new Uint8Array(104)));
const bound = (initial: number) => new Int32Array(3).fill(initial);
function words(data: Int32Array): string {
    const b = Buffer.alloc(data.length * 4);
    data.forEach((v, i) => b.writeInt32BE(v, i * 4));
    return createHash('sha256').update(b).digest('hex');
}
function marks(data: Uint8Array[][] | null): string {
    if (data === null) return '-';
    const sha = createHash('sha256');
    for (const plane of data) for (const row of plane) sha.update(row);
    return sha.digest('hex');
}

function run([mode, pattern, level, x, z, variant, stamp, index, rebuild]: Row): string[] {
    let squares: (Square | null)[][][] | null = Array.from({ length: 4 }, () => Array.from({ length: 104 }, () => new Array<Square | null>(104).fill(null)));
    const flags = byteGrid(),
        visited = byteGrid();
    const heights = Array.from({ length: 4 }, () => Array.from({ length: 105 }, () => new Int32Array(105)));
    let replaced = false;
    Client.playerLevel = level;
    RoofModeStatics.markStamp = stamp;
    for (let p = 0; p < 4; p++)
        for (let i = 0; i < 104; i++)
            for (let j = 0; j < 104; j++) {
                visited[p][i][j] = 117;
                const dx = i - x,
                    dz = j - z;
                if (
                    p === level &&
                    pattern !== 5 &&
                    ((dx === 0 && dz === 0) ||
                        (pattern === 1 && Math.abs(dx) <= 4 && Math.abs(dz) <= 2) ||
                        pattern === 2 ||
                        (pattern === 3 && Math.abs(dx) === Math.abs(dz) && Math.abs(dx) <= 5) ||
                        (pattern === 4 && Math.abs(dx) <= 8 && Math.abs(dz) <= 8 && (dx * dx + dz * 17) % 7 !== 0))
                )
                    flags[p][i][j] = 4;
                if (p > level && (mode === 13 || (pattern === 4 && (i + j * 9 + p) % 5 === 0))) flags[p][i][j] |= 8;
                heights[p][i][j] = 1009 * p + 313 * i - 73 * j;
                if (p <= level || Math.abs(dx) > 1 || Math.abs(dz) > 1) continue;
                if (mode === 1 || mode === 2 || mode === 21 || mode === 22 || mode === 26 || mode === 28) {
                    const square = (squares[p][i][j] = new Square(p, i, j));
                    const wall = (square.wall = new Wall());
                    wall.angle1 = mode === 2 ? 512 : variant;
                    wall.angle2 = mode === 1 ? 512 : variant;
                    if (mode === 26 && p === 1 && dx === -1 && dz === 0) {
                        const original = wall.angle1;
                        Object.defineProperty(wall, 'angle1', {
                            get() {
                                if (!replaced) {
                                    replaced = true;
                                    const next = (square.wall = new Wall());
                                    next.angle1 = 512;
                                    next.angle2 = 1;
                                }
                                return original;
                            }
                        });
                    }
                }
                if (mode === 3 || mode === 4 || mode === 5 || mode === 14 || mode === 24 || mode === 27) {
                    const square = (squares[p][i][j] = new Square(p, i, j));
                    square.spriteCount = 1;
                    const s = (square.sprites[0] = new Sprite());
                    s.typecode = BigInt.asIntN(64, 0xffff012300000000n | (BigInt(variant & 63) << 14n) | (BigInt((variant >> 6) & 3) << 20n));
                    s.minTileX = s.maxTileX = i;
                    s.minTileZ = s.maxTileZ = j;
                    if (mode === 4) {
                        s.minTileX = Math.max(0, i - 2);
                        s.maxTileX = Math.min(103, i + 3);
                        s.minTileZ = Math.max(0, j - 3);
                        s.maxTileZ = Math.min(103, j + 2);
                    }
                    if (mode === 5 && dx === 0 && dz === 0) {
                        s.minTileX = 1;
                        s.maxTileX = 2;
                        s.minTileZ = 102;
                        s.maxTileZ = 104;
                    }
                    if (mode === 14 && dx === 0 && dz === 0) square.spriteCount = 2;
                    if (mode === 24 && dx !== 0) Reflect.set(square, 'sprites', null);
                    if (mode === 27 && p === 1 && dx === -1 && dz === 0) {
                        const original = s.typecode;
                        Object.defineProperty(s, 'typecode', {
                            get() {
                                if (!replaced) {
                                    replaced = true;
                                    const next = (square.sprites[0] = new Sprite());
                                    next.typecode = 18n << 14n;
                                }
                                return original;
                            }
                        });
                    }
                }
            }
    Reflect.set(RouteFinding, 'm_listx', new Int32Array(4096).fill(0x7287));
    Reflect.set(RouteFinding, 'm_listz', new Int32Array(4096).fill(-77));
    ClientBuild.m_mapl = flags;
    RoofModeStatics.roofMarks = visited;
    world.levelHeightmaps = heights;
    RoofModeStatics.roofMaxY = bound(-1000000);
    RoofModeStatics.roofMinX = bound(1000000);
    RoofModeStatics.roofMaxX = bound(0);
    RoofModeStatics.hideMinZ = bound(1000000);
    RoofModeStatics.roofMaxZ = bound(0);
    switch (mode) {
        case 6:
            squares = null;
            break;
        case 7:
            RoofModeStatics.roofMarks = null;
            break;
        case 8:
            ClientBuild.m_mapl = null;
            break;
        case 9:
            world.levelHeightmaps = null;
            break;
        case 10:
            Reflect.set(RouteFinding, 'm_listz', RouteFinding.m_listx);
            break;
        case 11:
            Reflect.set(RouteFinding, variant >= 0 ? 'm_listx' : 'm_listz', new Int32Array(variant >= 0 ? variant : ~variant));
            break;
        case 12:
            visited[level][x][z] = rebuild ? 1 : stamp;
            break;
        case 16:
            RoofModeStatics.roofMinX = RoofModeStatics.roofMaxY;
            RoofModeStatics.hideMinZ = RoofModeStatics.roofMaxX;
            RoofModeStatics.roofMaxZ = RoofModeStatics.roofMaxY;
            RoofModeStatics.roofMaxY.fill(2147483643);
            break;
        case 17:
            RoofModeStatics[(['roofMaxY', 'roofMinX', 'roofMaxX', 'hideMinZ', 'roofMaxZ'] as const)[variant]] = null;
            break;
        case 18:
            RoofModeStatics.roofMaxY = new Int32Array(1);
            break;
        case 19:
            RoofModeStatics.roofMarks = flags;
            break;
        case 23:
            if (variant === 0) world.levelHeightmaps = [[]];
            else if (variant === 1) visited[1][x] = new Uint8Array(z);
            else Reflect.set(squares, 1, null);
            break;
        case 25:
            heights[1][x][z] = 2147483647;
            break;
    }
    let calls = 0,
        maskTrace = 1,
        result: string,
        xLoads = 0,
        zLoads = 0,
        queueTrace = 1;
    let queueX = RouteFinding.m_listx,
        queueZ = RouteFinding.m_listz;
    Object.defineProperty(RouteFinding, 'm_listx', {
        configurable: true,
        get() {
            xLoads++;
            queueTrace = (Math.imul(queueTrace, 31) + 1) | 0;
            if (mode === 28 && xLoads === 6) {
                queueX = queueX.slice();
                queueX[1] = 0x52120000 | (x - 1);
            }
            if (mode === 29 && xLoads === 4) queueX = new Int32Array(0);
            return queueX;
        }
    });
    Object.defineProperty(RouteFinding, 'm_listz', {
        configurable: true,
        get() {
            zLoads++;
            queueTrace = (Math.imul(queueTrace, 31) + 2) | 0;
            if (mode === 30 && zLoads === 3) queueZ = new Int32Array(0);
            return queueZ;
        }
    });
    const convert = world.wallTypeMask;
    world.wallTypeMask = code => {
        calls++;
        maskTrace = (Math.imul(maskTrace, 31) + code) | 0;
        const mask = convert(code);
        if (calls === 1 && mode === 21) {
            const wallSquare = squares?.[1][x - 1][z];
            if (wallSquare) wallSquare.wall = null;
        }
        if (calls === 1 && mode === 22) Client.playerLevel = 3;
        return mask;
    };
    try {
        result = String(RoofModeStatics.floodRoof(rebuild !== 0, z, index, squares, x));
    } catch (e) {
        if (e instanceof TypeError && ['Null array', 'Null reference'].includes(e.message)) result = 'null';
        else if (e instanceof RangeError && /^array index -?\d+$/.test(e.message)) result = e.message.substring(6);
        else throw e;
    } finally {
        world.wallTypeMask = convert;
        Object.defineProperty(RouteFinding, 'm_listx', { value: queueX, configurable: true, writable: true, enumerable: true });
        Object.defineProperty(RouteFinding, 'm_listz', { value: queueZ, configurable: true, writable: true, enumerable: true });
    }
    const box = (a: Int32Array | null) => (a === null ? 'null' : '[' + a.join(', ') + ']');
    return [
        result,
        [calls, maskTrace, Client.playerLevel].join(','),
        [xLoads, zLoads, queueTrace, replaced].join(','),
        marks(RoofModeStatics.roofMarks),
        words(queueX),
        words(queueZ),
        box(RoofModeStatics.roofMaxY),
        box(RoofModeStatics.roofMinX),
        box(RoofModeStatics.roofMaxX),
        box(RoofModeStatics.hideMinZ),
        box(RoofModeStatics.roofMaxZ)
    ];
}

loginFixture(
    import.meta.url,
    'roof flood marks queue masks footprints and padded roof bounds match the 530 gamepack',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-roof-flood-'));
        const opens = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED'];
        try {
            const compile = Bun.spawnSync(['javac', ...opens, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game', 'RoofFloodOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const java = ['java', ...opens, '-Djava.awt.headless=true', '-XX:-OmitStackTraceInFastThrow', '-cp', dir + delimiter + gamepackPath, 'RoofFloodOracle'];
            const prep = Bun.spawnSync([...java, gamepackPath, dir]);
            expect(prep.exitCode, prep.stderr.toString()).toBe(0);
            const rows = cases();
            const oracle = Bun.spawnSync(java, { stdin: Buffer.from(rows.map(r => r.join(' ')).join('\n') + '\n') });
            expect(oracle.exitCode, oracle.stderr.toString()).toBe(0);
            const lines = oracle.stdout.toString().trimEnd().split(/\r?\n/);
            expect(lines.length).toBe(rows.length);
            for (const [i, r] of rows.entries()) expect(run(r), r.join(' ')).toEqual(lines[i].split('|'));
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    60000
);
