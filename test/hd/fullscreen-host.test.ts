import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import GameShell from '#/client/GameShell.js';
import Signlink from '#/util/Signlink.js';
import WrappedException from '#/util/WrappedException.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

test('the original HD fullscreen routine selects display depth, releases failed frames and preserves request faults', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rs530-fullscreen-'));
    const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
    const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
    try {
        const javac = Bun.spawnSync(['javac', asm, '-encoding', 'UTF-8', '-cp', cp, '-d', dir, join(import.meta.dir, 'WindowLayoutOracle.java'), join(import.meta.dir, 'FullscreenHostOracle.java')]);
        expect(javac.exitCode, javac.stderr.toString()).toBe(0);
        const java = ['java', asm, '-Djava.awt.headless=true', '-cp', cp, 'FullscreenHostOracle'];
        const host = Bun.spawnSync([...java, dir]);
        expect(host.exitCode, host.stderr.toString()).toBe(0);
        const original = Bun.spawnSync(java);
        expect(original.exitCode, original.stderr.toString()).toBe(0);
        const rows = original.stdout.toString().trimEnd().split(/\r?\n/);
        expect(rows).toHaveLength(10);
        for (const row of rows) {
            const [scenario] = row.split('|');
            const events: string[] = [];
            let checks = 0;
            const frame = {
                getSize: () => ({ width: 1024, height: 768 }),
                setVisible(value: boolean) {
                    events.push('visible=' + value);
                },
                dispose() {
                    events.push('dispose');
                }
            };
            const link = Object.assign(Object.create(Signlink.prototype), {
                supportsFullscreen() {
                    events.push('supports');
                    ++checks;
                    return scenario !== 'unsupported' && !(scenario === 'lost' && checks === 2);
                },
                getDisplayModes() {
                    events.push('list');
                    let data;
                    if (scenario === 'nullList') {
                        data = null;
                    } else if (scenario === 'wrongList') {
                        data = 'bad';
                    } else if (scenario === 'none') {
                        data = Int32Array.of(765, 503, 24, 144);
                    } else {
                        data = Int32Array.of(765, 503, 32, 144, 1024, 768, 16, 144, 1024, 768, 32, 60, 1024, 768, 24, 240, 1024, 768, 32, 120, 45, 68);
                    }
                    return { status: scenario === 'listFailed' ? 2 : 1, result: data };
                },
                enterFullscreen(...args: number[]) {
                    events.push('enter=' + args.join(','));
                    return { status: scenario === 'frameFailed' ? 2 : 1, result: scenario === 'nullFrame' ? null : scenario === 'wrongFrame' ? 'bad' : frame };
                },
                exitFullscreen(peer: object) {
                    expect(peer).toBe(frame);
                    events.push('exit');
                    return { status: 1 };
                }
            });
            let result: string;
            try {
                const mode = await GameShell['enterFullscreen'](768, 1024, link);
                result = mode === null ? 'null' : 'frame';
            } catch (error) {
                if (!(error instanceof WrappedException) || !(error.cause instanceof TypeError)) throw error;
                result = (error.cause.message.startsWith('ClassCastException') ? 'ClassCastException' : 'NullPointerException') + ' ' + error.context;
            }
            expect([scenario, events.join(' '), result].join('|')).toBe(row);
        }
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}, 30000);
