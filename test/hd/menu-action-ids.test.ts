import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import GameVariant from '#/client/GameVariant.js';
import LocType from '#/config/LocType.js';
import NpcType from '#/config/NpcType.js';
import ObjType from '#/config/ObjType.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import ModelLit from '#/dash3d/ModelLit.js';
import Pix3D from '#/dash3d/Pix3D.js';
import Square from '#/dash3d/Square.js';
import Wall from '#/dash3d/Wall.js';
import world from '#/dash3d/world.js';
import { fromJsString } from '#/datastruct/JagString.js';
import IfType from '#/ui/IfType.js';
import Minimenu from '#/ui/Minimenu.js';
import ServerActiveProperties from '#/ui/ServerActiveProperties.js';
import { loginFixture } from '../login-fixture.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

loginFixture(
    import.meta.url,
    'HD component, inventory, NPC, player and loc menus match every original action and classification',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), '530-hd-menu-actions-'));
        const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
        let reference: string[];
        try {
            const build = Bun.spawnSync(['javac', '-cp', cp, '-d', dir, join(import.meta.dir, 'HdMenuActionsOracle.java')]);
            expect(build.exitCode, build.stderr.toString()).toBe(0);
            const run = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', cp, 'HdMenuActionsOracle']);
            expect(run.exitCode, run.stderr.toString()).toBe(0);
            reference = run.stdout.toString().trimEnd().split(/\r?\n/);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
        const rows: string[] = [];
        const capture = () => {
            const entries = [];
            for (let i = 0; i < Minimenu.count; i++) {
                const action = Minimenu.actions[i];
                entries.push([action, Minimenu.paramB[i], Minimenu.paramC[i], Minimenu.keys[i], Minimenu.MenuOnly(i), Minimenu.IsInterfaceEntry(action)].join(','));
            }
            rows.push(entries.join(' '));
            Minimenu.count = 0;
        };
        const names = (count: number) => Array.from({ length: count }, (_, i) => fromJsString('op' + i));
        const item = Object.assign(new ObjType(), { id: 21, name: fromJsString('Item'), inventoryOps: names(5) });
        ObjType.types.Put(21n, item);
        const widget = new IfType();
        widget.id = 77;
        widget.childId = 3;
        widget.type = 2;
        widget.if3 = true;
        widget.baseWidth = widget.baseHeight = 1;
        widget.invSlotOffsetX = new Int32Array(20);
        widget.invSlotOffsetY = new Int32Array(20);
        widget.itemIds = Int32Array.of(22);
        widget.properties = new ServerActiveProperties(-1, -1);
        widget.targetTextValue = widget.targetVerbValue = widget.opBaseValue = widget.buttonTextValue = fromJsString('widget');
        widget.invOptions = names(5);
        widget.operationNames = names(10);
        const npc = Object.assign(new NpcType(), { name: fromJsString('NPC'), ops: names(5), m_visibleCombatLevel: 0 });
        Client.localPlayer = new ClientPlayer();
        const other = Object.assign(new ClientPlayer(), { username: fromJsString('Player'), skillLevel: 1 });
        for (let i = 0; i < 8; i++) Minimenu.playerOption[i] = fromJsString('op' + i);
        Minimenu.playerSecondary.fill(true);
        Minimenu.objName = Minimenu.targetName = Minimenu.targetVerb = fromJsString('selected');
        Minimenu.targetParam = -1;
        Minimenu.targetFlags = 63;
        const key = (13n << 32n) | (2n << 29n) | (2n << 7n) | 1n;
        Client.playerLevel = 0;
        const tile = new Square(0, 1, 2);
        tile.wall = new Wall();
        tile.wall.typecode = key;
        world.squares = [[[], [null, null, tile]]];
        const loc = Object.assign(new LocType(), { id: 13, name: fromJsString('Object'), ops: names(5) });
        LocType.m_recentUse.Put(13n, loc);
        ModelLit.pickedTypecodes = BigInt64Array.of(key);
        ModelLit.pickedCount = 1;
        Pix3D.clipMinX = Pix3D.clipMaxX = Pix3D.clipMinY = Pix3D.clipMaxY = 0;
        for (let mode = 0; mode < 3; mode++) {
            Minimenu.objSelected = mode === 1 ? 1 : 0;
            Minimenu.targetMode = mode === 2;
            GameVariant.id = 1;
            for (let button = 0; button <= 6; button++) {
                widget.buttonType = button;
                Minimenu.AddComponent(1, 1, widget);
                capture();
            }
            Minimenu.AddNpcOptions(4, 8, 9, npc);
            capture();
            Minimenu.AddPlayerOptions(8, 4, 9, other);
            capture();
            await Minimenu.Build(0, 1, 10, 10, 1, 0);
            capture();
        }
        expect(rows).toEqual(reference);
    },
    45000,
    'gl'
);
