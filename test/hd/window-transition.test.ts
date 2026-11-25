import { expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cachePath } from '../reference.js';
import { localAssets } from '../cachefile.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

async function compare(): Promise<void> {
    const { default: GameShell, gameClient } = await import('#/client/GameShell.js');
    const { default: Client } = await import('#/client/Client.js');
    const { default: GlRenderer } = await import('#/gl/GlRenderer.js');
    const { default: ModelLitImpl } = await import('#/dash3d/ModelLitImpl.js');
    const { default: Pix3D } = await import('#/dash3d/Pix3D.js');
    const { default: TextureCache } = await import('#/dash3d/TextureCache.js');
    const { default: Preferences } = await import('#/ui/Preferences.js');
    const { default: LocType } = await import('#/config/LocType.js');
    const { default: Signlink } = await import('#/util/Signlink.js');
    const { JavaError } = await import('#/util/JavaException.js');
    const { default: WrappedException } = await import('#/util/WrappedException.js');
    const { CanvasComponent } = await import('#/graphics/PixScreen.js');
    const { default: InterfaceList } = await import('#/ui/InterfaceList.js');
    const { registerGLDrawableFactory } = await import('#/jogl/GLDrawableFactory.js');
    const { NullGLDrawableFactory } = await import('#/gl/NullGL.js');
    const { capsProfileFromJson } = await import('#/gl/CapsProfile.js');
    const dir = mkdtempSync(join(tmpdir(), 'rs530-mode-transitions-'));
    const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
    const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
    const profile = join(import.meta.dir, 'rtx5070.json');
    const assets = localAssets(cachePath, [8, 13]);
    const fontId = assets.groupId(8, 'p12_full');
    const glyphs = assets.file(8, fontId),
        metrics = assets.file(13, fontId);
    if (!glyphs || !metrics) throw new Error('Missing cached p12_full');
    const { default: spriteLoader } = await import('#/graphics/SpriteLoader.js');
    const { default: title } = await import('#/title/TitleScreen.js');
    const { default: text } = await import('#/ui/LocalisedText.js');
    let surfaceHash = '-';
    let framebuffer = Buffer.alloc(0);
    const software = new CanvasComponent({
        createImageData: (width, height) => ({ width, height, colorSpace: 'srgb', data: new Uint8ClampedArray(width * height * 4) }),
        putImageData(image) {
            let hash = 1;
            framebuffer = Buffer.alloc((image.data.length >>> 2) * 3);
            let offset = 0;
            for (let i = 0; i < image.data.length; i += 4) {
                framebuffer[offset++] = image.data[i];
                framebuffer[offset++] = image.data[i + 1];
                framebuffer[offset++] = image.data[i + 2];
                const rgb = (image.data[i] << 16) | (image.data[i + 1] << 8) | image.data[i + 2];
                hash = (Math.imul(hash, 31) + rgb) | 0;
            }
            surfaceHash = String(hash);
        }
    });
    try {
        const javac = Bun.spawnSync(['javac', asm, '-encoding', 'UTF-8', '-cp', cp, '-d', dir, ...['GlRecorder', 'WindowLayoutOracle', 'HdModeSwitchOracle'].map(n => join(import.meta.dir, n + '.java'))]);
        expect(javac.exitCode, javac.stderr.toString()).toBe(0);
        const java = ['java', asm, '-Djava.awt.headless=true', '-cp', cp, 'HdModeSwitchOracle'];
        const instrument = Bun.spawnSync([...java, 'instrument', dir]);
        expect(instrument.exitCode, instrument.stderr.toString()).toBe(0);
        writeFileSync(join(dir, 'p12-glyphs'), glyphs);
        writeFileSync(join(dir, 'p12-metrics'), metrics);
        const bold = assets.groupId(8, 'b12_full'),
            background = assets.groupId(8, 'titlebg'),
            logo = assets.groupId(8, 'logo');
        for (const [name, archive, id] of [
            ['b12-glyphs', 8, bold],
            ['b12-metrics', 13, bold],
            ['titlebg', 8, background],
            ['logo', 8, logo]
        ] as const) {
            const bytes = assets.file(archive, id);
            if (!bytes) throw new Error('Missing cached ' + name);
            writeFileSync(join(dir, name), bytes);
        }
        const original = Bun.spawnSync([...java, join(dir, 'trace'), profile, dir], { timeout: 30000 });
        expect(original.exitCode, original.stderr.toString()).toBe(0);
        const reference = original.stdout.toString().trimEnd().split(/\r?\n/);
        expect(reference).toHaveLength(17);
        const native = Bun.file(join(dir, 'trace', 'trace.tsv'));
        const lines = (await native.text()).split(/\r?\n/);
        expect(lines.some(line => line.includes('getGLDrawable') && line.includes(':T:4\t'))).toBe(true);
        registerGLDrawableFactory(() => new NullGLDrawableFactory(capsProfileFromJson(readFileSync(profile, 'utf8'))));
        spriteLoader.decode(glyphs);
        Client.p12 = spriteLoader.createFont(metrics);
        const sprites = assets.archive(8);
        Client.fontBold12 = spriteLoader.loadFont(sprites, bold, 0, assets.archive(13));
        title.m_titleBack = spriteLoader.loadSprite3(background, sprites);
        title.m_logo = spriteLoader.loadIndexedSprite2(logo, sprites);
        title.m_loadString = text.starting3dLibrary;
        title.m_loadPos = 97;
        const apply = GameShell.applyWindowMode;
        const brighten = Pix3D.setBrightness;
        const reload = new JavaError('reload');
        const fallback = new JavaError('fallback0');
        for (const expected of reference) {
            const scenario = expected.split('|')[0];
            const ready = scenario !== 'undisplayable';
            Client.gameState = scenario === 'coldTitle' ? 5 : 0;
            const canvas = {
                width: 0,
                height: 0,
                x: 0,
                y: 0,
                ignoreRepaint: false,
                isDisplayable: () => ready,
                getSize() {
                    return { width: this.width, height: this.height };
                },
                setIgnoreRepaint(value: boolean) {
                    this.ignoreRepaint = value;
                }
            };
            GlRenderer.shutdown();
            GlRenderer.width = 43;
            GlRenderer.height = 47;
            GlRenderer.active = scenario === 'fixed' || scenario === 'resizable' || scenario.startsWith('return');
            GameShell.canvas = canvas;
            GameShell.frame = null;
            GameShell.fullScreenFrame = null;
            GameShell.signlink = Object.assign(Object.create(Signlink.prototype), {
                applet: { getSize: () => ({ width: 871, height: 613 }) },
                loadGlLibrary(type: object) {
                    expect(type).toBe(Client);
                    return { status: scenario === 'coldUnavailable' ? 2 : 1 };
                }
            });
            const thread = { priority: 3 };
            GameShell.gameThread = scenario === 'missingThread' ? null : Object.assign(Object.create(null), thread);
            GameShell.resizable = false;
            GameShell.glLibraryLoaded = !scenario.startsWith('cold');
            surfaceHash = '-';
            GameShell.fullRedraw = false;
            LocType.m_lowMem = true;
            Preferences.allLevelsVisible = false;
            InterfaceList.top = -1;
            InterfaceList.dirty.fill(false);
            Client.stream = null;
            Preferences.currentAntiAliasingMode = scenario === 'createAA' ? 2 : 0;
            Preferences.highDetailLighting = scenario !== 'returnUnlit';
            Preferences.brightness = /^return[1-4]$/.test(scenario) ? Number(scenario.slice(-1)) : 3;
            const cache = Object.assign(Object.create(TextureCache.prototype), { capacity: 0, recentUse: null, secondaryCache: null });
            Pix3D.textureProvider = scenario === 'missingTextures' ? null : cache;
            ModelLitImpl.allocateSoftwareScratch();
            let brightness = '-';
            Pix3D.setBrightness = value => {
                const bits = new DataView(new ArrayBuffer(4));
                bits.setFloat32(0, value);
                brightness = bits.getUint32(0).toString(16);
                brighten.call(Pix3D, value);
            };
            gameClient.instance = Object.assign(Object.create(Client.prototype), {
                setCanvasSize(w: number, h: number) {
                    canvas.width = w;
                    canvas.height = h;
                },
                setCanvasLocation(x: number, y: number) {
                    canvas.x = x;
                    canvas.y = y;
                },
                getGlCanvas(current: object | null) {
                    expect(current).toBe(canvas);
                    return canvas;
                },
                getSoftwareCanvasComponent(current: object | null) {
                    expect(current).toBe(canvas);
                    return software;
                },
                releaseGlCanvas() {},
                reloadWindowResources() {
                    throw reload;
                }
            });
            let mode = scenario === 'soft' || scenario.startsWith('return') ? 0 : scenario === 'resizable' ? 2 : 1;
            const rebuild = !['soft', 'fixed', 'resizable'].includes(scenario);
            const previous = scenario.startsWith('return') || ['fixed', 'resizable'].includes(scenario) ? 1 : 0;
            if (scenario === 'nullFullscreenLink') {
                GameShell.signlink = null;
                mode = 3;
            }
            let calls = 0;
            GameShell.applyWindowMode = (...args) => {
                if (++calls > 1) {
                    expect(args).toEqual([0, -1, previous, true, true, -1]);
                    throw fallback;
                }
                return apply.call(GameShell, ...args);
            };
            let result = 'ok';
            try {
                await GameShell.applyWindowMode(mode, 123, previous, rebuild, false, 456);
            } catch (error) {
                if (error === reload) result = 'reload';
                else if (error === fallback) result = 'fallback0';
                else if (error instanceof WrappedException && error.cause instanceof TypeError) result = 'NullPointerException ' + error.context;
                else throw error;
            }
            if (scenario.startsWith('cold')) {
                const nativeFrame = readFileSync(join(dir, scenario + '.rgb'));
                expect(nativeFrame.length).toBe(765 * 503 * 3);
                expect(framebuffer.equals(nativeFrame)).toBe(true);
            }
            const shape = [GlRenderer.active, GlRenderer.width, GlRenderer.height, LocType.m_lowMem, GameShell.resizable, InterfaceList.dirty.filter(Boolean).length, GameShell.fullRedraw];
            const model = [GameShell.gameThread?.priority ?? thread.priority, Reflect.get(ModelLitImpl, 'useQuickSort'), cache.capacity, cache.recentUse !== null, cache.secondaryCache !== null, brightness];
            const screen = [canvas.width, canvas.height, canvas.x, canvas.y, canvas.ignoreRepaint];
            expect([scenario, result, shape.join(','), model.join(','), screen.join(','), [GameShell.glLibraryLoaded, surfaceHash].join(',')].join('|')).toBe(expected);
        }
    } finally {
        GlRenderer.shutdown();
        registerGLDrawableFactory(null);
        rmSync(dir, { recursive: true, force: true });
    }
}

test('HD window context transitions follow pm.a through the native resource rebuild and fallback boundaries', async () => {
    if (process.env.RS530_WINDOW_TRANSITION_CHILD === '1') return compare();
    const child = Bun.spawnSync([process.execPath, 'test', fileURLToPath(import.meta.url)], {
        env: { ...process.env, RS530_WINDOW_TRANSITION_CHILD: '1', RS530_GAMEPACK_IDENTITY: 'gl' },
        timeout: 90000
    });
    expect(child.exitCode, child.stderr.toString()).toBe(0);
    expect(child.stderr.toString()).toMatch(/^\s*1 pass$/m);
}, 120000);
