// From the repository root, bun test/maps/publish-members.ts writes out/MEMBERMAP.md.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

type Kind = 'normal' | 'constant' | 'artifact';
interface Member {
    owner: string;
    member: string;
    target: string;
    targetOwner: string;
    targetObf: string | null;
    proposedName: string;
    newClass: boolean;
    kind: Kind;
    confidence: string;
}
const base = resolve(import.meta.dir, '../../src');
const map: { generated: string; statics: Member[]; artifacts: { counters: string[]; unload: string[] } } = JSON.parse(readFileSync(resolve(import.meta.dir, 'membermap.json'), 'utf8'));
const groups = new Map<string, Member[]>();
for (const row of map.statics) {
    const key = row.targetOwner + '/' + row.target;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)?.push(row);
}
const count = (rows: Member[], kind: Kind) => rows.filter(row => row.kind === kind).length;
const byName = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const descriptors = new Set<string>();
for (const ent of readdirSync(base, { recursive: true, withFileTypes: true })) {
    if (!ent.isFile() || !ent.name.endsWith('.ts')) continue;
    const source = readFileSync(join(ent.parentPath, ent.name), 'utf8');
    for (const [comment] of source.matchAll(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g)) {
        for (const [key] of comment.matchAll(/(?<![\w$.])[a-z]+\.[\w$]+(?::\[*(?:[BCDFIJSZ]|L[\w/$]+;)|\((?:\[*(?:[BCDFIJSZ]|L[\w/$]+;))*\)\[*(?:[VBCDFIJSZ]|L[\w/$]+;))(?![\w$/;])/g)) {
            descriptors.add(key);
        }
    }
}
const live = map.statics.filter(row => row.kind !== 'artifact');
const keyOf = (row: Member) => row.owner + '.' + row.member.substring(row.member.indexOf(' ') + 1);
const cites = (rows: Member[]) => rows.filter(row => descriptors.has(keyOf(row))).length;
const liveClasses = [...groups.values()].filter(rows => rows.some(r => r.kind !== 'artifact')).length;
const lines = [
    '# 530 member map',
    '',
    `Claude compiled the SD gamepack inventory on ${map.generated}, with corrections from both agents. The [member map](../test/maps/membermap.json) records the evidence and confidence for each static member.`,
    '',
    `- The inventory includes ${map.artifacts.counters.length.toLocaleString('en-US')} invocation counters reset by \`tj\` and ${map.artifacts.unload.length} null-only unload methods. Shutdown comparisons cover the reference stores. The per-method ledger identifies unloads with a separate TypeScript implementation.`,
    `- The map assigns ${live.length} live statics to ${liveClasses} logical classes (${count(live, 'normal')} normal, ${count(live, 'constant')} constants).`,
    '- Each owner is responsible for the target class. Record corrections in [PORTING.md](../src/PORTING.md) and the JSON.',
    '- `TextureShapeRaster` holds the shared row canvas, clipping bounds, circle scratch and drawing routines for procedural texture operator 29. The four concrete shapes own their decoders. The Bezier and ellipse shapes also own their dispatchers. `Pix2D` owns the callbacks `ea.a(IIIIII)V` and `ef.a(IIIIII)V`. Both sides import the shared raster to avoid a module cycle. Each row retains the original Java declaring class and descriptor.',
    '- Lowercase `world` is the scene graph for squares, walls, locations, ground, occlusion and picking. The world-list class `qk` is [GameWorld](../src/io/GameWorld.ts).',
    `- Source comments cite the exact Java owner and descriptor for ${cites(live)} of ${live.length} live statics. This includes citations for partial ports and at call sites.`,
    '',
    '## Classes by owner',
    '',
    '| owner | logical class | obf class | statics (normal/const/artifact) | live cited |',
    '|---|---|---|---|---|'
];
for (const rows of [...groups.values()].sort((a, b) => byName(a[0].targetOwner, b[0].targetOwner) || b.length - a.length || byName(a[0].target, b[0].target))) {
    const r = rows[0];
    const actual = rows.filter(row => row.kind !== 'artifact');
    lines.push(`| ${r.targetOwner} | ${r.target}${r.newClass ? ' *new*' : ''} | ${r.targetObf ?? '—'} | ${rows.length} (${count(rows, 'normal')}/${count(rows, 'constant')}/${count(rows, 'artifact')}) | ${cites(actual)}/${actual.length} |`);
}
lines.push('', '## Members');
for (const [, rows] of [...groups].sort((a, b) => byName(a[0], b[0]))) {
    const r = rows[0];
    lines.push('', `### ${r.target} (${r.targetOwner}${r.newClass ? ', new' : ''})`, '', '| java | name | kind | conf |', '|---|---|---|---|');
    for (const m of rows.toSorted((a, b) => byName(a.owner, b.owner) || byName(a.member, b.member))) {
        const signature = m.owner + '.' + m.member.substring(m.member.indexOf(' ') + 1);
        lines.push('| `' + signature + '` | ' + m.proposedName + ' | ' + m.kind + ' | ' + m.confidence + ' |');
    }
}
const out = resolve(base, '../out');
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'MEMBERMAP.md'), lines.join('\n') + '\n');
