import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ModelSource from '../../src/dash3d/ModelSource.js';
import type ParticleSystem from '../../src/dash3d/ParticleSystem.js';
import Pix3D from '../../src/dash3d/Pix3D.js';
import world from '../../src/dash3d/world.js';
import Pix2D from '../../src/graphics/Pix2D.js';
import { gamepackPath } from '../reference.js';

// The exception paths of the scene traversal against client.jar, which world.test.ts does not reach (its models never
// throw): p.a (world.Fill) wraps the sprite pass of a square in catch (Exception), whose handler clears ra.E
// (drawSprites) and falls through to the back-of-square pass; a throw from a wall draw outside that try escapes
// world.draw and leaves the draw queue as it was. Models whose id % 10 == 9 throw from draw and id % 10 == 8 throw from
// getMinY (inside the SpriteOccluded2 argument list, so also inside the try). After every draw both sides print the ordered
// model calls and every square's flags, corner state and sprite cycles/distances. The Java side is
// test/review/worldfill/WorldFillOracle.java.

const log: string[] = [];
const call = (token: string): void => {
    log.push(token);
};

class Thrown extends Error {}

class TM extends ModelSource {
    constructor(readonly id: number) {
        super();
    }

    draw(yaw: number, _sinPitch: number, _cosPitch: number, _sinYaw: number, _cosYaw: number, x: number, y: number, z: number, typecode: bigint, level: number, _particles: ParticleSystem | null): void {
        call(`D${this.id},${yaw},${x},${y},${z},${typecode},${level}`);
        if (this.id % 10 === 9) {
            call(`X${this.id}`);
            throw new Thrown(`T${this.id}`);
        }
    }

    getMinY(): number {
        call(`B${this.id}`);
        if (this.id % 10 === 8) {
            call(`Y${this.id}`);
            throw new Thrown(`M${this.id}`);
        }
        return -((this.id * 37) % 300);
    }

    update(): void {
        call(`U${this.id}`);
    }
}

const model = (id: number): ModelSource | null => (id < 0 ? null : new TM(id));

function dump(): string {
    let out = `f${world.fillLeft},c${world.cycleNo},i${world.takingInput ? 1 : 0}`;
    const squares = world.squares;
    if (squares === null) throw new TypeError('Null reference');
    for (let level = 0; level < squares.length; level++)
        for (let x = 0; x < squares[level].length; x++)
            for (let z = 0; z < squares[level][x].length; z++) {
                const r = squares[level][x][z];
                if (r === null) continue;
                out += ` ${level}/${x}/${z}:${r.drawFront ? 1 : 0}${r.drawBack ? 1 : 0}${r.drawSprites ? 1 : 0}`;
                out += `,${r.cornerSides},${r.sidesBeforeCorner},${r.sidesAfterCorner},${r.backWallTypes},${r.spriteCount}`;
                for (let i = 0; i < r.spriteCount; i++) {
                    const s = r.sprites[i];
                    if (s === null) throw new TypeError('Null reference');
                    out += `;${(s.model as TM).id}@${s.cycle}/${s.distance}`;
                }
            }
    return out;
}

function runOp(op: string, n: number[], a: bigint[]): string {
    switch (op) {
        case 'fb':
            Pix2D.pixels = new Int32Array(n[0] * n[1]);
            Pix2D.width = n[0];
            Pix2D.height = n[1];
            Pix2D.clipMinX = 0;
            Pix2D.clipMinY = 0;
            Pix2D.clipMaxX = n[0];
            Pix2D.clipMaxY = n[1];
            Pix3D.setRenderClipping();
            return 'ok';
        case 'init':
            world.init(n[0], n[1], n[2], n[3], n[4] !== 0);
            return 'ok';
        case 'fbl':
            world.FillBaseLevel(n[0]);
            return 'ok';
        case 'spr':
            return String(world.SetSprite(n[0], n[1], n[2], n[3], n[4], n[5], n[6], n[7], model(n[8]), n[9], n[10] !== 0, a[11]));
        case 'wall':
            world.SetWall(n[0], n[1], n[2], n[3], model(n[4]), model(n[5]), n[6], n[7], a[8]);
            return 'ok';
        case 'delwall':
            return world.DelWall(n[0], n[1], n[2]) === null ? 'null' : 'wall';
        case 'draw':
            world.draw(n[0], n[1], n[2], n[3], n[4], null, null, null, null, null, null, 0, 0, n[5], n[6]);
            return 'ok';
        case 'dump':
            return dump();
        default:
            throw new Error(`unknown op ${op}`);
    }
}

