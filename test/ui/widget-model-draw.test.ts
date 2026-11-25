import { expect } from 'bun:test';
import { compareFramebuffers } from '../render/Framebuffer.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import ObjType from '#/config/ObjType.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import PlayerModel from '#/dash3d/PlayerModel.js';
import Pix3D from '#/dash3d/Pix3D.js';
import TextureCache from '#/dash3d/TextureCache.js';
import { fromJsString } from '#/datastruct/JagString.js';
import Pix2D from '#/graphics/Pix2D.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import InterfaceView from '#/ui/InterfaceView.js';
import Minimenu from '#/ui/Minimenu.js';
import WrappedException from '#/util/WrappedException.js';
import { localAssets } from '../cachefile.js';
import { loginFixture } from '../login-fixture.js';
import { readReferenceFrames } from '../reference-frames.js';
import { cachePath, gamepackPath } from '../reference.js';

type Row = [source: number, flags: number, layout: number, fault: number, pitch: number];
function cases(): Row[] {
    const rows: Row[] = [
        [0, 1, 0, 0, 256],
        [0, 3, 0, 0, 256]
    ];
    for (let source = 0; source <= 14; source++) for (const flags of [0, 1, 3, 5]) for (const layout of [0, 1, 4]) rows.push([source, flags, layout, 0, 256]);
    for (const source of [0, 1, 2, 3, 6, 8, 9, 10, 11, 12, 13, 14]) for (let fault = 1; fault <= 7; fault++) rows.push([source, 3, 1, fault, 256]);
    for (const source of [0, 3, 7, 8, 9]) rows.push([source, 3, 1, 8, 256]);
    for (let source = 0; source <= 14; source++) for (const fault of [9, 10]) rows.push([source, 3, 1, fault, 256]);
    for (const pitch of [-1, 0, 1, 512, 2047, 2048]) for (const layout of [2, 3, 5]) for (const flags of [0, 1, 3]) rows.push([0, flags, layout, 0, pitch]);
    return rows;
}

function draw([source, flags, layout, fault, pitch]: Row, viewer: ClientPlayer, appearance: PlayerModel, sin: Int32Array | null, cos: Int32Array | null): { state: string; pixels: Int32Array } {
    const c = new IfType();
    Object.assign(c, {
        id: 4,
        parentId: -1,
        type: 6,
        if3: !!(flags & 1),
        modelOrtho: !!(flags & 2),
        width: 120,
        height: 124,
        x: 50,
        y: 40,
        modelType: 1,
        modelId: 0,
        activeModelType: 1,
        activeModel: 1100,
        comparisonOps: Int32Array.of(0),
        comparisonValues: Int32Array.of(flags & 4 ? 1 : 0),
        scripts: [Int32Array.of(20, 1, 0)],
        modelYAngle: 384,
        modelZAngle: 44,
        modelXAngle: pitch,
        modelZoom: 380,
        modelOriginX: 8,
        modelOriginY: 6,
        modelOffsetY: 16,
        modelOffsetX: 0
    });
    if (layout === 1) Object.assign(c, { modelWidth: 55, modelHeight: 92, modelOriginX: -15, modelOriginY: 7, modelOffsetX: -13 });
    if (layout === 2) Object.assign(c, { modelWidth: 1, modelHeight: -2, modelOriginX: -2147483648, modelOriginY: 2147483647, modelZoom: -256 });
    if (layout === 3) c.modelZoom = 0;
    if (layout === 4) Object.assign(c, { modelAnim: 808, activeAnim: 819, modelFrame: 0, modelNext: 1, modelCycle: 2 });
    if (layout === 5) Object.assign(c, { width: 13, height: 18, modelZoom: 2147483647 });
    Client.localPlayer = fault === 1 ? null : viewer;
    Client.designAppearanceInstance = fault === 8 ? null : appearance;
    Client.localPid = 17;
    Client.players[2047] = Client.players[73] = null;
    if (source === 1) c.modelId = -1;
    if (source === 2) c.modelId = 900000;
    if (source === 3) Object.assign(c, { itemId: 995, itemCount: 1000 });
    if (source === 4) Object.assign(c, { itemId: 4151, itemCount: 1 });
    if (source === 5) Object.assign(c, { modelType: 4, modelId: 995 });
    if (source === 6) c.modelType = c.activeModelType = 0;
    if (source === 7) c.modelType = 3;
    if (source >= 8 && source <= 13) {
        c.modelType = 5;
        if (source === 8) c.modelId = -1;
        else {
            const who = new ClientPlayer();
            who.username = fromJsString('Rune');
            who.appearance = appearance;
            const slot = source === 9 ? 17 : 73;
            c.modelId = (Number(BigInt.asIntN(32, who.username.toBase37())) << 11) | slot;
            if (source === 10) c.modelId ^= 2048;
            if (source === 11) who.appearance = null;
            if (source === 12) who.username = null;
            if (source !== 13) Client.players[slot === 17 ? 2047 : slot] = who;
        }
    }
    if (source === 14) Object.assign(c, { itemId: 40000, itemCount: 1 });
    if (fault === 2) c.comparisonValues = null;
    if (fault === 3) c.modelXAngle = 2048;
    Pix3D.sinTable = fault === 4 ? null : sin;
    Pix3D.cosTable = fault === 5 ? new Int32Array(0) : cos;
    InterfaceList.rootCount = 3;
    Client.loopCycle = 346;
    InterfaceList.cycle = fault === 6 ? 345 : 346;
    InterfaceList.dirty.fill(false);
    InterfaceList.rectRedrawnLastFrame.length = fault === 10 ? 3 : 100;
    InterfaceList.rectRedrawnLastFrame.fill(false);
    if (fault !== 7 && fault !== 9 && fault !== 10) InterfaceList.rectRedrawnLastFrame[3] = true;
    Client.rectDebug = fault === 9 || fault === 10 ? 2 : 0;
    IfType.resourceMissing = source !== 14;
    Minimenu.isOpen = true;
    const pixels = new Int32Array(256 * 256);
    Pix2D.setPixels(pixels, 256, 256);
    Pix2D.setClipping(layout === 0 ? 0 : 33, layout === 0 ? 0 : 17, layout === 0 ? 256 : 222, layout === 0 ? 256 : 236);
    let result = 'ok';
    try {
        new InterfaceView([c]).draw();
    } catch (caught) {
        let error = caught;
        while (error instanceof WrappedException) error = error.cause;
        if (error instanceof TypeError) result = error.message.startsWith('ClassCastException') ? 'cast' : 'null';
        else if (error instanceof RangeError) result = error.message === '/ by zero' ? 'divide' : 'bounds';
        else throw error;
    }
    let hash = 1;
    for (const v of pixels) hash = (Math.imul(31, hash) + v) | 0;
    const state = [result, IfType.resourceMissing, InterfaceList.dirty[3], Pix3D.originX, Pix3D.originY, Pix3D.clipMinX, Pix3D.clipMaxX, Pix3D.clipMinY, Pix3D.clipMaxY, hash].join(' ');
    return { state, pixels };
}

