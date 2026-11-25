import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { glJar } from '#/client/ClientVariant.js';
import Floor from '#/sound/Floor.js';
import JagVorbis from '#/sound/JagVorbis.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { localAssets } from './cachefile.js';
import { cachePath, gamepackPath } from './reference.js';
import { hdGamepackPath, joglPath } from './render/hd-reference.js';

interface PacketCase {
    label: string;
    packets: Uint8Array[];
}
interface Corpus {
    setup: Uint8Array;
    cases: PacketCase[];
}

function int(value: number): Buffer {
    const data = Buffer.alloc(4);
    data.writeInt32BE(value);
    return data;
}

function record(packets: Uint8Array[]): Buffer {
    const parts = [int(22050), int(4096), int(0), int(4096), int(packets.length)];
    for (const packet of packets) {
        let n = packet.length;
        while (n >= 255) {
            parts.push(Buffer.of(255));
            n -= 255;
        }
        parts.push(Buffer.of(n), Buffer.from(packet));
    }
    return Buffer.concat(parts);
}

function writeBits(bytes: Uint8Array, start: number, value: number, count: number): number {
    for (let i = 0; i < count; i++, start++) {
        const mask = 1 << (start & 7);
        if (value & (1 << i)) bytes[start >> 3] |= mask;
        else bytes[start >> 3] &= ~mask;
    }
    return start;
}

// Preserve the cache's genuine codebooks, floor, residue and mapping. Replace its single mode
// with a short mode, a long mode and a mode naming a missing mapping. ID 3 has no mode.
function threeModes(setup: Uint8Array, endBit: number, sizes: number): Uint8Array {
    const bytes = new Uint8Array(setup.length + 16);
    bytes.set(setup);
    bytes[0] = sizes;
    let bit = writeBits(bytes, endBit - 41 - 6, 2, 6);
    for (let mode = 0; mode < 3; mode++) {
        bit = writeBits(bytes, bit, mode === 1 ? 1 : 0, 1);
        bit = writeBits(bytes, bit, 0, 16);
        bit = writeBits(bytes, bit, 0, 16);
        bit = writeBits(bytes, bit, mode === 2 ? 255 : 0, 8);
    }
    return bytes.subarray(0, (bit + 7) >> 3);
}

function modePacket(data: Uint8Array, mode: number, previous: number, next: number): Uint8Array {
    const bytes = new Uint8Array(data.length + 1);
    let bit = writeBits(bytes, 1, mode, 2);
    if (mode === 1) {
        bit = writeBits(bytes, bit, previous, 1);
        bit = writeBits(bytes, bit, next, 1);
    }
    for (let i = 1; i < data.length * 8; i++) bit = writeBits(bytes, bit, (data[i >> 3] >> (i & 7)) & 1, 1);
    return bytes;
}

// A valid setup with one floor segment and zero residue partitions lets the decoder reach
// the transform even at n=1. The cache's own residue writes would fault sooner at small n.
function emptyResidueSetup(sizes: number): Uint8Array {
    const bytes = new Uint8Array(128);
    let bit = 0;
    const put = (value: number, count: number) => {
        bit = writeBits(bytes, bit, value, count);
    };
    put(sizes, 8);
    put(0, 8);
    put(0x564342, 24);
    put(1, 16);
    put(1, 24); // one one-dimensional codebook entry
    put(0, 1);
    put(0, 1);
    put(0, 5);
    put(0, 4); // unordered, dense, length one, no lookup
    put(0, 6);
    put(0, 16); // one time transform
    put(0, 6);
    put(1, 16);
    put(0, 5);
    put(0, 2);
    put(0, 4); // floor type 1, no partitions
    put(0, 6);
    put(0, 16);
    put(0, 24);
    put(0, 24); // one type 0 residue with begin=end=0
    put(0, 24);
    put(0, 6);
    put(0, 8);
    put(0, 3);
    put(0, 1); // partition, class, classbook, cascade
    put(0, 6);
    put(0, 16);
    put(0, 1);
    put(0, 1);
    put(0, 2); // one uncoupled mapping
    put(0, 8);
    put(0, 8);
    put(0, 8); // time, floor, residue
    put(2, 6);
    for (const large of [0, 1, 0]) {
        put(large, 1);
        put(0, 16);
        put(0, 16);
        put(0, 8);
    }
    return bytes.subarray(0, (bit + 7) >> 3);
}

