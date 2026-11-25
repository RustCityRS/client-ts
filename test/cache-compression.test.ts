import { requireNonNull } from '#/util/JavaArray.js';
import { cachePath, gamepackPath } from './reference.js';
import { test, expect } from 'bun:test';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'fflate';
import BZip2Decompressor from '#/cache/BZip2Decompressor.js';
import BzipOutputWasm from '#/cache/BzipOutputWasm.js';
import BZip2State from '#/cache/BZip2State.js';
import Js5Compression from '#/cache/Js5Compression.js';
import RawInflater from '#/cache/RawInflater.js';
import Js5 from '#/cache/Js5.js';
import PacketT from '#/io/PacketT.js';
import { readGroup } from './cachefile.js';
import { hdGamepackPath } from './render/hd-reference.js';

function bzipState(): string {
    const state = requireNonNull(BZip2Decompressor['state']);
    const hash = createHash('sha256'),
        word = Buffer.alloc(4);
    function put(n: number): void {
        word.writeInt32BE(n);
        hash.update(word);
    }
    function array(values: Int8Array | Uint8Array | Int32Array | (Int32Array | Int8Array)[] | null): void {
        put(values?.length ?? -1);
        if (!values) return;
        if (Array.isArray(values)) {
            for (const row of values) array(row);
        } else if (values instanceof Int32Array) {
            const bytes = Buffer.alloc(4 * values.length);
            for (let i = 0; i < values.length; i++) bytes.writeInt32BE(values[i], 4 * i);
            hash.update(bytes);
        } else hash.update(values);
    }
    for (const n of [
        state.repeatCount,
        state.blockPos,
        state.blockUsed,
        state.blockLength,
        state.outputRemaining,
        state.lastByte,
        state.liveBits,
        state.currentByte,
        state.nextInput,
        state.blockSize100k,
        state.outputTotal,
        state.symbolCount,
        state.bitBuffer,
        state.inputTotal,
        state.originalPointer,
        state.nextOutput
    ])
        put(n);
    for (const value of [
        state.symbols,
        state.limits,
        state.codeLengths,
        state.minLengths,
        state.groupsInUse,
        state.frequencies,
        state.bases,
        state.inUse,
        state.input,
        state.selectors,
        state.output,
        state.mtfBases,
        state.permutations,
        state.selectorMtf,
        state.mtfBytes,
        state.cumulative,
        BZip2Decompressor['block']
    ])
        array(value);
    return hash.digest('hex');
}

