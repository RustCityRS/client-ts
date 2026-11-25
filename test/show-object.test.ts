import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';
import Client from '#/client/Client.js';
import ClientBuild from '#/client/ClientBuild.js';
import Protocol from '#/io/Protocol.js';
import SuperPacket from '#/io/SuperPacket.js';
import ObjType from '#/config/ObjType.js';
import ClientNpc from '#/dash3d/ClientNpc.js';
import ClientObj from '#/dash3d/ClientObj.js';
import ClientObjNode from '#/dash3d/ClientObjNode.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import GroundObject from '#/dash3d/GroundObject.js';
import ModelSource from '#/dash3d/ModelSource.js';
import Sprite from '#/dash3d/Sprite.js';
import Square from '#/dash3d/Square.js';
import world from '#/dash3d/world.js';
import Linkable from '#/datastruct/Linkable.js';
import SharedPtrList from '#/datastruct/SharedPtrList.js';
import SceneCutover from '#/scene/SceneCutover.js';
import { requireNonNull } from '#/util/JavaArray.js';
import WrappedException from '#/util/WrappedException.js';
import { JavaError, JavaCheckedException } from '#/util/JavaException.js';
import { gamepackPath } from './reference.js';
import { loginFixture } from './login-fixture.js';
import { supplyPacket } from './receive-packet.js';

type Vector = [pile: number, geometry: number, level: number, planeRead: number, x: number, z: number, spriteMask: number, minY: number];

function vectors(instrumented: boolean): Vector[] {
    const result: Vector[] = [];
    if (instrumented) {
        for (const pile of [0, 2, 3, 4]) for (const geometry of [0, 1, 3, 8, 17, 23, 24]) for (const level of [0, 2, 3]) for (let read = 0; read <= 7; read++) result.push([pile, geometry, level, read, 1, 4, 15, -138]);
    } else {
        for (let pile = 0; pile < 10; pile++) for (let geometry = 0; geometry <= 26; geometry++) for (const level of [0, 1, 3]) result.push([pile, geometry, level, -1, 3, 4, geometry === 15 ? 14 : 15, -149]);
        for (const h of [-2147483648, -32769, -32768, -32767, -49, -27, -1, 0, 1, 2147483647]) for (let mask = 0; mask < 16; mask++) result.push([3, 0, 1, -1, 2, 5, mask, h]);
        // The signed int key crosses 2^31 when z reaches 4,194,304. Allocate a real row for this tile in both VMs.
        for (const z of [4194303, 4194304]) result.push([3, 0, 1, -1, 3, z, 15, -53]);
        for (const x of [0, 103, 104]) for (const z of [0, 103, 104]) result.push([2, 1, 1, -1, x, z, 15, -11]);
        for (const geometry of [27, 28, 29]) result.push([3, geometry, 1, -1, 3, 4, 15, -53]);
    }
    return result;
}

