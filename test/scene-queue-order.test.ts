import WrappedException from '#/util/WrappedException.js';
import { expect } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import ClientBuild from '#/client/ClientBuild.js';
import ObjType from '#/config/ObjType.js';
import world from '#/dash3d/world.js';
import type Square from '#/dash3d/Square.js';
import ClientObj from '#/dash3d/ClientObj.js';
import ClientObjNode from '#/dash3d/ClientObjNode.js';
import LocChange from '#/dash3d/LocChange.js';
import Linkable from '#/datastruct/Linkable.js';
import SharedPtrList from '#/datastruct/SharedPtrList.js';
import { loginFixture } from './login-fixture.js';
import { gamepackPath } from './reference.js';

function run(op: number, mode: number, variant: number) {
    const list = new SharedPtrList<Linkable>(),
        other = new SharedPtrList<Linkable>();
    const first = new LocChange(),
        second = new LocChange(),
        wrong = new Linkable();
    const ground1 = new ClientObjNode(new ClientObj()),
        ground2 = new ClientObjNode(new ClientObj());
    const trace: string[] = [],
        names = new Map<Linkable, string>([
            [list.sentinel, 'S'],
            [other.sentinel, 'A'],
            [wrong, 'wrong'],
            [first, 'f'],
            [second, 's'],
            [ground1, 'g'],
            [ground2, 'h']
        ]);
    const name = (n: Linkable | null) => (n === null ? '-' : (names.get(n) ?? 'new'));
    ground1.obj.id = 3;
    ground2.obj.id = 5;
    ground1.obj.count = mode === 19 ? 2147483647 : 2;
    ground2.obj.count = variant === 1 ? -1 : 1;
    for (const f of [first, second]) {
        f.remaining = variant === 0 ? -1 : variant === 1 ? 1 : 5;
        f.delay = 1;
        f.id = 3;
        f.oldId = mode === 17 ? 3 : 6;
        f.shape = 4;
        f.oldShape = 7;
        f.x = 2;
        f.z = 1;
        f.layer = 1;
        f.angle = 0;
        f.oldAngle = 1;
    }
    second.x = 3;
    const alternate = new LocChange();
    names.set(alternate, 'alternate');
    alternate.remaining = 4;
    alternate.delay = 3;
    if (mode === 7 || mode === 8) {
        if (variant === 2) {
            const prefix = new Linkable();
            names.set(prefix, 'prefix');
            other.push_back(prefix);
        }
        other.push_back(alternate);
    }
    if (mode === 18) first.x = 1;
    if (mode === 1) list.push_back(wrong);
    list.push_back(op === 3 ? ground1 : first);
    if (mode === 2 || mode === 18) list.push_back(wrong);
    list.push_back(op === 3 ? ground2 : second);
    if (mode === 3) list.push_back(wrong);
    if (mode === 5) list.sentinel.next = null;
    if (mode === 6) list.sentinel.prev = null;
    if (mode === 20) (op === 3 ? ground2 : first).next = null;
    if (mode === 15) first.remaining = 2;
    if (mode === 16) first.delay = 2;
    Client.playerLevel = 0;
    function active(queue: SharedPtrList<Linkable> | null) {
        Reflect.set(Client, 'locChanges', queue);
        Reflect.set(Client, 'groundObj', [
            [
                [null, null],
                [null, queue]
            ]
        ]);
    }
    active(mode === 4 ? null : list);
    let changed = false,
        record = true,
        remainingReads = 0,
        delayReads = 0;
    const failure = new Error('scene queue probe');
    function action() {
        if (changed) return;
        changed = true;
        if (mode === 7 || mode === 8) {
            active(mode === 7 ? other : null);
            if (variant !== 0 && mode === 7) other.head();
        }
        if (mode === 9) throw failure;
    }
    Client.LocChangeSetOld = f => {
        trace.push('old');
        action();
        f.oldAngle = 1;
        f.oldShape = 7;
        f.oldId = 3;
    };
    ClientBuild.ChangeLocAvailable = (id, shape) => {
        trace.push('r' + id + ',' + shape);
        action();
        return true;
    };
    world.squares = [Array.from({ length: 2 }, () => new Array<Square | null>(2).fill(null))];
    Client.LocChangeUnchecked = (shape, plane, id, layer, x, angle, z) => {
        trace.push('p' + [plane, x, z, layer, id, shape, angle].join(','));
        action();
    };
    ObjType.List = id => {
        trace.push('t' + id);
        action();
        if (mode === 12) Reflect.set(ground1, 'obj', null);
        if (mode === 13) ground1.obj = ground2.obj;
        const type = new ObjType();
        type.cost = id === 3 ? 23 : 70;
        type.stackable = 1;
        return type;
    };
    list.push_front = n => {
        SharedPtrList.prototype.push_front.call(list, n);
        if (mode === 10) SharedPtrList.prototype.push_front.call(list, wrong);
        if (mode === 11) list.push_back(wrong);
    };
    if (op === 1 && mode >= 14 && mode <= 17) {
        const fields = { r: 'remaining', F: 'delay', w: 'x', N: 'z', L: 'id', C: 'shape', t: 'plane', z: 'layer', O: 'angle', K: 'oldId', B: 'oldAngle', D: 'oldShape' } as const;
        for (const node of [first, second])
            for (const [obf, field] of Object.entries(fields)) {
                let value = node[field];
                Object.defineProperty(node, field, {
                    get() {
                        if (record) {
                            trace.push(name(node) + '.' + obf);
                            if (node === first) {
                                if (mode === 15 && obf === 'r' && ++remainingReads === 2) value = -2147483648;
                                if (mode === 16 && obf === 'F' && ++delayReads === 2) value = -2147483648;
                                if (mode === 17 && obf === 'K' && ++remainingReads === 2) value = -1;
                            }
                        }
                        return value;
                    },
                    set(v: number) {
                        value = v;
                    }
                });
            }
    }
    let status = 'ok';
    try {
        switch (op) {
            case 0:
                Client.LocChangeCreate(9, 8, 1, 13, 1, 0, 1, 22, 2);
                break;
            case 1:
                Client.LocChangeDoQueue();
                break;
            case 2:
                Client.LocChangePostBuildCorrect();
                break;
            case 3:
                Client.ShowObject(1, 1);
                break;
        }
    } catch (error) {
        const e = error instanceof WrappedException ? error.cause : error;
        if (e === failure) status = 'probe';
        else if (e instanceof TypeError) status = e.message.startsWith('ClassCastException') ? 'cast' : 'null';
        else throw e;
    }
    record = false;
    const state = (q: SharedPtrList<Linkable>) => [q.sentinel.next, q.sentinel.prev, q['cursor']].map(name).join(',');
    const links = [first, second, ground1, ground2, wrong, alternate].map(n => name(n.prev) + ',' + name(n.next)).join(';');
    const counters = [first, second].flatMap(n => [n.remaining, n.delay, n.id, n.oldId]);
    counters.push(alternate.remaining, alternate.delay);
    const slot = world.squares[0][1][1]?.groundObject;
    let pile;
    if (slot == null) {
        pile = '';
    } else {
        pile = [slot.topObj, slot.middleObj, slot.bottomObj]
            .filter((item): item is ClientObj => item instanceof ClientObj)
            .map(item => item.id)
            .join(',');
    }
    return [status, trace.join(';'), state(list), state(other), links, counters.join(','), pile].join('|');
}

