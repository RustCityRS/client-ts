import Pix2D from '#/graphics/Pix2D';
import type PixfontGeneric from '#/graphics/PixfontGeneric';
import type AbstractSprite from '#/graphics/AbstractSprite';
import type AbstractIndexedSprite from '#/graphics/AbstractIndexedSprite';
import SpriteLoader from '#/graphics/SpriteLoader';
import GameShell from '#/client/GameShell';
import type Js5 from '#/cache/Js5';
import TitleFlames from './TitleFlames';

import Client from '#/client/Client';
import { glJar } from '#/client/ClientVariant';
import GameWorld from '#/io/GameWorld';
import { utf8String } from '#/io/JavaText';
import WorldList from '#/io/WorldList';
import Signlink from '#/util/Signlink';
import { JavaError } from '#/util/ClientError';
import { requireNonNull } from '#/util/JavaArray';
import JagString, { fromLiteral } from '#/datastruct/JagString';
import LocalisedText from '#/ui/LocalisedText';
import GlRenderer from '#/gl/GlRenderer';
import { loadGlRaster } from '#/util/GamepackClasses';
export default class TitleScreen {
    // fd.a(II)Z. NXT TitleScreen::SwitchToWorld.
    static SwitchToWorld(id: number): boolean {
        const world = GameWorld.GetByID(id);
        if (world === null) return false;
        if (Signlink.platform !== 1 && Signlink.platform !== 2 && Client.modeWhere !== 2) {
            let port = Client.emptyString;
            if (Client.modeWhere !== 0) port = JagString.join([WorldList.colon, JagString.fromInt((world.id + 7000) | 0)]);
            let settings = Client.emptyString;
            if (Client.settings !== null) settings = JagString.join([WorldList.settingsParamPrefix, Client.settings]);
            const url = JagString.join([
                GameWorld.httpPrefix,
                world.host,
                port,
                WorldList.langParam,
                JagString.fromInt(LocalisedText.language),
                Client.urlAffiliatePart,
                JagString.fromInt(Client.affiliateId),
                settings,
                WorldList.urlJsSegment,
                Client.javascript ? Client.paramTrue : WorldList.zero,
                WorldList.objectTagArg,
                Client.objectTag ? Client.paramTrue : WorldList.zero,
                Client.worldUrlAdvertFlag,
                Client.advertSuppressed ? Client.paramTrue : WorldList.zero
            ]);
            try {
                const context = requireNonNull(Client.activeClient).getAppletContext();
                const address = url.toUrl();
                requireNonNull(context).showDocument(address, '_self');
                return true;
            } catch (error) {
                if (error instanceof JavaError) throw error;
                return false;
            }
        }
        const bytes = requireNonNull(world.host).toBytes();
        Client.gameHost = utf8String(bytes, 0, bytes.length);
        Client.selectedWorldId = world.id;
        if (Client.modeWhere !== 0) {
            Client.primaryPort = (Client.selectedWorldId + 40000) | 0;
            Client.secondaryPort = (Client.selectedWorldId + 50000) | 0;
            Client.currentPort = Client.primaryPort;
        }
        return true;
    }

    static backgroundId = -1; // ed.a:I
    static logoGroup = -1; // da.h:I
    static titleBgName: JagString | null = fromLiteral('titlebg'); // ad.e:Lid;
    static logoName: JagString | null = fromLiteral('logo'); // ea.d:Lid;

    // ck.a(Lal;I)Z
    static isRunesReady(sprites: Js5 | null): boolean {
        return requireNonNull(sprites).RequestDownload2(TitleFlames.runesGroup);
    }

    // jl.a(Lal;I)I. NXT TitleScreen::Ready, titlescreen.h:21.
    static Ready(sprites: Js5 | null): number {
        let count = 0;
        sprites = requireNonNull(sprites);
        if (sprites.RequestDownload2(TitleScreen.backgroundId)) count++;
        if (sprites.RequestDownload2(TitleScreen.logoGroup)) count++;
        return count;
    }

    // qg.c(I)I. NXT TitleScreen::ReadyMax (titlescreen.h:22): the stage-60 title sprite total. The only live caller
    // (client.java:1885) passes 100, which selects 2; the `!= 100 ? 124` arm is the dummy guard (stripped).
    static ReadyMax(): number {
        return 2;
    }

    static m_loadPos = 10; // ga.D:I
    private static loadingTextDefault: JagString | null = fromLiteral(''); // ie.u:Lid;
    static m_loadString = TitleScreen.loadingTextDefault; // ie.A:Lid;
    static m_open = false; // kg.H:Z
    static m_titleBack: AbstractSprite | null = null; // ai.k:Lvc;
    static m_logo: AbstractIndexedSprite | null = null; // ad.i:Lsi;

