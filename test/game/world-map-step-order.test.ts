import { expect } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import GameShell from '#/client/GameShell.js';
import { mapFontSurface, type MapAwtFont } from '#/graphics/WorldMapFontSurface.js';
import FloType from '#/config/FloType.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import CollisionMap from '#/dash3d/CollisionMap.js';
import Js5 from '#/cache/Js5.js';
import Js5Index from '#/cache/Js5Index.js';
import Crc32 from '#/io/Crc32.js';
import { fromJsString, toJsString } from '#/datastruct/JagString.js';
import MapArea from '#/ui/MapArea.js';
import WorldMap from '#/ui/WorldMap.js';
import WorldMapLabels from '#/ui/WorldMapLabels.js';
import { requireNonNull } from '#/util/JavaArray.js';
import WrappedException from '#/util/WrappedException.js';
import { loginFixture } from '../login-fixture.js';
import { gamepackPath } from '../reference.js';

type Case = [stage: number, bold: number, setup: string, indexMask: number, groupMask: number, changes: string];
const groups = ['mesa', 'forest', 'bay', 'mesa_labels', 'forest_labels', 'bay_labels', 'null_labels'];
const ids = [0, 1, 2];
function vectors(): Case[] {
    const rows: Case[] = [];
    for (const stage of [0, 4, 10, 20, 30, 40, 50, 60, 70, 91, 100]) {
        for (const setup of ['normal', 'no-area', 'no-name', 'miss', 'no-archive']) rows.push([stage, 1, setup, 7, 7, '-']);
    }
    for (const stage of [0, 3, 20, 30, 40, 50, 60]) {
        for (const [indexMask, groupMask] of [
            [0, 0],
            [1, 0],
            [5, 0],
            [7, 0],
            [7, 2],
            [7, 7]
        ]) {
            for (const setup of ['normal', 'no-name']) rows.push([stage, 1, setup, indexMask, groupMask, 'A.i=B']);
        }
    }
    for (const change of ['A.i=B', 'A.g0=B', 'A.i=B,B.i=C', 'A.g0=null-area', 'A.g0=null-archive', 'A.g0=null-percent', 'A.g0=null-name', 'A.g0=miss']) {
        for (const ready of [0, 7]) rows.push([2, 1, 'normal', 7, ready, change]);
    }
    for (const changes of ['A.i=B,B.g4=C', 'A.i=B,B.g4=null-area', 'A.i=B,B.g4=null-name', 'A.i=B,B.g4=null-archive', 'A.i=null-name', 'A.i=miss', 'A.i=null-area', 'A.i=null-archive']) {
        for (const ready of [0, 7]) rows.push([60, 1, 'normal', 7, ready, changes]);
    }
    for (const setup of ['bad-map', 'no-player', 'no-percent']) rows.push([0, 1, setup, 7, 7, 'A.i=B'], [0, 1, setup, 7, 0, '-']);
    for (const stage of [70, 73, 76, 79, 82, 85, 88, 91, 95, 100]) {
        for (const bold of [0, 1]) rows.push([stage, bold, 'normal', 7, 7, '-'], [stage, bold, 'font-fault', 7, 7, '-']);
    }
    return rows;
}