function faultCorpus(): Corpus[] {
    const archive = localAssets(cachePath, [14]).archive(14);
    const setup = requireNonNull(archive.GetFile(0, 0));
    JagVorbis['ProcessHeaders'](setup);
    expect(JagVorbis['m_modeBlockflag']).toEqual([false]);
    const endBit = JagVorbis['byteIndex'] * 8 + JagVorbis['bitIndex'];
    const cases: PacketCase[] = [];
    for (const id of [1, 9]) {
        const packets = requireNonNull(new JagVorbis(requireNonNull(archive.GetFile(0, id)))['packets']);
        const original = packets[2],
            prefix = packets.slice(0, 2);
        cases.push({ label: id + '/original', packets: [...prefix, original] });
        for (let n = 0; n < original.length; n++) cases.push({ label: id + '/length/' + n, packets: [...prefix, original.subarray(0, n)] });
        for (let bit = 0; bit < original.length * 8; bit++) {
            const changed = original.slice();
            changed[bit >> 3] ^= 1 << (bit & 7);
            cases.push({ label: id + '/bit/' + bit, packets: [...prefix, changed] });
        }
    }
    const result: Corpus[] = [{ setup, cases }];
    const sample = cases[0].packets[2];
    // Include valid and reversed block sizes plus the minimum/maximum encoded exponents.
    for (const sizes of [0xaa, 0xca, 0xac, 0x00, 0x40, 0x04, 0xf0, 0x0f]) {
        const modes: PacketCase[] = [];
        for (const lead of [0, 1]) {
            const prefix = modePacket(sample, lead, 1, 1);
            for (let mode = 0; mode < 4; mode++) {
                for (let flags = 0; flags < (mode === 1 ? 4 : 1); flags++) {
                    modes.push({ label: 'blocks/' + [sizes, lead, mode, flags].join('/'), packets: [prefix, modePacket(sample, mode, flags & 1, flags >> 1)] });
                }
            }
        }
        result.push({ setup: threeModes(setup, endBit, sizes), cases: modes });
    }
    const floor = Uint8Array.of(2, 0, 0),
        short = modePacket(floor, 0, 0, 0);
    const long = modePacket(floor, 1, 1, 1),
        transition = modePacket(floor, 1, 0, 0);
    for (let sizes = 0; sizes < 256; sizes++) {
        const pairs = [
            [short, short],
            [short, long],
            [long, short],
            [transition, transition]
        ];
        result.push({ setup: emptyResidueSetup(sizes), cases: pairs.map((packets, index) => ({ label: 'exponents/' + sizes + '/' + index, packets })) });
    }
    return result;
}

const methodNames: Record<string, Record<string, string>> = {
    JagVorbis: { ReadBit: 'b', ReadBits: glJar ? 'e' : 'a', DecodeAudioPacket: glJar ? 'd' : 'b', ToWaveMultistep: 'a' },
    CodeBook: { scalar: 'c', vector: 'a' },
    Floor: { decode: glJar ? 'b' : 'a', line: 'a', apply: 'a', predict: 'a', sort: 'a' },
    Residue: { decode: 'a' }
};
const classNames: Record<string, string> = glJar ? { JagVorbis: 'jc', CodeBook: 'ji', Floor: 'ie', Residue: 'vb' } : { JagVorbis: 'ni', CodeBook: 'dh', Floor: 'lb', Residue: 'i' };

function failure(error: unknown, sites: string[]): string {
    if (!(error instanceof RangeError)) throw error;
    const index = /^array index (-?\d+)$/.exec(error.message);
    if (!index) throw error;
    const frames: string[] = [];
    for (const line of (error.stack ?? '').split('\n')) {
        const m = /\bat (?:[\w.]+\.)?(\w+) \(.*[/\\](JagVorbis|CodeBook|Floor|Residue)\.ts:(\d+:\d+)\)/.exec(line);
        if (!m) continue;
        if (frames.length === 0) sites.push(m[2] + '.' + m[1] + '@' + m[3]);
        frames.push(classNames[m[2]] + '.' + requireNonNull(methodNames[m[2]][m[1]]));
    }
    return 'ArrayIndexOutOfBoundsException:' + index[1] + ':' + frames.join('>');
}

