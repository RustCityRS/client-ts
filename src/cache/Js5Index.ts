import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import Crc32 from '#/io/Crc32';
import PacketT from '#/io/PacketT';

import IntHashTable from './IntHashTable';
import Js5Compression from './Js5Compression';
import { loadGameWorld, loadLocalisedText } from '#/util/GamepackClasses';

export default class Js5Index {
    // HD ii.a(I)V
    static releaseHdStatics(guard: number): void {
        try {
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'frenchLoadedInterfaces');
            const GameWorld = loadGameWorld();
            releaseReferences(GameWorld, 'noActivity');
            if (guard !== 0) {
                return;
            }
            releaseReferences(LocalisedText, 'englishSelfFriend', 'selfFriend');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'ii.A(' + guard + ')');
        }
    }

    // db.b:I
    readonly m_indexCRC: number;
    // db.k:I
    m_indexVersion = 0;
    // db.i:I
    m_groupCount = 0;
    // db.e:I
    capacity = 0;
    // db.d:[I
    groupIds: Int32Array | null = null;
    // db.l:[I
    fileCounts: Int32Array | null = null;
    // db.j:[I
    fileCapacities: Int32Array | null = null;
    // db.g:[[I
    sparseFileIds: (Int32Array | null)[] | null = null;
    // db.n:[I
    groupCrcs: Int32Array | null = null;
    // db.a:[I
    groupVersions: Int32Array | null = null;
    // db.c:[I
    groupNameHashes: Int32Array | null = null;
    // db.m:Lmf;
    groupNames: IntHashTable | null = null;
    // db.o:[[I
    fileNameHashes: (Int32Array | null)[] | null = null;
    // db.f:[Lmf;
    fileNames: (IntHashTable | null)[] | null = null;

    // db.<init>([BI)V
    constructor(bytes: Uint8Array, expectedCrc: number) {
        this.m_indexCRC = Crc32.prefix(bytes, bytes.length);
        if ((expectedCrc | 0) !== this.m_indexCRC) throw new Error('JS5 index CRC mismatch');
        this.LoadIndex(bytes, -1);
    }

    // db.a([BI)V
    private LoadIndex(bytes: Uint8Array, minimumMaximumId: number): void {
        const packet = new PacketT(Js5Compression.Decompress(bytes));
        const protocol = packet.g1();
        if (protocol !== 5 && protocol !== 6) throw new Error(`Unsupported JS5 index format ${protocol}`);
        if (protocol < 6) this.m_indexVersion = 0;
        else this.m_indexVersion = packet.g4();
        const named = packet.g1();
        let id = 0;
        this.m_groupCount = packet.g2();
        const groupIds = (this.groupIds = new Int32Array(this.m_groupCount));
        let maxId = minimumMaximumId;
        for (let i = 0; i < this.m_groupCount; i++) {
            groupIds[i] = id = (id + packet.g2()) | 0;
            if (groupIds[i] > maxId) maxId = groupIds[i];
        }
        this.capacity = (maxId + 1) | 0;
        const fileCounts = (this.fileCounts = new Int32Array(this.capacity));
        const fileCapacities = (this.fileCapacities = new Int32Array(this.capacity));
        const sparseFileIds = (this.sparseFileIds = new Array<Int32Array | null>(this.capacity).fill(null));
        const groupCrcs = (this.groupCrcs = new Int32Array(this.capacity));
        const groupVersions = (this.groupVersions = new Int32Array(this.capacity));
        if (named !== 0) {
            this.groupNameHashes = new Int32Array(this.capacity).fill(-1);
            for (let i = 0; i < this.m_groupCount; i++) this.groupNameHashes[groupIds[i]] = packet.g4();
            this.groupNames = new IntHashTable(this.groupNameHashes);
        }
        for (let i = 0; i < this.m_groupCount; i++) groupCrcs[groupIds[i]] = packet.g4();
        for (let i = 0; i < this.m_groupCount; i++) groupVersions[groupIds[i]] = packet.g4();
        for (let i = 0; i < this.m_groupCount; i++) fileCounts[groupIds[i]] = packet.g2();
        for (let i = 0; i < this.m_groupCount; i++) {
            const group = groupIds[i];
            id = 0;
            let maxFileId = -1;
            const count = fileCounts[group];
            const ids = (sparseFileIds[group] = new Int32Array(count));
            for (let f = 0; f < count; f++) {
                ids[f] = id = (id + packet.g2()) | 0;
                if (ids[f] > maxFileId) maxFileId = ids[f];
            }
            fileCapacities[group] = (1 + maxFileId) | 0;
            if (count === fileCapacities[group]) sparseFileIds[group] = null;
        }
        if (named === 0) return;
        const fileNames: (IntHashTable | null)[] = (this.fileNames = new Array(this.capacity).fill(null));
        const fileNameHashes: (Int32Array | null)[] = (this.fileNameHashes = new Array(this.capacity).fill(null));
        for (let i = 0; i < this.m_groupCount; i++) {
            const group = groupIds[i];
            const count = fileCounts[group];
            const hashes = (fileNameHashes[group] = new Int32Array(fileCapacities[group]).fill(-1));
            for (let f = 0; f < count; f++) {
                const ids = sparseFileIds[group];
                const file = ids === null ? f : ids[f];
                hashes[file] = packet.g4();
            }
            fileNames[group] = new IntHashTable(hashes);
        }
    }
}
