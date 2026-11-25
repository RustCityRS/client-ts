import type ClientMouseListener from './ClientMouseListener';
import type { MouseEvent530, MouseSurface } from './ClientMouseListener';
import type { WheelListener, WheelSurface } from './MouseWheel';
import { canvasContentBounds } from './CanvasContentBounds';

export type TouchArea = 'scene' | 'interface' | 'other';
type CameraKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown';

export interface TouchControls {
    area(x: number, y: number): TouchArea;
    tap(x: number, y: number, clientX: number, clientY: number): void;
    cameraKey(code: CameraKey, down: boolean): void;
}

interface TouchContact {
    id: number;
    area: TouchArea;
    press: MouseEvent530;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    started: number;
    dragging: boolean;
    horizontal?: CameraKey;
    vertical?: CameraKey;
}

export default class BrowserMouseSurface implements MouseSurface, WheelSurface {
    private buttons?: AbortController;
    private motion?: AbortController;
    private focus?: AbortController;
    private wheel?: AbortController;

    private contact?: TouchContact;
    private releaseTap?: () => void;

    constructor(
        private readonly canvas: HTMLCanvasElement,
        private readonly touch: TouchControls,
        signal: AbortSignal
    ) {
        canvas.style.touchAction = 'pinch-zoom';
        signal.addEventListener(
            'abort',
            () => {
                this.removeMouseListener();
                this.removeMouseMotionListener();
                this.removeFocusListener();
                this.removeMouseWheelListener();
            },
            { once: true }
        );
    }

    private event(e: MouseEvent, secondary = e.button === 2 || e.metaKey): MouseEvent530 {
        const rect = canvasContentBounds(this.canvas);
        const x = (((e.clientX - rect.left) * this.canvas.width) / rect.width) | 0;
        const y = (((e.clientY - rect.top) * this.canvas.height) / rect.height) | 0;
        return {
            getX: () => x,
            getY: () => y,
            isMetaDown: () => secondary,
            getModifiers: () => e.buttons,
            isPopupTrigger: () => e.type === 'contextmenu',
            consume: () => e.preventDefault()
        };
    }

    private pointerDown(mouse: ClientMouseListener, e: PointerEvent): void {
        this.releaseTap?.();
        if (e.pointerType === 'mouse') {
            this.cancelTouch(mouse);
            mouse.mousePressed(this.event(e));
            return;
        }
        if (this.contact || !e.isPrimary) {
            // A second finger hands this gesture to the browser's pinch zoom.
            this.cancelTouch(mouse);
            return;
        }
        e.preventDefault();
        const event = this.event(e);
        mouse.mouseMoved(event);
        this.contact = { id: e.pointerId, area: this.touch.area(event.getX(), event.getY()), press: event, startX: e.screenX, startY: e.screenY, lastX: e.screenX, lastY: e.screenY, started: e.timeStamp, dragging: false };
    }

    private pan(touch: TouchContact, axis: 'horizontal' | 'vertical', key: CameraKey): void {
        const previous = touch[axis];
        if (previous === key) return;
        if (previous) this.touch.cameraKey(previous, false);
        this.touch.cameraKey(key, true);
        touch[axis] = key;
    }

    private pointerMove(mouse: ClientMouseListener, e: PointerEvent): void {
        const event = this.event(e);
        if (e.pointerType === 'mouse') {
            if (e.buttons === 0) mouse.mouseMoved(event);
            else mouse.mouseDragged(event);
            return;
        }
        const touch = this.contact;
        if (touch?.id !== e.pointerId) return;
        if (touch.dragging) {
            mouse.mouseDragged(event);
            return;
        }
        mouse.mouseMoved(event);
        const distance = Math.max(Math.abs(e.screenX - touch.startX), Math.abs(e.screenY - touch.startY));
        if (touch.area === 'scene' && distance > 20) {
            if (e.screenX !== touch.lastX) this.pan(touch, 'horizontal', e.screenX < touch.lastX ? 'ArrowRight' : 'ArrowLeft');
            if (e.screenY !== touch.lastY) this.pan(touch, 'vertical', e.screenY < touch.lastY ? 'ArrowDown' : 'ArrowUp');
        } else if (touch.area === 'interface' && distance > 5) {
            touch.dragging = true;
            // The 530 widget drag starts at the original slot, even if the first move crossed into its neighbour.
            mouse.mousePressed(touch.press);
        }
        touch.lastX = e.screenX;
        touch.lastY = e.screenY;
    }

