import { releaseReferences } from '#/util/StaticReferences';
import { glJar } from '#/client/ClientVariant';
import { isJavaRuntimeException } from '#/util/JavaException';
import { requireNonNull } from '#/util/JavaArray';
import WrappedException from '#/util/WrappedException';
import { CanvasComponent, type AwtGraphics } from './PixScreen';
import { loadClient, loadCookieStatics, loadLocalisedText } from '#/util/GamepackClasses';

interface PaintTarget {
    paint(graphics: AwtGraphics | null): void;
    update(graphics: AwtGraphics | null): void;
}

export default class GameCanvas extends CanvasComponent {
    // HD tm.a(B)V
    static releaseHdStatics(guard: number): void {
        try {
            const CookieStatics = loadCookieStatics();
            releaseReferences(CookieStatics, 'expiredCookieSuffix');
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'frenchCancel', 'englishChatcol7');
            if (guard >= -69) {
                const Client = loadClient();
                Client.mouseTracked = false;
            }
            releaseReferences(LocalisedText, 'chatcol7', 'defaultChatcol7');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'tm.B(' + guard + ')');
        }
    }

    // ah.b:Ljava/awt/Component;
    private readonly component: PaintTarget | null;

    // ah.<init>(Ljava/awt/Component;)V
    constructor(component: PaintTarget | null) {
        super();
        this.component = component;
    }

    // ah.update(Ljava/awt/Graphics;)V
    update(graphics: AwtGraphics | null): void {
        try {
            requireNonNull(this.component).update(graphics);
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, (glJar ? 'tm.update(' : 'ah.update(') + (graphics !== null ? '{...}' : 'null') + ')');
        }
    }

    // ah.paint(Ljava/awt/Graphics;)V
    paint(graphics: AwtGraphics | null): void {
        try {
            requireNonNull(this.component).paint(graphics);
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, (glJar ? 'tm.paint(' : 'ah.paint(') + (graphics !== null ? '{...}' : 'null') + ')');
        }
    }
}
