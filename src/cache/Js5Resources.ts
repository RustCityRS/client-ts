import Client from '#/client/Client';
import { arrayAtObj, requireNonNull } from '#/util/JavaArray';
import { fromJsString } from '#/datastruct/JagString';
import Js5 from './Js5';
import type Js5LocalCache from './Js5LocalCache';
import type { Js5DiskStore } from './Js5DiskRequest';
import type Js5Index from './Js5Index';

// The browser implements these reads through IndexedDB. Sector-cache fixtures
// provide synchronous reads, as cg does on the JVM.
type DatabaseBytes = Uint8Array | undefined | null;
export interface Js5Storage {
    read(archive: number, group: number): DatabaseBytes | Promise<DatabaseBytes>;
    write(archive: number, group: number, data: Uint8Array): void | Promise<void>;
}

// The 530 launcher has its own database. Each key in the cache store is an archive.group pair.
export function openBrowserJs5Database(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('runescape-530', 1);
        request.onupgradeneeded = () => {
            request.result.createObjectStore('cache');
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export function browserDiskStore(disk: Js5Storage | null, archive: number): Js5DiskStore | null {
    if (disk === null) return null;
    return {
        read(group: number) {
            const data = disk.read(archive, group);
            return data instanceof Promise ? data.then(bytes => bytes ?? null) : (data ?? null);
        },
        write: (group: number, bytes: Uint8Array) => disk.write(archive, group, bytes)
    };
}

// Loading and browser-facing access to the providers created by the client.
export default class Js5Resources {
    constructor(private readonly diskQueue: Js5LocalCache) {}

    index(id: number): Js5Index | null {
        return arrayAtObj(Client.js5Providers, id)?.index() ?? null;
    }

    async stop(): Promise<void> {
        await this.diskQueue.EndAndJoin();
    }

    archive(id: number): Js5 {
        switch (id) {
            case 0:
                return requireNonNull(Client.animFramesArchive);
            case 1:
                return requireNonNull(Client.basesArchive);
            case 2:
                return requireNonNull(Client.configArchive);
            case 3:
                return requireNonNull(Client.interfacesArchive);
            case 4:
                return requireNonNull(Client.m_pJagFx);
            case 5:
                return requireNonNull(Client.mapsArchive);
            case 6:
                return requireNonNull(Client.m_pMidi);
            case 7:
                return requireNonNull(Client.modelsArchive);
            case 8:
                return requireNonNull(Client.m_pSprites);
            case 9:
                return requireNonNull(Client.texturesArchive);
            case 10:
                return requireNonNull(Client.binaryArchive);
            case 11:
                return requireNonNull(Client.jingleArchive);
            case 12:
                return requireNonNull(Client.m_pClientScripts);
            case 13:
                return requireNonNull(Client.fontMetricsArchive);
            case 14:
                return requireNonNull(Client.vorbisArchive);
            case 15:
                return requireNonNull(Client.instrumentsArchive);
            case 16:
                return requireNonNull(Client.locConfigArchive);
            case 17:
                return requireNonNull(Client.enumsArchive);
            case 18:
                return requireNonNull(Client.npcConfigArchive);
            case 19:
                return requireNonNull(Client.objConfigArchive);
            case 20:
                return requireNonNull(Client.seqConfigArchive);
            case 21:
                return requireNonNull(Client.spotTypeArchive);
            case 22:
                return requireNonNull(Client.varBitArchive);
            case 23:
                return requireNonNull(Client.worldMapArchive);
            case 24:
                return requireNonNull(Client.quickChatArchive);
            case 25:
                return requireNonNull(Client.quickChatGlobalArchive);
            case 26:
                return requireNonNull(Client.materialsArchive);
            case 27:
                return requireNonNull(Client.js5Archive27);
            default:
                throw new RangeError('archive ' + id);
        }
    }

    group(archive: number, group: number): boolean {
        return this.archive(archive).RequestGroupDownload(group);
    }

    files(archive: number, group: number, keys?: Int32Array): (Uint8Array | undefined)[] | undefined {
        const js5 = this.archive(archive);
        const ids = js5.GetFileList(group);
        if (!ids) return undefined;
        const files = new Array<Uint8Array | undefined>(js5.GetFileIdLimit(group));
        for (const id of ids) {
            const data = js5.FetchFile(id, keys ?? null, group);
            if (data === null) return undefined;
            files[id] = data;
        }
        return files;
    }

    file(archive: number, group: number, file = 0): Uint8Array | undefined {
        return this.archive(archive).GetFile(file, group) ?? undefined;
    }

    groupId(archive: number, name: string): number {
        return this.archive(archive).GetGroupId(fromJsString(name));
    }
}
