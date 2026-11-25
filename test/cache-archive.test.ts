import { cachePath, gamepackPath } from './reference.js';
import { readGroup } from './cachefile.js';
import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Js5 from '#/cache/Js5.js';
import Js5Index from '#/cache/Js5Index.js';
import Js5ResourceProvider from '#/cache/Js5ResourceProvider.js';
import DirectByteArrayCopier from '#/cache/DirectByteArrayCopier.js';
import JagString from '#/datastruct/JagString.js';
import Crc32 from '#/io/Crc32.js';

function hash(bytes: Uint8Array): number {
    let value = 1;
    for (const b of bytes) value = (Math.imul(value, 31) + ((b << 24) >> 24)) | 0;
    return value;
}
class Provider extends Js5ResourceProvider {
    online = false;
    available = 0;
    calls: string[] = [];
    groups = new Map<number, Uint8Array>();
    table: Js5Index | null = null;
    onGroup: (() => void) | null = null;
    index() {
        this.calls.push('index');
        return this.online ? this.table : null;
    }
    group(mode: number, group: number) {
        this.calls.push('group:' + group + ':' + mode);
        const callback = this.onGroup;
        this.onGroup = null;
        callback?.();
        return (this.available & (1 << group)) === 0 ? null : (this.groups.get(group) ?? null);
    }
    prefetchGroup(group: number) {
        this.calls.push('prefetch:' + group);
    }
    GetGroupLoadPercentage(group: number) {
        this.calls.push('percent:' + group);
        return 30 + group;
    }
}

function slots(value: unknown): string {
    if (value === null) return '-';
    if (value instanceof Uint8Array) return 'h' + hash(value);
    if (value instanceof DirectByteArrayCopier) return 'd' + hash(value.get());
    return '[' + (value as unknown[]).map(slots).join(',') + ']';
}

