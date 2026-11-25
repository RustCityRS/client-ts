import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import BASTypeList from '#/config/BASTypeList.js';
import SpotType from '#/config/SpotType.js';
import Client from '#/client/Client.js';
import LocMergeQueue from '#/client/LocMergeQueue.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import type Square from '#/dash3d/Square.js';
import world from '#/dash3d/world.js';
import Protocol from '#/io/Protocol.js';
import SuperPacket from '#/io/SuperPacket.js';
import SceneCutover from '#/scene/SceneCutover.js';
import Preferences from '#/ui/Preferences.js';
import { JavaError } from '#/util/JavaException.js';
import WrappedException from '#/util/WrappedException.js';
import { loginFixture } from './login-fixture.js';
import { gamepackPath } from './reference.js';

type Vector = [opcode: number, mode: number, at: number, value: number];
const widths = new Map([
    [16, 11],
    [121, 11],
    [33, 3],
    [14, 4],
    [97, 4],
    [240, 2],
    [135, 4],
    [17, 4],
    [195, 2],
    [104, 12],
    [202, 10],
    [179, 3],
    [20, 3]
]);

function vectors(): Vector[] {
    const rows: Vector[] = [];
    for (let op = 0; op < 256; op++) rows.push([op, 0, 0, 0]);
    for (let read = 1; read <= 13; read++) {
        rows.push([255, 2, read, 0]);
        for (const op of widths.keys()) rows.push([255, 1, read, op]);
    }
    for (const [op, reads] of widths)
        for (let read = 1; read <= reads; read++) {
            for (const mode of [3, 4, 5]) rows.push([op, mode, read, 0]);
        }
    for (const op of [20, 179, 16, 255]) rows.push([202, 6, 0, op]);
    for (let read = 1; read <= 4; read++) for (const value of [0, 1]) rows.push([97, 7, read, value]);
    for (let read = 1; read <= 5; read++) for (const value of [0, 1, 2]) rows.push([104, 8, read, value]);
    return rows;
}

function bytes([op, mode, , after]: Vector): [Buffer, Buffer] {
    const first = Buffer.alloc(32);
    if (op === 179) first[0] = 128;
    if (op === 20) first[1] = 128;
    if (op === 97) {
        first[2] = 18;
        first[3] = 0x26;
        first[4] = 103;
    }
    if (op === 104 && mode === 8) {
        first[3] = first[4] = 255;
        first[2] = 1;
    }
    if (mode === 6 && after === 179) {
        first[14] = 128;
        first[16] = 7;
    }
    if (mode === 6 && after === 20) {
        first[14] = 128;
        first[15] = 128;
    }
    return [first, Buffer.from(Array.from({ length: 40 }, (_, i) => i + 1))];
}

