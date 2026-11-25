import { setAppletWorld, saveWorldConnection } from './world-connection.js';
import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import type { AppletContext } from '#/client/GameShell.js';
import JagString from '#/datastruct/JagString.js';
import GameWorld from '#/io/GameWorld.js';
import WorldList from '#/io/WorldList.js';
import TitleScreen from '#/title/TitleScreen.js';
import LocalisedText from '#/ui/LocalisedText.js';
import { JavaError } from '#/util/ClientError.js';
import Signlink from '#/util/Signlink.js';
import { gamepackPath } from './reference.js';

function text(bytes: string): JagString | null {
    if (bytes === '-') return null;
    const data = bytes === '.' ? new Uint8Array(0) : Buffer.from(bytes, 'hex');
    return JagString.fromBytes(data, 0, data.length);
}

test('fd.a and ce.c match the applet callbacks, route, UTF-8 host and both URL formats in the 530 JAR', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rs530-world-switch-'));
    const previous = {
        connection: saveWorldConnection(),
        active: Client.activeClient,
        language: LocalisedText.language,
        platform: Signlink.platform,
        javascript: Client.javascript,
        objectTag: Client.objectTag,
        ads: Client.advertSuppressed,
        worlds: WorldList.worlds,
        loaded: WorldList.loaded,
        min: GameWorld.minId,
        max: GameWorld.maxId
    };
    try {
        const build = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game/WorldSwitchOracle.java')]);
        expect(build.exitCode, build.stderr.toString()).toBe(0);
        const rows: string[] = [];
        const hosts = ['776f726c64', 'efbbbf78', 'eda080', 'e282', '5b3a3a315d', '686f73743a2d32', '.', '-'];
        const settings = ['-', '.', '612f62', '3f783123', 'eda080'];
        const ids = [301, -7000, -1, 2147483647, -2147483648];
        for (const platform of [0, 1, 2, 3])
            for (const environment of [0, 1, 2, -1]) {
                for (let i = 0; i < 112; i++) {
                    rows.push([platform, environment, i % 16, ids[i % ids.length], hosts[(i + (i >> 4)) % hosts.length], settings[(i + (i >> 3)) % settings.length], (i >> 4) % 7].join(' '));
                }
            }
        const oracle = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'WorldSwitchOracle'], { stdin: Buffer.from(rows.join('\n') + '\n'), maxBuffer: 2 * 1024 * 1024 });
        expect(oracle.exitCode, oracle.stderr.toString()).toBe(0);
        const reference = oracle.stdout.toString().trimEnd().split(/\r?\n/);
        expect(reference).toHaveLength(rows.length);

        let mode = 0,
            events = '';
        class Page extends Client {
            override getAppletContext(): AppletContext | null {
                events += 'c';
                if (mode === 1) return null;
                if (mode === 2) throw new Error('context');
                if (mode === 3) throw new JavaError('context');
                return {
                    showDocument(url, target) {
                        events += 's' + target + '=' + Buffer.from(url.toString()).toString('hex');
                        if (mode === 4) throw new Error('showDocument');
                        if (mode === 5) throw new JavaError('showDocument');
                    }
                };
            }
        }
        const page = new Page();
        setAppletWorld();
        for (const [i, row] of rows.entries()) {
            const [platform, environment, bits, id, host, settings, context] = row.split(' ');
            const flags = Number(bits);
            mode = Number(context);
            events = '';
            Signlink.platform = Number(platform);
            Client.modeWhere = Number(environment);
            Client.javascript = (flags & 1) !== 0;
            Client.objectTag = (flags & 2) !== 0;
            Client.advertSuppressed = (flags & 4) !== 0;
            WorldList.loaded = (flags & 8) === 0;
            GameWorld.minId = GameWorld.maxId = 42;
            const world = new GameWorld();
            world.id = Number(id);
            world.host = text(host);
            WorldList.worlds = [world];
            LocalisedText.language = Math.imul(world.id, 11);
            Client.affiliateId = Math.imul(world.id, 7919);
            Client.settings = text(settings);
            Client.activeClient = mode === 6 ? null : page;
            Client.gameHost = 'previous';
            Client.selectedWorldId = 19;
            Client.primaryPort = 20;
            Client.secondaryPort = 21;
            Client.currentPort = 22;
            let result: string;
            try {
                result = String(TitleScreen.SwitchToWorld(42));
            } catch (error) {
                result = error instanceof JavaError ? 'error' : 'exception';
            }
            expect(
                [result, events, Buffer.from(Client.gameHost).toString('hex'), Client.selectedWorldId, Client.primaryPort, Client.secondaryPort, Client.currentPort, Buffer.from(Client.getWebsiteUrlPrefix().toBytes()).toString('hex')].join('|'),
                row
            ).toBe(reference[i]);
        }
    } finally {
        Object.assign(Client, previous.connection);
        Client.activeClient = previous.active;
        LocalisedText.language = previous.language;
        Signlink.platform = previous.platform;
        Client.javascript = previous.javascript;
        Client.objectTag = previous.objectTag;
        Client.advertSuppressed = previous.ads;
        WorldList.worlds = previous.worlds;
        WorldList.loaded = previous.loaded;
        GameWorld.minId = previous.min;
        GameWorld.maxId = previous.max;
        rmSync(dir, { recursive: true, force: true });
    }
});
