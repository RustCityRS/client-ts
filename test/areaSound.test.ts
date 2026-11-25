import NpcType from '#/config/NpcType.js';
import LocType from '#/config/LocType.js';
import Client from '#/client/Client.js';
import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import bgsound from '#/sound/bgsound.js';
import Areas from '#/sound/AreaSoundManager.js';
import ClientNpc from '#/dash3d/ClientNpc.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import { fromJsString } from '#/datastruct/JagString.js';
import BASType from '#/config/BASType.js';
import BASTypeList from '#/config/BASTypeList.js';
import ClientVarCache from '#/util/ClientVarCache.js';
import Preferences from '#/ui/Preferences.js';
import AudioEngine from '#/sound/AudioEngine.js';
import PCMPlayer from '#/sound/PCMPlayer.js';
import Mixer from '#/sound/Mixer.js';
import Decimator from '#/sound/Decimator.js';
import { mathRandom } from '#/util/JavaRandom.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { localAssets, readGroup } from './cachefile.js';
import { cachePath, gamepackPath } from './reference.js';

const hash = (a: ArrayLike<number> | null) => (a === null ? 0 : Array.from(a).reduce((sum, v) => (Math.imul(31, sum) + v) | 0, 1));
const describe = (s: bgsound) =>
    '[' + [s.delay, s.minDelay, s.maxDelay, s.radius, s.maxX, s.minX, s.maxZ, s.movement, s.plane, s.minZ, s.sound, +s.multi, hash(s.randomIds), s.loop?.GetVolumeFine() ?? -1, s.random?.GetVolumeFine() ?? -1].join(', ') + ']';

