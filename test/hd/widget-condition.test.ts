import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import Pix2D from '#/graphics/Pix2D.js';
import SoftwareFont from '#/graphics/SoftwareFont.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import WrappedException from '#/util/WrappedException.js';
import { loginFixture } from '../login-fixture.js';
import { gamepackPath } from '../reference.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

function outcome(call: () => unknown): string {
    try {
        return String(call());
    } catch (error) {
        if (!(error instanceof WrappedException) || !(error.cause instanceof TypeError)) throw error;
        return 'NullPointerException ' + error.context?.split(' ')[0];
    }
}

for (const identity of ['sd', 'gl'] as const) {
    loginFixture(
        import.meta.url,
        identity + ' widget-condition guards match five native callers and all CS1 comparisons',
        async () => {
            const hd = identity === 'gl';
            const dir = mkdtempSync(join(tmpdir(), 'rs530-widget-condition-'));
            const cp = [dir, ...(hd ? [hdGamepackPath, joglPath] : [gamepackPath])].join(delimiter);
            try {
                const compile = Bun.spawnSync(['javac', '-d', dir, join(import.meta.dir, 'WidgetConditionOracle.java')]);
                expect(compile.exitCode, compile.stderr.toString()).toBe(0);
                const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', cp, 'WidgetConditionOracle', identity]);
                expect(java.exitCode, java.stderr.toString()).toBe(0);
                const rows = java.stdout.toString().trimEnd().split(/\r?\n/);
                Pix2D.setPixels(new Int32Array(256), 16, 16);
                InterfaceList.rectRedrawnLastFrame[0] = true;
                IfType.m_fontCache.Put(5n, new SoftwareFont(new Uint8Array(257)));
                let row = 0;
                for (const kind of [3, 4, 5, 6, 7]) {
                    const c = Object.assign(new IfType(), {
                        type: kind === 7 ? 6 : kind,
                        parentId: -1,
                        width: 12,
                        height: 12,
                        fontId: 5,
                        modelAnim: 3,
                        comparisonOps: Int32Array.of(0),
                        comparisonValues: null
                    });
                    const result = outcome(() => (kind === 7 ? Client.AnimateLayer([c], -1) : Client.DrawLayer(0, [c], -1, 16, 0, 0, 16, 0, 0)));
                    expect(result, 'caller ' + kind).toBe(rows[row++]);
                }
                for (const guard of hd ? [26, 97, 69, 110, 33] : [-70, 125, -117, -17, -74]) {
                    expect(outcome(() => Client.GetIfActive(null, guard))).toBe(rows[row++]);
                    for (const code of [0, 2, 3, 4])
                        for (const target of [6, 7, 8]) {
                            const c = Object.assign(new IfType(), { comparisonOps: Int32Array.of(code), comparisonValues: Int32Array.of(target), scripts: [Int32Array.of(20, 7, 0)] });
                            expect(outcome(() => Client.GetIfActive(c, guard))).toBe(rows[row++]);
                        }
                }
                expect(row).toBe(70);
                expect(rows).toHaveLength(row);
            } finally {
                rmSync(dir, { recursive: true, force: true });
            }
        },
        30000,
        identity
    );
}
