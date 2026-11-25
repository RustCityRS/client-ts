import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { hdGamepackPath, joglPath } from './hd-reference.js';

const sourceSha = '05b4a0e72fd47dddd64ec397b735a871b1510d8c0cd0693189495d18f6a553ce';
// SHA-256 of all 65,536 raw IEEE-754 words in little-endian order. tf.f chooses
// the endian float writer in rd.<init>. Both paths are exercised on this host.
const tables = ['307460648dd4a18d05b706af682bb54e78de8db6656bef894d94971b27af06f1', '20cb151aa1705c2e25c1a830dd97a6684006a841a8563ee8828bc08c6fa29926'];
const hash = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const one = '3f800000',
    zero = '00000000',
    zeros = [zero, zero, zero, zero].join('.');
const fog = ['3ec00000', 'bf000000', '3fa00000', '80000000'].join('.');
const bits = (x: number) => {
    const b = Buffer.alloc(4);
    b.writeFloatBE(x);
    return b.toString('hex');
};
const v4 = (slot: number, x: string, y: string, z: string, w: string) => 'glProgramLocalParameter4fARB(34336,' + [slot, x, y, z, w].join(',') + ')';
const tex = (field: number, value: number) => 'glTexEnvi(8960,' + field + ',' + value + ')';
function compileCommands(src: string, is3D: boolean, program: number, list: number) {
    return [
        'glGenProgramsARB(1,[0],0)',
        'glGenLists(2)',
        'glNewList(' + list + ',4864)',
        'glActiveTexture(33985)',
        ...(is3D ? ['glBindTexture(32879,9401)'] : []),
        tex(34161, 260),
        tex(34162, 7681),
        tex(34184, 34168),
        'glActiveTexture(33984)',
        'glBindProgramARB(34336,' + program + ')',
        'glEnable(34336)',
        'glEndList()',
        'glNewList(' + ((list + 1) | 0) + ',4864)',
        'glActiveTexture(33985)',
        'glMatrixMode(5890)',
        'glLoadIdentity()',
        'glMatrixMode(5888)',
        tex(34161, 8448),
        tex(34162, 8448),
        tex(34184, 5890),
        'glDisable(' + (is3D ? 32879 : 3553) + ')',
        'glActiveTexture(33984)',
        'glBindProgramARB(34336,0)',
        'glDisable(34336)',
        'glDisable(34820)',
        'glEndList()',
        ...(list >= 0 ? ['glBindProgramARB(34336,' + program + ')', 'glProgramStringARB(34336,34933,1736,' + src + ')', 'glGetIntegerv(34379,[0],0)'] : [])
    ];
}
interface Result {
    result: string;
    state: string;
    calls: string[];
}
type Check = (r: Result) => void;