test('ambient loc, NPC and player sound lifetimes, multilocs, movement, attenuation and actual mixer output match Java', () => {
    const dir = mkdtempSync(join(tmpdir(), 'areasound530-')),
        assets = localAssets(cachePath, [4]),
        ids = Array.from(requireNonNull(requireNonNull(assets.index(4)).groupIds).slice(0, 4));
    const saved = {
        archive: Client.m_pJagFx,
        mixer: AudioEngine.effects,
        decimator: AudioEngine.decimator,
        rate: PCMPlayer.m_frequency,
        stereo: PCMPlayer.m_stereo,
        volume: Preferences.areaSoundVolume,
        seed: mathRandom['seed'],
        varp: ClientVarCache.m_var[7]
    };
    try {
        Areas.clear(true);
        Client.m_pJagFx = assets.archive(4);
        AudioEngine.decimator = new Decimator(22050, 22050);
        AudioEngine.effects = new Mixer();
        Preferences.areaSoundVolume = 83;
        PCMPlayer.m_frequency = 22050;
        PCMPlayer.m_stereo = false;
        ClientVarCache.m_var[7] = 0;
        mathRandom.setSeed(55031n);
        const loc = Object.assign(new LocType(), { id: 500, width: 2, length: 3, soundRadius: 4, ambientSound: ids[0], randomSounds: Int32Array.of(ids[1], ids[2]), minDelay: 1, maxDelay: 9 });
        const multi = Object.assign(new LocType(), { id: 501, soundRadius: 6, ambientSound: ids[3], minDelay: 2, maxDelay: 6, randomSounds: Int32Array.of(ids[2]) });
        LocType.m_recentUse.Put(501n, multi);
        const base = Object.assign(new NpcType(), {
            id: 600,
            m_backgroundSoundReady: ids[0],
            m_backgroundSoundWalk: ids[1],
            m_backgroundSoundRun: ids[2],
            m_backgroundSoundCrawl: ids[3],
            m_gridSize: 2,
            m_backgroundSoundRange: 3
        } satisfies Partial<NpcType>);
        const other = Object.assign(new NpcType(), {
            id: 601,
            m_backgroundSoundReady: ids[3],
            m_backgroundSoundWalk: ids[2],
            m_backgroundSoundRun: ids[1],
            m_backgroundSoundCrawl: ids[0],
            m_gridSize: 3,
            m_backgroundSoundRange: 8
        } satisfies Partial<NpcType>);
        NpcType.m_recentUse.Put(600n, base);
        NpcType.m_recentUse.Put(601n, other);
        BASTypeList.types.Put(21n, Object.assign(new BASType(), { ready: 22, m_walkForward: 24, m_runForward: 25, m_crawlForward: 26 }));
        const npc = Object.assign(new ClientNpc(), { npcType: base, bas: 21, x: 1320, z: 1600, walkSeq: 22 });
        npc.setSize(2);
        const player = Object.assign(new ClientPlayer(), { bas: 21, x: 1355, z: 1500, walkSeq: 24, username: fromJsString('Test_name'), soundRadius: 4, idleSound: ids[3], slowSound: ids[2], walkSound: ids[1], runSound: ids[0] });
        player.setSize(3);
        player.pathX[0] = 11;
        player.pathZ[0] = 13;
        let plane = 1;
        const commands: string[] = [],
            answers: string[] = [];
        function run(action: string, ...n: number[]) {
            commands.push([action, ...n].join(' '));
            let pcm = 0;
            switch (action) {
                case 'loc':
                    Areas.add(13, loc, 1, null, 10, null, n[0]);
                    break;
                case 'multi':
                    loc.multi = Int32Array.of(501, -1);
                    loc.multiVarp = 7;
                    base.multi = Int32Array.of(601, -1);
                    base.multiVarp = 7;
                    break;
                case 'npc':
                    Areas.add(13, null, 1, null, 10, npc, 0);
                    break;
                case 'player':
                    Areas.updatePlayer(player, plane);
                    break;
                case 'anim':
                    npc.walkSeq = n[0];
                    player.walkSeq = n[1];
                    break;
                case 'var':
                    ClientVarCache.m_var[7] = n[0];
                    Areas.refreshMultis();
                    break;
                case 'vol':
                    Preferences.areaSoundVolume = n[0];
                    break;
                case 'plane':
                    plane = n[0];
                    break;
                case 'rad': {
                    player.soundRadius = n[0];
                    player.walkSound = ids[n[1]];
                    Areas.updatePlayer(player, plane);
                    break;
                }
                case 'tick':
                    Areas.update(plane, n[0], n[1], n[2]);
                    break;
                case 'mix': {
                    const b = new Int32Array(n[0]);
                    requireNonNull(AudioEngine.effects).DoMix(b, 0, b.length);
                    pcm = hash(b);
                    break;
                }
                case 'rmloc':
                    Areas.removeLoc(1, 13, 10, loc);
                    break;
                case 'rmnpc':
                    Areas.removeNpc(npc);
                    break;
                case 'rmplayer':
                    Areas.removePlayer(player);
                    break;
                case 'clear':
                    Areas.clear(n[0] !== 0);
                    break;
            }
            const result = [String(pcm)];
            for (const list of [Areas.locs, Areas.npcs, Areas.players]) for (let s = list.head(); s !== null; s = list.next()) result.push(describe(s));
            answers.push(result.join('|'));
        }
        run('loc', 0);
        run('loc', 1);
        run('npc');
        run('player');
        for (let i = 0; i < 21; i++) {
            run('anim', [22, 24, 25, 26][i % 4], [26, 25, 24, 22][i % 4]);
            run('tick', 3, 1300 + i * 60, 1688 - i * 41);
            run('mix', 220);
        }
        run('clear', 1);
        run('multi');
        run('loc', 3);
        run('npc');
        run('player');
        run('tick', 1, 1600, 1600);
        run('var', 1);
        run('tick', 3, 1600, 1600);
        run('var', 0);
        run('vol', 0);
        run('tick', 10, 1300, 1600);
        run('vol', 127);
        run('rad', 8, 0);
        run('tick', 28, 1300, 1750);
        run('mix', 22050);
        run('plane', 0);
        run('tick', 32, 1400, 1500);
        run('plane', 1);
        run('tick', 2, 2300, 1744);
        run('rmloc');
        run('rmnpc');
        run('rmplayer');
        run('npc');
        run('player');
        run('loc', 1);
        run('clear', 0);
        run('tick', 2, 1600, 1400);
        run('mix', 1600);
        run('clear', 1);
        const encode = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64');
        const archive = [encode(readGroup(cachePath, 255, 4)), ...ids.map(id => id + ':' + encode(readGroup(cachePath, 4, id)))].join(' ');
        const java = (name: string) => fileURLToPath(new URL('./game/' + name + '.java', import.meta.url));
        const build = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, java('ChatOracle'), java('AreaSoundOracle')]);
        expect(build.stderr.toString()).toBe('');
        const jar = Bun.spawnSync(['java', '--add-opens=java.base/java.lang=ALL-UNNAMED', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'AreaSoundOracle'], {
            stdin: Buffer.from([archive, ids.join(' '), ...commands].join('\n')),
            maxBuffer: 512 * 1024
        });
        expect(jar.stderr.toString()).toBe('');
        expect(jar.exitCode).toBe(0);
        const lines = jar.stdout.toString().trimEnd().split(/\r?\n/);
        expect(lines.length).toBe(answers.length);
        for (let i = 0; i < answers.length; i++) expect(answers[i], commands[i]).toBe(lines[i]);
    } finally {
        Areas.clear(true);
        Client.m_pJagFx = saved.archive;
        AudioEngine.effects = saved.mixer;
        AudioEngine.decimator = saved.decimator;
        PCMPlayer.m_frequency = saved.rate;
        PCMPlayer.m_stereo = saved.stereo;
        Preferences.areaSoundVolume = saved.volume;
        ClientVarCache.m_var[7] = saved.varp;
        mathRandom.setSeed(saved.seed ^ 0x5deece66dn);
        LocType.m_recentUse.Remove(501n);
        NpcType.m_recentUse.Remove(600n);
        NpcType.m_recentUse.Remove(601n);
        BASTypeList.types.Remove(21n);
        rmSync(dir, { recursive: true, force: true });
    }
}, 45000);