loginFixture(
    import.meta.url,
    'ShowObject writes original native ground stacks, scene identities, bridge heights and signed keys',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), '530-show-object-'));
        const savedCutover = SceneCutover.native;
        try {
            SceneCutover.native = true;
            const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
            const cc = Bun.spawnSync(['javac', asm, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game/ShowObjectOracle.java')]);
            expect(cc.exitCode, cc.stderr.toString()).toBe(0);
            const java = ['java', asm, '-Xmx256m', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'ShowObjectOracle'];
            const costs = [73, 12, 17, 13, -99999999, 73];
            for (const [i, cost] of costs.entries()) {
                const type = new ObjType();
                type.cost = cost;
                type.stackable = i === 1 || i === 3 ? 1 : 0;
                ObjType.types.Put(BigInt(100 + i), type);
            }
            const packets: [number, Buffer][] = [];
            for (const [op, hex] of [
                [33, '6500340083'],
                [14, '34006400010007'],
                [240, '4c0064'],
                [135, '8200cc03006500']
            ] as const) {
                const bytes = Buffer.from(hex, 'hex');
                packets.push([op, bytes], [230, Buffer.concat([Uint8Array.of(128, 128, op), bytes])]);
            }
            packets.push([112, Buffer.from([0, 0])]);
            const packetJava = Bun.spawnSync([...java, 'packet'], { stdin: Buffer.from(packets.map(([op, wire]) => op + ' ' + wire.toString('hex')).join('\n') + '\n') });
            expect(packetJava.exitCode, packetJava.stderr.toString()).toBe(0);
            const packetRows = packetJava.stdout.toString().trimEnd().split(/\r?\n/);
            expect(packetRows.length).toBe(packets.length);
            for (const [row, [op, wire]] of packets.entries()) {
                Client.playerLevel = 1;
                Client.localPid = 1;
                Protocol.zoneUpdateX = Protocol.zoneBaseZ = 0;
                world.squares = null;
                world.levelHeightmaps = null;
                Client.groundObj = Array.from({ length: 4 }, () => Array.from({ length: 104 }, () => new Array<SharedPtrList<ClientObjNode> | null>(104).fill(null)));
                const list = (Client.groundObj[1][3][4] = new SharedPtrList<ClientObjNode>());
                const obj = new ClientObj();
                obj.id = 100;
                obj.count = 1;
                list.push_back(new ClientObjNode(obj));
                supplyPacket(op, wire, new SuperPacket(wire.length));
                let context = '';
                try {
                    await Protocol.TcpIn();
                } catch (error) {
                    if (!(error instanceof WrappedException) || !(error.cause instanceof TypeError)) throw error;
                    context = String(error.context);
                }
                const items: string[] = [];
                for (let n = list.head(); n !== null; n = list.next()) items.push(n.obj.id + ':' + n.obj.count);
                expect([context, Protocol.inPacket.m_pos, Protocol.packetType, list === Client.groundObj[1][3][4], items.join(',')].join('|'), op + ' ' + wire.toString('hex')).toBe(packetRows[row]);
            }
            let active = false,
                readMode = -1,
                reads = 0,
                trace = '',
                level = 0,
                geometry = 0,
                x = 0,
                z = 0;
            Object.defineProperty(Client, 'playerLevel', {
                configurable: true,
                set(value: number) {
                    level = value;
                },
                get() {
                    const before = level;
                    if (active && readMode !== -1) {
                        trace += 'p' + before + ';';
                        const read = ++reads;
                        if ((readMode === 1 && read === 1) || (readMode === 2 && read === 2) || (readMode === 4 && read === 3)) level = (before + 1) & 3;
                        if (readMode === 3 && read === 2) level = -1;
                        if (readMode === 4 + read) throw Error('probe');
                    }
                    return before;
                }
            });
            const initial: (Square | null)[] = [],
                replacements: (Square | null)[] = [],
                oldPile: (GroundObject | null)[] = [];
            const objects = new Map<ModelSource, number>();
            const root = new Error('observer');
            let injected: Error | null = null;
            class Observer extends ModelSource {
                constructor(private p: number) {
                    super();
                }
                draw(): void {}
                update(): void {}
                getMinY(): number {
                    trace += 'm' + this.p + ';';
                    const grid = requireNonNull(world.squares),
                        tile = requireNonNull(initial[this.p]);
                    if (geometry === 17) grid[this.p][x][z] = replacements[this.p];
                    if (geometry === 18) grid[this.p][x][z] = null;
                    if (geometry === 19) Reflect.set(grid[this.p], x, null);
                    if (geometry === 21) tile.sprites = [null];
                    if (geometry === 22) tile.spriteCount = 0;
                    if (geometry === 23) throw Error('probe');
                    if (geometry === 27) throw (injected = WrappedException.wrap(root, 'model'));
                    if (geometry === 28) throw (injected = new JavaCheckedException('observer'));
                    if (geometry === 29) throw (injected = new JavaError('observer'));
                    return -27;
                }
            }
            const id = (o: ModelSource | null) => (o === null ? -1 : (objects.get(o) ?? -2));
            function stack(p: number, obj: GroundObject | null): string {
                return obj === null ? '~' : [obj === oldPile[p] ? 'old' : 'new', obj.typecode, obj.x, obj.z, obj.y, obj.height, id(obj.topObj), id(obj.middleObj), id(obj.bottomObj)].join(',');
            }
            function square(p: number): string {
                const column = world.squares?.[p]?.[x];
                if (column == null || column.length <= z) return '!';
                const tile = column[z];
                if (tile === null) return '~';
                return [tile === initial[p] ? 'initial' : tile === replacements[p] ? 'replacement' : 'new', tile.level, tile.originalLevel, tile.x, tile.z, tile.spriteCount, stack(p, tile.groundObject)].join(',');
            }
            function makePile(kind: number): SharedPtrList<ClientObjNode> | null {
                if (kind === 0) return null;
                const list = new SharedPtrList<ClientObjNode>();
                const ids = kind === 1 ? [] : kind === 2 ? [0] : kind === 4 ? [4, 4] : kind === 5 ? [2, 3, 1, 2] : kind === 8 ? [0, 5, 3, 1] : [1, 1, 3, 0, 2, 0];
                let first: ClientObj | null = null;
                for (const [i, type] of ids.entries()) {
                    let obj = new ClientObj();
                    obj.id = 100 + type;
                    obj.count = i === 1 ? 2147483647 : i;
                    if (kind === 9 && i === 1) obj = requireNonNull(first);
                    if (!objects.has(obj)) objects.set(obj, i);
                    if (i === 0) first = obj;
                    const node = new ClientObjNode(obj);
                    if (kind === 7 && i === 3) Reflect.set(node, 'obj', null);
                    list.push_back(node);
                }
                if (kind === 6) Reflect.apply(list.push_back, list, [new Linkable()]);
                return list;
            }
            function order(list: SharedPtrList<ClientObjNode> | null): string {
                if (list === null) return '~';
                const nodes: (number | string)[] = [];
                for (let n = list.head(); n !== null; n = list.next()) nodes.push(n instanceof ClientObjNode ? id(n.obj) : 'wrong');
                return nodes.join(',');
            }
            for (const probed of [false, true]) {
                if (probed) {
                    const prep = Bun.spawnSync([...java, gamepackPath, dir]);
                    expect(prep.exitCode, prep.stderr.toString()).toBe(0);
                }
                const rows = vectors(probed);
                const guards = [72, 51, 106, -126, -110, -103, 121];
                const result = Bun.spawnSync(java, { stdin: Buffer.from(rows.map((row, i) => [...row, guards[i % guards.length]].join(' ')).join('\n') + '\n'), maxBuffer: 5 * 1024 * 1024 });
                expect(result.exitCode, result.stderr.toString()).toBe(0);
                const expected = result.stdout.toString().trimEnd().split(/\r?\n/);
                expect(expected.length).toBe(rows.length);
                for (const [i, v] of rows.entries()) {
                    const [kind, shape, startingLevel, probe, tx, tz, mask, minY] = v;
                    x = tx;
                    z = tz;
                    geometry = shape;
                    level = startingLevel;
                    readMode = probe;
                    trace = '';
                    reads = 0;
                    objects.clear();
                    injected = null;
                    const list = makePile(kind);
                    Client.groundObj = Array.from({ length: 4 }, () => new Array(x + 1).fill(null));
                    const grid = (world.squares = Array.from({ length: 4 }, () => new Array<(Square | null)[]>(x + 1).fill([])));
                    const large = z > 104;
                    for (let p = 0; p < 4; p++) {
                        initial[p] = replacements[p] = null;
                        oldPile[p] = null;
                        if (large && p !== level) continue;
                        Client.groundObj[p][x] = new Array(z + 1);
                        grid[p][x] = new Array(z + 1);
                        Client.groundObj[p][x][z] = p === level ? list : null;
                        const tile = (initial[p] = new Square(p, x, z));
                        replacements[p] = new Square(p, x, z);
                        grid[p][x][z] = tile;
                        const old = (oldPile[p] = new GroundObject());
                        old.typecode = -912n - BigInt(p);
                        old.height = 97 + p;
                        tile.groundObject = old;
                        const player = new ClientPlayer(),
                            npc = new ClientNpc(),
                            high = new ClientNpc();
                        player.modelMinY = minY;
                        npc.modelMinY = -32768;
                        high.modelMinY = 127;
                        const models = [new Observer(p), npc, high, player];
                        for (let j = 0; j < 4; j++) {
                            const sprite = (tile.sprites[j] = new Sprite());
                            sprite.typecode = (j === 2 ? -9223372036854775808n : 0n) | ((mask & (1 << j)) !== 0 ? 4194304n : 32n);
                            sprite.model = models[j];
                        }
                        tile.spriteCount = 4;
                        switch (shape) {
                            case 10:
                                grid[p][x][z] = null;
                                break;
                            case 11:
                                tile.groundObject = null;
                                break;
                            case 12:
                                tile.spriteCount = 0;
                                break;
                            case 13:
                                tile.sprites[1] = null;
                                break;
                            case 14:
                            case 15:
                                requireNonNull(tile.sprites[0]).model = null;
                                break;
                            case 16:
                                tile.spriteCount = 6;
                                break;
                        }
                    }
                    if (large) {
                        world.levelHeightmaps = [];
                        ClientBuild.m_mapl = null;
                    } else {
                        const heights = (world.levelHeightmaps = Array.from({ length: 4 }, () => Array.from({ length: x + 2 }, () => new Int32Array(z + 2))));
                        const flags = (ClientBuild.m_mapl = Array.from({ length: 4 }, () => Array.from({ length: x + 1 }, () => new Uint8Array(z + 1))));
                        for (let p = 0; p < 4; p++) for (let a = 0; a <= 1; a++) for (let b = 0; b <= 1; b++) heights[p][x + a][z + b] = (p - 1) * 127751 + (a === b ? 5 : -39212) + a * 170 - b * 91;
                        if (shape === 1 || shape === 24) flags[1][x][z] = 2;
                        if (shape === 24)
                            for (let p = 0; p < 4; p++) {
                                heights[p][x][z] = -2147483648;
                                heights[p][x + 1][z + 1] = 2147483647;
                            }
                        if (shape === 2) world.levelHeightmaps = null;
                        if (shape === 3 || shape === 7) ClientBuild.m_mapl = null;
                        if (shape === 4) Reflect.set(heights, level, null);
                        if (shape === 5) Reflect.set(heights[level], x, null);
                        if (shape === 6) heights[level][x + 1] = new Int32Array(z);
                        if (shape === 20) flags[1][x] = new Uint8Array(z);
                    }
                    if (shape === 8) world.squares = null;
                    if (shape === 9) Reflect.set(grid[level], x, null);
                    if (shape === 25) Reflect.set(Client, 'groundObj', null);
                    if (shape === 26) Reflect.set(Client.groundObj[level], x, null);
                    let fault = 'ok',
                        context = '';
                    active = true;
                    try {
                        const guard = guards[i % guards.length];
                        if (guard === 72) Client.ShowObject(z, x);
                        else Client.ShowObject(z, x, undefined, guard);
                    } catch (error) {
                        const e = error instanceof WrappedException ? error.cause : error;
                        if (error instanceof WrappedException) context = String(error.context);
                        if (geometry === 27) expect(e).toBe(root);
                        fault =
                            error === injected ? 'same' : e instanceof TypeError ? (e.message.includes('ClassCastException') ? 'cast' : 'null') : e instanceof RangeError ? 'bounds' : e instanceof Error && e.message === 'probe' ? 'probe' : String(e);
                    } finally {
                        active = false;
                    }
                    const state = [fault, context, trace, level, order(list)];
                    for (let p = 0; p < 4; p++) {
                        const before = initial[p];
                        state.push(square(p), before === null ? '!' : stack(p, before.groundObject));
                    }
                    expect(state.join('|'), v.join(' ')).toBe(expected[i]);
                }
            }
            for (const native of [false, true]) {
                SceneCutover.native = native;
                Client.playerLevel = 0;
                Client.groundObj = [[[null]]];
                world.squares = null;
                const removals: number[][] = [];
                Client.ShowObject(0, 0, {
                    DelObj(plane, x, z) {
                        removals.push([plane, x, z]);
                    },
                    SetObj() {
                        throw new Error('unexpected placement on an empty tile');
                    }
                });
                expect(removals).toEqual([[0, 0, 0]]);
            }
        } finally {
            SceneCutover.native = savedCutover;
            rmSync(dir, { recursive: true, force: true });
        }
    },
    60000
);
