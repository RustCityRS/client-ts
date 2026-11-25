import { requireNonNull } from '#/util/JavaArray.js';
import { fixtureDiskQueue } from './disk-queue.js';
import CursorType from '#/config/CursorType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import IfType from '#/ui/IfType.js';
import FloType from '#/config/FloType.js';
import FluType from '#/config/FluType.js';
import BASTypeList from '#/config/BASTypeList.js';
import SeqType from '#/config/SeqType.js';
import SpotType from '#/config/SpotType.js';
import MSITypeList from '#/config/MSITypeList.js';
import ObjType from '#/config/ObjType.js';
import NpcType from '#/config/NpcType.js';
import LocType from '#/config/LocType.js';
import InvType from '#/config/InvType.js';
import IdkType from '#/config/IdkType.js';
import VarpType from '#/config/VarpType.js';
import VarBitType from '#/config/VarBitType.js';
import EnumType from '#/config/EnumType.js';
import ParamType from '#/config/ParamType.js';
import StructType from '#/config/StructType.js';
import { closeSync, openSync, readSync } from 'node:fs';
import { join } from 'node:path';

import Js5MasterIndex from '#/cache/Js5MasterIndex.js';
import Client from '#/client/Client.js';
import Js5Resources, { browserDiskStore, type Js5Storage } from '#/cache/Js5Resources.js';
import Js5Compression from '#/cache/Js5Compression.js';
import Crc32 from '#/io/Crc32.js';
import Js5NetQueue from '#/io/Js5NetQueue.js';
import type Js5LocalCache from '#/cache/Js5LocalCache.js';
import Js5NetQueueRequest from '#/io/Js5NetQueueRequest.js';
import PacketT from '#/io/PacketT.js';

export function readGroup(directory: string, archive: number, group: number): Uint8Array {
    const entry = Buffer.alloc(6);
    const index = openSync(join(directory, 'main_file_cache.idx' + archive), 'r');
    try {
        if (readSync(index, entry, 0, 6, group * 6) !== 6) throw new Error(`Missing JS5 entry ${archive}/${group}`);
    } finally {
        closeSync(index);
    }
    const buffer = Buffer.alloc(entry.readUIntBE(0, 3));
    let sector = entry.readUIntBE(3, 3);
    const disk = openSync(join(directory, 'main_file_cache.dat2'), 'r');
    try {
        const header = Buffer.alloc(8);
        for (let offset = 0; offset < buffer.length; offset += 512) {
            const pos = sector * 520;
            if (readSync(disk, header, 0, 8, pos) !== 8 || header.readUInt16BE(0) !== group || header.readUInt16BE(2) !== offset >> 9 || header[7] !== archive) {
                throw new Error(`Invalid JS5 sector ${sector} for ${archive}/${group}`);
            }
            sector = header.readUIntBE(4, 3);
            const count = Math.min(512, buffer.length - offset);
            if (readSync(disk, buffer, offset, count, pos + 8) !== count) throw new Error(`Short JS5 sector ${sector}`);
        }
    } finally {
        closeSync(disk);
    }
    return buffer;
}
const emptyReference = Uint8Array.of(0, 0, 0, 0, 4, 5, 0, 0, 0);

export const archiveSlots = [
    'animFramesArchive',
    'basesArchive',
    'configArchive',
    'interfacesArchive',
    'm_pJagFx',
    'mapsArchive',
    'm_pMidi',
    'modelsArchive',
    'm_pSprites',
    'texturesArchive',
    'binaryArchive',
    'jingleArchive',
    'm_pClientScripts',
    'fontMetricsArchive',
    'vorbisArchive',
    'instrumentsArchive',
    'locConfigArchive',
    'enumsArchive',
    'npcConfigArchive',
    'objConfigArchive',
    'seqConfigArchive',
    'spotTypeArchive',
    'varBitArchive',
    'worldMapArchive',
    'quickChatArchive',
    'quickChatGlobalArchive',
    'materialsArchive',
    'js5Archive27'
] as const;

