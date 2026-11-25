import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import { ClientScript } from '#/script/ClientScript.js';
import HookReq from '#/script/HookReq.js';
import ScriptRunner from '#/script/ScriptRunner.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import { loginFixture } from './login-fixture.js';
import { gamepackPath } from './reference.js';
import { hdGamepackPath, joglPath } from './render/hd-reference.js';

const fields = ['viewportFovLow', 'zoomWidth2', 'viewportZoomMin', 'zoomWidth', 'fovClampMinWidth', 'viewportMaxZoom', 'zoomWidthMin', 'fovClampMaxHeight', 'viewportWidth', 'viewportHeight'] as const;
const aliases = ['fov', 'fov2', 'zoom', 'zoom2', 'min1', 'max1', 'min2', 'max2', 'width', 'height'];

for (const identity of ['sd', 'gl'] as const) {
    loginFixture(
        import.meta.url,
        identity + ' CS2 viewport opcodes preserve every observed field read, store and failure prefix',
        async () => {
            const dir = mkdtempSync(join(tmpdir(), 'rs530-viewport-order-'));
            try {
                const pack = identity === 'sd' ? gamepackPath : hdGamepackPath;
                const cp = [dir, pack, joglPath].join(delimiter);
                const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
                const run = (args: string[]): string => {
                    const result = Bun.spawnSync(args, { maxBuffer: 4 * 1024 * 1024 });
                    expect(result.exitCode, result.stderr.toString()).toBe(0);
                    return result.stdout.toString().trim();
                };
                run(['javac', asm, '-d', dir, join(import.meta.dir, 'ui/ViewportScriptOrderOracle.java')]);
                const oracle = ['java', asm, '-XX:-OmitStackTraceInFastThrow', '-Djava.awt.headless=true', '-cp', cp, 'ViewportScriptOrderOracle', identity];
                run([...oracle, pack, dir]);
                const rows = run(oracle).split(/\r?\n/);
                expect(rows.length).toBeGreaterThan(200);

                const values: number[] = [],
                    events: string[] = [];
                let stack = new Int32Array(0),
                    widget: IfType | null = null,
                    observing = false,
                    faultAt = 0,
                    failure = '-';
                const mark = (access: string) => {
                    if (!observing) return;
                    events.push(access);
                    if (events.length === faultAt) throw new Error('probe');
                };
                for (const [i, field] of fields.entries())
                    Object.defineProperty(Client, field, {
                        configurable: true,
                        get() {
                            mark('r:' + aliases[i]);
                            return values[i];
                        },
                        set(v: number) {
                            mark('w:' + aliases[i]);
                            values[i] = v;
                        }
                    });
                Object.defineProperty(InterfaceList, 'viewportComponent', {
                    configurable: true,
                    get() {
                        mark('r:component');
                        return widget;
                    }
                });
                Object.defineProperty(ScriptRunner, 'intStack', {
                    configurable: true,
                    get() {
                        mark('r:stack');
                        return stack;
                    }
                });
                const calc = Client.GdmCalcWindowSize;
                Client.GdmCalcWindowSize = (...args) => {
                    mark('calc');
                    observing = false;
                    try {
                        return calc(...args);
                    } finally {
                        observing = true;
                    }
                };
                const script = new ClientScript(),
                    hook = new HookReq();
                hook.args = [98100];
                const vm = new ScriptRunner(
                    () => script,
                    error => {
                        const cause = error.cause;
                        if (cause instanceof RangeError) failure = 'bounds:' + cause.message.split(' ').at(-1);
                        else if (cause instanceof TypeError) failure = 'null';
                        else if (cause instanceof Error && cause.message === 'probe') failure = 'probe';
                        else throw error;
                    }
                );
                for (const line of rows) {
                    const [input] = line.split('|');
                    const [op, mode, stop] = input.split(',').map(Number);
                    const args = mode === 0 ? [89, 9, 63, 5] : mode === 1 ? [-1, 32768, 65536, 65535] : [15, 74, 19, 51];
                    let count = op < 6202 ? 2 : op === 6202 ? 4 : 0;
                    if (mode === 3 && count > 0) count--;
                    stack = new Int32Array(op >= 6203 && mode >= 3 && mode <= 4 ? mode - 3 : 8).fill(-595);
                    for (let i = 0; i < fields.length; i++) values[i] = 39 + i;
                    widget = mode === 5 ? null : new IfType();
                    if (widget)
                        Object.defineProperties(widget, {
                            width: {
                                get() {
                                    mark('r:widgetW');
                                    return 637;
                                }
                            },
                            height: {
                                get() {
                                    mark('r:widgetH');
                                    return -9;
                                }
                            }
                        });
                    const codes = new Int32Array(count + 2);
                    codes[count] = op;
                    codes[count + 1] = 21;
                    script.opcodes = new Proxy(codes, {
                        get(target, key) {
                            if (key === String(count)) observing = true;
                            if (key === String(count + 1)) observing = false;
                            return Reflect.get(target, key);
                        }
                    });
                    script.intOperands = new Int32Array(count + 2);
                    script.intOperands.set(args.slice(0, count));
                    script.stringOperands = new Array(count + 2).fill(null);
                    observing = false;
                    faultAt = stop;
                    failure = '-';
                    events.length = 0;
                    vm.run(hook);
                    observing = false;
                    expect([input, events.join(','), failure, values.join(','), '[' + stack.join(', ') + ']'].join('|'), input).toBe(line);
                }
            } finally {
                rmSync(dir, { recursive: true, force: true });
            }
        },
        30000,
        identity
    );
}
