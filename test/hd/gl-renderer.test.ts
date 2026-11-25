import { afterAll, beforeAll, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { capsProfileToJson, RADEON_CAPS_PROFILE } from '#/gl/CapsProfile.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

// H1 gate for src/gl/GlRenderer.ts (tf). HdRendererOracle.java runs the original tf of runescape_gl.jar through
// GlRecorder; glRendererHarness.ts runs the port through RecordingGL over NullGL with the same profile, canvas and
// call sequence. Both print status lines and a dump of every tf static after each step, which must match exactly.
// The traces must match in every GL and context call that tf (or fa, vi, sd in the objects scenario) issues itself: the
// Java trace keeps a record when its stack is frames of those classes up to the oracle, and each run of calls from te.e, mk.e or jf.e (the callees owned by other units,
// stubbed on the TS side) becomes one `~call` line that the TS stubs mark at their call. Sequence numbers are dropped
// and generated names renumbered by first use, since the Java callees allocate names in between.

type Profile = Record<string, unknown> & {
    strings: Record<string, string>;
    integers: Record<string, number[]>;
    floats: Record<string, string[]>;
    missingEntryPoints: string[];
};

interface Run {
    readonly name: string;
    readonly profile: string;
    readonly samples: number;
    readonly scenario: string;
}

const runs: Run[] = [];
for (const profile of ['full', 'noVbo', 'no3d', 'radeon']) {
    for (const samples of [0, 2, 4]) runs.push({ name: 'init ' + profile + ' ' + samples, profile, samples, scenario: 'init' });
}
for (const [profile, samples] of [
    ['full', 0],
    ['no3d', 2],
    ['radeon', 4]
] as const) {
    runs.push({ name: 'ops ' + profile + ' ' + samples, profile, samples, scenario: 'ops' });
}
// Two GL_VERSION answers are left out because the H0 CapsProfile.joglVersion rejects them while JOGL's
// FunctionAvailabilityCache$Version accepts them, so no TS profile can carry them yet: Unicode digits
// ("١.٥", which tf.m()I's Integer.parseInt also accepts) and a leading space (" 2.1").
const failures = [
    'mesa',
    'microsoft',
    'brianPaul',
    'gl11',
    'versionEmpty',
    'versionNegative',
    'version115',
    'noMultitexture',
    'noCombine',
    'units1',
    'coords1',
    'imageUnits1',
    'noGenBuffers',
    'radeon7500',
    'radeon9250',
    'radeonX1950',
    'radeon9600',
    'radeonWord',
    'everything'
];
for (const profile of failures) runs.push({ name: 'probe ' + profile, profile, samples: 0, scenario: 'init' });
for (const scenario of ['mc0', 'mcThrow2', 'mcError', 'swapFail', 'swap2', 'createThrows', 'nullCanvas']) {
    runs.push({ name: 'platform ' + scenario, profile: 'full', samples: scenario === 'swap2' ? 4 : 0, scenario });
}
runs.push({ name: 'objects GlCleaner GlBuffer GlSolidTexture', profile: 'full', samples: 0, scenario: 'objects' });
// Integration with the materials and noise units: Codex's 12 starts again, with the real MaterialManager, NoiseTextures
// and material renderers on the TS side (the Java side is the plain init run), so te.e(6) is compared call for call.
for (const profile of ['full', 'noVbo', 'no3d', 'radeon']) {
    for (const samples of [0, 2, 4]) runs.push({ name: 'integrated ' + profile + ' ' + samples, profile, samples, scenario: 'integrated' });
}
// ga.a()V (GlRenderer.initPointParameters): the captured POINT_SIZE_MAX 2047 (clamped), exactly 1024 and the next float
// above it (fcmpl > 1024), a small maximum, and the profiles without GL_ARB_point_parameters / GL_ARB_point_sprite.
const pointProfiles = ['pointsMax1024', 'pointsMaxAbove1024', 'pointsMax64', 'noPointParameters', 'noPointSprite'];
for (const profile of ['full', 'radeon', ...pointProfiles]) runs.push({ name: 'points ' + profile, profile, samples: 0, scenario: 'points' });

interface Result {
    java: string[];
    ts: string[];
    javaTrace: string[];
    tsTrace: string[];
    callees: string[];
}

let dir = '';
const results = new Map<string, Result>();
const runErrors = new Map<string, string>();

function variant(base: Profile, name: string): Profile {
    const p = structuredClone(base);
    const without = (ext: string) => {
        p.strings['7939'] = p.strings['7939']
            .split(' ')
            .filter(x => x !== ext)
            .join(' ');
    };
    switch (name) {
        case 'full':
            break;
        case 'noVbo':
            without('GL_ARB_vertex_buffer_object');
            break;
        case 'no3d':
            without('GL_EXT_texture3D');
            break;
        case 'mesa':
            p.strings['7936'] = 'Mesa Project';
            break;
        case 'microsoft':
            p.strings['7936'] = 'Microsoft Corporation';
            break;
        case 'brianPaul':
            p.strings['7936'] = 'Brian Paul';
            break;
        case 'gl11':
            p.strings['7938'] = '1.1.0';
            break;
        case 'versionEmpty':
            p.strings['7938'] = '2..1';
            break;
        case 'versionNegative':
            p.strings['7938'] = '-1.5';
            break;
        case 'version115':
            p.strings['7938'] = '1.15';
            break;
        case 'noMultitexture':
            without('GL_ARB_multitexture');
            break;
        case 'noCombine':
            without('GL_ARB_texture_env_combine');
            break;
        case 'units1':
            p.integers['34018'] = [1];
            break;
        case 'coords1':
            p.integers['34929'] = [1];
            break;
        case 'imageUnits1':
            p.integers['34930'] = [1];
            break;
        case 'noGenBuffers':
            p.missingEntryPoints = ['glGenBuffersARB'];
            break;
        case 'radeon7500':
            p.strings['7937'] = 'ATI RADEON 7500 DDR x86/SSE2';
            break;
        case 'radeon9250':
            p.strings['7937'] = 'RADEON 9250/9200 Series DDR x86/SSE2';
            break;
        case 'radeonX1950':
            p.strings['7937'] = 'ATI Radeon X1950 Pro';
            break;
        case 'radeon9600':
            p.strings['7937'] = 'Radeon 9600 XT/AGP';
            break;
        case 'radeonWord':
            p.strings['7937'] = 'RADEON7000 SERIES';
            break;
        case 'everything':
            p.strings['7936'] = 'Mesa Project';
            p.strings['7938'] = '1.1.0';
            without('GL_ARB_multitexture');
            without('GL_ARB_texture_env_combine');
            p.integers['34018'] = [1];
            break;
        case 'pointsMax1024':
            p.floats = { ...p.floats, '33063': ['44800000'] };
            break;
        case 'pointsMaxAbove1024':
            p.floats = { ...p.floats, '33063': ['44800001'] };
            break;
        case 'pointsMax64':
            p.floats = { ...p.floats, '33063': ['42800000'] };
            break;
        case 'noPointParameters':
            without('GL_ARB_point_parameters');
            break;
        case 'noPointSprite':
            without('GL_ARB_point_parameters');
            without('GL_ARB_point_sprite');
            break;
        default:
            throw new Error('profile ' + name);
    }
    return p;
}

function lines(text: string): string[] {
    return text.replace(/\r\n/g, '\n').trimEnd().split('\n');
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
        } else if (!line.startsWith('#') && line.length > 0) {
            records.push({ line, stack: null });
        }
    }
    return records;
}

