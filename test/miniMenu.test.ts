import MinimapBuilder from '#/dash3d/MinimapBuilder.js';
import { freshGame } from './actor-fixture.js';
import ObjType from '#/config/ObjType.js';
import Client from '#/client/Client.js';
import { expect } from 'bun:test';
import { loginFixture } from './login-fixture.js';
import ClientBuild from '#/client/ClientBuild.js';
import MouseTracking from '#/client/MouseTracking.js';
import OrbitCamera from '#/client/OrbitCamera.js';
import Protocol from '#/io/Protocol.js';
import Preferences from '#/ui/Preferences.js';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { localAssets } from './cachefile.js';
import { cachePath, gamepackPath } from './reference.js';
import { fromJsString } from '#/datastruct/JagString.js';
import ChatHistory from '#/game/ChatHistory.js';
import type { Js5Stream } from '#/io/SocketPlatform.js';
import IfType from '#/ui/IfType.js';
import ComponentDrag from '#/ui/ComponentDrag.js';
import Minimenu from '#/ui/Minimenu.js';
import InterfaceSession from '#/ui/InterfaceSession.js';
import InterfaceView from '#/ui/InterfaceView.js';
import InterfaceList from '#/ui/InterfaceList.js';
import ServerActiveProperties from '#/ui/ServerActiveProperties.js';
import { requireNonNull } from '#/util/JavaArray.js';

import { entries } from './menuTrace.js';
import LocalisedText from '#/ui/LocalisedText.js';
import SoftwareFont from '#/graphics/SoftwareFont.js';
import GameShell from '#/client/GameShell.js';
import ClientMouseListener from '#/client/ClientMouseListener.js';
import ClientKeyboardListener from '#/client/ClientKeyboardListener.js';

