import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const glTraceSpecPath = join(import.meta.dir, './GLTRACE.md');
const spec = readFileSync(glTraceSpecPath, 'utf8').replaceAll('\r\n', '\n');

function section(name: string): string {
    const begin = '<!-- ' + name + ':begin -->\n';
    const start = spec.indexOf(begin);
    const end = spec.indexOf('<!-- ' + name + ':end -->', start + begin.length);
    if (start < 0 || end < 0) throw new Error('GLTRACE.md section ' + name + ' missing');
    return spec.slice(start + begin.length, end).trim();
}

export function mdTableRows(name: string): string[][] {
    const [header, separator, ...rows] = section(name).split('\n');
    if (!header.startsWith('|') || !/^\|(?:\s*:?-+:?\s*\|)+$/.test(separator)) throw new Error('Missing Markdown table in ' + name);
    return rows.map(row => {
        if (!row.startsWith('|') || !row.endsWith('|')) throw new Error('Invalid Markdown row in ' + name);
        return row
            .slice(1, -1)
            .split('|')
            .map(cell => cell.trim());
    });
}

export function mdFence(name: string): string {
    const match = /^```[a-z]*\n([\s\S]*\n)```$/.exec(section(name));
    if (!match) throw new Error('GLTRACE.md section ' + name + ' is not one fenced block');
    return match[1];
}
