import { expect } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Texture from '#/dash3d/Texture.js';
import { capsProfileFromJson } from '#/gl/CapsProfile.js';
import GlCleaner from '#/gl/GlCleaner.js';
import GlRenderer from '#/gl/GlRenderer.js';
import { GlTraceWriter } from '#/gl/GlTrace.js';
import { NullGLDrawable } from '#/gl/NullGL.js';
import { RecordingGLContext } from '#/gl/RecordingGL.js';
import PacketT from '#/io/PacketT.js';
import GLCapabilities from '#/jogl/GLCapabilities.js';
import { loginFixture } from '../login-fixture.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';
import { diffTraces } from './glTraceDiff.js';

loginFixture(
    import.meta.url,
    'HD terrain texture binds match the original mip levels, bytes, wraps and scroll matrices',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), '530-terrain-texture-'));
        try {
            const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
            const compile = Bun.spawnSync(['javac', '-encoding', 'UTF-8', '-cp', cp, '-d', dir, join(import.meta.dir, 'GlRecorder.java'), join(import.meta.dir, 'TerrainTextureOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const rows: { label: string; data: Uint8Array; small: boolean }[] = [];
            for (const small of [false, true])
                for (const mip of [0, 1, 2, 3])
                    for (let mode = 0; mode < 4; mode++) {
                        const label = 'm' + mip + 'c' + mode + (small ? 's' : 'l');
                        // Two real texture operators. The horizontal gradient supplies colour and the vertical gradient supplies alpha.
                        const data = Uint8Array.of(2, 0, 2, 255, 0, 0, 3, 255, 0, 0, 1, 0, mode & 1, mode >> 1, mode & 1, mode, mode === 0 ? 0 : -2, mode === 0 ? 0 : 3, mip << 4, 0);
                        rows.push({ label, data, small });
                    }
            const profile = join(import.meta.dir, 'rtx5070.json');
            const java = Bun.spawnSync(['java', '-Dgltrace.stacks=false', '-Dgltrace.caps=' + profile, '-cp', cp, 'TerrainTextureOracle', dir], {
                stdin: Buffer.from(rows.map(r => r.label + ' ' + Buffer.from(r.data).toString('hex')).join('\n') + '\n')
            });
            expect(java.exitCode, java.stderr.toString()).toBe(0);
            const writer = new GlTraceWriter();
            const drawable = new NullGLDrawable(capsProfileFromJson(readFileSync(profile, 'utf8')), new GLCapabilities());
            drawable.setRealized(true);
            const context = new RecordingGLContext(drawable.createContext(null), writer);
            context.makeCurrent();
            GlRenderer.gl = context.getGL();
            GlRenderer.active = true;
            GlRenderer.cycle = 73;
            const state: string[] = [];
            for (const { label, data, small } of rows) {
                const texture = new Texture(new PacketT(data));
                writer.mark(label);
                const cold = texture.bind(null, null, small);
                const warm = texture.bind(null, null, small);
                state.push([label, cold, warm, GlCleaner.textureMemory].join(' '));
            }
            context.release();
            expect(state).toEqual(java.stdout.toString().trim().split(/\r?\n/));
            const original = readFileSync(join(dir, 'trace.tsv'), 'utf8');
            const diff = diffTraces(original, writer.text(), { includeDeletions: true });
            expect(diff.equal, diff.report).toBe(true);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    60000,
    'gl'
);
