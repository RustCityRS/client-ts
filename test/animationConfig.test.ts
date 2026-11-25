import { freshActors } from './actor-fixture.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import { test, expect } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import BASType from '#/config/BASType.js';
import BASTypeList from '#/config/BASTypeList.js';
import SeqType from '#/config/SeqType.js';
import SpotType from '#/config/SpotType.js';
import ClientApp from '#/client/Client.js';
import Preferences from '#/ui/Preferences.js';
import PacketT from '#/io/PacketT.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { localAssets, readGroup } from './cachefile.js';
import { cachePath, gamepackPath } from './reference.js';

const mix = (a: number, b: number) => (Math.imul(a, 31) + b) | 0;
function hash(value: unknown): number {
    if (value === null) return 0;
    if (typeof value === 'boolean') return value ? 1231 : 1237;
    if (typeof value === 'number') return value;
    if (Array.isArray(value) || value instanceof Int32Array || value instanceof Int16Array) {
        let h = 1;
        for (const item of value) h = mix(h, hash(item));
        return h;
    }
    throw Error('Unknown definition field ' + String(value));
}

class Fields {
    readonly fields: { name: string; descriptor: string; member: string; hash: number }[];
    count = 0;
    cursor = 1;
    constructor(name: string, owner: string) {
        const source = readFileSync(resolve(import.meta.dir, '../src/config', name + '.ts'), 'utf8');
        const fields = [...source.matchAll(/^ +(\w+)\b[^\n]*?; *\/\/ (\w+)\.(\w+):([^\r\n]+)/gm)];
        this.fields = fields
            .filter(m => m[2] === owner)
            .map(m => ({ name: m[3], descriptor: m[4], member: m[1], hash: 1 }))
            .sort((a, b) => (a.name < b.name ? -1 : 1));
    }
    add(value: object, pos: number): void {
        this.count++;
        this.cursor = mix(this.cursor, pos);
        for (const f of this.fields) f.hash = mix(f.hash, hash((value as Record<string, unknown>)[f.member]));
    }
    rows(): string[] {
        return [this.count + ' ' + this.cursor, ...this.fields.map(f => [f.name, f.descriptor, f.hash].join(' '))];
    }
}

