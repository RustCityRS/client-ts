import { requireNonNull } from '../src/util/JavaArray.js';
import { gamepackPath } from './reference.js';
import { expect, test } from 'bun:test';
import { fileURLToPath } from 'node:url';
import { fromJsString, type default as JagString } from '#/datastruct/JagString.js';
import IntNode from '#/datastruct/IntNode.js';
import PacketT from '#/io/PacketT.js';
import { ClientScript } from '#/script/ClientScript.js';
import { bitCeil } from '#/util/IntUtils.js';
import { scriptArchive } from './script-archive.js';
import ClientGosubFrame from '#/script/ClientGosubFrame.js';

function script(tables: [number, number][][], count: number): Uint8Array {
    const p = new PacketT(512);
    p.pStringNoConversion(fromJsString('S\x80\xff'), 0);
    p.p2(3);
    p.pStringNoConversion(fromJsString('\x81\xb5'), 0);
    p.p2(0);
    p.p4(-2147483648);
    p.p2(21);
    p.p1(3);
    p.p4(count);
    for (const field of [7, 8, 3, 4]) p.p2(field);
    const start = p.m_pos;
    p.p1(tables.length);
    for (const table of tables) {
        p.p2(table.length);
        for (const [key, offset] of table) {
            p.p4(key);
            p.p4(offset);
        }
    }
    p.p2(p.m_pos - start);
    return requireNonNull(p.m_data).slice(0, p.m_pos);
}

test('j.a preserves switch chains, byte-string operands and LRU identity across eviction', () => {
    const texts = ['', 'a\0bc\0zx', String.fromCharCode(...Array.from({ length: 256 }, (_, i) => i)), '\u20ac\u0100\ud83d\ude43\ud800a\udc00', 'x\0\0xx'];
    const powers = [-2147483648, -1, 0, 1, 2, 3, 15, 16, 17, 32769, 1073741824, 1073741825, 2147483647];
    const dense = script(
        [
            [],
            [
                [0, -1],
                [-2147483648, 17],
                [4, 24],
                [0, -18],
                [2147483647, -127]
            ]
        ],
        3
    );
    const sparse = script(
        [
            [
                [31, 13],
                [30, -19],
                [-1, 22]
            ]
        ],
        5
    );
    const plain = script([], 3);
    const malformed = script([], 2);
    const groups = Array.from<unknown, Uint8Array | null>({ length: 134 }, () => dense);
    groups[1] = sparse;
    groups[2] = plain;
    groups[3] = malformed;
    groups[4] = null;
    const calls = [0, 1, 2, 3, 4, 0, 1, 2, ...Array.from({ length: 126 }, (_, i) => i + 5), 0, 132, 1, 2, 0];

    const chunks: Buffer[] = [];
    const word = (value: number) => {
        const bytes = Buffer.alloc(4);
        bytes.writeInt32BE(value);
        chunks.push(bytes);
    };
    word(texts.length);
    for (const text of texts) {
        word(text.length);
        const chars = Buffer.alloc(text.length * 2);
        for (let i = 0; i < text.length; i++) chars.writeUInt16BE(text.charCodeAt(i), i * 2);
        chunks.push(chars);
    }
    word(powers.length);
    powers.forEach(word);
    word(groups.length);
    for (const group of groups) {
        word(group?.length ?? -1);
        if (group) chunks.push(Buffer.from(group));
    }
    word(calls.length);
    calls.forEach(word);
    const source = fileURLToPath(new URL('./game/ScriptLoaderOracle.java', import.meta.url));
    const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', gamepackPath, source], { stdin: Buffer.concat(chunks), timeout: 20000 });
    expect(java.stderr.toString()).toBe('');
    expect(java.exitCode).toBe(0);
    let cursor = 0;
    const read = () => {
        const v = java.stdout.readInt32BE(cursor);
        cursor += 4;
        return v;
    };
    const compareString = (v: JagString | null) => {
        expect(v?.length ?? -1).toBe(read());
        if (v === null) return;
        const bytes = requireNonNull(v.bytes);
        expect(bytes.length).toBe(read());
        expect(Buffer.compare(bytes, java.stdout.subarray(cursor, cursor + bytes.length))).toBe(0);
        cursor += bytes.length;
    };
    const compareScript = (s: ClientScript) => {
        compareString(s.name);
        expect([s.intLocals, s.stringLocals, s.intArgs, s.stringArgs]).toEqual(Array.from({ length: 4 }, read));
        expect(s.opcodes?.length ?? -1).toBe(read());
        if (s.opcodes === null) {
            expect(s.intOperands).toBeNull();
            expect(s.stringOperands).toBeNull();
        } else {
            if (s.intOperands === null || s.stringOperands === null) throw new Error('Missing instruction operands');
            for (let i = 0; i < s.opcodes.length; i++) {
                expect(s.opcodes[i]).toBe(read());
                expect(s.intOperands[i]).toBe(read());
                compareString(s.stringOperands[i]);
            }
        }
        expect(s.switches?.length ?? -1).toBe(read());
        for (const slot of s.switches ?? []) {
            const table = requireNonNull(slot);
            expect(table.capacity).toBe(read());
            for (const head of table.buckets) {
                for (let node = head.next; node !== head; node = requireNonNull(node).next) {
                    expect(read()).toBe(1);
                    expect(Number(requireNonNull(node).key)).toBe(read());
                    expect((node as IntNode).value).toBe(read());
                }
                expect(read()).toBe(0);
            }
        }
    };
    for (const text of texts) compareString(fromJsString(text));
    for (const value of powers) expect(bitCeil(value)).toBe(read());
    compareScript(new ClientScript());
    const frame = new ClientGosubFrame();
    expect([frame.pc, Number(frame.script !== null), Number(frame.strings !== null), Number(frame.ints !== null)]).toEqual(Array.from({ length: 4 }, read));

    using _archive = scriptArchive(id => groups[id] ?? null);
    const identities = new Map<ClientScript, number>();
    for (let i = 0; i < calls.length; i++) {
        let object: ClientScript | null = null;
        let identity: number;
        try {
            object = ClientScript.Get(calls[i]);
            if (object === null) identity = -1;
            else {
                if (!identities.has(object)) identities.set(object, identities.size);
                identity = requireNonNull(identities.get(object));
            }
        } catch {
            identity = -2;
        }
        expect(identity).toBe(read());
        if (i < 5 && object !== null) compareScript(object);
    }
    expect(cursor).toBe(java.stdout.length);
    const resident = ClientScript.Get(0);
    ClientScript.m_cache.Reset();
    expect(ClientScript.Get(0)).not.toBe(resident);
}, 30000);
