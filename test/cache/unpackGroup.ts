import { requireNonNull } from '#/util/JavaArray.js';
import Js5 from '#/cache/Js5.js';
import type Js5Index from '#/cache/Js5Index.js';

// Standalone entry point for a packed group supplied by the caller.
export function unpackGroup(index: Js5Index, group: number, src: Uint8Array, key?: Int32Array): (Uint8Array | undefined)[] {
    const archive = new Js5({ index: () => index, group: () => src, prefetchGroup: () => {}, GetGroupLoadPercentage: () => 100 }, true, true);
    const ids = archive.GetFileList(group);
    if (!ids) throw new Error(`Missing JS5 group ${group}`);
    const files = new Array<Uint8Array | undefined>(requireNonNull(index.fileCapacities)[group]);
    for (const id of ids) files[id] = archive.FetchFile(id, key ?? null, group) ?? undefined;
    return files;
}
