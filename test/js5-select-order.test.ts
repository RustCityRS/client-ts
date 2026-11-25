import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import ByteArrayCopier, { type StoredBytes } from '#/cache/ByteArrayCopier.js';
import Js5 from '#/cache/Js5.js';
import Js5Index from '#/cache/Js5Index.js';
import Crc32 from '#/io/Crc32.js';
import { gamepackPath } from './reference.js';

type Files = ((StoredBytes | null)[] | null)[];

function run(op: number, shape: number, change: number, action: number): string {
    const caps = shape === 0 || shape === 5 ? [3] : shape === 3 ? [0, 0, 1] : [0, 1, 3];
    const group = shape === 0 || shape === 5 ? 0 : shape === 2 ? 2 : shape === 6 ? -1 : shape === 7 ? 99 : 1;
    const file = shape === 0 || shape === 5 || shape === 2 ? 1 : 0;
    const id = caps.length === 1 ? file : group;
    const check = shape !== 5 && shape !== 8;
    Js5.strictValidation = shape === 7;
    const trace: string[] = [];
    const stop = new Error('stop');
    class Copier extends ByteArrayCopier {
        set() {}
        get() {
            observe('copy');
            return Uint8Array.of(77);
        }
    }
    const original: Files = caps.map(n => Array.from({ length: n }, () => new Copier()));
    const alternate: Files = caps.map(n => Array.from({ length: n }, () => Uint8Array.of(42)));
    if (shape === 4 || shape === 5 || shape === 8) original.fill(null);
    let files: Files | null = original;
    let packed: (StoredBytes | null)[] | null = new Array(caps.length).fill(null);
    let capacities: Int32Array | null = Int32Array.from(caps);
    function observe(label: string) {
        trace.push(label);
        if (trace.length !== change) return;
        switch (action) {
            case 0:
                capacities = new Int32Array(0);
                break;
            case 1:
                capacities = null;
                break;
            case 2:
                files = alternate;
                break;
            case 3:
                files = null;
                break;
            case 4:
                files = [];
                break;
            case 5:
                packed = [];
                break;
            case 6:
                packed = null;
                break;
            case 7:
                throw stop;
        }
    }
    const data = Uint8Array.of(0, 0, 0, 0, 4, 5, 0, 0, 0);
    const index = new Js5Index(data, Crc32.prefix(data, data.length));
    index.capacity = caps.length;
    Object.defineProperty(index, 'fileCapacities', {
        get() {
            const previous = capacities;
            observe('c');
            return previous;
        }
    });
    const archive = new Js5(
        {
            index() {
                observe('index');
                return index;
            },
            group(_mode, group) {
                observe('load' + group);
                return null;
            },
            prefetchGroup() {
                throw new Error('unexpected hint');
            },
            GetGroupLoadPercentage() {
                throw new Error('unexpected percentage');
            }
        },
        true,
        true
    );
    archive['index'] = index;
    Object.defineProperty(archive, 'unpacked', {
        get() {
            const previous = files;
            observe('f');
            return previous;
        }
    });
    Object.defineProperty(archive, 'packed', {
        get() {
            const previous = packed;
            observe('p');
            return previous;
        }
    });
    let result: Uint8Array | boolean | number | string | null;
    try {
        switch (op) {
            case 0:
                result = archive.GetFile(file, group);
                break;
            case 1:
                result = archive.RequestDownload(check, group, file);
                break;
            case 2:
                result = archive.RequestGroupDownload(group);
                break;
            case 3:
                result = archive.GetFile2(id);
                break;
            case 4:
                result = archive.RequestDownload2(id, check);
                break;
            default:
                result = archive.GetFileIdLimit(group);
                break;
        }
    } catch (error) {
        if (error === stop) result = 'stop';
        else if (error instanceof TypeError) result = 'nullref';
        else if (error instanceof RangeError) result = error.message.startsWith('array index ') ? 'bounds' : 'argument';
        else if (error instanceof Error && error.message === '') result = 'runtime';
        else throw error;
    }
    function slot(rows: Files): string {
        if (group < 0 || group >= rows.length) return 'x';
        const row = rows[group];
        if (row === null) return '-';
        if (file < 0 || file >= row.length) return 'x';
        return row[file] === null ? '0' : row[file] instanceof Copier ? 'c' : 'b';
    }
    return [result instanceof Uint8Array ? result[0] : String(result), slot(original) + slot(alternate), trace.join(',')].join('/');
}

test('five JS5 selectors and file ID limits preserve original array reads, sparse bounds, callbacks and discard order', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rs530-archive-select-'));
    const strict = Js5.strictValidation;
    try {
        const access = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED'];
        const cp = dir + delimiter + gamepackPath;
        for (const command of [
            ['javac', ...access, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'cache/ArchiveSelectOracle.java')],
            ['java', ...access, '-cp', cp, 'ArchiveSelectOracle', dir]
        ]) {
            const result = Bun.spawnSync(command);
            expect(result.exitCode, result.stderr.toString()).toBe(0);
        }
        const rows: [number, number, number, number][] = [];
        for (let op = 0; op < 6; op++)
            for (let shape = 0; shape < 9; shape++) {
                rows.push([op, shape, 0, 0]);
                for (let at = 1; at <= 19; at++) {
                    for (let action = 0; action < 8; action++) rows.push([op, shape, at, action]);
                }
            }
        const java = Bun.spawnSync(['java', ...access, '-cp', cp, 'ArchiveSelectOracle'], {
            stdin: Buffer.from(rows.map(row => row.join(' ')).join('\n') + '\n'),
            maxBuffer: 4 * 1024 * 1024
        });
        expect(java.exitCode, java.stderr.toString()).toBe(0);
        const lines = java.stdout.toString().trimEnd().split(/\r?\n/);
        expect(lines.length).toBe(rows.length);
        for (const [i, row] of rows.entries()) expect(run(...row), row.join(' ')).toBe(lines[i]);
    } finally {
        Js5.strictValidation = strict;
        rmSync(dir, { recursive: true, force: true });
    }
}, 30000);
