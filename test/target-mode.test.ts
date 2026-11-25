import Client from '#/client/Client.js';
import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ClientMouseListener from '#/client/ClientMouseListener.js';
import ObjType from '#/config/ObjType.js';
import JagString, { fromLiteral } from '#/datastruct/JagString.js';
import GameWorld from '#/io/GameWorld.js';
import SafeTime from '#/io/SafeTime.js';
import WorldList from '#/io/WorldList.js';
import DelayedStateChange from '#/ui/DelayedStateChange.js';
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
import { closeGameStream, installSocketHost, openWorldSocket, settleSignlink } from './socket-host.js';
import { DelayedSocket, program } from './world-list-script.js';

const group = 44,
    id = group << 16,
    script = 192100;
const modes = ['enter', 'end', 'retarget', 'select', 'object', 'cleanup', 'menu-click', 'enter-dirty', 'end-dirty', 'enter-empty', 'end-empty', 'enter-negative', 'end-negative', 'idle', 'plain'];
const m = Minimenu;
function widget(id: number, slot: number, index: number): IfType {
    const c = new IfType();
    c.id = id;
    c.childId = slot;
    c.rootIndex = index;
    c.drawCycle = 23;
    c.targetOverCursor = 70 + index;
    c.targetLeaveCursor = 40 + index;
    c.properties = new ServerActiveProperties((index + 1) << 11, 80 + index);
    c.opBaseValue = fromLiteral('Widget' + index);
    c.targetVerbValue = fromLiteral('Spell' + index);
    c.if3 = true;
    return c;
}
function prepare(mode: string) {
    DelayedStateChange.varcs.fill(0);
    InterfaceList.dirty.fill(false);
    const oldParent = widget(id, -1, 0),
        newParent = widget(id + 1, -1, 1);
    const oldChild = widget(id, 0, 2),
        newChild = widget(id + 1, 0, 3),
        replacement = widget(id + 1, 0, 4);
    oldParent.childSlots = [oldChild];
    newParent.childSlots = [newChild];
    requireNonNull(IfType.m_list)[group] = [oldParent, newParent];
    requireNonNull(IfType.m_open)[group] = true;
    const hook = (waits: boolean) => [script + (waits ? 0 : 1), -2147483645, -2147483643];
    oldChild.onTargetLeave = hook(true);
    newChild.onTargetEnter = hook(true);
    replacement.onTargetEnter = hook(false);
    InterfaceList.cycle = 23;
    m.targetMode = true;
    m.defaultCursor = 9;
    m.targetChild = 0;
    m.targetComponent = id;
    m.targetCursor = 23;
    m.targetParam = 17;
    m.targetFlags = 38;
    m.targetVerb = fromLiteral('old-verb');
    m.targetName = fromLiteral('old-name');
    m.objSelected = 1;
    m.objComponent = id;
    m.objSlot = 8;
    m.objId = 11;
    m.objName = fromLiteral('old-object');
    m.highlightComponent = newParent;
    m.highlightTicks = 0;
    m.count = 1;
    m.isOpen = mode === 'menu-click';
    m.x = 21;
    m.y = 22;
    m.width = 90;
    m.height = 37;
    m.spriteStyle = false;
    ClientMouseListener.clickX = 40;
    ClientMouseListener.clickY = 53;
    ClientMouseListener.clickButton = 1;
    ComponentDrag.component = null;
    m.objDragComponent = null;
    if (mode === 'enter-dirty') newChild.rootIndex = 100;
    if (mode === 'end-dirty') oldChild.rootIndex = 100;
    if (mode === 'select' || mode === 'idle') m.targetMode = false;
    if (mode === 'end-empty') m.targetChild = 1;
    if (mode === 'end-negative') m.targetChild = -2;
    if (mode === 'plain') newChild.onTargetEnter = null;
    if (mode === 'idle') m.targetComponent = -1;
    return { oldParent, newParent, oldChild, newChild, replacement };
}
function state(): string {
    const text = (s: JagString | null) => (s === null ? '~' : Buffer.from(s.toBytes()).toString('hex'));
    return [
        '[' + [...DelayedStateChange.varcs.slice(0, 4)].join(', ') + ']',
        m.targetMode,
        m.defaultCursor,
        m.targetChild,
        m.targetComponent,
        m.targetCursor,
        m.targetParam,
        m.targetFlags,
        m.objSelected,
        m.objComponent,
        m.objSlot,
        m.objId,
        text(m.targetVerb),
        text(m.targetName),
        text(m.objName),
        '[' + InterfaceList.dirty.slice(0, 5).join(', ') + ']',
        m.isOpen
    ].join('/');
}
loginFixture(
    import.meta.url,
    'native target entry, cancellation and minimenu selection wait for the hook before updating cursors, target references and invalidation',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-target-mode-'));
        let expected: string[];
        try {
            const sources = ['game/WorldListOracle', 'game/WorldListBlockingOracle', 'ui/FloorConfigOracle', 'ui/TargetModeOracle'].map(file => fileURLToPath(new URL('./' + file + '.java', import.meta.url)));
            const compile = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, ...sources]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const reference = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'TargetModeOracle'], { timeout: 12000 });
            expect(reference.exitCode, reference.stderr.toString() + '\n' + reference.stdout.toString()).toBe(0);
            expected = reference.stdout.toString().trim().split(/\r?\n/);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
        const assets = localAssets(cachePath, [3, 12]),
            reports: Error[] = [],
            actual: string[] = [];
        const ui = new InterfaceSession(new InterfaceView([]), assets, e => reports.push(e));
        Client.gameState = 10;
        const obj = new ObjType();
        obj.id = 37;
        obj.name = fromLiteral('Rune');
        ObjType.types.Put(37n, obj);
        const event = '33:0 43:1 33:1 43:2';
        program(script, 2, 0, 0, 0, event + ' 0:1 43:0 6500 43:3 0:2 43:0 21');
        program(script + 1, 2, 0, 0, 0, event + ' 0:3 43:0 21');
        const action = (mode: string) => {
            if (mode.startsWith('enter') || mode === 'plain') return m.EnterTargetMode(311, mode === 'enter-empty' ? 1 : mode === 'enter-negative' ? -2 : 0, 312, id + 1, 313, 314, ui.runner);
            if (mode.startsWith('end') || mode === 'idle') return m.EndTargetMode(ui.runner);
            m.actions[0] = mode === 'object' ? 12 : mode === 'cleanup' || mode === 'menu-click' ? 1002 : 6;
            m.paramB[0] = 0;
            m.paramC[0] = id + 1;
            m.keys[0] = 37n;
            if (mode === 'menu-click') return m.GameLoop(ui);
            return Client.DoAction(0, ui);
        };
        for (const mode of modes) {
            const { oldParent, newParent, oldChild, newChild, replacement } = prepare(mode);
            if (mode.includes('empty') || mode.includes('negative') || mode === 'idle' || mode === 'plain') {
                let error = false,
                    pending: void | Promise<void> = undefined;
                try {
                    pending = action(mode);
                } catch {
                    error = true;
                }
                expect(pending).toBeUndefined();
                actual.push(mode + ' sync ' + error + '/' + state());
                continue;
            }
            WorldList.fetchStep = 1;
            WorldList.fetchAttempts = 0;
            GameWorld.fetchStartTime = SafeTime.CurrentTimeMillis();
            WorldList.lastFetchTime = 0n;
            GameWorld.m_num = 0;
            GameWorld.worldListBuffer = null;
            const socket = new DelayedSocket(Uint8Array.of(0, 0, 2, 1, 0));
            installSocketHost(async () => socket);
            openWorldSocket();
            await settleSignlink();
            const pending = action(mode);
            expect(pending).toBeInstanceOf(Promise);
            await Promise.race([
                socket.entered.promise,
                Promise.resolve(pending).then(() => {
                    throw Error('no socket read in ' + mode);
                })
            ]);
            actual.push(mode + ' before ' + state());
            if (mode === 'retarget') {
                requireNonNull(newParent.childSlots)[0] = replacement;
                newChild.properties = new ServerActiveProperties(9 << 11, 999);
                newChild.opBaseValue = fromLiteral('changed');
            }
            if (mode === 'enter') {
                requireNonNull(newParent.childSlots)[0] = replacement;
                newChild.rootIndex = 0;
            }
            if (mode === 'end') {
                requireNonNull(oldParent.childSlots)[0] = null;
                oldChild.rootIndex = 4;
            }
            socket.release.resolve();
            let error = false;
            try {
                await pending;
            } catch (e) {
                if (!mode.includes('dirty')) throw e;
                error = true;
            }
            actual.push(mode + ' after ' + error + '/' + state());
            await closeGameStream();
        }
        expect(reports).toEqual([]);
        expect(actual).toEqual(expected);
    },
    25000
);
