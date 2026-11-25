import { requireNonNull } from '#/util/JavaArray.js';
import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import OrbitCamera from '#/client/OrbitCamera.js';
import Pix3D from '#/dash3d/Pix3D.js';
import { gamepackPath } from '../reference.js';
import GlRenderer from '#/gl/GlRenderer.js';
import { loginFixture } from '../login-fixture.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

loginFixture(
    import.meta.url,
    'HD viewport camera distance and projected overlays match bh.a and q.a',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), '530-viewport-camera-'));
        try {
            const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
            const compile = Bun.spawnSync(['javac', '-cp', cp, '-d', dir, join(import.meta.dir, 'HdViewportCameraOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const rows: number[][] = [];
            for (const active of [0, 1])
                for (const height of [1, 333, 334, 335, 390, 433, 434, 435, 900, 0x7fffffff])
                    for (const [yaw, pitch] of [
                        [0, 0],
                        [0, 128],
                        [256, 255],
                        [1024, 383],
                        [2047, 2047]
                    ]) {
                        for (const [distance, scaleX, scaleY, px, pz] of [
                            [1190, 200, 341, 4608, 5350],
                            [0, 0, 256, 4510, 5030],
                            [0x7fffffff, 32767, -300, 13057, 128],
                            [-0x80000000, 256, 256, 4000, 13056]
                        ]) {
                            rows.push([active, 227, 590, 4500, height, -290, distance, yaw, 5000, pitch, scaleX, pz, 67, px, scaleY]);
                        }
                    }
            const java = Bun.spawnSync(['java', '-cp', cp, 'HdViewportCameraOracle'], { stdin: Buffer.from(rows.map(r => r.join(' ')).join('\n') + '\n') });
            expect(java.exitCode, java.stderr.toString()).toBe(0);
            const original = java.stdout.toString().trim().split(/\r?\n/);
            expect(original.length).toBe(rows.length);
            for (let i = 0; i < rows.length; i++) {
                const [active, min, max, x, height, y, distance, yaw, z, pitch, scaleX, pz, head, px, scaleY] = rows[i];
                GlRenderer.active = active !== 0;
                Client.viewportZoomMin = min;
                Client.zoomWidth = max;
                Client.CamFollow(y, distance, yaw, x, pitch, z, height);
                Client.GetOverlayPos2(42, pz, head, 81, px, scaleX, scaleY);
                expect([OrbitCamera.x, OrbitCamera.y, OrbitCamera.z, OrbitCamera.pitch, OrbitCamera.yaw, Client.projectX, Client.projectY].join(','), rows[i].join(' ')).toBe(requireNonNull(original[i]));
            }
            // The output above cannot distinguish the order of the zoom reads and camera stores.
            // With zero pitch and yaw, these are all the non-bookkeeping accesses in bh.a.
            const listing = Bun.spawnSync(['javap', '-cp', cp, '-p', '-c', '-s', 'bh']);
            expect(listing.exitCode, listing.stderr.toString()).toBe(0);
            const code = listing.stdout.toString().split('descriptor: (IIIIIIII)V')[1].split('goto')[0];
            const watched: [object, string, string][] = [
                [Client, 'viewportZoomMin', 'vg.b:S'],
                [Client, 'zoomWidth', 'pb.rb:S'],
                [OrbitCamera, 'pitch', 'tg.b:I'],
                [OrbitCamera, 'yaw', 'ol.ib:I'],
                [OrbitCamera, 'z', 'kh.f:I'],
                [OrbitCamera, 'x', 'km.Pc:I'],
                [OrbitCamera, 'y', 'af.d:I']
            ];
            const native = Array.from(code.matchAll(/\b(getstatic|putstatic)\s+[^\n]+?\/\/ Field ([\w.]+:[IS])\b/g))
                .filter(match => watched.some(([, , field]) => field === match[2]))
                .map(match => match[1] + ' ' + match[2]);
            expect(native.length).toBe(8);
            const accesses: string[] = [];
            const restore = watched.map(([owner, name, field]) => {
                const descriptor = requireNonNull(Object.getOwnPropertyDescriptor(owner, name));
                Object.defineProperty(owner, name, {
                    configurable: true,
                    get() {
                        accesses.push('getstatic ' + field);
                        return descriptor.value;
                    },
                    set() {
                        accesses.push('putstatic ' + field);
                    }
                });
                return () => Object.defineProperty(owner, name, descriptor);
            });
            try {
                GlRenderer.active = true;
                Client.CamFollow(-290, 1190, 0, 4500, 0, 5000, 390);
                expect(accesses).toEqual(native);
            } finally {
                for (const field of restore) field();
            }
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    45000,
    'gl'
);

for (const identity of ['sd', 'gl'] as const) {
    loginFixture(
        import.meta.url,
        identity + ' entity projection reads and writes in JAR instruction order',
        async () => {
            const gl = identity === 'gl';
            const jar = gl ? hdGamepackPath : gamepackPath;
            const descriptor = gl ? '(IIIIIIBI)V' : '(IIZIIIII)V';
            const javap = Bun.spawnSync(['javap', '-p', '-c', '-s', '-cp', jar, gl ? 'q' : 'aj']);
            expect(javap.exitCode, javap.stderr.toString()).toBe(0);
            const method = javap.stdout
                .toString()
                .split('descriptor: ' + descriptor)[1]
                .split(/\n {2}(?=\S)/)[0];
            const fields = [
                [Client, 'playerLevel', 'ee.b:I', 'ah.f:I'],
                [OrbitCamera, 'x', 'km.Pc:I', 'rk.m:I'],
                [OrbitCamera, 'y', 'af.d:I', 'mf.i:I'],
                [OrbitCamera, 'z', 'kh.f:I', 'ud.g:I'],
                [OrbitCamera, 'pitch', 'tg.b:I', 'bd.X:I'],
                [OrbitCamera, 'yaw', 'ol.ib:I', 'qj.w:I'],
                [Pix3D, 'sinTable', 'hf.g:[I', 'dc.l:[I'],
                [Pix3D, 'cosTable', 'hf.r:[I', 'dc.g:[I'],
                [Client, 'projectX', 'fc.a:I', 'jl.e:I'],
                [Client, 'projectY', 'bf.B:I', 'tg.z:I'],
                [GlRenderer, 'active', 'tf.w:Z', '']
            ] as const;
            const instructions = Array.from(method.matchAll(/^\s*(\d+):\s+(getstatic|putstatic)\s+[^\r\n]+?\/\/ Field ([\w.]+:\[?[IZ])/gm)).flatMap(match => {
                const field = fields.find(row => (gl ? row[2] : row[3]) === match[3]);
                return field ? [{ pc: +match[1], event: match[2] + ' ' + field[1] }] : [];
            });
            expect(instructions.length).toBe(gl ? 21 : 18);
            Client.GetAvH = () => 0;
            OrbitCamera.x = OrbitCamera.y = OrbitCamera.z = OrbitCamera.pitch = OrbitCamera.yaw = 0;
            const trace: string[] = [];
            const stop = new Error('injected field failure');
            let failAt = 0;
            for (const [owner, key] of fields) {
                let slot: unknown = Reflect.get(owner, key);
                Object.defineProperty(owner, key, {
                    configurable: true,
                    get() {
                        trace.push('getstatic ' + key);
                        if (trace.length === failAt) throw stop;
                        return slot;
                    },
                    set(value: unknown) {
                        trace.push('putstatic ' + key);
                        if (trace.length === failAt) throw stop;
                        slot = value;
                    }
                });
            }
            for (const hardware of gl ? [false, true] : [false])
                for (const outcome of ['bounds', 'depth', 'draw'] as const) {
                    const ranges: [number, number][] = [];
                    if (outcome === 'bounds') {
                        ranges.push(gl ? [53, 57] : [41, 45]);
                    } else if (gl) {
                        ranges.push([61, 128]);
                        if (outcome === 'depth') {
                            ranges.push([216, 220]);
                        } else {
                            ranges.push([228, 228], hardware ? [283, 307] : [243, 256]);
                        }
                    } else {
                        ranges.push([49, 124], outcome === 'depth' ? [232, 236] : [214, 227]);
                    }
                    const expected = instructions.filter(op => ranges.some(([lo, hi]) => lo <= op.pc && op.pc <= hi)).map(op => op.event);
                    for (let cut = 0; cut <= expected.length; cut++) {
                        failAt = 0;
                        GlRenderer.active = hardware;
                        OrbitCamera.z = outcome === 'depth' ? 2048 : 0;
                        trace.length = 0;
                        failAt = cut;
                        const invoke = () => Client.GetOverlayPos2(42, 1000, 35, 81, outcome === 'bounds' ? 0 : 1000, 301, 433);
                        if (cut) expect(invoke).toThrow(stop);
                        else invoke();
                        expect(trace).toEqual(cut ? expected.slice(0, cut) : expected);
                    }
                }
        },
        45000,
        identity
    );
}
