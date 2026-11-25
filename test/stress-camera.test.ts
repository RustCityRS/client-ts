import { expect, test } from 'bun:test';
import GlState, { transformPoint } from '#/gl/driver/GlState';
import PresentationCamera from '#/gl/driver/PresentationCamera';

type Pose = [x: number, y: number, z: number, pitch: number, yaw: number];

// Build the ordinary eye-space transform in GlRenderer.setCamera order.
function view([x, y, z, pitch, yaw]: Pose): Float32Array {
    const state = new GlState(1, true);
    state.rotate(180, 1, 0, 0);
    state.rotate(pitch, 1, 0, 0);
    state.rotate(yaw, 0, 1, 0);
    state.translate(-x, -y, -z);
    return state.modelview;
}

function expectView(change: Float32Array, capturedPose: Pose, expectedPose: Pose): void {
    const captured = view(capturedPose);
    const expected = view(expectedPose);
    // A point and three independent directions exercise translation and every rotation axis.
    for (const point of [
        [15, -24, 71, 1],
        [1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 1, 0]
    ]) {
        const actual = transformPoint(change, transformPoint(captured, point));
        const wanted = transformPoint(expected, point);
        for (let i = 0; i < 4; i++) expect(actual[i]).toBeCloseTo(wanted[i], 4);
    }
}

const identity = Float32Array.of(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);

test('inter-tick camera motion reproduces the stock CPU rotations and translations and stops after one tick', () => {
    const camera = new PresentationCamera();
    const current: Pose = [16, -3, 40, 24, 50];
    camera.capture(8, 1, 28, 16, 34, 10, 100);
    expect(camera.sample(110)).toEqual(identity);
    camera.capture(...current, 14, 180);
    expect(camera.sample(175)).toEqual(identity);
    expect(camera.sample(180)).toEqual(identity);
    expectView(camera.sample(190), current, [17, -3.5, 41.5, 25, 52]);
    // Drawing the same pose again during this tick must preserve the time of the captured motion.
    camera.capture(...current, 14, 193);
    expectView(camera.sample(200), current, [18, -4, 43, 26, 54]);
    const fullTick = camera.sample(200).slice();
    expect(camera.sample(1000)).toEqual(fullTick);
});

test.each([
    [359, 1, 2],
    [1, 359, 358]
])('yaw from %i to %i takes the short route through zero', (from, to, nextHalf) => {
    const camera = new PresentationCamera();
    const current: Pose = [40, 30, -10, 25, to];
    camera.capture(40, 30, -10, 25, from, 1, 20);
    camera.capture(...current, 2, 40);
    expectView(camera.sample(50), current, [40, 30, -10, 25, nextHalf]);
});

test.each([
    ['stationary pose', 4, 24, 3, 60],
    ['teleport', 517, 24, 3, 60],
    ['angle jump', 8, 70, 3, 60],
    ['cycle gap', 8, 28, 7, 60],
    ['time gap', 8, 28, 3, 141]
] as const)('%s discards previous camera motion', (_, x, yaw, cycle, time) => {
    const camera = new PresentationCamera();
    camera.capture(0, 0, 0, 20, 20, 1, 20);
    camera.capture(4, 0, 0, 20, 24, 2, 40);
    expect(camera.sample(50)).not.toEqual(identity);
    camera.capture(x, 0, 0, 20, yaw, cycle, time);
    expect(camera.sample(time + 10)).toEqual(identity);
});

test('reset clears the last correction and the first new capture starts at rest', () => {
    const camera = new PresentationCamera();
    camera.capture(0, 0, 0, 20, 20, 1, 20);
    camera.capture(4, 0, 0, 20, 24, 2, 40);
    expect(camera.sample(50)).not.toEqual(identity);
    camera.reset();
    expect(camera.matrix).toEqual(identity);
    expect(camera.sample(60)).toEqual(identity);
    camera.capture(8, 0, 0, 20, 28, 3, 60);
    expect(camera.sample(70)).toEqual(identity);
});
