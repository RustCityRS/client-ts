import Client from '#/client/Client.js';
import ClientKeyboardListener from '#/client/ClientKeyboardListener.js';
import ClientMouseListener from '#/client/ClientMouseListener.js';
import GameShell from '#/client/GameShell.js';
import JagString, { fromJsString } from '#/datastruct/JagString.js';
import SoftwareFont from '#/graphics/SoftwareFont.js';
import SuperPacket from '#/io/SuperPacket.js';
import ComponentDrag from '#/ui/ComponentDrag.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import InterfaceSession from '#/ui/InterfaceSession.js';
import LocalisedText from '#/ui/LocalisedText.js';
import Minimenu from '#/ui/Minimenu.js';
import { requireNonNull } from '#/util/JavaArray.js';

// Isolate Java's process-wide menu, font, mouse and keyboard statics in a fresh process.
const ui: InterfaceSession = Object.create(InterfaceSession.prototype);
const font = new SoftwareFont(new Uint8Array(257).fill(6));
const source = new IfType(),
    parent = new IfType();
for (let i = 0; i < 640; i++) {
    const flags = (i / 5) | 0;
    Object.assign(ComponentDrag, { component: source, parent, visible: true, parentVisible: true, started: false, cycles: 0 });
    Object.assign(source, { dragDeadTime: 5, id: 40, drawCycle: 0, rootIndex: 0 });
    ClientMouseListener.mouseButton = 0;
    InterfaceList.cycle = 0;
    InterfaceList.dirty[0] = false;
    const packet = (Client.out = new SuperPacket(32));
    packet.SetEnc(Int32Array.of(1, 2, 3, 4));
    const menu = Minimenu;
    menu.count = [0, 1, 2, 4, 501][i % 5];
    Client.m_usingOneButtonMouse = flags & 1;
    LocalisedText.chooseOption = fromJsString('Menu');
    Client.fontBold12 = (flags & 64) === 0 ? font : null;
    for (let j = 0; j < 5; j++) {
        menu.option[j] = LocalisedText.chooseOption;
        menu.target[j] = (flags & 4) !== 0 && j === 3 ? null : JagString.empty;
        menu.actions[j] = j === 3 && (flags & 2) !== 0 ? 3001 : j % 2 === 0 ? 1002 : 22;
        menu.paramC[j] = 1234 + j;
        menu.paramB[j] = 21 + j;
        menu.keys[j] = BigInt(10 + j);
    }
    menu.targetComponent = 0x0102bacc;
    menu.targetChild = 11;
    ClientKeyboardListener.pressed[81] = (flags & 2) !== 0;
    menu.shiftClick = true;
    menu.spriteStyle = (flags & 4) !== 0;
    GameShell.m_sWid = 123;
    GameShell.m_sHei = 92;
    menu.mouseX = 120;
    menu.mouseY = 71;
    ClientMouseListener.clickX = (flags & 8) !== 0 ? 95 : 120;
    ClientMouseListener.clickY = 71;
    menu.deferred = (flags >> 4) % 3;
    menu.deferredX = 120;
    menu.deferredY = 71;
    menu.isOpen = false;
    menu.x = menu.y = menu.width = menu.height = -17;
    let status = 'ok';
    try {
        await Client.LoopIf3Drag(undefined, ui);
    } catch (e) {
        status = e instanceof TypeError ? 'null' : e instanceof RangeError ? 'bounds' : String(e);
    }
    console.log(
        [
            status,
            ComponentDrag.component?.id ?? -1,
            ComponentDrag.cycles,
            InterfaceList.dirty[0],
            menu.isOpen,
            menu.deferred,
            menu.deferredX,
            menu.deferredY,
            menu.x,
            menu.y,
            menu.width,
            menu.height,
            packet.m_pos,
            Buffer.from(requireNonNull(packet.m_data).subarray(0, packet.m_pos)).toString('hex')
        ].join(' ')
    );
}
