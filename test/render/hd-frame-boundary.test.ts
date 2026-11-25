import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { hdGamepackPath, joglPath } from './hd-reference.js';

test('original HD MainRedraw, swap and clear calls retain their JOGL order across driver callbacks', () => {
    const temp = mkdtempSync(join(tmpdir(), '530-hd-frame-'));
    try {
        const libs = hdGamepackPath + delimiter + joglPath;
        const compile = Bun.spawnSync(['javac', join(import.meta.dir, '../hd/GlRecorder.java'), '-cp', libs, '-d', temp, join(import.meta.dir, 'HdFrameBoundaryOracle.java')]);
        expect(compile.exitCode, compile.stderr.toString()).toBe(0);
        const rows: string[] = [],
            expected: string[] = [];
        function frame(state: number, fault: number, hd: boolean, roots: number, maskSize = 100) {
            rows.push(['frame', state, fault, Number(hd), roots, maskSize].join(' '));
            let dirty = 0,
                result = 'ok';
            const original = [true, false, true, true],
                commands: string[] = [];
            let current: boolean[] | null = original;
            const bits = (values: boolean[] | null) => (values === null ? '-' : values.map(Number).join(''));
            if (state !== 1000) {
                dirty = hd ? Math.min(maskSize, 100) : 0;
                if (hd && maskSize < 100) result = 'ArrayIndexOutOfBoundsException';
                else if (hd && state !== 0) {
                    if (state === 10 || state === 30) {
                        for (let i = 0; i < roots; i++) {
                            if (i === original.length) {
                                result = 'ArrayIndexOutOfBoundsException';
                                break;
                            }
                            dirty--;
                            original[i] = true;
                        }
                        if (result === 'ok') commands.push('A.glDisable(3089)');
                    }
                    if (result === 'ok') {
                        if (fault !== 6) commands.push('swap@' + dirty + '/' + bits(original));
                        if (fault === 2) result = 'error';
                        else {
                            if (fault === 3) {
                                current = [true, true, true, true];
                                roots = 3;
                            }
                            if (fault === 4) roots = 0;
                            if (fault === 5) current = null;
                            for (let i = 0; i < roots; i++) {
                                if (current === null) {
                                    result = 'NullPointerException';
                                    break;
                                }
                                if (i >= current.length) {
                                    result = 'ArrayIndexOutOfBoundsException';
                                    break;
                                }
                                current[i] = false;
                            }
                        }
                    }
                } else commands.push('awt', 'repaint');
            }
            expected.push([result, commands.join(';'), dirty, bits(original), bits(current)].join('|'));
        }
        for (const state of [1, 10, 20, 30, 1000])
            for (const count of [-1, 0, 2, 4, 5])
                for (const fault of [0, 1, 2, 3, 4, 5, 6]) {
                    frame(state, fault, true, count);
                }
        for (const length of [0, 1, 17, 99, 100, 101]) frame(1, 0, true, 3, length);
        frame(0, 0, false, 3);
        frame(0, 0, true, 3);
        frame(1, 0, false, 3);
        const floats = new DataView(new ArrayBuffer(4));
        function channel(value: number) {
            floats.setFloat32(0, (value & 255) / 255);
            return floats.getUint32(0).toString(16);
        }
        for (const rgb of [0, 1, -1, -2147483648, 0x012345, 0x80123456 | 0, 0xff0080])
            for (const fault of [0, -1, -2, -3, 1, 2, 3]) {
                rows.push('colour ' + rgb + ' ' + fault);
                const gl = ['glClearColor(' + [channel(rgb >> 16), channel(rgb >> 8), channel(rgb), '0'].join(',') + ')', 'glClear(16640)', 'glClearColor(0,0,0,0)'];
                const sent = gl.slice(0, fault > 0 ? fault : 3).map((command, i) => (fault < 0 && i >= -fault ? 'B.' : 'A.') + command);
                expected.push([fault > 0 ? 'error' : 'ok', sent.join(';'), 0, '1011', '1011'].join('|'));
            }
        rows.push('depth 0 0', 'depth 0 1');
        expected.push('ok|A.glClear(256)|0|1011|1011', 'error|A.glClear(256)|0|1011|1011');
        const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', temp + delimiter + libs, 'HdFrameBoundaryOracle'], {
            stdin: Buffer.from(rows.join('\n') + '\n')
        });
        expect(java.exitCode, java.stderr.toString()).toBe(0);
        const actual = java.stdout.toString().trimEnd().split(/\r?\n/);
        expect(actual.length).toBe(expected.length);
        for (let i = 0; i < expected.length; i++) expect(actual[i], rows[i]).toBe(expected[i]);
    } finally {
        rmSync(temp, { recursive: true, force: true });
    }
});
