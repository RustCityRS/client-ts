import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Client from '#/client/Client.js';
import ClientKeyboardListener from '#/client/ClientKeyboardListener.js';
import ClientMouseListener from '#/client/ClientMouseListener.js';
import GameShell from '#/client/GameShell.js';
import JagString, { fromLiteral } from '#/datastruct/JagString.js';
import SoftwareFont from '#/graphics/SoftwareFont.js';
import ComponentDrag from '#/ui/ComponentDrag.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import InterfaceSession from '#/ui/InterfaceSession.js';
import InterfaceView from '#/ui/InterfaceView.js';
import Minimenu from '#/ui/Minimenu.js';
import ServerActiveProperties from '#/ui/ServerActiveProperties.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { localAssets } from './cachefile.js';
import { loginFixture } from './login-fixture.js';
import { cachePath, gamepackPath } from './reference.js';

function trials(): number[][] {
    const cases: number[][] = [];
    let seed = 0x530;
    function random(n: number): number {
        seed = (Math.imul(1664525, seed) + 1013904223) | 0;
        return (seed >>> 0) % n;
    }
    for (let i = 0; i < 1500; i++) {
        const open = i % 2,
            mode = i < 1100 ? 0 : 1 + (i % 2),
            flags = open | ((random(2) << 1) | (random(2) << 2) | (random(2) << 3) | (random(2) << 4)) | (i % 27 === 0 ? 32 : 0) | (i % 41 === 0 ? 64 : 0) | (i % 37 === 0 ? 128 : 0) | (i % 29 === 0 ? 256 : 0);
        const count = i % 43 === 0 ? -1 : i % 113 === 0 ? 501 : i % 7,
            button = [0, 1, 1, 1, 2][i % 5],
            deferred = i % 19 < 6 ? i % 3 : 0;
        const left = i % 67 === 0 ? 0x7ffffffd : random(13),
            top = i % 73 === 0 ? -2147483648 : random(11),
            width = 100,
            height = 65;
        const row = random(5);
        const baseline = (Math.imul(15, count - 1 - row) + top + (flags & 2 ? 35 : 31)) | 0;
        const clickX = (left + [-1, 0, 1, 5, 99, 100][random(6)]) | 0,
            clickY = (baseline + [-14, -13, -12, -1, 2, 3, 4][random(7)]) | 0;
        const hoverX = (left + [-11, -10, 5, width + 10, width + 11][random(5)]) | 0,
            hoverY = (top + [-11, -10, 5, height + 10, height + 11][random(5)]) | 0;
        const mouseX = (clickX + (i % 4 === 0 ? 4 : 0)) | 0,
            mouseY = (clickY - (i % 7 === 0 ? 3 : 0)) | 0;
        cases.push([
            mode,
            flags,
            count,
            button,
            deferred,
            left,
            top,
            width,
            height,
            i % 6 === 0 ? 50 : 765,
            i % 7 === 0 ? 20 : 503,
            clickX,
            clickY,
            hoverX,
            hoverY,
            mouseX,
            mouseY,
            (mouseX + (i % 8 === 0 ? 2 : 0)) | 0,
            (mouseY - (i % 5 === 0 ? 1 : 0)) | 0,
            random(6),
            [0, 1 << 28, 1 << 29][i % 3],
            i % 47 === 0 ? 101 : 5
        ]);
    }
    return cases;
}

