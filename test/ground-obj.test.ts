import OrbitCamera from '#/client/OrbitCamera.js';
import { receivePacket } from './receive-packet.js';
import SuperPacket from '#/io/SuperPacket.js';
import Protocol from '#/io/Protocol.js';
import ObjType from '#/config/ObjType.js';
import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import SoftwareFont from '#/graphics/SoftwareFont.js';
import LocalisedText from '#/ui/LocalisedText.js';
import { fromLiteral } from '#/datastruct/JagString.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import world from '#/dash3d/world.js';
import type Square from '#/dash3d/Square.js';
import type ModelSource from '#/dash3d/ModelSource.js';
import ClientObj from '#/dash3d/ClientObj.js';
import type ClientObjNode from '#/dash3d/ClientObjNode.js';
import type SharedPtrList from '#/datastruct/SharedPtrList.js';
import ZoneState from '#/game/ZoneState.js';
import PacketT from '#/io/PacketT.js';
import { requireNonNull } from '#/util/JavaArray.js';
import WrappedException from '#/util/WrappedException.js';
import { gamepackPath } from './reference.js';

test('qd mutations and ng pile ordering preserve original object identities across planes, value overflow and rebuilds', async () => {
    const dir = mkdtempSync(join(import.meta.dir, '../out/ground-obj-'));
    const old = { camera: OrbitCamera.mode, x: Protocol.zoneUpdateX, z: Protocol.zoneBaseZ, pid: Client.localPid, piles: Client.groundObj, squares: world.squares, level: Client.playerLevel };
    const oldRebuild = {
        x: Client.mapBuildBaseX,
        z: Client.mapBuildBaseZ,
        state: Client.gameState,
        players: Client.players.slice(),
        npcs: Client.npcs.slice(),
        local: Client.localPlayer,
        font: Client.p12,
        text: LocalisedText.loadingPleaseWait2,
        cx: Client.mapBuildCentreZoneX,
        cz: Client.mapBuildCentreZoneZ
    };
    const types = new Map<number, ObjType | null>();
    const commands: string[] = [];
    const trace: string[] = [];
    const zone = new ZoneState();
    const names = new Map<ClientObj, number>();

    const obj = (item: ModelSource | null): string => {
        if (item === null) return '-';
        if (!(item instanceof ClientObj)) throw new TypeError('Expected ground item');
        if (!names.has(item)) names.set(item, names.size + 1);
        return names.get(item) + '/' + item.id + '/' + item.count;
    };
    const refresh = () => {
        world.squares = Array.from({ length: 4 }, () => Array.from({ length: 104 }, () => new Array<Square | null>(104).fill(null)));
        for (let x = 0; x < 104; x++) for (let z = 0; z < 104; z++) Client.ShowObject(z, x);
    };
    const record = (command: string, status = 'ok', pos = -1) => {
        const lists: string[] = [],
            slots: string[] = [];
        for (let plane = 0; plane < 4; plane++) {
            for (let x = 0; x < 104; x++) {
                for (let z = 0; z < 104; z++) {
                    const list = Client.groundObj[plane][x][z],
                        key = [plane, x, z].join('/');
                    if (list !== null) {
                        const nodes: string[] = [];
                        for (let n = list.head(); n !== null; n = list.next()) nodes.push(obj(n.obj));
                        lists.push(key + ':' + nodes.join(','));
                    }
                    const display = requireNonNull(world.squares)[plane][x][z]?.groundObject;
                    if (display != null) slots.push(key + ':' + [obj(display.topObj), obj(display.middleObj), obj(display.bottomObj)].join(','));
                }
            }
        }
        commands.push(command);
        trace.push([status, pos, lists.join('|'), slots.join('|')].join(';'));
    };
    const packet = async (opcode: number, bytes: Uint8Array) => {
        const p = new SuperPacket(bytes.length);
        let result = 'ok';
        try {
            expect(await receivePacket(opcode, bytes, p)).toBe(true);
        } catch (err) {
            const cause = err instanceof WrappedException ? err.cause : err;
            if (cause instanceof RangeError) result = 'bounds';
            else if (cause instanceof TypeError) result = 'null';
            else throw err;
        }
        record(opcode + ' ' + Buffer.from(bytes).toString('hex'), result, p.m_pos);
    };
    const send = (opcode: number, encode: (p: PacketT) => void) => {
        const p = new PacketT(16);
        encode(p);
        return packet(opcode, requireNonNull(p.m_data).slice(0, p.m_pos));
    };
    const base = (x: number, z: number) =>
        send(26, p => {
            p.p1(-x);
            p.p1(z);
        });
    const add = (pos: number, id: number, count: number) =>
        send(33, p => {
            p.p2_alt1(id);
            p.p1(pos);
            p.p2_alt2(count);
        });
    const reveal = (pos: number, id: number, count: number, owner: number) =>
        send(135, p => {
            p.p2_alt3(owner);
            p.p1(-pos);
            p.p2_alt1(count);
            p.p2_alt1(id);
        });
    const update = (pos: number, id: number, from: number, to: number) =>
        send(14, p => {
            p.p1(pos);
            p.p2(id);
            p.p2(from);
            p.p2(to);
        });
    const remove = (pos: number, id: number) =>
        send(240, p => {
            p.p1_alt3(pos);
            p.p2(id);
        });
    const clear = (x: number, z: number) =>
        send(112, p => {
            p.p1(x);
            p.p1(-z);
        });

    try {
        Client.groundObj = Array.from({ length: 4 }, () => Array.from({ length: 104 }, () => new Array<SharedPtrList<ClientObjNode> | null>(104).fill(null)));
        Client.localPid = 73;
        Client.playerLevel = 0;
        Client.mapBuildBaseX = Client.mapBuildBaseZ = 0;
        Client.gameState = 25;
        Client.players.fill(null);
        Client.npcs.fill(null);
        Client.localPlayer = new ClientPlayer();
        Client.p12 = new SoftwareFont(new Uint8Array(257));
        LocalisedText.loadingPleaseWait2 = fromLiteral('');
        refresh();
        for (const [id, cost, stackable] of [
            [51, 12, 0],
            [52, 12, 0],
            [53, -99999999, 0],
            [54, 2147483647, 1],
            [55, -2147483648, 1],
            [56, 70000, 1],
            [57, 12, 1]
        ]) {
            const type = new ObjType();
            types.set(id, ObjType.types.Find(BigInt(id)));
            type.id = id;
            type.cost = cost;
            type.stackable = stackable;
            ObjType.types.Put(BigInt(id), type);
            record(['type', id, cost, stackable].join(' '));
        }
        await base(32, 40);
        for (let plane = 0; plane < 4; plane++) {
            Client.playerLevel = plane;
            record('plane ' + plane);
            await add(0x35, 53, 0);
            await add(0x35, 51, 3);
            await add(0x35, 52, 2);
            await add(0x35, 51, 1);
            await add(0x35, 55, 1);
            await reveal(0x35, 57, 60000, 73);
            await reveal(0x35, 54, 1, 74);
            await add(0x35, 56, 65535);
            await update(0x35, 0x8000 | 54, 1, 0);
            await remove(0x35, 0x8000 | 51);
            await add(0x04, 57, plane);
            await remove(0x05, 57);
        }
        await packet(240, Uint8Array.of(0x45));
        await packet(14, Uint8Array.of(0x35, 0, 55, 0, 1, 0));
        await base(102, 102);
        await add(0x11, 52, 0);
        await add(0x22, 52, 1);
        await clear(103, 103);
        await base(0, 0);
        await add(0, 54, 1);
        await clear(0, 0);
        for (const [x, z] of [
            [8, 8],
            [-8, 16],
            [0, -8],
            [8, 0],
            [240, 240]
        ]) {
            Client.StartRebuild(Client.playerLevel, (z >> 3) + 6, 0, (x >> 3) + 6, 0, false);
            zone.clearScene();
            record('shift ' + x + ' ' + z);
            refresh();
            record('refresh');
        }
        const compile = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game/GroundObjOracle.java')]);
        expect(compile.stderr.toString()).toBe('');
        const jvm = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'GroundObjOracle'], {
            stdin: Buffer.from(commands.join('\n') + '\n'),
            timeout: 25000
        });
        expect(jvm.stderr.toString()).toBe('');
        expect(jvm.exitCode).toBe(0);
        const expected = jvm.stdout.toString().trimEnd().split(/\r?\n/);
        expect(expected.length).toBe(trace.length);
        for (let i = 0; i < expected.length; i++) expect(trace[i], commands.slice(0, i + 1).join('\n')).toBe(expected[i]);
    } finally {
        Object.assign(Client, { mapBuildBaseX: oldRebuild.x, mapBuildBaseZ: oldRebuild.z, gameState: oldRebuild.state, localPlayer: oldRebuild.local });
        Object.assign(Client.players, oldRebuild.players);
        Object.assign(Client.npcs, oldRebuild.npcs);
        Client.mapBuildCentreZoneX = oldRebuild.cx;
        Client.mapBuildCentreZoneZ = oldRebuild.cz;
        Client.p12 = oldRebuild.font;
        LocalisedText.loadingPleaseWait2 = oldRebuild.text;
        OrbitCamera.mode = old.camera;
        Client.localPid = old.pid;
        Protocol.zoneUpdateX = old.x;
        Protocol.zoneBaseZ = old.z;
        Client.groundObj = old.piles;
        world.squares = old.squares;
        Client.playerLevel = old.level;
        for (const [id, type] of types) {
            if (type === null) ObjType.types.Remove(BigInt(id));
            else ObjType.types.Put(BigInt(id), type);
        }
        rmSync(dir, { recursive: true });
    }
}, 30000);
