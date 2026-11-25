import { setLocalWorld } from '../world-connection.js';
import Client from '#/client/Client.js';
import GameShell from '#/client/GameShell.js';
import { attachMainInitHost } from '../main-init-fixture.js';
import DataFile from '#/cache/DataFile.js';
import Js5MasterIndex from '#/cache/Js5MasterIndex.js';
import type { Js5DiskStore } from '#/cache/Js5DiskRequest.js';
import File, { FileIoError } from '#/io/File.js';
import type BufferedRandomAccessFile from '#/io/BufferedRandomAccessFile.js';
import PacketT from '#/io/PacketT.js';
import { requireNonNull } from '#/util/JavaArray.js';
import Signlink from '#/util/Signlink.js';

function capacity(file: BufferedRandomAccessFile | null): number {
    return file?.['readBuffer'].length ?? -1;
}
function store(value: Js5DiskStore | null): string {
    if (!(value instanceof DataFile)) return '-';
    return [value['archive'], value['maximumSize'], value['dataFile'] === Client.cacheData, capacity(value['indexFile'])].join('/');
}
function archive(id: number, packed: boolean, prefetch: boolean, unpacked: boolean): void {
    const before = Client.js5Providers[id] ?? null;
    try {
        const j = Client.OpenJs5(packed, prefetch, id, unpacked);
        const provider = requireNonNull(Client.js5Providers[id]);
        console.log(
            [
                'archive',
                id,
                j['provider'] === provider,
                before === provider,
                j['discardPacked'],
                j['discardUnpacked'],
                provider.indexCrc,
                provider.indexVersion,
                provider['indexStore'] === Client.masterIndexStore,
                store(provider['groupStore']),
                provider['prefetching']
            ].join(' ')
        );
    } catch (e) {
        if (!(e instanceof Error)) throw e;
        console.log('error ' + id + ' ' + (Client.js5MasterIndex?.['packet']?.m_pos ?? '-'));
    }
}

for (const scenario of ['no-disk', 'normal', 'open-i3', 'open-master', 'open-uid', 'close-i2', 'null-i4', 'swap-dat', 'swap-i13', 'swap-master', 'swap-uid']) {
    let mode = scenario;
    let other: Signlink | null = null;
    const closed: string[] = [];
    function raw(name: string): File {
        return File.open(
            {
                length() {
                    if (mode === 'open-' + name) throw new FileIoError('read length');
                    if (mode === 'swap-' + name) GameShell.signlink = other;
                    return 0n;
                },
                close() {
                    closed.push(name);
                    if (mode === 'close-' + name) throw new FileIoError('close');
                },
                read() {
                    return -1;
                },
                write() {},
                seek() {}
            },
            name,
            (1n << 63n) - 1n
        );
    }
    const game = new Client();
    attachMainInitHost(game);
    const link = (GameShell.signlink = new Signlink({ getSize: () => ({ width: 765, height: 503 }) }));
    if (mode.startsWith('swap-')) {
        other = new Signlink();
        other.cacheData = raw('second-dat');
        other.cacheIndexes = Array.from({ length: 28 }, (_, i) => raw('second-i' + i));
        other.masterIndex = raw('second-master');
        other.randomFile = raw('second-uid');
    }
    setLocalWorld(1);
    Client.modeWhere = 2;
    Client.cacheData = null;
    Client.cacheIndexFiles = new Array(28).fill(null);
    DataFile.masterIndexFile = null;
    Client.masterIndexStore = null;
    Client.uidFile = null;
    Client.js5MasterIndex = null;
    Client.js5Providers = new Array(28).fill(null);
    if (scenario !== 'no-disk') {
        link.cacheData = raw('dat');
        link.cacheIndexes = Array.from({ length: 28 }, (_, i) => (i === 4 && scenario === 'null-i4' ? null : raw('i' + i)));
        link.masterIndex = raw('master');
        link.randomFile = raw('uid');
    }
    console.log('scenario ' + scenario);
    try {
        await game['MainInit']();
    } catch (error) {
        if (scenario !== 'null-i4' || !(error instanceof TypeError)) throw error;
        console.log('setup-error');
    }
    const open = Client.cacheIndexFiles.filter(file => file !== null);
    console.log(
        [
            'files',
            capacity(Client.cacheData),
            open.length,
            open.every(file => capacity(file) === 6000),
            capacity(DataFile.masterIndexFile),
            capacity(Client.uidFile),
            store(Client.masterIndexStore),
            [link.cacheData === null, link.cacheIndexes === null, link.masterIndex === null, link.randomFile === null].join('/')
        ].join(' ')
    );
    if (other !== null) console.log('second ' + [GameShell.signlink === other, other.cacheData === null, other.cacheIndexes === null, other.masterIndex === null, other.randomFile === null].join('/'));
    archive(0, true, false, false);
    const master = (Client.js5MasterIndex = new Js5MasterIndex(requireNonNull(Client.js5NetQueue), requireNonNull(Client.js5DiskQueue)));
    archive(1, false, true, false);
    const bytes = Uint8Array.from({ length: 5 + 29 * 8 }, (_, i) => (i < 5 ? 0 : i * 11));
    const request = requireNonNull(master['request']);
    request.packet = new PacketT(bytes);
    request.packet.m_pos = bytes.length;
    request.incomplete = false;
    master.load();
    for (const id of [-1, 0, 0, 4, 27, 28, 29]) archive(id, id !== 0, id !== 4, id !== 27);
    await game['MainQuit']();
    console.log('closed ' + closed.join(','));
    mode = 'cleanup';
    await link.stopWorker();
    if (other !== null) await other.stopWorker();
}
