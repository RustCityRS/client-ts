import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';
import PCMPlayer from '#/sound/PCMPlayer.js';
import WaveStream from '#/sound/WaveStream.js';
import Wave from '#/sound/Wave.js';
import Mixer from '#/sound/Mixer.js';
import MixerController from '#/sound/MixerController.js';
import DevicePcmPlayer, { type AudioDevice } from '#/sound/DevicePcmPlayer.js';
import type SharedPtrList from '#/datastruct/SharedPtrList.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { gamepackPath } from './reference.js';

class Player extends PCMPlayer {
    queued = 0;
    badWrite = false;
    actions: string[] = [];
    protected override AlreadyWritten(): number {
        this.actions.push('size');
        return this.queued;
    }
    override Open(size: number): void {
        this.actions.push('open:' + size);
        this.queued = 0;
    }
    protected override Close(): void {
        this.actions.push('close');
    }
    protected override write(): void {
        this.actions.push('write:' + requireNonNull(this.samples).reduce((p, n) => (Math.imul(31, p) + n) | 0, 1));
        if (this.badWrite) throw Error();
        this.queued += 256;
    }
    protected override DiscardBufferInner(): void {
        this.actions.push('flush');
    }
}

test('real gamepack mixes the same 59 streams under its budget and writes identical signed 16-bit device blocks', () => {
    const savedStereo = PCMPlayer.m_stereo,
        savedRate = PCMPlayer.m_frequency,
        rows: string[] = [];
    const events: string[] = [];
    class Listener extends MixerController {
        private calls = 0;
        constructor(
            private readonly id: number,
            delay: number
        ) {
            super();
            this.remaining = delay;
        }
        update(): number {
            events.push(this.id + '@' + this.remaining);
            return ++this.calls < 4 ? this.id + 1 : -1;
        }
        remove(): void {
            events.push('rm' + this.id);
        }
    }
    const dir = mkdtempSync(join(tmpdir(), 'player530-'));
    try {
        for (const stereo of [false, true]) {
            PCMPlayer.m_stereo = stereo;
            PCMPlayer.m_frequency = 22050;
            const source = Int8Array.from({ length: 35 }, (_, i) => i * 21 - 39);
            const sounds = [new Wave(22050, source, 3, 31), new Wave(22050, source, 0, 35, true), new Wave(44100, source, 3, 26)];
            const p = new Player();
            p.capacity = 512;
            p.requestedFrames = 1536;
            p.samples = new Int32Array(stereo ? 512 : 256);
            const root = new Mixer(),
                a = new Mixer(),
                b = new Mixer();
            root.PlayStream(a);
            root.PlayStream(b);
            const streams = Array.from({ length: 59 }, (_, i) => {
                const s = requireNonNull(WaveStream.NewRateRawFineVolPan(sounds[i % 3], 57 + i * 6, (1 + (i % 42)) * 1061, (i * 672) % 16384));
                s.SetLoopCount(-1);
                s.SetPositionFine((i % 9) * 256);
                ((i & 1) === 1 ? a : b).PlayStream(s);
                return s;
            });
            for (let i = 0; i < 5; i++) {
                const list: SharedPtrList = Reflect.get(a, 'listeners');
                Reflect.get(a, 'SortController').call(a, list.sentinel.next, new Listener(i + 1, i * 5));
            }
            const output = (label: string) => {
                const fields = ['maxDrain', 'fresh', 'framesUntilSchedule', 'previousQueued', 'extraFrames', 'previousDrain', 'budget'];
                let state =
                    fields
                        .map(f => Reflect.get(p, f))
                        .concat(p.capacity, p.requestedFrames, Reflect.get(p, 'reopenAt') !== 0n)
                        .join(',') + '|';
                for (const s of streams) state += +s.active + '' + +s.IsLinked() + ',' + s.schedulerWeight + ',' + Reflect.get(s, 'position') + ';';
                rows.push([label, p.actions.join(','), events.join(','), state + sounds.map(s => s.position).join(',') + ','].join('|'));
                p.actions.length = 0;
                events.length = 0;
            };
            p.SetInput(root);
            for (let i = 0; i < 35; i++) {
                if (i !== 0 && (i < 18 || i > 22)) Reflect.set(p, 'checkAt', 0x7fffffffffffffffn);
                if (i === 3 || i === 10) p.DoneUpdate();
                if (i === 6) p.QueueDiscardBuffer();
                if (i === 8) p.requestedFrames = 90000;
                if (i === 14) {
                    p.requestedFrames = 768;
                    p.badWrite = true;
                }
                if (i === 15) p.badWrite = false;
                if (i === 16) Reflect.set(p, 'reopenAt', 1n);
                if (i >= 18 && i <= 22) {
                    Reflect.set(p, 'checkAt', 0n);
                    p.queued = p.requestedFrames;
                }
                if (i === 23) {
                    Reflect.set(p, 'reopenAt', 1n);
                    p.queued = 0;
                } else if (i < 18 || i > 22) p.queued = Math.max(0, p.queued - ((i % 3) + 1) * 256);
                if (i === 26) {
                    a.StopStream(streams[7]);
                    root.StopStream(b);
                }
                if (i === 28) {
                    root.PlayStream(b);
                    b.PlayStream(streams[7]);
                }
                if (i === 30) p.SetInput(null);
                if (i === 32) p.SetInput(root);
                p.Service();
                output('pump' + i);
            }
            p.QueueQuit();
            output('stop');
            const fake: AudioDevice = {
                getMixerNames: () => [],
                getLine: () => ({
                    available: () => 123,
                    open() {},
                    start() {},
                    flush() {
                        rows.push('flush');
                    },
                    close() {
                        rows.push('close');
                    },
                    write(bytes) {
                        rows.push('bytes:' + Buffer.from(requireNonNull(bytes)).toString('base64'));
                    }
                })
            };
            class Device extends DevicePcmPlayer {
                check() {
                    this.SubclassInit(null);
                    this.Open(1250);
                    const edge = [-2147483648, 2147483647, -8388609, -8388608, -8388607, -257, -256, -1, 0, 127, 255, 256, 8388607, 8388608];
                    this.samples = Int32Array.from({ length: stereo ? 512 : 256 }, (_, i) => (i < edge.length ? edge[i] : Math.imul(i, 379236917)));
                    rows.push('position:' + this.AlreadyWritten());
                    this.write();
                    this.DiscardBufferInner();
                    this.Close();
                    this.Close();
                }
            }
            const system = DevicePcmPlayer.audioSystem;
            try {
                DevicePcmPlayer.audioSystem = fake;
                new Device().check();
            } finally {
                DevicePcmPlayer.audioSystem = system;
            }
        }
        const java = (n: string) => fileURLToPath(new URL('./game/' + n + '.java', import.meta.url));
        const compile = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, java('PcmOracle'), java('PcmPlayerOracle')]);
        expect(compile.stderr.toString()).toBe('');
        const result = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'PcmPlayerOracle'], { maxBuffer: 2 * 1024 * 1024 });
        expect(result.stderr.toString()).toBe('');
        expect(result.exitCode).toBe(0);
        const actual = result.stdout.toString().trimEnd().split(/\r?\n/);
        expect(rows.length).toBe(actual.length);
        for (let i = 0; i < rows.length; i++) expect(rows[i], 'callback ' + i).toBe(actual[i]);
    } finally {
        PCMPlayer.m_stereo = savedStereo;
        PCMPlayer.m_frequency = savedRate;
        rmSync(dir, { recursive: true, force: true });
    }
}, 30000);
