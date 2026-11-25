import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import GroundObject from '#/dash3d/GroundObject.js';
import ModelSource from '#/dash3d/ModelSource.js';
import Sprite from '#/dash3d/Sprite.js';
import Square from '#/dash3d/Square.js';
import Wall from '#/dash3d/Wall.js';
import world from '#/dash3d/world.js';
import GlRenderer from '#/gl/GlRenderer.js';
import PointLightManager from '#/gl/PointLightManager.js';
import Preferences from '#/ui/Preferences.js';
import { loginFixture } from '../login-fixture.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

loginFixture(
    import.meta.url,
    'Fill rereads GL mode between linked wall, sprites and raised object draws as ub does',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), '530-fill-mode-'));
        try {
            const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
            const compile = Bun.spawnSync(['javac', '-cp', cp, '-d', dir, join(import.meta.dir, 'FillRendererFlagOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const oracle = Bun.spawnSync(['java', '-cp', cp, 'FillRendererFlagOracle']);
            expect(oracle.exitCode, oracle.stderr.toString()).toBe(0);
            GlRenderer['ortho2d'] = true;
            Preferences.highDetailLighting = true;
            PointLightManager.setDimensions(1, 1, 1);
            PointLightManager.allocate();
            world.levelHeightmaps = [[new Int32Array(2), new Int32Array(2)]];
            world.underwaterHeightmap = null;
            world.maxLevel = 1;
            const rows: string[] = [];
            let mask = 0;
            const events: string[] = [];
            class Model extends ModelSource {
                constructor(private readonly id: number) {
                    super();
                }
                override draw(): void {
                    events.push(this.id + '/' + Number(GlRenderer.active) + '/' + PointLightManager['lastLevel']);
                    PointLightManager['lastLevel'] = -1;
                    GlRenderer.active = (mask & (1 << (this.id + 1))) !== 0;
                }
                override getMinY(): number {
                    return 0;
                }
                override update(): void {}
            }
            for (mask = 0; mask < 32; mask++) {
                GlRenderer.active = (mask & 1) !== 0;
                PointLightManager['lastLevel'] = -1;
                events.length = 0;
                const square = new Square(0, 0, 0);
                world.squares = [[[square]]];
                square.drawFront = square.drawBack = true;
                const bridge = (square.linkedSquare = new Square(0, 0, 0));
                bridge.wall = new Wall();
                bridge.wall.model1 = new Model(0);
                for (let i = 0; i < 2; i++) {
                    const sprite = (bridge.sprites[i] = new Sprite());
                    sprite.model = new Model(i + 1);
                }
                bridge.spriteCount = 2;
                square.groundObject = new GroundObject();
                square.groundObject.height = 1;
                square.groundObject.middleObj = new Model(3);
                world.fillLeft = 1;
                world.Fill(square, false);
                rows.push([mask, ...events, 'end/' + Number(GlRenderer.active) + '/' + world.fillLeft].join(' '));
            }
            expect(rows).toEqual(oracle.stdout.toString().trimEnd().split(/\r?\n/));
            expect(rows[5]).toBe('5 0/1/0 1/0/-1 2/1/0 3/0/-1 end/0/0');
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    15000,
    'gl'
);
