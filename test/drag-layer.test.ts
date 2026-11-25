import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Js5 from '#/cache/Js5.js';
import Client from '#/client/Client.js';
import HashTable from '#/datastruct/HashTable.js';
import ComponentDrag from '#/ui/ComponentDrag.js';
import IfType from '#/ui/IfType.js';
import Minimenu from '#/ui/Minimenu.js';
import WrappedException from '#/util/WrappedException.js';
import ServerActiveProperties from '#/ui/ServerActiveProperties.js';
import { gamepackPath } from './reference.js';

test('drag layer selection matches the 530 JAR through parent walks and interruptions between the two lookups', () => {
    const commands: number[][] = [];
    for (let depth = 0; depth < 8; depth++)
        for (let mode = 0; mode < 6; mode++) {
            for (const flags of [0, 1, 2, 3, 4, 5, 6, 7, 10, 19, 30]) {
                for (const op of [0, 1, 2, 3]) {
                    const row = commands.length;
                    commands.push([op, depth, mode, flags, 0, Math.imul(row, 1433421), Math.imul(row, -831189)]);
                }
            }
        }
    for (const provider of [1, 2, 3])
        for (const flags of [0, 2, 3, 6, 18, 10]) {
            for (const op of [0, 1, 2]) commands.push([op, 2, 4, flags, provider, -2147483648, 2147483647]);
        }
    const dir = mkdtempSync(join(tmpdir(), 'rs530-drag-layer-'));
    let expected: string[];
    try {
        const build = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'ui', 'DragLayerOracle.java')]);
        expect(build.exitCode, build.stderr.toString()).toBe(0);
        const stdin = Buffer.from(commands.map(row => row.join(' ')).join('\n') + '\n');
        const run = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'DragLayerOracle'], { stdin });
        expect(run.exitCode, run.stderr.toString()).toBe(0);
        expected = run.stdout.toString().trimEnd().split(/\r?\n/);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }

    const previousDrag = Object.getOwnPropertyDescriptors(ComponentDrag);
    const previousComponents = IfType.m_list,
        previousLoaded = IfType.m_open,
        previousArchive = IfType.m_pInterfaces;
    const previousActive = Client.serverActiveProperties,
        previousMenu = Minimenu.isOpen;
    const group = 1 << 16;
    try {
        expect(expected.length).toBe(commands.length);
        for (const [row, command] of commands.entries()) {
            const [op, depth, mode, flags, provider, x, y] = command;
            const nodes = Array.from({ length: 9 }, (_, i) => {
                const c = new IfType();
                c.id = group + i;
                c.parentId = group + i + 1;
                return c;
            });
            const c = nodes[0];
            c.childId = (flags & 1) === 0 ? -1 : 2;
            c.properties = new ServerActiveProperties(depth << 18, -1);
            c.dragParent = (flags & 2) === 0 ? null : nodes[8];
            Client.serverActiveProperties = new HashTable(8);
            if ((flags & 4) !== 0) Client.serverActiveProperties.put(new ServerActiveProperties(((depth + 3) & 7) << 18, 42), (BigInt(c.id) << 32n) + BigInt(c.childId));
            const children: (IfType | null)[] = nodes.slice();
            IfType.m_list = [null, children];
            IfType.m_open = [false, true];
            if (mode === 1) children[3] = null;
            if (mode === 2) nodes[2].parentId = 2 << 16;
            if (mode === 3) nodes[1].parentId = nodes[1].id;
            if (mode === 4) c.parentId = 0;
            if (mode === 5) Reflect.set(c, 'properties', null);
            let requests = 0;
            const unexpected = (): never => {
                throw new Error('Unexpected provider call');
            };
            IfType.m_pInterfaces = new Js5(
                {
                    index() {
                        requests++;
                        if ((provider === 1 && requests === 1) || (provider === 2 && requests === 2)) throw new Error('index');
                        if (provider === 3 && requests === 2) c.dragParent = nodes[7];
                        return null;
                    },
                    group: unexpected,
                    prefetchGroup: unexpected,
                    GetGroupLoadPercentage: unexpected
                },
                true,
                true
            );
            Minimenu.isOpen = (flags & 16) !== 0;
            ComponentDrag.component = (flags & 8) === 0 ? null : nodes[3];
            Object.assign(ComponentDrag, { parent: nodes[4], dragMouseX: -17, dragMouseY: 509, cycles: 78, started: true });
            let result: IfType | null = null,
                fault = 'ok';
            try {
                if (op === 0) result = Client.ServerDraggable(c);
                else if (op === 1) result = Client.GetDragLayer(c);
                else Client.DragTryPickup(x, op === 3 ? null : c, y);
            } catch (caught) {
                let e = caught;
                while (e instanceof WrappedException) e = e.cause;
                fault = e instanceof TypeError ? 'null' : e instanceof RangeError ? 'bounds' : e instanceof Error && e.message === 'index' ? 'index' : 'other';
            }
            const index = (target: IfType | null) => (target === null ? -1 : nodes.indexOf(target));
            expect([fault, index(result), index(ComponentDrag.component), index(ComponentDrag.parent), ComponentDrag.dragMouseX, ComponentDrag.dragMouseY, ComponentDrag.cycles, ComponentDrag.started, requests].join(' '), command.join(' ')).toBe(
                expected[row]
            );
        }
    } finally {
        Object.defineProperties(ComponentDrag, previousDrag);
        IfType.m_list = previousComponents;
        IfType.m_open = previousLoaded;
        IfType.m_pInterfaces = previousArchive;
        Client.serverActiveProperties = previousActive;
        Minimenu.isOpen = previousMenu;
    }
}, 20000);
