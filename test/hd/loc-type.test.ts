import { expect } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Js5 from '#/cache/Js5.js';
import Js5Index from '#/cache/Js5Index.js';
import LocType from '#/config/LocType.js';
import HashTable from '#/datastruct/HashTable.js';
import IntNode from '#/datastruct/IntNode.js';
import JagString from '#/datastruct/JagString.js';
import StringNode from '#/datastruct/StringNode.js';
import Crc32 from '#/io/Crc32.js';
import PacketT from '#/io/PacketT.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { readGroup } from '../cachefile.js';
import { loginFixture } from '../login-fixture.js';
import { cachePath, gamepackPath } from '../reference.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

// TS field | SD jb | HD pb. Java checks that the selected column covers
// every non-static field of that JAR's definition class.
const schema = `
resizeX b d
minDelay c W
multi e db
breakRoutefinding f y
cursor2 h bb
ambient i u
mapFunction j h
id k hb
retextureSource m a
raiseObject n yb
forceDecor q i
name r E
offsetZ t qb
cursor1 u T
params w B
occludes x Ab
length y l
retextureDest z v
recolourPalette C P
recolourSource D b
ambientSound E O
offsetX F w
animation H mb
flag96 I I
shareLight J zb
randomAnimFrame K s
contrast L p
blockrange M m
msiAngle O c
flag90 P C
active R kb
hillSkew S G
modelShapes T n
hillParam U A
resizeZ X g
cursorOp1 Y t
wallWidth Z jb
resizeY bb o
hasParticles cb L
cursorOp2 eb Y
width fb e
recolourDest gb H
flag88 hb D
maxDelay ib R
mirror jb sb
ops kb z
multiVarp lb nb
randomSounds mb wb
offsetY nb N
soundRadius pb k
blockwalk qb ub
members rb r
forceApproach tb pb
msiRotate ub tb
mapScene wb S
multiVarbit xb gb
modelIds yb X
shadow zb fb
field_844 - lb
`
    .trim()
    .split('\n')
    .map(line => line.split(' '));

function value(input: unknown): string {
    if (input === null) return '-';
    if (input instanceof JagString) return Buffer.from(requireNonNull(input.bytes).subarray(0, input.length)).toString('hex');
    if (input instanceof HashTable) {
        const values: string[] = [];
        for (const sentinel of input.buckets) {
            for (let n = sentinel.next; n !== sentinel; n = requireNonNull(n).next) {
                if (n instanceof IntNode) values.push(n.key + 'i' + n.value);
                else if (n instanceof StringNode) values.push(n.key + 's' + value(n.value));
                else throw new Error('Unexpected parameter node');
            }
        }
        return input.capacity + ':' + values.join(',');
    }
    if (Array.isArray(input)) return '[' + input.map(value).join(',') + ']';
    if (input instanceof Int32Array || input instanceof Int16Array || input instanceof Int8Array) return '[' + input.join(',') + ']';
    return String(input);
}

function cases(): [boolean, Buffer][] {
    const streams = [
        '010212340affff0305021001abcd010199990200',
        '0502abcdcdef010312340a4567018877040501ffff00',
        '02416280ff0011' + '1213ff15161718ffff1b1cff1d8139' + '1e48694464454e001f00' + '27fe00',
        '2802abcd12348000ffff2902ff990000beefefef2a0380ff0100',
        '3cffff3e404100ff42ff0043123445ff46806747816848ffee494a4bff00',
        '4dffff000100ffff5cffffabcdffff010123ffff00',
        '4effff814f12348abcfe02abcdffff51805258595a5b5d80235e5f6061626302ffff6401fefe65ff668bbc00',
        'f90300123456ff1100ab010123454180ff00001234561234567800',
        '5200'
    ];
    const result: [boolean, Buffer][] = [];
    for (const stream of streams) {
        const bytes = Buffer.from(stream, 'hex');
        for (const low of [false, true]) for (let i = 0; i <= bytes.length; i++) result.push([low, bytes.subarray(0, i)]);
    }
    return result;
}

