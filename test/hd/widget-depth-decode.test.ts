import { expect } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import PacketT from '#/io/PacketT.js';
import JagString from '#/datastruct/JagString.js';
import IfType from '#/ui/IfType.js';
import ServerActiveProperties from '#/ui/ServerActiveProperties.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { localAssets } from '../cachefile.js';
import { componentFields, valueHash } from '../componentState.js';
import { loginFixture } from '../login-fixture.js';
import { cachePath } from '../reference.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

type Widget = { id: number; if3: boolean; bytes: Uint8Array };

function snapshot({ id, if3, bytes }: Widget) {
    const c = new IfType();
    c.id = id;
    const packet = new PacketT(bytes);
    let status = 'ok';
    try {
        if (if3) c.Decode3(packet);
        else c.Decode(packet);
    } catch (error) {
        if (!(error instanceof RangeError) || !/^(byte array|array) index -?\d+$/.test(error.message)) throw error;
        status = 'bounds ' + error.message.split(' ').at(-1);
    }
    const summary = [
        c.id,
        status,
        packet.m_pos,
        c.type,
        c.if3,
        c.modelType,
        c.modelId,
        c.modelOriginX,
        c.modelOriginY,
        c.modelXAngle,
        c.modelYAngle,
        c.modelZAngle,
        c.modelZoom,
        c.modelAnim,
        c.modelOrtho,
        c.Vc,
        c.o,
        c.md,
        c.modelWidth,
        c.modelHeight,
        c.targetOverCursor,
        c.targetLeaveCursor
    ].join('|');
    return { component: c, summary };
}

// be's Decode/Decode3 stores and downstream CS2/UI reads identify the counterpart of each aj member.
function mappedFields(buffer: Buffer) {
    const sd = new Map(componentFields().map(field => [field.name, field]));
    const extra: Record<string, { descriptor: string; member: keyof IfType }> = {
        Vc: { descriptor: 'S', member: 'Vc' },
        o: { descriptor: 'S', member: 'o' },
        md: { descriptor: 'Z', member: 'md' }
    };
    const mapping = new Map<string, { descriptor: string; member: keyof IfType }>();
    for (const row of readFileSync(join(import.meta.dir, 'widget-fields.tsv'), 'utf8')
        .trimEnd()
        .split(/\r?\n/)) {
        if (row.startsWith('#')) continue;
        const [aj, be] = row.split('\t');
        const field = aj === '-' ? extra[be] : requireNonNull(sd.get(aj) ?? null);
        if (aj !== '-') sd.delete(aj);
        expect(mapping.has(be)).toBe(false);
        mapping.set(be, field);
    }
    expect(sd.size).toBe(0);
    const count = buffer.readInt32BE(0);
    expect([count, mapping.size]).toEqual([157, 157]);
    let offset = 4;
    const readUtf = () => {
        const length = buffer.readUInt16BE(offset);
        offset += length + 2;
        return buffer.toString('ascii', offset - length, offset);
    };
    const fields = [];
    for (let i = 0; i < count; i++) {
        const name = readUtf();
        const descriptor = readUtf().replace('Lna;', 'Lid;').replace('Lbe;', 'Laj;').replace('Lbf;', 'Ll;');
        const field = requireNonNull(mapping.get(name) ?? null);
        expect(descriptor).toBe(field.descriptor);
        fields.push({ name, member: field.member, reference: descriptor.startsWith('L') || descriptor.startsWith('[') });
    }
    return { fields, start: offset };
}

// Read every reference even after a mismatch so the next field stays aligned. This distinguishes null from empty,
// equal string hashes with different bytes, and arrays with different elements or nesting.
class ReferenceValues {
    offset = 0;
    constructor(readonly bytes: Buffer) {}
    int(): number {
        const n = this.bytes.readInt32BE(this.offset);
        this.offset += 4;
        return n;
    }
    matches(actual: unknown): boolean {
        const tag = this.bytes.readUInt8(this.offset++);
        if (tag === 0) return actual === null;
        if (tag === 1) return this.int() === actual;
        if (tag === 2) {
            const length = this.int();
            const data = this.bytes.subarray(this.offset, this.offset + length);
            this.offset += length;
            return actual instanceof JagString && actual.length === length && data.equals(requireNonNull(actual.bytes).subarray(0, length));
        }
        if (tag === 3) {
            const events = this.int(),
                target = this.int();
            return actual instanceof ServerActiveProperties && events === actual.events && target === actual.targetParam;
        }
        if (tag !== 4) throw new Error('Unknown JAR field value tag ' + tag);
        const count = this.int();
        const array = Array.isArray(actual) || actual instanceof Int32Array || actual instanceof Int8Array ? actual : null;
        let equal = array !== null && array.length === count;
        for (let i = 0; i < count; i++) if (!this.matches(array?.[i])) equal = false;
        return equal;
    }
}

