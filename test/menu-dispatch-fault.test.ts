import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import Client from '#/client/Client.js';
import ClientKeyboardListener from '#/client/ClientKeyboardListener.js';
import ClientMouseListener from '#/client/ClientMouseListener.js';
import GameVariant from '#/client/GameVariant.js';
import OrbitCamera from '#/client/OrbitCamera.js';
import ObjType from '#/config/ObjType.js';
import LocType from '#/config/LocType.js';
import NpcType from '#/config/NpcType.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import ClientNpc from '#/dash3d/ClientNpc.js';
import CollisionMap from '#/dash3d/CollisionMap.js';
import world from '#/dash3d/world.js';
import JagString, { fromJsString } from '#/datastruct/JagString.js';
import ChatHistory from '#/game/ChatHistory.js';
import SuperPacket from '#/io/SuperPacket.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import Minimenu from '#/ui/Minimenu.js';
import ServerActiveProperties from '#/ui/ServerActiveProperties.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { loginFixture } from './login-fixture.js';
import { gamepackPath } from './reference.js';

type Vector = [action: number, index: number, paramB: number, paramC: number, keyHigh: number, keyLow: number, mode: number, capacity: number, damagedMenuArray: number, pos: number];

function vectors(): Vector[] {
    const result: Vector[] = [];
    const scene = new Set([4, 5, 7, 8, 9, 11, 14, 16, 17, 19, 20, 21, 24, 25, 28, 29, 31, 32, 33, 34, 35, 36, 40, 41, 43, 45, 47, 48, 49, 51, 57, 58, 60, 1003, 1004, 1006, 1007]);
    const loc = new Set([11, 20, 28, 45, 48, 58, 1003]);
    const child = new Set([6, 38, 59, 1001]);
    for (const action of [...Array.from({ length: 65 }, (_, i) => i), ...Array.from({ length: 11 }, (_, i) => 1000 + i), -1, -32768, 32767]) {
        const b = scene.has(action) ? 17 : child.has(action) ? -1 : 1,
            c = scene.has(action) ? 23 : 2;
        const high = loc.has(action) ? 4321 : 0,
            low = loc.has(action) ? (11 << 14) | (1 << 20) : [5, 41, 57].includes(action) ? 1 : 5;
        const add = (mode: number, cap: number, start: number) => result.push([action, 0, b, c, high, low, mode, cap, 0, start]);
        for (let capacity = 0; capacity <= 26; capacity++) add(3, capacity, 1);
        for (const mode of [0, 1, 4, 8, 16, 32, 64]) add(mode, 40, 0);
        add(3, 6, -1);
        result.push([action + 2000, 0, b, c, high, low, 1, 40, 0, 0], [action, 0, -1, -1, -1, -1, 1, 40, 0, 0], [action, 0, 0, 0, 0, 0, 1, 40, 0, 0]);
    }
    // The backing arrays are independent. A negative selection skips all reads, and only IfButtonX reads ph.e.
    for (const action of [1, 6, 12, 16, 38, 59, 1001, 1002, 2060])
        for (const i of [-2147483648, -1, 0, 1, 500]) {
            for (const damage of [-7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 9, 10]) result.push([action, i, -1, 2, 0, 5, 1, 9, damage, 0]);
        }
    return result;
}

function hex(s: JagString | null): string {
    return s === null ? '-' : Buffer.from(requireNonNull(s.bytes).subarray(0, s.length)).toString('hex');
}

