import { expect } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Js5 from '#/cache/Js5.js';
import Client from '#/client/Client.js';
import GlRenderer from '#/gl/GlRenderer.js';
import WorldMapLabels from '#/ui/WorldMapLabels.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { IllegalStateException, JavaError } from '#/util/JavaException.js';
import WrappedException from '#/util/WrappedException.js';
import { loginFixture } from './login-fixture.js';
import { gamepackPath } from './reference.js';
import { hdGamepackPath, joglPath } from './render/hd-reference.js';

class EndOfFileLoop extends JavaError {}

function files(rows: (Uint8Array | null)[] | null): string {
    return (
        '[' +
        requireNonNull(rows)
            .map(row => (row === null ? 'null' : '[' + Array.from(row, b => (b << 24) >> 24).join(', ') + ']'))
            .join(', ') +
        ']'
    );
}

function runCase(active: boolean, target: string, mode: string): string {
    const reads: string[] = [];
    let locationGroups = Int32Array.of(201);
    let npcGroups = Int32Array.of(301);
    let keys = [Int32Array.of(13, -53)];
    const oldLoc = [null] as (Uint8Array | null)[];
    const oldNpc = [null] as (Uint8Array | null)[];
    Client.sceneMapLocData = oldLoc;
    Client.mapBuildNpcData = oldNpc;
    Client.sceneMapLandData = [Uint8Array.of(11)];
    Client.mapBuildGroundFile = Int32Array.of(-1);
    Client.sceneMapUnderwaterLandFile = Client.sceneMapUnderwaterLocFile = Int32Array.of(-1);
    Client.mapFilesMissing = 77;
    GlRenderer.active = active;
    const archive = new Js5(null, false, false);
    let calls = 0;
    archive.FetchFile = (file, key, group) => {
        const site = ++calls === 1 ? 'loc' : 'npc';
        reads.push(site + '(' + file + ',' + group + ',' + (key === null ? 'null' : '[' + key.join(', ') + ']') + ')');
        if (site === target) {
            if (mode === 'throw') throw new IllegalStateException();
            if (mode === 'missing') return null;
            if (mode === 'replace') {
                if (site === 'loc') Client.sceneMapLocData = [null];
                else Client.mapBuildNpcData = [null];
            }
        }
        return Uint8Array.of(group, key?.[0] ?? 0);
    };
    Client.mapsArchive = archive;
    const groupRead = (site: string, value: Int32Array): Int32Array | null => {
        if (site !== target) return value;
        reads.push('group');
        if (mode === 'swap') keys = [Int32Array.of(-71, 991)];
        if (mode === 'nullGroup') return null;
        if (mode === 'shortGroup') return new Int32Array(0);
        return value;
    };
    let locReads = 0,
        npcReads = 0,
        keyReads = 0;
    const observed: [object, string, () => unknown][] = [
        [Client, 'mapBuildLocationFile', () => (++locReads === 2 ? groupRead('loc', locationGroups) : locationGroups)],
        [Client, 'npcSpawnGroupIds', () => (++npcReads === 3 ? groupRead('npc', npcGroups) : npcGroups)],
        [
            Client,
            'mapBuildKeys',
            () => {
                if ((++keyReads === 1 ? 'loc' : 'npc') !== target) return keys;
                reads.push('key');
                const value = keys;
                if (mode === 'swap') {
                    if (target === 'loc') locationGroups = Int32Array.of(499);
                    else npcGroups = Int32Array.of(499);
                }
                if (mode === 'nullGroup') return [];
                if (mode === 'shortGroup') return null;
                if (mode === 'nullRow') return [null];
                return value;
            }
        ],
        [
            WorldMapLabels,
            'scene',
            () => {
                throw new EndOfFileLoop();
            }
        ]
    ];
    const descriptors = observed.map(([owner, name]) => requireNonNull(Object.getOwnPropertyDescriptor(owner, name)));
    let result: string;
    try {
        for (const [owner, name, get] of observed) Object.defineProperty(owner, name, { configurable: true, get });
        const app: Client = Object.create(Client.prototype);
        app['MapBuildLoop']();
        throw new Error('missing file loop boundary');
    } catch (e) {
        const cause = e instanceof WrappedException ? e.cause : e;
        if (cause instanceof EndOfFileLoop) result = 'ok';
        else if (cause instanceof TypeError) result = 'NullPointerException';
        else if (cause instanceof RangeError) result = 'ArrayIndexOutOfBoundsException';
        else if (cause instanceof IllegalStateException) result = 'IllegalStateException';
        else throw e;
    } finally {
        observed.forEach(([owner, name], i) => Object.defineProperty(owner, name, descriptors[i]));
    }
    return [active + ' ' + target + ' ' + mode, reads.join(';'), result, Client.mapFilesMissing, files(oldLoc) + '/' + files(Client.sceneMapLocData), files(oldNpc) + '/' + files(Client.mapBuildNpcData)].join('|');
}

for (const identity of ['sd', 'gl'] as const)
    loginFixture(
        import.meta.url,
        identity + ' map fetches evaluate the region group and XTEA key in native order',
        async () => {
            const dir = mkdtempSync(join(tmpdir(), 'rs530-map-fetch-'));
            try {
                const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
                const jar = identity === 'sd' ? gamepackPath : hdGamepackPath;
                const cp = [dir, jar, joglPath].join(delimiter);
                execFileSync('javac', [asm, '-d', dir, join(import.meta.dir, 'game/MapFetchOrderOracle.java')]);
                const java = [asm, '-Djava.awt.headless=true', '-cp', cp, 'MapFetchOrderOracle'];
                execFileSync('java', [...java, 'instrument', identity, jar, dir]);
                const expected = execFileSync('java', [...java, 'run', identity], { encoding: 'utf8' })
                    .trimEnd()
                    .split(/\r?\n/);
                Client.PreventTimeout = () => {};
                const actual: string[] = [];
                for (const active of identity === 'sd' ? [false] : [false, true]) {
                    for (const target of ['loc', 'npc']) {
                        for (const mode of ['ok', 'swap', 'nullGroup', 'shortGroup', 'nullRow', 'throw', 'missing', 'replace']) actual.push(runCase(active, target, mode));
                    }
                }
                expect(actual).toEqual(expected);
            } finally {
                rmSync(dir, { recursive: true, force: true });
            }
        },
        30000,
        identity
    );
