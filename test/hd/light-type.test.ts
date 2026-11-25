import { expect } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Js5 from '#/cache/Js5.js';
import Js5Index from '#/cache/Js5Index.js';
import Client from '#/client/Client.js';
import CursorType from '#/config/CursorType.js';
import LightType from '#/config/LightType.js';
import QuickChatCatTypeList from '#/config/QuickChatCatTypeList.js';
import Crc32 from '#/io/Crc32.js';
import PacketT from '#/io/PacketT.js';
import LocalisedText from '#/ui/LocalisedText.js';
import Preferences from '#/ui/Preferences.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { archiveSlots, readGroup } from '../cachefile.js';
import { loginFixture } from '../login-fixture.js';
import { cachePath } from '../reference.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

function archive(reference: Uint8Array, group: number, bytes: Uint8Array): Js5 {
    const index = new Js5Index(reference, Crc32.prefix(reference, reference.length));
    return new Js5(
        {
            index: () => index,
            group: (_mode, id) => (id === group ? bytes : null),
            GetGroupLoadPercentage: id => (id === group ? 100 : 0),
            prefetchGroup: () => {}
        },
        false,
        false
    );
}

function fields(type: LightType): string {
    return [type.m_waveType, type.m_frequency, type.m_amplitude, type.m_offset].join(',');
}

function failure(error: unknown): string {
    if (error instanceof RangeError && /^byte array index -?\d+$/.test(error.message)) return 'bounds:' + error.message.split(' ').at(-1);
    if (error instanceof TypeError && error.message.startsWith('Null')) return 'null';
    if (error instanceof TypeError && error.message.includes('ClassCastException')) return 'cast';
    throw error;
}

function list(id: number): string {
    try {
        return fields(LightType.List(id));
    } catch (error) {
        return failure(error);
    }
}

