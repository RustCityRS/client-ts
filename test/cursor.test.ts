import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join, delimiter } from 'node:path';
import { localAssets, readGroup } from './cachefile.js';
import { cachePath, gamepackPath } from './reference.js';
import SoftwareAlphaSprite from '#/graphics/SoftwareAlphaSprite.js';
import CursorType from '#/config/CursorType.js';
import Client from '#/client/Client.js';
import GameShell from '#/client/GameShell.js';
import Preferences from '#/ui/Preferences.js';
import PacketT from '#/io/PacketT.js';
import { intQuery } from './int-query.js';
import Signlink from '#/util/Signlink.js';

function hash(values: Int32Array | null): number {
    if (values === null) return 0;
    let n = 1;
    for (const v of values) n = (Math.imul(n, 31) + v) | 0;
    return n;
}
test('all 530 cursor definitions, cached sprites, hotspots, queued hardware requests and partial reads match dl and sc', async () => {
    const dir = mkdtempSync(join(import.meta.dir, '../out/cursor-'));
    const saved = { platform: GameShell.signlink, enabled: Preferences.cursorsEnabled, current: Client.currentCursor, defaultCursor: Client.defaultCursor };
    const oldDescriptors = Object.getOwnPropertyDescriptors(Signlink);
    const platform = new Signlink();
    await platform.stopWorker();
    GameShell.signlink = platform;
    Client.currentCursor = -1;
    Preferences.cursorsEnabled = true;
    try {
        const assets = localAssets(cachePath, [2, 8]),
            cfg = assets.archive(2);
        const config = join(dir, 'config'),
            sprites = join(dir, 'sprites');
        mkdirSync(config);
        mkdirSync(sprites);
        writeFileSync(join(config, 'index'), readGroup(cachePath, 255, 2));
        writeFileSync(join(config, 'g33'), readGroup(cachePath, 2, 33));
        writeFileSync(join(sprites, 'index'), readGroup(cachePath, 255, 8));
        const count = cfg.GetFileIdLimit(33);
        const actual = [String(count)];
        function state() {
            const request = platform['tail'];
            if (request === null) return Client.currentCursor + ':-';
            const [canvas, pixels, hotspot] = request.objectArg as [object | null, Int32Array | null, { x: number; y: number }];
            platform['head'] = platform['tail'] = null;
            return [Client.currentCursor, request.type, request.intArg, +(canvas === GameShell.canvas), hotspot.x, hotspot.y, hash(pixels)].join(':');
        }
        for (let i = -1; i <= count; i++) {
            const type = CursorType.get(i);
            if (assets.archive(8).GetFileIdLimit(type['sprite']) > 0) writeFileSync(join(sprites, 'g' + type['sprite']), readGroup(cachePath, 8, type['sprite']));
            const sprite = type.getSprite();
            actual.push([i, type['sprite'], type.hotspotX, type.hotspotY, type === CursorType.get(i), sprite === null ? '-' : [sprite.cropW, sprite.cropH, hash(sprite.toArgb()), sprite === type.getSprite()].join(':')].join(':'));
            Client.setCursor(i);
            actual.push(state());
            Client.setCursor(i);
            actual.push(state());
            Preferences.cursorsEnabled = false;
            Client.setCursor(i);
            actual.push(state());
            Preferences.cursorsEnabled = true;
        }
        // This SD cache has an empty group 33. Exercise configured hotspots and alpha/non-alpha sprites using the cache's actual archive 8 groups.
        for (const sprite of [0, 641, 642, 802, 65535, 0]) {
            if (sprite !== 65535) writeFileSync(join(sprites, 'g' + sprite), readGroup(cachePath, 8, sprite));
            const type = new CursorType(),
                id = 1000 + sprite;
            type.decode(new PacketT(Uint8Array.of(1, sprite >> 8, sprite, 2, 9, 13, 0)));
            CursorType.types.Put(BigInt(id), type);
            const loaded = type.getSprite();
            actual.push(loaded === null ? 'missing' : (loaded instanceof SoftwareAlphaSprite ? 'vh' : 'rh') + ':' + hash(loaded.pixels));
            Client.setCursor(id);
            actual.push(state());
            Client.setCursor(id);
            actual.push(state());
            CursorType.clean(0);
            CursorType.removeSoft();
        }
        intQuery(5426, [217], false);
        actual.push('default:' + Client.defaultCursor);
        for (const sprites of [false, true]) {
            const cache = sprites ? CursorType.spriteCache : CursorType.types;
            const key = sprites ? 0n : -123n;
            const unexpected = {};
            Reflect.apply(cache.Put, cache, [key, unexpected]);
            let result = 'returned';
            try {
                if (sprites) new CursorType().getSprite();
                else CursorType.get(-123);
            } catch (error) {
                if (!(error instanceof TypeError) || !error.message.startsWith('ClassCastException')) throw error;
                result = 'cast';
            }
            actual.push(result + ':' + (cache.Find(key) === unexpected));
        }
        const complete = Uint8Array.of(2, 39, 211, 1, 0xab, 0xcd, 9, 2, 77, 125, 0);
        const bytes = Array.from({ length: complete.length + 1 }, (_, i) => complete.subarray(0, i));
        for (let i = 0; i < 256; i++) bytes.push(Uint8Array.of(i, 0, 16, 0));
        for (const data of bytes) {
            const type = new CursorType(),
                p = new PacketT(data);
            let result = 'ok';
            try {
                type.decode(p);
            } catch (e) {
                if (!(e instanceof RangeError)) throw e;
                result = 'error';
            }
            actual.push([result, p.m_pos, type['sprite'], type.hotspotX, type.hotspotY].join(':'));
        }
        const files = ['CursorOracle.java', 'FloorConfigOracle.java'].map(name => join(import.meta.dir, 'ui', name));
        files.push(join(import.meta.dir, 'game', 'ChatOracle.java'));
        const build = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, ...files]);
        expect(build.exitCode, build.stderr.toString()).toBe(0);
        const jar = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'CursorOracle', config, sprites], {
            stdin: Buffer.from(bytes.map(b => Buffer.from(b).toString('hex')).join('\n') + '\n'),
            timeout: 15000
        });
        expect(jar.exitCode, jar.stderr.toString()).toBe(0);
        const expected = jar.stdout.toString().trimEnd().split(/\r?\n/);
        expect(actual.length).toBe(expected.length);
        actual.forEach((line, i) => expect(line, 'cursor step ' + i).toBe(expected[i]));
    } finally {
        CursorType.clear();
        GameShell.signlink = saved.platform;
        Preferences.cursorsEnabled = saved.enabled;
        Client.currentCursor = saved.current;
        Client.defaultCursor = saved.defaultCursor;
        Object.defineProperties(Signlink, oldDescriptors);
        rmSync(dir, { recursive: true, force: true });
    }
});
