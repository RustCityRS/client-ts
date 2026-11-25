import { readFileSync } from 'node:fs';
import { ENTRY_RULES, type EntryRule, formatRecordLine, formatValue, type NameKind, parseTrace, type TraceFile, type TraceRecord, type TraceValue } from '#/gl/GlTrace.js';

// GLTrace v1 diff (src/gl/GLTRACE.md section 17): library and CLI.
//
//   bun test/hd/glTraceDiff.ts <expected.trace> <actual.trace> [--context N] [--deletions]
//
// Compares the ordered records of two traces (every record except deletions, unless --deletions) and prints the
// first divergence with N (default 20) records of context before it and up to N records after it on each side,
// including any '#@' stack lines. When the ordered records are identical it compares the live-object sets at every
// ~mark and at the end of the traces. Exit status: 0 equal, 1 different, 2 usage or parse error.

export interface DiffOptions {
    readonly context?: number;
    readonly includeDeletions?: boolean;
    readonly expectedLabel?: string;
    readonly actualLabel?: string;
}

export interface LiveSnapshot {
    readonly label: string;
    readonly live: Readonly<Record<NameKind, readonly number[]>>;
}

export interface LiveMismatch {
    readonly label: string;
    readonly kind: NameKind;
    readonly expectedOnly: readonly number[];
    readonly actualOnly: readonly number[];
}

export interface TraceDiff {
    readonly equal: boolean;
    // Index into the ordered records of the first difference (a missing record counts as different), or -1.
    readonly index: number;
    readonly expected: TraceRecord | null;
    readonly actual: TraceRecord | null;
    readonly liveMismatches: readonly LiveMismatch[];
    readonly report: string;
}

const NAME_KINDS: readonly NameKind[] = ['T', 'B', 'L', 'P'];

const RULES_BY_ENTRY = new Map<string, EntryRule[]>();
for (const rule of ENTRY_RULES.values()) {
    const list = RULES_BY_ENTRY.get(rule.entry) ?? [];
    list.push(rule);
    RULES_BY_ENTRY.set(rule.entry, list);
}

function nameIds(v: TraceValue | undefined, kind: NameKind): number[] {
    if (v === undefined) return [];
    if (v.t === 'name' && v.kind === kind) return [v.id];
    if (v.t === 'iv') return v.elems.flatMap(e => (e.t === 'name' && e.kind === kind ? [e.id] : []));
    return [];
}

// Live normalized names at each ~mark and at the end ('<end>'), from the allocation and deletion records
// (GLTRACE.md sections 9 and 17). A record that threw has no effect. glDeleteLists(#Lk, r) removes #Lk .. #L(k+r-1).
export function liveSnapshots(file: TraceFile): LiveSnapshot[] {
    const live: Record<NameKind, Set<number>> = { T: new Set(), B: new Set(), L: new Set(), P: new Set() };
    const out: LiveSnapshot[] = [];
    const snapshot = (label: string): LiveSnapshot => ({
        label,
        live: { T: [...live.T].sort((a, b) => a - b), B: [...live.B].sort((a, b) => a - b), L: [...live.L].sort((a, b) => a - b), P: [...live.P].sort((a, b) => a - b) }
    });
    for (const r of file.records) {
        if (r.entry === '~mark') {
            const label = r.args[0];
            out.push(snapshot(label !== undefined && label.t === 'label' ? label.text : '?'));
            continue;
        }
        if (r.thrown !== null) continue;
        const rules = RULES_BY_ENTRY.get(r.entry);
        if (rules === undefined) continue;
        const rule = rules.find(x => x.params.length + (x.receiver === null ? 0 : 1) === r.args.length);
        if (rule === undefined) continue;
        const shift = rule.receiver === null ? 0 : 1;
        rule.params.forEach((role, i) => {
            const col = r.args[i + shift];
            if (role.r === 'out-names') for (const id of nameIds(col, role.kind)) live[role.kind].add(id);
            if (role.r === 'in-names' && rule.deletion) for (const id of nameIds(col, role.kind)) live[role.kind].delete(id);
            if (role.r === 'name' && rule.deletion) {
                const range = r.args[i + shift + 1];
                const first = nameIds(col, role.kind);
                if (first.length === 1 && range !== undefined && range.t === 'int') {
                    for (let k = 0; k < range.v; k++) live[role.kind].delete(first[0] + k);
                }
            }
        });
        if (rule.ret.r === 'alloc-lists' && r.ret !== null && r.ret.t === 'name') {
            const range = r.args[rule.ret.arg];
            const n = range !== undefined && range.t === 'int' ? range.v : 0;
            for (let k = 0; k < n; k++) live.L.add(r.ret.id + k);
        }
    }
    out.push(snapshot('<end>'));
    return out;
}

function show(r: TraceRecord, prefix: string): string {
    let s = prefix + formatRecordLine(r);
    if (r.stack !== null) s += '\n' + ' '.repeat(prefix.length) + '#@ ' + r.stack;
    return s;
}

function slips(r: TraceRecord | null): string[] {
    if (r === null) return [];
    const all = r.ret === null ? r.args : [...r.args, r.ret];
    return all.filter(v => v.t === 'slip').map(formatValue);
}

