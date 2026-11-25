import TitleScreen from '#/title/TitleScreen.js';
import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Js5 from '#/cache/Js5.js';
import Client from '#/client/Client.js';
import GameShell from '#/client/GameShell.js';
import AudioEngine from '#/sound/AudioEngine.js';
import DevicePcmPlayer, { LineUnavailableError } from '#/sound/DevicePcmPlayer.js';
import MidiManager from '#/sound/MidiManager.js';
import NativePcmPlayer from '#/sound/NativePcmPlayer.js';
import PCMPlayer from '#/sound/PCMPlayer.js';
import type PCMStream from '#/sound/PCMStream.js';
import PlayerTask from '#/sound/PlayerTask.js';
import LocalisedText from '#/ui/LocalisedText.js';
import Preferences from '#/ui/Preferences.js';
import Signlink from '#/util/Signlink.js';
import SignlinkRequest from '#/util/SignlinkRequest.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { gamepackPath } from './reference.js';

async function trace(mode: string, stereo: boolean): Promise<string[]> {
    const result: string[] = [];
    let lines = 0;
    const app = new Client();
    const first = Object.create(Signlink.prototype) as Signlink,
        second = Object.create(Signlink.prototype) as Signlink;
    const canvas = {},
        replacement = {};
    const provider = {
        index() {
            note('index');
            if (mode === 'indexerror') throw new Error();
            return null;
        },
        group() {
            throw new Error();
        },
        prefetchGroup() {},
        GetGroupLoadPercentage() {
            return 0;
        }
    };
    const samples = new Js5(provider, false, false),
        patches = new Js5(provider, false, false),
        effects = new Js5(provider, false, false);
    const archive = (a: Js5 | null) => (a === null ? '-' : a === samples ? 's' : a === patches ? 'p' : a === effects ? 'e' : '?');
    const player = (p: PCMPlayer | null, input: PCMStream | null) => {
        if (p === null) return '-';
        const kind = p instanceof DevicePcmPlayer ? 'ua' : p instanceof NativePcmPlayer ? 'qb' : 'dg';
        return [kind, p.requestedFrames, p.capacity, p.samples?.length ?? -1, Number(p['stream'] !== null && p['stream'] === input)].join('/');
    };
    function note(phase: string) {
        const task = PlayerTask.active;
        const workers = task === null ? '-' : (task.signlink === first ? 'a' : task.signlink === second ? 'b' : '?') + (task.players[0] === null ? '-' : '0') + (task.players[1] === null ? '-' : '1');
        result.push(
            mode +
                '/' +
                stereo +
                ' ' +
                phase +
                ':' +
                [
                    Client.loadingStage,
                    TitleScreen.m_loadPos,
                    Client.titleSong,
                    Number(TitleScreen.m_loadString === LocalisedText.preparedSoundEngine),
                    PCMPlayer.m_frequency,
                    Number(PCMPlayer.m_stereo),
                    PCMPlayer.threadPriority,
                    AudioEngine.music?.['initialPrograms'][9] ?? -1,
                    player(AudioEngine.musicPlayer, AudioEngine.music),
                    MidiManager['stream'] === null ? 0 : MidiManager['stream'] === AudioEngine.music ? 1 : 2,
                    archive(MidiManager['m_pVorbis']) + archive(MidiManager['m_pPatches']) + archive(MidiManager['m_pJagFX']),
                    player(AudioEngine.effectsPlayer, AudioEngine.effects),
                    Number(AudioEngine.effects !== null),
                    Number(AudioEngine.decimator !== null),
                    workers
                ].join(',')
        );
    }
    for (const [link, id] of [
        [first, 'a'],
        [second, 'b']
    ] as const) {
        link.startThread = () => new SignlinkRequest();
        link.getAudioDevice = () => {
            if (mode === 'absent' && id === 'a') {
                return null;
            } else {
                return {
                    init(_s, component, rate) {
                        note('nativeInit' + id + '/' + (component === canvas ? 'c' : component === replacement ? 'r' : '-') + '/' + rate);
                    },
                    open(channel, cap) {
                        note('nativeOpen' + id + '/' + channel + '/' + cap);
                        if (mode === 'nativeerror' && channel === 1) throw new Error();
                    },
                    close() {},
                    flush() {},
                    position() {
                        return 0;
                    },
                    write() {}
                };
            }
        };
    }
    DevicePcmPlayer.audioSystem = {
        getMixerNames() {
            return [];
        },
        getLine(format, capacity) {
            const i = lines++;
            note('line' + i + '/' + capacity + '/' + requireNonNull(format).channels);
            if (i === 0 && mode === 'swap') {
                GameShell.signlink = second;
                GameShell.canvas = replacement;
            }
            if (mode.startsWith('native') || mode === 'absent' || mode === 'swap' || (mode === 'retry' && i === 1)) throw new LineUnavailableError();
            return {
                open() {},
                start() {
                    note('start' + i);
                    if (i === 0 && mode === 'rate') PCMPlayer.m_frequency = 0;
                },
                available() {
                    return capacity;
                },
                write() {},
                close() {
                    if (mode === 'pref') {
                        note('close' + i);
                        if (i === 1) Preferences.stereo = stereo;
                    }
                },
                flush() {}
            };
        }
    };
    PlayerTask.active = null;
    GameShell.signlink = first;
    GameShell.canvas = canvas;
    AudioEngine.musicPlayer = AudioEngine.effectsPlayer = null;
    AudioEngine.music = null;
    AudioEngine.decimator = null;
    AudioEngine.effects = null;
    MidiManager.Init(null, null, null, null);
    Client.vorbisArchive = mode === 'archives' ? null : samples;
    Client.instrumentsArchive = mode === 'archives' ? null : patches;
    Client.m_pJagFx = mode === 'archives' ? null : effects;
    Client.m_pMidi = mode === 'title' ? null : new Js5(provider, false, false);
    Client.loadingStage = 45;
    TitleScreen.m_loadPos = 19;
    Client.titleSong = 721;
    TitleScreen.m_loadString = LocalisedText.checkingForUpdates;
    Preferences.safeMode = true;
    Preferences.stereo = stereo;
    if (mode === 'busy') {
        PlayerTask.active = new PlayerTask();
        PlayerTask.active.signlink = first;
        PlayerTask.active.players[0] = new PCMPlayer();
    }
    let failed = false;
    try {
        await app['MainLoad']();
    } catch {
        failed = true;
    }
    note(failed ? 'failed' : 'done');
    if (mode === 'pref') {
        Preferences.stereo = !stereo;
        AudioEngine.setStereo(1);
        note('changed');
    }
    return result;
}

