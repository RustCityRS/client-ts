import { expect } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import ClientMouseListener from '#/client/ClientMouseListener.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import ObjType from '#/config/ObjType.js';
import Pix3D from '#/dash3d/Pix3D.js';
import TextureCache from '#/dash3d/TextureCache.js';
import { fromLiteral } from '#/datastruct/JagString.js';
import { capsProfileFromJson } from '#/gl/CapsProfile.js';
import GlRenderer from '#/gl/GlRenderer.js';
import GlRaster from '#/gl/GlRaster.js';
import GlSprite from '#/gl/GlSprite.js';
import { GlTraceWriter } from '#/gl/GlTrace.js';
import NullGL from '#/gl/NullGL.js';
import RecordingGL from '#/gl/RecordingGL.js';
import Pix2D from '#/graphics/Pix2D.js';
import Pix32 from '#/graphics/Pix32.js';
import SoftwareFont from '#/graphics/SoftwareFont.js';
import SpriteLoader from '#/graphics/SpriteLoader.js';
import AreaSoundManager from '#/sound/AreaSoundManager.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import Minimenu from '#/ui/Minimenu.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { mathRandom } from '#/util/JavaRandom.js';
import { localAssets } from '../cachefile.js';
import { loginFixture } from '../login-fixture.js';
import { cachePath } from '../reference.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';
import { diffTraces } from './glTraceDiff.js';

// The drag branch fetches the scroll parent from components[1] immediately before taking the clip.
function drawDraggedSlot(grid: IfType, parent: IfType): string {
    const fields: [object, string, string][] = [
        [GlRenderer, 'active', 'tf.w'],
        [GlRaster, 'clipMinY', 'dj.b'],
        [GlRaster, 'clipMaxY', 'dj.e'],
        [Pix2D, 'clipMinY', 'kb.d'],
        [Pix2D, 'clipMaxY', 'kb.h'],
        [parent, 'scrollY', 'be.hb'],
        [parent, 'height', 'be.R'],
        [parent, 'scrollHeight', 'be.bc'],
        [AreaSoundManager, 'elapsed', 'od.i'],
        [Minimenu, 'objGrabY', 'qk.f']
    ];
    const accesses: string[] = [];
    let recording = false,
        began = false;
    const layer = new Proxy([grid, parent], {
        get(target, key, receiver) {
            if (key === '1' && !began) recording = began = true;
            return Reflect.get(target, key, receiver);
        }
    });
    const restore = fields.map(([owner, key, field]) => {
        const descriptor = requireNonNull(Object.getOwnPropertyDescriptor(owner, key));
        let value = descriptor.value;
        Object.defineProperty(owner, key, {
            configurable: true,
            get() {
                if (recording) accesses.push('load ' + field);
                return value;
            },
            set(next) {
                if (recording) accesses.push('store ' + field);
                if (field === 'qk.f') recording = false;
                value = next;
            }
        });
        return () => Object.defineProperty(owner, key, { ...descriptor, value });
    });
    try {
        Client.DrawLayer(2, layer, 1, 110, 40, 0, 191, 3, 0);
        return accesses.join(',');
    } finally {
        for (const reset of restore) reset();
    }
}

