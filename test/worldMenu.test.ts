import MinimapBuilder from '#/dash3d/MinimapBuilder.js';
import OrbitCamera from '#/client/OrbitCamera.js';
import WrappedException from '#/util/WrappedException.js';
import ClientMouseListener from '#/client/ClientMouseListener.js';
import { receivePacket } from './receive-packet.js';
import { freshActors, freshGame } from './actor-fixture.js';
import Client from '#/client/Client.js';
import ReceivePlayerPositions from '#/client/ReceivePlayerPositions.js';
import NpcType from '#/config/NpcType.js';
import LocType from '#/config/LocType.js';
import ObjType from '#/config/ObjType.js';
import { loginFixture } from './login-fixture.js';
import ClientBuild from '#/client/ClientBuild.js';
import GameShell from '#/client/GameShell.js';
import MouseTracking from '#/client/MouseTracking.js';
import MouseWheel from '#/client/MouseWheel.js';
import Preferences from '#/ui/Preferences.js';
import Protocol from '#/io/Protocol.js';
import { expect } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { localAssets } from './cachefile.js';
import { cachePath, gamepackPath } from './reference.js';
import { entries } from './menuTrace.js';
import { pressedKeys } from '#/Keyboard.js';
import GameVariant from '#/client/GameVariant.js';
import { fromJsString } from '#/datastruct/JagString.js';
import world from '#/dash3d/world.js';
import Square from '#/dash3d/Square.js';
import Wall from '#/dash3d/Wall.js';
import ModelLit from '#/dash3d/ModelLit.js';
import Pix3D from '#/dash3d/Pix3D.js';
import CollisionMap from '#/dash3d/CollisionMap.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import ClientNpc from '#/dash3d/ClientNpc.js';
import IfType from '#/ui/IfType.js';
import Minimenu from '#/ui/Minimenu.js';
import LocalisedText from '#/ui/LocalisedText.js';
import InterfaceSession from '#/ui/InterfaceSession.js';
import InterfaceView from '#/ui/InterfaceView.js';
import InterfaceList from '#/ui/InterfaceList.js';
import { requireNonNull } from '#/util/JavaArray.js';