loginFixture(
    import.meta.url,
    'type 6 IF1 and IF3 models match the gamepack framebuffer, source selection and raster origin after faults',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-widget-model-'));
        const framePath = join(dir, 'frames.bin');
        try {
            const compile = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'WidgetModelDrawOracle.java'), join(import.meta.dir, '../render/ProceduralTextureCacheOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const rows = cases();
            expect(rows).toHaveLength(355);
            const java = Bun.spawnSync(['java', '-Xmx256m', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'WidgetModelDrawOracle', cachePath, framePath], {
                stdin: Buffer.from(rows.map(row => row.join(' ')).join('\n') + '\n'),
                maxBuffer: 8 * 1024 * 1024
            });
            expect(java.exitCode, java.stderr.toString()).toBe(0);
            const lines = java.stdout.toString().trimEnd().split(/\r?\n/);
            expect(lines).toHaveLength(rows.length);
            expect(lines[0].split(' ')[9]).toBe('726813378');
            expect(lines[1].split(' ')[9]).toBe('474163005');
            const assets = localAssets(cachePath, [0, 1, 7, 8, 9, 19, 20, 26]);
            ObjType.List(40000).model = 900000;
            Pix3D.textureProvider = new TextureCache(assets.archive(9), assets.archive(26), assets.archive(8), 20, false);
            Pix3D['brightness'] = Math.fround(0.8);
            Pix3D['initColourTable'](0, 512);
            const sin = Pix3D.sinTable,
                cos = Pix3D.cosTable;
            PlayerModel.recolourDestinations = PlayerModel.recolourDestinationsRs;
            PlayerModel.recolourSources = PlayerModel.recolourSourcesRs;
            PlayerModel.recolourDestinations2 = PlayerModel.recolourDestinations2Rs;
            PlayerModel.recolourSources2 = PlayerModel.recolourSources2Rs;
            const appearance = new PlayerModel(),
                equipment = new Int32Array(12);
            equipment[3] = 1073741824 | 4151;
            appearance.setAppearance(false, new Int32Array(5), -1, equipment, -1);
            Client.designAppearanceInstance = appearance;
            const viewer = new ClientPlayer();
            viewer.appearance = appearance;
            for (const { index: i, frame } of readReferenceFrames(framePath, 256, 256, rows.length)) {
                const row = rows[i];
                const [source, flags, layout, fault] = row;
                if (source === 14 && flags === 3 && layout === 1 && (fault === 0 || fault === 6)) {
                    expect(lines[i].split(' ').slice(0, 3)).toEqual(['ok', 'false', String(fault !== 6)]);
                }
                const actual = draw(row, viewer, appearance, sin, cos);
                expect(actual.state, row.join(' ')).toBe(lines[i]);
                expect(() => compareFramebuffers(frame, { ...frame, pixels: actual.pixels }), row.join(' ')).not.toThrow();
            }
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    60000
);
