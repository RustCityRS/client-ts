import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Js5 from '#/cache/Js5.js';
import Js5Index from '#/cache/Js5Index.js';
import Client from '#/client/Client.js';
import GameShell from '#/client/GameShell.js';
import Crc32 from '#/io/Crc32.js';
import ComponentDrag from '#/ui/ComponentDrag.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import WrappedException from '#/util/WrappedException.js';
import { JavaCheckedException, JavaError } from '#/util/JavaException.js';
import { readGroup } from './cachefile.js';
import { loginFixture } from './login-fixture.js';
import { cachePath, gamepackPath } from './reference.js';

type Case = [entry: number, mode: number, length: number, root: number, action: number, trap: number, size: number, readFault?: number];
type Row = (IfType | null)[] | null;
const GROUP = 596;

function cases(): Case[] {
    const rows: Case[] = [];
    // Test the distinct array limits and exact write prefixes on the unopened path.
    for (const length of [-1, 0, 1, 3, 4, 7, 99, 100, 101, 114]) {
        for (const root of [-2147483648, -2, -1, 0, 3, 98, 99, 100, 113, 2147483647]) {
            for (let trap = 0; trap <= 4; trap++) rows.push([0, 3, length, root, 0, trap, 756]);
        }
        for (let trap = 0; trap <= 4; trap++) rows.push([1, 3, length, -1, 0, trap, -530]);
    }
    // Re-read each piece of native shell, group, parent and drag state at the call sites.
    for (const mode of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14]) {
        for (const entry of [0, 1])
            for (let action = 0; action <= 16; action++) {
                const sizes = [0, -1, 2147483647, -2147483648, 765];
                rows.push([entry, mode, 105, sizes[action % sizes.length], action, 0, sizes[(action + mode) % sizes.length]]);
            }
    }
    for (let read = 1; read <= 110; read++) {
        rows.push([0, 3, 105, -1, 0, 0, 7, read], [1, 3, 105, -1, 12, 0, 15, read]);
        if (read < 21) for (const action of [1, 5, 6, 14, 15]) rows.push([1, 0, 105, -1, action, 0, -999, read]);
    }
    for (const entry of [0, 1]) for (let action = 17; action <= 22; action++) rows.push([entry, 0, 100, -1, action, 0, 765]);
    for (const mode of [5, 6, 7, 8, 9, 12]) for (const allocate of [0, 1]) rows.push([2, mode, 100, allocate, 0, 0, 765]);
    return rows;
}

