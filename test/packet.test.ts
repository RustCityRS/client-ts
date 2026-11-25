import { requireNonNull } from '../src/util/JavaArray.js';
import { gamepackPath } from './reference.js';
import { expect, test } from 'bun:test';
import { fileURLToPath } from 'node:url';
import Linkable from '../src/datastruct/Linkable.js';
import JagString from '../src/datastruct/JagString.js';
import PacketT from '../src/io/PacketT.js';
import ByteArrayPool from '../src/io/ByteArrayPool.js';

const hex = (bytes: Uint8Array | null) => Buffer.from(requireNonNull(bytes)).toString('hex');
const jag = (bytes: Uint8Array) => JagString.fromBytes(bytes, 0, bytes.length);
type Arg = number | boolean | bigint | Uint8Array | Int32Array | JagString;

function nodeTrace(): string {
    const nodes = [new Linkable(), new Linkable(), new Linkable()];
    for (let i = 0; i < 3; i++) {
        nodes[i].prev = nodes[(i + 2) % 3];
        nodes[i].next = nodes[(i + 1) % 3];
        nodes[i].key = -(1n << 63n) + BigInt(i);
    }
    const trace = [];
    for (const i of [-1, 1, 1, 0, 2]) {
        if (i >= 0) nodes[i].Unlink();
        for (const node of nodes) trace.push([node.IsLinked(), node.key, node.next === null ? -1 : nodes.indexOf(node.next), node.prev === null ? -1 : nodes.indexOf(node.prev)].join(','));
    }
    return trace.join(' ');
}

