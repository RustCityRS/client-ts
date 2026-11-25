import Client from '#/client/Client.js';
import Keyboard from '#/client/ClientKeyboardListener.js';
import Mouse from '#/client/ClientMouseListener.js';
import MouseWheel from '#/client/MouseWheel.js';
import type InterfaceSession from '#/ui/InterfaceSession.js';
import Minimenu from '#/ui/Minimenu.js';

interface InterfaceInput {
    x: number;
    y: number;
    held: boolean;
    control?: boolean;
    heldCodes?: ReadonlyArray<boolean>;
    button?: number;
    wheel?: number;
    menuOpen?: boolean;
    click?: { x: number; y: number };
    keys: { keyCode: number; keyChar: number }[];
}

// The original widget input pass reads the globals set by the mouse poll and keyboard collection.
export default class InterfaceInputFixture {
    private readonly previousClient = Client.activeClient;
    private readonly mouse = Object.getOwnPropertyDescriptors(Mouse);
    private readonly codes = Keyboard.codes.slice();
    private readonly chars = Keyboard.chars.slice();
    private readonly pressed = Keyboard.pressed.slice();
    private readonly keyCount = Keyboard.count;
    private readonly wheel = MouseWheel.rotation;
    private readonly menu = Minimenu.isOpen;

    private readonly cycle = Client.loopCycle;
    private readonly eventCodes = Keyboard.eventCodes.slice();
    private readonly eventChars = Keyboard.eventChars.slice();
    private readonly eventState = [Keyboard.eventReader, Keyboard.eventWriter, Keyboard.eventLimit, Keyboard.keyCode, Keyboard.keyChar];
    readonly client: Client;

    constructor(ui: InterfaceSession, client = new Client()) {
        this.client = client;
        client.ui = ui;
        Client.activeClient = client;
    }

    set(input: InterfaceInput): void {
        Mouse.x = input.x;
        Mouse.mouseY = input.y;
        Mouse.mouseButton = input.button ?? (input.held ? 1 : 0);
        Mouse.clickButton = input.click === undefined ? 0 : 1;
        if (input.click !== undefined) {
            Mouse.clickX = input.click.x;
            Mouse.clickY = input.click.y;
        }
        MouseWheel.rotation = input.wheel ?? 0;
        Minimenu.isOpen = input.menuOpen ?? false;
        for (let i = 0; i < Keyboard.pressed.length; i++) Keyboard.pressed[i] = input.heldCodes?.[i] ?? (i === 82 && !!input.control);
        Keyboard.count = input.keys.length;
        for (const [i, key] of input.keys.entries()) {
            Keyboard.codes[i] = key.keyCode;
            Keyboard.chars[i] = key.keyChar;
        }
    }

    tick(input: InterfaceInput, cycle: number): void | Promise<void> {
        this.set(input);
        Client.loopCycle = cycle;
        Keyboard.eventReader = 0;
        for (const [i, key] of input.keys.entries()) {
            Keyboard.eventCodes[i] = key.keyCode;
            Keyboard.eventChars[i] = key.keyChar;
        }
        Keyboard.eventWriter = Keyboard.eventLimit = input.keys.length & 127;
        if (this.client.game === undefined) return this.client['titleLoop']();
        return this.client.GameLoop();
    }

    restore(): void {
        Client.activeClient = this.previousClient;
        Client.loopCycle = this.cycle;
        Keyboard.eventCodes.set(this.eventCodes);
        Keyboard.eventChars.set(this.eventChars);
        [Keyboard.eventReader, Keyboard.eventWriter, Keyboard.eventLimit, Keyboard.keyCode, Keyboard.keyChar] = this.eventState;
        Object.defineProperties(Mouse, this.mouse);
        Keyboard.count = this.keyCount;
        Keyboard.codes.set(this.codes);
        Keyboard.chars.set(this.chars);
        for (let i = 0; i < this.pressed.length; i++) Keyboard.pressed[i] = this.pressed[i];
        MouseWheel.rotation = this.wheel;
        Minimenu.isOpen = this.menu;
    }
}
