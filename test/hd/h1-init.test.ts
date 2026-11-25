import { afterAll, beforeAll, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { capsProfileToJson, RADEON_CAPS_PROFILE } from '#/gl/CapsProfile.js';
import GlLighting from '#/gl/GlLighting.js';
import PointLightManager from '#/gl/PointLightManager.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

// H1 GATE (HD_PLAN.md 4, row H1). For each of Codex's 12 starts (AA 0/2/4 under the captured RTX 5070 profile, no
// VBO, no 3D textures, and RADEON_CAPS_PROFILE):
//  1. the original tf.a(Ljava/awt/Canvas;I)I of runescape_gl.jar through GlRecorder: HdH1InitOracle runs Codex's
//     HdInitOracle start unchanged, then dumps the Java-visible state;
//  2. the port's GlRenderer.init through RecordingGL over NullGL(profile), reached through the JOGL mirror's
//     drawable-factory registry (h1InitHarness.ts under bun);
//  3. the same TS sequence through RecordingGL over WebGpuGL on headless Dawn (the harness bundled and run by node).
// (1) and (2) must agree record for record in GLTrace v1 (names normalized by first use, buffer, string and texture
// payloads by SHA-256, frame and sequence numbers), and print the same status lines and the same dump: every tf static,
// the fa counters, the lm noise statics with both volume hashes, the material table aa.t with each renderer's fields
// (display-list bases, cube maps, program, ramp textures, planes, rd's noise table) and the material statics. (3) must
// produce exactly the trace and dump of (2).
//
// tf.f()V also calls GlLighting.init (mk.e) and PointLightManager.init (jf.e), and tf.s()V PointLightManager.allocate
// (jf.f): GlLighting and PointLightManager are batches H3 and H5. Until those members exist the harness installs
// stubs (only for the missing members), the mk.e and jf.e stubs mark their call, and the Java trace's run of calls under
// each of them becomes one `~call` record there; sequence numbers are then reassigned per frame on both sides. Every
// other record is compared as recorded. When the members land, PENDING is empty and the comparison is the raw trace.

type Profile = Record<string, unknown> & { strings: Record<string, string> };

const PROFILES = ['full', 'noVbo', 'no3d', 'radeon'] as const;
const SAMPLES = [0, 2, 4] as const;
const EXTENSIONS = { full: null, noVbo: 'GL_ARB_vertex_buffer_object', no3d: 'GL_EXT_texture3D' } as const;
// Codex's record counts for these starts (init-context.test.ts, the records before its dynamic-model mark).
const RECORDS = { full: 371, noVbo: 370, no3d: 833, radeon: 371 } as const;

// The members tf calls whose owners are not ported yet: owner, member, Java method, marked by the stub.
const PENDING = (
    [
        [GlLighting, 'GlLighting', 'init', 'mk.e', true],
        [PointLightManager, 'PointLightManager', 'allocate', 'jf.f', false],
        [PointLightManager, 'PointLightManager', 'init', 'jf.e', true],
        [PointLightManager, 'PointLightManager', 'release', 'jf.c', false]
    ] as const
).filter(([owner, , member]) => typeof Reflect.get(owner, member) !== 'function');
const STRICT = PENDING.length === 0;
const COLLAPSED: readonly string[] = PENDING.filter(([, , , , marks]) => marks).map(([, , , java]) => java);

interface Case {
    readonly name: string;
    readonly profile: (typeof PROFILES)[number];
    readonly samples: number;
}

const cases: Case[] = PROFILES.flatMap(profile => SAMPLES.map(samples => ({ name: profile + ' ' + samples, profile, samples })));

interface Side {
    readonly stdout: string[];
    readonly trace: TraceRecord[];
    readonly records: string[];
    readonly stubs: string[];
    readonly errors: string[];
    readonly driver: string;
}

interface Result {
    readonly java: Side;
    readonly ts: Side;
    // the streams compared: raw records when STRICT, otherwise with the stubbed callees collapsed and resequenced
    readonly javaStream: string[];
    readonly tsStream: string[];
    // Java records under each collapsed callee
    readonly collapsed: Map<string, number>;
}

let dir = '';
const results = new Map<string, Result>();
const runErrors = new Map<string, string>();
const webgpuResults = new Map<string, Side>();
const webgpuErrors = new Map<string, string>();

function lines(text: string): string[] {
    return text
        .replace(/\r\n/g, '\n')
        .trimEnd()
        .split('\n')
        .filter(line => line.length > 0);
}

interface TraceRecord {
    readonly line: string;
    stack: string | null;
}

function parseTrace(text: string): TraceRecord[] {
    const records: TraceRecord[] = [];
    for (const line of lines(text)) {
        if (line.startsWith('#@ ')) {
            const last = records.at(-1);
            if (last !== undefined) last.stack = line.slice(3);
        } else if (!line.startsWith('#')) {
            records.push({ line, stack: null });
        }
    }
    return records;
}

// "<frame>.<seq>\t<entry>\t..." -> [frame, deletion, entry and columns]
function split(line: string): [string, boolean, string] {
    const tab = line.indexOf('\t');
    const id = line.slice(0, tab);
    const dot = id.indexOf('.');
    return [id.slice(0, dot), id.charAt(dot + 1) === 'd', line.slice(tab + 1)];
}

// Reassigns the sequence numbers per frame (ordered records and deletions counted apart, as both recorders do).
function resequence(stream: string[]): string[] {
    let frame = '';
    let seq = 0;
    let deletions = 0;
    return stream.map(line => {
        const [f, deletion, rest] = split(line);
        if (f !== frame) {
            frame = f;
            seq = 0;
            deletions = 0;
        }
        return f + '.' + (deletion ? 'd' + deletions++ : String(seq++)) + '\t' + rest;
    });
}

// The Java records under a collapsed callee (a stack frame of mk.e or jf.e; those sit 3-5 frames under the oracle, so
// the 8-frame stack always holds the outermost one) become one `~call\t<method>` record per run. A run is keyed by
// that frame's method and its caller's frame.
function collapseJava(records: TraceRecord[], counts: Map<string, number>): string[] {
    const stream: string[] = [];
    let run: string | null = null;
    for (const record of records) {
        const [frame, , rest] = split(record.line);
        const frames = record.stack === null ? [] : record.stack.split(' < ');
        const outer = frames.findLastIndex(f => COLLAPSED.includes(f.split(' ')[0]));
        if (outer < 0) {
            stream.push(record.line);
            run = null;
            continue;
        }
        const callee = frames[outer].split(' ')[0];
        const key = callee + ' < ' + (frames[outer + 1] ?? '');
        counts.set(callee, (counts.get(callee) ?? 0) + 1);
        if (key !== run) {
            run = key;
            stream.push(frame + '.0\t~call\t' + callee);
        }
        if (rest.startsWith('~')) throw new Error('control record inside ' + callee + ': ' + record.line);
    }
    return resequence(stream);
}

function collapseTs(records: TraceRecord[]): string[] {
    return resequence(
        records.map(record => {
            const [frame, , rest] = split(record.line);
            const fields = rest.split('\t');
            return fields[0] === '~mark' && fields[1].startsWith('call.') ? frame + '.0\t~call\t' + fields[1].slice(5) : record.line;
        })
    );
}

function readSide(path: string, stdout: string, javaSide: boolean): Side {
    const trace = parseTrace(readFileSync(join(path, 'trace.tsv'), 'utf8'));
    const optional = (name: string) => {
        try {
            return lines(readFileSync(join(path, name), 'utf8'));
        } catch {
            return [];
        }
    };
    return {
        stdout: lines(stdout),
        records: trace.map(record => record.line),
        stubs: javaSide ? [] : optional('stubs.txt'),
        errors: javaSide ? [] : optional('errors.txt'),
        driver: javaSide ? 'GlRecorder' : optional('driver.txt').join(' '),
        trace
    };
}

async function spawn(command: string[], label: string): Promise<string> {
    const child = Bun.spawn(command, { stdout: 'pipe', stderr: 'pipe' });
    const [stdout, stderr] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text()]);
    const exit = await child.exited;
    if (exit !== 0) throw new Error(label + ' exited ' + exit + '\n' + stdout + stderr);
    return stdout;
}