function runTs(line: string): string {
    const f = line.split(' ');
    const a = f.slice(1).map(v => BigInt(v));
    const n = a.map(v => Number(BigInt.asIntN(32, v)));
    log.length = 0;
    let result: string;
    try {
        result = runOp(f[0], n, a);
    } catch (e) {
        if (e instanceof Thrown) result = `ex:${e.message}`;
        else if (e instanceof RangeError && e.message.startsWith('array index')) result = 'aioobe';
        else if (e instanceof TypeError && (e.message === 'Null reference' || e.message === 'Null array')) result = 'npe';
        else result = `error:${String(e)}`;
    }
    return `${result}|${log.map(t => ' ' + t).join('')}`;
}

function script(): string[] {
    const ops = ['fb 128 96', 'init 4 14 14 10 0', 'fbl 0'];
    const at = (t: number): number => t * 128 + 64;
    // spr level minX minZ sizeX sizeZ fineX fineZ y model yaw temp typecode
    // Three one-tile sprites on (5,5), the middle one (19) throwing from draw.
    ops.push(`spr 0 5 5 1 1 ${at(5) - 20} ${at(5)} 0 11 0 0 101`, `spr 0 5 5 1 1 ${at(5)} ${at(5)} 0 19 256 0 102`, `spr 0 5 5 1 1 ${at(5) + 20} ${at(5) + 9} 0 12 512 0 103`);
    // A throwing 2x2 sprite over (7..8, 6..7), with a one-tile sprite under its corner.
    ops.push(`spr 0 7 6 2 2 ${at(7) + 64} ${at(6) + 64} 0 29 0 0 104`, `spr 0 8 7 1 1 ${at(8)} ${at(7)} 0 13 0 0 105`);
    // A sprite whose getMinY throws (18) next to a plain one on (4,8), and a plain 2x1 sprite over (6..7, 9).
    ops.push(`spr 0 4 8 1 1 ${at(4)} ${at(8)} 0 18 0 0 106`, `spr 0 4 8 1 1 ${at(4) + 30} ${at(8) - 30} 0 14 0 0 107`);
    ops.push(`spr 0 6 9 2 1 ${at(6) + 64} ${at(9)} 0 15 0 0 108`);
    // A wall on (6,10) whose first model throws: its draw is outside the try, so the exception escapes world.draw.
    ops.push('wall 0 6 10 0 39 -1 1 0 109', 'dump');
    const eyes = [
        [at(6), -700, at(1)],
        [at(6) + 30, -650, at(6) + 20],
        [at(2), -800, at(12)],
        [at(12), -600, at(3)],
        [at(5), -500, at(5) - 40]
    ];
    const views = (): void => {
        for (const [x, y, z] of eyes) for (const pitch of [300, 383]) for (let yaw = 0; yaw < 2048; yaw += 256) ops.push(`draw ${x} ${y} ${z} ${pitch} ${yaw} 6 6`, 'dump');
    };
    views();
    ops.push('delwall 0 6 10', 'dump');
    views();
    return ops;
}

