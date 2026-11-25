import { test, expect } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';
import GroundShadowBlock from '#/dash3d/GroundShadowBlock.js';
import GlRenderer from '#/gl/GlRenderer.js';
import GlCleaner from '#/gl/GlCleaner.js';
import NullGL from '#/gl/NullGL.js';
import { FALLBACK_CAPS_PROFILE } from '#/gl/CapsProfile.js';
import Pix8 from '#/graphics/Pix8.js';
import ByteBuffer from '#/util/nio/ByteBuffer.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

test('HD ground shadow uploads, coverage hashes, fault locations and scratch prefixes match wm', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rs530-shadow-texture-'));
    const gl = GlRenderer.gl,
        bound = GlRenderer['boundTexture'],
        mem = GlCleaner.textureMemory,
        old = GroundShadowBlock['scratch'];
    let uploaded = '-';
    const sha = (data: Uint8Array | null) => (data === null ? '-' : createHash('sha256').update(data).digest('hex'));
    try {
        const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
        const compile = Bun.spawnSync(['javac', '-cp', cp, '-d', dir, join(import.meta.dir, 'HdShadowTextureOracle.java')]);
        expect(compile.exitCode, compile.stderr.toString()).toBe(0);
        const cases = [
            [130, 16900, 0, 0],
            [1666, 1666 * 1666, 12, 12],
            [130, 16770, 0, 0],
            [130, 16650, 0, 0],
            [129, 16642, 0, 0],
            [127, 17000, 0, 0],
            [130, 9000, 0, 0],
            [131, -1, 0, 0],
            [130, 16900, -1, 0],
            [130, 16900, 1, 2147483647],
            [0, 400, 0, 0],
            [-1, 400, 0, 0]
        ].flatMap(row => [0, 1, 2].flatMap(p => [16384, 123, -1].map(size => [...row, size, p])));
        const run = Bun.spawnSync(['java', '-XX:-OmitStackTraceInFastThrow', '-cp', cp, 'HdShadowTextureOracle'], { stdin: Buffer.from(cases.map(c => c.join(' ')).join('\n') + '\n') });
        expect(run.exitCode, run.stderr.toString()).toBe(0);
        const reference = run.stdout.toString().trim().split(/\r?\n/);
        const mockGl = new NullGL(FALLBACK_CAPS_PROFILE);
        mockGl.glTexImage2D = (_target, _level, _internal, _w, _h, _border, _format, _type, b) => {
            if (!(b instanceof ByteBuffer)) throw new Error('Expected shadow ByteBuffer');
            uploaded = sha(b.storageBytes().subarray(b.position(), b.limit()));
        };
        GlRenderer.gl = mockGl;
        let index = 0;
        for (const [width, size, x, z, len, pattern] of cases) {
            const pixels = size < 0 ? null : Uint8Array.from({ length: size }, (_, i) => (pattern === 0 ? 0 : pattern === 1 ? 200 : (i * 13 + ((i / 11) | 0)) % 7 === 0 ? i | 1 : 0));
            const map = new Pix8(1, 1, 0, 0, width, 1, pixels, null);
            const scratch = (GroundShadowBlock['scratch'] = len < 0 ? null : new Uint8Array(len).fill(0x9a));
            const block = new GroundShadowBlock();
            for (let repeat = 0; repeat < 2; repeat++) {
                let outcome: string;
                uploaded = '-';
                try {
                    outcome = String(block.updateTexture(map, x, z));
                } catch (e) {
                    if (e instanceof TypeError) outcome = 'null';
                    else if (e instanceof RangeError) outcome = 'bounds ' + e.message.split(' ').at(-1);
                    else throw e;
                }
                expect([outcome, block['coverageHash'], sha(scratch), uploaded].join(' '), [width, size, x, z, len, pattern, repeat].join(' ')).toBe(reference[index++]);
            }
        }
        expect(index).toBe(reference.length);
    } finally {
        GroundShadowBlock['scratch'] = old;
        GlRenderer.gl = gl;
        GlRenderer['boundTexture'] = bound;
        GlCleaner.textureMemory = mem;
        rmSync(dir, { recursive: true, force: true });
    }
}, 60000);
