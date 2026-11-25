import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Ground from '#/dash3d/Ground.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import Client from '#/client/Client.js';
import LocChange from '#/dash3d/LocChange.js';
import SharedPtrList from '#/datastruct/SharedPtrList.js';
import Square from '#/dash3d/Square.js';
import Pix3D from '#/dash3d/Pix3D.js';
import QuickGround from '#/dash3d/QuickGround.js';
import world from '#/dash3d/world.js';
import GlRenderer from '#/gl/GlRenderer.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { loginFixture } from '../login-fixture.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

function minimap(shape: number, angle: number): string[] {
    const results: string[] = [];
    for (const base of [0, 0xfc439913 | 0]) {
        const tile = new Square(0, 0, 0);
        if (shape === -1) tile.quickGround = new QuickGround(0, 0, 0, 0, -1, base, false);
        else if (shape >= 0) tile.ground = new Ground(shape, angle, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, base, 0x81fc33d2 | 0);
        world.squares = [[[shape === -3 ? null : tile]]];
        for (const [length, pos, stride] of [
            [28, 1, 7],
            [18, 12, -4],
            [12, 1, 4],
            [0, 0, 1],
            [-1, 0, 0]
        ]) {
            const pixels = length < 0 ? null : new Int32Array(length).fill(112489);
            let result = 'ok';
            try {
                world.Render2DGround(pixels, pos, stride, 0, 0, 0);
            } catch (error) {
                if (error instanceof RangeError) result = 'bounds';
                else if (error instanceof TypeError) result = 'null';
                else throw error;
            }
            results.push(result + ' ' + (pixels === null ? 'null' : '[' + pixels.join(', ') + ']'));
        }
    }
    return results;
}

function dynamics(underwater: boolean): string[] {
    world.maxTileX = world.maxTileZ = 4;
    world.squares = Array.from({ length: 2 }, () => Array.from({ length: 4 }, () => Array(4).fill(null)));
    world.levelHeightmaps = Array.from({ length: 2 }, () => Array.from({ length: 5 }, () => new Int32Array(5)));
    world.underwaterHeightmap = underwater ? world.levelHeightmaps : null;
    world.waterSpriteKeys = Array.from({ length: 4 }, () => new Int32Array(4));
    world.waterSpriteKeys[2][1] = 275;
    world.dynamicSprites = Array(9).fill(null);
    world.dynamicCount = 0;
    const model = new ClientPlayer();
    const tiles = [
        [-1, 0, -1, 2, 0],
        [0, 1, 1, 2, 2],
        [1, 0, 0, 2, 3],
        [1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1],
        [0, 2, 2, 4, 3],
        [0, 3, 3, 2, 2],
        [0, 2, 3, 2, 3],
        [0, 2, 3, 2, 3],
        [0, 2, 3, 2, 3]
    ];
    const states: string[] = [];
    for (const [i, [p, x0, z0, x1, z1]] of tiles.entries()) {
        let result: string;
        try {
            result = String(world.AddDynamic2(p, 64 + 77 * i, 133 - 53 * i, i - 7, i === 0 ? null : model, 27 * i, 0x1234567890abcdefn - BigInt(i), x0, z0, x1, z1));
        } catch (error) {
            if (!(error instanceof RangeError)) throw error;
            result = 'bounds';
        }
        const out = [result + ' ' + world.dynamicCount];
        const registry = requireNonNull(world.dynamicSprites);
        for (const sprite of registry) if (sprite !== null) out.push([sprite.typecode, sprite.level, sprite.x, sprite.z, sprite.y, sprite.yaw, sprite.minTileX, sprite.minTileZ, sprite.maxTileX, sprite.maxTileZ, sprite.model === model].join(','));
        for (const [plane, layer] of world.squares.entries())
            for (const [x, col] of layer.entries())
                for (const [z, tile] of col.entries()) {
                    if (tile === null) continue;
                    const slots = [plane, x, z, tile.spriteSpans, tile.spriteCount].map(String);
                    for (let slot = 0; slot < tile.spriteCount; slot++) slots.push(registry.indexOf(tile.sprites[slot]) + ':' + tile.spriteSpan[slot]);
                    out.push(slots.join(','));
                }
        for (const line of world.waterSpriteKeys) out.push('[' + line.join(', ') + ']');
        states.push(out.join(' /'));
    }
    return states;
}

