import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import ClientBuild from '#/client/ClientBuild.js';
import NpcType from '#/config/NpcType.js';
import { requireNonNull } from '#/util/JavaArray.js';
import WrappedException from '#/util/WrappedException.js';
import { localAssets } from '../cachefile.js';
import { loginFixture } from '../login-fixture.js';
import { cachePath } from '../reference.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

function snapshot(label: string): string[] {
    const ints = (values: ArrayLike<number>) => '[' + Array.from(values).join(',') + ']';
    const regions = Client.mapNpcRegionIds.subarray(0, Client.npcSpawnRegionCount);
    const ids = Client.npcIds.subarray(0, Client.npcCount);
    const lines = ['case ' + label + ' ' + ints(regions) + ' ' + ints(ids)];
    for (const id of ids) {
        const npc = requireNonNull(Client.npcs[id]);
        const fields = [id, requireNonNull(npc.npcType).id, npc.lastUpdate, npc.getSize(), npc.targetYaw, npc.yaw, npc.turnSpeed, npc.bas, npc.x, npc.z, npc.pathLength];
        lines.push('npc ' + ints(fields) + ' ' + ints(npc.pathX) + ' ' + ints(npc.pathZ));
    }
    return lines;
}

loginFixture(
    import.meta.url,
    'HD title NPC spawns match gd.c and mh.h for every entry in n42_83',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-hd-title-npc-'));
        try {
            const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
            const sources = ['GlRecorder.java', 'HdTitleFrameOracle.java', 'HdTitleNpcSpawnsOracle.java'];
            const build = Bun.spawnSync(['javac', '-encoding', 'UTF-8', '-d', dir, '-cp', cp, ...sources.map(s => join(import.meta.dir, s))]);
            expect(build.exitCode, build.stderr.toString()).toBe(0);
            const native = Bun.spawnSync([
                'java',
                '--add-opens=java.base/java.lang=ALL-UNNAMED',
                '-Djava.awt.headless=true',
                '-Dgltrace.stacks=false',
                '-Xmx1200m',
                '-cp',
                cp,
                'HdTitleNpcSpawnsOracle',
                cachePath,
                join(import.meta.dir, 'rtx5070.json')
            ]);
            expect(native.exitCode, native.stderr.toString()).toBe(0);
            const expected = native.stdout.toString().trim().split(/\r?\n/);

            const assets = localAssets(cachePath, [5, 18]);
            const group = assets.groupId(5, 'n42_83');
            const bytes = requireNonNull(assets.file(5, group));
            const hash = new Int8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength).reduce((h, b) => (Math.imul(h, 31) + b) | 0, 1);
            const region = (42 << 8) | 83;
            Client.mapBuildBaseX = 2656;
            Client.mapBuildBaseZ = 5288;
            ClientBuild.buildLevel = 0;
            Client.loopCycle = 0;
            Client.mapBuildIndex = new Int32Array(18);
            Client.mapBuildNpcData = new Array<Uint8Array | null>(18).fill(null);
            Client.mapBuildIndex[4] = region;
            Client.mapBuildNpcData[4] = bytes;
            const observed = ['input 2656 5288 0 0', ['group', 4, region, group, bytes.length, hash].join(' ')];
            Client.spawnMapNpcs();
            expect(Client.npcCount).toBe(35);
            observed.push(...snapshot('title'));

            Client.mapBuildIndex = Int32Array.of(region);
            Client.mapBuildNpcData = [bytes];
            Client.mapBuildBaseX = 42 * 64;
            Client.mapBuildBaseZ = 83 * 64;
            for (let plane = 0; plane < 4; plane++) {
                ClientBuild.buildLevel = plane;
                Client.npcs.fill(null);
                Client.npcSpawnRegionCount = Client.npcCount = 0;
                Client.spawnMapNpcs();
                observed.push(...snapshot('plane' + plane));
                Client.loopCycle++;
                Client.spawnMapNpcs();
                observed.push(...snapshot('occupied' + plane));
            }
            ClientBuild.buildLevel = 0;
            NpcType.List(5758).spawnDirection = 8;
            for (const name of ['direction', 'null-data']) {
                if (name === 'null-data') Client.mapBuildNpcData = null;
                try {
                    Client.spawnMapNpcs();
                    throw new Error('missing fault ' + name);
                } catch (error) {
                    if (!(error instanceof WrappedException)) throw error;
                    const kind = error.cause instanceof RangeError ? 'ArrayIndexOutOfBoundsException' : error.cause instanceof TypeError ? 'NullPointerException' : error.cause?.name;
                    observed.push('fault ' + name + ' ' + kind + ' ' + error.context);
                }
                observed.push(...snapshot(name));
            }
            expect(observed).toEqual(expected);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    45000,
    'gl'
);
