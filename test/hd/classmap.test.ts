import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { gamepackPath } from '../reference.js';
import { hdGamepackPath } from '../render/hd-reference.js';

function run(command: string[]): string {
    const result = Bun.spawnSync(command, { stdout: 'pipe', stderr: 'pipe', maxBuffer: 8 * 1024 * 1024 });
    if (result.exitCode !== 0) throw new Error(result.stderr.toString());
    return result.stdout.toString().replaceAll('\r\n', '\n');
}

function declarations(jar: string) {
    const classes = run(['jar', 'tf', jar])
        .split('\n')
        .filter(path => path.endsWith('.class'))
        .map(path => path.slice(0, -6))
        .sort();
    const members = new Set<string>();
    const statics = new Set<string>();
    let owner = '',
        name = '',
        isStatic = false;
    for (const line of run(['javap', '-p', '-s', '-cp', jar, ...classes]).split('\n')) {
        const declaration = /^[\w ]*\b(?:class|interface) (\w+)\b/.exec(line);
        if (declaration) {
            owner = declaration[1];
        } else if (/^ {2}\S/.test(line)) {
            isStatic = /\bstatic\b/.test(line);
            // Keep overloads with the same spelling as the class distinct from constructors.
            const words = line.trim().split('(')[0].replace(/;$/, '').split(/\s+/);
            name = words.at(-1) ?? '';
            if (line === '  static {};') name = '<clinit>';
            else if (name === owner && words.slice(0, -1).every(w => ['public', 'protected', 'private'].includes(w))) name = '<init>';
        } else if (line.startsWith('    descriptor: ')) {
            const descriptor = line.trim().slice('descriptor: '.length);
            const member = owner + '.' + name + (descriptor.startsWith('(') ? '' : ':') + descriptor;
            members.add(member);
            if (isStatic) statics.add(member);
        }
    }
    return { classes, members, statics };
}

function readMap(file: string) {
    return JSON.parse(readFileSync(new URL('../maps/' + file, import.meta.url), 'utf8'));
}

