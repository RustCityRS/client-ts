import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';
import WaveStream from '#/sound/WaveStream.js';
import PCMPlayer from '#/sound/PCMPlayer.js';
import Mixer from '#/sound/Mixer.js';
import Wave from '#/sound/Wave.js';
import Decimator from '#/sound/Decimator.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { gamepackPath } from './reference.js';

const samples = Int8Array.from({ length: 23 }, (_, i) => i * 79 - 77);
const hash = (a: ArrayLike<number>) => Array.from(a).reduce((v, n) => (Math.imul(31, v) + n) | 0, 1);

test('original PCM resampler, all sixteen mixer kernels, skip, ramps and stream lifetime match after every operation', () => {
    const saved = [PCMPlayer.m_frequency, +PCMPlayer.m_stereo];
    const commands: string[] = [],
        actual: string[] = [];
    const mixer = new Mixer();
    let current: WaveStream | null = null;
    const sound = () => requireNonNull(current);
    function run(op: string, ...v: number[]) {
        commands.push([op, ...v].join(' '));
        let buffer: Int32Array | null = null,
            error = '';
        try {
            switch (op) {
                case 'resample': {
                    const dec = new Decimator(v[0], v[1]),
                        src = new Wave(v[2], samples, v[3], v[4], Boolean(v[5]));
                    const result = src.Decimate(dec);
                    const table = (dec as unknown as { table: Int32Array[] | null }).table;
                    actual.push([table === null ? 0 : hash(table.map(hash)), hash(requireNonNull(result.samples)), result.samples === samples, result === src, result.rate, result.loopStart, result.loopEnd, result.pingPong].join(' '));
                    return;
                }
                case 'new': {
                    if (current !== null) mixer.StopStream(current);
                    PCMPlayer.m_stereo = Boolean(v[0]);
                    PCMPlayer.m_frequency = 22050;
                    current = WaveStream.NewRateRawFineVolPan(new Wave(22050, samples, v[1], v[2], Boolean(v[3])), v[4], v[5], v[6]);
                    mixer.PlayStream(sound());
                    break;
                }
                case 'factory':
                    if (current !== null) mixer.StopStream(current);
                    PCMPlayer.m_stereo = false;
                    PCMPlayer.m_frequency = v[1];
                    current = WaveStream.NewRatePercent(new Wave(v[0], samples, 3, 16), v[2], v[3]);
                    mixer.PlayStream(sound());
                    break;
                case 'loops':
                    sound().SetLoopCount(v[0]);
                    break;
                case 'position':
                    sound().SetPositionFine(v[0]);
                    break;
                case 'reverse':
                    sound().SetReverse(Boolean(v[0]));
                    break;
                case 'speed':
                    sound().SetRateRaw(v[0]);
                    break;
                case 'volume':
                    sound().ApplyVolume(v[0]);
                    break;
                case 'rampVolume':
                    sound().RampVolumeFine(v[0], v[1]);
                    break;
                case 'ramp':
                    sound().RampVolPanFine(v[0], v[1], v[2]);
                    break;
                case 'fade':
                    sound().RampOut(v[0]);
                    break;
                case 'active':
                    sound().active = Boolean(v[0]);
                    break;
                case 'skip':
                    mixer.PretendToMix(v[0]);
                    break;
                case 'directSkip':
                    sound().PretendToMix(v[0]);
                    break;
                case 'fill':
                case 'directFill':
                    buffer = v[0] < 0 ? null : Int32Array.from({ length: v[0] }, (_, i) => 2147483647 - 1003 * i);
                    if (op === 'fill') mixer.DoMix(buffer, v[1], v[2]);
                    else sound().DoMix(buffer, v[1], v[2]);
                    break;
                default:
                    throw Error(op);
            }
        } catch (e) {
            if (e instanceof RangeError) error = e.message.includes('zero') ? 'arithmetic' : 'bounds';
            else if (e instanceof TypeError) error = 'null';
            else throw e;
        }
        const s = sound(),
            fields = ['rightStep', 'gain', 'loopStart', 'pingPong', 'loopEnd', 'pan', 'rampRemaining', 'step', 'targetGain', 'loops', 'leftGain', 'leftStep', 'gainStep', 'rightGain', 'position'];
        actual.push(
            error +
                '|' +
                (buffer === null ? 'null' : '[' + buffer.join(', ') + ']') +
                '|' +
                [...fields.map(f => Reflect.get(s, f)), s.IsLinked(), s.Priority(), s.SelfMixCost(), s.Isfinished(), s.Isramping(), s.GetVolumeFine(), s.GetPanFine(), s.GetRateRaw()].join(' ')
        );
    }
    const dir = mkdtempSync(join(tmpdir(), 'pcm530-'));
    try {
        for (const [input, output] of [
            [22050, 22050],
            [0, 0],
            [22050, 44100],
            [44100, 22050],
            [22050, 48000],
            [48000, 22050],
            [23, 7],
            [9, 0],
            [79, 103],
            [1, 611]
        ]) {
            for (const [start, end] of [
                [0, 0],
                [1, 2],
                [13, 19],
                [-2147483648, 2147483647]
            ])
                run('resample', input, output, -2147483648, start, end, 1);
        }
        for (const rate of [22050, 44100, 2147483647, -2147483648]) for (const percent of [100, -1, 2147483647, -2147483648]) run('factory', rate, 22050, percent, 240);
        for (const stereo of [0, 1])
            for (const step of [-768, -256, -123, 0, 123, 256, 768])
                for (const ping of [0, 1])
                    for (const loops of [-1, 0, 1, 3])
                        for (const ramp of [0, 1]) {
                            run('new', stereo, 4, 18, ping, step, ramp ? 801 : 16022, 8192);
                            run('loops', loops);
                            run('position', step < 0 ? 17 * 256 : 4 * 256);
                            if (ramp) run('ramp', 31, 16383, 234);
                            run('fill', 36, 1, 15);
                            run('fill', 28, 2, 10);
                            run('skip', 4);
                            run('reverse', +(step >= 0));
                            run('active', 0);
                            run('fill', 16, 0, 8);
                            run('active', 1);
                            run('position', 1701);
                            run('speed', 177);
                            run('volume', 10);
                            run('rampVolume', 10, 31);
                            run('directFill', 28, 0, 13);
                            run('fade', 6);
                            run('directFill', 32, 0, 15);
                            run('directSkip', 500);
                        }
        for (const pan of [-1, 0, 16384, 16385, 2147483647])
            for (const gain of [-2147483648, -1, 0, 2147483647]) {
                run('new', 1, 12, 5, 1, -369, gain, pan);
                run('position', 3727);
                run('ramp', -8, gain >> 3, pan);
                run('directFill', 9, 1, 5);
                run('directFill', -1, 0, 3);
                run('ramp', 0, 100, pan);
                run('position', -400);
                run('directFill', 10, 0, 5);
            }
        for (const stereo of [0, 1])
            for (const step of [-256, 122, 256])
                for (const dest of [-1, 0, 1, 6]) {
                    run('new', stereo, 1, 22, 0, step, 6700, 8192);
                    run('loops', 1);
                    run('position', 12 * 256);
                    run('ramp', 15, 1111, 3000);
                    run('directFill', dest, 0, 4);
                    run('directFill', dest, -2, 3);
                }
        const source = fileURLToPath(new URL('./game/PcmOracle.java', import.meta.url));
        const build = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, source]);
        expect(build.stderr.toString()).toBe('');
        const j = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'PcmOracle'], { stdin: Buffer.from(commands.join('\n')), maxBuffer: 16 * 1024 * 1024, timeout: 20000 });
        expect(j.stderr.toString()).toBe('');
        expect(j.exitCode).toBe(0);
        const expected = j.stdout.toString().trimEnd().split(/\r?\n/);
        expect(expected.length).toBe(actual.length);
        for (let i = 0; i < actual.length; i++) expect(actual[i], i + ' ' + commands.slice(Math.max(i - 3, 0), i + 1).join(' / ')).toBe(expected[i]);
    } finally {
        PCMPlayer.m_frequency = saved[0];
        PCMPlayer.m_stereo = Boolean(saved[1]);
        rmSync(dir, { recursive: true, force: true });
    }
}, 30000);
