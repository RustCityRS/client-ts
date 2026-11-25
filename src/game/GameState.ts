import Client from '#/client/Client';
import SuperPacket from '#/io/SuperPacket';
import { captureSceneRegion, type Rebuild } from '#/io/GameProtocol';
import type { GameSession } from '#/io/Login';
import ActorInfo from './ActorInfo';
import ActorTypes from './ActorTypes';
import type Js5Resources from '#/cache/Js5Resources';
import type CollisionMap from '#/dash3d/CollisionMap';
import RouteFinding from '#/movement/RouteFinding';
import type LocType from '#/config/LocType';
import ZoneState from './ZoneState';

const npcOps = [78, 3, 148, 30, 218];
const playerOps = [68, 106, 71, 180, 4, 133, 114, 175];

export default class GameState {
    readonly actors = new ActorInfo();
    readonly types?: ActorTypes;
    readonly zone: ZoneState;
    get players() {
        return this.actors.players;
    }
    get npcs() {
        return this.actors.npcs;
    }
    rebuild: Rebuild | null = null;
    loggedOut = false;
    resetToTitle: () => void | Promise<void> = () => Client.SetMainState(10);
    get logoutTimer(): number {
        return Client.logoutTimer;
    } // ia.l:I
    set logoutTimer(value: number) {
        Client.logoutTimer = value;
    }
    get cycle(): number {
        return Client.loopCycle;
    }
    set cycle(tick: number) {
        Client.loopCycle = tick;
    }
    get destinationX(): number {
        return Client.destinationX;
    }
    set destinationX(value: number) {
        Client.destinationX = value;
    }
    get destinationZ(): number {
        return Client.destinationZ;
    }
    set destinationZ(value: number) {
        Client.destinationZ = value;
    }

    constructor(
        public session: GameSession,
        assets?: Js5Resources
    ) {
        Client.out = session.outgoing;
        this.zone = new ZoneState();
        if (assets) this.types = new ActorTypes(assets);
        this.rebuild = session.rebuild;
    }

    refreshSceneRegion(changed: boolean): void {
        const region = captureSceneRegion();
        if (this.rebuild === null || changed) {
            this.rebuild = region;
            this.zone.clearScene();
        } else {
            this.rebuild.squares = region.squares;
            this.rebuild.templates = region.templates;
        }
    }

    write(opcode: number, payload: Uint8Array | ((packet: SuperPacket) => void) = new Uint8Array(0)): void {
        const packet = this.session.outgoing;
        packet.pHead(opcode);
        if (typeof payload === 'function') payload(packet);
        else packet.pArrayBuffer(payload, payload.length, 0);
    }

    walk(map: CollisionMap, x: number, z: number, ctrl = false): boolean {
        return this.move(map, x, z, ctrl, 0, 0, 0, true, 0, 0, 0);
    }

    walkMinimap(map: CollisionMap, x: number, z: number, ctrl: boolean, clickDx: number, clickDy: number, yaw: number, angleOffset: number, zoom: number): boolean {
        if (!this.move(map, x, z, ctrl, 1, 0, 0, true, 0, 0, 0)) return false;
        // bd.c(II)V, action 57 with argument 1.
        const packet = this.session.outgoing;
        packet.p1(clickDx);
        packet.p1(clickDy);
        packet.p2(yaw);
        packet.p1(57);
        packet.p1(angleOffset);
        packet.p1(zoom);
        packet.p1(89);
        packet.p2(this.actors.self.x);
        packet.p2(this.actors.self.z);
        packet.p1(Client.tryMoveNearest);
        packet.p1(63);
        return true;
    }

    move(_map: CollisionMap, x: number, z: number, _ctrl: boolean, mode: number, width: number, length: number, near: boolean, angle: number, sides: number, shape: number): boolean {
        const self = this.actors.self;
        return RouteFinding.FindRoute(width, z, x, length, near, angle, sides, self.pathZ[0], shape, mode, self.pathX[0]);
    }

