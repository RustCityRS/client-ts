import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import GameShell from '#/client/GameShell.js';
import HashTable from '#/datastruct/HashTable.js';
import SharedPtrList from '#/datastruct/SharedPtrList.js';
import HookReq from '#/script/HookReq.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import SubInterface from '#/ui/SubInterface.js';
import ServerActiveProperties from '#/ui/ServerActiveProperties.js';
import InterfaceSession from '#/ui/InterfaceSession.js';
import InterfaceView from '#/ui/InterfaceView.js';
import GameState from '#/game/GameState.js';
import { requireNonNull } from '#/util/JavaArray.js';
import WrappedException from '#/util/WrappedException.js';
import { cachePath, gamepackPath } from './reference.js';
import { localAssets } from './cachefile.js';
import { loginFixture } from './login-fixture.js';

function widget(id: number, parentId: number, marker: number): IfType {
    const c = new IfType();
    c.id = id;
    c.parentId = parentId;
    c.type = marker === 1 ? 0 : 3;
    c.widthMode = c.heightMode = 1;
    c.xMode = 2;
    c.yMode = 1;
    c.baseWidth = marker * 7;
    c.baseHeight = marker + 3;
    c.scrollX = c.scrollY = 1000;
    c.onResize = [marker];
    return c;
}

test('shell resizes preserve native dimensions, partial widget writes and queued hook order', () => {
    const saved = {
        width: GameShell.m_sWid,
        height: GameShell.m_sHei,
        components: IfType.m_list,
        loaded: IfType.m_open,
        top: InterfaceList.top,
        subs: InterfaceList.subInterfaces,
        qa: Client.qaOpTest,
        queue: Client.m_hookQueue
    };
    const dir = mkdtempSync(join(tmpdir(), 'rs530-resize-'));
    try {
        const compile = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'ui/InterfaceResizeOracle.java')]);
        expect(compile.stderr.toString()).toBe('');
        const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'InterfaceResizeOracle']);
        expect(java.stderr.toString()).toBe('');
        expect(java.exitCode).toBe(0);
        const expected = java.stdout.toString().trim().split(/\r?\n/);
        const root = widget(65536, -1, 1),
            child = widget(65537, root.id, 2);
        const dynamic = widget(root.id, root.id, 3),
            mounted = widget(131072, -1, 4),
            last = widget(65538, -1, 5);
        root.childSlots = [null, dynamic];
        IfType.m_list = [null, [root, child, last], [mounted]];
        IfType.m_open = [false, true, true];
        InterfaceList.subInterfaces = new HashTable<SubInterface>(8);
        const sub = new SubInterface();
        sub.group = 2;
        InterfaceList.subInterfaces.put(sub, BigInt(root.id));
        Client.qaOpTest = false;
        Client.m_hookQueue = new SharedPtrList<HookReq>();
        const widths = [0, 765, 765, 1024, 1024, -40, 300, 640, 2147483647];
        const heights = [0, 503, 503, 768, 768, 900, 200, 480, -2147483648];
        for (let i = 0; i < widths.length; i++) {
            GameShell.m_sWid = widths[i];
            GameShell.m_sHei = heights[i];
            InterfaceList.top = i === 7 ? -1 : 1;
            dynamic.widthMode = i === 5 || i === 6 ? 4 : 1;
            dynamic.aspectWidth = 3;
            dynamic.aspectHeight = i === 5 ? 0 : 2;
            let result = 'ok';
            try {
                if (i === 3) Client.InterfaceCalculateSizeAndPosComponent(root);
                else Client.InterfaceCalculateSizeAndPosAll(true);
            } catch {
                result = 'error';
            }
            const fields = [root, child, dynamic, mounted, last].flatMap(c => [c.width, c.height, c.x, c.y, c.scrollX, c.scrollY]);
            const trace: (number | string)[] = [result, ...fields, '|'];
            for (let event = requireNonNull(Client.m_hookQueue).takeFrontAndPop(); event !== null; event = requireNonNull(Client.m_hookQueue).takeFrontAndPop()) {
                trace.push(Number(requireNonNull(event.args)[0]));
            }
            expect(trace.join(' ')).toBe(expected[i]);
        }
        expect(expected).toHaveLength(widths.length);
    } finally {
        GameShell.m_sWid = saved.width;
        GameShell.m_sHei = saved.height;
        IfType.m_list = saved.components;
        IfType.m_open = saved.loaded;
        InterfaceList.top = saved.top;
        InterfaceList.subInterfaces = saved.subs;
        Client.qaOpTest = saved.qa;
        Client.m_hookQueue = saved.queue;
        rmSync(dir, { recursive: true, force: true });
    }
});