function runOracle(lines: string[]): string[] {
    const source = fileURLToPath(new URL('./worldfill/WorldFillOracle.java', import.meta.url));
    const dir = mkdtempSync(join(tmpdir(), 'world-fill-oracle-'));
    try {
        const javac = spawnSync('javac', ['-nowarn', '-cp', gamepackPath, '-d', dir, source], { timeout: 60000, encoding: 'utf8' });
        if (javac.status !== 0) throw new Error(`javac failed: ${javac.stderr}`);
        const java = spawnSync('java', ['-Djava.awt.headless=true', '-cp', gamepackPath + delimiter + dir, 'WorldFillOracle'], {
            input: lines.join('\n') + '\n',
            timeout: 120000,
            encoding: 'utf8',
            maxBuffer: 256 * 1024 * 1024
        });
        if (java.status !== 0) throw new Error(`oracle failed (${java.status} ${java.signal}): ${java.stderr}`);
        const out = java.stdout.split('\n').map(line => line.replace(/\r$/, ''));
        if (out[out.length - 1] === '') out.pop();
        return out;
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

// The world statics as a fresh JVM has them, so the run does not depend on what other suites left behind.
function worldClinit(): Record<string, unknown> {
    return {
        fillLeft: 0,
        dynamicCount: 0,
        roofHideMaxZ: null,
        clickLevel: 0,
        viewRadius: 0,
        cornerVisibility: null,
        hiddenRoofY: null,
        spriteBuffer: null,
        cy: 0,
        hideAreaMaxX: null,
        eyeTileZ: 0,
        roofMinX: null,
        gx: 0,
        groundZ: -1,
        minX: 0,
        levelTileOcclusionCycles: null,
        maxZ: 0,
        waterSpriteKeys: null,
        maxLevel: 0,
        squares: null,
        minLevel: 0,
        cycleNo: 0,
        mainGroundh: null,
        maxX: 0,
        cx: 0,
        occluders: null,
        numOccluders: 0,
        mainLevelTiles: null,
        underwaterHeightmap: null,
        takingInput: false,
        clickX: 0,
        dynamicSprites: null,
        minZ: 0,
        cameraCosY: 0,
        cameraCosX: 0,
        maxTileZ: 0,
        clickY: 0,
        cz: 0,
        roofHideMinZ: null,
        numActiveOccluders: 0,
        groundX: -1,
        cameraSinX: 0,
        maxTileX: 0,
        visibilityMap: null,
        activeOccluders: null,
        tileCameraClearance: null,
        levelHeightmaps: null,
        underwaterSquares: null,
        cameraSinY: 0
    };
}

test('world.Fill catches exceptions from its sprite pass, and an escaping wall draw, exactly like client.jar', () => {
    const lines = script();
    const want = runOracle(lines);

    const w = world as unknown as Record<string, unknown>;
    const p3 = Pix3D as unknown as Record<string, unknown>;
    const p2 = Pix2D as unknown as Record<string, unknown>;
    const worldKeys = Object.keys(worldClinit());
    const pix3dKeys = ['originX', 'originY', 'width', 'height', 'clipMinX', 'clipMaxX', 'clipMinY', 'clipMaxY'];
    const pix2dKeys = ['pixels', 'width', 'height', 'clipMinX', 'clipMinY', 'clipMaxX', 'clipMaxY'];
    const saved = {
        world: worldKeys.map(k => [k, w[k]] as const),
        pix3d: pix3dKeys.map(k => [k, p3[k]] as const),
        pix2d: pix2dKeys.map(k => [k, p2[k]] as const)
    };
    Object.assign(w, worldClinit());
    world.drawTileQueue.clear();

    const got: string[] = [];
    try {
        for (const line of lines) got.push(runTs(line));
    } finally {
        for (const [k, v] of saved.world) w[k] = v;
        for (const [k, v] of saved.pix3d) p3[k] = v;
        for (const [k, v] of saved.pix2d) p2[k] = v;
        world.drawTileQueue.clear();
    }

    expect(want.length).toBe(lines.length);
    const mismatches: string[] = [];
    for (let i = 0; i < lines.length && mismatches.length < 6; i++) {
        if (got[i] !== want[i]) mismatches.push(`#${i} ${lines[i]}\n  java: ${want[i].slice(0, 1500)}\n  ts:   ${got[i].slice(0, 1500)}`);
    }
    expect(mismatches).toEqual([]);

    // The script reaches what it is for: draws that complete although a sprite draw threw (caught) and although a
    // getMinY threw (caught), and draws that the throwing wall aborts.
    const draws = want.filter((_, i) => lines[i].startsWith('draw '));
    expect(draws.filter(l => l.startsWith('ok|') && l.includes(' X')).length).toBeGreaterThan(5);
    expect(draws.filter(l => l.startsWith('ok|') && l.includes(' Y')).length).toBeGreaterThan(5);
    expect(draws.filter(l => l.startsWith('ex:T39|')).length).toBeGreaterThan(0);
    expect(draws.filter(l => l.startsWith('ok|') && l.includes(' D11,') && l.includes(' D12,')).length).toBeGreaterThan(5);
}, 150000);