loginFixture(
    import.meta.url,
    'scene queue casts cursors and partial mutations match the 530 gamepack',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-scene-queue-')),
            observed = join(dir, 'observed');
        try {
            const access = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED'];
            const javac = Bun.spawnSync(['javac', ...access, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game/SceneQueueOrderOracle.java')]);
            expect(javac.exitCode, javac.stderr.toString()).toBe(0);
            const cp = dir + delimiter + gamepackPath;
            mkdirSync(observed);
            const probe = Bun.spawnSync(['java', ...access, '-cp', cp, 'SceneQueueOrderOracle', gamepackPath, observed]);
            expect(probe.exitCode, probe.stderr.toString()).toBe(0);
            for (const watched of [false, true]) {
                const cases: number[][] = [];
                for (let op = 0; op < 4; op++)
                    for (let mode = 0; mode <= 20; mode++)
                        for (const v of [0, 1, 2]) {
                            if (watched || mode === 1 || ((op === 0 || (op === 2 && v === 2)) && (mode === 2 || mode === 3))) cases.push([op, mode, v]);
                        }
                const child = Bun.spawnSync(['java', ...access, '-cp', watched ? observed + delimiter + cp : cp, 'SceneQueueOrderOracle'], {
                    stdin: Buffer.from(cases.map(a => a.join(' ')).join('\n') + '\n')
                });
                expect(child.exitCode, child.stderr.toString()).toBe(0);
                const lines = child.stdout.toString().trimEnd().split(/\r?\n/);
                expect(lines.length).toBe(cases.length);
                for (const [i, [op, mode, v]] of cases.entries()) expect(run(op, mode, v), [op, mode, v, watched].join(' ')).toBe(lines[i]);
            }
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    45000
);
