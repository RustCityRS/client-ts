import { requireNonNull } from '#/util/JavaArray.js';
import { cachePath, gamepackPath } from './reference.js';
import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';
import Huffman from '#/io/Huffman.js';
import WordPack from '#/io/WordPack.js';
import PacketT from '#/io/PacketT.js';
import JagString, { fromLiteral } from '#/datastruct/JagString.js';
import { localAssets } from './cachefile.js';

const enc = (src: Uint8Array) => Buffer.from(src).toString('base64');
const bytes = (src: string) => Buffer.from(src, 'base64');
function operations(original: Uint8Array): string[] {
    const rows: string[] = ['cabbage'];
    const dest = (size: number) => enc(new Uint8Array(size).fill(0xa5));
    const text = Uint8Array.from({ length: 2048 }, (_, i) => i & 255);
    for (const spec of [new Uint8Array(0), Uint8Array.of(0, 0, 0, 0), Uint8Array.of(33), Uint8Array.of(255), Uint8Array.of(1, 1, 1), Uint8Array.of(2, 3, 1, 3)]) {
        rows.push('set ' + enc(spec));
    }
    const ladder = Uint8Array.from({ length: 33 }, (_, i) => Math.min(i + 1, 32));
    for (const spec of [new Uint8Array(256).fill(8), ladder, original]) {
        const codec = new Huffman(spec),
            source = text.map(c => c % spec.length);
        rows.push('set ' + enc(spec));
        for (const start of [0, 1, 7])
            for (const count of [0, 1, 2, 7, 8, 9, 31, 126, 127, 128, 256]) {
                const unpacked = source.slice(start, start + count),
                    out = new Uint8Array(count * 4 + 12);
                const n = codec.Encode(start, count, out, 3, source);
                rows.push(['encode', enc(source.subarray(0, start + count)), dest(out.length), start, count, 3].join(' '));
                rows.push(['decode', enc(out.subarray(0, 3 + n)), dest(count + 4), 3, count, 2].join(' '));
                if (count > 0) rows.push(['decode', enc(out.subarray(0, 2 + n)), dest(count + 4), 3, count, 2].join(' '));
                if (count === 31) {
                    rows.push(['encode', enc(source.subarray(0, start + count)), dest(3), start, count, 1].join(' '));
                    rows.push(['decode', enc(out.subarray(0, 3 + n)), dest(5), 3, count, 2].join(' '));
                }
                if (start === 0 && count >= 126) {
                    rows.push(['write', enc(unpacked), dest(count * 4 + 3), 1].join(' '));
                    const packet = new PacketT(count * 4 + 12);
                    packet.m_pos = 2;
                    packet.pSmart1or2(unpacked.length);
                    packet.m_pos += codec.Encode(0, count, packet.m_data, packet.m_pos, unpacked);
                    const body = enc(requireNonNull(packet.m_data).subarray(0, packet.m_pos));
                    rows.push('read ' + body + ' 2');
                    for (const [limit, offset] of [
                        [-1, 0],
                        [1, 0],
                        [16, 1],
                        [16, 0],
                        [32767, 0]
                    ])
                        rows.push(['readLimited', body, 2, limit, offset].join(' '));
                }
            }
        rows.push(['encode', enc(source.subarray(0, 64)), '=', 0, 8, 1].join(' '));
        rows.push(['decode', enc(source.subarray(0, 64)), '=', 0, 8, 1].join(' '));
        rows.push(['encode', enc(source.subarray(0, 5)), dest(8), 0, -1, -2].join(' '));
        rows.push(['encode', enc(source.subarray(0, 5)), dest(8), 2147483646, 3, 1].join(' '));
        rows.push(['decode', enc(source.subarray(0, 5)), dest(8), 0, -1, 0].join(' '));
        rows.push('read ' + enc(Uint8Array.of(255)) + ' 0', 'read ' + enc(Uint8Array.of(254, 254)) + ' 0');
        rows.push('mutate 0 0', ['encode', enc(Uint8Array.of(0)), dest(12), 0, 1, 0].join(' '));
    }
    return rows;
}

