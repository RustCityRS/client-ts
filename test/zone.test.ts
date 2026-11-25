import { receivePacket } from './receive-packet.js';
import Protocol from '#/io/Protocol.js';
import type Square from '#/dash3d/Square.js';
import ClientObj from '#/dash3d/ClientObj.js';
import ObjType from '#/config/ObjType.js';
import { gamepackPath, cachePath } from './reference.js';
import { localAssets } from './cachefile.js';
import { expect, test } from 'bun:test';
import { fileURLToPath } from 'node:url';
import Client from '#/client/Client.js';
import ClientBuild from '#/client/ClientBuild.js';
import world from '#/dash3d/world.js';
import { preserveTerrainState } from './terrain-state.js';
import LocMergeQueue from '#/client/LocMergeQueue.js';
import MapSpotAnim from '#/dash3d/MapSpotAnim.js';
import { requireNonNull } from '#/util/JavaArray.js';
import ClientProj from '../src/dash3d/ClientProj.js';

const packets = ['33-3412350102', '33-3512350081', '135-8605cb02013612', '135-8100cb01003712', '33-3712350081', '14-35123401820002', '33-3412350083', '240-4b9234', '240-4b1237', '240-4b1235'];

async function groundTrace() {
    const saved = { zoneUpdateX: Protocol.zoneUpdateX, zoneBaseZ: Protocol.zoneBaseZ };
    const level = Client.playerLevel,
        pid = Client.localPid,
        priorSquares = world.squares,
        previousPile = Client.groundObj[2][51][77];
    Client.localPid = 1;
    try {
        Client.playerLevel = 2;
        Client.groundObj[2][51][77] = null;
        for (const id of [0x1234, 0x1235, 0x1236, 0x1237]) {
            const type = new ObjType();
            type.id = id;
            type.cost = id === 0x1234 ? 1 : 12;
            type.stackable = id === 0x1234 ? 1 : 0;
            ObjType.types.Put(BigInt(id), type);
        }
        world.squares = Array.from({ length: 4 }, () => Array.from({ length: 104 }, () => new Array<Square | null>(104).fill(null)));
        await receivePacket(26, Uint8Array.of(0xd0, 0x48));
        const result: string[] = [];
        for (const value of packets) {
            const [op, data] = value.split('-');
            await receivePacket(Number(op), Buffer.from(data, 'hex'));
            const pile = world.squares[2][51][77]?.groundObject;
            if (pile == null) {
                result.push('');
            } else {
                const items = [pile.topObj, pile.middleObj, pile.bottomObj].filter((item): item is ClientObj => item instanceof ClientObj);
                result.push(items.map(item => item.id + ':' + item.count).join(','));
            }
        }
        return result;
    } finally {
        Object.assign(Protocol, saved);
        Client.playerLevel = level;
        Client.localPid = pid;
        world.squares = priorSquares;
        Client.groundObj[2][51][77] = previousPile;
    }
}

test.skipIf(!gamepackPath)(
    'qd.a and ng.b select the same visible pile after each mutation',
    async () => {
        const source = fileURLToPath(new URL('./game/ZoneOracle.java', import.meta.url));
        const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', gamepackPath, source, ...packets], { timeout: 20000 });
        expect(java.stderr.toString()).toBe('');
        expect(java.exitCode).toBe(0);
        expect(await groundTrace()).toEqual(java.stdout.toString().trimEnd().split(/\r?\n/));
    },
    25000
);

