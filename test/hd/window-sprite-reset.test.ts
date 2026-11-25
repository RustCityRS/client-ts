import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import PixfontGeneric from '#/graphics/PixfontGeneric.js';
import SpriteLoader from '#/graphics/SpriteLoader.js';
import Minimenu from '#/ui/Minimenu.js';
import { loginFixture } from '../login-fixture.js';
import { gamepackPath } from '../reference.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

for (const variant of ['sd', 'gl'] as const) {
    loginFixture(
        import.meta.url,
        variant + ' window sprite reset preserves each original field store',
        async () => {
            const dir = mkdtempSync(join(tmpdir(), 'rs530-window-sprites-'));
            try {
                const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
                const cp = [dir, ...(variant === 'gl' ? [hdGamepackPath, joglPath] : [gamepackPath])].join(delimiter);
                const compile = Bun.spawnSync(['javac', asm, '-d', dir, join(import.meta.dir, 'WindowSpriteResetOracle.java')]);
                expect(compile.exitCode, compile.stderr.toString()).toBe(0);
                const java = ['java', asm, '-Djava.awt.headless=true', '-cp', cp, 'WindowSpriteResetOracle', variant];
                const patch = Bun.spawnSync([...java, dir]);
                expect(patch.exitCode, patch.stderr.toString()).toBe(0);
                const run = Bun.spawnSync(java);
                expect(run.exitCode, run.stderr.toString()).toBe(0);
                const observed: string[] = [];
                function watch<T extends object>(owner: T, fields: Partial<Record<keyof T, string>>) {
                    for (const [field, slot] of Object.entries(fields)) {
                        Object.defineProperty(owner, field, {
                            configurable: true,
                            set(value) {
                                expect(value).toBeNull();
                                observed.push(String(slot));
                            }
                        });
                    }
                }
                if (variant === 'gl') {
                    watch(Client, {
                        p12: 'rh.h',
                        imageHitmarks: 're.w',
                        p11Software: 'vj.j',
                        imageMapfunction: 'nk.L',
                        hintMapMarkers: 'lj.t',
                        imageHeadiconsPrayer: 'km.sc',
                        fontBold12: 'wl.q',
                        imageCompass: 'ic.a',
                        imageMapdots: 'l.j',
                        fontPlain11: 'j.x',
                        imageMapflag: 'gk.l',
                        hintHeadicons: 'wh.l',
                        headiconsPk: 'rl.V'
                    });
                    watch(SpriteLoader, { cross: 'tg.d', mapfunctionsRecoloured: 'fe.lc', hitbarDefault: 'jb.k', hintMapEdge: 'wi.R', scrollbars: 'th.f' });
                    watch(PixfontGeneric, { nameIcons: 'mi.T' });
                    Client.clearWindowSprites();
                    watch(Minimenu, { bottomEdgeSprite: 'nb.i', titleBarSprite: 'd.ib', styleSideSprite: 'hd.e', skinTitleEndSprite2: 'oi.h', spriteBottomCorner: 'qi.z' });
                } else {
                    watch(Minimenu, { bottomEdgeSprite: 'sc.N', titleBarSprite: 'o.R', styleSideSprite: 'ra.Q', skinTitleEndSprite2: 'c.E', spriteBottomCorner: 'dd.i' });
                }
                Minimenu.clearSprites();
                watch(
                    SpriteLoader,
                    variant === 'gl'
                        ? { widths: 'uj.x', yOffsets: 'wa.z', innerHeights: 'ca.Y', pixels: 'ah.l', xOffsets: 'wf.b', palette: 'vc.R', hasAlpha: 'mi.W', alphas: 'fb.n' }
                        : { widths: 'jh.l', yOffsets: 'ff.s', innerHeights: 'df.H', pixels: 'vg.hb', xOffsets: 'qj.B', palette: 'ke.m', hasAlpha: 'c.v', alphas: 'tb.d' }
                );
                SpriteLoader.clear();
                expect(observed).toEqual(run.stdout.toString().trimEnd().split(/\r?\n/));
            } finally {
                rmSync(dir, { recursive: true, force: true });
            }
        },
        45000,
        variant
    );
}