test('BAS, sequence and spot definitions and actor frame progression match the original 530 client', () => {
    const assets = localAssets(cachePath, [2, 20, 21]),
        expected: string[] = [],
        chunks: Buffer[] = [];
    const writeInt = (n: number) => {
        const value = Buffer.alloc(4);
        value.writeInt32BE(n);
        chunks.push(value);
    };
    const writeBytes = (bytes: Uint8Array) => {
        writeInt(bytes.length);
        chunks.push(Buffer.from(bytes));
    };
    const sets = [
        { kind: BASType, list: BASTypeList, owner: 'mg', archive: 2, shift: 0, edges: ['0100', '01ffff0002', '1b0c000100020003000400050006', '1b0180007fffff', '1b010001000200030004000500061b01000000', '2b12342c45672d00'] },
        { kind: SeqType, list: SeqType, owner: 'ek', archive: 20, shift: 7, edges: ['0100020003', '0100020001000200030004000500', '030300ffff030000', '0d00020112345602778899ff', '0c0200010002000300', '09010a020b000e0f10ff00'] },
        { kind: SpotType, list: SpotType, owner: 'li', archive: 21, shift: 8, edges: ['01aa', '0280', '28', '2802fffeffff8000', '280100020003280000', '290180007fff0900'] }
    ] as const;
    for (const set of sets) {
        const archive = assets.archive(set.archive),
            index = requireNonNull(assets.index(set.archive));
        writeBytes(readGroup(cachePath, 255, set.archive));
        for (const group of requireNonNull(index.groupIds)) writeBytes(readGroup(cachePath, set.archive, group));
        const raw = new Fields(set.kind.name, set.owner),
            loaded = new Fields(set.kind.name, set.owner);
        const decode = (id: number, data: Uint8Array, edge = false) => {
            const value = new set.kind(),
                p = new PacketT(data);
            if ('id' in value) value.id = id;
            let pos: number;
            try {
                value.Decode(p);
                pos = p.m_pos;
            } catch (error) {
                if (!edge || !(error instanceof RangeError)) throw error;
                pos = ~p.m_pos;
            }
            raw.add(value, pos);
        };
        for (const group of requireNonNull(index.groupIds)) {
            if (set.archive === 2 && group !== 32) continue;
            for (const file of requireNonNull(archive.GetFileList(group))) {
                const id = set.archive === 2 ? file : (group << set.shift) | file;
                const bytes = archive.GetFile(file, group);
                if (bytes === null) continue;
                decode(id, bytes);
                loaded.add(set.list.List(id), 0);
            }
        }
        writeInt(set.edges.length);
        for (const sample of set.edges) {
            const bytes = Buffer.from(sample, 'hex');
            writeBytes(bytes);
            decode(0x530, bytes, true);
        }
        expected.push(...raw.rows(), ...loaded.rows());
    }
    const out = resolve(import.meta.dir, '../out');
    mkdirSync(out, { recursive: true });
    const scratch = mkdtempSync(join(out, 'animation-config-'));
    let lines: string[];
    try {
        const sources = ['EntityConfigOracle', 'AnimationConfigOracle'].map(name => fileURLToPath(new URL('./ui/' + name + '.java', import.meta.url)));
        const build = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', scratch, ...sources]);
        if (build.exitCode !== 0) throw Error(build.stderr.toString());
        const run = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', scratch + delimiter + gamepackPath, 'AnimationConfigOracle'], { stdin: Buffer.concat(chunks), timeout: 20000 });
        if (run.exitCode !== 0) throw Error(run.stderr.toString());
        lines = run.stdout.toString().trimEnd().split(/\r?\n/);
    } finally {
        rmSync(scratch, { recursive: true, force: true });
    }
    expect(lines.splice(0, expected.length)).toEqual(expected);

    function sequence(id: number, replay: number, loops: number, preMove: number): SeqType {
        const s = new SeqType();
        s.id = id;
        s.frames = Int32Array.of(500, 501, 502);
        s.delays = Int32Array.of(0, 1, 3);
        s.sounds = Array.from({ length: 3 }, (_, i) => Int32Array.of(((id + i) << 8) | 33));
        s.m_loops = 2;
        s.m_maxLoops = loops;
        s.m_duplicateBehaviour = replay;
        s.m_preanimMove = preMove;
        s.stretches = true;
        s.PostDecode();
        SeqType.m_recentUse.Put(BigInt(id), s);
        return s;
    }
    const action = 23000,
        walk = 23010,
        spot = 23020;
    sequence(action, 1, 2, 1);
    sequence(walk, 0, 99, 0);
    sequence(spot, 2, 1, 0);
    const empty = sequence(23030, 2, 1, 0);
    empty.frames = new Int32Array(0);
    empty.delays = new Int32Array(0);
    empty.sounds = null;
    const missing = sequence(23031, 2, 1, 0);
    missing.frames = null;
    missing.delays = null;
    missing.sounds = null;
    const effect = new SpotType();
    effect.seq = spot;
    effect.id = 19000;
    SpotType.m_recentUse.Put(19000n, effect);
    const actor = freshActors().self;
    const oldVolume = Preferences.areaSoundVolume;
    Preferences.areaSoundVolume = 127;
    actor.walkSeq = walk;
    actor.spotanim = 19000;
    actor.spotStart = 3;
    actor.spotFrame = -1;
    actor.seq = action;
    actor.seqDelay = 3;
    actor.seqPathLength = 1;
    let previous = actor.modelAnims[0];
    const array = (ints: number[]) => '[' + ints.join(', ') + ']';
    for (let tick = 1; tick <= 24; tick++) {
        ClientApp.soundEffectCount = 0;
        ClientApp.loopCycle = tick;
        if (tick === 1 || tick === 2 || tick === 4) {
            if (tick !== 1) previous = actor.modelAnims[0];
            ClientPlayer.applySlotAnims(Int32Array.of(action, walk, spot), tick === 1 ? Int32Array.of(1, 0, 0) : Int32Array.of(2, 2, 2), actor, Int32Array.of(1, 2, 4));
        }
        if (tick === 7) actor.seqPathLength = 0;
        if (tick === 15) ClientPlayer.applySlotAnims(Int32Array.of(23030, 23031), Int32Array.of(0, 0), actor, Int32Array.of(1, 2));
        if (tick === 19) {
            actor.walkSeq = actor.seq = 23030;
            actor.seqDelay = actor.seqFrame = actor.walkFrame = 0;
        }
        if (tick === 20) actor.seq = actor.walkSeq = 23031;
        ClientApp.GlEntityAnim(actor);
        const row = [
            array([
                actor.walkSeq,
                actor.walkFrame,
                actor.walkCycle,
                actor.walkNext,
                actor.spotanim,
                actor.spotFrame,
                actor.spotCycle,
                actor.spotNext,
                actor.seq,
                actor.seqFrame,
                actor.seqCycle,
                actor.seqNext,
                actor.seqLoops,
                actor.seqDelay,
                +actor.stretches,
                +(previous === actor.modelAnims[0])
            ])
        ];
        for (const s of actor.modelAnims.slice(0, 3)) row.push(s === null ? 'null' : array([s.seq, s.delay, s.frame, s.next, s.cycle, s.loops]));
        row.push(array(Array.from(ClientApp.soundEffectIds.subarray(0, ClientApp.soundEffectCount))));
        expect(row.join('|')).toBe(requireNonNull(lines.shift()));
    }
    const bas = new BASType(),
        id = 23100;
    bas.ready = id;
    bas.m_walkForward = id + 1;
    bas.m_crawlForward = id + 2;
    bas.m_crawlBackward = id + 3;
    bas.m_crawlLeft = id + 4;
    bas.m_crawlRight = id + 5;
    bas.m_runForward = id + 6;
    bas.m_runBackward = id + 7;
    bas.m_runLeft = id + 8;
    bas.m_runRight = id + 9;
    bas.m_readyTurnLeft = id + 38;
    bas.m_readyTurnRight = id + 39;
    bas.m_walkBackward = id + 40;
    bas.m_walkLeft = id + 41;
    bas.m_walkRight = id + 42;
    for (let i = 0; i < 43; i++) sequence(id + i, 2, 2, 0);
    BASTypeList.types.Put(19001n, bas);
    for (let scenario = 0; scenario < 32; scenario++) {
        const info = freshActors(),
            player = info.self;
        player.bas = 19001;
        player.pathX[0] = player.pathZ[0] = 50;
        player.x = player.z = 50 * 128 + 64;
        player.yaw = (scenario * 113) & 2047;
        player.fineYaw = player.yaw << 5;
        bas.turnAcceleration = scenario & 8 ? 131 : 0;
        bas.turnMax = scenario & 16 ? 65530 : 431;
        bas.walkAcceleration = scenario & 4 ? 35 : -1;
        for (let tick = 1; tick <= 48; tick++) {
            if (tick === 1 || tick === 15 || tick === 33) {
                const dir = (scenario + ((tick / 10) | 0)) & 7;
                const dx = [-1, 0, 1, -1, 1, -1, 0, 1][dir],
                    dz = [1, 1, 1, 0, 0, -1, -1, -1][dir];
                player.pathLength = 1;
                player.pathX[0] = (player.x >> 7) + dx;
                player.pathZ[0] = (player.z >> 7) + dz;
                player.pathSpeed[0] = (scenario + tick) % 3;
            }
            if (tick === 22) {
                player.pathLength = 0;
                player.targetYaw = (player.yaw + (scenario % 2 === 0 ? 370 : -370)) & 2047;
            }
            ClientApp.loopCycle = tick;
            ClientApp.soundEffectCount = 0;
            ClientApp.GlMoveEntity(0, player);
            const row = [
                player.x,
                player.z,
                player.yaw,
                player.targetYaw,
                player.pathLength,
                player.movementDelay,
                player.movementSpeed,
                player.walkSeq,
                player.walkFrame,
                player.walkCycle,
                player.walkNext,
                player.turnTicks,
                player.fineYaw,
                player.turnTarget,
                player.turnDistance,
                player.turnVelocity,
                player.turnBrakeAt,
                +player.turnAccelerating
            ];
            expect(row).toEqual(JSON.parse(requireNonNull(lines.shift())));
        }
    }
    Preferences.areaSoundVolume = oldVolume;
    ClientApp.soundEffectCount = 0;
    expect(lines).toEqual([]);
}, 30000);
