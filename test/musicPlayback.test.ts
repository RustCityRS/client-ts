import SuperPacket from '#/io/SuperPacket.js';
import Client from '#/client/Client.js';
import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import MidiPlayer from '#/sound/MidiPlayer.js';
import MidiFile from '#/sound/MidiFile.js';
import MidiManager from '#/sound/MidiManager.js';
import Preferences from '#/ui/Preferences.js';
import Patch from '#/sound/Patch.js';
import WaveCache from '#/sound/WaveCache.js';
import PCMPlayer from '#/sound/PCMPlayer.js';
import { arrayAt, requireNonNull } from '#/util/JavaArray.js';
import { localAssets, readGroup } from './cachefile.js';
import { gamepackPath, cachePath } from './reference.js';

const fold = (h: number, v: number) => (Math.imul(31, h) + v) | 0;
function hash(values: ArrayLike<number>): number {
    let h = 1;
    for (let i = 0; i < values.length; i++) h = fold(h, values[i]);
    return h;
}
function channels(midi: MidiPlayer): number {
    let h = 1;
    for (const key of ['programs', 'volumes', 'parameters', 'bends', 'retriggerSteps', 'initialPrograms', 'portamento', 'retriggers', 'sensitivity', 'flags', 'pans', 'sampleOffsets', 'modulation', 'gains', 'expression', 'banks'] as const)
        h = fold(h, hash(midi[key]));
    return h;
}
function voices(midi: MidiPlayer): number {
    const list = midi['patchStream'].voices;
    let h = 1;
    for (let v = list.head(); v !== null; v = list.next()) {
        h = fold(h, hash([v.glide, v.volumeIndex, v.vibratoPhase, v.retriggerPhase, v.decayTime, v.pitch, v.gain, v.group, v.pitchDelta, v.volumeTime, v.releaseTime, v.remaining, v.channel, v.age, v.releaseIndex, v.pan, v.note]));
        if (v.stream !== null)
            for (const k of ['rightStep', 'gain', 'loopStart', 'pingPong', 'loopEnd', 'pan', 'rampRemaining', 'step', 'targetGain', 'loops', 'leftGain', 'leftStep', 'gainStep', 'rightGain', 'position'] as const) h = fold(h, Number(v.stream[k]));
    }
    return h;
}
test('Java music playback matches PCM blocks, voice envelopes, controller state, loop, skips and finite decode budgets', () => {
    const dir = mkdtempSync(join(tmpdir(), 'midi530-')),
        savedRate = PCMPlayer.m_frequency,
        savedStereo = PCMPlayer.m_stereo;
    try {
        const archives = [4, 6, 11, 14, 15],
            assets = localAssets(cachePath, archives);
        const groups = Array.from({ length: 16 }, () => new Set<number>());
        groups[14].add(0);
        const selected: [[number, number], ...[number, number][]] = [
            [6, assets.groupId(6, 'scape main')],
            [6, assets.groupId(6, 'newbie melody')],
            [11, requireNonNull(requireNonNull(assets.index(11)).groupIds)[0]],
            [11, requireNonNull(requireNonNull(assets.index(11)).groupIds)[77]],
            [6, 13]
        ];
        const requests: Buffer[] = [],
            answers: string[] = [],
            labels: string[] = [];
        const word = (v: number) => {
            const b = Buffer.alloc(4);
            b.writeInt32BE(v);
            return b;
        };
        for (const [instance, [a, id]] of selected.entries()) {
            expect(id).toBeGreaterThanOrEqual(0);
            groups[a].add(id);
            const track = requireNonNull(MidiFile.Load(assets.archive(a), id, 0));
            track.prepare();
            const masks = requireNonNull(track.instruments);
            let instrument = -1,
                key = 0;
            for (let mask = masks.head(); mask !== null; mask = masks.next()) {
                const program = Number(mask.key);
                groups[15].add(program);
                const patch = requireNonNull(Patch.Load(program, assets.archive(15)));
                for (let i = 0; i < 128; i++)
                    if (arrayAt(mask.data, i) !== 0) {
                        const coded = arrayAt(patch.sampleIds, i) - 1;
                        if (coded < 0) continue;
                        groups[(coded & 1) === 0 ? 4 : 14].add(coded >> 2);
                        if (instrument === -1 && program < 128) {
                            instrument = program;
                            key = i;
                        }
                    }
            }
            const midi = new MidiPlayer(),
                cache = new WaveCache(assets.archive(4), assets.archive(14));
            midi.QueueSetDefInst(128, 9);
            let attempts = 1;
            while (!midi.LoadAndQueuePatches(cache, 22050, assets.archive(15), track) && attempts < 4096) attempts++;
            expect(attempts).toBeLessThan(4096);
            answers.push(String(attempts));
            labels.push('load ' + a + '/' + id);
            const stereo = (instance & 1) !== 0,
                rate = instance === 2 ? 44100 : 22050,
                loop = a === 11;
            PCMPlayer.m_frequency = rate;
            PCMPlayer.m_stereo = stereo;
            requests.push(word(a), word(id), Buffer.of(+stereo), word(rate), Buffer.of(+loop));
            midi.QueueDropWaveIds();
            midi.QueueSetGlobalVolume(213);
            midi.QueuePlayFile(track, loop);
            const ops: [number, number][] = [];
            if (a === 6 && id === 13) {
                ops.push([3, 256]);
                for (let j = 0; j < 285; j++) ops.push([j % 13 === 0 ? 0 : 1, 22050]);
            } else for (let j = 0; j < 65; j++) ops.push([j % 9 === 4 ? 1 : 0, [220, 257, 1325, 4096, 1507][j % 5]]);
            if (instrument >= 0) {
                const msg = (status: number, k: number, v = 0) => ops.push([2, status | (k << 8) | (v << 16)]),
                    ctl = (k: number, v: number) => msg(176, k, v);
                msg(255, 0);
                msg(192, instrument);
                ctl(81, 127);
                ctl(17, 118);
                ctl(16, 45);
                ctl(1, 32);
                msg(144, key, 108);
                ops.push([0, 12582]);
                ctl(65, 64);
                msg(144, key + 1, 124);
                ops.push([0, 6069]);
                ctl(64, 127);
                msg(128, key + 1, 96);
                ctl(65, 0);
                ops.push([1, 674]);
                ctl(64, 0);
                ctl(81, 0);
                ctl(99, 4);
                ctl(98, 5);
                ctl(101, 0);
                ctl(100, 0);
                ctl(6, 24);
                ctl(38, 16);
                for (const k of [33, 5, 37, 7, 39, 10, 42, 11, 43, 48, 49, 0, 32]) ctl(k, 77);
                msg(224, 55, 19);
                msg(208, 78);
                msg(160, 62, 108);
                ops.push([0, 4018]);
                ctl(123, 0);
                ctl(120, 0);
                ctl(121, 0);
            }
            ops.push([3, 512], [0, 22050], [4, 0], [0, 311], [1, 198]);
            requests.push(word(ops.length));
            for (const [j, [op, arg]] of ops.entries()) {
                requests.push(word(op), word(arg));
                let h = 0;
                switch (op) {
                    case 0: {
                        const b = new Int32Array((arg + 3) * (stereo ? 2 : 1)).fill(-374);
                        midi.DoMix(b, 2, arg);
                        h = hash(b);
                        break;
                    }
                    case 1:
                        midi.PretendToMix(arg);
                        break;
                    case 2:
                        midi['ProcessMidi2'](arg);
                        break;
                    case 3:
                        midi.QueueSetGlobalVolume(arg);
                        break;
                    case 4:
                        midi.QueueStopFile();
                        break;
                }
                answers.push([h, midi.IsPlayingFile(), midi.GetGlobalVolume(), channels(midi), voices(midi)].join(' '));
                labels.push(a + '/' + id + ' op ' + j + ' (' + op + ',' + arg + ')');
            }
        }
        requests.push(word(-1));
        const stream = new MidiPlayer();
        const savedSoundCount = Client.soundEffectCount;
        const savedSongs = Client.m_pMidi,
            savedJingles = Client.jingleArchive;
        const savedMusic = Object.getOwnPropertyDescriptors(MidiManager),
            savedState = { out: Client.out, midiSong: Client.midiSong, jingleActive: Client.jingleActive },
            savedVolume = Preferences.musicVolume;
        try {
            const songs = assets.archive(6),
                jingles = assets.archive(11),
                song = selected[0][1],
                jingle = selected[2][1];
            MidiManager.trackArchive = null;
            MidiManager.status = 0;
            MidiManager.trackGroupId = MidiManager.trackFileId = MidiManager.targetVolume = MidiManager.fadeSpeed = 0;
            MidiManager.loop = false;
            Client.midiSong = -1;
            Client.m_pMidi = songs;
            Client.jingleArchive = jingles;
            Client.jingleActive = false;
            Client.soundEffectCount = 0;
            Client.out = new SuperPacket(5000);
            Client.out.SetEnc(new Int32Array(4));
            MidiManager.Init(stream, assets.archive(14), assets.archive(15), assets.archive(4));
            stream.QueueSetDefInst(128, 9);
            PCMPlayer.m_frequency = 22050;
            PCMPlayer.m_stereo = false;
            const transitions: [number, number][] = [
                [0, 211],
                [1, song],
                [3, 0]
            ];
            for (let i = 0; i < 142; i++) transitions.push([4, 0]);
            transitions.push([5, 321], [7, 3], [1, song], [2, jingle], [3, 0], [3, 0], [4, 0]);
            for (let i = 0; i < 53; i++) transitions.push([4, 0]);
            transitions.push([1, song], [5, 4000000], [6, 0], [3, 0]);
            for (let i = 0; i < 142; i++) transitions.push([4, 0]);
            transitions.push([5, 14000000], [6, 0], [8, 0], [3, 0], [0, 0], [1, song], [2, jingle], [6, 0]);
            requests.push(word(transitions.length));
            for (const [op, arg] of transitions) {
                requests.push(word(op), word(arg));
                let loaded = false,
                    end = -1;
                switch (op) {
                    case 0:
                        Preferences.musicVolume = arg;
                        break;
                    case 1:
                        Client.PlaySong(arg);
                        break;
                    case 2:
                        Client.PlayJingle(arg, 203);
                        break;
                    case 3:
                        MidiManager.fade();
                        break;
                    case 4:
                        loaded = MidiManager.load();
                        break;
                    case 5:
                        stream.PretendToMix(arg);
                        break;
                    case 6:
                        Client.out.m_pos = 0;
                        Client.GlDoSoundsQueue();
                        if (Client.out.m_pos === 5) {
                            Client.out.m_pos = 1;
                            end = Client.out.g4();
                        }
                        break;
                    case 7:
                        MidiManager.SetVolume(arg);
                        break;
                    case 8:
                        MidiManager.stopImmediate();
                        break;
                }
                answers.push(
                    [
                        MidiManager.status,
                        MidiManager.trackArchive === songs ? 6 : MidiManager.trackArchive === jingles ? 11 : 0,
                        MidiManager.trackGroupId,
                        MidiManager.trackFileId,
                        MidiManager.loop,
                        MidiManager.targetVolume,
                        MidiManager.fadeSpeed,
                        Client.midiSong,
                        Client.jingleActive,
                        loaded,
                        end,
                        stream.GetGlobalVolume(),
                        stream.IsPlayingFile()
                    ].join(' ')
                );
                labels.push('music state op ' + op + '/' + arg);
            }
        } finally {
            Client.m_pMidi = savedSongs;
            Client.jingleArchive = savedJingles;
            Client.soundEffectCount = savedSoundCount;
            Object.defineProperties(MidiManager, savedMusic);
            Object.assign(Client, savedState);
            Preferences.musicVolume = savedVolume;
        }
        const files: Buffer[] = [];
        for (const a of archives) {
            const index = readGroup(cachePath, 255, a);
            files.push(word(index.length), Buffer.from(index), word(groups[a].size));
            for (const id of groups[a]) {
                const data = readGroup(cachePath, a, id);
                files.push(word(id), word(data.length), Buffer.from(data));
            }
        }
        const java = (s: string) => fileURLToPath(new URL('./game/' + s + '.java', import.meta.url));
        const build = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, java('PcmOracle'), java('MidiPcmOracle')]);
        expect(build.stderr.toString()).toBe('');
        const run = Bun.spawnSync(['java', '-Xmx256m', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'MidiPcmOracle'], { stdin: Buffer.concat([...files, ...requests]), maxBuffer: 4 * 1024 * 1024, timeout: 120000 });
        expect(run.stderr.toString()).toBe('');
        expect(run.exitCode).toBe(0);
        const lines = run.stdout.toString().trimEnd().split(/\r?\n/);
        expect(lines.length).toBe(answers.length);
        for (let i = 0; i < answers.length; i++) expect(answers[i], labels[i]).toBe(lines[i]);
    } finally {
        PCMPlayer.m_frequency = savedRate;
        PCMPlayer.m_stereo = savedStereo;
        rmSync(dir, { recursive: true, force: true });
    }
}, 180000);