loginFixture(
    import.meta.url,
    'native picked world menu rows and cursor priorities, stacked actors and selected-target action packets match the gamepack',
    async () => {
        const out = resolve(import.meta.dir, '../out');
        mkdirSync(out, { recursive: true });
        const tmp = mkdtempSync(join(out, 'worldmenu-'));
        let expected: string[];
        try {
            const exports = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED', '--add-exports', 'java.base/jdk.internal.org.objectweb.asm.tree=ALL-UNNAMED'];
            const sources = ['MiniMenuOracle', 'WorldMenuOracle'].map(name => fileURLToPath(new URL('./ui/' + name + '.java', import.meta.url)));
            const built = Bun.spawnSync(['javac', ...exports, '-cp', gamepackPath, '-d', tmp, ...sources]);
            if (built.exitCode !== 0) throw Error(built.stderr.toString());
            const r = Bun.spawnSync(['java', ...exports, '-Djava.awt.headless=true', '-cp', tmp + delimiter + gamepackPath, 'WorldMenuOracle']);
            if (r.exitCode !== 0) throw Error(r.stderr.toString());
            expected = r.stdout.toString().trimEnd().split(/\r?\n/);
        } finally {
            rmSync(tmp, { recursive: true, force: true });
        }
        const assets = localAssets(cachePath, [3]);
        const p = Client.out;
        const ui = new InterfaceSession(new InterfaceView([]), assets);
        const oldStaff = Client.staffModLevel,
            oldLevel = Client.playerLevel,
            oldX = Client.mapBuildBaseX,
            oldZ = Client.mapBuildBaseZ;
        Client.playerLevel = 0;
        Client.mapBuildBaseX = 3072;
        Client.mapBuildBaseZ = 3168;
        const game = freshGame({ actors: freshActors(), outgoing: p, rebuild: { zoneX: 390, zoneZ: 402, baseX: 3072, baseZ: 3168, level: 0, localX: 34, localZ: 31, squares: [] }, account: null }, assets);
        ui.beginGame(game);
        const npcId = 7843,
            locId = 3859231,
            itemId = 4102,
            playerId = 91,
            x = 4,
            z = 7,
            m = Minimenu;
        const self = game.actors.self,
            player = new ClientPlayer(),
            npc = new ClientNpc();
        Client.npcs[100] = npc;
        Client.players[playerId] = player;
        const oldPrefixes = ClientPlayer.titlePrefixes,
            oldSuffixes = ClientPlayer.nameSuffixes;
        ClientPlayer.titlePrefixes = ClientPlayer.nameSuffixes = null;
        Object.assign(self, { username: fromJsString('Local'), combatLevel: 44, combatRange: 3, team: 1 });
        player.username = fromJsString('Other');
        const n = new NpcType(),
            loc = new LocType(),
            s = fromJsString;
        Object.assign(n, { id: npcId, name: s('Ally'), interactive: true, ops: [s('Chat'), s('ATTACK'), null, s('Wave'), s('Attack')], cursorOp1: 0, cursorOp2: 0, cursor1: 66, cursor2: 67, cursorAttack: 68 });
        npc.setType(n);
        NpcType.m_recentUse.Put(BigInt(npcId), n);
        Object.assign(loc, { id: locId, name: s('High key'), ops: [s('Climb'), null, s('Search'), null, s('Push')], cursorOp1: 0, cursorOp2: 0, cursor1: 44, cursor2: 45, width: 3, length: 2, forceApproach: 5 });
        LocType.m_recentUse.Put(BigInt(locId), loc);
        const key = (kind: number, id: number) => (BigInt(id) << 32n) | BigInt((kind << 29) | (2 << 20) | (10 << 14) | (z << 7) | x);
        const locKey = key(2, locId),
            keys = [-1n, locKey, locKey, key(2, locId + 1), key(3, 0), key(1, 100), key(0, playerId), locKey, key(0, 2047)];
        world.squares = Array.from({ length: 4 }, () => Array.from({ length: 104 }, () => new Array<Square | null>(104).fill(null)));
        const square = (world.squares[0][x][z] = new Square(0, x, z));
        square.wall = new Wall();
        square.wall.typecode = locKey;
        ModelLit.pickedTypecodes = BigInt64Array.from(keys);
        ModelLit.pickedCount = keys.length;
        Pix3D.clipMinX = -200;
        Pix3D.clipMaxX = 200;
        Pix3D.clipMinY = -120;
        Pix3D.clipMaxY = 180;
        for (let i = 0; i < 2; i++) {
            const o = new ObjType();
            o.id = itemId + i;
            o.name = s('Arrow' + i);
            o.groundOps = [s('Lift'), null, s('Take'), null, s('Burn')];
            o.cursor1 = 331;
            o.cursor2 = 432;
            o.cursorOp1 = o.cursorOp2 = 2;
            ObjType.types.Put(BigInt(o.id), o);
            await receivePacket(26, Uint8Array.of(0, 0));
            await receivePacket(33, Uint8Array.of(o.id, o.id >> 8, (x << 4) | z, 0, 129));
        }
        ReceivePlayerPositions.m_lastNum = Client.npcCount = 1;
        ReceivePlayerPositions.m_lastID[0] = playerId;
        Client.npcIds[0] = 100;
        requireNonNull(IfType.m_list)[0] = [new IfType()];
        requireNonNull(IfType.m_open)[0] = true;
        self.x = self.z = 0;
        m.keys[0] = 0n;
        m.paramB[0] = m.paramC[0] = 0;
        m.isOpen = false;
        m.deferred = 0;
        m.walkHere = LocalisedText.walkHere;
        m.defaultCursor = 11;
        m.objCursor = 22;
        m.examineCursor = 33;
        m.targetCursor = 44;
        m.targetParam = -1;
        m.targetName = s('Target');
        m.targetVerb = s('Cast');
        m.objName = s('Selected');
        for (let i = 0; i < 8; i++) {
            m.playerOption[i] = i === 5 ? null : s(i === 2 ? 'attack' : 'Option' + i);
            m.playerCursor[i] = 55 + i;
            m.playerSecondary[i] = i % 3 === 0;
        }
        const app = (Client.activeClient = new Client());
        app.game = game;
        app.ui = ui;
        const savedCamera = { followYaw: OrbitCamera.followYaw, minimapAngle: OrbitCamera.minimapAngle, minimapZoom: OrbitCamera.minimapZoom };
        const savedClick = [ClientMouseListener.clickX, ClientMouseListener.clickY];
        const savedMapClick = [Client.minimapClickX, Client.minimapClickY];
        const savedPick = { takingInput: world.takingInput, clickLevel: world.clickLevel, clickX: world.clickX, clickY: world.clickY };
        const priorMap = CollisionMap.levelMaps[0],
            map = new CollisionMap(104, 104);
        try {
            let row = 0;
            for (let i = 0; i < 256; i++) {
                GameVariant.id = (i >> 5) & 1;
                m.showOpIndices = !!(i & 1);
                m.objSelected = i & 2 ? 1 : 0;
                m.targetMode = !!(i & 4);
                m.targetFlags = i & 8 ? 127 : 0;
                m.targetChild = -1;
                m.targetComponent = 0;
                n.m_gridSize = i & 16 ? 2 : 1;
                n.m_visibleCombatLevel = i % 11 === 0 ? 0 : i % 89;
                const center = 32 * 128 + 64 * n.m_gridSize;
                npc.x = center;
                npc.z = center + (i % 3 === 1 ? 1 : 0);
                player.x = player.z = center;
                player.combatLevel = i % 77;
                player.combatLevelWithSummoning = player.combatLevel + (i % 3);
                player.combatRange = i % 3 === 0 ? -1 : 3;
                player.team = i % 3;
                player.skillLevel = i % 7 === 0 ? 321 : 0;
                m.ResetMinimenu();
                await Minimenu.Build(7, 58, 72, 65, 44, 5);
                m.Sort();
                expect(entries(), 'menu ' + i).toBe(expected[row++]);
            }
            GameVariant.id = 0;
            m.targetMode = m.showOpIndices = false;
            m.objSelected = 0;
            m.count = 1;
            m.highlightComponent = null;
            for (const col of map.flags) col.fill(0);
            CollisionMap.levelMaps.fill(map);
            self.move(true, 31, 34);
            player.move(true, 36, 39);
            npc.pathX[0] = 39;
            npc.pathZ[0] = 36;
            m.objSlot = 65192;
            m.objId = 56123;
            m.objComponent = 0x1369abcd;
            m.targetChild = 21415;
            m.targetComponent = 0x789acbaf;
            p.SetEnc(Int32Array.of(3, 5, 9, 1));
            Client.minimapClickX = -41;
            Client.minimapClickY = 18;
            Object.assign(OrbitCamera, { followYaw: 1856, minimapAngle: -15, minimapZoom: 46 });
            ClientMouseListener.clickX = ClientMouseListener.clickY = 0;
            Object.assign(world, { takingInput: false, clickLevel: 0, clickX: 0, clickY: 0 });
            Client.walkClickStage = Client.targetTileState = m.crossMode = m.crossTicks = m.crossX = m.crossY = 0;
            for (let i = 0; i < 6; i++) {
                GameVariant.id = i & 1;
                pressedKeys[82] = !!(i & 2);
                for (const action of [33, 8, 51, 9, 31, 40, 34, 17, 16, 47, 49, 19, 14, 29, 4, 60, 32, 1007, 20, 11, 58, 45, 1003, 48, 28, 1004, 21, 25, 7, 35, 43, 36, 24, 1006, 5, 41, 57, 5, 41, 57]) {
                    let packed = BigInt(playerId);
                    if ([49, 19, 14, 29, 4, 60, 32, 1007].includes(action)) packed = 100n;
                    if ([20, 11, 58, 45, 1003, 48, 28].includes(action)) packed = (locKey & ~((31n << 14n) | (3n << 20n))) | BigInt(([0, 9, 10, 11, 22, 5][i] << 14) | ((i & 3) << 20));
                    if (action === 1004) packed = BigInt(locId);
                    if ([21, 25, 7, 35, 43, 36, 24, 1006].includes(action)) packed = BigInt(itemId);
                    if ([5, 41, 57].includes(action)) {
                        packed = BigInt(i & 1);
                        world.takingInput = false;
                        world.clickLevel = 9;
                        world.clickX = 10;
                        world.clickY = 11;
                    }
                    p.m_pos = 0;
                    m.actions[0] = action;
                    m.paramB[0] = 20 + i;
                    m.paramC[0] = 44 - i;
                    m.keys[0] = packed;
                    Client.DoAction(0, ui);
                    const bytes = Buffer.from(requireNonNull(p.m_data).subarray(0, p.m_pos)).toString('hex');
                    expect([bytes, m.crossMode, m.crossTicks, m.crossX, m.crossY, Client.walkClickStage, Client.targetTileState, world.takingInput, world.clickLevel, world.clickX, world.clickY].join(' '), 'action ' + action + ' step ' + i).toBe(
                        expected[row++]
                    );
                }
            }
            GameVariant.id = 0;
            Client.gameState = 30;
            Client.mouseTracking = new MouseTracking();
            Client.lastSentFocus = GameShell.m_focus;
            OrbitCamera.reportPending = false;
            Preferences.sent = true;
            Protocol.sequenceAckPending = false;
            InterfaceList.top = -1;
            ReceivePlayerPositions.m_lastNum = Client.npcCount = 0;
            m.count = m.deferred = 0;
            let bytes = '';
            Client.stream = {
                GetAvailable() {
                    return 0;
                },
                async read() {
                    return -1;
                },
                async Read() {},
                Close() {},
                Write(start, data, size) {
                    bytes += Buffer.from(requireNonNull(data).subarray(start, start + size)).toString('hex');
                }
            };
            const rotations = [0, 1, -1, 4, -4, -2147483648, 2147483647];
            for (let i = 0; i < 110; i++) {
                Client.staffModLevel = i >= 36 ? 2 : 0;
                pressedKeys[81] = pressedKeys[82] = i >= 36;
                if (i >= 54) {
                    const v = i - 54;
                    Client.playerLevel = ((v / 7) | 0) % 4;
                    MouseWheel.rotation = rotations[v % rotations.length];
                    pressedKeys[81] = (v & 1) === 0;
                    pressedKeys[82] = (v & 2) === 0;
                    Client.staffModLevel = (v & 4) === 0 ? 2 : 0;
                }
                MinimapBuilder.minimapLevel = ClientBuild.buildLevel = Client.playerLevel;
                Client.loopCycle = i + 1;
                Client.m_ticksSinceNoTimeOutPacket = 0;
                Client.walkClickStage = i % 3;
                Client.targetTileState = ((i / 3) | 0) % 3;
                world.groundX = (i < 54 ? i % 2 : (i - 54) & 8) === 0 ? -1 : 25;
                world.groundZ = 42;
                // t.c advances an active cross by 20 before it processes the picked tile.
                m.crossMode = 2;
                m.crossTicks = 63;
                m.crossY = 4;
                m.crossX = 5;
                p.m_pos = 0;
                bytes = '';
                await app.GameLoop();
                expect([bytes, m.crossMode, m.crossTicks, m.crossX, m.crossY, Client.walkClickStage, Client.targetTileState, world.groundX, world.groundZ].join(' '), 'ground tick ' + i).toBe(expected[row++]);
            }
            // Before a completed tick the Java outbound position includes every successfully written byte.
            // The real TS loop flushes it to the socket on success and retains its original cursor on failure.
            for (let mode = 0; mode < 4; mode++)
                for (let size = 0; size <= 48; size++) {
                    Client.staffModLevel = mode === 3 ? 2 : 0;
                    pressedKeys[81] = pressedKeys[82] = mode === 3;
                    MouseWheel.rotation = 1;
                    MinimapBuilder.minimapLevel = ClientBuild.buildLevel = Client.playerLevel = 2;
                    Client.walkClickStage = mode === 1 || mode === 3 ? 2 : 0;
                    Client.targetTileState = mode === 2 || mode === 3 ? 2 : 0;
                    world.groundX = 25;
                    world.groundZ = 42;
                    m.crossMode = 2;
                    m.crossTicks = 63;
                    m.crossY = 4;
                    m.crossX = 5;
                    Client.loopCycle = 120 + mode * 49 + size;
                    Client.m_ticksSinceNoTimeOutPacket = 0;
                    const data = (p.m_data = new Uint8Array(size).fill(0xa5));
                    p.m_pos = 0;
                    p.SetEnc(Int32Array.of(1, 22, 4, 8));
                    bytes = '';
                    let fault = 'ok';
                    try {
                        await app.GameLoop();
                    } catch (error) {
                        let cause = error;
                        while (cause instanceof WrappedException && cause.cause !== null) cause = cause.cause;
                        fault = cause instanceof RangeError ? 'bounds' : String(cause);
                    }
                    const pos = fault === 'ok' ? bytes.length / 2 : p.m_pos;
                    p.m_data = new Uint8Array(1);
                    p.m_pos = 0;
                    p.pHead(251);
                    const state = [fault, pos, Buffer.from(data).toString('hex'), p.m_data[0], m.crossMode, m.crossTicks, m.crossX, m.crossY, Client.walkClickStage, Client.targetTileState, world.groundX, world.groundZ];
                    expect(state.join(' '), 'ground action ' + mode + ' packet capacity ' + size).toBe(expected[row++]);
                }
            expect(row).toBe(expected.length);
        } finally {
            Object.assign(OrbitCamera, savedCamera);
            Object.assign(world, savedPick);
            [ClientMouseListener.clickX, ClientMouseListener.clickY] = savedClick;
            [Client.minimapClickX, Client.minimapClickY] = savedMapClick;
            m.count = m.deferred = m.objSelected = m.defaultCursor = m.crossMode = Client.walkClickStage = Client.targetTileState = 0;
            m.targetMode = m.isOpen = m.showOpIndices = false;
            m.defaultCursor = m.objCursor = m.examineCursor = -1;
            m.targetName = m.targetVerb = m.objName = null;
            m.targetParam = m.targetChild = -1;
            m.playerOption.fill(null);
            m.playerSecondary.fill(false);
            m.playerCursor.fill(-1);
            ClientPlayer.titlePrefixes = oldPrefixes;
            ClientPlayer.nameSuffixes = oldSuffixes;
            GameVariant.id = 0;
            Client.staffModLevel = oldStaff;
            Client.playerLevel = oldLevel;
            Client.mapBuildBaseX = oldX;
            Client.mapBuildBaseZ = oldZ;
            ReceivePlayerPositions.m_lastNum = Client.npcCount = 0;
            CollisionMap.levelMaps[0] = priorMap;
            pressedKeys[81] = pressedKeys[82] = false;
            world.groundX = world.groundZ = -1;
            NpcType.m_recentUse.Reset();
            LocType.m_recentUse.Reset();
            ObjType.types.Reset();
        }
    },
    20000
);
