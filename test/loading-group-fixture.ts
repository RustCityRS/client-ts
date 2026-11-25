import Client from '#/client/Client.js';
import SpriteLoader from '#/graphics/SpriteLoader.js';
import TitleFlames from '#/title/TitleFlames.js';
import TitleScreen from '#/title/TitleScreen.js';

// The 21 archive-8 ids in ld.a, g.a and pf.a lookup order, with their class-initializer values.
export const loadingGroupIds = [
    [Client, 'fontPlain11Id', 0],
    [Client, 'p12FullGroup', 0],
    [Client, 'fontBold12Id', 0],
    [Client, 'mapfunctionSpriteGroup', 0],
    [SpriteLoader, 'hitmarksId', 0],
    [Client, 'hitbarDefaultId', 0],
    [SpriteLoader, 'headiconsPkId', 0],
    [Client, 'headiconsPrayerGroup', 0],
    [Client, 'hintHeadiconsGroup', 0],
    [Client, 'hintMapmarkersSpriteGroup', 0],
    [Client, 'mapflagGroupId', 0],
    [Client, 'crossGroup', 0],
    [SpriteLoader, 'mapdotsGroupId', 0],
    [Client, 'scrollbarGroupId', 0],
    [Client, 'nameIconsGroup', 0],
    [SpriteLoader, 'floorShadowsId', 0],
    [SpriteLoader, 'compassId', 0],
    [Client, 'hintMapEdgeSpriteId', 0],
    [TitleScreen, 'backgroundId', -1],
    [TitleScreen, 'logoGroup', -1],
    [TitleFlames, 'runesGroup', 0]
] as const;

export function preserveLoadingGroupIds() {
    const previous = loadingGroupIds.map(([owner, field]) => Reflect.get(owner, field));
    return {
        [Symbol.dispose]() {
            loadingGroupIds.forEach(([owner, field], index) => Reflect.set(owner, field, previous[index]));
        }
    };
}
