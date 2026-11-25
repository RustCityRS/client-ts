import Js5 from '#/cache/Js5.js';
import LruHashTable from '#/datastruct/LruHashTable.js';
import { ClientScript } from '#/script/ClientScript.js';
import Client from '#/client/Client.js';

// The JAR fixtures also supply il.B and isolate sf.g for each test client.
export function scriptArchive(file: (id: number) => Uint8Array | null) {
    const previousArchive = Client.m_pClientScripts;
    const previousCache = ClientScript.m_cache;
    const archive: Js5 = Object.create(Js5.prototype);
    archive.GetFile = (fileId, group) => {
        if (fileId !== 0) throw new Error('Expected CS2 file 0');
        return file(group);
    };
    Client.m_pClientScripts = archive;
    ClientScript.m_cache = new LruHashTable(128);
    return {
        [Symbol.dispose]() {
            Client.m_pClientScripts = previousArchive;
            ClientScript.m_cache = previousCache;
        }
    };
}
