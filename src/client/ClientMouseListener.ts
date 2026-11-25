import { releaseReferences } from '#/util/StaticReferences';
import { isJavaRuntimeException } from '#/util/JavaException';
import WrappedException from '#/util/WrappedException';
import SafeTime from '#/io/SafeTime';
import { requireNonNull } from '#/util/JavaArray';
import { loadClientBuild, loadLocalisedText, loadMaterialManager } from '#/util/GamepackClasses';
import { glJar } from './ClientVariant';

export interface MouseEvent530 {
    getX(): number;
    getY(): number;
    isMetaDown(): boolean;
    getModifiers(): number;
    isPopupTrigger(): boolean;
    consume(): void;
}

export interface MouseSurface {
    addMouseListener(mouse: ClientMouseListener | null): void;
    addMouseMotionListener(mouse: ClientMouseListener | null): void;
    addFocusListener(mouse: ClientMouseListener | null): void;
    removeMouseListener(mouse: ClientMouseListener | null): void;
    removeMouseMotionListener(mouse: ClientMouseListener | null): void;
    removeFocusListener(mouse: ClientMouseListener | null): void;
}

export default class ClientMouseListener {
    // HD ug.a(Z)V
    static releaseHdStatics(guard: boolean): void {
        try {
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'germanChatcol5');
            const ClientBuild = loadClientBuild();
            releaseReferences(ClientBuild, 'm_comtot');
            if (!guard) {
                releaseReferences(ClientBuild, 'm_comtot');
            }
            const MaterialManager = loadMaterialManager();
            releaseReferences(MaterialManager, 'fogColour');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'ug.C(' + guard + ')');
        }
    }

    static instance: ClientMouseListener | null = new ClientMouseListener(); // ai.g:Luk;
    static volatileX = -1; // r.P:I
    static currentY = -1; // ha.d:I
    static currentButton = 0; // mg.S:I
    static nextClickButton = 0; // ob.Ib:I
    static nextClickX = 0; // je.ab:I
    static nextClickY = 0; // bi.j:I
    static nextClickTime = 0n; // tk.g:J
    static idleCycles = 0; // je.ib:I
    static mouseButton = 0; // ca.a:I
    static x = 0; // sj.C:I
    static mouseY = 0; // pf.Q:I
    static clickButton = 0; // oi.h:I
    static clickX = 0; // sa.x:I
    static clickY = 0; // oj.e:I
    static clickTime = 0n; // lc.v:J

    // uk.<init>()V
    constructor() {}

    // uk.focusGained(Ljava/awt/event/FocusEvent;)V
    focusGained(): void {}

    // uk.mouseExited(Ljava/awt/event/MouseEvent;)V
    mouseExited(): void {
        if (ClientMouseListener.instance !== null) {
            ClientMouseListener.idleCycles = 0;
            ClientMouseListener.volatileX = -1;
            ClientMouseListener.currentY = -1;
        }
    }

    // uk.mouseClicked(Ljava/awt/event/MouseEvent;)V
    mouseClicked(event: MouseEvent530): void {
        if (event.isPopupTrigger()) event.consume();
    }

    // uk.focusLost(Ljava/awt/event/FocusEvent;)V
    focusLost(): void {
        if (ClientMouseListener.instance !== null) ClientMouseListener.currentButton = 0;
    }

    // uk.mouseEntered(Ljava/awt/event/MouseEvent;)V
    mouseEntered(event: MouseEvent530): void {
        if (ClientMouseListener.instance !== null) {
            ClientMouseListener.idleCycles = 0;
            ClientMouseListener.volatileX = event.getX();
            ClientMouseListener.currentY = event.getY();
        }
    }

    // uk.mouseMoved(Ljava/awt/event/MouseEvent;)V
    mouseMoved(event: MouseEvent530): void {
        if (ClientMouseListener.instance !== null) {
            ClientMouseListener.idleCycles = 0;
            ClientMouseListener.volatileX = event.getX();
            ClientMouseListener.currentY = event.getY();
        }
    }

    // uk.mouseDragged(Ljava/awt/event/MouseEvent;)V
    mouseDragged(event: MouseEvent530): void {
        if (ClientMouseListener.instance !== null) {
            ClientMouseListener.idleCycles = 0;
            ClientMouseListener.volatileX = event.getX();
            ClientMouseListener.currentY = event.getY();
        }
    }

    // uk.mousePressed(Ljava/awt/event/MouseEvent;)V
    mousePressed(event: MouseEvent530): void {
        if (ClientMouseListener.instance !== null) {
            ClientMouseListener.idleCycles = 0;
            ClientMouseListener.nextClickX = event.getX();
            ClientMouseListener.nextClickY = event.getY();
            ClientMouseListener.nextClickTime = SafeTime.CurrentTimeMillis();
            if (!event.isMetaDown()) {
                ClientMouseListener.nextClickButton = 1;
                ClientMouseListener.currentButton = 1;
            } else {
                ClientMouseListener.nextClickButton = 2;
                ClientMouseListener.currentButton = 2;
            }
            event.getModifiers();
        }
        if (event.isPopupTrigger()) event.consume();
    }

    // uk.mouseReleased(Ljava/awt/event/MouseEvent;)V
    mouseReleased(event: MouseEvent530): void {
        if (ClientMouseListener.instance !== null) {
            ClientMouseListener.idleCycles = 0;
            ClientMouseListener.currentButton = 0;
            event.getModifiers();
        }
        if (event.isPopupTrigger()) event.consume();
    }

    // wk.a(B)V. Browser event callbacks and the polling body run on the same thread.
    static poll(): void {
        requireNonNull(ClientMouseListener.instance);
        ClientMouseListener.mouseButton = ClientMouseListener.currentButton;
        ClientMouseListener.x = ClientMouseListener.volatileX;
        ClientMouseListener.mouseY = ClientMouseListener.currentY;
        ClientMouseListener.idleCycles = (ClientMouseListener.idleCycles + 1) | 0;
        ClientMouseListener.clickButton = ClientMouseListener.nextClickButton;
        ClientMouseListener.clickX = ClientMouseListener.nextClickX;
        ClientMouseListener.clickY = ClientMouseListener.nextClickY;
        ClientMouseListener.clickTime = ClientMouseListener.nextClickTime;
        ClientMouseListener.nextClickButton = 0;
    }

    // pg.a(ILjava/awt/Component;)V
    static addListeners(surface: MouseSurface): void {
        surface.addMouseListener(ClientMouseListener.instance);
        surface.addMouseMotionListener(ClientMouseListener.instance);
        surface.addFocusListener(ClientMouseListener.instance);
    }

    // SD ke.a(Ljava/awt/Component;I)V / HD sc.a(ILjava/awt/Component;)V
    static stop(surface: MouseSurface, button: number): void {
        try {
            surface.removeMouseListener(ClientMouseListener.instance);
            surface.removeMouseMotionListener(ClientMouseListener.instance);
            surface.removeFocusListener(ClientMouseListener.instance);
            ClientMouseListener.currentButton = glJar ? 0 : button;
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            const target = surface === null ? 'null' : '{...}';
            throw WrappedException.wrap(error, glJar ? 'sc.M(4,' + target + ')' : 'ke.C(' + target + ',' + button + ')');
        }
    }

    // pf.e(I)I
    static getIdleCycles(): number {
        return ClientMouseListener.idleCycles;
    }

    // tf.a(II)V
    static setIdleCycles(value: number): void {
        requireNonNull(ClientMouseListener.instance);
        ClientMouseListener.idleCycles = value;
    }

    // ej.d(I)V
    static dispose(): void {
        if (ClientMouseListener.instance !== null) ClientMouseListener.instance = null;
    }
}
