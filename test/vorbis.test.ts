import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import JagVorbis from '#/sound/JagVorbis.js';
import { glJar } from '#/client/ClientVariant.js';
import type Wave from '#/sound/Wave.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { localAssets, readGroup } from './cachefile.js';
import { cachePath, gamepackPath } from './reference.js';
import { hdGamepackPath, joglPath } from './render/hd-reference.js';

test('archive 14 Vorbis setup, packet float output, partial decode budgets and final samples match the gamepack', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vorbis530-'));
    const assets = localAssets(cachePath, [14]),
        a = assets.archive(14);
    // OpenRS2 cache 254's directory lists 394 and 538 but their sector entries are all zero.
    // Include these groups when using a fixture that contains their original bytes.
    const groups = [...requireNonNull(requireNonNull(assets.index(14)).groupIds)].filter(id => id !== 0 && ((id !== 394 && id !== 538) || readGroup(cachePath, 14, id).length !== 0));
    const ids = process.env.FULL_SOUND_530 ? groups : groups.filter((_, i) => i < 16 || i % 29 === 0);
    const parts: Buffer[] = [];
    function push(data: Uint8Array) {
        const len = Buffer.alloc(4);
        len.writeInt32BE(data.length);
        parts.push(len, Buffer.from(data));
    }
    push(requireNonNull(a.GetFile(0, 0)));
    for (const id of ids) push(requireNonNull(a.GetFile(0, id)));
    parts.push(Buffer.alloc(4, 255));
    try {
        const java = (n: string) => fileURLToPath(new URL('./game/' + n + '.java', import.meta.url));
        const build = Bun.spawnSync(['javac', '-d', dir, java('VorbisOracle')]);
        expect(build.stderr.toString()).toBe('');
        expect(build.exitCode).toBe(0);
        const classpath = [dir, ...(glJar ? [hdGamepackPath, joglPath] : [gamepackPath])].join(delimiter);
        const result = Bun.spawnSync(['java', '-Xmx256m', '-Djava.awt.headless=true', '-cp', classpath, 'VorbisOracle', glJar ? 'gl' : 'sd'], { stdin: Buffer.concat(parts), maxBuffer: 4 * 1024 * 1024, timeout: 120000 });
        expect(result.stderr.toString()).toBe('');
        expect(result.exitCode).toBe(0);
        const lines = result.stdout.toString().trimEnd().split(/\r?\n/);
        expect(lines.length).toBe(ids.length);
        for (let i = 0; i < ids.length; i++) {
            const first = requireNonNull(JagVorbis.Load(a, ids[i], 0));
            Reflect.set(first, 'previous', new Float32Array(Reflect.get(JagVorbis, 'm_blocksize1')));
            let hash = 1;
            for (let p = 0; p < Reflect.get(first, 'packets').length; p++) {
                const floats: Float32Array | null = Reflect.get(first, 'DecodeAudioPacket').call(first, p);
                const bits = floats === null ? null : new Int32Array(floats.buffer, floats.byteOffset, floats.length);
                hash = (Math.imul(31, hash) + (bits === null ? 0 : bits.reduce((s, n) => (Math.imul(31, s) + n) | 0, 1))) | 0;
            }
            const sample = requireNonNull(JagVorbis.Load(a, ids[i], 0)),
                budget = Int32Array.of(0);
            expect(sample.ToWaveMultistep(budget)).toBeNull();
            let pcm: Wave | null = null,
                state = '';
            for (const amount of [1, 2, 700, 255, 1, 9, 1536]) {
                budget[0] = amount;
                pcm = sample.ToWaveMultistep(budget);
                state += budget[0] + ':' + Reflect.get(sample, 'packetIndex') + ':' + Reflect.get(sample, 'writeIndex') + ',';
                if (pcm !== null) break;
            }
            pcm ??= requireNonNull(sample.ToWaveMultistep(null));
            const bytes = requireNonNull(pcm.samples);
            const digest = createHash('sha256').update(bytes).digest('hex');
            const songSample = requireNonNull(JagVorbis.Load(a, ids[i], 0));
            let ticks = '';
            do {
                budget[0] = 22050;
                pcm = songSample.ToWaveMultistep(budget);
                ticks += budget[0] + ':' + Reflect.get(songSample, 'packetIndex') + ':' + Reflect.get(songSample, 'writeIndex') + ',';
            } while (pcm === null);
            expect(createHash('sha256').update(requireNonNull(pcm.samples)).digest('hex')).toBe(digest);
            expect([hash, state, ticks, pcm.rate, pcm.loopStart, pcm.loopEnd, pcm.pingPong, bytes.length, digest].join(' '), 'archive 14/' + ids[i]).toBe(lines[i]);
        }
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}, 180000);
