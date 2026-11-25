import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import Keyboard from '#/client/ClientKeyboardListener.js';
import GameShell from '#/client/GameShell.js';
import GameVariant from '#/client/GameVariant.js';
import OrbitCamera from '#/client/OrbitCamera.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import MinimapBuilder from '#/dash3d/MinimapBuilder.js';
import { fromJsString, toJsString } from '#/datastruct/JagString.js';
import Pix2D from '#/graphics/Pix2D.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import LocalisedText from '#/ui/LocalisedText.js';
import Minimenu from '#/ui/Minimenu.js';
import WrappedException from '#/util/WrappedException.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { localAssets } from '../cachefile.js';
import { loginFixture } from '../login-fixture.js';
import { cachePath, gamepackPath } from '../reference.js';

type Case = [group: number, state: number, point: number, mode: number, variant: number, keys: number, count: number, seed: number];
const surface = new Int32Array(960 * 515);
const clip = () => [Pix2D.clipMinX, Pix2D.clipMinY, Pix2D.clipMaxX, Pix2D.clipMaxY].join(',');

function frame([group, state, point, mode, variant, keys, count, seed]: Case): string {
    const w = (GameShell.m_sWid = group === 548 ? 765 : 960),
        h = (GameShell.m_sHei = 515);
    InterfaceList.top = group;
    const c = requireNonNull(IfType.Get((group << 16) | (group === 548 ? 64 : 8)));
    const root = requireNonNull(IfType.Get(c.parentId));
    Client.InterfaceCalculateSize(root, w, false, h);
    Client.InterfaceCalculatePosition(root, -116, w, h);
    Client.InterfaceCalculateSize(c, root.width, false, root.height);
    Client.InterfaceCalculatePosition(c, -116, root.width, root.height);
    const sprite = c.spriteId;
    c.maskStarts = c.maskWidths = null;
    expect(c.GetMask()).toBe(true);
    const starts = requireNonNull<Int32Array>(c.maskStarts),
        widths = requireNonNull<Int32Array>(c.maskWidths);
    if (mode === 6) {
        c.maskStarts = c.maskWidths = null;
        c.spriteId = 1000000;
    }
    c.hidden = mode === 5;
    const y = point < 5 ? 12 : point === 9 ? -1 : point === 10 ? c.height : 76;
    const x = point === 0 ? starts[y] - 1 : point === 1 ? starts[y] : point === 2 ? starts[y] + widths[y] : point === 3 ? starts[y] + widths[y] + 1 : point === 4 ? starts[y] + 1 : point === 5 ? 0 : point === 6 ? 151 : point === 7 ? 152 : 76;
    Minimenu.mouseX = root.x + c.x + x;
    Minimenu.mouseY = root.y + c.y + y;
    OrbitCamera.followYaw = seed;
    OrbitCamera.minimapAngle = seed * 113 + 31;
    OrbitCamera.minimapZoom = seed === 13 ? -256 : seed === 91 ? 2147483647 : seed * 109 + 2;
    Client.localPlayer = new ClientPlayer();
    Client.localPlayer.x = seed === 91 ? 2147483640 : 6341 + seed;
    Client.localPlayer.z = seed === 91 ? -2147483643 : 6413 - seed;
    Keyboard.pressed[81] = !!(keys & 1);
    Keyboard.pressed[82] = !!(keys & 2);
    GameVariant.id = variant;
    Client.minimapState = state;
    Minimenu.isOpen = mode === 4;
    Minimenu.targetMode = mode === 1 || mode === 2 || mode === 3;
    Minimenu.targetFlags = mode === 1 ? 32 : 64;
    Minimenu.targetChild = mode === 3 ? 312 : -1;
    Minimenu.targetComponent = c.id;
    Minimenu.defaultCursor = 29;
    Minimenu.targetCursor = 87;
    Minimenu.targetVerb = fromJsString('Cast');
    Minimenu.walkHere = fromJsString('Walk');
    LocalisedText.faceHere = fromJsString('Face');
    Minimenu.count = count;
    Client.loopCycle = InterfaceList.cycle = 399;
    InterfaceList.rootCount = 1;
    Client.rectDebug = 0;
    InterfaceList.rectRedrawnLastFrame.fill(false);
    InterfaceList.dirty.fill(false);
    InterfaceList.rectangleRedraw.fill(false);
    const groups = requireNonNull(IfType.m_list),
        actual = requireNonNull(groups[group]),
        kept = new Array<IfType | null>(actual.length).fill(null);
    kept[root.id & 65535] = root;
    kept[c.id & 65535] = c;
    groups[group] = kept;
    Pix2D.setPixels(surface, w, h);
    let draw = '-',
        status = 'ok';
    const paint = MinimapBuilder.Draw;
    MinimapBuilder.Draw = (sx, widget, index, sy) => {
        expect(widget).toBe(c);
        paint(sx, widget, index, sy);
        draw = [sx, sy, index, clip()].join(',');
        if (mode === 7) {
            Minimenu.mouseX = sx + 100;
            Minimenu.mouseY = sy + 80;
            Client.minimapState = 3;
            OrbitCamera.followYaw = -839;
            OrbitCamera.minimapAngle = 92;
            OrbitCamera.minimapZoom = 19;
        }
        if (mode === 8) c.maskStarts = new Int32Array(0);
        if (mode === 9) c.maskWidths = null;
        if (mode === 10) Client.localPlayer = null;
    };
    try {
        Client.drawTopLevelInterface();
    } catch (caught) {
        let err = caught;
        while (err instanceof WrappedException) err = err.cause;
        if (err instanceof TypeError) status = 'null';
        else if (err instanceof RangeError) status = 'bounds';
        else throw err;
    } finally {
        MinimapBuilder.Draw = paint;
        groups[group] = actual;
        c.maskStarts = starts;
        c.maskWidths = widths;
        c.hidden = false;
        c.spriteId = sprite;
    }
    const rows: string[] = [];
    for (let i = count; i < Minimenu.count; i++) {
        const option = Minimenu.option[i],
            target = Minimenu.target[i];
        rows.push([Minimenu.actions[i], Minimenu.paramB[i], Minimenu.paramC[i], Minimenu.keys[i], Minimenu.cursor[i], option === null ? 'null' : toJsString(option), target === null ? 'null' : toJsString(target)].join(','));
    }
    return [status, draw, [Minimenu.count, Minimenu.targetMode, Minimenu.defaultCursor, InterfaceList.rectangleRedraw[1]].join(','), rows.join(';'), clip()].join('|');
}