loginFixture(
    import.meta.url,
    'native minimenu game loop matches click edges, drag capture, deferred actions and partial faults across 1500 JAR snapshots',
    async () => {
        const cases = trials(),
            dir = mkdtempSync(join(tmpdir(), 'rs530-menu-input-'));
        let expected: string[];
        try {
            const source = fileURLToPath(new URL('./ui/MenuInputOracle.java', import.meta.url));
            const compile = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, source]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const reference = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'MenuInputOracle'], {
                stdin: Buffer.from(cases.map(v => v.join(',')).join('\n') + '\n'),
                timeout: 12000,
                maxBuffer: 4 * 1024 * 1024
            });
            expect(reference.exitCode, reference.stderr.toString()).toBe(0);
            expected = reference.stdout.toString().trim().split(/\r?\n/);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
        const m = Minimenu,
            mouse = ClientMouseListener,
            r = InterfaceList,
            group = 49,
            id = group << 16,
            ops = [46, 42, 30, 1002, 1001, 3001];
        const assets = localAssets(cachePath, [3, 12]),
            p = Client.out;
        const ui = new InterfaceSession(new InterfaceView([]), assets);
        const font = new SoftwareFont(new Uint8Array(257).fill(6));
        const row = Array.from({ length: 6 }, (_, i) => {
            const c = new IfType();
            c.id = id + i;
            c.drawCycle = 23;
            c.rootIndex = i % 5;
            return c;
        });
        requireNonNull(IfType.m_open)[group] = true;
        requireNonNull(IfType.m_list)[group] = row;
        r.cycle = 23;
        for (const [trial, v] of cases.entries()) {
            const [mode, flags, count, button, deferred, left, top, width, height, sWid, sHei, cx, cy, hx, hy, mx, my, dx, dy, phase, properties, regions] = v;
            m.count = count;
            mouse.clickButton = button;
            m.deferred = deferred;
            m.x = left;
            m.y = top;
            m.width = width;
            m.height = height;
            GameShell.m_sWid = sWid;
            GameShell.m_sHei = sHei;
            mouse.clickX = cx;
            mouse.clickY = cy;
            mouse.x = hx;
            mouse.mouseY = hy;
            m.mouseX = mx;
            m.mouseY = my;
            m.deferredX = dx;
            m.deferredY = dy;
            m.isOpen = (flags & 1) !== 0;
            m.spriteStyle = (flags & 2) !== 0;
            m.shiftClick = (flags & 4) !== 0;
            ClientKeyboardListener.pressed[81] = (flags & 8) !== 0;
            Client.m_usingOneButtonMouse = (flags >> 4) & 1;
            m.objDragComponent = (flags & 32) !== 0 ? row[0] : null;
            ComponentDrag.component = (flags & 64) !== 0 ? row[1] : null;
            Client.fontBold12 = (flags & 128) !== 0 ? null : font;
            for (let i = 0; i < 6; i++) {
                m.actions[i] = ops[(phase + i) % ops.length];
                m.paramC[i] = id + i;
                m.paramB[i] = i - 1;
                m.keys[i] = BigInt(7 + i);
                m.option[i] = fromLiteral('Op' + i);
                m.target[i] = (flags & 256) !== 0 && i === 0 ? null : i % 2 === 0 ? JagString.empty : fromLiteral('Target' + i);
                row[i].properties = new ServerActiveProperties(properties, -1);
            }
            r.rootCount = regions;
            r.dirty.fill(false);
            for (let i = 0; i < 5; i++) {
                r.rootX[i] = (left + i * 20 - 10) | 0;
                r.rootY[i] = (top + i * 12 - 16) | 0;
                r.rootWidth[i] = 20;
                r.rootHeight[i] = 16;
            }
            m.objDragMoved = true;
            m.objDragCycles = 5;
            m.objDragSlot = 7;
            m.objGrabX = 8;
            m.objGrabY = 9;
            m.highlightComponent = null;
            m.highlightTicks = 10;
            m.highlightSlot = 12;
            m.targetMode = false;
            m.objSelected = 0;
            p.m_pos = 0;
            p.SetEnc(Int32Array.of(0, 1, 5, 3));
            let error = false,
                action: void | Promise<void> = undefined;
            try {
                if (mode === 0) action = m.GameLoop(ui);
                else if (mode === 1) m.Open();
                else action = m.useTopOption(ui);
            } catch {
                error = true;
            }
            expect(action, 'synchronous action ' + trial).toBeUndefined();
            const ref = (c: IfType | null) => (c === null ? -1 : c.id);
            const actual = [
                error,
                m.isOpen,
                m.deferred,
                m.deferredX,
                m.deferredY,
                m.x,
                m.y,
                m.width,
                m.height,
                ref(m.objDragComponent),
                m.objDragCycles,
                m.objDragMoved,
                m.objDragSlot,
                m.objGrabX,
                m.objGrabY,
                ref(m.highlightComponent),
                m.highlightTicks,
                m.highlightSlot,
                '[' + r.dirty.slice(0, 5).join(', ') + ']',
                Buffer.from(requireNonNull(p.m_data).subarray(0, p.m_pos)).toString('hex')
            ].join('/');
            expect(actual, 'trial ' + trial + ' ' + v.join(',')).toBe(expected[trial]);
        }
    },
    25000
);
