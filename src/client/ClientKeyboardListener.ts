import { releaseReferences } from '#/util/StaticReferences';
import { glJar } from './ClientVariant';
import { isJavaRuntimeException } from '#/util/JavaException';
import WrappedException from '#/util/WrappedException';
import { arrayAtI32, arrayPutI32, arrayPutObj, requireNonNull } from '#/util/JavaArray';
import { loadClient, loadLocalisedText, loadMinimenu, loadMSITypeList, loadPlayerModel } from '#/util/GamepackClasses';

export interface AwtKeyEvent {
    getKeyCode(): number;
    getKeyChar(): number;
    getModifiers(): number;
    consume(): void;
}

export interface KeyboardSurface {
    setFocusTraversalKeysEnabled?(enabled: boolean): void;
    addKeyListener(keyboard: ClientKeyboardListener | null): void;
    addFocusListener(keyboard: ClientKeyboardListener | null): void;
    removeKeyListener(keyboard: ClientKeyboardListener | null): void;
    removeFocusListener(keyboard: ClientKeyboardListener | null): void;
}

// vb implements java.awt.event.KeyListener and FocusListener.
export default class ClientKeyboardListener {
    // HD uf.a(I)V
    static releaseHdStatics(guard: number): void {
        try {
            const PlayerModel = loadPlayerModel();
            releaseReferences(PlayerModel, 'modelCache2');
            const MSITypeList = loadMSITypeList();
            releaseReferences(MSITypeList, 'spritesArchive');
            if (guard <= 81) {
                return;
            }
            const Minimenu = loadMinimenu();
            releaseReferences(Minimenu, 'nullTargetVerb');
            const Client = loadClient();
            releaseReferences(Client, 'scrollbarSpriteName', 'niceNumberGreen');
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'frenchMoreOptions');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'uf.A(' + guard + ')');
        }
    }

    static instance: ClientKeyboardListener | null = new ClientKeyboardListener(); // li.t:Lvb;
    static readonly m_keycodeMap = Int32Array.of(
        // cf.m:[I
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        85,
        80,
        84,
        -1,
        91,
        -1,
        -1,
        -1,
        81,
        82,
        86,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        13,
        -1,
        -1,
        -1,
        -1,
        83,
        104,
        105,
        103,
        102,
        96,
        98,
        97,
        99,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        25,
        16,
        17,
        18,
        19,
        20,
        21,
        22,
        23,
        24,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        48,
        68,
        66,
        50,
        34,
        51,
        52,
        53,
        39,
        54,
        55,
        56,
        70,
        69,
        40,
        41,
        32,
        35,
        49,
        36,
        38,
        67,
        33,
        65,
        37,
        64,
        -1,
        -1,
        -1,
        -1,
        -1,
        228,
        231,
        227,
        233,
        224,
        219,
        225,
        230,
        226,
        232,
        89,
        87,
        -1,
        88,
        229,
        90,
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
        12,
        -1,
        -1,
        -1,
        101,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        100,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1,
        -1
    );
    static idleCycles = 0; // mi.A:I
    static readonly pressed = new Array<boolean>(112).fill(false); // ob.q:[Z
    static readonly changes = new Int32Array(128); // id.w:[I
    static changeWriter = 0; // fi.k:I
    static changeReader = 0; // tg.v:I
    static readonly eventCodes = new Int32Array(128); // ti.N:[I
    static readonly eventChars = new Int32Array(128); // ak.f:[I
    static eventWriter = 0; // ka.n:I
    static eventReader = 0; // g.s:I
    static eventLimit = 0; // ob.C:I
    static keyCode = 0; // ek.y:I
    static keyChar = 0; // mg.F:I
    static count = 0; // ok.D:I
    static readonly codes = new Int32Array(128); // sc.T:[I
    static readonly chars = new Int32Array(128); // hd.i:[I

    // vb.<init>()V
    constructor() {}

    // vb.keyReleased(Ljava/awt/event/KeyEvent;)V
    keyReleased(event: AwtKeyEvent): void {
        if (ClientKeyboardListener.instance !== null) {
            ClientKeyboardListener.idleCycles = 0;
            let key = event.getKeyCode();
            if (key < 0 || ClientKeyboardListener.m_keycodeMap.length <= key) key = -1;
            else key = arrayAtI32(ClientKeyboardListener.m_keycodeMap, key) & -129;
            if (ClientKeyboardListener.changeWriter >= 0 && key >= 0) {
                arrayPutI32(ClientKeyboardListener.changes, ClientKeyboardListener.changeWriter, ~key);
                ClientKeyboardListener.changeWriter = (ClientKeyboardListener.changeWriter + 1) & 127;
                if (ClientKeyboardListener.changeReader === ClientKeyboardListener.changeWriter) ClientKeyboardListener.changeWriter = -1;
            }
        }
        event.consume();
    }

    // vb.focusGained(Ljava/awt/event/FocusEvent;)V
    focusGained(): void {}

    // vb.keyPressed(Ljava/awt/event/KeyEvent;)V
    keyPressed(event: AwtKeyEvent): void {
        if (ClientKeyboardListener.instance !== null) {
            ClientKeyboardListener.idleCycles = 0;
            let key = event.getKeyCode();
            if (key < 0 || key >= ClientKeyboardListener.m_keycodeMap.length) key = -1;
            else {
                key = arrayAtI32(ClientKeyboardListener.m_keycodeMap, key);
                if ((key & 128) !== 0) key = -1;
            }
            if (ClientKeyboardListener.changeWriter >= 0 && key >= 0) {
                arrayPutI32(ClientKeyboardListener.changes, ClientKeyboardListener.changeWriter, key);
                ClientKeyboardListener.changeWriter = (ClientKeyboardListener.changeWriter + 1) & 127;
                if (ClientKeyboardListener.changeReader === ClientKeyboardListener.changeWriter) ClientKeyboardListener.changeWriter = -1;
            }
            if (key >= 0) {
                const next = (1 + ClientKeyboardListener.eventWriter) & 127;
                if (next !== ClientKeyboardListener.eventReader) {
                    arrayPutI32(ClientKeyboardListener.eventCodes, ClientKeyboardListener.eventWriter, key);
                    arrayPutI32(ClientKeyboardListener.eventChars, ClientKeyboardListener.eventWriter, -1);
                    ClientKeyboardListener.eventWriter = next;
                }
            }
            const modifiers = event.getModifiers();
            if ((modifiers & 10) !== 0 || key === 85 || key === 10) event.consume();
        }
    }

    // vb.focusLost(Ljava/awt/event/FocusEvent;)V
    focusLost(): void {
        if (ClientKeyboardListener.instance !== null) ClientKeyboardListener.changeWriter = -1;
    }

    // vb.keyTyped(Ljava/awt/event/KeyEvent;)V
    keyTyped(event: AwtKeyEvent): void {
        if (ClientKeyboardListener.instance !== null) {
            const key = ClientKeyboardListener.readChar(event);
            if (key >= 0) {
                const next = (ClientKeyboardListener.eventWriter + 1) & 127;
                if (ClientKeyboardListener.eventReader !== next) {
                    arrayPutI32(ClientKeyboardListener.eventCodes, ClientKeyboardListener.eventWriter, -1);
                    arrayPutI32(ClientKeyboardListener.eventChars, ClientKeyboardListener.eventWriter, key);
                    ClientKeyboardListener.eventWriter = next;
                }
            }
        }
        event.consume();
    }

    // r.a(Ljava/awt/event/KeyEvent;I)I
    static readChar(event: AwtKeyEvent): number {
        let value = event.getKeyChar();
        if (value === 8364) return 128;
        if (value <= 0 || value >= 256) value = -1;
        return value;
    }

    // fi.b(I)V. Signlink supplies the Java vendor and the available AWT focus method.
    static init(vendor: string, focusTraversal: boolean): void {
        if (!vendor.toLowerCase().includes('microsoft')) {
            this.m_keycodeMap[47] = 73;
            this.m_keycodeMap[92] = 74;
            this.m_keycodeMap[91] = 42;
            if (!focusTraversal) {
                this.m_keycodeMap[222] = 59;
                this.m_keycodeMap[192] = 58;
            } else {
                this.m_keycodeMap[222] = 58;
                this.m_keycodeMap[520] = 59;
                this.m_keycodeMap[192] = 28;
            }
            this.m_keycodeMap[61] = 27;
            this.m_keycodeMap[59] = 57;
            this.m_keycodeMap[93] = 43;
            this.m_keycodeMap[45] = 26;
            this.m_keycodeMap[46] = 72;
            this.m_keycodeMap[44] = 71;
        } else {
            this.m_keycodeMap[191] = 73;
            this.m_keycodeMap[220] = 74;
            this.m_keycodeMap[186] = 57;
            this.m_keycodeMap[222] = 59;
            this.m_keycodeMap[187] = 27;
            this.m_keycodeMap[190] = 72;
            this.m_keycodeMap[189] = 26;
            this.m_keycodeMap[223] = 28;
            this.m_keycodeMap[188] = 71;
            this.m_keycodeMap[219] = 42;
            this.m_keycodeMap[192] = 58;
            this.m_keycodeMap[221] = 43;
        }
    }

    // ng.b(Z)V
    static poll(): void {
        requireNonNull(this.instance);
        this.eventReader = this.eventLimit;
        this.idleCycles = (this.idleCycles + 1) | 0;
        if (this.changeWriter < 0) {
            for (let i = 0; i < 112; i++) arrayPutObj(this.pressed, i, false);
            this.changeWriter = this.changeReader;
        } else {
            while (this.changeReader !== this.changeWriter) {
                const change = arrayAtI32(this.changes, this.changeReader);
                this.changeReader = (1 + this.changeReader) & 127;
                if (change < 0) arrayPutObj(this.pressed, ~change, false);
                else arrayPutObj(this.pressed, change, true);
            }
        }
        this.eventLimit = this.eventWriter;
    }

    // id.c(Z)Z
    static next(): boolean {
        requireNonNull(this.instance);
        if (this.eventLimit !== this.eventReader) {
            this.keyCode = arrayAtI32(this.eventCodes, this.eventReader);
            this.keyChar = arrayAtI32(this.eventChars, this.eventReader);
            this.eventReader = (this.eventReader + 1) & 127;
            return true;
        }
        return false;
    }

    // pj.a(BLjava/awt/Component;)V
    static addListeners(surface: KeyboardSurface): void {
        try {
            surface.setFocusTraversalKeysEnabled?.(false);
        } catch {
            // The original client ignores failures from this host operation.
        }
        surface.addKeyListener(this.instance);
        surface.addFocusListener(this.instance);
    }
    // SD ea.a(ILjava/awt/Component;)V, HD ch.a(Ljava/awt/Component;I)V.
    static stop(writer: number, surface: KeyboardSurface): void {
        try {
            surface.removeKeyListener(this.instance);
            surface.removeFocusListener(this.instance);
            this.changeWriter = glJar ? -1 : writer;
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            const component = surface === null ? 'null' : '{...}';
            throw WrappedException.wrap(error, glJar ? 'ch.G(' + component + ',-9320)' : 'ea.C(' + writer + ',' + component + ')');
        }
    }
    // ed.b(I)V
    static dispose(): void {
        if (this.instance !== null) this.instance = null;
    }

    // c.a(I)I
    static getIdleCycles(): number {
        return this.idleCycles;
    }
}
