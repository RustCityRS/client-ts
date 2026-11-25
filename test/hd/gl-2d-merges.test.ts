import { expect } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import type Js5 from '#/cache/Js5.js';
import Client from '#/client/Client.js';
import ClientBuild from '#/client/ClientBuild.js';
import GameShell from '#/client/GameShell.js';
import OrbitCamera from '#/client/OrbitCamera.js';
import ReceivePlayerPositions from '#/client/ReceivePlayerPositions.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import MinimapBuilder from '#/dash3d/MinimapBuilder.js';
import Texture from '#/dash3d/Texture.js';
import world from '#/dash3d/world.js';
import { fromLiteral } from '#/datastruct/JagString.js';
import { capsProfileFromJson } from '#/gl/CapsProfile.js';
import GlAlphaSprite from '#/gl/GlAlphaSprite.js';
import GlFont from '#/gl/GlFont.js';
import GlIndexedSprite from '#/gl/GlIndexedSprite.js';
import GlRenderer from '#/gl/GlRenderer.js';
import GlSprite from '#/gl/GlSprite.js';
import { GlTraceWriter } from '#/gl/GlTrace.js';
import NullGL from '#/gl/NullGL.js';
import RecordingGL from '#/gl/RecordingGL.js';
import type AbstractIndexedSprite from '#/graphics/AbstractIndexedSprite.js';
import type AbstractSprite from '#/graphics/AbstractSprite.js';
import Pix2D from '#/graphics/Pix2D.js';
import Pix32 from '#/graphics/Pix32.js';
import Pix8 from '#/graphics/Pix8.js';
import type PixfontGeneric from '#/graphics/PixfontGeneric.js';
import SoftwareAlphaSprite from '#/graphics/SoftwareAlphaSprite.js';
import SoftwareFont from '#/graphics/SoftwareFont.js';
import SpriteLoader from '#/graphics/SpriteLoader.js';
import TitleScreen from '#/title/TitleScreen.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import LocalisedText from '#/ui/LocalisedText.js';
import WorldMapLabels from '#/ui/WorldMapLabels.js';
import { arrayAtObj, arrayPutObj, requireNonNull } from '#/util/JavaArray.js';
import { mathRandom } from '#/util/JavaRandom.js';
import WrappedException from '#/util/WrappedException.js';
import { localAssets } from '../cachefile.js';
import { loginFixture } from '../login-fixture.js';
import { cachePath } from '../reference.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';
import { diffTraces } from './glTraceDiff.js';

// HD batch H2 (HD_PLAN.md section 4), unit merges: the tf.w arms merged into the shared 2D methods, against the
// unmodified runescape_gl.jar driven by HdMergesOracle.java through GlRecorder (TS: RecordingGL over NullGL, both on
// the rtx5070 profile). Each script command prints the kinds (cf/el/mm/am/oh/ek/mb/dd) and geometry of the objects it
// builds and the state it leaves; the state lines must match and the GL traces must match record for record
// (deletions excluded; every object built stays referenced on both sides).
//
//   SpriteLoader: createSprites (SD p.a / HD re.b), createSoftwareSprites (oc.a / cj.a), createSprite (ud.a / gi.b),
//                 toIndexedSprites (qd.b / ui.h), createIndexedSprite (rk.b / wh.b), createFont (tf.a / ce.a via k.a),
//                 each with tf.w set and clear, over cache groups with and without alpha frames.
//   IfType:       GetGraphic (SD aj.c / HD be.a(BZ)): GL and software wrapping, alpha, flips, outlines, shadow, the
//                 cache hit and a missing sprite.
//   TitleScreen:  Open (ef.a / oi.a) and Draw (mk.a / oj.a) with tf.w set.
//   Minimap:      BuildBuffer (ph.a / kl.b) with the ground, typecode and detail callees stubbed on both sides (the
//                 Java side through an ASM redirect in kl.b), seeded so the wall colour channels (which the two
//                 gamepacks draw in different orders) are compared; a failing detail draw and the resumed build;
//                 Draw (fd.a / ed.a) and CompassDraw (ke.a / mj.a) in every map state with and without a mask graphic.

const profilePath = join(import.meta.dir, 'rtx5070.json');

interface Groups {
    single: number[];
    singleAlpha: number[];
    multi: number[];
    multiAlpha: number[];
}