const word = (v: number) => [v >>> 24, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
function index(stage: number): Uint8Array {
    const fileName = stage === 20 ? 'underlay' : stage === 30 ? 'overlay' : stage === 40 ? 'overlay2' : stage === 50 ? 'loc' : '';
    const bytes = [5, 1, 0, groups.length];
    groups.forEach((_, group) => bytes.push(0, group === 0 ? 0 : 1));
    groups.forEach(name => bytes.push(...word(fromJsString(name).hashCode())));
    groups.forEach(() => bytes.push(0, 0, 0, 0)); // group CRCs
    groups.forEach(() => bytes.push(0, 0, 0, 0)); // group versions
    groups.forEach(() => bytes.push(0, 1));
    groups.forEach(() => bytes.push(0, 0));
    groups.forEach((_, group) => bytes.push(...word(fromJsString(group < 3 ? fileName : '').hashCode())));
    return Uint8Array.of(0, ...word(bytes.length), ...bytes);
}

function run([stage, bold, setup, indexMask, groupMask, actions]: Case): string {
    const areas = ids.map(i => {
        const area = new MapArea(fromJsString(groups[i]), null, 2 + i, 3 + i, 0, true, [37, 75, 200][i]);
        area.minX = 64 + i * 128;
        area.maxX = area.minX + 64 * (i + 1);
        area.minZ = 128 + i * 64;
        area.maxZ = area.minZ + 64 * (i + 1);
        return area;
    });
    const archives: Js5[] = [],
        calls: string[] = [];
    function callback(event: string): void {
        calls.push(event);
        for (const change of actions.split(',')) {
            const [when, action] = change.split('=');
            if (when !== event) continue;
            switch (action) {
                case 'B':
                case 'C': {
                    const to = action === 'B' ? 1 : 2;
                    WorldMap.current = areas[to];
                    WorldMap.archive = archives[to];
                    Client.worldMapArchive = archives[to];
                    break;
                }
                case 'null-area':
                    WorldMap.current = null;
                    break;
                case 'null-archive':
                    WorldMap.archive = null;
                    break;
                case 'null-percent':
                    Client.worldMapArchive = null;
                    break;
                case 'null-name':
                    requireNonNull(WorldMap.current).groupName = null;
                    break;
                case 'miss':
                    requireNonNull(WorldMap.current).groupName = fromJsString('missing');
                    break;
                default:
                    throw new Error(change);
            }
        }
    }
    const table = index(stage);
    for (const id of ids) {
        const name = 'ABC'[id];
        archives.push(
            new Js5(
                {
                    index() {
                        callback(name + '.i');
                        return (indexMask & (1 << id)) === 0 ? null : new Js5Index(table, Crc32.prefix(table, table.length));
                    },
                    group(_unused, group) {
                        callback(name + '.g' + group);
                        if ((groupMask & (1 << id)) === 0) return null;
                        if (group < 3) return Uint8Array.of(0, 0, 0, 0, 0);
                        return Uint8Array.of(0, 0, 0, 0, 12, 65 + id, 48 + group, 0, 16, 0, id, 0, group, 0, 1, 2, 3);
                    },
                    GetGroupLoadPercentage(group) {
                        callback(name + '.p' + group);
                        return 17 + 24 * id + 10 * group;
                    },
                    prefetchGroup() {
                        throw new Error('prefetch');
                    }
                },
                true,
                true
            )
        );
    }
    WorldMap.current = setup === 'no-area' ? null : areas[0];
    if (setup === 'no-name') areas[0].groupName = null;
    if (setup === 'miss') areas[0].groupName = fromJsString('missing');
    WorldMap.archive = setup === 'no-archive' ? null : archives[0];
    Client.worldMapArchive = setup === 'no-percent' ? null : archives[2];
    WorldMap.progress = stage;
    WorldMap.baseX = 1;
    WorldMap.baseZ = 2;
    WorldMap.width = WorldMap.height = 0;
    WorldMap.centerX = 7;
    WorldMap.centerZ = 9;
    WorldMap.zoom = WorldMap.targetZoom = 1;
    Client.m_ticksSinceNoTimeOutPacket = 35;
    let resets = 0,
        font = '-';
    GameShell.timer = {
        reset() {
            resets++;
        },
        async wait() {
            return 1;
        }
    };
    GameShell.canvas = {
        ...mapFontSurface,
        getFontMetrics(f: MapAwtFont) {
            font = f.size + '.' + Number(f.bold);
            if (setup === 'font-fault') throw new TypeError('font');
            return mapFontSurface.getFontMetrics(f);
        }
    };
    Client.gameState = 30;
    Client.stream = null;
    Client.localPlayer = setup === 'no-player' ? null : new ClientPlayer();
    Client.mapBuildBaseX = Client.mapBuildBaseZ = -800;
    FloType.count = 0;
    WorldMap.labels = new WorldMapLabels(2);
    WorldMap.font11 = WorldMap.font12 = WorldMap.font14 = WorldMap.font17 = WorldMap.font19 = WorldMap.font22 = WorldMap.font26 = WorldMap.font30 = null;
    for (let i = 0; i < 4; i++) {
        const map = (CollisionMap.levelMaps[i] = new CollisionMap(104, 104));
        map.flags[4][5] = 73 + i;
    }
    if (setup === 'bad-map') CollisionMap.levelMaps[2] = null;
    let outcome = 'ok';
    try {
        WorldMap.step(bold !== 0);
    } catch (error) {
        if (!(error instanceof WrappedException) || !error.context?.endsWith('lg.L(' + (bold !== 0) + ')')) throw error;
        if (error.cause instanceof TypeError) outcome = 'null';
        else if (error.cause instanceof RangeError) outcome = 'bounds';
        else throw error;
    }
    const current = WorldMap.getCurrent(),
        labels = WorldMap.labels;
    let label = labels === null ? '-' : String(labels.count);
    if (labels !== null && labels.count === 1) label += '.' + toJsString(requireNonNull(labels.text[0])) + '.' + labels.x[0] + '.' + labels.z[0];
    return [
        outcome,
        WorldMap.progress,
        current === null ? -1 : areas.indexOf(current),
        WorldMap.archive === null ? -1 : archives.indexOf(WorldMap.archive),
        WorldMap.baseX,
        WorldMap.baseZ,
        WorldMap.width,
        WorldMap.height,
        WorldMap.centerX,
        WorldMap.centerZ,
        WorldMap.zoom,
        WorldMap.targetZoom,
        label,
        resets,
        Client.m_ticksSinceNoTimeOutPacket,
        requireNonNull(CollisionMap.levelMaps[0]).flags[4][5],
        +(WorldMap.font11 !== null),
        +(WorldMap.font30 !== null),
        font,
        calls.join(',')
    ].join('/');
}

loginFixture(
    import.meta.url,
    'lg.b rereads map names and providers after JS5 callbacks and preserves final font style',
    async () => {
        const rows = vectors(),
            dir = mkdtempSync(join(tmpdir(), 'rs530-world-step-'));
        try {
            writeFileSync(join(dir, 'cases'), rows.map(row => row.join(' ')).join('\n') + '\n');
            for (const stage of new Set(rows.map(r => r[0]))) writeFileSync(join(dir, 'index' + stage), index(stage));
            execFileSync('javac', ['-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'world-map-step-order', 'WorldMapStepOrderOracle.java')]);
            const expected = execFileSync('java', ['-Xmx512m', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'WorldMapStepOrderOracle', dir], { encoding: 'utf8', timeout: 45000 })
                .trimEnd()
                .split(/\r?\n/);
            expect(expected.length).toBe(rows.length);
            const line = (key: string) => requireNonNull(expected[rows.findIndex(row => row.join(' ') === key)]).split('/');
            expect(line('60 1 normal 7 7 A.i=B,B.g4=C')[12]).toBe('1.C5.2.5');
            expect(line('2 1 normal 7 0 A.g0=B').at(-1)).toBe('A.i,A.g0,B.i,B.p1');
            expect(line('91 0 normal 7 7 -')[18]).toBe('30.0');
            expect(line('70 0 normal 7 7 -')[18]).toBe('11.1');
            for (const [i, row] of rows.entries()) expect(run(row), row.join(' ')).toBe(expected[i]);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    60000
);
