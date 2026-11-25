import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import CinematicCamera from '#/client/CinematicCamera.js';
import OrbitCamera from '#/client/OrbitCamera.js';
import { ClientScript } from '#/script/ClientScript.js';
import HookReq from '#/script/HookReq.js';
import ScriptRunner from '#/script/ScriptRunner.js';
import { loginFixture } from './login-fixture.js';
import { gamepackPath } from './reference.js';
import { hdGamepackPath, joglPath } from './render/hd-reference.js';

const fields: [object, string, string, string][] = [
    [Client, 'mapBuildBaseX', 'hk.e', 'se.a'],
    [Client, 'mapBuildBaseZ', 'vj.t', 'lc.n'],
    [CinematicCamera, 'positionPath', 'qa.P', 'me.k'],
    [CinematicCamera, 'lookPath', 'mf.q', 'eb.t'],
    [CinematicCamera, 'positionSegment', 'ck.I', 'k.i'],
    [CinematicCamera, 'lookSegment', 'sc.W', 'g.d'],
    [CinematicCamera, 'progress', 'se.d', 't.z'],
    [CinematicCamera, 'startRate', 'ga.A', 'sh.c'],
    [CinematicCamera, 'endRate', 'mg.e', 'j.K'],
    [OrbitCamera, 'mode', 'cl.e', 'sg.o'],
    [OrbitCamera, 'followPitch', 'pd.s', 'fl.s'],
    [OrbitCamera, 'followYaw', 'df.B', 'eg.d'],
    [OrbitCamera, 'pitch', 'bd.X', 'tg.b'],
    [OrbitCamera, 'yaw', 'qj.w', 'ol.ib']
];

function vectors(): number[][] {
    const rows: number[][] = [];
    const pos = (2659 << 14) | 3299;
    const operands = [[pos, 137, 43, -51], [pos, 137, 43, -51], [0, 1, 41, 95, 1, 0], [], [345, -987], [], []];
    for (let op = 5500; op <= 5506; op++) {
        const values = operands[op - 5500];
        // Cut before each observed field access, completed stack read, write or helper
        // call. Counts beyond the last observation also exercise successful completion.
        for (let cut = 0; cut <= 32; cut++) rows.push([op, cut, 8, 2, ...values]);
        for (let n = 0; n < values.length; n++) rows.push([op, 0, 8, 2, ...values.slice(0, n)]);
    }
    for (const pos of [-2147483648, -1, 0, 2147483647]) rows.push([5500, 0, 8, 2, pos, 0, -1, 123], [5501, 0, 8, 2, pos, 0, -1, 123]);
    for (const mode of [0, 1, 3]) rows.push([5504, 0, 8, mode, -75, 752]);
    for (const op of [5505, 5506])
        for (const n of [7, 8]) {
            rows.push([op, 0, 8, 2, ...Array.from({ length: n }, (_, i) => i + 1)]);
        }
    for (const layout of [0, 2, 3, 8])
        for (const path of [-1, 0, 1, 2])
            for (const segment of [-1, 0, 1, 2, 2147483647]) {
                rows.push([5502, 0, layout, 2, path, segment, 41, 95, 1, 0], [5502, 0, layout, 2, 1, 0, 41, 95, path, segment]);
            }
    return rows;
}

