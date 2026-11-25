import { expect } from 'bun:test';
import { ClientScript } from '#/script/ClientScript.js';
import HookReq from '#/script/HookReq.js';
import ScriptRunner from '#/script/ScriptRunner.js';

// Run a single native query and verify its resulting integer stack size.
export function intQuery(opcode: number, values: number[], outputs = true): number {
    const code = new ClientScript(),
        event = new HookReq();
    code.opcodes = Int32Array.from([...values.map(() => 0), opcode, 0, 21]);
    code.intOperands = Int32Array.from([...values, 0, -9517713, 0]);
    code.stringOperands = new Array(code.opcodes.length).fill(null);
    event.args = [0];
    const vm = new ScriptRunner(
        () => code,
        error => {
            throw error;
        }
    );
    ScriptRunner.intStack[+outputs] = 0;
    expect(vm.run(event)).toBeUndefined();
    expect(ScriptRunner.intStack[+outputs]).toBe(-9517713);
    return ScriptRunner.intStack[0];
}
