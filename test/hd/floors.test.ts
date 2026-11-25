import { expect } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Js5 from '#/cache/Js5.js';
import Js5Index from '#/cache/Js5Index.js';
import FloType from '#/config/FloType.js';
import FluType from '#/config/FluType.js';
import Crc32 from '#/io/Crc32.js';
import PacketT from '#/io/PacketT.js';
import { requireNonNull } from '#/util/JavaArray.js';
import RunetekColour from '#/util/RunetekColour.js';
import { readGroup } from '../cachefile.js';
import { loginFixture } from '../login-fixture.js';
import { cachePath } from '../reference.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';

function fields(type: FloType | FluType): string {
    return (
        type instanceof FloType
            ? [type.m_hasSmoothEdges, type.field_77, type.m_materialID, type.m_textureScale, type.m_priority, type.field_84, type.secondaryColour, type.occludes, type.colour, type.field_80]
            : [type['rgb'], type.m_materialID, type.m_textureScale, type.field_68, type.chroma, type.saturation, type.lightness, type.weightedHue]
    ).join(',');
}

function result(operation: () => unknown): string {
    try {
        operation();
        return 'ok';
    } catch (error) {
        if (error instanceof RangeError && error.message.startsWith('byte array')) return 'bounds:' + error.message.split(' ').at(-1);
        if (error instanceof TypeError && error.message === 'Null reference') return 'null';
        if (error instanceof TypeError && error.message.startsWith('ClassCastException')) return 'cast';
        throw error;
    }
}

