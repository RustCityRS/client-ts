import { expect } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import OrbitCamera from '#/client/OrbitCamera.js';
import MinimapBuilder from '#/dash3d/MinimapBuilder.js';
import { fromJsString } from '#/datastruct/JagString.js';
import Pix2D from '#/graphics/Pix2D.js';
import type Pix32 from '#/graphics/Pix32.js';
import SpriteLoader from '#/graphics/SpriteLoader.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import Minimenu from '#/ui/Minimenu.js';
import Preferences from '#/ui/Preferences.js';
import WrappedException from '#/util/WrappedException.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { localAssets } from '../cachefile.js';
import { loginFixture } from '../login-fixture.js';
import { cachePath, gamepackPath } from '../reference.js';

type Case = [layout: number, state: number, yaw: number, mode: number];

function ints(values: Int32Array | null) {
    return values?.reduce((hash, n) => (Math.imul(hash, 31) + n) | 0, 1) ?? 0;
}

function frame([layout, state, yaw, mode]: Case, image: Pix32): string {
    const w = layout === 0 ? 765 : layout === 1 ? 957 : 1280,
        h = layout === 0 ? 503 : layout === 1 ? 613 : 720;
    const c = requireNonNull(IfType.Get(layout === 0 ? (548 << 16) | 65 : (746 << 16) | 10));
    const root = requireNonNull(IfType.Get(c.parentId));
    Client.InterfaceCalculateSize(root, w, false, h);
    Client.InterfaceCalculatePosition(root, -116, w, h);
    Client.InterfaceCalculateSize(c, root.width, false, root.height);
    Client.InterfaceCalculatePosition(c, -116, root.width, root.height);
    expect([c.clientCode, c.width, c.height, c.spriteId]).toEqual([1339, 33, 33, 1186]);
    const x = root.x + c.x,
        y = root.y + c.y;
    OrbitCamera.followYaw = yaw;
    Client.minimapState = state;
    Client.imageCompass = mode === 3 ? null : image;
    Preferences.highDetailTextures = Preferences.highDetailTextures2 = Preferences.highDetailLighting = (yaw & 1) === 0;
    Client.loopCycle = 191;
    Client.rectDebug = 0;
    Client.qaOpTest = false;
    InterfaceList.rootCount = 2;
    InterfaceList.rectRedrawnLastFrame.fill(false);
    InterfaceList.dirty.fill(false);
    Object.assign(InterfaceList, { rectangleRedraw: new Array<boolean>(mode === 4 ? 2 : 100).fill(false) });
    Minimenu.isOpen = false;
    Minimenu.mouseX = Minimenu.mouseY = -5;
    c.maskStarts = c.maskWidths = null;
    c.hidden = mode === 11;
    if (mode === 1 || mode === 5) expect(c.GetMask()).toBe(true);
    if (mode === 5) c.maskWidths = requireNonNull<Int32Array>(c.maskWidths).slice(0, 10);
    if (mode === 1 || mode === 2 || mode === 8) c.spriteId = 1000000;
    const probe = Object.assign(new IfType(), { parentId: root.id, id: -38, type: 5, clientCode: 1339, spriteId: 1000000, width: 1, height: 1 });
    const events: string[] = [];
    const clip = () => [Pix2D.clipMinX, Pix2D.clipMinY, Pix2D.clipMaxX, Pix2D.clipMaxY].join(',');
    c.GetMask = () => {
        events.push('mask,' + clip());
        const value = IfType.prototype.GetMask.call(c);
        if (mode === 7 || mode === 8) Pix2D.setClipping(4, 6, 19, 22);
        return value;
    };
    probe.GetMask = () => {
        events.push('probe,' + clip());
        return IfType.prototype.GetMask.call(probe);
    };
    const paint = MinimapBuilder.CompassDraw;
    MinimapBuilder.CompassDraw = (index, widget, limit, sx, sy) => {
        events.push(['draw', index, limit, sx, sy, clip()].join(','));
        paint(index, widget, limit, sx, sy);
        if (mode === 7) Pix2D.setClipping(7, 9, 14, 18);
    };
    const pixels = new Int32Array(mode === 6 ? (y + 12) * w + x + 15 : w * h).fill(0x4b2369);
    Pix2D.setPixels(pixels, w, h);
    Pix2D.setClipping(15, 11, 19, 27);
    const left = mode === 9 ? x + 40 : mode === 10 ? x + 16 : 0,
        top = mode === 10 ? y + 8 : 0;
    let result = 'ok';
    try {
        Client.DrawLayer(0, [root, c, probe], -1, mode === 10 ? y + 17 : h, top, -1, mode === 10 ? x + 21 : w, 0, left);
    } catch (caught) {
        let err = caught;
        while (err instanceof WrappedException) err = err.cause;
        if (err instanceof TypeError) result = 'null';
        else if (err instanceof RangeError) result = 'bounds';
        else throw err;
    } finally {
        Reflect.deleteProperty(c, 'GetMask');
        MinimapBuilder.CompassDraw = paint;
        c.spriteId = 1186;
        c.hidden = false;
    }
    let changed = 0;
    for (let i = 0; i < pixels.length; i++) if (pixels[i] !== 0x4b2369) changed++;
    const digest = createHash('sha256').update(new Uint8Array(pixels.buffer)).digest('hex');
    return [result, events.join(';'), clip(), [InterfaceList.rootCount, c.rootIndex, c.drawCycle, InterfaceList.dirty[2], !!InterfaceList.rectangleRedraw[2], ints(c.maskStarts), ints(c.maskWidths)].join(','), changed, digest].join('|');
}

loginFixture(
    import.meta.url,
    'fixed and resizable compass widgets call the native mask and draw on the live frame',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), '530-widget-compass-'));
        try {
            const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
            const cc = Bun.spawnSync(['javac', asm, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'WidgetCompassOracle.java'), join(import.meta.dir, '../render/ProceduralTextureCacheOracle.java')]);
            expect(cc.exitCode, cc.stderr.toString()).toBe(0);
            const java = ['java', '-Xmx256m', '-Djava.awt.headless=true', asm, '-cp', dir + delimiter + gamepackPath, 'WidgetCompassOracle'];
            const prep = Bun.spawnSync([...java, gamepackPath, dir]);
            expect(prep.exitCode, prep.stderr.toString()).toBe(0);
            const cases: Case[] = [];
            for (const layout of [0, 1, 2]) {
                for (const state of [0, 1, 2, 3, 4, 5]) for (const yaw of [-1, 0, 513, 1024, 1777, 2048]) cases.push([layout, state, yaw, 0]);
                for (let mode = 1; mode <= 11; mode++) for (const state of [0, 3]) cases.push([layout, state, 317 + state, mode]);
            }
            const run = Bun.spawnSync([...java, cachePath], { stdin: Buffer.from(cases.map(c => c.join(' ')).join('\n') + '\n') });
            expect(run.exitCode, run.stderr.toString()).toBe(0);
            const lines = run.stdout.toString().trimEnd().split(/\r?\n/);
            expect(lines).toHaveLength(cases.length);
            const assets = localAssets(cachePath, [3, 8]);
            const archive = assets.archive(8);
            const image = requireNonNull(SpriteLoader.loadSoftwareSprite(archive, archive.GetGroupId(fromJsString('compass')), 0));
            image.trim();
            for (const [i, c] of cases.entries()) {
                if (c[3] === 0) expect(lines[i].split('|')[4]).toBe('853');
                expect(frame(c, image), c.join(' ')).toBe(lines[i]);
            }
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    30000
);
