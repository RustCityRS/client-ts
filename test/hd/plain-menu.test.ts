import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import ClientMouseListener from '#/client/ClientMouseListener.js';
import { fromLiteral, toJsString } from '#/datastruct/JagString.js';
import GlRaster from '#/gl/GlRaster.js';
import GlRenderer from '#/gl/GlRenderer.js';
import Pix2D from '#/graphics/Pix2D.js';
import SoftwareFont from '#/graphics/SoftwareFont.js';
import InterfaceList from '#/ui/InterfaceList.js';
import Minimenu from '#/ui/Minimenu.js';
import LocalisedText from '#/ui/LocalisedText.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { loginFixture } from '../login-fixture.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

loginFixture(
    import.meta.url,
    'HD plain context menus dispatch to the original raster, font and popup rectangles',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-hd-plain-menu-'));
        try {
            const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
            const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
            const compile = Bun.spawnSync(['javac', asm, '-cp', cp, '-d', dir, join(import.meta.dir, 'HdPlainMenuOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const java = ['java', asm, '-Djava.awt.headless=true', '-cp', cp, 'HdPlainMenuOracle'];
            const patch = Bun.spawnSync([...java, dir]);
            expect(patch.exitCode, patch.stderr.toString()).toBe(0);
            const jar = Bun.spawnSync(java);
            expect(jar.exitCode, jar.stderr.toString()).toBe(0);
            const expected = jar.stdout.toString().trimEnd().split(/\r?\n/);
            const calls: string[] = [];
            for (const [raster, owner] of [
                [GlRaster, 'dj'],
                [Pix2D, 'kb']
            ] as const) {
                raster.fillRect = (...args) => {
                    calls.push([owner + '.c', ...args].join(' '));
                };
                raster.drawRect = (...args) => {
                    calls.push([owner + '.a', ...args].join(' '));
                };
            }
            const font = (Client.fontBold12 = new SoftwareFont(new Uint8Array(257)));
            font.drawLeft = (s, ...args) => {
                calls.push([toJsString(requireNonNull(s)), ...args].join(' '));
            };
            LocalisedText.chooseOption = fromLiteral('Menu');
            for (let i = 0; i < 3; i++) {
                Minimenu.option[i] = fromLiteral('Op' + i);
                Minimenu.target[i] = fromLiteral(i === 1 ? 'target' : '');
            }
            expect(expected).toHaveLength(32);
            for (let mask = 0; mask < 32; mask++) {
                GlRenderer.active = (mask & 1) !== 0;
                Minimenu.x = (mask & 2) !== 0 ? 2147483638 : -3;
                Minimenu.y = (mask & 4) !== 0 ? -2147483640 : 13;
                Minimenu.width = (mask & 8) !== 0 ? -8 : 150;
                Minimenu.height = 69;
                ClientMouseListener.x = (Minimenu.x + 2) | 0;
                ClientMouseListener.mouseY = (Minimenu.y + 30) | 0;
                Minimenu.count = (mask & 16) !== 0 ? 0 : 3;
                InterfaceList.rootCount = 1;
                InterfaceList.rootX[0] = InterfaceList.rootY[0] = InterfaceList.rootWidth[0] = InterfaceList.rootHeight[0] = 10;
                InterfaceList.rectangleRedraw[0] = false;
                calls.length = 0;
                Minimenu.Draw();
                expect([...calls, InterfaceList.rectangleRedraw[0]].join('|')).toBe(expected[mask]);
            }
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    45000,
    'gl'
);