loginFixture(
    import.meta.url,
    'native minimap widget hits publish the same walk, face and targeted tile menu rows as the 530 JAR',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), '530-minimap-menu-'));
        try {
            const cases: Case[] = [];
            for (const group of [548, 746]) {
                for (const state of [0, 1, 2, 3, 4, 5])
                    for (let point = 0; point <= 10; point++)
                        for (let mode = 0; mode < 7; mode++) {
                            const n = cases.length;
                            cases.push([group, state, point, mode, n & 1, n & 3, 1, [-51, 0, 1, 13, 91, 318, 2047][n % 7]]);
                        }
                for (let mode = 7; mode <= 10; mode++) for (const point of [0, 1, 2, 3, 8, 9]) cases.push([group, 0, point, mode, 1, 3, 1, 91]);
                for (const count of [0, 498, 499, 500]) for (const variant of [0, 1]) for (const mode of [0, 2]) cases.push([group, 3, 8, mode, variant, 2, count, -53]);
            }
            const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
            const cc = Bun.spawnSync(['javac', asm, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'WidgetMinimapMenuOracle.java'), join(import.meta.dir, '../render/ProceduralTextureCacheOracle.java')]);
            expect(cc.exitCode, cc.stderr.toString()).toBe(0);
            const java = ['java', '-Xmx256m', '-Djava.awt.headless=true', asm, '-cp', dir + delimiter + gamepackPath, 'WidgetMinimapMenuOracle'];
            const prep = Bun.spawnSync([...java, gamepackPath, dir]);
            expect(prep.exitCode, prep.stderr.toString()).toBe(0);
            const run = Bun.spawnSync([...java, cachePath], { stdin: Buffer.from(cases.map(v => v.join(' ')).join('\n') + '\n') });
            expect(run.exitCode, run.stderr.toString()).toBe(0);
            const lines = run.stdout.toString().trimEnd().split(/\r?\n/);
            expect(lines.length).toBe(cases.length);
            localAssets(cachePath, [3, 8]);
            for (const [i, c] of cases.entries()) expect(frame(c), c.join(' ')).toBe(lines[i]);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    30000
);