test('every Huffman code, lookup slot, output bit, partial write and packet cursor matches the original dd and wordpack wrappers', () => {
    const directory = mkdtempSync(join(tmpdir(), 'js5-huffman530-'));
    const assets = localAssets(cachePath, [10]);
    const original = requireNonNull(assets.file(10, assets.groupId(10, 'huffman')));
    const saved = WordPack['codec'];
    try {
        const rows = operations(original);
        const jar = gamepackPath,
            src = fileURLToPath(new URL('./cache/HuffmanOracle.java', import.meta.url));
        const compile = Bun.spawnSync(['javac', '-cp', jar, '-d', directory, src], { timeout: 15000 });
        expect(compile.stderr.toString()).toBe('');
        expect(compile.exitCode).toBe(0);
        const oracle = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', directory + delimiter + jar, 'HuffmanOracle'], { stdin: Buffer.from(rows.join('\n')), timeout: 15000, maxBuffer: 4 * 1024 * 1024 });
        expect(oracle.stderr.toString()).toBe('');
        expect(oracle.exitCode).toBe(0);
        const expected = oracle.stdout.toString().trimEnd().split(/\r?\n/);
        expect(expected).toHaveLength(rows.length);
        let codec: Huffman, lengths: Uint8Array;
        rows.forEach((row, i) => {
            const v = row.split(' '),
                cmd = v[0];
            let result: string;
            if (cmd === 'cabbage') {
                const text = WordPack.read(new PacketT(new Uint8Array(0)));
                let rejected = false;
                try {
                    text.appendChar(65);
                } catch {
                    rejected = true;
                }
                result = [text === WordPack.cabbage, text === fromLiteral('Cabbage'), text['mutable'], rejected, enc(text.toBytes())].join('|');
            } else if (cmd === 'set') {
                lengths = bytes(v[1]);
                try {
                    codec = new Huffman(lengths);
                    WordPack.setCodec(codec);
                    result = [codec['codes'], codec['tree']].map(d => '[' + Array.from(d).join(', ') + ']').join('|');
                } catch {
                    result = 'threw';
                }
            } else if (cmd === 'mutate') {
                lengths[Number(v[1])] = Number(v[2]);
                result = 'mutated';
            } else if (cmd === 'write') {
                const text = bytes(v[1]),
                    buf = new PacketT(bytes(v[2]));
                buf.m_pos = Number(v[3]);
                try {
                    result = String(WordPack.write(JagString.fromBytes(text, 0, text.length), buf));
                } catch {
                    result = 'threw';
                }
                result += '|' + buf.m_pos + '|' + enc(requireNonNull(buf.m_data));
            } else if (cmd === 'read' || cmd === 'readLimited') {
                const buf = new PacketT(bytes(v[1]));
                buf.m_pos = Number(v[2]);
                const text = cmd === 'read' ? WordPack.read(buf) : WordPack.readLimited(Number(v[3]), Number(v[4]), buf);
                result = enc(text.toBytes()) + '|' + buf.m_pos + '|' + (text === WordPack['cabbage']);
            } else {
                const src = bytes(v[1]),
                    dst = v[2] === '=' ? src : bytes(v[2]);
                const start = Number(v[3]),
                    count = Number(v[4]),
                    offset = Number(v[5]);
                try {
                    result = String(cmd === 'encode' ? codec.Encode(start, count, dst, offset, src) : codec.Decode(src, dst, start, count, offset));
                } catch {
                    result = 'threw';
                }
                result += '|' + enc(dst);
            }
            expect(result, i + ' ' + cmd).toBe(expected[i]);
        });
    } finally {
        WordPack['codec'] = saved;
        void assets.stop();
        rmSync(directory, { recursive: true, force: true });
    }
}, 32000);
