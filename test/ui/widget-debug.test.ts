import { expect } from 'bun:test';
import { appendFileSync, closeSync, fstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, readSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { compareFramebuffers } from '../render/Framebuffer.js';
import Client from '#/client/Client.js';
import GameShell from '#/client/GameShell.js';
import Js5RemoteLoader from '#/cache/Js5RemoteLoader.js';
import { fromLiteral, toJsString } from '#/datastruct/JagString.js';
import Pix2D from '#/graphics/Pix2D.js';
import SpriteLoader from '#/graphics/SpriteLoader.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import InterfaceView from '#/ui/InterfaceView.js';
import Minimenu from '#/ui/Minimenu.js';
import { requireNonNull } from '#/util/JavaArray.js';
import WrappedException from '#/util/WrappedException.js';
import { localAssets } from '../cachefile.js';
import { loginFixture } from '../login-fixture.js';
import { cachePath, gamepackPath } from '../reference.js';

type Row = [group: number, file: number, enabled: number, memoryKb: number, mode: number];
const width = 195,
    height = 76;
function cases(): Row[] {
    const rows: Row[] = [];
    for (const [group, file] of [
        [548, 3],
        [744, 117],
        [746, 1]
    ]) {
        for (const enabled of [0, 1]) for (let mode = 0; mode <= 13; mode++) rows.push([group, file, enabled, 65537, mode]);
        for (const kb of [0, 65535, 65536, 131072]) rows.push([group, file, 1, kb, 0]);
    }
    return rows;
}
loginFixture(
    import.meta.url,
    '530 FPS widget matches the Java heap and JS5 lines, partial frames, and original provider reads',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-widget-debug-')),
            observed = join(dir, 'observed'),
            framePath = join(dir, 'frames');
        let fd: number | undefined;
        try {
            mkdirSync(observed);
            const asm = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED'];
            const cp = dir + delimiter + gamepackPath;
            const run = (args: string[], input?: Buffer) => {
                const p = Bun.spawnSync(args, { stdin: input, maxBuffer: 8 * 1024 * 1024 });
                expect(p.exitCode, p.stderr.toString()).toBe(0);
                return p.stdout.toString().trimEnd();
            };
            run(['javac', ...asm, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'WidgetDebugOracle.java'), join(import.meta.dir, '../render/ProceduralTextureCacheOracle.java')]);
            run(['java', ...asm, '-cp', cp, 'WidgetDebugOracle', 'instrument', gamepackPath, observed]);
            const rows = cases();
            const lines = run(['java', ...asm, '-Djava.awt.headless=true', '-cp', observed + delimiter + cp, 'WidgetDebugOracle', cachePath, framePath], Buffer.from(rows.map(row => row.join(' ')).join('\n') + '\n')).split(/\r?\n/);
            expect(lines.length).toBe(rows.length);
            // Run lf from the untouched client.jar too. Its JVM heap reading varies between runs.
            // These clips keep the original FPS or cache line, and the disabled control covers the full frame.
            const controls: Row[] = [];
            for (const [group, file] of [
                [548, 3],
                [744, 117],
                [746, 1]
            ])
                for (const mode of [14, 15, 16]) controls.push([group, file, mode === 16 ? 0 : 1, 0, mode]);
            const controlFrames = join(dir, 'unmodified-frames');
            lines.push(...run(['java', ...asm, '-Djava.awt.headless=true', '-cp', cp, 'WidgetDebugOracle', cachePath, controlFrames], Buffer.from(controls.map(row => row.join(' ')).join('\n') + '\n')).split(/\r?\n/));
            appendFileSync(framePath, readFileSync(controlFrames));
            rows.push(...controls);
            expect(lines.length).toBe(rows.length);
            const assets = localAssets(cachePath, [3, 8, 13]),
                widgets = assets.archive(3),
                sprites = assets.archive(8),
                metrics = assets.archive(13);
            const index = requireNonNull(assets.index(3));
            const p12 = requireNonNull(SpriteLoader.loadFont(sprites, sprites.GetGroupId(fromLiteral('p12_full')), 0, metrics));
            const p11 = requireNonNull(SpriteLoader.loadFont(sprites, sprites.GetGroupId(fromLiteral('p11_full')), 0, metrics));
            let trace: string[] = [];
            for (const [font, size] of [
                [p12, 12],
                [p11, 11]
            ] as const) {
                const draw = font.drawRight.bind(font);
                font.drawRight = (text, x, y, colour, shadow) => {
                    trace.push([size, toJsString(requireNonNull(text)), x, y, colour, shadow].join(':'));
                    draw(text, x, y, colour, shadow);
                };
            }
            const net = requireNonNull(Client.js5NetQueue),
                disk = requireNonNull(Client.js5DiskQueue);
            fd = openSync(framePath, 'r');
            const reference = new Int32Array(width * height),
                bytes = new Uint8Array(reference.buffer);
            expect(fstatSync(fd).size).toBe(rows.length * bytes.length);
            for (const [i, row] of rows.entries()) {
                const [group, file, enabled, kb, mode] = row;
                trace = [];
                Client.displayFps = enabled !== 0;
                Client.usedMemoryKb = () => {
                    trace.push('heap');
                    return kb;
                };
                const c = IfType.decode((group << 16) | file, requireNonNull(widgets.GetFile(file, group)));
                expect(c.clientCode).toBe(1405);
                Object.assign(c, { parentId: -1, x: 6, y: 5, width: c.baseWidth, height: c.baseHeight });
                function provider(key: number): Js5RemoteLoader {
                    const p = new Js5RemoteLoader(key, null, null, net, disk, 0, 0, false);
                    p['reference'] = mode === 3 ? null : index;
                    p['verified'] = key === 28 || mode === 12 ? 2147483647 : key * 7;
                    if (mode === 8 && key === 11) p['verifying'] = true;
                    const groups = p.groupCount.bind(p),
                        verified = p.verifiedCount.bind(p),
                        position = p.verificationPosition.bind(p);
                    p.groupCount = () => {
                        trace.push('g' + key);
                        if (mode === 4 && key === 2) Client.js5Providers[2] = replacement;
                        return groups();
                    };
                    p.verifiedCount = () => {
                        trace.push('v' + key);
                        if (mode === 5 && key === 3) Client.js5Providers[3] = replacement;
                        return verified();
                    };
                    p.verificationPosition = () => {
                        trace.push('p' + key);
                        return position();
                    };
                    return p;
                }
                const replacement = provider(28);
                Client.js5Providers = Array.from({ length: mode === 1 ? 8 : 28 }, (_, j) => provider(j));
                if (mode === 2) Client.js5Providers[3] = null;
                if (mode === 9) Reflect.set(Client, 'js5Providers', null);
                Client.p12 = mode === 6 ? null : p12;
                Client.fontPlain11 = mode === 7 ? null : p11;
                GameShell.m_fps = mode === 12 ? -2147483648 : 51;
                InterfaceList.rootCount = 3;
                Client.loopCycle = 672;
                InterfaceList.dirty.length = mode === 10 ? 3 : 100;
                InterfaceList.rectangleRedraw.length = mode === 11 ? 3 : 100;
                InterfaceList.dirty.fill(false);
                InterfaceList.rectangleRedraw.fill(false);
                Minimenu.isOpen = true;
                Client.rectDebug = 0;
                InterfaceList.rectRedrawnLastFrame.fill(false);
                const pixels = Int32Array.from({ length: width * height }, (_, j) => (0x192837 + j * 111) & 0xffffff);
                Pix2D.setPixels(pixels, width, height);
                Pix2D.setClipping(mode === 13 ? 109 : 1, mode === 13 ? 18 : mode === 14 ? 40 : 1, width - 9, mode === 15 ? 22 : height - 4);
                let status = 'ok';
                try {
                    new InterfaceView([c]).draw();
                } catch (caught) {
                    let error = caught;
                    while (error instanceof WrappedException) error = error.cause;
                    if (error instanceof TypeError) status = 'null';
                    else if (error instanceof RangeError) status = error.message === '/ by zero' ? 'divide' : 'bounds';
                    else throw error;
                }
                const state = [status, !!InterfaceList.dirty[3], !!InterfaceList.rectangleRedraw[3], c.rootIndex, c.drawCycle, mode >= 14 ? '' : trace.join(',')].join('|');
                expect(state, row.join(' ')).toBe(lines[i]);
                let offset = 0;
                while (offset < bytes.length) {
                    const n = readSync(fd, bytes, offset, bytes.length - offset, null);
                    if (n === 0) throw new Error('Truncated 1405 reference frame');
                    offset += n;
                }
                const dims = { width, height, pitch: width };
                expect(() => compareFramebuffers({ ...dims, pixels: reference }, { ...dims, pixels }), row.join(' ')).not.toThrow();
            }
        } finally {
            if (fd !== undefined) closeSync(fd);
            rmSync(dir, { recursive: true, force: true });
        }
    },
    60000
);
