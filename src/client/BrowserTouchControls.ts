import type BrowserKeyboardSurface from '#/Keyboard';
import DelayedStateChange from '#/ui/DelayedStateChange';
import IfType from '#/ui/IfType';
import InterfaceList from '#/ui/InterfaceList';
import Minimenu from '#/ui/Minimenu';
import type { TouchArea, TouchControls } from './BrowserMouseSurface';
import Client from './Client';
import GameShell from './GameShell';

// In 530 the cache's client scripts own text entry and focus. A tap must open
// the browser keyboard during the user gesture, before the next script tick.
function textField(component: IfType): 'text' | 'password' | undefined {
    const click = component.onClick;
    if (click?.[0] === 1181 || click?.[0] === 1223) {
        const field = click[1];
        if (field === 2 || field === 4 || field === 5) return 'password';
        if (field === 1 || field === 3) return 'text';
    }
    switch (component.onKey?.[0]) {
        case 73: // chatdefault:input
        case 112: // chattop:mes_text2
        case 133: // report abuse
        case 574: // item search
        case 1382: // world map search
            return 'text';
    }
    const group = component.id >>> 16;
    const child = component.id & 0xffff;
    const widgets = IfType.m_list?.[group];
    if (group === 752 && child === 3 && widgets?.[5]?.onKey?.[0] === 112) return 'text';
    if (group === 137 && child === 8 && widgets?.[7]?.onKey?.[0] === 1048) return 'text';
    if (group === 137 && child === 14 && (widgets?.[13]?.onKey?.[0] === 1038 || widgets?.[13]?.onKey?.[0] === 1901)) return 'text';
}

export default class BrowserTouchControls implements TouchControls {
    private touched = false;
    private prompt = 0;
    private loginFocus: number | null = null;

    constructor(
        private readonly client: Client,
        private readonly keyboard: BrowserKeyboardSurface
    ) {}

    area(x: number, y: number): TouchArea {
        this.touched = true;
        if (Client.gameState === 10 && InterfaceList.top === 755) return 'interface';
        if (Client.gameState !== 30 || !this.client.ui || Minimenu.isOpen) return 'other';
        const mounts = InterfaceList.subInterfaces;
        // The fixed gameframe has one main modal slot. The resizable gameframe has two.
        if (InterfaceList.top === 548 && mounts.get(BigInt((548 << 16) | 11))) return 'interface';
        if (InterfaceList.top === 746 && (mounts.get(BigInt((746 << 16) | 5)) || mounts.get(BigInt((746 << 16) | 6)))) return 'interface';
        return this.client.ui.isSceneClick(x, y) ? 'scene' : 'interface';
    }

    tap(x: number, y: number, clientX: number, clientY: number): void {
        const view = this.client.ui?.view;
        if (view && !Minimenu.isOpen && (Client.gameState === 10 || Client.gameState === 30)) {
            view.setViewport(GameShell.m_sWid, GameShell.m_sHei);
            const hits = view.menuHits(x, y);
            for (let i = hits.length - 1; i >= 0; i--) {
                const field = textField(hits[i].component);
                if (field) {
                    this.loginFocus = Client.gameState === 10 ? DelayedStateChange.varcs[174] : null;
                    this.keyboard.showMobileKeyboard(clientX, clientY, field === 'password');
                    return;
                }
            }
        }
        this.loginFocus = null;
        this.keyboard.hideMobileKeyboard();
    }

    cameraKey(code: 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown', down: boolean): void {
        this.keyboard.cameraKey(code, down);
    }

    mouseDown(): void {
        if (!this.touched) return;
        this.touched = false;
        this.loginFocus = null;
        this.prompt = 0;
        this.keyboard.hideMobileKeyboard();
    }

    updatePrompt(): void {
        if (!this.touched) return;
        if (this.loginFocus !== null) {
            // The login script also changes fields on Tab and Enter.
            const focus = DelayedStateChange.varcs[174];
            if (Client.gameState !== 10 || (focus !== this.loginFocus && (focus < 1 || focus > 5))) {
                this.loginFocus = null;
                this.keyboard.hideMobileKeyboard();
            } else if (focus !== this.loginFocus) {
                this.loginFocus = focus;
                if (this.keyboard.isMobileKeyboardDisplayed()) this.keyboard.showMobileKeyboard(undefined, undefined, focus === 2 || focus === 4 || focus === 5);
            }
        }
        // The report-abuse and chat-dialog scripts set these varcs and install their key hooks together.
        let prompt = 0;
        if (Client.gameState === 30) {
            if (DelayedStateChange.varcs[11] === 1 && IfType.m_list?.[553]?.[15]?.onKey?.[0] === 133) prompt = -1;
            else if (IfType.m_list?.[752]?.[5]?.onKey?.[0] === 112) prompt = DelayedStateChange.varcs[5];
        }
        if (prompt === this.prompt) return;
        this.prompt = prompt;
        if (prompt) this.keyboard.showMobileKeyboard();
        else this.keyboard.hideMobileKeyboard();
    }
}