test('HD ARB vertex assembly, texture combiner lists and every noise-register upload match the shipped JOGL program', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rs530-hd-program-')),
        jars = hdGamepackPath + delimiter + joglPath,
        cp = dir + delimiter + jars;
    try {
        const exports = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED', '--add-exports', 'java.base/jdk.internal.org.objectweb.asm.tree=ALL-UNNAMED'];
        const javac = Bun.spawnSync(['javac', join(import.meta.dir, '../hd/GlRecorder.java'), ...exports, '-cp', jars, '-d', dir, ...['HdProgramOracle', 'HdJoglInventory'].map(n => join(import.meta.dir, n + '.java'))]);
        expect(javac.exitCode, javac.stderr.toString()).toBe(0);
        const inventory = Bun.spawnSync(['java', ...exports, '-cp', cp, 'HdJoglInventory', hdGamepackPath, joglPath], { maxBuffer: 8 * 1024 * 1024 });
        expect(inventory.exitCode, inventory.stderr.toString()).toBe(0);
        const lines = inventory.stdout
            .toString()
            .trimEnd()
            .split(/\r?\n/)
            .map(l => l.split('\t'));
        const embedded = lines.filter(l => l[0] === 'assembly');
        expect(embedded.map(l => l[1])).toEqual(['rd.f()V', 'rd.f()V']);
        const src = embedded[0][3],
            source = Buffer.from(src, 'base64');
        expect(embedded[1][3]).toBe(src);
        expect(source.length).toBe(1736);
        expect(hash(source)).toBe(sourceSha);
        // GL_VERTEX_PROGRAM_ARB consumes these conventional attributes/matrices;
        // it has no GLSL attribute locations, sampler lookups or uniform handles.
        expect(
            source
                .toString('ascii')
                .split('\n')
                .filter(l => l.startsWith('ATTRIB') || l.startsWith('PARAM'))
                .map(l => l.trim().replace(/\s+/g, ' '))
        ).toEqual([
            'ATTRIB iPos = vertex.position;',
            'ATTRIB iColour = vertex.color;',
            'PARAM time = program.local[65];',
            'PARAM turbulence = program.local[64];',
            'PARAM lightAmbient = program.local[66];',
            'PARAM pMatrix[4] = { state.matrix.projection };',
            'PARAM mvMatrix[4] = { state.matrix.modelview };',
            'PARAM ivMatrix[4] = { state.matrix.texture[1] };',
            'PARAM fNoise[64] = { program.local[0..63] };'
        ]);
        const sites = lines.filter(l => l[0] === 'call' && l[4] === 'javax/media/opengl/GL');
        expect(sites.filter(l => l[5] === 'glProgramStringARB').map(l => l[1])).toEqual(['rd.f()V']);
        expect(sites.filter(l => /Shader|Uniform|VertexAttrib|BindAttrib|CreateProgram|LinkProgram|UseProgram/.test(l[5]))).toEqual([]);
        const script: string[] = [],
            checks: Check[] = [];
        function add(command: string, check: Check) {
            script.push(command);
            checks.push(check);
        }
        function exact(result: string, state: string, calls: string[]): Check {
            return r => {
                expect(r.result).toBe(result);
                expect(r.state).toBe(state);
                expect(r.calls).toEqual(calls);
            };
        }
        let state = '-1,0,-1,0,-',
            fogBefore = zeros;
        for (const [flags, units] of [
            [0, 4],
            [1, 1],
            [1, 0],
            [1, -1]
        ]) {
            add('new ' + flags + ' 0 ' + units + ' 73 901 -1', exact('ok', state, []));
            for (const op of ['flags 194', 'bind 17', 'end 0']) add(op + ' 0', exact('ok', state, []));
        }
        const entireTable = [createHash('sha256'), createHash('sha256')];
        for (const [flags, list, program, error, full] of [
            [3, 901, 73, -1, 1],
            [5, 229, 0, 197, 1],
            [1, 0, -17, 0, 0],
            [1, -1, 73, -1, 0]
        ]) {
            const is3D = !!(flags & 2),
                endianness = flags >> 2,
                fullHash = tables[endianness];
            const display = compileCommands(src, is3D, program, list);
            const prev = state;
            // Stop on every list/assembly upload boundary. Failed constructors do
            // not replace the last returned instance, even after successful GL writes.
            for (let fault = 1; fault <= display.length; fault++) add('new ' + [flags, fault, 3, program, list, error].join(' '), exact('fault', prev, display.slice(0, fault)));
            let last = -1,
                pos = 0;
            function fields() {
                return [last, program, list, 0, pos + ':' + fullHash].join(',');
            }
            state = fields();
            add('new ' + [flags, 0, 3, program, list, error].join(' '), exact('ok', state, display));
            if (list < 0) {
                add('bind 1 0', exact('ok', state, []));
                continue;
            }
            if (is3D) {
                // cb.b sends material 4 to slot 2 with parameter 2 when rm.g is
                // false. Same mode and parameter suppress all repeated work.
                const routed = [
                    'glCallList(' + list + ')',
                    'glActiveTexture(33985)',
                    'glMatrixMode(5890)',
                    'glTranslatef(42140000,c3000000,42b80000)',
                    'glRotatef(c2b40000,00000000,3f800000,00000000)',
                    'glRotatef(c2340000,3f800000,00000000,00000000)',
                    'glRotatef(c3340000,3f800000,00000000,00000000)',
                    'glMatrixMode(5888)',
                    'glActiveTexture(33984)',
                    'glActiveTexture(33985)',
                    'glEnable(32879)',
                    'glActiveTexture(33984)',
                    'glGetFloatv(2899,[' + fogBefore + '],0)',
                    'glProgramLocalParameter4fvARB(34336,66,[' + fog + '],0)',
                    v4(64, bits(0.05), one, one, one)
                ];
                add('route 193 0 4', exact('ok', state, routed));
                fogBefore = fog;
                add('route 193 0 4', exact('ok', state, []));
                add('route 194 0 2', exact('ok', state, ['glActiveTexture(33985)', 'glDisable(32879)', 'glActiveTexture(33984)', v4(66, one, one, one, one), v4(64, bits(0.05), one, one, one)]));
                add('route 0 0 0', exact('ok', state, ['glCallList(' + ((list + 1) | 0) + ')']));
            }
            for (let code = 0; code < 256; code++) {
                const calls = ['glActiveTexture(33985)', 'gl' + (code & 128 ? 'Disable' : 'Enable') + '(' + (is3D ? 32879 : 3553) + ')', 'glActiveTexture(33984)'];
                if (code & 64) calls.push(v4(66, one, one, one, one));
                else {
                    calls.push('glGetFloatv(2899,[' + fogBefore + '],0)', 'glProgramLocalParameter4fvARB(34336,66,[' + fog + '],0)');
                    fogBefore = fog;
                }
                calls.push(v4(64, bits((code & 3) === 2 ? 0.05 : (code & 3) === 3 ? 0.1 : 0.025), one, one, one));
                add('flags ' + code + ' 0', exact('ok', state, calls));
            }
            for (const tick of full ? [...Array.from({ length: 256 }, (_, i) => i), 255, 256, 2147483647] : [1, 1]) {
                const advance = tick !== last,
                    base = (tick & 255) * 256,
                    texFrame = (Math.fround(Math.imul(tick, 64) * Math.fround(0.005)) | 0) % 64;
                const head = [
                    'glCallList(' + list + ')',
                    'glActiveTexture(33985)',
                    'glMatrixMode(5890)',
                    'glTranslatef(42140000,c3000000,42b80000)',
                    'glRotatef(c2b40000,00000000,3f800000,00000000)',
                    'glRotatef(c2340000,3f800000,00000000,00000000)',
                    'glRotatef(c3340000,3f800000,00000000,00000000)',
                    'glMatrixMode(5888)'
                ];
                if (!is3D && texFrame < 0) {
                    add('bind ' + tick + ' 0', exact('bounds', state, head));
                    continue;
                }
                if (!is3D) head.push('glBindTexture(3553,' + (8100 + texFrame) + ')');
                head.push('glActiveTexture(33984)');
                if (advance) {
                    last = tick;
                    pos = base + 252;
                }
                state = fields();
                const expectedState = state;
                add('bind ' + tick + ' 0', r => {
                    expect(r.result).toBe('ok');
                    expect(r.state).toBe(expectedState);
                    expect(r.calls.slice(0, head.length)).toEqual(head);
                    const vectors = r.calls.slice(head.length);
                    expect(vectors.length).toBe(advance ? 65 : 0);
                    if (!advance) return;
                    const values = Buffer.alloc(1024);
                    for (let i = 0; i < 64; i++) {
                        const prefix = 'glProgramLocalParameter4fvARB(34336,' + i + ',B' + (base + 4 * i) + ':65536:true:true[';
                        if (!vectors[i].startsWith(prefix) || !vectors[i].endsWith('])')) throw Error('Unexpected ARB register binding ' + vectors[i]);
                        const components = vectors[i].slice(prefix.length, -2).split('.');
                        expect(components).toHaveLength(4);
                        for (let j = 0; j < 4; j++) values.writeUInt32LE(parseInt(components[j], 16), i * 16 + j * 4);
                    }
                    if (full && tick >= 0 && tick < 256) entireTable[endianness].update(values);
                    expect(vectors[64]).toBe(v4(65, is3D ? bits(Math.fround(tick) * Math.fround(0.005)) : zero, zero, zero, one));
                });
            }
            add('end 0 0', exact('ok', state, ['glCallList(' + ((list + 1) | 0) + ')']));
        }
        // These ordinary texture modes have no ARB source or program bind.
        const rgb = [8448, 7681, 260, 34023, 34164, 34165],
            alpha = [8448, 7681, 260];
        let previous = 0;
        for (const mode of [0, 1, 2, 3, 4, 5, 0, 99, 99, 1]) {
            const cmds: string[] = [];
            if (mode !== previous && mode < rgb.length) cmds.push(tex(34161, rgb[mode]));
            if (mode !== previous && mode < alpha.length) cmds.push(tex(34162, alpha[mode]));
            previous = mode;
            add('fixed ' + mode + ' 0', exact('ok', state, cmds));
        }
        const captured = join(dir, 'uploaded.arb');
        const result = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', cp, 'HdProgramOracle', captured], { stdin: Buffer.from(script.join('\n') + '\n'), maxBuffer: 32 * 1024 * 1024, timeout: 50000 });
        expect(result.exitCode, result.stderr.toString()).toBe(0);
        expect(readFileSync(captured).equals(source)).toBe(true);
        const actual = result.stdout.toString().trimEnd().split(/\r?\n/);
        expect(actual).toHaveLength(checks.length);
        for (let i = 0; i < actual.length; i++) {
            const [result, state, commands] = actual[i].split('|');
            try {
                checks[i]({ result, state, calls: commands ? commands.split(';') : [] });
            } catch (e) {
                throw new Error('HD command ' + i + ' ' + script[i], { cause: e });
            }
        }
        expect(entireTable.map(v => v.digest('hex'))).toEqual(tables);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}, 60000);
