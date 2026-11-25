import { requireNonNull } from '../../src/util/JavaArray.js';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { capsProfileFromJson, type CapsProfile, FALLBACK_CAPS_PROFILE } from '../../src/gl/CapsProfile.js';
import { GLX as E } from '../../src/gl/driver/GlEnums.js';
import GpuDevice from '../../src/gl/driver/GpuDevice.js';
import { releasePresenter, type CanvasContextLike } from '../../src/gl/driver/Presenter.js';
import { readTexture } from '../../src/gl/driver/SurfaceTargets.js';
import { registerWebGpuDrawableFactory, WebGpuContext, WebGpuDrawable, WebGpuDrawableFactory } from '../../src/gl/driver/WebGpuDrawableFactory.js';
import WebGpuGL from '../../src/gl/driver/WebGpuGL.js';
import GLCapabilities from '../../src/jogl/GLCapabilities.js';
import GLContext from '../../src/jogl/GLContext.js';
import GLDrawableFactory, { registerGLDrawableFactory } from '../../src/jogl/GLDrawableFactory.js';
import GLException from '../../src/jogl/GLException.js';
import { JavaError } from '../../src/util/JavaException.js';
import ByteBuffer from '../../src/util/nio/ByteBuffer.js';
import type NioBuffer from '../../src/util/nio/Buffer.js';
import { replayTrace, replayTraceMarkers } from './driver-replay.js';

// Node-side runner for the WebGpuGL GPU tests (driver-gpu.test.ts, driver-parity.test.ts). Bun 1.2 crashes loading
// dawn.node, so the bun tests bundle this file and run it under node with the 'webgpu' package (headless Dawn), as
// Codex's test/render/webgpu-readback.mjs does. Usage: node <bundle> <config.json>; writes <out>/report.json.

interface Config {
    readonly webgpu: string; // absolute path of node_modules/webgpu/index.js
    readonly mode: 'gpu' | 'replay' | 'title' | 'terrain' | 'water';
    readonly out: string;
    readonly cases?: readonly { readonly name: string; readonly trace: string; readonly blobs: string; readonly profile: string; readonly native?: string }[];
}

interface Check {
    readonly name: string;
    readonly ok: boolean;
    readonly detail: string;
}

const checks: Check[] = [];

function check(name: string, ok: boolean, detail: string = ''): void {
    checks.push({ name, ok, detail });
}

async function guarded(name: string, body: () => Promise<void>): Promise<void> {
    try {
        await body();
    } catch (e) {
        check(name, false, 'threw: ' + (e instanceof Error ? (e.stack ?? e.message) : String(e)));
    }
}

class Surface {
    constructor(
        public width: number,
        public height: number
    ) {}
}

function setup(gpu: GpuDevice, width: number, height: number, samples: number, profile: CapsProfile = FALLBACK_CAPS_PROFILE) {
    const factory = new WebGpuDrawableFactory(profile, { device: gpu });
    const caps = new GLCapabilities();
    if (samples > 0) {
        caps.setSampleBuffers(true);
        caps.setNumSamples(samples);
    }
    const target = new Surface(width, height);
    const drawable = factory.getGLDrawable(target, caps, null) as WebGpuDrawable;
    drawable.setRealized(true);
    const context = drawable.createContext(null) as WebGpuContext;
    const made = context.makeCurrent();
    const gl = context.getGL() as WebGpuGL;
    const targets = drawable.currentTargets();
    if (targets === null) throw new Error('no targets after makeCurrent');
    return { factory, drawable, context, gl, made, targets, target };
}

// Pixels of an RGBA readback (top row first) as 0xRRGGBBAA words.
function words(bytes: Uint8Array): Uint32Array {
    const out = new Uint32Array(bytes.length / 4);
    for (let i = 0; i < out.length; i++) out[i] = ((bytes[i * 4] << 24) | (bytes[i * 4 + 1] << 16) | (bytes[i * 4 + 2] << 8) | bytes[i * 4 + 3]) >>> 0;
    return out;
}

function hex(w: number): string {
    return '0x' + w.toString(16).padStart(8, '0');
}

// Compares a readback with expected(xGl, yGl) where yGl is the GL (bottom-up) row; returns the first mismatch or ''.
function compare(bytes: Uint8Array, width: number, height: number, expected: (x: number, yGl: number) => number): string {
    const w = words(bytes);
    for (let row = 0; row < height; row++) {
        for (let x = 0; x < width; x++) {
            const want = expected(x, height - 1 - row) >>> 0;
            const got = w[row * width + x];
            if (got !== want) return 'GL pixel (' + x + ', ' + (height - 1 - row) + ') expected ' + hex(want) + ', got ' + hex(got);
        }
    }
    return '';
}

function compareDepth(values: Float32Array, width: number, height: number, expected: (x: number, yGl: number) => number): string {
    for (let row = 0; row < height; row++) {
        for (let x = 0; x < width; x++) {
            const want = expected(x, height - 1 - row);
            const got = values[row * width + x];
            if (Math.abs(got - want) > 1e-6) return 'GL depth (' + x + ', ' + (height - 1 - row) + ') expected ' + want + ', got ' + got;
        }
    }
    return '';
}

async function readFront(gpu: GpuDevice, d: WebGpuDrawable): Promise<Uint8Array> {
    const p = d.currentPresenter();
    const front = p?.front ?? null;
    if (front === null) throw new Error('no front buffer');
    return readTexture(gpu, front, front.width, front.height);
}

