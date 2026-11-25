import PixScreen, { CanvasComponent } from '#/graphics/PixScreen.js';
import Pix3D from '#/dash3d/Pix3D.js';
import world from '#/dash3d/world.js';
import RoofModeStatics from '#/dash3d/RoofModeStatics.js';
import TextureCache from '#/dash3d/TextureCache.js';
import { loginFixture } from './login-fixture.js';
import ClientBuild from '#/client/ClientBuild.js';
import MouseTracking from '#/client/MouseTracking.js';
import Preferences from '#/ui/Preferences.js';
import { receivePacket } from './receive-packet.js';
import { freshGame } from './actor-fixture.js';
import InterfaceInputFixture from './interfaceInputFixture.js';
import GameWorld from '#/io/GameWorld.js';
import GameShell from '#/client/GameShell.js';
import { preserveLoadingGroupIds } from './loading-group-fixture.js';
import { expect, test } from 'bun:test';
import Isaac from '#/io/Isaac.js';
import PlayerModel from '#/dash3d/PlayerModel.js';
import SuperPacket from '#/io/SuperPacket.js';
import type { Js5Stream } from '#/io/SocketPlatform.js';
import Packet530 from '#/io/Packet530.js';
import WorldList from '#/io/WorldList.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { cachePath } from './reference.js';
import IfType from '#/ui/IfType.js';
import { toJsString } from '#/datastruct/JagString.js';
import InterfaceSession from '#/ui/InterfaceSession.js';
import InterfaceList from '#/ui/InterfaceList.js';
import SpriteLoader from '#/graphics/SpriteLoader.js';
import Minimenu from '#/ui/Minimenu.js';
import Client from '#/client/Client.js';
import InterfaceView from '#/ui/InterfaceView.js';
import Pix2D from '#/graphics/Pix2D.js';
import { localAssets } from './cachefile.js';
import { tutorialPlayerInfo } from './majula.js';

test('world list full reply and checksum update preserve country, flags and 16-bit population', () => {
    WorldList.decode(Buffer.from('0101010000555300010101000000000001002d00006c6f63616c686f73740000000001000000', 'hex'));
    const world = requireNonNull(GameWorld.GetByID(1));
    expect({ id: world.id, flags: world.flags, activity: toJsString(requireNonNull(world.activity)), host: toJsString(requireNonNull(world.host)), country: world.country, players: world.players }).toEqual({
        id: 1,
        flags: 1,
        activity: '-',
        host: 'localhost',
        country: 0,
        players: 0
    });
    WorldList.decode(Uint8Array.of(1, 0, 0, 1, 35));
    expect(requireNonNull(GameWorld.GetByID(1)).players).toBe(291);
    WorldList.decode(Uint8Array.of(1, 0, 0, 255, 255));
    expect(requireNonNull(GameWorld.GetByID(1)).players).toBe(-1);
});

test('530 strings retain all nonzero byte values and reject a truncated packet', () => {
    const p = new Packet530(Uint8Array.of(128, 255, 0, 65));
    expect(p.gjstr()).toBe('\x80\xff');
    expect(p.m_pos).toBe(3);
    expect(() => p.gjstr()).toThrow(RangeError);
    expect(p.m_pos).toBe(5);
});

