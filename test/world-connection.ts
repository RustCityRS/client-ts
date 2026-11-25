import Client from '#/client/Client.js';
import { fromLiteral } from '#/datastruct/JagString.js';

// Save just the Java statics these socket and applet fixtures share.
export function saveWorldConnection() {
    return {
        modeWhere: Client.modeWhere,
        affiliateId: Client.affiliateId,
        settings: Client.settings,
        selectedWorldId: Client.selectedWorldId,
        gameHost: Client.gameHost,
        worldListHost: Client.worldListHost,
        currentPort: Client.currentPort,
        primaryPort: Client.primaryPort,
        secondaryPort: Client.secondaryPort,
        worldListPort: Client.worldListPort,
        worldListPrimaryPort: Client.worldListPrimaryPort,
        worldListSecondaryPort: Client.worldListSecondaryPort
    };
}

export function setAppletWorld(): void {
    Client.modeWhere = Client.affiliateId = 0;
    Client.settings = null;
    Client.selectedWorldId = -1;
    Client.gameHost = Client.worldListHost = null;
    Client.primaryPort = Client.secondaryPort = Client.currentPort = 0;
    Client.worldListPrimaryPort = Client.worldListSecondaryPort = Client.worldListPort = 0;
}

export function setLocalWorld(worldId: number): void {
    Client.modeWhere = 2;
    Client.affiliateId = 0;
    Client.settings = fromLiteral('');
    Client.selectedWorldId = worldId;
    Client.gameHost = Client.worldListHost = '127.0.0.1';
    Client.currentPort = Client.primaryPort = Client.worldListPort = Client.worldListPrimaryPort = (worldId + 40000) | 0;
    Client.secondaryPort = Client.worldListSecondaryPort = (worldId + 50000) | 0;
}