type Case = { label: string; mode: 'b' | 'g' | 'c' | 'x' | 'nullCodec' | 'restoreCodec' | 'nullInput'; source: Uint8Array; output: number; length: number; offset: number; packed: number; max: number };
function fixtures(): Case[] {
    const cases: Case[] = [];
    function add(label: string, mode: Case['mode'], source: Uint8Array, output = 0, length = output, offset = 0, packed = source.length, max = 0) {
        cases.push({ label, mode, source, output, length, offset, packed, max });
    }
    function wrap(type: number, data: Uint8Array, size: number, packed = data.length): Uint8Array {
        const header = Buffer.alloc(type === 0 ? 5 : 9);
        header.writeUInt8(type);
        header.writeInt32BE(packed, 1);
        if (type !== 0) header.writeInt32BE(size, 5);
        return Buffer.concat([header, data]);
    }
    const empty = new Uint8Array(0);
    // R-018 reaches rd.c's isub with code = INT_MIN and base[32] = INT_MAX - 1.
    add('signed permutation index wraps to 2', 'b', Buffer.from('MQAAAAAAAAAAAAAAAEAAf8AQACCqqqqqqqUkkkp//+gAAAABcAAAAAA=', 'base64'), 1);
    // Python bz2.compress(data, compresslevel=1), with the four-byte BZh1 prefix omitted as on disk.
    // The first stream expands to 215000 bytes cycling through 0..6 and spans three blocks.
    const multi = Buffer.from('MUFZJlNZZI/SZAAb5UAAfwAgAFCGAE1UDTCUCaJQJslAnCUCdJQJ4lAmEoE+YoKyTKayyR+kyAA3yoAA/gBAAKEMAJqoGmEoE0SgTZKBOEoE6SgTxKBMJQJ8xQVkmU1nrc0M0AAQyQAB/ACAAUIYAKVNA8RQZkig0RQbIoOEUHSKDxFB8XckU4UJCwU65tA=', 'base64');
    const repeated = Buffer.from('MUFZJlNZ7FaS2QAD04AAoAigADDMBSmmBC1QW8XckU4UJDsVpLZA', 'base64');
    for (const count of [0, 1, 5, 99980, 99981, 99982, 100000, 200000, 215000, 215011]) add('multiblock cutoff ' + count, 'b', multi, count);
    for (const count of [0, 1, 2, 3, 4, 258, 259, 260, 99950, 99999]) add('run of 0xff cutoff ' + count, 'b', repeated, count);
    const reference = readGroup(cachePath, 255, 16);
    expect(reference[0]).toBe(1);
    const size = Buffer.from(reference).readInt32BE(5);
    add('original reference (packed length argument ignored)', 'b', reference, size, size, 9, -17);
    // These groups were requested during the first visible East Ardougne market frames.
    for (const [archive, groups] of [
        [0, [1238, 1662, 2183, 2398]],
        [8, [455, 494, 498, 591, 1396, 1407]],
        [13, [494, 591]],
        [20, [2, 36, 38, 49, 51, 53, 80]]
    ] as const) {
        for (const group of groups) {
            const packed = readGroup(cachePath, archive, group);
            expect(packed[0]).toBe(1);
            const length = Buffer.from(packed).readInt32BE(5);
            add('East market group ' + archive + '/' + group, 'b', packed, length, length, 9);
        }
    }
    add('truncated first header', 'b', multi.subarray(0, 10), 9);
    add('truncated first tables', 'b', multi.subarray(0, 24), 9);
    add('truncated third block', 'b', multi.subarray(0, 120), 215000);
    add('bad destination capacity', 'b', repeated, 2, 9);
    add('negative input offset', 'b', multi, 8, 8, -1);
    add('empty input', 'b', empty, 8);
    add('end marker only', 'b', Uint8Array.of(23), 8);
    const ignored = Buffer.from(repeated);
    ignored.fill(0xee, 0, 10);
    ignored[10] ^= 128;
    add('ignored block header, block checksum and randomised bit', 'b', ignored, 99950);
    const pointer = Buffer.from(repeated);
    pointer.set([127, 255, 255], 10);
    add('invalid original pointer', 'b', pointer, 99950);
    add('reuse after invalid pointer', 'b', multi, 6);
    for (const bit of [1, 4, 128]) {
        for (let i = 0; i < repeated.length; i++) {
            const corrupt = Buffer.from(repeated);
            corrupt[i] ^= bit;
            add('BZip2 bit ' + bit + ' at byte ' + i, 'b', corrupt, 65);
        }
    }
    const data = Uint8Array.from({ length: 4096 }, (_, i) => (i * 19) ^ (i >> 3));
    const gzip = gzipSync(data, { mtime: 0 });
    add('invalid gzip header before init', 'g', Uint8Array.of(0), 4);
    add('gzip header truncated after magic', 'g', Uint8Array.of(31, 139), 4);
    for (const output of [0, 1, 3, 7, 255, 256, 257, 258, 4095, 4096, 4150]) add('bounded inflate ' + output, 'g', gzip, output);
    const trailing = Buffer.concat([gzip, Uint8Array.of(55, 19, 2, 88, 9)]);
    add('trailing bytes', 'g', trailing, 5000);
    add('packet cursor nonzero', 'g', Buffer.concat([Uint8Array.of(7, 8, 9), gzip]), 5000, 5000, 3);
    const bad = gzip.slice();
    bad.fill(193, -8);
    add('trailer CRC/ISIZE ignored', 'g', bad, 5000);
    const badHeader = gzip.slice();
    badHeader.fill(255, 2, 10);
    add('flags, method and optional header fields not parsed', 'g', badHeader, 5000);
    for (const n of [18, 25, 50, 180, gzip.length - 15, gzip.length - 8, gzip.length - 1]) add('truncated deflate ' + n, 'g', gzip.subarray(0, n), 5000);
    const badBlock = Buffer.concat([gzip.subarray(0, 10), Uint8Array.of(0, 4, 0, 251, 255, 65, 66, 67, 68, 7), new Uint8Array(8)]);
    for (const output of [0, 1, 3, 4, 5, 256, 800]) add('invalid block after stored block ' + output, 'g', badBlock, output);
    add('valid gzip after data failure', 'g', gzip, 5000);
    for (let i = 10; i < gzip.length - 8; i += 19) {
        const corrupt = gzip.slice();
        corrupt[i] ^= 128;
        add('gzip single-bit damage at ' + i, 'g', corrupt, 5000);
    }
    add('null byte array', 'nullInput', empty);
    add('invalid gzip magic leaves the shared inflater unallocated', 'c', wrap(2, Uint8Array.of(0), 1));
    for (const type of [0, 1, 2, 3, 255]) {
        const src = type === 0 ? data : type === 1 ? multi : gzip;
        const n = type === 1 ? 215000 : 4096;
        for (const size of [n - 1, n, n + 1]) add('container ' + type + ' size ' + size, 'c', wrap(type, src, size));
        add('packed size exceeds limit ' + type, 'c', wrap(type, src, n), 0, 0, 0, 0, src.length - 1);
        add('unpacked size exceeds limit ' + type, 'c', wrap(type, src, n), 0, 0, 0, 0, n - 1);
        add('packed size negative ' + type, 'c', wrap(type, src, n, -1));
        if (type !== 0) {
            add('unpacked size negative ' + type, 'c', wrap(type, src, -1));
            add('packed size ignored by decoder ' + type, 'c', wrap(type, src, n, 0));
        }
    }
    add('short container', 'c', Uint8Array.of(2, 0, 0));
    add('short uncompressed payload', 'c', wrap(0, data.subarray(0, 4), 6, 6));
    add('clear shared gzip decoder', 'nullCodec', empty);
    add('raw group with null decoder', 'c', wrap(0, data, data.length));
    add('bzip group with null decoder', 'c', wrap(1, multi, 1));
    add('gzip group with null decoder', 'c', wrap(2, gzip, 1));
    add('unknown group type with null decoder', 'c', wrap(3, gzip, 1));
    add('packed length rejected before null decoder', 'c', wrap(2, gzip, 1), 0, 0, 0, 0, 1);
    add('output length rejected before null decoder', 'c', wrap(2, gzip, -1));
    add('restore shared decoder', 'restoreCodec', empty);
    add('restored inflater reused', 'c', wrap(2, gzip, 2));
    add('bzip shutdown', 'x', empty);
    return cases;
}

