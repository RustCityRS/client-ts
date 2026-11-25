import { expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';
import PcmOutput from '#/audio/PcmOutput.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { LineUnavailableError, type PcmLine } from '#/sound/DevicePcmPlayer.js';

const processorSource = readFileSync(new URL('../src/audio/pcm-worklet.js', import.meta.url), 'utf8');
type Options = { processorOptions: { shared: SharedArrayBuffer | null; channels: number; capacity: number } };
type Port = { onmessage: ((event: { data: unknown }) => void) | null; postMessage: (data: unknown) => void; close: () => void };
type Processor = { process(inputs: unknown[], outputs: Float32Array[][]): boolean; port: Port };
type ProcessorClass = new (options: Options) => Processor;

function browser(isolated: boolean, Output = PcmOutput) {
    const globals = ['AudioContext', 'AudioWorkletNode', 'crossOriginIsolated'] as const;
    const saved = globals.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
    const events: string[] = [];
    const modules: { url: string; resolve: () => void; reject: () => void }[] = [];
    class HostContext {
        static current: HostContext;
        state = 'suspended';
        destination = {};
        onstatechange: (() => void) | null = null;
        audioWorklet = {
            addModule: (url: string) => {
                return new Promise<void>((resolve, reject) => {
                    modules.push({ url, resolve, reject });
                });
            }
        };
        constructor({ sampleRate }: AudioContextOptions) {
            HostContext.current = this;
            events.push('open ' + sampleRate);
        }
        async resume() {
            events.push('resume');
        }
        async close() {
            events.push('close');
        }
    }
    const nodes: RenderNode[] = [];
    class RenderNode {
        readonly toRender: unknown[] = [];
        readonly toMain: unknown[] = [];
        readonly port: Port = {
            onmessage: null,
            postMessage: data => {
                this.toRender.push(data);
            },
            close() {}
        };
        readonly processor: Processor;
        onprocessorerror: (() => void) | null = null;
        connected = false;
        constructor(
            _ctx: unknown,
            name: string,
            readonly options: Options
        ) {
            const renderPort: Port = {
                onmessage: null,
                postMessage: data => {
                    this.toMain.push(data);
                },
                close() {}
            };
            let Worklet: ProcessorClass | undefined;
            runInNewContext(processorSource, {
                AudioWorkletProcessor: class {
                    port = renderPort;
                },
                registerProcessor(registered: string, ctor: ProcessorClass) {
                    expect(registered).toBe(name);
                    Worklet = ctor;
                }
            });
            const Registered = requireNonNull<ProcessorClass>(Worklet);
            this.processor = new Registered(options);
            nodes.push(this);
        }
        connect() {
            this.connected = true;
        }
        disconnect() {
            this.connected = false;
        }
        ack() {
            for (const data of this.toMain.splice(0)) this.port.onmessage?.({ data });
        }
        render(frames: number) {
            for (const data of this.toRender.splice(0)) this.processor.port.onmessage?.({ data });
            const out = Array.from({ length: this.options.processorOptions.channels }, () => new Float32Array(frames));
            const alive = this.processor.process([], [out]);
            return { alive, out: out.map(channel => Array.from(channel)) };
        }
    }
    for (const [i, value] of [HostContext, RenderNode, isolated].entries()) {
        Object.defineProperty(globalThis, globals[i], { value, configurable: true });
    }
    const device = new Output();
    return {
        nodes,
        events,
        modules,
        device,
        open(channels = 2, capacity = 7) {
            const line = device.getLine({ rate: 22050, bits: 16, signed: true, bigEndian: false, channels }, capacity * channels * 2);
            line.open();
            line.start();
            return line;
        },
        state(state: string) {
            HostContext.current.state = state;
            HostContext.current.onstatechange?.();
        },
        restore() {
            device.close();
            for (const [i, key] of globals.entries()) {
                const descriptor = saved[i];
                if (descriptor) Object.defineProperty(globalThis, key, descriptor);
                else Reflect.deleteProperty(globalThis, key);
            }
        }
    };
}

function write(line: PcmLine, samples: number[]) {
    const bytes = new Uint8Array(3 + samples.length * 2);
    const view = new DataView(bytes.buffer, 3);
    samples.forEach((sample, i) => view.setInt16(2 * i, sample, true));
    line.write(bytes, 3, samples.length * 2);
}

for (const isolated of [true, false]) {
    test('PCM worklet ring, signed samples, underrun and flush in ' + (isolated ? 'isolated' : 'message') + ' mode', async () => {
        const host = browser(isolated);
        try {
            const line = host.open(),
                mono = host.open(1, 3);
            write(line, [-32768, 32767]);
            expect(host.events).toEqual([]);
            host.device.unlock();
            host.device.unlock();
            expect(host.events).toEqual(['open 22050', 'resume', 'resume']);
            expect(host.modules).toHaveLength(1);
            expect(host.modules[0].url.startsWith('blob:')).toBe(true);
            host.state('running');
            expect(host.nodes.length).toBe(0);
            host.modules[0].resolve();
            await Promise.resolve();
            const [stereo, single] = host.nodes;
            expect(!!stereo.options.processorOptions.shared).toBe(isolated);
            expect(line.available()).toBe(28);
            const full = [-32768, 32767, 8192, -8192, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
            write(line, full);
            write(mono, [210, 211, 212]);
            expect(line.available()).toBe(0);
            expect(stereo.render(5).out).toEqual([[-32768, 8192, 1, 3, 5].map(s => s / 32768), [32767, -8192, 2, 4, 6].map(s => s / 32768)]);
            expect(line.available()).toBe(isolated ? 20 : 0);
            stereo.ack();
            expect(line.available()).toBe(20);
            write(line, [11, 12, 13, 14, 15, 16]);
            expect(stereo.render(8).out).toEqual(
                [
                    [7, 9, 11, 13, 15, 0, 0, 0],
                    [8, 10, 12, 14, 16, 0, 0, 0]
                ].map(ch => ch.map(s => s / 32768))
            );
            expect(single.render(4).out).toEqual([[210, 211, 212, 0].map(s => s / 32768)]);
            stereo.ack();
            single.ack();
            write(line, [-1024, 1024, -512, 512]);
            stereo.render(1); // A fallback acknowledgment is still in flight.
            const late = requireNonNull(stereo.port.onmessage);
            line.flush();
            expect(stereo.connected).toBe(false);
            expect(stereo.render(1).alive).toBe(false);
            write(line, [128, 256]);
            late({ data: 131071 });
            expect(line.available()).toBe(24);
            expect(host.nodes[2].render(2).out).toEqual([
                [128 / 32768, 0],
                [256 / 32768, 0]
            ]);
            host.state('suspended');
            write(line, [42, 43]);
            host.state('running');
            expect(line.available()).toBe(28);
            expect(host.nodes[3].render(1).out).toEqual([[0], [0]]);
            mono.close();
            line.close();
            host.device.close();
            expect(host.nodes.every(n => !n.connected)).toBe(true);
            expect(host.events.at(-1)).toBe('close');
        } finally {
            host.restore();
        }
    });
}

test('failed worklet load and processor failure use the existing line reopen path; closed contexts ignore late resolution', async () => {
    const host = browser(true);
    try {
        const first = host.open();
        host.device.unlock();
        host.state('running');
        host.modules[0].reject();
        await Promise.resolve();
        expect(() => first.available()).toThrow(LineUnavailableError);
        await expect(fetch(host.modules[0].url)).rejects.toThrow();
        first.close();
        const retry = host.open();
        expect(host.modules.length).toBe(2);
        host.modules[1].resolve();
        await Promise.resolve();
        const node = host.nodes[0];
        requireNonNull(node.onprocessorerror)();
        expect(() => retry.available()).toThrow(LineUnavailableError);
        retry.close();
        const fresh = host.open();
        expect(fresh.available()).toBe(28);
        fresh.close();
        host.device.close();
        host.device.unlock();
        host.state('running');
        host.open();
        host.device.close();
        host.modules[2].reject();
        await Promise.resolve();
        expect(host.modules).toHaveLength(3);
        expect(host.nodes).toHaveLength(2);
    } finally {
        host.restore();
    }
});
for (const isolated of [true, false]) {
    test('PCM frame counters wrap with a non-power-of-two line capacity, ' + (isolated ? 'isolated' : 'message'), async () => {
        const host = browser(isolated);
        try {
            const line = host.open(1, 7);
            host.device.unlock();
            host.state('running');
            host.modules[0].resolve();
            await Promise.resolve();
            const node = host.nodes[0];
            const nearWrap = 0xfffffffe;
            // Reach the same empty-line state as after ~54 hours of playback.
            const slot = nearWrap % 7;
            Object.assign(line, { read: nearWrap, writeFrame: nearWrap, writeSlot: slot });
            Object.assign(node.processor, { read: nearWrap, write: nearWrap, readSlot: slot, writeSlot: slot });
            const shared = node.options.processorOptions.shared;
            if (shared) {
                const indices = new Int32Array(shared, 0, 3);
                Atomics.store(indices, 0, nearWrap);
                Atomics.store(indices, 1, nearWrap);
            }
            write(line, [71, 72, 73, 74]);
            expect(node.render(3).out).toEqual([[71, 72, 73].map(x => x / 32768)]);
            node.ack();
            expect(line.available()).toBe(12);
            write(line, [75, 76, 77, 78, 79, 80]);
            expect(node.render(7).out).toEqual([[74, 75, 76, 77, 78, 79, 80].map(x => x / 32768)]);
            node.ack();
            expect(line.available()).toBe(14);
        } finally {
            host.restore();
        }
    });
}

test('closing while loading the embedded processor discards the stale result and releases its URL', async () => {
    const host = browser(false);
    try {
        for (const closePending of [false, true]) {
            host.open();
            host.device.unlock();
            host.state('running');
            const request = requireNonNull(host.modules.at(-1));
            expect(request.url.startsWith('blob:')).toBe(true);
            expect(await (await fetch(request.url)).text()).toBe(processorSource);
            if (closePending) host.device.close();
            request.resolve();
            await Promise.resolve();
            await expect(fetch(request.url)).rejects.toThrow();
            expect(host.nodes).toHaveLength(1);
            host.device.close();
        }
    } finally {
        host.restore();
    }
});

test('browser bundle loads the embedded worklet bytes on the first request', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rs530-pcm-bundle-'));
    try {
        const entry = fileURLToPath(new URL('../src/audio/PcmOutput.ts', import.meta.url));
        const build = await Bun.build({ entrypoints: [entry], target: 'browser', minify: true });
        expect(build.success).toBe(true);
        const file = join(dir, 'pcm-output.mjs');
        await Bun.write(file, build.outputs[0]);
        const bundled = (await import(pathToFileURL(file).href)) as typeof import('#/audio/PcmOutput');
        const host = browser(false, bundled.default);
        try {
            host.device.unlock();
            expect(host.modules).toHaveLength(1);
            const request = host.modules[0];
            expect(request.url.startsWith('blob:')).toBe(true);
            expect(await (await fetch(request.url)).text()).toBe(processorSource);
            request.resolve();
        } finally {
            host.restore();
        }
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
