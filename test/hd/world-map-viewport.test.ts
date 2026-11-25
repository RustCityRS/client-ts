import { expect } from 'bun:test';
import { captureSdFrame } from '#/dash3d/SdWorldRaster.js';
import { renderSdFrames } from '../render/sd-device.js';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import GameShell from '#/client/GameShell.js';
import { fromJsString } from '#/datastruct/JagString.js';
import { capsProfileFromJson } from '#/gl/CapsProfile.js';
import GlRenderer from '#/gl/GlRenderer.js';
import { GlTraceWriter } from '#/gl/GlTrace.js';
import NullGL from '#/gl/NullGL.js';
import RecordingGL from '#/gl/RecordingGL.js';
import Pix2D from '#/graphics/Pix2D.js';
import Pix32 from '#/graphics/Pix32.js';
import WorldMapFont from '#/graphics/WorldMapFont.js';
import { mapFontSurface } from '#/graphics/WorldMapFontSurface.js';
import MapArea from '#/ui/MapArea.js';
import WorldMap from '#/ui/WorldMap.js';
import WorldMapLabels from '#/ui/WorldMapLabels.js';
import WrappedException from '#/util/WrappedException.js';
import { localAssets } from '../cachefile.js';
import { loginFixture } from '../login-fixture.js';
import { cachePath } from '../reference.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';
import { diffTraces } from './glTraceDiff.js';

function populate() {
    const under = new Int32Array(4096),
        lower = new Int8Array(4096),
        upper = new Int8Array(4096);
    const lowerShape = new Int8Array(4096),
        upperShape = new Int8Array(4096),
        walls = new Int8Array(4096);
    for (let i = 0; i < 4096; i++) {
        under[i] = 1 + ((0x396941 + i * 0x10507) & 0xffffff);
        if (i % 5 === 1) {
            lower[i] = 1;
            lowerShape[i] = 4 + (i % 38);
        }
        if (i % 11 === 5) {
            upper[i] = 2;
            upperShape[i] = 4 + (i % 19);
        }
        if (i % 19 === 11) walls[i] = 1 + (i % 28);
    }
    const labels = new WorldMapLabels(1);
    labels.text[0] = fromJsString('Town');
    labels.x[0] = 32;
    labels.z[0] = 31;
    labels.colors[0] = 0xaced13;
    labels.flags[0] = 8;
    Object.assign(WorldMap, {
        progress: 100,
        width: 64,
        height: 64,
        zoom: 4,
        centerX: 32,
        centerZ: 32,
        current: new MapArea(null, null, 0, 0, 0x533644, true, 50),
        underlayColors: [[under]],
        overlayIds: [[lower]],
        overlayShapes: [[lowerShape]],
        upperOverlayIds: [[upper]],
        upperOverlayShapes: [[upperShape]],
        wallTypes: [[walls]],
        mapScenes: [[null]],
        locIds: [[null]],
        overlayColors: Int32Array.of(0, 0xc48516, 0x1961af),
        labels,
        font12: new WorldMapFont(12, true, GameShell.canvas),
        flashTicks: 1,
        flashCount: 3
    });
}
function hash(data: Int32Array | null): number {
    return data === null ? 0 : data.reduce((h, v) => (Math.imul(h, 31) + v) | 0, 1);
}

