import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import MidiParser from '#/sound/MidiParser.js';
import MidiFile from '#/sound/MidiFile.js';
import Patch from '#/sound/Patch.js';
import type EnvelopeSet from '#/sound/EnvelopeSet.js';
import PacketT from '#/io/PacketT.js';
import { arrayAt, requireNonNull } from '#/util/JavaArray.js';
import { localAssets } from './cachefile.js';
import { cachePath, gamepackPath } from './reference.js';

test('original packed music, per-note instrument envelopes, usage masks and every scheduled MIDI event match Java', () => {
    const dir = mkdtempSync(join(tmpdir(), 'music530-'));
    try {
        const assets = localAssets(cachePath, [6, 11, 15]),
            parts: Buffer[] = [],
            answers: string[] = [],
            ids: string[] = [];
        const fold = (state: number, n: number) => (Math.imul(31, state) + n) | 0;
        const hash = (values: ArrayLike<number> | null) => (values === null ? 0 : Array.from(values).reduce(fold, 1));
        for (const a of [15, 6, 11])
            for (const [index, group] of requireNonNull(requireNonNull(assets.index(a)).groupIds).entries()) {
                if (!process.env.FULL_SOUND_530 && a !== 15 && index > 12 && index % 41 !== 0) continue;
                const bytes = requireNonNull(assets.archive(a).GetFile(0, group)),
                    header = Buffer.alloc(8);
                header.writeInt32BE(a);
                header.writeInt32BE(bytes.length, 4);
                parts.push(header, Buffer.from(bytes));
                ids.push(a + '/' + group);
                if (a === 15) {
                    const p = new Patch(bytes),
                        params: (EnvelopeSet | null)[] = [];
                    let h = 1;
                    for (const d of requireNonNull(p.params)) {
                        if (!params.includes(d)) params.push(d);
                        h = fold(h, params.indexOf(d));
                    }
                    const row: (string | number)[] = [p.volume, hash(p.pitches), hash(p.gains), hash(p.pans), hash(p.groups), hash(p.sampleIds), h];
                    for (const d of params)
                        if (d !== null) row.push('[' + [d.volumeKeyScale, d.vibratoRate, d.vibratoDepth, d.decay, d.vibratoDelay, d.decayKeyScale, d.releaseKeyScale, hash(d.volumeEnvelope), hash(d.releaseEnvelope)].join(', ') + ']');
                    answers.push(row.join(' '));
                } else {
                    const packet = new PacketT(bytes),
                        song = new MidiFile(packet);
                    song.prepare();
                    const instruments = requireNonNull(song.instruments);
                    let used = 1;
                    for (let mask = instruments.head(); mask !== null; mask = instruments.next()) {
                        used = fold(used, Number(mask.key));
                        used = fold(used, hash(mask.data));
                    }
                    const reader = new MidiParser(song.midi);
                    let h = 1,
                        n = 0;
                    reader.Restart(982538874n);
                    while (!reader.AllTracksFinished()) {
                        const track = reader.NextTrackToPlay();
                        reader.SetTrack(track);
                        const tick = arrayAt(reader.ticks, track),
                            msg = reader.GetEvent(track),
                            time = reader.TimeFromTick(tick);
                        h = fold(fold(fold(fold(h, track), tick), msg), Number(BigInt.asIntN(32, time ^ (time >> 32n))));
                        if (msg === 1) reader.FinishTrack();
                        else reader.ProcessDeltaTime(track);
                        reader.UnsetTrack(track);
                        n++;
                    }
                    answers.push([packet.m_pos, createHash('sha256').update(song.midi).digest('hex'), used, n, h].join(' '));
                }
            }
        parts.push(Buffer.alloc(4, 255));
        const java = (n: string) => fileURLToPath(new URL('./game/' + n + '.java', import.meta.url));
        const build = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, java('PcmOracle'), java('MusicDataOracle')]);
        expect(build.stderr.toString()).toBe('');
        const result = Bun.spawnSync(['java', '-Xmx256m', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'MusicDataOracle'], { stdin: Buffer.concat(parts), maxBuffer: 4 * 1024 * 1024, timeout: 120000 });
        expect(result.stderr.toString()).toBe('');
        expect(result.exitCode).toBe(0);
        const lines = result.stdout.toString().trimEnd().split(/\r?\n/);
        expect(lines.length).toBe(answers.length);
        for (let i = 0; i < answers.length; i++) expect(answers[i], ids[i]).toBe(lines[i]);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}, 180000);
