import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import GlModel from '#/dash3d/GlModel.js';
import GlModelStream from '#/dash3d/GlModelStream.js';
import Pix3D from '#/dash3d/Pix3D.js';
import GlRenderer from '#/gl/GlRenderer.js';
import PacketT from '#/io/PacketT.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { loginFixture } from '../login-fixture.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

loginFixture(
    import.meta.url,
    'HD vertex uploads and rotations preserve native partial writes and aliases',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), '530-hd-model-loops-'));
        try {
            const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
            const build = Bun.spawnSync(['javac', '-cp', cp, '-d', dir, join(import.meta.dir, 'HdModelHotLoopOracle.java')]);
            expect(build.exitCode, build.stderr.toString()).toBe(0);
            const run = Bun.spawnSync(['java', '-cp', cp, 'HdModelHotLoopOracle']);
            expect(run.exitCode, run.stderr.toString()).toBe(0);
            const rows: string[] = [];
            for (const big of [false, true])
                for (let size = 0; size < 36; size++) {
                    GlRenderer.bigEndian = big;
                    const model = new GlModel(),
                        bytes = new Uint8Array(size),
                        packet = (GlModel.packet = new PacketT(bytes));
                    model.positionStream = new GlModelStream();
                    model.vertexCount = 3;
                    model.pointX = Int32Array.of(1, 2147483647, 16777217);
                    model.pointY = Int32Array.of(-175, -174, -173);
                    model.pointZ = Int32Array.of(9, 8, -7);
                    model.vertexOffsets = Int32Array.of(0, 1, 2, 3);
                    model.vertexIndices = Int16Array.of(1, 2, 3);
                    expect(() => model['uploadVertices'](false, true, false, false, false)).toThrow(RangeError);
                    rows.push('p ' + packet.m_pos + ' ' + Buffer.from(bytes).toString('hex'));
                }
            const hash = (p: Int32Array): number => p.reduce((h, n) => (Math.imul(31, h) + n) | 0, 1);
            for (let mode = 0; mode < 10; mode++) {
                const model = new GlModel(),
                    x = mode === 8 ? requireNonNull(Pix3D.sinTable) : mode === 9 ? requireNonNull(Pix3D.cosTable) : Int32Array.of(35032, -6001, 1677731);
                let y = mode === 1 ? x : Int32Array.of(912437, -9811, 739);
                const z = mode === 2 ? y : Int32Array.of(-4811, -313138, 120);
                if (mode === 3) y = Int32Array.of(912437);
                model.pointX = x;
                model.pointY = y;
                model.pointZ = z;
                model.labelVertices = [Int32Array.of(0, 1, mode === 4 ? -1 : 2)];
                GlModel.pivotX = 13;
                GlModel.pivotY = -55;
                GlModel.pivotZ = 121;
                let fault = 'ok';
                try {
                    model.Animate2(2, Int32Array.of(0), mode === 5 ? 2121 : 113, mode === 6 ? -1 : 19, mode === 7 ? 2048 : mode >= 8 ? 1 : 97, false);
                } catch (e) {
                    if (!(e instanceof RangeError)) throw e;
                    fault = 'bounds';
                }
                rows.push('r ' + fault + ' ' + hash(x) + ' ' + hash(y) + ' ' + hash(z));
            }
            expect(rows).toEqual(run.stdout.toString().trimEnd().split(/\r?\n/));
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    30000,
    'gl'
);
