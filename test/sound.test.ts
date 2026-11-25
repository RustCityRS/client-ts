import { requireNonNull } from '../src/util/JavaArray.js';
import { gamepackPath, cachePath } from './reference.js';
import { expect, test } from 'bun:test';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import Envelope from '../src/sound/Envelope.js';
import JagFX from '../src/sound/JagFX.js';
import { localAssets } from './cachefile.js';

test('envelope reset writes the five generation fields in SD eb.a()V and HD ff.a()V order', () => {
    const writes: [PropertyKey, number][] = [];
    const envelope = new Proxy(new Envelope(), {
        set(target, key, value: number, receiver) {
            writes.push([key, value]);
            return Reflect.set(target, key, value, receiver);
        }
    });
    envelope.GenInit();
    expect(writes).toEqual([
        ['threshold', 0],
        ['segment', 0],
        ['step', 0],
        ['amplitude', 0],
        ['ticks', 0]
    ]);
});

test.skipIf(!cachePath || !gamepackPath)(
    'archive 4 synthesizer matches every PCM sample and loop point from vd.b',
    () => {
        const assets = localAssets(cachePath, [4]);
        const groups = requireNonNull(requireNonNull(assets.index(4)).groupIds);
        const ids = process.env.FULL_SOUND_530 ? [...groups] : [...new Set([...groups.slice(0, 16), ...groups.filter((_, i) => i % 103 === 0)])];
        const parts: Buffer[] = [];
        for (const id of ids) {
            const bytes = requireNonNull(assets.file(4, id));
            const len = Buffer.alloc(4);
            len.writeInt32BE(bytes.length);
            parts.push(len, Buffer.from(bytes));
        }
        parts.push(Buffer.alloc(4, 255));
        const source = fileURLToPath(new URL('./game/SoundOracle.java', import.meta.url));
        const java = Bun.spawnSync(['java', '-Xmx256m', '-Djava.awt.headless=true', '-cp', gamepackPath, source], { stdin: Buffer.concat(parts), timeout: 150000 });
        expect(java.stderr.toString()).toBe('');
        const lines = java.stdout.toString().trimEnd().split(/\r?\n/);
        expect(lines.length).toBe(ids.length);
        for (let i = 0; i < ids.length; i++) {
            const id = ids[i],
                effect = requireNonNull(JagFX.load(assets.archive(4), id, 0));
            const delay = effect.trimDelay(),
                pcm = effect.toPcm();
            const samples = requireNonNull(pcm.samples),
                hash = createHash('sha256').update(samples).digest('hex');
            expect([delay, pcm.rate, pcm.loopStart, pcm.loopEnd, samples.length, hash].join(' '), 'group 4/' + id).toBe(lines[i]);
        }
    },
    process.env.FULL_SOUND_530 ? 600000 : 45000
);
