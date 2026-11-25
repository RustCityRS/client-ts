import { expect } from 'bun:test';
import { closeSync, fstatSync, mkdtempSync, openSync, readSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { compareFramebuffers } from '../render/Framebuffer.js';
import Client from '#/client/Client.js';
import ClientMouseListener from '#/client/ClientMouseListener.js';
import Js5 from '#/cache/Js5.js';
import ObjType from '#/config/ObjType.js';
import Pix3D from '#/dash3d/Pix3D.js';
import TextureCache from '#/dash3d/TextureCache.js';
import { fromLiteral } from '#/datastruct/JagString.js';
import Pix2D from '#/graphics/Pix2D.js';
import SoftwareFont from '#/graphics/SoftwareFont.js';
import SpriteLoader from '#/graphics/SpriteLoader.js';
import AreaSoundManager from '#/sound/AreaSoundManager.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import InterfaceSession from '#/ui/InterfaceSession.js';
import InterfaceView from '#/ui/InterfaceView.js';
import Minimenu from '#/ui/Minimenu.js';
import SubInterface from '#/ui/SubInterface.js';
import { requireNonNull } from '#/util/JavaArray.js';
import WrappedException from '#/util/WrappedException.js';
import { localAssets } from '../cachefile.js';
import { loginFixture } from '../login-fixture.js';
import { cachePath, gamepackPath } from '../reference.js';

type Row = [group: number, file: number, layout: number, action: number, fault: number, mouseDelta: number];
const width = 146,
    height = 106;
function cases(): Row[] {
    const rows: Row[] = [];
    // All 17 type-2 definitions in archive 3, including custom equipment slot backgrounds and offsets.
    for (const [group, file] of [
        [35, 92],
        [43, 105],
        [47, 138],
        [149, 0],
        [287, 2],
        [288, 131],
        [289, 62],
        [311, 3],
        [367, 75],
        [387, 28],
        [394, 106],
        [396, 132],
        [449, 0],
        [467, 164],
        [513, 0],
        [517, 0],
        [518, 78]
    ]) {
        for (let action = 0; action <= 4; action++) rows.push([group, file, 0, action, 0, 16]);
    }
    for (let layout = 0; layout <= 4; layout++) {
        for (const delta of [-220, -32, -5, -4, 0, 4, 5, 24, 145]) rows.push([149, 0, layout, 4, 0, delta]);
        for (let fault = 1; fault <= 17; fault++) rows.push([149, 0, layout, 4, fault, fault % 2 === 0 ? -70 : 83]);
    }
    return rows;
}
function container(id: number): IfType {
    return Object.assign(new IfType(), { id, parentId: -1, if3: true, type: 0, x: 7, y: 9, width: 92, height: 59, scrollY: 19, scrollHeight: 117 });
}
function draw(ifs: Js5, session: InterfaceSession, [group, file, layout, action, fault, delta]: Row) {
    const grid = IfType.decode((group << 16) | file, requireNonNull(ifs.GetFile(file, group)));
    if (grid.type !== 2) throw new Error('Missing IF1 inventory ' + group + '/' + file);
    grid.x = 4;
    grid.y = 8;
    grid.width = grid.baseWidth * 32;
    grid.height = grid.baseHeight * 32;
    const ids = requireNonNull(grid.itemIds),
        counts = requireNonNull(grid.itemCounts);
    if (action !== 0) {
        const items = [4151, 995, 4152, 303, 1127];
        for (let i = 0; i < ids.length; i++)
            if (i % 7 !== 6) {
                ids[i] = 1 + items[i % items.length];
                counts[i] = i === 1 ? 101 : 1;
            }
    }
    const index = layout === 2 || layout === 3 ? 3 : 0;
    const parent = container((64 << 16) + index),
        other = container(-4);
    other.parentId = -77;
    other.scrollY = 11;
    other.scrollHeight = 145;
    let widgets = new Array<IfType | null>(5).fill(null);
    const source = widgets;
    grid.parentId = -1;
    InterfaceList.subInterfaces.clear();
    if (layout === 0) widgets[2] = grid;
    else {
        grid.parentId = parent.id;
        widgets[index] = parent;
        if (layout === 3) {
            parent.childSlots = new Array<IfType | null>(fault === 9 ? 2 : 5).fill(null);
            parent.childSlots[1] = grid;
            if (fault !== 9 && fault !== 10) parent.childSlots[index] = other;
        } else widgets[4] = grid;
        if (layout === 4) {
            const host = container(71 << 16);
            host.scrollY = 8;
            requireNonNull(IfType.m_list)[12] = widgets;
            requireNonNull(IfType.m_open)[12] = true;
            const mounted = Object.assign(new SubInterface(), { type: 1, group: 12 });
            InterfaceList.subInterfaces.put(mounted, BigInt(host.id));
            widgets = [host];
        }
    }
    Minimenu.objSelected = action === 2 ? 1 : 0;
    Minimenu.objComponent = grid.id;
    Minimenu.objSlot = 0;
    Minimenu.highlightComponent = action === 3 ? grid : null;
    Minimenu.highlightSlot = 0;
    Minimenu.objDragComponent = action === 4 ? grid : null;
    Minimenu.objDragSlot = 0;
    Minimenu.objDragCycles = fault === 13 ? 4 : 5;
    Minimenu.objGrabX = 14;
    Minimenu.objGrabY = 20;
    ClientMouseListener.x = 14 + delta;
    ClientMouseListener.mouseY = 20 + delta;
    AreaSoundManager.elapsed = fault === 12 ? -2147483648 : 3;
    if (fault === 1) grid.invSlotOffsetX = new Int32Array(1);
    if (fault === 2) grid.invSlotOffsetY = null;
    if (fault === 3) grid.itemIds = ids.slice(0, 2);
    if (fault === 4) grid.itemCounts = counts.slice(0, 2);
    if (fault === 5) {
        ids[0] = 0;
        requireNonNull(grid.invSlotSprite)[0] = 900000;
    }
    if (fault === 6 || fault === 11) ids[0] = 40001;
    if (fault === 14) {
        grid.x = width + 1;
        grid.y = height + 1;
    }
    IfType.resourceMissing = true;
    Minimenu.isOpen = true;
    Client.rectDebug = 0;
    InterfaceList.rootCount = 2;
    Client.loopCycle = InterfaceList.cycle = 92;
    InterfaceList.dirty.length = fault === 11 || fault === 17 ? 2 : 100;
    InterfaceList.dirty.fill(false);
    InterfaceList.rectRedrawnLastFrame[2] = fault !== 7;
    ObjType.ResetSpriteCache();
    Pix3D.textureFallback = fault === 8;
    const pixels = Int32Array.from({ length: width * height }, (_, i) => (0x506078 + i * 91) & 0xffffff);
    Pix2D.setPixels(pixels, width, height);

    if (fault === 16 || fault === 17) {
        requireNonNull(ObjType.GetSprite(4151, 1, grid.showItemCount, 1, 3153952));
        Pix3D.textureFallback = true;
        InterfaceList.cycle = 91;
    }
    let status = 'ok';
    InterfaceList.top = 6;
    requireNonNull(IfType.m_list)[6] = widgets;
    session.refreshView();
    if (fault === 15 && layout !== 0) {
        other.id = parent.id;
        if (layout === 3) {
            requireNonNull(parent.childSlots)[index] = null;
        } else {
            other.parentId = -1;
            source[index] = other;
        }
    }
    try {
        Client.DrawLayer(0, widgets, -1, height - 4, 2, -1, width - 3, 0, 2);
    } catch (caught) {
        let error = caught;
        while (error instanceof WrappedException) error = error.cause;
        if (error instanceof TypeError) status = 'null';
        else if (error instanceof RangeError) status = 'bounds';
        else throw error;
    }
    return {
        pixels,
        state: [status, IfType.resourceMissing, Pix3D.textureFallback, !!InterfaceList.dirty[2], Minimenu.objGrabY, parent.scrollY, other.scrollY, grid.rootIndex, grid.drawCycle, Pix2D.clipMinX, Pix2D.clipMinY, Pix2D.clipMaxX, Pix2D.clipMaxY].join(
            ' '
        )
    };
}
loginFixture(
    import.meta.url,
    'IF1 inventory slots, drag scrolling and fault state reproduce the original 530 layer',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-inventory-grid-'));
        let fd: number | undefined;
        try {
            const path = join(dir, 'frames');
            const cc = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'InventoryGridOracle.java'), join(import.meta.dir, '../render/ProceduralTextureCacheOracle.java')]);
            expect(cc.exitCode, cc.stderr.toString()).toBe(0);
            const rows = cases();
            const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'InventoryGridOracle', cachePath, path], { stdin: Buffer.from(rows.map(row => row.join(' ')).join('\n') + '\n') });
            expect(java.exitCode, java.stderr.toString()).toBe(0);
            const states = java.stdout.toString().trimEnd().split(/\r?\n/);
            expect(states.length).toBe(rows.length);
            const state = (row: Row) => states[rows.findIndex(candidate => candidate.every((n, i) => row[i] === n))];
            expect(state([149, 0, 2, 4, 0, -220])).toBe('ok false false true 39 0 11 2 92 2 2 143 102');
            expect(state([149, 0, 3, 4, 0, 145])).toBe('ok false false false -10 19 41 2 92 2 2 143 102');
            expect(state([149, 0, 3, 4, 9, 83])).toBe('bounds true false false 20 19 11 2 92 7 9 99 68');
            expect(state([149, 0, 3, 4, 10, -70])).toBe('null true false false 20 19 11 2 92 7 9 99 68');
            const assets = localAssets(cachePath, [3, 7, 8, 9, 13, 19, 26]);
            const session = new InterfaceSession(new InterfaceView([]), assets);
            const sprites = assets.archive(8);
            const smallFont = SpriteLoader.loadFont(sprites, sprites.GetGroupId(fromLiteral('p11_full')), 0, assets.archive(13));
            if (!(smallFont instanceof SoftwareFont)) throw new Error('Missing p11_full');
            ObjType.Init(assets.archive(19), true, smallFont, assets.archive(7));
            ObjType.List(40000).model = 900000;
            Pix3D.textureProvider = new TextureCache(assets.archive(9), assets.archive(26), sprites, 20, false);
            Pix3D['brightness'] = Math.fround(0.8);
            Pix3D['initColourTable'](0, 512);
            fd = openSync(path, 'r');
            const reference = new Int32Array(width * height),
                bytes = new Uint8Array(reference.buffer);
            expect(fstatSync(fd).size).toBe(bytes.length * rows.length);
            for (const [i, row] of rows.entries()) {
                let offset = 0;
                while (offset < bytes.length) {
                    const n = readSync(fd, bytes, offset, bytes.length - offset, null);
                    if (n === 0) throw new Error('Truncated original frame ' + i);
                    offset += n;
                }
                const actual = draw(assets.archive(3), session, row);
                expect(actual.state, row.join(' ')).toBe(states[i]);
                const dimensions = { width, height, pitch: width };
                expect(() => compareFramebuffers({ ...dimensions, pixels: reference }, { ...dimensions, pixels: actual.pixels }), row.join(' ')).not.toThrow();
            }
        } finally {
            if (fd !== undefined) closeSync(fd);
            rmSync(dir, { recursive: true, force: true });
        }
    },
    60000
);