loginFixture(
    import.meta.url,
    'all 157 HD widget fields and partial decodes match the original across archive 3',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), '530-hd-widget-depth-'));
        try {
            const assets = localAssets(cachePath, [3]);
            const records: Widget[] = [];
            let modelWidgets = 0;
            for (const group of requireNonNull(requireNonNull(assets.index(3)).groupIds)) {
                const files = requireNonNull(assets.files(3, group));
                for (const [file, bytes] of files.entries()) {
                    if (bytes === null || bytes === undefined) continue;
                    const if3 = bytes[0] === 255;
                    records.push({ id: (group << 16) | file, if3, bytes });
                    if (if3 && (bytes[1] & 127) === 6) modelWidgets++;
                }
            }
            expect(records).toHaveLength(31528);
            expect(modelWidgets).toBe(5705);
            const cacheCount = records.length;
            const prefix = 'ff060000000000000001000101010000ffff00' + '002afedcabcd1234234534564567000301';
            const tail = '0011002200080000000000000000ffff1234ffff' + '00'.repeat(25);
            for (const fields of ['0000000000', '7fff800001', '8000ffff02', 'ffff7fffff']) {
                const model = Buffer.from(prefix + fields + tail, 'hex');
                for (let end = 0; end <= model.length; end++) {
                    records.push({ id: -records.length, if3: true, bytes: model.subarray(0, end) });
                }
            }
            const modelCasesEnd = records.length;
            const hookStart = Buffer.from(prefix + '7fff800001' + tail.slice(0, -50), 'hex');
            const hookParts = [hookStart];
            for (let i = 0; i < 20; i++) {
                const args = Buffer.alloc(6);
                args[0] = 2; // one signed int and one distinct JagString per hook
                args.writeInt32BE(-10000 - i, 2);
                hookParts.push(args, Buffer.from([1, 128 + i, 65 + i, 0]));
            }
            for (let i = 0; i < 5; i++) {
                const triggers = Buffer.alloc(9);
                triggers[0] = 2;
                triggers.writeInt32BE(i + 17, 1);
                triggers.writeInt32BE(~i, 5);
                hookParts.push(triggers);
            }
            const hooks = Buffer.concat(hookParts);
            for (let end = hookStart.length; end <= hooks.length; end++) {
                records.push({ id: -records.length, if3: true, bytes: hooks.subarray(0, end) });
            }
            const input = [Buffer.alloc(4)];
            input[0].writeInt32BE(records.length);
            for (const { id, if3, bytes } of records) {
                const header = Buffer.alloc(9);
                header.writeInt32BE(id);
                header[4] = Number(if3);
                header.writeInt32BE(bytes.length, 5);
                input.push(header, Buffer.from(bytes));
            }
            const source = join(dir, 'widgets.bin'),
                result = join(dir, 'jar.txt');
            const state = join(dir, 'fields.bin'),
                valuesPath = join(dir, 'values.bin');
            writeFileSync(source, Buffer.concat(input));
            const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
            const compiler = Bun.spawnSync(['javac', '-cp', cp, '-d', dir, join(import.meta.dir, 'HdWidgetDepthOracle.java')]);
            expect(compiler.exitCode, compiler.stderr.toString()).toBe(0);
            const oracle = Bun.spawnSync(['java', '-XX:-OmitStackTraceInFastThrow', '-Djava.awt.headless=true', '-cp', cp, 'HdWidgetDepthOracle', source, result, state, valuesPath]);
            expect(oracle.exitCode, oracle.stderr.toString()).toBe(0);
            const expected = readFileSync(result, 'utf8').trimEnd().split(/\r?\n/);
            expect(expected).toHaveLength(records.length);
            const cached = expected.slice(0, cacheCount).map(row => row.split('|'));
            expect(cached.every(row => row[1] === 'ok')).toBe(true);
            const models = cached.filter(row => row[3] === '6' && row[4] === 'true');
            expect([models.length, models.filter(row => row[15] !== '0').length, models.filter(row => row[16] !== '3000').length, models.filter(row => row[17] === 'true').length]).toEqual([5705, 4534, 1434, 119]);
            expect(expected.slice(cacheCount, modelCasesEnd).filter(row => row.split('|')[1] === 'ok')).toHaveLength(4);
            expect(expected.slice(modelCasesEnd).filter(row => row.split('|')[1] === 'ok')).toHaveLength(1);
            const differences: { index: number; actual: string; java: string }[] = [];
            const fieldDifferences = new Map<string, { id: number; index: number; hd: string; actual: number; java: number }>();
            const binary = readFileSync(state);
            const references = new ReferenceValues(readFileSync(valuesPath));
            const { fields, start } = mappedFields(binary);
            let offset = start;
            expect(binary.length).toBe(start + records.length * fields.length * 4);
            for (const [i, widget] of records.entries()) {
                const { summary: actual, component } = snapshot(widget);
                if (expected[i] !== actual && differences.length < 12) differences.push({ index: i, actual, java: expected[i] });
                for (const field of fields) {
                    const actualField = component[field.member];
                    const value = valueHash(actualField);
                    const java = binary.readInt32BE(offset);
                    offset += 4;
                    const exact = !field.reference || references.matches(actualField);
                    if ((!exact || value !== java) && !fieldDifferences.has(field.member)) {
                        fieldDifferences.set(field.member, { id: widget.id, index: i, hd: field.name, actual: value, java });
                    }
                }
            }
            expect(references.offset).toBe(references.bytes.length);
            expect(differences).toEqual([]);
            expect(Object.fromEntries(fieldDifferences)).toEqual({});
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    60000,
    'gl'
);
