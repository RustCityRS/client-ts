import { requireNonNull } from '#/util/JavaArray.js';
import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import ModelLitImpl from '#/dash3d/ModelLitImpl.js';
import Pix3D from '#/dash3d/Pix3D.js';
import { loginFixture } from '../login-fixture.js';
import { gamepackPath } from '../reference.js';

loginFixture(
    import.meta.url,
    'software pivot, translation and rotation preserve original partial stores and fault index',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), '530-software-animation-'));
        const sin = requireNonNull(Pix3D.sinTable),
            cos = requireNonNull(Pix3D.cosTable);
        const origin = [ModelLitImpl['originX'], ModelLitImpl['originY'], ModelLitImpl['originZ']];
        try {
            const cp = [dir, gamepackPath].join(delimiter);
            const compile = Bun.spawnSync(['javac', '-cp', cp, '-d', dir, join(import.meta.dir, 'model-lit', 'AnimationBoundsOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const oracle = Bun.spawnSync(['java', '-XX:-OmitStackTraceInFastThrow', '-cp', cp, 'AnimationBoundsOracle']);
            expect(oracle.exitCode, oracle.stderr.toString()).toBe(0);
            const rows = oracle.stdout.toString().trimEnd().split(/\r?\n/);
            for (let op = 0; op < 3; op++) {
                for (let mode = 0; mode < 26; mode++) {
                    const points: (Int32Array | null)[] = [Int32Array.of(2147483647, -142, 83), Int32Array.of(-911, 53, 15), Int32Array.of(136, 791, -2147483648)];
                    let vertices: (Int32Array | null)[] | null = [Int32Array.of(0, 1, 2), Int32Array.of(2, 1, 1)];
                    let labels: Int32Array | null = Int32Array.of(0, 1);
                    let x = 7,
                        y = 13,
                        z = 23;
                    Pix3D.sinTable = sin;
                    Pix3D.cosTable = cos;
                    switch (mode) {
                        case 1:
                        case 2:
                        case 3:
                            points[mode - 1] = null;
                            break;
                        case 4:
                        case 5:
                        case 6:
                            points[mode - 4] = requireNonNull(points[mode - 4]).slice(0, 1);
                            break;
                        case 7:
                            requireNonNull(vertices[0])[1] = -1;
                            break;
                        case 8:
                            requireNonNull(vertices[1])[2] = 9;
                            break;
                        case 9:
                            labels[1] = -1;
                            break;
                        case 10:
                            labels[0] = 5;
                            break;
                        case 11:
                            labels = null;
                            break;
                        case 12:
                            vertices[1] = null;
                            break;
                        case 13:
                            vertices = null;
                            break;
                        case 14:
                            points[1] = points[0];
                            break;
                        case 15:
                            points[2] = points[1];
                            break;
                        case 16:
                            points[2] = points[1] = points[0];
                            break;
                        case 17:
                            x = -77;
                            break;
                        case 18:
                            y = 4097;
                            break;
                        case 19:
                            z = -13;
                            break;
                        case 20:
                            Pix3D.sinTable = null;
                            break;
                        case 21:
                            Pix3D.cosTable = cos.slice(0, 10);
                            z = 0;
                            break;
                        case 22:
                            Pix3D.sinTable = sin.slice(0, 13);
                            z = 3;
                            break;
                        case 23:
                            labels = new Int32Array(0);
                            break;
                        case 24:
                            vertices[0] = points[0];
                            break;
                        case 25:
                            labels = points[1];
                            break;
                    }
                    const model = new ModelLitImpl();
                    [model.pointX, model.pointY, model.pointZ] = points;
                    model['labelVertices'] = vertices;
                    [ModelLitImpl['originX'], ModelLitImpl['originY'], ModelLitImpl['originZ']] = [31, 26, 21];
                    let outcome = 'ok';
                    try {
                        model.Animate2(op, labels, x, y, z, false);
                    } catch (e) {
                        if (e instanceof TypeError) outcome = 'null';
                        else if (e instanceof RangeError && /^array index -?\d+$/.test(e.message)) outcome = e.message.slice('array index '.length);
                        else throw e;
                    }
                    const coords = points.map(p => (p === null ? 'null' : '[' + p.join(', ') + ']'));
                    expect([op, mode, outcome, ModelLitImpl['originX'], ModelLitImpl['originY'], ModelLitImpl['originZ'], ...coords].join(' ')).toBe(rows[op * 26 + mode]);
                }
            }
        } finally {
            Pix3D.sinTable = sin;
            Pix3D.cosTable = cos;
            [ModelLitImpl['originX'], ModelLitImpl['originY'], ModelLitImpl['originZ']] = origin;
            rmSync(dir, { recursive: true, force: true });
        }
    },
    30000,
    'sd'
);
