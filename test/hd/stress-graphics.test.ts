import { expect, test } from 'bun:test';

import Pix3D from '#/dash3d/Pix3D';
import world from '#/dash3d/world';
import GlRenderer from '#/gl/GlRenderer';
import Preferences from '#/ui/Preferences';
import { requireNonNull } from '#/util/JavaArray';
import { loginFixture } from '../login-fixture';

test('HD stress draws farther using temporary render settings and preserves the saved options', () => {
    const lights = Preferences.highDetailLighting;
    const shadows = Preferences.sceneryShadows;
    const camera = [world.cameraCosX, world.cameraCosY, world.cameraSinX, world.cameraSinY];
    const clip = [Pix3D.clipMinX, Pix3D.clipMaxX, Pix3D.clipMinY, Pix3D.clipMaxY];
    const farCornerVisible = () => world.testColumn(103 * 128, 0, 0, 103 * 128, GlRenderer.sceneFar);
    try {
        Preferences.highDetailLighting = false;
        Preferences.sceneryShadows = 0;
        world.cameraCosX = 65536;
        world.cameraSinX = 0;
        world.cameraCosY = 46341;
        world.cameraSinY = -46341;
        [Pix3D.clipMinX, Pix3D.clipMaxX, Pix3D.clipMinY, Pix3D.clipMaxY] = [-256, 256, -167, 167];
        const stored = Preferences.encode().m_data;
        const reported = Preferences.packPreferences();
        expect(GlRenderer.sceneFar).toBe(3584);
        expect(GlRenderer.sceneRadius).toBe(28);
        expect(farCornerVisible()).toBe(false);
        Preferences.setStressGraphics(true);
        expect(GlRenderer.sceneFar).toBe(20480);
        expect(GlRenderer.sceneRadius).toBe(104);
        expect(farCornerVisible()).toBe(true);
        expect(Preferences.graphics.highDetailLighting).toBe(true);
        expect(Preferences.graphics.sceneryShadows).toBe(2);
        expect(Preferences.graphics.currentAntiAliasingMode).toBe(2);
        expect(Preferences.encode().m_data).toEqual(stored);
        expect(Preferences.packPreferences()).toBe(reported);
        Preferences.sceneryShadows = 1;
        Preferences.setStressGraphics(false);
        expect(farCornerVisible()).toBe(false);
        expect(Preferences.graphics.highDetailLighting).toBe(false);
        expect(Preferences.graphics.sceneryShadows).toBe(1);
    } finally {
        Preferences.setStressGraphics(false);
        Preferences.highDetailLighting = lights;
        Preferences.sceneryShadows = shadows;
        [world.cameraCosX, world.cameraCosY, world.cameraSinX, world.cameraSinY] = camera;
        [Pix3D.clipMinX, Pix3D.clipMaxX, Pix3D.clipMinY, Pix3D.clipMaxY] = clip;
    }
});

loginFixture(
    import.meta.url,
    'HD full-region visibility follows camera movement to every loaded corner',
    async () => {
        GlRenderer.active = true;
        Preferences.setStressGraphics(true);
        world.init(4, 104, 104, GlRenderer.sceneRadius, false);
        world.Render = () => {};
        let tested = 0;
        world.testColumn = (_x, _top, _bottom, _z, far) => {
            tested++;
            return far === 20480;
        };
        for (const [x, z] of [
            [0, 0],
            [103, 103],
            [0, 103],
            [103, 0],
            [52, 51],
            [52, 51]
        ]) {
            tested = 0;
            world.draw(x * 128, 0, z * 128, 128, 0, null, null, null, null, null, null, 0, 0, x, z);
            expect([world.minX, world.minZ, world.maxX, world.maxZ, tested]).toEqual([0, 0, 104, 104, 104 * 104]);
            const left = 104 - x,
                top = 104 - z;
            for (const [map, halo] of [
                [requireNonNull(world.cornerVisibility), 0],
                [requireNonNull(world.visibilityMap), 1]
            ] as const) {
                let mismatches = 0;
                for (let i = 0; i < map.length; i++) {
                    for (let j = 0; j < map[i].length; j++) {
                        const expected = i >= left - halo && i < left + 104 && j >= top - halo && j < top + 104;
                        if (map[i][j] !== expected) mismatches++;
                    }
                }
                expect(mismatches).toBe(0);
            }
        }
    },
    10000,
    'gl'
);

loginFixture(
    import.meta.url,
    'HD visibility rows follow live heights, overwritten masks and Java bounds faults',
    async () => {
        GlRenderer.active = true;
        const column = world.testColumn;
        const checked: typeof column = (...args) => column(...args);
        world.Render = () => {};
        [Pix3D.clipMinX, Pix3D.clipMaxX, Pix3D.clipMinY, Pix3D.clipMaxY] = [-256, 256, -167, 167];
        const masks = () => [requireNonNull(world.cornerVisibility), requireNonNull(world.visibilityMap)].map(rows => Buffer.from(rows.flat().map(Number)).toString('base64'));
        for (const radius of [28, 104]) {
            Preferences.setStressGraphics(radius === 104);
            for (const damage of ['heights', 'corner', 'tile']) {
                const run = (testColumn: typeof column) => {
                    world.testColumn = testColumn;
                    world.init(4, 104, 104, radius, true);
                    world.underwaterSquares = null;
                    const draw = () => world.draw(6400, -300, 6400, 220, 0, null, null, null, null, null, null, 0, 0, 50, 50);
                    draw();
                    requireNonNull(world.mainGroundh)[3][49].fill(65432);
                    requireNonNull(world.underwaterHeightmap)[0][49].fill(-12345);
                    requireNonNull(world.cornerVisibility)[radius + 2].fill(true);
                    requireNonNull(world.visibilityMap)[radius + 2].fill(false);
                    draw();
                    const edited = masks();
                    world.underwaterHeightmap = null;
                    if (damage === 'heights') requireNonNull(world.mainGroundh)[3][51] = new Int32Array(53);
                    if (damage === 'corner') requireNonNull(world.cornerVisibility)[radius + 1].length = radius + 3;
                    if (damage === 'tile') requireNonNull(world.visibilityMap)[radius + 1].length = radius + 3;
                    try {
                        draw();
                    } catch (err) {
                        return [edited, String(err), masks()];
                    }
                    throw new Error('Expected a Java bounds fault');
                };
                expect(run(column)).toEqual(run(checked));
            }
        }
    },
    10000,
    'gl'
);
