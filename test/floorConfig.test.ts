import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import RunetekColour from '#/util/RunetekColour.js';
import FloType from '#/config/FloType.js';
import FluType from '#/config/FluType.js';
import MSIType from '#/config/MSIType.js';
import MSITypeList from '#/config/MSITypeList.js';
import Pix8 from '#/graphics/Pix8.js';
import PacketT from '#/io/PacketT.js';
import { mathRandom } from '#/util/JavaRandom.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { localAssets, readGroup } from './cachefile.js';
import { cachePath, gamepackPath } from './reference.js';

function data(v: FluType | FloType | MSIType): number[] {
    if (v instanceof FluType) return [v.saturation, v.weightedHue, v.chroma, v.lightness, v['m_materialID'], v['rgb']];
    if (v instanceof FloType) return [+v.occludes, v.colour, v.m_materialID, v.secondaryColour, FloType.m_defaultWater];
    return [v.m_tint, +v.m_resize, v.m_spriteID];
}

test('rj, wa and da decode all live definitions and retain JAR colors, map deltas and cache behavior', () => {
    const archive = localAssets(cachePath, [2, 8]).archive(2);
    const fixtures = [
        '1:7:00',
        '1:8:0100000002020303fffe7900',
        '1:-9:02ffff00',
        '1:10:01ff00',
        '1:11:0203',
        '1:12:03',
        '4:19:08fa01ff00ff07cc00ee020703ffff0509007b0a0b110c0d1234560eff00',
        '4:77:0801ffffff00',
        '4:7:08071122',
        '4:12:0e',
        '34:7:010000021234560300',
        '34:8:01ffff0400',
        '34:1:0100010200',
        '34:9:f000'
    ];
    const out = resolve(import.meta.dir, '../out');
    mkdirSync(out, { recursive: true });
    const scratch = mkdtempSync(join(out, 'floor-config-'));
    let lines: string[];
    try {
        const src = fileURLToPath(new URL('./ui/FloorConfigOracle.java', import.meta.url));
        const compile = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', scratch, src]);
        if (compile.exitCode !== 0) throw Error(compile.stderr.toString());
        writeFileSync(join(scratch, 'index'), readGroup(cachePath, 255, 2));
        for (const group of [1, 4, 34]) writeFileSync(join(scratch, 'g' + group), readGroup(cachePath, 2, group));
        const run = Bun.spawnSync(['java', '-Djava.awt.headless=true', '--add-opens', 'java.base/java.lang=ALL-UNNAMED', '-cp', scratch + delimiter + gamepackPath, 'FloorConfigOracle', scratch, ...fixtures]);
        if (run.exitCode !== 0) throw Error(run.stderr.toString());
        lines = run.stdout.toString().trim().split(/\r?\n/);
    } finally {
        rmSync(scratch, { recursive: true, force: true });
    }
    const seed = mathRandom['seed'];
    try {
        mathRandom.setSeed(0x530n);
        MSITypeList.init(archive, archive);
        expect([FloType.count, MSITypeList.redDelta, MSITypeList.greenDelta, MSITypeList.blueDelta]).toEqual(JSON.parse(requireNonNull(lines.shift())));
        const hashArray = (values: number[]) => values.reduce((h, v) => (Math.imul(h, 31) + v) | 0, 1);
        for (const [group, list] of [
            [1, FluType],
            [4, FloType],
            [34, MSITypeList]
        ] as const) {
            const count = archive.GetFileIdLimit(group);
            let hash = 1;
            for (let id = 0; id < count; id++) hash = (Math.imul(hash, 31) + hashArray(data('spriteCache' in list ? list.List(id, group) : list.List(id)))) | 0;
            expect([count, hash]).toEqual(JSON.parse(requireNonNull(lines.shift())));
        }
        let r = 0x530,
            hash = 1;
        for (let i = 0; i < 65536; i++) {
            r = (Math.imul(r, 1664525) + 1013904223) | 0;
            const rgb = (i % 4 === 0 ? i + ((r / 17) | 0) : r) & 0xffffff;
            const under = new FluType();
            under.Decode(new PacketT(Uint8Array.of(1, rgb >>> 16, rgb >>> 8, rgb, 0)), i);
            hash = (Math.imul(hash, 31) + hashArray(data(under))) | 0;
            hash = (Math.imul(hash, 31) + RunetekColour.RGBToHSL(rgb)) | 0;
            hash = (Math.imul(hash, 31) + FloType.ColourFudge(rgb)) | 0;
        }
        expect(hash).toBe(Number(lines.shift()));
        for (const fixture of fixtures) {
            const [group, id, hex] = fixture.split(':');
            const p = new PacketT(Buffer.from(hex, 'hex'));
            const type = group === '1' ? new FluType() : group === '4' ? new FloType() : new MSIType();
            let ok = true;
            try {
                type.Decode(p, Number(id));
            } catch (error) {
                if (!(error instanceof RangeError)) throw error;
                ok = false;
            }
            expect(ok + '/' + p.m_pos + '/[' + data(type).join(', ') + ']').toBe(requireNonNull(lines.shift()));
        }
        const entry = MSITypeList.List(3, 34);
        const sprite = new Pix8(1, 1, 0, 0, 1, 1, new Uint8Array(1), new Int32Array(1));
        MSITypeList.spriteCache.Put(7n, sprite);
        MSITypeList.CacheClean(0);
        expect([MSITypeList.types.Find(3n) === entry, MSITypeList.spriteCache.Find(7n) === sprite]).toEqual(JSON.parse(requireNonNull(lines.shift())));
        MSITypeList.CacheClean(0);
        MSITypeList.removeSoft();
        expect([MSITypeList.types.Find(3n) === null, MSITypeList.spriteCache.Find(7n) === null]).toEqual(JSON.parse(requireNonNull(lines.shift())));
        const missing = MSITypeList.List(3, 65535);
        expect([missing.m_spriteID, Number(MSITypeList.List(3, 34) === missing)]).toEqual(JSON.parse(requireNonNull(lines.shift())));
        const saved = [MSITypeList.archive, MSITypeList.spritesArchive, MSITypeList.redDelta, MSITypeList.greenDelta, MSITypeList.blueDelta] as const;
        try {
            mathRandom.setSeed(17n);
            let failed = false;
            try {
                MSITypeList.init(null, null);
            } catch {
                failed = true;
            }
            expect([Number(failed), Number(MSITypeList.archive === null), Number(MSITypeList.spritesArchive === null), MSITypeList.redDelta, MSITypeList.greenDelta, MSITypeList.blueDelta, (mathRandom.nextDouble() * 1000000) | 0]).toEqual(
                JSON.parse(requireNonNull(lines.shift()))
            );
            MSITypeList.init(null, archive);
            expect([MSITypeList.redDelta, MSITypeList.greenDelta, MSITypeList.blueDelta, (mathRandom.nextDouble() * 1000000) | 0]).toEqual(JSON.parse(requireNonNull(lines.shift())));
        } finally {
            [MSITypeList.archive, MSITypeList.spritesArchive, MSITypeList.redDelta, MSITypeList.greenDelta, MSITypeList.blueDelta] = saved;
            MSITypeList.CacheReset();
        }
        expect(lines).toEqual([]);
    } finally {
        mathRandom['seed'] = seed;
    }
});
