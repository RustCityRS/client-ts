import { requireNonNull } from '../src/util/JavaArray.js';
import { cacheZipPath } from './reference.js';
import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { unzipSync } from 'fflate';

import { unpackGroup } from './cache/unpackGroup.js';
import Js5Index from '#/cache/Js5Index.js';
import { ClientScript } from '#/script/ClientScript.js';
import { scriptArchive } from './script-archive.js';
import type JagString from '#/datastruct/JagString.js';
import PacketT from '#/io/PacketT.js';
import Crc32 from '#/io/Crc32.js';

// The reference digest was produced by the vanilla gamepack's db, al and j.a.
const cacheZip = cacheZipPath;
test.skipIf(!cacheZip)('every CS2 program in original cache 254 agrees with client.jar', () => {
    const datPath = 'cache/main_file_cache.dat2';
    const idxPath = 'cache/main_file_cache.idx';
    const files = unzipSync(readFileSync(cacheZip), {
        filter: entry => [datPath, idxPath + 255, idxPath + 12].includes(entry.name)
    });
    const dat = new PacketT(files[datPath]);
    function readGroup(archive: number, id: number): Uint8Array {
        const idx = new PacketT(files[idxPath + archive]);
        idx.m_pos = id * 6;
        const size = idx.g3();
        let sector = idx.g3();
        const bytes = new Uint8Array(size);
        for (let pos = 0; pos < size; pos += 512) {
            dat.m_pos = sector * 520;
            if (dat.g2() !== id || dat.g2() !== pos >>> 9) {
                throw new Error('Invalid cache sector');
            }
            sector = dat.g3();
            if (dat.g1() !== archive) {
                throw new Error('Invalid cache archive');
            }
            dat.gArrayBuffer(Math.min(size - pos, 512), pos, bytes);
        }
        return bytes;
    }
    const table = readGroup(255, 12);
    const index = new Js5Index(table, Crc32.compute(0, table, table.length));
    const hash = createHash('sha256');
    const word = Buffer.alloc(4);
    function writeInt(n: number): void {
        word.writeInt32BE(n);
        hash.update(word);
    }
    function writeString(s: JagString | null): void {
        writeInt(s?.length ?? -1);
        if (s) {
            hash.update(requireNonNull(s.bytes).subarray(0, s.length));
        }
    }
    using _archive = scriptArchive(id => unpackGroup(index, id, readGroup(12, id))[0] ?? null);
    for (const id of requireNonNull(index.groupIds)) {
        const script = requireNonNull(ClientScript.Get(id));
        if (script.opcodes === null || script.intOperands === null || script.stringOperands === null) throw new Error('Missing instruction arrays in script ' + id);
        writeInt(id);
        writeString(script.name);
        [script.intLocals, script.stringLocals, script.intArgs, script.stringArgs, script.opcodes.length].forEach(writeInt);
        for (let pc = 0; pc < script.opcodes.length; pc++) {
            writeInt(script.opcodes[pc]);
            writeInt(script.intOperands[pc]);
            writeString(script.stringOperands[pc]);
        }
        writeInt(script.switches?.length ?? 0);
        for (const slot of script.switches ?? []) {
            const cases = requireNonNull(slot);
            const entries: [number, number][] = [];
            for (let node = cases.head(); node !== null; node = cases.next()) entries.push([Number(node.key), node.value]);
            writeInt(entries.length);
            for (const [key, offset] of entries.sort(([a], [b]) => a - b)) {
                writeInt(key);
                writeInt(offset);
            }
        }
    }
    expect(requireNonNull(index.groupIds).length).toBe(2063);
    expect(hash.digest('hex')).toBe('ab07e64d794b14204451d2bb0bf2f2e4b9169be77602a1932cca4096365eab6a');
});