test('530 enclosed zone, restoration, loc animation, spot, source projectile and merge', async () => {
    using _terrain = preserveTerrainState();
    world.mainGroundh = Array.from({ length: 4 }, () => Array.from({ length: 105 }, () => new Int32Array(105)));
    world.levelHeightmaps = world.mainGroundh;
    ClientBuild.m_mapl = Array.from({ length: 4 }, () => Array.from({ length: 104 }, () => new Uint8Array(104)));
    const oldLevel = Client.playerLevel,
        oldCycle = Client.loopCycle,
        oldSceneType = world.SceneType;
    const oldAnimate = Client.attachLocAnim,
        oldPlace = Client.LocChangeUnchecked;
    const oldBase = [Protocol.zoneUpdateX, Protocol.zoneBaseZ];
    Client.playerLevel = 2;
    try {
        localAssets(cachePath, [7, 16, 20, 21]);
        MapSpotAnim.active.clear();
        const locs: number[][] = [];
        world.SceneType = () => (407n << 32n) | (10n << 14n);
        Client.attachLocAnim = (x, angle, seq, z, shape, level, layer) => {
            locs.push([level, x, z, layer, shape, angle, seq]);
        };
        Client.LocChangeUnchecked = (shape, level, id, layer, x, angle, z) => {
            locs.push([level, x, z, layer, id, shape, angle]);
        };
        // Captured wire layouts from rs-protocol/tests/wire_530.rs.
        Client.locChanges.clear();
        Client.loopCycle = 9;
        await receivePacket(230, Buffer.from('c850b3ab3512b4144b57341211351234070102', 'hex'));
        Client.LocChangeDoQueue();
        expect(locs).toEqual([
            [2, 51, 77, 2, 10, 1, 0x1234],
            [2, 51, 77, 2, 0x1234, 10, 3]
        ]);
        const spot = requireNonNull(MapSpotAnim.active.head()).spot;
        expect([spot.plane, spot.x, spot.z, spot.id, spot.y, spot.startCycle]).toEqual([2, 6592, 9920, 0x1234, -7, 267]);
        Client.loopCycle = 15;
        await receivePacket(112, Uint8Array.of(48, 0xb8));
        Client.LocChangeDoQueue();
        expect(locs.at(-1)).toEqual([2, 51, 77, 2, 407, 10, 0]);
        Client.loopCycle = 100;
        await receivePacket(202, Buffer.from('2b357f7e7e12b420000100107aff', 'hex'));
        const merge = requireNonNull(LocMergeQueue.pending.takeFrontAndPop());
        expect([merge.x, merge.z, merge.locId, merge.shape, merge.angle, merge.actor, merge.startDelay, merge.endDelay, merge.offsetX1, merge.offsetX2, merge.offsetZ1, merge.offsetZ2]).toEqual([51, 77, 0x1234, 10, 3, -6, 16, 32, -1, 1, -2, 2]);
        Client.projectiles.clear();
        Client.loopCycle = 100;
        await receivePacket(230, Buffer.from('c85068a5fe03000800071234f614010203041040', 'hex'));
        const p = requireNonNull(Client.projectiles.takeFrontAndPop()).projectile;
        expect([p.id, p.plane, p.sourceX, p.sourceZ, p.sourceY, p.target, p.endHeight, p.startCycle, p.endCycle, p.slope, p.distance]).toEqual([0x1234, 2, 6784, 9536, 10, 7, 80, 358, 872, 16, 64]);
    } finally {
        Client.playerLevel = oldLevel;
        Client.loopCycle = oldCycle;
        world.SceneType = oldSceneType;
        Client.attachLocAnim = oldAnimate;
        Client.LocChangeUnchecked = oldPlace;
        [Protocol.zoneUpdateX, Protocol.zoneBaseZ] = oldBase;
    }
});

test('projectile positions, pitch and yaw follow hl when retargeted in flight', () => {
    const trace = [];
    const bits = new DataView(new ArrayBuffer(8));
    localAssets(cachePath, [21]);
    for (let pitch = -1; pitch < 255; pitch++) {
        const p = new ClientProj(9, 0, 2000, 3000, -70, 100, 140, pitch, 24, 0, 0);
        p.setTarget(2500, -20, 2700, 100);
        bits.setFloat64(0, p['velocityY']);
        trace.push(bits.getBigUint64(0).toString(16));
        for (let tick = 100; tick <= 140; tick++) {
            if (tick === 110 || tick === 130) p.setTarget(2500 + tick, -30, 2700 - tick, tick);
            p.advance(1);
            trace.push([p.x | 0, p.y | 0, p.z | 0, p.yaw, p.pitch].join(' '));
        }
    }
    const source = fileURLToPath(new URL('./game/ProjectileOracle.java', import.meta.url));
    const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', gamepackPath, source], { timeout: 20000 });
    expect(java.stderr.toString()).toBe('');
    const lines = java.stdout.toString().trimEnd().split(/\r?\n/);
    expect(trace.length).toBe(lines.length);
    for (let i = 0; i < trace.length; i++) expect(trace[i], 'tick sample ' + i).toBe(lines[i]);
}, 25000);