loginFixture(
    import.meta.url,
    'HD floor archives, cache lookup and every floor field match wl and ni',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), '530-hd-floors-'));
        try {
            const ref = readGroup(cachePath, 255, 2),
                groups = new Map<number, Uint8Array>();
            writeFileSync(join(dir, 'index'), ref);
            for (const group of [1, 4]) {
                const bytes = readGroup(cachePath, 2, group);
                groups.set(group, bytes);
                writeFileSync(join(dir, 'group-' + group), bytes);
            }
            const index = new Js5Index(ref, Crc32.prefix(ref, ref.length));
            const archive = new Js5({ index: () => index, group: (_mode, id) => groups.get(id) ?? null, GetGroupLoadPercentage: id => (groups.has(id) ? 100 : 0), prefetchGroup: () => {} }, false, false);
            const cases: [number, number, string][] = [];
            for (const [group, payload] of [
                [1, '0112345602ffff0301000402fffeff00'],
                [4, '01ff00ff02ff03ffff0507012345080900800a0bff0c0dabcdef0eff00']
            ] as const) {
                for (let length = 0; length <= payload.length; length += 2) cases.push([group, -17, payload.slice(0, length)]);
                for (const colour of ['000000', 'ffffff', '7f8081', '817f80', '80817f', 'ff0080', 'eeefff']) cases.push([group, 413, '01' + colour + '00']);
                cases.push([group, 419, '00aabbcc'], [group, 420, '03000003fffe00']);
            }
            const jars = [hdGamepackPath, joglPath].join(delimiter);
            for (const scale of ['0000', '7fff', '8000', 'fffe', 'ffff']) {
                cases.push([4, 517, '09' + scale + '00'], [1, 517, '03' + scale + '00']);
            }
            const compile = Bun.spawnSync(['javac', asm, '-cp', jars, '-d', dir, join(import.meta.dir, 'HdFloorsOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const oracle = Bun.spawnSync(['java', asm, '-XX:-OmitStackTraceInFastThrow', '-Djava.awt.headless=true', '-cp', dir + delimiter + jars, 'HdFloorsOracle', dir], {
                stdin: Buffer.from(cases.map(row => row.join(' ')).join('\n') + '\n')
            });
            expect(oracle.exitCode, oracle.stderr.toString()).toBe(0);
            const expected = oracle.stdout.toString().trimEnd().split(/\r?\n/),
                actual: string[] = [];
            // 01 with no RGB payload commits the three-byte cursor advance. HD then
            // faults on the high byte, prior to any colour assignment.
            for (const group of [1, 4]) expect(expected.some(line => line.startsWith('decode ' + group + ' -17 bounds:1 4 '))).toBe(true);
            FloType.Init(archive);
            FluType.Init(archive);
            actual.push('bind ' + (FloType.m_pConfigClient === archive) + ' ' + (FluType.m_pConfigClient === archive) + ' ' + FloType.count + ' ' + FloType.m_defaultWater);
            for (const group of [1, 4]) {
                const Type = group === 4 ? FloType : FluType,
                    ids = requireNonNull(archive.GetFileList(group));
                expect(ids.length).toBeGreaterThan(0);
                for (const id of ids) {
                    const type = Type.List(id);
                    actual.push('file ' + group + ' ' + id + ' ' + fields(type) + ' ' + FloType.m_defaultWater + ' ' + (type === Type.List(id)));
                }
                const missing = Type.List(-1);
                actual.push('missing ' + group + ' ' + fields(missing) + ' ' + (missing === Type.List(-1)));
                const files = requireNonNull(requireNonNull(archive['unpacked'])[group]),
                    damaged = ids[0];
                files[damaged] = group === 4 ? Uint8Array.of(8, 9, 12) : Uint8Array.of(3, 12);
                Type.clear();
                const failed = result(() => Type.List(damaged));
                actual.push('broken ' + group + ' ' + failed + ' ' + FloType.m_defaultWater + ' ' + (Type.m_list.Find(BigInt(damaged)) === null));
                files[damaged] = Uint8Array.of(group === 4 ? 9 : 3, 0, 76, 0);
                actual.push('repaired ' + group + ' ' + fields(Type.List(damaged)));
                if (group === 4) FloType.m_list.Put(-3n, {} as FloType);
                else FluType.m_list.Put(-3n, {} as FluType);
                actual.push('cast ' + group + ' ' + result(() => Type.List(-3)));
                const cached = Type.List(ids[0]);
                if (group === 1) FluType.Init(null);
                else actual.push('bind-null ' + result(() => FloType.Init(null)) + ' ' + FloType.count);
                actual.push('cached ' + group + ' ' + (cached === Type.List(ids[0])));
                actual.push('miss ' + group + ' ' + result(() => Type.List(-2)));
            }
            for (const [group, id, bytes] of cases) {
                const type = group === 4 ? new FloType() : new FluType(),
                    packet = new PacketT(Buffer.from(bytes, 'hex'));
                const status = result(() => type.Decode(packet, id));
                actual.push('decode ' + group + ' ' + id + ' ' + status + ' ' + packet.m_pos + ' ' + fields(type) + ' ' + FloType.m_defaultWater);
            }
            expect(actual).toEqual(expected);
            const java = ['java', asm, '-Djava.awt.headless=true', '-cp', dir + delimiter + jars, 'HdFloorsOracle'];
            const instrument = Bun.spawnSync([...java, 'instrument', dir]);
            expect(instrument.exitCode, instrument.stderr.toString()).toBe(0);
            const helpers = Bun.spawnSync([...java, 'helpers']);
            expect(helpers.exitCode, helpers.stderr.toString()).toBe(0);
            const events: string[] = [];
            for (const rgb of [0, 0x123456, 0x808080, 0xffffff, 0xff00ff]) {
                for (const guard of [-110, 96, 97, 116]) events.push(String(FloType.ColourFudge(rgb, guard)));
                for (const seed of [-2147483648, -8388609, -1, 0, 1, 2, 8388608, 2147483647]) events.push(String(RunetekColour.RGBToHSL(rgb, seed)));
                const underlay = new FluType();
                const stores = { chroma: 'u', saturation: 'd', lightness: 'r', weightedHue: 'i' } as const;
                for (const [field, slot] of Object.entries(stores)) {
                    let value = 0;
                    Object.defineProperty(underlay, field, {
                        get() {
                            return value;
                        },
                        set(n: number) {
                            value = n;
                            events.push(slot);
                        }
                    });
                }
                underlay.Decode(new PacketT(Uint8Array.of(1, rgb >> 16, rgb >> 8, rgb, 0)), 0);
            }
            expect(events).toEqual(helpers.stdout.toString().trimEnd().split(/\r?\n/));
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    30000,
    'gl'
);

loginFixture(
    import.meta.url,
    'every 24-bit RGB matches the HD floor colour decoders',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), '530-hd-floor-rgb-'));
        try {
            const jars = [hdGamepackPath, joglPath].join(delimiter);
            const compile = Bun.spawnSync(['javac', asm, '-cp', jars, '-d', dir, join(import.meta.dir, 'HdFloorsOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const oracle = Bun.spawnSync(['java', asm, '-Djava.awt.headless=true', '-cp', dir + delimiter + jars, 'HdFloorsOracle', 'rgb']);
            expect(oracle.exitCode, oracle.stderr.toString()).toBe(0);
            const expected = oracle.stdout.toString().trimEnd().split(/\r?\n/);
            expect(expected).toHaveLength(256);
            const plane = new Uint8Array(65536 * 6 * 4),
                words = new DataView(plane.buffer);
            const fluBytes = Uint8Array.of(1, 0, 0, 0, 0),
                floBytes = Uint8Array.of(1, 0, 0, 0, 7, 0, 0, 0, 0);
            const fluPacket = new PacketT(fluBytes),
                floPacket = new PacketT(floBytes);
            const flu = new FluType(),
                flo = new FloType();
            for (let red = 0; red < 256; red++) {
                fluBytes[1] = floBytes[1] = floBytes[5] = red;
                let offset = 0;
                for (let green = 0; green < 256; green++) {
                    fluBytes[2] = floBytes[2] = floBytes[6] = green;
                    for (let blue = 0; blue < 256; blue++) {
                        fluBytes[3] = floBytes[3] = floBytes[7] = blue;
                        fluPacket.m_pos = 0;
                        flu.Decode(fluPacket, 0);
                        floPacket.m_pos = 0;
                        flo.Decode(floPacket, 0);
                        words.setInt32(offset, flu.weightedHue);
                        words.setInt32(offset + 4, flu.saturation);
                        words.setInt32(offset + 8, flu.lightness);
                        words.setInt32(offset + 12, flu.chroma);
                        words.setInt32(offset + 16, flo.colour);
                        words.setInt32(offset + 20, flo.secondaryColour);
                        offset += 24;
                    }
                }
                const digest = createHash('sha256').update(plane).digest('hex');
                expect(digest, 'RGB plane ' + red.toString(16).padStart(2, '0')).toBe(expected[red]);
            }
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    120000,
    'gl'
);
