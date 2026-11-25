import { afterAll, beforeAll, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { capsProfileToJson, RADEON_CAPS_PROFILE } from '#/gl/CapsProfile.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

// Comparison points for the H1 renderer. SHA-256 covers every GLTrace record in order,
// including its frame and sequence numbers and a final LF. Header and source comments are omitted.
export const hdInitTraceDigests = {
    full: ['1311d0d4c0e9565be0ad17d0ae657daef9c4eccf34b04c50109ff188f80259aa', '7a5ba7abcc0ab45d22b8ad82d321483ea650e719b954447d1df356c46dc36057', '8b3afa09d127c785d8f37b565cb82db5fd3a4abf5770076b450e1410f98a9c1e'],
    noVbo: ['6e3ee68c485e28ab6db7478785f945a2f455e30f9540e07844163034b403f206', 'a5946c530dc92f20bb44b35687b0070817d8742d14402038102bf767de9355f6', 'f768055a3fcea7ba2132cb403e30febe12fe82ef63c6419b6d364b9718a3fc08'],
    no3d: ['d9bd9c31f68fd4e6e060ef2ed55396c7e05376b5d0e3b1d5fa3fd13972b4ab1c', '65dc899ae4f1dc6b525d02bffc9cefa8021ab61410cac8dc549d3a71a8cf102e', '6d680c59fd4429704644f0d0fde1f5da745dfb0edc8c74db6321104a4c87baec'],
    radeon: ['cb594dc3836e722be97ae3bf96120a045eca8bbe9aa05601e68a8a4f5bdfee78', '03513185fec5cd57d878b3097070ba3cfeb9d119b945b838ae9bd1295e7960e6', 'c0225db644a2fc24cca64478dc513c92665655c2d568a0fab3001e18706e00c0']
} as const;

const volumes = ['4d1dae62ac78cf787eaca55032a0261e8720e1c7f34918661a2b1ae8958834f1', '232b74823805094c373dab9e8e342924bcb2ad278b1d1011568e30535b7615d4'];
const extensions = { full: null, noVbo: 'GL_ARB_vertex_buffer_object', no3d: 'GL_EXT_texture3D' } as const;
const sha = (data: Uint8Array | string) => createHash('sha256').update(data).digest('hex');
let dir: string, classpath: string;

beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'rs530-hd-context-'));
    classpath = [dir, hdGamepackPath, joglPath].join(delimiter);
    const sources = ['GlRecorder.java', 'HdInitOracle.java'].map(name => join(import.meta.dir, name));
    const build = Bun.spawnSync(['javac', '-encoding', 'UTF-8', '-cp', classpath, '-d', dir, ...sources]);
    expect(build.exitCode, build.stderr.toString()).toBe(0);
    const captured = readFileSync(join(import.meta.dir, 'rtx5070.json'), 'utf8');
    for (const [name, extension] of Object.entries(extensions)) {
        const profile = JSON.parse(captured);
        if (extension !== null) {
            const tokens = (profile.strings[7939] as string).split(' ');
            expect(tokens).toContain(extension);
            profile.strings[7939] = tokens.filter(x => x !== extension).join(' ');
        }
        writeFileSync(join(dir, name + '.json'), JSON.stringify(profile));
    }
    writeFileSync(join(dir, 'radeon.json'), capsProfileToJson(RADEON_CAPS_PROFILE));
});

afterAll(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
});

function checkNoise(rows: string[][], path: string, texture3d: boolean): void {
    const uploads = rows.filter(row => (texture3d ? row[1] === 'glTexImage3D' : row[1] === 'glTexImage2D' && row[2] === '3553' && row[4] === '6410' && row[5] === '64'));
    const slices = texture3d ? 1 : 64;
    expect(uploads).toHaveLength(2 * slices);
    for (const [volume, expected] of volumes.entries()) {
        const hash = createHash('sha256');
        for (let z = 0; z < slices; z++) {
            const row = uploads[volume * slices + z];
            expect(row.slice(2, -1)).toEqual(texture3d ? ['32879', '0', '6410', '64', '64', '64', '0', '6410', '5121'] : ['3553', '0', '6410', '64', '64', '0', '6410', '5121']);
            const [kind, type, position, limit, capacity, storage, digest] = requireNonNull(row.at(-1)).split(':');
            expect([kind, type, position, limit, capacity, storage]).toEqual(['B', 'byte', String(z * 8192), '524288', '524288', 'direct']);
            const blob = readFileSync(join(path, 'blobs', digest));
            expect(sha(blob)).toBe(digest);
            expect(blob.length).toBe(524288 - z * 8192);
            // lm leaves the limit at the volume end. A 64×64 LA slice consumes only 8192 bytes.
            hash.update(texture3d ? blob : blob.subarray(0, 8192));
        }
        expect(hash.digest('hex')).toBe(expected);
    }
}