function scanGroups(archive: Js5): Groups {
    const groups: Groups = { single: [], singleAlpha: [], multi: [], multiAlpha: [] };
    const limit = archive.GetGroupIdLimit();
    for (let group = 0; group < limit; group++) {
        if (!SpriteLoader.loadGroup(archive, group)) continue;
        const alpha = (SpriteLoader.hasAlpha ?? []).some(a => a);
        const list = SpriteLoader.count === 1 ? (alpha ? groups.singleAlpha : groups.single) : alpha ? groups.multiAlpha : groups.multi;
        if (list.length < 3) list.push(group);
        SpriteLoader.clear();
        if (groups.single.length >= 3 && groups.singleAlpha.length >= 3 && groups.multi.length >= 3 && groups.multiAlpha.length >= 3) break;
    }
    return groups;
}

function script(archive: Js5, groups: Groups): string[] {
    const id = (name: string): number => {
        const group = archive.GetGroupId(fromLiteral(name));
        if (group < 0) throw new Error('no sprite group ' + name);
        return group;
    };
    const all = [...groups.single, ...groups.singleAlpha, ...groups.multi, ...groups.multiAlpha];
    const singles = [...groups.single, ...groups.singleAlpha];
    const lines: string[] = ['gl 1'];
    for (const gl of [1, 0]) {
        lines.push('gl ' + gl);
        for (const g of all) lines.push('load ' + g, 're');
        for (const g of all) lines.push('load ' + g, 'cj');
        for (const g of singles) lines.push('load ' + g, 'gi');
        for (const g of all) lines.push('load ' + g, 'ui');
        for (const g of singles) lines.push('load ' + g, 'wh');
        lines.push('font ' + id('p11_full') + ' 0', 'font ' + id('b12_full') + ' 0');
    }
    lines.push('gl 1', 'flushcache');
    const [plain, plain2] = groups.single;
    const [alpha, alpha2] = groups.singleAlpha;
    // graphic <spriteId> <activeSprite> <active> <vFlip> <hFlip> <outline> <shadow> <spriteAlpha>
    lines.push(
        `graphic ${plain} -1 0 0 0 0 0 0`,
        `graphic ${plain} -1 0 0 0 0 0 0`,
        `graphic ${plain} ${alpha} 1 1 1 2 3355443 1`,
        `graphic ${alpha} -1 0 0 1 1 0 1`,
        `graphic ${alpha} -1 0 1 0 0 1118481 0`,
        `graphic ${plain2} ${alpha2} 1 0 0 0 0 0`,
        'graphic 999999 -1 0 0 0 0 0 0',
        'graphic -1 -1 0 0 0 0 0 0',
        'gl 0',
        `graphic ${plain2} -1 0 1 0 1 0 0`,
        `graphic ${alpha2} -1 0 0 0 0 0 1`,
        'gl 1'
    );
    // The title: the b12 font from the last font command above (built with tf.w clear) is replaced by a GL one.
    lines.push('font ' + id('b12_full') + ' 0', `titleopen ${id('titlebg')} ${id('logo')} 765 503`, 'titledraw 0 10 49', 'titledraw 1 50 50', 'titledraw 0 100', `titleopen ${id('titlebg')} ${id('logo')} 1024 768`, 'titledraw 0 0');
    // The minimap build: mapl <seed>, build <level> <failing detail call or -1> <player level>.
    lines.push('seed 53020', 'mapl 1234', 'resetmap', 'build 0 -1 0', 'random', 'seed 1', 'mapl 99', 'resetmap', 'build 1 5 1', 'random', 'build 1 -1 1', 'random', 'seed -1', 'build 3 -1 2', 'random', 'build 2 0 2', 'build 2 -1 2', 'random');
    // The minimap and compass draws: mmstate <state> <x> <z> <yaw> <angle> <zoom>; mmdraw/compass <x> <y> <width>
    // <height> <mask sprite or -1> <redraw index>.
    const compass = id('compass');
    const mask = plain;
    lines.push(`compassimg ${compass}`);
    for (const state of [0, 1, 2, 3, 4, 5]) {
        lines.push(`mmstate ${state} 3222 3218 ${state * 300} ${state * 7} ${state * 5 - 10}`, `mmdraw 550 4 146 151 ${mask} 3`, 'mmdraw 550 4 146 151 -1 4', `compass 545 4 33 33 ${mask} 5`, 'compass 545 4 33 33 -1 6');
    }
    for (const mode of ['zoom', 'badX', 'badZ']) lines.push('mmstate 0 3222 3218 98 7 0', `mmmask 550 4 146 151 ${mask} 3 ${mode}`);
    lines.push('resetmap', 'mmstate 0 3222 3218 0 0 0', `mmdraw 550 4 146 151 ${mask} 3`, 'mmdraw 0 0 146 151 -1 3');
    for (const active of [1, 0]) {
        lines.push('gl ' + active, 'compassimg ' + compass);
        const modes = ['ok', 'swap', 'nullImage', 'nullWidget', 'disabled', 'limitLow', 'limitHigh'];
        if (active) modes.push('wrongImage', 'throwMask', 'wrongMask');
        for (const mode of modes) lines.push('compassorder ' + mode + ' ' + mask);
    }
    return lines;
}

