import { expect } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { FALLBACK_CAPS_PROFILE } from '#/gl/CapsProfile.js';
import { NullGLDrawableFactory } from '#/gl/NullGL.js';
import GpuDevice from '#/gl/driver/GpuDevice.js';
import { WebGpuDrawableFactory, registerWebGpuDrawableFactory } from '#/gl/driver/WebGpuDrawableFactory.js';
import { registerGLDrawableFactory } from '#/jogl/GLDrawableFactory.js';
import Signlink, { onSignlinkRequestSettled, type SignlinkInput } from '#/util/Signlink.js';
import { loginFixture } from '../login-fixture.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

function command(args: string[]): string[] {
    const run = Bun.spawnSync(args, { timeout: 18000 });
    expect(run.exitCode, run.stderr.toString()).toBe(0);
    return run.stdout.toString().trimEnd().split(/\r?\n/);
}

const client = {
    getDeclaredField(name: string) {
        return name;
    },
    getDeclaredMethod() {
        throw new Error('unexpected method lookup');
    }
};

async function batch(configure: () => void): Promise<string[]> {
    const entered = Promise.withResolvers<void>();
    const resumed = Promise.withResolvers<void>();
    const sign = new Signlink(null, {
        async openUrl(): Promise<SignlinkInput> {
            entered.resolve();
            await resumed.promise;
            return {
                async read() {
                    return -1;
                },
                async close() {}
            };
        }
    });
    try {
        const hold = sign.openUrl(new URL('fixture://queue'));
        await entered.promise;
        const frame = {};
        const load = sign.loadGlLibrary(client);
        const exit = sign.exitFullscreen(frame);
        const modes = sign.getDisplayModes();
        const enter = sign.enterFullscreen(32, 72, 0x18001, 0x8001);
        const field = sign.getDeclaredField(client, 'marker');
        const requests = [load, exit, modes, enter, field];
        expect(field.objectArg).toEqual([client, 'marker']);
        const argumentsByRequest = [client, frame, null, null, field.objectArg];
        const log = requests.map((r, i) => ['queued', r.type, r.intArg, r.status, r.objectArg === argumentsByRequest[i], r.result === null, r.next === (requests[i + 1] ?? null)].join(' '));
        const order: number[] = [];
        const settled = new Promise<void>(resolve => {
            for (const r of requests)
                onSignlinkRequestSettled(r, () => {
                    order.push(r.type);
                    if (r === field) resolve();
                });
        });
        configure(); // Native readiness is consulted by the worker when it consumes the request.
        resumed.resolve();
        await settled;
        expect(order).toEqual([10, 7, 5, 6, 9]);
        log.push(['done', hold.status, load.status, exit.status, modes.status, enter.status, field.status, load.result === null, exit.result === null, field.result].join(' '));
        return log;
    } finally {
        resumed.resolve();
        await sign.stopWorker();
    }
}

loginFixture(
    import.meta.url,
    'HD Signlink queues GL loading and fullscreen exit in the order of the gamepack and signed loader',
    async () => {
        const work = mkdtempSync(join(tmpdir(), 'rs530-signlink-gl-'));
        const loader = process.env.LOADER_HD_530 || join(dirname(hdGamepackPath), 'loader_gl.jar');
        const nativePlatforms: Partial<Record<NodeJS.Platform, string>> = { win32: 'windows', linux: 'linux', darwin: 'macos', sunos: 'solaris' };
        const os = nativePlatforms[process.platform];
        const arch = process.platform === 'darwin' ? 'universal' : process.arch === 'x64' ? 'amd64' : process.arch;
        const natives = process.env.JOGL_NATIVES_530 || join(dirname(hdGamepackPath), 'natives', os + '-' + (arch === 'ia32' ? 'x86' : arch));
        try {
            expect(createHash('sha256').update(readFileSync(loader)).digest('hex')).toBe('5330f8025d5085d52b883a9dbe1025531b7b4a7629ecbfcd6766b56aa2980afb');
            command(['javac', '-cp', hdGamepackPath, '-d', work, join(import.meta.dir, 'HdSignlinkOracle.java')]);
            const oracle = (jar: string, mode: string) => command(['java', '-Djava.awt.headless=true', '--add-opens=java.base/java.lang=ALL-UNNAMED', '-cp', [work, jar, joglPath].join(delimiter), 'HdSignlinkOracle', mode, work, natives]);
            const bundled = oracle(hdGamepackPath, 'gamepack');
            const signed = oracle(loader, 'loader');
            const sign = new Signlink();
            const header = 'fullscreen ' + sign.supportsFullscreen();
            await sign.stopWorker();
            const lost = Promise.withResolvers<GPUDeviceLostInfo>();
            const fake = { lost: lost.promise } as GPUDevice;
            const device = GpuDevice.install(fake);
            const missing = await batch(() => registerGLDrawableFactory(null));
            const available = await batch(() => {
                expect(registerWebGpuDrawableFactory(FALLBACK_CAPS_PROFILE, { device })).toBe(true);
            });
            lost.resolve({ message: 'lost during fixture' } as GPUDeviceLostInfo);
            await lost.promise;
            const unavailable = await batch(() => {});
            expect([header, ...missing, ...missing, ...unavailable]).toEqual(bundled);
            expect([header, ...missing, ...available, ...unavailable]).toEqual(signed);
            expect(available[5]).toBe('done 1 1 2 2 2 1 true true marker');

            GpuDevice.uninstall();
            const noDevice = await batch(() => registerGLDrawableFactory(() => new WebGpuDrawableFactory(FALLBACK_CAPS_PROFILE)));
            const wrongFactory = await batch(() => registerGLDrawableFactory(() => new NullGLDrawableFactory(FALLBACK_CAPS_PROFILE)));
            expect(noDevice).toEqual(missing);
            expect(wrongFactory).toEqual(missing);
        } finally {
            registerGLDrawableFactory(null);
            GpuDevice.uninstall();
            rmSync(work, { recursive: true, force: true });
        }
    },
    45000,
    'gl'
);
