import { expect, mock } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import ClientKeyboardListener from '#/client/ClientKeyboardListener.js';
import ClientMouseListener from '#/client/ClientMouseListener.js';
import NpcType from '#/config/NpcType.js';
import ObjType from '#/config/ObjType.js';
import ClientNpc from '#/dash3d/ClientNpc.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import CollisionMap from '#/dash3d/CollisionMap.js';
import world from '#/dash3d/world.js';
import { fromJsString } from '#/datastruct/JagString.js';
import HookReq from '#/script/HookReq.js';
import ScriptRunner from '#/script/ScriptRunner.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import Minimenu from '#/ui/Minimenu.js';
import ServerActiveProperties from '#/ui/ServerActiveProperties.js';
import { loginFixture } from '../login-fixture.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

loginFixture(
    import.meta.url,
    'HD menu dispatch matches the original packets, clicks and selections for every action',
    async () => {
        const component = (149 << 16) | 2;
        const rows: number[][] = [];
        for (const priority of [0, 2000]) {
            // Five object inventory options (58 = Drop) and five IF1 component options.
            for (const action of [47, 5, 43, 35, 58, 25, 23, 48, 7, 13]) {
                for (const slot of [0, 21]) rows.push([action + priority, slot, component, 592, 0, 0]);
            }
            for (const action of [8, 51, 59]) rows.push([action + priority, 0, component, 0, 0, 0]);
            // Attack lives in the second NPC option for the imp. Exercise missing targets too.
            for (const action of [17, 16, 4, 19, 2, 30, 6, 31, 29, 10, 44, 37, 57, 1, 15, 26, 45, 1007]) {
                for (const present of [0, 1])
                    for (const control of [0, 1]) {
                        rows.push([action + priority, 44, 44, 407, present, control]);
                    }
            }
            for (const action of [60, 11, 36]) {
                rows.push([action + priority, 217, 143, 0, 0, 0], [action + priority, 44, 46, 1, 0, 0]);
            }
            for (const action of [12, 22, 40, 3, 1006]) rows.push([action + priority, 1, component, 592, 0, 0]);
            for (const action of [28, 32, 41]) rows.push([action + priority, -1, component, 0, 0, 0]);
            // Selecting a new target fires leave then enter. Selecting an object only leaves the old target.
            rows.push([32 + priority, -1, component, 0, 0, 0, 0, 7], [22 + priority, 1, component, 592, 0, 0, 0, 3], [1005 + priority, 1, component, 592, 0, 0, 0, 7]);
            for (const action of [9, 1003]) {
                for (let op = 1; op <= 10; op++) rows.push([action + priority, -1, component, op, 0, 0]);
            }
            for (const action of [20, 24, 34, 18, 33, 21, 39, 1002]) rows.push([action + priority, 44, 46, 592, 0, 0]);
            for (const action of [46, 50, 38, 42, 49, 1001, 14]) {
                const key = (2 << 29) | (1 << 20) | (2 << 14) | (46 << 7) | 44;
                rows.push([action + priority, 44, 46, key, 0, 0, 4321]);
            }
            rows.push([1004 + priority, 44, 46, 4321, 0, 0]);
            // Unassigned IDs and the original Cancel pass through the common cleanup.
            for (const action of [0, 27, 52, 53, 54, 55, 56, 61, 62, 63, 64, 1000, 1005, 1008, 1009, 1010]) {
                rows.push([action + priority, 1, component, 592, 0, 0]);
            }
        }
        const temp = mkdtempSync(join(tmpdir(), 'rs530-hd-actor-actions-'));
        let reference: string[];
        try {
            const cp = [temp, hdGamepackPath, joglPath].join(delimiter);
            const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
            const compile = Bun.spawnSync(['javac', asm, '-cp', cp, '-d', temp, join(import.meta.dir, 'HdExamineMenuOracle.java'), join(import.meta.dir, 'HdInventoryActorActionOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const java = ['java', asm, '-Djava.awt.headless=true', '-cp', cp, 'HdInventoryActorActionOracle'];
            const instrument = Bun.spawnSync([...java, temp]);
            expect(instrument.exitCode, instrument.stderr.toString()).toBe(0);
            const oracle = Bun.spawnSync(java, {
                stdin: Buffer.from(rows.map(row => [...row.slice(0, 6), row[6] ?? 0, row[7] ?? 0].join(' ')).join('\n') + '\n')
            });
            expect(oracle.exitCode, oracle.stderr.toString()).toBe(0);
            reference = oracle.stdout.toString().trimEnd().split(/\r?\n/);
        } finally {
            rmSync(temp, { recursive: true, force: true });
        }
        expect(reference).toHaveLength(rows.length);

        const widget = new IfType();
        widget.id = component;
        widget.properties = new ServerActiveProperties(-1, 91);
        widget.targetTextValue = widget.targetVerbValue = widget.opBaseValue = fromJsString('Widget');
        widget.itemCounts = Int32Array.of(1, 7);
        const ashes = Object.assign(new ObjType(), { id: 592, name: fromJsString('Ashes') });
        ObjType.types.Put(592n, ashes);
        IfType.m_list = new Array(150).fill(null);
        IfType.m_list[149] = [null, null, widget];
        IfType.m_open = new Array(150).fill(false);
        IfType.m_open[149] = true;
        const map = new CollisionMap(104, 104);
        for (const column of map.flags) column.fill(0);
        CollisionMap.levelMaps[0] = map;
        Client.localPlayer = new ClientPlayer();
        Client.localPlayer.pathX[0] = Client.localPlayer.pathZ[0] = 40;
        const player = new ClientPlayer(),
            npc = new ClientNpc();
        npc.npcType = Object.assign(new NpcType(), { id: 708 });
        player.pathX[0] = player.pathZ[0] = npc.pathX[0] = npc.pathZ[0] = 44;
        Client.mapBuildBaseX = 3144;
        Client.mapBuildBaseZ = 3208;
        ClientMouseListener.clickX = 583;
        ClientMouseListener.clickY = 327;
        const writes: string[] = [];
        const routeReads: string[] = [];
        for (const entity of [Client.localPlayer, player, npc]) {
            for (const field of ['pathX', 'pathZ'] as const) {
                const path = entity[field];
                const label = (entity === Client.localPlayer ? 'local' : 'target') + (field === 'pathX' ? 'X' : 'Z');
                Object.defineProperty(entity, field, {
                    get() {
                        routeReads.push(label);
                        return path;
                    }
                });
            }
        }
        const fields = {
            crossMode: 'mode',
            crossTicks: 'crossTicks',
            crossX: 'x',
            crossY: 'y',
            highlightTicks: 'highlightTicks',
            highlightComponent: 'highlight',
            highlightSlot: 'slot',
            objSelected: 'selected',
            objComponent: 'objComponent',
            objSlot: 'objSlot',
            objId: 'objId',
            objName: 'objName',
            targetChild: 'targetChild',
            targetParam: 'targetParam',
            targetComponent: 'targetComponent',
            targetFlags: 'targetFlags',
            targetMode: 'targetMode',
            targetCursor: 'targetCursor',
            defaultCursor: 'defaultCursor',
            targetVerb: 'targetVerb',
            targetName: 'targetName'
        } as const;
        for (const [field, name] of Object.entries(fields)) {
            let value = Reflect.get(Minimenu, field);
            Object.defineProperty(Minimenu, field, {
                configurable: true,
                get: () => value,
                set(next) {
                    value = next;
                    writes.push(name);
                }
            });
        }
        const enterArgs = [101],
            leaveArgs = [102];
        class ObservedHook extends HookReq {
            constructor() {
                super();
                for (const [field, name] of [
                    ['component', 'eventComponent'],
                    ['args', 'eventArgs']
                ]) {
                    let value = Reflect.get(this, field);
                    Object.defineProperty(this, field, {
                        get: () => value,
                        set(next) {
                            value = next;
                            writes.push(name);
                        }
                    });
                }
            }
        }
        mock.module('../../src/script/HookReq.js', () => ({ default: ObservedHook }));
        ScriptRunner.prototype.run = event => {
            expect(event.component).toBe(widget);
            expect(event.args === enterArgs || event.args === leaveArgs).toBe(true);
            writes.push([event.args === enterArgs ? 'enter' : 'leave', Minimenu.targetMode, Minimenu.objSelected, Minimenu.defaultCursor].join('/'));
        };
        for (const [index, row] of rows.entries()) {
            const [action, horizontal, vertical, id, present, control, high = 0, selection = 0] = row;
            Minimenu.actions[0] = action;
            Minimenu.paramB[0] = horizontal;
            Minimenu.paramC[0] = vertical;
            Minimenu.keys[0] = (BigInt(high) << 32n) | BigInt(id >>> 0);
            Client.players[407] = present ? player : null;
            Client.npcs[407] = present ? npc : null;
            ClientKeyboardListener.pressed[82] = control === 1;
            const packet = Client.out;
            packet.m_data = new Uint8Array(128);
            packet.m_pos = 0;
            packet.SetEnc(Int32Array.of(1, 22, 4, 8));
            InterfaceList.pressedContinue = null;
            widget.onTargetEnter = (selection & 2) !== 0 ? enterArgs : null;
            widget.onTargetLeave = (selection & 2) !== 0 ? leaveArgs : null;
            Object.assign(Minimenu, {
                crossMode: 4,
                crossTicks: 51,
                crossX: 11,
                crossY: 37,
                objSelected: (selection >> 2) & 1,
                objId: 0x8123,
                objSlot: 0x4567,
                objComponent: component,
                targetMode: (selection & 1) !== 0,
                targetChild: -1,
                targetComponent: component,
                defaultCursor: 67,
                highlightTicks: 9,
                highlightComponent: null,
                highlightSlot: -12
            });
            Object.assign(world, { takingInput: false, clickLevel: -5, clickX: -5, clickY: -5, groundX: 7, groundZ: 7 });
            writes.length = 0;
            routeReads.length = 0;
            await Client.DoAction(0);
            const result = [
                Buffer.from(packet.m_data.subarray(0, packet.m_pos)).toString('hex'),
                [Minimenu.crossMode, Minimenu.crossTicks, Minimenu.crossX, Minimenu.crossY].join(','),
                [Minimenu.highlightTicks, Minimenu.highlightComponent === widget, Minimenu.highlightSlot].join(','),
                [Minimenu.objSelected, Minimenu.objId, Minimenu.objSlot, Minimenu.objComponent, Minimenu.targetMode, Minimenu.targetComponent, Minimenu.targetChild, InterfaceList.pressedContinue === widget].join(','),
                [world.takingInput, world.clickLevel, world.clickX, world.clickY, world.groundX, world.groundZ].join(','),
                writes.join(','),
                routeReads.join(',')
            ].join('|');
            expect(result, row.join(' ')).toBe(reference[index]);
        }
    },
    30000,
    'gl'
);
