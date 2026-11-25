import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import ClientMouseListener from '#/client/ClientMouseListener.js';
import GameVariant from '#/client/GameVariant.js';
import ObjType from '#/config/ObjType.js';
import ClientObj from '#/dash3d/ClientObj.js';
import ClientObjNode from '#/dash3d/ClientObjNode.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import CollisionMap from '#/dash3d/CollisionMap.js';
import ModelLit from '#/dash3d/ModelLit.js';
import { fromJsString } from '#/datastruct/JagString.js';
import SharedPtrList from '#/datastruct/SharedPtrList.js';
import IfType from '#/ui/IfType.js';
import Minimenu from '#/ui/Minimenu.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { loginFixture } from '../login-fixture.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

loginFixture(
    import.meta.url,
    'HD ground items dispatch from the mouse loop with original menu IDs, route and action bytes',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'hd-ground-item-menu-'));
        try {
            const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
            const build = Bun.spawnSync(['javac', '-d', dir, '-cp', cp, join(import.meta.dir, 'HdGroundItemMenuOracle.java')]);
            expect(build.exitCode, build.stderr.toString()).toBe(0);
            const oracle = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', cp, 'HdGroundItemMenuOracle']);
            expect(oracle.exitCode, oracle.stderr.toString()).toBe(0);
            const reference = oracle.stdout.toString().trim().split(/\r?\n/);
            const x = 37,
                z = 62,
                id = 0x95bc;
            const player = (Client.localPlayer = new ClientPlayer());
            player.pathX[0] = x - 3;
            player.pathZ[0] = z - 2;
            const map = (CollisionMap.levelMaps[0] = new CollisionMap(104, 104));
            for (const row of map.flags) row.fill(0);
            Client.mapBuildBaseX = 3072;
            Client.mapBuildBaseZ = 3168;
            IfType.m_list = [[null, new IfType(), new IfType()]];
            IfType.m_open = [true];
            const name = fromJsString('Arrow'),
                item = Object.assign(new ObjType(), { id, name });
            ObjType.types.Put(BigInt(id), item);
            const pile = (Client.groundObj[0][x][z] = new SharedPtrList<ClientObjNode>());
            pile.push_back(new ClientObjNode(Object.assign(new ClientObj(), { id })));
            ModelLit.pickedTypecodes = BigInt64Array.of(BigInt((3 << 29) | (z << 7) | x));
            ModelLit.pickedCount = 1;
            const menu = Minimenu;
            for (let variant = 0; variant <= 1; variant++) {
                for (let op = 0; op < 8; op++) {
                    GameVariant.id = variant;
                    item.groundOps = new Array(5).fill(null);
                    if (op < 5) item.groundOps[op] = name;
                    Object.assign(menu, {
                        objSelected: op === 5 ? 1 : 0,
                        targetMode: op === 6,
                        targetFlags: 1,
                        targetParam: -1,
                        objComponent: 1,
                        objId: 0x8123,
                        objSlot: 0x4567,
                        targetComponent: 2,
                        targetChild: -1,
                        objName: name,
                        targetName: name,
                        targetVerb: name,
                        count: 0,
                        isOpen: false
                    });
                    await menu.Build(0, 25, 100, 100, 25, 0);
                    menu.Sort();
                    const selected = Array.from(menu.keys.subarray(0, menu.count)).findIndex((key, i) => key === BigInt(id) && (op === 7) === (menu.actions[i] === 1002));
                    expect(selected).toBeGreaterThanOrEqual(0);
                    if (op !== 7) expect(selected).toBe(menu.count - 1);
                    const row = [menu.actions[selected], menu.keys[selected], menu.paramB[selected], menu.paramC[selected]].join(',');
                    menu.deferred = 0;
                    ClientMouseListener.clickButton = 1;
                    ClientMouseListener.clickX = menu.mouseX = 50;
                    ClientMouseListener.clickY = menu.mouseY = 30;
                    if (op === 7) {
                        menu.isOpen = true;
                        menu.x = menu.y = 0;
                        menu.width = 100;
                        ClientMouseListener.clickY = 31 + 15 * (menu.count - 1 - selected);
                    }
                    menu.crossMode = 0;
                    menu.crossTicks = 45;
                    menu.crossX = menu.crossY = -1;
                    const packet = Client.out;
                    packet.m_data = new Uint8Array(128);
                    packet.m_pos = 0;
                    packet.SetEnc(Int32Array.of(1, 22, 4, 8));
                    await menu.GameLoop();
                    const bytes = Buffer.from(requireNonNull(packet.m_data).subarray(0, packet.m_pos)).toString('hex');
                    const cross = [menu.crossMode, menu.crossTicks, menu.crossX, menu.crossY, menu.objDragComponent === null].join(',');
                    expect(`${variant}/${op} ${row} ${bytes} ${cross}`).toBe(reference[variant * 8 + op]);
                }
            }
            expect(reference).toHaveLength(16);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    30000,
    'gl'
);
