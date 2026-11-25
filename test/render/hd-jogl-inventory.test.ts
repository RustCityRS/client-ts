import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { inventory } from './hd-jogl-inventory.js';
import { hdGamepackPath } from './hd-reference.js';

const sha256 = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');

test('the complete HD JOGL site inventory agrees with the original class declarations and javap instructions', () => {
    const data = inventory();
    const rows = data
        .trimEnd()
        .split('\n')
        .map(line => line.split('\t'));
    expect(rows.find(([kind]) => kind === 'summary')).toEqual(['summary', '26', '125', '956', '115', '920', '2']);
    expect(sha256(data)).toBe('dee8fa67e9ab44469c15e5b8b1fd809720970b8eab2478ba4a2637cef52a88e1');
    const callers = rows.filter(([kind]) => kind === 'class').map(([, owner]) => owner);
    const calls = rows.filter(([kind]) => kind === 'call');
    const asmSites = calls.map(([, method, ordinal, opcode, owner, name, descriptor]) => [method, ordinal, opcode, owner, name, descriptor].join('\t'));

    // Independently disassemble the 26 complete HD caller classes, including every overload and both
    // switch forms. javap reports physical byte offsets; the inventory numbers actual instructions.
    const command = spawnSync('javap', ['-cp', hdGamepackPath, '-p', '-c', '-s', ...callers], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
    if (command.status !== 0) throw new Error(command.stderr || String(command.error));
    const sites: string[] = [];
    const probes = new Map<string, string[]>();
    let type = '',
        name = '',
        method = '',
        ordinal = 0;
    const probedMethods = new Set(['rd.f()V', 'fj.c()V', 'wm.b()V', 'hg.a([[[Lbj;FZ)V']);
    for (const line of command.stdout.split(/\r?\n/)) {
        const header = /^(?:[\w ]*\s)?(?:class|interface) (\w+)\b/.exec(line);
        if (header) type = header[1];
        if (/^ {2}\S/.test(line)) {
            name = line === '  static {};' ? '<clinit>' : /([^\s(]+)\([^)]*\).*;$/.exec(line)?.[1] || '';
            if (name === type) name = '<init>';
        }
        const descriptor = /^ {4}descriptor: (\(\S+)$/.exec(line);
        if (descriptor) {
            method = type + '.' + name + descriptor[1];
            ordinal = 0;
            if (probedMethods.has(method)) probes.set(method, []);
        }
        const instruction = /^\s+(\d+):\s+([a-z][a-z_0-9]*)(.*)$/.exec(line);
        if (!instruction) continue;
        const target = /\/\/ (?:InterfaceMethod|Method) (javax\/media\/opengl\/[\w/]+)\.("[^"]+"|\w+):(\S+)/.exec(instruction[3]);
        if (target) sites.push([method, ordinal, instruction[2], target[1], target[2].replaceAll('"', ''), target[3]].join('\t'));
        probes.get(method)?.push(instruction[2] + instruction[3].trimEnd());
        ordinal++;
    }
    expect(sites.sort()).toEqual(asmSites.sort());

    const sources = rows.filter(([kind]) => kind === 'assembly');
    expect(sources.map(([, member, pc]) => [member, pc])).toEqual([
        ['rd.f()V', '16'],
        ['rd.f()V', '18']
    ]);
    expect(sources[0][3]).toBe(sources[1][3]);
    const assembly = Buffer.from(sources[0][3], 'base64');
    expect(assembly.byteLength).toBe(1736);
    expect(assembly.toString().startsWith('!!ARBvp1.0\n')).toBe(true);
    expect(sha256(assembly)).toBe('05b4a0e72fd47dddd64ec397b735a871b1510d8c0cd0693189495d18f6a553ce');
    const program = probes.get('rd.f()V')?.join('\n') || '';
    expect(program).toMatch(/int 34336\nldc[^\n]+int 34933\nldc[^\n]+!!ARBvp1\.0[^\n]+\ninvokevirtual[^\n]+String.length:\(\)I\nldc[^\n]+!!ARBvp1\.0[^\n]+\ninvokeinterface[^\n]+glProgramStringARB:/);
    expect(calls.filter(([, , , , , gl]) => /Shader|LinkProgram/.test(gl))).toEqual([]);
    expect(calls.filter(([, , , , , gl]) => gl === 'glProgramStringARB')).toHaveLength(1);

    for (const [caller, format, stride] of [
        ['fj.c()V', 10787, 16],
        ['wm.b()V', 10791, 20]
    ] as const) {
        const code = probes.get(caller)?.join('\n') || '';
        expect(code).toMatch(new RegExp('sipush\\s+' + format + '\\nbipush\\s+' + stride + '\\nlconst_0\\ninvokeinterface[^\\n]+glInterleavedArrays:\\(IIJ\\)V'));
        expect(code).toMatch(new RegExp('sipush\\s+' + format + '\\nbipush\\s+' + stride + '\\naload_0\\ngetfield[^\\n]+ByteBuffer;\\ninvokeinterface[^\\n]+glInterleavedArrays:\\(IILjava/nio/Buffer;\\)V'));
    }
    const terrain = probes.get('hg.a([[[Lbj;FZ)V')?.join('\n') || '';
    expect(terrain).toMatch(/bipush\s+40\ngoto[^\n]+\nbipush\s+36\nistore\s+5/);
    for (const [offset, target] of [
        [12, 'glColorPointer'],
        [16, 'glNormalPointer'],
        [28, 'glTexCoordPointer'],
        [36, 'glTexCoordPointer']
    ] as const) {
        expect(terrain).toMatch(new RegExp('long ' + offset + 'l\\ninvokeinterface[^\\n]+' + target + ':'));
    }
}, 30000);