loginFixture(
    import.meta.url,
    'HD stage 70 binds the original light archive and group 31 matches the JAR through load, failure and cache repair',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-light-type-'));
        try {
            const reference = readGroup(cachePath, 255, 2),
                packed = readGroup(cachePath, 2, 31);
            const indexData = Uint8Array.of(5, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0);
            const stageIndex = Uint8Array.of(0, 0, 0, 0, indexData.length, ...indexData);
            const lightIndex = stageIndex.slice();
            lightIndex[10] = 31;
            const file = Uint8Array.of(1, 5, 2, 0x40, 1, 3, 0xf4, 0x12, 4, 0xab, 0xff, 0);
            const lightGroup = Uint8Array.of(0, 0, 0, 0, file.length, ...file);
            writeFileSync(join(dir, 'index'), reference);
            writeFileSync(join(dir, 'group'), packed);
            writeFileSync(join(dir, 'stage-index'), stageIndex);
            writeFileSync(join(dir, 'light-index'), lightIndex);
            writeFileSync(join(dir, 'light-group'), lightGroup);

            const all = '01ff02ffff03000004800000';
            const cases: [number, string][] = [
                [0, '00deadbeef'],
                [2, 'eeff030080047fff020000010000aa'],
                [0, '0905ff02000102f12303800004000004ffff00'],
                [1, ''],
                [-1, '00'],
                [0x7fffffff, '00'],
                [0, 'null'],
                ...Array.from({ length: all.length / 2 + 1 }, (_, i): [number, string] => [0, all.slice(0, i * 2)])
            ];
            const classpath = [dir, hdGamepackPath, joglPath].join(delimiter);
            const build = Bun.spawnSync(['javac', '-cp', classpath, '-d', dir, join(import.meta.dir, 'HdLightTypeOracle.java')]);
            expect(build.exitCode, build.stderr.toString()).toBe(0);
            const oracle = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-XX:-OmitStackTraceInFastThrow', '-cp', classpath, 'HdLightTypeOracle', dir], { stdin: Buffer.from(cases.map(([pos, bytes]) => pos + ' ' + bytes).join('\n') + '\n') });
            expect(oracle.exitCode, oracle.stderr.toString()).toBe(0);
            const expected = oracle.stdout.toString().trimEnd().split(/\r?\n/);
            const results: string[] = [];

            // The HD startup puts id.a between the quick chat category and cursor initializers.
            const dis = Bun.spawnSync(['javap', '-p', '-c', '-classpath', hdGamepackPath, 'client']);
            expect(dis.exitCode, dis.stderr.toString()).toBe(0);
            const boot = dis.stdout
                .toString()
                .split('private final void i(int);')[1]
                .split(/\r?\n {2}[^ ]/)[0];
            const methods = [...boot.matchAll(/\/\/ Method (ja\.a:\(Lve;Lve;I\)V|id\.a:\(Lve;B\)V|u\.a:\(BLve;Lve;\)V)/g)].map(m => m[1]);
            const order: string[] = [];
            const client = new Client();
            const track = (fn: () => void, name: string) => {
                fn();
                order.push(name);
            };
            const category = QuickChatCatTypeList.init,
                light = LightType.Init,
                cursor = CursorType.init;
            QuickChatCatTypeList.init = (...args) => track(() => category.apply(QuickChatCatTypeList, args), 'ja.a:(Lve;Lve;I)V');
            LightType.Init = (...args) => track(() => light(...args), 'id.a:(Lve;B)V');
            CursorType.init = (...args) => track(() => cursor.apply(CursorType, args), 'u.a:(BLve;Lve;)V');
            try {
                const stageGroup = Uint8Array.of(0, 0, 0, 0, 1, 0);
                for (const slot of archiveSlots) Client[slot] = archive(stageIndex, 0, stageGroup);
                Client.loadingStage = 70;
                Preferences.safeMode = true;
                await client['MainLoad']();
                results.push('stage ' + Client.loadingStage + ' ' + (LightType.m_pConfigClient === Client.configArchive));
                expect(order).toHaveLength(3);
                expect(order).toEqual(methods);
            } finally {
                QuickChatCatTypeList.init = category;
                LightType.Init = light;
                CursorType.init = cursor;
            }

            const real = archive(reference, 31, packed);
            LightType.Init(real);
            const ids = real.GetFileList(31);
            results.push('real-group ' + (ids === null ? 'absent' : ids.length) + ' ' + list(0));
            for (const file of ids ?? []) {
                const type = LightType.List(file);
                results.push('real ' + file + ' ' + fields(type) + ' ' + (type === LightType.List(file)));
            }
            const config = archive(lightIndex, 31, lightGroup);
            LightType.Init(config);
            LightType.clear();
            const key = 0,
                cached = LightType.List(key);
            results.push('populated ' + fields(cached));
            LightType.Init(null);
            results.push('null-archive ' + (cached === LightType.List(key)) + ' ' + list(-12345));
            LightType.cache.Put(-12345n, {});
            results.push('wrong-cache ' + list(-12345));
            LightType.Init(config);
            LightType.clear();
            const missing = LightType.List(-1);
            results.push('missing ' + fields(missing) + ' ' + (missing === LightType.List(-1)));
            const group = requireNonNull(requireNonNull(config['unpacked'])[31]);
            group[key] = Uint8Array.of(3, 42);
            results.push('broken ' + list(key) + ' ' + (LightType.cache.Find(BigInt(key)) === null));
            group[key] = Uint8Array.of(4, 255, 255, 0);
            results.push('repaired ' + list(key));
            LightType.clean(0);
            LightType.removeSoft();
            results.push('soft ' + (LightType.cache.Find(BigInt(key)) === null));
            for (const [start, bytes] of cases) {
                const packet = new PacketT(bytes === 'null' ? null : Buffer.from(bytes, 'hex'));
                packet.m_pos = start;
                const type = new LightType();
                let status = 'ok';
                try {
                    type.Decode(packet, key);
                } catch (error) {
                    status = failure(error);
                }
                results.push('decode ' + status + ' ' + packet.m_pos + ' ' + fields(type));
            }
            client['releaseStatics']();
            results.push('released ' + (LocalisedText.frenchCreatedGameworld === null) + ' ' + (LightType.m_pConfigClient === null));
            expect(results).toEqual(expected);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    45000,
    'gl'
);