    opLoc(map: CollisionMap, slot: number, id: number, x: number, z: number, shape: number, angle: number, type: Pick<LocType, 'width' | 'length' | 'forceApproach'>, ctrl = false): boolean {
        if (slot < 1 || slot > 6) return false;
        if (slot === 6) {
            this.write(94, Uint8Array.of(id + 128, id >> 8));
            return true;
        }
        // ah.a(BJII)Z
        if (shape !== 10 && shape !== 11 && shape !== 22) {
            this.move(map, x, z, ctrl, 2, 0, 0, true, angle, 0, (shape + 1) | 0);
        } else {
            const width = angle === 0 || angle === 2 ? type.width : type.length;
            const length = angle === 0 || angle === 2 ? type.length : type.width;
            let sides = type.forceApproach;
            if (angle !== 0) sides = (((sides << angle) & 15) + (sides >> (4 - angle))) | 0;
            this.move(map, x, z, ctrl, 2, width, length, true, 0, sides, 0);
        }
        x = (x + Client.mapBuildBaseX) | 0;
        z = (z + Client.mapBuildBaseZ) | 0;
        switch (slot) {
            case 1:
                this.write(254, Uint8Array.of(x, x >> 8, id >> 8, id + 128, z >> 8, z));
                break;
            case 2:
                this.write(194, Uint8Array.of(z + 128, z >> 8, x, x >> 8, id >> 8, id));
                break;
            case 3:
                this.write(84, Uint8Array.of(id + 128, id >> 8, z + 128, z >> 8, x, x >> 8));
                break;
            case 4:
                this.write(247, Uint8Array.of(z, z >> 8, x + 128, x >> 8, id >> 8, id));
                break;
            case 5:
                this.write(170, Uint8Array.of(id + 128, id >> 8, x + 128, x >> 8, z + 128, z >> 8));
                break;
        }
        return true;
    }

    opObj(map: CollisionMap, slot: number, id: number, x: number, z: number, ctrl = false, game = 0): boolean {
        if (slot < 1 || slot > 6) return false;
        if (slot === 6) {
            this.write(92, Uint8Array.of(id + 128, id >> 8));
            return true;
        }
        if (game === 1 || !this.move(map, x, z, ctrl, 2, 0, 0, false, 0, 0, 0)) this.move(map, x, z, ctrl, 2, 1, 1, false, 0, 0, 0);
        x = (x + Client.mapBuildBaseX) | 0;
        z = (z + Client.mapBuildBaseZ) | 0;
        switch (slot) {
            case 1:
                this.write(228, Uint8Array.of(id >> 8, id, x, x >> 8, z + 128, z >> 8));
                break;
            case 2:
                this.write(109, Uint8Array.of(z, z >> 8, x >> 8, x, id + 128, id >> 8));
                break;
            case 3:
                this.write(66, Uint8Array.of(x, x >> 8, id >> 8, id, z + 128, z >> 8));
                break;
            case 4:
                this.write(33, Uint8Array.of(id >> 8, id, x >> 8, x, z, z >> 8));
                break;
            case 5:
                this.write(48, Uint8Array.of(x >> 8, x + 128, id + 128, id >> 8, z, z >> 8));
                break;
        }
        return true;
    }

    opNpc(map: CollisionMap, slot: number, id: number, ctrl = false, _getVar?: (isBit: boolean, id: number) => number): boolean {
        const npc = this.npcs.get(id);
        if (!npc) return false;
        if (slot === 6) {
            let type = npc.npcType;
            if (type !== null && type.multi !== null) type = type.GetMultiNpc();
            if (type === null) return false;
            this.write(72, Uint8Array.of(type.id >> 8, type.id));
            return true;
        }
        const opcode = npcOps[slot - 1];
        if (opcode === undefined) return false;
        this.move(map, npc.pathX[0], npc.pathZ[0], ctrl, 2, 1, 1, false, 0, 0, 0);
        const low = id + (slot === 2 || slot === 3 ? 128 : 0);
        this.write(opcode, Uint8Array.from(slot === 3 || slot === 4 ? [id >> 8, low] : [low, id >> 8]));
        return true;
    }

    opPlayer(map: CollisionMap, slot: number, id: number, ctrl = false): boolean {
        const player = this.players.get(id);
        const opcode = playerOps[slot - 1];
        if (!player || opcode === undefined) return false;
        this.move(map, player.pathX[0], player.pathZ[0], ctrl, 2, 1, 1, false, 0, 0, 0);
        const low = id + (slot === 2 || slot === 5 || slot === 6 ? 0 : 128);
        this.write(opcode, Uint8Array.from(slot === 2 || slot === 8 ? [id >> 8, low] : [low, id >> 8]));
        return true;
    }
}
