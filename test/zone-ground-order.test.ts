import { expect } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import ObjType from '#/config/ObjType.js';
import ClientObj from '#/dash3d/ClientObj.js';
import ClientObjNode from '#/dash3d/ClientObjNode.js';
import type Square from '#/dash3d/Square.js';
import world from '#/dash3d/world.js';
import Linkable from '#/datastruct/Linkable.js';
import SharedPtrList from '#/datastruct/SharedPtrList.js';
import Protocol from '#/io/Protocol.js';
import SuperPacket from '#/io/SuperPacket.js';
import SceneCutover from '#/scene/SceneCutover.js';
import WrappedException from '#/util/WrappedException.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { loginFixture } from './login-fixture.js';
import { gamepackPath } from './reference.js';

type Pile = SharedPtrList<Linkable>;
type Grid = (Pile | null)[][][];

function packet(op: number): Uint8Array {
    const p = new SuperPacket(10);
    switch (op) {
        case 33:
            p.p2_alt1(11);
            p.p1(0);
            p.p2_alt2(13);
            break;
        case 135:
            p.p2_alt3(24);
            p.p1(0);
            p.p2_alt1(13);
            p.p2_alt1(11);
            break;
        case 14:
            p.p1(0);
            p.p2(0x800b);
            p.p2(7);
            p.p2(15);
            break;
        case 240:
            p.p1_alt3(0);
            p.p2(0x800b);
            break;
    }
    return requireNonNull(p.m_data).slice(0, p.m_pos);
}

function run(op: number, initial: number, watchAt: number, effect: number, observed: boolean): string {
    const oldGrid: Grid = [[[null]], [[null]]],
        newGrid: Grid = [[[null]], [[null]]];
    let active: Grid | null = oldGrid,
        level = 0,
        accesses = 0,
        trace = '';
    const piles: Pile[] = [];
    const nodes: Linkable[] = [];
    function watch(event: string) {
        if (!observed) return;
        trace += event;
        if (++accesses !== watchAt) return;
        switch (effect) {
            case 0:
                active = newGrid;
                break;
            case 1:
                level = 1;
                break;
            case 2:
                active = newGrid;
                level = 1;
                break;
            case 3:
                active = null;
                break;
            case 4:
                level = 2;
                break;
        }
    }
    Object.defineProperty(Client, 'groundObj', {
        configurable: true,
        get() {
            const captured = active;
            watch(active === oldGrid ? 'A' : active === newGrid ? 'B' : '-');
            return captured;
        }
    });
    Object.defineProperty(Client, 'playerLevel', {
        configurable: true,
        get() {
            const captured = level;
            watch(String(level));
            return captured;
        }
    });

    function item(list: Pile, id: number): void {
        let node: Linkable;
        if (id === -1) node = new Linkable();
        else {
            const obj = new ClientObj();
            obj.id = id;
            obj.count = 7;
            node = new ClientObjNode(obj);
        }
        list.push_back(node);
        nodes.push(node);
    }

    for (let i = 0; i < 4; i++) {
        const list = new SharedPtrList();
        piles.push(list);
        if (i > 0) item(list, 11 + i);
        if (i > 0 || initial !== 0) (i < 2 ? oldGrid : newGrid)[i & 1][0][0] = list;
    }
    const list = piles[0];
    switch (initial) {
        case 2:
            item(list, 11);
            break;
        case 3:
            item(list, -1);
            item(list, 11);
            break;
        case 4:
            item(list, 12);
            item(list, -1);
            item(list, 11);
            break;
        case 5:
            item(list, 11);
            item(list, -1);
            break;
        case 6:
            item(list, 12);
            item(list, 11);
            break;
    }

    const squares: (Square | null)[][][] = [[[null]], [[null]]];
    world.squares = squares;
    world.levelHeightmaps = null;
    Client.localPid = 73;
    Protocol.zoneUpdateX = Protocol.zoneBaseZ = 0;
    const bytes = packet(op);
    const p = (Protocol.inPacket = new SuperPacket(bytes.length));
    p.m_data = bytes;
    Protocol.packetType = op;
    let status = 'ok';
    try {
        Client.ZonePacket();
    } catch (error) {
        const root = error instanceof WrappedException ? error.cause : error;
        let type: string;
        if (root instanceof RangeError) type = 'ArrayIndexOutOfBoundsException';
        else if (root instanceof TypeError) type = root.message.startsWith('ClassCastException') ? 'ClassCastException' : 'NullPointerException';
        else throw error;
        status = type + '@' + (error instanceof WrappedException ? error.context : '');
    }
    function name(node: Linkable | null): string {
        if (node === null) return '-';
        const index = piles.findIndex(pile => pile.sentinel === node);
        if (index !== -1) return 'q' + index;
        if (node instanceof ClientObjNode) return 'n' + node.obj.id + ':' + node.obj.count;
        return 'wrong';
    }
    const slots = [oldGrid, newGrid].flatMap(grid =>
        grid.map(layer => {
            const pile = layer[0][0];
            if (pile === null) return '-';
            if (!piles.includes(pile)) piles.push(pile);
            return 'q' + piles.indexOf(pile);
        })
    );
    const contents = piles.map((pile, i) => {
        const entries: string[] = [];
        for (let node = pile.sentinel.next; node !== null && node !== pile.sentinel; node = node.next) entries.push(name(node));
        return 'q' + i + '[' + entries.join(',') + ']' + name(pile['cursor']);
    });
    const links = nodes.map(node => [name(node.prev), name(node), name(node.next)].join('/'));
    const scene = squares.map(layer => {
        const top = layer[0][0]?.groundObject?.topObj;
        return top instanceof ClientObj ? top.id : '-';
    });
    return [status, p.m_pos, trace, level, active === oldGrid ? 'A' : active === newGrid ? 'B' : '-', slots.join(','), contents.join(';'), links.join(';'), scene.join(',')].join('|');
}