loginFixture(
    import.meta.url,
    'registered interfaces match JAR aspect faults and QA bounds, and hit-test the resized canvas',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-session-layout-'));
        try {
            const compile = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'ui/InterfaceResizeOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const rows: number[][] = [];
            for (const qa of [0, 1])
                for (const type of [0, 2, 3, 6, 7])
                    for (const active of [0, 1]) {
                        for (const [widthMode, heightMode] of [
                            [3, 3],
                            [3, 4],
                            [4, 3],
                            [4, 4],
                            [4, 0],
                            [0, 4]
                        ]) {
                            for (const [aspectWidth, aspectHeight] of [
                                [-3, 2],
                                [0, 5],
                                [2, 0],
                                [2147483647, -9]
                            ]) {
                                rows.push([qa, type, widthMode, heightMode, aspectWidth, aspectHeight, active]);
                            }
                        }
                    }
            const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'InterfaceResizeOracle', 'session'], {
                stdin: Buffer.from(rows.map(row => row.join(' ')).join('\n') + '\n')
            });
            expect(java.exitCode, java.stderr.toString()).toBe(0);
            const expected = java.stdout.toString().trimEnd().split(/\r?\n/);
            expect(expected).toHaveLength(rows.length);
            const assets = localAssets(cachePath, [3]);
            GameShell.m_sWid = 300;
            GameShell.m_sHei = 210;
            for (const [i, [qa, type, widthMode, heightMode, aspectWidth, aspectHeight, active]] of rows.entries()) {
                const root = widget(65536, -1, 1),
                    subject = widget(65537, root.id, 2),
                    after = widget(65538, -1, 3);
                Object.assign(subject, {
                    type,
                    widthMode,
                    heightMode,
                    aspectWidth,
                    aspectHeight,
                    properties: new ServerActiveProperties(active, -1),
                    width: -31,
                    height: 39,
                    x: -55,
                    y: -65,
                    baseX: -500,
                    baseY: 909,
                    baseWidth: 2,
                    baseHeight: 3,
                    xMode: 0,
                    yMode: 0,
                    itemX: -3,
                    itemY: 5
                });
                Client.qaOpTest = qa !== 0;
                const group = [root, subject, after];
                const view = new InterfaceView(group);
                let result = 'ok';
                try {
                    new InterfaceSession(view, assets);
                } catch (caught) {
                    let error = caught;
                    while (error instanceof WrappedException) error = error.cause;
                    if (!(error instanceof RangeError) || error.message !== '/ by zero') throw error;
                    result = 'divide';
                }
                const fields = group.flatMap(c => [c.width, c.height, c.x, c.y, c.scrollX, c.scrollY]);
                const noHooks = requireNonNull(Client.m_hookQueue).takeFrontAndPop() === null;
                expect([result, ...fields, noHooks].join(' '), rows[i].join(' ')).toBe(expected[i]);
            }

            Client.qaOpTest = false;
            const viewport = new IfType();
            Object.assign(viewport, { id: 65536, clientCode: 1337, widthMode: 1, heightMode: 1, type: 3, if3: true });
            const view = new InterfaceView([viewport]);
            const ui = new InterfaceSession(view, assets);
            ui.beginGame(new GameState({ outgoing: Client.out, rebuild: null, account: null }));
            ui.refreshView();
            expect(ui.options(419, 279).scene).toBe(false);
            GameShell.m_sWid = 420;
            GameShell.m_sHei = 280;
            Client.InterfaceCalculateSizeAndPosAll(true);
            expect(ui.options(419, 279).scene).toBe(true);
            expect(ui.options(420, 279).scene).toBe(false);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    30000
);
