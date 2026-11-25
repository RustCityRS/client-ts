import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import PacketT from '#/io/PacketT.js';
import WrappedException from '#/util/WrappedException.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

type Operation = 'float' | 'floatLE' | 'integerLE' | 'protocolLE' | 'alt2' | 'g2s' | 'g2' | 'g3' | 'ig3' | 'readAlt2' | 'readAlt3' | 'g4' | 'little' | 'signedNeg';
type Row = [operation: Operation, bits: number, position: number, length: number];
const floatWord = new DataView(new ArrayBuffer(4));

function run([operation, bits, position, length]: Row, rawWord = false): string {
    const bytes = length < 0 ? null : Buffer.alloc(length);
    if (bytes !== null) for (let i = 0; i < bytes.length; i++) bytes[i] = bits + i * 37;
    const packet = new PacketT(bytes);
    packet.m_pos = position;
    floatWord.setUint32(0, bits);
    const number = floatWord.getFloat32(0);
    const value = Number.isNaN(number) && bits !== 0x7fc00000 ? { bits } : number;
    let result = 'ok';
    try {
        switch (operation) {
            case 'float':
                packet.pFloat(rawWord ? bits | 0 : value, rawWord);
                break;
            case 'floatLE':
                packet.pFloatPlatformEndian(rawWord ? bits | 0 : value, rawWord);
                break;
            case 'integerLE':
                packet.p4PlatformEndian(bits);
                break;
            case 'protocolLE':
                packet.p4_alt1(bits);
                break;
            case 'alt2':
                packet.p4_alt2(bits);
                break;
            case 'g2s':
                result = String(packet.g2s(46));
                break;
            case 'g2':
                result = String(packet.g2());
                break;
            case 'g3':
                result = String(packet.g3());
                break;
            case 'ig3':
                result = String(packet.ig3());
                break;
            case 'readAlt2':
                result = String(packet.g4_alt2());
                break;
            case 'readAlt3':
                result = String(packet.g4_alt3());
                break;
            case 'signedNeg':
                result = String(packet.g1s_alt2((bits << 24) >> 24));
                break;
            case 'little':
                result = String(packet.g4_alt1(bits | 0));
                break;
            case 'g4':
                result = String(packet.g4());
                break;
        }
    } catch (error) {
        const cause = error instanceof WrappedException ? error.cause : error;
        if (cause instanceof RangeError) result = 'bounds ' + cause.message.split(' ').at(-1);
        else if (cause instanceof TypeError) result = 'null';
        else throw error;
        if (error instanceof WrappedException) result += ' ' + error.context;
    }
    return [result, packet.m_pos, bytes?.toString('hex') ?? '-'].join('|');
}

test('HD packet floats and integers match the JAR byte and cursor at each store boundary', () => {
    if (process.env.RS530_GAMEPACK_IDENTITY !== 'gl') {
        const child = Bun.spawnSync([process.execPath, 'test', fileURLToPath(import.meta.url)], {
            env: { ...process.env, RS530_GAMEPACK_IDENTITY: 'gl' }
        });
        expect(child.exitCode, child.stderr.toString()).toBe(0);
        expect(child.stderr.toString()).toMatch(/^\s*1 pass$/m);
        return;
    }
    const rows: Row[] = [];
    for (const operation of ['float', 'floatLE'] as const) {
        // Every exponent and sign, including subnormals, infinities and NaNs with distinct payloads.
        for (const sign of [0, 0x80000000])
            for (let exponent = 0; exponent < 256; exponent++) {
                for (const fraction of [0, 1, 0x400000, 0x7fffff]) {
                    rows.push([operation, (sign | (exponent << 23) | fraction) >>> 0, 1, 6]);
                }
            }
    }
    for (const operation of ['float', 'floatLE', 'integerLE', 'protocolLE', 'alt2', 'g2s', 'g2', 'g3', 'ig3', 'readAlt2', 'readAlt3', 'g4'] as const) {
        for (const bits of [0x11335577, 0x89abcdef]) {
            for (const length of [-1, 0, 1, 2, 3, 4, 5]) {
                for (const position of [-1, 0, 1, 0x7fffffff]) rows.push([operation, bits, position, length]);
            }
        }
    }
    // Original call-site guards plus the boundary where wa.l invokes wa.i(-14).
    for (const guard of [-105, -104, -101, -79, -66, -48, -46, -43, -42, 0, 1, 2, 3, 4, 5, 7, 97, 98, 127]) {
        for (const length of [-1, 0, 1, 2, 3, 4, 6, 12]) {
            for (const pos of [-1, 0, 1, 4, 0x7fffffff]) {
                rows.push(['little', guard >>> 0, pos, length], ['signedNeg', guard >>> 0, pos, length]);
            }
        }
    }
    const dir = mkdtempSync(join(tmpdir(), 'rs530-hd-packet-'));
    try {
        const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
        const compiler = Bun.spawnSync(['javac', '-encoding', 'UTF-8', '-cp', cp, '-d', dir, join(import.meta.dir, 'HdPacketWritersOracle.java')]);
        expect(compiler.exitCode, compiler.stderr.toString()).toBe(0);
        const lines = rows.map(([op, bits, pos, len]) => [op, bits.toString(16), pos, len].join(' '));
        const oracle = Bun.spawnSync(['java', '-XX:-OmitStackTraceInFastThrow', '-Djava.awt.headless=true', '-cp', cp, 'HdPacketWritersOracle'], { stdin: Buffer.from(lines.join('\n') + '\n') });
        expect(oracle.exitCode, oracle.stderr.toString()).toBe(0);
        const expected = oracle.stdout.toString().trimEnd().split(/\r?\n/);
        expect(expected).toHaveLength(rows.length);
        for (const [i, row] of rows.entries()) {
            expect(run(row), lines[i]).toBe(expected[i]);
            if (row[0] === 'float' || row[0] === 'floatLE') expect(run(row, true), lines[i]).toBe(expected[i]);
        }
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}, 30000);
