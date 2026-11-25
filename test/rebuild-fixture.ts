import Protocol from '#/io/Protocol.js';
import Client from '#/client/Client.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import { captureSceneRegion, type Rebuild } from '#/io/GameProtocol.js';
import SuperPacket from '#/io/SuperPacket.js';
import { localAssets } from './cachefile.js';
import { cachePath } from './reference.js';

// Run in a fresh process, as ac.a changes the active player's scene and the map archive globals.
export function runRebuild(bytes: Uint8Array, dynamic: boolean): Rebuild {
    localAssets(cachePath, [5]);
    Client.gameState = 25;
    Client.localPlayer = new ClientPlayer();
    Protocol.inPacket = new SuperPacket(0);
    Protocol.inPacket.m_data = bytes;
    Protocol.packetSize = bytes.length;
    Client.MessageBox = () => {};
    Client.RebuildPacket(dynamic);
    return captureSceneRegion();
}
