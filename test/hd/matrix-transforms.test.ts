import { expect, test } from 'bun:test';
import { requireNonNull } from '#/util/JavaArray.js';
import { GLX as E } from '#/gl/driver/GlEnums.js';
import GlState, { identity } from '#/gl/driver/GlState.js';

// Evaluate the full column-major 4x4 product independently of the driver's in-place operations.
function product(left: Float32Array, right: ArrayLike<number>): Float32Array {
    const result = new Float32Array(16);
    for (let col = 0; col < 4; col++) {
        for (let row = 0; row < 4; row++) {
            let sum = 0;
            for (let i = 0; i < 4; i++) sum += left[4 * i + row] * right[4 * col + i];
            result[4 * col + row] = sum;
        }
    }
    return result;
}

function rotation(angle: number, x: number, y: number, z: number): Float64Array | null {
    const length = Math.sqrt(x * x + y * y + z * z);
    if (length === 0) return null;
    x /= length;
    y /= length;
    z /= length;
    const radians = (angle * Math.PI) / 180;
    const c = Math.cos(radians),
        s = Math.sin(radians),
        t = 1 - c;
    return Float64Array.of(x * x * t + c, y * x * t + z * s, x * z * t - y * s, 0, x * y * t - z * s, y * y * t + c, y * z * t + x * s, 0, x * z * t + y * s, y * z * t - x * s, z * z * t + c, 0, 0, 0, 0, 1);
}

test('all sixteen matrix words survive specialized translation, rotation and scale', () => {
    const state = new GlState(2, true);
    let seed = 0x50d147;
    function random(): number {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return (seed / 0x80000000 - 1) * 1024;
    }
    const arguments3 = [
        [0, -0, 0],
        [3, -2, 7],
        [1, 2, -3],
        [1 / 3, -Math.PI, 1e-18],
        [1e38, 1e-42, 0],
        [Infinity, 0, 1],
        [0, -Infinity, -1],
        [NaN, 2, 3]
    ];
    const matrices = [identity(), new Float32Array(16).fill(-0), Float32Array.of(-0, 2, 0, -3, Infinity, -1, 0, 0, 1, 0, -Infinity, NaN, 1, NaN, -0, 1), Float32Array.of(1e-38, 0, 0, -0, -1e-39, -0, 1e-45, 0, -0, 0, -1e29, 0, 0, 0, 0, 1)];
    for (let i = 0; i < 60; i++) matrices.push(Float32Array.from({ length: 16 }, random));
    let count = 0;
    function check(reference: Float32Array, label: string, preserveNaN = false): void {
        const expected = new Uint32Array(reference.buffer);
        const actual = new Uint32Array(state.current.buffer);
        for (let i = 0; i < 16; i++) {
            // JS engines may choose either NaN sign for a floating-point operation. A zero-axis
            // rotation returns the original matrix directly and must preserve even its NaN bits.
            if (!preserveNaN && Number.isNaN(reference[i]) && Number.isNaN(state.current[i])) continue;
            if (actual[i] !== expected[i]) expect(actual[i], label + ', word ' + i).toBe(expected[i]);
        }
        count++;
    }
    for (const [index, input] of matrices.entries()) {
        state.matrixMode = [E.GL_MODELVIEW, E.GL_PROJECTION, E.GL_TEXTURE][index % 3];
        state.activeTexture = index % 2;
        for (const [x, y, z] of arguments3) {
            const translation = identity();
            translation.set([x, y, z], 12);
            state.loadMatrix(input, 0);
            state.translate(x, y, z);
            check(product(input, translation), 'translate ' + [index, x, y, z]);
            const scale = Float64Array.of(x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1);
            state.loadMatrix(input, 0);
            state.scale(x, y, z);
            check(product(input, scale), 'scale ' + [index, x, y, z]);
            const angle = random();
            const turn = rotation(angle, x, y, z);
            state.loadMatrix(input, 0);
            state.rotate(angle, x, y, z);
            check(turn === null ? input : product(input, turn), 'rotate ' + [index, angle, x, y, z], turn === null);
        }
    }
    expect(count).toBe(1536);

    // The camera rotates around +X, +X again for pitch, then +Y for yaw.
    // Replay the same angles across different input matrices and through exceptional GL floats.
    for (const input of matrices) {
        for (const angle of [-0, 0, 180, 33.75, 33.75, -351.5625, Math.fround(1e-45), Math.fround(3e38), Infinity, -Infinity, NaN]) {
            for (const [x, y, z] of [
                [1, 0, 0],
                [0, 1, 0],
                [1, -0, -0],
                [-0, 1, -0]
            ]) {
                state.loadMatrix(input, 0);
                state.rotate(angle, x, y, z);
                check(product(input, requireNonNull(rotation(angle, x, y, z))), 'camera rotate ' + [angle, x, y, z]);
            }
        }
    }
    expect(count).toBe(4352);
});