loginFixture(
    import.meta.url,
    'bd.c native menu indices and action packet boundaries preserve Java selection and cursor state',
    async () => {
        const entries = vectors(),
            dir = mkdtempSync(join(tmpdir(), 'rs530-menu-dispatch-'));
        let expected: string[];
        try {
            const compile = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, resolve(import.meta.dir, 'ui/MenuDispatchFaultOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const run = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'MenuDispatchFaultOracle'], { stdin: Buffer.from(entries.map(row => row.join(' ')).join('\n') + '\n'), maxBuffer: 8 * 1024 * 1024 });
            expect(run.exitCode, run.stderr.toString()).toBe(0);
            expected = run.stdout.toString().trimEnd().split(/\r?\n/);
            expect(expected.length).toBe(entries.length);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
        const m = Minimenu,
            self = new ClientPlayer(),
            player = new ClientPlayer(),
            npc = new ClientNpc();
        npc.npcType = new NpcType();
        npc.npcType.id = 0x1251;
        self.pathX[0] = 14;
        self.pathZ[0] = 19;
        self.x = 14 * 128 + 64;
        self.z = 19 * 128 + 64;
        player.pathX[0] = npc.pathX[0] = 17;
        player.pathZ[0] = npc.pathZ[0] = 23;
        const collision = (CollisionMap.levelMaps[0] = new CollisionMap(104, 104));
        for (const col of collision.flags) col.fill(0);
        const obj = new ObjType();
        obj.id = 5;
        obj.name = fromJsString('Arrow');
        ObjType.types.Put(5n, obj);
        const loc = new LocType();
        loc.id = 4321;
        loc.width = 3;
        loc.length = 2;
        loc.forceApproach = 5;
        LocType.m_recentUse.Put(4321n, loc);
        const widget = new IfType();
        widget.id = 2;
        widget.drawCycle = 19;
        widget.properties = new ServerActiveProperties(-1, 91);
        widget.targetLeaveCursor = 62;
        widget.targetOverCursor = 85;
        widget.opBaseValue = fromJsString('widget');
        widget.targetTextValue = fromJsString('spell');
        widget.targetVerbValue = fromJsString('select');
        IfType.m_list = [[null, null, widget]];
        IfType.m_open = [true];
        InterfaceList.cycle = 19;
        const oldHighlight = new IfType();
        oldHighlight.drawCycle = 19;
        oldHighlight.rootIndex = 1;
        const selected = fromJsString('selected'),
            cast = fromJsString('cast'),
            target = fromJsString('target');
        Client.playerLevel = 0;
        Client.mapBuildBaseX = 3072;
        Client.mapBuildBaseZ = 3168;
        ClientMouseListener.clickX = -141;
        ClientMouseListener.clickY = 941;
        Object.assign(OrbitCamera, { followYaw: 0x733, minimapAngle: -16, minimapZoom: 47 });
        Client.minimapClickX = -39;
        Client.minimapClickY = 19;
        const packet = (Client.out = new SuperPacket(0));
        for (const [row, vector] of entries.entries()) {
            const [action, index, b, c, hi, lo, mode, capacity, damage, start] = vector;
            Client.localPlayer = mode & 8 ? null : self;
            Client.players[5] = mode & 64 ? null : player;
            Client.npcs[5] = mode & 64 ? null : npc;
            GameVariant.id = (mode >> 1) & 1;
            ClientKeyboardListener.pressed[82] = GameVariant.id !== 0;
            widget.if3 = !!(mode & 2);
            widget.rootIndex = mode & 32 ? -1 : 0;
            widget.itemCounts = mode & 16 ? null : Int32Array.of(2, mode & 4 ? 100000 : 12);
            widget.scripts = mode & 16 ? [new Int32Array(0)] : null;
            m.count = 0;
            Reflect.set(m, 'paramB', damage === -1 || damage === 9 ? null : damage === 1 || damage === 10 ? new Int32Array(0) : Int32Array.of(b));
            Reflect.set(m, 'paramC', damage === -2 || damage === 10 ? null : damage === 2 || damage === 9 ? new Int32Array(0) : Int32Array.of(c));
            Reflect.set(m, 'keys', damage === -3 ? null : damage === 3 ? new BigInt64Array(0) : BigInt64Array.of((BigInt(hi) << 32n) | BigInt(lo >>> 0)));
            Reflect.set(m, 'actions', damage === -4 ? null : damage === 4 ? new Int16Array(0) : Int16Array.of(action));
            Reflect.set(m, 'target', damage === -5 ? null : damage === 5 ? [] : [target]);
            Reflect.set(m, 'option', damage === -6 ? null : []);
            Reflect.set(m, 'cursor', damage === -7 ? null : new Int32Array(0));
            m.objSelected = mode & 1;
            m.targetMode = m.objSelected !== 0;
            m.targetChild = -1;
            m.targetComponent = 2;
            m.targetFlags = 12;
            m.targetParam = 13;
            m.targetCursor = 14;
            m.defaultCursor = 21;
            m.objName = selected;
            m.targetVerb = cast;
            m.targetName = target;
            m.objSlot = 22131;
            m.objId = 45123;
            m.objComponent = 2;
            m.highlightComponent = oldHighlight;
            m.highlightSlot = -52;
            m.highlightTicks = 29;
            InterfaceList.pressedContinue = null;
            Client.logoutTimer = 71;
            InterfaceList.dirty.fill(false);
            ChatHistory.count = 0;
            ChatHistory.text[0] = null;
            m.crossMode = 3;
            m.crossTicks = 45;
            m.crossX = 57;
            m.crossY = 68;
            Client.walkClickStage = 7;
            Client.targetTileState = 8;
            world.takingInput = false;
            world.clickLevel = 9;
            world.clickX = 10;
            world.clickY = 11;
            world.groundX = 12;
            world.groundZ = 13;
            Client.destinationX = -32;
            Client.destinationZ = -98;
            Client.tryMoveNearest = -6;
            packet.m_data = new Uint8Array(capacity).fill(0xa5);
            packet.m_pos = start;
            packet.SetEnc(Int32Array.of(1, 22, 4, 8));
            let fault = '-';
            try {
                const pending = Client.DoAction(index);
                if (pending instanceof Promise) await pending;
            } catch (err) {
                fault = err instanceof TypeError ? 'null' : err instanceof RangeError ? 'bounds' : String(err);
            }
            const pos = packet.m_pos,
                bytes = Buffer.from(packet.m_data).toString('hex');
            packet.m_data = new Uint8Array(1);
            packet.m_pos = 0;
            packet.pHead(251);
            const actual = [
                fault,
                pos,
                bytes,
                requireNonNull(packet.m_data)[0],
                m.crossMode,
                m.crossTicks,
                m.crossX,
                m.crossY,
                Client.walkClickStage,
                Client.targetTileState,
                world.takingInput,
                world.clickLevel,
                world.clickX,
                world.clickY,
                world.groundX,
                world.groundZ,
                Client.destinationX,
                Client.destinationZ,
                Client.tryMoveNearest,
                m.objSelected,
                m.objSlot,
                m.objComponent,
                m.objId,
                hex(m.objName),
                m.targetMode,
                m.targetChild,
                m.targetComponent,
                m.targetCursor,
                m.targetFlags,
                m.targetParam,
                hex(m.targetVerb),
                hex(m.targetName),
                m.defaultCursor,
                m.highlightTicks,
                m.highlightComponent === widget ? 1 : m.highlightComponent === oldHighlight ? 2 : 0,
                m.highlightSlot,
                InterfaceList.pressedContinue === widget,
                Client.logoutTimer,
                InterfaceList.dirty[0],
                InterfaceList.dirty[1],
                ChatHistory.count,
                hex(ChatHistory.text[0])
            ].join(' ');
            expect(actual, vector.join(' ')).toBe(expected[row]);
        }
    },
    40000
);
