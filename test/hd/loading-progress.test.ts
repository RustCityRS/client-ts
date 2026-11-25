import { expect } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import GameShell from '#/client/GameShell.js';
import { toJsString } from '#/datastruct/JagString.js';
import GlRenderer from '#/gl/GlRenderer.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { JavaError } from '#/util/JavaException.js';
import WrappedException from '#/util/WrappedException.js';
import { loginFixture } from '../login-fixture.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

const fields = { sceneState: 't.y', mapLoadingTotal: 'sj.p', mapFilesMissing: 'nm.U', maxLocModelsMissing: 'cn.B', locsNotReadyCount: 'wc.g' } as const;
type Field = keyof typeof fields;
type Row = [number, number, number, number, number];
class Displayed extends JavaError {}

function exercise(app: Client, [state, phase, peak, missing, mutation]: Row): string {
    const trace: string[] = [];
    const values = { sceneState: phase, mapLoadingTotal: peak, mapFilesMissing: missing, maxLocModelsMissing: peak, locsNotReadyCount: missing };
    function observe(event: string): void {
        trace.push(event);
        if (trace.length === mutation) {
            values.mapLoadingTotal = 7;
            values.mapFilesMissing = -8;
            values.maxLocModelsMissing = 9;
            values.locsNotReadyCount = -2;
        }
    }
    const restore: (() => void)[] = [];
    for (const key of Object.keys(fields) as Field[]) {
        const original = requireNonNull(Object.getOwnPropertyDescriptor(Client, key));
        restore.push(() => Object.defineProperty(Client, key, original));
        Object.defineProperty(Client, key, {
            configurable: true,
            get() {
                const value = values[key];
                observe('R' + fields[key]);
                return value;
            },
            set(value: number) {
                values[key] = value;
                observe('W' + fields[key]);
            }
        });
    }
    Client.gameState = state;
    Client.MessageBox = text => {
        trace.push(toJsString(requireNonNull(text)));
        throw new Displayed();
    };
    try {
        app['MainRedraw']();
        throw Error('MessageBox was not reached');
    } catch (error) {
        if (error instanceof WrappedException && error.cause instanceof RangeError && error.cause.message === '/ by zero') trace.push(error.context + '/zero');
        else if (!(error instanceof Displayed)) throw error;
    } finally {
        for (const reset of restore) reset();
    }
    return trace.join('|') + '|' + [values.mapLoadingTotal, values.mapFilesMissing, values.maxLocModelsMissing, values.locsNotReadyCount].join(',');
}

loginFixture(
    import.meta.url,
    'HD redraw preserves the two loading phases, progress operand order and signed division',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-hd-loading-'));
        try {
            const instrumented = join(dir, 'observed');
            mkdirSync(instrumented);
            const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
            const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
            execFileSync('javac', [asm, '-cp', cp, '-d', dir, join(import.meta.dir, 'HdLoadingProgressOracle.java')]);
            execFileSync('java', [asm, '-cp', cp, 'HdLoadingProgressOracle', hdGamepackPath, instrumented]);
            const rows: Row[] = [];
            for (const state of [25, 28])
                for (const phase of [0, 1, 2])
                    for (const [peak, missing] of [
                        [13, 3],
                        [2, 7],
                        [0, 0],
                        [2147483647, -2147483648]
                    ])
                        for (let mutation = 0; mutation <= 9; mutation++) rows.push([state, phase, peak, missing, mutation]);
            const java = execFileSync('java', [asm, '-Djava.awt.headless=true', '-cp', instrumented + delimiter + cp, 'HdLoadingProgressOracle'], { input: rows.map(row => row.join(' ')).join('\n') + '\n', encoding: 'utf8' })
                .trimEnd()
                .split(/\r?\n/);
            expect(java).toHaveLength(rows.length);
            const app = new Client();
            GameShell.fullScreenFrame = {
                getSize() {
                    return { width: 765, height: 503 };
                },
                getInsets() {
                    return { left: 0, top: 0, right: 0, bottom: 0 };
                }
            };
            GameShell.m_focus = true;
            GameShell.fullRedraw = false;
            GlRenderer.active = false;
            for (const [i, row] of rows.entries()) expect(exercise(app, row), row.join(' ')).toBe(java[i]);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    45000,
    'gl'
);
