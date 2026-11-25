import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ModelSource from '#/dash3d/ModelSource.js';
import world from '#/dash3d/world.js';
import { JavaError } from '#/util/ClientError.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { gamepackPath } from './reference.js';

class Model extends ModelSource {
    heights = 0;
    draws = 0;

    constructor(private readonly mode = '') {
        super();
    }

    getMinY(): number {
        this.heights++;
        if (this.mode === 'heightError') throw new JavaError();
        if (this.mode === 'heightException') throw new Error();
        return 0;
    }

    draw(): void {
        this.draws++;
        if (this.mode === 'drawError') throw new JavaError();
        if (this.mode === 'drawException') throw new Error();
    }

    update(): void {}
}

function fill(mode: string): void {
    world.init(1, 1, 1, 1, false);
    const model = new Model(mode);
    world.SetSprite(0, 0, 0, 1, 1, 64, 64, 0, model, 0, false, 1n);
    const tile = requireNonNull(requireNonNull(world.squares)[0][0][0]);
    tile.drawBack = tile.drawSprites = true;
    world.fillLeft = world.cycleNo = 1;
    let result = 'returned';
    try {
        world.Fill(tile, false);
    } catch (error) {
        if (!(error instanceof JavaError)) throw error;
        result = 'escaped';
    }
    console.log(mode, result, model.heights, model.draws, tile.drawBack, tile.drawSprites, world.fillLeft, requireNonNull(tile.sprites[0]).cycle);
}

function overflow(count: number): void {
    world.init(1, 2, 1, 1, false);
    world.dynamicCount = world.numOccluders = count;
    const model = new Model();
    let status = 'returned';
    try {
        world.SetSprite(0, 0, 0, 2, 1, 128, 64, 0, model, 0, true, 0x40000001n);
    } catch (error) {
        if (!(error instanceof RangeError)) throw error;
        status = 'bounds';
    }
    const plane = requireNonNull(world.squares)[0];
    const left = requireNonNull(plane[0][0]),
        right = requireNonNull(plane[1][0]);
    const sprite = requireNonNull(left.sprites[0]);
    console.log('insert', status, world.dynamicCount, sprite === right.sprites[0], sprite.model === model, left.spriteSpans, right.spriteSpans);
    status = 'returned';
    try {
        world.SetOcclude(1, 0, 128, 0, 128, -128, 0);
    } catch (error) {
        if (!(error instanceof RangeError)) throw error;
        status = 'bounds';
    }
    console.log('occluder', status, world.numOccluders);
    const remote = world.DelLoc(0, 1, 0) === null;
    const origin = world.DelLoc(0, 0, 0) === sprite;
    console.log('remove', remote, origin, left.spriteCount, right.spriteCount, left.spriteSpans, right.spriteSpans, left.sprites[0] === null, right.sprites[0] === null, sprite.model === model);
    world.dynamicCount = world.numOccluders = 0;
}

if (process.argv[2] === 'trace') {
    for (const mode of ['heightError', 'drawError', 'heightException', 'drawException', 'ok']) fill(mode);
    for (const count of [5000, -1, 2147483647]) overflow(count);
} else {
    test('scene error handlers, counter writes and shared sprite references match the 530 gamepack', () => {
        const dir = mkdtempSync(join(tmpdir(), 'scene-ownership530-'));
        try {
            const source = fileURLToPath(new URL('./game/SceneOwnershipOracle.java', import.meta.url));
            const build = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, source]);
            expect(build.exitCode, build.stderr.toString()).toBe(0);
            const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'SceneOwnershipOracle']);
            expect(java.exitCode, java.stderr.toString()).toBe(0);
            const ts = Bun.spawnSync([process.execPath, fileURLToPath(import.meta.url), 'trace']);
            expect(ts.exitCode, ts.stderr.toString()).toBe(0);
            const expected = java.stdout.toString().trimEnd().split(/\r?\n/);
            const got = ts.stdout.toString().trimEnd().split(/\r?\n/);
            expect(expected).toContain('drawError escaped 1 1 true false 1 1');
            expect(expected).toContain('insert bounds -2147483648 true true 4 1');
            expect(got).toEqual(expected);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
}