loginFixture(
    import.meta.url,
    'menu arrays, IF actions, target changes, delayed opening and three inventory drag modes match the gamepack',
    async () => {
        const out = resolve(import.meta.dir, '../out');
        mkdirSync(out, { recursive: true });
        const tmp = mkdtempSync(join(out, 'minimenu-'));
        let expected: string[];
        try {
            const exports = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED', '--add-exports', 'java.base/jdk.internal.org.objectweb.asm.tree=ALL-UNNAMED'];
            const built = Bun.spawnSync(['javac', ...exports, '-cp', gamepackPath, '-d', tmp, fileURLToPath(new URL('./ui/MiniMenuOracle.java', import.meta.url))]);
            if (built.exitCode !== 0) throw Error(built.stderr.toString());
            const r = Bun.spawnSync(['java', ...exports, '-Djava.awt.headless=true', '-cp', tmp + delimiter + gamepackPath, 'MiniMenuOracle']);
            if (r.exitCode !== 0) throw Error(r.stderr.toString());
            expected = r.stdout.toString().trim().split(/\r?\n/);
        } finally {
            rmSync(tmp, { recursive: true, force: true });
        }
        const rows: string[] = [];
        const assets = localAssets(cachePath, [3, 12]);
        let written = '';
        const stream: Js5Stream = {
            GetAvailable() {
                return 0;
            },
            Close() {},
            async read() {
                throw Error('unexpected read');
            },
            async Read() {
                throw Error('unexpected read');
            },
            Write(start, data, length) {
                written += Buffer.from(requireNonNull(data).subarray(start, start + length)).toString('hex');
            }
        };
        const p = Client.out;
        const ui = new InterfaceSession(new InterfaceView([]), assets);
        const game = freshGame({ outgoing: p, rebuild: null, account: null }, assets);
        ui.beginGame(game);
        const m = Minimenu,
            group = 0x19b,
            id = group << 16,
            obj = 0x95b1;
        const c = new IfType();
        Object.assign(c, {
            id,
            x: 0,
            y: 0,
            baseWidth: 3,
            baseHeight: 1,
            type: 2,
            itemX: 1,
            invSlotOffsetX: new Int32Array(20),
            invSlotOffsetY: new Int32Array(20),
            itemIds: Int32Array.of(obj + 1, obj + 1, obj + 1),
            itemCounts: Int32Array.of(73, 123456, 23),
            invOptions: ['Bank', null, 'Option2', 'Option3', 'Option4'].map(s => (s === null ? null : fromJsString(s))),
            operationNames: ['Op1', null, 'Op3', ' ', null, 'Op6', null, 'Op8'].map(s => (s === null ? null : fromJsString(s))),
            opCursors: Int32Array.of(61, 72, 94, 11),
            targetTextValue: fromJsString('target'),
            targetVerbValue: fromJsString(' Select '),
            opBaseValue: fromJsString('widget'),
            targetLeaveCursor: 42,
            targetOverCursor: 77,
            drawCycle: 23,
            rootIndex: 0
        });
        requireNonNull(IfType.m_list)[group] = [c];
        requireNonNull(IfType.m_open)[group] = true;
        const o = new ObjType();
        o.id = obj;
        o.name = fromJsString('Rune');
        o.inventoryOps = ['Equip', 'Eat', null, 'Play', 'Drop'].map(s => (s === null ? null : fromJsString(s)));
        ObjType.types.Put(BigInt(obj), o);
        const saved = InterfaceList.cycle,
            font = Client.fontBold12,
            width = GameShell.m_sWid,
            height = GameShell.m_sHei;
        const mouse = [ClientMouseListener.clickButton, ClientMouseListener.clickX, ClientMouseListener.clickY];
        const strings = Object.getOwnPropertyDescriptors(LocalisedText),
            shift = m.shiftClick,
            held = ClientKeyboardListener.pressed[81];
        try {
            LocalisedText.MINISEPERATOR = LocalisedText.englishMenuSeparator;
            LocalisedText.use = LocalisedText.englishUse;
            LocalisedText.MOREOPTIONS = LocalisedText.englishMoreOptions;
            InterfaceList.cycle = 23;
            m.defaultCursor = 11;
            m.objCursor = 22;
            m.examineCursor = 33;
            m.targetCursor = 44;
            m.targetParam = -1;
            m.targetName = fromJsString('targetname');
            m.targetVerb = fromJsString('spell');
            m.objName = fromJsString('selected');
            m.keys[0] = 0n;
            m.paramB[0] = m.paramC[0] = 0;
            m.isOpen = false;
            m.deferred = 0;
            for (let i = 0; i < 256; i++) {
                c.properties = new ServerActiveProperties(i % 3 === 0 ? -1 : i % 3 === 1 ? 0x43fff3 : 0, -1);
                c.if3 = !!(i & 1);
                c.buttonType = i % 7;
                Client.qaOpTest = !!(i & 2);
                m.showOpIndices = !!(i & 4);
                m.targetMode = !!(i & 8);
                m.targetFlags = i & 32 ? 48 : 0;
                m.objSelected = i & 16 ? 1 : 0;
                c.childId = i & 1 ? -1 : 0;
                m.objSlot = i % 3;
                m.objComponent = id;
                Client.hoveredSlotCom = null;
                m.hoverSlot = -1;
                m.ResetMinimenu();
                m.AddComponent(0, (i % 4) * 33, c);
                m.Sort();
                rows.push(entries() + ' ' + (Client.hoveredSlotCom === c) + ' ' + m.hoverSlot);
            }
            m.isOpen = false;
            m.count = 0;
            m.defaultCursor = 11;
            for (let i = 0; i < 510; i++) m.AddEntry(fromJsString('t' + i), i % 5 === 0 ? 1000 : i % 2 === 0 ? 5 : 1005, fromJsString('o' + i), i * 30000, i * 33331, 0x7fa200000000n + BigInt(i), i % 2 === 0 ? -1 : i);
            m.Sort();
            rows.push(entries());
            for (const i of [348, 22, 10, 0, 495]) {
                m.remove(i);
                rows.push(entries());
            }
            Client.fontBold12 = new SoftwareFont(new Uint8Array(257).fill(6));
            GameShell.m_sWid = 765;
            GameShell.m_sHei = 503;
            ClientMouseListener.clickX = 758;
            ClientMouseListener.clickY = 491;
            m.count = 4;
            m.deferred = 0;
            m.mouseX = 762;
            m.mouseY = 498;
            m.Open();
            rows.push([m.isOpen, m.deferred, m.deferredX, m.deferredY].join(' '));
            m.mouseX = m.deferredX;
            m.mouseY = m.deferredY;
            m.Open();
            rows.push([m.isOpen, m.x, m.y, m.width, m.height].join(' '));
            m.isOpen = Client.qaOpTest = m.showOpIndices = m.targetMode = false;
            m.count = 1;
            m.objSelected = 0;
            m.defaultCursor = -1;
            c.childId = -1;
            c.if3 = true;
            c.properties = new ServerActiveProperties(-1, -1);
            m.highlightComponent = null;
            m.highlightTicks = m.highlightSlot = 0;
            ChatHistory.text.fill(null);
            ChatHistory.count = 0;
            p.SetEnc(Int32Array.of(0, 1, 5, 3));
            for (const action of [12, 39, 6, 15, 22, 59, 1001, 46, 13, 10, 38, 3, 42, 50, 37, 1, 2, 30, 18, 44, 26, 23, 1005, 1005, 2030]) {
                const pos = p.m_pos;
                InterfaceList.dirty[0] = false;
                m.actions[0] = action;
                m.paramC[0] = id;
                m.paramB[0] = [38, 6, 59, 1001].includes(action) ? -1 : 1;
                m.keys[0] = BigInt(action === 59 || action === 1001 ? 4 : obj);
                if (action === 1005 && ChatHistory.count !== 0) requireNonNull(c.itemCounts)[1] = 99;
                Client.DoAction(0, ui);
                rows.push(
                    [
                        Buffer.from(requireNonNull(p.m_data).subarray(pos, p.m_pos)).toString('hex'),
                        m.objSelected,
                        m.targetMode,
                        m.defaultCursor,
                        m.highlightComponent === c,
                        m.highlightTicks,
                        m.highlightSlot,
                        InterfaceList.dirty[0],
                        ChatHistory.count
                    ].join(' ')
                );
            }
            const app = (Client.activeClient = new Client());
            app.ui = ui;
            app.game = game;
            Client.gameState = 30;
            Client.loopCycle = 1;
            Client.mouseTracking = new MouseTracking();
            Client.lastSentFocus = GameShell.m_focus;
            MinimapBuilder.minimapLevel = ClientBuild.buildLevel = Client.playerLevel;
            Preferences.sent = true;
            OrbitCamera.reportPending = false;
            Protocol.sequenceAckPending = false;
            Client.stream = stream;
            InterfaceList.top = -1;
            c.if3 = false;
            c.clientCode = 206;
            for (let trial = 0; trial < 4; trial++) {
                c.itemIds = Int32Array.of(3, 6, 8);
                c.itemCounts = Int32Array.of(11, 23, 39);
                p.m_pos = 0;
                written = '';
                c.properties = new ServerActiveProperties((1 << 28) | (trial === 1 ? 1 << 29 : 0), -1);
                Client.bankArrangeMode = trial === 2 ? 1 : 0;
                if (trial === 3) c.itemIds[0] = 0;
                m.count = 1;
                m.actions[0] = 30;
                m.paramB[0] = 2;
                m.paramC[0] = id;
                m.isOpen = false;
                ComponentDrag.component = m.objDragComponent = null;
                ClientMouseListener.clickX = 10;
                ClientMouseListener.clickY = 20;
                ClientMouseListener.clickButton = 1;
                m.GameLoop(ui);
                ClientMouseListener.clickButton = 0;
                for (let step = 0; step < 6; step++) {
                    Client.hoveredSlotCom = c;
                    m.hoverSlot = 0;
                    ClientMouseListener.x = 10 + step * 4;
                    ClientMouseListener.mouseY = 20;
                    ClientMouseListener.mouseButton = step === 5 ? 0 : 1;
                    await app.GameLoop();
                    Client.loopCycle++;
                }
                rows.push(['[' + Array.from(c.itemIds).join(', ') + ']', '[' + Array.from(c.itemCounts).join(', ') + ']', m.objDragComponent === null, m.highlightTicks, written].join(' '));
            }
            const titleSession = new InterfaceSession(new InterfaceView([]), assets);
            InterfaceList.pressedContinue = null;
            const pos = p.m_pos;
            m.objSelected = 0;
            m.targetMode = false;
            m.count = 1;
            m.actions[0] = 38;
            m.paramB[0] = -1;
            m.paramC[0] = id;
            Client.DoAction(0, titleSession);
            rows.push(Buffer.from(requireNonNull(p.m_data).subarray(pos, p.m_pos)).toString('hex') + ' ' + (InterfaceList.pressedContinue === c));
            for (let lang = 0; lang < 3; lang++) {
                LocalisedText.setLanguage(lang);
                for (let i = 0; i < 96; i++) {
                    m.count = 1 + (i % 6);
                    m.objSelected = (i >> 1) & 1;
                    m.targetMode = (i & 4) !== 0;
                    m.shiftClick = (i & 8) !== 0;
                    ClientKeyboardListener.pressed[81] = (i & 16) !== 0;
                    m.objName = fromJsString('coin');
                    m.targetVerb = fromJsString('cast');
                    m.targetName = fromJsString('spell');
                    for (let j = 0; j < m.count; j++) {
                        m.option[j] = fromJsString('look' + j);
                        m.target[j] = fromJsString(((i + j) & 1) === 0 ? '' : 'item' + j);
                    }
                    rows.push(Buffer.from(requireNonNull(m.getTooltip()).toBytes()).toString('hex'));
                }
            }
            expect(rows.length).toBe(expected.length);
            for (let i = 0; i < rows.length; i++) expect(rows[i], 'step ' + i).toBe(expected[i]);
        } finally {
            Client.fontBold12 = font;
            GameShell.m_sWid = width;
            GameShell.m_sHei = height;
            [ClientMouseListener.clickButton, ClientMouseListener.clickX, ClientMouseListener.clickY] = mouse;
            Object.defineProperties(LocalisedText, strings);
            m.shiftClick = shift;
            ClientKeyboardListener.pressed[81] = held;
            m.isOpen = m.targetMode = m.showOpIndices = false;
            m.targetChild = -1;
            m.defaultCursor = m.objCursor = m.examineCursor = -1;
            m.count = m.deferred = m.objSelected = m.highlightTicks = m.highlightSlot = 0;
            m.objDragComponent = Client.hoveredSlotCom = m.highlightComponent = InterfaceList.pressedContinue = null;
            m.targetName = m.targetVerb = m.objName = null;
            InterfaceList.cycle = saved;
            InterfaceList.dirty.fill(false);
            Client.qaOpTest = false;
            ChatHistory.text.fill(null);
            ChatHistory.count = 0;
            ObjType.types.Reset();
            Client.bankArrangeMode = 0;
        }
    },
    20000
);
