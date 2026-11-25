import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import LocType from '#/config/LocType.js';
import SeqType from '#/config/SeqType.js';
import LRUHashCache from '#/datastruct/LRUHashCache.js';
import ClientLocAnim from '#/dash3d/ClientLocAnim.js';
import LocChange from '#/dash3d/LocChange.js';
import Decor from '#/dash3d/Decor.js';
import GroundDecor from '#/dash3d/GroundDecor.js';
import ModelLitImpl from '#/dash3d/ModelLitImpl.js';
import type ModelSource from '#/dash3d/ModelSource.js';
import Sprite from '#/dash3d/Sprite.js';
import Square from '#/dash3d/Square.js';
import Wall from '#/dash3d/Wall.js';
import world from '#/dash3d/world.js';
import Protocol from '#/io/Protocol.js';
import SuperPacket from '#/io/SuperPacket.js';
import SceneCutover from '#/scene/SceneCutover.js';
import WrappedException from '#/util/WrappedException.js';
import { supplyPacket } from './receive-packet.js';
import { gamepackPath } from './reference.js';

test('qk.a and its two wire handlers preserve animation frames, tile identities and partial attachments', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rs530-loc-attach-'));
    const old = {
        squares: world.squares,
        seqs: SeqType.m_recentUse,
        types: LocType.m_recentUse,
        sequencesArchive: SeqType.m_pConfigClient,
        locsArchive: LocType.m_pConfigClient,
        cycle: Client.loopCycle,
        level: Client.playerLevel,
        baseX: Client.mapBuildBaseX,
        baseZ: Client.mapBuildBaseZ,
        stream: Client.stream,
        native: SceneCutover.native,
        scene: LocChange.scene,
        attach: Client.attachLocAnim
    };
    const savedProtocol = {
        inPacket: Protocol.inPacket,
        packetType: Protocol.packetType,
        packetSize: Protocol.packetSize,
        idleReads: Protocol.idleReads,
        ptype1: Protocol.ptype1,
        ptype2: Protocol.ptype2,
        lastPacketType0: Protocol.lastPacketType0,
        zoneUpdateX: Protocol.zoneUpdateX,
        zoneBaseZ: Protocol.zoneBaseZ
    };
    try {
        const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
        const compile = Bun.spawnSync(['javac', asm, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game/LocAttachOracle.java')]);
        expect(compile.exitCode, compile.stderr.toString()).toBe(0);
        const cases: number[][] = [];
        const add = (layer: number, shape: number, angle: number, seq = 7, x = 38, z = 76, level = 1, mode = 0, variant = 0) => cases.push([layer, shape, angle, seq, x, z, level, mode, variant]);
        for (const layer of [-1, 0, 1, 2, 3, 4])
            for (const shape of [-1, 0, 2, 4, 5, 6, 7, 8, 9, 10, 11, 22, 63]) {
                for (const angle of [-1, 0, 1, 2, 3, 4, 2147483647, -2147483648]) add(layer, shape, angle);
            }
        for (const [layer, shape] of [
            [0, 2],
            [0, 1],
            [1, 8],
            [1, 7],
            [2, 11],
            [3, 22]
        ]) {
            for (const seq of [-1, 7, 8, 9, 10]) for (let mode = 0; mode < 17; mode++) add(layer, shape, 3, seq, 38, 76, 2, mode, mode % 3);
        }
        for (const layer of [0, 1, 2, 3, 4])
            for (const mode of [0, 10, 11, 12, 13]) {
                for (const [x, z, level] of [
                    [-1, 38, 5],
                    [1, -1, -1],
                    [0, 0, 0],
                    [102, 102, 3],
                    [103, 1, 4],
                    [1, 103, 4],
                    [104, 104, -1],
                    [2147483647, 0, 4],
                    [0, -2147483648, -1],
                    [0, 1, -1],
                    [2, 3, 4]
                ]) {
                    add(layer, layer === 0 ? 2 : 8, 1, 7, x, z, level, mode, 2);
                }
            }
        const direct = cases.length;
        function addPacket(op: number, shape: number, angle: number, seq: number, x: number, z: number, level: number, mode: number, length?: number) {
            const info = (shape << 2) | angle,
                position = (level << 28) | ((3200 + x) << 14) | (6400 + z);
            let wire: number[];
            if (op === 235) wire = [128 - info, seq >> 8, seq, position >> 24, position >> 16, position >> 8, position];
            else {
                wire = [128 - 0x35, 128 - info, seq, seq >> 8];
                if (op === 230) wire.unshift(z - 5 + 128, 128 - (x - 3), 20);
            }
            const layer = shape < 4 ? 0 : shape < 9 ? 1 : shape < 22 ? 2 : 3;
            cases.push([layer, shape, angle, seq, x, z, level, mode, mode % 3, op, ...wire.slice(0, length).map(b => b & 255)]);
        }
        for (const op of [20, 230, 235]) {
            for (let shape = 0; shape < 23; shape++)
                for (let angle = 0; angle < 4; angle++) {
                    addPacket(op, shape, angle, [-1, 7, 8, 9][angle], 38, 76, (shape + angle) & 3, angle);
                }
            for (const [shape, x, z] of [
                [2, 38, 76],
                [8, 38, 76],
                [11, 102, 102],
                [22, 103, 76],
                [7, 38, 103],
                [63, 38, 76]
            ]) {
                for (const mode of [0, 7, 8, 9, 10, 11, 14, 15, 16]) addPacket(op, shape, 3, 7, x, z, 2, mode);
            }
            if (op !== 230)
                for (const [x, z] of [
                    [-1, 0],
                    [0, -1],
                    [0, 0],
                    [104, 104]
                ])
                    addPacket(op, 2, 0, 7, x, z, 2, 10);
            for (const shape of [2, 8, 63]) for (let n = 0; n <= (op === 20 ? 4 : 7); n++) addPacket(op, shape, 1, 7, 38, 76, 1, 4, n);
        }
        const java = ['java', asm, '-XX:-OmitStackTraceInFastThrow', '-cp', dir + delimiter + gamepackPath, 'LocAttachOracle'];
        const output = Bun.spawnSync(java, {
            stdin: Buffer.from(cases.map(v => v.join(' ')).join('\n') + '\n'),
            maxBuffer: 8 * 1024 * 1024
        });
        expect(output.exitCode, output.stderr.toString()).toBe(0);
        const lines = output.stdout.toString().trimEnd().split(/\r?\n/);
        expect(lines.length).toBe(cases.length);
        const probe = join(dir, 'observed');
        mkdirSync(probe);
        const prepare = Bun.spawnSync([...java, gamepackPath, probe]);
        expect(prepare.exitCode, prepare.stderr.toString()).toBe(0);
        const observed = Bun.spawnSync(['java', asm, '-XX:-OmitStackTraceInFastThrow', '-cp', probe + delimiter + dir + delimiter + gamepackPath, 'LocAttachOracle'], {
            stdin: Buffer.from(
                cases
                    .slice(direct)
                    .map(v => v.join(' '))
                    .join('\n') + '\n'
            ),
            maxBuffer: 8 * 1024 * 1024
        });
        expect(observed.exitCode, observed.stderr.toString()).toBe(0);
        const entries = observed.stdout.toString().trimEnd().split(/\r?\n/);
        expect(entries.length).toBe(cases.length - direct);
        const tiles = Array.from({ length: 4 }, () => Array.from({ length: 104 }, () => Array<Square | null>(104).fill(null)));
        Reflect.set(LocType, 'm_recentUse', new LRUHashCache<LocType>(64));
        SeqType.m_recentUse = new LRUHashCache<SeqType>(64);
        SeqType.m_pConfigClient = null;
        LocType.m_pConfigClient = null;
        function sequence(id: number, behaviour: number, length: number): SeqType {
            const type = new SeqType();
            type.id = id;
            type.m_duplicateBehaviour = behaviour;
            type.frames = length < 0 ? null : new Int32Array(length);
            type.m_loops = 3;
            SeqType.m_recentUse.Put(BigInt(id), type);
            return type;
        }
        const same = sequence(7, 0, 4),
            fresh = sequence(8, 2, 1);
        sequence(9, 0, -1);
        const plain = new ModelLitImpl();
        const first = new ClientLocAnim(54, 3, 1, 0, 2, 6, 7, false, plain);
        const second = new ClientLocAnim(55, 3, 1, 0, 2, 6, 7, false, plain);
        Object.assign(first, { nextFrame: 2, cycle: 473, frame: 1, frameCycle: 15 });
        Object.assign(second, { nextFrame: 3, cycle: 865, frame: 2, frameCycle: 17 });
        function model(value: ModelSource | null): string {
            if (value === null) return '~';
            if (value === plain) return 'p';
            if (value === first) return 'a';
            if (value === second) return 'b';
            if (!(value instanceof ClientLocAnim)) throw new Error('Unexpected model class');
            const seq = value['seq'];
            return [
                value['index'],
                value['shape'],
                value['angle'],
                value['level'],
                value['x'],
                value['z'],
                seq === null ? '-' : seq === same ? 's' : seq === fresh ? 'f' : '?',
                value['nextFrame'],
                value['cycle'],
                value['frame'],
                value['frameCycle'],
                value['hasMulti'],
                value['minY']
            ].join(',');
        }
        for (const [index, v] of cases.entries()) {
            const [layer, shape, angle, seq, x, z, level, mode, variant] = v;
            const id = (i: number) => (variant === 0 ? 0x73123450 + i : variant === 1 ? i : 0x7fffffff - i);
            const key = (i: number) => BigInt.asIntN(64, ((BigInt(id(i)) | 0x80000000n) << 32n) | 0x40034142n);
            Client.loopCycle = variant === 2 ? -2147483648 : 579;
            LocType.m_recentUse.Reset();
            if (mode !== 7)
                for (let i = 0; i < 4; i++) {
                    const loc = new LocType();
                    loc.id = id(i);
                    if (mode !== 5) loc.multi = Int32Array.of(54, -1);
                    LocType.m_recentUse.Put(BigInt(loc.id), loc);
                }
            world.squares = tiles;
            const p = Math.max(0, Math.min(3, level)),
                tx = Math.max(0, Math.min(103, x)),
                tz = Math.max(0, Math.min(103, z));
            const tile = (tiles[p][tx][tz] = new Square(p, tx, tz));
            const wall = (tile.wall = new Wall()),
                decor = (tile.decor = new Decor()),
                sprite = new Sprite(),
                ground = (tile.groundDecor = new GroundDecor());
            wall.typecode = key(0);
            decor.typecode = key(1);
            sprite.typecode = key(2);
            ground.typecode = key(3);
            sprite.minTileX = tx;
            sprite.minTileZ = tz;
            let a: ModelSource | null = first,
                b: ModelSource | null = second;
            if (mode === 1) a = b = plain;
            if (mode === 2 || mode === 5) a = b = null;
            if (mode === 3) a = b = first;
            if (mode === 4 || mode === 7) b = null;
            wall.model1 = decor.model = sprite.model = ground.model = a;
            wall.model2 = decor.model2 = b;
            const distract = new Sprite(),
                category = new Sprite();
            distract.minTileX = tx + 1;
            distract.minTileZ = tz;
            distract.typecode = sprite.typecode;
            distract.model = plain;
            category.minTileX = tx;
            category.minTileZ = tz;
            category.typecode = 0x20000000n;
            category.model = plain;
            tile.sprites[0] = distract;
            tile.sprites[1] = category;
            tile.sprites[2] = sprite;
            tile.spriteCount = 3;
            switch (mode) {
                case 8:
                    tile.wall = null;
                    tile.decor = null;
                    tile.groundDecor = null;
                    tile.spriteCount = 2;
                    break;
                case 9:
                    tiles[p][tx][tz] = null;
                    break;
                case 10:
                    world.squares = null;
                    break;
                case 11:
                    world.squares = [];
                    break;
                case 12:
                    Reflect.set(world, 'squares', [null, null, null, null]);
                    break;
                case 13:
                    world.squares = Array.from({ length: 4 }, () => Array.from({ length: 104 }, () => []));
                    break;
                case 14:
                    tile.sprites[1] = null;
                    break;
                case 15:
                    tile.sprites.fill(distract);
                    tile.spriteCount = 6;
                    break;
                case 16:
                    Reflect.set(tile, 'sprites', null);
                    break;
            }
            const models = () =>
                [model(wall.model1), model(wall.model2), model(decor.model), model(decor.model2), model(sprite.model), model(ground.model), model(distract.model), model(category.model), wall.model1 === wall.model2, decor.model === decor.model2].join(
                    '/'
                );
            function fault(error: unknown): string {
                const e = error instanceof WrappedException ? error.cause : error;
                const context = error instanceof WrappedException ? String(error.context) : '';
                if (e instanceof TypeError) return 'null~' + context;
                if (e instanceof RangeError) return 'bounds~' + context;
                throw error;
            }
            // ClientLocAnim and its renderer-owned config lookups explicitly omit these three catch contexts.
            const expectedLine = lines[index].replace(/(?:ke\.O\(11525,-?\d+\)|tb\.J\(-?\d+,-32\)|ml\.<init>\([-\d,]+false,(?:null|\{\.\.\.\})\)) /g, '');
            if (index < direct) {
                let status = 'ok~';
                try {
                    Client.attachLocAnim(x, angle, seq, z, shape, level, layer);
                } catch (e) {
                    status = fault(e);
                }
                expect(status + '/' + models(), v.join(' ')).toBe(expectedLine);
                continue;
            }
            const op = v[9],
                wire = Uint8Array.from(v.slice(10)),
                before = models();
            const entry = entries[index - direct],
                split = entry.lastIndexOf('|'),
                trace = entry.slice(split + 1);
            expect(entry.slice(0, split + 1), v.join(' ')).toBe(lines[index]);
            const [expectedModels, expectedCursor, expectedOpcode] = expectedLine.split('|');
            const expectedFault = expectedModels.split('/')[0];
            for (const native of [false, true]) {
                SceneCutover.native = native;
                const calls: string[] = [];
                if (native) {
                    LocChange.scene = null;
                } else {
                    LocChange.scene = {
                        getLoc: () => null,
                        setLoc() {},
                        animateLoc(plane, x, z, layer, shape, angle, seq) {
                            calls.push([x, angle, seq, z, shape, plane, layer].join(','));
                        }
                    };
                }
                Client.attachLocAnim = (...args) => {
                    if (!native) throw new Error('native attachment called in the legacy scene');
                    calls.push(args.join(','));
                    old.attach(...args);
                };
                Protocol.zoneUpdateX = x - 3;
                Protocol.zoneBaseZ = z - 5;
                Client.mapBuildBaseX = 3200;
                Client.mapBuildBaseZ = 6400;
                Client.playerLevel = op === 235 ? (level + 1) & 3 : level;
                supplyPacket(op, wire, new SuperPacket(wire.length));
                let status = 'ok~';
                try {
                    if (!(await Protocol.TcpIn())) throw new Error('packet pending');
                } catch (e) {
                    status = fault(e);
                }
                const where = [native, op, ...v.slice(0, 9), wire.length].join(' ');
                expect(Protocol.inPacket.m_pos.toString(), where).toBe(expectedCursor);
                if (native) {
                    expect([status + '/' + models(), Protocol.packetType, calls.join(';')].join('|'), where).toBe([expectedModels, expectedOpcode, trace].join('|'));
                } else {
                    // The interim callback runs only inside the original coordinate bounds, without touching native scene storage.
                    const accepted = trace !== '' && x >= 0 && x < 103 && z >= 0 && z < 103;
                    expect([status, Protocol.packetType, calls.join(';'), models()].join('|'), where).toBe([trace === '' ? expectedFault : 'ok~', trace === '' ? expectedOpcode : -1, accepted ? trace : '', before].join('|'));
                }
            }
        }
    } finally {
        world.squares = old.squares;
        SeqType.m_recentUse = old.seqs;
        Reflect.set(LocType, 'm_recentUse', old.types);
        SeqType.m_pConfigClient = old.sequencesArchive;
        LocType.m_pConfigClient = old.locsArchive;
        Client.loopCycle = old.cycle;
        Client.playerLevel = old.level;
        Client.mapBuildBaseX = old.baseX;
        Client.mapBuildBaseZ = old.baseZ;
        Client.stream = old.stream;
        Client.attachLocAnim = old.attach;
        LocChange.scene = old.scene;
        SceneCutover.native = old.native;
        Object.assign(Protocol, savedProtocol);
        rmSync(dir, { recursive: true, force: true });
    }
}, 60000);