for (const identity of ['sd', 'gl'] as const) {
    loginFixture(
        import.meta.url,
        identity + ' LocType matches every archive 16 definition and partial opcode state',
        async () => {
            const dir = mkdtempSync(join(tmpdir(), '530-loc-data-'));
            try {
                const selected = schema.filter(row => identity === 'gl' || row[1] !== '-');
                writeFileSync(join(dir, 'fields'), selected.map(row => row[identity === 'gl' ? 2 : 1]).join(' '));
                const dump = (loc: LocType) => selected.map(([key]) => value(loc[key as keyof LocType])).join('|');
                const raw = readGroup(cachePath, 255, 16);
                const table = new Js5Index(raw, Crc32.prefix(raw, raw.length));
                const groups = new Map<number, Uint8Array>();
                const packed: Uint8Array[] = [];
                function word(i: number) {
                    const b = Buffer.alloc(4);
                    b.writeUInt32BE(i);
                    packed.push(b);
                }
                word(raw.length);
                packed.push(raw);
                for (const id of requireNonNull(table.groupIds)) {
                    const bytes = readGroup(cachePath, 16, id);
                    word(id);
                    word(bytes.length);
                    packed.push(bytes);
                    groups.set(id, bytes);
                }
                writeFileSync(join(dir, 'groups'), Buffer.concat(packed));
                const steps = cases();
                const input = steps.map(([low, bytes]) => Number(low) + ' ' + bytes.toString('hex')).join('\n') + '\n';
                const jar = identity === 'gl' ? hdGamepackPath + delimiter + joglPath : gamepackPath;
                const run = Bun.spawnSync(['java', '-XX:-OmitStackTraceInFastThrow', '-Djava.awt.headless=true', '-cp', jar, join(import.meta.dir, 'LocTypeDataOracle.java'), identity, dir], {
                    stdin: Buffer.from(input),
                    timeout: 120000,
                    maxBuffer: 8 * 1024 * 1024
                });
                expect(run.exitCode, run.stderr.toString()).toBe(0);
                const lines = run.stdout.toString().trimEnd().split(/\r?\n/);
                const archive = new Js5({ index: () => table, group: (_mode, id) => groups.get(id) ?? null, GetGroupLoadPercentage: id => (groups.has(id) ? 100 : 0), prefetchGroup() {} }, false, false);
                LocType.Init(null, archive, false);
                let row = 0;
                for (const members of [false, true]) {
                    LocType.setMembers(members);
                    let count = 0,
                        flagged = 0;
                    for (const group of requireNonNull(table.groupIds)) {
                        const hash = createHash('sha256');
                        const ids = requireNonNull(archive.GetFileList(group));
                        for (const file of ids) {
                            const id = (group << 8) | file;
                            const loc = LocType.List(id);
                            if (LocType.List(id) !== loc) throw new Error('LocType cache miss ' + id);
                            hash.update(dump(loc) + '\n');
                            if (loc.field_844) flagged++;
                            count++;
                        }
                        expect(['group', group, ids.length, hash.digest('hex')].join(' ')).toBe(lines[row++]);
                    }
                    expect(count).toBe(42003);
                    expect(flagged).toBe(identity === 'gl' ? 84 : 0);
                    expect('total ' + count + ' ' + flagged).toBe(lines[row++]);
                }
                const files = requireNonNull(requireNonNull(archive['unpacked'])[0]);
                files[0] = Uint8Array.of(82, 93);
                const broken = lines[row++].split(' ');
                expect(broken[0]).toBe('broken');
                expect(() => LocType.List(0)).toThrow('byte array index ' + broken[1].split(':')[1]);
                files[0] = Uint8Array.of(82, 93, 0x80, 1, 74, 91, 0);
                const repaired = LocType.List(0);
                expect('repaired ' + dump(repaired) + ' ' + (repaired === LocType.List(0))).toBe(lines[row++]);
                expect('missing ' + dump(LocType.List(0x7fffffff))).toBe(lines[row++]);
                LocType.m_recentUse.Put(-1n, {} as LocType);
                expect(lines[row++]).toBe('cache cast');
                expect(() => LocType.List(-1)).toThrow('ClassCastException');
                for (const [low, bytes] of steps) {
                    LocType.m_lowMem = low;
                    const loc = new LocType(),
                        packet = new PacketT(bytes);
                    expect(Object.hasOwn(loc, 'field_844')).toBe(identity === 'gl');
                    let status = 'ok';
                    try {
                        loc.Decode(packet);
                        loc.PostDecode();
                    } catch (e) {
                        if (!(e instanceof RangeError) || !e.message.startsWith('byte array')) throw e;
                        status = 'bounds:' + e.message.split(' ').at(-1);
                    }
                    expect([status, packet.m_pos, dump(loc)].join(' '), low + ' ' + bytes.toString('hex')).toBe(lines[row++]);
                }
                expect(row).toBe(lines.length);
            } finally {
                rmSync(dir, { recursive: true, force: true });
            }
        },
        150000,
        identity
    );
}
