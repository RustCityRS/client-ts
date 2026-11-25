import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Js5 from '#/cache/Js5.js';
import Client from '#/client/Client.js';
import ClientMouseListener from '#/client/ClientMouseListener.js';
import HashTable from '#/datastruct/HashTable.js';
import SuperPacket from '#/io/SuperPacket.js';
import { ClientScript } from '#/script/ClientScript.js';
import ScriptRunner from '#/script/ScriptRunner.js';
import ComponentDrag from '#/ui/ComponentDrag.js';
import DelayedStateChange from '#/ui/DelayedStateChange.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import Minimenu from '#/ui/Minimenu.js';
import ServerActiveProperties from '#/ui/ServerActiveProperties.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { gamepackPath } from './reference.js';

function hookScript(base: number): ClientScript {
    const code = new ClientScript();
    code.intLocals = 6;
    code.opcodes = new Int32Array(15);
    code.intOperands = new Int32Array(15);
    for (let i = 0; i < 6; i++) {
        code.opcodes[2 * i] = 33;
        code.intOperands[2 * i] = i;
        code.opcodes[2 * i + 1] = 43;
        code.intOperands[2 * i + 1] = base + i;
    }
    code.opcodes[13] = 201;
    code.opcodes[14] = 21;
    return code;
}

