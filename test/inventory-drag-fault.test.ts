import MinimapBuilder from '#/dash3d/MinimapBuilder.js';
import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';
import Client from '#/client/Client.js';
import ClientBuild from '#/client/ClientBuild.js';
import ClientMouseListener from '#/client/ClientMouseListener.js';
import GameShell from '#/client/GameShell.js';
import MouseTracking from '#/client/MouseTracking.js';
import OrbitCamera from '#/client/OrbitCamera.js';
import SuperPacket from '#/io/SuperPacket.js';
import Protocol from '#/io/Protocol.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import Minimenu from '#/ui/Minimenu.js';
import Preferences from '#/ui/Preferences.js';
import ServerActiveProperties from '#/ui/ServerActiveProperties.js';
import { freshGame } from './actor-fixture.js';
import { loginFixture } from './login-fixture.js';
import { gamepackPath } from './reference.js';

type Vector = [from: number, to: number, mode: number, damage: number, size: number];
function vectors(): Vector[] {
    const rows: Vector[] = [];
    for (let mode = 0; mode <= 4; mode++)
        for (let damage = 0; damage <= 14; damage++)
            for (const [from, to] of [
                [0, 3],
                [3, 0],
                [-1, 1],
                [1, -1],
                [0, 5],
                [5, 0],
                [1, 1]
            ])
                rows.push([from, to, mode, damage, 12]);
    for (let mode = 0; mode <= 4; mode++)
        for (let size = 0; size <= 11; size++)
            for (const [from, to] of [
                [0, 3],
                [3, 0]
            ])
                rows.push([from, to, mode, 0, size]);
    return rows;
}
const dump = (v: Int32Array | null) => (v === null ? 'null' : '[' + v.join(', ') + ']');

loginFixture(
    import.meta.url,
    'inventory drag retains original slot and packet mutations when the game tick fails',
    async () => {
        const rows = vectors(),
            dir = mkdtempSync(join(tmpdir(), 'rs530-invdrag-'));
        let expected: string[];
        try {
            const exports = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED', '--add-exports', 'java.base/jdk.internal.org.objectweb.asm.tree=ALL-UNNAMED'];
            const compile = Bun.spawnSync(['javac', ...exports, '-cp', gamepackPath, '-d', dir, ...['MiniMenuOracle', 'InventoryDragFaultOracle'].map(name => join(import.meta.dir, 'ui', name + '.java'))]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const java = Bun.spawnSync(['java', ...exports, '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'InventoryDragFaultOracle'], { stdin: Buffer.from(rows.map(v => v.join(' ')).join('\n') + '\n') });
            expect(java.exitCode, java.stderr.toString()).toBe(0);
            expected = java.stdout.toString().trimEnd().split(/\r?\n/);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
        expect(expected.length).toBe(rows.length);
        const app = (Client.activeClient = new Client()),
            p = new SuperPacket(32),
            m = Minimenu;
        app.game = freshGame({ outgoing: p, account: null, rebuild: null });
        Client.gameState = 30;
        Client.mouseTracking = new MouseTracking();
        Client.lastSentFocus = GameShell.m_focus;
        MinimapBuilder.minimapLevel = ClientBuild.buildLevel = Client.playerLevel;
        Preferences.sent = true;
        OrbitCamera.reportPending = false;
        Protocol.sequenceAckPending = false;
        InterfaceList.top = -1;
        InterfaceList.cycle = 17;
        const c = new IfType();
        c.id = 0x183456;
        c.drawCycle = 17;
        m.count = m.deferred = 0;
        for (const [row, vector] of rows.entries()) {
            const [from, to, mode, damage, size] = vector;
            c.itemIds = damage === 1 ? null : damage === 2 ? new Int32Array(0) : damage === 3 ? Int32Array.of(12, 15) : Int32Array.of(12, 15, mode === 4 ? 0 : 18, 21);
            c.itemCounts = damage === 4 ? null : damage === 5 ? new Int32Array(0) : damage === 6 ? Int32Array.of(49, 73) : Int32Array.of(49, 73, 84, 109);
            Reflect.set(c, 'properties', damage === 7 ? null : new ServerActiveProperties((1 << 28) | (mode === 2 ? 1 << 29 : 0), -1));
            c.rootIndex = damage === 8 ? -1 : 0;
            c.clientCode = mode === 3 ? 205 : 206;
            Client.bankArrangeMode = mode === 0 ? 0 : 1;
            m.objDragComponent = damage === 9 ? null : c;
            Client.hoveredSlotCom = damage === 10 ? null : c;
            m.objDragSlot = from;
            m.hoverSlot = to;
            m.highlightTicks = 23;
            m.objGrabX = m.objGrabY = 10;
            ClientMouseListener.x = 10;
            ClientMouseListener.mouseY = damage === 11 ? 15 : 16;
            ClientMouseListener.mouseButton = damage === 12 ? 1 : 0;
            ClientMouseListener.clickButton = 0;
            m.objDragCycles = damage === 13 ? 3 : damage === 14 ? 2147483647 : 4;
            m.objDragMoved = false;
            InterfaceList.dirty[0] = false;
            const data = (p.m_data = new Uint8Array(size).fill(0xb7));
            p.m_pos = 0;
            p.SetEnc(Int32Array.of(39, 8, 11, 31));
            Client.loopCycle = row + 1;
            Protocol.idleReads = 0;
            Client.m_ticksSinceNoTimeOutPacket = 0;
            let fault = 'ok';
            try {
                await app.GameLoop();
            } catch (error) {
                fault = error instanceof RangeError ? 'bounds' : error instanceof TypeError ? 'null' : String(error);
            }
            const pos = p.m_pos;
            p.m_data = new Uint8Array(1);
            p.m_pos = 0;
            p.pHead(251);
            const actual = [fault, pos, Buffer.from(data).toString('hex'), p.m_data[0], dump(c.itemIds), dump(c.itemCounts), m.objDragComponent === c, m.objDragCycles, m.objDragMoved, m.highlightTicks, InterfaceList.dirty[0]];
            expect(actual.join(' '), vector.join(' ')).toBe(expected[row]);
        }
    },
    30000
);
