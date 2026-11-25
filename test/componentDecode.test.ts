import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';

import JagString, { fromJsString } from '#/datastruct/JagString.js';
import { arrayAt, requireNonNull } from '#/util/JavaArray.js';
import { ClientScript } from '#/script/ClientScript.js';
import HookReq from '#/script/HookReq.js';
import ScriptRunner from '#/script/ScriptRunner.js';
import PacketT from '#/io/PacketT.js';
import IfType from '#/ui/IfType.js';
import LocalisedText from '#/ui/LocalisedText.js';
import { mix, valueHash, componentFields } from './componentState.js';
import { localAssets } from './cachefile.js';
import { cachePath, gamepackPath } from './reference.js';

type Record = { uid: number; bytes: Uint8Array | null };

function edgeRecords(): Record[] {
    const prefix = 'ff864d00809afffe7fff001701f001ff0304000210';
    // Named type 6, two active size modes, signed offsets and optional model extents.
    const model = 'ffff80007fff0001020304050607ffff01aaaabbbb7f00080009';
    // Two key slots including rate 4095, three operation labels, two cursor overrides.
    const flags = '000800',
        keys = '1fffff81a034ff7f00';
    const options = '466f6f0023800000ff0004123402ffff';
    const dragAndTarget = '0301017665726200ffff427affff';
    // Unknown hook tag is retained as a null slot, followed by an int and a Latin-1 string.
    const hooks = '03020089abcdef0180ff00' + '00'.repeat(18) + '01007fffffff';
    const triggers = '02800000007fffffff000100000011000100000022';
    const head = prefix + model + flags;
    const valid = head + keys + options + dragAndTarget + hooks + triggers;
    const legacy = (type: number, button: number) => [type, button].map(b => b.toString(16).padStart(2, '0')).join('') + '432180007fff00020003ffffff00040101ffff010002ffff8000';
    const options1 = '410000fe00004200';
    const legacyInventory = legacy(2, 2) + '010101010405' + '0180007fff8000ffff' + '00'.repeat(19) + options1 + '766572620074617267657400ffff';
    const legacyInventoryText = legacy(7, 4) + '02ffff01ff00ff0080007fff01' + options1 + '00';
    const validBytes = [valid, valid + '5ac3', legacyInventory, legacyInventoryText, ...[1, 4, 5, 6].map(button => legacy(8, button) + 'ff800000')];
    const malformed = [
        head + '0100', // key slot -1
        head + 'b000', // key slot 10
        head + '00002000123401abcd', // second cursor outside first cursor allocation
        valid.slice(0, -2), // truncated trigger, after allocating the hook fields
        'ff048000' // truncated signed coordinate
    ];
    return [...validBytes, ...malformed].map((hex, i) => ({ uid: 0x80010000 | i, bytes: Buffer.from(hex, 'hex') }));
}

