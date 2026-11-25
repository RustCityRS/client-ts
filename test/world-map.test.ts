import { expect, spyOn, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { tmpdir } from 'node:os';
import Client from '#/client/Client.js';
import Js5Index from '#/cache/Js5Index.js';
import JagString, { fromJsString, toJsString } from '#/datastruct/JagString.js';
import Crc32 from '#/io/Crc32.js';
import PacketT from '#/io/PacketT.js';
import SuperPacket from '#/io/SuperPacket.js';
import IfType from '#/ui/IfType.js';
import MapArea from '#/ui/MapArea.js';
import WorldMap from '#/ui/WorldMap.js';
import WorldMapLabels from '#/ui/WorldMapLabels.js';
import { ClientScript } from '#/script/ClientScript.js';
import HookReq from '#/script/HookReq.js';
import ScriptRunner from '#/script/ScriptRunner.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { localAssets, readGroup } from './cachefile.js';
import { cachePath, gamepackPath } from './reference.js';
import { freshWorldMap } from './world-map-fixture.js';

function hex(s: JagString | null): string {
    return s === null ? '-' : Buffer.from(s.toBytes()).toString('hex');
}
function name(area: MapArea | null): string {
    return hex(area?.groupName ?? null);
}
function word(n: number): Buffer {
    const b = Buffer.alloc(4);
    b.writeInt32BE(n);
    return b;
}

test('archive 23 startup, every area, rectangle and label, and CS2 map opcodes match client.jar', async () => {
    using _state = freshWorldMap();
    const assets = localAssets(cachePath, [8, 13, 23]);
    const archive = assets.archive(23);
    const boot = new Client();
    boot['assets'] = assets;
    Client.lookupSpriteGroupIds(assets.archive(8));
    Client.loadFonts(assets.archive(8), assets.archive(13));
    Client.loadingStage = 80;
    await boot['MainLoad']();
    expect(Client.loadingStage).toBe(90);
    Client.loadingStage = 130;
    await boot['MainLoad']();
    expect(Client.loadingStage).toBe(135);
    const functions = requireNonNull(Client.imageMapfunction);
    expect(WorldMap.mapFunctions).toBe(functions);

    const table = readGroup(cachePath, 255, 23);
    const index = new Js5Index(table, Crc32.prefix(table, table.length));
    const binary: Uint8Array[] = [word(table.length), table];
    for (const group of requireNonNull(index.groupIds)) {
        const src = readGroup(cachePath, 23, group);
        binary.push(word(src.length), src);
    }
    binary.push(word(functions.length));
    const lines: string[] = [],
        commands: string[] = [];
    const row = (...values: unknown[]) => {
        lines.push(values.join('/'));
    };
    const points = new Map<string, [number, number]>(),
        names: JagString[] = [];
    function area(a: MapArea, collect = false): void {
        row('area', name(a), hex(a.displayName), a.originX, a.originZ, a.background, a.valid, a.defaultZoom, a.minX, a.minZ, a.maxX, a.maxZ);
        if (collect) names.push(requireNonNull(a.groupName));
        for (let r = a.rectangles.head(); r !== null; r = a.rectangles.next()) {
            row('rect', r.minX, r.minZ, r.maxX, r.maxZ);
            if (collect) {
                for (const x of [r.minX - 1, r.minX, (r.minX + r.maxX) >> 1, r.maxX, r.maxX + 1]) {
                    for (const z of [r.minZ - 1, r.minZ, (r.minZ + r.maxZ) >> 1, r.maxZ, r.maxZ + 1]) points.set(x + ',' + z, [x, z]);
                }
            }
        }
    }
    row('boot', WorldMap.archive === archive, requireNonNull(WorldMap.disabled).length, functions.length);
    for (let a = MapArea.areas.head(); a !== null; a = MapArea.areas.next()) area(a, true);
    for (const [x, z] of points.values()) {
        commands.push('query ' + x + ' ' + z);
        const hits: string[] = [],
            all = MapArea.allAt(z, x);
        for (let a = all.head(); a !== null; a = all.next()) hits.push(name(a));
        row('query', name(MapArea.at(x, z)), hits.join(','));
    }
    for (const key of [...names, fromJsString('missing'), null]) {
        commands.push('name ' + hex(key));
        WorldMap.select(key);
        row('name', name(MapArea.get(key)), name(WorldMap.getCurrent()));
    }
    const labelGroups = names.map(s => fromJsString(toJsString(s) + '_labels'));
    labelGroups.push(fromJsString('missing'));
    function load(key: JagString): WorldMapLabels {
        commands.push('labels ' + hex(key));
        const labels = (WorldMap.labels = WorldMapLabels.load(key, archive));
        row('labels', labels.count);
        for (let i = 0; i < labels.count; i++) row(hex(labels.text[i]), labels.x[i], labels.z[i], labels.flags[i], labels.colors[i], labels.hasFlag4(i), labels.size(i), labels.isVisible(i), labels.hasFlag8(i));
        return labels;
    }
    let biggest = labelGroups[0],
        count = 0;
    for (const group of labelGroups) {
        const labels = load(group);
        if (labels.count > count) {
            biggest = group;
            count = labels.count;
        }
    }
    expect(count).toBeGreaterThan(0);
    function reset(remember: boolean): void {
        commands.push('reset ' + Number(remember));
        WorldMap.Reset(remember);
        row('reset', hex(WorldMap.previousMap), name(WorldMap.current), WorldMap.labels === null, WorldMap.progress, WorldMap.targetX, WorldMap.targetZ);
    }
    reset(true);
    reset(false);
    const valid = Buffer.from('610062000001ffff8000000001ff010001000200030004', 'hex');
    for (let length = 0; length <= valid.length; length++) {
        const bytes = valid.subarray(0, length),
            packet = new PacketT(bytes);
        commands.push('raw ' + bytes.toString('hex'));
        try {
            area(MapArea.decode(packet));
            row('raw', packet.m_pos);
        } catch {
            row('rawError', packet.m_pos);
        }
    }
    let scriptId = 700,
        current = new ClientScript();
    const runner = new ScriptRunner(
        () => current,
        error => {
            throw new Error(error.message);
        }
    );
    function vm(opcode: number, n?: number, text?: JagString | null): void {
        commands.push('vm ' + opcode + ' ' + (text === undefined ? '_' : hex(text)) + ' ' + (n ?? '_'));
        const ops: number[] = [],
            ints: number[] = [],
            strings: (JagString | null)[] = [];
        if (text !== undefined) {
            ops.push(3);
            ints.push(0);
            strings.push(text);
        }
        if (n !== undefined) {
            ops.push(0);
            ints.push(n);
            strings.push(null);
        }
        ops.push(opcode, 21);
        ints.push(0, 0);
        strings.push(null, null);
        current = new ClientScript();
        current.key = BigInt(++scriptId);
        current.opcodes = Int32Array.from(ops);
        current.intOperands = Int32Array.from(ints);
        current.stringOperands = strings;
        const event = new HookReq();
        event.args = [scriptId];
        ScriptRunner.intStack.fill(0x5190);
        ScriptRunner.stringStack.fill(null);
        runner.ExecuteScript(event, 1000);
        const disabled = requireNonNull(WorldMap.disabled);
        let hash = 1;
        for (const flag of disabled) hash = (Math.imul(hash, 31) + (flag ? 1231 : 1237)) | 0;
        row(
            'vm',
            opcode,
            ScriptRunner.intStack[0],
            ScriptRunner.intStack[1],
            hex(ScriptRunner.stringStack[0]),
            name(WorldMap.current),
            hex(WorldMap.previousMap),
            WorldMap.progress,
            WorldMapLabels.labelIndex,
            WorldMap.targetX,
            WorldMap.targetZ,
            WorldMap.targetZoom,
            WorldMap.flashTicks,
            WorldMap.flashCount,
            WorldMap.flashingIcon,
            hash
        );
    }
    for (const zoom of [-1, 37, 50, 75, 100, 200, 201]) {
        vm(5200, zoom);
        vm(5201);
    }
    vm(5202, -311);
    vm(5210);
    vm(5211);
    vm(5218);
    vm(5220);
    for (const key of names) {
        vm(5205, undefined, key);
        vm(5207, undefined, key);
        vm(5210);
        vm(5211);
        vm(5218);
    }
    vm(5205, undefined, null);
    vm(5207, undefined, null);
    const area0 = requireNonNull(MapArea.get(names[0])),
        rect = requireNonNull(area0.rectangles.head());
    for (const coord of [(rect.minX << 14) | rect.minZ, 0, -1]) {
        vm(5206, coord);
        vm(5215, coord, names[0]);
        vm(5215, coord, fromJsString(toJsString(names[0]).toUpperCase()));
        vm(5215, coord, null);
    }
    for (const i of [-1, 0, functions.length - 1, functions.length]) {
        vm(5216, i);
        vm(5217, i);
        vm(5216, i);
        vm(5217, i);
    }
    commands.push('view');
    WorldMap.component = new IfType();
    WorldMap.component.width = 177;
    WorldMap.component.height = 103;
    WorldMap.zoom = 3;
    WorldMap.targetZoom = 4;
    WorldMap.width = 896;
    WorldMap.height = 1344;
    WorldMap.baseX = 64;
    WorldMap.baseZ = 512;
    WorldMap.displayWidth = 88;
    WorldMap.displayHeight = 51;
    WorldMap.centerX = 71;
    WorldMap.centerZ = 331;
    WorldMap.progress = 100;
    vm(5208);
    vm(5209);
    vm(5220);
    const labels = load(biggest);
    vm(5212);
    for (let i = 0; i <= labels.count; i++) vm(5213);
    for (const key of [fromJsString(''), fromJsString('missing'), requireNonNull(labels.text[0]).replace(WorldMap.lineBreak, WorldMap.space)]) {
        vm(5203, undefined, key);
        vm(5204, undefined, key);
        vm(5219, undefined, key);
    }
    for (const coord of [0, -1, (500 << 14) | 1100]) vm(5214, coord);
    function scroll(op: string, x = 0, z = 0): void {
        commands.push(['scroll', op, x, z].join(' '));
        if (op === 'setX') WorldMap.setX(x, z);
        else if (op === 'setZ') WorldMap.setZ(z);
        else if (op === 'target') WorldMap.target(z, x);
        else if (op === 'overview') WorldMap.scrollOverview(177, z, x, 103);
        else if (op === 'tick') WorldMap.tick();
        else if (op === 'zoom') WorldMap.SetZoomLevel(x);
        const floats = new Int32Array(Float32Array.of(WorldMap.zoom, WorldMap.targetZoom).buffer);
        row('scroll', WorldMap.centerX, WorldMap.centerZ, WorldMap.targetX, WorldMap.targetZ, floats[0], floats[1]);
    }
    for (const zoom of [37, 200, 50]) {
        scroll('zoom', zoom);
        for (const n of [-2147483648, -1, 0, 33, 65535, 2147483647]) {
            scroll('overview', n, n);
            scroll('target', n, n);
            scroll('setX', n, -1);
            scroll('setZ', 0, n);
        }
        scroll('overview', 53, 43);
        scroll('target', 779, 945);
        for (let i = 0; i < 100; i++) scroll('tick');
    }
    for (const key of [names[0], null]) {
        commands.push('name ' + hex(key));
        WorldMap.select(key);
        row('name', name(MapArea.get(key)), name(WorldMap.getCurrent()));
        reset(true);
        commands.push('reopen');
        WorldMap.reopen();
        row('reopen', hex(WorldMap.previousMap), name(WorldMap.current));
    }
    for (const [x, z, plane] of [
        [3200, 3455, 0],
        [-1, -337, 3],
        [2147483647, -2147483648, 1]
    ]) {
        commands.push(['tele', x, z, plane].join(' '));
        const packet = new SuperPacket(100);
        packet.SetEnc(Int32Array.of(1, 2, 3, 4));
        const log = spyOn(console, 'log').mockImplementation(value => row(value));
        const savedPacket = Client.out;
        try {
            Client.out = packet;
            WorldMap.teleport(x, z, plane);
        } finally {
            Client.out = savedPacket;
            log.mockRestore();
        }
        row('tele', Buffer.from(requireNonNull(packet.m_data).subarray(0, packet.m_pos)).toString('hex'));
    }
    reset(false);
    const scratch = mkdtempSync(join(tmpdir(), 'rs530-map-'));
    try {
        const compile = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', scratch, join(import.meta.dir, 'game', 'WorldMapOracle.java')]);
        expect(compile.stderr.toString()).toBe('');
        expect(compile.exitCode).toBe(0);
        const oracle = Bun.spawnSync(['java', '-cp', scratch + delimiter + gamepackPath, 'WorldMapOracle'], { stdin: Buffer.concat([...binary, Buffer.from(commands.join('\n') + '\n')]), maxBuffer: 20 * 1024 * 1024 });
        expect(oracle.stderr.toString()).toBe('');
        expect(oracle.exitCode).toBe(0);
        const expected = oracle.stdout.toString().trimEnd().split(/\r?\n/);
        expect(lines.length).toBe(expected.length);
        for (let i = 0; i < lines.length; i++) expect(lines[i], 'world map record ' + i).toBe(expected[i]);
    } finally {
        rmSync(scratch, { recursive: true, force: true });
    }
}, 30000);
