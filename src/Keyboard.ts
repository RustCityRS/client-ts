import ClientKeyboardListener, { type AwtKeyEvent, type KeyboardSurface } from '#/client/ClientKeyboardListener';
import MobileKeyboard from '#/client/MobileKeyboard';

// Map DOM physical keys to java.awt.event.KeyEvent VK constants for a modern AWT runtime.
const virtualCodes: Readonly<Record<string, number>> = {
    Backspace: 8,
    Tab: 9,
    Enter: 10,
    NumpadEnter: 10,
    NumpadClear: 12,
    ShiftLeft: 16,
    ShiftRight: 16,
    ControlLeft: 17,
    ControlRight: 17,
    AltLeft: 18,
    AltRight: 18,
    Pause: 19,
    CapsLock: 20,
    Escape: 27,
    Space: 32,
    PageUp: 33,
    PageDown: 34,
    End: 35,
    Home: 36,
    ArrowLeft: 37,
    ArrowUp: 38,
    ArrowRight: 39,
    ArrowDown: 40,
    Comma: 44,
    Minus: 45,
    Period: 46,
    Slash: 47,
    Semicolon: 59,
    Equal: 61,
    BracketLeft: 91,
    Backslash: 92,
    BracketRight: 93,
    NumpadMultiply: 106,
    NumpadAdd: 107,
    NumpadComma: 108,
    NumpadSubtract: 109,
    NumpadDecimal: 110,
    NumpadDivide: 111,
    Delete: 127,
    NumLock: 144,
    ScrollLock: 145,
    PrintScreen: 154,
    Insert: 155,
    Help: 156,
    MetaLeft: 157,
    MetaRight: 157,
    Backquote: 192,
    Quote: 222,
    ContextMenu: 525,
    IntlBackslash: 520
};
export const pressedKeys = ClientKeyboardListener.pressed;

type CameraKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown';
const cameraKeys: ReadonlySet<string> = new Set<CameraKey>(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);

const punctuation: Readonly<Record<string, string>> = {
    ' ': 'Space',
    ',': 'Comma',
    '<': 'Comma',
    '.': 'Period',
    '>': 'Period',
    '/': 'Slash',
    '?': 'Slash',
    ':': 'Semicolon',
    ';': 'Semicolon',
    '"': 'Quote',
    "'": 'Quote',
    '[': 'BracketLeft',
    '{': 'BracketLeft',
    ']': 'BracketRight',
    '}': 'BracketRight',
    '-': 'Minus',
    _: 'Minus',
    '=': 'Equal',
    '+': 'Equal',
    '\\': 'Backslash',
    '|': 'Backslash',
    '~': 'Backquote',
    '`': 'Backquote'
};

function codeForKey(key: string): string {
    if (/^[a-zA-Z]$/.test(key)) return 'Key' + key.toUpperCase();
    if (/^[0-9]$/.test(key)) return 'Digit' + key;
    const shifted = ')!@#$%^&*('.indexOf(key);
    if (key.length === 1 && shifted !== -1) return 'Digit' + shifted;
    return punctuation[key] ?? key;
}

export function awtKeyCode(code: string): number {
    if (/^Key[A-Z]$/.test(code)) return code.charCodeAt(3);
    if (/^Digit[0-9]$/.test(code)) return code.charCodeAt(5);
    if (/^Numpad[0-9]$/.test(code)) return 96 + Number(code.slice(6));
    if (/^F([1-9]|1[0-2])$/.test(code)) return 111 + Number(code.slice(1));
    return virtualCodes[code] ?? -1;
}