// td.a(ZZZZZ) writes (u,v) per vertex through wa. Its second upload changes u[0] and v[1].
const uvData = [
    [0.25, -0.5, -2, 1],
    [1.5, -0.5, -2, -4]
].map(values => {
    const bytes = Buffer.alloc(16);
    values.forEach((value, i) => bytes.writeFloatLE(value, i * 4));
    return bytes;
});

function checkModel(lines: string[], path: string, streamVbo: boolean): void {
    const marker = '1.1\t~mark\tdynamic-model';
    if (!streamVbo) {
        expect(lines).toEqual([marker]);
        return;
    }
    const tokens = uvData.map(bytes => {
        const hash = sha(bytes);
        expect(readFileSync(join(path, 'blobs', hash))).toEqual(bytes);
        return 'B:byte:0:16:10000:heap:' + hash + ':' + bytes.toString('hex');
    });
    expect(lines).toEqual([
        marker,
        '1.2\tglGenBuffersARB\t1\tiv:#B2\t0',
        '1.3\tglBindBufferARB\t34962\t#B2',
        '1.4\tglBufferDataARB\t34962\t16\t' + tokens[0] + '\t35040',
        '1.5\tglBindBufferARB\t34962\t#B2',
        '1.6\tglBufferSubDataARB\t34962\t0\t16\t' + tokens[1]
    ]);
}

for (const profile of ['full', 'noVbo', 'no3d', 'radeon'] as const) {
    for (const [i, samples] of [0, 2, 4].entries()) {
        test(
            'original tf.a initializes ' + profile + ' context at ' + samples + ' samples and presents its cleared frame',
            () => {
                const traceDir = join(dir, profile + '-' + samples);
                const run = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', classpath, 'HdInitOracle', traceDir, join(dir, profile + '.json'), String(samples), 'model'], { timeout: 20000 });
                expect(run.exitCode, run.stdout.toString() + run.stderr.toString()).toBe(0);
                expect(run.stdout.toString().trim().split(/\r?\n/)).toEqual([
                    'status 0',
                    'context true true true true 871 613',
                    'caps ' + (profile !== 'noVbo') + ' ' + (profile !== 'no3d') + ' true true true 4 ' + (profile === 'radeon'),
                    'materials - vm rd wg pd ob ue',
                    'noise ' + volumes.join(' '),
                    ...(profile === 'radeon' ? [] : uvData.map(bytes => 'client UV ' + bytes.toString('hex')))
                ]);
                const trace = readFileSync(join(traceDir, 'trace.tsv'), 'utf8').trimEnd().split(/\r?\n/);
                expect(trace[0]).toBe('#GLTrace v1');
                const records = trace.filter(line => !line.startsWith('#'));
                const mark = records.indexOf('1.1\t~mark\tdynamic-model');
                expect(mark).toBeGreaterThan(0);
                checkModel(records.slice(mark), traceDir, profile === 'radeon');
                const lines = records.slice(0, mark);
                expect(sha(lines.join('\n') + '\n')).toBe(hdInitTraceDigests[profile][i]);
                const rows = lines.map(line => line.split('\t'));
                expect(rows).toHaveLength(profile === 'no3d' ? 833 : profile === 'noVbo' ? 370 : 371);
                expect(rows[0]).toEqual(['0.0', 'GLDrawableFactory.getGLDrawable', '@F1', '@O1', 'K:T:F:T:24:0:8:8:8:0:0:0:0:0:' + (samples ? 'T:' + samples : 'F:2'), 'null', '=> @D1']);
                expect(rows.slice(1, 5).map(row => row.slice(1))).toEqual([
                    ['GLDrawable.setRealized', '@D1', 'T'],
                    ['GLDrawable.createContext', '@D1', 'null', '=> @C1'],
                    ['GLContext.makeCurrent', '@C1', '=> 2'],
                    ['GLContext.getGL', '@C1', '=> @G1']
                ]);
                expect(rows.filter(row => row[1] === 'glGenBuffersARB')).toHaveLength(profile === 'noVbo' ? 0 : 1);
                expect(rows.filter(row => row[1] === 'glNewList').map(row => row[2])).toEqual(Array.from({ length: 10 }, (_, n) => '#L' + (n + 1)));
                expect(rows.filter(row => row[1] === 'glEndList')).toHaveLength(10);
                expect(rows.filter(row => row[1] === 'GLDrawable.swapBuffers')).toHaveLength(1);
                expect(rows.slice(-3).map(row => row.slice(1))).toEqual([
                    ['glClear', '16384'],
                    ['GLDrawable.swapBuffers', '@D1'],
                    ['glClear', '16384']
                ]);
                expect(requireNonNull(rows.at(-1))[0]).toBe('1.0');
                expect(rows.filter(row => row[1] === 'glTexImage3D')).toHaveLength(profile === 'no3d' ? 0 : 2);
                checkNoise(rows, traceDir, profile !== 'no3d');
            },
            30000
        );
    }
}
