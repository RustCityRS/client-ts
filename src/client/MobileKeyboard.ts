import { canvasContentBounds } from './CanvasContentBounds';

// Revision 274's four keyboard pages, in row order.
const pages = [
    [...'qwertyuiopasdfghjkl', 'Shift', ...'zxcvbnm', 'Del', '123', ',', ' ', '.', 'Enter'],
    [...'QWERTYUIOPASDFGHJKL', 'Shift', ...'ZXCVBNM', 'Del', '123', ',', ' ', '.', 'Enter'],
    [...'1234567890!"$%_&*()', '1/2', ...'@=<>~;:', 'Del', 'abc', '#', ' ', '?', 'Enter'],
    [..."£^[]{}'-+/", '\\', '|', '', '', '', '', '', '', '', '2/2', '', '', '', '', '', '', '', 'Del', 'abc', '', ' ', '', 'Enter']
] as const;

const boxes = pages[0].map((_, i) => {
    const row = i < 10 ? 0 : i < 19 ? 1 : i < 28 ? 2 : 3;
    const column = i - [0, 10, 19, 28][row];
    return { x: 5 + (column + (row === 1 ? 0.5 : i > 30 ? 5 : 0)) * 50, y: 5 + row * 30, width: i === 30 ? 300 : 50 };
});

export default class MobileKeyboard {
    private element: HTMLCanvasElement | HTMLInputElement | null = null;
    private listeners?: AbortController;

    constructor(
        private readonly gameCanvas: HTMLCanvasElement,
        private readonly typeKey: (key: string) => void,
        private readonly keyDown: (event: KeyboardEvent) => void,
        private readonly keyUp: (event: KeyboardEvent) => void
    ) {}

    get displayed(): boolean {
        return this.element !== null && (!(this.element instanceof HTMLInputElement) || this.element === document.activeElement);
    }

    show(clientX?: number, clientY?: number, password = false): void {
        let mode: string | null = null;
        try {
            mode = localStorage.getItem('mobileKeyboardMode');
        } catch {
            // Embedded clients can lack access to local storage.
        }
        const canvasMode = mode === 'canvas' || (mode !== 'native' && document.fullscreenElement !== null);
        if (canvasMode && this.element instanceof HTMLCanvasElement) return;
        if (!canvasMode && this.element instanceof HTMLInputElement) {
            this.element.type = password ? 'password' : 'text';
            this.element.setAttribute('aria-label', password ? 'Game password' : 'Game text input');
            this.element.focus({ preventScroll: true });
            return;
        }
        this.hide();
        this.listeners = new AbortController();
        if (canvasMode) this.showCanvas(this.listeners.signal);
        else this.showNative(this.listeners.signal, clientX, clientY, password);
    }

    hide(): void {
        if (this.element === null) return;
        this.listeners?.abort();
        const focused = this.element === document.activeElement;
        this.element.remove();
        this.element = null;
        if (focused && this.gameCanvas.isConnected) this.gameCanvas.focus({ preventScroll: true });
    }

    private showNative(signal: AbortSignal, clientX?: number, clientY?: number, password = false): void {
        const input = document.createElement('input');
        this.element = input;
        input.type = password ? 'password' : 'text';
        input.tabIndex = -1;
        input.setAttribute('aria-label', password ? 'Game password' : 'Game text input');
        input.autocomplete = 'off';
        input.autocapitalize = 'off';
        input.setAttribute('autocorrect', 'off');
        input.spellcheck = false;
        input.style.cssText = 'position:fixed;width:1px;height:1px;padding:0;border:0;font-size:16px;opacity:0;pointer-events:none';
        input.style.left = (clientX ?? 0) + 'px';
        input.style.top = (clientY ?? 0) + 'px';
        // An editable character allows an IME to send Backspace even when the game already holds the text.
        const sentinel = '\u200b';
        input.value = sentinel;
        const reset = () => {
            input.value = sentinel;
            input.setSelectionRange(1, 1);
        };
        let composing = false;
        const commit = () => {
            const text = input.value.replace(sentinel, '');
            for (const key of text) this.typeKey(key);
            reset();
        };
        const held = new Set<string>();
        input.addEventListener(
            'keydown',
            event => {
                if (composing || event.isComposing || event.key === 'Unidentified' || event.key === 'Process' || event.key === 'Dead') return;
                if (event.keyCode === 229 && event.key !== 'Enter' && event.key !== 'Backspace') return;
                // Soft keyboards can deliver committed text only through input.
                if (!event.code && event.key.length === 1) return;
                held.add(event.code || event.key);
                this.keyDown(event);
            },
            { signal }
        );
        input.addEventListener(
            'keyup',
            event => {
                event.stopPropagation(); // The same release otherwise reaches the game's window listener twice.
                if (held.delete(event.code || event.key)) this.keyUp(event);
            },
            { signal }
        );
        input.addEventListener(
            'compositionstart',
            () => {
                composing = true;
            },
            { signal }
        );
        input.addEventListener(
            'compositionend',
            () => {
                composing = false;
                // Browsers differ in whether the final input arrives before or after compositionend.
                window.setTimeout(() => {
                    if (!signal.aborted && !composing && input.value !== sentinel) commit();
                }, 0);
            },
            { signal }
        );
        input.addEventListener(
            'input',
            event => {
                if (composing || (event as InputEvent).isComposing) return;
                const type = (event as InputEvent).inputType;
                if (type === 'deleteContentBackward' || type === 'deleteContentForward') {
                    this.typeKey(type === 'deleteContentBackward' ? 'Backspace' : 'Delete');
                    reset();
                } else if (type === 'insertLineBreak' || type === 'insertParagraph') {
                    this.typeKey('Enter');
                    reset();
                } else {
                    commit();
                }
            },
            { signal }
        );
        document.body.append(input);
        input.focus({ preventScroll: true });
        reset();
    }