class Runner {
    provider = new Provider();
    archive = new Js5(this.provider, false, false);
    oldPacked: unknown = null;
    readonly held: (Uint8Array | null)[] = [];
    run(line: string): string {
        const v = line.split(' '),
            a = Number(v[1]),
            b = Number(v[2]);
        const name = (s: string) => {
            if (s === 'null') return null;
            const bytes = Buffer.from(s, 'base64');
            return JagString.fromBytes(bytes, 0, bytes.length);
        };
        let result: unknown = 'void';
        try {
            switch (v[0]) {
                case 'open': {
                    const src = Buffer.from(v[3], 'base64');
                    this.provider = new Provider();
                    this.provider.table = new Js5Index(src, Crc32.prefix(src, src.length));
                    for (let i = 4; i < v.length; i += 2) this.provider.groups.set(Number(v[i]), Buffer.from(v[i + 1], 'base64'));
                    this.archive = new Js5(this.provider, a === 1, b === 1);
                    this.oldPacked = null;
                    this.held.length = 0;
                    Js5.strictValidation = false;
                    break;
                }
                case 'online':
                    this.provider.online = a === 1;
                    break;
                case 'noProvider':
                    this.archive = new Js5(null, false, false);
                    break;
                case 'packed':
                    this.oldPacked = this.archive['packed'];
                    this.archive['packed'] = a < 0 ? null : new Array(a).fill(null);
                    break;
                case 'oldPacked':
                    result = slots(this.oldPacked);
                    break;
                case 'unpacked':
                    this.archive['unpacked'] = a < 0 ? null : new Array(a).fill(null);
                    break;
                case 'row':
                    arrayPut(this.archive['unpacked'], a, new Array(b).fill(null));
                    break;
                case 'swapIds':
                    this.provider.onGroup = () => {
                        requireNonNull(this.provider.table).groupIds = Int32Array.from(v.slice(1).map(Number));
                    };
                    break;
                case 'swapPacked':
                    this.provider.onGroup = () => {
                        this.oldPacked = this.archive['packed'];
                        this.archive['packed'] = a < 0 ? null : new Array(a).fill(null);
                    };
                    break;
                case 'counts':
                    requireNonNull(this.provider.table).fileCounts = Int32Array.from(v.slice(1).map(Number));
                    break;
                case 'mask':
                    this.provider.available = a;
                    break;
                case 'sparse':
                    requireNonNull(requireNonNull(this.provider.table).sparseFileIds)[a] = Int32Array.from(v.slice(2).map(Number));
                    break;
                case 'strict':
                    Js5.strictValidation = a === 1;
                    break;
                case 'capacity':
                    result = this.archive.GetGroupIdLimit();
                    break;
                case 'checksum':
                    result = this.archive.GetIndexCrc();
                    break;
                case 'gc':
                    result = this.archive.GetFileIdLimit(a);
                    break;
                case 'ids':
                    result = this.archive.GetFileList(a);
                    break;
                case 'named':
                    result = this.archive.GetGroupId(name(v[1]));
                    break;
                case 'contains':
                    result = this.archive.containsGroup(name(v[1]), b);
                    break;
                case 'prefetch':
                    this.archive.UpdateCacheHint2(name(v[1]));
                    break;
                case 'np':
                    result = this.archive.GetGroupLoadPercentage2(name(v[1]), v.length > 2 ? b : -19579);
                    break;
                case 'percent':
                    result = this.archive.GetDataPercent(a);
                    break;
                case 'all':
                    result = this.archive.RequestFullDownload();
                    break;
                case 'gr':
                    result = this.archive.RequestGroupDownload(a);
                    break;
                case 'fr':
                    result = this.archive.RequestDownload(true, a, b);
                    break;
                case 'ngr':
                    result = this.archive.RequestGroupDownload2(name(v[1]));
                    break;
                case 'nfr':
                    result = this.archive.RequestDownload3(name(v[2]), name(v[1]));
                    break;
                case 'namedFile':
                    result = this.archive.GetFile3(name(v[2]), name(v[1]));
                    break;
                case 'single':
                    result = this.archive.GetFile2(a);
                    break;
                case 'sr':
                    result = this.archive.RequestDownload2(a);
                    break;
                case 'file':
                    result = this.archive.GetFile(b, a);
                    break;
                case 'key':
                    result = this.archive.FetchFile(b, Int32Array.from(v.slice(3).map(Number)), a);
                    break;
                case 'peek':
                    result = this.archive.PeekFile(a, b);
                    break;
                case 'hold':
                    this.held[a] = v[4] === 'get' ? this.archive.GetFile(Number(v[3]), b) : this.archive.PeekFile(b, Number(v[3]));
                    break;
                case 'same':
                    result = this.held[a] === this.held[b];
                    break;
                case 'poke':
                    requireNonNull(this.held[a])[b] = Number(v[3]);
                    break;
                case 'held':
                    result = this.held[a];
                    break;
                case 'fileHashes':
                    result = Array.from(requireNonNull(this.archive.GetFileList(a)), id => hash(requireNonNull(this.archive.PeekFile(a, id)))).join(',');
                    break;
                case 'discard':
                    this.archive.DiscardFiles(a);
                    break;
                case 'clear':
                    this.archive.DiscardAllFiles();
                    break;
                case 'names':
                    this.archive.discardNames(a === 1, b === 1);
                    break;
                default:
                    throw new Error('Unknown archive command');
            }
        } catch (e) {
            if (e instanceof WrappedException && e.context?.startsWith('T3 - ')) result = e.context;
            else if (e instanceof TypeError) result = 'null';
            else if (e instanceof RangeError && /^(?:byte array|array|XTEA key) index /.test(e.message)) result = 'bounds';
            else result = 'threw';
        }
        if (result instanceof Uint8Array) result = 'bytes' + hash(result);
        if (result instanceof Int32Array) result = '[' + Array.from(result).join(', ') + ']';
        const table = this.archive['index'];
        const names = table ? [table.fileNames, table.fileNameHashes, table.groupNames, table.groupNameHashes].map(x => (x === null ? '0' : '1')).join('') : '-';
        const calls = this.provider.calls.join(',');
        this.provider.calls = [];
        return [String(result), calls, names, slots(this.archive['packed']), slots(this.archive['unpacked'])].join('|');
    }
}

