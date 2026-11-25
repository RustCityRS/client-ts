import { expect } from 'bun:test';
import { delimiter, join } from 'node:path';
import { glJar } from '#/client/ClientVariant.js';
import LocType from '#/config/LocType.js';
import Preferences from '#/ui/Preferences.js';
import { loginFixture } from '../login-fixture.js';
import { gamepackPath } from '../reference.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

for (const identity of ['sd', 'gl'] as const) {
    loginFixture(
        import.meta.url,
        identity + ' level preference follows the original saved and effective values across mode switches',
        async () => {
            const renderer = glJar ? (await import('#/gl/GlRenderer.js')).default : null;
            const saved = Preferences.allLevelsVisible,
                low = LocType.m_lowMem,
                active = renderer?.active ?? false;
            try {
                const cp = glJar ? [hdGamepackPath, joglPath].join(delimiter) : gamepackPath;
                const original = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', cp, join(import.meta.dir, 'LevelVisibilityOracle.java'), identity]);
                expect(original.exitCode, original.stderr.toString()).toBe(0);
                const rows = original.stdout.toString().trimEnd().split(/\r?\n/);
                expect(rows).toHaveLength(32);
                for (let bits = 0; bits < 32; bits++) {
                    Preferences.allLevelsVisible = (bits & 1) !== 0;
                    LocType.m_lowMem = (bits & 2) !== 0;
                    if (renderer !== null) renderer.active = (bits & 4) !== 0;
                    const before = Preferences.getAllLevelsVisible();
                    Preferences.setAllLevelsVisible((bits & 8) !== 0);
                    const effective = Preferences.getAllLevelsVisible();
                    if (renderer !== null) renderer.active = (bits & 16) !== 0;
                    expect([bits, before, Preferences.allLevelsVisible, LocType.m_lowMem, effective, Preferences.getAllLevelsVisible()].join(' ')).toBe(rows[bits]);
                }
            } finally {
                if (renderer !== null) renderer.active = active;
                Preferences.allLevelsVisible = saved;
                LocType.m_lowMem = low;
            }
        },
        30000,
        identity
    );
}
