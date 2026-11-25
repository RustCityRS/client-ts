import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Js5 from '#/cache/Js5.js';
import Js5Index from '#/cache/Js5Index.js';
import Crc32 from '#/io/Crc32.js';
import JagFX from '#/sound/JagFX.js';
import MidiPlayer from '#/sound/MidiPlayer.js';
import type MidiMixer from '#/sound/MidiMixer.js';
import MidiNote from '#/sound/MidiNote.js';
import type NativeAudioDevice from '#/sound/NativeAudioDevice.js';
import NativePcmPlayer from '#/sound/NativePcmPlayer.js';
import Patch from '#/sound/Patch.js';
import PCMPlayer from '#/sound/PCMPlayer.js';
import type PCMStream from '#/sound/PCMStream.js';
import Wave from '#/sound/Wave.js';
import WaveCache from '#/sound/WaveCache.js';
import WaveStream from '#/sound/WaveStream.js';
import { requireNonNull } from '#/util/JavaArray.js';
import Signlink from '#/util/Signlink.js';
import { localAssets } from './cachefile.js';
import { cachePath, gamepackPath } from './reference.js';

const array = (a: Int32Array | null) => (a === null ? 'null' : '[' + a.join(', ') + ']');
const stream = (pan: number) => requireNonNull(WaveStream.NewRateRawFineVolPan(new Wave(22050, new Int8Array(32), 1, 29), 256, 507, pan));
type Row = (...values: unknown[]) => void;

function pcm(row: Row) {
    const player = new PCMPlayer();
    player.capacity = 739;
    const samples = (player.samples = Int32Array.of(5, -2));
    const voice = stream(4321);
    player.SetInput(voice);
    player['streamTime'] = 591n;
    player['framesUntilSchedule'] = 378;
    const snapshot = (op: string) => row('base', op, player['AlreadyWritten'](), player['framesUntilSchedule'], player['stream'] === voice, player.samples === samples, array(samples), voice['position']);
    player.SubclassInit(null);
    snapshot('init');
    player.Open(9000);
    snapshot('open');
    player['write']();
    snapshot('write');
    player['DiscardBufferInner']();
    snapshot('flush');
    for (const count of [3, 0, 256, 256]) {
        player['PretendToGenerate'](count);
        row('skip', count, player['framesUntilSchedule'], voice['position'], player['streamTime']);
    }
    player.SetInput(null);
    for (const [before, count] of [
        [-2147483648, 1],
        [2147483647, -1],
        [0, -17]
    ]) {
        player['framesUntilSchedule'] = before;
        player['PretendToGenerate'](count);
        row('skip-silent', before, count, player['framesUntilSchedule']);
    }
}

function midi(row: Row) {
    const player = new MidiPlayer();
    const mixer = player.SubstreamStart() as MidiMixer;
    const first = stream(1000),
        second = stream(13000);
    row('empty', mixer.SelfMixCost(), player.SelfMixCost(), player.SubstreamNext() === null, first.SubstreamNext() === null, mixer.SubstreamStart() === null);
    for (const voice of [null, first, null, null, second, null]) {
        const note = new MidiNote();
        note.stream = voice;
        mixer.voices.push_back(note);
    }
    const id = (v: PCMStream | null) => (v === null ? '-' : v === first ? 'a' : v === second ? 'b' : '?');
    row('voices', id(mixer.SubstreamStart()), id(mixer.SubstreamNext()), id(mixer.SubstreamNext()), id(mixer.SubstreamStart()), id(mixer.SubstreamStart()), id(mixer.SubstreamNext()));
    for (const pan of [-2, 0, 8192, 16384]) {
        const voice = stream(1234);
        voice.RampVolPanFine(37, 901, pan);
        for (const gain of [-123, 0, 2147483647, -2147483648]) {
            voice['SetVolumeFine'](gain);
            row(
                'gain',
                pan,
                gain,
                voice['rightStep'],
                voice['gain'],
                voice['loopStart'],
                voice['pingPong'],
                voice['loopEnd'],
                voice['pan'],
                voice['rampRemaining'],
                voice['step'],
                voice['targetGain'],
                voice['loops'],
                voice['leftGain'],
                voice['leftStep'],
                voice['gainStep'],
                voice['rightGain'],
                voice['position']
            );
        }
    }
}