// "<frame>.<seq>\t<entry>..." without the sequence number.
function unsequenced(line: string): string {
    const tab = line.indexOf('\t');
    return line.slice(0, line.indexOf('.')) + line.slice(tab);
}

function renumber(stream: string[]): string[] {
    const ids = new Map<string, number>();
    const counts = new Map<string, number>();
    return stream.map(line =>
        line.replace(/#([TBLP])(\d+)/g, (_, kind: string, id: string) => {
            const key = kind + id;
            let mapped = ids.get(key);
            if (mapped === undefined) {
                mapped = (counts.get(kind) ?? 0) + 1;
                counts.set(kind, mapped);
                ids.set(key, mapped);
            }
            return '#' + kind + mapped;
        })
    );
}

const MARKED_CALLEES = new Set(['te.e', 'mk.e', 'jf.e']);
// The classes of this unit: tf GlRenderer, fa GlCleaner, vi GlBuffer, sd GlSolidTexture, and ga for the relocated
// static ga.a()V that GlRenderer.initPointParameters ports.
const UNIT_CLASSES = new Set(['tf', 'fa', 'vi', 'sd', 'ga']);
// The classes still stubbed in the integrated runs: mk GlLighting (mk.e) and jf PointLightManager (jf.e).
const STUBBED_CLASSES = new Set(['mk', 'jf']);

