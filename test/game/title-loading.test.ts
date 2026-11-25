import { expect } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import GameShell from '#/client/GameShell.js';
import Js5 from '#/cache/Js5.js';
import Js5Index from '#/cache/Js5Index.js';
import { fromJsString } from '#/datastruct/JagString.js';
import Pix2D from '#/graphics/Pix2D.js';
import type PixfontGeneric from '#/graphics/PixfontGeneric.js';
import SpriteLoader from '#/graphics/SpriteLoader.js';
import Crc32 from '#/io/Crc32.js';
import TitleScreen from '#/title/TitleScreen.js';
import LocalisedText from '#/ui/LocalisedText.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { readGroup } from '../cachefile.js';
import { loginFixture } from '../login-fixture.js';
import { cachePath, gamepackPath } from '../reference.js';

// The same commands are applied to the original gamepack and to the client. Index bytes, compressed sprite
// groups and compressed glyph/metrics groups come straight from the disk cache. The reference does its own
// JS5 name lookup, font creation and drawing. No framebuffer produced by the port is supplied to the JVM.
const steps: [string, string][] = [
    ['init', 'init'],
    ['viewport', 'screen 765 503'],
    ['frame', 'frame 765 503 384796'],
    ['seed', 'seed'],
    ['archive', 'archive all'],
    ['initial-open', 'open cache'],
    ['repeat-open', 'open null'],
    ['draw-true', 'draw 1 -1 37 font'],
    ['dirt', 'seed'],
    ['draw-false', 'draw 0 -1 37 font'],
    ['repair-dirt', 'draw 1 -1 37 font'],
    ['different-viewport', 'screen 513 337'],
    ['clip', 'clip 62 46 410 260'],
    ['open-with-clip', 'open null'],
    ['shadow', 'draw 1 12632256 0 font'],
    ['bar-empty', 'draw 0 0 -2 font'],
    ['bar-end', 'draw 0 0 100 font'],
    ['overfilled', 'draw 0 -1 107 font'],
    ['null-heading', 'text heading'],
    ['skip-heading', 'draw 1 -1 37 font'],
    ['null-status', 'text status'],
    ['skip-status', 'draw 1 -1 37 font'],
    ['restore-text', 'text both'],
    ['null-font-partial', 'draw 0 0 1 null'],
    ['null-font-full', 'draw 1 0 1 null'],
    ['close', 'close'],
    ['close-again', 'close'],
    ['closed-full', 'draw 1 0 99 font'],
    ['closed-partial', 'draw 0 0 99 font'],
    ['closed-null-archive', 'open null'],
    ['no-background', 'archive back'],
    ['missing-background', 'open cache'],
    ['no-logo', 'archive logo'],
    ['missing-logo', 'open cache'],
    ['close-after-failure', 'close'],
    ['null-after-failure', 'open null'],
    ['font-after-failure', 'draw 0 0 30 font'],
    ['fail-on-logo-redraw', 'draw 1 0 30 font'],
    ['bad-background-bytes', 'archive corrupt-back'],
    ['corrupt-background', 'open cache'],
    ['bad-logo-bytes', 'archive corrupt-logo'],
    ['corrupt-logo', 'open cache'],
    ['no-sprite-index', 'archive no-index'],
    ['missing-index', 'open cache'],
    ['cache-recovered', 'archive all'],
    ['open-after-failure', 'open cache'],
    ['close-recovered', 'close'],
    ['short-frame', 'frame 7 11 17'],
    ['short-seed', 'seed'],
    ['short-fault', 'open cache'],
    ['null-frame', 'frame 10 11 -1'],
    ['null-frame-fault', 'open null'],
    ['close-null-frame', 'close']
];

function packed(archive: number, group: number): Uint8Array {
    return readGroup(cachePath, archive, group);
}

function index(archive: number): Js5Index {
    const bytes = packed(255, archive);
    return new Js5Index(bytes, Crc32.prefix(bytes, bytes.length));
}

