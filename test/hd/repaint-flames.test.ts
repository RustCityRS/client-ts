import { captureSdFrame } from '#/dash3d/SdWorldRaster.js';
import { renderSdFrames } from '../render/sd-device.js';
import { expect } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import GameShell from '#/client/GameShell.js';
import GlRenderer from '#/gl/GlRenderer.js';
import Pix2D from '#/graphics/Pix2D.js';
import Pix32 from '#/graphics/Pix32.js';
import type { GL } from '#/jogl/GL.js';
import TitleFlames from '#/title/TitleFlames.js';
import { requireNonNull } from '#/util/JavaArray.js';
import type IntBuffer from '#/util/nio/IntBuffer.js';
import { loginFixture } from '../login-fixture.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

function hash(pixels: Int32Array): string {
    const bytes = Buffer.alloc(pixels.length * 4);
    for (let i = 0; i < pixels.length; i++) bytes.writeInt32LE(pixels[i], i * 4);
    return createHash('sha256').update(bytes).digest('hex');
}

loginFixture(
    import.meta.url,
    'HD canvas repaint and flame blit match both graphics modes of runescape_gl.jar',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-repaint-flames-'));
        try {
            const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
            const compile = Bun.spawnSync(['javac', '-cp', cp, '-sourcepath', import.meta.dir, '-d', dir, join(import.meta.dir, 'HdRepaintFlamesOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const oracle = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', cp, 'HdRepaintFlamesOracle']);
            expect(oracle.exitCode, oracle.stderr.toString()).toBe(0);
            const expected = oracle.stdout.toString().trimEnd().split(/\r?\n/);
            const actual: string[] = [];
            const shell: GameShell = Object.create(GameShell.prototype);
            for (const active of [false, true])
                for (const java5 of [false, true])
                    for (let clip = 0; clip < 4; clip++) {
                        Object.assign(GameShell, { m_activeShell: shell, m_shutdown: false, fullRedraw: false, canvasInvalid: false, java5OrLater: java5, canvasSetTime: 0n, m_frameWidth: 7, m_frameHeight: 5 });
                        GlRenderer.active = active;
                        const graphics = clip === 0 ? null : { getClip: () => (clip === 1 ? null : { x: 0, y: 0, width: clip === 2 ? 6 : 7, height: 5 }) };
                        let threw = false;
                        try {
                            shell.paint(graphics);
                        } catch {
                            threw = true;
                        }
                        actual.push([active, java5, clip, GameShell.fullRedraw, GameShell.canvasInvalid, threw].join('|'));
                    }
            let trace = '';
            GlRenderer.gl = new Proxy(
                {},
                {
                    get: (_target, name) => {
                        if (name === 'glRasterPos2i')
                            return (x: number, y: number) => {
                                trace += 'pos=' + x + ',' + y + ' ';
                            };
                        if (name === 'glDrawPixels')
                            return (w: number, h: number, format: number, type: number, pixels: IntBuffer) => {
                                trace += 'pixels=' + [w, h, format, type, hash(pixels.array())].join(',');
                            };
                        return () => {};
                    }
                }
            ) as GL;
            for (const active of [false, true])
                for (const bigEndian of [false, true]) {
                    const pixels = Int32Array.from({ length: 157 * 270 }, (_, i) => Math.imul(i, 0x12345) & 0xffffff);
                    Pix2D.setPixels(pixels, 157, 270);
                    Pix2D.setClipping(9, 12, 47, 31);
                    TitleFlames.pendingCycles = 0;
                    TitleFlames.flameLineOffset = Int32Array.from({ length: 256 }, (_, i) => (i % 25) - 7);
                    TitleFlames.flameGradient = Int32Array.from({ length: 256 }, (_, i) => i * 0xabc);
                    TitleFlames.flameBuffer = Int32Array.from({ length: 32768 }, (_, i) => i & 255);
                    TitleFlames.flameSprite = new Pix32(128, 254);
                    Object.assign(GlRenderer, { active, bigEndian, width: 157, height: 270 });
                    trace = '';
                    if (!active) {
                        const gpu = captureSdFrame(() => TitleFlames.RenderFlames(5, 7));
                        const [result] = await renderSdFrames(dir, [gpu]);
                        expect([active, bigEndian, hash(result), hash(requireNonNull(TitleFlames.flameSprite.pixels)), trace].join('|')).toBe(expected[actual.length]);
                        TitleFlames.flameSprite = new Pix32(128, 254);
                    }
                    TitleFlames.RenderFlames(5, 7);
                    actual.push([active, bigEndian, hash(pixels), hash(requireNonNull(TitleFlames.flameSprite.pixels)), trace].join('|'));
                }
            expect(actual).toEqual(expected);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    45000,
    'gl'
);
