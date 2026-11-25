import { expect } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Js5 from '#/cache/Js5.js';
import Js5Index from '#/cache/Js5Index.js';
import MSIType from '#/config/MSIType.js';
import MSITypeList from '#/config/MSITypeList.js';
import Pix8 from '#/graphics/Pix8.js';
import Crc32 from '#/io/Crc32.js';
import PacketT from '#/io/PacketT.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { localAssets, readGroup } from './cachefile.js';
import { loginFixture } from './login-fixture.js';
import { cachePath, gamepackPath } from './reference.js';

const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

loginFixture(
    import.meta.url,
    'MSI sprites match da for every map-scene asset, cache key collision, rotation and archive retry',
    async () => {
        const configs = localAssets(cachePath, [2]).archive(2);
        const ids: number[] = [];
        for (let i = 0; i < configs.GetFileIdLimit(34); i++) {
            const data = configs.GetFile(i, 34);
            if (data === null) continue;
            const type = new MSIType();
            type.Decode(new PacketT(data), i);
            ids.push(type.m_spriteID);
        }
        expect(ids.length).toBe(96);
        const groups = new Map<number, Uint8Array>();
        for (const id of ids) if (id >= 0 && !groups.has(id)) groups.set(id, readGroup(cachePath, 8, id));
        const groupIds = [...groups.keys()],
            a = groupIds[0],
            b = groupIds[1];
        const index = readGroup(cachePath, 255, 8);
        const commands = ['reset', 'archive 0 0', 'delta -103 17 99'];
        for (const id of ids) for (let turn = 0; turn < 4; turn++) commands.push('get ' + id + ' ' + turn);
        commands.push(
            'get ' + a + ' 0',
            'poke',
            'delta 99 -118 128',
            'get ' + a + ' 0',
            'get ' + a + ' 65536',
            'get ' + a + ' -1',
            'get ' + a + ' 65535',
            'get ' + a + ' 2147483647',
            'get ' + a + ' -2147483648',
            'get ' + a + ' 1',
            'get ' + (a | 65536) + ' 0',
            'null',
            'get ' + a + ' 0',
            'get ' + b + ' -7',
            'bad -1',
            'get -1 2',
            'reset',
            'get -1 2'
        );
        for (let mode = 0; mode <= 6; mode++) {
            commands.push('reset', 'archive ' + mode + ' ' + b, 'delta -510 1024 45', 'get ' + a + ' 0', 'get ' + a + ' 0', 'get ' + b + ' 0', 'get ' + a + ' 1', 'get ' + a + ' -9', 'get -1 -9');
        }

        const dir = mkdtempSync(join(tmpdir(), 'rs530-msi-'));
        let expected: string[];
        try {
            const compile = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'config', 'MSISpriteOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const input = ['index ' + Buffer.from(index).toString('base64'), ...groupIds.map(id => 'group ' + id + ' ' + Buffer.from(requireNonNull(groups.get(id))).toString('base64')), ...commands];
            const jvm = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'MSISpriteOracle'], { stdin: Buffer.from(input.join('\n') + '\n'), timeout: 10000, maxBuffer: 8 * 1024 * 1024 });
            expect(jvm.exitCode, jvm.stderr.toString()).toBe(0);
            expected = jvm.stdout.toString().trimEnd().split(/\r?\n/);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }

        const type = new MSIType(),
            identities = new Map<Pix8, number>();
        let secondary: Js5 | null = null,
            last: Pix8 | null = null;
        let mode = 0,
            substitute = 0,
            requests = 0,
            row = 0;
        const calls: string[] = [];
        function archive(label: string): Js5 {
            return new Js5(
                {
                    index() {
                        calls.push(label + 'i');
                        return new Js5Index(index, Crc32.prefix(index, index.length));
                    },
                    group(request, group) {
                        calls.push(label + 'g' + request + ':' + group);
                        requests++;
                        if ((mode === 1 && requests === 1) || mode === 2) return null;
                        if (mode === 3 && requests === 1) type.m_spriteID = substitute;
                        if (mode === 4 && requests === 1) MSITypeList.spritesArchive = secondary;
                        if (mode === 5 && requests === 1) {
                            MSITypeList.redDelta = -31;
                            MSITypeList.greenDelta = 40;
                            MSITypeList.blueDelta = 99;
                        }
                        if (mode === 6) return Uint8Array.of(0, 0, 0, 0, 2, 0, 1);
                        return groups.get(group) ?? null;
                    },
                    prefetchGroup(group) {
                        calls.push(label + 'p' + group);
                    },
                    GetGroupLoadPercentage() {
                        return 100;
                    }
                },
                true,
                true
            );
        }
        for (const cmd of commands) {
            calls.length = 0;
            const [op, s, t, u] = cmd.split(' '),
                x = Number(s),
                y = Number(t);
            switch (op) {
                case 'reset':
                    MSITypeList.spriteCache.Reset();
                    continue;
                case 'null':
                    MSITypeList.spritesArchive = null;
                    continue;
                case 'archive':
                    mode = x;
                    substitute = y;
                    requests = 0;
                    MSITypeList.spritesArchive = archive('a');
                    secondary = archive('b');
                    continue;
                case 'delta':
                    MSITypeList.redDelta = x;
                    MSITypeList.greenDelta = y;
                    MSITypeList.blueDelta = Number(u);
                    continue;
                case 'bad':
                    Reflect.apply(MSITypeList.spriteCache.Put, MSITypeList.spriteCache, [BigInt(x), {}]);
                    continue;
                case 'poke':
                    requireNonNull(requireNonNull(last).pixels)[0] ^= 0x7f;
                    continue;
            }
            type.m_spriteID = x;
            let result = '-';
            try {
                const sprite = type.GetSprite(y);
                if (sprite !== null) {
                    last = sprite;
                    if (!identities.has(sprite)) identities.set(sprite, identities.size + 1);
                    const colours = requireNonNull(sprite['palette']),
                        bytes = Buffer.alloc(colours.length * 4);
                    colours.forEach((rgb, i) => bytes.writeInt32BE(rgb, i * 4));
                    result = [identities.get(sprite), sprite.cropW, sprite.cropH, sprite.xOffset, sprite.yOffset, sprite.width, sprite.height, hash(requireNonNull(sprite.pixels)), hash(bytes)].join(',');
                }
            } catch (e) {
                result = e instanceof TypeError ? (e.message.startsWith('ClassCastException') ? 'cast' : 'null') : e instanceof RangeError ? 'bounds' : String(e);
            }
            expect(type.m_spriteID + ';' + result + ';' + calls.join(','), cmd + ' at ' + row).toBe(expected[row++]);
        }
        expect(row).toBe(expected.length);
    },
    30000
);
