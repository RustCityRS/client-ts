import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import ObjType from '#/config/ObjType.js';
import LocalisedText from '#/ui/LocalisedText.js';
import { gamepackPath } from './reference.js';

test('inventory widget and icon quantities reproduce the gamepack strings across signed boundaries and languages', () => {
    const numbers = new Set([0, -2147483648, 2147483647]);
    for (let digits = 0; digits <= 9; digits++) {
        const power = 10 ** digits;
        for (const sign of [1, -1])
            for (const difference of [-2, -1, 0, 1, 2]) {
                numbers.add(sign * power + difference);
            }
    }
    let sample = 42;
    for (let i = 0; i < 128; i++) {
        sample = (Math.imul(sample, 1664525) + 1013904223) | 0;
        numbers.add(sample);
    }
    const languages = [0, 1, 2];
    const input = languages.flatMap(language => [...numbers].map(count => language + ' ' + count)).join('\n');
    const dir = mkdtempSync(join(tmpdir(), 'rs530-inventory-number-'));
    const saved = Object.entries(LocalisedText);
    try {
        const compile = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game/InventoryNumberOracle.java')]);
        expect(compile.stderr.toString()).toBe('');
        const run = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'InventoryNumberOracle'], { stdin: Buffer.from(input + '\n') });
        expect(run.exitCode).toBe(0);
        expect(run.stderr.toString()).toBe('');
        const lines = run.stdout.toString().trim().split(/\r?\n/);
        LocalisedText.millionSuffixAmount = LocalisedText.millionSuffix = LocalisedText.englishMillionSuffixAmount;
        LocalisedText.thousandsSuffix = LocalisedText.thousandsSuffix2 = LocalisedText.englishThousandsSuffix2;
        let row = 0;
        for (const language of languages) {
            LocalisedText.setLanguage(language);
            for (const count of numbers) {
                const widget = Client.NiceNumber(count),
                    icon = ObjType.InvNumber(count);
                expect(Buffer.from(widget.toBytes()).toString('hex') + ' ' + Buffer.from(icon.toBytes()).toString('hex')).toBe(lines[row++]);
            }
        }
        expect(row).toBe(lines.length);
    } finally {
        for (const [key, value] of saved) Reflect.set(LocalisedText, key, value);
        rmSync(dir, { recursive: true, force: true });
    }
});