for (const identity of ['sd', 'gl'] as const) {
    loginFixture(
        import.meta.url,
        identity + ' CS2 camera opcodes match ordered original accesses and partial faults',
        async () => {
            const gl = identity === 'gl',
                jar = gl ? hdGamepackPath : gamepackPath;
            const dir = mkdtempSync(join(tmpdir(), '530-camera-opcode-'));
            try {
                const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
                const cp = [dir, jar, ...(gl ? [joglPath] : [])].join(delimiter);
                const run = (cmd: string[], input?: Buffer) => {
                    const result = Bun.spawnSync(cmd, { stdin: input, timeout: 30000, maxBuffer: 4 * 1024 * 1024 });
                    expect(result.exitCode, result.stderr.toString()).toBe(0);
                    return result.stdout.toString().trimEnd().split(/\r?\n/);
                };
                run(['javac', asm, '-d', dir, join(import.meta.dir, 'game/CameraOpcodeOrderOracle.java')]);
                const java = ['java', asm, '-Djava.awt.headless=true', '-cp', cp, 'CameraOpcodeOrderOracle', identity];
                run([...java, jar, dir]);
                const rows = vectors();
                const expected = run(java, Buffer.from(rows.map(r => r.join(' ')).join('\n') + '\n'));
                expect(expected.length).toBe(rows.length);

                let active = false,
                    cut = 0,
                    trace: string[] = [],
                    scalars: number[] = [];
                function observe(name: string): void {
                    if (!active) return;
                    trace.push(name);
                    if (cut === trace.length) throw new Error('cut');
                }
                for (const [i, [owner, key, sd, hd]] of fields.entries()) {
                    const name = gl ? hd : sd;
                    Object.defineProperty(owner, key, {
                        get() {
                            observe('r' + name);
                            return scalars[i];
                        },
                        set(value: number) {
                            observe('w' + name);
                            scalars[i] = value;
                        }
                    });
                }
                const stack = new Int32Array(8);
                const watched = new Proxy(stack, {
                    get(array, key) {
                        const value = Reflect.get(array, key, array);
                        if (typeof key === 'string' && /^\d+$/.test(key)) observe('i' + key);
                        return value;
                    },
                    set(array, key, value) {
                        observe('o' + String(key) + '=' + value);
                        return Reflect.set(array, key, value, array);
                    }
                });
                Object.defineProperty(ScriptRunner, 'intStack', {
                    get() {
                        observe(gl ? 'ruj.t' : 'rtg.B');
                        return watched;
                    }
                });
                let paths: typeof CinematicCamera.paths = [];
                Object.defineProperty(CinematicCamera, 'paths', {
                    get() {
                        observe(gl ? 'rid.d' : 'rkg.l');
                        return paths;
                    }
                });
                CinematicCamera.MoveTo = (f, x, h, s, z, snap) => observe('move=' + [f, x, h, s, z, +snap].join(','));
                CinematicCamera.LookAt = (s, h, x, f, z) => observe('look=' + [s, h, x, f, z].join(','));
                OrbitCamera.reset = () => observe('reset');
                OrbitCamera.clamp = () => observe('clamp');

                for (const [index, [op, at, layout, mode, ...values]] of rows.entries()) {
                    cut = at;
                    trace = [];
                    active = false;
                    scalars = fields.map((_, i) => (i === 0 ? 2608 : i === 1 ? 3248 : i === 9 ? mode : 511 + i));
                    const path = (len: number) => Array.from({ length: len }, () => new Int32Array(4));
                    paths = [layout === 0 ? null : path(layout), path(6)];
                    stack.fill(-691);
                    const code = new ClientScript(),
                        event = new HookReq();
                    const ops = Int32Array.from([...values.map(() => 0), op, 21]);
                    code.opcodes = new Proxy(ops, {
                        get(array, key) {
                            const value = Reflect.get(array, key, array);
                            if (typeof key === 'string' && /^\d+$/.test(key)) active = value === op;
                            return value;
                        }
                    });
                    code.intOperands = Int32Array.from([...values, 0, 0]);
                    code.stringOperands = new Array(ops.length).fill(null);
                    event.args = [855000 + index];
                    let fault = 'ok';
                    new ScriptRunner(
                        () => code,
                        error => {
                            const e = error.cause;
                            fault = e instanceof RangeError ? 'bounds' : e instanceof TypeError ? 'null' : e instanceof Error && e.message === 'cut' ? 'cut' : 'RuntimeException';
                        }
                    ).ExecuteScript(event, 200);
                    active = false;
                    const state = [fault, trace.join(' '), '[' + scalars.join(', ') + ']', '[' + stack.join(', ') + ']'].join(';');
                    expect(state, rows[index].join(' ')).toBe(expected[index]);
                }
            } finally {
                rmSync(dir, { recursive: true, force: true });
            }
        },
        45000,
        identity
    );
}