test.each(['js', 'wasm'])(
    'JS5 %s inflater matches gamepack limits, corrupt input, reuse and every BZip2 state field',
    backend => {
        const cases = fixtures();
        const source = fileURLToPath(new URL('./cache/CompressionOracle.java', import.meta.url));
        const input = cases.map(v => [v.mode, v.output, v.length, v.offset, v.packed, v.max, Buffer.from(v.source).toString('base64')].join(' ')).join('\n');
        const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', gamepackPath, source], { stdin: Buffer.from(input), timeout: 25000 });
        expect(java.stderr.toString()).toBe('');
        expect(java.exitCode).toBe(0);
        const lines = java.stdout.toString().trimEnd().split(/\r?\n/);
        const hd = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', hdGamepackPath, source, 'hd-bzip'], {
            stdin: Buffer.from(
                input
                    .split('\n')
                    .filter(line => line.startsWith('b '))
                    .join('\n')
            ),
            timeout: 25000
        });
        expect(hd.exitCode, hd.stderr.toString()).toBe(0);
        const hdLines = hd.stdout.toString().trimEnd().split(/\r?\n/);
        expect(hdLines).toEqual(lines.filter((_, i) => cases[i].mode === 'b'));
        expect(lines).toHaveLength(cases.length);
        const gzip = new Js5Compression();
        const savedState = BZip2Decompressor['state'],
            savedBlock = BZip2Decompressor['block'],
            savedMax = Js5.maxContainerSize,
            savedShared = Js5.gzipDecompressor;
        const shared = new Js5Compression();
        const savedModule = RawInflater.module;
        const savedBzip = BzipOutputWasm['kernel'];
        if (backend === 'wasm') {
            BzipOutputWasm.installModule(new WebAssembly.Module(readFileSync(new URL('../src/3rdparty/js5-bzip/js5-bzip.wasm', import.meta.url))));
        } else BzipOutputWasm['kernel'] = null;
        RawInflater.module = backend === 'wasm' ? new WebAssembly.Module(readFileSync(new URL('../src/3rdparty/js5-zlib/js5-inflate.wasm', import.meta.url))) : null;
        Js5.gzipDecompressor = shared;
        let firstInflater: (typeof shared)['inflater'] = null;
        BZip2Decompressor['state'] = new BZip2State();
        BZip2Decompressor['block'] = null;
        try {
            cases.forEach((v, i) => {
                let dest: Uint8Array = new Uint8Array(v.output).fill(0xa5);
                const buf = new PacketT(v.source);
                buf.m_pos = v.offset;
                Js5.maxContainerSize = v.max;
                let result = 'ok';
                try {
                    if (v.mode === 'b') result += BZip2Decompressor.DecompressBZip2(dest, v.length, v.source, v.offset);
                    if (v.mode === 'c') dest = Js5Compression.Decompress(v.source);
                    if (v.mode === 'nullInput') dest = Js5Compression.Decompress(null);
                    if (v.mode === 'nullCodec') Js5.gzipDecompressor = null;
                    if (v.mode === 'restoreCodec') Js5.gzipDecompressor = shared;
                    if (v.mode === 'g') gzip.DecompressGZip(dest, buf);
                    if (v.mode === 'x') BZip2Decompressor.clear();
                } catch (error) {
                    result = 'rejected';
                    if (v.mode === 'c' || v.mode === 'nullInput') result += error instanceof TypeError ? 'NullPointerException' : error instanceof RangeError ? 'ArrayIndexOutOfBoundsException' : 'RuntimeException';
                }
                result += ' ' + createHash('sha256').update(dest).digest('hex');
                if (v.mode === 'b') result += ' ' + bzipState();
                if (v.mode === 'g') result += ' ' + buf.m_pos + ' ' + (gzip['inflater'] !== null);
                if (v.mode === 'x') result += ' ' + (BZip2Decompressor['state'] === null);
                if (v.mode === 'c' || v.mode === 'nullInput' || v.mode === 'nullCodec' || v.mode === 'restoreCodec') {
                    if (firstInflater === null) firstInflater = shared['inflater'];
                    result += ' ' + (Js5.gzipDecompressor === shared) + ' ' + (shared['inflater'] !== null) + ' ' + (shared['inflater'] === firstInflater);
                }
                expect(result, v.label).toBe(lines[i]);
            });
            expect(gzip['inflater']?.['wasm'] != null).toBe(backend === 'wasm');
        } finally {
            BZip2Decompressor['state'] = savedState;
            BZip2Decompressor['block'] = savedBlock;
            Js5.maxContainerSize = savedMax;
            Js5.gzipDecompressor = savedShared;
            RawInflater.module = savedModule;
            BzipOutputWasm['kernel'] = savedBzip;
        }
    },
    30000
);