// The integrated runs keep every record of the init run (tf, te.e and everything under it: lm, vm, rd, wg, pd, ob, ue)
// except the runs of calls from mk.e and jf.e, which become one `~call` line each, as the TS stubs mark them. A record
// belongs to such a run when a frame of its stack is in mk or jf; those methods sit 3-4 frames under the oracle, so the
// 8-frame stack always shows the outermost one, and the run is keyed by that method and its caller's frame (the
// outermost frame's own bytecode index moves from call to call inside the run).
function integratedJavaStream(text: string): string[] {
    const stream: string[] = [];
    let run: string | null = null;
    for (const record of parseTrace(text)) {
        const entry = record.line.split('\t')[1];
        if (entry === '~gl') continue;
        const frames = (record.stack ?? '').split(' < ');
        const outer = frames.findLastIndex(frame => STUBBED_CLASSES.has(frame.split('.')[0]));
        if (entry === '~mark' || outer < 0) {
            stream.push(unsequenced(record.line));
            run = null;
            continue;
        }
        const callee = frames[outer].split(' ')[0];
        const key = callee + ' < ' + (frames[outer + 1] ?? '');
        if (key !== run) {
            run = key;
            stream.push('~call\t' + callee);
        }
    }
    return renumber(stream);
}

function javaStream(text: string): string[] {
    const stream: string[] = [];
    let run: string | null = null;
    for (const record of parseTrace(text)) {
        const entry = record.line.split('\t')[1];
        if (entry === '~gl') continue;
        if (entry === '~mark') {
            stream.push(unsequenced(record.line));
            run = null;
            continue;
        }
        const frames = (record.stack ?? '').split(' < ');
        const oracle = frames.findIndex(frame => frame.startsWith('HdRendererOracle'));
        if (oracle < 0) continue; // a truncated stack: deep inside a callee's run
        let innermost = oracle;
        while (innermost > 0 && UNIT_CLASSES.has(frames[innermost - 1].split('.')[0])) innermost--;
        if (innermost === 0 && innermost < oracle) {
            stream.push(unsequenced(record.line));
            run = null;
            continue;
        }
        if (innermost === oracle) continue; // not issued under tf
        const callee = frames[innermost - 1].split(' ')[0];
        const key = callee + '|' + frames.slice(innermost).join(' < ');
        if (key !== run) {
            run = key;
            if (MARKED_CALLEES.has(callee)) stream.push('~call\t' + callee);
        }
    }
    return renumber(stream);
}

function tsStream(text: string): string[] {
    const stream: string[] = [];
    for (const record of parseTrace(text)) {
        const fields = record.line.split('\t');
        if (fields[1] === '~gl') continue;
        if (fields[1] === '~mark' && fields[2].startsWith('call.')) {
            stream.push('~call\t' + fields[2].slice(5));
            continue;
        }
        stream.push(unsequenced(record.line));
    }
    return renumber(stream);
}

