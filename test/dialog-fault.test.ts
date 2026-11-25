import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import Client from '#/client/Client.js';
import ClientKeyboardListener from '#/client/ClientKeyboardListener.js';
import { fromJsString } from '#/datastruct/JagString.js';
import ChatHistory from '#/game/ChatHistory.js';
import SuperPacket from '#/io/SuperPacket.js';
import { ClientScript } from '#/script/ClientScript.js';
import HookReq from '#/script/HookReq.js';
import ScriptRunner from '#/script/ScriptRunner.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { loginFixture } from './login-fixture.js';
import { gamepackPath } from './reference.js';

type Vector = [opcode: number, ints: number, text: number, capacity: number, pos: number, viewport: number];
const values = [65537, -32768, 45199, 2147483647];
const fields = ['viewportFovLow', 'zoomWidth2', 'viewportZoomMin', 'zoomWidth', 'fovClampMinWidth', 'viewportMaxZoom', 'zoomWidthMin', 'fovClampMaxHeight', 'viewportWidth', 'viewportHeight'] as const;

function inputs(): Vector[] {
    const vectors: Vector[] = [];
    for (const op of [3100, 3101, 3104, 3105, 3106, 3107, 3110]) {
        for (const n of [0, 1, 2]) {
            for (const str of [-1, 0, 1]) vectors.push([op, n, str, 12, 1, 0]);
        }
        for (const capacity of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
            for (const pos of [-1, 0, 1, capacity]) vectors.push([op, 2, 1, capacity, pos, 1]);
        }
    }
    for (const op of [5100, 5101, 5102, 6200, 6201, 6202, 6203, 6204, 6205]) {
        for (const n of [0, 1, 2, 3, 4, 998, 999, 1000]) {
            for (const viewport of [0, 1]) vectors.push([op, n, -1, 4, 0, viewport]);
        }
    }
    return vectors;
}

loginFixture(
    import.meta.url,
    'gh dialog and viewport fault paths retain the original packet prefix, ISAAC state, stack and viewport fields',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-dialog-fault-')),
            vectors = inputs();
        let expected: string[];
        try {
            const compile = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, resolve(import.meta.dir, 'ui/DialogFaultOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const jvm = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'DialogFaultOracle'], { stdin: Buffer.from(vectors.map(v => v.join(' ')).join('\n') + '\n') });
            expect(jvm.exitCode, jvm.stderr.toString()).toBe(0);
            expected = jvm.stdout.toString().trimEnd().split(/\r?\n/);
            expect(expected.length).toBe(vectors.length);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
        const script = new ClientScript(),
            event = new HookReq();
        let fault = '-';
        const vm = new ScriptRunner(
            () => script,
            error => {
                const cause = error.cause;
                fault = error.message.split(' op:')[1] + '/' + (cause instanceof RangeError ? 'bounds' : cause instanceof TypeError ? 'null' : 'runtime');
            }
        );
        const packet = (Client.out = new SuperPacket(0));
        const marker = fromJsString('returned');
        for (const [i, [op, n, str, capacity, pos, viewport]] of vectors.entries()) {
            packet.m_data = new Uint8Array(capacity).fill(0xa5);
            packet.m_pos = pos;
            packet.SetEnc(Int32Array.of(1, 22, 4, 8));
            fields.forEach((f, j) => {
                Client[f] = j < 8 ? 31 + j : 32 + j;
            });
            InterfaceList.viewportComponent = null;
            if (viewport) {
                const c = (InterfaceList.viewportComponent = new IfType());
                c.width = 381;
                c.height = -7;
            }
            ClientKeyboardListener.pressed[86] = true;
            ClientKeyboardListener.pressed[81] = true;
            ClientKeyboardListener.pressed[82] = false;
            ScriptRunner.intStack.fill(-901);
            ScriptRunner.stringStack.fill(null);
            ChatHistory.text[0] = null;
            fault = '-';
            const size = n + (str >= 0 ? 1 : 0) + 4;
            script.opcodes = new Int32Array(size);
            script.intOperands = new Int32Array(size);
            script.stringOperands = new Array(size).fill(null);
            for (let j = 0; j < n; j++) script.intOperands[j] = values[j % 4];
            let pc = n;
            if (str >= 0) {
                script.opcodes[pc] = 3;
                if (str === 1) script.stringOperands[pc] = fromJsString('123456');
                pc++;
            }
            script.opcodes[pc++] = op;
            script.opcodes[pc] = 3;
            script.stringOperands[pc++] = marker;
            script.opcodes[pc++] = 3100;
            script.opcodes[pc] = 21;
            script.key = BigInt(45000 + i);
            event.args = [45000 + i];
            expect(vm.run(event)).toBeUndefined();
            const bytes = Buffer.from(packet.m_data).toString('hex'),
                cursor = packet.m_pos;
            packet.m_data = new Uint8Array(1);
            packet.m_pos = 0;
            packet.pHead(251);
            const hash = ScriptRunner.intStack.reduce((acc, num) => (Math.imul(acc, 31) + num) | 0, 1);
            expect([fault, ChatHistory.text[0] === marker, cursor, bytes, requireNonNull(packet.m_data)[0], hash, ...fields.map(f => Client[f])].join(' '), vectors[i].join(' ')).toBe(expected[i]);
        }
    },
    20000
);
