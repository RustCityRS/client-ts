import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';
import Client from '#/client/Client.js';
import GameVariant from '#/client/GameVariant.js';
import ReceivePlayerPositions from '#/client/ReceivePlayerPositions.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import ClientNpc from '#/dash3d/ClientNpc.js';
import NpcType from '#/config/NpcType.js';
import LocType from '#/config/LocType.js';
import { fromJsString as s } from '#/datastruct/JagString.js';
import world from '#/dash3d/world.js';
import Square from '#/dash3d/Square.js';
import Wall from '#/dash3d/Wall.js';
import Pix3D from '#/dash3d/Pix3D.js';
import ModelLit from '#/dash3d/ModelLit.js';
import Minimenu from '#/ui/Minimenu.js';
import IfType from '#/ui/IfType.js';
import ParamType from '#/config/ParamType.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { menuArrayHash as hash } from './menuTrace.js';
import { loginFixture } from './login-fixture.js';
import { gamepackPath } from './reference.js';
function key(kind: number, id: number, x: number, z: number) {
    return (BigInt(id) << 32n) | (BigInt(kind) << 29n) | BigInt(((z & 127) << 7) | (x & 127));
}
type Vector = [kind: number, mode: number, damage: number, delta: number, coord: number, count: number];
function cases(): Vector[] {
    const rows: Vector[] = [];
    for (let kind = 0; kind <= 2; kind++) for (let mode = 0; mode < 32; mode++) for (const count of [0, 1, 399, 400, 499, 500]) rows.push([kind, mode, 0, 0, 103, count]);
    for (let mode = 0; mode < 4; mode++) for (const delta of [-2147483648, -129, -128, -65, -64, -1, 0, 1, 63, 64, 127, 128, 2147483647]) for (const coord of [0, 103, 104, 127]) rows.push([0, mode, 0, delta, coord, 0]);
    for (let damage = 1; damage <= 26; damage++) for (const mode of [0, 1, 2, 3, 4, 5, 6, 8, 11, 19]) for (const kind of [0, 1, 2]) rows.push([kind, mode, damage, 63, 2, 0]);
    return rows;
}
loginFixture(
    import.meta.url,
    'scene menu builders preserve projection, picked buffer bounds, actor footprints and native menu rows',
    async () => {
        const rows = cases(),
            dir = mkdtempSync(join(tmpdir(), 'rs530-scenemenu-'));
        let expected: string[];
        try {
            const build = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'ui', 'SceneMenuBuildOracle.java')]);
            expect(build.exitCode, build.stderr.toString()).toBe(0);
            const child = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'SceneMenuBuildOracle'], { stdin: Buffer.from(rows.map(v => v.join(' ')).join('\n') + '\n') });
            expect(child.exitCode, child.stderr.toString()).toBe(0);
            expected = child.stdout.toString().trimEnd().split(/\r?\n/);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
        expect(expected.length).toBe(rows.length);
        const local = new ClientPlayer(),
            p1 = new ClientPlayer(),
            p2 = new ClientPlayer(),
            n1 = new ClientNpc(),
            n2 = new ClientNpc(),
            def1 = new NpcType(),
            def2 = new NpcType(),
            m = Minimenu;
        local.username = s('self');
        p1.username = s('one');
        p2.username = s('two');
        ClientPlayer.titlePrefixes = ClientPlayer.nameSuffixes = null;
        def1.name = s('npcOne');
        def2.name = s('npcTwo');
        def1.interactive = def2.interactive = true;
        def1.ops = def2.ops = [s('Talk'), s('Attack'), null, s('Tag'), s('Op4')];
        for (let i = 0; i < 8; i++) {
            m.playerOption[i] = i === 1 ? s('Attack') : s('Option' + i);
            m.playerCursor[i] = 80 + i;
            m.playerSecondary[i] = (i & 1) !== 0;
        }
        const loc = new LocType();
        loc.id = 13;
        loc.name = s('bench');
        loc.ops = [s('Use'), null, s('Look'), null, s('Op4')];
        LocType.m_recentUse.Put(13n, loc);
        m.walkHere = s('Walk here');
        m.targetCursor = 151;
        m.defaultCursor = 66;
        m.examineCursor = 78;
        m.objCursor = 77;
        m.targetVerb = s('Cast');
        m.objName = s('object');
        m.targetName = s('spell');
        m.targetParam = -1;
        const tiles = Array.from({ length: 1 }, () => Array.from({ length: 104 }, () => new Array<Square | null>(104).fill(null)));
        for (const x of [0, 1, 2, 103])
            for (const z of [0, 1, 2, 103]) {
                const tile = (tiles[0][x][z] = new Square(0, x, z));
                tile.wall = new Wall();
            }
        IfType.m_list = [[new IfType()]];
        IfType.m_open = [true];
        const param = new ParamType();
        param.m_defaultNumber = 94;
        ParamType.m_recentUse.Put(68n, param);
        for (const [row, v] of rows.entries()) {
            const [kind, mode, damage, delta, coord, count] = v;
            m.option.fill(null);
            m.target.fill(null);
            m.actions.fill(0);
            m.cursor.fill(0);
            m.paramB.fill(0);
            m.paramC.fill(0);
            m.keys.fill(0n);
            m.count = count;
            m.actions[0] = 57;
            Client.localPlayer = damage === 11 ? null : local;
            Reflect.set(Client, 'players', [null, damage === 5 ? null : p1, damage === 6 ? null : p2]);
            Reflect.set(Client, 'npcs', [null, damage === 7 ? null : n1, damage === 8 ? null : n2]);
            n1.npcType = damage === 9 ? null : def1;
            n2.npcType = damage === 10 ? null : def2;
            def1.m_gridSize = 1 + (mode & 1);
            def2.m_gridSize = 1;
            def1.m_visibleCombatLevel = (mode & 16) !== 0 ? 45 : 0;
            def2.m_visibleCombatLevel = 67;
            local.combatLevel = 90;
            local.combatRange = 1;
            local.team = 2;
            p1.combatLevel = 70;
            p1.combatLevelWithSummoning = 72;
            p1.combatRange = 39;
            p1.team = (mode & 1) !== 0 ? 1 : 2;
            p1.skillLevel = (mode & 2) !== 0 ? 122 : 0;
            p2.combatLevel = 92;
            p2.combatLevelWithSummoning = 95;
            p2.combatRange = 2;
            p2.skillLevel = 0;
            p2.team = 1;
            const center = 0x2080 + (def1.m_gridSize === 2 ? 0 : 64);
            n1.x = n1.z = center;
            n2.x = (center + delta) | 0;
            n2.z = (center + delta) | 0;
            p1.x = p1.z = 0x20c0;
            p2.x = (p1.x + delta) | 0;
            p2.z = (p1.z + delta) | 0;
            p1.setSize(1 + (mode & 1));
            p2.setSize(1);
            Reflect.set(Client, 'npcIds', damage === 12 ? null : damage === 13 ? Int32Array.of(1) : Int32Array.of(1, damage === 14 ? 19 : 2));
            Reflect.set(ReceivePlayerPositions, 'm_lastID', damage === 15 ? null : damage === 16 ? Int32Array.of(1) : Int32Array.of(1, damage === 17 ? -1 : 2));
            Client.npcCount = ReceivePlayerPositions.m_lastNum = 2;
            m.objSelected = (mode >> 2) & 1;
            m.targetMode = (mode & 8) !== 0;
            m.targetFlags = 63;
            GameVariant.id = (mode >> 1) & 1;
            m.showOpIndices = (mode & 16) !== 0;
            m.isOpen = false;
            m.targetChild = damage === 23 ? -1 : 0;
            m.targetComponent = 0;
            m.defaultCursor = 66;
            if (damage === 23 || damage === 24) {
                m.targetMode = true;
                m.targetFlags |= 64;
            }
            m.targetParam = damage === 25 ? 68 : damage === 26 ? 69 : -1;
            if (damage === 25 || damage === 26) {
                m.objSelected = 0;
                m.targetMode = true;
            }
            Client.playerLevel = damage === 22 ? 1 : 0;
            world.squares = damage === 21 ? null : tiles;
            const scenery = key(2, 13, coord, coord);
            if (coord >= 0 && coord < 104) requireNonNull(requireNonNull(tiles[0][coord][coord]).wall).typecode = scenery;
            const pick = (mode & 3) === 2 ? scenery : key(mode & 3, 1, coord, coord);
            ModelLit.pickedTypecodes = damage === 4 ? null : BigInt64Array.from([-1n, pick, pick, scenery, scenery + (1n << 32n), pick, key(1, 2, coord, coord), key(0, 2, coord, coord)]);
            ModelLit.pickedCount = damage === 1 ? -1 : damage === 2 ? 0 : damage === 3 ? 9 : 8;
            Pix3D.clipMinX = damage === 20 ? 2147483647 : -321;
            Pix3D.clipMaxX = 234;
            Pix3D.clipMinY = -156;
            Pix3D.clipMaxY = damage === 20 ? -2147483648 : 176;
            let fault = 'ok';
            try {
                if (kind === 0) await m.Build(32, delta, damage === 18 ? 0 : -73, damage === 19 ? 0 : 63, delta, -45);
                if (kind === 1) m.AddNpcOptions(coord, -coord, 21, n1.npcType);
                if (kind === 2) m.AddPlayerOptions(-coord, coord, 2, damage === 5 ? null : damage === 7 ? Client.localPlayer : p1);
            } catch (error) {
                fault = error instanceof TypeError ? 'null' : error instanceof RangeError ? (error.message === '/ by zero' ? 'divide' : 'bounds') : String(error);
            }
            expect([fault, m.count, hash(m.option), hash(m.target), hash(m.cursor), hash(m.actions), hash(m.keys), hash(m.paramB), hash(m.paramC), m.targetMode, m.defaultCursor].join(' '), v.join(' ')).toBe(expected[row]);
        }
    },
    30000
);