export function createJs5Resources(net: Js5NetQueue, diskQueue: Js5LocalCache, storage: Js5Storage | null = null): Js5Resources {
    Client.js5MasterIndex = null;
    Client.js5Providers = new Array(28).fill(null);
    Client.js5NetQueue = net;
    Client.js5DiskQueue = diskQueue;
    Client.cacheData = null;
    Client.browserCache = storage;
    Client.masterIndexStore = browserDiskStore(storage, 255);
    return new Js5Resources(diskQueue);
}

export function cacheAssets(tables: Map<number, Uint8Array>, read: Js5Storage['read'], initializeTypes = true): Js5Resources {
    const directory = new PacketT(5 + 28 * 8);
    directory.p1(0);
    directory.p4(28 * 8);
    for (let id = 0; id < 28; id++) {
        const table = tables.get(id) ?? emptyReference;
        directory.p4(Crc32.prefix(table, table.length));
        const header = new PacketT(Js5Compression.Decompress(table));
        directory.p4(header.g1() === 6 ? header.g4() : 0);
    }
    const net = new Js5NetQueue();
    net.RequestData = (padding, group, archive, urgent) => {
        if (archive !== 255 || group !== 255) throw new Error('Unexpected JS5 network request ' + archive + '/' + group);
        const request = new Js5NetQueueRequest();
        request.packet = directory;
        request.m_footerLength = padding;
        request.urgent = urgent;
        request.incomplete = false;
        return request;
    };
    const assets = createJs5Resources(net, fixtureDiskQueue(), {
        read: (archive, group) => (archive === 255 ? (tables.get(group) ?? emptyReference) : read(archive, group)),
        write: () => {
            throw new Error('Unexpected disk write in sector-cache fixture');
        }
    });
    const master = (Client.js5MasterIndex = new Js5MasterIndex(net, requireNonNull(Client.js5DiskQueue)));
    if (!master.load()) throw new Error('Missing master index in sector-cache fixture');
    for (let id = 0; id < archiveSlots.length; id++) {
        const discardPacked = [2, 5, 6, 23, 26].includes(id);
        const archive = Client.OpenJs5(discardPacked, id !== 6 && id !== 14, id, id !== 2);
        const slot = archiveSlots[id];
        Client[slot] = archive;
        if (requireNonNull(Client.js5Providers[id]).GetIndexPercentage() !== 100) throw new Error('Missing fixture index ' + id);
    }
    if (!initializeTypes) return assets;
    ObjType.types.Reset();
    for (const type of [InvType, VarpType, VarBitType, ParamType]) type.m_recentUse.Reset();
    NpcType.m_recentUse.Reset();
    LocType.m_recentUse.Reset();
    EnumType.m_recentUse.Reset();
    StructType.m_recentUse.Reset();
    FloType.clear();
    IdkType.ResetCache();
    FluType.clear();
    BASTypeList.CacheReset();
    SeqType.ResetCache();
    SpotType.ResetCache();
    MSITypeList.CacheReset();
    CursorType.clear();
    FloType.m_defaultWater = 0;
    const config = assets.archive(2);
    const models = assets.archive(7);
    ParamType.Init(config);
    FloType.Init(config);
    FluType.Init(config);
    IdkType.Init(config, models);
    LocType.Init(models, assets.archive(16), true);
    NpcType.Init(assets.archive(18), models);
    ObjType.Init(assets.archive(19), true, Client.p11Software, models);
    StructType.Init(config);
    SeqType.Init(assets.archive(20), assets.archive(1), assets.archive(0));
    BASTypeList.init(config);
    SpotType.Init(models, assets.archive(21));
    VarBitType.Init(assets.archive(22));
    VarpType.Init(config);
    InvType.Init(config);
    EnumType.Init(assets.archive(17));
    InterfaceList.top = -1;
    InterfaceList.subInterfaces.clear();
    InterfaceList.pressedContinue = null;
    IfType.Init(assets.archive(13), assets.archive(8), assets.archive(7), assets.archive(3));
    CursorType.init(assets.archive(2), assets.archive(8));
    MSITypeList.init(assets.archive(8), assets.archive(2));
    return assets;
}

export function localAssets(directory: string, archives: number[], initializeTypes = true): Js5Resources {
    const tables = new Map<number, Uint8Array>();
    for (const id of archives) tables.set(id, readGroup(directory, 255, id));
    return cacheAssets(tables, (archive, group) => readGroup(directory, archive, group), initializeTypes);
}