    // SD ef.a(Lal;B)V / HD oi.a(Lve;B)V. HD: the byte dummy's `> -50 -> oi.a(-27)` guard after the store is stripped.
    // While tf.w is set the screen is cleared with GlRaster (glClear of colour and depth) instead of Pix2D; the background
    // and logo come back from the loaders as GL sprites.
    static Open(archive: Js5 | null): void {
        if (TitleScreen.m_open) return;
        if (!(glJar && GlRenderer.active)) {
            Pix2D.cls();
        } else {
            loadGlRaster().clear();
        }
        TitleScreen.m_titleBack = SpriteLoader.loadSprite3(TitleScreen.backgroundId, archive);
        const height = GameShell.m_sHei;
        const width = (Math.imul(height, 956) / 503) | 0;
        const background = TitleScreen.m_titleBack;
        const left = (((GameShell.m_sWid - width) | 0) / 2) | 0;
        requireNonNull(background).drawScaled(left, 0, width, height);
        TitleScreen.m_logo = SpriteLoader.loadIndexedSprite2(TitleScreen.logoGroup, archive);
        const logo = TitleScreen.m_logo;
        const logoX = glJar ? ((GameShell.m_sWid / 2) | 0) - ((requireNonNull(TitleScreen.m_logo).width / 2) | 0) : -((requireNonNull(TitleScreen.m_logo).width / 2) | 0) + ((GameShell.m_sWid / 2) | 0);
        requireNonNull(logo).draw(logoX | 0, 18);
        TitleScreen.m_open = true;
    }

    // rk.a(B)V
    static Close(): void {
        if (TitleScreen.m_open) {
            TitleScreen.m_logo = null;
            TitleScreen.m_titleBack = null;
            TitleScreen.m_open = false;
        }
    }

    // SD mk.a(ILmb;Z)V / HD oj.a(BZLrk;)V. HD passes the literal -1 where SD passes its int (the only SD caller passes
    // -1). The HD redraw callers pass 117 or 122 for the byte guard. While tf.w is set the background and
    // logo are redrawn on every call (`tf.w || bl`) and the progress box is drawn with GlRaster.
    static Draw(shadow: number, font: PixfontGeneric | null, redraw: boolean, guard = 117): void {
        if ((glJar && GlRenderer.active) || redraw) {
            const height = GameShell.m_sHei;
            const width = (Math.imul(956, height) / 503) | 0;
            const background = TitleScreen.m_titleBack;
            const left = (((GameShell.m_sWid - width) | 0) / 2) | 0;
            requireNonNull(background).drawScaled(left, 0, width, height);
            const logo = TitleScreen.m_logo;
            const halfLogo = (requireNonNull(TitleScreen.m_logo).width / 2) | 0;
            requireNonNull(logo).draw((((GameShell.m_sWid / 2) | 0) - halfLogo) | 0, 18);
        }
        const heading = LocalisedText.loadingPleaseWait;
        const headingX = (GameShell.m_sWid / 2) | 0;
        const headingY = (((GameShell.m_sHei / 2) | 0) - 26) | 0;
        requireNonNull(font).drawCentred(heading, headingX, headingY, 0xffffff, glJar ? -1 : shadow);
        const top = (((GameShell.m_sHei / 2) | 0) - 18) | 0;
        if (glJar && GlRenderer.active) {
            const GlRaster = loadGlRaster();
            GlRaster.drawRect((((GameShell.m_sWid / 2) | 0) - 152) | 0, top, 304, 34, 0x8c1111);
            GlRaster.drawRect((-151 + ((GameShell.m_sWid / 2) | 0)) | 0, (top - -1) | 0, 302, 32, 0);
            GlRaster.fillRect((((GameShell.m_sWid / 2) | 0) - 150) | 0, (top + 2) | 0, Math.imul(TitleScreen.m_loadPos, 3), 30, 0x8c1111);
            GlRaster.fillRect((((GameShell.m_sWid / 2) | 0) + -150 - -Math.imul(3, TitleScreen.m_loadPos)) | 0, (2 + top) | 0, (300 + -Math.imul(3, TitleScreen.m_loadPos)) | 0, 30, 0);
        } else {
            Pix2D.drawRect((((GameShell.m_sWid / 2) | 0) - 152) | 0, top, 304, 34, 0x8c1111);
            Pix2D.drawRect((((GameShell.m_sWid / 2) | 0) - 151) | 0, (top + 1) | 0, 302, 32, 0);
            Pix2D.fillRect((((GameShell.m_sWid / 2) | 0) - 150) | 0, (top + 2) | 0, Math.imul(TitleScreen.m_loadPos, 3), 30, 0x8c1111);
            const remainderX = glJar ? (Math.imul(3, TitleScreen.m_loadPos) - 150 + ((GameShell.m_sWid / 2) | 0)) | 0 : (((GameShell.m_sWid / 2) | 0) + Math.imul(TitleScreen.m_loadPos, 3) - 150) | 0;
            Pix2D.fillRect(remainderX, (top + 2) | 0, (300 - Math.imul(3, TitleScreen.m_loadPos)) | 0, 30, 0);
        }
        requireNonNull(font).drawCentred(TitleScreen.m_loadString, (GameShell.m_sWid / 2) | 0, (4 + ((GameShell.m_sHei / 2) | 0)) | 0, 0xffffff, -1);
        if (glJar && (guard << 24) >> 24 < 50) {
            // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD qi stays deferred until mk.a(ILmb;Z)V in TitleScreen.Draw.
            (require('#/dash3d/Texture') as typeof import('#/dash3d/Texture')).default.animBuffer = null;
        }
    }
}
