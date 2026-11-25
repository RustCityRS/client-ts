import { expect } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Js5 from '#/cache/Js5.js';
import Js5Index from '#/cache/Js5Index.js';
import { fromJsString } from '#/datastruct/JagString.js';
import LRUHashCache from '#/datastruct/LRUHashCache.js';
import type AbstractIndexedSprite from '#/graphics/AbstractIndexedSprite.js';
import Pix8 from '#/graphics/Pix8.js';
import PixfontGeneric from '#/graphics/PixfontGeneric.js';
import SpriteLoader from '#/graphics/SpriteLoader.js';
import Crc32 from '#/io/Crc32.js';
import IfType from '#/ui/IfType.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { readGroup } from '../cachefile.js';
import { loginFixture } from '../login-fixture.js';
import { cachePath, gamepackPath } from '../reference.js';

type Case = [mode: string, iconSet: number, changes: string];
function vectors(): Case[] {
    const rows: Case[] = [];
    for (const mode of ['normal', 'minus-one', 'invalid-group', 'no-cache', 'hit', 'cast', 'null-widget', 'S-noindex', 'S-missing', 'S-corrupt', 'S-null', 'M-null', 'M-noindex', 'M-missing', 'M-corrupt']) {
        for (const iconSet of [0, 1, 2, 3]) rows.push([mode, iconSet, '-']);
    }
    for (const event of ['S.i', 'S.g', 'M.i', 'M.g']) {
        for (const action of ['cache', 'no-cache', 'alt-id', 'minus-one', 'metrics', 'no-metrics', 'no-sprites', 'flag', 'icons']) {
            rows.push(['normal', 2, event + '=' + action]);
        }
    }
    for (const mode of ['normal', 'S-missing', 'M-missing', 'S-corrupt', 'M-corrupt']) {
        rows.push([mode, 2, 'S.i=metrics,S.g=alt-id,M.i=cache,M.g=flag']);
        rows.push([mode, 0, 'S.i=flag,S.g=no-metrics,M.g=minus-one']);
    }
    return rows;
}