function caseDir(c: Case, side: string): string {
    return join(dir, c.name.replace(/ /g, '-') + '-' + side);
}

async function runCase(c: Case, classpath: string): Promise<void> {
    const profilePath = join(dir, c.profile + '.json');
    const [javaOut] = await Promise.all([
        spawn(['java', '-Djava.awt.headless=true', '-cp', classpath, 'HdH1InitOracle', caseDir(c, 'java'), profilePath, String(c.samples)], c.name + ': HdH1InitOracle'),
        spawn(['bun', 'run', join(import.meta.dir, 'h1InitHarness.ts'), caseDir(c, 'ts'), profilePath, String(c.samples), 'null'], c.name + ': h1InitHarness (NullGL)')
    ]);
    const java = readSide(caseDir(c, 'java'), javaOut, true);
    const ts = readSide(caseDir(c, 'ts'), readFileSync(join(caseDir(c, 'ts'), 'stdout.txt'), 'utf8'), false);
    const collapsed = new Map<string, number>();
    results.set(c.name, {
        java,
        ts,
        collapsed,
        javaStream: STRICT ? java.records : collapseJava(java.trace, collapsed),
        tsStream: STRICT ? ts.records : collapseTs(ts.trace)
    });
}

async function runWebGpu(c: Case, bundle: string, webgpu: string): Promise<void> {
    const out = caseDir(c, 'webgpu');
    await spawn(['node', bundle, out, join(dir, c.profile + '.json'), String(c.samples), 'webgpu', webgpu], c.name + ': h1InitHarness (WebGpuGL)');
    webgpuResults.set(c.name, readSide(out, readFileSync(join(out, 'stdout.txt'), 'utf8'), false));
}

beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'rs530-h1-init-'));
    const classpath = [dir, hdGamepackPath, joglPath].join(delimiter);
    const sources = ['GlRecorder.java', 'HdInitOracle.java', 'HdH1InitOracle.java'].map(name => join(import.meta.dir, name));
    const build = Bun.spawnSync(['javac', '-encoding', 'UTF-8', '-cp', classpath, '-d', dir, ...sources]);
    if (build.exitCode !== 0) throw new Error(build.stderr.toString());
    // The profiles of init-context.test.ts: the capture, the capture without one extension, and the Radeon profile.
    const captured = readFileSync(join(import.meta.dir, 'rtx5070.json'), 'utf8');
    for (const [name, extension] of Object.entries(EXTENSIONS)) {
        const profile = JSON.parse(captured) as Profile;
        if (extension !== null) {
            const tokens = profile.strings['7939'].split(' ');
            if (!tokens.includes(extension)) throw new Error('capture lacks ' + extension);
            profile.strings['7939'] = tokens.filter(x => x !== extension).join(' ');
        }
        writeFileSync(join(dir, name + '.json'), JSON.stringify(profile));
    }
    writeFileSync(join(dir, 'radeon.json'), capsProfileToJson(RADEON_CAPS_PROFILE));
    const bundled = await Bun.build({ entrypoints: [join(import.meta.dir, 'h1InitHarness.ts')], target: 'node', format: 'esm', outdir: join(dir, 'bundle') });
    if (!bundled.success) throw new Error('bundle failed: ' + bundled.logs.map(l => String(l)).join('\n'));
    const bundle = bundled.outputs[0].path;
    const webgpu = createRequire(import.meta.url).resolve('webgpu');
    // Java + bun pairs four at a time; the Dawn runs one at a time alongside them.
    const queue = [...cases];
    const gpuQueue = [...cases];
    await Promise.all([
        ...Array.from({ length: 4 }, async () => {
            for (let c = queue.shift(); c !== undefined; c = queue.shift()) {
                try {
                    await runCase(c, classpath);
                } catch (error) {
                    runErrors.set(c.name, String(error));
                }
            }
        }),
        (async () => {
            for (let c = gpuQueue.shift(); c !== undefined; c = gpuQueue.shift()) {
                try {
                    await runWebGpu(c, bundle, webgpu);
                } catch (error) {
                    webgpuErrors.set(c.name, String(error));
                }
            }
        })()
    ]);
}, 600000);

afterAll(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
});

function result(name: string): Result {
    const r = results.get(name);
    if (r === undefined) throw new Error(runErrors.get(name) ?? 'no result for ' + name);
    return r;
}

function webgpuResult(name: string): Side {
    const r = webgpuResults.get(name);
    if (r === undefined) throw new Error(webgpuErrors.get(name) ?? 'no WebGpuGL result for ' + name);
    return r;
}

// null when equal, otherwise the first differing record with both sides.
function divergence(expected: readonly string[], actual: readonly string[]): string | null {
    const n = Math.max(expected.length, actual.length);
    for (let i = 0; i < n; i++) {
        if (expected[i] !== actual[i]) return 'record ' + i + ' of ' + expected.length + '/' + actual.length + ': expected ' + (expected[i] ?? '<end>') + ' | actual ' + (actual[i] ?? '<end>');
    }
    return null;
}

function matched(expected: readonly string[], actual: readonly string[]): number {
    let i = 0;
    while (i < expected.length && i < actual.length && expected[i] === actual[i]) i++;
    return i;
}

