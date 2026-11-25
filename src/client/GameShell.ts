import { releaseReferences } from '#/util/StaticReferences';
import Timer from './Timer';
import BrowserStressFrames from './BrowserStressFrames';
import DisplayMode from './DisplayMode';
import { runToCompletion } from '#/script/ScriptContinuation';
import { glJar } from './ClientVariant';
import PixScreen, { type AwtComponent, type AwtGraphics } from '#/graphics/PixScreen';
import Signlink, { type SignlinkHost, type SignlinkThread } from '#/util/Signlink';
import ThreadUtils from '#/util/ThreadUtils';
import { clientErrorHost, JavaError, reportClientError } from '#/util/ClientError';
import SafeTime from '#/io/SafeTime';
import { isJavaRuntimeException } from '#/util/JavaException';
import { arrayAtB64, arrayPutB64, requireNonNull } from '#/util/JavaArray';
import WrappedException from '#/util/WrappedException';
import { intDivide } from '#/util/IntUtils';
import type Client from './Client';
import type JagString from '#/datastruct/JagString';
import type { JagStringApplet } from '#/datastruct/JagString';
import JavaUrl from '#/io/JavaUrl';
import { browserStandaloneHost, type StandaloneFrame, type StandaloneHost } from './StandaloneFrame';
import { BrowserProgressCanvas, type ProgressCanvas, type ProgressFont, type ProgressFontMetrics, type ProgressImage } from './AwtProgressCanvas';
import Pix2D from '#/graphics/Pix2D';
import Pix3D from '#/dash3d/Pix3D';
import {
    loadBrowserControl,
    loadClient,
    loadGlRenderer,
    loadLocalisedText,
    loadLocType,
    loadMinimenu,
    loadModelLitImpl,
    loadPreferences,
    loadQuickChatPhraseType,
    loadTextureCache,
    loadTitleScreen,
    loadWorld,
    loadWorldMap
} from '#/util/GamepackClasses';

export interface ShellContainer {
    getSize(): { width: number; height: number };
    getGraphics?(): { fillBlackRect(x: number, y: number, width: number, height: number): void } | null;
}
// The client and its enclosing applet shell have separate singleton slots.
export const gameClient: { instance: Client | null } = { instance: null };
export interface ShellFrame extends ShellContainer {
    getInsets(): { left: number; right: number; top: number; bottom: number };
    isVisible?(): boolean;
}
export interface AppletContext {
    showDocument(url: JavaUrl, target: string): void;
}