    private cancelTouch(mouse: ClientMouseListener): void {
        const touch = this.contact;
        this.contact = undefined;
        if (touch?.horizontal) this.touch.cameraKey(touch.horizontal, false);
        if (touch?.vertical) this.touch.cameraKey(touch.vertical, false);
        if (touch?.dragging) mouse.focusLost();
    }

    private pointerUp(mouse: ClientMouseListener, e: PointerEvent): void {
        if (e.pointerType === 'mouse') {
            mouse.mouseReleased(this.event(e));
            return;
        }
        const touch = this.contact;
        if (touch?.id !== e.pointerId) return;
        const event = this.event(e, e.timeStamp - touch.started >= 500);
        mouse.mouseMoved(event);
        this.contact = undefined;
        if (touch.dragging) {
            mouse.mouseReleased(event);
        } else if (touch.horizontal || touch.vertical) {
            if (touch.horizontal) this.touch.cameraKey(touch.horizontal, false);
            if (touch.vertical) this.touch.cameraKey(touch.vertical, false);
        } else {
            mouse.mousePressed(event);
            // Keep a tap down across a 50 Hz game tick, as in the 274 client.
            const release = (): void => {
                window.clearTimeout(timer);
                this.releaseTap = undefined;
                mouse.mouseReleased(event);
            };
            const timer = window.setTimeout(release, 40);
            this.releaseTap = release;
            this.touch.tap(event.getX(), event.getY(), e.clientX, e.clientY);
        }
    }

    addMouseListener(mouse: ClientMouseListener | null): void {
        if (mouse === null) return;
        this.removeMouseListener();
        this.buttons = new AbortController();
        const options = { signal: this.buttons.signal };
        this.canvas.addEventListener(
            'pointerenter',
            e => {
                if (e.pointerType === 'mouse') mouse.mouseEntered(this.event(e));
            },
            options
        );
        this.canvas.addEventListener(
            'pointerleave',
            e => {
                if (e.pointerType === 'mouse') mouse.mouseExited();
            },
            options
        );
        this.canvas.addEventListener('pointerdown', e => this.pointerDown(mouse, e), options);
        window.addEventListener('pointerup', e => this.pointerUp(mouse, e), options);
        const cancel = (e: PointerEvent): void => {
            if (this.contact?.id === e.pointerId) this.cancelTouch(mouse);
        };
        this.canvas.addEventListener('pointercancel', cancel, options);
        this.canvas.addEventListener('lostpointercapture', cancel, options);
        this.canvas.addEventListener('touchend', e => e.preventDefault(), { ...options, passive: false });
        this.canvas.addEventListener('click', e => mouse.mouseClicked(this.event(e)), options);
        this.canvas.addEventListener('contextmenu', e => mouse.mouseClicked(this.event(e)), options);
        const reset = (): void => {
            this.cancelTouch(mouse);
            this.releaseTap?.();
        };
        window.addEventListener('blur', reset, options);
        options.signal.addEventListener('abort', reset, { once: true });
    }

    addMouseMotionListener(mouse: ClientMouseListener | null): void {
        if (mouse === null) return;
        this.motion = new AbortController();
        this.canvas.addEventListener('pointermove', e => this.pointerMove(mouse, e), { signal: this.motion.signal });
    }

    addFocusListener(mouse: ClientMouseListener | null): void {
        if (mouse === null) return;
        this.focus = new AbortController();
        const options = { signal: this.focus.signal };
        this.canvas.addEventListener('focus', () => mouse.focusGained(), options);
        this.canvas.addEventListener('blur', () => mouse.focusLost(), options);
        window.addEventListener('blur', () => mouse.focusLost(), options);
    }

    removeMouseListener(): void {
        this.buttons?.abort();
    }
    removeMouseMotionListener(): void {
        this.motion?.abort();
    }
    removeFocusListener(): void {
        this.focus?.abort();
    }

    addMouseWheelListener(listener: WheelListener): void {
        this.wheel = new AbortController();
        this.canvas.addEventListener(
            'wheel',
            e => {
                listener.mouseWheelMoved(Math.sign(e.deltaY));
                e.preventDefault();
            },
            { signal: this.wheel.signal, passive: false }
        );
    }

    removeMouseWheelListener(): void {
        this.wheel?.abort();
    }
}
