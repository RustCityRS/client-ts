import { expect } from 'bun:test';
import Client from '#/client/Client.js';
import { ClientScript } from '#/script/ClientScript.js';
import ScriptRunner from '#/script/ScriptRunner.js';
import HookReq from '#/script/HookReq.js';
import JagString, { fromJsString } from '#/datastruct/JagString.js';
import type SuperPacket from '#/io/SuperPacket.js';
import { requireNonNull } from '#/util/JavaArray.js';

const enc = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64');
const word = (value: JagString | null) => (value === null ? '-' : enc(value.toBytes()));
const string = (value: string | null) => word(value === null ? null : fromJsString(value));
const array = (values: Int32Array | null) => (values === null ? 'null' : '[' + Array.from(values).join(', ') + ']');

// ChatOracle.run executes the same bytecode and snapshots the same eight slots, packet, and search state.
export function createChatScriptTrace(outgoing: SuperPacket) {
    let report = '',
        scriptId = 70000;
    const runner = new ScriptRunner(ClientScript.Get, error => {
        report = error.message;
    });
    return (op: number, ints: number[] = [], strs: (string | null)[] = [], out: 'i' | 's' | 'p' = 'p') => {
        const code = new ClientScript();
        const length = ints.length + strs.length + 2;
        code.opcodes = new Int32Array(length);
        code.intOperands = new Int32Array(length);
        code.stringOperands = new Array<JagString | null>(length).fill(null);
        let pc = 0;
        for (const value of ints) code.intOperands[pc++] = value;
        for (const value of strs) {
            code.opcodes[pc] = 3;
            code.stringOperands[pc++] = value === null ? null : fromJsString(value);
        }
        code.opcodes[pc++] = op;
        code.opcodes[pc] = 21;
        ClientScript.m_cache.Put(BigInt(++scriptId), code);
        const event = new HookReq();
        event.args = [scriptId];
        ScriptRunner.intStack.fill(-11017, 0, 8);
        ScriptRunner.stringStack.fill(null, 0, 8);
        report = '';
        outgoing.m_pos = 0;
        const pending = runner.ExecuteScript(event, 1000);
        expect(pending).toBeUndefined();
        const queued = enc(requireNonNull(outgoing.m_data).subarray(0, outgoing.m_pos));
        const result = out === 'i' ? ScriptRunner.intStack[0] : out === 's' ? word(ScriptRunner.stringStack[0]) : queued;
        const composed = ScriptRunner.activeQuickChatMessage;
        const searchHash = Client.searchResults?.reduce((hash, id) => (Math.imul(31, hash) + id) | 0, 1) ?? 0;
        const command = ['script', op, ints.join(','), strs.map(s => (s === '' ? '~' : string(s))).join(','), out].join(' ');
        const resultState = [
            report,
            result,
            queued,
            Array.from(ScriptRunner.intStack.subarray(0, 8)).join(','),
            ScriptRunner.stringStack.slice(0, 8).map(word).join(','),
            composed?.id ?? -1,
            array(composed?.values ?? null),
            Client.resultCount,
            Client.searchResultIndex,
            searchHash
        ].join('|');
        return { command, result: resultState };
    };
}