test('BZip2 WASM retains both JARs’ bytes, first fault index and scratch state across 2560 damaged cache streams', () => {
    const groups = [494, 591].map(group => readGroup(cachePath, 13, group));
    const cases: { src: Uint8Array; bytes: number; limit: number }[] = [];
    for (const group of groups) {
        for (let position = 0; position < 160; position++)
            for (let bit = 0; bit < 8; bit++) {
                const step = position % 80;
                const cut = position < 80 ? group.length : 10 + (((step * (group.length - 11)) / 79) | 0);
                const src = Uint8Array.from(group.subarray(0, cut));
                const index = position < 80 ? 9 + (((step * (group.length - 10)) / 79) | 0) : cut - 1;
                src[index] ^= 1 << bit;
                const limit = [0, 1, 35, 256, 257, 311][(position + bit) % 6];
                cases.push({ src, bytes: (position + bit) % 11 === 0 ? limit >> 1 : limit, limit });
            }
    }
    const wire = Buffer.from(cases.map(({ src, bytes, limit }) => ['b', bytes, limit, 9, src.length - 9, 0, Buffer.from(src).toString('base64')].join(' ')).join('\n') + '\n');
    const oracle = fileURLToPath(new URL('./cache/CompressionOracle.java', import.meta.url));
    const expected = [gamepackPath, hdGamepackPath].map((jar, i) => {
        const cmd = Bun.spawnSync(['java', '-XX:-OmitStackTraceInFastThrow', '-Xmx96m', '-cp', jar, oracle, (i === 0 ? 'sd' : 'hd') + '-bzip-faults'], { stdin: wire, timeout: 55000, maxBuffer: 2 * 1024 * 1024 });
        expect(cmd.exitCode, cmd.stderr.toString()).toBe(0);
        return cmd.stdout.toString().trimEnd().split(/\r?\n/);
    });
    expect(expected[0]).toHaveLength(2560);
    expect(expected[1]).toEqual(expected[0]);
    const oldState = BZip2Decompressor['state'],
        oldBlock = BZip2Decompressor.block,
        oldKernel = BzipOutputWasm['kernel'];
    const original = BzipOutputWasm.write;
    let accepted = 0;
    try {
        BZip2Decompressor['state'] = new BZip2State();
        BZip2Decompressor.block = null;
        BzipOutputWasm.installModule(new WebAssembly.Module(readFileSync(new URL('../src/3rdparty/js5-bzip/js5-bzip.wasm', import.meta.url))));
        BzipOutputWasm.write = function (...args) {
            const result = original.apply(this, args);
            if (result !== null) accepted++;
            return result;
        };
        for (const [i, { src, bytes, limit }] of cases.entries()) {
            const dst = new Uint8Array(bytes).fill(0xa5);
            let status: string;
            try {
                status = 'ok' + BZip2Decompressor.DecompressBZip2(dst, limit, src, 9);
            } catch (error) {
                if (!(error instanceof RangeError)) throw error;
                status = 'rejected:' + error.message.split(' ').at(-1);
            }
            expect([status, createHash('sha256').update(dst).digest('hex'), bzipState()].join(' '), 'damaged stream ' + i).toBe(expected[0][i]);
        }
        expect(accepted).toBeGreaterThan(0);
    } finally {
        BZip2Decompressor['state'] = oldState;
        BZip2Decompressor.block = oldBlock;
        BzipOutputWasm['kernel'] = oldKernel;
        BzipOutputWasm.write = original;
    }
}, 120000);

