import { JavaError } from '#/util/ClientError.js';
import { expect, spyOn } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Js5 from '#/cache/Js5.js';
import Js5Index from '#/cache/Js5Index.js';
import Crc32 from '#/io/Crc32.js';
import PacketT from '#/io/PacketT.js';
import MidiFile from '#/sound/MidiFile.js';
import MidiManager from '#/sound/MidiManager.js';
import MidiPlayer from '#/sound/MidiPlayer.js';
import WaveCache from '#/sound/WaveCache.js';
import { loginFixture } from './login-fixture.js';
import { gamepackPath } from './reference.js';

type Row = [number, number, number, number, number, number, string];
function container(bytes: number[]): Uint8Array {
    return Uint8Array.of(0, 0, 0, 0, bytes.length, ...bytes);
}
const empty = [7, 0, 1, 0, 96],
    notes = [0, 7, 0, 0, 60, 100, 1, 0, 96];
const table = container([5, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0]);

loginFixture(
    import.meta.url,
    'single-request MIDI state, fade and load preserve the Java stop, retry and archive-callback order',
    async () => {
        const rows: Row[] = [];
        for (const status of [-1, 0, 1, 2, 3])
            for (const flags of [0, 1, 128, 129, 256, 384]) {
                for (const [volume, fade] of [
                    [0, 2],
                    [31, 63],
                    [2147483647, -3],
                    [-2147483648, -17]
                ]) {
                    rows.push([status, 0, flags, 0, volume, fade, 'rfsvpfqfir']);
                }
            }
        for (const preload of [0, 1, 2, 3])
            for (const flags of [0, 1, 2, 4, 8, 14, 16, 31, 32, 64, 80, 96, 128, 256]) {
                for (const callback of [0, 1, 2, 4, 8, 15, 16]) rows.push([2, preload, flags, callback, 254, 60, 'llr']);
            }
        const dir = mkdtempSync(join(tmpdir(), 'rs530-midi-manager-'));
        let expected: string[];
        try {
            const compile = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game', 'MidiManagerOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const java = Bun.spawnSync(['java', '-cp', dir + delimiter + gamepackPath, 'MidiManagerOracle'], {
                stdin: Buffer.from(rows.map(row => row.join(' ')).join('\n') + '\n'),
                timeout: 20000,
                maxBuffer: 12 * 1024 * 1024
            });
            expect(java.exitCode, java.stderr.toString()).toBe(0);
            expected = java.stdout.toString().trimEnd().split(/\r?\n/);
            expect(expected.length).toBe(rows.length);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }

        const printed = spyOn(console, 'error').mockImplementation(() => {});
        try {
            for (const [index, [status, preload, flags, callbacks, volume, fade, sequence]] of rows.entries()) {
                const first = new MidiPlayer(),
                    second = new MidiPlayer();
                first.QueueSetGlobalVolume(volume);
                second.QueueSetGlobalVolume(986);
                let reads = '';
                const js5 = (patch: boolean) =>
                    new Js5(
                        {
                            index: () => new Js5Index(table, Crc32.prefix(table, table.length)),
                            GetGroupLoadPercentage: () => 100,
                            prefetchGroup: () => {},
                            group: () => {
                                reads += patch ? 'p' : 's';
                                if (callbacks & 16) throw new JavaError('archive');
                                if (patch) {
                                    if (callbacks & 1) MidiManager['stream'] = second;
                                    if (callbacks & 2) MidiManager['track'] = null;
                                    if (callbacks & 4) MidiManager['m_pPatches'] = null;
                                    return null;
                                }
                                if (callbacks & 8) MidiManager['stream'] = second;
                                return flags & 32 ? null : container(flags & 64 ? notes : empty);
                            }
                        },
                        true,
                        true
                    );
                const songs = js5(false),
                    patches = js5(true);
                const initial = new MidiFile(new PacketT(Uint8Array.from(preload === 2 ? notes : empty)));
                if (flags & 128) first.QueuePlayFile(initial, true);
                if (preload === 3) initial.midi = new Uint8Array(0);
                MidiManager.Init(flags & 1 ? null : first, flags & 2 ? null : songs, flags & 4 ? null : patches, flags & 8 ? null : songs);
                MidiManager['cache'] = flags & 16 ? new WaveCache(MidiManager['m_pJagFX'], MidiManager['m_pVorbis']) : null;
                MidiManager['track'] = preload === 0 ? null : initial;
                MidiManager.status = status;
                MidiManager.trackArchive = flags & 256 ? null : songs;
                MidiManager.trackGroupId = MidiManager.trackFileId = 0;
                MidiManager.loop = true;
                MidiManager.targetVolume = 127;
                MidiManager.fadeSpeed = fade;
                const stages: string[] = [];
                for (const action of sequence) {
                    reads = '';
                    printed.mockClear();
                    let result = 'ok';
                    try {
                        switch (action) {
                            case 's':
                                MidiManager.Stop(fade);
                                break;
                            case 'p':
                                MidiManager.Play(volume, fade, songs, false, 0, 0);
                                break;
                            case 'q':
                                MidiManager.queue(0, true, 0, songs, volume);
                                break;
                            case 'i':
                                MidiManager.stopImmediate();
                                break;
                            case 'v':
                                MidiManager.SetVolume(volume);
                                break;
                            case 'r':
                                result = String(MidiManager.IsPlaying());
                                break;
                            case 'f':
                                MidiManager.fade();
                                break;
                            case 'l':
                                result = String(MidiManager.load());
                                break;
                        }
                    } catch (error) {
                        if (error instanceof JavaError) result = 'java-error';
                        else if (error instanceof TypeError) result = 'null-ref';
                        else throw error;
                    }
                    const stream = MidiManager['stream'],
                        track = MidiManager['track'];
                    stages.push(
                        [
                            result,
                            printed.mock.calls.length > 0,
                            reads,
                            MidiManager.status,
                            MidiManager.trackArchive !== null,
                            MidiManager.trackGroupId,
                            MidiManager.trackFileId,
                            MidiManager.loop,
                            MidiManager.targetVolume,
                            MidiManager.fadeSpeed,
                            MidiManager['cache'] !== null,
                            track === null ? 0 : track === initial ? 1 : 2,
                            track !== null && track.instruments !== null,
                            stream === null ? 0 : stream === first ? 1 : 2,
                            first.GetGlobalVolume(),
                            first.IsPlayingFile(),
                            second.GetGlobalVolume(),
                            second.IsPlayingFile()
                        ].join(':')
                    );
                }
                expect(stages.join(';'), rows[index].join(' ')).toBe(expected[index]);
            }
        } finally {
            printed.mockRestore();
        }
    },
    30000
);
