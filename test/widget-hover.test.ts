import MinimapBuilder from '#/dash3d/MinimapBuilder.js';
import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import ClientBuild from '#/client/ClientBuild.js';
import Mouse from '#/client/ClientMouseListener.js';
import GameShell from '#/client/GameShell.js';
import MouseTracking from '#/client/MouseTracking.js';
import Preferences from '#/ui/Preferences.js';
import SuperPacket from '#/io/SuperPacket.js';
import Protocol from '#/io/Protocol.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import { freshActors } from './actor-fixture.js';
import { loginFixture } from './login-fixture.js';
import { gamepackPath } from './reference.js';

loginFixture(
    import.meta.url,
    'the game loop preserves the original IF1 hover reset, tooltip delay and partial redraws',
    async () => {
        const steps: number[][] = [];
        for (let i = 0; i < 130; i++) steps.push([-2, -2, -999, 50, i < 53 ? 5 : i < 56 ? 26 : i < 110 ? 77 : 5, -1]);
        for (const x of [5, 26, 44, 77]) {
            for (const delay of [-1, 0, 50]) {
                for (const ticks of [-2147483648, -1, 0, 1, 49, 50, 51, 2147483647]) {
                    for (const invalid of [-1, 0, 1, 2]) steps.push([1, 0, ticks, delay, x, invalid]);
                }
            }
        }
        const dir = mkdtempSync(join(tmpdir(), 'rs530-widget-hover-'));
        let expected: string[];
        try {
            const exports = ['asm', 'asm.tree'].flatMap(name => ['--add-exports', 'java.base/jdk.internal.org.objectweb.' + name + '=ALL-UNNAMED']);
            const build = Bun.spawnSync(['javac', ...exports, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'ui/WidgetHoverOracle.java')]);
            expect(build.exitCode, build.stderr.toString()).toBe(0);
            const run = Bun.spawnSync(['java', ...exports, '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'WidgetHoverOracle'], { stdin: Buffer.from(steps.map(s => s.join(' ')).join('\n') + '\n') });
            expect(run.exitCode, run.stderr.toString()).toBe(0);
            expected = run.stdout.toString().trimEnd().split(/\r?\n/);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
        expect(expected.length).toBe(steps.length);
        const app = (Client.activeClient = new Client());
        freshActors();
        Client.gameState = 30;
        MinimapBuilder.minimapLevel = Client.playerLevel = ClientBuild.buildLevel = 0;
        Client.mouseTracking = new MouseTracking();
        Preferences.sent = true;
        const packet = (Client.out = new SuperPacket(5000));
        packet.SetEnc(Int32Array.of(13, 4, 7, 51));
        GameShell.m_sWid = 80;
        GameShell.m_sHei = 40;
        const widgets = Array.from({ length: 3 }, (_, i) => {
            const c = new IfType();
            c.parentId = -1;
            c.id = i;
            c.type = i === 2 ? 4 : 8;
            c.x = i * 22;
            c.width = c.height = 20;
            c.overLayer = i === 0 ? 2 : i;
            c.drawCycle = 15;
            return c;
        });
        const widgetId = (widget: IfType | null) => (widget === null ? -1 : widgets.indexOf(widget));
        IfType.m_list = [widgets];
        IfType.m_open = [true];
        InterfaceList.top = 0;
        InterfaceList.cycle = 15;
        Client.minimapClickX = -91;
        Client.minimapClickY = 127;
        const traverse = Client.LoopInterface;
        Client.LoopInterface = (...args) => {
            expect(InterfaceList.mouseOverComponent).toBeNull();
            expect(Client.tooltipComponent).toBeNull();
            return traverse(...args);
        };
        try {
            for (const [i, [lastHover, lastTip, timer, delay, x, invalid]] of steps.entries()) {
                if (lastHover >= -1) InterfaceList.mouseOverComponent = lastHover === -1 ? null : widgets[lastHover];
                if (lastTip >= -1) Client.tooltipComponent = lastTip === -1 ? null : widgets[lastTip];
                if (timer !== -999) Client.tooltipTimer = timer;
                InterfaceList.tooltipDelay = delay;
                Mouse.x = x;
                Mouse.mouseY = 7;
                for (const [id, widget] of widgets.entries()) widget.rootIndex = invalid === id ? 100 : id;
                InterfaceList.dirty.fill(false);
                Protocol.idleReads = Client.m_ticksSinceNoTimeOutPacket = packet.m_pos = 0;
                Client.loopCycle = i + 1;
                let outcome = 'ok';
                try {
                    await app.GameLoop();
                } catch (e) {
                    outcome = e instanceof RangeError ? 'bounds' : String(e);
                }
                const dirty = widgets.reduce((mask, _, j) => mask | (Number(InterfaceList.dirty[j]) << j), 0);
                const result = [outcome, widgetId(InterfaceList.mouseOverComponent), widgetId(Client.tooltipComponent), Client.tooltipTimer, InterfaceList.tooltipDelay, dirty, Client.minimapClickX, Client.minimapClickY];
                expect(result.join(' '), steps[i].join(' ')).toBe(expected[i]);
            }
        } finally {
            Client.LoopInterface = traverse;
        }
    },
    20000
);