for (const c of cases) {
    test(c.name + ': GlRenderer.init over NullGL matches the original tf.a record for record, and its statics', () => {
        const r = result(c.name);
        expect(r.ts.driver).toBe('NullGL swaps -');
        expect(divergence(r.javaStream, r.tsStream)).toBeNull();
        expect(r.ts.stdout).toEqual(r.java.stdout);
    });
    test(c.name + ': the same TS start over WebGpuGL on headless Dawn gives the NullGL trace and statics', () => {
        const ts = result(c.name).ts;
        const webgpu = webgpuResult(c.name);
        expect(webgpu.driver).toBe('WebGpuGL swaps 1');
        expect(webgpu.errors).toEqual([]);
        expect(divergence(ts.records, webgpu.records)).toBeNull();
        expect(webgpu.stdout).toEqual(ts.stdout);
    });
}

test("sanity: the Java side is Codex's start and the dump covers tf, fa, lm and the material table", () => {
    for (const c of cases) {
        const r = result(c.name);
        expect(r.java.records).toHaveLength(RECORDS[c.profile]);
        expect(r.java.stdout.slice(0, 4)).toEqual([
            'status 0',
            'context true true true true 871 613',
            'caps ' + (c.profile !== 'noVbo') + ' ' + (c.profile !== 'no3d') + ' true true true 4 ' + (c.profile === 'radeon'),
            'materials - vm rd wg pd ob ue'
        ]);
        const dumped = r.java.stdout.filter(line => line.startsWith('dump ')).map(line => line.split(' ')[1]);
        expect(dumped.filter(name => name.startsWith('tf.'))).toHaveLength(37);
        expect(dumped.filter(name => /^(vm|rd|wg|pd|ob)\.[a-z]$/.test(name))).toHaveLength(16 + 3);
        expect(dumped).toContain('lm.c');
        expect(dumped).toContain('fa.a');
    }
});

test('sanity: only the stubbed callees are collapsed, once each, in tf.f()V order', () => {
    for (const c of cases) {
        const r = result(c.name);
        expect(r.ts.stubs).toEqual(PENDING.map(([, owner, member, java]) => owner + '.' + member + ' ' + java));
        expect(webgpuResult(c.name).stubs).toEqual(r.ts.stubs);
        const calls = r.javaStream.filter(line => split(line)[2].startsWith('~call\t')).map(line => split(line)[2]);
        expect(calls).toEqual(COLLAPSED.map(java => '~call\t' + java));
        // Everything else is compared. mk.e issues 6 calls, mk.a(IFFF) 3 and mk.a(II) 6 (mk.a(FFF) none); jf.e 3 per
        // light on LIGHT4..7, and jf.a(I) none, since jf.f()V starts all four lights off.
        const expected = new Map(COLLAPSED.map(java => [java, java === 'mk.e' ? 15 : java === 'jf.e' ? 12 : -1]));
        expect(r.collapsed).toEqual(expected);
        expect(r.java.records.length - r.javaStream.length).toBe([...expected.values()].reduce((a, b) => a + b, 0) - calls.length);
        expect(r.javaStream.filter(line => split(line)[2].startsWith('glNewList'))).toHaveLength(10);
    }
});

(STRICT ? test : test.todo)('the gate is strict: GlLighting.init (mk.e) and PointLightManager.allocate/init/release (jf.f/jf.e/jf.c) are ported, so the raw traces are compared', () => {
    expect(PENDING.map(([, owner, member]) => owner + '.' + member)).toEqual([]);
});

test('summary: records matched per case', () => {
    const rows = cases.map(c => {
        const r = results.get(c.name);
        const w = webgpuResults.get(c.name);
        const nullGl =
            r === undefined
                ? (runErrors.get(c.name) ?? 'no result').split('\n')[0]
                : matched(r.javaStream, r.tsStream) +
                  '/' +
                  Math.max(r.javaStream.length, r.tsStream.length) +
                  (STRICT ? '' : ' (Java ' + r.java.records.length + ' records, ' + COLLAPSED.join('/') + ' collapsed)') +
                  ', dump ' +
                  (r.ts.stdout.join('\n') === r.java.stdout.join('\n') ? 'equal' : 'differs');
        const webgpu =
            r === undefined || w === undefined
                ? (webgpuErrors.get(c.name) ?? 'no result').split('\n')[0]
                : matched(r.ts.records, w.records) + '/' + Math.max(r.ts.records.length, w.records.length) + ', dump ' + (w.stdout.join('\n') === r.ts.stdout.join('\n') ? 'equal' : 'differs');
        return c.name + ': NullGL ' + nullGl + '; WebGpuGL ' + webgpu;
    });
    console.log('H1 gate ' + (STRICT ? '(strict)' : '(stubbed: ' + PENDING.map(([, owner, member]) => owner + '.' + member).join(', ') + ')') + '\n' + rows.join('\n'));
    expect(rows).toHaveLength(12);
});
