import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import ColourImageCache, { type ColourImageRow } from '#/dash3d/ColourImageCache.js';
import ColourImageCacheEntry from '#/dash3d/ColourImageCacheEntry.js';
import MonochromeImageCache from '#/dash3d/MonochromeImageCache.js';
import MonochromeImageCacheEntry from '#/dash3d/MonochromeImageCacheEntry.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { gamepackPath } from '../reference.js';

type Scenario = { mode: 'C' | 'M'; capacity: number; height: number; width: number; ops: string[] };

function scenarios(): Scenario[] {
    const result: Scenario[] = [];
    for (const mode of ['C', 'M'] as const) {
        for (const capacity of [-1, 0, 1, 2, 3, 5])
            for (const height of [-1, 0, 1, 2, 3, 5, 7])
                for (const width of [-1, 0, 1, 4]) {
                    const add = (...ops: string[]) => result.push({ mode, capacity, height, width, ops });
                    add('g-1', 'g0', 'g1', 'g0', 'g2', 'g1', 'g3', 'g3', 'g0', 'a', 'g0', 'g2147483647', 'g-2147483648', 'c0', 'a', 'g1', 'c0');
                    if (capacity < 0 || height < 0 || width < 0) continue;
                    add('d', 'g0', 'g0', 'a', 'g0', 'e', 'g0', 'g0', 'd', 'g0', 'g0', 'a', 'g0', 'e', 'g0', 'a');
                    add('g0', 'g1', 'g2', 'g3', 'g4', 'g1', 'g2', 'g0', 'g4', 'g3', 'g0', 'g5', 'g6', 'g2', 'g1', 'a');
                    for (const start of [-1, 0, 1, capacity - 1, capacity, capacity + 1, 2147483647]) {
                        add('g0', 'g1', 'a', 'c' + start, 'g-1', 'g0', 'c0', 'g1', 'a');
                    }
                    for (let slot = 0; slot < capacity; slot++) {
                        add('g0', 'g1', 'g2', 'a', 'z' + slot, 'g' + slot, 'c0', 'g0', 'a', 'c1');
                        if (mode === 'C') add('g' + slot, 'h' + slot, 'a', 'g' + slot, 'g' + ((slot + 1) % capacity), 'c0', 'h' + slot, 'c0', 'a');
                    }
                }
    }
    return result;
}

function run({ mode, capacity, height, width, ops }: Scenario): string[] {
    let cache: ColourImageCache | MonochromeImageCache;
    try {
        cache = mode === 'C' ? new ColourImageCache(capacity, height, width) : new MonochromeImageCache(capacity, height, width);
    } catch (error) {
        if (error instanceof RangeError) return ['init:size'];
        throw error;
    }
    const result = ['init:ok'];
    // The two private fields share a TS spelling but have different JVM array types.
    const pixels = () => (cache instanceof ColourImageCache ? cache['pixels'] : cache['pixels']);
    const originalRoot = requireNonNull(pixels());
    const rows = originalRoot.map(row => requireNonNull(row));
    const channels: Int32Array[] = [];
    const identities = new Map<object, number>();
    function id(ref: object | null): number {
        if (ref === null) return 0;
        let value = identities.get(ref);
        if (value === undefined) {
            value = identities.size + 1;
            identities.set(ref, value);
        }
        return value;
    }
    id(originalRoot);
    for (const row of rows) {
        id(row);
        if (Array.isArray(row))
            for (const channel of row) {
                id(channel);
                channels.push(requireNonNull(channel));
            }
    }
    function stateHash(): number {
        let hash = 1;
        const mix = (n: number) => {
            hash = (Math.imul(hash, 31) + n) | 0;
        };
        mix(id(pixels()));
        for (const row of originalRoot) mix(id(row));
        for (const row of rows) {
            mix(id(row));
            if (row instanceof Int32Array) {
                for (const pixel of row) mix(pixel);
            } else {
                for (const channel of row) {
                    mix(id(channel));
                    if (channel !== null) for (const pixel of channel) mix(pixel);
                }
            }
        }
        for (const channel of channels) if (channel.length > 0) mix(channel[0]);
        return hash;
    }
    for (const [i, op] of ops.entries()) {
        let status = 'ok';
        const n = Number(op.slice(1));
        try {
            switch (op[0]) {
                case 'g': {
                    const row = cache.get(n);
                    status = 'id' + id(row);
                    const channel = Array.isArray(row) ? row[0] : row;
                    if (channel !== null && channel.length > 0) channel[0] = Math.imul(i + 1, -19937);
                    break;
                }
                case 'a':
                    status = 'id' + id(cache.getAll());
                    break;
                case 'c':
                    if (cache instanceof ColourImageCache) cache.clear();
                    else cache.clear(n);
                    break;
                case 'z':
                    originalRoot[n] = null;
                    break;
                case 'h': {
                    const row: ColourImageRow | Int32Array = rows[n];
                    if (!Array.isArray(row)) throw Error('h requires a colour row');
                    row[0] = null;
                    break;
                }
                case 'd':
                    if (cache instanceof ColourImageCache) ColourImageCache.residentSentinel = null;
                    else MonochromeImageCache.dummy = null;
                    break;
                case 'e':
                    if (cache instanceof ColourImageCache) ColourImageCache.residentSentinel = new ColourImageCacheEntry(0, 0);
                    else MonochromeImageCache.dummy = new MonochromeImageCacheEntry(0, 0);
                    break;
                default:
                    throw Error('Unknown operation ' + op);
            }
        } catch (error) {
            if (error instanceof TypeError) status = 'null';
            else if (error instanceof RangeError) status = 'bounds';
            else if (error instanceof Error && error.message === 'Can only retrieve a full image cache') status = 'partial';
            else throw error;
        }
        result.push(status + ':' + Number(cache.invalid) + ':' + stateHash());
    }
    return result;
}

test('530 scanline caches match colour and monochrome row identity, eviction, clear and retained pixel aliases', () => {
    const originalColour = ColourImageCache.residentSentinel,
        originalMono = MonochromeImageCache.dummy;
    const dir = mkdtempSync(join(tmpdir(), 'scanline-cache-'));
    try {
        const cc = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'ScanlineCacheOracle.java')]);
        expect(cc.exitCode, cc.stderr.toString()).toBe(0);
        const cases = scenarios();
        const lines = cases.map(row => [row.mode, row.capacity, row.height, row.width, row.ops.join(',')].join(' '));
        const jvm = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'ScanlineCacheOracle'], {
            stdin: Buffer.from(lines.join('\n') + '\n'),
            maxBuffer: 8 * 1024 * 1024
        });
        expect(jvm.exitCode, jvm.stderr.toString()).toBe(0);
        const expected = jvm.stdout.toString().trimEnd().split(/\r?\n/);
        expect(expected.length).toBe(cases.length);
        for (const [i, row] of cases.entries()) {
            if (row.mode === 'C') ColourImageCache.residentSentinel = new ColourImageCacheEntry(0, 0);
            else MonochromeImageCache.dummy = new MonochromeImageCacheEntry(0, 0);
            expect(run(row), lines[i]).toEqual(expected[i].split('|'));
        }
    } finally {
        ColourImageCache.residentSentinel = originalColour;
        MonochromeImageCache.dummy = originalMono;
        rmSync(dir, { recursive: true, force: true });
    }
}, 20000);