function changes(): string[] {
    const snapshot = (c: LocChange) => '[' + [c.plane, c.x, c.z, c.layer, c.oldId, c.oldShape, c.oldAngle, c.id, c.shape, c.angle, c.delay, c.remaining].join(', ') + ']';
    const rows = [snapshot(new LocChange())];
    Client.locChanges = new SharedPtrList<LocChange>();
    for (let i = 0; i < 12; i++) {
        Client.LocChangeCreate(2 * i, 9 + i, 1, 14 - i, 1, i % 2, i % 4, 370 + i, i % 3);
        let state = '';
        for (let change = Client.locChanges.head(); change !== null; change = Client.locChanges.next()) state += snapshot(change);
        rows.push(state);
    }
    return rows;
}

loginFixture(
    import.meta.url,
    'HD ground tile picking matches the Java hit map for every floor shape and rotation',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-hd-ground-pick-'));
        try {
            const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
            const compile = Bun.spawnSync(['javac', '-cp', cp, '-d', dir, join(import.meta.dir, 'HdGroundPickOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const run = Bun.spawnSync(['java', '-cp', cp, 'HdGroundPickOracle']);
            expect(run.exitCode, run.stderr.toString()).toBe(0);
            const rows = run.stdout.toString().trim().split(/\r?\n/);
            let row = 0;
            const x = 30,
                z = 31;
            GlRenderer.active = true;
            Pix3D.originX = 516;
            Pix3D.originY = 349;
            world.cx = x * 128 + 64;
            world.cy = -350;
            world.cz = z * 128 - 430;
            const sin = requireNonNull(Pix3D.sinTable)[256],
                cos = requireNonNull(Pix3D.cosTable)[256];
            for (const underwater of [false, true]) {
                const level = Array.from({ length: x + 2 }, () => new Int32Array(z + 2));
                world.levelHeightmaps = [level];
                world.underwaterHeightmap = underwater ? world.levelHeightmaps : null;
                const sw = underwater ? 56 : 0,
                    se = sw - 9,
                    ne = sw + 25,
                    nw = sw - 31;
                level[x][z] = sw;
                level[x + 1][z] = se;
                level[x + 1][z + 1] = ne;
                level[x][z + 1] = nw;
                for (let shape = -1; shape < 13; shape++)
                    for (let angle = 0; angle < (shape < 0 ? 1 : 4); angle++) {
                        const plain = new QuickGround(40, 41, 42, 43, -1, 0, false);
                        const shaped = shape < 0 ? null : new Ground(shape, angle, 3, x, z, sw, se, ne, nw, 40, 41, 42, 43, 50, 51, 52, 53, 44, 54);
                        for (const occluded of [false, true]) {
                            const bitmap = Buffer.alloc(320);
                            let hits = 0;
                            for (let i = 0; i < 64 * 40; i++) {
                                world.updateMousePicking(0, ((i % 64) - 32) * 4, (((i / 64) | 0) - 20) * 5 - 70);
                                if (shaped === null) world.renderQuickGround(plain, 0, sin, cos, 0, 65536, x, z, occluded);
                                else world.drawTileOverlay(shaped, sin, cos, 0, 65536, x, z, occluded);
                                if (world.groundX === x && world.groundZ === z) {
                                    bitmap[i >> 3] |= 1 << (i & 7);
                                    hits++;
                                } else if (world.groundX !== -1 || world.groundZ !== -1) throw new Error('wrong tile');
                            }
                            expect(hits).toBeGreaterThan(0);
                            expect(bitmap.toString('hex'), [underwater, shape, angle, occluded].join(' ')).toBe(rows[row++]);
                        }
                    }
            }
            for (let shape = -3; shape < 13; shape++) for (let angle = 0; angle < (shape < 0 ? 1 : 4); angle++) for (const state of minimap(shape, angle)) expect(state, 'minimap ' + [shape, angle]).toBe(rows[row++]);
            for (const colour of [-2147483648, -1, 0, 1, 127, 128, 0x8ff1, 65535, 2147483647])
                for (const factor of [-2147483648, -1, 0, 1, 2, 63, 126, 127, 128, 129, 255, 123456789, 2147483647]) expect(String(world.TextureLightCol(colour, factor))).toBe(rows[row++]);
            for (const underwater of [false, true]) for (const state of dynamics(underwater)) expect(state).toBe(rows[row++]);
            for (const state of changes()) expect(state).toBe(rows[row++]);
            expect(row).toBe(rows.length);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    45000,
    'gl'
);