function runOracle(directory: string): string[] {
    const names = new Js5(
        {
            index: () => index(8),
            group: () => null,
            prefetchGroup() {},
            GetGroupLoadPercentage: () => 100
        },
        true,
        true
    );
    const groups = ['titlebg', 'logo', 'b12_full'].map(name => names.GetGroupId(fromJsString(name)));
    for (const [archive, group] of [[255, 8], [255, 13], ...groups.map(group => [8, group]), [13, groups[2]]]) {
        writeFileSync(join(directory, archive + '-' + group), packed(archive, group));
    }
    execFileSync('javac', ['-cp', gamepackPath, '-d', directory, join(import.meta.dir, 'title-loading', 'TitleLoadingOracle.java')]);
    const output = execFileSync('java', ['-Xmx384m', '-Djava.awt.headless=true', '-cp', directory + delimiter + gamepackPath, 'TitleLoadingOracle', directory], { input: steps.map(([, s]) => s).join('\n') + '\n', encoding: 'utf8' });
    return output
        .trimEnd()
        .split(/\r?\n/)
        .map(line => line.trimEnd());
}

function pixelHash(): string {
    if (Pix2D.pixels === null) return '-';
    const bytes = Buffer.alloc(Pix2D.pixels.length * 4);
    for (let i = 0; i < Pix2D.pixels.length; i++) bytes.writeInt32BE(Pix2D.pixels[i], i * 4);
    return createHash('sha256').update(bytes).digest('hex');
}

