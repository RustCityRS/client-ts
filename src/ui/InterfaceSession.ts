import FriendChatChannel from '#/client/FriendChatChannel';
import Client from '#/client/Client';
import MinimenuOps from './MinimenuOps';
import GameShell from '#/client/GameShell';
import type CollisionMap from '#/dash3d/CollisionMap';
import { toJsString } from '#/datastruct/JagString';
import ClientVarCache from '#/util/ClientVarCache';
import { arrayAtI16, arrayAtI32, arrayAtObj, arrayPutObj, requireNonNull } from '#/util/JavaArray';
import InterfaceList from './InterfaceList';
import HashTableIterator from '#/datastruct/HashTableIterator';
import Js5Resources from '#/cache/Js5Resources';
import { ClientScript } from '#/script/ClientScript';
import ScriptRunner from '#/script/ScriptRunner';
import IfType from './IfType';
import InterfaceView from './InterfaceView';
import type GameState from '#/game/GameState';
import { getObjType } from '#/model/ActorConfig';
import Minimenu, { type MenuOption } from './Minimenu';
import RoofModeStatics from '#/dash3d/RoofModeStatics';

export default class InterfaceSession {
    readonly runner: ScriptRunner;
    private game?: GameState;
    get friends(): { name: string; world: number }[] {
        return Array.from({ length: Client.friendCount }, (_, i) => ({ name: toJsString(requireNonNull(Client.friendUsername[i])), world: Client.friendWorld[i] }));
    }
    get clan(): { name: string }[] {
        return Array.from({ length: FriendChatChannel.memberCount }, (_, i) => ({ name: toJsString(requireNonNull(requireNonNull(arrayAtObj(FriendChatChannel.members, i)).name).formatName(0)) }));
    }
    // Transitional renderer access to ki.R:I.
    get minimapState(): number {
        return Client.minimapState;
    }
    set minimapState(value: number) {
        Client.minimapState = value;
    }
    // Browser scene picking and camera supplied by the active renderer.
    menuMap?: () => CollisionMap;
    get playerOps(): ({ label: string; cursor: number; secondary: boolean } | undefined)[] {
        return Minimenu.playerOption.map((label, i) => (label === null ? undefined : { label: toJsString(label), cursor: Minimenu.playerCursor[i], secondary: Minimenu.playerSecondary[i] }));
    }

    get roofMode(): number {
        return RoofModeStatics.getRoofMode();
    }

    constructor(
        readonly view: InterfaceView,
        private readonly assets: Js5Resources,
        report?: (error: Error) => void
    ) {
        if (view.components.length) {
            InterfaceList.top = view.components[0].id >>> 16;
            const group = (requireNonNull(IfType.m_list)[InterfaceList.top] = new Array<IfType | null>(requireNonNull(IfType.m_pInterfaces).GetFileIdLimit(InterfaceList.top)).fill(null));
            for (const c of view.components) group[c.id & 65535] = c;
            arrayPutObj(IfType.m_open, InterfaceList.top, true);
        }
        this.runner = new ScriptRunner(ClientScript.Get, report);
        view.setViewport(GameShell.m_sWid, GameShell.m_sHei);
        if (InterfaceList.top !== -1) Client.InterfaceCalculateSizeAndPosAll(false);
    }

    beginGame(game: GameState): void {
        this.game = game;
        this.view.setGroups([], new Map());
    }

    // Supply the view with the decoded components and current native mount table.
    refreshView(): void {
        const components = (group: number) => IfType.m_list?.[group] ?? [];
        const groups = new Map<number, (IfType | null)[]>();
        const iterator = new HashTableIterator(InterfaceList.subInterfaces);
        for (let sub = iterator.head(); sub !== null; sub = iterator.next()) {
            groups.set(Number(BigInt.asIntN(32, sub.key)), components(sub.group));
        }
        this.view.setGroups(components(InterfaceList.top), groups);
    }

