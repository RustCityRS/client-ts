import Protocol from '#/io/Protocol.js';
import { expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Js5 from '#/cache/Js5.js';
import Client from '#/client/Client.js';
import ClientBuild from '#/client/ClientBuild.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import PacketT from '#/io/PacketT.js';
import SuperPacket from '#/io/SuperPacket.js';
import JagString, { fromJsString } from '#/datastruct/JagString.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { cachePath, gamepackPath } from './reference.js';
import { localAssets, readGroup } from './cachefile.js';

function packets(): string[] {
    const cases: string[] = [];
    function make(dynamic: boolean, x: number, z: number, count: number, placements: number[][] = [], cut = 0, extra = 0, declared?: number, lookup = 0) {
        const p = new PacketT(2048);
        if (dynamic) {
            p.p2_alt3(27);
            p.p2_alt3(x);
            p.p1_alt3(2);
            p.p2_alt3(53);
            let byte = 0,
                n = 0;
            const put = (v: number, width: number) => {
                for (let b = width - 1; b >= 0; b--) {
                    byte = byte * 2 + ((v >> b) & 1);
                    if (++n === 8) {
                        p.p1(byte);
                        n = byte = 0;
                    }
                }
            };
            for (let i = 0; i < 676; i++) {
                const at = placements.find(pair => pair[0] === i);
                put(at ? 1 : 0, 1);
                if (at) put(at[1], 26);
            }
            if (n) p.p1(byte << (8 - n));
        } else p.p2_alt2(27);
        for (let i = 0; i < count; i++) for (let j = 0; j < 4; j++) p.p4_alt3(Math.imul(i * 4 + j + 1, 0x6638a2bc));
        if (dynamic) p.p2(z);
        else {
            p.p1_alt3(1);
            p.p2(x);
            p.p2_alt2(z);
            p.p2_alt2(53);
        }
        for (let i = 0; i < extra; i++) p.p1(31 + i);
        const raw = requireNonNull(p.m_data).slice(0, p.m_pos - cut);
        cases.push([+dynamic, declared ?? raw.length, Buffer.from(raw).toString('base64'), lookup].join(' '));
    }
    const a = (0x183 << 14) | (0x18d << 3) | 6,
        b = (0x1a4 << 14) | (0x19d << 3) | 2,
        c = (0x3ff << 14) | (0x7ff << 3) | 7;
    make(false, 386, 388, 9);
    make(false, 386, 388, 13);
    make(false, 381, 1185, 12);
    make(false, 398, 394, 17);
    make(false, 7, 7, 4);
    make(false, 1, 1, 4);
    make(true, 392, 398, 3, [
        [0, a],
        [66, c],
        [337, a],
        [675, b]
    ]);
    make(true, 399, 410, 5, [
        [67, b],
        [155, b]
    ]);
    make(true, 399, 411, 2, []);
    make(true, 393, 389, 1, [
        [2, a],
        [302, b]
    ]);
    make(true, 389, 381, 1, [[675, b]], 85);
    make(false, 386, 388, 9, [], 19, 0, 158);
    make(false, 386, 388, 0, [], 0, 0, -34);
    make(true, 386, 388, 3, [[468, c]], 0, 4);
    for (const lookup of [1, 2, 3, 4]) {
        make(false, 395, 395, 9, [], 0, 0, undefined, lookup);
        make(
            true,
            395,
            395,
            3,
            [
                [0, a],
                [101, b],
                [403, a]
            ],
            0,
            0,
            undefined,
            lookup
        );
    }
    for (let shape = 5; shape <= 11; shape++) {
        for (const placements of [[], [[0, a]], [[1, a]]]) make(true, 395, 395, 3, placements, 0, 0, undefined, shape);
    }
    return cases;
}

function trace(lines: string[]): void {
    const archive = localAssets(cachePath, [5]).archive(5);
    Client.gameState = 25;
    const self = (Client.localPlayer = new ClientPlayer());
    Client.MessageBox = () => {};
    const hash = (values: ArrayLike<number> | null) => (values === null ? 0 : Array.from(values).reduce((h, v) => (Math.imul(h, 31) + v) | 0, 1));
    const deep = (values: ReadonlyArray<Int32Array | Uint8Array | null> | null) => (values === null ? 0 : hash(values.map(hash)));
    const m = Client.mapFilePrefix,
        l = Client.locMapPrefix,
        um = Client.umMapPrefix,
        ul = Client.underwaterLocPrefix,
        separator = Client.mapNameSeparator;
    const join = JagString.join;
    let joins = 0;
    JagString.join = parts => {
        joins++;
        return join(parts);
    };
    const source = requireNonNull(archive['provider']),
        index = source.index.bind(source);
    const complete = Client.dynamicChunks;
    for (const line of lines) {
        const [mode, size, data, lookup] = line.split(' '),
            p = new SuperPacket(0);
        Client.mapFilePrefix = m;
        Client.locMapPrefix = l;
        Client.umMapPrefix = um;
        Client.underwaterLocPrefix = ul;
        Client.mapNameSeparator = separator;
        let chunks: ((Int32Array | null)[] | null)[] | null = complete;
        if (+lookup >= 5) {
            chunks = complete.map(plane => plane.slice());
            switch (lookup) {
                case '5':
                    chunks = null;
                    break;
                case '6':
                    chunks = [];
                    break;
                case '7':
                    chunks[0] = null;
                    break;
                case '8':
                    chunks[0] = [];
                    break;
                case '9':
                    requireNonNull(chunks[0])[0] = null;
                    break;
                case '10':
                    requireNonNull(chunks[0])[0] = new Int32Array(0);
                    break;
                case '11':
                    requireNonNull(chunks[0])[0] = new Int32Array(1);
                    break;
            }
        }
        Reflect.set(Client, 'dynamicChunks', chunks);
        Client.mapsArchive = lookup === '1' ? null : new Js5(source, false, false);
        source.index = () => {
            if (lookup === '2') {
                Client.mapFilePrefix = l;
                Client.locMapPrefix = m;
                Client.umMapPrefix = l;
                Client.underwaterLocPrefix = m;
                Client.mapNameSeparator = separator;
            }
            if (lookup === '3') Client.mapsArchive = null;
            if (lookup === '4') Client.mapNameSeparator = fromJsString('-');
            return index();
        };
        Protocol.inPacket = p;
        Protocol.packetSize = Number(size);
        joins = 0;
        p.m_data = Buffer.from(data, 'base64');
        let outcome = 'ok';
        try {
            Client.RebuildPacket(mode === '1');
        } catch (error) {
            outcome = error instanceof RangeError ? 'bounds' : error instanceof TypeError ? 'NullPointerException' : String(error);
        }
        console.log(
            [
                outcome,
                p.m_pos,
                p['bitPos'],
                +Client.dynamicRegion,
                chunks === null ? 0 : hash(chunks.map(deep)),
                deep(Client.mapBuildKeys),
                hash(Client.mapBuildIndex),
                hash(Client.mapBuildGroundFile),
                hash(Client.mapBuildLocationFile),
                hash(Client.sceneMapUnderwaterLandFile),
                hash(Client.sceneMapUnderwaterLocFile),
                deep(Client.sceneMapLandData),
                deep(Client.sceneMapLocData),
                deep(Client.mapBuildNpcData),
                hash(Client.npcSpawnGroupIds),
                Client.mapBuildCentreZoneX,
                Client.mapBuildCentreZoneZ,
                ClientBuild.buildLevel,
                Client.playerLevel,
                Client.mapBuildBaseX,
                Client.mapBuildBaseZ,
                self.pathX[0],
                self.pathZ[0],
                lookup === '1' || lookup === '3' ? joins : 0
            ].join(' ')
        );
    }
}

if (process.argv[2] === 'trace') trace(readFileSync(0, 'utf8').trim().split(/\r?\n/));
else
    test('RebuildPacket matches ac.a for normal/tutorial and template builds, sparse/extra keys, truncated cursors and partial arrays', () => {
        const dir = mkdtempSync(join(tmpdir(), 'rebuildpacket530-'));
        try {
            const file = (name: string) => fileURLToPath(new URL('./game/' + name + '.java', import.meta.url));
            const build = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, file('ChatOracle'), file('RebuildPacketOracle')]);
            expect(build.stderr.toString()).toBe('');
            expect(build.exitCode).toBe(0);
            const cases = packets(),
                lines = cases.join('\n') + '\n';
            const table = Buffer.from(readGroup(cachePath, 255, 5)).toString('base64');
            const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'RebuildPacketOracle'], { stdin: Buffer.from(table + '\n' + lines) });
            expect(java.stderr.toString()).toBe('');
            expect(java.exitCode).toBe(0);
            const ts = Bun.spawnSync([process.execPath, fileURLToPath(import.meta.url), 'trace'], { stdin: Buffer.from(lines) });
            expect(ts.stderr.toString()).toBe('');
            expect(ts.exitCode).toBe(0);
            const expected = java.stdout.toString().trimEnd().split(/\r?\n/),
                actual = ts.stdout.toString().trimEnd().split(/\r?\n/);
            expect(actual.length).toBe(cases.length);
            for (let i = 0; i < cases.length; i++) expect(actual[i], cases[i]).toBe(expected[i]);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    }, 20000);