loginFixture(
    import.meta.url,
    'title loading lifecycle and clipped progress redraw match the original gamepack',
    async () => {
        const directory = mkdtempSync(join(tmpdir(), 'rs530-title-loading-'));
        try {
            const expected = runOracle(directory);
            expect(expected.length).toBe(steps.length);
            const trace = new Map(steps.map(([label], i) => [label, expected[i].split(' ')]));
            const at = (label: string) => requireNonNull(trace.get(label));
            // Check the Java witness before executing any title method from the TypeScript client.
            expect(at('initial-open').slice(0, 4)).toEqual(['ok', '1', '1', '2']);
            expect(at('repeat-open')).toEqual(at('initial-open').slice(0, 6));
            expect(at('draw-true')[5]).toBe(at('repair-dirt')[5]);
            expect(at('draw-false')[5]).not.toBe(at('draw-true')[5]);
            expect(at('missing-background').slice(0, 4)).toEqual(['null', '0', '0', '0']);
            expect(at('missing-logo').slice(0, 4)).toEqual(['null', '0', '3', '0']);
            expect(at('close-after-failure').slice(0, 4)).toEqual(['ok', '0', '3', '0']);
            expect(at('corrupt-background').slice(0, 4)).toEqual(['bounds', '0', '3', '0']);
            expect(at('corrupt-logo').slice(0, 4)).toEqual(['bounds', '0', '4', '0']);
            expect(at('missing-index').slice(0, 4)).toEqual(['null', '0', '0', '0']);
            expect(at('skip-heading')[5]).not.toBe(at('skip-status')[5]);
            expect(at('short-fault')[0]).toBe('bounds');
            expect(at('null-frame-fault')[0]).toBe('null');
            expect(at('short-fault')[5]).toBe(
                createHash('sha256')
                    .update(Buffer.alloc(17 * 4))
                    .digest('hex')
            );

            const seen = new Map<object, number>();
            const identity = (object: object | null): number => {
                if (object === null) return 0;
                if (!seen.has(object)) seen.set(object, seen.size + 1);
                return requireNonNull(seen.get(object));
            };
            let reads = '';
            let missing = -1;
            let corrupt = -1;
            let noIndex = false;
            let archive: Js5 | null = null;
            let font: PixfontGeneric | null = null;
            const makeArchive = (id: number): Js5 =>
                new Js5(
                    {
                        index() {
                            reads += 'i' + id + '/';
                            return noIndex ? null : index(id);
                        },
                        group(_mode, group) {
                            reads += 'g' + id + '.' + group + '.' + Number(TitleScreen.m_open) + '.' + identity(TitleScreen.m_titleBack) + '.' + identity(TitleScreen.m_logo) + '.' + pixelHash() + '/';
                            if (group === missing) return null;
                            if (group === corrupt) return Uint8Array.of(0, 0, 0, 0, 2, 0, 1);
                            return packed(id, group);
                        },
                        prefetchGroup(group) {
                            throw new Error('prefetch ' + group);
                        },
                        GetGroupLoadPercentage(group) {
                            throw new Error('percentage ' + group);
                        }
                    },
                    true,
                    true
                );
            for (const [i, [label, line]] of steps.entries()) {
                const [cmd, a, b, c, d] = line.split(' ');
                reads = '';
                let outcome = 'ok';
                try {
                    switch (cmd) {
                        case 'init': {
                            const glyphs = makeArchive(8);
                            Client.loadTitleGroupIds(glyphs);
                            font = SpriteLoader.loadFont(glyphs, glyphs.GetGroupId(fromJsString('b12_full')), 0, makeArchive(13));
                            expect(font).not.toBeNull();
                            TitleScreen.m_loadString = fromJsString('Loading sprites - 37%');
                            LocalisedText.loadingPleaseWait = fromJsString('Loading - please wait.');
                            break;
                        }
                        case 'archive':
                            missing = a === 'back' ? TitleScreen.backgroundId : a === 'logo' ? TitleScreen.logoGroup : -1;
                            corrupt = a === 'corrupt-back' ? TitleScreen.backgroundId : a === 'corrupt-logo' ? TitleScreen.logoGroup : -1;
                            noIndex = a === 'no-index';
                            archive = makeArchive(8);
                            break;
                        case 'text':
                            Reflect.set(LocalisedText, 'loadingPleaseWait', a === 'heading' ? null : fromJsString('Loading - please wait.'));
                            Reflect.set(TitleScreen, 'm_loadString', a === 'status' ? null : fromJsString('Loading sprites - 37%'));
                            break;
                        case 'screen':
                            GameShell.m_sWid = Number(a);
                            GameShell.m_sHei = Number(b);
                            break;
                        case 'frame':
                            Pix2D.setPixels(Number(c) < 0 ? null : new Int32Array(Number(c)), Number(a), Number(b));
                            break;
                        case 'seed': {
                            const pixels = requireNonNull(Pix2D.pixels);
                            for (let j = 0; j < pixels.length; j++) pixels[j] = 0x234567 ^ Math.imul(j, 83429);
                            break;
                        }
                        case 'clip':
                            Pix2D.setClipping(Number(a), Number(b), Number(c), Number(d));
                            break;
                        case 'open':
                            TitleScreen.Open(a === 'null' ? null : archive);
                            break;
                        case 'close':
                            TitleScreen.Close();
                            break;
                        case 'draw':
                            TitleScreen.m_loadPos = Number(c);
                            TitleScreen.Draw(Number(b), d === 'null' ? null : font, a === '1');
                            break;
                        default:
                            throw new Error(cmd);
                    }
                } catch (error) {
                    if (error instanceof TypeError) outcome = 'null';
                    else if (error instanceof RangeError) outcome = 'bounds';
                    else throw error;
                }
                const clip = [Pix2D.clipMinX, Pix2D.clipMinY, Pix2D.clipMaxX, Pix2D.clipMaxY].join(',');
                const actual = [outcome, Number(TitleScreen.m_open), identity(TitleScreen.m_titleBack), identity(TitleScreen.m_logo), clip, pixelHash(), reads].join(' ').trimEnd();
                expect(actual, label + ' (' + line + ')').toBe(expected[i]);
            }
        } finally {
            rmSync(directory, { recursive: true, force: true });
        }
    },
    60000
);