loginFixture(import.meta.url, 'Majula opens the fixed game frame and drives character creation through cached component scripts', async () => {
    using _groupState = preserveLoadingGroupIds();
    const previousWidth = GameShell.m_sWid,
        previousHeight = GameShell.m_sHei;
    const previousStream = Client.stream,
        previousBold = Client.fontBold12,
        previousMetrics = Client.fontMetricsArchive;
    const previousCompass = Client.imageCompass;
    const previousMenu = [Minimenu.count, Minimenu.isOpen] as const;
    let fixture: InterfaceInputFixture | undefined;
    GameShell.m_sWid = 765;
    GameShell.m_sHei = 503;
    try {
        const assets = localAssets(
            cachePath,
            Array.from({ length: 28 }, (_, i) => i)
        );
        GameShell.drawArea = await PixScreen.create(503, new CanvasComponent(), 765);
        world.init(4, 104, 104, 25, false);
        RoofModeStatics.applyRoofMode();
        Pix3D.textureProvider = new TextureCache(assets.archive(9), assets.archive(26), assets.archive(8), 20, false);
        Client.lookupSpriteGroupIds(assets.archive(8));
        const compass = requireNonNull(SpriteLoader.loadSoftwareSprite(assets.archive(8), SpriteLoader.compassId, 0));
        compass.trim();
        Client.imageCompass = compass;
        const bold = Client.fontBold12Id;
        Client.fontMetricsArchive = assets.archive(13);
        Client.fontBold12 = requireNonNull(SpriteLoader.loadFont(assets.archive(8), bold, 0, Client.fontMetricsArchive));
        Minimenu.count = 0;
        Minimenu.isOpen = false;
        const view = new InterfaceView([]);
        const errors: string[] = [];
        const ui = new InterfaceSession(view, assets, error => errors.push(error.message + ' ' + String(error.cause)));
        const nativeInput = (fixture = new InterfaceInputFixture(ui));
        const wire: Uint8Array[] = [];
        const stream: Js5Stream = {
            GetAvailable() {
                return 0;
            },
            Close() {},
            async read() {
                return -1;
            },
            async Read() {
                throw new Error('Unexpected read');
            },
            Write(offset, bytes, length) {
                wire.push(requireNonNull(bytes).slice(offset, offset + length));
            }
        };
        Client.stream = stream;
        const outgoing = new SuperPacket(5000);

        outgoing.SetEnc(new Int32Array(4));
        const game = freshGame({ outgoing, rebuild: null, account: null }, assets);
        const app = nativeInput.client;
        app.game = game;
        ui.beginGame(game);
        Client.gameState = 30;
        Client.loopCycle = 1; // client.a increments the cycle before t.c.
        Client.mouseTracking = new MouseTracking();
        ClientBuild.buildLevel = Client.playerLevel;
        Client.lastSentFocus = GameShell.m_focus;
        Preferences.sent = true;
        const previousColours = PlayerModel.recolourDestinations;
        try {
            PlayerModel.recolourDestinations = PlayerModel.recolourDestinationsRs;
            expect(await receivePacket(225, tutorialPlayerInfo)).toBe(true);
        } finally {
            PlayerModel.recolourDestinations = previousColours;
        }
        expect(toJsString(requireNonNull(game.actors.self.username))).toBe('Porttester');
        // Real IF_OPENTOP, IF_OPENSUB, IF_SETPLAYERHEAD and IF_SETEVENTS from Tutorial Island.
        await receivePacket(145, Buffer.from('a402808100', 'hex'));
        await receivePacket(155, Buffer.from('0024020b0000b80303', 'hex'));
        await receivePacket(21, Buffer.from('00002e16000303', 'hex'));
        await receivePacket(66, Buffer.from('af00004f0303', 'hex'));
        await receivePacket(165, Buffer.from('0f00860200bb0001008000060000', 'hex'));
        expect(wire).toHaveLength(0);
        await app.GameLoop();
        expect(InterfaceList.subInterfaces.get(BigInt((548 << 16) + 11))?.group).toBe(771);
        expect(IfType.Get((771 << 16) | 79)?.modelType).toBe(3);
        const slot = new IfType();
        slot.id = (187 << 16) | 1;
        slot.childId = 646;
        expect(Client.GetActive(slot).events).toBe(6);
        const ackCipher = new Isaac(new Int32Array(4));
        // The first game tick sends the pending camera position before the interface acknowledgement.
        expect(Array.from(wire[0])).toEqual([(21 + ackCipher.TakeNextValue()) & 255, 0, 0, 0, 0, (177 + ackCipher.TakeNextValue()) & 255, 0, 16]);
        let tick = 1;
        const click = async (x: number, y: number) => {
            nativeInput.set({ x, y, held: false, keys: [] });
            Minimenu.ResetMinimenu();
            const image = new Int32Array(765 * 503);
            Pix2D.setPixels(image, 765, 503);
            InterfaceList.rootCount = 0;
            view.draw();
            Minimenu.Sort();
            await nativeInput.tick({ x, y, held: true, keys: [], click: { x, y } }, tick++);
            await nativeInput.tick({ x, y, held: false, keys: [] }, tick++);
        };
        const visibleText = () => view.visibleComponents().map(c => toJsString(c.textValue));
        expect(visibleText()).toContain('Mouse');
        await click(145, 148);
        await click(391, 298);
        expect(visibleText()).toContain('Gender');
        expect(visibleText()).toContain('Please select your character gender.');
        expect(errors).toEqual([]);
    } finally {
        fixture?.restore();
        Client.stream = previousStream;
        Client.fontBold12 = previousBold;
        Client.fontMetricsArchive = previousMetrics;
        Client.imageCompass = previousCompass;
        [Minimenu.count, Minimenu.isOpen] = previousMenu;
        GameShell.m_sWid = previousWidth;
        GameShell.m_sHei = previousHeight;
    }
});