export default class BrowserKeyboardSurface implements KeyboardSurface {
    private keyListener: ClientKeyboardListener | null = null;
    private focusListener: ClientKeyboardListener | null = null;
    private readonly options: AddEventListenerOptions;
    private readonly canvas: HTMLCanvasElement;
    private mobile?: MobileKeyboard;
    private readonly touchArrows = new Set<string>();
    private readonly physicalArrows = new Set<string>();
    constructor(canvas: HTMLCanvasElement, signal: AbortSignal) {
        this.canvas = canvas;
        this.options = { signal };
        signal.addEventListener(
            'abort',
            () => {
                this.lost();
                this.mobile?.hide();
            },
            { once: true }
        );
    }
    showMobileKeyboard(clientX?: number, clientY?: number, password = false): void {
        if (this.keyListener === null || this.options.signal?.aborted) return;
        this.mobile ??= new MobileKeyboard(
            this.canvas,
            key => {
                const init = { key, code: codeForKey(key) };
                this.down(new KeyboardEvent('keydown', init));
                this.up(new KeyboardEvent('keyup', init));
            },
            this.down,
            this.up
        );
        this.mobile.show(clientX, clientY, password);
    }
    hideMobileKeyboard(): void {
        this.mobile?.hide();
    }
    isMobileKeyboardDisplayed(): boolean {
        return this.mobile?.displayed ?? false;
    }
    cameraKey(code: CameraKey, down: boolean): void {
        const listener = this.keyListener;
        if (listener === null || this.touchArrows.has(code) === down) return;
        if (down) this.touchArrows.add(code);
        else this.touchArrows.delete(code);
        if (this.physicalArrows.has(code)) return;
        const event = this.event(new KeyboardEvent(down ? 'keydown' : 'keyup', { key: code, code }), 65535);
        if (down) listener.keyPressed(event);
        else listener.keyReleased(event);
    }
    private event(e: KeyboardEvent, char: number): AwtKeyEvent {
        return {
            getKeyCode: () => awtKeyCode(e.code || codeForKey(e.key)),
            getKeyChar: () => char,
            getModifiers: () => (e.shiftKey ? 1 : 0) | (e.ctrlKey ? 2 : 0) | (e.metaKey ? 4 : 0) | (e.altKey ? 8 : 0),
            consume: () => {
                if (!e.ctrlKey && !e.metaKey && e.key !== 'F12') e.preventDefault();
            }
        };
    }
    private readonly down = (e: KeyboardEvent): void => {
        const key = this.keyListener;
        if (key === null) return;
        const code = e.code || e.key;
        if (cameraKeys.has(code)) {
            this.physicalArrows.add(code);
            if (this.touchArrows.has(code) && !e.repeat) {
                e.preventDefault();
                return;
            }
        }
        key.keyPressed(this.event(e, 65535));
        if (e.isComposing) return;
        let char = e.key.length === 1 ? e.key.charCodeAt(0) : 65535;
        if (e.key === 'Enter') char = 10;
        else if (e.key === 'Backspace') char = 8;
        else if (e.key === 'Tab') char = 9;
        if (char !== 65535 && (!e.ctrlKey || e.getModifierState('AltGraph')) && !e.metaKey) key.keyTyped(this.event(e, char));
        if (awtKeyCode(e.code) !== -1 && !e.ctrlKey && !e.metaKey && e.key !== 'F12') e.preventDefault();
    };
    private readonly up = (e: KeyboardEvent): void => {
        const code = e.code || e.key;
        if (cameraKeys.has(code)) {
            this.physicalArrows.delete(code);
            if (this.touchArrows.has(code)) return;
        }
        this.keyListener?.keyReleased(this.event(e, 65535));
    };
    private readonly composed = (e: CompositionEvent): void => {
        const key = this.keyListener;
        if (key === null) return;
        for (let i = 0; i < e.data.length; i++) {
            const input = e.data.charCodeAt(i);
            key.keyTyped({ getKeyCode: () => 0, getKeyChar: () => input, getModifiers: () => 0, consume: () => {} });
        }
    };
    private readonly gained = (): void => {
        this.focusListener?.focusGained();
    };
    private readonly lost = (): void => {
        this.physicalArrows.clear();
        this.touchArrows.clear();
        this.focusListener?.focusLost();
    };

    // Focus traversal is suppressed on the canvas by the Tab key listener.
    setFocusTraversalKeysEnabled(_enabled: boolean): void {}
    addKeyListener(key: ClientKeyboardListener | null): void {
        this.keyListener = key;
        this.canvas.addEventListener('keydown', this.down, this.options);
        this.canvas.addEventListener('compositionend', this.composed, this.options);
        window.addEventListener('keyup', this.up, this.options);
    }
    addFocusListener(key: ClientKeyboardListener | null): void {
        this.focusListener = key;
        this.canvas.addEventListener('focus', this.gained, this.options);
        this.canvas.addEventListener('blur', this.lost, this.options);
        window.addEventListener('blur', this.lost, this.options);
    }
    removeKeyListener(_key: ClientKeyboardListener | null): void {
        this.mobile?.hide();
        this.physicalArrows.clear();
        this.touchArrows.clear();
        this.canvas.removeEventListener('keydown', this.down);
        this.canvas.removeEventListener('compositionend', this.composed);
        window.removeEventListener('keyup', this.up);
        this.keyListener = null;
    }
    removeFocusListener(_key: ClientKeyboardListener | null): void {
        this.canvas.removeEventListener('focus', this.gained);
        this.canvas.removeEventListener('blur', this.lost);
        window.removeEventListener('blur', this.lost);
        this.focusListener = null;
    }
}