async function runOne(run: Run, classpath: string): Promise<void> {
    const base = join(dir, run.name.replace(/ /g, '-'));
    const profilePath = join(dir, 'profile-' + run.profile + '.json');
    const javaDir = base + '-java';
    const tsDir = base + '-ts';
    const integrated = run.scenario === 'integrated';
    const java = Bun.spawn(['java', '-Djava.awt.headless=true', '-cp', classpath, 'HdRendererOracle', javaDir, profilePath, String(run.samples), integrated ? 'init' : run.scenario], { stdout: 'pipe', stderr: 'pipe' });
    const ts = Bun.spawn(['bun', 'run', join(import.meta.dir, 'glRendererHarness.ts'), tsDir, profilePath, String(run.samples), run.scenario], { stdout: 'pipe', stderr: 'pipe' });
    const [javaOut, javaErr, tsErr] = await Promise.all([new Response(java.stdout).text(), new Response(java.stderr).text(), new Response(ts.stderr).text()]);
    const [javaExit, tsExit] = await Promise.all([java.exited, ts.exited]);
    if (javaExit !== 0) throw new Error(run.name + ': HdRendererOracle exited ' + javaExit + '\n' + javaOut + javaErr);
    if (tsExit !== 0) throw new Error(run.name + ': glRendererHarness exited ' + tsExit + '\n' + tsErr);
    const tsOut = lines(readFileSync(join(tsDir, 'stdout.txt'), 'utf8'));
    results.set(run.name, {
        java: lines(javaOut),
        ts: tsOut.filter(line => !line.startsWith('C ')),
        javaTrace: (integrated ? integratedJavaStream : javaStream)(readFileSync(join(javaDir, 'trace.tsv'), 'utf8')),
        tsTrace: tsStream(readFileSync(join(tsDir, 'trace.tsv'), 'utf8')),
        callees: tsOut.filter(line => line.startsWith('C ') || line.startsWith('status '))
    });
}

beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'rs530-gl-renderer-'));
    const classpath = [dir, hdGamepackPath, joglPath].join(delimiter);
    const sources = ['GlRecorder.java', 'HdRendererOracle.java'].map(name => join(import.meta.dir, name));
    const build = Bun.spawnSync(['javac', '-encoding', 'UTF-8', '-cp', classpath, '-d', dir, ...sources]);
    if (build.exitCode !== 0) throw new Error(build.stderr.toString());
    const captured = JSON.parse(readFileSync(join(import.meta.dir, 'rtx5070.json'), 'utf8')) as Profile;
    for (const name of ['full', 'noVbo', 'no3d', ...failures, ...pointProfiles]) writeFileSync(join(dir, 'profile-' + name + '.json'), JSON.stringify(variant(captured, name)));
    writeFileSync(join(dir, 'profile-radeon.json'), capsProfileToJson(RADEON_CAPS_PROFILE));
    const queue = [...runs];
    await Promise.all(
        Array.from({ length: 6 }, async () => {
            for (let run = queue.shift(); run !== undefined; run = queue.shift()) {
                try {
                    await runOne(run, classpath);
                } catch (error) {
                    runErrors.set(run.name, String(error));
                }
            }
        })
    );
}, 600000);

afterAll(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
});

function result(name: string): Result {
    const r = results.get(name);
    if (r === undefined) throw new Error(runErrors.get(name) ?? 'no result for ' + name);
    return r;
}

const INIT_CALLEES = ['C PointLightManager.allocate', 'C MaterialManager.createMaterials 6', 'C MaterialManager.resetMaterial', 'C GlLighting.init', 'C PointLightManager.init'];
const SHUTDOWN_CALLEES = ['C MaterialManager.releaseMaterials', 'C PointLightManager.release'];
// With the real MaterialManager only the GlLighting and PointLightManager stubs print.
const INTEGRATED_CALLEES = ['C PointLightManager.allocate', 'C GlLighting.init', 'C PointLightManager.init'];

for (const run of runs) {
    test(run.name + ': tf statics, status and tf-issued GL calls match the original', () => {
        const r = result(run.name);
        expect(r.ts).toEqual(r.java);
        expect(r.tsTrace).toEqual(r.javaTrace);
        if (run.scenario === 'init') {
            const status = r.callees.filter(line => line.startsWith('status ')).at(-1);
            // The undisplayable canvas returns -1 before any call; a failed probe shuts down (nj.a, jf.c).
            expect(r.callees).toEqual(['status -1', ...(status === 'status 0' ? INIT_CALLEES : SHUTDOWN_CALLEES), status ?? '']);
        }
        if (run.scenario === 'integrated') expect(r.callees).toEqual(['status -1', ...INTEGRATED_CALLEES, 'status 0']);
    });
}

