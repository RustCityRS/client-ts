import ReceivePlayerPositions from '#/client/ReceivePlayerPositions';
import GameClient from '#/client/Client';
import ClientPlayer from '#/dash3d/ClientPlayer';
import { requireNonNull } from '#/util/JavaArray';

// Map-style access used by the scene and menu consumers while they are being ported.
class ActorSlots<T> {
    constructor(private readonly slots: (T | null)[]) {}
    get(id: number): T | undefined {
        return this.slots[id] ?? undefined;
    }
    *values(): IterableIterator<T> {
        for (const actor of this.slots) if (actor !== null) yield actor;
    }
}

export default class ActorInfo {
    readonly players = new ActorSlots(GameClient.players);
    readonly npcs = new ActorSlots(GameClient.npcs);
    get self(): ClientPlayer {
        return requireNonNull(GameClient.localPlayer);
    }
    get level(): number {
        return GameClient.playerLevel;
    }
    get activePlayerIds(): Int32Array {
        return ReceivePlayerPositions.m_lastID.subarray(0, ReceivePlayerPositions.m_lastNum);
    }
    get activeNpcIds(): Int32Array {
        return GameClient.npcIds.subarray(0, GameClient.npcCount);
    }
}