loginFixture(
    import.meta.url,
    'aj font lookup preserves missing flag, cached identity and installed icon arrays across JS5 callbacks',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-widget-font-'));
        try {
            const bytes = (archive: number, group: number) => readGroup(cachePath, archive, group);
            const idx = (archive: number) => {
                const table = bytes(255, archive);
                return new Js5Index(table, Crc32.prefix(table, table.length));
            };
            const names = new Js5({ index: () => idx(8), group: () => null, prefetchGroup() {}, GetGroupLoadPercentage: () => 100 }, true, true);
            const font = names.GetGroupId(fromJsString('b12_full')),
                alt = names.GetGroupId(fromJsString('p12_full'));
            for (const [archive, group] of [
                [255, 8],
                [255, 13],
                [8, font],
                [8, alt],
                [13, font],
                [13, alt]
            ]) {
                writeFileSync(join(dir, archive + '-' + group), bytes(archive, group));
            }
            const rows = vectors();
            writeFileSync(join(dir, 'cases'), rows.map(r => r.join(' ')).join('\n') + '\n');
            execFileSync('javac', ['-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'widget-font', 'WidgetFontOracle.java')]);
            const ref = execFileSync('java', ['-Xmx384m', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'WidgetFontOracle', dir, String(font), String(alt)], { encoding: 'utf8', timeout: 45000 })
                .trimEnd()
                .split(/\r?\n/);
            expect(ref.length).toBe(rows.length * 2);
            const at = (row: string) => requireNonNull(ref[2 * rows.findIndex(r => r.join(' ') === row)]).split('/');
            expect(at('minus-one 0 -').slice(0, 5)).toEqual(['ok', '0', '-1', '-1', '0']);
            expect(at('hit 0 -')[6]).toBe('3');
            expect(at('S-missing 2 -').slice(0, 2)).toEqual(['ok', '1']);
            expect(at('M-corrupt 2 -').slice(0, 2)).toEqual(['bounds', '0']);
            const icon = (width: number) => new Pix8(width, 1, 0, 0, width, 1, new Uint8Array(width), new Int32Array(1));
            const icons: ((AbstractIndexedSprite | null)[] | null)[] = [null, [], [icon(12)], [icon(31), null]];
            let widget = new IfType(),
                mode = 'normal',
                changes = '-';
            let initial = new LRUHashCache<object>(20),
                other = new LRUHashCache<object>(20);
            let alternateMetrics: Js5 | null = null;
            const seen = new Map<object, number>(),
                reads: string[] = [];
            const identity = (value: object | null): number => {
                if (value === null) return 0;
                if (!seen.has(value)) seen.set(value, seen.size + 1);
                return requireNonNull(seen.get(value));
            };
            function read(event: string): void {
                reads.push(event + '.' + Number(IfType.resourceMissing) + '.' + widget.fontId);
                for (const change of changes.split(',')) {
                    const [when, action] = change.split('=');
                    if (when !== event) continue;
                    switch (action) {
                        case 'cache':
                            Reflect.set(IfType, 'm_fontCache', other);
                            break;
                        case 'no-cache':
                            Reflect.set(IfType, 'm_fontCache', null);
                            break;
                        case 'alt-id':
                            widget.fontId = alt;
                            break;
                        case 'minus-one':
                            widget.fontId = -1;
                            break;
                        case 'metrics':
                            IfType.m_pFontMetrics = alternateMetrics;
                            break;
                        case 'no-metrics':
                            IfType.m_pFontMetrics = null;
                            break;
                        case 'no-sprites':
                            IfType.m_pSprites = null;
                            break;
                        case 'flag':
                            IfType.resourceMissing = true;
                            break;
                        case 'icons':
                            PixfontGeneric.nameIcons = icons[1];
                            break;
                        default:
                            throw new Error(change);
                    }
                }
            }
            const provider = (prefix: string, archive: number) =>
                new Js5(
                    {
                        index() {
                            read(prefix + '.i');
                            return mode === prefix + '-noindex' ? null : idx(archive);
                        },
                        group(_unused, group) {
                            read(prefix + '.g');
                            if (mode === prefix + '-missing') return null;
                            if (mode === prefix + '-corrupt') return Uint8Array.of(0, 0, 0, 0, 2, 0, 1);
                            return bytes(archive, group);
                        },
                        prefetchGroup() {
                            throw new Error('prefetch');
                        },
                        GetGroupLoadPercentage() {
                            throw new Error('percentage');
                        }
                    },
                    true,
                    true
                );
            function fresh(): void {
                IfType.m_pSprites = mode === 'S-null' ? null : provider('S', 8);
                IfType.m_pFontMetrics = mode === 'M-null' ? null : provider('M', 13);
                alternateMetrics = provider('N', 13);
            }
            const widthSample = fromJsString('<img=0>Rune');
            function call(index: number, noWidget: boolean): string {
                reads.length = 0;
                let result: PixfontGeneric | null = null,
                    fault = 'ok';
                try {
                    result = requireNonNull(noWidget ? null : widget).GetFont(icons[index]);
                } catch (error) {
                    if (error instanceof TypeError) fault = error.message.includes('ClassCastException') ? 'cast' : 'null';
                    else if (error instanceof RangeError) fault = 'bounds';
                    else throw error;
                }
                const heights = result?.['iconHeights'] ?? null;
                const state = [
                    fault,
                    +IfType.resourceMissing,
                    widget.fontId,
                    IfType.m_fontCache === null ? -1 : IfType.m_fontCache === initial ? 0 : 1,
                    identity(result),
                    icons.indexOf(PixfontGeneric.nameIcons),
                    result === null ? -1 : icons.indexOf(result['icons']),
                    result === null ? -1 : (heights?.reduce((h, v) => (Math.imul(h, 31) + v) | 0, 1) ?? 0),
                    result?.stringWidth(widthSample) ?? -1
                ];
                for (const cache of [initial, other]) for (const key of [font, alt, -1]) state.push(identity(cache.Find(BigInt(key))));
                return state.join('/') + '/' + reads.join(',');
            }
            fresh();
            const resident = requireNonNull(SpriteLoader.loadFont(IfType.m_pSprites, font, 0, IfType.m_pFontMetrics));
            for (const [i, row] of rows.entries()) {
                const [input, iconSet, changed] = row;
                mode = input;
                changes = changed;
                seen.clear();
                widget = new IfType();
                widget.fontId = mode === 'minus-one' ? -1 : mode === 'invalid-group' ? -23 : font;
                initial = new LRUHashCache<object>(20);
                other = new LRUHashCache<object>(20);
                Reflect.set(IfType, 'm_fontCache', mode === 'no-cache' || mode === 'minus-one' ? null : initial);
                resident.setNameIcons(icons[3], Int32Array.of(29, 32));
                if (mode === 'hit') initial.Put(BigInt(font), resident);
                if (mode === 'cast') initial.Put(BigInt(font), {});
                PixfontGeneric.nameIcons = icons[3];
                IfType.resourceMissing = true;
                fresh();
                expect(call(iconSet, mode === 'null-widget'), row.join(' ')).toBe(ref[i * 2]);
                mode = 'normal';
                changes = '-';
                fresh();
                if (IfType.m_fontCache === null) Reflect.set(IfType, 'm_fontCache', other);
                expect(call(1, false), row.join(' ') + ' reread').toBe(ref[i * 2 + 1]);
            }
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    60000
);
