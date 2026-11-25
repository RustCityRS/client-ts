import Client from '#/client/Client.js';
import ReceivePlayerPositions from '#/client/ReceivePlayerPositions.js';
import ActorInfo from '#/game/ActorInfo.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import GameState from '#/game/GameState.js';
import LocChange from '#/dash3d/LocChange.js';
import MapSpotAnim from '#/dash3d/MapSpotAnim.js';
import SharedPtrList from '#/datastruct/SharedPtrList.js';

export function freshActors(): ActorInfo {
    ReceivePlayerPositions.m_lastNum = Client.npcCount = 0;
    Client.players.fill(null);
    ReceivePlayerPositions.m_apCache.fill(null);
    Client.npcs.fill(null);
    Client.localPlayer = Client.players[2047] = new ClientPlayer();
    Client.projectiles.clear();
    MapSpotAnim.active.clear();
    for (const plane of Client.groundObj ?? []) for (const row of plane) row.fill(null);
    Client.locChanges = new SharedPtrList<LocChange>();
    LocChange.scene = null;
    return new ActorInfo();
}

type Session = ConstructorParameters<typeof GameState>[0];
type Assets = ConstructorParameters<typeof GameState>[1];

export function freshGame(session: Session & { actors?: ActorInfo }, assets?: Assets): GameState {
    if (session.actors === undefined) freshActors();
    return new GameState(session, assets);
}