test('native drag update preserves hook order, coordinates, state and partially written packets', async () => {
    const commands: number[][] = [];
    for (let mode = 0; mode < 10; mode++)
        for (const length of [0, 1, 4, 8, 12]) {
            for (const [button, action] of [
                [0, 0],
                [0, 1],
                [0, 2],
                [1, 0],
                [0, 3],
                [0, 4],
                [0, 5]
            ]) {
                const i = commands.length;
                const cycles = [0, 2, 2147483647, -1][i % 4],
                    mouseX = [-99, 65, 2147483647, 27][i % 4];
                const width = [63, -72, 2147483647, 0][i % 4];
                commands.push([mode, length, button, action, cycles, mouseX, Math.imul(i, -9392193), width]);
            }
        }
    const dir = mkdtempSync(join(tmpdir(), 'rs530-drag-loop-'));
    let expected: string[];
    try {
        const build = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'ui', 'DragLoopOracle.java')]);
        expect(build.exitCode, build.stderr.toString()).toBe(0);
        const stdin = Buffer.from(commands.map(row => row.join(' ')).join('\n') + '\n');
        const run = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'DragLoopOracle'], { stdin });
        expect(run.exitCode, run.stderr.toString()).toBe(0);
        expected = run.stdout.toString().trimEnd().split(/\r?\n/);
        const menu = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'DragLoopOracle', 'menu']);
        expect(menu.exitCode, menu.stderr.toString()).toBe(0);
        const port = Bun.spawnSync([process.execPath, join(import.meta.dir, 'ui', 'dragMenuTrace.ts')]);
        expect(port.exitCode, port.stderr.toString()).toBe(0);
        const menuRows = menu.stdout.toString().trimEnd().split(/\r?\n/),
            portRows = port.stdout.toString().trimEnd().split(/\r?\n/);
        expect(menuRows.length).toBe(640);
        expect(portRows.length).toBe(640);
        for (let i = 0; i < menuRows.length; i++) expect(portRows[i], String(i)).toBe(menuRows[i]);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
    const originalDrag = Object.getOwnPropertyDescriptors(ComponentDrag),
        originalMouse = Object.getOwnPropertyDescriptors(ClientMouseListener);
    const saved = [InterfaceList.dirty[0], InterfaceList.cycle, Minimenu.count] as const;
    const originalArchive = IfType.m_pInterfaces,
        originalComponents = IfType.m_list,
        originalLoaded = IfType.m_open;
    const originalOut = Client.out;
    const originalProperties = Client.serverActiveProperties;
    const nodes = Array.from({ length: 4 }, (_, i) => {
        const c = new IfType();
        c.id = 65536 + i;
        c.childId = 900 + i;
        c.parentId = 65537;
        c.drawCycle = 17;
        c.rootIndex = 0;
        return c;
    });
    const [source, parent, target, alternate] = nodes;
    const args = [-2147483647, -2147483646, -2147483645, -2147483643, -2147483642, -2147483641];
    source.onDrag = [9120, ...args];
    source.onDragComplete = alternate.onDragComplete = [9121, ...args];
    alternate.properties = new ServerActiveProperties(1 << 18, -1);
    const drag = hookScript(0),
        complete = hookScript(10),
        values = DelayedStateChange.varcs.subarray(0, 20);
    const oldVarcs = values.slice();
    const runner = new ScriptRunner(
        id => (id === 9120 ? drag : complete),
        error => {
            throw error;
        }
    );
    try {
        Client.serverActiveProperties = new HashTable<ServerActiveProperties>(512);
        IfType.m_list = [null, nodes];
        IfType.m_open = [false, true];
        InterfaceList.cycle = 17;
        Minimenu.count = 0;
        expect(expected.length).toBe(commands.length);
        for (const [row, command] of commands.entries()) {
            const [mode, bytes, button, action, cycles, mouseX, mouseY, width] = command;
            const out = (Client.out = new SuperPacket(bytes));
            requireNonNull(out.m_data).fill(0);
            if (mode !== 5) out.SetEnc(Int32Array.of(1, 3, 7, 11));
            let reads = 0;
            const unexpected = (): never => {
                throw Error('Unexpected group request');
            };
            IfType.m_pInterfaces = new Js5(
                {
                    index() {
                        if (++reads === 1) {
                            if (action === 1) ClientMouseListener.mouseButton = 1;
                            if (action === 2) ComponentDrag.component = alternate;
                            if (action === 3) ComponentDrag.started = false;
                        } else if (reads === 2) {
                            if (action === 4) ComponentDrag.target = null;
                            if (action === 5) ComponentDrag.component = null;
                        }
                        return null;
                    },
                    group: unexpected,
                    prefetchGroup: unexpected,
                    GetGroupLoadPercentage: unexpected
                },
                true,
                true
            );
            Object.assign(ComponentDrag, {
                component: mode === 1 ? null : source,
                parent: mode === 2 ? null : parent,
                target: mode === 3 ? null : target,
                visible: mode !== 6,
                parentVisible: true,
                started: mode !== 7,
                cycles,
                dragMouseX: 2,
                dragMouseY: 9,
                parentX: 17,
                parentY: 41,
                x: 23,
                y: -3
            });
            Object.assign(parent, { width, height: 73, scrollX: -13, scrollY: 808 });
            Object.assign(source, { width: 29, height: 33, dragDeadZone: 5, dragDeadTime: 2, rootIndex: mode === 9 ? 1000 : 0, properties: mode === 4 ? null : new ServerActiveProperties(mode === 8 ? 0 : 1 << 18, -1), dragParent: parent });
            ClientMouseListener.x = mouseX;
            ClientMouseListener.mouseY = mouseY;
            ClientMouseListener.mouseButton = button;
            InterfaceList.dirty[0] = false;
            values.fill(-127);
            let fault = 'ok';
            // The JAR blocks in the same li.a call. Alternating an immediate and
            // resumed browser hook exercises both paths against the same Java state.
            try {
                if (row % 2 === 0) {
                    await Client.LoopIf3Drag(runner);
                } else {
                    await Client.LoopIf3Drag({
                        run: async event => {
                            await Promise.resolve();
                            await runner.run(event);
                        }
                    });
                }
            } catch (e) {
                fault = e instanceof TypeError ? 'null' : e instanceof RangeError ? 'bounds' : String(e);
            }
            const state = [
                fault,
                ComponentDrag.component?.id ?? -1,
                ComponentDrag.target?.id ?? -1,
                ComponentDrag.cycles,
                ComponentDrag.started,
                InterfaceList.dirty[0],
                reads,
                out.m_pos,
                Buffer.from(requireNonNull(out.m_data)).toString('hex'),
                '[' + values.join(', ') + ']'
            ].join(' ');
            expect(state, command.join(' ')).toBe(expected[row]);
        }
    } finally {
        values.set(oldVarcs);
        Object.defineProperties(ComponentDrag, originalDrag);
        Object.defineProperties(ClientMouseListener, originalMouse);
        [InterfaceList.dirty[0], InterfaceList.cycle, Minimenu.count] = saved;
        IfType.m_pInterfaces = originalArchive;
        IfType.m_list = originalComponents;
        IfType.m_open = originalLoaded;
        Client.out = originalOut;
        Client.serverActiveProperties = originalProperties;
    }
}, 20000);
