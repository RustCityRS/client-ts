import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { closeSync, existsSync, mkdtempSync, openSync, readFileSync, readdirSync, rmSync, writeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import Js5Compression from '#/cache/Js5Compression.js';
import RawInflater from '#/cache/RawInflater.js';
import PacketT from '#/io/PacketT.js';
import { cachePath, gamepackPath } from '../reference.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

test('WASM gzip matches both gamepacks on all cached gzip groups, mapped land keys and overlapping output', () => {
    const dir = mkdtempSync(join(tmpdir(), '530-gzip-corpus-'));
    const fixture = join(dir, 'groups.bin');
    const oldModule = RawInflater.module;
    try {
        const keysFile = process.env.XTEA_530 ?? resolve(dirname(gamepackPath), '../../content/530/keys.json');
        const keys = new Map<number, Int32Array>();
        if (existsSync(keysFile)) {
            const material: { archive: number; group: number; key: number[] }[] = JSON.parse(readFileSync(keysFile, 'utf8'));
            for (const entry of material) if (entry.archive === 5) keys.set(entry.group, Int32Array.from(entry.key));
        }
        const codec = new Js5Compression();
        RawInflater.module = new WebAssembly.Module(readFileSync(new URL('../../src/3rdparty/js5-zlib/js5-inflate.wasm', import.meta.url)));
        const disk = readFileSync(join(cachePath, 'main_file_cache.dat2'));
        const fd = openSync(fixture, 'w');
        const labels: string[] = [],
            outcomes: Buffer[] = [];
        let encrypted = 0,
            recovered = 0;
        const record = (label: string, source: Buffer, size: number, offset: number) => {
            const header = Buffer.alloc(12);
            header.writeInt32BE(source.length, 0);
            header.writeInt32BE(size, 4);
            header.writeInt32BE(offset, 8);
            writeSync(fd, header);
            writeSync(fd, source);
            const dest = size < 0 ? source : Buffer.alloc(size, 0xa5);
            const packet = new PacketT(source);
            packet.m_pos = offset;
            let status = 0;
            try {
                codec.DecompressGZip(dest, packet);
            } catch (error) {
                if (!(error instanceof Error)) throw error;
                status = 1;
            }
            if (packet.m_pos !== offset) throw new Error('Changed gzip packet cursor in ' + label);
            labels.push(label);
            outcomes.push(Buffer.concat([Buffer.from([status]), createHash('sha256').update(dest).digest()]));
        };
        try {
            for (const file of readdirSync(cachePath)
                .filter(f => /^main_file_cache\.idx\d+$/.test(f))
                .sort()) {
                const archive = Number(file.slice(file.lastIndexOf('idx') + 3));
                const index = readFileSync(join(cachePath, file));
                for (let at = 0; at + 6 <= index.length; at += 6) {
                    const size = index.readUIntBE(at, 3),
                        group = at / 6;
                    let sector = index.readUIntBE(at + 3, 3);
                    if (size === 0 || sector === 0 || disk[sector * 520 + 8] !== 2) continue;
                    const data = Buffer.alloc(size);
                    for (let i = 0; i < size; i += 512) {
                        const base = sector * 520;
                        if (disk.readUInt16BE(base) !== group || disk[base + 7] !== archive || disk.readUInt16BE(base + 2) !== i >> 9) {
                            throw new Error('Invalid JS5 sector ' + archive + '/' + group);
                        }
                        disk.copy(data, i, base + 8, base + 8 + Math.min(512, size - i));
                        sector = disk.readUIntBE(base + 4, 3);
                    }
                    if (data[9] !== 31 || data[10] !== 139) {
                        encrypted++;
                        const key = archive === 5 ? keys.get(group) : undefined;
                        if (key) new PacketT(data).tinyKeyDecrypt(key, 5, data.length);
                        if (data[9] === 31 && data[10] === 139) recovered++;
                    }
                    // A group whose map key is unavailable reaches the native gzip header check.
                    // Its encrypted size word cannot be used to size the test destination.
                    const capacity = data[9] === 31 && data[10] === 139 ? data.readInt32BE(5) : 17;
                    record(archive + '/' + group, data, capacity, 9);
                }
            }
            for (const offset of [0, 7, 23]) {
                const body = Buffer.from(Array.from({ length: 2048 }, (_, i) => i * i));
                const raw = gzipSync(body);
                record('overlap ' + offset, Buffer.concat([Buffer.alloc(offset), raw]), -1, offset);
            }
        } finally {
            closeSync(fd);
        }
        expect(labels.length).toBeGreaterThan(0);
        expect(codec['inflater']?.['wasm']).toBeTruthy();
        const java = join(import.meta.dir, 'GzipGroupsOracle.java');
        const compile = Bun.spawnSync(['javac', '-d', dir, java]);
        expect(compile.exitCode, compile.stderr.toString()).toBe(0);
        for (const [name, jar] of [
            ['sd', gamepackPath],
            ['hd', hdGamepackPath]
        ]) {
            const result = Bun.spawnSync(['java', '-Xmx512m', '-Djava.awt.headless=true', '-cp', [dir, jar, joglPath].join(delimiter), 'GzipGroupsOracle', name, fixture], { maxBuffer: labels.length * 33 + 65536 });
            expect(result.exitCode, result.stderr.toString()).toBe(0);
            expect(result.stdout.length).toBe(labels.length * 33);
            for (let i = 0; i < labels.length; i++) {
                if (!result.stdout.subarray(i * 33, i * 33 + 33).equals(outcomes[i])) throw new Error(name + ' differs at ' + labels[i]);
            }
        }
        const rejected = outcomes.slice(0, -3).filter(row => row[0] !== 0).length;
        console.log('Gzip groups', labels.length - 3, 'decoded', labels.length - 3 - rejected, 'rejected', rejected, 'land keys recovered', recovered, 'opaque headers', encrypted - recovered);
    } finally {
        RawInflater.module = oldModule;
        rmSync(dir, { recursive: true, force: true });
    }
}, 120000);