export function diffTraceFiles(expected: TraceFile, actual: TraceFile, options: DiffOptions = {}): TraceDiff {
    const context = options.context ?? 20;
    const keep = (r: TraceRecord) => options.includeDeletions === true || !r.deletion;
    const e = expected.records.filter(keep);
    const a = actual.records.filter(keep);
    const lines: string[] = [];
    const expLabel = options.expectedLabel ?? 'expected';
    const actLabel = options.actualLabel ?? 'actual';
    const n = Math.min(e.length, a.length);
    let index = -1;
    for (let i = 0; i < n; i++) {
        if (formatRecordLine(e[i]) !== formatRecordLine(a[i])) {
            index = i;
            break;
        }
    }
    if (index === -1 && e.length !== a.length) index = n;
    const deletionNote =
        options.includeDeletions === true
            ? 'deletions compared in order'
            : 'deletion records excluded from the ordered comparison: ' + expected.records.filter(r => r.deletion).length + ' ' + expLabel + ', ' + actual.records.filter(r => r.deletion).length + ' ' + actLabel;
    if (index !== -1) {
        const er = index < e.length ? e[index] : null;
        const ar = index < a.length ? a[index] : null;
        const id = (r: TraceRecord | null) => (r === null ? 'end of trace' : r.frame + '.' + (r.deletion ? 'd' : '') + r.seq);
        lines.push('GLTrace diff: first divergence at ordered record ' + index + ' (' + expLabel + ' ' + id(er) + ', ' + actLabel + ' ' + id(ar) + ')');
        lines.push('(' + deletionNote + ')');
        lines.push('--- ' + Math.min(context, index) + ' matching records before ---');
        for (let i = Math.max(0, index - context); i < index; i++) lines.push(show(e[i], '  '));
        lines.push('--- divergence (- ' + expLabel + ', + ' + actLabel + ') ---');
        lines.push(er === null ? '- <end of trace>' : show(er, '- '));
        lines.push(ar === null ? '+ <end of trace>' : show(ar, '+ '));
        const slip = slips(ar);
        if (slip.length > 0) lines.push('note: ' + actLabel + ' passes a value the Java parameter type cannot hold: ' + slip.join(' '));
        lines.push('--- up to ' + context + ' following records, ' + expLabel + ' ---');
        for (let i = index + 1; i < Math.min(e.length, index + 1 + context); i++) lines.push(show(e[i], '- '));
        lines.push('--- up to ' + context + ' following records, ' + actLabel + ' ---');
        for (let i = index + 1; i < Math.min(a.length, index + 1 + context); i++) lines.push(show(a[i], '+ '));
        return { equal: false, index, expected: er, actual: ar, liveMismatches: [], report: lines.join('\n') + '\n' };
    }
    const liveMismatches: LiveMismatch[] = [];
    const es = liveSnapshots(expected);
    const as = liveSnapshots(actual);
    for (let i = 0; i < Math.min(es.length, as.length); i++) {
        for (const kind of NAME_KINDS) {
            const x = new Set(es[i].live[kind]);
            const y = new Set(as[i].live[kind]);
            const expectedOnly = [...x].filter(v => !y.has(v));
            const actualOnly = [...y].filter(v => !x.has(v));
            if (expectedOnly.length > 0 || actualOnly.length > 0) liveMismatches.push({ label: es[i].label, kind, expectedOnly, actualOnly });
        }
    }
    if (liveMismatches.length > 0) {
        lines.push('GLTrace diff: ordered records equal (' + e.length + '), live objects differ');
        lines.push('(' + deletionNote + ')');
        for (const m of liveMismatches) {
            const ids = (xs: readonly number[]) => (xs.length === 0 ? '-' : xs.map(v => '#' + m.kind + v).join(','));
            lines.push('at ' + m.label + ': ' + expLabel + ' only ' + ids(m.expectedOnly) + '; ' + actLabel + ' only ' + ids(m.actualOnly));
        }
        return { equal: false, index: -1, expected: null, actual: null, liveMismatches, report: lines.join('\n') + '\n' };
    }
    lines.push('GLTrace diff: equal (' + e.length + ' ordered records, live objects equal at ' + es.length + ' checkpoints)');
    lines.push('(' + deletionNote + ')');
    return { equal: true, index: -1, expected: null, actual: null, liveMismatches: [], report: lines.join('\n') + '\n' };
}

export function diffTraces(expectedText: string, actualText: string, options: DiffOptions = {}): TraceDiff {
    return diffTraceFiles(parseTrace(expectedText), parseTrace(actualText), options);
}

export function main(argv: readonly string[]): number {
    const files: string[] = [];
    let context = 20;
    let includeDeletions = false;
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--deletions') includeDeletions = true;
        else if (arg === '--context') context = Number(argv[++i]);
        else files.push(arg);
    }
    if (files.length !== 2 || !Number.isInteger(context) || context < 0) {
        process.stderr.write('usage: bun test/hd/glTraceDiff.ts <expected.trace> <actual.trace> [--context N] [--deletions]\n');
        return 2;
    }
    try {
        const diff = diffTraces(readFileSync(files[0], 'utf8'), readFileSync(files[1], 'utf8'), { context, includeDeletions, expectedLabel: files[0], actualLabel: files[1] });
        process.stdout.write(diff.report);
        return diff.equal ? 0 : 1;
    } catch (e) {
        process.stderr.write(String(e) + '\n');
        return 2;
    }
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