function commands(): string[] {
    const buf = (data: Uint8Array) => Buffer.from(data).toString('base64');
    const n = (value: number) => buf(Uint8Array.of(value));
    const type0 = (bytes: Uint8Array) => {
        const header = Buffer.alloc(5);
        header.writeInt32BE(bytes.length, 1);
        return Buffer.concat([header, bytes]);
    };
    function ref(groups: { id: number; files: number[]; hash: number; names: number[] }[], named = true) {
        const bytes = [5, named ? 1 : 0];
        const p2 = (n: number) => bytes.push(n >>> 8, n & 255);
        const p4 = (n: number) => bytes.push(n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255);
        p2(groups.length);
        let prev = 0;
        for (const g of groups) {
            p2(g.id - prev);
            prev = g.id;
        }
        if (named) for (const g of groups) p4(g.hash);
        for (const g of groups) p4(g.id);
        for (const g of groups) p4(g.id + 1);
        for (const g of groups) p2(g.files.length);
        for (const g of groups) {
            let prev = 0;
            for (const f of g.files) {
                p2(f - prev);
                prev = f;
            }
        }
        if (named) for (const g of groups) for (const h of g.names) p4(h);
        return buf(type0(Uint8Array.from(bytes)));
    }
    const multi = [
        { id: 1, files: [1, 3], hash: 224, names: [97, 223] },
        { id: 3, files: [0], hash: 215, names: [254] },
        { id: 4, files: [], hash: 122, names: [] }
    ];
    const groups = ref(multi),
        only = ref([{ id: 0, files: [1, 3], hash: 224, names: [97, 223] }]);
    const stripe = buf(type0(Uint8Array.of(2, 4, 8, 10, 15, 20, 25, 30, 0, 0, 0, 3, 0, 0, 0, 2, 1)));
    const big = buf(type0(Uint8Array.from({ length: 137 }, (_, i) => i)));
    const out: string[] = [];
    for (const pack of [0, 1])
        for (const unpack of [0, 1]) {
            out.push(['open', pack, unpack, groups, 1, stripe, 3, big, 4, buf(type0(new Uint8Array(0)))].join(' '));
            out.push('capacity', 'checksum', 'clear', 'names 1 1', 'gc 1', 'all', 'fr 1 3', 'gr 1', 'ids 1', 'single 3', 'sr 3', 'percent 0', 'named ' + n(192), 'namedFile ' + n(192) + ' ' + n(65));
            out.push('online 1', 'capacity', 'checksum', 'gc 4', 'ids 1', 'ids 3', 'ids 4', 'named ' + n(192), 'named ' + n(247), 'named ' + n(90), 'contains ' + n(90) + ' 0', 'contains ' + n(247) + ' -1', 'contains ' + n(192) + ' 2');
            out.push('prefetch ' + n(192), 'prefetch ' + n(247), 'np ' + n(192), 'percent 0', 'percent 200', 'all', 'ngr ' + n(192), 'nfr ' + n(192) + ' ' + n(65), 'mask 2', 'all', 'percent 0', 'np ' + n(192));
            out.push(
                'namedFile ' + n(192) + ' ' + n(65),
                'fr 1 0',
                'namedFile ' + n(192) + ' ' + n(223),
                'namedFile ' + n(192) + ' ' + n(214),
                'file 1 0',
                'file 1 4',
                'peek 1 1',
                'peek 1 3',
                'discard 1',
                'mask 26',
                'all',
                'file 3 0',
                'peek 3 0',
                'single 3',
                'sr 1',
                'single 1',
                'clear',
                'discard 4'
            );
            out.push(
                'strict 1',
                'gr -1',
                'gc 4',
                'fr 1 4',
                'named ' + n(90),
                'namedFile ' + n(192) + ' ' + n(120),
                'strict 0',
                'names 1 0',
                'namedFile ' + n(192) + ' ' + n(65),
                'named ' + n(192),
                'names 0 1',
                'contains ' + n(192) + ' 0',
                'prefetch ' + n(192)
            );
        }
    // Real al peeks, reads and discards with escaped file references. Two stripes
    // split empty, ordinary and direct-store files, including a file larger than a page.
    const lengths = [0, 0, 11, 23, 136, 137, 3913, 63, 4111, 19];
    const fileIds = lengths.map((_, i) => 2 * i);
    const directory = ref([{ id: 0, files: fileIds, hash: 0, names: [] }], false);
    const body: number[] = [];
    const footer = Buffer.alloc(8 * lengths.length);
    for (let stripeIndex = 0; stripeIndex < 2; stripeIndex++) {
        let previous = 0;
        lengths.forEach((length, i) => {
            const halfway = length >> 1;
            const start = stripeIndex === 0 ? 0 : halfway;
            const end = stripeIndex === 0 ? halfway : length;
            footer.writeInt32BE(end - start - previous, 4 * (stripeIndex * lengths.length + i));
            previous = end - start;
            for (let j = start; j < end; j++) body.push((i * 17 + j) & 255);
        });
    }
    const group = buf(type0(Buffer.concat([Uint8Array.from(body), footer, Uint8Array.of(2)])));
    for (const packed of [0, 1])
        for (const unpacked of [0, 1]) {
            out.push(`open ${packed} ${unpacked} ${directory} 0 ${group}`, 'online 1', 'mask 1');
            for (let i = 0; i < fileIds.length; i++) {
                out.push(`hold ${i} 0 ${fileIds[i]} peek`, `hold 10 0 ${fileIds[i]} peek`, `same ${i} 10`);
                if (i > 0) out.push(`same ${i - 1} ${i}`);
                if (lengths[i] > 0) out.push(`poke ${i} 0 207`, `poke ${i} ${lengths[i] - 1} 254`, 'held 10');
            }
            out.push('hold 11 0 4 get', 'same 2 11', 'hold 12 0 6 peek', 'same 3 12', 'hold 13 0 4 peek', 'same 2 13', 'hold 14 0 6 peek', 'same 3 14');
            out.push('discard 0', 'hold 15 0 4 peek', 'same 2 15', 'clear', 'hold 16 0 4 peek', 'same 15 16', 'poke 2 0 31');
            for (let i = 0; i < 17; i++) out.push('held ' + i);
        }
    out.push('open 1 1 ' + only + ' 0 ' + stripe, 'online 1', 'mask 1', 'sr 0', 'single 1', 'single 3', 'key 0 3 0 0 0 0', 'discard 0', 'key 0 3 0 0', 'key 0 3 0 0 0 0', 'all', 'percent 0');
    out.push('open 1 0 ' + ref([]), 'online 1', 'all', 'percent 0', 'percent 1', 'capacity', 'gc 0');
    out.push('open 1 1 ' + ref(multi, false) + ' 1 ' + buf(type0(new Uint8Array(0))), 'online 1', 'mask 2', 'named ' + n(192), 'file 1 1', 'fr 1 1', 'peek 1 3', 'all');
    out.push('open 0 0 ' + groups + ' 3 ' + buf(Uint8Array.of(0, 0, 0, 0, 9, 1, 2)), 'online 1', 'mask 8', 'single 3', 'key 3 0 0 0 0 0', 'gr 3');
    for (const keep of [0, 1]) {
        for (const sparse of ['0 -1', '1 9', '4 1', '1', '']) {
            out.push('open ' + keep + ' 0 ' + only + ' 0 ' + stripe, 'online 1', 'mask 1', ('sparse 0 ' + sparse).trimEnd(), 'key 0 1 0 0 0 0', 'peek 0 1', 'sparse 0 1 3', 'file 0 3');
        }
    }
    for (const keep of [0, 1]) {
        const open = 'open ' + keep + ' 0 ' + groups + ' 1 ' + stripe + ' 3 ' + big;
        for (const ids of ['1', '1 99', '1 3 1']) {
            out.push(open, 'online 1', 'mask 10', 'swapIds ' + ids, 'all', 'all');
        }
        for (const size of [-1, 0, 1, 2, 5]) {
            for (const read of ['all', 'gr 1', 'fr 1 0', 'peek 1 1', 'file 1 1']) {
                out.push(open, 'online 1', 'mask 10', 'swapPacked ' + size, read, 'oldPacked', 'np ' + n(192));
            }
            out.push(open, 'online 1', 'capacity', 'packed ' + size, 'gr 1', 'np ' + n(192), 'percent 0', 'oldPacked');
            out.push(open, 'online 1', 'capacity', 'unpacked ' + size, 'row 1 0', 'fr 1 0', 'file 1 0', 'peek 1 0', 'discard 1');
        }
        out.push(open, 'online 1', 'capacity', 'counts 0 1', 'percent 0', 'np null -9', 'np ' + n(192) + ' -9', 'prefetch null', 'ngr null');
    }
    for (const [archive, group] of [
        [22, 0],
        [22, 3],
        [2, 3],
        [16, 0]
    ]) {
        const table = buf(readGroup(cachePath, 255, archive));
        const raw = buf(readGroup(cachePath, archive, group));
        out.push(`open ${archive === 2 ? 1 : 0} ${archive === 2 ? 0 : 1} ${table} ${group} ${raw}`, 'online 1', 'mask ' + (1 << group), 'fileHashes ' + group);
    }
    out.push('noProvider', 'capacity', 'all', 'clear', 'names 0 0', 'prefetch null', 'ngr null');
    return out;
}

