import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import ClientMouseListener from '#/client/ClientMouseListener.js';
import MouseWheel from '#/client/MouseWheel.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import HashTable from '#/datastruct/HashTable.js';
import { fromJsString } from '#/datastruct/JagString.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import ServerActiveProperties from '#/ui/ServerActiveProperties.js';
import Pix2D from '#/graphics/Pix2D.js';
import InterfaceView from '#/ui/InterfaceView.js';
import Minimenu from '#/ui/Minimenu.js';
import WrappedException from '#/util/WrappedException.js';
import { loginFixture } from './login-fixture.js';
import { gamepackPath } from './reference.js';

function run(f: () => void): string {
    try {
        f();
        return 'ok';
    } catch {
        return 'error';
    }
}

function dirtyHash(): number {
    let hash = 1;
    for (const dirty of InterfaceList.dirty) hash = (Math.imul(31, hash) + (dirty ? 1231 : 1237)) | 0;
    return hash;
}

test('native component visibility, redraw, scrollbar and hardcoded widget states match the gamepack', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rs530-widget-controls-'));
    const saved = {
        qa: Client.qaOpTest,
        props: Client.serverActiveProperties,
        cycle: Client.loopCycle,
        redraw: InterfaceList.cycle,
        dirty: InterfaceList.dirty.slice(),
        button: ClientMouseListener.mouseButton,
        wheel: MouseWheel.rotation,
        grab: Client.scrollGrabbed,
        pad: Client.scrollInputPadding,
        player: Client.localPlayer,
        primary: Client.idkDesignButton1,
        secondary: Client.genderButtonImage1,
        female: Client.designAppearance.female
    };
    try {
        const compile = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'ui/InterfaceControlsOracle.java')]);
        expect(compile.stderr.toString()).toBe('');
        const codes = [324, 325, 327, 328, 205, 1338, 1354, 1405];
        const heights = [64, 72, 120, 40, 16, -120, 2147483647, -2147483648];
        const rows: number[][] = [];
        let random = 0x530;
        for (let i = 0; i < 1024; i++) {
            random = (Math.imul(1664525, random) + 1013904223) | 0;
            const x = i % 13 === 2 ? 2147483643 : 20,
                y = i % 13 === 4 ? -2147483643 : 56;
            const height = heights[(i >>> 3) & 7],
                width = i % 19 === 0 ? -90 : 45;
            const mouseX = x + [-width, -32, -1, 0, 3, 15, 16, 31][i & 7];
            const mouseY = y + [-1, 0, 15, 16, 17, height - 17, height - 16, height - 1, height][i % 9];
            rows.push([
                codes[i & 7],
                random >>> 20,
                i % 17 === 0 ? -2147483648 : random,
                width,
                height,
                [0, height, height + 30, height + 10000, 1][i % 5] | 0,
                x,
                y,
                mouseX | 0,
                mouseY | 0,
                [-1, 0, 1, 2][i & 3],
                [0, 1, -1, 2147483647][(i >>> 2) & 3],
                [-1, 0, 37, 99, 100][i % 5],
                [0, 1, -1][i % 3],
                i % 11 === 0 ? -1 : ~i,
                random ^ 765,
                random | 0
            ]);
        }
        const binary = Buffer.alloc((1 + rows.length * rows[0].length) * 4);
        binary.writeInt32BE(rows.length);
        let offset = 4;
        for (const row of rows)
            for (const value of row) {
                binary.writeInt32BE(value, offset);
                offset += 4;
            }
        const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'InterfaceControlsOracle'], { stdin: binary });
        expect(java.stderr.toString()).toBe('');
        expect(java.exitCode).toBe(0);
        const expected = java.stdout.toString().trim().split(/\r?\n/);
        Client.serverActiveProperties = new HashTable<ServerActiveProperties>(512);
        Client.scrollGrabbed = false;
        for (const [i, row] of rows.entries()) {
            const [code, flags, cycle, width, height, scrollHeight, x, y, mx, my, button, wheel, root, events, sprite, active, scroll] = row;
            const c = new IfType();
            Object.assign(c, {
                id: i,
                clientCode: code,
                width,
                rootIndex: root,
                spriteId: sprite,
                activeSprite: active,
                scrollY: scroll,
                modelXAngle: -23,
                modelYAngle: -42,
                modelType: 11,
                modelId: -91,
                modelCycle: 99,
                modelFrame: 4,
                modelNext: 6,
                modelAnim: 77
            });
            Client.loopCycle = cycle;
            ClientMouseListener.mouseButton = button;
            MouseWheel.rotation = wheel;
            Client.qaOpTest = (flags & 1) !== 0;
            c.hidden = (flags & 2) !== 0;
            c.type = (flags & 4) !== 0 ? 0 : 3;
            c.properties = new ServerActiveProperties(events, -1);
            if (flags & 8) Client.serverActiveProperties.put(new ServerActiveProperties(~events, -1), (BigInt(i) << 32n) + BigInt(c.childId));
            InterfaceList.cycle = 5;
            c.drawCycle = (flags & 16) !== 0 ? 4 : 5;
            Client.localPlayer = (flags & 32) !== 0 ? null : new ClientPlayer();
            if (Client.localPlayer !== null) {
                Client.localPlayer.username = (flags & 64) !== 0 ? null : fromJsString('zZ_' + i + '97!');
                Client.localPlayer.walkFrame = i;
                Client.localPlayer.walkNext = i * 3;
                Client.localPlayer.walkSeq = ~i;
            }
            Client.designAppearance.female = (flags & 128) !== 0;
            if (i % 13 === 0) Client.idkDesignButton1 = Client.genderButtonImage1 = -1;
            if (i % 7 === 0) Client.scrollGrabbed = true;
            const state: (number | boolean | string)[] = [Client.Hide(c)];
            InterfaceList.dirty.fill(false);
            state.push(
                run(() => Client.ComponentUpdated(c)),
                dirtyHash()
            );
            InterfaceList.dirty.fill(false);
            state.push(
                run(() => Client.DoScrollbar(c, x, y, height, scrollHeight, mx, my)),
                dirtyHash(),
                c.scrollY,
                Client.scrollGrabbed,
                Client.scrollInputPadding
            );
            state.push(
                run(() => Client.ClientComponent(c)),
                c.spriteId,
                c.activeSprite,
                c.modelXAngle,
                c.modelYAngle,
                c.modelType,
                c.modelId,
                c.modelCycle,
                c.modelFrame,
                c.modelNext,
                c.modelAnim,
                Client.idkDesignButton1,
                Client.genderButtonImage1
            );
            expect(state.join(' ')).toBe(expected[i]);
        }
        expect(expected).toHaveLength(rows.length);
    } finally {
        Client.loopCycle = saved.cycle;
        Client.localPlayer = saved.player;
        Client.qaOpTest = saved.qa;
        Client.serverActiveProperties = saved.props;
        ClientMouseListener.mouseButton = saved.button;
        MouseWheel.rotation = saved.wheel;
        Client.scrollGrabbed = saved.grab;
        Client.scrollInputPadding = saved.pad;
        Client.idkDesignButton1 = saved.primary;
        Client.genderButtonImage1 = saved.secondary;
        Client.designAppearance.female = saved.female;
        InterfaceList.cycle = saved.redraw;
        InterfaceList.dirty.splice(0, 100, ...saved.dirty);
        rmSync(dir, { recursive: true, force: true });
    }
});

