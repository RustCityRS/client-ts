import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { hdGamepackPath as hd, joglPath as jogl } from './hd-reference.js';

const gen = 'gen(1,1,0,0)';
const image = 'image(3553,0,4,1,1,0,6408,5121,int,0,1,1,false,ffffffff)';
const enable = 'enable(3553)';
const disable = 'disable(3553)';
const bind = (texture: string) => 'bind(3553,' + texture + ')';
const envi = (channel: number, mode: number) => 'envi(8960,' + channel + ',' + mode + ')';

type Operation = 'boot' | 'context' | 'bind' | 'rgb' | 'alpha' | 'state';

// T0 and T1 stand for the first and second names allocated by the JOGL proxy.
// Snapshots record tf.z, tf.s, tf.i, tf.h both at each GL call and on return.
function script(first: number, second: number) {
    const input: string[] = [];
    const lines: string[] = [];
    let context = 'A';
    let state = '0,-1,0,0';
    const A = (cmd: string, at = state) => 'A.' + cmd + '@' + at;
    const B = (cmd: string, at = state) => 'B.' + cmd + '@' + at;
    function step(op: Operation, arg: number, result: string, after: string, calls: string[] = [], fault = '-', swap = '-') {
        input.push([op, arg, fault, swap].join(' '));
        lines.push([result, context, after, calls.join(';')].join('|'));
        state = after;
    }
    function setContext(value: number) {
        context = value === 0 ? '-' : value === 1 ? 'A' : 'B';
        step('context', value, 'ok', state);
    }
    step('state', 0, 'ok', state);
    step('boot', 0, 'fault', state, [A(gen)], 'glGenTextures');
    context = 'B';
    step('boot', 0, 'fault', 'T0,-1,0,0', [A(gen), B(bind('T0'), 'T0,-1,0,0')], 'glBindTexture', 'glGenTextures');
    setContext(0);
    step('boot', 0, 'null', state);
    setContext(1);
    context = 'B';
    step('boot', 0, 'upload', 'T1,-1,0,0', [A(gen), A(bind('T1'), 'T1,-1,0,0'), B(image, 'T1,-1,0,0')], '-', 'glBindTexture');
    step('boot', 0, 'fault', state, [B(gen), B(bind('T1')), B(image)], 'glTexImage2D');

    // The boot helper makes a direct bind and leaves the binding cache at -1.
    setContext(1);
    step('bind', -1, 'ok', state);
    step('bind', first, 'fault', state, [A(enable)], 'glEnable');
    context = 'B';
    step('bind', first, 'fault', state, [A(enable), B(bind('T0'))], 'glBindTexture', 'glEnable');
    step('bind', first, 'ok', 'T1,T0,0,0', [B(enable), B(bind('T0'))]);
    setContext(0);
    step('bind', first, 'ok', state);
    step('bind', second, 'null', state);
    setContext(2);
    step('bind', second, 'ok', 'T1,T1,0,0', [B(bind('T1'))]);
    step('bind', -1, 'fault', state, [B(disable)], 'glDisable');
    step('bind', -1, 'ok', 'T1,-1,0,0', [B(disable)]);
    step('bind', -1, 'ok', state);
    step('bind', 0, 'ok', 'T1,0,0,0', [B(enable), B(bind('0'))]);
    step('bind', -2, 'ok', 'T1,-2,0,0', [B(bind('-2'))]);

    // The alpha and RGB caches are independent. Unrecognized combine IDs
    // still update the selected cache, even when no GL context is installed.
    const rgbModes = [8448, 7681, 260, 34023, 34164, 34165];
    const alphaModes = [8448, 7681, 260];
    for (const channel of ['rgb', 'alpha'] as const) {
        const param = channel === 'rgb' ? 34161 : 34162;
        const modes = channel === 'rgb' ? rgbModes : alphaModes;
        const next = (value: number) => {
            const fields = state.split(',');
            fields[channel === 'rgb' ? 2 : 3] = String(value);
            return fields.join(',');
        };
        step(channel, 0, 'ok', state);
        for (let value = 1; value < modes.length; value++) {
            step(channel, value, 'fault', state, [B(envi(param, modes[value]))], 'glTexEnvi');
            step(channel, value, 'ok', next(value), [B(envi(param, modes[value]))]);
            step(channel, value, 'ok', state);
        }
        setContext(0);
        for (const unrecognized of [modes.length, -1, 2147483647]) step(channel, unrecognized, 'ok', next(unrecognized));
        step(channel, 0, 'null', state);
        setContext(2);
        step(channel, 0, 'ok', next(0), [B(envi(param, modes[0]))]);
    }
    return { input, lines };
}

test('original 530 HD JOGL white texture upload, binding and combine caches match their command reference', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rs530-hd-texture-'));
    try {
        const cp = hd + delimiter + jogl;
        const compiled = Bun.spawnSync(['javac', join(import.meta.dir, '../hd/GlRecorder.java'), '-cp', cp, '-d', dir, join(import.meta.dir, 'HdTextureCommandOracle.java')]);
        expect(compiled.exitCode, compiled.stderr.toString()).toBe(0);
        for (const [first, second] of [
            [731, 915],
            [54321, 2147483607]
        ]) {
            const { input, lines } = script(first, second);
            const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + cp, 'HdTextureCommandOracle', String(first), String(second)], {
                stdin: Buffer.from(input.join('\n') + '\n')
            });
            expect(java.exitCode, java.stderr.toString()).toBe(0);
            const actual = java.stdout.toString().trimEnd().split(/\r?\n/);
            expect(actual).toHaveLength(lines.length);
            for (const [i, expected] of lines.entries()) expect(actual[i], input[i]).toBe(expected);
        }
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}, 30000);