if (process.argv.includes('--audio-trace')) {
    for (const mode of 'ok retry native nativeerror absent swap busy rate archives title indexerror pref'.split(' ')) {
        for (const stereo of [false, true]) console.log((await trace(mode, stereo)).join('\n'));
    }
} else
    test('stage 45 opens PCM lines, binds MIDI archives and exposes partial failures in original order', () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-audio-stage-'));
        const access = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED'];
        try {
            const run = (args: string[]) => {
                const p = Bun.spawnSync(args, { maxBuffer: 8 * 1024 * 1024 });
                if (p.exitCode !== 0) throw Error(p.stderr.toString());
                return p.stdout.toString().trim().split(/\r?\n/);
            };
            run(['javac', ...access, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game', 'AudioLoadingOracle.java')]);
            const java = ['java', ...access, '-Djava.awt.headless=false', '-cp', dir + delimiter + gamepackPath, 'AudioLoadingOracle'];
            run([...java, gamepackPath, dir]);
            const reference = run(java),
                actual = run([process.execPath, import.meta.path, '--audio-trace']);
            expect(actual.length).toBe(reference.length);
            for (const [i, line] of reference.entries()) expect(actual[i], line).toBe(line);
        } finally {
            rmSync(dir, { force: true, recursive: true });
        }
    }, 30000);
