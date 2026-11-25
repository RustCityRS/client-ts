// bun test/maps/publish-classes.ts refreshes the JSON coverage and writes out/CLASSMAP.md.
// --check verifies source citations against the inventory without writing files.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gamepackPath } from '../reference.js';
import { requireNonNull } from '../../src/util/JavaArray.js';

interface Row {
    obf: string;
    owner: string;
    deobName: string;
    subsystem: string;
    role: string;
    tsPath: string;
    members: { if: number; im: number; ctors: number };
    erasedInstanceMethods?: { signature: string; counter: string }[];
    ported: boolean;
    portedCoverage: string | null;
}
const base = resolve(import.meta.dir, '../..');
const jsonPath = resolve(base, 'test/maps/classmap.json');
const check = process.argv.includes('--check');
const map: { classes: Row[] } = JSON.parse(readFileSync(jsonPath, 'utf8'));
const java = Bun.spawnSync(['java', '-cp', gamepackPath, resolve(import.meta.dir, '../game/PortMapOracle.java'), gamepackPath, 'instance']);
if (java.exitCode !== 0) throw new Error(java.stderr.toString());
const declarations = new Map<string, string[]>();
for (const line of java.stdout.toString().trimEnd().split(/\r?\n/)) {
    const [owner, kind, signature] = line.split(' ');
    if (kind === undefined) declarations.set(owner, []);
    else requireNonNull(declarations.get(owner)).push(owner + '.' + signature);
}

let total = 0,
    cited = 0,
    erased = 0,
    half = 0;
const seen = new Set<string>();
const report = ['| Class | TypeScript name | Source | Owner | Subsystem | Cited | Erased | Role |', '|---|---|---|---|---|---:|---:|---|'];
let changed = false;
for (const row of map.classes) {
    const members = declarations.get(row.obf);
    if (!members || members.length !== row.members.if + row.members.im + row.members.ctors) throw new Error('Instance map differs for ' + row.obf);
    const path = resolve(base, row.tsPath);
    const omitted = new Set((row.erasedInstanceMethods ?? []).map(method => row.obf + '.' + method.signature));
    if (omitted.size !== (row.erasedInstanceMethods?.length ?? 0) || [...omitted].some(method => !members.includes(method))) throw new Error('Invalid instance erasure in ' + row.obf);
    let matched = 0;
    let coverage: string | null = null;
    if (members.length && existsSync(path)) {
        const comments =
            readFileSync(path, 'utf8')
                .match(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g)
                ?.join('\n') ?? '';
        for (const member of members) {
            if (omitted.has(member)) continue;
            const literal = member.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            // PacketT separates SD and HD descriptor citations with a semicolon and a space.
            if (new RegExp('(?<![\\w$.])' + literal + '(?![\\w$/]|;(?=\\S))').test(comments)) matched++;
        }
        coverage = matched + '/' + members.length;
    }
    const ported = members.length > 0 && 2 * matched >= members.length;
    if (row.portedCoverage !== coverage || row.ported !== ported) {
        if (check) throw new Error('Stale source coverage in classmap.json for ' + row.obf + ': expected ' + coverage);
        row.portedCoverage = coverage;
        row.ported = ported;
        changed = true;
    }
    if (ported) half++;
    total += members.length;
    cited += matched;
    erased += omitted.size;
    seen.add(row.obf);
    const source = existsSync(path) ? `[${row.tsPath}](../${row.tsPath})` : `\`${row.tsPath}\``;
    report.push(`| \`${row.obf}\` | ${row.deobName} | ${source} | ${row.owner} | ${row.subsystem} | ${coverage ?? '-'} | ${omitted.size} | ${row.role.replaceAll('|', '\\|')} |`);
}
if (seen.size !== declarations.size || seen.size !== map.classes.length) throw new Error('Class count differs from JAR');
const summary = `${cited} of ${total} instance descriptors cited in canonical files. ${erased} erased, ${total - cited - erased} uncited. ${half} classes cite at least half.`;
if (!check) {
    if (changed) writeFileSync(jsonPath, JSON.stringify(map, null, 1) + '\n');
    const out = resolve(base, 'out');
    mkdirSync(out, { recursive: true });
    writeFileSync(resolve(out, 'CLASSMAP.md'), ['# 530 class map', '', summary, '', '[Complete class evidence](../test/maps/classmap.json)', '', ...report, ''].join('\n'));
}
console.log(summary);