loginFixture(
    import.meta.url,
    'hardcoded client widgets retain Java appearance state and pre-position update order',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-design-'));
        try {
            const build = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'ui/InterfaceControlsOracle.java')]);
            expect(build.exitCode, build.stderr.toString()).toBe(0);
            const run = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'InterfaceControlsOracle', 'design']);
            expect(run.exitCode, run.stderr.toString()).toBe(0);
            const expected = run.stdout.toString().trimEnd().split(/\r?\n/);
            const appearance = Client.designAppearance;
            expect(String(appearance !== null && appearance === Client.designAppearance)).toBe(expected[0]);
            let i = 1;
            for (let mode = 0; mode < 7; mode++) {
                for (const code of [-1, 324, 325, 327, 328]) {
                    for (let state = 0; state < 8; state++) {
                        Client.designAppearanceInstance = (state & 1) !== 0 ? null : appearance;
                        if ((state & 1) === 0) appearance.female = (state & 2) !== 0;
                        Client.localPlayer = (state & 2) === 0 ? null : new ClientPlayer();
                        if (Client.localPlayer !== null && (state & 4) !== 0) {
                            Client.localPlayer.username = fromJsString('Majula');
                            Client.localPlayer.walkFrame = 17;
                            Client.localPlayer.walkNext = 29;
                            Client.localPlayer.walkSeq = 31;
                        }
                        const c = new IfType();
                        Object.assign(c, {
                            clientCode: code,
                            type: 1,
                            parentId: -1,
                            x: mode === 3 ? 120 : 5,
                            y: 3,
                            width: 7,
                            height: 9,
                            if3: mode !== 4,
                            hidden: mode === 2 || mode === 4,
                            spriteId: 71,
                            activeSprite: 83,
                            rootIndex: -10,
                            drawCycle: -9
                        });
                        Client.idkDesignButton1 = (state & 4) === 0 ? -1 : 111;
                        Client.genderButtonImage1 = 113;
                        Client.qaOpTest = false;
                        Client.loopCycle = 398;
                        InterfaceList.rootCount = 3;
                        InterfaceList.cycle = 398;
                        InterfaceList.rectRedrawnLastFrame[3] = mode !== 5;
                        Client.rectDebug = 0;
                        Minimenu.isOpen = true;
                        const pixels = new Int32Array(32 * 24);
                        Pix2D.setPixels(pixels, 32, 24);
                        let result = 'ok';
                        try {
                            if (mode === 0 || mode === 6) Client.ClientComponent(mode === 6 ? null : c);
                            else new InterfaceView([c]).draw();
                        } catch (error) {
                            if (!(error instanceof WrappedException) || !(error.cause instanceof TypeError)) throw error;
                            result = 'NullPointerException@' + error.context;
                        }
                        const actual = [
                            result,
                            Client.designAppearanceInstance === null,
                            Client.idkDesignButton1,
                            Client.genderButtonImage1,
                            c.spriteId,
                            c.rootIndex,
                            c.drawCycle,
                            c.modelXAngle,
                            c.modelYAngle,
                            c.modelType,
                            c.modelId,
                            c.modelCycle,
                            c.modelFrame,
                            c.modelNext,
                            c.modelAnim
                        ];
                        expect(actual.join('|'), [mode, code, state].join(' ')).toBe(expected[i++]);
                    }
                }
            }
            expect(expected).toHaveLength(i);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    30000
);