test('every al archive operation matches Java results, provider calls, name tables and retained byte storage', () => {
    const directory = mkdtempSync(join(tmpdir(), 'js5-archive530-'));
    const jar = gamepackPath;
    const src = fileURLToPath(new URL('./cache/ArchiveOracle.java', import.meta.url));
    const script = commands();
    try {
        const compiled = Bun.spawnSync(['javac', '-classpath', jar, '-d', directory, src], { timeout: 15000 });
        expect(compiled.stderr.toString()).toBe('');
        expect(compiled.exitCode).toBe(0);
        const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', directory + delimiter + jar, 'ArchiveOracle'], { stdin: Buffer.from(script.join('\n')), timeout: 15000 });
        expect(java.stderr.toString()).toBe('');
        expect(java.exitCode).toBe(0);
        const lines = java.stdout.toString().trimEnd().split(/\r?\n/);
        expect(lines).toHaveLength(script.length);
        const runner = new Runner();
        script.forEach((line, i) => expect(runner.run(line), i + ' ' + line).toBe(lines[i]));
    } finally {
        Js5.strictValidation = false;
        rmSync(directory, { recursive: true, force: true });
    }
}, 32000);

test('stock varbit files occupy disjoint bounded views within one JS5 group and unpack generation', () => {
    const provider = new Provider();
    const table = readGroup(cachePath, 255, 22);
    provider.table = new Js5Index(table, Crc32.prefix(table, table.length));
    provider.online = true;
    provider.available = 9;
    const archive = new Js5(provider, false, true);
    const previousPages = new Set<ArrayBufferLike>();
    for (const group of [0, 3, 0]) {
        provider.groups.set(group, readGroup(cachePath, 22, group));
        const pages = new Map<ArrayBufferLike, number>();
        const ids = requireNonNull(archive.GetFileList(group));
        for (const id of ids) {
            const view = requireNonNull(archive.PeekFile(group, id));
            expect(previousPages.has(view.buffer)).toBe(false);
            expect(view.byteOffset).toBeGreaterThanOrEqual(pages.get(view.buffer) ?? 0);
            expect(view.buffer.byteLength).toBeLessThanOrEqual(Math.max(4096, view.byteLength));
            pages.set(view.buffer, view.byteOffset + view.byteLength);
        }
        expect(pages.size).toBeLessThan(ids.length);
        for (const backing of pages.keys()) previousPages.add(backing);
        archive.DiscardFiles(group);
    }
});
import WrappedException from '#/util/WrappedException.js';
import { arrayPut, requireNonNull } from '#/util/JavaArray.js';