function runOracle(dir: string, lines: string[]): { trace: string; state: string } {
    const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
    const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
    const compile = Bun.spawnSync(['javac', asm, '-encoding', 'UTF-8', '-cp', cp, '-d', dir, ...['HdMergesOracle.java', 'HdTitleFrameOracle.java', 'GlRecorder.java'].map(s => join(import.meta.dir, s))]);
    expect(compile.exitCode, compile.stderr.toString()).toBe(0);
    const java = ['java', asm, '--add-opens=java.base/java.lang=ALL-UNNAMED', '-Djava.awt.headless=true', '-Xmx1g', '-XX:+UnlockDiagnosticVMOptions', '-XX:-UseLibmIntrinsic', '-Dgltrace.caps=' + profilePath, '-cp', cp, 'HdMergesOracle'];
    const instrument = Bun.spawnSync([...java, 'instrument', dir]);
    expect(instrument.exitCode, instrument.stderr.toString()).toBe(0);
    const file = join(dir, 'script.txt');
    writeFileSync(file, lines.join('\n') + '\n');
    const out = join(dir, 'java');
    const run = Bun.spawnSync([...java, cachePath, out, profilePath, file], { timeout: 120000 });
    expect(run.exitCode, run.stderr.toString()).toBe(0);
    return { trace: readFileSync(join(out, 'trace.tsv'), 'utf8'), state: readFileSync(join(out, 'state.txt'), 'utf8').replaceAll('\r\n', '\n') };
}

function kind(o: unknown): string {
    if (o === null) return 'null';
    if (o instanceof GlAlphaSprite) return 'el';
    if (o instanceof GlSprite) return 'cf';
    if (o instanceof SoftwareAlphaSprite) return 'am';
    if (o instanceof Pix32) return 'mm';
    if (o instanceof GlIndexedSprite) return 'oh';
    if (o instanceof Pix8) return 'ek';
    if (o instanceof GlFont) return 'mb';
    if (o instanceof SoftwareFont) return 'dd';
    return '?' + String(o);
}

const retained: unknown[] = [];

function sprite(s: AbstractSprite | null): string {
    if (s === null) return 'null';
    retained.push(s);
    return kind(s) + ':' + [s.cropW, s.cropH, s.xOffset, s.yOffset, s.width, s.height].join(',');
}

function indexed(s: AbstractIndexedSprite | null): string {
    if (s === null) return 'null';
    retained.push(s);
    return kind(s) + ':' + [s.cropW, s.cropH, s.xOffset, s.yOffset, s.width, s.height].join(',');
}

function component(t: string[], first: number): IfType {
    const c = new IfType();
    c.width = Number(t[first]);
    c.height = Number(t[first + 1]);
    c.spriteId = Number(t[first + 2]);
    c.activeSprite = -1;
    retained.push(c);
    return c;
}

function javaName(e: unknown): string {
    const cause = e instanceof WrappedException ? e.cause : e;
    if (cause instanceof TypeError) return cause.message.startsWith('ClassCastException') ? 'ClassCastException' : 'NullPointerException';
    if (cause instanceof RangeError) return cause.message === '/ by zero' ? 'ArithmeticException' : 'ArrayIndexOutOfBoundsException';
    return 'unmapped:' + String(cause);
}

