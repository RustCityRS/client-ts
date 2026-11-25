import type Js5Resources from '#/cache/Js5Resources';
import BASTypeList from '#/config/BASTypeList';
import SeqType from '#/config/SeqType';
import SpotType from '#/config/SpotType';
import { getNpcType } from '#/model/ActorConfig';

export { default as BASType } from '#/config/BASType';
export { default as SeqType } from '#/config/SeqType';
export { default as SpotType } from '#/config/SpotType';

// Renderer callers still use a per-scene resource handle.
export default class ActorTypes {
    constructor(private readonly assets: Js5Resources) {}
    npc(id: number) {
        return getNpcType(this.assets, id);
    }
    bas(id: number) {
        return id === -1 ? BASTypeList.defaultType : BASTypeList.List(id);
    }
    seq(id: number) {
        return id === -1 ? undefined : SeqType.List(id);
    }
    spot(id: number) {
        return id === -1 ? undefined : SpotType.List(id);
    }
}