    private showCanvas(signal: AbortSignal): void {
        const overlay = document.createElement('canvas');
        this.element = overlay;
        overlay.width = 510;
        overlay.height = 130;
        overlay.setAttribute('aria-label', 'Game keyboard');
        overlay.style.cssText = 'position:fixed;z-index:2147483647;touch-action:none;user-select:none';
        document.body.append(overlay);
        const ctx = overlay.getContext('2d');
        if (ctx === null) {
            this.hide();
            return;
        }
        let page = 0;
        let highlight = -1;
        let x: number | undefined;
        let y: number | undefined;
        const place = () => {
            const bounds = canvasContentBounds(this.gameCanvas);
            const left = Math.max(0, bounds.left);
            const top = Math.max(0, bounds.top);
            const right = Math.min(window.innerWidth, bounds.left + bounds.width);
            const bottom = Math.min(window.innerHeight, bounds.top + bounds.height);
            const scale = Math.max(0, Math.min(1, (right - left) / overlay.width, (bottom - top) / overlay.height));
            x = Math.max(left, Math.min(x ?? left, right - overlay.width * scale));
            y = Math.max(top, Math.min(y ?? bottom, bottom - overlay.height * scale));
            Object.assign(overlay.style, { left: x + 'px', top: y + 'px', width: overlay.width * scale + 'px', height: overlay.height * scale + 'px' });
        };
        const draw = () => {
            ctx.clearRect(0, 0, overlay.width, overlay.height);
            ctx.fillStyle = '#dadde2';
            ctx.beginPath();
            ctx.roundRect(0, 0, overlay.width, overlay.height, 5);
            ctx.fill();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            boxes.forEach((box, i) => {
                const label = pages[page][i];
                ctx.fillStyle = i === highlight ? '#a6a6a6' : label.length > 1 ? '#a9afba' : '#c8cdd1';
                ctx.beginPath();
                ctx.roundRect(box.x + 2, box.y + 2, box.width - 2, 28, 5);
                ctx.fill();
                ctx.fillStyle = 'black';
                ctx.font = (label.length > 1 ? '14px' : '16px') + ' Roboto, sans-serif';
                ctx.fillText(label, box.x + box.width / 2, box.y + 17);
            });
        };
        const keyAt = (event: PointerEvent) => {
            const rect = overlay.getBoundingClientRect();
            const px = ((event.clientX - rect.left) * overlay.width) / rect.width;
            const py = ((event.clientY - rect.top) * overlay.height) / rect.height;
            return boxes.findIndex(b => px >= b.x && px < b.x + b.width && py >= b.y && py < b.y + 30);
        };
        let pointer: number | null = null;
        let startX = 0,
            startY = 0,
            left = 0,
            top = 0,
            dragged = false;
        overlay.addEventListener(
            'pointerdown',
            event => {
                event.preventDefault();
                if (pointer !== null) return;
                pointer = event.pointerId;
                overlay.setPointerCapture(pointer);
                startX = event.clientX;
                startY = event.clientY;
                left = x ?? 0;
                top = y ?? 0;
                dragged = false;
                highlight = keyAt(event);
                draw();
            },
            { signal }
        );
        overlay.addEventListener(
            'pointermove',
            event => {
                if (event.pointerId !== pointer) return;
                const dx = event.clientX - startX;
                const dy = event.clientY - startY;
                if (!dragged && Math.max(Math.abs(dx), Math.abs(dy)) <= 5) return;
                dragged = true;
                highlight = -1;
                x = left + dx;
                y = top + dy;
                place();
                draw();
            },
            { signal }
        );
        overlay.addEventListener(
            'pointerup',
            event => {
                event.stopPropagation();
                if (event.pointerId !== pointer) return;
                const index = keyAt(event);
                const key = !dragged && index >= 0 && index === highlight ? pages[page][index] : '';
                if (key === 'Shift') page = page === 0 ? 1 : 0;
                else if (key === '123' || key === '2/2') page = 2;
                else if (key === '1/2') page = 3;
                else if (key === 'abc') page = 0;
                else if (key) this.typeKey(key === 'Del' ? 'Backspace' : key);
                pointer = null;
                highlight = -1;
                draw();
            },
            { signal }
        );
        overlay.addEventListener(
            'lostpointercapture',
            event => {
                if (event.pointerId !== pointer) return;
                pointer = null;
                highlight = -1;
                draw();
            },
            { signal }
        );
        overlay.addEventListener('contextmenu', event => event.preventDefault(), { signal });
        window.addEventListener('resize', place, { signal });
        place();
        draw();
    }
}
