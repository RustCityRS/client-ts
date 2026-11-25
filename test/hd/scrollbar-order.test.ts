import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import GlRaster from '#/gl/GlRaster.js';
import GlRenderer from '#/gl/GlRenderer.js';
import Pix2D from '#/graphics/Pix2D.js';
import Pix8 from '#/graphics/Pix8.js';
import SpriteLoader from '#/graphics/SpriteLoader.js';
import { IllegalStateException } from '#/util/JavaException.js';
import WrappedException from '#/util/WrappedException.js';
import { loginFixture } from '../login-fixture.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

loginFixture(
    import.meta.url,
    'HD scrollbar chooses one raster after the caps and rereads all ten colours before drawing',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-scrollbar-order-'));
        try {
            const cp = [dir, hdGamepackPath, joglPath].join(delimiter),
                asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
            const run = (args: string[]) => {
                const r = Bun.spawnSync(args);
                expect(r.exitCode, r.stderr.toString()).toBe(0);
                return r.stdout.toString().trim();
            };
            run(['javac', asm, '-cp', cp, '-d', dir, join(import.meta.dir, 'HdScrollbarOrderOracle.java')]);
            const java = ['java', asm, '-Djava.awt.headless=true', '-cp', cp, 'HdScrollbarOrderOracle'];
            run([...java, hdGamepackPath, dir]);
            const rows = run(java).split(/\r?\n/);
            expect(rows).toHaveLength(144);
            const caps = [0, 1].map(() => new Pix8(1, 1, 0, 0, 1, 1, Uint8Array.of(1), Int32Array.of(0, 17)));
            Pix2D.setPixels(new Int32Array(64 * 128), 64, 128);
            let active = false,
                fail = 0,
                toggle = 0;
            const events: string[] = [],
                values = [0, 0, 0, 0];
            function event(tag: string) {
                events.push(tag);
                const step = events.length;
                if (step === fail) throw new IllegalStateException('probe');
                if (step === toggle) active = !active;
                for (let i = 0; i < 4; i++) values[i] = step * 37 + i + 1;
            }
            Object.defineProperty(SpriteLoader, 'scrollbars', {
                get() {
                    event('caps');
                    return caps;
                }
            });
            Object.defineProperty(GlRenderer, 'active', {
                get() {
                    event('active');
                    return active;
                }
            });
            const colours = ['scrollbarTrack', 'scrollbarGripForeground', 'scrollbarGripHighlight', 'scrollbarGripLowlight'] as const;
            const labels = ['track', 'grip', 'light', 'dark'];
            colours.forEach((c, i) =>
                Object.defineProperty(Client, c, {
                    get() {
                        event(labels[i]);
                        return values[i];
                    }
                })
            );
            for (const [renderer, label] of [
                [Pix2D, 'kb'],
                [GlRaster, 'dj']
            ] as const) {
                renderer.fillRect = (...a) => event(label + '.c:' + a.join(','));
                renderer.hline = (...a) => event(label + '.a:' + a.join(','));
                renderer.vline = (...a) => event(label + '.b:' + a.join(','));
            }
            for (const row of rows) {
                const [input] = row.split('|');
                const [mode, flip, fault] = input.split(',').map(Number);
                events.length = 0;
                active = mode === 1;
                fail = fault;
                toggle = flip;
                let status = 'ok';
                try {
                    Client.DrawScrollbar(100, 3, 17, 240, 2);
                } catch (error) {
                    if (!(error instanceof WrappedException) || !(error.cause instanceof IllegalStateException)) throw error;
                    status = 'IllegalStateException ' + error.context;
                }
                expect([input, status, events.join(';')].join('|'), input).toBe(row);
            }
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    30000,
    'gl'
);
