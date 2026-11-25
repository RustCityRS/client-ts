import { expect, test } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gamepackPath } from '../reference.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';
import { requireNonNull } from '#/util/JavaArray.js';

test('Chrome draws the early progress screen pixel for pixel like both original gamepacks', async () => {
    const retained = process.env.RS530_PROGRESS_CAPTURE;
    const dir = retained ?? mkdtempSync(join(tmpdir(), 'rs530-progress-'));
    mkdirSync(dir, { recursive: true });
    const profile = mkdtempSync(join(tmpdir(), 'rs530-progress-chrome-'));
    try {
        const heading = 'RuneScape is loading - please wait...';
        const stages: [string, string, number, boolean, number][] = [
            [heading, 'Allocating memory', 5, true, 1],
            [heading, 'Allocating memory', 5, false, 45],
            [heading, 'Allocated memory', 5, false, 1],
            [heading, 'Connecting to update server', 20, false, 5],
            ['RuneScape wird geladen - bitte warten...', 'Speicher wird reserviert.', 5, true, 2],
            ['Chargement de RuneScape en cours...', 'Mémoire allouée.', 5, true, 2]
        ];
        const script = join(dir, 'stages.tsv');
        writeFileSync(script, stages.map(([heading, message, pos, clear, repeats]) => [heading, message, pos, +clear, repeats].join('\t')).join('\n'));
        const compile = Bun.spawnSync(['javac', '-encoding', 'UTF-8', '-d', dir, join(import.meta.dir, '../game/ProgressPixelsOracle.java')]);
        expect(compile.exitCode, compile.stderr.toString()).toBe(0);
        for (const [id, jar] of [
            ['sd', gamepackPath],
            ['hd', hdGamepackPath]
        ]) {
            const run = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', [dir, jar, joglPath].join(delimiter), 'ProgressPixelsOracle', id, dir, script]);
            expect(run.exitCode, run.stderr.toString()).toBe(0);
        }
        const built = await Bun.build({ entrypoints: [join(import.meta.dir, 'loading-screen.browser.ts')], target: 'browser', format: 'esm', define: { 'process.env.RS530_GAMEPACK_IDENTITY': '"gl"' } });
        expect(built.success, built.logs.map(v => v.message).join('\n')).toBe(true);
        const page = join(dir, 'screen.html');
        const module = (await built.outputs[0].text()).replace(/<\/script/gi, '<\\/script');
        writeFileSync(
            page,
            '<!doctype html><meta charset="utf-8"><canvas width="765" height="503"></canvas><pre id="result"></pre>' +
                '<script id="stages" type="application/json">' +
                JSON.stringify(stages) +
                '</script><script id="runner" type="module">' +
                'document.getElementById("runner").remove();\n' +
                module +
                '</script>'
        );
        const chrome = [process.env.CHROME_BIN, Bun.which('google-chrome'), Bun.which('chromium'), join(process.env.PROGRAMFILES ?? '', 'Google/Chrome/Application/chrome.exe')].find(v => v && existsSync(v));
        if (!chrome) throw new Error('Chrome is required for the browser startup pixel comparison');
        const browser = Bun.spawnSync([chrome, '--headless=new', '--disable-gpu', '--disable-extensions', '--no-first-run', '--disable-sync', '--disable-background-networking', '--dump-dom', '--user-data-dir=' + profile, pathToFileURL(page).href], {
            maxBuffer: 3 * 1024 * 1024,
            timeout: 30000
        });
        expect(browser.exitCode, browser.stderr.toString()).toBe(0);
        const result = browser.stdout.toString().match(/<pre id="result">(\[.*?\])<\/pre>/s);
        expect(result, browser.stderr.toString()).toBeTruthy();
        const frames = JSON.parse(requireNonNull(result)[1]) as string[];
        expect(frames.length).toBe(stages.length);
        for (const [i, frame] of frames.entries()) writeFileSync(join(dir, 'browser-' + i + '.png'), Buffer.from(frame.split(',')[1], 'base64'));
        const compare = Bun.spawnSync(['java', '-cp', dir, 'ProgressPixelsOracle', 'compare', dir, String(frames.length)]);
        expect(compare.exitCode, compare.stderr.toString()).toBe(0);
        expect(compare.stdout.toString().trim().split(/\r?\n/)).toEqual(stages.map((_, i) => i + ' 0 0 0'));
    } finally {
        rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
        if (!retained) rmSync(dir, { recursive: true, force: true });
    }
}, 60000);
