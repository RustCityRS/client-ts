import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { ClientScript } from '#/script/ClientScript.js';
import HookReq from '#/script/HookReq.js';
import ScriptRunner from '#/script/ScriptRunner.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import { loginFixture } from '../login-fixture.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

enum Layout {
    Normal,
    Missing,
    Stale,
    BadRoot,
    StaleBadRoot
}
type Case = [opcode: number, active: number, layout: Layout, ...stack: number[]];
const explicit = 0x10002;
const cases: Case[] = [];
for (const [op, active] of [
    [1121, 0],
    [1121, 1],
    [1121, 2],
    [2121, 0],
    [2121, 1]
]) {
    const target = op === 2121 ? [explicit] : [];
    for (const [a, b] of [
        [32767, -32768],
        [32768, -32769],
        [65535, 65536],
        [-2147483648, 2147483647]
    ]) {
        cases.push([op, active, Layout.Normal, 83, a, b, ...target]); // leave 83 below the popped operands
    }
    for (const layout of [Layout.Missing, Layout.Stale, Layout.BadRoot, Layout.StaleBadRoot]) {
        cases.push([op, active, layout, 62891, -41551, ...target]);
    }
    for (const args of [[], [41]]) {
        cases.push([op, active, Layout.Normal, ...args, ...target], [op, active, Layout.Missing, ...args, ...target]);
    }
}
// h.a's five explicit setter groups lower their opcode before popping or resolving the widget id.
for (const opcode of [2000, 2100, 2121, 2200, 2300, 2400]) {
    cases.push([opcode, 0, Layout.Normal], [opcode, 0, Layout.Normal, 1, 2, 0x10003], [opcode, 1, Layout.Normal, 1, 2, -1]);
}

loginFixture(
    import.meta.url,
    'HD CS2 widget depth setters match the original 1121 and 2121 dispatch and write order',
    async () => {
        const temp = mkdtempSync(join(tmpdir(), 'hd-widget-depth-script-'));
        try {
            const cp = [temp, hdGamepackPath, joglPath].join(delimiter);
            const compile = Bun.spawnSync(['javac', '-cp', cp, '-d', temp, join(import.meta.dir, 'HdWidgetDepthScriptOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const java = Bun.spawnSync(['java', '-cp', cp, 'HdWidgetDepthScriptOracle'], {
                stdin: Buffer.from(cases.map(row => row.join(' ')).join('\n') + '\n')
            });
            expect(java.exitCode, java.stderr.toString()).toBe(0);
            const original = java.stdout.toString().trimEnd().split(/\r?\n/);
            expect(original.length).toBe(cases.length);
            expect(original[0]).toStartWith('-|32767:-32768,111:-111,112:-112|true,false,false|');
            expect(original[1]).toStartWith('-|-32768:32767,111:-111,112:-112|true,false,false|');
            expect(original[6]).toStartWith('1121/bounds|-2645:23985,111:-111,112:-112|false,false,false|');
            const script = new ClientScript();
            const request = new HookReq();
            let fault = '-';
            const runner = new ScriptRunner(
                () => script,
                error => {
                    const kind = error.cause instanceof TypeError ? 'null' : error.cause instanceof RangeError ? 'bounds' : 'other';
                    fault = error.message.split(' op:')[1] + '/' + kind;
                }
            );
            for (const [index, [opcode, active, layout, ...args]] of cases.entries()) {
                const widgets = [0, 1, 2].map(slot => {
                    const widget = new IfType();
                    widget.id = 0x10000 + slot;
                    widget.drawCycle = layout === Layout.Stale || layout === Layout.StaleBadRoot ? 72 : 73;
                    widget.rootIndex = layout >= Layout.BadRoot ? 100 : slot;
                    widget.Vc = 110 + slot;
                    widget.o = -110 - slot;
                    return widget;
                });
                ScriptRunner.activeComponent = layout === Layout.Missing ? null : widgets[0];
                ScriptRunner.activeComponent2 = layout === Layout.Missing ? null : widgets[1];
                IfType.m_list = [null, [widgets[0], widgets[1], layout === Layout.Missing ? null : widgets[2]]];
                IfType.m_open = [false, true];
                InterfaceList.cycle = 73;
                InterfaceList.dirty.fill(false);
                ScriptRunner.intStack.fill(-444);
                script.key = BigInt(110001 + index);
                request.args = [110001 + index];
                script.opcodes = Int32Array.from([...args.map(() => 0), opcode, 0, 21]);
                script.intOperands = Int32Array.from([...args, active, -4444444, 0]);
                script.stringOperands = new Array(script.opcodes.length).fill(null);
                fault = '-';
                expect(runner.ExecuteScript(request, 100)).toBeUndefined();
                const stackHash = ScriptRunner.intStack.reduce((hash, value) => (Math.imul(hash, 31) + value) | 0, 1);
                const actual = [fault, widgets.map(w => w.Vc + ':' + w.o).join(','), InterfaceList.dirty.slice(0, 3).join(','), stackHash].join('|');
                expect(actual, cases[index].join(' ')).toBe(original[index]);
            }
        } finally {
            rmSync(temp, { recursive: true, force: true });
        }
    },
    30000,
    'gl'
);