function compassOrder(mode: string, maskId: number): string {
    const widget = new IfType();
    widget.width = widget.height = 33;
    widget.spriteId = maskId;
    widget.maskStarts = widget.maskWidths = new Int32Array(33);
    const graphic = widget.GetGraphic.bind(widget);
    const reads: string[] = [];
    let yaw = 128;
    widget.GetGraphic = active => {
        reads.push('M');
        yaw = 1024;
        if (mode === 'throwMask') throw new TypeError('Null reference');
        if (mode === 'wrongMask') return new Pix32(1, 1);
        return graphic(active);
    };
    const original = Client.imageCompass;
    let image = mode === 'nullImage' ? null : mode === 'wrongImage' ? new Pix32(1, 1) : original;
    let images = 0;
    const probes: [object, string, string, () => unknown][] = [
        [Client, 'minimapState', 'S', () => (mode === 'disabled' || mode === 'limitHigh' ? 3 : 2)],
        [
            Client,
            'imageCompass',
            'I',
            () => {
                const value = image;
                if (mode === 'swap') {
                    if (++images === 1) image = new Pix32(13, 3);
                    if (images === 2) image = new Pix32(5, 19);
                }
                return value;
            }
        ],
        [OrbitCamera, 'followYaw', 'Y', () => yaw]
    ];
    const descriptors = probes.map(([host, key]) => requireNonNull(Object.getOwnPropertyDescriptor(host, key)));
    let result = 'ok';
    InterfaceList.rectangleRedraw[5] = false;
    try {
        for (const [host, key, label, read] of probes)
            Object.defineProperty(host, key, {
                configurable: true,
                get: () => {
                    reads.push(label);
                    return read();
                }
            });
        const limit = mode === 'limitLow' ? 2 : mode === 'limitHigh' ? 4 : 3;
        MinimapBuilder.CompassDraw(5, mode === 'nullWidget' ? null : widget, limit, 5, 7);
    } catch (error) {
        result = javaName(error);
    } finally {
        probes.forEach(([host, key], i) => Object.defineProperty(host, key, descriptors[i]));
    }
    return [reads.join(''), yaw, InterfaceList.rectangleRedraw[5], result].join('|');
}

function rawBits(value: number): string {
    const view = new DataView(new ArrayBuffer(8));
    view.setFloat64(0, value);
    return view.getBigInt64(0).toString();
}

