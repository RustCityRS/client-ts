import SharedPtrList from '#/datastruct/SharedPtrList.js';
import Client from '#/client/Client.js';
import TitleScreen from '#/title/TitleScreen.js';
import TitleFlames from '#/title/TitleFlames.js';
import PixfontGeneric from '#/graphics/PixfontGeneric.js';
import SpriteLoader from '#/graphics/SpriteLoader.js';
import WorldMap from '#/ui/WorldMap.js';
import MapArea from '#/ui/MapArea.js';
import WorldMapLabels from '#/ui/WorldMapLabels.js';
import MapElementInstance from '#/ui/MapElementInstance.js';
import { mathRandom } from '#/util/JavaRandom.js';
import ScriptRunner from '#/script/ScriptRunner.js';

// Each Java oracle runs in a fresh VM. Isolate the corresponding shared TS state.
export function freshWorldMap() {
    const map = Object.getOwnPropertyDescriptors(WorldMap);
    const boot = [Client, TitleScreen, TitleFlames, PixfontGeneric, SpriteLoader].map(owner => ({
        owner,
        fields: Object.getOwnPropertyDescriptors(owner)
    }));
    const areas = MapArea.areas,
        labelIndex = WorldMapLabels.labelIndex;
    const seed = mathRandom['seed'];
    const ints = ScriptRunner.intStack.slice(),
        strings = ScriptRunner.stringStack.slice();
    const intLocals = ScriptRunner.intLocals,
        stringLocals = ScriptRunner.stringLocals,
        frameCount = ScriptRunner.frameCount;
    MapArea.areas = new SharedPtrList<MapArea>();
    WorldMap.icons = new SharedPtrList<MapElementInstance>();
    WorldMap.Reset(false);
    WorldMap.targetZoom = WorldMap.zoom = 0;
    WorldMap.flashTicks = WorldMap.flashCount = WorldMap.flashingIcon = 0;
    WorldMapLabels.labelIndex = 0;
    return {
        [Symbol.dispose]() {
            for (const { owner, fields } of boot) Object.defineProperties(owner, fields);
            Object.defineProperties(WorldMap, map);
            MapArea.areas = areas;
            WorldMapLabels.labelIndex = labelIndex;
            mathRandom['seed'] = seed;
            ScriptRunner.intStack.set(ints);
            ScriptRunner.stringStack.splice(0, strings.length, ...strings);
            ScriptRunner.intLocals = intLocals;
            ScriptRunner.stringLocals = stringLocals;
            ScriptRunner.frameCount = frameCount;
        }
    };
}