test('a damaged BWT link or unavailable WASM scratch replays the original Java output stage', () => {
    const saved = BzipOutputWasm['kernel'],
        originalTable = BZip2Decompressor.block;
    const mod = new WebAssembly.Module(readFileSync(new URL('../src/3rdparty/js5-bzip/js5-bzip.wasm', import.meta.url)));
    const result: string[] = [];
    try {
        for (let mode = 0; mode < 6; mode++) {
            BzipOutputWasm.installModule(mod);
            const table = (BZip2Decompressor.block = new Int32Array(100000));
            table[0] = (1 << 8) | 37;
            table[1] = ((mode === 1 ? 17 : mode === 2 ? 100001 : mode === 3 ? -21 : 2) << 8) | 73;
            table[17] = (2 << 8) | 11;
            table[2] = (3 << 8) | 19;
            table[3] = 23;
            const space = mode === 5 ? 131072 : 6;
            const dest = new Uint8Array(mode === 4 ? 3 : space + 2).fill(0xa5);
            const state = Object.assign(new BZip2State(), { output: dest, outputTotal: 2147483645, lastByte: -71, repeatCount: 0, blockUsed: 1, currentByte: 3, blockPos: 0, nextOutput: 2, outputRemaining: space, blockLength: 4 });
            if (mode === 5)
                requireNonNull(BzipOutputWasm['kernel']).memory.grow = () => {
                    throw new RangeError('out of memory');
                };
            let status = 'ok';
            try {
                BZip2Decompressor['writeOutput'](state);
            } catch (e) {
                if (!(e instanceof RangeError)) throw e;
                status = 'bounds:' + e.message.split(' ').at(-1);
            }
            result.push(
                [status, state.outputTotal, state.lastByte, state.repeatCount, state.blockUsed, state.currentByte, state.blockPos, state.nextOutput, state.outputRemaining, state.blockLength, createHash('sha256').update(dest).digest('hex')].join('|')
            );
        }
        const source = fileURLToPath(new URL('./cache/CompressionOracle.java', import.meta.url));
        for (const [variant, jar] of [
            ['sd', gamepackPath],
            ['hd', hdGamepackPath]
        ]) {
            const run = Bun.spawnSync(['java', '-XX:-OmitStackTraceInFastThrow', '-cp', jar, source, variant + '-output']);
            expect(run.exitCode, run.stderr.toString()).toBe(0);
            expect(result).toEqual(run.stdout.toString().trimEnd().split(/\r?\n/));
        }
    } finally {
        BzipOutputWasm['kernel'] = saved;
        BZip2Decompressor.block = originalTable;
    }
});