async function gpuChecks(gpu: GpuDevice, freshDevice: () => Promise<GPUDevice>): Promise<void> {
    await guarded('drawable size during synchronous world traversal', async () => {
        const { drawable, target } = setup(gpu, 12, 8, 0);
        const surface = drawable.surface;
        let queries = 0;
        surface.width = () => {
            queries++;
            return target.width;
        };
        drawable.beginWorldDraw();
        for (let i = 0; i < 12; i++) drawable.targets(gpu);
        drawable.endWorldDraw();
        check('models share one drawable size check per world draw', queries === 1, String(queries));
        target.width = 14;
        drawable.beginWorldDraw();
        check('the next scene sees a synchronous resize', drawable.targets(gpu).width === 14 && queries === 2, '');
        drawable.endWorldDraw();
        target.width = 16;
        check('ordinary drawing sees a resize after the scene', drawable.targets(gpu).width === 16 && queries === 3, '');
        drawable.setRealized(false);
    });
    for (const samples of [0, 4]) {
        const tag = ' (AA ' + samples + ')';
        await guarded('stress replay' + tag, async () => {
            const { drawable, gl, targets, target } = setup(gpu, 32, 16, samples);
            gl.glViewport(0, 0, 32, 16);
            gl.glEnableClientState(E.GL_VERTEX_ARRAY);
            gl.glVertexPointer(3, E.GL_FLOAT, 0, ByteBuffer.wrap(new Int8Array(Float32Array.of(-1, -1, 0, 1, -1, 0, -1, 1, 0).buffer)));
            const indices = ByteBuffer.wrap(new Int8Array(Uint32Array.of(0, 1, 2).buffer));
            function frame(): void {
                gl.glDisable(E.GL_SCISSOR_TEST);
                gl.glClearColor(0, 0, 0, 1);
                gl.glClearDepth(1);
                gl.glClear(E.GL_COLOR_BUFFER_BIT | E.GL_DEPTH_BUFFER_BIT);
                gl.glEnable(E.GL_DEPTH_TEST);
                gl.glEnable(E.GL_SCISSOR_TEST);
                gl.glScissor(4, 2, 22, 11);
                gl.glColor3ub(255, 0, 0);
                gl.glDrawElements(E.GL_TRIANGLES, 3, E.GL_UNSIGNED_INT, indices);
                gl.glDisable(E.GL_DEPTH_TEST);
                gl.glDisable(E.GL_SCISSOR_TEST);
                gl.glColor3ub(0, 255, 0);
                gl.glBegin(E.GL_TRIANGLE_FAN);
                gl.glVertex2f(-0.5, -0.5);
                gl.glVertex2f(0, -0.5);
                gl.glVertex2f(0, 0.5);
                gl.glVertex2f(-0.5, 0.5);
                gl.glEnd();
            }
            frame();
            drawable.swapBuffers();
            const color = await readFront(gpu, drawable);
            const depth = await targets.readDepth();
            const colors = words(color);
            check('stress reference contains indexed geometry and HUD' + tag, colors.includes(0xff0000ff) && colors.includes(0x00ff00ff) && depth.includes(0.5) && depth.includes(1), '');
            function capture(): void {
                targets.startStress();
                frame();
                drawable.swapBuffers();
            }
            capture();
            // Erase the captured color and depth. Copying the previous front image cannot
            // restore the triangle's depth. Only an actual indexed replay restores both.
            // Use an independent submission so the game frame encoder stays idle and
            // its resource epoch still covers the captured buffers.
            const attachments = targets as unknown as { back: GPUTexture; depth: GPUTexture };
            const erase = gpu.device.createCommandEncoder();
            erase
                .beginRenderPass({
                    colorAttachments: [{ view: attachments.back.createView(), loadOp: 'clear', clearValue: [0, 0, 1, 1], storeOp: 'store' }],
                    depthStencilAttachment: { view: attachments.depth.createView(), depthLoadOp: 'clear', depthClearValue: 0, depthStoreOp: 'store' }
                })
                .end();
            gpu.device.queue.submit([erase.finish()]);
            const epoch = gpu.epoch;
            const swaps = drawable.swaps;
            check('stress submits and presents a fresh replay' + tag, drawable.replayStress() && gpu.epoch === epoch + 1 && drawable.swaps === swaps + 1, '');
            check('stress limits pending replays' + tag, !drawable.replayStress(), '');
            const replay = await readFront(gpu, drawable);
            const replayDepth = await targets.readDepth();
            check('stress reproduces every resolved color byte' + tag, Buffer.from(replay).equals(Buffer.from(color)), '');
            check('stress reproduces every depth word at sample zero' + tag, Buffer.from(replayDepth.buffer).equals(Buffer.from(depth.buffer)), '');
            targets.startStress();
            frame();
            drawable.submitGameFrame();
            check('display-paced stress accepts two refreshes before queue completion' + tag, drawable.replayStress() && drawable.replayStress(), '');
            check('display-paced stress bounds the pending queue' + tag, !drawable.replayStress(), '');
            check('queued display refreshes preserve the game framebuffer' + tag, Buffer.from(await readFront(gpu, drawable)).equals(Buffer.from(color)), '');
            capture();
            gl.glClear(E.GL_COLOR_BUFFER_BIT | E.GL_DEPTH_BUFFER_BIT);
            gpu.endPass();
            check('stress leaves an unfinished game frame alone' + tag, !drawable.replayStress() && gpu.hasUnsubmittedWork, '');
            gpu.submit();
            // The next capture has fewer passes and ends before the HUD. Reusing the
            // previous command storage must discard both its stale draws and attachments.
            targets.startStress();
            gl.glDisable(E.GL_SCISSOR_TEST);
            gl.glEnable(E.GL_DEPTH_TEST);
            gl.glColor3ub(255, 0, 0);
            gl.glDrawElements(E.GL_TRIANGLES, 3, E.GL_UNSIGNED_INT, indices);
            drawable.swapBuffers();
            check('a shorter capture is replayable' + tag, drawable.replayStress(), '');
            const shortColors = words(await readFront(gpu, drawable));
            check('a shorter capture discards the previous HUD' + tag, shortColors.includes(0xff0000ff) && !shortColors.includes(0x00ff00ff), '');
            capture();
            targets.stopStress();
            check('stress stops replay when disabled' + tag, !drawable.replayStress(), '');
            capture();
            target.width++;
            check('stress rejects stale surface dimensions' + tag, !drawable.replayStress(), '');
            target.width--;
            capture();
            gpu.retire(gpu.device.createBuffer({ size: 4, usage: GPUBufferUsage.VERTEX }));
            check('stress rejects retirement before replay' + tag, !drawable.replayStress(), '');
            gpu.flushRetired();
            targets.startStress();
            frame();
            gpu.retire(gpu.device.createBuffer({ size: 4, usage: GPUBufferUsage.VERTEX }));
            drawable.swapBuffers();
            check('stress drops a frame with retired resources at submit' + tag, !drawable.replayStress(), '');
        });
        await guarded('identical GPU instructions across game ticks' + tag, async () => {
            const { gl, targets, drawable } = setup(gpu, 12, 8, samples);
            gl.glViewport(0, 0, 12, 8);
            gl.glEnableClientState(E.GL_VERTEX_ARRAY);
            gl.glVertexPointer(3, E.GL_FLOAT, 0, ByteBuffer.wrap(new Int8Array(Float32Array.of(-1, -1, 0, 3, -1, 0, -1, 3, 0).buffer)));
            const indices = ByteBuffer.wrap(new Int8Array(Uint32Array.of(0, 1, 2).buffer));
            const recording = targets as unknown as { stressPasses: { useBundles: boolean; bundles?: { bundles: GPURenderBundle[] } }[] };
            async function frame(green: boolean, left: number): Promise<string> {
                targets.startStress();
                gl.glEnable(E.GL_SCISSOR_TEST);
                gl.glScissor(left, 0, 6 - left, 8);
                gl.glColor3ub(green ? 0 : 255, green ? 255 : 0, 0);
                for (let draw = 0; draw < 550; draw++) gl.glDrawElements(E.GL_TRIANGLES, 3, E.GL_UNSIGNED_INT, indices);
                gl.glScissor(6, 0, 6, 8);
                gl.glColor3ub(0, 0, 255);
                gl.glDrawElements(E.GL_TRIANGLES, 3, E.GL_UNSIGNED_INT, indices);
                drawable.swapBuffers();
                return compare(await readFront(gpu, drawable), 12, 8, x => (x >= 6 ? 0x0000ffff : x < left ? 0x000000ff : green ? 0x00ff00ff : 0xff0000ff));
            }
            for (let i = 0; i < 4; i++) await frame(false, 0);
            const green = await frame(true, 0);
            check('reused GPU instructions see this tick’s uniforms in both scissor rectangles' + tag, recording.stressPasses.some(pass => pass.useBundles) && green === '', green);
            const previous = recording.stressPasses.find(pass => pass.useBundles)?.bundles;
            const moved = await frame(true, 2);
            const current = recording.stressPasses.find(pass => pass.useBundles)?.bundles;
            check('a changed clip replaces the cached instructions and draws the new rectangle' + tag, !!current && current !== previous && moved === '', moved);
            check('the matching middle of the scene reuses its native bundle under the new clip' + tag, !!current && !!previous && current.bundles.length >= 3 && current.bundles[1] === previous.bundles[1], '');
        });
        await guarded('moving stress world view' + tag, async () => {
            const { drawable, gl, targets } = setup(gpu, 64, 32, samples);
            const mesh = ByteBuffer.wrap(new Int8Array(Float32Array.of(-4, -10, 64, 20, -8, 64, 2, 10, 64).buffer));
            const hud = ByteBuffer.wrap(new Int8Array(Float32Array.of(0.65, 0.45, 0, 0.95, 0.45, 0, 0.95, 0.95, 0).buffer));
            const indices = ByteBuffer.wrap(new Int8Array(Uint32Array.of(0, 1, 2).buffer));
            const projection = Float32Array.of(2, 0, 0, 0, 0, 4, 0, 0, 0, 0, -257 / 255, -1, 0, 0, -512 / 255, 0);
            gl.glEnableClientState(E.GL_VERTEX_ARRAY);
            gl.glViewport(0, 0, 64, 32);
            function frame(x: number, cycle?: number, now?: number, yaw = 0): void {
                if (cycle !== undefined) targets.startStress();
                gl.glClearColor(0, 0, 0, 1);
                gl.glClear(E.GL_COLOR_BUFFER_BIT | E.GL_DEPTH_BUFFER_BIT);
                gl.glMatrixMode(E.GL_PROJECTION);
                gl.glLoadMatrixf(projection, 0);
                gl.glMatrixMode(E.GL_MODELVIEW);
                gl.glLoadIdentity();
                gl.glRotatef(180, 1, 0, 0);
                if (yaw) gl.glRotatef(yaw, 0, 1, 0);
                gl.glTranslatef(-x, 0, 0);
                if (cycle !== undefined) targets.beginWorldView(x, 0, 0, 0, yaw, cycle, now);
                gl.glEnable(E.GL_DEPTH_TEST);
                gl.glVertexPointer(3, E.GL_FLOAT, 0, mesh);
                gl.glColor3ub(255, 0, 0);
                gl.glDrawElements(E.GL_TRIANGLES, 3, E.GL_UNSIGNED_INT, indices);
                if (cycle !== undefined) targets.endWorldView();
                gl.glMatrixMode(E.GL_PROJECTION);
                gl.glLoadIdentity();
                gl.glMatrixMode(E.GL_MODELVIEW);
                gl.glLoadIdentity();
                gl.glDisable(E.GL_DEPTH_TEST);
                gl.glVertexPointer(3, E.GL_FLOAT, 0, hud);
                gl.glColor3ub(0, 255, 0);
                gl.glDrawElements(E.GL_TRIANGLES, 3, E.GL_UNSIGNED_INT, indices);
                drawable.swapBuffers();
            }
            const snapshot = () => Promise.all([readFront(gpu, drawable), targets.readDepth()]);
            frame(8);
            const [stock, stockDepth] = await snapshot();
            frame(0, 99, 100);
            frame(8, 100, 120);
            // Readback submits work too. Include its submissions in each presentation so
            // both in-between images come from the same captured world and upload epoch.
            const capture = async (now: number) => {
                let result: ReturnType<typeof snapshot> | undefined;
                const replayed = targets.replayStress(() => {
                    drawable.swapBuffers();
                    result = snapshot();
                }, now);
                if (!replayed || !result) throw new Error('missing world replay at ' + now);
                const pixels = await result;
                await gpu.device.queue.onSubmittedWorkDone();
                return pixels;
            };
            const [canonical, canonicalDepth] = await capture(120);
            check('canonical captured world and HUD match every stock color and depth byte' + tag, equal(stock, canonical) && equal(new Uint8Array(stockDepth.buffer), new Uint8Array(canonicalDepth.buffer)), '');
            const [early, earlyDepth] = await capture(125);
            const [late, lateDepth] = await capture(135);
            check('world color and depth move between consecutive sub-tick presentations' + tag, !equal(early, late) && !equal(new Uint8Array(earlyDepth.buffer), new Uint8Array(lateDepth.buffer)), '');
            check('canonical scene contains both a red model and a green indexed HUD' + tag, words(stock).includes(0xff0000ff) && words(stock).includes(0x00ff00ff), '');
            // Eight units per tick moves the camera two and six units at 5 and 15 ms.
            // A full stock draw provides a pixel and depth oracle for both views and the fixed HUD.
            for (const [x, color, depth] of [
                [10, early, earlyDepth],
                [14, late, lateDepth]
            ] as const) {
                frame(x);
                const [reference, referenceDepth] = await snapshot();
                check('sub-tick model and fixed HUD match stock redraw at camera X ' + x + tag, equal(reference, color) && equal(new Uint8Array(referenceDepth.buffer), new Uint8Array(depth.buffer)), '');
            }
            frame(8, 102, 160, 358);
            frame(8, 103, 180, 2);
            const [turned, turnedDepth] = await capture(190);
            frame(8, undefined, undefined, 4);
            const [turnedReference, turnedReferenceDepth] = await snapshot();
            // The extra eye-space rotation composes two f32 matrices; stock multiplies the
            // model by one. The depth tolerance admits rounding within two depth24 steps.
            const depthError = turnedDepth.reduce((worst, value, i) => Math.max(worst, Math.abs(value - turnedReferenceDepth[i])), 0);
            check('camera turn across zero follows the short arc and keeps the HUD fixed' + tag, equal(turned, turnedReference) && depthError <= 2 / 0xffffff, 'max depth error ' + depthError);
            frame(8, undefined, undefined, 2);
            const [stationaryReference, stationaryDepth] = await snapshot();
            frame(8, 104, 200, 2);
            const copy = targets.copyTo;
            try {
                targets.copyTo = () => {
                    throw new Error('stationary camera resolved the back buffer twice');
                };
                check('a stopped camera presents the completed game image' + tag, drawable.replayStress(false, 215), '');
            } finally {
                targets.copyTo = copy;
            }
            const [stopped, stoppedDepth] = await snapshot();
            check('stationary front and depth match the full game draw' + tag, equal(stopped, stationaryReference) && equal(new Uint8Array(stoppedDepth.buffer), new Uint8Array(stationaryDepth.buffer)), '');
        });
    }
    await guarded('indexed draws reuse state through a material run', async () => {
        const { gl, targets } = setup(gpu, 16, 8, 0);
        const names = new Int32Array(2);
        const vertices = Float32Array.of(-1, -1, 0, 3, -1, 0, -1, 3, 0);
        const vertexData = ByteBuffer.wrap(new Int8Array(vertices.buffer));
        const indices = ByteBuffer.wrap(new Int8Array(Uint32Array.of(0, 1, 2).buffer));
        gl.glGenBuffersARB(2, names, 0);
        gl.glBindBufferARB(E.GL_ARRAY_BUFFER, names[0]);
        gl.glBufferDataARB(E.GL_ARRAY_BUFFER, vertices.byteLength, vertexData, E.GL_STREAM_DRAW);
        gl.glEnableClientState(E.GL_VERTEX_ARRAY);
        gl.glVertexPointer(3, E.GL_FLOAT, 0, 0n);
        gl.glBindBufferARB(E.GL_ELEMENT_ARRAY_BUFFER, names[1]);
        gl.glBufferDataARB(E.GL_ELEMENT_ARRAY_BUFFER, 12, indices, E.GL_STATIC_DRAW);
        gl.glEnable(E.GL_SCISSOR_TEST);
        gl.glColor3ub(255, 0, 0);
        gl.glScissor(0, 0, 4, 8);
        gl.glDrawElements(E.GL_TRIANGLES, 3, E.GL_UNSIGNED_INT, 0n);
        gl.glScissor(4, 0, 4, 8);
        gl.glDrawElements(E.GL_TRIANGLES, 3, E.GL_UNSIGNED_INT, 0n);
        const list = gl.glGenLists(1);
        gl.glNewList(list, E.GL_COMPILE);
        gl.glColor3ub(0, 255, 0);
        gl.glViewport(8, 0, 8, 8);
        gl.glEndList();
        gl.glCallList(list);
        gl.glScissor(0, 0, 16, 8);
        gl.glDrawElements(E.GL_TRIANGLES, 3, E.GL_UNSIGNED_INT, 0n);
        // All indices now reference a degenerate triangle. The first three encoded draws
        // must continue using the old store, and this draw must consume the replacement.
        gl.glBufferSubDataARB(E.GL_ARRAY_BUFFER, 0, vertices.byteLength, ByteBuffer.wrap(new Int8Array(vertices.byteLength)));
        gl.glColor3ub(0, 0, 255);
        gl.glDrawElements(E.GL_TRIANGLES, 3, E.GL_UNSIGNED_INT, 0n);
        const diff = compare(await targets.readBack(), 16, 8, x => (x < 8 ? 0xff0000ff : 0x00ff00ff));
        check('material runs preserve display-list uniforms and in-flight vertex stores', diff === '', diff);
    });
    await guarded('indexed texture environment color changes within a submission', async () => {
        const { gl, targets } = setup(gpu, 16, 8, 0);
        gl.glViewport(0, 0, 16, 8);
        gl.glEnableClientState(E.GL_VERTEX_ARRAY);
        const positions = Float32Array.of(-1, -1, 0, 3, -1, 0, -1, 3, 0);
        gl.glVertexPointer(3, E.GL_FLOAT, 0, ByteBuffer.wrap(new Int8Array(positions.buffer)));
        const indices = ByteBuffer.wrap(new Int8Array(Uint32Array.of(0, 1, 2).buffer));
        const name = new Int32Array(1);
        gl.glGenTextures(1, name, 0);
        gl.glActiveTexture(E.GL_TEXTURE0 + 2);
        gl.glEnable(E.GL_TEXTURE_2D);
        gl.glBindTexture(E.GL_TEXTURE_2D, name[0]);
        gl.glTexImage2D(E.GL_TEXTURE_2D, 0, E.GL_RGBA, 1, 1, 0, E.GL_RGBA, E.GL_UNSIGNED_BYTE, ByteBuffer.wrap(Int8Array.of(-1, -1, -1, -1)));
        gl.glTexParameteri(E.GL_TEXTURE_2D, E.GL_TEXTURE_MIN_FILTER, E.GL_NEAREST);
        gl.glTexEnvi(E.GL_TEXTURE_ENV, E.GL_TEXTURE_ENV_MODE, E.GL_COMBINE);
        gl.glTexEnvi(E.GL_TEXTURE_ENV, E.GL_COMBINE_RGB, E.GL_REPLACE);
        gl.glTexEnvi(E.GL_TEXTURE_ENV, E.GL_SOURCE0_RGB, E.GL_CONSTANT);
        gl.glEnable(E.GL_SCISSOR_TEST);
        for (let half = 0; half < 2; half++) {
            gl.glScissor(8 * half, 0, 8, 8);
            gl.glTexEnvfv(E.GL_TEXTURE_ENV, E.GL_TEXTURE_ENV_COLOR, Float32Array.of(1 - half, half, 1 - half, 1), 0);
            gl.glDrawElements(E.GL_TRIANGLES, 3, E.GL_UNSIGNED_INT, indices);
        }
        const diff = compare(await targets.readBack(), 16, 8, x => (x < 8 ? 0xff00ffff : 0x00ff00ff));
        check('each indexed draw sees its own texture-unit 2 constant color', diff === '', diff);
    });
    await guarded('client vertex stores shared across draws', async () => {
        const { gl, targets } = setup(gpu, 12, 8, 0);
        const xyz = Float32Array.of(-1, -1, 0, 3, -1, 0, -1, 3, 0);
        const vertices = ByteBuffer.wrap(new Int8Array(xyz.buffer));
        const indices = ByteBuffer.wrap(new Int8Array(Uint32Array.of(0, 1, 2).buffer));
        gl.glClearColor(0, 0, 0, 1);
        gl.glClear(E.GL_COLOR_BUFFER_BIT);
        gl.glEnableClientState(E.GL_VERTEX_ARRAY);
        gl.glVertexPointer(3, E.GL_FLOAT, 0, vertices);
        gl.glEnable(E.GL_SCISSOR_TEST);
        gl.glScissor(0, 0, 4, 8);
        gl.glColor3ub(255, 0, 0);
        gl.glDrawElements(E.GL_TRIANGLES, 3, E.GL_UNSIGNED_INT, indices);
        gl.glScissor(4, 0, 4, 8);
        gl.glColor3ub(0, 255, 0);
        gl.glDrawElements(E.GL_TRIANGLES, 3, E.GL_UNSIGNED_INT, indices);
        // Mutate the NIO backing through a different view, keeping the pointer identity.
        xyz.fill(0);
        gl.glScissor(0, 0, 12, 8);
        gl.glColor3ub(0, 0, 255);
        gl.glDrawElements(E.GL_TRIANGLES, 3, E.GL_UNSIGNED_INT, indices);
        const diff = compare(await targets.readBack(), 12, 8, x => (x < 4 ? 0xff0000ff : x < 8 ? 0x00ff00ff : 0x000000ff));
        check('mutable client arrays keep the bytes consumed by each encoded draw', diff === '', diff);
    });
    await guarded('interleaved VBO switches within a submission', async () => {
        const { gl, targets } = setup(gpu, 36, 4, 0);
        const names = new Int32Array(3);
        gl.glGenBuffersARB(3, names, 0);
        gl.glEnableClientState(E.GL_VERTEX_ARRAY);
        gl.glEnableClientState(E.GL_COLOR_ARRAY);
        gl.glEnable(E.GL_SCISSOR_TEST);
        const indices = ByteBuffer.wrap(new Int8Array(Uint32Array.of(0, 1, 2).buffer));
        const packed = new Uint8Array(60);
        const positions = new Float32Array(packed.buffer);
        positions.set([-1, -1, 0], 0);
        positions.set([3, -1, 0], 5);
        positions.set([-1, 3, 0], 10);
        function bind(name: number, r: number, g: number, b: number): void {
            for (let offset = 0; offset < packed.length; offset += 20) {
                packed.set([r, g, b, 255, 255, 255, 0, 255], offset + 12);
            }
            gl.glBindBufferARB(E.GL_ARRAY_BUFFER, name);
            gl.glBufferDataARB(E.GL_ARRAY_BUFFER, packed.length, ByteBuffer.wrap(packed), E.GL_STREAM_DRAW);
            gl.glVertexPointer(3, E.GL_FLOAT, 20, 0n);
            gl.glColorPointer(4, E.GL_UNSIGNED_BYTE, 20, 12n);
        }
        function stripe(index: number): void {
            gl.glScissor(4 * index, 0, 4, 4);
            gl.glDrawElements(E.GL_TRIANGLES, 3, E.GL_UNSIGNED_INT, indices);
        }
        bind(names[0], 255, 0, 0);
        stripe(0);
        bind(names[1], 0, 255, 0);
        stripe(1);
        bind(names[1], 0, 0, 255);
        stripe(2);
        gl.glColorPointer(4, E.GL_UNSIGNED_BYTE, 20, 16n);
        stripe(3);
        gl.glBindBufferARB(E.GL_ARRAY_BUFFER, names[0]);
        gl.glColorPointer(4, E.GL_UNSIGNED_BYTE, 20, 12n);
        stripe(4);
        // Keep the position binding fixed while the independent colour store changes.
        bind(names[2], 0, 255, 255);
        gl.glBindBufferARB(E.GL_ARRAY_BUFFER, names[1]);
        gl.glVertexPointer(3, E.GL_FLOAT, 20, 0n);
        stripe(5);
        gl.glBufferDataARB(E.GL_ARRAY_BUFFER, packed.length, ByteBuffer.wrap(new Uint8Array(packed.length)), E.GL_STREAM_DRAW);
        stripe(6);
        gl.glBindBufferARB(E.GL_ARRAY_BUFFER, names[2]);
        gl.glVertexPointer(3, E.GL_FLOAT, 20, 0n);
        stripe(7);
        gl.glBindBufferARB(E.GL_ARRAY_BUFFER, names[0]);
        gl.glColorPointer(4, E.GL_UNSIGNED_BYTE, 20, 12n);
        stripe(8);
        const colours = [0xff0000ff, 0x00ff00ff, 0x0000ffff, 0xffff00ff, 0xff0000ff, 0x00ffffff, 0x000000ff, 0x00ffffff, 0xff0000ff];
        const diff = compare(await targets.readBack(), 36, 4, x => colours[x >> 2]);
        check('packed and split vertex streams keep the right bytes through rebinding, merging and in-flight replacement', diff === '', diff);
    });
    await guarded('independent NIO pointer ranges sharing one backing store', async () => {
        const { gl, targets } = setup(gpu, 8, 8, 0);
        const raw = new Int8Array(72);
        const interleaved = ByteBuffer.wrap(raw),
            colours = ByteBuffer.wrap(raw);
        new Float32Array(raw.buffer, 0, 15).set([-1, -1, 0, 0, 0, 3, -1, 0, 1, 0, -1, 3, 0, 0, 1]);
        raw.set([72, 157, 52, 255, 72, 157, 52, 255, 72, 157, 52, 255], 60);
        gl.glEnableClientState(E.GL_VERTEX_ARRAY);
        gl.glEnableClientState(E.GL_COLOR_ARRAY);
        gl.glEnableClientState(E.GL_TEXTURE_COORD_ARRAY);
        gl.glVertexPointer(3, E.GL_FLOAT, 20, interleaved);
        colours.position(60);
        gl.glColorPointer(4, E.GL_UNSIGNED_BYTE, 4, colours);
        interleaved.position(12);
        gl.glTexCoordPointer(2, E.GL_FLOAT, 20, interleaved);
        const indices = ByteBuffer.wrap(new Int8Array(Uint32Array.of(0, 1, 2).buffer));
        gl.glDrawElements(E.GL_TRIANGLES, 3, E.GL_UNSIGNED_INT, indices);
        const renderer = gl['indexed'];
        const attributes = requireNonNull(renderer['lastInput']).attributes;
        check('UVs retain the original interleaved position slice after a separate colour upload', attributes[0].buffer === attributes[2].buffer && attributes[2].offset - attributes[0].offset === 12, '');
        const entries = renderer['clientBuffers']['entries'];
        check('draw releases both pooled NIO handles and GPU references', entries.length === 2 && entries.every(entry => entry.source === undefined && entry.gpu === undefined), '');
        const diff = compare(await targets.readBack(), 8, 8, () => 0x489d34ff);
        check('both NIO views keep their captured addresses in the real GPU draw', diff === '', diff);
    });
    await guarded('native JOGL pixel transfers', async () => {
        const { checkPixelTransfers } = await import('./driver-pixel-transfer.js');
        await checkPixelTransfers(gpu, check);
    });
    await guarded('provider registry', async () => {
        check('registers with a device', registerWebGpuDrawableFactory(FALLBACK_CAPS_PROFILE), '');
        check('getFactory gives the WebGPU factory', GLDrawableFactory.getFactory() instanceof WebGpuDrawableFactory, '');
        GpuDevice.uninstall();
        registerGLDrawableFactory(null);
        check('without a device nothing registers', !registerWebGpuDrawableFactory(FALLBACK_CAPS_PROFILE) && GLDrawableFactory.getFactory() === null, '');
        GpuDevice.install(gpu.device, gpu.canvasFormat);
        registerGLDrawableFactory(null);
    });

    for (const samples of [0, 2, 4]) {
        const tag = ' (AA ' + samples + ')';
        await guarded('clear-colour frame read back exactly' + tag, async () => {
            const { gl, drawable, made, targets } = setup(gpu, 61, 37, samples);
            check('makeCurrent returns CONTEXT_CURRENT_NEW' + tag, made === GLContext.CONTEXT_CURRENT_NEW, 'got ' + made);
            check('sample count' + tag, targets.sampleCount === (samples === 0 ? 1 : 4), 'got ' + targets.sampleCount);
            const before = targets.passesBegun;
            gl.glClearColor(10 / 255, 200 / 255, 77 / 255, 0.5);
            gl.glClear(E.GL_COLOR_BUFFER_BIT | E.GL_DEPTH_BUFFER_BIT);
            check('unscissored clear is a loadOp pass' + tag, targets.passesBegun === before + 1 && targets.clearQuads === 0, 'passes ' + (targets.passesBegun - before) + ', quads ' + targets.clearQuads);
            drawable.swapBuffers();
            const expect = () => 0x0ac84dff; // no alpha bits: alpha reads 1
            check('front after swap' + tag, compare(await readFront(gpu, drawable), 61, 37, expect) === '', compare(await readFront(gpu, drawable), 61, 37, expect));
            check('back preserved after swap' + tag, compare(await targets.readBack(), 61, 37, expect) === '', '');
        });

        await guarded('scissored clear-quad' + tag, async () => {
            const { gl, drawable, targets } = setup(gpu, 40, 30, samples);
            gl.glClearColor(1, 0, 0, 1);
            gl.glClear(E.GL_COLOR_BUFFER_BIT);
            gl.glEnable(E.GL_SCISSOR_TEST);
            gl.glScissor(8, 4, 16, 10);
            gl.glClearColor(0, 1, 0, 1);
            const quads = targets.clearQuads;
            gl.glClear(E.GL_COLOR_BUFFER_BIT);
            check('scissored clear uses the clear quad' + tag, targets.clearQuads === quads + 1, '');
            // A scissor box partly outside the surface is clipped.
            gl.glScissor(-5, 25, 10, 100);
            gl.glClearColor(0, 0, 1, 1);
            gl.glClear(E.GL_COLOR_BUFFER_BIT);
            const inside = (x: number, y: number) => x >= 8 && x < 24 && y >= 4 && y < 14;
            const corner = (x: number, y: number) => x < 5 && y >= 25;
            const expect = (x: number, y: number) => (corner(x, y) ? 0x0000ffff : inside(x, y) ? 0x00ff00ff : 0xff0000ff);
            const diff = compare(await targets.readBack(), 40, 30, expect);
            check('scissored clear honours the GL box (bottom-left origin)' + tag, diff === '', diff);
            // A scissor box covering the surface clears with a loadOp again.
            gl.glScissor(0, 0, 40, 30);
            const passes = targets.passesBegun;
            const quads2 = targets.clearQuads;
            gl.glClearColor(1, 1, 1, 1);
            gl.glClear(E.GL_COLOR_BUFFER_BIT);
            check('full scissor box clears with a loadOp' + tag, targets.passesBegun === passes + 1 && targets.clearQuads === quads2, '');
            // A zero-size box clears nothing.
            gl.glScissor(0, 0, 0, 0);
            gl.glClearColor(0, 0, 0, 1);
            gl.glClear(E.GL_COLOR_BUFFER_BIT);
            const diff2 = compare(await targets.readBack(), 40, 30, () => 0xffffffff);
            check('glScissor(0,0,0,0) clears nothing' + tag, diff2 === '', diff2);
            drawable.swapBuffers();
        });

        await guarded('depth-mask clear' + tag, async () => {
            const { gl, targets } = setup(gpu, 24, 16, samples);
            gl.glClearDepth(0.25);
            gl.glClear(E.GL_DEPTH_BUFFER_BIT);
            let diff = compareDepth(await targets.readDepth(), 24, 16, () => 0.25);
            check('depth clear' + tag, diff === '', diff);
            gl.glDepthMask(false);
            gl.glClearDepth(1);
            gl.glClearColor(0, 0, 1, 1);
            gl.glClear(E.GL_COLOR_BUFFER_BIT | E.GL_DEPTH_BUFFER_BIT);
            diff = compareDepth(await targets.readDepth(), 24, 16, () => 0.25);
            check('DepthMask(false) keeps depth on a colour+depth clear' + tag, diff === '', diff);
            diff = compare(await targets.readBack(), 24, 16, () => 0x0000ffff);
            check('DepthMask(false) still clears colour' + tag, diff === '', diff);
            gl.glDepthMask(true);
            gl.glEnable(E.GL_SCISSOR_TEST);
            gl.glScissor(4, 2, 8, 6);
            gl.glClearDepth(0.75);
            gl.glClear(E.GL_DEPTH_BUFFER_BIT);
            const inside = (x: number, y: number) => x >= 4 && x < 12 && y >= 2 && y < 8;
            diff = compareDepth(await targets.readDepth(), 24, 16, (x, y) => (inside(x, y) ? 0.75 : 0.25));
            check('scissored depth clear (clear quad, frag_depth)' + tag, diff === '', diff);
            diff = compare(await targets.readBack(), 24, 16, () => 0x0000ffff);
            check('scissored depth-only clear leaves colour' + tag, diff === '', diff);
            gl.glDepthMask(false);
            gl.glClearDepth(0);
            gl.glClearColor(1, 1, 0, 1);
            gl.glClear(E.GL_COLOR_BUFFER_BIT | E.GL_DEPTH_BUFFER_BIT);
            diff = compareDepth(await targets.readDepth(), 24, 16, (x, y) => (inside(x, y) ? 0.75 : 0.25));
            check('scissored clear under DepthMask(false) keeps depth' + tag, diff === '', diff);
            diff = compare(await targets.readBack(), 24, 16, (x, y) => (inside(x, y) ? 0xffff00ff : 0x0000ffff));
            check('scissored clear under DepthMask(false) writes colour' + tag, diff === '', diff);
        });

        await guarded('swap preserves the back buffer' + tag, async () => {
            const { gl, drawable, targets } = setup(gpu, 20, 12, samples);
            gl.glClearColor(1, 0, 0, 1);
            gl.glClear(E.GL_COLOR_BUFFER_BIT);
            drawable.swapBuffers();
            gl.glEnable(E.GL_SCISSOR_TEST);
            gl.glScissor(0, 0, 5, 3);
            gl.glClearColor(0, 0, 1, 1);
            gl.glClear(E.GL_COLOR_BUFFER_BIT);
            let diff = compare(await readFront(gpu, drawable), 20, 12, () => 0xff0000ff);
            check('front holds the last swapped frame' + tag, diff === '', diff);
            drawable.swapBuffers();
            const expect = (x: number, y: number) => (x < 5 && y < 3 ? 0x0000ffff : 0xff0000ff);
            diff = compare(await readFront(gpu, drawable), 20, 12, expect);
            check('second frame draws over the preserved back buffer' + tag, diff === '', diff);
            diff = compare(await targets.readBack(), 20, 12, expect);
            check('back buffer unchanged by the swap' + tag, diff === '', diff);
            check('swap count' + tag, drawable.swaps === 2, 'swaps ' + drawable.swaps);
        });
    }

    await guarded('present blits the front buffer into the canvas', async () => {
        const width = 9,
            height = 7;
        const canvasTexture = gpu.device.createTexture({ size: { width, height }, format: 'bgra8unorm', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });
        let configuration: GPUCanvasConfiguration | null = null;
        const context: CanvasContextLike = {
            configure: c => {
                configuration = c;
            },
            getCurrentTexture: () => canvasTexture
        };
        const factory = new WebGpuDrawableFactory(FALLBACK_CAPS_PROFILE, {
            device: gpu,
            resolveSurface: () => ({ width: () => width, height: () => height, canvasContext: () => context })
        });
        const drawable = factory.getGLDrawable({}, null, null) as WebGpuDrawable;
        drawable.setRealized(true);
        const ctx = drawable.createContext(null);
        ctx.makeCurrent();
        const gl = ctx.getGL();
        gl.glClearColor(0.2, 0.4, 0.6, 0);
        gl.glClear(E.GL_COLOR_BUFFER_BIT);
        drawable.swapBuffers();
        const c = configuration as GPUCanvasConfiguration | null;
        check('canvas configured opaque', c !== null && c.alphaMode === 'opaque', JSON.stringify(c === null ? null : { alphaMode: c.alphaMode, format: c.format }));
        const bytes = await readTexture(gpu, canvasTexture, width, height);
        // bgra8unorm bytes are B, G, R, A in memory; 0.2/0.4/0.6 are 51/102/153 after unorm rounding.
        const bad = [...Array(width * height).keys()].find(i => bytes[i * 4] !== 153 || bytes[i * 4 + 1] !== 102 || bytes[i * 4 + 2] !== 51 || bytes[i * 4 + 3] !== 255);
        check('canvas pixels are the front buffer, alpha 1', bad === undefined, bad === undefined ? '' : 'pixel ' + bad + ': ' + [...bytes.subarray(bad * 4, bad * 4 + 4)].join(','));
        ctx.release();
    });

    await guarded('texture objects realize with their GL images', async () => {
        const { gl } = setup(gpu, 8, 8, 0);
        const names = new Int32Array(4);
        gl.glGenTextures(4, names, 0);
        // 2D RGBA with a full mip chain (GLU's shape), LINEAR_MIPMAP_LINEAR.
        gl.glBindTexture(E.GL_TEXTURE_2D, names[0]);
        const levels: Uint8Array[] = [];
        for (let level = 0, size = 4; size >= 1; level++, size >>= 1) {
            const bytes = Uint8Array.from({ length: size * size * 4 }, (_, i) => (i * 37 + level * 11) & 0xff);
            levels.push(bytes);
            gl.glTexImage2D(E.GL_TEXTURE_2D, level, E.GL_RGBA, size, size, 0, E.GL_RGBA, E.GL_UNSIGNED_BYTE, ByteBuffer.wrap(new Int8Array(bytes.buffer)));
        }
        gl.glTexParameteri(E.GL_TEXTURE_2D, E.GL_TEXTURE_MIN_FILTER, E.GL_LINEAR_MIPMAP_LINEAR);
        const t2 = gl.boundTexture(E.GL_TEXTURE_2D);
        const tex2 = gl.realizeTexture(t2);
        check('2D texture format and mip count', tex2.format === 'rgba8unorm' && tex2.mipLevelCount === 3 && tex2.dimension === '2d', tex2.format + ' ' + tex2.mipLevelCount);
        for (let level = 0; level < 3; level++) {
            const got = await readLevel(gpu, tex2, level, 0, 4);
            check('2D level ' + level + ' bytes', equal(got, levels[level]), '');
        }
        check('realize reuses an unchanged texture', gl.realizeTexture(t2) === tex2, '');
        check(
            'uploaded pixels are released for the whole mip chain',
            [...t2.images[0].values()].every(image => image.data === null),
            ''
        );
        const properties = new Int32Array(4);
        [E.GL_TEXTURE_WIDTH, E.GL_TEXTURE_HEIGHT, E.GL_TEXTURE_DEPTH, E.GL_TEXTURE_INTERNAL_FORMAT].forEach((p, i) => gl.glGetTexLevelParameteriv(E.GL_TEXTURE_2D, 0, p, properties, i));
        check('uploaded base level queries still return the original image properties', properties.join(',') === '4,4,1,' + E.GL_RGBA, properties.join(','));
        gl.glTexImage2D(E.GL_TEXTURE_2D, 1, E.GL_RGBA, 1, 1, 0, E.GL_RGBA, E.GL_UNSIGNED_BYTE, null);
        check('an inconsistent mip disables the mipmapped texture', !t2.isComplete(), '');
        gl.glTexParameteri(E.GL_TEXTURE_2D, E.GL_TEXTURE_MIN_FILTER, E.GL_LINEAR);
        const baseOnly = gl.realizeTexture(t2);
        check('renamed base-only image preserves all texels', baseOnly.mipLevelCount === 1 && equal(await readLevel(gpu, baseOnly, 0, 0, 4), levels[0]), '');
        const detached = t2.images[0].get(2)?.detached?.texture;
        check('inaccessible mip keeps only its own GPU extent', detached?.width === 1 && detached.height === 1 && detached.mipLevelCount === 1 && equal(await readLevel(gpu, detached, 0, 0, 4), levels[2]), '');
        gl.glTexImage2D(E.GL_TEXTURE_2D, 1, E.GL_RGBA, 2, 2, 0, E.GL_RGBA, E.GL_UNSIGNED_BYTE, ByteBuffer.wrap(new Int8Array(levels[1].buffer)));
        gl.glTexParameteri(E.GL_TEXTURE_2D, E.GL_TEXTURE_MIN_FILTER, E.GL_LINEAR_MIPMAP_LINEAR);
        const rebuilt = gl.realizeTexture(t2);
        check('restored chain preserves the resident base and previously inaccessible upper mip', equal(await readLevel(gpu, rebuilt, 0, 0, 4), levels[0]) && equal(await readLevel(gpu, rebuilt, 2, 0, 4), levels[2]), '');
        const list = gl.glGenLists(1);
        const compiledBytes = Int8Array.of(11, 33, 55, 77);
        gl.glNewList(list, E.GL_COMPILE);
        gl.glTexImage2D(E.GL_TEXTURE_2D, 0, E.GL_RGBA, 1, 1, 0, E.GL_RGBA, E.GL_UNSIGNED_BYTE, ByteBuffer.wrap(compiledBytes));
        gl.glEndList();
        compiledBytes.fill(0);
        gl.glCallList(list);
        const firstList = gl.realizeTexture(t2);
        gl.glCallList(list);
        const secondList = gl.realizeTexture(t2);
        const listTexels = Uint8Array.of(11, 33, 55, 77);
        check('compiled texture image survives upload to two consecutive GPU stores', firstList !== secondList && equal(await readLevel(gpu, secondList, 0, 0, 4), listTexels), '');
        const update = Int8Array.of(1, 3, 5, 7);
        gl.glTexImage2D(E.GL_TEXTURE_2D, 0, E.GL_RGBA, 1, 1, 0, E.GL_RGBA, E.GL_UNSIGNED_BYTE, ByteBuffer.wrap(update));
        update.fill(9);
        const reused = gl.realizeTexture(t2);
        check('redefining a submitted texture reuses its storage and snapshots the caller bytes', reused === secondList && equal(await readLevel(gpu, reused, 0, 0, 4), Uint8Array.of(1, 3, 5, 7)), '');
        gl.realizeTexture(t2);
        gl.glTexImage2D(E.GL_TEXTURE_2D, 0, E.GL_RGBA, 1, 1, 0, E.GL_RGBA, E.GL_UNSIGNED_BYTE, ByteBuffer.wrap(update));
        const renamed = gl.realizeTexture(t2);
        check('redefining an in-flight texture preserves both images', renamed !== reused && equal(await readLevel(gpu, reused, 0, 0, 4), Uint8Array.of(1, 3, 5, 7)) && equal(await readLevel(gpu, renamed, 0, 0, 4), Uint8Array.of(9, 9, 9, 9)), '');
        // 3D LUMINANCE_ALPHA -> rg8unorm.
        gl.glBindTexture(E.GL_TEXTURE_3D, names[1]);
        const la = Uint8Array.from({ length: 4 * 4 * 4 * 2 }, (_, i) => (i * 13) & 0xff);
        gl.glTexImage3D(E.GL_TEXTURE_3D, 0, E.GL_LUMINANCE_ALPHA, 4, 4, 4, 0, E.GL_LUMINANCE_ALPHA, E.GL_UNSIGNED_BYTE, ByteBuffer.wrap(new Int8Array(la.buffer)));
        gl.glTexParameteri(E.GL_TEXTURE_3D, E.GL_TEXTURE_MIN_FILTER, E.GL_LINEAR);
        const tex3 = gl.realizeTexture(gl.boundTexture(E.GL_TEXTURE_3D));
        check('3D LUMINANCE_ALPHA is rg8unorm 3d', tex3.format === 'rg8unorm' && tex3.dimension === '3d' && tex3.depthOrArrayLayers === 4, tex3.format + ' ' + tex3.dimension);
        let ok3 = true;
        for (let z = 0; z < 4; z++) ok3 = ok3 && equal(await readLevel(gpu, tex3, 0, z, 2), la.subarray(z * 32, z * 32 + 32));
        check('3D slices bytes', ok3, '');
        const volumeMip = Uint8Array.from({ length: 16 }, (_, i) => 3 + i * 5);
        gl.glTexImage3D(E.GL_TEXTURE_3D, 1, E.GL_LUMINANCE_ALPHA, 2, 2, 2, 0, E.GL_LUMINANCE_ALPHA, E.GL_UNSIGNED_BYTE, ByteBuffer.wrap(new Int8Array(volumeMip.buffer)));
        const volume = gl.boundTexture(E.GL_TEXTURE_3D);
        const resized3d = gl.realizeTexture(volume);
        check('adding a volume mip copies through the deepest original slice', equal(await readLevel(gpu, resized3d, 0, 3, 2), la.subarray(96, 128)), '');
        gl.glTexImage3D(E.GL_TEXTURE_3D, 0, E.GL_LUMINANCE_ALPHA, 1, 1, 1, 0, E.GL_LUMINANCE_ALPHA, E.GL_UNSIGNED_BYTE, null);
        gl.realizeTexture(volume);
        gl.glTexImage3D(E.GL_TEXTURE_3D, 0, E.GL_LUMINANCE_ALPHA, 4, 4, 4, 0, E.GL_LUMINANCE_ALPHA, E.GL_UNSIGNED_BYTE, ByteBuffer.wrap(new Int8Array(la.buffer)));
        const restoredVolume = gl.realizeTexture(volume);
        check(
            'a hidden volume mip preserves both depth slices after resizing the base',
            equal(await readLevel(gpu, restoredVolume, 1, 0, 2), volumeMip.subarray(0, 8)) && equal(await readLevel(gpu, restoredVolume, 1, 1, 2), volumeMip.subarray(8)),
            ''
        );
        // 1D ALPHA -> r8unorm, height 1.
        gl.glBindTexture(E.GL_TEXTURE_1D, names[2]);
        const alpha = Uint8Array.of(0x73, 0x87, 0x9b, 0xaf, 0xc3, 0xd3, 0xeb, 0xff);
        gl.glTexImage1D(E.GL_TEXTURE_1D, 0, E.GL_ALPHA, 8, 0, E.GL_ALPHA, E.GL_UNSIGNED_BYTE, ByteBuffer.wrap(new Int8Array(alpha.buffer)));
        gl.glTexParameteri(E.GL_TEXTURE_1D, E.GL_TEXTURE_MIN_FILTER, E.GL_LINEAR);
        const tex1 = gl.realizeTexture(gl.boundTexture(E.GL_TEXTURE_1D));
        check('1D ALPHA is a r8unorm 2D texture of height 1', tex1.format === 'r8unorm' && tex1.height === 1 && tex1.width === 8, tex1.format + ' ' + tex1.width + 'x' + tex1.height);
        check('1D bytes', equal(await readLevel(gpu, tex1, 0, 0, 1), alpha), '');
        // Cube map ALPHA, six faces as layers; 2-byte rows need UNPACK_ALIGNMENT 1 (4 would pad each row to 4 bytes).
        gl.glPixelStorei(E.GL_UNPACK_ALIGNMENT, 1);
        gl.glBindTexture(E.GL_TEXTURE_CUBE_MAP, names[3]);
        const faces: Uint8Array[] = [];
        for (let f = 0; f < 6; f++) {
            const face = Uint8Array.from({ length: 4 }, (_, i) => f * 40 + i);
            faces.push(face);
            gl.glTexImage2D(E.GL_TEXTURE_CUBE_MAP_POSITIVE_X + f, 0, E.GL_ALPHA, 2, 2, 0, E.GL_ALPHA, E.GL_UNSIGNED_BYTE, ByteBuffer.wrap(new Int8Array(face.buffer)));
        }
        gl.glTexParameteri(E.GL_TEXTURE_CUBE_MAP, E.GL_TEXTURE_MIN_FILTER, E.GL_LINEAR);
        gl.glPixelStorei(E.GL_UNPACK_ALIGNMENT, 4);
        const cube = gl.boundTexture(E.GL_TEXTURE_CUBE_MAP);
        const texc = gl.realizeTexture(cube);
        check('cube map is 6 layers with a cube view', texc.depthOrArrayLayers === 6 && cube.viewDimension() === 'cube', String(texc.depthOrArrayLayers));
        let okc = true;
        for (let f = 0; f < 6; f++) okc = okc && equal(await readLevel(gpu, texc, 0, f, 1), faces[f]);
        check('cube faces bytes', okc, '');
        gl.glPixelStorei(E.GL_UNPACK_ALIGNMENT, 1);
        gl.glTexImage2D(E.GL_TEXTURE_CUBE_MAP_POSITIVE_X + 3, 0, E.GL_ALPHA, 2, 2, 0, E.GL_ALPHA, E.GL_UNSIGNED_BYTE, null);
        const updatedCube = gl.realizeTexture(cube);
        let preserved = true;
        for (let f = 0; f < 6; f++) {
            const expected = f === 3 ? new Uint8Array(4) : faces[f];
            if (!equal(await readLevel(gpu, updatedCube, 0, f, 1), expected)) preserved = false;
        }
        check('replacing one cube face preserves the other five GPU layers', preserved, '');
        for (let face = 0; face < 6; face++) {
            gl.glTexImage2D(E.GL_TEXTURE_CUBE_MAP_POSITIVE_X + face, 1, E.GL_ALPHA, 1, 1, 0, E.GL_ALPHA, E.GL_UNSIGNED_BYTE, ByteBuffer.wrap(Int8Array.of(20 + face)));
        }
        gl.realizeTexture(cube);
        gl.glTexImage2D(E.GL_TEXTURE_CUBE_MAP_POSITIVE_X + 2, 1, E.GL_ALPHA, 2, 2, 0, E.GL_ALPHA, E.GL_UNSIGNED_BYTE, null);
        gl.realizeTexture(cube);
        gl.glTexImage2D(E.GL_TEXTURE_CUBE_MAP_POSITIVE_X + 2, 1, E.GL_ALPHA, 1, 1, 0, E.GL_ALPHA, E.GL_UNSIGNED_BYTE, ByteBuffer.wrap(Int8Array.of(90)));
        const restoredCube = gl.realizeTexture(cube);
        let mipsMatch = true;
        for (let face = 0; face < 6; face++) {
            const bytes = await readLevel(gpu, restoredCube, 1, face, 1);
            mipsMatch &&= equal(bytes, Uint8Array.of(face === 2 ? 90 : 20 + face));
        }
        check('restoring one inconsistent cube mip preserves the other five faces', mipsMatch, '');
        // A changed texture gets a new GPU texture (no write into one an encoded draw may read).
        gl.glBindTexture(E.GL_TEXTURE_1D, names[2]);
        gl.glTexImage1D(E.GL_TEXTURE_1D, 0, E.GL_ALPHA, 8, 0, E.GL_ALPHA, E.GL_UNSIGNED_BYTE, null);
        check('re-specified texture is renamed', gl.realizeTexture(gl.boundTexture(E.GL_TEXTURE_1D)) !== tex1, '');
        check('sampler cache returns one sampler per key', gpu.sampler(cube.samplerKey()) === gpu.sampler(cube.samplerKey()), '');
        const repeat = cube.sampler(gpu);
        gl.glBindTexture(E.GL_TEXTURE_CUBE_MAP, names[3]);
        gl.glTexParameteri(E.GL_TEXTURE_CUBE_MAP, E.GL_TEXTURE_WRAP_S, E.GL_CLAMP_TO_EDGE);
        const clamped = cube.sampler(gpu);
        gl.glTexParameteri(E.GL_TEXTURE_CUBE_MAP, E.GL_TEXTURE_WRAP_S, E.GL_REPEAT);
        check('changing and restoring texture parameters selects the original device sampler', clamped !== repeat && cube.sampler(gpu) === repeat, '');
    });

    await guarded('VBO rename on write after use', async () => {
        const { gl } = setup(gpu, 8, 8, 0);
        const ids = new Int32Array(1);
        gl.glGenBuffersARB(1, ids, 0);
        gl.glBindBufferARB(E.GL_ARRAY_BUFFER, ids[0]);
        const data = ByteBuffer.allocate(16);
        for (let i = 0; i < 16; i++) data.put(i, i);
        gl.glBufferDataARB(E.GL_ARRAY_BUFFER, 16, data, E.GL_STREAM_DRAW);
        const b = gl.buffers.get(ids[0]);
        if (b === undefined) throw new Error('no buffer object');
        const first = gl.realizeBuffer(b); // referenced by the current submission
        for (let i = 0; i < 16; i++) data.put(i, 100 + i);
        gl.glBufferSubDataARB(E.GL_ARRAY_BUFFER, 0, 16, data);
        const second = gl.realizeBuffer(b);
        check('a write after use in the same submission renames', second !== first && b.renames === 1, 'renames ' + b.renames);
        const a = await readBuffer(gpu, first, 16);
        const c = await readBuffer(gpu, second, 16);
        check(
            'the old GPU buffer keeps what earlier draws read',
            equal(
                a,
                Uint8Array.from({ length: 16 }, (_, i) => i)
            ),
            [...a].join(',')
        );
        check(
            'the new GPU buffer holds the new data',
            equal(
                c,
                Uint8Array.from({ length: 16 }, (_, i) => 100 + i)
            ),
            [...c].join(',')
        );
        // After a submit, a write goes into the same GPU buffer.
        gl.glBufferSubDataARB(E.GL_ARRAY_BUFFER, 4, 4, data);
        const third = gl.realizeBuffer(b);
        check('a write in a later submission reuses the buffer', third === second && b.renames === 1, 'renames ' + b.renames);
    });

    await guarded('compacted resident static buffers', async () => {
        const { gl } = setup(gpu, 8, 8, 0);
        const requested = Object.getOwnPropertyDescriptor(globalThis, 'requestIdleCallback');
        const cancelled = Object.getOwnPropertyDescriptor(globalThis, 'cancelIdleCallback');
        const idle = new Map<number, IdleRequestCallback>();
        let next = 0;
        globalThis.requestIdleCallback = callback => {
            idle.set(++next, callback);
            return next;
        };
        globalThis.cancelIdleCallback = handle => {
            idle.delete(handle);
        };
        const drain = (ms: number) => {
            const [id, callback] = [...idle.entries()][0];
            idle.delete(id);
            callback({ didTimeout: false, timeRemaining: () => ms });
        };
        try {
            const names = new Int32Array(10);
            gl.glGenBuffersARB(names.length, names, 0);
            const words = Uint32Array.from({ length: 256 }, (_, i) => [0xff001122, 0x7fc00001, 0, 255, 0xffffffff][i % 5]);
            const raw = new Uint8Array(words.buffer);
            const upload = (id: number, input: Uint8Array<ArrayBuffer>, target: number = E.GL_ARRAY_BUFFER) => {
                gl.glBindBufferARB(target, id);
                gl.glBufferDataARB(target, input.length, ByteBuffer.wrap(input), E.GL_STATIC_DRAW);
                return requireNonNull(gl.buffers.get(id));
            };
            const a = upload(names[0], raw);
            const first = gl.realizeBuffer(a);
            drain(0);
            check('busy deadline defers static compaction', idle.size === 1 && a.retainedByteLength === raw.length, '');
            drain(8);
            check('logical capacity survives word dictionary compaction', idle.size === 0 && a.byteLength === raw.length && a.retainedByteLength === words.length + 5 * 4, '');
            const unaligned = new Uint8Array(raw.length + 1);
            unaligned.set(raw, 1);
            const b = upload(names[1], unaligned.subarray(1));
            check('unaligned duplicate matches resident compact store', gl.realizeBuffer(b) === first && b.retainedByteLength === a.retainedByteLength, '');
            const collision = raw.slice();
            collision[37] ^= 1;
            const other = upload(names[2], collision);
            check('sample collision compares every compact word', gl.realizeBuffer(other) !== first, '');

            gl.glBindBufferARB(E.GL_ELEMENT_ARRAY_BUFFER, names[0]);
            const oracle = new DataView(raw.buffer);
            let expected = 0;
            for (let i = 0; i < 7; i++) expected = Math.max(expected, oracle.getUint32(1 + i * 4, true));
            check('array store rebound as elements preserves aligned and unaligned index scans', a.highestIndex(4, 1) === words[1] && a.highestIndex(1, 7) === expected && a.highestIndex(raw.length, 0) === -1, '');
            let rangeFault: unknown;
            try {
                a.highestIndex(raw.length, 1);
            } catch (e) {
                rangeFault = e;
            }
            check('range past compact element backing throws synchronously', rangeFault instanceof RangeError, '');
            const replacement = Uint8Array.of(6, 5, 4, 3, 2);
            gl.glBufferSubDataARB(E.GL_ELEMENT_ARRAY_BUFFER, 5, replacement.length, ByteBuffer.wrap(replacement));
            const updated = gl.realizeBuffer(a);
            const expectedBytes = raw.slice();
            expectedBytes.set(replacement, 5);
            check('unaligned partial update renames and leaves earlier GPU draw untouched', first !== updated && equal(await readBuffer(gpu, first, raw.length), raw) && equal(await readBuffer(gpu, updated, raw.length), expectedBytes), '');
            const view = b.data;
            check('escaped compact bytes materialize once and keep identity', b.retainedByteLength === raw.length && b.data === view && equal(view, raw), '');
            const beforeIdle = other.data;
            if (idle.size !== 0) {
                drain(8);
            }
            check('view exposed before idle keeps identity', idle.size === 0 && beforeIdle === other.data, '');

            const wide = Uint32Array.from({ length: 4096 }, (_, i) => i % 257);
            const wideObject = upload(names[3], new Uint8Array(wide.buffer), E.GL_ELEMENT_ARRAY_BUFFER);
            gl.realizeBuffer(wideObject);
            drain(8);
            check('more than 256 distinct words use wide indices', wideObject.retainedByteLength === wide.length * 2 + 257 * 4 && wideObject.highestIndex(1024, 1) === 256, '');
            const vertex = Uint8Array.from({ length: 8192 }, (_, i) => (i * 17 + (i >> 8)) & 255);
            const cold = upload(names[5], vertex);
            const original = gl.realizeBuffer(cold);
            drain(8);
            check('cold vertex source evicts its full CPU image', cold.retainedByteLength < vertex.length / 4 && cold.byteLength === vertex.length && gl.realizeBuffer(cold) === original, '');
            const identical = upload(names[6], vertex);
            const differentBytes = vertex.slice();
            differentBytes[113] ^= 1;
            const different = upload(names[7], differentBytes);
            check('cold duplicate and sampled-hash collision compare exact source bytes', gl.realizeBuffer(identical) === original && gl.realizeBuffer(different) !== original, '');
            gl.glBindBufferARB(E.GL_ARRAY_BUFFER, names[6]);
            gl.glBufferSubDataARB(E.GL_ARRAY_BUFFER, 113, 1, ByteBuffer.wrap(differentBytes.subarray(113, 114)));
            const changed = gl.realizeBuffer(identical);
            check('partial overwrite on cold source preserves both GPU images', changed !== original && equal(await readBuffer(gpu, changed, vertex.length), differentBytes) && equal(await readBuffer(gpu, original, vertex.length), vertex), '');
            const max = new DataView(vertex.buffer);
            check('cold vertex rebound as indices accepts a new unaligned range', cold.highestIndex(3, 2) === Math.max(max.getUint32(3, true), max.getUint32(7, true)), '');
            const grid = new Float32Array(81 * 5);
            for (let i = 0; i < 81; i++) grid.set([(i % 9) / 8, ((i / 9) | 0) / 8, (i % 9) * 128, -0, ((i / 9) | 0) * 128], i * 5);
            const flat = upload(names[8], new Uint8Array(grid.buffer));
            const flatGpu = gl.realizeBuffer(flat);
            check('flat shadow grid needs zero CPU backing and reconstructs signed zero exactly', flat.retainedByteLength === 0 && equal(await readBuffer(gpu, flatGpu, grid.byteLength), new Uint8Array(grid.buffer)), '');
            new Uint32Array(grid.buffer)[3] = 0x7fc00001;
            const hill = upload(names[9], new Uint8Array(grid.buffer));
            const hillGpu = gl.realizeBuffer(hill);
            check('nonflat shadow grid retains just the 81 height words, including NaN payload', hill.retainedByteLength === 324 && hillGpu !== flatGpu && equal(await readBuffer(gpu, hillGpu, grid.byteLength), new Uint8Array(grid.buffer)), '');
            const pending = upload(names[4], new Uint8Array(wide.buffer).fill(7));
            gl.realizeBuffer(pending);
            gl.dispose();
            check('context disposal cancels pending idle work', idle.size === 0 && pending.byteLength === 0, '');
        } finally {
            if (requested) Object.defineProperty(globalThis, 'requestIdleCallback', requested);
            else Reflect.deleteProperty(globalThis, 'requestIdleCallback');
            if (cancelled) Object.defineProperty(globalThis, 'cancelIdleCallback', cancelled);
            else Reflect.deleteProperty(globalThis, 'cancelIdleCallback');
        }
    });

    await guarded('static buffer stores', async () => {
        const { gl } = setup(gpu, 8, 8, 0);
        const ids = new Int32Array(4);
        gl.glGenBuffersARB(ids.length, ids, 0);
        const original = Uint8Array.from({ length: 256 }, (_, i) => i);
        const client = ByteBuffer.wrap(original.slice());
        for (const id of ids) {
            gl.glBindBufferARB(E.GL_ARRAY_BUFFER, id);
            gl.glBufferDataARB(E.GL_ARRAY_BUFFER, 256, client, E.GL_STATIC_DRAW);
        }
        const [a, b, c, other] = Array.from(ids, id => requireNonNull(gl.buffers.get(id)));
        // Byte 5 lies between the hash samples. Different bytes must always produce distinct stores.
        client.put(5, 99);
        gl.glBufferDataARB(E.GL_ARRAY_BUFFER, 256, client, E.GL_STATIC_DRAW);
        gl.glBindBufferARB(E.GL_ARRAY_BUFFER, ids[0]);
        const first = gl.realizeBuffer(a),
            second = gl.realizeBuffer(b);
        const distinct = gl.realizeBuffer(other);
        check('equal static buffer bytes share CPU/GPU storage and collisions remain distinct', a.data === b.data && a.data === c.data && first === second && a.data !== other.data && distinct !== first, '');
        check('client memory mutation leaves the original GPU store intact', equal(await readBuffer(gpu, first, 256), original), '');
        // Only the soon-to-be-deleted name was used in the new epoch. A subsequent write via a
        // different name must still preserve what that encoded draw reads from the shared GPU buffer.
        gl.realizeBuffer(b);
        gl.glDeleteBuffersARB(1, ids, 1);
        check('deleting a static alias preserves another name', a.gpu === first && a.data === c.data, '');
        gl.glBufferSubDataARB(E.GL_ARRAY_BUFFER, 255, 16, client);
        check('invalid subdata ranges preserve shared storage', gl.glGetError() === E.GL_INVALID_VALUE && a.data === c.data, '');
        let fault: unknown;
        try {
            gl.glBufferDataARB(E.GL_ARRAY_BUFFER, 257, client, E.GL_STATIC_DRAW);
        } catch (e) {
            fault = e;
        }
        check('short replacement input throws before mutating the shared buffer', fault instanceof RangeError && a.data === c.data, '');
        gl.glBufferSubDataARB(E.GL_ARRAY_BUFFER, 0, 16, client);
        const changed = gl.realizeBuffer(a),
            expected = original.slice();
        expected[5] = 99;
        // Capture both GPU stores in the same submission before retiring the pre-update version.
        const oldBytes = await readBuffer(gpu, first, 256);
        check('a static subdata update detaches only the written name', changed !== first && equal(oldBytes, original) && equal(await readBuffer(gpu, changed, 256), expected) && c.data[5] === 5, '');
        const delayed = gl.realizeBuffer(c);
        check('an alias first realized after the previous GPU allocation retired still has its original bytes', delayed !== first && equal(await readBuffer(gpu, delayed, 256), original), '');
        gl.glDeleteBuffersARB(ids.length, ids, 0);
        check('deleting the final names releases static CPU stores', a.data.length === 0 && c.data.length === 0 && other.data.length === 0, '');
    });

    await guarded('context lifecycle', async () => {
        const { context, drawable, gl } = setup(gpu, 8, 8, 0);
        check('makeCurrent again returns CONTEXT_CURRENT', context.makeCurrent() === GLContext.CONTEXT_CURRENT, '');
        context.release();
        check('release clears the current context', GLContext.getCurrent() === null, '');
        check('re-makeCurrent returns CONTEXT_CURRENT', context.makeCurrent() === GLContext.CONTEXT_CURRENT, '');
        check('viewport starts as the surface', [...gl.state.viewport].join(',') === '0,0,8,8' && [...gl.state.scissor].join(',') === '0,0,8,8', [...gl.state.viewport].join(','));
        context.destroy();
        context.release();
        check('destroyed context does not become current', context.makeCurrent() === GLContext.CONTEXT_NOT_CURRENT, '');
        check('getGL survives destroy', context.getGL() === gl, '');
        const other = setup(gpu, 8, 8, 0);
        other.drawable.swapBuffers();
        const window = requireNonNull(other.drawable.currentPresenter());
        const front = requireNonNull(window.front);
        const source = gpu.device.createBuffer({ size: 4, usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST });
        const result = gpu.device.createBuffer({ size: 4, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
        gpu.device.queue.writeBuffer(source, 0, Uint32Array.of(0x12345678));
        gpu.getEncoder().copyBufferToBuffer(source, 0, result, 0, 4);
        gpu.retire(source);
        const epoch = gpu.epoch;
        other.drawable.setRealized(false);
        check('unrealizing frees the drawable buffers', other.drawable.currentTargets() === null, '');
        check('unrealizing submits pending GPU work without another swap', gpu.epoch > epoch, '');
        await result.mapAsync(GPUMapMode.READ);
        check('retirement preserves queued reads of the released source', new Uint32Array(result.getMappedRange())[0] === 0x12345678, '');
        result.unmap();
        result.destroy();
        check('the window retains its front texture between drawables', window.front === front, '');
        releasePresenter(other.drawable.target);
        check('removing the window releases its front texture', window.front === null, '');
        other.context.release();
        check('unrealized drawable is not current', other.context.makeCurrent() === GLContext.CONTEXT_NOT_CURRENT, '');
        const zero = new WebGpuDrawableFactory(FALLBACK_CAPS_PROFILE, { device: gpu }).getGLDrawable(new Surface(0, 0), null, null);
        zero.setRealized(true);
        check('a surface with no size is not ready', zero.createContext(null).makeCurrent() === GLContext.CONTEXT_NOT_CURRENT, '');
        let threw = '';
        try {
            new WebGpuDrawableFactory(FALLBACK_CAPS_PROFILE).getGLDrawable(null, null, null);
        } catch (e) {
            threw = e instanceof Error ? e.message : String(e);
        }
        check('null target', threw === 'IllegalArgumentException: Null target', threw);
        check(
            'swap of a drawable never made current is a no-op',
            (() => {
                const d = new WebGpuDrawableFactory(FALLBACK_CAPS_PROFILE, { device: gpu }).getGLDrawable(new Surface(4, 4), null, null);
                d.swapBuffers();
                return true;
            })(),
            ''
        );
        void drawable;
    });

    await guarded('device loss', async () => {
        const lostDevice = GpuDevice.install(await freshDevice(), 'bgra8unorm');
        GpuDevice.install(gpu.device, gpu.canvasFormat);
        const { gl, drawable, context } = setup(lostDevice, 8, 8, 0);
        const names = new Int32Array(1),
            rgba = Int8Array.of(23, 46, 69, 92);
        gl.glGenTextures(1, names, 0);
        gl.glBindTexture(E.GL_TEXTURE_2D, names[0]);
        gl.glTexImage2D(E.GL_TEXTURE_2D, 0, E.GL_RGBA, 1, 1, 0, E.GL_RGBA, E.GL_UNSIGNED_BYTE, ByteBuffer.wrap(rgba));
        const old = gl.boundTexture(E.GL_TEXTURE_2D);
        const uploaded = gl.realizeTexture(old);
        context.release();
        context.makeCurrent();
        check('releasing and restoring the context preserves the resident texels without another upload', gl.realizeTexture(old) === uploaded && equal(await readLevel(lostDevice, uploaded, 0, 0, 4), Uint8Array.from(rgba)), '');
        gl.glClear(E.GL_COLOR_BUFFER_BIT);
        drawable.swapBuffers();
        lostDevice.device.destroy();
        await lostDevice.device.lost;
        let swap: unknown = null;
        try {
            drawable.swapBuffers();
        } catch (e) {
            swap = e;
        }
        check('swapBuffers on a lost device throws GLException', swap instanceof GLException, String(swap));
        context.release();
        let made: unknown = null;
        try {
            drawable.createContext(null).makeCurrent();
        } catch (e) {
            made = e;
        }
        check('makeCurrent on a lost device throws JavaError (tf.a returns -5)', made instanceof JavaError, String(made));
        context.destroy();
        const fresh = setup(gpu, 8, 8, 0).gl;
        check('recreated context starts with an empty texture namespace', !fresh.textures.has(names[0]), '');
        fresh.glGenTextures(1, names, 0);
        fresh.glBindTexture(E.GL_TEXTURE_2D, names[0]);
        fresh.glTexImage2D(E.GL_TEXTURE_2D, 0, E.GL_RGBA, 1, 1, 0, E.GL_RGBA, E.GL_UNSIGNED_BYTE, ByteBuffer.wrap(rgba));
        const replacement = fresh.realizeTexture(fresh.boundTexture(E.GL_TEXTURE_2D));
        check('fresh context uploads the client sprite again after device loss', replacement !== uploaded && equal(await readLevel(gpu, replacement, 0, 0, 4), Uint8Array.from(rgba)), '');
        fresh.glDeleteTextures(1, names, 0);
        check('deletion removes the resident texture from its context', !fresh.textures.has(names[0]) && fresh.boundTexture(E.GL_TEXTURE_2D).name === 0, '');
    });
}

function equal(a: Uint8Array, b: Uint8Array): boolean {
    return a.length === b.length && a.every((v, i) => v === b[i]);
}

async function readLevel(gpu: GpuDevice, texture: GPUTexture, level: number, layer: number, bpp: number): Promise<Uint8Array> {
    const width = Math.max(1, texture.width >> level);
    const height = Math.max(1, texture.height >> level);
    const pitch = Math.ceil((width * bpp) / 256) * 256;
    const staging = gpu.device.createBuffer({ size: pitch * height, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    gpu.endPass();
    gpu.getEncoder().copyTextureToBuffer({ texture, mipLevel: level, origin: { x: 0, y: 0, z: layer } }, { buffer: staging, bytesPerRow: pitch, rowsPerImage: height }, { width, height, depthOrArrayLayers: 1 });
    gpu.submit();
    await staging.mapAsync(GPUMapMode.READ);
    const mapped = new Uint8Array(staging.getMappedRange());
    const out = new Uint8Array(width * height * bpp);
    for (let y = 0; y < height; y++) out.set(mapped.subarray(y * pitch, y * pitch + width * bpp), y * width * bpp);
    staging.destroy();
    return out;
}

async function readBuffer(gpu: GpuDevice, buffer: GPUBuffer, size: number): Promise<Uint8Array> {
    const staging = gpu.device.createBuffer({ size, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    gpu.endPass();
    gpu.getEncoder().copyBufferToBuffer(buffer, 0, staging, 0, size);
    gpu.submit();
    await staging.mapAsync(GPUMapMode.READ);
    const out = new Uint8Array(staging.getMappedRange()).slice();
    staging.destroy();
    return out;
}

async function replays(gpu: GpuDevice, config: Config): Promise<void> {
    for (const c of config.cases ?? []) {
        await guarded('replay ' + c.name, async () => {
            const profile = capsProfileFromJson(readFileSync(c.profile, 'utf8'));
            const target = new Surface(871, 613);
            const drawables: WebGpuDrawable[] = [];
            const text = replayTrace(readFileSync(c.trace, 'utf8'), sha => readFileSync(join(c.blobs, sha)), new WebGpuDrawableFactory(profile, { device: gpu }), {
                target,
                onRef: (token, value) => {
                    if (value instanceof WebGpuDrawable) drawables.push(value);
                    else if (token.startsWith('@D') && 'inner' in value && (value as { inner: unknown }).inner instanceof WebGpuDrawable) drawables.push((value as { inner: WebGpuDrawable }).inner);
                }
            });
            writeFileSync(join(config.out, c.name + '.webgpu.trace'), text);
            const d = drawables[0];
            if (d === undefined) throw new Error('no drawable');
            // The start cleared to tf.s()'s clear colour (0, 0, 0, 0), swapped, and cleared again.
            const front = await readFront(gpu, d);
            const diff = compare(front, 871, 613, () => 0x000000ff);
            check('replay ' + c.name + ' presents the cleared frame', d.swaps === 1 && diff === '', 'swaps ' + d.swaps + ' ' + diff);
            GpuDevice.current();
        });
    }
}

let gpuRoot: GPU | null = null;

async function titleFrames(gpu: GpuDevice, config: Config): Promise<void> {
    const c = requireNonNull(config.cases)[0];
    const all = readFileSync(c.trace, 'utf8');
    const begin = /^\d+\.\d+\t~mark\ttitle\.0\r?$/m.exec(all);
    const end = /^\d+\.\d+\t~mark\ttitle\.19\r?$/m.exec(all);
    if (!begin || !end) throw new Error('Missing original 2D title checkpoints');
    const warmupSwaps = (all.slice(0, begin.index).match(/\tGLDrawable\.swapBuffers\t/g) ?? []).length;
    const images: Promise<Uint8Array>[] = [];
    const profile = capsProfileFromJson(readFileSync(c.profile, 'utf8'));
    replayTrace(all.slice(0, end.index), sha => readFileSync(join(c.blobs, sha)), new WebGpuDrawableFactory(profile, { device: gpu }), {
        target: new Surface(765, 503),
        onRef(token, ref) {
            if (!token.startsWith('@D') || !('inner' in ref) || !(ref.inner instanceof WebGpuDrawable)) return;
            const d = ref.inner;
            const swap = d.swapBuffers.bind(d);
            d.swapBuffers = () => {
                swap();
                if (d.swaps > warmupSwaps) images.push(readFront(gpu, d));
            };
        }
    });
    check('all 19 two-dimensional title frames presented', images.length === 19, String(images.length));
    // Original runescape_gl.jar on RTX 5070, GL_BACK immediately before each measured swap
    // (HdTitleNativeFrames and NativeGlReadback). Frames 0..18 all contain precisely the same RGBA image.
    const nativeHash = '4c2e91630351bdae9347b54f610c6831660caa1952c36ea6c32ec04aea097da0';
    for (const [frame, image] of (await Promise.all(images)).entries()) {
        const hash = createHash('sha256').update(image).digest('hex');
        check('title ' + frame + ' matches original gamepack RGBA', hash === nativeHash, hash);
    }
}

async function terrainDraws(gpu: GpuDevice, config: Config): Promise<void> {
    const c = requireNonNull(config.cases)[0];
    const original = readFileSync(c.trace, 'utf8');
    const stop = /^\d+\.\d+\t~mark\ttitle\.20\r?$/m.exec(original)?.index;
    if (stop === undefined) throw new Error('Missing original first scene frame');
    const profile = capsProfileFromJson(readFileSync(c.profile, 'utf8'));
    let surface: WebGpuDrawable | undefined,
        context: WebGpuContext | undefined,
        draws = 0;
    let syncPipelines = 0;
    const sync = gpu.device.createRenderPipeline;
    gpu.device.createRenderPipeline = function (desc) {
        if (desc.label === 'gl-indexed') syncPipelines++;
        return sync.call(this, desc);
    };
    const frames = new Map<number | 'present', Promise<Uint8Array>>();
    const draw = WebGpuGL.prototype.glDrawElements as (this: WebGpuGL, mode: number, count: number, type: number, indices: NioBuffer | null | bigint) => void;
    WebGpuGL.prototype.glDrawElements = function (mode, count, type, indices) {
        draw.call(this, mode, count, type, indices);
        draws++;
        if ([1, 5, 12, 14, 36, 37, 39, 232].includes(draws)) frames.set(draws, requireNonNull(surface).targets(gpu).readBack());
    };
    try {
        const replay = replayTraceMarkers(original.slice(0, stop), sha => readFileSync(join(c.blobs, sha)), new WebGpuDrawableFactory(profile, { device: gpu }), {
            target: new Surface(765, 503),
            onRef(token, ref) {
                if (token.startsWith('@D') && 'inner' in ref && ref.inner instanceof WebGpuDrawable) surface = ref.inner;
                if (token.startsWith('@C') && 'inner' in ref && ref.inner instanceof WebGpuContext) context = ref.inner;
            }
        });
        for (const marker of replay) {
            if (marker === 'title.0') {
                const drawable = requireNonNull(surface);
                await requireNonNull(context).driver().prewarmIndexedPipelines(drawable.sampleCount);
            }
        }
    } finally {
        WebGpuGL.prototype.glDrawElements = draw;
        gpu.device.createRenderPipeline = sync;
    }
    frames.set('present', readFront(gpu, requireNonNull(surface)));
    check('all original frame-19 indexed draws executed', draws === 232, String(draws));
    check('original title scene uses the asynchronously compiled pipelines', syncPipelines === 0, String(syncPipelines) + ' synchronous creations');
    for (const [n, read] of frames) {
        const image = await read,
            expected = readFileSync(join(requireNonNull(c.native), 'terrain-' + n + '.rgba'));
        writeFileSync(join(config.out, 'terrain-' + n + '.rgba'), image);
        let changed = 0,
            max = 0,
            sum = 0,
            large = 0;
        for (let i = 0; i < image.length; i += 4) {
            let px = 0;
            for (let k = 0; k < 4; k++) {
                const diff = Math.abs(expected[i + k] - image[i + k]);
                sum += diff;
                px = Math.max(px, diff);
            }
            if (px) changed++;
            if (px > 2) large++;
            max = Math.max(px, max);
        }
        // Terrain must match within one channel step. For the model pass, compare the full image with
        // a mean RGB error below 0.01/255 and fewer than one in 10,000 pixels differing above 2/255.
        const matches = n === 'present' ? changed === 0 : n >= 36 ? large < image.length / 4 / 10000 && sum / ((image.length / 4) * 3) < 0.01 : max <= 1;
        check('native RGBA after ' + (n === 'present' ? 'first 3D title swap' : 'indexed draw ' + n), expected.length === image.length && matches, JSON.stringify({ changed, large, max, sum }));
    }
}

async function waterFrames(gpu: GpuDevice, config: Config): Promise<void> {
    const c = requireNonNull(config.cases)[0];
    const size = 128;
    let surface: WebGpuDrawable | null = null;
    const profile = capsProfileFromJson(readFileSync(c.profile, 'utf8'));
    const frames = replayTraceMarkers(readFileSync(c.trace, 'utf8'), sha => readFileSync(join(c.blobs, sha)), new WebGpuDrawableFactory(profile, { device: gpu }), {
        target: new Surface(size, size),
        onRef(token, ref) {
            if (token.startsWith('@D') && 'inner' in ref && ref.inner instanceof WebGpuDrawable) surface = ref.inner;
        }
    });
    for (const name of frames) {
        if (!name.startsWith('water.')) continue;
        const image = await requireNonNull(surface as WebGpuDrawable | null)
            .targets(gpu)
            .readBack();
        const expected = readFileSync(join(requireNonNull(c.native), name + '.rgba'));
        if (expected.length !== image.length) throw new Error('Water frame dimensions');
        let covered = 0,
            maxDifference = 0,
            differentPixels = 0;
        const higher = [0, 0, 0, 0],
            lower = [0, 0, 0, 0];
        let firstDifference: { x: number; y: number; native: number[]; webgpu: number[] } | undefined;
        for (let i = 0; i < expected.length; i += 4) {
            if (expected[i] !== 51 || expected[i + 1] !== 102 || expected[i + 2] !== 153) covered++;
            let different = false;
            for (let k = 0; k < 4; k++) {
                const delta = image[i + k] - expected[i + k];
                if (delta > 0) higher[k]++;
                if (delta < 0) lower[k]++;
                if (delta !== 0) different = true;
                maxDifference = Math.max(maxDifference, Math.abs(delta));
            }
            if (different) {
                differentPixels++;
                firstDifference ??= { x: (i / 4) % size, y: (i / 4 / size) | 0, native: Array.from(expected.subarray(i, i + 4)), webgpu: Array.from(image.subarray(i, i + 4)) };
            }
        }
        check(name + ' native RGBA', covered > 100 && maxDifference <= 1, JSON.stringify({ covered, differentPixels, higher, lower, maxDifference, firstDifference }));
    }
}

async function main(): Promise<void> {
    const config = JSON.parse(readFileSync(process.argv[2], 'utf8')) as Config;
    const webgpu = (await import(pathToFileURL(config.webgpu).href)) as { create: (o: string[]) => GPU; globals: object };
    Object.assign(globalThis, webgpu.globals);
    // Keep the GPU object reachable for the whole run: dawn.node crashes if it is collected under a live adapter.
    gpuRoot = webgpu.create([]);
    const adapter = await gpuRoot.requestAdapter({ powerPreference: 'high-performance' });
    if (adapter === null) throw new Error('no WebGPU adapter');
    const device = await adapter.requestDevice();
    const errors: string[] = [];
    device.addEventListener('uncapturederror', e => errors.push((e as GPUUncapturedErrorEvent).error.message));
    const gpu = GpuDevice.install(device, 'bgra8unorm');
    const freshDevice = async (): Promise<GPUDevice> => {
        const a = await gpuRoot?.requestAdapter({ powerPreference: 'high-performance' });
        if (a === null || a === undefined) throw new Error('no second adapter');
        return a.requestDevice();
    };
    if (config.mode === 'gpu') await gpuChecks(gpu, freshDevice);
    else if (config.mode === 'title') await titleFrames(gpu, config);
    else if (config.mode === 'terrain') await terrainDraws(gpu, config);
    else if (config.mode === 'water') await waterFrames(gpu, config);
    else await replays(gpu, config);
    gpu.submit();
    await device.queue.onSubmittedWorkDone();
    check('no WebGPU validation errors', errors.length === 0, errors.slice(0, 5).join(' | '));
    writeFileSync(join(config.out, 'report.json'), JSON.stringify({ adapter: adapter.info?.description ?? '', checks }, null, 1));
    device.destroy();
}

main().then(
    () => process.exit(0),
    e => {
        console.error(e instanceof Error ? e.stack : String(e));
        process.exit(1);
    }
);
