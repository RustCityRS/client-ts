import Client from '#/client/Client.js';
import ObjType from '#/config/ObjType.js';
import ClientInvCache from '#/client/ClientInvCache.js';
import DelayedStateChange from '#/ui/DelayedStateChange.js';
import { expect, test } from 'bun:test';

import { ClientScript } from '#/script/ClientScript.js';
import { scriptArchive } from './script-archive.js';
import { fromJsString, toJsString } from '#/datastruct/JagString.js';
import HashTable from '#/datastruct/HashTable.js';
import IntNode from '#/datastruct/IntNode.js';
import HookReq from '#/script/HookReq.js';
import { requireNonNull } from '#/util/JavaArray.js';
import ScriptRunner from '#/script/ScriptRunner.js';

function event(id: number): HookReq {
    const request = new HookReq();
    request.args = [id];
    return request;
}

function script(instructions: [number, number | string][], locals = 0): ClientScript {
    return Object.assign(new ClientScript(), {
        name: null,
        opcodes: Int32Array.from(instructions, ([op]) => op),
        intOperands: Int32Array.from(instructions, ([, value]) => (typeof value === 'number' ? value : 0)),
        stringOperands: instructions.map(([, value]) => (typeof value === 'string' ? fromJsString(value) : null)),
        intLocals: locals,
        stringLocals: locals,
        intArgs: 0,
        stringArgs: 0
    });
}

test('530 script 1 returns the inventory total only for eligible items', () => {
    const bytes = Buffer.from('AAAhAAAAARBvAAAAAAAAAQAIAAAAAQAGAAAABgzwAAAAAAAAAAAIAAAAAQAGAAAAAgAAAAAAAAAVAAAhAAAAAAAhAAAAAQznAAAVAAAAAAAAAAAVAAAAABEAAgAAAAIAAAAAAQ==', 'base64');
    using _archive = scriptArchive(id => (id === 1 ? bytes : null));
    const stock = ClientScript.Get(1);
    const caller = script([
        [0, 93],
        [0, 995],
        [40, 1],
        [43, 0],
        [21, 0]
    ]);
    const previousItem = ObjType.types.Find(995n);
    const item = new ObjType();
    item.members = true;
    ObjType.types.Put(995n, item);
    const oldMembers = Client.members,
        oldVarc = DelayedStateChange.varcs[0];
    const oldInv = ClientInvCache.m_invList;
    const runner = new ScriptRunner(
        id => (id === 1 ? stock : caller),
        error => {
            throw error;
        }
    );
    try {
        ClientInvCache.DeleteAll();
        ClientInvCache.Set(995, 93, 1234, 0);
        Client.members = false;
        runner.run(event(0));
        expect(DelayedStateChange.varcs[0]).toBe(0);
        Client.members = true;
        runner.run(event(0));
        expect(DelayedStateChange.varcs[0]).toBe(1234);
        item.members = false;
        Client.members = false;
        runner.run(event(0));
        expect(DelayedStateChange.varcs[0]).toBe(1234);
    } finally {
        Client.members = oldMembers;
        DelayedStateChange.varcs[0] = oldVarc;
        ClientInvCache.m_invList = oldInv;
        ObjType.types.Remove(995n);
        if (previousItem !== null) ObjType.types.Put(995n, previousItem);
    }
});

test('event substitution, persistent script arrays, SWITCH and the instruction limit', () => {
    const entry = script(
        [
            [0, 1],
            [44, 105],
            [0, 0],
            [33, 0],
            [46, 0],
            [35, 0],
            [3, '!'],
            [37, 2],
            [48, 1],
            [21, 0]
        ],
        1
    );
    const useArray = script([
        [0, 0],
        [45, 0],
        [51, 0],
        [0, -1],
        [43, 0],
        [21, 0],
        [0, 1],
        [43, 0],
        [21, 0]
    ]);
    useArray.switches = [new HashTable<IntNode>(1)];
    requireNonNull(useArray.switches[0]).put(new IntNode(3), 105n);
    const loop = script([[6, -1]]);
    const oldString = DelayedStateChange.varcStrings[1],
        oldVarc = DelayedStateChange.varcs[0];
    const errors: Error[] = [];
    const runner = new ScriptRunner(
        id => [entry, useArray, loop][id],
        e => errors.push(e)
    );
    const request = event(0);
    request.args = [0, -2147483647, fromJsString('event_opbase')];
    request.mouseX = 105;
    request.opBase = fromJsString('Login');
    try {
        runner.run(request);
        runner.run(event(1));
        runner.ExecuteScript(event(2), 3);
        expect(toJsString(requireNonNull(DelayedStateChange.varcStrings[1]))).toBe('Login!');
        expect(DelayedStateChange.varcs[0]).toBe(1);
        expect(errors).toHaveLength(1);
        expect((errors[0].cause as Error).message).toBe('slow');
    } finally {
        DelayedStateChange.varcStrings[1] = oldString;
        DelayedStateChange.varcs[0] = oldVarc;
    }
});

test('arithmetic and string results from gh.a in the SD gamepack', () => {
    const arithmetic: [number, number][] = [
        [4000, -2147483642],
        [4001, 2147483624],
        [4002, 2147483513],
        [4003, 143165575],
        [4006, 2827057],
        [4007, -1825361112],
        [4008, 2147483639],
        [4009, 2147450871],
        [4010, 1],
        [4011, 14],
        [4012, 2147483647],
        [4013, 4],
        [4014, 7],
        [4015, 2147483647],
        [4016, 15],
        [4017, 2147483639],
        [4018, 1263225661]
    ];
    for (const [op, result] of arithmetic) {
        const inputs = op === 4006 ? [18, 100001, 4, 502, 99999] : op === 4018 ? [2147483639, -17, 2147483621] : [2147483639, 15];
        const code = script([...inputs.map((x): [number, number] => [0, x]), [op, 0], [21, 0]]);
        new ScriptRunner(
            () => code,
            e => {
                throw e;
            }
        ).run(event(0));
        expect(ScriptRunner.intStack[0]).toBe(result);
    }
    for (const [instructions, result] of [
        [
            [
                [0, -2147483648],
                [0, 1],
                [4124, 0],
                [21, 0]
            ],
            '-2,147,483,648'
        ],
        [
            [
                [3, 'a>b<c<x>a>x'],
                [4119, 0],
                [21, 0]
            ],
            'abax'
        ],
        [
            [
                [3, 'AE'],
                [3, '\xc6'],
                [4107, 0],
                [21, 0]
            ],
            0
        ]
    ] as [[number, number | string][], number | string][]) {
        const code = script(instructions);
        new ScriptRunner(
            () => code,
            e => {
                throw e;
            }
        ).run(event(0));
        expect(typeof result === 'number' ? ScriptRunner.intStack[0] : toJsString(requireNonNull(ScriptRunner.stringStack[0]))).toBe(result);
    }
});