loginFixture(
    import.meta.url,
    'inventory widget 149:0 renders the original model icons on cold, cached and selected frames',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-inventory-widgets-'));
        try {
            const assets = localAssets(cachePath, [3, 7, 8, 9, 13, 19, 26]);
            const sprites = assets.archive(8);
            const fontId = sprites.GetGroupId(fromLiteral('p11_full'));
            const profile = join(import.meta.dir, 'rtx5070.json');
            const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
            const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
            const compile = Bun.spawnSync(['javac', asm, '-cp', cp, '-d', dir, ...['GlRecorder', 'HdTitleFrameOracle', 'HdInventoryIconsOracle'].map(name => join(import.meta.dir, name + '.java'))]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const patch = Bun.spawnSync(['java', asm, '-cp', cp, 'HdInventoryIconsOracle', 'instrument', dir]);
            expect(patch.exitCode, patch.stderr.toString()).toBe(0);
            const run = Bun.spawnSync(['java', asm, '--add-opens=java.base/java.lang=ALL-UNNAMED', '-Djava.awt.headless=true', '-Dgltrace.stacks=false', '-cp', cp, 'HdInventoryIconsOracle', cachePath, dir, profile, String(fontId)]);
            expect(run.exitCode, run.stderr.toString()).toBe(0);
            const font = SpriteLoader.loadFont(sprites, fontId, 0, assets.archive(13));
            if (!(font instanceof SoftwareFont)) throw new Error('Missing p11_full');
            ObjType.Init(assets.archive(19), true, font, assets.archive(7));
            Pix3D.textureProvider = new TextureCache(assets.archive(9), assets.archive(26), sprites, 20, false);
            mathRandom.setSeed(530n);
            Pix3D.setBrightness(Math.fround(0.7));
            const writer = new GlTraceWriter();
            GlRenderer.gl = new RecordingGL(new NullGL(capsProfileFromJson(readFileSync(profile, 'utf8'))), writer);
            GlRenderer.width = 191;
            GlRenderer.height = 270;
            Client.localPlayer = new ClientPlayer();
            InterfaceList.rectRedrawnLastFrame[0] = true;
            const grid = IfType.decode(149 << 16, requireNonNull(assets.archive(3).GetFile(0, 149)));
            grid.width = 190;
            grid.height = 268;
            const items = [1351, 590, 995, 4151, 4152, 13444, 303];
            for (let i = 0; i < items.length; i++) {
                requireNonNull(grid.itemIds)[i] = items[i] + 1;
                requireNonNull(grid.itemCounts)[i] = i === 2 ? 101 : 1;
            }
            const rows: string[] = [];
            for (const active of [false, true]) {
                GlRenderer.active = active;
                ObjType.ResetSpriteCache();
                grid.parentId = -1;
                Minimenu.objDragComponent = null;
                for (let frame = 0; frame < 3; frame++) {
                    writer.mark('inventory.' + active + '.' + frame);
                    const target = new Int32Array(191 * 270).fill(0x345678);
                    Pix2D.setPixels(target, 191, 270);
                    Minimenu.objSelected = frame === 2 ? 1 : 0;
                    Minimenu.objComponent = grid.id;
                    Minimenu.objSlot = 0;
                    Minimenu.highlightComponent = frame === 2 ? grid : null;
                    Minimenu.highlightSlot = 1;
                    Client.DrawLayer(2, [grid], -1, 270, 0, 0, 191, 3, 0);
                    const first = ObjType.GetSprite(items[0], frame === 2 ? 2 : 1, grid.showItemCount, 1, frame === 2 ? 0 : 0x302020);
                    const type = first instanceof GlSprite ? 'cf' : first instanceof Pix32 ? 'mm' : 'missing';
                    const pixels = target.reduce((hash, pixel) => (Math.imul(hash, 31) + pixel) | 0, 1);
                    rows.push([active, frame, type, pixels].join(' '));
                }
                writer.mark('inventory.' + active + '.drag');
                grid.parentId = 1;
                Minimenu.objDragComponent = grid;
                Minimenu.objDragSlot = 0;
                Minimenu.objDragCycles = 5;
                for (const y of [150, -150, 83, -1]) {
                    Minimenu.objGrabY = 0;
                    ClientMouseListener.mouseY = y;
                    AreaSoundManager.elapsed = 3;
                    const parent = Object.assign(new IfType(), { parentId: -77, scrollY: 30, height: 30, scrollHeight: 200 });
                    Pix2D.setPixels(new Int32Array(191 * 270), 191, 270);
                    const accesses = drawDraggedSlot(grid, parent);
                    rows.push(['drag', active, y, parent.scrollY, Minimenu.objGrabY, accesses].join(' '));
                }
            }
            expect(rows).toEqual(run.stdout.toString().trimEnd().split(/\r?\n/));
            expect(rows.some(row => row.startsWith('drag true 150 60 -30 load tf.w,load dj.e,load dj.b'))).toBe(true);
            const java = readFileSync(join(dir, 'trace.tsv'), 'utf8');
            const result = diffTraces(java, writer.text(), { includeDeletions: true });
            expect(result.equal, result.report).toBe(true);
            // A changed selection needs an additional outlined icon. Every visible slot is still submitted on warm frames.
            const cold = java.split('~mark\tinventory.true.0')[1].split('~mark\tinventory.true.1')[0];
            const warm = java.split('~mark\tinventory.true.1')[1].split('~mark\tinventory.true.2')[0];
            expect(cold.match(/\tglTexImage2D\t/g)).toHaveLength(items.length);
            expect(warm).not.toContain('glTexImage2D');
            expect(warm.match(/\tglCallList\t/g)).toHaveLength(items.length);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    60000,
    'gl'
);
