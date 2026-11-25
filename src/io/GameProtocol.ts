import { requireNonNull } from '#/util/JavaArray';
import Client from '#/client/Client';

export interface MapSquare {
    id: number;
    key: Int32Array;
    map: number;
    loc: number;
    underwaterMap: number;
    underwaterLoc: number;
}

export interface Rebuild {
    zoneX: number;
    zoneZ: number;
    baseX: number;
    baseZ: number;
    localX: number;
    localZ: number;
    level: number;
    squares: MapSquare[];
    templates?: Int32Array;
}

// The browser scene consumes a snapshot after ac.a and bj.a have published their native state.
export function captureSceneRegion(): Rebuild {
    const keys = requireNonNull(Client.mapBuildKeys);
    const ground = requireNonNull(Client.mapBuildGroundFile),
        locs = requireNonNull(Client.mapBuildLocationFile);
    const underwater = requireNonNull(Client.sceneMapUnderwaterLandFile),
        underwaterLoc = requireNonNull(Client.sceneMapUnderwaterLocFile);
    const squares = Array.from(requireNonNull(Client.mapBuildIndex), (id, i) => ({
        id,
        key: keys[i],
        map: ground[i],
        loc: locs[i],
        underwaterMap: underwater[i],
        underwaterLoc: underwaterLoc[i]
    }));
    const player = requireNonNull(Client.localPlayer);
    const area: Rebuild = {
        zoneX: Client.mapBuildCentreZoneX,
        zoneZ: Client.mapBuildCentreZoneZ,
        baseX: Client.mapBuildBaseX,
        baseZ: Client.mapBuildBaseZ,
        localX: player.pathX[0],
        localZ: player.pathZ[0],
        level: Client.playerLevel,
        squares
    };
    if (Client.dynamicRegion) {
        const templates = (area.templates = new Int32Array(4 * 13 * 13));
        let index = 0;
        for (const plane of Client.dynamicChunks)
            for (const row of plane) {
                templates.set(row, index);
                index += row.length;
            }
    }
    return area;
}
