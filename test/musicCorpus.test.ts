import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import MidiPlayer from '#/sound/MidiPlayer.js';
import MidiFile from '#/sound/MidiFile.js';
import Patch from '#/sound/Patch.js';
import WaveCache from '#/sound/WaveCache.js';
import PCMPlayer from '#/sound/PCMPlayer.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { localAssets, readGroup, cacheAssets } from './cachefile.js';
import { cachePath, gamepackPath } from './reference.js';

test('packed songs run to their end at Java timing and mix the same PCM chunks', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'midi530-corpus-')),
        rate = PCMPlayer.m_frequency,
        stereo = PCMPlayer.m_stereo;
    try {
        const ids = [4, 6, 11, 14, 15],
            tables = new Map(ids.map(a => [a, readGroup(cachePath, 255, a)]));
        const reference = localAssets(cachePath, ids),
            groups = Array.from({ length: 16 }, () => new Map<number, Uint8Array>());
        const all = Boolean(process.env.FULL_MIDI_530 || process.env.FULL_MIDI_PCM_530);
        const tracks = (a: number) => (all ? requireNonNull(requireNonNull(reference.index(a)).groupIds) : a === 6 ? Int32Array.of(13) : requireNonNull(requireNonNull(reference.index(a)).groupIds).slice(0, 1));
        const load = (a: number, id: number) => {
            const bytes = readGroup(cachePath, a, id);
            if (bytes.length > 0) groups[a].set(id, bytes);
        };
        load(14, 0);
        const patches = new Map<number, Patch>();
        for (const a of [6, 11])
            for (const id of tracks(a)) {
                load(a, id);
                const track = requireNonNull(MidiFile.Load(reference.archive(a), id, 0));
                track.prepare();
                const instruments = requireNonNull(track.instruments);
                for (let mask = instruments.head(); mask !== null; mask = instruments.next()) {
                    const program = Number(mask.key);
                    let patch = patches.get(program);
                    if (!patch) {
                        load(15, program);
                        patch = requireNonNull(Patch.Load(program, reference.archive(15)));
                        patches.set(program, patch);
                    }
                    const used = requireNonNull(mask.data),
                        samples = requireNonNull(patch.sampleIds);
                    for (let key = 0; key < used.length; key++) {
                        const v = samples[key] - 1;
                        if (used[key] === 0 || v < 0) continue;
                        const bank = (v & 1) === 0 ? 4 : 14,
                            g = v >> 2;
                        if (!groups[bank].has(g)) load(bank, g);
                    }
                }
            }
        const word = (v: number) => {
            const b = Buffer.alloc(4);
            b.writeInt32BE(v);
            return b;
        };
        const input: Buffer[] = [];
        for (const a of ids) {
            const table = requireNonNull(tables.get(a));
            input.push(word(table.length), Buffer.from(table), word(groups[a].size));
            for (const [group, bytes] of groups[a]) input.push(word(group), word(bytes.length), Buffer.from(bytes));
        }
        const full = !all || Boolean(process.env.FULL_MIDI_PCM_530);
        input.push(Buffer.of(+full));
        for (const a of [6, 11]) {
            const rows = tracks(a);
            input.push(word(rows.length), ...Array.from(rows, word));
        }
        const java = (n: string) => fileURLToPath(new URL('./game/' + n + '.java', import.meta.url));
        const build = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, java('PcmOracle'), java('MidiPcmOracle'), java('MusicCorpusOracle')]);
        expect(build.stderr.toString()).toBe('');
        const proc = Bun.spawn(['java', '-Xmx400m', '-cp', dir + delimiter + gamepackPath, 'MusicCorpusOracle'], { stdin: Buffer.concat(input), stdout: 'pipe', stderr: 'pipe' });
        const javaResult = Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
        const assets = cacheAssets(tables, (a, g) => groups[a].get(g) ?? null);
        const cache = new WaveCache(assets.archive(4), assets.archive(14)),
            actual: string[] = [];
        PCMPlayer.m_frequency = 22050;
        PCMPlayer.m_stereo = false;
        const hash = (b: Int32Array) => {
            let h = 1;
            for (let i = 0; i < b.length; i++) h = (Math.imul(h, 31) + b[i]) | 0;
            return h;
        };
        for (const a of [6, 11]) {
            for (const id of tracks(a)) {
                const track = requireNonNull(MidiFile.Load(assets.archive(a), id, 0)),
                    midi = new MidiPlayer();
                midi.QueueSetDefInst(128, 9);
                expect(midi.LoadAndQueuePatches(cache, 0, assets.archive(15), track), a + '/' + id + ' samples').toBe(true);
                midi.QueueDropWaveIds();
                midi.QueuePlayFile(track, false);
                let n = 0,
                    pcm = 1,
                    transport = 1;
                const b = new Int32Array(PCMPlayer.m_frequency);
                do {
                    if (full || n % 13 === 0 || a === 11) {
                        b.fill(0);
                        midi.DoMix(b, 0, b.length);
                        pcm = (Math.imul(31, pcm) + hash(b)) | 0;
                    } else midi.PretendToMix(b.length);
                    transport = (Math.imul(31, transport) + Number(midi.IsPlayingFile())) | 0;
                    if (++n >= 1800) throw new Error('runaway track ' + a + '/' + id);
                } while (midi.IsPlayingFile());
                b.fill(0);
                midi.DoMix(b, 0, b.length);
                pcm = (Math.imul(31, pcm) + hash(b)) | 0;
                actual.push([a + '/' + id, n, pcm, transport].join(' '));
            }
        }
        const [stdout, stderr, exit] = await javaResult;
        expect(stderr).toBe('');
        expect(exit).toBe(0);
        const expected = stdout.trimEnd().split(/\r?\n/);
        expect(expected.length).toBe(actual.length);
        expect(actual.filter((line, i) => line !== expected[i]).map(line => [line, expected[actual.indexOf(line)]])).toEqual([]);
    } finally {
        PCMPlayer.m_frequency = rate;
        PCMPlayer.m_stereo = stereo;
        rmSync(dir, { recursive: true, force: true });
    }
}, 7200000);