function nativeDevice(row: Row) {
    let shared: Int32Array | null;
    const device: NativeAudioDevice = {
        position(channel) {
            row('position', channel);
            return 1025 - 2 * channel;
        },
        flush(channel) {
            row('flush', channel);
        },
        close(channel) {
            row('close', channel);
        },
        write(channel, data) {
            row('write', channel, data === shared, array(data));
            if (data !== null) data[1] = channel - 45;
        },
        init() {
            throw new Error('unexpected init');
        },
        open() {
            throw new Error('unexpected open');
        }
    };
    const signlink = Object.create(Signlink.prototype) as Signlink;
    Reflect.set(signlink, 'audioDevice', device);
    const previous = NativePcmPlayer['device'];
    try {
        for (const channel of [0, 1]) {
            const player = new NativePcmPlayer(signlink, channel);
            shared = player.samples = Int32Array.of(-2147483648, 0, 2147483647);
            row('queued', player['AlreadyWritten']());
            player['write']();
            player['DiscardBufferInner']();
            player['Close']();
            row('after-device', array(player.samples));
            player.samples = null;
            player['write']();
        }
    } finally {
        NativePcmPlayer['device'] = previous;
    }
}

function constructors(row: Row) {
    const Synth = JagFX as unknown as new () => JagFX;
    const synth = new Synth(),
        tones = synth['tones'];
    row(
        'synth',
        synth['start'],
        synth['end'],
        tones.length,
        tones.every(x => x === null),
        new Synth()['tones'] !== tones
    );
    const patch = new Patch();
    row('patch', patch.params, patch.gains, patch.sampleIds, patch.groups, patch.sounds, patch.pans, patch.volume, patch.pitches, patch.next, patch.prev);
}

function cache(row: Row, effect: Uint8Array) {
    for (const single of [true, false]) {
        const bytes = Uint8Array.of(0, 0, 0, 0, 4, 5, 0, 0, 0);
        const index = new Js5Index(bytes, Crc32.prefix(bytes, bytes.length));
        index.fileCapacities = Int32Array.from(single ? [2] : [2, 1]);
        index.capacity = index.fileCapacities.length;
        const archive = new Js5(null, false, false);
        archive['index'] = index;
        archive['packed'] = new Array(index.capacity).fill(null);
        archive['unpacked'] = single ? [[null, effect]] : [null, [effect]];
        const cache = new WaveCache(archive, null);
        let saved: Wave | null = null;
        for (const budget of [Int32Array.of(0), Int32Array.of(17), Int32Array.of(-99), new Int32Array(0), null]) {
            const wave = cache.GetJagFx(1, budget);
            const samples = wave?.samples;
            const description = wave && samples ? [wave.rate, wave.loopStart, wave.loopEnd, samples.length, createHash('sha256').update(samples).digest('hex')].join(',') : '-';
            row('cache', single, array(budget), description, wave !== null && wave === saved);
            saved = wave;
        }
        if (single) row('missing', cache.GetJagFx(9, Int32Array.of(1)) === null);
        else {
            expect(() => cache.GetJagFx(9, Int32Array.of(1))).toThrow('Ambiguous synth group');
            row('missing', 'ambiguous');
        }
        expect(() => new WaveCache(archive, null).GetJagFx(1, new Int32Array(0))).toThrow(RangeError);
        row('cold-empty-budget', 'bounds');
    }
}

test('SD PCM device, MIDI traversal, wave gain and real synth cache match the original gamepack', () => {
    const directory = mkdtempSync(join(tmpdir(), 'sd-audio-members-'));
    try {
        const assets = localAssets(cachePath, [4]);
        const effect = requireNonNull(assets.file(4, 1));
        const input = join(directory, 'effect');
        writeFileSync(input, effect);
        const source = fileURLToPath(new URL('./game/SdAudioMemberOracle.java', import.meta.url));
        const compile = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', directory, source]);
        expect(compile.exitCode, compile.stderr.toString()).toBe(0);
        const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', directory + delimiter + gamepackPath, 'SdAudioMemberOracle', input]);
        expect(java.exitCode, java.stderr.toString()).toBe(0);
        const rows: string[] = [],
            row: Row = (...values) => {
                rows.push(values.map(String).join('|'));
            };
        pcm(row);
        midi(row);
        nativeDevice(row);
        constructors(row);
        cache(row, effect);
        expect(rows).toEqual(java.stdout.toString().trimEnd().split(/\r?\n/));
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
}, 45000);