test('sanity: the integrated runs compare te.e(6) in full and collapse only mk.e and jf.e', () => {
    for (const profile of ['full', 'noVbo', 'no3d', 'radeon']) {
        const trace = result('integrated ' + profile + ' 0').javaTrace;
        const count = (entry: string) => trace.filter(line => line.split('\t')[1] === entry).length;
        expect(trace.filter(line => line.startsWith('~call'))).toEqual(['~call\tmk.e', '~call\tjf.e']);
        // the materials' 10 display lists, and lm's noise uploads (two 3D volumes, or 64 LUMINANCE_ALPHA 2D slices each)
        expect([count('glNewList'), count('glEndList')]).toEqual([10, 10]);
        const slices = trace.filter(line => line.split('\t').slice(1, 6).join(' ') === 'glTexImage2D 3553 0 6410 64').length;
        expect([count('glTexImage3D'), slices]).toEqual(profile === 'no3d' ? [0, 128] : [2, 0]);
        expect(trace.length).toBeGreaterThan(result('init ' + profile + ' 0').javaTrace.length + 200);
    }
});

test('sanity: ga.a()V takes both extension branches and the 1024 clamp', () => {
    const sizes = (name: string) =>
        result('points ' + name)
            .javaTrace.filter(line => line.split('\t')[1] === 'glPointParameterfARB')
            .map(line => line.split('\t').slice(2).join(' '));
    // two ga.a() calls, each GL_POINT_SIZE_MIN 1.0 then GL_POINT_SIZE_MAX min(max, 1024)
    const pair = (bits: string) => ['33062 f:3f800000', '33063 f:' + bits];
    expect(sizes('full')).toEqual([...pair('44800000'), ...pair('44800000')]);
    expect(sizes('pointsMax1024')).toEqual([...pair('44800000'), ...pair('44800000')]);
    expect(sizes('pointsMaxAbove1024')).toEqual([...pair('44800000'), ...pair('44800000')]);
    expect(sizes('pointsMax64')).toEqual([...pair('42800000'), ...pair('42800000')]);
    expect(sizes('noPointParameters')).toEqual([]);
    const checks = (name: string) =>
        result('points ' + name)
            .javaTrace.filter(line => line.split('\t')[1] === 'isExtensionAvailable')
            .slice(-4)
            .map(line =>
                line
                    .split('\t')
                    .slice(2)
                    .join(' ')
                    .replace(/^S:\d+:[0-9a-f]+:/, '')
            );
    expect(checks('noPointSprite')).toEqual(['GL_ARB_point_parameters => F', 'GL_ARB_point_sprite => F', 'GL_ARB_point_parameters => F', 'GL_ARB_point_sprite => F']);
});

