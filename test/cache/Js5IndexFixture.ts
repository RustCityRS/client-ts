import { requireNonNull } from '#/util/JavaArray.js';
import { fromJsString } from '#/datastruct/JagString.js';
import Js5Index from '#/cache/Js5Index.js';

// These fixtures use JS names and dense file ID lists. The original
// reference table keeps dense lists null and stores lookup tables on the index.
export default class Js5IndexFixture extends Js5Index {
    private expandedFileIds?: (Int32Array | undefined)[];

    get fileIds(): (Int32Array | undefined)[] {
        if (!this.expandedFileIds) {
            const lists = new Array<Int32Array | undefined>(this.capacity);
            for (const group of requireNonNull(this.groupIds)) {
                lists[group] = requireNonNull(this.sparseFileIds)[group] ?? Int32Array.from({ length: requireNonNull(this.fileCounts)[group] }, (_, i) => i);
            }
            this.expandedFileIds = lists;
        }
        return this.expandedFileIds;
    }

    getGroupId(name: string): number {
        const id = this.groupNames?.get(fromJsString(name).toLowerCase().hashCode()) ?? -1;
        return id >= 0 && requireNonNull(this.fileCapacities)[id] !== 0 ? id : -1;
    }

    getFileId(group: number, name: string): number {
        return this.fileNames?.[group]?.get(fromJsString(name).toLowerCase().hashCode()) ?? -1;
    }
}