export default abstract class GameShell {
    // HD rc.a(I)V
    static releaseGameShellStatics(guard: number): void {
        try {
            if (guard < 15) {
                const WorldMap = loadWorldMap();
                WorldMap.completeLabel(null, true);
            }
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'frenchLoggedOut');
            const Client = loadClient();
            releaseReferences(Client, 'emptyString', 'rectDebugCommand');
            const QuickChatPhraseType = loadQuickChatPhraseType();
            releaseReferences(QuickChatPhraseType, 'placeholder');
            releaseReferences(LocalisedText, 'englishIgnoreFirst', 'ignoreFirst');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'rc.W(' + guard + ')');
        }
    }

    static standaloneHost: StandaloneHost = browserStandaloneHost;
    protected signlinkHost: SignlinkHost = {};
    private errorShown = false; // p.o:Z
    static m_reloadCount = 0; // lc.x:I

    // p.<init>()V
    constructor() {}

    // p.init()V
    abstract init(): Promise<void>;

    // p.providesignlink(Lfb;)V
    static providesignlink(link: Signlink | null): void {
        GameShell.signlink = link;
        GameShell.errorSignlink = link;
    }

    // java.applet.Applet.getParameter at the browser launcher boundary.
    protected appletParameter(name: string): string | null {
        return new URLSearchParams(globalThis.location?.search).get(name);
    }

    // p.getParameter(Ljava/lang/String;)Ljava/lang/String;
    getParameter(name: string): string | null {
        try {
            if (GameShell.frame !== null) return null;
            if (GameShell.signlink !== null && requireNonNull(GameShell.signlink).applet !== this) {
                const applet = requireNonNull(GameShell.signlink).applet as { getParameter(name: string): string | null } | null;
                return requireNonNull(applet).getParameter(name);
            }
            return this.appletParameter(name);
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, (glJar ? 'rc.getParameter(' : 'p.getParameter(') + (name !== null ? '{...}' : 'null') + ')');
        }
    }

    // p.getDocumentBase()Ljava/net/URL;
    getDocumentBase(): JavaUrl | null {
        try {
            if (GameShell.frame !== null) return null;
            if (GameShell.signlink !== null && this !== requireNonNull(GameShell.signlink).applet) {
                const applet = requireNonNull(GameShell.signlink).applet as { getDocumentBase(): JavaUrl | null } | null;
                return requireNonNull(applet).getDocumentBase();
            }
            return JavaUrl.parse(location.href);
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, glJar ? 'rc.getDocumentBase()' : 'p.getDocumentBase()');
        }
    }

    // p.f(I)Z
    CheckHost(): boolean {
        try {
            let host = requireNonNull(this.getDocumentBase()).getHost().toLowerCase();
            if (host === 'jagex.com' || host.endsWith('.jagex.com')) return true;
            if (host === 'runescape.com' || host.endsWith('.runescape.com')) return true;
            if (host.endsWith('127.0.0.1')) return true;
            while (host.length > 0 && host.charCodeAt(host.length - 1) >= 48 && host.charCodeAt(host.length - 1) <= 57) {
                host = host.substring(0, host.length - 1);
            }
            if (host.endsWith('192.168.1.')) return true;
            this.ShowError('invalidhost');
            return false;
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, glJar ? 'rc.T(27496)' : 'p.D(8)');
        }
    }

    // p.a(ILjava/lang/String;)V
    ShowError(reason: string): void {
        if (this.errorShown) return;
        this.errorShown = true;
        console.log('error_game_' + reason);
        try {
            const ctx = this.getAppletContext();
            const url = JavaUrl.parse('error_game_' + reason + '.ws', this.getCodeBase());
            requireNonNull(ctx).showDocument(url, '_top');
        } catch (err) {
            if (err instanceof JavaError) throw err;
        }
    }

    protected createStandaloneFrame(): StandaloneFrame {
        return GameShell.standaloneHost.createFrame();
    }

    // p.a(IIIILjava/lang/String;IZI)V. SD fb discards cache mode, game name and archive count.
    async StartStandalone(width: number, _cacheMode: number, _archives: number, revision: number, _game: string, height: number): Promise<void> {
        try {
            GameShell.leftMargin = 0;
            GameShell.topMargin = 0;
            clientErrorHost.revision = revision;
            GameShell.m_sHei = height;
            GameShell.m_frameHeight = height;
            GameShell.m_activeShell = this;
            GameShell.m_sWid = width;
            GameShell.m_frameWidth = width;
            const frame = (GameShell.frame = this.createStandaloneFrame());
            frame.setTitle('Jagex');
            frame.setResizable(true);
            frame.addWindowListener(this);
            frame.setVisible(true);
            frame.toFront();
            const insets = frame.getInsets();
            frame.setSize((insets.right + insets.left + GameShell.m_frameWidth) | 0, (insets.bottom + GameShell.m_frameHeight + insets.top) | 0);
            GameShell.errorSignlink = GameShell.signlink = new Signlink(null, this.signlinkHost);
            const task = GameShell.signlink.startThread(this, 1);
            while (task.status === 0) await ThreadUtils.sleep(10n);
            if (glJar) GameShell.gameThread = task.result;
        } catch (error) {
            if (!(error instanceof Error) || error instanceof JavaError) throw error;
            await reportClientError(error, null);
        }
    }

    // p.a(IIIII)V. The SD Signlink constructor discards the cache mode argument.
    async StartApp(width: number, _cacheMode: number, revision: number, height: number): Promise<void> {
        try {
            if (GameShell.m_activeShell !== null) {
                GameShell.m_reloadCount = (GameShell.m_reloadCount + 1) | 0;
                if (GameShell.m_reloadCount >= 3) this.ShowError('alreadyloaded');
                else {
                    const ctx = this.getAppletContext();
                    const doc = this.getDocumentBase();
                    requireNonNull(ctx).showDocument(requireNonNull(doc), '_self');
                }
            } else {
                clientErrorHost.revision = revision;
                GameShell.m_sHei = height;
                GameShell.m_frameHeight = height;
                GameShell.leftMargin = 0;
                GameShell.m_activeShell = this;
                GameShell.topMargin = 0;
                GameShell.m_sWid = width;
                GameShell.m_frameWidth = width;
                const openwinjs = this.getParameter('openwinjs');
                if (glJar) GameShell.openWindowJs = openwinjs === '1';
                if (GameShell.signlink === null) GameShell.errorSignlink = GameShell.signlink = new Signlink(this, this.signlinkHost);
                const task = GameShell.signlink.startThread(this, 1);
                while (task.status === 0) await ThreadUtils.sleep(10n);
                if (glJar) GameShell.gameThread = task.result;
            }
        } catch (err) {
            if (!(err instanceof Error) || err instanceof JavaError) throw err;
            await reportClientError(err, null);
            this.ShowError('crash');
        }
    }

    // p.getCodeBase()Ljava/net/URL;
    getCodeBase(): JavaUrl | null {
        if (GameShell.frame !== null) return null;
        const link = GameShell.signlink;
        if (link !== null && link.applet !== this) return requireNonNull(link.applet as { getCodeBase(): JavaUrl | null } | null).getCodeBase();
        return JavaUrl.parse(new URL('.', location.href).href);
    }

    // p.getAppletContext()Ljava/applet/AppletContext;
    getAppletContext(): AppletContext | null {
        try {
            if (GameShell.frame !== null) return null;
            const link = GameShell.signlink;
            if (link !== null && link.applet !== this) return requireNonNull(link.applet as { getAppletContext(): AppletContext | null } | null).getAppletContext();
            return { showDocument: (url, target) => window.open(url.toString(), target) };
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, glJar ? 'rc.getAppletContext()' : 'p.getAppletContext()');
        }
    }

    // SD nl.a(ZBLid;)V, HD nf.a(Lna;BZ)V.
    static openUrl(newWindow: boolean, address: JagString | null): void {
        if (glJar && newWindow && loadGlRenderer().active && GameShell.openWindowJs) {
            try {
                const bridge = requireNonNull(GameShell.signlink).applet as Pick<JagStringApplet, 'call'> | null;
                const base = requireNonNull(GameShell.m_activeShell).getCodeBase();
                const url = requireNonNull(address).resolveUrl(base).toString();
                loadBrowserControl().callWithArgs(bridge, 'openjs', [url], 117);
                return;
            } catch {
                // nf.a catches Throwable from LiveConnect before trying the applet context.
            }
        }
        try {
            const context = requireNonNull(GameShell.m_activeShell).getAppletContext();
            const base = requireNonNull(GameShell.m_activeShell).getCodeBase();
            const url = requireNonNull(address).resolveUrl(base);
            requireNonNull(context).showDocument(url, newWindow ? '_blank' : '_top');
        } catch (error) {
            if (glJar && error instanceof JavaError) throw error;
        }
    }
    static m_activeShell: GameShell | null = null; // jg.k:Lp;
    static frame: ShellFrame | null = null; // tb.h:Ljava/awt/Frame;
    static fullScreenFrame: ShellFrame | null = null; // aj.kb:Ljava/awt/Frame;
    static resizable = false; // HD jk.y:Z
    static openWindowJs = false; // HD da.M:Z
    static glLibraryLoaded = false; // HD rc.M:Z
    static gameThread: SignlinkThread | null = null; // HD cm.b:Ljava/lang/Thread;
    static m_frameWidth = 0; // vk.rb:I
    static m_frameHeight = 0; // oh.j:I
    static m_sWid = 0; // hi.f:I
    static m_sHei = 0; // fl.l:I
    static leftMargin = 0; // pa.rb:I
    static topMargin = 0; // sk.N:I
    static canvasInvalid = false; // wd.b:Z
    static canvasSetTime = 0n; // vc.P:J
    static java5OrLater = false; // hd.o:Z
    static m_shutdown = false; // g.r:Z
    static signlink: Signlink | null = null; // tj.m:Lfb;
    static errorSignlink: Signlink | null = null; // ca.l:Lfb;
    static canvas: object | null = null; // pe.S:Ljava/awt/Canvas;
    static drawArea: PixScreen | null = null; // rg.s:Loh;
    static maxMemory = 64; // te.e:I
    static timer: Timer | null = null; // gh.X:Le;
    static m_minDel = 1; // ak.i:I
    static m_delTime = 20; // hf.B:I
    static m_updateCount = 0; // mg.T:I
    static m_killTime = 0n; // tj.a:J
    static readonly m_drawTime = new BigInt64Array(32); // ab.T:[J
    static readonly m_updateTime = new BigInt64Array(32); // tj.c:[J
    static m_drawPos = 0; // ca.c:I
    static m_updatePos = 0; // ef.A:I
    static m_fps = 0; // dd.a:I
    private static stressFrames: BrowserStressFrames | null = null;

    static get stressFrame(): BrowserStressFrames['render'] | null {
        return GameShell.stressFrames?.render ?? null;
    }

    static set stressFrame(render: BrowserStressFrames['render'] | null) {
        if (render === GameShell.stressFrame) return;
        GameShell.stressFrames?.close();
        GameShell.stressFrames = render === null ? null : new BrowserStressFrames(render);
    }

    static get displayPaced(): boolean {
        return GameShell.stressFrames?.displayPaced ?? false;
    }

    static get stressRenderFps(): number {
        return GameShell.stressFrames?.fps ?? 0;
    }

    static get stressExtraFrames(): number {
        return GameShell.stressFrames?.extraFrames ?? 0;
    }
    static m_fullRedrawForce = 500; // ka.k:I
    static fullRedraw = true; // hi.g:Z
    static m_focusIn = true; // qd.u:Z
    static m_focus = false; // wg.g:Z
    static progressTitle: JagString | null = null; // tk.h:Lid;
    static progressImage: ProgressImage | null = null; // ci.h:Ljava/awt/Image;
    static progressFont: ProgressFont | null = null; // wj.f:Ljava/awt/Font;
    static progressFontMetrics: ProgressFontMetrics | null = null; // wg.a:Ljava/awt/FontMetrics;

    // t.a(IZLid;BLjava/awt/Color;)V
    static drawProgress(percent: number, clear: boolean, message: JagString | null, colour: number | null): void {
        const element = requireNonNull(GameShell.canvas);
        let canvas: ProgressCanvas;
        if ('getGraphics' in element) {
            canvas = element as ProgressCanvas;
        } else {
            canvas = new BrowserProgressCanvas(element as HTMLCanvasElement, () => {
                GameShell.fullRedraw = true;
            });
        }
        try {
            const screen = canvas.getGraphics();
            if (GameShell.progressFont === null) {
                GameShell.progressFont = { family: 'Helvetica', bold: true, size: 13 };
                GameShell.progressFontMetrics = canvas.getFontMetrics(GameShell.progressFont);
            }
            if (clear) {
                screen.setColor(0);
                screen.fillRect(0, 0, GameShell.m_sWid, GameShell.m_sHei);
            }
            if (colour === null) colour = 0x8c1111;
            try {
                if (GameShell.progressImage === null) GameShell.progressImage = canvas.createImage(304, 34);
                const bar = requireNonNull(GameShell.progressImage).getGraphics();
                bar.setColor(colour);
                bar.drawRect(0, 0, 303, 33);
                bar.fillRect(2, 2, Math.imul(3, percent), 30);
                bar.setColor(0);
                bar.drawRect(1, 1, 301, 31);
                bar.fillRect((Math.imul(3, percent) + 2) | 0, 2, (300 - Math.imul(3, percent)) | 0, 30);
                bar.setFont(GameShell.progressFont);
                bar.setColor(0xffffff);
                requireNonNull(message).draw(intDivide((304 - requireNonNull(message).measure(GameShell.progressFontMetrics)) | 0, 2), bar, 22);
                screen.drawImage(requireNonNull(GameShell.progressImage), intDivide(GameShell.m_sWid, 2) - 152, intDivide(GameShell.m_sHei, 2) - 18);
            } catch (err) {
                if (err instanceof JavaError) throw err;
                const x = intDivide(GameShell.m_sWid, 2) - 152;
                const y = intDivide(GameShell.m_sHei, 2) - 18;
                screen.setColor(colour);
                screen.drawRect(x, y, 303, 33);
                screen.fillRect(x + 2, y + 2, Math.imul(3, percent), 30);
                screen.setColor(0);
                screen.drawRect(x + 1, y + 1, 301, 31);
                screen.fillRect((Math.imul(percent, 3) + 2 + x) | 0, y + 2, (300 - Math.imul(3, percent)) | 0, 30);
                screen.setFont(GameShell.progressFont);
                screen.setColor(0xffffff);
                requireNonNull(message).draw((x + intDivide((304 - requireNonNull(message).measure(GameShell.progressFontMetrics)) | 0, 2)) | 0, screen, y + 22);
            }
            if (GameShell.progressTitle !== null) {
                screen.setFont(GameShell.progressFont);
                screen.setColor(0xffffff);
                GameShell.progressTitle.draw((intDivide(GameShell.m_sWid, 2) - intDivide(GameShell.progressTitle.measure(GameShell.progressFontMetrics), 2)) | 0, screen, intDivide(GameShell.m_sHei, 2) - 26);
            }
        } catch (err) {
            if (err instanceof JavaError) throw err;
            canvas.repaint();
        }
    }

    // wi.a(I)V. jag::oldscape::javapal::GameShell::ShowBasicPercentTidy.
    static ShowBasicPercentTidy(): void {
        GameShell.progressFontMetrics = null;
        GameShell.progressImage = null;
        GameShell.progressFont = null;
    }

    protected closed = false;

    // p.a(I)V
    protected abstract MainLoop(): Promise<void>;
    // p.d(I)V
    protected abstract MainRedraw(): void | Promise<void>;
    // p.b(B)V
    protected abstract MainInit(): Promise<void>;
    // p.c(I)V
    protected abstract MainQuit(): Promise<void>;
    // p.a(Z)V
    protected abstract releaseStatics(): void;
    protected abstract mountCanvas(): AwtComponent;
    protected abstract removeCanvas(): void;
    protected abstract refreshCanvas(): void;

    // SD he.a(IIIIZZI)V / HD pm.a(ZIZIZII)V. ES modules and the browser host can suspend the game thread.
    static applyWindowMode(mode: number, height: number, previous: number, rebuild: boolean, replaceCanvas: boolean, width: number): void | Promise<void> {
        return runToCompletion(
            (function* (): Generator<Promise<unknown>, void, void> {
                try {
                    const renderer = glJar ? loadGlRenderer() : null;
                    const preferences = loadPreferences();
                    if (renderer !== null && previous === 0 && (mode !== 0 || replaceCanvas)) {
                        const leave = gameClient.instance?.leaveSdDisplay?.();
                        if (leave) yield leave;
                    }
                    if (renderer !== null) {
                        if (rebuild) renderer.shutdown();
                        if (GameShell.fullScreenFrame !== null && (mode !== 3 || height !== preferences.fullscreenWidth || width !== preferences.fullscreenHeight)) {
                            yield GameShell.exitFullscreen(GameShell.fullScreenFrame, GameShell.signlink);
                            GameShell.fullScreenFrame = null;
                        }
                        if (mode === 3 && GameShell.fullScreenFrame === null) {
                            const result = GameShell.enterFullscreen(width, height, GameShell.signlink);
                            if (result === null) GameShell.fullScreenFrame = null;
                            else
                                yield result.then(frame => {
                                    GameShell.fullScreenFrame = frame;
                                });
                            if (GameShell.fullScreenFrame !== null) {
                                preferences.fullscreenHeight = width;
                                preferences.fullscreenWidth = height;
                                preferences.write(GameShell.signlink);
                            }
                        }
                    }
                    if (mode === 3 && (renderer === null || GameShell.fullScreenFrame === null)) {
                        const fallback = GameShell.applyWindowMode(requireNonNull(gameClient.instance).preferredWindowMode, -1, previous, true, true, -1);
                        if (fallback !== undefined) yield fallback;
                        return;
                    }
                    let container: ShellContainer | null;
                    if (GameShell.fullScreenFrame !== null) container = GameShell.fullScreenFrame;
                    else if (GameShell.frame !== null) container = GameShell.frame;
                    else container = requireNonNull(GameShell.signlink).applet as ShellContainer | null;
                    GameShell.m_frameWidth = requireNonNull(container).getSize().width;
                    GameShell.m_frameHeight = requireNonNull(container).getSize().height;
                    if (container === GameShell.frame) {
                        const insets = requireNonNull(GameShell.frame).getInsets();
                        GameShell.m_frameWidth = (GameShell.m_frameWidth - (insets.right + insets.left)) | 0;
                        GameShell.m_frameHeight = (GameShell.m_frameHeight - (insets.bottom + insets.top)) | 0;
                    }
                    if (glJar && mode < 2) {
                        GameShell.topMargin = 0;
                        GameShell.leftMargin = intDivide((GameShell.m_frameWidth - 765) | 0, 2);
                        GameShell.m_sWid = 765;
                        GameShell.m_sHei = 503;
                    } else if (glJar) {
                        GameShell.m_sWid = GameShell.m_frameWidth;
                        GameShell.m_sHei = GameShell.m_frameHeight;
                        GameShell.leftMargin = 0;
                        GameShell.topMargin = 0;
                    } else if (mode < 2) {
                        GameShell.topMargin = 0;
                        GameShell.m_sHei = 503;
                        GameShell.leftMargin = intDivide((GameShell.m_frameWidth - 765) | 0, 2);
                        GameShell.m_sWid = 765;
                    } else {
                        GameShell.m_sWid = GameShell.m_frameWidth;
                        GameShell.leftMargin = 0;
                        GameShell.topMargin = 0;
                        GameShell.m_sHei = GameShell.m_frameHeight;
                    }
                    const client = requireNonNull(gameClient.instance);
                    if (!replaceCanvas) {
                        if (renderer?.active) renderer.resize(GameShell.m_sWid, GameShell.m_sHei);
                        const canvas = GameShell.canvas;
                        const width = GameShell.m_sWid,
                            height = GameShell.m_sHei;
                        if ('setSize' in requireNonNull(canvas)) (canvas as { setSize(w: number, h: number): void }).setSize(width, height);
                        else client.setCanvasSize(width, height, canvas as HTMLCanvasElement);
                        const insets = container === GameShell.frame ? requireNonNull(GameShell.frame).getInsets() : null;
                        const target = GameShell.canvas;
                        const x = ((insets?.left ?? 0) + GameShell.leftMargin) | 0,
                            y = ((insets?.top ?? 0) + GameShell.topMargin) | 0;
                        if ('setLocation' in requireNonNull(target)) (target as { setLocation(x: number, y: number): void }).setLocation(x, y);
                        else client.setCanvasLocation(x, y, target as HTMLCanvasElement);
                    } else {
                        client.replaceGameCanvas();
                    }
                    if (renderer !== null) {
                        if (mode === 0 && previous > 0) {
                            renderer.resetCanvas(client.getGlCanvas(GameShell.canvas));
                            client.releaseGlCanvas();
                        }
                        if (rebuild && mode > 0) {
                            const canvas = requireNonNull(GameShell.canvas);
                            if ('setIgnoreRepaint' in canvas) (canvas as { setIgnoreRepaint(v: boolean): void }).setIgnoreRepaint(true);
                            if (!GameShell.glLibraryLoaded) {
                                const scene = loadWorld();
                                const raster = Pix2D;
                                const title = loadTitleScreen();
                                const text = loadLocalisedText();
                                const game = loadClient();
                                scene.ResetMap();
                                GameShell.drawArea = null;
                                const h = GameShell.m_sHei,
                                    w = GameShell.m_sWid;
                                yield PixScreen.create(h, client.getSoftwareCanvasComponent(GameShell.canvas), w).then(area => {
                                    GameShell.drawArea = area;
                                });
                                raster.cls();
                                if (game.gameState === 5) title.Draw(-1, game.fontBold12, true);
                                else game.MessageBox(text.loadingPleaseWait2, false, -20);
                                try {
                                    const graphics = requireNonNull(client.getSoftwareCanvasComponent(GameShell.canvas)).getGraphics();
                                    requireNonNull<PixScreen>(GameShell.drawArea).draw(0, 0, graphics);
                                } catch (error) {
                                    if (error instanceof JavaError) throw error;
                                }
                                GameShell.clearCanvasMargins();
                                if (previous !== 0) GameShell.drawArea = null;
                                else
                                    yield PixScreen.create(503, client.getSoftwareCanvasComponent(GameShell.canvas), 765).then(area => {
                                        GameShell.drawArea = area;
                                    });
                                const link = GameShell.signlink;
                                const clientClass = requireNonNull(gameClient.instance).constructor;
                                const request = requireNonNull(link).loadGlLibrary(clientClass);
                                while (request.status === 0) yield ThreadUtils.sleep(100n);
                                if (request.status === 1) GameShell.glLibraryLoaded = true;
                            }
                            if (GameShell.glLibraryLoaded) {
                                const canvas = GameShell.canvas;
                                const samples = Math.imul(2, preferences.graphics.currentAntiAliasingMode);
                                yield renderer.init(client.getGlCanvas(canvas), samples);
                                if (!renderer.active) client.releaseGlCanvas();
                            }
                        }
                    }
                    if (!renderer?.active && mode > 0) {
                        const fallback = GameShell.applyWindowMode(0, -1, previous, true, true, -1);
                        if (fallback !== undefined) yield fallback;
                        return;
                    }
                    if (renderer !== null) {
                        if (mode > 0 && previous === 0) {
                            requireNonNull(GameShell.gameThread).priority = 5;
                            GameShell.drawArea = null;
                            const model = loadModelLitImpl();
                            model.allocateGlScratch();
                            const pix3d = Pix3D;
                            const textures = loadTextureCache();
                            const provider = pix3d.textureProvider;
                            if (provider !== null && !(provider instanceof textures)) throw new TypeError('ClassCastException: expected TextureCache');
                            requireNonNull(provider).setCapacity(200);
                            if (preferences.graphics.highDetailLighting) pix3d.setBrightness(Math.fround(0.7));
                            const menu = loadMinimenu();
                            menu.clearSprites();
                        } else if (mode === 0 && previous > 0) {
                            requireNonNull(GameShell.gameThread).priority = 1;
                            yield PixScreen.create(503, client.getSoftwareCanvasComponent(GameShell.canvas), 765).then(area => {
                                GameShell.drawArea = area;
                            });
                            const model = loadModelLitImpl();
                            model.allocateSoftwareScratch();
                            // ga.b() is empty in runescape_gl.jar.
                            const pix3d = Pix3D;
                            const textures = loadTextureCache();
                            const provider = pix3d.textureProvider;
                            if (provider !== null && !(provider instanceof textures)) throw new TypeError('ClassCastException: expected TextureCache');
                            requireNonNull(provider).setCapacity(20);
                            if (preferences.graphics.highDetailLighting) {
                                if (preferences.brightness === 1) pix3d.setBrightness(Math.fround(0.9));
                                if (preferences.brightness === 2) pix3d.setBrightness(Math.fround(0.8));
                                if (preferences.brightness === 3) pix3d.setBrightness(Math.fround(0.7));
                                if (preferences.brightness === 4) pix3d.setBrightness(Math.fround(0.6));
                            }
                            // eslint-disable-next-line @typescript-eslint/no-require-imports -- HD hg stays deferred until he.a(IIIIZZI)V in GameShell.applyWindowMode.
                            const { default: terrain } = require('#/dash3d/TerrainBatch') as typeof import('#/dash3d/TerrainBatch');
                            terrain.unload();
                            const menu = loadMinimenu();
                            menu.clearSprites();
                        }
                        const locType = loadLocType();
                        locType.m_lowMem = !preferences.getAllLevelsVisible();
                        if (rebuild) {
                            const transition = client.reloadWindowResources();
                            if (transition !== undefined) yield transition;
                        }
                        GameShell.resizable = mode >= 2;
                        client.resizeInterfacesAndReport(false);
                    } else {
                        client.resizeInterfacesAndReport();
                    }
                    GameShell.fullRedraw = true;
                } catch (error) {
                    if (!isJavaRuntimeException(error)) throw error;
                    throw WrappedException.wrap(
                        error,
                        glJar
                            ? 'pm.F(' + replaceCanvas + ',' + mode + ',' + rebuild + ',' + previous + ',false,' + height + ',' + width + ')'
                            : 'he.A(' + mode + ',34,' + height + ',' + previous + ',' + rebuild + ',' + replaceCanvas + ',' + width + ')'
                    );
                }
            })()
        );
    }

    // c.a(Ljava/awt/Frame;ZLll;)V
    static async exitFullscreen(frame: ShellFrame | null, provider = GameShell.signlink): Promise<void> {
        try {
            const link = requireNonNull(provider);
            for (;;) {
                const task = link.exitFullscreen(frame);
                while (task.status === 0) await ThreadUtils.sleep(10n);
                if (task.status === 1) break;
                await ThreadUtils.sleep(100n);
            }
            const window = requireNonNull(frame) as ShellFrame & { setVisible(visible: boolean): void; dispose(): void };
            window.setVisible(false);
            window.dispose();
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'c.R(' + (frame === null ? 'null' : '{...}') + ',true,' + (provider === null ? 'null' : '{...}') + ')');
        }
    }

    // nf.a(2,0,0,height,width,ll). The shipped ll returns false before issuing any display requests.
    private static enterFullscreen(height: number, width: number, link: Signlink | null): null | Promise<ShellFrame | null> {
        let depth = 0;
        const failed = (error: unknown): never => {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'nf.D(2,0,' + depth + ',' + height + ',' + width + ',' + (link === null ? 'null' : '{...}') + ')');
        };
        try {
            const provider = requireNonNull(link);
            if (!provider.supportsFullscreen()) return null;
            return Promise.resolve(runToCompletion(DisplayMode.read(provider)))
                .then(async modes => {
                    let found = false;
                    for (const mode of modes) {
                        if (width !== mode.width || height !== mode.height || (found && mode.depth <= depth)) continue;
                        depth = mode.depth;
                        found = true;
                    }
                    if (!found) return null;
                    const task = provider.enterFullscreen(0, depth, height, width);
                    while (task.status === 0) await ThreadUtils.sleep(10n);
                    if (task.result === null) return null;
                    if (typeof task.result !== 'object' || !('getSize' in task.result)) throw new TypeError('ClassCastException: expected Frame');
                    const frame = task.result as ShellFrame;
                    if (task.status === 2) {
                        await GameShell.exitFullscreen(frame, provider);
                        return null;
                    }
                    return frame;
                })
                .catch(failed);
        } catch (error) {
            return failed(error);
        }
    }

    // SD bh.a(I)V / HD l.b(I)V
    static clearCanvasMargins(): void {
        const left = GameShell.leftMargin,
            top = GameShell.topMargin;
        const bottom = (GameShell.m_frameHeight - GameShell.m_sHei - top) | 0;
        const right = (GameShell.m_frameWidth - GameShell.m_sWid - left) | 0;
        if (left > 0 || right > 0 || top > 0 || bottom > 0) {
            try {
                const container = GameShell.fullScreenFrame ?? GameShell.frame ?? (requireNonNull(GameShell.signlink).applet as ShellContainer);
                let x = 0,
                    y = 0;
                if (container === GameShell.frame) {
                    const insets = GameShell.frame.getInsets();
                    x = insets.left;
                    y = insets.top;
                }
                const graphics = requireNonNull(container.getGraphics?.());
                if (left > 0) graphics.fillBlackRect(x, y, left, GameShell.m_frameHeight);
                if (top > 0) graphics.fillBlackRect(x, y, GameShell.m_frameWidth, top);
                if (right > 0) graphics.fillBlackRect((x + GameShell.m_frameWidth - right) | 0, y, right, GameShell.m_frameHeight);
                if (bottom > 0) graphics.fillBlackRect(x, (y + GameShell.m_frameHeight - bottom) | 0, GameShell.m_frameWidth, bottom);
            } catch (error) {
                if (error instanceof JavaError) throw error;
            }
        }
    }

    // qk.c(I)V. Runtime.maxMemory() reports a heap limit in bytes.
    static detectMaxMemory(): void {
        const memory = (globalThis.performance as Performance & { memory?: { jsHeapSizeLimit: number } })?.memory;
        if (memory && Number.isFinite(memory.jsHeapSizeLimit)) {
            this.maxMemory = (1 + ((memory.jsHeapSizeLimit / 1048576) | 0)) | 0;
        }
    }

    // SD ed.d(I)V, HD ta.a(Z)V
    static DoneSlowUpdate(): void {
        try {
            requireNonNull(GameShell.timer).reset();
            for (let i = 0; i < 32; i++) arrayPutB64(GameShell.m_drawTime, i, 0n);
            for (let i = 0; i < 32; i++) arrayPutB64(GameShell.m_updateTime, i, 0n);
            GameShell.m_updateCount = 0;
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, glJar ? 'ta.O(true)' : 'ed.A(28028)');
        }
    }

    // SD lg.c(II)V / HD ja.a(II)V.
    static SetFrameRate(rate: number, numerator = 1000): void {
        try {
            GameShell.m_delTime = intDivide(glJar ? numerator : 1000, rate);
        } catch (error) {
            if (!glJar || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'ja.D(' + rate + ',' + numerator + ')');
        }
    }

    // p.focusGained(Ljava/awt/event/FocusEvent;)V
    protected focusGained(): void {
        GameShell.m_focusIn = true;
        GameShell.fullRedraw = true;
    }

    // p.focusLost(Ljava/awt/event/FocusEvent;)V
    protected focusLost(): void {
        GameShell.m_focusIn = false;
    }

    // SD p.d(B)V, HD rc.b(Z)V
    private async MainLoopWrapper(): Promise<void> {
        try {
            const time = SafeTime.CurrentTimeMillis();
            // p.d reads the old sample even though the comparison result is discarded.
            arrayAtB64(GameShell.m_updateTime, GameShell.m_updatePos);
            arrayPutB64(GameShell.m_updateTime, GameShell.m_updatePos, time);
            GameShell.m_updatePos = (GameShell.m_updatePos + 1) & 31;
            GameShell.m_focus = GameShell.m_focusIn;
            await this.MainLoop();
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, glJar ? 'rc.R(true)' : 'p.M(85)');
        }
    }

    // SD p.e(I)V, HD rc.e(I)V
    private MainRedrawWrapper(): void | Promise<void> {
        try {
            const time = SafeTime.CurrentTimeMillis();
            const old = arrayAtB64(GameShell.m_drawTime, GameShell.m_drawPos);
            arrayPutB64(GameShell.m_drawTime, GameShell.m_drawPos, time);
            GameShell.m_drawPos = (GameShell.m_drawPos + 1) & 31;
            if (old !== 0n && old < time) {
                const elapsed = Number(BigInt.asIntN(32, time - old));
                GameShell.m_fps = intDivide(((elapsed >> 1) + 32000) | 0, elapsed);
            }
            const force = GameShell.m_fullRedrawForce;
            GameShell.m_fullRedrawForce = (force + 1) | 0;
            if (force > 50) {
                if (glJar) {
                    GameShell.fullRedraw = true;
                    GameShell.m_fullRedrawForce = (GameShell.m_fullRedrawForce - 50) | 0;
                } else {
                    GameShell.m_fullRedrawForce = (GameShell.m_fullRedrawForce - 50) | 0;
                    GameShell.fullRedraw = true;
                }
                this.refreshCanvas();
            }
            const draw = this.MainRedraw();
            if (draw !== undefined) return draw.catch(GameShell.rethrowRedraw);
        } catch (error) {
            GameShell.rethrowRedraw(error);
        }
    }

    private static rethrowRedraw(error: unknown): never {
        if (!isJavaRuntimeException(error)) throw error;
        throw WrappedException.wrap(error, glJar ? 'rc.AA(0)' : 'p.O(-10911)');
    }

    // p.c(B)V
    protected recreateCanvas(): AwtComponent {
        const component = this.mountCanvas();
        GameShell.m_focusIn = true;
        GameShell.m_focus = true;
        GameShell.fullRedraw = true;
        GameShell.canvasInvalid = false;
        GameShell.canvasSetTime = SafeTime.CurrentTimeMillis();
        return component;
    }

    // p.start()V
    start(): void {
        if (this === GameShell.m_activeShell && !GameShell.m_shutdown) GameShell.m_killTime = 0n;
    }

    // p.stop()V
    stop(): void {
        if (this === GameShell.m_activeShell && !GameShell.m_shutdown) {
            GameShell.m_killTime = BigInt.asIntN(64, SafeTime.CurrentTimeMillis() + 4000n);
        }
    }

    // SD p.paint(Ljava/awt/Graphics;)V / HD rc.paint(Ljava/awt/Graphics;)V
    paint(graphics: Pick<AwtGraphics, 'getClip'> | null): void {
        try {
            if (this === GameShell.m_activeShell && !GameShell.m_shutdown) {
                GameShell.fullRedraw = true;
                if (GameShell.java5OrLater && !(glJar && loadGlRenderer().active) && BigInt.asIntN(64, -GameShell.canvasSetTime + SafeTime.CurrentTimeMillis()) > 1000n) {
                    const clip = requireNonNull(graphics).getClip();
                    if (clip === null || (clip.width >= GameShell.m_frameWidth && clip.height >= GameShell.m_frameHeight)) {
                        GameShell.canvasInvalid = true;
                    }
                }
            }
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, (glJar ? 'rc.paint(' : 'p.paint(') + (graphics === null ? 'null)' : '{...})'));
        }
    }

    // p.update(Ljava/awt/Graphics;)V
    update(graphics: Pick<AwtGraphics, 'getClip'> | null): void {
        try {
            this.paint(graphics);
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, (glJar ? 'rc.update(' : 'p.update(') + (graphics === null ? 'null)' : '{...})'));
        }
    }

    // p.destroy()V
    async destroy(): Promise<void> {
        if (this === GameShell.m_activeShell && !GameShell.m_shutdown) {
            GameShell.m_killTime = SafeTime.CurrentTimeMillis();
            await ThreadUtils.sleep(5000n);
            GameShell.errorSignlink = null;
            await this.Shutdown(false);
        }
    }

    // p.windowClosing(Ljava/awt/event/WindowEvent;)V
    async windowClosing(): Promise<void> {
        await this.destroy();
    }

    // The other AWT window notifications only increment discarded counters.
    // p.windowOpened(Ljava/awt/event/WindowEvent;)V
    windowOpened(): void {}
    // p.windowClosed(Ljava/awt/event/WindowEvent;)V
    windowClosed(): void {}
    // p.windowIconified(Ljava/awt/event/WindowEvent;)V
    windowIconified(): void {}
    // p.windowDeiconified(Ljava/awt/event/WindowEvent;)V
    windowDeiconified(): void {}
    // p.windowActivated(Ljava/awt/event/WindowEvent;)V
    windowActivated(): void {}
    // p.windowDeactivated(Ljava/awt/event/WindowEvent;)V
    windowDeactivated(): void {}

    // p.a(IZ)V
    async Shutdown(clean: boolean): Promise<void> {
        try {
            if (GameShell.m_shutdown) return;
            GameShell.m_shutdown = true;
            this.closed = true;
            GameShell.stressFrame = null;
            if (requireNonNull(GameShell.signlink).applet !== null) {
                const applet = requireNonNull(requireNonNull(GameShell.signlink).applet) as { destroy(): void | Promise<void> };
                const pending = applet.destroy();
                if (pending instanceof Promise) await pending;
            }
            try {
                await this.MainQuit();
            } catch (err) {
                if (!(err instanceof Error) || err instanceof JavaError) throw err;
            }
            if (GameShell.canvas !== null) {
                try {
                    this.removeCanvas();
                } catch (err) {
                    if (!(err instanceof Error) || err instanceof JavaError) throw err;
                }
            }
            if (GameShell.signlink !== null) {
                try {
                    await requireNonNull(GameShell.signlink).stopWorker();
                } catch (err) {
                    if (!(err instanceof Error) || err instanceof JavaError) throw err;
                }
            }
            this.releaseStatics();
            if (GameShell.frame !== null) {
                try {
                    GameShell.standaloneHost.exit(0);
                    return;
                } catch {
                    // The original client ignores failures from this host operation.
                }
            }
            console.log('Shutdown complete - clean:' + clean);
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, glJar ? (clean ? 'rc.EA(107,true)' : 'rc.EA(46,false)') : 'p.G(-864,' + clean + ')');
        }
    }

    // p.run()V
    async run(): Promise<void> {
        try {
            if (Signlink.javaVendor !== null) {
                const vendor = requireNonNull(Signlink.javaVendor).toLowerCase();
                if (vendor.includes('sun') || vendor.includes('apple')) {
                    const v = requireNonNull(Signlink.javaVersion);
                    if (v === '1.1' || v.startsWith('1.1.') || v === '1.2' || v.startsWith('1.2.')) {
                        this.ShowError('wrongjava');
                        return;
                    }
                    GameShell.m_minDel = 5;
                } else if (vendor.includes('ibm') && (Signlink.javaVersion === null || requireNonNull(Signlink.javaVersion) === '1.4.2')) {
                    this.ShowError('wrongjava');
                    return;
                }
            }
            if (Signlink.javaVersion !== null && requireNonNull(Signlink.javaVersion).startsWith('1.')) {
                let minor = 0;
                for (let i = 2; i < requireNonNull(Signlink.javaVersion).length; i++) {
                    const version = requireNonNull(Signlink.javaVersion);
                    if (i >= version.length) throw new RangeError('String index ' + i);
                    const digit = version.charCodeAt(i) - 48;
                    if (digit < 0 || digit > 9) break;
                    minor = (Math.imul(minor, 10) + digit) | 0;
                }
                if (minor >= 5) GameShell.java5OrLater = true;
            }
            if (requireNonNull(GameShell.signlink).applet !== null) {
                const method = Signlink.setFocusCycleRoot as { invoke(owner: object | null, enabled: boolean): void } | null;
                if (method !== null) {
                    try {
                        method.invoke(requireNonNull(GameShell.signlink).applet, true);
                    } catch {
                        // The original client ignores failures from this host operation.
                    }
                }
            }
            GameShell.detectMaxMemory();
            const mounted = this.recreateCanvas();
            const height = GameShell.m_sHei;
            let canvas: object | null, width: number;
            if (glJar) {
                width = GameShell.m_sWid;
                canvas = GameShell.canvas;
            } else {
                canvas = GameShell.canvas;
                width = GameShell.m_sWid;
            }
            const component = canvas === null ? null : 'getGraphics' in canvas ? (canvas as AwtComponent) : mounted;
            if (!this.setInitialDrawArea(await PixScreen.create(height, component, width))) return;
            await this.MainInit();
            if (this.closed) return;
            GameShell.timer = await Timer.create();
            while (!this.closed && (GameShell.m_killTime === 0n || (glJar ? GameShell.m_killTime > SafeTime.CurrentTimeMillis() : SafeTime.CurrentTimeMillis() < GameShell.m_killTime))) {
                const ticks = GameShell.timer.wait(GameShell.m_minDel, GameShell.m_delTime);
                GameShell.m_updateCount = GameShell.stressFrames ? await GameShell.stressFrames.duringWait(ticks, GameShell.timer.browserWakeTime?.() ?? -Infinity) : await ticks;
                if (this.closed) return;
                for (let i = 0; i < GameShell.m_updateCount; i++) {
                    await this.MainLoopWrapper();
                    if (this.closed) return;
                }
                const redraw = this.MainRedrawWrapper();
                if (redraw !== undefined) await redraw;
                GameShell.stressFrames?.recordFrame();
                if (glJar) {
                    const link = GameShell.signlink;
                    const canvas = GameShell.canvas;
                    await Signlink.flushEvents(canvas, requireNonNull(link));
                } else await Signlink.flushEvents(GameShell.canvas, requireNonNull(GameShell.signlink));
            }
        } catch (err) {
            if (!(err instanceof Error) || err instanceof JavaError) throw err;
            await reportClientError(err, null);
            this.ShowError('crash');
        }
        await this.Shutdown(true);
    }

    // The suspended frame loop must release its startup framebuffer after a mode switch.
    private setInitialDrawArea(area: PixScreen): boolean {
        if (this.closed) return false;
        GameShell.drawArea = area;
        return true;
    }
}
