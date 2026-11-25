import { afterAll, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { capsProfileFromJson, capsProfileToJson, RADEON_CAPS_PROFILE } from '#/gl/CapsProfile.js';
import { NullGLDrawableFactory } from '#/gl/NullGL.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';
import { diffTraces } from './glTraceDiff.js';
import { type ReplayCase, runDriverNode } from './driver-node.js';
import { replayTrace } from './driver-replay.js';

// The driver must not change what the port records (HD batch H1 gate, HD_PLAN 3.2). The 12 original tf.a(Canvas,int)
// starts of Codex's HdInitOracle (AA 0/2/4 x rtx5070 / no VBO / no 3D textures / Radeon, the profiles of
// init-context.test.ts) are recorded from runescape_gl.jar, then their calls are replayed into
// RecordingGL(NullGL) here and into RecordingGL(WebGpuGL) on headless Dawn under node. All three traces must be the
// same: Java = NullGL replay (the replayer reissues the calls faithfully), and NullGL replay = WebGpuGL replay, record
// for record and byte for byte (the driver answers every Java-visible question as NullGL does). The WebGpuGL run also
// really clears and presents the frame (checked on its front buffer).

const dir = mkdtempSync(join(tmpdir(), 'rs530-driver-parity-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const classpath = [dir, hdGamepackPath, joglPath].join(delimiter);
const build = Bun.spawnSync(['javac', '-encoding', 'UTF-8', '-cp', classpath, '-d', dir, join(import.meta.dir, 'GlRecorder.java'), join(import.meta.dir, 'HdInitOracle.java')]);
const buildOutput = build.stderr.toString();

const captured = readFileSync(join(import.meta.dir, 'rtx5070.json'), 'utf8');
const removed = { full: null, noVbo: 'GL_ARB_vertex_buffer_object', no3d: 'GL_EXT_texture3D' } as const;
for (const [name, extension] of Object.entries(removed)) {
    const profile = JSON.parse(captured);
    if (extension !== null)
        profile.strings[7939] = (profile.strings[7939] as string)
            .split(' ')
            .filter(x => x !== extension)
            .join(' ');
    writeFileSync(join(dir, name + '.json'), JSON.stringify(profile));
}
writeFileSync(join(dir, 'radeon.json'), capsProfileToJson(RADEON_CAPS_PROFILE));

const cases: (ReplayCase & { readonly java: { readonly exitCode: number; readonly output: string } })[] = [];
if (build.exitCode === 0) {
    for (const profile of ['full', 'noVbo', 'no3d', 'radeon'] as const) {
        for (const samples of [0, 2, 4]) {
            const name = profile + '-' + samples;
            const traceDir = join(dir, name);
            const run = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', classpath, 'HdInitOracle', traceDir, join(dir, profile + '.json'), String(samples), 'model'], { timeout: 30000 });
            cases.push({
                name,
                trace: join(traceDir, 'trace.tsv'),
                blobs: join(traceDir, 'blobs'),
                profile: join(dir, profile + '.json'),
                java: { exitCode: run.exitCode ?? -1, output: run.stdout.toString() + run.stderr.toString() }
            });
        }
    }
}
const ran = cases.filter(c => c.java.exitCode === 0);
const node = await runDriverNode('replay', ran);

test('the Java oracle compiled and ran all 12 starts', () => {
    expect(build.exitCode, buildOutput).toBe(0);
    expect(cases).toHaveLength(12);
    for (const c of cases) expect(c.java.exitCode, c.name + ': ' + c.java.output).toBe(0);
});

test('the WebGpuGL replays ran under node', () => {
    expect(node.exitCode, node.output).toBe(0);
    const failed = node.checks.filter(c => !c.ok).map(c => c.name + ': ' + c.detail);
    expect(failed).toEqual([]);
    expect(node.checks.filter(c => c.name.startsWith('replay ')).length).toBe(12);
});

for (const c of ran) {
    test(c.name + ': Java trace = RecordingGL(NullGL) replay = RecordingGL(WebGpuGL) replay', () => {
        const java = readFileSync(c.trace, 'utf8');
        const profile = capsProfileFromJson(readFileSync(c.profile, 'utf8'));
        const nullText = replayTrace(java, sha => readFileSync(join(c.blobs, sha)), new NullGLDrawableFactory(profile), { target: { width: 871, height: 613 } });
        const vsJava = diffTraces(java, nullText, { expectedLabel: 'java', actualLabel: 'nullgl-replay' });
        expect(vsJava.equal, vsJava.report).toBe(true);
        const webgpuText = readFileSync(join(node.dir, c.name + '.webgpu.trace'), 'utf8');
        const vsNull = diffTraces(nullText, webgpuText, { expectedLabel: 'nullgl-replay', actualLabel: 'webgpu-replay', includeDeletions: true });
        expect(vsNull.equal, vsNull.report).toBe(true);
        expect(webgpuText).toBe(nullText);
        // The start's shape (init-context.test.ts): the record counts before the dynamic-model mark.
        const records = webgpuText.split('\n').filter(l => l.length > 0 && !l.startsWith('#'));
        const mark = records.indexOf('1.1\t~mark\tdynamic-model');
        expect(mark).toBe(c.name.startsWith('no3d') ? 833 : c.name.startsWith('noVbo') ? 370 : 371);
    });
}