    getVar = (varbit: number, varp: number): number => {
        if (varbit === -1) return varp === -1 ? -1 : arrayAtI32(ClientVarCache.m_var, varp);
        return ClientVarCache.GetVarbit(varbit);
    };

    // The transitional scene picker handles 1337 while native widgets above it keep their input.
    isSceneClick(x: number, y: number): boolean {
        if (this.game === undefined) return false;
        this.view.setViewport(GameShell.m_sWid, GameShell.m_sHei);
        const hits = this.view.menuHits(x, y);
        const sceneIndex = hits.findLastIndex(hit => hit.component.clientCode === 1337);
        if (sceneIndex < 0) return false;
        if (sceneIndex === hits.length - 1) return true;
        // Run sf.a synchronously in isolation. Keep the published menu (including
        // inactive array slots) and inventory hover exactly as the redraw left them.
        const { count, isOpen, hoverSlot } = Minimenu,
            hovered = Client.hoveredSlotCom;
        const actions = Minimenu.actions.slice(),
            keys = Minimenu.keys.slice(),
            cursors = Minimenu.cursor.slice();
        const paramB = Minimenu.paramB.slice(),
            paramC = Minimenu.paramC.slice();
        const options = Minimenu.option.slice(),
            targets = Minimenu.target.slice();
        try {
            Minimenu.count = 0;
            Minimenu.isOpen = false;
            for (let i = sceneIndex + 1; i < hits.length; i++) {
                const hit = hits[i],
                    c = hit.component;
                const dx = (x - hit.x) | 0,
                    dy = (y - hit.y) | 0;
                if (c.clientCode === 1338) {
                    if ((Client.minimapState === 0 || Client.minimapState === 3) && c.GetMask()) {
                        const start = arrayAtI32(c.maskStarts, dy);
                        if (start <= dx && dx <= ((start + arrayAtI32(c.maskWidths, dy)) | 0) && (!Minimenu.targetMode || (Minimenu.targetFlags & 64) === 0 || InterfaceList.GetComponent(Minimenu.targetComponent, Minimenu.targetChild) !== null))
                            return false;
                    }
                } else {
                    Minimenu.AddComponent(dy, dx, c);
                }
            }
            // ti.a sorts secondary actions below the scene's walk row.
            for (let i = 0; i < Minimenu.count; i++) if (Minimenu.actions[i] < 1000) return false;
            return true;
        } finally {
            Minimenu.count = count;
            Minimenu.isOpen = isOpen;
            Minimenu.hoverSlot = hoverSlot;
            Client.hoveredSlotCom = hovered;
            Minimenu.actions.set(actions);
            Minimenu.keys.set(keys);
            Minimenu.cursor.set(cursors);
            Minimenu.paramB.set(paramB);
            Minimenu.paramC.set(paramC);
            for (let i = 0; i < options.length; i++) {
                Minimenu.option[i] = options[i];
                Minimenu.target[i] = targets[i];
            }
        }
    }

    options(x: number, y: number): { scene: boolean; map?: { component: IfType; x: number; y: number }; entries: MenuOption[] } {
        const scene = !Minimenu.isOpen && this.isSceneClick(x, y);
        // SceneViewport combines its picked actors/locations with widget rows drawn at this point.
        const entries = scene && Minimenu.mouseX === x && Minimenu.mouseY === y ? this.menuEntries() : [];
        return { scene, entries };
    }

    menuEntries(): MenuOption[] {
        const entries: MenuOption[] = [];
        for (let i = Minimenu.count - 1; i >= 0; i--) {
            if (Minimenu.actions[i] === MinimenuOps.CANCEL) continue;
            entries.push({ label: toJsString(requireNonNull(Minimenu.label(i))), nativeIndex: i, secondary: arrayAtI16(Minimenu.actions, i) > 1000, run: () => Client.DoAction(i, this) });
        }
        return entries;
    }

    obj(id: number) {
        return getObjType(this.assets, id);
    }
}
