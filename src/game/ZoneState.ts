import LocChange from '#/dash3d/LocChange';
import Client from '#/client/Client';
import ClientObj from '#/dash3d/ClientObj';
import { arrayAtObj } from '#/util/JavaArray';

// The old scene exposes decoded locations. Its entries are always occupied scene objects (bit 30).
// Remove this adapter when MapBuildLoop populates the native squares used by world.*Type.
function legacyTypecode(layer: number, plane: number, x: number, z: number): bigint {
    const loc = LocChange.scene?.getLoc(plane, x, z, layer);
    if (loc == null) return 0n;
    return (BigInt(loc.id & 0x7fffffff) << 32n) | BigInt(0x40000000 | ((loc.angle & 3) << 20) | ((loc.shape & 31) << 14));
}

export const legacyLocTypecodes = {
    WallType: (plane: number, x: number, z: number) => legacyTypecode(0, plane, x, z),
    DecorType: (plane: number, x: number, z: number) => legacyTypecode(1, plane, x, z),
    SceneType: (plane: number, x: number, z: number) => legacyTypecode(2, plane, x, z),
    GdType: (plane: number, x: number, z: number) => legacyTypecode(3, plane, x, z)
};

// Translate the native ground-stack attachment at the remaining WorldScene boundary.
export const legacyGroundObjects = {
    DelObj(plane: number, x: number, z: number): void {
        LocChange.scene?.setGroundItems?.(plane, x, z, []);
    },
    SetObj(plane: number, x: number, z: number, _height: number, top: ClientObj, _key: bigint, middle: ClientObj | null, bottom: ClientObj | null): void {
        const items = [top];
        if (middle !== null) items.push(middle);
        if (bottom !== null) items.push(bottom);
        LocChange.scene?.setGroundItems?.(plane, x, z, items);
    }
};

export default class ZoneState {
    groundItems(plane: number, x: number, z: number): ClientObj[] {
        const list = arrayAtObj(arrayAtObj(arrayAtObj(Client.groundObj, plane), x), z);
        const items: ClientObj[] = [];
        if (list !== null) {
            for (let node = list.head(); node !== null; node = list.next()) items.push(node.obj);
        }
        return items;
    }

    clearScene(): void {
        LocChange.scene = null;
    }
}