loginFixture(
    import.meta.url,
    'interface drawing retains the JAR redraw prefixes, root arrays and deferred drag arguments',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), '530-interface-draw-'));
        const drawLayer = Client.DrawLayer;
        try {
            const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
            const compile = Bun.spawnSync(['javac', asm, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'ui/InterfaceDrawOracle.java'), join(import.meta.dir, 'game/ChatOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const java = ['java', asm, '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'InterfaceDrawOracle'];
            const prepare = Bun.spawnSync([...java, gamepackPath, dir]);
            expect(prepare.exitCode, prepare.stderr.toString()).toBe(0);
            const header = readGroup(cachePath, 255, 3),
                groupData = readGroup(cachePath, 3, GROUP);
            const rows = cases();
            const input = [...[header, groupData].map(bytes => Buffer.from(bytes).toString('base64')), ...rows.map(row => row.join(' ')), ''].join('\n');
            const result = Bun.spawnSync(java, { stdin: Buffer.from(input), maxBuffer: 8 * 1024 * 1024 });
            expect(result.exitCode, result.stderr.toString()).toBe(0);
            const expected = result.stdout.toString().trimEnd().split(/\r?\n/);
            expect(expected.length).toBe(rows.length);
            const index = new Js5Index(header, Crc32.prefix(header, header.length));
            const root = [new IfType(), null],
                drag = [null, new IfType()],
                previous: IfType[] = [],
                replacement = [new IfType()];
            const oldParent = new IfType(),
                newParent = new IfType();
            let injected: Error | null = null;
            const source = (ready: boolean) => new Js5({ index: () => index, group: (_mode, group) => (ready && group === GROUP ? groupData : null), prefetchGroup() {}, GetGroupLoadPercentage: () => (ready ? 100 : 0) }, false, true);
            function components(array: Row): string {
                if (array === null) return '~';
                if (array === root) return 'root';
                if (array === drag) return 'drag';
                if (array === previous) return 'empty';
                if (array === replacement) return 'replacement';
                let hash = 1;
                for (const component of array) hash = (Math.imul(31, hash) + (component?.id ?? -1)) | 0;
                return 'loaded:' + array.length + ':' + hash;
            }
            let action = 0,
                trap = 0,
                draws = 0,
                reads = 0,
                readFault = 0,
                watching = false,
                trace = '';
            function read(label: string): void {
                if (!watching) return;
                trace += 'r,' + label + ';';
                if (++reads === readFault) throw Error('read');
                if (label === 'layer' && draws === 1) {
                    if (action === 14) ComponentDrag.dragLayerComponents = replacement;
                    if (action === 15) ComponentDrag.dragLayerComponents = null;
                }
                if (label === 'height' && action === 16) GameShell.m_sWid = -571;
            }
            function watchField(owner: object, key: string, label: string): void {
                let value: unknown = Reflect.get(owner, key);
                Object.defineProperty(owner, key, {
                    configurable: true,
                    get() {
                        const before = value;
                        read(label);
                        return before;
                    },
                    set(next: unknown) {
                        value = next;
                    }
                });
            }
            watchField(IfType, 'm_list', 'groups');
            watchField(InterfaceList, 'dirty', 'dirty');
            watchField(InterfaceList, 'top', 'top');
            watchField(GameShell, 'm_sWid', 'width');
            watchField(GameShell, 'm_sHei', 'height');
            watchField(ComponentDrag, 'dragLayerComponents', 'layer');
            watchField(ComponentDrag, 'dragLayerX', 'x');
            watchField(ComponentDrag, 'dragLayerY', 'y');
            watchField(ComponentDrag, 'parent', 'parent');
            watchField(oldParent, 'rootIndex', 'index');
            watchField(newParent, 'rootIndex', 'index');
            function outsideOuterMethod<T>(fn: () => T): T {
                const wasWatching = watching;
                watching = false;
                try {
                    return fn();
                } finally {
                    watching = wasWatching;
                }
            }
            let originalDirty: boolean[] | null = null,
                otherDirty: boolean[] = [];
            const dirty = (array: boolean[] | null) => (array === null ? '~' : array.map(v => (v ? '1' : '0')).join(''));
            const dirtyId = (array: boolean[] | null) => (array === null ? '~' : array === originalDirty ? 'a' : array === otherDirty ? 'b' : '?');
            function watchWrites(values: boolean[]): boolean[] {
                const proxy: boolean[] = new Proxy(values, {
                    set(target, key, value) {
                        const stored = Reflect.set(target, key, value);
                        trace += ['s', dirtyId(proxy), String(key), Number(value)].join(',') + ';';
                        if (key === '3') {
                            if (trap === 1 || trap === 2) Reflect.set(InterfaceList, 'dirty', otherDirty);
                            if (trap === 3) Reflect.set(InterfaceList, 'dirty', null);
                            if (trap === 4) throw Error('callback');
                        }
                        return stored;
                    }
                });
                return proxy;
            }
            const open = IfType.OpenInterface;
            IfType.OpenInterface = (group, allocateOnly = false) =>
                outsideOuterMethod(() => {
                    trace += ['o', group, allocateOnly, components(ComponentDrag.dragLayerComponents)].join(',') + ';';
                    if (action === 10) {
                        ComponentDrag.dragLayerComponents = replacement;
                        throw Error('callback');
                    }
                    const ready = open(group, allocateOnly);
                    if (action === 11) {
                        if (IfType.m_list !== null && group >= 0 && group < IfType.m_list.length) IfType.m_list[group] = replacement;
                        Reflect.set(InterfaceList, 'dirty', otherDirty);
                    }
                    if (action === 12) ComponentDrag.dragLayerComponents = drag;
                    return ready;
                });
            Client.DrawLayer = (y, list, parent, bottom, top, rootId, right, x, left) =>
                outsideOuterMethod(() => {
                    draws++;
                    trace += ['d', y, components(list), parent, bottom, top, rootId, right, x, true, left, components(ComponentDrag.dragLayerComponents)].join(',') + ';';
                    if (action >= 17 && draws === 1) {
                        ComponentDrag.dragLayerComponents = drag;
                        if (action >= 20) return;
                    }
                    if (action >= 17 && action <= 22) {
                        switch ((action - 17) % 3) {
                            case 0:
                                throw (injected = WrappedException.wrap(Error('callback'), 'leaf'));
                            case 1:
                                throw (injected = new JavaError());
                            case 2:
                                throw (injected = new JavaCheckedException());
                        }
                    }
                    if (draws === 1) {
                        switch (action) {
                            case 1:
                            case 4:
                            case 7:
                            case 14:
                            case 15:
                            case 16:
                                ComponentDrag.dragLayerComponents = drag;
                                break;
                            case 2:
                            case 8:
                                ComponentDrag.dragLayerComponents = list;
                                break;
                            case 3:
                                ComponentDrag.dragLayerComponents = drag;
                                throw Error('callback');
                            case 5:
                                ComponentDrag.dragLayerComponents = drag;
                                ComponentDrag.parent = null;
                                break;
                            case 6:
                                ComponentDrag.dragLayerComponents = replacement;
                                ComponentDrag.parent = newParent;
                                newParent.rootIndex = -2147483648;
                                ComponentDrag.dragLayerY = 2147483647;
                                ComponentDrag.dragLayerX = -31;
                                GameShell.m_sWid = -5;
                                GameShell.m_sHei = 9876;
                                InterfaceList.top = -3;
                                break;
                            case 9:
                                ComponentDrag.dragLayerComponents = previous;
                                ComponentDrag.parent = newParent;
                                break;
                            case 13:
                                ComponentDrag.dragLayerComponents = null;
                                ComponentDrag.parent = null;
                                break;
                        }
                    } else {
                        if (action === 2 || action === 7) {
                            ComponentDrag.dragLayerComponents = replacement;
                            ComponentDrag.parent = newParent;
                        }
                        if (action === 4 || action === 7) throw Error('callback');
                    }
                });
            for (const [i, vector] of rows.entries()) {
                const [entry, mode, length, rootId, mutation, storeTrap, size, failAt = 0] = vector;
                action = mutation;
                trap = storeTrap;
                draws = reads = 0;
                readFault = failAt;
                trace = '';
                originalDirty = length === -1 ? null : watchWrites(Array.from({ length }, (_, i) => i % 7 === 2));
                otherDirty = watchWrites(new Array<boolean>(trap === 2 ? 9 : 107).fill(false));
                Reflect.set(InterfaceList, 'dirty', originalDirty);
                IfType.m_list = new Array<Row>(GROUP + 1).fill(null);
                IfType.m_list[GROUP] = root;
                IfType.m_open = new Array<boolean>(GROUP + 1).fill(false);
                IfType.m_open[GROUP] = true;
                IfType.m_pInterfaces = null;
                InterfaceList.top = GROUP;
                GameShell.m_sWid = size;
                GameShell.m_sHei = ~size;
                ComponentDrag.dragLayerX = 33;
                ComponentDrag.dragLayerY = -19;
                oldParent.rootIndex = 14;
                newParent.rootIndex = -129;
                ComponentDrag.parent = oldParent;
                ComponentDrag.dragLayerComponents = previous;
                switch (mode) {
                    case 1:
                        IfType.m_list[GROUP] = previous;
                        break;
                    case 2:
                        IfType.m_list[GROUP] = null;
                        break;
                    case 3:
                    case 4:
                    case 11:
                        IfType.m_open[GROUP] = false;
                        IfType.m_pInterfaces = source(mode !== 3);
                        IfType.m_list[GROUP] = mode === 11 ? replacement : null;
                        break;
                    case 5:
                        IfType.m_open = null;
                        break;
                    case 6:
                        IfType.m_open = new Array<boolean>(GROUP).fill(false);
                        break;
                    case 7:
                        IfType.m_list = null;
                        break;
                    case 8:
                        IfType.m_list = new Array<Row>(GROUP).fill(null);
                        break;
                    case 9:
                        IfType.m_open[GROUP] = false;
                        break;
                    case 12:
                        InterfaceList.top = -1;
                        break;
                    case 13:
                        InterfaceList.top = 2147483647;
                        break;
                    case 14:
                        ComponentDrag.parent = null;
                        break;
                }
                let fault = 'ok';
                injected = null;
                const groupArgument = InterfaceList.top;
                watching = true;
                try {
                    if (entry === 0) InterfaceList.DrawInterface(~size, -16, 23, size, -33, rootId, 57, groupArgument);
                    else if (entry === 1) Client.drawTopLevelInterface();
                    else IfType.OpenInterface(groupArgument, rootId !== 0);
                } catch (error) {
                    const cause = error instanceof WrappedException ? error.cause : error;
                    if (cause instanceof JavaError) {
                        fault = 'fatal';
                    } else if (cause instanceof JavaCheckedException) {
                        fault = 'checked';
                    } else if (cause instanceof TypeError) {
                        fault = 'null';
                    } else if (cause instanceof RangeError) {
                        fault = 'bounds';
                    } else if (cause instanceof Error && ['callback', 'read'].includes(cause.message)) {
                        fault = cause.message;
                    } else {
                        fault = String(cause);
                    }
                    if (error instanceof WrappedException) fault += '@' + error.context;
                    if (injected !== null) fault += '#' + (error === injected);
                } finally {
                    watching = false;
                }
                const state = [
                    fault,
                    trace,
                    dirty(originalDirty),
                    dirty(otherDirty),
                    dirtyId(InterfaceList.dirty),
                    components(ComponentDrag.dragLayerComponents),
                    ComponentDrag.parent === null ? '~' : (ComponentDrag.parent === oldParent ? 'a' : 'b') + ComponentDrag.parent.rootIndex,
                    [ComponentDrag.dragLayerY, ComponentDrag.dragLayerX],
                    [GameShell.m_sHei, GameShell.m_sWid],
                    InterfaceList.top,
                    IfType.m_list === null || IfType.m_list.length <= GROUP ? '!' : components(IfType.m_list[GROUP]),
                    IfType.m_open === null || IfType.m_open.length <= GROUP ? '!' : IfType.m_open[GROUP]
                ];
                expect(state.join('|'), vector.join(' ')).toBe(expected[i]);
            }
        } finally {
            Client.DrawLayer = drawLayer;
            rmSync(dir, { recursive: true, force: true });
        }
    },
    60000
);