test('all archive 3 component fields, failed reads and cursor positions match the original aj decoders', () => {
    const initial = new IfType();
    expect(['o', 'Vc', 'md'].filter(key => Object.hasOwn(initial, key))).toEqual([]);
    const assets = localAssets(cachePath, [3]);
    const records: Record[] = [{ uid: -1, bytes: null }];
    for (const group of requireNonNull(requireNonNull(assets.index(3)).groupIds)) {
        const files = requireNonNull(assets.files(3, group));
        for (let i = 0; i < files.length; i++) {
            const bytes = files[i];
            if (bytes) records.push({ uid: (group << 16) + i, bytes });
        }
    }
    const cacheCount = records.length - 1;
    expect(cacheCount).toBe(31528);
    records.push(...edgeRecords());

    const fields = componentFields();
    const input: Buffer[] = [Buffer.alloc(4)];
    input[0].writeInt32BE(records.length);
    let cursorHash = 1,
        errors = 0;
    for (const [i, { uid, bytes }] of records.entries()) {
        const header = Buffer.alloc(8);
        header.writeInt32BE(uid, 0);
        header.writeInt32BE(bytes?.length ?? -1, 4);
        input.push(header);
        const c = new IfType();
        let cursor = 0;
        if (bytes) {
            input.push(Buffer.from(bytes));
            const p = new PacketT(bytes);
            c.id = uid;
            try {
                if (bytes[0] === 255) c.Decode3(p);
                else c.Decode(p);
                cursor = p.m_pos;
            } catch (e) {
                if (i <= cacheCount) throw new Error('Failed to decode cache component ' + uid, { cause: e });
                errors++;
                cursor = ~p.m_pos;
            }
        }
        cursorHash = mix(cursorHash, cursor);
        for (const f of fields) f.hash = mix(f.hash, valueHash(c[f.member]));
    }
    const out = resolve(import.meta.dir, '../out');
    mkdirSync(out, { recursive: true });
    const scratch = mkdtempSync(join(out, 'component-decode-'));
    try {
        const jar = gamepackPath;
        const source = resolve(import.meta.dir, 'ui/ComponentOracle.java');
        const compile = Bun.spawnSync(['javac', '-cp', jar, '-d', scratch, source], { timeout: 20000 });
        if (compile.exitCode) throw new Error(compile.stderr.toString());
        const path = join(scratch, 'components.bin');
        writeFileSync(path, Buffer.concat(input));
        const result = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', scratch + delimiter + jar, 'ComponentOracle'], { stdin: Bun.file(path), timeout: 30000 });
        if (result.exitCode) throw new Error(result.stderr.toString());
        const [stats, ...rows] = result.stdout.toString().trim().split(/\r?\n/);
        expect([records.length, errors, cursorHash].join(' ')).toBe(stats);
        expect(rows.splice(0, fields.length)).toEqual(fields.map(f => [f.name, f.descriptor, f.hash].join(' ')));
        expect(errors).toBe(5);
        const c = new IfType();
        const label = fromJsString('Example');
        let writeErrors = 0;
        for (const i of [-1, 3, 7, 2, -1]) {
            try {
                c.SetOpName(i, label);
            } catch {
                writeErrors++;
            }
            try {
                c.setOpCursor(i, i + 81);
            } catch {
                writeErrors++;
            }
            expect([valueHash(c.operationNames), valueHash(c.opCursors), writeErrors].join(' ')).toBe(requireNonNull(rows.shift()));
        }
        expect(String(arrayAt(c.operationNames, 2) === label)).toBe(requireNonNull(rows.shift()));
        c.itemIds = Int32Array.of(10, 20, 30);
        c.itemCounts = Int32Array.of(40, 50, 60);
        c.SwapSlots(2, 0);
        c.itemCounts = Int32Array.of(25);
        try {
            c.SwapSlots(1, 0);
        } catch {
            writeErrors++;
        }
        expect([valueHash(c.itemIds), valueHash(c.itemCounts), writeErrors].join(' ')).toBe(requireNonNull(rows.shift()));
        const original = { ...LocalisedText };
        try {
            for (const language of [0, 1, 0, 2]) {
                LocalisedText.setLanguage(language);
                for (const button of [1, 4, 5, 6]) {
                    const data = Buffer.from('08000000000000000001000100ffffffff00000000', 'hex');
                    data[1] = button;
                    const localized = new IfType();
                    const initialIdentity = localized.buttonTextValue === LocalisedText.ok;
                    localized.Decode(new PacketT(data));
                    const expected = button === 1 ? LocalisedText.ok : button === 6 ? LocalisedText.continue : LocalisedText.select;
                    expect([language, button, initialIdentity, expected === localized.buttonTextValue, valueHash(localized.buttonTextValue)].join(' ')).toBe(requireNonNull(rows.shift()));
                }
            }
        } finally {
            Object.assign(LocalisedText, original);
        }
        expect(rows).toHaveLength(0);
    } finally {
        rmSync(scratch, { recursive: true, force: true });
    }
}, 60000);

test('CS2 component operation labels, text and hook arguments retain JagString identities', () => {
    const c = new IfType();
    const saved = ScriptRunner.activeComponent,
        text = fromJsString('Example');
    const code = new ClientScript(),
        event = new HookReq();
    event.args = [0];
    const runner = new ScriptRunner(
        () => code,
        error => {
            throw error;
        }
    );
    const run = (opcode: number, ...values: (number | JagString | null)[]) => {
        code.opcodes = Int32Array.from([...values.map(value => (typeof value === 'number' ? 0 : 3)), opcode, 21]);
        code.intOperands = Int32Array.from([...values.map(value => (typeof value === 'number' ? value : 0)), 0, 0]);
        code.stringOperands = [...values.map(value => (typeof value === 'number' ? null : value)), null, null];
        runner.run(event);
    };
    try {
        ScriptRunner.activeComponent = c;
        run(1112, text);
        run(1112, fromJsString('Example'));
        run(1602);
        expect(ScriptRunner.stringStack[0]).toBe(text);
        run(1300, 2, text);
        run(1801, 2);
        expect(ScriptRunner.stringStack[0]).toBe(text);
        run(1407, 355, text, null, 123, 1, fromJsString('ssY'));
        expect(arrayAt(c.onVarTransmit, 1)).toBe(text);
        expect(arrayAt(c.onVarTransmit, 2)).toBeNull();
        expect(c.varTriggers).toEqual(Int32Array.of(123));
        run(1407, -1, fromJsString(''));
        expect(c.hasHook).toBe(true);
        expect(c.onVarTransmit).toBeNull();
        expect(c.varTriggers).toBeNull();
    } finally {
        ScriptRunner.activeComponent = saved;
    }
});
