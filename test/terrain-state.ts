import ClientBuild from '#/client/ClientBuild.js';
import world from '#/dash3d/world.js';

// A scene build replaces the three world grids and the scratch arrays allocated by aj.a.
export function preserveTerrainState(): Disposable {
    const worldFields = ['mainGroundh', 'levelHeightmaps', 'tileCameraClearance'] as const;
    const buildFields = ['m_mapl', 'm_floort1', 'm_floort2', 'm_floors', 'm_floorr', 'm_mapo', 'm_shadow', 'm_huetot', 'm_ligtot', 'm_sattot', 'm_comtot', 'm_tot', 'minusedlevel', 'm_hueOff', 'm_ligOff'] as const;
    const worldValues = worldFields.map(key => world[key]);
    const buildValues = buildFields.map(key => ClientBuild[key]);
    return {
        [Symbol.dispose]() {
            worldFields.forEach((key, i) => Reflect.set(world, key, worldValues[i]));
            buildFields.forEach((key, i) => Reflect.set(ClientBuild, key, buildValues[i]));
        }
    };
}