test('every gd instance method matches the jar, including cursor and partial writes on exceptions', () => {
    const commands: string[] = [],
        results: string[] = [];
    const methods = new Set<string>();
    const source = Uint8Array.from({ length: 24 }, (_, i) => (i * 197 + 255) & 255);
    function vector(descriptor: string, method: keyof PacketT, bytes: Uint8Array, pos: number, args: Arg[], tsArgs: Arg[] = []): void {
        methods.add(descriptor);
        const token = (arg: Arg) => (arg instanceof Uint8Array ? hex(arg) : arg instanceof JagString ? hex(arg.bytes) : String(arg));
        commands.push([descriptor, hex(bytes), pos, ...args.map(token)].join('\t'));
        const packet = new PacketT(bytes.slice());
        packet.m_pos = pos;
        let result: string;
        try {
            const invoke = packet[method] as (...args: Arg[]) => unknown;
            const value = invoke.apply(packet, tsArgs);
            result = value instanceof JagString ? 'str=' + value.length + ':' + hex(value.bytes) : String(value ?? null);
        } catch {
            result = 'exception';
        }
        results.push([result, packet.m_pos, hex(packet.m_data), ...args.filter(arg => arg instanceof Uint8Array).map(hex)].join(' '));
    }

    const readers: [string, keyof PacketT, number][] = [
        ['f(B)I', 'g1', -113],
        ['m(B)B', 'g1s', 1],
        ['q(B)I', 'g1_alt1', 86],
        ['e(B)I', 'g1_alt2', -80],
        ['i(I)I', 'g1_alt3', 128],
        ['e(I)B', 'g1s_alt2', -112],
        ['n(B)B', 'g1s_alt3', 127],
        ['t(B)B', 'g1s_alt1', 111],
        ['c(I)I', 'g2', -2386],
        ['d(B)I', 'g2_alt2', 22],
        ['g(B)I', 'g2_alt1', -105],
        ['r(B)I', 'g2_alt3', -88],
        ['p(B)I', 'g2s', 100],
        ['i(B)I', 'g2s_alt2', -100],
        ['c(B)I', 'g2s_alt1', 53],
        ['j(B)I', 'ig2bAdd', -100],
        ['j(I)I', 'g3', 65280],
        ['h(I)I', 'ig3', -16196],
        ['h(B)I', 'g4', 127],
        ['b(I)I', 'g4_alt1', 4],
        ['s(B)I', 'g4_alt2', 106],
        ['l(B)I', 'g4_alt3', 55],
        ['a(I)J', 'g8', -9426],
        ['g(I)I', 'gSmart1or2', -48],
        ['d(I)I', 'gSmart1or2s', -15839],
        ['o(B)I', 'gSmartsExtend', -60],
        ['k(B)I', 'gMidiVarLen', -29],
        ['l(I)Lid;', 'gStringNoConversion', -1],
        ['k(I)Lid;', 'readNullableJagString', 97]
    ];
    for (const [descriptor, name, guard] of readers) {
        for (const bytes of [source, Uint8Array.of(0, 255, 255, 255, 255, 255, 255, 128, 13, 0, 65, 255, 0)]) {
            for (const pos of [-1, 0, 1, 5, bytes.length - 1, bytes.length, 2147483647]) vector(descriptor, name, bytes, pos, [guard]);
        }
    }
    for (const advance of [0, 1, 2, 3, 5, 7]) vector('b(I)I', 'g4_alt1', source, 4, [advance], [advance]);
    const writers: [string, keyof PacketT, (n: number) => number[]][] = [
        ['b(BI)V', 'p1', n => [4, n]],
        ['d(II)V', 'p1_alt1', n => [-27699, n]],
        ['a(IB)V', 'p1_alt3', n => [n, 120]],
        ['i(II)V', 'p2', n => [16711680, n]],
        ['g(II)V', 'p2_alt1', n => [n, 1608904784]],
        ['f(II)V', 'p2_alt2', n => [n, -12196]],
        ['f(BI)V', 'p2_alt3', n => [100, n]],
        ['c(II)V', 'p3', n => [n, -100]],
        ['h(II)V', 'p4', n => [n, 118]],
        ['e(BI)V', 'p4_alt1', n => [100, n]],
        ['a(II)V', 'p4_alt3', n => [n, -100]],
        ['b(II)V', 'p4_alt2', n => [n, 30]],
        ['c(BI)V', 'pSmart1or2', n => [60, n]],
        ['a(BI)V', 'pMidiVarLen', n => [120, n]]
    ];
    for (const [descriptor, name, args] of writers) {
        for (const n of [-2147483648, -1, 0, 127, 128, 16383, 16384, 32767, 32768, 0x12345678, 2147483647]) {
            for (const pos of [0, source.length - 2, 2147483647]) vector(descriptor, name, source, pos, args(n), [n]);
        }
    }
    for (const size of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]) {
        for (const n of [-0x7112233445566778n, 0x1122334455667788n, -1n]) {
            vector('a(IJ)V', 'p8', source, 2, [2, n], [n]);
            vector('a(IJI)V', 'pX', source, 2, [size, n, 32767], [size, n]);
        }
        vector('d(BI)J', 'gX', source, 0, [-100, size], [size]);
        vector('j(II)V', 'pSize1', source, 7, [127, size], [size]);
        vector('e(II)V', 'pSize4', source, 7, [size, 100], [size]);
    }
    for (const pos of [0, 1, 23]) {
        for (const length of [-1, 0, 1, 3, 7]) {
            const make = () => Uint8Array.of(23, 62, 129, 255, 0, 74);
            let arg = make();
            vector('a(I[BII)V', 'pArrayBuffer', source, pos, [125, arg, length, 2], [arg, length, 2]);
            arg = make();
            vector('a(III[B)V', 'gArrayBuffer', source, pos, [length, 2, -2, arg], [length, 2, arg]);
            arg = make();
            vector('a(II[BB)V', 'gdataReverse', source, pos, [length, 2, arg, -90], [length, 2, arg]);
        }
        for (const bytes of [source, Uint8Array.of(0), Uint8Array.of(0, 128, 255, 0)]) {
            vector('b(Z)Lid;', 'readVersionedJagString', bytes, pos, [true]);
        }
        const value = jag(Uint8Array.of(65, 128, 255));
        vector('a(Lid;B)V', 'pStringNoConversion', source, pos, [value, -2], [value, -2]);
        vector('g(BI)I', 'addCrc', source, pos, [127, 0], [0]);
    }
    for (const end of [0, 7, 8, 13, 21, 32]) {
        for (const key of [Int32Array.of(0, 0, 0, 0), Int32Array.of(-1, 2147483647, 12345, -2147483648), Int32Array.of(1)]) {
            vector('a(I[III)V', 'tinyKeyDecrypt', source, 3, [-100, key, 5, end], [key, 5, end]);
        }
    }
    for (const pos of [0, 1, 2, 4, 8]) {
        for (const modulus of [1n, 257n, 4294967311n, 0n]) {
            for (const exponent of [-3n, 0n, 1n, 65537n]) {
                vector('a(Ljava/math/BigInteger;BLjava/math/BigInteger;)V', 'rsaEncrypt', source, pos, [exponent, 100, modulus], [exponent, modulus]);
            }
        }
    }
    const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', gamepackPath, fileURLToPath(new URL('./io/PacketOracle.java', import.meta.url))], { stdin: Buffer.from(commands.join('\n') + '\n'), timeout: 30000 });
    expect(java.stderr.toString()).toBe('');
    expect(java.exitCode).toBe(0);
    const [inventory, node, ...records] = java.stdout.toString().trimEnd().split(/\r?\n/);
    expect([...methods].sort()).toEqual(inventory.split(' '));
    expect(node).toBe(nodeTrace());
    for (const [pool, count, size] of [
        ['small', 'smallCount', 100],
        ['medium', 'mediumCount', 5000],
        ['large', 'largeCount', 30000]
    ] as const) {
        const slots = ByteArrayPool[pool],
            previous = ByteArrayPool[count];
        const marker = Uint8Array.of(145);
        ByteArrayPool[pool] = [null, marker];
        ByteArrayPool[count] = 2;
        try {
            for (let i = 0; i < 3; i++) {
                const packet = new PacketT(size);
                let result: string;
                try {
                    result = String(packet.g1());
                } catch {
                    result = 'exception';
                }
                expect([packet.m_data?.length ?? -1, packet.m_data === marker, result, packet.m_pos, ByteArrayPool[count], ByteArrayPool[pool][1] === null].join(' ')).toBe(requireNonNull(records.shift()));
            }
            ByteArrayPool[count] = 3;
            expect(() => new PacketT(size)).toThrow();
            expect('exception ' + ByteArrayPool[count]).toBe(requireNonNull(records.shift()));
        } finally {
            ByteArrayPool[pool] = slots;
            ByteArrayPool[count] = previous;
        }
    }
    expect(records.length).toBe(results.length);
    for (let i = 0; i < records.length; i++) expect(results[i], commands[i]).toBe(records[i]);
}, 45000);
