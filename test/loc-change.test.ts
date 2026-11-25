import LocType from '#/config/LocType.js';
import { expect, spyOn, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import Decor from '#/dash3d/Decor.js';
import GroundDecor from '#/dash3d/GroundDecor.js';
import LocChange from '#/dash3d/LocChange.js';
import Sprite from '#/dash3d/Sprite.js';
import Square from '#/dash3d/Square.js';
import Wall from '#/dash3d/Wall.js';
import world from '#/dash3d/world.js';
import Protocol from '#/io/Protocol.js';
import SuperPacket from '#/io/SuperPacket.js';
import SharedPtrList from '#/datastruct/SharedPtrList.js';
import PacketT from '#/io/PacketT.js';
import SceneCutover from '#/scene/SceneCutover.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { gamepackPath } from './reference.js';

test('pending loc spawns preserve the JAR queue, previous scene keys, model retries and wire cursors', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rs530-loc-change-'));
    const module = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
    const cursor = { inPacket: Protocol.inPacket, packetType: Protocol.packetType, zoneUpdateX: Protocol.zoneUpdateX, zoneBaseZ: Protocol.zoneBaseZ };
    const savedLevel = Client.playerLevel;
    const savedScene = LocChange.scene,
        savedQueue = Client.locChanges,
        savedCutover = SceneCutover.native,
        savedSquares = world.squares;
    const savedPlace = Client.LocChangeUnchecked;
    const objects = new Map<string, { id: number; shape: number; angle: number }>();
    const key = (p: number, x: number, z: number, l: number) => [p, x, z, l].join(',');
    let step = 0,
        calls = '';
    const get = spyOn(LocType, 'List').mockImplementation(id => {
        const type = new LocType();
        type.CheckModel = shape => {
            calls += 'r' + id + ',' + shape + ';';
            return (id + shape + step) % 4 !== 0;
        };
        return type;
    });
    function put(p: number, x: number, z: number, l: number, id: number, shape: number, angle: number) {
        if (!SceneCutover.native) {
            if (id < 0) objects.delete(key(p, x, z, l));
            else objects.set(key(p, x, z, l), { id, shape, angle });
            return;
        }
        const column = requireNonNull(world.squares)[p][x];
        const square = column[z] ?? (column[z] = new Square(p, x, z));
        const typecode = (BigInt(id) << 32n) | 0x40000000n | BigInt((angle << 20) | (shape << 14) | (z << 7) | x);
        if (l === 0) {
            square.wall = id < 0 ? null : new Wall();
            if (square.wall !== null) square.wall.typecode = typecode;
        } else if (l === 1) {
            square.decor = id < 0 ? null : new Decor();
            if (square.decor !== null) square.decor.typecode = typecode;
        } else if (l === 2) {
            square.spriteCount = 0;
            if (id >= 0) {
                const sprite = new Sprite();
                sprite.typecode = typecode;
                sprite.minTileX = x;
                sprite.minTileZ = z;
                square.sprites[0] = sprite;
                square.spriteCount = 1;
            }
        } else if (l === 3) {
            square.groundDecor = id < 0 ? null : new GroundDecor();
            if (square.groundDecor !== null) square.groundDecor.typecode = typecode;
        }
    }
    // LocChangeOracle instruments only the target of the two od.e placement calls.
    function place(p: number, x: number, z: number, l: number, id: number, shape: number, angle: number) {
        calls += 'p' + [p, x, z, l, id, shape, angle].join(',') + ';';
        if (x >= 1 && x <= 102 && z >= 1 && z <= 102) put(p, x, z, l, id, shape, angle);
    }
    try {
        Client.LocChangeUnchecked = (shape, p, id, l, x, angle, z) => place(p, x, z, l, id, shape, angle);
        LocChange.scene = {
            getLoc(p, x, z, l) {
                if (SceneCutover.native) throw new Error('native queue read legacy scene');
                return objects.get(key(p, x, z, l)) ?? null;
            },
            setLoc: place
        };
        const lines: string[] = [];
        for (let i = 0; i < 160; i++) {
            const layer = i % 4,
                x = 46 + (i % 9),
                z = 46 + ((i * 3) % 11),
                shape = [0, 5, 11, 22][layer],
                plane = i % 3;
            lines.push(['tile', plane, x, z, layer, i % 10, shape, i % 4].join(' '));
            lines.push(['add', i % 4, shape, x, i % 3 === 0 ? -1 : 2 + (i % 5), z, plane, layer, i % 7 === 0 ? -1 : i % 12, i % 4].join(' '));
            if (i % 3 === 0) lines.push(['add', i % 2, shape, x, 3, z, plane, layer, i % 5, i % 4].join(' '));
            if (i % 4 === 0) lines.push(['add', 0, 10, i % 8 ? 103 : 0, -1, z, plane, 2, 7, 0].join(' '));
            lines.push('tick');
            if (i % 9 === 0) lines.push('build');
        }
        for (const op of [179, 195])
            for (const shape of [0, 3, 4, 5, 8, 9, 10, 11, 22, 23, 63]) {
                const info = (shape << 2) | 3,
                    bytes = Buffer.from([op === 179 ? (info + 128) & 255 : -info & 255, 0x53, 0, 133]);
                for (let n = 0; n <= (op === 179 ? 4 : 2); n++) lines.push(['wire', op, bytes.subarray(0, n).toString('hex')].join(' ').trimEnd());
                lines.push('tick');
            }
        const jar = dir + delimiter + gamepackPath;
        Protocol.zoneUpdateX = Protocol.zoneBaseZ = 48;
        Client.playerLevel = 1;
        for (const cmd of [
            ['javac', module, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game', 'LocChangeOracle.java')],
            ['java', module, '-cp', jar, 'LocChangeOracle', gamepackPath, dir]
        ]) {
            const p = Bun.spawnSync(cmd);
            expect(p.exitCode, p.stderr.toString()).toBe(0);
        }
        const java = Bun.spawnSync(['java', module, '-cp', jar, 'LocChangeOracle'], { stdin: Buffer.from(lines.join('\n') + '\n'), maxBuffer: 16 * 1024 * 1024 });
        expect(java.exitCode, java.stderr.toString()).toBe(0);
        const reference = java.stdout.toString().trimEnd().split(/\r?\n/);
        expect(reference.length).toBe(lines.length);
        for (const native of [false, true]) {
            step = 0;
            SceneCutover.native = native;
            objects.clear();
            Client.locChanges = new SharedPtrList<LocChange>();
            world.squares = native ? Array.from({ length: 4 }, () => Array.from({ length: 104 }, () => new Array<Square | null>(104).fill(null))) : null;
            for (const line of lines) {
                calls = '';
                const [op, ...args] = line.split(' '),
                    [a, b, c, d, e, f, g, h, i] = args.map(Number);
                let packet: PacketT | null = null,
                    failed = false;
                try {
                    if (op === 'tile') put(a, b, c, d, e, f, g);
                    else if (op === 'add') Client.LocChangeCreate(a, b, c, d, e, f, g, h, i);
                    else if (op === 'tick') Client.LocChangeDoQueue();
                    else if (op === 'build') Client.LocChangePostBuildCorrect();
                    else {
                        const bytes = Buffer.from(args[1] ?? '', 'hex');
                        const input = (Protocol.inPacket = new SuperPacket(bytes.length));
                        input.m_data = bytes;
                        packet = input;
                        Protocol.packetType = a;
                        Client.ZonePacket();
                    }
                } catch {
                    failed = true;
                }
                let state = '';
                for (let n = Client.locChanges.head(); n !== null; n = Client.locChanges.next()) {
                    state += '[' + [n.remaining, n.plane, n.x, n.layer, n.oldAngle, n.shape, n.oldShape, n.delay, n.oldId, n.id, n.z, n.angle].join(', ') + ']';
                }
                expect([packet?.m_pos ?? -1, failed, calls, state].join('|'), native + ' ' + step + ' ' + line).toBe(reference[step]);
                step++;
            }
        }
    } finally {
        Object.assign(Protocol, cursor);
        Client.playerLevel = savedLevel;
        get.mockRestore();
        Client.LocChangeUnchecked = savedPlace;
        SceneCutover.native = savedCutover;
        world.squares = savedSquares;
        LocChange.scene = savedScene;
        Client.locChanges = savedQueue;
        rmSync(dir, { recursive: true, force: true });
    }
});