loginFixture(
    import.meta.url,
    'HD world-map viewport and overview preserve JAR pixels, clip, buffer identity and release',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-map-viewport-'));
        const script = [
            'loading 3 5 101 77',
            'open 0 0 0 0',
            'main 3 9 67 43',
            'main 8 2 67 43',
            'pan 8 2 67 43',
            'overview 4 7 29 27',
            'overview 7 2 29 27',
            'overview 0 3 31 27',
            'overview-switch 4 7 29 27',
            'active 0 0 0 0',
            'main 5 7 69 43',
            'main 2 9 69 47',
            'fault 2 9 63 47',
            'close 0 0 0 0',
            'open 0 0 0 0',
            'main -3 -7 67 43',
            'software 7 3 73 41',
            'software-gpu 2 5 79 49',
            'active 0 0 0 0',
            'main 2 3 67 43',
            'empty 2 3 0 47',
            'empty 2 3 47 0',
            'negative 2 3 -9 47',
            'missing-icons 2 3 67 43',
            'missing-ground 2 3 67 43',
            'close 0 0 0 0'
        ];
        try {
            const scriptFile = join(dir, 'rows.txt'),
                out = join(dir, 'java');
            const cp = [dir, hdGamepackPath, joglPath].join(delimiter),
                profile = join(import.meta.dir, 'rtx5070.json');
            writeFileSync(scriptFile, script.join('\n'));
            const javac = Bun.spawnSync(['javac', '-cp', cp, '-d', dir, ...['HdWorldMapViewportOracle', 'HdTitleFrameOracle', 'GlRecorder'].map(f => join(import.meta.dir, f + '.java'))]);
            expect(javac.exitCode, javac.stderr.toString()).toBe(0);
            const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-Dgltrace.stacks=false', '-Dgltrace.caps=' + profile, '-cp', cp, 'HdWorldMapViewportOracle', cachePath, out, scriptFile], { timeout: 20000 });
            expect(java.exitCode, java.stderr.toString()).toBe(0);
            const expected = java.stdout.toString().trimEnd().split(/\r?\n/);
            const writer = new GlTraceWriter();
            GlRenderer.gl = new RecordingGL(new NullGL(capsProfileFromJson(readFileSync(profile, 'utf8'))), writer);
            GlRenderer.active = true;
            GlRenderer.width = 180;
            GlRenderer.height = 112;
            GameShell.canvas = mapFontSurface;
            const assets = localAssets(cachePath, [8, 13]),
                sprites = assets.archive(8);
            Client.lookupSpriteGroupIds(sprites);
            Client.loadFonts(sprites, assets.archive(13));
            const screen = new Int32Array(180 * 112);
            Pix2D.setPixels(screen, 180, 112);
            const ids = new Map<object, number>();
            function id(value: object | null) {
                if (value === null) return 0;
                if (!ids.has(value)) ids.set(value, ids.size + 1);
                return ids.get(value);
            }
            for (const [i, line] of script.entries()) {
                writer.mark(line.replaceAll(' ', '_'));
                const [action, ...args] = line.split(' '),
                    [x, y, w, h] = args.map(Number);
                const fails = ['fault', 'empty', 'negative', 'missing-icons', 'missing-ground'].includes(action);
                expect(expected[i].startsWith(line + '|ok|'), expected[i]).toBe(!fails);
                let result = 'ok';
                try {
                    switch (action) {
                        case 'loading':
                            WorldMap.current = null;
                            WorldMap.progress = 40;
                            WorldMap.draw(y, 2, x, h, w);
                            break;
                        case 'open':
                            populate();
                            break;
                        case 'main':
                            WorldMap.draw(y, 2, x, h, w);
                            break;
                        case 'pan':
                            WorldMap.centerX += 2;
                            WorldMap.centerZ--;
                            WorldMap.draw(y, 2, x, h, w);
                            break;
                        case 'overview':
                            WorldMap.drawOverview(x, y, h, w);
                            break;
                        case 'overview-switch': {
                            Pix2D.setPixels(screen, 180, 112);
                            const sprite = (WorldMap.overview = new Pix32(w, h));
                            sprite.drawOpaque = () => {
                                GlRenderer.active = false;
                            };
                            WorldMap.drawOverview(x, y, h, w);
                            break;
                        }
                        case 'fault':
                            WorldMap.labels = null;
                            WorldMap.draw(y, 2, x, h, w);
                            break;
                        case 'empty':
                        case 'negative':
                            WorldMap.draw(y, 2, x, h, w);
                            break;
                        case 'missing-icons':
                            WorldMap.locIds = null;
                            WorldMap.draw(y, 2, x, h, w);
                            break;
                        case 'missing-ground':
                            WorldMap.underlayColors = null;
                            WorldMap.draw(y, 2, x, h, w);
                            break;
                        case 'close':
                            WorldMap.Reset(false);
                            break;
                        case 'software':
                            GlRenderer.active = false;
                            Pix2D.setPixels(screen, 180, 112);
                            WorldMap.draw(y, 2, x, h, w);
                            break;
                        case 'software-gpu': {
                            GlRenderer.active = false;
                            Pix2D.setPixels(screen, 180, 112);
                            const frame = captureSdFrame(() => WorldMap.draw(y, 2, x, h, w));
                            const [pixels] = await renderSdFrames(dir, [frame]);
                            screen.set(pixels);
                            break;
                        }
                        case 'active':
                            GlRenderer.active = true;
                            break;
                    }
                } catch (error) {
                    if (!(error instanceof WrappedException)) throw error;
                    const cause = error.cause;
                    result = error.context + '|' + (cause instanceof TypeError ? 'NullPointerException' : cause instanceof RangeError ? (cause.message === '/ by zero' ? 'ArithmeticException' : 'NegativeArraySizeException') : String(cause));
                }
                const sprite = WorldMap.viewportImage,
                    overview = WorldMap.overview;
                const row =
                    line +
                    '|' +
                    result +
                    '|' +
                    [id(sprite), id(overview), id(Pix2D.pixels)].join(',') +
                    '|' +
                    (sprite ? [sprite.width, sprite.height, hash(sprite.pixels)].join(',') : '-') +
                    '|' +
                    (overview instanceof Pix32 ? 'SwitchingOverview' : overview ? 'cf' : '-') +
                    '|' +
                    hash(screen) +
                    '|' +
                    [WorldMap.displayHeight, WorldMap.viewMinX, WorldMap.viewTop, WorldMap.displayWidth, WorldMap.flashTicks, WorldMap.flashCount].join(',');
                expect(row, line).toBe(expected[i]);
            }
            const diff = diffTraces(readFileSync(join(out, 'trace.tsv'), 'utf8'), writer.text(), { includeDeletions: true });
            expect(diff.equal, diff.report).toBe(true);
            WorldMap.viewportImage = new Pix32(1, 1);
            new Client()['releaseStatics']();
            expect(expected[script.length]).toBe('shutdown|true');
            expect(WorldMap.viewportImage).toBeNull();
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    45000,
    'gl'
);
