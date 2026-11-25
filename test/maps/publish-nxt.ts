// bun test/maps/publish-nxt.ts writes out/NXTNAMES.md.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface CrosswalkRow {
    obf: string;
    currentName: string;
    nxtName: string | null;
    nxtNamespace: string | null;
    nxtHeader: string | null;
    kind: string;
    confidence: string | null;
}
interface ClassRow {
    obf: string;
    deobName: string;
    owner: string;
    nxtTsName: string;
}
const dir = import.meta.dir;
const rows: CrosswalkRow[] = JSON.parse(readFileSync(resolve(dir, 'nxtnames.json'), 'utf8')).rows;
const classes: ClassRow[] = JSON.parse(readFileSync(resolve(dir, 'classmap.json'), 'utf8')).classes;
const byOwner = new Map(classes.map(row => [row.obf, row]));
if (rows.length !== classes.length || new Set(rows.map(row => row.obf)).size !== classes.length) throw Error('Incomplete NXT class map');
const counterparts = rows.filter(row => row.nxtName !== null);
const counts = (key: 'kind' | 'confidence', values: string[]) => values.map(value => counterparts.filter(row => row[key] === value).length + ' ' + value).join(', ');
const summary =
    '**Coverage:** ' +
    counterparts.length +
    ' classes have an NXT counterpart (' +
    counts('kind', ['same', 'split', 'part', 'merged']) +
    '; confidence ' +
    counts('confidence', ['high', 'medium', 'low']) +
    '). ' +
    (rows.length - counterparts.length) +
    ' have none. The source symbols and the selected TypeScript names are recorded separately.';
const lines = [
    '# 530 to NXT class crosswalk',
    '',
    'The [symbol inventory](../test/maps/nxtnames.json) records the NXT headers, evidence, alternatives and member hints. The [class map](../test/maps/classmap.json) records the chosen TypeScript names.',
    '',
    summary,
    '',
    '## Class renames',
    '',
    '| owner | obf | original TS name | selected TS name | current TS name | NXT counterpart | kind | confidence |',
    '|---|---|---|---|---|---|---|---|'
];
const qualified = (r: CrosswalkRow) => (r.nxtName ? '`' + [r.nxtNamespace, r.nxtName].filter(Boolean).join('::') + '`' : '—');
for (const c of [...classes].sort((a, b) => a.owner.localeCompare(b.owner) || a.obf.localeCompare(b.obf))) {
    const r = rows.find(row => row.obf === c.obf);
    if (!r) throw Error('Missing ' + c.obf);
    if (c.nxtTsName === r.currentName && c.deobName === r.currentName) continue;
    lines.push(`| ${c.owner} | \`${c.obf}\` | ${r.currentName} | ${c.nxtTsName} | ${c.deobName} | ${qualified(r)} | ${r.kind} | ${r.confidence ?? ''} |`);
}
lines.push('', '## All classes', '', '| obf | owner | current | NXT counterpart | header | kind | conf | TS name |', '|---|---|---|---|---|---|---|---|');
for (const r of rows) {
    const c = byOwner.get(r.obf);
    if (!c) throw Error('Unknown ' + r.obf);
    lines.push(`| \`${r.obf}\` | ${c.owner} | ${c.deobName} | ${qualified(r)} | ${r.nxtHeader ? '`' + r.nxtHeader + '`' : ''} | ${r.kind} | ${r.confidence ?? ''} | ${c.nxtTsName} |`);
}
const out = resolve(dir, '../../out');
mkdirSync(out, { recursive: true });
writeFileSync(resolve(out, 'NXTNAMES.md'), lines.join('\n') + '\n');