const enqueue = LocMergeQueue.enqueue;
function client(v: Vector): string {
    const [op, mode, at, value] = v,
        [wire, alt] = bytes(v);
    const first = new SuperPacket(0),
        second = new SuperPacket(0);
    first.m_data = wire;
    second.m_data = alt;
    second.m_pos = 3;
    let opcode = op,
        buffer: SuperPacket | null = first,
        gates = 0,
        buffers = 0,
        stateReads = 0;
    const trace: string[] = [],
        stop = new JavaError('zone dispatch');
    const firstPlayer = new ClientPlayer(),
        secondPlayer = new ClientPlayer();
    firstPlayer.bas = -1;
    secondPlayer.pathX[0] = secondPlayer.pathZ[0] = 104;
    let player: ClientPlayer | null = firstPlayer;
    let transforms: (Int32Array | null)[] | null = [Int32Array.of(31, 15, 17)];
    Object.defineProperty(BASTypeList.defaultType, 'transforms', {
        configurable: true,
        get() {
            if (mode === 8 && ++stateReads === at) transforms = value === 0 ? null : value === 1 ? [null] : [Int32Array.of(93, -21, 14)];
            trace.push('t');
            return transforms;
        }
    });
    Object.defineProperty(Client, 'localPlayer', {
        configurable: true,
        get() {
            if (mode === 7 && ++stateReads === at) player = value === 0 ? null : secondPlayer;
            trace.push('p' + (player === firstPlayer ? 1 : player === secondPlayer ? 2 : 0));
            return player;
        }
    });
    Object.defineProperties(Protocol, {
        packetType: {
            configurable: true,
            get() {
                if (++gates === at) {
                    if (mode === 1) opcode = value;
                    if (mode === 2) {
                        trace.push('stopO');
                        throw stop;
                    }
                }
                trace.push('o' + opcode);
                return opcode;
            }
        },
        inPacket: {
            configurable: true,
            get() {
                if (++buffers === at) {
                    if (mode === 3) buffer = second;
                    if (mode === 4) buffer = null;
                    if (mode === 5) {
                        trace.push('stopB');
                        throw stop;
                    }
                }
                trace.push('b' + (buffer === first ? 1 : buffer === second ? 2 : 0) + ':' + first.m_pos + '/' + second.m_pos);
                return buffer;
            }
        }
    });
    LocMergeQueue.enqueue = (...args) => {
        enqueue(...args);
        trace.push('merge');
        if (mode === 6) opcode = value;
    };
    LocMergeQueue.pending.clear();
    Client.locChanges.clear();
    Client.projectiles.clear();
    Client.soundEffectCount = 0;
    Preferences.areaSoundVolume = 127;
    Protocol.zoneUpdateX = Protocol.zoneBaseZ = mode >= 6 ? 0 : 200;
    Client.localPid = Client.playerLevel = 0;
    Client.loopCycle = 100;
    world.squares = [Array.from({ length: 8 }, () => new Array<Square | null>(8).fill(null))];
    world.levelHeightmaps = null;
    let status = 'ok';
    try {
        Client.ZonePacket();
    } catch (error) {
        if (error === stop) status = 'stop';
        else {
            if (!(error instanceof WrappedException)) throw error;
            const cause = error.cause;
            if (cause instanceof RangeError) status = 'ArrayIndexOutOfBoundsException';
            else if (cause instanceof TypeError) status = 'NullPointerException';
            else throw error;
            status += '@' + error.context;
        }
    }
    const merged: string[] = [],
        locs: string[] = [],
        sounds: string[] = [],
        projs: string[] = [];
    for (let node = LocMergeQueue.pending.head(); node !== null; node = LocMergeQueue.pending.next()) merged.push([node.actor, node.shape, node.locId, node.x, node.z, node.endDelay, node.startDelay].join(','));
    for (let node = Client.locChanges.head(); node !== null; node = Client.locChanges.next()) locs.push([node.id, node.x, node.z].join(','));
    for (let i = 0; i < Client.soundEffectCount; i++) sounds.push([Client.soundEffectIds[i], Client.soundEffectLoops[i], Client.soundEffectDelays[i], Client.soundEffectPositions[i]].join(','));
    for (let n = Client.projectiles.head(); n !== null; n = Client.projectiles.next()) projs.push([n.projectile['sourceX'], n.projectile['sourceZ'], n.projectile['sourceY']].join(','));
    return [status, trace.join(','), [first.m_pos, second.m_pos, opcode].join(','), merged.join('/'), locs.join('/'), sounds.join('/'), projs.join('/')].join('|');
}

loginFixture(
    import.meta.url,
    'ZonePacket rereads the live opcode and buffer at the original gamepack branch boundaries',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), '530-zone-dispatch-'));
        try {
            const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED',
                cp = dir + delimiter + gamepackPath;
            const cc = Bun.spawnSync(['javac', asm, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game/ZoneDispatchOracle.java')]);
            expect(cc.exitCode, cc.stderr.toString()).toBe(0);
            const java = ['java', asm, '-Djava.awt.headless=true', '-cp', cp, 'ZoneDispatchOracle'];
            const patched = Bun.spawnSync([...java, dir]);
            expect(patched.exitCode, patched.stderr.toString()).toBe(0);
            const rows = vectors(),
                input = rows.map(v => [...v, ...bytes(v).map(data => data.toString('hex'))].join(' '));
            const run = Bun.spawnSync(java, { stdin: Buffer.from(input.join('\n') + '\n'), maxBuffer: 4 * 1024 * 1024 });
            expect(run.exitCode, run.stderr.toString()).toBe(0);
            const ref = run.stdout.toString().trimEnd().split(/\r?\n/);
            expect(ref.length).toBe(rows.length);
            SceneCutover.native = true;
            SpotType.m_recentUse.Put(0n, new SpotType());
            for (const [i, row] of rows.entries()) expect(client(row), input[i]).toBe(ref[i]);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    20000
);