loginFixture(
    import.meta.url,
    'zone ground-item mutations retain the JAR grid, plane, cursor and partial state',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), '530-zone-ground-')),
            patched = join(dir, 'field-watch');
        try {
            mkdirSync(patched);
            const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
            const build = Bun.spawnSync(['javac', asm, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game/ZoneGroundOrderOracle.java')]);
            expect(build.exitCode, build.stderr.toString()).toBe(0);
            const cp = dir + delimiter + gamepackPath;
            const patch = Bun.spawnSync(['java', asm, '-cp', cp, 'ZoneGroundOrderOracle', gamepackPath, patched]);
            expect(patch.exitCode, patch.stderr.toString()).toBe(0);
            SceneCutover.native = true;
            for (let id = 11; id <= 14; id++) {
                const obj = new ObjType();
                obj.cost = id;
                ObjType.types.Put(BigInt(id), obj);
            }
            for (const watched of [false, true]) {
                const rows: number[][] = [];
                for (const op of [33, 135, 14, 240])
                    for (let initial = 0; initial <= 6; initial++) {
                        rows.push([op, initial, 0, 0]);
                        if (watched) for (let at = 1; at <= 6; at++) for (let effect = 0; effect < 5; effect++) rows.push([op, initial, at, effect]);
                    }
                const lines = rows.map(row => row.join(' ') + ' ' + Buffer.from(packet(row[0])).toString('hex'));
                const result = Bun.spawnSync(['java', asm, '-Djava.awt.headless=true', '-cp', watched ? patched + delimiter + cp : cp, 'ZoneGroundOrderOracle'], { stdin: Buffer.from(lines.join('\n') + '\n'), maxBuffer: 4 * 1024 * 1024 });
                expect(result.exitCode, result.stderr.toString()).toBe(0);
                const expected = result.stdout.toString().trimEnd().split(/\r?\n/);
                expect(expected.length).toBe(rows.length);
                for (const [i, [op, initial, at, effect]] of rows.entries()) {
                    expect(run(op, initial, at, effect, watched), lines[i]).toBe(expected[i]);
                }
            }
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    25000
);