test('sanity: the init gate covers success, every probe failure bit, -4 and the Radeon model rules', () => {
    const status = (name: string) =>
        result(name)
            .java.filter(line => line.startsWith('status '))
            .at(-1);
    expect(['full', 'noVbo', 'no3d', 'radeon'].map(p => status('init ' + p + ' 0'))).toEqual(['status 0', 'status 0', 'status 0', 'status 0']);
    expect(failures.map(name => status('probe ' + name))).toEqual([
        'status 1',
        'status 1',
        'status 1',
        'status 2',
        'status 6',
        'status 2',
        'status 0',
        'status 8',
        'status 32',
        'status 16',
        'status 16',
        'status 16',
        'status -4',
        'status 0',
        'status 0',
        'status 0',
        'status 0',
        'status 0',
        'status 59'
    ]);
    expect(['mc0', 'mcThrow2', 'mcError', 'swapFail', 'swap2', 'createThrows', 'nullCanvas'].map(s => status('platform ' + s))).toEqual(['status -2', 'status 0', 'status -5', 'status -3', 'status 0', 'status -5', 'status -5']);
    // tf.C / tf.r / tf.G after the Radeon model rules (7000..7999 drops VBOs, 7000..9250 drops 3D textures).
    const caps = (name: string) => {
        const dump =
            result(name)
                .java.filter(line => line.startsWith('dump '))
                .at(-1) ?? '';
        return ['C', 'r', 'G'].map(f => new RegExp(' ' + f + '=([TF])').exec(dump)?.[1]).join('');
    };
    expect(['radeon7500', 'radeon9250', 'radeonX1950', 'radeon9600', 'radeonWord'].map(n => caps('probe ' + n))).toEqual(['FFF', 'TFT', 'TTT', 'TTT', 'TTT']);
    // The filtered streams are not trivially short: the init keeps tf.m/tf.s/tf.f and the three callee runs, the ops run
    // every setter, projection and clear.
    const init = result('init full 0').javaTrace;
    expect(init.filter(line => line.startsWith('~call'))).toEqual(['~call	te.e', '~call	mk.e', '~call	jf.e']);
    expect(init.length).toBeGreaterThan(60);
    const ops = result('ops full 0').javaTrace;
    for (const entry of ['glLoadMatrixf', 'glOrtho', 'glCopyPixels', 'glRotatef', 'glTexEnvi', 'glClearColor', 'GLDrawable.swapBuffers', 'GLContext.destroy']) expect(ops.some(line => line.split('	')[1] === entry)).toBe(true);
    expect(ops.length).toBeGreaterThan(300);
    // The objects run: fa's 1000-name batches (1003 VBOs; 999 2D textures carried into the texture queue), the
    // per-list deletes, vi's sub-data/re-upload choice and sd's 1x1 uploads.
    const objects = result('objects GlCleaner GlBuffer GlSolidTexture').javaTrace;
    const count = (entry: string) => objects.filter(line => line.split('\t')[1] === entry).length;
    expect([count('glDeleteBuffersARB'), count('glDeleteTextures'), count('glDeleteLists'), count('glBufferSubDataARB'), count('glBufferDataARB'), count('glTexImage2D')]).toEqual([4, 4, 3, 3, 5, 3]);
});

test('the TS scripted platform with no registered factory fails like an unsupported os.name (-5, nothing left set)', async () => {
    const out = mkdtempSync(join(tmpdir(), 'rs530-gl-renderer-nf-'));
    try {
        const profilePath = join(dir, 'profile-full.json');
        const ts = Bun.spawnSync(['bun', 'run', join(import.meta.dir, 'glRendererHarness.ts'), out, profilePath, '0', 'nullFactory']);
        expect(ts.exitCode, ts.stderr.toString()).toBe(0);
        const outLines = lines(readFileSync(join(out, 'stdout.txt'), 'utf8'));
        expect(outLines.filter(line => line.startsWith('status ') || line.startsWith('current ') || line.startsWith('L '))).toEqual(['status -5', 'current null']);
        expect(outLines.at(-1)).toBe(outLines[0]);
    } finally {
        rmSync(out, { recursive: true, force: true });
    }
});

test('collected GlBuffer and GlSolidTexture objects are queued through their FinalizationRegistry and flushed (TS only)', () => {
    const out = mkdtempSync(join(tmpdir(), 'rs530-gl-renderer-fr-'));
    try {
        const ts = Bun.spawnSync(['bun', 'run', join(import.meta.dir, 'glRendererHarness.ts'), out, join(dir, 'profile-full.json'), '0', 'registry']);
        expect(ts.exitCode, ts.stderr.toString()).toBe(0);
        const outLines = lines(readFileSync(join(out, 'stdout.txt'), 'utf8'));
        expect(outLines.filter(line => line.startsWith('registry '))).toEqual(['registry before 320 80', 'registry after 0 0']);
        const deleted = (entry: string) =>
            tsStream(readFileSync(join(out, 'trace.tsv'), 'utf8'))
                .filter(line => line.split('\t')[1] === entry)
                .reduce((sum, line) => sum + Number(line.split('\t')[2]), 0);
        expect([deleted('glDeleteBuffersARB'), deleted('glDeleteTextures')]).toEqual([20, 20]);
    } finally {
        rmSync(out, { recursive: true, force: true });
    }
}, 30000);
