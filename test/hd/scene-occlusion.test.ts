import { expect, test } from 'bun:test';
import Occlude from '#/dash3d/Occlude';
import SceneOcclusionQueries from '#/dash3d/SceneOcclusionQueries';
import world from '#/dash3d/world';

test('stationary point queries match the scene after in-place plane edits, list replacement and malformed inputs', () => {
    const planes = Array.from({ length: 8 }, () => new Occlude());
    Object.assign(planes[0], { mode: 5, minX: 100, maxX: 200, minZ: 100, maxZ: 200 });
    const memo = new SceneOcclusionQueries();
    const oldPlanes = world.activeOccluders;
    const oldCount = world.numActiveOccluders;
    let scans = 0;
    const testPoint = (x: number, y: number, z: number) => {
        scans++;
        return world.Occluded(x, y, z);
    };
    try {
        world.activeOccluders = planes;
        world.numActiveOccluders = planes.length;
        memo.begin(planes, planes.length);
        expect(memo.active).toBeNull();
        memo.begin(planes, planes.length);
        for (let i = 0; i < 2; i++) {
            expect(memo.query(100, 200, 200, testPoint)).toBe(true);
            expect(memo.query(99, 200, 200, testPoint)).toBe(false);
        }
        expect(scans).toBe(2);
        planes[0].minDeltaX = 256;
        memo.begin(planes, planes.length);
        expect(memo.active).toBeNull();
        memo.begin(planes, planes.length);
        expect(memo.query(100, 200, 200, testPoint)).toBe(false);
        const replacement = [...planes];
        replacement[0] = Object.assign(new Occlude(), { mode: 5, minX: 99, maxX: 100, minZ: 200, maxZ: 200 });
        world.activeOccluders = replacement;
        memo.begin(replacement, replacement.length);
        memo.begin(replacement, replacement.length);
        expect(memo.query(99, 200, 200, testPoint)).toBe(true);
        expect(memo.query(100, 200, 200, testPoint)).toBe(true);
        expect(memo.query(100.5, 200, 200, testPoint)).toBe(false);
        world.numActiveOccluders++;
        memo.begin(replacement, world.numActiveOccluders);
        expect(memo.active).toBeNull();
        expect(() => memo.query(0, 0, 0, testPoint)).toThrow('array index 8');
    } finally {
        world.activeOccluders = oldPlanes;
        world.numActiveOccluders = oldCount;
    }
});