function staticFields(jar: string, owner: string, name: string, descriptor: string, opcode = 'getstatic'): string[] {
    const blocks = run(['javap', '-p', '-s', '-c', '-cp', jar, owner]).split(/\n {2}(?=\S)/);
    const body = blocks.find(block => block.split('\n', 1)[0].includes(' ' + name + '(') && block.includes('\n    descriptor: ' + descriptor + '\n'));
    if (!body) throw new Error('Missing method ' + owner + '.' + name + descriptor);
    return [...body.matchAll(/\b(getstatic|putstatic)\s+#\d+\s+\/\/ Field (\S+)/g)].filter(([, op]) => op === opcode).map(([, , field]) => (field.includes('.') ? field : owner + '.' + field));
}

test('the HD maps cover the original JAR declarations and point to existing SD members and HD witnesses', () => {
    const sd = declarations(gamepackPath);
    const hd = declarations(hdGamepackPath);
    const classes: { hd: string; sd: string | null }[] = readMap('classmap-hd.json').classes;
    const statics: { hd: string; sd?: string; sdCandidate?: string; witnesses?: string[] }[] = readMap('membermap-hd.json').statics;
    expect(classes.map(c => c.hd).sort()).toEqual(hd.classes);
    expect(statics.map(m => m.hd).sort()).toEqual([...hd.statics].sort());
    const pairs = classes.flatMap(c => (c.sd === null ? [] : [c.sd]));
    expect(new Set(pairs).size).toBe(pairs.length);
    expect(pairs.filter(c => !sd.classes.includes(c))).toEqual([]);
    expect(statics.flatMap(m => [m.sd, m.sdCandidate]).filter(k => k !== undefined && !sd.statics.has(k))).toEqual([]);
    expect(statics.flatMap(m => m.witnesses ?? []).filter(k => !hd.members.has(k))).toEqual([]);
}, 30_000);

test('the HD static map pairs all 27 serialized preferences in the order each gamepack reads them', () => {
    const rows: { hd: string; sd?: string }[] = readMap('membermap-hd.json').statics;
    const pairs = new Map(rows.map(row => [row.hd, row.sd]));
    const hd = staticFields(hdGamepackPath, 'dl', 'a', '(B)Lwa;').filter(field => field !== 'dl.g:I');
    const sd = staticFields(gamepackPath, 'db', 'b', '(I)Lgd;').filter(field => field !== 'db.h:I');
    expect(hd).toHaveLength(27);
    expect(hd.map(field => pairs.get(field))).toEqual(sd);
}, 30_000);

test('all 28 HD login archive fields map to the archive at the same CRC position in the SD login packet', () => {
    const rows: { hd: string; sd?: string }[] = readMap('membermap-hd.json').statics;
    const pairs = new Map(rows.map(row => [row.hd, row.sd]));
    const hd = staticFields(hdGamepackPath, 'ri', 'a', '(B)V').filter(field => field.endsWith(':Lve;'));
    const sd = staticFields(gamepackPath, 'le', 'a', '(I)V').filter(field => field.endsWith(':Lal;'));
    expect(new Set(hd).size).toBe(28);
    expect(hd.map(field => pairs.get(field))).toEqual(sd);
}, 30_000);

test('soft-cache sweeps map by the JAR receiver and HD shutdown releases the light cache last in rm.a', () => {
    const rows: { hd: string; sd?: string; sdCandidate?: string; target?: string }[] = readMap('membermap-hd.json').statics;
    const map = new Map(rows.map(r => [r.hd, r]));
    for (const [hdOwner, hdName, hdSig, sdOwner, sdName, sdSig, target] of [
        ['ab', 'b', '(B)V', 'ed', 'c', '(I)V', 'VarpType.removeSoft'],
        ['ug', 'b', '(B)V', 'dd', 'a', '(I)V', 'ClientEntity.removeSoft'],
        ['hd', 'a', '(I)V', 'oj', 'a', '(B)V', 'LightType.removeSoft']
    ]) {
        const hd = staticFields(hdGamepackPath, hdOwner, hdName, hdSig).filter(f => f.endsWith(':Ln;'));
        const sd = staticFields(gamepackPath, sdOwner, sdName, sdSig).filter(f => f.endsWith(':Lve;'));
        expect(hd).toHaveLength(1);
        expect(sd).toHaveLength(1);
        expect(map.get(hd[0])?.sd).toBe(sd[0]);
        const method = map.get(hdOwner + '.' + hdName + hdSig);
        expect(method?.target).toBe(target);
        expect(method?.sd).toBe(sdOwner + '.' + sdName + sdSig);
    }
    const releases = staticFields(hdGamepackPath, 'rm', 'a', '(B)V', 'putstatic');
    expect(releases).toEqual(['rm.j:Lna;', 'rm.h:Lna;', 'rm.k:Lna;', 'rm.i:Lna;', 'rm.d:Ln;']);
    expect(map.get(releases[4])?.target).toBe('LightType.cache');
    expect(map.get('rm.a(B)V')?.target).toBe('Client.releaseStatics');
    expect(map.get('rm.a(B)V')?.sdCandidate).toBeUndefined();
    const confirmed = new Set(rows.flatMap(r => (r.sd === undefined ? [] : [r.sd])));
    expect(rows.filter(r => r.sdCandidate !== undefined && confirmed.has(r.sdCandidate)).map(r => r.hd)).toEqual([]);
}, 30_000);

test('location archives and procedural texture dimensions map to the actual JAR stores', () => {
    const rows: { hd: string; sd?: string }[] = readMap('membermap-hd.json').statics;
    const pairs = new Map(rows.map(row => [row.hd, row.sd]));
    const hdLoc = staticFields(hdGamepackPath, 'oi', 'a', '(ILve;Lve;Z)V', 'putstatic').filter(f => f !== 'oi.f:I');
    const sdLoc = staticFields(gamepackPath, 'sb', 'a', '(Lal;BLal;Z)V', 'putstatic').filter(f => f !== 'sb.k:Lid;' && f !== 'sb.d:I');
    expect(sdLoc).toEqual(['ik.Y:Lal;', 'ok.z:Z', 'gd.U:Lal;']);
    expect(hdLoc.map(f => pairs.get(f))).toEqual([sdLoc[1], sdLoc[0], sdLoc[2]]);
    const hdLookup = staticFields(hdGamepackPath, 'wc', 'a', '(II)Lpb;').filter(f => f !== 'wc.a:I');
    const sdLookup = staticFields(gamepackPath, 'ke', 'a', '(II)Ljb;').filter(f => f !== 'ke.k:I');
    expect(hdLookup.map(f => pairs.get(f))).toEqual(sdLookup);

    const hdSize = staticFields(hdGamepackPath, 'an', 'c', '(III)V', 'putstatic').filter(f => f !== 'an.Y:I');
    const sdSize = staticFields(gamepackPath, 'vk', 'a', '(III)V', 'putstatic').filter(f => f !== 'vk.ab:I');
    expect(sdSize).toEqual(['vg.U:[I', 'j.b:I', 'hf.I:I', 'kl.Eb:I', 'cf.h:[I', 'cf.h:[I', 'vi.hb:I', 'g.k:I']);
    expect(hdSize.map(f => pairs.get(f))).toEqual([sdSize[0], sdSize[1], sdSize[3], sdSize[2], sdSize[4], sdSize[5], sdSize[7], sdSize[6]]);
}, 30_000);