function decode(data: Uint8Array, sites: string[]): string {
    const sound = new JagVorbis(data);
    requireNonNull(JagVorbis['block']).fill(0);
    requireNonNull(Floor['xs']).fill(0);
    requireNonNull(Floor['ys']).fill(0);
    requireNonNull(Floor['enabled']).fill(false);
    const budget = Int32Array.of(22050);
    let result: Int8Array | null = null,
        status = 'ok';
    try {
        result = sound.ToWaveMultistep(budget)?.samples ?? null;
    } catch (error) {
        status = failure(error, sites);
    }
    const hash = createHash('sha256');
    for (const array of [JagVorbis['block'], sound['previous'], sound['pcm'], result, Floor['xs'], Floor['ys'], Floor['enabled']]) {
        const length = Buffer.alloc(4);
        length.writeInt32LE(array?.length ?? -1);
        hash.update(length);
        if (array !== null) hash.update(Array.isArray(array) ? Uint8Array.from(array, Number) : new Uint8Array(array.buffer, array.byteOffset, array.byteLength));
    }
    return [status, JagVorbis['byteIndex'], JagVorbis['bitIndex'], sound['packetIndex'], sound['writeIndex'], budget[0], sound['previousSize'], sound['previousTail'], sound['previousSilent'], hash.digest('hex')].join(' ');
}

test('truncated and single-bit-changed Vorbis packets preserve gamepack failure points and partially decoded state', () => {
    const before = Object.getOwnPropertyDescriptors(JagVorbis),
        floor = Object.getOwnPropertyDescriptors(Floor);
    const dir = mkdtempSync(join(tmpdir(), 'vorbis530-fault-'));
    try {
        Floor['xs'] = null; // Let the setup allocate fresh scratch arrays for this corpus.
        const corpus = faultCorpus();
        const chunks: Buffer[] = [];
        for (const { setup, cases } of corpus) {
            chunks.push(int(setup.length), Buffer.from(setup), int(cases.length));
            for (const entry of cases) {
                const bytes = record(entry.packets);
                chunks.push(int(bytes.length), bytes);
            }
        }
        chunks.push(int(-1));
        const compile = Bun.spawnSync(['javac', '-d', dir, ...['VorbisOracle', 'VorbisFaultOracle'].map(name => join(import.meta.dir, 'game', name + '.java'))]);
        expect(compile.stderr.toString()).toBe('');
        expect(compile.exitCode).toBe(0);
        const classpath = [dir, ...(glJar ? [hdGamepackPath, joglPath] : [gamepackPath])].join(delimiter);
        const java = Bun.spawnSync(['java', '-XX:-OmitStackTraceInFastThrow', '-Xmx160m', '-cp', classpath, 'VorbisFaultOracle', glJar ? 'gl' : 'sd', dir], { stdin: Buffer.concat(chunks), maxBuffer: 4 * 1024 * 1024, timeout: 90000 });
        expect(java.stderr.toString()).toBe('');
        expect(java.exitCode).toBe(0);
        const lines = java.stdout.toString().trimEnd().split(/\r?\n/);
        const sites: string[] = [];
        let index = 0;
        for (const { setup, cases } of corpus) {
            JagVorbis['ProcessHeaders'](setup);
            for (const entry of cases) expect(decode(record(entry.packets), sites), entry.label).toBe(lines[index++]);
        }
        expect(index).toBe(lines.length);
        // The failing TS source expression must correspond to the same JAR array instruction
        // across all packets, including distinct accesses in the same obfuscated Java method.
        const javaSites = readFileSync(join(dir, 'sites.txt'), 'utf8').trimEnd().split(/\r?\n/);
        expect(javaSites.length).toBe(sites.length);
        const pairs = new Set(sites.map((site, i) => site + ' -> ' + javaSites[i]));
        expect(pairs.size).toBe(new Set(javaSites).size);
        expect(pairs.size).toBe(new Set(sites).size);
    } finally {
        Object.defineProperties(JagVorbis, before);
        Object.defineProperties(Floor, floor);
        rmSync(dir, { recursive: true, force: true });
    }
}, 120000);