loginFixture(
    import.meta.url,
    'HD 2D merges build GL sprites, fonts, minimap and title draws like the jar',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-hd-merges-'));
        try {
            const assets = localAssets(cachePath, [8, 13]);
            const sprites = assets.archive(8);
            const metrics = assets.archive(13);
            const groups = scanGroups(sprites);
            const lines = script(sprites, groups);
            const java = runOracle(dir, lines);

            const writer = new GlTraceWriter();
            GlRenderer.gl = new RecordingGL(new NullGL(capsProfileFromJson(readFileSync(profilePath, 'utf8'))), writer);
            GlRenderer.active = true;
            GlRenderer.width = 765;
            GlRenderer.height = 503;
            IfType.m_pSprites = sprites;
            let font: PixfontGeneric | null = null;
            // The kl.b stubs (ma.a world.Render2DGround, bj.a world.GdType, na.a Client.DrawDetail).
            let grounds = 0,
                groundHash = 0,
                typecodes = 0,
                typecodeHash = 0,
                details = 0,
                detailHash = 0,
                failAt = -1;
            let firstDetail = '-';
            world.Render2DGround = (pixels, pos, width, level, x, z) => {
                grounds++;
                groundHash = (Math.imul(groundHash, 31) + (pos ^ (width << 20) ^ (level << 28) ^ (x << 8) ^ (z << 16)) + (pixels === null ? 1 : 0)) | 0;
            };
            world.GdType = (level, x, z) => {
                typecodes++;
                typecodeHash = (Math.imul(typecodeHash, 31) + ((level << 28) ^ (x << 8) ^ (z << 16))) | 0;
                return 0n;
            };
            Client.DrawDetail = (z, offsetX, active, level, x, offsetZ, wall) => {
                const call = details++;
                detailHash = (Math.imul(detailHash, 31) + Math.imul((level << 28) ^ (x << 8) ^ (z << 16) ^ (offsetX << 4) ^ offsetZ, 7) + Math.imul(wall, 3) + active) | 0;
                if (call === 0) firstDetail = [level, x, z, (wall >>> 0).toString(16), (active >>> 0).toString(16)].join(',');
                return call !== failAt;
            };

            const state: string[] = [];
            const run = (t: string[]): string => {
                const n = (i: number): number => Number(t[i]);
                switch (t[0]) {
                    case 'gl':
                        GlRenderer.active = n(1) !== 0;
                        return '';
                    case 'seed':
                        mathRandom.setSeed(BigInt(t[1]));
                        return '';
                    case 'random':
                        return rawBits(mathRandom.nextDouble());
                    case 'load':
                        return SpriteLoader.loadGroup(sprites, n(1)) ? 'T' : 'F';
                    case 're':
                        return SpriteLoader.createSprites()
                            .map(s => sprite(s) + ' ')
                            .join('');
                    case 'cj':
                        return SpriteLoader.createSoftwareSprites()
                            .map(s => sprite(s) + ' ')
                            .join('');
                    case 'gi':
                        return sprite(SpriteLoader.createSprite());
                    case 'ui':
                        return SpriteLoader.toIndexedSprites()
                            .map(s => indexed(s) + ' ')
                            .join('');
                    case 'wh':
                        return indexed(SpriteLoader.createIndexedSprite());
                    case 'font':
                        font = SpriteLoader.loadFont(sprites, n(1), n(2), metrics);
                        retained.push(font);
                        return kind(font);
                    case 'flushcache':
                        IfType.m_spriteCache.Reset();
                        return '';
                    case 'graphic': {
                        const c = new IfType();
                        c.spriteId = n(1);
                        c.activeSprite = n(2);
                        c.vFlip = n(4) !== 0;
                        c.hFlip = n(5) !== 0;
                        c.outline = n(6);
                        c.spriteShadow = n(7);
                        c.spriteAlpha = n(8) !== 0;
                        retained.push(c);
                        return sprite(c.GetGraphic(n(3) !== 0)) + ' missing=' + (IfType.resourceMissing ? 'T' : 'F');
                    }
                    case 'titleopen':
                        TitleScreen.m_open = false;
                        TitleScreen.backgroundId = n(1);
                        TitleScreen.logoGroup = n(2);
                        GameShell.m_sWid = n(3);
                        GameShell.m_sHei = n(4);
                        TitleScreen.Open(sprites);
                        return sprite(TitleScreen.m_titleBack) + ' ' + indexed(TitleScreen.m_logo) + ' open=' + (TitleScreen.m_open ? 'T' : 'F');
                    case 'titledraw':
                        LocalisedText.loadingPleaseWait = fromLiteral('Loading - please wait.');
                        TitleScreen.m_loadString = fromLiteral('Loading sprites - ' + t[2] + '%');
                        TitleScreen.m_loadPos = n(2);
                        Texture.animBuffer = Int32Array.of(530);
                        TitleScreen.Draw(0x414141, font, n(1) !== 0, t.length > 3 ? n(3) : 60);
                        return Texture.animBuffer === null ? 'cleared' : 'retained';
                    case 'mapl': {
                        let x = n(1);
                        for (let level = 0; level < 4; level++)
                            for (let a = 0; a < 104; a++)
                                for (let b = 0; b < 104; b++) {
                                    x = (Math.imul(x, 1103515245) + 12345) | 0;
                                    arrayAtObj(arrayAtObj(ClientBuild.m_mapl, level), a)[b] = (x >>> 16) & 0x1f;
                                }
                        return '';
                    }
                    case 'resetmap':
                        MinimapBuilder.minimapImage = null;
                        MinimapBuilder.pendingImage = null;
                        return '';
                    case 'build': {
                        grounds = groundHash = typecodes = typecodeHash = details = detailHash = 0;
                        firstDetail = '-';
                        failAt = n(2);
                        Client.playerLevel = n(3);
                        Client.activeMapFunctionCount = 77;
                        const built = MinimapBuilder.BuildBuffer(n(1));
                        if (MinimapBuilder.minimapImage !== null) retained.push(MinimapBuilder.minimapImage);
                        if (MinimapBuilder.pendingImage !== null) retained.push(MinimapBuilder.pendingImage);
                        return (
                            (built ? 'T' : 'F') +
                            ' g=' +
                            grounds +
                            ',' +
                            groundHash +
                            ' t=' +
                            typecodes +
                            ',' +
                            typecodeHash +
                            ' d=' +
                            details +
                            ',' +
                            detailHash +
                            ' first=' +
                            firstDetail +
                            ' image=' +
                            sprite(MinimapBuilder.minimapImage) +
                            ' pending=' +
                            sprite(MinimapBuilder.pendingImage) +
                            ' pix=' +
                            (Pix2D.pixels === null ? 'null' : 'set') +
                            ' count=' +
                            Client.activeMapFunctionCount
                        );
                    }
                    case 'mmstate': {
                        Client.minimapState = n(1);
                        const player = new ClientPlayer();
                        player.x = n(2);
                        player.z = n(3);
                        Client.localPlayer = player;
                        OrbitCamera.followYaw = n(4);
                        OrbitCamera.minimapAngle = n(5);
                        OrbitCamera.minimapZoom = n(6);
                        WorldMapLabels.scene = null;
                        Client.activeMapFunctionCount = 0;
                        Client.npcCount = 0;
                        ReceivePlayerPositions.m_lastNum = 0;
                        Client.destinationX = 0;
                        return '';
                    }
                    case 'compassimg':
                        if (!SpriteLoader.loadGroup(sprites, n(1))) throw new Error('group ' + t[1]);
                        Client.imageCompass = SpriteLoader.createSprite();
                        return sprite(Client.imageCompass);
                    case 'mmdraw':
                        arrayPutObj(InterfaceList.rectangleRedraw, n(6), false);
                        MinimapBuilder.Draw(n(1), component(t, 3), n(6), n(2));
                        return 'redraw=' + (arrayAtObj(InterfaceList.rectangleRedraw, n(6)) ? 'T' : 'F');
                    case 'compass':
                        arrayPutObj(InterfaceList.rectangleRedraw, n(6), false);
                        MinimapBuilder.CompassDraw(n(6), component(t, 3), 3, n(1), n(2));
                        return 'redraw=' + (arrayAtObj(InterfaceList.rectangleRedraw, n(6)) ? 'T' : 'F');
                    case 'compassorder':
                        return compassOrder(t[1], n(2));
                    case 'mmmask': {
                        const widget = component(t, 3);
                        const graphic = widget.GetGraphic.bind(widget);
                        const self = Client.localPlayer;
                        const labels = new WorldMapLabels(1);
                        labels.flags[0] = 4;
                        if (t[7] !== 'zoom') WorldMapLabels.scene = labels;
                        widget.GetGraphic = active => {
                            OrbitCamera.minimapZoom = 39;
                            if (t[7] === 'badX') {
                                Client.localPlayer = null;
                                labels.x = new Int16Array(0);
                            }
                            if (t[7] === 'badZ') {
                                labels.z = new Int16Array(0);
                                OrbitCamera.minimapZoom = -256;
                            }
                            return graphic(active);
                        };
                        try {
                            MinimapBuilder.Draw(n(1), widget, n(6), n(2));
                            return '';
                        } finally {
                            Client.localPlayer = self;
                            WorldMapLabels.scene = null;
                        }
                    }
                    default:
                        throw new Error(t[0]);
                }
            };
            lines.forEach((line, i) => {
                writer.mark('op' + i);
                try {
                    state.push(i + ' ok ' + run(line.split(' ')));
                } catch (error) {
                    state.push(i + ' threw ' + javaName(error) + ' ');
                }
            });

            const tsState = state.join('\n') + '\n';
            const dump = process.env.RS530_MERGES_DUMP;
            if (dump !== undefined) {
                writeFileSync(join(dump, 'java-state.txt'), java.state);
                writeFileSync(join(dump, 'ts-state.txt'), tsState);
                writeFileSync(join(dump, 'java-trace.tsv'), java.trace);
                writeFileSync(join(dump, 'ts-trace.tsv'), writer.text());
            }
            if (tsState !== java.state) {
                const a = java.state.split('\n');
                const b = tsState.split('\n');
                let i = 0;
                while (i < a.length && a[i] === b[i]) i++;
                expect(b[i] ?? '<end>', 'state line ' + i + ' (' + (lines[i] ?? '') + ')').toBe(a[i] ?? '<end>');
            }
            const diff = diffTraces(java.trace, writer.text(), { expectedLabel: 'java', actualLabel: 'ts' });
            if (!diff.equal) throw new Error(diff.report);
            // The kinds the merges must produce with tf.w set.
            expect(java.state).toMatch(/ cf:/);
            expect(java.state).toMatch(/ el:/);
            expect(java.state).toMatch(/ oh:/);
            expect(java.state).toMatch(/ ok mb/);
            expect(java.state).toMatch(/ ok dd/);
            expect(java.state).toMatch(/image=cf:512,512/);
            expect(retained.length).toBeGreaterThan(0);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    300000,
    'gl'
);
