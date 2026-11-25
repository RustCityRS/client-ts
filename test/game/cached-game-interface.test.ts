import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import GameShell from '#/client/GameShell.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import MinimapBuilder from '#/dash3d/MinimapBuilder.js';
import Pix3D from '#/dash3d/Pix3D.js';
import TextureCache from '#/dash3d/TextureCache.js';
import HashTable from '#/datastruct/HashTable.js';
import Pix2D from '#/graphics/Pix2D.js';
import InterfaceList from '#/ui/InterfaceList.js';
import Minimenu from '#/ui/Minimenu.js';
import SubInterface from '#/ui/SubInterface.js';
import { compareFramebuffers } from '../render/Framebuffer.js';
import { localAssets } from '../cachefile.js';
import { loginFixture } from '../login-fixture.js';
import { readReferenceFrames } from '../reference-frames.js';
import { cachePath, gamepackPath } from '../reference.js';

loginFixture(
    import.meta.url,
    'cached fixed and resizable game interfaces match every pixel around the 3D scene',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), '530-game-interface-'));
        try {
            const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
            const build = Bun.spawnSync(['javac', asm, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'GameInterfaceFrameOracle.java'), join(import.meta.dir, '../render/ProceduralTextureCacheOracle.java')]);
            expect(build.exitCode, build.stderr.toString()).toBe(0);
            const command = ['java', asm, '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'GameInterfaceFrameOracle'];
            const prepare = Bun.spawnSync([...command, 'prepare', gamepackPath, dir]);
            expect(prepare.exitCode, prepare.stderr.toString()).toBe(0);
            const assets = localAssets(cachePath, [3, 7, 8, 9, 13, 19, 26]);
            const sprites = assets.archive(8);
            Client.lookupSpriteGroupIds(sprites);
            Client.loadFonts(sprites, assets.archive(13));
            Client.loadSprites(sprites);
            Pix3D.textureProvider = new TextureCache(assets.archive(9), assets.archive(26), sprites, 20, false);
            Pix3D['brightness'] = Math.fround(0.8);
            Pix3D['initColourTable'](0, 512);
            Client.localPlayer = new ClientPlayer();
            Client.displayFps = false;
            Minimenu.isOpen = true;
            MinimapBuilder.minimapImage = null;
            const sceneCalls: string[] = [];
            Client.drawScene = (height, width, y, x, fixed) => {
                sceneCalls.push([x, y, width, height, fixed].join('/'));
                Pix2D.setClipping(x, y, x + width, y + height);
                Pix2D.fillRect(x, y, width, height, 0x26495b);
                Pix2D.fillRect(x + 5, y + 7, 19, 23, 0xa22930);
            };
            const cases = [
                [765, 503, 548],
                [765, 503, 548, 11, 771],
                [765, 503, 548, 11, 744],
                [765, 503, 548, 11, 149],
                [765, 503, 548, 11, 387],
                [997, 633, 746],
                [1280, 720, 746],
                [461, 323, 387],
                [315, 268, 149],
                [479, 337, 90]
            ];
            for (const [width, height, group, ...mounts] of cases) {
                const file = join(dir, 'frame.bin');
                const jar = Bun.spawnSync([...command, cachePath, file, ...[width, height, group, ...mounts].map(String)]);
                expect(jar.exitCode, jar.stderr.toString()).toBe(0);
                InterfaceList.top = group;
                GameShell.m_sWid = width;
                GameShell.m_sHei = height;
                InterfaceList.subInterfaces = new HashTable<SubInterface>(8);
                for (let i = 0; i < mounts.length; i += 2) {
                    const sub = new SubInterface();
                    sub.group = mounts[i + 1];
                    InterfaceList.subInterfaces.put(sub, BigInt((group << 16) + mounts[i]));
                }
                Client.InterfaceCalculateSizeAndPosAll(false);
                InterfaceList.rectRedrawnLastFrame.fill(true);
                InterfaceList.rootCount = 0;
                sceneCalls.length = 0;
                const pixels = new Int32Array(width * height).fill(0x131b23);
                Pix2D.setPixels(pixels, width, height);
                Client.drawTopLevelInterface();
                expect([InterfaceList.rootCount, ...sceneCalls].join(' ').trimEnd()).toBe(jar.stdout.toString().trimEnd());
                for (const { frame } of readReferenceFrames(file, width, height, 1)) expect(() => compareFramebuffers(frame, { ...frame, pixels }), [width, height, group, ...mounts].join(' ')).not.toThrow();
            }
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    60000
);
